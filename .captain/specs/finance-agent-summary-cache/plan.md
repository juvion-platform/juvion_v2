# Plan: Finance Agent Summary Cache

**Spec:** `./spec.md` · **Created:** 2026-04-28

---

## 1. Architecture

### 1.1 Component map

```
                  Dashboard mount on /finance/dashboard
                         │
                         ▼
        ┌──────────────────────────────────────────────────┐
        │ POST /finance-agent/forecast-narrative           │
        │ POST /finance-agent/situations                   │
        │ POST /finance-agent/risk-scores includeNarrative │
        └────────────┬─────────────────────────────────────┘
                     ▼
        ┌──────────────────────────────────────────────────┐
        │ service.ts (existing)                            │
        │   ├─ readThroughCache(type, key, fetchFn)        │  ← new wrapper
        │   │     ▼ cache hit?  return cached + fromCache  │
        │   │     ▼ no?         await fetchFn()            │
        │   │                   write cache                │
        │   │                   return live + fromCache    │
        │   └─ existing live LLM call (unchanged)          │
        └──────────────────────────────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────────────────────────┐
        │ AgentSummaryCache (Mongo)                        │
        │   { collegeId, type, key, value, inputHash,      │
        │     generatedAt, expiresAt, provider, model, … } │
        └──────────────────────────────────────────────────┘
                     ▲
        ┌────────────┼─────────────────────────────────────┐
        │ writes     │                                      │
        ├──────────────────────────────────────────────────┤
        │ Daily cron 03:00                                 │
        │   For each active college:                       │
        │     ├─ generate forecast narrative → cache       │
        │     ├─ generate situations → cache               │
        │     └─ generate top-50 risk narratives → cache   │
        │                                                  │
        │ Event invalidation hooks:                        │
        │   ├─ Hold activate/waive  → expire situations    │
        │   ├─ Pause-escalation     → expire risk-narrative│
        │   ├─ fee-alerts-cron-done → expire situations    │
        │   └─ Manual refresh       → expire + immediate   │
        │                              live re-fetch       │
        └──────────────────────────────────────────────────┘
```

### 1.2 New module

`backend/src/modules/juvi/finance-agent/summary-cache/` (new sub-folder):
- `cache-store.ts` — `getCached`, `setCache`, `invalidateCache`, `computeInputHash`
- `cron.worker.ts` — daily 03:00 BullMQ job
- `service.ts` — read-through wrappers (`withCache`, called by the existing handle* methods)
- `prompts-cache.ts` — none new; reuses `prompts.ts`

### 1.3 New Mongoose models

```ts
// AgentSummaryCache
interface IAgentSummaryCache {
  _id: ObjectId;
  collegeId: ObjectId;
  type: 'forecast' | 'situations' | 'risk-score-narrative';
  key: string;                  // monthAnchor ISO | 'current' | studentId hex
  value: unknown;               // string for narratives, JSON for situations[]
  inputHash: string;            // SHA-256 hex of upstream-data fingerprint
  generatedAt: Date;
  expiresAt: Date;              // TTL index — auto-deleted when past
  provider: 'claude' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  generatedBy: 'cron' | 'live' | 'refresh';
  createdAt: Date;
  updatedAt: Date;
}

// AgentSummaryCacheCronRun (mirrors FeeAlertsCronRun)
interface IAgentSummaryCacheCronRun {
  _id: ObjectId;
  startedAt: Date;
  finishedAt?: Date;
  totalColleges: number;
  successColleges: number;
  failedColleges: number;
  cachedRows: { forecast: number; situations: number; riskScore: number };
  errors: Array<{ collegeId?: ObjectId; type?: string; message: string; stackSnippet?: string }>;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostInr: number;
  topLevelError?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 1.4 Indexes

| Collection | Index | Purpose |
|---|---|---|
| AgentSummaryCache | `{ collegeId: 1, type: 1, key: 1 }` (unique) | Read path; enforces 1 row per (college, type, key) |
| AgentSummaryCache | `{ expiresAt: 1 }` (TTL: 0 — Mongo auto-deletes when past) | Auto-cleanup |
| AgentSummaryCacheCronRun | `{ startedAt: -1 }` | Audit lookups |

### 1.5 Read-through wrapper

```ts
// summary-cache/service.ts
export async function withCache<T>(opts: {
  collegeId: string;
  type: 'forecast' | 'situations' | 'risk-score-narrative';
  key: string;
  inputHash: string;          // current fingerprint
  fetchLive: () => Promise<{ value: T; provider: 'claude' | 'openai'; model: string; inputTokens: number; outputTokens: number; costInr: number }>;
  ttlMs?: number;             // default 24h
  generatedBy?: 'cron' | 'live' | 'refresh';
}): Promise<{ value: T; fromCache: boolean; generatedAt: Date; expiresAt: Date }>;
```

Logic:

1. Read `AgentSummaryCache.findOne({ collegeId, type, key })`
2. If row exists AND `row.expiresAt > now` AND `row.inputHash === opts.inputHash`:
   - Return `{ value: row.value, fromCache: true, generatedAt: row.generatedAt, expiresAt: row.expiresAt }`
3. Else (miss / expired / drift):
   - `const live = await opts.fetchLive()`
   - Upsert `AgentSummaryCache` with new value + computed `expiresAt = now + ttlMs`
   - Return `{ value: live.value, fromCache: false, generatedAt: now, expiresAt }`

Failure mode: if `fetchLive()` throws, propagate the error (don't cache failures). The caller's existing fallback logic (return projection-only, empty array, etc.) still kicks in.

### 1.6 Cron flow

```
03:00 BullMQ tick fires:
  audit = AgentSummaryCacheCronRun.create({ startedAt: now })
  colleges = await College.find({ status: 'active' })
  audit.totalColleges = colleges.length

  // Process 5 colleges in parallel
  await withBoundedConcurrency(colleges, 5, async (college) => {
    try {
      // 1. Forecast (one call)
      await generateAndCacheForecast(college._id);
      audit.cachedRows.forecast++;

      // 2. Situations (one call)
      await generateAndCacheSituations(college._id);
      audit.cachedRows.situations++;

      // 3. Top-50 risk-score narratives (50 calls, bounded concurrency 5)
      const top50 = await getTop50DefaultersByRiskScore(college._id);
      await withBoundedConcurrency(top50, 5, async (student) => {
        await generateAndCacheRiskScore(college._id, student._id);
        audit.cachedRows.riskScore++;
      });

      audit.successColleges++;
    } catch (err) {
      audit.errors.push({ collegeId: college._id, message: err.message });
      audit.failedColleges++;
    }
  });

  audit.finishedAt = now
  await audit.save()
```

Each `generateAndCacheX(...)` calls the existing service method WITHOUT the cache wrapper (forced live), then writes to `AgentSummaryCache`.

### 1.7 Event-driven invalidation hooks

| Event | Invalidation action |
|---|---|
| `fee-holds-service.activateHold(...)` succeeds | `invalidateCache(collegeId, 'situations', 'current')` |
| `fee-holds-service.waiveHold(...)` succeeds | `invalidateCache(collegeId, 'situations', 'current')` |
| `fee-alerts-cron.worker` per-college completes | `invalidateCache(collegeId, 'situations', 'current')` |
| `service.handleDismissSituation(...)` succeeds | `invalidateCache(collegeId, 'situations', 'current')` |
| `service.pauseEscalation(...)` succeeds | `invalidateCache(collegeId, 'risk-score-narrative', studentId)` |
| Manual refresh endpoint | `invalidateCache(...)` then call `withCache(...)` to repopulate |

`invalidateCache(collegeId, type, key?)` upserts `expiresAt: new Date(0)` so the TTL deleter or the read-time check both bypass it.

### 1.8 InputHash computation (per type)

| Type | Input fingerprint |
|---|---|
| `forecast` | SHA-256 of `JSON.stringify(collectionTimeSeries.last30days)` |
| `situations` | SHA-256 of `JSON.stringify(gatherCandidates(collegeId))` |
| `risk-score-narrative` | SHA-256 of `JSON.stringify(assembleFeatures(collegeId, studentId))` |

The fingerprint is cheap to compute (already part of the live-call path). On read, we recompute and compare; mismatch → invalidate + miss → live call.

### 1.9 HTTP API additions

| Method | Path | Permission | Body |
|---|---|---|---|
| POST | `/api/juvi/finance-agent/cache/refresh` | `('finance', 'read')` | `{ type: 'forecast' \| 'situations' \| 'risk-score-narrative', key?: string }` |

Rate limit: 10/min/user (prevents accidental cache-bust storms).

Behavior: invalidate → call `withCache(...)` → return the fresh value with `fromCache: false`.

### 1.10 Frontend changes

**`AIForecastBanner.tsx`:**
- Render `Last updated Xh ago` line under the narrative
- Render `[↻]` icon button (small, ghost)
- Click → POST `/cache/refresh` with `{ type: 'forecast' }`
- During refresh: show pulsing border + spinner; old value visible until new arrives

**`SituationCards.tsx`:**
- Same pattern — timestamp + refresh button on the section header

**`PersonThumbnail` / risk-score popover (PersonPhotoBlock):**
- No UI change — still lazy-fetch on hover; cache works server-side transparently

### 1.11 API response shape changes

Existing endpoints add a `fromCache: boolean` and `generatedAt: ISODate` field:

```ts
// /forecast-narrative response
{
  projection: { ... },
  narrative: string | null,
  generatedAt: string,
  fromCache: boolean,        // NEW
}

// /situations response
{
  situations: Situation[],
  generatedAt: string,        // NEW
  fromCache: boolean,         // NEW
}
```

Backward-compatible — adds fields, doesn't change existing ones.

---

## 2. Database

### 2.1 Schema files

- `backend/src/models/juvi/AgentSummaryCache.ts`
- `backend/src/models/juvi/AgentSummaryCacheCronRun.ts`

### 2.2 Indexes (per §1.4)

### 2.3 No existing collections touched

---

## 3. Dependencies

No new npm packages. Reuses:
- `@anthropic-ai/sdk` / `openai` (already installed)
- `bullmq` (already installed)
- `crypto` (Node built-in for SHA-256)

### Environment variables (new)
```
AGENT_CACHE_TTL_HOURS=12
AGENT_CACHE_TOP_RISK_N=20
AGENT_CACHE_CRON_PATTERN=0 3 * * *
AGENT_CACHE_CRON_CONCURRENCY=5
```

All optional with the defaults shown. TTL=12h and Top-N=20 are tuned per the spec changelog.

---

## 4. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Stale narrative confuses officer** ("agent says 5 holds pending; I just approved 3") | Event-driven invalidation on mutation; `Last updated Xh ago` display; `[↻]` manual refresh |
| 2 | **Cross-college cache leak** | `collegeId` is the FIRST field in compound index + every read; reject cross-college x-college-id without super_admin |
| 3 | **Cron run spike trips Anthropic rate-limit** (100 colleges × 3 endpoints × top-50 student calls) | `withBoundedConcurrency(5)` at college level + `withBoundedConcurrency(5)` at student level → max 25 in-flight |
| 4 | **Cron failure during a single college** | Per-college try/catch; other colleges continue; audit row records the error; next cron run heals |
| 5 | **InputHash drift causes thrash** (heuristic produces different output for same data) | Hash computation is on canonical input only (sorted, normalized); drift is treated as legitimate invalidation |
| 6 | **TTL index race** (read returns row that's about to be deleted) | Read query also checks `expiresAt > now` defensively; TTL is a backstop |
| 7 | **Provider switch leaves stale Claude rows** | Cache key includes `provider + model`; switch produces fresh miss → live call → new row |
| 8 | **Cron timing collision** with the existing `fee-alerts-cron` | Schedule offset (02:00 vs 03:00); manually verify via cron-job listing pre-deploy |
| 9 | **Cache poisoning via injection** (LLM returns malicious markdown) | Frontend already renders narratives via `whitespace-pre-wrap`, no HTML injection vector |
| 10 | **Manual refresh DoS** | 10/min/user rate-limit; admin can disable via env var |
| 11 | **Mid-day data drift not caught by event** (e.g. payment volume spikes) | TTL caps drift to 24h; manual refresh button; `inputHash` drift detection |
| 12 | **Audit log size growth** | Cron audit retains 90 days (mirror `FeeAlertsCronRun` retention); cache rows TTL after 24h |

---

## 5. Observability

- Log prefixes: `[summary-cache]` for hits/misses/invalidations; `[summary-cache:cron]` for cron events
- Per-call log: `[summary-cache] hit type=situations college=<id>` / `[summary-cache] miss reason=expired type=forecast`
- Cron audit: `AgentSummaryCacheCronRun` records counts + cost roll-up
- Daily summary log line: `[summary-cache:cron] colleges=100 success=98 failed=2 cached=296 totalCostInr=42.15`
- Frontend dev-mode console: log `fromCache: true/false` on every dashboard call

---

## 6. Open Questions (operational)

- **OQ-P1:** Cache invalidation under multi-instance backend deployments — if the backend horizontally scales, does in-process state become stale? Default: cache lives in MongoDB; reads + writes are atomic per row. No multi-instance issue. Confirmed.
- **OQ-P2:** Manual refresh + cron collision — what if a user clicks `[↻]` exactly when the 03:00 cron is processing their college? Both write the same row via upsert with unique index → later writer wins. Brief race window; outcome is fine either way.
- **OQ-P3:** Should the cron also pre-compute "generic mode" narratives (e.g. for unauthenticated demo views)? Default: no — auth is required everywhere.
- **OQ-P4:** Cost capping per cron run — should we add a hard ceiling (e.g. `MAX_COST_PER_CRON_RUN_INR=100`) and abort early? Default: no for v1; the bounded concurrency + per-call cost is predictable. Add if a runaway is observed.
- **OQ-P5:** Risk-score top-50 — should N be configurable per college (some have 1000+ defaulters)? Default: env-configurable globally; defer per-college config.

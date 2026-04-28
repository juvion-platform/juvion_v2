# Tasks: Finance Agent Summary Cache

**Spec:** `./spec.md` · **Plan:** `./plan.md` · **Created:** 2026-04-28
**Total tasks:** 10 (8 Code, 1 Doc, 1 Measurement)

---

## Task DAG

```
Pre-deploy baseline:
  C0  1-week LLM cost baseline measurement   ◄── (none; runs FIRST)
       └─ Aggregate AgentAction by type + sum costInr; record numbers

Foundation (parallel, after C0 starts measuring):
  C1  Mongoose models           ◄── (none)
       └─ AgentSummaryCache + AgentSummaryCacheCronRun + indexes
  C2  Cache store helpers       ◄── (none)
       └─ getCached / setCache / invalidateCache / computeInputHash

Service layer:
  C3  Read-through wrappers     ◄── C1, C2
       └─ withCache(...) + integration into handleForecastNarrative,
          handleSituations, handleRiskScores

Cron worker:
  C4  Cache cron worker         ◄── C3
       └─ daily 03:00; iterates active colleges; populates 3 cache types

HTTP API:
  C5  Manual refresh endpoint   ◄── C3
       └─ POST /api/juvi/finance-agent/cache/refresh

Event invalidation:
  C6  Invalidation hooks        ◄── C2
       └─ wired into fee-holds-service activate/waive,
          fee-alerts-cron worker, pause-escalation, dismissSituation

Frontend (parallel after C5):
  C7  Frontend timestamp + refresh button
       └─ AIForecastBanner + SituationCards: Last updated + [↻]

Tail:
  C8  E2E integration tests     ◄── all above
       └─ cache hit + miss + TTL expiry + invalidation + cross-college

Docs:
  C9  API reference + QA checklist  ◄── C5, C8
```

### Parallelism opportunities

- **Foundation (C1 + C2):** 2 fully parallel; no cross-deps
- **Mid-tier (C4 + C5 + C6):** all 3 parallel after C3 lands
- **C7 (frontend):** parallel with C8 once C5 lands

### Front-loaded risks

- **C3 (read-through wrapper)** is the single integration point that 3 service methods + the manual-refresh endpoint depend on. Get the contract right; the rest is mechanical.
- **C4 (cron)** runs against real LLM provider; cost spike risk during cron. Bounded concurrency + audit error capture are non-negotiable.

---

## Task List

| # | Task | Type | Depends | Tests | Status |
|---|---|---|---|---:|---|
| C0 | 1-week LLM cost baseline measurement (script + recorded numbers) | Measurement | — | 16 | Done |
| C1 | Mongoose models (AgentSummaryCache + AgentSummaryCacheCronRun + indexes) | Code | — | 12+ | Pending |
| C2 | Cache store helpers (`getCached`, `setCache`, `invalidateCache`, `computeInputHash`) | Code | — | 15+ | Pending |
| C3 | Read-through `withCache(...)` wrapper + integration into 3 service methods | Code | C1, C2 | 18+ | Pending |
| C4 | Daily cron worker (03:00; iterates active colleges; bounded concurrency 5) | Code | C3 | 12+ | Pending |
| C5 | HTTP API: manual refresh endpoint + Zod + rate-limit | Code | C3 | 8+ (e2e) | Pending |
| C6 | Event-driven invalidation hooks (5 trigger points) | Code | C2 | 10+ | Pending |
| C7 | Frontend timestamp + refresh button (`[↻]`) on AIForecastBanner + SituationCards | Code | C5 | 6+ | Pending |
| C8 | E2E integration tests (cache hit/miss/TTL/invalidation/cross-college/cron) | Code | C3, C4, C5, C6 | 10+ (e2e) | Pending |
| C9 | API reference + QA/deploy checklist | Doc | C5, C8 | — | Pending |

**Total tests target:** ~91 backend + ~6 frontend = ~97 new tests.

---

## Task Details

---

### Task C0: 1-week LLM cost baseline measurement
**Type:** Measurement (script + recorded numbers) · **Depends:** — · **Tests:** —

**Goal:** capture a defensible baseline of current LLM cost so the success metric (≥80% reduction after deploy) is verifiable.

**Acceptance Criteria:**

- New script `backend/src/scripts/measure-llm-baseline.ts`:
  ```ts
  // Aggregates AgentAction over a configurable window (default last 7 days).
  // Output: per-college, per-type table with call counts + sum(costInr).
  // CSV-friendly output to stdout for capture into the deploy memo.
  ```
- CLI flags:
  - `--days=<N>` (default 7)
  - `--college-id=<id>` (optional; default all active colleges)
  - `--csv` (output as CSV; default human-readable table)
- Run weekly during the build-out phase (before C1-C9 deployment); record numbers in `.captain/specs/finance-agent-summary-cache/baseline.md`
- The recorded baseline is the "before" reference for QA sign-off in C9

**Output sample:**

```
provider | type            | call count | total cost INR
---------+-----------------+------------+---------------
claude   | forecast        |    487     |     ₹24.35
claude   | situations      |    421     |     ₹42.10
claude   | risk-narrative  |    156     |     ₹4.68
claude   | reminder-drafts |     58     |     ₹17.40
claude   | chat            |     32     |     ₹16.00
                            -----------+---------------
                            1,154        ₹104.53/week
```

**Why before-the-build:** without baseline numbers, the deploy memo's "we cut LLM costs by 85%" claim is unverifiable. 30 minutes of work; gives Finance + SRE a defensible "before" + "after" comparison.

**Verification:**
- Script runs cleanly against the dev database
- Output recorded in `baseline.md` (markdown table) — can be re-run weekly to track drift
- Numbers cross-reference against the live `AgentAction` collection

**Notes:** This task is intentionally scoped LOW. It's a script + a single Markdown file with the numbers. Not a feature — a measurement. Schedule: **run C0 in week 1**, build C1-C9 in weeks 1-2, deploy in week 3, re-run C0 query against the deploy week, record after-numbers, calculate reduction.

---

### Task C1: Mongoose models
**Type:** Code → captain-tdd · **Depends:** — · **Tests:** 12+

**Acceptance Criteria:**

Create `backend/src/models/juvi/AgentSummaryCache.ts`:
```ts
interface IAgentSummaryCache {
  collegeId: ObjectId;                 // required, indexed
  type: 'forecast' | 'situations' | 'risk-score-narrative';
  key: string;                         // monthAnchor ISO | 'current' | studentId hex
  value: unknown;                      // string | object (Mixed); schema-less by design
  inputHash: string;                   // SHA-256 hex
  generatedAt: Date;
  expiresAt: Date;                     // TTL: { expires: 0 } so MongoDB auto-deletes
  provider: 'claude' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  generatedBy: 'cron' | 'live' | 'refresh';
}
```

Indexes:
- `{ collegeId: 1, type: 1, key: 1 }` (unique)
- `{ expiresAt: 1 }` with `expires: 0` (TTL)

Create `backend/src/models/juvi/AgentSummaryCacheCronRun.ts`:
```ts
interface IAgentSummaryCacheCronRun {
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
}
```

Indexes:
- `{ startedAt: -1 }` (audit lookups)

**Tests (12+):**
- Schema validation (each required field rejects on missing, accepts on present)
- Unique compound index enforced (insert duplicate → throws)
- TTL index present (verify via `.collection.indexes()`)
- Default values applied (e.g. `errors: []`, `failedColleges: 0`)
- Type field enum-validated
- ProviderModel field accepts 'claude' or 'openai' only
- generatedBy enum accepts cron/live/refresh

---

### Task C2: Cache store helpers
**Type:** Code → captain-tdd · **Depends:** — · **Tests:** 15+

**Acceptance Criteria:**

Create `backend/src/modules/juvi/finance-agent/summary-cache/cache-store.ts`:

```ts
export interface CachedHit<T> {
  value: T;
  generatedAt: Date;
  expiresAt: Date;
  inputHash: string;
  fromCache: true;
}

export async function getCached<T>(opts: {
  collegeId: string;
  type: 'forecast' | 'situations' | 'risk-score-narrative';
  key: string;
  inputHash?: string;            // if supplied, drift-check
}): Promise<CachedHit<T> | null>;

export async function setCache(opts: {
  collegeId: string;
  type: 'forecast' | 'situations' | 'risk-score-narrative';
  key: string;
  value: unknown;
  inputHash: string;
  ttlMs?: number;                // default 24h
  provider: 'claude' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  generatedBy: 'cron' | 'live' | 'refresh';
}): Promise<void>;

export async function invalidateCache(opts: {
  collegeId: string;
  type: 'forecast' | 'situations' | 'risk-score-narrative';
  key?: string;                  // if missing, invalidate ALL keys of this type for the college
}): Promise<{ invalidated: number }>;

export function computeInputHash(input: unknown): string;
```

Behavior:
- `getCached` returns null if: (a) no row, (b) `expiresAt <= now`, (c) `inputHash` supplied AND mismatched
- `setCache` upserts on the unique key — overwrites any existing row
- `invalidateCache` sets `expiresAt: new Date(0)` on matching rows
- `computeInputHash` JSON-stringifies the input deterministically (sort keys) then SHA-256 hex

**Tests (15+):**
- `getCached` returns null when no row exists
- `getCached` returns null when row expired
- `getCached` returns null on inputHash mismatch
- `getCached` returns hit when row valid + hash matches
- `getCached` returns hit when no inputHash supplied (skip drift check)
- `setCache` creates a new row
- `setCache` overwrites existing row (upsert via compound key)
- `setCache` defaults ttlMs to 24h
- `setCache` honors custom ttlMs
- `invalidateCache` with key → invalidates one row
- `invalidateCache` without key → invalidates all rows of that type for the college
- `invalidateCache` on non-existent row → 0 invalidated, no throw
- `computeInputHash` is deterministic (same input → same hash)
- `computeInputHash` is sensitive to value changes
- Cross-college: `getCached(collegeA)` ignores `collegeB` rows

---

### Task C3: Read-through wrapper + service integration
**Type:** Code → captain-tdd · **Depends:** C1, C2 · **Tests:** 18+

**Acceptance Criteria:**

Create `backend/src/modules/juvi/finance-agent/summary-cache/service.ts`:

```ts
export async function withCache<T>(opts: {
  collegeId: string;
  type: 'forecast' | 'situations' | 'risk-score-narrative';
  key: string;
  inputHash: string;
  fetchLive: () => Promise<{
    value: T;
    provider: 'claude' | 'openai';
    model: string;
    inputTokens: number;
    outputTokens: number;
    costInr: number;
  }>;
  ttlMs?: number;
  generatedBy?: 'cron' | 'live' | 'refresh';
}): Promise<{ value: T; fromCache: boolean; generatedAt: Date; expiresAt: Date }>;
```

Logic per §1.5 of plan: cache check → on hit return; on miss → call `fetchLive()` → write cache → return.

Modify `backend/src/modules/juvi/finance-agent/service.ts`:

- `handleForecastNarrative` wraps existing logic in `withCache` with key=`monthAnchor.toISOString()`, inputHash from collection time-series
- `handleSituations` wraps with key='current', inputHash from candidate set
- `handleRiskScores`: when `includeNarrative=true` AND a single student → wrap with key=studentId, inputHash from RiskFeatures. Batch calls bypass cache.

Response shape additions:
- `forecast` response gains `{ fromCache: boolean, generatedAt: Date }`
- `situations` response gains `{ fromCache: boolean, generatedAt: Date }`
- `risk-score` response per item gains `{ fromCache?: boolean, generatedAt?: Date }` (optional since batch path doesn't use cache)

**Tests (18+):**
- `withCache` cache hit returns cached value + fromCache=true
- `withCache` cache miss calls fetchLive + writes cache + fromCache=false
- `withCache` LLM fail in fetchLive propagates error (no cache write)
- `withCache` honors custom ttlMs
- `withCache` defaults ttlMs to 24h
- `withCache` writes generatedBy='live' by default
- `handleForecastNarrative` cache hit on second call (same monthAnchor)
- `handleForecastNarrative` cache miss when inputs change
- `handleForecastNarrative` returns generatedAt + fromCache flag
- `handleSituations` cache hit
- `handleSituations` cache miss after dismissal-list changes (input drift)
- `handleRiskScores` per-student cache hit on second hover
- `handleRiskScores` batch path bypasses cache
- `handleRiskScores` per-student cache miss writes new row
- Cross-college: handleForecastNarrative for college A doesn't return college B's cache
- Cache miss + LLM fails: existing fallback (narrative=null) preserved
- Provider switch invalidates cache via key (provider+model in key — already part of stored row, but key itself doesn't include them; rely on row.provider mismatch → cache miss in test setup)
- AgentAction logged on cache miss (live call) but NOT on cache hit

---

### Task C4: Daily cron worker
**Type:** Code → captain-tdd · **Depends:** C3 · **Tests:** 12+

**Acceptance Criteria:**

Create `backend/src/workers/agent-summary-cache.worker.ts`:

```ts
export const AGENT_SUMMARY_CACHE_CONCURRENCY = 1;          // BullMQ worker concurrency
export const AGENT_SUMMARY_CACHE_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 300_000 },
  cronPattern: process.env.AGENT_CACHE_CRON_PATTERN ?? '0 3 * * *',
};

export async function agentSummaryCacheCronWorker(job: Job<{ collegeId?: string }>): Promise<void>;
export function registerAgentSummaryCacheCronWorker(): Queue;
```

Behavior per §1.6 of plan:
- One audit row per cron run (`AgentSummaryCacheCronRun.create({ startedAt: now })`)
- If `job.data.collegeId` provided → run for that college only; else iterate active colleges
- Bounded concurrency 5 at college level
- Per college: forecast + situations + top-N (default 50) risk-score narratives
- Per college: bounded concurrency 5 at student level for risk-score calls
- Per-college error caught + recorded; other colleges continue
- Top-N read from existing risk-scorer + sorted query; configurable via `AGENT_CACHE_TOP_RISK_N` env

QueueManager update: add `AGENT_SUMMARY_CACHE: 'finance:agent-summary-cache'` to the existing `QUEUE_NAMES` const.

**Tests (12+):**
- Cron with no collegeId iterates all active colleges
- Cron with explicit collegeId runs for that college only
- Cron skips inactive colleges
- Per-college: forecast cache row written (count incremented)
- Per-college: situations cache row written
- Per-college: top-N risk-score rows written (default N=50)
- Top-N respects `AGENT_CACHE_TOP_RISK_N` env override
- Per-college error logged + audit.failedColleges incremented; other colleges proceed
- All-failure case: audit.topLevelError set if entire run fails
- Audit row totals (input/output/cost) sum across all per-college calls
- Bounded concurrency: simulate 20 colleges; verify max 5 in-flight at any time
- Cron job options exported correctly (attempts: 3, cronPattern: '0 3 * * *')

---

### Task C5: HTTP API — manual refresh endpoint
**Type:** Code → captain-tdd · **Depends:** C3 · **Tests:** 8+ (e2e)

**Acceptance Criteria:**

New endpoint:
```
POST /api/juvi/finance-agent/cache/refresh
Permission: ('finance', 'read')
Rate-limit:  10/min/user
Body (Zod): { type: 'forecast' | 'situations' | 'risk-score-narrative', key?: string }
```

Controller logic:
1. Resolve `collegeId` from `req.collegeId`
2. Determine final `key`:
   - For 'forecast': default to current month's monthAnchor ISO
   - For 'situations': default to 'current'
   - For 'risk-score-narrative': require `body.key` (studentId)
3. `invalidateCache(...)` 
4. Call the matching service method (which goes through `withCache` and re-fetches live)
5. Return `{ value, fromCache: false, generatedAt }`

**Tests (8+ e2e):**
- 200 happy: refresh forecast → returns fresh narrative + fromCache=false
- 200 happy: refresh situations → returns fresh array
- 200 happy: refresh single risk-score-narrative
- 400: missing `body.key` for risk-score-narrative
- 400: invalid `type`
- 401: no auth
- 429: rate-limit (11th call within 60s)
- Cross-college: super_admin x-college-id override works; non-super_admin can't override

---

### Task C6: Event-driven invalidation hooks
**Type:** Code → captain-tdd · **Depends:** C2 · **Tests:** 10+

**Acceptance Criteria:**

Wire `invalidateCache(...)` calls into:

1. `fee-holds-service.activateHold(...)` — on success, invalidate `(collegeId, 'situations', 'current')`
2. `fee-holds-service.waiveHold(...)` — same as above
3. `fee-alerts-cron.worker` per-college completion — invalidate `(collegeId, 'situations', 'current')`
4. `service.handleDismissSituation(...)` — invalidate `(collegeId, 'situations', 'current')`
5. `service.pauseEscalation(...)` (the existing fee-holds endpoint) — invalidate `(collegeId, 'risk-score-narrative', studentId)`
6. (No invalidation for forecast — its inputs are payment time-series, which shift only via the daily cron)

Each invalidation runs after the primary mutation; if it fails (rare), log a warning but do NOT fail the parent operation.

**Tests (10+):**
- activateHold success → situations cache invalidated
- activateHold failure → no invalidation
- waiveHold success → situations cache invalidated
- fee-alerts-cron success per college → situations cache invalidated
- handleDismissSituation success → situations cache invalidated
- pauseEscalation success → risk-score-narrative cache invalidated for that student only (other students unchanged)
- Invalidation failure (mock invalidateCache to throw) → primary mutation still succeeds + warning logged
- Cross-college: invalidating college A doesn't touch college B
- Idempotency: invalidating an already-expired row doesn't throw
- forecast cache NOT invalidated by hold activate (negative test)

---

### Task C7: Frontend timestamp + refresh button
**Type:** Code → captain-tdd · **Depends:** C5 · **Tests:** 6+

**Acceptance Criteria:**

Modify:
- `AIForecastBanner.tsx` — add `Last updated Xh ago` line under the narrative + `[↻]` button
- `SituationCards.tsx` — add same to the section header

Behavior:
- Render `Last updated Xh ago` (relative time, e.g. "5m ago", "3h ago", "yesterday") computed from `generatedAt` in the response
- `[↻]` button → POST `/finance-agent/cache/refresh` with appropriate type
- During refresh: show pulsing border + small spinner; old value remains visible
- On success: replace old value with fresh; reset timestamp to "now"
- On error: show inline error toast; keep old value

Add to existing `services/finance-agent.ts`:
```ts
export async function refreshCache(type: 'forecast' | 'situations' | 'risk-score-narrative', key?: string): Promise<...>;
```

**Tests (6+ frontend):**
- AIForecastBanner shows "Last updated Xh ago" when `generatedAt` provided
- SituationCards shows same
- Click `[↻]` triggers `refreshCache(...)` with correct args
- During refresh: pulsing-border class applied
- On success: timestamp updates to "0m ago"
- On error: inline error rendered, old value still shown

---

### Task C8: E2E integration tests
**Type:** Code → captain-tdd · **Depends:** C3, C4, C5, C6 · **Tests:** 10+ (e2e)

**Acceptance Criteria:**

New file `backend/src/__e2e__/modules/agent-summary-cache.e2e.test.ts`:

1. **End-to-end cache flow:** call `/forecast-narrative` twice → second call has `fromCache: true`
2. **TTL expiry:** mock time forward 25h → next call is a miss (cache expired)
3. **Hold activate invalidates situations:** load situations → activate a hold → next situations call is a miss
4. **Manual refresh:** load forecast (cache hit) → POST `/cache/refresh` → next call returns NEW narrative
5. **Cron run end-to-end:** invoke cron worker directly → audit row written + cache rows present for the college
6. **Top-N risk score:** seed 60 defaulters → cron runs → only top 50 cached
7. **Cross-college isolation:** college A's cache miss doesn't return college B's row
8. **Provider switch:** swap LLM_PROVIDER mid-test → cache key includes provider/model → next call is a miss
9. **InputHash drift:** cache row exists but input changes → cache miss (drift detection)
10. **LLM failure on cache miss:** mocked LLM throws → response falls back to `narrative: null` AND no cache row written

---

### Task C9: API reference + QA/deploy checklist
**Type:** Doc → captain-spec direct · **Depends:** C5, C8

**Expected state:**

Create `backend/docs/api/finance-agent-summary-cache.md`:
- Concepts (read-through cache, daily cron, TTL, event invalidation, manual refresh)
- Architecture diagram (matches plan §1.1)
- Data model (2 new collections + indexes)
- Cron lifecycle
- 1 new endpoint documented
- Cache key naming conventions
- Performance + cost expectations
- Known limitations (chat not cached, reminder-drafts not cached, etc.)

Create `backend/docs/api/finance-agent-summary-cache-qa-checklist.md`:
- §0 Prerequisites (all C1-C8 tasks Done)
- §1 Env vars set (`AGENT_CACHE_TTL_HOURS`, etc.)
- §2 Schema verification (collections + indexes present)
- §3 Cron registration (BullMQ repeat job at 03:00)
- §4 Cache hit verification (tail logs after dashboard load → see `[summary-cache] hit`)
- §5 Manual refresh test (click button → see fresh narrative)
- §6 Event invalidation test (activate hold → next situations call is a miss)
- §7 Cost-savings spot-check (compare AgentAction live calls before/after)
- §8 Rollback plan (drop the new cron job; cache rows expire naturally; no breaking change)
- §9 Sign-off (Finance Lead + SRE + Product)

---

## Spec-to-task traceability

| Spec section | Covered by |
|---|---|
| §Journey 1 First officer (cache hit) | C3, C4, C7 |
| §Journey 2 Second officer (cache hit) | C3 |
| §Journey 3 Manual refresh | C5, C7 |
| §Journey 4 Hold activate invalidation | C6 |
| §Journey 5 Cold start (cache miss fallback) | C3 |
| §Journey 6 Top-50 risk score | C4 |
| §Journey 7 Cron failure tolerance | C4 |
| §Journey 8 Provider switch | C2 (inputHash), C3 (provider+model in stored row) |
| §AC Cache schema | C1 |
| §AC Cache types (v1) | C2, C3 |
| §AC Read-through wrappers | C3 |
| §AC Cron job | C4 |
| §AC Event-driven invalidation | C6 |
| §AC Manual refresh endpoint | C5 |
| §AC Frontend display | C7 |
| §AC Multi-tenancy | C2, C3, C5 |
| §AC Cache key fingerprinting | C2 |
| §AC Observability | C2, C4 |

---

## Changelog

- **2026-04-28** — Initial task list. 9 tasks, 2 parallel foundation starters (C1 + C2). Front-loaded risk: C3 read-through wrapper is the integration point everything else hangs off; get the contract right first.

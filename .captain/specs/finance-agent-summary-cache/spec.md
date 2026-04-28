# Spec: Finance Agent Summary Cache

**Created:** 2026-04-28 · **Status:** specifying · **Parent:** fee-analytics-ai-native

## What & Why

Today, every dashboard load on `/finance/dashboard` re-fires identical LLM calls:

- `POST /forecast-narrative` — same college, same month → identical narrative
- `POST /situations` — same college, same heuristic candidates → identical 3–5 cards
- `POST /risk-scores?includeNarrative=true` — same student, hovered repeatedly throughout the day → identical narrative

With 10 Finance Officers viewing a college dashboard 5×/day = 50 redundant calls per endpoint per college. **The same inputs produce the same output**, so 49 of those 50 calls are pure waste.

This feature adds **server-side caching** for those three call sites:

1. A nightly cron at 03:00 (chained after `fee-alerts-cron` at 02:00) pre-computes and stores narratives in a new `AgentSummaryCache` collection.
2. Service methods become **read-through**: cache hit → return cached value + freshness timestamp; cache miss → fall through to live LLM call → write to cache → return.
3. Event-driven invalidation flips a cache entry stale on critical mutations (hold activate/waive, manual refresh, mid-day cron re-run).
4. The frontend shows a discreet `Last updated Xh ago` timestamp + a manual `[Refresh]` button on each cached card.

**Out of scope for v1** (deferred):
- `/reminder-drafts` content-hash caching (lower volume; trickier correctness)
- `/query` (chat) — every prompt is novel; needs Anthropic prompt caching, not response caching
- Cross-college shared cache (PII boundary)
- Predictive cache warming (e.g. preemptively compute narratives the user is "likely" to need)

## Scope boundaries (locked)

- **In:** new Mongoose model, new BullMQ cron worker, read-through wrappers in 3 service methods, frontend timestamp + refresh, event-driven invalidation
- **Out:** chat caching, reminder-drafts caching, cross-college sharing, prompt caching (Anthropic feature), pre-warming cache for new colleges
- **Out (sibling spec):** per-college LLM spend limits + admin UI for setting them. See `.captain/specs/llm-spend-limits/` for that work; ships independently.

## User Journeys

### Journey 1 — Officer opens the dashboard at 09:00

1. Frontend mounts; calls `GET /finance/analytics/dashboard` (existing — unchanged) + `POST /finance-agent/forecast-narrative` + `POST /finance-agent/situations`
2. Both LLM endpoints check `AgentSummaryCache` first
3. Cache hits (cron ran at 03:00) → return cached value + `generatedAt: 2026-04-28T03:00:00Z` + `expiresAt`
4. Frontend renders narrative + "Last updated 6h ago" footer text
5. **Total LLM calls fired: 0**

### Journey 2 — Officer at 09:01 (second person, same college)

1. Same flow as Journey 1
2. Cache hits again
3. **Total LLM calls fired: 0** (was 2 before this feature)

### Journey 3 — Officer clicks `[Refresh]` on the situations card at 14:00

1. Frontend POSTs to a new `POST /finance-agent/situations/refresh` endpoint
2. Backend invalidates the cache row → makes a live LLM call → writes new cache → returns the fresh narrative
3. The "Last updated" timestamp resets to `0m ago`

### Journey 4 — Principal activates a Financial Hold

1. `POST /finance/holds/:id/activate` succeeds (existing flow)
2. Backend invalidation hook fires: `invalidateCache({ collegeId, type: 'situations' })`
3. Next dashboard open re-fetches → cache miss → live LLM call → fresh narrative reflects the activation
4. Forecast cache is NOT invalidated (different inputs)

### Journey 5 — Cold start (first officer of the day, before cron)

1. Dashboard mounts before 03:00 cron runs (or for a brand-new college with no history)
2. Cache miss → fall through to live LLM call (current behavior)
3. Response written to cache → next viewer hits the cache

### Journey 6 — Top-50 risk score narratives

1. Cron also pre-computes the top 50 students by risk score per college
2. Officer hovers a defaulter card → frontend fires `POST /risk-scores?includeNarrative=true`
3. If the student is in the top 50 → cache hit → instant narrative
4. Outside top 50 → cache miss → live call (lazy on-demand, same as today)

### Journey 7 — Cron failure tolerance

1. Cron run errors mid-college (e.g. Anthropic rate-limit hit)
2. Per-college error captured in audit; other colleges continue
3. The college without fresh cache falls through to live calls during the day
4. Next cron run heals it

### Journey 8 — Provider switch (Claude → OpenAI)

1. SRE sets `AI_PROVIDER=openai` and restarts backend
2. Existing cache still has Claude-generated narratives
3. Cache key includes `provider + model` → automatic miss on first read after switch → fresh OpenAI narrative written
4. Old Claude-cached rows expire naturally via TTL or manual purge

## Acceptance Criteria

### AC — Cache schema
- New `AgentSummaryCache` collection with required fields: `collegeId`, `type`, `key`, `value`, `inputHash`, `generatedAt`, `expiresAt`, `provider`, `model`, `inputTokens`, `outputTokens`, `costInr`
- Compound index `{ collegeId: 1, type: 1, key: 1 }` (unique) — enforces one cache row per (college, type, key) tuple
- TTL index on `expiresAt` (Mongoose's `expires` shortcut → MongoDB auto-deletes)
- Default `expiresAt` = `generatedAt + 24h`

### AC — Cache types (v1)
- `'forecast'` — key = `monthAnchor` ISO date (e.g., `'2026-04-01'`)
- `'situations'` — key = `'current'` (always one per college)
- `'risk-score-narrative'` — key = `studentId` (for the top-50 pre-computed; on-demand callers also write here)

### AC — Read-through wrappers
- `handleForecastNarrative` checks cache first; on hit, returns `{ projection, narrative, generatedAt, fromCache: true }`
- `handleSituations` checks cache first; on hit, returns the cached `Situation[]` array + `generatedAt`
- `handleRiskScores` with `includeNarrative=true` checks cache PER student; cache misses fall through to live calls + write
- Cache misses ALWAYS fall through to the existing live LLM call path (no breaking change to fallbacks)

### AC — Cron job
- New BullMQ queue `finance:agent-summary-cache` with cron pattern `0 3 * * *` (03:00 daily)
- Iterates `College.find({ status: 'active' })`
- Per-college: bounded concurrency 5 (5 colleges in flight at once, via existing `withBoundedConcurrency` helper)
- Per-college: generates `forecast` + `situations` + `risk-score-narrative` (top 50 students by score) — one LLM call each
- Failure tolerance: per-college error logged + audit recorded + next college continues
- Audit collection `AgentSummaryCacheCronRun` mirrors `FeeAlertsCronRun` pattern: counts of `cached, refreshed, errors, skipped`

### AC — Event-driven invalidation
- On `POST /finance/holds/:id/activate` success → invalidate `(collegeId, type='situations')`
- On `POST /finance/holds/:id/waive` success → invalidate `(collegeId, type='situations')`
- On `feeAlertsCronWorker` per-college completion → invalidate `(collegeId, type='situations')` (the situation candidates may have changed)
- Forecast cache is NOT invalidated by these events (its inputs are payment time-series, not hold counts)
- Risk-score cache for a single student is invalidated on `pauseEscalation` of that student
- Invalidation = `expiresAt = new Date(0)` (mark expired); next read becomes a miss

### AC — Manual refresh endpoint
- `POST /api/juvi/finance-agent/cache/refresh` with body `{ type: 'forecast' | 'situations' | 'risk-score-narrative', key?: string }`
- Permission: `('finance', 'read')` (any officer can request a fresh narrative)
- Behavior: invalidate the matching cache row → kick off a live LLM call → write fresh row → return the new value
- Rate-limit: 10 req/min/user (prevents accidental cache-bust storms)

### AC — Frontend display
- `<AIForecastBanner>` adds a small `Last updated Xh ago` line + a `[↻]` icon button
- Same on the `<SituationCards>` section header
- Click `[↻]` → calls the manual-refresh endpoint → updates the displayed timestamp + content
- Stale-while-revalidate: while the refresh is in flight, the OLD cached value is shown with a faint pulsing border

### AC — Multi-tenancy (non-negotiable)
- Every read query starts with `collegeId` (compound index supports this)
- Every write includes `collegeId`
- Cross-college reads return null (cache miss, no leak)
- Manual cache invalidation is bound to the caller's `collegeId` (super_admin's `x-college-id` override respected)

### AC — Cache key fingerprinting
- `inputHash` field is a SHA-256 of the upstream-data fingerprint
- For `forecast`: hash of the day's collection time-series sums
- For `situations`: hash of the candidate set produced by `gatherCandidates(collegeId)`
- For `risk-score-narrative`: hash of the student's `RiskFeatures`
- On read: compute fresh `inputHash` → if mismatch → invalidate + miss; if match → cache hit
- Defends against drift when the upstream data changes mid-day without an explicit invalidation event

### AC — Observability
- `AgentSummaryCacheCronRun` per-college audit row
- Hit/miss counts logged per request: `[summary-cache] hit type=situations college=<id>` or `[summary-cache] miss reason=expired`
- Daily cost roll-up (cached calls cost ₹0; live calls log normally to `AgentAction`)

## Edge Cases

| Case | Behavior |
|---|---|
| Cache miss + LLM fails | Fall back to deterministic output (forecast: projection only, no narrative; situations: empty array); do NOT write to cache |
| Cache row exists but expired (TTL passed mid-request) | MongoDB TTL deleter is best-effort; read query also checks `expiresAt > now` |
| Top-N risk score cron runs but a student exits / graduates same day | The cached row is harmless; never displayed (defaulter list filter excludes exited) |
| Two cron runs overlap (manual + scheduled) | Unique compound index forces upsert; later write wins |
| College has no historical data | Cron generates "insufficient data" deterministic output; no LLM call; NOT cached |
| Provider switch mid-day | New requests miss cache (provider+model in key); fresh fetch; old rows TTL out |
| Mid-day data spike not caught by event invalidation | TTL caps drift to 24h; manual refresh button is the escape hatch |
| `inputHash` collision (different inputs hash to same value) | Theoretical; SHA-256 collision probability is negligible. No mitigation. |
| Unbounded cache growth | TTL index auto-deletes after 24h; max ~3 rows per college (forecast + situations + ≤50 student narratives) |

## NOT For

- **Chat caching** — every prompt is novel; needs Anthropic prompt caching (a separate optimization)
- **Reminder-drafts caching** — content-hash cache is feasible but lower-volume + trickier correctness; deferred
- **Cross-college sharing** — PII boundary; each college has its own narratives even if the underlying patterns are similar
- **Predictive cache warming** — pre-computing narratives the user is "likely" to need; over-engineering for v1
- **Cache for unauthenticated users** — every endpoint stays auth-gated; no public/anonymous cache
- **CDN-level caching** — cache lives in MongoDB beside other agent state; CloudFront/Vercel KV is unnecessary at this scale

## Dependencies

### Environment variables (new)
```
AGENT_CACHE_TTL_HOURS=12                    # default 12h; configurable per deployment
AGENT_CACHE_TOP_RISK_N=20                   # how many top-risk students get pre-computed narratives
AGENT_CACHE_CRON_PATTERN=0 3 * * *          # 03:00 daily
AGENT_CACHE_CRON_CONCURRENCY=5              # colleges in flight at once
```

**TTL of 12h chosen** so an officer at 09:00 sees data refreshed at 03:00 (6h old) and an officer at 17:00 sees data still within the window (14h would be unacceptable; we'd refresh by midday). Rolling 12h captures ~85% of the cost savings while keeping max staleness during business hours under 7 hours.

**Top-N of 20 chosen** so the cron at 100 colleges generates ~2,000 risk-narrative LLM calls/day (~₹100/day) instead of 5,000 at N=50. Captures the highest-frequency hover targets without over-computing on rarely-viewed students.

### npm packages (new)
- None. Reuses existing `@anthropic-ai/sdk`, `openai`, `bullmq`, `crypto` (Node built-in).

### New Mongoose models
- `AgentSummaryCache` — per-college cache rows
- `AgentSummaryCacheCronRun` — per-cron-run audit (mirrors `FeeAlertsCronRun`)

### Existing models touched
- None.

### Existing services touched
- `finance-agent/service.ts` — wrap `handleForecastNarrative`, `handleSituations`, `handleRiskScores` with cache read-through
- `fee-holds-service.ts` — invalidation hook on `activateHold` + `waiveHold`
- `fee-alerts-cron.worker.ts` — invalidation hook on per-college completion

## Success Metrics

- **LLM cost cut on the cached endpoints:** ≥ 80% reduction (target). Measured by: `(live-call-count-this-week / live-call-count-baseline-week) ≤ 0.20`
- **Cache hit rate per type:** ≥ 90% for `forecast` and `situations`; ≥ 60% for `risk-score-narrative` (lower because top-50 cap)
- **Dashboard p50 latency on cached endpoints:** < 100ms (vs ~2–8s for live calls)
- **Stale narrative complaints:** < 1 / officer / week (measured via support tickets + manual refresh frequency)
- **Cron success rate:** ≥ 99% per college per day; failures alert SRE
- **Zero PII leaks** via cache (audited via random row inspection)

## Open Questions

- **OQ-1:** Should the manual `[Refresh]` button be role-gated (admin/principal only) or available to all officers? Default: all officers (read-permission). Cost cap via the 10/min rate-limit.
- **OQ-2:** What's the daily LLM cost we're optimizing? Need a baseline measurement before deploying so the success metric is verifiable.
- **OQ-3:** Cache size growth — at 100 colleges × 50 student narratives = 5,000 rows × ~1 KB = 5 MB. Trivial. No retention policy needed beyond TTL.
- **OQ-4:** Does the manual refresh need its own audit (separate from the LLM call's `AgentAction`)? Default: no — `AgentAction` already logs every live LLM call; the `cached: false` field on the response distinguishes manual refreshes from cron runs.
- **OQ-5:** What about mid-day cache drift detection — should we ping the inputHash on every read and silently re-cache if mismatched? Default: yes — already in the AC; cheap (one Mongo query + hash).

## Changelog

- **2026-04-28** — Initial spec.
- **2026-04-28 (tightening pass)** — User-locked decisions after review:
  - **TTL = 12h** (was 24h) — env-configurable via `AGENT_CACHE_TTL_HOURS`. Rationale in §Dependencies above.
  - **Top-N risk = 20** (was 50) — env-configurable via `AGENT_CACHE_TOP_RISK_N`. Cuts cron cost from ~₹250/day to ~₹100/day at 100 colleges while still covering highest-frequency hovers.
  - **Cost cap deferred** to a sibling spec (`llm-spend-limits`) — not just an env var; needs College-model field, admin UI, and pre-call gate. Ships independently.
  - **Baseline measurement added as Task C0** — 1-week pre-deploy aggregation of `AgentAction` rows so the success metric (≥80% LLM cost reduction) is verifiable.
  - **Forecast event invalidation: none** for v1 (TTL only). Re-evaluate after 2 weeks of usage.
  - **Manual refresh permission: `('finance', 'read')`** — open to all officers; rate-limit (10/min/user) is the safety bound.

# Spec: Per-College LLM Spend Limits

**Created:** 2026-04-28 · **Status:** specifying · **Sibling:** finance-agent-summary-cache

## What & Why

The Juvion Finance Agent makes LLM calls at runtime — chat, forecast narratives, situation cards, risk-score explanations, reminder drafts. Cost scales linearly with usage. Without a budget guardrail, a single misconfigured agent (or an officer running the dashboard in a tight loop) can run up significant unplanned cost — especially across 100+ colleges.

This feature gives **each college an admin-configurable weekly LLM spend limit** with two-stage enforcement:

1. **Soft alert** at 80% of the limit (configurable threshold) — log warning + visible banner in the admin UI; LLM calls still proceed
2. **Hard block** at 100% — agent endpoints return `429 Weekly LLM budget exceeded; contact admin`; the admin can bump the limit or wait for the rolling 7-day window to clear

Per-college configuration (not just a global env var) so different deployments — small school vs. large university — get different budgets. Configurable via a new admin UI on the College Management screen.

## Scope boundaries (locked)

- **In:** new `College.aiSpendLimits` field, pre-call gate on every agent endpoint, admin UI for setting limits, weekly summary cron, in-app warning banner when approaching limit
- **Out:** real-time per-officer budgets (only per-college), email alerting (out of v1; in-app banner is enough), admin override audit log entry beyond the existing AgentAction log, refund / credit accounting, multi-currency

## User Journeys

### Journey 1 — Admin sets a college's weekly limit

1. Admin opens College Management screen for College X
2. New "AI Spend Limits" section shows: weekly budget input (₹, default 0 = no limit), alert threshold % (default 80)
3. Admin sets `weeklyInr=500, alertThresholdPct=80` and clicks Save
4. PATCH `/api/colleges/:id/ai-spend-limits` persists the values
5. Effective immediately — next agent call checks against the new limit

### Journey 2 — Officer hits 80% of the weekly budget

1. Officer triggers the Finance Dashboard at 14:00; cumulative weekly LLM cost crosses ₹400 (80% of ₹500)
2. Dashboard renders normally + a small **amber banner** at the top: *"AI usage at 82% of weekly budget. ₹90 remaining."*
3. The agent calls succeed (soft alert only); banner persists for the rest of the week
4. Backend logs `[llm-budget:warn] college=<id> spent=400 limit=500 pct=82`

### Journey 3 — Officer hits 100% of the budget

1. Officer at 16:30; weekly cumulative reaches ₹500
2. Next agent call (chat / forecast / situations / etc.) → backend gate triggers → returns `429`:
   ```json
   { "error": "Weekly LLM budget exceeded", "limit": 500, "spent": 502.30, "resetsAt": "2026-05-05T00:00:00Z" }
   ```
3. Frontend renders all AI surfaces in a degraded state — banner reads: *"AI usage exceeded weekly budget. Contact admin to increase limit; resets Mon."*
4. Deterministic features (forecast band without narrative, defaulter list without risk-narrative tooltip, etc.) keep working; cache hits keep working (zero-cost reads)

### Journey 4 — Admin bumps the limit mid-week

1. Admin sees the 100% banner
2. Admin returns to College Management → bumps `weeklyInr=750`
3. Save → next agent call checks again → spent (₹502) < limit (₹750) → call proceeds normally
4. AuditLog entry written with `entityType: 'College'`, `action: 'update'`, `changes: [{ field: 'aiSpendLimits.weeklyInr', oldValue: 500, newValue: 750 }]`

### Journey 5 — Weekly window rolls over (Monday 00:00)

1. Cron job at Monday 00:00 doesn't actively reset anything (the gate is a rolling 7-day query)
2. As the calendar advances, AgentAction rows from the previous week age out of the rolling window automatically
3. Effective spent value drops below the limit; agent endpoints unblock without manual intervention

### Journey 6 — Brand-new college without a configured limit

1. New college has `aiSpendLimits.weeklyInr === 0` (default) → "no limit"
2. Pre-call gate sees `weeklyInr === 0` → bypasses both alert and block
3. Same behavior as today (pre-spec)

### Journey 7 — Weekly summary digest

1. New cron job at Monday 06:00 (after the rollover settles)
2. Per active college: compute previous-week spent + record an `LLMUsageSnapshot` row
3. The current College Management screen shows the last 4 weeks of usage as a sparkline (out of v1; data captured for the future UI)
4. SRE dashboard: log line `[llm-budget:weekly] college=<id> name=<X> spent=<n> limit=<m> pct=<p>` per college

## Acceptance Criteria

### AC — College schema additions
- New nested field on `College`:
  ```ts
  aiSpendLimits: {
    weeklyInr: number;            // default 0 = no limit
    alertThresholdPct: number;    // default 80
  }
  ```
- Both fields optional in API bodies; missing → use defaults
- Existing colleges get the default `{ weeklyInr: 0, alertThresholdPct: 80 }` on first read after deploy (no migration needed; Mongoose populates defaults)
- Validation: `weeklyInr >= 0`; `alertThresholdPct` ∈ `[1, 100]`

### AC — Spend computation
- "Current weekly spend" = `sum(AgentAction.costInr WHERE collegeId = X AND createdAt > now - 7d)`
- Computed on every live LLM call (cache hits don't count — they cost ₹0)
- Bounded by the existing `AgentAction` indexes — single round-trip aggregate
- Cached in-process for 60 seconds per college to avoid hitting MongoDB on every call (acceptable trade: max 60s of budget lag)

### AC — Pre-call gate
- New helper `assertWithinSpendLimit(collegeId): Promise<{ spent, limit, pct }>` invoked at the entry of every live LLM call (in `withCache`'s fallback path or wherever the live LLM client is invoked)
- Behavior:
  - `weeklyInr === 0` → bypass, return current state for logging only
  - `spent >= weeklyInr` → throw `AppError(429, 'Weekly LLM budget exceeded')` with body details
  - `spent >= weeklyInr * alertThresholdPct/100` → log warning, allow call, set a flag on the response shape (`budgetWarning: true`)
- Cache hits do NOT pass through the gate (they're free)

### AC — Admin endpoint
- `PATCH /api/colleges/:id/ai-spend-limits` with body `{ weeklyInr?: number, alertThresholdPct?: number }`
- Permission: `('platform', 'update')` — admin/super_admin only
- Zod-validated; emits `AuditLog` entry on every change
- Rate-limit: 60/min/user (admin actions are bursty but not unlimited)

### AC — Admin UI
- Extend the existing **College Management** screen at `/colleges` (or `/colleges/:id`) with a new "AI Spend Limits" section
- Two inputs: weekly budget (₹), alert threshold (%); both with helper text + defaults visible
- Submit button calls the PATCH endpoint
- Below the inputs: current week's spent + bar visualization (e.g., 82% bar in amber if ≥ threshold)
- Last 4 weeks: simple table or sparkline (defer to v2 if storage isn't ready)
- Role gate: only admin / super_admin sees the section

### AC — Frontend banner (FeeDashboardPage)
- When the response from any agent endpoint includes `budgetWarning: true`, render a top-of-dashboard amber banner: *"AI usage at X% of weekly budget. ₹Y remaining."*
- When response is `429 Weekly LLM budget exceeded`, render a red banner: *"AI usage exceeded weekly budget. Contact admin to increase the limit; resets Mon."* — degrade all AI surfaces (chat input disabled, forecast narrative hidden, situations hidden, risk-narrative tooltips show only deterministic factors)
- Both banners include a calendar countdown: "Resets in 2d 4h"

### AC — Weekly summary cron
- New BullMQ cron at `0 6 * * 1` (Monday 06:00)
- Per-active-college: compute previous full week's spent (Mon-Sun) → write `LLMUsageSnapshot` row
- Log line per college: `[llm-budget:weekly] college=<id> spent=<n> limit=<m> pct=<p>`
- Per-college error tolerance (mirror existing cron patterns)

### AC — `LLMUsageSnapshot` collection (new)
```ts
interface ILLMUsageSnapshot {
  collegeId: ObjectId;
  weekStart: Date;        // Monday 00:00 UTC of the snapshot week
  weekEnd: Date;
  totalCostInr: number;
  totalCalls: number;
  byType: { forecast: number; situations: number; chat: number; ... };  // call counts
  limitAtTime: number;    // captured for reproducibility
  createdAt: Date;
}
```
- Indexes: `{ collegeId: 1, weekStart: -1 }` (per-college history scroll)

### AC — Multi-tenancy
- Every spend computation queries by `collegeId`
- The PATCH endpoint enforces caller's role + the college being patched matches their `req.collegeId` (super_admin can override via `x-college-id` header — existing pattern)

### AC — Observability
- Per-call: `[llm-budget] college=<id> spent=<n> limit=<m> pct=<p>` on every live LLM call
- Daily summary: `[llm-budget:daily] college=<id> spent=<n> limit=<m> pct=<p>`
- 429 events: `[llm-budget:blocked] college=<id> spent=<n> limit=<m>` for SRE alerts
- Threshold breach: `[llm-budget:warn] college=<id> spent=<n> limit=<m> pct=<p>` (transitions ≥ alertThresholdPct)

## Edge Cases

| Case | Behavior |
|---|---|
| `weeklyInr === 0` (default for existing colleges) | No limit; pre-call gate is a no-op |
| `alertThresholdPct === 0` | Treat as "always alert"; warning banner ALWAYS visible |
| `alertThresholdPct === 100` | Same as no warning (warning fires only at ≥100% which equals block) |
| Spend computation fails (DB error) | Default-allow the call; log critical error; don't accidentally block users due to DB blips |
| Admin sets `weeklyInr` to an extremely small number (e.g. ₹1) | Block triggers near-immediately; no extra protection (admin's call) |
| Concurrent calls race past the limit | Acceptable: spend may exceed limit by ~1-2 calls during the race window. The 60s in-process cache makes this rare. |
| Cache hit on a budget-exceeded college | Hit returns; budget gate is bypassed (cache hits cost ₹0) |
| Streaming chat runs MID-call past the limit | Allow it to finish; the gate fires only at call entry |
| Super_admin querying another college's spend | Honors `x-college-id` header (existing pattern) |
| Old AgentAction rows missing `costInr` (early data) | Treated as 0 cost; doesn't blow up the aggregation |
| Provider switch mid-week | Spend includes ALL providers (Claude + OpenAI); no double-counting |

## NOT For

- **Per-officer budgets** — per-college is enough for v1; per-officer adds significant complexity
- **Email alerts** — in-app banner is the v1 channel; email is a nice-to-have
- **Refund / credit accounting** — out of scope; this is a guardrail, not billing
- **Multi-currency** — INR only for v1
- **Dynamic limits** (e.g., scale with active students) — manual admin config only
- **Self-service limit increase by Finance Officer** — requires admin/super_admin role

## Dependencies

### npm packages
None new. Reuses existing aggregations against `AgentAction`.

### New Mongoose models
- `LLMUsageSnapshot` — weekly per-college usage rows

### Existing models touched
- `College` — new nested `aiSpendLimits` field

### Environment variables (new)
```
LLM_BUDGET_DEFAULT_WEEKLY_INR=0           # 0 means no limit; admin must opt-in per college
LLM_BUDGET_DEFAULT_ALERT_PCT=80
LLM_BUDGET_CACHE_TTL_SECONDS=60           # in-process spend cache TTL
LLM_BUDGET_WEEKLY_SUMMARY_CRON=0 6 * * 1  # Monday 06:00
```

## Success Metrics

- **Zero unexpected cost runaways:** no college's weekly spend exceeds 110% of its configured limit (gate's 1-2-call-race tolerance is the only headroom)
- **Banner confirmed visible** by Finance Officer survey: 80%+ of officers notice the warning when crossed
- **Admin self-service:** at least 2 limit-bumps per month per active college (signals admins are actually using the feature)
- **No false positives:** zero 429s blocked legitimate usage that the admin didn't anticipate (failure mode = admin had to scramble to bump the limit)

## Open Questions

- **OQ-1:** Should `weeklyInr === 0` mean "no limit" or "block all"? Current spec: "no limit" (sensible default). User agrees.
- **OQ-2:** What's the rollover boundary — UTC midnight on Monday, or local-college-timezone Monday? Current spec: UTC. May need adjustment if colleges span time zones.
- **OQ-3:** Should the 429 response include the actual current spend or just the limit (privacy)? Current spec: include both (admins need it; users see same data via the banner).
- **OQ-4:** Should the weekly summary cron also send an email digest to college admin? Default: no (defer to v2; in-app banner + dashboard sparkline is v1).
- **OQ-5:** What happens if an admin sets the limit BELOW the current week's spend (e.g. spent ₹500, sets limit to ₹400)? Default: immediately blocks future calls until rollover; this is the admin's intent.

## Changelog

- **2026-04-28** — Initial spec, sibling to `finance-agent-summary-cache`. Decisions:
  - Per-college, weekly rolling 7-day window
  - Two-stage enforcement: soft alert at 80% (configurable), hard block at 100%
  - Default `weeklyInr=0` means no limit (existing colleges unaffected)
  - In-app banner + admin UI; email digest deferred
  - 60s in-process cache on spend lookup to avoid Mongo round-trip on every call

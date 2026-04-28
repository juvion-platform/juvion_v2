# Per-College LLM Spend Limits — API Reference

**Spec:** `.captain/specs/llm-spend-limits/spec.md`
**Plan:** `.captain/specs/llm-spend-limits/plan.md`
**Tasks:** `.captain/specs/llm-spend-limits/tasks.md`

This document describes the per-college weekly LLM-spend cap that governs every Finance Agent endpoint (chat, forecast, risk-narrative, situations, reminder-drafts). The feature lets platform admins configure a hard rupee budget per college; the system warns at 80% and blocks at 100%, with a 60-second in-process cache to keep the gate off the hot path.

Complements the companion QA / deploy checklist: `./llm-spend-limits-qa-checklist.md`.

---

## Table of contents

1. [Overview](#overview)
2. [Concepts](#concepts)
3. [Architecture](#architecture)
4. [Data model additions](#data-model-additions)
5. [Endpoints](#endpoints)
6. [Pre-call gate flow](#pre-call-gate-flow)
7. [Frontend banner UX](#frontend-banner-ux)
8. [Weekly summary cron](#weekly-summary-cron)
9. [Configuration](#configuration)
10. [Error codes](#error-codes)
11. [RBAC mapping](#rbac-mapping)
12. [Observability](#observability)
13. [Known deviations from plan](#known-deviations-from-plan)
14. [Open questions](#open-questions)

---

## Overview

Every live LLM call from the Finance Agent passes through `assertWithinSpendLimit(collegeId)` before the request leaves the backend. The gate:

- Aggregates `AgentAction.costInr` over a rolling 7-day window per `collegeId`.
- Compares against `College.aiSpendLimits.weeklyInr` (admin-configurable; `0` = unlimited / bypass).
- Throws `AppError(429, 'Weekly LLM budget exceeded', detail)` when usage ≥ 100%.
- Returns a `warning: true` flag when usage ≥ `alertThresholdPct` (default 80%) but still below 100%.
- Default-allows on any DB error so a flaky gate cannot blanket-429 every tenant.

Costs are sourced from the same `AgentAction` rows the existing audit log already writes — no new instrumentation needed. Snapshots are persisted weekly via the `LLM_USAGE_WEEKLY` cron for trend analysis and post-incident reports.

---

## Concepts

### Rolling 7-day window

The window is a true rolling 7 days (`createdAt >= now - 7d`), NOT a calendar week. This means:

- A burst on Monday rolls out the following Monday at the same hour.
- The "reset" point surfaced to the UI (`resetsAt`) is `now + 7d` — the moment the OLDEST cost in today's window will fall out. It's an upper bound; the actual reset is continuous.
- Comparing `Run 1` and `Run 3` of the baseline measurement script (`backend/src/scripts/measure-llm-baseline.ts`) requires the same `--days` value across runs.

### Soft alert vs. hard block

| State | Threshold | Behavior |
|---|---|---|
| Normal | `pct < alertThresholdPct` | Call proceeds; no banner. |
| **Soft alert** | `alertThresholdPct ≤ pct < 100` | Call proceeds; `budgetWarning` attached to response; frontend renders amber banner. |
| **Hard block** | `pct ≥ 100` | Service throws `AppError(429)`; LLM call is NEVER made; frontend renders red banner + degraded mode. |

The 60-second in-process cache means up to 60s of "headroom" is possible during a burst — admins should set `weeklyInr` ~10% below the actual cap they want.

### Bypass on `weeklyInr=0`

`weeklyInr=0` is the **default** for new and existing colleges. It means "no limit configured; gate bypasses entirely." This guarantees no regression for tenants who haven't opted into spend limits yet.

---

## Architecture

```
                    Admin sets limit on College Mgmt page
                                  │
                                  ▼
            PATCH /api/colleges/:id/ai-spend-limits  (L6)
                                  │
                                  ▼
              College.aiSpendLimits stored in Mongo  (L1)
                                  │
                                  │  (read in pre-call gate)
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ Live LLM call site (finance-agent service.ts)                 │
   │   ▼                                                            │
   │ assertWithinSpendLimit(collegeId)  (L3 service + cache)        │
   │   ├─ load College.aiSpendLimits   (60s in-process cache)       │
   │   ├─ if weeklyInr === 0 → bypass; return state for logging     │
   │   ├─ load AgentAction.costInr 7-day sum (60s cache)            │
   │   ├─ if pct ≥ 100 → throw AppError(429, ..., detail)           │
   │   ├─ if pct ≥ alertThresholdPct → log warn, set warning flag   │
   │   └─ return SpendCheckResult                                   │
   │   ▼                                                            │
   │ proceed with live LLM call (L4 integration)                    │
   └──────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                  budgetWarning surfaced on API response
                                  │
                                  ▼
              <BudgetBanner /> renders on FeeDashboardPage  (L7)
                                  │
                                  ▼
            Weekly cron @ Mon 06:00 UTC → LLMUsageSnapshot   (L5)
```

---

## Data model additions

### `College.aiSpendLimits` (nested sub-document)

```ts
aiSpendLimits: {
  weeklyInr: { type: Number, default: 0, min: 0 },             // 0 = no limit
  alertThresholdPct: { type: Number, default: 80, min: 1, max: 100 },
}
```

- Wrapped in a `Schema(..., { _id: false })` with `default: () => ({})` so existing documents read with the defaults populated. **No migration is required.**
- `weeklyInr=0` is the runtime semantic for bypass. The DB validation lower bound is `0`, not `1` — the field is "absent" rather than "must be set".
- See `backend/src/models/College.ts`.

### `LLMUsageSnapshot` (new collection)

```ts
interface ILLMUsageSnapshot {
  _id: ObjectId;
  collegeId: ObjectId;
  weekStart: Date;          // Monday 00:00 UTC of the snapshot week
  weekEnd: Date;            // Sunday 23:59:59.999 UTC of the same week
  totalCostInr: number;
  totalCalls: number;
  byType: Record<string, number>;   // free-form per-type counts (forecast, situations, etc.)
  limitAtTime: number;              // captured snapshot of weeklyInr at run time
  alertThresholdAtTime: number;     // captured snapshot of alertThresholdPct
  createdAt: Date;
  updatedAt: Date;
}
```

- Index: `{ collegeId: 1, weekStart: -1 }` (non-unique — admin re-runs are upserts, not duplicates).
- One row per (college, completed week). At ~52 rows/college/year, growth is trivial.
- See `backend/src/models/juvi/LLMUsageSnapshot.ts`.

---

## Endpoints

### `PATCH /api/colleges/:id/ai-spend-limits`

Admin-only write path that updates the per-college budget configuration.

**Permission:** `super_admin` may update any college via the URL `:id`. `admin` and `principal` may update their own college only — passing a different `:id` returns `403`.

**Rate limit:** 60 requests/minute/user (existing `createUserRateLimit`).

**Request body** (Zod-validated; empty body rejected):

```json
{
  "weeklyInr": 5000,           // optional, ≥ 0; 0 = no limit
  "alertThresholdPct": 75       // optional, ∈ [1, 100]
}
```

**Response 200:**

```json
{
  "aiSpendLimits": {
    "weeklyInr": 5000,
    "alertThresholdPct": 75
  },
  "currentSpend": {
    "spent": 1240.55,
    "limit": 5000,
    "pct": 24.81
  }
}
```

**Side effects:**

1. Persists new values to `College.aiSpendLimits` via `findById` + `.set` + `.save()`.
2. Invalidates BOTH per-college caches (`limits` + `spend`). Next gate call re-reads from Mongo within ~10ms.
3. Emits an `AuditLog` row with `entityType='College'`, `action='update'`, and field-level `oldValue`/`newValue` deltas (only fields actually changed).
4. Re-aggregates `currentSpend` for the response payload (cache was just invalidated).

**Errors:**

| Code | Cause |
|---|---|
| `400` | Negative `weeklyInr`, threshold outside `[1, 100]`, or empty body |
| `401` | No JWT |
| `403` | Non-admin role, OR admin/principal with mismatched `:id` |
| `404` | College not found (only reachable for super_admin; admin/principal hit `403` first) |
| `429` | Rate limit exceeded |

See `backend/src/modules/colleges/{routes,controller,validation}.ts`.

---

## Pre-call gate flow

`backend/src/modules/platform/spend-limits/service.ts` exports three functions:

```ts
// Throws AppError(429) when over budget; returns SpendCheckResult otherwise.
assertWithinSpendLimit(collegeId: string): Promise<SpendCheckResult>

// Read-only spend lookup. Used by /ai-spend-limits PATCH response and admin UI.
getCurrentSpend(collegeId: string): Promise<{ spent: number; cachedUntil: Date }>

// Admin write path. Called by the L6 controller.
updateSpendLimits(
  collegeId: string,
  updates: { weeklyInr?: number; alertThresholdPct?: number },
  userId: string,
): Promise<{ aiSpendLimits, currentSpend }>
```

`SpendCheckResult` shape:

```ts
interface SpendCheckResult {
  blocked: boolean;     // always false in current impl — gate throws on block
  warning: boolean;     // true when pct >= alertThresholdPct
  spent: number;
  limit: number;
  pct: number;          // 0..100+
  resetsAt: Date;       // now + 7d (window's tail)
}
```

### Where the gate fires (L4)

`backend/src/modules/juvi/finance-agent/service.ts` calls `assertWithinSpendLimit` near the top of these handlers:

| Handler | Gate fires? | Notes |
|---|---|---|
| `handleChat` (streaming) | ✅ Yes — at request entry | On 429, generator yields `{ type: 'error' }` and ends cleanly so the SSE controller writes `event: error`. Mid-stream is NOT re-gated. |
| `handleForecastNarrative` | ✅ Yes — before `client.complete` | `budgetWarning` attached to response body. |
| `handleRiskScores` | ⚠️ Conditional — only if `includeNarrative=true` | Deterministic-score path makes no LLM call; no gate. |
| `handleSituations` | ✅ Yes — at request entry | Fires even when no candidates, to keep semantics predictable. |
| `handleReminderDrafts` | ✅ Yes — before bounded-concurrency batch | Atomic semantics: either all drafts attempted or all blocked. |
| `handleApproveDrafts` | ❌ No | No LLM call (just persists drafts to FeeReminder). |
| `handleDismissSituation` | ❌ No | No LLM call. |

### `budgetWarning` response field

Object-shape responses include `budgetWarning?: BudgetWarning` directly:

- `ForecastWithNarrative` — body field
- `AgentChatFinal` (the `done` event of the SSE stream) — embedded in `final.budgetWarning`

```ts
interface BudgetWarning {
  spent: number;
  limit: number;
  pct: number;        // 0..100
  resetsAt: string;   // ISO 8601
}
```

Array-shape responses (`risk-scores`, `situations`, `reminder-drafts`) do **not** carry `budgetWarning` in v1 — see [Known deviations](#known-deviations-from-plan).

### 429 response body

When the gate blocks, `errorHandler` returns:

```json
{
  "error": "Weekly LLM budget exceeded",
  "detail": {
    "spent": 5240.10,
    "limit": 5000,
    "pct": 104.8,
    "resetsAt": "2026-05-05T12:00:00.000Z"
  }
}
```

`AppError.detail` is the optional structured payload added in L4. Existing `AppError` throw sites that only pass `(statusCode, message)` are unchanged.

### In-process cache

`backend/src/modules/platform/spend-limits/cache.ts` maintains two `Map<collegeId, CachedEntry<T>>` instances:

- `collegeLimitsCache` — small per-college config object
- `currentSpendCache` — rolling 7-day total

Both share TTL `LLM_BUDGET_CACHE_TTL_SECONDS` (default 60 seconds). Reading the env on every `set` (lazy) means tests and runtime config can override without a restart. Stale entries are reaped on read.

`updateSpendLimits` invalidates both caches for the given `collegeId`. Per `clear()` semantics — entries for OTHER colleges are unaffected.

---

## Frontend banner UX

`<BudgetBanner />` lives at `admin-portal/src/components/finance/BudgetBanner.tsx` and is mounted above the page header on `FeeDashboardPage`.

| State | Color | Copy |
|---|---|---|
| No warning | hidden | (renders `null`) |
| Soft alert (≥ 80%) | amber | "AI usage at NN% of weekly budget. ₹X remaining. Resets in <relative>." |
| Hard block (≥ 100% or 429 received) | red | "AI usage exceeded weekly budget. Contact admin to increase the limit." |

Hydration source: `forecast` endpoint's `budgetWarning` field. Once warning fires, the banner persists for the rest of the session (officer can dismiss; reappears on page reload).

### Degraded mode (on 429)

When the dashboard receives a 429 from `forecast`, `<BudgetBanner />` flips to red and the entire AI surface is gated:

- `<AICommandBar />` chat input → disabled
- `<AIForecastBanner />` narrative → hidden (projection numbers still render)
- `<SituationCards />` → hidden
- `<RiskHoverPopover />` → shows deterministic factors only ("Narrative unavailable" tooltip when LLM is gated)

See `l7.md` completion file for the wiring details across the four AI surface components.

### Admin UI section

The College Management edit modal (`admin-portal/src/pages/CollegeManagement.tsx`) has an "AI Spend Limits" section with:

- Weekly budget (₹) — number input, min 0, default 0 (helper text: "0 = no limit")
- Alert threshold (%) — number input, range 1-100, default 80
- `<SpendUsageBar />` — color-coded usage bar that updates immediately on save (hydrated from PATCH response)
- Save button → `updateAISpendLimits()` from `admin-portal/src/services/colleges.ts`
- Role gate: super_admin / admin / principal only
- New colleges (create flow) do NOT see this section — there's no `_id` to PATCH against until the college is saved. Defaults apply server-side.

---

## Weekly summary cron

`backend/src/workers/llm-usage-weekly.worker.ts` runs every Monday at 06:00 UTC and writes one `LLMUsageSnapshot` row per active college for the just-completed week.

**Cron:** `0 6 * * 1` (env: `LLM_BUDGET_WEEKLY_SUMMARY_CRON`)
**Concurrency:** max 10 colleges in flight (`LLM_USAGE_WEEKLY_CONCURRENCY = 10`)
**Retries:** 3 attempts, 5-minute exponential backoff
**Failure tolerance:** per-college try/catch — one college's aggregation failure does NOT abort the run.

Logic per active college:

1. `weekStart = startOfLastWeek()` (Monday 00:00 UTC of the completed week)
2. `weekEnd = endOfLastWeek()` (Sunday 23:59:59.999 UTC of the same week)
3. Aggregate `AgentAction` matching `{ collegeId, createdAt: { $gte: weekStart, $lte: weekEnd } }`, group by `type`.
4. Persist `{ totalCostInr, totalCalls, byType, limitAtTime, alertThresholdAtTime }` — historical limits captured at snapshot time, NOT current.
5. Log `[llm-budget:weekly] college=<id> spent=<n> limit=<m> pct=<p>`.

Inactive colleges (`status !== 'active'`) are skipped.

---

## Configuration

| Env var | Default | Effect |
|---|---|---|
| `LLM_BUDGET_DEFAULT_WEEKLY_INR` | `0` | Documented for future use (per-deployment default; not currently consumed). |
| `LLM_BUDGET_DEFAULT_ALERT_PCT` | `80` | Default for new College documents (also encoded at the schema level). |
| `LLM_BUDGET_CACHE_TTL_SECONDS` | `60` | Cache TTL for `collegeLimitsCache` + `currentSpendCache`. |
| `LLM_BUDGET_WEEKLY_SUMMARY_CRON` | `0 6 * * 1` | BullMQ cron pattern for the weekly snapshot worker. |

Read lazily on every cache `set` — runtime changes propagate without a restart.

---

## Error codes

| Code | Surface | Cause |
|---|---|---|
| `400` | PATCH | Invalid body (negative `weeklyInr`, threshold out of range, empty body) |
| `401` | PATCH | Missing JWT |
| `403` | PATCH | Non-admin role; OR admin/principal with mismatched `:id` |
| `404` | PATCH | College not found (only reachable for super_admin) |
| `429` | All AI endpoints | Weekly LLM budget exceeded — `detail` body field carries `{ spent, limit, pct, resetsAt }` |
| `429` | PATCH | Rate limit (60/min/user) |

---

## RBAC mapping

The PATCH endpoint's documented contract is `('platform', 'update')`. The load-bearing check in the route is the role allow-list `{ super_admin, admin, principal }` — matches the backend `platformUpdateGate`.

`super_admin` is the only role that can target an arbitrary `:id`; `admin` and `principal` are restricted to their own JWT `collegeId`. Cross-college attempts return `403` BEFORE the controller hits the database.

---

## Observability

Structured log lines (one per event):

| Line | When |
|---|---|
| `[llm-budget:warn] college=<id> spent=<n> limit=<m> pct=<p>` | On warning threshold crossing (per call). |
| `[llm-budget:blocked] college=<id> spent=<n> limit=<m> pct=<p>` | On 429 throw (per call). |
| `[llm-budget:weekly] college=<id> spent=<n> limit=<m> pct=<p>` | One per college per cron run. |
| `[llm-budget] limits load failed; default-allow:` | DB error in `loadLimits`. |
| `[llm-budget] spend load failed; default-allow:` | DB error in `loadSpend`. |

The `AuditLog` collection captures every admin write to `aiSpendLimits` with field-level deltas (`entityType='College'`, `action='update'`).

---

## Known deviations from plan

1. **Array endpoints lack body `budgetWarning`.** Plan §1.8 wants `budgetWarning?` on every endpoint; the actual implementation only adds it to object-shape responses (`ForecastWithNarrative`, `AgentChatFinal`). Wrapping `RiskScoreResult[]` and `Situation[]` in a `{ items, budgetWarning }` envelope would have broken the existing frontend typings. **Workaround:** the dashboard banner hydrates from the forecast endpoint's `budgetWarning` on initial load. Since the budget can only grow within a 7-day window (without admin intervention), a stale banner stays correct. **Future work:** introduce an `X-Budget-Warning` HTTP response header set by middleware so the surface is uniform across all 7 endpoints.

2. **Streaming chat 429 lands as an SSE error event, not a 429 status code.** SSE headers flush before the generator runs, so a service-side throw can't produce a clean 429. The current implementation yields `{ type: 'error', error: 'Weekly LLM budget exceeded' }` and ends the stream. The frontend's EventSource listener pattern-matches on the error event to flip the banner. If a clean 429 status is required, the gate must move into `chatHandler` BEFORE `res.flushHeaders()`.

3. **AI Spend Limits section is edit-only.** The CollegeManagement create modal does not show the section because there's no `_id` to PATCH against. Server-side defaults (`{ weeklyInr: 0, alertThresholdPct: 80 }`) apply automatically; admin can edit the limits after the college is saved.

4. **No per-run audit table for cron failures.** Unlike `FeeAlertsCronRun.topLevelError`, the L5 worker doesn't persist failure summaries. Per-college errors are logged but not queryable. Acceptable for v1 since the snapshot collection itself is the audit trail; flagged for future observability work.

---

## Open questions

- **Time zone.** Both the rolling 7-day window and the weekly cron use UTC. Indian colleges may want IST-anchored windows. Documented as "consider per-college TZ override in v2" in plan §10 risks.
- **Header-based warning surface.** When/whether to introduce `X-Budget-Warning` (see deviation 1) — depends on whether array-endpoint banner staleness is observed in the field.
- **Default-allow versus configurable fail-open/fail-closed.** Today's gate fails open on DB errors. A pessimistic deployment could prefer fail-closed (block on uncertainty). Currently not configurable.
- **Soft cap vs. hard cap UX.** Some admins may want a "soft cap" mode that warns at 100% but still allows calls. Currently the hard block is non-negotiable.

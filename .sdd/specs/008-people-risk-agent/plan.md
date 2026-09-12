# 008 — People / Welfare AI Dashboard

**Status:** plan (revision 2). Supersedes `plan-v1-superseded.md`.
**Revised:** 2026-09-01
**Branch target:** `feat/people-risk-agent`
**Reference implementation:** `backend/src/modules/juvi/finance-agent/` (4,081 LOC, shipped)
**Companion audit:** `docs/STATE_OF_BUILD.md`, `docs/ROADMAP_TO_DEMO.md`

---

## 0. Why this revision exists

Revision 1 planned to build a student risk scorer from scratch — a new
`student-risk-scorer.ts` with a hand-written weight table, persisting to
`DropoutRiskAlert`. **That was written without knowing the CCD subsystem
existed.** It does, and it is substantially the thing revision 1 proposed to
build.

Verified in the code:

| Component | File | State |
|---|---|---|
| Cross-module signal bus | `models/welfare/RiskSignal.ts` | Built. `source: M03/M04/M06/M08/Juvi`, 12 signal types, `baseWeight`, `firstGenModifier`, `computedWeight`, `expiresAt` decay |
| Compound scorer | `ment-couns-ccd-service.ts:671` `computeRiskScore()` | Built. Weighted sum × cross-module multiplier × temporal multiplier, capped 100, bucketed P1/P2/P3 |
| Per-college thresholds | `models/welfare/CCDThreshold.ts` | Built. `scoreThreshold`, `crossModuleMinimum`, `temporalWindowDays`, `compoundingMultiplier`, `decayDays`, per priority |
| Alert record | `models/welfare/CrisisAlert.ts` | Built. `compoundScore`, `scoreBreakdown`, `priority`, `signals[]`, plus acknowledgment / investigation / intervention sub-docs |
| Alert lifecycle | `ment-couns-ccd-service.ts` | Built. Generate → acknowledge → investigate → intervene → resolve / false-positive, with double-alert suppression |
| HTTP surface | `modules/welfare/routes.ts:295-312` | Built. 21 endpoints, all `authorize()`-gated |

**Revision 1's open question §8.1 — "weights must be per-college config, check
whether `CCDThreshold` is the right home" — is already answered. It is, and it
already exists.**

So this plan is no longer "build a risk engine." It is **three gaps around an
engine that already works**:

1. **Nothing emits signals.** `RiskSignal.create` is called from two places,
   both inside `ment-couns-ccd-service.ts`. The only ingress is a human POSTing
   to `/api/welfare/ccd/risk-signals`. The `source` enum names four upstream
   modules that have never called it.
2. **The intelligence is invisible.** CCD alerts land in `CrisisAlert`, which
   *does* have a page — `pages/welfare/CrisisAlertsPage.tsx`, 194 lines. But
   that page renders `type`, `severity`, `status`, `description` and nothing
   else. It shows **none** of `compoundScore`, `priority`, `scoreBreakdown` or
   `signals[]`. A CCD alert appears there as an unexplained "critical
   mental_health" row.
3. **There is no LLM layer.** Which is correct for now — see §4.

> Correction to something I said earlier in this thread: I described CCD as
> having "zero frontend." That was wrong. The alerts surface on
> `CrisisAlertsPage`; what is missing is any column, panel or drill-down that
> shows the score, the priority, or the signals behind it. The gap is real but
> it is a display gap, not an absence.

---

## 1. Goal

Give a mentor, HOD or dean of students a Monday-morning list of students who
need contact this week, with an auditable reason for each, and a one-click path
from "flagged" to "contacted" to "resolved".

Same architectural rule as finance: **the score is deterministic; the LLM only
narrates and drafts.** Phase 1 and 2 ship zero LLM calls.

---

## 2. Where it lives

Two directories, deliberately split:

```
backend/src/modules/welfare/          ← emitters + CCD service (exists, extended)
backend/src/modules/juvi/people-agent/ ← LLM layer only (Phase 3)
```

Revision 1 put everything under `juvi/people-agent/`. That is wrong for the
deterministic half: the scorer, thresholds, alert lifecycle and 21 endpoints
already live in `welfare/`, and moving or wrapping them buys nothing. Only the
LLM narration and outreach drafting belong under `juvi/`, where the shared LLM
spine is.

**RBAC:** existing CCD routes already authorize on `welfare`. New routes match.
A mentor or HOD holding no `juvi` grant can use the whole deterministic
feature — which is the point.

---

## 3. Reuse ledger

| Reused unchanged | New |
|---|---|
| `ment-couns-ccd-service.ts` `computeRiskScore()` | `welfare/risk-emitters.ts` |
| `models/welfare/RiskSignal.ts` | `welfare/ccd-dashboard-service.ts` (aggregations) |
| `models/welfare/CCDThreshold.ts` | `mentor-scope.ts` |
| `models/welfare/CrisisAlert.ts` | `pages/welfare/StudentRiskPage.tsx` |
| All 21 CCD endpoints | `services/welfare.ts` — CCD functions |
| `finance-agent/llm-client.ts` + adapters | `juvi/people-agent/*` (Phase 3 only) |
| `shared/llm/pii.ts`, `shared/cache/ai-feature-cache.ts` | — |
| `platform/spend-limits/*`, `models/juvi/AgentAction.ts` | — |

**No new models.** This is the strongest signal that the revision is right:
revision 1 needed one, this needs none.

---

## 4. Phase 0 — platform debt (unchanged from revision 1, still blocking)

Carried forward verbatim in intent; see `plan-v1-superseded.md` §4 for the long
form. Summary:

- **P0-1** — move `assertWithinSpendLimit` + the `AgentAction` write inside
  `createLLMClient()`. Today the gate has 5 call sites, all in
  `finance-agent/service.ts`, and `AgentAction.create` has exactly one site —
  which is the sole input to the spend aggregation. `nl-reports`,
  `config-suggest` and `lead-scoring` spend money the budget cannot see. Adding
  a fifth unmetered consumer is not acceptable.
- **P0-2** — reject placeholder API keys at construction, not at call time.
- **P0-3** — decide `weeklyInr = 0` semantics. It currently means *unlimited*.

**Only P0-1 and P0-2 block Phase 3.** Phases 1 and 2 make no LLM calls and can
ship in parallel with Phase 0.

**Estimate: 1 day.**

---

## 5. Phase 1 — feed the engine (the emitters)

The single highest-leverage work in this plan. The scorer is idle because
nothing calls it.

### T1 — `welfare/risk-emitters.ts`

One exported function, called from six places. Do **not** scatter
`RiskSignal.create` across four modules.

```ts
export async function emitRiskSignal(
  collegeId: string,
  input: {
    studentId: string;
    source: 'M03' | 'M04' | 'M06' | 'M08' | 'Juvi';
    signalType: RiskSignalType;
    triggerData: Record<string, unknown>;
  },
): Promise<void>
```

Responsibilities:
- Look up `baseWeight` for the `signalType` (see T2).
- Apply `firstGenModifier` from the `Student` record.
- Compute `expiresAt` from the active `CCDThreshold.decayDays`.
- Call the existing `ingestRiskSignal` path so `computeAndUpdateCCDAlert` fires.
- **Never throw into the caller.** A failed signal must not roll back an
  attendance save or a payment. Catch, log with a grep-able prefix, return.
- **Idempotent per (student, signalType, day).** Re-running the attendance job
  must not stack five identical `attendance_drop` signals and inflate the score.
  Guard on an existing active signal of the same type within 24h.

### T2 — signal weight configuration

`RiskSignal.baseWeight` is `required` and currently supplied by the HTTP caller.
Emitters need a source of truth. `CCDThreshold` holds *score* thresholds, not
*signal* weights, so this is a genuine gap.

**Decision needed (GATE 1):** add `signalWeights: Map<string, number>` to
`CCDThreshold`, or a small `RiskSignalWeight` collection keyed
`(collegeId, signalType)`. Prefer extending `CCDThreshold` — it is already
per-college, already has an admin surface, and avoids a new model.

Ship with sane defaults seeded per college; do not hardcode in the emitter.

### T3 — the six emitter call sites

| Trigger | File | Signal |
|---|---|---|
| Attendance < 75% | `academics/academic-delivery-service.ts:447`, inside the existing `AttendanceAlert.create` branch | `attendance_drop` |
| Backlog created | `academics/service.ts` backlog create | `backlog_accumulation` |
| Defaulter reaches stage ≥ 2 | `finance/fee-lifecycle-service.ts` | `fee_default` |
| Mess attendance drop | `campus-ops/mess-transport-service.ts` | `mess_attendance_drop` |
| Hostel violation logged | `campus-ops/hostel-service.ts` | `warden_concern` |
| Mentor concern raised | `ment-couns-ccd-service.ts:210` (path exists, route it through T1) | `counselling_active` |

`generateAttendanceAlerts` is the cleanest hook in the codebase — it already
loops enrollments, computes a percentage and creates an alert below 75%. One
call in that branch.

**Do not route these through `shared/events.ts`.** It is a bare Node
`EventEmitter` with no persistence, used only by the workflow engine and the
ERPNext bridge. Signals dropped on restart would be undebuggable. Direct
service calls; revisit when volume justifies BullMQ.

### T4 — fix the alert-type hack

`computeAndUpdateCCDAlert` writes `type: 'mental_health'` with the comment
*"compound_risk maps to mental_health in enum"*. Every compound-risk alert is
therefore miscategorised as a mental-health crisis, which is both wrong in
reporting and unhelpful in a demo. Add `'compound_risk'` to the `CrisisAlert.type`
enum and use it.

Also: `CrisisAlert.scoreBreakdown` declares `firstGenModifier` and
`computeRiskScore` never populates it. Either populate it or drop the field.

### T5 — tests

`modules/welfare/` has **zero test files** today. Do not add a scoring feature
to an untested module. Minimum:
- `risk-emitters.test.ts` — one case per signal type, the idempotency guard, and
  the never-throws contract.
- `ccd-scoring.test.ts` — `computeRiskScore` against a seeded signal set: base
  sum, the ×1.5 cross-module multiplier at exactly 3 modules, the ×1.5 temporal
  multiplier at exactly 2 in-window signals, the 100 cap, and each P-boundary.

**Phase 1 estimate: 4 days. Zero LLM spend.** At the end of it the engine is
live and producing scored alerts from real activity.

---

## 6. Phase 2 — make it visible (the dashboard)

### T6 — `welfare/ccd-dashboard-service.ts`

Aggregations the existing endpoints do not provide:

- Alerts grouped by priority, with student, mentor, days-open and last action.
- Signal counts for the last 7 days grouped by `source` — this is the widget
  that proves the cross-module claim.
- Unactioned alerts older than N days, grouped by assigned mentor.

Reuse `applyAuthScope`. See T7 for the mentor case.

### T7 — `mentor-scope.ts`

Carried from revision 1 §5 T4 unchanged — still needed, still non-obvious.
`applyAuthScope` handles `departmentOnly` and `selfOnly`; a mentor seeing their
mentees is neither, it is a join through `MentorAssignment`
(`{collegeId, mentorId, status:'active'}`, which is already indexed).

```ts
export async function mentorMenteeIds(collegeId, personId): Promise<string[] | null>
// null → not a mentor; fall through to the normal authScope path
```

Note this sits on the known `resolveUserScope` limitation
(`shared/rbac/scope-resolver.ts:50-64` handles three roles, and an unmapped role
gets a *wider* view, not narrower). Do not widen that here; intersect
explicitly.

### T8 — `pages/welfare/StudentRiskPage.tsx`

New page. Do **not** extend `CrisisAlertsPage` — that is a generic CRUD surface
for human-reported incidents and should stay one.

| Widget | Source |
|---|---|
| Risk board, P1 / P2 / P3 columns | `GET /ccd/alerts` |
| **"Why this student"** — signal list with weight, the ×1.5 multipliers, the final score | `GET /ccd/students/:id/risk-profile` + `scoreBreakdown` |
| Signals this week by source module | T6 aggregation |
| Mentor workload / unactioned | T6 aggregation |
| Acknowledge · investigate · intervene · resolve · false-positive | Existing 5 endpoints |

The breakdown widget is the one that matters. It is the difference between "the
system says P1" and "the system says P1 because attendance dropped 18 points,
fees are 40 days overdue and the warden logged a concern — three modules, so the
compound multiplier applied."

Lift the interaction patterns from `FeeDashboardPage.tsx`: risk badge, hover
popover with the factor breakdown, the five render states (loading skeleton,
success, delayed-empty, error-with-retry-that-does-not-block-the-page,
degraded). Accessible queries only (`getByRole`, `getByTestId`) per the e2e
discipline note.

Add CCD functions to `admin-portal/src/services/welfare.ts` (81 exports today,
none CCD).

**Phase 2 estimate: 4 days. Still zero LLM spend.** Ships standalone and is
independently useful with no API key configured.

---

## 7. Phase 3 — the LLM layer (`juvi/people-agent/`)

Only now, and only for the two things an LLM is actually better at.

### T9 — narration
Mirror `finance-agent/prompts.ts`. One sentence per alert explaining the
compound score in language a mentor can repeat to a parent. Masked via
`shared/llm/pii.ts`, cached daily via `ai-feature-cache` under a new
`juvi:ai:people-risk:` namespace, strict-parsed with a deterministic fallback.

The narrative must never restate a number the breakdown does not already
contain. Same rule as finance: the model explains, it never computes.

### T10 — outreach drafts + approve (HITL)
Copy `handleReminderDrafts` / `handleApproveDrafts` (`service.ts:791` / `:933`),
including bounded concurrency and cross-college validation on approve.

**Fix the two inherited bugs rather than copying them.** `service.ts:963-969`
hardcodes `channel: 'sms'` and `dueAmount: 0` even though the draft carries
language and tone and the guardian record carries a channel preference. The
People version reads channel from the guardian and carries the drafted language
through to the queued job.

Approve writes a `CrisisAlert.intervention` entry
(`type: 'parent_contact' | 'mentor_outreach'`) — the sub-doc already exists.

### T11 — delivery honesty
`workers/_stub-delivery.ts` sets `deliveryStatus: 'delivered'` and sends
nothing. **Do not ship T10 on top of that.** Either wire one real provider, or
have the UI show "queued — delivery not configured". A mentor believing a parent
was contacted when they were not is worse than no feature.

**Phase 3 estimate: 3 days.** Blocked on P0-1 and P0-2.

---

## 8. Phase 4 — close the loop

### T12 — outreach effectiveness
`CrisisAlert` retains `intervention.outcome` and timestamps, so
"alerts raised → contacted → resolved → recurred" is a pure aggregation. No AI.

**But the score history is not retained.** `computeRiskScore` recomputes from
live signals; nothing snapshots it. "Did contacting them help?" — the question a
dean will ask first — cannot be answered without a time series, and a time
series cannot be backfilled.

**Add a `RiskScoreSnapshot` write in Phase 1**, even though the widget ships
here. One row per student per scoring run: `{collegeId, studentId, score,
priority, breakdown, at}`. It is a day of work in Phase 1 and impossible to
recover later.

**Phase 4 estimate: 1 day + the snapshot write pulled into Phase 1.**

---

## 9. Decisions to settle before implementation (GATE 1)

1. **Signal weights** — extend `CCDThreshold` with `signalWeights`, or a new
   `RiskSignalWeight` collection? (§5 T2. Recommend extending.)
2. **`DropoutRiskAlert`'s fate.** It is a second, unrelated risk model in the
   same module, with the same shape, never computed
   (`welfare/dropout-service.ts:56` is unconditional create from caller input).
   Two competing risk models is a support liability. Delete it, or make it a
   read-view over `CrisisAlert`? **Recommend delete.**
3. **Cadence.** On-demand only (finance's model), or a nightly BullMQ job? A
   mentor's Monday list only exists without someone clicking Refresh if it is
   nightly — but that is the first *unattended* spend in the product, so it
   needs P0-1 landed first. Emitters make it moot for signal freshness; this is
   only about alert recomputation.
4. **Detention threshold source** — the attendance emitter fires below 75%,
   hardcoded in `generateAttendanceAlerts`. Read from the regulation instead?
   Varies by university. (Carried from revision 1 §8.2.)
5. **`weeklyInr = 0` semantics** (P0-3).

---

## 10. Explicitly out of scope

- **Tool-calling / free-text chat over People data.** `claude-adapter.ts`
  `extractText()` drops `tool_use` blocks. Chat would answer only from one
  pre-baked context bundle. Right next thing; not this plan.
- **Retrieval / `JuviKnowledgeBase`** — text index nothing queries.
- **The shared AI extraction** (`docs/ROADMAP_TO_DEMO.md` §3). This plan builds
  the People agent against the *current* finance-shaped structure. If the
  extraction lands first, T9–T10 target the new interfaces instead and get
  cheaper. Sequencing decision, not a scope change.

---

## 11. Sequence

```
P0 (1d)   spend gate into createLLMClient · placeholder-key guard
   ↓      independent; blocks P3 only
P1 (4d)   emitters · weight config · alert-type fix · welfare's first tests
   ↓      + RiskScoreSnapshot write (see §8)
   ↓      ENGINE LIVE — scored alerts from real activity, zero LLM
P2 (4d)   dashboard aggregations · mentor-scope · StudentRiskPage
   ↓      VISIBLE — demo-ready, works with no API key
P3 (3d)   narration · outreach drafts · approve · delivery honesty
   ↓      requires P0
P4 (1d)   outreach effectiveness dashboard
```

**~13 working days.** P1 and P2 together — 8 days — are what the demo needs.
P3 and P4 are post-demo.

Revision 1 estimated ~12 days to build a scorer this plan does not build. The
work did not get smaller; it moved from inventing a risk engine to feeding and
surfacing the one that already exists, plus writing the module's first tests.

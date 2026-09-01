# 008 — People Risk Agent (student retention early-warning)

**Status:** plan, not yet specced through GATE 1-3.
**Branch target:** `feat/people-risk-agent`
**Prior art:** `backend/src/modules/juvi/finance-agent/` (M04 fee agent, 4,081 LOC, shipped).

---

## 1. Goal

Move detection of at-risk students from **week 16** (exam-eligibility deadline,
irreversible) to **week 8-9** (still actionable), and make acting on it cost a
click instead of an evening.

The load-bearing insight: ~70% of the value is **deterministic** (a weighted
scorer + fingerprinted detectors + an accountability dashboard). The LLM earns
its keep on exactly two things — drafting N personalised outreach messages in
the guardian's language, and narrating a finding a human would need a pivot
table to see. Phase 1 ships zero LLM calls.

---

## 2. Where it lives, and why

```
backend/src/modules/juvi/people-agent/     ← new
```

Sibling of `finance-agent/`, mounted at `/api/juvi/people-agent/*` by
`modules/juvi/routes.ts` (which already mounts `financeAgentRouter` first).

Rationale: the reusable spine already lives under `juvi/` — `llm-client.ts`,
`shared/llm/pii.ts`, `shared/cache/ai-feature-cache.ts`, `spend-limits/*`,
`AgentAction`, `createUserRateLimit`. Putting the People agent anywhere else
means either importing across module boundaries in the wrong direction or
duplicating the spine. Neither is worth it.

**But the RBAC gate is NOT `juvi`.** Routes authorize on `people`/`welfare`,
so a mentor or HOD who holds no `juvi` grant can still use it:

| Route | authorize() |
|---|---|
| `POST /risk-scores` | `welfare`, `read` |
| `POST /situations` | `welfare`, `read` |
| `POST /situations/:fingerprint/dismiss` | `welfare`, `update` |
| `POST /outreach-drafts` | `welfare`, `read` |
| `POST /outreach-drafts/approve` | `welfare`, `update` |
| `GET  /outreach-status` | `welfare`, `read` |

Shared `createUserRateLimit({ max: 60, windowMs: 60_000 })`, same as
finance-agent.

---

## 3. Reuse ledger

| Reused unchanged | New, People-specific |
|---|---|
| `finance-agent/llm-client.ts` + both adapters | `student-risk-scorer.ts` |
| `shared/llm/pii.ts` | `student-situations.ts` |
| `shared/cache/ai-feature-cache.ts` | `context.ts` (assemblers) |
| `platform/spend-limits/*` | `prompts.ts` |
| `models/juvi/AgentAction.ts` | `service.ts` / `controller.ts` / `routes.ts` |
| `middleware/rateLimitPerUser.ts` | `mentor-scope.ts` |
| `models/welfare/DropoutRiskAlert.ts` (exists, currently CRUD-only) | — |

No new models. `DropoutRiskAlert.signals[{source, signalType, description,
weight, dataRef}]` is already structurally identical to finance's
`RiskFactor[]` — it was modelled and never computed.

---

## 4. Phase 0 — platform debt (blocks everything)

Do this first or the People agent becomes a fifth unmetered LLM consumer.

### P0-1 — move the spend gate + audit write inside `createLLMClient`
`backend/src/modules/juvi/finance-agent/llm-client.ts`

Today `assertWithinSpendLimit` is called from 5 sites in
`finance-agent/service.ts` only, and `AgentAction.create` exists at exactly one
site (`service.ts:223`) — which is the sole input to the spend aggregation. The
other three LLM consumers (`governance/nl-reports/service.ts:100`,
`platform/config-suggest/service.ts:69`,
`admissions/lead-scoring/llm-scorer.ts:82`) spend money the budget cannot see
or block.

Change: `createLLMClient(provider?, { collegeId, actionType, performedBy })`
returns a client whose `complete`/`stream` wrap the underlying adapter with
(a) `assertWithinSpendLimit(collegeId)` before, (b) `AgentAction.create` after.
Existing finance-agent call sites drop their manual gate + audit calls.

- `AgentAction.type` enum gains: `'risk-people' | 'situations-people' | 'outreach-draft' | 'outreach-approve' | 'nl-report' | 'config-suggest' | 'lead-score'`.
- Cache hits must still bypass the gate (they cost ₹0) — the wrapper sits
  *inside* `createLLMClient`, so cached paths that never construct a client are
  unaffected by construction.
- Keep the fail-open behaviour in `spend-limits/service.ts`.

Test: extend `finance-agent/__tests__/spend-limit-integration.test.ts` to assert
an `nl-reports` call now increments spend.

### P0-2 — fail fast on a placeholder key, bump the default model
`llm-client.ts:153`

`backend/.env` has `AI_PROVIDER=openai` and `AI_API_KEY=change-` (7 chars). The
current guard only checks non-empty, so the adapter is built with a junk key and
401s at call time — for `/query` (SSE) that lands mid-stream with no fallback;
for the other features it silently degrades to rules-only. Add a
`looksLikePlaceholder()` check (`change-`, `your-`, `xxx`, `<`) → same
`AppError(503, 'LLM provider misconfigured: …')`.

Also: `CLAUDE_DEFAULT_MODEL = 'claude-sonnet-4-5'` is previous-generation.
Bump to `claude-sonnet-5`, and if the model is ever moved to `claude-opus-5`,
`PRICING_USD_PER_MILLION.claude` must go `{input: 5, output: 25}` — the current
`{3, 15}` would under-report cost (and therefore the spend gate) by ~40%.

### P0-3 — non-zero default spend limit
`models/College.ts:53` — `weeklyInr` defaults to `0`, and `0` means *no limit*.
Every college ships ungated. Set a conservative default (e.g. `500`) or make
`0` mean "blocked" instead of "unlimited". **Decision needed** — flag for the
spec's GATE 1.

**Phase 0 estimate: 1 day.** Ships independently, no People code depends on it
beyond the constructor signature.

---

## 5. Phase 1 — deterministic core (no LLM)

### T1 — `people-agent/student-risk-scorer.ts`
Pure function, no DB, no I/O — direct mirror of `finance-agent/risk-scorer.ts`.

```ts
export interface StudentRiskFeatures {
  attendancePct: number | null;        // aggregated across offerings, this semester
  detentionThresholdPct: number;       // from AcademicCalendar/regulation, default 75
  weeksRemaining: number;
  activeBacklogs: number;              // Backlog.currentStatus in ['created','persists']
  openMentorConcerns: number;          // MentorConcern.status === 'open'
  daysSinceLastMentorSession: number | null;
  openCounsellingReferrals: number;    // status !== 'completed' && followUpStatus === 'missed'
  feeRiskTier: RiskTier | null;        // reuse finance's computeRiskScore output
  totalClassesRecorded: number;        // insufficient-data guard
}

export function computeStudentRiskScore(f: StudentRiskFeatures): StudentRiskScore
// → { score: number | null, tier, factors: RiskFactor[] }
```

Weights (starting point, must be tunable — see §8):

| Factor | Weight | Condition |
|---|---|---|
| attendance below detention line | `+25` scaled by gap | `attendancePct < threshold` |
| attendance in the 65-75% band with <6 weeks left | `+15` | cliff proximity |
| active backlogs | `+8` each, cap `+24` | `activeBacklogs > 0` |
| open mentor concern, severity high | `+15` | |
| open mentor concern, severity medium | `+8` | |
| no mentor session in 30d while flagged | `+10` | |
| missed counselling follow-up | `+12` | |
| fee risk tier high/critical | `+10` | reuse of finance scorer |
| fee dues cleared | `−6` | |

`totalClassesRecorded < 20` → `{ score: null, factors: [], tier: 'insufficient-data' }`.
Same contract as finance's `RiskFeatures` insufficient-data path.

**Deferred to v2:** the internal-marks trend factor ("IA-1 22 → IA-2 11").
`InternalMark` links to the course only via `assessmentId → InternalAssessment`,
so it needs a 2-hop join plus normalisation by `maxMarks` to compare across
assessments. Real value but ~3× the query cost of every other factor. Ship
without it; add when the other eight are validated against a real cohort.

Test: `__tests__/student-risk-scorer.test.ts` — pure unit, table-driven, one
case per factor + the insufficient-data path + monotonicity (more backlogs
never lowers the score).

### T2 — `people-agent/context.ts`
The assemblers. No LLM calls, no masking (the orchestrator owns the token map,
same split as `finance-agent/context.ts`).

```ts
export async function forRiskScores(collegeId, studentIds, authScope?): Promise<Map<string, StudentRiskFeatures>>
export async function forSituations(collegeId, authScope?): Promise<SituationInputs>
export async function forOutreachDraft(collegeId, studentId): Promise<OutreachDraftContext>
```

**Key aggregation detail:** `AttendanceSummary` is keyed
`(studentId, courseOfferingId, semesterId)` — there is no student-level
percentage stored. `forRiskScores` must `$group` by `studentId` summing
`attended`/`totalClasses`. Do it in one `aggregate()` for the whole cohort, not
per student. This same aggregation, kept at offering granularity, is what
yields the "driver course" line in T3 for free — compute once, project twice.

### T3 — `people-agent/student-situations.ts`
Mirror of `finance-agent/situation-candidates.ts`: each detector returns
`{ kind, fingerprint, studentIds[], summary fields }`, `fingerprintFor(kind,
studentIds)` gives dismissal stability.

v1 detector set (five, matching the shape of the eight finance ones):

| kind | trigger |
|---|---|
| `attendance-cliff-section` | ≥8 students in one section in the 65-74% band with <6 teaching weeks left |
| `backlog-spike-batch` | a batch's active backlog count up >40% vs. previous semester |
| `mentor-concerns-unactioned` | ≥3 `MentorConcern.status === 'open'` older than 14d under one mentor |
| `mentees-without-mentor` | active students with no `MentorAssignment.status === 'active'` this AY |
| `referrals-followup-missed` | `CounsellingReferral.followUpStatus === 'missed'` older than 7d |

Test: `__tests__/student-situations.test.ts` — one seeded fixture per detector,
plus fingerprint stability across runs.

### T4 — `mentor-scope.ts` (new, non-obvious)
`applyAuthScope` handles `departmentOnly` and `selfOnly`, but a **mentor seeing
their mentees** is neither — it's a join through `MentorAssignment`. New helper:

```ts
export async function mentorMenteeIds(collegeId, personId): Promise<string[] | null>
// null → caller is not a mentor; apply the normal authScope path instead
```

Resolve `Faculty` from `req.personId`, then
`MentorAssignment.find({ collegeId, mentorId, status: 'active' })`. Callers
intersect with the `applyAuthScope` filter — HOD gets branch scope, mentor gets
mentee scope, principal gets everything. Test both the intersection and the
"faculty who mentors nobody" empty case.

### T5 — `service.ts` + `controller.ts` + `routes.ts` (no LLM yet)
`handleRiskScores`, `handleSituations`, `handleDismissSituation` — the same
signatures as their finance counterparts minus the LLM branch. Reuse
`ai-feature-cache` with new key prefixes (`juvi:ai:people-risk:…`,
`juvi:ai:people-situations:…`), TTL to midnight UTC.

### T6 — persist to `DropoutRiskAlert`
**Upsert, don't append.** `DropoutRiskAlert` has no natural key today and
`createDropoutRiskAlert` (`welfare/dropout-service.ts:56`) is unconditional
create — running the scorer nightly would generate one alert per student per
run. Upsert on `{ collegeId, studentId, status: 'active' }`, overwrite
`riskScore` + `signals`, leave `outreachAttempts` / `assignedTo` / `mentorId`
untouched. Never touch a row whose status is `resolved_*` or `false_positive` —
that's a human's decision and the scorer must not relitigate it.

Add the compound index `{ collegeId: 1, studentId: 1, status: 1 }`.
**Gotcha:** Mongoose does not rebuild changed indexes on an existing collection
— drop/recreate manually in dev.

### T7 — FE panel
`admin-portal/src/pages/people/StudentsPage.tsx` (or the People hub) gains an
**At Risk** panel + a **Situations** strip, lifted from
`admin-portal/src/pages/finance/FeeDashboardPage.tsx` — risk badge, hover
popover with the factor breakdown, dismiss button. New service file
`admin-portal/src/services/people-agent.ts` mirroring `services/finance-agent.ts`.

Accessible queries only (`getByRole`, `getByTestId`) per the e2e discipline note.

**Phase 1 estimate: 5-6 days. Zero LLM spend. Ships standalone and is
independently useful** — the mentor triage list, the section cliff card, and
the DropoutRiskAlert rows all work with no API key configured.

---

## 6. Phase 2 — the LLM layer

### T8 — `prompts.ts` + narration
Mirror `finance-agent/prompts.ts`: `systemPrefix(ctx)`,
`buildStudentRiskNarrativeMessages`, `buildStudentSituationsMessages`.
Opt-in narrative on `/risk-scores` (same `includeNarrative` flag as finance),
always-on short narration on `/situations`.

Mask via `shared/llm/pii.ts` before the call, `unmaskText` after. Strict JSON
parse with a `deterministicFallback()` — the finance pattern. Cached daily.

### T9 — outreach drafts + approve (HITL)
Direct copy of `handleReminderDrafts` / `handleApproveDrafts`
(`service.ts:791` / `:933`), including the bounded-concurrency draft loop and
the cross-college validation on approve.

**Fix the two bugs while copying, don't inherit them.** `service.ts:963-969`
hardcodes `channel: 'sms'` and `dueAmount: 0` even though the draft carries
language + tone and the guardian record carries a channel preference. The
People version reads channel from the guardian, and carries the drafted
language through to the queued job.

Approve writes an `outreachAttempts[]` entry on the `DropoutRiskAlert` and
enqueues via `addJob`. Which means:

### T10 — real delivery (or an explicit stub banner)
`workers/_stub-delivery.ts` logs and flips `deliveryStatus` to `'delivered'`.
Nothing is sent. The HITL loop is the only write path the agent has and its
last mile is a `console.log`.

Either wire one real provider, or make the UI say "queued (delivery stubbed)"
so nobody believes a parent was contacted. **Do not ship T9 without one of the
two.**

**Phase 2 estimate: 3-4 days.**

---

## 7. Phase 3 — close the loop

### T11 — `GET /outreach-status`
Pure aggregation over `DropoutRiskAlert.outreachAttempts` + `ParentMeeting`:
alerts raised / contacted / meetings held / recovered (crossed back above the
threshold) / unactioned >14d, grouped by mentor. No AI.

This is what makes the feature survive past month two. Without it, alerts get
raised and quietly ignored, and the whole thing reads as noise by week 6.

**Phase 3 estimate: 1 day.**

---

## 8. Cross-cutting decisions to settle in the spec (GATE 1)

1. **Weight tuning.** The §5 T1 weights are a guess. They need to be
   config-per-college (a `RiskWeightProfile` doc) or at minimum env-tunable,
   validated against one real cohort's actual outcomes. Shipping hardcoded
   national defaults to every tenant is the thing that makes the scores
   ignorable. `welfare/CCDThreshold.ts` already exists and may be the right
   home — check before adding a model.
2. **Detention threshold source.** Hardcoded 75%, or read from the regulation /
   `AcademicCalendar`? Varies by university.
3. **Cadence.** On-demand only (like finance), or a nightly BullMQ job that
   refreshes `DropoutRiskAlert`? Nightly is what makes the mentor's Monday
   list exist without someone clicking Refresh — but it's the first
   *unattended* AI spend in the product, so it needs the Phase 0 gate landed.
4. **`weeklyInr = 0` semantics** (P0-3).
5. **Notification.** Does a new high-tier alert push to the mentor, or only
   appear in-app? Out of scope for this plan; needs the comms module.

## 9. Explicitly out of scope

- **Tool-calling on chat.** `claude-adapter.ts:extractText()` drops `tool_use`
  blocks. Until that changes, "chat" answers questions only about the one
  pre-baked bundle in `finance-agent/context.ts`. Making the Principal's
  free-text query work across People data is a separate, larger piece of work —
  it is the right *next* thing, but it is not this plan.
- **Retrieval / `JuviKnowledgeBase`.** Has a Mongo text index that nothing
  queries. Cheapest genuinely-new capability available, unrelated to this.
- **The legacy Juvi CRUD module** (8 models, ~40 endpoints, 8 portal pages,
  written to by `seed.ts` and nothing else). Decide separately.

## 10. Sequence summary

```
P0 (1d)  spend gate into createLLMClient · placeholder-key guard · limit default
   ↓     ships alone, unblocks all future AI features
P1 (6d)  scorer · context · situations · mentor-scope · routes · DropoutRiskAlert · FE
   ↓     ships alone, zero LLM spend, ~70% of the value
P2 (4d)  narration · outreach drafts · approve · real delivery
   ↓
P3 (1d)  outreach-status dashboard
```

~12 working days. Phases 1 and 2 are independently shippable; P0 is not
optional before P2.

For the full SDD treatment (spec.md with ACs, GATE 2 validators, tasks.md),
run `/sdd-team` against this plan — complexity reads as ~5, so the standard
3-teammate team applies.

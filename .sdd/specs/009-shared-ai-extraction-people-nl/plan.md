# 009 — Shared AI Extraction + People NL Queries

**Date:** 2026-09-11
**Branch suggestion:** `feat/shared-ai-people-nl` off `main` (after #89 merges)
**Parents:** `docs/ROADMAP_TO_DEMO.md` §3 (the extraction design), §2.1 (the People
question list), §1.6 (NL report coverage); `.sdd/specs/008-people-risk-agent/plan.md`
(what already shipped). This plan is self-contained — a fresh session should not need
to re-derive anything, but the parents carry the full rationale.

---

## 0. Context for a fresh session

Two AI agents exist and work:

- **finance-agent** (`backend/src/modules/juvi/finance-agent/`, ~4,200 LOC): the full
  feature set — SSE chat (`POST /api/juvi/finance/query`), forecast narrative,
  risk scores, situations + dismiss, HITL reminder drafts/approve. Its UI is
  `admin-portal/src/pages/finance/FeeDashboardPage.tsx` — **2,908 lines, eleven
  components inline**.
- **people-agent** (`backend/src/modules/juvi/people-agent/`, ~770 LOC, shipped in 008
  / PR #89): narrations, outreach drafts/approve. Its UI is
  `admin-portal/src/pages/welfare/StudentRiskPage.tsx` (~540 lines, hand-rolled,
  deliberately board-shaped not chart-shaped).

The user-visible goal of 009: **give People the finance-style AI experience** — above
all the command bar ("Which mentor has the most P1 students?") — without copying the
2,908-line file or the finance LLM stack. The structural goal: do the extraction the
roadmap calls priority #1 *while finance is still the only full implementation*,
because after a second hand-written copy exists the reconciliation cost roughly
triples (ROADMAP §3.1).

### What ROADMAP §3 assumed that 008 already fixed — do not redo these

| Roadmap claim (Aug 31) | Current reality (verify, then skip) |
|---|---|
| Spend gate outside the client; three features spend unmetered (§1.9, §3.4) | 008 moved `assertWithinSpendLimit` **into** `createLLMClient` (`finance-agent/llm-client.ts:2`) |
| No boot-time key validation; placeholder key fails silently | 008 added the placeholder-prefix guard (`llm-client.ts:152,179`) |
| `ai-feature-cache.ts` hardcodes three `juvi:ai:*` builders | 008 added the generic namespaced `aiCacheKey()` (`shared/cache/ai-feature-cache.ts:49`); the three finance-specific builders remain as thin callers |
| No second module exists yet | people-agent exists and already imports the finance llm-client across module boundaries — the import path is the debt |

The remaining §3.4 claim to verify early: **pricing keyed by provider, not model**
(silently misprices on model swap, corrupting the spend gate). Check
`finance-agent/llm-client.ts` / wherever the pricing table lives; if still
provider-keyed, T2 fixes it.

---

## 1. Goal

1. `backend/src/shared/ai/` owns the LLM stack; `finance-agent/` and `people-agent/`
   import from it. Finance's 28 test files stay green throughout — they are the
   refactor's safety net.
2. `admin-portal/src/components/agent/` owns the dashboard building blocks;
   `FeeDashboardPage.tsx` is rebuilt on them and shrinks accordingly.
3. **People gets the command bar**: `POST /api/juvi/people/query` (SSE), answering the
   §2.1 question list from a deterministic context bundle, rendered by the same
   `CommandBar` component finance uses.
4. The cohort view — the one unbuilt widget from ROADMAP §2.1 (first-generation /
   hostel / quota cuts of the risk board) — ships on the extracted components.

Same architectural rule as 007/008: **every number is computed server-side; the LLM
only narrates, maps, and drafts.**

---

## 2. Where it lives

```
backend/src/shared/ai/
  llm/
    client.ts            # createLLMClient — moved from finance-agent/llm-client.ts
    claude-adapter.ts    # moved
    openai-adapter.ts    # moved
    pricing.ts           # model-keyed table (T2)
  sse.ts                 # the SSE write/error/flush pattern from finance controller.ts:100-…
  helpers.ts             # moved from finance-agent/orchestrator-helpers.ts

admin-portal/src/components/agent/
  SituationCards.tsx     # extracted from FeeDashboardPage.tsx:1603
  ScoreBoard.tsx         # extracted from :595 (DefaulterCard)
  ScorePopover.tsx       # extracted from :494 (RiskHoverPopover)
  ForecastBanner.tsx     # extracted from :321 (AIForecastBanner)
  CommandBar.tsx         # extracted from :890 — SSE chat input + transcript
  states.tsx             # LoadingBanner / ErrorBanner / Skeleton / delayed empty-state
  useAgent.ts            # react-query hooks parameterised by module key
admin-portal/src/services/agent.ts   # generic client; the SSE parser lives here once

backend/src/modules/juvi/people-agent/   # gains query-context.ts + /query route
```

**Deliberate deviation from ROADMAP §3.2 — deferred, not rejected:** the full
`AgentModuleDef` registry + single `/api/agent/:module/*` router + generic
`orchestrator.ts` pipeline is designed for *eight* modules. With two, re-routing
working finance endpoints buys no user-visible value and risks the 28 green suites.
**Extract what the second consumer actually needs** (client, adapters, SSE, helpers,
FE components); build the registry when module #3 (Compliance, ROADMAP §2.2) starts,
reconciling two *convergent* implementations that already share every seam. If the
implementing session disagrees after reading the code, §3.2–§3.3 of the roadmap is the
full target design — but record the reversal in this file.

---

## 3. Reuse ledger

| Reused / moved unchanged | New |
|---|---|
| `finance-agent/llm-client.ts` (incl. 008 spend gate + placeholder guard) | `shared/ai/llm/pricing.ts` model-keyed table |
| `finance-agent/{claude,openai}-adapter.ts` | `shared/ai/sse.ts` |
| `finance-agent/orchestrator-helpers.ts` | `people-agent/query-context.ts` |
| `shared/llm/pii.ts`, `shared/cache/ai-feature-cache.ts` (`aiCacheKey`) | `components/agent/*` (extraction, not invention) |
| `platform/spend-limits/*`, `models/juvi/AgentAction.ts` | `admin-portal/src/services/agent.ts` |
| Finance `/query` prompt shape + strict-parse + fallback pattern | People query system prompt (~60 LOC) |
| `ccd-dashboard-service.ts` aggregations (008) | Cohort-cut aggregation (T9) |

**No new models.**

---

## 4. Phase A — backend extraction (finance tests are the gate)

### T1 — move the LLM stack
`git mv` `llm-client.ts`, `claude-adapter.ts`, `openai-adapter.ts`,
`orchestrator-helpers.ts` from `finance-agent/` to `shared/ai/` (layout in §2); fix
imports in `finance-agent/*` and `people-agent/*`. Pure move — zero behaviour change.
**Gate: `npx vitest run src/modules/juvi` green with no test edits.**

### T2 — model-keyed pricing
Re-key the pricing table by model id, not provider. Unknown model → throw at client
construction, not silent ₹0 (the current failure mode corrupts the spend ledger the
gate reads). One test: known model prices, unknown model throws.

### T3 — extract the SSE pattern
Finance `controller.ts:100-…` owns the only SSE implementation (headers,
`X-Accel-Buffering: no`, `event: error` on mid-stream failure). Lift into
`shared/ai/sse.ts` as a small helper the controller calls; finance behaviour
byte-identical. The People `/query` controller (T6) is its second caller — do not
write SSE twice.

### T4 — re-point the other three LLM consumers
ROADMAP §3.6 row 3: NL-reports (`governance/nl-reports/service.ts`), config-suggest,
lead-scoring. Verify each constructs its client via the moved `createLLMClient` (and
is therefore spend-gated since 008); re-point imports. If any builds its own client,
that is the unmetered-spend gap — close it here.

---

## 5. Phase B — frontend extraction (finance rebuilt, pixel-conservative)

### T5 — extract components, rebuild FeeDashboardPage
Extract the components listed in §2 at the cited line numbers, plus `states.tsx`
(the five render states documented in `STATE_OF_BUILD.md` §B.6: loading skeleton /
populated / delayed empty / inline error+retry / stale-cache banner) and `useAgent.ts`.
Rebuild `FeeDashboardPage.tsx` as composition; target well under 1,000 lines. The SSE
parser moves to `services/agent.ts` — one copy.

**Verification is visual + e2e, not unit:** run the existing Playwright finance specs;
then click through the fee dashboard against seeded data. No intentional pixel
changes — this is a refactor, resist improving the UI in the same PR.

**StudentRiskPage adopts `states.tsx` only** (its widgets are board-shaped, not
finance-shaped; forcing them into `ScoreBoard` is negative work).

---

## 6. Phase C — People NL queries (the user-visible payoff)

### T6 — `POST /api/juvi/people/query` (SSE)
Mirror finance's `/query` end to end: validation (`prompt` + optional conversation
continuation, see `finance-agent/validation.ts:14`), PII-mask the question, build the
context bundle, stream via `shared/ai/sse.ts`, write one `AgentAction`, spend-gated by
construction. `authorize('welfare','read')` — same RBAC posture as 008: the auth
module is welfare, only the LLM layer lives under juvi.

### T7 — `people-agent/query-context.ts`
The deterministic bundle the model answers *from* (it answers from context, it does
not query the DB — same contract as finance). Assemble from existing 008
aggregations, **respecting `authScope` + mentor scope** so a mentor's answers cover
only their mentees:

- `getRiskBoard()` rows (top 50 by score) — includes priority, sources, mentor, days
  open, per-student signal types
- `getSignalsBySource(30)` and `getMentorWorkload()`
- `getOutreachEffectiveness(90)`
- Branch/year/first-gen/hostel flags per board row (needed for the §2.1 cross-cut
  questions — extend the board row or join here, whichever is smaller)

Cap the serialized bundle (~8-12k tokens); state the cap in the system prompt so the
model says "top 50 by score" rather than implying completeness.

### T8 — system prompt + honesty rules
~60 LOC mirroring finance's prompt discipline: answer only from the bundle; every
number quoted must appear in the bundle verbatim; if the question needs data outside
the bundle (fees ledger, individual counselling notes), say so and name the screen
that has it. Target the four §2.1 questions as the acceptance set:
1. "Which CSE second-years have both a fee signal and an attendance signal?"
2. "Who did we flag last month that nobody has contacted?"
3. "Which mentor has the most P1 students?"
4. "Show me first-generation students whose risk went up this week."
(#4 needs score deltas — `RiskScoreSnapshot` comparison in the bundle, 008 writes
them.) Unit-test the context builder per scope (dean vs mentor vs HOD); test the
prompt-shape like 008's `prompts.test.ts`.

**FE:** mount the extracted `CommandBar` on StudentRiskPage pointed at
`/api/juvi/people/query`. Suggested-question chips = the four above.

---

## 7. Phase D — cohort view widget

### T9 — cohort cuts
One aggregation in `ccd-dashboard-service.ts` (same file as the 008 reads): open
alerts and average score cut by first-generation / hostel-resident / quota / branch.
One endpoint, one widget on StudentRiskPage (a small breakdown table/bars — reuse
`states.tsx`; no chart library). Pure aggregation, no AI. This closes the last row of
ROADMAP §2.1's widget table.

---

## 8. Explicitly out of scope

- **Tool-calling / free-text chat that queries the DB.** `claude-adapter.ts`
  `extractText()` (line 110) drops `tool_use` blocks; the whole product's chat
  answers from pre-baked bundles. Changing that is its own feature with its own
  safety story. (Carried from 008 §10.)
- **The `AgentModuleDef` registry + `/api/agent/:module/*` router** — deferred to
  module #3 (see §2 deviation note).
- **Governance NL-report coverage** (ROADMAP §1.6: `ALLOWED_REPORTS` at
  `nl-reports/prompt.ts:25-31` exposes 5 of 14 codes). Different surface (report
  routing, not agent chat), 2 days, no dependency on this plan — do it whenever, but
  not in this branch. Note it depends on §1.2 (report runners) landing first.
- Compliance/Academics/Placement dashboards (ROADMAP §2.2-2.5) — they are what the
  extraction makes cheap, not part of it.
- Any new delivery channel; outreach honesty stays `recorded_not_sent`.

---

## 9. Decisions to settle before implementation (GATE 1)

1. **Pricing table migration** — confirm current keying (T2's premise) before
   estimating; if 008 already model-keyed it, T2 collapses to a test.
2. **Bundle recency for #4** — "risk went up this week" needs this-week vs last-week
   snapshot deltas in the bundle. Per-student pair of snapshots (larger bundle) or a
   precomputed `delta7d` per board row (recommended — one aggregation, ~no tokens)?
3. **FeeDashboardPage rebuild depth** — full rebuild-on-components (roadmap's 4-day
   line) vs extract-only-the-five-components-and-leave-the-rest. Recommend full: half
   measures leave two copies of the render states, which is the bug this plan exists
   to prevent.
4. **Does StudentRiskPage's narration/draft UI (008) migrate to `useAgent.ts`?**
   Recommend yes if free during T5, skip if it drags — it is 3 endpoints, not a
   divergent design.

---

## 10. Sequence

```
A (T1-T4)  backend extraction · pricing · SSE · re-point consumers      ~4d
   ↓       finance suites green after every task — commit-sized moves
B (T5)     FE components · FeeDashboardPage rebuilt · states.tsx        ~4d
   ↓       finance e2e + manual click-through
C (T6-T8)  people /query SSE · context bundle · prompt · CommandBar     ~3d
   ↓       the four §2.1 questions answer correctly per role scope
D (T9)     cohort view                                                  ~1d
```

**~12 days.** Roadmap's §3.6 said 11 for extraction alone; this buys the extraction
*plus* the People command bar and the last §2.1 widget, because 008 already paid for
the spend gate, cache namespacing, and the second consumer.

A + B are pure refactor (demo unchanged, risk contained by finance's tests).
C is the first user-visible "finance-style AI in People" moment — if time is short,
C can ship before B by calling the SSE service directly from a hand-rolled input on
StudentRiskPage, then swap in `CommandBar` when B lands. D is independent.

---

## 11. Implementation log (2026-09-11, branch `feat/shared-ai-people-nl`)

All four phases shipped. Deviations from the plan above, recorded per §2:

- **T1 test edits.** `vi.mock('../llm-client')` is path-bound, so every mock and
  import of the moved files was re-pointed (mechanical, no assertion changed).
  `llm-client.test.ts` moved with the code to `shared/ai/llm/__tests__/client.test.ts`.
- **T2 confirmed provider-keyed** and fixed: `shared/ai/llm/pricing.ts` is a
  model-keyed table with longest-prefix lookup (dated snapshots such as
  `gpt-4o-mini-2024-07-18` price as their base). Unknown model → 503 at
  `createLLMClient()`; `computeCostInr(model, …)` replaces `(provider, …)`.
- **T3** `shared/ai/sse.ts` also converts a mid-stream throw into `event: error`
  (finance previously dropped the socket after headers were flushed).
- **T4** NL-reports, config-suggest and lead-scoring were all unmetered; each now
  passes an `LLMCallContext` (new `AgentAction` types `nl-report`,
  `config-suggest`, `lead-score`). `computeLLMScore` takes `ctx` as a required
  second argument so the omission cannot recur.
- **Chat orchestration extracted too** (`shared/ai/chat.ts` `runAgentChat`):
  finance `handleChat` and people `handleQuery` differ only in bundle, prompt
  and audit type. The prompt is now masked together with the bundle.
  `AgentConversation.agent` (`'finance' | 'people'`, default finance) namespaces
  threads — a field, not a model.
- **Mount path** is `POST /api/juvi/people-agent/query` (the existing router
  prefix), not `/api/juvi/people/query`.
- **First-generation** has no student-level field; it is derived from the CCD
  engine's own signal data (`triggerData.isFirstGen` / `firstGenModifier`).
  Year of study = highest pinned year, else year at admission.
- **FE names**: `ScoreCard.tsx` holds `DefaulterCard` (plan said ScoreBoard);
  `states.tsx` = LoadingBanner · ErrorBanner · InlineRetry · useDelayedEmpty ·
  Toast. `useAgent.ts` = query keys + hooks + `forceInto`/`useForceRefresh`.
  Finance-only pieces went to `components/finance/{DashboardWidgets,ReminderDraftsPanel}.tsx`.
  The SSE parser lives once in `services/agent.ts` and now builds its URL from
  the axios base, so a `VITE_API_URL` build reaches the same host.
- **Rules-of-hooks bug fixed** in the situations panel (early `degraded` return
  before hooks). Three amber "unavailable · Retry" strips became one
  `InlineRetry` — sub-pixel icon alignment differs in the forecast error state.
- **Decision 4**: the 008 narration/draft endpoints have no FE surface yet, so
  nothing migrated to `useAgent.ts`.
- **Verification**: backend 35 vitest files green in isolation (the full-suite
  run times out unrelated files under mongodb-memory-server contention — same
  as the pre-change baseline); finance HTTP e2e 36/36; portal typecheck, unit
  (154) and production build green; new Playwright specs `student-risk.spec.ts`
  (3) and `fee-dashboard.spec.ts` (1) green; the four §2.1 questions answered
  live from the bundle via gpt-4o-mini (~₹0.01 each).

### 11.1 Follow-on (same day): the People AI surface, finished in place

Decision: no separate "People AI dashboard". The engine, the alerts and the
`welfare:read` permission all live in M06, so the AI surface stays on
`/welfare/student-risk` and People links to it. Built, in value order:

1. **Narration on risk cards** — one batched `POST /people-agent/narrations` for
   the top 25 rows per board load; the server now caches per (alert, score) for
   the day via `aiCacheKey('narration', …)`, so a re-load or a second user costs
   nothing (measured: 15 ms cache hit).
2. **Outreach drafts panel** — `components/welfare/OutreachDraftsPanel.tsx`,
   opened per student from the breakdown modal ("Draft outreach") or for all P1
   from the header. Approving records the outreach on the alert and repeats the
   server's `deliveryNote`: nothing is sent, no provider is configured.
   The finance reminder panel and this one share `components/agent/DraftsPanel.tsx`
   (shell, card, `useDraftReview`); `ReminderDraftsPanel.tsx` shrank to its
   finance-specific header, pills and approve semantics.
3. **Student detail risk block** — `components/welfare/StudentRiskBlock.tsx` on
   the Profile tab: engine score + priority, the agent sentence, active signals,
   90-day score bars (inline, no chart lib), link to the board. Renders nothing
   on 403/404 so a Registrar without `welfare` sees the profile unchanged.
4. **People hub card** → `/welfare/student-risk`.

Playwright: `student-risk.spec.ts` E4/E5, `fee-dashboard.spec.ts` F2 (drafts
panel on the shared shell), `people-detail.spec.ts` P4. Note the dev backend's
login limiter (10 / 15 min, bypassed only with `E2E_TESTING=1`) trips when the
suite is run repeatedly against the dev server.

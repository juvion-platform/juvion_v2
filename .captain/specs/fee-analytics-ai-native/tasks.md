# Tasks: Fee Collection Dashboard — AI-Native Upgrade

**Spec:** `./spec.md` · **Plan:** `./plan.md` · **Created:** 2026-04-22
**Total tasks:** 11 (10 Code, 1 Doc)

---

## Task DAG

```
                            ┌──── A1 LLM provider abstraction + PII masker + SDK installs
                            │       (env switch, adapters, token mask/unmask, tests)
Foundation   ───────────────┤
(parallel)                  ├──── A2 New Mongoose models
                            │       (AgentConversation, AgentAction, SituationDismissal)
                            │
                            └──── A3 Deterministic helpers (no LLM)
                                   ├─ risk-scorer.ts (rule-based 0–100)
                                   ├─ forecast.ts    (Holt-Winters)
                                   └─ situation-candidates.ts (8 heuristics)

                                   │
                                   ▼ (after A1+A2+A3)
            ┌───────── A4 finance-agent service + orchestrator + prompts
            │          (reads LLM client, assembles context, masks, validates JSON)
            │
            ▼
        ┌── A5 HTTP API — 7 endpoints (streaming /query, 6 POSTs) ── ◄── A4
        │
        ▼
    ┌── A6 Chat bar wiring — replace stubAiReply with streaming fetch
    │   + SSE reader + conversationId persistence
    │
    ├── A7 Forecast narrative integration — ForecastBanner upgrade
    │   (Holt-Winters call + LLM narrative + confidence band viz)
    │
    ├── A8 Risk score + narrative integration — defaulter cards
    │   (sort by risk, factor-breakdown tooltip, opt-in LLM narrative)
    │
    ├── A9 Situation cards — new component above defaulter list
    │   (fetch, render, dismiss with snooze, action buttons)
    │
    └── A10 Reminder drafts side panel
           (side-drawer, per-student approve/edit/skip, bulk approve)

                                    │
                                    ▼
                        A11 API docs + QA checklist + demo script ◄── all
```

### Parallelism opportunities

- **Foundation (A1 · A2 · A3):** 3 fully parallel; no cross-deps.
- **Frontend integrations (A6 · A7 · A8 · A9 · A10):** all 5 parallel after A5 lands.

### Front-loaded risks

- **A1 (PII masker) is the load-bearing single point of failure.** Getting mask/unmask semantics right is non-negotiable. Comprehensive tests + spot-check-raw-vs-masked in all downstream calls.
- **A5 (SSE endpoint)** introduces a new streaming pattern to the backend. May need a Vite proxy tweak (OQ-P1 in plan).

---

## Task List

| # | Task | Type | Depends On | Tests target | Status |
|---|---|---|---|---:|---|
| A1 | LLM provider abstraction + PII masker + SDK installs | Code | — | 25+ | Refactored |
| A2 | New Mongoose models (AgentConversation, AgentAction, SituationDismissal) | Code | — | 12+ | Ready |
| A3 | Deterministic helpers (risk-scorer, forecast, situation-candidates) | Code | — | 20+ | Refactored |
| A4 | finance-agent service orchestrator + prompts + Zod output validation | Code | 1, 2, 3 | 15+ | Refactored |
| A5 | HTTP API — 7 endpoints (streaming /query + 6 POSTs) + rate-limit + Zod | Code | 4 | 20+ (e2e) | Refactored |
| A6 | Chat bar wiring — streaming fetch + conversationId + cancel semantics | Code | 5 | build-clean | Refactored |
| A7 | Forecast narrative — ForecastBanner shows band + AI driver text | Code | 5 | build-clean | Pending |
| A8 | Risk scores — defaulter card sort + factor tooltip + lazy narrative | Code | 5 | build-clean | Pending |
| A9 | Situation cards — fetch, render above defaulter list, dismiss + snooze | Code | 5 | build-clean | Refactored |
| A10 | Reminder drafts side panel — per-student + bulk approve + recall | Code | 5 | build-clean | Refactored |
| A11 | API docs + QA checklist + manual demo script | Doc | 5, 10 | — | Done |

---

## Task Details

---

### Task A1: LLM provider abstraction + PII masker
**Type:** Code → captain-tdd
**Status:** Refactored · **Depends on:** — · **Tests:** 35 (target was 25+)

**Acceptance Criteria:**

- Install SDKs: `@anthropic-ai/sdk@^0.30.0`, `openai@^4.60.0`
- Create `backend/src/modules/juvi/finance-agent/llm-client.ts` exporting:
  ```ts
  export type LLMProvider = 'claude' | 'openai';
  export interface LLMClient {
    complete(messages, opts?): Promise<LLMResponse>;
    stream(messages, opts?): AsyncIterable<{ delta: string; done: boolean; final?: LLMResponse }>;
  }
  export function createLLMClient(provider?: LLMProvider): LLMClient;
  ```
- Two adapters: `claude-adapter.ts`, `openai-adapter.ts` — both implement `LLMClient`
- `createLLMClient()` reads `LLM_PROVIDER` env (`claude` | `openai`); falls back to `claude` if unset
- `LLM_MODEL` env override; defaults: `claude-sonnet-4-5` / `gpt-4o-mini`
- Missing API key for active provider → `createLLMClient` throws `AppError(503, 'LLM provider misconfigured: ANTHROPIC_API_KEY missing')`
- Cost computation: per-token pricing hardcoded (current rates), configurable `LLM_INR_RATE` env (default 85.0) → returns `costInr: number` on response
- Create `backend/src/modules/juvi/finance-agent/pii.ts`:
  - `maskPII(input: object | array): { masked: any; tokenMap: Record<string, string> }`
  - `unmaskText(text: string, tokenMap: Record<string, string>): string`
- Masked fields per spec: `phone, email, guardian.name, guardian.phone, guardian.email, address, aadhaar, pan, dob`
- Not masked: `rollNumber, programme, branch, batch, escalationStage, amounts, dates`
- Tokens format `{category_ordinal}`; ordinals reset per `maskPII` call
- Deep traversal: handles nested objects + arrays; preserves unmasked fields unchanged

**Tests (25+):**

Provider abstraction (10):
- `createLLMClient('claude')` returns claude adapter when ANTHROPIC_API_KEY set
- `createLLMClient('openai')` returns openai adapter when OPENAI_API_KEY set
- Missing API key throws 503 AppError
- `LLM_PROVIDER` env env determines default; invalid value falls back to claude
- `LLM_MODEL` env override respected
- `complete()` returns `{ text, inputTokens, outputTokens, model, provider, costInr }`
- Cost computation: claude `in * 3 / 1M * INR_RATE` + `out * 15 / 1M * INR_RATE` (example rates — adjust to current)
- Cost computation: openai GPT-4o-mini rates
- `stream()` yields deltas + final chunk with usage
- Abort signal cancels in-flight request

PII masker (15):
- Masks `phone` at top level
- Masks `guardian.phone` at nested level
- Masks `guardian.email`, `guardian.name`
- Does NOT mask `rollNumber`
- Does NOT mask `programme`, `branch`, `batch`, `amount`, `dueDate`
- Array of students: each student's PII masked, ordinals increment across array
- Round-trip: `unmaskText(llmResponse, tokenMap)` restores all tokens
- Unknown token in LLM response: passes through literal + logs warning
- Same value appearing twice in input: same token reused
- Masking the same input twice in one request gives stable ordinals; new request → new ordinals
- Nested arrays handled (e.g., `students[0].guardians[1].phone`)
- Null values preserved (don't mask nulls)
- Empty string preserved
- `maskPII({})` returns `{ masked: {}, tokenMap: {} }`
- Large payload (100 students): finishes < 50ms

**Verification:**
- `npm test -w backend -- llm-client pii` all green
- `npm run typecheck -w backend` 0 errors

---

### Task A2: New Mongoose models
**Type:** Code → captain-tdd
**Status:** Pending · **Depends on:** — · **Tests:** 12+

**Acceptance Criteria:**

Create three models at `backend/src/models/juvi/`:

- `AgentConversation.ts` per plan §2.1 shape
- `AgentAction.ts` per plan §2.1 shape
- `SituationDismissal.ts` per plan §2.1 shape

All with `collegeId` required + compound indexes per plan §2.2.

**Tests (12):**
- Each model creates valid doc with minimum fields
- Each rejects if `collegeId` missing
- AgentConversation: `turns` array accepts multiple turns
- AgentConversation: `lastProvider` enum validation (`claude` | `openai`)
- AgentAction: `type` enum includes all 7 values
- AgentAction: `reverted` optional sub-doc structure
- SituationDismissal: `situationFingerprint` + `snoozedUntil` required
- Index present: AgentConversation `{ collegeId:1, userId:1, updatedAt:-1 }`
- Index present: AgentAction `{ collegeId:1, createdAt:-1 }`
- Index present: AgentAction `{ userId:1, createdAt:-1 }`
- Index present: SituationDismissal `{ collegeId:1, userId:1, snoozedUntil:1 }`
- Cross-college isolation via collegeId (write under college A, read under B returns nothing)

---

### Task A3: Deterministic helpers (no LLM)
**Type:** Code → captain-tdd
**Status:** Pending · **Depends on:** — · **Tests:** 20+

**Acceptance Criteria:**

Three pure-function modules under `backend/src/modules/juvi/finance-agent/`:

#### risk-scorer.ts
```ts
export interface RiskFeatures {
  daysOverdue: number;
  reminderResponseRate: number;         // 0-1; reminders acknowledged / sent
  paymentCadenceVariance: number;       // stddev of interpayment gap in days
  guardianIncomeBandDropFlag: boolean;
  siblingOnTimeFlag: boolean;
  stageAdvanceVelocityDays: number;     // avg days between stage advances
  welfareReferralActive: boolean;
  autoEscalationPaused: boolean;
}
export interface RiskScore {
  score: number;          // 0-100
  factors: Array<{ name: string; weight: number; value: number | boolean }>;
  tier: 'low' | 'medium' | 'high' | 'critical';
}
export function computeRiskScore(f: RiskFeatures): RiskScore;
export async function assembleFeatures(collegeId: string, studentId: string): Promise<RiskFeatures>;
```

Scoring algorithm (transparent, document every weight):
- `daysOverdue`: `0 → 0`, `7d → 10`, `14d → 25`, `30d → 40`, `60d → 55`, `90d+ → 65` (piecewise)
- `reminderResponseRate < 0.3`: `+15`
- `paymentCadenceVariance > 20`: `+10`
- `guardianIncomeBandDropFlag`: `+10`
- `siblingOnTimeFlag`: `-6`
- `welfareReferralActive`: `+5` (more attention needed)
- `autoEscalationPaused`: `-30` (officer already handled)
- Clamp to `[0, 100]`
- Tiers: `>= 70 critical`, `40-69 high` vs `medium` vs `low`

Insufficient data: if `daysOverdue` is unknown, return `{ score: null, factors: [], tier: 'insufficient-data' }`.

#### forecast.ts
```ts
export interface ForecastBand {
  lower: number; mean: number; upper: number;
  confidence: number;                   // 0-1
  daysInWindow: number;
}
export async function forecastMonthEnd(
  collegeId: string,
  monthAnchor: Date,
  historyDays?: number,                 // default 180
): Promise<ForecastBand>;
```

Holt-Winters additive (seasonality = 7 days, `alpha=0.3, beta=0.1, gamma=0.1`):
- Query daily collection sums for last 180 days
- Fit model; project to end-of-month; return mean + 80% prediction interval as `lower/upper`
- If < 30 days of data: fall back to simple linear trend; confidence = 0.5
- Implementation: no deps; pure TS arithmetic (~80 LOC)

#### situation-candidates.ts
```ts
export interface SituationCandidate {
  id: string;
  kind: string;                         // e.g., 'partial-payment-stale'
  severity: 'low' | 'medium' | 'high';
  narrativeContext: Record<string, any>;
  studentIds: string[];
  fingerprint: string;                  // stable hash for dismissal matching
}
export async function gatherCandidates(collegeId: string): Promise<SituationCandidate[]>;
```

Eight heuristics (each independently toggleable):
1. `partial-payment-stale` — students with partial payments > 15 days old
2. `concession-spike` — concessions created in last 7d > 2× trailing 30d average
3. `holds-without-review` — holds in `pending_approval` > 48h
4. `welfare-referrals-unactioned` — DefaulterRecord `welfareReferralStatus='pending'` > 7d
5. `stage4-transitions-today` — cron advanced >= 3 students to stage_4 today
6. `payment-mode-anomaly` — UPI share dropped > 20% vs trailing 7d
7. `holds-waived-without-reason` — waives with trivial reason strings (`< 10 chars`)
8. `near-miss-target` — MTD collection on track for < 80% of monthly target

**Tests (20+):**

risk-scorer (8):
- Happy cases for each tier (low/medium/high/critical)
- `daysOverdue=0` → `score=0` baseline
- `daysOverdue=30` + `reminderResponseRate=0.1` → `high`
- Clamping at 100
- `autoEscalationPaused=true` subtracts 30
- Factors array includes every active factor with its weight
- Insufficient data returns `tier: 'insufficient-data'`
- `assembleFeatures` integration (with setupMongo fixture)

forecast (6):
- Happy path: 180 days of stable data → `mean` close to average, band width > 0
- 10 days of data → fallback linear trend; `confidence=0.5`
- No data → throws or returns zero-range band
- Upward trend detected: `mean > current daily average`
- Seasonality detected: Monday peaks propagated
- Empty payments in range → `mean = 0`, `confidence = 0`

situation-candidates (6):
- Each heuristic tested in isolation with a fixture that triggers it
- Dedup: two overlapping heuristics don't double-count the same student
- Fingerprint stability: same candidate across two runs has same fingerprint
- Fingerprint variance: different student sets → different fingerprint

**Verification:**
- `npm test -w backend -- risk-scorer forecast situation-candidates` green
- `npm run typecheck -w backend` 0 errors

---

### Task A4: finance-agent service + orchestrator + prompts
**Type:** Code → captain-tdd
**Status:** Pending · **Depends on:** A1, A2, A3 · **Tests:** 15+

**Acceptance Criteria:**

Create `backend/src/modules/juvi/finance-agent/service.ts` with public methods per endpoint:

```ts
export async function handleChat(
  collegeId, userId, prompt, conversationId?, context?, signal?
): AsyncIterable<SSEChunk>;

export async function handleForecastNarrative(collegeId, from, to): Promise<ForecastWithNarrative>;

export async function handleRiskScores(collegeId, studentIds, includeNarrative): Promise<RiskScoreResult[]>;

export async function handleSituations(collegeId, userId): Promise<Situation[]>;

export async function handleReminderDrafts(collegeId, studentIds): Promise<Draft[]>;

export async function handleApproveDrafts(collegeId, userId, drafts): Promise<ApprovalResult>;

export async function handleDismissSituation(collegeId, userId, situationId, snoozeDays, reason): Promise<void>;
```

Each method:
1. Asserts college-scope + user permissions
2. Assembles context via ContextAssembler (new file `context.ts`)
3. Invokes PIIMasker
4. Calls LLMClient (from A1)
5. Validates LLM output with Zod where structured
6. PIIUnmasker on output
7. Logs AgentAction entry
8. Returns result

Create `backend/src/modules/juvi/finance-agent/prompts.ts` with five template functions — each takes a masked context object + returns `LLMMessage[]`. Use template-string literals; system prefix shared.

Zod schemas for structured outputs:
- Situations: `z.array(z.object({ id, title, narrative, actions, severity, studentIds }))`
- Reminder drafts: `z.array(z.object({ studentId, language, tone, subject, body, predictedReadRate }))`

JSON validation failure → retry once with stricter system prompt → if still failing, fall back to rule-based output + log `[llm:json-fail]`.

**Tests (15+):**
- `handleChat`: calls mock LLMClient, yields SSE chunks, logs AgentAction on completion
- Prior conversation loaded (last 10 turns); new conversationId creates fresh
- Token budget guard: chat with > 8K prior tokens truncates oldest turns
- `handleForecastNarrative`: uses forecast.ts output + LLM narrative
- Fallback: LLM fail → `narrative: null`, projection still returned
- `handleRiskScores`: batch of 3 students; narrative off by default
- `handleRiskScores` with `includeNarrative=true`: LLM called N times with bounded concurrency
- `handleSituations`: candidates → LLM pick → Zod validate
- `handleSituations`: user's dismissals applied BEFORE sending to LLM (not after)
- `handleReminderDrafts`: per-student tone ladder rule
- `handleApproveDrafts`: creates FeeReminder docs + queues dispatch + logs AgentAction
- `handleDismissSituation`: upserts SituationDismissal with correct snoozedUntil
- College-scope enforcement: passing a studentId from a different college → 403
- PII leak check: AgentAction.maskedPrompt contains tokens, not raw PII (spot-check against all 7 endpoints)
- Rate-limit integration (passes through middleware)

**Verification:**
- `npm test -w backend -- finance-agent/service` green
- `npm run typecheck -w backend` 0 errors
- All full backend tests still green

---

### Task A5: HTTP API — 7 endpoints
**Type:** Code → captain-tdd
**Status:** Pending · **Depends on:** A4 · **Tests:** 20+ (e2e)

**Acceptance Criteria:**

Create new module `backend/src/modules/juvi/finance-agent/routes.ts` + `controller.ts` + `validation.ts`. Mount at `/api/juvi/finance-agent`.

7 endpoints per plan §1.9:
- POST `/query` — **streaming SSE** (text/event-stream)
- POST `/forecast-narrative`
- POST `/risk-scores`
- POST `/situations`
- POST `/reminder-drafts`
- POST `/reminder-drafts/approve`
- POST `/situations/:id/dismiss`

All behind `authenticate` + `authorize()` per plan. Per-endpoint rate-limit (per plan §1.9).

Zod schemas validate body + params.

**Streaming specifics:**
- `res.setHeader('Content-Type', 'text/event-stream')`
- `res.setHeader('Cache-Control', 'no-cache')`
- `res.setHeader('X-Accel-Buffering', 'no')` (nginx)
- `res.write(\`event: delta\\ndata: ${JSON.stringify({text})}\\n\\n\`)` per chunk
- `res.write(\`event: done\\ndata: ${JSON.stringify(final)}\\n\\n\`)` at end
- On `req.on('close')`: abort the LLMClient call via AbortController

**Tests (20+ e2e):**
- Each endpoint: 200 happy + 400 validation + 401 no-auth + 403 wrong-role + 429 rate-limit
- `/query` SSE: chunks yield sequentially, final event includes usage
- `/query` abort: client disconnect aborts upstream call (verify via spy on AbortController.abort)
- `/forecast-narrative`: returns band + narrative; narrative null on LLM fail (use mock LLM)
- `/risk-scores`: batch of 5 students; no narrative by default
- `/situations`: returns 3-5 situations; dismissed ones excluded
- `/reminder-drafts`: respects tone ladder
- `/reminder-drafts/approve`: creates FeeReminder docs; permission gated to `('finance','update')`
- `/situations/:id/dismiss`: upserts SituationDismissal
- Cross-college isolation (passing other college's IDs returns 403)

---

### Task A6: Chat bar wiring — streaming fetch
**Type:** Code → captain-tdd
**Status:** Pending · **Depends on:** A5 · **Tests:** build-clean

**Acceptance Criteria:**

Modify `admin-portal/src/pages/finance/FeeDashboardPage.tsx` AICommandBar:

- Replace `stubAiReply` with a `streamAgentReply(prompt, context, conversationId, abortSignal)` function
- Uses `fetch` with `Accept: text/event-stream` + `credentials: include`
- Reads `response.body.getReader()`, parses SSE events incrementally
- Appends each `event: delta` payload to the pending message's text (live typing effect)
- On `event: done`: stores final metadata (provider, model) in the message footer
- On `Esc` or unmount: abort via `AbortController`
- New `conversationId` persisted to `localStorage` per college

Frontend service: `admin-portal/src/services/finance-agent.ts` with `streamQuery()` function returning an async iterable.

Chat message footer line shows: `✦ claude · 1.8s · 523→147 tokens`.

**Verification:**
- `npm run build -w admin-portal` clean
- Manual smoke: send prompt → see streaming response → can cancel with Esc
- Dashboard still renders if LLM endpoint returns 503 (chat shows inline error, rest of page fine)

---

### Task A7: Forecast narrative in ForecastBanner
**Type:** Code → captain-tdd
**Status:** Pending · **Depends on:** A5 · **Tests:** build-clean

**Acceptance Criteria:**

- Update `AIForecastBanner` to:
  - Fetch `/forecast-narrative` on mount (React Query, cache 5min)
  - Show projection range as text: *"Likely ₹20.4L–21.2L (80% confidence)"*
  - Show narrative below: *"Drivers: ... · ..."* with `✦` prefix
  - If narrative is null (LLM down): hide narrative; keep projection
  - Chart beneath the banner: simple SVG range-line showing history + forecast band (7-day lookahead)

- New `admin-portal/src/services/finance-agent.ts` function `getForecastNarrative()`

**Verification:**
- `npm run build -w admin-portal` clean
- Manual: banner shows band + narrative; degraded path (mock LLM off) shows band only

---

### Task A8: Risk score integration — defaulter cards
**Type:** Code → captain-tdd
**Status:** Pending · **Depends on:** A5 · **Tests:** build-clean

**Acceptance Criteria:**

- On dashboard load, batch-fetch `/risk-scores` for all visible defaulter IDs (up to 100)
- Replace the current severity-tint logic with risk-score-based:
  - `score >= 70 critical` → red
  - `score >= 40 high` → amber
  - `score < 40 medium` → slate
  - `score null (insufficient data)` → neutral + tooltip
- Sort defaulters by risk score desc (new default); small "sort by" toggle to revert to `amount` or `days`
- Risk score badge replaces days-overdue badge: *"Risk 82"*
- Hover on badge: fetch `/risk-scores?includeNarrative=true` (opt-in LLM) for that ONE student only; show popover with narrative + factor breakdown table
- Factor breakdown shows all active factors with weight + value

**Verification:**
- `npm run build -w admin-portal` clean
- Manual: list sorts by score; hover shows tooltip with live LLM narrative
- Narrative opt-in: stays empty until hover → single LLM call per hover

---

### Task A9: Situation cards above defaulter list
**Type:** Code → captain-tdd
**Status:** Pending · **Depends on:** A5 · **Tests:** build-clean

**Acceptance Criteria:**

- New section on dashboard, above the Risk List card: "Agent findings"
- On mount, fetch `/situations`
- Renders up to 5 situation cards (horizontal row on wide screens, stacked on mobile)
- Each card: severity ring (red/amber/slate) + narrative + action buttons
- Action buttons trigger the respective flow:
  - `draft_plan` → opens PaymentPlan dialog pre-filled (out-of-scope stub for this sprint: navigates to a placeholder "Plan builder coming soon" screen; logs AgentAction)
  - `draft_reminder` → opens the Reminder Drafts side panel (from A10) filtered to this card's students
  - `schedule_call` → placeholder (out of scope)
  - `review_policy` → placeholder
  - `dismiss` → opens dismiss dialog: snooze days (1/3/7/30) + optional reason → POST `/situations/:id/dismiss` → card disappears with a toast
- Empty state: "No situations need attention — collection is clean." after 500ms fade-in
- Error state: inline "Agent offline" banner; dashboard continues rendering

**Verification:**
- `npm run build -w admin-portal` clean
- Manual: load dashboard → 3-5 cards render; click Dismiss with snooze=7 → card gone; reload → still gone for 7d

---

### Task A10: Reminder drafts side panel
**Type:** Code → captain-tdd
**Status:** Pending · **Depends on:** A5 · **Tests:** build-clean

**Acceptance Criteria:**

- Header button on the Risk List card: `[Draft reminders]`
- Click → opens right-docked side panel (70% viewport width)
- Top of panel: progress bar "Drafting 12 reminders…" while fetching from `/reminder-drafts`
- Per-student card: guardian name + language + tone + predicted read-rate + subject + body (editable)
- Per-student actions: `[Approve]` / `[Edit]` / `[Skip]`
- Bulk actions: `[Approve all]` / `[Approve only recommended (>70% predicted read-rate)]`
- On approve: POST `/reminder-drafts/approve` with final drafts → FeeReminder created → success toast with `[Recall]` button (5-min window)
- Recall: DELETE on pending FeeReminder (existing endpoint — check if exists; if not, note as spec gap for service-layer work)
- Skipped drafts logged as `situation-dismiss` kind agent actions

**Verification:**
- `npm run build -w admin-portal` clean
- Manual: click `[Draft reminders]` → panel slides in → 12 drafts load → approve all → 12 FeeReminders created → dispatched via stub workers → delivery status 'delivered'

---

### Task A11: API docs + QA checklist
**Type:** Doc → captain-spec direct
**Status:** Pending · **Depends on:** A5, A10

**Expected state:**

Create two files matching the style of `backend/docs/api/fee-analytics-and-alerts.md`:

- `backend/docs/api/fee-analytics-ai-native.md` — API reference
  - Concepts (LLM provider abstraction, PII masking, HITL, audit + reversibility, fallback)
  - Data model additions (3 new collections)
  - 7 endpoints (full request/response/errors/auth/streaming notes)
  - PII field catalog
  - Provider switching (env vars, cost model)
  - Fallback behavior matrix per feature
  - Open questions
- `backend/docs/api/fee-analytics-ai-native-qa-checklist.md` — deploy checklist
  - Prerequisites (env vars set, API keys valid)
  - §1 Provider verification (call each endpoint with each provider)
  - §2 PII spot-check (trigger a chat, verify audit log has masked text, not raw)
  - §3 Streaming verification (SSE in dev + prod behind proxy)
  - §4 Cost tracking (LLM calls logged with `[llm]` prefix + INR computed)
  - §5 Fallback tests (disable provider key, verify degraded behavior)
  - §6 Smoke tests (5 manual flows covering each feature)
  - §7 Rollback plan (set LLM_PROVIDER=invalid → all endpoints 503 gracefully; no data corruption)
  - §8 Known limitations
  - §9 Post-deploy monitoring (2-week window)
  - §10 Sign-off (Finance Lead, SRE, Security, Product)

---

## Spec-to-task traceability

| Spec section | Covered by |
|---|---|
| §Journey 1 Chat | A1, A4, A5, A6 |
| §Journey 2 Forecast | A3, A4, A5, A7 |
| §Journey 3 Risk score | A3, A4, A5, A8 |
| §Journey 4 Situations | A3, A4, A5, A9 |
| §Journey 5 Reminder drafts | A4, A5, A10 |
| §Journey 6 Provider switch | A1 |
| §Journey 7 Degradation | A4 (fallbacks), A6-A10 (UI states) |
| §AC LLM abstraction | A1 |
| §AC PII masking | A1 |
| §AC Audit + reversibility | A2, A4, A10 |
| §AC Observability | A4 (logs), A5 (headers) |

All ~40 ACs trace to ≥1 task; all 12 edge cases have a home in A1/A4 testing.

---

## Changelog

- **2026-04-22** — Initial task list drafted. 11 tasks, 3 parallel foundation starters (A1, A2, A3). Front-loaded risks: A1 (PII masker) + A5 (SSE endpoint).

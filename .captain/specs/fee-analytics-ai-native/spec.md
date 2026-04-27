# Spec: Fee Collection Dashboard — AI-Native Upgrade

**Created:** 2026-04-22 · **Status:** specifying · **Parent:** fee-collection-analytics-and-alerts

## What & Why

The Fee Collection Dashboard currently displays aggregates + a client-side velocity forecast + rule-based per-student recommendations + a stubbed chat bar. This sprint replaces the "AI sprinkles" with real LLM-backed intelligence — without losing the deterministic fallbacks that make the dashboard reliable when providers are down.

The goal: a Finance Officer opening the page should see a *conclusion* of what needs their attention today, not a grid of numbers. Every visible metric should be askable. Every defaulter row should carry an explainable risk score + proposed action. Reminders should be pre-drafted in the guardian's language + tone, ready for one-click approval.

Five features land together in one sprint:

1. **Real LLM-backed chat** — replace `stubAiReply` with a live agent endpoint. Context-aware (knows the filters + date range + defaulter list currently on screen). Streaming responses.
2. **Probabilistic forecast with narrative** — upgrade the green banner from a linear projection to a time-series decomposition with confidence band + 1-line AI-written explanation of the drivers.
3. **Per-student risk score with reasoning** — each defaulter row gets a 0–100 score + factor breakdown tooltip. Scoring is rule-based (deterministic, fast); LLM only for the narrative summary.
4. **Proactive situation cards** — replace the flat defaulter list with 3–5 agent-surfaced *situations*. Each has an AI-composed narrative + recommended action button + dismiss.
5. **Draft mode for reminders** — per-defaulter pre-drafted reminder (guardian language + tone ladder). Finance Officer reviews + bulk-sends.

Provider-agnostic: a single `LLM_PROVIDER=claude|openai` env switch routes all five features. PII is masked before leaving the backend. Every AI-initiated action is auditable + reversible.

## Scope boundaries (before details)

- **In:** backend LLM service + per-feature endpoints + frontend wiring in FeeDashboardPage + per-defaulter reminder draft/approve flow
- **Out:** voice input (Web Speech API), autopilot mode (no HITL), multi-agent system, policy-aware approvals, scholarship agent, report builder, cohort-vs-cohort insights — all flagged as next-phase ideas in the parent spec

## User Journeys

### Journey 1 — Finance Officer asks a natural-language question
1. Finance Officer on `/finance/dashboard` types in the command bar: *"Why did collection drop this week?"*
2. Frontend posts to `/api/juvi/finance-agent/query` with `{ prompt, context: { from, to, currentFilters } }`
3. Backend assembles context (recent payments, funnel deltas, cron runs), masks PII, sends to active provider (Claude or OpenAI)
4. Streaming response renders into the chat thread with typing indicator
5. Officer can click a follow-up chip ("Show me the affected students") → continues the thread with accumulated context
6. Each response carries a small footer with: provider used, tokens, response time

### Journey 2 — Dashboard forecast becomes trustworthy
1. Finance Officer opens `/finance/dashboard`
2. Forecast banner shows: *"Likely ₹20.4L–21.2L by month-end (80% confidence). Risk of falling below 80% target: 11%."*
3. Below the number: *"Drivers: UPI collections down 18% after the 15th · scholarship disbursements delayed 9 days · concession backlog at 7."*
4. Officer clicks the banner → side drawer with full time-series decomposition + prior-month comparison

### Journey 3 — Defaulter list ranks by risk, not amount
1. Finance Officer scrolls to the risk-sorted card list
2. Each card shows a risk score (e.g., `Risk 82`) with color coding (red ≥70, amber 40–69, green <40)
3. Hovering the score reveals factors: *"Score 82: +35 days overdue, +25 no-response to 3 reminders, +15 income-band drop from Person.demographics, −6 sibling paid on time"*
4. Ranking is by score descending — so the most actionable students surface first, not just the biggest amounts

### Journey 4 — Proactive situation cards surface what needs action
1. Above the defaulter list, 3–5 "Situation" cards surface per-student narratives the Finance Officer should decide on
2. Example card: *"Kavya Rao likely needs a payment plan, not another reminder"* with 3-line context + `[Draft plan] [Call parent] [Dismiss for 7d]` actions
3. Clicking `[Draft plan]` pre-fills a PaymentPlan with AI-proposed instalments (from the student's prior payment pattern)
4. `[Dismiss for 7d]` hides the card and re-evaluates on the next dashboard load after 7 days
5. Dismissals are audited so the agent can learn

### Journey 5 — Bulk reminder drafts
1. Finance Officer clicks `[Draft reminders]` on the Risk List header
2. Side panel slides in: "Drafts ready (12)"
3. Per-student card: guardian name/language/tone + drafted message + predicted read-rate
4. Individual controls: `[Approve]` / `[Edit]` / `[Skip]`
5. Bulk controls: `[Approve all (12)]` — triggers FeeReminder creation + queues for dispatch via existing stub/real workers
6. Audit log records the draft text + the approver + the delivery outcome

### Journey 6 — Provider switch
1. SRE sets `LLM_PROVIDER=openai` in backend `.env`; restarts backend
2. All five features transparently route to OpenAI GPT-4o-mini instead of Claude Sonnet 4.5
3. Dashboard AI responses continue functioning with identical UX
4. Provider name surfaces in the chat-thread footer so the team knows what served the request

### Journey 7 — Graceful degradation
1. LLM provider times out or returns error
2. Backend logs + increments a failure counter
3. Each feature falls back:
   - Chat: returns "AI assistant is temporarily unavailable" message
   - Forecast: shows the current rule-based velocity projection (no narrative)
   - Risk score: shows rule-based score (no LLM narrative tooltip)
   - Situations: hidden entirely (no fake situations)
   - Reminder drafts: uses template-based text (no personalization)
4. Dashboard continues rendering — no broken UI

## Acceptance Criteria

### AC — LLM provider abstraction
- `LLM_PROVIDER` env var switches routing between `claude` and `openai`
- `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` read from env; missing key for active provider → backend boots OK but AI endpoints return 503 with clear message
- Default models: Claude Sonnet 4.5, GPT-4o-mini; overridable via `LLM_MODEL` env (optional, uses provider default when absent)
- Single `LLMClient` interface with methods: `complete(messages, opts)` + `stream(messages, opts)`. Both provider adapters implement it.
- Per-endpoint model selection: chat → 'default'; forecast narrative → 'default'; risk reasoning → 'mini' (cheaper/faster)

### AC — PII masking
- Before any LLM call, sensitive fields are replaced with opaque tokens (e.g., `{guardian_phone_1}`, `{student_name_5}`)
- Masked fields: `phone`, `email`, `guardian.name`, `guardian.phone`, `guardian.email`, `address`, `aadhaar`, `pan`, `dob`
- Not masked (public identifiers): `rollNumber`, `programme`, `branch`, `batch`, `escalationStage`, amounts, dates
- Backend keeps a token→value map per request; un-masks tokens in the LLM response before returning to frontend
- Token IDs are deterministic within a request but NOT across requests (no reconstruction of a full PII corpus from logs)
- Audit log stores the MASKED prompt + response (never raw PII), plus the token→record ID mapping

### AC — Chat endpoint
- `POST /api/juvi/finance-agent/query` with `{ prompt: string, context?: ChatContext, conversationId?: string }`
- Response: streaming (SSE) chunks of `{ delta: string }`; final chunk includes `{ usage, provider, model, auditId, durationMs }`
- Context bundle includes: current filters (date range, programme IDs), top-20 defaulters (masked), last cron run summary, last 7-day collection trend
- Conversation continuity: passing `conversationId` includes prior turns in the LLM call (max last 10 turns, capped at 8K tokens)
- Rate limit: 20 req/min per user
- All turns logged to a new `AgentConversation` collection

### AC — Forecast narrative
- `POST /api/juvi/finance-agent/forecast-narrative` with `{ collegeId, from, to }`
- Backend runs simple Holt-Winters decomposition on last 6 months of daily collection data → returns `{ lower, upper, mean }` for month-end projection
- LLM is prompted with the decomposition output + recent anomalies (cron run deltas, payment mode shifts) to generate a 1–2 sentence narrative describing drivers
- Response: `{ projection: { lower, upper, mean }, confidence: number, narrative: string }`
- Fallback: if LLM fails, returns `narrative: null` and frontend shows projection without the driver text

### AC — Per-student risk score
- `POST /api/juvi/finance-agent/risk-scores` with `{ studentIds: string[] }` (batch up to 100)
- Backend computes score (deterministic, rule-based) from features: `daysOverdue`, `reminder-response-rate`, `payment-cadence-variance`, `guardian-demographics-risk`, `sibling-pattern`, `stage-advance-velocity`
- Returns `{ studentId, score, factors: Array<{ name, weight, value }> }[]`
- Optional LLM narrative per score: pass `includeNarrative: true` → LLM gets masked factors + returns one-sentence explanation ("Risk 82 because…")
- Narrative endpoint is opt-in per-row (lazy-loaded on hover) to avoid LLM calls for the whole list

### AC — Proactive situation cards
- `POST /api/juvi/finance-agent/situations` with `{ collegeId }`
- Backend assembles ~10 candidate situations using deterministic heuristics (e.g. "students with partial payments past 15 days", "concessions spike in last 7 days", "holds waived without HOD review")
- LLM prompted with the 10 candidates + masked context → picks top 3–5, writes narratives + proposes actions
- Response: `{ situations: Array<{ id, title, narrative, actions: Array<{ label, type, payload }>, severity, studentIds }> }`
- Action types: `draft_plan | draft_reminder | schedule_call | review_policy | dismiss`
- Dismissal: separate endpoint `POST /agent/situations/:id/dismiss` with `{ reason, snoozeDays }` → stored in `SituationDismissal` collection, respected on next generate

### AC — Reminder drafts
- `POST /api/juvi/finance-agent/reminder-drafts` with `{ studentIds: string[] }` (batch up to 50)
- LLM prompted with per-student masked context + guardian preferred language + tone-ladder rules
- Tone ladder: first-time overdue → soft; 2+ reminders sent → firm; welfare-flagged → empathetic
- Response: `{ drafts: Array<{ studentId, language, tone, subject, body, predictedReadRate, templateVersion }> }`
- Approve endpoint: `POST /agent/reminder-drafts/approve` with `{ drafts: Array<{ studentId, subject, body }> }` → creates FeeReminder + queues dispatch
- Audit: FeeReminder.metadata.source = `'agent-draft-v1'`, `metadata.model`, `metadata.approvedBy`, `metadata.originalDraft` (in case of edit)

### AC — Frontend integration
- Chat bar wired to streaming `/query` endpoint; suggestion chips send canned prompts; `Esc` cancels a streaming response (AbortController)
- Forecast banner shows band + narrative; narrative is marked with a small `✦` to indicate AI-generated
- Defaulter cards show risk score badge with color coding; hover to load narrative (if opted in)
- Situation cards render above the defaulter list, each with full action buttons
- `[Draft reminders]` button in the Risk List header opens a side panel with per-student drafts + approve/edit/skip
- Loading states for each feature: chat shows thinking spinner; forecast shows range without narrative then fills in; situations show 3 skeleton cards

### AC — Audit + reversibility
- New `AgentAction` collection logs every AI-initiated action: `{ type, userId, collegeId, payload, masked: true, response, provider, model, durationMs, reverted?: { at, by } }`
- Reminder drafts approved by Officer can be recalled within 5 minutes of dispatch (cancel the FeeReminder job if still in queue)
- Hold / payment plan drafts can be voided by Principal with one click; AgentAction entry marked `reverted`

### AC — Observability
- Cost tracking: each LLM call logs `{ provider, model, inputTokens, outputTokens, costInr }` (using current API pricing; configurable via env)
- Daily cost roll-up visible to admin role on a new `/platform/ai-usage` page (out of scope for this sprint — land the tracking only)
- Structured log prefix `[llm]` on every LLM call for grep-ability

## Edge Cases

| Case | Behavior |
|---|---|
| LLM timeout (>30s) | Abort; fall back per feature; log `[llm] timeout` |
| Malformed LLM response | Fall back; retry once with a re-prompted "return JSON only" reminder |
| Token count exceeds context window | Truncate oldest turns (chat) or shrink candidate pool (situations) |
| Non-English guardian language without model support | Fall back to English template |
| User sends a prompt injection ("ignore previous instructions") | System prompt has jailbreak defenses; on suspected injection, refuse + log |
| College ID in prompt doesn't match caller's college | Always inject college scope server-side; ignore any college IDs in prompt |
| Conversation history corrupted / missing | Start fresh; return first-turn response |
| Provider API key invalid | 503 with "LLM provider misconfigured"; log structured error |
| User clicks Approve on a draft the LLM modified between load + click | Re-fetch the current draft and show a diff before dispatching |
| Streaming connection drops mid-response | Frontend shows partial response + "(connection lost — try again)" |
| PII unmask fails to find token | Log an alert and return the masked token verbatim (not a crash) |
| Dismissed situation re-arises before snooze expires | Suppress; on snooze expiry, re-surface with "returning" tag |

## NOT For

- **No voice input** — text-only for this sprint
- **No autopilot (no-HITL)** — every AI-initiated write still requires a human approval click
- **No multi-agent system** — single Finance Agent for this sprint
- **No scholarship agent, audit agent, report agent** — next phase
- **No policy retrieval** — no Finance policy corpus ingestion for this sprint
- **No A/B testing of prompts** — single prompt version per feature
- **No cost admin UI** — cost tracking lands, admin page deferred
- **No trained ML models** — risk scoring is rule-based (statistical at best)
- **No cross-college learning** — each college's agent sees only its own data

## Dependencies

### Environment variables (new)
```
LLM_PROVIDER=claude                  # or 'openai'
LLM_MODEL=                           # optional override; falls back to provider default
ANTHROPIC_API_KEY=sk-ant-...         # required when LLM_PROVIDER=claude
OPENAI_API_KEY=sk-...                # required when LLM_PROVIDER=openai
LLM_RATE_LIMIT_PER_MINUTE=20         # per user
LLM_COST_TRACKING=true               # log token usage + INR cost
```

### npm packages (new)
- `@anthropic-ai/sdk` — Anthropic SDK
- `openai` — OpenAI SDK
- No new frontend packages (SSE via native `EventSource`/`fetch`)

### New Mongoose models
- `AgentConversation` — chat history per user
- `AgentAction` — audit log for AI-initiated actions
- `SituationDismissal` — per-officer snoozes

### Existing models touched (minor)
- `FeeReminder.metadata` — add `agent-draft-v1` source tagging (no schema change; metadata is already Mixed)

## Success Metrics

- **Chat response time (p50):** < 2s to first token (streaming); < 8s total
- **Forecast narrative accuracy:** Finance Officer agrees with the narrative 80%+ of the time (survey after 2 weeks)
- **Risk score adoption:** defaulter list sorted by risk (not amount) by default after Week 1; Officer can toggle back to amount-sort
- **Situation card dismissal rate:** < 40% (higher → agent is surfacing wrong things; re-tune heuristics)
- **Reminder draft approval rate:** > 70% approved-as-is (without edits) by Week 3
- **LLM cost:** < ₹500/day/college at 100 Finance Officers
- **PII leakage:** zero instances of unmasked PII reaching the LLM (audited via log spot-checks)
- **Provider switch works:** `LLM_PROVIDER=openai` → all 5 features work identically; verified in e2e tests

## Open Questions

- **OQ-1:** Should streaming chat use Server-Sent Events (SSE) or WebSocket? Default: SSE (simpler, unidirectional, cheaper).
- **OQ-2:** Does the LLM ever need access to cross-student data (e.g., "how did cohort X pay last year")? Current answer: yes, but only per-college. No cross-college queries allowed.
- **OQ-3:** Cost budget alerting — per-college daily limit? Default: ₹1000/day soft limit, log warnings; no hard cutoff for v1.
- **OQ-4:** Which LLM model do we use for the "narrative" calls (cheap) vs. the situation cards (needs more reasoning)? Default: always the 'default' model per provider (Claude Sonnet 4.5 / GPT-4o-mini); optimize later.
- **OQ-5:** Should the audit log be queryable by users for their own history? Default: yes for admin only in this sprint; user-visible "why did the agent do this" is next-phase.
- **OQ-6:** PII masking: do we mask roll numbers? They are institution-public but not globally public. Default per this sprint: NOT masked (they're the anchor for Finance conversations). Flag if Finance disagrees.

## Changelog

- **2026-04-22** — Initial spec created. Decisions:
  - All 5 starter-bundle features in one sprint
  - LLM provider abstraction via `LLM_PROVIDER` env, Claude + OpenAI adapters
  - PII masking before LLM calls (phones, emails, guardian details, addresses, IDs)
  - Human-in-the-loop default; all writes require approval click
  - Audit log + reversibility for every AI-initiated action
  - Deterministic fallback for each feature when provider is down

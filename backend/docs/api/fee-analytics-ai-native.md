# Fee Collection Dashboard — AI-Native Upgrade — API Reference

**Spec:** `.captain/specs/fee-analytics-ai-native/spec.md`
**Plan:** `.captain/specs/fee-analytics-ai-native/plan.md`
**Tasks:** `.captain/specs/fee-analytics-ai-native/tasks.md`

This document describes the LLM-backed Finance Agent that powers the Fee Collection Dashboard's chat bar, forecast banner, per-student risk scores, situation cards, and reminder drafts. The agent is provider-switchable (Claude Sonnet 4.5 or GPT-4o-mini), PII-masks every payload before any external call, requires human-in-the-loop approval for every write, and falls back deterministically when the LLM is unavailable.

Complements the companion QA / deploy checklist: `./fee-analytics-ai-native-qa-checklist.md`.

---

## Table of contents

1. [Overview](#overview)
2. [Concepts](#concepts)
3. [Architecture](#architecture)
4. [Data model additions](#data-model-additions)
5. [Streaming protocol (SSE)](#streaming-protocol-sse)
6. [Provider abstraction](#provider-abstraction)
7. [PII masking field catalog](#pii-masking-field-catalog)
8. [Endpoints](#endpoints)
9. [Error codes](#error-codes)
10. [Rate limits](#rate-limits)
11. [RBAC mapping](#rbac-mapping)
12. [Fallback behavior matrix](#fallback-behavior-matrix)
13. [Cost tracking](#cost-tracking)
14. [Known deviations from plan](#known-deviations-from-plan)
15. [Open questions](#open-questions)

---

## Overview

Five features land together in this sprint, all served by a single backend submodule (`backend/src/modules/juvi/finance-agent/`):

1. **Real LLM-backed chat** (`POST /query`, SSE) — context-aware Finance Officer chat that knows the dashboard filters + visible defaulter list. Streams replies back over Server-Sent Events.
2. **Probabilistic forecast with narrative** (`POST /forecast-narrative`) — Holt-Winters month-end projection with confidence band + a 1-2 sentence AI-written explanation of the drivers.
3. **Per-student risk score with reasoning** (`POST /risk-scores`) — deterministic 0-100 score per defaulter + factor breakdown; opt-in LLM narrative attached lazily on hover.
4. **Proactive situation cards** (`POST /situations`, `POST /situations/:fingerprint/dismiss`) — agent-surfaced, snoozable per-officer narratives picked from 8 deterministic heuristics.
5. **Draft mode for reminders** (`POST /reminder-drafts`, `POST /reminder-drafts/approve`) — per-defaulter pre-drafted reminders in the guardian's preferred language and a tone calibrated to escalation history; one-click approval creates `FeeReminder` docs and enqueues dispatch.

A single `LLM_PROVIDER=claude|openai` env switch routes all five features. PII is masked before the request leaves the backend and unmasked in the response. Every AI-initiated write is logged in `AgentAction` and reversible within a 5-minute window.

---

## Concepts

### LLM provider abstraction

`LLM_PROVIDER` in the backend `.env` selects the active provider:

- `LLM_PROVIDER=claude` (default; Anthropic SDK; model `claude-sonnet-4-5`)
- `LLM_PROVIDER=openai` (OpenAI SDK; model `gpt-4o-mini`)

`LLM_MODEL` (optional) overrides the per-provider default. Both adapters implement the same `LLMClient` interface (`complete()` + `stream()` methods); switching providers does not require a code change. Missing API key for the active provider boots the backend cleanly but every AI endpoint returns `503 LLM provider misconfigured: <KEY> missing`.

See `backend/src/modules/juvi/finance-agent/llm-client.ts` for the factory.

### PII masking

Before any payload leaves the backend for the LLM, the orchestrator runs `maskPII(input)` (see `pii.ts`):

- Token format: `{category_ordinal}` — example `{guardian_phone_1}`, `{student_email_2}`.
- Ordinals reset per `maskPII()` call. Same value reused within one call gets the same token (deterministic dedup); same value across two requests gets fresh tokens (no cross-request correlation).
- `tokenMap` is held in memory for the duration of the request only — never persisted. Audit log stores the MASKED prompt + response.
- LLM response is unmasked via `unmaskText(text, tokenMap)` before returning to the frontend.
- Unknown token in LLM response (hallucinated) is passed through literal + logged once per unique token: `[llm:pii-warn] unknown_token=<name>`.

See [PII masking field catalog](#pii-masking-field-catalog) for the masked-vs-not-masked field list.

### Human-in-the-loop discipline

No AI-initiated write is dispatched without an Officer approval click. Reminder drafts return as JSON; the Officer reviews, edits, then POSTs the final text to `/reminder-drafts/approve`. Situation cards expose action buttons (`draft_plan`, `draft_reminder`, `schedule_call`, `review_policy`) that always route through human-confirmed flows. The agent's system prompt explicitly says "Never claim to have taken an action."

### Audit + reversibility

Every LLM-mediated call writes one `AgentAction` document (append-only) with:

- `type` — one of `chat | forecast | risk | situations | reminder-draft | reminder-approve | situation-dismiss`
- `maskedPrompt` + `maskedResponse` — never raw PII
- `provider` + `model` + `durationMs` + `inputTokens` + `outputTokens` + `costInr`
- Optional `reverted: { at, by, reason }` populated when an Officer reverses the action

A reminder dispatched via `/reminder-drafts/approve` can be recalled within 5 minutes by removing the queued `platform:sms` job (recall UI is informational-only in this sprint — see [Known deviations](#known-deviations-from-plan)).

### Graceful degradation

Each feature falls back independently when the LLM is down:

- Chat → SSE error event "AI assistant temporarily unavailable"; dashboard continues rendering
- Forecast → projection band still returned; `narrative: null`
- Risk score → deterministic score returned; `narrative` undefined per item
- Situations → empty array `[]`
- Reminder drafts → deterministic template-based drafts (still in guardian's language and the rule-determined tone)

See the [Fallback behavior matrix](#fallback-behavior-matrix).

---

## Architecture

```
admin-portal                            backend
─────────────                           ───────
FeeDashboardPage  ──── SSE ────►  POST /api/juvi/finance-agent/query  ────┐
  ├─ AICommandBar                                                          │
  ├─ AIForecastBanner ─ POST ───►  POST /api/juvi/finance-agent/...    ────┤
  ├─ DefaulterCard    ─ POST ───►                                          │
  ├─ SituationCards   ─ POST ───►                                          │
  └─ ReminderDraftsPanel ───────►                                          │
                                                                           │
                                  ┌────────────────────────────────────────┴───┐
                                  │  controller.ts                              │
                                  │    └─ assertStudentsInCollege               │
                                  ├─────────────────────────────────────────────┤
                                  │  service.ts (orchestrator)                  │
                                  │    ├─ ContextAssembler  (Mongo, scoped)     │
                                  │    ├─ PIIMasker         (mask → tokens)     │
                                  │    ├─ PromptBuilder     (per feature)       │
                                  │    ├─ LLMClient.complete / .stream          │
                                  │    ├─ Zod parse (situations, drafts)        │
                                  │    ├─ PIIUnmasker       (restore values)    │
                                  │    └─ AuditLogger       (AgentAction.create)│
                                  └────────┬───────────────────────┬────────────┘
                                           ▼                       ▼
                                    Anthropic SDK             OpenAI SDK
                                    (claude-sonnet-4-5)       (gpt-4o-mini)
```

**Module layout** (`backend/src/modules/juvi/finance-agent/`):

| File | Purpose |
|---|---|
| `llm-client.ts` | Provider-agnostic `LLMClient` + `createLLMClient(provider?)` factory + cost helper |
| `claude-adapter.ts` | Anthropic SDK adapter implementing `LLMClient` |
| `openai-adapter.ts` | OpenAI SDK adapter implementing `LLMClient` |
| `pii.ts` | `maskPII(input)` + `unmaskText(text, tokenMap)` |
| `prompts.ts` | 5 prompt builders + shared `systemPrefix` |
| `risk-scorer.ts` | Deterministic 0-100 score + `assembleFeatures` |
| `forecast.ts` | Pure-TS Holt-Winters additive (period=7, alpha=0.3, beta=0.1, gamma=0.1) |
| `situation-candidates.ts` | 8 deterministic heuristics |
| `context.ts` | College-scoped context assemblers (chat, forecast, reminder) |
| `service.ts` | Orchestrator — 8 public methods, one per endpoint plus dismiss |
| `orchestrator-helpers.ts` | `withBoundedConcurrency`, `tryParseJson`, `trimTurnsForBudget`, `truncateNarrative` |
| `validation.ts` | Zod schemas (one per endpoint) |
| `controller.ts` | Thin HTTP handlers + cross-college guard |
| `routes.ts` | Express Router with 7 endpoints |

---

## Data model additions

Three new Mongoose collections (all under `backend/src/models/juvi/`):

### `AgentConversation`

Persistent chat history keyed by `(collegeId, userId, conversationId)`. Stores the user-visible (unmasked) turns — safe because every turn is the user's own college's data.

```ts
interface IAgentConversation {
  _id: ObjectId;
  collegeId: ObjectId;
  userId: ObjectId;
  conversationId: string;            // client-generated UUID (per-college, in localStorage)
  turns: Array<{
    role: 'user' | 'assistant';
    content: string;                 // unmasked
    timestamp: Date;
  }>;
  lastModel: string;
  lastProvider: 'claude' | 'openai';
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostInr: number;
  createdAt: Date;
  updatedAt: Date;
}
```

Index: `{ collegeId: 1, userId: 1, updatedAt: -1 }` (chat history scroll).

### `AgentAction`

Append-only audit log for every LLM-mediated call. ALWAYS stores the masked prompt + response (never raw PII).

```ts
interface IAgentAction {
  _id: ObjectId;
  collegeId: ObjectId;
  userId: ObjectId;
  type: 'chat' | 'forecast' | 'risk' | 'situations' | 'reminder-draft' | 'reminder-approve' | 'situation-dismiss';
  maskedPrompt: string;
  maskedResponse: string;
  provider: 'claude' | 'openai';
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  reverted?: { at: Date; by: ObjectId; reason: string };
  createdAt: Date;
}
```

Indexes:
- `{ collegeId: 1, createdAt: -1 }` (admin review of all agent activity)
- `{ userId: 1, createdAt: -1 }` (per-user review)

### `SituationDismissal`

Per-officer snooze record. Filtered out of `/situations` while `snoozedUntil > now`.

```ts
interface ISituationDismissal {
  _id: ObjectId;
  collegeId: ObjectId;
  userId: ObjectId;
  situationFingerprint: string;      // sha256(`${kind}:${sortedStudentIds.join(',')}`)
  snoozedUntil: Date;
  reason: string;                    // empty string allowed; null rejected
  createdAt: Date;
}
```

Index: `{ collegeId: 1, userId: 1, snoozedUntil: 1 }` (active-snooze lookup).

---

## Streaming protocol (SSE)

The chat endpoint (`POST /query`) uses Server-Sent Events. Headers set on the response:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

`X-Accel-Buffering: no` is required behind nginx to prevent proxy-level chunk buffering.

Three event types:

| Event | Payload | When |
|---|---|---|
| `delta` | `{"text": "..."}` | One per token chunk from the LLM |
| `done` | `{"provider", "model", "inputTokens", "outputTokens", "costInr", "durationMs", "auditId", "conversationId"}` | Final event, after the LLM completes |
| `error` | `{"message": "..."}` | Provider error, abort, or PII processing failure; ends the stream |

Wire format (one event per blank-line-separated block):

```
event: delta
data: {"text":"Collec"}

event: delta
data: {"text":"tion is"}

event: done
data: {"provider":"claude","model":"claude-sonnet-4-5","inputTokens":523,"outputTokens":147,"costInr":0.18,"durationMs":1824,"auditId":"...","conversationId":"..."}
```

**Frontend client:**

The admin portal uses native `fetch` + `ReadableStreamDefaultReader` (NOT `EventSource` — `EventSource` cannot send POST bodies or `Authorization` headers).

**Cancellation:**

When the client disconnects (`req.on('close')`), the controller fires an `AbortController.abort()` on the upstream LLM call. Both adapters forward the signal to the underlying SDK, terminating the in-flight request and capping cost. See `controller.ts` `chatHandler`.

---

## Provider abstraction

| Provider | Default model | Input USD per 1M tok | Output USD per 1M tok |
|---|---|---:|---:|
| `claude` | `claude-sonnet-4-5` | $3.00 | $15.00 |
| `openai` | `gpt-4o-mini`       | $0.15 | $0.60 |

Pricing lives in `llm-client.ts` `PRICING_USD_PER_MILLION` and is converted to INR per call:

```
costInr = ((inTokens × inputUSD + outTokens × outputUSD) / 1_000_000) × LLM_INR_RATE
```

Default `LLM_INR_RATE = 85.0`. Override via env. Cost is rounded to 4 decimal places.

**Model resolution precedence** (highest to lowest):

1. Per-call `opts.model` (orchestrator can pin a specific model per feature)
2. `LLM_MODEL` env var (deployment override)
3. Provider default (`claude-sonnet-4-5` / `gpt-4o-mini`)

**Default LLM call options:**

- `temperature: 0.3` (sober finance-ops voice)
- `maxTokens: 1500` (varies per endpoint — `forecast-narrative` caps at 200, `risk-narrative` at 120, `reminder-drafts` at 400, `situations` at 1500)

---

## PII masking field catalog

### Masked

| Field path | Token category | Notes |
|---|---|---|
| `phone` (top level) | `phone` | Any non-empty string |
| `email` (top level) | `email` | |
| `address` (top level) | `address` | |
| `aadhaar` (top level) | `aadhaar` | |
| `pan` (top level) | `pan` | |
| `dob` (top level) | `dob` | |
| `guardian.name` | `guardian_name` | Triggered when nested under a `guardian` (or `guardians`) parent |
| `guardian.phone` | `guardian_phone` | |
| `guardian.email` | `guardian_email` | |

### NOT masked (institutional / public identifiers)

`rollNumber`, `programme`, `programmeId`, `branch`, `batch`, `academicYear`, `escalationStage`, all amount fields (`overdueAmount`, `dueAmount`, `costInr`, etc.), all date fields (`dueDate`, `createdAt`, etc.), all `_id`/`*Id` fields, `status`, `role`, top-level `name`.

### Token format and lifecycle

- Format: `{<category>_<ordinal>}` — example `{guardian_phone_1}`, `{student_email_2}`.
- Ordinals reset per `maskPII()` call.
- Same value reused within one call → same token (dedup).
- Token map is held only for the duration of the request; never persisted.
- The unmasker (`unmaskText`) replaces every literal `{token}` substring with its mapped value. Unknown tokens (LLM hallucinations) are left literal + logged once: `[llm:pii-warn] unknown_token=<name>`.

---

## Endpoints

All endpoints live under `/api/juvi/finance-agent/*`, behind `authenticate` + per-action `authorize()` + a shared `feeAgentRateLimit` (60/min/user). All bodies validated by Zod.

### `POST /api/juvi/finance-agent/query`

Streaming SSE chat. Replaces the dashboard's stubbed `stubAiReply`.

**Permission:** `('juvi', 'read')`

**Request body** (`chatQuerySchema`):

```ts
{
  prompt: string;                          // 1..2000 chars
  conversationId?: string;                 // uuid; absent = brand-new conversation
  context?: {
    filters?: { from?: Date; to?: Date; programmeIds?: string[] };
    visibleDefaulterIds?: string[];        // 0..50
  };
}
```

**Example request:**

```json
{
  "prompt": "Why did collection drop this week?",
  "conversationId": "8f7a...",
  "context": {
    "filters": { "from": "2026-04-01", "to": "2026-04-22" },
    "visibleDefaulterIds": ["6628a...", "6628b..."]
  }
}
```

**Response:** `text/event-stream` (see [Streaming protocol](#streaming-protocol-sse)).

**Errors:** 400 (prompt missing/over-cap, bad uuid), 401, 403, 429, 503 (LLM down — surfaces as SSE `error` event).

---

### `POST /api/juvi/finance-agent/forecast-narrative`

Holt-Winters month-end projection + LLM driver narrative.

**Permission:** `('finance', 'read')`

**Request body** (`forecastNarrativeSchema`):

```ts
{ monthAnchor: Date }    // ISO string → coerced; any date in the target month
```

**Example request:**

```json
{ "monthAnchor": "2026-04-15T00:00:00.000Z" }
```

**Response 200:**

```json
{
  "projection": {
    "lower": 2040000,
    "mean":  2080000,
    "upper": 2120000,
    "confidence": 0.8,
    "monthEnd": "2026-04-30T23:59:59.999Z",
    "daysInWindow": 180
  },
  "narrative": "Drivers: UPI collections down 18% after the 15th; scholarship disbursements delayed 9 days; concession backlog at 7.",
  "generatedAt": "2026-04-22T08:31:14.082Z"
}
```

When the LLM is degraded, `narrative` is `null` and the projection still returns.

**Errors:** 400 (invalid date), 401, 403, 429, 500 (forecast computation error).

---

### `POST /api/juvi/finance-agent/risk-scores`

Batch deterministic risk score + optional LLM narrative per row.

**Permission:** `('finance', 'read')`

**Request body** (`riskScoresSchema`):

```ts
{
  studentIds: string[];                    // 1..100
  includeNarrative?: boolean;              // default false
}
```

**Example request:**

```json
{
  "studentIds": ["6628a...", "6628b...", "6628c..."],
  "includeNarrative": true
}
```

**Response 200:**

```json
[
  {
    "studentId": "6628a...",
    "score": 82,
    "tier": "critical",
    "factors": [
      { "name": "daysOverdue",                "weight": 40,  "value": 35 },
      { "name": "reminderResponseRate",       "weight": 15,  "value": 0.1 },
      { "name": "guardianIncomeBandDropFlag", "weight": 10,  "value": true },
      { "name": "siblingOnTimeFlag",          "weight": -6,  "value": true }
    ],
    "narrative": "Risk 82 because overdue 35 days, no response to 3 reminders, and a guardian income-band drop on file."
  }
]
```

`tier` is one of `'low' | 'medium' | 'high' | 'critical' | 'insufficient-data'`. When `score === null`, the row is in the insufficient-data tier and no narrative is computed.

**Errors:** 400 (`studentIds` empty / over 100), 401, 403, 429.

**Cross-college:** controller calls `assertStudentsInCollege` BEFORE the orchestrator — any foreign or invalid id → 403 with no service work.

---

### `POST /api/juvi/finance-agent/situations`

Top 3-5 agent-surfaced situations from 8 deterministic candidate heuristics.

**Permission:** `('finance', 'read')`

**Request body** (`situationsSchema`): strictly empty — `z.object({}).strict()`. The server uses `req.collegeId` + `req.userId` only.

**Example request:**

```json
{}
```

**Response 200:**

```json
[
  {
    "id": "f9b7...",
    "fingerprint": "8a2c...",
    "kind": "partial-payment-stale",
    "severity": "high",
    "title": "5 students with stale partial payments",
    "narrative": "Five students paid partial amounts more than 15 days ago and haven't returned. Most have a payment plan history; consider drafting plans rather than another reminder.",
    "studentIds": ["6628a...", "6628b...", "..."],
    "actions": [
      { "label": "Draft plan",       "type": "draft_plan" },
      { "label": "Draft reminders",  "type": "draft_reminder" }
    ]
  }
]
```

When the LLM returns invalid JSON, the orchestrator retries once with stricter instructions then falls back to `[]`. When all candidates are dismissed (or none triggered), the LLM is short-circuited and `[]` is returned (still logs an AgentAction with `maskedPrompt: 'no-candidates'`).

**Errors:** 400 (extra body fields — strict schema), 401, 403, 429.

---

### `POST /api/juvi/finance-agent/reminder-drafts`

Per-student reminder drafts in the guardian's preferred language and a rule-determined tone (soft / firm / empathetic).

**Permission:** `('finance', 'read')`

**Request body** (`reminderDraftsSchema`):

```ts
{ studentIds: string[] }                   // 1..50
```

**Example request:**

```json
{ "studentIds": ["6628a...", "6628b..."] }
```

**Response 200:**

```json
[
  {
    "studentId": "6628a...",
    "language": "te",
    "tone": "firm",
    "subject": "Action required: outstanding fees",
    "body": "Dear Mr. Rao, fees for roll 20CS001 are overdue by 35 days...",
    "predictedReadRate": 0.78,
    "templateVersion": "agent-draft-v1"
  }
]
```

When the LLM returns invalid JSON for a row OR fails entirely, that row falls back to a deterministic template (still in the rule-determined tone + language; `predictedReadRate: 0.5`). All rows still ship `templateVersion: 'agent-draft-v1'`.

**Errors:** 400 (`studentIds` empty / over 50), 401, 403, 429.

**Cross-college:** controller asserts every id belongs to the caller's college BEFORE the orchestrator runs.

---

### `POST /api/juvi/finance-agent/reminder-drafts/approve`

Convert reviewed drafts to `FeeReminder` documents and enqueue dispatch.

**Permission:** `('finance', 'update')`

**Request body** (`approveDraftsSchema`):

```ts
{
  drafts: Array<{
    studentId: string;
    subject: string;                       // min 1 char
    body: string;                          // min 1 char
  }>;                                      // 1..50
}
```

**Example request:**

```json
{
  "drafts": [
    { "studentId": "6628a...", "subject": "Action required: outstanding fees", "body": "Dear Mr. Rao, ..." }
  ]
}
```

**Response 200:**

```json
{
  "reminderIds": ["66291..."],
  "approvedCount": 1
}
```

Each created `FeeReminder` carries:

```ts
metadata: {
  source: 'agent-draft-v1',
  approvedBy: <userId>,
  subject, body,
  originalDraft: { subject, body }
}
```

The matching `platform:sms` job is enqueued (current default channel for v1 — see [Known deviations](#known-deviations-from-plan)). Redis offline → the FeeReminder is still created, the dispatch warning is logged, and an admin tool can replay later.

**Errors:** 400 (validation), 401, 403 (cross-college student id detected at the controller), 429.

---

### `POST /api/juvi/finance-agent/situations/:fingerprint/dismiss`

Snooze a situation card for the calling officer.

**Permission:** `('finance', 'update')`

**URL params:**

- `:fingerprint` — sha256 hex from `/situations` response

**Request body** (`dismissSituationSchema`):

```ts
{
  snoozeDays: 1 | 3 | 7 | 30;
  reason: string;                          // 0..500 chars (empty allowed)
}
```

**Example request:**

```json
{ "snoozeDays": 7, "reason": "Already on a payment plan" }
```

**Response 200:**

```json
{ "ok": true }
```

`SituationDismissal` is upserted with `snoozedUntil = now + snoozeDays × 86400_000`. Subsequent `/situations` calls within the snooze window suppress this fingerprint.

**Errors:** 400 (missing fingerprint param, invalid `snoozeDays`, `reason` over 500 chars), 401, 403, 429.

---

## Error codes

| Status | Meaning | Common causes |
|---|---|---|
| 400 | Bad request / validation | Zod rejects body or params; empty studentIds; over-cap; invalid fingerprint param |
| 401 | No auth | Missing / invalid JWT |
| 403 | Wrong role OR cross-college student id | `authorize()` denies; `assertStudentsInCollege` rejects an id from another college (or an invalid ObjectId) |
| 404 | Entity not found | Reserved — none of the 7 endpoints currently emit 404 in normal flows |
| 409 | Invalid state transition | Reserved — no current 409 path |
| 429 | Rate limit | > 60 requests/min/user across the finance-agent endpoints (single shared bucket) |
| 500 | Internal error | DB outage; unexpected aggregation failure |
| 503 | LLM provider misconfigured | `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) missing for active provider; surfaced as SSE `error` for chat, JSON error for the others |

---

## Rate limits

A single shared per-user limiter is applied to ALL 7 endpoints: **60 requests / minute / user**.

This deviates from plan §1.9, which spec'd different limits per endpoint (chat 20/min, dismiss 60/min, approve 10/min, etc.). The deviation is captured in [Known deviations](#known-deviations-from-plan) and was made deliberately for v1 simplicity. Per-endpoint shaping can be layered on later if production traffic shows abuse.

The limiter uses `createUserRateLimit({ max: 60, windowMs: 60_000 })`. Exceeding the limit returns 429 with `{ error: 'rate_limited' }`.

---

## RBAC mapping

| Endpoint | Permission | Roles allowed |
|---|---|---|
| `POST /query` | `('juvi', 'read')` | super_admin, admin, principal, finance_officer, hod |
| `POST /forecast-narrative` | `('finance', 'read')` | super_admin, admin, principal, finance_officer, hod (HOD scope is enforced at the deterministic layer — see `forecast.ts`) |
| `POST /risk-scores` | `('finance', 'read')` | same |
| `POST /situations` | `('finance', 'read')` | same |
| `POST /reminder-drafts` | `('finance', 'read')` | same |
| `POST /reminder-drafts/approve` | `('finance', 'update')` | super_admin, admin, finance_officer (and any role configured for finance/update in the deployment) |
| `POST /situations/:fingerprint/dismiss` | `('finance', 'update')` | same |

Roles `teacher` and unrelated others receive 403 across the board.

---

## Fallback behavior matrix

What the user sees per feature in each degraded state:

| Feature | LLM up (happy path) | LLM timeout / 5xx / abort | Provider misconfigured (no API key) | Mongo down |
|---|---|---|---|---|
| Chat (`/query`) | Streamed delta events + `done` with usage | SSE `error` event "AI assistant temporarily unavailable"; partial text retained; dashboard renders | SSE `error` event with `LLM provider misconfigured: ...`; dashboard renders | Endpoint 500; dashboard's other queries continue |
| Forecast narrative | `projection` + `narrative` string | `projection` returned; `narrative: null`; banner hides Drivers line | `projection` returned; `narrative: null` | Endpoint 500; banner shows "Forecast unavailable" + retry |
| Risk scores (no narrative) | Deterministic score + factors + tier | (LLM not used) — same as happy path | (LLM not used) — same as happy path | Endpoint 500; per-card badge shows "Risk —" |
| Risk scores (`includeNarrative=true`) | Score + factors + per-row narrative | Score + factors returned; `narrative` undefined per row | Score + factors returned; `narrative` undefined per row | Endpoint 500; popover hides |
| Situations | 3-5 cards with narratives + actions | `[]` (empty array — no fake situations) | `[]` | Endpoint 500; section shows inline "Agent findings unavailable" |
| Reminder drafts | Per-student LLM-drafted subject + body | Per-row deterministic template (correct language + tone, `predictedReadRate: 0.5`) | Per-row deterministic template | Endpoint 500; panel shows retry banner |
| Approve drafts | `FeeReminder` created + SMS job enqueued | (LLM not used) — happy path | (LLM not used) — happy path | Endpoint 500; toast shows error |
| Dismiss situation | 200 with upsert | (LLM not used) — happy path | (LLM not used) — happy path | Endpoint 500; toast shows error |

The dashboard never breaks — every feature renders independently.

---

## Cost tracking

Every LLM call is logged via `AgentAction.costInr`. The cost helper in `llm-client.ts`:

```
costInr = ((inputTokens × inputUSD + outputTokens × outputUSD) / 1_000_000) × LLM_INR_RATE
```

with `LLM_INR_RATE` defaulting to 85.0 INR/USD (override via env).

Per-conversation rollup lives on `AgentConversation.{totalInputTokens, totalOutputTokens, totalCostInr}` and is incremented on every chat turn.

**Note on log lines:** Plan §5 specified a structured `[llm] provider=X model=Y endpoint=Z college=<id> user=<id> in=N out=M ms=K costInr=Z` log line per call. As shipped, cost is captured in the `AgentAction` document but no per-call `[llm]` log line is emitted — this is captured in [Known deviations](#known-deviations-from-plan) and the QA checklist treats `AgentAction` as the source of truth.

---

## Known deviations from plan

Pulled from the spec changelog and A1-A10 completion signals:

1. **Single shared rate-limit (60/min/user) instead of per-endpoint limits.** Plan §1.9 spec'd different limits per endpoint (chat 20/min, dismiss 60/min, approve 10/min, etc.). Shipped as a single bucket for v1 simplicity. Per-endpoint shaping is a one-line refactor when needed. (A5 completion §3.)

2. **No `[llm]` log line per call.** Plan §5 spec'd `[llm] provider=X model=Y in=N out=M ms=K costInr=Z` per call; shipped feature relies on `AgentAction` document as the cost ledger. Adding the log line is straightforward for a follow-up.

3. **No `/reminder-drafts/skip` endpoint.** Plan §AC mentioned skipped drafts logged as agent actions. Skip is currently client-state-only (card dims, status flips to `'skipped'`). To honor the spec fully, a `POST /reminder-drafts/skip` would write a `situation-dismiss`-typed `AgentAction`. (A10 completion §1.)

4. **Recall window (5 min) is informational only.** No `[Recall]` button shipped in A10; the success toast surfaces the window as text ("Recall window: 5 min — visit Reminders page to cancel"). Implementing real recall would require a `DELETE /reminders/:id` against still-queued jobs; the `platform:sms` queue worker already supports the lookup. (A10 completion §2.)

5. **Cost admin dashboard deferred.** Per-day per-college INR rollup is captured in `AgentAction` but no admin UI page (`/platform/ai-usage`) renders it yet. Spec explicitly listed this as out-of-scope for the sprint. (Spec §AC Observability.)

6. **Cross-college LLM context isolation enforced; no cross-college learning.** Every LLM context bundle is scoped via `req.collegeId`. No agent reads or writes data across colleges. (Spec OQ-2 closed.)

7. **No streaming on non-chat endpoints.** Forecast / risk / situations / drafts are request/response. Streaming was scoped to chat per plan §1.7.

8. **No autopilot mode.** Every write requires HITL approval. Spec §NOT For.

9. **Risk score is rule-based; no trained ML.** Spec §NOT For.

10. **Holts-Winters confidence drops to 0.5 when < 30 days history.** Linear-trend fallback when < 7 days. (A3 completion §forecast.ts ACs.)

11. **`handleApproveDrafts.dueAmount = 0`.** The agent flow doesn't carry an invoice-level amount through the draft. `FeeReminder.dueAmount` is persisted as `0`. A future iteration can pull `defaulter.overdueAmount` for the student. (A4 completion §6.)

12. **All approved drafts route to the SMS queue (`platform:sms`).** A4 spec gap §5: future iteration should read `guardian.communicationPreference` and route to `platform:email` / `platform:whatsapp` accordingly. The `FeeReminder` schema already accepts those channels.

13. **Insufficient-data students never trigger LLM narrative calls.** A8 wires `canFetchNarrative = riskScore.score !== null && hovered`; insufficient-data rows show `Risk —` and don't dispatch a narrative request.

14. **Forecast endpoint logs `userId: collegeId` on `AgentAction`.** Per-college aggregate has no real per-user invocation; `AgentAction.userId` field is set to the collegeId as a placeholder. Same for `handleRiskScores` and `handleReminderDrafts` batch entries. (A4 completion §1, §2.)

15. **Top-level `name` is NOT masked.** Spec AC lists `guardian.name` only. Top-level `name` (e.g., a student's display name) passes through unchanged. If Finance disagrees, update `MASK_RULES` in `pii.ts`. (A1 completion §3.)

16. **Chat user prompt is NOT masked; only the context bundle is.** Per A4 contract, the user owns their phrasing — pasted PII is the user's choice. The full message body (masked context + raw user prompt) lives in `AgentAction.maskedPrompt`. (A4 completion §9.)

---

## Open questions

From spec §Open Questions:

| # | Question | Resolution |
|---|---|---|
| OQ-1 | SSE vs WebSocket? | **Closed:** SSE — simpler, unidirectional, cheaper. Implemented in A5. |
| OQ-2 | Cross-student / cross-college queries? | **Closed:** Per-college only. No cross-college queries allowed. Enforced server-side via `req.collegeId` + `assertStudentsInCollege`. |
| OQ-3 | Cost budget alerting (per-college daily limit)? | **Open:** ₹1000/day soft limit is documented; no hard cutoff for v1. No alerting wired. |
| OQ-4 | Per-feature model selection (cheap vs default)? | **Closed:** Always provider default for v1 (Claude Sonnet 4.5 / GPT-4o-mini). Per-call `opts.model` available for future tuning. |
| OQ-5 | User-visible audit log? | **Closed:** Admin-only in this sprint; user-facing "why did the agent do this?" is next-phase. |
| OQ-6 | Mask roll numbers? | **Closed:** No — they're the institution-public anchor for Finance conversations. Documented in `pii.ts`. |

From plan §Open Questions (operational):

| # | Question | Resolution |
|---|---|---|
| OQ-P1 | Vite dev proxy SSE support? | **Closed:** Default Vite proxy forwards SSE correctly when upstream sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`. (A6 completion §8.) |
| OQ-P2 | Guardian preferred language field? | **Closed:** `Person.guardian.preferredLanguage` (string). Falls back to `'en'` when absent. |
| OQ-P3 | Abort semantics on chat cancellation? | **Closed:** Abort upstream (saves cost). `AbortController` wired through controller → orchestrator → SDK. |
| OQ-P4 | Surface system prompt in UI? | **Closed:** No — admin debug view only (deferred). System prompt at `service.ts` exports `systemPrefix` for tests / inspection only. |

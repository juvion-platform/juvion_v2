# Feature Spec — AI-Assisted Config (Gap 3 Differentiation)

**Feature ID:** 002-ai-assisted-config
**Module:** M12 Platform (config-registry surface)
**Status:** Draft (pre-GATE 2)
**Date:** 2026-05-14

## 1. Problem & Motivation

The schema-driven config registry (commit `6accd9c`) gives admins a generic CRUD UI over 4 config types (`institution-feature-flags`, `notification-templates`, `naming-series`, `award-classification`). Today, admins start from blank or copy values from peer colleges. They don't know which feature-flags new colleges typically enable, what notification template body text reads well, or what CGPA thresholds peer institutions use.

**Goal:** Let admins press a "Suggest" button on the `SchemaConfigPage` form for any registered config type and receive LLM-generated suggestions, each with a confidence score and a one-sentence rationale. The admin reviews and selectively accepts. Suggestions are persisted as audit-able `ConfigSuggestion` documents.

## 2. User Stories & Acceptance Criteria

### Story 1 — Generate suggestions for a config schema
**As** a platform admin
**I want** to press a "Suggest" button on the `SchemaConfigPage` for any schema-driven config
**So that** I have a starting point informed by typical institutional defaults instead of an empty form.

**ACs:**
1. `POST /api/platform/config/:type/suggest` accepts `{ context?: { collegeProfile?, currentValues? } }`, runs an LLM call, and returns `{ suggestions: ConfigSuggestion[], model, costInr, generatedAt }`.
2. Each `ConfigSuggestion` includes: `field` (path within the schema), `suggestedValue`, `confidence` (0–1), `rationale` (one sentence), `source` (`'llm' | 'peer-default'`), `generatedAt`.
3. The endpoint authorizes via `authorize('platform', 'update')` — the same gate as upserting a config entry.
4. The call is cap-guarded: `CONFIG_SUGGEST_DAILY_LLM_CAP` (default 50/college/day). When the cap is hit, return `200 { suggestions: [], capReached: true }` with an explanatory `reason` field — never 5xx.
5. A `createAuditLog` entry with `action: 'ai_config_suggested'` records `entityType: 'ConfigEntry'`, `entityName: configType`, `performedBy`, and the cost.

### Story 2 — Review, accept, reject suggestions inline
**As** the same admin
**I want** to see each suggestion next to its target field, with the rationale visible
**So that** I can choose which suggestions to apply and which to discard.

**ACs:**
1. The `SchemaConfigPage` form gains a "✨ Suggest" button (header-level) that fires the suggest endpoint and renders inline suggestion cards next to each affected field.
2. Each suggestion card shows: `suggestedValue` (formatted appropriately for the field type), `confidence` as a percentage badge, `rationale`, and Accept / Reject buttons.
3. **Accept** writes the suggested value into the in-form state (does NOT auto-save the config). The `ConfigSuggestion` doc status flips to `accepted`. The admin still has to press "Save" on the form to persist the config change.
4. **Reject** dismisses the card and flips `ConfigSuggestion.status` to `rejected`. An optional rejection reason can be captured in metadata.
5. When the admin then saves the config entry, the resulting `upsertConfigEntry` audit log notes which fields came from AI suggestions (audit `changes` array includes a `source: 'ai'` marker on those fields), and a parallel `ai_config_applied` audit entry is written.

### Story 3 — Per-college daily cap + observability
**As** a college admin
**I want** to see how many AI config suggestions ran today and what they cost
**So that** I can manage spend.

**ACs:**
1. `GET /api/platform/config/suggestions/stats?range=today|week|month` returns `{ totalSuggested, accepted, rejected, llmCostInr, byConfigType }`.
2. The `SchemaConfigPage` displays a small inline counter ("Today: 12 / 50 suggestions used") and an amber banner when the cap is hit.
3. Stats are aggregated from `ConfigSuggestion` documents — no separate stats model needed (volumes are low enough for direct counts).

### Story 4 — Schema-level exclusion of sensitive fields
**As** the platform team
**I want** registered config schemas to be able to declare `aiSuggestable: false` per-field
**So that** future configs containing credentials or other secrets never receive LLM suggestions.

**ACs:**
1. The `ConfigSchema` registry type gains a per-field optional `aiSuggestable?: boolean` flag (defaults to `true`).
2. The suggest endpoint filters out any field where the registry sets `aiSuggestable: false` BEFORE building the LLM prompt — so the value never appears in the LLM context.
3. The endpoint also strips any current values for opt-out fields from the masked context (defensive: `maskPII` runs on the whole context anyway).
4. None of the 4 current schemas need this flag for v1 — they contain no secrets. The mechanism is forward-compat.

## 3. Suggestion Engine Design

### Prompt shape

```
SYSTEM
You are the Juvion Config Advisor for Indian college operations. You suggest
default values for a college's platform config based on the schema and the
college's profile.

Return ONLY a single JSON object:
{
  "suggestions": [
    { "field": "<dotted-path>", "value": <appropriate-type>, "confidence": 0..1, "rationale": "<one sentence>" }
  ]
}

Guidelines:
- Suggest at most one value per field; omit fields you are unsure about.
- Confidence < 0.6 should not appear in the output — filter at source.
- Rationale must be a single complete sentence, under 25 words.
- Never invent values for fields whose types you do not recognize.

USER
<context>
  Schema: <inline JSON schema definition for the configType>
  College profile: <profile snippet with masked PII>
  Current values: <currentValues if any, with masked PII>
</context>

Suggest defaults for the empty or unset fields.
```

### Storage

New Mongoose model `ConfigSuggestion`:

```typescript
interface IConfigSuggestion extends Document {
  collegeId: Schema.Types.ObjectId;
  configType: string;
  field: string;                           // dotted path
  suggestedValue: unknown;
  confidence: number;
  rationale: string;
  source: 'llm' | 'peer-default';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  generatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  model: string;                           // model version
  promptVersion: string;                   // tied to PROMPT_VERSION constant
  costInr: number;                         // share of the batch cost
  batchId: string;                         // groups suggestions from one POST
}
```

Indexes: `{collegeId: 1, configType: 1, generatedAt: -1}`, `{collegeId: 1, status: 1}`.

### Audit actions to add

- `'ai_config_suggested'` — written once per `POST /suggest` batch
- `'ai_config_applied'` — written when a saved config entry includes accepted suggestions

## 4. Out of Scope

- Peer-defaults learning loop (cross-college aggregation of accepted suggestions). Source can be `'peer-default'` at the schema level (forward-compat), but the LLM is the only real source in v1.
- Async / queued suggestion generation. v1 is inline (12s LLM call max).
- Auto-application (suggestions always require explicit accept).
- Schema-level migration of existing configs (the suggest button only operates on fields whose schema is registered).
- Suggestion for new config types not yet in the registry.

## 5. Constraints & NFRs

| NFR | Target |
|---|---|
| Suggest endpoint p95 latency | < 12s (12s `AbortController` timeout in the worker) |
| Per-college daily cap | 50 suggestions / college / day default (`CONFIG_SUGGEST_DAILY_LLM_CAP`) |
| LLM cost cap per call | inherits client default; cost recorded per suggestion |
| Multi-tenancy | all reads/writes filter by `collegeId` |
| PII handling | college profile passes through `maskPII` before LLM; configs themselves don't carry PII today |
| Audit | every batch produces 1 `ai_config_suggested` entry; every saved-with-AI config produces an `ai_config_applied` entry |
| Authorization | `authorize('platform', 'update')` — same as config write |

## 6. Dependencies

- LLM client: `backend/src/modules/juvi/finance-agent/llm-client.ts`
- Cap-guard pattern: `backend/src/modules/admissions/lead-scoring/cap-guard.ts` (copy structure, new Redis key namespace)
- Prompt pattern: `backend/src/modules/admissions/lead-scoring/prompt.ts`
- JSON parser pattern: `backend/src/modules/admissions/lead-scoring/llm-scorer.ts`
- PII masker: `backend/src/shared/llm/pii.ts`
- Config registry: `backend/src/modules/platform/config-registry.ts`
- Audit infrastructure: `backend/src/shared/audit.ts` — extend `AuditAction` with `ai_config_suggested` + `ai_config_applied`

## 7. Risks

| Risk | Mitigation |
|---|---|
| LLM suggests an invalid value (wrong type / out of enum range) | Validate suggestions against the registered schema before persisting; drop invalid suggestions silently and log a metric |
| Suggestion costs spiral on bulk requests | Per-college daily cap + cost per suggestion in audit |
| Future configs add secrets | `aiSuggestable: false` schema flag prevents secrets from entering the LLM prompt |
| Stale suggestions in DB | Optional cleanup job marks `pending` suggestions older than 24h as `expired` (deferred to Phase B) |
| LLM hallucinates field names | Validator drops suggestions whose `field` doesn't exist in the registered schema |

## 8. Success Metrics (30-day post-launch)

- % of new config-entry creates that include at least one accepted AI suggestion: > 30%
- Avg LLM cost per scheme-config save: < ₹2
- Suggestion accept rate: > 40% (proxy for quality)

## 9. Open Questions

_None — discovery + GATE 0 resolved them._

## 10. GATE 2 Remediations

Folds every HIGH and MEDIUM finding from `gate2-architecture.md` and `gate2-api-security.md`.

### 10.1 Cap-guard parameterization (HIGH) — GATE 3 corrected

Refactor `backend/src/modules/admissions/lead-scoring/cap-guard.ts` to accept an optional `namespace` parameter. **GATE 3 B-1 correction:** the existing positional signature is `(collegeId, cap, now?)`, and the existing tests pass `now` as the 3rd positional arg. Inserting `namespace` as the 3rd positional would silently break those tests. The new param sits in the **4th** position with a default:

```typescript
export async function tryClaimLLMSlot(
  collegeId: string,
  cap: number,
  now: Date = new Date(),
  namespace: string = 'lead-score',
): Promise<ClaimResult> {
  const day = now.toISOString().slice(0, 10);
  const key = `${namespace}:llm-count:${collegeId}:${day}`;
  // …existing INCR + EXPIRE-on-first + DECR-on-over-cap unchanged
}
```

Lead-scoring's call site is unchanged (no 4th arg → default `'lead-score'`). Config-suggest calls `tryClaimLLMSlot(collegeId, cap, new Date(), 'config-suggest')` (or wraps it in `config-suggest/cap-guard.ts` so callers don't have to remember the positional dance).

### 10.2 HTTP contract (HIGH)

| Scenario | Code | Body |
|---|---|---|
| Suggestions generated | 200 | `{ suggestions[], model, costInr, generatedAt, batchId }` |
| Daily cap reached (no LLM call) | 200 | `{ suggestions: [], capReached: true, reason: 'daily_limit_exceeded', generatedAt }` |
| LLM timeout / API error | 200 | `{ suggestions: [], llmFallback: true, reason: 'llm_unavailable', generatedAt }` |
| Schema not registered | 404 | `{ error: 'Config type not found' }` |
| Invalid context shape | 400 | `{ error: '...' }` |
| Unauthorized | 403 | `{ error: 'Access denied' }` |
| Stats — success | 200 | `{ totalSuggested, accepted, rejected, llmCostInr, byConfigType }` |

Cap-reached + LLM-fallback are NOT errors. They return 200 with explanatory flags so the UI can render a banner rather than a generic error toast.

### 10.3 `FieldChange.source` extension (HIGH)

Add an optional `source` discriminator to `FieldChange` so the audit trail records whether a value came from UI, AI, or import:

```typescript
// backend/src/shared/types.ts
export interface FieldChange {
  field: string;
  displayName: string;
  oldValue: unknown;
  newValue: unknown;
  source?: 'ui' | 'ai' | 'import';
}
```

Mirror the addition into `backend/src/shared/audit.ts`'s `auditLogSchema.changes` definition (Schema.Types.Mixed entry already permissive; add explicit `source: String`).

Config-service `upsertConfigEntry` accepts an optional `aiAcceptedFields: string[]` param from the controller (populated by the form on save), and stamps `source: 'ai'` on those `changes` entries.

### 10.4 `aiSuggestable: false` per-field flag (MEDIUM)

Extend the `ConfigField` interface at `backend/src/modules/platform/config-registry.ts`:

```typescript
interface ConfigField {
  // …existing fields
  /** When false, this field is omitted from the LLM suggestion context (e.g. credentials). */
  aiSuggestable?: boolean;
}
```

The suggest service inspects the schema and drops any field with `aiSuggestable === false` **before** building the LLM context — never strips after the call. None of the 4 existing schemas need the flag; the mechanism is forward-compat.

### 10.5 Module boundary (MEDIUM)

New sub-module `backend/src/modules/platform/config-suggest/` mirroring `modules/admissions/lead-scoring/`:

- `service.ts` — orchestrator (cap-guard check, mask, build prompt, LLM call, parse, validate-against-schema, persist suggestions).
- `prompt.ts` — system + user `LLMMessage[]` builder + `PROMPT_VERSION = 'config-suggest-prompt-v1'`.
- `parser.ts` — strict JSON parse with fence stripping + schema validation against the live registry (drop invalid suggestions, log them).
- `cap-guard.ts` — thin wrapper that calls the shared parameterized `tryClaimLLMSlot(..., 'config-suggest')`.

Controller handler `suggestConfigHandler` lives in `config-controller.ts` and delegates to the service.

### 10.6 Audit action additions (MEDIUM)

Extend `AuditAction` union in `backend/src/shared/types.ts` and `AUDIT_ACTIONS` array in `backend/src/shared/audit.ts`:

```typescript
| 'ai_config_suggested'
| 'ai_config_applied'
```

### 10.7 Sensitive-field filtering timing (MEDIUM, explicit)

Filtering happens **before** the LLM prompt is assembled. Sequence in `service.ts`:

1. Load schema for `configType` from the registry.
2. Build `allowedFields = schema.fields.filter(f => f.aiSuggestable !== false)`.
3. Project the inbound `currentValues` to only the allowed-fields subset.
4. Mask the projected context with `maskPII`.
5. Build the prompt — secrets never reach Claude.

### 10.8 College profile shape (MEDIUM)

`collegeProfile` passed into the LLM context is explicitly restricted to non-PII institutional metadata:

```typescript
{
  name: college.name,
  code: college.code,
  yearFounded: college.yearFounded,
  studentCount: college.studentCount,
  programmeMix: college.programmeMix,
}
```

No phone, no email, no principal/contact-person fields. `maskPII` is still called defensively in case future additions sneak PII in. Unit test asserts no unmasked PII characters (regex for `+91-`, `@example.com`, etc.) escape into the masked context payload.

### 10.9 Stats aggregation multi-tenancy (MEDIUM)

The stats handler's aggregation MUST place `{ $match: { collegeId: new mongoose.Types.ObjectId(collegeId), ... } }` as the FIRST pipeline stage. Cross-tenant leak prevention.

### 10.10 Story 2 accept/reject = frontend state + batch status update

No new accept/reject HTTP endpoints. Frontend tracks per-field acceptance in local state and submits an `aiAcceptedFields: string[]` array alongside the normal upsert payload. The upsert handler:

1. Persists the config values as usual.
2. Writes the audit log with `source: 'ai'` on matching `changes` entries.
3. Atomically updates the matching `ConfigSuggestion` docs (`batchId` + `field` in the accepted set) to `status: 'accepted'`; the rest of the batch flips to `'rejected'`.

### 10.11 Idempotency note

A repeat `POST /suggest` for the same `(collegeId, configType, admin)` tuple within 30 seconds returns the prior batch with `isDuplicate: true` rather than running the LLM again. Implementation: optional `If-Recent-Batch-Within: 30s` check against `ConfigSuggestion` by `(collegeId, configType, batchId)` lookup — defaults to fresh batch on miss.

### 10.12 Data-validator follow-ups (folded post-hoc)

After Wave 1 landed, the data-validator report came in (gate2-data-layer.md, PASS, 4 warnings). Three items get folded into Wave 2's model:

- **Enum constraint on `source`**: `source: { type: String, enum: ['llm', 'peer-default'], required: true }` instead of plain `String`.
- **Cost-fraction strategy**: equal division — each suggestion in a batch carries `costInr = batchCostInr / suggestions.length`. The batch's total LLM cost comes from the LLM client response; we divide evenly. This makes `sum(suggestions[].costInr) ≈ batchCost` provable by construction.
- **`{batchId: 1}` index**: additional index for batch-integrity audit queries (sum/list by batch).

Deferred to Phase B (data-validator warning #2): a more flexible `FieldChange.metadata` shape. Wave 1 already shipped the stricter `source: 'ui'|'ai'|'import'` per api-sec-validator's recommendation, which covers the v1 use case. Any future per-field metadata extension goes through `metadata?: Record<string, unknown>` in a follow-up.

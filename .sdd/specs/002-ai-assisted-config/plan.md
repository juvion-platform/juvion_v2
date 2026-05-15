# Implementation Plan — 002-ai-assisted-config

**Source spec:** `.sdd/specs/002-ai-assisted-config/spec.md` (post-GATE 2)
**Owner module:** M12 Platform — new sub-module `modules/platform/config-suggest/`

## Architecture at a glance

```
POST /api/platform/config/:type/suggest
        │
        ▼
config-controller.suggestConfigHandler  ─ authorize('platform','update') ─┐
                                                                          │
                                                                          ▼
config-suggest/service.ts:
  1. Load schema from config-registry; filter fields where aiSuggestable !== false.
  2. Idempotency: 30s lookup by (collegeId, configType, performedBy). Hit → return existing batch with isDuplicate.
  3. Cap-guard: tryClaimLLMSlot(collegeId, cap, 'config-suggest'). Over cap → 200 + capReached.
  4. Build masked context: collegeProfile (non-PII fields only) + currentValues (filtered).
  5. config-suggest/prompt.ts: buildConfigSuggestPrompt({ schema, maskedContext }).
  6. 12s AbortController. LLM via existing juvi/finance-agent/llm-client. JSON parse strict.
  7. config-suggest/parser.ts: validate each suggestion against the registered schema (drop invalid).
  8. Persist N ConfigSuggestion docs (batchId, status='pending').
  9. createAuditLog 'ai_config_suggested' (entityType:'ConfigEntry', entityName:configType, costInr).
 10. Return { suggestions, model, costInr, generatedAt, batchId }.

Save flow (existing upsertConfigEntry, extended):
  - Optional aiAcceptedFields: string[] passed in body.
  - changes[] entries for those fields carry source:'ai'.
  - ConfigSuggestion.updateMany({batchId, field in accepted}, status:'accepted').
  - ConfigSuggestion.updateMany({batchId, field not in accepted, status:'pending'}, status:'rejected').
  - createAuditLog 'ai_config_applied' when aiAcceptedFields.length > 0.

GET /api/platform/config/suggestions/stats?range=today|week|month
  - Aggregation pipeline with $match: { collegeId: ObjectId, generatedAt: { $gte: ... } } FIRST.
  - Returns { totalSuggested, accepted, rejected, llmCostInr, byConfigType[] }.
```

## File-by-file changes

### A. Shared infrastructure prerequisites

| File | Change |
|---|---|
| `backend/src/shared/types.ts` | Add `ai_config_suggested` + `ai_config_applied` to `AuditAction` union. Extend `FieldChange` with optional `source?: 'ui' | 'ai' | 'import'`. |
| `backend/src/shared/audit.ts` | Add the two new actions to `AUDIT_ACTIONS`. Update `auditLogSchema.changes` definition to include `source: String`. |
| `backend/src/modules/admissions/lead-scoring/cap-guard.ts` | Parameterize `tryClaimLLMSlot(collegeId, cap, namespace?, now?)`. Default `namespace = 'lead-score'`. Existing single call site (orchestrator) keeps working without edit but may be updated to pass `'lead-score'` explicitly for clarity. |
| `backend/src/modules/admissions/lead-scoring/__tests__/cap-guard.test.ts` | Add a test that `namespace` override produces a different Redis key. |

### B. Data layer

| File | Change |
|---|---|
| `backend/src/models/platform/ConfigSuggestion.ts` | **NEW** — Mongoose model per spec §3 (interface + schema + indexes `{collegeId,configType,generatedAt:-1}` and `{collegeId,status,generatedAt:-1}`). |
| `backend/src/models/index.ts` | Re-export `ConfigSuggestion`. |
| `backend/src/modules/platform/config-registry.ts` | Add optional `aiSuggestable?: boolean` to `ConfigField` interface. No data migrations — existing 4 schemas leave it unset. |

### C. Config-suggest sub-module (NEW dir)

`backend/src/modules/platform/config-suggest/`:

| File | Responsibility |
|---|---|
| `prompt.ts` | `buildConfigSuggestPrompt({ schema, maskedContext })` — returns `LLMMessage[]` with the system instruction baked in. Exports `PROMPT_VERSION = 'config-suggest-prompt-v1'`. |
| `parser.ts` | Strict JSON parse + fence strip + validate each suggestion against the live schema via `validateAgainstSchema` (reuse from registry). Drop invalid ones, return `{ valid: [], invalid: [] }`. |
| `cap-guard.ts` | Thin wrapper: `tryClaimConfigSuggestSlot(collegeId, cap, now?)` delegates to shared `tryClaimLLMSlot(..., 'config-suggest')`. Reads `CONFIG_SUGGEST_DAILY_LLM_CAP` env (default 50). |
| `service.ts` | `suggestConfig(collegeId, configType, performedBy, opts?)` orchestrates everything per the diagram above. Public `acceptSuggestionsOnSave(collegeId, batchId, acceptedFields, performedBy)` for the upsert hook. |

### D. Module wiring

| File | Change |
|---|---|
| `backend/src/modules/platform/validation.ts` | Add Zod schemas: `suggestConfigBodySchema` (`{ context?: { collegeProfile?, currentValues? } }`), `statsQuerySchema` (`{ range?: enum }`). |
| `backend/src/modules/platform/config-controller.ts` | New handlers: `suggestConfigHandler`, `configSuggestionsStatsHandler`. The existing `upsertConfigEntry` controller accepts optional `aiAcceptedFields` from the body and forwards into the service. |
| `backend/src/modules/platform/config-service.ts` | `upsertConfigEntry` accepts optional `aiAcceptedFields: string[]`, stamps `source: 'ai'` on matching `changes`, calls `acceptSuggestionsOnSave` after the upsert. |
| `backend/src/modules/platform/routes.ts` | Add `POST /config/:type/suggest` (after `/config/:type/schema`) and `GET /config/suggestions/stats` (before `/config/:type/:identifier` to avoid conflict). |

### E. Frontend

| File | Change |
|---|---|
| `admin-portal/src/services/platform-config.ts` | Add `suggestConfig(type, context?)` and `getConfigSuggestionStats(range)`. Extend `upsertConfigEntry` to forward optional `aiAcceptedFields`. |
| `admin-portal/src/components/platform/SuggestionCard.tsx` | **NEW** — renders a single inline suggestion with confidence pill + rationale + Accept/Reject buttons. |
| `admin-portal/src/pages/platform/SchemaConfigPage.tsx` | "✨ Suggest" header button. On click, fire `suggestConfig(type, ...)` and store the returned batch in component state. Render `SuggestionCard` next to the matching form field. Accept writes value into form state + tracks `aiAcceptedFields`. Reject dismisses. Save passes `aiAcceptedFields` through to `upsertConfigEntry`. Inline "Today: X / 50" counter + amber banner when capReached. |

### F. Tests (TDD)

| File | Coverage |
|---|---|
| `backend/src/models/platform/__tests__/ConfigSuggestion.test.ts` | Persistence, indexes, multi-tenancy guard. |
| `backend/src/modules/platform/config-suggest/__tests__/prompt.test.ts` | System instruction shape, masked context embedded, PROMPT_VERSION exported. |
| `backend/src/modules/platform/config-suggest/__tests__/parser.test.ts` | Strict JSON, fence strip, drops invalid-vs-schema suggestions, never lifts unknown fields. |
| `backend/src/modules/platform/config-suggest/__tests__/cap-guard.test.ts` | Namespace propagates; cap-reached returns `allowed: false`. |
| `backend/src/modules/platform/config-suggest/__tests__/service.integration.test.ts` | Happy path: cap-passed → LLM → suggestions persisted → audit logged. Cap reached → no LLM call. Idempotent re-request within 30s. Schema validation drops invalid suggestions. |
| `backend/src/modules/platform/__tests__/config-suggest-public.test.ts` | `suggestConfig` controller smoke; stats handler aggregates correctly; multi-tenant isolation. |
| `admin-portal/src/components/platform/__tests__/SuggestionCard.test.tsx` | Renders confidence pill, accept/reject fire callbacks. |

## Risks

| Risk | Mitigation |
|---|---|
| Parameterizing cap-guard breaks lead-scoring | Default arg preserves existing behavior; new test pins both behaviors |
| FieldChange schema migration | `source` is optional; existing audit rows unaffected |
| LLM hallucinates field names not in schema | `parser.ts` drops invalid suggestions; metric logged |
| Idempotency lookup misses → double-LLM-call | 30s window is conservative; admin would not press button twice in 30s normally |
| Stats endpoint slow on large suggestion volumes | Index `{collegeId, generatedAt: -1}` already covers it |

## Out-of-scope (logged for follow-up)

- Peer-defaults learning loop (cross-college acceptance aggregation)
- Async / queued suggest path (BullMQ) — premature for 50/day cap
- Score-tuning slider for admins
- Per-college prompt-template UI

# Discovery — AI-Assisted Config (Gap 3 Differentiation)
**Feature:** 002-ai-assisted-config
**Date:** 2026-05-14

## What already exists

| Surface | State | File |
|---|---|---|
| 4 registered config schemas (`institution-feature-flags`, `notification-templates`, `naming-series`, `award-classification`) | Phase A complete | `backend/src/modules/platform/config-registry.ts` |
| Generic CRUD service (`listConfigEntries`, `getConfigEntry`, `upsertConfigEntry`, `deleteConfigEntry`) validated against the registry | Working, audit-logged | `backend/src/modules/platform/config-service.ts` |
| HTTP surface `GET /config/types`, `GET /config/:type/schema`, `GET|PUT|DELETE /config/:type/:identifier` | Working, `authorize('platform', read/update/delete)` | `backend/src/modules/platform/config-controller.ts` + `routes.ts` |
| `ConfigEntry` Mongoose doc — `collegeId`, `configType`, `identifier` (`__singleton__` for single types), `values: Record<string, unknown>`, `enabled`, `createdBy`, `updatedBy` | Multi-tenant, unique compound index | `backend/src/models/platform/ConfigEntry.ts` |
| Generic form renderer (string, textarea, number, boolean, select, multiselect, date) | Working | `admin-portal/src/pages/platform/SchemaConfigPage.tsx` |
| Frontend service | Working | `admin-portal/src/services/platform-config.ts` |

## Reusable LLM infrastructure (don't reinvent)

- `backend/src/shared/llm/pii.ts` — `maskPII()` / `unmaskText()`. **Low relevance here** — configs are institution-level, not PII-bearing. Still call through it for defense-in-depth.
- `backend/src/modules/juvi/finance-agent/llm-client.ts` — `createLLMClient()` + `complete()` with cost tracking (INR), default temp 0.3, default maxTokens 1500.
- `backend/src/modules/admissions/lead-scoring/prompt.ts` — pattern for system+user `LLMMessage[]` builder with JSON-only system instruction. Includes `PROMPT_VERSION` for audit trail.
- `backend/src/modules/admissions/lead-scoring/llm-scorer.ts` — strict JSON parse with `\`\`\`json` fence stripping, 12s `AbortController`, null on any failure.
- `backend/src/modules/admissions/lead-scoring/cap-guard.ts` — `tryClaimLLMSlot(collegeId, cap)` atomic Redis INCR with 24h TTL, fails closed.
- `backend/src/shared/audit.ts` — `createAuditLog()`; `AuditAction` enum already extended with `ai_score_computed`. We'll need a new action like `ai_config_suggested` / `ai_config_applied`.
- `backend/src/shared/queue/QueueManager.ts` — for any async suggestion paths.

## Config catalog — what could be AI-suggested

| Config type | Field types | AI-amenable? | Rationale |
|---|---|---|---|
| **institution-feature-flags** | 8× boolean (email, SMS, WhatsApp, portal, exam-blocking, bulk-import, allotments, Juvi AI) | ✅ HIGH | Could suggest enablement based on college maturity / adoption curves |
| **notification-templates** | string code/name/subject, select channel/audience, textarea body | ✅ HIGH | LLM can draft template body text ("Dear `{{studentName}}`, your fee is due…") from template intent |
| **naming-series** | string prefix/format, number counter/padding | ⚠️ PARTIAL | Counter is operational. Prefix/format may be regulatory-driven — AI suggests templates but humans must approve |
| **award-classification** | number CGPA thresholds, boolean no-backlog/first-attempt, number rank | ⚠️ PARTIAL | Institution-policy + regulation-tied. AI can suggest peer-default CGPA floors but eligibility rules are non-negotiable |

## Gaps — what 002 must build

1. **Config-suggestion service** — invokes LLM, passes college context + target schema, receives typed suggestions.
2. **`ConfigSuggestion` data model** — tracks `field`, `suggestedValue`, `confidence` (0–1), `rationale`, `model`, `costInr`, `status` (pending/accepted/rejected), `performedBy`, `generatedAt`.
3. **Suggestion HTTP endpoint** — `POST /api/platform/config/:type/suggest` → `{ suggestions[], model, costInr }`.
4. **LLM cap gate** — separate per-college daily cap for config suggestions (smaller than lead-scoring's 500/day — proposed 50/day).
5. **Prompt template** — config-advisor system prompt + context injection (college profile, current values, peer defaults if available).
6. **Frontend suggestion UI** — "Suggest" button on `SchemaConfigPage` rendering an inline list of suggestions with accept / reject controls.
7. **Audit hooks** — `ai_config_suggested` and `ai_config_applied` actions; suggestion lineage attached to the resulting `ConfigEntry` write.

## Open questions to resolve in the spec

1. **Confidence threshold for display** — propose ≥ 0.6 (suggestions below filtered out).
2. **Sensitive-config exclusion list** — none today, but future configs might include credentials. Need a registry-level `aiSuggestable: false` field per schema.
3. **Context sources for the prompt** — college profile (years operating, student count, programmes), historical audit trail, optional peer defaults? Larger context = better suggestions = more cost; need a default.
4. **Auto-apply vs confirm** — strongly recommend confirm (configs are institution-policy).
5. **Sync vs async** — inline 12s LLM call OK for feature-flags + templates (small suggestion sets); async/queue for bulk types if we add them.
6. **Persist vs ephemeral** — persist for audit trail (recommend) or one-off response?
7. **Sensitive PII in prompt** — institutional config doesn't carry student PII; still call `maskPII` defensively before sending college metadata.

## Key files

1. `backend/src/modules/platform/config-registry.ts` — current 4 types + field schemas
2. `backend/src/modules/platform/config-service.ts` — CRUD + validation
3. `backend/src/models/platform/ConfigEntry.ts` — Mongoose model
4. `backend/src/modules/platform/routes.ts` — endpoint routing + RBAC
5. `backend/src/modules/admissions/lead-scoring/llm-scorer.ts` — pattern to copy (JSON parse, abort guard)
6. `backend/src/modules/admissions/lead-scoring/prompt.ts` — system+user prompt builder
7. `backend/src/modules/admissions/lead-scoring/cap-guard.ts` — rate-limit logic
8. `backend/src/modules/juvi/finance-agent/llm-client.ts` — LLM interface + cost tracking
9. `backend/src/shared/audit.ts` — `AuditAction` to extend with `ai_config_suggested` / `ai_config_applied`
10. `admin-portal/src/pages/platform/SchemaConfigPage.tsx` — frontend form renderer
11. `admin-portal/src/services/platform-config.ts` — client API

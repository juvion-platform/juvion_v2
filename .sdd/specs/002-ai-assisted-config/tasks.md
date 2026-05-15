# Task Breakdown — 002-ai-assisted-config

TDD-ordered. 5 waves. Each wave ends with `rtk tsc` + targeted `rtk vitest` green.

Legend: `[ST]` shared, `[BE]` backend, `[FE]` frontend.

---

## Wave 1 — Shared prerequisites

| # | Task | File(s) | Test first |
|---|---|---|---|
| 1.0 | [ST] Extend `AuditAction` union: add `ai_config_suggested` + `ai_config_applied`. Extend `AUDIT_ACTIONS` array. | `shared/types.ts`, `shared/audit.ts` | TS compile reads both consts; existing audit tests untouched |
| 1.1 | [ST] Add optional `source` to `FieldChange`; thread through `auditLogSchema.changes` | `shared/types.ts`, `shared/audit.ts` | NEW assertion in an audit-shape test that `source: 'ai'` round-trips through the schema |
| 1.2 | [ST] Parameterize `tryClaimLLMSlot(collegeId, cap, now?, namespace?)` — **`namespace` is the 4th positional** (GATE 3 B-1; 3rd would break existing tests that pass `now` positionally), default `'lead-score'` | `modules/admissions/lead-scoring/cap-guard.ts` | NEW test in `cap-guard.test.ts` — namespace produces distinct Redis keys; default arg preserves existing behavior |
| 1.3 | [BE] Add `aiSuggestable?: boolean` to `ConfigField` interface (no schema migration needed) | `modules/platform/config-registry.ts` | TS compile + existing registry tests stay green |
| 1.4 | Wave gate | `rtk tsc` + targeted vitest green | — |

## Wave 2 — Data layer

| # | Task | File(s) | Test first |
|---|---|---|---|
| 2.0 | [BE] Create `ConfigSuggestion` Mongoose model with the spec's interface + indexes. **GATE 2 data-validator folds (§10.12)**: `source` as enum `['llm','peer-default']` required; **three** indexes (`{collegeId,configType,generatedAt:-1}`, `{collegeId,status,generatedAt:-1}`, `{batchId:1}`); document cost-fraction = equal division (the service does the math; the model just stores the per-suggestion `costInr`). | `models/platform/ConfigSuggestion.ts`, `models/index.ts` | NEW `models/platform/__tests__/ConfigSuggestion.test.ts` — persistence, required `collegeId`, `source` enum enforces, all three indexes present |
| 2.1 | Wave gate | `rtk tsc` + new model tests green | — |

## Wave 3 — Config-suggest engine (pure / stateful)

| # | Task | File(s) | Test first |
|---|---|---|---|
| 3.0 | [BE] `prompt.ts` — builds `[system, user]` LLMMessage pair with JSON-only schema instruction + masked context. Exports `PROMPT_VERSION` | `modules/platform/config-suggest/prompt.ts` | NEW `__tests__/prompt.test.ts` — system mentions JSON, masked tokens present, no raw PII strings; PROMPT_VERSION stable |
| 3.1 | [BE] `parser.ts` — strict JSON + fence strip + per-suggestion schema validation via `validateAgainstSchema`. Returns `{ valid, invalid }` | `modules/platform/config-suggest/parser.ts` | NEW `__tests__/parser.test.ts` — malformed JSON, unknown field name, wrong type all rejected; valid suggestion preserved |
| 3.2 | [BE] `cap-guard.ts` thin wrapper — reads `CONFIG_SUGGEST_DAILY_LLM_CAP` env (default 50); delegates to shared with `'config-suggest'` namespace | `modules/platform/config-suggest/cap-guard.ts` | NEW `__tests__/cap-guard.test.ts` — uses correct namespace, fails closed on Redis error |
| 3.3 | [BE] `service.ts` — orchestrator: lookup-idempotent → cap → mask → prompt → LLM (12s abort) → parse → persist suggestions → audit. Also `acceptSuggestionsOnSave(...)` helper | `modules/platform/config-suggest/service.ts` | NEW `__tests__/service.integration.test.ts` — happy, cap-reached, LLM-fallback, idempotent-within-30s, multi-tenant 404 |
| 3.4 | Wave gate | `rtk tsc` + all config-suggest tests green | — |

## Wave 4 — HTTP + integration

| # | Task | File(s) | Test first |
|---|---|---|---|
| 4.0 | [BE] Zod schemas | `modules/platform/validation.ts` | NEW slices in `__tests__/validation.test.ts` for the two schemas |
| 4.1 | [BE] Controller: `suggestConfigHandler`, `configSuggestionsStatsHandler` | `modules/platform/config-controller.ts` | Supertest-style smoke per scenario from §10.2 contract table |
| 4.2 | [BE] Routes: `POST /config/:type/suggest`, `GET /config/suggestions/stats` (placed before parameterized routes) | `modules/platform/routes.ts` | Same supertest tests cover routing |
| 4.3 | [BE] Extend `upsertConfigEntry` to accept optional `aiAcceptedFields: string[]`; stamps `source:'ai'` on matching changes; calls `acceptSuggestionsOnSave`; writes `ai_config_applied` audit when any field accepted | `modules/platform/config-service.ts`, `config-controller.ts` (body shape) | Extend `__tests__/config-service.test.ts` — upsert with aiAcceptedFields updates suggestion status + adds source marker to audit |
| 4.4 | Wave gate | full backend `rtk tsc` + `rtk vitest` green (modulo pre-existing failures) | — |

## Wave 5 — Frontend

| # | Task | File(s) | Test first |
|---|---|---|---|
| 5.0 | [FE] Service additions: `suggestConfig`, `getConfigSuggestionStats`, extended `upsertConfigEntry` | `admin-portal/src/services/platform-config.ts` | n/a (thin axios) |
| 5.1 | [FE] `SuggestionCard` component | `admin-portal/src/components/platform/SuggestionCard.tsx` | NEW `__tests__/SuggestionCard.test.tsx` — renders confidence + rationale, accept/reject callbacks |
| 5.2 | [FE] `SchemaConfigPage`: Suggest button, suggestion-batch state, inline cards per field, accept/reject wiring, `aiAcceptedFields` flowing through Save, inline counter + cap-reached banner | `admin-portal/src/pages/platform/SchemaConfigPage.tsx` | Manual smoke (Vite dev server) — load `/platform/config/institution-feature-flags`, click Suggest, see cards, accept one, save, verify backend audit. |
| 5.3 | Wave gate | `rtk tsc` (frontend) + Vite boots + manual smoke | — |

## Wave 6 — Finalize

| # | Task |
|---|---|
| 6.1 | Full `rtk tsc` both workspaces |
| 6.2 | Full `rtk vitest` both workspaces (modulo pre-existing failures) |
| 6.3 | Stage commits — proposed chunking: (1) shared prereqs (cap-guard params + audit extensions + FieldChange), (2) ConfigSuggestion model + registry flag, (3) config-suggest engine, (4) HTTP + upsert integration, (5) frontend |
| 6.4 | Do NOT push without explicit go-ahead |

## Dependency graph

```
1.0,1.1 (audit) ─┐
1.2 (cap-guard)  ├─→ 3.* (engine uses them)
1.3 (registry)   ┘
                 │
2.0 (model)      ┴→ 3.3 (service persists)
3.0,3.1,3.2,3.3  → 4.* (controller calls service)
4.* → 5.* (frontend calls API)
```

## Estimated complexity

- Wave 1: ~1h (shared mechanical)
- Wave 2: ~30min (one model)
- Wave 3: ~2.5h (engine is the meat — parser + service)
- Wave 4: ~1.5h (controller + route + upsert hook)
- Wave 5: ~2h (UI polish + manual smoke)
- Wave 6: ~30min

**Total: ~8h.** Less than 001 (~12-14h) because the LLM/cap-guard scaffolding is already built.

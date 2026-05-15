# Task Breakdown — 003-nl-report-queries

TDD-ordered. 5 waves. Each wave ends with `rtk tsc` + targeted `rtk vitest` green.

Legend: `[ST]` shared, `[BE]` backend, `[FE]` frontend.

---

## Wave 1 — Shared prerequisites + regression-guard fix

| # | Task | File(s) | Test first |
|---|---|---|---|
| 1.0 | [ST] Add `'ai_nl_report_query'` to `AuditAction` union + `AUDIT_ACTIONS` array | `shared/types.ts`, `shared/audit.ts` | TS compile suffices (mirror 001/002) |
| 1.1 | [ST] Create `requireRole(roles)` middleware (§10.1) | NEW `middleware/requireRole.ts` | NEW `middleware/__tests__/requireRole.test.ts` — 401 unauthenticated, 403 wrong role, next() on allowed |
| 1.2 | [BE] Fix the `report-registry.ts:183` regression-guard sites (Story 4) — rename local var so the explicit form replaces shorthand at every flagged site | `modules/governance/report-registry.ts` | The existing `__tests__/regression-guards/aggregate-collegeid-pattern.test.ts` is the test — it goes from FAIL to PASS in this task. Re-run after each site change to confirm zero flagged sites remain. |
| 1.3 | Wave gate | `rtk tsc` + full `rtk vitest` (the regression guard now PASSES — Wave 1 actually fixes the long-standing failure) | — |

## Wave 2 — Data layer

| # | Task | File(s) | Test first |
|---|---|---|---|
| 2.0 | [BE] Create `NlReportQuery` Mongoose model | NEW `models/governance/NlReportQuery.ts`, register in `models/index.ts` | NEW `models/governance/__tests__/NlReportQuery.test.ts` — persistence, `status` + `source` enum enforcement, indexes present, multi-tenant `collegeId` required |
| 2.1 | Wave gate | `rtk tsc` + new model tests green | — |

## Wave 3 — NL-reports engine (pure / stateful)

| # | Task | File(s) | Test first |
|---|---|---|---|
| 3.0 | [BE] `prompt.ts` — system + user `LLMMessage[]` with exact allow-list shapes from §10.5; `PROMPT_VERSION` exported | NEW `modules/governance/nl-reports/prompt.ts` | NEW `__tests__/prompt.test.ts` — system mentions JSON; both `from`/`to` AND `status` allow-listed; PROMPT_VERSION stable |
| 3.1 | [BE] `parser.ts` — strict JSON + fence strip + Zod discriminated union | NEW `nl-reports/parser.ts` | NEW `__tests__/parser.test.ts` — happy, malformed, unknown reportCode, missing required keys |
| 3.2 | [BE] `validator.ts` — allow-list, param-shape per reportCode, date bounds | NEW `nl-reports/validator.ts` | NEW `__tests__/validator.test.ts` — coverage per §10.8/§10.9: from > to refused, > 5y past refused, > 1y future refused, missing `from`/`to` refused, student-roster-snapshot status enum enforced |
| 3.3 | [BE] `cap-guard.ts` thin wrapper — namespace `'nl-reports'`, env `NL_REPORT_DAILY_LLM_CAP` (default 30) | NEW `nl-reports/cap-guard.ts` | NEW `__tests__/cap-guard.test.ts` — namespace propagates; env override honoured |
| 3.4 | [BE] `dedup.ts` — Redis 30s SETEX dedup with sha1(maskedQuestion) | NEW `nl-reports/dedup.ts` | NEW `__tests__/dedup.test.ts` — hit returns cached, miss returns null, key is namespaced by collegeId |
| 3.5 | [BE] `service.ts` — `nlQuery(...)` orchestrator (11 steps) + `getNlReportStats(...)`. **GATE 3 M-1**: 4-arg `runReport(collegeId, code, parameters, performedBy)`. **GATE 3 M-2**: if `runDoc.status !== 'success'`, convert to refused with `reason: 'report_run_failed'`. | NEW `nl-reports/service.ts` | NEW `__tests__/service.integration.test.ts` (mongo-memory + mocked LLM/Redis) — happy, cap-reached, LLM timeout, refused-by-validator, 30s dedup, multi-tenancy 404, stats $facet aggregation, AND defensive `runDoc.status !== 'success'` path. |
| 3.6 | Wave gate | `rtk tsc` + all nl-reports tests green | — |

## Wave 4 — HTTP

| # | Task | File(s) | Test first |
|---|---|---|---|
| 4.0 | [BE] Zod schemas: `nlQuerySchema`, `nlStatsQuerySchema` | `modules/governance/validation.ts` (extend or create) | Type compile + extending tests |
| 4.1 | [BE] Controller handlers: `nlQueryHandler`, `nlStatsHandler` | `modules/governance/report-controller.ts` | Supertest-style smoke per scenario from §10.11 contract table |
| 4.2 | [BE] Routes: `POST /reports/nl-query` and `GET /reports/nl-query/stats` (both with `authorize` + `requireRole` + `validate`) | `modules/governance/routes.ts` | Routes tests cover 401 / 403 / 400 / 200 matched / 200 refused / 200 dedup / 200 cap-reached |
| 4.3 | Wave gate | full backend `rtk tsc` + `rtk vitest` green | — |

## Wave 5 — Frontend

| # | Task | File(s) | Test first |
|---|---|---|---|
| 5.0 | [FE] Service additions: typed `NlQueryResponse` + `NlReportStats`; clients `runNlQuery` + `getNlReportStats` | `admin-portal/src/services/governance.ts` | n/a (thin axios) |
| 5.1 | [FE] `NlQueryPanel` component: textarea, Ask button, banner with `Auto-selected: <reportName>`, rationale, "Run as picker" callback, refused-chip list | NEW `admin-portal/src/components/governance/NlQueryPanel.tsx` | NEW `__tests__/NlQueryPanel.test.tsx` — textarea renders, Ask fires runNlQuery, matched renders banner + rationale, refused renders chips, "Run as picker" callback called with reportCode + params |
| 5.2 | [FE] `ReportsPage`: mount NlQueryPanel above existing picker. Visible only when `user.role` ∈ {admin, super_admin}. On "Run as picker" callback, pre-fill the existing picker form. | `admin-portal/src/pages/governance/ReportsPage.tsx` | Manual smoke: Vite + dev backend. Admin sees panel; HOD doesn't. Ask flow renders banner; click "Run as picker" → existing form pre-fills. |
| 5.3 | Wave gate | `rtk tsc` (frontend) + Vite boots + targeted vitest green | — |

## Wave 6 — Finalize

| # | Task |
|---|---|
| 6.1 | Full `rtk tsc` both workspaces |
| 6.2 | Full `rtk vitest` both workspaces (`aggregate-collegeid-pattern` regression now passes — Wave 1 fixed it; verify) |
| 6.3 | Stage commits — proposed chunking: (1) shared prereqs (audit enum + requireRole), (2) report-registry regression-guard fix on its own commit (clean review), (3) NlReportQuery model, (4) nl-reports engine, (5) HTTP + routes, (6) frontend |
| 6.4 | Do NOT push without explicit go-ahead |

## Dependency graph

```
1.0 (audit enum) ─┐
1.1 (requireRole) ┤
1.2 (registry fix)┘    ─→ Independent; Wave 1 can interleave
                      
2.0 (model)            ─→ 3.5 (service persists), 4.x (handlers read)

3.0 (prompt) ──┐
3.1 (parser)   ┤
3.2 (validator)┼─→ 3.5 (service orchestrates)
3.3 (cap-guard)┤
3.4 (dedup)    ┘

3.5 (service) ──→ 4.x (controllers + routes call service)
4.x → 5.x (frontend calls API)
```

## Estimated complexity

- Wave 1: ~1h (shared mechanical + regression-guard fix is a couple of var renames)
- Wave 2: ~30min (one model)
- Wave 3: ~3h (engine is the meat; validator + dedup add complexity beyond 002's surface area)
- Wave 4: ~1.5h (controllers + routes)
- Wave 5: ~2h (UI + manual smoke)
- Wave 6: ~30min

**Total: ~8.5h.** Slightly more than 002 because of the dedup + validator additions, slightly less than 001 because LLM infra is now reusable shrapnel.

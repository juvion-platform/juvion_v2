# Implementation Plan — 003-nl-report-queries

**Source spec:** `.sdd/specs/003-nl-report-queries/spec.md` (post-GATE 2, with §10 remediations)
**Owner module:** M11 Governance — new sub-module `modules/governance/nl-reports/`
**Scope reminder:** Narrow v1. Admin / super_admin only. 3-report allow-list. Includes the `report-registry.ts:183` regression-guard fix (Story 4).

## Architecture at a glance

```
POST /api/governance/reports/nl-query
        │
        ▼
authorize('governance','read') ─ requireRole(['admin','super_admin']) ─ validate(nlQuerySchema) ─┐
                                                                                                 │
                                                                                                 ▼
nl-reports/service.ts: nlQuery(collegeId, question, performedBy)
  1. Mask PII on question  (shared/llm/pii.maskPII)
  2. 30s dedup lookup     (Redis key: nl-report-dedup:<collegeId>:<sha1(masked)>)
        hit → return prior + isDuplicate:true (no LLM, no DB write)
  3. Cap-guard claim      (shared tryClaimLLMSlot with 'nl-reports' namespace)
        denied → persist NlReportQuery(refused, reason:'cap_reached'), return 200 refused
  4. Build prompt          (nl-reports/prompt.ts — 3-report allow-list)
  5. 10s AbortController, LLM call  (juvi/finance-agent llm-client)
        timeout → persist NlReportQuery(refused, reason:'timeout'), return 200 refused
  6. Parse + validate      (nl-reports/parser.ts → nl-reports/validator.ts)
        - JSON schema (Zod discriminated union)
        - allow-list check (defense vs LLM hallucination)
        - param shape per reportCode
        - date bounds (today−5y .. today+1y, from<=to)
        invalid → persist refused, return 200 refused
  7. report-service.runReport(collegeId, reportCode, params, performedBy) — existing layer
     - GATE 3 M-1: signature is 4-arg, not 2-arg.
     - GATE 3 M-2: if runDoc.status !== 'success' (e.g. 'failed' or 'unimplemented'
       — should be impossible given the allow-list but defensive), convert to a
       refused response with reason 'report_run_failed' and persist NlReportQuery
       accordingly. Do not surface a partial ReportRun via the NL surface.
  8. Persist NlReportQuery (matched, runId, params, costInr)
  9. createAuditLog('ai_nl_report_query') — entityName = selectedReport, performedBy
 10. Redis SETEX (30s dedup cache)
 11. Return 200 matched with results

GET /api/governance/reports/nl-query/stats?range=today|week|month
        │
        ▼
nl-reports/service.ts: getNlReportStats(collegeId, range)
  $facet pipeline: byStatus / byReport (matched only) / total
  First $match stage filters by { collegeId: ObjectId, generatedAt: { $gte } }
```

## File-by-file changes

### A. Shared prerequisites

| File | Change |
|---|---|
| `backend/src/shared/types.ts` | Add `'ai_nl_report_query'` to `AuditAction` union |
| `backend/src/shared/audit.ts` | Add `'ai_nl_report_query'` to `AUDIT_ACTIONS` array |
| `backend/src/middleware/requireRole.ts` | **NEW** — declarative `requireRole(roles: ReadonlyArray<string>)` (§10.1). 401 if unauthenticated, 403 if role not in list. ~10 lines. |

### B. Data layer

| File | Change |
|---|---|
| `backend/src/models/governance/NlReportQuery.ts` | **NEW** — Mongoose model per spec §3 + §10.4 (`llmModel` not `model`; `reason` not `refusalReason`; `status` + `source` enums). Indexes: `{collegeId:1, generatedAt:-1}` and `{collegeId:1, status:1, generatedAt:-1}`. |
| `backend/src/models/index.ts` | Re-export `NlReportQuery` |

### C. Pre-existing regression-guard fix (Story 4)

| File | Change |
|---|---|
| `backend/src/modules/governance/report-registry.ts` | At every site the `aggregate-collegeid-pattern` regression-guard flags (currently line 183 + possibly siblings), rename the local var so the explicit `{ collegeId: cidObj, ... }` form replaces the shorthand. Runtime unchanged — this is a static lint compliance fix. Re-run the guard test after to confirm zero flagged sites remain. |

### D. NL-reports sub-module (NEW dir)

`backend/src/modules/governance/nl-reports/`:

| File | Responsibility |
|---|---|
| `prompt.ts` | `buildNlReportPrompt({ today, maskedQuestion })` → `[system, user]` LLMMessage. System pins the 3-report allow-list (with exact param shapes per §10.5) + JSON-only output schema. Exports `PROMPT_VERSION = 'nl-report-prompt-v1'`. |
| `parser.ts` | Strict JSON parse with fence stripping; Zod `discriminatedUnion('status', ...)` validation (§10.8). Returns `{ ok, value } \| { ok: false, reason }`. |
| `validator.ts` | Post-parse semantic validator: (a) `reportCode` in `ALLOWED_REPORTS`, (b) param-shape per code, (c) date bounds. Returns `{ ok, normalized: { reportCode, params } } \| { refused, reason }`. |
| `cap-guard.ts` | Thin wrapper: `tryClaimNlReportSlot(collegeId, now?)` → `tryClaimLLMSlot(collegeId, cap, now, 'nl-reports')`. Reads `NL_REPORT_DAILY_LLM_CAP` env (default 30). |
| `dedup.ts` | `getCachedNlQuery(collegeId, maskedQuestion)` + `setCachedNlQuery(collegeId, maskedQuestion, response)` via the existing `config/redis` singleton. 30s TTL. |
| `service.ts` | `nlQuery(collegeId, rawQuestion, performedBy)` orchestrates the 11 steps above. Also `getNlReportStats(collegeId, range)`. |

### E. HTTP wiring

| File | Change |
|---|---|
| `backend/src/modules/governance/validation.ts` (NEW or extend if it exists) | Zod `nlQuerySchema` (`{ question: z.string().trim().min(1).max(500) }`) + `nlStatsQuerySchema` (`{ range: z.enum(['today','week','month']).optional() }`). |
| `backend/src/modules/governance/report-controller.ts` | Add `nlQueryHandler` + `nlStatsHandler`. Delegate to `nl-reports/service`. |
| `backend/src/modules/governance/routes.ts` | Mount: `POST /reports/nl-query` (with `authorize` + `requireRole` + `validate`) and `GET /reports/nl-query/stats` (with `authorize` + `requireRole` + `validate`). |

### F. Frontend

| File | Change |
|---|---|
| `admin-portal/src/services/governance.ts` | Typed `NlQueryResponse` + `NlReportStats`. Clients `runNlQuery(question)` + `getNlReportStats(range)`. |
| `admin-portal/src/components/governance/NlQueryPanel.tsx` | **NEW** — textarea + "Ask" button + result panel ("Auto-selected: <reportName>" banner with rationale + "Run as picker" escape hatch + refused chip list). Only renders when `req.user.role` is admin or super_admin (parent gates this). |
| `admin-portal/src/pages/governance/ReportsPage.tsx` | Mount `<NlQueryPanel />` above the existing picker. Gate display on `useAuthStore().user?.role`. Pass the `selectedReport + params` to the existing picker form when "Run as picker" is clicked (re-uses existing param form). |

### G. Tests (TDD with each file)

| File | Coverage |
|---|---|
| `backend/src/middleware/__tests__/requireRole.test.ts` | 401 unauthenticated, 403 wrong role, next() on allowed role. |
| `backend/src/models/governance/__tests__/NlReportQuery.test.ts` | Persistence, enums, indexes, multi-tenancy guard. |
| `backend/src/modules/governance/nl-reports/__tests__/prompt.test.ts` | Allow-list in system, exact param keys from §10.5 mentioned, JSON-only instruction, PROMPT_VERSION stable. |
| `backend/src/modules/governance/nl-reports/__tests__/parser.test.ts` | Strict JSON, fence stripping, Zod discriminated union, unknown reportCode → reject. |
| `backend/src/modules/governance/nl-reports/__tests__/validator.test.ts` | Allow-list check, per-code param shape, date bounds (today−5y to today+1y), reject impossible ranges. |
| `backend/src/modules/governance/nl-reports/__tests__/cap-guard.test.ts` | Namespace `'nl-reports'` passed through, env-cap honoured. |
| `backend/src/modules/governance/nl-reports/__tests__/dedup.test.ts` | 30s SETEX, cache hit returns prior, cache miss returns null. |
| `backend/src/modules/governance/nl-reports/__tests__/service.integration.test.ts` | mongo-memory + mocked LLM + mocked Redis. Happy path, cap reached, LLM timeout, refused-by-validator, dedup-on-second-call, multi-tenancy. |
| `backend/src/modules/governance/__tests__/nl-report-routes.test.ts` | Supertest-style: 401 / 403 / 400 / 200 matched / 200 refused contract per §10.11. |
| `admin-portal/src/components/governance/__tests__/NlQueryPanel.test.tsx` | Renders textarea + Ask button. On matched response, renders banner + rationale. On refused, renders refusal + chips. Run-as-picker callback fires with the selected report. |

## Risks

| Risk | Mitigation |
|---|---|
| LLM picks a Phase B stub anyway | Allow-list Zod enum (parser) + validator double-check; both branches converge on `refused` with `reason: 'unsupported_report'` |
| Question contains user-visible PII | Masked before LLM (PII never leaves Juvion); masked form stored everywhere |
| Cap-guard collision with lead-scoring / config-suggest | Distinct namespace `'nl-reports'`; tests pin all three namespaces independently |
| Regression-guard fix breaks an unrelated runner | The fix is a variable rename — runtime semantics identical; full test suite must pass post-fix |
| Frontend role gate hides the textarea but backend still gets a non-admin request | Backend `requireRole` middleware is the authoritative gate — frontend is UX, not security |
| `report-service.runReport` errors during NL flow | Treat as 500 (unexpected); the validator should have caught structural problems earlier |

## Out-of-scope (logged for follow-up)

- Multi-step / clarification dialogs ("did you mean A or B?")
- NL on Phase B stubs (would require implementing 10 more runners — separate effort)
- Cross-persona NL (HOD / student / parent) — requires row-level RBAC at the query layer
- Saved / favourited NL queries
- Free-form ad-hoc aggregation outside the allow-list

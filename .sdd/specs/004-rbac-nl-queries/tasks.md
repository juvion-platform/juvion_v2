# Task Breakdown — 004-rbac-nl-queries

TDD-ordered. 8 slices (per plan.md). Each slice ends with `rtk tsc` + targeted `rtk vitest` green and is committable on its own.

Legend: `[ST]` shared/rbac, `[BE]` backend, `[FE]` frontend, `[T]` test-first.

---

## Slice A — Policy seed (§10.9)

Adds 3 policy rows to `DEFAULT_POLICIES`. No runtime behavior change yet (RBAC_NL_ENFORCE is off by default).

| # | Task | File(s) | Test first |
|---|---|---|---|
| A.1 | [T] Test that `DEFAULT_POLICIES` contains the 3 new rows with correct priorities and scope shapes | NEW `shared/rbac/__tests__/defaults-governance-004.test.ts` | Write the assertion: `hod/governance/read` allow+departmentOnly priority 800; `faculty/governance/read` allow+departmentOnly priority 700; `staff/governance/read` deny priority 700. Expect FAIL. |
| A.2 | [ST] Add the 3 policy rows | `shared/rbac/defaults.ts` | A.1 should now PASS. |
| A.3 | [T] Integration test: `evaluateAccess(college, 'hod', 'F-HOD', 'governance', 'read')` returns allow + `{ departmentOnly: true }`. `evaluateAccess('staff', 'ST-WARDEN', 'governance', 'read')` returns deny. | EXTEND `shared/rbac/__tests__/engine.test.ts` or new `engine-governance-004.test.ts` | Green after A.2. |
| A.4 | Slice gate | `rtk tsc` backend + the 3 A.* tests green. Existing engine/defaults tests must remain green (no regression). |

## Slice B — Registry type extension + Phase B placeholders

Tighten the types and declare scope-eligibility on every runner. All declarations stay `admin-only` for the 9 stubs and 2 of the 3 implemented runners; `student-roster-snapshot` declares `{ departmentOnly: 'supported', selfOnly: 'admin-only' }`.

| # | Task | File(s) | Test first |
|---|---|---|---|
| B.1 | [T] Test that every `ReportDefinition` in `REPORT_REGISTRY` has `scopeEligibility` populated (loops through array) | NEW `modules/governance/__tests__/registry-scope-eligibility.test.ts` | Write the assertion. FAIL pre-declarations. |
| B.2 | [BE] Extend types in `report-registry.ts`: `ReportRunContext` gains required `authScope: AuthScope`; `ReportDefinition` gains required `scopeEligibility: { departmentOnly, selfOnly }` union of `'supported'\|'admin-only'`. Add the new union types if needed. | `modules/governance/report-registry.ts` | TS will fail to compile until B.3 runs. |
| B.3 | [BE] Add `scopeEligibility` to every of the 12 `ReportDefinition`s. 11 are `{ departmentOnly: 'admin-only', selfOnly: 'admin-only' }`. `student-roster-snapshot` is `{ departmentOnly: 'supported', selfOnly: 'admin-only' }`. | `modules/governance/report-registry.ts` (12 sites) | TS compiles. B.1 PASSES. |
| B.4 | [BE] Make `ReportRunContext.authScope` non-optional in the 12 `run()` signatures. Use `ctx.authScope` references where useful (most runners are admin-only and don't need it; just have the param). | same file | TS clean. |
| B.5 | Slice gate | `rtk tsc` + B.1 + existing registry/service tests still green. |

## Slice C — `runReport` eligibility gate (§10.10)

Add the pre-side-effect gate. New `ScopeNotSupportedError`. Existing `runReport` callers pass `req.authScope!` (post-`authorize()` always defined; pre-`authorize()` callers — `requireRole` path — get an admin-equivalent sentinel `{ departmentOnly: false, selfOnly: false, userId: req.user.id, ... }`).

| # | Task | File(s) | Test first |
|---|---|---|---|
| C.1 | [T] Test: 4 branches of the gate fire correctly (admin-only-dept, admin-only-self, unresolved-dept, unresolved-self). Each branch asserts: `ScopeNotSupportedError` thrown with `(reportCode, dimension, kind)`; AND `ReportRun.countDocuments({ collegeId }) === 0` after the throw (pre-side-effect). | NEW `modules/governance/__tests__/report-service-eligibility.test.ts` | All 4 cases FAIL. |
| C.2 | [BE] Define `ScopeNotSupportedError` class. Three fields: `reportCode`, `dimension: 'department'\|'self'`, `kind: 'role-not-eligible'\|'scope-unresolved'`. | NEW `modules/governance/errors.ts` (or extend existing errors file) | n/a |
| C.3 | [BE] Implement the gate inside `runReport`. Order per §10.10 pseudocode: admin-only checks first, then unresolved-discriminator checks, then `ReportRun.create()`. | `modules/governance/report-service.ts` | C.1 PASSES. |
| C.4 | [BE] `runReport` signature: 5th arg `authScope: AuthScope` REQUIRED. Update existing callers: `report-controller.ts` (REST runReport endpoint) passes `req.authScope!`; `nl-reports/service.ts` passes the authScope from `nlQuery` opts (defaulting to admin-sentinel for `RBAC_NL_ENFORCE=false` path). | `report-service.ts`, `report-controller.ts`, `nl-reports/service.ts` | TS clean + existing report-service tests still green. |
| C.5 | [T] Test that admin path (sentinel authScope, `departmentOnly: false, selfOnly: false`) bypasses the gate and invokes the runner unchanged. | Extend `report-service-eligibility.test.ts` | Green after C.3 + C.4. |
| C.6 | Slice gate | `rtk tsc` + report-service tests green. |

## Slice D — `student-roster-snapshot` runner scope-aware

| # | Task | File(s) | Test first |
|---|---|---|---|
| D.1 | [T] Integration test for HOD roster scope. 2-tenant fixture. HOD-A1 in tenant A, dept A1 (3 branches, 30 students). HOD-B1 in tenant B, dept B1 (similar). Admin in tenant A. (a) HOD-A1 runs roster → sees ONLY A1 dept students, count = 30. (b) HOD-B1 → sees ONLY B1 dept. (c) Admin → sees full tenant A roster, NOT tenant B. (d) Faculty in dept A2 → sees A2 only. | NEW `modules/governance/__tests__/student-roster-rbac.test.ts` | All cases FAIL initially. |
| D.2 | [T] Test that an HOD with `Faculty.departmentId: undefined` is refused by the eligibility gate with `scope-unresolved`. | Add case to C.1 or to D.1 (either is fine; preference D.1 for locality) | FAILS pre-fix. |
| D.3 | [BE] Inside `student-roster-snapshot.run`: when `authScope.departmentOnly && authScope.departmentId`, look up `Branch.find({ collegeId: cidObj, departmentId: new Types.ObjectId(authScope.departmentId) }, { _id: 1 }).lean()`, push `match.branchId = { $in: branchIds }`. Otherwise (admin path): no change. Wrap `cidObj` exactly per §10.3 pattern. | `modules/governance/report-registry.ts` (`student-roster-snapshot.run`) | D.1 + D.2 PASS. |
| D.4 | [BE] Add index `{ collegeId: 1, departmentId: 1 }` on `Branch` model. | `models/academic-structure/Branch.ts` | n/a (Mongoose builds index on next start) |
| D.5 | [BE] Add index `{ collegeId: 1, branchId: 1, status: 1 }` on `Student` model. | `models/people/Student.ts` | n/a |
| D.6 | [T] NEW helper `seedRbacTestFixtures.ts` per §10.8. Used by D.1 and later slices. | NEW `modules/governance/__tests__/helpers/seedRbacTestFixtures.ts` | The helper IS the test infrastructure; covered by D.1's green. |
| D.7 | Slice gate | `rtk tsc` + D.* tests green. |

## Slice E — NL service plumbing + dedup fingerprint (§10.4)

| # | Task | File(s) | Test first |
|---|---|---|---|
| E.1 | [T] Update dedup tests to cover the 5 cases from §10.4: same-dept-HODs share, different-dept differ, undefined-personId differentiates by userId, admin vs non-admin differ, HOD vs counsellor differ. | EXTEND `nl-reports/__tests__/dedup.test.ts` | FAIL pre-fix. |
| E.2 | [BE] Replace dedup key construction with full scope-fingerprint hash per §10.4. Input is the discriminator-tuple delimiter-joined string; output is sha1. | `nl-reports/dedup.ts` | E.1 PASSES. |
| E.3 | [T] Service-level integration: HOD asks roster question → matched scope-aware result. HOD asks admissions-funnel → refused with `reason: 'report-not-scopable-for-role'` + `reasonDimension: 'department'`. HOD with unresolved departmentId → `scope-unresolved`. | EXTEND `nl-reports/__tests__/service.integration.test.ts` | FAIL pre-fix. |
| E.4 | [BE] `nlQuery` opts gain `authScope` (required), `role`, `personaType` (both optional). Pass `authScope` to `runReport`. Catch `ScopeNotSupportedError` → refused response with `reason` + `reasonDimension`. | `nl-reports/service.ts` | E.3 PASSES. |
| E.5 | [BE] Compute persona-filtered `supportedReports` for EVERY refused branch (cap_reached, timeout, parser, report_run_failed, report-not-scopable-for-role, scope-unresolved). Helper: `supportedReportsFor(authScope)` reads `REPORT_REGISTRY` and filters by eligibility. | `nl-reports/service.ts` (helper + use sites) | Add case to E.3 — admin gets full list, HOD gets `['student-roster-snapshot']`. |
| E.6 | [BE] Persist `role`, `personaType`, `authScopeApplied`, `reasonDimension` on `NlReportQuery` (matched AND refused). | `nl-reports/service.ts` `persistAndAudit` | Add case to E.3 — assert the persisted doc carries the fields. |
| E.7 | Slice gate | `rtk tsc` + dedup + service.integration tests green. |

## Slice F — Route wrapper + stats byRole

| # | Task | File(s) | Test first |
|---|---|---|---|
| F.1 | [T] Route test: `RBAC_NL_ENFORCE='true'` HOD gets 200 matched on roster question; `RBAC_NL_ENFORCE='true'` ST-WARDEN gets 403 from authorize; `RBAC_NL_ENFORCE='true'` student gets 403; `RBAC_NL_ENFORCE='false'` HOD gets 403 from `requireRole` (today's hard gate); `RBAC_NL_ENFORCE='false'` admin gets 200 matched. | EXTEND `modules/governance/__tests__/nl-report-routes.test.ts` | FAIL pre-wrapper. |
| F.2 | [BE] Wrapper middleware: reads `process.env.RBAC_NL_ENFORCE` per request; dispatches to either `authorize('governance','read')` or `requireRole(['admin','super_admin'])`. Apply to both `/reports/nl-query` and `/reports/nl-query/stats`. | `modules/governance/routes.ts` | F.1 PASSES. |
| F.3 | [BE] Controller passes `req.authScope` (after authorize) OR an admin-sentinel (after requireRole admin path) + `req.user.role` + `req.user.personaType` into `nlQuery` opts. | `modules/governance/controller.ts` (or `report-controller.ts`) | F.1 still green. |
| F.4 | [T] Stats test: legacy 003 docs (no `role`) appear in `total` and `byReport` but NOT in `byRole`. New 004 docs with `role: 'hod'` appear in `byRole`. | EXTEND `nl-reports/__tests__/service.integration.test.ts` (or a `nl-report-stats.test.ts`) | FAIL pre-fix. |
| F.5 | [BE] Stats `$facet` pipeline: add `byRole` sub-pipeline with upstream `$match: { role: { $exists: true } }`. Existing facets unchanged. Project `{ role, count, costInr }`. | `nl-reports/service.ts` `getNlReportStats` | F.4 PASSES. |
| F.6 | Slice gate | `rtk tsc` + F.* tests green. |

## Slice G — Frontend

| # | Task | File(s) | Test first |
|---|---|---|---|
| G.1 | [T] NlQueryPanel test: on `mutation.onError` with `error.response?.status === 403`, render the policy-denied banner. Refused with `reasonDimension: 'department'` renders dept-specific copy. `scope-unresolved` renders data-quality copy. | EXTEND `admin-portal/src/components/governance/__tests__/NlQueryPanel.test.tsx` | FAIL pre-fix. |
| G.2 | [FE] Update `NlQueryResponse` type — add optional `reasonDimension`. Update `NlReportStats` type — add `byRole` field. | `admin-portal/src/services/governance.ts` | TS catches type mismatches in G.3 first. |
| G.3 | [FE] NlQueryPanel: render policy-denied banner on 403. Render `report-not-scopable-for-role` + `reasonDimension`-aware copy. Render `scope-unresolved` data-quality copy. Persona-filtered `supportedReports` chip list already wired (BE controls the list). | `admin-portal/src/components/governance/NlQueryPanel.tsx` | G.1 PASSES. |
| G.4 | [FE] Remove role gate on the NL panel — non-admin personas (HOD/faculty) reach the panel through their own login when policy allows. | `admin-portal/src/pages/governance/ReportsPage.tsx` | Manual: HOD login → panel renders; staff with `governance/read` deny → panel renders but 403 with banner. |
| G.5 | [FE] Add `byRole` breakdown UI to stats display (inline on Reports page or in NlReportsStatsPage if exists). | wherever NL stats render today | n/a (display-only; tested via the data shape) |
| G.6 | Slice gate | `rtk tsc` frontend + G.1 + Vite boots cleanly. |

## Slice H — Smoke + PR

| # | Task |
|---|---|
| H.1 | Full `rtk tsc` both workspaces. |
| H.2 | Full `rtk vitest` both workspaces. Watch for: aggregate-collegeid-pattern guard (still green), nl-report-routes, student-roster-rbac, service.integration, dedup, defaults-governance-004, engine-governance-004. |
| H.3 | Backend run: `RBAC_NL_ENFORCE='true'` in `.env.local`. Seed via existing seed script (which loads `DEFAULT_POLICIES`). |
| H.4 | Smoke 1: admin user → ask "show me the student roster" → 200 matched, full college's roster. |
| H.5 | Smoke 2: HOD fixture user → ask same → 200 matched, ONLY their department's branches' students. Verify count matches expected. |
| H.6 | Smoke 3: HOD asks "show me admissions funnel" → 200 refused with `reason: 'report-not-scopable-for-role'`, `reasonDimension: 'department'`. |
| H.7 | Smoke 4: Student fixture user (or any non-allowed role) → 403 with FE banner. |
| H.8 | Smoke 5: `RBAC_NL_ENFORCE='false'` → all the above HOD/student paths revert to 403 from `requireRole`. |
| H.9 | Stage commits per slice (or fewer if cohesive). Use `-F` flag with message file (heredoc breaks on single-quoted strings). |
| H.10 | Open PR against `main` with summary + test plan. Do NOT push without explicit user go-ahead. |

## Dependency graph

```
A (policy seed)             ─→ F (route wrapper authorize() calls evaluateAccess)

B (types) ─┐
C (runReport gate) ─→ D (roster runner uses gate)
                  ─→ E (nl service consumes gate)

D, E ────────────────────────→ F (route + stats)

F ───────────────────────────→ G (FE consumes wire shape)

G ───────────────────────────→ H (smoke)
```

Slices A and B can interleave (no overlap). C strictly after B. D strictly after C. E can begin after C but reads from D's runner change. F after both. G after F. H after G.

## Estimated complexity

- Slice A: ~30min (3 policy rows + 2 assertion tests)
- Slice B: ~45min (type tightening + 12 runner declarations)
- Slice C: ~1h (gate logic + new error class + 4-branch tests + caller updates)
- Slice D: ~1.5h (two-step Branch lookup + 2-tenant fixture is the meat)
- Slice E: ~1.5h (dedup fingerprint + service plumbing + supportedReportsFor + persistence)
- Slice F: ~1h (wrapper middleware + stats facet)
- Slice G: ~1h (3 banner variants + role-gate removal + byRole display)
- Slice H: ~1h (smoke variants + PR)

**Total: ~8.5h.** Comparable to 003 because new mechanics (Branch lookup, eligibility gate, scope fingerprint) trade against reuse of 003's existing NL infra (prompt/parser/validator/cap-guard untouched).

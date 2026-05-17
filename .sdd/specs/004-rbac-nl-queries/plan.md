# Implementation Plan — 004-rbac-nl-queries

**Source spec:** `.sdd/specs/004-rbac-nl-queries/spec.md` (post-GATE 2 amendment; see `gate2-resolution.md`)
**Owner module:** M11 Governance — touches `modules/governance/{report-registry,report-service,nl-reports/*}`, `middleware/authorize.ts` consumer side, `shared/rbac/defaults.ts` (policy seed only), and the admin-portal NL panel.
**Scope reminder:** v1 unlock = HOD + faculty for `student-roster-snapshot` only. Counsellor / cluster-head / other staff explicitly denied at policy layer; deferred to v1.5.

## Architecture at a glance

```
POST /api/governance/reports/nl-query
        │
        ▼
authenticate
        │
        ▼
rbacNlEnforce wrapper middleware (§10.6)
        │  reads RBAC_NL_ENFORCE per request
        ├─ if 'true':  authorize('governance','read')  → req.authScope
        └─ else:       requireRole(['admin','super_admin'])
                                        │
                                        ▼
                             validate(nlQuerySchema)
                                        │
                                        ▼
controller: nlQueryHandler
        passes { collegeId, question, performedBy, authScope, role, personaType }
                                        │
                                        ▼
nl-reports/service.ts: nlQuery(...)
   1. Mask PII (unchanged from 003)
   2. Dedup lookup with FULL scope fingerprint (§10.4)
   3. Cap-guard (unchanged)
   4. Build prompt (unchanged from 003)
   5. LLM call with 10s abort (unchanged)
   6. Parse + validate (unchanged)
   7. runReport(collegeId, code, params, performedBy, authScope)
        ───────────────────────────────────────────────
        report-service.runReport:
         a. getReportDefinition(code) — 404 if missing
         b. §10.10 ELIGIBILITY GATE (pre-side-effects):
              admin-only mismatch → ScopeNotSupportedError(code, dim, 'role-not-eligible')
              departmentOnly + !departmentId → ScopeNotSupportedError(code, 'department', 'scope-unresolved')
              selfOnly + !userId → ScopeNotSupportedError(code, 'self', 'scope-unresolved')
         c. ReportRun.create({ status: 'running', ... })
         d. def.run({ collegeId, authScope }, params)
              runner injects scope into $match (e.g., student-roster: Branch lookup + $in)
         e. ReportRun update with { status: 'success', result }
        ───────────────────────────────────────────────
   8. On ScopeNotSupportedError → refused response { reason, reasonDimension, supportedReports: <persona-filtered> }
   9. Persist NlReportQuery with role, personaType, authScopeApplied (§10.5)
  10. createAuditLog('ai_nl_report_query') — entityName, performedBy
  11. Dedup setex with scope-fingerprinted key
  12. Return 200

GET /api/governance/reports/nl-query/stats
   $facet now includes `byRole` sub-pipeline with upstream
   $match: { role: { $exists: true } } (Story 5 AC-2)
```

## File-by-file changes

### A. Policy seed (§10.9)

| File | Change |
|---|---|
| `backend/src/shared/rbac/defaults.ts` | ADD 3 new policy rows: `hod/governance/read` allow+departmentOnly priority 800; `faculty/governance/read` allow+departmentOnly priority 700; `staff/governance/read` deny priority 700. **No engine logic changes.** |

### B. RBAC / shared

| File | Change |
|---|---|
| `backend/src/shared/rbac/apply-scope.ts` | **NO changes** to the helper. 004 calls it from runners but does the `Types.ObjectId(...)` wrap at the call site (Mongoose doesn't auto-cast strings inside `$match`). |

### C. Report engine — registry + service

| File | Change |
|---|---|
| `backend/src/modules/governance/report-registry.ts` | (1) Extend `ReportRunContext` type to `{ collegeId: string, authScope: AuthScope }` — `authScope` REQUIRED (no `?`). (2) Extend `ReportDefinition` type to require `scopeEligibility: { departmentOnly: 'supported' \| 'admin-only', selfOnly: 'supported' \| 'admin-only' }`. (3) `admissions-funnel` declares `{ departmentOnly: 'admin-only', selfOnly: 'admin-only' }`. (4) `lead-source-performance` declares `{ departmentOnly: 'admin-only', selfOnly: 'admin-only' }`. (5) `student-roster-snapshot` declares `{ departmentOnly: 'supported', selfOnly: 'admin-only' }` and gains the Branch-lookup scope logic from §10.3. (6) All 9 Phase B stubs declare `{ departmentOnly: 'admin-only', selfOnly: 'admin-only' }`. |
| `backend/src/modules/governance/report-service.ts` | `runReport(collegeId, code, params, performedBy, authScope)` — 5th arg becomes REQUIRED. Implement §10.10 eligibility gate BEFORE `ReportRun.create()`. New `ScopeNotSupportedError` class exported from this module (or `shared/errors/`). |
| `backend/src/modules/governance/report-controller.ts` | Update `runReportHandler` (and any other callers) to pass `req.authScope!`. Post-`authorize()` this is always defined. |

### D. NL-reports sub-module

| File | Change |
|---|---|
| `backend/src/modules/governance/nl-reports/service.ts` | `nlQuery(...)` opts gain `authScope` (required), `role` (optional, for persistence), `personaType` (optional, for persistence). Pass `authScope` to `runReport`. Catch `ScopeNotSupportedError` → refused response with `reason: 'report-not-scopable-for-role' \| 'scope-unresolved'` and new `reasonDimension`. Compute persona-filtered `supportedReports` for every refused response (Story 4 AC-1). Persist `role`, `personaType`, `authScopeApplied` on `NlReportQuery` (§10.5). |
| `backend/src/modules/governance/nl-reports/dedup.ts` | Replace key construction with the full scope-fingerprint hash (§10.4). The sha1 import is already there; just extend the input string. |
| `backend/src/modules/governance/nl-reports/prompt.ts` | **NO change.** v1 keeps the same prompt for all personas. |
| `backend/src/modules/governance/nl-reports/parser.ts` | **NO change.** |
| `backend/src/modules/governance/nl-reports/validator.ts` | **NO change** (validator runs before runReport's eligibility gate). |
| `backend/src/modules/governance/nl-reports/cap-guard.ts` | **NO change.** |

### E. HTTP routing — `RBAC_NL_ENFORCE` wrapper

| File | Change |
|---|---|
| `backend/src/modules/governance/routes.ts` | Replace the hard `requireRole(['admin','super_admin'])` on the `/reports/nl-query` route with the §10.6 wrapper: reads `process.env.RBAC_NL_ENFORCE` per request, dispatches to either `authorize('governance','read')` or the legacy `requireRole`. Same wrapper on `/reports/nl-query/stats` (admins-only behavior preserved when flag is off). |
| `backend/src/modules/governance/controller.ts` (or `report-controller.ts`) | `nlQueryHandler` passes `req.authScope` + `req.user.role` + `req.user.personaType` into `nlQuery(...)` opts. Existing controller already takes `collegeId` + `question` + `performedBy`. |

### F. Models

| File | Change |
|---|---|
| `backend/src/models/governance/NlReportQuery.ts` | ADD optional fields per §10.5: `role?: string`, `personaType?: string`, `authScopeApplied?: { departmentOnly, selfOnly, departmentId?, personId?, userId? }`. ADD optional `reasonDimension?: 'department' \| 'self'` for sub-categorized refusals. No schema-breaking changes. |
| `backend/src/models/academic-structure/Branch.ts` | ADD compound index `{ collegeId: 1, departmentId: 1 }` for the §10.3 lookup. |
| `backend/src/models/people/Student.ts` | ADD compound index `{ collegeId: 1, branchId: 1, status: 1 }` for the `student-roster-snapshot` aggregation. |

### G. Stats

| File | Change |
|---|---|
| `backend/src/modules/governance/nl-reports/service.ts` (cont.) | `getNlReportStats(...)` $facet pipeline gains a `byRole` sub-stage. Upstream `$match: { role: { $exists: true } }` excludes pre-004 docs from byRole only (per Story 5 AC-2). |

### H. Frontend

| File | Change |
|---|---|
| `admin-portal/src/services/governance.ts` | Typed `NlQueryResponse` gains optional `reasonDimension?: 'department' \| 'self'`. `NlReportStats` gains `byRole: Array<{ role: string, count: number, costInr: number }>`. |
| `admin-portal/src/components/governance/NlQueryPanel.tsx` | (1) Handle `error.response?.status === 403` → render policy-denied banner (Story 6, §10.12). (2) Render refused responses with `reason === 'report-not-scopable-for-role'` using `reasonDimension`-aware copy. (3) Render `reason === 'scope-unresolved'` with the data-quality copy. (4) Show persona-filtered `supportedReports` chip list (already exists; just consumes the BE's filtered list). |
| `admin-portal/src/pages/governance/ReportsPage.tsx` | Remove the role gate that hides the NL panel from non-admins. After §10.9 seed, HOD/faculty users reach the panel through their own login. |
| `admin-portal/src/pages/governance/NlReportsStatsPage.tsx` (if exists; else inline in governance dashboard) | Display the new `byRole` breakdown in the stats UI. |

### I. Tests (TDD)

| File | Coverage |
|---|---|
| `backend/src/shared/rbac/__tests__/defaults.test.ts` (new or extend) | Verify the 3 new policy rows are present in `DEFAULT_POLICIES` and their priorities + scopes are correct. |
| `backend/src/modules/governance/__tests__/report-service-eligibility.test.ts` | NEW. Cover all 4 §10.10 gate branches: admin-only-mismatch (dept), admin-only-mismatch (self), unresolved-dept, unresolved-self. Each throws `ScopeNotSupportedError` with the right `(reportCode, dimension, kind)` and BEFORE `ReportRun.create()` (assertion: `ReportRun.countDocuments()` is 0 after the throw). |
| `backend/src/modules/governance/__tests__/registry-scope-eligibility.test.ts` | NEW. For each `ReportDefinition` in `REPORT_REGISTRY`, assert `scopeEligibility` is declared. Implicit type-safety also enforced by the required field. |
| `backend/src/modules/governance/__tests__/student-roster-rbac.test.ts` | NEW. Integration test. Seeds 2 tenants × {admin, HOD-A1, HOD-B1, faculty-A2}. HOD-A1 runs `student-roster-snapshot` → returns ONLY students in branches of dept A1. HOD-B1 → only dept B1. Faculty-A2 → only dept A2. Admin → entire college. Cross-tenant rows planted in tenant B; HOD-A1 must not see them. |
| `backend/src/modules/governance/nl-reports/__tests__/dedup.test.ts` | EXTEND existing test (or REPLACE if too tangled). Same scope-discriminator inputs → same key; different inputs → different keys. Cases listed in §10.4. |
| `backend/src/modules/governance/nl-reports/__tests__/service.integration.test.ts` | EXTEND. Add HOD + faculty paths through `nlQuery` end-to-end (mocked LLM). Cover refusal sub-categories: HOD asks for `admissions-funnel` → `report-not-scopable-for-role` + `reasonDimension: 'department'`. HOD with `Faculty.departmentId: undefined` → `scope-unresolved`. |
| `backend/src/modules/governance/__tests__/nl-report-routes.test.ts` | EXTEND. With `RBAC_NL_ENFORCE='true'`, HOD user receives 200 matched on roster question; staff user receives 403 from `authorize` (per §10.9 deny); student receives 403. With `RBAC_NL_ENFORCE='false'`, all behave as today. |
| `backend/src/modules/governance/__tests__/nl-report-stats.test.ts` | EXTEND. `byRole` facet excludes legacy docs (rows without `role`); includes new 004 docs. |
| `backend/src/modules/governance/__tests__/helpers/seedRbacTestFixtures.ts` | NEW helper. Seeds the full Department → Branch → Faculty → User → Policy chain per §10.8. Reused by all integration tests above. |
| `admin-portal/src/components/governance/__tests__/NlQueryPanel.test.tsx` | EXTEND. New cases: 403 from `authorize` renders policy-denied banner; refused with `reasonDimension: 'department'` renders dept-specific copy; `scope-unresolved` renders data-quality copy. |

## Implementation order (TDD slices)

Each slice ships as a single git commit. Tests written first, then code.

1. **Slice A — Policy seed (Story 1/2/3 prereq).** `defaults.ts` adds 3 rows. Tests assert presence + priorities. No runtime behavior yet (RBAC_NL_ENFORCE still off by default).
2. **Slice B — Registry type extension + Phase B placeholders.** `ReportRunContext.authScope` becomes required; `ReportDefinition.scopeEligibility` becomes required; all 12 runners declare admin-only or supported. Tests: registry-scope-eligibility.test.ts. No behavior change yet because authScope sentinels are admin-equivalent.
3. **Slice C — `runReport` eligibility gate.** §10.10 implemented. `ScopeNotSupportedError` class. Tests: report-service-eligibility.test.ts (all 4 branches green pre-side-effect).
4. **Slice D — `student-roster-snapshot` runner scope-aware.** Two-step Branch lookup + ObjectId wrap. Branch and Student indexes added. Tests: student-roster-rbac.test.ts.
5. **Slice E — NL service plumbing.** `nlQuery` accepts authScope/role/personaType; catches ScopeNotSupportedError; computes persona-filtered supportedReports; persists new NlReportQuery fields. Dedup-key scope-fingerprint. Tests: dedup.test.ts updates + service.integration.test.ts updates.
6. **Slice F — Route wrapper + stats byRole.** `routes.ts` wrapper for `RBAC_NL_ENFORCE`. Stats facet adds byRole. Tests: nl-report-routes.test.ts updates, nl-report-stats.test.ts updates.
7. **Slice G — Frontend.** NlQueryPanel handles 403 + new refusal sub-categories. Tests: NlQueryPanel.test.tsx updates.
8. **Slice H — Smoke + PR.** End-to-end smoke with `RBAC_NL_ENFORCE='true'` against a seeded HOD fixture. PR draft.

## Risks

| Risk | Mitigation |
|------|-----------|
| Staff users still slip through despite §10.9 deny | Integration test in nl-report-routes.test.ts asserts 403 for ST-ADM-AC, ST-WARDEN, ST-TPO (random staff personas) when `RBAC_NL_ENFORCE='true'`. |
| HOD's `Faculty.departmentId` is null in production (data quality) | §10.10 fail-closed gate refuses with `scope-unresolved`. HOD sees data-quality banner; no unscoped data exposed. |
| Branch lookup adds latency that compounds over many simultaneous requests | Branch.find with new `{collegeId, departmentId}` index is sub-ms; ~10 rows max. p95 latency target unchanged (§5). Worst case: a future high-volume tenant — denormalize departmentId onto Student in v2. |
| Scope-fingerprint hash collisions | sha1 over a deterministic delimiter-joined string. Collision probability negligible at our scale (millions of queries). The cached payload itself includes the report code + results — even a hypothetical collision is bounded. |
| `RBAC_NL_ENFORCE` flag flip ordering vs policy seed | Spec §10.9 rollout sequence explicitly puts seed load BEFORE flag flip; spec §10.6 wrapper falls back to admin-only `requireRole` if flag is off. Worst case: flag flipped before seed → all HOD/faculty get 403 from `authorize` (no harm, just no access). Recoverable. |
| Pre-004 NlReportQuery docs cause stats facet to emit `{ role: null }` | `byRole` sub-pipeline uses upstream `$match: { role: { $exists: true } }`. Other facets unaffected. |
| Cross-persona dedup-cache leakage | Full scope-fingerprint key (§10.4). 5 cases enumerated in the spec; all green by construction. Test in dedup.test.ts exercises every case. |
| Optional `authScope` slip-through during refactor | `authScope` is required on `ReportRunContext`, `runReport`, and `nlQuery` opts. TypeScript enforces. No paths bypass. |

## Out-of-scope (logged for v1.5+)

- Counsellor (ST-ADM-AC) selfOnly support — needs `Inquiry.assignedTo` → `assignedOfficerId` backfill.
- Cluster head (ST-ADM-AO-CH) departmentOnly support — needs `Staff.departmentId` population OR alternative scope model.
- Other staff personas (warden, TPO, librarian, etc.) — per-persona unlocks once a use case is clear.
- Student / parent NL — different surface (personal data); Phase C.
- HOD `admissions-funnel` access — requires `Inquiry` model change (canonical `departmentId`/`branchId` ObjectId field).
- Per-persona prompt allowlist — token-cost optimization; not behavior change.
- Programme dimension for HOD `student-roster-snapshot` — OQ-1 deferred default.
- `RBAC_NL_ENFORCE` flag sunset — 60 days post-rollout cleanup ticket.

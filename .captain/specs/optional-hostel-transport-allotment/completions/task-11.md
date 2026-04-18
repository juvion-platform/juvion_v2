# Completion: Task 11 — Extend RBAC defaults

**Feature:** optional-hostel-transport-allotment
**Completed:** 2026-04-18 00:35
**Person:** srinikandula
**Final Status:** Refactored

## Test Results

- Unit tests (new): **12 passed, 0 failed**
  - `src/shared/rbac/__tests__/defaults-optional-allotment.test.ts`
- RBAC test suite (all 6 files): **46 passed, 0 failed** (34 existing + 12 new)
- Full backend suite: **92 passed, 0 failed** across 11 test files (no regressions from 80/80 baseline)
- TypeScript strict (`npm run typecheck`): **0 errors**

## Spec Coverage

| Acceptance Criterion | Tests | Status |
|---|---|---|
| New persona `ST-TRANSPORT-OFFICER` with `subDomain: 'transport'` on `campus` module | 3 tests (shape + description + behavioral resolution across all 4 actions) | Covered |
| Warden extension to `campus` module with `subDomain: 'hostel'` | 3 tests (shape + preserves existing welfare policy + behavioral win over fallback) | Covered |
| Student read-own on `campus` with `selfOnly` | 2 tests (shape + behavioral resolution) | Covered |
| Student update-own on `campus` with `selfOnly` + `subDomain: 'hostel-allocation,transport-allocation'` | 2 tests (shape + behavioral resolution) | Covered |
| Existing RBAC engine tests pass | Regression verified: 10/10 in `engine.test.ts` | Covered |
| Existing resolve-permissions tests pass | Regression verified: 4/4 in `resolve-permissions.test.ts` | Covered |
| ST-TRANSPORT-OFFICER grants campus access / ST-TPO unaffected | 2 tests (ST-TPO placement policy preserved) | Covered |

## Violations

None. Red confirmed (9 failing) before Green; tests written first; no production code edited before tests existed.

## Spec Gaps Discovered

1. **`filterPolicies` does not filter by role** — it operates on `module`, `action`, and `personaType` only. Production role-filtering happens at `loadPolicies` (DB query `role: { $in: [role, '*'] }`). Behavioral tests must pre-filter the policy array by role to simulate the full pipeline — otherwise cross-role policies (super_admin, principal) leak into the match and produce misleading results. I added a `forRole()` helper in the test file that mirrors the DB filter. Worth documenting this in the RBAC README for future test authors — or adding a helper to `engine.ts` itself (`loadPoliciesSync(role, policies)`) to reduce duplication. Flagging for consideration; not in scope for this task.

2. **`ST-TPO` persona collision risk** — `ST-TPO` (Training & Placement Officer) already exists on the `placement` module. This task added `ST-TRANSPORT-OFFICER` (a distinct persona slug) to avoid confusion, but the similarity of names ("transport" vs "training & placement") could mislead future maintainers. Recommend the spec documents this distinction prominently, e.g. in the glossary of `spec.md §7.4 RBAC`. Harmless in code (slugs are exact-match), but a naming hazard.

3. **Acceptance criterion "ST-TRANSPORT-OFFICER... denies `campus:hostel:*`" is inexpressible at this layer** — the spec wording implies subdomain-level denial, but the RBAC engine does not filter by `subDomain`; `subDomain` is a descriptor on the returned policy that the service/controller layer must inspect. My test verifies the correct policy is returned (with `subDomain: 'transport'`); the actual hostel-vs-transport enforcement must happen in the routes/services added in Tasks 8, 9, 10. Documenting this as a subtle handoff: Tasks 8/9/10 must read `authScope.subDomain` (or equivalent) before permitting a cross-subdomain action.

## Files Changed

- **Modified:**
  - `backend/src/shared/rbac/defaults.ts` — 4 new policy entries inserted inline with existing style:
    - `ST-WARDEN` on `campus` module with `subDomain: 'hostel'` (addition; existing welfare policy preserved)
    - `ST-TRANSPORT-OFFICER` on `campus` module with `subDomain: 'transport'` (new persona)
    - `student` on `campus` module with `action: 'read'`, `selfOnly: true`
    - `student` on `campus` module with `action: 'update'`, `selfOnly: true`, `subDomain: 'hostel-allocation,transport-allocation'`
- **Created:**
  - `backend/src/shared/rbac/__tests__/defaults-optional-allotment.test.ts` — 12 tests (4 shape + 4 behavioral + 2 regression + 2 description/priority).

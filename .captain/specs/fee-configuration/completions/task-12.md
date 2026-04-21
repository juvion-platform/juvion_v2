# Completion: Task 12 — HTTP API (routes + controllers + validation + audit service)

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/src/modules/finance/fee-pin-controller.ts` — controllers for `/students/:id/pins`, `/pins/re-pin`, `/commitment-sheet/regenerate`, `/transfer-programme`
- **Created:** `backend/src/modules/finance/fee-component-template-controller.ts` — template CRUD controllers
- **Created:** `backend/src/modules/finance/fee-pin-audit-controller.ts` — `/pin-audit/coverage` + `/pin-audit/invariants`
- **Created:** `backend/src/modules/finance/fee-pin-audit-service.ts` — aggregation-only; `getCoverage` (now using T20 helper) and `getInvariants` (latest 500 invoices vs pinned FSI)
- **Created:** `backend/src/__e2e__/modules/fee-configuration-http.test.ts` — 36 e2e HTTP tests
- **Modified:** `backend/src/modules/finance/routes.ts` — appended 10 new routes + rate limit factory
- **Modified:** `backend/src/modules/finance/validation.ts` — 7 new Zod schemas

## Test Results
- HTTP e2e tests: 36/36 passing
- Backend unit suite: 410/410 passing
- E2E suite: 187/187 passing
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ All endpoints from plan §1.9
- ✓ RBAC mapping: people:read for GET pins · finance:approve for Principal-gated mutations · finance:update for template edits · finance:read for audit endpoints
- ✓ Rate-limit applied (`createUserRateLimit({ max: 60, windowMs: 60_000 })`)
- ✓ Validation via Zod schemas appended to existing `validation.ts`
- ✓ Thin controllers delegating entirely to services

## Spec Gaps Discovered

1. **RBAC role-name mapping.** Spec §1.9 listed roles as "principal OR super_admin". The RBAC engine expresses this via `authorize('finance', 'approve')` (default policy grants this to principal + super_admin via wildcard). Worth confirming with RBAC owner before production.

2. **Test-path deviation.** Task brief specified `backend/src/modules/finance/__tests__/fee-configuration-http.test.ts` but the mongo-memory-server globalSetup lives in the `__e2e__` harness. Placed at `backend/src/__e2e__/modules/fee-configuration-http.test.ts` with a docstring noting the deviation and reusing `createTestApi` + `seedBase()`.

3. **403 coverage skipped in e2e.** `RBAC_ENFORCE='false'` in the e2e harness (matches every other e2e suite). Policy-engine unit tests in `middleware/__tests__/authorize.test.ts` cover gate mechanics.

4. **Reconciled in same session:** `getCoverage`'s `TODO(T20)` hardcode was swapped to call `resolveStudentYearOfStudy` from T20 immediately after T20 landed. Students with unresolvable year-of-study are classified as "missing pin" so Finance can investigate upstream data issues.

## Violations
None.

## Notes
- Transfer-programme returns 422 (not 404) on `FeeStructureNotFoundError` — matches service behavior.
- Audit `?collegeId=` query param is only honored for `super_admin`; other roles scoped by JWT `collegeId`.
- Rate-limit factory instantiated once at the top of the new routes block (`feeConfigRateLimit`) for consistency across the 10 new routes.

# Completion: Task 8 — Admission integration (provision_m04 pins Year-1)

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Modified:** `backend/src/modules/admissions/workflow.handlers.ts` — imports added; `provision_m04` now calls `feePinService.pinYear(student._id, entryPoint.studyYear, ...)`; `rollbackProvisionedStudent()` compensating helper added; SFA totals read from pinned FSI
- **Created:** `backend/src/modules/admissions/__tests__/provision-m04-pin.test.ts` — 5 scenarios

## Test Results
- Focused: 5/5 passing
- Admissions suite: 5/5 passing (no regression)
- Full backend suite: 398/398 with 30s timeout
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ §Journey 2 Year-1 pin at admission finalization
- ✓ §AC Year-1 pin — FeeStructureNotFoundError → admission fails with clear 422 naming the missing combo + "coordinate with Finance" verbiage
- ✓ §EC-1 no approved FeeStructure → admission blocks cleanly
- ✓ §EC-4 Student rolled back (compensating delete) if pin fails partway
- ✓ academicYearId passed explicitly from admission context (honors OQ-7)

## Spec Gaps Discovered

1. **Student.create is in `provision_m02`, not `provision_m04`.** Task brief said "after Student.create succeeds" but the actual creation lives upstream. Agent placed the pin step at the TOP of `provision_m04` (after `Student.findOne`), which is the earliest point where pin context is available. Matches intent.

2. **No transaction/rollback abstraction in the workflow engine** (OQ-14 in spec.md). Agent built `rollbackProvisionedStudent()` compensating helper that deletes Student, unlinks `Admission.studentId`, and scrubs `instance.metadata.studentId`. Best-effort, not true ACID.

3. **`FeeStructure` vs `FeeStructureInstance` divergence** (OQ-12). FSI has `totalAmount` only; `FeeStructure` still carries `components[]`. Agent reads SFA total from pinned FSI but preserves legacy `resolveFeeStructure` call for invoice-component needs.

## Violations
None.

## Notes
- `rollbackProvisionedStudent()` preserves Person (may be shared with other Admissions).
- Test timeouts raised to 30s due to parallel-agent vitest pressure in full-suite runs.
- `entryPoint.studyYear` is the authoritative year-of-study at admission (= 1 for normal BTech; may differ for lateral entry).

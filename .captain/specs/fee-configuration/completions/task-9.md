# Completion: Task 9 — Promotion integration (promoteStudents pins Year-N+1)

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Modified:** `backend/src/modules/academics/academic-delivery-service.ts` — imports + `promoteStudents` now pins Year-N+1 for each promoted student, collects deferred pins for FeeStructureNotFoundError, extends return value with `deferredPins[]`
- **Created:** `backend/src/modules/academics/__tests__/promote-students-pin.test.ts` — 5 scenarios

## Test Results
- Focused: 5/5 passing
- Full backend suite: 398/398 passing
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ §Journey 3 Year-N pin on promotion (auto-pin for `promoted`, no-op for `detained` / `year_back`)
- ✓ §AC Year-N pin — deferred reporting for students whose Year-N+1 structure isn't approved yet
- ✓ §EC-5 Partial batch — deferred pins surfaced per-student; promotion succeeds for students with pins
- ✓ Idempotent re-run — second call doesn't create duplicate active pin (existing `pinYear` archive-and-replace semantics)

## Spec Gaps Discovered

1. **`fromYear = 1` hardcoded placeholder** in pre-existing `promoteStudents`. Every pin from this flow currently targets Year 2. Pre-existing bug; not caused by T9. Resolved by new task T20 (canonical `resolveStudentYearOfStudy` helper) which removes all three placeholder sites across T9/T10/T11.

2. **`academicYearId` convention** (OQ-16). Agent derives from `Semester.academicYearId` of the promotion semester. Works if FSIs are organized by finishing-semester AY; breaks if organized by incoming year. Document convention in §Journey 3 or T19 QA docs.

3. **`deferredPins` field additive only** — existing return `{ promoted, detained, yearBack }` extended; no collision with downstream controllers.

4. **No Mongoose transaction** around `promoteStudents` loop (OQ-14 pattern). If a non-FSI error throws mid-loop, decisions 1..N are already committed. Spec doesn't mandate strict atomicity here; preserving existing behavior.

## Violations
None.

## Notes
- Safe degradation: if `Semester.academicYearId` is missing, `targetAcademicYearId` becomes undefined and every pin raises FeeStructureNotFoundError → captured in deferredPins list (no crash).
- Re-run idempotency tested explicitly (5th scenario): second promotion call invokes `pinYear` but each student still has exactly 1 active Year-2 pin via the archive-and-replace mechanism.

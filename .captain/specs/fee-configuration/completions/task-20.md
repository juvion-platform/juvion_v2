# Completion: Task 20 — resolveStudentYearOfStudy canonical helper

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/src/modules/finance/resolve-year-of-study.ts` — canonical helper
- **Created:** `backend/src/modules/finance/__tests__/resolve-year-of-study.test.ts` — 12 tests
- **Modified:** `backend/src/modules/finance/fee-lifecycle-service.ts` — swap `yearOfStudy = 1` placeholder in `generateSemesterInvoice`
- **Modified:** `backend/src/modules/academics/academic-delivery-service.ts` — replace `const fromYear = 1` with per-student resolution inside `promoteStudents` loop
- **Modified:** `backend/src/modules/people/service.ts` — rename `resolveActiveYearOfStudy` → `resolveYearOfStudyForStalePinCheck`; delegate to canonical helper with pin-heuristic fallback
- **Modified (reconcile):** `backend/src/modules/finance/fee-pin-audit-service.ts` — swap `TODO(T20)` hardcode to canonical helper

## Public API
```ts
export async function resolveStudentYearOfStudy(
  studentId: string,
  opts?: { academicYearId?: string; asOf?: Date }
): Promise<YearOfStudyResult>;

interface YearOfStudyResult {
  yearOfStudy: number;              // clamped [1, durationYears]
  isGraduated: boolean;             // true if raw > durationYears
  academicYearId: string;
  academicYearLabel: string;
  batchAdmissionYear: number;
  programmeDurationYears: number;
}
```

## Test Results
- Focused: 12/12 passing (spec asked for 10+)
- T9 promote-students-pin: 5/5 no regression
- T10 generate-semester-invoice-pin: 6/6 no regression
- T11 student-stale-pin: 4/4 no regression
- Full backend suite: 410/410 passing
- TypeScript strict: 0 errors

## Test scenarios
1. BTech 2022 admission + AY 2024-25 → year 3
2. Explicit academicYearId override (future AY)
3. Lateral entry (studyYearAtAdmission=2) → +1 offset
4. No active AY + no override → 404 clear error
5. Admission year > AY start → "< 1" error
6. Graduated → clamped to durationYears + isGraduated=true
7. Student not found → 404
8. Batch not found → 404
9. Programme.durationYears missing → defaults to 4
10. Year-back student → CALENDAR year (pin lifecycle handles year-back)
11. Bonus: picks active AY when academicYearId omitted
12. Bonus: student without batchId → clear error

## Spec Gaps Surfaced

### Gap-1 (medium): `Student.studyYearAtAdmission` missing from schema
Helper reads it via type coercion for forward-compat. Lateral-entry students currently treated as Year-1 admissions (yielding wrong yearOfStudy math). Test 3 uses `Student.collection.updateOne` to bypass schema.
**Resolution**: new task **T21** added to DAG.

### Gap-2 (reconciled same session): T12 `fee-pin-audit-service.getCoverage` TODO
T12 shipped with `TODO(T20)` hardcode for `currentYearOfStudy = 1`. Swapped to call `resolveStudentYearOfStudy` immediately after T20 landed; students with unresolvable year classified as "missing pin" so Finance can investigate.

### Gap-3 (semantic): Graduated boundary documented
Spec asked "return durationYears + 1 OR throw?" → chose "return durationYears clamped + `isGraduated: true` flag". Consumers MUST check the flag to avoid double-billing the final year. Document in T19 QA docs.

### Gap-4 (data-quality): Fallback-at-call-site pattern
All 4 consumer sites catch helper errors and fall back to safe defaults (yearOfStudy=1 / pin-heuristic). Necessary because `Student.batchId` is optional in the model and test fixtures/prod data may lack it. T16 backfill script should populate `batchId` on all existing students so the fallback becomes a no-op.

### Gap-5 (documented): Promotion academicYearId convention
Verified consistent with T9: helper receives `targetAcademicYearId = Semester.academicYearId` (finishing-semester AY). `newYearOfStudy = fromYear + 1` arithmetic preserved. Document in T19 QA docs.

### Gap-6 (defensive): AY picker assumes non-overlapping windows
If two AYs overlap (shouldn't happen in practice), helper picks most recent `startDate`. Not defensive against malformed data; worth a sanity check in seed scripts.

## Violations
None.

## Notes
- Helper lives under `modules/finance/` (consumers are finance-heavy) despite reading academics models. Cross-module reads are fine.
- Comments reference OQ-6 / OQ-7 / OQ-11 for traceability.
- Year-back students: helper returns CALENDAR year (the pin lifecycle via T5 handles year-back correctly via `archiveReason='year_back_carryforward'` — no double-billing).

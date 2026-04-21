# Completion: Task 21 — Student.studyYearAtAdmission schema field + backfill

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Modified:** `backend/src/models/people/Student.ts` — added optional `studyYearAtAdmission: Number` field (default 1, min 1, max 8); extended `IStudent` interface; full doc comment referencing T21 + OQ-11
- **Modified:** `backend/src/modules/finance/resolve-year-of-study.ts` — removed the `as unknown as { studyYearAtAdmission?: number }` coercion; reads the field normally from the typed Student doc; doc comment updated to reference T21
- **Modified:** `backend/src/modules/finance/__tests__/resolve-year-of-study.test.ts` — Test 3 no longer bypasses schema via `Student.collection.updateOne`; uses normal Mongoose `create()` with the new field. Added Test 3b: T21 regression case (2022-admitted lateral-entry student in 2023-24 AY returns Year 3, not Year 2).
- **Created:** `backend/src/models/__tests__/student-studyYearAtAdmission.schema.test.ts` — 3 schema tests (lateral, default-1, invalid-value rejection)
- **Created:** `backend/src/scripts/backfill-study-year-at-admission.ts` — one-shot migration script with `--college-id`, `--dry-run` (default), `--commit`; mutex flags; CSV output; idempotent
- **Created:** `backend/src/scripts/__tests__/backfill-study-year-at-admission.test.ts` — 4 tests (dry-run + commit + idempotency + flag-parsing)

## Test Results
- Focused: 7 new (3 schema + 1 regression + 3 backfill) + T20 helper regression: 13/13 passing
- Full backend suite: 441/441 passing
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ Closes T20's Gap-1 (Student.studyYearAtAdmission missing from schema)
- ✓ Optional field preserves backward compat with existing records
- ✓ Default = 1 materializes on reload for any legacy doc missing the field
- ✓ min=1, max=8 bounds consistent with yearOfStudy schema
- ✓ T20 helper now reads the typed field directly (type coercion removed)
- ✓ Backfill uniformly sets to 1 — admins manually flip lateral-entry students via future Admin UI (documented)

## Backfill CSV sample
Filename: `studyyear-backfill-<collegeId>-<dry-run|commit>-<timestamp>.csv`
```
studentId,action,previousValue,newValue
652a1b2c3d4e5f6789abcdef,would-update,,1
652a1b2c3d4e5f6789abcde0,would-update,,1
652a1b2c3d4e5f6789abcde1,would-update,,1
652a1b2c3d4e5f6789abcde2,already-set,1,1
652a1b2c3d4e5f6789abcde3,already-set,1,1
```

## Spec Gaps
**None new.** T20's Gap-1 is now closed.

## Violations
None.

## Design Decisions
- **No `--rollback` flag** (unlike T16's backfill) — deliberate omission per task spec ("simple population of default"). If ever needed, `$unset` on `studyYearAtAdmission` is a trivial one-off Mongo script.
- **Lateral-entry detection is NOT auto-inferred** — uniform default=1 backfill. Detection ("does this student's admission batch year suggest they entered at Year 2?") is error-prone and varies per college. Flipping specific students to `2+` is a manual admin action via future Admin UI.
- **Helper safety fallback preserved** — `student.studyYearAtAdmission ?? 1` still handles null/undefined defensively (old snapshot data, hand-edited docs).
- **Regression guard**: Test 3b explicitly constructs a 2022-admitted, `studyYearAtAdmission=2` Student and asserts the helper returns Year 3 in 2023-24 AY. Without the T21 fix, this test would fail (helper would return Year 2).

# Completion: Task 16 — Backfill script for existing students (hardest task)

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/src/scripts/backfill-fee-pins.ts` — `runBackfill(options)` + `parseBackfillArgs` + `main()`. CLI flags: `--college-id`, `--dry-run` (default), `--commit`, `--rollback-pins-created-by=<label> --since=<date>`. Mutually exclusive mode flags enforced at parse time.
- **Created:** `backend/src/scripts/__tests__/backfill-fee-pins.test.ts` — 10 tests (6 AC scenarios + 4 parser unit tests)

## Test Results
- Focused: 10/10 passing
- Full backend suite: 441/441 passing (clean run after all 3 parallel agents merged)
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ Plan §2.4 Migration 3 — DRY-RUN default + audit CSV + Finance sign-off gate + --commit + --rollback
- ✓ Plan §4.1 (hardest-part call-out) — front-loaded DRY-RUN + per-student error tolerance
- ✓ Uses T20 `resolveStudentYearOfStudy` for year resolution
- ✓ Uses T5 `resolveMatchingFeeStructureInstance` for dry-run (non-writing) + `pinYear` for commit
- ✓ Idempotent: commit re-run skips already-pinned students
- ✓ Rollback narrowly scoped (pinnedBy + since filter; leaves non-backfill pins untouched)
- ✓ Memory-safe: cursor iteration with `batchSize: 100`; progress to stderr every 500 students

## CSV output
Filename: `backfill-audit-<collegeId>-<mode>-<timestamp>.csv`
Header: `studentId,rollNumber,programmeId,yearOfStudy,status,detail`
Status values: `would-pin` | `pinned` | `already-pinned` | `unpinnable` | `unresolvable` | `archived` | `error`
Final summary line: `# total=N wouldPin=X pinned=Y alreadyPinned=Z unpinnable=A unresolvable=B archived=C errors=D skipped=E`

Sample rows:
```
<oid>,PIN-0,<progId>,1,would-pin,<fsiId>|total=120000
<oid>,UNP-0,<progId>,1,unpinnable,missing-FSI-for-combo
<oid>,UNR-0,<progId>,,unresolvable,Batch <id> not found for student <oid>
<oid>,PIN-0,<progId>,1,pinned,<pinId>|fsi=<fsiId>|total=120000
```

## Design highlights

1. **CSV opens BEFORE DB iteration** — "unwritable path" fails fast with zero DB writes (AC 6).
2. **Dry-run uses `resolveMatchingFeeStructureInstance` directly** — non-writing preview, same AY resolution as commit path to prevent drift.
3. **Commit passes `enqueueCommitmentSheet: false`** — avoids flooding the PDF queue on bulk runs.
4. **Explicit `academicYearId` passed from T20 helper to both dry-run resolver and `pinYear`** — guarantees the two code paths derive against the exact same AY, eliminating silent drift where `deriveAcademicYearId` might return undefined.
5. **Per-student error isolation** — catch-and-log per student; `totals.errors` incremented; CSV row with `status=error`. Never fails the whole run.
6. **Structured stderr prefixes** (`[BACKFILL ERROR]`, `[BACKFILL FATAL]`, `[BACKFILL PROGRESS]`, `[BACKFILL DONE]`) for grep-ability.
7. **No commander/yargs** — plain `process.argv` parsing per hard constraint.

## Spec Gaps / Operational Notes

1. **`fee-pin-service.deriveAcademicYearId` returns undefined** when called without `opts.academicYearId` (because `Batch` has no `academicYearId` — OQ-7). The backfill always passes one explicitly from the T20 helper, so `pinYear` never hits that degenerate path. **Document in T19 QA checklist**: operators running backfill must have at least one active `AcademicYear` window covering the scan's "as of" date.

2. **Graduated students edge case** — T20's helper clamps `yearOfStudy` to `durationYears` + sets `isGraduated: true`. The backfill does NOT filter graduated students; it pins them at `year=durationYears`. For rollout this is acceptable (pin isn't wrong — they still technically owe their final-year fees), but **T19 checklist should flag**: operators may want to retire `status='active'` students who are graduated-by-AY-math before running the backfill.

3. **Rollback UX**: `--rollback-pins-created-by=system:backfill --since=2024-01-01T00:00:00Z` reqires both flags. Ambiguous `--rollback` alone isn't supported — by design, to prevent blanket archives.

## Violations
None.

## Notes
- `runBackfill(options)` is exported and tests call it directly — no `spawn('ts-node')` overhead.
- `main()` handles CLI parsing + DB connect + exit codes; delegates to `runBackfill`.
- Exit codes: 0 success, 1 fatal (college missing, CSV unwritable, args invalid).
- Rollback query uses `$elemMatch` on `pinnedBy`/`pinnedAt`/`archivedAt` to narrow the universe; then double-checks each matched pin in memory before setting `archivedAt=now, archiveReason='backfill_rollback'`.

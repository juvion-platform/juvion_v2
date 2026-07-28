# Student Bulk Import — Known Follow-ups

**Date:** 2026-07-28
**Origin branch:** `feat/student-bulk-import` (merged as `1bb7f35`)
**Status:** None were merge blockers. The final whole-branch review returned SHIP
with these logged.

These came out of the review passes and were deliberately left for later. They are
recorded here because the review artifacts that produced them are scratch and do
not survive.

| # | Item | State |
|---|------|-------|
| 1 | Programme-less students have no route | Closed — premise was wrong; misleading message fixed |
| 2 | All-blocked job reports `completed` | Closed — working as intended |
| 3 | `validPhone` does no separator stripping | Fixed for import; **manual form still open** |
| 4 | Audit `changes: []` on update | **Open**, house convention |
| 5 | Non-deterministic guardian pick | Fixed |
| 6 | No job-read endpoint for a Registrar | **Open**, needs a new endpoint |

Still worth doing: **3's second half** (normalise phone on the manual form +
admissions, and backfill — needs its own spec, see below), **4** (a
codebase-wide convention question rather than a bug in this feature), and **6**
(a small new endpoint plus a UI affordance).

## 1. ~~Legacy students with no programme have no route to get one~~ — RESOLVED, and the premise was wrong

**Closed 2026-07-28.** This entry claimed programme-less students were a dead end.
They are not. Tracing it properly:

- `PATCH /api/people/students/:id` does 403 an unset→set `programmeId`
  (`people/service.ts:437-445` compares against `student.programmeId ?? ''`, so
  any real programme differs from unset). The Programme field on
  People → Students is read-only on edit for exactly this reason.
- But `transferProgramme()` handles a student with **no** current programme
  perfectly well: `snapshot.programmeId` is undefined, `isSameProgramme` is
  false, so it sets the programme, saves, then `pinYear`s — and rolls back to
  undefined if pinning fails.
- The "Transfer programme" button on `StudentFormPage` is rendered for every
  edit view, not gated on having a programme, and `ProgrammeTransferDialog`
  handles an empty `currentProgrammeId` correctly (nothing is disabled, and the
  "must differ from current" guard passes).

So the route existed all along, and it is the *right* route — it pins the year,
which neither a loosened generic update nor the importer would do.

The real defect was the import's own blocking message, which told registrars to
"Set it on the student's record in People → Students" — a field they cannot edit
— and implied Programme Transfer only applies once a fee pin exists. Both wrong.
The message now names Transfer programme unconditionally, pinned by a test in
`platform/__tests__/student-import-validate-row.test.ts` that asserts the old
wording is gone.

Lesson worth keeping: this entry was written from the review's summary rather
than from reading `programme-transfer-service.ts`. A follow-up note that
misdescribes the system is worse than no note.

## 2. An all-blocked job reports `status: 'completed'`

**Closed 2026-07-28 as working-as-intended.** `platform/bulk-import-service.ts`.
A job whose every row was blocked does finish as `completed` with zero writes,
but the status ladder deliberately excludes blocked rows — the code says why: "a
job whose only anomaly is a sealed record did not partially fail, it did exactly
what preview said it would." And `errorSummary` is not silent about it; it reads
`Committed 0 of 3 rows; 3 blocked and not written.`

Adding a `blocked` value to the status enum would ripple into the platform UI's
status badges and filters for no information gain over the summary already
persisted. Left alone.

## 3. ~~`validPhone` does no separator stripping~~ — FIXED for the import door

**Closed 2026-07-28, import side only.** `validPhone` now strips separators
(spaces, hyphens, parens, dots) and an optional `+91` / `91` / leading `0`, then
holds the same 10-digit rule and stores the canonical form — matching
`validAadhaar`'s contract. Eight paste formats now reduce to one stored value.

The audit the original note called for was done, and the comparison sites are:
`matchExistingStudent`'s phone+admissionYear fallback, and `linkOrCreateParent` /
`parentExistsByPhone`. All three read the *typed* row, so they get the canonical
form automatically — no query-side change was needed.

Proven end-to-end rather than at the validator: re-importing a student as
`+91 98765-43210` after `9876543210` previews as **update**, not create, and two
siblings naming the same guardian in different formats share one `Parent`.
6 of the 7 round-trip tests fail against the un-normalised validator.

**Still open — the other door.** The manual student form is
`z.string().min(10)` behind a plain text input (only a "10-digit mobile"
placeholder, no `pattern`), so it still accepts and stores punctuated values. A
phone written that way may not match an imported one. Closing that means
tightening the Zod schema, normalising on the manual create/update path, checking
`admissions/workflow.handlers.ts` (which does its own exact-equality phone
duplicate detection), and backfilling existing `Person.phone` values. That is a
platform-wide change with a data migration and wants its own spec — the owner
scoped this fix to the import door deliberately.

## 4. Audit `changes: []` on student update

`people/student-import-service.ts`. The update audit records *that* a student
changed, never *what*. This is the pervasive house convention (72 uses in
`academics/service.ts`, and the example in CLAUDE.md), so it was left alone — but
it is precisely what would have made the address-wipe and status-flip defects
found in review detectable after the fact rather than only by reading the diff.

## 5. ~~Non-deterministic guardian pick~~ — FIXED

**Closed 2026-07-28.** Both reads in `linkOrCreateParent` now `.sort({ _id: 1 })`
— the `Person.find` by phone and the existing-`Parent` lookup among eligible
Persons. ObjectIds are monotonic by creation time, so the rule is "prefer the
person who has existed longest": arbitrary, but stable and explainable.

Note the accompanying test is a **guard, not a regression test**. It passes with
the sort removed, because `mongodb-memory-server` returns insertion order anyway.
Real MongoDB guarantees no natural order, so the sort matters in production and
cannot be proven here. The test comment says as much, so nobody deletes the sort
because "the test still passes without it."

## 6. Commit returns a trimmed summary, but there is still no job-read endpoint

A Registrar cannot fetch a finished job — no façade endpoint, and they lack
`platform:read`. The drawer now surfaces counts and failed rows inline from the
commit response, which covers the immediate need, but a registrar who closes the
drawer cannot get the detail back.

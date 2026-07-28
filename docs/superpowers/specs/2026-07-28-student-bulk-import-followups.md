# Student Bulk Import — Known Follow-ups

**Date:** 2026-07-28
**Branch:** `feat/student-bulk-import`
**Status:** Not blockers. The final whole-branch review returned SHIP with these logged.

These came out of the review passes and were deliberately left for later. They are
recorded here because the review artifacts that produced them are scratch and do
not survive.

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

`platform/bulk-import-service.ts:605`. A job whose every row was blocked finishes
as `completed` with zero writes. Cosmetic, but it reads as success in the job list.

## 3. `validPhone` does no separator stripping

`platform/import-schemas/validators.ts`. `validAadhaar` strips whitespace so a
card-format number (`2345 6789 0101`) matches a stored compact one; `validPhone`
does bare `.trim()`. Phone is a natural key for matching, so the same paste-format
bug class is one text message away. Deferred deliberately: normalising a key
requires auditing every comparison site, which is its own scoped change.

## 4. Audit `changes: []` on student update

`people/student-import-service.ts`. The update audit records *that* a student
changed, never *what*. This is the pervasive house convention (72 uses in
`academics/service.ts`, and the example in CLAUDE.md), so it was left alone — but
it is precisely what would have made the address-wipe and status-flip defects
found in review detectable after the fact rather than only by reading the diff.

## 5. Non-deterministic guardian pick

`people/student-import-service.ts`. When several non-student, non-faculty Persons
share a phone, the guardian chosen is `eligible[0]` with no explicit sort. Stable
in practice, arbitrary in principle.

## 6. Commit returns a trimmed summary, but there is still no job-read endpoint

A Registrar cannot fetch a finished job — no façade endpoint, and they lack
`platform:read`. The drawer now surfaces counts and failed rows inline from the
commit response, which covers the immediate need, but a registrar who closes the
drawer cannot get the detail back.

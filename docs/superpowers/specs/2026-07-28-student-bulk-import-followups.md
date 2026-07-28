# Student Bulk Import — Known Follow-ups

**Date:** 2026-07-28
**Branch:** `feat/student-bulk-import`
**Status:** Not blockers. The final whole-branch review returned SHIP with these logged.

These came out of the review passes and were deliberately left for later. They are
recorded here because the review artifacts that produced them are scratch and do
not survive.

## 1. Legacy students with no programme have no route to get one

The pre-branch 11-field importer could create a student with no `programmeId`
(verified at `a274e52`). After this work:

- `PATCH /api/people/students/:id` still 403s any `programmeId` change
  (`people/service.ts:437-445`).
- Bulk import now treats an unset→set fee-axis change as **Blocked**, per the
  owner's ruling, mirroring that same 403.

So those students have no update path at all for programme. Harmless for fee pins
— no programme means no pin to strand — but it is a dead end. A carve-out that
permits unset→set specifically, or a one-off backfill, would close it.

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

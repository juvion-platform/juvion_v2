# Completion: Task 11 — Rebind hooks + programme-transfer-service

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/src/modules/finance/programme-transfer-service.ts` — `transferProgramme(input)` with compensating rollback
- **Created:** `backend/src/modules/finance/__tests__/programme-transfer-service.test.ts` — 6 scenarios
- **Created:** `backend/src/modules/people/__tests__/student-stale-pin.test.ts` — 4 scenarios
- **Modified:** `backend/src/modules/people/service.ts` — `updateStudent`: rejects programmeId PATCH (403, routes to transferProgramme); stale-pin detection on branch/quota/category changes; added `resolveActiveYearOfStudy` local helper

## Test Results
- Focused: 10/10 passing (6 programme-transfer + 4 stale-pin)
- Full backend suite: 398/398 passing
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ §Journey 4 stale-pin flag on branch/quota/category change (not auto-re-pin; admin prompted)
- ✓ §Journey 6 admin manual re-pin via programme transfer endpoint
- ✓ §AC Rebind rules — programme transfer auto-rebind of current year; prior years archived; other attribute changes surface stale flag
- ✓ §EC-6 programme transfer Y1→Y2 — Year 1 preserved, Year 2 re-pinned against new programme
- ✓ Same-programme idempotent no-op
- ✓ Concurrent transfers reconcile to exactly 1 active pin

## Spec Gaps Discovered

1. **OQ-14 No Mongoose session/transaction infra in backend.** `startSession | withTransaction` has zero usages. Tests use `mongodb-memory-server` (not a replica set). Agent used compensating-rollback pattern: snapshot programme/branch/regulation + active pin before mutation; on any failure, restore. Matches T8's approach. Recommend separate SRE task to plumb sessions through + introduce replica-set-backed test infra.

2. **OQ-11 pattern (year-of-study derivation unfinished).** T11 added a local `resolveActiveYearOfStudy` that picks the highest yearOfStudy among active pins as a proxy. If student has no active pin, stale check is silently skipped. T20 (new) will replace this with the canonical helper.

3. **programmeId-PATCH rejection may break admin UI.** Task 13 (admin UI Fee Pins tab) + Task 12 (HTTP API) must expose the new `transferProgramme` endpoint; existing student-edit forms must be updated to route programmeId changes through it. No current caller sends programmeId through `updateStudent` (scanned admissions, promotion, people modules) — safe for backend; front-end needs attention.

4. **`console.info`/`console.warn` used** for stale-pin logging (matches existing pattern in fee-pin-service — no project-wide logger exists).

## Violations
None.

## Notes
- Person/Student update handler location: service layer at `modules/people/service.ts#updateStudent` (controller is a one-liner delegate).
- Concurrent-transfer reconciliation test uses a final deterministic read-pass to avoid scheduler-dependent flakes.
- programme-transfer-service captures snapshots + active pin before mutation → restore on any error. Prior-year pins (year < effectiveYearOfStudy) untouched.

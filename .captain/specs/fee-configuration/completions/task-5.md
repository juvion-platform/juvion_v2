# Completion: Task 5 — fee-pin-service (core pinning logic)

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/src/modules/finance/fee-pin-service.ts` — core pinning business logic
- **Created:** `backend/src/modules/finance/__tests__/fee-pin-service.test.ts` — 10-scenario unit suite

## Public API Delivered
```ts
pinYear(studentId, yearOfStudy, opts)            // resolve + pin + enqueue commitment sheet
rePin(studentId, yearOfStudy, opts)              // admin manual override
archivePin(studentId, pinId, archiveReason)      // idempotent soft-archive
resolveActivePin(studentId, yearOfStudy)         // convenience read (for T10 invoice)
checkPinValidity(studentId, yearOfStudy)         // stale-pin detection (for T11 rebind hooks)
resolveMatchingFeeStructureInstance(student, yearOfStudy, opts)  // preference engine
class FeeStructureNotFoundError extends AppError(404) { detail: {...} }
```

## Test Results
- Focused: 10/10 passing
- Full backend suite: 360/360 passing (350 baseline + 10 new)
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ All 10 test scenarios from `tasks.md` T5 AC
- ✓ Preference-matching logic: branch × 10 + category scoring; quota exact-match (no fallback); tie-break on `approvedAt` descending
- ✓ `FeeStructureNotFoundError` carries structured `detail` + operator-facing message
- ✓ Concurrency guard: post-save reconciliation pass ensures ≤1 active pin per `(studentId, yearOfStudy)` invariant under racing writers
- ✓ Commitment-sheet enqueue wrapped in try/catch so BullMQ hiccups never block the pin itself
- ✓ Audit entries on every pinYear / rePin / archivePin (matches T6 + fee-lifecycle-service conventions)
- ✓ `enqueueFeeCommitmentJob` mocked in tests — zero BullMQ/Redis dependency at unit level

## Spec Gaps Discovered (both logged in spec.md changelog as OQ-6, OQ-7)

### OQ-6: FeeStructureInstance has no `yearOfStudy` field
The existing model encodes cohort year via `academicYearId` alone — there's no explicit `yearOfStudy: 1..4` column. `resolveMatchingFeeStructureInstance` takes `yearOfStudy` in its signature (future-proof) but does not filter on it server-side. The pin-per-year invariant is maintained at the `Student.feePins[]` level instead.

This works as long as one FSI per `(programmeId, branchId, quota, academicYearId)` is approved active. If a college needs distinct structures per year-of-study within the same academic year (e.g., transitional rate for existing Year-3 students during a mid-programme revision), we'd need to add `yearOfStudy` to the FSI schema.

**Decision deferred to post-v1 unless a real need arises.** Documented for T19 (deploy checklist).

### OQ-7: `deriveAcademicYearId` context boundary
`Batch` has no `academicYearId` field, so T5's helper returns undefined unless the caller passes `opts.academicYearId`. T8 (admission integration) and T9 (promotion integration) must supply the academic year from their own workflow context. Documented inline; verify in those tasks.

## Violations
None.

## Notes
- Concurrent `pinYear` writers: last-`pinnedAt` wins via reconciliation. Multiple racing calls converge on one active pin without DB-level locking.
- `FeeStructureNotFoundError` message format suitable for admission-blocking error display (includes programme/branch/quota/category/year/academicYear).
- No commitment-sheet PDF logic in T5 (belongs to T7).
- No HTTP routes / controllers in T5 (belongs to T12).
- Service is pure — callers own transactions, error-handling decisions, and HTTP translation.

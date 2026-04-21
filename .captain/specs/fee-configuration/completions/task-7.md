# Completion: Task 7 — fee-commitment-sheet-service (PDF generation + M02 attach + worker wiring)

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/src/modules/finance/fee-commitment-sheet-service.ts` — `generateSheet(studentId, pinId, opts?)` + `regenerateForPin(studentId, pinId, opts?)`. Loads student → pin → FSI → components → rules → renders PDF via `PdfRenderer` → persists via M02 → updates pin.commitmentSheetDocumentId + status + audit log.
- **Created:** `backend/src/modules/finance/__tests__/fee-commitment-sheet-service.test.ts` — 11 tests
- **Modified:** `backend/src/workers/fee-commitment.worker.ts` — skeleton handler now calls `feeCommitmentSheetService.generateSheet`; rethrows on error so BullMQ retries per existing `FEE_COMMITMENT_JOB_OPTS`. All other exports unchanged.
- **Modified:** `backend/src/shared/queue/__tests__/feeCommitmentQueue.test.ts` — updated the 2 T4 skeleton-era log-only assertions; they now mock `generateSheet` and assert delegation + rethrow. Queue-registration / concurrency / retry-config tests untouched.

## Test Results
- Focused: 11/11 passing
- Full backend suite: 372/372 passing (360 baseline + 11 new + 1 T4 test net change)
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ Basic sheet generation with all components in table
- ✓ Conditional component inclusion via FeeComponentRule evaluation (hostel / transport opt-in)
- ✓ FeeAgreement reference block when active
- ✓ Omits PaymentPlan block cleanly when none exists
- ✓ Pin/FSI/Student 404s
- ✓ Failure path: pin.commitmentSheetStatus = 'failed', error rethrown, BullMQ retries
- ✓ `regenerateForPin` supersedes prior doc, attaches new, updates pin.commitmentSheetDocumentId
- ✓ PDF byte-check (starts with `%PDF-` magic)
- ✓ Worker delegation + rethrow on failure
- ✓ Audit log entry on every generateSheet / regenerateForPin (matches T5 + T6 conventions)

## Spec Gaps Discovered (logged in spec.md changelog as OQ-8, OQ-9, OQ-10)

### OQ-8 (significant): No generic `createDocument` service in M02
Plan §1.8 assumed a generic `createDocument({ personId, documentType: 'fee_commitment_sheet', ... })` existed. It doesn't. The only document entry point is `generateDocument` in `exit-service.ts` targeting `ExitDocument`, which has:
- A closed `type` enum (transcript, bonafide, provisional_certificate, …) that does NOT include `fee_commitment_sheet`
- No binary-payload field — only `fileUrl`

**Pragmatic workaround shipped:** `ExitDocument` with `type: 'bonafide'` as the vehicle, canonical `documentType: 'fee_commitment_sheet'` + PDF bytes (base64) + `pinId` + `fileName` + `size` stashed in the document's `metadata` field. A test-overridable seam (`__setCreateDocumentForTests` / `__resetCreateDocumentForTests`) makes the future cutover trivial.

**Follow-up (separate spec required):** introduce a real generic `Document` entity OR extend `ExitDocument` with the `fee_commitment_sheet` type + a proper binary payload mechanism (blob storage URL). Blocks production use for serious volumes — stashing PDFs as base64 in a metadata field is fine for tests but wasteful for real data.

### OQ-9: `ExitDocument` has no `superseded` status
Has `revoked` (boolean) + `revokedAt` + `revokedReason`. T7's `regenerateForPin` uses `revoked=true, revokedReason='superseded'` as the closest fit. Adding a dedicated `superseded` status to ExitDocument would be cleaner but requires model changes outside T7's scope.

### OQ-10: Student lacks hostel/transport opt-in flags
`Student` has no `hostelOptIn` / `transportRequired` — those live in the separate hostel-allotment subsystem (our §NOT-For boundary). `generateSheet` accepts an optional `studentOptIns: { hostel?, transport? }` opts arg with both defaults to false. T8 (admission) and T9 (promotion) must load allocation state from the hostel module and pass it in when calling this service from their workflows.

## Architectural notes (non-blocking)

- **`evaluateFeeComponentRules` returns minimal data** (`{feeComponentId, name, amount}` only — not `{category, displayOrder, isRefundable}`). Service fetches full `FeeComponent` docs separately, filters the conditional ones by the applicable id set returned by the evaluator, and always includes unconditional components.
- **Academic year label** in header subtitle uses cosmetic `AY <yr>-<yr+1>`. Production polish: read from the pinned FSI's `academicYearId → AcademicYear.label`. Easy post-v1 upgrade.
- **Net Payable = Gross** because concessions/scholarships stacking isn't T7's job (belongs to T10 invoice logic).

## Violations
None.

## Notes
- Test-overridable `createDocument` seam means swapping to a proper M02 Documents service in the future is a 1-line change in the default implementation.
- Audit entries use `entityType='Student'`, `action='create'`, `changes.field='feePins.commitmentSheetDocumentId'`, `performedBy='system:commitment-sheet'` with `{pinId, documentId, superseded}` context.
- Worker unchanged in exports — only the handler body delegates to the service. Retry config and concurrency caps preserved.

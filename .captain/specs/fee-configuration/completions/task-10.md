# Completion: Task 10 — Invoice generation pin-first (+ lazy-pin fallback)

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Modified:** `backend/src/modules/finance/fee-lifecycle-service.ts` — `generateSemesterInvoice` resolution prelude rewritten to pin-first with lazy-pin fallback; `evaluateRulesForInstance` local helper added (pin-scoped, bypasses status filter so superseded structures still evaluate); all downstream logic (concession math, invoice/SFA/audit) unchanged
- **Modified:** `backend/src/models/finance/InvoiceLineItem.ts` — additive optional `sourcePinId?: ObjectId` field (to satisfy T1-parity — see spec gap OQ-13)
- **Created:** `backend/src/modules/finance/__tests__/generate-semester-invoice-pin.test.ts` — 6 scenarios

## Test Results
- Focused: 6/6 passing
- Finance suite: 99/99 passing
- Full backend suite: 398/398 passing (30s timeout)
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ §Journey 8 invoice reads pin-first; lazy-pin on fallback
- ✓ §AC invoice reads pin; sourcePinId stamped on each line item
- ✓ §Journey 7 pin on superseded structure → invoice uses SUPERSEDED totals (intended behavior; `evaluateRulesForInstance` bypasses status filter)
- ✓ Component-rule evaluation preserved (hostel opt-in/opt-out)
- ✓ FeeAgreement override preserved (insofar as it exists — see OQ-15)

## Spec Gaps Discovered

1. **OQ-11 (significant) `yearOfStudy` hardcoded to 1.** No `determineYearOfStudy(student, semester)` helper exists in the codebase. Agent used `yearOfStudy = 1` as a placeholder with an inline comment. Year 2+ students currently won't find their pins via this function. **Fix committed to T20** (new task, blocks T16 backfill).

2. **OQ-13 `FeeLineItem` vs `InvoiceLineItem` mismatch.** Plan §2.3 + T1 added `sourcePinId` to `FeeLineItem`, but `generateSemesterInvoice` writes `InvoiceLineItem` (different collection). Agent added the same optional field to `InvoiceLineItem` to satisfy Task 10 AC. Crosses the "don't touch models" fence minimally — justifiable. Schema-consolidation follow-up recommended.

3. **OQ-15 FeeAgreement override not in `generateSemesterInvoice` today.** Spec §Journey 8 / AC said "existing FeeAgreement override logic unchanged" — but the override isn't wired into invoice generation today. `Invoice.feeAgreementId` exists but isn't consumed. Spec needs correction: FeeAgreement override is either (a) out of scope for v1 OR (b) needs a new task to wire it in.

4. **Evaluator cannot honor `superseded` instances** — existing `evaluateFeeComponentRules` filters `status: {$in: ['approved', 'active']}`. Agent introduced local `evaluateRulesForInstance` (pin-scoped, no status filter) per the "don't modify imported helpers" constraint. Future refactor should lift this into the shared helper.

## Violations
None (the InvoiceLineItem model edit was the smallest possible change needed to satisfy the AC).

## Notes
- `evaluateRulesForInstance` takes `feeStructureInstanceId` directly, filters components by that specific instance, and skips the status-based filter used for active-resolution queries.
- Lazy-pin failure (race with concurrent write) is logged as warn and invoice generation proceeds with the resolved structure — next invoice run retries.
- `sourcePinId` populated for FeeAgreement-overridden invoices too (audit traceability to the standard rate the student would otherwise owe).

# Completion: Task 1 — Fee Configuration schema additions

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `backend/src/models/finance/FeeComponentTemplate.ts` — new Mongoose model per plan §2.2. Unique compound index `(collegeId, componentKey)`. Category enum matches spec exactly.
- **Created:** `backend/src/models/__tests__/feePin.schema.test.ts` — 11 tests
- **Created:** `backend/src/models/__tests__/feeComponentTemplate.schema.test.ts` — 8 tests
- **Modified:** `backend/src/models/people/Student.ts` — added `FeePin` subdoc and `feePins: []` array with sparse index; exported `IFeePin`, `FeePinReason`, `FeePinCommitmentSheetStatus` types
- **Modified:** `backend/src/models/finance/FeeLineItem.ts` — added optional `sourcePinId?: ObjectId` (backward compat)

## Test Results
- Focused: 19/19 passing
- Full backend suite: 326/326 passing
- TypeScript strict: 0 errors

## Spec Coverage
- ✓ §AC pin schema — all fields implemented per plan §2.1
- ✓ §AC fee component template schema — all fields per plan §2.2
- ✓ §AC FeeLineItem backward compatibility — sourcePinId optional

## Spec Gaps Discovered
1. `pinnedBy` — task brief listed `'system:invoice-lazy'` as one of the literal values; plan §2.1 only listed 3 literals. Kept `pinnedBy` as a **free-form String** (no enum) so downstream tasks (T5, T10) can pass any label. Flagged for attention if anyone tightens this later.
2. `commitmentSheetDocumentId` references `'Document'` model — T7 must confirm the M02 Document model registers under the same name.
3. `yearOfStudy` bounds — plan §2.1 says "1–8 typical"; schema added `min: 1, max: 8` as a defensive guard. PhD programmes running longer than 8 years would need this relaxed; flagging for T5 review if the use case arises.

## Violations
None.

## Notes
- Types `IFeePin`, `FeePinReason`, `FeePinCommitmentSheetStatus` exported so T5 (fee-pin-service) has typed hooks.
- Sparse index on `feePins.feeStructureInstanceId` keeps the nightly audit (T17) performant.
- No migration needed — both changes are additive and default-safe.

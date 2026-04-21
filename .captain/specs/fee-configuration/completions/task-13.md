# Completion: Task 13 — Admin UI: Fee Pins tab on StudentDetailPage

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `admin-portal/src/services/fee-configuration.ts` — axios client: `getStudentPins`, `rePinStudent`, `regenerateCommitmentSheet`, `transferProgramme`, `listFeeStructureInstances`. Exports `IFeePin`, `FeePinReason`, `PopulatedFeeStructureInstance` types mirroring backend.
- **Created:** `admin-portal/src/components/finance/FeePinsPanel.tsx` — Fee Pins section (stale-pin yellow banner, active pins with DetailSection, commitment-sheet link + regenerate, archive history toggle, Principal-gated Re-pin)
- **Created:** `admin-portal/src/components/finance/RePinDialog.tsx` — modal for manual re-pin with async FSI dropdown + reason enum
- **Modified:** `admin-portal/src/pages/people/StudentDetailPage.tsx` — imports + renders `FeePinsPanel` after Emergency Contact section

## Validation
- `npx tsc --noEmit` → 0 errors (admin-portal)
- `npm run build -w admin-portal` → 0 errors
- No test runner in admin-portal → no UI unit tests (per rollout convention)

## Spec Coverage
- ✓ §Journey 6 admin manual re-pin (Principal-gated via `useAuthStore`)
- ✓ §AC Commitment Sheet — link + regenerate button
- ✓ Stale-pin banner when any active pin has `staleSince` set
- ✓ Active + archived pin display with DetailSection primitives

## Spec Gaps Discovered (contract tolerances for T12 reconciliation)

1. **Pins response shape** — UI assumes `{ pins: IFeePin[] }`. T12 actually returns `{ pins }`. Aligned.
2. **FSI population** — UI tolerates both ObjectId string and populated object. If T12 returns only raw id, UI fields collapse to "—"; recommend T12 populate feeStructureInstanceId with `{_id, name, code, totalAmount, approvedAt, status}`.
3. **Regenerate response** — UI accepts either `{documentId}` or `{jobId, status}`. T12 returns `{documentId, pdfBuffer}`; compatible.
4. **currentYearOfStudy on Student** — UI falls back to first active pin's year if missing. T20 helper could populate this in the Student response; deferred to a future polish task.
5. **Commitment-sheet viewer route** — hard-coded `/platform/documents/:id`. Verify against actual Documents viewer route.

## Violations
None.

## Notes
- React Query with cache invalidation on mutation (standard pattern).
- Tailwind tokens consistent with other detail pages.
- `transferProgramme` wired in the service but not surfaced in this task's UI (separate concern; future T11-related UI can consume it).

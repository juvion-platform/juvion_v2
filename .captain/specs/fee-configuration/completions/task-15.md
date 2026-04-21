# Completion: Task 15 — Admin UI: Promotion page pin-progress

**Feature:** fee-configuration
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `admin-portal/src/pages/academics/PromotionPage.tsx` — new minimal page (form: programme + semester → "Run Promotion") since no existing promotion UI page was found
- **Created:** `admin-portal/src/components/academics/PromotionResultsPanel.tsx` — 4 stat tiles + deferred-pins table + per-row Retry + "Retry all" button (Principal-gated)
- **Created:** `admin-portal/src/components/academics/PinNowDialog.tsx` — modal with student context + async FSI candidate loader + reason enum + remarks
- **Modified:** `admin-portal/src/services/academics.ts` — added `promoteStudents`, `PromotionSummary`, `DeferredPin` types wrapping `POST /academics/results/promote`
- **Modified:** `admin-portal/src/pages/Academics.tsx` — registered `/academics/promotion` route + hub card in "Results & OBE" group

## Validation
- `npx tsc --noEmit` → 0 errors (admin-portal)
- `npm run build -w admin-portal` → 0 errors

## Spec Coverage
- ✓ §Journey 3 promotion UI with deferred-pin surfacing
- ✓ §EC-5 partial-batch pin failures — deferred students listed with retry actions
- ✓ Principal role gate (via `useAuthStore`); non-Principal sees disabled actions with tooltip

## Behavior highlights
- Summary: 4 tiles (Promoted / Detained / Year Back / Deferred Pins)
- Deferred students table: per-row Retry (auto-resolve single-match FSI) + Pin Now (dialog)
- Retry all: parallel for <20 students, sequential otherwise (avoids thundering-herd)
- Pin Now dialog: async-loads FSI candidates filtered by programme + branch + status=active; intentionally does NOT filter by quota/category (student.quota/category may not align 1:1 with Finance's structure groupings)

## Spec Gaps Discovered

1. **No existing promotion UI** — created a new page + hub card. Backend T9's `promoteStudents` was previously API-only.
2. **`getStudent` called per deferred row** via `useQueries` to populate name/roll/programme for the deferred table. For very large batches (hundreds), consider a bulk-lookup endpoint; fine for typical batch sizes.
3. **T13's fee-configuration.ts was already landed** when T15 ran — used `rePinStudent`, `listFeeStructureInstances` directly with no inline fallback.
4. **T9's `deferredPins[]` shape matched exactly** — no contract gap.

## Violations
None.

## Notes
- Zero new npm deps; reuses shared Modal, DataTable, Badge primitives.
- Retry-all auto-resolve uses "exact single FSI match" heuristic; multiple candidates prompt the user via Pin Now dialog.

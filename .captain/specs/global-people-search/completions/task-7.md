# Completion: Task 7 — SearchResultRow + SearchResultsDropdown

**Feature:** global-people-search
**Completed:** 2026-04-19
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `admin-portal/src/components/search/SearchResultRow.tsx`
  - Props `{ result, selected?, onClick, onHover?, id? }`
  - Photo thumbnail with initial-letter fallback; role-colored Badge;
    secondary status Badge (only when not 'active'); identifier label/value;
    department
  - Uses existing `Badge` primitive from `components/ui/Badge`
  - `role="option"` + `aria-selected` for listbox-a11y integration

- **Created:** `admin-portal/src/components/search/SearchResultsDropdown.tsx`
  - Props `{ state, results, counts, totalMatched, hasMore, query, selectedIndex, onSelect, onHover?, onSeeAll, onRetry?, id? }`
  - `DropdownState` type: `'idle' | 'loading' | 'empty' | 'error' | 'ready'`
  - Groups rows by role in canonical order (student, faculty, staff, parent, alumni)
  - Role-section headers with per-role count (sticky within the list)
  - "See all N results →" link appears only when `hasMore`
  - Distinct copy for idle vs empty vs error states (spec §5.3)
  - `role="listbox"` wrapper matches the overlay's `role="combobox"` input
  - Flat linear indexing across grouped rows — `selectedIndex` = 0..N-1
    across the whole list, so arrow-key navigation doesn't need to track
    groups

## Verification
- `npx tsc --noEmit` (admin-portal) → 0 errors
- `npm run build` (admin-portal) → success (SearchResults chunk: 4 kB gzipped)

## Spec Gaps Discovered
None beyond the frontend-test-infra gap already logged under T5/T6.

## Violations
None.

## Notes
- ROLE_LABELS is exported from SearchResultRow so the dropdown's section
  headers stay in sync with the badge labels. Single source of truth.
- `onHover` is threaded through so mouse hover can update selectedIndex
  without click — keeps keyboard & mouse selection state consistent.

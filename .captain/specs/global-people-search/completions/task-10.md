# Completion: Task 10 — /search full-results page + route wiring

**Feature:** global-people-search
**Completed:** 2026-04-19
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `admin-portal/src/pages/SearchResults.tsx`
  - Reads `?q=<string>` and `?includeInactive=true` from URL via `useSearchParams`
  - Calls `searchPeople({ q, limit: 25, includeInactive })` — 25 per role
    is the max the backend accepts (plan §1.6 capped at 25)
  - Renders one bordered section per role with a count header and the
    same `SearchResultRow` used by the overlay — visual consistency
  - Admin / principal / super_admin get a top-right "Include inactive"
    checkbox that toggles the `?includeInactive` URL param (deep-linkable)
  - Empty / loading / error / idle states with matching copy to the dropdown
  - Breadcrumb: `Dashboard › Search › "<query>"`
  - Row click navigates via the same `routeForResult()` helper the overlay uses

- **Modified:** `admin-portal/src/App.tsx`
  - Lazy-imports `SearchResults`
  - Adds `<Route path="/search" element={...}>` inside the `RequireCollege`
    -> `DashboardLayout` group, so the page inherits auth + college gates +
    the header with its own search pill

## Verification
- `npx tsc --noEmit` (admin-portal) → 0 errors
- `npm run build` (admin-portal) → success; `SearchResults` chunk = 4 kB
  gzipped, lazy-loaded on navigation

## Spec Gaps Discovered
- Per-role pagination was deferred — backend endpoint returns a single
  flat list with hasMore flag, not per-role paging. For v1 the 25-per-role
  cap from the backend is the ceiling; if users routinely hit that ceiling
  we'll revisit with per-role cursors. Logged as a potential future need
  but not urgent.

## Violations
None.

## Notes
- The `?includeInactive` toggle persists via URL params, so sharing a
  search URL with a colleague preserves the admin-only view state. For
  non-privileged roles, the backend silently downgrades the flag — the
  checkbox is UI-only protection, not an auth boundary.
- Query key `['globalSearch', 'page', q, includeInactive]` is namespaced
  separately from the overlay's `['globalSearch', q, limit, includeInactive]`
  so the 25-limit page results don't leak into the 10-limit overlay cache
  (different payload shapes).

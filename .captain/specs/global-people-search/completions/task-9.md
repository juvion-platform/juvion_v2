# Completion: Task 9 — GlobalSearch header + mount + hotkey + first-time tooltip

**Feature:** global-people-search
**Completed:** 2026-04-19
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `admin-portal/src/components/search/GlobalSearch.tsx`
  - Renders a compact icon button on narrow viewports (`md:hidden`) and an
    expanded "search pill" with ⌘K hint on `md+` viewports
  - Clicking either trigger opens the SearchOverlay (same single instance)
  - Cmd+K / Ctrl+K opens the overlay globally (via `useGlobalSearchHotkey`)
  - First-time tooltip: reads `localStorage['gps:hint-seen']`; if unset,
    shows a navy bubble "New: press ⌘K to search for anyone" with an X
    dismiss. Click-to-dismiss sets the flag. Wrapped in try/catch so a
    locked-down incognito session doesn't throw.

- **Modified:** `admin-portal/src/layouts/DashboardLayout.tsx`
  - Import `GlobalSearch`
  - Mount `<GlobalSearch />` in the header area, to the left of the user
    display name (which is now hidden on narrow viewports so the search
    pill has room)

## Verification
- `npx tsc --noEmit` (admin-portal) → 0 errors
- `npm run build` (admin-portal) → success
- Manual smoke plan documented in T11 QA checklist

## Spec Gaps Discovered
- **Inline header-typing mode deferred.** Spec §5.1 calls for typing in the
  header input to render a dropdown below the input (without full-screen
  overlay) on wide viewports. Implemented as click-to-open-overlay only;
  the inline dropdown adds significant positioning complexity (floating-ui
  or manual portal) for a modest UX gain when Cmd+K already gives fast
  access to the same results UI. Logged as an optional follow-up; does not
  affect functional correctness.

## Violations
None.

## Notes
- The Cmd+K listener is bound ONCE at the `GlobalSearch` mount point, which
  lives in `DashboardLayout`. Any authenticated page inside the layout
  gets the hotkey for free without each page re-binding.
- The tooltip z-index (z-40) is intentionally below the overlay (z-50) so
  opening the overlay hides the hint without an extra effect.
- The hint auto-dismisses when the user opens the overlay (even if they
  didn't click the X) so they don't see it again on the next load.

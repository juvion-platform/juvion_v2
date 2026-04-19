# Completion: Task 8 — SearchOverlay

**Feature:** global-people-search
**Completed:** 2026-04-19
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `admin-portal/src/components/search/SearchOverlay.tsx`
  - Full-screen modal (z-50, backdrop-blur) with centered input panel at top
  - Controlled by `isOpen` + `onClose` props from the header component
  - Consumes `useGlobalSearch` for data + state; overlay owns `selectedIndex`
  - Auto-focuses the input on open via `requestAnimationFrame`
  - Body scroll locked while open
  - Query input cleared on close (fresh state for next open)
  - Keyboard:
    - **Esc** → close
    - **↑ / ↓** → move selectedIndex (wraps at bounds via modulo)
    - **Enter** → `commitSelection(index)` → navigate to role-specific route
      via `routeForResult(result)`
    - **Tab** → focus trap cycles within the dialog (first/last focusables)
  - `aria-modal="true"`, `role="dialog"`, `aria-label` set
  - Input: `role="combobox"`, `aria-controls`, `aria-autocomplete`,
    `aria-activedescendant` pointing at `gps-option-<i>`
  - "See all" jump wires the current deferredQuery into the URL:
    `/search?q=<encoded>[&includeInactive=true]`

- **Created:** `admin-portal/src/components/search/navigateToResult.ts`
  - Pure mapper: `routeForResult(result) → string URL`
  - Maps to `/people/<role>?highlight=<personId>` for student/faculty/staff/parent
  - Alumni maps to `/placement/alumni-profiles?highlight=<personId>`
    (alumni is under the Placement module in the existing routes)

## Verification
- `npx tsc --noEmit` (admin-portal) → 0 errors
- `npm run build` (admin-portal) → success

## Spec Gaps Discovered
- **Per-person detail pages don't exist** for all roles. Students / faculty /
  staff have `/:id/edit` forms but no view page; parents / alumni only
  have list views. `routeForResult` navigates to the role's LIST page
  with `?highlight=<personId>` as a hint the list pages can consume later.
  Until lists implement highlight, the user still lands on the correct
  role's list — graceful degradation.
  **Logged for follow-up**: add a person-detail route (`/people/<role>/<id>`)
  or implement `?highlight` in the existing list pages.
- Focus-trap utility was written inline rather than extracted; no existing
  shared focus-trap utility in the codebase (checked `components/ui/`).

## Violations
None.

## Notes
- The overlay's input is `autoComplete="off" autoCorrect="off" spellCheck={false}`
  so iOS/Safari autocorrect doesn't rewrite a roll number or employee code
  into a dictionary word.
- Backdrop click closes via `onClose`; the backdrop has `aria-hidden="true"`
  so screen readers ignore it and jump straight to the dialog.
- `selectedIndex` resets to 0 on every new result batch so users don't land
  on a stale row after typing.

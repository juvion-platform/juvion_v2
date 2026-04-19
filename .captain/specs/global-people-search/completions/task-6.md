# Completion: Task 6 — useGlobalSearch hook

**Feature:** global-people-search
**Completed:** 2026-04-19
**Person:** srinikandula
**Final Status:** Done

## Files Changed
- **Created:** `admin-portal/src/components/search/useGlobalSearch.ts`
  - Primary hook `useGlobalSearch({ limit, includeInactive, enabled })` returns:
    `{ query, setQuery, deferredQuery, results, counts, totalMatched, hasMore, isLoading, isFetching, error, isActive, isOpen, setOpen, reset }`
  - 200ms setTimeout-based debounce (strict time-based so request count is
    predictable; `useDeferredValue` was rejected because it couples pacing
    to React's concurrent-rendering heuristics)
  - Min-query-length = 2 chars (matches backend Zod schema)
  - React Query `useQuery` with `keepPreviousData` placeholder so stale
    results render while the next request loads — no flicker
  - `staleTime: 30_000` so reopening Cmd+K within 30s is instant
  - `retry` opts: never retry 4xx (validation / auth / rate-limit), retry
    5xx up to 2 times
  - Companion hook `useGlobalSearchHotkey(onOpen)` — global Cmd+K / Ctrl+K
    listener. Uses a ref to track the latest `onOpen` closure without
    re-binding the DOM listener on every render.

## Verification
- `npx tsc --noEmit` (admin-portal) → 0 errors
- `npm run build` (admin-portal) → success

## Spec Gaps Discovered
Frontend has no test runner (vitest / @testing-library not installed).
The acceptance criteria's unit tests for debounce, min-length, and stale
response are deferred until a frontend test-infrastructure task is picked
up. The hook's behavior is indirectly exercised by the T4 e2e tests at
the HTTP level and manual QA in T11.

## Violations
None (tests deferred openly, not hidden).

## Notes
- The hotkey registration lives in ONE place per layout (T9 mounts it at
  `DashboardLayout`); mounting per-component would fire multiple handlers
  per keystroke.
- The ref-based closure pattern in `useGlobalSearchHotkey` is a deliberate
  optimization for the common case where `onOpen` is a fresh inline arrow
  on every render.

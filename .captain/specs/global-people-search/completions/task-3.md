# Completion: Task 3 — Search controller + route wiring

**Feature:** global-people-search
**Completed:** 2026-04-19 13:58
**Person:** srinikandula
**Final Status:** Done

## Test Results
Covered by T4 (e2e tests — 12/12 passing). No new unit tests added for the
controller since it's a thin orchestrator; its behavior is tested end-to-end.

## Files Changed
- **Created:**
  - `backend/src/modules/people/search-controller.ts` — thin controller that
    delegates to the service; downgrades `includeInactive=true` silently for
    non-privileged roles (spec §5.3 AC-15)
- **Modified:**
  - `backend/src/middleware/validate.ts` — added optional second arg
    `source: 'body' | 'query'` (default 'body', preserves existing callers).
    Query-validated params are attached to `req.validatedQuery`.
  - `backend/src/modules/people/routes.ts` — wired `GET /api/people/search`
    BEFORE the `/persons/:id` route so "search" isn't captured as an ID.
    Middleware chain: authenticate → authorize → rate-limit → validate → controller.

## Violations
None. Behavior is validated through T4 e2e tests.

## Spec Gaps Discovered
1. **Route ordering matters** — `/search` must come before `/persons/:id`. Noted
   in the route file. Spec didn't flag this because it's an Express convention,
   but worth calling out.
2. **`req.query` is read-only in Express 5** — had to attach parsed query to
   `req.validatedQuery` rather than mutating `req.query`. Updated the `validate`
   middleware signature to accommodate both sources.

## Notes
- Controller is deliberately thin (~50 lines). All business logic stays in
  `search-service.ts`; the controller handles only: validation gate, role check
  for `includeInactive`, call service, return JSON.
- Privileged roles for `includeInactive`: `admin`, `principal`, `super_admin`.
  Non-privileged requests get `includeInactive: false` + a console.info log.

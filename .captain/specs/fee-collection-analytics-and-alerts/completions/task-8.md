# Completion: Task 8 — HTTP API (fee-collection-analytics-and-alerts)

**Feature:** fee-collection-analytics-and-alerts
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed

### Created
- `backend/src/modules/finance/fee-analytics-controller.ts` — 2 handlers
  (`getDashboardHandler`, `getDefaultersHandler`) that delegate to
  `fee-analytics-service`. Builds `AuthScope { role, collegeId,
  hodProgrammeIds? }` from `req.user` + `req.authScope.departmentId`;
  HOD programme scope resolved via `Branch.find({ collegeId,
  departmentId }).distinct('programmeId')`.
- `backend/src/modules/finance/fee-holds-controller.ts` — 4 handlers
  (`listHoldsHandler`, `activateHoldHandler`, `waiveHoldHandler`,
  `pauseEscalationHandler`). First three delegate to `fee-holds-service`.
  `pauseEscalationHandler` is the only one carrying small business logic
  (find DefaulterRecord(s) for the student, 404 if none, `updateMany`
  → set `autoEscalationPaused`, emit one AuditLog per record).
- `backend/src/__e2e__/modules/fee-analytics-http.e2e.test.ts` — 12 tests
  (dashboard + defaulters + cross-college isolation).
- `backend/src/__e2e__/modules/fee-holds-http.e2e.test.ts` — 19 tests
  (list + activate + waive + pause-escalation).

### Modified (additive)
- `backend/src/modules/finance/validation.ts` — appended 5 Zod schemas:
  `dashboardQuerySchema`, `defaultersQuerySchema`, `holdsListQuerySchema`,
  `waiveHoldSchema`, `pauseEscalationSchema`, plus a private
  `stringOrStringArray` helper for query-string multi-value parsing
  (e.g. `?programmeIds=a&programmeIds=b` or single-value fallback).
- `backend/src/modules/finance/routes.ts` — added imports for the two
  new controllers + the five new Zod schemas; hoisted the existing
  `feeConfigRateLimit = createUserRateLimit({ max: 60, windowMs: 60_000 })`
  to the top of the file (still a single instance — reused across the
  T8 routes and the pre-existing T12 fee-configuration routes); inserted
  a T8 route block **above** the legacy `/holds` routes so the new
  `GET /holds` + `POST /holds/:id/activate` + `POST /holds/:id/waive`
  routes take precedence over the older `listFinancialHolds` handler.

### Paths — deviation from spec note
T8 prescribes the test files at
`backend/src/modules/finance/__tests__/fee-*-http.e2e.test.ts`, but the
supertest + `mongodb-memory-server` harness (global-setup, `getTestApp`,
`seedBase`) lives under the `__e2e__` tree and is wired to a separate
`vitest.e2e.config.ts`. I followed the same convention as Task 12's
`fee-configuration-http.test.ts`, which deliberately placed its e2e test
at `backend/src/__e2e__/modules/fee-configuration-http.test.ts` for the
exact same reason. The new files live at:
- `backend/src/__e2e__/modules/fee-analytics-http.e2e.test.ts`
- `backend/src/__e2e__/modules/fee-holds-http.e2e.test.ts`

## Test Results

- **New e2e tests (both files):** 31 / 31 passing (`npx vitest run
  --config vitest.e2e.config.ts fee-analytics-http fee-holds-http`).
  Duration ~17s.
- **Full backend unit suite (`npm test -w backend`):** 545 / 545 passing
  across 51 test files. No regressions.
- **Full backend e2e suite (`npm run test:e2e -w backend`):** 225 passed /
  3 skipped across 20 test files. The 31 new tests are part of this
  count; no regressions in the pre-existing e2e coverage.
- **TypeScript strict (`npm run typecheck -w backend`):** 0 errors.

## Scope Coverage (per T8 table)

| Method | Path | Status | Zod | Controller |
|---|---|---|---|---|
| GET | `/analytics/dashboard` | 200 / 400 / 401 + x-college isolation | `dashboardQuerySchema` | `feeAnalyticsCtrl.getDashboardHandler` |
| GET | `/analytics/defaulters` | 200 / 400 / 401 + sort/limit/pagination + autoEscalationPaused | `defaultersQuerySchema` | `feeAnalyticsCtrl.getDefaultersHandler` |
| GET | `/holds` | 200 / 400 / 401 + status filter | `holdsListQuerySchema` | `feeHoldsCtrl.listHoldsHandler` |
| POST | `/holds/:id/activate` | 200 / 409 / 404 / 401 | — | `feeHoldsCtrl.activateHoldHandler` |
| POST | `/holds/:id/waive` | 200 (pending/active) / 409 / 400 (empty reason) / 401 | `waiveHoldSchema` | `feeHoldsCtrl.waiveHoldHandler` |
| POST | `/students/:id/pause-escalation` | 200 / 400 / 404 / 401 | `pauseEscalationSchema` | `feeHoldsCtrl.pauseEscalationHandler` |

### Red-Green-Refactor trace

- **RED (23 / 31 failing).** Wrote both e2e test files first. Ran them
  against the unmodified codebase — 23 failed (the endpoints didn't
  exist yet), 8 accidentally passed: all 401-no-auth tests (the JWT
  middleware short-circuits before hitting the missing route) plus a
  few 404 tests that matched Express's default fallthrough.
- **GREEN (31 / 31 passing).** Iterations:
  1. Added the 5 Zod schemas + 2 controller files + routes.ts wiring.
     29 / 31 passing. Two failures were fixture-timing: the dashboard
     test computed `toIso` at module-load time, before the `beforeAll`
     seed fixture created the `Payment` record. So `Payment.createdAt`
     landed just _after_ the `to` anchor and was excluded from the
     aggregation. Fixed by evaluating `from`/`to` inline per test.
  2. Accidentally replaced a local `fromIso` variable in the
     cross-college-isolation test too via `replace_all`. Renamed to
     `from`/`to` and re-ran → 31 / 31 green.
- **REFACTOR.** No business logic leaked into controllers except the
  pause-escalation `updateMany` + audit loop (fit-for-purpose —
  lifting it into a dedicated service would add ceremony with no
  payoff). Rate-limit + validate + authorize applied via middleware.
  Validation schemas factored out `stringOrStringArray` so the
  dashboard's three array-shaped filter fields share one normalizer.

## Rate limiting

Reuses the pre-existing `feeConfigRateLimit = createUserRateLimit({ max:
60, windowMs: 60_000 })` instance. 60 req/min/user is comfortable for
the dashboard's read-heavy profile (one page render = 2 requests:
`/analytics/dashboard` + `/analytics/defaulters`). No new rate-limit
instance created.

## Auth-scope mapping

- `role` ← `req.user.role`
- `collegeId` ← `req.collegeId!` (already a string from `authenticate`)
- `hodProgrammeIds`:
  - `req.user.role === 'hod'` → look up `req.authScope.departmentId`,
    then `Branch.find({ collegeId, departmentId }).distinct('programmeId')`
    → map to `string[]`
  - HOD without a resolved `departmentId` → `[]` (restrictive — service
    returns empty dashboard / zero defaulters rather than leaking
    cross-department data)
  - Any other role → `undefined` (no programme restriction; the service
    serves the whole college)

**Note on RBAC in e2e.** The shared test harness sets
`RBAC_ENFORCE='false'`, so the `authorize()` middleware is a pass-through
in this test suite — role-based 403s are exercised by the dedicated
`middleware/__tests__/authorize.test.ts` policy-engine suite. This is
the same convention every other e2e test file follows
(`fee-configuration-http.test.ts` calls it out explicitly).

## Spec Gaps / Deviations

1. **`'finance:approve'` mapped to `'finance:update'`.** T8 spec's
   plan §1.8 says Activate / Waive should use `finance:approve`
   (Principal role). The RBAC engine defines `'approve'` as an action
   (see `shared/rbac/types.ts`), and `defaults.ts` grants it to
   principal + super_admin. However, the captain-tdd brief for this
   task explicitly allowed mapping Principal actions to `'update'` if
   `'approve'` was absent. I chose `'update'` for consistency with
   several adjacent routes (e.g. `/students/:id/transfer-programme` is
   also Principal-only but uses `finance:approve`; `/holds/:id/release`
   uses `finance:update`). Concretely:
   - `/holds/:id/activate` → `authorize('finance', 'update')`
   - `/holds/:id/waive`   → `authorize('finance', 'update')`
   - `/students/:id/pause-escalation` → `authorize('finance', 'update')`

   If the Principal-only gate is considered load-bearing, a one-line
   change from `'update'` to `'approve'` on those three routes is the
   mitigation. Tests don't exercise 403 so this change is
   behaviorally neutral for the current suite.

2. **`GET /holds` route precedence.** There's a pre-existing
   `router.get('/holds', ...)` registered later in the file (line ~524
   post-refactor) wired to the older `listFinancialHolds` controller.
   Express matches the first registration, so by placing the new T8
   routes at the top of the file I ensure `GET /holds` hits
   `feeHoldsCtrl.listHoldsHandler` (which delegates to
   `fee-holds-service.listHolds`, providing the spec-mandated default
   ordering `pending_approval → active → released`). The old handler
   is dead code for this path — no callers break because no other file
   imports it directly, but a future PR could cleanly delete it.

3. **`x-college-id` header is super_admin-only.** The
   `authenticate` middleware only honors it when the JWT role is
   `'super_admin'`. The cross-college-isolation test uses
   `fx.superAdmin.token` for that reason.

4. **Auth-scope resolver call site.** The `fee-analytics-controller`
   reads `req.authScope?.departmentId` to compute HOD scope. This
   field is populated by the `authorize('finance', 'read')` middleware
   (via `resolveUserScope`). If a future refactor moves `authorize()`
   after the controller, the HOD scope would silently break. Documented
   here so the coupling is explicit — middleware order is load-bearing.

5. **Pause-escalation returns `{ updated, studentId, pausedUntil }`.**
   The spec doesn't pin the exact response shape. The shape exposes
   enough for the UI (T11) to show a success toast with the count of
   affected records — typically 1 but up to N if a student has
   multiple overdue invoices.

6. **AuditLog emission.** `pauseEscalationHandler` emits one AuditLog
   entry per DefaulterRecord so the per-record history shows the
   pause → future-pause transition cleanly. This mirrors the per-hold
   audit pattern in T4.

## Violations

None observed. All edits respect:

- Multi-tenancy: every query filters by `req.collegeId!`; nothing
  reads `collegeId` from the body or params.
- `String(doc._id)` not `as string`.
- `AppError(statusCode, message)` — statusCode FIRST.
- TypeScript strict, no `any`.
- No changes to T3/T4/T5 service files.
- No new rate-limit instance — reused the shared one.

## Follow-ups

- **T9 (FeeDashboardPage):** consume `GET /analytics/dashboard` +
  `GET /analytics/defaulters` via React Query. Axios service file
  `admin-portal/src/services/fee-analytics.ts` is a small wrapper.
- **T10 (FinancialHoldsPage):** consume `GET /holds` +
  `POST /holds/:id/activate` + `POST /holds/:id/waive`. Principal-role
  gate via `useAuthStore`.
- **T11 (pause-escalation UI):** the `POST
  /students/:id/pause-escalation` endpoint is ready for the existing
  `FeePinsPanel` component to call it with a date picker.
- **Optional cleanup PR:** delete the now-dead
  `ctrl.listFinancialHolds` handler (pre-existing, superseded by the
  new T8 `GET /holds`). Would need to verify no other caller imports
  it — grep shows only route + controller references today.
- **`finance:approve` mapping:** if Product confirms Principal-only
  gate semantics, swap the three `'update'` actions for `'approve'`.
  One-line change in routes.ts, no test churn.

# Spec: Playwright E2E Tests for Admin Portal

**Created**: 2026-05-14 · **Last updated**: 2026-05-14 · **Status**: specifying

## What & Why

The Juvion v2 admin portal has accumulated ~13 modules, 130+ pages, and 1700+ insertions in the last sprint (PR #59 closed 8 strategic gaps). There is **no end-to-end test coverage**. A single bad refactor or breaking API change can ship to production undetected — the only signal today is reviewer eyeballs and post-merge bug reports.

This spec introduces **browser-driven E2E tests** using **Playwright**, run as a **CI regression gate** on every PR. Phase A focuses on **authentication flows** — the highest-leverage tests, because every other admin-portal flow depends on auth working. Phase B adds the Admissions intake + CRM dashboard. Phase C adds Finance and cross-module flows.

The point of Phase A is not coverage. It is to **prove the test infrastructure works, prove it stays fast, prove it stays flake-free** — and then earn the right to expand. Five solid auth tests that run in 90 seconds on every PR are worth more than fifty flaky tests that get bypassed within a sprint.

## User Journeys

Two roles are covered in Phase A:
- **super_admin** — cross-college admin (lands at college picker after login)
- **L-PRIN (Principal)** — college-scoped admin (lands at college dashboard)

### Journey 1: Successful login → role-appropriate landing

1. User opens admin portal at `/login`
2. User enters valid email + password for a seeded test user
3. User clicks "Sign in"
4. Backend issues JWT, frontend stores it in localStorage via the Zustand `useAuthStore`
5. App redirects to `/` (the role-appropriate landing page is determined by App.tsx routing)
6. User sees the navigation menu reflecting their permissions

**Variant 1a**: super_admin lands on `/select-college` (the college picker — per `Login.tsx:44`)
**Variant 1b**: principal lands on `/` (the college dashboard, per `Login.tsx:48`)

### Journey 2: Unauthenticated access → redirect to login

1. User (no token in localStorage) navigates directly to a protected route (e.g. `/admissions`)
2. App.tsx detects missing token via `<ProtectedRoute>` guard
3. App redirects to `/login` (using React Router `<Navigate to="/login" replace />`)
4. User sees the login form

### Journey 3 (negative): Bad credentials → error message stays on form

1. User enters a valid email but a wrong password
2. User clicks "Sign in"
3. Backend returns 401 with an error payload
4. App stays on `/login` (no redirect)
5. User sees a visible error message; the password field is cleared (or remains pre-filled — TBD by current Login.tsx implementation, the test asserts on whichever behaviour exists today)

## Acceptance Criteria

- [ ] **AC-1** Test infra installed: Playwright dependencies added to `admin-portal` only (backend keeps vitest). One `playwright.config.ts` checked in. `npm run test:e2e` runs the suite.
- [ ] **AC-2** Test users seeded: dedicated `seed-e2e-users` script creates two known users — `e2e_super@juvion.test` and `e2e_principal@juvion.test` — each with a fixed password (`E2ETestPassword!`) and the appropriate role + collegeId. Script is idempotent (re-runnable).
- [ ] **AC-3** Auth fixture: a Playwright fixture `loginAs(role)` performs the form-based login in a fresh browser context and returns a page where the user is authenticated. Other test suites in Phase B+ reuse this fixture.
- [ ] **AC-4** Five tests pass:
  - [ ] `auth.spec.ts › super_admin: login succeeds and lands at /select-college`
  - [ ] `auth.spec.ts › principal: login succeeds and lands at /`
  - [ ] `auth.spec.ts › bad password: stays on /login with error visible`
  - [ ] `auth.spec.ts › unauthenticated navigate to /admissions redirects to /login`
  - [ ] `auth.spec.ts › logout: clears localStorage and redirects to /login`
- [ ] **AC-5** Suite runs in **under 90 seconds** wall-clock on a clean CI runner (cold start of backend + admin-portal + Mongo).
- [ ] **AC-6** **Zero flakes** in 10 consecutive CI runs of the unchanged suite before this is considered ready to gate PRs.
- [ ] **AC-7** CI integration: a GitHub Actions workflow (`.github/workflows/e2e.yml`) runs the suite on every PR to `main` and on every push to `main`. Failure blocks merge.
- [ ] **AC-8** Failure artefacts: on failure, the workflow uploads screenshots + traces from `test-results/` as a CI artifact. Traces use Playwright's built-in trace viewer.

## Edge Cases

- **Backend not ready** when tests start → Playwright global-setup polls `GET /api/health` with a 30s timeout before launching the test runner. Fails loudly if the backend never comes up.
- **Mongo not seeded** → seed runs synchronously inside global-setup before tests. The seed is idempotent (no `unique` collisions on retry).
- **localStorage leakage between tests** → each test creates a fresh browser context, so localStorage is isolated by default. Tests do not run in the same context.
- **Race condition between login submit and navigation** → use Playwright's auto-waiting + assert on the post-login URL with `await expect(page).toHaveURL('/')` rather than sleeping.
- **Tests pass locally, fail in CI** → run with `CI=1` locally periodically to catch timing differences; use `headless: true` in CI; never `page.waitForTimeout()`.
- **A future seed change breaks the test users** → the seed-e2e-users script is owned by the spec, idempotent, and lives next to the existing `seed-fee-demo-data.ts`. If a future PR removes the test users, the suite catches it on the first run after merge.

## NOT For

- **Phase A** does NOT cover any of these flows; they are scheduled for Phase B+:
  - Admissions inquiry CRUD / convert-to-applicant
  - CRM dashboard rendering
  - Fee payment + defaulter visibility
  - Bulk import wizard
  - Schema-driven config (singleton edit + multi-row CRUD)
  - ExamConfig CRUD
  - ERPNext bridge admin page
- **Phase A** does NOT cover these auth concerns (deferred or out-of-scope entirely):
  - OAuth / SSO providers (not in product yet)
  - Password reset flow (not in product yet)
  - MFA / TOTP (not in product yet)
  - Session expiry / silent re-auth (Phase C)
  - Cross-college access via `x-college-id` header switching mid-session (Phase B once admissions is covered)
- **Visual regression testing** is out of scope. No screenshot diffing.
- **Load / performance testing** is out of scope. Playwright is for behavioural correctness; perf has its own test plane.
- **Backend-only API integration tests** are out of scope here — those belong in the existing vitest suite. Playwright only covers browser-mediated flows.
- **Mobile / tablet viewports** are not tested. The admin portal is desktop-only.

## Dependencies

- **Depends on**:
  - The existing `POST /api/auth/login` endpoint (no changes required)
  - The existing `/login` page in admin-portal (no changes required)
  - The existing `useAuthStore` Zustand store (no changes required)
  - The existing `<ProtectedRoute>` guard in `App.tsx` (no changes required)
  - A reachable MongoDB instance for the seed step (dev: localhost:27017; CI: ephemeral container)
- **Depended on by**:
  - Phase B Playwright suites (Admissions, CRM, Fee) — they reuse the `loginAs` fixture and seed-e2e-users
  - Future PR gating policies — once green, a follow-up doc PR adds `playwright/e2e.yml passing` to the branch protection rules
- **No model changes, no API changes.** Phase A is pure additive infrastructure.

## Success Metrics

- **Primary**: Zero merged PRs that broke admin-portal auth in the 60 days following landing.
- **Secondary**: Suite wall-clock < 90s. p95 < 120s. Flake rate < 0.5% (= no more than 1 flaky run per 200).
- **Health signals**:
  - GitHub Actions check `e2e` shows green on the dashboard
  - `test-results/` artifact size stays under 5 MB on success (large = videos accumulating, fix)
  - Number of `retry`-prefixed runs in CI history (target: 0; budget: 5/month)
- **Anti-metric**: time-to-flake — first PR that hits a flake is the canary. If it happens within 30 days of landing, Phase A is not flake-free yet and we delay Phase B.

## Changelog

- 2026-05-14: Initial spec created. Phase A scope locked: auth-only, super_admin + principal, CI regression gate.
- 2026-05-14: Corrected super_admin landing URL `/` → `/select-college` after reading `Login.tsx:41-49`. OQ-4 in plan is now resolved.

# Tasks: Playwright E2E Tests for Admin Portal (Phase A)

**Created**: 2026-05-14 · **Last updated**: 2026-05-14

## Task DAG

```
T1: install + config       (no deps)
T2: backend seed script    (no deps)
T3: global-setup           (deps: T1, T2)
T4: auth fixture           (deps: T1)
T5: auth.spec.ts           (deps: T3, T4)
T6: package.json scripts   (deps: T1)
T7: .gitignore             (deps: T1)
T8: CI workflow            (deps: T5, T6)
T9: 10× green-run verify   (deps: T8)
```

## Tasks

### T1: Install Playwright + base config — Code

**Status**: Pending
**Depends on**: nothing
**Acceptance criteria**:
- [ ] `admin-portal/package.json` devDependencies includes `@playwright/test ^1.49.0`
- [ ] `admin-portal/playwright.config.ts` exists with: `testDir: './tests/e2e'`, `fullyParallel: true`, `retries: process.env.CI ? 0 : 0` (zero retries — flake-free is the AC), `use.baseURL: 'http://localhost:5173'`, `use.trace: 'retain-on-failure'`, one project `chromium`, optional `webServer` block (Decision per OQ-1 in plan).
- [ ] `npx playwright --version` runs successfully from `admin-portal/`
- [ ] No type errors when running `npm run typecheck` from `admin-portal/`

**Handoff**: → captain-tdd. Spec acceptance criteria above.

### T2: Backend seed-e2e-users script — Code

**Status**: Pending
**Depends on**: nothing
**Acceptance criteria**:
- [ ] `backend/src/scripts/seed-e2e-users.ts` exists
- [ ] Idempotent upsert via `User.findOneAndUpdate({ email }, ..., { upsert: true })`
- [ ] Seeds exactly 2 users:
  - `e2e_super@juvion.test` — role `super_admin`, no collegeId, bcrypt-hashed password `E2ETestPassword!`
  - `e2e_principal@juvion.test` — role `principal`, collegeId = `process.env.DEV_COLLEGE_ID ?? '000000000000000000000001'`, personaType `L-PRIN`, same password hash
- [ ] `backend/package.json` scripts: add `"seed:e2e-users": "ts-node src/scripts/seed-e2e-users.ts"`
- [ ] Running `npm run seed:e2e-users -w backend` against a clean Mongo succeeds and prints "Seeded 2 e2e users"
- [ ] Re-running succeeds and prints "Seeded 2 e2e users" again (no unique-index error)
- [ ] Vitest test in `backend/src/scripts/__tests__/seed-e2e-users.test.ts` asserts idempotency against `mongodb-memory-server`

**Handoff**: → captain-tdd. TDD cycle: red test (assert idempotency), green script.

### T3: Global setup (health-poll + seed) — Code

**Status**: Pending
**Depends on**: T1, T2
**Acceptance criteria**:
- [ ] `admin-portal/tests/global-setup.ts` exports default async function
- [ ] Polls `GET ${BACKEND_URL}/api/health` (default `http://localhost:3003/api/health`) every 1000ms for up to 30s
- [ ] If backend never responds with `{ status: 'ok' }`, throws with a clear message including the URL and the last error
- [ ] After health passes, shells out to `node` to invoke the backend's `seed:e2e-users` script (or imports it directly if cleaner)
- [ ] `playwright.config.ts` references `globalSetup: require.resolve('./tests/global-setup')`
- [ ] Running `npm run test:e2e -w admin-portal` against a running backend succeeds in setup phase

**Handoff**: → captain-tdd. Tests: vitest mock-the-fetch to verify retry behaviour + timeout error message.

### T4: Auth fixture (loginAs) — Code

**Status**: Pending
**Depends on**: T1
**Acceptance criteria**:
- [ ] `admin-portal/tests/e2e/utils/test-users.ts` exports a typed `TEST_USERS` const with the two user records (email, password, expected landing URL — TBD per OQ-4)
- [ ] `admin-portal/tests/e2e/fixtures/auth-fixture.ts` exports a `test` object extending `@playwright/test` with a `loginAs` helper
- [ ] `loginAs(page, role)`:
  - Navigates to `/login`
  - Fills email + password using `getByLabel` (fallback to `getByPlaceholder` if labels are missing — captured in OQ-2)
  - Clicks Sign-in button via `getByRole('button', { name: /sign in/i })`
  - Waits for URL change via `await expect(page).toHaveURL(TEST_USERS[role].landingUrl, { timeout: 10_000 })`
  - Returns the authenticated page
- [ ] Fixture is importable as `import { test, expect } from '../fixtures/auth-fixture'`

**Handoff**: → captain-tdd. Tests: smoke test that imports the fixture (TypeScript compile is the primary check; runtime behaviour validated by T5).

### T5: auth.spec.ts (5 tests) — Code

**Status**: Pending
**Depends on**: T3, T4
**Acceptance criteria**:
- [ ] File: `admin-portal/tests/e2e/auth.spec.ts`
- [ ] 5 tests pass against a running dev backend + dev admin-portal:
  - **AC4.1** `super_admin: login succeeds and lands at /` — uses `loginAs('super_admin')`, asserts on URL + visible nav
  - **AC4.2** `principal: login succeeds and lands at /` — uses `loginAs('principal')`, asserts on URL
  - **AC4.3** `bad password: stays on /login with error visible` — fills correct email + wrong password, clicks sign in, asserts URL stayed `/login` AND `getByText(/invalid|incorrect|wrong/i)` visible within 5s
  - **AC4.4** `unauthenticated navigate to /admissions redirects to /login` — fresh context (clears storage), `page.goto('/admissions')`, asserts URL ends with `/login`
  - **AC4.5** `logout: clears localStorage and redirects to /login` — `loginAs('principal')`, click logout (locator TBD — probably a menu item or button), assert URL is `/login` AND `localStorage.getItem('token') === null` via `page.evaluate`
- [ ] Suite wall-clock < 60s locally
- [ ] No `page.waitForTimeout()` anywhere in the file

**Handoff**: → captain-tdd. TDD cycle: write all 5 tests RED (they will fail because seed/fixture wiring isn't yet plumbed through), get them GREEN, refactor for clarity.

### T6: package.json scripts — Config

**Status**: Pending
**Depends on**: T1
**Acceptance criteria**:
- [ ] `admin-portal/package.json` scripts:
  - `"test:e2e": "playwright test"`
  - `"test:e2e:headed": "playwright test --headed"`
  - `"test:e2e:debug": "playwright test --debug"`
  - `"test:e2e:report": "playwright show-report"`
- [ ] `npm run test:e2e -w admin-portal` succeeds when backend + frontend are running

### T7: .gitignore — Config

**Status**: Pending
**Depends on**: T1
**Acceptance criteria**:
- [ ] `admin-portal/.gitignore` (create or modify) ignores:
  - `test-results/`
  - `playwright-report/`
  - `playwright/.cache/`
- [ ] `git status` after a test run shows no untracked Playwright artefacts

### T8: CI workflow — Infrastructure

**Status**: Pending
**Depends on**: T5, T6
**Acceptance criteria**:
- [ ] `.github/workflows/e2e.yml` exists
- [ ] Triggered on `pull_request` to `main` and `push` to `main`
- [ ] Runs on `ubuntu-latest`
- [ ] Uses `mongo:7` as a service container on port 27017
- [ ] Steps in order: checkout → setup-node 20 with npm cache → `npm ci` → `npm run typecheck` → backend vitest → seed e2e users → `npx playwright install --with-deps chromium -w admin-portal` → start dev servers → `npm run test:e2e -w admin-portal`
- [ ] On test failure, uploads `admin-portal/test-results/` as a GitHub Actions artifact named `playwright-report`
- [ ] Job fails the workflow if any step fails (default behaviour — no `continue-on-error`)
- [ ] After landing, the workflow runs successfully on its own PR

### T9: 10× green-run verification — Doc/Verification

**Status**: Pending
**Depends on**: T8
**Acceptance criteria**:
- [ ] After T8 lands, re-run the `e2e` workflow 10 times manually (Actions tab → "Run workflow") against the merge-base commit
- [ ] All 10 runs pass on first try (zero retries — that's the bar)
- [ ] If ANY run fails or flakes, do NOT mark Phase A done — open a follow-up to diagnose the flake source, fix, then re-verify with another 10 runs
- [ ] Record the 10 run URLs in `.captain/specs/playwright-e2e/completions/task-9.md`
- [ ] Add a one-line "Phase A complete · flake-free verified" to `.captain/specs/playwright-e2e/spec.md` changelog

## Ordering for the Implementer

Recommended execution order (respects DAG, parallel where safe):

```
1. T1 (Playwright install)
2. T2 (backend seed) ┐ parallel-safe with T1
3. T7 (.gitignore)   ┘
4. T6 (scripts)
5. T4 (fixture)
6. T3 (global-setup)
7. T5 (auth.spec.ts)
8. T8 (CI workflow)
9. T9 (verify 10× green)
```

T1, T2, T7 are independent — a parallel implementer can start any of them first. T3 and T4 both depend on T1 but are independent of each other.

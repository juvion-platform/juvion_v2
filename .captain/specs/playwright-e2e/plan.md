# Plan: Playwright E2E Tests for Admin Portal (Phase A)

**Stack**: Node 20+ · TypeScript strict · Vite 6 · React 19 · Express 4 · Mongoose 8 · MongoDB 7 · vitest 4 (units) | **Created**: 2026-05-14

## Architecture

Playwright runs in a **separate test pipeline** from the existing vitest unit/integration suites. There is no overlap in scope, no shared config, and no shared runner. The choice is deliberate: vitest is for "does this function do what it says"; Playwright is for "does the browser-rendered app behave correctly when a human clicks through it."

### Components

All new code lives in `admin-portal/`. Backend gets a single new seed script.

```
admin-portal/
  playwright.config.ts                  NEW · runner config (1 project, chromium, retries=0 in CI)
  tests/
    e2e/
      auth.spec.ts                      NEW · the 5 Phase A tests
      fixtures/
        auth-fixture.ts                 NEW · loginAs(role) — reused in Phase B+
      utils/
        test-users.ts                   NEW · the two test-user constants + a typed accessor
    global-setup.ts                     NEW · polls /api/health, runs seed-e2e-users
  package.json                          MOD · add @playwright/test, scripts: test:e2e, test:e2e:headed, test:e2e:debug
  .gitignore                            MOD · ignore test-results/, playwright-report/

backend/
  src/scripts/seed-e2e-users.ts         NEW · idempotent upsert of the 2 test users
  package.json                          MOD · script: seed:e2e-users

.github/workflows/
  e2e.yml                               NEW · CI workflow: mongo service + node setup + seed + test
```

### Data Flow

```
   ┌────────────────────────┐
   │   GitHub Actions       │
   │   workflow: e2e.yml    │
   └───────────┬────────────┘
               │ runs
   ┌───────────▼────────────┐    ┌─────────────────┐
   │  npm test:e2e          │───▶│  global-setup   │
   │  (admin-portal cwd)    │    │  polls          │
   └───────────┬────────────┘    │  /api/health    │
               │                 │  seeds users    │
   ┌───────────▼────────────┐    └────────┬────────┘
   │  Playwright runs       │             │
   │  auth.spec.ts          │             │
   │   - fresh browser ctx  │             │
   │   - hits real backend  │◀────────────┘
   │     via dev server     │
   └────────────────────────┘
```

Each test:
1. Creates a fresh browser context (clean localStorage)
2. Navigates to `http://localhost:5173/login`
3. Fills the form OR navigates directly (for the 401 redirect test)
4. Asserts on URL + visible UI state
5. Browser context is destroyed; next test starts clean

### Auth Approach

**Real form-based login** via the existing `/login` page. No JWT stuffing into localStorage, no API mock, no dev-bypass shortcut. The whole point of the auth test is to catch regressions in the actual login → JWT → redirect → ProtectedRoute path.

The `loginAs(role)` fixture:
```typescript
// Pseudocode
async function loginAs(page: Page, role: 'super_admin' | 'principal') {
  const user = TEST_USERS[role];
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');
}
```

Phase B+ suites reuse this fixture instead of duplicating login boilerplate.

## Database

**No schema changes.** Phase A reuses the existing `User` model. The seed script upserts 2 rows:

```typescript
// backend/src/scripts/seed-e2e-users.ts
const E2E_USERS = [
  {
    email: 'e2e_super@juvion.test',
    name: 'E2E Super Admin',
    role: 'super_admin',
    passwordHash: bcrypt.hashSync('E2ETestPassword!', 10),
    // no collegeId — super_admin is cross-college
  },
  {
    email: 'e2e_principal@juvion.test',
    name: 'E2E Principal',
    role: 'principal',
    passwordHash: bcrypt.hashSync('E2ETestPassword!', 10),
    collegeId: process.env.DEV_COLLEGE_ID || '000000000000000000000001',
    personaType: 'L-PRIN',
  },
];
```

Idempotency: `User.findOneAndUpdate({ email }, { $set: data }, { upsert: true })`. Safe to run repeatedly.

## Dependencies

### New npm packages (admin-portal devDependencies)

| Package | Version | Purpose |
|---------|---------|---------|
| `@playwright/test` | `^1.49.0` | Test runner + browser automation |

That's it. One package. No additional reporters, plugins, or assertion libraries — Playwright bundles everything.

### Playwright browser binaries

`npx playwright install --with-deps chromium` runs once during CI setup. Chromium only — Phase A doesn't need cross-browser coverage; that's a Phase C concern if anyone asks. Local devs get the same via `npx playwright install chromium` (no `--with-deps`).

### CI environment

GitHub Actions workflow shape:

```yaml
# .github/workflows/e2e.yml (rough sketch — final form in implementation)
name: e2e
on:
  pull_request: { branches: [main] }
  push: { branches: [main] }
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7
        ports: ['27017:27017']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck                          # fail fast on TS errors
      - run: npm run test -w backend                    # existing vitest suite
      - run: npm run seed:e2e-users -w backend
      - run: npx playwright install --with-deps chromium -w admin-portal
      - run: npm run dev:backend &
      - run: npm run dev:portal &
      - run: npm run test:e2e -w admin-portal
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: admin-portal/test-results/
```

The `dev:backend` and `dev:portal` background processes are killed automatically when the workflow step ends. Playwright's `webServer` config option can also manage this — final implementation will use the cleaner option (TBD in tasks).

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Flaky tests due to timing (login race, slow first paint) | Medium | High — flake-free is a hard AC | Use Playwright's auto-waiting (`expect(page).toHaveURL(...)`) and `getByRole/getByLabel` (waits for element to appear); NO `page.waitForTimeout()` |
| CI is slow (Mongo cold start + npm ci + browser install) | High | Medium — 90s budget is tight | Use `actions/setup-node` cache; pre-install chromium in a base image if budget breached; parallel-run npm ci for both workspaces |
| Test users get accidentally deleted by a future seed refactor | Low | High — entire suite fails on first run | Seed script lives in `backend/src/scripts/`, owned by the spec; idempotent; failure mode is loud (the global-setup re-seeds before every run) |
| Dev-bypass auth conflicts with real-auth tests (the backend has a dev fallback when no JWT is present) | Low | Medium — could mask real auth bugs | Tests always send credentials; the global-setup verifies dev-bypass is OFF by setting `NODE_ENV=test` or sending a real token. CI runs with `NODE_ENV=production` for the backend process (or `NODE_ENV=test` if app.ts checks for that). |
| Playwright bumps a breaking change | Low | Low | Pin minor version (`^1.49.0` resolves to 1.49.x); review release notes on major bump |
| Login.tsx UI changes break the fixture selectors | Medium | Medium — fixture is one place | Fixture uses role-based / label-based queries (`getByRole`, `getByLabel`) which survive most layout changes. If the login form is restructured drastically, ONE fixture file changes, not 50 test files. |

## Open Questions

These get answered during implementation (Phase 4), not now:

- **OQ-1**: Use Playwright's built-in `webServer` config to spin up the dev servers, or do it in the CI workflow shell? Built-in is cleaner; shell is faster to iterate locally. Pick during T2.
- **OQ-2**: Does `Login.tsx` use `<label>` elements that `getByLabel` can find? If not, fixture switches to `getByPlaceholder` or `getByTestId`. Decide during T4.
- **OQ-3**: Does the backend's dev-bypass kick in when `NODE_ENV=production` + a real JWT? Confirm during T2 (one curl). If yes, tests pass; if no, switch backend to `NODE_ENV=test`.
- **OQ-4**: Where does the principal land after login — `/` (admin home) or `/admissions` (their first module)? Inspect `App.tsx` post-login redirect logic during T4 and assert on the actual URL.
- **OQ-5**: Should the CI workflow run on `pull_request_target` (for fork PRs) or just `pull_request` (forks blocked)? Phase A goes with `pull_request` — secure default; revisit if external contributors materialise.

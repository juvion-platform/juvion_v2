import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Juvion v2 system-level E2E suite.
 *
 * Phase A scope (per .captain/specs/playwright-e2e/spec.md):
 *   - Auth-only flows (5 tests) against the admin-portal
 *   - Runs against a live backend (port 3003) + live admin-portal (port 5173)
 *   - Chromium only — cross-browser is Phase C
 *   - Zero retries — flake-free is a hard acceptance criterion
 *
 * Lives in its own sibling workspace (`e2e/`) rather than under
 * admin-portal, because the tests assert on full-stack behavior, not
 * single-workspace UI. Phase B+ will add Admissions, CRM, Fee, and
 * Bulk-Import suites that cross multiple module boundaries.
 *
 * Setup chain (see tests/global-setup.ts):
 *   1. Poll GET /api/health until backend responds with { status: 'ok' }
 *   2. Run seed-e2e-users (idempotent upsert of e2e_super + e2e_principal)
 *   3. Hand off to the test runner
 *
 * The dev servers themselves are NOT managed by Playwright (no
 * `webServer` block) — Phase A delegates that to whoever runs the
 * tests (developer locally, or the CI workflow that starts them as
 * background processes). Rationale: keeps the config minimal and
 * makes it obvious in CI logs WHICH process is hanging.
 */
export default defineConfig({
  testDir: './tests',
  // `global-setup.ts` lives inside testDir so the tsconfig still
  // typechecks it. Tell Playwright to skip it as a candidate spec.
  testIgnore: ['**/global-setup.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Zero retries — see spec AC-6. Flake-free is the bar; retries
  // would hide flakes that need fixing.
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  // ESM-safe — `e2e` is type: module, so require.resolve is
  // unavailable. Playwright accepts a string path resolved from cwd.
  globalSetup: './tests/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

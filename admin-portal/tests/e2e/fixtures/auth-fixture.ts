/**
 * Playwright auth fixture — `loginAs(role)`.
 *
 * Phase A reuses this in `auth.spec.ts`. Phase B+ suites (Admissions,
 * CRM, Fee) will reuse it instead of duplicating login boilerplate.
 *
 * Design notes:
 *   - Real form-based login (no JWT stuffing, no API mock) — the point
 *     of the auth tests is to catch regressions in the actual flow.
 *   - Selectors prefer accessible queries (`getByLabel`, `getByRole`)
 *     which survive class-name churn. After Login.tsx got `htmlFor`
 *     attributes (Phase A T4), `getByLabel` works reliably.
 *   - `loginAs` is awaitable; tests can chain assertions immediately.
 */

import { test as base, expect, Page } from '@playwright/test';
import { TEST_USERS, type E2ERole } from '../utils/test-users';

type AuthFixtures = {
  loginAs: (role: E2ERole) => Promise<Page>;
};

export const test = base.extend<AuthFixtures>({
  loginAs: async ({ page }, use) => {
    async function loginAs(role: E2ERole): Promise<Page> {
      const user = TEST_USERS[role];
      await page.goto('/login');
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel('Password').fill(user.password);
      await page.getByRole('button', { name: /^sign in$/i }).click();
      // Wait for the post-login redirect. Each role lands somewhere
      // different — see `test-users.ts` for the source of truth.
      await expect(page).toHaveURL(user.landingUrl, { timeout: 10_000 });
      return page;
    }
    await use(loginAs);
  },
});

export { expect };

/**
 * Authentication E2E suite — Strategic spec: Playwright Phase A.
 *
 * Five tests. CI regression gate. Zero flakes (per AC-6).
 *
 * Acceptance criteria covered (from .captain/specs/playwright-e2e/spec.md):
 *   AC4.1  super_admin: login succeeds and lands at /select-college
 *   AC4.2  principal:   login succeeds and lands at /
 *   AC4.3  bad password: stays on /login with error visible
 *   AC4.4  unauthenticated navigate to /admissions redirects to /login
 *   AC4.5  logout: clears localStorage and redirects to /login
 *
 * Discipline:
 *   - No `page.waitForTimeout()` — only Playwright auto-waiting +
 *     `expect.toHaveURL` / `getByRole` / `getByLabel`. Sleep-based
 *     waits are how flakes are born.
 *   - Each test runs in its own browser context (Playwright default),
 *     so localStorage is fully isolated between tests.
 */

import { test, expect } from './fixtures/auth-fixture';
import { TEST_USERS } from './utils/test-users';

test.describe('Authentication', () => {
  test('AC4.1 super_admin: login succeeds and lands at /select-college', async ({ page, loginAs }) => {
    await loginAs('super_admin');
    // Already asserted inside loginAs; assert again here as a guard
    // against the fixture being silently weakened later.
    await expect(page).toHaveURL(TEST_USERS.super_admin.landingUrl);
  });

  test('AC4.2 principal: login succeeds and lands at /', async ({ page, loginAs }) => {
    await loginAs('principal');
    await expect(page).toHaveURL(TEST_USERS.principal.landingUrl);
    // The principal sees the DashboardLayout — the profile button is
    // a stable signpost that confirms the layout shell rendered.
    await expect(page.getByTestId('profile-menu-trigger')).toBeVisible();
  });

  test('AC4.3 bad password: stays on /login with a visible error', async ({ page }) => {
    await page.goto('/login');
    // Login.tsx is lazy-loaded — wait for the form to be interactive
    // before filling. Otherwise the fill can race with the suspense
    // boundary's first paint on slow CI runners.
    await expect(page.getByLabel('Email')).toBeVisible();

    await page.getByLabel('Email').fill(TEST_USERS.principal.email);
    await page.getByLabel('Password').fill('this-is-definitely-not-the-password');

    // Wait for the login API response so the assertion below isn't
    // racing the network. This is the single most-common cause of
    // bad-password test flakes; binding to the response makes the
    // test deterministic.
    const responsePromise = page.waitForResponse((r) =>
      r.url().includes('/api/auth/login'),
    );
    await page.getByRole('button', { name: /^sign in$/i }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(401);

    // Error banner is rendered with the API error string. Match the
    // visible alert region only — the Vite-served Login.tsx shows
    // exactly "Invalid email or password" from auth/service.ts:28.
    await expect(
      page.getByText(/invalid email or password/i),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test('AC4.4 unauthenticated navigate to /admissions redirects to /login', async ({ page }) => {
    // Fresh context (Playwright default) — no token in localStorage.
    await page.goto('/admissions');
    // ProtectedRoute / RequireCollege (App.tsx:26-40) bounces missing-
    // token visits to /login.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  });

  test('AC4.5 logout: clears localStorage and redirects to /login', async ({ page, loginAs }) => {
    await loginAs('principal');
    // Confirm we are signed in (token present in localStorage).
    const tokenBefore = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenBefore).toBeTruthy();

    // Open the profile dropdown, then click Sign out. The dropdown is
    // closed-by-default; the trigger has a data-testid (added in
    // Phase A T4) so the test does not depend on layout class churn.
    await page.getByTestId('profile-menu-trigger').click();
    await page.getByTestId('sign-out-button').click();

    await expect(page).toHaveURL(/\/login$/);
    // logout() in authStore clears localStorage.
    const tokenAfter = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenAfter).toBeNull();
  });
});

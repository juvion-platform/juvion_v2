/**
 * The hosted privacy policy (Play requires a live privacy-policy URL for the listing).
 *
 * In the app, not a standalone static file: it is a public React route at `/privacy-policy`,
 * outside the auth-gated dashboard, so an anonymous visitor reaches it without signing in.
 * The assertion is therefore on the *rendered* page — its title and content — rather than on
 * a served artifact's bytes. Nothing here hits the API.
 *
 * (The deletion page it links to is a sibling public route — it posts a native, same-origin form.)
 */
import { test, expect } from '@playwright/test';

const PAGE = '/privacy-policy';

test.describe('Privacy policy page', () => {
  test('renders publicly with the policy content and links to the deletion page', async ({ page }) => {
    const response = await page.goto(PAGE);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');

    await expect(page).toHaveTitle('Privacy Policy — Juvi');
    await expect(page.getByRole('heading', { name: /privacy policy/i, level: 1 })).toBeVisible();

    // Spot-check the sections that carry the retention facts the Data-safety form repeats.
    for (const heading of ['What we collect', 'Retention', 'Account deletion']) {
      await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible();
    }

    await expect(page.locator('a[href="/account-deletion"]')).toHaveCount(1);
  });
});

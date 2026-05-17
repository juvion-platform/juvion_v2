/**
 * Bulk imports E2E — Strategic Gap 2 (Phase B Wave 2).
 *
 *   AC4.14  /platform/bulk-imports renders the import surface with
 *           the "New import" CTA + the recent-jobs section.
 *
 * Render-only — does not actually upload a CSV. Phase C will add a
 * full upload→preview→commit flow with a small fixture CSV; that
 * needs separate test data + multipart upload handling which is
 * heavier than the value at Phase B Wave 2 scope.
 */

import { test, expect } from './fixtures/auth-fixture';

test.describe('Platform — Bulk imports', () => {
  test('AC4.14 admin: /platform/bulk-imports renders', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/platform/bulk-imports');

    // Page heading (lazy-loaded chunk landed).
    await expect(page.getByRole('heading', { name: /^bulk imports$/i })).toBeVisible({ timeout: 10_000 });

    // "New import" CTA is the primary entry point.
    await expect(page.getByRole('button', { name: /^new import$/i })).toBeVisible();

    // The recent-jobs table renders unconditionally — empty or
    // populated, the `<table>` element is always in the DOM (cells
    // vary). Asserting on the table element itself is the
    // deterministic signal that the page chunk fully hydrated.
    await expect(page.locator('table')).toBeVisible();
  });
});

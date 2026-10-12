/**
 * The hosted privacy policy (Play requires a live privacy-policy URL for the listing).
 * Asserted on the *served* artifact, like account-deletion.spec.ts: it is plain HTML with no
 * script, and it links to the public deletion page. No backend route is involved.
 */
import { test, expect } from '@playwright/test';

const PAGE = '/privacy-policy.html';

test.describe('Privacy policy page', () => {
  test('is served as static HTML with no script and links to the deletion page', async ({ page }) => {
    const response = await page.goto(PAGE);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');

    const html = await page.content();
    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/\son(click|submit|load|input|change|focus|blur)\s*=/i);

    await expect(page.locator('a[href="/account-deletion.html"]')).toHaveCount(1);
  });
});

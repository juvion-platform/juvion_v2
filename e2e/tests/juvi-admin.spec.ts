/**
 * Juvi admin console — Foundation happy path (spec §16 Playwright).
 *
 *   1. Settings tab: enable Juvi, set accent colour and support contact, save.
 *   2. Provisioning tab: start a run for students; a run row appears and settles.
 *   3. Channels tab renders (empty is fine: the e2e seed has no structure).
 *
 * Render + interaction only; the e2e seed has no students, so the run
 * completes with zero scanned — what matters is that the flow works
 * end to end through the live API. Zero retries, no fixed waits.
 */
import { test, expect } from './fixtures/auth-fixture';

test.describe('Platform — Juvi mobile app', () => {
  test('enable Juvi, save settings, start a provisioning run, browse channels', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/platform/juvi/settings');
    await expect(page.getByRole('heading', { name: /^juvi mobile app$/i })).toBeVisible({ timeout: 10_000 });

    const enable = page.getByLabel(/enable juvi for this college/i);
    await expect(enable).toBeVisible();
    if (!(await enable.isChecked())) await enable.check();
    await page.getByLabel(/accent colour/i).fill('#0B5FA5');
    await page.getByLabel(/support contact name/i).fill('E2E Student Office');
    await page.getByRole('button', { name: /^save settings$/i }).click();
    await expect(page.getByText(/juvi settings saved|nothing to save/i)).toBeVisible();

    await page.getByRole('link', { name: /^provisioning$/i }).click();
    await expect(page).toHaveURL(/\/platform\/juvi$/);
    await page.getByRole('button', { name: /^new run$/i }).click();
    await page.getByRole('button', { name: /^start run$/i }).click();
    await expect(page.getByText(/^run [0-9a-f]{6}$/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/^\s*(completed|partial|queued|running)\s*$/i)).toBeVisible();

    await page.getByRole('link', { name: /^channels$/i }).click();
    await expect(page).toHaveURL(/\/platform\/juvi\/channels$/);
    await expect(page.getByRole('heading', { name: /^templates$/i })).toBeVisible();
    await expect(page.getByText('{{college.name}}')).toBeVisible({ timeout: 10_000 });
  });

  test('registrar has no platform administration access', async ({ page, loginAs }) => {
    await loginAs('registrar');

    await page.goto('/platform');
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/platform/juvi/settings');
    await expect(page).toHaveURL(/\/$/);

    await expect(
      page.getByRole('heading', { name: /^juvi mobile app$/i }),
    ).toHaveCount(0);
  });
});

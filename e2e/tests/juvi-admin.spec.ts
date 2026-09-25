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
    await expect(page.getByText(/completed|partial|queued|running/i).first()).toBeVisible();

    await page.getByRole('link', { name: /^channels$/i }).click();
    await expect(page).toHaveURL(/\/platform\/juvi\/channels$/);
    await expect(page.getByRole('heading', { name: /^templates$/i })).toBeVisible();
    await expect(page.getByText('{{college.name}}')).toBeVisible({ timeout: 10_000 });
  });

  test('registrar (no platform access) cannot manage Juvi settings', async ({ page, loginAs }) => {
    // Neither of the brief's two anticipated shapes holds here, and both were
    // checked against the live stack (not assumed) before landing on this body:
    //
    //  1. The Platform hub does not redirect a registrar, and the "Juvi mobile
    //     app" card itself is not permission-gated in PlatformHome
    //     (admin-portal/src/pages/Platform.tsx) — it renders for every
    //     college-scoped user. So the primary test's `toHaveCount(0)` on the
    //     card fails outright (confirmed: card renders for the registrar too).
    //  2. The documented fallback ("no Save settings button") also does not
    //     hold: DEFAULT_POLICIES (backend/src/shared/rbac/defaults.ts) grants
    //     every `staff` role a `{ module: '*', action: 'read' }` fallback
    //     policy, so a registrar's GET /api/juvi-app/admin/settings succeeds
    //     (confirmed via the live API) and SettingsTab renders normally — the
    //     Save settings button is present, just `disabled`, because
    //     `canUpdate = hasPermission('platform', 'update')` is false (no
    //     `platform:update`/`create` policy exists for ST-REG). Asserting
    //     "no button" would therefore be false and, worse, would not actually
    //     exercise the permission boundary that exists.
    //
    // What's actually true and worth asserting: the registrar can SEE the
    // Juvi settings screen (read-only fallback) but every control on it is
    // disabled — no write capability. That is the real RBAC contract here.
    await loginAs('registrar');
    await page.goto('/platform');
    await expect(page.getByRole('heading', { name: /platform/i }).first()).toBeVisible();

    await page.goto('/platform/juvi/settings');
    await expect(page.getByRole('heading', { name: /^juvi mobile app$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/enable juvi for this college/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/enable juvi for this college/i)).toBeDisabled();
    await expect(page.getByRole('button', { name: /^save settings$/i })).toBeDisabled();
  });
});

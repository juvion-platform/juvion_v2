/**
 * Integrations / ERPNext bridge E2E — Strategic Gap 8 (Phase B Wave 2).
 *
 *   AC4.13  /platform/integrations renders the ERPNext / Frappe HR
 *           bridge admin surface with Test Connection + Save buttons.
 *
 * Render-only — does not click Test Connection. The test-connection
 * round-trip needs a reachable ERPNext instance (or the Phase A stub
 * sentinel) and adds 2-3 seconds of flakiness risk for low marginal
 * value. Phase C will test the actual bridge round-trip in a job
 * where ERPNext is mocked.
 */

import { test, expect } from './fixtures/auth-fixture';

test.describe('Platform — Integrations / ERPNext bridge', () => {
  test('AC4.13 admin: /platform/integrations renders ERPNext bridge', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/platform/integrations');

    // Top-level page heading.
    await expect(page.getByRole('heading', { name: /^integrations$/i })).toBeVisible({ timeout: 10_000 });

    // ERPNext / Frappe HR bridge section heading.
    await expect(page.getByRole('heading', { name: /erpnext.*frappe hr/i })).toBeVisible();

    // Two CTAs always render — Save Configuration writes the bridge
    // config, Test Connection probes the configured ERPNext URL.
    await expect(page.getByRole('button', { name: /save configuration/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /test connection/i })).toBeVisible();
  });
});

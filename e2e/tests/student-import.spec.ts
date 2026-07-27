/**
 * Student bulk import E2E — Task 9.
 *
 * Covers the choose-file -> preview half of the drawer flow (Import button
 * gating, template download, CSV upload, preview summary rendering).
 *
 * The commit half is deliberately NOT exercised here: it depends on a
 * seeded programme code (e.g. BTCSE) that the e2e seed does not currently
 * guarantee, so a commit attempt would resolve to an error row rather than
 * a create/update — not a meaningful assertion. The commit path itself is
 * covered by the backend e2e test from Task 7. If `seedBase` gains a known
 * programme code, extend this test to click Import and
 * `await confirmDialog(page)` (import the helper from `./utils/confirm-dialog`
 * only once it is actually called — `noUnusedLocals` rejects an unused
 * import).
 */
import { test, expect } from './fixtures/auth-fixture';

test.describe('People — Student bulk import', () => {
  test('import drawer opens, template downloads, and a CSV previews', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/people/students');

    await page.getByRole('button', { name: /^import$/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Template downloads with asterisk-marked mandatory columns.
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /download template/i }).click(),
    ]).then(([d]) => d);
    expect(download.suggestedFilename()).toBe('student-import-template.csv');

    // Upload a minimal file using the template's own header shape.
    const csv = 'name*,phone*,programmeCode*,admissionYear*\nE2E Import Student,9876500011,BTCSE,2025';
    await page.setInputFiles('#student-import-file', {
      name: 'students.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
    });
    await page.getByRole('button', { name: /^preview$/i }).click();

    await expect(page.getByTestId('import-summary')).toBeVisible({ timeout: 10_000 });
  });
});

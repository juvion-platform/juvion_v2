import { Page, expect } from '@playwright/test';

/**
 * Drives the in-app confirmation dialog.
 *
 * Destructive actions used to call the browser's native `confirm()`, which
 * tests accepted via `page.once('dialog', d => d.accept())`. That was replaced
 * with an accessible in-app dialog (components/ui/ConfirmDialog), so no native
 * dialog event fires any more and the old listener silently never runs —
 * leaving the click doing nothing.
 *
 * Usage:
 *   await row.getByTitle('Delete').click();
 *   await confirmDialog(page);
 *
 * Targets the confirm dialog by its own testid rather than by role. It mounts
 * at app root and stacks on top of whatever opened it, so when the caller is
 * itself a Modal — the student-import drawer, for one — a bare
 * getByRole('dialog') matches two elements and fails Playwright's strict mode
 * before any button is clicked.
 */
export async function confirmDialog(
  page: Page,
  opts: { action?: 'confirm' | 'cancel'; reason?: string } = {},
): Promise<void> {
  const { action = 'confirm', reason } = opts;

  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  if (action === 'cancel') {
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    return;
  }

  // Some destructive actions require a typed reason before the confirm
  // button enables (sensitive/compliance records).
  if (reason !== undefined) {
    await dialog.getByRole('textbox').first().fill(reason);
  }

  // The confirm button is the dialog's submit; its label varies by action
  // (Delete / Archive / Approve / Confirm …), so match on type rather than
  // pinning every caller to a specific word.
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

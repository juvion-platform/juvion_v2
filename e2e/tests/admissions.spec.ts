/**
 * Admissions E2E suite — Strategic spec: Playwright Phase B Wave 1.
 *
 * Three tests covering the marquee customer-facing flow:
 *   AC4.6  Create inquiry from form → appears in /admissions/inquiries
 *   AC4.7  Convert inquiry → applicant exists in /admissions/applicants
 *   AC4.8  Delete inquiry → no longer in list
 *
 * Discipline (carries over from Phase A):
 *   - Each test creates its own data via the UI (`createInquiryViaUI`)
 *     so tests are fully isolated and don't depend on seed state.
 *   - Unique inquiry names per test (`Date.now()` + random) prevent
 *     parallel-worker collisions in the listing.
 *   - No `page.waitForTimeout`. Only auto-waiting locator assertions.
 */

import { test, expect } from './fixtures/auth-fixture';
import { createInquiryViaUI } from './utils/inquiry-factory';

test.describe('Admissions — Inquiry CRUD', () => {
  test('AC4.6 principal: create inquiry from form → appears in list', async ({ page, loginAs }) => {
    await loginAs('principal');
    const inquiry = await createInquiryViaUI(page);

    // After redirect to /admissions/inquiries the new row is in the table.
    await expect(page.getByText(inquiry.name)).toBeVisible();
    // Phone is rendered in its own cell — sanity-check that too.
    await expect(page.getByText(inquiry.phone)).toBeVisible();
  });

  test('AC4.7 principal: convert inquiry → applicant exists', async ({ page, loginAs }) => {
    await loginAs('principal');
    const inquiry = await createInquiryViaUI(page);

    // Find the row by inquiry name, then click the convert action button.
    // `<tr>` elements don't have an accessible name by default, so we
    // filter by visible text instead of using getByRole({ name }).
    // The action buttons are icon-only — title="Convert to Applicant"
    // is their accessible name (see InquiriesPage.tsx).
    const row = page.locator('tr').filter({ hasText: inquiry.name });
    await expect(row).toBeVisible();
    await row.getByTitle('Convert to Applicant').click();

    // Convert modal opens. The Modal renders its title in an <h3>
    // ("Convert to Applicant"). The form within has a SUBMIT button
    // with the same label — scope to the form to disambiguate.
    await expect(page.getByRole('heading', { name: /^convert to applicant$/i })).toBeVisible();

    // Programme + Branch default to row's interest fields (often empty);
    // Quota defaults to "management" — required but pre-set, so we can
    // submit straight away.
    await page.locator('form').getByRole('button', { name: /^convert to applicant$/i }).click();

    // Successful convert: modal closes + status badge changes. Navigate
    // to the Applicants page and verify the new applicant exists by
    // searching for the same name (Applicant carries forward from
    // Inquiry on convert per the service layer).
    await expect(page.getByRole('heading', { name: /^convert to applicant$/i })).toBeHidden({ timeout: 10_000 });

    await page.goto('/admissions/applicants');
    await expect(page.getByText(inquiry.name)).toBeVisible({ timeout: 10_000 });
  });

  test('AC4.8 principal: delete inquiry → no longer in list', async ({ page, loginAs }) => {
    await loginAs('principal');
    const inquiry = await createInquiryViaUI(page);

    // Delete uses a native `confirm()` dialog — accept it before click.
    // page.on() must be wired BEFORE the click so the listener catches
    // the synchronous dialog event.
    page.once('dialog', (dialog) => dialog.accept());

    // See AC4.7 comment — filter by visible text instead of getByRole
    // name, because <tr> elements have no accessible name by default.
    const row = page.locator('tr').filter({ hasText: inquiry.name });
    await expect(row).toBeVisible();
    await row.getByTitle('Delete').click();

    // After delete, the row vanishes from the listing.
    await expect(page.getByText(inquiry.name)).toBeHidden({ timeout: 10_000 });
  });
});

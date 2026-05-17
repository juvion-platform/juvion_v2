/**
 * inquiry-factory — UI-driven helpers for creating Admissions test data.
 *
 * Each Playwright test gets its own browser context, so we cannot rely
 * on Mongo state surviving between tests. The cheapest way to get
 * deterministic data per test is to CREATE through the same UI flow
 * the test is meant to exercise — that way one helper covers both
 * "happy path coverage" and "fixture setup for downstream tests."
 *
 * The unique-name trick (`Date.now()` + random suffix) prevents two
 * parallel workers from colliding on the inquiry listing.
 */

import { Page, expect } from '@playwright/test';

export interface CreatedInquiry {
  name: string;
  phone: string;
}

/**
 * Generate a unique, throwaway inquiry name. Tests use the returned
 * `name` to assert the row appears in subsequent lookups.
 */
export function uniqueInquiryName(prefix = 'E2E'): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix} ${Date.now()} ${suffix}`;
}

/**
 * Generate a 10-digit phone — required field on InquiryFormPage.
 */
export function uniquePhone(): string {
  // 9XXXXXXXXX — plausible Indian mobile, unique per call. The 9-prefix
  // keeps server-side validation happy (10 digits, mobile-shaped).
  const tail = Math.floor(100_000_000 + Math.random() * 900_000_000);
  return `9${tail}`;
}

/**
 * Create an inquiry through the admin-portal UI. Assumes the page is
 * already logged in as a college-scoped user (principal or similar).
 * Lands the caller back on `/admissions/inquiries` with the inquiry
 * row visible.
 *
 * Returns the name + phone the inquiry was created with so the
 * caller can assert on its presence.
 */
export async function createInquiryViaUI(page: Page): Promise<CreatedInquiry> {
  const inquiry: CreatedInquiry = {
    name: uniqueInquiryName(),
    phone: uniquePhone(),
  };

  await page.goto('/admissions/inquiries');
  // The lazy-loaded page settles when the "New Inquiry" button is up.
  await expect(page.getByRole('button', { name: /new inquiry/i })).toBeVisible();
  await page.getByRole('button', { name: /new inquiry/i }).click();
  await expect(page).toHaveURL(/\/admissions\/inquiries\/new$/);

  // Fields with htmlFor wiring (added in Phase B Wave 1 to enable
  // getByLabel without changing test selectors when copy churns).
  await page.getByLabel('Name', { exact: false }).fill(inquiry.name);
  await page.getByLabel('Phone', { exact: false }).fill(inquiry.phone);
  // `Source` is required + already defaults to "website" (first option),
  // so no fill needed. The submit button text says "Create Inquiry".

  // The form renders two submit buttons (header + footer of the page,
  // both bound to #inquiry-form so either works). Use .first() to
  // avoid strict-mode ambiguity.
  await page.getByRole('button', { name: /^create inquiry$/i }).first().click();
  // Successful create navigates back to the list.
  await expect(page).toHaveURL(/\/admissions\/inquiries$/, { timeout: 10_000 });
  // The new row's name appears in the table — final guarantee.
  await expect(page.getByText(inquiry.name)).toBeVisible({ timeout: 5_000 });

  return inquiry;
}

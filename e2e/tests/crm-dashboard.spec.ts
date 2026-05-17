/**
 * CRM dashboard render E2E — Strategic spec: Playwright Phase B Wave 1.
 *
 * Two tests:
 *   AC4.9   /admissions/crm renders all 4 cards
 *   AC4.10  /admissions/assignment-rules renders header + New Rule button
 *
 * Phase A scope was "the cards exist" rather than "the cards show
 * specific numbers" — empty-state assertions are stable across runs
 * (no dependence on seed state), and the 4-aggregation backend
 * endpoints (`/admissions/crm/{pipeline,funnel,officers,sources}`)
 * are exercised by the dashboard component on mount.
 *
 * If any of the 4 endpoints regresses on shape, React Query throws +
 * the corresponding card never renders → the test catches it.
 */

import { test, expect } from './fixtures/auth-fixture';

test.describe('Admissions — CRM dashboard renders', () => {
  test('AC4.9 principal: /admissions/crm renders all 4 cards', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/admissions/crm');

    // Page heading proves the route resolved + the page chunk loaded.
    await expect(page.getByRole('heading', { name: /^crm dashboard$/i })).toBeVisible();

    // The four cards each render an <h3> with a stable heading.
    // Visible-by-default = the React Query call succeeded for that
    // aggregation; a 500 or a shape mismatch would hide the card.
    await expect(page.getByRole('heading', { name: /^pipeline by status$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /^conversion funnel$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /^officer performance$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /^source attribution$/i })).toBeVisible({ timeout: 10_000 });
  });

  test('AC4.10 principal: /admissions/assignment-rules renders', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/admissions/assignment-rules');

    await expect(page.getByRole('heading', { name: /^lead assignment rules$/i })).toBeVisible();
    // "New Rule" button is the primary CTA. Always present.
    await expect(page.getByRole('button', { name: /^new rule$/i })).toBeVisible();
  });
});

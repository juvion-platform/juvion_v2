/**
 * Fee dashboard — render-only safety net for the 009 component extraction.
 *
 *   009-F1  /finance/dashboard renders the header, command bar, stat pills,
 *           agent-findings section and risk list with no page errors
 *   009-F2  "Draft reminders" opens the (shared) drafts panel with a mocked draft
 *
 * Agent endpoints are mocked so the suite never calls the real LLM; the
 * non-AI analytics endpoints hit the live backend as the other specs do.
 */

import { test, expect } from './fixtures/auth-fixture';

test('009-F1 principal: fee dashboard renders on the extracted components', async ({ page, loginAs }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.route('**/api/juvi/finance-agent/forecast-narrative', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projection: { lower: 1_200_000, mean: 1_500_000, upper: 1_800_000, confidence: 0.8, daysInWindow: 30, monthEnd: '2026-09-30' },
        narrative: 'Mocked driver text.',
        generatedAt: new Date().toISOString(),
      }),
    }),
  );
  await page.route('**/api/juvi/finance-agent/situations', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        situations: [{
          id: 's1', fingerprint: 'fp1', kind: 'overdue-cluster', severity: 'high',
          title: 'Mocked situation', narrative: 'Three students slipped past 30 days.',
          studentIds: [], actions: [{ type: 'draft_reminder', label: 'Draft reminder' }],
        }],
      }),
    }),
  );
  await page.route('**/api/juvi/finance-agent/risk-scores', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ scores: [] }) }),
  );

  await loginAs('principal');
  await page.goto('/finance/dashboard');

  await expect(page.getByRole('heading', { name: /collection overview/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel('Finance AI assistant')).toBeVisible();
  await expect(page.getByText('YTD total')).toBeVisible();
  await expect(page.getByText(/AI forecast:/)).toBeVisible();
  await expect(page.getByText('Mocked driver text.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /agent findings/i })).toBeVisible();
  await expect(page.getByText('Mocked situation')).toBeVisible();
  await expect(page.getByText(/students requiring action/i)).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('009-F2 principal: Draft reminders opens the shared drafts panel', async ({ page, loginAs }) => {
  await page.route('**/api/juvi/finance-agent/forecast-narrative', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/juvi/finance-agent/situations', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ situations: [] }) }));
  await page.route('**/api/juvi/finance-agent/risk-scores', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ scores: [] }) }));
  await page.route('**/api/juvi/finance-agent/reminder-drafts', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ studentId: 'x1', language: 'en', tone: 'soft', subject: 'Fee reminder (mock)', body: 'Please pay.', predictedReadRate: 0.8, templateVersion: 'agent-draft-v1' }]),
    }),
  );
  await loginAs('principal');
  await page.goto('/finance/dashboard');
  await expect(page.getByRole('heading', { name: /collection overview/i })).toBeVisible({ timeout: 10_000 });

  const open = page.getByRole('button', { name: /^draft reminders$/i });
  // Disabled when the live defaulter list is empty — then there is nothing to drive the panel with.
  if (await open.isDisabled()) { test.skip(true, 'no defaulters in the seeded data'); return; }
  await open.click();

  const panel = page.getByRole('dialog', { name: /draft reminders/i });
  await expect(panel).toBeVisible();
  await expect(panel.locator('input[type="text"]').first()).toHaveValue('Fee reminder (mock)');
  await expect(panel.getByRole('button', { name: /approve recommended \(1\)/i })).toBeVisible();
});

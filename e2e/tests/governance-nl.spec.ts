/**
 * Governance NL panel E2E — 004-rbac-nl-queries.
 *
 *   AC4.20-G1  /governance/reports renders the NL panel (textarea + Ask)
 *   AC4.20-G2  Typing + clicking Ask shows the loading state
 *   AC4.20-G3  403 from authorize() renders the policy-denied banner
 *   AC4.20-G4  refused + reasonDimension='department' renders department copy
 *   AC4.20-G5  scope-unresolved + dimension='department' renders the
 *              data-quality copy ("We couldn't determine your department")
 *
 * Tests 3-5 use `page.route` to intercept the `/nl-query` POST and return
 * a synthetic response. We don't want e2e tests calling the real LLM.
 * The matched/refused contract is already covered exhaustively by the
 * unit + integration tests in `backend/src/modules/governance/`.
 *
 * Render-only assertions; no `page.waitForTimeout`. Per the auth.spec.ts
 * conventions: accessible queries, real form-based login.
 */

import { test, expect } from './fixtures/auth-fixture';

const NL_QUERY_PATH = '**/api/governance/reports/nl-query';

test.describe('Governance — NL query panel', () => {
  test('AC4.20-G1 principal: NL panel renders on /governance/reports', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/governance/reports');

    // Hub heading present (matches the existing reports.spec.ts pattern).
    await expect(page.getByRole('heading', { name: /^reports$/i })).toBeVisible({ timeout: 10_000 });

    // NL panel "Ask a question" header is visible.
    await expect(page.getByText(/ask a question/i).first()).toBeVisible();

    // Textarea + Ask button are present and interactive.
    await expect(page.getByPlaceholder(/ask a question/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^ask$/i })).toBeVisible();
  });

  test('AC4.20-G2 typing into the textarea + clicking Ask shows the loading state', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/governance/reports');

    // Intercept the request and keep it pending so the loading state is observable.
    let resolveRoute: () => void = () => {};
    const routePromise = new Promise<void>((res) => { resolveRoute = res; });
    await page.route(NL_QUERY_PATH, async (route) => {
      await routePromise; // hold the request open
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'refused',
          reason: 'timeout',
          supportedReports: [],
          llmModel: 'mock',
          costInr: 0,
        }),
      });
    });

    await page.getByPlaceholder(/ask a question/i).fill('how did the april funnel compare to march');
    const askBtn = page.getByRole('button', { name: /^ask$/i });
    await askBtn.click();

    // While the request is in flight, the button label flips to "Asking..." and disables.
    await expect(page.getByRole('button', { name: /asking/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /asking/i })).toBeDisabled();

    // Release the held request so the test cleans up.
    resolveRoute();
    // After resolution, button returns to its idle state.
    await expect(askBtn).toBeVisible();
  });

  test('AC4.20-G3 403 from authorize() renders the policy-denied banner', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/governance/reports');

    // Force a 403 — simulates an unauthorized persona reaching the panel
    // (e.g., student/parent post-RBAC_NL_ENFORCE=true). Principal would
    // normally succeed; the mock makes the test deterministic.
    await page.route(NL_QUERY_PATH, (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Access denied' }),
      }),
    );

    await page.getByPlaceholder(/ask a question/i).fill('whatever');
    await page.getByRole('button', { name: /^ask$/i }).click();

    // 004 §10.12 — distinct policy-denied banner copy.
    await expect(
      page.getByText(/your role can.t run governance reports/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('AC4.20-G4 refused with reasonDimension=department renders the dept copy + chip list', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/governance/reports');

    await page.route(NL_QUERY_PATH, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'refused',
          reason: 'report-not-scopable-for-role',
          reasonDimension: 'department',
          supportedReports: ['student-roster-snapshot'],
          llmModel: 'claude-mock',
          costInr: 0.05,
        }),
      }),
    );

    await page.getByPlaceholder(/ask a question/i).fill('admissions funnel');
    await page.getByRole('button', { name: /^ask$/i }).click();

    // 004 §10.7 — sub-categorized refusal copy.
    await expect(
      page.getByText(/department-scoped data of this kind/i),
    ).toBeVisible({ timeout: 5_000 });
    // Persona-eligible chip is the supportedReports list from the BE.
    await expect(page.getByText('student-roster-snapshot')).toBeVisible();
  });

  test('AC4.20-G5 scope-unresolved + department renders the data-quality copy', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/governance/reports');

    await page.route(NL_QUERY_PATH, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'refused',
          reason: 'scope-unresolved',
          reasonDimension: 'department',
          supportedReports: [],
          llmModel: 'claude-mock',
          costInr: 0.03,
        }),
      }),
    );

    await page.getByPlaceholder(/ask a question/i).fill('roster');
    await page.getByRole('button', { name: /^ask$/i }).click();

    // 004 §10.10 — data-quality refusal copy.
    await expect(
      page.getByText(/couldn.t determine your department/i),
    ).toBeVisible({ timeout: 5_000 });
  });
});

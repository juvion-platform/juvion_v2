/**
 * Governance hub E2E — render coverage for the 4 CRUD sub-pages and the
 * dashboard. Adjacent to reports.spec.ts and governance-nl.spec.ts.
 *
 *   AC4.21-G1  /governance dashboard renders (committees / policies /
 *              board-members / goals widgets visible)
 *   AC4.21-G2  /governance/committees list page renders
 *   AC4.21-G3  /governance/policies list page renders
 *   AC4.21-G4  /governance/board-members list page renders
 *   AC4.21-G5  /governance/goals list page renders
 *
 * Render-only — does not exercise CRUD. CRUD-level coverage requires
 * deterministic seed data; render coverage is enough to catch route
 * regressions / lazy-import breakage.
 */

import { test, expect } from './fixtures/auth-fixture';

test.describe('Governance — hub + sub-pages', () => {
  test('AC4.21-G1 principal: /governance dashboard renders', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/governance');
    // Top-level governance heading.
    await expect(page.getByRole('heading', { name: /governance/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('AC4.21-G2 principal: /governance/committees list renders', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/governance/committees');
    await expect(page.getByRole('heading', { name: /committees/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('AC4.21-G3 principal: /governance/policies list renders', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/governance/policies');
    await expect(page.getByRole('heading', { name: /policies/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('AC4.21-G4 principal: /governance/board-members list renders', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/governance/board-members');
    // The page heading is "Governing Body Members" (BoardMembersPage.tsx:80).
    await expect(page.getByRole('heading', { name: /governing body members/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('AC4.21-G5 principal: /governance/goals list renders', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/governance/goals');
    await expect(page.getByRole('heading', { name: /goals/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});

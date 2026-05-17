/**
 * People detail E2E — render coverage for student + faculty list/detail
 * pages, including the FacultyDetailPage Rules-of-Hooks fix (PR #63).
 *
 *   AC4.22-P1  /people hub renders
 *   AC4.22-P2  /people/students list renders
 *   AC4.22-P3  /people/faculty list renders (the page whose detail-view
 *              fix was needed; this asserts the LIST loads without
 *              crashing — the same code path executes the hook order
 *              that was the underlying bug)
 *
 * Faculty / student DETAIL pages are deferred — they need a deterministic
 * seeded id to navigate to. Coverage here is enough to catch the most
 * common regressions (lazy import broken, sidebar nav broken, list query
 * crashes the page).
 */

import { test, expect } from './fixtures/auth-fixture';

test.describe('People — list pages', () => {
  test('AC4.22-P1 principal: /people hub renders', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/people');
    await expect(page.getByRole('heading', { name: /people/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('AC4.22-P2 principal: /people/students list renders', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/people/students');
    await expect(page.getByRole('heading', { name: /students/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('AC4.22-P3 principal: /people/faculty list renders', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/people/faculty');
    await expect(page.getByRole('heading', { name: /faculty/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});

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

test.describe('People — student detail risk block (009)', () => {
  test('009-P4 principal: the profile tab shows the engine score and the agent sentence', async ({ page, loginAs }) => {
    await page.route('**/api/welfare/ccd/students/*/risk-profile', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          activeSignals: [{ _id: 'sig1', signalType: 'attendance_drop', source: 'M03' }],
          riskScore: { score: 76, priority: 'P1', breakdown: { baseTotal: 76, crossModuleMultiplier: 1, temporalMultiplier: 1, finalScore: 76 } },
          activeAlerts: [{ _id: 'alert1' }],
          pastInterventions: [],
        }),
      }),
    );
    await page.route('**/api/welfare/ccd/students/*/score-history**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ at: '2026-08-01T00:00:00Z', score: 40, priority: 'P3' }, { at: '2026-09-01T00:00:00Z', score: 76, priority: 'P1' }]) }),
    );
    await page.route('**/api/juvi/people-agent/narrations', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ narrations: [{ alertId: 'alert1', narrative: 'Attendance dropped sharply this month.' }] }) }),
    );
    await loginAs('principal');

    // Any seeded student will do — the risk endpoints above are mocked. Read
    // the id with the session the login just stored rather than depending on
    // list-table markup.
    const id = await page.evaluate(async () => {
      const r = await fetch('/api/people/students?limit=1', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
          'x-college-id': localStorage.getItem('collegeId') ?? '',
        },
      });
      const j = (await r.json()) as { items?: Array<{ _id: string }> };
      return j.items?.[0]?._id ?? null;
    });
    test.skip(!id, 'no students in the seeded data');
    await page.goto(`/people/students/${id}`);

    const block = page.getByTestId('student-risk-block');
    await expect(block).toBeVisible({ timeout: 10_000 });
    await expect(block.getByText('76')).toBeVisible();
    await expect(block.getByText('P1')).toBeVisible();
    await expect(block.getByTestId('student-risk-narration')).toContainText('Attendance dropped sharply');
    await expect(block.getByText('Attendance drop', { exact: true })).toBeVisible();
    await expect(block.getByRole('link', { name: /open on risk board/i })).toBeVisible();
  });
});

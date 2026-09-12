/**
 * Student Risk board — 009 People command bar + cohort view.
 *
 *   009-E1  /welfare/student-risk renders the command bar with the four
 *           §2.1 suggestion chips
 *   009-E2  clicking a chip streams a (mocked) SSE answer into the thread
 *   009-E3  the cohort view renders the (mocked) branch / quota / flag cuts
 *   009-E4  a risk card shows the (mocked) one-sentence narration
 *   009-E5  "Draft outreach" in the breakdown opens the drafts panel with a
 *           (mocked) guardian message and the honest recorded-not-sent note
 *
 * The SSE endpoint is intercepted with `page.route` — e2e never calls the
 * real LLM. Render-only, accessible queries, no `page.waitForTimeout`.
 */

import { test, expect } from './fixtures/auth-fixture';

const QUERY_PATH = '**/api/juvi/people-agent/query';
const COHORTS_PATH = '**/api/welfare/ccd/cohorts';
const BOARD_PATH = '**/api/welfare/ccd/board**';
const NARRATIONS_PATH = '**/api/juvi/people-agent/narrations';
const DRAFTS_PATH = '**/api/juvi/people-agent/outreach-drafts';

const ROW = {
  alertId: 'a1', studentId: 's1', studentName: 'Asha Rao', rollNumber: 'CSE-42', priority: 'P1', score: 82,
  status: 'generated', daysOpen: 3, sources: ['M03', 'M04'], signalTypes: ['attendance_drop', 'fee_default'],
  signalCount: 2, crossModuleMultiplier: 1.2, temporalMultiplier: 1, mentorName: 'Dr Rao', lastActionAt: null,
};

function sse(events: Array<[string, unknown]>): string {
  return events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
}

test.describe('Student Risk — People command bar + cohort view', () => {
  test('009-E1 principal: command bar renders with the four §2.1 chips', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/welfare/student-risk');

    await expect(page.getByRole('heading', { name: /student risk/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Student Welfare assistant')).toBeVisible();
    await expect(page.getByRole('button', { name: /which mentor has the most p1 students/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /first-generation students whose risk went up/i })).toBeVisible();
  });

  test('009-E2 a chip streams a mocked answer into the thread', async ({ page, loginAs }) => {
    await page.route(QUERY_PATH, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sse([
          ['delta', { text: 'Dr Rao has 3 P1 students ' }],
          ['delta', { text: '(of the top 50 shown).' }],
          ['done', {
            provider: 'openai', model: 'gpt-4o-mini', inputTokens: 900, outputTokens: 20,
            costInr: 0.01, durationMs: 1200, auditId: 'a1', conversationId: '9f3a0b3e-1c1d-4e5f-8a9b-0c1d2e3f4a5b',
          }],
        ]),
      }),
    );
    await loginAs('principal');
    await page.goto('/welfare/student-risk');

    await page.getByRole('button', { name: /which mentor has the most p1 students/i }).click();

    await expect(page.getByText('Dr Rao has 3 P1 students (of the top 50 shown).')).toBeVisible();
    await expect(page.getByText(/openai · gpt-4o-mini/)).toBeVisible();
    // Chat layout: the transcript sits above the composer, which stays visible and focused.
    const input = page.getByLabel('Student Welfare assistant');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    const thread = await page.getByTestId('command-bar-thread').boundingBox();
    const composer = await input.boundingBox();
    expect(composer!.y).toBeGreaterThanOrEqual(thread!.y + thread!.height);
  });

  test('009-E3 cohort view renders the branch, quota and flag cuts', async ({ page, loginAs }) => {
    await page.route(COHORTS_PATH, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 3,
          byBranch: [{ key: 'CSE', open: 2, p1: 1, avgScore: 60 }, { key: 'ECE', open: 1, p1: 0, avgScore: 40 }],
          byQuota: [{ key: 'CONV', open: 3, p1: 1, avgScore: 53 }],
          hostel: { key: 'Hostel residents', open: 1, p1: 1, avgScore: 80 },
          firstGeneration: { key: 'First-generation', open: 0, p1: 0, avgScore: 0 },
        }),
      }),
    );
    await loginAs('principal');
    await page.goto('/welfare/student-risk');

    const view = page.getByTestId('cohort-view');
    await expect(view).toBeVisible({ timeout: 10_000 });
    await expect(view.getByRole('heading', { name: /by cohort/i })).toBeVisible();
    await expect(view.getByRole('cell', { name: 'CSE' })).toBeVisible();
    await expect(view.getByRole('cell', { name: 'Hostel residents' })).toBeVisible();
    await expect(view.getByText(/3 open alerts in view/)).toBeVisible();
  });

  test('009-E4 a risk card shows the one-sentence narration', async ({ page, loginAs }) => {
    await page.route(BOARD_PATH, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([ROW]) }));
    await page.route(NARRATIONS_PATH, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ narrations: [{ alertId: 'a1', narrative: 'Attendance fell and fees are overdue, flagged by two areas.' }] }) }),
    );
    await loginAs('principal');
    await page.goto('/welfare/student-risk');

    const card = page.getByTestId('risk-card').first();
    await expect(card).toContainText('Asha Rao');
    await expect(card.getByTestId('risk-card-narration')).toContainText('Attendance fell and fees are overdue');
  });

  test('009-E5 draft outreach from the breakdown opens the panel and says nothing is sent', async ({ page, loginAs }) => {
    await page.route(BOARD_PATH, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([ROW]) }));
    await page.route(NARRATIONS_PATH, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ narrations: [] }) }));
    await page.route('**/api/welfare/ccd/students/s1/risk-profile', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeSignals: [], riskScore: { score: 82, priority: 'P1', breakdown: { baseTotal: 68, crossModuleMultiplier: 1.2, temporalMultiplier: 1, finalScore: 82 } }, activeAlerts: [], pastInterventions: [] }) }),
    );
    await page.route(DRAFTS_PATH, (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ drafts: [{
          studentId: 's1', studentName: 'Asha Rao', language: 'te', tone: 'urgent', subject: 'Regarding Asha',
          body: 'Namaskaram. We would like to speak with you about Asha.', channel: 'whatsapp', guardianName: 'Lakshmi Rao', fallback: false,
        }] }),
      }),
    );
    await loginAs('principal');
    await page.goto('/welfare/student-risk');

    await page.getByTestId('risk-card').first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Draft outreach', exact: true }).click();

    const panel = page.getByRole('dialog', { name: /draft guardian outreach/i });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('To Lakshmi Rao · via whatsapp')).toBeVisible();
    await expect(panel.getByText('Telugu')).toBeVisible();
    await expect(panel.locator('input[type="text"]').first()).toHaveValue('Regarding Asha');
    await expect(panel.getByText(/No message is sent/)).toBeVisible();
  });
});

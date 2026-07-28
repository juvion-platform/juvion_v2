/**
 * Student bulk import E2E — the drawer on /people/students.
 *
 * Three things the first version of this test got wrong, all flagged by the
 * final whole-branch review:
 *
 *   1. It logged in as `principal`, whose DB role is `admin` and therefore
 *      holds the `*:*` wildcard — a persona that can never distinguish a
 *      working `people:create` gate from an absent one. It now logs in as
 *      the Registrar (staff / ST-REG), who holds `people: *` and NOT
 *      `platform: *`. That is the persona this whole facade exists for: they
 *      own student records but would get a 403 from /platform/bulk-imports.
 *   2. The CSV used `BTCSE`, which the e2e seed does not create, so the row
 *      previewed as a known error row. The programme is now created through
 *      the API before the run, so the row resolves for real.
 *   3. The only assertion was that the summary element was visible — it
 *      would have passed against a build where every row failed. It now
 *      asserts the summary's content: one new student, no errors.
 */
import { request as apiRequest } from '@playwright/test';
import { test, expect } from './fixtures/auth-fixture';
import { TEST_USERS } from './utils/test-users';

const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:3003';
/** Dedicated codes so this test never depends on, or disturbs, seed data. */
const REGULATION_CODE = 'E2EIMPREG';
const PROGRAMME_CODE = 'E2EIMPPROG';
const PROGRAMME_NAME = 'E2E Import Programme';

/**
 * Make sure the programme the CSV names actually exists.
 *
 * Created through the API as the wildcard-holding admin (the Registrar has
 * only `academics: read`), which also keeps this independent of whatever the
 * seed happens to contain. Idempotent: a second run finds the existing rows.
 */
async function ensureProgramme(): Promise<void> {
  const api = await apiRequest.newContext({ baseURL: BACKEND_URL });
  try {
    const loginRes = await api.post('/api/auth/login', {
      data: {
        email: TEST_USERS.principal.email,
        password: TEST_USERS.principal.password,
      },
    });
    expect(loginRes.ok(), 'admin login for e2e fixture setup').toBeTruthy();
    const { token } = (await loginRes.json()) as { token: string };
    const headers = { Authorization: `Bearer ${token}` };

    const existing = await api.get('/api/academics/programmes?limit=200', { headers });
    expect(existing.ok(), 'list programmes').toBeTruthy();
    const programmes = ((await existing.json()) as { items?: Array<{ code: string }> }).items ?? [];
    if (programmes.some((p) => p.code === PROGRAMME_CODE)) return;

    const regsRes = await api.get('/api/academics/regulations?limit=200', { headers });
    const regs = ((await regsRes.json()) as { items?: Array<{ _id: string; code: string }> }).items ?? [];
    let regulationId = regs.find((r) => r.code === REGULATION_CODE)?._id;
    if (!regulationId) {
      const created = await api.post('/api/academics/regulations', {
        headers,
        data: {
          code: REGULATION_CODE,
          name: 'E2E Import Regulation',
          effectiveFromYear: 2020,
          totalCredits: 160,
          maxYears: 4,
        },
      });
      expect(created.ok(), `create regulation: ${await created.text()}`).toBeTruthy();
      regulationId = ((await created.json()) as { _id: string })._id;
    }

    const createdProgramme = await api.post('/api/academics/programmes', {
      headers,
      data: {
        code: PROGRAMME_CODE,
        name: PROGRAMME_NAME,
        level: 'UG',
        durationYears: 4,
        regulationId,
      },
    });
    expect(
      createdProgramme.ok(),
      `create programme: ${await createdProgramme.text()}`,
    ).toBeTruthy();
  } finally {
    await api.dispose();
  }
}

test.describe('People — Student bulk import', () => {
  test.beforeAll(async () => { await ensureProgramme(); });

  test('a Registrar can open the drawer, download the template, and preview a real row', async ({ page, loginAs }) => {
    await loginAs('registrar');
    await page.goto('/people/students');

    // The Import control is hidden unless the user holds people:create, so
    // its presence for this persona is itself part of the assertion.
    await page.getByRole('button', { name: /^import$/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Template downloads with asterisk-marked mandatory columns.
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /download template/i }).click(),
    ]).then(([d]) => d);
    expect(download.suggestedFilename()).toBe('student-import-template.csv');

    // A unique phone per run keeps repeat runs on the create path rather
    // than matching a student an earlier run left behind.
    const phone = `98${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const csv = 'name*,phone*,programmeCode*,admissionYear*\n'
      + `E2E Import Student,${phone},${PROGRAMME_CODE},2025`;
    await page.setInputFiles('#student-import-file', {
      name: 'students.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
    });
    await page.getByRole('button', { name: /^preview$/i }).click();

    // Content, not mere visibility: exactly one row, resolving to a create
    // against the real programme, with no errors.
    const summary = page.getByTestId('import-summary');
    await expect(summary).toContainText('1 new', { timeout: 10_000 });
    await expect(summary).toContainText('0 updates');
    await expect(summary).not.toContainText('with errors');
    await expect(summary).not.toContainText('blocked');

    // And the preview row echoes what the code resolved to, which is what
    // proves the programme was found rather than skipped.
    await expect(page.getByRole('dialog')).toContainText(`Programme: ${PROGRAMME_NAME}`);
    await expect(page.getByRole('button', { name: /^import 1$/i })).toBeEnabled();
  });
});

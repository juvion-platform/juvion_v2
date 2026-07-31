/**
 * Fee pinning through the whole loop: import → drawer counts → Pin Coverage
 * → bulk-pin → pinned (006-import-fee-pin T15).
 *
 * The unit and integration suites already prove each half in isolation. What
 * only an E2E can prove is that the halves agree: that the count the drawer
 * shows for "no matching fee structure" is the same student the coverage
 * report lists, and that pinning them there actually clears it.
 *
 * Three students, one per outcome, in a single import so the drawer's own
 * arithmetic is under test rather than three separate happy paths:
 *   - one whose axes match a published structure  → pins at import
 *   - one on a programme with no structure        → imports unpinned
 *   - one re-imported after the first run         → already pinned, untouched
 *
 * Fixtures are created through the API under dedicated codes so the run never
 * depends on, or disturbs, seed data.
 */
import { request as apiRequest, type APIRequestContext } from '@playwright/test';
import { test, expect } from './fixtures/auth-fixture';
import { TEST_USERS } from './utils/test-users';

const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:3003';

const REGULATION_CODE = 'E2EPINREG';
/** Has a published fee structure. */
const PINNED_PROGRAMME = 'E2EPINPROG';
/** Deliberately has none, so its student imports unpinned. */
const UNPINNED_PROGRAMME = 'E2ENOFSIPROG';
const FEE_TOTAL = 111000;

interface Ctx {
  api: APIRequestContext;
  headers: Record<string, string>;
}

async function adminContext(): Promise<Ctx> {
  const api = await apiRequest.newContext({ baseURL: BACKEND_URL });
  const login = await api.post('/api/auth/login', {
    data: {
      email: TEST_USERS.principal.email,
      password: TEST_USERS.principal.password,
    },
  });
  expect(login.ok(), 'admin login for fee-pin e2e fixture setup').toBeTruthy();
  const { token } = (await login.json()) as { token: string };
  return { api, headers: { Authorization: `Bearer ${token}` } };
}

async function ensureRegulation({ api, headers }: Ctx): Promise<string> {
  const res = await api.get('/api/academics/regulations?limit=200', { headers });
  const items = ((await res.json()) as { items?: Array<{ _id: string; code: string }> }).items ?? [];
  const found = items.find((r) => r.code === REGULATION_CODE);
  if (found) return found._id;

  const created = await api.post('/api/academics/regulations', {
    headers,
    data: {
      code: REGULATION_CODE,
      name: 'E2E Pin Regulation',
      effectiveFromYear: 2020,
      totalCredits: 160,
      maxYears: 4,
    },
  });
  expect(created.ok(), `create regulation: ${await created.text()}`).toBeTruthy();
  return ((await created.json()) as { _id: string })._id;
}

async function ensureProgramme(
  { api, headers }: Ctx,
  code: string,
  regulationId: string,
): Promise<string> {
  const res = await api.get('/api/academics/programmes?limit=200', { headers });
  const items = ((await res.json()) as { items?: Array<{ _id: string; code: string }> }).items ?? [];
  const found = items.find((p) => p.code === code);
  if (found) return found._id;

  const created = await api.post('/api/academics/programmes', {
    headers,
    data: { code, name: `Programme ${code}`, level: 'UG', durationYears: 4, regulationId },
  });
  expect(created.ok(), `create programme ${code}: ${await created.text()}`).toBeTruthy();
  return ((await created.json()) as { _id: string })._id;
}

/** The academic year the import will pin against — whichever is current. */
async function currentAcademicYearId({ api, headers }: Ctx): Promise<string> {
  const res = await api.get('/api/academics/academic-years?limit=200', { headers });
  expect(res.ok(), 'list academic years').toBeTruthy();
  const items = ((await res.json()) as {
    items?: Array<{ _id: string; isCurrent?: boolean }>;
  }).items ?? [];
  const current = items.find((a) => a.isCurrent);
  expect(current, 'the e2e seed must set one current academic year').toBeTruthy();
  return current!._id;
}

async function ensureFeeStructure(
  { api, headers }: Ctx,
  programmeId: string,
  academicYearId: string,
): Promise<void> {
  const res = await api.get(
    `/api/finance/fee-structure-instances?programmeId=${programmeId}&limit=50`,
    { headers },
  );
  if (res.ok()) {
    const items = ((await res.json()) as { items?: Array<{ status: string }> }).items ?? [];
    if (items.some((i) => i.status === 'active')) return;
  }
  // The create endpoint only mints a DRAFT — `status` is owned by the
  // approval lifecycle, not the request body (Zod strips it). Walk it to
  // active so the matcher will actually pin against it.
  const created = await api.post('/api/finance/fee-structure-instances', {
    headers,
    data: { programmeId, academicYearId, totalAmount: FEE_TOTAL },
  });
  expect(created.ok(), `create fee structure: ${await created.text()}`).toBeTruthy();
  const fsiId = ((await created.json()) as { _id: string })._id;
  for (const step of ['submit', 'approve', 'activate'] as const) {
    const r = await api.post(`/api/finance/fee-structure-instances/${fsiId}/${step}`, { headers });
    expect(r.ok(), `${step} fee structure: ${await r.text()}`).toBeTruthy();
  }
}

const HEADER = 'name*,phone*,programmeCode*,admissionYear*,rollNumber';

async function importCsv(page: import('@playwright/test').Page, csv: string) {
  await page.getByRole('button', { name: /^import$/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.setInputFiles('#student-import-file', {
    name: 'students.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: /^preview$/i }).click();
}

test.describe('Finance — fee pinning from import through Pin Coverage', () => {
  // Unique per run so repeats stay on the create path instead of matching a
  // student an earlier run left behind.
  const stamp = Date.now().toString().slice(-7);
  const pinnedRoll = `E2EP${stamp}A`;
  const unpinnedRoll = `E2EP${stamp}B`;
  const phone = (n: number) => `98${String(stamp).padStart(7, '0')}${n}`;

  test.beforeAll(async () => {
    const ctx = await adminContext();
    try {
      const regulationId = await ensureRegulation(ctx);
      const pinnedProgrammeId = await ensureProgramme(ctx, PINNED_PROGRAMME, regulationId);
      await ensureProgramme(ctx, UNPINNED_PROGRAMME, regulationId);
      const academicYearId = await currentAcademicYearId(ctx);
      await ensureFeeStructure(ctx, pinnedProgrammeId, academicYearId);
    } finally {
      await ctx.api.dispose();
    }
  });

  test('imports pin what they can, report what they cannot, and Pin Coverage clears the rest', async ({ page, loginAs }) => {
    // The Registrar owns student records but holds no platform access — the
    // persona the import facade exists for.
    await loginAs('registrar');
    await page.goto('/people/students');

    // ── First import: one row that pins, one that cannot ────────────────
    await importCsv(page, [
      HEADER,
      `E2E Pinned ${stamp},${phone(1)},${PINNED_PROGRAMME},2025,${pinnedRoll}`,
      `E2E Unpinned ${stamp},${phone(2)},${UNPINNED_PROGRAMME},2025,${unpinnedRoll}`,
    ].join('\n'));

    const summary = page.getByTestId('import-summary');
    await expect(summary).toContainText('2 new');

    // The pin strip is the drawer's own arithmetic: one will pin, one will not.
    const pinStrip = page.getByTestId('pin-summary');
    await expect(pinStrip).toContainText('1 will pin');
    await expect(pinStrip).toContainText('1 no matching fee structure');

    await page.getByRole('button', { name: /^import 2$/i }).click();
    await page.getByRole('button', { name: /^import$/i }).click();

    // A student landed unpinned, so the drawer stays open and names the row
    // rather than closing on a green toast.
    await expect(page.getByTestId('unpinned-rows')).toBeVisible();
    await expect(page.getByTestId('unpinned-rows')).toContainText(/no matching fee structure/i);

    // ── Re-import the same file: nothing should churn ────────────────────
    await page.getByRole('button', { name: /import another file/i }).click();
    await page.setInputFiles('#student-import-file', {
      name: 'students.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from([
        HEADER,
        `E2E Pinned ${stamp},${phone(1)},${PINNED_PROGRAMME},2025,${pinnedRoll}`,
      ].join('\n')),
    });
    await page.getByRole('button', { name: /^preview$/i }).click();
    await expect(page.getByTestId('import-summary')).toContainText('1 updates');
    await expect(page.getByTestId('pin-summary')).toContainText('1 already pinned');
  });

  test('Pin Coverage lists the unpinned student and pinning clears it', async ({ page, loginAs }) => {
    // Finance work needs the wildcard persona; the Registrar holds no
    // finance permission, which is exactly why bulk-pin is gated separately.
    await loginAs('principal');
    await page.goto('/finance/fee-management/pin-coverage');

    await expect(page.getByRole('heading', { name: /pin coverage/i })).toBeVisible();
    await expect(page.getByTestId('coverage-header')).toBeVisible();

    // The student the import could not pin is here, under the reason that
    // says whose job it is to fix.
    await page.getByLabel('Filter by reason').selectOption('no-matching-structure');
    await expect(page.getByText(unpinnedRoll)).toBeVisible();

    // Publishing the missing structure moves that student from "Finance must
    // publish" to "one click away", which is the transition the whole report
    // exists to make visible.
    const ctx = await adminContext();
    try {
      const regulationId = await ensureRegulation(ctx);
      const programmeId = await ensureProgramme(ctx, UNPINNED_PROGRAMME, regulationId);
      const academicYearId = await currentAcademicYearId(ctx);
      await ensureFeeStructure(ctx, programmeId, academicYearId);
    } finally {
      await ctx.api.dispose();
    }

    await page.reload();
    await page.getByLabel('Filter by reason').selectOption('never-pinned');
    await expect(page.getByText(unpinnedRoll)).toBeVisible();

    const row = page.getByRole('row', { name: new RegExp(unpinnedRoll) });
    await row.getByRole('button', { name: /pin now/i }).click();
    await page.getByRole('button', { name: /^pin$/i }).click();

    // Cleared: the student no longer appears under any pin-missing reason.
    await page.getByLabel('Filter by reason').selectOption('never-pinned');
    await expect(page.getByText(unpinnedRoll)).toHaveCount(0);
  });
});

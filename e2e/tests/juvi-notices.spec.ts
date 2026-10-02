/**
 * Juvi notices in the ERP portal (notices spec §12, E2E).
 *
 *   1. The Registrar (staff / ST-REG: an office persona, college-wide scope)
 *      publishes through the composer to the seeded "E2E Computer Science"
 *      department, and the list shows the notice's acknowledged / seen /
 *      total once the fan-out lands.
 *   2. An HOD is offered only their own department, and the server refuses
 *      a preview for another one with a 403.
 *
 * The audience and the HOD come from seedE2ENoticeAudience in
 * backend/src/scripts/seed-e2e-users.ts, which global-setup runs. Zero
 * retries, no fixed waits: the list polls while a notice is delivering.
 */
import { request as apiRequest } from '@playwright/test';
import { test, expect } from './fixtures/auth-fixture';
import { TEST_USERS } from './utils/test-users';

const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:3003';
const NOTICES = '/api/juvi-app/admin/notices';
const OWN_DEPT = 'E2E Computer Science';
const OTHER_DEPT = 'E2E Electronics';

/** An API context logged in as `role`, for what the UI cannot express. */
async function apiAs(role: 'principal' | 'hod') {
  const api = await apiRequest.newContext({ baseURL: BACKEND_URL });
  const res = await api.post('/api/auth/login', { data: { email: TEST_USERS[role].email, password: TEST_USERS[role].password } });
  expect(res.ok(), `${role} login`).toBeTruthy();
  const { token, collegeId } = (await res.json()) as { token: string; collegeId: string };
  return { api, headers: { Authorization: `Bearer ${token}`, 'x-college-id': collegeId } };
}

test.describe('Juvi notices — ERP portal', () => {
  test('an office persona publishes through the composer and the list shows the counts', async ({ page, loginAs }) => {
    const title = `E2E notice ${Date.now()}`;
    await loginAs('registrar');
    await expect(page.getByRole('link', { name: /^notices$/i })).toBeVisible();
    await page.goto('/communication/notices');
    await expect(page.getByRole('heading', { name: /^notices$/i })).toBeVisible();

    await page.getByRole('button', { name: /new notice/i }).click();
    const drawer = page.getByRole('dialog', { name: 'New notice' });
    await expect(drawer.getByText(/Publishing as/)).toContainText('Registrar');
    await drawer.getByLabel('Title', { exact: true }).fill(title);
    await drawer.getByLabel('Notice', { exact: true }).fill('Please confirm you have read the revised timetable.');

    await drawer.getByRole('button', { name: /^departments/i }).click();
    const search = drawer.getByRole('combobox', { name: /search departments/i });
    await search.fill('E2E Computer');
    await drawer.getByRole('option', { name: OWN_DEPT }).click();
    await search.press('Escape');
    await expect(drawer.getByText(/1 person · 0 on Juvi · 1 not on Juvi yet/)).toBeVisible();

    await drawer.getByLabel('Require acknowledgement').check();
    await drawer.getByRole('button', { name: 'Review and publish' }).click();
    await expect(drawer.getByRole('heading', { name: 'Publish to 1 person?' })).toBeVisible();
    await drawer.getByRole('button', { name: 'Publish notice' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('searchbox', { name: /search notices/i }).fill(title);
    const row = page.getByRole('button', { name: `Open notice ${title}` });
    await expect(row).toBeVisible();
    // "Delivering…" becomes the counts when the fan-out lands; the list polls every 3 s meanwhile.
    await expect(row.getByText('0 / 0 / 1')).toBeVisible({ timeout: 20_000 });
    await expect(row.getByText('Published')).toBeVisible();
  });

  test('an HOD is offered only their own department, and the server refuses another', async ({ page, loginAs }) => {
    await loginAs('hod');
    await page.goto('/communication/notices');
    await page.getByRole('button', { name: /new notice/i }).click();
    const drawer = page.getByRole('dialog', { name: 'New notice' });
    await expect(drawer.getByText(/Publishing as/)).toContainText(`HOD, ${OWN_DEPT}`);
    await expect(drawer.getByRole('button', { name: 'Everyone' })).toHaveCount(0);
    await drawer.getByRole('button', { name: /^departments/i }).click();
    await expect(drawer.getByRole('listbox', { name: 'Departments' }).getByRole('option')).toHaveText([OWN_DEPT]);

    // The composer cannot even express another department, so ask the API directly, as the HOD.
    const admin = await apiAs('principal');
    const hod = await apiAs('hod');
    try {
      const targets = await admin.api.get(`${NOTICES}/targets`, { headers: admin.headers });
      expect(targets.ok(), 'admin targets').toBeTruthy();
      const other = ((await targets.json()) as { departments: { id: string; label: string }[] }).departments.find((d) => d.label === OTHER_DEPT);
      expect(other, `seeded ${OTHER_DEPT} department`).toBeDefined();
      const refused = await hod.api.post(`${NOTICES}/audience-preview`, { headers: hod.headers, data: { rules: [{ kind: 'department', ids: [other!.id] }] } });
      expect(refused.status()).toBe(403);
      expect(await refused.json()).toEqual({ error: 'You can only send notices to your own department.' });
    } finally {
      await admin.api.dispose();
      await hod.api.dispose();
    }
  });
});

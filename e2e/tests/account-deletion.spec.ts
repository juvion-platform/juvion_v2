/**
 * The public account-deletion page (Juvi / Play listing).
 *
 * In the app, not a standalone static file: it is a public React route at `/account-deletion`,
 * outside the auth-gated dashboard, so an anonymous visitor reaches it without signing in. Two
 * things are asserted, both about the *rendered* page:
 *
 *   1. it renders publicly with the deletion form — the three fields the route parses, in a form
 *      that posts to the real action;
 *   2. that submission reaches the route from the browser, same-origin. The form is a **native**
 *      HTML form (not a script-built request), so the navigation carries `Origin` in
 *      `ALLOWED_ORIGINS` and `Sec-Fetch-Site: same-origin` — the two signals the route's CSRF guard
 *      (011 Story 3 AC8) requires. Both servers are same-origin for it: `admin-portal/vite.config.ts`
 *      proxies `/api` to :3003 for the dev server all along, and `vite preview` **inherits**
 *      `server.proxy` (Vite 6.4.3), so CI's preview run needs no extra config.
 *
 * The submit uses credentials that cannot exist, so no account is touched and the request needs no
 * seed. The status is the whole assertion: **403** would mean the same-origin guard refused the
 * submission, **400** would mean the form body never reached `req.body` (the route mounts its own
 * `express.urlencoded`, and this is the only path that parses a form), and **404** would mean the
 * form's `action` is not the route. A 401 is the generic credential failure Story 3 AC5 requires —
 * the *same* answer for an unknown institution as for a real one with a wrong password.
 *
 * DEPLOYMENT PREREQUISITE (the one thing that cannot be checked from this repo): the published page
 * and `/api` must be **same-origin** — proxy `/api` on whichever host serves it. The production
 * portal build points its API calls at a *different* host (`admin-portal/.env.production`), so this
 * is a real nginx decision, not a formality: a cross-origin form post is `Sec-Fetch-Site: same-site`,
 * which AC8 rejects on purpose.
 */
import { test, expect } from '@playwright/test';

const PAGE = '/account-deletion';
const ACTION = '/api/juvi-app/v1/account-deletion';

test.describe('Public account-deletion page', () => {
  test('renders publicly with the deletion form posting to the real route', async ({ page }) => {
    const response = await page.goto(PAGE);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');

    await expect(page).toHaveTitle('Delete your Juvi account');
    await expect(
      page.getByRole('heading', { name: /delete your juvi account/i, level: 1 }),
    ).toBeVisible();

    const form = page.locator('form');
    await expect(form).toHaveAttribute('method', /post/i);
    await expect(form).toHaveAttribute('action', ACTION);
    // The same three field names `accountDeletionRequestSchema` parses, spelled exactly.
    for (const name of ['institutionCode', 'identifier', 'password']) {
      await expect(form.locator(`[name="${name}"]`)).toHaveCount(1);
    }
  });

  test('submits natively from the browser and reaches the real route same-origin', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByLabel(/institution code/i).fill('NOT-A-COLLEGE');
    await page.getByLabel(/roll number or employee code/i).fill('nobody-at-all');
    await page.getByLabel(/juvi password/i).fill('not-their-password');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes(ACTION)),
      page.getByRole('button', { name: /delete my juvi account/i }).click(),
    ]);

    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe('INVALID_CREDENTIALS');
    // The browser navigated to the API's own body, i.e. this was a native form submission and not a
    // background request some script made. Zero retries, no fixed waits — the navigation auto-waits.
    await expect(page.locator('body')).toContainText('INVALID_CREDENTIALS');
  });
});

/**
 * 011 Story 3 — the public account-deletion page (tasks.md T16).
 *
 * Two things are asserted here, and both are properties of the *served* artifact rather than of the
 * source file:
 *
 *   1. it is plain HTML with **no script at all** (Story 3 AC9), and its form posts natively to the
 *      real route — this is what makes the page work for someone who no longer has the app;
 *   2. that native submission actually reaches the route from the browser, same-origin (AC8's
 *      `Sec-Fetch-Site` must be `same-origin`, so the origin serving the page must also serve
 *      `/api`). Both servers do: `admin-portal/vite.config.ts` has proxied `/api` to :3003 for
 *      the dev server all along, and `vite preview` **inherits** `server.proxy` (Vite 6.4.3,
 *      `resolvePreviewOptions`: `proxy: preview?.proxy ?? server.proxy`), so CI's preview run
 *      needs no extra config. Verified, not assumed: with `vite.config.ts` untouched, the preview
 *      server answers `/account-deletion.html` 200 and posts through to a 401.
 *
 * The submit uses credentials that cannot exist, so no account is touched and the request needs no
 * seed. The status is the whole assertion: **403** would mean the same-origin guard refused the
 * submission, **400** would mean the form body never reached `req.body` (the route mounts its own
 * `express.urlencoded`, and this is the only path that parses a form), and **404** would mean the
 * form's `action` is not the route. A 401 is the generic credential failure Story 3 AC5 requires —
 * the *same* answer for an unknown institution as for a real one with a wrong password.
 *
 * DEPLOYMENT PREREQUISITE (the one thing that cannot be checked from this repo): the published page
 * and `/api` must be **same-origin** — either publish the file under the API's host, or proxy `/api`
 * on whichever host serves it. The production portal build points its API calls at a *different*
 * host (`admin-portal/.env.production`), so this is a real nginx decision, not a formality: a
 * cross-origin form post is `Sec-Fetch-Site: same-site`, which AC8 rejects on purpose.
 */
import { test, expect } from '@playwright/test';

const PAGE = '/account-deletion.html';
const ACTION = '/api/juvi-app/v1/account-deletion';

test.describe('Public account-deletion page', () => {
  test('is served as static HTML with no script, and its form posts to the real route', async ({ page }) => {
    const response = await page.goto(PAGE);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');

    const html = await page.content();
    expect(html).not.toContain('<script');
    // No inline handler either — a `<form onsubmit=...>` would be a script in all but name, and the
    // whole point of AC9 is that nothing on this page has to execute for the form to work.
    expect(html).not.toMatch(/\son(click|submit|load|input|change|focus|blur)\s*=/i);

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

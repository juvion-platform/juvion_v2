/**
 * The public privacy-policy page — the URL the Play listing's "Privacy policy" field links to.
 *
 * It is asserted the same way as the account-deletion page (`account-deletion.spec.ts`) and for the
 * same reason: what matters is the *served* artifact, not the source file. The page is a static
 * asset under `admin-portal/public/`, copied by vite into `dist/` and served by nginx outside React
 * Router, so a passing unit test of the file on disk would prove nothing about what a store reviewer
 * or a regulator actually opens.
 *
 * Two properties are load-bearing here and neither is cosmetic:
 *
 *   1. **No script.** A policy page that a locked-down browser refuses to render is not a published
 *      policy. There is no form on this page, so the bar is simply that nothing has to execute.
 *   2. **The cross-links are RELATIVE.** The policy and the deletion page link to each other by bare
 *      filename, so the pair keeps working whichever origin — and whichever directory — they are
 *      published under. An absolute `/privacy.html` would break the moment they were served from a
 *      subpath, and that failure would be invisible until someone hit it for real.
 */
import { test, expect } from '@playwright/test';

const PAGE = '/privacy.html';
const DELETION_PAGE = '/account-deletion.html';

test.describe('Public privacy policy page', () => {
  test('is served as static HTML with no script', async ({ page }) => {
    const response = await page.goto(PAGE);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');

    const html = await page.content();
    expect(html).not.toContain('<script');
    // Every inline handler, not a named handful (an `onerror` on an injected `<img>` is a script in
    // all but name), plus `javascript:` URLs in a link. Explicit names rather than `on[a-z]+` so a
    // stray " on ... =" in the policy's prose cannot redden this by accident.
    expect(html).not.toMatch(
      /\son(click|submit|load|input|change|focus|blur|error|mouseover|mouseout|pointerdown|keydown|keyup)\s*=/i,
    );
    expect(html).not.toMatch(/href\s*=\s*["']?\s*javascript:/i);

    // One heading names the document; a second would mean a stray fragment was pasted in.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/privacy policy/i);
  });

  test('links to the deletion page, and the deletion page links back, both relatively', async ({ page }) => {
    for (const [from, to] of [[PAGE, 'account-deletion.html'], [DELETION_PAGE, 'privacy.html']] as const) {
      await page.goto(from);
      // At least one link, wherever the document chooses to place it — a long policy points at the
      // deletion page from several sections, and pinning an exact count would fail on copy edits
      // without anything being wrong.
      await expect(page.locator(`a[href="${to}"]`).first()).toBeVisible();
      // ...and never the root-absolute spelling: relative is what makes the pair survive being
      // served from a subpath, and that failure would otherwise be invisible until someone hit it.
      await expect(page.locator(`a[href="/${to}"]`)).toHaveCount(0);
    }
  });
});

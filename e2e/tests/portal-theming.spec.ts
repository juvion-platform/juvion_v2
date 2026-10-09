import { test, expect } from './fixtures/auth-fixture';

/**
 * Proves the theming chain end to end: the accent stored on a college reaches the
 * browser and lands on a CSS custom property.
 *
 * The assertion is "a well-formed triplet that is NOT the legacy default", not an
 * exact triplet. A non-default value is only reachable if the whole chain ran —
 * DB -> the login response's `colleges[]` projection (a superadmin) or /auth/me
 * (everyone else) -> store -> applyRamp — which is what makes this an acceptance test
 * rather than a smoke test. The exact value is deliberately left unpinned so this
 * file does not duplicate the colour maths the `brand-ramp` unit tests own, and does not
 * have to be edited in two places when the derivation changes on purpose.
 *
 * The college is a dedicated seed fixture (E2E_THEME_COLLEGE_ID) because
 * juvi-admin.spec.ts saves a different accent onto the shared E2E College and this
 * suite runs fully parallel outside CI.
 */
const LEGACY_PRIMARY_500 = '43 108 176';
const THEMING_COLLEGE = /E2E Theming College/;

test('a college accent reaches the portal as a themed custom property', async ({ page, loginAs }) => {
  // A superadmin has no college of their own, so this also covers success
  // criterion 3: the accent arriving through the college selector, not a login.
  await loginAs('super_admin');
  await page.getByRole('button', { name: THEMING_COLLEGE }).click();
  await expect(page).toHaveURL(/\/$/);

  // Auto-retrying on purpose: React has to commit the store update and run
  // BrandTheme's effect before the property changes. No fixed wait — the suite
  // bans `waitForTimeout`.
  //
  // Playwright 1.60's expect has no `toSatisfy`, so the same predicate is expressed as
  // a boolean the poll compares to `true`. Both conditions are load-bearing and must
  // not be weakened:
  //   - the triplet shape, because an empty string means Tailwind emitted `rgb( / 1)`
  //     and dropped the whole declaration — the transparent-render failure — and that
  //     must not pass as "themed";
  //   - the inequality against the legacy default, which is the only value `:root`
  //     alone can produce, so dropping it lets the test pass with the feature deleted.
  await expect
    .poll(
      async () =>
        page.evaluate((legacyPrimary500) => {
          const value = getComputedStyle(document.documentElement)
            .getPropertyValue('--c-primary-500')
            .trim();
          return /^\d{1,3} \d{1,3} \d{1,3}$/.test(value) && value !== legacyPrimary500;
        }, LEGACY_PRIMARY_500),
      { message: 'the accent never reached --c-primary-500 as a non-default triplet' },
    )
    .toBe(true);
});

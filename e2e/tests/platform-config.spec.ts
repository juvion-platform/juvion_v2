/**
 * Schema-driven Configuration E2E — Strategic Gap 3 (Phase B Wave 2).
 *
 * Two tests, both render-only:
 *   AC4.11  /platform/config hub → at least 4 schema-driven config
 *           types render as picker cards (institution-feature-flags,
 *           notification-templates, naming-series, award-classification).
 *           Catches: registry → frontend contract drift; any of the
 *           4 endpoints under /platform/config/types regressing.
 *   AC4.12  /platform/config (institution-feature-flags singleton)
 *           renders the form with 8 boolean toggles + Save button.
 *           Catches: schema-driven field renderer collapsing on a
 *           singleton-cardinality config.
 *
 * No state mutation — both tests are renders-only so they stay
 * deterministic regardless of seed state.
 */

import { test, expect } from './fixtures/auth-fixture';

test.describe('Platform — Schema-driven config', () => {
  test('AC4.11 admin: /platform/config hub renders 4+ config types', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/platform/config');

    // Hub heading proves the lazy-loaded chunk landed.
    await expect(page.getByRole('heading', { name: /^configuration$/i })).toBeVisible();

    // 4 canonical config types are registered out of the box per the
    // captain-spec at .captain/specs/schema-driven-config/spec.md.
    // Card titles use the labels from the registry — these are the
    // SOURCE OF TRUTH the schema-driven backend emits at /config/types.
    await expect(page.getByText(/institution feature flags/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/notification templates/i)).toBeVisible();
    await expect(page.getByText(/naming series/i)).toBeVisible();
    await expect(page.getByText(/award classification/i)).toBeVisible();
  });

  test('AC4.12 admin: institution-feature-flags singleton renders form', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/platform/config');

    // Click into the institution-feature-flags card to enter the
    // singleton detail view. There's exactly one card with that
    // label — getByRole('button') resolves it via accessible name.
    await page.getByRole('button', { name: /institution feature flags/i }).click();

    // Singleton form heading.
    await expect(page.getByRole('heading', { name: /institution feature flags/i })).toBeVisible({ timeout: 10_000 });

    // The 8 feature flags from config-registry.ts each render as a
    // labelled boolean. Asserting on a representative subset proves
    // the field renderer is wired for `type: 'boolean'`. Use exact-
    // match text to scope to the `<label>` element (the help-text
    // <p> below each label contains overlapping copy and would
    // trip strict-mode otherwise).
    await expect(page.getByText('Optional Allotment Proposals', { exact: true })).toBeVisible();
    await expect(page.getByText('Email Notifications', { exact: true })).toBeVisible();
    await expect(page.getByText('Juvi AI Suggestions', { exact: true })).toBeVisible();

    // Save Configuration CTA is always present on the singleton form.
    await expect(page.getByRole('button', { name: /save configuration/i })).toBeVisible();
  });
});

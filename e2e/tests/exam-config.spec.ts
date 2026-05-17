/**
 * Exam configuration E2E — Strategic Gap 6 (Phase B Wave 2).
 *
 *   AC4.15  /academics/exam-config hub renders the 7 entity cards
 *           shipped in Phase A: Exam Rooms, Evaluators, Grade
 *           Templates, Exam Centre Templates, Question Paper Schemas,
 *           Signature Versions, MOOC Subjects.
 *
 * Hub view has no API call (static card definitions from the ENTITIES
 * registry in ExamConfigPage.tsx) — so this test should be very fast
 * and catches the page-chunk lazy-load + the registry constant.
 *
 * Detail-view CRUD per entity is deferred to Phase C; Phase A ships
 * with a JSON-editor that is too brittle for stable click-based
 * assertions today.
 */

import { test, expect } from './fixtures/auth-fixture';

test.describe('Academics — Exam configuration hub', () => {
  test('AC4.15 admin: /academics/exam-config renders 7 entity cards', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/academics/exam-config');

    // Hub heading.
    await expect(page.getByRole('heading', { name: /^exam configuration$/i })).toBeVisible({ timeout: 10_000 });

    // Each of the 7 entity types per the ENTITIES registry in
    // ExamConfigPage.tsx. Use exact-match text so the card-title
    // `<div>` is scoped distinct from the intro paragraph and the
    // per-card description text (both reuse some of these terms).
    await expect(page.getByText('Exam Rooms', { exact: true })).toBeVisible();
    await expect(page.getByText('Evaluators', { exact: true })).toBeVisible();
    await expect(page.getByText('Grade Templates', { exact: true })).toBeVisible();
    await expect(page.getByText('Exam Centre Templates', { exact: true })).toBeVisible();
    await expect(page.getByText('Question Paper Schemas', { exact: true })).toBeVisible();
    await expect(page.getByText('Signature Versions', { exact: true })).toBeVisible();
    await expect(page.getByText('MOOC Subjects', { exact: true })).toBeVisible();
  });
});

# Juvi Notifications — Plan 2 of 3: ERP Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ERP publishers the portal side of Juvi push notifications: a Confidential flag, Urgent offered only to those who may publish it (with a required, counted reason and a clear refusal message), a phone-tray preview of the exact notification text, a Notification delivery row and a Delivery column on the Reach tab, and the Urgent reason and Confidential flag on the Audit tab.

**Architecture:** Portal only. Plan 1 (#106, merged at cc722cc) already serves every field this plan reads: `/targets.canPublishUrgent`, the detail's `confidential` and `urgentReason`, the Reach `delivery` block, each pending member's `delivery`, the CSV `Delivery` column, the publish audit entry's `urgentReason` and `confidential` changes, and the `403 { error, detail: { code: 'URGENT_NOT_ALLOWED' } }` refusal. Task 1 types those fields in `services/notices.ts` and adds the pure wording helpers to `lib/notices.ts` (the tray text, the Confidential helper, the delivery labels, the Urgent refusal). Tasks 2–5 change the composer, add `NotificationTrayPreview`, and extend `ReachTab`, `AuditTab` and the detail header. Task 6 adds two Playwright cases (the Registrar is offered no Urgent; the e2e principal publishes Urgent and confidential) and runs the full verification.

**Tech Stack:** React 19, React Router 7, React Query 5, Zustand 5, Tailwind 3, lucide-react, axios 1.7, vitest 4 + Testing Library 16 (portal); Playwright (e2e). No backend change.

**Spec:** `docs/superpowers/specs/2026-10-02-juvi-notifications-design.md`, §13 item 2. Binding here: §9 (portal), §6.5 (Urgent gate), §6.6 (payload and tray text), §7.4 (Reach delivery), §7.5 (admin publish and `canPublishUrgent`), §12 (portal and Playwright tests). Plan 1 (`docs/superpowers/plans/2026-10-02-juvi-notifications-1-backend.md`, Rulings 1–21) is what the backend exposes. The notices portal plan (`docs/superpowers/plans/2026-10-01-juvi-notices-2-portal.md`) built every screen this plan extends.

## Rulings

Decisions this plan makes where the spec is silent or the live code forces a shape. Each is restated in the task that implements it.

1. **No backend change.** Every field the portal needs is live: `canPublishUrgent` (`backend/src/modules/juvi-app/notices/admin-controller.ts:60`), `confidential` and `urgentReason` on the detail (`admin-service.ts:27`, `:97`), the Reach `delivery` block and the pending `delivery` field (`notices/schemas.ts:102-110`, `:135`, `:150`), the CSV `Delivery` column (`reach-service.ts:260-284`, Plan 1 Ruling 18), the publish audit entry's `urgentReason` and `confidential` changes (`publish-service.ts:127-137`), and the refusal `new AppError(403, …, { code: 'URGENT_NOT_ALLOWED' })` (`urgent-gate.ts:34-35`).
2. **The tray text is a two-line Android notification, built by `trayNotification()` in `lib/notices.ts`.** Published: title line = the office, text line = the notice title. Confidential: one line, "New notice from <office>". Reminder: the office over "Reminder: <title>", or one line "Reminder from <office>" when confidential. These are the spec §6.6 strings; Plan 3's Flutter handler must render the same lines.
3. **The tray preview shows the published notification and a reminder**, because a reminder is always Important (spec §4.1) and its confidential wording differs. A Routine digest ("3 new notices from <office>") is described in the Routine line, not drawn, since the composer has one notice.
4. **A welcome notice is never pushed**: it is created `published` and returns before any event is emitted (`publish-service.ts:139`), and the added-later back-fill only considers `purpose: 'standard'` (`recipient-service.ts:41`). Its tray preview says so instead of drawing a notification.
5. **The Confidential helper text names the office** the notice is published from ("…say only 'New notice from Exam Section'…"), following the admin's "Publish as" choice, and falls back to "your office" before `/targets` answers. The spec's `<office>` is that placeholder.
6. **Urgent offered from `/targets` only.** The radio is rendered only when `canPublishUrgent` is true; otherwise, once `/targets` has answered, the composer shows "Need Urgent? Ask an IT admin." Nothing is shown while `/targets` loads.
7. **After a `403 URGENT_NOT_ALLOWED`** the confirm step shows the portal's own sentence (`URGENT_NOT_ALLOWED_MESSAGE`), and the composer invalidates `['notice-targets']`. The priority it sends is derived (`chosenPriority`): a stored `urgent` that `/targets` no longer allows reads as Important, so Back to edit shows Important checked and no reason field, with no effect that rewrites state. The refusal is recognised by `detail.code`, the first machine code the portal branches on; every other error is still shown verbatim by status.
8. **The reason is validated on review**: trimmed length at least 10 ("Say why this is Urgent (at least 10 characters)"); `maxLength={300}` caps the input; the counter counts what is typed. It is sent trimmed and only with `priority: 'urgent'`; switching back to Routine or Important keeps the text in the field's state but drops it from the payload (the server would ignore it too, Plan 1 Ruling 4).
9. **`URGENT_NOTE` is rewritten** from "Urgent bypasses quiet hours once push arrives…" to "Urgent notifies everyone at once, even during quiet hours and when they have muted the channel.", since push now exists (spec §2 goal 1). The confirm step gains an Urgent line with the reason and a Confidential line, for non-welcome notices.
10. **`confidential` is required on `PublishNoticeInput`** and the composer always sends it (`false` by default), so the publish payload is explicit. `urgentReason` is optional.
11. **The Reach row is labelled "Notification delivery"**, not "Delivery", so it is not confused with the existing Delivery tab (the outbox fan-out). It lists the nine spec counts with the §9 words (Scheduled, Sent, Delivered, Opened, Failed, Cancelled, Muted, Notifications off, No device) and a line saying each person is counted once at their latest step (Plan 1 Ruling 17). When every count is zero (a notice from before Plan 1, a welcome notice, or nobody on Juvi) it says "No phone notifications for this notice." The pending column header is "Delivery", as in the CSV.
12. **"Copy pending list" is unchanged**: the spec asks for the delivery column on the screen and in the CSV, and the CSV already has it.
13. **The Audit tab gains a "Publishing record"** (priority, Urgent reason, Confidential) read from the notice detail, above the trail. `AuditTab` keeps its `noticeId` prop and gains an optional `record`, so the trail's existing tests keep their call sites; the detail page always passes it. An Urgent notice from before the gate has no reason and says "Not recorded: published before Urgent needed a reason." In the trail, a boolean change value now reads Yes or No, so the publish entry shows "Confidential: — → Yes".
14. **The detail header shows a "Confidential" badge** next to the priority badge. The spec does not ask for it; it costs one line and tells an admin why the phone showed no title.
15. **E2E personas, no seed change.** `e2e_registrar` is `staff` / `ST-REG`, which holds no `notices:urgent`, so it is offered no Urgent. `e2e_principal` is DB role `admin` (`backend/src/scripts/seed-e2e-users.ts:182-186`), which publishes Urgent by role (`urgent-gate.ts:16`, `:21`), so it is the Urgent publisher. The Registrar case also asserts the server's 403 through the API, as the HOD case does.
16. **The Playwright harness needs `JUVI_RECEIPT_KEY`.** It runs the backend with `NODE_ENV=production`, where Plan 1's startup guard requires the key (Plan 1 Ruling 16); the harness copy sets the same dummy CI uses (`.github/workflows/e2e.yml:71`).

## Dry run

Every task below was applied in order to a copy of this worktree at cc722cc (rsync, reusing `node_modules`), running each task's own tests, the portal typecheck and the full portal suite after each task; each task's new tests were also run against the previous task's code to confirm they fail first.

- **Baseline (cc722cc):** `npm run typecheck` clean. Portal: 44 files, 298 tests, all passing. Playwright through the harness (backend with `NODE_ENV=production` on a dropped `juvion_v2_notices_e2e` database): 40 passed, 5 skipped.
- **Per task (portal suite):** Task 1 → 44 files / 306 tests; Task 2 → 312; Task 3 → 45 files / 318; Task 4 → 321; Task 5 → 324. `tsc -b` clean after each.
- **Task 6 red step:** the new spec run against the Task 1 portal build: 2 passed (the existing cases), 2 failed exactly as Task 6 Step 2 states.
- **Final:** `npm run typecheck` clean (backend, admin-portal, e2e). Portal: 45 files, 324 tests, all passing (+1 file, +26 tests). Playwright: 42 passed, 5 skipped (+2: the two new `juvi-notices.spec.ts` cases; the 5 skips are the same pre-existing `test.skip`s). Backend unchanged, so its suites were not re-run.
- **Draft fixes found in the dry run and folded into the tasks:** adding `confidential`/`urgentReason` to `NoticeDetail` breaks the `as NoticeDetail` casts in `ReachTab.test.tsx` and `AuditDeliveryTabs.test.tsx`, and adding `delivery` to `PendingPerson` breaks the typed `pendingAsText` fixture in `lib/__tests__/notices.test.ts` (Task 1 updates all three); making `confidential` required on `PublishNoticeInput` breaks the publish case in `services/__tests__/notices.test.ts` (Task 2 updates it).

## Global Constraints

Values copied from the spec, the Plan 1 code and the root `CLAUDE.md`. Every task honours all of them.

- **Confidential helper text** (spec §9): "The phone notification will say only 'New notice from <office>'. The content opens in the app." (`<office>` is the office the notice is published from; Ruling 5.)
- **Urgent** (spec §6.5, §9): offered only when `GET /targets` returns `canPublishUrgent: true`; otherwise the composer shows Routine and Important plus "Need Urgent? Ask an IT admin." Choosing Urgent shows a required reason field, 10–300 characters, with a counter, next to the Urgent note. The server answers `403 { error, detail: { code: 'URGENT_NOT_ALLOWED' } }` and `400` for a missing or short reason.
- **Tray text** (spec §6.6): a normal notice shows the office and the title, never the body; a confidential notice shows only "New notice from <office>"; a reminder shows "Reminder: <title>", or "Reminder from <office>" when confidential; Routine is silent; Urgent and Important alert. Never the body, attachments, names, deadlines or audience.
- **Reach delivery** (spec §7.4, §9): counts `scheduled, sent, delivered, opened, failed, cancelled` and `suppressed { muted, tierOff, noDevice }`, for the published notification, one per person at their current status. Pending delivery labels: Not delivered, Delivered, Opened, Muted, Notifications off, No device, Scheduled, and "—" for `none` (someone not on Juvi).
- **Audit** (spec §9): shows the Urgent reason and the Confidential flag.
- **ERP error shape** (Plan 1 Ruling 3): `{ error: string }`, a Zod failure `{ error: 'Validation failed', details }`; the Urgent refusal adds `detail.code`. Show server text verbatim except for `URGENT_NOT_ALLOWED`.
- **Mutations** (root `CLAUDE.md`, Juvi admin console paragraph): wrap the service call (`mutationFn: (x) => svc(x)`), and opt out of the global toast cache with `meta: { silent: true, silentError: true }` when the component shows the result itself.
- **Frontend conventions** (root `CLAUDE.md`): React Query for server state, Tailwind, `lucide-react`, local `inp` / `lbl` constants, every control labelled, accessible queries in tests (`getByRole`, `getByLabelText`), `renderWithProviders` from `src/__tests__/test-utils.tsx`, services mocked with `vi.mock`.
- **Gates per task:** `npm run typecheck` and `npm run test -w admin-portal` (the portal has no ESLint config, so lint is not a gate; notices portal plan, Global Constraints).
- **Playwright:** zero retries, no `waitForTimeout`, accessible selectors, `loginAs(role)` from `e2e/tests/fixtures/auth-fixture.ts`, personas `e2e_registrar`, `e2e_hod`, `e2e_principal`, `e2e_super`. Run through the scratchpad harness on a dropped `juvion_v2_notices_e2e` database, with `JUVI_RECEIPT_KEY` set (Ruling 16). Never touch the dev database `juvion_v2`.
- **Commits:** one per task, conventional-commit message ending in `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

Inputs the spec implies but does not spell out, most likely first. Each has a test in the task that owns the code.

1. **A notice with no phone notifications at all** (published before Plan 1, a welcome notice, or an audience nobody on Juvi): the Reach row must say so, not show nine zeros as if push failed. Task 4, "says so when no phone notification was decided for the notice".
2. **Urgent permission removed while the composer is open**: the publish is refused with 403; the publisher must read a sentence that tells them what to do, and the form must stop offering Urgent. Task 2, "explains a server refusal of Urgent and takes Urgent off the form".
3. **A reason padded with spaces** (" Too short ", 11 characters typed, 9 trimmed): the composer must refuse it as the server would, and send the trimmed text. Task 2, "requires a 10–300 character reason…".
4. **An Urgent notice published before the gate** has `urgentReason: null`: the Audit tab must say the reason was not recorded, not show an empty value. Task 5, "records a routine, open notice as such, and says when an old Urgent notice has no reason".
5. **The admin changes "Publish as" after ticking Confidential**: the helper text and the tray must follow the new office, because that is what the phone will say. Task 2, "marks a notice Confidential…", and Task 3, "follows the title, the office, Confidential and the priority".

---

## File structure

**Create**

```
admin-portal/src/components/communication/NotificationTrayPreview.tsx             the phone-tray preview (published + reminder rows)
admin-portal/src/components/communication/__tests__/NotificationTrayPreview.test.tsx
```

**Modify**

```
admin-portal/src/services/notices.ts                                   canPublishUrgent; confidential, urgentReason; DeliveryCounts, PendingDelivery; publish input
admin-portal/src/lib/notices.ts                                        tray text, Confidential helper, Urgent limits and refusal, delivery labels, URGENT_NOTE
admin-portal/src/components/communication/NoticeComposer.tsx           Urgent gating and reason, Confidential, 403 mapping, confirm lines, tray preview
admin-portal/src/components/communication/ReachTab.tsx                 Notification delivery row; Delivery column
admin-portal/src/components/communication/AuditTab.tsx                 Publishing record; Yes/No for boolean changes
admin-portal/src/pages/communication/NoticeDetailPage.tsx              Confidential badge; passes the record to AuditTab
admin-portal/src/lib/__tests__/notices.test.ts
admin-portal/src/services/__tests__/notices.test.ts
admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx
admin-portal/src/components/communication/__tests__/ReachTab.test.tsx
admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx
admin-portal/src/components/communication/__tests__/AudienceBuilder.test.tsx   typed fixture gains canPublishUrgent
admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx
e2e/tests/juvi-notices.spec.ts                                         the Registrar's Urgent refusal; an admin's Urgent, confidential publish
```

Nothing under `backend/` changes (Ruling 1).

---

### Task 1: Types for the new fields, and the phone-notification wording helpers

**Files:**
- Modify: `admin-portal/src/services/notices.ts:30-33` (`NoticeDetail`), `:37-42` (`NoticeTargets`), `:54-63` (`Reach`), `:63` (`PendingPerson`)
- Modify: `admin-portal/src/lib/notices.ts:1-8` (header, imports), `:38` (new section after `PENDING_STATE_LABELS`), `:103-120` (error helpers)
- Test: `admin-portal/src/lib/__tests__/notices.test.ts`; typed fixtures in `admin-portal/src/components/communication/__tests__/AudienceBuilder.test.tsx:11`, `ReachTab.test.tsx:23-39`, `AuditDeliveryTabs.test.tsx:21-27`

**Interfaces:**
- Consumes: the Plan 1 responses (Ruling 1); `errorStatus`, `errorDetail`, `noticeErrorMessage` (`lib/notices.ts:99-120`).
- Produces:
  ```ts
  // services/notices.ts
  interface NoticeDetail { …; confidential: boolean; urgentReason: string | null }
  interface NoticeTargets { …; canPublishUrgent: boolean }
  export interface DeliveryCounts { scheduled; sent; delivered; opened; failed; cancelled: number; suppressed: { muted; tierOff; noDevice: number } }
  export type PendingDelivery = 'not_delivered' | 'delivered' | 'opened' | 'muted' | 'tier_off' | 'no_device' | 'scheduled' | 'none';
  interface Reach { …; delivery: DeliveryCounts }
  interface PendingPerson { …; delivery: PendingDelivery }
  // lib/notices.ts
  export const URGENT_REASON_MIN = 10, URGENT_REASON_MAX = 300;
  export const NEED_URGENT_HINT: string;               // 'Need Urgent? Ask an IT admin.'
  export const URGENT_NOT_ALLOWED_MESSAGE: string;
  export function confidentialHelp(office: string): string;
  export function trayNotification(i: { office: string; title: string; confidential: boolean; variant: 'published' | 'reminder' }): { title: string; text: string | null };
  export const TRAY_ALERT: Record<NoticePriority, string>;
  export const PENDING_DELIVERY_LABELS: Record<PendingDelivery, string>;
  export function deliveryTotal(d: DeliveryCounts): number;
  export function isUrgentNotAllowed(err: unknown): boolean;
  export function publishErrorMessage(err: unknown): string;
  ```

The tray strings are the spec §6.6 contract (Ruling 2): Plan 3 renders the same lines on the phone.

- [ ] **Step 1: Write the failing tests**

Extend the helper tests; the `pendingAsText` fixture gains `delivery`, because `PendingPerson` now requires it:

```diff
--- a/admin-portal/src/lib/__tests__/notices.test.ts
+++ b/admin-portal/src/lib/__tests__/notices.test.ts
@@ -2,6 +2,8 @@
 import {
   zonedLocalToIso, isoToZonedLocal, formatInZone, formatBytes, noticeErrorMessage, errorStatus, errorDetail,
   noticeStatus, deadlineText, countsText, pendingAsText, isNoticeAdmin, roleLabel,
+  trayNotification, confidentialHelp, isUrgentNotAllowed, publishErrorMessage, deliveryTotal, PENDING_DELIVERY_LABELS,
+  URGENT_NOT_ALLOWED_MESSAGE, URGENT_REASON_MIN, URGENT_REASON_MAX,
 } from '../notices';
 
 const httpError = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });
@@ -77,9 +79,9 @@
 describe('pendingAsText', () => {
   it('groups members under their batch or section heading', () => {
     const text = pendingAsText('Exam timetable', [
-      { name: 'Asha Rao', identifier: '24JIT0001', group: '2024 Batch · Section A', state: 'not_seen', lastSeenInApp: null },
-      { name: 'Ravi Kumar', identifier: null, group: '2024 Batch · Section A', state: 'not_on_juvi', lastSeenInApp: null },
-      { name: 'Meera Das', identifier: '24JIT0007', group: '2024 Batch · Section B', state: 'seen', lastSeenInApp: '2026-10-01T04:00:00.000Z' },
+      { name: 'Asha Rao', identifier: '24JIT0001', group: '2024 Batch · Section A', state: 'not_seen', lastSeenInApp: null, delivery: 'not_delivered' },
+      { name: 'Ravi Kumar', identifier: null, group: '2024 Batch · Section A', state: 'not_on_juvi', lastSeenInApp: null, delivery: 'none' },
+      { name: 'Meera Das', identifier: '24JIT0007', group: '2024 Batch · Section B', state: 'seen', lastSeenInApp: '2026-10-01T04:00:00.000Z', delivery: 'opened' },
     ]);
     const lines = text.split('\n');
     expect(lines.slice(0, 5)).toEqual([
@@ -91,5 +93,55 @@
     ]);
     expect(lines[6]).toBe('2024 Batch · Section B');
     expect(lines[7]).toMatch(/^- Meera Das \(24JIT0007\): Seen, not acknowledged, last in the app /);
+  });
+});
+
+describe('phone notifications (notifications spec §6.5, §6.6, §9)', () => {
+  it('shows the office and the title, never the title of a confidential notice', () => {
+    expect(trayNotification({ office: 'Exam Section', title: ' Hall tickets are out ', confidential: false, variant: 'published' }))
+      .toEqual({ title: 'Exam Section', text: 'Hall tickets are out' });
+    expect(trayNotification({ office: 'Exam Section', title: 'Hall tickets are out', confidential: true, variant: 'published' }))
+      .toEqual({ title: 'New notice from Exam Section', text: null });
+  });
+
+  it('words a reminder the way the app does', () => {
+    expect(trayNotification({ office: 'Exam Section', title: 'Hall tickets are out', confidential: false, variant: 'reminder' }))
+      .toEqual({ title: 'Exam Section', text: 'Reminder: Hall tickets are out' });
+    expect(trayNotification({ office: 'Exam Section', title: 'Hall tickets are out', confidential: true, variant: 'reminder' }))
+      .toEqual({ title: 'Reminder from Exam Section', text: null });
+  });
+
+  it('stands in a placeholder while the title is empty', () => {
+    expect(trayNotification({ office: 'Registrar', title: '  ', confidential: false, variant: 'published' }).text).toBe('Notice title');
+  });
+
+  it('puts the office into the Confidential helper text', () => {
+    expect(confidentialHelp('Exam Section')).toBe("The phone notification will say only 'New notice from Exam Section'. The content opens in the app.");
+    expect(confidentialHelp('')).toMatch(/'New notice from your office'/);
+  });
+
+  it('recognises the Urgent refusal by its code, not its text', () => {
+    const refused = httpError(403, { error: 'Only an IT admin can publish Urgent notices.', detail: { code: 'URGENT_NOT_ALLOWED' } });
+    expect(isUrgentNotAllowed(refused)).toBe(true);
+    expect(publishErrorMessage(refused)).toBe(URGENT_NOT_ALLOWED_MESSAGE);
+    const scope = httpError(403, { error: 'You can only send notices to your own department.' });
+    expect(isUrgentNotAllowed(scope)).toBe(false);
+    expect(publishErrorMessage(scope)).toBe('You can only send notices to your own department.');
+    expect(isUrgentNotAllowed(httpError(400, { error: 'x', detail: { code: 'URGENT_NOT_ALLOWED' } }))).toBe(false);
+  });
+
+  it('mirrors the backend reason limits', () => {
+    expect([URGENT_REASON_MIN, URGENT_REASON_MAX]).toEqual([10, 300]);
+  });
+
+  it('labels every pending delivery state, with a dash for someone not on Juvi', () => {
+    expect(PENDING_DELIVERY_LABELS).toEqual({
+      not_delivered: 'Not delivered', delivered: 'Delivered', opened: 'Opened', muted: 'Muted', tier_off: 'Notifications off',
+      no_device: 'No device', scheduled: 'Scheduled', none: '—',
+    });
+  });
+
+  it('adds up every delivery count once', () => {
+    expect(deliveryTotal({ scheduled: 1, sent: 2, delivered: 3, opened: 4, failed: 5, cancelled: 6, suppressed: { muted: 7, tierOff: 8, noDevice: 9 } })).toBe(45);
   });
 });
```

Three typed fixtures need the new required fields, or `tsc -b` fails once the types land:

```diff
--- a/admin-portal/src/components/communication/__tests__/AudienceBuilder.test.tsx
+++ b/admin-portal/src/components/communication/__tests__/AudienceBuilder.test.tsx
@@ -9,7 +9,7 @@
 import { previewAudience, searchNoticePeople } from '../../../services/notices';
 
 const COLLEGE: NoticeTargets = {
-  office: 'Exam Section', offices: ['Exam Section'], isAdmin: false, timezone: 'Asia/Kolkata',
+  office: 'Exam Section', offices: ['Exam Section'], isAdmin: false, timezone: 'Asia/Kolkata', canPublishUrgent: false,
   kinds: ['all', 'role', 'department', 'programme', 'batch', 'section', 'course_offering', 'hostel_block', 'custom'],
   roles: ['student', 'faculty', 'staff', 'hod'],
   departments: [{ id: 'd1', label: 'Computer Science' }, { id: 'd2', label: 'Electronics' }],
--- a/admin-portal/src/components/communication/__tests__/ReachTab.test.tsx
+++ b/admin-portal/src/components/communication/__tests__/ReachTab.test.tsx
@@ -26,7 +26,7 @@
   ackRequired: true, deadline: '2026-10-05T11:30:00.000Z', deadlineState: 'open', counts: { audience: 10, onJuvi: 8 }, acknowledged: 4, seen: 3,
   reminders: { used: 1, max: 2, lastAt: '2026-09-30T06:00:00.000Z' }, isMine: true,
   body: 'Attached.', attachments: [], audience: { rules: [{ kind: 'batch', ids: ['b1'] }], line: 'Sent to 2024 Batch' },
-  ackCommentAllowed: true, priority: 'routine', archivedAt: null, canManage: true,
+  ackCommentAllowed: true, priority: 'routine', confidential: false, urgentReason: null, archivedAt: null, canManage: true,
 } as NoticeDetail;
 const person = (name: string, extra: object = {}) => ({ name, identifier: `24JIT-${name[0]}`, group: '2024 Batch · Section A', at: '2026-10-06T04:00:00.000Z', ...extra });
 const REACH: Reach = {
@@ -37,6 +37,7 @@
   lateAcks: [person('Lata Late')],
   comments: [{ ...person('Chitra Comment'), comment: 'Will the hall change?', late: false }],
   addedLater: { total: 1, acknowledged: 0, seen: 1, items: [{ ...person('Arjun Added'), state: 'seen' }] },
+  delivery: { scheduled: 0, sent: 0, delivered: 0, opened: 0, failed: 0, cancelled: 0, suppressed: { muted: 0, tierOff: 0, noDevice: 0 } },
   asOf: '2026-10-01T04:00:00.000Z',
 };
 const PENDING = (items: object[], nextCursor: string | null = null) => ({ items, total: 3, groups: [{ label: '2024 Batch · Section A', count: 3 }], nextCursor });
--- a/admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx
+++ b/admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx
@@ -23,7 +23,7 @@
   delivery: { state: 'delivered', attempts: 1, lastError: null, updatedAt: '2026-09-30T04:01:00.000Z' }, publishedAt: '2026-09-30T04:00:00.000Z',
   createdAt: '2026-09-30T04:00:00.000Z', ackRequired: true, deadline: null, deadlineState: 'none', counts: { audience: 120, onJuvi: 100 },
   acknowledged: 0, seen: 0, reminders: { used: 0, max: 2, lastAt: null }, isMine: true, body: 'x', attachments: [],
-  audience: { rules: [{ kind: 'all', ids: [] }], line: 'Sent to everyone at JIT' }, ackCommentAllowed: false, priority: 'routine', archivedAt: null, canManage: true,
+  audience: { rules: [{ kind: 'all', ids: [] }], line: 'Sent to everyone at JIT' }, ackCommentAllowed: false, priority: 'routine', confidential: false, urgentReason: null, archivedAt: null, canManage: true,
 } as NoticeDetail;
 const FAILED = { ...NOTICE, status: 'publishing', delivery: { state: 'failed', attempts: 8, lastError: 'Mongo timeout', updatedAt: '2026-09-30T04:30:00.000Z' } } as NoticeDetail;
 
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/lib/__tests__/notices.test.ts`
Expected: FAIL — the new `phone notifications` cases throw `TypeError: trayNotification is not a function` (and the other new imports are `undefined`); the earlier 9 cases pass.

- [ ] **Step 3: Implement**

```diff
--- a/admin-portal/src/services/notices.ts
+++ b/admin-portal/src/services/notices.ts
@@ -30,12 +30,18 @@
 export interface NoticeDetail extends NoticeRow {
   body: string; attachments: NoticeAttachment[]; audience: { rules: AudienceRule[]; line: string };
   ackCommentAllowed: boolean; priority: NoticePriority; archivedAt: string | null; canManage: boolean;
+  /** The phone notification says only "New notice from <office>" (notifications spec §6.6). */
+  confidential: boolean;
+  /** Recorded when an Urgent notice is published (spec §6.5); null otherwise, and on Urgent notices from before the gate. */
+  urgentReason: string | null;
 }
 export interface NoticeListQuery { page: number; limit: number; status?: NoticeStatus; purpose?: NoticePurpose; office?: string; q?: string }
 
 export interface TargetOption { id: string; label: string }
 export interface NoticeTargets {
   office: string; offices: string[]; isAdmin: boolean; timezone: string;
+  /** Urgent is offered only when this is true (notifications spec §6.5, §9). */
+  canPublishUrgent: boolean;
   kinds: AudienceRuleKind[]; roles: string[];
   departments: TargetOption[]; programmes: TargetOption[]; batches: TargetOption[]; sections: TargetOption[];
   courseOfferings: TargetOption[]; hostelBlocks: TargetOption[];
@@ -51,6 +57,16 @@
 
 export interface ReachGroup { label: string; total: number; acknowledged: number; seen: number; notSeen: number; notOnJuvi: number }
 export interface ReachPerson { name: string; identifier: string | null; group: string; at: string | null }
+/**
+ * Push delivery of the published notification (notifications spec §7.4): one
+ * count per person, at their row's current status, so the counts are disjoint.
+ */
+export interface DeliveryCounts {
+  scheduled: number; sent: number; delivered: number; opened: number; failed: number; cancelled: number;
+  suppressed: { muted: number; tierOff: number; noDevice: number };
+}
+/** A pending member's push state; `none` is someone not on Juvi (or with no notification). */
+export type PendingDelivery = 'not_delivered' | 'delivered' | 'opened' | 'muted' | 'tier_off' | 'no_device' | 'scheduled' | 'none';
 export interface Reach {
   noticeId: string; title: string; status: NoticeStatus; ackRequired: boolean; deadline: string | null; publishedAt: string | null;
   audience: number; acknowledged: number; seen: number; notSeen: number; notOnJuvi: number; dismissed: number; late: number;
@@ -58,9 +74,13 @@
   lateAcks: ReachPerson[];
   comments: (ReachPerson & { comment: string; late: boolean })[];
   addedLater: { total: number; acknowledged: number; seen: number; items: (ReachPerson & { state: ReachState })[] };
+  delivery: DeliveryCounts;
   asOf: string;
 }
-export interface PendingPerson { name: string; identifier: string | null; group: string; state: 'seen' | 'not_seen' | 'not_on_juvi'; lastSeenInApp: string | null }
+export interface PendingPerson {
+  name: string; identifier: string | null; group: string; state: 'seen' | 'not_seen' | 'not_on_juvi'; lastSeenInApp: string | null;
+  delivery: PendingDelivery;
+}
 export interface PendingQuery { group?: string; q?: string; cursor?: string; limit?: number }
 export interface PendingPage { items: PendingPerson[]; total: number; groups: { label: string; count: number }[]; nextCursor: string | null }
 
--- a/admin-portal/src/lib/notices.ts
+++ b/admin-portal/src/lib/notices.ts
@@ -1,11 +1,12 @@
 /**
  * Juvi notices: pure helpers shared by the portal's notice screens (spec §8).
  * Limits and the MIME list mirror backend/src/models/juvi/Notice.ts; the
- * admin roles mirror notices/publisher-scope.ts ADMIN_ROLES.
+ * admin roles mirror notices/publisher-scope.ts ADMIN_ROLES. The phone
+ * notification wording mirrors the notifications spec §6.6.
  */
 import type { AxiosError } from 'axios';
 import { extractErrorMessage } from './errors';
-import type { AudienceRuleKind, NoticePriority, NoticeRow, PendingPerson } from '../services/notices';
+import type { AudienceRuleKind, DeliveryCounts, NoticePriority, NoticeRow, PendingDelivery, PendingPerson } from '../services/notices';
 
 export const NOTICE_TITLE_MAX = 120;
 export const NOTICE_BODY_MAX = 5000;
@@ -37,6 +38,46 @@
 
 export const PENDING_STATE_LABELS: Record<PendingPerson['state'], string> = { seen: 'Seen, not acknowledged', not_seen: 'Not seen', not_on_juvi: 'Not on Juvi' };
 
+// ── Phone notifications (notifications spec §6.5, §6.6, §7.4, §9) ─────────
+
+/** `urgentReason` length, as backend/src/models/juvi/Notice.ts URGENT_REASON_MIN / URGENT_REASON_MAX. */
+export const URGENT_REASON_MIN = 10;
+export const URGENT_REASON_MAX = 300;
+export const NEED_URGENT_HINT = 'Need Urgent? Ask an IT admin.';
+export const URGENT_NOT_ALLOWED_MESSAGE = 'Your account cannot publish Urgent notices. Go back and choose Routine or Important, or ask an IT admin.';
+
+/** The Confidential helper text (spec §9), with the office the notice is published from. */
+export const confidentialHelp = (office: string): string =>
+  `The phone notification will say only 'New notice from ${office || 'your office'}'. The content opens in the app.`;
+
+/**
+ * What the phone shows for one notice (spec §6.6), as the two lines of an
+ * Android notification. The office is always there; a confidential notice
+ * never shows its title. The Flutter handler renders the same strings.
+ */
+export function trayNotification(i: { office: string; title: string; confidential: boolean; variant: 'published' | 'reminder' }): { title: string; text: string | null } {
+  const title = i.title.trim() || 'Notice title';
+  if (i.confidential) return { title: i.variant === 'reminder' ? `Reminder from ${i.office}` : `New notice from ${i.office}`, text: null };
+  return { title: i.office, text: i.variant === 'reminder' ? `Reminder: ${title}` : title };
+}
+
+/** How each tier reaches the phone (spec §2 goals 1–3, §6.3, §6.4). */
+export const TRAY_ALERT: Record<NoticePriority, string> = {
+  urgent: 'Rings at once, even during quiet hours and when the channel is muted.',
+  important: 'Plays a sound. During someone\'s quiet hours (22:00–07:00 unless they change them) it waits until they end.',
+  routine: 'Silent. Routine notices from one office within 15 minutes arrive as one notification.',
+};
+
+/** The Reach pending list's delivery column (spec §9); the CSV uses the same words, with an empty cell for `none`. */
+export const PENDING_DELIVERY_LABELS: Record<PendingDelivery, string> = {
+  not_delivered: 'Not delivered', delivered: 'Delivered', opened: 'Opened', muted: 'Muted', tier_off: 'Notifications off',
+  no_device: 'No device', scheduled: 'Scheduled', none: '—',
+};
+
+/** Everyone the published notification was decided for: each person is in exactly one count. */
+export const deliveryTotal = (d: DeliveryCounts): number =>
+  d.scheduled + d.sent + d.delivered + d.opened + d.failed + d.cancelled + d.suppressed.muted + d.suppressed.tierOff + d.suppressed.noDevice;
+
 // ── College-timezone dates ──────────────────────────────────────────────
 
 const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
@@ -102,8 +143,9 @@
 
 /**
  * The server's message for a failed notices call, shown verbatim. ERP bodies
- * carry no machine-readable code, so screens branch on errorStatus() and never
- * on this text. A Zod 400 lists its field messages, not "Validation failed".
+ * carry no machine-readable code (the one exception is the Urgent gate's
+ * `detail.code`, see isUrgentNotAllowed), so screens branch on errorStatus()
+ * and never on this text. A Zod 400 lists its field messages, not "Validation failed".
  */
 export function noticeErrorMessage(err: unknown, fallback?: string): string {
   const body = bodyOf(err);
@@ -117,6 +159,16 @@
 export function errorDetail<T>(err: unknown): T | undefined {
   const detail = bodyOf(err)?.detail;
   return detail && typeof detail === 'object' ? (detail as T) : undefined;
+}
+
+/** The Urgent gate's refusal: 403 `{ error, detail: { code: 'URGENT_NOT_ALLOWED' } }` (notifications spec §6.5). */
+export function isUrgentNotAllowed(err: unknown): boolean {
+  return errorStatus(err) === 403 && errorDetail<{ code?: unknown }>(err)?.code === 'URGENT_NOT_ALLOWED';
+}
+
+/** A failed publish: the Urgent refusal in the portal's words, anything else as noticeErrorMessage. */
+export function publishErrorMessage(err: unknown): string {
+  return isUrgentNotAllowed(err) ? URGENT_NOT_ALLOWED_MESSAGE : noticeErrorMessage(err);
 }
 
 // ── List and reach wording ───────────────────────────────────────────────
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/lib/__tests__/notices.test.ts`
Expected: PASS (17 tests).

Run: `npm run typecheck && npm run test -w admin-portal`
Expected: typecheck exit 0; portal 44 files, 306 tests passing.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/services/notices.ts admin-portal/src/lib/notices.ts admin-portal/src/lib/__tests__/notices.test.ts \
  admin-portal/src/components/communication/__tests__/AudienceBuilder.test.tsx admin-portal/src/components/communication/__tests__/ReachTab.test.tsx \
  admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx
git commit -m "feat(portal): types and wording for Juvi push notifications

NoticeTargets gains canPublishUrgent, NoticeDetail confidential and
urgentReason, Reach the delivery counts and each pending member its
delivery state, as Plan 1 serves them. lib/notices adds the tray text
(spec §6.6), the Confidential helper, the delivery labels and the
URGENT_NOT_ALLOWED refusal.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Composer — Urgent offered from `/targets`, the required reason, Confidential, and the refusal message

**Files:**
- Modify: `admin-portal/src/services/notices.ts:46-50` (`PublishNoticeInput`)
- Modify: `admin-portal/src/lib/notices.ts:36` (`URGENT_NOTE`)
- Modify: `admin-portal/src/components/communication/NoticeComposer.tsx:12-14` (imports), `:44-76` (state and derived values), `:83-94` (mutation), `:96-123` (validate, submit), `:140-146` (confirm props), `:216-227` (priority fieldset; Confidential fieldset after it), `:240-243` (card preview priority), `:251-284` (`ConfirmStep`)
- Test: `admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx`; `admin-portal/src/services/__tests__/notices.test.ts:29`

**Interfaces:**
- Consumes: Task 1 (`NoticeTargets.canPublishUrgent`, `URGENT_REASON_MIN/MAX`, `NEED_URGENT_HINT`, `confidentialHelp`, `isUrgentNotAllowed`, `publishErrorMessage`).
- Produces:
  ```ts
  // services/notices.ts
  interface PublishNoticeInput { …; confidential: boolean; urgentReason?: string }
  // lib/notices.ts
  export const URGENT_NOTE = 'Urgent notifies everyone at once, even during quiet hours and when they have muted the channel.';
  // NoticeComposerForm (internal, used by Task 3):
  const fromOffice: string;                 // officeChoice ?? targets.office ?? ''
  const chosenPriority: NoticePriority;     // a stored 'urgent' that /targets no longer allows reads as 'important'
  const confidential: boolean;
  // Controls: radio group "Priority" (Urgent only with canPublishUrgent), textarea "Reason for Urgent",
  //           checkbox "Confidential" (described by the helper text)
  ```

Rulings 6–10 apply. The reason field sits inside the Priority fieldset under the Urgent note; the Confidential checkbox gets its own "Phone notification" fieldset. On a `URGENT_NOT_ALLOWED` refusal the mutation's `onError` invalidates `['notice-targets']`; the confirm step shows `publishErrorMessage()`.

- [ ] **Step 1: Write the failing tests**

```diff
--- a/admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx
+++ b/admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx
@@ -11,7 +11,7 @@
 import { toast } from '../../../stores/toastStore';
 
 const TARGETS = {
-  office: 'College Office', offices: ['College Office', "Principal's Office", 'Exam Section'], isAdmin: true, timezone: 'Asia/Kolkata',
+  office: 'College Office', offices: ['College Office', "Principal's Office", 'Exam Section'], isAdmin: true, timezone: 'Asia/Kolkata', canPublishUrgent: true,
   kinds: ['all', 'role', 'batch'], roles: ['student', 'faculty'],
   departments: [], programmes: [], batches: [{ id: 'b1', label: 'CSE 2024' }], sections: [], courseOfferings: [], hostelBlocks: [],
 };
@@ -101,9 +101,9 @@
     fireEvent.click(screen.getByLabelText('Require acknowledgement'));
     expect(deadline).toBeEnabled();
     expect(screen.getByLabelText('Allow a comment with the acknowledgement')).toBeEnabled();
-    expect(screen.queryByText(/bypasses quiet hours/)).toBeNull();
-    fireEvent.click(screen.getByLabelText('Urgent'));
-    expect(screen.getByText(/Urgent bypasses quiet hours once push arrives\./)).toBeInTheDocument();
+    expect(screen.queryByText(/even during quiet hours/)).toBeNull();
+    fireEvent.click(await screen.findByLabelText('Urgent'));
+    expect(screen.getByText('Urgent notifies everyone at once, even during quiet hours and when they have muted the channel.')).toBeInTheDocument();
   });
 
   it('previews the notice as the Juvi card', async () => {
@@ -153,7 +153,7 @@
     await waitFor(() => expect(publishNotice).toHaveBeenCalledWith({
       title: 'Mid-semester timetable', body: 'Attached.', attachments: [], audience: { rules: [{ kind: 'batch', ids: ['b1'] }] },
       ackRequired: true, ackDeadline: '2030-01-15T11:30:00.000Z', ackCommentAllowed: true,
-      priority: 'important', purpose: 'standard', office: 'Exam Section',
+      priority: 'important', purpose: 'standard', confidential: false, office: 'Exam Section',
     }));
     expect(toast.success).toHaveBeenCalledWith('Notice published', 'Delivering to 3 people.');
     expect(onPublished).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
@@ -218,5 +218,102 @@
     fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
     expect(screen.getAllByText(/You can only send notices to your own department\./)).toHaveLength(1);
     expect(screen.queryByRole('heading', { name: /Publish to/ })).toBeNull();
+  });
+
+  describe('Urgent and Confidential (notifications spec §6.5, §9)', () => {
+    async function fillNotice() {
+      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Exam hall changed' } });
+      fireEvent.change(screen.getByLabelText('Notice'), { target: { value: 'Report to Hall B at 2 pm.' } });
+      await chooseBatch();
+    }
+
+    it('offers Urgent only when /targets allows it, and says whom to ask otherwise', async () => {
+      (getNoticeTargets as Mock).mockResolvedValue({ ...TARGETS, isAdmin: false, office: 'Registrar', offices: ['Registrar'], canPublishUrgent: false });
+      open();
+      expect(await screen.findByText('Need Urgent? Ask an IT admin.')).toBeInTheDocument();
+      const priority = screen.getByRole('group', { name: 'Priority' });
+      expect(within(priority).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['routine', 'important']);
+      expect(screen.queryByLabelText('Urgent')).toBeNull();
+    });
+
+    it('does not offer the hint to someone who may publish Urgent', async () => {
+      open();
+      expect(await screen.findByLabelText('Urgent')).toBeInTheDocument();
+      expect(screen.queryByText('Need Urgent? Ask an IT admin.')).toBeNull();
+    });
+
+    it('requires a 10–300 character reason with a counter, and sends it trimmed', async () => {
+      open();
+      await fillNotice();
+      expect(screen.queryByLabelText('Reason for Urgent')).toBeNull();
+      fireEvent.click(screen.getByLabelText('Urgent'));
+      const reason = screen.getByLabelText('Reason for Urgent');
+      expect(reason).toBeRequired();
+      expect(reason).toHaveAttribute('maxLength', '300');
+      fireEvent.change(reason, { target: { value: ' Too short ' } });
+      expect(reason).toHaveAccessibleDescription('11/300 · at least 10 · kept in the audit trail');
+      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
+      expect(screen.getByText('Say why this is Urgent (at least 10 characters)')).toBeInTheDocument();
+      expect(screen.queryByRole('heading', { name: /Publish to/ })).toBeNull();
+
+      fireEvent.change(reason, { target: { value: ' Exam moved to today ' } });
+      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
+      await screen.findByRole('heading', { name: 'Publish to 3 people?' });
+      expect(screen.getByText('Urgent: phones are notified at once, even during quiet hours. Reason: Exam moved to today')).toBeInTheDocument();
+      fireEvent.click(screen.getByRole('button', { name: 'Publish notice' }));
+      await waitFor(() => expect(publishNotice).toHaveBeenCalledWith(expect.objectContaining({ priority: 'urgent', urgentReason: 'Exam moved to today' })));
+    });
+
+    it('drops the reason when the priority goes back to Important', async () => {
+      open();
+      await fillNotice();
+      fireEvent.click(screen.getByLabelText('Urgent'));
+      fireEvent.change(screen.getByLabelText('Reason for Urgent'), { target: { value: 'Exam moved to today' } });
+      fireEvent.click(screen.getByLabelText('Important'));
+      expect(screen.queryByLabelText('Reason for Urgent')).toBeNull();
+      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
+      fireEvent.click(await screen.findByRole('button', { name: 'Publish notice' }));
+      await waitFor(() => expect(publishNotice).toHaveBeenCalled());
+      const input = (publishNotice as Mock).mock.calls[0]![0] as Record<string, unknown>;
+      expect(input.priority).toBe('important');
+      expect(input).not.toHaveProperty('urgentReason');
+    });
+
+    it('marks a notice Confidential, explains the notification with the office, and sends the flag', async () => {
+      open();
+      await fillNotice();
+      const box = screen.getByLabelText('Confidential');
+      expect(box).not.toBeChecked();
+      expect(box).toHaveAccessibleDescription("The phone notification will say only 'New notice from College Office'. The content opens in the app.");
+      fireEvent.change(screen.getByLabelText('Publish as'), { target: { value: 'Exam Section' } });
+      expect(box).toHaveAccessibleDescription("The phone notification will say only 'New notice from Exam Section'. The content opens in the app.");
+      fireEvent.click(box);
+      await waitFor(() => expect(previewAudience).toHaveBeenLastCalledWith([{ kind: 'batch', ids: ['b1'] }], 'Exam Section'));
+      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
+      expect(await screen.findByText('Confidential: the phone notification says only "New notice from Exam Section".')).toBeInTheDocument();
+      fireEvent.click(screen.getByRole('button', { name: 'Publish notice' }));
+      await waitFor(() => expect(publishNotice).toHaveBeenCalledWith(expect.objectContaining({ confidential: true, office: 'Exam Section' })));
+    });
+
+    it('explains a server refusal of Urgent and takes Urgent off the form', async () => {
+      (publishNotice as Mock).mockRejectedValue({
+        isAxiosError: true,
+        response: { status: 403, data: { error: 'Only an IT admin can publish Urgent notices. Choose Routine or Important, or ask an IT admin.', detail: { code: 'URGENT_NOT_ALLOWED' } } },
+      });
+      open();
+      await fillNotice();
+      fireEvent.click(screen.getByLabelText('Urgent'));
+      fireEvent.change(screen.getByLabelText('Reason for Urgent'), { target: { value: 'Exam moved to today' } });
+      (getNoticeTargets as Mock).mockResolvedValue({ ...TARGETS, canPublishUrgent: false });
+      fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
+      fireEvent.click(await screen.findByRole('button', { name: 'Publish notice' }));
+      expect(await screen.findByRole('alert')).toHaveTextContent('Your account cannot publish Urgent notices. Go back and choose Routine or Important, or ask an IT admin.');
+      await waitFor(() => expect(getNoticeTargets).toHaveBeenCalledTimes(2));
+      fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
+      expect(await screen.findByText('Need Urgent? Ask an IT admin.')).toBeInTheDocument();
+      expect(screen.queryByLabelText('Urgent')).toBeNull();
+      expect(screen.getByLabelText('Important')).toBeChecked();
+      expect(screen.queryByLabelText('Reason for Urgent')).toBeNull();
+    });
   });
 });
```

The service test's publish input must carry the now-required `confidential`:

```diff
--- a/admin-portal/src/services/__tests__/notices.test.ts
+++ b/admin-portal/src/services/__tests__/notices.test.ts
@@ -26,7 +26,7 @@
     await searchNoticePeople('asha');
     expect(api.get).toHaveBeenCalledWith(`${BASE}/targets/people`, { params: { q: 'asha' } });
     (api.post as any).mockResolvedValue({ data: { id: 'n1' } });
-    const input = { title: 't', body: 'b', attachments: [], audience: { rules: [{ kind: 'all' as const, ids: [] }] }, ackRequired: false, ackCommentAllowed: false, priority: 'routine' as const, purpose: 'standard' as const };
+    const input = { title: 't', body: 'b', attachments: [], audience: { rules: [{ kind: 'all' as const, ids: [] }] }, ackRequired: false, ackCommentAllowed: false, priority: 'urgent' as const, purpose: 'standard' as const, confidential: true, urgentReason: 'Exam moved to today' };
     expect((await publishNotice(input)).id).toBe('n1');
     expect(api.post).toHaveBeenCalledWith(BASE, input);
   });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/components/communication/__tests__/NoticeComposer.test.tsx`
Expected: FAIL — 7 of 19: the Urgent note text, the exact payload (no `confidential`), and five of the six new cases ("Need Urgent? Ask an IT admin." not found, `Reason for Urgent` and `Confidential` not found). "does not offer the hint to someone who may publish Urgent" already passes.

- [ ] **Step 3: Implement**

```diff
--- a/admin-portal/src/services/notices.ts
+++ b/admin-portal/src/services/notices.ts
@@ -53,6 +53,10 @@
   title: string; body: string; attachments: NoticeAttachment[]; audience: { rules: AudienceRule[] };
   ackRequired: boolean; ackDeadline?: string | null; ackCommentAllowed: boolean;
   priority: NoticePriority; purpose: NoticePurpose; office?: string;
+  /** Fixed once published (notifications spec §4.2). */
+  confidential: boolean;
+  /** Sent with `priority: 'urgent'` only: 10–300 characters (spec §6.5). */
+  urgentReason?: string;
 }
 
 export interface ReachGroup { label: string; total: number; acknowledged: number; seen: number; notSeen: number; notOnJuvi: number }
--- a/admin-portal/src/lib/notices.ts
+++ b/admin-portal/src/lib/notices.ts
@@ -34,7 +34,7 @@
 export const roleLabel = (id: string): string => ROLE_LABELS[id] ?? id;
 
 export const PRIORITY_LABELS: Record<NoticePriority, string> = { routine: 'Routine', important: 'Important', urgent: 'Urgent' };
-export const URGENT_NOTE = 'Urgent bypasses quiet hours once push arrives. Until then every notice reaches the app on its next refresh.';
+export const URGENT_NOTE = 'Urgent notifies everyone at once, even during quiet hours and when they have muted the channel.';
 
 export const PENDING_STATE_LABELS: Record<PendingPerson['state'], string> = { seen: 'Seen, not acknowledged', not_seen: 'Not seen', not_on_juvi: 'Not on Juvi' };
 
--- a/admin-portal/src/components/communication/NoticeComposer.tsx
+++ b/admin-portal/src/components/communication/NoticeComposer.tsx
@@ -10,7 +10,8 @@
   getNoticeTargets, publishNotice, type AudiencePreview, type NoticeDetail, type NoticePriority, type NoticePurpose, type PublishNoticeInput,
 } from '../../services/notices';
 import {
-  NOTICE_BODY_MAX, NOTICE_TITLE_MAX, PRIORITY_LABELS, URGENT_NOTE, formatInZone, isoToZonedLocal, noticeErrorMessage, zonedLocalToIso,
+  NEED_URGENT_HINT, NOTICE_BODY_MAX, NOTICE_TITLE_MAX, PRIORITY_LABELS, URGENT_NOTE, URGENT_REASON_MAX, URGENT_REASON_MIN,
+  confidentialHelp, formatInZone, isUrgentNotAllowed, isoToZonedLocal, noticeErrorMessage, publishErrorMessage, zonedLocalToIso,
 } from '../../lib/notices';
 
 const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
@@ -47,6 +48,8 @@
   const bodyId = useId();
   const officeId = useId();
   const deadlineId = useId();
+  const reasonId = useId();
+  const confidentialId = useId();
   const targetsQ = useQuery({ queryKey: ['notice-targets'], queryFn: getNoticeTargets, staleTime: 5 * 60_000, meta: { silentError: true } });
   const targets = targetsQ.data;
   const tz = targets?.timezone ?? 'Asia/Kolkata';
@@ -60,6 +63,8 @@
   const [deadline, setDeadline] = useState('');   // datetime-local, in college time
   const [ackCommentAllowed, setAckCommentAllowed] = useState(false);
   const [priority, setPriority] = useState<NoticePriority>('routine');
+  const [urgentReason, setUrgentReason] = useState('');
+  const [confidential, setConfidential] = useState(false);
   const [step, setStep] = useState<'compose' | 'confirm'>('compose');
   const [errors, setErrors] = useState<Record<string, string>>({});
   const reviewRef = useRef<HTMLButtonElement>(null);
@@ -67,6 +72,13 @@
 
   const purpose = initial?.purpose ?? 'standard';
   const officeChoice = targets?.isAdmin ? office || targets.office : undefined;
+  const fromOffice = officeChoice ?? targets?.office ?? '';
+  // Urgent is offered only to those /targets allows (notifications spec §6.5, §9). After a
+  // URGENT_NOT_ALLOWED refusal /targets is fetched again, and a choice it no longer allows reads as Important.
+  const canUrgent = targets?.canPublishUrgent === true;
+  const priorities = canUrgent ? PRIORITIES : PRIORITIES.filter((p) => p !== 'urgent');
+  const chosenPriority: NoticePriority = priority === 'urgent' && !canUrgent ? 'important' : priority;
+  const urgent = chosenPriority === 'urgent';
   const rules = selectionToRules(audience);
   // Count only once /targets has said which office applies, so the first count is already the right one.
   const preview = useAudiencePreview(targets ? rules : [], officeChoice);
@@ -84,6 +96,8 @@
     mutationFn: (input: PublishNoticeInput) => publishNotice(input),
     // The confirm step renders a failure itself; the success toast is below.
     meta: { silent: true, silentError: true },
+    // The confirm step shows the refusal; fetching /targets again takes Urgent off the form.
+    onError: (err) => { if (isUrgentNotAllowed(err)) qc.invalidateQueries({ queryKey: ['notice-targets'] }); },
     onSuccess: (notice) => {
       qc.invalidateQueries({ queryKey: ['notices'] });
       const total = preview.data?.total ?? 0;
@@ -105,6 +119,7 @@
     if (files.uploading) e.attachments = 'Wait for the uploads to finish';
     else if (files.failed) e.attachments = 'Remove the attachments that could not be uploaded';
     if (deadlineIso && new Date(deadlineIso).getTime() <= Date.now()) e.deadline = 'The deadline must be in the future';
+    if (urgent && urgentReason.trim().length < URGENT_REASON_MIN) e.urgentReason = `Say why this is Urgent (at least ${URGENT_REASON_MIN} characters)`;
     return e;
   }
 
@@ -118,7 +133,8 @@
     publish.mutate({
       title: title.trim(), body: body.trim(), attachments: files.attachments, audience: { rules },
       ackRequired, ackDeadline: deadlineIso, ackCommentAllowed: ackRequired && ackCommentAllowed,
-      priority, purpose, ...(officeChoice ? { office: officeChoice } : {}),
+      priority: chosenPriority, purpose, confidential, ...(urgent ? { urgentReason: urgentReason.trim() } : {}),
+      ...(officeChoice ? { office: officeChoice } : {}),
     });
   }
 
@@ -140,7 +156,8 @@
       {confirming && (
         <ConfirmStep
           preview={confirming} office={officeChoice} deadline={deadlineIso && `${formatInZone(deadlineIso, tz)} (${tz})`} welcome={welcome}
-          pending={publish.isPending} error={publish.isError ? noticeErrorMessage(publish.error) : null}
+          urgentReason={urgent ? urgentReason.trim() : null} confidentialOffice={confidential ? fromOffice : null}
+          pending={publish.isPending} error={publish.isError ? publishErrorMessage(publish.error) : null}
           onBack={backToEdit} onPublish={submit}
         />
       )}
@@ -216,16 +233,40 @@
             <fieldset>
               <legend className={lbl}>Priority</legend>
               <div className="flex gap-4">
-                {PRIORITIES.map((p) => (
+                {priorities.map((p) => (
                   <label key={p} className="flex items-center gap-1.5 text-sm">
-                    <input type="radio" name="notice-priority" value={p} checked={priority === p} onChange={() => setPriority(p)} />
+                    <input type="radio" name="notice-priority" value={p} checked={chosenPriority === p} onChange={() => setPriority(p)} />
                     {PRIORITY_LABELS[p]}
                   </label>
                 ))}
               </div>
-              {priority === 'urgent' && <p className="mt-1 text-xs text-amber-700">{URGENT_NOTE}</p>}
+              {targets && !canUrgent && <p className="mt-1 text-xs text-gray-500">{NEED_URGENT_HINT}</p>}
+              {urgent && (
+                <div className="mt-2 space-y-2">
+                  <p className="text-xs text-amber-700">{URGENT_NOTE}</p>
+                  <div>
+                    <label htmlFor={reasonId} className={lbl}>Reason for Urgent</label>
+                    <textarea id={reasonId} className={inp} rows={2} required value={urgentReason} maxLength={URGENT_REASON_MAX}
+                      aria-describedby={`${reasonId}-count`} onChange={(e) => setUrgentReason(e.target.value)} />
+                    <p id={`${reasonId}-count`} className="mt-1 text-right text-xs text-gray-500">
+                      {urgentReason.length}/{URGENT_REASON_MAX} · at least {URGENT_REASON_MIN} · kept in the audit trail
+                    </p>
+                    {err('urgentReason')}
+                  </div>
+                </div>
+              )}
             </fieldset>
 
+            <fieldset>
+              <legend className={lbl}>Phone notification</legend>
+              <label className="flex items-center gap-2 text-sm">
+                <input id={confidentialId} type="checkbox" checked={confidential} aria-describedby={`${confidentialId}-help`}
+                  onChange={(e) => setConfidential(e.target.checked)} />
+                Confidential
+              </label>
+              <p id={`${confidentialId}-help`} className="mt-1 text-xs text-gray-500">{confidentialHelp(fromOffice)}</p>
+            </fieldset>
+
             <div className="flex justify-end gap-2 border-t pt-4">
               <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
               <button ref={reviewRef} type="button" onClick={review} disabled={!targets}
@@ -239,7 +280,7 @@
             <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Preview</p>
             <NoticeCardPreview
               title={title} body={body} office={officeChoice ?? targets?.office ?? ''} audienceLine={rules.length ? preview.data?.line ?? '' : ''}
-              priority={priority} ackRequired={ackRequired} deadline={deadlineIso} timezone={tz} attachmentCount={files.attachments.length}
+              priority={chosenPriority} ackRequired={ackRequired} deadline={deadlineIso} timezone={tz} attachmentCount={files.attachments.length}
             />
           </div>
         </div>
@@ -250,6 +291,8 @@
 
 interface ConfirmProps {
   preview: AudiencePreview; office?: string; deadline: string | null; welcome: boolean;
+  /** Set for an Urgent notice; `confidentialOffice` for a confidential one (notifications spec §6.5, §6.6). */
+  urgentReason: string | null; confidentialOffice: string | null;
   pending: boolean; error: string | null; onBack: () => void; onPublish: () => void;
 }
 
@@ -257,7 +300,7 @@
  * Confirm-to-publish (spec §8): the count, the on-Juvi split, the deadline in college time. Takes focus.
  * A welcome notice is not sent to anyone now (spec §6.5), so it says who sees it instead of a count.
  */
-function ConfirmStep({ preview: d, office, deadline, welcome, pending, error, onBack, onPublish }: ConfirmProps) {
+function ConfirmStep({ preview: d, office, deadline, welcome, urgentReason, confidentialOffice, pending, error, onBack, onPublish }: ConfirmProps) {
   const headingRef = useRef<HTMLHeadingElement>(null);
   useEffect(() => { headingRef.current?.focus(); }, []);
   return (
@@ -277,6 +320,8 @@
             <li>{d.line}{office ? `, from ${office}` : ''}.</li>
             <li>{n(d.onJuvi)} on Juvi see it on their next refresh.</li>
             {d.notOnJuvi > 0 && <li>{n(d.notOnJuvi)} not on Juvi yet get it when they activate the app.</li>}
+            {urgentReason && <li>Urgent: phones are notified at once, even during quiet hours. Reason: {urgentReason}</li>}
+            {confidentialOffice !== null && <li>Confidential: the phone notification says only "New notice from {confidentialOffice || 'your office'}".</li>}
           </>
         )}
         {deadline && <li>Acknowledge by {deadline}.</li>}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/components/communication/__tests__/NoticeComposer.test.tsx src/services/__tests__/notices.test.ts`
Expected: PASS (19 composer tests, and the service tests).

Run: `npm run typecheck && npm run test -w admin-portal`
Expected: typecheck exit 0; portal 44 files, 312 tests passing.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/services/notices.ts admin-portal/src/lib/notices.ts admin-portal/src/components/communication/NoticeComposer.tsx \
  admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx admin-portal/src/services/__tests__/notices.test.ts
git commit -m "feat(portal): Urgent gating with a recorded reason, and Confidential, in the notice composer

Urgent is offered only when /targets says canPublishUrgent; otherwise
the composer says whom to ask. Urgent needs a 10-300 character reason
with a counter. A URGENT_NOT_ALLOWED refusal reads as a plain sentence
and takes Urgent off the form. The Confidential checkbox explains what
the phone will say, and the confirm step repeats both choices.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The phone-tray preview

**Files:**
- Create: `admin-portal/src/components/communication/NotificationTrayPreview.tsx`
- Modify: `admin-portal/src/components/communication/NoticeComposer.tsx:7` (import), `:238-244` (preview column)
- Test: `admin-portal/src/components/communication/__tests__/NotificationTrayPreview.test.tsx` (create); `admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 1 (`trayNotification`, `TRAY_ALERT`); Task 2 (`fromOffice`, `chosenPriority`, `confidential` in `NoticeComposerForm`).
- Produces:
  ```ts
  export default function NotificationTrayPreview(props: { office: string; title: string; priority: NoticePriority; confidential: boolean; welcome: boolean }): JSX.Element;
  // <section aria-label="Phone notification preview">: "When published" row (tier: Rings / Sound / Silent),
  // the tier's TRAY_ALERT line, and an "If you send a reminder" row (always Sound: a reminder is Important).
  ```

Rulings 2–4 apply. The preview sits under the Juvi card preview, headed "On the phone".

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import NotificationTrayPreview from '../NotificationTrayPreview';

const tray = () => screen.getByRole('region', { name: 'Phone notification preview' });

describe('NotificationTrayPreview (notifications spec §6.6, §9)', () => {
  it('shows the office and the title, and the reminder wording', () => {
    render(<NotificationTrayPreview office="Exam Section" title="Hall tickets are out" priority="important" confidential={false} welcome={false} />);
    expect(within(tray()).getAllByText('Exam Section')).toHaveLength(2);
    expect(within(tray()).getByText('Hall tickets are out')).toBeInTheDocument();
    expect(within(tray()).getByText('Reminder: Hall tickets are out')).toBeInTheDocument();
    expect(within(tray()).getByText(/Plays a sound\. During someone's quiet hours/)).toBeInTheDocument();
  });

  it('never shows the title of a confidential notice', () => {
    render(<NotificationTrayPreview office="Exam Section" title="Revaluation results" priority="important" confidential welcome={false} />);
    expect(within(tray()).getByText('New notice from Exam Section')).toBeInTheDocument();
    expect(within(tray()).getByText('Reminder from Exam Section')).toBeInTheDocument();
    expect(tray()).not.toHaveTextContent('Revaluation results');
  });

  it('says a Routine notice is silent and batched, and an Urgent one rings', () => {
    const { rerender } = render(<NotificationTrayPreview office="Registrar" title="Library hours" priority="routine" confidential={false} welcome={false} />);
    const first = within(tray()).getByText('When published').nextElementSibling as HTMLElement;
    expect(first).toHaveTextContent('Silent');
    expect(tray()).toHaveTextContent('Silent. Routine notices from one office within 15 minutes arrive as one notification.');
    rerender(<NotificationTrayPreview office="Registrar" title="Campus closed today" priority="urgent" confidential={false} welcome={false} />);
    expect(within(tray()).getByText('When published').nextElementSibling).toHaveTextContent('Rings');
    expect(tray()).toHaveTextContent('Rings at once, even during quiet hours and when the channel is muted.');
    // A reminder always notifies as Important.
    expect(within(tray()).getByText('If you send a reminder').nextElementSibling).toHaveTextContent('Sound');
  });

  it('says a welcome notice is not pushed', () => {
    render(<NotificationTrayPreview office="College Office" title="Welcome to Juvi" priority="routine" confidential={false} welcome />);
    expect(tray()).toHaveTextContent('A welcome notice sends no phone notification. New accounts see it at onboarding.');
    expect(tray()).not.toHaveTextContent('Welcome to Juvi');
  });
});
```

```diff
--- a/admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx
+++ b/admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx
@@ -316,4 +316,27 @@
       expect(screen.queryByLabelText('Reason for Urgent')).toBeNull();
     });
   });
+
+  describe('phone tray preview (notifications spec §6.6, §9)', () => {
+    it('follows the title, the office, Confidential and the priority', async () => {
+      open();
+      await screen.findByLabelText('Publish as');
+      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Revaluation results' } });
+      const tray = screen.getByRole('region', { name: 'Phone notification preview' });
+      expect(within(tray).getByText('Revaluation results')).toBeInTheDocument();
+      expect(within(tray).getAllByText('College Office')).toHaveLength(2);
+      expect(tray).toHaveTextContent('Silent. Routine notices');
+      fireEvent.change(screen.getByLabelText('Publish as'), { target: { value: 'Exam Section' } });
+      fireEvent.click(screen.getByLabelText('Confidential'));
+      expect(within(tray).getByText('New notice from Exam Section')).toBeInTheDocument();
+      expect(tray).not.toHaveTextContent('Revaluation results');
+      fireEvent.click(screen.getByLabelText('Urgent'));
+      expect(tray).toHaveTextContent('Rings at once');
+    });
+
+    it('says a welcome notice is not pushed', async () => {
+      open({ purpose: 'welcome', title: 'Welcome to Juvi', ackRequired: true, audience: { role: [{ id: 'student', label: 'All students' }] } });
+      expect(await screen.findByRole('region', { name: 'Phone notification preview' })).toHaveTextContent('A welcome notice sends no phone notification.');
+    });
+  });
 });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/components/communication/__tests__/NotificationTrayPreview.test.tsx src/components/communication/__tests__/NoticeComposer.test.tsx`
Expected: FAIL — `Failed to resolve import "../NotificationTrayPreview"`, and the two new composer cases cannot find the region "Phone notification preview".

- [ ] **Step 3: Implement**

```tsx
import { Bell, BellOff, BellRing } from 'lucide-react';
import type { NoticePriority } from '../../services/notices';
import { TRAY_ALERT, trayNotification } from '../../lib/notices';

interface Props { office: string; title: string; priority: NoticePriority; confidential: boolean; welcome: boolean }

const ALERT_ICON = { urgent: BellRing, important: Bell, routine: BellOff } as const;
const ALERT_WORD: Record<NoticePriority, string> = { urgent: 'Rings', important: 'Sound', routine: 'Silent' };

function TrayRow({ label, title, text, priority }: { label: string; title: string; text: string | null; priority: NoticePriority }) {
  const Icon = ALERT_ICON[priority];
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <div className="rounded-xl bg-white/10 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-[11px] text-gray-300">
          <span>Juvi · now</span>
          <span className="inline-flex items-center gap-1"><Icon size={12} aria-hidden="true" /> {ALERT_WORD[priority]}</span>
        </div>
        <p className="mt-0.5 text-sm font-semibold">{title}</p>
        {text && <p className="text-sm text-gray-200">{text}</p>}
      </div>
    </div>
  );
}

/**
 * The phone notification as the tray shows it (notifications spec §6.6, §9): the
 * office and the title, only the office for a confidential notice, and how the tier
 * alerts. A reminder is always Important (spec §4.1). Welcome notices are never pushed.
 */
export default function NotificationTrayPreview({ office, title, priority, confidential, welcome }: Props) {
  if (welcome) {
    return (
      <section aria-label="Phone notification preview" className="rounded-2xl border border-dashed p-3 text-xs text-gray-500">
        A welcome notice sends no phone notification. New accounts see it at onboarding.
      </section>
    );
  }
  const published = trayNotification({ office, title, confidential, variant: 'published' });
  const reminder = trayNotification({ office, title, confidential, variant: 'reminder' });
  return (
    <section aria-label="Phone notification preview" className="space-y-3 rounded-2xl bg-gray-900 p-3 text-white">
      <TrayRow label="When published" title={published.title} text={published.text} priority={priority} />
      <p className="text-xs text-gray-300">{TRAY_ALERT[priority]}</p>
      <TrayRow label="If you send a reminder" title={reminder.title} text={reminder.text} priority="important" />
    </section>
  );
}
```

```diff
--- a/admin-portal/src/components/communication/NoticeComposer.tsx
+++ b/admin-portal/src/components/communication/NoticeComposer.tsx
@@ -5,6 +5,7 @@
 import AudienceBuilder, { selectionToRules, useAudiencePreview, type AudienceSelection } from './AudienceBuilder';
 import AttachmentsField, { type AttachmentsState } from './AttachmentsField';
 import NoticeCardPreview from './NoticeCardPreview';
+import NotificationTrayPreview from './NotificationTrayPreview';
 import { toast } from '../../stores/toastStore';
 import {
   getNoticeTargets, publishNotice, type AudiencePreview, type NoticeDetail, type NoticePriority, type NoticePurpose, type PublishNoticeInput,
@@ -282,6 +283,8 @@
               title={title} body={body} office={officeChoice ?? targets?.office ?? ''} audienceLine={rules.length ? preview.data?.line ?? '' : ''}
               priority={chosenPriority} ackRequired={ackRequired} deadline={deadlineIso} timezone={tz} attachmentCount={files.attachments.length}
             />
+            <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-gray-500">On the phone</p>
+            <NotificationTrayPreview office={fromOffice} title={title} priority={chosenPriority} confidential={confidential} welcome={welcome} />
           </div>
         </div>
       </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/components/communication/__tests__/NotificationTrayPreview.test.tsx src/components/communication/__tests__/NoticeComposer.test.tsx`
Expected: PASS (25 tests: 4 + 21).

Run: `npm run typecheck && npm run test -w admin-portal`
Expected: typecheck exit 0; portal 45 files, 318 tests passing.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/components/communication/NotificationTrayPreview.tsx admin-portal/src/components/communication/NoticeComposer.tsx \
  admin-portal/src/components/communication/__tests__/NotificationTrayPreview.test.tsx admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx
git commit -m "feat(portal): phone-tray preview of the notice's notification

The composer shows what the phone will say: the office and the title,
only the office for a confidential notice, the reminder wording, and
how the tier alerts (Urgent rings, Important sounds, Routine is silent
and batched). A welcome notice says it is not pushed.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Reach — the Notification delivery row and the pending Delivery column

**Files:**
- Modify: `admin-portal/src/components/communication/ReachTab.tsx:10-14` (imports), `:22` (`DeliveryRow` after `n`), `:152-154` (row under the reach counts), `:217`, `:223` (column)
- Test: `admin-portal/src/components/communication/__tests__/ReachTab.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`Reach.delivery: DeliveryCounts`, `PendingPerson.delivery`, `PENDING_DELIVERY_LABELS`, `deliveryTotal`).
- Produces: inside the "Reach summary" region, `<div role="group" aria-label="Notification delivery">` with one `<dt>`/`<dd>` pair per count; the "Pending members" table's last column "Delivery".

Rulings 11–12 apply.

- [ ] **Step 1: Write the failing tests**

```diff
--- a/admin-portal/src/components/communication/__tests__/ReachTab.test.tsx
+++ b/admin-portal/src/components/communication/__tests__/ReachTab.test.tsx
@@ -41,7 +41,8 @@
   asOf: '2026-10-01T04:00:00.000Z',
 };
 const PENDING = (items: object[], nextCursor: string | null = null) => ({ items, total: 3, groups: [{ label: '2024 Batch · Section A', count: 3 }], nextCursor });
-const pendingPerson = (name: string, state = 'not_seen') => ({ name, identifier: null, group: '2024 Batch · Section A', state, lastSeenInApp: state === 'not_on_juvi' ? null : '2026-09-29T04:00:00.000Z' });
+const pendingPerson = (name: string, state = 'not_seen', delivery = state === 'not_on_juvi' ? 'none' : 'not_delivered') =>
+  ({ name, identifier: null, group: '2024 Batch · Section A', state, lastSeenInApp: state === 'not_on_juvi' ? null : '2026-09-29T04:00:00.000Z', delivery });
 
 beforeEach(() => {
   vi.clearAllMocks(); auth.role = 'admin'; auth.perms = ['notices:update']; confirm.confirmed = true;
@@ -176,5 +177,53 @@
     renderWithProviders(<ReachTab notice={{ ...NOTICE, status: 'publishing' }} />);
     expect(screen.getByText(/Reach appears once delivery has finished/)).toBeInTheDocument();
     expect(getReach).not.toHaveBeenCalled();
+  });
+
+  describe('notification delivery (notifications spec §7.4, §9)', () => {
+    const DELIVERY = { scheduled: 1, sent: 2, delivered: 3, opened: 4, failed: 1, cancelled: 1, suppressed: { muted: 2, tierOff: 1, noDevice: 5 } };
+    const cell = (group: HTMLElement, label: string) => within(group).getByText(label, { selector: 'dt' }).parentElement;
+
+    it('shows the delivery counts next to the reach counts', async () => {
+      (getReach as Mock).mockResolvedValue({ ...REACH, delivery: DELIVERY });
+      renderWithProviders(<ReachTab notice={NOTICE} />);
+      const summary = await screen.findByRole('region', { name: 'Reach summary' });
+      const group = within(summary).getByRole('group', { name: 'Notification delivery' });
+      expect(cell(group, 'Scheduled')).toHaveTextContent('Scheduled1');
+      expect(cell(group, 'Sent')).toHaveTextContent('Sent2');
+      expect(cell(group, 'Delivered')).toHaveTextContent('Delivered3');
+      expect(cell(group, 'Opened')).toHaveTextContent('Opened4');
+      expect(cell(group, 'Failed')).toHaveTextContent('Failed1');
+      expect(cell(group, 'Cancelled')).toHaveTextContent('Cancelled1');
+      expect(cell(group, 'Muted')).toHaveTextContent('Muted2');
+      expect(cell(group, 'Notifications off')).toHaveTextContent('Notifications off1');
+      expect(cell(group, 'No device')).toHaveTextContent('No device5');
+    });
+
+    it('says so when no phone notification was decided for the notice', async () => {
+      renderWithProviders(<ReachTab notice={NOTICE} />);
+      const group = await screen.findByRole('group', { name: 'Notification delivery' });
+      expect(group).toHaveTextContent('No phone notifications for this notice.');
+      expect(within(group).queryByText('Delivered')).toBeNull();
+    });
+
+    it('labels each pending member with their delivery, and a dash for someone not on Juvi', async () => {
+      (getPending as Mock).mockResolvedValue(PENDING([
+        pendingPerson('Asha Opened', 'seen', 'opened'), pendingPerson('Bala Muted', 'not_seen', 'muted'), pendingPerson('Chetan Off', 'not_seen', 'tier_off'),
+        pendingPerson('Divya Nodevice', 'not_seen', 'no_device'), pendingPerson('Esha Held', 'not_seen', 'scheduled'), pendingPerson('Farid Sent', 'not_seen', 'not_delivered'),
+        pendingPerson('Gita Phone', 'seen', 'delivered'), pendingPerson('Hari Offline', 'not_on_juvi'),
+      ]));
+      renderWithProviders(<ReachTab notice={NOTICE} />);
+      const table = await screen.findByRole('table', { name: 'Pending members' });
+      expect(within(table).getByRole('columnheader', { name: 'Delivery' })).toBeInTheDocument();
+      const deliveryOf = (name: string) => within(table).getByText(name).closest('tr')!.lastElementChild;
+      expect(deliveryOf('Asha Opened')).toHaveTextContent('Opened');
+      expect(deliveryOf('Bala Muted')).toHaveTextContent('Muted');
+      expect(deliveryOf('Chetan Off')).toHaveTextContent('Notifications off');
+      expect(deliveryOf('Divya Nodevice')).toHaveTextContent('No device');
+      expect(deliveryOf('Esha Held')).toHaveTextContent('Scheduled');
+      expect(deliveryOf('Farid Sent')).toHaveTextContent('Not delivered');
+      expect(deliveryOf('Gita Phone')).toHaveTextContent('Delivered');
+      expect(deliveryOf('Hari Offline')).toHaveTextContent('—');
+    });
   });
 });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/components/communication/__tests__/ReachTab.test.tsx`
Expected: FAIL — 3 of 15: `Unable to find … role "group" and name "Notification delivery"` (twice) and `… role "columnheader" and name "Delivery"`.

- [ ] **Step 3: Implement**

```diff
--- a/admin-portal/src/components/communication/ReachTab.tsx
+++ b/admin-portal/src/components/communication/ReachTab.tsx
@@ -9,9 +9,11 @@
 import { saveBlob } from '../../services/juvi-app';
 import {
   archiveNotice, downloadReachCsv, getAllPending, getPending, getReach, remindNotice,
-  type NoticeDetail, type Reach, type ReachState, type Reminders,
+  type DeliveryCounts, type NoticeDetail, type Reach, type ReachState, type Reminders,
 } from '../../services/notices';
-import { PENDING_STATE_LABELS, errorDetail, errorStatus, formatWhen, isNoticeAdmin, noticeErrorMessage, pendingAsText } from '../../lib/notices';
+import {
+  PENDING_DELIVERY_LABELS, PENDING_STATE_LABELS, deliveryTotal, errorDetail, errorStatus, formatWhen, isNoticeAdmin, noticeErrorMessage, pendingAsText,
+} from '../../lib/notices';
 
 const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
 const btn = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
@@ -22,6 +24,39 @@
 const n = (x: number) => x.toLocaleString('en-IN');
 
 /**
+ * The published notification's push delivery (notifications spec §7.4, §9): each
+ * person once, at their notification's current step.
+ */
+function DeliveryRow({ d }: { d: DeliveryCounts }) {
+  const items: [string, number][] = [
+    ['Scheduled', d.scheduled], ['Sent', d.sent], ['Delivered', d.delivered], ['Opened', d.opened], ['Failed', d.failed], ['Cancelled', d.cancelled],
+    ['Muted', d.suppressed.muted], ['Notifications off', d.suppressed.tierOff], ['No device', d.suppressed.noDevice],
+  ];
+  return (
+    <div role="group" aria-label="Notification delivery" className="mt-4 border-t pt-3">
+      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Notification delivery</p>
+      {deliveryTotal(d) === 0 ? (
+        <p className="mt-1 text-sm text-gray-500">No phone notifications for this notice.</p>
+      ) : (
+        <>
+          <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
+            {items.map(([label, value]) => (
+              <div key={label} className="flex gap-1.5">
+                <dt className="text-gray-500">{label}</dt>
+                <dd className="font-medium tabular-nums text-gray-900">{n(value)}</dd>
+              </div>
+            ))}
+          </dl>
+          <p className="mt-1 text-xs text-gray-500">
+            Each person is counted once, at their latest step. Sent means the phone has not confirmed it yet; Muted, Notifications off and No device were not sent.
+          </p>
+        </>
+      )}
+    </div>
+  );
+}
+
+/**
  * Reach, the ERP side of S11 (spec §8, US-4): counts that reconcile to the
  * audience snapshot, the per-group breakdown, the pending list, late
  * acknowledgements, comments, added-later members, CSV (admins), copy
@@ -152,6 +187,7 @@
         <p className="mt-1 text-xs text-gray-500">
           {r.ackRequired ? `${n(r.late)} acknowledged late` : `${n(r.dismissed)} dismissed`} · as of {formatWhen(r.asOf)}
         </p>
+        <DeliveryRow d={r.delivery} />
 
         <div className="mt-4 flex flex-wrap gap-2">
           {manage && (
@@ -214,13 +250,14 @@
           <div className="mt-3 overflow-x-auto">
             <table className="w-full text-sm" aria-label="Pending members">
               <thead className="border-b bg-gray-50">
-                <tr><th className={th}>Name</th><th className={th}>Roll / employee no.</th><th className={th}>Group</th><th className={th}>State</th><th className={th}>Last in the app</th></tr>
+                <tr><th className={th}>Name</th><th className={th}>Roll / employee no.</th><th className={th}>Group</th><th className={th}>State</th><th className={th}>Last in the app</th><th className={th}>Delivery</th></tr>
               </thead>
               <tbody className="divide-y">
                 {pendingRows.map((p, i) => (
                   <tr key={`${p.group}:${p.name}:${i}`}>
                     <td className={td}>{p.name}</td><td className={td}>{p.identifier ?? '—'}</td><td className={td}>{p.group}</td>
                     <td className={td}>{PENDING_STATE_LABELS[p.state]}</td><td className={td}>{p.state === 'not_on_juvi' ? '—' : formatWhen(p.lastSeenInApp)}</td>
+                    <td className={td}>{PENDING_DELIVERY_LABELS[p.delivery]}</td>
                   </tr>
                 ))}
               </tbody>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/components/communication/__tests__/ReachTab.test.tsx`
Expected: PASS (15 tests).

Run: `npm run typecheck && npm run test -w admin-portal`
Expected: typecheck exit 0; portal 45 files, 321 tests passing.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/components/communication/ReachTab.tsx admin-portal/src/components/communication/__tests__/ReachTab.test.tsx
git commit -m "feat(portal): Reach shows notification delivery and a per-person Delivery column

A Notification delivery row next to the reach counts (scheduled, sent,
delivered, opened, failed, cancelled; muted, notifications off, no
device), and the pending list's Delivery column, from Plan 1's Reach
diagnostics. A notice with no phone notifications says so.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Audit — the Urgent reason and the Confidential flag

**Files:**
- Modify: `admin-portal/src/components/communication/AuditTab.tsx:1-3` (imports), `:18-26` (`show`), `:78-84` (`AuditTab` → `PublishingRecord` + `AuditTab` + `AuditTrail`)
- Modify: `admin-portal/src/pages/communication/NoticeDetailPage.tsx:60` (badge), `:87` (route)
- Test: `admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx`, `admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`NoticeDetail.confidential`, `NoticeDetail.urgentReason`); `PRIORITY_LABELS`.
- Produces:
  ```ts
  export type PublishingRecordValues = Pick<NoticeDetail, 'priority' | 'urgentReason' | 'confidential'>;
  export default function AuditTab(props: { noticeId: string; record?: PublishingRecordValues }): JSX.Element;
  // <section aria-label="Publishing record">: Priority; Urgent reason (Urgent only); Confidential (Yes… / No)
  // Trail: boolean change values read "Yes" / "No".
  // NoticeDetailPage: <Badge>Confidential</Badge>; <AuditTab noticeId={notice.id} record={notice} />
  ```

Rulings 13–14 apply.

- [ ] **Step 1: Write the failing tests**

```diff
--- a/admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx
+++ b/admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx
@@ -44,6 +44,43 @@
 });
 
 describe('AuditTab', () => {
+  // Notifications spec §6.5, §9: the Urgent reason and the Confidential flag, from the notice and from the publish entry.
+  it('heads the trail with the publishing record: priority, Urgent reason and Confidential', async () => {
+    (getNoticeAudit as Mock).mockResolvedValue({
+      items: [{
+        // Real shape from publish-service.ts publishNotice.
+        action: 'publish', entityType: 'Notice', performedBy: 'E2E Principal', at: '2026-10-03T04:00:00.000Z',
+        changes: [
+          { field: 'status', displayName: 'Status', oldValue: null, newValue: 'publishing' },
+          { field: 'audience', displayName: 'Audience', oldValue: null, newValue: 'Sent to everyone at JIT' },
+          { field: 'priority', displayName: 'Priority', oldValue: null, newValue: 'urgent' },
+          { field: 'urgentReason', displayName: 'Urgent reason', oldValue: null, newValue: 'Exam hall changed this morning' },
+          { field: 'confidential', displayName: 'Confidential', oldValue: null, newValue: true },
+        ],
+      }],
+    });
+    renderWithProviders(<AuditTab noticeId="n1" record={{ priority: 'urgent', urgentReason: 'Exam hall changed this morning', confidential: true }} />);
+    const record = screen.getByRole('region', { name: 'Publishing record' });
+    expect(within(record).getByText('Urgent')).toBeInTheDocument();
+    expect(within(record).getByText('Exam hall changed this morning')).toBeInTheDocument();
+    expect(within(record).getByText('Yes: the phone notification shows only the office')).toBeInTheDocument();
+    const table = await screen.findByRole('table', { name: 'Audit trail' });
+    expect(table).toHaveTextContent('Urgent reason: — → Exam hall changed this morning');
+    expect(table).toHaveTextContent('Confidential: — → Yes');
+  });
+
+  it('records a routine, open notice as such, and says when an old Urgent notice has no reason', () => {
+    const { unmount } = renderWithProviders(<AuditTab noticeId="n1" record={{ priority: 'routine', urgentReason: null, confidential: false }} />);
+    let record = screen.getByRole('region', { name: 'Publishing record' });
+    expect(record).toHaveTextContent('PriorityRoutine');
+    expect(record).toHaveTextContent('ConfidentialNo');
+    expect(within(record).queryByText('Urgent reason')).toBeNull();
+    unmount();
+    renderWithProviders(<AuditTab noticeId="n1" record={{ priority: 'urgent', urgentReason: null, confidential: false }} />);
+    record = screen.getByRole('region', { name: 'Publishing record' });
+    expect(record).toHaveTextContent('Not recorded: published before Urgent needed a reason.');
+  });
+
   it('lists the trail newest first with readable actions and changes', async () => {
     renderWithProviders(<AuditTab noticeId="n1" />);
     const table = await screen.findByRole('table', { name: 'Audit trail' });
--- a/admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx
+++ b/admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx
@@ -5,7 +5,9 @@
 import { renderWithProviders } from '../../../__tests__/test-utils';
 
 vi.mock('../../../components/communication/ReachTab', () => ({ default: () => <p>Reach tab</p> }));
-vi.mock('../../../components/communication/AuditTab', () => ({ default: () => <p>Audit tab</p> }));
+vi.mock('../../../components/communication/AuditTab', () => ({
+  default: ({ record }: { record?: { urgentReason: string | null } }) => <p>Audit tab{record ? `: ${record.urgentReason}` : ''}</p>,
+}));
 vi.mock('../../../components/communication/DeliveryTab', () => ({ default: () => <p>Delivery tab</p> }));
 vi.mock('../../../services/notices', () => ({ getNotice: vi.fn() }));
 import { getNotice } from '../../../services/notices';
@@ -17,7 +19,7 @@
   reminders: { used: 0, max: 2, lastAt: null }, isMine: true,
   body: 'The timetable is attached.', attachments: [{ key: 'k1', name: 'timetable.pdf', mime: 'application/pdf', size: 2048 }],
   audience: { rules: [{ kind: 'batch', ids: ['b1'] }], line: 'Sent to 2024 Batch' },
-  ackCommentAllowed: false, priority: 'urgent', archivedAt: null, canManage: true,
+  ackCommentAllowed: false, priority: 'urgent', confidential: true, urgentReason: 'Exam moved to today', archivedAt: null, canManage: true,
 };
 
 function renderAt(path: string) {
@@ -38,6 +40,7 @@
     expect(await screen.findByRole('heading', { name: 'Exam timetable' })).toBeInTheDocument();
     expect(getNotice).toHaveBeenCalledWith('n1');
     expect(screen.getByText('Urgent')).toBeInTheDocument();
+    expect(screen.getByText('Confidential')).toBeInTheDocument();
     expect(screen.getByText(/Exam Section · Sent to 2024 Batch/)).toBeInTheDocument();
     expect(screen.getByText('The timetable is attached.')).toBeInTheDocument();
     expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('timetable.pdf');
@@ -50,6 +53,11 @@
     expect(await screen.findByText('Delivery tab')).toBeInTheDocument();
     expect(screen.getByRole('link', { name: 'Delivery' })).toHaveAttribute('aria-current', 'page');
     expect(screen.getByRole('link', { name: 'Audit' })).toHaveAttribute('href', '/communication/notices/n1/audit');
+  });
+
+  it('hands the notice to the Audit tab for its publishing record', async () => {
+    renderAt('/communication/notices/n1/audit');
+    expect(await screen.findByText('Audit tab: Exam moved to today')).toBeInTheDocument();
   });
 
   it('says so when the notice is not one the caller can see', async () => {
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/components/communication/__tests__/AuditDeliveryTabs.test.tsx src/pages/communication/__tests__/NoticeDetailPage.test.tsx`
Expected: FAIL — 4 of 21: `Unable to find … role "region" and name "Publishing record"` (twice), `Unable to find an element with the text: Confidential`, and `… Audit tab: Exam moved to today`.

- [ ] **Step 3: Implement**

```diff
--- a/admin-portal/src/components/communication/AuditTab.tsx
+++ b/admin-portal/src/components/communication/AuditTab.tsx
@@ -1,6 +1,6 @@
 import { useQuery } from '@tanstack/react-query';
-import { getNoticeAudit, type AuditChange, type AuditEntry } from '../../services/notices';
-import { formatWhen, noticeErrorMessage } from '../../lib/notices';
+import { getNoticeAudit, type AuditChange, type AuditEntry, type NoticeDetail } from '../../services/notices';
+import { PRIORITY_LABELS, formatWhen, noticeErrorMessage } from '../../lib/notices';
 
 const th = 'px-3 py-2 text-left font-medium text-gray-600';
 const td = 'px-3 py-2 align-top';
@@ -18,6 +18,7 @@
 function show(v: unknown): string {
   if (v === null || v === undefined || v === '') return '—';
   if (typeof v === 'string' && HEX24.test(v)) return '—';
+  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
   if (typeof v === 'object' && !Array.isArray(v)) {
     const entries = Object.entries(v as Record<string, unknown>).filter(([k, x]) => !isIdKey(k) && !(typeof x === 'string' && HEX24.test(x)));
     return entries.length > 0 ? entries.map(([k, x]) => `${k}: ${show(x)}`).join(', ') : '—';
@@ -75,8 +76,46 @@
   return e.changes.map(change).join('; ');
 }
 
-/** The notice's ERP audit trail (spec §8 Audit; ADM-06): publish, reminders, archive, acknowledgements, refused reach. */
-export default function AuditTab({ noticeId }: { noticeId: string }) {
+export type PublishingRecordValues = Pick<NoticeDetail, 'priority' | 'urgentReason' | 'confidential'>;
+
+/**
+ * What was decided at publish and cannot change (notifications spec §6.5, §9): the
+ * priority, the Urgent reason and the Confidential flag, read from the notice itself.
+ */
+function PublishingRecord({ record }: { record: PublishingRecordValues }) {
+  return (
+    <section aria-label="Publishing record" className="rounded-xl border bg-white p-4">
+      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
+        <dt className="text-gray-500">Priority</dt>
+        <dd className="text-gray-900">{PRIORITY_LABELS[record.priority]}</dd>
+        {record.priority === 'urgent' && (
+          <>
+            <dt className="text-gray-500">Urgent reason</dt>
+            <dd className="whitespace-pre-line text-gray-900">{record.urgentReason ?? 'Not recorded: published before Urgent needed a reason.'}</dd>
+          </>
+        )}
+        <dt className="text-gray-500">Confidential</dt>
+        <dd className="text-gray-900">{record.confidential ? 'Yes: the phone notification shows only the office' : 'No'}</dd>
+      </dl>
+    </section>
+  );
+}
+
+/**
+ * The notice's ERP audit trail (spec §8 Audit; ADM-06): publish, reminders, archive,
+ * acknowledgements, refused reach. The detail page passes `record`, which heads the
+ * trail with the publishing record.
+ */
+export default function AuditTab({ noticeId, record }: { noticeId: string; record?: PublishingRecordValues }) {
+  return (
+    <div className="space-y-4">
+      {record && <PublishingRecord record={record} />}
+      <AuditTrail noticeId={noticeId} />
+    </div>
+  );
+}
+
+function AuditTrail({ noticeId }: { noticeId: string }) {
   const { data, isLoading, isError, error } = useQuery({ queryKey: ['notice-audit', noticeId], queryFn: () => getNoticeAudit(noticeId), meta: { silentError: true } });
   if (isError) return <p role="alert" className="text-sm text-red-700">{noticeErrorMessage(error)}</p>;
   if (isLoading || !data) return <p className="text-sm text-gray-500">Loading the audit trail…</p>;
--- a/admin-portal/src/pages/communication/NoticeDetailPage.tsx
+++ b/admin-portal/src/pages/communication/NoticeDetailPage.tsx
@@ -57,6 +57,7 @@
           <h2 className="text-xl font-bold text-navy">{notice.title}</h2>
           <Badge variant={status.variant}>{status.label}</Badge>
           {notice.priority !== 'routine' && <Badge variant={notice.priority === 'urgent' ? 'danger' : 'warning'}>{PRIORITY_LABELS[notice.priority]}</Badge>}
+          {notice.confidential && <Badge>Confidential</Badge>}
           {notice.purpose === 'welcome' && <Badge variant="teal">Welcome</Badge>}
         </div>
         <p className="mt-1 text-sm text-gray-600">
@@ -84,7 +85,7 @@
       </nav>
       <Routes>
         <Route index element={<ReachTab notice={notice} />} />
-        <Route path="audit" element={<AuditTab noticeId={notice.id} />} />
+        <Route path="audit" element={<AuditTab noticeId={notice.id} record={notice} />} />
         <Route path="delivery" element={<DeliveryTab notice={notice} />} />
       </Routes>
     </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/components/communication/__tests__/AuditDeliveryTabs.test.tsx src/pages/communication/__tests__/NoticeDetailPage.test.tsx`
Expected: PASS (21 tests).

Run: `npm run typecheck && npm run test -w admin-portal`
Expected: typecheck exit 0; portal 45 files, 324 tests passing.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/components/communication/AuditTab.tsx admin-portal/src/pages/communication/NoticeDetailPage.tsx \
  admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx
git commit -m "feat(portal): Audit tab shows the Urgent reason and the Confidential flag

A publishing record (priority, Urgent reason, Confidential) heads the
trail, read from the notice; boolean changes read Yes or No, so the
publish entry says Confidential: — → Yes. The detail header carries a
Confidential badge.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: E2E — the Registrar is offered no Urgent; an admin publishes Urgent and confidential; full verification

**Files:**
- Modify: `e2e/tests/juvi-notices.spec.ts:1-14` (header), `:25` (`apiAs` roles), end of the `describe` (two tests)

**Interfaces:**
- Consumes: Tasks 2–5 UI (radio group "Priority", "Need Urgent? Ask an IT admin.", "Reason for Urgent", "Confidential", region "Phone notification preview", region "Publishing record", table "Audit trail"); `loginAs`, `TEST_USERS`, the file's `apiAs`, `NOTICES` and `OWN_DEPT`; the seeded "E2E Computer Science" department (`seedE2ENoticeAudience`, one faculty member, not on Juvi).
- Produces: `apiAs(role: 'principal' | 'hod' | 'registrar')`; two tests.

Ruling 15: no seed change. The principal is DB role `admin`, so Urgent is allowed by role; the Registrar (`staff` / `ST-REG`) holds no `notices:urgent`. Ruling 16: the harness sets `JUVI_RECEIPT_KEY`. The harness copy used for the dry run is `/private/tmp/claude-624478678/-Users-srinivasarao-kandula-code-juvion-v2/5e76ad60-8959-4ef0-9f1b-f39b12ef7db1/scratchpad/run-playwright-notif-portal.sh`; it is `run-playwright.sh` with `export JUVI_RECEIPT_KEY='ci-dummy-receipt-key-0123456789abcdef'` added and `ROOT` overridable (`ROOT=<repo> bash run-playwright-notif-portal.sh [SPEC …]`). Without the key the backend exits at startup and the harness stops with "backend did not come up".

- [ ] **Step 1: Write the failing tests**

```diff
--- a/e2e/tests/juvi-notices.spec.ts
+++ b/e2e/tests/juvi-notices.spec.ts
@@ -7,6 +7,11 @@
  *      total once the fan-out lands.
  *   2. An HOD is offered only their own department, and the server refuses
  *      a preview for another one with a 403.
+ *   3. The Registrar is offered no Urgent option, and the server refuses an
+ *      Urgent publish with URGENT_NOT_ALLOWED (notifications spec §6.5, §12).
+ *   4. The principal (DB role admin, so Urgent by role) publishes an Urgent,
+ *      confidential notice with a reason; the tray preview hides the title and
+ *      the Audit tab shows the reason and the flag (notifications spec §9).
  *
  * The audience and the HOD come from seedE2ENoticeAudience in
  * backend/src/scripts/seed-e2e-users.ts, which global-setup runs. Zero
@@ -22,7 +27,7 @@
 const OTHER_DEPT = 'E2E Electronics';
 
 /** An API context logged in as `role`, for what the UI cannot express. */
-async function apiAs(role: 'principal' | 'hod') {
+async function apiAs(role: 'principal' | 'hod' | 'registrar') {
   const api = await apiRequest.newContext({ baseURL: BACKEND_URL });
   const res = await api.post('/api/auth/login', { data: { email: TEST_USERS[role].email, password: TEST_USERS[role].password } });
   expect(res.ok(), `${role} login`).toBeTruthy();
@@ -91,4 +96,72 @@
       await hod.api.dispose();
     }
   });
+
+  test('the Registrar is offered no Urgent option, and the server refuses Urgent', async ({ page, loginAs }) => {
+    await loginAs('registrar');
+    await page.goto('/communication/notices');
+    await page.getByRole('button', { name: /new notice/i }).click();
+    const drawer = page.getByRole('dialog', { name: 'New notice' });
+    // The hint appears once /targets has answered canPublishUrgent: false.
+    await expect(drawer.getByText('Need Urgent? Ask an IT admin.')).toBeVisible();
+    const priority = drawer.getByRole('group', { name: 'Priority' });
+    await expect(priority.getByRole('radio')).toHaveCount(2);
+    await expect(priority.getByRole('radio', { name: 'Urgent' })).toHaveCount(0);
+
+    // The composer cannot express Urgent for the Registrar, so ask the API directly.
+    const registrar = await apiAs('registrar');
+    try {
+      const refused = await registrar.api.post(NOTICES, {
+        headers: registrar.headers,
+        data: { title: 'E2E refused urgent', body: 'Never published.', audience: { rules: [{ kind: 'all', ids: [] }] }, priority: 'urgent', urgentReason: 'Testing the Urgent gate' },
+      });
+      expect(refused.status()).toBe(403);
+      expect(await refused.json()).toMatchObject({ detail: { code: 'URGENT_NOT_ALLOWED' } });
+    } finally {
+      await registrar.api.dispose();
+    }
+  });
+
+  test('an admin publishes an Urgent, confidential notice with a reason, and the Audit tab records both', async ({ page, loginAs }) => {
+    const title = `E2E urgent ${Date.now()}`;
+    const reason = 'Exam hall changed this morning';
+    await loginAs('principal');
+    await page.goto('/communication/notices');
+    await page.getByRole('button', { name: /new notice/i }).click();
+    const drawer = page.getByRole('dialog', { name: 'New notice' });
+    await expect(drawer.getByLabel('Publish as')).toHaveValue('College Office');
+    await drawer.getByLabel('Title', { exact: true }).fill(title);
+    await drawer.getByLabel('Notice', { exact: true }).fill('Report to Hall B at 2 pm.');
+
+    await drawer.getByRole('button', { name: /^departments/i }).click();
+    const search = drawer.getByRole('combobox', { name: /search departments/i });
+    await search.fill('E2E Computer');
+    await drawer.getByRole('option', { name: OWN_DEPT }).click();
+    await search.press('Escape');
+    await expect(drawer.getByText(/1 person · 0 on Juvi · 1 not on Juvi yet/)).toBeVisible();
+
+    await drawer.getByRole('radio', { name: 'Urgent' }).check();
+    await drawer.getByLabel('Reason for Urgent').fill(reason);
+    await drawer.getByLabel('Confidential', { exact: true }).check();
+    const tray = drawer.getByRole('region', { name: 'Phone notification preview' });
+    await expect(tray.getByText('New notice from College Office')).toBeVisible();
+    await expect(tray.getByText(title)).toHaveCount(0);
+
+    await drawer.getByRole('button', { name: 'Review and publish' }).click();
+    await expect(drawer.getByRole('heading', { name: 'Publish to 1 person?' })).toBeVisible();
+    await expect(drawer.getByText(`Reason: ${reason}`)).toBeVisible();
+    await drawer.getByRole('button', { name: 'Publish notice' }).click();
+    await expect(page.getByRole('dialog')).toHaveCount(0);
+
+    await page.getByRole('searchbox', { name: /search notices/i }).fill(title);
+    await page.getByRole('button', { name: `Open notice ${title}` }).click();
+    await expect(page.getByRole('heading', { name: title })).toBeVisible();
+    await page.getByRole('link', { name: 'Audit', exact: true }).click();
+    const record = page.getByRole('region', { name: 'Publishing record' });
+    await expect(record.getByText(reason)).toBeVisible();
+    await expect(record.getByText('Yes: the phone notification shows only the office')).toBeVisible();
+    const trail = page.getByRole('table', { name: 'Audit trail' });
+    await expect(trail).toContainText(`Urgent reason: — → ${reason}`);
+    await expect(trail).toContainText('Confidential: — → Yes');
+  });
 });
```

- [ ] **Step 2: Run the tests to verify they fail**

Against a build without Tasks 2–5 (ports 3003 and 5173 free):
Run: `ROOT=<repo> bash /private/tmp/claude-624478678/-Users-srinivasarao-kandula-code-juvion-v2/5e76ad60-8959-4ef0-9f1b-f39b12ef7db1/scratchpad/run-playwright-notif-portal.sh tests/juvi-notices.spec.ts`
Expected: FAIL — the Registrar case cannot find "Need Urgent? Ask an IT admin."; the admin case cannot find "Reason for Urgent". The two existing notices cases pass.

- [ ] **Step 3: Implement**

No new code: Tasks 2–5 are the implementation. With them in place, run the spec alone first.

Run: `ROOT=<repo> bash …/run-playwright-notif-portal.sh tests/juvi-notices.spec.ts`
Expected: PASS (4 tests, zero retries).

- [ ] **Step 4: Full verification**

Run: `npm run typecheck`
Expected: exit 0 (backend, admin-portal, e2e).

Run: `npm run test -w admin-portal`
Expected: PASS — 45 files, 324 tests.

Backend: unchanged by this plan, so `npm run test -w backend` is not required. Confirm with `git diff --stat main -- backend` (empty).

Run (ports 3003 and 5173 free; the harness drops `juvion_v2_notices_e2e`, never `juvion_v2`, and stops both servers on exit): `ROOT=<repo> bash …/run-playwright-notif-portal.sh`
Expected: 42 passed, 5 skipped (baseline 40 passed, 5 skipped, plus the two new cases). Then check nothing is left on the ports: `lsof -iTCP:3003 -iTCP:5173 -sTCP:LISTEN` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/juvi-notices.spec.ts
git commit -m "test(e2e): Urgent gating and an Urgent, confidential publish in the notices portal

The Registrar is offered Routine and Important only, with the hint, and
the server refuses an Urgent publish with URGENT_NOT_ALLOWED. The
principal (DB role admin) publishes an Urgent, confidential notice with
a reason; the tray preview hides the title and the Audit tab records
the reason and the flag.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec item | Where | Task |
|---|---|---|
| §9 Confidential checkbox with the helper text | "Phone notification" fieldset; `confidentialHelp(fromOffice)` | 1, 2 |
| §9 / §6.5 Urgent offered only with `/targets.canPublishUrgent`; otherwise "Need Urgent? Ask an IT admin." | `priorities` filter; `NEED_URGENT_HINT` | 1, 2 |
| §9 / §6.5 Urgent reason: required, 10–300 characters, counter, next to the Urgent note | "Reason for Urgent" textarea, `maxLength`, counter, review validation | 1, 2 |
| §6.5 `403 URGENT_NOT_ALLOWED` mapped to a clear message | `isUrgentNotAllowed` / `publishErrorMessage`; `/targets` refetched; `chosenPriority` | 1, 2 |
| §7.5 publish accepts `confidential` and `urgentReason` | `PublishNoticeInput`; composer payload | 2 |
| §9 / §6.6 phone-tray preview: office + title, confidential wording, Routine silent | `trayNotification`, `TRAY_ALERT`, `NotificationTrayPreview` | 1, 3 |
| §7.4 / §9 Reach Delivery row next to the counts | `DeliveryRow` ("Notification delivery") | 1, 4 |
| §7.4 / §9 pending delivery column with the §9 words and "—" | `PENDING_DELIVERY_LABELS`; "Delivery" column | 1, 4 |
| §9 CSV export gains the same column | already served by Plan 1 (`reach-service.ts:260-284`); the existing Export CSV button downloads it | — |
| §9 Audit tab shows the Urgent reason and the Confidential flag | `PublishingRecord`; Yes/No in the trail | 5 |
| §12 Vitest: Urgent hidden without `canPublishUrgent`; reason required; confidential tray preview; delivery column | `NoticeComposer.test.tsx`, `NotificationTrayPreview.test.tsx`, `ReachTab.test.tsx` | 2, 3, 4 |
| §12 Playwright: the registrar is offered no Urgent option | `juvi-notices.spec.ts` case 3 (UI and API 403) | 6 |
| Lead: an admin or principal publishes Urgent with a reason | `juvi-notices.spec.ts` case 4 (principal = DB role admin) | 6 |
| Types and services for the new fields | `services/notices.ts` | 1, 2 |

## Self-review

- **Spec coverage:** every §9 item maps to a task above; the CSV column needed no portal change (Plan 1 Ruling 18). Nothing in §9 is left without a task.
- **Placeholders:** none. Every code step is the exact diff or file the dry run applied and tested; `<repo>` in the harness commands is the checkout being verified.
- **Type consistency:** `DeliveryCounts`, `PendingDelivery`, `canPublishUrgent`, `confidential`, `urgentReason` are named as the backend names them (`notices/schemas.ts`, `admin-service.ts`, `admin-controller.ts`). `chosenPriority`, `fromOffice` and `confidential` are defined in Task 2 and read in Task 3. `PublishingRecordValues` is defined and consumed in Task 5 only.
- **Review Focus:** each of the five lines has its test in the owning task (Tasks 2–5).
- **Known limits, left for later:**
  - The tray preview draws the Android layout only; iOS is sub-project 7 (spec §3).
  - "Copy pending list" carries no delivery state (Ruling 12).
  - Plan 3 must render exactly the `trayNotification` strings (Ruling 2); nothing enforces that across the two codebases beyond this plan and the spec.

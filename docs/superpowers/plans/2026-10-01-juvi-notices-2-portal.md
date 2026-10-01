# Juvi Notices — Plan 2 of 3: ERP Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ERP publishers and admins the portal side of Juvi notices: a `/communication/notices` list, an embeddable `<NoticeComposer />` drawer with a scoped audience builder and a live count, a notice detail page with Reach, Audit and Delivery tabs, banners on the legacy Announcements and Circulars pages, and a Welcome notice section in the `/platform/juvi` Settings tab.

**Architecture:** The portal talks only to the Plan 1 admin API under `/api/juvi-app/admin/notices` (ERP `authenticate` → `authorize('notices', …)`, ERP error shape). Four small backend gaps are closed first, each with tests: `notices` permissions never reached the browser, `/targets` lacked the office list and the college timezone, the list could not filter by purpose, and a `custom` rule had no way to pick people without raw ids. The portal adds a `Communication` hub route gated on `notices:read`, a cross-cutting sidebar item, a typed service client, pure helpers (labels, college-timezone dates, error messages), a shared dialog-focus hook used by `Modal` and the new `Drawer`, and the notice components under `components/communication/`. One Playwright spec runs the office-publish and HOD-refusal journeys against the live stack, on a seed extended with an HOD and two departments.

**Tech Stack:** Express 4, Zod 3, Mongoose 8 (backend); React 19, React Router 7, React Query 5, Zustand 5, Tailwind 3, lucide-react, axios 1.7, vitest 4 + Testing Library 16 (portal); Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-09-26-juvi-notices-design.md` §8 (ERP portal), §12 (portal and e2e testing), §13 item 2, US-1 and US-4 (ERP side). Depends on Plan 1 (`docs/superpowers/plans/2026-09-26-juvi-notices-1-backend.md`), which is merged into `main`.

## Global Constraints

Values copied from the spec, the Plan 1 code and the root `CLAUDE.md`. Every task honours all of them.

- **Limits** (spec §5, `backend/src/models/juvi/Notice.ts`): title ≤ 120 characters; body ≤ 5000 characters, plain text; at most 5 attachments, each ≤ 10 MB (`10 * 1024 * 1024` bytes); at most 2 reminders per notice; an acknowledgement comment ≤ 500 characters; at most 20 audience rules.
- **Attachment MIME list** (spec §6.1): PDF, PNG, JPEG, WEBP, DOCX, XLSX or PPTX, exactly:
  `application/pdf`, `image/png`, `image/jpeg`, `image/webp`,
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  `application/vnd.openxmlformats-officedocument.presentationml.presentation`.
  Upload returns 503 when S3 is unconfigured, and publishing without attachments still works (spec §11).
- **Acknowledgement rules** (spec §5, `admin-schemas.ts publishSchema`): a deadline requires `ackRequired`; comments are allowed only with `ackRequired`; the deadline must be in the future. The deadline is entered as a date and time **in the college timezone** (`College.juvi.timezone`, default `Asia/Kolkata`).
- **Priority** (spec §5): `routine`, `important`, `urgent`. The Urgent note reads: **"Urgent bypasses quiet hours once push arrives."** Push is sub-project 3, so nothing in this plan enforces it.
- **Immutability** (US-1.4): a published notice cannot be edited. Archive is the only change allowed. There is no edit UI.
- **Reach** (spec §6.5, US-4): acknowledged + seen-not-acknowledged + not seen + Not on Juvi = snapshot size (`counts.audience`). Added-later members are reported separately and never as pending. Reach is visible to the publisher and admins only; the CSV export and "Retry delivery" are admin only. Admins are the roles `admin`, `super_admin` and `principal` (`publisher-scope.ts ADMIN_ROLES`).
- **Scope** (spec §1, §7.3): the composer offers only what `GET /targets` returns; the server enforces the same scope and answers 403 otherwise. The composer never shows a raw id.
- **ERP error shape** (Plan 1, Foundation admin console): `{ error: string }`; a Zod failure is `{ error: 'Validation failed', details: [{ path, message }] }`; some 409s add `detail` (a REMINDER_LIMIT 409 carries `detail.reminders`). **The bodies carry no machine-readable code, so the UI branches on HTTP status only and shows the server's `error` text verbatim** (for a Zod 400, the joined `details[].message`). It never matches on message text.
- **Mutations** (root `CLAUDE.md`, Juvi admin console paragraph): every `useMutation` wraps its service call, because React Query 5.96 passes a second argument (`mutationFn: (x) => svc(x)`, never `mutationFn: svc`), and opts out of the global toast cache with `meta: { silent: true, silentError: true }` whenever the component toasts or renders the result itself.
- **Frontend conventions** (root `CLAUDE.md`): React Query for server state, `useAuthStore((s) => s.hasPermission(module, action))` for permissions, Tailwind, `lucide-react`, `toast` from `stores/toastStore`, `confirmAction` from `stores/confirmStore`. Local CSS constants where a file needs them (they are not exported anywhere):
  `const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';`
  `const lbl = 'block text-sm font-medium text-gray-700 mb-1';`
- **Accessibility** (spec §8): every control has a label; chips and dropdowns are keyboard operable (Enter/Space, arrows, Escape returns focus to the chip); the drawer traps focus, closes on Escape, and hands focus back to its trigger.
- **Portal tests:** `renderWithProviders` from `src/__tests__/test-utils.tsx`, services mocked with `vi.mock`, accessible queries (`getByRole`, `getByLabelText`). The portal has no ESLint config or dependency (`npm run lint -w admin-portal` fails on `main` with "couldn't find an eslint.config"), so the gates per task are `npm run typecheck` and the portal and backend test suites.
- **Playwright:** zero retries, no `waitForTimeout`, accessible selectors, `loginAs(role)` from `e2e/tests/fixtures/auth-fixture.ts`.
- **Commits:** the controller commits after each task. Every message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

**Create**

```
backend/src/modules/juvi-app/notices/people-search.ts                 custom-rule candidates + name search
backend/src/modules/juvi-app/notices/__tests__/people-search.test.ts
backend/src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts  /targets extras, ?purpose, /targets/people

admin-portal/src/services/notices.ts                                  typed client for /juvi-app/admin/notices
admin-portal/src/services/__tests__/notices.test.ts
admin-portal/src/lib/notices.ts                                       limits, labels, college-time dates, errors, copy text
admin-portal/src/lib/__tests__/notices.test.ts
admin-portal/src/hooks/useDebouncedValue.ts
admin-portal/src/hooks/__tests__/useDebouncedValue.test.ts
admin-portal/src/components/ui/useDialogFocus.ts                      Escape, Tab trap, scroll lock, focus in/out
admin-portal/src/components/ui/Drawer.tsx
admin-portal/src/components/ui/__tests__/Drawer.test.tsx
admin-portal/src/pages/Communication.tsx                              /communication/* hub routes
admin-portal/src/pages/communication/NoticesPage.tsx                  the list
admin-portal/src/pages/communication/NoticeDetailPage.tsx             header + Reach / Audit / Delivery tabs
admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx
admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx
admin-portal/src/components/communication/TargetPicker.tsx            one chip + scoped searchable listbox
admin-portal/src/components/communication/AudienceBuilder.tsx         chips, tags, live count
admin-portal/src/components/communication/AttachmentsField.tsx        uploads with per-file progress
admin-portal/src/components/communication/NoticeCardPreview.tsx       Juvi card + DeadlineRing
admin-portal/src/components/communication/NoticeComposer.tsx          NoticeComposerForm + NoticeComposer (drawer)
admin-portal/src/components/communication/ReachTab.tsx
admin-portal/src/components/communication/AuditTab.tsx
admin-portal/src/components/communication/DeliveryTab.tsx
admin-portal/src/components/communication/DeadEventsPanel.tsx
admin-portal/src/components/communication/LegacyNoticesBanner.tsx
admin-portal/src/components/communication/__tests__/AudienceBuilder.test.tsx
admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx
admin-portal/src/components/communication/__tests__/ReachTab.test.tsx
admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx
admin-portal/src/components/communication/__tests__/LegacyNoticesBanner.test.tsx
admin-portal/src/components/platform/juvi/WelcomeNoticeSection.tsx
admin-portal/src/components/platform/juvi/__tests__/WelcomeNoticeSection.test.tsx

e2e/tests/juvi-notices.spec.ts
```

**Modify**

```
backend/src/shared/rbac/resolve-permissions.ts            ALL_MODULES gains 'notices'
backend/src/shared/rbac/__tests__/resolve-permissions.test.ts
backend/src/modules/juvi-app/notices/admin-schemas.ts     ?purpose on the list; targetPeopleQuerySchema
backend/src/modules/juvi-app/notices/admin-service.ts     purpose filter; purpose on every row
backend/src/modules/juvi-app/notices/admin-controller.ts  /targets: isAdmin, offices, timezone; targetPeople
backend/src/modules/juvi-app/notices/admin-routes.ts      GET /targets/people
backend/src/scripts/seed-e2e-users.ts                     seedE2ENoticeAudience (HOD + two departments)
backend/src/scripts/__tests__/seed-e2e-users.test.ts

admin-portal/src/App.tsx                                  /communication/* gated on notices:read
admin-portal/src/layouts/DashboardLayout.tsx              Notices nav item (cross-cutting)
admin-portal/src/layouts/__tests__/DashboardLayout.test.ts
admin-portal/src/components/ui/Modal.tsx                  uses useDialogFocus
admin-portal/src/pages/platform/AnnouncementsPage.tsx     legacy banner
admin-portal/src/pages/platform/CircularsPage.tsx         legacy banner
admin-portal/src/services/juvi-app.ts                     welcomeNotice on settings and patch types
admin-portal/src/components/platform/juvi/SettingsTab.tsx mounts WelcomeNoticeSection
admin-portal/src/components/platform/juvi/__tests__/SettingsTab.test.tsx

e2e/tests/utils/test-users.ts                             the `hod` E2E user
```

### Decisions recorded here

- **Backend gaps closed in Tasks 1 and 2.** (a) `resolvePermissions` iterates `ALL_MODULES`, which has no `notices`, so `/auth/me` never emits `notices:*` and `hasPermission('notices', …)` is false for everyone, admins included (`hasPermission` only short-circuits on a literal `*:*`, which is never emitted). (b) `GET /targets` returns no office list, so an admin's office selector would have to hard-code `OFFICE_NAMES`, and it returns no timezone while `/settings` is `platform`-gated (`staff` holds an explicit `platform: *` deny), so an office persona could not learn the college timezone. (c) The list has no `purpose` filter, which the Welcome notice picker needs. (d) A `custom` rule takes person ids and `/targets` returns no people, so the composer could not offer the kind without raw ids; `GET /targets/people?q=` returns names and group labels only, from the same candidate sets `assertAudienceInScope` accepts.
- **The sidebar item is cross-cutting.** `getVisibleNavItems` hides any item whose module is missing from the persona's `accessibleModules`, and no persona lists `notices` (for example `F-HOD` lists `academics, finance, welfare, people`; `ST-REG` lists `people, academics`). Rather than edit every persona's list, the Notices item carries `crossCutting: true` and is shown to anyone who holds `notices:read`.
- **Route.** `/communication/*` is a new hub (`pages/Communication.tsx`), gated with `gated('notices', …)` like every other hub. The detail page is `/communication/notices/:id` with tabs `…/:id` (Reach), `…/:id/audit` and `…/:id/delivery`, using absolute `NavLink` targets as `JuviAdminPage.tsx` does.
- **Dead events** live on the Notices page as an admin-only "Failed deliveries" panel that appears only when there are any; each row links to that notice's Delivery tab, where an admin retries.
- **Dates.** Only the composer's deadline is entered and echoed in the college timezone (from `/targets`). Read-only timestamps elsewhere use `toLocaleString('en-IN')`, as the rest of the portal does, because a read-only staff member cannot call `/targets`.
- **Confirm-to-publish** is a second step inside the drawer (not `confirmAction`), so focus stays in the drawer and the step can show the on-Juvi and not-on-Juvi split.
- **E2E personas.** The seeded Registrar (`staff` / `ST-REG`) is a real office persona (`OFFICE_PERSONAS['ST-REG'] = 'Registrar'`) and publishes college-wide. No HOD is seeded, and the e2e college has no people, so `publishNotice` would refuse any audience with "This audience has no members". Task 10 extends `seed-e2e-users.ts` with two departments, one faculty member in each, and an `e2e_hod` login heading the first. Mocking with `page.route` was rejected: the HOD's scope is resolved from real `Department.hodId` and `Faculty` rows, and a mocked 403 would prove only that the UI renders a canned response, not that the server refuses.

---

### Task 1: Backend: notices permissions reach the browser; `/targets` and the list serve the portal

**Files:**
- Modify: `backend/src/shared/rbac/resolve-permissions.ts`, `backend/src/shared/rbac/__tests__/resolve-permissions.test.ts`
- Modify: `backend/src/modules/juvi-app/notices/admin-schemas.ts`, `admin-service.ts`, `admin-controller.ts`
- Test: `backend/src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts` (create)

**Interfaces:**
- Consumes (Plan 1): `resolvePublisherScope` (`publisher-scope.ts`), `allowedTargets` (`scope.ts`), `loadAudienceGraph` (`audience-graph.ts`), `OFFICE_NAMES` (`offices.ts`), `getJuviConfig` (`config/institution-config.ts`), `NOTICE_PURPOSES` (`models/juvi/Notice.ts`); test factories `createStaffPublisher`, `publishTestNotice` (`__e2e__/factories/notice.factory.ts`), `enableJuvi` (`juvi.factory.ts`), `createTestStudent`.
- Produces:
  ```ts
  // resolve-permissions.ts
  export const ALL_MODULES: readonly [..., 'juvi', 'notices'];   // so /auth/me emits notices:read|create|update|…
  // GET /api/juvi-app/admin/notices/targets now returns
  { office: string; isAdmin: boolean; offices: string[]; timezone: string } & AudienceTargets
  // GET /api/juvi-app/admin/notices?purpose=standard|welcome  (adminNoticeListQuerySchema.purpose)
  // AdminNoticeRow gains   purpose: 'standard' | 'welcome'   (AdminNoticeDetail inherits it)
  ```

- [ ] **Step 1: Write the failing tests**

In `backend/src/shared/rbac/__tests__/resolve-permissions.test.ts`, the super-admin test now counts 14 modules. Replace

```ts
    // 13 modules x 5 actions = 65 permissions. `approve` joined the CRUD
    // four so the frontend can detect grants on routes that gate on it —
    // re-pin and bulk-pin both do, and while it was unemitted those buttons
    // had to fall back to role checks that disagreed with the backend.
    expect(result).toHaveLength(65);
```

with

```ts
    // 14 modules x 5 actions = 70 permissions. `approve` joined the CRUD
    // four so the frontend can detect grants on routes that gate on it —
    // re-pin and bulk-pin both do, and while it was unemitted those buttons
    // had to fall back to role checks that disagreed with the backend.
    expect(result).toHaveLength(70);
```

add `expect(result).toContain('notices:create');` directly under `expect(result).toContain('juvi:read');`, and in the "excludes denied permissions" test replace

```ts
    // 65 total minus 1 denied = 64
    expect(result).toHaveLength(64);
```

with

```ts
    // 70 total minus 1 denied = 69
    expect(result).toHaveLength(69);
```

Then add this block directly above `describe('resolvePermissions — 010 sub-domain qualified strings', () => {`:

```ts
describe('resolvePermissions — Juvi notices', () => {
  it('emits notices grants, so the portal can show the Notices area to the personas that publish', async () => {
    mockedLoadPolicies.mockResolvedValue([
      { role: 'staff', personaType: 'ST-REG', module: 'notices', action: 'create', effect: 'allow', priority: 750, isActive: true },
      { role: 'staff', module: 'notices', action: 'read', effect: 'allow', priority: 700, isActive: true },
    ]);
    const result = await resolvePermissions('c1', 'staff', ['ST-REG']);
    expect(result).toEqual(expect.arrayContaining(['notices:read', 'notices:create']));
    expect(result).not.toContain('notices:update');
  });
});
```

Create the integration test:

```ts
// backend/src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts
/**
 * What the portal composer and the welcome-notice setting need from the admin
 * notices API (notices spec §8): offices, isAdmin and the college timezone on
 * /targets, the purpose filter on the list, and the people search that feeds
 * the composer's `custom` picker.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { enableJuvi } from '../factories/juvi.factory';
import { createStaffPublisher, publishTestNotice } from '../factories/notice.factory';
import { drainOutbox } from '../../shared/outbox';

process.env.E2E_TESTING = '1';

let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin/notices';

beforeAll(async () => { api = createTestApi(await getTestApp()); });
beforeEach(async () => {
  await drainOutbox(); await cleanupTestApp(); fx = await seedBase();
  await enableJuvi(fx.collegeId, { timezone: 'Asia/Dubai' });
});
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

describe('GET /targets for the composer', () => {
  it('gives an admin every office, isAdmin and the college timezone', async () => {
    const res = await api.as(fx.admin.token).get(`${A}/targets`).expect(200);
    expect(res.body).toMatchObject({ office: 'College Office', isAdmin: true, timezone: 'Asia/Dubai' });
    expect(res.body.offices).toEqual(expect.arrayContaining(['College Office', "Principal's Office", 'Exam Section', 'Registrar']));
  });

  it('gives an office persona only its own office', async () => {
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const res = await api.as(exam.token).get(`${A}/targets`).expect(200);
    expect(res.body).toMatchObject({ office: 'Exam Section', offices: ['Exam Section'], isAdmin: false, timezone: 'Asia/Dubai' });
  });
});

describe('GET / ?purpose=', () => {
  it('filters by purpose and returns purpose on every row', async () => {
    await createTestStudent(fx.collegeId, { batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    const standard = await publishTestNotice(fx);
    const welcome = await publishTestNotice(fx, { title: 'Welcome to JIT', purpose: 'welcome', ackRequired: true, audience: { rules: [{ kind: 'role', ids: ['student'] }] } });

    const res = await api.as(fx.admin.token).get(`${A}?purpose=welcome&status=published`).expect(200);
    expect(res.body.items.map((r: { id: string }) => r.id)).toEqual([String(welcome._id)]);
    expect(res.body.items[0].purpose).toBe('welcome');
    const all = await api.as(fx.admin.token).get(A).expect(200);
    expect(all.body.items.find((r: { id: string }) => r.id === String(standard._id)).purpose).toBe('standard');
    await api.as(fx.admin.token).get(`${A}?purpose=other`).expect(400);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/shared/rbac/__tests__/resolve-permissions.test.ts`
Expected: FAIL: `expected [ …65 items ] to have a length of 70`, and the notices test fails on `expect.arrayContaining(['notices:read', 'notices:create'])`.

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts`
Expected: FAIL: the `/targets` tests miss `isAdmin`, `offices` and `timezone`; the purpose test gets two rows back for `?purpose=welcome` (the param is stripped) and `undefined` for `items[0].purpose`.

- [ ] **Step 3: Implement**

`backend/src/shared/rbac/resolve-permissions.ts`: append `'notices'` to `ALL_MODULES`:

```ts
export const ALL_MODULES = [
  'admissions',
  'people',
  'academics',
  'finance',
  'hr',
  'welfare',
  'placement',
  'campus',
  'student-dev',
  'compliance',
  'governance',
  'platform',
  'juvi',
  'notices',
] as const;
```

`backend/src/modules/juvi-app/notices/admin-schemas.ts`: add `purpose` to the list query (`NOTICE_PURPOSES` and `tuple` are already imported in this file):

```ts
export const adminNoticeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['publishing', 'published', 'archived']).optional(),
  purpose: z.enum(tuple(NOTICE_PURPOSES)).optional(),
  office: z.string().trim().min(1).max(60).optional(),
  q: z.string().trim().max(80).optional(),
});
```

`backend/src/modules/juvi-app/notices/admin-service.ts`: `purpose` moves from the detail onto every row, and the list filters on it.

```ts
export interface AdminNoticeRow {
  id: string; title: string; office: string; audienceLine: string; status: LeanNotice['status']; purpose: LeanNotice['purpose']; delivery: DeliveryView;
  publishedAt: string | null; createdAt: string; ackRequired: boolean; deadline: string | null; deadlineState: 'none' | 'open' | 'passed';
  counts: { audience: number; onJuvi: number }; acknowledged: number; seen: number; reminders: Reminders; isMine: boolean;
}
export interface AdminNoticeDetail extends AdminNoticeRow {
  body: string; attachments: INoticeAttachment[]; audience: { rules: IAudienceRule[]; line: string };
  ackCommentAllowed: boolean; priority: LeanNotice['priority']; archivedAt: string | null; canManage: boolean;
}
```

In `row()`, the first line of the returned object becomes

```ts
    id: String(n._id), title: n.title, office: n.publisher.office, audienceLine: n.audience.line, status: n.status, purpose: n.purpose,
```

in `getAdminNotice()`, the detail line drops its now-inherited `purpose`:

```ts
    ackCommentAllowed: n.ackCommentAllowed, priority: n.priority, archivedAt: iso(n.archivedAt),
```

and in `listAdminNotices()`, directly under `if (q.office) filter['publisher.office'] = q.office;`:

```ts
  if (q.purpose) filter.purpose = q.purpose;
```

`backend/src/modules/juvi-app/notices/admin-controller.ts`: add two imports under `import { pendingQuerySchema } from './schemas';`

```ts
import { OFFICE_NAMES } from './offices';
import { getJuviConfig } from '../config/institution-config';
```

and replace the `targets` handler:

```ts
export async function targets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const scope = await resolvePublisherScope(cid(req), userRef(req));
    const [graph, cfg] = await Promise.all([loadAudienceGraph(cid(req)), getJuviConfig(cid(req))]);
    res.json({
      office: scope.office,
      isAdmin: scope.isAdmin,
      // Admins choose the office (spec §5); everyone else publishes from the one their persona gives.
      offices: scope.isAdmin ? [...OFFICE_NAMES] : scope.office ? [scope.office] : [],
      // The composer's deadline is entered in college time (spec §8), and /settings is platform-gated.
      timezone: cfg?.timezone ?? 'Asia/Kolkata',
      ...allowedTargets(scope, graph),
    });
  } catch (e) { next(e); }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/shared/rbac/__tests__/resolve-permissions.test.ts`
Expected: PASS (6 tests).

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts`
Expected: PASS (both files; the existing admin suite still matches its `toMatchObject` rows and details).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/shared/rbac/resolve-permissions.ts backend/src/shared/rbac/__tests__/resolve-permissions.test.ts backend/src/modules/juvi-app/notices/admin-schemas.ts backend/src/modules/juvi-app/notices/admin-service.ts backend/src/modules/juvi-app/notices/admin-controller.ts backend/src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts
git commit -m "feat(juvi-app): serve the notices portal: permissions, offices, timezone, purpose filter

/auth/me now emits notices:* (ALL_MODULES had no notices, so no browser
could ever see a notices grant). GET /targets adds isAdmin, the office list
and the college timezone; the list filters by purpose and returns it per row.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Backend: `GET /targets/people` for the composer's People picker

**Files:**
- Create: `backend/src/modules/juvi-app/notices/people-search.ts`
- Modify: `backend/src/modules/juvi-app/notices/admin-schemas.ts`, `admin-controller.ts`, `admin-routes.ts`
- Test: `backend/src/modules/juvi-app/notices/__tests__/people-search.test.ts` (create), `backend/src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts` (extend)

**Interfaces:**
- Consumes (Plan 1): `AudienceGraph`, `PersonNode`, `groupLabel` (`audience.ts`), `loadAudienceGraph`, `PublisherScope`, `assertAudienceInScope` (`scope.ts`), `graphFixture`, `ids` (`__tests__/graph-fixture.ts`), `makeHod` (`notice.factory.ts`).
- Produces:
  ```ts
  // people-search.ts
  export interface PersonOption { id: string; label: string; hint: string }   // id = Person _id; hint = groupLabel()
  export function customCandidates(scope: PublisherScope, g: AudienceGraph): PersonNode[];
  export async function searchCustomPeople(collegeId: string, scope: PublisherScope, q: string, limit: number): Promise<{ items: PersonOption[] }>;
  // admin-schemas.ts
  export const targetPeopleQuerySchema;   // { q: string (≤ 80, default ''), limit: 1..50 (default 20) }
  // GET /api/juvi-app/admin/notices/targets/people?q=&limit=   authorize('notices','create')  → { items: PersonOption[] }
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/modules/juvi-app/notices/__tests__/people-search.test.ts
import { describe, it, expect } from 'vitest';
import { customCandidates } from '../people-search';
import { assertAudienceInScope, PublisherScope } from '../scope';
import { graphFixture, ids } from './graph-fixture';

const g = graphFixture();
const scope = (p: Partial<PublisherScope>): PublisherScope => ({ kind: 'none', userId: 'u', office: 'X', isAdmin: false, offeringIds: [], ...p });

describe('customCandidates (the composer\'s People picker)', () => {
  it('offers college offices everyone', () => {
    expect(ids(customCandidates(scope({ kind: 'college' }), g)).sort()).toEqual(['f1', 'f2', 'hod1', 's1', 's2', 's3', 'st1', 'st2']);
  });

  it('offers an HOD only people in their department', () => {
    expect(ids(customCandidates(scope({ kind: 'department', departmentId: 'cse' }), g)).sort()).toEqual(['f1', 'hod1', 's1', 's3', 'st2']);
    expect(customCandidates(scope({ kind: 'department' }), g)).toEqual([]);
  });

  it('offers teaching faculty only students enrolled in the offerings they teach', () => {
    expect(ids(customCandidates(scope({ kind: 'offerings', offeringIds: ['o1'] }), g))).toEqual(['s1']);
  });

  it('offers nobody to anyone else', () => {
    expect(customCandidates(scope({ kind: 'none' }), g)).toEqual([]);
  });

  it('never offers a person the publish scope check would refuse', () => {
    for (const s of [scope({ kind: 'department', departmentId: 'cse' }), scope({ kind: 'offerings', offeringIds: ['o1', 'o3'] })]) {
      const people = ids(customCandidates(s, g));
      expect(people.length).toBeGreaterThan(0);
      expect(() => assertAudienceInScope(s, [{ kind: 'custom', ids: people }], g)).not.toThrow();
    }
  });
});
```

In `backend/src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts`, change the factory import to

```ts
import { createStaffPublisher, makeHod, publishTestNotice } from '../factories/notice.factory';
```

and append:

```ts
describe('GET /targets/people (custom rules)', () => {
  const label = (p: { label: string }) => p.label;

  it('searches people by name within the publisher scope', async () => {
    await createTestStudent(fx.collegeId, { name: 'Asha Rao', batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    await createTestStudent(fx.collegeId, { name: 'Asha Iyer', batchId: String(fx.batch._id), branchId: String(fx.eceBranch._id) });

    const all = await api.as(fx.admin.token).get(`${A}/targets/people?q=asha`).expect(200);
    expect(all.body.items.map(label)).toEqual(['Asha Iyer', 'Asha Rao']);
    expect(all.body.items[0]).toEqual({ id: expect.stringMatching(/^[0-9a-f]{24}$/), label: 'Asha Iyer', hint: '2024 Batch' });

    const hod = await makeHod(fx, fx.cse);
    const mine = await api.as(hod.token).get(`${A}/targets/people?q=asha`).expect(200);
    expect(mine.body.items.map(label)).toEqual(['Asha Rao']);
  });

  it('treats the search text literally and refuses callers who cannot publish', async () => {
    const student = await createTestStudent(fx.collegeId, { name: 'Ravi (Kumar)', batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    const res = await api.as(fx.admin.token).get(`${A}/targets/people?q=${encodeURIComponent('(Kumar')}`).expect(200);
    expect(res.body.items.map(label)).toEqual(['Ravi (Kumar)']);
    const refused = await api.as(student.token).get(`${A}/targets/people?q=a`).expect(403);
    expect(refused.body).toEqual({ error: 'You cannot publish notices.' });
  });
});
```

(The e2e harness runs with `RBAC_ENFORCE=false`, so the student's 403 comes from the service's own `none`-scope refusal, which is the row-level check this endpoint must have regardless of policy.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/notices/__tests__/people-search.test.ts`
Expected: FAIL: `Failed to resolve import "../people-search"`.

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts`
Expected: FAIL: the two new tests get 404 `{ error: 'Not found' }` from the admin router's catch-all (no route matches the two-segment `/targets/people` yet).

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/notices/people-search.ts
/**
 * The people a publisher may name in a `custom` rule (spec §7.3), for the
 * portal composer's searchable picker (spec §8: no raw ids). The candidate
 * sets are exactly the ones assertAudienceInScope accepts for `custom`, so the
 * picker never offers someone the publish would refuse. Only names and group
 * labels leave the server (spec §10).
 */
import { Types } from 'mongoose';
import { AppError } from '../../../middleware/errorHandler';
import { Person } from '../../../models/people/Person';
import { AudienceGraph, PersonNode, groupLabel } from './audience';
import { loadAudienceGraph } from './audience-graph';
import { PublisherScope } from './scope';

export interface PersonOption { id: string; label: string; hint: string }

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** college: everyone · department: people in the HOD's department · offerings: students enrolled in them · none: nobody. */
export function customCandidates(scope: PublisherScope, g: AudienceGraph): PersonNode[] {
  const people = [...g.people.values()];
  switch (scope.kind) {
    case 'college': return people;
    case 'department': return scope.departmentId ? people.filter((p) => p.departmentId === scope.departmentId) : [];
    case 'offerings': {
      const mine = new Set(scope.offeringIds);
      return people.filter((p) => p.kind === 'student' && p.offeringIds.some((o) => mine.has(o)));
    }
    default: return [];
  }
}

/** Candidates whose name contains `q` (case-insensitive), alphabetical, at most `limit`. */
export async function searchCustomPeople(collegeId: string, scope: PublisherScope, q: string, limit: number): Promise<{ items: PersonOption[] }> {
  if (scope.kind === 'none') throw new AppError(403, 'You cannot publish notices.');
  const candidates = new Map(customCandidates(scope, await loadAudienceGraph(collegeId)).map((p) => [p.personId, p]));
  if (candidates.size === 0) return { items: [] };
  const filter: Record<string, unknown> = { collegeId, _id: { $in: [...candidates.keys()].map((id) => new Types.ObjectId(id)) } };
  const needle = q.trim();
  if (needle) filter.name = { $regex: escapeRegex(needle), $options: 'i' };
  const rows = await Person.find(filter).select('_id name').sort({ name: 1 }).limit(limit).lean();
  return {
    items: rows.map((r) => {
      const p = candidates.get(String(r._id))!;
      return { id: String(r._id), label: r.name, hint: groupLabel(p.kind, p.labels) };
    }),
  };
}
```

`backend/src/modules/juvi-app/notices/admin-schemas.ts`: add directly above `export const deadEventsQuerySchema`:

```ts
/** The composer's People picker (`custom` rules). */
export const targetPeopleQuerySchema = z.object({
  q: z.string().trim().max(80).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
```

`backend/src/modules/juvi-app/notices/admin-controller.ts`: extend the schemas import and add the people-search import:

```ts
import { publishSchema, audiencePreviewSchema, adminNoticeListQuerySchema, deadEventsQuerySchema, targetPeopleQuerySchema } from './admin-schemas';
import { searchCustomPeople } from './people-search';
```

and add the handler directly above `export async function deadEvents(`:

```ts
export async function targetPeople(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const q = targetPeopleQuerySchema.parse(req.query);
    const scope = await resolvePublisherScope(cid(req), userRef(req));
    res.json(await searchCustomPeople(cid(req), scope, q.q, q.limit));
  } catch (e) { next(e); }
}
```

`backend/src/modules/juvi-app/notices/admin-routes.ts`: directly under the `/targets` route:

```ts
noticesAdminRouter.get('/targets/people', authorize('notices', 'create'), ctrl.targetPeople);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/modules/juvi-app/notices/__tests__/people-search.test.ts`
Expected: PASS (5 tests).

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts`
Expected: PASS (5 tests).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/notices/people-search.ts backend/src/modules/juvi-app/notices/__tests__/people-search.test.ts backend/src/modules/juvi-app/notices/admin-schemas.ts backend/src/modules/juvi-app/notices/admin-controller.ts backend/src/modules/juvi-app/notices/admin-routes.ts backend/src/__e2e__/modules/juvi-app-admin-notices-portal.e2e.test.ts
git commit -m "feat(juvi-app): GET /notices/targets/people for custom audience rules

Returns names and group labels from exactly the candidate sets
assertAudienceInScope accepts, so the composer can offer the People kind
without ever showing a raw id.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Portal: notices service client, helpers and a debounce hook

**Files:**
- Create: `admin-portal/src/services/notices.ts`, `admin-portal/src/lib/notices.ts`, `admin-portal/src/hooks/useDebouncedValue.ts`
- Test: `admin-portal/src/services/__tests__/notices.test.ts`, `admin-portal/src/lib/__tests__/notices.test.ts`, `admin-portal/src/hooks/__tests__/useDebouncedValue.test.ts`

**Interfaces:**
- Consumes: `api` (`services/api.ts`, the axios instance that attaches `Authorization` and `x-college-id`), `Paginated` (`services/juvi-app.ts`), `extractErrorMessage` (`lib/errors.ts`); Tasks 1–2 endpoints.
- Produces (used by every later task):
  ```ts
  // services/notices.ts — types mirror backend admin-service.ts / schemas.ts exactly
  type AudienceRuleKind, NoticePriority, NoticePurpose, NoticeStatus, DeliveryState, ReachState;
  interface AudienceRule, NoticeAttachment, Reminders, DeliveryView, NoticeRow, NoticeDetail, NoticeListQuery,
            TargetOption, NoticeTargets, PersonOption, AudiencePreview, PublishNoticeInput,
            ReachGroup, ReachPerson, Reach, PendingPerson, PendingQuery, PendingPage, AuditChange, AuditEntry, DeadEvent;
  listNotices(q) · getNotice(id) · getNoticeTargets() · searchNoticePeople(q) · previewAudience(rules, office?)
  uploadNoticeAttachment(file, onProgress?) · publishNotice(input) · getReach(id) · getPending(id, q?) · getAllPending(id, q?)
  downloadReachCsv(id) → { blob, filename } · getNoticeAudit(id) · remindNotice(id) · archiveNotice(id)
  retryNoticeDelivery(id) · listDeadEvents(page?, limit?)
  // lib/notices.ts
  NOTICE_TITLE_MAX = 120 · NOTICE_BODY_MAX = 5000 · NOTICE_ATTACHMENTS_MAX = 5 · NOTICE_ATTACHMENT_MAX_BYTES · NOTICE_ATTACHMENT_MIMES · NOTICE_ATTACHMENT_ACCEPT
  isNoticeAdmin(role) · KIND_ORDER · KIND_LABELS · ROLE_LABELS · roleLabel(id) · PRIORITY_LABELS · URGENT_NOTE · PENDING_STATE_LABELS
  zonedLocalToIso(local, tz) · isoToZonedLocal(iso, tz) · formatInZone(iso, tz) · formatWhen(iso) · formatBytes(n)
  errorStatus(err) · noticeErrorMessage(err, fallback?) · errorDetail<T>(err)
  noticeStatus(row) → { label, variant } · deadlineText(row) · countsText(row) · pendingAsText(title, people)
  // hooks/useDebouncedValue.ts
  useDebouncedValue<T extends primitive>(value: T, ms: number): T
  ```

The college-timezone conversion uses `Intl.DateTimeFormat#formatToParts` (no new dependency; `date-fns` 4 has no zone support without `date-fns-tz`). `noticeErrorMessage` is the single place the ERP body is read; screens branch on `errorStatus()` and print this text.

- [ ] **Step 1: Write the failing tests**

```ts
// admin-portal/src/services/__tests__/notices.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../api';
import { listNotices, previewAudience, uploadNoticeAttachment, getAllPending, downloadReachCsv, searchNoticePeople, publishNotice } from '../notices';

const BASE = '/juvi-app/admin/notices';
beforeEach(() => vi.clearAllMocks());

describe('notices service', () => {
  it('listNotices drops empty filters', async () => {
    (api.get as any).mockResolvedValue({ data: { items: [], total: 0, page: 1, pages: 1 } });
    await listNotices({ page: 1, limit: 20, q: '', office: undefined, status: 'published' });
    expect(api.get).toHaveBeenCalledWith(BASE, { params: { page: 1, limit: 20, status: 'published' } });
  });

  it('previewAudience sends the office only when one is chosen', async () => {
    (api.post as any).mockResolvedValue({ data: { total: 1 } });
    await previewAudience([{ kind: 'all', ids: [] }]);
    expect(api.post).toHaveBeenLastCalledWith(`${BASE}/audience-preview`, { rules: [{ kind: 'all', ids: [] }] });
    await previewAudience([{ kind: 'all', ids: [] }], 'Exam Section');
    expect(api.post).toHaveBeenLastCalledWith(`${BASE}/audience-preview`, { rules: [{ kind: 'all', ids: [] }], office: 'Exam Section' });
  });

  it('searchNoticePeople and publishNotice hit their routes', async () => {
    (api.get as any).mockResolvedValue({ data: { items: [] } });
    await searchNoticePeople('asha');
    expect(api.get).toHaveBeenCalledWith(`${BASE}/targets/people`, { params: { q: 'asha' } });
    (api.post as any).mockResolvedValue({ data: { id: 'n1' } });
    const input = { title: 't', body: 'b', attachments: [], audience: { rules: [{ kind: 'all' as const, ids: [] }] }, ackRequired: false, ackCommentAllowed: false, priority: 'routine' as const, purpose: 'standard' as const };
    expect((await publishNotice(input)).id).toBe('n1');
    expect(api.post).toHaveBeenCalledWith(BASE, input);
  });

  it('uploadNoticeAttachment posts multipart and reports progress', async () => {
    (api.post as any).mockImplementation(async (_url: string, _fd: FormData, cfg: any) => {
      cfg.onUploadProgress({ loaded: 50, total: 100 });
      return { data: { key: 'colleges/c/notices/u', name: 'a.pdf', mime: 'application/pdf', size: 100 } };
    });
    const progress: number[] = [];
    const out = await uploadNoticeAttachment(new File(['x'], 'a.pdf', { type: 'application/pdf' }), (p) => progress.push(p));
    expect(out.key).toBe('colleges/c/notices/u');
    expect(progress).toEqual([50]);
    const [url, body, cfg] = (api.post as any).mock.calls[0];
    expect(url).toBe(`${BASE}/attachments`);
    expect(body).toBeInstanceOf(FormData);
    expect(cfg.headers).toEqual({ 'Content-Type': 'multipart/form-data' });
  });

  it('getAllPending follows the cursor until it runs out', async () => {
    (api.get as any)
      .mockResolvedValueOnce({ data: { items: [{ name: 'A' }], total: 2, groups: [], nextCursor: 'c2' } })
      .mockResolvedValueOnce({ data: { items: [{ name: 'B' }], total: 2, groups: [], nextCursor: null } });
    const all = await getAllPending('n1', { q: 'a' });
    expect(all.map((p) => p.name)).toEqual(['A', 'B']);
    expect(api.get).toHaveBeenNthCalledWith(1, `${BASE}/n1/reach/pending`, { params: { q: 'a', limit: 200 } });
    expect(api.get).toHaveBeenNthCalledWith(2, `${BASE}/n1/reach/pending`, { params: { q: 'a', cursor: 'c2', limit: 200 } });
  });

  it('downloadReachCsv returns the blob and the server file name', async () => {
    (api.get as any).mockResolvedValue({ data: new Blob(['x']), headers: { 'content-disposition': 'attachment; filename="notice-reach-abc123.csv"' } });
    const out = await downloadReachCsv('n1');
    expect(api.get).toHaveBeenCalledWith(`${BASE}/n1/reach.csv`, { responseType: 'blob' });
    expect(out.filename).toBe('notice-reach-abc123.csv');
  });
});
```

```ts
// admin-portal/src/lib/__tests__/notices.test.ts
import { describe, it, expect } from 'vitest';
import {
  zonedLocalToIso, isoToZonedLocal, formatInZone, formatBytes, noticeErrorMessage, errorStatus, errorDetail,
  noticeStatus, deadlineText, countsText, pendingAsText, isNoticeAdmin, roleLabel,
} from '../notices';

const httpError = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });
const delivery = (state: 'delivering' | 'delivered' | 'failed') => ({ state, attempts: 0, lastError: null, updatedAt: null });

describe('college-timezone dates', () => {
  it('reads a datetime-local value as wall-clock time in the college zone', () => {
    expect(zonedLocalToIso('2026-10-05T17:00', 'Asia/Kolkata')).toBe('2026-10-05T11:30:00.000Z');
    expect(zonedLocalToIso('2026-07-01T09:00', 'America/New_York')).toBe('2026-07-01T13:00:00.000Z');   // EDT, UTC-4
    expect(zonedLocalToIso('2026-12-01T09:00', 'America/New_York')).toBe('2026-12-01T14:00:00.000Z');   // EST, UTC-5
    expect(() => zonedLocalToIso('5 Oct', 'Asia/Kolkata')).toThrow(/Not a date and time/);
  });

  it('round-trips an instant back to the input value, and formats it in the zone', () => {
    expect(isoToZonedLocal('2026-10-05T11:30:00.000Z', 'Asia/Kolkata')).toBe('2026-10-05T17:00');
    expect(isoToZonedLocal('2026-10-05T18:45:00.000Z', 'Asia/Kolkata')).toBe('2026-10-06T00:15');
    expect(formatInZone('2026-10-05T11:30:00.000Z', 'Asia/Kolkata')).toMatch(/5 Oct 2026/);
    expect(formatInZone('2026-10-05T11:30:00.000Z', 'Asia/Kolkata')).toMatch(/5:00/);
  });
});

describe('formatBytes', () => {
  it('uses B, KB and MB', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB');
  });
});

describe('ERP errors', () => {
  it('shows the server message verbatim and joins Zod field messages', () => {
    expect(noticeErrorMessage(httpError(403, { error: 'You can only send notices to your own department.' }))).toBe('You can only send notices to your own department.');
    expect(noticeErrorMessage(httpError(400, { error: 'Validation failed', details: [{ path: 'title', message: 'Required' }, { path: 'ackDeadline', message: 'The deadline must be in the future' }] })))
      .toBe('Required; The deadline must be in the future');
    expect(noticeErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('exposes the status and the structured detail', () => {
    const err = httpError(409, { error: 'A notice can have at most two reminders.', detail: { reminders: { used: 2, max: 2, lastAt: null } } });
    expect(errorStatus(err)).toBe(409);
    expect(errorDetail<{ reminders: { used: number } }>(err)?.reminders.used).toBe(2);
    expect(errorStatus(new Error('offline'))).toBeUndefined();
    expect(errorDetail(httpError(400, { error: 'x' }))).toBeUndefined();
  });
});

describe('list wording', () => {
  it('names delivery states first, then archive', () => {
    expect(noticeStatus({ status: 'publishing', delivery: delivery('delivering') })).toEqual({ label: 'Delivering…', variant: 'info' });
    expect(noticeStatus({ status: 'publishing', delivery: delivery('failed') })).toEqual({ label: 'Delivery failed', variant: 'danger' });
    expect(noticeStatus({ status: 'published', delivery: delivery('delivered') }).label).toBe('Published');
    expect(noticeStatus({ status: 'archived', delivery: delivery('delivered') }).label).toBe('Archived');
  });

  it('describes deadlines and counts', () => {
    expect(deadlineText({ ackRequired: false, deadline: null, deadlineState: 'none' })).toBe('No acknowledgement');
    expect(deadlineText({ ackRequired: true, deadline: null, deadlineState: 'none' })).toBe('No deadline');
    expect(deadlineText({ ackRequired: true, deadline: '2030-01-01T00:00:00.000Z', deadlineState: 'open' })).toMatch(/^Due /);
    expect(deadlineText({ ackRequired: true, deadline: '2020-01-01T00:00:00.000Z', deadlineState: 'passed' })).toMatch(/^Closed /);
    expect(countsText({ ackRequired: true, acknowledged: 3, seen: 4, counts: { audience: 10, onJuvi: 8 } })).toBe('3 / 4 / 10');
    expect(countsText({ ackRequired: false, acknowledged: 0, seen: 4, counts: { audience: 10, onJuvi: 8 } })).toBe('— / 4 / 10');
  });

  it('knows the admin roles and the role words', () => {
    expect(isNoticeAdmin('principal')).toBe(true);
    expect(isNoticeAdmin('staff')).toBe(false);
    expect(isNoticeAdmin(undefined)).toBe(false);
    expect(roleLabel('student')).toBe('All students');
    expect(roleLabel('ST-EXAM')).toBe('ST-EXAM');
  });
});

describe('pendingAsText', () => {
  it('groups members under their batch or section heading', () => {
    const text = pendingAsText('Exam timetable', [
      { name: 'Asha Rao', identifier: '24JIT0001', group: '2024 Batch · Section A', state: 'not_seen', lastSeenInApp: null },
      { name: 'Ravi Kumar', identifier: null, group: '2024 Batch · Section A', state: 'not_on_juvi', lastSeenInApp: null },
      { name: 'Meera Das', identifier: '24JIT0007', group: '2024 Batch · Section B', state: 'seen', lastSeenInApp: '2026-10-01T04:00:00.000Z' },
    ]);
    const lines = text.split('\n');
    expect(lines.slice(0, 5)).toEqual([
      'Pending for "Exam timetable": 3',
      '',
      '2024 Batch · Section A',
      '- Asha Rao (24JIT0001): Not seen',
      '- Ravi Kumar: Not on Juvi',
    ]);
    expect(lines[6]).toBe('2024 Batch · Section B');
    expect(lines[7]).toMatch(/^- Meera Das \(24JIT0007\): Seen, not acknowledged, last in the app /);
  });
});
```

```ts
// admin-portal/src/hooks/__tests__/useDebouncedValue.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue } from '../useDebouncedValue';

afterEach(() => { vi.useRealTimers(); });

describe('useDebouncedValue', () => {
  it('returns the latest value only after it has been stable for the delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 400), { initialProps: { v: 'a' } });
    expect(result.current).toBe('a');
    rerender({ v: 'ab' });
    act(() => { vi.advanceTimersByTime(300); });
    rerender({ v: 'abc' });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('abc');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/services/__tests__/notices.test.ts src/lib/__tests__/notices.test.ts src/hooks/__tests__/useDebouncedValue.test.ts`
Expected: FAIL: `Failed to resolve import "../notices"` (twice) and `"../useDebouncedValue"`.

- [ ] **Step 3: Implement**

```ts
// admin-portal/src/services/notices.ts
/**
 * notices — admin-portal client for Juvi notices (/api/juvi-app/admin/notices).
 * Spec: docs/superpowers/specs/2026-09-26-juvi-notices-design.md §7.2, §8.
 * ERP error shape: `{ error }`, or `{ error: 'Validation failed', details }`;
 * some 409s add `detail` (lib/notices.ts reads both).
 */
import api from './api';
import type { Paginated } from './juvi-app';

const BASE = '/juvi-app/admin/notices';

export type AudienceRuleKind = 'all' | 'role' | 'department' | 'programme' | 'batch' | 'section' | 'course_offering' | 'hostel_block' | 'custom';
export type NoticePriority = 'routine' | 'important' | 'urgent';
export type NoticePurpose = 'standard' | 'welcome';
export type NoticeStatus = 'publishing' | 'published' | 'archived';
export type DeliveryState = 'delivering' | 'delivered' | 'failed';
export type ReachState = 'acknowledged' | 'seen' | 'not_seen' | 'not_on_juvi';

/** `ids` are ObjectIds, except for `role` (student | faculty | staff | hod, or a persona code). */
export interface AudienceRule { kind: AudienceRuleKind; ids: string[]; departmentId?: string }
export interface NoticeAttachment { key: string; name: string; mime: string; size: number }
export interface Reminders { used: number; max: number; lastAt: string | null }
export interface DeliveryView { state: DeliveryState; attempts: number; lastError: string | null; updatedAt: string | null }

export interface NoticeRow {
  id: string; title: string; office: string; audienceLine: string; status: NoticeStatus; purpose: NoticePurpose; delivery: DeliveryView;
  publishedAt: string | null; createdAt: string; ackRequired: boolean; deadline: string | null; deadlineState: 'none' | 'open' | 'passed';
  counts: { audience: number; onJuvi: number }; acknowledged: number; seen: number; reminders: Reminders; isMine: boolean;
}
export interface NoticeDetail extends NoticeRow {
  body: string; attachments: NoticeAttachment[]; audience: { rules: AudienceRule[]; line: string };
  ackCommentAllowed: boolean; priority: NoticePriority; archivedAt: string | null; canManage: boolean;
}
export interface NoticeListQuery { page: number; limit: number; status?: NoticeStatus; purpose?: NoticePurpose; office?: string; q?: string }

export interface TargetOption { id: string; label: string }
export interface NoticeTargets {
  office: string; offices: string[]; isAdmin: boolean; timezone: string;
  kinds: AudienceRuleKind[]; roles: string[];
  departments: TargetOption[]; programmes: TargetOption[]; batches: TargetOption[]; sections: TargetOption[];
  courseOfferings: TargetOption[]; hostelBlocks: TargetOption[];
}
export interface PersonOption { id: string; label: string; hint: string }
export interface AudiencePreview { total: number; onJuvi: number; notOnJuvi: number; groups: { label: string; total: number; onJuvi: number }[]; line: string }

export interface PublishNoticeInput {
  title: string; body: string; attachments: NoticeAttachment[]; audience: { rules: AudienceRule[] };
  ackRequired: boolean; ackDeadline?: string | null; ackCommentAllowed: boolean;
  priority: NoticePriority; purpose: NoticePurpose; office?: string;
}

export interface ReachGroup { label: string; total: number; acknowledged: number; seen: number; notSeen: number; notOnJuvi: number }
export interface ReachPerson { name: string; identifier: string | null; group: string; at: string | null }
export interface Reach {
  noticeId: string; title: string; status: NoticeStatus; ackRequired: boolean; deadline: string | null; publishedAt: string | null;
  audience: number; acknowledged: number; seen: number; notSeen: number; notOnJuvi: number; dismissed: number; late: number;
  reminders: Reminders; sparkline: number[]; groups: ReachGroup[];
  lateAcks: ReachPerson[];
  comments: (ReachPerson & { comment: string; late: boolean })[];
  addedLater: { total: number; acknowledged: number; seen: number; items: (ReachPerson & { state: ReachState })[] };
  asOf: string;
}
export interface PendingPerson { name: string; identifier: string | null; group: string; state: 'seen' | 'not_seen' | 'not_on_juvi'; lastSeenInApp: string | null }
export interface PendingQuery { group?: string; q?: string; cursor?: string; limit?: number }
export interface PendingPage { items: PendingPerson[]; total: number; groups: { label: string; count: number }[]; nextCursor: string | null }

export interface AuditChange { field: string; displayName?: string; oldValue: unknown; newValue: unknown }
export interface AuditEntry { action: string; entityType: string; performedBy: string; at: string; changes: AuditChange[] }
export interface DeadEvent { id: string; type: string; noticeId: string | null; attempts: number; lastError: string | null; createdAt: string; updatedAt: string | null }

const clean = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;

export const listNotices = (q: NoticeListQuery): Promise<Paginated<NoticeRow>> => api.get(BASE, { params: clean(q) }).then((r) => r.data);
export const getNotice = (id: string): Promise<NoticeDetail> => api.get(`${BASE}/${id}`).then((r) => r.data);
export const getNoticeTargets = (): Promise<NoticeTargets> => api.get(`${BASE}/targets`).then((r) => r.data);
export const searchNoticePeople = (q: string): Promise<{ items: PersonOption[] }> =>
  api.get(`${BASE}/targets/people`, { params: clean({ q }) }).then((r) => r.data);
export const previewAudience = (rules: AudienceRule[], office?: string): Promise<AudiencePreview> =>
  api.post(`${BASE}/audience-preview`, { rules, ...(office ? { office } : {}) }).then((r) => r.data);

export async function uploadNoticeAttachment(file: File, onProgress?: (pct: number) => void): Promise<NoticeAttachment> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post(`${BASE}/attachments`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
  return res.data;
}

export const publishNotice = (input: PublishNoticeInput): Promise<NoticeDetail> => api.post(BASE, input).then((r) => r.data);

export const getReach = (id: string): Promise<Reach> => api.get(`${BASE}/${id}/reach`).then((r) => r.data);
export const getPending = (id: string, q: PendingQuery = {}): Promise<PendingPage> =>
  api.get(`${BASE}/${id}/reach/pending`, { params: clean(q) }).then((r) => r.data);

/** Every pending member, in pages of 200, for "Copy pending list". */
export async function getAllPending(id: string, q: Pick<PendingQuery, 'group' | 'q'> = {}): Promise<PendingPerson[]> {
  const out: PendingPerson[] = [];
  let cursor: string | undefined;
  do {
    const page = await getPending(id, { ...q, cursor, limit: 200 });
    out.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return out;
}

export async function downloadReachCsv(id: string): Promise<{ blob: Blob; filename: string }> {
  const res = await api.get(`${BASE}/${id}/reach.csv`, { responseType: 'blob' });
  const match = /filename="([^"]+)"/.exec(String(res.headers['content-disposition'] ?? ''));
  return { blob: res.data as Blob, filename: match?.[1] ?? 'notice-reach.csv' };
}

export const getNoticeAudit = (id: string): Promise<{ items: AuditEntry[] }> => api.get(`${BASE}/${id}/audit`).then((r) => r.data);
export const remindNotice = (id: string): Promise<{ reminders: Reminders }> => api.post(`${BASE}/${id}/remind`).then((r) => r.data);
export const archiveNotice = (id: string): Promise<{ status: 'archived'; archivedAt: string }> => api.post(`${BASE}/${id}/archive`).then((r) => r.data);
export const retryNoticeDelivery = (id: string): Promise<DeliveryView> => api.post(`${BASE}/${id}/retry-delivery`).then((r) => r.data);
export const listDeadEvents = (page = 1, limit = 20): Promise<Paginated<DeadEvent>> =>
  api.get(`${BASE}/dead-events`, { params: { page, limit } }).then((r) => r.data);
```

```ts
// admin-portal/src/lib/notices.ts
/**
 * Juvi notices: pure helpers shared by the portal's notice screens (spec §8).
 * Limits and the MIME list mirror backend/src/models/juvi/Notice.ts; the
 * admin roles mirror notices/publisher-scope.ts ADMIN_ROLES.
 */
import type { AxiosError } from 'axios';
import { extractErrorMessage } from './errors';
import type { AudienceRuleKind, NoticePriority, NoticeRow, PendingPerson } from '../services/notices';

export const NOTICE_TITLE_MAX = 120;
export const NOTICE_BODY_MAX = 5000;
export const NOTICE_ATTACHMENTS_MAX = 5;
export const NOTICE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
/** PDF, PNG, JPEG, WEBP, DOCX, XLSX, PPTX (spec §6.1). */
export const NOTICE_ATTACHMENT_MIMES: readonly string[] = [
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
export const NOTICE_ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx';

/** Every notice in the college, reach CSV, retry delivery (the server enforces each). */
export const NOTICE_ADMIN_ROLES: readonly string[] = ['admin', 'super_admin', 'principal'];
export const isNoticeAdmin = (role?: string | null): boolean => Boolean(role && NOTICE_ADMIN_ROLES.includes(role));

export const KIND_ORDER: readonly AudienceRuleKind[] = ['all', 'role', 'department', 'programme', 'batch', 'section', 'course_offering', 'hostel_block', 'custom'];
export const KIND_LABELS: Record<AudienceRuleKind, string> = {
  all: 'Everyone', role: 'Roles', department: 'Departments', programme: 'Programmes', batch: 'Batches',
  section: 'Sections', course_offering: 'Courses', hostel_block: 'Hostel blocks', custom: 'People',
};
export const ROLE_LABELS: Record<string, string> = { student: 'All students', faculty: 'All faculty', staff: 'All staff', hod: 'All HODs' };
export const roleLabel = (id: string): string => ROLE_LABELS[id] ?? id;

export const PRIORITY_LABELS: Record<NoticePriority, string> = { routine: 'Routine', important: 'Important', urgent: 'Urgent' };
export const URGENT_NOTE = 'Urgent bypasses quiet hours once push arrives. Until then every notice reaches the app on its next refresh.';

export const PENDING_STATE_LABELS: Record<PendingPerson['state'], string> = { seen: 'Seen, not acknowledged', not_seen: 'Not seen', not_on_juvi: 'Not on Juvi' };

// ── College-timezone dates ──────────────────────────────────────────────

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function zoneParts(utcMs: number, tz: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
}

/** The zone's UTC offset at an instant, in ms (positive east of UTC). */
function offsetMs(utcMs: number, tz: string): number {
  const p = zoneParts(utcMs, tz);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** A `datetime-local` value ("2026-10-05T17:00") read as wall-clock time in `tz`, as an ISO instant. */
export function zonedLocalToIso(local: string, tz: string): string {
  const m = LOCAL_RE.exec(local);
  if (!m) throw new Error(`Not a date and time: ${local}`);
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const first = naive - offsetMs(naive, tz);
  // A second pass settles instants near a DST change, where the offset differs.
  return new Date(naive - offsetMs(first, tz)).toISOString();
}

/** An ISO instant as a `datetime-local` value in `tz`. */
export function isoToZonedLocal(iso: string, tz: string): string {
  const p = zoneParts(new Date(iso).getTime(), tz);
  const two = (n: number | undefined) => String(n ?? 0).padStart(2, '0');
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

/** "5 Oct 2026, 5:00 pm" in `tz`. */
export function formatInZone(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** Read-only timestamps, in the viewer's zone like the rest of the portal. */
export const formatWhen = (iso: string | null | undefined): string =>
  (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── ERP errors ─────────────────────────────────────────────────────────

type ErpErrorBody = { error?: string; details?: { path?: string; message?: string }[]; detail?: unknown };
const bodyOf = (err: unknown): ErpErrorBody | undefined => {
  const data = (err as AxiosError<ErpErrorBody> | undefined)?.response?.data;
  return data && typeof data === 'object' ? data : undefined;
};

/** The HTTP status of a failed call; undefined for a network error or a non-HTTP throw. */
export function errorStatus(err: unknown): number | undefined {
  return (err as AxiosError | undefined)?.response?.status;
}

/**
 * The server's message for a failed notices call, shown verbatim. ERP bodies
 * carry no machine-readable code, so screens branch on errorStatus() and never
 * on this text. A Zod 400 lists its field messages, not "Validation failed".
 */
export function noticeErrorMessage(err: unknown, fallback?: string): string {
  const body = bodyOf(err);
  if (body?.error === 'Validation failed' && Array.isArray(body.details) && body.details.length > 0) {
    return body.details.map((d) => d.message).filter(Boolean).join('; ');
  }
  return extractErrorMessage(err, fallback);
}

/** The structured `detail` some errors carry (a REMINDER_LIMIT 409 carries `{ reminders }`). */
export function errorDetail<T>(err: unknown): T | undefined {
  const detail = bodyOf(err)?.detail;
  return detail && typeof detail === 'object' ? (detail as T) : undefined;
}

// ── List and reach wording ───────────────────────────────────────────────

export function noticeStatus(row: Pick<NoticeRow, 'status' | 'delivery'>): { label: string; variant: 'info' | 'danger' | 'success' | 'default' } {
  if (row.delivery.state === 'failed') return { label: 'Delivery failed', variant: 'danger' };
  if (row.delivery.state === 'delivering') return { label: 'Delivering…', variant: 'info' };
  if (row.status === 'archived') return { label: 'Archived', variant: 'default' };
  return { label: 'Published', variant: 'success' };
}

export function deadlineText(row: Pick<NoticeRow, 'ackRequired' | 'deadline' | 'deadlineState'>): string {
  if (!row.ackRequired) return 'No acknowledgement';
  if (row.deadlineState === 'none' || !row.deadline) return 'No deadline';
  return `${row.deadlineState === 'open' ? 'Due' : 'Closed'} ${formatWhen(row.deadline)}`;
}

/** "acknowledged / seen / total"; acknowledged is a dash when none is asked for. */
export function countsText(row: Pick<NoticeRow, 'ackRequired' | 'acknowledged' | 'seen' | 'counts'>): string {
  return `${row.ackRequired ? row.acknowledged : '—'} / ${row.seen} / ${row.counts.audience}`;
}

/** The pending list as plain text, grouped as the server sorts it (US-4.2: copyable as text). */
export function pendingAsText(title: string, people: PendingPerson[]): string {
  const lines = [`Pending for "${title}": ${people.length}`];
  let group: string | null = null;
  for (const p of people) {
    if (p.group !== group) { group = p.group; lines.push('', group); }
    const id = p.identifier ? ` (${p.identifier})` : '';
    const seen = p.lastSeenInApp ? `, last in the app ${formatWhen(p.lastSeenInApp)}` : '';
    lines.push(`- ${p.name}${id}: ${PENDING_STATE_LABELS[p.state]}${seen}`);
  }
  return lines.join('\n');
}
```

```ts
// admin-portal/src/hooks/useDebouncedValue.ts
import { useEffect, useState } from 'react';

/**
 * `value` once it has stopped changing for `ms`. Pass a primitive (a string
 * key, not a fresh array): a new object on every render would restart the
 * timer forever.
 */
export function useDebouncedValue<T extends string | number | boolean | null | undefined>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/services/__tests__/notices.test.ts src/lib/__tests__/notices.test.ts src/hooks/__tests__/useDebouncedValue.test.ts`
Expected: PASS (3 files, 16 tests).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/services/notices.ts admin-portal/src/lib/notices.ts admin-portal/src/hooks/useDebouncedValue.ts admin-portal/src/services/__tests__/notices.test.ts admin-portal/src/lib/__tests__/notices.test.ts admin-portal/src/hooks/__tests__/useDebouncedValue.test.ts
git commit -m "feat(admin-portal): notices API client and helpers

Typed client for /juvi-app/admin/notices, college-timezone date conversion,
ERP error messages (status-driven, server text verbatim), list and reach
wording, and a primitive-only debounce hook.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Portal: `/communication/notices` route, the Notices sidebar item, and the list

**Files:**
- Create: `admin-portal/src/pages/Communication.tsx`, `admin-portal/src/pages/communication/NoticesPage.tsx`
- Modify: `admin-portal/src/App.tsx`, `admin-portal/src/layouts/DashboardLayout.tsx`
- Test: `admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx` (create), `admin-portal/src/layouts/__tests__/DashboardLayout.test.ts` (modify)

**Interfaces:**
- Consumes: Task 3 (`listNotices`, `getNoticeTargets`, `NoticeRow`, `NoticeStatus`, `countsText`, `deadlineText`, `formatWhen`, `isNoticeAdmin`, `noticeStatus`); `DataTable`, `Badge`, `Pagination`, `SearchInput` (`components/ui/`); `useListControls` (`hooks/`); `useAuthStore`; `gated()` in `App.tsx`; Task 1 (`notices:read` now reaches `permissions`).
- Produces:
  ```ts
  // pages/Communication.tsx — default export; routes: index → notices, "notices" → NoticesPage (Task 7 adds "notices/:id/*")
  // pages/communication/NoticesPage.tsx — default export NoticesPage (Task 6 adds the composer button, Task 8 the dead-events panel)
  // DashboardLayout.tsx — NavItem.crossCutting?: boolean; NAV_ITEMS gains { to: '/communication/notices', label: 'Notices', module: 'notices', crossCutting: true }
  // React Query keys: ['notices', { page, limit, search, status, office }], ['notice-targets']
  ```

The list polls every 3 s while any row is `delivering`, so "Delivering…" turns into counts without a reload. The office filter is offered to admins only, because everyone else sees only their own notices; its options come from `/targets` (Task 1). The server already sorts by `createdAt` desc, so client sorting is off (`disableSort`).

- [ ] **Step 1: Write the failing tests**

```tsx
// admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import NoticesPage from '../NoticesPage';
import { renderWithProviders } from '../../../__tests__/test-utils';

const auth = vi.hoisted(() => ({ role: 'admin', can: true }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { role: auth.role }, hasPermission: () => auth.can }),
}));
vi.mock('../../../services/notices', () => ({ listNotices: vi.fn(), getNoticeTargets: vi.fn() }));
import { listNotices, getNoticeTargets } from '../../../services/notices';

const ROW = {
  id: 'n1', title: 'Exam timetable', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published', purpose: 'standard',
  delivery: { state: 'delivered', attempts: 1, lastError: null, updatedAt: null }, publishedAt: '2026-09-30T04:00:00.000Z', createdAt: '2026-09-30T04:00:00.000Z',
  ackRequired: true, deadline: '2030-01-01T00:00:00.000Z', deadlineState: 'open', counts: { audience: 120, onJuvi: 100 },
  acknowledged: 40, seen: 30, reminders: { used: 0, max: 2, lastAt: null }, isMine: true,
};
const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pages: 1 });
const TARGETS = { office: 'College Office', offices: ['College Office', 'Exam Section'], isAdmin: true, timezone: 'Asia/Kolkata', kinds: [], roles: [], departments: [], programmes: [], batches: [], sections: [], courseOfferings: [], hostelBlocks: [] };

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/communication/notices" element={<NoticesPage />} />
      <Route path="/communication/notices/:id" element={<p>Detail page</p>} />
    </Routes>,
    { route: '/communication/notices' },
  );
}

beforeEach(() => {
  vi.clearAllMocks(); auth.role = 'admin'; auth.can = true;
  (listNotices as Mock).mockResolvedValue(page([ROW]));
  (getNoticeTargets as Mock).mockResolvedValue(TARGETS);
});
afterEach(() => { vi.useRealTimers(); });

describe('NoticesPage', () => {
  it('lists title, office, audience, counts, status and deadline, and opens the detail', async () => {
    renderPage();
    const row = await screen.findByRole('button', { name: /open notice exam timetable/i });
    expect(within(row).getByText('Exam Section')).toBeInTheDocument();
    expect(within(row).getByText('Sent to 2024 Batch')).toBeInTheDocument();
    expect(within(row).getByText('40 / 30 / 120')).toBeInTheDocument();
    expect(within(row).getByText('Published')).toBeInTheDocument();
    expect(within(row).getByText(/^Due /)).toBeInTheDocument();
    fireEvent.click(row);
    expect(await screen.findByText('Detail page')).toBeInTheDocument();
  });

  it('shows Delivering… and Delivery failed', async () => {
    (listNotices as Mock).mockResolvedValue(page([
      { ...ROW, id: 'n2', title: 'Fee notice', status: 'publishing', delivery: { state: 'delivering', attempts: 0, lastError: null, updatedAt: null } },
      { ...ROW, id: 'n3', title: 'Hostel notice', status: 'publishing', delivery: { state: 'failed', attempts: 8, lastError: 'boom', updatedAt: null } },
    ]));
    renderPage();
    expect(await screen.findByText('Delivering…')).toBeInTheDocument();
    expect(screen.getByText('Delivery failed')).toBeInTheDocument();
  });

  it('filters by status and, for admins, by office', async () => {
    renderPage();
    await screen.findByRole('button', { name: /open notice exam timetable/i });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'archived' } });
    await waitFor(() => expect(listNotices).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'archived', page: 1 })));
    fireEvent.change(await screen.findByLabelText('Office'), { target: { value: 'Exam Section' } });
    await waitFor(() => expect(listNotices).toHaveBeenLastCalledWith(expect.objectContaining({ office: 'Exam Section' })));
  });

  it('gives non-admins no office filter', async () => {
    auth.role = 'staff';
    renderPage();
    await screen.findByRole('button', { name: /open notice exam timetable/i });
    expect(screen.queryByLabelText('Office')).toBeNull();
    expect(getNoticeTargets).not.toHaveBeenCalled();
  });

  it('polls while a notice is still delivering', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (listNotices as Mock)
      .mockResolvedValueOnce(page([{ ...ROW, status: 'publishing', delivery: { state: 'delivering', attempts: 0, lastError: null, updatedAt: null }, counts: { audience: 0, onJuvi: 0 }, acknowledged: 0, seen: 0 }]))
      .mockResolvedValue(page([ROW]));
    renderPage();
    expect(await screen.findByText('Delivering…')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3100); });
    expect(await screen.findByText('40 / 30 / 120')).toBeInTheDocument();
    expect(listNotices).toHaveBeenCalledTimes(2);
  });
});
```

Update `admin-portal/src/layouts/__tests__/DashboardLayout.test.ts`: the two `accessibleModules` expectations gain the cross-cutting item, and one test pins the rule:

```diff
--- a/admin-portal/src/layouts/__tests__/DashboardLayout.test.ts
+++ b/admin-portal/src/layouts/__tests__/DashboardLayout.test.ts
@@ -25,16 +25,24 @@
     const canReadAll = () => true;
     const items = getVisibleNavItems(NAV_ITEMS, canReadAll, ['finance']);
     const labels = items.map((i) => i.label);
-    expect(labels).toEqual(['Dashboard', 'Finance']);
+    expect(labels).toEqual(['Dashboard', 'Finance', 'Notices']);
   });
 
   it('restricts sidebar items for Warden via accessibleModules', () => {
     const canReadAll = () => true;
     const items = getVisibleNavItems(NAV_ITEMS, canReadAll, ['welfare', 'campus']);
     const labels = items.map((i) => i.label);
-    expect(labels).toEqual(['Dashboard', 'Welfare', 'Campus Ops']);
+    expect(labels).toEqual(['Dashboard', 'Welfare', 'Campus Ops', 'Notices']);
   });
 
+  it('keeps the cross-cutting Notices item for any persona that may read notices', () => {
+    const hodReads = (m: string) => ['academics', 'people', 'notices'].includes(m);
+    const labels = getVisibleNavItems(NAV_ITEMS, hodReads, ['academics', 'finance', 'welfare', 'people']).map((i) => i.label);
+    expect(labels).toContain('Notices');
+    const noNotices = getVisibleNavItems(NAV_ITEMS, (m) => m === 'academics', ['academics']).map((i) => i.label);
+    expect(noNotices).not.toContain('Notices');
+  });
+
   it('shows full accessible navigation for Leadership when accessibleModules is not set', () => {
     const canReadAll = () => true;
     const items = getVisibleNavItems(NAV_ITEMS, canReadAll, undefined);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/pages/communication src/layouts`
Expected: FAIL: `Failed to resolve import "../NoticesPage"`, and the three changed layout tests fail (`expected [ 'Dashboard', 'Finance' ] to deeply equal [ 'Dashboard', 'Finance', 'Notices' ]`, and `Notices` missing).

- [ ] **Step 3: Implement**

```tsx
// admin-portal/src/pages/Communication.tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import NoticesPage from './communication/NoticesPage';

/**
 * Communication hub (notices spec §8), gated on `notices:read` in App.tsx.
 * The legacy Announcements and Circulars pages stay under Platform.
 */
export default function Communication() {
  return (
    <Routes>
      <Route index element={<Navigate to="notices" replace />} />
      <Route path="notices" element={<NoticesPage />} />
    </Routes>
  );
}
```

```tsx
// admin-portal/src/pages/communication/NoticesPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import SearchInput from '../../components/ui/SearchInput';
import { useListControls } from '../../hooks/useListControls';
import { useAuthStore } from '../../stores/authStore';
import { listNotices, getNoticeTargets, type NoticeRow, type NoticeStatus } from '../../services/notices';
import { countsText, deadlineText, formatWhen, isNoticeAdmin, noticeStatus } from '../../lib/notices';

const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const STATUSES: { value: '' | NoticeStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'publishing', label: 'Delivering' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];
/** While a row is still delivering, refetch until its counts land (spec §11 "Delivering…"). */
const DELIVERING_POLL_MS = 3000;

export default function NoticesPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canCreate = useAuthStore((s) => s.hasPermission('notices', 'create'));
  const admin = isNoticeAdmin(role);
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [status, setStatus] = useState<'' | NoticeStatus>('');
  const [office, setOffice] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['notices', { page, limit, search, status, office }],
    queryFn: () => listNotices({ page, limit, q: search, status: status || undefined, office: office || undefined }),
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.delivery.state === 'delivering') ? DELIVERING_POLL_MS : false),
  });
  // Only admins see other offices' notices, so only they get the office filter.
  const { data: targets } = useQuery({ queryKey: ['notice-targets'], queryFn: getNoticeTargets, enabled: admin && canCreate, staleTime: 5 * 60_000 });

  const columns = [
    {
      key: 'title', label: 'Title',
      render: (r: NoticeRow) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">{r.title}</span>
          {r.purpose === 'welcome' && <Badge variant="teal">Welcome</Badge>}
        </span>
      ),
    },
    { key: 'office', label: 'Office' },
    { key: 'audienceLine', label: 'Audience', render: (r: NoticeRow) => <span className="text-gray-600">{r.audienceLine}</span> },
    { key: 'publishedAt', label: 'Published', render: (r: NoticeRow) => formatWhen(r.publishedAt) },
    { key: 'counts', label: 'Ack / Seen / Total', sortable: false, render: (r: NoticeRow) => <span className="tabular-nums">{countsText(r)}</span> },
    { key: 'status', label: 'Status', sortable: false, render: (r: NoticeRow) => { const s = noticeStatus(r); return <Badge variant={s.variant}>{s.label}</Badge>; } },
    {
      key: 'deadline', label: 'Deadline',
      render: (r: NoticeRow) => <span className={r.deadlineState === 'passed' ? 'text-amber-700' : 'text-gray-600'}>{deadlineText(r)}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Notices</h2>
          <p className="mt-1 text-sm text-gray-500">Official notices sent to the Juvi app, with who has seen and acknowledged each one.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search notices…" className="w-64" />
        <label className="sr-only" htmlFor="notice-status">Status</label>
        <select id="notice-status" className={sel} value={status} onChange={(e) => { setStatus(e.target.value as '' | NoticeStatus); setPage(1); }}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {admin && targets && (
          <>
            <label className="sr-only" htmlFor="notice-office">Office</label>
            <select id="notice-office" className={sel} value={office} onChange={(e) => { setOffice(e.target.value); setPage(1); }}>
              <option value="">All offices</option>
              {targets.offices.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/communication/notices/${r.id}`)}
        rowLabel={(r) => `Open notice ${r.title}`}
        disableSort
        emptyMessage={search || status || office ? 'No notices match these filters.' : 'No notices yet.'}
      />
      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} itemLabel="notices" />
      )}
    </div>
  );
}
```

`admin-portal/src/App.tsx`: a lazy hub, gated on `notices:read` like every other hub:

```diff
--- a/admin-portal/src/App.tsx
+++ b/admin-portal/src/App.tsx
@@ -23,6 +23,7 @@
 const Governance = lazy(() => import('./pages/Governance'));
 const Platform = lazy(() => import('./pages/Platform'));
 const Juvi = lazy(() => import('./pages/Juvi'));
+const Communication = lazy(() => import('./pages/Communication'));
 const MasterData = lazy(() => import('./pages/MasterData'));
 const SearchResults = lazy(() => import('./pages/SearchResults'));
 const NotFound = lazy(() => import('./pages/NotFound'));
@@ -122,6 +123,7 @@
           <Route path="/governance/*" element={gated('governance', <Governance />)} />
           <Route path="/platform/*" element={gated('platform', <Platform />)} />
           <Route path="/juvi/*" element={gated('juvi', <Juvi />)} />
+          <Route path="/communication/*" element={gated('notices', <Communication />)} />
           <Route path="/master-data/*" element={gated('academics', <MasterData />)} />
           <Route path="/search" element={renderLazyPage(<SearchResults />)} />
           {/* Show an explicit 404 rather than silently bouncing typos to the
```

`admin-portal/src/layouts/DashboardLayout.tsx`: the cross-cutting item and the rule that keeps it past `accessibleModules`:

```diff
--- a/admin-portal/src/layouts/DashboardLayout.tsx
+++ b/admin-portal/src/layouts/DashboardLayout.tsx
@@ -3,7 +3,7 @@
 import {
   LayoutDashboard, UserPlus, Users, GraduationCap, IndianRupee,
   Briefcase, Heart, Building2, TrendingUp, Shield, Landmark,
-  Settings, Bot, ChevronLeft, Menu, BookOpen, LogOut, ArrowLeftRight, ChevronDown, ChevronRight, Database
+  Settings, Bot, ChevronLeft, Menu, BookOpen, LogOut, ArrowLeftRight, ChevronDown, ChevronRight, Database, Megaphone
 } from 'lucide-react';
 import clsx from 'clsx';
 import { useAuthStore } from '../stores/authStore';
@@ -26,6 +26,12 @@
   iconColor: string;
   module: string | null;
   children?: NavChild[];
+  /**
+   * Shown to anyone with `<module>:read`, whatever the persona's
+   * `accessibleModules` lists. For tools every office uses (Juvi notices),
+   * which no persona's module list names.
+   */
+  crossCutting?: boolean;
 }
 
 export const NAV_ITEMS: NavItem[] = [
@@ -57,6 +63,7 @@
   { to: '/student-dev', icon: BookOpen, label: 'Student Dev', iconColor: 'text-teal-400', module: 'student-dev' },
   { to: '/compliance', icon: Shield, label: 'Compliance', iconColor: 'text-red-400', module: 'compliance' },
   { to: '/governance', icon: Landmark, label: 'Governance', iconColor: 'text-indigo-400', module: 'governance' },
+  { to: '/communication/notices', icon: Megaphone, label: 'Notices', iconColor: 'text-sky-300', module: 'notices', crossCutting: true },
   { to: '/platform', icon: Settings, label: 'Platform', iconColor: 'text-gray-400', module: 'platform' },
   { to: '/juvi', icon: Bot, label: 'Juvi AI', iconColor: 'text-purple-400', module: 'juvi' },
 ];
@@ -70,7 +77,7 @@
     if (!item.module) return true;
     if (!canRead(item.module)) return false;
     if (accessibleModules && accessibleModules.length > 0) {
-      return accessibleModules.includes(item.module);
+      return item.crossCutting === true || accessibleModules.includes(item.module);
     }
     return true;
   });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/pages/communication src/layouts`
Expected: PASS (2 files, 11 tests).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/pages/Communication.tsx admin-portal/src/pages/communication/NoticesPage.tsx admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx admin-portal/src/App.tsx admin-portal/src/layouts/DashboardLayout.tsx admin-portal/src/layouts/__tests__/DashboardLayout.test.ts
git commit -m "feat(admin-portal): /communication/notices list and Notices sidebar item

Gated on notices:read. The sidebar item is cross-cutting: it survives a
persona's accessibleModules list, which no persona extends with notices.
The list shows Delivering… and Delivery failed, polls while delivering,
and filters by status (and by office for admins).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Portal: `Drawer`, the shared dialog-focus hook, and the audience builder with its live count

**Files:**
- Create: `admin-portal/src/components/ui/useDialogFocus.ts`, `admin-portal/src/components/ui/Drawer.tsx`, `admin-portal/src/components/communication/TargetPicker.tsx`, `admin-portal/src/components/communication/AudienceBuilder.tsx`
- Modify: `admin-portal/src/components/ui/Modal.tsx`
- Test: `admin-portal/src/components/ui/__tests__/Drawer.test.tsx`, `admin-portal/src/components/communication/__tests__/AudienceBuilder.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`previewAudience`, `searchNoticePeople`, `AudienceRule`, `AudienceRuleKind`, `NoticeTargets`, `TargetOption`, `PersonOption`, `KIND_ORDER`, `KIND_LABELS`, `roleLabel`, `errorStatus`, `noticeErrorMessage`, `useDebouncedValue`); Task 1–2 endpoints.
- Produces:
  ```ts
  // components/ui/useDialogFocus.ts
  export function useDialogFocus(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>, initialFocus?: RefObject<HTMLElement | null>): void;
  // components/ui/Drawer.tsx — default export
  <Drawer open onClose title description? footer? widthClass? initialFocus? />   // role="dialog", aria-modal, "Close panel" button
  // components/communication/TargetPicker.tsx
  export interface AudienceItem { id: string; label: string; hint?: string }
  <TargetPicker label options? search? selected onChange disabled? />   // default export
  // components/communication/AudienceBuilder.tsx
  export type AudienceSelection = Partial<Record<AudienceRuleKind, AudienceItem[]>>;
  export function selectionToRules(sel: AudienceSelection): AudienceRule[];
  export function useAudiencePreview(rules: AudienceRule[], office: string | undefined, ms?: number):
    { data?: AudiencePreview; error: unknown; isError: boolean; updating: boolean; current: boolean };
  export type AudiencePreviewState = ReturnType<typeof useAudiencePreview>;
  <AudienceBuilder targets value onChange preview disabled? />   // default export
  // React Query keys: ['notice-people', q], ['notice-audience-preview', key]
  ```

`useDialogFocus` is `Modal`'s three effects moved verbatim into a hook (Escape, Tab trap, body scroll lock, focus in and back out), plus an optional `initialFocus`, so `Drawer` behaves identically and the composer can put focus on its first field. A listbox inside the drawer handles Escape itself and calls `stopPropagation()`; React 19 dispatches from the root container, so the native event never reaches the hook's `document` listener and the drawer stays open (the Drawer test pins this). The live count is debounced on a JSON key (a fresh array would restart the timer forever), keeps the previous count while updating, and is `current` only when it matches the latest rules; Task 6 gates publishing on that. A 403 from `/audience-preview` is the server's scope refusal and is shown as an alert, prefixed by status, never by message text.

- [ ] **Step 1: Write the failing tests**

```tsx
// admin-portal/src/components/ui/__tests__/Drawer.test.tsx
import { describe, it, expect } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Drawer from '../Drawer';
import Modal from '../Modal';

function Harness({ withInitial = false }: { withInitial?: boolean }) {
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open composer</button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New notice" description="Sent to the Juvi app" initialFocus={withInitial ? first : undefined}
        footer={<button type="button">Publish</button>}>
        <label htmlFor="t">Title</label>
        <input id="t" ref={first} />
        <input aria-label="Picker search" onKeyDown={(e) => { if (e.key === 'Escape') e.stopPropagation(); }} />
      </Drawer>
    </>
  );
}

function openWithKeyboardFocus() {
  const trigger = screen.getByRole('button', { name: 'Open composer' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe('Drawer', () => {
  it('is a labelled modal dialog with its footer', () => {
    render(<Harness />);
    openWithKeyboardFocus();
    const dialog = screen.getByRole('dialog', { name: 'New notice' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Sent to the Juvi app');
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('focuses initialFocus on open, closes on Escape and returns focus to the trigger', () => {
    render(<Harness withInitial />);
    const trigger = openWithKeyboardFocus();
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('falls back to the first focusable element and ignores an Escape a child already handled', () => {
    render(<Harness />);
    openWithKeyboardFocus();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close panel' }));
    fireEvent.keyDown(screen.getByLabelText('Picker search'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('locks body scroll while open', () => {
    render(<Harness />);
    openWithKeyboardFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Modal (on the shared hook)', () => {
  it('still closes on Escape and returns focus', () => {
    function M() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open composer</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Edit"><input aria-label="Name" /></Modal>
        </>
      );
    }
    render(<M />);
    const trigger = openWithKeyboardFocus();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
```

```tsx
// admin-portal/src/components/communication/__tests__/AudienceBuilder.test.tsx
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { useState } from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import AudienceBuilder, { selectionToRules, useAudiencePreview, type AudienceSelection } from '../AudienceBuilder';
import { renderWithProviders } from '../../../__tests__/test-utils';
import type { NoticeTargets } from '../../../services/notices';

vi.mock('../../../services/notices', () => ({ previewAudience: vi.fn(), searchNoticePeople: vi.fn() }));
import { previewAudience, searchNoticePeople } from '../../../services/notices';

const COLLEGE: NoticeTargets = {
  office: 'Exam Section', offices: ['Exam Section'], isAdmin: false, timezone: 'Asia/Kolkata',
  kinds: ['all', 'role', 'department', 'programme', 'batch', 'section', 'course_offering', 'hostel_block', 'custom'],
  roles: ['student', 'faculty', 'staff', 'hod'],
  departments: [{ id: 'd1', label: 'Computer Science' }, { id: 'd2', label: 'Electronics' }],
  programmes: [{ id: 'p1', label: 'B.Tech' }],
  batches: [{ id: 'b1', label: 'CSE 2024' }, { id: 'b2', label: 'ECE 2024' }, { id: 'b3', label: 'CSE 2023' }],
  sections: [], courseOfferings: [], hostelBlocks: [],
};
const HOD: NoticeTargets = {
  ...COLLEGE, office: 'HOD, Computer Science', offices: ['HOD, Computer Science'],
  kinds: ['role', 'department', 'batch', 'section', 'course_offering', 'custom'], roles: ['student', 'faculty', 'staff'],
  departments: [{ id: 'd1', label: 'Computer Science' }], programmes: [], batches: [{ id: 'b3', label: 'CSE 2023' }],
};

function Harness({ targets }: { targets: NoticeTargets }) {
  const [sel, setSel] = useState<AudienceSelection>({});
  const preview = useAudiencePreview(selectionToRules(sel), undefined, 0);
  return <AudienceBuilder targets={targets} value={sel} onChange={setSel} preview={preview} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  (previewAudience as Mock).mockResolvedValue({ total: 3, onJuvi: 2, notOnJuvi: 1, groups: [{ label: 'CSE 2024 · Section A', total: 3, onJuvi: 2 }], line: 'Sent to CSE 2024' });
  (searchNoticePeople as Mock).mockResolvedValue({ items: [{ id: 'p9', label: 'Asha Rao', hint: 'CSE 2024 · Section A' }] });
});

describe('selectionToRules', () => {
  it('drops empty kinds, keeps Everyone, and orders kinds stably', () => {
    expect(selectionToRules({ batch: [{ id: 'b1', label: 'CSE 2024' }], all: [], role: [] })).toEqual([{ kind: 'all', ids: [] }, { kind: 'batch', ids: ['b1'] }]);
  });
});

describe('AudienceBuilder', () => {
  it('offers only the kinds the publisher may target', () => {
    renderWithProviders(<Harness targets={HOD} />);
    const group = screen.getByRole('group', { name: /choose who receives/i });
    expect(within(group).queryByRole('button', { name: 'Everyone' })).toBeNull();
    expect(within(group).queryByRole('button', { name: /programmes/i })).toBeNull();
    expect(within(group).getByRole('button', { name: /departments/i })).toBeInTheDocument();
  });

  it('opens a searchable listbox, toggles with the keyboard, and closes on Escape back to the chip', async () => {
    renderWithProviders(<Harness targets={COLLEGE} />);
    const chip = screen.getByRole('button', { name: /^batches/i });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    const search = screen.getByRole('combobox', { name: /search batches/i });
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: 'cse' } });
    const list = screen.getByRole('listbox', { name: 'Batches' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['CSE 2024', 'CSE 2023']);
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(within(list).getByRole('option', { name: 'CSE 2023' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(chip);
    const tags = screen.getByRole('list', { name: /selected audience/i });
    expect(within(tags).getByText('CSE 2023')).toBeInTheDocument();
    expect(screen.queryByText('b3')).toBeNull();   // never a raw id
  });

  it('shows the live count with the on-Juvi split and the per-group breakdown', async () => {
    renderWithProviders(<Harness targets={COLLEGE} />);
    fireEvent.click(screen.getByRole('button', { name: /^batches/i }));
    fireEvent.click(screen.getByRole('option', { name: 'CSE 2024' }));
    await waitFor(() => expect(previewAudience).toHaveBeenCalledWith([{ kind: 'batch', ids: ['b1'] }], undefined));
    expect(await screen.findByText(/2 on Juvi/)).toBeInTheDocument();
    expect(screen.getByText(/1 not on Juvi yet/)).toBeInTheDocument();
    expect(screen.getByText('Sent to CSE 2024')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /audience by batch/i });
    expect(within(table).getByText('CSE 2024 · Section A')).toBeInTheDocument();
  });

  it('searches people on the server and removes a tag', async () => {
    renderWithProviders(<Harness targets={COLLEGE} />);
    fireEvent.click(screen.getByRole('button', { name: /^people/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /search people/i }), { target: { value: 'asha' } });
    await waitFor(() => expect(searchNoticePeople).toHaveBeenLastCalledWith('asha'));
    fireEvent.click(await screen.findByRole('option', { name: /asha rao/i }));
    fireEvent.keyDown(screen.getByRole('combobox', { name: /search people/i }), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Asha Rao' }));
    expect(screen.queryByRole('list', { name: /selected audience/i })).toBeNull();
    expect(screen.getByText(/choose who should receive/i)).toBeInTheDocument();
  });

  it('shows the server scope refusal as an alert', async () => {
    (previewAudience as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 403, data: { error: 'You can only send notices to your own department.' } } });
    renderWithProviders(<Harness targets={COLLEGE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Outside your scope: You can only send notices to your own department.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/components/ui/__tests__/Drawer.test.tsx src/components/communication/__tests__/AudienceBuilder.test.tsx`
Expected: FAIL: `Failed to resolve import "../Drawer"` and `"../AudienceBuilder"`.

- [ ] **Step 3: Implement**

```ts
// admin-portal/src/components/ui/useDialogFocus.ts
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Dialog behaviour shared by Modal and Drawer: Escape closes, Tab stays inside
 * the panel, the page behind does not scroll, focus moves in on open (to
 * `initialFocus` when given, else the first focusable element) and returns to
 * the trigger on close. A child that handles Escape itself (a listbox) calls
 * `e.stopPropagation()` so this document-level handler never sees it.
 */
export function useDialogFocus(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
  initialFocus?: RefObject<HTMLElement | null>,
): void {
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, panelRef]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const target = initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    target?.focus();
    return () => {
      restoreFocusRef.current?.focus?.();
    };
    // initialFocus is read once per opening, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panelRef]);
}
```

`admin-portal/src/components/ui/Modal.tsx` keeps its markup and props and swaps its three effects for the hook:

```diff
--- a/admin-portal/src/components/ui/Modal.tsx
+++ b/admin-portal/src/components/ui/Modal.tsx
@@ -1,6 +1,7 @@
-import { useEffect, useId, useRef } from 'react';
+import { useId, useRef } from 'react';
 import { X } from 'lucide-react';
 import clsx from 'clsx';
+import { useDialogFocus } from './useDialogFocus';
 
 interface Props {
   open: boolean;
@@ -12,70 +13,15 @@
   description?: string;
 }
 
-const FOCUSABLE = [
-  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
-  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
-].join(',');
-
 export default function Modal({ open, onClose, title, children, widthClass = 'max-w-lg', description }: Props) {
   const panelRef = useRef<HTMLDivElement>(null);
-  const restoreFocusRef = useRef<HTMLElement | null>(null);
   const titleId = useId();
   const descId = useId();
 
-  // Close on Escape + trap Tab inside the panel so focus cannot wander to the
-  // sidebar links sitting behind the backdrop.
-  useEffect(() => {
-    if (!open) return;
-    const handler = (e: KeyboardEvent) => {
-      if (e.key === 'Escape') {
-        onClose();
-        return;
-      }
-      if (e.key !== 'Tab') return;
-      const panel = panelRef.current;
-      if (!panel) return;
-      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
-        .filter((el) => el.offsetParent !== null || el === document.activeElement);
-      if (items.length === 0) {
-        e.preventDefault();
-        panel.focus();
-        return;
-      }
-      const first = items[0]!;
-      const last = items[items.length - 1]!;
-      const active = document.activeElement as HTMLElement | null;
-      if (e.shiftKey && (active === first || !panel.contains(active))) {
-        e.preventDefault();
-        last.focus();
-      } else if (!e.shiftKey && active === last) {
-        e.preventDefault();
-        first.focus();
-      }
-    };
-    document.addEventListener('keydown', handler);
-    return () => document.removeEventListener('keydown', handler);
-  }, [open, onClose]);
+  // Escape, a Tab trap so focus cannot wander to the sidebar behind the
+  // backdrop, no body scroll, and focus in on open / back to the trigger on close.
+  useDialogFocus(open, onClose, panelRef);
 
-  // Prevent body scroll when open
-  useEffect(() => {
-    if (open) document.body.style.overflow = 'hidden';
-    else document.body.style.overflow = '';
-    return () => { document.body.style.overflow = ''; };
-  }, [open]);
-
-  // Move focus into the dialog on open, and hand it back to the trigger on close.
-  useEffect(() => {
-    if (!open) return;
-    restoreFocusRef.current = document.activeElement as HTMLElement | null;
-    const panel = panelRef.current;
-    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
-    (first ?? panel)?.focus();
-    return () => {
-      restoreFocusRef.current?.focus?.();
-    };
-  }, [open]);
-
   if (!open) return null;
 
   return (
```

```tsx
// admin-portal/src/components/ui/Drawer.tsx
import { useId, useRef, type RefObject } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useDialogFocus } from './useDialogFocus';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional supporting copy announced with the title. */
  description?: string;
  /** Pinned under the scrolling body (actions). */
  footer?: React.ReactNode;
  widthClass?: string;
  /** Receives focus on open instead of the first focusable element (the close button). */
  initialFocus?: RefObject<HTMLElement | null>;
}

/** A right-hand panel with the same dialog behaviour as Modal (useDialogFocus). */
export default function Drawer({ open, onClose, title, children, description, footer, widthClass = 'max-w-2xl', initialFocus }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useDialogFocus(open, onClose, panelRef, initialFocus);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={clsx('relative flex h-full w-full flex-col bg-white shadow-xl focus:outline-none', widthClass)}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-semibold">{title}</h3>
            {description && <p id={descId} className="mt-0.5 text-xs text-gray-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close panel" className="rounded p-1 hover:bg-gray-100">
            <X size={18} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t bg-white px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
```

```tsx
// admin-portal/src/components/communication/TargetPicker.tsx
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { PersonOption, TargetOption } from '../../services/notices';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';

/** A chosen target: the id goes on the wire, only the label is ever shown. */
export interface AudienceItem { id: string; label: string; hint?: string }

interface Props {
  /** Chip text and the listbox's accessible name, e.g. "Batches". */
  label: string;
  /** Fixed options from GET /targets, filtered here as the user types. */
  options?: TargetOption[];
  /** Server-side search (People): called with the debounced text. */
  search?: (q: string) => Promise<{ items: PersonOption[] }>;
  selected: AudienceItem[];
  onChange: (next: AudienceItem[]) => void;
  disabled?: boolean;
}

/**
 * One audience chip: a button that opens a searchable, multi-select listbox
 * (WAI-ARIA combobox pattern). Arrow keys move, Enter toggles, Escape closes
 * and returns focus to the chip without closing the drawer around it.
 */
export default function TargetPicker({ label, options, search, selected, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(term, 250);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-option-${i}`;

  const remote = useQuery({
    queryKey: ['notice-people', debounced],
    queryFn: () => search!(debounced),
    enabled: open && Boolean(search),
    meta: { silentError: true },
  });

  const shown: AudienceItem[] = useMemo(() => {
    if (search) return remote.data?.items ?? [];
    const needle = term.trim().toLowerCase();
    return (options ?? []).filter((o) => !needle || o.label.toLowerCase().includes(needle));
  }, [search, remote.data, options, term]);

  useEffect(() => { setActive(0); }, [term]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) { setOpen(false); setTerm(''); }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const isSelected = (id: string) => selected.some((s) => s.id === id);
  const toggle = (item: AudienceItem) =>
    onChange(isSelected(item.id) ? selected.filter((s) => s.id !== item.id) : [...selected, { id: item.id, label: item.label, ...(item.hint ? { hint: item.hint } : {}) }]);
  const close = () => { setOpen(false); setTerm(''); buttonRef.current?.focus(); };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, Math.max(shown.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const item = shown[active]; if (item) toggle(item); }
    else if (e.key === 'Escape') {
      // Handled here: stop it reaching the drawer's document-level Escape (useDialogFocus).
      e.preventDefault(); e.stopPropagation(); close();
    }
  }

  const loading = Boolean(search) && remote.isFetching;
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50',
          selected.length ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50',
        )}
      >
        {label}
        {selected.length > 0 && <span className="rounded-full bg-primary-600 px-1.5 text-xs text-white">{selected.length}</span>}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-80 rounded-lg border bg-white p-2 shadow-lg">
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown[active] ? optionId(active) : undefined}
            aria-label={`Search ${label.toLowerCase()}`}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type to search…"
            className={inp}
          />
          <ul id={listId} role="listbox" aria-label={label} aria-multiselectable="true" className="mt-2 max-h-60 overflow-y-auto">
            {shown.map((o, i) => (
              <li
                key={o.id}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected(o.id)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggle(o)}
                className={clsx('flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm', i === active ? 'bg-primary-50' : 'hover:bg-gray-50')}
              >
                <Check size={14} aria-hidden="true" className={clsx('mt-0.5 shrink-0', isSelected(o.id) ? 'text-primary-600' : 'invisible')} />
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-gray-500">{o.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
          {loading && <p className="px-2 py-1 text-xs text-gray-500">Searching…</p>}
          {!loading && shown.length === 0 && <p className="px-2 py-1 text-xs text-gray-500">No matches you can send to.</p>}
        </div>
      )}
    </div>
  );
}
```

```tsx
// admin-portal/src/components/communication/AudienceBuilder.tsx
import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import clsx from 'clsx';
import TargetPicker, { type AudienceItem } from './TargetPicker';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { previewAudience, searchNoticePeople, type AudienceRule, type AudienceRuleKind, type NoticeTargets, type TargetOption } from '../../services/notices';
import { KIND_LABELS, KIND_ORDER, errorStatus, noticeErrorMessage, roleLabel } from '../../lib/notices';

/** What the composer holds per kind. `all` present (with no items) means "Everyone". */
export type AudienceSelection = Partial<Record<AudienceRuleKind, AudienceItem[]>>;

const OPTION_KEYS: Partial<Record<AudienceRuleKind, 'departments' | 'programmes' | 'batches' | 'sections' | 'courseOfferings' | 'hostelBlocks'>> = {
  department: 'departments', programme: 'programmes', batch: 'batches', section: 'sections', course_offering: 'courseOfferings', hostel_block: 'hostelBlocks',
};

function optionsFor(kind: AudienceRuleKind, targets: NoticeTargets): TargetOption[] {
  if (kind === 'role') return targets.roles.map((id) => ({ id, label: roleLabel(id) }));
  const key = OPTION_KEYS[kind];
  return key ? targets[key] : [];
}

/** The rules the API takes, in a stable order so equal selections give equal keys. */
export function selectionToRules(sel: AudienceSelection): AudienceRule[] {
  return KIND_ORDER.flatMap((kind): AudienceRule[] => {
    const items = sel[kind];
    if (!items) return [];
    if (kind === 'all') return [{ kind, ids: [] }];
    return items.length ? [{ kind, ids: items.map((i) => i.id) }] : [];
  });
}

/**
 * The live audience count (spec §8, US-1.2): POST /audience-preview, debounced.
 * `current` is true only when the data matches the latest rules, which is what
 * the composer requires before it lets anyone publish.
 */
export function useAudiencePreview(rules: AudienceRule[], office: string | undefined, ms = 400) {
  const key = JSON.stringify({ rules, office: office ?? null });
  const settled = useDebouncedValue(key, ms);
  const parsed = useMemo(() => JSON.parse(settled) as { rules: AudienceRule[]; office: string | null }, [settled]);
  const query = useQuery({
    queryKey: ['notice-audience-preview', settled],
    queryFn: () => previewAudience(parsed.rules, parsed.office ?? undefined),
    enabled: parsed.rules.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
    meta: { silentError: true },
  });
  const current = key === settled && query.isSuccess && !query.isFetching && !query.isPlaceholderData;
  return { data: query.data, error: query.error, isError: query.isError, updating: key !== settled || query.isFetching, current };
}
export type AudiencePreviewState = ReturnType<typeof useAudiencePreview>;

interface Props {
  targets: NoticeTargets;
  value: AudienceSelection;
  onChange: (next: AudienceSelection) => void;
  preview: AudiencePreviewState;
  disabled?: boolean;
}

export default function AudienceBuilder({ targets, value, onChange, preview, disabled }: Props) {
  const kinds = KIND_ORDER.filter((k) => targets.kinds.includes(k));
  const hasRules = selectionToRules(value).length > 0;
  const setKind = (kind: AudienceRuleKind, items: AudienceItem[] | undefined) => {
    const next = { ...value };
    if (items === undefined || (kind !== 'all' && items.length === 0)) delete next[kind];
    else next[kind] = items;
    onChange(next);
  };

  return (
    <fieldset className="space-y-3">
      <legend className="block text-sm font-medium text-gray-700 mb-1">Audience</legend>
      {kinds.length === 0 ? (
        <p className="text-sm text-red-600">Your role cannot publish notices.</p>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choose who receives this notice">
          {kinds.map((kind) => kind === 'all' ? (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              aria-pressed={value.all !== undefined}
              onClick={() => setKind('all', value.all !== undefined ? undefined : [])}
              className={clsx('rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50',
                value.all !== undefined ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50')}
            >
              {KIND_LABELS.all}
            </button>
          ) : (
            <TargetPicker
              key={kind}
              label={KIND_LABELS[kind]}
              options={kind === 'custom' ? undefined : optionsFor(kind, targets)}
              search={kind === 'custom' ? searchNoticePeople : undefined}
              selected={value[kind] ?? []}
              onChange={(items) => setKind(kind, items)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {hasRules && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected audience">
          {value.all !== undefined && (
            <li className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              Everyone at the college
              <button type="button" disabled={disabled} onClick={() => setKind('all', undefined)} aria-label="Remove Everyone" className="text-gray-500 hover:text-gray-900"><X size={12} /></button>
            </li>
          )}
          {KIND_ORDER.filter((k) => k !== 'all').flatMap((kind) => (value[kind] ?? []).map((item) => (
            <li key={`${kind}:${item.id}`} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              <span className="text-gray-500">{KIND_LABELS[kind]}:</span> {item.label}
              <button type="button" disabled={disabled} onClick={() => setKind(kind, (value[kind] ?? []).filter((i) => i.id !== item.id))}
                aria-label={`Remove ${item.label}`} className="text-gray-500 hover:text-gray-900"><X size={12} /></button>
            </li>
          )))}
        </ul>
      )}

      <AudienceCount hasRules={hasRules} preview={preview} />
    </fieldset>
  );
}

function AudienceCount({ hasRules, preview }: { hasRules: boolean; preview: AudiencePreviewState }) {
  if (!hasRules) return <p className="text-sm text-gray-500">Choose who should receive this notice.</p>;
  if (preview.isError) {
    // 403 is the server's scope refusal (spec §7.3); its message says what is out of scope.
    const prefix = errorStatus(preview.error) === 403 ? 'Outside your scope: ' : '';
    return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{prefix}{noticeErrorMessage(preview.error)}</p>;
  }
  const d = preview.data;
  return (
    <div aria-live="polite" className="rounded-lg border bg-gray-50 p-3 text-sm">
      {!d ? (
        <p className="text-gray-500">Counting the audience…</p>
      ) : (
        <>
          <p className="text-gray-900">
            <span className="font-semibold">{d.total.toLocaleString('en-IN')}</span> {d.total === 1 ? 'person' : 'people'}
            {' · '}{d.onJuvi.toLocaleString('en-IN')} on Juvi
            {' · '}{d.notOnJuvi.toLocaleString('en-IN')} not on Juvi yet
            {preview.updating && <span className="ml-2 text-xs text-gray-500">updating…</span>}
          </p>
          <p className="mt-0.5 text-gray-500">{d.line}</p>
          {d.notOnJuvi > 0 && <p className="mt-1 text-xs text-gray-500">People not on Juvi yet get the notice when they activate the app.</p>}
          {d.groups.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto">
              <table className="w-full text-xs" aria-label="Audience by batch, section or department">
                <thead className="text-left text-gray-500">
                  <tr><th className="py-1 font-medium">Group</th><th className="py-1 text-right font-medium">People</th><th className="py-1 text-right font-medium">On Juvi</th></tr>
                </thead>
                <tbody>
                  {d.groups.map((g) => (
                    <tr key={g.label} className="border-t">
                      <td className="py-1">{g.label}</td>
                      <td className="py-1 text-right tabular-nums">{g.total}</td>
                      <td className="py-1 text-right tabular-nums">{g.onJuvi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/components/ui/__tests__/Drawer.test.tsx src/components/communication/__tests__/AudienceBuilder.test.tsx`
Expected: PASS (2 files, 11 tests).

Run: `cd admin-portal && npx vitest run`
Expected: PASS, every portal file, including the existing `Modal` users (`StudentImportDrawer.test.tsx` and the rest).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/components/ui/useDialogFocus.ts admin-portal/src/components/ui/Drawer.tsx admin-portal/src/components/ui/Modal.tsx admin-portal/src/components/ui/__tests__/Drawer.test.tsx admin-portal/src/components/communication/TargetPicker.tsx admin-portal/src/components/communication/AudienceBuilder.tsx admin-portal/src/components/communication/__tests__/AudienceBuilder.test.tsx
git commit -m "feat(admin-portal): Drawer and the notice audience builder

Modal's focus handling moves into useDialogFocus, shared with the new
Drawer. Audience chips open scoped, searchable, keyboard-operable listboxes
fed by /targets (People searches /targets/people), selections show labels
only, and a debounced live count shows total, on Juvi, not on Juvi and the
per-group breakdown, or the server's scope refusal.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Portal: `<NoticeComposer />` (attachments, acknowledgement, priority, card preview, confirm-to-publish)

**Files:**
- Create: `admin-portal/src/components/communication/AttachmentsField.tsx`, `admin-portal/src/components/communication/NoticeCardPreview.tsx`, `admin-portal/src/components/communication/NoticeComposer.tsx`
- Modify: `admin-portal/src/pages/communication/NoticesPage.tsx`
- Test: `admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx` (create), `admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 5 (`Drawer`, `AudienceBuilder`, `selectionToRules`, `useAudiencePreview`, `AudienceSelection`); Task 3 (`getNoticeTargets`, `publishNotice`, `uploadNoticeAttachment`, `PublishNoticeInput`, `NoticeDetail`, `NoticePriority`, `NoticePurpose`, `AudiencePreview`, the limits, `PRIORITY_LABELS`, `URGENT_NOTE`, `zonedLocalToIso`, `isoToZonedLocal`, `formatInZone`, `formatBytes`, `noticeErrorMessage`); `toast`.
- Produces:
  ```ts
  // components/communication/NoticeComposer.tsx
  export interface ComposerInitial { title?: string; body?: string; purpose?: NoticePurpose; ackRequired?: boolean; audience?: AudienceSelection }
  export function NoticeComposerForm(props: { initial?: ComposerInitial; onPublished(n: NoticeDetail): void; onCancel(): void; titleRef?: RefObject<HTMLInputElement | null> }): JSX.Element;   // embeddable inline
  export default function NoticeComposer(props: { open: boolean; onClose(): void; initial?: ComposerInitial; onPublished?(n: NoticeDetail): void; title?: string }): JSX.Element;   // the drawer
  // components/communication/AttachmentsField.tsx
  export interface AttachmentsState { attachments: NoticeAttachment[]; uploading: boolean; failed: boolean }
  export default function AttachmentsField(props: { onChange(s: AttachmentsState): void; disabled?: boolean }): JSX.Element;
  // components/communication/NoticeCardPreview.tsx
  export function DeadlineRing(props: { deadline: string; start: number; now?: number; size?: number }): JSX.Element;
  export default function NoticeCardPreview(props: { title; body; office; audienceLine; priority; ackRequired; deadline: string | null; timezone; attachmentCount }): JSX.Element;
  ```

Behaviour pinned by the tests:
- **Office:** admins (`targets.isAdmin`) get a "Publish as" select over `targets.offices`; the chosen office goes into both the preview and the publish body. Everyone else sees "Publishing as …" and sends no `office`.
- **Title and body:** `maxLength` enforces 120 and 5000; each has a live counter wired as its accessible description.
- **Attachments:** each file uploads as soon as it is picked, with its own `role="progressbar"`. Type, size and the 5-file cap are checked before upload, using the server's own wording; a 503 shows the server's reason. Failed rows stay until removed, and publishing waits for uploads and refuses while a failed row remains.
- **Acknowledgement:** the deadline and the comment toggle are disabled until "Require acknowledgement" is on, and are cleared when it goes off. The deadline is a `datetime-local` labelled with the college timezone and converted with `zonedLocalToIso`; for example `2030-01-15T17:00` in `Asia/Kolkata` is sent as `2030-01-15T11:30:00.000Z`.
- **Priority:** Routine, Important or Urgent; Urgent shows `URGENT_NOTE` ("Urgent bypasses quiet hours once push arrives. …").
- **Preview:** a Juvi card showing the office, priority, title, body, attachment count, audience line, and the `DeadlineRing` with "Acknowledge by …" in college time.
- **Confirm-to-publish:** "Review and publish" validates the title, body, audience, live count, uploads and deadline. It requires a count that is `current`, so nobody publishes on a stale or failed count, and a zero count is refused with the server's own wording. It then shows "Publish to N people?" with the on-Juvi and not-on-Juvi split, and moves focus to that heading. Only "Publish notice" posts. A failure shows inside the step (the mutation is `meta: { silent: true, silentError: true }`); success toasts once, invalidates `['notices']` and closes. "Back to edit" keeps everything, because the form is hidden rather than unmounted (the wrapper `div` carries `hidden`, and the `grid` lives on an inner `div` so Tailwind's `display: grid` cannot override `[hidden]`).
- The audience count waits for `/targets`, so an admin's first count is already for the right office.

- [ ] **Step 1: Write the failing tests**

```tsx
// admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import NoticeComposer from '../NoticeComposer';
import { renderWithProviders } from '../../../__tests__/test-utils';

vi.mock('../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../services/notices', () => ({
  getNoticeTargets: vi.fn(), previewAudience: vi.fn(), searchNoticePeople: vi.fn(), uploadNoticeAttachment: vi.fn(), publishNotice: vi.fn(),
}));
import { getNoticeTargets, previewAudience, uploadNoticeAttachment, publishNotice } from '../../../services/notices';
import { toast } from '../../../stores/toastStore';

const TARGETS = {
  office: 'College Office', offices: ['College Office', "Principal's Office", 'Exam Section'], isAdmin: true, timezone: 'Asia/Kolkata',
  kinds: ['all', 'role', 'batch'], roles: ['student', 'faculty'],
  departments: [], programmes: [], batches: [{ id: 'b1', label: 'CSE 2024' }], sections: [], courseOfferings: [], hostelBlocks: [],
};
const PREVIEW = { total: 3, onJuvi: 2, notOnJuvi: 1, groups: [{ label: 'CSE 2024', total: 3, onJuvi: 2 }], line: 'Sent to CSE 2024' };
const pdf = (name = 'timetable.pdf', size = 1000) => { const f = new File(['x'], name, { type: 'application/pdf' }); Object.defineProperty(f, 'size', { value: size }); return f; };

function deferred<T>() {
  let resolve!: (v: T) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const onPublished = vi.fn();
const onClose = vi.fn();
function open(initial?: Parameters<typeof NoticeComposer>[0]['initial']) {
  return renderWithProviders(<NoticeComposer open onClose={onClose} onPublished={onPublished} initial={initial} />);
}
async function chooseBatch() {
  fireEvent.click(await screen.findByRole('button', { name: /^batches/i }));
  fireEvent.click(screen.getByRole('option', { name: 'CSE 2024' }));
  fireEvent.keyDown(screen.getByRole('combobox', { name: /search batches/i }), { key: 'Escape' });
  await screen.findByText(/2 on Juvi/);
}

beforeEach(() => {
  vi.clearAllMocks();
  (getNoticeTargets as Mock).mockResolvedValue(TARGETS);
  (previewAudience as Mock).mockResolvedValue(PREVIEW);
  (publishNotice as Mock).mockResolvedValue({ id: 'n1', audienceLine: 'Sent to CSE 2024' });
});

describe('NoticeComposer', () => {
  it('opens as a dialog with focus on the title, and lets an admin choose the office', async () => {
    open();
    expect(screen.getByRole('dialog', { name: 'New notice' })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
    const office = await screen.findByLabelText('Publish as');
    expect(within(office).getAllByRole('option').map((o) => o.textContent)).toEqual(['College Office', "Principal's Office", 'Exam Section']);
  });

  it('shows a non-admin the office their persona gives', async () => {
    (getNoticeTargets as Mock).mockResolvedValue({ ...TARGETS, isAdmin: false, office: 'Exam Section', offices: ['Exam Section'] });
    open();
    expect(await screen.findByText(/Publishing as/)).toHaveTextContent('Publishing as Exam Section');
    expect(screen.queryByLabelText('Publish as')).toBeNull();
  });

  it('counts title and body characters against their limits', async () => {
    open();
    const title = screen.getByLabelText('Title');
    expect(title).toHaveAttribute('maxLength', '120');
    expect(screen.getByLabelText('Notice')).toHaveAttribute('maxLength', '5000');
    fireEvent.change(title, { target: { value: 'Exams' } });
    expect(screen.getByText('5/120')).toBeInTheDocument();
    expect(title).toHaveAccessibleDescription('5/120');
  });

  it('uploads attachments with per-file progress, refuses bad files, and removes one', async () => {
    const upload = deferred<unknown>();
    let report: (pct: number) => void = () => {};
    (uploadNoticeAttachment as Mock).mockImplementation((_f: File, onProgress: (p: number) => void) => { report = onProgress; return upload.promise; });
    open();
    const input = screen.getByLabelText('Add attachments');
    fireEvent.change(input, { target: { files: [pdf(), new File(['x'], 'notes.txt', { type: 'text/plain' }), pdf('huge.pdf', 10 * 1024 * 1024 + 1)] } });
    expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument();
    expect(screen.getByText('File too large (max 10 MB)')).toBeInTheDocument();
    report(40);
    expect(await screen.findByRole('progressbar', { name: 'Uploading timetable.pdf' })).toHaveAttribute('aria-valuenow', '40');
    upload.resolve({ key: 'colleges/c/notices/u1', name: 'timetable.pdf', mime: 'application/pdf', size: 1000 });
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(screen.getByText('1/5 · PDF, images, Word, Excel, PowerPoint · 10 MB each')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove notes.txt' }));
    expect(screen.queryByText(/Unsupported file type/)).toBeNull();
  });

  it('shows the server reason when storage is unavailable', async () => {
    (uploadNoticeAttachment as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 503, data: { error: 'Attachments are unavailable: file storage is not configured' } } });
    open();
    fireEvent.change(screen.getByLabelText('Add attachments'), { target: { files: [pdf()] } });
    expect(await screen.findByText('Attachments are unavailable: file storage is not configured')).toBeInTheDocument();
  });

  it('ties the deadline and comments to acknowledgement and notes what Urgent does', async () => {
    open();
    const deadline = screen.getByLabelText('Acknowledge by (Asia/Kolkata)');
    expect(deadline).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Require acknowledgement'));
    expect(deadline).toBeEnabled();
    expect(screen.getByLabelText('Allow a comment with the acknowledgement')).toBeEnabled();
    expect(screen.queryByText(/bypasses quiet hours/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Urgent'));
    expect(screen.getByText(/Urgent bypasses quiet hours once push arrives\./)).toBeInTheDocument();
  });

  it('previews the notice as the Juvi card', async () => {
    open();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Mid-semester timetable' } });
    fireEvent.click(screen.getByLabelText('Require acknowledgement'));
    fireEvent.change(screen.getByLabelText('Acknowledge by (Asia/Kolkata)'), { target: { value: '2030-01-15T17:00' } });
    await chooseBatch();
    const card = screen.getByRole('region', { name: 'Preview in the Juvi app' });
    expect(within(card).getByText('Mid-semester timetable')).toBeInTheDocument();
    expect(within(card).getByText('College Office')).toBeInTheDocument();
    expect(within(card).getByText('Sent to CSE 2024')).toBeInTheDocument();
    expect(within(card).getByText(/Acknowledge by 15 Jan 2030/)).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: /time to the deadline left/ })).toBeInTheDocument();
  });

  it('refuses to review an incomplete notice', async () => {
    open();
    await screen.findByLabelText('Publish as');
    fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
    expect(screen.getByText('Give the notice a title')).toBeInTheDocument();
    expect(screen.getByText('Write the notice')).toBeInTheDocument();
    expect(screen.getByText('Choose who should receive this notice')).toBeInTheDocument();
    expect(publishNotice).not.toHaveBeenCalled();
  });

  it('confirms with the count, then publishes the exact payload with the deadline converted from college time', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Publish as'), { target: { value: 'Exam Section' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' Mid-semester timetable ' } });
    fireEvent.change(screen.getByLabelText('Notice'), { target: { value: 'Attached.' } });
    fireEvent.click(screen.getByLabelText('Require acknowledgement'));
    fireEvent.change(screen.getByLabelText('Acknowledge by (Asia/Kolkata)'), { target: { value: '2030-01-15T17:00' } });
    fireEvent.click(screen.getByLabelText('Allow a comment with the acknowledgement'));
    fireEvent.click(screen.getByLabelText('Important'));
    await chooseBatch();
    await waitFor(() => expect(previewAudience).toHaveBeenLastCalledWith([{ kind: 'batch', ids: ['b1'] }], 'Exam Section'));
    fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));

    const heading = await screen.findByRole('heading', { name: 'Publish to 3 people?' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText('2 on Juvi see it on their next refresh.')).toBeInTheDocument();
    expect(screen.getByText('1 not on Juvi yet get it when they activate the app.')).toBeInTheDocument();
    expect(screen.getByText(/Acknowledge by 15 Jan 2030.*\(Asia\/Kolkata\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish notice' }));

    await waitFor(() => expect(publishNotice).toHaveBeenCalledWith({
      title: 'Mid-semester timetable', body: 'Attached.', attachments: [], audience: { rules: [{ kind: 'batch', ids: ['b1'] }] },
      ackRequired: true, ackDeadline: '2030-01-15T11:30:00.000Z', ackCommentAllowed: true,
      priority: 'important', purpose: 'standard', office: 'Exam Section',
    }));
    expect(toast.success).toHaveBeenCalledWith('Notice published', 'Delivering to 3 people.');
    expect(onPublished).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the draft on Back to edit and shows a publish failure in the confirm step', async () => {
    (publishNotice as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { error: 'This audience has no members' } } });
    open({ purpose: 'welcome', title: 'Welcome to Juvi', ackRequired: true, audience: { role: [{ id: 'student', label: 'All students' }] } });
    fireEvent.change(screen.getByLabelText('Notice'), { target: { value: 'Hello.' } });
    await screen.findByText(/2 on Juvi/);
    fireEvent.click(screen.getByRole('button', { name: 'Review and publish' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publish notice' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This audience has no members');
    expect(publishNotice).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'welcome', title: 'Welcome to Juvi', audience: { rules: [{ kind: 'role', ids: ['student'] }] } }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Welcome to Juvi');
    expect(screen.getByLabelText('Notice')).toHaveValue('Hello.');
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

Extend `admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx` (the services mock gains the two functions the closed composer imports, and two tests cover the button):

```diff
--- a/admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx
+++ b/admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx
@@ -8,7 +8,7 @@
 vi.mock('../../../stores/authStore', () => ({
   useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { role: auth.role }, hasPermission: () => auth.can }),
 }));
-vi.mock('../../../services/notices', () => ({ listNotices: vi.fn(), getNoticeTargets: vi.fn() }));
+vi.mock('../../../services/notices', () => ({ listNotices: vi.fn(), getNoticeTargets: vi.fn(), previewAudience: vi.fn(), searchNoticePeople: vi.fn() }));
 import { listNotices, getNoticeTargets } from '../../../services/notices';
 
 const ROW = {
@@ -77,6 +77,21 @@
     expect(getNoticeTargets).not.toHaveBeenCalled();
   });
 
+  it('opens the composer drawer from New notice', async () => {
+    renderPage();
+    fireEvent.click(await screen.findByRole('button', { name: /new notice/i }));
+    expect(screen.getByRole('dialog', { name: 'New notice' })).toBeInTheDocument();
+    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
+    expect(screen.queryByRole('dialog')).toBeNull();
+  });
+
+  it('offers no New notice without notices:create', async () => {
+    auth.can = false;
+    renderPage();
+    await screen.findByRole('button', { name: /open notice exam timetable/i });
+    expect(screen.queryByRole('button', { name: /new notice/i })).toBeNull();
+  });
+
   it('polls while a notice is still delivering', async () => {
     vi.useFakeTimers({ shouldAdvanceTime: true });
     (listNotices as Mock)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/components/communication/__tests__/NoticeComposer.test.tsx src/pages/communication`
Expected: FAIL: `Failed to resolve import "../NoticeComposer"`, and the NoticesPage test cannot find the "New notice" button.

- [ ] **Step 3: Implement**

```tsx
// admin-portal/src/components/communication/AttachmentsField.tsx
import { useEffect, useId, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { uploadNoticeAttachment, type NoticeAttachment } from '../../services/notices';
import {
  NOTICE_ATTACHMENTS_MAX, NOTICE_ATTACHMENT_ACCEPT, NOTICE_ATTACHMENT_MAX_BYTES, NOTICE_ATTACHMENT_MIMES, formatBytes, noticeErrorMessage,
} from '../../lib/notices';

interface Slot { localId: string; name: string; size: number; progress: number; status: 'uploading' | 'done' | 'error'; error?: string; attachment?: NoticeAttachment }
export interface AttachmentsState { attachments: NoticeAttachment[]; uploading: boolean; failed: boolean }

let seq = 0;

/**
 * Notice attachments (spec §6.1): up to 5 files of 10 MB each, PDF, PNG, JPEG,
 * WEBP, DOCX, XLSX or PPTX. Each file uploads as soon as it is picked, with its
 * own progress bar; a refused or failed file stays listed with the reason until
 * removed. Uploads are plain calls, not mutations: each needs its own progress.
 */
export default function AttachmentsField({ onChange, disabled }: { onChange: (s: AttachmentsState) => void; disabled?: boolean }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChange({
      attachments: slots.flatMap((s) => (s.status === 'done' && s.attachment ? [s.attachment] : [])),
      uploading: slots.some((s) => s.status === 'uploading'),
      failed: slots.some((s) => s.status === 'error'),
    });
    // onChange is the parent's setter; only the slots drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const patch = (localId: string, p: Partial<Slot>) => setSlots((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...p } : s)));
  const kept = slots.filter((s) => s.status !== 'error').length;

  function onPick(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = '';   // the same file can be picked again after a remove
    let room = NOTICE_ATTACHMENTS_MAX - kept;
    const added: Slot[] = [];
    for (const file of files) {
      const localId = `a${++seq}`;
      const base = { localId, name: file.name, size: file.size, progress: 0 };
      let error: string | undefined;
      if (!NOTICE_ATTACHMENT_MIMES.includes(file.type)) error = 'Unsupported file type. Use PDF, PNG, JPEG, WEBP, DOCX, XLSX or PPTX.';
      else if (file.size > NOTICE_ATTACHMENT_MAX_BYTES) error = 'File too large (max 10 MB)';
      else if (room <= 0) error = `At most ${NOTICE_ATTACHMENTS_MAX} attachments`;
      if (error) { added.push({ ...base, status: 'error', error }); continue; }
      room -= 1;
      added.push({ ...base, status: 'uploading' });
      uploadNoticeAttachment(file, (pct) => patch(localId, { progress: pct }))
        .then((attachment) => patch(localId, { status: 'done', progress: 100, attachment }))
        .catch((err) => patch(localId, { status: 'error', error: noticeErrorMessage(err, 'Upload failed') }));
    }
    setSlots((prev) => [...prev, ...added]);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="block text-sm font-medium text-gray-700">Attachments</span>
        <span className="text-xs text-gray-500">{kept}/{NOTICE_ATTACHMENTS_MAX} · PDF, images, Word, Excel, PowerPoint · 10 MB each</span>
      </div>
      <label htmlFor={inputId}
        className={`mt-1 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${disabled || kept >= NOTICE_ATTACHMENTS_MAX ? 'cursor-default opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
        <Paperclip size={14} aria-hidden="true" /> Add attachments
      </label>
      <input id={inputId} ref={inputRef} type="file" multiple accept={NOTICE_ATTACHMENT_ACCEPT} className="sr-only"
        disabled={disabled || kept >= NOTICE_ATTACHMENTS_MAX} onChange={(e) => onPick(e.target.files)} />
      {slots.length > 0 && (
        <ul className="mt-2 space-y-1.5" aria-label="Attachments">
          {slots.map((s) => (
            <li key={s.localId} className="rounded-lg border px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{s.name} <span className="text-xs text-gray-500">{formatBytes(s.size)}</span></span>
                <button type="button" onClick={() => setSlots((prev) => prev.filter((x) => x.localId !== s.localId))} disabled={disabled}
                  aria-label={`Remove ${s.name}`} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={14} /></button>
              </div>
              {s.status === 'uploading' && (
                <div role="progressbar" aria-label={`Uploading ${s.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.progress}
                  className="mt-1.5 h-1.5 overflow-hidden rounded bg-gray-100">
                  <div className="h-full bg-primary-500 transition-all" style={{ width: `${s.progress}%` }} />
                </div>
              )}
              {s.status === 'error' && <p className="mt-1 text-xs text-red-600">{s.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

```tsx
// admin-portal/src/components/communication/NoticeCardPreview.tsx
import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import clsx from 'clsx';
import type { NoticePriority } from '../../services/notices';
import { PRIORITY_LABELS, formatInZone } from '../../lib/notices';

/** Time left to the deadline as a ring that empties, red once it has passed (the app's DeadlineRing). */
export function DeadlineRing({ deadline, start, now = Date.now(), size = 36 }: { deadline: string; start: number; now?: number; size?: number }) {
  const end = new Date(deadline).getTime();
  const left = Math.min(Math.max((end - now) / Math.max(end - start, 1), 0), 1);
  const passed = end <= now;
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={passed ? 'Deadline passed' : `${Math.round(left * 100)}% of the time to the deadline left`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={passed ? '#DC2626' : '#0D9488'} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - left)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

interface Props {
  title: string; body: string; office: string; audienceLine: string; priority: NoticePriority;
  ackRequired: boolean; deadline: string | null; timezone: string; attachmentCount: number;
}

/** The notice as its Juvi card will first look (spec §8 "a Juvi card preview"). */
export default function NoticeCardPreview({ title, body, office, audienceLine, priority, ackRequired, deadline, timezone, attachmentCount }: Props) {
  // The card is first seen at publish time, so the ring starts full.
  const [start] = useState(() => Date.now());
  return (
    <section aria-label="Preview in the Juvi app" className="w-full rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-gray-700">{office}</span>
        {priority !== 'routine' && (
          <span className={clsx('rounded-full px-2 py-0.5 font-medium', priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800')}>
            {PRIORITY_LABELS[priority]}
          </span>
        )}
      </div>
      <h4 className="mt-2 text-base font-semibold text-gray-900">{title.trim() || 'Notice title'}</h4>
      <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-gray-700">{body.trim() || 'The notice text appears here.'}</p>
      {attachmentCount > 0 && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500">
          <Paperclip size={12} aria-hidden="true" /> {attachmentCount} {attachmentCount === 1 ? 'attachment' : 'attachments'}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-gray-500">{audienceLine || 'Choose an audience'}</span>
        {ackRequired && (
          <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-gray-700">
            {deadline && <DeadlineRing deadline={deadline} start={start} />}
            {deadline ? `Acknowledge by ${formatInZone(deadline, timezone)}` : 'Acknowledgement required'}
          </span>
        )}
      </div>
    </section>
  );
}
```

```tsx
// admin-portal/src/components/communication/NoticeComposer.tsx
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import Drawer from '../ui/Drawer';
import AudienceBuilder, { selectionToRules, useAudiencePreview, type AudienceSelection } from './AudienceBuilder';
import AttachmentsField, { type AttachmentsState } from './AttachmentsField';
import NoticeCardPreview from './NoticeCardPreview';
import { toast } from '../../stores/toastStore';
import {
  getNoticeTargets, publishNotice, type AudiencePreview, type NoticeDetail, type NoticePriority, type NoticePurpose, type PublishNoticeInput,
} from '../../services/notices';
import {
  NOTICE_BODY_MAX, NOTICE_TITLE_MAX, PRIORITY_LABELS, URGENT_NOTE, formatInZone, isoToZonedLocal, noticeErrorMessage, zonedLocalToIso,
} from '../../lib/notices';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';
const PRIORITIES: NoticePriority[] = ['routine', 'important', 'urgent'];
const n = (x: number) => x.toLocaleString('en-IN');

/** Prefill for an embedding page (the Welcome notice setting passes purpose, title and audience). */
export interface ComposerInitial {
  title?: string;
  body?: string;
  purpose?: NoticePurpose;
  ackRequired?: boolean;
  audience?: AudienceSelection;
}

interface FormProps {
  initial?: ComposerInitial;
  onPublished: (notice: NoticeDetail) => void;
  onCancel: () => void;
  /** Attached to the title input, so a drawer can focus it on open. */
  titleRef?: RefObject<HTMLInputElement | null>;
}

/**
 * The notice composer (spec §8), embeddable on any page. Publishing is two
 * steps: "Review and publish" validates and shows the count; only "Publish
 * notice" posts. The form stays mounted (hidden) during the confirm step, so
 * uploads and picker state survive "Back to edit".
 */
export function NoticeComposerForm({ initial, onPublished, onCancel, titleRef }: FormProps) {
  const qc = useQueryClient();
  const titleId = useId();
  const bodyId = useId();
  const officeId = useId();
  const deadlineId = useId();
  const targetsQ = useQuery({ queryKey: ['notice-targets'], queryFn: getNoticeTargets, staleTime: 5 * 60_000, meta: { silentError: true } });
  const targets = targetsQ.data;
  const tz = targets?.timezone ?? 'Asia/Kolkata';

  const [office, setOffice] = useState('');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [audience, setAudience] = useState<AudienceSelection>(initial?.audience ?? {});
  const [files, setFiles] = useState<AttachmentsState>({ attachments: [], uploading: false, failed: false });
  const [ackRequired, setAckRequired] = useState(initial?.ackRequired ?? false);
  const [deadline, setDeadline] = useState('');   // datetime-local, in college time
  const [ackCommentAllowed, setAckCommentAllowed] = useState(false);
  const [priority, setPriority] = useState<NoticePriority>('routine');
  const [step, setStep] = useState<'compose' | 'confirm'>('compose');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const purpose = initial?.purpose ?? 'standard';
  const officeChoice = targets?.isAdmin ? office || targets.office : undefined;
  const rules = selectionToRules(audience);
  // Count only once /targets has said which office applies, so the first count is already the right one.
  const preview = useAudiencePreview(targets ? rules : [], officeChoice);
  const deadlineIso = ackRequired && deadline ? zonedLocalToIso(deadline, tz) : null;
  const confirming = step === 'confirm' ? preview.data : undefined;

  const publish = useMutation({
    mutationFn: (input: PublishNoticeInput) => publishNotice(input),
    // The confirm step renders a failure itself; the success toast is below.
    meta: { silent: true, silentError: true },
    onSuccess: (notice) => {
      qc.invalidateQueries({ queryKey: ['notices'] });
      const total = preview.data?.total ?? 0;
      toast.success('Notice published', `Delivering to ${n(total)} ${total === 1 ? 'person' : 'people'}.`);
      onPublished(notice);
    },
  });

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Give the notice a title';
    if (!body.trim()) e.body = 'Write the notice';
    if (rules.length === 0) e.audience = 'Choose who should receive this notice';
    else if (preview.isError) e.audience = noticeErrorMessage(preview.error);
    else if (!preview.current) e.audience = 'Wait for the audience count to finish';
    else if (preview.data?.total === 0) e.audience = 'This audience has no members';
    if (files.uploading) e.attachments = 'Wait for the uploads to finish';
    else if (files.failed) e.attachments = 'Remove the attachments that could not be uploaded';
    if (deadlineIso && new Date(deadlineIso).getTime() <= Date.now()) e.deadline = 'The deadline must be in the future';
    return e;
  }

  function review() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) setStep('confirm');
  }

  function submit() {
    publish.mutate({
      title: title.trim(), body: body.trim(), attachments: files.attachments, audience: { rules },
      ackRequired, ackDeadline: deadlineIso, ackCommentAllowed: ackRequired && ackCommentAllowed,
      priority, purpose, ...(officeChoice ? { office: officeChoice } : {}),
    });
  }

  function toggleAck(on: boolean) {
    setAckRequired(on);
    if (!on) { setDeadline(''); setAckCommentAllowed(false); }
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>;

  return (
    <>
      {confirming && (
        <ConfirmStep
          preview={confirming} office={officeChoice} deadline={deadlineIso && `${formatInZone(deadlineIso, tz)} (${tz})`}
          pending={publish.isPending} error={publish.isError ? noticeErrorMessage(publish.error) : null}
          onBack={() => setStep('compose')} onPublish={submit}
        />
      )}
      <div hidden={Boolean(confirming)}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-5">
            {targetsQ.isError && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{noticeErrorMessage(targetsQ.error)}</p>
            )}
            {targets?.isAdmin ? (
              <div>
                <label htmlFor={officeId} className={lbl}>Publish as</label>
                <select id={officeId} className={inp} value={officeChoice} onChange={(e) => setOffice(e.target.value)}>
                  {targets.offices.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ) : targets && (
              <p className="text-sm text-gray-600">Publishing as <span className="font-medium text-gray-900">{targets.office}</span></p>
            )}

            <div>
              <label htmlFor={titleId} className={lbl}>Title</label>
              <input id={titleId} ref={titleRef} className={inp} value={title} maxLength={NOTICE_TITLE_MAX} aria-describedby={`${titleId}-count`}
                onChange={(e) => setTitle(e.target.value)} />
              <p id={`${titleId}-count`} className="mt-1 text-right text-xs text-gray-500">{title.length}/{NOTICE_TITLE_MAX}</p>
              {err('title')}
            </div>

            <div>
              <label htmlFor={bodyId} className={lbl}>Notice</label>
              <textarea id={bodyId} className={inp} rows={7} value={body} maxLength={NOTICE_BODY_MAX} aria-describedby={`${bodyId}-count`}
                onChange={(e) => setBody(e.target.value)} />
              <p id={`${bodyId}-count`} className="mt-1 text-right text-xs text-gray-500">{body.length}/{NOTICE_BODY_MAX} · plain text; links are detected in the app</p>
              {err('body')}
            </div>

            <div>
              <AttachmentsField onChange={setFiles} />
              {err('attachments')}
            </div>

            {targets ? (
              <div>
                <AudienceBuilder targets={targets} value={audience} onChange={setAudience} preview={preview} />
                {err('audience')}
              </div>
            ) : !targetsQ.isError && <p className="text-sm text-gray-500">Loading who you can send to…</p>}

            <fieldset className="space-y-2">
              <legend className={lbl}>Acknowledgement</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ackRequired} onChange={(e) => toggleAck(e.target.checked)} />
                Require acknowledgement
              </label>
              <div>
                <label htmlFor={deadlineId} className={lbl}>Acknowledge by ({tz})</label>
                <input id={deadlineId} type="datetime-local" className={inp} value={deadline} disabled={!ackRequired}
                  min={isoToZonedLocal(new Date().toISOString(), tz)} onChange={(e) => setDeadline(e.target.value)} />
                <p className="mt-1 text-xs text-gray-500">Optional. Acknowledgements after it are still accepted and marked late.</p>
                {err('deadline')}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ackCommentAllowed} disabled={!ackRequired} onChange={(e) => setAckCommentAllowed(e.target.checked)} />
                Allow a comment with the acknowledgement
              </label>
            </fieldset>

            <fieldset>
              <legend className={lbl}>Priority</legend>
              <div className="flex gap-4">
                {PRIORITIES.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm">
                    <input type="radio" name="notice-priority" value={p} checked={priority === p} onChange={() => setPriority(p)} />
                    {PRIORITY_LABELS[p]}
                  </label>
                ))}
              </div>
              {priority === 'urgent' && <p className="mt-1 text-xs text-amber-700">{URGENT_NOTE}</p>}
            </fieldset>

            <div className="flex justify-end gap-2 border-t pt-4">
              <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={review} disabled={!targets}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
                Review and publish
              </button>
            </div>
          </div>

          <div className="lg:sticky lg:top-0 lg:self-start">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Preview</p>
            <NoticeCardPreview
              title={title} body={body} office={officeChoice ?? targets?.office ?? ''} audienceLine={rules.length ? preview.data?.line ?? '' : ''}
              priority={priority} ackRequired={ackRequired} deadline={deadlineIso} timezone={tz} attachmentCount={files.attachments.length}
            />
          </div>
        </div>
      </div>
    </>
  );
}

interface ConfirmProps {
  preview: AudiencePreview; office?: string; deadline: string | null;
  pending: boolean; error: string | null; onBack: () => void; onPublish: () => void;
}

/** Confirm-to-publish (spec §8): the count, the on-Juvi split, the deadline in college time. Takes focus. */
function ConfirmStep({ preview: d, office, deadline, pending, error, onBack, onPublish }: ConfirmProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    <div className="space-y-4">
      <h4 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-navy focus:outline-none">
        Publish to {n(d.total)} {d.total === 1 ? 'person' : 'people'}?
      </h4>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
        <li>{d.line}{office ? `, from ${office}` : ''}.</li>
        <li>{n(d.onJuvi)} on Juvi see it on their next refresh.</li>
        {d.notOnJuvi > 0 && <li>{n(d.notOnJuvi)} not on Juvi yet get it when they activate the app.</li>}
        {deadline && <li>Acknowledge by {deadline}.</li>}
        <li>A published notice cannot be edited. You can archive it.</li>
      </ul>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onBack} disabled={pending} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Back to edit</button>
        <button type="button" onClick={onPublish} disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
          <Send size={15} /> {pending ? 'Publishing…' : 'Publish notice'}
        </button>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: ComposerInitial;
  onPublished?: (notice: NoticeDetail) => void;
  title?: string;
}

/** `<NoticeComposer />`: the composer in a drawer. It unmounts on close, so every opening starts fresh. */
export default function NoticeComposer({ open, onClose, initial, onPublished, title = 'New notice' }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  return (
    <Drawer open={open} onClose={onClose} title={title} description="Sent to the Juvi app. A published notice cannot be edited." widthClass="max-w-4xl" initialFocus={titleRef}>
      <NoticeComposerForm initial={initial} titleRef={titleRef} onCancel={onClose} onPublished={(notice) => { onPublished?.(notice); onClose(); }} />
    </Drawer>
  );
}
```

Mount the drawer on the list, behind `notices:create`:

```diff
--- a/admin-portal/src/pages/communication/NoticesPage.tsx
+++ b/admin-portal/src/pages/communication/NoticesPage.tsx
@@ -1,10 +1,12 @@
 import { useState } from 'react';
 import { useQuery } from '@tanstack/react-query';
 import { useNavigate } from 'react-router-dom';
+import { Plus } from 'lucide-react';
 import DataTable from '../../components/ui/DataTable';
 import Badge from '../../components/ui/Badge';
 import Pagination from '../../components/ui/Pagination';
 import SearchInput from '../../components/ui/SearchInput';
+import NoticeComposer from '../../components/communication/NoticeComposer';
 import { useListControls } from '../../hooks/useListControls';
 import { useAuthStore } from '../../stores/authStore';
 import { listNotices, getNoticeTargets, type NoticeRow, type NoticeStatus } from '../../services/notices';
@@ -28,6 +30,7 @@
   const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
   const [status, setStatus] = useState<'' | NoticeStatus>('');
   const [office, setOffice] = useState('');
+  const [composing, setComposing] = useState(false);
 
   const { data, isLoading } = useQuery({
     queryKey: ['notices', { page, limit, search, status, office }],
@@ -65,6 +68,12 @@
           <h2 className="text-xl font-bold text-navy">Notices</h2>
           <p className="mt-1 text-sm text-gray-500">Official notices sent to the Juvi app, with who has seen and acknowledged each one.</p>
         </div>
+        {canCreate && (
+          <button type="button" onClick={() => setComposing(true)}
+            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700">
+            <Plus size={16} /> New notice
+          </button>
+        )}
       </div>
 
       <div className="mb-4 flex flex-wrap items-center gap-3">
@@ -97,6 +106,7 @@
       {data && (
         <Pagination page={data.page} pages={data.pages} total={data.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} itemLabel="notices" />
       )}
+      <NoticeComposer open={composing} onClose={() => setComposing(false)} />
     </div>
   );
 }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/components/communication src/pages/communication`
Expected: PASS (3 files, 23 tests).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/components/communication/AttachmentsField.tsx admin-portal/src/components/communication/NoticeCardPreview.tsx admin-portal/src/components/communication/NoticeComposer.tsx admin-portal/src/components/communication/__tests__/NoticeComposer.test.tsx admin-portal/src/pages/communication/NoticesPage.tsx admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx
git commit -m "feat(admin-portal): NoticeComposer drawer with preview and confirm-to-publish

Office selector for admins, counted title and body, per-file upload
progress, acknowledgement with a college-time deadline and comments,
priority with the Urgent note, a Juvi card preview with the deadline ring,
and a confirm step that shows the live count before anything is posted.
NoticeComposerForm is exported for embedding on other pages.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Portal: notice detail page and the Reach tab

**Files:**
- Create: `admin-portal/src/pages/communication/NoticeDetailPage.tsx`, `admin-portal/src/components/communication/ReachTab.tsx`
- Modify: `admin-portal/src/pages/Communication.tsx`
- Test: `admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx`, `admin-portal/src/components/communication/__tests__/ReachTab.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`getNotice`, `getReach`, `getPending`, `getAllPending`, `downloadReachCsv`, `remindNotice`, `archiveNotice`, `NoticeDetail`, `Reach`, `ReachState`, `Reminders`, `PENDING_STATE_LABELS`, `PRIORITY_LABELS`, `deadlineText`, `errorDetail`, `errorStatus`, `formatBytes`, `formatWhen`, `isNoticeAdmin`, `noticeErrorMessage`, `noticeStatus`, `pendingAsText`); `saveBlob` (`services/juvi-app.ts`); `confirmAction`, `toast`, `useAuthStore`; `Badge`, `SearchInput`.
- Produces:
  ```ts
  // pages/communication/NoticeDetailPage.tsx — default export; mounted at /communication/notices/:id/*
  //   tabs (absolute NavLinks): Reach = index (Task 8 adds audit, delivery)
  // components/communication/ReachTab.tsx — default export ReachTab({ notice }: { notice: NoticeDetail })
  // React Query keys: ['notice', id], ['notice-reach', id], ['notice-pending', id, { q, group }]
  ```

The Reach tab is the ERP side of S11:
- **Counts:** the four buckets, shown with the reconciliation written out ("4 acknowledged + 3 seen + 1 not seen + 2 not on Juvi = 10 in the audience snapshot"), and an alert if they ever fail to add up. A notice without acknowledgement shows "Seen" and the dismissed count instead of the acknowledged and late counts.
- **Per-group breakdown** by batch, section or department.
- **Pending list:** paged 50 at a time with `useInfiniteQuery` over the server cursor ("Load more"), searchable by name or roll number, filterable by group, and showing each member's last time in the app.
- **Separate lists** for late acknowledgements, comments (only when comments were allowed) and added-later members, which are stated not to count as pending.
- **Actions:**
  - "Remind (n of 2 used)" is confirmed first and disabled at the cap or unless the notice is published. A REMINDER_LIMIT 409 shows the server's reason and applies the `detail.reminders` it carries.
  - "Archive" uses a danger confirmation.
  - "Export CSV" is shown to admins only (the server refuses others anyway).
  - "Copy pending list" fetches every pending page and copies `pendingAsText` to the clipboard.
- **Feedback:** every mutation toasts for itself under `meta: { silent: true, silentError: true }`.
- **Before delivery:** while the notice is still `publishing`, nothing is fetched and the tab points to Delivery.
- **Detail page:** it polls while delivering, and a 404 says the notice is not one the caller can see. The server answers 404, not 403, for someone else's notice.

- [ ] **Step 1: Write the failing tests**

```tsx
// admin-portal/src/components/communication/__tests__/ReachTab.test.tsx
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import ReachTab from '../ReachTab';
import { renderWithProviders } from '../../../__tests__/test-utils';
import type { NoticeDetail, Reach } from '../../../services/notices';

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { role: auth.role } }) }));
vi.mock('../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const confirm = vi.hoisted(() => ({ confirmed: true }));
vi.mock('../../../stores/confirmStore', () => ({ confirmAction: vi.fn(() => Promise.resolve(confirm)) }));
vi.mock('../../../services/juvi-app', () => ({ saveBlob: vi.fn() }));
vi.mock('../../../services/notices', () => ({
  getReach: vi.fn(), getPending: vi.fn(), getAllPending: vi.fn(), downloadReachCsv: vi.fn(), remindNotice: vi.fn(), archiveNotice: vi.fn(),
}));
import { getReach, getPending, getAllPending, downloadReachCsv, remindNotice, archiveNotice } from '../../../services/notices';
import { saveBlob } from '../../../services/juvi-app';
import { toast } from '../../../stores/toastStore';
import { confirmAction } from '../../../stores/confirmStore';

const NOTICE = {
  id: 'n1', title: 'Exam timetable', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published', purpose: 'standard',
  delivery: { state: 'delivered', attempts: 1, lastError: null, updatedAt: null }, publishedAt: '2026-09-30T04:00:00.000Z', createdAt: '2026-09-30T04:00:00.000Z',
  ackRequired: true, deadline: '2026-10-05T11:30:00.000Z', deadlineState: 'open', counts: { audience: 10, onJuvi: 8 }, acknowledged: 4, seen: 3,
  reminders: { used: 1, max: 2, lastAt: '2026-09-30T06:00:00.000Z' }, isMine: true,
  body: 'Attached.', attachments: [], audience: { rules: [{ kind: 'batch', ids: ['b1'] }], line: 'Sent to 2024 Batch' },
  ackCommentAllowed: true, priority: 'routine', archivedAt: null, canManage: true,
} as NoticeDetail;
const person = (name: string, extra: object = {}) => ({ name, identifier: `24JIT-${name[0]}`, group: '2024 Batch · Section A', at: '2026-10-06T04:00:00.000Z', ...extra });
const REACH: Reach = {
  noticeId: 'n1', title: 'Exam timetable', status: 'published', ackRequired: true, deadline: NOTICE.deadline, publishedAt: NOTICE.publishedAt,
  audience: 10, acknowledged: 4, seen: 3, notSeen: 1, notOnJuvi: 2, dismissed: 0, late: 1,
  reminders: { used: 1, max: 2, lastAt: '2026-09-30T06:00:00.000Z' }, sparkline: [],
  groups: [{ label: '2024 Batch · Section A', total: 10, acknowledged: 4, seen: 3, notSeen: 1, notOnJuvi: 2 }],
  lateAcks: [person('Lata Late')],
  comments: [{ ...person('Chitra Comment'), comment: 'Will the hall change?', late: false }],
  addedLater: { total: 1, acknowledged: 0, seen: 1, items: [{ ...person('Arjun Added'), state: 'seen' }] },
  asOf: '2026-10-01T04:00:00.000Z',
};
const PENDING = (items: object[], nextCursor: string | null = null) => ({ items, total: 3, groups: [{ label: '2024 Batch · Section A', count: 3 }], nextCursor });
const pendingPerson = (name: string, state = 'not_seen') => ({ name, identifier: null, group: '2024 Batch · Section A', state, lastSeenInApp: state === 'not_on_juvi' ? null : '2026-09-29T04:00:00.000Z' });

beforeEach(() => {
  vi.clearAllMocks(); auth.role = 'admin'; confirm.confirmed = true;
  (getReach as Mock).mockResolvedValue(REACH);
  (getPending as Mock).mockImplementation(async (_id: string, q: { cursor?: string }) =>
    (q.cursor ? PENDING([pendingPerson('Pallavi Pending')]) : PENDING([pendingPerson('Nikhil Notseen'), pendingPerson('Omar Offline', 'not_on_juvi')], 'c2')));
  (remindNotice as Mock).mockResolvedValue({ reminders: { used: 2, max: 2, lastAt: '2026-10-01T05:00:00.000Z' } });
  (archiveNotice as Mock).mockResolvedValue({ status: 'archived', archivedAt: '2026-10-01T05:00:00.000Z' });
});

describe('ReachTab', () => {
  it('reconciles the counts to the snapshot and breaks them down by group', async () => {
    renderWithProviders(<ReachTab notice={NOTICE} />);
    expect(await screen.findByText('4 acknowledged + 3 seen + 1 not seen + 2 not on Juvi = 10 in the audience snapshot')).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Reach summary' });
    expect(within(summary).getByText('Seen, not acknowledged')).toBeInTheDocument();
    expect(within(summary).getByText(/1 acknowledged late/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    const groups = screen.getByRole('region', { name: 'By batch, section or department' });
    expect(within(groups).getByText('2024 Batch · Section A')).toBeInTheDocument();
  });

  it('pages and searches the pending list, with last-seen-in-app', async () => {
    renderWithProviders(<ReachTab notice={NOTICE} />);
    const table = await screen.findByRole('table', { name: 'Pending members' });
    expect(within(table).getByText('Nikhil Notseen')).toBeInTheDocument();
    expect(within(table).getByText('Not on Juvi')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await within(table).findByText('Pallavi Pending')).toBeInTheDocument();
    expect(getPending).toHaveBeenLastCalledWith('n1', { cursor: 'c2', limit: 50 });
    fireEvent.change(screen.getByLabelText('Search pending'), { target: { value: 'nik' } });
    await waitFor(() => expect(getPending).toHaveBeenLastCalledWith('n1', { q: 'nik', limit: 50 }));
    fireEvent.change(screen.getByLabelText('Group'), { target: { value: '2024 Batch · Section A' } });
    await waitFor(() => expect(getPending).toHaveBeenLastCalledWith('n1', { q: 'nik', group: '2024 Batch · Section A', limit: 50 }));
  });

  it('lists late acknowledgements, comments and added-later members separately', async () => {
    renderWithProviders(<ReachTab notice={NOTICE} />);
    expect(await screen.findByRole('table', { name: 'Late acknowledgements' })).toHaveTextContent('Lata Late');
    expect(screen.getByText('Will the hall change?')).toBeInTheDocument();
    const later = screen.getByRole('table', { name: 'Added later' });
    expect(within(later).getByText('Arjun Added')).toBeInTheDocument();
    expect(screen.getByText(/They are not counted as pending/)).toBeInTheDocument();
  });

  it('confirms and sends a reminder, then shows the cap reached', async () => {
    renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remind (1 of 2 used)' }));
    await waitFor(() => expect(remindNotice).toHaveBeenCalledWith('n1'));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: 'Send a reminder?', message: expect.stringContaining('This is the last reminder you can send.') }));
    expect(toast.success).toHaveBeenCalledWith('Reminder sent', '2 of 2 reminders used.');
    expect(await screen.findByRole('button', { name: 'Remind (2 of 2 used)' })).toBeDisabled();
  });

  it('shows a refused third reminder with the server reason and the count it carries', async () => {
    (remindNotice as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { error: 'A notice can have at most two reminders.', detail: { reminders: { used: 2, max: 2, lastAt: null } } } } });
    renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remind (1 of 2 used)' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not send the reminder', 'A notice can have at most two reminders.'));
    expect(await screen.findByRole('button', { name: 'Remind (2 of 2 used)' })).toBeDisabled();
  });

  it('archives after a danger confirmation', async () => {
    renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(archiveNotice).toHaveBeenCalledWith('n1'));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }));
    expect(toast.success).toHaveBeenCalledWith('Notice archived', expect.any(String));
  });

  it('does nothing when a confirmation is cancelled', async () => {
    confirm.confirmed = false;
    renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalled());
    expect(archiveNotice).not.toHaveBeenCalled();
  });

  it('exports CSV for admins only', async () => {
    (downloadReachCsv as Mock).mockResolvedValue({ blob: new Blob(['x']), filename: 'notice-reach-abc123.csv' });
    const { unmount } = renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'notice-reach-abc123.csv'));
    unmount();
    auth.role = 'staff';
    renderWithProviders(<ReachTab notice={NOTICE} />);
    await screen.findByText(/in the audience snapshot/);
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('copies every pending member as grouped text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    (getAllPending as Mock).mockResolvedValue([pendingPerson('Nikhil Notseen'), pendingPerson('Omar Offline', 'not_on_juvi')]);
    renderWithProviders(<ReachTab notice={NOTICE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copy pending list' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0]![0] as string;
    expect(text).toContain('Pending for "Exam timetable": 2');
    expect(text).toContain('- Omar Offline: Not on Juvi');
    expect(toast.success).toHaveBeenCalledWith('Pending list copied', '2 people.');
  });

  it('waits for delivery before asking for reach', () => {
    renderWithProviders(<ReachTab notice={{ ...NOTICE, status: 'publishing' }} />);
    expect(screen.getByText(/Reach appears once delivery has finished/)).toBeInTheDocument();
    expect(getReach).not.toHaveBeenCalled();
  });
});
```

```tsx
// admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import NoticeDetailPage from '../NoticeDetailPage';
import { renderWithProviders } from '../../../__tests__/test-utils';

vi.mock('../../../components/communication/ReachTab', () => ({ default: () => <p>Reach tab</p> }));
vi.mock('../../../services/notices', () => ({ getNotice: vi.fn() }));
import { getNotice } from '../../../services/notices';

const NOTICE = {
  id: 'n1', title: 'Exam timetable', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published', purpose: 'standard',
  delivery: { state: 'delivered', attempts: 1, lastError: null, updatedAt: null }, publishedAt: '2026-09-30T04:00:00.000Z', createdAt: '2026-09-30T04:00:00.000Z',
  ackRequired: true, deadline: null, deadlineState: 'none', counts: { audience: 10, onJuvi: 8 }, acknowledged: 4, seen: 3,
  reminders: { used: 0, max: 2, lastAt: null }, isMine: true,
  body: 'The timetable is attached.', attachments: [{ key: 'k1', name: 'timetable.pdf', mime: 'application/pdf', size: 2048 }],
  audience: { rules: [{ kind: 'batch', ids: ['b1'] }], line: 'Sent to 2024 Batch' },
  ackCommentAllowed: false, priority: 'urgent', archivedAt: null, canManage: true,
};

function renderAt(path: string) {
  return renderWithProviders(
    <Routes><Route path="/communication/notices/:id/*" element={<NoticeDetailPage />} /></Routes>,
    { route: path },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (getNotice as Mock).mockResolvedValue(NOTICE);
});

describe('NoticeDetailPage', () => {
  it('shows the notice and opens on the Reach tab', async () => {
    renderAt('/communication/notices/n1');
    expect(await screen.findByRole('heading', { name: 'Exam timetable' })).toBeInTheDocument();
    expect(getNotice).toHaveBeenCalledWith('n1');
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText(/Exam Section · Sent to 2024 Batch/)).toBeInTheDocument();
    expect(screen.getByText('The timetable is attached.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('timetable.pdf');
    expect(screen.getByRole('link', { name: 'Reach' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Reach tab')).toBeInTheDocument();
  });

  it('says so when the notice is not one the caller can see', async () => {
    (getNotice as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 404, data: { error: 'Notice not found' } } });
    renderAt('/communication/notices/nope');
    expect(await screen.findByRole('alert')).toHaveTextContent('This notice does not exist, or it is not one you can see.');
    expect(screen.getByRole('link', { name: 'Back to notices' })).toHaveAttribute('href', '/communication/notices');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/components/communication/__tests__/ReachTab.test.tsx src/pages/communication/__tests__/NoticeDetailPage.test.tsx`
Expected: FAIL: `Failed to resolve import "../ReachTab"` and `"../NoticeDetailPage"`.

- [ ] **Step 3: Implement**

```tsx
// admin-portal/src/components/communication/ReachTab.tsx
import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, BellRing, ClipboardCopy, Download } from 'lucide-react';
import Badge from '../ui/Badge';
import SearchInput from '../ui/SearchInput';
import { useAuthStore } from '../../stores/authStore';
import { confirmAction } from '../../stores/confirmStore';
import { toast } from '../../stores/toastStore';
import { saveBlob } from '../../services/juvi-app';
import {
  archiveNotice, downloadReachCsv, getAllPending, getPending, getReach, remindNotice,
  type NoticeDetail, type Reach, type ReachState, type Reminders,
} from '../../services/notices';
import { PENDING_STATE_LABELS, errorDetail, errorStatus, formatWhen, isNoticeAdmin, noticeErrorMessage, pendingAsText } from '../../lib/notices';

const sel = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const btn = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const th = 'px-3 py-2 text-left font-medium text-gray-600';
const td = 'px-3 py-2';
const REACH_STATE_LABELS: Record<ReachState, string> = { acknowledged: 'Acknowledged', seen: 'Seen', not_seen: 'Not seen', not_on_juvi: 'Not on Juvi' };
const PENDING_PAGE = 50;
const n = (x: number) => x.toLocaleString('en-IN');

/**
 * Reach, the ERP side of S11 (spec §8, US-4): counts that reconcile to the
 * audience snapshot, the per-group breakdown, the pending list, late
 * acknowledgements, comments, added-later members, CSV (admins), copy
 * pending, remind (at most 2) and archive.
 */
export default function ReachTab({ notice }: { notice: NoticeDetail }) {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const admin = isNoticeAdmin(role);
  const id = notice.id;
  const delivered = notice.status !== 'publishing';
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');

  const reachQ = useQuery({ queryKey: ['notice-reach', id], queryFn: () => getReach(id), enabled: delivered, meta: { silentError: true } });
  const pendingQ = useInfiniteQuery({
    queryKey: ['notice-pending', id, { q, group }],
    queryFn: ({ pageParam }) => getPending(id, { q: q || undefined, group: group || undefined, cursor: pageParam, limit: PENDING_PAGE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: delivered,
    meta: { silentError: true },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notice', id] });
    qc.invalidateQueries({ queryKey: ['notices'] });
  };
  const setReminders = (reminders: Reminders) =>
    qc.setQueryData<Reach>(['notice-reach', id], (old) => (old ? { ...old, reminders } : old));

  const remind = useMutation({
    mutationFn: () => remindNotice(id),
    meta: { silent: true, silentError: true },
    onSuccess: ({ reminders }) => {
      setReminders(reminders);
      refresh();
      toast.success('Reminder sent', `${reminders.used} of ${reminders.max} reminders used.`);
    },
    onError: (err) => {
      // A REMINDER_LIMIT 409 carries the current count; show it rather than a stale one.
      const reminders = errorDetail<{ reminders: Reminders }>(err)?.reminders;
      if (reminders) setReminders(reminders);
      toast.error('Could not send the reminder', noticeErrorMessage(err));
    },
  });
  const archive = useMutation({
    mutationFn: () => archiveNotice(id),
    meta: { silent: true, silentError: true },
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ['notice-reach', id] });
      toast.success('Notice archived', 'It is read-only in the app now. Its reach is kept.');
    },
    onError: (err) => toast.error('Could not archive the notice', noticeErrorMessage(err)),
  });
  const csv = useMutation({
    mutationFn: () => downloadReachCsv(id),
    meta: { silent: true, silentError: true },
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (err) => toast.error('Could not export the reach', noticeErrorMessage(err)),
  });
  const copy = useMutation({
    mutationFn: async () => {
      const people = await getAllPending(id);
      await navigator.clipboard.writeText(pendingAsText(notice.title, people));
      return people.length;
    },
    meta: { silent: true, silentError: true },
    onSuccess: (count) => toast.success('Pending list copied', `${n(count)} ${count === 1 ? 'person' : 'people'}.`),
    onError: (err) => toast.error('Could not copy the pending list', noticeErrorMessage(err)),
  });

  async function onRemind(r: Reminders) {
    const left = r.max - r.used - 1;
    const { confirmed } = await confirmAction({
      title: 'Send a reminder?',
      message: `Everyone who has not ${notice.ackRequired ? 'acknowledged' : 'seen'} it yet is reminded on their next refresh. ${left === 0 ? 'This is the last reminder you can send.' : `${left} more can be sent after this.`}`,
      confirmLabel: 'Send reminder',
    });
    if (confirmed) remind.mutate();
  }
  async function onArchive() {
    const { confirmed } = await confirmAction({
      title: 'Archive this notice?',
      message: 'It becomes read-only in the app and leaves everyone\'s Due list. Its reach is kept. This cannot be undone.',
      confirmLabel: 'Archive', tone: 'danger',
    });
    if (confirmed) archive.mutate();
  }

  if (!delivered) return <p className="text-sm text-gray-500">Reach appears once delivery has finished. See the Delivery tab.</p>;
  if (reachQ.isError) {
    return <p role="alert" className="text-sm text-red-700">{errorStatus(reachQ.error) === 403 ? 'Only the publisher and admins can see reach. ' : ''}{noticeErrorMessage(reachQ.error)}</p>;
  }
  const r = reachQ.data;
  if (!r) return <p className="text-sm text-gray-500">Loading reach…</p>;

  const sum = r.acknowledged + r.seen + r.notSeen + r.notOnJuvi;
  const pendingRows = pendingQ.data?.pages.flatMap((p) => p.items) ?? [];
  const firstPage = pendingQ.data?.pages[0];
  const remindBlocked = r.reminders.used >= r.reminders.max || r.status !== 'published';
  const cards = [
    { label: 'Acknowledged', value: r.acknowledged, hidden: !r.ackRequired },
    { label: r.ackRequired ? 'Seen, not acknowledged' : 'Seen', value: r.seen },
    { label: 'Not seen', value: r.notSeen },
    { label: 'Not on Juvi', value: r.notOnJuvi },
  ].filter((c) => !c.hidden);

  return (
    <div className="space-y-6">
      <section aria-label="Reach summary" className="rounded-xl border bg-white p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label}>
              <dt className="text-xs text-gray-500">{c.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-gray-900">{n(c.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-gray-600">
          {n(r.acknowledged)} acknowledged + {n(r.seen)} seen + {n(r.notSeen)} not seen + {n(r.notOnJuvi)} not on Juvi = {n(r.audience)} in the audience snapshot
        </p>
        {sum !== r.audience && <p role="alert" className="mt-1 text-sm text-red-700">These counts do not add up to the snapshot. Refresh the page; if it persists, report it.</p>}
        <p className="mt-1 text-xs text-gray-500">
          {r.ackRequired ? `${n(r.late)} acknowledged late` : `${n(r.dismissed)} dismissed`} · as of {formatWhen(r.asOf)}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {notice.canManage && (
            <button type="button" className={btn} onClick={() => onRemind(r.reminders)} disabled={remindBlocked || remind.isPending}
              title={r.reminders.used >= r.reminders.max ? 'A notice can have at most two reminders.' : r.status !== 'published' ? 'Only a published notice can be reminded.' : undefined}>
              <BellRing size={14} /> Remind ({r.reminders.used} of {r.reminders.max} used)
            </button>
          )}
          <button type="button" className={btn} onClick={() => copy.mutate()} disabled={copy.isPending}>
            <ClipboardCopy size={14} /> Copy pending list
          </button>
          {admin && (
            <button type="button" className={btn} onClick={() => csv.mutate()} disabled={csv.isPending}>
              <Download size={14} /> Export CSV
            </button>
          )}
          {notice.canManage && notice.status !== 'archived' && (
            <button type="button" className={`${btn} text-red-700`} onClick={onArchive} disabled={archive.isPending}>
              <Archive size={14} /> Archive
            </button>
          )}
        </div>
        {r.reminders.lastAt && <p className="mt-2 text-xs text-gray-500">Last reminder {formatWhen(r.reminders.lastAt)}</p>}
      </section>

      {r.groups.length > 0 && (
        <section aria-labelledby="reach-groups" className="overflow-x-auto rounded-xl border bg-white">
          <h3 id="reach-groups" className="px-5 pt-4 text-sm font-semibold text-navy">By batch, section or department</h3>
          <table className="mt-2 w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr><th className={th}>Group</th><th className={th}>Total</th>{r.ackRequired && <th className={th}>Acknowledged</th>}<th className={th}>Seen</th><th className={th}>Not seen</th><th className={th}>Not on Juvi</th></tr>
            </thead>
            <tbody className="divide-y">
              {r.groups.map((g) => (
                <tr key={g.label}>
                  <td className={td}>{g.label}</td><td className={`${td} tabular-nums`}>{g.total}</td>
                  {r.ackRequired && <td className={`${td} tabular-nums`}>{g.acknowledged}</td>}
                  <td className={`${td} tabular-nums`}>{g.seen}</td><td className={`${td} tabular-nums`}>{g.notSeen}</td><td className={`${td} tabular-nums`}>{g.notOnJuvi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="reach-pending" className="rounded-xl border bg-white p-5">
        <h3 id="reach-pending" className="text-sm font-semibold text-navy">Pending{firstPage ? ` (${n(firstPage.total)})` : ''}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name or roll number…" className="w-72" aria-label="Search pending" />
          <label className="sr-only" htmlFor="pending-group">Group</label>
          <select id="pending-group" className={sel} value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">All groups</option>
            {(firstPage?.groups ?? []).map((g) => <option key={g.label} value={g.label}>{g.label} ({g.count})</option>)}
          </select>
        </div>
        {pendingQ.isError && <p role="alert" className="mt-3 text-sm text-red-700">{noticeErrorMessage(pendingQ.error)}</p>}
        {pendingRows.length === 0 && !pendingQ.isLoading ? (
          <p className="mt-3 text-sm text-gray-500">{q || group ? 'Nobody pending matches.' : 'Nobody is pending.'}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm" aria-label="Pending members">
              <thead className="border-b bg-gray-50">
                <tr><th className={th}>Name</th><th className={th}>Roll / employee no.</th><th className={th}>Group</th><th className={th}>State</th><th className={th}>Last in the app</th></tr>
              </thead>
              <tbody className="divide-y">
                {pendingRows.map((p, i) => (
                  <tr key={`${p.group}:${p.name}:${i}`}>
                    <td className={td}>{p.name}</td><td className={td}>{p.identifier ?? '—'}</td><td className={td}>{p.group}</td>
                    <td className={td}>{PENDING_STATE_LABELS[p.state]}</td><td className={td}>{p.state === 'not_on_juvi' ? '—' : formatWhen(p.lastSeenInApp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span aria-live="polite">{firstPage ? `Showing ${n(pendingRows.length)} of ${n(firstPage.total)}` : ''}</span>
          {pendingQ.hasNextPage && (
            <button type="button" className={btn} onClick={() => pendingQ.fetchNextPage()} disabled={pendingQ.isFetchingNextPage}>Load more</button>
          )}
        </div>
      </section>

      {r.ackRequired && (
        <section aria-labelledby="reach-late" className="rounded-xl border bg-white p-5">
          <h3 id="reach-late" className="text-sm font-semibold text-navy">Late acknowledgements ({n(r.late)})</h3>
          {r.lateAcks.length === 0 ? <p className="mt-2 text-sm text-gray-500">None.</p> : (
            <table className="mt-2 w-full text-sm" aria-label="Late acknowledgements">
              <thead className="border-b bg-gray-50"><tr><th className={th}>Name</th><th className={th}>Roll / employee no.</th><th className={th}>Group</th><th className={th}>Acknowledged</th></tr></thead>
              <tbody className="divide-y">
                {r.lateAcks.map((p, i) => (
                  <tr key={`${p.name}:${i}`}><td className={td}>{p.name}</td><td className={td}>{p.identifier ?? '—'}</td><td className={td}>{p.group}</td><td className={td}>{formatWhen(p.at)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {notice.ackCommentAllowed && (
        <section aria-labelledby="reach-comments" className="rounded-xl border bg-white p-5">
          <h3 id="reach-comments" className="text-sm font-semibold text-navy">Comments ({n(r.comments.length)})</h3>
          {r.comments.length === 0 ? <p className="mt-2 text-sm text-gray-500">No comments yet.</p> : (
            <ul className="mt-2 divide-y">
              {r.comments.map((c, i) => (
                <li key={`${c.name}:${i}`} className="py-2 text-sm">
                  <p className="text-gray-900"><span className="font-medium">{c.name}</span> <span className="text-gray-500">· {c.group} · {formatWhen(c.at)}</span> {c.late && <Badge variant="warning">Late</Badge>}</p>
                  <p className="mt-0.5 whitespace-pre-line text-gray-700">{c.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="reach-later" className="rounded-xl border bg-white p-5">
        <h3 id="reach-later" className="text-sm font-semibold text-navy">Added later ({n(r.addedLater.total)})</h3>
        <p className="mt-1 text-xs text-gray-500">
          People who matched the audience after it was published: {n(r.addedLater.acknowledged)} acknowledged, {n(r.addedLater.seen)} seen. They are not counted as pending.
        </p>
        {r.addedLater.items.length > 0 && (
          <table className="mt-2 w-full text-sm" aria-label="Added later">
            <thead className="border-b bg-gray-50"><tr><th className={th}>Name</th><th className={th}>Roll / employee no.</th><th className={th}>Group</th><th className={th}>State</th><th className={th}>When</th></tr></thead>
            <tbody className="divide-y">
              {r.addedLater.items.map((p, i) => (
                <tr key={`${p.name}:${i}`}><td className={td}>{p.name}</td><td className={td}>{p.identifier ?? '—'}</td><td className={td}>{p.group}</td><td className={td}>{REACH_STATE_LABELS[p.state]}</td><td className={td}>{formatWhen(p.at)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
```

```tsx
// admin-portal/src/pages/communication/NoticeDetailPage.tsx
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom';
import { ArrowLeft, Paperclip } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import ReachTab from '../../components/communication/ReachTab';
import { getNotice } from '../../services/notices';
import { PRIORITY_LABELS, deadlineText, errorStatus, formatBytes, formatWhen, noticeErrorMessage, noticeStatus } from '../../lib/notices';

/** Polled while the fan-out runs, so "Delivering…" settles on its own. */
const DELIVERING_POLL_MS = 3000;

export default function NoticeDetailPage() {
  const { id = '' } = useParams();
  const { data: notice, isLoading, isError, error } = useQuery({
    queryKey: ['notice', id],
    queryFn: () => getNotice(id),
    refetchInterval: (q) => (q.state.data?.delivery.state === 'delivering' ? DELIVERING_POLL_MS : false),
    meta: { silentError: true },
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading notice…</p>;
  if (isError || !notice) {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p className="text-red-700">
          {errorStatus(error) === 404 ? 'This notice does not exist, or it is not one you can see.' : noticeErrorMessage(error)}
        </p>
        <Link to="/communication/notices" className="text-primary-700 underline">Back to notices</Link>
      </div>
    );
  }

  const status = noticeStatus(notice);
  const base = `/communication/notices/${notice.id}`;
  // Absolute targets, as in JuviAdminPage: this page is mounted at "notices/:id/*".
  const tabs = [
    { to: base, label: 'Reach', end: true },
  ];

  return (
    <div>
      <Link to="/communication/notices" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={14} /> Notices
      </Link>
      <div className="mb-4 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-navy">{notice.title}</h2>
          <Badge variant={status.variant}>{status.label}</Badge>
          {notice.priority !== 'routine' && <Badge variant={notice.priority === 'urgent' ? 'danger' : 'warning'}>{PRIORITY_LABELS[notice.priority]}</Badge>}
          {notice.purpose === 'welcome' && <Badge variant="teal">Welcome</Badge>}
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {notice.office} · {notice.audience.line} · Published {formatWhen(notice.publishedAt)} · {deadlineText(notice)}
        </p>
        <p className="mt-3 whitespace-pre-line text-sm text-gray-800">{notice.body}</p>
        {notice.attachments.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Attachments">
            {notice.attachments.map((a) => (
              <li key={a.key} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">
                <Paperclip size={12} aria-hidden="true" /> {a.name} <span className="text-gray-500">{formatBytes(a.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav className="mb-5 flex gap-1 border-b" aria-label="Notice sections">
        {tabs.map((t) => (
          <NavLink key={t.label} to={t.to} end={t.end}
            className={({ isActive }) => `-mb-px border-b-2 px-4 py-2 text-sm ${isActive ? 'border-primary-600 font-medium text-primary-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<ReachTab notice={notice} />} />
      </Routes>
    </div>
  );
}
```

Route the detail page from the hub:

```diff
--- a/admin-portal/src/pages/Communication.tsx
+++ b/admin-portal/src/pages/Communication.tsx
@@ -1,5 +1,6 @@
 import { Navigate, Route, Routes } from 'react-router-dom';
 import NoticesPage from './communication/NoticesPage';
+import NoticeDetailPage from './communication/NoticeDetailPage';
 
 /**
  * Communication hub (notices spec §8), gated on `notices:read` in App.tsx.
@@ -10,6 +11,7 @@
     <Routes>
       <Route index element={<Navigate to="notices" replace />} />
       <Route path="notices" element={<NoticesPage />} />
+      <Route path="notices/:id/*" element={<NoticeDetailPage />} />
     </Routes>
   );
 }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/components/communication src/pages/communication`
Expected: PASS (5 files, 35 tests).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/pages/communication/NoticeDetailPage.tsx admin-portal/src/components/communication/ReachTab.tsx admin-portal/src/pages/Communication.tsx admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx admin-portal/src/components/communication/__tests__/ReachTab.test.tsx
git commit -m "feat(admin-portal): notice detail page with the Reach tab

Counts reconcile to the audience snapshot on screen, with the per-group
breakdown, a paged and searchable pending list with last-seen-in-app, late
acknowledgements, comments and added-later members. Remind (at most 2),
archive, CSV for admins and copy-pending-as-text.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Portal: Audit and Delivery tabs, Retry delivery, and the failed-deliveries panel

**Files:**
- Create: `admin-portal/src/components/communication/AuditTab.tsx`, `admin-portal/src/components/communication/DeliveryTab.tsx`, `admin-portal/src/components/communication/DeadEventsPanel.tsx`
- Modify: `admin-portal/src/pages/communication/NoticeDetailPage.tsx`, `admin-portal/src/pages/communication/NoticesPage.tsx`
- Test: `admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx` (create); `admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx`, `admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 3 (`getNoticeAudit`, `retryNoticeDelivery`, `listDeadEvents`, `AuditChange`, `NoticeDetail`, `formatWhen`, `isNoticeAdmin`, `noticeErrorMessage`, `noticeStatus`); Tasks 4 and 7 pages.
- Produces:
  ```ts
  export default function AuditTab({ noticeId }: { noticeId: string }): JSX.Element;      // components/communication/AuditTab.tsx
  export default function DeliveryTab({ notice }: { notice: NoticeDetail }): JSX.Element;  // components/communication/DeliveryTab.tsx
  export default function DeadEventsPanel(): JSX.Element | null;                           // components/communication/DeadEventsPanel.tsx
  // NoticeDetailPage tabs: Reach (index) · Audit ("audit") · Delivery ("delivery")
  // React Query keys: ['notice-audit', id], ['notice-dead-events']
  ```

- **Audit** lists `GET /:id/audit`, newest first: publish, reminders, archive, retried delivery, every acknowledgement (ADM-06) and refused reach attempts (RCH-02). Action codes become words, and each change reads "Field: old → new".
- **Delivery** shows the state (Delivering… / Delivered / Delivery failed), the attempts, the last update and the recipients. When the event is dead it shows the last error, and admins get "Retry delivery". The server checks admin rights and refuses a non-failed delivery with a 409, whose text is shown as is. A successful retry writes the returned `DeliveryView` into `['notice', id]`, so the badge flips at once, and the detail page's 3-second poll takes it from there.
- **Dead events:** the admin-only "Failed deliveries" panel sits on the Notices page and renders nothing when the list is empty. Only a dead `notice.published` event can be retried, so only those rows link to their notice's Delivery tab.

- [ ] **Step 1: Write the failing tests**

```tsx
// admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import AuditTab from '../AuditTab';
import DeliveryTab from '../DeliveryTab';
import { renderWithProviders } from '../../../__tests__/test-utils';
import type { NoticeDetail } from '../../../services/notices';

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { role: auth.role } }) }));
vi.mock('../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../services/notices', () => ({ getNoticeAudit: vi.fn(), retryNoticeDelivery: vi.fn() }));
import { getNoticeAudit, retryNoticeDelivery } from '../../../services/notices';
import { toast } from '../../../stores/toastStore';

const NOTICE = {
  id: 'n1', title: 'Exam timetable', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published', purpose: 'standard',
  delivery: { state: 'delivered', attempts: 1, lastError: null, updatedAt: '2026-09-30T04:01:00.000Z' }, publishedAt: '2026-09-30T04:00:00.000Z',
  createdAt: '2026-09-30T04:00:00.000Z', ackRequired: true, deadline: null, deadlineState: 'none', counts: { audience: 120, onJuvi: 100 },
  acknowledged: 0, seen: 0, reminders: { used: 0, max: 2, lastAt: null }, isMine: true, body: 'x', attachments: [],
  audience: { rules: [{ kind: 'all', ids: [] }], line: 'Sent to everyone at JIT' }, ackCommentAllowed: false, priority: 'routine', archivedAt: null, canManage: true,
} as NoticeDetail;
const FAILED = { ...NOTICE, status: 'publishing', delivery: { state: 'failed', attempts: 8, lastError: 'Mongo timeout', updatedAt: '2026-09-30T04:30:00.000Z' } } as NoticeDetail;

beforeEach(() => {
  vi.clearAllMocks(); auth.role = 'admin';
  (getNoticeAudit as Mock).mockResolvedValue({
    items: [
      { action: 'acknowledge', entityType: 'NoticeAcknowledgement', performedBy: 'Asha Rao', at: '2026-09-30T05:00:00.000Z', changes: [{ field: 'ack', displayName: 'Acknowledged', oldValue: null, newValue: { late: false, method: 'hold' } }] },
      { action: 'publish', entityType: 'Notice', performedBy: 'Exam Officer', at: '2026-09-30T04:00:00.000Z', changes: [{ field: 'status', displayName: 'Status', oldValue: null, newValue: 'publishing' }] },
    ],
  });
  (retryNoticeDelivery as Mock).mockResolvedValue({ state: 'delivering', attempts: 0, lastError: null, updatedAt: null });
});

describe('AuditTab', () => {
  it('lists the trail newest first with readable actions and changes', async () => {
    renderWithProviders(<AuditTab noticeId="n1" />);
    const table = await screen.findByRole('table', { name: 'Audit trail' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Acknowledged');
    expect(rows[0]).toHaveTextContent('Asha Rao');
    expect(rows[0]).toHaveTextContent('Acknowledged: — → late: false, method: hold');
    expect(rows[1]).toHaveTextContent('Published');
    expect(rows[1]).toHaveTextContent('Status: — → publishing');
    expect(getNoticeAudit).toHaveBeenCalledWith('n1');
  });
});

describe('DeliveryTab', () => {
  it('shows a delivered notice with its recipients', () => {
    renderWithProviders(<DeliveryTab notice={NOTICE} />);
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('120 (100 on Juvi)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry delivery' })).toBeNull();
  });

  it('lets an admin retry a failed delivery', async () => {
    renderWithProviders(<DeliveryTab notice={FAILED} />);
    expect(screen.getByText('Delivery failed')).toBeInTheDocument();
    expect(screen.getByText(/stopped after 8 attempts\. Last error: Mongo timeout/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry delivery' }));
    await waitFor(() => expect(retryNoticeDelivery).toHaveBeenCalledWith('n1'));
    expect(toast.success).toHaveBeenCalledWith('Delivery retried', expect.any(String));
  });

  it('shows the server reason when a retry is refused', async () => {
    (retryNoticeDelivery as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { error: 'Nothing to retry: delivery has not failed' } } });
    renderWithProviders(<DeliveryTab notice={FAILED} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry delivery' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not retry delivery', 'Nothing to retry: delivery has not failed'));
  });

  it('sends non-admins to an admin', () => {
    auth.role = 'staff';
    renderWithProviders(<DeliveryTab notice={FAILED} />);
    expect(screen.queryByRole('button', { name: 'Retry delivery' })).toBeNull();
    expect(screen.getByText('Ask a college admin to retry delivery.')).toBeInTheDocument();
  });
});
```

Extend `admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx`:

```diff
--- a/admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx
+++ b/admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx
@@ -5,6 +5,8 @@
 import { renderWithProviders } from '../../../__tests__/test-utils';
 
 vi.mock('../../../components/communication/ReachTab', () => ({ default: () => <p>Reach tab</p> }));
+vi.mock('../../../components/communication/AuditTab', () => ({ default: () => <p>Audit tab</p> }));
+vi.mock('../../../components/communication/DeliveryTab', () => ({ default: () => <p>Delivery tab</p> }));
 vi.mock('../../../services/notices', () => ({ getNotice: vi.fn() }));
 import { getNotice } from '../../../services/notices';
 
@@ -43,6 +45,13 @@
     expect(screen.getByText('Reach tab')).toBeInTheDocument();
   });
 
+  it('routes the Audit and Delivery tabs', async () => {
+    renderAt('/communication/notices/n1/delivery');
+    expect(await screen.findByText('Delivery tab')).toBeInTheDocument();
+    expect(screen.getByRole('link', { name: 'Delivery' })).toHaveAttribute('aria-current', 'page');
+    expect(screen.getByRole('link', { name: 'Audit' })).toHaveAttribute('href', '/communication/notices/n1/audit');
+  });
+
   it('says so when the notice is not one the caller can see', async () => {
     (getNotice as Mock).mockRejectedValue({ isAxiosError: true, response: { status: 404, data: { error: 'Notice not found' } } });
     renderAt('/communication/notices/nope');
```

Extend `admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx`:

```diff
--- a/admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx
+++ b/admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx
@@ -8,8 +8,8 @@
 vi.mock('../../../stores/authStore', () => ({
   useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { role: auth.role }, hasPermission: () => auth.can }),
 }));
-vi.mock('../../../services/notices', () => ({ listNotices: vi.fn(), getNoticeTargets: vi.fn(), previewAudience: vi.fn(), searchNoticePeople: vi.fn() }));
-import { listNotices, getNoticeTargets } from '../../../services/notices';
+vi.mock('../../../services/notices', () => ({ listNotices: vi.fn(), getNoticeTargets: vi.fn(), previewAudience: vi.fn(), searchNoticePeople: vi.fn(), listDeadEvents: vi.fn() }));
+import { listNotices, getNoticeTargets, listDeadEvents } from '../../../services/notices';
 
 const ROW = {
   id: 'n1', title: 'Exam timetable', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published', purpose: 'standard',
@@ -34,6 +34,7 @@
   vi.clearAllMocks(); auth.role = 'admin'; auth.can = true;
   (listNotices as Mock).mockResolvedValue(page([ROW]));
   (getNoticeTargets as Mock).mockResolvedValue(TARGETS);
+  (listDeadEvents as Mock).mockResolvedValue(page([]));
 });
 afterEach(() => { vi.useRealTimers(); });
 
@@ -69,14 +70,23 @@
     await waitFor(() => expect(listNotices).toHaveBeenLastCalledWith(expect.objectContaining({ office: 'Exam Section' })));
   });
 
-  it('gives non-admins no office filter', async () => {
+  it('gives non-admins no office filter and no failed-deliveries panel', async () => {
     auth.role = 'staff';
     renderPage();
     await screen.findByRole('button', { name: /open notice exam timetable/i });
     expect(screen.queryByLabelText('Office')).toBeNull();
     expect(getNoticeTargets).not.toHaveBeenCalled();
+    expect(listDeadEvents).not.toHaveBeenCalled();
   });
 
+  it('shows admins the failed deliveries, linking to the Delivery tab', async () => {
+    (listDeadEvents as Mock).mockResolvedValue(page([{ id: 'e1', type: 'notice.published', noticeId: 'n9', attempts: 8, lastError: 'Mongo timeout', createdAt: '2026-09-30T04:00:00.000Z', updatedAt: null }]));
+    renderPage();
+    const panel = await screen.findByRole('region', { name: /failed deliveries \(1\)/i });
+    expect(panel).toHaveTextContent('Mongo timeout');
+    expect(screen.getByRole('link', { name: 'Open delivery' })).toHaveAttribute('href', '/communication/notices/n9/delivery');
+  });
+
   it('opens the composer drawer from New notice', async () => {
     renderPage();
     fireEvent.click(await screen.findByRole('button', { name: /new notice/i }));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/components/communication src/pages/communication`
Expected: FAIL: `Failed to resolve import "../AuditTab"` (and `"../DeliveryTab"`); the detail page has no Delivery link; the Notices page shows no failed-deliveries region.

- [ ] **Step 3: Implement**

```tsx
// admin-portal/src/components/communication/AuditTab.tsx
import { useQuery } from '@tanstack/react-query';
import { getNoticeAudit, type AuditChange } from '../../services/notices';
import { formatWhen, noticeErrorMessage } from '../../lib/notices';

const th = 'px-3 py-2 text-left font-medium text-gray-600';
const td = 'px-3 py-2 align-top';
const ACTION_LABELS: Record<string, string> = {
  publish: 'Published', update: 'Updated', archive: 'Archived', acknowledge: 'Acknowledged', access_denied: 'Reach refused',
};

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${show(x)}`).join(', ');
  return String(v);
}
const change = (c: AuditChange) => `${c.displayName ?? c.field}: ${show(c.oldValue)} → ${show(c.newValue)}`;

/** The notice's ERP audit trail (spec §8 Audit; ADM-06): publish, reminders, archive, acknowledgements, refused reach. */
export default function AuditTab({ noticeId }: { noticeId: string }) {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['notice-audit', noticeId], queryFn: () => getNoticeAudit(noticeId), meta: { silentError: true } });
  if (isError) return <p role="alert" className="text-sm text-red-700">{noticeErrorMessage(error)}</p>;
  if (isLoading || !data) return <p className="text-sm text-gray-500">Loading the audit trail…</p>;
  if (data.items.length === 0) return <p className="text-sm text-gray-500">Nothing recorded yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm" aria-label="Audit trail">
        <thead className="border-b bg-gray-50">
          <tr><th className={th}>When</th><th className={th}>Action</th><th className={th}>By</th><th className={th}>Details</th></tr>
        </thead>
        <tbody className="divide-y">
          {data.items.map((e, i) => (
            <tr key={`${e.at}:${i}`}>
              <td className={`${td} whitespace-nowrap`}>{formatWhen(e.at)}</td>
              <td className={td}>{ACTION_LABELS[e.action] ?? e.action}</td>
              <td className={td}>{e.performedBy}</td>
              <td className={`${td} text-gray-600`}>{e.changes.map(change).join('; ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// admin-portal/src/components/communication/DeliveryTab.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import Badge from '../ui/Badge';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { retryNoticeDelivery, type NoticeDetail } from '../../services/notices';
import { formatWhen, isNoticeAdmin, noticeErrorMessage, noticeStatus } from '../../lib/notices';

/** Delivery (spec §8, §11): the fan-out state, and "Retry delivery" for admins when the event is dead. */
export default function DeliveryTab({ notice }: { notice: NoticeDetail }) {
  const qc = useQueryClient();
  const admin = isNoticeAdmin(useAuthStore((s) => s.user?.role));
  const d = notice.delivery;
  const status = noticeStatus(notice);

  const retry = useMutation({
    mutationFn: () => retryNoticeDelivery(notice.id),
    meta: { silent: true, silentError: true },
    onSuccess: (delivery) => {
      qc.setQueryData<NoticeDetail>(['notice', notice.id], (old) => (old ? { ...old, delivery } : old));
      qc.invalidateQueries({ queryKey: ['notice', notice.id] });
      qc.invalidateQueries({ queryKey: ['notices'] });
      qc.invalidateQueries({ queryKey: ['notice-dead-events'] });
      toast.success('Delivery retried', 'The notice is being delivered again.');
    },
    onError: (err) => toast.error('Could not retry delivery', noticeErrorMessage(err)),
  });

  return (
    <div className="space-y-4 rounded-xl border bg-white p-5 text-sm">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="text-xs text-gray-500">State</dt><dd className="mt-0.5"><Badge variant={status.variant}>{status.label}</Badge></dd></div>
        <div><dt className="text-xs text-gray-500">Attempts</dt><dd className="mt-0.5 tabular-nums">{d.attempts}</dd></div>
        <div><dt className="text-xs text-gray-500">Last update</dt><dd className="mt-0.5">{formatWhen(d.updatedAt)}</dd></div>
        <div>
          <dt className="text-xs text-gray-500">Recipients</dt>
          <dd className="mt-0.5">{d.state === 'delivered' ? `${notice.counts.audience.toLocaleString('en-IN')} (${notice.counts.onJuvi.toLocaleString('en-IN')} on Juvi)` : '—'}</dd>
        </div>
      </dl>
      {d.state === 'delivering' && <p className="text-gray-600">Cards are being written for every member of the audience. This usually takes under a minute; this page refreshes itself.</p>}
      {d.state === 'delivered' && <p className="text-gray-600">Every member on Juvi has the card. Members not on Juvi yet get it when they activate.</p>}
      {d.state === 'failed' && (
        <div className="space-y-3">
          <p className="text-red-700">Delivery stopped after {d.attempts} attempts.{d.lastError ? ` Last error: ${d.lastError}` : ''}</p>
          {admin ? (
            <button type="button" onClick={() => retry.mutate()} disabled={retry.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-white hover:bg-primary-700 disabled:opacity-50">
              <RotateCcw size={14} /> Retry delivery
            </button>
          ) : (
            <p className="text-gray-600">Ask a college admin to retry delivery.</p>
          )}
        </div>
      )}
    </div>
  );
}
```

```tsx
// admin-portal/src/components/communication/DeadEventsPanel.tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { listDeadEvents } from '../../services/notices';
import { formatWhen } from '../../lib/notices';

const EVENT_LABELS: Record<string, string> = {
  'notice.published': 'Delivery', 'notice.reminder': 'Reminder', 'notice.acknowledged': 'Acknowledgement audit', 'notice.archived': 'Archive',
};

/**
 * Admin-only list of dead notice events (spec §6.2: dead after 8 attempts, listed
 * in the admin console). Renders nothing while there are none. Only a dead
 * delivery can be retried, from that notice's Delivery tab.
 */
export default function DeadEventsPanel() {
  const { data } = useQuery({ queryKey: ['notice-dead-events'], queryFn: () => listDeadEvents(1, 20), meta: { silentError: true } });
  if (!data || data.total === 0) return null;
  return (
    <section aria-labelledby="dead-events" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
      <h3 id="dead-events" className="flex items-center gap-2 font-semibold text-red-800">
        <AlertTriangle size={16} aria-hidden="true" /> Failed deliveries ({data.total})
      </h3>
      <p className="mt-1 text-red-700">These background steps stopped after repeated failures.</p>
      <ul className="mt-2 divide-y divide-red-100">
        {data.items.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span>
              <span className="font-medium text-red-900">{EVENT_LABELS[e.type] ?? e.type}</span>
              <span className="text-red-700"> · {e.attempts} attempts · {formatWhen(e.updatedAt ?? e.createdAt)}{e.lastError ? ` · ${e.lastError}` : ''}</span>
            </span>
            {e.noticeId && e.type === 'notice.published' && (
              <Link to={`/communication/notices/${e.noticeId}/delivery`} className="font-medium text-red-800 underline">Open delivery</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Add the two tabs and their routes to the detail page:

```diff
--- a/admin-portal/src/pages/communication/NoticeDetailPage.tsx
+++ b/admin-portal/src/pages/communication/NoticeDetailPage.tsx
@@ -3,6 +3,8 @@
 import { ArrowLeft, Paperclip } from 'lucide-react';
 import Badge from '../../components/ui/Badge';
 import ReachTab from '../../components/communication/ReachTab';
+import AuditTab from '../../components/communication/AuditTab';
+import DeliveryTab from '../../components/communication/DeliveryTab';
 import { getNotice } from '../../services/notices';
 import { PRIORITY_LABELS, deadlineText, errorStatus, formatBytes, formatWhen, noticeErrorMessage, noticeStatus } from '../../lib/notices';
 
@@ -35,6 +37,8 @@
   // Absolute targets, as in JuviAdminPage: this page is mounted at "notices/:id/*".
   const tabs = [
     { to: base, label: 'Reach', end: true },
+    { to: `${base}/audit`, label: 'Audit', end: false },
+    { to: `${base}/delivery`, label: 'Delivery', end: false },
   ];
 
   return (
@@ -74,6 +78,8 @@
       </nav>
       <Routes>
         <Route index element={<ReachTab notice={notice} />} />
+        <Route path="audit" element={<AuditTab noticeId={notice.id} />} />
+        <Route path="delivery" element={<DeliveryTab notice={notice} />} />
       </Routes>
     </div>
   );
```

Mount the panel on the list for admins:

```diff
--- a/admin-portal/src/pages/communication/NoticesPage.tsx
+++ b/admin-portal/src/pages/communication/NoticesPage.tsx
@@ -7,6 +7,7 @@
 import Pagination from '../../components/ui/Pagination';
 import SearchInput from '../../components/ui/SearchInput';
 import NoticeComposer from '../../components/communication/NoticeComposer';
+import DeadEventsPanel from '../../components/communication/DeadEventsPanel';
 import { useListControls } from '../../hooks/useListControls';
 import { useAuthStore } from '../../stores/authStore';
 import { listNotices, getNoticeTargets, type NoticeRow, type NoticeStatus } from '../../services/notices';
@@ -76,6 +77,8 @@
         )}
       </div>
 
+      {admin && <DeadEventsPanel />}
+
       <div className="mb-4 flex flex-wrap items-center gap-3">
         <SearchInput value={search} onChange={setSearch} placeholder="Search notices…" className="w-64" />
         <label className="sr-only" htmlFor="notice-status">Status</label>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/components/communication src/pages/communication`
Expected: PASS (6 files, 42 tests).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/components/communication/AuditTab.tsx admin-portal/src/components/communication/DeliveryTab.tsx admin-portal/src/components/communication/DeadEventsPanel.tsx admin-portal/src/components/communication/__tests__/AuditDeliveryTabs.test.tsx admin-portal/src/pages/communication/NoticeDetailPage.tsx admin-portal/src/pages/communication/NoticesPage.tsx admin-portal/src/pages/communication/__tests__/NoticeDetailPage.test.tsx admin-portal/src/pages/communication/__tests__/NoticesPage.test.tsx
git commit -m "feat(admin-portal): notice Audit and Delivery tabs, retry, failed deliveries

Audit shows the ERP trail including every acknowledgement and refused
reach attempt. Delivery shows the fan-out state and gives admins Retry
delivery on a dead event. Admins see a Failed deliveries panel on the
Notices page that links each dead delivery to its notice.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Portal: legacy banners and the Welcome notice setting

**Files:**
- Create: `admin-portal/src/components/communication/LegacyNoticesBanner.tsx`, `admin-portal/src/components/platform/juvi/WelcomeNoticeSection.tsx`
- Modify: `admin-portal/src/pages/platform/AnnouncementsPage.tsx`, `admin-portal/src/pages/platform/CircularsPage.tsx`, `admin-portal/src/services/juvi-app.ts`, `admin-portal/src/components/platform/juvi/SettingsTab.tsx`
- Test: `admin-portal/src/components/communication/__tests__/LegacyNoticesBanner.test.tsx`, `admin-portal/src/components/platform/juvi/__tests__/WelcomeNoticeSection.test.tsx` (create); `admin-portal/src/components/platform/juvi/__tests__/SettingsTab.test.tsx` (modify)

**Interfaces:**
- Consumes: Task 1 (`?purpose=welcome`, which only Task 1 makes possible); Task 6 (`NoticeComposer`, `ComposerInitial`); Task 3 (`listNotices`, `formatWhen`, `noticeErrorMessage`, `roleLabel`); `getJuviSettings`, `updateJuviSettings`, `AdminSettingsView` (`services/juvi-app.ts`); backend `settingsUpdateSchema.welcomeNotice` (Plan 1: an `objectId` or `null` per slot; the service refuses anything that is not a published welcome notice with "Choose a published welcome notice").
- Produces:
  ```ts
  // services/juvi-app.ts
  interface JuviSettings { …; welcomeNotice?: { studentNoticeId?: string; facultyNoticeId?: string } }
  type JuviSettingsPatch = … & { welcomeNotice?: { studentNoticeId?: string | null; facultyNoticeId?: string | null } };
  // components/communication/LegacyNoticesBanner.tsx
  export default function LegacyNoticesBanner({ kind }: { kind: 'announcements' | 'circulars' }): JSX.Element;   // role="note"
  // components/platform/juvi/WelcomeNoticeSection.tsx
  export default function WelcomeNoticeSection({ canUpdate }: { canUpdate: boolean }): JSX.Element | null;
  ```

- **Banner:** reads "Official notices now go to Juvi." and links to `/communication/notices` for anyone with `notices:read`. Anyone without that permission (the page would bounce them) is told to ask their office instead.
- **Welcome notice section:** two selects, Students and Faculty and staff. These mirror `welcomeSlot()` in the backend, where staff share the faculty slot. Each select offers "Default welcome notice" (`null`, which falls back to the auto-created default) plus every published welcome notice, and keeps a configured notice that is no longer published visible as such, so the select never silently shows the wrong value.
- **Saving:** "Save welcome notices" sends only the slots that changed, through the same `['juvi-admin-settings']` cache `SettingsTab` uses, and it seeds once, so a refetch never clobbers a pending choice.
- **Creating a welcome notice:** "Create welcome notice" opens `<NoticeComposer />` prefilled with `purpose: 'welcome'`, the title "Welcome to Juvi", acknowledgement required, and the slot's roles as audience chips. A new notice is still `publishing` when the composer closes; the composer's invalidation of `['notices']` refreshes the list, and a hint says it appears once delivered.
- **Permissions:** the section needs `platform:update` to save, which is the `SettingsTab` rule, and `notices:create` to compose.

- [ ] **Step 1: Write the failing tests**

```tsx
// admin-portal/src/components/communication/__tests__/LegacyNoticesBanner.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import LegacyNoticesBanner from '../LegacyNoticesBanner';
import { renderWithProviders } from '../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ can: true }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ hasPermission: () => perm.can }) }));

describe('LegacyNoticesBanner', () => {
  it('says official notices go to Juvi and links to the Notices page', () => {
    perm.can = true;
    renderWithProviders(<LegacyNoticesBanner kind="circulars" />);
    expect(screen.getByRole('note')).toHaveTextContent('Official notices now go to Juvi. These circulars are kept as records');
    expect(screen.getByRole('link', { name: 'Go to Notices' })).toHaveAttribute('href', '/communication/notices');
  });

  it('gives no link to someone who cannot open Notices', () => {
    perm.can = false;
    renderWithProviders(<LegacyNoticesBanner kind="announcements" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('note')).toHaveTextContent('Ask your college office to publish it as a Juvi notice.');
  });
});
```

```tsx
// admin-portal/src/components/platform/juvi/__tests__/WelcomeNoticeSection.test.tsx
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import WelcomeNoticeSection from '../WelcomeNoticeSection';
import { renderWithProviders } from '../../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ compose: true }));
vi.mock('../../../../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ hasPermission: () => perm.compose }) }));
vi.mock('../../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../../services/juvi-app', () => ({ getJuviSettings: vi.fn(), updateJuviSettings: vi.fn() }));
vi.mock('../../../../services/notices', () => ({ listNotices: vi.fn(), getNoticeTargets: vi.fn(), previewAudience: vi.fn(), searchNoticePeople: vi.fn() }));
import { getJuviSettings, updateJuviSettings } from '../../../../services/juvi-app';
import { listNotices, getNoticeTargets, previewAudience } from '../../../../services/notices';
import { toast } from '../../../../stores/toastStore';

const view = (welcomeNotice?: object) => ({
  juvi: { enabled: true, paused: false, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false }, ...(welcomeNotice ? { welcomeNotice } : {}) },
  college: { name: 'JIT', code: 'JIT' }, lastReconcile: null,
});
const row = (id: string, title: string, office = 'College Office') => ({ id, title, office, publishedAt: '2026-09-28T04:00:00.000Z' });

beforeEach(() => {
  vi.clearAllMocks(); perm.compose = true;
  (getJuviSettings as Mock).mockResolvedValue(view({ studentNoticeId: 'w1' }));
  (listNotices as Mock).mockResolvedValue({ items: [row('w1', 'Welcome to Juvi', 'Juvi'), row('w2', 'Welcome to JIT')], total: 2, page: 1, pages: 1 });
  (updateJuviSettings as Mock).mockImplementation(async (patch: { welcomeNotice: object }) => view({ studentNoticeId: 'w1', ...patch.welcomeNotice }));
  (getNoticeTargets as Mock).mockResolvedValue({ office: 'College Office', offices: ['College Office'], isAdmin: true, timezone: 'Asia/Kolkata', kinds: ['all', 'role'], roles: ['student', 'faculty', 'staff', 'hod'], departments: [], programmes: [], batches: [], sections: [], courseOfferings: [], hostelBlocks: [] });
  (previewAudience as Mock).mockResolvedValue({ total: 40, onJuvi: 10, notOnJuvi: 30, groups: [], line: 'Sent to all students' });
});

describe('WelcomeNoticeSection', () => {
  it('offers Default plus the published welcome notices for each kind, showing the configured one', async () => {
    renderWithProviders(<WelcomeNoticeSection canUpdate />);
    const students = await screen.findByLabelText('Students');
    await waitFor(() => expect(within(students).getAllByRole('option')).toHaveLength(3));
    expect(students).toHaveValue('w1');
    expect(screen.getByLabelText('Faculty and staff')).toHaveValue('');
    expect(listNotices).toHaveBeenCalledWith({ page: 1, limit: 100, purpose: 'welcome', status: 'published' });
  });

  it('saves only the slots that changed, and Default as null', async () => {
    renderWithProviders(<WelcomeNoticeSection canUpdate />);
    const students = await screen.findByLabelText('Students');
    await waitFor(() => expect(within(students).getAllByRole('option')).toHaveLength(3));
    fireEvent.change(students, { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Faculty and staff'), { target: { value: 'w2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save welcome notices' }));
    await waitFor(() => expect(updateJuviSettings).toHaveBeenCalledWith({ welcomeNotice: { studentNoticeId: null, facultyNoticeId: 'w2' } }));
    expect(toast.success).toHaveBeenCalledWith('Welcome notices saved');
  });

  it('opens the composer prefilled as a welcome notice for that kind', async () => {
    renderWithProviders(<WelcomeNoticeSection canUpdate />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create welcome notice for faculty and staff' }));
    const dialog = screen.getByRole('dialog', { name: 'Welcome notice for faculty and staff' });
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Welcome to Juvi');
    expect(within(dialog).getByLabelText('Require acknowledgement')).toBeChecked();
    const tags = await within(dialog).findByRole('list', { name: 'Selected audience' });
    expect(tags).toHaveTextContent('All faculty');
    expect(tags).toHaveTextContent('All staff');
  });

  it('is read-only without platform:update and offers no composer without notices:create', async () => {
    perm.compose = false;
    renderWithProviders(<WelcomeNoticeSection canUpdate={false} />);
    expect(await screen.findByLabelText('Students')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save welcome notices' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /create welcome notice/i })).toBeNull();
  });
});
```

`SettingsTab.test.tsx` now renders the section too, so it mocks the notices service:

```diff
--- a/admin-portal/src/components/platform/juvi/__tests__/SettingsTab.test.tsx
+++ b/admin-portal/src/components/platform/juvi/__tests__/SettingsTab.test.tsx
@@ -9,7 +9,10 @@
 }));
 vi.mock('../../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
 vi.mock('../../../../services/juvi-app', () => ({ getJuviSettings: vi.fn(), updateJuviSettings: vi.fn(), reconcileNow: vi.fn() }));
+// The Welcome notice section (its own tests: WelcomeNoticeSection.test.tsx) lists welcome notices.
+vi.mock('../../../../services/notices', () => ({ listNotices: vi.fn() }));
 import { getJuviSettings, updateJuviSettings, reconcileNow } from '../../../../services/juvi-app';
+import { listNotices } from '../../../../services/notices';
 import { toast } from '../../../../stores/toastStore';
 
 const VIEW = {
@@ -23,6 +26,7 @@
   (getJuviSettings as Mock).mockResolvedValue(VIEW);
   (updateJuviSettings as Mock).mockImplementation(async (patch: any) => ({ ...VIEW, juvi: { ...VIEW.juvi, ...patch } }));
   (reconcileNow as Mock).mockResolvedValue({ queued: true });
+  (listNotices as Mock).mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
 });
 
 describe('SettingsTab', () => {
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/components/platform/juvi src/components/communication/__tests__/LegacyNoticesBanner.test.tsx`
Expected: FAIL: `Failed to resolve import "../LegacyNoticesBanner"` and `"../WelcomeNoticeSection"`. (SettingsTab still passes; its new mock is unused until Step 3.)

- [ ] **Step 3: Implement**

```tsx
// admin-portal/src/components/communication/LegacyNoticesBanner.tsx
import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

/**
 * Spec §1, §8: the Announcements and Circulars pages stay, and say where
 * official notices go now. Nothing is migrated.
 */
export default function LegacyNoticesBanner({ kind }: { kind: 'announcements' | 'circulars' }) {
  const canRead = useAuthStore((s) => s.hasPermission('notices', 'read'));
  return (
    <div role="note" className="mb-4 flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
      <Megaphone size={18} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
      <p>
        <span className="font-semibold">Official notices now go to Juvi.</span>{' '}
        These {kind} are kept as records, but they do not reach anyone&apos;s phone.{' '}
        {canRead
          ? <Link to="/communication/notices" className="font-medium underline">Go to Notices</Link>
          : 'Ask your college office to publish it as a Juvi notice.'}
      </p>
    </div>
  );
}
```

```diff
--- a/admin-portal/src/pages/platform/AnnouncementsPage.tsx
+++ b/admin-portal/src/pages/platform/AnnouncementsPage.tsx
@@ -10,6 +10,7 @@
 import Pagination from '../../components/ui/Pagination';
 import { useListControls } from '../../hooks/useListControls';
 import SearchInput from '../../components/ui/SearchInput';
+import LegacyNoticesBanner from '../../components/communication/LegacyNoticesBanner';
 
 const CATEGORIES = ['general', 'academic', 'exam', 'placement', 'event', 'hostel', 'sports', 'other'] as const;
 const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
@@ -81,6 +82,7 @@
 
   return (
     <div>
+      <LegacyNoticesBanner kind="announcements" />
       <div className="flex items-center justify-between mb-5">
         <h2 className="text-xl font-bold text-navy">Announcements</h2>
         <div className="flex items-center gap-3">
```

```diff
--- a/admin-portal/src/pages/platform/CircularsPage.tsx
+++ b/admin-portal/src/pages/platform/CircularsPage.tsx
@@ -10,6 +10,7 @@
 import Pagination from '../../components/ui/Pagination';
 import { useListControls } from '../../hooks/useListControls';
 import SearchInput from '../../components/ui/SearchInput';
+import LegacyNoticesBanner from '../../components/communication/LegacyNoticesBanner';
 
 const AUDIENCES = ['all', 'students', 'faculty', 'staff', 'parents'] as const;
 const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
@@ -76,6 +77,7 @@
 
   return (
     <div>
+      <LegacyNoticesBanner kind="circulars" />
       <div className="flex items-center justify-between mb-5">
         <h2 className="text-xl font-bold text-navy">Circulars</h2>
         <div className="flex items-center gap-3">
```

```diff
--- a/admin-portal/src/services/juvi-app.ts
+++ b/admin-portal/src/services/juvi-app.ts
@@ -16,6 +16,8 @@
   quietHoursDefault: { start: string; end: string };
   minAppVersion?: { android?: string; ios?: string };
   timezone: string; featureFlags: { languageRoadmap: boolean };
+  /** Published `purpose: welcome` notice per kind; absent means the auto-created default. */
+  welcomeNotice?: { studentNoticeId?: string; facultyNoticeId?: string };
 }
 export interface ReconcileSummary {
   at: string; durationMs: number; skipped: boolean;
@@ -23,9 +25,11 @@
   memberships: { added: number; removed: number; roleChanged: number }; errors: number;
 }
 export interface AdminSettingsView { juvi: JuviSettings; college: { name: string; code: string }; lastReconcile: ReconcileSummary | null }
-export type JuviSettingsPatch = Partial<Omit<JuviSettings, 'accentColor' | 'supportContact'>> & {
+export type JuviSettingsPatch = Partial<Omit<JuviSettings, 'accentColor' | 'supportContact' | 'welcomeNotice'>> & {
   accentColor?: string | null;
   supportContact?: JuviSettings['supportContact'] | null;
+  /** null clears a slot back to the default welcome notice. */
+  welcomeNotice?: { studentNoticeId?: string | null; facultyNoticeId?: string | null };
 };
 
 export interface ProvisioningRun {
```

```tsx
// admin-portal/src/components/platform/juvi/WelcomeNoticeSection.tsx
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save } from 'lucide-react';
import NoticeComposer, { type ComposerInitial } from '../../communication/NoticeComposer';
import { getJuviSettings, updateJuviSettings, type AdminSettingsView } from '../../../services/juvi-app';
import { listNotices } from '../../../services/notices';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { formatWhen, noticeErrorMessage, roleLabel } from '../../../lib/notices';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

type Slot = 'studentNoticeId' | 'facultyNoticeId';
/** Students use the student slot; faculty and staff share the faculty slot (backend welcome-service.ts welcomeSlot). */
const SLOTS: { slot: Slot; label: string; composer: string; roles: string[] }[] = [
  { slot: 'studentNoticeId', label: 'Students', composer: 'Welcome notice for students', roles: ['student'] },
  { slot: 'facultyNoticeId', label: 'Faculty and staff', composer: 'Welcome notice for faculty and staff', roles: ['faculty', 'staff'] },
];
const WELCOME_QUERY = { page: 1, limit: 100, purpose: 'welcome', status: 'published' } as const;

const fromView = (view: AdminSettingsView): Record<Slot, string> => ({
  studentNoticeId: view.juvi.welcomeNotice?.studentNoticeId ?? '',
  facultyNoticeId: view.juvi.welcomeNotice?.facultyNoticeId ?? '',
});

/**
 * Settings › Welcome notice (spec §8, US-5): pick a published `purpose: welcome`
 * notice per kind, or keep the auto-created default; or create one in the
 * composer, prefilled. Saved through PUT /settings `welcomeNotice`.
 */
export default function WelcomeNoticeSection({ canUpdate }: { canUpdate: boolean }) {
  const qc = useQueryClient();
  const canCompose = useAuthStore((s) => s.hasPermission('notices', 'create'));
  const settingsQ = useQuery({ queryKey: ['juvi-admin-settings'], queryFn: getJuviSettings });
  const welcomeQ = useQuery({ queryKey: ['notices', WELCOME_QUERY], queryFn: () => listNotices({ ...WELCOME_QUERY }), meta: { silentError: true } });
  const [base, setBase] = useState<Record<Slot, string> | null>(null);
  const [choice, setChoice] = useState<Record<Slot, string> | null>(null);
  const [composing, setComposing] = useState<(typeof SLOTS)[number] | null>(null);

  // Seed once, like SettingsTab: a background refetch never clobbers a pending choice.
  useEffect(() => {
    if (settingsQ.data && choice === null) { const c = fromView(settingsQ.data); setBase(c); setChoice(c); }
  }, [settingsQ.data, choice]);

  const save = useMutation({
    mutationFn: (patch: Partial<Record<Slot, string | null>>) => updateJuviSettings({ welcomeNotice: patch }),
    meta: { silent: true, silentError: true },
    onSuccess: (view) => {
      qc.setQueryData(['juvi-admin-settings'], view);
      const c = fromView(view);
      setBase(c);
      setChoice(c);
      toast.success('Welcome notices saved');
    },
    onError: (err) => toast.error('Could not save the welcome notices', noticeErrorMessage(err)),
  });

  if (!choice || !base) return null;
  const items = welcomeQ.data?.items ?? [];

  function onSave() {
    const patch: Partial<Record<Slot, string | null>> = {};
    for (const { slot } of SLOTS) if (choice![slot] !== base![slot]) patch[slot] = choice![slot] || null;
    if (Object.keys(patch).length === 0) { toast.success('Nothing to save'); return; }
    save.mutate(patch);
  }

  const initialFor = (s: (typeof SLOTS)[number]): ComposerInitial => ({
    purpose: 'welcome', title: 'Welcome to Juvi', ackRequired: true,
    audience: { role: s.roles.map((id) => ({ id, label: roleLabel(id) })) },
  });

  return (
    <section aria-labelledby="welcome-notice-heading" className="space-y-4 rounded-xl border bg-white p-5">
      <div>
        <h3 id="welcome-notice-heading" className="text-sm font-semibold text-navy">Welcome notice</h3>
        <p className="mt-1 text-xs text-gray-500">
          The first notice in onboarding (step 4), acknowledged for real. Default uses the welcome notice Juvi creates automatically.
        </p>
      </div>
      {welcomeQ.isError && <p role="alert" className="text-sm text-red-700">{noticeErrorMessage(welcomeQ.error)}</p>}
      {SLOTS.map((s) => {
        const value = choice[s.slot];
        const missing = value && !items.some((n) => n.id === value);
        return (
          <div key={s.slot}>
            <label htmlFor={`welcome-${s.slot}`} className={lbl}>{s.label}</label>
            <div className="flex flex-wrap gap-2">
              <select id={`welcome-${s.slot}`} className={`${inp} sm:max-w-md`} value={value} disabled={!canUpdate || save.isPending}
                onChange={(e) => setChoice({ ...choice, [s.slot]: e.target.value })}>
                <option value="">Default welcome notice</option>
                {missing && <option value={value}>The current notice (no longer published)</option>}
                {items.map((n) => <option key={n.id} value={n.id}>{n.title} · {n.office} · {formatWhen(n.publishedAt)}</option>)}
              </select>
              {canCompose && (
                <button type="button" onClick={() => setComposing(s)} aria-label={`Create welcome notice for ${s.label.toLowerCase()}`}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  <Plus size={14} /> Create welcome notice
                </button>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-500">A new welcome notice appears in these lists once its delivery has finished.</p>
      <div className="flex justify-end">
        <button type="button" onClick={onSave} disabled={!canUpdate || save.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
          <Save size={16} /> Save welcome notices
        </button>
      </div>
      <NoticeComposer open={composing !== null} onClose={() => setComposing(null)} title={composing?.composer ?? 'Welcome notice'}
        initial={composing ? initialFor(composing) : undefined} />
    </section>
  );
}
```

```diff
--- a/admin-portal/src/components/platform/juvi/SettingsTab.tsx
+++ b/admin-portal/src/components/platform/juvi/SettingsTab.tsx
@@ -4,6 +4,7 @@
 import { getJuviSettings, updateJuviSettings, reconcileNow, type JuviSettings, type JuviSettingsPatch } from '../../../services/juvi-app';
 import { useAuthStore } from '../../../stores/authStore';
 import { toast } from '../../../stores/toastStore';
+import WelcomeNoticeSection from './WelcomeNoticeSection';
 
 const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
 const lbl = 'block text-sm font-medium text-gray-700 mb-1';
@@ -210,6 +211,10 @@
           <RefreshCw size={14} /> Reconcile now
         </button>
       </aside>
+
+      <div className="lg:col-span-2">
+        <WelcomeNoticeSection canUpdate={canUpdate} />
+      </div>
     </div>
   );
 }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-portal && npx vitest run src/components/platform/juvi src/components/communication/__tests__/LegacyNoticesBanner.test.tsx`
Expected: PASS (6 files, 23 tests).

Run: `cd admin-portal && npx vitest run`
Expected: PASS (every portal file).

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/components/communication/LegacyNoticesBanner.tsx admin-portal/src/components/communication/__tests__/LegacyNoticesBanner.test.tsx admin-portal/src/pages/platform/AnnouncementsPage.tsx admin-portal/src/pages/platform/CircularsPage.tsx admin-portal/src/services/juvi-app.ts admin-portal/src/components/platform/juvi/WelcomeNoticeSection.tsx admin-portal/src/components/platform/juvi/__tests__/WelcomeNoticeSection.test.tsx admin-portal/src/components/platform/juvi/SettingsTab.tsx admin-portal/src/components/platform/juvi/__tests__/SettingsTab.test.tsx
git commit -m "feat(admin-portal): legacy notice banners and the Welcome notice setting

Announcements and Circulars say official notices now go to Juvi and link
to Notices. Juvi Settings gains a Welcome notice section: choose a
published welcome notice per kind or the default, or create one in the
composer, prefilled.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: E2E: seed an HOD and two departments; the Playwright notices spec

**Files:**
- Modify: `backend/src/scripts/seed-e2e-users.ts`, `backend/src/scripts/__tests__/seed-e2e-users.test.ts`, `e2e/tests/utils/test-users.ts`
- Create: `e2e/tests/juvi-notices.spec.ts`

**Interfaces:**
- Consumes: `Department`, `Person`, `Faculty`, `User` models; `resolvePublisherScope` (Plan 1, used by the seed test to prove the seed yields a real HOD scope); `loginAs` (`e2e/tests/fixtures/auth-fixture.ts`); the `apiRequest.newContext` + `/api/auth/login` pattern from `student-import.spec.ts`; Tasks 4–6 UI.
- Produces:
  ```ts
  // backend/src/scripts/seed-e2e-users.ts
  export const E2E_HOD_EMAIL = 'e2e_hod@juvion.test';
  export const E2E_NOTICE_DEPARTMENTS;   // E2E-CSE "E2E Computer Science" (HOD's), E2E-ECE "E2E Electronics"
  export async function seedE2ENoticeAudience(passwordHash: string): Promise<void>;   // called from main() only
  // e2e/tests/utils/test-users.ts
  type E2ERole = 'super_admin' | 'principal' | 'registrar' | 'hod';
  ```

Why a seed rather than `page.route`: see "Decisions recorded here". `seedE2ENoticeAudience` is called from the CLI `main()`, not from `seedE2EUsers()`, because the existing seed tests count exactly three `e2e_` users from that function. Global setup runs the CLI (`npm run seed:e2e-users -w backend`), so Playwright always gets the audience. Each department has one active faculty member, so the Registrar's audience is exactly 1 person, all Not on Juvi, and the list shows `0 / 0 / 1` once the fan-out lands. That holds even in a dev database seeded with other people, because the E2E-prefixed department holds nobody else. The title carries `Date.now()` and the test searches for it, so earlier runs never interfere.

This spec and its seed were run against a live backend and Vite portal before being written here: 2 passed, and `juvi-admin.spec.ts` and `auth.spec.ts` still passed alongside (9 tests).

- [ ] **Step 1: Write the failing tests**

Extend `backend/src/scripts/__tests__/seed-e2e-users.test.ts`:

```diff
--- a/backend/src/scripts/__tests__/seed-e2e-users.test.ts
+++ b/backend/src/scripts/__tests__/seed-e2e-users.test.ts
@@ -11,8 +11,13 @@
 import {
   E2E_USER_DEFINITIONS,
   E2E_TEST_PASSWORD,
+  E2E_HOD_EMAIL,
   seedE2EUsers,
+  seedE2ENoticeAudience,
 } from '../seed-e2e-users';
+import { Department } from '../../models/academic-structure/Department';
+import { Faculty } from '../../models/people/Faculty';
+import { resolvePublisherScope } from '../../modules/juvi-app/notices/publisher-scope';
 
 /**
  * Tests for `seed-e2e-users.ts` (Playwright E2E spec — Phase A, T2).
@@ -150,4 +155,22 @@
     const valid = await bcrypt.compare(E2E_TEST_PASSWORD, fixed!.password);
     expect(valid).toBe(true);
   });
+
+  // The Juvi notices Playwright spec (e2e/tests/juvi-notices.spec.ts) relies on
+  // this producing a real HOD scope, not just rows that look right.
+  it('seeds the notices audience: an HOD heading E2E-CSE, and E2E-ECE outside their scope', async () => {
+    const hash = await bcrypt.hash(E2E_TEST_PASSWORD, 4);
+    await seedE2ENoticeAudience(hash);
+    await seedE2ENoticeAudience(hash);   // idempotent
+
+    expect(await Department.countDocuments({ code: { $in: ['E2E-CSE', 'E2E-ECE'] } })).toBe(2);
+    expect(await Faculty.countDocuments({ employeeCode: { $in: ['E2E-F1', 'E2E-F2'] }, status: 'active' })).toBe(2);
+    const hod = (await User.findOne({ email: E2E_HOD_EMAIL }).lean())!;
+    expect(hod).toMatchObject({ role: 'hod', personaType: 'F-HOD', personas: ['F-HOD'] });
+    expect(await bcrypt.compare(E2E_TEST_PASSWORD, hod.password)).toBe(true);
+
+    const cse = (await Department.findOne({ code: 'E2E-CSE' }).lean())!;
+    const scope = await resolvePublisherScope(String(hod.collegeId), { id: String(hod._id), role: 'hod', personaType: 'F-HOD', personas: ['F-HOD'] });
+    expect(scope).toMatchObject({ kind: 'department', departmentId: String(cse._id), office: 'HOD, E2E Computer Science' });
+  });
 });
```

Add the HOD to the Playwright users:

```diff
--- a/e2e/tests/utils/test-users.ts
+++ b/e2e/tests/utils/test-users.ts
@@ -10,7 +10,7 @@
  * the shared password.
  */
 
-export type E2ERole = 'super_admin' | 'principal' | 'registrar';
+export type E2ERole = 'super_admin' | 'principal' | 'registrar' | 'hod';
 
 export interface E2EUser {
   /** Email used in the login form. */
@@ -50,4 +50,12 @@
     password: E2E_TEST_PASSWORD,
     landingUrl: '/',
   },
+  // DB role `hod`, persona F-HOD, heading the seeded "E2E Computer Science"
+  // department (seedE2ENoticeAudience). The notices spec uses it to prove an
+  // HOD's audience stops at their own department.
+  hod: {
+    email: 'e2e_hod@juvion.test',
+    password: E2E_TEST_PASSWORD,
+    landingUrl: '/',
+  },
 };
```

```ts
// e2e/tests/juvi-notices.spec.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/scripts/__tests__/seed-e2e-users.test.ts`
Expected: FAIL: `seedE2ENoticeAudience is not a function` (and `E2E_HOD_EMAIL` is undefined).

With the backend on :3003 and the portal on :5173 (see the root `CLAUDE.md` Quick Start), run: `npm run test -w e2e -- tests/juvi-notices.spec.ts`
Expected: FAIL: `loginAs('hod')` stays on `/login` (no such user yet), and the Registrar's Departments listbox has no "E2E Computer Science" option.

- [ ] **Step 3: Implement**

```diff
--- a/backend/src/scripts/seed-e2e-users.ts
+++ b/backend/src/scripts/seed-e2e-users.ts
@@ -7,6 +7,10 @@
  *   - e2e_principal@juvion.test   (principal, collegeId = DEV_COLLEGE_ID)
  *   - e2e_registrar@juvion.test   (staff / ST-REG, collegeId = DEV_COLLEGE_ID)
  *
+ * The CLI also seeds the Juvi notices audience (seedE2ENoticeAudience): two
+ * departments, one faculty member in each, and e2e_hod@juvion.test heading
+ * the first.
+ *
  * All three share a known password: E2ETestPassword!
  *
  * The script is safe to re-run. It upserts by email so:
@@ -39,6 +43,9 @@
 import { User } from '../models/User';
 import { College } from '../models/College';
 import { AcademicYear } from '../models/academic-structure/AcademicYear';
+import { Department } from '../models/academic-structure/Department';
+import { Person } from '../models/people/Person';
+import { Faculty } from '../models/people/Faculty';
 import { seedPolicies } from '../shared/seed/policies';
 import { seedPersonas } from '../shared/seed/personas';
 
@@ -94,6 +101,54 @@
   );
 }
 
+export const E2E_HOD_EMAIL = 'e2e_hod@juvion.test';
+
+/**
+ * The Juvi notices e2e audience (e2e/tests/juvi-notices.spec.ts). The HOD heads
+ * the first department; the second is the one their scope must refuse. Codes
+ * are E2E-prefixed so they never collide with a dev seed in the same college.
+ */
+export const E2E_NOTICE_DEPARTMENTS = [
+  { code: 'E2E-CSE', name: 'E2E Computer Science', facultyCode: 'E2E-F1', person: { name: 'E2E HOD Rao', phone: '9000000101', email: E2E_HOD_EMAIL } },
+  { code: 'E2E-ECE', name: 'E2E Electronics', facultyCode: 'E2E-F2', person: { name: 'E2E Faculty Iyer', phone: '9000000102', email: 'e2e_faculty_ece@juvion.test' } },
+] as const;
+
+/**
+ * Two departments with one active faculty member each, and an `hod` login
+ * (persona F-HOD) linked to the first faculty member, who heads that
+ * department through Department.hodId. That is exactly what
+ * resolvePublisherScope reads, so the HOD gets a real department scope and
+ * the Registrar a real one-person audience. Idempotent: everything upserts
+ * on a natural key.
+ */
+export async function seedE2ENoticeAudience(passwordHash: string): Promise<void> {
+  const collegeId = new mongoose.Types.ObjectId(E2E_COLLEGE_ID);
+  let hodPersonId: mongoose.Types.ObjectId | undefined;
+  for (const [i, d] of E2E_NOTICE_DEPARTMENTS.entries()) {
+    const dept = (await Department.findOneAndUpdate({ collegeId, code: d.code }, { $set: { name: d.name, isActive: true } }, { upsert: true, new: true }))!;
+    const person = (await Person.findOneAndUpdate({ collegeId, email: d.person.email }, { $set: { name: d.person.name, phone: d.person.phone } }, { upsert: true, new: true }))!;
+    const faculty = (await Faculty.findOneAndUpdate(
+      { collegeId, employeeCode: d.facultyCode },
+      { $set: { personId: person._id, designation: 'Professor', departmentId: dept._id, status: 'active' } },
+      { upsert: true, new: true },
+    ))!;
+    if (i === 0) {
+      await Department.updateOne({ _id: dept._id }, { $set: { hodId: faculty._id } });
+      hodPersonId = person._id as mongoose.Types.ObjectId;
+    }
+  }
+  await User.updateOne(
+    { collegeId, email: E2E_HOD_EMAIL },
+    {
+      $set: {
+        email: E2E_HOD_EMAIL, name: 'E2E HOD Rao', role: 'hod', personaType: 'F-HOD', personas: ['F-HOD'],
+        password: passwordHash, isActive: true, collegeId, personId: hodPersonId,
+      },
+    },
+    { upsert: true },
+  );
+}
+
 export interface E2EUserDefinition {
   email: string;
   name: string;
@@ -218,6 +273,8 @@
   await mongoose.connect(mongoUri);
   try {
     const userResult = await seedE2EUsers();
+    // The Juvi notices spec's audience and HOD login (kept out of seedE2EUsers, whose callers count three users).
+    await seedE2ENoticeAudience(await bcrypt.hash(E2E_TEST_PASSWORD, 10));
     // RBAC default policies are required for `authorize()` to grant access.
     // Without them every authenticated request 403s and the e2e suite fails
     // on the post-login fetches (admissions, governance, platform, etc.).
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/scripts/__tests__/seed-e2e-users.test.ts`
Expected: PASS (7 tests).

Run: `npm run test -w e2e -- tests/juvi-notices.spec.ts tests/juvi-admin.spec.ts tests/auth.spec.ts`
Expected: PASS (9 tests: the 2 new ones plus the 7 neighbours; zero retries).

Run: `npm run typecheck`
Expected: exit 0 (backend, admin-portal and e2e).

Run: `npm run test -w backend && npm run test -w admin-portal`
Expected: PASS for every file this plan touched; any failure that already fails on `main` must be the same, unchanged (compare against a `main` run before blaming this branch).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/seed-e2e-users.ts backend/src/scripts/__tests__/seed-e2e-users.test.ts e2e/tests/utils/test-users.ts e2e/tests/juvi-notices.spec.ts
git commit -m "test(e2e): Juvi notices publish and HOD scope refusal

The e2e seed gains two departments with a faculty member each and an
e2e_hod login heading the first. The Registrar (an office persona)
publishes through the composer and the list shows 0 / 0 / 1; the HOD is
offered only their department and the server refuses another with 403.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec item | Where | Task |
|---|---|---|
| §8 `/communication/notices` list: title, office, audience line, published, acknowledged/seen/total, status, deadline state | `NoticesPage.tsx` columns, `countsText`, `deadlineText`, `noticeStatus` | 4 (helpers 3) |
| §8 list filters: office (admins) and status | `NoticesPage.tsx`; offices from `/targets` | 1, 4 |
| §8 / §11 "Delivering…" and "Delivery failed" in the list | `noticeStatus`; 3 s poll while delivering | 3, 4 |
| §8 `services/notices.ts` | typed client | 3 |
| §8 composer as a drawer and an embeddable component | `NoticeComposer` (drawer) + `NoticeComposerForm` (inline); `Drawer` on `useDialogFocus` | 5, 6 |
| §8 office selector (admins only) | "Publish as" over `targets.offices` | 1, 6 |
| §8 title and body, counters, limits | `maxLength` 120 / 5000 + live counters as descriptions | 6 |
| §8 attachments with upload progress, remove; §6.1 MIME list, 10 MB, 5 files, 503 | `AttachmentsField` | 6 |
| §8 audience chips, scoped searchable dropdowns, no raw ids | `AudienceBuilder` + `TargetPicker` fed by `/targets`; People via `/targets/people` | 2, 5 |
| §8 / US-1.2 live audience count: total, on Juvi, not on Juvi, per-batch breakdown | `useAudiencePreview` + `AudienceCount` | 5 |
| §8 acknowledgement toggle, deadline in college timezone, allow-comment | composer fieldset; `zonedLocalToIso`; timezone from `/targets` | 1, 3, 6 |
| §8 priority with the note on Urgent | radio group + `URGENT_NOTE` | 3, 6 |
| §8 Juvi card preview with deadline ring and audience line | `NoticeCardPreview` + `DeadlineRing` | 6 |
| §8 confirm-to-publish showing the count | `ConfirmStep` (requires a `current` count) | 6 |
| §8 Reach: counts with exact reconciliation | `ReachTab` summary sentence + mismatch alert | 7 |
| §8 Reach: per-section breakdown | groups table | 7 |
| §8 / US-4.2 pending list: paged, searchable, grouped, last-seen | `useInfiniteQuery` over the cursor, search, group filter | 7 |
| §8 / US-4.3 late, comments, added later listed separately | three sections | 7 |
| §8 CSV export for admins | "Export CSV" (admins) → `downloadReachCsv` + `saveBlob` | 7 |
| §8 / US-4.2 copy pending as text | `getAllPending` + `pendingAsText` → clipboard | 3, 7 |
| §8 / NTC-08 / US-4.4 remind (≤ 2, count shown, third refused with reason) | "Remind (n of 2 used)"; REMINDER_LIMIT 409 text and `detail.reminders` | 7 |
| §8 / NTC-09 / US-1.4 archive (the only change allowed; no edit UI) | "Archive" with danger confirm | 7 |
| §8 Audit tab | `AuditTab` | 8 |
| §8 / §11 Delivery tab, Retry delivery for a dead event (admins) | `DeliveryTab` | 8 |
| §6.2 dead events listed in the admin console | `DeadEventsPanel` on the Notices page (admins) | 8 |
| §8 legacy banners on Announcements and Circulars | `LegacyNoticesBanner` | 9 |
| §8 / US-5 Welcome notice section: pick per kind, or create prefilled | `WelcomeNoticeSection` in `SettingsTab`; list `?purpose=welcome` | 1, 9 |
| §8 mutation conventions (wrapped calls, `meta: { silent, silentError }`) | every `useMutation` in Tasks 6–9 | 6–9 |
| §8 errors shown from the ERP body | `noticeErrorMessage` / `errorStatus` (status-driven, server text verbatim) | 3, 5–9 |
| §8 accessibility: labels, keyboard chips and listboxes, drawer focus | `TargetPicker` combobox pattern, `aria-pressed` Everyone chip, `useDialogFocus` (trap, Escape, restore, initial focus), confirm heading focus | 5, 6 |
| US-1.1 composer offers only in-scope targets; server 403 shown | `/targets`-driven chips; 403 alert in the count | 5, 10 |
| US-1.2 live count matches the snapshot | count from the same `/audience-preview` the server uses; publish gated on a current count | 5, 6 |
| US-1.4 published notice is not editable | no edit UI; confirm step says so | 6, 7 |
| US-4.1 counts reconcile | reconciliation sentence | 7 |
| US-4.5 student refused reach (ERP side) | server-side (Plan 1); the portal never offers reach to non-publishers: `/communication` needs `notices:read`, which students lack | 4 |
| RCH-01 reach visible to publisher and admins only | detail 404 for others; CSV admins only | 7 |
| §12 portal tests | vitest + Testing Library in every portal task | 3–9 |
| §12 E2E: an office persona publishes through the composer, list shows counts | `juvi-notices.spec.ts` test 1 (Registrar) | 10 |
| §12 E2E: HOD scope refusal for another department | `juvi-notices.spec.ts` test 2 (UI offers own only; API 403) | 10 |
| Gap: notices permissions never reached the browser | `ALL_MODULES` gains `notices` | 1 |
| Gap: sidebar hidden by `accessibleModules` | `crossCutting` nav item | 4 |

## Self-review

- **Verified, not assumed.** Every code block in Tasks 1–10 was applied to a scratch copy of this branch and run. Backend: the unit tests, the two admin notices e2e files and `tsc` all pass. Portal: `tsc -b` exits 0, and the full vitest suite passes (43 files, 276 tests), including the untouched `Modal` users after the `useDialogFocus` refactor. The Playwright spec passed against a live backend and portal, next to `juvi-admin.spec.ts` and `auth.spec.ts`. The expected-pass counts in each Step 4 are the counts observed.
- **Backend scope kept small.** The four gaps are each a few lines plus tests; nothing in Plan 1's behaviour changes except that `purpose` moved from the detail onto every row, which the detail still exposes.
- **Error mapping** is by HTTP status only (403 → scope wording prefix, 404 → "not one you can see", 409/400/503 → the server's text), because the ERP body has no code. The one structured read is `detail.reminders` on a REMINDER_LIMIT 409.
- **Ambiguities resolved:**
  - `CirculamationsPage.tsx` is `pages/platform/CircularsPage.tsx`.
  - The Announcements and Circulars pages live under `/platform`, not under a communication area.
  - `custom` rules needed a people picker, so `/targets/people` was added (Task 2).
  - Read-only timestamps use the viewer's zone, and only the deadline uses college time, because read-only staff cannot call `/targets`.
  - The dead-events list sits on the Notices page.
  - Confirm-to-publish is an in-drawer step.
  - Lint is not a gate: the portal has no ESLint config on `main`.
- **Known limits, left for later:**
  - Attachments in the detail header are names only; the admin API has no presigned-download route.
  - "Create welcome notice" cannot select the new notice until its fan-out finishes, because the settings service accepts only `published` notices; the section says so.

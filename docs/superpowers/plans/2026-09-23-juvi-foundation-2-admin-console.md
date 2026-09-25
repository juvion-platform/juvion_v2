# Juvi Foundation — Plan 2 of 3: Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the IT admin everything needed to switch Juvi on for a college and get people into the app: institution settings with pause and version gate, bulk provisioning with per-section credential export, account management with deactivate, reset and reveal, and a read-only view of channels and templates.

**Architecture:** ERP-authenticated admin routes under `/api/juvi-app/admin` inside the `juvi-app` module, gated by the existing `authorize('platform', …)` policy chain and rendering the ERP's error shape. A new `/platform/juvi` area in the admin portal with three tabs, built on React Query, Zustand permissions and the portal's existing form conventions. One Playwright spec exercises the happy path against the live stack.

**Tech Stack:** Express 4, Zod 3, Mongoose 8 (backend); React 19, React Router 7, React Query 5, Zustand 5, Tailwind 3, lucide-react, vitest + Testing Library (portal); Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md` §9 (credential export), §12 (admin portal and admin routes), §16 (Playwright), §17 (rollout). Depends on Plan 1 (`2026-09-23-juvi-foundation-1-backend-core.md`) being merged.

## Global Constraints

- Admin routes use the ERP chain `authenticate` → `authorize('platform', action)` and the ERP error shape `{ error: string }` from `middleware/errorHandler`. They never use the mobile middleware or envelope.
- `authorize` actions per spec §12: reads use `read`; run creation, CSV export and reveal use `create`; deactivate, reset-password, settings and manual reconcile use `update`.
- Every admin query is scoped by `req.collegeId!`. The `:id` of an account, run or channel is always combined with `collegeId` in the query.
- Portal: pages under `admin-portal/src/pages/platform/`, components under `admin-portal/src/components/platform/juvi/`, service in `admin-portal/src/services/juvi-app.ts`. Follow `BulkImportsPage.tsx` conventions: Tailwind classes, `lucide-react` icons, `useQuery`/`useMutation`, `confirmAction` from `stores/confirmStore`, `toast` from `stores/toastStore`, permissions via `useAuthStore((s) => s.hasPermission(module, action))`.
- Local CSS constants where a file needs them (they are not exported anywhere):
  `const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';`
  `const lbl = 'block text-sm font-medium text-gray-700 mb-1';`
- Portal tests: `renderWithProviders` from `src/__tests__/test-utils.tsx`, services mocked with `vi.mock`, accessible queries (`getByRole`, `getByLabelText`).
- Playwright: zero retries, no `waitForTimeout`, accessible selectors, login through `loginAs('principal')` (the e2e principal is a DB `admin` with `*:*`).
- Commit after every task with the attribution line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

**Create**

```
backend/src/modules/juvi-app/admin/routes.ts                 mounts the admin sub-routers + ERP errorHandler
backend/src/modules/juvi-app/admin/schemas.ts                zod for settings, runs, accounts queries
backend/src/modules/juvi-app/admin/settings-service.ts       get/update College.juvi, first-enable side effects
backend/src/modules/juvi-app/admin/settings-controller.ts
backend/src/modules/juvi-app/admin/provisioning-service.ts   run listing, credential groups, CSV
backend/src/modules/juvi-app/admin/provisioning-controller.ts
backend/src/modules/juvi-app/admin/accounts-service.ts       list/search, reset, reveal
backend/src/modules/juvi-app/admin/accounts-controller.ts
backend/src/modules/juvi-app/admin/channels-controller.ts    channels, templates, reconcile trigger
backend/src/__e2e__/modules/juvi-app-admin-*.e2e.test.ts

admin-portal/src/services/juvi-app.ts
admin-portal/src/pages/platform/JuviAdminPage.tsx           tabs shell
admin-portal/src/components/platform/juvi/SettingsTab.tsx
admin-portal/src/components/platform/juvi/ProvisioningTab.tsx
admin-portal/src/components/platform/juvi/NewRunForm.tsx
admin-portal/src/components/platform/juvi/RunsTable.tsx
admin-portal/src/components/platform/juvi/CredentialsDownload.tsx
admin-portal/src/components/platform/juvi/AccountsTable.tsx
admin-portal/src/components/platform/juvi/ChannelsTab.tsx
admin-portal/src/components/platform/juvi/__tests__/*.test.tsx

e2e/tests/juvi-admin.spec.ts
```

**Modify**

```
backend/src/modules/juvi-app/routes.ts          router.use('/admin', adminRouter)
backend/src/scripts/seed-e2e-users.ts           upsert the E2E College document
admin-portal/src/pages/Platform.tsx             hub card + <Route path="juvi/*">
```

---

### Task 1: E2E college seed, admin router skeleton, settings endpoints

**Files:**
- Create: `backend/src/modules/juvi-app/admin/routes.ts`, `admin/schemas.ts`, `admin/settings-service.ts`, `admin/settings-controller.ts`
- Modify: `backend/src/modules/juvi-app/routes.ts`, `backend/src/scripts/seed-e2e-users.ts`
- Test: `backend/src/__e2e__/modules/juvi-app-admin-settings.e2e.test.ts`

**Interfaces:**
- Consumes (Plan 1): `getJuviConfig`, `invalidateJuviConfig` (config/institution-config), `getLastReconcile` (spaces/reconcile-service), `seedChannelTemplates` (shared/seed/channel-templates), `enqueueReconcile` (spaces/reconcile-worker), `IJuviConfig` (models/College).
- Produces:
  ```ts
  // schemas.ts
  export const settingsUpdateSchema;   // partial of College.juvi with validation
  // settings-service.ts
  export interface AdminSettingsView { juvi: IJuviConfig; college: { name: string; code: string }; lastReconcile: ReconcileSummary | null }
  export async function getSettings(collegeId: string): Promise<AdminSettingsView>;
  export async function updateSettings(collegeId: string, patch: z.infer<typeof settingsUpdateSchema>, performedBy: string): Promise<AdminSettingsView>;
  // routes.ts
  export const adminRouter: Router;   // GET/PUT /settings for now
  ```

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-admin-settings.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { College } from '../../models/College';
import { ChannelTemplate } from '../../models/juvi/ChannelTemplate';
import { AuditLog } from '../../shared/audit';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

describe('admin settings', () => {
  it('GET returns defaults for a college that never enabled Juvi', async () => {
    const res = await api.as(fx.admin.token).get(`${A}/settings`).expect(200);
    expect(res.body.juvi).toMatchObject({ enabled: false, paused: false, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata' });
    expect(res.body.college).toEqual({ name: 'JIT Test College', code: 'JIT-TEST' });
    expect(res.body.lastReconcile).toBeNull();
  });

  it('PUT enables Juvi, seeds templates, writes an audit row and returns the new view', async () => {
    const res = await api.as(fx.admin.token).put(`${A}/settings`).send({
      enabled: true, accentColor: '#0B5FA5', supportContact: { name: 'Office', phone: '040-1' },
      quietHoursDefault: { start: '21:30', end: '06:30' }, minAppVersion: { android: '1.0.0' },
    }).expect(200);
    expect(res.body.juvi).toMatchObject({ enabled: true, accentColor: '#0B5FA5', supportContact: { name: 'Office', phone: '040-1' }, quietHoursDefault: { start: '21:30', end: '06:30' } });
    expect((await College.findById(fx.collegeId).lean())?.juvi.enabled).toBe(true);
    expect(await ChannelTemplate.countDocuments({ collegeId: fx.collegeId })).toBe(5);
    const audit = await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'College', action: 'update' }).lean();
    expect(audit?.changes.map((c) => c.field)).toContain('juvi.enabled');
  });

  it('PUT validates colour, quiet hours and pause message', async () => {
    await api.as(fx.admin.token).put(`${A}/settings`).send({ accentColor: 'blue' }).expect(400);
    await api.as(fx.admin.token).put(`${A}/settings`).send({ quietHoursDefault: { start: '25:00', end: '07:00' } }).expect(400);
    const res = await api.as(fx.admin.token).put(`${A}/settings`).send({ paused: true, pausedMessage: 'Maintenance until Monday' }).expect(200);
    expect(res.body.juvi).toMatchObject({ paused: true, pausedMessage: 'Maintenance until Monday' });
  });

  it('is unreachable without a token and renders the ERP error shape', async () => {
    const res = await api.get(`${A}/settings`).expect(401);
    expect(res.body).toEqual({ error: 'No token provided' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-settings.e2e.test.ts`
Expected: FAIL: 404 envelope `Route not found` (the mobile router's catch-all).

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/admin/schemas.ts
import { z } from 'zod';
import { HHMM } from '../../../models/juvi/JuviAccount';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const version = z.string().regex(/^\d+(\.\d+){0,2}$/, 'Use a version like 1.2.0');

export const settingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  paused: z.boolean().optional(),
  pausedMessage: z.string().trim().max(300).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #0B5FA5').optional(),
  supportContact: z.object({ name: z.string().trim().min(1).max(80), phone: z.string().trim().max(30).optional(), email: z.string().trim().email().optional() }).optional(),
  quietHoursDefault: z.object({ start: z.string().regex(HHMM), end: z.string().regex(HHMM) }).optional(),
  minAppVersion: z.object({ android: version.optional(), ios: version.optional() }).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  featureFlags: z.object({ languageRoadmap: z.boolean().optional() }).optional(),
}).strict();

export const createRunSchema = z.object({
  kinds: z.array(z.enum(['student', 'faculty', 'staff'])).min(1),
  programmeIds: z.array(objectId).optional(),
  batchIds: z.array(objectId).optional(),
  departmentIds: z.array(objectId).optional(),
  resetExistingPasswords: z.boolean().optional(),
});

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const accountsQuerySchema = pageQuerySchema.extend({
  kind: z.enum(['student', 'faculty', 'staff']).optional(),
  status: z.enum(['onboarding', 'active', 'exiting', 'deactivated']).optional(),
  q: z.string().trim().max(80).optional(),
});

export const credentialsQuerySchema = z.object({
  sectionId: objectId.optional(), batchId: objectId.optional(), departmentId: objectId.optional(),
});
```

```ts
// backend/src/modules/juvi-app/admin/settings-service.ts
import { z } from 'zod';
import { College, IJuviConfig } from '../../../models/College';
import { AppError } from '../../../middleware/errorHandler';
import { createAuditLog } from '../../../shared/audit';
import { FieldChange } from '../../../shared/types';
import { seedChannelTemplates } from '../../../shared/seed/channel-templates';
import { invalidateJuviConfig } from '../config/institution-config';
import { getLastReconcile, ReconcileSummary } from '../spaces/reconcile-service';
import { enqueueReconcile } from '../spaces/reconcile-worker';
import { settingsUpdateSchema } from './schemas';

export interface AdminSettingsView {
  juvi: IJuviConfig;
  college: { name: string; code: string };
  lastReconcile: ReconcileSummary | null;
}

async function view(collegeId: string): Promise<AdminSettingsView> {
  const c = await College.findById(collegeId).select('name code juvi').lean();
  if (!c) throw new AppError(404, 'College not found');
  return { juvi: c.juvi, college: { name: c.name, code: c.code }, lastReconcile: await getLastReconcile(collegeId) };
}

export async function getSettings(collegeId: string): Promise<AdminSettingsView> {
  return view(collegeId);
}

/** Flattens the patch to dotted `juvi.*` paths so partial updates never clobber siblings. */
function flatten(patch: Record<string, unknown>, prefix = 'juvi'): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !['supportContact', 'minAppVersion', 'quietHoursDefault'].includes(k)) {
      Object.assign(out, flatten(v as Record<string, unknown>, `${prefix}.${k}`));
    } else {
      out[`${prefix}.${k}`] = v;
    }
  }
  return out;
}

export async function updateSettings(collegeId: string, patch: z.infer<typeof settingsUpdateSchema>, performedBy: string): Promise<AdminSettingsView> {
  const before = await College.findById(collegeId).select('name juvi').lean();
  if (!before) throw new AppError(404, 'College not found');
  const set = flatten(patch as Record<string, unknown>);
  if (Object.keys(set).length === 0) throw new AppError(400, 'Nothing to update');

  await College.updateOne({ _id: collegeId }, { $set: set });
  await invalidateJuviConfig(collegeId);

  const changes: FieldChange[] = Object.entries(set).map(([field, newValue]) => ({
    field, displayName: field.replace('juvi.', 'Juvi '), oldValue: field.split('.').slice(1).reduce<any>((o, k) => o?.[k], before.juvi), newValue,
  }));
  await createAuditLog({ collegeId, entityType: 'College', entityId: collegeId, entityName: before.name, action: 'update', changes, performedBy });

  // First enable: make sure templates exist and kick off the first reconcile.
  if (patch.enabled === true && !before.juvi?.enabled) {
    await seedChannelTemplates(collegeId);
    await enqueueReconcile(collegeId);
  }
  return view(collegeId);
}
```

```ts
// backend/src/modules/juvi-app/admin/settings-controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/authenticate';
import * as settings from './settings-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

export async function getSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await settings.getSettings(req.collegeId!)); } catch (e) { next(e); }
}
export async function updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await settings.updateSettings(req.collegeId!, req.body, who(req))); } catch (e) { next(e); }
}
```

```ts
// backend/src/modules/juvi-app/admin/routes.ts
import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { authorize } from '../../../middleware/authorize';
import { validate } from '../../../middleware/validate';
import { errorHandler } from '../../../middleware/errorHandler';
import { settingsUpdateSchema } from './schemas';
import * as settingsCtrl from './settings-controller';

/**
 * ERP-side administration of Juvi. ERP auth chain, ERP error shape.
 * Mounted by ../routes.ts at /api/juvi-app/admin, ahead of the mobile 404 catch-all.
 */
export const adminRouter = Router();
adminRouter.use(authenticate);

adminRouter.get('/settings', authorize('platform', 'read'), settingsCtrl.getSettings);
adminRouter.put('/settings', authorize('platform', 'update'), validate(settingsUpdateSchema), settingsCtrl.updateSettings);

// Tasks 2–4 add provisioning, accounts and channels routes above this line.
adminRouter.use(errorHandler);
```

Modify `backend/src/modules/juvi-app/routes.ts` — mount before the 404 catch-all:

```ts
import { adminRouter } from './admin/routes';
// after router.use('/v1', v1Router);
router.use('/admin', adminRouter);
```

Modify `backend/src/scripts/seed-e2e-users.ts` — add a College upsert so the e2e stack has a College document for `DEV_COLLEGE_ID` (today it seeds only users, policies and an academic year). Add this function and call it first in the script's main flow:

```ts
import { College } from '../models/College';

/** The Playwright stack needs a College row for the e2e college id; settings and Juvi read it. */
async function seedE2ECollege(collegeId: string): Promise<void> {
  await College.updateOne(
    { _id: collegeId },
    {
      $setOnInsert: {
        _id: collegeId, name: 'E2E College', code: 'E2E',
        address: { line1: '1 Test Road', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
        contactEmail: 'e2e@juvion.test', contactPhone: '9000000000',
        subscription: { plan: 'premium', status: 'active' }, status: 'active',
      },
    },
    { upsert: true },
  );
}
```

Call it as `await seedE2ECollege(E2E_COLLEGE_ID);` immediately after the DB connection is established and before the user upserts.

- [ ] **Step 4: Run the test and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-settings.e2e.test.ts && npm run typecheck`
Expected: PASS (4 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app backend/src/scripts/seed-e2e-users.ts backend/src/__e2e__/modules/juvi-app-admin-settings.e2e.test.ts
git commit -m "feat(juvi-app): admin settings routes with first-enable template seed, e2e College seed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Provisioning runs and credential export endpoints

**Files:**
- Create: `backend/src/modules/juvi-app/admin/provisioning-service.ts`, `admin/provisioning-controller.ts`
- Modify: `backend/src/modules/juvi-app/admin/routes.ts`
- Test: `backend/src/__e2e__/modules/juvi-app-admin-provisioning.e2e.test.ts`

**Interfaces:**
- Consumes (Plan 1): `createProvisioningRun`, `runProvisioningJob` (accounts/provisioning-worker), `decryptSecret` (accounts/credential-store), `JuviProvisioningRun`, `JuviProvisionedCredential`, `paginate`.
- Produces:
  ```ts
  export async function listRuns(collegeId: string, page: number, limit: number): Promise<PaginatedResult<IJuviProvisioningRun>>;
  export async function getRun(collegeId: string, runId: string): Promise<IJuviProvisioningRun>;
  export interface CredentialGroup { key: 'section' | 'batch' | 'department' | 'none'; id: string | null; label: string; count: number }
  export async function credentialGroups(collegeId: string, runId: string): Promise<{ expiresAt: Date | null; live: boolean; groups: CredentialGroup[] }>;
  export async function credentialsCsv(collegeId: string, runId: string, filter: { sectionId?: string; batchId?: string; departmentId?: string }, performedBy: string): Promise<string>;   // throws 410 when expired/none
  ```
  Routes: `POST /provisioning/runs` (create → 202), `GET /provisioning/runs`, `GET /provisioning/runs/:id`, `GET /provisioning/runs/:id/credential-groups`, `GET /provisioning/runs/:id/credentials.csv`.

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-admin-provisioning.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { Person, Student, Section } from '../../models';
import { JuviProvisioningRun } from '../../models/juvi/JuviProvisioningRun';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { AuditLog } from '../../shared/audit';
import { runProvisioningJob } from '../../modules/juvi-app/accounts/provisioning-worker';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

async function studentNoUser(roll: string, sectionId?: unknown) {
  const person = await Person.create({ collegeId: fx.collegeId, name: `S ${roll}`, phone: `9${roll.replace(/\D/g, '').padStart(9, '0')}` });
  const s = await Student.create({ collegeId: fx.collegeId, personId: person._id, admissionYear: 2024, rollNumber: roll, status: 'active', batchId: fx.batch._id, branchId: fx.cseBranch._id, programmeId: fx.btech._id });
  if (sectionId) await Section.updateOne({ _id: sectionId }, { $addToSet: { studentIds: s._id } });
  return s;
}

/** Wait for the inline fallback (no Redis in tests) to finish the run. */
async function settled(runId: string) {
  for (let i = 0; i < 50; i++) {
    const r = await JuviProvisioningRun.findById(runId).lean();
    if (r && ['completed', 'partial', 'failed'].includes(r.status)) return r;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error('run did not settle');
}

describe('provisioning runs', () => {
  it('POST creates a run (202), which completes; GET lists and fetches it', async () => {
    await studentNoUser('24C001', fx.cseSection._id);
    await studentNoUser('24C002');
    const created = await api.as(fx.admin.token).post(`${A}/provisioning/runs`).send({ kinds: ['student'], batchIds: [String(fx.batch._id)] }).expect(202);
    expect(created.body.status).toMatch(/queued|running|completed/);
    const run = await settled(created.body._id);
    expect(run.counts).toMatchObject({ scanned: 2, created: 2 });
    const list = await api.as(fx.admin.token).get(`${A}/provisioning/runs`).expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.total).toBe(1);
    const one = await api.as(fx.admin.token).get(`${A}/provisioning/runs/${created.body._id}`).expect(200);
    expect(one.body.performedBy).toBe('College Admin');
    await api.as(fx.admin.token).post(`${A}/provisioning/runs`).send({ kinds: [] }).expect(400);
  });

  it('credential groups and CSV export by section, audited; 410 once expired', async () => {
    await studentNoUser('24D001', fx.cseSection._id);
    await studentNoUser('24D002', fx.cseSection._id);
    await studentNoUser('24D003');
    const run = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    await runProvisioningJob(String(run._id));

    const groups = await api.as(fx.admin.token).get(`${A}/provisioning/runs/${run._id}/credential-groups`).expect(200);
    expect(groups.body.live).toBe(true);
    expect(groups.body.groups).toEqual(expect.arrayContaining([
      { key: 'section', id: String(fx.cseSection._id), label: 'Section A', count: 2 },
      { key: 'none', id: null, label: 'No section', count: 1 },
    ]));

    const csv = await api.as(fx.admin.token).get(`${A}/provisioning/runs/${run._id}/credentials.csv?sectionId=${fx.cseSection._id}`).expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toMatch(/attachment; filename="juvi-credentials-/);
    const lines = csv.text.trim().split('\n');
    expect(lines[0]).toBe('identifier,name,section,temporaryPassword,institutionCode');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^24D00[12],S 24D00[12],A,[a-z]+-[a-z]+-\d{3},JIT-TEST$/);
    expect(await AuditLog.countDocuments({ entityType: 'JuviProvisioningRun', entityId: String(run._id), action: 'update' })).toBe(1);

    await JuviProvisionedCredential.deleteMany({ runId: run._id });   // simulate TTL expiry
    const gone = await api.as(fx.admin.token).get(`${A}/provisioning/runs/${run._id}/credentials.csv`).expect(410);
    expect(gone.body.error).toMatch(/expired/i);
  });

  it('reads are allowed for any platform reader (RBAC is a pass-through in this harness)', async () => {
    const run = await JuviProvisioningRun.create({ collegeId: fx.collegeId, filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'admin' });
    // The route-level authorize actions are pinned by the unit test in Step 3, not here.
    await api.as(fx.principal.token).get(`${A}/provisioning/runs/${run._id}/credential-groups`).expect(200);
  });

  it('another college cannot see the run', async () => {
    const run = await JuviProvisioningRun.create({ collegeId: '000000000000000000000099', filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, performedBy: 'x' });
    await api.as(fx.admin.token).get(`${A}/provisioning/runs/${run._id}`).expect(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-provisioning.e2e.test.ts`
Expected: FAIL: 404 on `POST /provisioning/runs`.

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/admin/provisioning-service.ts
import { Types } from 'mongoose';
import { JuviProvisioningRun, IJuviProvisioningRun } from '../../../models/juvi/JuviProvisioningRun';
import { JuviProvisionedCredential } from '../../../models/juvi/JuviProvisionedCredential';
import { Section } from '../../../models/academic-structure/Section';
import { Batch } from '../../../models/academic-structure/Batch';
import { Department } from '../../../models/academic-structure/Department';
import { College } from '../../../models/College';
import { paginate } from '../../../shared/pagination';
import { PaginatedResult } from '../../../shared/types';
import { AppError } from '../../../middleware/errorHandler';
import { createAuditLog } from '../../../shared/audit';
import { decryptSecret } from '../accounts/credential-store';

export async function listRuns(collegeId: string, page: number, limit: number): Promise<PaginatedResult<IJuviProvisioningRun>> {
  return paginate(JuviProvisioningRun, { collegeId }, page, limit, { createdAt: -1 });
}

export async function getRun(collegeId: string, runId: string): Promise<IJuviProvisioningRun> {
  const run = await JuviProvisioningRun.findOne({ _id: runId, collegeId });
  if (!run) throw new AppError(404, 'Provisioning run not found');
  return run;
}

export interface CredentialGroup { key: 'section' | 'batch' | 'department' | 'none'; id: string | null; label: string; count: number }

export async function credentialGroups(collegeId: string, runId: string): Promise<{ expiresAt: Date | null; live: boolean; groups: CredentialGroup[] }> {
  const run = await getRun(collegeId, runId);
  const rows = await JuviProvisionedCredential.find({ collegeId, runId: run._id, expiresAt: { $gt: new Date() } }).select('sectionId batchId departmentId').lean();
  const count = (key: 'sectionId' | 'batchId' | 'departmentId') => {
    const m = new Map<string, number>();
    for (const r of rows) { const id = r[key] ? String(r[key]) : ''; m.set(id, (m.get(id) ?? 0) + 1); }
    return m;
  };
  const groups: CredentialGroup[] = [];
  const bySection = count('sectionId');
  const sections = await Section.find({ _id: { $in: [...bySection.keys()].filter(Boolean) } }).select('name').lean();
  for (const [id, n] of bySection) {
    if (!id) { groups.push({ key: 'none', id: null, label: 'No section', count: n }); continue; }
    groups.push({ key: 'section', id, label: `Section ${sections.find((s) => String(s._id) === id)?.name ?? '?'}`, count: n });
  }
  const byBatch = count('batchId');
  const batches = await Batch.find({ _id: { $in: [...byBatch.keys()].filter(Boolean) } }).select('code').lean();
  for (const [id, n] of byBatch) if (id) groups.push({ key: 'batch', id, label: `Batch ${batches.find((b) => String(b._id) === id)?.code ?? '?'}`, count: n });
  const byDept = count('departmentId');
  const depts = await Department.find({ _id: { $in: [...byDept.keys()].filter(Boolean) } }).select('name').lean();
  for (const [id, n] of byDept) if (id) groups.push({ key: 'department', id, label: depts.find((d) => String(d._id) === id)?.name ?? '?', count: n });
  return { expiresAt: run.credentialsExpireAt ?? null, live: rows.length > 0, groups };
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function credentialsCsv(
  collegeId: string, runId: string, filter: { sectionId?: string; batchId?: string; departmentId?: string }, performedBy: string,
): Promise<string> {
  const run = await getRun(collegeId, runId);
  const q: Record<string, unknown> = { collegeId, runId: run._id, expiresAt: { $gt: new Date() } };
  if (filter.sectionId) q.sectionId = new Types.ObjectId(filter.sectionId);
  if (filter.batchId) q.batchId = new Types.ObjectId(filter.batchId);
  if (filter.departmentId) q.departmentId = new Types.ObjectId(filter.departmentId);
  const rows = await JuviProvisionedCredential.find(q).sort({ identifier: 1 }).lean();
  if (rows.length === 0) throw new AppError(410, 'The credentials for this run have expired or none match. Reset passwords from the accounts table instead.');

  const [college, sections] = await Promise.all([
    College.findById(collegeId).select('code').lean(),
    Section.find({ _id: { $in: rows.map((r) => r.sectionId).filter(Boolean) } }).select('name').lean(),
  ]);
  const sectionName = new Map(sections.map((s) => [String(s._id), s.name]));
  const lines = ['identifier,name,section,temporaryPassword,institutionCode'];
  for (const r of rows) {
    lines.push([r.identifier, r.displayName, r.sectionId ? sectionName.get(String(r.sectionId)) ?? '' : '', decryptSecret(r), college?.code ?? ''].map(csvCell).join(','));
  }
  await createAuditLog({
    collegeId, entityType: 'JuviProvisioningRun', entityId: String(run._id), entityName: `Provisioning run ${String(run._id).slice(-6)}`,
    action: 'update', changes: [{ field: 'credentialsExported', displayName: 'Credentials exported', oldValue: null, newValue: { count: rows.length, ...filter } }], performedBy,
  });
  return lines.join('\n') + '\n';
}
```

```ts
// backend/src/modules/juvi-app/admin/provisioning-controller.ts
import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../../../middleware/authenticate';
import { createProvisioningRun } from '../accounts/provisioning-worker';
import { createRunSchema, pageQuerySchema, credentialsQuerySchema } from './schemas';
import * as svc from './provisioning-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

export async function createRun(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = createRunSchema.parse(req.body);
    const run = await createProvisioningRun({
      collegeId: req.collegeId!, performedBy: who(req),
      filter: {
        kinds: body.kinds,
        programmeIds: body.programmeIds?.map((id) => new Types.ObjectId(id)),
        batchIds: body.batchIds?.map((id) => new Types.ObjectId(id)),
        departmentIds: body.departmentIds?.map((id) => new Types.ObjectId(id)),
      },
      options: { resetExistingPasswords: body.resetExistingPasswords },
    });
    res.status(202).json(run);
  } catch (e) { next(e); }
}
export async function listRuns(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { page, limit } = pageQuerySchema.parse(req.query); res.json(await svc.listRuns(req.collegeId!, page, limit)); } catch (e) { next(e); }
}
export async function getRun(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getRun(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function credentialGroups(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.credentialGroups(req.collegeId!, req.params.id as string)); } catch (e) { next(e); }
}
export async function credentialsCsv(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const filter = credentialsQuerySchema.parse(req.query);
    const csv = await svc.credentialsCsv(req.collegeId!, req.params.id as string, filter, who(req));
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="juvi-credentials-${stamp}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
}
```

Add to `backend/src/modules/juvi-app/admin/routes.ts` above the `errorHandler` line:

```ts
import * as provisioningCtrl from './provisioning-controller';

adminRouter.post('/provisioning/runs', authorize('platform', 'create'), provisioningCtrl.createRun);
adminRouter.get('/provisioning/runs', authorize('platform', 'read'), provisioningCtrl.listRuns);
adminRouter.get('/provisioning/runs/:id', authorize('platform', 'read'), provisioningCtrl.getRun);
adminRouter.get('/provisioning/runs/:id/credential-groups', authorize('platform', 'read'), provisioningCtrl.credentialGroups);
// Reveals secrets: 'create', matching the spec's rule that anything exposing a credential needs the higher permission.
adminRouter.get('/provisioning/runs/:id/credentials.csv', authorize('platform', 'create'), provisioningCtrl.credentialsCsv);
```

Zod errors thrown by `createRunSchema.parse` inside the controller reach the router's `errorHandler`, which does not know Zod. Add a Zod branch to `middleware/errorHandler.ts` so it renders `{ error: 'Validation failed', details: [...] }` exactly like `validate()` does:

```ts
import { ZodError } from 'zod';
// at the top of errorHandler():
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })) });
  }
```

And a unit test for the route permissions, so the `authorize` actions are pinned even though the e2e harness runs RBAC as a pass-through:

```ts
// backend/src/modules/juvi-app/admin/__tests__/routes-permissions.test.ts
import { describe, it, expect, vi } from 'vitest';
const calls = vi.hoisted(() => [] as string[]);
vi.mock('../../../../middleware/authorize', () => ({ authorize: (m: string, a: string) => { calls.push(`${m}:${a}`); return (_q: unknown, _s: unknown, n: () => void) => n(); } }));
vi.mock('../../../../middleware/authenticate', () => ({ authenticate: (_q: unknown, _s: unknown, n: () => void) => n() }));
import { adminRouter } from '../routes';

describe('admin routes declare the spec permissions', () => {
  it('uses platform:create for run creation, CSV export and reveal; platform:update for mutations', () => {
    expect(adminRouter).toBeDefined();
    expect(calls.filter((c) => c === 'platform:create').length).toBeGreaterThanOrEqual(3);
    expect(calls).toContain('platform:update');
    expect(calls).toContain('platform:read');
    expect(calls.every((c) => c.startsWith('platform:'))).toBe(true);
  });
});
```

(After Task 3 adds reveal and reset, the `>= 3` holds: create-run, credentials.csv, reveal-credential.)

- [ ] **Step 4: Run tests and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-provisioning.e2e.test.ts && npx vitest run src/modules/juvi-app/admin && npm run typecheck`
Expected: e2e PASS (4 tests); the permissions unit test passes once Task 3 lands (it asserts `>= 3` create routes — run it again after Task 3), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/admin backend/src/middleware/errorHandler.ts backend/src/__e2e__/modules/juvi-app-admin-provisioning.e2e.test.ts
git commit -m "feat(juvi-app): admin provisioning runs, credential groups and audited CSV export

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Accounts list, deactivate, reset password, reveal

**Files:**
- Create: `backend/src/modules/juvi-app/admin/accounts-service.ts`, `admin/accounts-controller.ts`
- Modify: `backend/src/modules/juvi-app/admin/routes.ts`
- Test: `backend/src/__e2e__/modules/juvi-app-admin-accounts.e2e.test.ts`

**Interfaces:**
- Consumes (Plan 1): `deactivateAccount` (accounts/provisioning-service), `generateTemporaryPassword`, `storeCredential`, `revealLatestForAccount`, `revokeOtherSessions`.
- Produces:
  ```ts
  export interface AccountRow { id: string; kind: AccountKind; status: AccountStatus; name: string; identifier: string; email: string; onboardingComplete: boolean; lastSeenAt: string | null; provisionedAt: string; hasLiveCredential: boolean; credentialExpiresAt: string | null }
  export async function listAccounts(collegeId: string, q: { kind?: AccountKind; status?: AccountStatus; q?: string; page: number; limit: number }): Promise<PaginatedResult<AccountRow>>;
  export async function resetPassword(collegeId: string, accountId: string, performedBy: string): Promise<{ credentialId: string; expiresAt: Date }>;
  export async function revealCredential(collegeId: string, accountId: string, performedBy: string): Promise<{ identifier: string; password: string; expiresAt: Date }>;   // 410 when none
  ```
  Routes: `GET /accounts`, `POST /accounts/:id/deactivate` (update), `POST /accounts/:id/reset-password` (update), `POST /accounts/:id/reveal-credential` (create).

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-admin-accounts.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import bcrypt from 'bcryptjs';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { provisionTestStudent, provisionTestFaculty } from '../factories/juvi.factory';
import { User } from '../../models/User';
import { MobileSession } from '../../models/juvi/MobileSession';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { AuditLog } from '../../shared/audit';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

describe('admin accounts', () => {
  it('lists with kind/status filters and free-text search over name, roll and employee code', async () => {
    const s = await provisionTestStudent(fx);
    const f = await provisionTestFaculty(fx);
    const all = await api.as(fx.admin.token).get(`${A}/accounts`).expect(200);
    expect(all.body.total).toBe(2);
    expect(all.body.items[0]).toMatchObject({ kind: expect.any(String), status: 'onboarding', hasLiveCredential: true, onboardingComplete: false });
    const students = await api.as(fx.admin.token).get(`${A}/accounts?kind=student`).expect(200);
    expect(students.body.items).toHaveLength(1);
    expect(students.body.items[0]).toMatchObject({ name: s.person.name, identifier: s.student.rollNumber, email: s.person.email });
    const byRoll = await api.as(fx.admin.token).get(`${A}/accounts?q=${s.student.rollNumber.slice(0, 5)}`).expect(200);
    expect(byRoll.body.items.map((r: any) => r.id)).toEqual([String(s.account._id)]);
    const byCode = await api.as(fx.admin.token).get(`${A}/accounts?q=${f.faculty.employeeCode}`).expect(200);
    expect(byCode.body.items[0].identifier).toBe(f.faculty.employeeCode);
    const byName = await api.as(fx.admin.token).get(`${A}/accounts?q=${encodeURIComponent(f.person.name.split(' ')[0])}`).expect(200);
    expect(byName.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('deactivate flips status; list shows it; the mobile side is covered in Plan 1', async () => {
    const s = await provisionTestStudent(fx);
    const res = await api.as(fx.admin.token).post(`${A}/accounts/${s.account._id}/deactivate`).expect(200);
    expect(res.body.status).toBe('deactivated');
    const list = await api.as(fx.admin.token).get(`${A}/accounts?status=deactivated`).expect(200);
    expect(list.body.items[0].id).toBe(String(s.account._id));
    await api.as(fx.admin.token).post(`${A}/accounts/000000000000000000000001/deactivate`).expect(404);
  });

  it('reset-password stores a new credential, forces change, revokes sessions; reveal returns it once live and 410 when gone', async () => {
    const s = await provisionTestStudent(fx);
    await MobileSession.create({ collegeId: fx.collegeId, accountId: s.account._id, userId: s.account.userId, deviceId: 'd', deviceName: 'n', platform: 'android', appVersion: '1', osVersion: '1', refreshTokenHash: 'h', refreshExpiresAt: new Date(Date.now() + 1000) });
    const reset = await api.as(fx.admin.token).post(`${A}/accounts/${s.account._id}/reset-password`).expect(200);
    expect(reset.body.credentialId).toBeTypeOf('string');
    expect(await JuviProvisionedCredential.countDocuments({ accountId: s.account._id })).toBe(2);
    const user = await User.findById(s.account.userId).lean();
    expect(user?.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(s.tempPassword, user!.password)).toBe(false);
    expect((await MobileSession.findOne({ accountId: s.account._id }).lean())?.revokedReason).toBe('admin');

    const reveal = await api.as(fx.admin.token).post(`${A}/accounts/${s.account._id}/reveal-credential`).expect(200);
    expect(reveal.body).toMatchObject({ identifier: s.student.rollNumber, password: expect.stringMatching(/^[a-z]+-[a-z]+-\d{3}$/) });
    expect(await bcrypt.compare(reveal.body.password, user!.password)).toBe(true);
    expect(await AuditLog.countDocuments({ entityType: 'JuviAccount', entityId: String(s.account._id), 'changes.field': 'temporaryCredential' })).toBe(1);

    await JuviProvisionedCredential.deleteMany({ accountId: s.account._id });
    await api.as(fx.admin.token).post(`${A}/accounts/${s.account._id}/reveal-credential`).expect(410);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-accounts.e2e.test.ts`
Expected: FAIL: 404 on `GET /accounts`.

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/admin/accounts-service.ts
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { JuviAccount, AccountKind, AccountStatus } from '../../../models/juvi/JuviAccount';
import { JuviProvisionedCredential } from '../../../models/juvi/JuviProvisionedCredential';
import { User } from '../../../models/User';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { AppError } from '../../../middleware/errorHandler';
import { createAuditLog } from '../../../shared/audit';
import { PaginatedResult } from '../../../shared/types';
import { generateTemporaryPassword } from '../accounts/temp-password';
import { storeCredential, revealLatestForAccount } from '../accounts/credential-store';
import { revokeOtherSessions } from '../accounts/session-service';

export interface AccountRow {
  id: string; kind: AccountKind; status: AccountStatus; name: string; identifier: string; email: string;
  onboardingComplete: boolean; lastSeenAt: string | null; provisionedAt: string;
  hasLiveCredential: boolean; credentialExpiresAt: string | null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listAccounts(
  collegeId: string, q: { kind?: AccountKind; status?: AccountStatus; q?: string; page: number; limit: number },
): Promise<PaginatedResult<AccountRow>> {
  const filter: Record<string, unknown> = { collegeId };
  if (q.kind) filter.kind = q.kind;
  if (q.status) filter.status = q.status;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const [persons, students, faculty, staff] = await Promise.all([
      Person.find({ collegeId, name: rx }).select('_id').lean(),
      Student.find({ collegeId, rollNumber: rx }).select('_id').lean(),
      Faculty.find({ collegeId, employeeCode: rx }).select('_id').lean(),
      Staff.find({ collegeId, employeeCode: rx }).select('_id').lean(),
    ]);
    filter.$or = [
      { personId: { $in: persons.map((p) => p._id) } }, { studentId: { $in: students.map((s) => s._id) } },
      { facultyId: { $in: faculty.map((f) => f._id) } }, { staffId: { $in: staff.map((s) => s._id) } },
    ];
  }

  const total = await JuviAccount.countDocuments(filter);
  const accounts = await JuviAccount.find(filter).sort({ provisionedAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean();
  const ids = accounts.map((a) => a._id);
  const [persons, users, students, faculty, staff, creds] = await Promise.all([
    Person.find({ _id: { $in: accounts.map((a) => a.personId) } }).select('name').lean(),
    User.find({ _id: { $in: accounts.map((a) => a.userId) } }).select('email').lean(),
    Student.find({ _id: { $in: accounts.map((a) => a.studentId).filter(Boolean) } }).select('rollNumber').lean(),
    Faculty.find({ _id: { $in: accounts.map((a) => a.facultyId).filter(Boolean) } }).select('employeeCode').lean(),
    Staff.find({ _id: { $in: accounts.map((a) => a.staffId).filter(Boolean) } }).select('employeeCode').lean(),
    JuviProvisionedCredential.find({ collegeId, accountId: { $in: ids }, expiresAt: { $gt: new Date() } }).select('accountId expiresAt').lean(),
  ]);
  const by = <T extends { _id: Types.ObjectId }>(rows: T[]) => new Map(rows.map((r) => [String(r._id), r]));
  const P = by(persons); const U = by(users); const S = by(students); const F = by(faculty); const ST = by(staff);
  const credBy = new Map<string, Date>();
  for (const c of creds) { const k = String(c.accountId); if (!credBy.has(k) || credBy.get(k)! < c.expiresAt) credBy.set(k, c.expiresAt); }

  const items: AccountRow[] = accounts.map((a) => ({
    id: String(a._id), kind: a.kind, status: a.status,
    name: P.get(String(a.personId))?.name ?? '',
    identifier: a.studentId ? S.get(String(a.studentId))?.rollNumber ?? '' : a.facultyId ? F.get(String(a.facultyId))?.employeeCode ?? '' : a.staffId ? ST.get(String(a.staffId))?.employeeCode ?? '' : '',
    email: U.get(String(a.userId))?.email ?? '',
    onboardingComplete: Boolean(a.onboardingCompletedAt),
    lastSeenAt: a.lastSeenAt ? a.lastSeenAt.toISOString() : null,
    provisionedAt: a.provisionedAt.toISOString(),
    hasLiveCredential: credBy.has(String(a._id)),
    credentialExpiresAt: credBy.get(String(a._id))?.toISOString() ?? null,
  }));
  return { items, total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)) };
}

async function identifierFor(account: { kind: AccountKind; studentId?: Types.ObjectId; facultyId?: Types.ObjectId; staffId?: Types.ObjectId; userId: Types.ObjectId }): Promise<string> {
  if (account.studentId) return (await Student.findById(account.studentId).select('rollNumber').lean())?.rollNumber ?? '';
  if (account.facultyId) return (await Faculty.findById(account.facultyId).select('employeeCode').lean())?.employeeCode ?? '';
  if (account.staffId) return (await Staff.findById(account.staffId).select('employeeCode').lean())?.employeeCode ?? '';
  return (await User.findById(account.userId).select('email').lean())?.email ?? '';
}

export async function resetPassword(collegeId: string, accountId: string, performedBy: string): Promise<{ credentialId: string; expiresAt: Date }> {
  const account = await JuviAccount.findOne({ _id: accountId, collegeId }).lean();
  if (!account) throw new AppError(404, 'Account not found');
  if (account.status === 'deactivated') throw new AppError(409, 'Account is deactivated');
  const person = await Person.findById(account.personId).select('name').lean();
  const temporaryPassword = generateTemporaryPassword();
  await User.updateOne({ _id: account.userId, collegeId }, { $set: { password: await bcrypt.hash(temporaryPassword, 10), mustChangePassword: true, passwordChangedAt: new Date() } });
  await revokeOtherSessions(String(account._id), null, 'admin');
  const credentialId = await storeCredential({
    collegeId, accountId: String(account._id), runId: null, source: 'admin',
    identifier: await identifierFor(account), displayName: person?.name ?? '', plaintext: temporaryPassword,
  });
  await createAuditLog({
    collegeId, entityType: 'JuviAccount', entityId: String(account._id), entityName: person?.name ?? 'account', action: 'update',
    changes: [{ field: 'password', displayName: 'Password reset', oldValue: null, newValue: 'temporary' }], performedBy,
    studentId: account.studentId ? String(account.studentId) : undefined,
  });
  const cred = await JuviProvisionedCredential.findById(credentialId).select('expiresAt').lean();
  return { credentialId, expiresAt: cred!.expiresAt };
}

export async function revealCredential(collegeId: string, accountId: string, performedBy: string): Promise<{ identifier: string; password: string; expiresAt: Date }> {
  const account = await JuviAccount.findOne({ _id: accountId, collegeId }).lean();
  if (!account) throw new AppError(404, 'Account not found');
  const latest = await revealLatestForAccount(collegeId, String(account._id));
  if (!latest) throw new AppError(410, 'No live temporary credential. Reset the password to issue a new one.');
  const person = await Person.findById(account.personId).select('name').lean();
  await createAuditLog({
    collegeId, entityType: 'JuviAccount', entityId: String(account._id), entityName: person?.name ?? 'account', action: 'update',
    changes: [{ field: 'temporaryCredential', displayName: 'Temporary credential revealed', oldValue: null, newValue: 'revealed' }], performedBy,
    studentId: account.studentId ? String(account.studentId) : undefined,
  });
  return { identifier: await identifierFor(account), password: latest.password, expiresAt: latest.expiresAt };
}
```

```ts
// backend/src/modules/juvi-app/admin/accounts-controller.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/authenticate';
import { deactivateAccount } from '../accounts/provisioning-service';
import { accountsQuerySchema, objectId } from './schemas';
import * as svc from './accounts-service';

const who = (req: AuthRequest) => req.user?.name || 'System';

export async function listAccounts(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.listAccounts(req.collegeId!, accountsQuerySchema.parse(req.query))); } catch (e) { next(e); }
}
export async function deactivate(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await deactivateAccount(req.collegeId!, objectId.parse(req.params.id), 'admin', who(req))); } catch (e) { next(e); }
}
export async function resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.resetPassword(req.collegeId!, objectId.parse(req.params.id), who(req))); } catch (e) { next(e); }
}
export async function revealCredential(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.revealCredential(req.collegeId!, objectId.parse(req.params.id), who(req))); } catch (e) { next(e); }
}
```

Add to `admin/routes.ts` above `errorHandler`:

```ts
import * as accountsCtrl from './accounts-controller';

adminRouter.get('/accounts', authorize('platform', 'read'), accountsCtrl.listAccounts);
adminRouter.post('/accounts/:id/deactivate', authorize('platform', 'update'), accountsCtrl.deactivate);
adminRouter.post('/accounts/:id/reset-password', authorize('platform', 'update'), accountsCtrl.resetPassword);
adminRouter.post('/accounts/:id/reveal-credential', authorize('platform', 'create'), accountsCtrl.revealCredential);
```

Note: `deactivateAccount` throws `MobileApiError` (a subclass of `AppError`) on 404; the ERP `errorHandler` renders it as `{ error: 'Account not found' }`, which is what the portal expects.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-accounts.e2e.test.ts && npx vitest run src/modules/juvi-app/admin && npm run typecheck`
Expected: PASS (3 e2e tests, permissions unit test), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/admin backend/src/__e2e__/modules/juvi-app-admin-accounts.e2e.test.ts
git commit -m "feat(juvi-app): admin account list with search, deactivate, reset-password and audited reveal

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Channels, templates and manual reconcile

**Files:**
- Create: `backend/src/modules/juvi-app/admin/channels-controller.ts`
- Modify: `backend/src/modules/juvi-app/admin/routes.ts`
- Test: `backend/src/__e2e__/modules/juvi-app-admin-channels.e2e.test.ts`

**Interfaces:**
- Routes: `GET /channels?status&page&limit` → `paginate(Channel, …)` sorted by `templateCode, name`; `GET /templates` → `{ items }`; `POST /reconcile` → 202 `{ queued: true }` via `enqueueReconcile`.

- [ ] **Step 1: Write the failing integration test**

```ts
// backend/src/__e2e__/modules/juvi-app-admin-channels.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { enableJuvi, provisionTestStudent } from '../factories/juvi.factory';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';
import { Channel } from '../../models/juvi/Channel';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

describe('admin channels', () => {
  it('lists channels and templates after a reconcile; filters by status', async () => {
    await provisionTestStudent(fx);
    await reconcileCollege(fx.collegeId);
    const ch = await api.as(fx.admin.token).get(`${A}/channels`).expect(200);
    expect(ch.body.total).toBe(4);   // college + 2 departments + 1 batch
    expect(ch.body.items[0]).toMatchObject({ templateCode: expect.any(String), name: expect.any(String), memberCount: expect.any(Number), status: 'active' });
    const archived = await api.as(fx.admin.token).get(`${A}/channels?status=archived`).expect(200);
    expect(archived.body.total).toBe(0);
    const t = await api.as(fx.admin.token).get(`${A}/templates`).expect(200);
    expect(t.body.items.map((x: any) => x.code)).toEqual(['college', 'department', 'batch', 'course', 'hostel']);
  });

  it('POST /reconcile is accepted and creates channels (inline fallback without Redis)', async () => {
    await provisionTestStudent(fx);
    const res = await api.as(fx.admin.token).post(`${A}/reconcile`).expect(202);
    expect(res.body).toEqual({ queued: true });
    for (let i = 0; i < 50 && (await Channel.countDocuments({ collegeId: fx.collegeId })) < 4; i++) await new Promise((r) => setTimeout(r, 100));
    expect(await Channel.countDocuments({ collegeId: fx.collegeId })).toBe(4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-channels.e2e.test.ts`
Expected: FAIL: 404 on `GET /channels`.

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/juvi-app/admin/channels-controller.ts
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../middleware/authenticate';
import { Channel } from '../../../models/juvi/Channel';
import { ChannelTemplate } from '../../../models/juvi/ChannelTemplate';
import { paginate } from '../../../shared/pagination';
import { enqueueReconcile } from '../spaces/reconcile-worker';
import { pageQuerySchema } from './schemas';

const channelsQuery = pageQuerySchema.extend({ status: z.enum(['active', 'archived']).optional() });
const TEMPLATE_ORDER = ['college', 'department', 'batch', 'course', 'hostel'];

export async function listChannels(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { page, limit, status } = channelsQuery.parse(req.query);
    const filter: Record<string, unknown> = { collegeId: req.collegeId! };
    if (status) filter.status = status;
    res.json(await paginate(Channel, filter, page, limit, { templateCode: 1, name: 1 }));
  } catch (e) { next(e); }
}

export async function listTemplates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const items = await ChannelTemplate.find({ collegeId: req.collegeId! }).lean();
    items.sort((a, b) => TEMPLATE_ORDER.indexOf(a.code) - TEMPLATE_ORDER.indexOf(b.code));
    res.json({ items });
  } catch (e) { next(e); }
}

export async function reconcileNow(req: AuthRequest, res: Response, next: NextFunction) {
  try { await enqueueReconcile(req.collegeId!); res.status(202).json({ queued: true }); } catch (e) { next(e); }
}
```

Add to `admin/routes.ts` above `errorHandler`:

```ts
import * as channelsCtrl from './channels-controller';

adminRouter.get('/channels', authorize('platform', 'read'), channelsCtrl.listChannels);
adminRouter.get('/templates', authorize('platform', 'read'), channelsCtrl.listTemplates);
adminRouter.post('/reconcile', authorize('platform', 'update'), channelsCtrl.reconcileNow);
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-channels.e2e.test.ts && npm run typecheck`
Expected: PASS (2 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/admin backend/src/__e2e__/modules/juvi-app-admin-channels.e2e.test.ts
git commit -m "feat(juvi-app): admin channel and template listing with a manual reconcile trigger

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Portal service module

**Files:**
- Create: `admin-portal/src/services/juvi-app.ts`
- Test: `admin-portal/src/services/__tests__/juvi-app.test.ts`

**Interfaces:**
- Produces the typed client every component in Tasks 6–8 imports:
  ```ts
  export type AccountKind = 'student' | 'faculty' | 'staff';
  export interface JuviSettings { enabled; paused; pausedMessage?; accentColor?; supportContact?; quietHoursDefault; minAppVersion?; timezone; featureFlags }
  export interface AdminSettingsView { juvi: JuviSettings; college: { name; code }; lastReconcile: { at; durationMs; channels: { total; created; archived }; memberships: { added; removed; roleChanged }; errors } | null }
  export interface ProvisioningRun { _id; status; filter: { kinds: AccountKind[]; programmeIds?; batchIds?; departmentIds? }; options: { resetExistingPasswords }; counts: { scanned; created; existingLinked; skipped; failed }; errors: { personId; reason }[]; performedBy; startedAt?; finishedAt?; credentialsExpireAt?; createdAt }
  export interface CredentialGroup { key; id; label; count }
  export interface AccountRow { id; kind; status; name; identifier; email; onboardingComplete; lastSeenAt; provisionedAt; hasLiveCredential; credentialExpiresAt }
  export interface ChannelRow { _id; name; templateCode; scopeType; status; memberCount; replyRule; defaultPriority }
  export interface TemplateRow { code; name; namePattern; scopeType; replyRule; defaultPriority; archiveRule; isEnabled }
  export const getJuviSettings, updateJuviSettings, listRuns, createRun, getCredentialGroups, downloadCredentialsCsv, listAccounts, deactivateAccount, resetAccountPassword, revealAccountCredential, listChannels, listTemplates, reconcileNow;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// admin-portal/src/services/__tests__/juvi-app.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
import api from '../api';
import { listAccounts, downloadCredentialsCsv, createRun } from '../juvi-app';

beforeEach(() => vi.clearAllMocks());

describe('juvi-app service', () => {
  it('listAccounts passes filters as query params and drops empties', async () => {
    (api.get as any).mockResolvedValue({ data: { items: [], total: 0, page: 1, pages: 1 } });
    await listAccounts({ kind: 'student', q: '', page: 2, limit: 20 });
    expect(api.get).toHaveBeenCalledWith('/juvi-app/admin/accounts', { params: { kind: 'student', page: 2, limit: 20 } });
  });

  it('createRun posts the body and returns the run', async () => {
    (api.post as any).mockResolvedValue({ data: { _id: 'r1', status: 'queued' } });
    const run = await createRun({ kinds: ['student'], batchIds: ['b1'], resetExistingPasswords: true });
    expect(api.post).toHaveBeenCalledWith('/juvi-app/admin/provisioning/runs', { kinds: ['student'], batchIds: ['b1'], resetExistingPasswords: true });
    expect(run._id).toBe('r1');
  });

  it('downloadCredentialsCsv requests a blob for the group', async () => {
    (api.get as any).mockResolvedValue({ data: new Blob(['x']), headers: { 'content-disposition': 'attachment; filename="juvi-credentials-2026-09-23.csv"' } });
    const out = await downloadCredentialsCsv('r1', { key: 'section', id: 's1' });
    expect(api.get).toHaveBeenCalledWith('/juvi-app/admin/provisioning/runs/r1/credentials.csv', { params: { sectionId: 's1' }, responseType: 'blob' });
    expect(out.filename).toBe('juvi-credentials-2026-09-23.csv');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd admin-portal && npx vitest run src/services/__tests__/juvi-app.test.ts`
Expected: FAIL with "Cannot find module '../juvi-app'".

- [ ] **Step 3: Implement**

```ts
// admin-portal/src/services/juvi-app.ts
/**
 * juvi-app — admin-portal client for the Juvi mobile-app administration API
 * (/api/juvi-app/admin). Spec: docs/superpowers/specs/2026-09-23-juvi-foundation-design.md §12.
 */
import api from './api';

const BASE = '/juvi-app/admin';

export type AccountKind = 'student' | 'faculty' | 'staff';
export type AccountStatus = 'onboarding' | 'active' | 'exiting' | 'deactivated';
export type RunStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed';

export interface JuviSettings {
  enabled: boolean; paused: boolean; pausedMessage?: string; accentColor?: string;
  supportContact?: { name: string; phone?: string; email?: string };
  quietHoursDefault: { start: string; end: string };
  minAppVersion?: { android?: string; ios?: string };
  timezone: string; featureFlags: { languageRoadmap: boolean };
}
export interface ReconcileSummary {
  at: string; durationMs: number; skipped: boolean;
  channels: { created: number; archived: number; unarchived: number; total: number };
  memberships: { added: number; removed: number; roleChanged: number }; errors: number;
}
export interface AdminSettingsView { juvi: JuviSettings; college: { name: string; code: string }; lastReconcile: ReconcileSummary | null }
export type JuviSettingsPatch = Partial<JuviSettings>;

export interface ProvisioningRun {
  _id: string; status: RunStatus;
  filter: { kinds: AccountKind[]; programmeIds?: string[]; batchIds?: string[]; departmentIds?: string[] };
  options: { resetExistingPasswords: boolean };
  counts: { scanned: number; created: number; existingLinked: number; skipped: number; failed: number };
  errors: { personId: string; reason: string }[];
  performedBy: string; startedAt?: string; finishedAt?: string; credentialsExpireAt?: string; createdAt: string;
}
export interface CreateRunInput { kinds: AccountKind[]; programmeIds?: string[]; batchIds?: string[]; departmentIds?: string[]; resetExistingPasswords?: boolean }
export interface CredentialGroup { key: 'section' | 'batch' | 'department' | 'none'; id: string | null; label: string; count: number }
export interface CredentialGroupsView { expiresAt: string | null; live: boolean; groups: CredentialGroup[] }

export interface AccountRow {
  id: string; kind: AccountKind; status: AccountStatus; name: string; identifier: string; email: string;
  onboardingComplete: boolean; lastSeenAt: string | null; provisionedAt: string;
  hasLiveCredential: boolean; credentialExpiresAt: string | null;
}
export interface AccountsQuery { kind?: AccountKind; status?: AccountStatus; q?: string; page: number; limit: number }
export interface Paginated<T> { items: T[]; total: number; page: number; pages: number }

export interface ChannelRow {
  _id: string; name: string; templateCode: string; scopeType: string; status: 'active' | 'archived';
  memberCount: number; replyRule: string; defaultPriority: string;
}
export interface TemplateRow {
  code: string; name: string; namePattern: string; scopeType: string; replyRule: string; defaultPriority: string; archiveRule: string; isEnabled: boolean;
}

const clean = <T extends Record<string, unknown>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;

export const getJuviSettings = (): Promise<AdminSettingsView> => api.get(`${BASE}/settings`).then((r) => r.data);
export const updateJuviSettings = (patch: JuviSettingsPatch): Promise<AdminSettingsView> => api.put(`${BASE}/settings`, patch).then((r) => r.data);

export const listRuns = (page = 1, limit = 20): Promise<Paginated<ProvisioningRun>> =>
  api.get(`${BASE}/provisioning/runs`, { params: { page, limit } }).then((r) => r.data);
export const getRun = (runId: string): Promise<ProvisioningRun> => api.get(`${BASE}/provisioning/runs/${runId}`).then((r) => r.data);
export const createRun = (input: CreateRunInput): Promise<ProvisioningRun> => api.post(`${BASE}/provisioning/runs`, input).then((r) => r.data);
export const getCredentialGroups = (runId: string): Promise<CredentialGroupsView> =>
  api.get(`${BASE}/provisioning/runs/${runId}/credential-groups`).then((r) => r.data);

export async function downloadCredentialsCsv(runId: string, group: { key: CredentialGroup['key']; id: string | null }): Promise<{ blob: Blob; filename: string }> {
  const params: Record<string, string> = {};
  if (group.key === 'section' && group.id) params.sectionId = group.id;
  if (group.key === 'batch' && group.id) params.batchId = group.id;
  if (group.key === 'department' && group.id) params.departmentId = group.id;
  const res = await api.get(`${BASE}/provisioning/runs/${runId}/credentials.csv`, { params, responseType: 'blob' });
  const match = /filename="([^"]+)"/.exec(String(res.headers['content-disposition'] ?? ''));
  return { blob: res.data as Blob, filename: match?.[1] ?? 'juvi-credentials.csv' };
}

export const listAccounts = (q: AccountsQuery): Promise<Paginated<AccountRow>> =>
  api.get(`${BASE}/accounts`, { params: clean(q as Record<string, unknown>) }).then((r) => r.data);
export const deactivateAccount = (id: string): Promise<{ status: AccountStatus }> => api.post(`${BASE}/accounts/${id}/deactivate`).then((r) => r.data);
export const resetAccountPassword = (id: string): Promise<{ credentialId: string; expiresAt: string }> => api.post(`${BASE}/accounts/${id}/reset-password`).then((r) => r.data);
export const revealAccountCredential = (id: string): Promise<{ identifier: string; password: string; expiresAt: string }> =>
  api.post(`${BASE}/accounts/${id}/reveal-credential`).then((r) => r.data);

export const listChannels = (status?: 'active' | 'archived', page = 1, limit = 50): Promise<Paginated<ChannelRow>> =>
  api.get(`${BASE}/channels`, { params: clean({ status, page, limit }) }).then((r) => r.data);
export const listTemplates = (): Promise<{ items: TemplateRow[] }> => api.get(`${BASE}/templates`).then((r) => r.data);
export const reconcileNow = (): Promise<{ queued: true }> => api.post(`${BASE}/reconcile`).then((r) => r.data);

/** Browser download helper shared by the credentials UI. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run the test and typecheck**

Run: `cd admin-portal && npx vitest run src/services/__tests__/juvi-app.test.ts && npm run typecheck`
Expected: PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/services/juvi-app.ts admin-portal/src/services/__tests__/juvi-app.test.ts
git commit -m "feat(portal): typed client for the Juvi admin API

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Page shell, route, hub card and Settings tab

**Files:**
- Create: `admin-portal/src/pages/platform/JuviAdminPage.tsx`, `admin-portal/src/components/platform/juvi/SettingsTab.tsx`
- Modify: `admin-portal/src/pages/Platform.tsx` (import, hub card, route)
- Test: `admin-portal/src/components/platform/juvi/__tests__/SettingsTab.test.tsx`

**Interfaces:**
- `JuviAdminPage` renders tabs `Provisioning | Settings | Channels` driven by the URL (`/platform/juvi`, `/platform/juvi/settings`, `/platform/juvi/channels`) and imports `ProvisioningTab` and `ChannelsTab` from Tasks 7 and 8. Until those tasks land, the page shell renders a placeholder `<div>` for them; Tasks 7 and 8 replace the placeholder imports.
- `SettingsTab` has no props.

- [ ] **Step 1: Write the failing component test**

```tsx
// admin-portal/src/components/platform/juvi/__tests__/SettingsTab.test.tsx
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsTab from '../SettingsTab';
import { renderWithProviders } from '../../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ can: true }));
vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { hasPermission: () => boolean }) => unknown) => selector({ hasPermission: () => perm.can }),
}));
vi.mock('../../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../../services/juvi-app', () => ({ getJuviSettings: vi.fn(), updateJuviSettings: vi.fn(), reconcileNow: vi.fn() }));
import { getJuviSettings, updateJuviSettings, reconcileNow } from '../../../../services/juvi-app';
import { toast } from '../../../../stores/toastStore';

const VIEW = {
  juvi: { enabled: false, paused: false, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false } },
  college: { name: 'JIT', code: 'JIT' },
  lastReconcile: null,
};

beforeEach(() => {
  vi.clearAllMocks(); perm.can = true;
  (getJuviSettings as Mock).mockResolvedValue(VIEW);
  (updateJuviSettings as Mock).mockImplementation(async (patch: any) => ({ ...VIEW, juvi: { ...VIEW.juvi, ...patch } }));
  (reconcileNow as Mock).mockResolvedValue({ queued: true });
});

describe('SettingsTab', () => {
  it('loads settings into the form and saves only changed fields', async () => {
    renderWithProviders(<SettingsTab />);
    const enable = await screen.findByLabelText(/enable juvi for this college/i);
    expect(enable).not.toBeChecked();
    fireEvent.click(enable);
    fireEvent.change(screen.getByLabelText(/accent colour/i), { target: { value: '#0B5FA5' } });
    fireEvent.change(screen.getByLabelText(/support contact name/i), { target: { value: 'Student Office' } });
    fireEvent.click(screen.getByRole('button', { name: /^save settings$/i }));
    await waitFor(() => expect(updateJuviSettings).toHaveBeenCalledWith({ enabled: true, accentColor: '#0B5FA5', supportContact: { name: 'Student Office' } }));
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the pause message field only when paused, and validates the colour', async () => {
    renderWithProviders(<SettingsTab />);
    await screen.findByLabelText(/enable juvi for this college/i);
    expect(screen.queryByLabelText(/message shown to users/i)).toBeNull();
    fireEvent.click(screen.getByLabelText(/pause juvi/i));
    expect(screen.getByLabelText(/message shown to users/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/accent colour/i), { target: { value: 'blue' } });
    fireEvent.click(screen.getByRole('button', { name: /^save settings$/i }));
    expect(await screen.findByText(/hex colour like #0B5FA5/i)).toBeInTheDocument();
    expect(updateJuviSettings).not.toHaveBeenCalled();
  });

  it('shows the last reconcile summary and triggers a manual run', async () => {
    (getJuviSettings as Mock).mockResolvedValue({ ...VIEW, juvi: { ...VIEW.juvi, enabled: true }, lastReconcile: { at: '2026-09-23T03:00:00Z', durationMs: 1234, skipped: false, channels: { total: 42, created: 1, archived: 0, unarchived: 0 }, memberships: { added: 10, removed: 2, roleChanged: 0 }, errors: 0 } });
    renderWithProviders(<SettingsTab />);
    expect(await screen.findByText(/42 channels/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reconcile now/i }));
    await waitFor(() => expect(reconcileNow).toHaveBeenCalled());
  });

  it('disables saving without platform:update', async () => {
    perm.can = false;
    renderWithProviders(<SettingsTab />);
    await screen.findByLabelText(/enable juvi for this college/i);
    expect(screen.getByRole('button', { name: /^save settings$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd admin-portal && npx vitest run src/components/platform/juvi/__tests__/SettingsTab.test.tsx`
Expected: FAIL with "Cannot find module '../SettingsTab'".

- [ ] **Step 3: Implement the tab, the page shell, the route and the hub card**

```tsx
// admin-portal/src/components/platform/juvi/SettingsTab.tsx
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save } from 'lucide-react';
import { getJuviSettings, updateJuviSettings, reconcileNow, type JuviSettings, type JuviSettingsPatch } from '../../../services/juvi-app';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';
const HEX = /^#[0-9a-fA-F]{6}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

interface Form {
  enabled: boolean; paused: boolean; pausedMessage: string; accentColor: string;
  contactName: string; contactPhone: string; contactEmail: string;
  quietStart: string; quietEnd: string; minAndroid: string; minIos: string; timezone: string;
}

const toForm = (j: JuviSettings): Form => ({
  enabled: j.enabled, paused: j.paused, pausedMessage: j.pausedMessage ?? '', accentColor: j.accentColor ?? '',
  contactName: j.supportContact?.name ?? '', contactPhone: j.supportContact?.phone ?? '', contactEmail: j.supportContact?.email ?? '',
  quietStart: j.quietHoursDefault.start, quietEnd: j.quietHoursDefault.end,
  minAndroid: j.minAppVersion?.android ?? '', minIos: j.minAppVersion?.ios ?? '', timezone: j.timezone,
});

/** Only fields that differ from the loaded settings go on the wire. */
function diff(form: Form, base: Form): JuviSettingsPatch {
  const p: JuviSettingsPatch = {};
  if (form.enabled !== base.enabled) p.enabled = form.enabled;
  if (form.paused !== base.paused) p.paused = form.paused;
  if (form.pausedMessage !== base.pausedMessage) p.pausedMessage = form.pausedMessage;
  if (form.accentColor !== base.accentColor && form.accentColor) p.accentColor = form.accentColor;
  if (form.contactName !== base.contactName || form.contactPhone !== base.contactPhone || form.contactEmail !== base.contactEmail) {
    p.supportContact = { name: form.contactName, ...(form.contactPhone ? { phone: form.contactPhone } : {}), ...(form.contactEmail ? { email: form.contactEmail } : {}) };
  }
  if (form.quietStart !== base.quietStart || form.quietEnd !== base.quietEnd) p.quietHoursDefault = { start: form.quietStart, end: form.quietEnd };
  if (form.minAndroid !== base.minAndroid || form.minIos !== base.minIos) {
    p.minAppVersion = { ...(form.minAndroid ? { android: form.minAndroid } : {}), ...(form.minIos ? { ios: form.minIos } : {}) };
  }
  if (form.timezone !== base.timezone) p.timezone = form.timezone;
  return p;
}

function validate(form: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (form.accentColor && !HEX.test(form.accentColor)) e.accentColor = 'Use a hex colour like #0B5FA5';
  if (!HHMM.test(form.quietStart) || !HHMM.test(form.quietEnd)) e.quiet = 'Use 24-hour times like 22:00';
  if (form.paused && !form.pausedMessage.trim()) e.pausedMessage = 'Tell users why Juvi is paused';
  if (form.contactEmail && !/^\S+@\S+\.\S+$/.test(form.contactEmail)) e.contactEmail = 'Enter a valid email';
  return e;
}

export default function SettingsTab() {
  const qc = useQueryClient();
  const canUpdate = useAuthStore((s) => s.hasPermission('platform', 'update'));
  const { data, isLoading } = useQuery({ queryKey: ['juvi-admin-settings'], queryFn: getJuviSettings });
  const [form, setForm] = useState<Form | null>(null);
  const [base, setBase] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (data) { const f = toForm(data.juvi); setForm(f); setBase(f); } }, [data]);

  const save = useMutation({
    mutationFn: updateJuviSettings,
    onSuccess: (view) => { qc.setQueryData(['juvi-admin-settings'], view); toast.success('Juvi settings saved'); },
    onError: () => toast.error('Could not save settings'),
  });
  const reconcile = useMutation({
    mutationFn: reconcileNow,
    onSuccess: () => { toast.success('Reconcile queued'); setTimeout(() => qc.invalidateQueries({ queryKey: ['juvi-admin-settings'] }), 3000); },
    onError: () => toast.error('Could not queue a reconcile'),
  });

  if (isLoading || !form || !base) return <div className="text-sm text-gray-500">Loading settings…</div>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  const onSave = () => {
    const e = validate(form); setErrors(e);
    if (Object.keys(e).length) return;
    const patch = diff(form, base);
    if (Object.keys(patch).length === 0) { toast.success('Nothing to save'); return; }
    save.mutate(patch);
  };

  const lr = data?.lastReconcile;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5 bg-white border rounded-xl p-5">
        <fieldset className="space-y-3">
          <legend className="font-semibold text-navy text-sm mb-2">Availability</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} disabled={!canUpdate} />
            Enable Juvi for this college
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.paused} onChange={(e) => set('paused', e.target.checked)} disabled={!canUpdate} />
            Pause Juvi (every app user sees a full-screen notice)
          </label>
          {form.paused && (
            <div>
              <label htmlFor="pausedMessage" className={lbl}>Message shown to users</label>
              <textarea id="pausedMessage" className={inp} rows={2} value={form.pausedMessage} onChange={(e) => set('pausedMessage', e.target.value)} disabled={!canUpdate} />
              {errors.pausedMessage && <p className="text-xs text-red-600 mt-1">{errors.pausedMessage}</p>}
            </div>
          )}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-semibold text-navy text-sm mb-2">Branding and contact</legend>
          <div>
            <label htmlFor="accentColor" className={lbl}>Accent colour</label>
            <input id="accentColor" className={inp} placeholder="#0B5FA5" value={form.accentColor} onChange={(e) => set('accentColor', e.target.value)} disabled={!canUpdate} />
            {errors.accentColor && <p className="text-xs text-red-600 mt-1">{errors.accentColor}</p>}
          </div>
          <div>
            <label htmlFor="timezone" className={lbl}>Timezone</label>
            <input id="timezone" className={inp} value={form.timezone} onChange={(e) => set('timezone', e.target.value)} disabled={!canUpdate} />
          </div>
          <div>
            <label htmlFor="contactName" className={lbl}>Support contact name</label>
            <input id="contactName" className={inp} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} disabled={!canUpdate} />
          </div>
          <div>
            <label htmlFor="contactPhone" className={lbl}>Support phone</label>
            <input id="contactPhone" className={inp} value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} disabled={!canUpdate} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="contactEmail" className={lbl}>Support email</label>
            <input id="contactEmail" className={inp} value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} disabled={!canUpdate} />
            {errors.contactEmail && <p className="text-xs text-red-600 mt-1">{errors.contactEmail}</p>}
          </div>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-semibold text-navy text-sm mb-2">Defaults and versions</legend>
          <div>
            <label htmlFor="quietStart" className={lbl}>Quiet hours start</label>
            <input id="quietStart" className={inp} value={form.quietStart} onChange={(e) => set('quietStart', e.target.value)} disabled={!canUpdate} />
          </div>
          <div>
            <label htmlFor="quietEnd" className={lbl}>Quiet hours end</label>
            <input id="quietEnd" className={inp} value={form.quietEnd} onChange={(e) => set('quietEnd', e.target.value)} disabled={!canUpdate} />
            {errors.quiet && <p className="text-xs text-red-600 mt-1">{errors.quiet}</p>}
          </div>
          <div>
            <label htmlFor="minAndroid" className={lbl}>Minimum app version (Android)</label>
            <input id="minAndroid" className={inp} placeholder="1.0.0" value={form.minAndroid} onChange={(e) => set('minAndroid', e.target.value)} disabled={!canUpdate} />
          </div>
          <div>
            <label htmlFor="minIos" className={lbl}>Minimum app version (iOS)</label>
            <input id="minIos" className={inp} placeholder="1.0.0" value={form.minIos} onChange={(e) => set('minIos', e.target.value)} disabled={!canUpdate} />
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button type="button" onClick={onSave} disabled={!canUpdate || save.isPending}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
            <Save size={16} /> Save settings
          </button>
        </div>
      </div>

      <aside className="bg-white border rounded-xl p-5 space-y-3 text-sm">
        <h3 className="font-semibold text-navy">Last reconcile</h3>
        {lr ? (
          <>
            <p className="text-gray-700">{lr.channels.total} channels · +{lr.memberships.added} / −{lr.memberships.removed} memberships · {lr.errors} errors</p>
            <p className="text-xs text-gray-500">{new Date(lr.at).toLocaleString('en-IN')} · {Math.round(lr.durationMs / 1000)}s</p>
          </>
        ) : (
          <p className="text-gray-500">No reconcile has run yet. It runs every 5 minutes once Juvi is enabled.</p>
        )}
        <button type="button" onClick={() => reconcile.mutate()} disabled={!canUpdate || reconcile.isPending || !data?.juvi.enabled}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded border disabled:opacity-50">
          <RefreshCw size={14} /> Reconcile now
        </button>
      </aside>
    </div>
  );
}
```

```tsx
// admin-portal/src/pages/platform/JuviAdminPage.tsx
import { NavLink, Route, Routes } from 'react-router-dom';
import SettingsTab from '../../components/platform/juvi/SettingsTab';
import ProvisioningTab from '../../components/platform/juvi/ProvisioningTab';   // Task 7
import ChannelsTab from '../../components/platform/juvi/ChannelsTab';           // Task 8

const TABS = [
  { to: '', label: 'Provisioning', end: true },
  { to: 'settings', label: 'Settings', end: false },
  { to: 'channels', label: 'Channels', end: false },
];

export default function JuviAdminPage() {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-navy">Juvi mobile app</h2>
        <p className="text-sm text-gray-500 mt-1">
          Provision students and faculty into the app, export their first-sign-in credentials, and control branding, quiet hours and availability.
        </p>
      </div>
      <nav className="flex gap-1 border-b mb-5" aria-label="Juvi sections">
        {TABS.map((t) => (
          <NavLink key={t.label} to={t.to} end={t.end}
            className={({ isActive }) => `px-4 py-2 text-sm border-b-2 -mb-px ${isActive ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<ProvisioningTab />} />
        <Route path="settings" element={<SettingsTab />} />
        <Route path="channels" element={<ChannelsTab />} />
      </Routes>
    </div>
  );
}
```

Until Tasks 7 and 8 exist, create both files as two-line placeholders so the page compiles:

```tsx
// admin-portal/src/components/platform/juvi/ProvisioningTab.tsx   (replaced in Task 7)
export default function ProvisioningTab() { return <div className="text-sm text-gray-500">Provisioning arrives in the next task.</div>; }
```
```tsx
// admin-portal/src/components/platform/juvi/ChannelsTab.tsx        (replaced in Task 8)
export default function ChannelsTab() { return <div className="text-sm text-gray-500">Channels arrive in a later task.</div>; }
```

Modify `admin-portal/src/pages/Platform.tsx`:

1. Import: `import JuviAdminPage from './platform/JuviAdminPage';` and add `Smartphone` is already imported from lucide; reuse it.
2. Hub card, inside the grid after the Integrations card, same markup as the Integrations card:

```tsx
      <button onClick={() => navigate('/platform/juvi')} className="bg-white rounded-xl border p-5 text-left hover:shadow-lg transition-all border-sky-200 hover:border-sky-400">
        <div className="inline-flex p-2.5 rounded-lg mb-3 bg-sky-50 text-sky-600"><Smartphone size={22} /></div>
        <div className="font-semibold text-navy-dark text-sm">Juvi mobile app</div>
        <p className="text-xs text-gray-500 mt-1">Provisioning, credentials, branding, pause switch</p>
      </button>
```

3. Route, inside `<Routes>`: `<Route path="juvi/*" element={<JuviAdminPage />} />`.

- [ ] **Step 4: Run the test and typecheck**

Run: `cd admin-portal && npx vitest run src/components/platform/juvi && npm run typecheck`
Expected: PASS (4 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/pages/platform/JuviAdminPage.tsx admin-portal/src/components/platform/juvi admin-portal/src/pages/Platform.tsx
git commit -m "feat(portal): Juvi admin area with Settings tab, pause switch and reconcile summary

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Provisioning tab — runs, new run, credential downloads, accounts

**Files:**
- Create: `admin-portal/src/components/platform/juvi/NewRunForm.tsx`, `RunsTable.tsx`, `CredentialsDownload.tsx`, `AccountsTable.tsx`
- Replace: `admin-portal/src/components/platform/juvi/ProvisioningTab.tsx`
- Test: `admin-portal/src/components/platform/juvi/__tests__/ProvisioningTab.test.tsx`, `__tests__/AccountsTable.test.tsx`

**Interfaces:**
- Consumes: `listRuns`, `createRun`, `getCredentialGroups`, `downloadCredentialsCsv`, `saveBlob`, `listAccounts`, `deactivateAccount`, `resetAccountPassword`, `revealAccountCredential` (Task 5); `listProgrammes(page, limit, search?)`, `listBatches(page, limit, search?)`, `listDepartments(page, limit, search?)` from `services/academics` (existing, lines 21, 57, 33; each resolves `{ items, total, page, pages }`); `confirmAction` from `stores/confirmStore` and `toast` from `stores/toastStore`.
- Produces: `ProvisioningTab` (no props), `NewRunForm({ onCreated })`, `RunsTable({ runs, onSelect })`, `CredentialsDownload({ run })`, `AccountsTable()`.

- [ ] **Step 1: Write the failing tests**

```tsx
// admin-portal/src/components/platform/juvi/__tests__/ProvisioningTab.test.tsx
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ProvisioningTab from '../ProvisioningTab';
import { renderWithProviders } from '../../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ can: true }));
vi.mock('../../../../stores/authStore', () => ({ useAuthStore: (sel: any) => sel({ hasPermission: () => perm.can }) }));
vi.mock('../../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('../../../../stores/confirmStore', () => ({ confirmAction: vi.fn(() => Promise.resolve({ confirmed: true })) }));
vi.mock('../../../../services/academics', () => ({ listProgrammes: vi.fn(), listBatches: vi.fn(), listDepartments: vi.fn() }));
vi.mock('../../../../services/juvi-app', () => ({
  listRuns: vi.fn(), createRun: vi.fn(), getCredentialGroups: vi.fn(), downloadCredentialsCsv: vi.fn(), saveBlob: vi.fn(),
  listAccounts: vi.fn(), deactivateAccount: vi.fn(), resetAccountPassword: vi.fn(), revealAccountCredential: vi.fn(),
}));
import { listProgrammes, listBatches, listDepartments } from '../../../../services/academics';
import { listRuns, createRun, getCredentialGroups, downloadCredentialsCsv, saveBlob, listAccounts } from '../../../../services/juvi-app';

const RUN = { _id: 'r1', status: 'completed', filter: { kinds: ['student'] }, options: { resetExistingPasswords: true }, counts: { scanned: 40, created: 38, existingLinked: 2, skipped: 0, failed: 0 }, errors: [], performedBy: 'Admin', startedAt: '2026-09-23T03:00:00Z', finishedAt: '2026-09-23T03:02:00Z', credentialsExpireAt: '2026-09-30T03:00:00Z', createdAt: '2026-09-23T03:00:00Z' };

beforeEach(() => {
  vi.clearAllMocks(); perm.can = true;
  (listProgrammes as Mock).mockResolvedValue({ items: [{ _id: 'p1', code: 'BTECH', name: 'B.Tech' }] });
  (listBatches as Mock).mockResolvedValue({ items: [{ _id: 'b1', code: '2024', name: '2024 Batch' }] });
  (listDepartments as Mock).mockResolvedValue({ items: [{ _id: 'd1', code: 'CSE', name: 'Computer Science' }] });
  (listRuns as Mock).mockResolvedValue({ items: [RUN], total: 1, page: 1, pages: 1 });
  (listAccounts as Mock).mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
  (createRun as Mock).mockResolvedValue({ ...RUN, _id: 'r2', status: 'queued' });
  (getCredentialGroups as Mock).mockResolvedValue({ expiresAt: RUN.credentialsExpireAt, live: true, groups: [{ key: 'section', id: 's1', label: 'Section A', count: 20 }, { key: 'none', id: null, label: 'No section', count: 18 }] });
  (downloadCredentialsCsv as Mock).mockResolvedValue({ blob: new Blob(['x']), filename: 'juvi-credentials.csv' });
});

describe('ProvisioningTab', () => {
  it('lists runs with counts and lets the admin start a filtered run', async () => {
    renderWithProviders(<ProvisioningTab />);
    expect(await screen.findByText(/38 created/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^new run$/i }));
    await screen.findByRole('option', { name: /2024 Batch/ });
    fireEvent.click(screen.getByLabelText(/^faculty$/i));
    fireEvent.change(screen.getByLabelText(/^batch$/i), { target: { value: 'b1' } });
    fireEvent.click(screen.getByLabelText(/reset passwords of people who already have a login/i));
    fireEvent.click(screen.getByRole('button', { name: /^start run$/i }));
    await waitFor(() => expect(createRun).toHaveBeenCalledWith({ kinds: ['student', 'faculty'], batchIds: ['b1'], resetExistingPasswords: false }));
  });

  it('opens a run and downloads a section CSV', async () => {
    renderWithProviders(<ProvisioningTab />);
    fireEvent.click(await screen.findByRole('button', { name: /open run/i }));
    expect(await screen.findByText(/Section A/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /download section a/i }));
    await waitFor(() => expect(downloadCredentialsCsv).toHaveBeenCalledWith('r1', { key: 'section', id: 's1' }));
    expect(saveBlob).toHaveBeenCalled();
  });

  it('hides New run without platform:create', async () => {
    perm.can = false;
    renderWithProviders(<ProvisioningTab />);
    await screen.findByText(/38 created/i);
    expect(screen.queryByRole('button', { name: /^new run$/i })).toBeNull();
  });
});
```

```tsx
// admin-portal/src/components/platform/juvi/__tests__/AccountsTable.test.tsx
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AccountsTable from '../AccountsTable';
import { renderWithProviders } from '../../../../__tests__/test-utils';

const perm = vi.hoisted(() => ({ can: true }));
vi.mock('../../../../stores/authStore', () => ({ useAuthStore: (sel: any) => sel({ hasPermission: () => perm.can }) }));
vi.mock('../../../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const confirmMock = vi.hoisted(() => ({ confirmed: true }));
vi.mock('../../../../stores/confirmStore', () => ({ confirmAction: vi.fn(() => Promise.resolve(confirmMock)) }));
vi.mock('../../../../services/juvi-app', () => ({ listAccounts: vi.fn(), deactivateAccount: vi.fn(), resetAccountPassword: vi.fn(), revealAccountCredential: vi.fn() }));
import { listAccounts, deactivateAccount, resetAccountPassword, revealAccountCredential } from '../../../../services/juvi-app';

const ROW = { id: 'a1', kind: 'student', status: 'onboarding', name: 'Aditya Nair', identifier: '24JIT0001', email: 'a@x.in', onboardingComplete: false, lastSeenAt: null, provisionedAt: '2026-09-23T03:00:00Z', hasLiveCredential: true, credentialExpiresAt: '2026-09-30T03:00:00Z' };

beforeEach(() => {
  vi.clearAllMocks(); perm.can = true; confirmMock.confirmed = true;
  (listAccounts as Mock).mockResolvedValue({ items: [ROW], total: 1, page: 1, pages: 1 });
  (deactivateAccount as Mock).mockResolvedValue({ status: 'deactivated' });
  (resetAccountPassword as Mock).mockResolvedValue({ credentialId: 'c1', expiresAt: '2026-09-30T03:00:00Z' });
  (revealAccountCredential as Mock).mockResolvedValue({ identifier: '24JIT0001', password: 'river-lamp-482', expiresAt: '2026-09-30T03:00:00Z' });
});

describe('AccountsTable', () => {
  it('searches with a debounce-free submit and shows rows', async () => {
    renderWithProviders(<AccountsTable />);
    expect(await screen.findByText('Aditya Nair')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/search accounts/i), { target: { value: '24JIT' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(listAccounts).toHaveBeenLastCalledWith(expect.objectContaining({ q: '24JIT', page: 1 })));
  });

  it('reveals a credential on demand and never renders it before the click', async () => {
    renderWithProviders(<AccountsTable />);
    await screen.findByText('Aditya Nair');
    expect(screen.queryByText('river-lamp-482')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /reveal credential for aditya nair/i }));
    expect(await screen.findByText('river-lamp-482')).toBeInTheDocument();
    expect(revealAccountCredential).toHaveBeenCalledWith('a1');
  });

  it('confirms before deactivate and before reset', async () => {
    renderWithProviders(<AccountsTable />);
    await screen.findByText('Aditya Nair');
    fireEvent.click(screen.getByRole('button', { name: /reset password for aditya nair/i }));
    await waitFor(() => expect(resetAccountPassword).toHaveBeenCalledWith('a1'));
    confirmMock.confirmed = false;
    fireEvent.click(screen.getByRole('button', { name: /deactivate aditya nair/i }));
    await waitFor(() => expect(deactivateAccount).not.toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-portal && npx vitest run src/components/platform/juvi/__tests__/ProvisioningTab.test.tsx src/components/platform/juvi/__tests__/AccountsTable.test.tsx`
Expected: FAIL: the placeholder tab renders no runs; `AccountsTable` module missing.

- [ ] **Step 3: Implement**

```tsx
// admin-portal/src/components/platform/juvi/RunsTable.tsx
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Clock } from 'lucide-react';
import type { ProvisioningRun, RunStatus } from '../../../services/juvi-app';

const META: Record<RunStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  queued:    { label: 'Queued',    cls: 'bg-slate-50 text-slate-700 border-slate-200',        Icon: Clock },
  running:   { label: 'Running',   cls: 'bg-blue-50 text-blue-700 border-blue-200',          Icon: Loader2 },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  partial:   { label: 'Partial',   cls: 'bg-amber-50 text-amber-800 border-amber-200',       Icon: AlertTriangle },
  failed:    { label: 'Failed',    cls: 'bg-red-50 text-red-800 border-red-200',             Icon: XCircle },
};

export function RunStatusPill({ status }: { status: RunStatus }) {
  const m = META[status]; const Icon = m.Icon;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${m.cls}`}><Icon size={11} /> {m.label}</span>;
}

export default function RunsTable({ runs, onSelect }: { runs: ProvisioningRun[]; onSelect: (run: ProvisioningRun) => void }) {
  if (runs.length === 0) {
    return <div className="border rounded-xl p-8 text-center text-sm text-gray-500 bg-white">No provisioning runs yet. Start one to create app accounts for your students and faculty.</div>;
  }
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
          <tr><th className="px-4 py-2">Started</th><th className="px-4 py-2">Kinds</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Results</th><th className="px-4 py-2">By</th><th className="px-4 py-2" /></tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r._id} className="border-t">
              <td className="px-4 py-2 whitespace-nowrap">{new Date(r.startedAt ?? r.createdAt).toLocaleString('en-IN')}</td>
              <td className="px-4 py-2">{r.filter.kinds.join(', ')}</td>
              <td className="px-4 py-2"><RunStatusPill status={r.status} /></td>
              <td className="px-4 py-2 text-gray-700">{r.counts.created} created · {r.counts.existingLinked} linked · {r.counts.skipped} skipped · {r.counts.failed} failed</td>
              <td className="px-4 py-2">{r.performedBy}</td>
              <td className="px-4 py-2 text-right">
                <button type="button" onClick={() => onSelect(r)} className="text-primary-700 hover:underline text-sm">Open run</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// admin-portal/src/components/platform/juvi/NewRunForm.tsx
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { listProgrammes, listBatches, listDepartments } from '../../../services/academics';
import { createRun, type AccountKind, type ProvisioningRun } from '../../../services/juvi-app';
import { toast } from '../../../stores/toastStore';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

export default function NewRunForm({ onCreated, onCancel }: { onCreated: (run: ProvisioningRun) => void; onCancel: () => void }) {
  const [kinds, setKinds] = useState<AccountKind[]>(['student']);
  const [programmeId, setProgrammeId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [reset, setReset] = useState(true);

  // services/academics exports `list*(page = 1, limit = 20, search?)`; 200 covers any college's structure.
  const programmes = useQuery({ queryKey: ['programmes', 'all'], queryFn: () => listProgrammes(1, 200) });
  const batches = useQuery({ queryKey: ['batches', 'all'], queryFn: () => listBatches(1, 200) });
  const departments = useQuery({ queryKey: ['departments', 'all'], queryFn: () => listDepartments(1, 200) });

  const start = useMutation({
    mutationFn: createRun,
    onSuccess: (run) => { toast.success('Provisioning run started'); onCreated(run); },
    onError: () => toast.error('Could not start the run'),
  });

  const toggle = (k: AccountKind) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  const submit = () => {
    if (kinds.length === 0) { toast.warning('Pick at least one kind'); return; }
    start.mutate({
      kinds,
      ...(programmeId ? { programmeIds: [programmeId] } : {}),
      ...(batchId ? { batchIds: [batchId] } : {}),
      ...(departmentId ? { departmentIds: [departmentId] } : {}),
      resetExistingPasswords: reset,
    });
  };

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-navy">New provisioning run</h3>
      <fieldset className="flex gap-4 text-sm">
        <legend className={lbl}>Who</legend>
        {(['student', 'faculty', 'staff'] as AccountKind[]).map((k) => (
          <label key={k} className="flex items-center gap-2 capitalize">
            <input type="checkbox" checked={kinds.includes(k)} onChange={() => toggle(k)} aria-label={k} /> {k}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="run-programme" className={lbl}>Programme</label>
          <select id="run-programme" className={inp} value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
            <option value="">All programmes</option>
            {programmes.data?.items?.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="run-batch" className={lbl}>Batch</label>
          <select id="run-batch" className={inp} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">All batches</option>
            {batches.data?.items?.map((b: any) => <option key={b._id} value={b._id}>{b.name ?? b.code}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="run-department" className={lbl}>Department</label>
          <select id="run-department" className={inp} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.data?.items?.map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} />
        Reset passwords of people who already have a login (they have never used Juvi; recommended)
      </label>
      <p className="text-xs text-gray-500">Temporary passwords are stored encrypted for 7 days. Export them per section from the run once it completes.</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded border">Cancel</button>
        <button type="button" onClick={submit} disabled={start.isPending}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
          <Play size={16} /> Start run
        </button>
      </div>
    </div>
  );
}
```

```tsx
// admin-portal/src/components/platform/juvi/CredentialsDownload.tsx
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { getCredentialGroups, downloadCredentialsCsv, saveBlob, type CredentialGroup, type ProvisioningRun } from '../../../services/juvi-app';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { RunStatusPill } from './RunsTable';

export default function CredentialsDownload({ run }: { run: ProvisioningRun }) {
  const canExport = useAuthStore((s) => s.hasPermission('platform', 'create'));
  const groups = useQuery({ queryKey: ['juvi-credential-groups', run._id], queryFn: () => getCredentialGroups(run._id), refetchInterval: run.status === 'running' || run.status === 'queued' ? 3000 : false });
  const download = useMutation({
    mutationFn: (g: CredentialGroup) => downloadCredentialsCsv(run._id, { key: g.key, id: g.id }),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: () => toast.error('These credentials have expired. Reset passwords from the accounts table.'),
  });

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-navy">Run {run._id.slice(-6)}</h3>
        <RunStatusPill status={run.status} />
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
        {(['scanned', 'created', 'existingLinked', 'skipped', 'failed'] as const).map((k) => (
          <div key={k}><dt className="text-xs text-gray-500 capitalize">{k === 'existingLinked' ? 'Linked existing' : k}</dt><dd className="font-semibold">{run.counts[k]}</dd></div>
        ))}
      </dl>
      {run.errors.length > 0 && (
        <details className="text-sm"><summary className="cursor-pointer text-red-700">{run.errors.length} failures</summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-700">{run.errors.map((e, i) => <li key={i}>{e.personId}: {e.reason}</li>)}</ul>
        </details>
      )}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Credential exports</h4>
        {groups.data?.live === false ? (
          <p className="text-sm text-gray-500">The temporary passwords for this run have expired. Reset a password from the accounts table to issue a new one.</p>
        ) : (
          <ul className="space-y-2">
            {groups.data?.groups.map((g) => (
              <li key={`${g.key}:${g.id}`} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                <span>{g.label} <span className="text-gray-500">· {g.count}</span></span>
                <button type="button" disabled={!canExport || download.isPending} onClick={() => download.mutate(g)} aria-label={`Download ${g.label}`}
                  className="inline-flex items-center gap-1 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 rounded border disabled:opacity-50">
                  <Download size={14} /> CSV
                </button>
              </li>
            ))}
          </ul>
        )}
        {groups.data?.expiresAt && groups.data.live && <p className="text-xs text-gray-500 mt-2">Available until {new Date(groups.data.expiresAt).toLocaleString('en-IN')}.</p>}
      </div>
    </div>
  );
}
```

```tsx
// admin-portal/src/components/platform/juvi/AccountsTable.tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, KeyRound, UserX } from 'lucide-react';
import { listAccounts, deactivateAccount, resetAccountPassword, revealAccountCredential, type AccountKind, type AccountStatus } from '../../../services/juvi-app';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../../stores/toastStore';
import { confirmAction } from '../../../stores/confirmStore';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';

export default function AccountsTable() {
  const qc = useQueryClient();
  const canUpdate = useAuthStore((s) => s.hasPermission('platform', 'update'));
  const canReveal = useAuthStore((s) => s.hasPermission('platform', 'create'));
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<AccountKind | ''>('');
  const [status, setStatus] = useState<AccountStatus | ''>('');
  const [page, setPage] = useState(1);
  const [revealed, setRevealed] = useState<Record<string, { password: string; expiresAt: string }>>({});

  const query = { q, kind: kind || undefined, status: status || undefined, page, limit: 20 };
  const accounts = useQuery({ queryKey: ['juvi-accounts', query], queryFn: () => listAccounts(query) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['juvi-accounts'] });

  const deactivate = useMutation({ mutationFn: deactivateAccount, onSuccess: () => { toast.success('Account deactivated'); refresh(); }, onError: () => toast.error('Could not deactivate') });
  const reset = useMutation({ mutationFn: resetAccountPassword, onSuccess: () => { toast.success('Temporary password issued. Reveal it to share.'); refresh(); }, onError: () => toast.error('Could not reset the password') });
  const reveal = useMutation({
    mutationFn: revealAccountCredential,
    onSuccess: (c, id) => setRevealed((r) => ({ ...r, [id]: { password: c.password, expiresAt: c.expiresAt } })),
    onError: () => toast.error('No live credential. Reset the password first.'),
  });

  const onDeactivate = async (id: string, name: string) => {
    const { confirmed } = await confirmAction({ title: `Deactivate ${name}?`, message: 'They are signed out everywhere and can no longer open Juvi. Their posts stay attributed to them.', confirmLabel: 'Deactivate', tone: 'danger' });
    if (confirmed) deactivate.mutate(id);
  };
  const onReset = async (id: string, name: string) => {
    const { confirmed } = await confirmAction({ title: `Reset password for ${name}?`, message: 'A new temporary password is issued, they must change it at next sign-in, and every device is signed out.', confirmLabel: 'Reset', tone: 'primary' });
    if (confirmed) reset.mutate(id);
  };

  return (
    <div className="space-y-3">
      <form role="search" className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(draft.trim()); }}>
        <input aria-label="Search accounts" className={`${inp} sm:col-span-2`} placeholder="Name, roll number or employee code" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <select aria-label="Kind" className={inp} value={kind} onChange={(e) => { setKind(e.target.value as AccountKind | ''); setPage(1); }}>
          <option value="">All kinds</option><option value="student">Students</option><option value="faculty">Faculty</option><option value="staff">Staff</option>
        </select>
        <select aria-label="Status" className={inp} value={status} onChange={(e) => { setStatus(e.target.value as AccountStatus | ''); setPage(1); }}>
          <option value="">All statuses</option><option value="onboarding">Onboarding</option><option value="active">Active</option><option value="deactivated">Deactivated</option>
        </select>
      </form>

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Identifier</th><th className="px-4 py-2">Kind</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Last seen</th><th className="px-4 py-2">Credential</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {accounts.data?.items.map((a) => (
              <tr key={a.id} className="border-t align-top">
                <td className="px-4 py-2">{a.name}<div className="text-xs text-gray-500">{a.email}</div></td>
                <td className="px-4 py-2 font-mono text-xs">{a.identifier}</td>
                <td className="px-4 py-2 capitalize">{a.kind}</td>
                <td className="px-4 py-2 capitalize">{a.status}{a.onboardingComplete ? '' : <span className="text-xs text-gray-500"> · not onboarded</span>}</td>
                <td className="px-4 py-2 whitespace-nowrap">{a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString('en-IN') : 'Never opened'}</td>
                <td className="px-4 py-2">
                  {revealed[a.id] ? (
                    <div><code className="text-sm">{revealed[a.id]!.password}</code><div className="text-xs text-gray-500">until {new Date(revealed[a.id]!.expiresAt).toLocaleDateString('en-IN')}</div></div>
                  ) : a.hasLiveCredential ? (
                    <button type="button" disabled={!canReveal} onClick={() => reveal.mutate(a.id)} aria-label={`Reveal credential for ${a.name}`}
                      className="inline-flex items-center gap-1 text-primary-700 hover:underline disabled:opacity-50"><Eye size={14} /> Reveal</button>
                  ) : <span className="text-xs text-gray-500">None live</span>}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {a.status !== 'deactivated' && (
                    <>
                      <button type="button" disabled={!canUpdate} onClick={() => onReset(a.id, a.name)} aria-label={`Reset password for ${a.name}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 rounded border mr-1 disabled:opacity-50"><KeyRound size={12} /> Reset</button>
                      <button type="button" disabled={!canUpdate} onClick={() => onDeactivate(a.id, a.name)} aria-label={`Deactivate ${a.name}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded border border-red-200 disabled:opacity-50"><UserX size={12} /> Deactivate</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {accounts.data && accounts.data.items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No accounts match. Run provisioning to create some.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {accounts.data && accounts.data.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 py-1 border rounded disabled:opacity-50">Previous</button>
          <span>Page {accounts.data.page} of {accounts.data.pages}</span>
          <button type="button" disabled={page >= accounts.data.pages} onClick={() => setPage(page + 1)} className="px-2 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
```

`confirmAction(options: ConfirmOptions)` from `stores/confirmStore.ts` takes `{ title, message?, confirmLabel?, cancelLabel?, tone?: 'danger' | 'primary' }` and resolves `{ confirmed, reason? }`, which is what the calls above use.

```tsx
// admin-portal/src/components/platform/juvi/ProvisioningTab.tsx   (replaces the Task 6 placeholder)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { listRuns, type ProvisioningRun } from '../../../services/juvi-app';
import { useAuthStore } from '../../../stores/authStore';
import NewRunForm from './NewRunForm';
import RunsTable from './RunsTable';
import CredentialsDownload from './CredentialsDownload';
import AccountsTable from './AccountsTable';

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'run'; run: ProvisioningRun };

export default function ProvisioningTab() {
  const canCreate = useAuthStore((s) => s.hasPermission('platform', 'create'));
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const runs = useQuery({
    queryKey: ['juvi-runs'], queryFn: () => listRuns(1, 20),
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.status === 'queued' || r.status === 'running') ? 3000 : false),
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy">Provisioning runs</h3>
          {mode.kind === 'list' && canCreate && (
            <button type="button" onClick={() => setMode({ kind: 'new' })} className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} /> New run</button>
          )}
          {mode.kind !== 'list' && (
            <button type="button" onClick={() => setMode({ kind: 'list' })} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded border"><ArrowLeft size={14} /> Back to runs</button>
          )}
        </div>
        {mode.kind === 'list' && <RunsTable runs={runs.data?.items ?? []} onSelect={(run) => setMode({ kind: 'run', run })} />}
        {mode.kind === 'new' && <NewRunForm onCreated={(run) => { runs.refetch(); setMode({ kind: 'run', run }); }} onCancel={() => setMode({ kind: 'list' })} />}
        {mode.kind === 'run' && <CredentialsDownload run={runs.data?.items.find((r) => r._id === mode.run._id) ?? mode.run} />}
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold text-navy">Accounts</h3>
        <AccountsTable />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `cd admin-portal && npx vitest run src/components/platform/juvi && npm run typecheck`
Expected: PASS (all juvi component tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/components/platform/juvi
git commit -m "feat(portal): Juvi provisioning runs, credential downloads and account management

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Channels tab

**Files:**
- Replace: `admin-portal/src/components/platform/juvi/ChannelsTab.tsx`
- Test: `admin-portal/src/components/platform/juvi/__tests__/ChannelsTab.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// admin-portal/src/components/platform/juvi/__tests__/ChannelsTab.test.tsx
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import ChannelsTab from '../ChannelsTab';
import { renderWithProviders } from '../../../../__tests__/test-utils';

vi.mock('../../../../services/juvi-app', () => ({ listChannels: vi.fn(), listTemplates: vi.fn() }));
import { listChannels, listTemplates } from '../../../../services/juvi-app';

beforeEach(() => {
  vi.clearAllMocks();
  (listChannels as Mock).mockImplementation(async (status?: string) => ({
    items: status === 'archived'
      ? [{ _id: 'c9', name: 'CS101 Old · A', templateCode: 'course', scopeType: 'course_offering', status: 'archived', memberCount: 60, replyRule: 'allowed', defaultPriority: 'routine' }]
      : [{ _id: 'c1', name: 'JIT', templateCode: 'college', scopeType: 'college', status: 'active', memberCount: 1500, replyRule: 'announcement_only', defaultPriority: 'important' }],
    total: 1, page: 1, pages: 1,
  }));
  (listTemplates as Mock).mockResolvedValue({ items: [{ code: 'college', name: 'College', namePattern: '{{college.name}}', scopeType: 'college', replyRule: 'announcement_only', defaultPriority: 'important', archiveRule: 'never', isEnabled: true }] });
});

describe('ChannelsTab', () => {
  it('lists active channels by default and switches to archived', async () => {
    renderWithProviders(<ChannelsTab />);
    expect(await screen.findByText('JIT')).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^archived$/i }));
    expect(await screen.findByText('CS101 Old · A')).toBeInTheDocument();
  });

  it('shows the templates read-only with a note about editing', async () => {
    renderWithProviders(<ChannelsTab />);
    expect(await screen.findByText('{{college.name}}')).toBeInTheDocument();
    expect(screen.getByText(/templates are read-only in this release/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd admin-portal && npx vitest run src/components/platform/juvi/__tests__/ChannelsTab.test.tsx`
Expected: FAIL: the placeholder renders no table.

- [ ] **Step 3: Implement**

```tsx
// admin-portal/src/components/platform/juvi/ChannelsTab.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listChannels, listTemplates } from '../../../services/juvi-app';

export default function ChannelsTab() {
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const channels = useQuery({ queryKey: ['juvi-channels', status], queryFn: () => listChannels(status, 1, 100) });
  const templates = useQuery({ queryKey: ['juvi-templates'], queryFn: listTemplates });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy">Channels <span className="text-gray-500 font-normal text-sm">· {channels.data?.total ?? 0}</span></h3>
          <div className="inline-flex rounded-lg border overflow-hidden text-sm">
            {(['active', 'archived'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={`px-3 py-1.5 capitalize ${status === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Template</th><th className="px-4 py-2">Replies</th><th className="px-4 py-2">Priority</th><th className="px-4 py-2 text-right">Members</th></tr>
            </thead>
            <tbody>
              {channels.data?.items.map((c) => (
                <tr key={c._id} className="border-t">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 capitalize">{c.templateCode}</td>
                  <td className="px-4 py-2">{c.replyRule === 'allowed' ? 'Allowed' : 'Announcement only'}</td>
                  <td className="px-4 py-2 capitalize">{c.defaultPriority}</td>
                  <td className="px-4 py-2 text-right">{c.memberCount}</td>
                </tr>
              ))}
              {channels.data && channels.data.items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No {status} channels. Channels are created by the reconcile job from your ERP structure.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-navy">Templates</h3>
        <p className="text-sm text-gray-500">Templates are read-only in this release; editing with a channel preview arrives with the admin configuration sub-project.</p>
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr><th className="px-4 py-2">Code</th><th className="px-4 py-2">Name pattern</th><th className="px-4 py-2">Scope</th><th className="px-4 py-2">Replies</th><th className="px-4 py-2">Priority</th><th className="px-4 py-2">Archive</th></tr>
            </thead>
            <tbody>
              {templates.data?.items.map((t) => (
                <tr key={t.code} className="border-t">
                  <td className="px-4 py-2 capitalize">{t.code}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.namePattern}</td>
                  <td className="px-4 py-2">{t.scopeType.replace('_', ' ')}</td>
                  <td className="px-4 py-2">{t.replyRule === 'allowed' ? 'Allowed' : 'Announcement only'}</td>
                  <td className="px-4 py-2 capitalize">{t.defaultPriority}</td>
                  <td className="px-4 py-2">{t.archiveRule === 'never' ? 'Never' : 'On semester end'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `cd admin-portal && npx vitest run src/components/platform/juvi && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add admin-portal/src/components/platform/juvi/ChannelsTab.tsx admin-portal/src/components/platform/juvi/__tests__/ChannelsTab.test.tsx
git commit -m "feat(portal): read-only Juvi channels and templates tab

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Playwright happy path

**Files:**
- Create: `e2e/tests/juvi-admin.spec.ts`

**Interfaces:**
- Consumes: `loginAs('principal')` from `e2e/tests/fixtures/auth-fixture.ts`; the E2E College seeded in Task 1; the running backend has Redis in CI, so `createRun` is queued and processed by the worker (locally without Redis the inline fallback runs).

- [ ] **Step 1: Write the spec**

```ts
// e2e/tests/juvi-admin.spec.ts
/**
 * Juvi admin console — Foundation happy path (spec §16 Playwright).
 *
 *   1. Settings tab: enable Juvi, set accent colour and support contact, save.
 *   2. Provisioning tab: start a run for students; a run row appears and settles.
 *   3. Channels tab renders (empty is fine: the e2e seed has no structure).
 *
 * Render + interaction only; the e2e seed has no students, so the run
 * completes with zero scanned — what matters is that the flow works
 * end to end through the live API. Zero retries, no fixed waits.
 */
import { test, expect } from './fixtures/auth-fixture';

test.describe('Platform — Juvi mobile app', () => {
  test('enable Juvi, save settings, start a provisioning run, browse channels', async ({ page, loginAs }) => {
    await loginAs('principal');
    await page.goto('/platform/juvi/settings');
    await expect(page.getByRole('heading', { name: /^juvi mobile app$/i })).toBeVisible({ timeout: 10_000 });

    const enable = page.getByLabel(/enable juvi for this college/i);
    await expect(enable).toBeVisible();
    if (!(await enable.isChecked())) await enable.check();
    await page.getByLabel(/accent colour/i).fill('#0B5FA5');
    await page.getByLabel(/support contact name/i).fill('E2E Student Office');
    await page.getByRole('button', { name: /^save settings$/i }).click();
    await expect(page.getByText(/juvi settings saved|nothing to save/i)).toBeVisible();

    await page.getByRole('link', { name: /^provisioning$/i }).click();
    await expect(page).toHaveURL(/\/platform\/juvi$/);
    await page.getByRole('button', { name: /^new run$/i }).click();
    await page.getByRole('button', { name: /^start run$/i }).click();
    await expect(page.getByText(/^run [0-9a-f]{6}$/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/completed|partial|queued|running/i).first()).toBeVisible();

    await page.getByRole('link', { name: /^channels$/i }).click();
    await expect(page).toHaveURL(/\/platform\/juvi\/channels$/);
    await expect(page.getByRole('heading', { name: /^templates$/i })).toBeVisible();
    await expect(page.getByText('{{college.name}}')).toBeVisible({ timeout: 10_000 });
  });

  test('registrar (no platform access) does not see the Juvi card', async ({ page, loginAs }) => {
    await loginAs('registrar');
    await page.goto('/platform');
    await expect(page.getByRole('heading', { name: /platform/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /juvi mobile app/i })).toHaveCount(0);
  });
});
```

The second test relies on the Platform hub being reachable by a registrar; if the sidebar hides `/platform` for users without `platform:read` but the URL still renders the hub, the card assertion is what matters. If the hub itself redirects for the registrar, replace the second test's body with an assertion that `/platform/juvi` shows no "Save settings" button.

- [ ] **Step 2: Run the suite locally against the live stack**

Run (three terminals or background processes): `npm run dev:backend`, `npm run dev:portal`, then `npm run test -w e2e -- juvi-admin`.
Expected: both tests PASS. The backend log shows either a queued job (Redis up) or `provisioning queue unavailable, running inline`.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/juvi-admin.spec.ts
git commit -m "test(e2e): Juvi admin console happy path

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec section | Tasks |
|---|---|
| §9 Credential export (CSV per section, 410 after expiry, reveal of single credentials) | 2, 3, 7 |
| §12 Provisioning tab | 2, 3, 5, 7 |
| §12 Settings tab (enable, accent, contact, quiet hours, min version, pause, last reconcile, reconcile now) | 1, 4, 6 |
| §12 Channels tab (read-only channels and templates) | 4, 8 |
| §12 Admin routes and permissions | 1–4 (permissions unit test in 2) |
| §16 Playwright provisioning happy path and settings save | 9 |
| §17 Rollout: inert until enabled; first enable seeds templates and reconciles | 1 |
| US-6 AC 3 (CSV for seven days, then reset), US-7 AC 1–2 | 2, 3, 6 |

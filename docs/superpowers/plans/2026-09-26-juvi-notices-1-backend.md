# Juvi Notices & Acknowledgement — Plan 1 of 3: Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the server side of Juvi notices: a durable outbox under `shared/outbox/`, the `Notice` and `NoticeRecipient` models, audience resolution and publisher scope, publish → fan-out → acknowledge → reach, the mobile and admin APIs, the `notices` policy, onboarding step 4 (`first_notice`) with a real welcome notice, added-later and activation back-fill, and the regenerated OpenAPI contract, so the ERP portal (Plan 2) and the Flutter app (Plan 3) build on a tested server.

**Architecture:** A new `backend/src/modules/juvi-app/notices/` folder with pure functions (`audience.ts`, `scope.ts`) over an `AudienceGraph` that `audience-graph.ts` loads from ERP people (not only Juvi accounts — members without an account are snapshotted as "Not on Juvi"). Publishing writes a `Notice` in `publishing` and records a `notice.published` outbox event; the outbox dispatcher (BullMQ tick every 5 s, immediate tick on `kick()`, inline fallback without Redis) runs the fan-out consumer, which upserts one `NoticeRecipient` row per member in batches of 1,000. Mobile routes join `v1Router` with the mobile envelope; admin routes mount inside `adminRouter` with the ERP `{ error }` shape and `authorize('notices', …)`. Nothing under `modules/juvi` (the AI module) changes.

**Tech Stack:** Express 4, Mongoose 8, Zod 3, BullMQ 5, multer 2, `@aws-sdk/client-s3` (existing `shared/s3/s3-client.ts`), `@asteasolutions/zod-to-openapi` 7, vitest 4, supertest, mongodb-memory-server.

**Spec:** `docs/superpowers/specs/2026-09-26-juvi-notices-design.md` (§4 stories, §5 data model, §6 publish and dispatch, §7 APIs, §10 security, §11 failure handling, §12 testing). Foundation spec `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md` still governs the mobile envelope, `authenticateMobile` and reconcile.

## Global Constraints

- Every new model has `collegeId: { type: Schema.Types.ObjectId, required: true, index: true }` and every query filters by `collegeId` (CLAUDE.md multi-tenancy rule). `OutboxEvent` carries `collegeId` too (copied from `payload.collegeId`), so dead events can be listed per college.
- `AppError` takes `(statusCode, message, detail?)` — status code first. `MobileApiError` takes `(statusCode, code, message, detail?)`.
- Mobile routes use the mobile envelope `{ error: { code, message, ...detail } }` and never `authorize()`. Admin routes use `authenticate` → `authorize('notices', read | create | update)` and the ERP shape `{ error: string }`; they are mounted inside `adminRouter` ahead of its 404 catch-all and `errorHandler`.
- New mobile error codes (added to `MobileErrorCode` and the contract): `NOTICE_NOT_FOUND` 404, `ALREADY_ACKNOWLEDGED` 409, `NOTICE_ARCHIVED` 409, `NOT_PUBLISHER` 403, `REMINDER_LIMIT` 409, `ACK_REQUIRED` 409 (dismiss on an acknowledgement notice), `ACK_NOT_REQUIRED` 409 (acknowledge a notice that does not require it).
- Limits (spec §5, §6.1, §10): title ≤ 120, body ≤ 5000, comment ≤ 500, ≤ 5 attachments of ≤ 10 MB each (PDF, PNG, JPEG, WEBP, DOCX, XLSX, PPTX), ≤ 2 reminders, attachment presigned URL 5 minutes, attachment key `colleges/<cid>/notices/<uuid>`.
- Outbox (spec §6.2): claim lock 2 minutes; failure back-off `5 s × 2^attempts` capped at 10 minutes; dead after 8 attempts; `done` events expire after 30 days; dispatcher tick every 5 s; sweeper re-emits for notices in `publishing` older than 2 minutes; `kick()` processes inline when no queue is registered.
- Fan-out (spec §6.3): batches of 1,000, `ordered: false`, upsert on the unique `(noticeId, personId)`; only `JuviAccount.status === 'active'` accounts get `accountId` and `receivedAt` at fan-out ("on Juvi"); a 5,000-member audience must fan out in under 60 s.
- Reconciliation arithmetic (spec §6.5): reach counts run over `addedLater: false` rows only; added-later rows are reported in their own group and never as pending; welcome-notice rows created on demand are snapshot rows and increment `counts.audience`.
- Acknowledgement is a conditional update on `ack: null` (spec §10); `late` is computed from the server's receipt time against `deadline`.
- Onboarding steps become `['identity', 'spaces', 'notifications', 'first_notice']`; the existing `me` and `config` e2e assertions on the step list are updated in Task 9.
- Contract: `npm run openapi:mobile -w backend` regenerates `mobile/api/openapi.json`; `node mobile/tool/check_nullable_objects.js mobile/api/openapi.json` must pass. No new response field is object-or-null: every nested object is non-null and nullable values are scalars (`deadline: string | null`, `ackAt: string | null`, `nextCursor: string | null`). The `ack` record returned inside the `ALREADY_ACKNOWLEDGED` error is under the passthrough `ErrorEnvelope`, which the guard does not type; Plan 3 reads it from the raw envelope.
- TypeScript strict: `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`. Prefix unused params with `_`. Use `String(doc._id)`.
- Unit tests live in `__tests__/` beside the code and run with `npm run test -w backend` (vitest; DB-backed unit tests use `src/__tests__/helpers/mongoMemory`). Integration tests live in `backend/src/__e2e__/modules/` and run with `npm run test:e2e -w backend` (`RBAC_ENFORCE=false`, `JWT_SECRET=test-secret`, `NODE_ENV=test`, no Redis: `kick()` falls back to inline and tests call `drainOutbox()`).
- The route-walk snapshot (`src/__e2e__/modules/__snapshots__/rbac-route-walk.test.ts.snap`) lists every GET route per persona; Tasks 5, 8 and 9 add GET routes and update it with `-u`, checking the diff contains only the new rows.
- Commit after every task with a conventional-commit message ending in the attribution line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

---

## File structure

**Create**

```
backend/src/shared/outbox/OutboxEvent.ts                     model: type, payload, dedupeKey (unique), status, attempts, availableAt, lockedUntil, TTL on done
backend/src/shared/outbox/outbox.ts                          emit, registerConsumer, registerSweeper, claimNext, processEvent, processOnce, kick, drainOutbox, retryDead
backend/src/shared/outbox/dispatcher.ts                      registerOutboxQueue: BullMQ 5 s tick + immediate tick on kick
backend/src/shared/outbox/index.ts                           barrel
backend/src/shared/outbox/__tests__/outbox.test.ts           dedupe, claim, lock expiry, backoff, dead, inline kick, drain, retry
backend/src/shared/outbox/__tests__/dispatcher.test.ts       scheduler registration and tick enqueuer

backend/src/models/juvi/Notice.ts
backend/src/models/juvi/NoticeRecipient.ts
backend/src/models/juvi/__tests__/notice-models.schema.test.ts

backend/src/modules/juvi-app/notices/audience.ts             AudienceGraph, PersonNode, resolveAudience, ruleChannelRefs, audienceLine, groupLabel (pure)
backend/src/modules/juvi-app/notices/scope.ts                PublisherScope, assertAudienceInScope, narrowToScope (pure)
backend/src/modules/juvi-app/notices/offices.ts              persona → office words, office personas
backend/src/modules/juvi-app/notices/audience-graph.ts       loadAudienceGraph(collegeId, { personIds? })
backend/src/modules/juvi-app/notices/publisher-scope.ts      resolvePublisherScope(collegeId, erpUser, officeOverride?)
backend/src/modules/juvi-app/notices/publish-service.ts      uploadAttachment, previewAudience, publishNotice, archiveNotice, remindNotice, retryDelivery, channelIdsForRules
backend/src/modules/juvi-app/notices/consumers.ts            notice.published / reminder / acknowledged / archived consumers + sweeper
backend/src/modules/juvi-app/notices/schemas.ts              Zod: mobile cards, requests and responses
backend/src/modules/juvi-app/notices/cards.ts                toCard / toDetail from a Notice + NoticeRecipient
backend/src/modules/juvi-app/notices/mobile-service.ts       attention, list, detail, seen, attachment URL, channel notices
backend/src/modules/juvi-app/notices/ack-service.ts          acknowledge, dismiss
backend/src/modules/juvi-app/notices/reach-service.ts        buildReach, pendingPage, reachCsv, assertPublisher (mobile), audit refusal
backend/src/modules/juvi-app/notices/welcome-service.ts      getFirstNotice, ensureDefaultWelcomeNotice
backend/src/modules/juvi-app/notices/recipient-service.ts    onAccountActivated, backfillAddedLater
backend/src/modules/juvi-app/notices/mobile-controller.ts
backend/src/modules/juvi-app/notices/mobile-routes.ts        noticesRouter (v1, authenticateMobile)
backend/src/modules/juvi-app/notices/admin-schemas.ts
backend/src/modules/juvi-app/notices/admin-service.ts        listNotices, getNotice, auditTrail, delivery state
backend/src/modules/juvi-app/notices/admin-controller.ts
backend/src/modules/juvi-app/notices/admin-routes.ts         noticesAdminRouter (mounted under adminRouter at /notices)
backend/src/modules/juvi-app/notices/__tests__/audience.test.ts
backend/src/modules/juvi-app/notices/__tests__/scope.test.ts
backend/src/modules/juvi-app/notices/__tests__/offices.test.ts
backend/src/modules/juvi-app/notices/__tests__/cards.test.ts
backend/src/modules/juvi-app/notices/__tests__/ack-late.test.ts
backend/src/modules/juvi-app/notices/__tests__/admin-routes-permissions.test.ts
backend/src/modules/juvi-app/notices/__tests__/reach.test.ts
backend/src/modules/juvi-app/notices/__tests__/graph-fixture.ts     shared pure-test fixture (not a test file)
backend/src/shared/rbac/__tests__/defaults-notices.test.ts

backend/src/__e2e__/factories/notice.factory.ts              publishTestNotice, signInAs
backend/src/__e2e__/modules/juvi-notices-publish.e2e.test.ts
backend/src/__e2e__/modules/juvi-notices-fanout-5000.e2e.test.ts
backend/src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts
backend/src/__e2e__/modules/juvi-notices-ack.e2e.test.ts
backend/src/__e2e__/modules/juvi-notices-reach.e2e.test.ts
backend/src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts
backend/src/__e2e__/modules/juvi-notices-welcome.e2e.test.ts
backend/src/__e2e__/modules/juvi-notices-lifecycle.e2e.test.ts
```

**Modify**

```
backend/src/shared/queue/QueueManager.ts                     QUEUE_NAMES.OUTBOX
backend/src/server.ts                                        registerOutboxQueue next to the reconcile queue
backend/src/models/College.ts                                IJuviConfig.welcomeNotice
backend/src/models/index.ts                                  export Notice, NoticeRecipient
backend/src/seed.ts                                          deleteMany for the two models
backend/src/modules/juvi-app/config/institution-config.ts    normalizeJuviConfig passes welcomeNotice through
backend/src/modules/juvi-app/errors.ts                       new MobileErrorCode values
backend/src/modules/juvi-app/routes.ts                       registerNoticeConsumers(); v1Router.use(noticesRouter)
backend/src/modules/juvi-app/admin/routes.ts                 adminRouter.use('/notices', noticesAdminRouter) before the 404
backend/src/modules/juvi-app/admin/schemas.ts                settingsUpdateSchema.welcomeNotice
backend/src/modules/juvi-app/admin/settings-service.ts       validate welcomeNotice ids
backend/src/modules/juvi-app/admin/__tests__/routes-permissions.test.ts   allow notices:* alongside platform:*
backend/src/modules/juvi-app/accounts/onboarding.ts          first_notice step
backend/src/modules/juvi-app/accounts/provisioning-service.ts transitionAccount → onAccountActivated
backend/src/modules/juvi-app/spaces/reconcile-service.ts     reconcileAccount → backfillAddedLater
backend/src/modules/juvi-app/spaces/spaces-service.ts        getChannel gains notices[]
backend/src/modules/juvi-app/spaces/schemas.ts               channelDetailSchema.notices
backend/src/modules/juvi-app/openapi/document.ts             new components and paths
backend/src/modules/juvi-app/openapi/__tests__/document.test.ts
backend/src/shared/rbac/sub-domains.ts                       notices: []
backend/src/shared/rbac/defaults.ts                          notices policies
backend/src/shared/types.ts, backend/src/shared/audit.ts     AuditAction 'access_denied'
admin-portal/src/config/sub-domains.json                     notices: [] (mirrored byte-for-byte by a test)
backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts          four onboarding steps
backend/src/__e2e__/modules/juvi-app-config.e2e.test.ts      four onboarding steps
backend/src/__e2e__/modules/__snapshots__/rbac-route-walk.test.ts.snap
mobile/api/openapi.json                                      regenerated
CLAUDE.md                                                    Juvi section: outbox pointer, notices module, policy, first_notice
```

---

### Task 1: Outbox — model, core, dispatcher, server registration

**Files:**
- Create: `backend/src/shared/outbox/OutboxEvent.ts`, `backend/src/shared/outbox/outbox.ts`, `backend/src/shared/outbox/dispatcher.ts`, `backend/src/shared/outbox/index.ts`
- Modify: `backend/src/shared/queue/QueueManager.ts:140-143`, `backend/src/server.ts:9-40`
- Test: `backend/src/shared/outbox/__tests__/outbox.test.ts`, `backend/src/shared/outbox/__tests__/dispatcher.test.ts`

**Interfaces:**
- Consumes: `registerQueue`, `getQueue`, `addJob`, `QUEUE_NAMES` from `shared/queue` (`QueueManager.ts:27-83`); `setupMongo/teardownMongo/clearCollections` from `src/__tests__/helpers/mongoMemory`.
- Produces:
  ```ts
  export type OutboxStatus = 'pending' | 'processing' | 'done' | 'dead';
  export interface IOutboxEvent extends Document { collegeId: Types.ObjectId; type: string; payload: Record<string, unknown>; dedupeKey: string; status: OutboxStatus; attempts: number; availableAt: Date; lockedUntil: Date | null; lastError?: string; processedAt?: Date; createdAt: Date }
  export type OutboxPayload = { collegeId: string } & Record<string, unknown>;
  export type OutboxConsumer = (payload: OutboxPayload, event: IOutboxEvent) => Promise<void>;
  export function registerConsumer(type: string, handler: OutboxConsumer): void;
  export function registerSweeper(fn: () => Promise<void>): void;
  export function emit(type: string, payload: OutboxPayload, dedupeKey: string): Promise<boolean>;   // true when newly recorded
  export function nextAvailableAt(attempts: number, now?: Date): Date;
  export function claimNext(now?: Date): Promise<IOutboxEvent | null>;
  export function processEvent(event: IOutboxEvent): Promise<void>;
  export function processOnce(limit?: number): Promise<number>;
  export function kick(): Promise<void>;
  export function drainOutbox(): Promise<number>;
  export function retryDead(collegeId: string, dedupeKey: string): Promise<boolean>;
  export function setTickEnqueuer(fn: (() => Promise<void>) | null): void;
  export function __resetOutboxForTesting(): void;
  export const MAX_ATTEMPTS = 8; export const LOCK_MS = 120_000; export const BASE_DELAY_MS = 5_000; export const MAX_DELAY_MS = 600_000;
  // dispatcher.ts
  export const TICK_SCHEDULER_ID = 'outbox-tick'; export const TICK_EVERY_MS = 5_000;
  export function registerOutboxQueue(): Promise<void>;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/shared/outbox/__tests__/outbox.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { OutboxEvent } from '../OutboxEvent';
import {
  emit, registerConsumer, registerSweeper, claimNext, processEvent, processOnce, kick, drainOutbox, retryDead,
  nextAvailableAt, setTickEnqueuer, __resetOutboxForTesting, MAX_ATTEMPTS, LOCK_MS, MAX_DELAY_MS,
} from '../outbox';

const cid = String(new Types.ObjectId());

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
beforeEach(() => { __resetOutboxForTesting(); });
afterEach(async () => { await clearCollections(); });

describe('emit', () => {
  it('records a pending event once per dedupeKey', async () => {
    expect(await emit('t.x', { collegeId: cid, a: 1 }, 'k1')).toBe(true);
    expect(await emit('t.x', { collegeId: cid, a: 2 }, 'k1')).toBe(false);
    const rows = await OutboxEvent.find({ dedupeKey: 'k1' }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 't.x', status: 'pending', attempts: 0, payload: { collegeId: cid, a: 1 }, lockedUntil: null });
    expect(String(rows[0]!.collegeId)).toBe(cid);
  });
});

describe('claimNext', () => {
  it('claims a due pending event, locks it for 2 minutes, and skips future or locked ones', async () => {
    await emit('t.x', { collegeId: cid }, 'due');
    await OutboxEvent.updateOne({ dedupeKey: 'due' }, { $set: { availableAt: new Date(Date.now() - 1000) } });
    await emit('t.x', { collegeId: cid }, 'future');
    await OutboxEvent.updateOne({ dedupeKey: 'future' }, { $set: { availableAt: new Date(Date.now() + 60_000) } });
    const now = new Date();
    const first = await claimNext(now);
    expect(first?.dedupeKey).toBe('due');
    expect(first?.status).toBe('processing');
    expect(first!.lockedUntil!.getTime()).toBe(now.getTime() + LOCK_MS);
    expect(await claimNext(now)).toBeNull();
  });

  it('re-claims a processing event whose lock has expired', async () => {
    await emit('t.x', { collegeId: cid }, 'stale');
    await OutboxEvent.updateOne({ dedupeKey: 'stale' }, { $set: { status: 'processing', lockedUntil: new Date(Date.now() - 1) } });
    expect((await claimNext())?.dedupeKey).toBe('stale');
  });
});

describe('processEvent', () => {
  it('marks done on success', async () => {
    const seen: unknown[] = [];
    registerConsumer('t.ok', async (p) => { seen.push(p); });
    await emit('t.ok', { collegeId: cid, n: 1 }, 'ok');
    await processEvent((await claimNext())!);
    expect(seen).toEqual([{ collegeId: cid, n: 1 }]);
    const row = (await OutboxEvent.findOne({ dedupeKey: 'ok' }).lean())!;
    expect(row.status).toBe('done');
    expect(row.processedAt).toBeInstanceOf(Date);
    expect(row.lockedUntil).toBeNull();
  });

  it('backs off exponentially on failure and dead-letters after 8 attempts', async () => {
    registerConsumer('t.fail', async () => { throw new Error('boom'); });
    await emit('t.fail', { collegeId: cid }, 'f');
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      await OutboxEvent.updateOne({ dedupeKey: 'f' }, { $set: { availableAt: new Date(0) } });
      const before = Date.now();
      await processEvent((await claimNext())!);
      const row = (await OutboxEvent.findOne({ dedupeKey: 'f' }).lean())!;
      expect(row).toMatchObject({ status: 'pending', attempts: attempt, lastError: 'boom' });
      const delay = row.availableAt.getTime() - before;
      expect(delay).toBeGreaterThanOrEqual(Math.min(5_000 * 2 ** attempt, MAX_DELAY_MS) - 50);
      expect(delay).toBeLessThanOrEqual(Math.min(5_000 * 2 ** attempt, MAX_DELAY_MS) + 1_000);
    }
    await OutboxEvent.updateOne({ dedupeKey: 'f' }, { $set: { availableAt: new Date(0) } });
    await processEvent((await claimNext())!);
    expect(await OutboxEvent.findOne({ dedupeKey: 'f' }).lean()).toMatchObject({ status: 'dead', attempts: MAX_ATTEMPTS, lastError: 'boom' });
    expect(await claimNext()).toBeNull();
  });

  it('an event with no consumer fails like any other', async () => {
    await emit('t.none', { collegeId: cid }, 'n');
    await processEvent((await claimNext())!);
    expect((await OutboxEvent.findOne({ dedupeKey: 'n' }).lean())?.lastError).toMatch(/No consumer registered for t.none/);
  });

  it('nextAvailableAt caps at ten minutes', () => {
    const now = new Date(0);
    expect(nextAvailableAt(1, now).getTime()).toBe(10_000);
    expect(nextAvailableAt(3, now).getTime()).toBe(40_000);
    expect(nextAvailableAt(7, now).getTime()).toBe(MAX_DELAY_MS);
  });
});

describe('processOnce, kick and drain', () => {
  it('runs sweepers first, then every claimable event', async () => {
    const order: string[] = [];
    registerSweeper(async () => { order.push('sweep'); });
    registerConsumer('t.a', async (p) => { order.push(`a:${p.i}`); });
    await emit('t.a', { collegeId: cid, i: 1 }, 'a1');
    await emit('t.a', { collegeId: cid, i: 2 }, 'a2');
    expect(await processOnce()).toBe(2);
    expect(order[0]).toBe('sweep');
    expect(order.slice(1).sort()).toEqual(['a:1', 'a:2']);
    expect(await OutboxEvent.countDocuments({ status: 'done' })).toBe(2);
  });

  it('kick uses the enqueuer when one is installed and falls back to inline processing otherwise', async () => {
    const handled: string[] = [];
    registerConsumer('t.k', async (_p, ev) => { handled.push(ev.dedupeKey); });
    let enqueued = 0;
    setTickEnqueuer(async () => { enqueued += 1; });
    await emit('t.k', { collegeId: cid }, 'k1');
    await kick();
    expect(enqueued).toBe(1);
    expect(handled).toEqual([]);                       // the queue would process it; nothing ran inline

    setTickEnqueuer(async () => { throw new Error('Queue not registered'); });
    await kick();
    expect(await drainOutbox()).toBeGreaterThanOrEqual(0);
    expect(handled).toEqual(['k1']);

    setTickEnqueuer(null);
    await emit('t.k', { collegeId: cid }, 'k2');
    await kick();
    await drainOutbox();
    expect(handled).toEqual(['k1', 'k2']);
  });

  it('drainOutbox processes until the outbox is quiet, including events emitted by a consumer', async () => {
    registerConsumer('t.first', async () => { await emit('t.second', { collegeId: cid }, 's'); });
    const done: string[] = [];
    registerConsumer('t.second', async () => { done.push('second'); });
    await emit('t.first', { collegeId: cid }, 'f');
    await drainOutbox();
    expect(done).toEqual(['second']);
    expect(await OutboxEvent.countDocuments({ status: 'done' })).toBe(2);
  });
});

describe('retryDead', () => {
  it('requeues a dead event of the college and ignores others', async () => {
    await emit('t.d', { collegeId: cid }, 'd');
    await OutboxEvent.updateOne({ dedupeKey: 'd' }, { $set: { status: 'dead', attempts: 8, lastError: 'x' } });
    expect(await retryDead(String(new Types.ObjectId()), 'd')).toBe(false);
    expect(await retryDead(cid, 'd')).toBe(true);
    const row = (await OutboxEvent.findOne({ dedupeKey: 'd' }).lean())!;
    expect(row).toMatchObject({ status: 'pending', attempts: 0 });
    expect(row.lastError).toBeUndefined();
  });
});

describe('OutboxEvent model', () => {
  it('expires done rows after 30 days through a partial TTL index', () => {
    const idx = OutboxEvent.schema.indexes().find(([fields]) => (fields as Record<string, number>).processedAt === 1);
    expect(idx?.[1]).toMatchObject({ expireAfterSeconds: 30 * 86_400, partialFilterExpression: { status: 'done' } });
    const unique = OutboxEvent.schema.indexes().find(([fields]) => (fields as Record<string, number>).dedupeKey === 1);
    expect(unique?.[1]).toMatchObject({ unique: true });
  });
});
```

```ts
// backend/src/shared/outbox/__tests__/dispatcher.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queue = vi.hoisted(() => ({ upsertJobScheduler: vi.fn().mockResolvedValue({}) }));
const queueModule = vi.hoisted(() => ({
  registerQueue: vi.fn(),
  getQueue: vi.fn(() => queue),
  addJob: vi.fn().mockResolvedValue({}),
  QUEUE_NAMES: { OUTBOX: 'platform_outbox' },
}));
const outbox = vi.hoisted(() => ({ processOnce: vi.fn().mockResolvedValue(3), setTickEnqueuer: vi.fn() }));
vi.mock('../../queue', () => queueModule);
vi.mock('../outbox', () => outbox);

import { registerOutboxQueue, TICK_SCHEDULER_ID, TICK_EVERY_MS } from '../dispatcher';

beforeEach(() => { vi.clearAllMocks(); });

describe('registerOutboxQueue', () => {
  it('registers the queue with a 5 s tick and installs an immediate-tick enqueuer', async () => {
    await registerOutboxQueue();
    expect(queueModule.registerQueue).toHaveBeenCalledWith(expect.objectContaining({ name: 'platform_outbox', concurrency: 1 }));
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(TICK_SCHEDULER_ID, { every: TICK_EVERY_MS }, {
      name: 'tick', data: {}, opts: { attempts: 1, removeOnComplete: true, removeOnFail: true },
    });
    const enqueuer = outbox.setTickEnqueuer.mock.calls[0]![0] as () => Promise<void>;
    await enqueuer();
    expect(queueModule.addJob).toHaveBeenCalledWith('platform_outbox', 'tick', {}, { attempts: 1 });
    const processor = (queueModule.registerQueue.mock.calls[0]![0] as { processor: (j: unknown) => Promise<unknown> }).processor;
    expect(await processor({ name: 'tick' })).toEqual({ processed: 3 });
    expect(TICK_EVERY_MS).toBe(5_000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/shared/outbox`
Expected: FAIL with "Cannot find module '../OutboxEvent'" / "Cannot find module '../dispatcher'".

- [ ] **Step 3: Implement the model**

```ts
// backend/src/shared/outbox/OutboxEvent.ts
import { Schema, model, Document, Types } from 'mongoose';

export type OutboxStatus = 'pending' | 'processing' | 'done' | 'dead';
export const OUTBOX_STATUSES: readonly OutboxStatus[] = ['pending', 'processing', 'done', 'dead'];
/** `done` rows are kept 30 days for the admin console, then dropped by the TTL index. */
export const DONE_TTL_SECONDS = 30 * 86_400;

export interface IOutboxEvent extends Document {
  collegeId: Types.ObjectId;
  type: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  status: OutboxStatus;
  attempts: number;
  availableAt: Date;
  lockedUntil: Date | null;
  lastError?: string;
  processedAt?: Date;
  createdAt: Date;
}

const schema = new Schema<IOutboxEvent>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    dedupeKey: { type: String, required: true },
    status: { type: String, enum: OUTBOX_STATUSES, required: true, default: 'pending' },
    attempts: { type: Number, default: 0 },
    availableAt: { type: Date, required: true, default: Date.now },
    lockedUntil: { type: Date, default: null },
    lastError: String,
    processedAt: Date,
  },
  { timestamps: true },
);

schema.index({ dedupeKey: 1 }, { unique: true });
schema.index({ status: 1, availableAt: 1 });
schema.index({ status: 1, lockedUntil: 1 });
schema.index({ processedAt: 1 }, { expireAfterSeconds: DONE_TTL_SECONDS, partialFilterExpression: { status: 'done' } });

export const OutboxEvent = model<IOutboxEvent>('OutboxEvent', schema);
```

- [ ] **Step 4: Implement the core**

```ts
// backend/src/shared/outbox/outbox.ts
/**
 * Durable outbox (Juvi notices spec §6.2).
 *
 * `emit` upserts on `dedupeKey`, so re-emitting is a no-op. Consumers are
 * registered per event type; the dispatcher (dispatcher.ts) claims events one
 * at a time with a two-minute lock, backs off on failure and dead-letters after
 * eight attempts. `kick()` wakes the dispatcher; with no queue installed
 * (dev/test without Redis) it processes inline, the way `enqueueReconcile` does.
 */
import { OutboxEvent, IOutboxEvent } from './OutboxEvent';

export type OutboxPayload = { collegeId: string } & Record<string, unknown>;
export type OutboxConsumer = (payload: OutboxPayload, event: IOutboxEvent) => Promise<void>;
export type OutboxSweeper = () => Promise<void>;

export const MAX_ATTEMPTS = 8;
export const LOCK_MS = 120_000;
export const BASE_DELAY_MS = 5_000;
export const MAX_DELAY_MS = 600_000;

const consumers = new Map<string, OutboxConsumer>();
const sweepers: OutboxSweeper[] = [];
/** Installed by the dispatcher; null means "no queue, run inline". */
let enqueueTick: (() => Promise<void>) | null = null;
/** The one inline run in flight for this process, if any. */
let inflight: Promise<number> | null = null;

export function registerConsumer(type: string, handler: OutboxConsumer): void { consumers.set(type, handler); }
export function registerSweeper(fn: OutboxSweeper): void { sweepers.push(fn); }
export function setTickEnqueuer(fn: (() => Promise<void>) | null): void { enqueueTick = fn; }

/** Upsert on dedupeKey. Returns true when a new event was recorded, false when it already existed. */
export async function emit(type: string, payload: OutboxPayload, dedupeKey: string): Promise<boolean> {
  const res = await OutboxEvent.updateOne(
    { dedupeKey },
    { $setOnInsert: { collegeId: payload.collegeId, type, payload, dedupeKey, status: 'pending', attempts: 0, availableAt: new Date(), lockedUntil: null } },
    { upsert: true },
  );
  return res.upsertedCount > 0;
}

/** 5 s × 2^attempts, capped at ten minutes. */
export function nextAvailableAt(attempts: number, now = new Date()): Date {
  return new Date(now.getTime() + Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS));
}

/** Atomically claims one runnable event: pending and due, or processing with an expired lock. */
export async function claimNext(now = new Date()): Promise<IOutboxEvent | null> {
  return OutboxEvent.findOneAndUpdate(
    { $or: [{ status: 'pending', availableAt: { $lte: now } }, { status: 'processing', lockedUntil: { $lt: now } }] },
    { $set: { status: 'processing', lockedUntil: new Date(now.getTime() + LOCK_MS) } },
    { new: true, sort: { availableAt: 1 } },
  );
}

export async function processEvent(event: IOutboxEvent): Promise<void> {
  const handler = consumers.get(event.type);
  try {
    if (!handler) throw new Error(`No consumer registered for ${event.type}`);
    await handler(event.payload as OutboxPayload, event);
    await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: 'done', processedAt: new Date(), lockedUntil: null } });
  } catch (err) {
    const attempts = event.attempts + 1;
    const message = err instanceof Error ? err.message : String(err);
    if (attempts >= MAX_ATTEMPTS) {
      console.error(`[outbox] ${event.type} ${event.dedupeKey} is dead after ${attempts} attempts: ${message}`);
      await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: 'dead', attempts, lastError: message, lockedUntil: null } });
    } else {
      await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: 'pending', attempts, lastError: message, availableAt: nextAvailableAt(attempts), lockedUntil: null } });
    }
  }
}

/** Runs every sweeper, then processes claimable events until none is left (or `limit`). Returns the number processed. */
export async function processOnce(limit = 500): Promise<number> {
  for (const sweep of sweepers) {
    try { await sweep(); } catch (err) { console.error('[outbox] sweeper failed', err); }
  }
  let n = 0;
  while (n < limit) {
    const event = await claimNext();
    if (!event) break;
    await processEvent(event);
    n += 1;
  }
  return n;
}

/** One inline run per process at a time; a concurrent caller shares the running promise. */
function runInline(): Promise<number> {
  if (!inflight) inflight = processOnce().finally(() => { inflight = null; });
  return inflight;
}

/** Wakes the dispatcher. Without a queue (dev/test without Redis) the events are processed inline. */
export async function kick(): Promise<void> {
  if (enqueueTick) {
    try { await enqueueTick(); return; } catch (err) {
      console.warn('[outbox] kick fell back to inline processing:', err instanceof Error ? err.message : err);
    }
  }
  void runInline().catch((err) => console.error('[outbox] inline processing failed', err));
}

/** Waits for any inline run in flight, then processes until the outbox is quiet. Tests and inline callers use this. */
export async function drainOutbox(): Promise<number> {
  let total = 0;
  if (inflight) total += await inflight;
  for (;;) {
    const n = await runInline();
    total += n;
    if (n === 0) return total;
  }
}

/** Puts a dead event of this college back in the queue (admin "Retry delivery"). */
export async function retryDead(collegeId: string, dedupeKey: string): Promise<boolean> {
  const res = await OutboxEvent.updateOne(
    { collegeId, dedupeKey, status: 'dead' },
    { $set: { status: 'pending', attempts: 0, availableAt: new Date(), lockedUntil: null }, $unset: { lastError: 1 } },
  );
  return res.modifiedCount > 0;
}

/** Test-only: forget consumers, sweepers and the enqueuer. */
export function __resetOutboxForTesting(): void {
  consumers.clear();
  sweepers.length = 0;
  enqueueTick = null;
  inflight = null;
}
```

```ts
// backend/src/shared/outbox/dispatcher.ts
/**
 * Outbox dispatcher: a BullMQ repeatable tick every 5 s plus an immediate tick
 * whenever something calls `kick()`. Registered from server.ts next to the Juvi
 * reconcile queue and guarded by DISABLE_BACKGROUND_JOBS there.
 */
import { Job } from 'bullmq';
import { registerQueue, getQueue, addJob, QUEUE_NAMES } from '../queue';
import { processOnce, setTickEnqueuer } from './outbox';

export const TICK_SCHEDULER_ID = 'outbox-tick';
export const TICK_EVERY_MS = 5_000;

async function processor(_job: Job): Promise<unknown> {
  return { processed: await processOnce() };
}

export async function registerOutboxQueue(): Promise<void> {
  registerQueue({ name: QUEUE_NAMES.OUTBOX, processor, concurrency: 1 });
  const queue = getQueue(QUEUE_NAMES.OUTBOX);
  await queue.upsertJobScheduler(TICK_SCHEDULER_ID, { every: TICK_EVERY_MS }, {
    name: 'tick', data: {}, opts: { attempts: 1, removeOnComplete: true, removeOnFail: true },
  });
  setTickEnqueuer(async () => { await addJob(QUEUE_NAMES.OUTBOX, 'tick', {}, { attempts: 1 }); });
}
```

```ts
// backend/src/shared/outbox/index.ts
export * from './OutboxEvent';
export * from './outbox';
```

- [ ] **Step 5: Register the queue name and the worker**

In `backend/src/shared/queue/QueueManager.ts`, extend `QUEUE_NAMES` (after the Juvi block, before `} as const;`):

```ts
  // Juvi mobile app
  JUVI_PROVISIONING: 'juvi_provisioning',
  JUVI_RECONCILE: 'juvi_reconcile',

  // Durable outbox (shared/outbox) — notices fan-out, reminders, ack audit
  OUTBOX: 'platform_outbox',
} as const;
```

In `backend/src/server.ts`, add the import after the reconcile-worker import and the registration after the reconcile block inside the `DISABLE_BACKGROUND_JOBS` guard:

```ts
import { registerJuviReconcileQueue } from './modules/juvi-app/spaces/reconcile-worker';
import { registerOutboxQueue } from './shared/outbox/dispatcher';
```

```ts
    try {
      await registerJuviReconcileQueue();
    } catch (err) {
      console.warn('[server] Failed to register juvi reconcile queue (Redis unavailable?):', err);
    }
    try {
      await registerOutboxQueue();
    } catch (err) {
      console.warn('[server] Failed to register outbox dispatcher (Redis unavailable?); kick() will process inline:', err);
    }
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `cd backend && npx vitest run src/shared/outbox && npm run typecheck`
Expected: PASS (12 tests across the two files); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add backend/src/shared/outbox backend/src/shared/queue/QueueManager.ts backend/src/server.ts
git commit -m "feat(outbox): durable outbox with dedupe, locked claims, exponential backoff, dead-lettering and a 5 s dispatcher

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Notice and NoticeRecipient models, `welcomeNotice` setting

**Files:**
- Create: `backend/src/models/juvi/Notice.ts`, `backend/src/models/juvi/NoticeRecipient.ts`
- Modify: `backend/src/models/College.ts:3-58`, `backend/src/models/index.ts:410-416`, `backend/src/seed.ts:104-110` and `:285-292`, `backend/src/modules/juvi-app/config/institution-config.ts:20-33`
- Test: `backend/src/models/juvi/__tests__/notice-models.schema.test.ts`

**Interfaces:**
- Consumes: `AccountKind`, `ACCOUNT_KINDS` from `models/juvi/JuviAccount.ts:3-7`.
- Produces:
  ```ts
  // Notice.ts
  export type AudienceRuleKind = 'all' | 'role' | 'department' | 'programme' | 'batch' | 'section' | 'course_offering' | 'hostel_block' | 'custom';
  export type NoticePriority = 'routine' | 'important' | 'urgent';
  export type NoticePurpose = 'standard' | 'welcome';
  export type NoticeStatus = 'publishing' | 'published' | 'archived';
  export const AUDIENCE_RULE_KINDS, NOTICE_PRIORITIES, NOTICE_PURPOSES, NOTICE_STATUSES, NOTICE_ATTACHMENT_MIMES;
  export const NOTICE_TITLE_MAX = 120, NOTICE_BODY_MAX = 5000, NOTICE_ATTACHMENTS_MAX = 5, NOTICE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024, NOTICE_REMINDERS_MAX = 2;
  export interface IAudienceRule { kind: AudienceRuleKind; ids: string[]; departmentId?: string }     // hex ObjectIds, or role words / persona codes for kind 'role'; departmentId narrows a 'role' rule to one department (HOD scope, spec §7.3)
  export interface INoticeAttachment { key: string; name: string; mime: string; size: number }
  export interface INoticePublisher { personId?: Types.ObjectId; userId?: Types.ObjectId; office: string }
  export interface INotice extends Document { collegeId; title; body; attachments; publisher; audience: { rules: IAudienceRule[]; line: string }; channelIds: Types.ObjectId[]; ackRequired; ackDeadline?: Date | null; ackCommentAllowed; priority; purpose; status; counts: { audience: number; onJuvi: number }; reminders: { at: Date; by: string }[]; publishedAt?; archivedAt?; createdAt; updatedAt }
  export type LeanNotice = Omit<INotice, keyof Document> & { _id: Types.ObjectId };
  // NoticeRecipient.ts
  export type AckMethod = 'hold' | 'confirm'; export const ACK_METHODS; export const ACK_COMMENT_MAX = 500;
  export interface INoticeAck { at: Date; late: boolean; method: AckMethod; sessionId: Types.ObjectId; offline: boolean; clientAt?: Date; comment?: string }
  export interface IRecipientLabels { batch?: string; section?: string; department?: string }
  export interface INoticeRecipient extends Document { collegeId; noticeId; personId; accountId: Types.ObjectId | null; kind: AccountKind; labels: IRecipientLabels; addedLater; ackRequired; deadline: Date | null; receivedAt?: Date | null; seenAt?: Date | null; dismissedAt?: Date | null; remindedAt?: Date | null; ack: INoticeAck | null; archived: boolean }
  export type LeanNoticeRecipient = Omit<INoticeRecipient, keyof Document> & { _id: Types.ObjectId };
  // College.ts
  IJuviConfig.welcomeNotice?: { studentNoticeId?: string; facultyNoticeId?: string }
  ```

- [ ] **Step 1: Write the failing schema test**

```ts
// backend/src/models/juvi/__tests__/notice-models.schema.test.ts
import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { Notice, NOTICE_ATTACHMENT_MIMES } from '../Notice';
import { NoticeRecipient } from '../NoticeRecipient';
import { College } from '../../College';

const oid = () => new Types.ObjectId();
const base = () => ({
  collegeId: oid(), title: 'Exam timetable', body: 'See attached.',
  publisher: { personId: oid(), userId: oid(), office: 'Exam Section' },
  audience: { rules: [{ kind: 'batch', ids: [String(oid())] }], line: 'Sent to 2024 batch' },
});

describe('Notice', () => {
  it('defaults to publishing, routine, standard with zero counts', () => {
    const doc = new Notice(base());
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe('publishing');
    expect(doc.priority).toBe('routine');
    expect(doc.purpose).toBe('standard');
    expect(doc.counts).toEqual({ audience: 0, onJuvi: 0 });
    expect(doc.ackRequired).toBe(false);
    expect(doc.ackCommentAllowed).toBe(false);
    expect(doc.reminders).toEqual([]);
    expect(doc.channelIds).toEqual([]);
  });

  it('enforces title and body lengths, rule kinds, five attachments and two reminders', () => {
    expect(new Notice({ ...base(), title: 'x'.repeat(121) }).validateSync()?.errors.title).toBeDefined();
    expect(new Notice({ ...base(), body: 'x'.repeat(5001) }).validateSync()?.errors.body).toBeDefined();
    expect(new Notice({ ...base(), audience: { rules: [{ kind: 'club', ids: [] }], line: '' } }).validateSync()?.errors['audience.rules.0.kind']).toBeDefined();
    const att = { key: 'k', name: 'a.pdf', mime: 'application/pdf', size: 1 };
    expect(new Notice({ ...base(), attachments: Array(6).fill(att) }).validateSync()?.errors.attachments).toBeDefined();
    expect(new Notice({ ...base(), reminders: Array(3).fill({ at: new Date(), by: 'x' }) }).validateSync()?.errors.reminders).toBeDefined();
  });

  it('a deadline requires ackRequired', async () => {
    await expect(new Notice({ ...base(), ackDeadline: new Date() }).validate()).rejects.toThrow(/deadline requires ackRequired/);
    await expect(new Notice({ ...base(), ackRequired: true, ackDeadline: new Date() }).validate()).resolves.toBeUndefined();
  });

  it('declares the spec indexes and the attachment mime allowlist', () => {
    const keys = Notice.schema.indexes().map(([f]) => Object.keys(f as object).join(','));
    expect(keys).toEqual(expect.arrayContaining(['collegeId,status,publishedAt', 'collegeId,publisher.userId,publishedAt', 'collegeId,channelIds']));
    expect(NOTICE_ATTACHMENT_MIMES).toContain('application/pdf');
    expect(NOTICE_ATTACHMENT_MIMES).toHaveLength(7);
  });
});

describe('NoticeRecipient', () => {
  it('defaults accountId and ack to null and addedLater/archived to false', () => {
    const doc = new NoticeRecipient({ collegeId: oid(), noticeId: oid(), personId: oid(), kind: 'student' });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.accountId).toBeNull();
    expect(doc.ack).toBeNull();
    expect(doc.addedLater).toBe(false);
    expect(doc.archived).toBe(false);
    expect(doc.deadline).toBeNull();
    expect(doc.seenAt).toBeNull();
  });

  it('validates the ack record and the 500-character comment', () => {
    const ok = new NoticeRecipient({ collegeId: oid(), noticeId: oid(), personId: oid(), kind: 'faculty', ack: { at: new Date(), late: false, method: 'hold', sessionId: oid(), offline: false } });
    expect(ok.validateSync()).toBeUndefined();
    const bad = new NoticeRecipient({ collegeId: oid(), noticeId: oid(), personId: oid(), kind: 'faculty', ack: { at: new Date(), late: false, method: 'tap', sessionId: oid(), offline: false, comment: 'x'.repeat(501) } });
    const errs = bad.validateSync()?.errors ?? {};
    expect(errs['ack.method']).toBeDefined();
    expect(errs['ack.comment']).toBeDefined();
  });

  it('has the unique pair index and the three query indexes', () => {
    const idx = NoticeRecipient.schema.indexes();
    const pair = idx.find(([f]) => Object.keys(f as object).join(',') === 'noticeId,personId');
    expect(pair?.[1]).toMatchObject({ unique: true });
    const keys = idx.map(([f]) => Object.keys(f as object).join(','));
    expect(keys).toEqual(expect.arrayContaining(['collegeId,accountId,ackRequired,ack.at,deadline', 'collegeId,accountId,receivedAt', 'noticeId,seenAt,ack.at']));
  });
});

describe('College.juvi.welcomeNotice', () => {
  it('is absent by default and accepts per-kind ids', () => {
    const c = new College({ name: 'X', code: 'X', address: { line1: 'a', city: 'b', state: 'c', pincode: 'd' }, contactEmail: 'a@b.c', contactPhone: '1' });
    expect(c.juvi.welcomeNotice).toBeUndefined();
    c.set('juvi.welcomeNotice', { studentNoticeId: String(oid()) });
    expect(c.validateSync()).toBeUndefined();
    expect(c.juvi.welcomeNotice?.studentNoticeId).toMatch(/^[0-9a-f]{24}$/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/models/juvi/__tests__/notice-models.schema.test.ts`
Expected: FAIL with "Cannot find module '../Notice'".

- [ ] **Step 3: Implement the models**

```ts
// backend/src/models/juvi/Notice.ts
import { Schema, model, Document, Types } from 'mongoose';

export type AudienceRuleKind = 'all' | 'role' | 'department' | 'programme' | 'batch' | 'section' | 'course_offering' | 'hostel_block' | 'custom';
export type NoticePriority = 'routine' | 'important' | 'urgent';
export type NoticePurpose = 'standard' | 'welcome';
export type NoticeStatus = 'publishing' | 'published' | 'archived';

export const AUDIENCE_RULE_KINDS: readonly AudienceRuleKind[] = ['all', 'role', 'department', 'programme', 'batch', 'section', 'course_offering', 'hostel_block', 'custom'];
export const NOTICE_PRIORITIES: readonly NoticePriority[] = ['routine', 'important', 'urgent'];
export const NOTICE_PURPOSES: readonly NoticePurpose[] = ['standard', 'welcome'];
export const NOTICE_STATUSES: readonly NoticeStatus[] = ['publishing', 'published', 'archived'];
export const NOTICE_TITLE_MAX = 120;
export const NOTICE_BODY_MAX = 5000;
export const NOTICE_ATTACHMENTS_MAX = 5;
export const NOTICE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const NOTICE_REMINDERS_MAX = 2;
/** PDF, PNG, JPEG, WEBP, DOCX, XLSX, PPTX (spec §6.1). */
export const NOTICE_ATTACHMENT_MIMES: readonly string[] = [
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

/**
 * `ids` are hex ObjectIds for every kind except `role`, whose ids are `student | faculty | staff | hod` or a persona code.
 * `departmentId` only applies to `role`: it limits the rule to members of that department (an HOD's `role` rule, spec §7.3).
 */
export interface IAudienceRule { kind: AudienceRuleKind; ids: string[]; departmentId?: string }
export interface INoticeAttachment { key: string; name: string; mime: string; size: number }
/** `personId`/`userId` are absent on the system-created default welcome notice. */
export interface INoticePublisher { personId?: Types.ObjectId; userId?: Types.ObjectId; office: string }
export interface INoticeReminder { at: Date; by: string }

export interface INotice extends Document {
  collegeId: Types.ObjectId;
  title: string;
  body: string;
  attachments: INoticeAttachment[];
  publisher: INoticePublisher;
  audience: { rules: IAudienceRule[]; line: string };
  channelIds: Types.ObjectId[];
  ackRequired: boolean;
  ackDeadline?: Date | null;
  ackCommentAllowed: boolean;
  priority: NoticePriority;
  purpose: NoticePurpose;
  status: NoticeStatus;
  counts: { audience: number; onJuvi: number };
  reminders: INoticeReminder[];
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ruleSchema = new Schema<IAudienceRule>(
  { kind: { type: String, enum: AUDIENCE_RULE_KINDS, required: true }, ids: { type: [String], default: [] }, departmentId: String },
  { _id: false },
);
const attachmentSchema = new Schema<INoticeAttachment>(
  { key: { type: String, required: true }, name: { type: String, required: true }, mime: { type: String, required: true }, size: { type: Number, required: true, min: 0 } },
  { _id: false },
);
const reminderSchema = new Schema<INoticeReminder>({ at: { type: Date, required: true }, by: { type: String, required: true } }, { _id: false });

const schema = new Schema<INotice>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: NOTICE_TITLE_MAX },
    body: { type: String, required: true, maxlength: NOTICE_BODY_MAX },
    attachments: {
      type: [attachmentSchema], default: [],
      validate: { validator: (v: unknown[]) => v.length <= NOTICE_ATTACHMENTS_MAX, message: `At most ${NOTICE_ATTACHMENTS_MAX} attachments` },
    },
    publisher: {
      personId: { type: Schema.Types.ObjectId, ref: 'Person' },
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      office: { type: String, required: true },
    },
    audience: { rules: { type: [ruleSchema], default: [] }, line: { type: String, default: '' } },
    channelIds: { type: [Schema.Types.ObjectId], default: [] },
    ackRequired: { type: Boolean, default: false },
    ackDeadline: { type: Date, default: null },
    ackCommentAllowed: { type: Boolean, default: false },
    priority: { type: String, enum: NOTICE_PRIORITIES, default: 'routine' },
    purpose: { type: String, enum: NOTICE_PURPOSES, default: 'standard' },
    status: { type: String, enum: NOTICE_STATUSES, required: true, default: 'publishing' },
    counts: { audience: { type: Number, default: 0 }, onJuvi: { type: Number, default: 0 } },
    reminders: {
      type: [reminderSchema], default: [],
      validate: { validator: (v: unknown[]) => v.length <= NOTICE_REMINDERS_MAX, message: `At most ${NOTICE_REMINDERS_MAX} reminders` },
    },
    publishedAt: Date,
    archivedAt: Date,
  },
  { timestamps: true },
);

// A deadline only makes sense on an acknowledgement notice (spec §5).
schema.pre('validate', function (next) {
  if (this.ackDeadline && !this.ackRequired) this.invalidate('ackDeadline', 'A deadline requires ackRequired');
  next();
});

schema.index({ collegeId: 1, status: 1, publishedAt: -1 });
schema.index({ collegeId: 1, 'publisher.userId': 1, publishedAt: -1 });
schema.index({ collegeId: 1, channelIds: 1 });

/** A lean read of a Notice: fields only, no Document methods. */
export type LeanNotice = Omit<INotice, keyof Document> & { _id: Types.ObjectId };

export const Notice = model<INotice>('Notice', schema);
```

```ts
// backend/src/models/juvi/NoticeRecipient.ts
import { Schema, model, Document, Types } from 'mongoose';
import { AccountKind, ACCOUNT_KINDS } from './JuviAccount';

export type AckMethod = 'hold' | 'confirm';
export const ACK_METHODS: readonly AckMethod[] = ['hold', 'confirm'];
export const ACK_COMMENT_MAX = 500;

export interface INoticeAck {
  at: Date;
  late: boolean;
  method: AckMethod;
  sessionId: Types.ObjectId;
  offline: boolean;
  clientAt?: Date;
  comment?: string;
}

/** Names frozen at publish, used to group reach (spec §5). */
export interface IRecipientLabels { batch?: string; section?: string; department?: string }

/**
 * One row per audience member: the audience snapshot and that person's state.
 * `accountId` is null while the person is not on Juvi; `ack` is set exactly once
 * by a conditional update on `ack: null`.
 */
export interface INoticeRecipient extends Document {
  collegeId: Types.ObjectId;
  noticeId: Types.ObjectId;
  personId: Types.ObjectId;
  accountId: Types.ObjectId | null;
  kind: AccountKind;
  labels: IRecipientLabels;
  addedLater: boolean;
  ackRequired: boolean;
  deadline: Date | null;
  receivedAt?: Date | null;
  seenAt?: Date | null;
  dismissedAt?: Date | null;
  remindedAt?: Date | null;
  ack: INoticeAck | null;
  archived: boolean;
}

const ackSchema = new Schema<INoticeAck>(
  {
    at: { type: Date, required: true },
    late: { type: Boolean, required: true },
    method: { type: String, enum: ACK_METHODS, required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'MobileSession', required: true },
    offline: { type: Boolean, required: true },
    clientAt: Date,
    comment: { type: String, maxlength: ACK_COMMENT_MAX },
  },
  { _id: false },
);

const schema = new Schema<INoticeRecipient>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    noticeId: { type: Schema.Types.ObjectId, ref: 'Notice', required: true },
    personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', default: null },
    kind: { type: String, enum: ACCOUNT_KINDS, required: true },
    labels: { batch: String, section: String, department: String },
    addedLater: { type: Boolean, default: false },
    ackRequired: { type: Boolean, default: false },
    deadline: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    seenAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
    remindedAt: { type: Date, default: null },
    ack: { type: ackSchema, default: null },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

schema.index({ noticeId: 1, personId: 1 }, { unique: true });
schema.index({ collegeId: 1, accountId: 1, ackRequired: 1, 'ack.at': 1, deadline: 1 });
schema.index({ collegeId: 1, accountId: 1, receivedAt: -1 });
schema.index({ noticeId: 1, seenAt: 1, 'ack.at': 1 });

/** A lean read of a NoticeRecipient: fields only, no Document methods. */
export type LeanNoticeRecipient = Omit<INoticeRecipient, keyof Document> & { _id: Types.ObjectId };

export const NoticeRecipient = model<INoticeRecipient>('NoticeRecipient', schema);
```

- [ ] **Step 4: Wire the setting, the barrel, the seed and the config view**

In `backend/src/models/College.ts` add to `IJuviConfig` (after `featureFlags`) and to `juviConfigSchema` (after `featureFlags`):

```ts
  featureFlags: { languageRoadmap: boolean };
  /** Per-kind published `purpose: 'welcome'` notice ids, as hex strings (Juvi notices spec §5). */
  welcomeNotice?: { studentNoticeId?: string; facultyNoticeId?: string };
}
```

```ts
    featureFlags: { languageRoadmap: { type: Boolean, default: false } },
    welcomeNotice: { type: new Schema({ studentNoticeId: String, facultyNoticeId: String }, { _id: false }), default: undefined },
  },
  { _id: false },
);
```

In `backend/src/modules/juvi-app/config/institution-config.ts` `normalizeJuviConfig`, add after `featureFlags`:

```ts
    featureFlags: { languageRoadmap: Boolean(j.featureFlags?.languageRoadmap) },
    welcomeNotice: j.welcomeNotice,
  };
```

In `backend/src/models/index.ts` append after the `JuviProvisionedCredential` export:

```ts
export { JuviProvisionedCredential } from './juvi/JuviProvisionedCredential';
export { Notice } from './juvi/Notice';
export { NoticeRecipient } from './juvi/NoticeRecipient';
```

In `backend/src/seed.ts` extend the import block and the reset list:

```ts
  // Juvi mobile app
  JuviAccount, MobileSession, ChannelTemplate, Channel, ChannelMembership,
  JuviProvisioningRun, JuviProvisionedCredential, Notice, NoticeRecipient,
} from './models';
```

```ts
    JuviProvisioningRun.deleteMany({ collegeId: CID }),
    JuviProvisionedCredential.deleteMany({ collegeId: CID }),
    Notice.deleteMany({ collegeId: CID }),
    NoticeRecipient.deleteMany({ collegeId: CID }),
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `cd backend && npx vitest run src/models/juvi && npm run typecheck`
Expected: PASS (the new file's 8 tests plus the existing juvi-app model tests); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/models/juvi/Notice.ts backend/src/models/juvi/NoticeRecipient.ts backend/src/models/juvi/__tests__/notice-models.schema.test.ts backend/src/models/College.ts backend/src/models/index.ts backend/src/seed.ts backend/src/modules/juvi-app/config/institution-config.ts
git commit -m "feat(juvi-app): Notice and NoticeRecipient models with the welcome-notice setting

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Audience resolution, rule-to-channel mapping and publisher scope (pure)

**Files:**
- Create: `backend/src/modules/juvi-app/notices/audience.ts`, `backend/src/modules/juvi-app/notices/scope.ts`, `backend/src/modules/juvi-app/notices/offices.ts`
- Test: `backend/src/modules/juvi-app/notices/__tests__/graph-fixture.ts` (shared fixture, not a test file), `backend/src/modules/juvi-app/notices/__tests__/audience.test.ts`, `backend/src/modules/juvi-app/notices/__tests__/scope.test.ts`, `backend/src/modules/juvi-app/notices/__tests__/offices.test.ts`

**Interfaces:**
- Consumes: `IAudienceRule`, `AudienceRuleKind`, `AUDIENCE_RULE_KINDS` (`models/juvi/Notice.ts`, Task 2); `IRecipientLabels` (`models/juvi/NoticeRecipient.ts`, Task 2); `AccountKind` (`models/juvi/JuviAccount.ts:3`); `ChannelRef` (`modules/juvi-app/spaces/strategies.ts:28`); `ChannelScopeType` (`models/juvi/ChannelTemplate.ts:4`); `AppError` (`middleware/errorHandler.ts:15`).
- Produces:
  ```ts
  // audience.ts
  export interface PersonNode {
    personId: string; kind: AccountKind; accountId: string | null; personaCodes: string[]; isHod: boolean;
    departmentId?: string; batchId?: string; sectionIds: string[]; offeringIds: string[]; hostelBlockId?: string;
    labels: IRecipientLabels;
  }
  export interface AudienceGraph {
    collegeName: string;
    people: Map<string, PersonNode>;
    departments: Map<string, { name: string }>;
    programmes: Map<string, { name: string }>;
    batches: Map<string, { name: string; programmeId?: string }>;
    sections: Map<string, { name: string; batchId: string; departmentId?: string }>;
    offerings: Map<string, { label: string; sectionId: string; departmentId?: string; facultyIds: string[] }>;
    blocks: Map<string, { name: string }>;
  }
  export const ROLE_WORDS: readonly ['student', 'faculty', 'staff', 'hod'];
  export function emptyAudienceGraph(collegeName?: string): AudienceGraph;
  export function personMatchesRule(rule: IAudienceRule, p: PersonNode, g: AudienceGraph): boolean;
  export function personMatchesRules(rules: IAudienceRule[], p: PersonNode, g: AudienceGraph): boolean;
  export function resolveAudience(rules: IAudienceRule[], g: AudienceGraph): PersonNode[];   // unique, sorted by personId
  export function ruleChannelRefs(rules: IAudienceRule[]): ChannelRef[];
  export function audienceLine(rules: IAudienceRule[], g: AudienceGraph): string;
  export function groupLabel(kind: AccountKind, labels: IRecipientLabels): string;
  // scope.ts
  export type PublisherKind = 'college' | 'department' | 'offerings' | 'none';
  export interface PublisherScope { kind: PublisherKind; userId: string; personId?: string; office: string; isAdmin: boolean; departmentId?: string; offeringIds: string[] }
  export interface TargetOption { id: string; label: string }
  export interface AudienceTargets { kinds: AudienceRuleKind[]; roles: string[]; departments: TargetOption[]; programmes: TargetOption[]; batches: TargetOption[]; sections: TargetOption[]; courseOfferings: TargetOption[]; hostelBlocks: TargetOption[] }
  export function narrowToScope(scope: PublisherScope, rules: IAudienceRule[]): IAudienceRule[];
  export function assertAudienceInScope(scope: PublisherScope, rules: IAudienceRule[], g: AudienceGraph): void;   // throws AppError(403)
  export function allowedTargets(scope: PublisherScope, g: AudienceGraph): AudienceTargets;
  // offices.ts
  export const COLLEGE_OFFICE = 'College Office'; export const PRINCIPAL_OFFICE = "Principal's Office"; export const FACULTY_OFFICE = 'Course Faculty';
  export const OFFICE_PERSONAS: Readonly<Record<string, string>>;   // persona code → office words
  export const OFFICE_PERSONA_CODES: readonly string[];
  export const OFFICE_NAMES: readonly string[];                     // what an admin may pick
  export function officeForPersonas(codes: string[]): string | null;
  export function hodOffice(departmentName: string): string;
  ```

Notes that bind later tasks:
- `assertAudienceInScope` takes the graph as a third argument (the spec writes `assertAudienceInScope(publisher, rules)`): HOD and faculty checks need to know which department a section, offering or person belongs to, and the function stays pure.
- An HOD's `role` rule is stored with `departmentId` (Task 2 fix). `narrowToScope` pins it server-side before the check, so the stored rules reproduce the audience exactly when Task 10 re-evaluates them for added-later rows.
- A `course_offering` rule reaches the offering's students only (enrolled, or the section roster when the offering has no enrolments — the same fallback as `spaces/strategies.ts:88`). A `department` rule reaches its students (through their branch), faculty and staff. `programme` resolves through the student's batch.
- The "staff offices" of spec §1 map to persona codes in `offices.ts`: Exam Section `ST-EXAM`, Finance `ST-ACC`, Admissions `ST-ADM` (and its sub-personas), Placement `ST-TPO`, Welfare `ST-WARDEN`, Campus Ops `ST-TRANSPORT-OFFICER`/`ST-SEC`/`ST-LIB` (the M08 campus personas), Registrar `ST-REG`.

- [ ] **Step 1: Write the shared graph fixture**

```ts
// backend/src/modules/juvi-app/notices/__tests__/graph-fixture.ts
import { AudienceGraph, PersonNode, emptyAudienceGraph } from '../audience';

/**
 * A small college for the pure tests:
 *   departments cse, ece · programme btech · batches b24 (btech), b23 (btech)
 *   sections sA (b24, cse), sB (b24, ece), sC (b23, cse)
 *   offerings o1 (sA, taught by f1), o2 (sB), o3 (sC, no enrolments → roster)
 *   hostel block h1
 */
export function graphFixture(): AudienceGraph {
  const g = emptyAudienceGraph('JIT');
  g.departments.set('cse', { name: 'Computer Science' });
  g.departments.set('ece', { name: 'Electronics' });
  g.programmes.set('btech', { name: 'B.Tech' });
  g.batches.set('b24', { name: '2024 Batch', programmeId: 'btech' });
  g.batches.set('b23', { name: '2023 Batch', programmeId: 'btech' });
  g.sections.set('sA', { name: 'A', batchId: 'b24', departmentId: 'cse' });
  g.sections.set('sB', { name: 'B', batchId: 'b24', departmentId: 'ece' });
  g.sections.set('sC', { name: 'C', batchId: 'b23', departmentId: 'cse' });
  g.offerings.set('o1', { label: 'CS201 · A', sectionId: 'sA', departmentId: 'cse', facultyIds: ['fac1'] });
  g.offerings.set('o2', { label: 'EC201 · B', sectionId: 'sB', departmentId: 'ece', facultyIds: ['fac9'] });
  g.offerings.set('o3', { label: 'CS301 · C', sectionId: 'sC', departmentId: 'cse', facultyIds: ['fac1'] });
  g.blocks.set('h1', { name: 'Krishna' });

  const add = (p: Partial<PersonNode> & Pick<PersonNode, 'personId' | 'kind'>) => g.people.set(p.personId, {
    accountId: null, personaCodes: [], isHod: false, sectionIds: [], offeringIds: [], labels: {}, ...p,
  });
  add({ personId: 's1', kind: 'student', accountId: 'a1', personaCodes: ['L-STU'], departmentId: 'cse', batchId: 'b24', sectionIds: ['sA'], offeringIds: ['o1'], hostelBlockId: 'h1', labels: { batch: '2024 Batch', section: 'A', department: 'Computer Science' } });
  add({ personId: 's2', kind: 'student', personaCodes: ['L-STU'], departmentId: 'ece', batchId: 'b24', sectionIds: ['sB'], offeringIds: ['o2'], labels: { batch: '2024 Batch', section: 'B', department: 'Electronics' } });
  add({ personId: 's3', kind: 'student', accountId: 'a3', personaCodes: ['L-STU'], departmentId: 'cse', batchId: 'b23', sectionIds: ['sC'], offeringIds: ['o3'], labels: { batch: '2023 Batch', section: 'C', department: 'Computer Science' } });
  add({ personId: 'f1', kind: 'faculty', accountId: 'a4', personaCodes: ['F-FAC'], departmentId: 'cse', offeringIds: ['o1', 'o3'], labels: { department: 'Computer Science' } });
  add({ personId: 'hod1', kind: 'faculty', personaCodes: ['F-HOD'], isHod: true, departmentId: 'cse', labels: { department: 'Computer Science' } });
  add({ personId: 'f2', kind: 'faculty', personaCodes: ['F-FAC'], departmentId: 'ece', labels: { department: 'Electronics' } });
  add({ personId: 'st1', kind: 'staff', accountId: 'a7', personaCodes: ['ST-EXAM'], labels: {} });
  add({ personId: 'st2', kind: 'staff', personaCodes: ['ST-ADM-TC'], departmentId: 'cse', labels: { department: 'Computer Science' } });
  return g;
}

export const ids = (people: PersonNode[]) => people.map((p) => p.personId);
```

- [ ] **Step 2: Write the failing audience tests**

```ts
// backend/src/modules/juvi-app/notices/__tests__/audience.test.ts
import { describe, it, expect } from 'vitest';
import { IAudienceRule } from '../../../../models/juvi/Notice';
import { resolveAudience, personMatchesRules, ruleChannelRefs, audienceLine, groupLabel } from '../audience';
import { graphFixture, ids } from './graph-fixture';

const g = graphFixture();
const r = (kind: IAudienceRule['kind'], list: string[] = [], departmentId?: string): IAudienceRule => ({ kind, ids: list, ...(departmentId ? { departmentId } : {}) });

describe('resolveAudience — one rule of each kind', () => {
  it('all reaches every student, faculty member and staff member', () => {
    expect(ids(resolveAudience([r('all')], g))).toEqual(['f1', 'f2', 'hod1', 's1', 's2', 's3', 'st1', 'st2']);
  });

  it('role resolves role words through account kind and hod, and persona codes through the persona chain', () => {
    expect(ids(resolveAudience([r('role', ['student'])], g))).toEqual(['s1', 's2', 's3']);
    expect(ids(resolveAudience([r('role', ['faculty'])], g))).toEqual(['f1', 'f2', 'hod1']);
    expect(ids(resolveAudience([r('role', ['staff'])], g))).toEqual(['st1', 'st2']);
    expect(ids(resolveAudience([r('role', ['hod'])], g))).toEqual(['hod1']);
    expect(ids(resolveAudience([r('role', ['ST-EXAM'])], g))).toEqual(['st1']);
    // ST-ADM matches its sub-persona ST-ADM-TC; ST-AD is not a family prefix.
    expect(ids(resolveAudience([r('role', ['ST-ADM'])], g))).toEqual(['st2']);
    expect(ids(resolveAudience([r('role', ['ST-AD'])], g))).toEqual([]);
  });

  it('a role rule with departmentId stays inside that department', () => {
    expect(ids(resolveAudience([r('role', ['faculty'], 'cse')], g))).toEqual(['f1', 'hod1']);
    expect(ids(resolveAudience([r('role', ['student', 'staff'], 'cse')], g))).toEqual(['s1', 's3', 'st2']);
  });

  it('department reaches its students, faculty and staff', () => {
    expect(ids(resolveAudience([r('department', ['cse'])], g))).toEqual(['f1', 'hod1', 's1', 's3', 'st2']);
  });

  it('programme resolves through the student batches', () => {
    expect(ids(resolveAudience([r('programme', ['btech'])], g))).toEqual(['s1', 's2', 's3']);
    expect(ids(resolveAudience([r('programme', ['mtech'])], g))).toEqual([]);
  });

  it('batch, section, course offering and hostel block reach students only', () => {
    expect(ids(resolveAudience([r('batch', ['b24'])], g))).toEqual(['s1', 's2']);
    expect(ids(resolveAudience([r('section', ['sC'])], g))).toEqual(['s3']);
    expect(ids(resolveAudience([r('course_offering', ['o1'])], g))).toEqual(['s1']);
    expect(ids(resolveAudience([r('course_offering', ['o3'])], g))).toEqual(['s3']);
    expect(ids(resolveAudience([r('hostel_block', ['h1'])], g))).toEqual(['s1']);
  });

  it('custom is an explicit list of person ids; unknown ids are ignored', () => {
    expect(ids(resolveAudience([r('custom', ['s2', 'st1', 'nobody'])], g))).toEqual(['s2', 'st1']);
  });
});

describe('resolveAudience — union', () => {
  it('unions rules and lists each person once', () => {
    const out = resolveAudience([r('batch', ['b24']), r('section', ['sA']), r('custom', ['s1', 'f2']), r('role', ['hod'])], g);
    expect(ids(out)).toEqual(['f2', 'hod1', 's1', 's2']);
    expect(new Set(ids(out)).size).toBe(out.length);
  });

  it('carries the account (or null for Not on Juvi) and the frozen labels', () => {
    const [s1, s2] = resolveAudience([r('batch', ['b24'])], g);
    expect(s1).toMatchObject({ personId: 's1', accountId: 'a1', labels: { batch: '2024 Batch', section: 'A', department: 'Computer Science' } });
    expect(s2).toMatchObject({ personId: 's2', accountId: null });
  });

  it('personMatchesRules answers the same question for one person', () => {
    const s3 = g.people.get('s3')!;
    expect(personMatchesRules([r('batch', ['b24']), r('section', ['sC'])], s3, g)).toBe(true);
    expect(personMatchesRules([r('batch', ['b24'])], s3, g)).toBe(false);
  });
});

describe('ruleChannelRefs', () => {
  it('maps all, department, batch, course_offering and hostel_block to channels and the rest to none', () => {
    expect(ruleChannelRefs([
      r('all'), r('department', ['cse']), r('batch', ['b24', 'b23']), r('course_offering', ['o1']), r('hostel_block', ['h1']),
      r('role', ['student']), r('programme', ['btech']), r('section', ['sA']), r('custom', ['s1']),
    ])).toEqual([
      { scopeType: 'college', scopeId: null },
      { scopeType: 'department', scopeId: 'cse' },
      { scopeType: 'batch', scopeId: 'b24' },
      { scopeType: 'batch', scopeId: 'b23' },
      { scopeType: 'course_offering', scopeId: 'o1' },
      { scopeType: 'hostel_block', scopeId: 'h1' },
    ]);
  });

  it('deduplicates repeated targets', () => {
    expect(ruleChannelRefs([r('batch', ['b24']), r('batch', ['b24'])])).toHaveLength(1);
  });
});

describe('audienceLine', () => {
  it('renders one target, several targets, and more than three', () => {
    expect(audienceLine([r('batch', ['b24'])], g)).toBe('Sent to 2024 Batch');
    expect(audienceLine([r('all')], g)).toBe('Sent to everyone at JIT');
    expect(audienceLine([r('department', ['cse']), r('section', ['sB'])], g)).toBe('Sent to Computer Science department and 2024 Batch section B');
    expect(audienceLine([r('role', ['faculty'], 'cse')], g)).toBe('Sent to faculty in Computer Science');
    expect(audienceLine([r('custom', ['s1'])], g)).toBe('Sent to 1 selected person');
    expect(audienceLine([r('course_offering', ['o1', 'o2', 'o3']), r('hostel_block', ['h1'])], g)).toBe('Sent to CS201 · A, EC201 · B and 2 more');
  });
});

describe('groupLabel', () => {
  it('groups students by batch and section, faculty and staff by department', () => {
    expect(groupLabel('student', { batch: '2024 Batch', section: 'A' })).toBe('2024 Batch · Section A');
    expect(groupLabel('student', { batch: '2024 Batch' })).toBe('2024 Batch');
    expect(groupLabel('student', {})).toBe('Students without a batch');
    expect(groupLabel('faculty', { department: 'Computer Science' })).toBe('Faculty · Computer Science');
    expect(groupLabel('staff', {})).toBe('Staff');
  });
});
```

- [ ] **Step 3: Write the failing scope and office tests**

```ts
// backend/src/modules/juvi-app/notices/__tests__/scope.test.ts
import { describe, it, expect } from 'vitest';
import { IAudienceRule } from '../../../../models/juvi/Notice';
import { assertAudienceInScope, narrowToScope, allowedTargets, PublisherScope } from '../scope';
import { graphFixture } from './graph-fixture';

const g = graphFixture();
const r = (kind: IAudienceRule['kind'], list: string[] = [], departmentId?: string): IAudienceRule => ({ kind, ids: list, ...(departmentId ? { departmentId } : {}) });
const scope = (p: Partial<PublisherScope>): PublisherScope => ({ kind: 'none', userId: 'u', office: 'X', isAdmin: false, offeringIds: [], ...p });

const college = scope({ kind: 'college', office: 'Exam Section' });
const hod = scope({ kind: 'department', departmentId: 'cse', office: 'HOD, Computer Science' });
const faculty = scope({ kind: 'offerings', offeringIds: ['o1'], office: 'Course Faculty' });
const nobody = scope({ kind: 'none' });

const ok = (s: PublisherScope, rules: IAudienceRule[]) => expect(() => assertAudienceInScope(s, rules, g)).not.toThrow();
const refused = (s: PublisherScope, rules: IAudienceRule[], msg?: RegExp) => {
  let caught: unknown;
  try { assertAudienceInScope(s, rules, g); } catch (e) { caught = e; }
  expect(caught).toMatchObject({ statusCode: 403 });
  if (msg) expect((caught as Error).message).toMatch(msg);
};

describe('assertAudienceInScope — admin, principal and staff offices', () => {
  it('allow every rule kind', () => {
    ok(college, [r('all')]);
    ok(college, [r('role', ['student']), r('department', ['ece']), r('programme', ['btech']), r('batch', ['b24']), r('section', ['sB']), r('course_offering', ['o2']), r('hostel_block', ['h1']), r('custom', ['s2'])]);
  });
});

describe('assertAudienceInScope — HOD', () => {
  it('allows the own department, its sections, courses, a whole-department batch, a pinned role and own people', () => {
    ok(hod, [r('department', ['cse'])]);
    ok(hod, [r('section', ['sA', 'sC'])]);
    ok(hod, [r('course_offering', ['o1', 'o3'])]);
    ok(hod, [r('batch', ['b23'])]);                       // every b23 student is in CSE
    ok(hod, [r('role', ['faculty'], 'cse')]);
    ok(hod, [r('custom', ['s1', 'f1', 'st2'])]);
  });

  it('refuses another department, a mixed batch, an unpinned role, outside people and college-wide kinds', () => {
    refused(hod, [r('department', ['ece'])], /own department/);
    refused(hod, [r('section', ['sB'])], /outside your department/);
    refused(hod, [r('course_offering', ['o2'])], /outside your department/);
    refused(hod, [r('batch', ['b24'])], /sections instead/);  // b24 includes ECE students
    refused(hod, [r('batch', ['unknown'])]);
    refused(hod, [r('role', ['faculty'])], /within your department/);
    refused(hod, [r('role', ['faculty'], 'ece')]);
    refused(hod, [r('custom', ['s1', 's2'])], /outside your department/);
    refused(hod, [r('all')]);
    refused(hod, [r('programme', ['btech'])]);
    refused(hod, [r('hostel_block', ['h1'])]);
  });

  it('checks every rule, not just the first', () => {
    refused(hod, [r('department', ['cse']), r('section', ['sB'])]);
  });
});

describe('assertAudienceInScope — teaching faculty', () => {
  it('allows own course offerings and people enrolled in them', () => {
    ok(faculty, [r('course_offering', ['o1'])]);
    ok(faculty, [r('custom', ['s1'])]);
  });

  it('refuses other offerings, other people and every other kind', () => {
    refused(faculty, [r('course_offering', ['o1', 'o3'])], /courses you teach/);
    refused(faculty, [r('custom', ['s3'])], /not enrolled in your courses/);
    refused(faculty, [r('custom', ['f2'])]);
    refused(faculty, [r('section', ['sA'])]);
    refused(faculty, [r('department', ['cse'])]);
    refused(faculty, [r('all')]);
  });
});

describe('assertAudienceInScope — anyone else', () => {
  it('refuses everything', () => {
    refused(nobody, [r('custom', ['s1'])], /cannot publish/);
    refused(nobody, [r('all')]);
  });
});

describe('narrowToScope', () => {
  it('pins an HOD role rule to the own department and leaves everything else untouched', () => {
    const rules = [r('role', ['faculty']), r('section', ['sA'])];
    expect(narrowToScope(hod, rules)).toEqual([r('role', ['faculty'], 'cse'), r('section', ['sA'])]);
    expect(rules[0]).toEqual(r('role', ['faculty']));   // not mutated
    expect(narrowToScope(college, rules)).toEqual(rules);
    expect(narrowToScope(faculty, rules)).toEqual(rules);
  });
});

describe('allowedTargets', () => {
  it('offers the whole college to an office', () => {
    const t = allowedTargets(college, g);
    expect(t.kinds).toEqual(['all', 'role', 'department', 'programme', 'batch', 'section', 'course_offering', 'hostel_block', 'custom']);
    expect(t.roles).toEqual(['student', 'faculty', 'staff', 'hod']);
    expect(t.departments.map((d) => d.id)).toEqual(['cse', 'ece']);
    expect(t.batches).toEqual([{ id: 'b23', label: '2023 Batch' }, { id: 'b24', label: '2024 Batch' }]);
    expect(t.sections.map((s) => s.label)).toEqual(['2023 Batch · Section C', '2024 Batch · Section A', '2024 Batch · Section B']);
    expect(t.courseOfferings).toHaveLength(3);
    expect(t.hostelBlocks).toEqual([{ id: 'h1', label: 'Krishna' }]);
  });

  it('offers an HOD only the own department', () => {
    const t = allowedTargets(hod, g);
    expect(t.kinds).toEqual(['role', 'department', 'batch', 'section', 'course_offering', 'custom']);
    expect(t.roles).toEqual(['student', 'faculty', 'staff']);
    expect(t.departments).toEqual([{ id: 'cse', label: 'Computer Science' }]);
    expect(t.batches.map((b) => b.id)).toEqual(['b23']);
    expect(t.sections.map((s) => s.id)).toEqual(['sC', 'sA']);
    expect(t.courseOfferings.map((o) => o.id)).toEqual(['o1', 'o3']);
    expect(t.programmes).toEqual([]);
    expect(t.hostelBlocks).toEqual([]);
  });

  it('offers teaching faculty only their offerings, and nobody nothing', () => {
    expect(allowedTargets(faculty, g)).toMatchObject({ kinds: ['course_offering', 'custom'], roles: [], courseOfferings: [{ id: 'o1', label: 'CS201 · A' }], departments: [] });
    expect(allowedTargets(nobody, g)).toMatchObject({ kinds: [], courseOfferings: [], departments: [] });
  });
});
```

```ts
// backend/src/modules/juvi-app/notices/__tests__/offices.test.ts
import { describe, it, expect } from 'vitest';
import { officeForPersonas, OFFICE_NAMES, OFFICE_PERSONA_CODES, COLLEGE_OFFICE, hodOffice } from '../offices';

describe('offices', () => {
  it('maps each staff office persona, and its sub-personas, to plain office words', () => {
    expect(officeForPersonas(['ST-EXAM'])).toBe('Exam Section');
    expect(officeForPersonas(['ST-ACC'])).toBe('Finance');
    expect(officeForPersonas(['ST-ADM-TC'])).toBe('Admissions');
    expect(officeForPersonas(['ST-TPO'])).toBe('Placement');
    expect(officeForPersonas(['ST-WARDEN'])).toBe('Welfare');
    expect(officeForPersonas(['ST-SEC'])).toBe('Campus Ops');
    expect(officeForPersonas(['ST-REG'])).toBe('Registrar');
  });

  it('returns null for personas that are not an office', () => {
    expect(officeForPersonas(['ST-HR'])).toBeNull();
    expect(officeForPersonas(['ST-ACOPS-CC'])).toBeNull();   // ST-ACC is not a prefix of ST-ACOPS
    expect(officeForPersonas([])).toBeNull();
  });

  it('lists the offices an admin may choose, college office first, without duplicates', () => {
    expect(OFFICE_NAMES[0]).toBe(COLLEGE_OFFICE);
    expect(new Set(OFFICE_NAMES).size).toBe(OFFICE_NAMES.length);
    expect(OFFICE_NAMES).toEqual(expect.arrayContaining(['Exam Section', 'Finance', 'Admissions', 'Placement', 'Welfare', 'Campus Ops', 'Registrar']));
    expect(OFFICE_PERSONA_CODES).toContain('ST-TRANSPORT-OFFICER');
    expect(hodOffice('Computer Science')).toBe('HOD, Computer Science');
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/notices`
Expected: FAIL with "Cannot find module '../audience'", "Cannot find module '../scope'" and "Cannot find module '../offices'".

- [ ] **Step 5: Implement `offices.ts`**

```ts
// backend/src/modules/juvi-app/notices/offices.ts
/**
 * The "office" a notice is published from, in plain words (spec §5 `publisher.office`).
 * Staff office personas map to fixed words; admins pick one of OFFICE_NAMES.
 */
export const COLLEGE_OFFICE = 'College Office';
export const PRINCIPAL_OFFICE = "Principal's Office";
export const FACULTY_OFFICE = 'Course Faculty';

/** Persona code → office. A code also covers its sub-personas (ST-ADM covers ST-ADM-TC). */
export const OFFICE_PERSONAS: Readonly<Record<string, string>> = {
  'ST-EXAM': 'Exam Section',
  'ST-ACC': 'Finance',
  'ST-ADM': 'Admissions',
  'ST-TPO': 'Placement',
  'ST-WARDEN': 'Welfare',
  'ST-TRANSPORT-OFFICER': 'Campus Ops',
  'ST-SEC': 'Campus Ops',
  'ST-LIB': 'Campus Ops',
  'ST-REG': 'Registrar',
};

export const OFFICE_PERSONA_CODES: readonly string[] = Object.keys(OFFICE_PERSONAS);

export const OFFICE_NAMES: readonly string[] = [COLLEGE_OFFICE, PRINCIPAL_OFFICE, ...new Set(Object.values(OFFICE_PERSONAS))];

const inFamily = (code: string, family: string) => code === family || code.startsWith(`${family}-`);

/** The office for the first persona that is a staff office, or null. */
export function officeForPersonas(codes: string[]): string | null {
  for (const code of codes) {
    for (const family of OFFICE_PERSONA_CODES) if (inFamily(code, family)) return OFFICE_PERSONAS[family]!;
  }
  return null;
}

export function hodOffice(departmentName: string): string {
  return `HOD, ${departmentName}`;
}
```

- [ ] **Step 6: Implement `audience.ts`**

```ts
// backend/src/modules/juvi-app/notices/audience.ts
/**
 * Audience resolution for Juvi notices (spec §6.4). Pure functions over an
 * AudienceGraph, which audience-graph.ts loads from ERP people: every active
 * student, faculty member and staff member, whether or not they are on Juvi.
 */
import { AccountKind } from '../../../models/juvi/JuviAccount';
import { IAudienceRule, AudienceRuleKind } from '../../../models/juvi/Notice';
import { IRecipientLabels } from '../../../models/juvi/NoticeRecipient';
import { ChannelScopeType } from '../../../models/juvi/ChannelTemplate';
import { ChannelRef } from '../spaces/strategies';

export interface PersonNode {
  personId: string;
  kind: AccountKind;
  /** The person's Juvi account while it is `active` ("on Juvi"); null otherwise ("Not on Juvi"). */
  accountId: string | null;
  /** Persona codes the person holds (User personas plus Staff.personaCode). */
  personaCodes: string[];
  isHod: boolean;
  /** Students: the department of their branch. Faculty and staff: their own department. */
  departmentId?: string;
  batchId?: string;
  sectionIds: string[];
  /** Students: offerings they are enrolled in, or on the roster of when an offering has no enrolments. Faculty: offerings they teach. */
  offeringIds: string[];
  hostelBlockId?: string;
  labels: IRecipientLabels;
}

export interface AudienceGraph {
  collegeName: string;
  people: Map<string, PersonNode>;
  departments: Map<string, { name: string }>;
  programmes: Map<string, { name: string }>;
  batches: Map<string, { name: string; programmeId?: string }>;
  sections: Map<string, { name: string; batchId: string; departmentId?: string }>;
  offerings: Map<string, { label: string; sectionId: string; departmentId?: string; facultyIds: string[] }>;
  blocks: Map<string, { name: string }>;
}

/** Words a `role` rule may name besides persona codes. */
export const ROLE_WORDS = ['student', 'faculty', 'staff', 'hod'] as const;

export function emptyAudienceGraph(collegeName = ''): AudienceGraph {
  return {
    collegeName, people: new Map(), departments: new Map(), programmes: new Map(),
    batches: new Map(), sections: new Map(), offerings: new Map(), blocks: new Map(),
  };
}

function holdsRole(p: PersonNode, id: string): boolean {
  if (id === 'student' || id === 'faculty' || id === 'staff') return p.kind === id;
  if (id === 'hod') return p.isHod;
  // A persona code matches itself and its sub-personas (ST-ADM matches ST-ADM-TC).
  return p.personaCodes.some((c) => c === id || c.startsWith(`${id}-`));
}

const has = (list: string[], v: string | undefined): boolean => v !== undefined && list.includes(v);
const overlaps = (a: string[], b: string[]): boolean => a.some((x) => b.includes(x));

export function personMatchesRule(rule: IAudienceRule, p: PersonNode, g: AudienceGraph): boolean {
  const student = p.kind === 'student';
  switch (rule.kind) {
    case 'all': return true;
    case 'role': return rule.ids.some((id) => holdsRole(p, id)) && (!rule.departmentId || p.departmentId === rule.departmentId);
    case 'department': return has(rule.ids, p.departmentId);
    case 'programme': return student && has(rule.ids, p.batchId ? g.batches.get(p.batchId)?.programmeId : undefined);
    case 'batch': return student && has(rule.ids, p.batchId);
    case 'section': return student && overlaps(p.sectionIds, rule.ids);
    case 'course_offering': return student && overlaps(p.offeringIds, rule.ids);
    case 'hostel_block': return student && has(rule.ids, p.hostelBlockId);
    case 'custom': return rule.ids.includes(p.personId);
    default: return false;
  }
}

export function personMatchesRules(rules: IAudienceRule[], p: PersonNode, g: AudienceGraph): boolean {
  return rules.some((r) => personMatchesRule(r, p, g));
}

/** The union of the rules, each person once, sorted by personId so fan-out batches are deterministic. */
export function resolveAudience(rules: IAudienceRule[], g: AudienceGraph): PersonNode[] {
  return [...g.people.values()]
    .filter((p) => personMatchesRules(rules, p, g))
    .sort((a, b) => (a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0));
}

const CHANNEL_SCOPE: Partial<Record<AudienceRuleKind, ChannelScopeType>> = {
  department: 'department', batch: 'batch', course_offering: 'course_offering', hostel_block: 'hostel_block',
};

/** Channels whose scope equals a rule (spec §6.4): all → college; department, batch, course_offering, hostel_block → their channel. */
export function ruleChannelRefs(rules: IAudienceRule[]): ChannelRef[] {
  const out = new Map<string, ChannelRef>();
  for (const r of rules) {
    if (r.kind === 'all') out.set('college:', { scopeType: 'college', scopeId: null });
    const scopeType = CHANNEL_SCOPE[r.kind];
    if (scopeType) for (const id of r.ids) out.set(`${scopeType}:${id}`, { scopeType, scopeId: id });
  }
  return [...out.values()];
}

const ROLE_PHRASE: Record<string, string> = { student: 'all students', faculty: 'all faculty', staff: 'all staff', hod: 'all HODs' };

function rulePhrases(r: IAudienceRule, g: AudienceGraph): string[] {
  const name = (m: Map<string, { name: string }>, id: string, fallback: string) => m.get(id)?.name ?? fallback;
  switch (r.kind) {
    case 'all': return [`everyone at ${g.collegeName || 'the college'}`];
    case 'role': {
      const words = r.ids.map((id) => ROLE_PHRASE[id] ?? id);
      if (!r.departmentId) return words;
      const dept = name(g.departments, r.departmentId, 'the department');
      return words.map((w) => `${w.replace(/^all /, '')} in ${dept}`);
    }
    case 'department': return r.ids.map((id) => `${name(g.departments, id, 'a department')} department`);
    case 'programme': return r.ids.map((id) => `${name(g.programmes, id, 'a programme')} programme`);
    case 'batch': return r.ids.map((id) => name(g.batches, id, 'a batch'));
    case 'section': return r.ids.map((id) => {
      const s = g.sections.get(id);
      return s ? `${g.batches.get(s.batchId)?.name ?? 'Batch'} section ${s.name}` : 'a section';
    });
    case 'course_offering': return r.ids.map((id) => g.offerings.get(id)?.label ?? 'a course');
    case 'hostel_block': return r.ids.map((id) => `${name(g.blocks, id, 'a')} hostel`);
    case 'custom': return [`${r.ids.length} selected ${r.ids.length === 1 ? 'person' : 'people'}`];
    default: return [];
  }
}

/** "Sent to CSE 2024 batch" — the line shown on the card and in the ERP list (spec §5 `audience.line`). */
export function audienceLine(rules: IAudienceRule[], g: AudienceGraph): string {
  const phrases = rules.flatMap((r) => rulePhrases(r, g));
  if (phrases.length === 0) return 'Sent to nobody';
  const shown = phrases.length > 3 ? [...phrases.slice(0, 2), `${phrases.length - 2} more`] : phrases;
  const joined = shown.length === 1 ? shown[0]! : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return `Sent to ${joined}`;
}

/** Reach groups (spec §4 US-4.2): students by batch and section, faculty and staff by department. */
export function groupLabel(kind: AccountKind, labels: IRecipientLabels): string {
  if (kind === 'student') {
    return [labels.batch, labels.section ? `Section ${labels.section}` : undefined].filter(Boolean).join(' · ') || 'Students without a batch';
  }
  const who = kind === 'faculty' ? 'Faculty' : 'Staff';
  return labels.department ? `${who} · ${labels.department}` : who;
}
```

- [ ] **Step 7: Implement `scope.ts`**

```ts
// backend/src/modules/juvi-app/notices/scope.ts
/**
 * Publisher scope (spec §7.3). Pure: the caller loads the PublisherScope
 * (publisher-scope.ts) and the AudienceGraph (audience-graph.ts). The composer
 * offers only allowedTargets(); publish and preview both run assertAudienceInScope.
 */
import { AppError } from '../../../middleware/errorHandler';
import { IAudienceRule, AudienceRuleKind, AUDIENCE_RULE_KINDS } from '../../../models/juvi/Notice';
import { AudienceGraph, PersonNode, ROLE_WORDS, personMatchesRule } from './audience';

export type PublisherKind = 'college' | 'department' | 'offerings' | 'none';

export interface PublisherScope {
  /** college: admin, principal and staff offices · department: HOD · offerings: teaching faculty · none: anyone else. */
  kind: PublisherKind;
  userId: string;
  personId?: string;
  office: string;
  /** admin, principal or super_admin: sees every notice and every reach in the college. */
  isAdmin: boolean;
  departmentId?: string;
  offeringIds: string[];
}

export interface TargetOption { id: string; label: string }
export interface AudienceTargets {
  kinds: AudienceRuleKind[];
  roles: string[];
  departments: TargetOption[];
  programmes: TargetOption[];
  batches: TargetOption[];
  sections: TargetOption[];
  courseOfferings: TargetOption[];
  hostelBlocks: TargetOption[];
}

const refuse = (message: string) => new AppError(403, message);

/** Server-side narrowing before the scope check: an HOD's `role` rules are pinned to their department. */
export function narrowToScope(scope: PublisherScope, rules: IAudienceRule[]): IAudienceRule[] {
  return rules.map((r) => (scope.kind === 'department' && r.kind === 'role' ? { ...r, departmentId: scope.departmentId } : { ...r }));
}

function membersOf(rule: IAudienceRule, g: AudienceGraph): PersonNode[] {
  return [...g.people.values()].filter((p) => personMatchesRule(rule, p, g));
}

/** A batch is within a department when it has members and every member belongs to that department. */
function batchInDepartment(batchId: string, departmentId: string, g: AudienceGraph): boolean {
  const members = membersOf({ kind: 'batch', ids: [batchId] }, g);
  return members.length > 0 && members.every((p) => p.departmentId === departmentId);
}

function assertDepartmentRules(departmentId: string | undefined, rules: IAudienceRule[], g: AudienceGraph): void {
  const inDept = (id: string | undefined) => Boolean(departmentId) && id === departmentId;
  for (const r of rules) {
    switch (r.kind) {
      case 'department':
        if (!r.ids.every((id) => inDept(id))) throw refuse('You can only send notices to your own department.');
        break;
      case 'section':
        if (!r.ids.every((id) => inDept(g.sections.get(id)?.departmentId))) throw refuse('That section is outside your department.');
        break;
      case 'course_offering':
        if (!r.ids.every((id) => inDept(g.offerings.get(id)?.departmentId))) throw refuse('That course is outside your department.');
        break;
      case 'batch':
        if (!r.ids.every((id) => batchInDepartment(id, departmentId ?? '', g))) {
          throw refuse('That batch includes students outside your department. Choose its sections instead.');
        }
        break;
      case 'role':
        if (!inDept(r.departmentId)) throw refuse('A role audience must stay within your department.');
        break;
      case 'custom':
        if (!r.ids.every((id) => inDept(g.people.get(id)?.departmentId))) throw refuse('Some selected people are outside your department.');
        break;
      default:
        throw refuse('You can only send notices to your own department.');
    }
  }
}

function assertOfferingRules(offeringIds: string[], rules: IAudienceRule[], g: AudienceGraph): void {
  const mine = new Set(offeringIds);
  for (const r of rules) {
    if (r.kind === 'course_offering') {
      if (!r.ids.every((id) => mine.has(id))) throw refuse('You can only send notices to the courses you teach.');
    } else if (r.kind === 'custom') {
      const enrolled = (id: string) => { const p = g.people.get(id); return p?.kind === 'student' && p.offeringIds.some((o) => mine.has(o)); };
      if (!r.ids.every(enrolled)) throw refuse('Some selected people are not enrolled in your courses.');
    } else {
      throw refuse('You can only send notices to the courses you teach.');
    }
  }
}

/** Throws AppError(403) when any rule is outside the publisher's scope. Run it on narrowed rules. */
export function assertAudienceInScope(scope: PublisherScope, rules: IAudienceRule[], g: AudienceGraph): void {
  switch (scope.kind) {
    case 'college': return;
    case 'department': return assertDepartmentRules(scope.departmentId, rules, g);
    case 'offerings': return assertOfferingRules(scope.offeringIds, rules, g);
    default: throw refuse('You cannot publish notices.');
  }
}

const byLabel = (a: TargetOption, b: TargetOption) => a.label.localeCompare(b.label);
const options = (m: Map<string, { name: string }>, keep: (id: string) => boolean = () => true): TargetOption[] =>
  [...m.entries()].filter(([id]) => keep(id)).map(([id, v]) => ({ id, label: v.name })).sort(byLabel);

/** What the composer may offer this publisher (the same rules assertAudienceInScope enforces). */
export function allowedTargets(scope: PublisherScope, g: AudienceGraph): AudienceTargets {
  const none: AudienceTargets = { kinds: [], roles: [], departments: [], programmes: [], batches: [], sections: [], courseOfferings: [], hostelBlocks: [] };
  const sectionLabel = (id: string) => { const s = g.sections.get(id)!; return `${g.batches.get(s.batchId)?.name ?? 'Batch'} · Section ${s.name}`; };
  const sections = (keep: (id: string) => boolean) => [...g.sections.keys()].filter(keep).map((id) => ({ id, label: sectionLabel(id) })).sort(byLabel);
  const offerings = (keep: (id: string) => boolean) => [...g.offerings.entries()].filter(([id]) => keep(id)).map(([id, o]) => ({ id, label: o.label })).sort(byLabel);

  switch (scope.kind) {
    case 'college':
      return {
        kinds: [...AUDIENCE_RULE_KINDS], roles: [...ROLE_WORDS],
        departments: options(g.departments), programmes: options(g.programmes), batches: options(g.batches),
        sections: sections(() => true), courseOfferings: offerings(() => true), hostelBlocks: options(g.blocks),
      };
    case 'department': {
      const dep = scope.departmentId ?? '';
      return {
        ...none,
        kinds: ['role', 'department', 'batch', 'section', 'course_offering', 'custom'],
        roles: ['student', 'faculty', 'staff'],
        departments: options(g.departments, (id) => id === dep),
        batches: options(g.batches, (id) => batchInDepartment(id, dep, g)),
        sections: sections((id) => g.sections.get(id)?.departmentId === dep),
        courseOfferings: offerings((id) => g.offerings.get(id)?.departmentId === dep),
      };
    }
    case 'offerings': {
      const mine = new Set(scope.offeringIds);
      return { ...none, kinds: ['course_offering', 'custom'], courseOfferings: offerings((id) => mine.has(id)) };
    }
    default:
      return none;
  }
}
```

- [ ] **Step 8: Run the tests and typecheck**

Run: `cd backend && npx vitest run src/modules/juvi-app/notices && npm run typecheck`
Expected: PASS (audience 14 tests, scope 11 tests, offices 3 tests); typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/juvi-app/notices backend/src/models/juvi/Notice.ts
git commit -m "feat(juvi-app): pure notice audience resolution, rule-to-channel mapping and publisher scope

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

This task relies on `departmentId` on `IAudienceRule` and `ruleSchema` (Task 2). If Task 2 was committed without it, add `departmentId?: string` to the interface and `departmentId: String` to `ruleSchema` in `backend/src/models/juvi/Notice.ts` as part of this commit.

---

### Task 4: Audience graph, publisher scope loader, publish, attachment upload, preview and the fan-out consumer

**Files:**
- Create: `backend/src/modules/juvi-app/notices/audience-graph.ts`, `backend/src/modules/juvi-app/notices/publisher-scope.ts`, `backend/src/modules/juvi-app/notices/admin-schemas.ts`, `backend/src/modules/juvi-app/notices/publish-service.ts`, `backend/src/modules/juvi-app/notices/consumers.ts`, `backend/src/__e2e__/factories/notice.factory.ts`
- Modify: `backend/src/modules/juvi-app/routes.ts:1-11` (register the consumers)
- Test: `backend/src/__e2e__/modules/juvi-notices-publish.e2e.test.ts`, `backend/src/__e2e__/modules/juvi-notices-fanout-5000.e2e.test.ts`

**Interfaces:**
- Consumes: `resolveAudience`, `audienceLine`, `groupLabel`, `ruleChannelRefs`, `PersonNode`, `AudienceGraph`, `emptyAudienceGraph` (Task 3 `audience.ts`); `PublisherScope`, `narrowToScope`, `assertAudienceInScope` (Task 3 `scope.ts`); `COLLEGE_OFFICE`, `PRINCIPAL_OFFICE`, `FACULTY_OFFICE`, `OFFICE_NAMES`, `officeForPersonas`, `hodOffice` (Task 3 `offices.ts`); `emit`, `kick`, `registerConsumer`, `registerSweeper`, `drainOutbox`, `OutboxPayload`, `OutboxEvent` (Task 1 `shared/outbox`); `Notice`, `LeanNotice`, `NoticeRecipient` and the `NOTICE_*` constants (Task 2); `isS3Configured`, `putObject` (`shared/s3/s3-client.ts:147,154` — `putObject` always sets `ServerSideEncryption: 'AES256'`); `createAuditLog` (`shared/audit.ts:52`); `Channel` (`models/juvi/Channel.ts`); `objectId` (`modules/juvi-app/admin/schemas.ts:4`); `transitionAccount` (`accounts/provisioning-service.ts:178`); `reconcileCollege` (`spaces/reconcile-service.ts:108`); e2e helpers `getTestApp`, `cleanupTestApp`, `seedBase`, `enableJuvi`, `provisionTestStudent`, `provisionTestFaculty`, `mobileClient`, `TEST_DEVICE`, `createTestUser`, `createAuthToken`, `createTestFaculty`, `createTestCourse`, `createTestCourseOffering`, `createTestEnrollment`.
- Produces:
  ```ts
  // audience-graph.ts
  export const AUDIENCE_STUDENT_STATUSES: readonly string[];   // active, year_back, detained
  export const AUDIENCE_EMPLOYEE_STATUSES: readonly string[];  // active, on_leave
  export function loadAudienceGraph(collegeId: string, opts?: { personIds?: string[] }): Promise<AudienceGraph>;
  // publisher-scope.ts
  export interface ErpUserRef { id: string; role: string; personaType?: string; personas?: string[] }
  export const ADMIN_ROLES: ReadonlySet<string>;               // admin, super_admin, principal
  export function resolvePublisherScope(collegeId: string, user: ErpUserRef, officeOverride?: string): Promise<PublisherScope>;
  // admin-schemas.ts
  export const audienceRuleSchema, audienceSchema, noticeAttachmentInputSchema, publishSchema, audiencePreviewSchema;
  export type PublishInput = z.infer<typeof publishSchema>;
  // publish-service.ts
  export const NOTICE_EVENTS: { published: 'notice.published'; reminder: 'notice.reminder'; acknowledged: 'notice.acknowledged'; archived: 'notice.archived' };
  export const noticeEventKey: { published(id: string): string; archived(id: string): string; reminder(id: string, n: number): string; acknowledged(id: string, personId: string): string };
  export function attachmentPrefix(collegeId: string): string;  // colleges/<cid>/notices/
  export interface UploadedFile { buffer: Buffer; originalname: string; mimetype: string; size: number }
  export interface AudiencePreview { total: number; onJuvi: number; notOnJuvi: number; groups: { label: string; total: number; onJuvi: number }[]; line: string }
  export function uploadAttachment(collegeId: string, file: UploadedFile): Promise<INoticeAttachment>;
  export function previewAudience(collegeId: string, scope: PublisherScope, rules: IAudienceRule[]): Promise<AudiencePreview>;
  export function channelIdsForRules(collegeId: string, rules: IAudienceRule[]): Promise<Types.ObjectId[]>;
  export function publishNotice(collegeId: string, scope: PublisherScope, input: PublishInput, performedBy: string): Promise<LeanNotice>;
  // consumers.ts
  export const FANOUT_BATCH_SIZE = 1000; export const STUCK_PUBLISHING_MS = 120_000;
  export function fanOutNotice(payload: OutboxPayload): Promise<void>;
  export function sweepStuckNotices(now?: Date): Promise<number>;
  export function registerNoticeConsumers(): void;
  // __e2e__/factories/notice.factory.ts
  export function adminRef(fx: BaseFixtures): ErpUserRef;
  export function erpRef(user: { _id: unknown; role: string; personaType: string; personas?: string[] }): ErpUserRef;
  export function activateAccount(accountId: string): Promise<void>;
  export function createStaffPublisher(fx: BaseFixtures, personaCode: string): Promise<{ person: any; staff: any; user: any; token: string }>;
  export function makeHod(fx: BaseFixtures, department: { _id: unknown }): Promise<{ person: any; faculty: any; user: any; token: string }>;
  export function publishTestNotice(fx: BaseFixtures, overrides?: Record<string, unknown>, publisher?: ErpUserRef): Promise<LeanNotice>;
  export function signInAs(app: Express, fx: BaseFixtures, identifier: string, password: string, deviceId?: string): Promise<string>;
  ```

Decisions that bind later tasks:
- "On Juvi" means a `JuviAccount` with `status: 'active'` (Global Constraints). The audience graph reads only those; an onboarding account's rows get `accountId` when it activates (Task 10) or, for the welcome notice, when it opens step 4 (Task 9).
- Attachment keys must sit under `colleges/<cid>/notices/` with no further `/`, so a publisher cannot attach another college's object or an arbitrary bucket key.
- Publishing requires a non-empty audience (400 `This audience has no members`); a `purpose: 'welcome'` notice requires a college-wide publisher (403).
- Audit rows for a notice use `entityType: 'Notice'` (or `NoticeAcknowledgement`, `NoticeReach` in Tasks 6–7) with `entityId` = the notice id and `entityName: 'Notice from <office>'`, never the title (spec §10: title, body and comment are never logged).
- The sweeper enumerates stuck notices across colleges with `Notice.distinct('collegeId', …)` and then queries per college, the way `reconcileAllEnabledColleges` enumerates colleges.

- [ ] **Step 1: Write the e2e factory**

```ts
// backend/src/__e2e__/factories/notice.factory.ts
import type { Express } from 'express';
import { Person, Staff, Department } from '../../models';
import { User } from '../../models/User';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { Notice, LeanNotice } from '../../models/juvi/Notice';
import { drainOutbox } from '../../shared/outbox';
import type { BaseFixtures } from '../setup/seed-base';
import { createTestUser, createAuthToken } from './user.factory';
import { createTestFaculty } from './academic.factory';
import { mobileClient, TEST_DEVICE } from './juvi.factory';
import { transitionAccount } from '../../modules/juvi-app/accounts/provisioning-service';
import { resolvePublisherScope, ErpUserRef } from '../../modules/juvi-app/notices/publisher-scope';
import { publishNotice } from '../../modules/juvi-app/notices/publish-service';
import { publishSchema } from '../../modules/juvi-app/notices/admin-schemas';

let staffCounter = 0;

export function erpRef(user: { _id: unknown; role: string; personaType: string; personas?: string[] }): ErpUserRef {
  return { id: String(user._id), role: user.role, personaType: user.personaType, personas: user.personas ?? [user.personaType] };
}

export function adminRef(fx: BaseFixtures): ErpUserRef {
  return erpRef(fx.admin.user);
}

/** Moves an account to `active` through the real transition (which back-fills recipient rows from Task 10 on). */
export async function activateAccount(accountId: string): Promise<void> {
  const account = await JuviAccount.findById(accountId);
  if (!account) throw new Error(`No account ${accountId}`);
  await transitionAccount(account, 'active', 'admin', 'test');
}

/** A staff member with an ERP login holding `personaCode` (e.g. ST-EXAM). */
export async function createStaffPublisher(fx: BaseFixtures, personaCode: string) {
  staffCounter += 1;
  const person = await Person.create({ collegeId: fx.collegeId, name: `${personaCode} Officer ${staffCounter}`, phone: `96000${String(staffCounter).padStart(5, '0')}` });
  const staff = await Staff.create({ collegeId: fx.collegeId, personId: person._id, employeeCode: `STF${String(staffCounter).padStart(4, '0')}`, designation: 'Officer', staffType: 'administrative', personaCode, status: 'active' });
  const { user, token } = await createTestUser({ collegeId: fx.collegeId, role: 'staff', personaType: personaCode, name: person.name, email: `staff${staffCounter}@test.com`, personId: String(person._id) });
  return { person, staff, user, token };
}

/** A faculty member who heads `department`, with an HOD login. */
export async function makeHod(fx: BaseFixtures, department: { _id: unknown }) {
  const f = await createTestFaculty(fx.collegeId, { departmentId: String(department._id) });
  await Department.updateOne({ _id: department._id, collegeId: fx.collegeId }, { $set: { hodId: f.faculty._id } });
  await User.updateOne({ _id: f.user._id }, { $set: { role: 'hod', personaType: 'F-HOD', personas: ['F-HOD'] } });
  const user = (await User.findById(f.user._id))!;
  const token = createAuthToken({ id: String(user._id), name: user.name, email: user.email, role: 'hod', personaType: 'F-HOD', personas: ['F-HOD'], tv: user.tokenVersion, collegeId: fx.collegeId });
  return { person: f.person, faculty: f.faculty, user, token };
}

/** Publishes through the service as `publisher` (default: the college admin) and waits for the fan-out. */
export async function publishTestNotice(fx: BaseFixtures, overrides: Record<string, unknown> = {}, publisher: ErpUserRef = adminRef(fx)): Promise<LeanNotice> {
  const input = publishSchema.parse({
    title: 'Exam timetable', body: 'The mid-semester timetable is attached.',
    audience: { rules: [{ kind: 'batch', ids: [String(fx.batch._id)] }] },
    ...overrides,
  });
  const scope = await resolvePublisherScope(fx.collegeId, publisher, input.office);   // the office override only applies to admins
  const notice = await publishNotice(fx.collegeId, scope, input, 'test');
  await drainOutbox();
  return (await Notice.findById(notice._id).lean<LeanNotice>())!;
}

export async function signInAs(app: Express, fx: BaseFixtures, identifier: string, password: string, deviceId = TEST_DEVICE.id): Promise<string> {
  const res = await mobileClient(app).post('/api/juvi-app/v1/auth/sign-in')
    .send({ collegeId: fx.collegeId, identifier, password, device: { ...TEST_DEVICE, id: deviceId } }).expect(200);
  return res.body.accessToken as string;
}
```

- [ ] **Step 2: Write the failing integration tests**

```ts
// backend/src/__e2e__/modules/juvi-notices-publish.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const s3 = vi.hoisted(() => ({ configured: false, put: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../shared/s3/s3-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/s3/s3-client')>()),
  isS3Configured: () => s3.configured,
  putObject: (input: unknown) => s3.put(input),
}));

import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, provisionTestFaculty } from '../factories/juvi.factory';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { adminRef, erpRef, activateAccount, createStaffPublisher, makeHod, publishTestNotice } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { Channel } from '../../models/juvi/Channel';
import { OutboxEvent, drainOutbox } from '../../shared/outbox';
import { AuditLog } from '../../shared/audit';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';
import { resolvePublisherScope } from '../../modules/juvi-app/notices/publisher-scope';
import { previewAudience, publishNotice, uploadAttachment } from '../../modules/juvi-app/notices/publish-service';
import { fanOutNotice, sweepStuckNotices } from '../../modules/juvi-app/notices/consumers';
import { publishSchema } from '../../modules/juvi-app/notices/admin-schemas';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => {
  await drainOutbox();
  await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId);
  s3.configured = false; s3.put.mockClear();
});
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

const batchRule = () => [{ kind: 'batch' as const, ids: [String(fx.batch._id)] }];
const body = (extra: Record<string, unknown> = {}) => publishSchema.parse({ title: 'Fee dates', body: 'Pay by Friday.', audience: { rules: batchRule() }, ...extra });

describe('previewAudience', () => {
  it('counts the audience, on Juvi and not, grouped, and matches the snapshot written at publish (US-1.2)', async () => {
    const on = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(on.account._id));
    await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });   // onboarding: Not on Juvi
    await provisionTestStudent(fx);                                             // no section
    const scope = await resolvePublisherScope(fx.collegeId, adminRef(fx));
    const preview = await previewAudience(fx.collegeId, scope, batchRule());
    expect(preview).toEqual({
      total: 3, onJuvi: 1, notOnJuvi: 2, line: 'Sent to 2024 Batch',
      groups: [{ label: '2024 Batch', total: 1, onJuvi: 0 }, { label: '2024 Batch · Section A', total: 2, onJuvi: 1 }],
    });
    const notice = await publishTestNotice(fx, { audience: { rules: batchRule() } });
    expect(notice.counts).toEqual({ audience: preview.total, onJuvi: preview.onJuvi });
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id, addedLater: false })).toBe(preview.total);
  });
});

describe('publishNotice and the notice.published fan-out', () => {
  it('writes a publishing notice, records the event and the audit row, then fans out one row per member', async () => {
    const a = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(a.account._id));
    const b = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await reconcileCollege(fx.collegeId);   // creates the college, department and batch channels
    const scope = await resolvePublisherScope(fx.collegeId, adminRef(fx));
    const deadline = new Date(Date.now() + 86_400_000).toISOString();
    const notice = await publishNotice(fx.collegeId, scope, body({ ackRequired: true, ackDeadline: deadline }), 'College Admin');

    expect(notice.status).toBe('publishing');
    expect(notice.publisher.office).toBe('College Office');
    expect(String(notice.publisher.userId)).toBe(String(fx.admin.user._id));
    expect(notice.audience.line).toBe('Sent to 2024 Batch');
    const event = await OutboxEvent.findOne({ dedupeKey: `notice:${notice._id}:published` }).lean();
    expect(event).toMatchObject({ type: 'notice.published', payload: { collegeId: fx.collegeId, noticeId: String(notice._id) } });
    const audit = await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'Notice', entityId: String(notice._id), action: 'publish' }).lean();
    expect(audit?.entityName).toBe('Notice from College Office');
    expect(JSON.stringify(audit)).not.toContain('Fee dates');

    await drainOutbox();
    const done = (await Notice.findById(notice._id).lean())!;
    expect(done).toMatchObject({ status: 'published', counts: { audience: 2, onJuvi: 1 } });
    expect(done.publishedAt).toBeInstanceOf(Date);
    const batchChannel = (await Channel.findOne({ collegeId: fx.collegeId, scopeType: 'batch', scopeId: fx.batch._id }).lean())!;
    expect(done.channelIds.map(String)).toEqual([String(batchChannel._id)]);

    const rows = await NoticeRecipient.find({ noticeId: notice._id }).lean();
    const rowA = rows.find((r) => String(r.personId) === String(a.person._id))!;
    const rowB = rows.find((r) => String(r.personId) === String(b.person._id))!;
    expect(rowA).toMatchObject({ kind: 'student', addedLater: false, ackRequired: true, ack: null, archived: false, labels: { batch: '2024 Batch', section: 'A', department: 'Computer Science' } });
    expect(String(rowA.accountId)).toBe(String(a.account._id));
    expect(rowA.receivedAt).toBeInstanceOf(Date);
    expect(rowA.deadline?.toISOString()).toBe(new Date(deadline).toISOString());
    expect(rowB.accountId).toBeNull();
    expect(rowB.receivedAt).toBeNull();
  });

  it('is idempotent: a re-run changes nothing, and a retry after a partial fan-out fills only the gap', async () => {
    const a = await provisionTestStudent(fx);
    const b = await provisionTestStudent(fx);
    const notice = await publishTestNotice(fx);
    const before = await NoticeRecipient.find({ noticeId: notice._id }).sort({ personId: 1 }).lean();
    await fanOutNotice({ collegeId: fx.collegeId, noticeId: String(notice._id) });
    expect(await NoticeRecipient.find({ noticeId: notice._id }).sort({ personId: 1 }).lean()).toEqual(before);

    // A crash after the first batch: back to publishing with one row missing.
    await NoticeRecipient.deleteOne({ noticeId: notice._id, personId: b.person._id });
    await Notice.updateOne({ _id: notice._id }, { $set: { status: 'publishing' } });
    await fanOutNotice({ collegeId: fx.collegeId, noticeId: String(notice._id) });
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id })).toBe(2);
    const keptA = before.find((r) => String(r.personId) === String(a.person._id))!;
    expect(String((await NoticeRecipient.findOne({ noticeId: notice._id, personId: a.person._id }).lean())!._id)).toBe(String(keptA._id));
    expect((await Notice.findById(notice._id).lean())!).toMatchObject({ status: 'published', counts: { audience: 2 } });
  });

  it('a published notice is never edited by the consumer again (US-1.4)', async () => {
    await provisionTestStudent(fx);
    const notice = await publishTestNotice(fx);
    await Notice.updateOne({ _id: notice._id }, { $set: { status: 'archived' } });
    await fanOutNotice({ collegeId: fx.collegeId, noticeId: String(notice._id) });
    expect((await Notice.findById(notice._id).lean())!.status).toBe('archived');
  });
});

describe('publisher scope on preview and publish (US-1.1)', () => {
  it('an HOD targets their department, is refused another, and a role rule is pinned before it is stored', async () => {
    const hod = await makeHod(fx, fx.cse);
    const ece = await provisionTestStudent(fx, { branchId: String(fx.eceBranch._id) });
    await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const scope = await resolvePublisherScope(fx.collegeId, erpRef(hod.user));
    expect(scope).toMatchObject({ kind: 'department', departmentId: String(fx.cse._id), office: 'HOD, Computer Science', isAdmin: false });

    expect((await previewAudience(fx.collegeId, scope, [{ kind: 'section', ids: [String(fx.cseSection._id)] }])).total).toBe(1);
    await expect(previewAudience(fx.collegeId, scope, [{ kind: 'department', ids: [String(fx.ece._id)] }])).rejects.toMatchObject({ statusCode: 403 });
    await expect(publishNotice(fx.collegeId, scope, body({ audience: { rules: [{ kind: 'custom', ids: [String(ece.person._id)] }] } }), 'hod')).rejects.toMatchObject({ statusCode: 403 });
    expect(await Notice.countDocuments({ collegeId: fx.collegeId })).toBe(0);

    const n = await publishNotice(fx.collegeId, scope, body({ audience: { rules: [{ kind: 'role', ids: ['student'] }] } }), 'hod');
    expect(n.audience.rules).toEqual([{ kind: 'role', ids: ['student'], departmentId: String(fx.cse._id) }]);
    await drainOutbox();
    expect((await Notice.findById(n._id).lean())!.counts.audience).toBe(1);   // the CSE student only
  });

  it('teaching faculty target the offerings they teach and nothing else', async () => {
    const fac = await provisionTestFaculty(fx);
    const stu = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id) });
    const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
    await off.updateOne({ $set: { status: 'active' } });
    await createTestEnrollment(fx.collegeId, { studentId: String(stu.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
    const scope = await resolvePublisherScope(fx.collegeId, erpRef(fac.user));
    expect(scope).toMatchObject({ kind: 'offerings', offeringIds: [String(off._id)], office: 'Course Faculty' });
    expect((await previewAudience(fx.collegeId, scope, [{ kind: 'course_offering', ids: [String(off._id)] }])).total).toBe(1);
    await expect(previewAudience(fx.collegeId, scope, [{ kind: 'section', ids: [String(fx.cseSection._id)] }])).rejects.toMatchObject({ statusCode: 403 });
  });

  it('a staff office publishes college-wide under its office words; another staff member cannot publish', async () => {
    await provisionTestStudent(fx);
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const hr = await createStaffPublisher(fx, 'ST-HR');
    expect(await resolvePublisherScope(fx.collegeId, erpRef(exam.user))).toMatchObject({ kind: 'college', office: 'Exam Section', isAdmin: false });
    const n = await publishTestNotice(fx, { audience: { rules: [{ kind: 'all', ids: [] }] } }, erpRef(exam.user));
    expect(n.publisher.office).toBe('Exam Section');
    const hrScope = await resolvePublisherScope(fx.collegeId, erpRef(hr.user));
    expect(hrScope.kind).toBe('none');
    await expect(previewAudience(fx.collegeId, hrScope, [{ kind: 'all', ids: [] }])).rejects.toMatchObject({ statusCode: 403 });
  });

  it('an admin chooses the office; an unknown office is refused; a principal defaults to the principal office', async () => {
    expect((await resolvePublisherScope(fx.collegeId, adminRef(fx), 'Placement')).office).toBe('Placement');
    await expect(resolvePublisherScope(fx.collegeId, adminRef(fx), 'Canteen')).rejects.toMatchObject({ statusCode: 400 });
    expect(await resolvePublisherScope(fx.collegeId, erpRef(fx.principal.user))).toMatchObject({ kind: 'college', isAdmin: true, office: "Principal's Office" });
  });
});

describe('publish validation', () => {
  it('refuses an empty audience, a foreign attachment key, a welcome notice from a non-office, and bad bodies', async () => {
    const scope = await resolvePublisherScope(fx.collegeId, adminRef(fx));
    await expect(publishNotice(fx.collegeId, scope, body(), 'x')).rejects.toMatchObject({ statusCode: 400, message: 'This audience has no members' });
    await provisionTestStudent(fx);
    const foreign = { key: `colleges/${new Types.ObjectId()}/notices/abc`, name: 'a.pdf', mime: 'application/pdf', size: 10 };
    await expect(publishNotice(fx.collegeId, scope, body({ attachments: [foreign] }), 'x')).rejects.toMatchObject({ statusCode: 400 });
    const nested = { ...foreign, key: `colleges/${fx.collegeId}/notices/a/b` };
    await expect(publishNotice(fx.collegeId, scope, body({ attachments: [nested] }), 'x')).rejects.toMatchObject({ statusCode: 400 });
    const hod = await makeHod(fx, fx.cse);
    const hodScope = await resolvePublisherScope(fx.collegeId, erpRef(hod.user));
    await expect(publishNotice(fx.collegeId, hodScope, body({ purpose: 'welcome', audience: { rules: [{ kind: 'department', ids: [String(fx.cse._id)] }] } }), 'x')).rejects.toMatchObject({ statusCode: 403 });

    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: batchRule() }, ackDeadline: future }).success).toBe(false);          // deadline without ack
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: batchRule() }, ackRequired: true, ackDeadline: new Date(Date.now() - 1000).toISOString() }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: batchRule() }, ackCommentAllowed: true }).success).toBe(false);      // comments need an ack
    expect(publishSchema.safeParse({ title: 'x'.repeat(121), body: 'b', audience: { rules: batchRule() } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'x'.repeat(5001), audience: { rules: batchRule() } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: [{ kind: 'batch', ids: ['nope'] }] } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: [{ kind: 'batch', ids: [] }] } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: [{ kind: 'all', ids: ['x'] }] } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: [{ kind: 'role', ids: ['wizard'] }] } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: [] } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: batchRule() }, attachments: Array(6).fill(foreign) }).success).toBe(false);
    expect(await Notice.countDocuments({ collegeId: fx.collegeId })).toBe(0);
  });
});

describe('uploadAttachment', () => {
  const pdf = { buffer: Buffer.from('%PDF-1.4'), originalname: '../../Exam Timetable.pdf', mimetype: 'application/pdf', size: 8 };

  it('returns 503 when S3 is not configured', async () => {
    await expect(uploadAttachment(fx.collegeId, pdf)).rejects.toMatchObject({ statusCode: 503 });
    expect(s3.put).not.toHaveBeenCalled();
  });

  it('stores the file under colleges/<cid>/notices/<uuid> and returns the attachment record', async () => {
    s3.configured = true;
    const a = await uploadAttachment(fx.collegeId, pdf);
    expect(a.key).toMatch(new RegExp(`^colleges/${fx.collegeId}/notices/[0-9a-f-]{36}$`));
    expect(a).toMatchObject({ name: 'Exam Timetable.pdf', mime: 'application/pdf', size: 8 });
    expect(s3.put).toHaveBeenCalledWith(expect.objectContaining({ key: a.key, contentType: 'application/pdf' }));
  });

  it('refuses a type outside the list and a file over 10 MB', async () => {
    s3.configured = true;
    await expect(uploadAttachment(fx.collegeId, { ...pdf, mimetype: 'application/zip' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(uploadAttachment(fx.collegeId, { ...pdf, size: 10 * 1024 * 1024 + 1 })).rejects.toMatchObject({ statusCode: 400 });
    expect(s3.put).not.toHaveBeenCalled();
  });
});

describe('sweeper', () => {
  it('re-emits the event for a notice stuck in publishing for more than 2 minutes, once', async () => {
    await provisionTestStudent(fx);
    const n = await Notice.create({
      collegeId: fx.collegeId, title: 'Stuck', body: 'b', publisher: { office: 'College Office' },
      audience: { rules: batchRule(), line: 'Sent to 2024 Batch' }, status: 'publishing',
    });
    expect(await sweepStuckNotices()).toBe(0);                                 // younger than 2 minutes
    await Notice.collection.updateOne({ _id: n._id }, { $set: { createdAt: new Date(Date.now() - 3 * 60_000) } });
    expect(await sweepStuckNotices()).toBe(1);
    expect(await sweepStuckNotices()).toBe(0);                                 // the dedupe key makes a re-emit a no-op
    await drainOutbox();
    expect((await Notice.findById(n._id).lean())!).toMatchObject({ status: 'published', counts: { audience: 1, onJuvi: 0 } });
  });
});
```

```ts
// backend/src/__e2e__/modules/juvi-notices-fanout-5000.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi } from '../factories/juvi.factory';
import { adminRef } from '../factories/notice.factory';
import { Person, Student } from '../../models';
import { User } from '../../models/User';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { drainOutbox } from '../../shared/outbox';
import { resolvePublisherScope } from '../../modules/juvi-app/notices/publisher-scope';
import { publishNotice } from '../../modules/juvi-app/notices/publish-service';
import { publishSchema } from '../../modules/juvi-app/notices/admin-schemas';

const N = 5000;
const ON_JUVI = 250;
let fx: BaseFixtures;

beforeAll(async () => {
  await getTestApp();
  await cleanupTestApp();
  fx = await seedBase();
  await enableJuvi(fx.collegeId);
  // Native inserts: the point is the fan-out, not 5,000 model saves.
  const cid = new Types.ObjectId(fx.collegeId);
  const persons = Array.from({ length: N }, (_, i) => ({ _id: new Types.ObjectId(), collegeId: cid, name: `Student ${i}`, phone: `91${String(i).padStart(8, '0')}` }));
  await Person.collection.insertMany(persons);
  const students = persons.map((p, i) => ({
    _id: new Types.ObjectId(), collegeId: cid, personId: p._id, admissionYear: 2024, rollNumber: `24BULK${String(i).padStart(5, '0')}`,
    status: 'active', batchId: fx.batch._id, branchId: fx.cseBranch._id, programmeId: fx.btech._id,
  }));
  await Student.collection.insertMany(students);
  const users = persons.slice(0, ON_JUVI).map((p, i) => ({
    _id: new Types.ObjectId(), collegeId: cid, personId: p._id, email: `bulk${i}@test.com`, password: 'x', name: p.name,
    role: 'student', personaType: 'L-STU', personas: ['L-STU'], isActive: true, tokenVersion: 0,
  }));
  await User.collection.insertMany(users);
  await JuviAccount.collection.insertMany(users.map((u, i) => ({
    collegeId: cid, personId: u.personId, userId: u._id, kind: 'student', studentId: students[i]!._id, status: 'active',
    onboardingStep: 3, transitions: [], provisionedAt: new Date(), provisionedBy: 'test', createdAt: new Date(), updatedAt: new Date(),
  })));
}, 120_000);

afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

describe('fan-out at scale (spec §4 US-1.3)', () => {
  it('delivers a 5,000-member audience in under 60 seconds with exact counts', { timeout: 120_000 }, async () => {
    const scope = await resolvePublisherScope(fx.collegeId, adminRef(fx));
    const started = Date.now();
    const notice = await publishNotice(fx.collegeId, scope, publishSchema.parse({
      title: 'Semester begins', body: 'Classes start on Monday.', ackRequired: true,
      audience: { rules: [{ kind: 'batch', ids: [String(fx.batch._id)] }] },
    }), 'College Admin');
    await drainOutbox();
    const elapsed = Date.now() - started;
    console.log(`FANOUT-5000 elapsed=${elapsed}ms`);

    expect((await Notice.findById(notice._id).lean())!).toMatchObject({ status: 'published', counts: { audience: N, onJuvi: ON_JUVI } });
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id })).toBe(N);
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id, accountId: { $ne: null }, receivedAt: { $ne: null } })).toBe(ON_JUVI);
    expect(elapsed).toBeLessThan(60_000);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-publish.e2e.test.ts src/__e2e__/modules/juvi-notices-fanout-5000.e2e.test.ts`
Expected: FAIL with "Cannot find module '../../modules/juvi-app/notices/publisher-scope'".

- [ ] **Step 4: Implement the audience graph loader**

```ts
// backend/src/modules/juvi-app/notices/audience-graph.ts
/**
 * Loads the AudienceGraph from ERP people (spec §1: members without an active
 * Juvi account are still in the audience, as "Not on Juvi"). College metadata
 * is always loaded whole (it is small); `personIds` narrows the people, which
 * is how the added-later check (Task 10) evaluates a single account.
 */
import { Types } from 'mongoose';
import { College } from '../../../models/College';
import { User } from '../../../models/User';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Branch } from '../../../models/academic-structure/Branch';
import { Department } from '../../../models/academic-structure/Department';
import { Programme } from '../../../models/academic-structure/Programme';
import { Batch } from '../../../models/academic-structure/Batch';
import { Section } from '../../../models/academic-structure/Section';
import { Semester } from '../../../models/academic-structure/Semester';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../../models/welfare/HostelRoom';
import { HostelBlock } from '../../../models/welfare/HostelBlock';
import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { AudienceGraph, emptyAudienceGraph } from './audience';

export const AUDIENCE_STUDENT_STATUSES: readonly string[] = ['active', 'year_back', 'detained'];
export const AUDIENCE_EMPLOYEE_STATUSES: readonly string[] = ['active', 'on_leave'];

const s = (v: unknown) => String(v);
const push = (m: Map<string, string[]>, k: string, v: string) => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };

interface OfferingLean { _id: Types.ObjectId; sectionId: Types.ObjectId; facultyId: Types.ObjectId; coFacultyIds?: Types.ObjectId[]; courseId: Types.ObjectId }

export async function loadAudienceGraph(collegeId: string, opts: { personIds?: string[] } = {}): Promise<AudienceGraph> {
  const byPerson = opts.personIds ? { personId: { $in: opts.personIds.map((id) => new Types.ObjectId(id)) } } : {};
  const [college, departments, programmes, batches, branches, sections, semesters, blocks] = await Promise.all([
    College.findById(collegeId).select('name').lean(),
    Department.find({ collegeId, isActive: true }).select('_id name hodId').lean(),
    Programme.find({ collegeId }).select('_id name').lean(),
    Batch.find({ collegeId }).select('_id name programmeId').lean(),
    Branch.find({ collegeId }).select('_id departmentId').lean(),
    Section.find({ collegeId }).select('_id name batchId branchId studentIds').lean(),
    Semester.find({ collegeId, status: 'active' }).select('_id').lean(),
    HostelBlock.find({ collegeId, isActive: true }).select('_id name').lean(),
  ]);

  const g = emptyAudienceGraph(college?.name ?? '');
  const branchDept = new Map(branches.filter((b) => b.departmentId).map((b) => [s(b._id), s(b.departmentId)]));
  for (const d of departments) g.departments.set(s(d._id), { name: d.name });
  for (const p of programmes) g.programmes.set(s(p._id), { name: p.name });
  for (const b of batches) g.batches.set(s(b._id), { name: b.name, programmeId: b.programmeId ? s(b.programmeId) : undefined });
  for (const b of blocks) g.blocks.set(s(b._id), { name: b.name });
  const sectionsByStudent = new Map<string, string[]>();
  for (const sec of sections) {
    g.sections.set(s(sec._id), { name: sec.name, batchId: s(sec.batchId), departmentId: branchDept.get(s(sec.branchId)) });
    for (const sid of sec.studentIds ?? []) push(sectionsByStudent, s(sid), s(sec._id));
  }

  const offeringDocs = await CourseOffering.find({ collegeId, status: 'active', semesterId: { $in: semesters.map((x) => x._id) } })
    .select('_id sectionId facultyId coFacultyIds courseId').lean<OfferingLean[]>();
  const offeringIds = offeringDocs.map((o) => o._id);
  const courses = await Course.find({ collegeId, _id: { $in: offeringDocs.map((o) => o.courseId) } }).select('_id code').lean();
  const courseCode = new Map(courses.map((c) => [s(c._id), c.code]));
  const offeringsByFaculty = new Map<string, string[]>();
  for (const o of offeringDocs) {
    const facultyIds = [s(o.facultyId), ...(o.coFacultyIds ?? []).map(s)];
    const sec = g.sections.get(s(o.sectionId));
    g.offerings.set(s(o._id), { label: `${courseCode.get(s(o.courseId)) ?? 'Course'} · ${sec?.name ?? ''}`, sectionId: s(o.sectionId), departmentId: sec?.departmentId, facultyIds });
    for (const f of facultyIds) push(offeringsByFaculty, f, s(o._id));
  }

  const [students, faculty, staff] = await Promise.all([
    Student.find({ collegeId, status: { $in: AUDIENCE_STUDENT_STATUSES }, ...byPerson }).select('_id personId batchId branchId').lean(),
    Faculty.find({ collegeId, status: { $in: AUDIENCE_EMPLOYEE_STATUSES }, ...byPerson }).select('_id personId departmentId').lean(),
    Staff.find({ collegeId, status: { $in: AUDIENCE_EMPLOYEE_STATUSES }, ...byPerson }).select('_id personId departmentId personaCode').lean(),
  ]);
  const personIds = [...students, ...faculty, ...staff].map((x) => x.personId);
  const studentIds = students.map((x) => x._id);
  const [users, accounts, enrollments, allocations, enrolCounts] = await Promise.all([
    User.find({ collegeId, personId: { $in: personIds } }).select('personId personaType personas').lean(),
    JuviAccount.find({ collegeId, status: 'active', personId: { $in: personIds } }).select('_id personId').lean(),
    Enrollment.find({ collegeId, status: 'enrolled', studentId: { $in: studentIds }, courseOfferingId: { $in: offeringIds } }).select('studentId courseOfferingId').lean(),
    HostelAllocation.find({ collegeId, status: 'active', studentId: { $in: studentIds } }).select('studentId roomId').lean(),
    Enrollment.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { collegeId: new Types.ObjectId(collegeId), status: 'enrolled', courseOfferingId: { $in: offeringIds } } },
      { $group: { _id: '$courseOfferingId', n: { $sum: 1 } } },
    ]),
  ]);
  const rooms = allocations.length ? await HostelRoom.find({ collegeId, _id: { $in: allocations.map((a) => a.roomId) } }).select('_id blockId').lean() : [];

  const blockByRoom = new Map(rooms.map((r) => [s(r._id), s(r.blockId)]));
  const blockByStudent = new Map(allocations.map((a) => [s(a.studentId), blockByRoom.get(s(a.roomId))]));
  const codesByPerson = new Map<string, string[]>();
  for (const u of users) if (u.personId) codesByPerson.set(s(u.personId), [...new Set([u.personaType, ...(u.personas ?? [])].filter(Boolean))]);
  const accountByPerson = new Map(accounts.map((a) => [s(a.personId), s(a._id)]));
  const enrolledByStudent = new Map<string, string[]>();
  for (const e of enrollments) push(enrolledByStudent, s(e.studentId), s(e.courseOfferingId));
  // Roster fallback (as spaces/strategies.ts): an offering with no enrolments reaches its section's roster.
  const withEnrolments = new Set(enrolCounts.filter((c) => c.n > 0).map((c) => s(c._id)));
  const rosterBySection = new Map<string, string[]>();
  for (const [id, o] of g.offerings) if (!withEnrolments.has(id)) push(rosterBySection, o.sectionId, id);
  const headedBy = new Map(departments.filter((d) => d.hodId).map((d) => [s(d.hodId), s(d._id)]));
  const deptName = (id?: string) => (id ? g.departments.get(id)?.name : undefined);
  const identity = (personId: string) => ({ personId, accountId: accountByPerson.get(personId) ?? null, personaCodes: codesByPerson.get(personId) ?? [] });

  // A person with several ERP rows is taken once: student first, then faculty, then staff.
  for (const st of students) {
    const pid = s(st.personId);
    if (g.people.has(pid)) continue;
    const sid = s(st._id);
    const sectionIds = sectionsByStudent.get(sid) ?? [];
    const departmentId = st.branchId ? branchDept.get(s(st.branchId)) : undefined;
    const batchId = st.batchId ? s(st.batchId) : undefined;
    const roster = sectionIds.flatMap((sec) => rosterBySection.get(sec) ?? []);
    g.people.set(pid, {
      ...identity(pid), kind: 'student', isHod: false, departmentId, batchId, sectionIds,
      offeringIds: [...new Set([...(enrolledByStudent.get(sid) ?? []), ...roster])],
      hostelBlockId: blockByStudent.get(sid),
      labels: {
        batch: batchId ? g.batches.get(batchId)?.name : undefined,
        section: sectionIds[0] ? g.sections.get(sectionIds[0])?.name : undefined,
        department: deptName(departmentId),
      },
    });
  }
  for (const f of faculty) {
    const pid = s(f.personId);
    if (g.people.has(pid)) continue;
    const fid = s(f._id);
    const headed = headedBy.get(fid);
    const departmentId = f.departmentId ? s(f.departmentId) : headed;
    g.people.set(pid, {
      ...identity(pid), kind: 'faculty', isHod: Boolean(headed), departmentId, sectionIds: [],
      offeringIds: offeringsByFaculty.get(fid) ?? [], labels: { department: deptName(departmentId) },
    });
  }
  for (const st of staff) {
    const pid = s(st.personId);
    if (g.people.has(pid)) continue;
    const departmentId = st.departmentId ? s(st.departmentId) : undefined;
    const base = identity(pid);
    g.people.set(pid, {
      ...base, personaCodes: [...new Set([...base.personaCodes, ...(st.personaCode ? [st.personaCode] : [])])],
      kind: 'staff', isHod: false, departmentId, sectionIds: [], offeringIds: [], labels: { department: deptName(departmentId) },
    });
  }
  return g;
}
```

- [ ] **Step 5: Implement the publisher scope loader**

```ts
// backend/src/modules/juvi-app/notices/publisher-scope.ts
/**
 * Builds the PublisherScope for an ERP caller (spec §1, §7.3). Dispatches on
 * `role` like resolveUserScope does: admin/principal → college (admins may pick
 * the office); staff with an office persona → college; the head of a department
 * → department; other faculty → the offerings they teach this semester; anyone
 * else → none.
 */
import { AppError } from '../../../middleware/errorHandler';
import { User } from '../../../models/User';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Department } from '../../../models/academic-structure/Department';
import { Semester } from '../../../models/academic-structure/Semester';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { PublisherScope } from './scope';
import { COLLEGE_OFFICE, PRINCIPAL_OFFICE, FACULTY_OFFICE, OFFICE_NAMES, officeForPersonas, hodOffice } from './offices';

/** The ERP caller as `authenticate` leaves it on req.user. */
export interface ErpUserRef { id: string; role: string; personaType?: string; personas?: string[] }

/** Roles with college-wide notice rights: every notice, every reach, CSV export, retry delivery. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(['admin', 'super_admin', 'principal']);

export async function resolvePublisherScope(collegeId: string, user: ErpUserRef, officeOverride?: string): Promise<PublisherScope> {
  const row = await User.findOne({ _id: user.id, collegeId }).select('personId personaType personas').lean();
  const personId = row?.personId ? String(row.personId) : undefined;
  const codes = [...new Set([user.personaType, ...(user.personas ?? []), row?.personaType, ...(row?.personas ?? [])].filter((c): c is string => Boolean(c)))];
  const base = { userId: user.id, personId, offeringIds: [] as string[], isAdmin: ADMIN_ROLES.has(user.role) };
  const none: PublisherScope = { ...base, kind: 'none', office: '' };

  if (base.isAdmin) {
    if (officeOverride !== undefined && !OFFICE_NAMES.includes(officeOverride)) throw new AppError(400, `Unknown office "${officeOverride}"`);
    return { ...base, kind: 'college', office: officeOverride ?? (user.role === 'principal' ? PRINCIPAL_OFFICE : COLLEGE_OFFICE) };
  }
  if (user.role === 'staff') {
    const staff = personId ? await Staff.findOne({ collegeId, personId }).select('personaCode').lean() : null;
    const office = officeForPersonas(staff?.personaCode ? [...codes, staff.personaCode] : codes);
    return office ? { ...base, kind: 'college', office } : none;
  }
  if (user.role !== 'hod' && user.role !== 'faculty') return none;

  const faculty = personId ? await Faculty.findOne({ collegeId, personId }).select('_id departmentId').lean() : null;
  if (!faculty) return none;
  const headed = await Department.findOne({ collegeId, hodId: faculty._id, isActive: true }).select('_id name').lean();
  const hodDept = headed ?? (user.role === 'hod' && faculty.departmentId
    ? await Department.findOne({ _id: faculty.departmentId, collegeId, isActive: true }).select('_id name').lean()
    : null);
  if (hodDept) return { ...base, kind: 'department', departmentId: String(hodDept._id), office: hodOffice(hodDept.name) };
  if (user.role === 'hod') return none;

  const semesters = await Semester.find({ collegeId, status: 'active' }).select('_id').lean();
  const offerings = await CourseOffering.find({
    collegeId, status: 'active', semesterId: { $in: semesters.map((x) => x._id) },
    $or: [{ facultyId: faculty._id }, { coFacultyIds: faculty._id }],
  }).select('_id').lean();
  return { ...base, kind: 'offerings', office: FACULTY_OFFICE, offeringIds: offerings.map((o) => String(o._id)) };
}
```

- [ ] **Step 6: Implement the admin request schemas**

```ts
// backend/src/modules/juvi-app/notices/admin-schemas.ts
import { z } from 'zod';
import {
  AUDIENCE_RULE_KINDS, NOTICE_PRIORITIES, NOTICE_PURPOSES, NOTICE_ATTACHMENT_MIMES,
  NOTICE_TITLE_MAX, NOTICE_BODY_MAX, NOTICE_ATTACHMENTS_MAX, NOTICE_ATTACHMENT_MAX_BYTES,
} from '../../../models/juvi/Notice';
import { objectId } from '../admin/schemas';

const tuple = <T extends string>(list: readonly T[]) => list as unknown as [T, ...T[]];
/** A role word, or a persona code like ST-EXAM / ST-ADM-TC. */
const roleId = z.string().regex(/^(student|faculty|staff|hod|[A-Z][A-Z0-9]*(-[A-Z0-9]+)+|L-[A-Z]+)$/, 'Unknown role');

export const audienceRuleSchema = z.object({
  kind: z.enum(tuple(AUDIENCE_RULE_KINDS)),
  ids: z.array(z.string()).max(5000).default([]),
  departmentId: objectId.optional(),
}).strict().superRefine((r, ctx) => {
  if (r.kind === 'all') {
    if (r.ids.length) ctx.addIssue({ code: 'custom', path: ['ids'], message: 'An "all" rule takes no ids' });
  } else if (r.ids.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['ids'], message: 'Pick at least one target' });
  }
  const check = r.kind === 'role' ? roleId : objectId;
  r.ids.forEach((id, i) => { if (!check.safeParse(id).success) ctx.addIssue({ code: 'custom', path: ['ids', i], message: r.kind === 'role' ? 'Unknown role' : 'Invalid id' }); });
  if (r.departmentId && r.kind !== 'role') ctx.addIssue({ code: 'custom', path: ['departmentId'], message: 'Only a role rule takes a department' });
});

export const audienceSchema = z.object({ rules: z.array(audienceRuleSchema).min(1).max(20) }).strict();

export const noticeAttachmentInputSchema = z.object({
  key: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(200),
  mime: z.enum(tuple(NOTICE_ATTACHMENT_MIMES)),
  size: z.number().int().min(0).max(NOTICE_ATTACHMENT_MAX_BYTES),
}).strict();

export const publishSchema = z.object({
  title: z.string().trim().min(1).max(NOTICE_TITLE_MAX),
  body: z.string().trim().min(1).max(NOTICE_BODY_MAX),
  attachments: z.array(noticeAttachmentInputSchema).max(NOTICE_ATTACHMENTS_MAX).default([]),
  audience: audienceSchema,
  ackRequired: z.boolean().default(false),
  ackDeadline: z.string().datetime({ offset: true }).nullable().optional(),
  ackCommentAllowed: z.boolean().default(false),
  priority: z.enum(tuple(NOTICE_PRIORITIES)).default('routine'),
  purpose: z.enum(tuple(NOTICE_PURPOSES)).default('standard'),
  /** Admins only; ignored for everyone else (their office comes from their persona). */
  office: z.string().trim().min(1).max(60).optional(),
}).strict().superRefine((b, ctx) => {
  if (b.ackDeadline && !b.ackRequired) ctx.addIssue({ code: 'custom', path: ['ackDeadline'], message: 'A deadline requires acknowledgement' });
  if (b.ackDeadline && new Date(b.ackDeadline).getTime() <= Date.now()) ctx.addIssue({ code: 'custom', path: ['ackDeadline'], message: 'The deadline must be in the future' });
  if (b.ackCommentAllowed && !b.ackRequired) ctx.addIssue({ code: 'custom', path: ['ackCommentAllowed'], message: 'Comments are collected with an acknowledgement only' });
});
export type PublishInput = z.infer<typeof publishSchema>;

export const audiencePreviewSchema = z.object({
  rules: z.array(audienceRuleSchema).min(1).max(20),
  office: z.string().trim().min(1).max(60).optional(),
}).strict();
```

- [ ] **Step 7: Implement the publish service**

```ts
// backend/src/modules/juvi-app/notices/publish-service.ts
/**
 * Publishing (spec §6.1): validate → scope check → write `publishing` →
 * emit notice.published → kick → 201. The fan-out runs in consumers.ts.
 * No transactions (the test harness is not a replica set, as in Foundation).
 */
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { Types } from 'mongoose';
import { AppError } from '../../../middleware/errorHandler';
import {
  Notice, LeanNotice, IAudienceRule, INoticeAttachment, NOTICE_ATTACHMENT_MIMES, NOTICE_ATTACHMENT_MAX_BYTES,
} from '../../../models/juvi/Notice';
import { Channel } from '../../../models/juvi/Channel';
import { createAuditLog } from '../../../shared/audit';
import { emit, kick } from '../../../shared/outbox';
import { isS3Configured, putObject } from '../../../shared/s3/s3-client';
import { loadAudienceGraph } from './audience-graph';
import { resolveAudience, ruleChannelRefs, audienceLine, groupLabel } from './audience';
import { PublisherScope, narrowToScope, assertAudienceInScope } from './scope';
import { PublishInput } from './admin-schemas';

export const NOTICE_EVENTS = {
  published: 'notice.published',
  reminder: 'notice.reminder',
  acknowledged: 'notice.acknowledged',
  archived: 'notice.archived',
} as const;

export const noticeEventKey = {
  published: (noticeId: string) => `notice:${noticeId}:published`,
  archived: (noticeId: string) => `notice:${noticeId}:archived`,
  reminder: (noticeId: string, n: number) => `notice:${noticeId}:reminder:${n}`,
  acknowledged: (noticeId: string, personId: string) => `notice:${noticeId}:ack:${personId}`,
};

export const attachmentPrefix = (collegeId: string) => `colleges/${collegeId}/notices/`;

export interface UploadedFile { buffer: Buffer; originalname: string; mimetype: string; size: number }
export interface AudiencePreview { total: number; onJuvi: number; notOnJuvi: number; groups: { label: string; total: number; onJuvi: number }[]; line: string }

/** Plain file name for display: no path, no control characters. */
function displayName(original: string): string {
  const name = basename(original.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (name || 'attachment').slice(0, 200);
}

export async function uploadAttachment(collegeId: string, file: UploadedFile): Promise<INoticeAttachment> {
  if (!isS3Configured()) throw new AppError(503, 'Attachments are unavailable: file storage is not configured');
  if (!NOTICE_ATTACHMENT_MIMES.includes(file.mimetype)) throw new AppError(400, 'Unsupported file type. Use PDF, PNG, JPEG, WEBP, DOCX, XLSX or PPTX.');
  if (file.size > NOTICE_ATTACHMENT_MAX_BYTES) throw new AppError(400, 'File too large (max 10 MB)');
  const key = `${attachmentPrefix(collegeId)}${randomUUID()}`;
  await putObject({ key, body: file.buffer, contentType: file.mimetype });   // putObject always sets SSE (AES256)
  return { key, name: displayName(file.originalname), mime: file.mimetype, size: file.size };
}

export async function previewAudience(collegeId: string, scope: PublisherScope, rules: IAudienceRule[]): Promise<AudiencePreview> {
  const narrowed = narrowToScope(scope, rules);
  const graph = await loadAudienceGraph(collegeId);
  assertAudienceInScope(scope, narrowed, graph);
  const people = resolveAudience(narrowed, graph);
  const groups = new Map<string, { label: string; total: number; onJuvi: number }>();
  for (const p of people) {
    const label = groupLabel(p.kind, p.labels);
    const row = groups.get(label) ?? { label, total: 0, onJuvi: 0 };
    row.total += 1;
    if (p.accountId) row.onJuvi += 1;
    groups.set(label, row);
  }
  const onJuvi = people.filter((p) => p.accountId).length;
  return {
    total: people.length, onJuvi, notOnJuvi: people.length - onJuvi,
    groups: [...groups.values()].sort((a, b) => a.label.localeCompare(b.label)),
    line: audienceLine(narrowed, graph),
  };
}

/** Channels whose scope equals a rule (spec §6.4), for inline cards. */
export async function channelIdsForRules(collegeId: string, rules: IAudienceRule[]): Promise<Types.ObjectId[]> {
  const refs = ruleChannelRefs(rules);
  if (refs.length === 0) return [];
  const rows = await Channel.find({
    collegeId,
    $or: refs.map((r) => ({ scopeType: r.scopeType, scopeId: r.scopeId ? new Types.ObjectId(r.scopeId) : null })),
  }).select('_id').lean();
  return rows.map((r) => r._id);
}

function assertOwnAttachments(collegeId: string, attachments: INoticeAttachment[]): void {
  const prefix = attachmentPrefix(collegeId);
  for (const a of attachments) {
    const rest = a.key.startsWith(prefix) ? a.key.slice(prefix.length) : '';
    if (!rest || rest.includes('/')) throw new AppError(400, 'Unknown attachment; upload it again');
  }
}

export async function publishNotice(collegeId: string, scope: PublisherScope, input: PublishInput, performedBy: string): Promise<LeanNotice> {
  if (input.purpose === 'welcome' && scope.kind !== 'college') throw new AppError(403, 'Only college offices publish welcome notices');
  assertOwnAttachments(collegeId, input.attachments);
  const rules = narrowToScope(scope, input.audience.rules);
  const graph = await loadAudienceGraph(collegeId);
  assertAudienceInScope(scope, rules, graph);
  if (resolveAudience(rules, graph).length === 0) throw new AppError(400, 'This audience has no members');

  const notice = await Notice.create({
    collegeId, title: input.title, body: input.body, attachments: input.attachments,
    publisher: { personId: scope.personId, userId: scope.userId, office: scope.office },
    audience: { rules, line: audienceLine(rules, graph) },
    ackRequired: input.ackRequired, ackDeadline: input.ackDeadline ? new Date(input.ackDeadline) : null,
    ackCommentAllowed: input.ackCommentAllowed, priority: input.priority, purpose: input.purpose, status: 'publishing',
  });
  const noticeId = String(notice._id);
  await emit(NOTICE_EVENTS.published, { collegeId, noticeId }, noticeEventKey.published(noticeId));
  await createAuditLog({
    collegeId, entityType: 'Notice', entityId: noticeId, entityName: `Notice from ${scope.office}`, action: 'publish',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: 'publishing' },
      { field: 'audience', displayName: 'Audience', oldValue: null, newValue: notice.audience.line },
    ],
    performedBy,
  });
  await kick();
  return notice.toObject() as unknown as LeanNotice;
}
```

- [ ] **Step 8: Implement the fan-out consumer and the sweeper, and register them**

```ts
// backend/src/modules/juvi-app/notices/consumers.ts
/**
 * Outbox consumers for notices (spec §6.3). Register them with
 * registerNoticeConsumers(); never write a queue of your own.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { registerConsumer, registerSweeper, emit, OutboxPayload } from '../../../shared/outbox';
import { loadAudienceGraph } from './audience-graph';
import { resolveAudience, PersonNode } from './audience';
import { channelIdsForRules, NOTICE_EVENTS, noticeEventKey } from './publish-service';

export const FANOUT_BATCH_SIZE = 1000;
export const STUCK_PUBLISHING_MS = 120_000;

function snapshotRow(notice: LeanNotice, p: PersonNode, now: Date) {
  const onJuvi = Boolean(p.accountId);
  return {
    collegeId: notice.collegeId, noticeId: notice._id, personId: new Types.ObjectId(p.personId),
    accountId: onJuvi ? new Types.ObjectId(p.accountId!) : null, kind: p.kind, labels: p.labels,
    addedLater: false, ackRequired: notice.ackRequired, deadline: notice.ackDeadline ?? null,
    receivedAt: onJuvi ? now : null, seenAt: null, dismissedAt: null, remindedAt: null, ack: null, archived: false,
  };
}

/**
 * notice.published: resolve the audience, upsert one NoticeRecipient per member in
 * batches of 1,000 (`ordered: false`, upsert on the unique (noticeId, personId)),
 * then set counts, channelIds, status and publishedAt. Idempotent: a notice that is
 * no longer `publishing` is left alone, and a retry only inserts the missing rows.
 */
export async function fanOutNotice(payload: OutboxPayload): Promise<void> {
  const collegeId = payload.collegeId;
  const noticeId = String(payload.noticeId);
  const notice = await Notice.findOne({ _id: noticeId, collegeId }).lean<LeanNotice>();
  if (!notice || notice.status !== 'publishing') return;

  const people = resolveAudience(notice.audience.rules, await loadAudienceGraph(collegeId));
  const now = new Date();
  for (let i = 0; i < people.length; i += FANOUT_BATCH_SIZE) {
    const batch = people.slice(i, i + FANOUT_BATCH_SIZE);
    await NoticeRecipient.bulkWrite(batch.map((p) => ({
      updateOne: {
        filter: { noticeId: notice._id, personId: new Types.ObjectId(p.personId) },
        update: { $setOnInsert: snapshotRow(notice, p, now) },
        upsert: true,
      },
    })), { ordered: false });
  }

  const snapshot = { collegeId, noticeId: notice._id, addedLater: false };
  const [audience, onJuvi, channelIds] = await Promise.all([
    NoticeRecipient.countDocuments(snapshot),
    NoticeRecipient.countDocuments({ ...snapshot, accountId: { $ne: null } }),
    channelIdsForRules(collegeId, notice.audience.rules),
  ]);
  await Notice.updateOne(
    { _id: notice._id, collegeId, status: 'publishing' },
    { $set: { counts: { audience, onJuvi }, channelIds, status: 'published', publishedAt: now } },
  );
  console.log(`[juvi-notices] fan-out ${noticeId}: ${audience} recipients, ${onJuvi} on Juvi`);
}

/** Re-emits notice.published for notices stuck in `publishing` for over 2 minutes; the dedupe key makes it a no-op when the event exists. */
export async function sweepStuckNotices(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_PUBLISHING_MS);
  // Tenancy enumerator (like reconcileAllEnabledColleges): colleges with stuck notices, then a per-college query.
  const collegeIds = await Notice.distinct('collegeId', { status: 'publishing', createdAt: { $lt: cutoff } });
  let emitted = 0;
  for (const cid of collegeIds) {
    const stuck = await Notice.find({ collegeId: cid, status: 'publishing', createdAt: { $lt: cutoff } }).select('_id').limit(100).lean();
    for (const n of stuck) {
      const id = String(n._id);
      if (await emit(NOTICE_EVENTS.published, { collegeId: String(cid), noticeId: id }, noticeEventKey.published(id))) emitted += 1;
    }
  }
  return emitted;
}

export function registerNoticeConsumers(): void {
  registerConsumer(NOTICE_EVENTS.published, fanOutNotice);
  registerSweeper(async () => { await sweepStuckNotices(); });
}
```

In `backend/src/modules/juvi-app/routes.ts`, register the consumers once at module load (the dispatcher and inline `kick()` both need them):

```ts
import { Router } from 'express';
import { mobileErrorHandler, MobileApiError } from './errors';
import { configRouter } from './config/routes';
import { accountsRouter } from './accounts/routes';
import { spacesRouter } from './spaces/routes';
import { adminRouter } from './admin/routes';
import { registerNoticeConsumers } from './notices/consumers';

// Outbox consumers for notices; the dispatcher (server.ts) and inline kick() both run them.
registerNoticeConsumers();

export const v1Router = Router();
```

- [ ] **Step 9: Run the tests and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-publish.e2e.test.ts src/__e2e__/modules/juvi-notices-fanout-5000.e2e.test.ts && npx vitest run src/modules/juvi-app src/shared/outbox && npm run typecheck`
Expected: PASS (publish 13 tests, fan-out 1 test printing `FANOUT-5000 elapsed=<ms>` well under 60000; unit suites unchanged); typecheck clean.

- [ ] **Step 10: Commit**

```bash
git add backend/src/modules/juvi-app/notices backend/src/modules/juvi-app/routes.ts backend/src/__e2e__/factories/notice.factory.ts backend/src/__e2e__/modules/juvi-notices-publish.e2e.test.ts backend/src/__e2e__/modules/juvi-notices-fanout-5000.e2e.test.ts
git commit -m "feat(juvi-app): publish notices with scoped audiences, attachments, preview and an idempotent 1,000-row-batch fan-out

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Mobile read APIs — attention, segments, detail, seen, attachment URL

**Files:**
- Create: `backend/src/modules/juvi-app/notices/schemas.ts`, `backend/src/modules/juvi-app/notices/cards.ts`, `backend/src/modules/juvi-app/notices/mobile-service.ts`, `backend/src/modules/juvi-app/notices/mobile-controller.ts`, `backend/src/modules/juvi-app/notices/mobile-routes.ts`
- Modify: `backend/src/modules/juvi-app/errors.ts:5-8` (new codes), `backend/src/modules/juvi-app/routes.ts` (mount `noticesRouter`), `backend/src/__e2e__/modules/__snapshots__/rbac-route-walk.test.ts.snap`
- Test: `backend/src/modules/juvi-app/notices/__tests__/cards.test.ts`, `backend/src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts`

**Interfaces:**
- Consumes: `LeanNotice`, `Notice`, `LeanNoticeRecipient`, `NoticeRecipient` (Task 2); `MobileContext`, `MobileRequest`, `requireMobile`, `authenticateMobile` (`middleware/authenticate-mobile.ts:7,22,103,34`); `MobileApiError` (`errors.ts:12`); `getPresignedUrl`, `isS3Configured` (`shared/s3/s3-client.ts:239,147`); Task 4 factory `activateAccount`, `publishTestNotice`, `signInAs`, `erpRef`.
- Produces:
  ```ts
  // errors.ts
  export type MobileErrorCode = … | 'NOTICE_NOT_FOUND' | 'ALREADY_ACKNOWLEDGED' | 'NOTICE_ARCHIVED' | 'NOT_PUBLISHER' | 'REMINDER_LIMIT' | 'ACK_REQUIRED' | 'ACK_NOT_REQUIRED';
  // schemas.ts
  export const NOTICE_STATES: readonly ['received', 'seen', 'acknowledged', 'dismissed']; export type NoticeState;
  export const NOTICE_SEGMENTS: readonly ['due', 'done', 'all', 'published'];
  export const noticeAttachmentSchema, noticeCardSchema, noticeDetailSchema, attentionResponseSchema, noticeListQuerySchema, noticeListResponseSchema, seenResponseSchema, attachmentUrlResponseSchema;
  export type NoticeCard, NoticeDetail, AttentionResponse, NoticeListQuery, NoticeListResponse;
  // cards.ts
  export const PREVIEW_CHARS = 160;
  export function noticeState(row: Pick<LeanNoticeRecipient, 'ack' | 'dismissedAt' | 'seenAt'> | null): NoticeState;
  export function previewOf(body: string): string;
  export function toCard(notice: LeanNotice, row: LeanNoticeRecipient | null, viewerUserId: string): NoticeCard;
  export function toDetail(notice: LeanNotice, row: LeanNoticeRecipient | null, viewerUserId: string): NoticeDetail;
  // mobile-service.ts
  export const ATTENTION_ITEMS = 3; export const DUE_SCAN_MAX = 500; export const ATTACHMENT_URL_TTL_SECONDS = 300;
  export function noticeNotFound(): MobileApiError;
  export function recipientContext(ctx: MobileContext, noticeId: string): Promise<{ notice: LeanNotice; row: LeanNoticeRecipient }>;
  export function encodeCursor(c: { t?: string; id?: string; o?: number }): string;
  export function decodeCursor(raw: string): { t?: string; id?: string; o?: number };
  export function attention(ctx: MobileContext): Promise<AttentionResponse>;
  export function listNotices(ctx: MobileContext, q: NoticeListQuery): Promise<NoticeListResponse>;
  export function getNoticeDetail(ctx: MobileContext, noticeId: string): Promise<NoticeDetail>;
  export function markSeen(ctx: MobileContext, noticeId: string): Promise<{ seenAt: string }>;
  export function attachmentUrl(ctx: MobileContext, noticeId: string, key: string): Promise<{ url: string; expiresAt: string }>;
  // mobile-routes.ts
  export const noticesRouter: Router;
  ```

Decisions that bind later tasks:
- The card never carries an object-or-null field: nullable values are scalars (`deadline`, `publishedAt`, `seenAt`, `ackAt`, `remindedAt`, and on the detail `ackMethod`, `ackComment`, `ackClientAt`, `dismissedAt`). The ack record is flattened onto the detail.
- Notice ids in mobile paths are not validated with `objectId`: a malformed id is just another notice the caller cannot see, so it returns 404 `NOTICE_NOT_FOUND` (spec §7.1: anything without a recipient row is 404).
- An attachment key outside `notice.attachments` returns 404 `NOT_FOUND` (the notice is visible, the file is not); no storage returns 503 `INTERNAL`.
- Due = `ackRequired`, not acknowledged, not dismissed, row not archived **and** notice status `published` (so an archive is honoured before its consumer mirrors it onto rows). The attention `dueCount` and the `due` segment come from the same function, so they always agree (US-3.2).
- Cursors are opaque base64url JSON: keyset `{ t, id }` on `receivedAt` (done, all) or `createdAt` (published), and an offset `{ o }` for `due`, whose order (deadline, nulls last) is computed in memory over at most 500 rows.
- `noticesRouter` authenticates per route and is mounted **before** `spacesRouter`, whose router-wide `use(authenticateMobile)` would otherwise run first for every later path.

- [ ] **Step 1: Write the failing card tests**

```ts
// backend/src/modules/juvi-app/notices/__tests__/cards.test.ts
import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { LeanNotice } from '../../../../models/juvi/Notice';
import { LeanNoticeRecipient } from '../../../../models/juvi/NoticeRecipient';
import { toCard, toDetail, noticeState, previewOf, PREVIEW_CHARS } from '../cards';

const publisherUser = new Types.ObjectId();
const notice = (over: Partial<LeanNotice> = {}): LeanNotice => ({
  _id: new Types.ObjectId(), collegeId: new Types.ObjectId(), title: 'Exam timetable', body: 'Line one.\n\n   Line two.',
  attachments: [{ key: 'colleges/c/notices/u', name: 'a.pdf', mime: 'application/pdf', size: 10 }],
  publisher: { userId: publisherUser, office: 'Exam Section' }, audience: { rules: [], line: 'Sent to 2024 Batch' },
  channelIds: [], ackRequired: true, ackDeadline: new Date('2026-10-01T10:00:00.000Z'), ackCommentAllowed: true,
  priority: 'important', purpose: 'standard', status: 'published', counts: { audience: 2, onJuvi: 1 }, reminders: [],
  publishedAt: new Date('2026-09-26T10:00:00.000Z'), createdAt: new Date(), updatedAt: new Date(), ...over,
});
const row = (over: Partial<LeanNoticeRecipient> = {}): LeanNoticeRecipient => ({
  _id: new Types.ObjectId(), collegeId: new Types.ObjectId(), noticeId: new Types.ObjectId(), personId: new Types.ObjectId(),
  accountId: new Types.ObjectId(), kind: 'student', labels: {}, addedLater: false, ackRequired: true, deadline: null,
  receivedAt: new Date(), seenAt: null, dismissedAt: null, remindedAt: null, ack: null, archived: false, ...over,
});
const ack = { at: new Date('2026-10-02T09:00:00.000Z'), late: true, method: 'confirm' as const, sessionId: new Types.ObjectId(), offline: true, clientAt: new Date('2026-09-30T09:00:00.000Z'), comment: 'Noted' };

describe('noticeState', () => {
  it('acknowledged beats dismissed beats seen beats received', () => {
    expect(noticeState(null)).toBe('received');
    expect(noticeState(row())).toBe('received');
    expect(noticeState(row({ seenAt: new Date() }))).toBe('seen');
    expect(noticeState(row({ seenAt: new Date(), dismissedAt: new Date() }))).toBe('dismissed');
    expect(noticeState(row({ seenAt: new Date(), ack }))).toBe('acknowledged');
  });
});

describe('previewOf', () => {
  it('collapses whitespace and truncates with an ellipsis', () => {
    expect(previewOf('Line one.\n\n   Line two.')).toBe('Line one. Line two.');
    const long = previewOf('x'.repeat(500));
    expect(long).toHaveLength(PREVIEW_CHARS);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('toCard', () => {
  it('renders the card with ISO dates and my state', () => {
    const n = notice();
    const card = toCard(n, row({ seenAt: new Date('2026-09-27T08:00:00.000Z'), remindedAt: new Date('2026-09-28T08:00:00.000Z') }), String(new Types.ObjectId()));
    expect(card).toEqual({
      id: String(n._id), title: 'Exam timetable', preview: 'Line one. Line two.', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch',
      priority: 'important', purpose: 'standard', ackRequired: true, ackCommentAllowed: true,
      deadline: '2026-10-01T10:00:00.000Z', publishedAt: '2026-09-26T10:00:00.000Z', archived: false, attachmentCount: 1,
      state: 'seen', seenAt: '2026-09-27T08:00:00.000Z', ackAt: null, late: false, remindedAt: '2026-09-28T08:00:00.000Z', isPublisher: false,
    });
  });

  it('marks the publisher, archived notices or rows, and late acknowledgements', () => {
    expect(toCard(notice(), row(), String(publisherUser)).isPublisher).toBe(true);
    expect(toCard(notice({ publisher: { office: 'Juvi' } }), row(), String(publisherUser)).isPublisher).toBe(false);
    expect(toCard(notice({ status: 'archived' }), row(), 'u').archived).toBe(true);
    expect(toCard(notice(), row({ archived: true }), 'u').archived).toBe(true);
    expect(toCard(notice(), row({ ack }), 'u')).toMatchObject({ state: 'acknowledged', ackAt: '2026-10-02T09:00:00.000Z', late: true });
    expect(toCard(notice({ ackDeadline: null, publishedAt: undefined }), null, 'u')).toMatchObject({ deadline: null, publishedAt: null, state: 'received', seenAt: null });
  });
});

describe('toDetail', () => {
  it('adds the body, the attachment list and the flattened acknowledgement', () => {
    const d = toDetail(notice(), row({ ack, seenAt: new Date() }), 'u');
    expect(d).toMatchObject({
      body: 'Line one.\n\n   Line two.', attachments: [{ key: 'colleges/c/notices/u', name: 'a.pdf', mime: 'application/pdf', size: 10 }],
      ackMethod: 'confirm', ackOffline: true, ackComment: 'Noted', ackClientAt: '2026-09-30T09:00:00.000Z', dismissedAt: null,
    });
    expect(toDetail(notice(), row(), 'u')).toMatchObject({ ackMethod: null, ackOffline: false, ackComment: null, ackClientAt: null });
  });
});
```

- [ ] **Step 2: Write the failing integration tests**

```ts
// backend/src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const s3 = vi.hoisted(() => ({ configured: true }));
vi.mock('../../shared/s3/s3-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/s3/s3-client')>()),
  isS3Configured: () => s3.configured,
  getPresignedUrl: async (key: string, opts?: { expiresIn?: number }) => ({
    url: `https://s3.test/${encodeURIComponent(key)}?X-Amz-Expires=${opts?.expiresIn}`,
    expiresAt: new Date(Date.now() + (opts?.expiresIn ?? 3600) * 1000),
  }),
}));

import type { Express } from 'express';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient } from '../factories/juvi.factory';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { activateAccount, publishTestNotice, signInAs, erpRef } from '../factories/notice.factory';
import { Notice, LeanNotice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { drainOutbox } from '../../shared/outbox';

// Many requests from one IP: bypass the global limiter (each e2e file runs in its own fork).
process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const ids = (items: { id: string }[]) => items.map((c) => c.id);

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); s3.configured = true; });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

/** A student with an active ("on Juvi") account and a mobile token. */
async function studentOnJuvi(deviceId: string) {
  const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  await activateAccount(String(s.account._id));
  return { ...s, token: await signInAs(app, fx, s.student.rollNumber, s.tempPassword, deviceId) };
}

describe('GET /attention and the due segment (US-3.1, US-3.2)', () => {
  it('lists up to three due notices by deadline with no-deadline last, and dueCount matches the due segment', async () => {
    const a = await studentOnJuvi('dev-a');
    const n1 = await publishTestNotice(fx, { title: 'N1', ackRequired: true, ackDeadline: inDays(2) });
    const n2 = await publishTestNotice(fx, { title: 'N2', ackRequired: true, ackDeadline: inDays(1) });
    const n3 = await publishTestNotice(fx, { title: 'N3', ackRequired: true });
    const n4 = await publishTestNotice(fx, { title: 'N4', ackRequired: true, ackDeadline: inDays(3) });
    await publishTestNotice(fx, { title: 'FYI' });   // no acknowledgement: never due

    const res = await mobileClient(app, a.token).get(`${V1}/attention`).expect(200);
    expect(res.body.dueCount).toBe(4);
    expect(ids(res.body.items)).toEqual([n2, n1, n4].map((n) => String(n._id)));
    expect(res.body.items[0]).toMatchObject({
      title: 'N2', office: 'College Office', audienceLine: 'Sent to 2024 Batch', ackRequired: true, state: 'received',
      archived: false, isPublisher: false, seenAt: null, ackAt: null, late: false, deadline: new Date(n2.ackDeadline!).toISOString(),
    });

    const due = await mobileClient(app, a.token).get(`${V1}/notices?segment=due`).expect(200);
    expect(ids(due.body.items)).toEqual([n2, n1, n4, n3].map((n) => String(n._id)));
    expect(due.body.items).toHaveLength(res.body.dueCount);
    expect(due.body.nextCursor).toBeNull();

    const p1 = await mobileClient(app, a.token).get(`${V1}/notices?segment=due&limit=2`).expect(200);
    const p2 = await mobileClient(app, a.token).get(`${V1}/notices?segment=due&limit=2&cursor=${p1.body.nextCursor}`).expect(200);
    expect([...ids(p1.body.items), ...ids(p2.body.items)]).toEqual(ids(due.body.items));
    expect(p2.body.nextCursor).toBeNull();
  });

  it('is clear when nothing is due: acknowledged, archived and Not-on-Juvi rows are excluded', async () => {
    const a = await studentOnJuvi('dev-a');
    const acked = await publishTestNotice(fx, { title: 'Acked', ackRequired: true });
    const archived = await publishTestNotice(fx, { title: 'Archived', ackRequired: true });
    await NoticeRecipient.updateOne({ noticeId: acked._id, accountId: a.account._id }, { $set: { ack: { at: new Date(), late: false, method: 'hold', sessionId: new Types.ObjectId(), offline: false } } });
    await Notice.updateOne({ _id: archived._id }, { $set: { status: 'archived' } });   // rows not mirrored yet: the notice status alone excludes it
    expect((await mobileClient(app, a.token).get(`${V1}/attention`).expect(200)).body).toEqual({ dueCount: 0, items: [] });

    const c = await provisionTestStudent(fx);                      // onboarding: Not on Juvi
    const tc = await signInAs(app, fx, c.student.rollNumber, c.tempPassword, 'dev-c');
    await publishTestNotice(fx, { title: 'Later', ackRequired: true });
    expect((await mobileClient(app, tc).get(`${V1}/attention`).expect(200)).body.dueCount).toBe(0);
  });
});

describe('GET /notices segments and paging (US-3.5)', () => {
  it('all pages through every received notice newest first; done lists acknowledged and dismissed; a bad cursor is 400', async () => {
    const a = await studentOnJuvi('dev-a');
    const published: LeanNotice[] = [];
    for (const title of ['One', 'Two', 'Three', 'Four', 'Five']) published.push(await publishTestNotice(fx, { title }));
    const titles: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await mobileClient(app, a.token).get(`${V1}/notices?segment=all&limit=2${cursor ? `&cursor=${cursor}` : ''}`).expect(200);
      titles.push(...res.body.items.map((c: { title: string }) => c.title));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(titles).toEqual(['Five', 'Four', 'Three', 'Two', 'One']);

    await NoticeRecipient.updateOne({ noticeId: published[1]!._id, accountId: a.account._id }, { $set: { seenAt: new Date(), dismissedAt: new Date() } });
    const done = await mobileClient(app, a.token).get(`${V1}/notices?segment=done`).expect(200);
    expect(done.body.items.map((c: { title: string; state: string }) => [c.title, c.state])).toEqual([['Two', 'dismissed']]);
    const bad = await mobileClient(app, a.token).get(`${V1}/notices?segment=all&cursor=not-a-cursor`).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('filters by office', async () => {
    const a = await studentOnJuvi('dev-a');
    await publishTestNotice(fx, { title: 'From placement', office: 'Placement' });
    await publishTestNotice(fx, { title: 'From the office' });
    const res = await mobileClient(app, a.token).get(`${V1}/notices?office=Placement`).expect(200);
    expect(res.body.items.map((c: { title: string; office: string }) => [c.title, c.office])).toEqual([['From placement', 'Placement']]);
  });

  it('published lists what the caller published, marked isPublisher, even without a recipient row', async () => {
    const a = await studentOnJuvi('dev-a');
    const fac = await provisionTestFaculty(fx);
    await activateAccount(String(fac.account._id));
    const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id) });
    const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
    await off.updateOne({ $set: { status: 'active' } });
    await createTestEnrollment(fx.collegeId, { studentId: String(a.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
    const mine = await publishTestNotice(fx, { title: 'Lab moved', audience: { rules: [{ kind: 'course_offering', ids: [String(off._id)] }] } }, erpRef(fac.user));
    await publishTestNotice(fx, { title: 'Office notice' });

    const tf = await signInAs(app, fx, fac.faculty.employeeCode, fac.tempPassword, 'dev-f');
    const res = await mobileClient(app, tf).get(`${V1}/notices?segment=published`).expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ id: String(mine._id), title: 'Lab moved', office: 'Course Faculty', isPublisher: true, state: 'received' });
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${mine._id}`).expect(200)).body.isPublisher).toBe(false);
    expect((await mobileClient(app, a.token).get(`${V1}/notices?segment=published`).expect(200)).body.items).toEqual([]);
  });
});

describe('GET /notices/:id and POST /notices/:id/seen (US-2.1, US-2.5, US-2.6)', () => {
  it('returns the detail with my state; reading never marks seen; seen is set once', async () => {
    const a = await studentOnJuvi('dev-a');
    const key = `colleges/${fx.collegeId}/notices/${new Types.ObjectId()}`;
    const n = await publishTestNotice(fx, { title: 'Timetable', body: 'Attached.', ackRequired: true, ackCommentAllowed: true, attachments: [{ key, name: 'timetable.pdf', mime: 'application/pdf', size: 1234 }] });
    await mobileClient(app, a.token).get(`${V1}/notices`).expect(200);
    const d = await mobileClient(app, a.token).get(`${V1}/notices/${n._id}`).expect(200);
    expect(d.body).toMatchObject({
      id: String(n._id), body: 'Attached.', attachments: [{ key, name: 'timetable.pdf', mime: 'application/pdf', size: 1234 }], attachmentCount: 1,
      state: 'received', seenAt: null, ackMethod: null, ackComment: null, ackOffline: false, dismissedAt: null, ackCommentAllowed: true,
    });
    expect((await NoticeRecipient.findOne({ noticeId: n._id, accountId: a.account._id }).lean())!.seenAt).toBeNull();

    const s1 = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/seen`).expect(200);
    const s2 = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/seen`).expect(200);
    expect(s2.body.seenAt).toBe(s1.body.seenAt);
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${n._id}`)).body).toMatchObject({ state: 'seen', seenAt: s1.body.seenAt });
  });

  it('is 404 NOTICE_NOT_FOUND without a recipient row or for a malformed id; an archived notice stays readable', async () => {
    const a = await studentOnJuvi('dev-a');
    const b = await studentOnJuvi('dev-b');
    const onlyA = await publishTestNotice(fx, { audience: { rules: [{ kind: 'custom', ids: [String(a.person._id)] }] } });
    for (const path of [`/notices/${onlyA._id}`, `/notices/${onlyA._id}/attachments/x`]) {
      expect((await mobileClient(app, b.token).get(`${V1}${path}`).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
    }
    expect((await mobileClient(app, b.token).post(`${V1}/notices/${onlyA._id}/seen`).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
    expect((await mobileClient(app, a.token).get(`${V1}/notices/not-an-id`).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
    await Notice.updateOne({ _id: onlyA._id }, { $set: { status: 'archived' } });
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${onlyA._id}`).expect(200)).body.archived).toBe(true);
  });
});

describe('GET /notices/:id/attachments/:key (spec §10)', () => {
  it('signs a 5-minute URL only for a key in the notice list, and is 503 without storage', async () => {
    const a = await studentOnJuvi('dev-a');
    const key = `colleges/${fx.collegeId}/notices/${new Types.ObjectId()}`;
    const n = await publishTestNotice(fx, { attachments: [{ key, name: 'a.pdf', mime: 'application/pdf', size: 10 }] });
    const ok = await mobileClient(app, a.token).get(`${V1}/notices/${n._id}/attachments/${encodeURIComponent(key)}`).expect(200);
    expect(ok.body.url).toContain('X-Amz-Expires=300');
    const ttl = new Date(ok.body.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(290_000);
    expect(ttl).toBeLessThanOrEqual(300_000);

    const probe = `colleges/${fx.collegeId}/notices/${new Types.ObjectId()}`;
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${n._id}/attachments/${encodeURIComponent(probe)}`).expect(404)).body.error.code).toBe('NOT_FOUND');
    s3.configured = false;
    await mobileClient(app, a.token).get(`${V1}/notices/${n._id}/attachments/${encodeURIComponent(key)}`).expect(503);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/notices/__tests__/cards.test.ts && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts`
Expected: FAIL with "Cannot find module '../cards'" (unit) and 404 `NOT_FOUND` "Route not found" on `/attention` (e2e).

- [ ] **Step 4: Add the error codes**

In `backend/src/modules/juvi-app/errors.ts`, replace the `MobileErrorCode` union:

```ts
export type MobileErrorCode =
  | 'VALIDATION_FAILED' | 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'SESSION_INVALIDATED'
  | 'ACCOUNT_DEACTIVATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'GONE' | 'UPDATE_REQUIRED'
  | 'COOLDOWN' | 'INSTITUTION_PAUSED' | 'INTERNAL'
  // Juvi notices (notices spec §7.1)
  | 'NOTICE_NOT_FOUND' | 'ALREADY_ACKNOWLEDGED' | 'NOTICE_ARCHIVED' | 'NOT_PUBLISHER'
  | 'REMINDER_LIMIT' | 'ACK_REQUIRED' | 'ACK_NOT_REQUIRED';
```

- [ ] **Step 5: Implement the schemas and the cards**

```ts
// backend/src/modules/juvi-app/notices/schemas.ts
/**
 * Mobile contract for notices. No object-or-null fields (Foundation rulings
 * R57/R61): nested objects are always present and nullable values are scalars.
 */
import { z } from 'zod';

export const NOTICE_STATES = ['received', 'seen', 'acknowledged', 'dismissed'] as const;
export type NoticeState = (typeof NOTICE_STATES)[number];
export const NOTICE_SEGMENTS = ['due', 'done', 'all', 'published'] as const;

export const noticeAttachmentSchema = z.object({ key: z.string(), name: z.string(), mime: z.string(), size: z.number().int() });

export const noticeCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  preview: z.string(),
  office: z.string(),
  audienceLine: z.string(),
  priority: z.enum(['routine', 'important', 'urgent']),
  purpose: z.enum(['standard', 'welcome']),
  ackRequired: z.boolean(),
  ackCommentAllowed: z.boolean(),
  deadline: z.string().nullable(),
  publishedAt: z.string().nullable(),
  archived: z.boolean(),
  attachmentCount: z.number().int(),
  state: z.enum(NOTICE_STATES),
  seenAt: z.string().nullable(),
  ackAt: z.string().nullable(),
  late: z.boolean(),
  remindedAt: z.string().nullable(),
  isPublisher: z.boolean(),
});
export type NoticeCard = z.infer<typeof noticeCardSchema>;

export const noticeDetailSchema = noticeCardSchema.extend({
  body: z.string(),
  attachments: z.array(noticeAttachmentSchema),
  ackMethod: z.enum(['hold', 'confirm']).nullable(),
  ackOffline: z.boolean(),
  ackComment: z.string().nullable(),
  ackClientAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
});
export type NoticeDetail = z.infer<typeof noticeDetailSchema>;

export const attentionResponseSchema = z.object({ dueCount: z.number().int(), items: z.array(noticeCardSchema) });
export type AttentionResponse = z.infer<typeof attentionResponseSchema>;

export const noticeListQuerySchema = z.object({
  segment: z.enum(NOTICE_SEGMENTS).default('all'),
  office: z.string().trim().min(1).max(60).optional(),
  cursor: z.string().min(1).max(300).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NoticeListQuery = z.infer<typeof noticeListQuerySchema>;
export const noticeListResponseSchema = z.object({ items: z.array(noticeCardSchema), nextCursor: z.string().nullable() });
export type NoticeListResponse = z.infer<typeof noticeListResponseSchema>;

export const seenResponseSchema = z.object({ seenAt: z.string() });
export const attachmentUrlResponseSchema = z.object({ url: z.string(), expiresAt: z.string() });
```

```ts
// backend/src/modules/juvi-app/notices/cards.ts
import { LeanNotice } from '../../../models/juvi/Notice';
import { LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { NoticeCard, NoticeDetail, NoticeState } from './schemas';

export const PREVIEW_CHARS = 160;

const iso = (d?: Date | null): string | null => (d ? new Date(d).toISOString() : null);

/** received → seen → acknowledged | dismissed (spec §2 goal 3). */
export function noticeState(row: Pick<LeanNoticeRecipient, 'ack' | 'dismissedAt' | 'seenAt'> | null): NoticeState {
  if (!row) return 'received';
  if (row.ack) return 'acknowledged';
  if (row.dismissedAt) return 'dismissed';
  if (row.seenAt) return 'seen';
  return 'received';
}

export function previewOf(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_CHARS ? `${flat.slice(0, PREVIEW_CHARS - 1)}…` : flat;
}

/** `row` is null only in the publisher's `published` segment, for a notice they did not receive. */
export function toCard(notice: LeanNotice, row: LeanNoticeRecipient | null, viewerUserId: string): NoticeCard {
  return {
    id: String(notice._id),
    title: notice.title,
    preview: previewOf(notice.body),
    office: notice.publisher.office,
    audienceLine: notice.audience.line,
    priority: notice.priority,
    purpose: notice.purpose,
    ackRequired: notice.ackRequired,
    ackCommentAllowed: notice.ackCommentAllowed,
    deadline: iso(notice.ackDeadline),
    publishedAt: iso(notice.publishedAt),
    archived: notice.status === 'archived' || Boolean(row?.archived),
    attachmentCount: notice.attachments.length,
    state: noticeState(row),
    seenAt: iso(row?.seenAt),
    ackAt: iso(row?.ack?.at),
    late: Boolean(row?.ack?.late),
    remindedAt: iso(row?.remindedAt),
    isPublisher: notice.publisher.userId ? String(notice.publisher.userId) === viewerUserId : false,
  };
}

export function toDetail(notice: LeanNotice, row: LeanNoticeRecipient | null, viewerUserId: string): NoticeDetail {
  return {
    ...toCard(notice, row, viewerUserId),
    body: notice.body,
    attachments: notice.attachments.map(({ key, name, mime, size }) => ({ key, name, mime, size })),
    ackMethod: row?.ack?.method ?? null,
    ackOffline: Boolean(row?.ack?.offline),
    ackComment: row?.ack?.comment ?? null,
    ackClientAt: iso(row?.ack?.clientAt),
    dismissedAt: iso(row?.dismissedAt),
  };
}
```

- [ ] **Step 6: Implement the service, controller and routes**

```ts
// backend/src/modules/juvi-app/notices/mobile-service.ts
/**
 * Mobile reads (spec §7.1). Every read requires the caller's recipient row
 * (accountId = the caller's account); anything else is 404 NOTICE_NOT_FOUND.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient, LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { getPresignedUrl, isS3Configured } from '../../../shared/s3/s3-client';
import { MobileContext } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { toCard, toDetail } from './cards';
import { AttentionResponse, NoticeDetail, NoticeListQuery, NoticeListResponse } from './schemas';

export const ATTENTION_ITEMS = 3;
export const DUE_SCAN_MAX = 500;
export const ATTACHMENT_URL_TTL_SECONDS = 300;

interface Cursor { t?: string; id?: string; o?: number }
interface Pair { notice: LeanNotice; row: LeanNoticeRecipient }

export const noticeNotFound = () => new MobileApiError(404, 'NOTICE_NOT_FOUND', 'This notice is not available.');
const badCursor = () => new MobileApiError(400, 'VALIDATION_FAILED', 'That page cursor is not valid.');

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (c && typeof c === 'object' && !Array.isArray(c)) return c as Cursor;
  } catch { /* fall through */ }
  throw badCursor();
}

/** Keyset continuation on (field desc, _id desc). */
function after(field: string, raw?: string): Record<string, unknown> | null {
  if (!raw) return null;
  const c = decodeCursor(raw);
  if (typeof c.t !== 'string' || Number.isNaN(Date.parse(c.t)) || typeof c.id !== 'string' || !Types.ObjectId.isValid(c.id)) throw badCursor();
  const t = new Date(c.t);
  const id = new Types.ObjectId(c.id);
  return { $or: [{ [field]: { $lt: t } }, { [field]: t, _id: { $lt: id } }] };
}

function offsetOf(raw?: string): number {
  if (!raw) return 0;
  const c = decodeCursor(raw);
  if (typeof c.o !== 'number' || !Number.isInteger(c.o) || c.o < 0) throw badCursor();
  return c.o;
}

/** The caller's recipient row and its notice. */
export async function recipientContext(ctx: MobileContext, noticeId: string): Promise<Pair> {
  if (!Types.ObjectId.isValid(noticeId)) throw noticeNotFound();
  const row = await NoticeRecipient.findOne({ collegeId: ctx.collegeId, noticeId, accountId: ctx.accountId }).lean<LeanNoticeRecipient>();
  const notice = row
    ? await Notice.findOne({ _id: noticeId, collegeId: ctx.collegeId, status: { $in: ['published', 'archived'] } }).lean<LeanNotice>()
    : null;
  if (!row || !notice) throw noticeNotFound();
  return { notice, row };
}

async function noticesById(collegeId: string, ids: Types.ObjectId[], statuses: string[]): Promise<Map<string, LeanNotice>> {
  const rows = await Notice.find({ collegeId, _id: { $in: ids }, status: { $in: statuses } }).lean<LeanNotice[]>();
  return new Map(rows.map((n) => [String(n._id), n]));
}

const time = (d?: Date | null) => (d ? new Date(d).getTime() : Number.POSITIVE_INFINITY);

/** Acknowledgement-required, not acknowledged, not dismissed, not archived; deadline ascending with nulls last, then receivedAt. */
async function loadDue(ctx: MobileContext): Promise<Pair[]> {
  const rows = await NoticeRecipient.find({
    collegeId: ctx.collegeId, accountId: ctx.accountId, ackRequired: true, ack: null, dismissedAt: null, archived: false,
  }).sort({ receivedAt: 1 }).limit(DUE_SCAN_MAX).lean<LeanNoticeRecipient[]>();
  const byId = await noticesById(ctx.collegeId, rows.map((r) => r.noticeId), ['published']);
  const due = rows.flatMap((row) => { const notice = byId.get(String(row.noticeId)); return notice ? [{ notice, row }] : []; });
  due.sort((a, b) => {
    const da = time(a.row.deadline); const db = time(b.row.deadline);
    if (da !== db) return da < db ? -1 : 1;
    return time(a.row.receivedAt) - time(b.row.receivedAt);
  });
  return due;
}

export async function attention(ctx: MobileContext): Promise<AttentionResponse> {
  const due = await loadDue(ctx);
  return { dueCount: due.length, items: due.slice(0, ATTENTION_ITEMS).map(({ notice, row }) => toCard(notice, row, ctx.userId)) };
}

async function officeNoticeIds(collegeId: string, office: string): Promise<Types.ObjectId[]> {
  return (await Notice.distinct('_id', { collegeId, 'publisher.office': office })) as Types.ObjectId[];
}

export async function listNotices(ctx: MobileContext, q: NoticeListQuery): Promise<NoticeListResponse> {
  if (q.segment === 'due') {
    const due = (await loadDue(ctx)).filter((d) => !q.office || d.notice.publisher.office === q.office);
    const offset = offsetOf(q.cursor);
    const page = due.slice(offset, offset + q.limit);
    return {
      items: page.map(({ notice, row }) => toCard(notice, row, ctx.userId)),
      nextCursor: offset + q.limit < due.length ? encodeCursor({ o: offset + q.limit }) : null,
    };
  }

  if (q.segment === 'published') {
    const clauses: Record<string, unknown>[] = [{ collegeId: ctx.collegeId, 'publisher.userId': new Types.ObjectId(ctx.userId) }];
    if (q.office) clauses.push({ 'publisher.office': q.office });
    const cont = after('createdAt', q.cursor);
    if (cont) clauses.push(cont);
    const notices = await Notice.find({ $and: clauses }).sort({ createdAt: -1, _id: -1 }).limit(q.limit + 1).lean<LeanNotice[]>();
    const page = notices.slice(0, q.limit);
    const rows = await NoticeRecipient.find({ collegeId: ctx.collegeId, accountId: ctx.accountId, noticeId: { $in: page.map((n) => n._id) } }).lean<LeanNoticeRecipient[]>();
    const rowBy = new Map(rows.map((r) => [String(r.noticeId), r]));
    const last = page[page.length - 1];
    return {
      items: page.map((n) => toCard(n, rowBy.get(String(n._id)) ?? null, ctx.userId)),
      nextCursor: notices.length > q.limit && last ? encodeCursor({ t: new Date(last.createdAt).toISOString(), id: String(last._id) }) : null,
    };
  }

  // done | all: the caller's rows, newest received first.
  const clauses: Record<string, unknown>[] = [{ collegeId: ctx.collegeId, accountId: new Types.ObjectId(ctx.accountId) }];
  if (q.segment === 'done') clauses.push({ $or: [{ ack: { $ne: null } }, { dismissedAt: { $ne: null } }] });
  if (q.office) clauses.push({ noticeId: { $in: await officeNoticeIds(ctx.collegeId, q.office) } });
  const cont = after('receivedAt', q.cursor);
  if (cont) clauses.push(cont);
  const rows = await NoticeRecipient.find({ $and: clauses }).sort({ receivedAt: -1, _id: -1 }).limit(q.limit + 1).lean<LeanNoticeRecipient[]>();
  const page = rows.slice(0, q.limit);
  const byId = await noticesById(ctx.collegeId, page.map((r) => r.noticeId), ['published', 'archived']);
  const last = page[page.length - 1];
  return {
    items: page.flatMap((row) => { const n = byId.get(String(row.noticeId)); return n ? [toCard(n, row, ctx.userId)] : []; }),
    nextCursor: rows.length > q.limit && last?.receivedAt ? encodeCursor({ t: new Date(last.receivedAt).toISOString(), id: String(last._id) }) : null,
  };
}

export async function getNoticeDetail(ctx: MobileContext, noticeId: string): Promise<NoticeDetail> {
  const { notice, row } = await recipientContext(ctx, noticeId);
  return toDetail(notice, row, ctx.userId);
}

/** Sets seenAt once; later calls return the first value (US-2.1). */
export async function markSeen(ctx: MobileContext, noticeId: string): Promise<{ seenAt: string }> {
  const { row } = await recipientContext(ctx, noticeId);
  if (!row.seenAt) await NoticeRecipient.updateOne({ _id: row._id, collegeId: ctx.collegeId, seenAt: null }, { $set: { seenAt: new Date() } });
  const fresh = await NoticeRecipient.findOne({ _id: row._id, collegeId: ctx.collegeId }).select('seenAt').lean();
  return { seenAt: new Date(fresh!.seenAt!).toISOString() };
}

/** A 5-minute URL, only for a key in the notice's own attachment list (spec §10). */
export async function attachmentUrl(ctx: MobileContext, noticeId: string, key: string): Promise<{ url: string; expiresAt: string }> {
  const { notice } = await recipientContext(ctx, noticeId);
  if (!notice.attachments.some((a) => a.key === key)) throw new MobileApiError(404, 'NOT_FOUND', 'Attachment not found');
  if (!isS3Configured()) throw new MobileApiError(503, 'INTERNAL', 'Attachments are unavailable right now. Please try again later.');
  const signed = await getPresignedUrl(key, { expiresIn: ATTACHMENT_URL_TTL_SECONDS });
  return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
}
```

```ts
// backend/src/modules/juvi-app/notices/mobile-controller.ts
import { Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { noticeListQuerySchema } from './schemas';
import * as svc from './mobile-service';

// Notice ids are passed through unparsed: a malformed id is 404 NOTICE_NOT_FOUND, like any notice the caller cannot see.
const id = (req: MobileRequest) => String(req.params.id);

export async function attention(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.attention(requireMobile(req))); } catch (e) { next(e); }
}
export async function list(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.listNotices(requireMobile(req), noticeListQuerySchema.parse(req.query))); } catch (e) { next(e); }
}
export async function detail(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getNoticeDetail(requireMobile(req), id(req))); } catch (e) { next(e); }
}
export async function seen(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.markSeen(requireMobile(req), id(req))); } catch (e) { next(e); }
}
export async function attachmentUrl(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.attachmentUrl(requireMobile(req), id(req), String(req.params.key))); } catch (e) { next(e); }
}
```

```ts
// backend/src/modules/juvi-app/notices/mobile-routes.ts
import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import * as ctrl from './mobile-controller';

/**
 * Mobile notice routes under /api/juvi-app/v1. Authenticated per route (never
 * router-wide) because v1Router mounts this router before spacesRouter.
 */
export const noticesRouter = Router();
noticesRouter.get('/attention', authenticateMobile, ctrl.attention);
noticesRouter.get('/notices', authenticateMobile, ctrl.list);
noticesRouter.get('/notices/:id', authenticateMobile, ctrl.detail);
noticesRouter.post('/notices/:id/seen', authenticateMobile, ctrl.seen);
// The key contains slashes; the app sends it URL-encoded as one path segment.
noticesRouter.get('/notices/:id/attachments/:key', authenticateMobile, ctrl.attachmentUrl);
```

In `backend/src/modules/juvi-app/routes.ts`, import the router and mount it before `spacesRouter`:

```ts
import { noticesRouter } from './notices/mobile-routes';
```

```ts
export const v1Router = Router();
v1Router.use(configRouter);
v1Router.use(accountsRouter);
// Before spacesRouter: its router-wide authenticateMobile would otherwise run first for these paths too.
v1Router.use(noticesRouter);
v1Router.use(spacesRouter);
```

- [ ] **Step 7: Run the tests, refresh the route-walk snapshot, typecheck**

Run: `cd backend && npx vitest run src/modules/juvi-app && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts`
Expected: PASS (cards 5 tests; mobile 8 tests).

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/rbac-route-walk.test.ts -u && git diff --stat -- src/__e2e__/modules/__snapshots__ && git diff -- src/__e2e__/modules/__snapshots__ | grep '^[+-] ' | sort | uniq -c`
Expected: the only added lines are the four new GET routes — `/api/juvi-app/v1/attention`, `/api/juvi-app/v1/notices`, `/api/juvi-app/v1/notices/:id`, `/api/juvi-app/v1/notices/:id/attachments/:key` — each `401`, once per persona (16 lines); no removed lines.

Run: `cd backend && npm run typecheck`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/juvi-app/errors.ts backend/src/modules/juvi-app/routes.ts backend/src/modules/juvi-app/notices backend/src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts backend/src/__e2e__/modules/__snapshots__/rbac-route-walk.test.ts.snap
git commit -m "feat(juvi-app): mobile notice reads — attention, due/done/all/published segments, detail, seen and signed attachment URLs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Acknowledge and dismiss, and the `notice.acknowledged` audit consumer

**Files:**
- Create: `backend/src/modules/juvi-app/notices/ack-service.ts`
- Modify: `backend/src/modules/juvi-app/notices/schemas.ts` (request/response schemas), `backend/src/modules/juvi-app/notices/mobile-controller.ts`, `backend/src/modules/juvi-app/notices/mobile-routes.ts`, `backend/src/modules/juvi-app/notices/consumers.ts`, `backend/src/shared/types.ts:26-50` and `backend/src/shared/audit.ts:27-37` (`AuditAction` `'acknowledge'`)
- Test: `backend/src/modules/juvi-app/notices/__tests__/ack-late.test.ts`, `backend/src/__e2e__/modules/juvi-notices-ack.e2e.test.ts`

**Interfaces:**
- Consumes: `recipientContext` (Task 5 `mobile-service.ts`); `NOTICE_EVENTS`, `noticeEventKey` (Task 4 `publish-service.ts`); `emit`, `kick`, `registerConsumer`, `OutboxPayload` (Task 1); `NoticeRecipient`, `INoticeAck`, `LeanNoticeRecipient`, `ACK_COMMENT_MAX` (Task 2); `Person` (`models/people/Person.ts`); `createAuditLog`, `AuditLog` (`shared/audit.ts`); `MobileSession` (`models/juvi/MobileSession.ts`).
- Produces:
  ```ts
  // schemas.ts (appended)
  export const ackRequestSchema; export type AckRequest = { method: 'hold' | 'confirm'; comment?: string; offline: boolean; clientAt?: string };
  export const ackResponseSchema; export type AckResponse = { ackAt: string; late: boolean; method: 'hold' | 'confirm'; offline: boolean; comment: string | null; clientAt: string | null };
  export const dismissResponseSchema;   // { dismissedAt: string }
  // ack-service.ts
  export function isLate(deadline: Date | null | undefined, receivedAt: Date): boolean;
  export function ackView(ack: INoticeAck): AckResponse;
  export function acknowledge(ctx: MobileContext, noticeId: string, input: AckRequest, now?: Date): Promise<AckResponse>;
  export function dismiss(ctx: MobileContext, noticeId: string, now?: Date): Promise<{ dismissedAt: string }>;
  // consumers.ts (added)
  export function recordAcknowledgement(payload: OutboxPayload): Promise<void>;
  // shared/types.ts
  AuditAction gains 'acknowledge'
  ```

Decisions that bind later tasks:
- Check order for `ack`: no row → 404 `NOTICE_NOT_FOUND`; already acknowledged → 409 `ALREADY_ACKNOWLEDGED` with `{ ack }` in the envelope (so an offline replay of an acknowledged-then-archived notice still reads as success in Plan 3); archived (notice status or row) → 409 `NOTICE_ARCHIVED`; `ackRequired` false → 409 `ACK_NOT_REQUIRED`; a comment on a notice that does not allow one → 400 `VALIDATION_FAILED`.
- The request body is `.strict()`: the client can never send `late`, `at` or `sessionId`. `late` is computed from the server's receipt time; `sessionId` is the caller's `MobileSession`.
- An acknowledgement also sets `seenAt` when it is still null, so reach never shows an acknowledged member as "not seen". A dismissal does the same.
- The audit row is written by the `notice.acknowledged` consumer with `entityType: 'NoticeAcknowledgement'`, `entityId` = the notice id, `action: 'acknowledge'`; `changes[0].newValue` carries `{ recipientId, name, at, late, method, offline, sessionId, hasComment }` — never the comment text. The consumer skips when a row for that `recipientId` exists, so a retried event writes one entry.

- [ ] **Step 1: Write the failing unit tests**

```ts
// backend/src/modules/juvi-app/notices/__tests__/ack-late.test.ts
import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { isLate, ackView } from '../ack-service';
import { ackRequestSchema } from '../schemas';

describe('isLate', () => {
  const deadline = new Date('2026-10-01T10:00:00.000Z');
  it('is false with no deadline, at the deadline and before it; true after it', () => {
    expect(isLate(null, new Date('2030-01-01T00:00:00Z'))).toBe(false);
    expect(isLate(undefined, new Date())).toBe(false);
    expect(isLate(deadline, new Date('2026-10-01T09:59:59.999Z'))).toBe(false);
    expect(isLate(deadline, new Date('2026-10-01T10:00:00.000Z'))).toBe(false);
    expect(isLate(deadline, new Date('2026-10-01T10:00:00.001Z'))).toBe(true);
  });
});

describe('ackView', () => {
  it('renders the record with ISO dates and nulls for the optional fields', () => {
    const at = new Date('2026-10-01T09:00:00.000Z');
    expect(ackView({ at, late: false, method: 'hold', sessionId: new Types.ObjectId(), offline: false }))
      .toEqual({ ackAt: '2026-10-01T09:00:00.000Z', late: false, method: 'hold', offline: false, comment: null, clientAt: null });
    expect(ackView({ at, late: true, method: 'confirm', sessionId: new Types.ObjectId(), offline: true, clientAt: new Date('2026-09-30T00:00:00.000Z'), comment: 'Noted' }))
      .toMatchObject({ late: true, offline: true, comment: 'Noted', clientAt: '2026-09-30T00:00:00.000Z' });
  });
});

describe('ackRequestSchema', () => {
  it('requires a hold or confirm method and defaults offline to false', () => {
    expect(ackRequestSchema.parse({ method: 'hold' })).toEqual({ method: 'hold', offline: false });
    expect(ackRequestSchema.safeParse({ method: 'tap' }).success).toBe(false);
    expect(ackRequestSchema.safeParse({}).success).toBe(false);
  });
  it('caps the comment at 500 characters, requires an ISO clientAt, and refuses server-owned fields', () => {
    expect(ackRequestSchema.safeParse({ method: 'hold', comment: 'x'.repeat(500) }).success).toBe(true);
    expect(ackRequestSchema.safeParse({ method: 'hold', comment: 'x'.repeat(501) }).success).toBe(false);
    expect(ackRequestSchema.safeParse({ method: 'hold', clientAt: 'yesterday' }).success).toBe(false);
    expect(ackRequestSchema.safeParse({ method: 'hold', offline: true, clientAt: '2026-10-01T09:00:00+05:30' }).success).toBe(true);
    expect(ackRequestSchema.safeParse({ method: 'hold', late: false }).success).toBe(false);
    expect(ackRequestSchema.safeParse({ method: 'hold', sessionId: 'x' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing integration tests**

```ts
// backend/src/__e2e__/modules/juvi-notices-ack.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient } from '../factories/juvi.factory';
import { activateAccount, publishTestNotice, signInAs } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { MobileSession } from '../../models/juvi/MobileSession';
import { AuditLog } from '../../shared/audit';
import { drainOutbox } from '../../shared/outbox';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

async function studentOnJuvi(deviceId: string) {
  const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  await activateAccount(String(s.account._id));
  return { ...s, token: await signInAs(app, fx, s.student.rollNumber, s.tempPassword, deviceId) };
}
const rowOf = (noticeId: unknown, accountId: unknown) => NoticeRecipient.findOne({ noticeId, accountId }).lean();

describe('POST /notices/:id/ack (US-2.3, US-2.4, NTC-04, NTC-06)', () => {
  it('records a fully attributed acknowledgement, clears it from Due and writes one audit entry', async () => {
    const a = await studentOnJuvi('dev-a');
    const n = await publishTestNotice(fx, { ackRequired: true, ackDeadline: tomorrow() });
    expect((await mobileClient(app, a.token).get(`${V1}/attention`)).body.dueCount).toBe(1);

    const res = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(200);
    expect(res.body).toMatchObject({ late: false, method: 'hold', offline: false, comment: null, clientAt: null });
    const row = (await rowOf(n._id, a.account._id))!;
    const session = (await MobileSession.findOne({ accountId: a.account._id, deviceId: 'dev-a' }).lean())!;
    expect(String(row.ack!.sessionId)).toBe(String(session._id));
    expect(row.ack!.at.toISOString()).toBe(res.body.ackAt);
    expect(row.seenAt).toBeInstanceOf(Date);
    expect((await mobileClient(app, a.token).get(`${V1}/attention`)).body).toEqual({ dueCount: 0, items: [] });
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${n._id}`)).body).toMatchObject({ state: 'acknowledged', ackAt: res.body.ackAt, ackMethod: 'hold' });

    await drainOutbox();
    const audit = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeAcknowledgement', entityId: String(n._id) }).lean();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'acknowledge', entityName: 'Notice from College Office', performedBy: a.person.name });
    expect(audit[0]!.changes[0]!.newValue).toMatchObject({ recipientId: String(row._id), name: a.person.name, late: false, method: 'hold', offline: false, hasComment: false });
  });

  it('a second acknowledgement is 409 ALREADY_ACKNOWLEDGED with the existing record, which never changes', async () => {
    const a = await studentOnJuvi('dev-a');
    const n = await publishTestNotice(fx, { ackRequired: true });
    const first = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'confirm' }).expect(200);
    const before = (await rowOf(n._id, a.account._id))!.ack;
    const again = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold', offline: true }).expect(409);
    expect(again.body.error).toMatchObject({ code: 'ALREADY_ACKNOWLEDGED', ack: first.body });
    expect((await rowOf(n._id, a.account._id))!.ack).toEqual(before);
  });

  it('flags a late acknowledgement by server receipt time even when it was made offline before the deadline', async () => {
    const a = await studentOnJuvi('dev-a');
    const n = await publishTestNotice(fx, { ackRequired: true, ackDeadline: tomorrow() });
    const past = new Date(Date.now() - 60_000);
    await Notice.updateOne({ _id: n._id }, { $set: { ackDeadline: past } });
    await NoticeRecipient.updateMany({ noticeId: n._id }, { $set: { deadline: past } });
    const clientAt = new Date(Date.now() - 3_600_000).toISOString();   // tapped before the deadline, delivered after
    const res = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'confirm', offline: true, clientAt }).expect(200);
    expect(res.body).toMatchObject({ late: true, offline: true, clientAt: new Date(clientAt).toISOString() });
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${n._id}`)).body).toMatchObject({ late: true, ackOffline: true, ackClientAt: new Date(clientAt).toISOString() });
  });

  it('takes a comment only where allowed, trims it, caps it at 500 characters and never logs it', async () => {
    const a = await studentOnJuvi('dev-a');
    const open = await publishTestNotice(fx, { title: 'Open', ackRequired: true, ackCommentAllowed: true });
    const closed = await publishTestNotice(fx, { title: 'Closed', ackRequired: true });
    const long = await mobileClient(app, a.token).post(`${V1}/notices/${open._id}/ack`).send({ method: 'hold', comment: 'x'.repeat(501) }).expect(400);
    expect(long.body.error.code).toBe('VALIDATION_FAILED');
    const ok = await mobileClient(app, a.token).post(`${V1}/notices/${open._id}/ack`).send({ method: 'hold', comment: '  Will attend.  ' }).expect(200);
    expect(ok.body.comment).toBe('Will attend.');
    const refused = await mobileClient(app, a.token).post(`${V1}/notices/${closed._id}/ack`).send({ method: 'hold', comment: 'hi' }).expect(400);
    expect(refused.body.error).toMatchObject({ code: 'VALIDATION_FAILED', message: 'Comments are not allowed on this notice.' });
    expect((await rowOf(closed._id, a.account._id))!.ack).toBeNull();
    await drainOutbox();
    const audit = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeAcknowledgement' }).lean();
    expect(audit).toHaveLength(1);
    expect(audit[0]!.changes[0]!.newValue).toMatchObject({ hasComment: true });
    expect(JSON.stringify(audit)).not.toContain('Will attend');
  });

  it('refuses an archived notice, a notice that needs no acknowledgement, and a malformed body', async () => {
    const a = await studentOnJuvi('dev-a');
    const n = await publishTestNotice(fx, { ackRequired: true });
    const fyi = await publishTestNotice(fx, { title: 'FYI' });
    await Notice.updateOne({ _id: n._id }, { $set: { status: 'archived' } });
    expect((await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(409)).body.error.code).toBe('NOTICE_ARCHIVED');
    expect((await mobileClient(app, a.token).post(`${V1}/notices/${fyi._id}/ack`).send({ method: 'hold' }).expect(409)).body.error.code).toBe('ACK_NOT_REQUIRED');
    await mobileClient(app, a.token).post(`${V1}/notices/${fyi._id}/ack`).send({ method: 'tap' }).expect(400);
    await mobileClient(app, a.token).post(`${V1}/notices/${fyi._id}/ack`).send({ method: 'hold', late: false }).expect(400);
  });

  it('two racing acknowledgements produce one record, one 409 and one audit entry (spec §10)', async () => {
    const a = await studentOnJuvi('dev-a');
    const n = await publishTestNotice(fx, { ackRequired: true });
    const [r1, r2] = await Promise.all([
      mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }),
      mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'confirm' }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const winner = r1.status === 200 ? r1 : r2;
    const loser = r1.status === 200 ? r2 : r1;
    expect(loser.body.error).toMatchObject({ code: 'ALREADY_ACKNOWLEDGED', ack: winner.body });
    expect((await rowOf(n._id, a.account._id))!.ack!.method).toBe(winner.body.method);
    await drainOutbox();
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'NoticeAcknowledgement', entityId: String(n._id) })).toBe(1);
  });

  it('is 404 NOTICE_NOT_FOUND for a notice the caller did not receive', async () => {
    const a = await studentOnJuvi('dev-a');
    const b = await studentOnJuvi('dev-b');
    const n = await publishTestNotice(fx, { ackRequired: true, audience: { rules: [{ kind: 'custom', ids: [String(a.person._id)] }] } });
    expect((await mobileClient(app, b.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
    expect((await mobileClient(app, b.token).post(`${V1}/notices/${n._id}/dismiss`).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
  });
});

describe('POST /notices/:id/dismiss', () => {
  it('dismisses a notice that needs no acknowledgement, once; refuses acknowledgement and archived notices', async () => {
    const a = await studentOnJuvi('dev-a');
    const fyi = await publishTestNotice(fx, { title: 'FYI' });
    const needsAck = await publishTestNotice(fx, { title: 'Sign', ackRequired: true });
    const gone = await publishTestNotice(fx, { title: 'Gone' });
    const d1 = await mobileClient(app, a.token).post(`${V1}/notices/${fyi._id}/dismiss`).expect(200);
    const d2 = await mobileClient(app, a.token).post(`${V1}/notices/${fyi._id}/dismiss`).expect(200);
    expect(d2.body.dismissedAt).toBe(d1.body.dismissedAt);
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${fyi._id}`)).body).toMatchObject({ state: 'dismissed', dismissedAt: d1.body.dismissedAt });
    expect((await rowOf(fyi._id, a.account._id))!.seenAt).toBeInstanceOf(Date);
    expect((await mobileClient(app, a.token).get(`${V1}/notices?segment=done`)).body.items.map((c: { title: string }) => c.title)).toEqual(['FYI']);
    expect((await mobileClient(app, a.token).post(`${V1}/notices/${needsAck._id}/dismiss`).expect(409)).body.error.code).toBe('ACK_REQUIRED');
    await Notice.updateOne({ _id: gone._id }, { $set: { status: 'archived' } });
    expect((await mobileClient(app, a.token).post(`${V1}/notices/${gone._id}/dismiss`).expect(409)).body.error.code).toBe('NOTICE_ARCHIVED');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/notices/__tests__/ack-late.test.ts && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-ack.e2e.test.ts`
Expected: FAIL with "Cannot find module '../ack-service'" (unit) and 404 `NOT_FOUND` on `/notices/:id/ack` (e2e).

- [ ] **Step 4: Add the audit action**

In `backend/src/shared/types.ts`, extend `AuditAction` after `'archive'`:

```ts
  | 'publish'
  | 'archive'
  // Juvi notices: an acknowledgement recorded from the app
  | 'acknowledge'
```

In `backend/src/shared/audit.ts`, extend the Mongoose enum mirror the same way:

```ts
  'approve', 'reject', 'submit', 'publish', 'archive',
  'acknowledge',
```

- [ ] **Step 5: Add the request and response schemas**

Append to `backend/src/modules/juvi-app/notices/schemas.ts`:

```ts
import { ACK_COMMENT_MAX } from '../../../models/juvi/NoticeRecipient';

/** `.strict()`: late, at and sessionId are the server's, never the client's. */
export const ackRequestSchema = z.object({
  method: z.enum(['hold', 'confirm']),
  comment: z.string().max(ACK_COMMENT_MAX).optional(),
  offline: z.boolean().default(false),
  clientAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export type AckRequest = z.infer<typeof ackRequestSchema>;

export const ackResponseSchema = z.object({
  ackAt: z.string(),
  late: z.boolean(),
  method: z.enum(['hold', 'confirm']),
  offline: z.boolean(),
  comment: z.string().nullable(),
  clientAt: z.string().nullable(),
});
export type AckResponse = z.infer<typeof ackResponseSchema>;

export const dismissResponseSchema = z.object({ dismissedAt: z.string() });
```

(Move the new `import` line to the top of the file with the existing `zod` import.)

- [ ] **Step 6: Implement the service**

```ts
// backend/src/modules/juvi-app/notices/ack-service.ts
/**
 * Acknowledge and dismiss (spec §7.1, §10). Acknowledgement is immutable: a
 * conditional update on `ack: null` means two racing requests produce one
 * record and one 409.
 */
import { Types } from 'mongoose';
import { NoticeRecipient, LeanNoticeRecipient, INoticeAck } from '../../../models/juvi/NoticeRecipient';
import { emit, kick } from '../../../shared/outbox';
import { MobileContext } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { recipientContext } from './mobile-service';
import { NOTICE_EVENTS, noticeEventKey } from './publish-service';
import { AckRequest, AckResponse } from './schemas';

/** Late is decided by the server's receipt time, never the client's clock (US-2.4). */
export function isLate(deadline: Date | null | undefined, receivedAt: Date): boolean {
  return Boolean(deadline) && receivedAt.getTime() > new Date(deadline!).getTime();
}

export function ackView(ack: INoticeAck): AckResponse {
  return {
    ackAt: new Date(ack.at).toISOString(), late: ack.late, method: ack.method, offline: ack.offline,
    comment: ack.comment ?? null, clientAt: ack.clientAt ? new Date(ack.clientAt).toISOString() : null,
  };
}

const alreadyAcknowledged = (ack: INoticeAck) =>
  new MobileApiError(409, 'ALREADY_ACKNOWLEDGED', 'You have already acknowledged this notice.', { ack: ackView(ack) });
const archived = () => new MobileApiError(409, 'NOTICE_ARCHIVED', 'This notice has been archived.');

export async function acknowledge(ctx: MobileContext, noticeId: string, input: AckRequest, now = new Date()): Promise<AckResponse> {
  const { notice, row } = await recipientContext(ctx, noticeId);
  if (row.ack) throw alreadyAcknowledged(row.ack);
  if (notice.status === 'archived' || row.archived) throw archived();
  if (!row.ackRequired) throw new MobileApiError(409, 'ACK_NOT_REQUIRED', 'This notice does not need an acknowledgement.');
  const comment = input.comment?.trim() || undefined;
  if (comment && !notice.ackCommentAllowed) {
    throw new MobileApiError(400, 'VALIDATION_FAILED', 'Comments are not allowed on this notice.', { fields: [{ path: 'comment', message: 'Comments are not allowed on this notice.' }] });
  }

  const ack: INoticeAck = {
    at: now, late: isLate(row.deadline, now), method: input.method, sessionId: new Types.ObjectId(ctx.sessionId), offline: input.offline,
    ...(input.clientAt ? { clientAt: new Date(input.clientAt) } : {}),
    ...(comment ? { comment } : {}),
  };
  const updated = await NoticeRecipient.findOneAndUpdate(
    { _id: row._id, collegeId: ctx.collegeId, ack: null },
    { $set: { ack } },
    { new: true },
  ).lean<LeanNoticeRecipient>();
  if (!updated) {
    const existing = await NoticeRecipient.findOne({ _id: row._id, collegeId: ctx.collegeId }).select('ack').lean<LeanNoticeRecipient>();
    throw alreadyAcknowledged(existing!.ack!);
  }
  if (!updated.seenAt) await NoticeRecipient.updateOne({ _id: row._id, collegeId: ctx.collegeId, seenAt: null }, { $set: { seenAt: now } });

  const personId = String(row.personId);
  await emit(NOTICE_EVENTS.acknowledged, { collegeId: ctx.collegeId, noticeId, recipientId: String(row._id), personId }, noticeEventKey.acknowledged(noticeId, personId));
  await kick();
  return ackView(updated.ack!);
}

/** Only a notice that needs no acknowledgement can be dismissed; a repeat returns the first dismissal. */
export async function dismiss(ctx: MobileContext, noticeId: string, now = new Date()): Promise<{ dismissedAt: string }> {
  const { notice, row } = await recipientContext(ctx, noticeId);
  if (notice.status === 'archived' || row.archived) throw archived();
  if (row.ackRequired) throw new MobileApiError(409, 'ACK_REQUIRED', 'This notice needs an acknowledgement.');
  if (!row.dismissedAt) {
    await NoticeRecipient.updateOne(
      { _id: row._id, collegeId: ctx.collegeId, dismissedAt: null },
      { $set: { dismissedAt: now, ...(row.seenAt ? {} : { seenAt: now }) } },
    );
  }
  const fresh = await NoticeRecipient.findOne({ _id: row._id, collegeId: ctx.collegeId }).select('dismissedAt').lean();
  return { dismissedAt: new Date(fresh!.dismissedAt!).toISOString() };
}
```

- [ ] **Step 7: Wire the controller, the routes and the consumer**

Append to `backend/src/modules/juvi-app/notices/mobile-controller.ts` (and add the two imports at the top):

```ts
import { ackRequestSchema } from './schemas';
import * as acks from './ack-service';

export async function ack(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await acks.acknowledge(requireMobile(req), id(req), ackRequestSchema.parse(req.body ?? {}))); } catch (e) { next(e); }
}
export async function dismiss(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await acks.dismiss(requireMobile(req), id(req))); } catch (e) { next(e); }
}
```

(Merge `ackRequestSchema` into the existing `import { noticeListQuerySchema } from './schemas';` line.)

Append to `backend/src/modules/juvi-app/notices/mobile-routes.ts`:

```ts
noticesRouter.post('/notices/:id/ack', authenticateMobile, ctrl.ack);
noticesRouter.post('/notices/:id/dismiss', authenticateMobile, ctrl.dismiss);
```

In `backend/src/modules/juvi-app/notices/consumers.ts`, add the imports and the consumer, and register it:

```ts
import { NoticeRecipient, LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { Person } from '../../../models/people/Person';
import { createAuditLog, AuditLog } from '../../../shared/audit';
```

```ts
/**
 * notice.acknowledged: the ERP audit entry (spec §6.3, NTC-06). Never the comment text.
 * One entry per recipient row, even when the event is retried.
 */
export async function recordAcknowledgement(payload: OutboxPayload): Promise<void> {
  const collegeId = payload.collegeId;
  const row = await NoticeRecipient.findOne({ _id: String(payload.recipientId), collegeId }).lean<LeanNoticeRecipient>();
  if (!row?.ack) return;
  const recipientId = String(row._id);
  const noticeId = String(row.noticeId);
  if (await AuditLog.exists({ collegeId, entityType: 'NoticeAcknowledgement', entityId: noticeId, 'changes.newValue.recipientId': recipientId })) return;
  const [notice, person] = await Promise.all([
    Notice.findOne({ _id: row.noticeId, collegeId }).select('publisher.office').lean(),
    Person.findOne({ _id: row.personId, collegeId }).select('name').lean(),
  ]);
  const name = person?.name ?? 'Unknown member';
  await createAuditLog({
    collegeId, entityType: 'NoticeAcknowledgement', entityId: noticeId,
    entityName: `Notice from ${notice?.publisher.office ?? 'the college'}`,
    action: 'acknowledge',
    changes: [{
      field: 'ack', displayName: 'Acknowledged', oldValue: null,
      newValue: {
        recipientId, name, at: row.ack.at, late: row.ack.late, method: row.ack.method,
        offline: row.ack.offline, sessionId: String(row.ack.sessionId), hasComment: Boolean(row.ack.comment),
      },
    }],
    performedBy: name,
  });
}

export function registerNoticeConsumers(): void {
  registerConsumer(NOTICE_EVENTS.published, fanOutNotice);
  registerConsumer(NOTICE_EVENTS.acknowledged, recordAcknowledgement);
  registerSweeper(async () => { await sweepStuckNotices(); });
}
```

(The existing `import { NoticeRecipient } …` line is replaced by the one above; `registerNoticeConsumers` replaces the Task 4 version.)

- [ ] **Step 8: Run the tests and typecheck**

Run: `cd backend && npx vitest run src/modules/juvi-app src/shared && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-ack.e2e.test.ts src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts && npm run typecheck`
Expected: PASS (ack-late 4 tests; ack e2e 8 tests; mobile e2e unchanged); typecheck clean. POST routes do not change the route-walk snapshot.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/juvi-app/notices backend/src/shared/types.ts backend/src/shared/audit.ts backend/src/__e2e__/modules/juvi-notices-ack.e2e.test.ts
git commit -m "feat(juvi-app): immutable notice acknowledgement with server-decided lateness, dismiss, and the acknowledgement audit consumer

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Reach, pending, remind and archive (shared services, mobile publisher API)

**Files:**
- Create: `backend/src/modules/juvi-app/notices/reach-service.ts`
- Modify: `backend/src/modules/juvi-app/notices/schemas.ts` (reach schemas), `backend/src/modules/juvi-app/notices/publish-service.ts` (`remindNotice`, `archiveNotice`), `backend/src/modules/juvi-app/notices/consumers.ts` (reminder and archived consumers), `backend/src/modules/juvi-app/notices/mobile-controller.ts`, `backend/src/modules/juvi-app/notices/mobile-routes.ts`, `backend/src/shared/types.ts` and `backend/src/shared/audit.ts` (`AuditAction` `'access_denied'`), `backend/src/__e2e__/modules/__snapshots__/rbac-route-walk.test.ts.snap`
- Test: `backend/src/modules/juvi-app/notices/__tests__/reach.test.ts`, `backend/src/__e2e__/modules/juvi-notices-reach.e2e.test.ts`

**Interfaces:**
- Consumes: `encodeCursor`, `decodeCursor`, `noticeNotFound` (Task 5); `groupLabel` (Task 3); `ADMIN_ROLES` (Task 4); `NOTICE_EVENTS`, `noticeEventKey` (Task 4); `emit`, `kick`, `registerConsumer` (Task 1); `MobileSession` (`models/juvi/MobileSession.ts:24` `lastActiveAt`); `Person`, `Student`, `Faculty`, `Staff`, `User`; `createAuditLog`, `AuditLog`.
- Produces:
  ```ts
  // schemas.ts (appended)
  export const remindersSchema, reachPersonSchema, reachCommentSchema, reachGroupSchema, reachResponseSchema,
    pendingQuerySchema, pendingPersonSchema, pendingResponseSchema, remindResponseSchema;
  export type Reminders, ReachGroup, ReachResponse, PendingQuery, PendingResponse;
  // reach-service.ts
  export const REACH_LIST_MAX = 200; export const SPARKLINE_BUCKETS = 24;
  export type ReachBucket = 'acknowledged' | 'seen' | 'not_seen' | 'not_on_juvi';
  export interface NoticeActor { collegeId: string; userId: string; name: string; role: string; isAdmin: boolean; via: 'mobile' | 'erp' }
  export function mobileActor(ctx: MobileContext): Promise<NoticeActor>;
  export function erpActor(collegeId: string, user: { id: string; name?: string; role: string }): NoticeActor;
  export function manageableNotice(actor: NoticeActor, noticeId: string, action: 'reach' | 'remind' | 'archive'): Promise<LeanNotice>;
  export function reachBucket(r: Pick<LeanNoticeRecipient, 'ack' | 'seenAt' | 'accountId'>): ReachBucket;
  export function sparkline(times: Date[], start: Date, end: Date, buckets?: number): number[];
  export function remindersView(notice: Pick<LeanNotice, 'reminders'>): Reminders;
  export function csvCell(v: string): string;
  export function buildReach(collegeId: string, notice: LeanNotice, now?: Date): Promise<ReachResponse>;
  export function pendingPage(collegeId: string, notice: LeanNotice, q: PendingQuery): Promise<PendingResponse>;
  export function reachCsv(collegeId: string, notice: LeanNotice): Promise<string>;
  // publish-service.ts (added)
  export function remindNotice(actor: NoticeActor, noticeId: string, now?: Date): Promise<{ reminders: Reminders }>;
  export function archiveNotice(actor: NoticeActor, noticeId: string, now?: Date): Promise<{ status: 'archived'; archivedAt: string }>;
  // consumers.ts (added)
  export function markReminded(payload: OutboxPayload): Promise<void>;
  export function mirrorArchive(payload: OutboxPayload): Promise<void>;
  ```

Decisions that bind later tasks:
- One set of services serves the mobile publisher API (this task) and the admin API (Task 8). A `NoticeActor` says who is asking: on mobile `isAdmin` is always false, so only the publisher (`notice.publisher.userId === ctx.userId`) passes; on the ERP, `admin`, `super_admin` and `principal` pass for every notice (spec §10 "the publisher, or ERP admin rights").
- Every refusal by `manageableNotice` writes an `AuditLog` row (`entityType: 'NoticeReach'`, `entityId` = notice id, `action: 'access_denied'`) and throws `MobileApiError(403, 'NOT_PUBLISHER')`. `MobileApiError` extends `AppError`, so the admin router renders the same refusal as `{ error: message }`.
- Reach arithmetic (spec §6.5): buckets are exclusive in the order acknowledged → seen → Not on Juvi (`accountId` null) → not seen, computed over `addedLater: false` rows only, so `acknowledged + seen + notSeen + notOnJuvi` equals the snapshot size, which equals `counts.audience`. Added-later rows get their own `{ total, acknowledged, seen, items }` and are never pending. Welcome rows created on demand are `addedLater: false` (Task 9), so they count.
- Pending = snapshot rows not acknowledged (acknowledgement notices) or neither seen nor dismissed (others). Last-seen-in-app is the latest `MobileSession.lastActiveAt` of the member's account. No response exposes a `personId` (spec §10); members are named with their roll number or employee code.
- The sparkline is 24 cumulative buckets between `publishedAt` and now, counting acknowledgements (or first views when no acknowledgement is required).
- Reminders: the cap is enforced atomically (`'reminders.1': { $exists: false }` in the update filter). A third is 409 `REMINDER_LIMIT`; an archived notice is 409 `NOTICE_ARCHIVED`; a notice still `publishing` is 409 `VALIDATION_FAILED` "still being delivered". The reminder consumer stamps `remindedAt` on rows neither acknowledged nor dismissed.
- Archive moves `published → archived` only, emits `notice.archived` (consumer sets `archived: true` on every row) and keeps all reach data. There is no mobile archive route; the ERP archives (Task 8).

- [ ] **Step 1: Write the failing unit tests**

```ts
// backend/src/modules/juvi-app/notices/__tests__/reach.test.ts
import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { reachBucket, sparkline, remindersView, csvCell } from '../reach-service';

describe('reachBucket', () => {
  const ack = { at: new Date(), late: false, method: 'hold' as const, sessionId: new Types.ObjectId(), offline: false };
  it('is exclusive: acknowledged, then seen, then Not on Juvi, then not seen', () => {
    expect(reachBucket({ ack, seenAt: new Date(), accountId: new Types.ObjectId() })).toBe('acknowledged');
    expect(reachBucket({ ack: null, seenAt: new Date(), accountId: new Types.ObjectId() })).toBe('seen');
    expect(reachBucket({ ack: null, seenAt: null, accountId: null })).toBe('not_on_juvi');
    expect(reachBucket({ ack: null, seenAt: null, accountId: new Types.ObjectId() })).toBe('not_seen');
  });
});

describe('sparkline', () => {
  it('is cumulative over equal buckets between start and end, clamping outliers', () => {
    const start = new Date('2026-10-01T00:00:00Z');
    const end = new Date('2026-10-01T04:00:00Z');
    const at = (h: number) => new Date(start.getTime() + h * 3_600_000);
    expect(sparkline([at(0.5), at(1.5), at(1.6), at(3.9), at(9)], start, end, 4)).toEqual([1, 3, 3, 5]);
    expect(sparkline([], start, end)).toHaveLength(24);
    expect(sparkline([at(-1)], start, start, 3)).toEqual([1, 1, 1]);
  });
});

describe('remindersView', () => {
  it('reports used, the cap of two and the last reminder time', () => {
    expect(remindersView({ reminders: [] })).toEqual({ used: 0, max: 2, lastAt: null });
    expect(remindersView({ reminders: [{ at: new Date('2026-10-01T00:00:00.000Z'), by: 'a' }, { at: new Date('2026-10-02T00:00:00.000Z'), by: 'a' }] }))
      .toEqual({ used: 2, max: 2, lastAt: '2026-10-02T00:00:00.000Z' });
  });
});

describe('csvCell', () => {
  it('quotes separators and defuses spreadsheet formulas', () => {
    expect(csvCell('Asha')).toBe('Asha');
    expect(csvCell('Rao, Asha')).toBe('"Rao, Asha"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+91')).toBe("'+91");
  });
});
```

- [ ] **Step 2: Write the failing integration tests**

```ts
// backend/src/__e2e__/modules/juvi-notices-reach.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient } from '../factories/juvi.factory';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { activateAccount, publishTestNotice, signInAs, erpRef } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { AuditLog } from '../../shared/audit';
import { drainOutbox } from '../../shared/outbox';
import { archiveNotice } from '../../modules/juvi-app/notices/publish-service';
import { erpActor } from '../../modules/juvi-app/notices/reach-service';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const GROUP = '2024 Batch · Section A';

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

/**
 * A faculty publisher on Juvi and a course with four students:
 * s1, s2, s3 on Juvi (signed in), s4 still onboarding (Not on Juvi).
 */
async function scenario() {
  const fac = await provisionTestFaculty(fx);
  await activateAccount(String(fac.account._id));
  const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id) });
  const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
  await off.updateOne({ $set: { status: 'active' } });
  type S = Awaited<ReturnType<typeof provisionTestStudent>> & { token: string };
  const students: S[] = [];
  for (let i = 1; i <= 4; i++) {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await createTestEnrollment(fx.collegeId, { studentId: String(s.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
    if (i <= 3) await activateAccount(String(s.account._id));
    students.push({ ...s, token: i <= 3 ? await signInAs(app, fx, s.student.rollNumber, s.tempPassword, `dev-s${i}`) : '' });
  }
  const notice = await publishTestNotice(fx, {
    title: 'Lab safety', ackRequired: true, ackCommentAllowed: true, ackDeadline: new Date(Date.now() + 86_400_000).toISOString(),
    audience: { rules: [{ kind: 'course_offering', ids: [String(off._id)] }] },
  }, erpRef(fac.user));
  const facToken = await signInAs(app, fx, fac.faculty.employeeCode, fac.tempPassword, 'dev-fac');
  const [s1, s2, s3, s4] = students as [S, S, S, S];
  return { fac, facToken, off, notice, s1, s2, s3, s4 };
}

describe('GET /notices/:id/reach (US-4.1, US-4.3, spec §6.5)', () => {
  it('reconciles acknowledged + seen + not seen + Not on Juvi to the snapshot and lists late, comments and added later separately', async () => {
    const { facToken, notice, s1, s2 } = await scenario();
    const past = new Date(Date.now() - 60_000);
    await Notice.updateOne({ _id: notice._id }, { $set: { ackDeadline: past } });
    await NoticeRecipient.updateMany({ noticeId: notice._id }, { $set: { deadline: past } });
    await mobileClient(app, s1.token).post(`${V1}/notices/${notice._id}/ack`).send({ method: 'hold', comment: 'Done' }).expect(200);
    await mobileClient(app, s2.token).post(`${V1}/notices/${notice._id}/seen`).expect(200);
    // A member who matched after publish (Task 10 creates these; inserted directly here).
    const s5 = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s5.account._id));
    await NoticeRecipient.create({
      collegeId: fx.collegeId, noticeId: notice._id, personId: s5.person._id, accountId: s5.account._id, kind: 'student',
      labels: { batch: '2024 Batch', section: 'A' }, addedLater: true, ackRequired: true, deadline: past, receivedAt: new Date(), seenAt: new Date(),
    });

    const res = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach`).expect(200);
    const r = res.body;
    expect(r).toMatchObject({ noticeId: String(notice._id), title: 'Lab safety', status: 'published', ackRequired: true, audience: 4, acknowledged: 1, seen: 1, notSeen: 1, notOnJuvi: 1, late: 1, reminders: { used: 0, max: 2, lastAt: null } });
    expect(r.acknowledged + r.seen + r.notSeen + r.notOnJuvi).toBe(r.audience);
    expect(r.audience).toBe((await Notice.findById(notice._id).lean())!.counts.audience);
    expect(r.groups).toEqual([{ label: GROUP, total: 4, acknowledged: 1, seen: 1, notSeen: 1, notOnJuvi: 1 }]);
    expect(r.lateAcks).toEqual([{ name: s1.person.name, identifier: s1.student.rollNumber, group: GROUP, at: expect.any(String) }]);
    expect(r.comments).toEqual([{ name: s1.person.name, identifier: s1.student.rollNumber, group: GROUP, at: expect.any(String), comment: 'Done', late: true }]);
    expect(r.addedLater).toEqual({ total: 1, acknowledged: 0, seen: 1, items: [{ name: s5.person.name, identifier: s5.student.rollNumber, group: GROUP, at: expect.any(String), state: 'seen' }] });
    expect(r.sparkline).toHaveLength(24);
    expect(r.sparkline[23]).toBe(1);
    for (const s of [s1, s2, s5]) expect(JSON.stringify(r)).not.toContain(String(s.person._id));
  });
});

describe('GET /notices/:id/reach/pending (US-4.2)', () => {
  it('lists pending members grouped, searchable and paged, with last-seen-in-app', async () => {
    const { facToken, notice, s1, s2, s3, s4 } = await scenario();
    await mobileClient(app, s1.token).post(`${V1}/notices/${notice._id}/ack`).send({ method: 'hold' }).expect(200);
    await mobileClient(app, s2.token).post(`${V1}/notices/${notice._id}/seen`).expect(200);

    const all = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending`).expect(200);
    expect(all.body.total).toBe(3);
    expect(all.body.groups).toEqual([{ label: GROUP, count: 3 }]);
    const byName = new Map(all.body.items.map((p: { name: string }) => [p.name, p]));
    expect(byName.get(s2.person.name)).toMatchObject({ identifier: s2.student.rollNumber, group: GROUP, state: 'seen', lastSeenInApp: expect.any(String) });
    expect(byName.get(s3.person.name)).toMatchObject({ state: 'not_seen', lastSeenInApp: expect.any(String) });
    expect(byName.get(s4.person.name)).toMatchObject({ state: 'not_on_juvi', lastSeenInApp: null });
    expect(byName.has(s1.person.name)).toBe(false);
    expect(JSON.stringify(all.body)).not.toContain(String(s3.person._id));

    const search = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending?q=${s3.student.rollNumber}`).expect(200);
    expect(search.body.items.map((p: { name: string }) => p.name)).toEqual([s3.person.name]);
    expect((await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending?group=${encodeURIComponent(GROUP)}`)).body.total).toBe(3);
    expect((await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending?group=Nobody`)).body.items).toEqual([]);

    const p1 = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending?limit=2`).expect(200);
    const p2 = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending?limit=2&cursor=${p1.body.nextCursor}`).expect(200);
    expect([...p1.body.items, ...p2.body.items]).toEqual(all.body.items);
    expect(p2.body.nextCursor).toBeNull();
  });
});

describe('POST /notices/:id/remind (NTC-08, US-4.4)', () => {
  it('allows two reminders, refuses a third with a reason, and stamps remindedAt on pending rows only', async () => {
    const { facToken, notice, s1 } = await scenario();
    await mobileClient(app, s1.token).post(`${V1}/notices/${notice._id}/ack`).send({ method: 'hold' }).expect(200);
    expect((await mobileClient(app, facToken).post(`${V1}/notices/${notice._id}/remind`).expect(200)).body.reminders).toMatchObject({ used: 1, max: 2 });
    expect((await mobileClient(app, facToken).post(`${V1}/notices/${notice._id}/remind`).expect(200)).body.reminders).toMatchObject({ used: 2, max: 2, lastAt: expect.any(String) });
    const third = await mobileClient(app, facToken).post(`${V1}/notices/${notice._id}/remind`).expect(409);
    expect(third.body.error).toMatchObject({ code: 'REMINDER_LIMIT', message: expect.stringMatching(/two reminders/) });
    expect((await Notice.findById(notice._id).lean())!.reminders).toHaveLength(2);

    await drainOutbox();
    const rows = await NoticeRecipient.find({ noticeId: notice._id }).lean();
    const acked = rows.find((r) => String(r.personId) === String(s1.person._id))!;
    expect(acked.remindedAt).toBeNull();
    expect(rows.filter((r) => r.remindedAt).length).toBe(3);
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'Notice', entityId: String(notice._id), action: 'update' })).toBe(2);
  });
});

describe('reach is for the publisher only (RCH-01, RCH-02, US-4.5)', () => {
  it('a student calling reach, pending or remind gets 403 NOT_PUBLISHER and each attempt is audited', async () => {
    const { notice, s1 } = await scenario();
    for (const [method, path] of [['get', 'reach'], ['get', 'reach/pending'], ['post', 'remind']] as const) {
      const res = await mobileClient(app, s1.token)[method](`${V1}/notices/${notice._id}/${path}`).expect(403);
      expect(res.body.error.code).toBe('NOT_PUBLISHER');
    }
    const audit = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeReach', entityId: String(notice._id), action: 'access_denied' }).lean();
    expect(audit).toHaveLength(3);
    expect(audit[0]).toMatchObject({ performedBy: s1.person.name });
    expect(audit.map((a) => (a.changes[0]!.newValue as { action: string; via: string }).action).sort()).toEqual(['reach', 'reach', 'remind']);
    expect((audit[0]!.changes[0]!.newValue as { via: string; role: string })).toMatchObject({ via: 'mobile', role: 'student' });
    expect((await mobileClient(app, s1.token).get(`${V1}/notices/000000000000000000000000/reach`).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
  });
});

describe('archive (NTC-09, US-2.6, spec §11)', () => {
  it('archives for the publisher or an admin, mirrors onto rows, keeps reach, and makes the notice read-only', async () => {
    const { fac, facToken, notice, s3 } = await scenario();
    const other = await provisionTestFaculty(fx);
    await expect(archiveNotice(erpActor(fx.collegeId, { id: String(other.user._id), name: 'Other', role: 'faculty' }), String(notice._id))).rejects.toMatchObject({ statusCode: 403 });
    const res = await archiveNotice(erpActor(fx.collegeId, { id: String(fac.user._id), name: 'Publisher', role: 'faculty' }), String(notice._id));
    expect(res.status).toBe('archived');
    await expect(archiveNotice(erpActor(fx.collegeId, { id: String(fx.admin.user._id), name: 'Admin', role: 'admin' }), String(notice._id))).rejects.toMatchObject({ statusCode: 409, code: 'NOTICE_ARCHIVED' });

    await drainOutbox();
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id, archived: false })).toBe(0);
    expect((await mobileClient(app, s3.token).get(`${V1}/attention`)).body.dueCount).toBe(0);
    expect((await mobileClient(app, s3.token).post(`${V1}/notices/${notice._id}/ack`).send({ method: 'hold' }).expect(409)).body.error.code).toBe('NOTICE_ARCHIVED');
    expect((await mobileClient(app, facToken).post(`${V1}/notices/${notice._id}/remind`).expect(409)).body.error.code).toBe('NOTICE_ARCHIVED');
    const reach = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach`).expect(200);
    expect(reach.body).toMatchObject({ status: 'archived', audience: 4, notSeen: 3, notOnJuvi: 1 });
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'Notice', entityId: String(notice._id), action: 'archive' })).toBe(1);
  });
});
```

Note on the reach test: `notSeen: 3` after archive counts s1–s3 (none acted in that test) and `notOnJuvi: 1` is s4.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/notices/__tests__/reach.test.ts && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-reach.e2e.test.ts`
Expected: FAIL with "Cannot find module '../reach-service'" (unit) and "Cannot find module '../../modules/juvi-app/notices/reach-service'" (e2e).

- [ ] **Step 4: Add the audit action**

In `backend/src/shared/types.ts`, after `'acknowledge'`:

```ts
  | 'acknowledge'
  // A refused attempt to read or act on something the caller may not (RCH-02)
  | 'access_denied'
```

In `backend/src/shared/audit.ts`:

```ts
  'acknowledge', 'access_denied',
```

- [ ] **Step 5: Append the reach schemas**

Append to `backend/src/modules/juvi-app/notices/schemas.ts`:

```ts
export const remindersSchema = z.object({ used: z.number().int(), max: z.number().int(), lastAt: z.string().nullable() });
export type Reminders = z.infer<typeof remindersSchema>;

/** A member in a reach list: names and roll numbers only, never a personId (spec §10). */
export const reachPersonSchema = z.object({ name: z.string(), identifier: z.string().nullable(), group: z.string(), at: z.string().nullable() });
export const reachCommentSchema = reachPersonSchema.extend({ comment: z.string(), late: z.boolean() });
export const REACH_STATES = ['acknowledged', 'seen', 'not_seen', 'not_on_juvi'] as const;
export const reachGroupSchema = z.object({
  label: z.string(), total: z.number().int(), acknowledged: z.number().int(), seen: z.number().int(), notSeen: z.number().int(), notOnJuvi: z.number().int(),
});
export type ReachGroup = z.infer<typeof reachGroupSchema>;

export const reachResponseSchema = z.object({
  noticeId: z.string(),
  title: z.string(),
  status: z.enum(['publishing', 'published', 'archived']),
  ackRequired: z.boolean(),
  deadline: z.string().nullable(),
  publishedAt: z.string().nullable(),
  audience: z.number().int(),
  acknowledged: z.number().int(),
  seen: z.number().int(),
  notSeen: z.number().int(),
  notOnJuvi: z.number().int(),
  dismissed: z.number().int(),
  late: z.number().int(),
  reminders: remindersSchema,
  sparkline: z.array(z.number().int()),
  groups: z.array(reachGroupSchema),
  lateAcks: z.array(reachPersonSchema),
  comments: z.array(reachCommentSchema),
  addedLater: z.object({
    total: z.number().int(), acknowledged: z.number().int(), seen: z.number().int(),
    items: z.array(reachPersonSchema.extend({ state: z.enum(REACH_STATES) })),
  }),
  asOf: z.string(),
});
export type ReachResponse = z.infer<typeof reachResponseSchema>;

export const pendingQuerySchema = z.object({
  group: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  cursor: z.string().min(1).max(300).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type PendingQuery = z.infer<typeof pendingQuerySchema>;
export const pendingPersonSchema = z.object({
  name: z.string(), identifier: z.string().nullable(), group: z.string(),
  state: z.enum(['seen', 'not_seen', 'not_on_juvi']), lastSeenInApp: z.string().nullable(),
});
export const pendingResponseSchema = z.object({
  items: z.array(pendingPersonSchema), total: z.number().int(),
  groups: z.array(z.object({ label: z.string(), count: z.number().int() })), nextCursor: z.string().nullable(),
});
export type PendingResponse = z.infer<typeof pendingResponseSchema>;

export const remindResponseSchema = z.object({ reminders: remindersSchema });
```

- [ ] **Step 6: Implement the reach service**

```ts
// backend/src/modules/juvi-app/notices/reach-service.ts
/**
 * Reach, pending and the CSV (spec §6.5, §7.1, §7.2). Shared by the mobile
 * publisher API and the admin console; `manageableNotice` is the one gate.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice, NOTICE_REMINDERS_MAX } from '../../../models/juvi/Notice';
import { NoticeRecipient, LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { MobileSession } from '../../../models/juvi/MobileSession';
import { User } from '../../../models/User';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { createAuditLog } from '../../../shared/audit';
import { MobileContext } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { groupLabel } from './audience';
import { ADMIN_ROLES } from './publisher-scope';
import { encodeCursor, decodeCursor, noticeNotFound } from './mobile-service';
import { ReachResponse, ReachGroup, PendingQuery, PendingResponse, Reminders } from './schemas';

export const REACH_LIST_MAX = 200;
export const SPARKLINE_BUCKETS = 24;
export type ReachBucket = 'acknowledged' | 'seen' | 'not_seen' | 'not_on_juvi';

export interface NoticeActor { collegeId: string; userId: string; name: string; role: string; isAdmin: boolean; via: 'mobile' | 'erp' }

const iso = (d?: Date | null): string | null => (d ? new Date(d).toISOString() : null);
const ROW_FIELDS = 'personId accountId kind labels addedLater seenAt dismissedAt ack';

export async function mobileActor(ctx: MobileContext): Promise<NoticeActor> {
  const user = await User.findOne({ _id: ctx.userId, collegeId: ctx.collegeId }).select('name').lean();
  return { collegeId: ctx.collegeId, userId: ctx.userId, name: user?.name ?? 'Juvi user', role: ctx.role, isAdmin: false, via: 'mobile' };
}

export function erpActor(collegeId: string, user: { id: string; name?: string; role: string }): NoticeActor {
  return { collegeId, userId: user.id, name: user.name || 'System', role: user.role, isAdmin: ADMIN_ROLES.has(user.role), via: 'erp' };
}

/** The notice, when the actor published it or has ERP admin rights; otherwise an audited 403 (RCH-02). */
export async function manageableNotice(actor: NoticeActor, noticeId: string, action: 'reach' | 'remind' | 'archive'): Promise<LeanNotice> {
  if (!Types.ObjectId.isValid(noticeId)) throw noticeNotFound();
  const notice = await Notice.findOne({ _id: noticeId, collegeId: actor.collegeId }).lean<LeanNotice>();
  if (!notice) throw noticeNotFound();
  const isPublisher = Boolean(notice.publisher.userId) && String(notice.publisher.userId) === actor.userId;
  if (actor.isAdmin || isPublisher) return notice;
  await createAuditLog({
    collegeId: actor.collegeId, entityType: 'NoticeReach', entityId: String(notice._id), entityName: `Notice from ${notice.publisher.office}`,
    action: 'access_denied',
    changes: [{ field: action, displayName: 'Refused: not the publisher', oldValue: null, newValue: { action, via: actor.via, role: actor.role, userId: actor.userId } }],
    performedBy: actor.name,
  });
  throw new MobileApiError(403, 'NOT_PUBLISHER', 'Only the publisher of this notice can do that.');
}

export function reachBucket(r: Pick<LeanNoticeRecipient, 'ack' | 'seenAt' | 'accountId'>): ReachBucket {
  if (r.ack) return 'acknowledged';
  if (r.seenAt) return 'seen';
  if (!r.accountId) return 'not_on_juvi';
  return 'not_seen';
}

/** Cumulative counts at the end of each of `buckets` equal slices of [start, end]; outliers clamp to the ends. */
export function sparkline(times: Date[], start: Date, end: Date, buckets = SPARKLINE_BUCKETS): number[] {
  const from = start.getTime();
  const span = Math.max(end.getTime() - from, 1);
  const out = new Array<number>(buckets).fill(0);
  for (const t of times) {
    const i = Math.min(buckets - 1, Math.max(0, Math.floor(((t.getTime() - from) / span) * buckets)));
    out[i] = (out[i] ?? 0) + 1;
  }
  for (let i = 1; i < buckets; i++) out[i] = (out[i] ?? 0) + (out[i - 1] ?? 0);
  return out;
}

export function remindersView(notice: Pick<LeanNotice, 'reminders'>): Reminders {
  const last = notice.reminders[notice.reminders.length - 1];
  return { used: notice.reminders.length, max: NOTICE_REMINDERS_MAX, lastAt: last ? iso(last.at) : null };
}

/** CSV cell: quoted when needed; a leading =, +, -, @ is defused so spreadsheets never evaluate it. */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

async function peopleInfo(collegeId: string, personIds: Types.ObjectId[]): Promise<Map<string, { name: string; identifier: string | null }>> {
  if (personIds.length === 0) return new Map();
  const [persons, students, faculty, staff] = await Promise.all([
    Person.find({ collegeId, _id: { $in: personIds } }).select('name').lean(),
    Student.find({ collegeId, personId: { $in: personIds } }).select('personId rollNumber').lean(),
    Faculty.find({ collegeId, personId: { $in: personIds } }).select('personId employeeCode').lean(),
    Staff.find({ collegeId, personId: { $in: personIds } }).select('personId employeeCode').lean(),
  ]);
  const ident = new Map<string, string>();
  for (const s of students) if (s.rollNumber) ident.set(String(s.personId), s.rollNumber);
  for (const e of [...faculty, ...staff]) if (!ident.has(String(e.personId))) ident.set(String(e.personId), e.employeeCode);
  return new Map(persons.map((p) => [String(p._id), { name: p.name, identifier: ident.get(String(p._id)) ?? null }]));
}

const COUNT_KEY: Record<ReachBucket, 'acknowledged' | 'seen' | 'notSeen' | 'notOnJuvi'> = {
  acknowledged: 'acknowledged', seen: 'seen', not_seen: 'notSeen', not_on_juvi: 'notOnJuvi',
};
const labelOf = (r: LeanNoticeRecipient) => groupLabel(r.kind, r.labels ?? {});
const ackTime = (r: LeanNoticeRecipient) => (r.ack ? new Date(r.ack.at).getTime() : 0);

export async function buildReach(collegeId: string, notice: LeanNotice, now = new Date()): Promise<ReachResponse> {
  const rows = await NoticeRecipient.find({ collegeId, noticeId: notice._id }).select(ROW_FIELDS).lean<LeanNoticeRecipient[]>();
  const snapshot = rows.filter((r) => !r.addedLater);
  const later = rows.filter((r) => r.addedLater);

  const totals = { acknowledged: 0, seen: 0, notSeen: 0, notOnJuvi: 0 };
  const groups = new Map<string, ReachGroup>();
  for (const r of snapshot) {
    const key = COUNT_KEY[reachBucket(r)];
    totals[key] += 1;
    const label = labelOf(r);
    const g = groups.get(label) ?? { label, total: 0, acknowledged: 0, seen: 0, notSeen: 0, notOnJuvi: 0 };
    g.total += 1;
    g[key] += 1;
    groups.set(label, g);
  }

  const lateRows = rows.filter((r) => r.ack?.late).sort((a, b) => ackTime(a) - ackTime(b)).slice(0, REACH_LIST_MAX);
  const commentRows = rows.filter((r) => r.ack?.comment).sort((a, b) => ackTime(a) - ackTime(b)).slice(0, REACH_LIST_MAX);
  const laterRows = later.slice(0, REACH_LIST_MAX);
  const info = await peopleInfo(collegeId, [...lateRows, ...commentRows, ...laterRows].map((r) => r.personId));
  const person = (r: LeanNoticeRecipient) => {
    const p = info.get(String(r.personId));
    return { name: p?.name ?? 'Unknown member', identifier: p?.identifier ?? null, group: labelOf(r) };
  };
  const progress = snapshot.flatMap((r) => (notice.ackRequired ? (r.ack ? [new Date(r.ack.at)] : []) : (r.seenAt ? [new Date(r.seenAt)] : [])));

  return {
    noticeId: String(notice._id), title: notice.title, status: notice.status, ackRequired: notice.ackRequired,
    deadline: iso(notice.ackDeadline), publishedAt: iso(notice.publishedAt),
    audience: notice.counts.audience, ...totals,
    dismissed: snapshot.filter((r) => r.dismissedAt).length,
    late: snapshot.filter((r) => r.ack?.late).length,
    reminders: remindersView(notice),
    sparkline: sparkline(progress, new Date(notice.publishedAt ?? notice.createdAt), now),
    groups: [...groups.values()].sort((a, b) => a.label.localeCompare(b.label)),
    lateAcks: lateRows.map((r) => ({ ...person(r), at: iso(r.ack!.at) })),
    comments: commentRows.map((r) => ({ ...person(r), at: iso(r.ack!.at), comment: r.ack!.comment!, late: r.ack!.late })),
    addedLater: {
      total: later.length,
      acknowledged: later.filter((r) => r.ack).length,
      seen: later.filter((r) => !r.ack && r.seenAt).length,
      items: laterRows.map((r) => ({ ...person(r), at: iso(r.ack?.at ?? r.seenAt), state: reachBucket(r) })),
    },
    asOf: now.toISOString(),
  };
}

/** Snapshot rows still pending: not acknowledged, or (no acknowledgement required) neither seen nor dismissed. */
export async function pendingPage(collegeId: string, notice: LeanNotice, q: PendingQuery): Promise<PendingResponse> {
  const pending = notice.ackRequired ? { ack: null } : { ack: null, seenAt: null, dismissedAt: null };
  const rows = await NoticeRecipient.find({ collegeId, noticeId: notice._id, addedLater: false, ...pending }).select(ROW_FIELDS).lean<LeanNoticeRecipient[]>();
  const info = await peopleInfo(collegeId, rows.map((r) => r.personId));
  const accountIds = rows.flatMap((r) => (r.accountId ? [r.accountId] : []));
  const sessions = accountIds.length
    ? await MobileSession.aggregate<{ _id: Types.ObjectId; at: Date }>([
      { $match: { collegeId: new Types.ObjectId(collegeId), accountId: { $in: accountIds } } },
      { $group: { _id: '$accountId', at: { $max: '$lastActiveAt' } } },
    ])
    : [];
  const lastSeen = new Map(sessions.map((s) => [String(s._id), s.at]));

  let people = rows.map((r) => {
    const p = info.get(String(r.personId));
    return {
      name: p?.name ?? 'Unknown member', identifier: p?.identifier ?? null, group: labelOf(r),
      state: reachBucket(r) as 'seen' | 'not_seen' | 'not_on_juvi',
      lastSeenInApp: r.accountId ? iso(lastSeen.get(String(r.accountId))) : null,
    };
  });
  const needle = q.q?.toLowerCase();
  if (needle) people = people.filter((p) => p.name.toLowerCase().includes(needle) || (p.identifier ?? '').toLowerCase().includes(needle));
  const counts = new Map<string, number>();
  for (const p of people) counts.set(p.group, (counts.get(p.group) ?? 0) + 1);
  if (q.group) people = people.filter((p) => p.group === q.group);
  people.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

  const c = q.cursor ? decodeCursor(q.cursor) : { o: 0 };
  if (typeof c.o !== 'number' || !Number.isInteger(c.o) || c.o < 0) throw new MobileApiError(400, 'VALIDATION_FAILED', 'That page cursor is not valid.');
  const offset = c.o;
  return {
    items: people.slice(offset, offset + q.limit),
    total: people.length,
    groups: [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label)),
    nextCursor: offset + q.limit < people.length ? encodeCursor({ o: offset + q.limit }) : null,
  };
}

const STATUS_WORDS: Record<ReachBucket, string> = { acknowledged: 'Acknowledged', seen: 'Seen', not_seen: 'Not seen', not_on_juvi: 'Not on Juvi' };

/** Every member, snapshot first then added later (admin only; the route enforces it). */
export async function reachCsv(collegeId: string, notice: LeanNotice): Promise<string> {
  const rows = await NoticeRecipient.find({ collegeId, noticeId: notice._id }).select(ROW_FIELDS).lean<LeanNoticeRecipient[]>();
  const info = await peopleInfo(collegeId, rows.map((r) => r.personId));
  const lines = ['Name,Identifier,Group,Status,Acknowledged at,Late,Seen at,Comment,Added later'];
  const view = rows.map((r) => ({ r, name: info.get(String(r.personId))?.name ?? 'Unknown member', group: labelOf(r) }));
  view.sort((a, b) => Number(a.r.addedLater) - Number(b.r.addedLater) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  for (const { r, name, group } of view) {
    lines.push([
      name, info.get(String(r.personId))?.identifier ?? '', group, STATUS_WORDS[reachBucket(r)],
      iso(r.ack?.at) ?? '', r.ack?.late ? 'yes' : '', iso(r.seenAt) ?? '', r.ack?.comment ?? '', r.addedLater ? 'yes' : '',
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}
```

- [ ] **Step 7: Add remind and archive to the publish service**

Append to `backend/src/modules/juvi-app/notices/publish-service.ts` (and add the imports at the top):

```ts
import { MobileApiError } from '../errors';
import { NoticeActor, manageableNotice, remindersView } from './reach-service';
import { Reminders } from './schemas';
```

```ts
const stillDelivering = () => new MobileApiError(409, 'VALIDATION_FAILED', 'This notice is still being delivered; try again in a minute.');
const archivedError = () => new MobileApiError(409, 'NOTICE_ARCHIVED', 'This notice has been archived.');

/** At most two reminders (NTC-08). The cap is part of the update filter, so concurrent requests cannot exceed it. */
export async function remindNotice(actor: NoticeActor, noticeId: string, now = new Date()): Promise<{ reminders: Reminders }> {
  const notice = await manageableNotice(actor, noticeId, 'remind');
  const updated = await Notice.findOneAndUpdate(
    { _id: notice._id, collegeId: actor.collegeId, status: 'published', 'reminders.1': { $exists: false } },
    { $push: { reminders: { at: now, by: actor.name } } },
    { new: true },
  ).lean<LeanNotice>();
  if (!updated) {
    const current = (await Notice.findOne({ _id: notice._id, collegeId: actor.collegeId }).select('status reminders').lean<LeanNotice>())!;
    if (current.status === 'archived') throw archivedError();
    if (current.status === 'publishing') throw stillDelivering();
    throw new MobileApiError(409, 'REMINDER_LIMIT', 'A notice can have at most two reminders.', { reminders: remindersView(current) });
  }
  const n = updated.reminders.length;
  await emit(NOTICE_EVENTS.reminder, { collegeId: actor.collegeId, noticeId: String(notice._id) }, noticeEventKey.reminder(String(notice._id), n));
  await createAuditLog({
    collegeId: actor.collegeId, entityType: 'Notice', entityId: String(notice._id), entityName: `Notice from ${notice.publisher.office}`,
    action: 'update', changes: [{ field: 'reminders', displayName: 'Reminders sent', oldValue: n - 1, newValue: n }], performedBy: actor.name,
  });
  await kick();
  return { reminders: remindersView(updated) };
}

/** published → archived; the only change a published notice allows (US-1.4). Reach data is kept. */
export async function archiveNotice(actor: NoticeActor, noticeId: string, now = new Date()): Promise<{ status: 'archived'; archivedAt: string }> {
  const notice = await manageableNotice(actor, noticeId, 'archive');
  const updated = await Notice.findOneAndUpdate(
    { _id: notice._id, collegeId: actor.collegeId, status: 'published' },
    { $set: { status: 'archived', archivedAt: now } },
    { new: true },
  ).lean<LeanNotice>();
  if (!updated) throw notice.status === 'publishing' ? stillDelivering() : archivedError();
  await emit(NOTICE_EVENTS.archived, { collegeId: actor.collegeId, noticeId: String(notice._id) }, noticeEventKey.archived(String(notice._id)));
  await createAuditLog({
    collegeId: actor.collegeId, entityType: 'Notice', entityId: String(notice._id), entityName: `Notice from ${notice.publisher.office}`,
    action: 'archive', changes: [{ field: 'status', displayName: 'Status', oldValue: 'published', newValue: 'archived' }], performedBy: actor.name,
  });
  await kick();
  return { status: 'archived', archivedAt: now.toISOString() };
}
```

- [ ] **Step 8: Add the reminder and archive consumers**

In `backend/src/modules/juvi-app/notices/consumers.ts`, add:

```ts
/** notice.reminder: stamp remindedAt on members who have neither acknowledged nor dismissed. */
export async function markReminded(payload: OutboxPayload): Promise<void> {
  await NoticeRecipient.updateMany(
    { collegeId: payload.collegeId, noticeId: String(payload.noticeId), ack: null, dismissedAt: null, archived: false },
    { $set: { remindedAt: new Date() } },
  );
}

/** notice.archived: mirror the archive onto every row (it drives the Due filter). */
export async function mirrorArchive(payload: OutboxPayload): Promise<void> {
  await NoticeRecipient.updateMany({ collegeId: payload.collegeId, noticeId: String(payload.noticeId) }, { $set: { archived: true } });
}

export function registerNoticeConsumers(): void {
  registerConsumer(NOTICE_EVENTS.published, fanOutNotice);
  registerConsumer(NOTICE_EVENTS.acknowledged, recordAcknowledgement);
  registerConsumer(NOTICE_EVENTS.reminder, markReminded);
  registerConsumer(NOTICE_EVENTS.archived, mirrorArchive);
  registerSweeper(async () => { await sweepStuckNotices(); });
}
```

(`registerNoticeConsumers` replaces the Task 6 version.)

- [ ] **Step 9: Wire the mobile controller and routes**

Append to `backend/src/modules/juvi-app/notices/mobile-controller.ts` (merge the imports into the existing lines):

```ts
import { pendingQuerySchema } from './schemas';
import * as reachSvc from './reach-service';
import { remindNotice } from './publish-service';

export async function reach(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    const notice = await reachSvc.manageableNotice(await reachSvc.mobileActor(ctx), id(req), 'reach');
    res.json(await reachSvc.buildReach(ctx.collegeId, notice));
  } catch (e) { next(e); }
}
export async function pending(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    const notice = await reachSvc.manageableNotice(await reachSvc.mobileActor(ctx), id(req), 'reach');
    res.json(await reachSvc.pendingPage(ctx.collegeId, notice, pendingQuerySchema.parse(req.query)));
  } catch (e) { next(e); }
}
export async function remind(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await remindNotice(await reachSvc.mobileActor(requireMobile(req)), id(req))); } catch (e) { next(e); }
}
```

Append to `backend/src/modules/juvi-app/notices/mobile-routes.ts`:

```ts
// Publisher only (403 NOT_PUBLISHER, audited).
noticesRouter.get('/notices/:id/reach', authenticateMobile, ctrl.reach);
noticesRouter.get('/notices/:id/reach/pending', authenticateMobile, ctrl.pending);
noticesRouter.post('/notices/:id/remind', authenticateMobile, ctrl.remind);
```

- [ ] **Step 10: Run the tests, refresh the route-walk snapshot, typecheck**

Run: `cd backend && npx vitest run src/modules/juvi-app src/shared && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-reach.e2e.test.ts src/__e2e__/modules/juvi-notices-ack.e2e.test.ts src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts`
Expected: PASS (reach unit 5 tests; reach e2e 5 tests; ack and mobile unchanged).

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/rbac-route-walk.test.ts -u && git diff -- src/__e2e__/modules/__snapshots__ | grep '^[+-] ' | sort | uniq -c`
Expected: only `/api/juvi-app/v1/notices/:id/reach` and `/api/juvi-app/v1/notices/:id/reach/pending` added, each `401`, once per persona (8 lines).

Run: `cd backend && npm run typecheck`
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add backend/src/modules/juvi-app/notices backend/src/shared/types.ts backend/src/shared/audit.ts backend/src/__e2e__/modules/juvi-notices-reach.e2e.test.ts backend/src/__e2e__/modules/__snapshots__/rbac-route-walk.test.ts.snap
git commit -m "feat(juvi-app): notice reach, pending list, capped reminders and archive for publishers, with audited refusals

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Admin notices API and the `notices` policy

**Files:**
- Create: `backend/src/modules/juvi-app/notices/admin-service.ts`, `backend/src/modules/juvi-app/notices/admin-controller.ts`, `backend/src/modules/juvi-app/notices/admin-routes.ts`
- Modify: `backend/src/modules/juvi-app/notices/admin-schemas.ts` (list query), `backend/src/modules/juvi-app/admin/routes.ts:38-40` (mount before the 404), `backend/src/modules/juvi-app/admin/__tests__/routes-permissions.test.ts`, `backend/src/shared/rbac/sub-domains.ts:13-27`, `admin-portal/src/config/sub-domains.json`, `backend/src/shared/rbac/defaults.ts` (end of `DEFAULT_POLICIES`), `backend/src/__e2e__/modules/__snapshots__/rbac-route-walk.test.ts.snap`
- Test: `backend/src/modules/juvi-app/notices/__tests__/admin-routes-permissions.test.ts`, `backend/src/shared/rbac/__tests__/defaults-notices.test.ts`, `backend/src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts`

**Interfaces:**
- Consumes: `authenticate`, `AuthRequest` (`middleware/authenticate.ts`); `authorize` (`middleware/authorize.ts:20`); `AppError`, `errorHandler`; `paginate` (`shared/pagination.ts`); `OutboxEvent`, `retryDead`, `kick` (Task 1); `resolvePublisherScope`, `ErpUserRef` (Task 4); `allowedTargets` (Task 3); `loadAudienceGraph`, `uploadAttachment`, `previewAudience`, `publishNotice`, `remindNotice`, `archiveNotice`, `noticeEventKey` (Tasks 4, 7); `erpActor`, `manageableNotice`, `buildReach`, `pendingPage`, `reachCsv`, `remindersView`, `NoticeActor` (Task 7); `publishSchema`, `audiencePreviewSchema` (Task 4); `pendingQuerySchema` (Task 7); `OFFICE_PERSONA_CODES` (Task 3, test only); `filterPolicies`, `sortPolicies` (`shared/rbac/engine.ts`).
- Produces:
  ```ts
  // admin-schemas.ts (appended)
  export const adminNoticeListQuerySchema;   // { page, limit, status?, office?, q? }
  // admin-service.ts
  export type DeliveryState = 'delivering' | 'delivered' | 'failed';
  export interface DeliveryView { state: DeliveryState; attempts: number; lastError: string | null; updatedAt: string | null }
  export interface AdminNoticeRow { id; title; office; audienceLine; status; delivery: DeliveryView; publishedAt: string | null; createdAt: string; ackRequired; deadline: string | null; deadlineState: 'none' | 'open' | 'passed'; counts: { audience: number; onJuvi: number }; acknowledged: number; seen: number; reminders: Reminders; isMine: boolean }
  export interface AdminNoticeDetail extends AdminNoticeRow { body; attachments: INoticeAttachment[]; audience: { rules: IAudienceRule[]; line: string }; ackCommentAllowed; priority; purpose; archivedAt: string | null; canManage: boolean }
  export function listAdminNotices(actor: NoticeActor, q: AdminNoticeListQuery): Promise<PaginatedResult<AdminNoticeRow>>;
  export function getAdminNotice(actor: NoticeActor, noticeId: string): Promise<AdminNoticeDetail>;
  export function auditTrail(actor: NoticeActor, noticeId: string): Promise<{ items: { action: string; entityType: string; performedBy: string; at: string; changes: unknown[] }[] }>;
  export function retryDelivery(actor: NoticeActor, noticeId: string): Promise<DeliveryView>;
  // admin-routes.ts
  export const noticesAdminRouter: Router;   // mounted at /api/juvi-app/admin/notices
  ```

Routes (spec §7.2; `authenticate` is already applied router-wide by `adminRouter`):

| Method | Path | Permission | Extra rule |
|---|---|---|---|
| GET | `/` | `notices:read` | admins see the college, everyone else their own notices |
| GET | `/targets` | `notices:create` | the composer's scoped options (`allowedTargets`) |
| GET | `/:id` | `notices:read` | admin or publisher, else 404 |
| GET | `/:id/reach`, `/:id/reach/pending` | `notices:read` | admin or publisher, else audited 403 |
| GET | `/:id/reach.csv` | `notices:read` | admin only (403) |
| GET | `/:id/audit` | `notices:read` | admin or publisher, else 404 |
| POST | `/attachments` | `notices:create` | multipart `file`, 10 MB, the spec MIME list, 503 without S3 |
| POST | `/audience-preview` | `notices:create` | same scope check as publish |
| POST | `/` | `notices:create` | 201 with the detail |
| POST | `/:id/remind`, `/:id/archive` | `notices:update` | admin or publisher, else audited 403 |
| POST | `/:id/retry-delivery` | `notices:update` | admin only; 409 unless the event is dead |

Decisions that bind later tasks:
- `GET /targets` is not in spec §7.2; it is added because the composer (Plan 2) must "offer only what the publisher may target" with "no raw ids", and that list depends on the server-side scope. It uses `notices:create`, since only a publisher needs it.
- The `notices` policy (spec §7.4): read for principal, HOD, faculty and staff (admin and super admin already hold `*:*`); create and update for principal, HOD, faculty and each staff office persona (`ST-EXAM`, `ST-ACC`, `ST-ADM`, `ST-TPO`, `ST-WARDEN`, `ST-TRANSPORT-OFFICER`, `ST-SEC`, `ST-LIB`, `ST-REG`). None of the rows narrows rows (`departmentOnly`/`selfOnly`), so `paginate()` and the by-id scope plugin leave notice queries alone; the audience scope is enforced by `assertAudienceInScope` in the service. The persona codes are written out in `defaults.ts` (shared code must not import a module) and a unit test pins them to `OFFICE_PERSONA_CODES`.
- Delivery state for the ERP (spec §11): `delivered` once the notice left `publishing`; `failed` while its `notice.published` event is `dead`; otherwise `delivering`.

- [ ] **Step 1: Write the failing unit tests**

```ts
// backend/src/modules/juvi-app/notices/__tests__/admin-routes-permissions.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../middleware/authorize', () => ({
  authorize: (m: string, a: string) => Object.assign((_q: unknown, _s: unknown, n: () => void) => n(), { perm: `${m}:${a}` }),
}));
import { noticesAdminRouter } from '../admin-routes';

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: { perm?: string } }[] } };

describe('admin notices routes declare the spec §7.2 permissions', () => {
  it('maps every route to notices:read, create or update', () => {
    const perms: Record<string, string> = {};
    for (const layer of (noticesAdminRouter as unknown as { stack: Layer[] }).stack) {
      if (!layer.route) continue;
      const method = Object.keys(layer.route.methods)[0]!.toUpperCase();
      perms[`${method} ${layer.route.path}`] = layer.route.stack.map((s) => s.handle.perm).find(Boolean) ?? 'none';
    }
    expect(perms).toEqual({
      'GET /': 'notices:read',
      'GET /targets': 'notices:create',
      'GET /:id': 'notices:read',
      'GET /:id/reach': 'notices:read',
      'GET /:id/reach/pending': 'notices:read',
      'GET /:id/reach.csv': 'notices:read',
      'GET /:id/audit': 'notices:read',
      'POST /attachments': 'notices:create',
      'POST /audience-preview': 'notices:create',
      'POST /': 'notices:create',
      'POST /:id/remind': 'notices:update',
      'POST /:id/archive': 'notices:update',
      'POST /:id/retry-delivery': 'notices:update',
    });
  });
});
```

```ts
// backend/src/shared/rbac/__tests__/defaults-notices.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_POLICIES } from '../defaults';
import { filterPolicies, sortPolicies } from '../engine';
import type { PolicyDoc } from '../types';
import { OFFICE_PERSONA_CODES } from '../../../modules/juvi-app/notices/offices';

const POLICIES = DEFAULT_POLICIES as PolicyDoc[];
function decide(role: string, action: string, persona: string | string[]): PolicyDoc | undefined {
  const mine = POLICIES.filter((p) => p.role === role || p.role === '*');
  const chain = Array.isArray(persona) ? persona : [persona];
  return sortPolicies(filterPolicies(mine, 'notices', action, chain), chain)[0];
}
const allows = (role: string, action: string, persona: string | string[]) => decide(role, action, persona)?.effect === 'allow';

describe('DEFAULT_POLICIES — notices (notices spec §7.4)', () => {
  it('lets admin, principal, HOD and faculty read, create and update', () => {
    for (const [role, persona] of [['admin', 'L-ADM'], ['principal', 'L-PRIN'], ['hod', 'F-HOD'], ['faculty', 'F-FAC']] as const) {
      for (const action of ['read', 'create', 'update']) expect(allows(role, action, persona), `${role} ${action}`).toBe(true);
    }
  });

  it('lets every staff member read, and only the office personas (and their sub-personas) create and update', () => {
    expect(allows('staff', 'read', 'ST-HR')).toBe(true);
    for (const code of OFFICE_PERSONA_CODES) {
      expect(allows('staff', 'create', code), code).toBe(true);
      expect(allows('staff', 'update', code), code).toBe(true);
    }
    expect(allows('staff', 'create', ['ST-ADM-TC', 'ST-ADM'])).toBe(true);
    expect(allows('staff', 'create', 'ST-HR')).toBe(false);
    expect(allows('staff', 'update', 'ST-IQAC')).toBe(false);
  });

  it('gives students and parents nothing, and never narrows rows', () => {
    for (const action of ['read', 'create', 'update']) {
      expect(allows('student', action, 'L-STU')).toBe(false);
      expect(allows('parent', action, 'L-PAR')).toBe(false);
    }
    for (const p of POLICIES.filter((x) => x.module === 'notices')) {
      expect(p.scope?.departmentOnly ?? false).toBe(false);
      expect(p.scope?.selfOnly ?? false).toBe(false);
    }
  });

  it('names exactly the office personas of offices.ts', () => {
    const codes = POLICIES.filter((p) => p.module === 'notices' && p.role === 'staff' && p.action === 'create').map((p) => p.personaType).sort();
    expect(codes).toEqual([...OFFICE_PERSONA_CODES].sort());
  });
});
```

In `backend/src/modules/juvi-app/admin/__tests__/routes-permissions.test.ts`, the Foundation console routes stay on `platform:*`; the mounted notices router adds `notices:*`. Replace the last assertion:

```ts
    expect(calls.every((c) => c.startsWith('platform:') || c.startsWith('notices:'))).toBe(true);
    expect(calls.filter((c) => c.startsWith('notices:')).length).toBe(13);
```

- [ ] **Step 2: Write the failing integration tests**

```ts
// backend/src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const s3 = vi.hoisted(() => ({ configured: false, put: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../shared/s3/s3-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/s3/s3-client')>()),
  isS3Configured: () => s3.configured,
  putObject: (input: unknown) => s3.put(input),
}));

import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { enableJuvi, provisionTestStudent } from '../factories/juvi.factory';
import { activateAccount, createStaffPublisher, makeHod } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { OutboxEvent, drainOutbox } from '../../shared/outbox';
import { AuditLog } from '../../shared/audit';

process.env.E2E_TESTING = '1';

let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin/notices';
const batchRule = () => [{ kind: 'batch', ids: [String(fx.batch._id)] }];
const body = (extra: Record<string, unknown> = {}) => ({ title: 'Exam timetable', body: 'Attached.', audience: { rules: batchRule() }, ...extra });

beforeAll(async () => { api = createTestApi(await getTestApp()); });
beforeEach(async () => {
  await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId);
  s3.configured = false; s3.put.mockClear();
});
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

async function publishAs(token: string, extra: Record<string, unknown> = {}) {
  const res = await api.as(token).post(A).send(body(extra)).expect(201);
  await drainOutbox();
  return res.body as { id: string; status: string };
}

describe('publish through the ERP (US-1)', () => {
  it('previews, publishes, lists with counts and shows the detail', async () => {
    const on = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(on.account._id));
    await provisionTestStudent(fx);
    const preview = await api.as(fx.admin.token).post(`${A}/audience-preview`).send({ rules: batchRule() }).expect(200);
    expect(preview.body).toMatchObject({ total: 2, onJuvi: 1, notOnJuvi: 1, line: 'Sent to 2024 Batch' });

    const created = await api.as(fx.admin.token).post(A).send(body({ ackRequired: true, office: 'Exam Section' })).expect(201);
    expect(created.body).toMatchObject({ title: 'Exam timetable', office: 'Exam Section', canManage: true, isMine: true });
    // kick() starts the fan-out inline, so the 201 may already see it finished.
    expect(['delivering', 'delivered']).toContain(created.body.delivery.state);
    await drainOutbox();

    const list = await api.as(fx.admin.token).get(A).expect(200);
    expect(list.body).toMatchObject({ total: 1, page: 1 });
    expect(list.body.items[0]).toMatchObject({
      id: created.body.id, office: 'Exam Section', audienceLine: 'Sent to 2024 Batch', status: 'published',
      delivery: { state: 'delivered' }, counts: { audience: 2, onJuvi: 1 }, acknowledged: 0, seen: 0,
      deadlineState: 'none', reminders: { used: 0, max: 2 }, isMine: true,
    });
    const detail = await api.as(fx.admin.token).get(`${A}/${created.body.id}`).expect(200);
    expect(detail.body).toMatchObject({ body: 'Attached.', audience: { rules: batchRule(), line: 'Sent to 2024 Batch' }, attachments: [], priority: 'routine', purpose: 'standard' });
  });

  it('refuses out-of-scope audiences with the ERP error shape (HOD targeting another department)', async () => {
    const hod = await makeHod(fx, fx.cse);
    await provisionTestStudent(fx, { branchId: String(fx.eceBranch._id) });
    const preview = await api.as(hod.token).post(`${A}/audience-preview`).send({ rules: [{ kind: 'department', ids: [String(fx.ece._id)] }] }).expect(403);
    expect(preview.body).toEqual({ error: 'You can only send notices to your own department.' });
    await api.as(hod.token).post(A).send(body({ audience: { rules: [{ kind: 'department', ids: [String(fx.ece._id)] }] } })).expect(403);
    const targets = await api.as(hod.token).get(`${A}/targets`).expect(200);
    expect(targets.body.departments).toEqual([{ id: String(fx.cse._id), label: 'Computer Science' }]);
    expect(targets.body.kinds).not.toContain('all');
    expect(await Notice.countDocuments({ collegeId: fx.collegeId })).toBe(0);
  });

  it('validates the body with { error: "Validation failed", details }', async () => {
    const res = await api.as(fx.admin.token).post(A).send({ title: '', body: 'x', audience: { rules: [] } }).expect(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(['title', 'audience.rules']));
  });
});

describe('POST /attachments (spec §6.1)', () => {
  const pdf = Buffer.from('%PDF-1.4 test');

  it('is 503 without storage, then stores a PDF and refuses other types and oversize files', async () => {
    const off = await api.as(fx.admin.token).post(`${A}/attachments`).attach('file', pdf, { filename: 'timetable.pdf', contentType: 'application/pdf' }).expect(503);
    expect(off.body.error).toMatch(/not configured/);
    s3.configured = true;
    const ok = await api.as(fx.admin.token).post(`${A}/attachments`).attach('file', pdf, { filename: 'timetable.pdf', contentType: 'application/pdf' }).expect(201);
    expect(ok.body).toMatchObject({ name: 'timetable.pdf', mime: 'application/pdf', size: pdf.length });
    expect(ok.body.key).toMatch(new RegExp(`^colleges/${fx.collegeId}/notices/`));
    const zip = await api.as(fx.admin.token).post(`${A}/attachments`).attach('file', pdf, { filename: 'a.zip', contentType: 'application/zip' }).expect(400);
    expect(zip.body.error).toMatch(/Unsupported file type/);
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    expect((await api.as(fx.admin.token).post(`${A}/attachments`).attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' }).expect(400)).body.error).toBe('File too large (max 10 MB)');
    await api.as(fx.admin.token).post(`${A}/attachments`).expect(400);
  });
});

describe('list, reach, CSV and audit (US-4, RCH-01, RCH-02)', () => {
  it('scopes the list, gives reach to the publisher and admins, audits refusals, and exports CSV for admins only', async () => {
    await provisionTestStudent(fx);
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const acc = await createStaffPublisher(fx, 'ST-ACC');
    const student = await createTestStudent(fx.collegeId, { batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    const mine = await publishAs(exam.token);
    await publishAs(fx.admin.token, { title: 'From the office' });

    expect((await api.as(exam.token).get(A).expect(200)).body.items.map((r: { id: string }) => r.id)).toEqual([mine.id]);
    expect((await api.as(fx.admin.token).get(A).expect(200)).body.total).toBe(2);
    expect((await api.as(fx.admin.token).get(`${A}?office=Exam%20Section`).expect(200)).body.total).toBe(1);
    expect((await api.as(fx.admin.token).get(`${A}?status=archived`).expect(200)).body.total).toBe(0);
    await api.as(acc.token).get(`${A}/${mine.id}`).expect(404);

    const reach = await api.as(exam.token).get(`${A}/${mine.id}/reach`).expect(200);
    expect(reach.body).toMatchObject({ audience: 2, notOnJuvi: 2 });
    expect((await api.as(fx.admin.token).get(`${A}/${mine.id}/reach/pending`).expect(200)).body.total).toBe(2);
    const refused = await api.as(acc.token).get(`${A}/${mine.id}/reach`).expect(403);
    expect(refused.body).toEqual({ error: 'Only the publisher of this notice can do that.' });
    await api.as(student.token).get(`${A}/${mine.id}/reach`).expect(403);
    const denied = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeReach', entityId: mine.id, action: 'access_denied' }).lean();
    expect(denied.map((d) => (d.changes[0]!.newValue as { role: string; via: string }).role).sort()).toEqual(['staff', 'student']);
    expect((denied[0]!.changes[0]!.newValue as { via: string }).via).toBe('erp');

    await api.as(exam.token).get(`${A}/${mine.id}/reach.csv`).expect(403);
    const csv = await api.as(fx.admin.token).get(`${A}/${mine.id}/reach.csv`).expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    const lines = csv.text.trim().split('\n');
    expect(lines[0]).toBe('Name,Identifier,Group,Status,Acknowledged at,Late,Seen at,Comment,Added later');
    expect(lines).toHaveLength(3);
    expect(lines.slice(1).every((l) => l.includes('Not on Juvi'))).toBe(true);

    const audit = await api.as(exam.token).get(`${A}/${mine.id}/audit`).expect(200);
    expect(audit.body.items.map((i: { action: string }) => i.action)).toEqual(expect.arrayContaining(['publish', 'access_denied']));
    await api.as(acc.token).get(`${A}/${mine.id}/audit`).expect(404);
  });
});

describe('remind, archive and retry delivery (NTC-08, NTC-09, spec §11)', () => {
  it('caps reminders at two, archives once, and refuses both for another office', async () => {
    await provisionTestStudent(fx);
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const acc = await createStaffPublisher(fx, 'ST-ACC');
    const n = await publishAs(exam.token, { ackRequired: true });
    await api.as(acc.token).post(`${A}/${n.id}/remind`).expect(403);
    await api.as(exam.token).post(`${A}/${n.id}/remind`).expect(200);
    const second = await api.as(fx.admin.token).post(`${A}/${n.id}/remind`).expect(200);
    expect(second.body.reminders).toMatchObject({ used: 2, max: 2 });
    const third = await api.as(exam.token).post(`${A}/${n.id}/remind`).expect(409);
    expect(third.body.error).toBe('A notice can have at most two reminders.');
    await api.as(acc.token).post(`${A}/${n.id}/archive`).expect(403);
    expect((await api.as(exam.token).post(`${A}/${n.id}/archive`).expect(200)).body.status).toBe('archived');
    expect((await api.as(exam.token).post(`${A}/${n.id}/archive`).expect(409)).body.error).toBe('This notice has been archived.');
  });

  it('shows a dead fan-out as failed and lets only an admin retry it', async () => {
    await provisionTestStudent(fx);
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const stuck = await Notice.create({
      collegeId: fx.collegeId, title: 'Stuck', body: 'b', publisher: { userId: exam.user._id, office: 'Exam Section' },
      audience: { rules: batchRule(), line: 'Sent to 2024 Batch' }, status: 'publishing',
    });
    await OutboxEvent.create({
      collegeId: fx.collegeId, type: 'notice.published', payload: { collegeId: fx.collegeId, noticeId: String(stuck._id) },
      dedupeKey: `notice:${stuck._id}:published`, status: 'dead', attempts: 8, lastError: 'boom', availableAt: new Date(), lockedUntil: null,
    });
    expect((await api.as(exam.token).get(`${A}/${stuck._id}`).expect(200)).body.delivery).toMatchObject({ state: 'failed', attempts: 8, lastError: 'boom' });
    await api.as(exam.token).post(`${A}/${stuck._id}/retry-delivery`).expect(403);
    expect((await api.as(fx.admin.token).post(`${A}/${stuck._id}/retry-delivery`).expect(200)).body.state).toBe('delivering');
    await drainOutbox();
    expect((await Notice.findById(stuck._id).lean())!.status).toBe('published');
    expect((await api.as(fx.admin.token).post(`${A}/${stuck._id}/retry-delivery`).expect(409)).body.error).toMatch(/Nothing to retry/);
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'Notice', entityId: String(stuck._id), action: 'update' })).toBe(1);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/notices/__tests__/admin-routes-permissions.test.ts src/shared/rbac/__tests__/defaults-notices.test.ts && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts`
Expected: FAIL with "Cannot find module '../admin-routes'", failing `allows(...)` assertions, and 404 `{ error: 'Not found' }` from the admin console.

- [ ] **Step 4: Add the policy and the sub-domain entry**

In `backend/src/shared/rbac/sub-domains.ts`, add after `juvi: [],`:

```ts
  juvi: [],
  notices: [],
} as const;
```

In `admin-portal/src/config/sub-domains.json`, add after `"juvi": []` (the file must stay equal to `SUB_DOMAINS`):

```json
  "juvi": [],
  "notices": []
}
```

Append to `DEFAULT_POLICIES` in `backend/src/shared/rbac/defaults.ts`, before the closing `];`:

```ts
  // ─── Juvi notices (notices spec §7.4) ───────────────────────────
  // Admin and super admin already hold *:*. The audience a publisher may
  // target (whole college / own department / own course offerings) is
  // enforced in modules/juvi-app/notices/scope.ts, not by row scope here.
  { role: 'principal', module: 'notices', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: publish and manage Juvi notices' },
  { role: 'hod', module: 'notices', action: '*', effect: 'allow', priority: 800, isActive: true, description: 'HOD: publish Juvi notices to own department' },
  { role: 'faculty', module: 'notices', action: 'read', effect: 'allow', priority: 700, isActive: true, description: 'Faculty: read own Juvi notices' },
  { role: 'faculty', module: 'notices', action: 'create', effect: 'allow', priority: 700, isActive: true, description: 'Faculty: publish Juvi notices to the courses they teach' },
  { role: 'faculty', module: 'notices', action: 'update', effect: 'allow', priority: 700, isActive: true, description: 'Faculty: remind and archive own Juvi notices' },
  { role: 'staff', module: 'notices', action: 'read', effect: 'allow', priority: 700, isActive: true, description: 'Staff: read own Juvi notices' },
  // Staff offices (modules/juvi-app/notices/offices.ts OFFICE_PERSONA_CODES; a test keeps the two lists equal).
  ...['ST-EXAM', 'ST-ACC', 'ST-ADM', 'ST-TPO', 'ST-WARDEN', 'ST-TRANSPORT-OFFICER', 'ST-SEC', 'ST-LIB', 'ST-REG'].flatMap((personaType) => [
    { role: 'staff', personaType, module: 'notices', action: 'create', effect: 'allow' as const, priority: 750, isActive: true, description: `${personaType}: publish Juvi notices college-wide` },
    { role: 'staff', personaType, module: 'notices', action: 'update', effect: 'allow' as const, priority: 750, isActive: true, description: `${personaType}: remind and archive own Juvi notices` },
  ]),
];
```

- [ ] **Step 5: Add the admin list query schema**

Append to `backend/src/modules/juvi-app/notices/admin-schemas.ts`:

```ts
export const adminNoticeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['publishing', 'published', 'archived']).optional(),
  office: z.string().trim().min(1).max(60).optional(),
  q: z.string().trim().max(80).optional(),
});
export type AdminNoticeListQuery = z.infer<typeof adminNoticeListQuerySchema>;
```

- [ ] **Step 6: Implement the admin service**

```ts
// backend/src/modules/juvi-app/notices/admin-service.ts
/**
 * ERP-side reads for notices (spec §7.2, §8). Admins (admin, super_admin,
 * principal) see the whole college; everyone else sees what they published.
 */
import { Types } from 'mongoose';
import { AppError } from '../../../middleware/errorHandler';
import { Notice, LeanNotice, IAudienceRule, INoticeAttachment } from '../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { OutboxEvent, IOutboxEvent, retryDead, kick } from '../../../shared/outbox';
import { AuditLog, createAuditLog } from '../../../shared/audit';
import { paginate } from '../../../shared/pagination';
import { PaginatedResult } from '../../../shared/types';
import { noticeEventKey } from './publish-service';
import { NoticeActor, remindersView } from './reach-service';
import { AdminNoticeListQuery } from './admin-schemas';
import { Reminders } from './schemas';

export type DeliveryState = 'delivering' | 'delivered' | 'failed';
export interface DeliveryView { state: DeliveryState; attempts: number; lastError: string | null; updatedAt: string | null }
export interface AdminNoticeRow {
  id: string; title: string; office: string; audienceLine: string; status: LeanNotice['status']; delivery: DeliveryView;
  publishedAt: string | null; createdAt: string; ackRequired: boolean; deadline: string | null; deadlineState: 'none' | 'open' | 'passed';
  counts: { audience: number; onJuvi: number }; acknowledged: number; seen: number; reminders: Reminders; isMine: boolean;
}
export interface AdminNoticeDetail extends AdminNoticeRow {
  body: string; attachments: INoticeAttachment[]; audience: { rules: IAudienceRule[]; line: string };
  ackCommentAllowed: boolean; priority: LeanNotice['priority']; purpose: LeanNotice['purpose']; archivedAt: string | null; canManage: boolean;
}

const iso = (d?: Date | null): string | null => (d ? new Date(d).toISOString() : null);
const AUDIT_TYPES = ['Notice', 'NoticeAcknowledgement', 'NoticeReach'];

function deliveryView(notice: LeanNotice, event: Pick<IOutboxEvent, 'status' | 'attempts' | 'lastError'> & { updatedAt?: Date } | undefined): DeliveryView {
  const base = { attempts: event?.attempts ?? 0, updatedAt: iso(event?.updatedAt) };
  if (notice.status !== 'publishing') return { ...base, state: 'delivered', lastError: null };
  if (event?.status === 'dead') return { ...base, state: 'failed', lastError: event.lastError ?? null };
  return { ...base, state: 'delivering', lastError: null };
}

const isMine = (actor: NoticeActor, n: LeanNotice) => Boolean(n.publisher.userId) && String(n.publisher.userId) === actor.userId;

function row(actor: NoticeActor, n: LeanNotice, event: Parameters<typeof deliveryView>[1], stats?: { acknowledged: number; seen: number }): AdminNoticeRow {
  const deadline = n.ackDeadline ? new Date(n.ackDeadline) : null;
  return {
    id: String(n._id), title: n.title, office: n.publisher.office, audienceLine: n.audience.line, status: n.status,
    delivery: deliveryView(n, event), publishedAt: iso(n.publishedAt), createdAt: new Date(n.createdAt).toISOString(),
    ackRequired: n.ackRequired, deadline: iso(deadline), deadlineState: !deadline ? 'none' : deadline.getTime() > Date.now() ? 'open' : 'passed',
    counts: n.counts, acknowledged: stats?.acknowledged ?? 0, seen: stats?.seen ?? 0, reminders: remindersView(n), isMine: isMine(actor, n),
  };
}

async function eventsFor(collegeId: string, notices: LeanNotice[]) {
  const events = await OutboxEvent.find({ collegeId, dedupeKey: { $in: notices.map((n) => noticeEventKey.published(String(n._id))) } })
    .select('dedupeKey status attempts lastError updatedAt').lean<(IOutboxEvent & { updatedAt: Date })[]>();
  return new Map(events.map((e) => [e.dedupeKey, e]));
}

export async function listAdminNotices(actor: NoticeActor, q: AdminNoticeListQuery): Promise<PaginatedResult<AdminNoticeRow>> {
  const filter: Record<string, unknown> = { collegeId: actor.collegeId };
  if (!actor.isAdmin) filter['publisher.userId'] = new Types.ObjectId(actor.userId);
  if (q.status) filter.status = q.status;
  if (q.office) filter['publisher.office'] = q.office;
  const page = await paginate(Notice, filter, q.page, q.limit, { createdAt: -1 }, undefined, { search: q.q ?? '' });
  const notices = page.items as unknown as LeanNotice[];
  const stats = await NoticeRecipient.aggregate<{ _id: Types.ObjectId; acknowledged: number; seen: number }>([
    { $match: { collegeId: new Types.ObjectId(actor.collegeId), noticeId: { $in: notices.map((n) => n._id) }, addedLater: false } },
    { $group: {
      _id: '$noticeId',
      acknowledged: { $sum: { $cond: [{ $ne: ['$ack', null] }, 1, 0] } },
      seen: { $sum: { $cond: [{ $and: [{ $eq: ['$ack', null] }, { $ne: ['$seenAt', null] }] }, 1, 0] } },
    } },
  ]);
  const statBy = new Map(stats.map((s) => [String(s._id), s]));
  const events = await eventsFor(actor.collegeId, notices);
  return { ...page, items: notices.map((n) => row(actor, n, events.get(noticeEventKey.published(String(n._id))), statBy.get(String(n._id)))) };
}

/** Admin or publisher; anyone else gets 404, as if the notice did not exist. */
async function visibleNotice(actor: NoticeActor, noticeId: string): Promise<LeanNotice> {
  const notice = Types.ObjectId.isValid(noticeId) ? await Notice.findOne({ _id: noticeId, collegeId: actor.collegeId }).lean<LeanNotice>() : null;
  if (!notice || !(actor.isAdmin || isMine(actor, notice))) throw new AppError(404, 'Notice not found');
  return notice;
}

export async function getAdminNotice(actor: NoticeActor, noticeId: string): Promise<AdminNoticeDetail> {
  const n = await visibleNotice(actor, noticeId);
  const [stats] = await NoticeRecipient.aggregate<{ acknowledged: number; seen: number }>([
    { $match: { collegeId: new Types.ObjectId(actor.collegeId), noticeId: n._id, addedLater: false } },
    { $group: { _id: null, acknowledged: { $sum: { $cond: [{ $ne: ['$ack', null] }, 1, 0] } }, seen: { $sum: { $cond: [{ $and: [{ $eq: ['$ack', null] }, { $ne: ['$seenAt', null] }] }, 1, 0] } } } },
  ]);
  const events = await eventsFor(actor.collegeId, [n]);
  return {
    ...row(actor, n, events.get(noticeEventKey.published(String(n._id))), stats),
    body: n.body, attachments: n.attachments.map(({ key, name, mime, size }) => ({ key, name, mime, size })),
    audience: { rules: n.audience.rules.map((r) => ({ kind: r.kind, ids: [...r.ids], ...(r.departmentId ? { departmentId: r.departmentId } : {}) })), line: n.audience.line },
    ackCommentAllowed: n.ackCommentAllowed, priority: n.priority, purpose: n.purpose, archivedAt: iso(n.archivedAt),
    canManage: actor.isAdmin || isMine(actor, n),
  };
}

export async function auditTrail(actor: NoticeActor, noticeId: string) {
  const n = await visibleNotice(actor, noticeId);
  const rows = await AuditLog.find({ collegeId: actor.collegeId, entityId: String(n._id), entityType: { $in: AUDIT_TYPES } }).sort({ timestamp: -1 }).limit(500).lean();
  return { items: rows.map((r) => ({ action: r.action, entityType: r.entityType, performedBy: r.performedBy, at: new Date(r.timestamp).toISOString(), changes: r.changes })) };
}

/** Admin "Retry delivery" for a dead notice.published event (spec §11). */
export async function retryDelivery(actor: NoticeActor, noticeId: string): Promise<DeliveryView> {
  if (!actor.isAdmin) throw new AppError(403, 'Only admins can retry delivery');
  const n = await visibleNotice(actor, noticeId);
  const key = noticeEventKey.published(String(n._id));
  if (n.status !== 'publishing' || !(await retryDead(actor.collegeId, key))) throw new AppError(409, 'Nothing to retry: delivery has not failed');
  await createAuditLog({
    collegeId: actor.collegeId, entityType: 'Notice', entityId: String(n._id), entityName: `Notice from ${n.publisher.office}`,
    action: 'update', changes: [{ field: 'delivery', displayName: 'Delivery', oldValue: 'failed', newValue: 'retried' }], performedBy: actor.name,
  });
  await kick();
  const event = await OutboxEvent.findOne({ collegeId: actor.collegeId, dedupeKey: key }).lean<IOutboxEvent & { updatedAt: Date }>();
  return deliveryView(n, event ?? undefined);
}
```

- [ ] **Step 7: Implement the controller and the routes, and mount them**

```ts
// backend/src/modules/juvi-app/notices/admin-controller.ts
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/authenticate';
import { AppError } from '../../../middleware/errorHandler';
import { NOTICE_ATTACHMENT_MIMES, NOTICE_ATTACHMENT_MAX_BYTES } from '../../../models/juvi/Notice';
import { resolvePublisherScope, ErpUserRef } from './publisher-scope';
import { loadAudienceGraph } from './audience-graph';
import { allowedTargets } from './scope';
import { uploadAttachment, previewAudience, publishNotice, remindNotice, archiveNotice } from './publish-service';
import { erpActor, manageableNotice, buildReach, pendingPage, reachCsv } from './reach-service';
import { listAdminNotices, getAdminNotice, auditTrail, retryDelivery } from './admin-service';
import { publishSchema, audiencePreviewSchema, adminNoticeListQuerySchema } from './admin-schemas';
import { pendingQuerySchema } from './schemas';

const UNSUPPORTED = 'Unsupported file type. Use PDF, PNG, JPEG, WEBP, DOCX, XLSX or PPTX.';

/** Memory storage (the buffer goes straight to S3), one file, 10 MB, the spec §6.1 MIME list. */
export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: NOTICE_ATTACHMENT_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!NOTICE_ATTACHMENT_MIMES.includes(file.mimetype)) { cb(new AppError(400, UNSUPPORTED)); return; }
    cb(null, true);
  },
});

export function attachmentUploadErrors(err: unknown, _req: Request, _res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    next(new AppError(400, err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10 MB)' : err.message));
    return;
  }
  next(err);
}

const cid = (req: AuthRequest) => req.collegeId!;
const actor = (req: AuthRequest) => erpActor(cid(req), req.user!);
const who = (req: AuthRequest) => req.user?.name || 'System';
const userRef = (req: AuthRequest): ErpUserRef => ({ id: req.user!.id, role: req.user!.role, personaType: req.user!.personaType, personas: req.user!.personas });
const id = (req: AuthRequest) => String(req.params.id);

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await listAdminNotices(actor(req), adminNoticeListQuerySchema.parse(req.query))); } catch (e) { next(e); }
}
export async function targets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const scope = await resolvePublisherScope(cid(req), userRef(req));
    res.json({ office: scope.office, ...allowedTargets(scope, await loadAudienceGraph(cid(req))) });
  } catch (e) { next(e); }
}
export async function detail(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await getAdminNotice(actor(req), id(req))); } catch (e) { next(e); }
}
export async function reach(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await buildReach(cid(req), await manageableNotice(actor(req), id(req), 'reach'))); } catch (e) { next(e); }
}
export async function pending(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await pendingPage(cid(req), await manageableNotice(actor(req), id(req), 'reach'), pendingQuerySchema.parse(req.query))); } catch (e) { next(e); }
}
export async function csv(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const a = actor(req);
    if (!a.isAdmin) throw new AppError(403, 'Only admins can export reach');
    const notice = await manageableNotice(a, id(req), 'reach');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="notice-reach-${String(notice._id).slice(-6)}.csv"`);
    res.send(await reachCsv(cid(req), notice));
  } catch (e) { next(e); }
}
export async function audit(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await auditTrail(actor(req), id(req))); } catch (e) { next(e); }
}
export async function upload(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    res.status(201).json(await uploadAttachment(cid(req), req.file));
  } catch (e) { next(e); }
}
export async function preview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = audiencePreviewSchema.parse(req.body);
    const scope = await resolvePublisherScope(cid(req), userRef(req), body.office);
    res.json(await previewAudience(cid(req), scope, body.rules));
  } catch (e) { next(e); }
}
export async function publish(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = publishSchema.parse(req.body);
    const scope = await resolvePublisherScope(cid(req), userRef(req), body.office);
    const notice = await publishNotice(cid(req), scope, body, who(req));
    res.status(201).json(await getAdminNotice(actor(req), String(notice._id)));
  } catch (e) { next(e); }
}
export async function remind(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await remindNotice(actor(req), id(req))); } catch (e) { next(e); }
}
export async function archive(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await archiveNotice(actor(req), id(req))); } catch (e) { next(e); }
}
export async function retry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await retryDelivery(actor(req), id(req))); } catch (e) { next(e); }
}
```

```ts
// backend/src/modules/juvi-app/notices/admin-routes.ts
import { Router } from 'express';
import { authorize } from '../../../middleware/authorize';
import * as ctrl from './admin-controller';

/**
 * ERP notices API (spec §7.2), mounted by admin/routes.ts at /notices, so it
 * inherits `authenticate` and the ERP `{ error }` shape from adminRouter.
 * Row-level audience scope is enforced in the service, on top of the policy.
 */
export const noticesAdminRouter = Router();

noticesAdminRouter.get('/', authorize('notices', 'read'), ctrl.list);
noticesAdminRouter.get('/targets', authorize('notices', 'create'), ctrl.targets);
noticesAdminRouter.get('/:id', authorize('notices', 'read'), ctrl.detail);
noticesAdminRouter.get('/:id/reach', authorize('notices', 'read'), ctrl.reach);
noticesAdminRouter.get('/:id/reach/pending', authorize('notices', 'read'), ctrl.pending);
noticesAdminRouter.get('/:id/reach.csv', authorize('notices', 'read'), ctrl.csv);   // admin only (service check)
noticesAdminRouter.get('/:id/audit', authorize('notices', 'read'), ctrl.audit);

noticesAdminRouter.post('/attachments', authorize('notices', 'create'), ctrl.attachmentUpload.single('file'), ctrl.attachmentUploadErrors, ctrl.upload);
noticesAdminRouter.post('/audience-preview', authorize('notices', 'create'), ctrl.preview);
noticesAdminRouter.post('/', authorize('notices', 'create'), ctrl.publish);

noticesAdminRouter.post('/:id/remind', authorize('notices', 'update'), ctrl.remind);
noticesAdminRouter.post('/:id/archive', authorize('notices', 'update'), ctrl.archive);
noticesAdminRouter.post('/:id/retry-delivery', authorize('notices', 'update'), ctrl.retry);   // admin only (service check)
```

In `backend/src/modules/juvi-app/admin/routes.ts`, import the router and mount it just before the 404 catch-all:

```ts
import { noticesAdminRouter } from '../notices/admin-routes';
```

```ts
adminRouter.post('/reconcile', authorize('platform', 'update'), channelsCtrl.reconcileNow);

adminRouter.use('/notices', noticesAdminRouter);

adminRouter.use((_req, _res, next) => next(new AppError(404, 'Not found')));
adminRouter.use(errorHandler);
```

- [ ] **Step 8: Run the tests, refresh the route-walk snapshot, typecheck**

Run: `cd backend && npx vitest run src/modules/juvi-app src/shared/rbac && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts src/__e2e__/modules/juvi-app-admin-settings.e2e.test.ts`
Expected: PASS (admin-routes-permissions 1, defaults-notices 4, admin console routes-permissions 1, sub-domains 2; admin notices e2e 7; the Foundation admin e2e unchanged).

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/rbac-route-walk.test.ts -u && git diff -- src/__e2e__/modules/__snapshots__ | grep '^[+-] ' | sort | uniq -c`
Expected: only rows for the seven new GET routes under `/api/juvi-app/admin/notices` are added, none removed, and no persona gets a 5xx: `/` 200 and `/targets` 200 for F-HOD, F-FAC, ST-ACC and ST-WARDEN (all four hold `notices:read` and `notices:create`); `/:id`, `/:id/reach`, `/:id/reach/pending`, `/:id/audit` 404 (random ids); `/:id/reach.csv` 403 (not an admin).

Run: `cd backend && npm run typecheck`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/juvi-app/notices backend/src/modules/juvi-app/admin/routes.ts backend/src/modules/juvi-app/admin/__tests__/routes-permissions.test.ts backend/src/shared/rbac/sub-domains.ts backend/src/shared/rbac/defaults.ts backend/src/shared/rbac/__tests__/defaults-notices.test.ts admin-portal/src/config/sub-domains.json backend/src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts backend/src/__e2e__/modules/__snapshots__/rbac-route-walk.test.ts.snap
git commit -m "feat(juvi-app): ERP notices API (publish, targets, reach, CSV, audit, remind, archive, retry delivery) and the notices policy

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Onboarding `first_notice`, the welcome notice, and notices on channel detail

**Files:**
- Create: `backend/src/modules/juvi-app/notices/welcome-service.ts`
- Modify: `backend/src/modules/juvi-app/accounts/onboarding.ts`, `backend/src/modules/juvi-app/notices/mobile-service.ts` (`channelNotices`), `backend/src/modules/juvi-app/notices/mobile-controller.ts`, `backend/src/modules/juvi-app/notices/mobile-routes.ts`, `backend/src/modules/juvi-app/spaces/schemas.ts:22-30`, `backend/src/modules/juvi-app/spaces/spaces-service.ts:88-102`, `backend/src/modules/juvi-app/admin/schemas.ts:19-29`, `backend/src/modules/juvi-app/admin/settings-service.ts:63-70`, `backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts:25,58-81`, `backend/src/__e2e__/modules/juvi-app-config.e2e.test.ts:39`, `backend/src/__e2e__/modules/__snapshots__/rbac-route-walk.test.ts.snap`, `mobile/api/openapi.json` (regenerated: `ChannelDetail` gains `notices`)
- Test: `backend/src/__e2e__/modules/juvi-notices-welcome.e2e.test.ts`

**Interfaces:**
- Consumes: `toDetail`, `toCard` (Task 5); `loadAudienceGraph` (Task 4); `noticeCardSchema`, `NoticeCard`, `NoticeDetail` (Task 5); `College`, `IJuviConfig.welcomeNotice` (Task 2); `invalidateJuviConfig` (`config/institution-config.ts:62`); `AccountKind`; Task 7 `buildReach` through the admin API.
- Produces:
  ```ts
  // accounts/onboarding.ts
  export const ONBOARDING_STEPS = ['identity', 'spaces', 'notifications', 'first_notice'] as const;
  // welcome-service.ts
  export const WELCOME_OFFICE = 'Juvi';
  export type WelcomeSlot = 'studentNoticeId' | 'facultyNoticeId';
  export function welcomeSlot(kind: AccountKind): WelcomeSlot;              // staff share the faculty slot
  export function ensureDefaultWelcomeNotice(collegeId: string, kind: AccountKind): Promise<LeanNotice>;
  export function welcomeNoticeFor(collegeId: string, kind: AccountKind): Promise<LeanNotice>;
  export function getFirstNotice(ctx: MobileContext): Promise<NoticeDetail>;
  // mobile-service.ts (added)
  export const CHANNEL_NOTICES_MAX = 20;
  export function channelNotices(ctx: MobileContext, channelId: string): Promise<NoticeCard[]>;
  // spaces/schemas.ts
  channelDetailSchema gains `notices: z.array(noticeCardSchema)`
  // admin/schemas.ts
  settingsUpdateSchema gains `welcomeNotice?: { studentNoticeId?: string | null; facultyNoticeId?: string | null }`
  ```

Decisions that bind later tasks:
- `welcomeNotice` has two slots (spec §5): students use `studentNoticeId`; faculty **and staff** use `facultyNoticeId`.
- The configured notice is used only while it exists, is `purpose: 'welcome'` and `published`. Otherwise the auto-created default is used and recorded in the slot (compare-and-set on the slot's previous value, so two concurrent first requests end up sharing one default; the loser deletes its copy). The default is `ackRequired`, has no deadline, office `Juvi`, no `publisher.userId`, and its audience rule is `role: student` (or `role: faculty, staff`). It is never fanned out.
- `GET /onboarding/first-notice` returns the notice detail (the same shape as `GET /notices/:id`) and makes sure the caller has a recipient row carrying their account (spec §6.5): a missing row is created as a snapshot row (`addedLater: false`) and increments `counts.audience` and `counts.onJuvi`; an existing row without an account (fanned out while the person was onboarding) gets the account and increments `counts.onJuvi`. The acknowledgement then goes through `POST /notices/:id/ack`, so it is real, audited and in reach.
- A `purpose: 'welcome'` notice is never given added-later rows (Task 10 skips it).
- Channel detail lists up to 20 recent notices that carry the channel in `channelIds` **and** that the caller received (spec §7.1). The OpenAPI document changes here (`ChannelDetail.notices`), so this task regenerates `mobile/api/openapi.json`; `NoticeCard` is inlined until Task 11 names it. The field is additive; the Foundation app's generated client ignores it until Plan 3 regenerates.

- [ ] **Step 1: Update the Foundation tests for four onboarding steps**

In `backend/src/__e2e__/modules/juvi-app-config.e2e.test.ts:39`, change the expected list:

```ts
    expect(res.body).toMatchObject({ name: 'JIT Test College', code: 'JIT-TEST', supportContact: { name: 'Office', phone: '1' }, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false }, onboardingSteps: ['identity', 'spaces', 'notifications', 'first_notice'] });
```

In `backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts:25`:

```ts
    expect(res.body.account).toMatchObject({ kind: 'student', onboardingSteps: ['identity', 'spaces', 'notifications', 'first_notice'], mustChangePassword: true });
```

and replace the body of `it('advance walks the steps in order and completes after the last', …)` from the `for` loop on:

```ts
    for (const step of [0, 1, 2]) {
      const r = await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step }).expect(200);
      expect(r.body).toMatchObject({ onboardingStep: step + 1, onboardingComplete: false });
    }
    const done = await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step: 3 }).expect(200);
    expect(done.body).toMatchObject({ onboardingStep: 4, onboardingComplete: true });
    const acct = await JuviAccount.findById(s.account._id).lean();
    expect(acct?.status).toBe('active');
    expect(acct?.onboardingCompletedAt).toBeInstanceOf(Date);
    // Re-sending the last step is idempotent.
    await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step: 3 }).expect(200);
    // R12: once complete, any step is a no-op and nothing is rewritten.
    const before = (await JuviAccount.findById(s.account._id).lean())!;
    const r3 = await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step: 4 }).expect(200);
    expect(r3.body).toMatchObject({ onboardingStep: 4, onboardingComplete: true });
    const after = (await JuviAccount.findById(s.account._id).lean())!;
    expect(after.onboardingStep).toBe(4);
    expect(after.onboardingCompletedAt?.toISOString()).toBe(before.onboardingCompletedAt?.toISOString());
  });
```

- [ ] **Step 2: Write the failing integration tests**

```ts
// backend/src/__e2e__/modules/juvi-notices-welcome.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient } from '../factories/juvi.factory';
import { activateAccount, publishTestNotice, signInAs } from '../factories/notice.factory';
import { College } from '../../models/College';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { Channel } from '../../models/juvi/Channel';
import { AuditLog } from '../../shared/audit';
import { drainOutbox } from '../../shared/outbox';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';

process.env.E2E_TESTING = '1';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const ADMIN = '/api/juvi-app/admin';

beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

async function onboardingStudent(deviceId: string) {
  const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  return { ...s, token: await signInAs(app, fx, s.student.rollNumber, s.tempPassword, deviceId) };
}

describe('GET /onboarding/first-notice (US-5, spec §6.5)', () => {
  it('auto-creates one default welcome notice per kind, records it, and creates snapshot rows on demand', async () => {
    const a = await onboardingStudent('dev-a');
    const first = await mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`).expect(200);
    expect(first.body).toMatchObject({ title: 'Welcome to Juvi', purpose: 'welcome', office: 'Juvi', ackRequired: true, deadline: null, state: 'received', isPublisher: false });
    expect((await College.findById(fx.collegeId).lean())!.juvi.welcomeNotice?.studentNoticeId).toBe(first.body.id);
    const row = (await NoticeRecipient.findOne({ noticeId: first.body.id, personId: a.person._id }).lean())!;
    expect(row).toMatchObject({ addedLater: false, ackRequired: true, kind: 'student', labels: { batch: '2024 Batch', section: 'A' } });
    expect(String(row.accountId)).toBe(String(a.account._id));
    expect(row.receivedAt).toBeInstanceOf(Date);
    expect((await Notice.findById(first.body.id).lean())!.counts).toEqual({ audience: 1, onJuvi: 1 });

    // Asking again changes nothing.
    expect((await mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`).expect(200)).body.id).toBe(first.body.id);
    expect(await NoticeRecipient.countDocuments({ noticeId: first.body.id })).toBe(1);

    const b = await onboardingStudent('dev-b');
    expect((await mobileClient(app, b.token).get(`${V1}/onboarding/first-notice`).expect(200)).body.id).toBe(first.body.id);
    expect((await Notice.findById(first.body.id).lean())!.counts).toEqual({ audience: 2, onJuvi: 2 });

    const f = await provisionTestFaculty(fx);
    const tf = await signInAs(app, fx, f.faculty.employeeCode, f.tempPassword, 'dev-f');
    const facultyWelcome = await mobileClient(app, tf).get(`${V1}/onboarding/first-notice`).expect(200);
    expect(facultyWelcome.body.id).not.toBe(first.body.id);
    expect((await College.findById(fx.collegeId).lean())!.juvi.welcomeNotice?.facultyNoticeId).toBe(facultyWelcome.body.id);
    expect(await Notice.countDocuments({ collegeId: fx.collegeId, purpose: 'welcome' })).toBe(2);
  });

  it('two concurrent first requests share one default', async () => {
    const a = await onboardingStudent('dev-a');
    const b = await onboardingStudent('dev-b');
    const [ra, rb] = await Promise.all([
      mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`),
      mobileClient(app, b.token).get(`${V1}/onboarding/first-notice`),
    ]);
    expect(ra.body.id).toBe(rb.body.id);
    expect(await Notice.countDocuments({ collegeId: fx.collegeId, purpose: 'welcome' })).toBe(1);
    expect((await Notice.findById(ra.body.id).lean())!.counts.audience).toBe(2);
  });

  it('the acknowledgement is real: audited and in reach, reconciling to the grown audience', async () => {
    const a = await onboardingStudent('dev-a');
    const b = await onboardingStudent('dev-b');
    const w = (await mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`).expect(200)).body;
    await mobileClient(app, b.token).get(`${V1}/onboarding/first-notice`).expect(200);
    await mobileClient(app, a.token).post(`${V1}/notices/${w.id}/ack`).send({ method: 'hold' }).expect(200);
    await drainOutbox();
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'NoticeAcknowledgement', entityId: w.id })).toBe(1);
    const reach = (await api.as(fx.admin.token).get(`${ADMIN}/notices/${w.id}/reach`).expect(200)).body;
    expect(reach).toMatchObject({ audience: 2, acknowledged: 1, notSeen: 1, notOnJuvi: 0, addedLater: { total: 0 } });
    expect(reach.acknowledged + reach.seen + reach.notSeen + reach.notOnJuvi).toBe(reach.audience);
  });

  it('uses the configured welcome notice, attaching the account to a row fanned out while onboarding', async () => {
    const a = await onboardingStudent('dev-a');
    const configured = await publishTestNotice(fx, { title: 'Welcome to JIT', purpose: 'welcome', ackRequired: true, audience: { rules: [{ kind: 'role', ids: ['student'] }] } });
    expect(configured.counts).toEqual({ audience: 1, onJuvi: 0 });
    const plain = await publishTestNotice(fx, { title: 'Not a welcome' });
    await api.as(fx.admin.token).put(`${ADMIN}/settings`).send({ welcomeNotice: { studentNoticeId: String(plain._id) } }).expect(400);
    await api.as(fx.admin.token).put(`${ADMIN}/settings`).send({ welcomeNotice: { studentNoticeId: String(configured._id) } }).expect(200);

    const res = await mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`).expect(200);
    expect(res.body).toMatchObject({ id: String(configured._id), title: 'Welcome to JIT' });
    expect(await NoticeRecipient.countDocuments({ noticeId: configured._id })).toBe(1);
    expect(String((await NoticeRecipient.findOne({ noticeId: configured._id }).lean())!.accountId)).toBe(String(a.account._id));
    expect((await Notice.findById(configured._id).lean())!.counts).toEqual({ audience: 1, onJuvi: 1 });

    // An archived configured notice falls back to the default.
    await Notice.updateOne({ _id: configured._id }, { $set: { status: 'archived' } });
    const fallback = await mobileClient(app, a.token).get(`${V1}/onboarding/first-notice`).expect(200);
    expect(fallback.body).toMatchObject({ title: 'Welcome to Juvi', office: 'Juvi' });
    await api.as(fx.admin.token).put(`${ADMIN}/settings`).send({ welcomeNotice: { studentNoticeId: null } }).expect(200);
  });
});

describe('GET /channels/:id notices[] (US-6, NTC-07)', () => {
  it('lists the notices whose audience matches the channel and that the caller received', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const other = await provisionTestStudent(fx);
    await reconcileCollege(fx.collegeId);
    const batchChannel = (await Channel.findOne({ collegeId: fx.collegeId, scopeType: 'batch', scopeId: fx.batch._id }).lean())!;
    const forBatch = await publishTestNotice(fx, { title: 'For the batch' });
    await publishTestNotice(fx, { title: 'Just one person', audience: { rules: [{ kind: 'custom', ids: [String(other.person._id)] }] } });
    const t = await signInAs(app, fx, s.student.rollNumber, s.tempPassword, 'dev-s');
    const res = await mobileClient(app, t).get(`${V1}/channels/${batchChannel._id}`).expect(200);
    expect(res.body.notices).toHaveLength(1);
    expect(res.body.notices[0]).toMatchObject({ id: String(forBatch._id), title: 'For the batch', audienceLine: 'Sent to 2024 Batch', state: 'received' });
    const college = (await Channel.findOne({ collegeId: fx.collegeId, scopeType: 'college' }).lean())!;
    expect((await mobileClient(app, t).get(`${V1}/channels/${college._id}`).expect(200)).body.notices).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-welcome.e2e.test.ts src/__e2e__/modules/juvi-app-me.e2e.test.ts src/__e2e__/modules/juvi-app-config.e2e.test.ts`
Expected: FAIL — `/onboarding/first-notice` is 404 `NOT_FOUND`, the step lists have three entries, and `notices` is missing from channel detail.

- [ ] **Step 4: Add the onboarding step**

```ts
// backend/src/modules/juvi-app/accounts/onboarding.ts
/**
 * Server-owned ordered step list. Notices (sub-project 2) appended 'first_notice' (index 3):
 * the welcome notice from GET /onboarding/first-notice, acknowledged for real.
 * Apps that do not know a step render it as a generic card (notices spec US-5.3).
 */
export const ONBOARDING_STEPS = ['identity', 'spaces', 'notifications', 'first_notice'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
```

- [ ] **Step 5: Implement the welcome service**

```ts
// backend/src/modules/juvi-app/notices/welcome-service.ts
/**
 * Onboarding step 4 (spec §4 US-5, §6.5): the configured welcome notice for the
 * caller's kind, or an auto-created default. Rows are created on demand and are
 * snapshot rows, so the welcome audience grows as accounts onboard.
 */
import { Types } from 'mongoose';
import { College } from '../../../models/College';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient, LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { AccountKind } from '../../../models/juvi/JuviAccount';
import { MobileContext } from '../middleware/authenticate-mobile';
import { invalidateJuviConfig } from '../config/institution-config';
import { loadAudienceGraph } from './audience-graph';
import { toDetail } from './cards';
import { NoticeDetail } from './schemas';

export const WELCOME_OFFICE = 'Juvi';
export type WelcomeSlot = 'studentNoticeId' | 'facultyNoticeId';

const DEFAULT_TITLE = 'Welcome to Juvi';
const DEFAULT_BODY = [
  'This is where your college sends official notices.',
  'When a notice asks you to acknowledge it, hold the button (or tap and confirm) to tell the office you have read it.',
  'Your acknowledgement is recorded with the time, so you never need to reply by message.',
].join('\n\n');

/** Students use the student slot; faculty and staff share the faculty slot (spec §5). */
export function welcomeSlot(kind: AccountKind): WelcomeSlot {
  return kind === 'student' ? 'studentNoticeId' : 'facultyNoticeId';
}

async function configuredId(collegeId: string, slot: WelcomeSlot): Promise<string | null> {
  const college = await College.findById(collegeId).select('juvi.welcomeNotice').lean();
  return college?.juvi?.welcomeNotice?.[slot] ?? null;
}

async function usableWelcome(collegeId: string, id: string | null): Promise<LeanNotice | null> {
  if (!id || !Types.ObjectId.isValid(id)) return null;
  return Notice.findOne({ _id: id, collegeId, purpose: 'welcome', status: 'published' }).lean<LeanNotice>();
}

/**
 * Creates the default welcome notice and records it in the slot, unless another
 * request recorded one first (compare-and-set on the slot's previous value).
 */
export async function ensureDefaultWelcomeNotice(collegeId: string, kind: AccountKind, attempt = 0): Promise<LeanNotice> {
  const slot = welcomeSlot(kind);
  const previous = await configuredId(collegeId, slot);
  const existing = await usableWelcome(collegeId, previous);
  if (existing) return existing;

  const created = await Notice.create({
    collegeId, title: DEFAULT_TITLE, body: DEFAULT_BODY,
    publisher: { office: WELCOME_OFFICE },
    audience: {
      rules: [{ kind: 'role', ids: kind === 'student' ? ['student'] : ['faculty', 'staff'] }],
      line: kind === 'student' ? 'Sent to every student who joins Juvi' : 'Sent to every faculty and staff member who joins Juvi',
    },
    ackRequired: true, purpose: 'welcome', status: 'published', publishedAt: new Date(),
  });
  const path = `juvi.welcomeNotice.${slot}`;
  const unchanged = previous ? { [path]: previous } : { $or: [{ [path]: { $exists: false } }, { [path]: null }] };
  const res = await College.updateOne({ _id: collegeId, ...unchanged }, { $set: { [path]: String(created._id) } });
  if (res.modifiedCount === 0) {
    await Notice.deleteOne({ _id: created._id, collegeId });
    if (attempt >= 2) throw new Error('Could not settle the welcome notice');
    return ensureDefaultWelcomeNotice(collegeId, kind, attempt + 1);
  }
  await invalidateJuviConfig(collegeId);
  return created.toObject() as unknown as LeanNotice;
}

/** The configured welcome notice for this kind while it is a published welcome notice; otherwise the default. */
export async function welcomeNoticeFor(collegeId: string, kind: AccountKind): Promise<LeanNotice> {
  return (await usableWelcome(collegeId, await configuredId(collegeId, welcomeSlot(kind)))) ?? ensureDefaultWelcomeNotice(collegeId, kind);
}

export async function getFirstNotice(ctx: MobileContext): Promise<NoticeDetail> {
  const notice = await welcomeNoticeFor(ctx.collegeId, ctx.kind);
  const personId = new Types.ObjectId(String(ctx.account.personId));
  const accountId = new Types.ObjectId(ctx.accountId);
  const now = new Date();

  let row = await NoticeRecipient.findOne({ collegeId: ctx.collegeId, noticeId: notice._id, personId }).lean<LeanNoticeRecipient>();
  if (!row) {
    const person = (await loadAudienceGraph(ctx.collegeId, { personIds: [String(personId)] })).people.get(String(personId));
    try {
      await NoticeRecipient.create({
        collegeId: ctx.collegeId, noticeId: notice._id, personId, accountId, kind: ctx.kind, labels: person?.labels ?? {},
        addedLater: false, ackRequired: notice.ackRequired, deadline: notice.ackDeadline ?? null, receivedAt: now,
      });
      // Welcome rows are snapshot rows: the audience grows with them (spec §6.5).
      await Notice.updateOne({ _id: notice._id, collegeId: ctx.collegeId }, { $inc: { 'counts.audience': 1, 'counts.onJuvi': 1 } });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;   // a concurrent request created it
    }
  } else if (!row.accountId) {
    const res = await NoticeRecipient.updateOne({ _id: row._id, collegeId: ctx.collegeId, accountId: null }, { $set: { accountId, receivedAt: now } });
    if (res.modifiedCount > 0) await Notice.updateOne({ _id: notice._id, collegeId: ctx.collegeId }, { $inc: { 'counts.onJuvi': 1 } });
  }
  row = await NoticeRecipient.findOne({ collegeId: ctx.collegeId, noticeId: notice._id, personId }).lean<LeanNoticeRecipient>();
  const fresh = (await Notice.findOne({ _id: notice._id, collegeId: ctx.collegeId }).lean<LeanNotice>())!;
  return toDetail(fresh, row, ctx.userId);
}
```

- [ ] **Step 6: Add channel notices and the routes**

Append to `backend/src/modules/juvi-app/notices/mobile-service.ts` (add `NoticeCard` to the `./schemas` import):

```ts
export const CHANNEL_NOTICES_MAX = 20;

/** Inline cards for a channel (NTC-07): notices carrying the channel that the caller received. */
export async function channelNotices(ctx: MobileContext, channelId: string): Promise<NoticeCard[]> {
  const notices = await Notice.find({ collegeId: ctx.collegeId, channelIds: new Types.ObjectId(channelId), status: { $in: ['published', 'archived'] } })
    .sort({ publishedAt: -1 }).limit(100).lean<LeanNotice[]>();
  if (notices.length === 0) return [];
  const rows = await NoticeRecipient.find({ collegeId: ctx.collegeId, accountId: ctx.accountId, noticeId: { $in: notices.map((n) => n._id) } }).lean<LeanNoticeRecipient[]>();
  const rowBy = new Map(rows.map((r) => [String(r.noticeId), r]));
  return notices
    .flatMap((n) => { const row = rowBy.get(String(n._id)); return row ? [toCard(n, row, ctx.userId)] : []; })
    .slice(0, CHANNEL_NOTICES_MAX);
}
```

Append to `backend/src/modules/juvi-app/notices/mobile-controller.ts`:

```ts
import { getFirstNotice } from './welcome-service';

export async function firstNotice(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await getFirstNotice(requireMobile(req))); } catch (e) { next(e); }
}
```

Append to `backend/src/modules/juvi-app/notices/mobile-routes.ts`:

```ts
// Onboarding step 4 (first_notice): the welcome notice, with the caller's row created on demand.
noticesRouter.get('/onboarding/first-notice', authenticateMobile, ctrl.firstNotice);
```

In `backend/src/modules/juvi-app/spaces/schemas.ts`, import the card and extend `channelDetailSchema`:

```ts
import { noticeCardSchema } from '../notices/schemas';
```

```ts
export const channelDetailSchema = z.object({
  id: z.string(), name: z.string(), about: z.string(),
  scopeType: spaceChannelRowSchema.shape.scopeType, templateCode: spaceChannelRowSchema.shape.templateCode,
  status: z.enum(['active', 'archived']), memberCount: z.number().int(),
  replyRule: z.enum(['allowed', 'announcement_only']), defaultPriority: z.enum(['routine', 'important']),
  role: z.enum(['member', 'publisher']), muted: z.boolean(), canPost: z.boolean(), canReply: z.boolean(),
  whoCanPost: z.string(), linkedObject: z.object({ type: z.string(), id: z.string().nullable() }),
  /** Recent notices whose audience matches this channel and that the caller received (notices spec §7.1). */
  notices: z.array(noticeCardSchema),
});
```

In `backend/src/modules/juvi-app/spaces/spaces-service.ts`, import `channelNotices` and add the field in `getChannel`:

```ts
import { channelNotices } from '../notices/mobile-service';
```

```ts
    whoCanPost: WHO_CAN_POST[c.templateCode],
    linkedObject: { type: c.scopeType, id: c.scopeId ? String(c.scopeId) : null },
    notices: await channelNotices(ctx, String(c._id)),
  };
```

- [ ] **Step 7: Accept and validate the welcome-notice setting**

In `backend/src/modules/juvi-app/admin/schemas.ts`, add to `settingsUpdateSchema` after `featureFlags`:

```ts
  featureFlags: z.object({ languageRoadmap: z.boolean().optional() }).optional(),
  /** Published `purpose: 'welcome'` notice per kind; null clears the slot (the default is used). */
  welcomeNotice: z.object({ studentNoticeId: objectId.nullable().optional(), facultyNoticeId: objectId.nullable().optional() }).strict().optional(),
}).strict();
```

In `backend/src/modules/juvi-app/admin/settings-service.ts`, import `Notice` and validate before writing (the existing `flatten` turns the object into `juvi.welcomeNotice.<slot>` paths):

```ts
import { Notice } from '../../../models/juvi/Notice';
```

```ts
export async function updateSettings(collegeId: string, patch: z.infer<typeof settingsUpdateSchema>, performedBy: string): Promise<AdminSettingsView> {
  const before = await College.findById(collegeId).select('name juvi').lean();
  if (!before) throw new AppError(404, 'College not found');
  for (const id of Object.values(patch.welcomeNotice ?? {})) {
    if (id && !(await Notice.exists({ _id: id, collegeId, purpose: 'welcome', status: 'published' }))) {
      throw new AppError(400, 'Choose a published welcome notice');
    }
  }
  const set = flatten(patch as Record<string, unknown>);
```

- [ ] **Step 8: Regenerate the contract and run everything**

Run: `npm run openapi:mobile -w backend && node mobile/tool/check_nullable_objects.js mobile/api/openapi.json`
Expected: `wrote …/mobile/api/openapi.json`; `object-or-null check passed (6 known field(s), all parsed via raw Dio)` (the new `ChannelDetail.notices[]` items have only scalar nullables).

Run: `cd backend && npx vitest run src/modules/juvi-app && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-welcome.e2e.test.ts src/__e2e__/modules/juvi-app-me.e2e.test.ts src/__e2e__/modules/juvi-app-config.e2e.test.ts src/__e2e__/modules/juvi-app-spaces.e2e.test.ts src/__e2e__/modules/juvi-app-admin-settings.e2e.test.ts`
Expected: PASS (welcome 5 tests; me, config, spaces and admin settings unchanged apart from the updated step lists; the OpenAPI drift test passes against the regenerated file).

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/rbac-route-walk.test.ts -u && git diff -- src/__e2e__/modules/__snapshots__ | grep '^[+-] ' | sort | uniq -c`
Expected: only `/api/juvi-app/v1/onboarding/first-notice` added, `401`, once per persona (4 lines).

Run: `cd backend && npm run typecheck`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/juvi-app mobile/api/openapi.json backend/src/__e2e__/modules/juvi-notices-welcome.e2e.test.ts backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts backend/src/__e2e__/modules/juvi-app-config.e2e.test.ts backend/src/__e2e__/modules/__snapshots__/rbac-route-walk.test.ts.snap
git commit -m "feat(juvi-app): onboarding first_notice with a real welcome notice, the welcome-notice setting, and notices on channel detail

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Added-later rows and activation back-fill

**Files:**
- Create: `backend/src/modules/juvi-app/notices/recipient-service.ts`
- Modify: `backend/src/modules/juvi-app/accounts/provisioning-service.ts:178-195` (`transitionAccount`), `backend/src/modules/juvi-app/spaces/reconcile-service.ts:145-173` (`reconcileAccount`)
- Test: `backend/src/__e2e__/modules/juvi-notices-lifecycle.e2e.test.ts`

**Interfaces:**
- Consumes: `loadAudienceGraph` (Task 4); `personMatchesRules` (Task 3); `Notice`, `LeanNotice`, `NoticeRecipient` (Task 2); `JuviAccount`; Task 4 factory; the admin notices API (Task 8) and mobile routes (Tasks 5–7) in the end-to-end test.
- Produces:
  ```ts
  // recipient-service.ts
  export const ADDED_LATER_WINDOW_DAYS = 30;
  export function onAccountActivated(collegeId: string, accountId: string, personId: string, now?: Date): Promise<number>;   // rows given the account
  export function backfillAddedLater(collegeId: string, accountId: string, now?: Date): Promise<number>;                      // rows inserted
  ```

Decisions:
- Activation (spec §6.6): every row of the person with `accountId: null` gets the account and `receivedAt`, so a person who was Not on Juvi gets their cards. `counts.onJuvi` is incremented for the snapshot rows among them (added-later rows are not in the snapshot counts). It runs inside `transitionAccount` whenever the target status is `active` — the end of onboarding, an admin reactivation, or the test factory — and a failure there is logged, never allowed to undo the activation.
- Added later (spec §6.6): runs at the end of `reconcileAccount` (after its early return for an ineligible account), so it rides the existing Spaces-load trigger. Candidates are `status: 'published'`, `purpose: 'standard'` notices published in the last 30 days with no row for the person; the stored rules are re-evaluated for the one person with `personMatchesRules` over `loadAudienceGraph(collegeId, { personIds })`. Rows are `addedLater: true`, carry the account only when it is `active`, and are inserted with `ordered: false`; a duplicate-key error (a concurrent pass) is not a failure. Archived and welcome notices never get added-later rows.

- [ ] **Step 1: Write the failing integration tests**

```ts
// backend/src/__e2e__/modules/juvi-notices-lifecycle.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { enableJuvi, provisionTestStudent, mobileClient } from '../factories/juvi.factory';
import { activateAccount, publishTestNotice, signInAs } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { drainOutbox } from '../../shared/outbox';
import { backfillAddedLater } from '../../modules/juvi-app/notices/recipient-service';

process.env.E2E_TESTING = '1';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const ADMIN = '/api/juvi-app/admin/notices';

beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

describe('publish → fan-out → acknowledge → reach, end to end (spec §12)', () => {
  it('an ERP publish reaches the app, the acknowledgement shows in ERP reach, and the counts reconcile', async () => {
    const a = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(a.account._id));
    const b = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(b.account._id));
    await provisionTestStudent(fx);                                  // Not on Juvi
    const created = await api.as(fx.admin.token).post(ADMIN).send({
      title: 'Fee dates', body: 'Pay by Friday.', ackRequired: true, audience: { rules: [{ kind: 'batch', ids: [String(fx.batch._id)] }] },
    }).expect(201);
    await drainOutbox();

    const ta = await signInAs(app, fx, a.student.rollNumber, a.tempPassword, 'dev-a');
    const tb = await signInAs(app, fx, b.student.rollNumber, b.tempPassword, 'dev-b');
    expect((await mobileClient(app, ta).get(`${V1}/attention`)).body.items.map((c: { id: string }) => c.id)).toEqual([created.body.id]);
    await mobileClient(app, ta).post(`${V1}/notices/${created.body.id}/ack`).send({ method: 'hold' }).expect(200);
    await mobileClient(app, tb).post(`${V1}/notices/${created.body.id}/seen`).expect(200);
    await drainOutbox();

    const reach = (await api.as(fx.admin.token).get(`${ADMIN}/${created.body.id}/reach`).expect(200)).body;
    expect(reach).toMatchObject({ audience: 3, acknowledged: 1, seen: 1, notSeen: 0, notOnJuvi: 1 });
    expect(reach.acknowledged + reach.seen + reach.notSeen + reach.notOnJuvi).toBe(reach.audience);
    const list = (await api.as(fx.admin.token).get(ADMIN).expect(200)).body.items[0];
    expect(list).toMatchObject({ acknowledged: 1, seen: 1, counts: { audience: 3, onJuvi: 2 } });
  });
});

describe('Not on Juvi, then activation (spec §6.6)', () => {
  it('a member who activates after publish receives the card, and reach moves them from Not on Juvi to not seen', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const n = await publishTestNotice(fx, { ackRequired: true });
    expect(n.counts).toEqual({ audience: 1, onJuvi: 0 });
    const t = await signInAs(app, fx, s.student.rollNumber, s.tempPassword, 'dev-s');
    expect((await mobileClient(app, t).get(`${V1}/attention`)).body.dueCount).toBe(0);

    for (const step of [0, 1, 2, 3]) await mobileClient(app, t).post(`${V1}/me/onboarding/advance`).send({ step }).expect(200);

    const row = (await NoticeRecipient.findOne({ noticeId: n._id, personId: s.person._id }).lean())!;
    expect(String(row.accountId)).toBe(String(s.account._id));
    expect(row.receivedAt).toBeInstanceOf(Date);
    expect(row.addedLater).toBe(false);
    expect((await Notice.findById(n._id).lean())!.counts).toEqual({ audience: 1, onJuvi: 1 });
    expect((await mobileClient(app, t).get(`${V1}/attention`)).body.items.map((c: { id: string }) => c.id)).toEqual([String(n._id)]);
    expect((await api.as(fx.admin.token).get(`${ADMIN}/${n._id}/reach`).expect(200)).body).toMatchObject({ audience: 1, notSeen: 1, notOnJuvi: 0 });
  });
});

describe('added later (spec §6.5, §6.6)', () => {
  it('a member who matches after publish gets an added-later row on the Spaces load, reported apart from the snapshot', async () => {
    await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const n = await publishTestNotice(fx, { ackRequired: true });
    const late = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(late.account._id));
    const t = await signInAs(app, fx, late.student.rollNumber, late.tempPassword, 'dev-late');
    await mobileClient(app, t).get(`${V1}/spaces`).expect(200);                 // reconcileAccount → backfillAddedLater

    const row = (await NoticeRecipient.findOne({ noticeId: n._id, personId: late.person._id }).lean())!;
    expect(row).toMatchObject({ addedLater: true, ackRequired: true, labels: { batch: '2024 Batch', section: 'A' } });
    expect(String(row.accountId)).toBe(String(late.account._id));
    expect((await mobileClient(app, t).get(`${V1}/attention`)).body.dueCount).toBe(1);

    const reach = (await api.as(fx.admin.token).get(`${ADMIN}/${n._id}/reach`).expect(200)).body;
    expect(reach).toMatchObject({ audience: 1, notOnJuvi: 1, addedLater: { total: 1, acknowledged: 0, seen: 0 } });
    expect(reach.acknowledged + reach.seen + reach.notSeen + reach.notOnJuvi).toBe(reach.audience);
    expect((await api.as(fx.admin.token).get(`${ADMIN}/${n._id}/reach/pending`).expect(200)).body.items.map((p: { name: string }) => p.name)).not.toContain(late.person.name);
    expect((await Notice.findById(n._id).lean())!.counts).toEqual({ audience: 1, onJuvi: 0 });

    expect(await backfillAddedLater(fx.collegeId, String(late.account._id))).toBe(0);   // idempotent
    expect(await NoticeRecipient.countDocuments({ noticeId: n._id })).toBe(2);
  });

  it('skips notices older than 30 days, archived, welcome and non-matching notices; an onboarding member gets the card on activation', async () => {
    await provisionTestStudent(fx);
    const old = await publishTestNotice(fx, { title: 'Old' });
    await Notice.updateOne({ _id: old._id }, { $set: { publishedAt: new Date(Date.now() - 31 * 86_400_000) } });
    const archived = await publishTestNotice(fx, { title: 'Archived' });
    await Notice.updateOne({ _id: archived._id }, { $set: { status: 'archived' } });
    await publishTestNotice(fx, { title: 'Welcome', purpose: 'welcome', audience: { rules: [{ kind: 'role', ids: ['student'] }] } });
    const other = await provisionTestStudent(fx, { branchId: String(fx.eceBranch._id) });
    await publishTestNotice(fx, { title: 'Custom', audience: { rules: [{ kind: 'custom', ids: [String(other.person._id)] }] } });
    const current = await publishTestNotice(fx, { title: 'Current' });

    const late = await provisionTestStudent(fx);                                    // onboarding: Not on Juvi
    expect(await backfillAddedLater(fx.collegeId, String(late.account._id))).toBe(1);
    const rows = await NoticeRecipient.find({ personId: late.person._id }).lean();
    expect(rows.map((r) => String(r.noticeId))).toEqual([String(current._id)]);
    expect(rows[0]).toMatchObject({ addedLater: true, accountId: null, receivedAt: null });

    await activateAccount(String(late.account._id));
    const after = (await NoticeRecipient.findOne({ personId: late.person._id }).lean())!;
    expect(String(after.accountId)).toBe(String(late.account._id));
    expect(after.receivedAt).toBeInstanceOf(Date);
    expect((await Notice.findById(current._id).lean())!.counts.onJuvi).toBe(0);     // added-later rows stay out of the snapshot counts
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-lifecycle.e2e.test.ts`
Expected: FAIL with "Cannot find module '../../modules/juvi-app/notices/recipient-service'".

- [ ] **Step 3: Implement the recipient service**

```ts
// backend/src/modules/juvi-app/notices/recipient-service.ts
/**
 * Keeps recipient rows in step with accounts (spec §6.6): activation gives a
 * person's rows their account, and the Spaces-load reconcile adds rows for
 * recent notices the person matches now but did not at publish.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { loadAudienceGraph } from './audience-graph';
import { personMatchesRules } from './audience';

export const ADDED_LATER_WINDOW_DAYS = 30;

/** Gives the person's account-less rows the account and receivedAt; returns how many rows changed. */
export async function onAccountActivated(collegeId: string, accountId: string, personId: string, now = new Date()): Promise<number> {
  const rows = await NoticeRecipient.find({ collegeId, personId, accountId: null }).select('_id noticeId addedLater').lean();
  if (rows.length === 0) return 0;
  const res = await NoticeRecipient.updateMany(
    { collegeId, _id: { $in: rows.map((r) => r._id) }, accountId: null },
    { $set: { accountId: new Types.ObjectId(accountId), receivedAt: now } },
  );
  const snapshotNotices = rows.filter((r) => !r.addedLater).map((r) => r.noticeId);
  if (snapshotNotices.length) await Notice.updateMany({ collegeId, _id: { $in: snapshotNotices } }, { $inc: { 'counts.onJuvi': 1 } });
  return res.modifiedCount;
}

/** Inserts `addedLater: true` rows for published standard notices of the last 30 days that now match the account's person. */
export async function backfillAddedLater(collegeId: string, accountId: string, now = new Date()): Promise<number> {
  const account = await JuviAccount.findOne({ _id: accountId, collegeId }).select('_id personId status').lean();
  if (!account) return 0;
  const since = new Date(now.getTime() - ADDED_LATER_WINDOW_DAYS * 86_400_000);
  const candidates = await Notice.find({ collegeId, status: 'published', purpose: 'standard', publishedAt: { $gte: since } })
    .select('_id audience ackRequired ackDeadline').lean<LeanNotice[]>();
  if (candidates.length === 0) return 0;
  const have = new Set((await NoticeRecipient.distinct('noticeId', { collegeId, personId: account.personId, noticeId: { $in: candidates.map((n) => n._id) } })).map(String));
  const missing = candidates.filter((n) => !have.has(String(n._id)));
  if (missing.length === 0) return 0;

  const graph = await loadAudienceGraph(collegeId, { personIds: [String(account.personId)] });
  const person = graph.people.get(String(account.personId));
  if (!person) return 0;
  const onJuvi = account.status === 'active';
  const docs = missing.filter((n) => personMatchesRules(n.audience.rules, person, graph)).map((n) => ({
    collegeId, noticeId: n._id, personId: account.personId, accountId: onJuvi ? account._id : null,
    kind: person.kind, labels: person.labels, addedLater: true, ackRequired: n.ackRequired,
    deadline: n.ackDeadline ?? null, receivedAt: onJuvi ? now : null,
  }));
  if (docs.length === 0) return 0;
  try {
    return (await NoticeRecipient.insertMany(docs, { ordered: false })).length;
  } catch (err) {
    // A concurrent pass inserted some of the same rows: the unique (noticeId, personId) index kept one each.
    const e = err as { code?: number; writeErrors?: { code?: number }[] };
    const duplicatesOnly = e.code === 11000 || (Boolean(e.writeErrors?.length) && e.writeErrors!.every((w) => w.code === 11000));
    if (!duplicatesOnly) throw err;
    return docs.length - (e.writeErrors?.length ?? 1);
  }
}
```

- [ ] **Step 4: Hook activation and the account reconcile**

In `backend/src/modules/juvi-app/accounts/provisioning-service.ts`, import the service and call it at the end of `transitionAccount`:

```ts
import { onAccountActivated } from '../notices/recipient-service';
```

```ts
export async function transitionAccount(account: IJuviAccount, to: AccountStatus, source: TransitionSource, by: string): Promise<IJuviAccount> {
  const from = account.status;
  if (from === to) return account;
  account.status = to;
  account.transitions.push({ from, to, source, by, at: new Date() });
  await account.save();
  await createAuditLog({
    collegeId: String(account.collegeId),
    entityType: 'JuviAccount',
    entityId: String(account._id),
    entityName: `${account.kind} account`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: from, newValue: to }],
    performedBy: by,
    studentId: account.studentId ? String(account.studentId) : undefined,
  });
  if (to === 'active') {
    // Notices spec §6.6: rows snapshotted while the person was Not on Juvi now reach them.
    try {
      await onAccountActivated(String(account.collegeId), String(account._id), String(account.personId));
    } catch (err) {
      console.error('[juvi-app] notice back-fill on activation failed', String(account._id), err);
    }
  }
  return account;
}
```

In `backend/src/modules/juvi-app/spaces/reconcile-service.ts`, import the service and run it at the end of `reconcileAccount`:

```ts
import { backfillAddedLater } from '../notices/recipient-service';
```

```ts
  for (const id of touched) {
    await Channel.updateOne({ _id: id, collegeId }, { $set: { memberCount: await ChannelMembership.countDocuments({ collegeId, channelId: id }) } });
  }
  await JuviAccount.updateOne({ _id: accountId, collegeId }, { $set: { lastReconciledAt: new Date() } });
  // Notices spec §6.6: recent notices this account matches now but did not at publish.
  try { await backfillAddedLater(collegeId, accountId); } catch (err) { console.error('[juvi-app] added-later back-fill failed', accountId, err); }
  return diff;
}
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-lifecycle.e2e.test.ts src/__e2e__/modules/juvi-app-reconcile.e2e.test.ts src/__e2e__/modules/juvi-app-spaces.e2e.test.ts src/__e2e__/modules/juvi-app-me.e2e.test.ts src/__e2e__/modules/juvi-app-provisioning.e2e.test.ts && npx vitest run src/modules/juvi-app && npm run typecheck`
Expected: PASS (lifecycle 4 tests; the Foundation reconcile, spaces, me and provisioning suites unchanged); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/juvi-app/notices/recipient-service.ts backend/src/modules/juvi-app/accounts/provisioning-service.ts backend/src/modules/juvi-app/spaces/reconcile-service.ts backend/src/__e2e__/modules/juvi-notices-lifecycle.e2e.test.ts
git commit -m "feat(juvi-app): deliver notices on activation and add added-later recipients on the account reconcile

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: OpenAPI contract for notices, and the CLAUDE.md pointers

**Files:**
- Modify: `backend/src/modules/juvi-app/notices/schemas.ts` (flat object schemas, no `.extend` of named components), `backend/src/modules/juvi-app/openapi/document.ts`, `backend/src/modules/juvi-app/openapi/__tests__/document.test.ts`, `mobile/api/openapi.json` (regenerated), `CLAUDE.md` (Juvi section)
- Test: `backend/src/modules/juvi-app/openapi/__tests__/document.test.ts`, `mobile/tool/check_nullable_objects.js` (run, unchanged)

**Interfaces:**
- Consumes: every notices schema from `notices/schemas.ts` (Tasks 5–7); `OpenAPIRegistry`, `OpenApiGeneratorV31` (`openapi/document.ts:1`).
- Produces: named components `NoticeCard`, `NoticeDetail`, `NoticeAttachment`, `Attention`, `NoticeList`, `SeenResult`, `AckRequest`, `AckResult`, `DismissResult`, `NoticeAttachmentUrl`, `NoticeReach`, `NoticeReminders`, `ReachPerson`, `ReachComment`, `ReachGroup`, `NoticePending`, `PendingPerson`, `RemindResult`; eleven new paths with the operation ids below; the seven new error codes in `ErrorEnvelope.error.code`; `RouteDef.query` for query parameters.

Decisions:
- Schemas that build on a named component are written as flat objects (`z.object({ ...base.shape, … })`), not `.extend()`: zod-to-openapi renders `.extend()` of a registered schema as `allOf`, which the dart-dio generator turns into composite classes. Flat objects keep one class per component.
- No new field is object-or-null, so `check_nullable_objects.js` passes with its allowlist unchanged and Plan 3 needs no new raw-Dio parsing for these responses. The one object that appears only on errors — `ack` inside the `ALREADY_ACKNOWLEDGED` envelope — lives under the passthrough `ErrorEnvelope`, which the guard does not type; Plan 3 reads it from the raw error body (as it already does for `retryAfterSeconds`).

Operation ids (they become the Dart method names on `MobileApi`):

| Path | Method | operationId | Errors |
|---|---|---|---|
| `/attention` | get | `getAttention` | 401 |
| `/notices` | get | `listNotices` (query `segment`, `office`, `cursor`, `limit`) | 400, 401 |
| `/notices/{id}` | get | `getNotice` | 401, 404 |
| `/notices/{id}/seen` | post | `markNoticeSeen` | 401, 404 |
| `/notices/{id}/ack` | post | `acknowledgeNotice` | 400, 401, 404, 409 |
| `/notices/{id}/dismiss` | post | `dismissNotice` | 401, 404, 409 |
| `/notices/{id}/attachments/{key}` | get | `getNoticeAttachmentUrl` | 401, 404, 503 |
| `/notices/{id}/reach` | get | `getNoticeReach` | 401, 403, 404 |
| `/notices/{id}/reach/pending` | get | `listNoticePending` (query `group`, `q`, `cursor`, `limit`) | 400, 401, 403, 404 |
| `/notices/{id}/remind` | post | `remindNotice` | 401, 403, 404, 409 |
| `/onboarding/first-notice` | get | `getFirstNotice` | 401 |

- [ ] **Step 1: Write the failing document test**

Replace `backend/src/modules/juvi-app/openapi/__tests__/document.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument, stableStringify } from '../document';

const EXPECTED_PATHS = [
  '/institutions/{code}', '/config',
  '/auth/sign-in', '/auth/refresh', '/auth/sign-out', '/auth/change-password',
  '/me', '/me/settings', '/me/onboarding/advance', '/me/devices', '/me/devices/{id}', '/me/devices/revoke-others', '/me/photo',
  '/spaces', '/channels/{id}', '/channels/{id}/mute', '/channels/{id}/read',
  '/attention', '/notices', '/notices/{id}', '/notices/{id}/seen', '/notices/{id}/ack', '/notices/{id}/dismiss',
  '/notices/{id}/attachments/{key}', '/notices/{id}/reach', '/notices/{id}/reach/pending', '/notices/{id}/remind',
  '/onboarding/first-notice',
];

describe('mobile OpenAPI document', () => {
  const doc = buildOpenApiDocument() as any;

  it('is OpenAPI 3.1 served under the v1 prefix with bearer auth', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers).toEqual([{ url: '/api/juvi-app/v1' }]);
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  });

  it('declares every v1 route and nothing else', () => {
    expect(Object.keys(doc.paths).sort()).toEqual([...EXPECTED_PATHS].sort());
    expect(doc.paths['/auth/sign-in'].post.security).toBeUndefined();
    expect(doc.paths['/me'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.paths['/auth/sign-in'].post.responses['401']).toBeDefined();
    expect(doc.components.schemas.ErrorEnvelope).toBeDefined();
  });

  it('names every component and operation so the Dart client is predictable', () => {
    expect(Object.keys(doc.components.schemas).sort()).toEqual([
      'AckRequest', 'AckResult', 'Attention', 'ChangePasswordRequest', 'ChannelDetail', 'Config', 'Devices', 'DismissResult',
      'ErrorEnvelope', 'InstitutionLookup', 'Me', 'MuteResult', 'NoticeAttachment', 'NoticeAttachmentUrl', 'NoticeCard',
      'NoticeDetail', 'NoticeList', 'NoticePending', 'NoticeReach', 'NoticeReminders', 'OnboardingAdvance', 'OnboardingState',
      'PendingPerson', 'PhotoResult', 'ReachComment', 'ReachGroup', 'ReachPerson', 'ReadResult', 'RefreshRequest', 'RemindResult',
      'RevokedCount', 'SeenResult', 'SettingsPatch', 'Settings', 'SignInRequest', 'SignInResponse', 'Spaces', 'Tokens',
    ].sort());
    expect(doc.paths['/auth/sign-in'].post.operationId).toBe('signIn');
    expect(doc.paths['/channels/{id}/mute'].delete.operationId).toBe('unmuteChannel');
    expect(doc.paths['/me'].get.tags).toEqual(['mobile']);
    expect(doc.paths['/notices/{id}/ack'].post.operationId).toBe('acknowledgeNotice');
    expect(doc.paths['/notices/{id}/reach/pending'].get.operationId).toBe('listNoticePending');
    expect(doc.paths['/onboarding/first-notice'].get.operationId).toBe('getFirstNotice');
  });

  it('describes the notice endpoints: query parameters, error codes and flat components', () => {
    const listParams = doc.paths['/notices'].get.parameters.map((p: { name: string; in: string }) => `${p.in}:${p.name}`).sort();
    expect(listParams).toEqual(['query:cursor', 'query:limit', 'query:office', 'query:segment']);
    expect(doc.paths['/notices/{id}/attachments/{key}'].get.parameters.map((p: { name: string }) => p.name).sort()).toEqual(['id', 'key']);
    expect(doc.paths['/notices/{id}/ack'].post.responses['409']).toBeDefined();
    expect(doc.paths['/notices/{id}/reach'].get.responses['403']).toBeDefined();
    expect(doc.components.schemas.ErrorEnvelope.properties.error.properties.code.enum).toEqual(expect.arrayContaining([
      'NOTICE_NOT_FOUND', 'ALREADY_ACKNOWLEDGED', 'NOTICE_ARCHIVED', 'NOT_PUBLISHER', 'REMINDER_LIMIT', 'ACK_REQUIRED', 'ACK_NOT_REQUIRED',
    ]));
    for (const name of ['NoticeDetail', 'ReachComment', 'NoticeReach']) expect(doc.components.schemas[name].allOf, name).toBeUndefined();
    expect(doc.components.schemas.ChannelDetail.properties.notices.items).toEqual({ $ref: '#/components/schemas/NoticeCard' });
  });

  it('stableStringify orders keys so the file is deterministic', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } })).toBe('{\n  "a": {\n    "c": [\n      3,\n      {\n        "e": 2,\n        "f": 1\n      }\n    ],\n    "d": 2\n  },\n  "b": 1\n}');
  });

  it('matches the committed mobile/api/openapi.json (run npm run openapi:mobile -w backend if this fails)', () => {
    const file = resolve(__dirname, '../../../../../../mobile/api/openapi.json');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(stableStringify(doc) + '\n');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/openapi`
Expected: FAIL — the path list and component list lack the notice entries.

- [ ] **Step 3: Flatten the schemas that build on named components**

In `backend/src/modules/juvi-app/notices/schemas.ts`, replace the three `.extend()` definitions:

```ts
export const noticeDetailSchema = z.object({
  ...noticeCardSchema.shape,
  body: z.string(),
  attachments: z.array(noticeAttachmentSchema),
  ackMethod: z.enum(['hold', 'confirm']).nullable(),
  ackOffline: z.boolean(),
  ackComment: z.string().nullable(),
  ackClientAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
});
```

```ts
export const reachCommentSchema = z.object({ ...reachPersonSchema.shape, comment: z.string(), late: z.boolean() });
```

and, inside `reachResponseSchema.addedLater`:

```ts
    items: z.array(z.object({ ...reachPersonSchema.shape, state: z.enum(REACH_STATES) })),
```

- [ ] **Step 4: Register the components and paths**

In `backend/src/modules/juvi-app/openapi/document.ts`:

1. Import the notice schemas:

```ts
import {
  noticeAttachmentSchema, noticeCardSchema, noticeDetailSchema, attentionResponseSchema, noticeListQuerySchema, noticeListResponseSchema,
  seenResponseSchema, attachmentUrlResponseSchema, ackRequestSchema, ackResponseSchema, dismissResponseSchema,
  remindersSchema, reachPersonSchema, reachCommentSchema, reachGroupSchema, reachResponseSchema,
  pendingQuerySchema, pendingPersonSchema, pendingResponseSchema, remindResponseSchema,
} from '../notices/schemas';
```

2. Extend the error codes:

```ts
const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum([
      'VALIDATION_FAILED', 'INVALID_CREDENTIALS', 'TOKEN_EXPIRED', 'SESSION_INVALIDATED', 'ACCOUNT_DEACTIVATED', 'FORBIDDEN', 'NOT_FOUND', 'GONE', 'UPDATE_REQUIRED', 'COOLDOWN', 'INSTITUTION_PAUSED', 'INTERNAL',
      // Juvi notices
      'NOTICE_NOT_FOUND', 'ALREADY_ACKNOWLEDGED', 'NOTICE_ARCHIVED', 'NOT_PUBLISHER', 'REMINDER_LIMIT', 'ACK_REQUIRED', 'ACK_NOT_REQUIRED',
    ]),
    message: z.string(),
  }).passthrough(),
});
```

3. Let a route declare query parameters:

```ts
interface RouteDef {
  /** Becomes the Dart method name on the generated `MobileApi` class. */
  operationId: string;
  method: Method; path: string; summary: string; auth: boolean;
  body?: z.ZodTypeAny; response?: z.ZodTypeAny; status?: number; params?: string[]; query?: z.AnyZodObject; errors: number[]; multipart?: boolean;
}
```

4. Register the components — add to the `C` object after `ReadResult` (the attachment, reminder and person schemas first, so the others reference them by name):

```ts
    NoticeAttachment: registry.register('NoticeAttachment', noticeAttachmentSchema),
    NoticeReminders: registry.register('NoticeReminders', remindersSchema),
    ReachPerson: registry.register('ReachPerson', reachPersonSchema),
    ReachComment: registry.register('ReachComment', reachCommentSchema),
    ReachGroup: registry.register('ReachGroup', reachGroupSchema),
    PendingPerson: registry.register('PendingPerson', pendingPersonSchema),
    NoticeCard: registry.register('NoticeCard', noticeCardSchema),
    NoticeDetail: registry.register('NoticeDetail', noticeDetailSchema),
    Attention: registry.register('Attention', attentionResponseSchema),
    NoticeList: registry.register('NoticeList', noticeListResponseSchema),
    SeenResult: registry.register('SeenResult', seenResponseSchema),
    AckRequest: registry.register('AckRequest', ackRequestSchema),
    AckResult: registry.register('AckResult', ackResponseSchema),
    DismissResult: registry.register('DismissResult', dismissResponseSchema),
    NoticeAttachmentUrl: registry.register('NoticeAttachmentUrl', attachmentUrlResponseSchema),
    NoticeReach: registry.register('NoticeReach', reachResponseSchema),
    NoticePending: registry.register('NoticePending', pendingResponseSchema),
    RemindResult: registry.register('RemindResult', remindResponseSchema),
```

5. Append the routes to `routes` after `markChannelRead`:

```ts
    { operationId: 'getAttention', method: 'get', path: '/attention', summary: 'Due acknowledgement notices: count and the first three', auth: true, response: C.Attention, errors: [401] },
    { operationId: 'listNotices', method: 'get', path: '/notices', summary: 'Notice cards by segment (due, done, all, published), cursor-paged', auth: true, query: noticeListQuerySchema, response: C.NoticeList, errors: [400, 401] },
    { operationId: 'getNotice', method: 'get', path: '/notices/{id}', summary: 'Notice detail with my state (does not mark it seen)', auth: true, params: ['id'], response: C.NoticeDetail, errors: [401, 404] },
    { operationId: 'markNoticeSeen', method: 'post', path: '/notices/{id}/seen', summary: 'Mark a notice seen (once)', auth: true, params: ['id'], response: C.SeenResult, errors: [401, 404] },
    { operationId: 'acknowledgeNotice', method: 'post', path: '/notices/{id}/ack', summary: 'Acknowledge a notice; 409 ALREADY_ACKNOWLEDGED carries the existing record', auth: true, params: ['id'], body: C.AckRequest, response: C.AckResult, errors: [400, 401, 404, 409] },
    { operationId: 'dismissNotice', method: 'post', path: '/notices/{id}/dismiss', summary: 'Dismiss a notice that needs no acknowledgement', auth: true, params: ['id'], response: C.DismissResult, errors: [401, 404, 409] },
    { operationId: 'getNoticeAttachmentUrl', method: 'get', path: '/notices/{id}/attachments/{key}', summary: 'A 5-minute download URL for one attachment (key URL-encoded)', auth: true, params: ['id', 'key'], response: C.NoticeAttachmentUrl, errors: [401, 404, 503] },
    { operationId: 'getNoticeReach', method: 'get', path: '/notices/{id}/reach', summary: 'Reach for the publisher', auth: true, params: ['id'], response: C.NoticeReach, errors: [401, 403, 404] },
    { operationId: 'listNoticePending', method: 'get', path: '/notices/{id}/reach/pending', summary: 'Pending members for the publisher, grouped and searchable', auth: true, params: ['id'], query: pendingQuerySchema, response: C.NoticePending, errors: [400, 401, 403, 404] },
    { operationId: 'remindNotice', method: 'post', path: '/notices/{id}/remind', summary: 'Send a reminder (at most two)', auth: true, params: ['id'], response: C.RemindResult, errors: [401, 403, 404, 409] },
    { operationId: 'getFirstNotice', method: 'get', path: '/onboarding/first-notice', summary: 'Onboarding step 4: the welcome notice', auth: true, response: C.NoticeDetail, errors: [401] },
```

6. Pass the query to `registerPath` in the loop:

```ts
      request: {
        ...(r.params ? { params: z.object(Object.fromEntries(r.params.map((p) => [p, z.string()]))) } : {}),
        ...(r.query ? { query: r.query } : {}),
        ...(r.body ? { body: json(r.body) } : {}),
        ...(r.multipart ? { body: { content: { 'multipart/form-data': { schema: z.object({ file: z.string().openapi({ format: 'binary' }) }) } } } } : {}),
      },
```

- [ ] **Step 5: Regenerate the contract and run the guard**

Run: `npm run openapi:mobile -w backend && node mobile/tool/check_nullable_objects.js mobile/api/openapi.json`
Expected: `wrote …/mobile/api/openapi.json`; `object-or-null check passed (6 known field(s), all parsed via raw Dio)`. If the guard reports a new field, do not allow-list it without a Plan 3 raw-Dio parser: change the schema to a non-null object or scalar nullables instead.

Run: `cd backend && npx vitest run src/modules/juvi-app && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts src/__e2e__/modules/juvi-notices-reach.e2e.test.ts && npm run typecheck`
Expected: PASS (document 6 tests; the flattened schemas change no response); typecheck clean.

- [ ] **Step 6: Point CLAUDE.md at the outbox and the notices module**

In `CLAUDE.md`, under `### Juvi mobile app`, add after the API-contract bullet:

```markdown
- Durable outbox: `backend/src/shared/outbox/` — `emit(type, payload, dedupeKey)` (idempotent), `registerConsumer(type, handler)`, `kick()`; the dispatcher is registered in `server.ts` (5 s tick, inline without Redis; tests call `drainOutbox()`). Register consumers, never write your own queue.
- Notices: `modules/juvi-app/notices/` — the ERP publishes at `/api/juvi-app/admin/notices` (`authorize('notices', …)` plus the audience scope in `scope.ts`); the `notice.published` consumer writes one `NoticeRecipient` per audience member (the snapshot and that person's state); mobile reads, acknowledgement and reach are under `/v1/notices`, and onboarding step 4 is `first_notice`. Spec: `docs/superpowers/specs/2026-09-26-juvi-notices-design.md`.
```

- [ ] **Step 7: Run the whole backend suite**

Run: `cd backend && npm run test && npm run test:e2e && npm run typecheck`
Expected: PASS apart from the three baseline failures already on `main` before this plan (compare the failing test names with a run on `main`; no notices, outbox, juvi-app or rbac test may fail).

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/juvi-app/notices/schemas.ts backend/src/modules/juvi-app/openapi mobile/api/openapi.json CLAUDE.md
git commit -m "feat(juvi-app): notices in the mobile OpenAPI contract, and CLAUDE.md pointers to the outbox and notices module

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec item | Where |
|---|---|
| §4 US-1.1 audience builder offers only in-scope targets; server 403 outside scope | Task 3 (`allowedTargets`, `assertAudienceInScope`), Task 4 (preview/publish refusal), Task 8 (`GET /targets`, HOD 403 over HTTP) |
| §4 US-1.2 live count total / on Juvi / not / breakdown matches the snapshot | Task 4 (`previewAudience`, test "matches the snapshot written at publish"), Task 8 (`POST /audience-preview`) |
| §4 US-1.3 card within 60 s; 5,000-person audience tested | Task 1 (5 s tick, immediate `kick`), Task 4 (`juvi-notices-fanout-5000` < 60 s) |
| §4 US-1.4 published notice cannot be edited; archive only | Task 4 (no update route; consumer never touches a non-publishing notice), Task 7 (`archiveNotice`), Task 8 (`POST /:id/archive`) |
| §4 US-2.1 detail sets `seenAt` once; prefetch does not | Task 5 (`markSeen`; test "reading never marks seen") |
| §4 US-2.2 hold 1.2 s or tap-then-confirm; no single tap | Server side: Task 6 (`method: hold | confirm` required, strict body). The gesture itself is Plan 3 |
| §4 US-2.3 second ack 409 with the existing record, never changes | Task 6 |
| §4 US-2.4 late = true after the deadline, in app and reach | Task 6 (`isLate`, server receipt time), Task 7 (reach `late`, `lateAcks`) |
| §4 US-2.5 non-recipient 404, even by link | Task 5 (`recipientContext`), Task 6 |
| §4 US-2.6 archived read-only, marked, excluded from Due | Task 5 (card `archived`, Due filter), Task 6 (409 `NOTICE_ARCHIVED`), Task 7 (archive test) |
| §4 US-3.1 up to three due items by deadline, "+N more", "You're clear" | Task 5 (`GET /attention` `dueCount` + 3 items; empty state data). Rendering is Plan 3 |
| §4 US-3.2 Due count equals the badge everywhere | Task 5 (attention and `due` segment share `loadDue`; test asserts equality) |
| §4 US-3.3 online ack removes the card only after server confirms | Server side: Task 6 (non-optimistic 200 / 409). Client behaviour is Plan 3 |
| §4 US-3.4 offline ack queued, "Will send when online" | Server side: Task 6 (`offline`, `clientAt`, 409-on-replay semantics). Queue is Plan 3 |
| §4 US-3.5 All segment reaches every notice, paged | Task 5 (`segment=all` keyset cursor test) |
| §4 US-4.1 counts reconcile to the snapshot | Task 7 (reach arithmetic test), Task 9 (welcome), Task 10 (end-to-end) |
| §4 US-4.2 pending grouped, searchable, copyable, last-seen-in-app | Task 7 (`pendingPage`: groups, `q`, `group`, `lastSeenInApp` from `MobileSession`); copying is client-side (Plans 2–3) |
| §4 US-4.3 late, comments and added later listed separately | Task 7 (`lateAcks`, `comments`, `addedLater`), Task 10 |
| §4 US-4.4 third reminder refused with a reason | Task 7 (409 `REMINDER_LIMIT` with message), Task 8 (ERP) |
| §4 US-4.5 student on reach gets 403, audited | Task 7 (mobile), Task 8 (ERP) |
| §4 US-5.1 steps become `identity, spaces, notifications, first_notice` | Task 9 |
| §4 US-5.2 configured welcome per kind or auto default; real ack in reach within a minute | Task 9 (welcome tests incl. audit and reach) |
| §4 US-5.3 older apps render the unknown step generically | Client behaviour (Foundation app); Task 9 only appends the step. Not testable on the server |
| §4 US-6.1 batch notice appears in the batch channel's list | Task 4 (`channelIds`), Task 9 (`GET /channels/:id` `notices[]`) |
| §6.1.1 attachments: types, 10 MB, `colleges/<cid>/notices/<uuid>`, SSE, 503 | Task 4 (`uploadAttachment`), Task 8 (multer route) |
| §6.1.2 audience preview with the same scope check | Task 4, Task 8 |
| §6.1.3 publish order: Zod → scope → write publishing → emit → kick → 201 | Task 4 (`publishNotice`), Task 8 (201) |
| §6.2 outbox API, dispatcher, claim, success, backoff, dead after 8, inline without Redis, sweeper | Task 1; sweeper Task 4 |
| §6.3 `notice.published` consumer (batches of 1,000, upsert, counts, channelIds, status, publishedAt, idempotent) | Task 4 |
| §6.3 `notice.reminder`, `notice.acknowledged`, `notice.archived` consumers | Task 7, Task 6, Task 7 |
| §6.4 `resolveAudience` rule kinds, union, rule-to-channel mapping | Task 3 (pure), Task 4 (loader) |
| §6.5 reconciliation arithmetic, added-later group, welcome exception | Task 7, Task 10, Task 9 |
| §6.6 added-later rows in `reconcileAccount`; activation fills `accountId`, `receivedAt` | Task 10 |
| §7.1 every mobile route | Tasks 5 (attention, list, detail, seen, attachment), 6 (ack, dismiss), 7 (reach, pending, remind), 9 (first-notice, channel notices) |
| §7.1 error codes in the contract; drift check; nullable guard | Task 5 (codes), Task 9 and Task 11 (regeneration, guard) |
| §7.2 admin routes, ERP `{ error }` shape, admin-only CSV and retry | Task 8 |
| §7.3 scope rules per persona | Task 3 (pure, all personas), Task 4 (loader, e2e per persona) |
| §7.4 `notices` policy | Task 8 (`DEFAULT_POLICIES`, `sub-domains`, unit test) |
| §10 `collegeId` on every query | All tasks (every query filters by it; the sweeper and the dispatcher enumerate colleges first) |
| §10 mobile reads need the recipient row; reach/remind need publisher or admin | Tasks 5, 7, 8 |
| §10 student reach 403 + AuditLog | Tasks 7, 8 |
| §10 ack immutability; racing requests → one record, one 409 | Task 6 (race test) |
| §10 attachment key must be in the notice's list | Task 5 (probe test), Task 4 (publish refuses foreign keys) |
| §10 comment ≤ 500, plain text; title, body and comment never logged | Task 6 (schema cap; audit carries `hasComment` only), Task 4 (audit `entityName` is the office, not the title) |
| §10 names and roll numbers only to publisher/admin; never raw `personId` to the app | Task 7 (reach/pending tests assert no personId) |
| §11 partial fan-out retried idempotently | Task 4 (partial-failure test), Task 1 (backoff) |
| §11 "Delivering…" / "Delivery failed" with admin retry | Task 8 (`delivery` state, `retry-delivery`) |
| §11 S3 unavailable → 503; publish without attachments works | Task 4, Task 8 |
| §11 archived notice: reminders, acks, dismissals 409 `NOTICE_ARCHIVED`; reach kept | Tasks 6, 7 |
| §11 deleted ERP people keep their rows and frozen labels | Task 2 (rows are never deleted; labels stored at publish), Task 7 (reach reads rows, falls back to "Unknown member" when the Person is gone) |

## Self-review

- Every task leaves the suite green: the OpenAPI drift test is refreshed in the same task that changes a registered schema (Task 9 for `ChannelDetail`, Task 11 for the rest), and the route-walk snapshot is refreshed in each task that adds a GET route (5, 7, 8, 9).
- Names are consistent across tasks: `recipientContext`, `manageableNotice`, `NoticeActor`, `noticeEventKey`, `NOTICE_EVENTS`, `registerNoticeConsumers` (its full body is restated each time it grows: Tasks 4, 6, 7).
- Deliberate deviations from the spec's wording, each noted where it happens: `assertAudienceInScope` takes the graph as a third argument (Task 3); `IAudienceRule` gains `departmentId` for the HOD `role` rule (Task 2 fix, Task 3); `GET /admin/notices/targets` is added for the composer (Task 8); staff share the faculty welcome slot (Task 9).
- Risks to watch while executing: the 5,000-member timing depends on the CI machine (the test logs the elapsed time); `kick()` runs the fan-out inline in tests, so every e2e file drains the outbox before cleanup; Plan 3 must regenerate the Dart client from the Task 11 contract.

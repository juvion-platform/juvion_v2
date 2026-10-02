# Juvi Notifications — Plan 1 of 3: Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the server side of Juvi push notifications: one `NotificationDelivery` row per person per notification, the pure §6 policy, a `notification.requested` event from fan-out, reminders and the added-later back-fill, the expand consumer (mute, quiet hours, Routine digest window), the sender sweeper over a fake or FCM transport, HMAC delivery receipts, `/v1/events`, push-token registration, the Urgent gate with `notices:urgent`, the Confidential flag, Reach delivery diagnostics on mobile and admin, and the regenerated OpenAPI contract and Dart client, so the portal (Plan 2) and the Flutter app (Plan 3) build on a tested server that is safe to merge without Firebase credentials.

**Architecture:** A new `backend/src/modules/juvi-app/notifications/` folder. `fanOutNotice`, `markReminded` and `backfillAddedLater` (all in `notices/`) record `notification.requested` in the existing outbox (`shared/outbox/`), because the outbox allows one consumer per event type and `notice.published` / `notice.reminder` already have theirs. The `notification.requested` consumer (`expand-consumer.ts`) walks the notice's `NoticeRecipient` rows in batches of 1,000, applies `policy.ts` (pure) and upserts one row per person with `$setOnInsert`. The sender (`sender.ts`) is registered as a new kind of outbox sweeper that runs after the events on every dispatcher pass, so a row expanded in a pass is sent in the same pass; it leases rows, re-checks the notice, gathers a Routine digest, sends one data message per account through `PushTransport` (`FakePushTransport` unless `FIREBASE_SERVICE_ACCOUNT_JSON` is set) and settles the rows. Mobile routes join `v1Router` with the mobile envelope; the receipts route has no session and is authorised per item by an HMAC token. The admin console keeps the ERP `{ error }` shape.

**Tech Stack:** Express 4, Mongoose 8, Zod 3, `firebase-admin` 13 (new, imported only by `transport/fcm.ts`), `@asteasolutions/zod-to-openapi` 7, vitest 4, supertest, mongodb-memory-server; `@openapitools/openapi-generator-cli` 7.10.0 (`dart-dio`, pinned in `mobile/openapitools.json`) for the Dart client; Flutter 3.44.9 for `flutter analyze` / `flutter test`.

**Spec:** `docs/superpowers/specs/2026-10-02-juvi-notifications-design.md` — this plan is §13 item 1 (backend). §4 data model, §5 pipeline, §6 policy, §7 API, §10 configuration and §11 failure handling are binding here; §8 (Flutter) and §9 (portal) are Plans 3 and 2. The notices spec (`2026-09-26-juvi-notices-design.md`) still governs `Notice`, `NoticeRecipient`, reach and the added-later rows.

## Rulings

Decisions this plan makes where the spec is silent, or where the live code forces a different shape. Each is restated in the task that implements it.

1. **`notices:urgent` is an ordinary policy row.** `Policy.action` is a free string (`backend/src/models/platform/Policy.ts:30`), so the permission is `{ module: 'notices', action: 'urgent' }`, added to `DEFAULT_POLICIES` for `admin` and `principal`. The platform policy CRUD validator gains `'urgent'` in its action enum (`backend/src/modules/platform/validation.ts:130`) so an IT admin can grant it to another persona. `admin` and `super_admin` pass by role without a policy lookup (`notices/urgent-gate.ts`).
2. **HOD's `notices:*` becomes three named rows** (`read`, `create`, `update`; `backend/src/shared/rbac/defaults.ts:188`), because the wildcard would otherwise grant `notices:urgent`. No notices route uses any other action, so HOD access is unchanged. The principal keeps `notices:*`, which also grants Urgent, as the spec wants.
3. **The 403 is in the ERP shape**: `{ error: 'Only an IT admin can publish Urgent notices. …', detail: { code: 'URGENT_NOT_ALLOWED' } }`, via `AppError`'s `detail`, because publishing is an admin-console route. The gate runs before the publisher scope is resolved and is evaluated whatever `RBAC_ENFORCE` says (like the audience scope in `scope.ts`).
4. **`urgentReason` is validated twice**: the publish Zod schema refuses Urgent without a 10–300 character reason (400), and a `Notice` pre-validate hook refuses a *new* Urgent document without one, so notices already published as Urgent are left alone. A reason sent with any other priority is dropped (stored `null`). The publish audit entry always records `priority`, plus `urgentReason` and `confidential` when set.
5. **Batch key is `office:<office name>`**, not `office:<officeId>`: notices carry `publisher.office` (a name from `notices/offices.ts`) and no office id.
6. **The mute matcher is `Notice.channelIds`** — exactly what `channelNotices` (`notices/mobile-service.ts:163`) reads for the channel screen — inverted through `ChannelMembership`: a person is muted for a notice when the notice lists at least one of their channels and every such membership has `mutedAt`.
7. **`registerNotificationConsumers()` is called from `backend/src/modules/juvi-app/routes.ts`**, next to `registerNoticeConsumers()`, which is where that call actually lives (spec §5.1 says `server.ts`).
8. **The sender is an `afterEvents` sweeper.** `registerSweeper(fn, { afterEvents: true })` is a new option on the outbox: ordinary sweepers still run before the events on the scheduled tick only; `afterEvents` sweepers run after the events on every pass (tick, `kick()`, `drainOutbox()`). That gives "the dispatcher tick and `kick()`" from §5.3 and lets tests drive the whole pipeline with `drainOutbox()`.
9. **Reminder number travels in the `notice.reminder` payload** (`n`), so `markReminded` emits `reminder-<n>`; an event recorded before this change falls back to `notice.reminders.length`.
10. **The push-token index is partial, not sparse**: `{ pushToken: 1 }` unique with `partialFilterExpression: { pushToken: { $type: 'string' } }`, so a stray `pushToken: null` never collides; tokens are cleared with `$unset`. A token moves across colleges deliberately (it names one phone and the index is global).
11. **The sender's re-check** cancels with `archived` when the notice is no longer `published` or the recipient row is archived, and with `acknowledged` / `dismissed` from the recipient row. Devices are the account's sessions with `revokedAt: null`, an unexpired refresh token and a string `pushToken`. When every token comes back `UNREGISTERED`/`INVALID_ARGUMENT`, the rows become `suppressed / no_device` (there is nothing left to deliver to). A transport that throws counts as `UNAVAILABLE` for every token.
12. **Backoff counts the attempt just made**: after the n-th failed attempt `sendAfter = now + min(30 s × 2^n, 10 min)` — 60 s, 120 s, 240 s, 480 s — and the 5th failure is `failed`.
13. **A Routine digest message** carries the newest notice's `deliveryId`, `receipt` and `noticeId`, `count` = rows in the digest, and no `title` when `count > 1`. Its receipt moves every row sent with it (same account, batch key, Routine, `sentAt`).
14. **Receipts:** a new mobile code `RECEIPT_INVALID` (401) when every item fails; the response is `{ accepted, rejected }`; the per-IP limit is the existing `limiter()` helper at 60 a minute (`receiptsLimiter`).
15. **Events:** `appVersion` and `platform` come from the `X-Juvi-App-Version` / `X-Juvi-Platform` headers every app request already carries. The *contract* documents `props` as a plain map, because the dart-dio generator cannot build a string-or-number-or-boolean map value (it emits uncompilable Dart); the server's `validEvent` still enforces the §7.3 rules.
16. **Startup guard:** `JUVI_RECEIPT_KEY` must be at least 32 characters; whenever `FIREBASE_SERVICE_ACCOUNT_JSON` is set it must parse as a service-account JSON with `project_id`, `client_email` and `private_key`. The dev fallback key is `HKDF-SHA256(JWT_SECRET, salt '', info 'juvi-receipt-v1', 32 bytes)`.
17. **Reach `delivery` counts are by current status** (disjoint: a delivered row is not also counted as sent) over every `source.kind: 'published'` row of the notice, added-later people included. A pending member's `delivery` is `none` when they are not on Juvi, have no row, or their row was `cancelled`.
18. **The Reach CSV gains a `Delivery` column** (Not delivered, Delivered, Opened, Muted, Notifications off, No device, Scheduled, empty). Spec §9 lists it under the portal, but the CSV is built by the backend (`reachCsv`).
19. **CI:** `.github/workflows/e2e.yml` runs the backend with `NODE_ENV=production`, so it gets a dummy `JUVI_RECEIPT_KEY` in the same task as the guard, or the Playwright job would stop at startup.
20. **Between Plan 1 and Plan 2** the portal composer still offers Urgent without a reason field, so an Urgent publish from the portal gets a 400 until Plan 2 lands. Routine and Important are unaffected; no portal or Playwright test publishes Urgent.
21. **Generated-client side effect:** regenerating the Dart client from the new contract also splits `SettingsPatch.quietHours` out into a `SettingsPatchQuietHours` class (the generator's inline-model naming changes once the new schemas exist). Nothing in `mobile/lib` or `mobile/test` names either class; commit the generator output as is, since CI (`mobile.yml`) regenerates and diffs it.

**Spec name → code name:** spec `decide(input)` → `decide(input: PolicyInput): PolicyDecision` (`policy.ts`); `PushTransport.send(tokens, message)` → same, returning one `PushResult` per token; "the sender" → `runSender(now?, transport?)`; "the expand consumer" → `expandNotification(payload, now?)`; the Reach block → `deliveryCounts()`, the pending field → `deliveryState()` (`notices/reach-service.ts`); the Routine window helper → `digestSendAfter()`.

## Dry run

Every task below was executed in a scratch copy of `main` at 66f4084, in order, running each task's own tests with only that task's and earlier tasks' code (Tasks 1–10 replayed from an untouched copy; Task 11 is the combined state).

- **Baseline (`main` + spec):** `npm run typecheck` clean. Backend unit: 194 files, 1,889 tests, all passing. Backend e2e: 58 files, 511 passed, 5 failed, 3 skipped (519) — the known `fee-alerts` ×2, `fee-configuration-http` pin coverage, the `rbac-route-walk` snapshot (it is missing the `/api/juvi-app/admin/notices/targets/people` row on `main`, so it fails every run) and one `finance-agent-http` SSE flake. Mobile: `flutter analyze` clean, 203 tests passing with `--exclude-tags golden`.
- **Final (after Task 11):** `npm run typecheck` clean. Backend unit: 200 files, 1,947 tests passing (+6 files, +58 tests); `src/modules/people/__tests__/photo-routes.e2e.test.ts` times out in its `afterAll` (`teardownMongo`) under full-suite load in some runs and passes on its own (55/55 with the finance aggregates file) — see Task 11 Step 4. Backend e2e: 64 files (+6), 557 tests: 550 passed, 4 failed, 3 skipped — exactly the four baseline failures above (`fee-alerts` ×2, `fee-configuration-http`, `rbac-route-walk` with only the pre-existing `targets/people` rows in its diff). One earlier run also failed `rbac-assigned` ×2 and the `people-search` 429 test; both pass alone and on the rerun (they share the developer machine's real Redis across workers). Contract: `npm run openapi:mobile -w backend` then the document drift test pass; `node mobile/tool/check_nullable_objects.js mobile/api/openapi.json` passes with its allowlist unchanged. Mobile: the client regenerates and builds, `flutter analyze` clean, 203 tests passing.
- **Draft fixes found in the dry run and folded into the tasks:** the receipt e2e used `sentAt + 1 s` as a receipt time (which the clamp moves back to "now") and reused one push token for two students (a duplicate-key error on the new unique index); the Dart generator could not compile the `props` value union (Ruling 15); the e2e workflow needed `JUVI_RECEIPT_KEY` (Ruling 19).

## Global Constraints

- Every new model has `collegeId: { type: Schema.Types.ObjectId, required: true, index: true }` and every query filters by `collegeId`. The two deliberate cross-college reads — the sender's lease claim and the receipt lookup by row id — scope every later read and write by the row's own `collegeId`.
- `AppError` takes `(statusCode, message, detail?)`, status first. `MobileApiError` takes `(statusCode, code, message, detail?)`. Mobile routes use `{ error: { code, message } }` and never `authorize()`; admin routes keep `{ error: string }`.
- Tiers `urgent | important | routine`. Statuses `suppressed | scheduled | sent | delivered | opened | cancelled | failed`, forward only except `scheduled → cancelled`. Reasons `muted | tier_off | no_device | acknowledged | dismissed | archived`. Source kinds `published | reminder-1 | reminder-2`. A reminder is always `important`.
- Unique `(source.type, source.id, source.kind, accountId)`; indexes `(status, sendAfter)`, `(collegeId, source.id, status)`, `(accountId, batchKey, status)`; no TTL on `NotificationDelivery`. `JuviEvent` expires 400 days after `receivedAt`.
- Policy order: tier toggles → mute → quiet hours. Urgent bypasses all three. Quiet hours default 22:00–07:00, read in the college timezone (`getJuviConfig(collegeId).timezone`, default `Asia/Kolkata`), may wrap midnight; `sendAfter` is the next occurrence of `end`.
- Routine digest window: 15 minutes (`DIGEST_WINDOW_MS`). A Routine row joins the open window for `(accountId, batchKey)` or opens one at `max(policy sendAfter, now + 15 min)`.
- Sender: up to 500 rows a pass, 60 s `lockedUntil` lease, backoff `30 s × 2^attempts` capped at 10 minutes, `failed` after 5 attempts; `UNREGISTERED` / `INVALID_ARGUMENT` clear that session's `pushToken`; `lastError` holds an error code, never the payload.
- Payload (§6.6): FCM data-only, every value a string; `high` priority for Urgent and Important, `normal` for Routine; `collapseKey` = `groupKey` = `notice:<id>`; a confidential notice has no `title`; never the body, attachments, names, roll numbers, deadlines or audience.
- Receipt: `base64url(HMAC-SHA256(JUVI_RECEIPT_KEY, deliveryId + '.' + expiry)) + '.' + expiry`, expiry in Unix seconds 7 days after sending; 1–50 items; `at` clamped to `[sentAt, now]`; 401 only when every item fails.
- Events: 1–100 per request; names from the §7.3 allow-list; each prop value a string of ≤ 64 characters matching `^[A-Za-z0-9_.:-]*$`, a number or a boolean; ≤ 10 keys and ≤ 1 KB serialised; invalid events dropped one by one.
- Push token: `{ token: string (≤ 4096), platform: 'android' }`; `PUT` and `DELETE /v1/me/devices/current/push-token` return 204; revoking a session removes its token.
- Urgent: `role ∈ {admin, super_admin}` or `notices:urgent`, else `403 URGENT_NOT_ALLOWED`; `urgentReason` 10–300 characters.
- Added-later push only for a notice under 7 days old, `published`, and with no deadline or a deadline still ahead; dedupe key `notif:notice:<id>:published:<accountId>`.
- `firebase-admin` is imported only by `notifications/transport/fcm.ts`, and that module is loaded lazily. With `FIREBASE_SERVICE_ACCOUNT_JSON` unset the transport is `FakePushTransport`, with a startup warning. `JUVI_RECEIPT_KEY` is required when `NODE_ENV=production`; `FIREBASE_SERVICE_ACCOUNT_JSON` is required in production only when `JUVI_PUSH_REQUIRED=true`.
- Contract: no new object-or-null field; `npm run openapi:mobile -w backend` regenerates `mobile/api/openapi.json` (the backend drift test and `contract.yml` fail otherwise); `mobile/tool/gen_api.sh` regenerates `mobile/packages/juvi_api` (`mobile.yml` regenerates and diffs it).
- TypeScript strict (`noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`); `String(doc._id)`; prefix unused params with `_`.
- Tests never touch the dev database `juvion_v2`: unit tests that need Mongo use `src/__tests__/helpers/mongoMemory`; e2e tests run on the per-worker MongoMemoryServer of `npm run test:e2e -w backend` (`NODE_ENV=test`, no Redis queue: `kick()` runs inline and tests call `drainOutbox()`). Tests install a `FakePushTransport` with `setPushTransport()` and remove it in `afterAll`.
- Commit after every task with a conventional-commit message ending in `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

---

## File structure

**Create**

```
backend/src/models/juvi/NotificationDelivery.ts                    one row per person per notification (spec §4.1)
backend/src/models/juvi/JuviEvent.ts                               analytics event, 400-day TTL (spec §4.2)
backend/src/models/juvi/__tests__/notification-models.schema.test.ts

backend/src/modules/juvi-app/notifications/policy.ts               decide, inQuietHours, nextOccurrence, digestSendAfter (pure)
backend/src/modules/juvi-app/notifications/expand-consumer.ts      requestNoticeNotification, expandNotification, notificationKey, batchKeyOf
backend/src/modules/juvi-app/notifications/payload.ts              buildNoticePush (pure)
backend/src/modules/juvi-app/notifications/sender.ts               runSender, sendBackoffMs
backend/src/modules/juvi-app/notifications/receipts.ts             receiptKey, signReceipt, verifyReceipt, applyReceipts
backend/src/modules/juvi-app/notifications/events-service.ts       EVENT_NAMES, validEvent, ingestEvents
backend/src/modules/juvi-app/notifications/schemas.ts              mobile Zod contract for the three endpoints
backend/src/modules/juvi-app/notifications/controller.ts
backend/src/modules/juvi-app/notifications/routes.ts               notificationsRouter (v1)
backend/src/modules/juvi-app/notifications/index.ts                registerNotificationConsumers
backend/src/modules/juvi-app/notifications/transport/types.ts      PushTransport, PushMessage, PushResult, TOKEN_ERRORS
backend/src/modules/juvi-app/notifications/transport/fake.ts       FakePushTransport
backend/src/modules/juvi-app/notifications/transport/fcm.ts        FcmPushTransport (the only firebase-admin import)
backend/src/modules/juvi-app/notifications/transport/index.ts      getPushTransport, setPushTransport, pushTransportWarning
backend/src/modules/juvi-app/notifications/__tests__/policy.test.ts
backend/src/modules/juvi-app/notifications/__tests__/transport.test.ts
backend/src/modules/juvi-app/notifications/__tests__/receipts.test.ts
backend/src/modules/juvi-app/notifications/__tests__/payload.test.ts
backend/src/modules/juvi-app/notifications/__tests__/events.test.ts
backend/src/modules/juvi-app/notices/urgent-gate.ts                canPublishUrgent, assertUrgentAllowed

backend/src/__e2e__/factories/notification.factory.ts              studentOnJuvi, quietHoursAround, deliveriesFor, deliveryOf
backend/src/__e2e__/modules/juvi-notifications-urgent.e2e.test.ts
backend/src/__e2e__/modules/juvi-notifications-expand.e2e.test.ts
backend/src/__e2e__/modules/juvi-notifications-send.e2e.test.ts
backend/src/__e2e__/modules/juvi-notifications-added-later.e2e.test.ts
backend/src/__e2e__/modules/juvi-notifications-mobile.e2e.test.ts
backend/src/__e2e__/modules/juvi-notifications-reach.e2e.test.ts
```

**Modify**

```
backend/src/models/juvi/Notice.ts                                  confidential, urgentReason, URGENT_REASON_MIN/MAX, pre-validate
backend/src/models/juvi/MobileSession.ts                           unique partial index on pushToken
backend/src/models/index.ts, backend/src/seed.ts                   export and clean up the two new models
backend/src/shared/outbox/outbox.ts                                registerSweeper(fn, { afterEvents })
backend/src/shared/rbac/defaults.ts                                notices:urgent for admin and principal; HOD rows named
backend/src/modules/platform/validation.ts                         'urgent' in the policy action enum
backend/src/modules/juvi-app/startup-guard.ts                      JUVI_RECEIPT_KEY, FIREBASE_SERVICE_ACCOUNT_JSON, JUVI_PUSH_REQUIRED
backend/src/modules/juvi-app/routes.ts                             registerNotificationConsumers(); v1Router.use(notificationsRouter)
backend/src/modules/juvi-app/errors.ts                             RECEIPT_INVALID
backend/src/modules/juvi-app/middleware/rate-limits.ts             receiptsLimiter
backend/src/modules/juvi-app/accounts/session-service.ts           revokeSession unsets pushToken; setPushToken, clearPushToken
backend/src/modules/juvi-app/notices/admin-schemas.ts              confidential, urgentReason
backend/src/modules/juvi-app/notices/admin-controller.ts           Urgent gate on publish; /targets canPublishUrgent
backend/src/modules/juvi-app/notices/admin-service.ts              detail returns confidential, urgentReason
backend/src/modules/juvi-app/notices/publish-service.ts            store the flags, audit them; reminder payload carries n
backend/src/modules/juvi-app/notices/consumers.ts                  fan-out and reminders request the push
backend/src/modules/juvi-app/notices/recipient-service.ts          added-later back-fill requests the push
backend/src/modules/juvi-app/notices/schemas.ts                    deliveryCountsSchema, PENDING_DELIVERY_STATES
backend/src/modules/juvi-app/notices/reach-service.ts              deliveryCounts, deliveryState, CSV Delivery column
backend/src/modules/juvi-app/openapi/document.ts                   four routes, five components, RECEIPT_INVALID
backend/package.json, package-lock.json                            firebase-admin ^13.10.0
.env.example, backend/.env.example, .github/workflows/e2e.yml      the new variables
mobile/api/openapi.json, mobile/packages/juvi_api/**               regenerated
mobile/test/core/repos/notices_fixtures.dart                       reach and pending fixtures gain delivery
CLAUDE.md                                                          Juvi notifications bullet, env block
(tests) cards.test.ts, session-service.test.ts, startup-guard.test.ts, defaults-notices.test.ts, outbox.test.ts,
        reach.test.ts, document.test.ts, juvi-app-admin-notices.e2e.test.ts
```

---

### Task 1: Data model — `NotificationDelivery`, `JuviEvent`, the Notice flags and the push-token index

**Files:**
- Create: `backend/src/models/juvi/NotificationDelivery.ts`, `backend/src/models/juvi/JuviEvent.ts`
- Modify: `backend/src/models/juvi/Notice.ts:16` (constants), `:46` (interface), `:86` (schema); `backend/src/models/juvi/MobileSession.ts:56`; `backend/src/models/index.ts:418`; `backend/src/seed.ts:110`, `:294`; `backend/src/modules/juvi-app/notices/__tests__/cards.test.ts:13`
- Test: `backend/src/models/juvi/__tests__/notification-models.schema.test.ts`

**Interfaces:**
- Consumes: the existing `Notice` and `MobileSession` models. The tests are declaration checks (`validateSync`, `schema.indexes()`) and start no database; the push-token index is exercised over HTTP in Task 8.
- Produces:
  ```ts
  // models/juvi/NotificationDelivery.ts
  export type NotificationTier = 'urgent' | 'important' | 'routine';
  export type DeliveryStatus = 'suppressed' | 'scheduled' | 'sent' | 'delivered' | 'opened' | 'cancelled' | 'failed';
  export type DeliveryReason = 'muted' | 'tier_off' | 'no_device' | 'acknowledged' | 'dismissed' | 'archived';
  export type NotificationSourceKind = 'published' | 'reminder-1' | 'reminder-2';
  export const NOTIFICATION_TIERS, DELIVERY_STATUSES, DELIVERY_REASONS, NOTIFICATION_SOURCE_KINDS; // readonly arrays of the above
  export interface INotificationSource { type: 'notice'; id: Types.ObjectId; kind: NotificationSourceKind }
  export interface INotificationDelivery extends Document { collegeId; accountId; source; tier; status; reason; batchKey; groupKey; sendAfter; sentAt; deliveredAt; openedAt; attempts; lastError; lockedUntil; createdAt; updatedAt }
  export type LeanNotificationDelivery = Omit<INotificationDelivery, keyof Document> & { _id: Types.ObjectId };
  export const NotificationDelivery: Model<INotificationDelivery>;
  // models/juvi/JuviEvent.ts
  export const JUVI_EVENT_TTL_DAYS = 400;
  export type JuviEventProps = Record<string, string | number | boolean>;
  export const JuviEvent: Model<IJuviEvent>;   // { collegeId, accountId, name, at, props, appVersion, platform, receivedAt }
  // models/juvi/Notice.ts
  export const URGENT_REASON_MIN = 10; export const URGENT_REASON_MAX = 300;
  // INotice gains: confidential: boolean; urgentReason: string | null;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/models/juvi/__tests__/notification-models.schema.test.ts
import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { NotificationDelivery } from '../NotificationDelivery';
import { JuviEvent } from '../JuviEvent';
import { Notice } from '../Notice';
import { MobileSession } from '../MobileSession';

const oid = () => new Types.ObjectId();
const keys = (model: { schema: { indexes(): [Record<string, unknown>, Record<string, unknown>][] } }) => model.schema.indexes();
const delivery = (extra: Record<string, unknown> = {}) => ({
  collegeId: oid(), accountId: oid(), source: { type: 'notice', id: oid(), kind: 'published' },
  tier: 'important', status: 'scheduled', batchKey: 'office:Exam Section', groupKey: 'notice:x', sendAfter: new Date(), ...extra,
});
const notice = (extra: Record<string, unknown> = {}) => ({
  collegeId: oid(), title: 'Exam timetable', body: 'See attached.',
  publisher: { personId: oid(), userId: oid(), office: 'Exam Section' },
  audience: { rules: [{ kind: 'batch', ids: [String(oid())] }], line: 'Sent to 2024 batch' }, ...extra,
});

describe('NotificationDelivery (spec §4.1)', () => {
  it('defaults the timestamps, attempts, reason, error and lease to empty', () => {
    const doc = new NotificationDelivery(delivery());
    expect(doc.validateSync()).toBeUndefined();
    expect(doc).toMatchObject({ reason: null, sentAt: null, deliveredAt: null, openedAt: null, attempts: 0, lastError: null, lockedUntil: null });
  });

  it('rejects unknown tiers, statuses, reasons and source kinds', () => {
    expect(new NotificationDelivery(delivery({ tier: 'loud' })).validateSync()?.errors.tier).toBeDefined();
    expect(new NotificationDelivery(delivery({ status: 'queued' })).validateSync()?.errors.status).toBeDefined();
    expect(new NotificationDelivery(delivery({ reason: 'busy' })).validateSync()?.errors.reason).toBeDefined();
    expect(new NotificationDelivery(delivery({ source: { type: 'notice', id: oid(), kind: 'reminder-3' } })).validateSync()?.errors['source.kind']).toBeDefined();
  });

  it('declares the four spec indexes, the source key unique', () => {
    expect(keys(NotificationDelivery)).toEqual(expect.arrayContaining([
      [{ 'source.type': 1, 'source.id': 1, 'source.kind': 1, accountId: 1 }, expect.objectContaining({ unique: true })],
      [{ status: 1, sendAfter: 1 }, expect.anything()],
      [{ collegeId: 1, 'source.id': 1, status: 1 }, expect.anything()],
      [{ accountId: 1, batchKey: 1, status: 1 }, expect.anything()],
    ]));
  });
});

describe('JuviEvent (spec §4.2)', () => {
  it('expires 400 days after receipt', () => {
    expect(keys(JuviEvent)).toContainEqual([{ receivedAt: 1 }, expect.objectContaining({ expireAfterSeconds: 400 * 86_400 })]);
    const doc = new JuviEvent({ collegeId: oid(), accountId: oid(), name: 'app.opened', at: new Date() });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.receivedAt).toBeInstanceOf(Date);
    expect(doc.props).toEqual({});
  });
});

describe('Notice.confidential and Notice.urgentReason (spec §4.2, §6.5)', () => {
  it('defaults to not confidential with no reason', () => {
    const doc = new Notice(notice());
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.confidential).toBe(false);
    expect(doc.urgentReason).toBeNull();
  });
});

describe('MobileSession.pushToken (spec §4.2)', () => {
  // A declaration check, not a database one: the move-between-sessions behaviour is covered over HTTP in juvi-notifications-mobile.e2e.test.ts.
  it('is unique among sessions that hold a token, so sessions without one never collide', () => {
    expect(keys(MobileSession)).toContainEqual([
      { pushToken: 1 }, expect.objectContaining({ unique: true, partialFilterExpression: { pushToken: { $type: 'string' } } }),
    ]);
  });
});
```

(Task 3 adds the Urgent-reason case to the `Notice` block of this file, together with the hook it tests.)

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run src/models/juvi/__tests__/notification-models.schema.test.ts`
Expected: FAIL — `Failed to load url ../NotificationDelivery` (the module does not exist yet).

- [ ] **Step 3: Create the two models**

```ts
// backend/src/models/juvi/NotificationDelivery.ts
import { Schema, model, Document, Types } from 'mongoose';

export type NotificationTier = 'urgent' | 'important' | 'routine';
export type DeliveryStatus = 'suppressed' | 'scheduled' | 'sent' | 'delivered' | 'opened' | 'cancelled' | 'failed';
export type DeliveryReason = 'muted' | 'tier_off' | 'no_device' | 'acknowledged' | 'dismissed' | 'archived';
export type NotificationSourceKind = 'published' | 'reminder-1' | 'reminder-2';

export const NOTIFICATION_TIERS: readonly NotificationTier[] = ['urgent', 'important', 'routine'];
export const DELIVERY_STATUSES: readonly DeliveryStatus[] = ['suppressed', 'scheduled', 'sent', 'delivered', 'opened', 'cancelled', 'failed'];
export const DELIVERY_REASONS: readonly DeliveryReason[] = ['muted', 'tier_off', 'no_device', 'acknowledged', 'dismissed', 'archived'];
export const NOTIFICATION_SOURCE_KINDS: readonly NotificationSourceKind[] = ['published', 'reminder-1', 'reminder-2'];

/** Sub-project 5 adds `post` and `mention` to `type`. */
export interface INotificationSource { type: 'notice'; id: Types.ObjectId; kind: NotificationSourceKind }

/**
 * One row per person per notification (notifications spec §4.1). The unique
 * (source, accountId) key makes expansion idempotent; `status` only moves
 * forward, except that `scheduled` can become `cancelled`. `lastError` holds a
 * transport error code, never the payload.
 */
export interface INotificationDelivery extends Document {
  collegeId: Types.ObjectId;
  accountId: Types.ObjectId;
  source: INotificationSource;
  tier: NotificationTier;
  status: DeliveryStatus;
  reason: DeliveryReason | null;
  batchKey: string;
  groupKey: string;
  sendAfter: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  attempts: number;
  lastError: string | null;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INotificationDelivery>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true },
    source: {
      type: { type: String, enum: ['notice'], required: true },
      id: { type: Schema.Types.ObjectId, required: true },
      kind: { type: String, enum: NOTIFICATION_SOURCE_KINDS, required: true },
    },
    tier: { type: String, enum: NOTIFICATION_TIERS, required: true },
    status: { type: String, enum: DELIVERY_STATUSES, required: true },
    reason: { type: String, enum: [...DELIVERY_REASONS, null], default: null },
    batchKey: { type: String, required: true },
    groupKey: { type: String, required: true },
    sendAfter: { type: Date, required: true },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: null },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

// Expansion idempotency, the sender's scan, Reach, and digest windows (spec §4.1).
schema.index({ 'source.type': 1, 'source.id': 1, 'source.kind': 1, accountId: 1 }, { unique: true });
schema.index({ status: 1, sendAfter: 1 });
schema.index({ collegeId: 1, 'source.id': 1, status: 1 });
schema.index({ accountId: 1, batchKey: 1, status: 1 });

/** A lean read of a NotificationDelivery: fields only, no Document methods. */
export type LeanNotificationDelivery = Omit<INotificationDelivery, keyof Document> & { _id: Types.ObjectId };

export const NotificationDelivery = model<INotificationDelivery>('NotificationDelivery', schema);
```

```ts
// backend/src/models/juvi/JuviEvent.ts
import { Schema, model, Document, Types } from 'mongoose';

export const JUVI_EVENT_TTL_DAYS = 400;
export type JuviEventProps = Record<string, string | number | boolean>;

/** A product-analytics event from the app (notifications spec §4.2, §7.3): ids and enums only, never content. */
export interface IJuviEvent extends Document {
  collegeId: Types.ObjectId;
  accountId: Types.ObjectId;
  name: string;
  at: Date;
  props: JuviEventProps;
  appVersion: string;
  platform: string;
  receivedAt: Date;
}

const schema = new Schema<IJuviEvent>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true },
  name: { type: String, required: true },
  at: { type: Date, required: true },
  props: { type: Schema.Types.Mixed, default: {} },
  appVersion: { type: String, default: '' },
  platform: { type: String, default: '' },
  receivedAt: { type: Date, default: Date.now },
});

schema.index({ receivedAt: 1 }, { expireAfterSeconds: JUVI_EVENT_TTL_DAYS * 86_400 });
schema.index({ collegeId: 1, name: 1, at: -1 });

export const JuviEvent = model<IJuviEvent>('JuviEvent', schema);
```

- [ ] **Step 4: Add the two flags to `Notice`**

In `backend/src/models/juvi/Notice.ts`, after `export const NOTICE_REMINDERS_MAX = 2;` (line 16):

```ts
/** Urgent needs a recorded reason (notifications spec §6.5). */
export const URGENT_REASON_MIN = 10;
export const URGENT_REASON_MAX = 300;
```

In `interface INotice`, after `priority: NoticePriority;` (line 46):

```ts
  /** Set at publish, never changed: the push shows only "New notice from <office>". */
  confidential: boolean;
  /** Required when `priority === 'urgent'` on notices published from now on. */
  urgentReason: string | null;
```

In the schema, after `priority: { type: String, enum: NOTICE_PRIORITIES, default: 'routine' },` (line 86):

```ts
    confidential: { type: Boolean, default: false },
    urgentReason: { type: String, trim: true, maxlength: URGENT_REASON_MAX, default: null },
```

- [ ] **Step 5: Index `MobileSession.pushToken`**

In `backend/src/models/juvi/MobileSession.ts`, after `schema.index({ previousRefreshTokenHash: 1 }, { sparse: true });` (line 56):

```ts
// One session per FCM token (notifications spec §4.2). Partial on string values rather than sparse,
// so a stray `pushToken: null` can never collide with another; clear a token with $unset.
schema.index({ pushToken: 1 }, { unique: true, partialFilterExpression: { pushToken: { $type: 'string' } } });
```

- [ ] **Step 6: Export the models and clean them up in the dev seed**

`backend/src/models/index.ts`, after `export { NoticeRecipient } from './juvi/NoticeRecipient';` (line 418):

```ts
export { NotificationDelivery } from './juvi/NotificationDelivery';
export { JuviEvent } from './juvi/JuviEvent';
```

`backend/src/seed.ts` line 110, extend the import:

```ts
  JuviProvisioningRun, JuviProvisionedCredential, Notice, NoticeRecipient, NotificationDelivery, JuviEvent,
```

and after `NoticeRecipient.deleteMany({ collegeId: CID }),` (line 294):

```ts
    NotificationDelivery.deleteMany({ collegeId: CID }),
    JuviEvent.deleteMany({ collegeId: CID }),
```

- [ ] **Step 7: Keep the cards fixture a complete `LeanNotice`**

`backend/src/modules/juvi-app/notices/__tests__/cards.test.ts` line 13 builds a typed `LeanNotice`, so it needs the two new fields:

```ts
  priority: 'important', confidential: false, urgentReason: null, purpose: 'standard', status: 'published', counts: { audience: 2, onJuvi: 1 }, reminders: [],
```

- [ ] **Step 8: Run the tests and the typecheck**

Run: `cd backend && npx vitest run src/models/juvi src/modules/juvi-app/notices/__tests__/cards.test.ts && npx tsc --noEmit`
Expected: PASS (the new file: 6 tests); typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add backend/src/models/juvi/NotificationDelivery.ts backend/src/models/juvi/JuviEvent.ts backend/src/models/juvi/Notice.ts \
  backend/src/models/juvi/MobileSession.ts backend/src/models/index.ts backend/src/seed.ts \
  backend/src/models/juvi/__tests__/notification-models.schema.test.ts backend/src/modules/juvi-app/notices/__tests__/cards.test.ts
git commit -m "feat(juvi-app): NotificationDelivery and JuviEvent models, Notice confidential and urgentReason, unique push token

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Notification policy (pure)

**Files:**
- Create: `backend/src/modules/juvi-app/notifications/policy.ts`
- Test: `backend/src/modules/juvi-app/notifications/__tests__/policy.test.ts`

**Interfaces:**
- Consumes: `NotificationTier` (Task 1).
- Produces:
  ```ts
  export interface PolicySettings { quietHours: { start: string; end: string }; tiers: { important: boolean; routine: boolean } }
  export interface PolicyInput { tier: NotificationTier; settings: PolicySettings; mutedAllMatchingChannels: boolean; now: Date; collegeTimezone: string }
  export type PolicyDecision = { status: 'scheduled'; sendAfter: Date } | { status: 'suppressed'; reason: 'tier_off' | 'muted' };
  export const DIGEST_WINDOW_MS = 15 * 60_000;
  export function wallClock(at: Date, timeZone: string): { year; month; day; hour; minute; second };
  export function inQuietHours(now: Date, quietHours: { start: string; end: string }, timeZone: string): boolean;
  export function nextOccurrence(now: Date, hhmm: string, timeZone: string): Date;   // strictly after now
  export function decide(input: PolicyInput): PolicyDecision;
  export function digestSendAfter(policySendAfter: Date, openWindow: Date | null, now: Date): Date;
  ```

`decide` applies §6.1 → §6.2 → §6.3 in that order, so tier-off beats mute and mute beats quiet hours, and Urgent returns `sendAfter: now` before any of them. Routine's 15-minute window is not part of `decide`: the expand consumer applies `digestSendAfter` to Routine rows, because joining a window needs the account's open rows. No date library: wall-clock maths uses `Intl.DateTimeFormat` with the IANA zone, and the zone offset is re-checked at the target instant so a DST change between now and `end` lands correctly.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/modules/juvi-app/notifications/__tests__/policy.test.ts
import { describe, it, expect } from 'vitest';
import { decide, digestSendAfter, inQuietHours, nextOccurrence, DIGEST_WINDOW_MS, PolicyInput, PolicySettings } from '../policy';

const IST = 'Asia/Kolkata';
const ON: PolicySettings = { quietHours: { start: '22:00', end: '07:00' }, tiers: { important: true, routine: true } };
const at = (iso: string) => new Date(iso);
const input = (over: Partial<PolicyInput> = {}): PolicyInput => ({
  tier: 'important', settings: ON, mutedAllMatchingChannels: false, now: at('2026-10-02T12:00:00Z'), collegeTimezone: IST, ...over,
});

// 12:00Z = 17:30 IST (outside 22:00–07:00); 17:00Z = 22:30 IST (inside); 23:00Z = 04:30 IST next day (inside).
const DAY = at('2026-10-02T12:00:00Z');
const NIGHT = at('2026-10-02T17:00:00Z');
const SMALL_HOURS = at('2026-10-02T23:00:00Z');
const NEXT_7AM_IST = at('2026-10-03T01:30:00Z');

describe('decide — tier toggles, mute and quiet hours (NTF-01, NTF-02, SPC-05)', () => {
  const cases: { name: string; over: Partial<PolicyInput>; expected: ReturnType<typeof decide> }[] = [
    // Important
    { name: 'important, daytime → now', over: { now: DAY }, expected: { status: 'scheduled', sendAfter: DAY } },
    { name: 'important, tier off → suppressed', over: { settings: { ...ON, tiers: { important: false, routine: true } } }, expected: { status: 'suppressed', reason: 'tier_off' } },
    { name: 'important, muted → suppressed', over: { mutedAllMatchingChannels: true }, expected: { status: 'suppressed', reason: 'muted' } },
    { name: 'important, quiet hours evening → 07:00', over: { now: NIGHT }, expected: { status: 'scheduled', sendAfter: NEXT_7AM_IST } },
    { name: 'important, quiet hours after midnight → 07:00 the same day', over: { now: SMALL_HOURS }, expected: { status: 'scheduled', sendAfter: NEXT_7AM_IST } },
    { name: 'important, tier off beats mute', over: { settings: { ...ON, tiers: { important: false, routine: true } }, mutedAllMatchingChannels: true }, expected: { status: 'suppressed', reason: 'tier_off' } },
    { name: 'important, mute beats quiet hours', over: { now: NIGHT, mutedAllMatchingChannels: true }, expected: { status: 'suppressed', reason: 'muted' } },
    // Routine
    { name: 'routine, daytime → now (the digest window is applied by the caller)', over: { tier: 'routine', now: DAY }, expected: { status: 'scheduled', sendAfter: DAY } },
    { name: 'routine, tier off → suppressed', over: { tier: 'routine', settings: { ...ON, tiers: { important: true, routine: false } } }, expected: { status: 'suppressed', reason: 'tier_off' } },
    { name: 'routine, muted → suppressed', over: { tier: 'routine', mutedAllMatchingChannels: true }, expected: { status: 'suppressed', reason: 'muted' } },
    { name: 'routine, quiet hours → 07:00', over: { tier: 'routine', now: NIGHT }, expected: { status: 'scheduled', sendAfter: NEXT_7AM_IST } },
    // Urgent bypasses everything
    { name: 'urgent, daytime → now', over: { tier: 'urgent', now: DAY }, expected: { status: 'scheduled', sendAfter: DAY } },
    { name: 'urgent, both tiers off → now', over: { tier: 'urgent', settings: { ...ON, tiers: { important: false, routine: false } } }, expected: { status: 'scheduled', sendAfter: DAY } },
    { name: 'urgent, muted → now', over: { tier: 'urgent', mutedAllMatchingChannels: true }, expected: { status: 'scheduled', sendAfter: DAY } },
    { name: 'urgent, quiet hours → now', over: { tier: 'urgent', now: NIGHT }, expected: { status: 'scheduled', sendAfter: NIGHT } },
    { name: 'urgent, everything at once → now', over: { tier: 'urgent', now: NIGHT, mutedAllMatchingChannels: true, settings: { ...ON, tiers: { important: false, routine: false } } }, expected: { status: 'scheduled', sendAfter: NIGHT } },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const now = c.over.now ?? DAY;
      expect(decide(input({ now, ...c.over }))).toEqual(c.expected);
    });
  }
});

describe('quiet hours in the college timezone', () => {
  it('a window that wraps past midnight', () => {
    expect(inQuietHours(at('2026-10-02T16:29:00Z'), ON.quietHours, IST)).toBe(false);   // 21:59 IST
    expect(inQuietHours(at('2026-10-02T16:30:00Z'), ON.quietHours, IST)).toBe(true);    // 22:00 IST
    expect(inQuietHours(at('2026-10-03T01:29:00Z'), ON.quietHours, IST)).toBe(true);    // 06:59 IST
    expect(inQuietHours(at('2026-10-03T01:30:00Z'), ON.quietHours, IST)).toBe(false);   // 07:00 IST
  });

  it('a window inside one day, and an empty window', () => {
    const lunch = { start: '13:00', end: '14:00' };
    expect(inQuietHours(at('2026-10-02T07:45:00Z'), lunch, IST)).toBe(true);           // 13:15 IST
    expect(inQuietHours(at('2026-10-02T08:30:00Z'), lunch, IST)).toBe(false);          // 14:00 IST
    expect(inQuietHours(at('2026-10-02T17:00:00Z'), { start: '22:00', end: '22:00' }, IST)).toBe(false);
  });

  it('the same instant is quiet in one timezone and not in another', () => {
    const instant = at('2026-10-02T23:30:00Z');                                         // 23:30 UTC, 05:00 IST, 19:30 New York (EDT)
    expect(inQuietHours(instant, ON.quietHours, 'UTC')).toBe(true);
    expect(inQuietHours(instant, ON.quietHours, IST)).toBe(true);
    expect(inQuietHours(instant, ON.quietHours, 'America/New_York')).toBe(false);
    expect(decide(input({ now: instant, collegeTimezone: 'America/New_York' }))).toEqual({ status: 'scheduled', sendAfter: instant });
    expect(decide(input({ now: at('2026-10-03T03:00:00Z'), collegeTimezone: 'America/New_York' })))   // 23:00 EDT
      .toEqual({ status: 'scheduled', sendAfter: at('2026-10-03T11:00:00Z') });                        // 07:00 EDT
  });

  it('nextOccurrence is strictly after now', () => {
    expect(nextOccurrence(at('2026-10-03T01:30:00Z'), '07:00', IST)).toEqual(at('2026-10-04T01:30:00Z'));
    expect(nextOccurrence(at('2026-10-03T01:29:00Z'), '07:00', IST)).toEqual(at('2026-10-03T01:30:00Z'));
  });
});

describe('digestSendAfter (NTF-04, spec §6.4)', () => {
  const now = DAY;
  it('opens a window 15 minutes out', () => {
    expect(digestSendAfter(now, null, now)).toEqual(new Date(now.getTime() + DIGEST_WINDOW_MS));
  });
  it('joins an open window', () => {
    const open = new Date(now.getTime() + 5 * 60_000);
    expect(digestSendAfter(now, open, now)).toEqual(open);
  });
  it('keeps a later policy time (quiet hours) instead of the window', () => {
    expect(digestSendAfter(NEXT_7AM_IST, null, now)).toEqual(NEXT_7AM_IST);
    expect(digestSendAfter(NEXT_7AM_IST, new Date(now.getTime() + 60_000), now)).toEqual(NEXT_7AM_IST);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/notifications/__tests__/policy.test.ts`
Expected: FAIL — `Failed to load url ../policy`.

- [ ] **Step 3: Implement the policy**

```ts
// backend/src/modules/juvi-app/notifications/policy.ts
/**
 * Notification policy (notifications spec §6). Pure: no I/O, no clock — the
 * caller passes `now` and the college timezone. Rules apply in order: tier
 * toggles, mute, quiet hours. Urgent bypasses all three.
 */
import type { NotificationTier } from '../../../models/juvi/NotificationDelivery';

export interface PolicySettings {
  quietHours: { start: string; end: string };
  tiers: { important: boolean; routine: boolean };
}

export interface PolicyInput {
  tier: NotificationTier;
  settings: PolicySettings;
  /** The notice matches at least one of the person's channels and every one of them is muted. */
  mutedAllMatchingChannels: boolean;
  now: Date;
  collegeTimezone: string;
}

export type PolicyDecision =
  | { status: 'scheduled'; sendAfter: Date }
  | { status: 'suppressed'; reason: 'tier_off' | 'muted' };

/** A Routine digest window is 15 minutes (spec §6.4). */
export const DIGEST_WINDOW_MS = 15 * 60_000;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map((p) => Number.parseInt(p, 10));
  return (h ?? 0) * 60 + (m ?? 0);
};

interface WallClock { year: number; month: number; day: number; hour: number; minute: number; second: number }

/** The wall-clock time of `at` in `timeZone`. */
export function wallClock(at: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number.parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Milliseconds `timeZone` is ahead of UTC at `at`. */
function offsetMs(at: Date, timeZone: string): number {
  const w = wallClock(at, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant whose wall clock in `timeZone` reads the given local date and time. */
function fromWallClock(year: number, month: number, day: number, minutes: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** True when `now` falls inside the window in `timeZone`. The window may wrap past midnight; start === end is no window. */
export function inQuietHours(now: Date, quietHours: { start: string; end: string }, timeZone: string): boolean {
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (start === end) return false;
  const w = wallClock(now, timeZone);
  const t = w.hour * 60 + w.minute;
  return start < end ? t >= start && t < end : t >= start || t < end;
}

/** The next instant after `now` at which the wall clock in `timeZone` reads `hhmm`. */
export function nextOccurrence(now: Date, hhmm: string, timeZone: string): Date {
  const w = wallClock(now, timeZone);
  const minutes = toMinutes(hhmm);
  const today = fromWallClock(w.year, w.month, w.day, minutes, timeZone);
  if (today.getTime() > now.getTime()) return today;
  const tomorrow = new Date(Date.UTC(w.year, w.month - 1, w.day + 1));
  return fromWallClock(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), minutes, timeZone);
}

export function decide(input: PolicyInput): PolicyDecision {
  const { tier, settings, now } = input;
  if (tier === 'urgent') return { status: 'scheduled', sendAfter: now };
  // §6.1 tier toggles
  if (!settings.tiers[tier]) return { status: 'suppressed', reason: 'tier_off' };
  // §6.2 mute
  if (input.mutedAllMatchingChannels) return { status: 'suppressed', reason: 'muted' };
  // §6.3 quiet hours
  if (inQuietHours(now, settings.quietHours, input.collegeTimezone)) {
    return { status: 'scheduled', sendAfter: nextOccurrence(now, settings.quietHours.end, input.collegeTimezone) };
  }
  return { status: 'scheduled', sendAfter: now };
}

/**
 * §6.4: a Routine row joins the open window for its (account, batch key) or opens
 * a new one at least 15 minutes out. A row whose policy time is later than the
 * open window (quiet hours began after the window opened) keeps the later time.
 */
export function digestSendAfter(policySendAfter: Date, openWindow: Date | null, now: Date): Date {
  if (openWindow) return new Date(Math.max(openWindow.getTime(), policySendAfter.getTime()));
  return new Date(Math.max(policySendAfter.getTime(), now.getTime() + DIGEST_WINDOW_MS));
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `cd backend && npx vitest run src/modules/juvi-app/notifications/__tests__/policy.test.ts && npx tsc --noEmit`
Expected: PASS (23 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/notifications/policy.ts backend/src/modules/juvi-app/notifications/__tests__/policy.test.ts
git commit -m "feat(juvi-app): pure notification policy — tier toggles, mute, quiet hours, Routine digest window

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The Urgent gate, the Urgent reason and the Confidential flag at publish

**Files:**
- Create: `backend/src/modules/juvi-app/notices/urgent-gate.ts`
- Modify: `backend/src/shared/rbac/defaults.ts:187-188`; `backend/src/modules/platform/validation.ts:130`; `backend/src/models/juvi/Notice.ts:101-104` (pre-validate); `backend/src/modules/juvi-app/notices/admin-schemas.ts:2-5`, `:49`, `:58`; `backend/src/modules/juvi-app/notices/publish-service.ts:119`, `:130`; `backend/src/modules/juvi-app/notices/admin-controller.ts:16`, `:47-58`, `:125`; `backend/src/modules/juvi-app/notices/admin-service.ts:27`, `:97`
- Test: `backend/src/shared/rbac/__tests__/defaults-notices.test.ts`, `backend/src/models/juvi/__tests__/notification-models.schema.test.ts`, `backend/src/__e2e__/modules/juvi-notifications-urgent.e2e.test.ts`

**Interfaces:**
- Consumes: `URGENT_REASON_MIN`, `URGENT_REASON_MAX`, `INotice.confidential`, `INotice.urgentReason` (Task 1); `evaluateAccess(collegeId, role, personas, module, action)` (`backend/src/shared/rbac/engine.ts:175`); `personaCodesOf(user)` (`backend/src/shared/rbac/persona-registry.ts:35`); `ErpUserRef` (`notices/publisher-scope.ts:46`); `AppError(status, message, detail?)`.
- Produces:
  ```ts
  // notices/urgent-gate.ts
  export const URGENT_ROLES: ReadonlySet<string>;          // admin, super_admin
  export const URGENT_ACTION = 'urgent';
  export function canPublishUrgent(collegeId: string, user: ErpUserRef): Promise<boolean>;
  export const urgentNotAllowed: () => AppError;           // 403, detail { code: 'URGENT_NOT_ALLOWED' }
  export function assertUrgentAllowed(collegeId: string, user: ErpUserRef, priority: string): Promise<void>;
  // notices/admin-schemas.ts publishSchema gains: confidential: boolean (default false); urgentReason?: string (10–300, trimmed)
  // GET /api/juvi-app/admin/notices/targets gains: canPublishUrgent: boolean
  // AdminNoticeDetail gains: confidential: boolean; urgentReason: string | null
  ```

Rulings 1–4 apply: `notices:urgent` is a policy row; HOD's wildcard is split; the 403 is ERP-shaped; the reason is enforced in Zod and, for new documents only, in the model.

- [ ] **Step 1: Write the failing tests**

Append to `describe('DEFAULT_POLICIES — notices …')` in `backend/src/shared/rbac/__tests__/defaults-notices.test.ts`, after the "students and parents" case:

```ts
  it('grants notices:urgent to admin and principal only (notifications spec §6.5)', () => {
    expect(allows('admin', 'urgent', 'L-ADM')).toBe(true);
    expect(allows('principal', 'urgent', 'L-PRIN')).toBe(true);
    expect(allows('hod', 'urgent', 'F-HOD')).toBe(false);
    expect(allows('faculty', 'urgent', 'F-FAC')).toBe(false);
    for (const code of OFFICE_PERSONA_CODES) expect(allows('staff', 'urgent', code), code).toBe(false);
    expect(allows('student', 'urgent', 'L-STU')).toBe(false);
    const urgentRows = POLICIES.filter((p) => p.module === 'notices' && p.action === 'urgent').map((p) => p.role).sort();
    expect(urgentRows).toEqual(['admin', 'principal']);
  });
```

Append to `describe('Notice.confidential and Notice.urgentReason …')` in `backend/src/models/juvi/__tests__/notification-models.schema.test.ts`:

```ts
  it('a new Urgent notice needs a reason of 10 to 300 characters', async () => {
    await expect(new Notice(notice({ priority: 'urgent' })).validate()).rejects.toThrow(/needs a reason/);
    await expect(new Notice(notice({ priority: 'urgent', urgentReason: 'too short' })).validate()).rejects.toThrow(/needs a reason/);
    await expect(new Notice(notice({ priority: 'urgent', urgentReason: 'x'.repeat(301) })).validate()).rejects.toThrow();
    await expect(new Notice(notice({ priority: 'urgent', urgentReason: 'Exam postponed by the university' })).validate()).resolves.toBeUndefined();
  });
```

Create the e2e file:

```ts
// backend/src/__e2e__/modules/juvi-notifications-urgent.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { enableJuvi, provisionTestStudent } from '../factories/juvi.factory';
import { activateAccount, createStaffPublisher, makeHod } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { AuditLog } from '../../shared/audit';
import { drainOutbox } from '../../shared/outbox';

process.env.E2E_TESTING = '1';

let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin/notices';
const REASON = 'University postponed the exam at short notice';
const body = (extra: Record<string, unknown> = {}) => ({
  title: 'Exam postponed', body: 'Details inside.', audience: { rules: [{ kind: 'batch', ids: [String(fx.batch._id)] }] }, ...extra,
});

beforeAll(async () => { api = createTestApi(await getTestApp()); });
beforeEach(async () => {
  await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId);
  const s = await provisionTestStudent(fx);
  await activateAccount(String(s.account._id));
});
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

describe('the Urgent gate (notifications spec §6.5)', () => {
  it('refuses an office publisher with 403 URGENT_NOT_ALLOWED and creates nothing', async () => {
    const registrar = await createStaffPublisher(fx, 'ST-REG');
    const res = await api.as(registrar.token).post(A).send(body({ priority: 'urgent', urgentReason: REASON })).expect(403);
    expect(res.body).toEqual({ error: expect.stringMatching(/Only an IT admin can publish Urgent/), detail: { code: 'URGENT_NOT_ALLOWED' } });
    expect(await Notice.countDocuments({ collegeId: fx.collegeId })).toBe(0);
    // Routine and Important stay open to them.
    await api.as(registrar.token).post(A).send(body({ priority: 'important' })).expect(201);
  });

  it('refuses an HOD too: their notices policy names its actions, so no wildcard grants Urgent', async () => {
    const hod = await makeHod(fx, fx.cse);
    await api.as(hod.token).post(A).send(body({ priority: 'urgent', urgentReason: REASON, audience: { rules: [{ kind: 'department', ids: [String(fx.cse._id)] }] } })).expect(403);
  });

  it('needs a reason of 10–300 characters', async () => {
    await api.as(fx.admin.token).post(A).send(body({ priority: 'urgent' })).expect(400);
    await api.as(fx.admin.token).post(A).send(body({ priority: 'urgent', urgentReason: 'Too short' })).expect(400);
    await api.as(fx.admin.token).post(A).send(body({ priority: 'urgent', urgentReason: 'x'.repeat(301) })).expect(400);
  });

  it('an admin publishes Urgent: the reason is stored, returned and written to the publish audit entry', async () => {
    const res = await api.as(fx.admin.token).post(A).send(body({ priority: 'urgent', urgentReason: REASON, confidential: true })).expect(201);
    await drainOutbox();
    expect(res.body).toMatchObject({ priority: 'urgent', urgentReason: REASON, confidential: true });
    expect(await Notice.findById(res.body.id).lean()).toMatchObject({ priority: 'urgent', urgentReason: REASON, confidential: true });
    const audit = (await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'Notice', entityId: res.body.id, action: 'publish' }).lean())!;
    expect(audit.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'priority', newValue: 'urgent' }),
      expect.objectContaining({ field: 'urgentReason', newValue: REASON }),
      expect.objectContaining({ field: 'confidential', newValue: true }),
    ]));
  });

  it('a principal may publish Urgent; a reason sent with another priority is dropped', async () => {
    await api.as(fx.principal.token).post(A).send(body({ priority: 'urgent', urgentReason: REASON })).expect(201);
    const routine = await api.as(fx.admin.token).post(A).send(body({ priority: 'routine', urgentReason: REASON })).expect(201);
    expect(routine.body).toMatchObject({ priority: 'routine', urgentReason: null, confidential: false });
  });
});

describe('GET /targets → canPublishUrgent (spec §7.5)', () => {
  it('is true for admin and principal, false for an office publisher and an HOD', async () => {
    expect((await api.as(fx.admin.token).get(`${A}/targets`).expect(200)).body.canPublishUrgent).toBe(true);
    expect((await api.as(fx.principal.token).get(`${A}/targets`).expect(200)).body.canPublishUrgent).toBe(true);
    const registrar = await createStaffPublisher(fx, 'ST-REG');
    expect((await api.as(registrar.token).get(`${A}/targets`).expect(200)).body.canPublishUrgent).toBe(false);
    const hod = await makeHod(fx, fx.cse);
    expect((await api.as(hod.token).get(`${A}/targets`).expect(200)).body.canPublishUrgent).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd backend && npx vitest run src/shared/rbac/__tests__/defaults-notices.test.ts src/models/juvi/__tests__/notification-models.schema.test.ts && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-urgent.e2e.test.ts`
Expected: FAIL — `urgentRows` is `[]` and HOD is allowed (its `*` row); the Urgent notice validates without a reason; the registrar's Urgent publish returns 201; `/targets` has no `canPublishUrgent`.

- [ ] **Step 3: Add the policy rows and the validator action**

In `backend/src/shared/rbac/defaults.ts`, replace line 188

```ts
  { role: 'hod', module: 'notices', action: '*', effect: 'allow', priority: 800, isActive: true, description: 'HOD: publish Juvi notices to own department' },
```

with

```ts
  // Urgent (notifications spec §6.5): admin and principal only. Admin also holds *:*; HOD rows name their actions so a wildcard never grants it.
  { role: 'admin', module: 'notices', action: 'urgent', effect: 'allow', priority: 950, isActive: true, description: 'Admin: publish Urgent Juvi notices' },
  { role: 'principal', module: 'notices', action: 'urgent', effect: 'allow', priority: 900, isActive: true, description: 'Principal: publish Urgent Juvi notices' },
  { role: 'hod', module: 'notices', action: 'read', effect: 'allow', priority: 800, isActive: true, description: 'HOD: read own department Juvi notices' },
  { role: 'hod', module: 'notices', action: 'create', effect: 'allow', priority: 800, isActive: true, description: 'HOD: publish Juvi notices to own department' },
  { role: 'hod', module: 'notices', action: 'update', effect: 'allow', priority: 800, isActive: true, description: 'HOD: remind and archive own Juvi notices' },
```

In `backend/src/modules/platform/validation.ts`, replace line 130:

```ts
  // 'urgent' is only meaningful on module 'notices' (Juvi notifications spec §6.5).
  action: z.enum(['read', 'create', 'update', 'delete', 'approve', 'urgent', '*']),
```

- [ ] **Step 4: Refuse a new Urgent notice without a reason in the model**

In `backend/src/models/juvi/Notice.ts`, inside `schema.pre('validate', …)` after the `ackDeadline` line (line 102):

```ts
  // New Urgent notices carry a reason; Urgent notices published before the gate are left alone (spec §6.5).
  if (this.isNew && this.priority === 'urgent' && (this.urgentReason ?? '').length < URGENT_REASON_MIN) {
    this.invalidate('urgentReason', `An Urgent notice needs a reason of at least ${URGENT_REASON_MIN} characters`);
  }
```

- [ ] **Step 5: Create the gate**

```ts
// backend/src/modules/juvi-app/notices/urgent-gate.ts
/**
 * Who may publish Urgent (notifications spec §6.5): the admin roles, or anyone a
 * policy grants `notices:urgent`. Evaluated whatever RBAC_ENFORCE says — like the
 * audience scope in scope.ts it is a publishing rule, not a route gate.
 */
import { AppError } from '../../../middleware/errorHandler';
import { evaluateAccess } from '../../../shared/rbac/engine';
import { personaCodesOf } from '../../../shared/rbac/persona-registry';
import { ErpUserRef } from './publisher-scope';

export const URGENT_ROLES: ReadonlySet<string> = new Set(['admin', 'super_admin']);
/** The policy action; `Policy.action` is a free string, so `notices:urgent` is an ordinary policy row. */
export const URGENT_ACTION = 'urgent';

export async function canPublishUrgent(collegeId: string, user: ErpUserRef): Promise<boolean> {
  if (URGENT_ROLES.has(user.role)) return true;
  const policy = await evaluateAccess(collegeId, user.role, personaCodesOf(user), 'notices', URGENT_ACTION);
  return policy?.effect === 'allow';
}

/** ERP error shape `{ error, detail: { code: 'URGENT_NOT_ALLOWED' } }`. */
export const urgentNotAllowed = () =>
  new AppError(403, 'Only an IT admin can publish Urgent notices. Choose Routine or Important, or ask an IT admin.', { code: 'URGENT_NOT_ALLOWED' });

export async function assertUrgentAllowed(collegeId: string, user: ErpUserRef, priority: string): Promise<void> {
  if (priority === 'urgent' && !(await canPublishUrgent(collegeId, user))) throw urgentNotAllowed();
}
```

- [ ] **Step 6: Accept and store the two fields**

`backend/src/modules/juvi-app/notices/admin-schemas.ts` — extend the `Notice` import (line 4):

```ts
  NOTICE_TITLE_MAX, NOTICE_BODY_MAX, NOTICE_ATTACHMENTS_MAX, NOTICE_ATTACHMENT_MAX_BYTES, URGENT_REASON_MIN, URGENT_REASON_MAX,
```

after `priority: z.enum(tuple(NOTICE_PRIORITIES)).default('routine'),` (line 49):

```ts
  /** The phone notification says only "New notice from <office>" (notifications spec §1, §6.6). Fixed once published. */
  confidential: z.boolean().default(false),
  /** Required with `priority: 'urgent'`, stored on the notice and in the publish audit entry (spec §6.5); ignored otherwise. */
  urgentReason: z.string().trim().min(URGENT_REASON_MIN).max(URGENT_REASON_MAX).optional(),
```

and inside `.superRefine`, after the welcome-deadline issue (line 58):

```ts
  if (b.priority === 'urgent' && !b.urgentReason) ctx.addIssue({ code: 'custom', path: ['urgentReason'], message: `An Urgent notice needs a reason (${URGENT_REASON_MIN}–${URGENT_REASON_MAX} characters)` });
```

`backend/src/modules/juvi-app/notices/publish-service.ts` — in `publishNotice`'s `Notice.create`, after `ackCommentAllowed: input.ackCommentAllowed, priority: input.priority, purpose: input.purpose,` (line 119):

```ts
    confidential: input.confidential, urgentReason: input.priority === 'urgent' ? input.urgentReason ?? null : null,
```

and in the publish audit `changes`, after the `audience` entry (line 130):

```ts
      { field: 'priority', displayName: 'Priority', oldValue: null, newValue: notice.priority },
      // The Urgent reason and the Confidential flag are shown on the portal's Audit tab (notifications spec §6.5, §9).
      ...(notice.urgentReason ? [{ field: 'urgentReason', displayName: 'Urgent reason', oldValue: null, newValue: notice.urgentReason }] : []),
      ...(notice.confidential ? [{ field: 'confidential', displayName: 'Confidential', oldValue: null, newValue: true }] : []),
```

- [ ] **Step 7: Enforce the gate and expose the flags in the admin console**

`backend/src/modules/juvi-app/notices/admin-controller.ts` — after the `getJuviConfig` import (line 16):

```ts
import { canPublishUrgent, assertUrgentAllowed } from './urgent-gate';
```

In `targets` (lines 47-58), load the flag with the other two and return it after `timezone`:

```ts
    const [graph, cfg, urgent] = await Promise.all([loadAudienceGraph(cid(req)), getJuviConfig(cid(req)), canPublishUrgent(cid(req), userRef(req))]);
```

```ts
      timezone: cfg?.timezone ?? 'Asia/Kolkata',
      // The composer offers Urgent only when this is true (notifications spec §6.5, §9).
      canPublishUrgent: urgent,
```

In `publish`, right after `const body = publishSchema.parse(req.body);` (line 125):

```ts
    await assertUrgentAllowed(cid(req), userRef(req), body.priority);
```

`backend/src/modules/juvi-app/notices/admin-service.ts` — `AdminNoticeDetail` (line 27):

```ts
  ackCommentAllowed: boolean; priority: LeanNotice['priority']; confidential: boolean; urgentReason: string | null; archivedAt: string | null; canManage: boolean;
```

and in `getAdminNotice` (line 97):

```ts
    ackCommentAllowed: n.ackCommentAllowed, priority: n.priority, confidential: n.confidential ?? false, urgentReason: n.urgentReason ?? null,
    archivedAt: iso(n.archivedAt),
```

- [ ] **Step 8: Run the tests**

Run: `cd backend && npx vitest run src/models/juvi src/shared/rbac src/modules/juvi-app/notices && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-urgent.e2e.test.ts src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts src/__e2e__/modules/juvi-notices-publish.e2e.test.ts && npx tsc --noEmit`
Expected: PASS (urgent e2e: 6 tests; the existing admin-notices and publish suites unchanged); typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/juvi-app/notices/urgent-gate.ts backend/src/modules/juvi-app/notices/admin-schemas.ts \
  backend/src/modules/juvi-app/notices/publish-service.ts backend/src/modules/juvi-app/notices/admin-controller.ts \
  backend/src/modules/juvi-app/notices/admin-service.ts backend/src/models/juvi/Notice.ts backend/src/shared/rbac/defaults.ts \
  backend/src/modules/platform/validation.ts backend/src/shared/rbac/__tests__/defaults-notices.test.ts \
  backend/src/models/juvi/__tests__/notification-models.schema.test.ts backend/src/__e2e__/modules/juvi-notifications-urgent.e2e.test.ts
git commit -m "feat(juvi-app): Urgent gate (notices:urgent, recorded reason) and the Confidential flag on publish

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Push transports, receipt tokens and the startup guard

**Files:**
- Create: `backend/src/modules/juvi-app/notifications/transport/types.ts`, `transport/fake.ts`, `transport/fcm.ts`, `transport/index.ts`, `backend/src/modules/juvi-app/notifications/receipts.ts` (signing half; Task 8 adds `applyReceipts`)
- Modify: `backend/src/modules/juvi-app/startup-guard.ts` (whole file); `backend/package.json` and `package-lock.json` (`firebase-admin`); `.env.example:34`, `backend/.env.example:54`; `.github/workflows/e2e.yml:68`
- Test: `backend/src/modules/juvi-app/notifications/__tests__/transport.test.ts`, `__tests__/receipts.test.ts`, `backend/src/modules/juvi-app/__tests__/startup-guard.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  // transport/types.ts
  export type PushPriority = 'high' | 'normal';
  export interface PushMessage { data: Record<string, string>; priority: PushPriority; collapseKey: string }
  export type PushErrorCode = 'UNREGISTERED' | 'INVALID_ARGUMENT' | 'UNAVAILABLE' | 'INTERNAL' | 'QUOTA_EXCEEDED' | 'UNKNOWN';
  export interface PushResult { token: string; ok: boolean; error?: PushErrorCode }
  export interface PushTransport { readonly name: 'fcm' | 'fake'; send(tokens: string[], message: PushMessage): Promise<PushResult[]> }
  export const TOKEN_ERRORS: ReadonlySet<PushErrorCode>;   // UNREGISTERED, INVALID_ARGUMENT
  // transport/fake.ts
  export class FakePushTransport implements PushTransport { sent: { tokens: string[]; message: PushMessage }[]; failToken(token, code): void; reset(): void }
  // transport/fcm.ts
  export const FCM_MULTICAST_MAX = 500; export function mapFcmError(code?: string): PushErrorCode; export class FcmPushTransport { constructor(serviceAccountJson: string) }
  // transport/index.ts (re-exports types.ts and FakePushTransport)
  export function getPushTransport(env?: NodeJS.ProcessEnv): Promise<PushTransport>;
  export function setPushTransport(transport: PushTransport | null): void;
  export function pushTransportWarning(env?: NodeJS.ProcessEnv): string | null;
  // receipts.ts
  export const RECEIPT_TTL_MS = 7 * 86_400_000;
  export function receiptKey(env?: NodeJS.ProcessEnv): Buffer;
  export function signReceipt(deliveryId: string, expiresAt: Date, key?: Buffer): string;
  export function verifyReceipt(deliveryId: string, receipt: string, now?: Date, key?: Buffer): boolean;
  // startup-guard.ts: juviStartupProblems(env) also checks JUVI_RECEIPT_KEY, FIREBASE_SERVICE_ACCOUNT_JSON, JUVI_PUSH_REQUIRED
  ```

`getPushTransport` imports `fcm.ts` with a dynamic `import()`, so `firebase-admin` is loaded only by a process that has credentials. The fake transport logs one line per send (kind, notice id, priority — never the title) outside tests. Rulings 16 and 19 apply.

- [ ] **Step 1: Add the dependency**

Run: `npm install firebase-admin@^13.10.0 -w backend`
Expected: `backend/package.json` gains `"firebase-admin": "^13.10.0"` between `express-rate-limit` and `helmet`; `package-lock.json` is updated (13.10.0 at the time of the dry run).

- [ ] **Step 2: Write the failing tests**

```ts
// backend/src/modules/juvi-app/notifications/__tests__/transport.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fb = vi.hoisted(() => ({
  apps: [] as { name: string }[],
  initializeApp: vi.fn((_opts: unknown, name: string) => ({ name })),
  cert: vi.fn((sa: unknown) => ({ sa })),
  sendEachForMulticast: vi.fn(),
}));
vi.mock('firebase-admin/app', () => ({ initializeApp: fb.initializeApp, cert: fb.cert, getApps: () => fb.apps }));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEachForMulticast: fb.sendEachForMulticast }) }));

import { FakePushTransport, getPushTransport, setPushTransport, pushTransportWarning, PushMessage } from '../transport';
import { FcmPushTransport, mapFcmError, FCM_MULTICAST_MAX } from '../transport/fcm';

const SA = JSON.stringify({ project_id: 'juvi-test', client_email: 'push@juvi-test.iam.gserviceaccount.com', private_key: 'k' });
const msg: PushMessage = { data: { kind: 'notice', noticeId: 'n1', tier: 'important' }, priority: 'high', collapseKey: 'notice:n1' };

beforeEach(() => { vi.clearAllMocks(); setPushTransport(null); fb.apps = []; });

describe('FakePushTransport', () => {
  it('records every message and accepts every token unless told otherwise', async () => {
    const t = new FakePushTransport();
    t.failToken('dead', 'UNREGISTERED');
    expect(await t.send(['a', 'dead'], msg)).toEqual([{ token: 'a', ok: true }, { token: 'dead', ok: false, error: 'UNREGISTERED' }]);
    expect(t.sent).toEqual([{ tokens: ['a', 'dead'], message: msg }]);
    t.reset();
    expect(t.sent).toEqual([]);
    expect(await t.send(['dead'], msg)).toEqual([{ token: 'dead', ok: true }]);
  });
});

describe('FcmPushTransport', () => {
  it('sends one data-only multicast with the Android priority and collapse key, and maps per-token errors', async () => {
    fb.sendEachForMulticast.mockResolvedValue({
      successCount: 1, failureCount: 2,
      responses: [
        { success: true, messageId: 'm1' },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: false, error: { code: 'messaging/server-unavailable' } },
      ],
    });
    const t = new FcmPushTransport(SA);
    expect(fb.initializeApp).toHaveBeenCalledWith({ credential: { sa: JSON.parse(SA) } }, 'juvi-push');
    const res = await t.send(['a', 'b', 'c'], msg);
    expect(fb.sendEachForMulticast).toHaveBeenCalledWith({ tokens: ['a', 'b', 'c'], data: msg.data, android: { priority: 'high', collapseKey: 'notice:n1' } });
    expect(res).toEqual([{ token: 'a', ok: true }, { token: 'b', ok: false, error: 'UNREGISTERED' }, { token: 'c', ok: false, error: 'UNAVAILABLE' }]);
  });

  it('reuses the named app, chunks at 500 tokens, and turns a failed call into retryable errors', async () => {
    fb.apps = [{ name: 'juvi-push' }];
    fb.sendEachForMulticast.mockImplementation(async ({ tokens }: { tokens: string[] }) => ({ responses: tokens.map(() => ({ success: true })) }));
    const t = new FcmPushTransport(SA);
    expect(fb.initializeApp).not.toHaveBeenCalled();
    const tokens = Array.from({ length: FCM_MULTICAST_MAX + 1 }, (_, i) => `t${i}`);
    expect((await t.send(tokens, msg)).every((r) => r.ok)).toBe(true);
    expect(fb.sendEachForMulticast).toHaveBeenCalledTimes(2);

    fb.sendEachForMulticast.mockRejectedValueOnce(Object.assign(new Error('socket hang up'), { code: 'app/network-error' }));
    expect(await t.send(['x'], msg)).toEqual([{ token: 'x', ok: false, error: 'UNAVAILABLE' }]);
  });

  it('maps the FCM codes the sender cares about', () => {
    expect(mapFcmError('messaging/invalid-registration-token')).toBe('INVALID_ARGUMENT');
    expect(mapFcmError('messaging/invalid-argument')).toBe('INVALID_ARGUMENT');
    expect(mapFcmError('messaging/internal-error')).toBe('INTERNAL');
    expect(mapFcmError('messaging/quota-exceeded')).toBe('QUOTA_EXCEEDED');
    expect(mapFcmError('messaging/third-party-auth-error')).toBe('UNKNOWN');
    expect(mapFcmError(undefined)).toBe('UNKNOWN');
  });
});

describe('getPushTransport (spec §10)', () => {
  it('is the fake, with a warning, when FIREBASE_SERVICE_ACCOUNT_JSON is unset', async () => {
    expect((await getPushTransport({ NODE_ENV: 'test' })).name).toBe('fake');
    expect(pushTransportWarning({})).toMatch(/FIREBASE_SERVICE_ACCOUNT_JSON is not set/);
  });

  it('is FCM when the service account is set, and stays selected', async () => {
    const t = await getPushTransport({ FIREBASE_SERVICE_ACCOUNT_JSON: SA });
    expect(t.name).toBe('fcm');
    expect(await getPushTransport({})).toBe(t);
    expect(pushTransportWarning({ FIREBASE_SERVICE_ACCOUNT_JSON: SA })).toBeNull();
  });

  it('setPushTransport installs a test transport', async () => {
    const fake = new FakePushTransport();
    setPushTransport(fake);
    expect(await getPushTransport({ FIREBASE_SERVICE_ACCOUNT_JSON: SA })).toBe(fake);
  });
});
```

```ts
// backend/src/modules/juvi-app/notifications/__tests__/receipts.test.ts
import { describe, it, expect } from 'vitest';
import { signReceipt, verifyReceipt, receiptKey, RECEIPT_TTL_MS } from '../receipts';

const key = Buffer.from('k'.repeat(32));
const now = new Date('2026-10-02T12:00:00Z');
const id = '6a1b2c3d4e5f6a7b8c9d0e1f';

describe('receipt tokens (spec §7.2)', () => {
  it('is base64url(HMAC-SHA256(deliveryId + "." + expiry)) + "." + expiry and verifies until it expires', () => {
    const receipt = signReceipt(id, new Date(now.getTime() + RECEIPT_TTL_MS), key);
    expect(receipt).toMatch(/^[A-Za-z0-9_-]{43}\.\d+$/);
    expect(receipt.split('.')[1]).toBe(String(Math.floor((now.getTime() + RECEIPT_TTL_MS) / 1000)));
    expect(verifyReceipt(id, receipt, now, key)).toBe(true);
    expect(verifyReceipt(id, receipt, new Date(now.getTime() + RECEIPT_TTL_MS + 1000), key)).toBe(false);
  });

  it('authorises exactly one row, and refuses a forged MAC, a moved expiry or another key', () => {
    const receipt = signReceipt(id, new Date(now.getTime() + RECEIPT_TTL_MS), key);
    const [mac, expiry] = receipt.split('.') as [string, string];
    expect(verifyReceipt('6a1b2c3d4e5f6a7b8c9d0e20', receipt, now, key)).toBe(false);
    expect(verifyReceipt(id, `${mac}.${Number(expiry) + 86_400}`, now, key)).toBe(false);
    expect(verifyReceipt(id, `${'A'.repeat(43)}.${expiry}`, now, key)).toBe(false);
    expect(verifyReceipt(id, receipt, now, Buffer.from('x'.repeat(32)))).toBe(false);
    for (const junk of ['', '.', 'abc', `${mac}.`, `${mac}.12x`, `.${expiry}`]) expect(verifyReceipt(id, junk, now, key), junk).toBe(false);
  });

  it('uses JUVI_RECEIPT_KEY, or derives a stable development key from JWT_SECRET', () => {
    expect(receiptKey({ JUVI_RECEIPT_KEY: 'k'.repeat(32) })).toEqual(key);
    const a = receiptKey({ JWT_SECRET: 'dev-secret' });
    expect(a).toHaveLength(32);
    expect(receiptKey({ JWT_SECRET: 'dev-secret' })).toEqual(a);
    expect(receiptKey({ JWT_SECRET: 'other' })).not.toEqual(a);
  });
});
```

Replace `backend/src/modules/juvi-app/__tests__/startup-guard.test.ts`:

```ts
// backend/src/modules/juvi-app/__tests__/startup-guard.test.ts
import { describe, it, expect } from 'vitest';
import { juviStartupProblems } from '../startup-guard';

const CRED = Buffer.alloc(32, 1).toString('base64');
const RECEIPT = 'r'.repeat(32);
const SA = JSON.stringify({ project_id: 'juvi-test', client_email: 'push@juvi-test.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\n...' });

describe('juviStartupProblems', () => {
  it('requires JUVI_CREDENTIAL_KEY and JUVI_RECEIPT_KEY in production only', () => {
    expect(juviStartupProblems({ NODE_ENV: 'production' })).toEqual([
      'JUVI_CREDENTIAL_KEY must be set in production (32 bytes, base64)',
      'JUVI_RECEIPT_KEY must be set in production (at least 32 characters)',
    ]);
    expect(juviStartupProblems({ NODE_ENV: 'production', JUVI_CREDENTIAL_KEY: CRED, JUVI_RECEIPT_KEY: RECEIPT })).toEqual([]);
    expect(juviStartupProblems({ NODE_ENV: 'development' })).toEqual([]);
  });
  it('rejects a key of the wrong length anywhere', () => {
    expect(juviStartupProblems({ NODE_ENV: 'development', JUVI_CREDENTIAL_KEY: 'c2hvcnQ=' })).toEqual(['JUVI_CREDENTIAL_KEY must decode to exactly 32 bytes']);
    expect(juviStartupProblems({ NODE_ENV: 'development', JUVI_RECEIPT_KEY: 'short' })).toEqual(['JUVI_RECEIPT_KEY must be at least 32 characters']);
  });
  it('requires Firebase credentials in production only when JUVI_PUSH_REQUIRED=true', () => {
    const prod = { NODE_ENV: 'production', JUVI_CREDENTIAL_KEY: CRED, JUVI_RECEIPT_KEY: RECEIPT };
    expect(juviStartupProblems(prod)).toEqual([]);
    expect(juviStartupProblems({ ...prod, JUVI_PUSH_REQUIRED: 'true' })).toEqual(['FIREBASE_SERVICE_ACCOUNT_JSON must be set when JUVI_PUSH_REQUIRED=true']);
    expect(juviStartupProblems({ ...prod, JUVI_PUSH_REQUIRED: 'true', FIREBASE_SERVICE_ACCOUNT_JSON: SA })).toEqual([]);
  });
  it('rejects Firebase credentials that are not a service-account JSON', () => {
    const problem = 'FIREBASE_SERVICE_ACCOUNT_JSON must be a service-account JSON with project_id, client_email and private_key';
    expect(juviStartupProblems({ NODE_ENV: 'development', FIREBASE_SERVICE_ACCOUNT_JSON: 'not json' })).toEqual([problem]);
    expect(juviStartupProblems({ NODE_ENV: 'development', FIREBASE_SERVICE_ACCOUNT_JSON: '{"project_id":"x"}' })).toEqual([problem]);
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/notifications src/modules/juvi-app/__tests__/startup-guard.test.ts`
Expected: FAIL — `Failed to load url ../transport` and `../receipts`; the guard returns only the credential-key problem.

- [ ] **Step 4: Create the transports**

```ts
// backend/src/modules/juvi-app/notifications/transport/types.ts
/**
 * The push transport (notifications spec §5.3, §5.1). The sender talks only to
 * this interface; `fcm.ts` is the one file that imports firebase-admin.
 */
export type PushPriority = 'high' | 'normal';

/** An FCM data-only message: every value is a string (spec §6.6). */
export interface PushMessage {
  data: Record<string, string>;
  priority: PushPriority;
  collapseKey: string;
}

/** FCM's error codes, normalised. UNKNOWN is treated as transient. */
export type PushErrorCode = 'UNREGISTERED' | 'INVALID_ARGUMENT' | 'UNAVAILABLE' | 'INTERNAL' | 'QUOTA_EXCEEDED' | 'UNKNOWN';

export interface PushResult { token: string; ok: boolean; error?: PushErrorCode }

export interface PushTransport {
  readonly name: 'fcm' | 'fake';
  /** One result per token, in order. Never throws for a per-token failure. */
  send(tokens: string[], message: PushMessage): Promise<PushResult[]>;
}

/** A token rejected with one of these is dead: its session's `pushToken` is cleared (spec §5.3). */
export const TOKEN_ERRORS: ReadonlySet<PushErrorCode> = new Set<PushErrorCode>(['UNREGISTERED', 'INVALID_ARGUMENT']);
```

```ts
// backend/src/modules/juvi-app/notifications/transport/fake.ts
import { PushErrorCode, PushMessage, PushResult, PushTransport } from './types';

/**
 * The transport used when FIREBASE_SERVICE_ACCOUNT_JSON is unset (spec §10) and in
 * tests. It records every message and can be told to fail particular tokens. Its
 * log line carries the kind, ids and priority only, never the title.
 */
export class FakePushTransport implements PushTransport {
  readonly name = 'fake' as const;
  readonly sent: { tokens: string[]; message: PushMessage }[] = [];
  private readonly failures = new Map<string, PushErrorCode>();

  constructor(private readonly log = false) {}

  /** Every later send to `token` fails with `code`. */
  failToken(token: string, code: PushErrorCode): void { this.failures.set(token, code); }

  reset(): void {
    this.sent.length = 0;
    this.failures.clear();
  }

  async send(tokens: string[], message: PushMessage): Promise<PushResult[]> {
    this.sent.push({ tokens: [...tokens], message });
    if (this.log) console.log(`[juvi-push:fake] ${tokens.length} device(s): ${message.data.kind ?? 'notice'} ${message.data.noticeId ?? ''} (${message.priority})`);
    return tokens.map((token) => {
      const error = this.failures.get(token);
      return error ? { token, ok: false, error } : { token, ok: true };
    });
  }
}
```

```ts
// backend/src/modules/juvi-app/notifications/transport/fcm.ts
/**
 * Firebase Cloud Messaging (Android). The only module that imports
 * firebase-admin (spec §5.1). One named app per process, built from the
 * service-account JSON in FIREBASE_SERVICE_ACCOUNT_JSON.
 */
import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PushErrorCode, PushMessage, PushResult, PushTransport } from './types';

const APP_NAME = 'juvi-push';
/** FCM's sendEachForMulticast limit. */
export const FCM_MULTICAST_MAX = 500;

const CODES: Record<string, PushErrorCode> = {
  'messaging/registration-token-not-registered': 'UNREGISTERED',
  'messaging/invalid-registration-token': 'INVALID_ARGUMENT',
  'messaging/invalid-argument': 'INVALID_ARGUMENT',
  'messaging/server-unavailable': 'UNAVAILABLE',
  'messaging/unavailable': 'UNAVAILABLE',
  'messaging/internal-error': 'INTERNAL',
  'messaging/quota-exceeded': 'QUOTA_EXCEEDED',
  'messaging/message-rate-exceeded': 'QUOTA_EXCEEDED',
  'messaging/device-message-rate-exceeded': 'QUOTA_EXCEEDED',
};

export function mapFcmError(code: string | undefined): PushErrorCode {
  return (code && CODES[code]) || 'UNKNOWN';
}

export class FcmPushTransport implements PushTransport {
  readonly name = 'fcm' as const;
  private readonly app: App;

  constructor(serviceAccountJson: string) {
    const existing = getApps().find((a) => a.name === APP_NAME);
    this.app = existing ?? initializeApp({ credential: cert(JSON.parse(serviceAccountJson) as ServiceAccount) }, APP_NAME);
  }

  async send(tokens: string[], message: PushMessage): Promise<PushResult[]> {
    const out: PushResult[] = [];
    for (let i = 0; i < tokens.length; i += FCM_MULTICAST_MAX) {
      const chunk = tokens.slice(i, i + FCM_MULTICAST_MAX);
      try {
        const res = await getMessaging(this.app).sendEachForMulticast({
          tokens: chunk,
          data: message.data,
          android: { priority: message.priority, collapseKey: message.collapseKey },
        });
        res.responses.forEach((r, j) => {
          const token = chunk[j]!;
          out.push(r.success ? { token, ok: true } : { token, ok: false, error: mapFcmError(r.error?.code) });
        });
      } catch (err) {
        // The whole call failed (network, auth): every token in the chunk is retried later.
        const code = mapFcmError((err as { code?: string } | null)?.code);
        for (const token of chunk) out.push({ token, ok: false, error: code === 'UNKNOWN' ? 'UNAVAILABLE' : code });
      }
    }
    return out;
  }
}
```

```ts
// backend/src/modules/juvi-app/notifications/transport/index.ts
/**
 * Picks the push transport from the environment (spec §10): FCM when
 * FIREBASE_SERVICE_ACCOUNT_JSON is set, otherwise the fake (logging) transport.
 * fcm.ts is loaded lazily so firebase-admin stays out of processes that never push.
 */
import { FakePushTransport } from './fake';
import { PushTransport } from './types';

export * from './types';
export { FakePushTransport } from './fake';

let current: PushTransport | null = null;

export async function getPushTransport(env: NodeJS.ProcessEnv = process.env): Promise<PushTransport> {
  if (current) return current;
  const json = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const { FcmPushTransport } = await import('./fcm');
    current = new FcmPushTransport(json);
  } else {
    current = new FakePushTransport(env.NODE_ENV !== 'test');
  }
  return current;
}

/** Tests install a FakePushTransport here; null re-selects from the environment on the next send. */
export function setPushTransport(transport: PushTransport | null): void { current = transport; }

/** The startup warning when no Firebase credentials are configured, or null. */
export function pushTransportWarning(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? null
    : 'FIREBASE_SERVICE_ACCOUNT_JSON is not set: Juvi push notifications use the fake (logging) transport and reach no phone.';
}
```

- [ ] **Step 5: Create the receipt tokens**

```ts
// backend/src/modules/juvi-app/notifications/receipts.ts
/**
 * Delivery receipts (notifications spec §7.2). A receipt is
 * `base64url(HMAC-SHA256(key, deliveryId + '.' + expiry)) + '.' + expiry`, expiry in
 * Unix seconds seven days after sending. It authorises exactly one row, so the
 * app can post `delivered` from a background isolate with no live session.
 */
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

export const RECEIPT_TTL_MS = 7 * 86_400_000;

/** JUVI_RECEIPT_KEY, or in development an HKDF derivation of JWT_SECRET (production requires the key; see startup-guard.ts). */
export function receiptKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  if (env.JUVI_RECEIPT_KEY) return Buffer.from(env.JUVI_RECEIPT_KEY, 'utf8');
  return Buffer.from(hkdfSync('sha256', env.JWT_SECRET || 'dev-secret', '', 'juvi-receipt-v1', 32));
}

const mac = (key: Buffer, deliveryId: string, expiry: string) => createHmac('sha256', key).update(`${deliveryId}.${expiry}`).digest();

export function signReceipt(deliveryId: string, expiresAt: Date, key: Buffer = receiptKey()): string {
  const expiry = String(Math.floor(expiresAt.getTime() / 1000));
  return `${mac(key, deliveryId, expiry).toString('base64url')}.${expiry}`;
}

export function verifyReceipt(deliveryId: string, receipt: string, now: Date = new Date(), key: Buffer = receiptKey()): boolean {
  const dot = receipt.lastIndexOf('.');
  if (dot <= 0) return false;
  const given = Buffer.from(receipt.slice(0, dot), 'base64url');
  const expiry = receipt.slice(dot + 1);
  if (!/^\d{1,12}$/.test(expiry) || Number(expiry) * 1000 < now.getTime()) return false;
  const expected = mac(key, deliveryId, expiry);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
```

- [ ] **Step 6: Extend the startup guard**

Replace `backend/src/modules/juvi-app/startup-guard.ts` (it is called from `backend/src/app.ts:67`, which exits on any problem):

```ts
// backend/src/modules/juvi-app/startup-guard.ts
export function juviStartupProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  const production = env.NODE_ENV === 'production';
  const key = env.JUVI_CREDENTIAL_KEY;
  if (production && !key) problems.push('JUVI_CREDENTIAL_KEY must be set in production (32 bytes, base64)');
  if (key && Buffer.from(key, 'base64').length !== 32) problems.push('JUVI_CREDENTIAL_KEY must decode to exactly 32 bytes');

  // Notification receipts are HMAC-signed with it (notifications spec §7.2, §10).
  const receiptKey = env.JUVI_RECEIPT_KEY;
  if (production && !receiptKey) problems.push('JUVI_RECEIPT_KEY must be set in production (at least 32 characters)');
  if (receiptKey && receiptKey.length < 32) problems.push('JUVI_RECEIPT_KEY must be at least 32 characters');

  const firebase = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (production && env.JUVI_PUSH_REQUIRED === 'true' && !firebase) problems.push('FIREBASE_SERVICE_ACCOUNT_JSON must be set when JUVI_PUSH_REQUIRED=true');
  if (firebase) {
    let ok = false;
    try {
      const sa = JSON.parse(firebase) as Record<string, unknown>;
      ok = typeof sa.project_id === 'string' && typeof sa.client_email === 'string' && typeof sa.private_key === 'string';
    } catch { /* not JSON */ }
    if (!ok) problems.push('FIREBASE_SERVICE_ACCOUNT_JSON must be a service-account JSON with project_id, client_email and private_key');
  }
  return problems;
}
```

- [ ] **Step 7: Document the variables and keep CI starting**

Append to both `.env.example` (after line 34) and `backend/.env.example` (after line 54):

```
# Juvi notifications
JUVI_RECEIPT_KEY=               # HMAC key for notification receipts, at least 32 characters (openssl rand -base64 32). Required in production; dev derives one from JWT_SECRET.
FIREBASE_SERVICE_ACCOUNT_JSON=  # the Firebase service-account JSON as one string. Unset = the fake (logging) push transport, with a startup warning.
JUVI_PUSH_REQUIRED=             # 'true' makes FIREBASE_SERVICE_ACCOUNT_JSON required in production
```

`.github/workflows/e2e.yml` starts the backend with `NODE_ENV=production`; after `JUVI_CREDENTIAL_KEY: …` (line 68) add:

```yaml
      # Dummy notification-receipt HMAC key (at least 32 characters) for the
      # same guard. Push uses the fake transport: FIREBASE_SERVICE_ACCOUNT_JSON is unset.
      JUVI_RECEIPT_KEY: 'ci-dummy-receipt-key-0123456789abcdef'
```

- [ ] **Step 8: Run the tests**

Run: `cd backend && npx vitest run src/modules/juvi-app/notifications src/modules/juvi-app/__tests__/startup-guard.test.ts && npx tsc --noEmit`
Expected: PASS (transport 7, receipts 3, startup guard 4, policy unchanged); typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add backend/package.json package-lock.json backend/src/modules/juvi-app/notifications/transport backend/src/modules/juvi-app/notifications/receipts.ts \
  backend/src/modules/juvi-app/notifications/__tests__/transport.test.ts backend/src/modules/juvi-app/notifications/__tests__/receipts.test.ts \
  backend/src/modules/juvi-app/startup-guard.ts backend/src/modules/juvi-app/__tests__/startup-guard.test.ts \
  .env.example backend/.env.example .github/workflows/e2e.yml
git commit -m "feat(juvi-app): push transports (fake, FCM via firebase-admin), HMAC receipt tokens, startup guard for the new keys

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `notification.requested` from fan-out and reminders, and the expand consumer

**Files:**
- Create: `backend/src/modules/juvi-app/notifications/expand-consumer.ts`, `backend/src/modules/juvi-app/notifications/index.ts`, `backend/src/__e2e__/factories/notification.factory.ts`
- Modify: `backend/src/modules/juvi-app/notices/consumers.ts:14`, `:39-44`, `:49`, `:86-87`, `:137-143`; `backend/src/modules/juvi-app/notices/publish-service.ts:158`; `backend/src/modules/juvi-app/routes.ts:7-11`
- Test: `backend/src/__e2e__/modules/juvi-notifications-expand.e2e.test.ts`

**Interfaces:**
- Consumes: `NotificationDelivery`, `NotificationSourceKind`, `NotificationTier` (Task 1); `decide`, `digestSendAfter`, `PolicySettings` (Task 2); `emit`, `registerConsumer`, `OutboxPayload` (`backend/src/shared/outbox`); `getJuviConfig(collegeId)` (`modules/juvi-app/config/institution-config.ts`); `IAccountSettings` (`models/juvi/JuviAccount.ts`); `ChannelMembership.mutedAt`.
- Produces:
  ```ts
  // notifications/expand-consumer.ts
  export const NOTIFICATION_REQUESTED = 'notification.requested';
  export const EXPAND_BATCH_SIZE = 1000;
  export function __setExpandBatchSizeForTesting(n: number | null): void;
  export const notificationKey: { published(noticeId): string; reminder(noticeId, n): string; addedLater(noticeId, accountId): string };
  export const batchKeyOf: (notice: Pick<LeanNotice, 'publisher'>) => string;   // `office:<office>`
  export const groupKeyOf: (noticeId: string) => string;                       // `notice:<id>`
  export interface NotificationSource { type: 'notice'; id: string; kind: NotificationSourceKind }
  export function requestNoticeNotification(collegeId: string, noticeId: string, kind: NotificationSourceKind, accountId?: string): Promise<boolean>;
  export function expandNotification(payload: OutboxPayload, now?: Date): Promise<number>;   // rows walked
  // notifications/index.ts
  export function registerNotificationConsumers(): void;   // + re-exports requestNoticeNotification, notificationKey, NOTIFICATION_REQUESTED
  // __e2e__/factories/notification.factory.ts
  export function studentOnJuvi(app: Express, fx: BaseFixtures, opts?: { pushToken?: string }): Promise<{ person; student; account; tempPassword; accessToken; deviceId }>;
  export function quietHoursAround(now: Date, timeZone?: string): { start: string; end: string };
  export function deliveriesFor(noticeId: unknown, kind?: string): Promise<LeanNotificationDelivery[]>;
  export function deliveryOf(noticeId: unknown, accountId: unknown, kind?: string): Promise<LeanNotificationDelivery | null>;
  // notice.reminder payload gains n: number
  ```

The expansion reads only `NoticeRecipient` rows with an `accountId` ("on Juvi"); a reminder adds `ack: null, dismissedAt: null`. A notice that is not `published` (archived, or still publishing) expands to nothing. Upserts use `$setOnInsert` with `timestamps: false`, so a re-run leaves every existing row byte-for-byte unchanged. Rulings 5, 6, 7 and 9 apply. `studentOnJuvi` gives each student an empty quiet-hours window (`00:00–00:00`) so no test depends on the time of day.

- [ ] **Step 1: Write the factory and the failing test**

```ts
// backend/src/__e2e__/factories/notification.factory.ts
import type { Express } from 'express';
import { Types } from 'mongoose';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { MobileSession } from '../../models/juvi/MobileSession';
import { NotificationDelivery, LeanNotificationDelivery } from '../../models/juvi/NotificationDelivery';
import type { BaseFixtures } from '../setup/seed-base';
import { provisionTestStudent } from './juvi.factory';
import { activateAccount, signInAs } from './notice.factory';

let deviceCounter = 0;

/**
 * A batch student on Juvi (active), signed in on a fresh device, with an empty quiet-hours
 * window so the test does not depend on the time of day. `pushToken` registers that device.
 */
export async function studentOnJuvi(app: Express, fx: BaseFixtures, opts: { pushToken?: string } = {}) {
  const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  await activateAccount(String(s.account._id));
  await JuviAccount.updateOne({ _id: s.account._id }, { $set: { 'settings.quietHours': { start: '00:00', end: '00:00' } } });
  deviceCounter += 1;
  const deviceId = `notif-device-${deviceCounter}`;
  const accessToken = await signInAs(app, fx, s.student.rollNumber, s.tempPassword, deviceId);
  if (opts.pushToken) await MobileSession.updateOne({ accountId: s.account._id, deviceId, revokedAt: null }, { $set: { pushToken: opts.pushToken } });
  return { ...s, accessToken, deviceId };
}

/** Quiet hours from one hour before to one hour after `now`, in the college timezone (Asia/Kolkata unless configured). */
export function quietHoursAround(now: Date, timeZone = 'Asia/Kolkata'): { start: string; end: string } {
  const hh = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return { start: hh(new Date(now.getTime() - 3_600_000)), end: hh(new Date(now.getTime() + 3_600_000)) };
}

export async function deliveriesFor(noticeId: unknown, kind = 'published'): Promise<LeanNotificationDelivery[]> {
  return NotificationDelivery.find({ 'source.id': new Types.ObjectId(String(noticeId)), 'source.kind': kind }).sort({ _id: 1 }).lean<LeanNotificationDelivery[]>();
}

export async function deliveryOf(noticeId: unknown, accountId: unknown, kind = 'published'): Promise<LeanNotificationDelivery | null> {
  return NotificationDelivery.findOne({ 'source.id': new Types.ObjectId(String(noticeId)), 'source.kind': kind, accountId: new Types.ObjectId(String(accountId)) })
    .lean<LeanNotificationDelivery>();
}
```

```ts
// backend/src/__e2e__/modules/juvi-notifications-expand.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Express } from 'express';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient } from '../factories/juvi.factory';
import { publishTestNotice } from '../factories/notice.factory';
import { studentOnJuvi, quietHoursAround, deliveriesFor } from '../factories/notification.factory';
import { Channel } from '../../models/juvi/Channel';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { NotificationDelivery, NotificationSourceKind } from '../../models/juvi/NotificationDelivery';
import { OutboxEvent, drainOutbox } from '../../shared/outbox';
import { archiveNotice, remindNotice } from '../../modules/juvi-app/notices/publish-service';
import { erpActor } from '../../modules/juvi-app/notices/reach-service';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';
import { expandNotification, __setExpandBatchSizeForTesting, batchKeyOf } from '../../modules/juvi-app/notifications/expand-consumer';
import { DIGEST_WINDOW_MS } from '../../modules/juvi-app/notifications/policy';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const REASON = 'Exam postponed by the university';
const near = (d: Date | null | undefined, t: number, slack = 5_000) => Boolean(d) && Math.abs(new Date(d!).getTime() - t) <= slack;
const admin = () => erpActor(fx.collegeId, { id: String(fx.admin.user._id), name: 'Admin', role: 'admin' });

/**
 * The rows exactly as the expansion writes them. The dispatcher pass that expanded them
 * also ran the sender (an afterEvents sweeper), so the rows are rewritten here, at `now`.
 */
async function expanded(noticeId: unknown, kind: NotificationSourceKind = 'published', now = new Date()) {
  const id = String(noticeId);
  await NotificationDelivery.deleteMany({ 'source.id': new Types.ObjectId(id), 'source.kind': kind });
  await expandNotification({ collegeId: fx.collegeId, source: { type: 'notice', id, kind } }, now);
  return deliveriesFor(id, kind);
}
const rowOf = async (noticeId: unknown, accountId: unknown, kind: NotificationSourceKind = 'published') =>
  (await expanded(noticeId, kind)).find((r) => String(r.accountId) === String(accountId));

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterEach(() => { __setExpandBatchSizeForTesting(null); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

describe('notification.requested → one row per person on Juvi (spec §5.1, §5.2)', () => {
  it('fan-out requests the push; each recipient on Juvi gets one scheduled row; re-running changes nothing', async () => {
    const a = await studentOnJuvi(app, fx);
    const b = await studentOnJuvi(app, fx);
    await provisionTestStudent(fx);                                            // Not on Juvi: no row
    const n = await publishTestNotice(fx, { priority: 'important' });
    expect(await OutboxEvent.findOne({ dedupeKey: `notif:notice:${n._id}:published` }).lean()).toMatchObject({ type: 'notification.requested', status: 'done' });
    expect((await deliveriesFor(n._id)).map((r) => String(r.accountId)).sort()).toEqual([String(a.account._id), String(b.account._id)].sort());

    const now = new Date();
    const rows = await expanded(n._id, 'published', now);
    for (const r of rows) {
      expect(r).toMatchObject({ status: 'scheduled', tier: 'important', reason: null, batchKey: batchKeyOf(n), groupKey: `notice:${n._id}`, attempts: 0, lockedUntil: null });
      expect(String(r.collegeId)).toBe(fx.collegeId);
      expect(r.sendAfter).toEqual(now);
    }
    expect(await expandNotification({ collegeId: fx.collegeId, source: { type: 'notice', id: String(n._id), kind: 'published' } })).toBe(2);
    expect(await deliveriesFor(n._id)).toEqual(rows);
  });

  it('walks the recipients in batches', async () => {
    __setExpandBatchSizeForTesting(2);
    for (let i = 0; i < 5; i++) await studentOnJuvi(app, fx);
    const n = await publishTestNotice(fx);
    expect(await deliveriesFor(n._id)).toHaveLength(5);
  });

  it('an archived notice notifies nobody', async () => {
    await studentOnJuvi(app, fx);
    const n = await publishTestNotice(fx);
    await archiveNotice(admin(), String(n._id));
    expect(await expanded(n._id)).toEqual([]);
  });
});

describe('the §6 policy at expansion (NTF-01, NTF-02, PRF-03, SPC-05)', () => {
  it('tier off suppresses Important and Routine, never Urgent', async () => {
    const s = await studentOnJuvi(app, fx);
    await JuviAccount.updateOne({ _id: s.account._id }, { $set: { 'settings.tiers': { important: false, routine: false } } });
    const important = await publishTestNotice(fx, { priority: 'important' });
    const routine = await publishTestNotice(fx, { priority: 'routine' });
    const urgent = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    expect(await rowOf(important._id, s.account._id)).toMatchObject({ status: 'suppressed', reason: 'tier_off' });
    expect(await rowOf(routine._id, s.account._id)).toMatchObject({ status: 'suppressed', reason: 'tier_off' });
    expect(await rowOf(urgent._id, s.account._id)).toMatchObject({ status: 'scheduled', tier: 'urgent', reason: null });
  });

  it('muting every channel the notice appears in suppresses it, except Urgent; a notice in none of their channels cannot be muted', async () => {
    const s = await studentOnJuvi(app, fx);
    await reconcileCollege(fx.collegeId);                                     // creates the batch channel and the membership
    const batchChannel = (await Channel.findOne({ collegeId: fx.collegeId, scopeType: 'batch', scopeId: fx.batch._id }).lean())!;
    await mobileClient(app, s.accessToken).put(`${V1}/channels/${batchChannel._id}/mute`).expect(200);

    const muted = await publishTestNotice(fx, { priority: 'important' });
    expect(muted.channelIds.map(String)).toEqual([String(batchChannel._id)]);
    expect(await rowOf(muted._id, s.account._id)).toMatchObject({ status: 'suppressed', reason: 'muted' });
    const urgent = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    expect(await rowOf(urgent._id, s.account._id)).toMatchObject({ status: 'scheduled' });
    const section = await publishTestNotice(fx, { priority: 'important', audience: { rules: [{ kind: 'section', ids: [String(fx.cseSection._id)] }] } });
    expect(section.channelIds).toEqual([]);
    expect(await rowOf(section._id, s.account._id)).toMatchObject({ status: 'scheduled' });
  });

  it('quiet hours hold Important until the window ends; Urgent goes now', async () => {
    const s = await studentOnJuvi(app, fx);
    const now = new Date();
    await JuviAccount.updateOne({ _id: s.account._id }, { $set: { 'settings.quietHours': quietHoursAround(now) } });
    const important = await publishTestNotice(fx, { priority: 'important' });
    const urgent = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    const held = (await rowOf(important._id, s.account._id))!;
    expect(held.status).toBe('scheduled');
    expect(near(held.sendAfter, now.getTime() + 3_600_000, 61_000)).toBe(true);
    expect(near((await rowOf(urgent._id, s.account._id))!.sendAfter, Date.now(), 30_000)).toBe(true);
  });

  it('a reminder is Important and goes only to those who have not acknowledged or dismissed', async () => {
    const acked = await studentOnJuvi(app, fx);
    const pending = await studentOnJuvi(app, fx);
    const n = await publishTestNotice(fx, { priority: 'routine', ackRequired: true });
    await mobileClient(app, acked.accessToken).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(200);
    await remindNotice(admin(), String(n._id));
    await drainOutbox();
    expect(await OutboxEvent.exists({ dedupeKey: `notif:notice:${n._id}:reminder-1` })).toBeTruthy();
    const rows = await expanded(n._id, 'reminder-1');
    expect(rows.map((r) => String(r.accountId))).toEqual([String(pending.account._id)]);
    expect(rows[0]).toMatchObject({ tier: 'important', status: 'scheduled' });
  });
});

describe('Routine digest windows (NTF-04, spec §6.4)', () => {
  it('opens a window 15 minutes out, and later Routine notices from the office join it', async () => {
    const s = await studentOnJuvi(app, fx);
    const before = Date.now();
    const first = await publishTestNotice(fx, { priority: 'routine', title: 'One' });
    const second = await publishTestNotice(fx, { priority: 'routine', title: 'Two' });
    // Routine rows are not due for 15 minutes, so the sender has not touched them.
    const [r1] = await deliveriesFor(first._id);
    const [r2] = await deliveriesFor(second._id);
    expect(String(r1!.accountId)).toBe(String(s.account._id));
    expect(r1!.status).toBe('scheduled');
    expect(r1!.sendAfter.getTime()).toBeGreaterThanOrEqual(before + DIGEST_WINDOW_MS);
    expect(r2!.sendAfter.getTime()).toBe(r1!.sendAfter.getTime());
    expect(r2!.batchKey).toBe(r1!.batchKey);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-expand.e2e.test.ts`
Expected: FAIL — `Failed to load url ../../modules/juvi-app/notifications/expand-consumer`.

- [ ] **Step 3: Create the expand consumer and register it**

```ts
// backend/src/modules/juvi-app/notifications/expand-consumer.ts
/**
 * notification.requested → one NotificationDelivery row per person (notifications
 * spec §5.2). Walks the notice's NoticeRecipient rows in batches of 1,000, applies
 * the §6 policy and upserts with $setOnInsert on the unique (source, accountId)
 * key, so a re-run changes nothing.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { JuviAccount, IAccountSettings } from '../../../models/juvi/JuviAccount';
import { ChannelMembership } from '../../../models/juvi/ChannelMembership';
import { NotificationDelivery, NotificationSourceKind, NotificationTier } from '../../../models/juvi/NotificationDelivery';
import { emit, OutboxPayload } from '../../../shared/outbox';
import { getJuviConfig } from '../config/institution-config';
import { decide, digestSendAfter, PolicySettings } from './policy';

export const NOTIFICATION_REQUESTED = 'notification.requested';
export const EXPAND_BATCH_SIZE = 1000;
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

let expandBatchSize = EXPAND_BATCH_SIZE;
/** Test-only: exercise the multi-batch walk without 1,000 real rows. */
export function __setExpandBatchSizeForTesting(n: number | null): void { expandBatchSize = n ?? EXPAND_BATCH_SIZE; }

export const notificationKey = {
  published: (noticeId: string) => `notif:notice:${noticeId}:published`,
  reminder: (noticeId: string, n: number) => `notif:notice:${noticeId}:reminder-${n}`,
  /** One person added to the audience after publish (spec §5.5). */
  addedLater: (noticeId: string, accountId: string) => `notif:notice:${noticeId}:published:${accountId}`,
};

/** Notices batch by office: there is no office id, so the key carries the office name (spec §4.1 `office:<officeId>`). */
export const batchKeyOf = (notice: Pick<LeanNotice, 'publisher'>): string => `office:${notice.publisher.office}`;
export const groupKeyOf = (noticeId: string): string => `notice:${noticeId}`;

export interface NotificationSource { type: 'notice'; id: string; kind: NotificationSourceKind }

/** Records notification.requested for a notice; idempotent on its dedupe key. */
export async function requestNoticeNotification(collegeId: string, noticeId: string, kind: NotificationSourceKind, accountId?: string): Promise<boolean> {
  const dedupeKey = accountId
    ? notificationKey.addedLater(noticeId, accountId)
    : kind === 'published' ? notificationKey.published(noticeId) : notificationKey.reminder(noticeId, Number(kind.slice('reminder-'.length)));
  const source: NotificationSource = { type: 'notice', id: noticeId, kind };
  return emit(NOTIFICATION_REQUESTED, { collegeId, source, ...(accountId ? { accountId } : {}) }, dedupeKey);
}

function settingsOf(s: IAccountSettings | undefined): PolicySettings {
  return {
    quietHours: { start: s?.quietHours?.start ?? '22:00', end: s?.quietHours?.end ?? '07:00' },
    tiers: { important: s?.tiers?.important ?? true, routine: s?.tiers?.routine ?? true },
  };
}

/**
 * Accounts that muted every channel the notice appears in. A notice appears in a
 * channel when the channel is in `Notice.channelIds` — the matcher `channelNotices`
 * (notices/mobile-service.ts) reads for the channel screen — so this inverts it:
 * the person's memberships whose channel is in the notice's list (spec §6.2).
 */
async function mutedEverywhere(collegeId: string, accountIds: Types.ObjectId[], channelIds: Types.ObjectId[]): Promise<Set<string>> {
  if (channelIds.length === 0) return new Set();
  const memberships = await ChannelMembership.find({ collegeId, accountId: { $in: accountIds }, channelId: { $in: channelIds } })
    .select('accountId mutedAt').lean();
  const tally = new Map<string, { total: number; muted: number }>();
  for (const m of memberships) {
    const t = tally.get(String(m.accountId)) ?? { total: 0, muted: 0 };
    t.total += 1;
    if (m.mutedAt) t.muted += 1;
    tally.set(String(m.accountId), t);
  }
  return new Set([...tally].filter(([, t]) => t.muted === t.total).map(([id]) => id));
}

/** The open Routine digest window per account: the earliest `scheduled` Routine row for the batch key (spec §6.4). */
async function openWindows(collegeId: string, accountIds: Types.ObjectId[], batchKey: string): Promise<Map<string, Date>> {
  const rows = await NotificationDelivery.find({ collegeId, accountId: { $in: accountIds }, batchKey, tier: 'routine', status: 'scheduled' })
    .select('accountId sendAfter').lean();
  const out = new Map<string, Date>();
  for (const r of rows) {
    const prev = out.get(String(r.accountId));
    if (!prev || r.sendAfter < prev) out.set(String(r.accountId), r.sendAfter);
  }
  return out;
}

async function expandBatch(
  collegeId: string, notice: LeanNotice, kind: NotificationSourceKind, tier: NotificationTier,
  accountIds: Types.ObjectId[], timezone: string, now: Date,
): Promise<void> {
  const batchKey = batchKeyOf(notice);
  const groupKey = groupKeyOf(String(notice._id));
  const [accounts, muted, windows] = await Promise.all([
    JuviAccount.find({ collegeId, _id: { $in: accountIds } }).select('settings').lean(),
    mutedEverywhere(collegeId, accountIds, notice.channelIds ?? []),
    tier === 'routine' ? openWindows(collegeId, accountIds, batchKey) : Promise.resolve(new Map<string, Date>()),
  ]);
  const settingsBy = new Map(accounts.map((a) => [String(a._id), a.settings]));
  await NotificationDelivery.bulkWrite(accountIds.map((accountId) => {
    const id = String(accountId);
    const d = decide({ tier, settings: settingsOf(settingsBy.get(id)), mutedAllMatchingChannels: muted.has(id), now, collegeTimezone: timezone });
    const common = { collegeId: new Types.ObjectId(collegeId), tier, batchKey, groupKey, sentAt: null, deliveredAt: null, openedAt: null, attempts: 0, lastError: null, lockedUntil: null, createdAt: now, updatedAt: now };
    const row = d.status === 'suppressed'
      ? { ...common, status: 'suppressed' as const, reason: d.reason, sendAfter: now }
      : { ...common, status: 'scheduled' as const, reason: null, sendAfter: tier === 'routine' ? digestSendAfter(d.sendAfter, windows.get(id) ?? null, now) : d.sendAfter };
    return {
      updateOne: {
        // `source` and `accountId` are written from the filter on insert. No automatic timestamps: a re-run must not touch updatedAt.
        filter: { 'source.type': 'notice', 'source.id': notice._id, 'source.kind': kind, accountId },
        update: { $setOnInsert: row },
        upsert: true,
        timestamps: false,
      },
    };
  }), { ordered: false });
}

/**
 * The consumer. A published notice notifies every recipient on Juvi; a reminder
 * only those who have neither acknowledged nor dismissed it; an added-later request
 * (payload.accountId) only that person. A notice that is not `published` (archived,
 * or still publishing) notifies nobody.
 */
export async function expandNotification(payload: OutboxPayload, now: Date = new Date()): Promise<number> {
  const collegeId = payload.collegeId;
  const source = payload.source as NotificationSource | undefined;
  if (source?.type !== 'notice' || !Types.ObjectId.isValid(source.id)) return 0;
  const notice = await Notice.findOne({ _id: source.id, collegeId }).select('status priority publisher channelIds').lean<LeanNotice>();
  if (!notice || notice.status !== 'published') return 0;

  // A reminder is always Important (spec §4.1, NTC-08).
  const tier: NotificationTier = source.kind === 'published' ? notice.priority : 'important';
  const accountId = typeof payload.accountId === 'string' && Types.ObjectId.isValid(payload.accountId) ? new Types.ObjectId(payload.accountId) : null;
  const filter: Record<string, unknown> = { collegeId, noticeId: notice._id, accountId: accountId ?? { $ne: null } };
  if (source.kind !== 'published') Object.assign(filter, { ack: null, dismissedAt: null });
  const timezone = (await getJuviConfig(collegeId))?.timezone ?? DEFAULT_TIMEZONE;

  let expanded = 0;
  let after: Types.ObjectId | null = null;
  type Page = { _id: Types.ObjectId; accountId: Types.ObjectId }[];
  for (;;) {
    const page: Page = await NoticeRecipient.find(after ? { ...filter, _id: { $gt: after } } : filter)
      .sort({ _id: 1 }).limit(expandBatchSize).select('_id accountId').lean<Page>();
    if (page.length === 0) break;
    after = page[page.length - 1]!._id;
    await expandBatch(collegeId, notice, source.kind, tier, page.map((r) => r.accountId), timezone, now);
    expanded += page.length;
    if (page.length < expandBatchSize) break;
  }
  return expanded;
}
```

```ts
// backend/src/modules/juvi-app/notifications/index.ts
/**
 * Juvi notifications (notifications spec §5). Register the consumer with
 * registerNotificationConsumers(); routes.ts calls it next to registerNoticeConsumers().
 */
import { registerConsumer } from '../../../shared/outbox';
import { expandNotification, NOTIFICATION_REQUESTED } from './expand-consumer';

export { requestNoticeNotification, notificationKey, NOTIFICATION_REQUESTED } from './expand-consumer';

export function registerNotificationConsumers(): void {
  registerConsumer(NOTIFICATION_REQUESTED, async (payload) => { await expandNotification(payload); });
}
```

In `backend/src/modules/juvi-app/routes.ts`, after `import { noticesRouter } from './notices/mobile-routes';` (line 8):

```ts
import { registerNotificationConsumers } from './notifications';
```

and replace lines 10-11:

```ts
// Outbox consumers for notices and notifications; the dispatcher (server.ts) and inline kick() both run them.
registerNoticeConsumers();
registerNotificationConsumers();
```

- [ ] **Step 4: Request the push from the fan-out and the reminder consumers**

`backend/src/modules/juvi-app/notices/consumers.ts` — after the `publish-service` import (line 14):

```ts
import { requestNoticeNotification } from '../notifications';
```

Replace the `fanOutNotice` doc comment (lines 39-44) and its guard (line 49). The comment becomes:

```ts
/**
 * notice.published: resolve the audience, upsert one NoticeRecipient per member in
 * batches of 1,000 (`ordered: false`, upsert on the unique (noticeId, personId)),
 * then set counts, channelIds, status and publishedAt, and request the push
 * (notification.requested, notifications spec §5.1). Idempotent: a notice that is
 * no longer `publishing` is left alone, and a retry only inserts the missing rows.
 */
```

and `if (!notice || notice.status !== 'publishing') return;` becomes:

```ts
  if (!notice) return;
  // A retry after the status write: the push request may not have been recorded yet (emit is idempotent).
  if (notice.status === 'published') { await requestNoticeNotification(collegeId, noticeId, 'published'); return; }
  if (notice.status !== 'publishing') return;
```

After the `Notice.updateOne(… status: 'published', publishedAt: now …)` call (ends line 86), before the `console.log`:

```ts
  await requestNoticeNotification(collegeId, noticeId, 'published');
```

Replace `markReminded` and its comment (lines 137-143):

```ts
/**
 * notice.reminder: stamp remindedAt on members who have neither acknowledged nor dismissed,
 * then request the reminder push. `n` is in the payload from notifications onwards; an event
 * recorded before that falls back to the notice's reminder count.
 */
export async function markReminded(payload: OutboxPayload): Promise<void> {
  const collegeId = payload.collegeId;
  const noticeId = String(payload.noticeId);
  await NoticeRecipient.updateMany(
    { collegeId, noticeId, ack: null, dismissedAt: null, archived: false },
    { $set: { remindedAt: new Date() } },
  );
  const n = typeof payload.n === 'number'
    ? payload.n
    : (await Notice.findOne({ _id: noticeId, collegeId }).select('reminders').lean<Pick<LeanNotice, 'reminders'>>())?.reminders.length ?? 0;
  if (n === 1 || n === 2) await requestNoticeNotification(collegeId, noticeId, `reminder-${n}`);
}
```

`backend/src/modules/juvi-app/notices/publish-service.ts` line 158 — the reminder event carries its number:

```ts
  await emit(NOTICE_EVENTS.reminder, { collegeId: actor.collegeId, noticeId: String(notice._id), n }, noticeEventKey.reminder(String(notice._id), n));
```

- [ ] **Step 5: Run the tests**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-expand.e2e.test.ts src/__e2e__/modules/juvi-notices-reach.e2e.test.ts src/__e2e__/modules/juvi-notices-lifecycle.e2e.test.ts src/__e2e__/modules/juvi-notices-publish.e2e.test.ts && npx tsc --noEmit`
Expected: PASS (expand: 8 tests; the notices suites unchanged); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/juvi-app/notifications/expand-consumer.ts backend/src/modules/juvi-app/notifications/index.ts \
  backend/src/modules/juvi-app/routes.ts backend/src/modules/juvi-app/notices/consumers.ts backend/src/modules/juvi-app/notices/publish-service.ts \
  backend/src/__e2e__/factories/notification.factory.ts backend/src/__e2e__/modules/juvi-notifications-expand.e2e.test.ts
git commit -m "feat(juvi-app): notification.requested from fan-out and reminders; expand to one delivery row per person

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The sender — `afterEvents` sweepers, the payload, lease, re-check, digest, token pruning and backoff

**Files:**
- Create: `backend/src/modules/juvi-app/notifications/payload.ts`, `backend/src/modules/juvi-app/notifications/sender.ts`
- Modify: `backend/src/shared/outbox/outbox.ts:6-9`, `:22-29`, `:86-105`, `:145-150`; `backend/src/modules/juvi-app/notifications/index.ts` (whole file)
- Test: `backend/src/shared/outbox/__tests__/outbox.test.ts`, `backend/src/modules/juvi-app/notifications/__tests__/payload.test.ts`, `backend/src/__e2e__/modules/juvi-notifications-send.e2e.test.ts`

**Interfaces:**
- Consumes: `NotificationDelivery`, `LeanNotificationDelivery`, `DeliveryReason` (Task 1); `getPushTransport`, `PushTransport`, `PushResult`, `PushMessage`, `TOKEN_ERRORS`, `FakePushTransport`, `setPushTransport`, `pushTransportWarning` (Task 4); `signReceipt`, `verifyReceipt`, `RECEIPT_TTL_MS` (Task 4); `expandNotification`, `NOTIFICATION_REQUESTED` (Task 5); `DIGEST_WINDOW_MS` (Task 2).
- Produces:
  ```ts
  // shared/outbox/outbox.ts
  export function registerSweeper(fn: OutboxSweeper, opts?: { afterEvents?: boolean }): void;
  // notifications/payload.ts
  export interface NoticePushInput { deliveryId; receipt; noticeId; tier: NotificationTier; groupKey; office; title; confidential: boolean; variant: 'published' | 'reminder'; count: number }
  export function buildNoticePush(i: NoticePushInput): PushMessage;
  // notifications/sender.ts
  export const SEND_BATCH_MAX = 500, LEASE_MS = 60_000, MAX_SEND_ATTEMPTS = 5, BACKOFF_BASE_MS = 30_000, BACKOFF_MAX_MS = 600_000;
  export function sendBackoffMs(attempts: number): number;
  export interface SenderStats { claimed; sent; cancelled; noDevice; retried; failed }
  export function runSender(now?: Date, transport?: PushTransport): Promise<SenderStats>;
  ```

Rulings 8, 11, 12 and 13 apply. Rows are claimed one at a time with `findOneAndUpdate` (status `scheduled`, `sendAfter <= now`, lease free), which is what makes two concurrent senders safe; a row whose processing throws keeps its lease and is retried when it expires (§11).

- [ ] **Step 1: Write the failing tests**

In `backend/src/shared/outbox/__tests__/outbox.test.ts`, inside `describe('processOnce, kick and drain', …)`, before `it('kick uses the enqueuer when one is installed …')`:

```ts
  it('runs afterEvents sweepers after the events on every pass, kick or tick', async () => {
    const order: string[] = [];
    registerSweeper(async () => { order.push('after'); }, { afterEvents: true });
    registerConsumer('t.e', async () => { order.push('event'); });
    await emit('t.e', { collegeId: cid }, 'e1');
    await processOnce(500, { sweep: false });
    expect(order).toEqual(['event', 'after']);
    await processOnce();
    expect(order).toEqual(['event', 'after', 'after']);
  });
```

```ts
// backend/src/modules/juvi-app/notifications/__tests__/payload.test.ts
import { describe, it, expect } from 'vitest';
import { buildNoticePush, NoticePushInput } from '../payload';
import { sendBackoffMs, MAX_SEND_ATTEMPTS } from '../sender';

const base: NoticePushInput = {
  deliveryId: 'd1', receipt: 'mac.1790000000', noticeId: 'n1', tier: 'important', groupKey: 'notice:n1',
  office: 'Exam Section', title: 'Hall tickets are out', confidential: false, variant: 'published', count: 1,
};

describe('buildNoticePush (spec §6.6, NFR-05)', () => {
  it('a normal notice: ids, office and title as strings, high priority, collapsed by group', () => {
    expect(buildNoticePush(base)).toEqual({
      data: {
        deliveryId: 'd1', receipt: 'mac.1790000000', kind: 'notice', noticeId: 'n1', tier: 'important', groupKey: 'notice:n1',
        office: 'Exam Section', title: 'Hall tickets are out', variant: 'published', count: '1',
      },
      priority: 'high', collapseKey: 'notice:n1',
    });
  });

  it('a confidential notice carries no title', () => {
    const { data } = buildNoticePush({ ...base, confidential: true });
    expect(data.title).toBeUndefined();
    expect(data.office).toBe('Exam Section');
  });

  it('a reminder is variant reminder; Urgent is high priority; Routine is normal', () => {
    expect(buildNoticePush({ ...base, variant: 'reminder' }).data.variant).toBe('reminder');
    expect(buildNoticePush({ ...base, tier: 'urgent' }).priority).toBe('high');
    expect(buildNoticePush({ ...base, tier: 'routine' }).priority).toBe('normal');
  });

  it('a Routine batch carries the count and no title', () => {
    const { data } = buildNoticePush({ ...base, tier: 'routine', count: 3 });
    expect(data.count).toBe('3');
    expect(data.title).toBeUndefined();
  });

  it('every value is a string', () => {
    for (const v of Object.values(buildNoticePush(base).data)) expect(typeof v).toBe('string');
  });
});

describe('sendBackoffMs (spec §5.3)', () => {
  it('is 30 s × 2^attempts, capped at ten minutes, over five attempts', () => {
    expect([1, 2, 3, 4, 5, 6].map(sendBackoffMs)).toEqual([60_000, 120_000, 240_000, 480_000, 600_000, 600_000]);
    expect(MAX_SEND_ATTEMPTS).toBe(5);
  });
});
```

```ts
// backend/src/__e2e__/modules/juvi-notifications-send.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, mobileClient } from '../factories/juvi.factory';
import { publishTestNotice } from '../factories/notice.factory';
import { studentOnJuvi, quietHoursAround, deliveriesFor, deliveryOf } from '../factories/notification.factory';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { MobileSession } from '../../models/juvi/MobileSession';
import { drainOutbox } from '../../shared/outbox';
import { remindNotice } from '../../modules/juvi-app/notices/publish-service';
import { erpActor } from '../../modules/juvi-app/notices/reach-service';
import { FakePushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';
import { runSender, MAX_SEND_ATTEMPTS } from '../../modules/juvi-app/notifications/sender';
import { verifyReceipt } from '../../modules/juvi-app/notifications/receipts';
import { DIGEST_WINDOW_MS } from '../../modules/juvi-app/notifications/policy';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const fake = new FakePushTransport();
const REASON = 'Exam postponed by the university';
const BODY = 'The mid-semester timetable is attached.';   // publishTestNotice's body
const later = (ms: number) => new Date(Date.now() + ms);

beforeAll(async () => { app = await getTestApp(); setPushTransport(fake); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); fake.reset(); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

describe('sending (spec §5.3, §6.6)', () => {
  it('an Urgent notice goes out in the same dispatcher pass: one data message per device, never the body', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-a' });
    const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON, title: 'Exam postponed' });
    expect(fake.sent).toHaveLength(1);
    const { tokens, message } = fake.sent[0]!;
    expect(tokens).toEqual(['tok-a']);
    const row = (await deliveryOf(n._id, s.account._id))!;
    expect(message).toEqual({
      data: {
        deliveryId: String(row._id), receipt: expect.any(String), kind: 'notice', noticeId: String(n._id), tier: 'urgent',
        groupKey: `notice:${n._id}`, office: n.publisher.office, title: 'Exam postponed', variant: 'published', count: '1',
      },
      priority: 'high', collapseKey: `notice:${n._id}`,
    });
    expect(verifyReceipt(String(row._id), message.data.receipt!)).toBe(true);
    expect(JSON.stringify(fake.sent)).not.toContain(BODY);
    expect(row).toMatchObject({ status: 'sent', attempts: 0, lockedUntil: null });
    expect(row.sentAt).toBeInstanceOf(Date);
  });

  it('a confidential notice sends the office and no title', async () => {
    await studentOnJuvi(app, fx, { pushToken: 'tok-c' });
    await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON, title: 'Disciplinary hearing', confidential: true });
    const { data } = fake.sent[0]!.message;
    expect(data.title).toBeUndefined();
    expect(JSON.stringify(fake.sent)).not.toContain('Disciplinary hearing');
    expect(data.office).toBeTypeOf('string');
  });

  it('a reminder is sent as an Important reminder', async () => {
    await studentOnJuvi(app, fx, { pushToken: 'tok-r' });
    const n = await publishTestNotice(fx, { priority: 'important', ackRequired: true });
    fake.reset();
    await remindNotice(erpActor(fx.collegeId, { id: String(fx.admin.user._id), name: 'Admin', role: 'admin' }), String(n._id));
    await drainOutbox();
    expect(fake.sent.map((m) => [m.message.data.variant, m.message.data.tier])).toEqual([['reminder', 'important']]);
  });

  it('a person with no registered device is counted as no_device', async () => {
    const s = await studentOnJuvi(app, fx);
    const n = await publishTestNotice(fx, { priority: 'important' });
    expect(fake.sent).toHaveLength(0);
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'suppressed', reason: 'no_device' });
  });
});

describe('the re-check before sending (spec §5.3 step 1)', () => {
  it('acknowledging before sendAfter cancels the row', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-q' });
    await JuviAccount.updateOne({ _id: s.account._id }, { $set: { 'settings.quietHours': quietHoursAround(new Date()) } });
    const n = await publishTestNotice(fx, { priority: 'important', ackRequired: true });
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'scheduled' });
    await mobileClient(app, s.accessToken).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(200);
    await runSender(later(2 * 3_600_000), fake);
    expect(fake.sent).toHaveLength(0);
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'cancelled', reason: 'acknowledged' });
  });
});

describe('errors (spec §5.3, §11)', () => {
  it('UNREGISTERED clears that session\'s token; a delivery to another device still counts as sent', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-dead' });
    await MobileSession.create({
      collegeId: fx.collegeId, accountId: s.account._id, userId: s.account.userId, deviceId: 'second-phone', deviceName: 'Phone 2', platform: 'android',
      appVersion: '1.0.0', osVersion: '14', refreshTokenHash: 'h-second-phone', refreshExpiresAt: later(86_400_000), pushToken: 'tok-live',
    });
    fake.failToken('tok-dead', 'UNREGISTERED');
    const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'sent' });
    expect(await MobileSession.countDocuments({ accountId: s.account._id, pushToken: 'tok-dead' })).toBe(0);
    expect(await MobileSession.countDocuments({ accountId: s.account._id, pushToken: 'tok-live' })).toBe(1);
  });

  it('when every token is dead the row is no_device', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-gone' });
    fake.failToken('tok-gone', 'INVALID_ARGUMENT');
    const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'suppressed', reason: 'no_device' });
  });

  it('a transient error backs off 30 s × 2^attempts and fails after five attempts', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-flaky' });
    fake.failToken('tok-flaky', 'UNAVAILABLE');
    const before = Date.now();
    const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
    const first = (await deliveryOf(n._id, s.account._id))!;
    expect(first).toMatchObject({ status: 'scheduled', attempts: 1, lastError: 'UNAVAILABLE', lockedUntil: null });
    expect(first.sendAfter.getTime() - before).toBeGreaterThanOrEqual(60_000 - 1_000);
    for (let i = 2; i <= MAX_SEND_ATTEMPTS; i++) await runSender(later(i * 3_600_000), fake);
    expect(await deliveryOf(n._id, s.account._id)).toMatchObject({ status: 'failed', attempts: MAX_SEND_ATTEMPTS, lastError: 'UNAVAILABLE' });
    expect(fake.sent).toHaveLength(MAX_SEND_ATTEMPTS);
  });
});

describe('Routine batching (NTF-04, spec §6.4)', () => {
  it('ten Routine notices from one office in 15 minutes are one notification with count 10; the next window is 15 minutes out', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-digest' });
    const notices = [];
    for (let i = 1; i <= 10; i++) notices.push(await publishTestNotice(fx, { priority: 'routine', title: `Routine ${i}` }));
    expect(fake.sent).toHaveLength(0);                                  // the window is still open

    await runSender(later(DIGEST_WINDOW_MS + 60_000), fake);
    expect(fake.sent).toHaveLength(1);
    const { data, } = fake.sent[0]!.message;
    expect(data).toMatchObject({ count: '10', tier: 'routine', noticeId: String(notices[9]!._id), variant: 'published' });
    expect(data.title).toBeUndefined();
    expect(fake.sent[0]!.message.priority).toBe('normal');
    const rows = await Promise.all(notices.map((n) => deliveryOf(n._id, s.account._id)));
    expect(new Set(rows.map((r) => r!.status))).toEqual(new Set(['sent']));
    expect(new Set(rows.map((r) => r!.sentAt!.getTime())).size).toBe(1);

    const before = Date.now();
    const eleventh = await publishTestNotice(fx, { priority: 'routine', title: 'Routine 11' });
    const next = (await deliveriesFor(eleventh._id))[0]!;
    expect(next.status).toBe('scheduled');
    expect(next.sendAfter.getTime()).toBeGreaterThanOrEqual(before + DIGEST_WINDOW_MS);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd backend && npx vitest run src/shared/outbox src/modules/juvi-app/notifications/__tests__/payload.test.ts && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-send.e2e.test.ts`
Expected: FAIL — the outbox case records `['event']` only (the option is ignored); `../payload` and `../sender` do not exist.

- [ ] **Step 3: Teach the outbox `afterEvents` sweepers**

`backend/src/shared/outbox/outbox.ts` — append to the file comment (after line 8):

```ts
 * Sweepers run before the events on the scheduled tick; an `afterEvents` sweeper
 * (the notification sender) runs after them on every pass, tick or kick.
```

After `const sweepers: OutboxSweeper[] = [];` (line 22):

```ts
const afterSweepers: OutboxSweeper[] = [];
```

Replace `registerSweeper` (line 29):

```ts
export function registerSweeper(fn: OutboxSweeper, opts: { afterEvents?: boolean } = {}): void {
  (opts.afterEvents ? afterSweepers : sweepers).push(fn);
}
```

In `processOnce`, update the comment and run the `afterEvents` sweepers after the event loop, before `return n;`:

```ts
/**
 * Runs every sweeper (unless `sweep` is false), then processes claimable events
 * until none is left (or `limit`), then every `afterEvents` sweeper. Returns the
 * number processed. The dispatcher sweeps on its scheduled tick only; the inline
 * path has no tick, so it sweeps. `afterEvents` sweepers run on every pass.
 */
```

```ts
  for (const sweep of afterSweepers) {
    try { await sweep(); } catch (err) { console.error('[outbox] sweeper failed', err); }
  }
  return n;
```

In `__resetOutboxForTesting`, after `sweepers.length = 0;`:

```ts
  afterSweepers.length = 0;
```

- [ ] **Step 4: Create the payload builder and the sender**

```ts
// backend/src/modules/juvi-app/notifications/payload.ts
/**
 * The FCM data message for a notice (notifications spec §6.6, NFR-05). Pure.
 * Only opaque ids, the office and — for a single, non-confidential notice — the
 * title. Never the body, attachments, names, roll numbers, deadlines or audience.
 */
import type { NotificationTier } from '../../../models/juvi/NotificationDelivery';
import type { PushMessage } from './transport';

export interface NoticePushInput {
  deliveryId: string;
  receipt: string;
  /** The newest notice of a Routine batch. */
  noticeId: string;
  tier: NotificationTier;
  groupKey: string;
  office: string;
  title: string;
  confidential: boolean;
  variant: 'published' | 'reminder';
  /** Notices in this notification: more than 1 only for a Routine batch. */
  count: number;
}

export function buildNoticePush(i: NoticePushInput): PushMessage {
  const data: Record<string, string> = {
    deliveryId: i.deliveryId, receipt: i.receipt, kind: 'notice', noticeId: i.noticeId, tier: i.tier,
    groupKey: i.groupKey, office: i.office, variant: i.variant, count: String(i.count),
  };
  // A confidential notice renders "New notice from <office>"; a batch renders "<count> new notices from <office>".
  if (!i.confidential && i.count === 1) data.title = i.title;
  return { data, priority: i.tier === 'routine' ? 'normal' : 'high', collapseKey: i.groupKey };
}
```

```ts
// backend/src/modules/juvi-app/notifications/sender.ts
/**
 * The sender (notifications spec §5.3). Registered as an `afterEvents` outbox
 * sweeper, so it runs on the 5 s dispatcher tick and after every kick. It claims
 * due `scheduled` rows one at a time under a 60 s lease (up to 500 a pass),
 * re-checks the notice, gathers a Routine digest, sends one data message to the
 * account's devices, prunes dead tokens and backs off transient failures.
 *
 * Rows are claimed across colleges, like outbox events; every later read and
 * write is scoped by the row's collegeId.
 */
import { NotificationDelivery, LeanNotificationDelivery, DeliveryReason } from '../../../models/juvi/NotificationDelivery';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient, LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { MobileSession } from '../../../models/juvi/MobileSession';
import { getPushTransport, PushTransport, PushResult, TOKEN_ERRORS } from './transport';
import { signReceipt, RECEIPT_TTL_MS } from './receipts';
import { buildNoticePush } from './payload';

export const SEND_BATCH_MAX = 500;
export const LEASE_MS = 60_000;
export const MAX_SEND_ATTEMPTS = 5;
export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_MAX_MS = 600_000;

/** 30 s × 2^attempts, capped at ten minutes. */
export function sendBackoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_MAX_MS);
}

export interface SenderStats { claimed: number; sent: number; cancelled: number; noDevice: number; retried: number; failed: number }

type Row = LeanNotificationDelivery;
const leaseFree = (now: Date) => ({ $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] });

async function claim(filter: Record<string, unknown>, now: Date): Promise<Row | null> {
  return NotificationDelivery.findOneAndUpdate(
    { ...filter, status: 'scheduled', sendAfter: { $lte: now }, ...leaseFree(now) },
    { $set: { lockedUntil: new Date(now.getTime() + LEASE_MS) } },
    { new: true, sort: { sendAfter: 1 } },
  ).lean<Row>();
}

/** Every other due Routine row in the same digest window: same account and batch key (spec §6.4). */
async function claimDigest(primary: Row, now: Date): Promise<Row[]> {
  const scope = { collegeId: primary.collegeId, accountId: primary.accountId, batchKey: primary.batchKey, tier: 'routine' };
  const ids = await NotificationDelivery.find({ ...scope, _id: { $ne: primary._id }, status: 'scheduled', sendAfter: { $lte: now }, ...leaseFree(now) })
    .select('_id').lean();
  const out: Row[] = [];
  for (const { _id } of ids) {
    const row = await claim({ ...scope, _id }, now);
    if (row) out.push(row);
  }
  return out;
}

async function settle(rows: Row[], set: Record<string, unknown>): Promise<void> {
  if (rows.length === 0) return;
  await NotificationDelivery.updateMany(
    { _id: { $in: rows.map((r) => r._id) }, collegeId: rows[0]!.collegeId, status: 'scheduled' },
    { $set: { ...set, lockedUntil: null } },
  );
}

const cancelReason = (notice: LeanNotice | undefined, row: LeanNoticeRecipient | undefined): DeliveryReason | null => {
  if (!notice || notice.status !== 'published' || row?.archived) return 'archived';
  if (row?.ack) return 'acknowledged';
  if (row?.dismissedAt) return 'dismissed';
  return null;
};

async function sendGroup(primary: Row, transport: PushTransport, now: Date, stats: SenderStats): Promise<void> {
  const rows = primary.tier === 'routine' ? [primary, ...(await claimDigest(primary, now))] : [primary];
  stats.claimed += rows.length - 1;
  const collegeId = primary.collegeId;
  const noticeIds = rows.map((r) => r.source.id);
  const [notices, recipients] = await Promise.all([
    Notice.find({ collegeId, _id: { $in: noticeIds } }).select('status title confidential publisher publishedAt').lean<LeanNotice[]>(),
    NoticeRecipient.find({ collegeId, noticeId: { $in: noticeIds }, accountId: primary.accountId }).select('noticeId ack dismissedAt archived').lean<LeanNoticeRecipient[]>(),
  ]);
  const noticeBy = new Map(notices.map((n) => [String(n._id), n]));
  const recipientBy = new Map(recipients.map((r) => [String(r.noticeId), r]));

  // 1. Re-check: archived, acknowledged or dismissed since the row was scheduled.
  const live: Row[] = [];
  for (const r of rows) {
    const reason = cancelReason(noticeBy.get(String(r.source.id)), recipientBy.get(String(r.source.id)));
    if (!reason) { live.push(r); continue; }
    await settle([r], { status: 'cancelled', reason });
    stats.cancelled += 1;
  }
  if (live.length === 0) return;

  // 2. The account's devices.
  const sessions = await MobileSession.find({ collegeId, accountId: primary.accountId, revokedAt: null, refreshExpiresAt: { $gt: now }, pushToken: { $type: 'string' } })
    .select('pushToken').lean();
  const tokens = [...new Set(sessions.map((s) => s.pushToken!))];
  if (tokens.length === 0) {
    await settle(live, { status: 'suppressed', reason: 'no_device' });
    stats.noDevice += live.length;
    return;
  }

  // 3. One message: the newest notice of the group carries the delivery id and receipt.
  const publishedAt = (r: Row) => new Date(noticeBy.get(String(r.source.id))?.publishedAt ?? 0).getTime();
  const lead = live.reduce((a, b) => (publishedAt(b) > publishedAt(a) ? b : a));
  const notice = noticeBy.get(String(lead.source.id))!;
  const deliveryId = String(lead._id);
  const message = buildNoticePush({
    deliveryId, receipt: signReceipt(deliveryId, new Date(now.getTime() + RECEIPT_TTL_MS)),
    noticeId: String(notice._id), tier: lead.tier, groupKey: lead.groupKey, office: notice.publisher.office, title: notice.title,
    confidential: notice.confidential ?? false, variant: lead.source.kind === 'published' ? 'published' : 'reminder', count: live.length,
  });
  let results: PushResult[];
  try {
    results = await transport.send(tokens, message);
  } catch {
    results = tokens.map((token) => ({ token, ok: false, error: 'UNAVAILABLE' as const }));
  }

  // 4. Dead tokens leave their sessions.
  const dead = results.filter((r) => !r.ok && r.error && TOKEN_ERRORS.has(r.error)).map((r) => r.token);
  if (dead.length > 0) await MobileSession.updateMany({ collegeId, pushToken: { $in: dead } }, { $unset: { pushToken: 1 } });

  if (results.some((r) => r.ok)) {
    await settle(live, { status: 'sent', sentAt: now, lastError: null });
    stats.sent += live.length;
    return;
  }
  const transient = results.find((r) => !r.ok && !(r.error && TOKEN_ERRORS.has(r.error)));
  if (!transient) {
    // Every device token was dead: nothing left to deliver to.
    await settle(live, { status: 'suppressed', reason: 'no_device' });
    stats.noDevice += live.length;
    return;
  }
  // 5. Transient: back off, and fail after five attempts. `lastError` is the code, never the payload.
  for (const r of live) {
    const attempts = r.attempts + 1;
    const lastError = transient.error ?? 'UNKNOWN';
    if (attempts >= MAX_SEND_ATTEMPTS) {
      await settle([r], { status: 'failed', attempts, lastError });
      stats.failed += 1;
    } else {
      await settle([r], { attempts, lastError, sendAfter: new Date(now.getTime() + sendBackoffMs(attempts)) });
      stats.retried += 1;
    }
  }
}

/** One sender pass. A row whose processing throws keeps its lease and is retried once the lease expires (spec §11). */
export async function runSender(now: Date = new Date(), transport?: PushTransport): Promise<SenderStats> {
  const t = transport ?? (await getPushTransport());
  const stats: SenderStats = { claimed: 0, sent: 0, cancelled: 0, noDevice: 0, retried: 0, failed: 0 };
  while (stats.claimed < SEND_BATCH_MAX) {
    const row = await claim({}, now);
    if (!row) break;
    stats.claimed += 1;
    try {
      await sendGroup(row, t, now, stats);
    } catch (err) {
      console.error('[juvi-push] send failed for delivery', String(row._id), err instanceof Error ? err.message : err);
    }
  }
  return stats;
}
```

Replace `backend/src/modules/juvi-app/notifications/index.ts`:

```ts
// backend/src/modules/juvi-app/notifications/index.ts
/**
 * Juvi notifications (notifications spec §5). Register the consumer with
 * registerNotificationConsumers(); routes.ts calls it next to registerNoticeConsumers().
 */
import { registerConsumer, registerSweeper } from '../../../shared/outbox';
import { expandNotification, NOTIFICATION_REQUESTED } from './expand-consumer';
import { runSender } from './sender';
import { pushTransportWarning } from './transport';

export { requestNoticeNotification, notificationKey, NOTIFICATION_REQUESTED } from './expand-consumer';

export function registerNotificationConsumers(): void {
  registerConsumer(NOTIFICATION_REQUESTED, async (payload) => { await expandNotification(payload); });
  // After the events, on every dispatcher pass: rows the expansion just wrote go out in the same pass.
  registerSweeper(async () => { await runSender(); }, { afterEvents: true });
  const warning = pushTransportWarning();
  if (warning && process.env.NODE_ENV !== 'test') console.warn(`[juvi-push] ${warning}`);
}
```

- [ ] **Step 5: Run the tests**

Run: `cd backend && npx vitest run src/shared/outbox src/modules/juvi-app/notifications && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-send.e2e.test.ts src/__e2e__/modules/juvi-notifications-expand.e2e.test.ts && npx tsc --noEmit`
Expected: PASS (payload 6, send e2e 9, expand e2e still 8); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/shared/outbox/outbox.ts backend/src/shared/outbox/__tests__/outbox.test.ts \
  backend/src/modules/juvi-app/notifications/payload.ts backend/src/modules/juvi-app/notifications/sender.ts \
  backend/src/modules/juvi-app/notifications/index.ts backend/src/modules/juvi-app/notifications/__tests__/payload.test.ts \
  backend/src/__e2e__/modules/juvi-notifications-send.e2e.test.ts
git commit -m "feat(juvi-app): notification sender — lease, re-check, Routine digest, token pruning, backoff to failed

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: People added later get exactly one push

**Files:**
- Modify: `backend/src/modules/juvi-app/notices/recipient-service.ts:11-13`, `:39`, `:49-62`
- Test: `backend/src/__e2e__/modules/juvi-notifications-added-later.e2e.test.ts`

**Interfaces:**
- Consumes: `requestNoticeNotification(collegeId, noticeId, 'published', accountId)` (Task 5, via `../notifications`); the sender (Task 6) for the assertions on `FakePushTransport.sent`; `backfillAddedLater(collegeId, accountId, now?)` (`notices/recipient-service.ts:34`), which `reconcileAccount` calls on a Spaces load.
- Produces: `export const ADDED_LATER_PUSH_DAYS = 7;` and the added-later dedupe key `notif:notice:<id>:published:<accountId>`. `backfillAddedLater` still returns the number of rows inserted.

Every matching row is still added (30-day window, notices spec §6.6); the push is requested only when the account is active, the notice is under 7 days old, and it has no deadline or one still ahead (§5.5). The outbox dedupe key and the delivery row's unique key each stop a second push.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/__e2e__/modules/juvi-notifications-added-later.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient } from '../factories/juvi.factory';
import { publishTestNotice } from '../factories/notice.factory';
import { studentOnJuvi, deliveriesFor } from '../factories/notification.factory';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { OutboxEvent, drainOutbox } from '../../shared/outbox';
import { backfillAddedLater } from '../../modules/juvi-app/notices/recipient-service';
import { FakePushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const fake = new FakePushTransport();
const DAY = 86_400_000;

beforeAll(async () => { app = await getTestApp(); setPushTransport(fake); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); fake.reset(); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

describe('people added later get exactly one push (spec §5.5)', () => {
  it('the Spaces-load back-fill requests one push for that person; a second pass sends nothing', async () => {
    await provisionTestStudent(fx);                                             // the audience at publish
    const n = await publishTestNotice(fx, { priority: 'important', title: 'Fee dates' });
    expect(fake.sent).toHaveLength(0);

    const late = await studentOnJuvi(app, fx, { pushToken: 'tok-late' });
    await mobileClient(app, late.accessToken).get(`${V1}/spaces`).expect(200);  // reconcileAccount → backfillAddedLater
    await drainOutbox();
    expect(await NoticeRecipient.exists({ noticeId: n._id, personId: late.person._id, addedLater: true })).toBeTruthy();
    expect(await OutboxEvent.exists({ dedupeKey: `notif:notice:${n._id}:published:${late.account._id}` })).toBeTruthy();
    expect(fake.sent.map((m) => [m.tokens, m.message.data.noticeId, m.message.data.title])).toEqual([[['tok-late'], String(n._id), 'Fee dates']]);

    await NoticeRecipient.deleteOne({ noticeId: n._id, personId: late.person._id });
    await backfillAddedLater(fx.collegeId, String(late.account._id));           // re-inserts the row, re-requests the push
    await drainOutbox();
    expect(fake.sent).toHaveLength(1);
    expect((await deliveriesFor(n._id)).filter((r) => String(r.accountId) === String(late.account._id))).toHaveLength(1);
  });

  it('only for notices under 7 days old whose deadline has not passed', async () => {
    await provisionTestStudent(fx);
    const old = await publishTestNotice(fx, { title: 'Eight days old', priority: 'important' });
    await Notice.updateOne({ _id: old._id }, { $set: { publishedAt: new Date(Date.now() - 8 * DAY) } });
    const closed = await publishTestNotice(fx, { title: 'Deadline passed', priority: 'important', ackRequired: true, ackDeadline: new Date(Date.now() + DAY).toISOString() });
    await Notice.updateOne({ _id: closed._id }, { $set: { ackDeadline: new Date(Date.now() - 60_000) } });
    const open = await publishTestNotice(fx, { title: 'Still open', priority: 'important', ackRequired: true, ackDeadline: new Date(Date.now() + DAY).toISOString() });

    const late = await studentOnJuvi(app, fx, { pushToken: 'tok-late' });
    expect(await backfillAddedLater(fx.collegeId, String(late.account._id))).toBe(3);   // every row is still added
    await drainOutbox();
    expect(fake.sent.map((m) => m.message.data.noticeId)).toEqual([String(open._id)]);
  });

  it('a person not yet active gets the row but no push', async () => {
    await provisionTestStudent(fx);
    await publishTestNotice(fx);
    const onboarding = await provisionTestStudent(fx);
    expect(await backfillAddedLater(fx.collegeId, String(onboarding.account._id))).toBe(1);
    await drainOutbox();
    expect(await OutboxEvent.countDocuments({ dedupeKey: { $regex: `:published:${onboarding.account._id}$` } })).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-added-later.e2e.test.ts`
Expected: FAIL — no `notif:notice:<id>:published:<accountId>` event is recorded and `fake.sent` is empty.

- [ ] **Step 3: Request the push from the back-fill**

`backend/src/modules/juvi-app/notices/recipient-service.ts` — after `import { personMatchesRules } from './audience';` (line 11):

```ts
import { requestNoticeNotification } from '../notifications';
```

after `export const ADDED_LATER_WINDOW_DAYS = 30;` (line 13):

```ts
/** An added-later person is notified only for a notice under 7 days old whose deadline, if any, has not passed (notifications spec §5.5). */
export const ADDED_LATER_PUSH_DAYS = 7;
```

line 39 also selects `publishedAt`:

```ts
    .select('_id audience ackRequired ackDeadline publishedAt').lean<LeanNotice[]>();
```

and replace lines 49-62 (from `const docs = missing.filter(…)` to the end of the function) with:

```ts
  const matched = missing.filter((n) => personMatchesRules(n.audience.rules, person, graph));
  const docs = matched.map((n) => ({
    collegeId, noticeId: n._id, personId: account.personId, accountId: onJuvi ? account._id : null,
    kind: person.kind, labels: person.labels, addedLater: true, ackRequired: n.ackRequired,
    deadline: n.ackDeadline ?? null, receivedAt: onJuvi ? now : null,
  }));
  if (docs.length === 0) return 0;
  let inserted: number;
  try {
    inserted = (await NoticeRecipient.insertMany(docs, { ordered: false })).length;
  } catch (err) {
    // A concurrent pass inserted some of the same rows: the unique (noticeId, personId) index kept one each.
    const e = err as { code?: number; writeErrors?: { code?: number }[] };
    const duplicatesOnly = e.code === 11000 || (Boolean(e.writeErrors?.length) && e.writeErrors!.every((w) => w.code === 11000));
    if (!duplicatesOnly) throw err;
    inserted = docs.length - (e.writeErrors?.length ?? 1);
  }
  // One push per person per notice: the per-account dedupe key and the delivery row's unique key stop a second one.
  if (onJuvi) {
    const pushSince = now.getTime() - ADDED_LATER_PUSH_DAYS * 86_400_000;
    for (const n of matched) {
      const recent = new Date(n.publishedAt ?? 0).getTime() >= pushSince;
      const open = !n.ackDeadline || new Date(n.ackDeadline).getTime() > now.getTime();
      if (recent && open) await requestNoticeNotification(collegeId, String(n._id), 'published', String(account._id));
    }
  }
  return inserted;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd backend && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-added-later.e2e.test.ts src/__e2e__/modules/juvi-notices-lifecycle.e2e.test.ts src/__e2e__/modules/juvi-notices-hardening.e2e.test.ts && npx tsc --noEmit`
Expected: PASS (added-later: 3 tests; the notices back-fill suites unchanged); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/juvi-app/notices/recipient-service.ts backend/src/__e2e__/modules/juvi-notifications-added-later.e2e.test.ts
git commit -m "feat(juvi-app): one push for people added to a notice's audience later (under 7 days, deadline open)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Mobile endpoints — push token, receipts and events

**Files:**
- Create: `backend/src/modules/juvi-app/notifications/events-service.ts`, `schemas.ts`, `controller.ts`, `routes.ts`
- Modify: `backend/src/modules/juvi-app/notifications/receipts.ts` (imports, `applyReceipts`); `backend/src/modules/juvi-app/accounts/session-service.ts:148-152`; `backend/src/modules/juvi-app/errors.ts:11`; `backend/src/modules/juvi-app/middleware/rate-limits.ts:23`; `backend/src/modules/juvi-app/routes.ts:14-18`
- Test: `backend/src/modules/juvi-app/notifications/__tests__/events.test.ts`, `backend/src/modules/juvi-app/accounts/__tests__/session-service.test.ts`, `backend/src/__e2e__/modules/juvi-notifications-mobile.e2e.test.ts`

**Interfaces:**
- Consumes: `JuviEvent`, `JuviEventProps` (Task 1); `verifyReceipt`, `signReceipt` (Task 4); `runSender`, `FakePushTransport` (Tasks 4, 6); `authenticateMobile`, `requireMobile`, `MobileRequest`, `MobileContext` (`middleware/authenticate-mobile.ts`); `limiter()` (`middleware/rate-limits.ts`); `MobileApiError`.
- Produces:
  ```ts
  // accounts/session-service.ts
  export function setPushToken(sessionId: string, collegeId: string, token: string): Promise<void>;   // clears the token from every other session first
  export function clearPushToken(sessionId: string, collegeId: string): Promise<void>;
  // revokeSession(sessionId, reason) now also $unsets pushToken
  // errors.ts: MobileErrorCode gains 'RECEIPT_INVALID'
  // middleware/rate-limits.ts
  export const receiptsLimiter;   // 60 a minute per IP
  // notifications/receipts.ts
  export interface ReceiptInput { deliveryId: string; receipt: string; event: 'delivered' | 'opened'; at: string }
  export function applyReceipts(items: ReceiptInput[], now?: Date): Promise<{ accepted: number; rejected: number }>;
  // notifications/events-service.ts
  export const EVENT_NAMES: readonly [...13 names]; export const EVENTS_MAX = 100, PROPS_MAX_KEYS = 10, PROPS_MAX_BYTES = 1024;
  export const eventItemSchema; export interface ValidEvent { name; at: Date; props: JuviEventProps }
  export function validEvent(raw: unknown): ValidEvent | null;
  export function ingestEvents(ctx: MobileContext, events: unknown[], meta: { appVersion: string; platform: string }, now?: Date): Promise<{ accepted: number; rejected: number }>;
  // notifications/schemas.ts
  export const pushTokenRequestSchema, receiptItemSchema, receiptsRequestSchema, receiptsResponseSchema, eventsRequestSchema, eventsEnvelopeSchema, eventsResponseSchema;
  // notifications/routes.ts
  export const notificationsRouter;   // PUT/DELETE /me/devices/current/push-token, POST /notifications/receipts, POST /events
  ```

The router is mounted on `v1Router` before `spacesRouter` (whose router-wide `authenticateMobile` would otherwise run first) and authenticates per route, because the receipts route has no session at all. Rulings 13–15 apply. The controller parses the events body with the loose `eventsEnvelopeSchema` and validates each event on its own, so one bad event never fails the batch; `eventsRequestSchema` is the documented shape (Task 9).

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/modules/juvi-app/notifications/__tests__/events.test.ts
import { describe, it, expect } from 'vitest';
import { validEvent, EVENT_NAMES } from '../events-service';

const at = '2026-10-02T09:00:00.000Z';

describe('validEvent (spec §7.3, NFR-11)', () => {
  it('accepts every allow-listed name with id-like, numeric and boolean props', () => {
    for (const name of EVENT_NAMES) expect(validEvent({ name, at, props: {} }), name).not.toBeNull();
    expect(validEvent({ name: 'notification.opened', at, props: { tier: 'urgent', noticeId: '6a1b2c3d4e5f6a7b8c9d0e1f', count: 3, granted: true, key: 'a.b:c-d_e' } }))
      .toEqual({ name: 'notification.opened', at: new Date(at), props: { tier: 'urgent', noticeId: '6a1b2c3d4e5f6a7b8c9d0e1f', count: 3, granted: true, key: 'a.b:c-d_e' } });
    expect(validEvent({ name: 'app.opened', at })).toEqual({ name: 'app.opened', at: new Date(at), props: {} });
  });

  it('refuses names outside the allow-list and bad timestamps', () => {
    expect(validEvent({ name: 'notice.body_viewed', at, props: {} })).toBeNull();
    expect(validEvent({ name: 'app.opened', at: 'yesterday', props: {} })).toBeNull();
    expect(validEvent({ name: 'app.opened', props: {} })).toBeNull();
    expect(validEvent('app.opened')).toBeNull();
  });

  it('refuses free text, long strings, nested values and extra fields', () => {
    expect(validEvent({ name: 'settings.changed', at, props: { note: 'I hate maths' } })).toBeNull();                  // spaces: free text
    expect(validEvent({ name: 'settings.changed', at, props: { email: 'a@b.com' } })).toBeNull();                      // @ is not id-like
    expect(validEvent({ name: 'settings.changed', at, props: { k: 'x'.repeat(65) } })).toBeNull();
    expect(validEvent({ name: 'settings.changed', at, props: { k: { nested: 1 } } })).toBeNull();
    expect(validEvent({ name: 'settings.changed', at, props: { k: null } })).toBeNull();
    expect(validEvent({ name: 'settings.changed', at, props: { 'bad key': 1 } })).toBeNull();
    expect(validEvent({ name: 'app.opened', at, props: {}, title: 'Exam' })).toBeNull();
  });

  it('caps props at 10 keys and 1 KB serialised', () => {
    const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`, i]));
    expect(validEvent({ name: 'app.opened', at, props: ten })).not.toBeNull();
    expect(validEvent({ name: 'app.opened', at, props: { ...ten, k10: 10 } })).toBeNull();
    const big = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k${i}`.padEnd(40, 'x'), 'y'.repeat(64)]));
    expect(Buffer.byteLength(JSON.stringify(big))).toBeGreaterThan(1024);
    expect(validEvent({ name: 'app.opened', at, props: big })).toBeNull();
  });
});
```

In `backend/src/modules/juvi-app/accounts/__tests__/session-service.test.ts`, the three `revokeSession` expectations (the `sign_out`, `token_reuse` and `expired` cases) gain `$unset: { pushToken: 1 }`:

```ts
    expect(sessionMock.updateOne).toHaveBeenCalledWith({ _id: 's1', revokedAt: null }, { $set: { revokedAt: expect.any(Date), revokedReason: 'sign_out' }, $unset: { pushToken: 1 } });
```

```ts
      expect(sessionMock.updateOne).toHaveBeenCalledWith({ _id: 's1', revokedAt: null }, { $set: { revokedAt: expect.any(Date), revokedReason: 'token_reuse' }, $unset: { pushToken: 1 } });
```

```ts
      expect(sessionMock.updateOne).toHaveBeenCalledWith({ _id: 's2', revokedAt: null }, { $set: { revokedAt: expect.any(Date), revokedReason: 'expired' }, $unset: { pushToken: 1 } });
```

```ts
// backend/src/__e2e__/modules/juvi-notifications-mobile.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import supertest from 'supertest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, mobileClient } from '../factories/juvi.factory';
import { publishTestNotice } from '../factories/notice.factory';
import { studentOnJuvi, deliveryOf } from '../factories/notification.factory';
import { MobileSession } from '../../models/juvi/MobileSession';
import { NotificationDelivery } from '../../models/juvi/NotificationDelivery';
import { JuviEvent } from '../../models/juvi/JuviEvent';
import { drainOutbox } from '../../shared/outbox';
import { FakePushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';
import { runSender } from '../../modules/juvi-app/notifications/sender';
import { signReceipt } from '../../modules/juvi-app/notifications/receipts';
import { DIGEST_WINDOW_MS } from '../../modules/juvi-app/notifications/policy';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const PUSH = `${V1}/me/devices/current/push-token`;
const RECEIPTS = `${V1}/notifications/receipts`;
const fake = new FakePushTransport();
const REASON = 'Exam postponed by the university';
const tokenOf = async (deviceId: string) => (await MobileSession.findOne({ deviceId, revokedAt: null }).lean())?.pushToken ?? null;

beforeAll(async () => { app = await getTestApp(); setPushTransport(fake); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); fake.reset(); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

let tokenCounter = 0;
/** A sent Urgent notification and the receipt the app received with it. */
async function sentNotification() {
  tokenCounter += 1;
  const s = await studentOnJuvi(app, fx, { pushToken: `tok-r-${tokenCounter}` });
  const n = await publishTestNotice(fx, { priority: 'urgent', urgentReason: REASON });
  const { data } = fake.sent[fake.sent.length - 1]!.message;
  const row = (await deliveryOf(n._id, s.account._id))!;
  return { s, n, row, deliveryId: data.deliveryId!, receipt: data.receipt! };
}

describe('PUT/DELETE /me/devices/current/push-token (spec §7.1)', () => {
  it('sets the token on the caller\'s session, moving it off any other session first', async () => {
    const a = await studentOnJuvi(app, fx);
    const b = await studentOnJuvi(app, fx);
    await mobileClient(app, a.accessToken).put(PUSH).send({ token: 'fcm-1', platform: 'android' }).expect(204);
    expect(await tokenOf(a.deviceId)).toBe('fcm-1');
    await mobileClient(app, b.accessToken).put(PUSH).send({ token: 'fcm-1', platform: 'android' }).expect(204);
    expect(await tokenOf(a.deviceId)).toBeNull();
    expect(await tokenOf(b.deviceId)).toBe('fcm-1');
    expect(await MobileSession.countDocuments({ pushToken: 'fcm-1' })).toBe(1);

    await mobileClient(app, b.accessToken).delete(PUSH).expect(204);
    expect(await tokenOf(b.deviceId)).toBeNull();
  });

  it('validates the body and needs a session', async () => {
    const a = await studentOnJuvi(app, fx);
    const bad = await mobileClient(app, a.accessToken).put(PUSH).send({ token: 'fcm-1', platform: 'ios' }).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    await mobileClient(app, a.accessToken).put(PUSH).send({ token: 'x'.repeat(4097), platform: 'android' }).expect(400);
    await mobileClient(app).put(PUSH).send({ token: 'fcm-1', platform: 'android' }).expect(401);
  });

  it('signing out removes the session\'s token with it', async () => {
    const a = await studentOnJuvi(app, fx, { pushToken: 'fcm-out' });
    await mobileClient(app, a.accessToken).post(`${V1}/auth/sign-out`).expect(204);
    expect(await MobileSession.countDocuments({ pushToken: 'fcm-out' })).toBe(0);
  });
});

describe('POST /notifications/receipts (spec §7.2)', () => {
  it('needs no session: delivered, then opened, each moving the row forward once', async () => {
    const { deliveryId, receipt } = await sentNotification();
    // Inside [sentAt, now], so the clamp leaves it alone.
    const deliveredAt = new Date().toISOString();
    const res = await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId, receipt, event: 'delivered', at: deliveredAt }] }).expect(200);
    expect(res.body).toEqual({ accepted: 1, rejected: 0 });
    expect(await NotificationDelivery.findById(deliveryId).lean()).toMatchObject({ status: 'delivered', deliveredAt: new Date(deliveredAt) });

    const openedAt = new Date().toISOString();
    await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId, receipt, event: 'opened', at: openedAt }] }).expect(200);
    // A late or repeated delivered receipt is a no-op: status only moves forward.
    await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId, receipt, event: 'delivered', at: openedAt }] }).expect(200);
    expect(await NotificationDelivery.findById(deliveryId).lean()).toMatchObject({ status: 'opened', deliveredAt: new Date(deliveredAt), openedAt: new Date(openedAt) });
  });

  it('opened with no delivered receipt back-fills deliveredAt; at is clamped to [sentAt, now]', async () => {
    const { row, deliveryId, receipt } = await sentNotification();
    const before = Date.now();
    await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId, receipt, event: 'opened', at: '2020-01-01T00:00:00.000Z' }] }).expect(200);
    const opened = (await NotificationDelivery.findById(deliveryId).lean())!;
    expect(opened.openedAt).toEqual(row.sentAt);
    expect(opened.deliveredAt).toEqual(row.sentAt);

    const second = await sentNotification();
    await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId: second.deliveryId, receipt: second.receipt, event: 'delivered', at: '2099-01-01T00:00:00.000Z' }] }).expect(200);
    const delivered = (await NotificationDelivery.findById(second.deliveryId).lean())!;
    expect(delivered.deliveredAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(delivered.deliveredAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('skips forged and expired receipts, and is 401 RECEIPT_INVALID only when every item fails', async () => {
    const { deliveryId, receipt } = await sentNotification();
    const at = new Date().toISOString();
    const forged = `${'A'.repeat(43)}.${receipt.split('.')[1]}`;
    const expired = signReceipt(deliveryId, new Date(Date.now() - 1_000));
    const mixed = await supertest(app).post(RECEIPTS).send({ items: [
      { deliveryId, receipt: forged, event: 'opened', at },
      { deliveryId, receipt, event: 'delivered', at },
    ] }).expect(200);
    expect(mixed.body).toEqual({ accepted: 1, rejected: 1 });
    const none = await supertest(app).post(RECEIPTS).send({ items: [
      { deliveryId, receipt: forged, event: 'opened', at },
      { deliveryId, receipt: expired, event: 'opened', at },
    ] }).expect(401);
    expect(none.body.error.code).toBe('RECEIPT_INVALID');
    expect((await NotificationDelivery.findById(deliveryId).lean())!.status).toBe('delivered');
    await supertest(app).post(RECEIPTS).send({ items: [] }).expect(400);
  });

  it('a Routine digest\'s receipt moves every row sent with it', async () => {
    const s = await studentOnJuvi(app, fx, { pushToken: 'tok-digest' });
    const a = await publishTestNotice(fx, { priority: 'routine', title: 'A' });
    const b = await publishTestNotice(fx, { priority: 'routine', title: 'B' });
    await runSender(new Date(Date.now() + DIGEST_WINDOW_MS + 60_000), fake);
    const { data } = fake.sent[0]!.message;
    await supertest(app).post(RECEIPTS).send({ items: [{ deliveryId: data.deliveryId, receipt: data.receipt, event: 'delivered', at: new Date().toISOString() }] }).expect(200);
    for (const n of [a, b]) expect((await deliveryOf(n._id, s.account._id))!.status).toBe('delivered');
  });
});

describe('POST /events (spec §7.3)', () => {
  it('stores allow-listed events with the caller, app version and platform; drops invalid ones one by one', async () => {
    const s = await studentOnJuvi(app, fx);
    const at = new Date().toISOString();
    const res = await mobileClient(app, s.accessToken).post(`${V1}/events`).send({ events: [
      { name: 'app.opened', at, props: {} },
      { name: 'notification.opened', at, props: { tier: 'urgent', count: 1 } },
      { name: 'notice.body_viewed', at, props: {} },
      { name: 'settings.changed', at, props: { note: 'free text here' } },
    ] }).expect(200);
    expect(res.body).toEqual({ accepted: 2, rejected: 2 });
    const rows = await JuviEvent.find({ accountId: s.account._id }).sort({ name: 1 }).lean();
    expect(rows.map((r) => r.name)).toEqual(['app.opened', 'notification.opened']);
    expect(rows[1]).toMatchObject({ props: { tier: 'urgent', count: 1 }, appVersion: '1.0.0', platform: 'android' });
    expect(String(rows[0]!.collegeId)).toBe(fx.collegeId);
  });

  it('takes 1–100 events per request and needs a session', async () => {
    const s = await studentOnJuvi(app, fx);
    const one = { name: 'app.opened', at: new Date().toISOString(), props: {} };
    await mobileClient(app, s.accessToken).post(`${V1}/events`).send({ events: [] }).expect(400);
    await mobileClient(app, s.accessToken).post(`${V1}/events`).send({ events: Array(101).fill(one) }).expect(400);
    await mobileClient(app).post(`${V1}/events`).send({ events: [one] }).expect(401);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/notifications/__tests__/events.test.ts src/modules/juvi-app/accounts && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-mobile.e2e.test.ts`
Expected: FAIL — `../events-service` does not exist; the session expectations miss `$unset`; the e2e routes return 404.

- [ ] **Step 3: Sessions carry and lose their push token**

`backend/src/modules/juvi-app/accounts/session-service.ts` — replace `revokeSession` (lines 148-152) and add the two token functions after it:

```ts
export async function revokeSession(sessionId: string, reason: RevokeReason): Promise<void> {
  // The session's push token goes with it (notifications spec §7.1): a revoked device gets no more notifications.
  await MobileSession.updateOne({ _id: sessionId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason }, $unset: { pushToken: 1 } });
  // Write-through so the very next request on that device sees it (spec §8).
  await cacheState(sessionId, `revoked:${reason}`, REVOKED_CACHE_SECONDS);
}

/**
 * Moves an FCM token to this session (notifications spec §7.1). The token is first cleared
 * from every other session — across colleges, deliberately: a token names one phone, and
 * the unique index on pushToken is global. A concurrent move can still collide; retry it.
 */
export async function setPushToken(sessionId: string, collegeId: string, token: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    await MobileSession.updateMany({ pushToken: token, _id: { $ne: sessionId } }, { $unset: { pushToken: 1 } });
    try {
      await MobileSession.updateOne({ _id: sessionId, collegeId, revokedAt: null }, { $set: { pushToken: token } });
      return;
    } catch (err) {
      if ((err as { code?: number } | null)?.code !== 11000 || attempt >= 3) throw err;
    }
  }
}

export async function clearPushToken(sessionId: string, collegeId: string): Promise<void> {
  await MobileSession.updateOne({ _id: sessionId, collegeId }, { $unset: { pushToken: 1 } });
}
```

`revokeOtherSessions` (sign-out everywhere, password change, deactivation, reset) calls `revokeSession` per session, so it needs no change.

- [ ] **Step 4: The error code and the limiter**

`backend/src/modules/juvi-app/errors.ts` line 11:

```ts
  | 'REMINDER_LIMIT' | 'ACK_REQUIRED' | 'ACK_NOT_REQUIRED'
  // Juvi notifications (notifications spec §7.2): every receipt in the request failed verification
  | 'RECEIPT_INVALID';
```

`backend/src/modules/juvi-app/middleware/rate-limits.ts`, after line 23:

```ts
/** 60 notification receipt posts per minute per IP: the endpoint has no session (notifications spec §7.2). */
export const receiptsLimiter = limiter(60);
```

- [ ] **Step 5: Apply receipts**

In `backend/src/modules/juvi-app/notifications/receipts.ts`, add after the `node:crypto` import:

```ts
import { Types } from 'mongoose';
import { NotificationDelivery, LeanNotificationDelivery } from '../../../models/juvi/NotificationDelivery';
```

and append:

```ts
export interface ReceiptInput { deliveryId: string; receipt: string; event: 'delivered' | 'opened'; at: string }

/**
 * Applies one verified receipt. The receipt carries no collegeId, so the row is
 * found by its id (the HMAC is the authorisation) and every write is scoped by the
 * row's own collegeId. Status only moves forward; `at` is clamped to [sentAt, now].
 * A Routine digest went out as one notification for several rows (same account,
 * batch key and sentAt), so its receipt moves all of them.
 */
async function applyReceipt(item: ReceiptInput, now: Date): Promise<void> {
  const row = await NotificationDelivery.findById(item.deliveryId).select('collegeId accountId batchKey tier sentAt').lean<LeanNotificationDelivery>();
  if (!row?.sentAt) return;
  const at = new Date(Math.min(Math.max(new Date(item.at).getTime(), row.sentAt.getTime()), now.getTime()));
  const scope = row.tier === 'routine'
    ? { collegeId: row.collegeId, accountId: row.accountId, batchKey: row.batchKey, tier: 'routine', sentAt: row.sentAt }
    : { _id: row._id, collegeId: row.collegeId };
  if (item.event === 'delivered') {
    await NotificationDelivery.updateMany({ ...scope, status: 'sent' }, { $set: { status: 'delivered', deliveredAt: at } });
  } else {
    // `openedAt` implies `deliveredAt`: back-filled with the opened time when no delivered receipt arrived.
    await NotificationDelivery.updateMany(
      { ...scope, status: { $in: ['sent', 'delivered'] } },
      [{ $set: { status: 'opened', openedAt: at, deliveredAt: { $ifNull: ['$deliveredAt', at] } } }],
    );
  }
}

/** Verifies and applies each item; a bad or expired receipt is skipped and counted as rejected. */
export async function applyReceipts(items: ReceiptInput[], now: Date = new Date()): Promise<{ accepted: number; rejected: number }> {
  let accepted = 0;
  for (const item of items) {
    if (!Types.ObjectId.isValid(item.deliveryId) || !verifyReceipt(item.deliveryId, item.receipt, now)) continue;
    accepted += 1;
    await applyReceipt(item, now);
  }
  return { accepted, rejected: items.length - accepted };
}
```

- [ ] **Step 6: Events, the contract schemas, the controller and the routes**

```ts
// backend/src/modules/juvi-app/notifications/events-service.ts
/**
 * Product analytics from the app (notifications spec §7.3, NFR-11). Only
 * allow-listed names, and props that are ids, enums, numbers or booleans — that
 * is how "no content or PII" is enforced on the server. Invalid events are
 * dropped one by one.
 */
import { z } from 'zod';
import { JuviEvent, JuviEventProps } from '../../../models/juvi/JuviEvent';
import { MobileContext } from '../middleware/authenticate-mobile';

export const EVENT_NAMES = [
  'app.opened', 'account.signed_in',
  'onboarding.step_completed', 'onboarding.completed',
  'settings.changed', 'channel.muted',
  'notice.seen', 'notice.acknowledged', 'notice.dismissed',
  'notification.opened', 'notification.permission',
  'permission_card.shown', 'permission_card.dismissed',
] as const;

export const EVENTS_MAX = 100;
export const PROPS_MAX_KEYS = 10;
export const PROPS_MAX_BYTES = 1024;
const PROP_STRING = /^[A-Za-z0-9_.:-]*$/;
const propString = z.string().max(64).regex(PROP_STRING);

/** One event. Each prop value is a string of ≤ 64 id-like characters, a number or a boolean: free text is refused. */
export const eventItemSchema = z.object({
  name: z.enum(EVENT_NAMES),
  at: z.string().datetime({ offset: true }),
  props: z.record(propString, z.union([propString, z.number().finite(), z.boolean()]))
    .refine((p) => Object.keys(p).length <= PROPS_MAX_KEYS, `At most ${PROPS_MAX_KEYS} props`)
    .refine((p) => Buffer.byteLength(JSON.stringify(p)) <= PROPS_MAX_BYTES, 'Props must serialise to 1 KB or less')
    .default({}),
}).strict();

export interface ValidEvent { name: (typeof EVENT_NAMES)[number]; at: Date; props: JuviEventProps }

/** The event if it passes every rule, otherwise null. */
export function validEvent(raw: unknown): ValidEvent | null {
  const r = eventItemSchema.safeParse(raw);
  return r.success ? { name: r.data.name, at: new Date(r.data.at), props: r.data.props } : null;
}

export async function ingestEvents(
  ctx: MobileContext, events: unknown[], meta: { appVersion: string; platform: string }, now: Date = new Date(),
): Promise<{ accepted: number; rejected: number }> {
  const valid = events.map(validEvent).filter((e): e is ValidEvent => e !== null);
  if (valid.length > 0) {
    await JuviEvent.insertMany(valid.map((e) => ({
      collegeId: ctx.collegeId, accountId: ctx.accountId, name: e.name, at: e.at, props: e.props,
      appVersion: meta.appVersion.slice(0, 32), platform: meta.platform.slice(0, 16), receivedAt: now,
    })));
  }
  return { accepted: valid.length, rejected: events.length - valid.length };
}
```

```ts
// backend/src/modules/juvi-app/notifications/schemas.ts
/**
 * Mobile contract for notifications (notifications spec §7.1–§7.3). No
 * object-or-null fields (Foundation rulings R57/R61).
 */
import { z } from 'zod';
import { eventItemSchema, EVENTS_MAX } from './events-service';

export const pushTokenRequestSchema = z.object({
  token: z.string().min(1).max(4096),
  /** Android only in R1; iOS arrives with sub-project 7. */
  platform: z.enum(['android']),
}).strict();

export const receiptItemSchema = z.object({
  deliveryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id'),
  receipt: z.string().min(1).max(200),
  event: z.enum(['delivered', 'opened']),
  at: z.string().datetime({ offset: true }),
});
export type ReceiptItem = z.infer<typeof receiptItemSchema>;
export const receiptsRequestSchema = z.object({ items: z.array(receiptItemSchema).min(1).max(50) }).strict();
export const receiptsResponseSchema = z.object({ accepted: z.number().int(), rejected: z.number().int() });

/**
 * The documented request. The Dart generator cannot build a string-or-number-or-boolean
 * map value, so the contract types `props` as a plain map; `validEvent` enforces the
 * prop rules. The controller parses the looser envelope so one bad event never fails the batch.
 */
const documentedEventSchema = eventItemSchema.extend({
  props: z.record(z.string(), z.unknown()).optional()
    .describe('Up to 10 keys, 1 KB serialised; each value a string of at most 64 characters matching ^[A-Za-z0-9_.:-]*$, a number or a boolean.'),
});
export const eventsRequestSchema = z.object({ events: z.array(documentedEventSchema).min(1).max(EVENTS_MAX) }).strict();
export const eventsEnvelopeSchema = z.object({ events: z.array(z.unknown()).min(1).max(EVENTS_MAX) }).strict();
export const eventsResponseSchema = z.object({ accepted: z.number().int(), rejected: z.number().int() });
```

```ts
// backend/src/modules/juvi-app/notifications/controller.ts
import { Request, Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { setPushToken, clearPushToken } from '../accounts/session-service';
import { MobileApiError } from '../errors';
import { pushTokenRequestSchema, receiptsRequestSchema, eventsEnvelopeSchema } from './schemas';
import { applyReceipts } from './receipts';
import { ingestEvents } from './events-service';

export async function putPushToken(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    await setPushToken(ctx.sessionId, ctx.collegeId, pushTokenRequestSchema.parse(req.body).token);
    res.status(204).end();
  } catch (e) { next(e); }
}

export async function deletePushToken(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    await clearPushToken(ctx.sessionId, ctx.collegeId);
    res.status(204).end();
  } catch (e) { next(e); }
}

/** No session: each item's HMAC receipt authorises its row (spec §7.2). 401 only when every item fails. */
export async function postReceipts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await applyReceipts(receiptsRequestSchema.parse(req.body).items);
    if (result.accepted === 0) throw new MobileApiError(401, 'RECEIPT_INVALID', 'No receipt could be verified.');
    res.json(result);
  } catch (e) { next(e); }
}

export async function postEvents(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    const meta = { appVersion: String(req.headers['x-juvi-app-version'] ?? ''), platform: String(req.headers['x-juvi-platform'] ?? '') };
    res.json(await ingestEvents(ctx, eventsEnvelopeSchema.parse(req.body).events, meta));
  } catch (e) { next(e); }
}
```

```ts
// backend/src/modules/juvi-app/notifications/routes.ts
import { Router } from 'express';
import { authenticateMobile } from '../middleware/authenticate-mobile';
import { receiptsLimiter } from '../middleware/rate-limits';
import * as ctrl from './controller';

/**
 * Mobile notification routes under /api/juvi-app/v1 (notifications spec §7.1–§7.3).
 * Authenticated per route, never router-wide: v1Router mounts this router before
 * spacesRouter, and the receipts route has no session at all.
 */
export const notificationsRouter = Router();
notificationsRouter.put('/me/devices/current/push-token', authenticateMobile, ctrl.putPushToken);
notificationsRouter.delete('/me/devices/current/push-token', authenticateMobile, ctrl.deletePushToken);
// Posted from Android's background isolate, where the access token has usually expired.
notificationsRouter.post('/notifications/receipts', receiptsLimiter, ctrl.postReceipts);
notificationsRouter.post('/events', authenticateMobile, ctrl.postEvents);
```

In `backend/src/modules/juvi-app/routes.ts`, after the `registerNotificationConsumers` import (Task 5):

```ts
import { notificationsRouter } from './notifications/routes';
```

and replace the comment and mount before `spacesRouter` (lines 16-18):

```ts
// Before spacesRouter: its router-wide authenticateMobile would otherwise run first for these paths too
// (and /notifications/receipts has no session at all).
v1Router.use(noticesRouter);
v1Router.use(notificationsRouter);
v1Router.use(spacesRouter);
```

- [ ] **Step 7: Run the tests**

Run: `cd backend && npx vitest run src/modules/juvi-app && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications src/__e2e__/modules/juvi-app-me.e2e.test.ts src/__e2e__/modules/juvi-app-config.e2e.test.ts && npx tsc --noEmit`
Expected: PASS (events 4, mobile e2e 9; the OpenAPI drift test still passes because no documented schema changed yet); typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/juvi-app/notifications backend/src/modules/juvi-app/accounts/session-service.ts \
  backend/src/modules/juvi-app/accounts/__tests__/session-service.test.ts backend/src/modules/juvi-app/errors.ts \
  backend/src/modules/juvi-app/middleware/rate-limits.ts backend/src/modules/juvi-app/routes.ts \
  backend/src/__e2e__/modules/juvi-notifications-mobile.e2e.test.ts
git commit -m "feat(juvi-app): push-token PUT/DELETE, session-less HMAC receipts, allow-listed /v1/events

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: The mobile contract — document the three endpoints, regenerate the OpenAPI file and the Dart client

**Files:**
- Modify: `backend/src/modules/juvi-app/openapi/document.ts:9-14` (imports), `:20-24` (error codes), `:97` (components), `:130` (routes); `mobile/api/openapi.json` (regenerated); `mobile/packages/juvi_api/**` (regenerated)
- Test: `backend/src/modules/juvi-app/openapi/__tests__/document.test.ts`; `mobile/tool/check_nullable_objects.js` (run, unchanged); `flutter analyze`, `flutter test --exclude-tags golden`

**Interfaces:**
- Consumes: `pushTokenRequestSchema`, `receiptsRequestSchema`, `receiptsResponseSchema`, `eventsRequestSchema`, `eventsResponseSchema` (Task 8).
- Produces: components `PushTokenRequest`, `ReceiptsRequest`, `ReceiptsResult`, `EventsRequest`, `EventsResult`; error code `RECEIPT_INVALID`; operations (the Dart method names on `MobileApi`):

| Path | Method | operationId | Auth | Errors |
|---|---|---|---|---|
| `/me/devices/current/push-token` | put | `registerPushToken` (204) | bearer | 400, 401 |
| `/me/devices/current/push-token` | delete | `clearPushToken` (204) | bearer | 401 |
| `/notifications/receipts` | post | `postNotificationReceipts` | none | 400, 401, 429 |
| `/events` | post | `postEvents` | bearer | 400, 401 |

None of the new schemas has an object-or-null field, so `check_nullable_objects.js` passes with its allowlist unchanged. Rulings 15 and 21 apply: `EventsRequest.events[].props` is `{ type: object, additionalProperties: {} }` in the contract, and the regenerated client also gains `SettingsPatchQuietHours`.

- [ ] **Step 1: Write the failing test**

In `backend/src/modules/juvi-app/openapi/__tests__/document.test.ts`, add the three paths to `EXPECTED_PATHS` after `'/onboarding/first-notice',`:

```ts
  '/me/devices/current/push-token', '/notifications/receipts', '/events',
```

replace the component list in `'names every component and operation …'` with:

```ts
    expect(Object.keys(doc.components.schemas).sort()).toEqual([
      'AckRequest', 'AckResult', 'Attention', 'ChangePasswordRequest', 'ChannelDetail', 'Config', 'Devices', 'DismissResult',
      'ErrorEnvelope', 'EventsRequest', 'EventsResult', 'InstitutionLookup', 'Me', 'MuteResult', 'NoticeAttachment', 'NoticeAttachmentUrl', 'NoticeCard',
      'NoticeDetail', 'NoticeList', 'NoticePending', 'NoticeReach', 'NoticeReminders', 'OnboardingAdvance', 'OnboardingState',
      'PendingPerson', 'PhotoResult', 'PushTokenRequest', 'ReachComment', 'ReachGroup', 'ReachPerson', 'ReadResult', 'ReceiptsRequest', 'ReceiptsResult',
      'RefreshRequest', 'RemindResult', 'RevokedCount', 'SeenResult', 'SettingsPatch', 'Settings', 'SignInRequest', 'SignInResponse', 'Spaces', 'Tokens',
    ].sort());
```

and add before `it('stableStringify orders keys …')`:

```ts
  it('describes the notification endpoints: the receipts route has no session', () => {
    expect(doc.paths['/notifications/receipts'].post.security).toBeUndefined();
    expect(doc.paths['/notifications/receipts'].post.operationId).toBe('postNotificationReceipts');
    expect(doc.paths['/me/devices/current/push-token'].put.operationId).toBe('registerPushToken');
    expect(doc.paths['/me/devices/current/push-token'].delete.responses['204']).toBeDefined();
    expect(doc.paths['/events'].post.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.components.schemas.ErrorEnvelope.properties.error.properties.code.enum).toContain('RECEIPT_INVALID');
    expect(doc.components.schemas.EventsRequest.properties.events.items.properties.props).toMatchObject({ type: 'object', additionalProperties: {} });
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run src/modules/juvi-app/openapi`
Expected: FAIL — the three paths and five components are missing.

- [ ] **Step 3: Document the endpoints**

`backend/src/modules/juvi-app/openapi/document.ts` — after the `../notices/schemas` import (line 14):

```ts
import {
  pushTokenRequestSchema, receiptsRequestSchema, receiptsResponseSchema, eventsRequestSchema, eventsResponseSchema,
} from '../notifications/schemas';
```

in the `ErrorEnvelope` code enum, after the notices codes (line 23):

```ts
      // Juvi notifications
      'RECEIPT_INVALID',
```

in `C`, after `RemindResult: registry.register('RemindResult', remindResponseSchema),` (line 97):

```ts
    PushTokenRequest: registry.register('PushTokenRequest', pushTokenRequestSchema),
    ReceiptsRequest: registry.register('ReceiptsRequest', receiptsRequestSchema),
    ReceiptsResult: registry.register('ReceiptsResult', receiptsResponseSchema),
    EventsRequest: registry.register('EventsRequest', eventsRequestSchema),
    EventsResult: registry.register('EventsResult', eventsResponseSchema),
```

and in `routes`, before the `getFirstNotice` entry (line 130):

```ts
    { operationId: 'registerPushToken', method: 'put', path: '/me/devices/current/push-token', summary: 'Register this device\'s FCM token (cleared from any other session first)', auth: true, body: C.PushTokenRequest, status: 204, errors: [400, 401] },
    { operationId: 'clearPushToken', method: 'delete', path: '/me/devices/current/push-token', summary: 'Remove this device\'s FCM token', auth: true, status: 204, errors: [401] },
    { operationId: 'postNotificationReceipts', method: 'post', path: '/notifications/receipts', summary: 'Delivered and opened receipts; each item is authorised by its HMAC receipt, not a session', auth: false, body: C.ReceiptsRequest, response: C.ReceiptsResult, errors: [400, 401, 429] },
    { operationId: 'postEvents', method: 'post', path: '/events', summary: 'Product analytics: allow-listed names, id-like props; invalid events are dropped one by one', auth: true, body: C.EventsRequest, response: C.EventsResult, errors: [400, 401] },
```

- [ ] **Step 4: Regenerate the contract and run the backend checks**

Run: `npm run openapi:mobile -w backend && node mobile/tool/check_nullable_objects.js mobile/api/openapi.json && (cd backend && npx vitest run src/modules/juvi-app/openapi && npx tsc --noEmit)`
Expected: `wrote …/mobile/api/openapi.json`; `object-or-null check passed (6 known field(s), all parsed via raw Dio)`; document tests PASS (7, the drift check included); typecheck clean.

- [ ] **Step 5: Regenerate the Dart client and run the app checks**

Run (from `mobile/`, Java 17+ and Node on the path): `./tool/gen_api.sh`
Expected: `object-or-null check passed (6 known field(s), all parsed via raw Dio)`, the generator log, `Built with build_runner`, `juvi_api regenerated`. It rewrites `mobile/packages/juvi_api` from `mobile/api/openapi.json` with generator 7.10.0 (pinned in `mobile/openapitools.json`). If your environment cannot run the script, run its steps by hand in order: `node tool/check_nullable_objects.js api/openapi.json`; `rm -rf packages/juvi_api`; the `npx --yes @openapitools/openapi-generator-cli generate …` line from the script; the two `perl -pi -e` lines in `packages/juvi_api`; `dart pub get && dart run build_runner build --delete-conflicting-outputs` there; `flutter pub get` back in `mobile/`.

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden`
Expected: `No issues found!`; `All tests passed!` (203 in the dry run). New generated models: `PushTokenRequest`, `ReceiptsRequest`, `ReceiptsRequestItemsInner`, `ReceiptsResult`, `EventsRequest`, `EventsRequestEventsInner`, `EventsResult`, and `SettingsPatchQuietHours`; `MobileApi` gains `registerPushToken`, `clearPushToken`, `postNotificationReceipts`, `postEvents`. Plan 3 calls these; nothing in `lib/` changes here.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/juvi-app/openapi mobile/api/openapi.json mobile/packages/juvi_api
git commit -m "feat(juvi-app): push token, receipts and events in the mobile OpenAPI contract; regenerate the Dart client

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Reach delivery diagnostics — mobile and admin, the CSV column, and the contract

**Files:**
- Modify: `backend/src/modules/juvi-app/notices/schemas.ts:96`, `:119-121`, `:132-135`; `backend/src/modules/juvi-app/notices/reach-service.ts:8`, `:20`, `:126`, `:158`, `:176`, `:193`, `:200`, `:221-237`; `mobile/api/openapi.json`, `mobile/packages/juvi_api/**` (regenerated); `mobile/test/core/repos/notices_fixtures.dart:98-143`
- Test: `backend/src/modules/juvi-app/notices/__tests__/reach.test.ts`, `backend/src/modules/juvi-app/openapi/__tests__/document.test.ts`, `backend/src/__e2e__/modules/juvi-notifications-reach.e2e.test.ts`, `backend/src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts:131`

**Interfaces:**
- Consumes: `NotificationDelivery`, `DeliveryStatus`, `DeliveryReason` (Task 1); the whole pipeline (Tasks 5–8) for the e2e scenario.
- Produces:
  ```ts
  // notices/schemas.ts
  export const deliveryCountsSchema;   // { scheduled, sent, delivered, opened, failed, cancelled, suppressed: { muted, tierOff, noDevice } }
  export type DeliveryCounts = z.infer<typeof deliveryCountsSchema>;
  export const PENDING_DELIVERY_STATES = ['not_delivered', 'delivered', 'opened', 'muted', 'tier_off', 'no_device', 'scheduled', 'none'] as const;
  export type PendingDelivery = (typeof PENDING_DELIVERY_STATES)[number];
  // ReachResponse gains delivery: DeliveryCounts; each pending person gains delivery: PendingDelivery
  // notices/reach-service.ts
  export function deliveryState(onJuvi: boolean, row: { status: DeliveryStatus; reason: DeliveryReason | null } | undefined): PendingDelivery;
  export function deliveryCounts(collegeId: string, noticeId: Types.ObjectId): Promise<DeliveryCounts>;
  // reachCsv: a trailing Delivery column
  ```

`buildReach`, `pendingPage` and `reachCsv` are shared by `GET /v1/notices/:id/reach[/pending]` (`notices/mobile-controller.ts:42`, `:51`) and the admin routes (`notices/admin-controller.ts:91`, `:97`, `:107`), so one change covers mobile and admin. The counts aggregate over the `(collegeId, source.id, status)` index. No device details leave the server. Rulings 17 and 18 apply. Changing `reachResponseSchema` and `pendingPersonSchema` changes the contract, so this task regenerates it in the same commit (the drift test would fail otherwise).

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/modules/juvi-app/notices/__tests__/reach.test.ts` (and add `deliveryState` to its `../reach-service` import):

```ts
describe('deliveryState (notifications spec §7.4)', () => {
  it('maps a pending member\'s notification row to the Reach delivery column', () => {
    expect(deliveryState(true, { status: 'sent', reason: null })).toBe('not_delivered');
    expect(deliveryState(true, { status: 'failed', reason: null })).toBe('not_delivered');
    expect(deliveryState(true, { status: 'delivered', reason: null })).toBe('delivered');
    expect(deliveryState(true, { status: 'opened', reason: null })).toBe('opened');
    expect(deliveryState(true, { status: 'scheduled', reason: null })).toBe('scheduled');
    expect(deliveryState(true, { status: 'suppressed', reason: 'muted' })).toBe('muted');
    expect(deliveryState(true, { status: 'suppressed', reason: 'tier_off' })).toBe('tier_off');
    expect(deliveryState(true, { status: 'suppressed', reason: 'no_device' })).toBe('no_device');
  });

  it('is none for someone not on Juvi, a cancelled row, or no row at all', () => {
    expect(deliveryState(false, undefined)).toBe('none');
    expect(deliveryState(false, { status: 'sent', reason: null })).toBe('none');
    expect(deliveryState(true, undefined)).toBe('none');
    expect(deliveryState(true, { status: 'cancelled', reason: 'acknowledged' })).toBe('none');
  });
});
```

Add to `backend/src/modules/juvi-app/openapi/__tests__/document.test.ts`, before `it('stableStringify orders keys …')`:

```ts
  it('Reach carries the delivery block, and each pending member its delivery state', () => {
    expect(doc.components.schemas.NoticeReach.required).toContain('delivery');
    expect(doc.components.schemas.NoticeReach.properties.delivery.properties.suppressed.required).toEqual(['muted', 'tierOff', 'noDevice']);
    expect(doc.components.schemas.PendingPerson.properties.delivery.enum).toEqual(
      ['not_delivered', 'delivered', 'opened', 'muted', 'tier_off', 'no_device', 'scheduled', 'none'],
    );
  });
```

In `backend/src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts` line 131, the CSV header gains the column:

```ts
    expect(lines[0]).toBe('Name,Identifier,Group,Status,Acknowledged at,Late,Seen at,Comment,Added later,Delivery');
```

```ts
// backend/src/__e2e__/modules/juvi-notifications-reach.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import supertest from 'supertest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient } from '../factories/juvi.factory';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { activateAccount, publishTestNotice, signInAs, erpRef } from '../factories/notice.factory';
import { studentOnJuvi, quietHoursAround } from '../factories/notification.factory';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { drainOutbox } from '../../shared/outbox';
import { FakePushTransport, setPushTransport } from '../../modules/juvi-app/notifications/transport';

process.env.E2E_TESTING = '1';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const A = '/api/juvi-app/admin/notices';
const fake = new FakePushTransport();

beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); setPushTransport(fake); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); fake.reset(); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); setPushTransport(null); });

/**
 * A faculty publisher and one course whose six students each end in a different
 * delivery state for an Important acknowledgement notice.
 */
async function scenario() {
  const fac = await provisionTestFaculty(fx);
  await activateAccount(String(fac.account._id));
  const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id) });
  const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
  await off.updateOne({ $set: { status: 'active' } });
  const enrol = (studentId: unknown) => createTestEnrollment(fx.collegeId, { studentId: String(studentId), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });

  const sent = await studentOnJuvi(app, fx, { pushToken: 'tok-sent' });
  const delivered = await studentOnJuvi(app, fx, { pushToken: 'tok-delivered' });
  const noDevice = await studentOnJuvi(app, fx);
  const tierOff = await studentOnJuvi(app, fx, { pushToken: 'tok-tier-off' });
  await JuviAccount.updateOne({ _id: tierOff.account._id }, { $set: { 'settings.tiers.important': false } });
  const held = await studentOnJuvi(app, fx, { pushToken: 'tok-held' });
  await JuviAccount.updateOne({ _id: held.account._id }, { $set: { 'settings.quietHours': quietHoursAround(new Date()) } });
  const offJuvi = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  for (const s of [sent, delivered, noDevice, tierOff, held, offJuvi]) await enrol(s.student._id);

  const notice = await publishTestNotice(fx, {
    title: 'Lab safety', priority: 'important', ackRequired: true,
    audience: { rules: [{ kind: 'course_offering', ids: [String(off._id)] }] },
  }, erpRef(fac.user));
  const { data } = fake.sent.find((m) => m.tokens.includes('tok-delivered'))!.message;
  await supertest(app).post(`${V1}/notifications/receipts`)
    .send({ items: [{ deliveryId: data.deliveryId, receipt: data.receipt, event: 'delivered', at: new Date().toISOString() }] }).expect(200);
  const facToken = await signInAs(app, fx, fac.faculty.employeeCode, fac.tempPassword, 'device-fac');
  const expected = new Map([
    [sent.person.name, 'not_delivered'], [delivered.person.name, 'delivered'], [noDevice.person.name, 'no_device'],
    [tierOff.person.name, 'tier_off'], [held.person.name, 'scheduled'], [offJuvi.person.name, 'none'],
  ]);
  return { notice, facToken, expected, delivered };
}

const DELIVERY = { scheduled: 1, sent: 1, delivered: 1, opened: 0, failed: 0, cancelled: 0, suppressed: { muted: 0, tierOff: 1, noDevice: 1 } };
const byName = (items: { name: string; delivery: string }[]) => new Map(items.map((p) => [p.name, p.delivery]));

describe('Reach delivery diagnostics (notifications spec §7.4, NTF-05)', () => {
  it('mobile: the reach block counts the published notification by status, and each pending member carries a delivery state', async () => {
    const { notice, facToken, expected } = await scenario();
    const reach = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach`).expect(200);
    expect(reach.body.delivery).toEqual(DELIVERY);
    const pending = await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach/pending`).expect(200);
    expect(byName(pending.body.items)).toEqual(expected);
    expect(JSON.stringify(pending.body)).not.toMatch(/tok-|deliveryId|pushToken/);
  });

  it('admin: the same block, the same pending column, and a Delivery column in the CSV', async () => {
    const { notice, expected, delivered } = await scenario();
    expect((await api.as(fx.admin.token).get(`${A}/${notice._id}/reach`).expect(200)).body.delivery).toEqual(DELIVERY);
    expect(byName((await api.as(fx.admin.token).get(`${A}/${notice._id}/reach/pending`).expect(200)).body.items)).toEqual(expected);
    const csv = (await api.as(fx.admin.token).get(`${A}/${notice._id}/reach.csv`).expect(200)).text.trim().split('\n');
    expect(csv[0]!.endsWith(',Delivery')).toBe(true);
    expect(csv.find((l) => l.startsWith(delivered.person.name))!.endsWith(',Delivered')).toBe(true);
  });

  it('reminder rows are not counted', async () => {
    const { notice, facToken } = await scenario();
    await mobileClient(app, facToken).post(`${V1}/notices/${notice._id}/remind`).expect(200);
    await drainOutbox();
    expect((await mobileClient(app, facToken).get(`${V1}/notices/${notice._id}/reach`).expect(200)).body.delivery).toEqual(DELIVERY);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd backend && npx vitest run src/modules/juvi-app/notices/__tests__/reach.test.ts src/modules/juvi-app/openapi && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-reach.e2e.test.ts src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts`
Expected: FAIL — `deliveryState` is not exported; `NoticeReach` has no `delivery`; the reach body has no `delivery` block; the CSV header lacks `Delivery`.

- [ ] **Step 3: Add the delivery schemas**

`backend/src/modules/juvi-app/notices/schemas.ts` — after `export type ReachGroup = z.infer<typeof reachGroupSchema>;` (line 96):

```ts
/**
 * Push delivery for the published notification (notifications spec §7.4): rows by
 * current status, so the counts are disjoint, with suppressed split by reason.
 */
export const deliveryCountsSchema = z.object({
  scheduled: z.number().int(), sent: z.number().int(), delivered: z.number().int(), opened: z.number().int(),
  failed: z.number().int(), cancelled: z.number().int(),
  suppressed: z.object({ muted: z.number().int(), tierOff: z.number().int(), noDevice: z.number().int() }),
});
export type DeliveryCounts = z.infer<typeof deliveryCountsSchema>;
/** A pending member's push state; `none` is someone not on Juvi (or with no notification row). */
export const PENDING_DELIVERY_STATES = ['not_delivered', 'delivered', 'opened', 'muted', 'tier_off', 'no_device', 'scheduled', 'none'] as const;
export type PendingDelivery = (typeof PENDING_DELIVERY_STATES)[number];
```

In `reachResponseSchema`, between the `addedLater` object (ends line 120) and `asOf`:

```ts
  delivery: deliveryCountsSchema,
```

and in `pendingPersonSchema`, after `lastSeenInApp: z.string().nullable(),` (line 134):

```ts
  delivery: z.enum(PENDING_DELIVERY_STATES),
```

- [ ] **Step 4: Compute them in the reach service**

`backend/src/modules/juvi-app/notices/reach-service.ts` — after the `MobileSession` import (line 8):

```ts
import { NotificationDelivery, DeliveryStatus, DeliveryReason } from '../../../models/juvi/NotificationDelivery';
```

line 20 imports the two new types:

```ts
import { ReachResponse, ReachGroup, PendingQuery, PendingResponse, Reminders, DeliveryCounts, PendingDelivery } from './schemas';
```

before `const COUNT_KEY` (line 127):

```ts
type DeliveryRow = { status: DeliveryStatus; reason: DeliveryReason | null };
const SUPPRESSED_KEY: Partial<Record<DeliveryReason, keyof DeliveryCounts['suppressed']>> = { muted: 'muted', tier_off: 'tierOff', no_device: 'noDevice' };
/** Rows of the published notification only; reminders are not counted (notifications spec §7.4). */
const publishedRows = (collegeId: string, noticeId: Types.ObjectId) =>
  ({ collegeId: new Types.ObjectId(collegeId), 'source.type': 'notice', 'source.id': noticeId, 'source.kind': 'published' });

/** A pending member's push state. Sent-but-no-receipt and failed are both "not delivered"; cancelled and missing rows are `none`. */
export function deliveryState(onJuvi: boolean, row: DeliveryRow | undefined): PendingDelivery {
  if (!onJuvi || !row) return 'none';
  switch (row.status) {
    case 'sent': case 'failed': return 'not_delivered';
    case 'delivered': case 'opened': case 'scheduled': return row.status;
    case 'suppressed': return row.reason === 'muted' || row.reason === 'tier_off' || row.reason === 'no_device' ? row.reason : 'none';
    default: return 'none';
  }
}

export async function deliveryCounts(collegeId: string, noticeId: Types.ObjectId): Promise<DeliveryCounts> {
  const out: DeliveryCounts = { scheduled: 0, sent: 0, delivered: 0, opened: 0, failed: 0, cancelled: 0, suppressed: { muted: 0, tierOff: 0, noDevice: 0 } };
  const groups = await NotificationDelivery.aggregate<{ _id: DeliveryRow; n: number }>([
    { $match: publishedRows(collegeId, noticeId) },
    { $group: { _id: { status: '$status', reason: '$reason' }, n: { $sum: 1 } } },
  ]);
  for (const { _id: { status, reason }, n } of groups) {
    if (status !== 'suppressed') out[status] += n;
    else if (reason && SUPPRESSED_KEY[reason]) out.suppressed[SUPPRESSED_KEY[reason]!] += n;
  }
  return out;
}
```

In `buildReach`, before `const progress = …` (line 158):

```ts
  const delivery = await deliveryCounts(collegeId, notice._id);
```

and in its return value, between `addedLater: { … },` and `asOf` (line 177):

```ts
    delivery,
```

In `pendingPage`, after `const lastSeen = new Map(…);` (line 193):

```ts
  const deliveries = accountIds.length
    ? await NotificationDelivery.find({ ...publishedRows(collegeId, notice._id), accountId: { $in: accountIds } }).select('accountId status reason').lean()
    : [];
  const deliveryBy = new Map(deliveries.map((d) => [String(d.accountId), d]));
```

and in each mapped person, after `lastSeenInApp: …,` (line 200):

```ts
      delivery: deliveryState(Boolean(r.accountId), r.accountId ? deliveryBy.get(String(r.accountId)) : undefined),
```

Replace everything from `const STATUS_WORDS` (line 221) to the end of the file:

```ts
const STATUS_WORDS: Record<ReachBucket, string> = { acknowledged: 'Acknowledged', seen: 'Seen', not_seen: 'Not seen', not_on_juvi: 'Not on Juvi' };
/** The portal's delivery column words (notifications spec §9); `none` is an empty cell. */
const DELIVERY_WORDS: Record<PendingDelivery, string> = {
  not_delivered: 'Not delivered', delivered: 'Delivered', opened: 'Opened', muted: 'Muted', tier_off: 'Notifications off',
  no_device: 'No device', scheduled: 'Scheduled', none: '',
};

/** Every member, snapshot first then added later (admin only; the route enforces it). */
export async function reachCsv(collegeId: string, notice: LeanNotice): Promise<string> {
  const rows = await NoticeRecipient.find({ collegeId, noticeId: notice._id }).select(ROW_FIELDS).lean<LeanNoticeRecipient[]>();
  const accountIds = rows.flatMap((r) => (r.accountId ? [r.accountId] : []));
  const [info, deliveries] = await Promise.all([
    peopleInfo(collegeId, rows.map((r) => r.personId)),
    accountIds.length
      ? NotificationDelivery.find({ ...publishedRows(collegeId, notice._id), accountId: { $in: accountIds } }).select('accountId status reason').lean()
      : Promise.resolve([]),
  ]);
  const deliveryBy = new Map(deliveries.map((d) => [String(d.accountId), d]));
  const lines = ['Name,Identifier,Group,Status,Acknowledged at,Late,Seen at,Comment,Added later,Delivery'];
  const view = rows.map((r) => ({ r, name: info.get(String(r.personId))?.name ?? 'Unknown member', group: labelOf(r) }));
  view.sort((a, b) => Number(a.r.addedLater) - Number(b.r.addedLater) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  for (const { r, name, group } of view) {
    lines.push([
      name, info.get(String(r.personId))?.identifier ?? '', group, STATUS_WORDS[reachBucket(r)],
      iso(r.ack?.at) ?? '', r.ack?.late ? 'yes' : '', iso(r.seenAt) ?? '', r.ack?.comment ?? '', r.addedLater ? 'yes' : '',
      DELIVERY_WORDS[deliveryState(Boolean(r.accountId), r.accountId ? deliveryBy.get(String(r.accountId)) : undefined)],
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}
```

- [ ] **Step 5: Run the backend tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run src/modules/juvi-app/notices/__tests__/reach.test.ts && npx vitest run --config vitest.e2e.config.ts src/__e2e__/modules/juvi-notifications-reach.e2e.test.ts src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts src/__e2e__/modules/juvi-notices-reach.e2e.test.ts`
Expected: typecheck clean; reach unit 6; reach e2e 3; the admin-notices and notices-reach suites PASS. (The document test still fails on drift until Step 6.)

- [ ] **Step 6: Regenerate the contract and the client; update the app fixtures**

Run: `npm run openapi:mobile -w backend && node mobile/tool/check_nullable_objects.js mobile/api/openapi.json && (cd backend && npx vitest run src/modules/juvi-app/openapi)`
Expected: the guard passes (allowlist unchanged); document tests PASS (8).

Run (from `mobile/`, Java 17+ and Node on the path): `./tool/gen_api.sh`
Expected: `object-or-null check passed (6 known field(s), all parsed via raw Dio)`, the generator log, `Built with build_runner`, `juvi_api regenerated`. It rewrites `mobile/packages/juvi_api` from `mobile/api/openapi.json` with generator 7.10.0 (pinned in `mobile/openapitools.json`). If your environment cannot run the script, run its steps by hand in order: `node tool/check_nullable_objects.js api/openapi.json`; `rm -rf packages/juvi_api`; the `npx --yes @openapitools/openapi-generator-cli generate …` line from the script; the two `perl -pi -e` lines in `packages/juvi_api`; `dart pub get && dart run build_runner build --delete-conflicting-outputs` there; `flutter pub get` back in `mobile/`.

The generated `NoticeReach` and `NoticePendingItemsInner`/`PendingPerson` now require `delivery`, so the repository fixtures in `mobile/test/core/repos/notices_fixtures.dart` must send it. In `reachJson`, before `'asOf'`:

```dart
      'delivery': {
        'scheduled': 0, 'sent': 2, 'delivered': 3, 'opened': 2, 'failed': 0, 'cancelled': 1,
        'suppressed': {'muted': 1, 'tierOff': 0, 'noDevice': 0},
      },
```

and in `pendingJson`'s default items:

```dart
            {'name': 'Aditya Nair', 'identifier': '24JIT0001', 'group': '2024 Batch · A', 'state': 'seen', 'lastSeenInApp': '2026-10-01T05:30:00.000Z', 'delivery': 'opened'},
            {'name': 'Meera Iyer', 'identifier': null, 'group': '2024 Batch · B', 'state': 'not_on_juvi', 'lastSeenInApp': null, 'delivery': 'none'},
```

Run: `cd mobile && flutter analyze && flutter test --exclude-tags golden`
Expected: `No issues found!`; `All tests passed!` (203). Without the fixture change, `notices_repository_test.dart` fails two cases ("reach parses counts …" and "pending passes group, search and cursor") on the missing `delivery` key. The app's own `NoticeReachData` model ignores the new keys until Plan 3 shows them.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/juvi-app/notices/schemas.ts backend/src/modules/juvi-app/notices/reach-service.ts \
  backend/src/modules/juvi-app/notices/__tests__/reach.test.ts backend/src/modules/juvi-app/openapi/__tests__/document.test.ts \
  backend/src/__e2e__/modules/juvi-notifications-reach.e2e.test.ts backend/src/__e2e__/modules/juvi-app-admin-notices.e2e.test.ts \
  mobile/api/openapi.json mobile/packages/juvi_api mobile/test/core/repos/notices_fixtures.dart
git commit -m "feat(juvi-app): Reach delivery diagnostics on mobile and admin, CSV Delivery column; regenerate the contract

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: CLAUDE.md, and the full verification

**Files:**
- Modify: `CLAUDE.md` (Juvi section, after the Notices bullet; the Environment Variables block)
- Test: the whole backend suite, the contract checks and the Flutter checks

**Interfaces:**
- Consumes: everything above.
- Produces: no code.

- [ ] **Step 1: Point CLAUDE.md at the notifications module**

In `CLAUDE.md`, under `### Juvi mobile app — backend/src/modules/juvi-app/`, add after the `- Notices: …` bullet:

```markdown
- Notifications: `modules/juvi-app/notifications/` — `fanOutNotice`, `markReminded` and the added-later back-fill emit `notification.requested` (`requestNoticeNotification()`); its consumer (`expand-consumer.ts`) writes one `NotificationDelivery` per person per notification, applying the pure `policy.ts` (tier toggles → mute → quiet hours in the college timezone; Urgent bypasses all three) and the 15-minute Routine digest window. The sender (`sender.ts`) is an `afterEvents` outbox sweeper: 60 s lease, re-check (acknowledged / dismissed / archived cancels), one data message per account through `PushTransport` (`transport/fcm.ts` is the only `firebase-admin` import; unset `FIREBASE_SERVICE_ACCOUNT_JSON` = `FakePushTransport`, which tests install with `setPushTransport()`), dead tokens cleared, 30 s × 2^n backoff to `failed` after 5. Payloads never carry the body; a `confidential` notice sends no title. Receipts are HMAC tokens (`receipts.ts`, `JUVI_RECEIPT_KEY`) posted without a session to `/v1/notifications/receipts`; `/v1/events` takes allow-listed analytics only. Urgent needs admin/super_admin or `notices:urgent` (`notices/urgent-gate.ts`) plus a 10–300 character `urgentReason`. Spec: `docs/superpowers/specs/2026-10-02-juvi-notifications-design.md`.
```

and at the end of the `## Environment Variables` block, after `AWS_S3_ENDPOINT=…`:

```
JUVI_RECEIPT_KEY=               # HMAC key for push receipts, ≥ 32 chars; required in production, dev derives one from JWT_SECRET
FIREBASE_SERVICE_ACCOUNT_JSON=  # service-account JSON string; unset = fake (logging) push transport with a startup warning
JUVI_PUSH_REQUIRED=             # 'true' makes FIREBASE_SERVICE_ACCOUNT_JSON required in production
```

- [ ] **Step 2: Typecheck every workspace**

Run: `npm run typecheck`
Expected: exit 0 (backend, admin-portal and e2e).

- [ ] **Step 3: The contract is current**

Run: `npm run openapi:mobile -w backend && git diff --exit-code -- mobile/api/openapi.json && node mobile/tool/check_nullable_objects.js mobile/api/openapi.json`
Expected: no diff; the guard passes.

Run (from `mobile/`): `./tool/gen_api.sh && git diff --exit-code -- packages/juvi_api && flutter analyze && flutter test --exclude-tags golden`
Expected: no diff (this is what `mobile.yml` checks); `No issues found!`; `All tests passed!` (203).

- [ ] **Step 4: Backend unit suite**

Run: `npm run test -w backend`
Expected: 200 files, 1,947 tests, all passing (baseline 194 / 1,889). In the dry run the full suite sometimes timed out one Mongo-heavy file under load — `src/modules/people/__tests__/photo-routes.e2e.test.ts` (its `afterAll` `teardownMongo`, 10 s) or a case in `src/modules/finance/__tests__/service-aggregates-and-bounce.test.ts` (5 s); both pass when rerun alone (`npx vitest run <file>`: 55/55). Rerun any timed-out file on its own before treating it as a failure; a notifications, notices, juvi-app, outbox or rbac test must never fail.

- [ ] **Step 5: Backend e2e suite**

Run: `npm run test:e2e -w backend`
Expected: 64 files, 557 tests: 550 passed, 3 skipped, and only the four failures already on `main` — `fee-alerts.e2e.test.ts` ×2, `fee-configuration-http.test.ts` "GET 200 /pin-audit/coverage", and `rbac-route-walk.test.ts`, whose snapshot diff must contain only the pre-existing `"/api/juvi-app/admin/notices/targets/people": 200` rows (the HOD policy split changes no GET result). With a real Redis on `localhost:6379`, `rbac-assigned.test.ts` and the `people-search` 429 case can fail when another worker shares the cache or the limiter; rerun them alone.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(juvi): notifications module and env vars in CLAUDE.md

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage

| Spec item | Where |
|---|---|
| §4.1 `NotificationDelivery` fields, enums, four indexes, no TTL | Task 1 |
| §4.2 `Notice.confidential`, `Notice.urgentReason` (10–300, required for Urgent) | Task 1 (fields), Task 3 (validation) |
| §4.2 `MobileSession.pushToken` unique; a new session's token cleared from older ones | Task 1 (index), Task 8 (`setPushToken`) |
| §4.2 `JuviEvent` with a 400-day TTL on `receivedAt` | Task 1 |
| §5.1 trigger after fan-out (`notif:notice:<id>:published`) and after reminders (`…:reminder-<n>`) | Task 5 |
| §5.2 expand in batches of 1,000; recipients on Juvi; reminders skip acknowledged/dismissed; `$setOnInsert` idempotency | Task 5 |
| §5.3 sender: 5 s tick and `kick()`, 500 per pass, 60 s lease, re-check/cancel, Routine digest, devices, one message per token, `sent` when any accepted | Task 6 (Ruling 8) |
| §5.3 errors: dead tokens cleared, transient backoff 30 s × 2^n to 10 min, `failed` after 5 | Task 6 |
| §5.4 receipts | Task 8 |
| §5.5 people added later: under 7 days, not archived, deadline open, one push | Task 7 |
| §5.1 code layout; `firebase-admin` only in `transport/fcm.ts` | Tasks 2, 4, 5, 6, 8 (Ruling 7 for the registration site) |
| §6.1 tier toggles; §6.2 mute via the channel matcher; §6.3 quiet hours in the college timezone, wrapping midnight | Task 2 (pure), Task 5 (inputs: settings, `ChannelMembership.mutedAt`, `getJuviConfig().timezone`) |
| §6.4 Routine digest window: open/join, one notification for the window, next window ≥ 15 min | Task 2 (`digestSendAfter`), Task 5 (windows), Task 6 (send, NTF-04 ten-into-one test) |
| §6.5 Urgent gate: admin roles or `notices:urgent`, 403 `URGENT_NOT_ALLOWED`, reason stored and audited, policy for admin and principal, old Urgent notices untouched | Task 3 (Rulings 1–4) |
| §6.6 payload: data-only strings, priorities, collapse key, confidential without title, reminder variant, Routine count, nothing else | Task 6 (`buildNoticePush`; e2e asserts the body never appears) |
| §7.1 push-token PUT/DELETE; revoked sessions lose their token | Task 8 |
| §7.2 receipts: HMAC token, 1–50 items, forward-only, clamp, no-op repeats, `{ accepted, rejected }`, 401 only when all fail, per-IP limit | Task 4 (token), Task 8 (endpoint) |
| §7.3 events: allow-list, prop rules, 1–100, per-event drops | Task 8 |
| §7.4 Reach `delivery` block and per-pending `delivery`, mobile and admin; no device details | Task 10 (Rulings 17–18) |
| §7.5 admin publish `confidential` / `urgentReason`; `/targets.canPublishUrgent` | Task 3 |
| §7.6 contract and Dart client regenerated; no object-or-null field | Task 9, Task 10 |
| §10 `FIREBASE_SERVICE_ACCOUNT_JSON` (fake + warning when unset; required with `JUVI_PUSH_REQUIRED=true` in production), `JUVI_RECEIPT_KEY` (HKDF dev fallback, production guard), `.env.example`, CLAUDE.md env block | Task 4, Task 11 |
| §11 idempotent expansion, transient failures never block the outbox, bad tokens, expired lease reclaimed, bad receipts skipped, no-permission counted as `no_device` | Tasks 5, 6, 8 |
| §12 backend tests: policy table, batching, pipeline over the fake transport, receipts, events, e2e Urgent gate, token uniqueness, Reach on mobile and admin | Tasks 2–10 |
| §8 Flutter, §9 portal, §10 Firebase files / CI secrets / release signing | Out of scope: Plans 3 and 2 |

## Self-review

- **Order:** each task's tests were run in the dry run with only that task's and earlier tasks' code. The two places where a file grows across tasks are restated where they grow: `notifications/index.ts` (consumer only in Task 5, plus the sender sweeper in Task 6) and `receipts.ts` (signing in Task 4, `applyReceipts` in Task 8). The Notice pre-validate hook lands with the gate (Task 3), not with the field (Task 1), so no earlier task's Urgent publish trips it. The OpenAPI drift test is refreshed in the task that changes a documented schema (Tasks 9 and 10); Task 8's new schemas are not documented until Task 9, so the drift test stays green in between.
- **Names used across tasks:** `requestNoticeNotification`, `notificationKey`, `NOTIFICATION_REQUESTED`, `expandNotification`, `runSender`, `MAX_SEND_ATTEMPTS`, `DIGEST_WINDOW_MS`, `FakePushTransport`, `setPushTransport`, `signReceipt`, `verifyReceipt`, `studentOnJuvi`, `deliveriesFor`, `deliveryOf`, `quietHoursAround`, `deliveryState`, `deliveryCounts` — each defined once and imported by exactly these names.
- **Placeholders:** none; every code step carries the code that was run.
- **Risks while executing:** the Dart generator needs Java 17+ and network access for `npx`; the e2e harness's per-worker MongoMemoryServer is required (never point a test at `juvion_v2`); the full unit suite's two load-sensitive files (Task 11 Step 4); Plan 2 must add the Urgent reason field to the portal composer (Ruling 20).

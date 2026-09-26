# Juvi Notices & Acknowledgement — Design

**Sub-project 2 of Juvi Release 1.** It depends on Foundation (`2026-09-23-juvi-foundation-design.md`, merged in #94, #96 and #99). PRD: PRD-JUVI-R1 v1.0 §7.4 (NTC), §7.5 (HOME-02, acknowledgement items only), §7.7 (RCH-01, RCH-02), §7.9 (ADM-03 welcome notice, ADM-04, ADM-06 acknowledgement records), screens S02 step 4, S03 attention stack, S04, S05, S07 inline cards, S10 attention stack, S11.

## Problem

The ERP's `Announcement`, `Circular` and `Notification` models are CRUD records. They reach nobody, and they track nothing. The legacy `models/juvi/JuviNoticeCard` and `AckRecord` are unrouted dead code. Foundation §1 says they are replaced, not extended.

Juvi's reason to exist is that an office can publish an official notice and know exactly who has seen it and who has acknowledged it. That is what this sub-project builds, together with the durable outbox that Foundation deferred until a real consumer existed.

## 1. Decisions locked in review (2026-09-26)

- **One shared ERP composer.** It is built as a reusable `<NoticeComposer />` component, so module pages can embed it later. Per-module entry points are not built here.
- **The audience is resolved from ERP people.** Members without an active Juvi account are included in the snapshot and reported as **Not on Juvi**, separately from *not seen*. They receive the card when they activate.
- **Publisher scope follows persona:**
  - Admin, principal and the staff offices (Exam Section, Finance, Admissions, Placement, Welfare, Campus Ops, Registrar) may target the whole college.
  - An HOD may target only their department.
  - Teaching faculty may target only the course offerings they teach.
  - The composer offers only what the publisher may target, and the server enforces the same scope.
- **No push in this sub-project.** Publishing and reminders are recorded as outbox events and reach the app as cards on the next refresh or foreground. Sub-project 3 adds an FCM consumer to the same events.
- **Fan-out architecture: an outbox, then one `NoticeRecipient` row per audience member.** The row is both the audience snapshot and that person's state.
- **Attention stack scope:** only acknowledgement-required notices. Class exceptions, fee dues and assessments arrive with sub-project 4.
- **Legacy pages:** the Announcements and Circulars pages stay, with a banner linking to the composer. No data is migrated.

## 2. Goals

1. A notice published from the ERP produces a card for every audience member on Juvi within 60 seconds (NTC-01).
2. The audience is snapshotted at publish. Reach reconciles exactly: acknowledged + seen-not-acknowledged + not seen + Not on Juvi = snapshot size. Members added later are reported separately (NTC-02, S11 acceptance criteria 1–2).
3. Card state runs received → seen → acknowledged | dismissed. Seen and acknowledged are separate states, and both are reported (NTC-03).
4. Acknowledgement is deliberate, immutable and fully attributed: timestamp, method, device session, online/offline and optional comment (NTC-04, S04 acceptance criterion 1).
5. Late acknowledgements are accepted and flagged (NTC-05, S04 acceptance criterion 2).
6. Acknowledgements are recorded in the ERP audit log and visible in the ERP within one minute (NTC-06, ADM-06).
7. Notices appear inline in the channels whose scope matches their audience (NTC-07).
8. A publisher can send at most two reminders per notice, and can archive a notice (NTC-08, NTC-09).
9. Reach is visible to the publisher and admins only; student attempts are refused and logged (RCH-01, RCH-02).
10. Onboarding step 4 is a real welcome notice with a real acknowledgement (S02, ADM-03 welcome notice).

## 3. Non-goals

- Push notifications, tiers and quiet-hours enforcement, and delivery tracking (sub-project 3).
- Attention items other than acknowledgement notices (sub-project 4).
- Channel posts, replies and reactions; post edit-history audit (sub-project 5).
- Per-module publish buttons (the composer is embeddable; wiring it into modules is follow-up work).
- Escalation to WhatsApp or SMS (NTC-10, Release 4).
- RCH-03 institution-level acknowledgement dashboard (sub-project 7).
- Rich text, scheduled publishing, editing after publish.
- Migrating or deleting `Announcement`, `Circular`, `JuviNoticeCard` or `AckRecord`.

## 4. User stories and acceptance criteria

### US-1 Publish a notice (ERP): NTC-01, NTC-02, ADM-04
As an office publisher, I compose a notice, choose its audience, set acknowledgement rules and priority, attach files, preview it as the Juvi card, and publish it.
1. The audience builder offers only targets within my persona scope. The server returns 403 for a request outside that scope.
2. The live count shows the total, how many are on Juvi, how many are not, and a breakdown by batch or section. It matches the snapshot written at publish.
3. After publishing, every audience member who is on Juvi has a card within 60 seconds. A 5,000-person audience is tested.
4. A published notice cannot be edited. Archive is the only change allowed.

### US-2 Read and acknowledge (app): NTC-03, NTC-04, NTC-05, S04
1. Opening the detail screen sets `seenAt` once. Prefetching a list does not mark a notice seen.
2. Acknowledgement requires a 1.2-second hold, or tap-then-confirm. The confirm path is always used under a screen reader. No single-tap path exists.
3. A second acknowledgement returns 409 with the existing record. The record never changes.
4. An acknowledgement received after the deadline has `late = true`, both in the app and in reach.
5. A notice I am not a recipient of returns 404, even when opened by link.
6. An archived notice is read-only, marked "Archived", and excluded from Due.

### US-3 Attention (app): HOME-02 (acknowledgement items), S03, S05, S10
1. Today and Teaching show up to three due acknowledgement items, ordered by deadline, plus a "+N more" pill. When nothing is due they show "You're clear".
2. The Due count in the attention sheet equals the badge count everywhere it appears (S05 acceptance criterion 2).
3. An acknowledgement made while online removes the card only after the server confirms. A failure restores it with a message (S03 acceptance criterion 2).
4. An acknowledgement made while offline is queued. The card shows "Will send when online" until the queue drains.
5. The All segment reaches every notice ever received, paged.

### US-4 Reach (app for publishers, ERP for publishers and admins): RCH-01, RCH-02, S11, NTC-08
1. The counts reconcile to the snapshot as stated in goal 2.
2. The pending list is grouped by batch or section, searchable, copyable as text, and shows each member's last-seen-in-app time.
3. Late acknowledgements, comments and "added later" members are listed separately.
4. A third reminder is refused with a reason.
5. A student calling any reach endpoint gets 403, and the attempt is audited.

### US-5 First notice in onboarding: S02 step 4, ADM-03
1. The onboarding steps become `identity, spaces, notifications, first_notice`.
2. The step shows the configured welcome notice for the account's kind. If none is configured, it shows an auto-created default. Its acknowledgement is real and appears in reach within one minute.
3. The Foundation app renders the unknown `first_notice` step as a generic card, so older apps are not stranded.

### US-6 Inline in channels: NTC-07
1. A notice whose audience includes the CSE-2024 batch appears in the CSE-2024 batch channel's notice list, and links to S04.

## 5. Data model

All models carry `collegeId: { type: ObjectId, required: true, index: true }`.

### `Notice` (`models/juvi/Notice.ts`)
| Field | Type | Notes |
|---|---|---|
| `title` | string ≤ 120 | required |
| `body` | string ≤ 5000 | plain text; links are auto-detected at render time |
| `attachments[]` | `{ key, name, mime, size }` | ≤ 5 items, each ≤ 10 MB |
| `publisher` | `{ personId, userId, office }` | `office` is plain words ("Exam Section") derived from the persona; admins choose it |
| `audience.rules[]` | `{ kind, ids[] }` | `kind` ∈ `all, role, department, programme, batch, section, course_offering, hostel_block, custom` |
| `audience.line` | string | rendered "Sent to CSE 2024 batch" |
| `channelIds[]` | ObjectId[] | channels whose scope equals a rule (§6.4), for inline cards |
| `ackRequired` / `ackDeadline?` / `ackCommentAllowed` | bool / Date / bool | a deadline requires `ackRequired` |
| `priority` | `routine, important, urgent` | stored; consumed by push in sub-project 3 |
| `purpose` | `standard, welcome` | |
| `status` | `publishing, published, archived` | |
| `counts` | `{ audience, onJuvi }` | cached at fan-out |
| `reminders[]` | `{ at, by }` | ≤ 2 |
| `publishedAt`, `archivedAt` | Date | |

Indexes: `(collegeId, status, publishedAt)`, `(collegeId, 'publisher.userId', publishedAt)`, `(collegeId, channelIds)`.

### `NoticeRecipient` (`models/juvi/NoticeRecipient.ts`)
| Field | Type | Notes |
|---|---|---|
| `noticeId`, `personId` | ObjectId | unique together |
| `accountId` | ObjectId \| null | null while the person is not on Juvi; set when they activate |
| `kind` | `student, faculty, staff` | |
| `labels` | `{ batch?, section?, department? }` | frozen at publish, used for reach grouping |
| `addedLater` | bool | the person matched the audience after publish |
| `ackRequired`, `deadline` | copied from the notice | denormalised for the Due query |
| `receivedAt`, `seenAt`, `dismissedAt`, `remindedAt` | Date | |
| `ack` | `{ at, late, method: hold\|confirm, sessionId, offline, clientAt?, comment? }` \| null | set once by a conditional update |
| `archived` | bool | mirrors the notice, for the Due filter |

Indexes: unique `(noticeId, personId)`; `(collegeId, accountId, ackRequired, 'ack.at', deadline)` for Due and the badge; `(collegeId, accountId, receivedAt)` for Done and All; `(noticeId, seenAt, 'ack.at')` for reach.

### `OutboxEvent` (`shared/outbox/OutboxEvent.ts`)
`type`, `payload`, `dedupeKey` (unique), `status` (`pending, processing, done, dead`), `attempts`, `availableAt`, `lockedUntil`, `lastError`, `processedAt`. A TTL index removes `done` events after 30 days.

### Changes to existing models
- `JuviSettings` gains `welcomeNotice: { studentNoticeId?, facultyNoticeId? }`.
- The onboarding step list gains `first_notice` as step index 3.
- `DEFAULT_POLICIES` gains the `notices` resource (§7.4).

## 6. Publish and dispatch

### 6.1 Publish (`modules/juvi-app/notices/`, ERP-authenticated under `/api/juvi-app/admin/notices`)
1. `POST /attachments` accepts a multipart file: PDF, PNG, JPEG, WEBP, DOCX, XLSX or PPTX, up to 10 MB. It is stored at `colleges/<cid>/notices/<uuid>` with SSE and returns `{ key, name, mime, size }`. It returns 503 when S3 is unconfigured.
2. `POST /audience-preview` takes `{ rules }` and returns `{ total, onJuvi, notOnJuvi, groups[], line }`. It applies the same scope check as publish.
3. `POST /` publishes:
   1. The body is validated with Zod.
   2. `assertAudienceInScope(publisher, rules)` runs.
   3. The notice is written with `status: 'publishing'`.
   4. `emit('notice.published', { noticeId }, 'notice:<id>:published')` records the event.
   5. `kick()` wakes the dispatcher.
   6. The response is 201.

   There are no transactions: the test harness is not a replica set, as in Foundation.

### 6.2 Outbox (`shared/outbox/`)
- **API:** `emit(type, payload, dedupeKey)` (an upsert on `dedupeKey`, so a re-emit is a no-op), `registerConsumer(type, handler)` and `kick()`.
- **Dispatcher:** registered in `server.ts` next to the reconcile queue, and guarded by `DISABLE_BACKGROUND_JOBS`. It is a BullMQ repeatable job every 5 s, plus an immediate job on `kick()`.
- **Claiming:** a claim is `findOneAndUpdate({ status: 'pending', availableAt ≤ now } or { status: 'processing', lockedUntil < now })` → `processing`, with `lockedUntil = now + 2 min`.
- **Success** sets `done`.
- **Failure:** `attempts++`, then `availableAt = now + min(5 s × 2^attempts, 10 min)`. After 8 attempts the event becomes `dead`, is logged, and is listed in the admin console.
- **Without Redis,** `kick()` processes events inline, as `enqueueReconcile` does.
- **Sweeper:** a notice still in `publishing` more than 2 minutes after creation gets its event re-emitted, and the dedupe key makes that a no-op if the event exists. It runs inside the dispatcher's repeatable job.

### 6.3 Consumers
| Event | Consumer |
|---|---|
| `notice.published` | `resolveAudience(rules, graph)` returns people with their labels, then bulk-upserts `NoticeRecipient` rows in batches of 1,000 (`ordered: false`, upsert on the unique key). Accounts that are already active get `accountId` and `receivedAt`. The consumer then sets `counts`, `channelIds`, `status: 'published'` and `publishedAt`. It is idempotent. |
| `notice.reminder` | sets `remindedAt` on recipients who have neither acknowledged nor dismissed |
| `notice.acknowledged` | writes a `createAuditLog` entry (`NoticeAcknowledgement`) |
| `notice.archived` | sets `archived` on the recipients |

### 6.4 Audience resolution
`resolveAudience` is a pure function over the graph that `spaces/graph-loader.ts#loadCollegeGraph` loads.
- `programme` resolves through its batches; `role` resolves through account kind and persona code; `custom` is an explicit list of person ids.
- The rules are unioned, and each person appears once.
- Rule-to-channel mapping:
  - `all` maps to the college channel.
  - `department` maps to the department channel.
  - `batch` maps to the batch channel.
  - `course_offering` maps to the course channel.
  - `hostel_block` maps to the hostel channel.
  - Other kinds map to no channel.

### 6.5 Reconciliation arithmetic
- **Snapshot.** The snapshot is the set of rows with `addedLater: false`. Reach counts reconcile over the snapshot only: acknowledged + seen-not-acknowledged + not seen (accounts on Juvi) + Not on Juvi (`accountId` null) = `counts.audience`.
- **Added later.** Rows with `addedLater: true` are reported in their own group, with their own acknowledged and seen counts, and never as pending.
- **Welcome notices** are the exception. Their audience grows as accounts onboard, so rows created on demand by `GET /onboarding/first-notice` are ordinary snapshot rows (`addedLater: false`), and `counts.audience` is incremented with them.

### 6.6 Added later, and activation
- `reconcileAccount` already runs on the Spaces load. It gains a step: for published, unarchived notices from the last 30 days whose rules match the account and that have no recipient row, it inserts `addedLater: true` rows.
- When an account activates, its existing rows get `accountId` and `receivedAt`, so a person who was Not on Juvi gets their cards.

## 7. APIs

### 7.1 Mobile (`/api/juvi-app/v1`, `authenticateMobile`)
Every read requires a recipient row with `accountId` equal to the caller's account. Anything else returns 404 `NOTICE_NOT_FOUND`.

| Route | Behaviour |
|---|---|
| `GET /attention` | `{ dueCount, items[≤3] }`: acknowledgement-required, not acknowledged, not archived, ordered by deadline (nulls last), then by `receivedAt` |
| `GET /notices?segment=due\|done\|all\|published&office=&cursor=` | cursor-paged cards; `published` lists notices where `publisher.userId` is the caller's user |
| `GET /notices/:id` | detail, including my state |
| `POST /notices/:id/seen` | sets `seenAt` if it is null; idempotent |
| `POST /notices/:id/ack` `{ method, comment?, offline, clientAt? }` | conditional set; 409 `ALREADY_ACKNOWLEDGED` with the existing record (409 `NOTICE_ARCHIVED` on an archived notice); `late` is computed from the server's receipt time; a comment is refused unless allowed; emits `notice.acknowledged` |
| `POST /notices/:id/dismiss` | only when `ackRequired` is false, otherwise 409 |
| `GET /notices/:id/attachments/:key` | the key must be in `notice.attachments`; returns a 5-minute presigned URL |
| `GET /notices/:id/reach` | publisher only (403 `NOT_PUBLISHER`, audited); returns counts, a sparkline, and the late, comments and added-later lists |
| `GET /notices/:id/reach/pending?group=&q=&cursor=` | paged, with last-seen-in-app from `MobileSession` |
| `POST /notices/:id/remind` | publisher only; 409 `REMINDER_LIMIT` after 2; emits `notice.reminder` |
| `GET /onboarding/first-notice` | returns the welcome notice for the caller's kind, creating its recipient row on demand |
| `GET /channels/:id` | gains `notices[]`: recent notices with that channel in `channelIds` for which the caller has a recipient row |

The new error codes go into the OpenAPI contract. The contract is regenerated, and `mobile/tool/check_nullable_objects.js` must pass. Any new object-or-null field either stays out of the contract or is parsed through raw Dio and allow-listed (Foundation ruling R57/R61).

### 7.2 Admin (`/api/juvi-app/admin/notices`, `authenticate` then `authorize('notices', …)`)
- `read`: `GET /` (my notices, or the whole college for admins), `GET /:id`, `GET /:id/reach`, `GET /:id/reach/pending`, `GET /:id/reach.csv` (admin only), `GET /:id/audit`.
- `create`: `POST /attachments`, `POST /audience-preview`, `POST /`.
- `update`: `POST /:id/remind`, `POST /:id/archive`, `POST /:id/retry-delivery` (admin only, for a dead event).
- These routes use the ERP error shape `{ error }`, as the Foundation admin console does.

### 7.3 Scope rules (`assertAudienceInScope`)
| Publisher | Allowed rules |
|---|---|
| admin, principal, staff office personas | any |
| HOD | `department` = own; `batch`, `section` or `course_offering` within the own department; `role` limited to the own department; `custom` whose people are all in the own department |
| teaching faculty | `course_offering` ∈ offerings taught in the current semester; `custom` whose people are all enrolled in those offerings |
| anyone else | refused |

### 7.4 Policy
`notices`:
- `read` for admin, principal, staff and faculty.
- `create` and `update` for admin, principal, the staff office personas, HODs and faculty.

The row-level audience scope in §7.3 is enforced in the service layer, on top of the policy check.

## 8. ERP portal

- `/communication/notices` (`pages/communication/NoticesPage.tsx`, `services/notices.ts`) lists notices with title, office, audience line, published, acknowledged/seen/total, status and deadline state, filtered by office and status.
- `<NoticeComposer />` is a drawer and an embeddable component:
  - an office selector (admins only)
  - title and body
  - attachments with upload progress
  - audience chips, each opening a scoped, searchable dropdown; no raw ids
  - a live audience count and breakdown
  - acknowledgement toggle, deadline (date and time in the college timezone) and allow-comment toggle
  - priority, with a note on Urgent
  - a Juvi card preview
  - confirm-to-publish showing the count
- Notice detail has tabs:
  - **Reach**, the S11 content for the ERP side: counts, per-section breakdown, pending list, late, comments, added later, CSV export for admins, copy pending, remind (≤ 2), archive
  - **Audit**
  - **Delivery**, showing the publishing state and "Retry delivery" for a dead event
- The Announcements and Circulars pages get a banner: "Official notices now go to Juvi", linking to `/communication/notices`.
- The `/platform/juvi` Settings tab gets a "Welcome notice" section: pick a published `purpose: welcome` notice per kind, or "Create welcome notice", which opens the composer prefilled.
- Mutations follow the Foundation admin console conventions: wrapped service calls, and `meta: { silent, silentError }` where the page shows its own toast.

## 9. Flutter app

The Foundation repository patterns apply: cached-then-network streams with `markStale`, pending actions and SyncWorker replay, and raw Dio wherever the generated client cannot parse a response.

- `NoticesRepository` provides `attention()`, `list(segment)`, `detail(id)`, `markSeen`, `acknowledge`, `dismiss`, `attachmentUrl`, `reach`, `pending`, `remind` and `firstNotice`.
- Offline acknowledgement enqueues `notice.ack` with `{ noticeId, method, comment, clientAt, offline: true }`. The SyncWorker replays it, and a 409 on replay counts as success. Online acknowledgement is not optimistic.
- Widgets:
  - `DeadlineRing` (depletes toward the deadline; empty and red after it)
  - `AckControl` (1.2-second hold with a filling ring; tap-then-confirm; the confirm path is forced under `MediaQuery.accessibleNavigation`)
  - `NoticeCard`, `AttentionStack` and `NoticeTile`
- Screens:
  - the attention stack on Today and Teaching
  - S04 `NoticeDetailScreen`
  - S05 `AttentionSheet` (a modal, returning to the calling screen)
  - S11 `ReachScreen`
  - onboarding `FirstNoticeStep`
  - inline notice cards on the channel screen
- Routes: `/notices/:id`, `/notices/:id/reach`, and the attention sheet as a modal route.
- Analytics: `notice.opened`, `notice.acknowledged {late, method}` and `notice.dismissed`, with ids and enums only.

## 10. Security and privacy

- Every query filters by `collegeId`. Mobile reads require the caller's recipient row. Reach and remind require the publisher, or ERP admin rights.
- A student calling any reach endpoint gets 403, and an `AuditLog` entry is written (RCH-02).
- Acknowledgement immutability is enforced by a conditional update (`ack: null`), so two racing requests produce one record and one 409.
- An attachment key must be in the notice's own list before a URL is signed.
- The comment is limited to 500 characters and stored as plain text. Title, body and comment are never logged.
- Reach exposes names and roll numbers only to the publisher and admins, and never raw `personId` values to the app.

## 11. Failure handling

- A fan-out that fails partway through is retried, and the unique key makes the retry idempotent.
- The ERP shows a notice that is still publishing as "Delivering…", and one whose event is dead as "Delivery failed", with admin retry.
- If S3 is unavailable, attachment upload returns 503, and publishing without attachments still works.
- An archived notice is read-only (US-2.6). Reminders, acknowledgements and dismissals all return 409 `NOTICE_ARCHIVED`. Its existing reach data is kept.
- Deleted ERP people keep their recipient rows (the snapshot is historical). Their labels remain as frozen.

## 12. Testing

- **Backend unit:**
  - `resolveAudience` for every rule kind and for the union
  - `assertAudienceInScope` for each persona
  - outbox claim, lock expiry, backoff, dead-lettering and dedupe
  - late computation
  - rule-to-channel mapping
- **Backend integration:**
  - publish → fan-out → acknowledge → reach, with the counts reconciling
  - Not on Juvi, then activation delivering the card
  - added later
  - reminder cap
  - archive
  - duplicate and racing acknowledgements
  - a student refused reach, with the audit entry
  - attachment key probe refused
  - a 5,000-member fan-out finishing in under 60 s
- **Contract:** the drift check and the nullable-object guard.
- **Mobile:**
  - repository tests with contract payloads, including nulls
  - `AckControl` tests (hold, early release, confirm, screen reader)
  - `AttentionStack` states
  - the offline acknowledgement queue with replay and a 409
  - goldens for `NoticeCard`, `DeadlineRing` and `AttentionStack`
  - a flow test: onboarding step 4 → Today → acknowledge → "You're clear"
- **E2E (Playwright):** an office persona publishes through the composer, and the list shows the counts. Plus a scope refusal for an HOD targeting another department.

## 13. Delivery

There are three implementation plans, each leaving `main` deployable:
1. **Backend:** the outbox, models, publish, fan-out, consumers, mobile and admin APIs, policy, contract, onboarding step 4, and added-later.
2. **ERP portal:** the notices list, composer, reach, audit and delivery tabs, legacy banners, and the welcome-notice setting.
3. **Flutter:** the repository, widgets, attention stack, S04, S05, S11, the first-notice step, inline channel cards, and offline acknowledgement.

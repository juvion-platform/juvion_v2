# GATE 2 — Data-Layer Validator, round 2 — 011 Juvi account deletion

Scope: verify spec **revision 2** (`spec.md`) against the live schema. All refs from the worktree
`juvi-flutter-shell` @ 2026-10-10. Inputs: `spec.md` (rev 2), `discovery.md`,
`gate2-resolution.md`, round-1 `gate2-data-layer.md`.

**Verdict:** 0 CRITICAL · **0 HIGH** · 2 MEDIUM · 5 LOW. Both round-1 HIGHs are genuinely
resolved: the `accountId` sweep is now complete (exactly six collections carry the key; all six
are in the deletion set). The revision introduced two specification gaps — an under-specified
audit-existence guard that can silently suppress the deletion audit entry, and a cancellation
path (successful sign-in) that the spec does not require to disarm the deferred job.

---

## Round-1 HIGH verification

### H1 — `NotificationDelivery` omitted — **RESOLVED**

- Spec §3.1 now hard-deletes it, keyed `{ collegeId, accountId }` (`spec.md:182`).
- Key matches the schema: `backend/src/models/juvi/NotificationDelivery.ts:46-47`
  (`collegeId` required+indexed, `accountId: { ref:'JuviAccount', required:true }`). Deleting is
  correct and complete: the row is wholly account-owned (`source`, `tier`, `status`, `reason`,
  `sentAt`/`deliveredAt`/`openedAt`) and carries no institutional payload; `collegeId` is present,
  so a scoped `deleteMany` is complete. No other collection holds a copy — the sender
  (`notifications/sender.ts:120,214`) and reach (`notices/reach-service.ts:212,241`) read these
  rows live and simply stop seeing the account, which is the intended outcome. No dangling
  required `accountId` survives.

### H2 — `JuviEvent` omitted — **RESOLVED**

- Spec §3.1 now hard-deletes it, keyed `{ collegeId, accountId }` (`spec.md:183`).
- Key matches `backend/src/models/juvi/JuviEvent.ts:19-20` (`collegeId` required+indexed,
  `accountId: { ref:'JuviAccount', required:true }`). Complete: every field on the row is
  account-owned ids/enums (`name`, `at`, `props`, `appVersion`, `platform`, `receivedAt`); props
  are documented as "ids and enums only, never content" (`JuviEvent.ts:6`). Erasing is the correct
  disposition and it removes the rev-1 contradiction with the client-side `analytics_events` wipe
  (Story 1 AC3, `spec.md:51`). The TTL index is irrelevant to a hard delete.

---

## MEDIUM

### M1 — The audit existence guard's key is unspecified, and the natural key collides with the provisioning entry, silently suppressing the deletion audit

- **Evidence — what the guard must find:** `shared/audit.ts:60-62` `createAuditLog` is a bare
  `AuditLog.create`, always inserting; there is no uniqueness on the collection (`audit.ts:39-56`;
  the only partial unique-ish index is scoped `entityType: 'NoticeAcknowledgement'`, `:53-56`).
  So idempotency can only come from an explicit pre-check.
- **Evidence — what is already in the collection:** provisioning writes
  `{ entityType: 'JuviAccount', entityId: String(account._id), action: 'create' }`
  (`accounts/provisioning-service.ts:165-174`), and every lifecycle write reuses the same
  `entityType` + `entityId` (`provisioning-service.ts:185-194` `action:'update'`). The in-app
  deletion entry is `{ entityType: 'JuviAccount', entityId: <account id>, action: 'delete' }`
  (Story 2 AC4, `spec.md:79-85`).
- **Why it is a defect:** a guard written on the fields AC4 actually names — `{ collegeId,
  entityType:'JuviAccount', entityId }` — matches the pre-existing provisioning `create` row for
  that very account, so `exists()` is true on the *first* deletion call and `createAuditLog` is
  never invoked. The deletion leaves **no** audit entry, and the failure is silent (the endpoint
  still succeeds). That is the inverse of round-1 L1 (a duplicate trail) and worse: the required
  trail is absent. The spec says "guarded by an existence check" without stating the guard key, and
  AC4's own field list (`collegeId`, `entityType`, `entityId`, `entityName`, `action`, `changes`)
  is the set an implementer will filter on.
- **Note the two-path asymmetry:** the public path's `entityType` (`'JuviAccountPublicDeletion'`)
  has no pre-existing rows, so a naive guard works there and fails only on the in-app path — a
  difference the tests are unlikely to surface if they assert the public entry.
- **Remedy:** specify the guard as `AuditLog.exists({ collegeId, entityType, entityId, action:
  'delete' })` (or add a fixed marker field and filter on it), and add a test that seeds a
  provisioned account and asserts the deletion audit entry exists after `DELETE /me/account` —
  not merely that the endpoint returned 204.

### M2 — The deferred job is not required to be disarmed by the sign-in safety net, nor to re-read `deletionRequestedAt` before it deletes

- **Evidence:** Story 4 AC1 (`spec.md:155-160`) says any **successful sign-in** "clears the
  request"; the explicit *Cancel deletion* action is the other path. §3.5 attaches job removal to
  "Cancellation": "Cancellation removes the job and clears the two fields"
  (`spec.md:292-293`), and says the job "executes the same deletion service after
  `DELETION_GRACE_DAYS = 7`, or the deletion completes automatically at the deadline whether or not
  anyone responded" (`spec.md:285-288`). Nothing requires the job (or the service it calls) to
  re-read `deletionRequestedAt`.
- **Why it is a defect:** a user who re-authenticates to cancel (the spec's own "independent
  evidence of ownership", `spec.md:158-160`) has the flag cleared while the queued BullMQ job
  remains armed; at the deadline it executes the hard delete anyway, destroying an account that
  must survive. There is also a genuine in-flight race: a sign-in that clears the flag while the
  worker has already claimed the job deletes regardless. `QueueManager` gives no removal helper
  (`shared/queue/QueueManager.ts:55-83` exports only `getQueue`/`addJob`/`addBulkJobs`), so
  cancellation must reach through `getQueue(name).getJob(jobId).remove()` — implementable, but
  nowhere stated.
- **Remedy:** in Story 4 AC1 and §3.5, state that **every** cancellation path (explicit cancel *and*
  successful sign-in) removes the `juvi-account-deletion:<accountId>` job, and that the job
  re-reads `deletionRequestedAt != null` immediately before invoking the deletion service and
  no-ops otherwise. Without the re-read, the race window remains even with correct job removal.

---

## LOW

### L1 — An `accountId` can survive inside `OutboxEvent.payload` for up to 30 days

- **Evidence:** `shared/outbox/OutboxEvent.ts:26` stores `payload: Mixed`, and
  `notifications/expand-consumer.ts:54` emits `{ collegeId, source, ...(accountId ? { accountId }
  : {}) }` for the per-person (added-later) push request. `done` rows are retained 30 days by TTL
  (`OutboxEvent.ts:6,41`).
- **Why it matters:** a completed outbox row can name the deleted account after the account row is
  gone. The value is an opaque ObjectId (no PII, no notice content) and the consumer no-ops on a
  missing account (`expand-consumer.ts:209` queries `ELIGIBLE_STATUSES`), so nothing is
  re-created. It is a dangling id in a transient queue row, not a retained user record.
- **Remedy:** none required for the disclosure; optionally note it. Do **not** sweep outbox payloads
  — `accountId` is unindexed inside `Mixed` and the rows are transient by design.

### L2 — `Channel.memberCount` is stale from the membership delete until the next reconcile pass

- **Evidence:** `spaces/reconcile-service.ts:126` sets `memberCount: expected.size` only when the
  reconciler walks that channel; the deletion's `ChannelMembership.deleteMany` (Story 2 AC7 /
  §3.1, `spec.md:180`) does not touch `Channel` (`models/juvi/Channel.ts:41`).
- **Why it matters:** the admin channel list (`spaces/spaces-service.ts:87`) can over-report
  membership between the deletion and the next reconcile. This is exactly the behaviour of the
  existing `deactivateAccount` primitive (`provisioning-service.ts:212`), and the reconciler
  (also `:168`) corrects it, so it is transient and self-healing.
- **Remedy:** none required.

### L3 — The reset's "affected notices" list must be captured *before* the `updateMany`

- **Evidence:** §3.1's reset block (`spec.md:193-199`) filters by `{ collegeId, accountId }` and
  then recounts "per affected snapshot notice (addedLater: false)" (`spec.md:206-207`). The
  recount query mirrors activation exactly (`notices/recipient-service.ts:30-31`, verified
  character-for-character, including the `status: { $ne: 'publishing' }` guard).
- **Why it matters:** after the `$set: { accountId: null, ... }` runs, the accountId key no longer
  finds those rows, so the notice ids must be collected in the same read (as `onAccountActivated`
  does at `recipient-service.ts:20,28`). The spec's snippet shows the recount as if it could be
  driven after the fact; an implementer who tries to enumerate the notices afterwards recounts
  nothing and leaves `counts.onJuvi` over-counted for that person's notices.
- **Remedy:** state that the reset reads `{ _id, noticeId, addedLater }` first (one read, like
  activation) and drives the recount from those ids.

### L4 — A notice fan-out racing the reset can re-insert the deleted `accountId`

- **Evidence:** the fan-out builds rows from an audience graph loaded earlier in the same pass —
  `snapshotRow` sets `accountId: onJuvi ? new Types.ObjectId(p.accountId!) : null`
  (`notices/consumers.ts:31-36`) where `p.accountId` came from `loadAudienceGraph`. The orphan
  fix-up only repairs rows whose `accountId` is *null* (`consumers.ts:69-80`).
- **Why it matters:** if an account is deleted between the graph load and the `bulkWrite`, a brand
  new `NoticeRecipient` row is inserted with the deleted account id and `receivedAt` set, so the
  reach board (`reach-service.ts:88-93` `reachBucket`) shows the person as on Juvi. The window is
  milliseconds and the race is pre-existing (rev 1 had it too); `backfillAddedLater` is safe because
  it re-reads the account from Mongo (`recipient-service.ts:38` returns 0 for a deleted id).
- **Remedy:** none required for this feature; worth a ticket if the deletion service ever grows a
  post-condition check.

### L5 — `'account_deleted'` must also be added to the `RevokeReason` TS union, and it surfaces in the mobile 401 envelope

- **Evidence:** `REVOKE_REASONS` is the real export name (`models/juvi/MobileSession.ts:8-10`) and
  is the array the schema enum references (`:47`), so adding a member is the right, safe change —
  Mongoose validates the enum on write, and existing rows hold other members, so no row is
  invalidated. But the array is typed `readonly RevokeReason[]` (`:8`) over the union at `:4-6`, so
  the union must gain the member too. The value is not confined to Redis: `getSessionState` returns
  it (`session-service.ts:190,196-198`) and `authenticate-mobile.ts:39` puts it in the 401 body as
  `{ reason }`.
- **Why it matters:** a request on a session whose cache says `revoked:account_deleted` while the
  account row still exists (the crash window §5 describes) returns `401 SESSION_INVALIDATED` with
  `reason: 'account_deleted'` — a value any closed Dart-side enum for `reason` must accept. No
  schema or index is affected.
- **Remedy:** the spec's §5 statement should name both the array and the union; confirm the mobile
  client treats `reason` as an open string (it wipes on `SESSION_INVALIDATED` regardless, Story 1
  AC6).

---

## Checked and found CLEAN

- **`accountId` sweep is now complete.** Repo-wide over `backend/src/models/**`, exactly six
  collections carry an `accountId`: `MobileSession:35`, `ChannelMembership:20`,
  `JuviProvisionedCredential:25`, `NotificationDelivery:47`, `JuviEvent:20` (all hard-deleted by
  §3.1) and `NoticeRecipient:62` (reset). `grep` for `ref: 'JuviAccount'` returns only these five
  plus `NoticeRecipient`, and no model stores the account under any other name (`juviAccountId`,
  `account`) — the only other `account*` fields in the repo are `FinancialLedger.accountCode/Name`.
  The rev-1 set was short by exactly H1+H2; it is no longer short.
- **The indirect-key sweep (`sessionId`) is also complete.** The only model referencing
  `MobileSession` is `NoticeRecipient.ack.sessionId` (`NoticeRecipient.ts:49`, `ref:'MobileSession'`,
  `required`). The reset's `$set: { ack: null }` clears the subdocument, so no dangling session ref
  is created. The other `sessionId` fields in the repo point at unrelated models
  (`MentorConcern.ts:7` → `MentorSession`, `AttendanceRecord.ts:10` → `AttendanceSession`).
- **Every account-scoped collection has `collegeId`,** so each `deleteMany`/`updateMany` scopes
  cleanly; every declared deletion key is index-supported: `{collegeId,accountId}` on
  `MobileSession:54`, `ChannelMembership:31`, `JuviProvisionedCredential:42`,
  `NoticeRecipient:79-80`; `{collegeId,userId}` on `JuviAccount:96`; `{collegeId, …}` prefixes on
  `NotificationDelivery`/`JuviEvent`.
- **`NoticeRecipient` reset field names all exist** and are exactly the membership-carrying set:
  `accountId:62`, `receivedAt:68`, `seenAt:69`, `dismissedAt:70`, `remindedAt:71`, `ack:72`. The
  remaining fields are notice-level (`collegeId`, `noticeId`, `personId`, `kind`, `labels`,
  `addedLater`, `ackRequired`, `deadline`, `archived`).
- **`archived` is correctly left alone.** It is set only by the notice-level event handler
  `mirrorArchive` (`notices/consumers.ts:161-163`), which stamps *every* row of an archived notice;
  there is no per-account archive path. It describes the notice, not Juvi membership. (The
  per-account state is exactly `receivedAt`/`seenAt`/`dismissedAt`/`ack`, all written only against
  `accountId: ctx.accountId` — `ack-service.ts:55,71`, `mobile-service.ts:170` — and all reset.)
- **`receivedAt`'s "null on every account-less row" invariant holds** — it is written together with
  `accountId` at `consumers.ts:36`, `recipient-service.ts:24`, `welcome-service.ts:99`, and only
  when `onJuvi` in `recipient-service.ts:56`. Resetting it is therefore not a lost delivery
  receipt: the notice audience row itself survives, and the per-account delivery record is the
  (disclosed-as-deleted) `NotificationDelivery` row. Reach/CSV do not read `receivedAt` at all
  (`reach-service.ts:26` `ROW_FIELDS`).
- **The recount reproduces activation exactly.** `spec.md:206-207` is line-for-line
  `recipient-service.ts:30-31` (`countDocuments({collegeId, noticeId, addedLater:false, accountId:
  {$ne:null}})` then `Notice.updateOne({_id, collegeId, status:{$ne:'publishing'}}, {$set:
  {'counts.onJuvi': onJuvi}})`). It leaves the counter correct: nulling `accountId` on the person's
  snapshot row drops them from the count by exactly one, the `audience` counter is untouched
  (no row deleted), and the `publishing` guard matches the fan-out's own count
  (`consumers.ts:83-90`), which recomputes after the fact. The welcome notice path
  (`welcome-service.ts:93,99`) uses the same snapshot-row shape, so a reset recount is consistent
  with it.
- **The reset's institutional-safety claims hold.** `counts.audience` is not disturbed; the
  surviving `'NoticeAcknowledgement'` `AuditLog` row still resolves (`entityId` = noticeId,
  `changes.newValue.recipientId` = the surviving row `_id`, `consumers.ts:100-122`); the row is
  restorable because `onAccountActivated` selects `accountId: null` rows by `personId`
  (`recipient-service.ts:20`) and `backfillAddedLater` skips notices for which a row already exists
  (`recipient-service.ts:44`); and the reach board buckets live from `accountId`
  (`reach-service.ts:88-93`) so the person correctly reads `not_on_juvi`.
- **Story 2 AC2's ordering genuinely achieves its claim.** `revokeSession(sessionId, reason)`
  (`session-service.ts:148-153`) does the Mongo write **and** write-through
  `cacheState(sessionId, 'revoked:<reason>', 900)`; because it runs before `deleteMany`, a session
  whose row is deleted can no longer be served `'active'` from the 60 s `juvi:sess:<sid>` cache
  (`session-service.ts:10,188-189`), so "sessions deleted while the account still exists" (a crash
  between the session step and the account step) is closed. `REVOKE_REASONS` is the real export
  name (see L5), and `juvi:acct-touch:<accountId>` is a real key (`authenticate-mobile.ts:86`).
  Both orderings are idempotent (a second `revokeSession` matches `revokedAt: null` and still
  re-writes the cache; `deleteMany` is idempotent by construction).
- **`juvi:sess-touch:<sid>` is the only Juvi Redis key not cleaned** (`session-service.ts:207`) — a
  60 s one-shot throttle marker with no account or session state; correct to leave.
- **Story 2 AC8's `{collegeId, userId}` is correct and does not over-delete.** The index is
  non-unique (`JuviAccount.ts:96`, cited correctly), and `{collegeId, userId}` selects at most one
  account in practice: provisioning resolves the `User` by `{collegeId, personId}`
  (`provisioning-service.ts:105`) and `JuviAccount` is unique on `{collegeId, personId}`
  (`JuviAccount.ts:95`), so two accounts cannot share a `userId` while having different persons.
  Child rows are keyed by `accountId`, so collecting ids from the resolved account(s) finds them
  all; `collegeId` is on every child model.
- **`AckRecord` is genuinely outside the footprint.** Keyed to the retained `Student`, not the
  account (`AckRecord.ts:6,14,19`), written/read by the ERP academics Juvi surface. Deleting it
  would mutate the retained `Student` record set; leaving it is correct. The disclosure wording
  (Story 1 AC1, `spec.md:43-44`) must be read as the mobile `NoticeRecipient` state, which §3.4
  already requires the policy copy to scope.
- **The audit-intent-first ordering is sound against `shared/audit.ts`.** `createAuditLog` is
  insert-only (`:60-62`); `action:'delete'` is in the enum (`:28`); `entityId` is a plain `String`
  with no `ref` (`:42`), so deleting the account cannot orphan or cascade the trail; an existence
  query is supported by `{entityType:1, entityId:1, timestamp:-1}` (`:51`) and `entityId:1` (`:42`).
  The only defect is *which* key the guard uses (M1), not the approach.
- **`User`/`Person`/`Student`/`Faculty`/`Staff` are untouched**; no field on them references
  `JuviAccount`; §3.3's ban on `deactivateAccount()` is correct (`provisioning-service.ts:206-213`
  sets `User.isActive = false` at `:210` and only soft-revokes at `:211`).
- **`JuviAccount.deletionRequestedAt` / `deletionRequestedVia` do not interfere with any existing
  reader/writer.** The reconciler's sweep is `updateMany({collegeId, status: {$in:
  ELIGIBLE_STATUSES}}, {$set: {lastReconciledAt}})` (`spaces/reconcile-service.ts:133`) — a path
  write on an unrelated field. Activation mutates and `save()`s (`provisioning-service.ts:179-204`),
  which writes only modified paths. Settings/onboarding writes are dotted `$set`s on
  `settings.*`/`onboarding*` (`me-service.ts:112-121,127-135`). Provisioning's idempotency check is
  `{collegeId, personId}` (`:102`), untouched. The schema is strict, so §6's requirement to add the
  fields to `models/juvi/*` (`spec.md:373-374`) is load-bearing and correctly stated.
- **`ChannelMembership` deletion is consistent with the reconciler**, which rebuilds memberships
  from the `ELIGIBLE_STATUSES` graph and recomputes `memberCount` every pass
  (`reconcile-service.ts:122-126,168`); a deleted account is simply out of `expected`.
- **Hard-delete vs. the unique indexes.** `refreshTokenHash` (`MobileSession.ts:53`) and the
  partial `pushToken` (`:59`) are write-time constraints; `deleteMany` cannot violate them, and
  removing the holder frees the token.
- **The other `userId`-keyed Juvi collections are ERP-side, not mobile.** `JuviConversation`,
  `JuviMessage`, `JuviFeedback` (`userId` ref `Person`), `AgentAction`/`AgentConversation`/
  `SituationDismissal` (`userId` ref `User`) are written by `modules/juvi` / `shared/ai`, keyed to
  the retained person, and are neither orphaned nor part of the account footprint. College-scoped
  config (`Channel`, `ChannelTemplate`, `Notice`, `JuviInsight`, `JuviKnowledgeBase`,
  `JuviNoticeCard`, `JuviPersonaConfig`…) has no account key.
- **No cascade hooks.** `JuviAccount.ts:63-101` defines no `pre/post` middleware, so the explicit
  set is the whole set.
- **No resurrection paths.** `JuviAccount.create` is only `provisioning-service.ts:135` (admin run);
  the cancellation workflow deactivates (`admissions/workflow.handlers.ts:2004`); the reconciler
  and `authenticate-mobile` write `$set`s on existing rows only.
- **Transactions genuinely unavailable** — the harness uses a standalone `MongoMemoryServer`
  (round 1 verified); §5's ordered, idempotent-`deleteMany` design is the right workaround, and the
  account-last order is justified by retryability, exactly as rev 2 now states (`spec.md:345-352`).

## Could not verify

- **The implemented deletion service and job** do not exist yet (the folder holds only `.md` files),
  so this report validates the spec against the schema, as round 1 did.
- **The privacy-policy draft** (an unbuilt §3.4 deliverable) could still over-promise on "notice
  read/acknowledged state" (the `AckRecord` nuance above); no copy exists in-repo.
- **Whether the delayed-job worker will re-read `deletionRequestedAt`** — the spec is silent, which
  is the substance of M2 rather than an unverifiable.
- **The Dart client's handling of a new `reason` string** (L5) — `mobile/` was not read for a
  closed `reason` enum; Story 1 AC6 makes the behaviour reason-agnostic, so the risk is low.

## Severity count

| Severity | Round 1 (rev 1) | Round 2 (rev 2) |
|---|---|---|
| CRITICAL | 0 | 0 |
| HIGH | 2 | **0** |
| MEDIUM | 2 | 2 |
| LOW | 3 | 5 |

Gate criterion (**0 CRITICAL + 0 HIGH**) is **met**. Both round-1 HIGHs are resolved; the two
MEDIUMs are new specification gaps rather than schema defects, and each has a one-line remedy.

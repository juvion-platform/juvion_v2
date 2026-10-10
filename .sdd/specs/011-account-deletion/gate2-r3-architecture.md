# GATE 2 — Architecture validator report (round 3)

**Feature:** 011-account-deletion
**Spec:** `.sdd/specs/011-account-deletion/spec.md` (**revision 3**)
**Discovery:** `.sdd/discovery/011-account-deletion/discovery.md`
**Resolution:** `.sdd/specs/011-account-deletion/gate2-resolution.md` (Part B)
**Prior reports:** `gate2-architecture.md` (r1), `gate2-r2-architecture.md` (r2)
**Reviewed at:** worktree `juvi-flutter-shell` (branch `chore/deploy-atomic-portal-publish`)
**Verdict:** **FAIL** — 0 CRITICAL, 1 HIGH, 3 MEDIUM, 6 LOW.

Revision 3 replaced the delayed-BullMQ-job trigger with a **recurring DB sweep** and that
replacement is, structurally, the right mechanism: `shared/jobs/proposal-expiry-worker.ts` really
is a recurring sweep over due rows, the durable field is now read at execution, no custom `jobId`
is constructed, `server.ts` really does register workers under a `DISABLE_BACKGROUND_JOBS` gate,
and the module-local placement in §6 matches how the two existing Juvi workers are wired. All
seven of the specific claims I was asked to check verify against source — **except one, and it is
load-bearing**: the query §3.5.1 gives as the trigger carries `status: { $in: ELIGIBLE_STATUSES }`,
and that predicate silently and permanently excludes a reachable class of pending deletions from
ever running. That is the same failure the round-2 remedy existed to remove, reintroduced by the
remedy itself.

---

## What I checked and found clean

Every claim below was read from source, not taken from the spec.

**1. `proposal-expiry-worker.ts` is genuinely a recurring DB sweep over due rows — a fair
precedent for the sweep shape.** `expireProposals()` (`:29-103`) re-queries the durable rows each
tick (`:35-38` `HostelAllocation.find({ status: 'proposed', expiresAt: { $lte: now, $ne: null } })`,
`:72-75` transport twin), and registration schedules recurrence — `registerProposalExpiryQueue()`
(`:117-131`) calls `registerQueue(...)` then `queue.add('sweep', {}, { repeat: { pattern: '*/15 * * * *' } })`
at `:126-130` (the two line ranges the spec cites). The durable record (`expiresAt`) is the source
of truth and a skipped run self-heals. §3.5.1's description of it is accurate. Two caveats carried
into findings below: that worker **claims atomically** with the precondition inside the write
(`:42-46` `findOneAndUpdate({_id, status:'proposed', expiresAt:{$lte:now}}, {...})`) — the spec's
read-then-delete does not (M2) — and its query has **no status set that can exclude a due row**,
which is exactly what §3.5.1 adds (H1).

**2. `server.ts` registers workers, and the `DISABLE_BACKGROUND_JOBS` gate is real and where the
spec says.** `server.ts:20` `if (process.env.DISABLE_BACKGROUND_JOBS !== 'true')`; each register is
wrapped in its own `try/catch` that only `console.warn`s (`:21-45`); the two Juvi queues are
registered at `:31-40` (`registerJuviProvisioningQueue` / `registerJuviReconcileQueue`, imported
`:9-10`). `getQueue` throws when a name is unregistered (`QueueManager.ts:55-58`). So §3.5.1's
"Operational dependency, stated plainly" is factually correct, and the `getQueue`-on-the-sign-in-path
hazard is genuinely gone: with the sweep there is no `getQueue()` call on authentication at all.

**3. `deletionRequestedAt` / `deletionRequestedVia` do not exist yet — adding them is a real
deliverable, correctly placed.** The `IJuviAccount` interface (`JuviAccount.ts:30-47`) and the
schema (`:63-93`) carry neither field, so §6's `models/juvi/*` item is a genuine new-field add,
not a no-op. (The index question is MEDIUM-1.)

**5. §3.1's collect-before-update works against the real `NoticeRecipient` fields, and the recount
is verbatim.** The capture uses `_id`, `noticeId`, `addedLater` — all present (`NoticeRecipient.ts:26-42`);
`accountId` is `default: null` (`:62`) so `$set: {accountId: null}` is legal; the row is per person
(`:78` `unique {noticeId, personId}`). The `!addedLater` filter mirrors activation's `snapshotNotices`
(`recipient-service.ts:28`), and the recount block is character-for-character
`recipient-service.ts:30-31`. Filtering the update by `_id: { $in: rows }` rather than by `accountId`
does defeat the fan-out race as §3.1 claims.

**6. Worker placement (§6) is consistent with the module's wiring — no cycle, no orphan.** The
module-local convention exists: `modules/juvi-app/accounts/provisioning-worker.ts` and
`modules/juvi-app/spaces/reconcile-worker.ts`, imported by `server.ts:9-10` and registered `:31-40`,
both importing their infrastructure from `shared/queue` (`reconcile-worker.ts:15`). A new
`accounts/deletion-worker.ts` importing `./deletion-service` + `models/juvi/*` cannot cycle — the
deletion service does not import the worker — and `server.ts` is the single registration point.
§6's reversal of r2-MEDIUM-1 is right. (Only the *recurrence shape* differs; LOW-4.)

**7. `deletionRequestedAt` on `GET /me` collides with nothing.** `MeResponse` is `z.infer` of
`meResponseSchema` (`accounts/schemas.ts:67-86`), which is registered as the OpenAPI `Me` component
(`document.ts:92`); neither contains a deletion key. `getMe` already loads the account
(`me-service.ts:52`) so the values are in hand, and because the return is a typed object literal
(`me-service.ts:95-106`) TypeScript forces the added keys — the contract change cannot be forgotten
silently. §3.5.3/§3.6 cost it correctly, and the raw-Dio R61 note is accurate
(`mobile/README.md` "Toolchain notes"; `me_repository.dart`).

**4 (partly). The re-read does close the *scan-to-execute-start* race** — the residual window is
the separate MEDIUM-2.

**Also clean, verified in passing:**
- The abandoned design's `jobId` really was invalid: the installed BullMQ rejects a custom id whose
  `split(':').length !== 3` (`node_modules/bullmq/dist/cjs/classes/job.js` `Custom Id cannot contain :`),
  and the repo's `_`-separator workaround is real (`lead-scoring/enqueue.ts:32-35`). §3.5.1 records
  this accurately and now constructs no id.
- `REVOKE_REASONS` / `RevokeReason` are a closed, schema-visible enum (`MobileSession.ts:4-10`,
  `:47`); `revokeSession` writes through the `juvi:sess:<sid>` cache and `$unset`s `pushToken`
  (`session-service.ts:148-153`); `juvi:acct-touch:<accountId>` is real (`authenticate-mobile.ts:86`).
- The 010 scope plugin's hook list is exactly the seven single-doc ops, with no
  `deleteMany`/`updateMany` (`scope-plugin.ts:73`).
- The deletion set is complete: exactly six models reference `ref: 'JuviAccount'`
  (`ChannelMembership.ts:20`, `JuviEvent.ts:20`, `JuviProvisionedCredential.ts:25`,
  `MobileSession.ts:35`, `NoticeRecipient.ts:62`, `NotificationDelivery.ts:47`), and §3.1 covers all
  six. The only other `ref: 'MobileSession'` is `NoticeRecipient.ack.sessionId` (`NoticeRecipient.ts:49`).
- `deactivateAccount` really does set `User.isActive = false` and only soft-revokes
  (`provisioning-service.ts:206-214`), so §3.3's prohibition is correct.
- The audit-guard collision is real: the provisioning `create` entry is keyed
  `{collegeId, entityType: 'JuviAccount', entityId}` (`provisioning-service.ts:165-174`), so
  including `action: 'delete'` in the guard (Story 2 AC4) is necessary and sufficient.
- `lookupInstitutionByCode` returns null for unknown, inactive and disabled alike
  (`institution-config.ts:73-80`), so Story 3 AC5's collapse holds by construction.
- Story 3 AC7's ordering hazard is real (`v1Router.use(spacesRouter)` at `routes.ts:25`;
  `spacesRouter.use(authenticateMobile)` at `spaces/routes.ts:6`).
- Story 1 AC3's mobile primitives: `ReceiptQueue` has `read`/`add`/`remove` and **no** `clear()`
  (`receipts.dart:39-69`); `SecureStore.clearPendingLink()` (`secure_store.dart:96`),
  `_lastAccount = 'juvi.last_account'` (`:28`) holding `<collegeId>:<accountId>` (`:98-101`);
  `_wipe()` = `wipeAll()` + `AppDatabase.wipe()` (`session_controller.dart:159-171`);
  `AppDatabase.wipe()` clears `kvCache`/`pendingActions`/`analyticsEvents`
  (`app_database.dart:243-247`), so the cached `me` doc goes.

---

## Findings

### AR3-H1 (HIGH) — §3.5.1's sweep filters on `ELIGIBLE_STATUSES`, so a pending deletion on an account that is (or becomes) `exiting`/`deactivated`/`alumni` never executes — permanently and silently

**Evidence.**
- The trigger query, `spec.md:344-349`:
  ```js
  const due = await JuviAccount.find({
    status: { $in: ELIGIBLE_STATUSES },
    deletionRequestedAt: { $lte: new Date(Date.now() - DELETION_GRACE_DAYS * 86_400_000) },
  }).select('_id collegeId userId').lean();
  ```
- `ELIGIBLE_STATUSES = ['onboarding', 'active']` (`JuviAccount.ts:11-12`), documented there as
  *"Statuses that may hold channel memberships and sign in"* — a **sign-in-eligibility** set, not a
  "this deletion should run" set. The spec imports it as the deletion trigger set.
- The request can be recorded on a non-eligible account. `signIn` refuses **only** `deactivated`
  (`auth-service.ts:60-62` `if (account.status === 'deactivated' || !user.isActive)`), so `exiting`
  (and, in R1, `alumni`) can pass credential verification; Story 3 AC2's `verifyCredentials` is that
  same extraction with the session/token/cooldown parts removed (`spec.md:129-137`).
- More emphatically, the status can change **during** the 7-day window (`DELETION_GRACE_DAYS = 7`,
  `spec.md:378`) through a fully automated ERP path: `deactivateAccount` is called by
  `modules/admissions/workflow.handlers.ts:2009` (`W01 cancel_m12` — a cancelled admission
  deprovisions the Juvi account) and from the admin console (`admin/accounts-controller.ts:13`). A
  request made while `active` and an admissions cancellation a day later produce exactly the bad state.
- Nothing recovers it. §3.5.1 states the field is the *only* trigger (`spec.md:339-341`) and that a
  skipped run self-heals (`:367-368`) — but the field stays set and the **filter** keeps excluding
  the row on every future tick, so it is not skipped-and-retried; it is excluded forever.
- The footprint §3.1 promises to erase survives that state: `deactivateAccount` deletes only
  `ChannelMembership` and revokes sessions (`provisioning-service.ts:211-212`), leaving
  `NotificationDelivery`, `JuviEvent`, `JuviProvisionedCredential` and the `NoticeRecipient` Juvi
  state — the four rows §3.1 exists to remove.

**Why it is a defect.** It falsifies the spec's own guarantee — *"the deletion completes at the
deadline whether or not anyone responds"* (`spec.md:334-336`) — for a reachable subclass, and it is
the **same defect class round 2 rated HIGH** (AR2-H2: a lost trigger means the deletion silently
never runs) reintroduced by revision 3's own remedy query. The consequence is fail-open: the
requester (the public path's whole audience is someone without the app) has no surface to detect or
retry, and the college keeps a Juvi footprint the feature promised to delete. Round 2 rejected this
outcome at HIGH severity; the sweep does not remove it while this predicate remains.

**Remedy.** Make the field the sole trigger, as §3.5.1 claims it is — drop `status` from the query
(the deletion is Juvi-scoped and safe in any account status), or, if some statuses genuinely must
not be swept, state which and enforce the same set on the request-recording path so the field can
never be set on a row the sweep will refuse. Either way, no status the request path accepts may be
excluded by the sweep.

---

### AR3-M1 (MEDIUM) — the sweep query has no supporting index, so it is a full collection scan of `JuviAccount` on every tick, and it contradicts §5's blanket tenancy rule

**Evidence.**
- `JuviAccount`'s indexes (`JuviAccount.ts:95-99`) are `{collegeId, personId}` unique,
  `{collegeId, userId}`, `{collegeId, status, kind}`, `{collegeId, studentId}` sparse,
  `{collegeId, facultyId}` sparse — **every one is `collegeId`-prefixed**, and none covers
  `deletionRequestedAt`.
- The sweep query (`spec.md:344-349`) supplies **no** `collegeId` and no `kind`, so it cannot use any
  of them: Mongo cannot use a compound index whose leading field is absent, so the plan implies a
  COLLSCAN of the whole collection every interval. `JuviAccount` is one row per provisioned person
  (`{collegeId, personId}` unique), i.e. potentially hundreds of thousands of rows across colleges.
- §5 (`spec.md:449-450`) and Story 2 AC7 (`spec.md:104-105`) both assert *"every query filters by
  `collegeId` — no query runs without it."* The sweep is a query that runs without it. (The sweep
  legitimately must be cross-college — `proposal-expiry-worker.ts:35-38` and
  `GraphLoader`-style enumeration do the same — but the spec states the rule without the exception.)
- §6's `models/juvi/*` item (`spec.md:492-493`) names the new fields but not an index for them.

**Why it is a defect.** A recurring unfiltered scan on a hot collection is an operational landmine
the plan has no instruction to avoid, and the spec's own hard constraint (AC7/§5) is internally
contradicted by its own §3.5.1 query — the same self-contradiction pattern round 2 flagged.

**Remedy.** Add the index to the `models/juvi/*` deliverable in §6 (e.g.
`JuviAccount.schema.index({ deletionRequestedAt: 1 })`, ideally partial on
`{ deletionRequestedAt: { $type: 'date' } }`, with `status` only if the status predicate survives
H1's remedy), and state in §3.5.1 that the sweep is the one deliberate exception to the
"every query filters by `collegeId`" rule.

---

### AR3-M2 (MEDIUM) — the re-read is a plain read, not an atomic claim, so the cancellation race is narrowed rather than closed

**Evidence.**
- §3.5.1 claims it is closed: *"the executor **re-reads `deletionRequestedAt` on each row immediately
  before deleting it**, so a cancellation landing between the scan and the write still wins"*
  (`spec.md:351-352`).
- The re-read is a read; the account-row delete is the **last** step of a multi-step service (§5
  order: audit intent → revoke sessions → reset notice state → delete child rows → delete the account
  row last, `spec.md:456-464`). A cancellation (`$unset deletionRequestedAt`) landing after the
  re-read but before the final delete is not observed and the account is deleted — the harm Story 4
  exists to prevent.
- The spec's own cited precedent does it atomically: the precondition is inside the write
  (`proposal-expiry-worker.ts:42-46` `findOneAndUpdate({_id, status:'proposed', expiresAt:{$lte:now}}, ...)`,
  and `:78-82` for transport), so a racing state change loses the claim rather than being missed.

**Why it is a defect.** The spec states a property ("a cancellation … still wins") that the
specified mechanism does not fully provide — the same "claim the mechanism doesn't deliver" shape
that produced round 2's AR2-H2. The window is small, so the impact is limited, but the stated
guarantee is stronger than the design.

**Remedy.** Claim atomically: `findOneAndUpdate({ _id, collegeId, deletionRequestedAt: { $lte: cutoff } },
{ $set: { deletionClaimedAt: now } })` and proceed only if a document was returned; cancellation then
either lands before the claim (deletion skipped) or after it (already committed), with no unobserved
window. If a plain re-read is kept, weaken §3.5.1's wording to say the race is *narrowed*, not closed.

---

### AR3-M3 (MEDIUM) — the *Cancel deletion* action has no endpoint and no contract entry

**Evidence.**
- Story 1 AC7 requires a *Cancel* action on the in-app banner (`spec.md:61-62`) and Story 4 AC1
  makes the explicit Settings/banner *Cancel deletion* the first of the three cancellation paths,
  defined as a server-side state change — *"Cancellation is **clearing the field**"*
  (`spec.md:186-192`).
- §3.6's contract update declares exactly one new route — `deleteAccount`
  (`{ operationId:'deleteAccount', method:'delete', path:'/me/account', …, status:204 }`,
  `spec.md:422-430`) — which is the **immediate in-app deletion**, a destructive call. No route for
  cancelling a pending request is named anywhere in §3.2, §3.5 or §3.6.
- The mobile client is generated from the OpenAPI document (`document.ts:202-207`,
  `stableStringify`), which is why §3.6 exists at all.

**Why it is a defect.** As specified, the Cancel AC has no client-callable surface, and the one
contract edit §3.6 mandates is not the one this AC needs. It is the same omission class round 2
raised as AR2-M2 ("a response/contract change the spec never costs") — not a wrong design, but an
AC that cannot be satisfied by the contract the spec declares.

**Remedy.** Name the cancel route in §3.5 (e.g. `DELETE /me/account/deletion`, clearing
`deletionRequestedAt`/`deletionRequestedVia` with `204`) and add it to §3.6's declaration list
alongside `deleteAccount`, with a matching OpenAPI entry so the Dart client carries it.

---

### AR3-L1 (LOW) — r2 LOW-1 is unresolved: the `NoticeRecipient` reset filters one `accountId`, while the deletion removes accounts by the collected set

`spec.md:237`/`:241` filter `{ collegeId, accountId }` (singular), but Story 2 AC8 (`spec.md:109-112`)
removes account rows by `{ collegeId, userId }` — "the whole account set for that credential" — and
child rows by the collected account ids. `{collegeId, userId}` is deliberately not unique
(`JuviAccount.ts:96`), so a multi-account credential leaves one account's notice state uncleared,
contradicting Story 1 AC1. The reset should be `{ collegeId, accountId: { $in: accountIds } }`. This
was r2 LOW-1 and is not mentioned in Part B's fold-in table.

### AR3-L2 (LOW) — r2 LOW-3 is unresolved: Story 3 AC8 still makes `Sec-Fetch-Site: same-origin` the primary form

`spec.md:173-175` requires `Sec-Fetch-Site: same-origin` "(or an `Origin`/`Referer` check …)". The
static page is served from the portal web root (`admin-portal/public/…` → nginx) while the endpoint
is under `/api`; the two share an origin only if production nginx proxies `/api` on the same host
(the config is not in the repo). Where they do not, the strict form rejects every legitimate
submission. Make the `Origin` allowlist the primary check and `Sec-Fetch-Site` a hardening addition,
as r2 recommended; Part B does not record this fix.

### AR3-L3 (LOW) — citation drift persists (r2 LOW-2, second half)

`spec.md:169` cites `spaces/routes.ts:8` for the router-wide `authenticateMobile`; the call is at
`spaces/routes.ts:6`. Cosmetic, but the round-1 findings were of exactly this kind.

### AR3-L4 (LOW) — the sweep's recurrence shape cites the older `add({repeat})` form rather than the module-local `upsertJobScheduler` convention

§3.5.1 cites `proposal-expiry-worker.ts:126-130` — `queue.add('sweep', {}, { repeat: { pattern } })`.
The Juvi module's own workers use a stable-scheduler-id form:
`reconcile-worker.ts:44-51` `queue.upsertJobScheduler(SWEEP_SCHEDULER_ID, { every: intervalMs }, …)`,
and `:16`'s comment records that the older `add(…, { repeat })` form keyed the schedule by interval
and left the previous one running when the interval changed. Since §6 places this sweep with the
module's workers, following the module's own shape is the more consistent precedent. (The repo's
`add({repeat})` form is idempotent for a fixed interval, so this is consistency, not correctness.)

### AR3-L5 (LOW) — §6 omits the queue infrastructure the sweep needs, the sweep interval is unspecified, and `deleteScoped` has no named home

`QUEUE_NAMES` is a closed `as const` (`QueueManager.ts:113-146`; Juvi names at `:141-142`), so the
new sweep needs a new constant and an import of `registerQueue`/`getQueue` from `shared/queue` —
neither appears in §6's dependency list (`spec.md:477-496`). §3.5.1 also never names a sweep
interval (it says only "Precision is one sweep interval", `spec.md:375`), unlike the precedents
(`*/15 * * * *`, `proposal-expiry-worker.ts:129`; `JUVI_RECONCILE_INTERVAL_MINUTES` default 5,
`reconcile-worker.ts:41`). And `deleteScoped(Model, filter)`, which Story 2 AC7 makes the single
deletion write path, is a new helper with no stated file (grep: it does not exist today). None of
these is a design fault; each is an instruction the plan must invent.

### AR3-L6 (LOW) — the admin-visible pending-deletion surface is required by §3.5.1 but owned by no AC or contract entry

§3.5.1 makes it mandatory — *"an admin-visible **pending-deletion surface** must exist so a stalled
sweep is detectable rather than silent"* (`spec.md:373-375`) — as the mitigation for the
operational dependency the sweep inherits. No user story or AC mentions it, and §6 lists no
deliverable for it. A requirement stated only in design prose, with no AC, tends to drop out of the
task list; since it is the only detection mechanism for the failure mode H1 and the operational
dependency both create, it deserves an AC.

---

## Severity counts

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 6 |

**GATE 2 criterion (0 CRITICAL + 0 HIGH) is NOT met.**

**Round-2 HIGH status:** AR2-H1 (`jobId` colon) **resolved** — no id is constructed. AR2-H2
(ephemeral trigger / inert durable field / no disarm) **resolved in mechanism, but a new
silent-non-execution path is introduced by the same query** — AR3-H1.

**Round-2 MEDIUM status:** AR2-M1 (worker placement) resolved (§6); AR2-M2 (`GET /me` schema change)
resolved (§3.5.3/§3.6, and the `z.infer` return makes it compiler-enforced); AR2-M3 (notice-shaped
push) resolved (§3.5.2 names the closed enums); AR2-M4 (`no_device`) resolved (§3.5.2).

**Round-2 LOW status:** LOW-1 **not resolved** (AR3-L1); LOW-2 half-resolved (AR3-L3);
LOW-3 **not resolved** (AR3-L2).

---

## Could not verify

- **No live Redis, Mongo or HTTP run.** Every backend claim is a source read; the BullMQ colon
  rejection is taken from the installed package's source rather than by executing `add()`.
- **The production nginx config is not in this repo.** The static-page `try_files`/SPA-fallback order
  and the same-origin question behind AR3-L2 rest on `scripts/deploy.sh` plus vite's documented
  `public/` → `dist/` copy, not on an actual server block.
- **`HostelAllocation`/`TransportAllocation` index coverage was not checked**, so I do not assert
  that the cited `proposal-expiry` precedent is itself indexed; AR3-M1 rests only on `JuviAccount`'s
  own indexes (`JuviAccount.ts:95-99`), which I did read.
- **The Play Console policy wording** (the reason the feature exists) came from the spec and
  discovery; it was not independently fetched.
- **Whether the Juvi admin console can set `exiting` directly** was not established
  (`admin/schemas.ts:52` accepts it; `transitionAccount` has only the `deactivated`/`active` call
  sites at `provisioning-service.ts:209` and `me-service.ts:141`). AR3-H1 does not depend on it —
  the `deactivated`-during-the-window path via `workflow.handlers.ts:2009` is sufficient.

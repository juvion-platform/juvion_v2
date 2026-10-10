# GATE 2 — api-security validator report (round 2)

**Feature:** 011 — Juvi account deletion
**Spec under review:** `.sdd/specs/011-account-deletion/spec.md` **revision 2** (post-GATE-2 fix round)
**Discovery:** `.sdd/discovery/011-account-deletion/discovery.md` · **Resolution:** `gate2-resolution.md` · **Round 1:** `gate2-api-security.md`
**Worktree:** `/Users/srinivasarao.kandula/code/juvion_v2/.claude/worktrees/juvi-flutter-shell`

**Verdict: PASS — 0 CRITICAL, 0 HIGH.** GATE 2 requires 0 CRITICAL **and** 0 HIGH.
All three round-1 HIGH are genuinely remedied (verified against the code, not only against the new
spec text). 8 MEDIUM and 5 LOW are reported below; MEDIUM/LOW are advisory and do not fail the gate.

| Severity | Count | Gate effect |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 | **gate met** |
| MEDIUM | 8 | advisory |
| LOW | 5 | advisory |

Round-1 HIGH disposition: **H1 resolved**, **H2 resolved** (residual reported as M3), **H3 resolved**.

No implementation of 011 exists yet (`grep -rn 'deleteAccount|account-deletion|deletionRequested|verifyCredentials|deletionVerifyLimiter|DELETION_GRACE'` across `backend/src`, `mobile/lib`, `admin-portal/src` returns nothing), so every finding below is a defect in the **spec's claims or decisions**, substantiated against the code the spec says it will reuse. Line refs are from this worktree.

---

## Round-1 HIGH items — confirmed resolved

### H1 — public path reusing sign-in's per-identifier cooldown (account-lockout weapon) — **RESOLVED**

**Spec text that addresses it:** Story 3 AC6 — *"The public verification does **not** use sign-in's
per-identifier cooldown. … The public path uses a separate key namespace
(`juvi:deletion-verify:<collegeId>:<hash-of-identifier>`) with a **non-blocking** budget: attempts
are counted and backed off / tarpitted, never hard-blocked, so this endpoint can never deny
sign-in."* Also §6: *"`accounts/cooldown.ts` — read it to know what **not** to reuse."* And the
resolution's ruling 1 folds AR-M4 into the same fix.

**Verified sufficient against the code, not merely stated.** The lockout weapon was that
`cooldownKey()` produces exactly one key per `(collegeId, identifier)` —
`juvi:login-fail:${collegeId}:${h}` (`cooldown.ts:8-11`) — and `signIn` reads it before any
credential check (`auth-service.ts:32-35`) and increments it on every failure
(`auth-service.ts:56` → `cooldown.ts:26-32`). The remedy is sufficient **because the two mechanisms
are key-disjoint**: a budget on `juvi:deletion-verify:*` cannot produce a value at
`juvi:login-fail:*`, and `getCooldown` (`cooldown.ts:13-24`) reads only the latter. Even a *hard*
block on the new namespace would therefore be unable to deny sign-in. AC6 additionally forbids the
only thing that would re-couple them (calling `getCooldown`/`recordFailure`), so the fix is a real
severance, not a relabelling. A residual plan-level risk is recorded as **L5**.

### H2 — public path deletes irreversibly and silently on password possession alone — **RESOLVED (design), with the detection half as a MEDIUM**

**Spec text that addresses it:** §3.5 — *"A public request therefore **schedules** the deletion: the
request is verified … and recorded on the account (`deletionRequestedAt`,
`deletionRequestedVia: 'public_web'`); the owner is **notified** (§3.5.1) and can **cancel**
(Story 4 AC1); a **delayed job** executes the same deletion service after
`DELETION_GRACE_DAYS = 7`."* Story 4 AC1 (explicit Cancel action + sign-in as a safety net), AC2
(*"Revision 1 of this spec had the public path delete **silently**, which is the property this AC
removes."*), AC3 (re-provision restores access with a new temporary credential).

**Verified against the code.** The three properties round 1 asked for all have a real mechanism:
(i) *not immediate* — the 7-day delay is a genuine out-of-band window, and the in-app path keeps the
live-session + typed-phrase proof (Story 1 AC2), so the destructive capability no longer follows
from password possession alone; (ii) *not silent* — §3.5.1 wires a notification through the existing
stack (delivery rows are keyed by `accountId` and the sender resolves devices with
`MobileSession.find({ collegeId, accountId: primary.accountId, … , pushToken: { $type: 'string' } })`
— `sender.ts:120-122`, `:214-216` — so it reaches the owner's devices and no one else); (iii)
*reversible* — the owner can cancel, and Story 4 AC3's restore path is real:
`provisionPerson()` defaults `resetPassword` to **true** (`provisioning-service.ts:94`) and on the
existing-`User` branch rotates the password and sets `mustChangePassword` (`:123-132`), so a
re-provision also invalidates the stuffed credential. The action is no longer a *silent
irreversible takeover on password possession alone*.

**Residual (reported as M3, not a HIGH):** the *notification* is the half of the remedy that is not
guaranteed to arrive — it is subject to the notification policy's suppression rules and to a push
transport that is a logging no-op without `FIREBASE_SERVICE_ACCOUNT_JSON`. The deferral is the
substantive mitigation and it survives that; the notification is not load-bearing on its own. See
M3 for the evidence.

### H3 — `deactivateAccount()` disables the shared ERP login — **RESOLVED**

**Spec text that addresses it:** §3.3 — *"**`deactivateAccount()` must not be reused.**
`provisioning-service.ts:206-214` sets `User.isActive = false` — breaking the shared ERP login,
exactly the failure §1 warns against — and only soft-revokes sessions (sets `revokedAt`, `$unset`s
`pushToken`), violating Story 2 AC2. It is the nearest existing helper and the obvious wrong turn;
the deletion is a distinct path that hard-deletes and never touches `User`."* Plus Story 2 AC3:
*"This assertion is required on **both** the in-app and the public deletion paths."* (ruling 4 makes
the negative explicit rather than leaving it to the test.)

**Verified against the code — the spec's characterisation is accurate, not a paraphrase.**
`provisioning-service.ts:206` `deactivateAccount(...)`; `:210`
`await User.updateOne({ _id: account.userId, collegeId }, { $set: { isActive: false } });`; `:211`
`await revokeOtherSessions(String(account._id), null, 'deactivated');`. Both failure modes the spec
names are present verbatim (`isActive` false on the shared `User`; sessions only soft-revoked, with
a reason that does not describe deletion). The spec now states the prohibition in the negative and
requires the `isActive: true` / unchanged-hash assertion on both paths, which is what round 1 asked
for. **Resolved.**

---

## HIGH

*None.*

---

## MEDIUM

### M1 — Cancellation is enforced only by removing a Redis-resident job; the durable marker is never re-checked, so a cancelled deletion can still execute

**Severity: MEDIUM**
**Evidence:** spec §3.5 (*"Cancellation removes the job and clears the two fields."*) ·
`backend/src/shared/queue/QueueManager.ts:55-59` (`getQueue` throws when the queue is not
registered), `:62-83` (`addJob`) · `backend/src/server.ts:20-22` (queue registration is attempted,
not required: guarded by `DISABLE_BACKGROUND_JOBS` and wrapped in try/catch) ·
`backend/src/shared/jobs/proposal-expiry-worker.ts:126-137` (the cited precedent).

`deletionRequestedAt` is durable (Mongo) but **no executor reads it**. The only thing standing
between a cancelled request and a deleted account is `job.remove()` on a job that lives in Redis.
Three ways that gate fails: (a) `job.remove()` races the delayed job's promotion to `active` —
BullMQ refuses to remove a locked job, and the deletion then proceeds for an account the owner
explicitly cancelled; (b) the queue was never registered (`DISABLE_BACKGROUND_JOBS='true'` — the
documented opt-out in `server.ts:20`, or a Redis-down boot, where `server.ts:22-24` only *warns*) so
`getQueue('…')` throws and the cancellation cannot remove anything at all; (c) a Redis flush between
"clears the two fields" and a re-request.

**Why it is a defect:** the security-relevant direction is fail-*toward*-deletion. An owner's
cancellation is a security control (it is what makes the 7-day window a real mitigation for H2), and
the design makes it a best-effort queue operation on volatile state instead of a check against the
state the request was recorded in. The DB and the queue can disagree, and nothing reconciles them.

**Remedy:** make `deletionRequestedAt` the authority — the job's first action must be a scoped
re-read (`JuviAccount.findOne({ _id, collegeId })`) and it must **abort unless** the marker is still
set and at least `DELETION_GRACE_DAYS` old. Job removal then becomes an optimisation, not the
control. Say this in §3.5, and add a test that cancels between enqueue and execution.

### M2 — The deferred execution is Redis-only; a lost job silently drops the deletion, and the cited precedent is durable in a way this design is not

**Severity: MEDIUM**
**Evidence:** spec §3.5 (*"the deletion completes automatically at the deadline whether or not
anyone responded — the requester is never trapped by not having the app"*; *"following the
`proposal-expiry-worker.ts` precedent already registered in `server.ts:17`"*) ·
`QueueManager.ts:77-81` (`attempts: 3`, `removeOnComplete: { age: 86400 }`,
`removeOnFail: { age: 604800 }`) · `proposal-expiry-worker.ts:126-137`
(`queue.add('sweep', {}, { repeat: { pattern: '*/15 * * * *' } })`) · `docker-compose.yml` (the
`redis` service declares **no volume**) · `QueueManager.jobid.test.ts:30-40`.

The precedent the spec cites is a **recurring cron sweep that reads durable Mongo state** every 15
minutes — its durability comes from the database, not the queue. 011 has no sweep: the only durable
artifact (`deletionRequestedAt`) is written and never read (M1), and the only executor is a one-shot
**delayed** job whose entire state is in Redis. Failure modes, all silent:
- Redis flushed / container recreated (no volume in `docker-compose.yml`) → job gone; the account
  keeps a pending marker with no executor and the request is never completed.
- Three failed attempts (`attempts: 3`, exponential backoff) → the job is retained **failed for 7
  days** (`removeOnFail: { age: 604800 }`), and BullMQ's `jobId` dedupe means a **re-request with
  the same id is not enqueued** for those 7 days — the request cannot be retried even by the user.
- `DELETION_GRACE_DAYS` is stated as a guarantee ("completes automatically at the deadline"); it
  is not one.

**Why it is a defect:** the failure mode is fail-**open on the deletion** — the data-subject
request is silently dropped, which is exactly the Play-compliance property the feature exists to
establish (and it contradicts the spec's own §3.5 claim). It is not an attacker gain, which is why it
is MEDIUM rather than HIGH, but a stated guarantee with no durable enforcement should not pass into
the plan.

**Remedy:** mirror the precedent properly — add a recurring sweep (reuse
`QUEUE_NAMES`/`registerQueue` + a `repeat` job) that selects
`{ deletionRequestedAt: { $lte: now - DELETION_GRACE_DAYS }, deletionRequestedVia: 'public_web' }`
and executes the deletion service, idempotently. Keep the delayed job as a latency optimisation
only. Also state that `queue.add` failure must not leave a recorded-but-unexecutable request.

### M3 — The "owner is notified" half of the H2 fix can be silently suppressed and, in a Firebase-less deployment, reaches no phone at all

**Severity: MEDIUM**
**Evidence:** spec §3.5.1 (*"the notification is sent at *request* time"*) and Story 4 AC2 ·
`backend/src/modules/juvi-app/notifications/policy.ts:79-93` (`decide`: *"if (tier === 'urgent')
return { status: 'scheduled' }*" — **Urgent is the only tier that bypasses the three suppression
rules**; otherwise `tier_off` → `status: 'suppressed'`, mute → `'suppressed'`, quiet hours →
deferred to the next window end) · `policy.ts:113-118` (`digestSendAfter`: Routine rows open a
15-minute digest window and are pushed out of quiet hours) ·
`backend/src/modules/juvi-app/notifications/transport/index.ts:14-24, 29-34` (*"FIREBASE_SERVICE_ACCOUNT_JSON
is not set: Juvi push notifications use the fake (logging) transport and **reach no phone**."*) ·
`transport/fake.ts:23-30` (the fake returns `{ ok: true }` for every token) · `sender.ts:120-122`
(devices are found only via a live `MobileSession` with a `pushToken`).

Three independent ways the owner's only out-of-band signal does not arrive:
1. **Suppressed by the user's own settings.** Nothing in the spec fixes the kind's tier. If it is
   `important`/`routine` and the user has that tier off (`policy.ts:83`) — or any channel is muted —
   the row is written `status: 'suppressed'` and *never delivered*. `Urgent` is the only
   un-suppressible tier. Quiet hours (default `22:00–07:00`, `institution-config.ts:31`) further
   defer a non-Urgent row to the next morning.
2. **No phone to reach.** Without `FIREBASE_SERVICE_ACCOUNT_JSON` the transport is the fake logger,
   which returns `ok: true`, so the sender marks the delivery `sent`/`delivered` and **the ERP trail
   records a notification that reached nobody**. (This is pre-existing plumbing; it is load-bearing
   here because H2's remedy leans on it.)
3. **The Story-3 persona.** For a user who uninstalled the app, the sender's device query finds a
   session only if one is still live *and* still carries a `pushToken`; FCM delivery to an
   uninstalled app reaches nothing. The in-app banner (the first fallback) also requires the app.
   The second fallback, the audit entry, is a database row, not a notification — nothing in the spec
   requires it to be surfaced to a human (no admin alert, no worklist, no report).

**Why it is a defect:** the spec's Story 4 AC2 reads as a guarantee ("The owner is notified").
Against the code it is a best-effort delivery over a stack that can suppress, defer, or fake it —
and the delivery record will not show that nothing arrived. That is the *detection* half of the H2
remedy; the 7-day window is the other half and it does hold, which is why this is MEDIUM.

**Remedy:** state in §3.5.1 that the deletion notice is tier `urgent` (the only un-suppressible
tier — `policy.ts:81`) and is exempt from tier toggles, mute and quiet hours. Add an explicit
second channel that does not depend on the app being installed (an admin-visible pending-deletion
worklist or alert on the existing audit/AdminAlert surface), and say that a `sent` delivery row from
the fake transport is not evidence of notification.

### M4 — "A dedicated notification kind delivered like any other" is not a drop-in: `NotificationDelivery.source` is a closed enum with a required source ObjectId

**Severity: MEDIUM**
**Evidence:** spec §3.5.1 (*"a dedicated notification kind delivered like any other, over
`NotificationDelivery`/`sender.ts`"*) · `backend/src/models/juvi/NotificationDelivery.ts:8`
(`NotificationSourceKind = 'published' | 'reminder-1' | 'reminder-2' | 'created' | 'revoked'`),
`:16` (`INotificationSource { type: 'notice' | 'class_change'; id: Types.ObjectId; … }`), `:49`
(`type: { type: String, enum: ['notice', 'class_change'], required: true }`), `:70`
(`schema.index({ 'source.type': 1, 'source.id': 1, 'source.kind': 1, accountId: 1 }, { unique: true })`),
`:33-51` (`batchKey`/`groupKey`/`sendAfter` all `required`) · `payload.ts:20-30`
(`buildNoticePush` is hard-coded to a notice payload).

An account-deletion notice has **no source document**: `source.id` is a required `ObjectId`
referring to a `Notice` or a `ClassException`, and both enums are closed. "Delivered like any other"
therefore means extending two schema enums (a schema change) *and* inventing a source id *and*
writing a third payload builder — while the spec enumerates exactly one closed enum needing
extension (`REVOKE_REASONS`, §5). The spec's own §5 constraint is that nothing here is "new
plumbing" only for the two *fallbacks*; the primary is implicitly new plumbing whose extent is
undisclosed.

**Why it is a defect:** this is the same class as round-1 M2 (`credential-store` named as a verifier
it does not have): a named, load-bearing dependency that does not exist in the named shape. It sends
the implementer looking for a drop-in path and produces either a schema drift or, worse, an
ad-hoc push that bypasses `NotificationDelivery` entirely (and therefore bypasses the
receipt/`openedAt` trail and the `pushToken` uniqueness handling).

**Remedy:** name the schema change (add `'account_deletion'` to the `source.type` enum and a
corresponding `source.kind`, or make `source.id` optional for this type) and say where its "source
id" comes from. Alternatively state explicitly that this notice does **not** use
`NotificationDelivery`, and specify what it uses instead and how the push token is resolved.

### M5 — AC9's security rationale is factually wrong: the page is served by nginx, so helmet's CSP and framing headers do not apply to it

**Severity: MEDIUM**
**Evidence:** spec Story 3 AC9 (*"it is served under helmet's default CSP (`script-src 'self'`,
`script-src-attr 'none'`), which `helmet()` applies globally and which this feature must not
loosen."*) vs. spec §3.2 (*"a **static asset**, `admin-portal/public/account-deletion.html`, which
vite copies verbatim into `admin-portal/dist/` and the deploy publishes to the web root — so it is
served by nginx at `/account-deletion.html`"*) · `backend/src/app.ts:25` (`app.use(helmet())` —
an **Express** middleware, applied only to responses the Express app produces) ·
`scripts/deploy.sh:152-177` (the portal is rsynced to `$WEB_ROOT/releases/<ts>` and `/current` is
repointed; **nginx**, not Express, serves it — the API is a separate pm2 process on
`PORT=3003`, deploy.sh:106-131).

`helmet()` attaches headers to responses served by the Express app. A file served by nginx from
`/var/www/packkme/juvion/current` never passes through Express, so it gets **no CSP, no
`frame-ancestors`, no `X-Frame-Options`, no `X-Content-Type-Options`** unless the nginx config adds
them — and nothing in the spec requires that. This matters because round 1's "verified clean"
section dismissed clickjacking on the public page *specifically by citing* helmet's
`frame-ancestors 'self'` / `X-Frame-Options: SAMEORIGIN`, and revision 2 moved the page out of the
backend without carrying that protection over. AC9 also asserts a control that "this feature must
not loosen", when the feature is not behind it at all.

Impact is limited (static page, no inline script, no dynamic content, and a framing attacker cannot
read keystrokes typed into a cross-origin frame), which is why this is MEDIUM and not HIGH — but a
spec that states a non-existent protection as an acceptance criterion is a defect the plan will
inherit.

**Remedy:** either (a) require the nginx block that serves `/account-deletion.html` to send
`X-Frame-Options: DENY` (or `frame-ancestors 'none'`) and a restrictive
`Content-Security-Policy`, and make that a plan-time check like AC1's `try_files` check; or
(b) delete the helmet claim from AC9 and keep only "the page needs no inline script".

### M6 — AC3's abuse control is the only hard brake and, with an untrusted proxy, "a lower max than sign-in" throttles the whole campus on the path Play requires

**Severity: MEDIUM**
**Evidence:** spec Story 3 AC3 (*"a dedicated, exported `deletionVerifyLimiter` … with a **lower**
max than `signInLimiter`"*) and AC6 (*"non-blocking … never hard-blocked"*) ·
`backend/src/modules/juvi-app/middleware/rate-limits.ts:7-18` (one `limiter(max)` factory:
`windowMs: 60_000`, **no `store`** ⇒ express-rate-limit's per-process in-memory `MemoryStore`,
`skip: disabled` where `disabled()` is `E2E_TESTING=1|true || NODE_ENV==='test'`), `:21`
(`signInLimiter = limiter(10)`) · `backend/src/app.ts:23`
(`app.set('trust proxy', process.env.TRUST_PROXY_HOPS ? Number(...) : false)`) and `:78-79`
(`globalRateLimit(100)` across **all** `/api`, IP-keyed) · `scripts/deploy.sh:129`
(`pm2 restart` on every deploy) · `.github/workflows/e2e.yml:76` (`E2E_TESTING: '1'`).

AC6 removes the per-identifier hard block (correctly, per H1), which leaves `deletionVerifyLimiter`
as the **only** hard brake on a public endpoint that verifies a shared ERP credential. The
resolution's response to round-1 M9 was "give it a *lower* max than sign-in" — which, in a
deployment where `TRUST_PROXY_HOPS` is unset (the default, `app.ts:23`), keys the bucket on the
**nginx IP** and therefore applies a sub-10/min budget to the entire campus, on the one surface
Google Play requires to be usable. Round 1's M9(1)–(3) (env-gating, in-memory store reset by every
`pm2 restart`, IP key behind a proxy) are all still true of the new limiter, and the new
"lower than sign-in" instruction makes (3) strictly worse. Separately, the *global* per-IP limiter
(`app.ts:79`) is shared with every other `/api` route, so the "separate namespace" argument protects
the per-identifier cooldown only — a flood still exhausts the IP bucket that sign-in also uses.

**Why it is a defect:** the control that is supposed to bound password guessing on a destructive
public endpoint is (a) disabled wholesale by an environment variable, (b) per-process and reset on
every deploy, and (c) keyed on an address that may be the proxy for every user; and the stated
remedy magnifies (c).

**Remedy:** treat the limiter's correctness as a deployment prerequisite, not an implementation
detail: state that `TRUST_PROXY_HOPS` must be set (or that the limiter must use a Redis `store`)
before the public path is enabled, and pick the max from that rather than "lower than sign-in". Keep
AC3's unit test that constructs the limiter directly (the e2e env cannot assert it), and add an
assertion that a successful public deletion verification does not increment `juvi:login-fail:*`.

### M7 — The deferred path's audit semantics are unspecified: a `delete` entry written at request time, for a deletion that may be cancelled, with an existence guard that then suppresses the real record

**Severity: MEDIUM**
**Evidence:** spec Story 2 AC4 (*"An audit entry records the deletion: `createAuditLog({ …, action:
'delete', … })`. … The entry is written **first**, as an intent record, and guarded by an existence
check so a retry after a partial failure does not duplicate it."*) · spec §3.5.1 (the *"ERP-visible
audit entry"* is listed as a **request-time** fallback for notifying the owner) · spec Story 3 AC4
(the public path performs the same deletion, deferred) · `backend/src/shared/audit.ts:27-49`
(`AUDIT_ACTIONS` is a closed mirror: `create|update|delete|…|acknowledge|access_denied|ai_*`; no
`request`/`cancel` value).

The spec never says **when** the deferred path writes its audit entry. §3.5.1 makes the audit entry
a request-time signal, while Story 2 AC4 describes it as recording "the deletion" with
`action: 'delete'`. Both readings are defective:
- **Write at request time** ⇒ the ERP trail records a **deletion that has not happened** and may
  never happen (the owner cancels in the 7-day window). Nothing records the cancellation, and the
  `action` enum has no value to record it with. The trail then lies about a destructive event.
- **Write at execution time, guarded** ⇒ the guard ("find the existing entry, skip") collides with
  the request-time entry if one was written, so the real deletion is recorded by a stale
  request-time row; and if a *later* legitimate in-app deletion occurs on the same account, the
  guard finds the old entry and **skips writing the record of the deletion that actually happened**.

**Why it is a defect:** audit integrity for a destructive, admin-restorable event is part of this
feature's stated value (it is one of the two H2 fallbacks). An ambiguous ordering here produces a
trail that is wrong in both directions, and the fix is one sentence in the spec.

**Remedy:** say explicitly that the public path writes a **request** record at request time
(extend `AUDIT_ACTIONS`, e.g. a distinct `entityType` value already planned — `'JuviAccountPublicDeletion'`
— **and** a distinct action such as `request`/`cancel`), that the execution record is written at
execution time as `action: 'delete'`, and that the existence guard keys on the
`(collegeId, entityType, entityId)` triple so a cancelled request cannot suppress a later real
deletion.

### M8 — The sign-in-side cancellation is not specified as best-effort, and `getQueue()` throws inside the sign-in path

**Severity: MEDIUM**
**Evidence:** spec Story 4 AC1 (*"any successful sign-in clears the request"*) ·
`backend/src/shared/queue/QueueManager.ts:55-59` (`getQueue` **throws** `Queue '<name>' not
registered. Call registerQueue first.`) · `backend/src/server.ts:20-24` (registration is skipped by
`DISABLE_BACKGROUND_JOBS='true'` and wrapped in try/catch that only `console.warn`s when Redis is
unavailable) · `backend/src/modules/juvi-app/accounts/cooldown.ts:13-32` (the existing posture on the
sign-in path is the opposite: every Redis operation catches and continues — *"Redis unavailable:
never lock everyone out"*).

AC1 puts the "any successful sign-in clears the request" hook on the authentication path — the
path that must never fail for unrelated reasons. If that hook calls `addJob`/`getQueue`/`job.remove`
without guarding, then in a Redis-less or `DISABLE_BACKGROUND_JOBS` deployment it throws *inside
`signIn`*, turning a cancellable side effect into a 500 on **every sign-in**. `QueueManager` is
demonstrably eager to throw (`:57`), and the boot registration is best-effort by design. The spec
also does not say what should happen if only the *fields* clear and the job does not (M1).

**Why it is a defect:** it inverts the risk — a bookkeeping step for a rarely-pending flag can take
down authentication for all users. The sign-in path's existing Redis calls are explicitly
failure-tolerant; the new one is not specified to be.

**Remedy:** state that the sign-in-side clear is **best-effort and non-fatal** (catch and log,
matching `cooldown.ts`), that it must not perform queue I/O inline (fire-and-forget, or clear the DB
fields only and let the executor's re-check — M1's remedy — do the rest), and add a test that sign-in
still succeeds with Redis down and with no queues registered.

---

## LOW

### L1 — The `jobId` uses `:` and the cited test proves only that the option is forwarded

**Evidence:** spec §3.5 (*"with `jobId: 'juvi-account-deletion:<accountId>'` for dedupe on a repeat
request. … BullMQ's `jobId` path is already covered by `QueueManager.jobid.test.ts`."*) ·
`backend/src/shared/queue/__tests__/QueueManager.jobid.test.ts:30-40` (asserts only
`opts.jobId === 'score:…'`, i.e. that `addJob` forwards the option to `Queue.add`) ·
`QueueManager.ts:79`.

BullMQ documents `:` as its internal key separator for ids; the repo already uses colons
(`score:college-1:inq-1:29457182`), so this is not introduced by 011 — but the spec cites a test as
covering "BullMQ's jobId path" when that test asserts nothing about dedupe, retention or removal.
Since dedupe is the mechanism the cancellation design rests on (M1), an assertion about *behaviour*
is what is needed. **Remedy:** use a non-`:` separator and add a test that a second `addJob` with the
same id does not create a second job and that `remove()` then makes a re-add succeed.

### L2 — "Any successful sign-in clears the request" is unconditional, and a password change does not clear it

**Evidence:** spec Story 4 AC1; `backend/src/modules/juvi-app/accounts/auth-service.ts:103-113`
(`changePassword` — hashes the new password and `revokeOtherSessions(..., 'password_changed')`, no
interaction with the pending flag).

Two consequences. (a) Anyone holding the (shared, stuffable) password can **clear** a pending
request, including one the legitimate owner filed — the "or vice versa" direction. Impact is low
(they already hold the credential, and the effect preserves access rather than removing it), but the
actor should be recorded, and the AC should say *whose* sign-in clears *which* account's request
(there can be more than one `JuviAccount` per `User` — `JuviAccount.ts:96` is a **non-unique**
`{collegeId, userId}` index, which Story 2 AC8 correctly acknowledges for deletion but not for the
marker). (b) The natural user response to the "a deletion was requested" notice is to change the
password; `POST /auth/change-password` is not a sign-in, so it leaves the deletion armed and the
notice unexplained. **Remedy:** state that `changePassword` also clears a pending request, and
record the clearing actor.

### L3 — Repeat requests re-notify with no notice-level dedupe

**Evidence:** spec §3.5/§3.5.1 (*"the notification is sent at *request* time"*; jobId dedupe is
*"for dedupe on a repeat request"*) · `QueueManager.ts:62-83` (only the *job* is deduped) ·
`NotificationDelivery.ts:70` (the unique key is `(source.type, source.id, source.kind, accountId)` —
a distinct deletion-notice source id per request would produce a distinct row).

The spec anticipates repeat requests (that is why it names a dedupe key) but does not dedupe the
*notice*. Anyone holding the password can therefore generate an unbounded stream of "your account is
being deleted" pushes and a banner that never clears — a low-grade DoS / alarm-fatigue attack on the
account owner, and a nuisance that also trains them to ignore the real signal. **Remedy:** notify
only on the transition from *no pending request* to *pending request*, and reuse one delivery row
per account for the duration of the window.

### L4 — The paused-institution branch is not collapsed by `lookupInstitutionByCode`

**Evidence:** spec Story 3 AC5 (*"The pre-credential branches are collapsed to one generic failure
so the page also reveals nothing about an institution's paused/disabled state."*) ·
`backend/src/modules/juvi-app/config/institution-config.ts:74-81` (`lookupInstitutionByCode` returns
null only for `!doc` or `collegeStatus !== 'active' || !view.enabled` — a **paused** institution
still returns a full view) · `auth-service.ts:44-49` (`signIn`'s three distinct pre-credential
branches, incl. `503 INSTITUTION_PAUSED`).

AC2 names `lookupInstitutionByCode` as the first step, and that function does **not** implement the
collapse AC5 requires: an implementer who follows AC2 and then mirrors `signIn`'s branch structure
will still emit `INSTITUTION_PAUSED` for a paused college — the residual oracle round 1 recorded as
L1. Value is limited (institution codes are enumerable through the public
`lookupInstitution`, `document.ts:143`), hence LOW. **Remedy:** say why `lookupInstitutionByCode`
alone is not enough and require an explicit single generic failure for every pre-credential branch,
paused included.

### L5 — AC2 defines `verifyCredentials` as "read-only" only by its session/token effects

**Evidence:** spec Story 3 AC2 (*"a read-only `verifyCredentials(collegeId, identifier, password):
Promise<{ user, account }>` that creates no session and returns no tokens"*) · AC6 ·
`auth-service.ts:32-35` and `:41` and `:56` (the cooldown **read** and **write** live inside
`signIn`, at both the pre-credential and post-credential failure points, either of which an
"extraction from `signIn`" would carry along).

AC6 forbids reusing the sign-in cooldown and this is sufficient (see H1), but AC2's definition of
"read-only" is narrow: an extraction that returns early on `cooldown.blocked`, or that calls
`recordFailure` on a wrong password, is *still* read-only in the "no session, no tokens" sense while
being a write to the sign-in cooldown key — i.e. H1 returning intact, and passing a test written to
AC2 alone. **Remedy:** extend AC2's sentence: `verifyCredentials` must perform **no Redis write and
no read of `juvi:login-fail:*`** (no `getCooldown`/`recordFailure`/`clearFailures`), and the plan
should show the exact extraction boundary in `auth-service.ts`.

---

## Verified clean (so the absence of findings is meaningful)

- **Self-scoping of the in-app path (Story 2 AC1) — holds.** `req.mobile` is built only from verified
  JWT claims (`authenticate-mobile.ts:35-42, 62-73`); no `/me/*` controller reads an id from the body
  (`me-controller.ts` pattern), and the cross-tenant check is explicit:
  `String(account.collegeId) !== claims.cid` → 401 (`:42`). A sibling account in another college
  cannot be reached through `DELETE /me/account`.
- **The public path cannot be pointed at another college's or person's account.** The chain AC2 names
  is college-scoped end to end: `lookupInstitutionByCode` resolves a code to a `collegeId`
  (`institution-config.ts:74-81`), `resolveIdentifierToUser(collegeId, identifier)` filters every
  lookup by `collegeId` (`identifier-resolver.ts:15, 19-26`), and the account is then read by
  `{ collegeId, userId }` (`auth-service.ts:52`). There is no parameter an unauthenticated caller can
  supply that redirects the deletion outside the college the code names.
- **The public verification path as specified does not mint a session or return tokens — the claim is
  accurate.** `signIn` reaches `createSession` only after `clearFailures` + the deactivation check
  (`auth-service.ts:64-69`), and `createSession` mints the token pair and writes the
  `juvi:sess:<sid>` cache (`session-service.ts:63-86`). AC2 forbids calling `signIn`, names the
  `DeviceInfo` payload it requires that a web page cannot supply, and requires the read-only
  extraction; `verifyCredentials` does not exist in the tree yet, so the AC is the only thing that
  will decide the shape — and it is stated correctly. The same is true of round-1 M2's
  `credential-store` correction: `credential-store.ts` is the AES vault (`storeCredential`/
  `revealLatestForAccount`) with no comparison function, exactly as the spec now says.
- **Identifier enumeration at the credential layer — clean.** `DUMMY_HASH` keeps the bcrypt work
  constant for unknown identifiers (`auth-service.ts:14-16, 53`) and `!user || !account || !ok`
  collapses to a single generic 401 (`:55-59`). Applying the same shape on the public path (AC5)
  preserves this: the deletion *request* is only recorded when the credential verified, and the
  response is AC4-identical. The one residual oracle is institution-level (L4).
- **The public endpoint's route placement is specified correctly and the trap is real.**
  `spacesRouter` applies `authenticateMobile` router-wide (`spaces/routes.ts:8`) and `v1Router`
  mounts it last (`juvi-app/routes.ts:25`); AC7 requires the new route before it, with the same
  ordering comment the receipts path carries (`:20-21`), and forbids touching `spacesRouter`. The
  session-less precedent also exists (`postNotificationReceipts`, `document.ts:178`, `auth: false`),
  as does the public institution lookup (`document.ts:143`).
- **The mobile error envelope claim holds.** A route inside `/api/juvi-app/v1` is serialized by
  `mobileErrorHandler` (`errors.ts:39-58`, `{ error: { code, message } }`), not the ERP
  `errorHandler`; the limiter's 429 body is already mobile-shaped (`rate-limits.ts:14-16`).
- **CSRF on the in-app path is not applicable.** `DELETE /api/juvi-app/v1/me/account` authenticates by
  `Authorization: Bearer`; there is no cookie session anywhere in the juvi-app stack, so a cross-site
  request carries no authority. AC8's treatment of the *public* form (a body-borne credential, i.e.
  no ambient authority) is therefore proportionate, and its `Sec-Fetch-Site` requirement is the right
  control for the one thing CORS does not do (prevent processing).
- **The write-through session revoke is required and the spec now says so for the right reason.**
  `getSessionState` returns a cached `'active'` without consulting Mongo (`session-service.ts:188-190`),
  and `deleteMany` cannot write through it, so AC2's `revokeSession(sid, 'account_deleted')` **then**
  delete is load-bearing; `'account_deleted'` correctly extends the closed enum
  (`MobileSession.ts:4-10`). §5's restated invariant ("sessions deleted while the account still
  exists") is the true one.
- **The reset-not-delete decision for `NoticeRecipient` is correct and the recount matches the
  existing pattern** (`recipient-service.ts:30-32`: recount from rows, skip a `publishing` notice) —
  so no denominator moves for the wrong reason and no key has to be chosen.
- **The deletion set is now complete for every Juvi-owned row keyed by `accountId`.** `JuviAccount`,
  `MobileSession`, `ChannelMembership`, `JuviProvisionedCredential`, `NotificationDelivery`
  (`NotificationDelivery.ts:47`, required `accountId`) and `JuviEvent` (`JuviEvent.ts:20`) all carry
  a required `collegeId`, so AC7's per-model two-college test is satisfiable.
- **Story 4 AC4 (`deactivateAccount` not reused ⇒ no standing marker) — the mechanism is real.**
  `provisionPerson` returns early for an existing account (`provisioning-service.ts:101-103`) and
  otherwise creates one with `status: 'onboarding'` and a new credential (`:135-163`); no opt-out
  marker is written, and the reconcile worker only touches channels/memberships and
  `lastReconciledAt` (`spaces/reconcile-service.ts:133`). AC3's "fresh onboarding account with a new
  temporary credential" is achieved by the default `resetPassword = true`
  (`provisioning-service.ts:94`) — worth stating in the spec, because that branch **rotates the
  person's ERP password** (`:123-132`), which is a legitimate but operator-visible side effect.

## Could not verify from this worktree

1. **The nginx topology: whether `/account-deletion.html` and `/api/juvi-app/v1/...` are the same
   origin.** No nginx config is in the repo (`scripts/deploy.sh` only names `$WEB_ROOT`). This
   decides two stated ACs: whether AC8's `Sec-Fetch-Site: same-origin` accepts the legitimate form
   POST, and whether AC1's `try_files $uri $uri/ /index.html` plan-time check is satisfiable. If the
   page is served from a host distinct from the API, the `same-origin` variant of AC8 **breaks the
   public path** and the `Origin` variant depends on `ALLOWED_ORIGINS` containing the page's origin.
2. **Production Redis durability and pm2 mode.** `docker-compose.yml`'s `redis` has no volume, so the
   dev stack loses queue state on recreate; production durability (AOF/RDB/managed) and whether pm2
   runs one or N instances decide M2's real probability and M6's in-memory multiplication.
   `scripts/deploy.sh` resolves a single process by port/cwd, which suggests one, but no
   `ecosystem.config.*` exists to confirm.
3. **Whether the production deployment sets `FIREBASE_SERVICE_ACCOUNT_JSON`.** The code itself warns
   that without it "notifications … reach no phone" (`transport/index.ts:29-34`), and this
   worktree's `.env` is blank. This decides whether M3's second failure mode is live.
4. **`TRUST_PROXY_HOPS` and `ALLOWED_ORIGINS` in any real deployment** (both blank/absent here), which
   decide M6 and the `Origin` variant of AC8.
5. **The Dart/Flutter client side of the wipe (Story 1 AC3/AC4/AC6).** Out of my scope; belongs to the
   client-side review.

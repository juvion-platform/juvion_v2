# GATE 2 — Architecture validator report (round 2)

**Feature:** 011-account-deletion
**Spec:** `.sdd/specs/011-account-deletion/spec.md` (revision 2)
**Discovery:** `.sdd/discovery/011-account-deletion/discovery.md`
**Resolution:** `.sdd/specs/011-account-deletion/gate2-resolution.md`
**Round-1 report:** `.sdd/specs/011-account-deletion/gate2-architecture.md`
**Reviewed at:** worktree `juvi-flutter-shell` (branch `chore/deploy-atomic-portal-publish`)
**Verdict:** **FAIL** — 0 CRITICAL, 2 HIGH, 4 MEDIUM, 3 LOW.

All three round-1 HIGH findings are genuinely resolved: the `NoticeRecipient` reset, the
public-path verification chain, and the static-page decision are each correct against the code
they now cite (§ below). The two new HIGHs are both in the **new** deferred-execution design
(§3.5) that revision 2 introduced: the dedupe `jobId` is one BullMQ rejects outright, and the
deferred trigger is ephemeral while the durable `deletionRequestedAt` field is never made
authoritative — so the spec's stated guarantees ("never trapped", cancellation honoured) do not
follow from the mechanism it specifies.

---

## Part 1 — Round-1 HIGH findings: are they resolved?

### HIGH-1 (round 1) — `NoticeRecipient` audience snapshot destroyed by hard delete → **RESOLVED**

**Spec text that addresses it.** `spec.md:191-222` (§3.1) reclassifies `NoticeRecipient` from
*hard-deleted* to **reset**:

> **Reset, not deleted** — `NoticeRecipient` … `{ $set: { accountId: null, receivedAt: null,
> seenAt: null, dismissedAt: null, remindedAt: null, ack: null } }` … then recount the affected
> notices' cached counter, exactly as activation does (`recipient-service.ts:30-31`)

**Verified against the code.**
- The row is per *person*: `NoticeRecipient.ts:78` `schema.index({ noticeId: 1, personId: 1 }, { unique: true })`, and `accountId` is `default: null` (`:62`) — one row per audience member whether or not they are on Juvi. Reset keyed on `accountId` therefore cannot touch identity. ✓
- The recount query in the spec (`spec.md:206`) is character-for-character the one activation uses: `recipient-service.ts:30` `countDocuments({ collegeId, noticeId, addedLater: false, accountId: { $ne: null } })` and `:31` `Notice.updateOne({ _id, collegeId, status: { $ne: 'publishing' } }, { $set: { 'counts.onJuvi': onJuvi } })`. ✓
- `receivedAt` genuinely is the "on Juvi at" marker: it is set only where an account exists (`recipient-service.ts:24` activation, `:56` `receivedAt: onJuvi ? now : null`, `consumers.ts:36`), so nulling it is consistent with "null on every account-less row". ✓
- The reach board is built live from these rows, so the person correctly moves buckets: `reach-service.ts:83-88` `reachBucket` returns `not_on_juvi` when `ack`, `seenAt` are null and `accountId` is null (it does not read `counts`). ✓
- The dangling-audit half of round 1 is also fixed *by construction*: nothing is deleted, so the `'NoticeAcknowledgement'` `AuditLog` entry (`consumers.ts:112-140`, keyed on `changes.newValue.recipientId`, line 118) now references a row that still exists. ✓

**Not reset** (`archived`, `deadline`, `ackRequired`, `kind`, `labels`, `addedLater`) matches the
model: those are notice-level attributes (`recipient-service.ts:55-56` seeds `ackRequired`/`deadline`
from the notice; `consumers.ts:158-162` `mirrorArchive` writes `archived` from the notice). ✓

**Residual (LOW, below):** §3.1's filter is `{ collegeId, accountId }` (singular) while Story 2
AC8 says child rows go by the *collected* account ids.

### HIGH-2 (round 1) — public verification misstated its reuse → **RESOLVED**

**Spec text that addresses it.** `spec.md:113-120` (Story 3 AC2):

> The dependency chain is exactly: `config/institution-config.lookupInstitutionByCode` (code →
> `collegeId` …) → `identifier-resolver.resolveIdentifierToUser` → `bcrypt.compare(password,
> user?.password ?? DUMMY_HASH)` against `User.password`. **`credential-store.ts` is not
> involved** … **`auth-service.signIn` is not called** — it creates a `MobileSession` and returns
> tokens, and requires a `device` payload a web page cannot supply.

and `spec.md:362-365` (§6) names the same chain.

**Verified against the code.**
- `signIn` really does mint a session and return tokens: `auth-service.ts:65-69` `createSession(...)` then `return { ...tokens, account: accountSummary(...) }`, and it needs `collegeId` (24-hex) + a full `device` (`schemas.ts:14-19`). Reusing it on a public page would be a token-minting surface. ✓ The spec's negative is right.
- `credential-store.ts` is the temp-password vault (it only encrypts/decrypts `JuviProvisionedCredential`); it has no verify function. ✓
- The real verification chain the spec now names exists and is exactly that: `identifier-resolver.ts:10` `resolveIdentifierToUser(collegeId, identifier)`, `auth-service.ts:53` `bcrypt.compare(input.password, user?.password ?? DUMMY_HASH)`, `DUMMY_HASH` at `:15` for timing. ✓
- The `code → collegeId` step exists and is necessary: `institution-config.ts:73` `lookupInstitutionByCode(code)` resolves a College by `code` and returns null for inactive/disabled — a code is not an ObjectId, so the spec's added step is correct. ✓
- The spec's §3.2 correction of the `GET /institutions/:code` mount is also right: `config/routes.ts:7` `configRouter.get('/institutions/:code', ...)` is mounted via `v1Router` (`routes.ts:18`) under `/api/juvi-app` — i.e. `…/v1/institutions/{code}`, not top-level. ✓

### HIGH-3 (round 1) — §3.2's backend HTML page rejected the static option on a mischaracterization → **RESOLVED**

**Spec text that addresses it.** `spec.md:231-249` (§3.2):

> **The page is a static asset:** `admin-portal/public/account-deletion.html`, copied by vite into
> `admin-portal/dist/` and published by `scripts/deploy.sh` to `$WEB_ROOT/current`, so nginx serves
> it at `/account-deletion.html`. … The static asset has **no** new attack surface …

**Verified against the code.**
- `admin-portal/public/` exists and holds exactly one file, `favicon.svg` — matching `spec.md:108-110`'s plan-time note that this is the first page there. ✓
- `admin-portal/vite.config.ts` does not override `publicDir`, so vite's default copies `public/*` into `dist/` verbatim. ✓
- `scripts/deploy.sh:171-184` builds `admin-portal/dist`, `rsync -a dist/ $WEB_ROOT/releases/<ts>/` and flips `current`. So a `public/account-deletion.html` ships to the nginx web root. ✓
- The rejected backend alternative is, as stated, hostile: the API is JSON-only (no view engine / `sendFile`) under a global `helmet()`. ✓

The mischaracterization is gone and the recommendation now matches the deployment reality.

---

## Part 2 — Findings introduced by revision 2

### HIGH-1 (r2) — The deferred job's `jobId` contains a colon, which BullMQ rejects at `add()`

**Spec text.** `spec.md:291` (§3.5):

> with `jobId: 'juvi-account-deletion:<accountId>'` for dedupe on a repeat request … BullMQ's
> `jobId` path is already covered by `QueueManager.jobid.test.ts`.

**Evidence.**
- The path is real and reachable: `QueueManager.addJob` forwards the option — `QueueManager.ts:71` (`jobId?: string`) and `:79` (`jobId: opts?.jobId`) — into `queue.add` (`QueueManager.ts:74`).
- The installed BullMQ (`node_modules/bullmq` **5.81.5**) rejects it. `Queue.add` (`dist/cjs/classes/queue.js:158`) → `Job.create` (`dist/cjs/classes/job.js:143-152`) → `job.addJob` → `this.validateOptions(jobData)` (`job.js:1032`), which contains:
  ```js
  // job.js:1073-1076
  if (this.opts?.jobId.includes(':') && this.opts?.jobId.split(':').length !== 3) {
      throw new Error('Custom Id cannot contain :');
  }
  ```
  The spec's id `juvi-account-deletion:<accountId>` has **exactly one** colon → `split(':').length === 2` → the guard throws. (Only the legacy exactly-two-colon `repeat:key:…` shape is tolerated.)
- The repo already knows this and documents it as a convention: `modules/admissions/lead-scoring/enqueue.ts:32-35` — *"BullMQ rejects `:` in custom jobIds (same restriction as queue names). Use `_` separator"* — and asserts it in `enqueue.test.ts:42-45` (`expect(id).not.toMatch(/:/)`).
- The citation the spec leans on does not cover what the spec claims: `QueueManager.jobid.test.ts:16-21` **mocks `bullmq` entirely**, so it only proves the option is *forwarded* (its own sample id, `:34`, contains colons and would itself throw against real BullMQ). It proves nothing about a jobId being accepted.

**Why it is a defect.** The dedupe-on-repeat is the stated mechanism that stops a second public
request enqueueing a second job against the same account. As written it throws at `add()`, so the
*first* public request fails to schedule anything — the deferred deletion never gets a trigger at
all (and, depending on where the `addJob` call sits relative to the response, the endpoint can also
500 on a valid identifier while returning the generic body on an invalid one, which Story 3 AC4/AC5
forbid). The spec asserts the jobId path is covered by an existing test; it is not.

**Remedy.** Use the repo's separator: `jobId: 'juvi-account-deletion_<accountId>'` (underscore),
matching `scoringJobId` (`enqueue.ts:35`). Cite `enqueue.ts:32-35` / `enqueue.test.ts:42-45`, not
`QueueManager.jobid.test.ts`, as the precedent.

---

### HIGH-2 (r2) — The deferred deletion's trigger is ephemeral and the durable field is never authoritative: the deletion can silently never run, and cancellation can be bypassed

**Spec text.**
- `spec.md:285-288` (§3.5): *"a **delayed job** executes the same deletion service after `DELETION_GRACE_DAYS = 7`, or the deletion completes automatically at the deadline whether or not anyone responded — the requester is never trapped by not having the app."*
- `spec.md:292` (§3.5): *"Cancellation removes the job and clears the two fields."*
- `spec.md:155-160` (Story 4 AC1): cancellation via Settings, the in-app banner, *"and — as a safety net — any successful sign-in clears the request"*.

**Evidence.**
- The cited precedent is architecturally the **opposite** of a delayed job. `shared/jobs/proposal-expiry-worker.ts` is a *recurring DB sweep*: `:126-130` registers `queue.add('sweep', {}, { repeat: { pattern: '*/15 * * * *' } })`, and the processor re-queries the durable rows each tick — `:35-38` `HostelAllocation.find({ status: 'proposed', expiresAt: { $lte: now } })` with a claim-guard `findOneAndUpdate` (`:42-46`). The durable record (`expiresAt`) is the source of truth and the sweep is self-healing. The spec's design inverts this: `deletionRequestedAt` is written (`spec.md:283`) but **never scanned**, and the only trigger is one BullMQ delayed job.
- Registration is optional and failures are swallowed: `server.ts:20` runs the workers only `if (process.env.DISABLE_BACKGROUND_JOBS !== 'true')`, and each `register*` is wrapped in a `try/catch` that merely `console.warn`s (`server.ts:21-45`). `getQueue` throws when a queue is unregistered (`QueueManager.ts:55-58`), so `addJob` throws and no job exists.
- The delayed job is stored only in Redis (`QueueManager.ts:30` `new Queue(name, { connection })`; no persistence config in-repo). Nothing in the design re-derives a missing job from `deletionRequestedAt`.
- Cancellation is expressed two ways that can disagree: §3.5 makes **job removal** the mechanism (`:292`), while Story 4 AC1's sign-in safety net says only that it "clears the request". The spec never requires the job processor to re-read `deletionRequestedAt` before executing, so if a successful sign-in clears the fields but the job is not removed (or is already promoted/waiting, or the removal errors), the deletion still fires — destroying the account of a user who cancelled. Conversely, a cancelled-through-Settings user whose job was removed but whose fields were not cleared (or a Redis flush that drops the job while the fields persist) leaves a request that never completes.

**Why it is a defect.** The spec states two guarantees — the deletion "completes automatically at
the deadline … the requester is never trapped", and cancellation stops it — that the specified
mechanism does not provide, because the durable marker (`deletionRequestedAt`) is inert state and
the trigger/executor are decoupled with no re-check. This is the one place the feature's scope grew,
and the growth is precisely what makes it load-bearing. It also mis-sizes its own precedent: the
`proposal-expiry-worker` pattern exists in this repo *because* sweep-from-durable-record is the
robust shape, and the spec adopted the weaker one while citing it.

**Remedy.** Make the durable field authoritative:
1. the delayed job's processor re-reads `JuviAccount.deletionRequestedAt` (scoped by
   `{collegeId, _id} `) and no-ops when it is cleared/older than the deadline — this makes
   *cancellation-by-field-clear* sufficient regardless of job-removal races; and
2. add a periodic sweep over `{ collegeId, deletionRequestedAt: { $lte: cutoff }, status: { $ne: 'deleted' } }` (literally the `proposal-expiry` shape) as the durable backstop, so a lost job cannot silently strand a request.
If the sweep is genuinely out of scope, the spec must drop the "never trapped" claim and state the
Redis-persistence assumption it depends on.

---

### MEDIUM-1 (r2) — The deferred worker is pointed at `shared/jobs/`, inverting the Juvi module's own worker convention

**Evidence.** `spec.md:289-292` and `spec.md:371-372` (§6) tell the implementer to follow
`shared/jobs/proposal-expiry-worker.ts` and register in `server.ts`. But that file is a *campus-ops*
concern that merely lives in `shared/` (it imports `../../modules/campus-ops/allocation-lifecycle`,
`:17`). The Juvi module's own, closer convention is module-local workers:
`modules/juvi-app/accounts/provisioning-worker.ts` (`registerJuviProvisioningQueue`, imported
`server.ts:9`, called `:32`) and `modules/juvi-app/spaces/reconcile-worker.ts` (`server.ts:10`, `:37`).
A Juvi account concern executed by `shared/jobs/` puts `shared → modules/juvi-app` layering where the
module already has a home.

**Why it is a defect.** It is a convention/boundary mismatch, not a correctness bug: the new code
lands in the wrong layer for the feature that owns it, against the pattern the two existing Juvi
workers set.

**Remedy.** Put the deletion worker in `modules/juvi-app/accounts/` (e.g.
`deletion-worker.ts` exporting `registerJuviDeletionQueue()`), registered in `server.ts` alongside
the other Juvi queues; keep `shared/queue/QueueManager.ts` as the only shared dependency.

### MEDIUM-2 (r2) — Surfacing `deletionRequestedAt` on `GET /me` changes a response schema the spec never costs

**Evidence.** `spec.md:158-160` (Story 4 AC1) and `spec.md:301-308` (§3.5.1) surface
`deletionRequestedAt` on `GET /me` and in Settings. `getMe` returns the zod-typed `MeResponse`
(`me-service.ts:50`, `:95-106`) defined at `schemas.ts:67-86`, and that schema is the OpenAPI `Me`
component (`document.ts` `registry.register('Me', meResponseSchema)`). The mobile app reads `/me`
over **raw Dio**, not the generated client, precisely because the generated `wire.Me` cannot
deserialize the nullable-object fields: `me_repository.dart:46-57` (*"The generated `wire.Me`
declares `student`/`faculty` … raw body with our own (correctly nullable) `Me` model avoids that
crash"*) and `mobile/README.md:53`. §3.6 addresses only the `DELETE` endpoint.

**Why it is a defect.** The spec adds a field to a response on the one endpoint that already forces
the raw-Dio workaround, without stating the three edits it implies: the `meResponseSchema` change,
the matching OpenAPI `Me` schema (contract coherence), and the mobile-side parse in the app's own
`Me` model (not the generated one). Silent omission of a contract change on a generated endpoint is
exactly the pattern §3.6 was tightened to prevent.

**Remedy.** Add to §3.6: `deletionRequestedAt`/`deletionRequestedVia` on `MeResponse` — change
`meResponseSchema`, the OpenAPI `Me` component, and the mobile `Me` model/`me_repository` parse
(raw Dio), noting it is additive so no generator change is required.

### MEDIUM-3 (r2) — "A dedicated notification kind delivered like any other" is not free: the push payload is notice-shaped and the source `type` enum is closed

**Evidence.** `spec.md:303-305` (§3.5.1): *"a dedicated notification kind delivered like any other,
over `NotificationDelivery`/`sender.ts`"*. In reality the sender is notice/class-change specific:
`NotificationDelivery.ts:16` fixes `INotificationSource.type` to `'notice' | 'class_change'`, and
`NotificationDelivery.ts:8` / `:13` close `NOTIFICATION_SOURCE_KINDS`. `sender.ts:97` branches
(`if (primary.source.type === 'class_change') return sendClassChangeGroup(...)`), and the notice
payload builder is notice-shaped — `sender.ts:136-137` emits `noticeId`, `office: notice.publisher.office`,
`title: notice.title`, `variant`. The existing request helper is likewise notice-scoped:
`requestNoticeNotification(collegeId, noticeId, …)` (`recipient-service.ts:12`, `:75`).

**Why it is a defect.** Reusing the transport is fine, but "delivered like any other" understates a
schema-visible change (a new `source.type` value + payload builder + a non-notice fan-out path). The
spec flags the other enum change it needs (`REVOKE_REASONS`, `spec.md:356-357`) but not this one, so
the notification work is uncosted.

**Remedy.** Name the new `source.type` (e.g. `'account'`) in §3.5.1, state that
`NOTIFICATION_SOURCE_KINDS`/`INotificationSource.type` are extended (as §5 does for `REVOKE_REASONS`),
and note the sender needs a non-notice payload branch. Alternatively, drop the push and rely on the
two fallbacks.

### MEDIUM-4 (r2) — The owner-notification and cancellation ACs are unreachable for the very population the public path exists to serve

**Evidence.** Story 3's premise is a user who *uninstalled the app* (`spec.md:100-110`). Push
delivery requires a live session carrying a token: `sender.ts:120-124` finds
`MobileSession.find({ …, revokedAt: null, refreshExpiresAt: { $gt: now }, pushToken: { $type: … } })`
and, when there are none, `settle(live, { status: 'suppressed', reason: 'no_device' })`
(`:124`). Cancellation requires the app: Settings, the in-app banner (`spec.md:158-160`), or a
successful sign-in — all app-side.

**Why it is a defect.** §3.5.1 presents the push as the primary owner notification with
banner/audit as *fallbacks*; for a user with no installed app the push is suppressed as `no_device`,
the banner is unreachable, and the audit entry is admin-visible, not owner-visible. The AC is
achievable only for the credential-stuffing case (owner still has the app), which is the case that
matters — but the spec should say so rather than claim a general guarantee.

**Remedy.** State in §3.5.1 that the push reaches owners with a live session/device and that the
grace period's protection for a fully-absent owner rests on the requester's own later sign-in;
adjust AC2's wording accordingly.

---

### LOW-1 (r2) — §3.1's reset filter is singular while Story 2 AC8 deletes by the collected account ids

`spec.md:194-198` filters `NoticeRecipient.updateMany({ collegeId, accountId }, …)` (one account),
but `spec.md:95-98` (Story 2 AC8) removes the account rows by `{ collegeId, userId }` because
`{collegeId, userId}` is not uniquely indexed (`JuviAccount.ts:96` confirms no `unique`) and child
rows "go by the collected account ids". The reset should match: `{ collegeId, accountId: { $in: accountIds } }`.

### LOW-2 (r2) — Citation drift in the deferred-job references

`spec.md:289-291` cites the registration at `server.ts:17`; it is at `server.ts:22` (import `:6`).
`spec.md:142` cites `spaces/routes.ts:8` for the router-wide `authenticateMobile`; it is
`spaces/routes.ts:6`. Cosmetic, but the round-1 findings were of this exact kind, so they are worth
pinning.

### LOW-3 (r2) — Story 3 AC8's `Sec-Fetch-Site: same-origin` presumes a same-origin deployment

`spec.md:146-148` requires `Sec-Fetch-Site: same-origin` *or* an `Origin`/`Referer` allowlist check.
The static page is served from the portal web root (`scripts/deploy.sh:178-184`) while the endpoint
is under `/api`; the two share an origin only if the production nginx proxies `/api` on the same
host (unverifiable here — the nginx config is not in the repo, and vite's `/api` proxy is dev-only).
Where they do not, the strict `same-origin` form rejects every legitimate submission. Make the
`Origin` allowlist check the primary form and treat `Sec-Fetch-Site` as a hardening addition.

---

## Checked and found clean

**Module boundary (`modules/juvi-app/accounts/`).** Unchanged from round 1 and still correct: the
mobile stack is a deliberate exception to the `CLAUDE.md` ERP conventions — no `controller.ts`/
`service.ts`/`validation.ts`/`index.ts`, services take a `MobileContext` (`me-service.ts:50`), errors
are `MobileApiError(statusCode, code, message)` (`errors.ts:19-20`). §5, Story 2 AC1 and the `accountsRouter`
placement (`accounts/routes.ts:20` `DELETE /me/devices/:id`) all respect it.

**Deletion set completeness.** A sweep of every model carrying `ref: 'JuviAccount'` returns exactly
six: `ChannelMembership.ts:20`, `JuviEvent.ts:20`, `JuviProvisionedCredential.ts:25`,
`MobileSession.ts:35`, `NoticeRecipient.ts:62`, `NotificationDelivery.ts:47`. §3.1 covers all six
(five hard-deleted, `NoticeRecipient` reset). `AckRecord` is out and correctly so — it is keyed to the
retained `Student` (`AckRecord.ts:7` `studentId`), not to an account. The DL-H1/DL-H2 additions are
therefore the complete set, not a partial patch.

**`NotificationDelivery` and `JuviEvent` are genuinely per-user (the task's question).** Both carry a
`required` `accountId` referencing `JuviAccount` (`NotificationDelivery.ts:47`, `JuviEvent.ts:20`).
`JuviEvent` is not college telemetry in the sense that would make deletion wrong: it is a
per-account event stream with its own 400-day TTL (`JuviEvent.ts:3`, `:29`) and no in-repo reader at
all (every `JuviEvent` reference is a write — `events-service.ts:8,51` — or a test/model export).
Deleting it breaks no aggregate in this codebase and matches the app's "local analytics are wiped"
disclosure. One disclosure caveat: the index `{ collegeId, name, at }` (`JuviEvent.ts:30`) shows the
stream is queried college-wide out-of-band, so §3.4's policy copy should be precise that per-user
analytics rows are removed, not that no analytics remain.

**`deactivateAccount()` must not be reused — the call is right and the replacement is distinct.**
`provisioning-service.ts:206-214` sets `User.isActive = false` (`:210`) — which would break the
shared ERP login — and only soft-revokes (`:211` `revokeOtherSessions(..., 'deactivated')` →
`session-service.ts:148-153`, which sets `revokedAt`/`$unset`s `pushToken` and does not delete rows).
The spec's replacement (hard-delete rows, never touch `User`, Story 2 AC3 asserts `isActive: true` on
both paths) is genuinely distinct, so §3.3's prohibition is correct.

**Story 2 AC2 (write-through revoke, closed enum, cache keys).** `revokeSession` writes through:
`session-service.ts:148-153` sets `revokedAt`, `$unset`s `pushToken` (line 150) and `cacheState(sessionId,
'revoked:…')` (line 152) over the same `juvi:sess:<sid>` key that `getSessionState` reads (`:188-190`).
A deleted row yields `{ state: 'missing' }` → 401 (`:193-194`). `REVOKE_REASONS` is a closed enum
(`MobileSession.ts:8-10`) so `'account_deleted'` is a real schema change. `juvi:acct-touch:<accountId>`
exists exactly as claimed (`authenticate-mobile.ts:86`).

**Story 2 AC5/AC6/AC7/AC8.** `authenticateMobile` resolves the account by id, so a removed account
makes the token unresolvable → 401; the second call short-circuits in middleware, never 500. The
010 scope-plugin's hook list (`scope-plugin.ts:73`) contains `findOne`/`findOneAndUpdate`/
`findOneAndDelete`/`findOneAndReplace`/`updateOne`/`deleteOne`/`replaceOne` — **no** `deleteMany`/
`updateMany`, exactly as AC7 states. `JuviAccount.ts:96` is `schema.index({ collegeId: 1, userId: 1 })`
with no `unique`, exactly as AC8 states.

**Story 4 (re-provisioning is reachable).** Unchanged from round 1 and still verified:
`provisionPerson` (`provisioning-service.ts:93`) finds no existing account and creates
`status: 'onboarding'` (`:135`); the reconciler only `$set`s `lastReconciledAt`. No standing marker.

**Story 1 AC3's wipe primitives.** Every claim checks out: `_wipe()`
(`session_controller.dart:159-171`) = `SecureStore.wipeAll()` + `AppDatabase.wipe()`; `wipeAll()`
(`secure_store.dart:105-109`) deletes only `_access`/`_refresh`/`_college`; `AppDatabase.wipe()`
(`app_database.dart:243-247`) clears `kvCache`/`pendingActions`/`analyticsEvents` (so the cached
`me` doc goes, as AC3 says); `ReceiptQueue` (`receipts.dart:33-69`) exposes only `read`/`add`/`remove`
— **no** `clear()`, as AC3 states; `clearPendingLink()` exists (`secure_store.dart:96`); and
`_lastAccount = 'juvi.last_account'` (`secure_store.dart:22`, storing `<collegeId>:<accountId>` per
`:98-101`). AC3's list is now accurate and AC4's "do not call `signOut()`/`unregister()`" is the
right guard.

**§3.6 / Story 3 AC7 mount ordering.** The OpenAPI document supports a bodyless 204 delete —
`document.ts:147` `signOut`, `:154` `revokeDevice`, `:176` `clearPushToken` — so the `deleteAccount`
entry is well-formed and R61 genuinely does not apply. The ordering requirement is real:
`v1Router.use(spacesRouter)` (`routes.ts:25`) applies `spacesRouter` to every path, and
`spacesRouter.use(authenticateMobile)` (`spaces/routes.ts:6`) runs router-wide — so any public route
must be mounted before it, with the comment shape at `routes.ts:20-21`.

**Deferred-job mechanics other than the colon (delay).** `addJob` forwards `delay` (`QueueManager.ts:75`)
to `queue.add`; BullMQ stores delayed jobs in a timestamp ZSET, so a 7-day `delay` is representable.
The retention options `removeOnComplete`/`removeOnFail` (`QueueManager.ts:80-81`) are applied to the
added job and do not truncate a *delayed* (not-yet-run) job. So the long delay itself is fine — the
defect is the `jobId` and the absence of a durable backstop, not the delay.

---

## Could not verify

- **The production nginx config is not in this repo.** The static-page claim rests on
  `scripts/deploy.sh:171-184` (rsync `admin-portal/dist` → `$WEB_ROOT/current`) plus vite's documented
  `public/` → `dist/` copy. The exact `try_files`/SPA-fallback rule was not available, so it could not
  be confirmed that `account-deletion.html` always wins over the SPA fallback (it does for any config
  that serves an existing file first). This also leaves LOW-3's same-origin question open.
- **No live Redis/HTTP run.** The BullMQ colon rejection is established from the installed
  package's source (`node_modules/bullmq/dist/cjs/classes/job.js:1073-1076`, v5.81.5) reached via
  `Queue.add` → `Job.create` → `validateOptions`, not by executing an `add()` against a real queue.
  All other backend claims are source reads.
- **The Play Console policy wording** (the reason the feature exists) was taken from the spec and
  discovery; it was not independently fetched.

---

## Severity counts

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 4 |
| LOW | 3 |

**GATE 2 criterion (0 CRITICAL + 0 HIGH) is NOT met.**

**Round-1 HIGH status:** HIGH-1 (NoticeRecipient reset) **resolved**; HIGH-2 (public verification
reuse) **resolved**; HIGH-3 (static page vs backend HTML) **resolved**.

**New HIGH titles:** (1) the deferred job's `jobId` contains a colon and BullMQ rejects it at
`add()`; (2) the deferred trigger is ephemeral while `deletionRequestedAt` is never authoritative —
the deletion can silently never run and cancellation can be bypassed.

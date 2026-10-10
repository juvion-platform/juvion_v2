# GATE 2 — Architecture validator report (round 4)

**Feature:** 011-account-deletion
**Spec:** `.sdd/specs/011-account-deletion/spec.md` (**revision 4** — content; the file header still
says "revision 3", see AR4-L5)
**Discovery:** `.sdd/discovery/011-account-deletion/discovery.md`
**Resolution:** `.sdd/specs/011-account-deletion/gate2-resolution.md` (Part C)
**Prior reports:** `gate2-architecture.md` (r1), `gate2-r2-architecture.md` (r2),
`gate2-r3-architecture.md` (r3)
**Reviewed at:** worktree `juvi-flutter-shell` (branch `chore/deploy-atomic-portal-publish`)
**Verdict:** **PASS** — 0 CRITICAL, 0 HIGH, 1 MEDIUM, 5 LOW.

**AR3-H1 is genuinely resolved.** §3.5.1's trigger query no longer carries any `status` clause
(`spec.md:388-392`); `deletionRequestedAt` is the sole predicate, exactly as §3.5.1 claims. Every
consequence of the r3 defect is gone, and I found no new hazard created by removing the predicate
(detail below). This was the only HIGH standing between revision 3 and GATE 2.

I re-read every delta item against live source. Six of the seven verify clean; the seventh (the
`GET /admin/accounts/pending-deletion` contract entry, delta 4) has a defect that is new in
revision 4 and is recorded as AR4-M1 — it is a contract-placement error, not the fail-open class
round 3 failed on, and it does not gate.

---

## Delta verification (the seven items I was asked to check)

| # | Delta | Result |
|---|---|---|
| 1 | §3.5.1 predicate-free query; no new hazard | **Clean** — verified below |
| 2 | §3.5.1 atomic claim; crash-retry; `deletionClaimedAt` | **Clean** (one LOW, AR4-L2, on clearing) |
| 3 | §3.5.1 sparse index | **Clean** — the right index for the query shape |
| 4 | Story 4 AC5 + §3.6 admin pending-deletion endpoint | **AR4-M1** — route/auth/envelope correct; contract entry has no valid home |
| 5 | Story 4 AC1 + §3.6 cancel endpoint | **Clean** — fits `accounts/routes.ts` and the mobile document |
| 6 | Story 2 AC7 + §5 sweep carve-out; deletion service takes per-row `collegeId` | **Clean** (one LOW, AR4-L1, on the new admin surface's wording) |
| 7 | §6 placement, `server.ts:20` gating, hourly repeat | **Clean** (one LOW, AR4-L3, on recurrence shape) |

---

## What I checked and found clean

### 1. §3.5.1's query now has no `status` clause — the field is the sole predicate, and there is no new hazard

The query is `JuviAccount.find({ deletionRequestedAt: { $lte: … } })` (`spec.md:388-392`) with no
`status` predicate. `ELIGIBLE_STATUSES = ['onboarding', 'active']` still exists
(`JuviAccount.ts:11-12`) but is no longer imported into the trigger — the r3 defect is removed at
its root, not worked around.

**No new hazard from removing the predicate.** I checked what the executor touches against every
account state the sweep can now reach (`exiting`, `deactivated`, `alumni`):

- The request is reachable on a non-eligible-but-verifiable account: `signIn` refuses only
  `deactivated` (`auth-service.ts:60-62` — `account.status === 'deactivated' || !user.isActive`), so
  `exiting`/`onboarding` accounts pass verification; and `deactivateAccount` fires mid-window from
  `workflow.handlers.ts:2009` (`W01 cancel_m12`) and `admin/accounts-controller.ts:13`. Both were the
  r3 reachability path, and both are now swept.
- Every deletion write is **status-independent**: hard-delete by `deleteMany({ collegeId, accountId })`
  (§3.1 table) carries no status filter; the `NoticeRecipient` reset narrows by `_id`
  (`spec.md:270-276`); the recount targets `Notice`, not the account (`spec.md:282-285`, verbatim
  `recipient-service.ts:30-31`); the audit write is keyed by `collegeId`/`entityId` only
  (`spec.md:86-90`). None inspects account state.
- The deletion never touches `User` (§3.3; §5:456-464), so the `isActive: true` invariant Story 2
  AC3 requires on the in-app/public paths is simply not in play on the sweep path — a `deactivated`
  account's `User` is already inactive by design, and the deletion correctly leaves it alone.
- `deactivateAccount`'s own footprint (`provisioning-service.ts:206-214`) is idempotently re-covered:
  it deleted `ChannelMembership` and soft-revoked sessions; the sweep's `deleteMany` finds no
  memberships and its revoke pass skips already-revoked rows (`session-service.ts:150` guards on
  `revokedAt: null`). The untouched rows it left behind — `NotificationDelivery`, `JuviEvent`,
  `JuviProvisionedCredential`, and the `NoticeRecipient` Juvi state — are exactly the four r3-H1
  named as surviving, and they are all in §3.1's set.

Ruling 8's warning ("the executor must not assume the account is active anywhere it writes") is
therefore not merely asserted — it is satisfiable, because no step needs the account to be active.

### 2. §3.5.1's atomic claim does close the cancellation race, and "crash ⇒ retry" is true

The claim (`spec.md:401-406`) is
`findOneAndUpdate({ _id, deletionRequestedAt: { $lte: deadline, $ne: null } }, { $set: { deletionClaimedAt } }, { new: true })`
with `if (!claimed) continue`. It is the precedent's exact shape — the precondition sits **inside**
the write, as in `proposal-expiry-worker.ts:42-46` (and the transport twin at `:78-82`), which is
what r3 said revision 3 lacked.

- **The race is closed, not narrowed.** Cancellation is `$unset deletionRequestedAt` (Story 4 AC1).
  A cancellation before the claim leaves the field absent, `$lte` fails, `claimed` is null, `continue`
  — the deletion is skipped. A cancellation after a successful claim loses because the executor
  proceeds. The two are serialized on the same document, so there is no interleaving in which a clear
  is unobserved. `$ne: null` is redundant with `$lte: <Date>` (type-bracketed) but harmless.
- **"The claim is not a lock, so a crash retries" is literally true.** The claim `$set`s
  `deletionClaimedAt` and does *not* remove or clear `deletionRequestedAt`. The next tick's scan
  (`{ deletionRequestedAt: { $lte: deadline } }`) still matches the row, and the claim's own filter
  matches it too, so the row is re-claimed and the deletion re-runs. The durable field really is
  authoritative, which is the property round 2 graded HIGH when it was absent.
- `deletionClaimedAt` **is needed** — Story 4 AC5 returns it as the stalled-sweep signal
  (`spec.md:231-236`). Whether it must be *cleared* is AR4-L2.

### 3. The sparse index is the right index for the query shape

`schema.index({ deletionRequestedAt: 1 }, { sparse: true })` (`spec.md:424-428`) covers
`find({ deletionRequestedAt: { $lte: X } })`: sparse indexes the field exactly where it is present,
and the range predicate is a plain ascending scan. `JuviAccount`'s existing indexes are all
`collegeId`-prefixed (`JuviAccount.ts:95-99`), which the unfiltered cross-tenant scan cannot use —
so before this index it is a collection scan, as §3.5.1 states. Nothing sets the field to explicit
`null` (the public path `$set`s a `Date`, cancellation `$unset`s it), so sparse and a
partial-on-`$type: 'date'` index are equivalent here; sparse is fine.

### 4. Story 2 AC7 + §5 carve the sweep out consistently, and the deletion service does take `collegeId` per row

Story 2 AC7 (`spec.md:114-122`) and §5 (`spec.md:546-549`) now name the sweep as *the* sanctioned
cross-tenant exception, and it is not reachable from a route — it is registered at server start with
the other workers (`server.ts:20-46`), and §6 adds no admin "run now" trigger. The sweep's projection
is `.select('_id collegeId userId deletionRequestedAt')` (`spec.md:391`), so the per-row `collegeId`
(and `userId`, which Story 2 AC8's `{collegeId, userId}` removal needs) is in hand before the
deletion service is called. Internally consistent.

The 010 scope plugin's hook list is exactly the seven single-document ops and no
`deleteMany`/`updateMany` (`scope-plugin.ts:73`), so Story 2 AC7's premise — every deletion write
must route through `deleteScoped` — is accurate.

### 5. §6's worker placement and registration gating are correct; the hourly cadence is now named

`server.ts:9-10` imports the two Juvi workers, `:31-40` registers them, and the whole block is gated
on `DISABLE_BACKGROUND_JOBS !== 'true'` at `server.ts:20`. §6 (`spec.md:592-598`) points the sweep at
that same place; `proposal-expiry-worker.ts:126-130` proves `repeat` scheduling exists. §3.5.1 now
names the interval — hourly `repeat: { pattern: '0 * * * *' }` (`spec.md:452-453`) — which resolves
r3-AR3-L5's "interval unspecified". The recurrence *form* is AR4-L3.

### 6. Story 4 AC1's cancel endpoint fits the mobile router and the mobile document

`accountsRouter.delete('/me/account/deletion-request', authenticateMobile, …)` is exactly the shape
of the two existing bodyless deletes on that router (`accounts/routes.ts:20-21`) and of
`revokeDevice`/`clearPushToken` in the generated contract (`document.ts:154`, `:176`). It does not
collide with `DELETE /me/account` or `DELETE /me/devices/:id` (distinct Express paths). §3.6 declares
it as a mobile entry (`spec.md:512-515`), which the document model supports (`status: 204`). Clean.

### 7. The previously-clean items the edits could have disturbed are undisturbed

Re-read from source, and unchanged from r3:

- `proposal-expiry-worker.ts:35-38` re-queries durable rows each tick, `:126-130` schedules with
  `repeat`; the cited precedent is still what §3.5.1 says it is.
- The deletion set is still complete and still exactly six: `ChannelMembership.ts:20`,
  `JuviEvent.ts:20`, `JuviProvisionedCredential.ts:25`, `MobileSession.ts:35`, `NoticeRecipient.ts:62`,
  `NotificationDelivery.ts:47` are the only `ref: 'JuviAccount'`s, and §3.1 covers all six. The only
  other `ref: 'MobileSession'` is `NoticeRecipient.ack.sessionId` (`NoticeRecipient.ts:49`).
- §3.1's reset uses `accountId: { $in: accountIds }` in the capture (`spec.md:266`) — r3's AR3-L1 is
  fixed — and keeps the `_id` narrowing in the update (`spec.md:270-276`), which is what defeats the
  fan-out race. `receivedAt`/`seenAt`/`dismissedAt`/`remindedAt`/`ack`/`accountId` are all real and
  resettable (`NoticeRecipient.ts:62-73`); `accountId` is `default: null` (`:62`); the row is
  `unique {noticeId, personId}` (`:78`).
- `deactivateAccount` still sets `User.isActive = false` and only soft-revokes
  (`provisioning-service.ts:206-214`), and `provisioning-service.ts:124` still carries the "shared
  with the ERP web login" comment — §3.3 holds.
- The audit-guard collision is real: provisioning writes
  `{collegeId, entityType: 'JuviAccount', entityId}` (`provisioning-service.ts:165-174`), so requiring
  `action: 'delete'` in the guard (Story 2 AC4) is necessary and sufficient.
- `'request_deletion'` is genuinely absent from the closed `AuditAction` union (`shared/types.ts:26-55`),
  from its `AUDIT_ACTIONS` mirror (`audit.ts:27-36`), and from the Mongoose enum that `:45` enforces.
  §5 declaring both additions is correct.
- `REVOKE_REASONS`/`RevokeReason` are closed and schema-visible (`MobileSession.ts:4-10`, `:47`), and
  `'account_deleted'` is absent.
- `revokeSession` writes through the cache and `$unset`s `pushToken` (`session-service.ts:148-153`);
  `juvi:acct-touch:<accountId>` is real (`authenticate-mobile.ts:86`).
- `lookupInstitutionByCode` returns null for unknown, inactive and disabled alike
  (`institution-config.ts:73-77`), so Story 3 AC5's collapse holds by construction.
- Story 3 AC7's ordering hazard is real: `v1Router.use(spacesRouter)` at `routes.ts:25`,
  `spacesRouter.use(authenticateMobile)` at `spaces/routes.ts:6`; the receipts-path ordering comment
  is at `routes.ts:20-25`. The `:8`→`:6` drift r3 noted is fixed.
- `limiter(n)` is module-private (`rate-limits.ts:7`); `signInLimiter` **is** exported
  (`rate-limits.ts:21`) — §6 corrected.
- `cooldown.ts` hashes the identifier (`:7-8`) and `getCooldown` reads only `juvi:login-fail:*`
  (`:12-13`), so Story 3 AC6's key-disjointness holds.
- `meResponseSchema` (`schemas.ts:67-86`) is registered as the OpenAPI `Me` component
  (`document.ts:92`) and contains no deletion key; `getMe` returns a typed object literal
  (`me-service.ts:95-106`), so adding `deletionRequestedAt`/`deletionRequestedVia` is compiler-forced.
- §3.5.2's notification-shape claims: `NotificationDelivery.source.type`/`source.kind` are closed
  enums and `source.id` a required ObjectId (`NotificationDelivery.ts:16`, `:62-66`); `tier_off` is
  real (`policy.ts:83`); `no_device` is real (`sender.ts:122-126`); the fake-transport fallback is
  real (`transport/index.ts:19-34`).
- §3.1's photo claim: the uploaded photo is written at the deterministic
  `${prefix}/photo/original.${ext}` key (`photo-service.ts:182`).

---

## Findings

### AR4-M1 (MEDIUM) — §3.6 declares the ERP-admin `pending-deletion` endpoint in the **mobile** OpenAPI document, where it can only generate a wrong path and a dead Dart method

**Evidence.**
- §3.6 (`spec.md:516-520`) lists the entry — `{ operationId: 'listPendingDeletions', method: 'get',
  path: '/admin/accounts/pending-deletion', auth: true, status: 200 }` — among the contract changes,
  and closes with "The Dart client is regenerated for the **mobile entries**" (`spec.md:523-527`),
  conceding this one is not a mobile entry.
- There is exactly **one** OpenAPI generator in the repo:
  `modules/juvi-app/openapi/document.ts` (grep for `OpenApiGeneratorV31` returns only this file). It
  is the mobile contract by construction: `info.title: 'Juvi Mobile API'`, `servers: [{ url:
  '/api/juvi-app/v1' }]` (`document.ts:205-206`), every path registered under a single
  `tags: ['mobile']` so the generator emits one `MobileApi` class (`document.ts:189`), and its route
  list (`document.ts:142-180`) contains **no** admin route.
- The real admin router is mounted at `/api/juvi-app/admin`, **not** under `/v1`:
  `router.use('/v1', v1Router); router.use('/admin', adminRouter)` (`routes.ts:28-29`), with the
  whole juvi-app router mounted at `/api/juvi-app` (`app.ts:86`). So a `path: '/admin/…'` entry in a
  document whose base is `/api/juvi-app/v1` resolves to `/api/juvi-app/v1/admin/accounts/pending-deletion`
  — a URL that does not exist.
- The mobile app can never call this route even at the right URL: the admin router's `authenticate`
  rejects mobile tokens outright (`authenticate.ts:33-35`), and ERP auth at `admin/routes.ts:18`.

**Why it is a defect.** The endpoint's *route, auth and envelope* are correct (see below); the defect
is that §3.6 assigns it a contract home that does not exist. Implemented literally in `document.ts`
it produces a `MobileApi.listPendingDeletions()` Dart method that hits a 404 and can never be
authenticated; omitted from `document.ts` (the only generator) §3.6's assertion that it "is a
contract entry, not an optional nicety" (`spec.md:234-236`) is simply unfilled. This is the same
class r3 graded MEDIUM for AR3-M3 — an AC the spec's declared contract cannot satisfy — in the
inverse direction. It is *not* a fail-open or data-loss defect, so it does not gate.

**Remedy.** Drop the `listPendingDeletions` bullet from §3.6 and state plainly that the ERP admin
surface has no generated-client contract (the admin portal uses hand-written service calls), *or*, if
a machine-readable contract is genuinely wanted, say where it lives and correct both the base and the
path (it is `/api/juvi-app/admin/...`, outside `/v1`, and outside the mobile document's tag/base).
The endpoint itself stays as Story 4 AC5 describes.

**What is correct about the entry, verified separately (delta 4):** the surface fits the real admin
router — `adminRouter.get('/accounts', authorize('platform','read'), …)` at `admin/routes.ts:30` shows
the `/accounts` prefix, and `GET /accounts/pending-deletion` collides with no existing route (there
is no `GET /accounts/:id`). Auth is `authenticate` + `authorize()` (`admin/routes.ts:18`, `:30`), and
the ERP error envelope applies because the admin router carries its own `errorHandler`/`AppError`
404 (`admin/routes.ts:41-42`) and is mounted outside `/v1` (`routes.ts:28-29`). The mobile-vs-ERP
envelope split is stated correctly.

---

### AR4-L1 (LOW) — Story 4 AC5's new admin surface reads cross-tenant, against Story 2 AC7/§5 declaring the sweep the *single* cross-tenant job

Story 4 AC5 says the endpoint "returns **every account** with a pending `deletionRequestedAt` — id,
`collegeId`, requested-at, …" (`spec.md:231-236`). Listing `collegeId` per row reads as a
cross-college result, but the admin router's `authenticate` sets a single `req.collegeId` from the
JWT (`authenticate.ts:45-56`), and Story 2 AC7 / §5 (`spec.md:114-122`, `:546-549`) declare the
sweep the **one** sanctioned exception to "every query filters by `collegeId`". As written, this new
route-surface is either a second exception (contradicting AC7) or is college-scoped and the
`collegeId` field is redundant noise.

**Remedy.** Say the surface is college-scoped (`{ collegeId: req.collegeId, deletionRequestedAt:
{ $ne: null } }`) and drop the per-row `collegeId`, or explicitly name it as a second sanctioned
exception. One sentence removes the ambiguity.

---

### AR4-L2 (LOW) — `deletionClaimedAt` is never cleared, so a cancelled-then-re-requested account shows a stale claim on the very surface that exists to detect a stalled sweep

`deletionClaimedAt` is set by the claim and is never unset: the account row is deleted on success
(so no clear is needed there), but the failure path leaves it. Story 4 AC1 defines cancellation as
clearing **only** `deletionRequestedAt`/`deletionRequestedVia` (`spec.md:210-215`). Sequence: a
request is set → the executor claims it (`deletionClaimedAt` set) → the executor crashes before
deleting → the owner cancels (the field is cleared; a post-claim clear is *effective* here precisely
because nothing is mid-flight) → later a new public request sets `deletionRequestedAt` again. The
row now carries the *previous* claim's `deletionClaimedAt`, and Story 4 AC5's surface — whose whole
purpose is "requests whose age exceeds the grace period and whose `deletionClaimedAt` stays null"
(`spec.md:456-460`) — reports a fresh, unclaimed request as already claimed.

**Remedy.** Have the cancellation clear `deletionClaimedAt` alongside the two request fields (it is
the third field of the same subdoc state), or state in Story 4 AC1 that clearing resets all three.
Low impact, but it is the detection control the operational dependency rests on.

---

### AR4-L3 (LOW) — the sweep's recurrence form is the older `add(…, { repeat })`, not the module's own `upsertJobScheduler`, and the new `QUEUE_NAMES` constant is still unnamed

§3.5.1 specifies hourly via `repeat: { pattern: '0 * * * *' }` (`spec.md:452-453`), the
`add(…, { repeat })` form the cited `proposal-expiry-worker.ts:126-130` uses. The Juvi module's own
worker — which §6 places this sweep *with* — uses the stable-id form,
`queue.upsertJobScheduler(SWEEP_SCHEDULER_ID, { every: intervalMs }, …)`
(`reconcile-worker.ts:44-52`), and `reconcile-worker.ts:16`/`:43-47` records *why*: the interval-keyed
`add({repeat})` form left the previous schedule running when the interval changed. §6
(`spec.md:592-598`) also does not name the new `QUEUE_NAMES` constant the queue needs — `QUEUE_NAMES`
is a closed `as const` (`QueueManager.ts:113-146`, Juvi names at `:141-142`). This is consistency,
not correctness (both forms work for a fixed interval), and matches r3's AR3-L4.

**Remedy.** Follow the module's own shape (`upsertJobScheduler` with a stable id) and name the new
queue-name constant in §6.

---

### AR4-L4 (LOW) — Story 3 AC8 keeps `Sec-Fetch-Site: same-origin` as the primary control (r3-AR3-L2 residual)

`spec.md:187-193` requires `Sec-Fetch-Site: same-origin` first, with an `Origin`/`Referer` allowlist
as fallback and rejection when neither is present. The static page is served from the portal web root
while the endpoint is under `/api`; they share an origin only if production nginx proxies `/api` on
the same host, which is not verifiable from the repo (`scripts/deploy.sh` only). Every current major
browser engine sends Fetch Metadata, so with the fallback in place the practical risk is small — but
r2/r3 recommended making the `Origin` allowlist primary and `Sec-Fetch-Site` a hardening addition,
and that ordering is still the safer one where the same-origin topology is unconfirmed.

**Remedy.** As r2/r3: make the `Origin` allowlist the primary check, `Sec-Fetch-Site` additive. Or
confirm the nginx same-origin arrangement as a plan-time check (Story 3's AC1 already carries an
nginx plan-time check; this one belongs beside it).

---

### AR4-L5 (LOW) — the spec file's own header and resolution line are stale at revision 4

`spec.md:3` still reads "Phase 3, revision **3** (post-GATE-2 fix round …)", and `spec.md:9` still
says the resolution is "diff of revision 2 against revision 1, plus the round-2 fixes" — both stale
now that `gate2-resolution.md` has a Part C and the content is revision 4. Same class as the r3
citation nits. Minor, in the same LOW also: `institution-config.ts:74-81` (`spec.md:169`, Story 3
AC5) is actually `:73-80`.

**Remedy.** Bump the header to revision 4, point the Resolution line at Part C, and correct the
`institution-config` line range.

---

## Severity counts

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 5 |

**GATE 2 criterion (0 CRITICAL + 0 HIGH) IS met.** Architecture re-earns PASS.

**AR3-H1 status: genuinely resolved.** The predicate is gone from the trigger query and no new
hazard replaces it. Verified by tracing every account state the sweep can now reach through every
write the deletion service performs — none is status-dependent, and none touches `User`.

**r3 finding status:**
- AR3-H1 (HIGH) — **resolved.**
- AR3-M1 (index + tenancy carve-out) — **resolved** (§3.5.1 sparse index; Story 2 AC7/§5 name the
  exception). The *new* admin surface's tenancy wording is AR4-L1.
- AR3-M2 (atomic claim) — **resolved** (claim re-asserts the field inside the write; crash-retry is
  real because the field stays set).
- AR3-M3 (cancel endpoint absent) — **resolved** (Story 4 AC1 + §3.6).
- AR3-L1 (singular `accountId` in the reset) — **resolved** (`accountId: { $in: accountIds }`).
- AR3-L2 (`Sec-Fetch-Site` primary) — **not resolved** (AR4-L4).
- AR3-L3 (`spaces/routes.ts:8`→`:6`) — **resolved.**
- AR3-L4 (recurrence form) — **not resolved** (AR4-L3).
- AR3-L5 (interval unspecified) — **resolved** (hourly named); the `QUEUE_NAMES` constant is still
  unnamed (AR4-L3).
- AR3-L6 (detection surface owned by no AC) — **resolved** (Story 4 AC5 + §3.6), though its contract
  home is AR4-M1.

**New in round 4:** AR4-M1 (the admin surface's contract placement), AR4-L1 (its tenancy wording),
AR4-L2 (`deletionClaimedAt` staleness). All three originate in revision 4's own additions.

---

## Could not verify

- **No live Redis, Mongo or HTTP run.** Every backend claim is a source read. In particular I did
  not execute the `findOneAndUpdate` claim or the sparse index against a live server; the sparse-vs-
  partial equivalence and the type-bracketing of `$lte: <Date>` rest on documented MongoDB semantics,
  not on an executed query.
- **The production nginx config is not in this repo.** The static page's `try_files`/SPA-fallback
  order and the same-origin question behind AR4-L4 rest on `scripts/deploy.sh` plus vite's documented
  `public/` → `dist/` copy, not on a server block.
- **Whether the Juvi admin console can set `exiting` directly** was not established this round
  (`admin/schemas.ts` accepts it; `transitionAccount` has only the `deactivated`/`active` call sites
  at `provisioning-service.ts:209` and `me-service.ts:141`). AR3-H1's resolution does not depend on
  it — the `deactivated`-during-the-window path via `workflow.handlers.ts:2009` suffices, and the
  predicate is gone regardless.
- **The Play Console policy wording** (why the feature exists) came from the spec/discovery; it was
  not independently fetched.

# GATE 2 — api-security validator report

**Feature:** 011 — Juvi account deletion
**Spec:** `.sdd/specs/011-account-deletion/spec.md` · **Discovery:** `.sdd/discovery/011-account-deletion/discovery.md`
**Worktree:** `/Users/srinivasarao.kandula/code/juvion_v2/.claude/worktrees/juvi-flutter-shell`
**Verdict:** **FAIL — 0 CRITICAL, 3 HIGH.** GATE 2 requires 0 CRITICAL **and** 0 HIGH.

All line refs are from this worktree. No implementation of 011 exists yet (`grep` for
`deleteAccount|account-deletion|me/account` across `backend/src`, `mobile/lib`, `admin-portal/src`
returns nothing), so every finding below is a defect in the **spec's claims or decisions**,
substantiated against the code the spec says it will reuse.

---

## HIGH

### H1 — Reusing sign-in's verification makes the public page an unauthenticated account-lockout weapon

**Severity: HIGH**
**Evidence:** `backend/src/modules/juvi-app/accounts/cooldown.ts:4-5, 8-11, 13-32` ·
`backend/src/modules/juvi-app/accounts/auth-service.ts:32-35, 55-59` · spec Story 3 AC2/AC3.

`cooldownKey(collegeId, identifier)` is a single Redis key per `(collegeId, identifier)`.
`signIn` reads it **before any credential check** (`auth-service.ts:32-35`) and `recordFailure`
increments it on every failure (`:56`). Five failures in 10 minutes (`COOLDOWN_MAX_FAILURES = 5`,
`COOLDOWN_WINDOW_SECONDS = 600`) ⇒ `429 COOLDOWN` for everyone, including the legitimate owner.

Story 3 AC2 tells the implementer to verify identity "reusing `identifier-resolver` +
`credential-store`" and AC4 to use "one code path" with Story 2. The path of least resistance is
calling `authService.signIn`, which drags the **shared** cooldown key along. Consequences:

1. An **unauthenticated** attacker who knows a victim's identifier (roll number / employee code —
   low entropy and often published on department pages) and their institution code (public — see
   `config/controller.ts:16-18`) can send 5 bogus public-deletion requests and lock the victim out
   of the **app** for 10 minutes. Repeat every 10 minutes for an indefinite lockout.
2. Conversely a user who mistypes their password on the deletion page is locked out of the app.
   The failure is invisible in the deletion-page response (it is a generic 401 per AC5), so the
   user cannot tell why the app suddenly refuses to sign them in.

AC3's mitigation ("rate-limited with the same shape as `signInLimiter`") does **not** help: the
per-IP limiter (10/min) and the per-identifier cooldown are different controls, and the cooldown is
the one that produces the lockout. Note the exposure pre-exists at `POST /auth/sign-in`; the defect
is that the spec **extends** it to a new surface, calls the result "rate-limited", and never
acknowledges that the primitive is a lockout rather than a throttle.

**Remedy:** the public verification must not touch the sign-in cooldown. Use a distinct key
namespace (`juvi:deletion-verify:<collegeId>:<hash>`) with its own, *non-blocking* budget — count
attempts and tarpit/back-off rather than hard-block, so the endpoint can never deny sign-in. Cap the
per-identifier budget far lower than 5 within a long window and require the response to be
identical for blocked/existing/non-existing identifiers.

---

### H2 — The public path deletes irreversibly on password possession alone, silently, and the password is the shared ERP credential

**Severity: HIGH**
**Evidence:** `auth-service.ts:51-59` (single bcrypt compare is the whole check) ·
`provisioning-service.ts:123-132` (`User.password` is the ERP web login) ·
`.sdd/discovery/011-account-deletion/discovery.md:31-38` · spec Story 3 AC4, Story 1 AC2.

`signIn`'s only possession requirement is `bcrypt.compare(input.password, user.password)`
(`auth-service.ts:53`). Story 3 AC4 has the public endpoint perform **the same deletion** as the
authenticated path — immediately, with no second factor, no out-of-band confirmation, no grace
period and no notification to the account owner. The credential is not Juvi-specific: the discovery
records that `User` is shared with the ERP web login, so the same password authenticates the ERP.

Blast radius of that single decision:

- A password obtained by **credential stuffing** (the Juvi `User` password is the ERP password, and
  `signIn` is the established stuffable endpoint) becomes *destructive*, not merely readable. The
  account is gone and only an admin-triggered provisioning run (Story 4) restores access.
- The action is **silent**: nothing is sent to the owner. On the public path there is not even the
  Story 1 AC2 typed-confirmation equivalent that the in-app path gets — an asymmetry the spec never
  justifies.
- The 10/min/IP limiter (H1/M9) is the only brake on a distributed attack; `clearFailures` on
  success (`auth-service.ts:64`) means successful verifications do not accumulate against the
  cooldown either.
- Scope is not limited to students: `identifier-resolver.ts:18-26` resolves faculty and staff
  employee codes, so a staff member's account is deletable through the same public page.

**Remedy:** keep "one code path" for the *deletion*, but interpose a confirmation on the public
path — a one-time token (the spec already notes e-mail is stubbed, so an in-app confirmation prompt
for the account's live sessions, or an admin-visible pending-deletion request, is the realistic
option), plus an **owner notification** on every deletion from either path. Even the cheapest
mitigation (notify the owner and surface the deletion in the ERP) removes the silent-takeover
property.

---

### H3 — The nearest existing helper violates Story 2 AC3: `deactivateAccount()` disables the shared ERP login

**Severity: HIGH**
**Evidence:** `backend/src/modules/juvi-app/accounts/provisioning-service.ts:206-214`, esp. `:210`
`await User.updateOne({ _id: account.userId, collegeId }, { $set: { isActive: false } });` ·
compared against spec Story 2 AC3 and spec §1 ("Getting this wrong either breaks ERP logins…").

`deactivateAccount(collegeId, accountId, source, performedBy)` is the only existing function whose
name and behaviour mean "this account can no longer be used". If the deletion service reuses it
entirely plausible, since the discovery points the implementer at this module for
`revokeSession`/`revokeOtherSessions`, and it is the same file — it will:

1. set `User.isActive = false`, breaking the person's **ERP web login** (`auth-service.ts:80-84`
   and the ERP login path read the same flag), and
2. revoke every session with reason `'deactivated'` (`:211`), mislabelling the trail.

That is exactly the failure the spec's §1 identifies as the hard part, and the spec never names the
helper as forbidden. Story 2 AC3's test ("`User` still exists with an unchanged password hash and
`isActive`") is the only thing standing between this feature and an **unauthenticated public
endpoint that disables a person's ERP access** — if the test is written from AC3 it will catch this,
but only for a service that is actually exercised; a public-path variant that forgets the assertion
would not.

**Remedy:** state in the spec/plan, in the negative, that `deactivateAccount` MUST NOT be reused
(the deletion is not a deactivation — spec §3.3 already argues this for `ACCOUNT_STATUSES`; extend
the same argument to the helper). Add the ERP-login assertion to **both** path tests, not just the
in-app one.

---

## MEDIUM

### M1 — Hard-deleting `MobileSession` rows bypasses the revocation write-through; a deleted session stays usable for up to 60 s, and no `RevokeReason` exists for deletion

**Evidence:** `backend/src/modules/juvi-app/accounts/session-service.ts:8-11` (cache TTLs:
active 60 s, revoked 900 s), `:148-153` (`revokeSession` deliberately writes through the Redis cache
and `$unset`s `pushToken`: *"Write-through so the very next request on that device sees it"*),
`:184-202` (`getSessionState` trusts a cached `'active'` and returns before touching Mongo) ·
`backend/src/models/juvi/MobileSession.ts:4-10` (closed `RevokeReason` enum) · spec §5
("sessions are deleted before the account row") and Story 2 AC2.

Spec §3.1 + Story 2 AC2 require **hard** deletion ("no refresh-token hash survives"), which means
`deleteMany` — and `deleteMany` cannot write through the cache. After `deleteMany`, the keys
`juvi:sess:<sid>` still hold `'active'` for up to 60 s (`getSessionState:188-190` returns it without
consulting Mongo), so a session whose row no longer exists is still accepted by
`authenticateMobile` while the account row still exists.

In the happy path this is masked: the account row is deleted milliseconds later and
`authenticate-mobile.ts:41-42` rejects on `!account`. But in the **partial-failure path** the spec
itself is trying to make safe — sessions deleted, account delete throws or the request is abandoned
— the account row survives and the user's refresh token is already gone while their access token
keeps working for up to 60 s (and, via the same account-exists check, the *stale* cache is the only
thing that makes it work; the moment the cache expires the session is rejected as `missing`). The
user is in a state they cannot observe or recover from.

Separately: because no `RevokeReason` covers deletion (the discovery flags this), any implementation
that *does* use `revokeSession` must pass one of the seven existing values — `'sign_out'` or
`'admin'` — putting a wrong reason into the audit trail for a security-relevant event.

**Remedy:** for each live session of the account, `revokeSession(sid, <reason>)` first (write-through
+ `pushToken` `$unset`), **then** `deleteMany`; and add `'account_deleted'` to `REVOKE_REASONS`
(`MobileSession.ts:8-10`) so both the row and the cache carry the truth. Alternatively
`redis.del('juvi:sess:'+sid)` per session before the `deleteMany`, but that still loses the reason.

### M2 — `credential-store` cannot verify anything, and `signIn` cannot be reused as the public verifier

**Evidence:** `backend/src/modules/juvi-app/accounts/credential-store.ts:24-43, 58-75, 84-92` ·
`backend/src/modules/juvi-app/accounts/auth-service.ts:63-69` · spec Story 3 AC2.

AC2 says identity is verified "the same credential as sign-in, reusing `identifier-resolver` +
`credential-store`". `credential-store` is the **AES-256-GCM vault for issued temporary passwords**
(`encryptSecret`/`storeCredential`/`revealLatestForAccount`); it has no password-comparison function
and holds no verifier. The actual verifier is `User.password` compared with `bcrypt.compare`
(`auth-service.ts:53`). The spec's named dependency is wrong and will send the implementer looking
for an API that does not exist.

Worse, `signIn` cannot be called verbatim from a public page: it requires a full
`DeviceInfo { id, name, platform, appVersion, osVersion }` and **creates a `MobileSession` plus
mints an access/refresh token pair** (`auth-service.ts:65-68`). A public, unauthenticated endpoint
that mints a session for an arbitrary account — with `createSession` first revoking any earlier
session for the same `deviceId` (`session-service.ts:66-68`) — is a token-minting surface the spec
never intends and never bounds. If the handler is interrupted between verification and deletion, a
live session for the account exists, created by an unauthenticated caller.

**Remedy:** AC2 must name `identifier-resolver` + `User.password`/`bcrypt` and require a **read-only**
`verifyCredentials(collegeId, identifier, password)` extraction from `signIn` (returning
`{ user, account }`, creating no session). The deletion then runs on that result. Say explicitly
that the public path must not create a `MobileSession`.

### M3 — The `NoticeRecipient` deletion target is ambiguous, and neither reading delivers AC's stated outcome

**Evidence:** `backend/src/models/juvi/NoticeRecipient.ts:22-31` (one row per audience member;
`accountId` is **null while the person is not on Juvi**), `:62`, `:78-85` (unique
`{noticeId, personId}`; indexes on both `{collegeId, accountId, …}` and `{collegeId, personId}`) ·
`backend/src/modules/juvi-app/notices/admin-service.ts:31` (`AUDIT_TYPES` counts reach from these
rows) · spec §3.1 / Story 1 AC1 ("notice read/acknowledged state").

Spec §3.1 lists "`NoticeRecipient`s for the account" without saying by which key, and the two
candidate keys give different outcomes:

- `deleteMany({ collegeId, accountId })` — **misses every row whose `accountId` is `null`**
  (`NoticeRecipient.ts:62`), i.e. exactly the pre-activation snapshot rows. The "notice read/ack
  state" the spec promises to erase is not erased in the case where the person was added to a notice
  before their account existed.
- `deleteMany({ collegeId, personId })` — deletes snapshot rows for notices the person never
  received on Juvi, mutating the reach and acknowledgement denominators that
  `notices/admin-service.ts:31` reports to publishers.

Also note the *good* news that limits the impact: the `NoticeAcknowledgement` `AuditLog` entries
survive (they are not in the deletion set; `notices/consumers.ts:122-129`), so proof-of-acknowledgement
is not destroyed.

**Remedy:** pick one key in the spec and state the disclosure consequence. Recommend `personId`
(consistent with "erase the Juvi footprint for this person") **and** add an explicit sentence that
the publisher-facing reach/ack totals for past notices will change, so the ERP UI is not treated as
a bug when it does.

### M4 — The photo the user uploaded through the app is not in the deletion set and survives

**Evidence:** `backend/src/modules/juvi-app/accounts/me-service.ts:166-169`
(`uploadMyPhoto` → `uploadEntityPhoto`) · `backend/src/modules/people/photo-service.ts:181-184`
(deterministic keys `${prefix}/photo/original.${ext}` and `…/thumb.jpg`, `prefix =
entityUploadPrefix(entityType, collegeId, entityId)`) · spec §3.1 / §3.4.

The deletion set is `JuviAccount`, `MobileSession`, `ChannelMembership`, `NoticeRecipient`,
`JuviProvisionedCredential`. Nothing removes the S3 objects written when the user uploaded a profile
photo **from the Juvi app**. Because the key is deterministic it is still found by
`getEntityPhotoUrls` and re-presignable after deletion, so a photo the user believes they deleted
remains retrievable — and the retention disclosure (§3.4) justifies retaining *academic and
financial* records, not app-uploaded imagery. This is the kind of gap that makes a Play Data-safety
answer inaccurate.

**Remedy:** add the app-uploaded photo to the deletion set, or state in §3.4 that the profile photo
is part of the retained `Person` record (and why). Decide explicitly; do not leave it unmentioned.

### M5 — Audit actor is free-form PII, and the audit write is ordered after the destructive deletes

**Evidence:** `backend/src/shared/audit.ts:27-49` (`performedBy` is `String`, default `'System'`;
`entityType` is not enum-constrained; `action: 'delete'` exists) · `cooldown.ts:7`
(*"Hash so the identifier itself never lands in Redis or logs"*) · spec Story 2 AC4 ("entity,
account id, actor, timestamp") and §5.

Two defects:

1. **Identifier leakage.** The codebase has an explicit posture that a sign-in identifier never
   lands in Redis or logs (`cooldown.ts:7-11` hashes it). AC4 asks for an "actor" and the natural
   value on the public path is the submitted identifier or e-mail. `AuditLog` is read and rendered
   in the ERP, so writing the raw identifier there contradicts the existing posture and spreads PII
   into a long-lived, admin-visible collection. Record the **account id** (and, at most, a hash of
   the identifier) as the actor, with a distinct `entityType` that marks the origin
   (in-app vs public web) — which is itself useful for the abuse analysis in H2.
2. **Ordering.** Spec §5 fixes the order only for sessions → account. If `createAuditLog` runs last
   and throws (schema/validation/connection), the account is already gone and the only record that
   the deletion happened is lost — precisely the case an audit trail exists for. Write the audit
   entry **first** (intent), then delete, then either update it or accept the intent record; or make
   the audit write the last step of a documented best-effort path *with* a `console.error` fallback.

### M6 — `deleteMany` is outside the 010 scope-plugin backstop, so AC7 rests entirely on developer discipline

**Evidence:** `backend/src/shared/rbac/scope-plugin.ts:73`
`const HOOKS = ['findOne','findOneAndUpdate','findOneAndDelete','findOneAndReplace','updateOne','deleteOne','replaceOne']`
· `backend/src/app.ts:1-2` (the plugin is global) · spec Story 2 AC7 ("no query runs without
`collegeId`").

010's by-id backstop — the mechanism that "narrows any by-id query … using the model's own axis" —
does not hook `deleteMany`, `updateMany` or `deleteOne`+filter-based bulk paths. On the Juvi mobile
path `getListContext().authScope` is undefined anyway (the Juvi stack sets `req.mobile`, not
`req.authScope`), so the plugin is inert there. AC7 therefore has **no runtime enforcement at all**
for the five bulk deletes this feature adds: a missing `collegeId` in any one of them is a
cross-tenant deletion, and it will type-check.

**Remedy:** keep AC7, and add a plan/task requirement that every deletion write goes through one
`deleteScoped(Model, { collegeId, … })` helper (a single place to audit), plus a test per model that
seeds two colleges and asserts the other college's rows are intact. Consider adding `deleteMany` to
the plugin's hook list as a codebase-wide follow-up (out of this feature's scope, worth a ticket).

### M7 — Serving the public page from the backend collides with the global helmet CSP and with the mobile error envelope

**Evidence:** `backend/src/app.ts:25` `app.use(helmet())` (no per-path override) ·
`node_modules/helmet@8.1.0` `index.cjs` `getDefaultDirectives()`:
`default-src ['self']`, `script-src ['self']`, `script-src-attr ['none']`,
`form-action ['self']`, `frame-ancestors ['self']` · `backend/src/app.ts:84-88` (mount order) ·
`backend/src/middleware/errorHandler.ts:30-34` ·
`backend/src/modules/juvi-app/errors.ts:39-45` · spec §3.2 and §5.

Spec §3.2 recommends `GET /account-deletion` on the backend. The repo has **no HTML route and no
templating engine** (`grep` for `res.send(`/`sendFile`/`text/html` finds only two CSV endpoints), so
the page will be hand-built strings, and:

1. Any inline `<script>`/`onclick` is blocked by the default `script-src 'self'` /
   `script-src-attr 'none'`. The tempting fix — loosening `helmet()` (or `'unsafe-inline'`) —
   weakens the CSP for **every ERP response**, which is a real regression for a staff tool. Do not
   do it; either serve the page as a static asset with no inline script, or scope a second
   `helmet({ contentSecurityPolicy: … })` mount to that one route (never the reverse).
2. A route mounted **outside** `/api/juvi-app` is serialized by the ERP `errorHandler`, not
   `mobileErrorHandler`: `MobileApiError extends AppError`, so `errorHandler.ts:30-34` returns
   `{ error: "<message>", detail: {…} }` instead of `{ error: { code, message } }`. That breaks the
   spec's own §5 constraint ("Mobile error envelope … not the ERP's `AppError`") for exactly the
   endpoint the public page consumes. The limiter's 429 body (`rate-limits.ts:14-16`) is
   mobile-shaped, so even the envelope is inconsistent *within one route*.

### M8 — Where the public route is mounted: `spacesRouter`'s router-wide `authenticateMobile`, and the error-envelope mismatch

**Evidence:** `backend/src/modules/juvi-app/spaces/routes.ts:8` `spacesRouter.use(authenticateMobile)` ·
`backend/src/modules/juvi-app/routes.ts:20-25` (mount order; the comment already documents this trap
for the receipts path) · spec Story 3 AC1 ("no authentication") and §5 ("must not import
authenticated middleware").

`v1Router` mounts `spacesRouter` with router-level `authenticateMobile`. Any public route appended to
`v1Router` after line 25 is 401'd before its handler runs — AC1 silently unsatisfiable. The two ways
out are both dangerous and the spec picks neither: (a) mount the public route **before**
`spacesRouter` (correct, and requires the same explicit ordering comment the receipts path already
carries); or (b) "fix" `spacesRouter` by removing its router-wide middleware — which opens the
entire spaces/channels surface. Nothing in the spec tells the implementer which, so the outcome is
the implementer's choice.

**Remedy:** the plan must name the exact mount point (before `spacesRouter`, in `v1Router`, with a
comment in the style of `routes.ts:20-21`) and must state "do not touch `spacesRouter`". Pair it with
a test that asserts the public path answers **without** an `Authorization` header.

### M9 — The only abuse control on a destructive unauthenticated endpoint is env-gated, in-memory, and IP-keyed

**Evidence:** `backend/src/modules/juvi-app/middleware/rate-limits.ts:4-5`
(`disabled()` → `E2E_TESTING=1|true` or `NODE_ENV==='test'`), `:7-18` (`skip: disabled`; no `store`),
`:21` (`signInLimiter = limiter(10)`; the `limiter` factory is **not exported**) ·
`backend/src/app.ts:23` (`trust proxy` false unless `TRUST_PROXY_HOPS` is set) and `:76-82`
(`E2E_TESTING` also unmounts the global limiter) · `backend/.env.example`
(`TRUST_PROXY_HOPS` "unset = trust none") · `.github/workflows/e2e.yml:76` (`E2E_TESTING: '1'`).

Four separate consequences for AC3:

1. **The control can be off in production.** `skip: disabled` disables the limiter entirely whenever
   `E2E_TESTING` is `'1'`/`'true'` or `NODE_ENV === 'test'`. The Playwright CI job sets
   `E2E_TESTING: '1'` (`.github/workflows/e2e.yml:76`), so the suite **cannot** assert AC3's 429 for
   the endpoint that will carry the deletion — and any deployment that inherits that variable has no
   limiter on a destructive public endpoint (H2's only brake).
2. **No shared store.** No `store` is passed, so express-rate-limit 8.7.0 uses the per-process
   in-memory `MemoryStore`: the effective budget multiplies by the number of workers and resets on
   every `pm2 restart` (`scripts/deploy.sh` restarts via pm2 on each deploy). A crash-loop or a
   deploy clears every lockout.
3. **IP key with `trust proxy` unset.** Per `app.ts:21-23`'s own comment, behind nginx the key is the
   proxy unless `TRUST_PROXY_HOPS` is set — every user then shares one bucket, so the *legitimate*
   campus traffic trips the limit. `.env.example` documents this but the default is `false`, and
   nothing in this feature forces the operator to set it.
4. **The factory is not exported.** AC3 says "the same shape as `signInLimiter`
   (`middleware/rate-limits.ts`)", but `limiter(n)` is module-private (`rate-limits.ts:7`); the
   implementer must add and export a `deletionVerifyLimiter` rather than compose one. Say so, and
   give it a **lower** max than `signIn` (it guards a destructive action, not a read).

**Remedy:** export a dedicated `deletionVerifyLimiter` with an explicit `store` note (redis-backed
if the deployment is multi-worker), and do **not** let `E2E_TESTING` be the only thing standing
between this endpoint and unlimited attempts — assert the 429 in a unit test that constructs the
limiter directly rather than relying on the e2e env.

### M10 — Other signed-in devices keep a local copy of personal data; the Story 1 AC3 wipe is single-device

**Evidence:** `mobile/lib/core/repos/me_repository.dart:36-38` (`_db.writeDoc('me', json, asOf)` — the
`/me` payload, including the person's name, institution and photo URL, is persisted in the drift DB)
· spec Story 1 AC3 (the wipe list: session, `analytics_events`, `ReceiptQueue`,
`flutter_secure_storage`, FCM token) and Story 2 AC2 ("all devices lose access").

Story 2 AC2 hard-deletes every `MobileSession`, so every *other* device is locked out server-side —
but only the **confirming** device runs the AC3 wipe. The other devices still hold the drift `me`
document, `analytics_events`, `ReceiptQueue` and their secure-storage contents, and they will not be
reachable by any server action. For a feature whose entire premise is "deletion, not deactivation",
that residue contradicts the claim and the Play Data-safety answer; it is also the reason a
server-side delete alone is not the whole feature.

**Remedy:** state that the wipe is best-effort per device and that other devices' caches are cleared
on their next launch (a 401/SESSION_INVALIDATED must trigger the local wipe, not just a bounce to
sign-in). Add the drift `me` document to the AC3 wipe list explicitly. If residue on uninstalled or
never-reopened devices is unacceptable, that is an argument for M4/H2's confirmation step, not for
silence.

---

## LOW

### L1 — Institution existence/pause state remains distinguishable on the public path

**Evidence:** `backend/src/modules/juvi-app/accounts/auth-service.ts:39-49` (unknown college → generic
401; known-but-disabled or known-but-paused → `503 INSTITUTION_PAUSED`) ·
`backend/src/modules/juvi-app/config/controller.ts:16-18` and
`config/institution-config.ts:74-81` (`lookupInstitutionByCode` returns null for unknown, inactive and
Juvi-disabled alike).

AC5 promises the page never reveals whether an *identifier* exists, and that holds (see "Clean"
below). But the page also takes an **institution code**, and `signIn`'s pre-credential branches
distinguish "no such college" from "college exists but is paused/disabled". This is a genuine oracle
on the public page. Its value is limited because institution codes are already enumerable through
the public `GET /institutions/{code}` (documented as `auth: false` in
`openapi/document.ts:143`). **Remedy:** collapse the pre-credential branches to one generic failure on
the public path, and disclose nothing about paused state there; or accept and document the exposure.

### L2 — Cross-site submission of the public form is not blocked (limited impact)

**Evidence:** `backend/src/app.ts:33-41` (CORS allowlist with `credentials: true`; no `Origin` ⇒ allowed)
· `node_modules/helmet@8.1.0` defaults `frame-ancestors ['self']`.

CORS never prevents a request from being *processed* — only from being *read* by script — and a
`application/x-www-form-urlencoded` POST is a simple request with no preflight. So any site can make
a browser POST institution code + identifier + password to the endpoint. Impact is genuinely low
because the credential travels in the body (no ambient cookie session anywhere in the juvi-app
stack), so an attacker gains no authority they did not already supply, and clickjacking is already
mitigated by helmet's `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`. Still worth closing
on a destructive endpoint: **remedy** — require `Sec-Fetch-Site: same-origin` (or an `Origin`/
`Referer` allowlist check) on the public POST and a per-form nonce, so a lure page can at least not
submit the form for the user.

### L3 — `JuviAccount` has no unique index on `{collegeId, userId}`; the deletion inherits an arbitrary-row pick

**Evidence:** `backend/src/models/juvi/JuviAccount.ts:95` (unique `{collegeId, personId}`) vs. `:96`
(non-unique `{collegeId, userId}`) · `backend/src/modules/juvi-app/accounts/auth-service.ts:52`
`JuviAccount.findOne({ collegeId, userId: user._id })`.

Pre-existing, not introduced by 011, but the feature turns it destructive: if a college ever ends up
with two accounts for one `User`, `findOne` picks one arbitrarily and the deletion removes it —
silently the wrong row, or (worse, from the user's point of view) the right one while the other
survives and keeps the account alive. **Remedy:** not this feature's to fix, but the deletion should
`deleteMany({ collegeId, userId })` on the whole account set (and correspondingly for the child
rows, which are keyed by `accountId`), or the plan should assert the single-account invariant
explicitly so the test suite proves it before the deletion relies on it.

---

## Verified clean (so the absence of findings is meaningful)

- **Self-scoping of the in-app path (Story 2 AC1) — holds.** `req.mobile` is built only from verified
  JWT claims (`authenticate-mobile.ts:35-42, 62-73`); no account/person id is read from the body by
  any existing `/me/*` controller (`me-controller.ts:7-33`), and the cross-tenant check is explicit:
  `String(account.collegeId) !== claims.cid` → 401 (`:42`). A sibling account in another college
  cannot be reached.
- **AC5 (Story 2) — holds, and for the stated reason.** `authenticateMobile` step 3 is
  `JuviAccount.findById(claims.aid)`; with the account row gone it throws 401 `SESSION_INVALIDATED`
  (`:41-42`) regardless of the ≤60 s stale-`active` Redis session cache (which is why M1 is not a
  token-still-works bug in the happy path). `refresh` also 401s for a deleted account
  (`auth-service.ts:78-90`). The claim "the account row is gone, so `authenticateMobile` cannot
  resolve it" is accurate.
- **AC6 (idempotency, "not a 500") — holds.** Every post-deletion entry point fails in
  `authenticateMobile` (401), and `refresh`'s lookup chain returns a defined
  `401 SESSION_INVALIDATED` for a token nobody knows (`session-service.ts:144-145`). I found no 500
  path for a missing account.
- **Identifier enumeration at the credential layer — clean.** `DUMMY_HASH` makes bcrypt run for
  unknown users (`auth-service.ts:14-16, 53`), and `!user || !account || !ok` collapses to a single
  generic 401 (`:55-59`). The 403 `ACCOUNT_DEACTIVATED` (`:60-62`) is reachable **only with a correct
  password**, so it is not an oracle. The cooldown check precedes user resolution, so 429 is uniform
  for existing and non-existing identifiers (`:32-35`). The one residual oracle is institution-level
  (L1).
- **No credential/token material survives in the deletion set.** The refresh hash and `pushToken`
  live only on `MobileSession` (`MobileSession.ts:42, 48`), and the unique partial index on
  `pushToken` (`:59`) means delivery is by row lookup — removing the rows stops FCM delivery to that
  device, matching `revokeSession`'s `$unset`.
- **AuditLog is not in the deletion set**, so prior acknowledgement evidence survives
  (`notices/consumers.ts:122-129` writes a `NoticeAcknowledgement` entry per ack; `audit.ts:27-37`
  contains the `acknowledge`/`delete` actions). The trail can therefore be made complete; M5 is about
  *who* and *when*, not about the set.
- **Multi-tenancy of the delete set is feasible.** `JuviAccount` (`:65`), `MobileSession` (`:34`),
  `ChannelMembership` (`:18`), `NoticeRecipient` (`:59`) and `JuviProvisionedCredential` (`:25`) all
  carry a required `collegeId`, so AC7 is satisfiable — it just is not enforced (M6).
- **Story 4 AC2 — holds.** `provisionPerson` writes no opt-out marker: it looks up an existing
  `JuviAccount` by `{collegeId, personId}` and returns early if found (`provisioning-service.ts:102-103`),
  otherwise creates one (`:135`) with a fresh `onboarding` status and a new
  `JuviProvisionedCredential` (`:150-163`) — all confirmed by the discovery
  (`JuviAccount.create` has exactly one non-test call site; `spaces/reconcile-service` only touches
  channels/memberships and `lastReconciledAt`). One consequence worth a sentence in the spec: the
  re-provision takes the `resetPassword` branch (`:123-132`) and therefore **rotates the person's ERP
  password**, which is a legitimate admin action but should not surprise the operator.
- **CSRF on the in-app path — not applicable.** `DELETE /api/juvi-app/v1/me/account` authenticates by
  `Authorization: Bearer`; there is no cookie session in the juvi-app stack, so a cross-site request
  cannot carry authority.
- **helmet's global defaults do protect the public page's framing** (`frame-ancestors 'self'`,
  `X-Frame-Options: SAMEORIGIN`), which is why clickjacking is not listed as a finding.

## Not verifiable from this worktree

1. **Whether a reverse proxy fronts the API in the target deployment.** It decides whether M9(3) is
   live. `TRUST_PROXY_HOPS` is documented in `backend/.env.example` but unset in `backend/.env`, and
   `nginx` is referenced only for the admin-portal (`scripts/deploy.sh` header). The code comment at
   `app.ts:21-23` acknowledges the hazard, so I reported it conditionally.
2. **The production pm2 mode (fork vs cluster) and instance count.** It decides whether M9(2)'s
   in-memory limiter multiplies in practice. `scripts/deploy.sh` resolves a single process by
   listening port/cwd, which suggests one instance, but no `ecosystem.config.*` exists in the repo to
   confirm.
3. **`ALLOWED_ORIGINS` in any real deployment** (`backend/.env` is blank here), so the practical
   strength of the CORS allowlist in L2 is unknown.
4. **The Dart/Flutter side of the wipe (Story 1 AC3/AC4).** I read `me_repository.dart` only to
   establish that the `me` document is persisted locally (M10); the ordering guarantee in AC4
   ("nothing is deleted locally if the call fails") and the drift/FCM wipe mechanics belong to a
   client-side review, and I did not audit `session_controller.dart` or the settings screen.
5. **Whether the college's ERP password policy lets a student set the same password they use
   elsewhere** (relevant to H2's credential-stuffing framing). No password-policy enforcement was
   found in `auth-service.ts` or `provisioning-service.ts`, but I did not survey the ERP login path
   itself.

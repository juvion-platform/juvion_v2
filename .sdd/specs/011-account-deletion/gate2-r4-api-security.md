# GATE 2 — api-security validator report (round 4)

**Feature:** 011 — Juvi account deletion
**Spec under review:** `.sdd/specs/011-account-deletion/spec.md` **revision 4** (header still says
"revision 3" — see L5; the body is the revision-4 text: no `status` predicate, the atomic claim,
Story 4 AC5, §3.6's `cancelAccountDeletion`/`listPendingDeletions`)
**Discovery:** `.sdd/discovery/011-account-deletion/discovery.md` · **Resolution:** `gate2-resolution.md` Part C · **Round 3 (mine):** `gate2-r3-api-security.md`
**Worktree:** `/Users/srinivasarao.kandula/code/juvion_v2/.claude/worktrees/juvi-flutter-shell`

**Verdict: PASS — 0 CRITICAL, 0 HIGH, 3 MEDIUM, 5 LOW.** GATE 2 requires 0 CRITICAL **and** 0 HIGH.

| Severity | Count | Gate effect |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 | **gate met** |
| MEDIUM | 3 | advisory |
| LOW | 5 | advisory |

**Round-3 M1 (the sweep's `status` predicate) is RESOLVED.** §3.5.1's trigger query (spec
:388-392) carries **no** `status` clause; the field alone is the predicate, exactly as §3.5.1
claimed. Verified against the live query text and against `ELIGIBLE_STATUSES`
(`models/juvi/JuviAccount.ts:12`), which is now referenced nowhere in the trigger. The same defect
two other validators graded HIGH is closed. This is the finding that decided round 3 and it does
not recur.

No implementation of 011 exists yet — `deletionRequestedAt`, `deletionClaimedAt`, `deleteScoped`,
`verifyCredentials`, `deletionVerifyLimiter`, `DELETION_GRACE_DAYS`, `cancelAccountDeletion`,
`pending-deletion` all return **zero hits** across `backend/src`, `admin-portal/src`, `mobile/lib`.
Every finding below is therefore a defect in the **spec's claims, decisions, or internal
consistency**, checked against the code the spec says it will reuse.

---

## Delta items — verdict per item

| # | Delta item | Verdict |
|---|---|---|
| 1 | §3.5.1 atomic claim — cancellation fail-closed; fail-open direction; `concurrency: 1` | **Holds.** Cancellation genuinely fails closed; no fail-open path found; `concurrency: 1` + duplicate-work statement accurate (claim is a cancel-gate, not a lock). One LOW (L4). |
| 2 | §3.5.1 duplicate-audit acceptance | **The call is right** (reasoned below). One related LOW (L1: the *request* entry has no stated guard). |
| 3 | §3.5.1 operational honesty + Story 4 AC5 mitigation | **Mitigation is real, not sufficient on its own** — it is pull-only with no alerting; the spec is honest about the dependency. Recorded in M2/L3 context; no separate finding beyond M2. |
| 4 | Story 4 AC5 + §3.6 — authz of `GET /admin/accounts/pending-deletion` | **Authz claim is real** (`admin/routes.ts:18` + `authorize('platform','read')`, precedent `:30`); no identifier leaked. **Two defects: M1 (contract entry) and M2 (query not bound to `collegeId`).** |
| 5 | Story 4 AC1 + §3.6 — `DELETE /me/account/deletion-request`, self-scoped | **Verified clean** — self-scoped by construction (`authenticate-mobile.ts:41,64`); cannot target another account. |
| 6 | Story 3 AC8 — `Sec-Fetch-Site: same-origin` primary + `Origin`/`Referer` fallback | **Expressible and correct on this stack**; one topology caveat carried from round 3. Related new finding **M3** (the form POST AC8 defends cannot carry the fields). |
| 7 | Story 2 AC4 — `'request_deletion'` enum addition; actor = account id | **Verified required** (absent from both closed enums); actor stays the account id — no identifier PII. |
| 8 | §6 — `signInLimiter` export correction; `deletionVerifyLimiter` shape | **Both correct** as written. |

---

## What I verified clean (read at the cited `file:line`, not restated from the spec)

**§3.5.1's atomic claim (delta 1).** The precedent's claim is at
`shared/jobs/proposal-expiry-worker.ts:41-47` (`findOneAndUpdate({_id, status:'proposed',
expiresAt:{$lte:now}}, {$set:{status:'expired'}})` + `if (!claimed) continue;`), the recurring sweep
at `:35-38`, `repeat` at `:126-130`, `concurrency: 1` at `:121`. The spec's citations (`:41-47`,
`:35-38`, `:126-130`) are accurate. On the deletion claim itself:
- **Cancellation fails closed.** `{deletionRequestedAt: {$lte: deadline, $ne: null}}` does not match
  a row whose field was `$unset`/set-null: MongoDB comparison operators do not match missing/null
  against a Date bound, and `$ne: null` excludes an explicit null. So a cancel landing before the
  claim yields `claimed === null` → `continue` → the deletion is correctly skipped.
- **No fail-open direction found.** `!claimed` is reachable only for (a) a genuine cancel, (b) a row
  already hard-deleted by another executor, or (c) an explicit null. None of these is "should have
  run but didn't." A crash *after* the claim leaves `deletionRequestedAt` set, and because the claim
  is deliberately not a lock the row is re-selected and re-claimed next tick — fail-closed, as
  §3.5.1 says.
- **`concurrency: 1` + duplicate work holds**, with one honest qualification the spec itself makes:
  the claim is a cancellation gate, **not** a mutual-exclusion lock, so two executors (two pm2
  workers, or a sweep plus an out-of-band cron) both claim and both proceed. §3.5.1 states exactly
  this ("costs duplicate *work*, never a double deletion of consequence"). Accurate.

**§3.5.1's operational dependency (delta 3).** The sweep is registered like the precedent
(`registerQueue` + `queue.add('sweep', …, {repeat})`), and `getQueue` really throws when a queue is
unregistered (`shared/queue/QueueManager.ts:57`), so the disclosure is load-bearing and correct.
Story 4 AC5 is a real, specified endpoint (not vapor): §3.6 declares it, and §3.5.1 ties its
existence to the dependency. The residual is that detection is **pull-only** — nothing pushes or
alerts — so a stall in a college nobody polls stays stalled. The spec is candid about this ("visible
to staff rather than invisible"); I did not grade it beyond M2 because demanding an alert channel
would be new scope, and the field-persists/next-tick-recovers property means the deletion is
stalled, never lost. **Stated honestly: the mitigation is real but human-dependent.**

**Story 4 AC5 authz (delta 4).** `adminRouter` is `adminRouter.use(authenticate)`
(`admin/routes.ts:18`) with per-route `authorize('platform', <action>)`; the sibling list route is
`adminRouter.get('/accounts', authorize('platform','read'), …)` (`:30`), and `/accounts` scopes by
`req.collegeId!` (`admin/accounts-controller.ts:10` → `accounts-service.ts:28` `{ collegeId }`). An
`adminRouter.get('/accounts/pending-deletion', authorize('platform','read'), …)` is therefore ERP-
gated and is the right shape. The mount is `router.use('/admin', adminRouter)` at
`modules/juvi-app/routes.ts:29`, i.e. `/api/juvi-app/admin/...`. **No identifier is returned** —
the enumerated fields are the account `_id`, `collegeId`, two timestamps and
`deletionRequestedVia`; the raw e-mail/roll number is not projected, so §3.5.2's "the identifier
never lands in the trail/logs" posture (`accounts/cooldown.ts:7-11`) is preserved. Two defects from
this item are M1 and M2.

**Story 4 AC1 / §3.6 cancellation (delta 5) — clean.** `accountsRouter` routes carry
`authenticateMobile` per-route (`accounts/routes.ts:15-22`), and `authenticateMobile` resolves the
caller's account itself — `const account = await JuviAccount.findById(claims.aid)` with
`String(account.collegeId) !== claims.cid` → 401 (`middleware/authenticate-mobile.ts:41-42`), storing
`accountId: String(account._id)` on `req.mobile` (`:64`). A `DELETE /me/account/deletion-request`
implemented as "clear the fields on `req.mobile.accountId`" is self-scoped **by construction**: the
token names exactly one account and there is no id in the request to override it. It cannot cancel
another account's request. **No path-parameter collision** with the existing
`DELETE /me/devices/:id` (`:20`) — the two delete paths are exact and distinct.

**Story 3 AC8 (delta 6) — expressible.** `Sec-Fetch-Site` is a plain request header
(`req.headers['sec-fetch-site']`); `Origin`/`Referer` likewise. The CORS allowlist is real —
`app.ts:28-41` builds it from `ALLOWED_ORIGINS || CLIENT_URL || 'http://localhost:5173'`, splits on
comma and rejects anything else, while allowing no-origin (`:36`) — so the `Origin` fallback is
implementable against the same list. There is **no existing CSRF/Sec-Fetch middleware anywhere**
(a repo-wide search for `sec-fetch|csrf` returns nothing), so this is new code, not a reuse — which
is what §5 implies. Accepting only `same-origin` (rejecting `same-site`, `cross-site`, `none`) is
stricter than CORS and correct. Carried caveat: whether the page and the API share an origin is a
deployment fact not in the repo (see "could not verify"). Related new finding: **M3**.

**Story 2 AC4 enum + actor (delta 7) — genuinely required.** `AuditAction`
(`shared/types.ts:26-55`) has no `request*` member, `AuditEntry.action: AuditAction` (`:62`) makes
the literal a compile error, and `AUDIT_ACTIONS` (`shared/audit.ts:27-37`) is mirrored into the
Mongoose enum at `:45` (`{ type: String, enum: AUDIT_ACTIONS, required: true }`), so even a cast
throws `ValidationError`. The precedent member `'acknowledge'` is at `types.ts:48` /
`audit.ts:32`, matching AC4's claim. `createAuditLog` is a bare `AuditLog.create` (`:60-62`), so
the guard must be caller-side — as AC4 says. The actor is a `string` `performedBy` (`:47`); AC4's
"the actor is the account id, never the submitted identifier" is implementable and leaks no PII.

**§6 limiter corrections (delta 8) — correct.** `limiter(max)` is module-private
(`middleware/rate-limits.ts:7`); `signInLimiter = limiter(10)` **is** exported (`:21`), together
with `institutionLookupLimiter` (`:23`) and `receiptsLimiter` (`:29`). No `store` is configured, so
the default per-process `MemoryStore` applies — §6's `deletionVerifyLimiter` "follows that shape
and is exported too" is accurate, and the 429 handler's `{error:{code:'COOLDOWN',…}}` (`:15`) is
consistent with `MobileErrorCode` (`errors.ts:8`).

**Round-3 items re-verified (edits did not disturb them).**
- Credential chain: `lookupInstitutionByCode` nulls `!doc` and `collegeStatus !== 'active' ||
!enabled` (`config/institution-config.ts:73-79`); `resolveIdentifierToUser` is college-scoped on
  every branch (`accounts/identifier-resolver.ts:10-29`, incl. the `{collegeId, email}` and
  roll/employee-code branches); `bcrypt.compare(input.password, user?.password ?? DUMMY_HASH)`
  (`auth-service.ts:53`, `DUMMY_HASH` `:15`, `User.password` required `models/User.ts:24`).
  `credential-store.ts` exports `storeCredential`/`revealCredential`/`revealLatestForAccount`/
  `encryptSecret`/`decryptSecret` and **no comparison function** — AC2's exclusion is exact.
- Cooldown severance: `getCooldown` reads only `juvi:login-fail:<collegeId>:<sha256(identifier)>`
  (`accounts/cooldown.ts:8-11,13-24`), so AC6's key-disjointness from the public path's
  `juvi:deletion-verify:*` holds by construction; `signIn`'s read is at `auth-service.ts:32-35`.
- Route placement: `spacesRouter.use(authenticateMobile)` is at `spaces/routes.ts:6` (spec now cites
  `:6` ✓); `v1Router` mounts `spacesRouter` **last** (`routes.ts:25`) with the ordering comment at
  `:20-21`; public precedent `configRouter.get('/institutions/:code', institutionLookupLimiter, …)`
  at `config/routes.ts:7`, inside `v1Router` (`routes.ts:18`). **Correct.**
- Mobile envelope: the outer router's `mobileErrorHandler` (`routes.ts:32`) spreads `detail`
  (`errors.ts:43`), and `authenticateMobile`'s `invalid(reason)` (`:30,39`) feeds `/` the revoke
  reason — so `reason: 'account_deleted'` reaches the client.
- Session revocation write-through: `revokeSession` sets `revokedAt`+`revokedReason`, `$unset`s
  `pushToken`, and writes `juvi:sess:<sid> = 'revoked:<reason>'` for 900 s
  (`accounts/session-service.ts:148-153`); `getSessionState` returns the cached revoked state before
  Mongo (`:188-190`) — so a bare `deleteMany` would indeed be insufficient. `RevokeReason`/
  `REVOKE_REASONS` (`models/juvi/MobileSession.ts:4-10`) lack `'account_deleted'` — a real closed-
  enum addition. **Story 2 AC2 holds.**
- Story 2 AC5: after deletion `getSessionState` → `revoked`/`missing` and `JuviAccount.findById`
  → null, both 401 (`authenticate-mobile.ts:39,42`). **Holds.**
- Audit-guard collision fix: the provisioning entry is `provisioning-service.ts:165-174`,
  `action: 'create'` — a guard keyed `{collegeId, entityType, entityId, action: 'delete'}` cannot
  match it. `AuditLog`'s only indexes are `{entityType,entityId,timestamp}` (`audit.ts:51`) and the
  `NoticeAcknowledgement` partial (`:53-56`), neither unique on the guard key — so §3.5.1's
  "duplicate is possible" is a true statement about the schema.
- `deactivateAccount` (`provisioning-service.ts:206-214`) sets `User.isActive = false` (`:210`) and
  soft-revokes (`:211`); `provisionPerson` defaults `resetPassword = true` (`:94`) and rotates on
  the existing-`User` branch (`:123-132`). §3.3 and Story 4 AC3 hold. The automatic call site is
  `workflow.handlers.ts:2009`. **Verified.**
- Deletion/reset/retention sets: `NotificationDelivery.accountId` required (`:47`),
  `source.type`/`kind` closed enums (`:49,51`), `source.id` required ObjectId (`:50`), unique
  `(source.type, source.id, source.kind, accountId)` index (`:70`); `JuviEvent.ts:20` required
  `accountId`; `NoticeRecipient` keyed `{noticeId, personId}` unique (`:78`) with `accountId`
  `default: null` (`:62`); the recount pattern is verbatim at `notices/recipient-service.ts:28-31`;
  the photo key is `${prefix}/photo/original.<ext>` (`people/photo-service.ts:181-184`). **All match
  §3.1/§3.5.2.**
- Notification suppression paths: `notifications/policy.ts:83` (`tier_off`), `sender.ts:120-124`
  (`no_device` when no live session has a `pushToken`), `transport/index.ts:14-24,29-34` (fake
  transport without `FIREBASE_SERVICE_ACCOUNT_JSON`).
- Static page: `admin-portal/public/` holds only `favicon.svg`; `scripts/deploy.sh:174-185` rsyncs
  `admin-portal/dist/` into `releases/<ts>` and atomically re-points `current` — so a vite `public/`
  asset lands at the web root, served by nginx with no helmet involvement. §3.2's withdrawal stands.
- `app.ts:23` is verbatim the `TRUST_PROXY_HOPS` line; `globalRateLimit` (`middleware/globalRateLimit.ts:9-15`)
  skips only the receipts path. §6/AC3 hold.

---

## MEDIUM

### M1 — §3.6 declares the ERP admin endpoint in the **mobile** OpenAPI document, where its path and auth scheme cannot be correct

**Severity: MEDIUM** (contract defect; no security impact — see "why")

**Evidence:** spec §3.6 — `GET /admin/accounts/pending-deletion` … `{ operationId:
'listPendingDeletions', method: 'get', path: '/admin/accounts/pending-deletion', auth: true,
status: 200 }` · the only OpenAPI document in the repo is
`modules/juvi-app/openapi/document.ts`, whose generator sets
`servers: [{ url: '/api/juvi-app/v1' }]` (`:206`) and `tags: ['mobile']` (`:189`), so every route in
its `routes[]` (`:142-180`) resolves under `/api/juvi-app/v1` and is generated into one Dart class
`MobileApi` · `auth: true` emits `security: [{ bearerAuth: [] }]` (`:191`, scheme at `:57`) — the
**mobile** bearer · the admin router is mounted at `router.use('/admin', adminRouter)`
(`modules/juvi-app/routes.ts:29`), a **sibling** of `use('/v1', v1Router)` (`:28`) under
`app.use('/api/juvi-app', …)` (`app.ts:86`), so the real route is
`/api/juvi-app/admin/accounts/pending-deletion` — **not** under `/v1` · `authenticate` rejects a
mobile-typed token on ERP routes (`middleware/authenticate.ts:33-35`).

**Why it is a defect:** the entry as written produces `/api/juvi-app/v1/admin/accounts/pending-deletion`
— 404 — and drags an ERP endpoint into the mobile contract, where it is generated as a `MobileApi`
method carrying the mobile bearer scheme for a route that only accepts an ERP token. §3.6 itself
says the surface "does **not** use the mobile error envelope", so declaring it in the mobile
document contradicts §3.6's own description. Security impact is nil (a mobile token can never reach
the ERP route; the server-side route is unaffected), which is why this is MEDIUM and not HIGH — the
same reasoning that graded round-3 M2 (a fails-closed enum omission) MEDIUM. But the entry is
unimplementable as specified, and this is the detection control §3.5.1 makes load-bearing.

**Remedy:** state where this one entry is declared. Either (a) drop it from the mobile contract and
document it as an ERP route (there is no ERP OpenAPI document to extend — say so, and let the ERP
UI call it directly), or (b) if a machine-readable contract is wanted, name a separate ERP document
with its own `servers` base and its own auth scheme. Do **not** put `/admin/...` into
`document.ts`'s `routes[]` as written.

---

### M2 — Story 4 AC5 / §3.5.1 do not bind the pending-deletion query to `collegeId`, and the wording invites a cross-tenant read

**Severity: MEDIUM**

**Evidence:** spec Story 4 AC5 — "returns **every** account with a pending `deletionRequestedAt` —
id, `collegeId`, requested-at, `deletionRequestedVia`, and `deletionClaimedAt`" · spec §3.5.1 —
"returning **every** account with `deletionRequestedAt` set (id, college, requested-at, via,
claimed-at)" · spec §5 — "every request-path query filters by `collegeId`; … The one exception is
the sweep (§3.5.1)" · Story 2 AC7 — the sweep is "the single sanctioned exception … it must not be
reachable from any request path" · the ERP convention is `{ collegeId }`-scoped lists
(`admin/accounts-service.ts:28`, driven by `req.collegeId!` at `admin/accounts-controller.ts:10`) ·
`authenticate` sets `req.collegeId` from the token and lets only `super_admin` override it via
`x-college-id` (`middleware/authenticate.ts:45-51`).

**Why it is a defect:** the endpoint is reachable from a request path, so it is **not** covered by
the sweep's carve-out — yet its own text says it "returns every account" and lists `collegeId` as a
returned field, which reads as a global view. Implemented literally as
`JuviAccount.find({ deletionRequestedAt: { $ne: null } })`, a college A principal would see every
college's pending deletions (account ids, timestamps, and which are stalled) — a cross-tenant leak,
in a system where §5/AC7 make the sweep the *only* sanctioned cross-tenant read. If a genuinely
cross-college view is intended for `super_admin`, the AC must say so and say how it is gated;
otherwise the query is `{ collegeId, deletionRequestedAt: { $ne: null } }`.

**Remedy:** change AC5/§3.5.1 to "every account **in the caller's college**", state the filter
(`{ collegeId, deletionRequestedAt: { $ne: null } }`) and that `collegeId` is included in the row
only as an echo. If a super-admin cross-college view is wanted, name it and gate it explicitly.

---

### M3 — the public page cannot deliver its fields as specified: AC9 mandates a script-free HTML form, but the stack parses no urlencoded body

**Severity: MEDIUM** (implementability of the new unauthenticated endpoint; not a new vulnerability)

**Evidence:** spec Story 3 AC1/AC9 — the page is `admin-portal/public/account-deletion.html`,
"plain HTML with **no inline script**" · spec §3.2 — the endpoint is `POST
/api/juvi-app/v1/account-deletion` · the only body parser registered is `express.json({ limit:
'10mb', verify })` (`app.ts:46-51`); a repo-wide search for `urlencoded` finds **no**
`express.urlencoded` anywhere in `backend/src` · a plain HTML `<form method="post">` submits
`application/x-www-form-urlencoded` (or multipart if it has a file input) — `express.json` matches
neither, so `req.body` never receives the institution code, identifier or password.

**Why it is a defect:** as written, the Play-mandated public path cannot receive its inputs. The
page has no script to build a JSON `fetch()`, and the backend has no parser for what a plain form
sends — so the endpoint is unimplementable without either a JS submission path (an external script
file in `public/`, which the spec does not mention and AC9's "no inline script" does not address) or
a `express.urlencoded`/multipart parser (unstated, absent). This is security-adjacent: AC8's whole
CSRF defense is written for exactly this form POST, and AC5/AC6's oracle-free behaviour is only
testable once the request shape exists.

**Remedy:** state the request encoding. If the page stays script-free, the spec must add
`express.urlencoded({ extended: false, limit: … })` (scoped to the public route, so the ERP/mobile
JSON parsers are untouched) or accept multipart, and say so in §3.2/§5. If an external script is
intended, say that, drop "plain HTML", and keep `Content-Type: application/json` — then AC9's
no-inline-script constraint should be restated as "an external same-origin script, no inline".

---

## LOW

### L1 — The `request_deletion` audit entry has no stated guard, so repeated public requests can each append one

**Evidence:** Story 2 AC4 — "the **request** (public path only) writes `action: 'request_deletion'`
… **when `deletionRequestedAt` is set**"; §3.5.2 — only the **notification** is suppressed on repeat
("Repeat requests while a request is already pending do **not** re-notify (only the unset → set
transition notifies)"). Nothing states an equivalent transition-only rule for the audit write, and
`createAuditLog` is an unconditional `AuditLog.create` (`shared/audit.ts:60-62`).
**Why:** an authenticated-by-password caller can POST repeatedly while a request is pending; each
call re-sets (or re-records) the request, so at worst each appends another `request_deletion` row —
audit noise, bounded by the per-IP limiter and AC6's non-blocking per-identifier budget, but it
undercuts the "append-only trail is the dependable surface" argument. Not a suppression risk
(duplicates add, never remove).
**Remedy:** say the `request_deletion` entry is written only on the unset → set transition (the same
condition as the notification), or state that repeats are accepted here as they are for the `delete`
entry.

### L2 — `deletionClaimedAt` is never cleared, so AC5's stated stall heuristic mislabels a claimed-then-crashed request

**Evidence:** §3.5.1 — the claim sets `{ $set: { deletionClaimedAt: new Date() } }` and is "not a
lock" (a crash after the claim is retried next tick); §3.5.1 — a stalled sweep "presents as requests
whose age exceeds the grace period and whose `deletionClaimedAt` **stays null**".
**Why:** a request claimed by an executor that then died (or a permanently stopped sweep that had
claimed at least once) carries a non-null `deletionClaimedAt` while `deletionRequestedAt` is still
set and past the deadline — the field AC5's rule keys on says "claimed", not "stalled". The window
is bounded (the hourly retry self-heals when jobs run), so LOW.
**Remedy:** state the detection rule as "`deletionRequestedAt` set and past the deadline" (age
alone), treating `deletionClaimedAt` as informational, or add the claim timestamp to the "age"
comparison (`deletionClaimedAt` older than one cadence).

### L3 — "ERP-admin gated" is broader than the word suggests: `platform: read` is also held by `staff`/`ST-ADM-DIR`, and the sub-domain restriction is not enforced on an undeclared route

**Evidence:** Story 4 AC5 — "admin-gated, `platform`-adjacent admin permission"; `admin/routes.ts:20-37`
uses `authorize('platform', 'read')` with no `opts.subDomain`; `shared/rbac/defaults.ts:155` grants
`{ role: 'staff', personaType: 'ST-ADM-DIR', module: 'platform', action: 'read', … scope: { subDomain:
'communication' } }`; `middleware/authorize.ts:61` runs the sub-domain check only
`if (opts?.subDomain && policy.scope?.subDomain)`.
**Why:** an Admissions Director (ST-ADM-DIR) holding `platform:read` would reach the new endpoint
because the route declares no sub-domain — the same breadth the existing `/accounts` list already
has (`:30`), and the same data class (account ids, no PII). Consistent with the codebase, but the
spec's "ERP admin" understates who can see it.
**Remedy:** if the surface should be admin/principal only, declare `authorize('platform','read',
{ subDomain: <the right one> })` or state that the existing `platform:read` breadth is intended.

### L4 — The sweep scan in §3.5.1 has no batch limit, and the claim loop is not wrapped per row, unlike the cited precedent

**Evidence:** §3.5.1's scan — `JuviAccount.find({ deletionRequestedAt: { $lte: … } }).select(…).lean()`,
no `.limit()`; the precedent it cites bounds every scan (`const BATCH_SIZE = 500` at
`shared/jobs/proposal-expiry-worker.ts:32`, applied at `:38` and `:75`) and wraps each row's claim +
action in a per-row `try/catch` (`:40-68`, `:77-99`), so one bad row cannot abort the tick.
**Why:** an unbounded scan loads the whole backlog into memory, and (as written) a throw inside the
claim loop aborts the remaining rows for that tick. Both are self-healing because the field persists
and the job repeats hourly — robustness, not correctness. LOW.
**Remedy:** state a `BATCH_SIZE` and a per-row `try/catch` on the claim, matching the precedent the
spec already cites as the pattern.

### L5 — Citation and revision drift left by the revision-4 edit

**Evidence:** the spec header still reads "Phase 3, revision 3 (post-GATE-2 fix round)" (`spec.md:3`)
while the body is revision 4, and `gate2-resolution.md` Part C refers to the whole delta as
revision 4; `AuditAction` is cited as `shared/types.ts:26-59` (Story 2 AC4) but the union ends at
`:55`; `lookupInstitutionByCode` is cited as `institution-config.ts:74-81` (Story 3 AC5) but is
`:73-79`; §3.6 cites `admin/routes.ts:22` for "alongside the provisioning run" where `:22` is
`GET /provisioning/runs` (`:23`/`:24` are the provisioning routes; `/accounts` is `:30`).
**Why:** substance is correct in every case, but round 1 was failed partly on asserted-true claims;
a stale revision label and drifted line ranges are exactly the material a GATE-3 audit
cross-references and mis-reports on. LOW.
**Remedy:** bump the header to revision 4; correct the three line ranges.

---

## Round-3 findings — disposition

| Round-3 | Topic | Round 4 |
|---|---|---|
| **M1** | sweep `status` predicate strands a recorded request | **RESOLVED** — no `status` clause in §3.5.1; verified against the query text and `ELIGIBLE_STATUSES` (`JuviAccount.ts:12`). The defect two other validators graded HIGH is closed. |
| M2 | `'request_deletion'` absent from the closed enums | **Resolved** — Story 2 AC4 declares it; §5 lists it with `'account_deleted'`; absence re-verified in `types.ts:26-55` and `audit.ts:27-37,45`. Related residual: L1. |
| M3 | "re-read immediately before deleting" ambiguous vs a last-deleted account row | **Resolved** — replaced by the atomic claim (§3.5.1), which I verified gives a crisp cancel boundary and fails closed. Residual: L2. |
| M4 | non-atomic audit guard can duplicate | **Resolved as accepted.** Judgement below — the call is right. Residual: L1. |
| M5 | pending-deletion detection surface required but unspecified | **Resolved** — Story 4 AC5 + §3.6 own it. Residuals: M1 (where it is declared) and M2 (its scope). |
| L1 | §6 `signInLimiter` "module-private" | **Resolved** — §6 correct; `signInLimiter` exported (`rate-limits.ts:21`), only `limiter` private (`:7`). |
| L2 | `notices/policy.ts` path typo | **Resolved** — `notifications/policy.ts:83` verified. |
| L3 | `spaces/routes.ts:8` vs `:6` | **Resolved** — AC7 cites `:6`; `use(authenticateMobile)` is at `:6`. |
| L4 | sweep scan has no `collegeId`, contradicting §5/AC7 | **Resolved** — §5 + AC7 carve the sweep out as the one sanctioned cross-tenant job. Residual: L4 (no batch limit). |
| L5 | `deletionRequestedVia` not cleared on cancel | **Resolved** — Story 4 AC1 clears both fields. |
| L6 | Story 2 AC4 self-contradiction on the request `entityType` | **Resolved** — request → `'JuviAccountPublicDeletion'`, execution → `'JuviAccount'`, consistent throughout AC4. |

**Judgement on accepting the duplicate audit entry (delta 2).** Accepting the duplicate is the right
security call, and I say so plainly. The threat named in the delta — "an attacker who can trigger
duplicates to obscure a real deletion" — requires two concurrent executors, i.e. the attacker can
already run the sweep (system-level access), with which they could act on the append-only
`AuditLog` far more directly than by racing it. Duplicates **add** rows; they cannot remove, mutate
or suppress the real entry, and the guard still prevents the ordinary single-executor duplicate. The
alternative — a unique partial index on a shared, widely-used model — is wider blast radius than the
defect, and the design's stated priority (a *missing* entry is the failure; noise is not) is the
correct priority for a trail whose job is to prove a deletion happened. The one place the reasoning
does **not** carry is the *request* entry, which has no stated guard and is reachable by any caller
holding valid credentials — that is L1, not a reason to reject the ruling.

---

## Could not verify from this worktree

1. **Whether `/account-deletion.html` and `/api/juvi-app/v1/account-deletion` share an origin.**
   No nginx config is in the repo (`scripts/deploy.sh` names only `$WEB_ROOT`). This decides whether
   AC8's `Sec-Fetch-Site: same-origin` accepts the legitimate POST; on separate hosts the
   `same-origin` variant would reject the real page (a break, not a hole) and the fallback would
   depend on the page's origin being in `ALLOWED_ORIGINS`. Carried from round 3, unchanged — and M3
   now depends on the same topology answer.
2. **`TRUST_PROXY_HOPS`, `ALLOWED_ORIGINS`, `FIREBASE_SERVICE_ACCOUNT_JSON` in a real deployment**
   (all blank/absent here). These decide whether the AC3 limiter key is proxy-degenerate, whether
   AC8's fallback works, and whether §3.5.2's fake-transport path is live.
3. **Whether pm2 runs one instance or many** — decides the residual window for the duplicate audit
   entry (L1) and the in-memory limiter's multiplication. `scripts/deploy.sh:103-112` resolves a
   single process by port/cwd, which suggests one, but no `ecosystem.config.*` exists to confirm.
4. **Whether the shipped page will carry an external script.** If it does, M3's remedy (b) applies
   and the encoding question is moot; nothing in the repo decides it because the page does not exist
   yet.
5. **The Dart client's wipe path (Story 1 AC3/AC4/AC6)** — out of api-security scope; belongs to the
   client-side review.

# GATE 2 — api-security validator report (round 3)

**Feature:** 011 — Juvi account deletion
**Spec under review:** `.sdd/specs/011-account-deletion/spec.md` **revision 3**
**Discovery:** `.sdd/discovery/011-account-deletion/discovery.md` · **Resolution:** `gate2-resolution.md` Part B · **Round 1:** `gate2-api-security.md` · **Round 2:** `gate2-r2-api-security.md`
**Worktree:** `/Users/srinivasarao.kandula/code/juvion_v2/.claude/worktrees/juvi-flutter-shell`

**Verdict: PASS — 0 CRITICAL, 0 HIGH, 5 MEDIUM, 6 LOW.** GATE 2 requires 0 CRITICAL **and** 0 HIGH.

Every claim of live code I could reach was read at the cited `file:line`. No implementation of 011
exists yet (`deletionRequestedAt`, `deleteScoped`, `verifyCredentials`, `deletionVerifyLimiter`,
`DELETION_GRACE_DAYS` all return nothing across `backend/src`, `mobile/lib`, `admin-portal/src`), so
every finding is a defect in the **spec's claims, decisions, or internal consistency**, checked
against the code the spec says it will reuse.

| Severity | Count | Gate effect |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 | **gate met** |
| MEDIUM | 5 | advisory |
| LOW | 6 | advisory |

**One round-2 finding is NOT fully resolved by revision 3** (round-2 **M7**, the audit-action enum) —
stated in full under M2 below. That is the result that matters most here.

The round-2 fail-open root cause (**AS-R2-M1 / AR2-H2 / DL-R2-M2**) **is** genuinely resolved: the
trigger is now the durable field, re-read at execution, and every round-2 mechanism claim about the
sweep verified true against the code (§"What I checked and found clean"). The new MEDIUMs are
narrower: a status filter that can strand a recorded request (M1), the audit action enum (M2), two
concurrency/ambiguity edges on the new sweep (M3, M4), and an unspecified mitigation surface (M5).

---

## What I checked and found clean (verified against source, not restated from the spec)

**The sweep mechanism is real, and the cited precedent is exactly what the spec now says it is.**
`shared/jobs/proposal-expiry-worker.ts` is a recurring DB sweep, not a delayed job:
`expireProposals()` selects due rows at `:35-38` and claims each row atomically with a
status pre-condition at `:42-47` ("Atomic status flip — another sweeper can't double-expire"), and
`registerProposalExpiryQueue()` schedules `queue.add('sweep', {}, { repeat: { pattern: '*/15 * * * *' } })`
at `:126-130`. The spec's `:35-46` / `:126-130` citations are accurate.

**The BullMQ colon rejection is real.** `node_modules/bullmq/dist/cjs/classes/job.js:1073-1076`
throws `Custom Id cannot contain :` unless the id splits into exactly three colon-separated
segments; the old `juvi-account-deletion:<accountId>` (two segments) would have been rejected. The
repo's `_`-separator workaround is at `lead-scoring/enqueue.ts:32-35`. Moot now (no job), but the
round-2 finding was correctly diagnosed.

**`getQueue()` really throws, so round-2 M8's remedy is load-bearing.** `QueueManager.ts:55-59`,
throw at `:57`. `server.ts:20-24` guards registration with `DISABLE_BACKGROUND_JOBS` and a
try/catch that only `console.warn`s, so the queue can genuinely be unregistered. Story 4 AC1 now
forbids queue I/O on the authentication path — correct fix.

**Rate-limiting claims — all four verified.**
- `limiter(max)` is module-private (`rate-limits.ts:7`); the exported limiters are
  `signInLimiter` (`:21`), `institutionLookupLimiter` (`:23`), `receiptsLimiter` (`:29`).
- The disable flag is exactly `E2E_TESTING === '1' || 'true' || NODE_ENV === 'test'`
  (`rate-limits.ts:4-5`).
- No `store` is configured → express-rate-limit's per-process `MemoryStore`; `windowMs: 60_000`.
- `app.ts:23` is verbatim `app.set('trust proxy', process.env.TRUST_PROXY_HOPS ? Number(...) : false)`
  — `TRUST_PROXY_HOPS` is a real env var read there, unset means trust-none.
- `globalRateLimit` skips only the receipts path (`globalRateLimit.ts:9-15`), so the new public route
  also sits under the 100/min per-IP cap.

**CORS is a real allowlist.** `app.ts:28-41`: `ALLOWED_ORIGINS || CLIENT_URL || 'http://localhost:5173'`,
split/trimmed, `origin()` rejects anything not in the list (no-origin allowed, for curl/mobile).
AC8's `Origin` fallback is therefore expressible, and `Sec-Fetch-Site` is a plain request header
(`req.headers['sec-fetch-site']`), so AC8 is implementable on this stack.

**Story 3 AC2's dependency chain is accurate, and the trap it names is real.**
`lookupInstitutionByCode` (`institution-config.ts:73-79`) → `resolveIdentifierToUser`
(`identifier-resolver.ts:10-29`, every branch college-scoped) →
`bcrypt.compare(password, user?.password ?? DUMMY_HASH)` (`auth-service.ts:53`, `DUMMY_HASH` :15,
`User.password` required `models/User.ts:6,24`). `credential-store.ts` exports
`storeCredential`/`revealCredential`/`revealLatestForAccount`/`encryptSecret`/`decryptSecret` and
**no comparison function** — exactly as AC2 says. `signIn` genuinely mints a session and returns
tokens (`auth-service.ts:64-69`, `createSession` `session-service.ts:63-86`), and `signInSchema`
requires a full `device` payload plus an ObjectId `collegeId` (`schemas.ts:6-19`) that a web page
cannot supply. `verifyCredentials` is achievable: the cooldown read/write are inside `signIn`
(`:32-35`, `:41`→`cooldown.ts:26-32`, `:56`) and AC2 explicitly excludes them, so AC6's severance is
a real instruction, not a relabelling. My round-2 **M8/L5 are resolved.**

**Route placement trap is real and specified correctly.** `spacesRouter.use(authenticateMobile)`
(`spaces/routes.ts:6`, not `:8` — see L3) and `v1Router` mounts it last (`routes.ts:25`), after the
ordering comment at `:20-21`. The public precedent exists: `configRouter.get('/institutions/:code', …)`
at `config/routes.ts:7`, inside `/api/juvi-app/v1`.

**Mobile error envelope and the 401 `reason`.** `mobileErrorHandler` spreads `detail` into
`{ error: { ...detail, code, message } }` (`errors.ts:43`); `authenticateMobile`'s `invalid(reason)`
puts the revoke reason in that detail (`authenticate-mobile.ts:30,39`), fed from
`getSessionState` (`session-service.ts:184-202`). So `reason: 'account_deleted'` does reach the
client. The client tolerates it — `api_failure.dart:78` reads the reason as `String?` (no enum
parse), and `sign_in_screen.dart:82-86` switches with a `_ => l.generic` default arm. Story 2 AC2's
"mobile-tolerant handling" requirement is satisfied by construction. **Resolved.**

**Session revocation is write-through and the enum change is real.** `revokeSession`
(`session-service.ts:148-153`) sets `revokedAt`+`revokedReason`, `$unset`s `pushToken`, and writes
`juvi:sess:<sid> = 'revoked:<reason>'` for 900 s; `getSessionState` returns the cached
`'revoked'` before Mongo (`:188-190`), so a `deleteMany` alone would leave a 60 s `'active'` cache
accepted. `RevokeReason`/`REVOKE_REASONS` (`MobileSession.ts:4-10`) are a closed TS union + enum, so
adding `'account_deleted'` is a genuine schema/type change. §5 states it. **Resolved.**

**Notification reality — all three suppression paths verified.** `NotificationDelivery.source.type`
is the closed enum `['notice','class_change']` (`NotificationDelivery.ts:49`), `source.kind` the
closed 5-value enum (`:51`), `source.id` a **required** `Types.ObjectId` (`:50`), with a unique
`(source.type, source.id, source.kind, accountId)` index (`:70`). `policy.ts:79` — `tier === 'urgent'`
is the only bypass; `:83` — `tier_off` → `suppressed`. `sender.ts:120-122` finds devices only via a
live `MobileSession` with a `pushToken`, `:123-126` settles `suppressed/no_device` when there are
none. `transport/index.ts:14-24` selects the fake transport without `FIREBASE_SERVICE_ACCOUNT_JSON`,
`fake.ts:28` returns `{ token, ok: true }` for every token, and `transport/index.ts:29-34` is the
warning that it "reaches no phone". My round-2 **M3/M4 are resolved as disclosed costs.**

**Audit-guard collision — the fix works.** The provisioning entry the guard had to dodge is
`provisioning-service.ts:165-174`, `action: 'create'`. Keying the deletion guard on
`{collegeId, entityType, entityId, action: 'delete'}` cannot match it. **DL-R2-M1 resolved.**
(`createAuditLog` itself is a bare `AuditLog.create` — `audit.ts:60-62` — so the guard is and must be
external; see M4.)

**`deactivateAccount` is accurately characterised.** `provisioning-service.ts:206-214`: sets
`User.isActive = false` (`:210`), `revokeOtherSessions(..., 'deactivated')` (`:211`) — both failure
modes §3.3 names, verbatim. `provisionPerson` defaults `resetPassword = true` at `:94` and rotates
the password on the existing-`User` branch at `:123-132`, matching Story 4 AC3. **Round-1 H3 / AS-H3
remain resolved.**

**Retained/deleted sets.** `JuviEvent.ts:20` (required `accountId`), `NotificationDelivery.ts:47`
(required `accountId`), `JuviAccount.ts:96` is a **non-unique** `{collegeId, userId}` index (AC8's
premise), the `NoticeRecipient` recount pattern §3.1 copies is verbatim at `recipient-service.ts:30-31`,
and the profile-photo deterministic key is real (`people/photo-service.ts:181-184`,
`${prefix}/photo/original.<ext>`).

**The static page is real and costs nothing new.** `admin-portal/public/` holds only `favicon.svg`;
`scripts/deploy.sh:174-185` rsyncs `admin-portal/dist/` into `$WEB_ROOT/releases/<ts>` and atomically
re-points `$WEB_ROOT/current` — so vite copies a `public/` asset to `/account-deletion.html` served
by nginx, with no Express/helmet involvement. §3.2's withdrawal of the helmet argument is correct.

---

## MEDIUM

### M1 — The sweep filters on `ELIGIBLE_STATUSES`, so a request filed by a non-eligible account is recorded and then **never executed**

**Severity: MEDIUM** (arguably HIGH — see "why it is a defect"; I report it MEDIUM because
reachability is bounded, but it is the *same failure direction* round 2 graded HIGH.)

**Evidence:** spec §3.5.1, the sweep query:

```js
const due = await JuviAccount.find({
  status: { $in: ELIGIBLE_STATUSES },
  deletionRequestedAt: { $lte: new Date(Date.now() - DELETION_GRACE_DAYS * 86_400_000) },
})
```

· `backend/src/models/juvi/JuviAccount.ts:12` — `ELIGIBLE_STATUSES = ['onboarding','active']` ·
`:9` — `ACCOUNT_STATUSES = ['onboarding','active','exiting','deactivated','alumni']` ·
`backend/src/modules/juvi-app/accounts/auth-service.ts:60-62` — `signIn`'s post-credential refusal is
only `account.status === 'deactivated' || !user.isActive`; **`exiting` and `alumni` pass sign-in** ·
`backend/src/modules/juvi-app/accounts/provisioning-service.ts:210` — `deactivateAccount` sets both
`account.status = 'deactivated'` (via `transitionAccount`) and `User.isActive = false`.

`ELIGIBLE_STATUSES` is the *membership/sign-in* gate: its only other uses are the Spaces reconcile
and graph loader (`spaces/reconcile-service.ts:133`, `spaces/graph-loader.ts:128,166`) and the
notification fan-out (`notifications/expand-consumer.ts:209`). It is not the deletion gate. The
public path does **not** sign in, and Story 3 AC2's `verifyCredentials` is defined as returning
`{ user, account }` with no stated status exclusion — an extraction of `auth-service.ts:51-59` does
not carry the `:60` deactivated check. So an account in `exiting`/`deactivated`/`alumni` that passes
credential verification gets `deletionRequestedAt` written and is then **invisible to the sweep
forever**.

**Why it is a defect:** §3.5 promises "the deletion completes at the deadline whether or not anyone
responds… the requester is never trapped". The status filter makes that false for a whole class of
accounts, and the failure is silent and fail-open on the exact property this feature exists to
establish (Play-compliance deletion). It is the same shape as round-2 AS-R2-M1 (a recorded but
unexecutable request), which was graded HIGH when the trigger was ephemeral; the difference is only
that the sweep now works for the *eligible* majority. Reachability: `exiting`/`alumni` are not set in
R1 (`grep '\'exiting\''` hits only the model and two zod enums, `admin/schemas.ts:52`,
`accounts/schemas.ts:33`), but `deactivated` is a live status a person can hold while still knowing
their password, and `exiting` becomes live in R4.

**Remedy:** delete the `status` clause. The deletion marker is the only precondition; an account's
status is irrelevant to whether a deletion request it holds should complete. If a status exclusion is
genuinely wanted, say *which* status cannot request deletion and make `verifyCredentials` refuse it
at request time, so a request can never be recorded without an executor. Add a test that seeds an
`exiting` (or `deactivated`) account with a due `deletionRequestedAt` and asserts the sweep deletes it.

---

### M2 — Story 2 AC4's `action: 'request_deletion'` is **not a member of the closed `AuditAction` union**, so the AC is unimplementable as written — **round-2 M7 is only half-resolved**

**Severity: MEDIUM**

**Evidence:** spec Story 2 AC4 — "the **request** (public path only) writes `action:
'request_deletion'`, `entityType: 'JuviAccount'`, when `deletionRequestedAt` is set" ·
`backend/src/shared/types.ts:29-55` — `AuditAction` is a closed string-literal union ending
`… | 'acknowledge' | 'access_denied' | 'ai_score_computed' | … | 'ai_nl_report_query';` — no
`request*` value · `:57,62` — `interface AuditEntry { … action: AuditAction; … }` (so passing the
literal is a **TypeScript compile error**) · `backend/src/shared/audit.ts:27-37` — `AUDIT_ACTIONS`
mirrors that union; `:45` — `action: { type: String, enum: AUDIT_ACTIONS, required: true }` (so even
a cast fails Mongoose validation at runtime) · §5 — lists the closed enums this feature extends and
names **only** `REVOKE_REASONS`/`RevokeReason`.

**Why it is a defect:** this is a round-2 remedy that did not survive — **round-2 M7's remedy was
literally "extend `AUDIT_ACTIONS`"**, and revision 3 adopted the two-event *semantics* M7 asked for
(request entry vs execution entry) while omitting the enum extension the same remedy required.
An implementer following Story 2 AC4 verbatim cannot compile; following it loosely, the first
`createAuditLog({ action: 'request_deletion' })` throws a `ValidationError` on the public path. It
fails closed (the deletion is deferred anyway, so nothing is destroyed), which is why it is MEDIUM,
not HIGH — but the spec's own acceptance criterion is unmeetable, and a GATE-3 audit that
cross-references AC ↔ code will land on it.

**Remedy:** add `'request_deletion'` (and, if cancellation is audited, `'cancel_deletion'`) to the
`AuditAction` union in `shared/types.ts` and the `AUDIT_ACTIONS` mirror in `shared/audit.ts`, and say
so in §5 alongside the `RevokeReason` change. Note `AuditLog.create` validates, so this is not
optional.

---

### M3 — "The executor re-reads `deletionRequestedAt` immediately before deleting" is ambiguous when the account row is deleted **last**, leaving a real window in which a cancellation is overridden

**Severity: MEDIUM**

**Evidence:** spec §3.5.1 — "the executor **re-reads `deletionRequestedAt` on each row immediately
before deleting it**, so a cancellation landing between the scan and the write still wins" · spec §5 —
the order is "**audit intent → revoke sessions (write-through) → reset notice state → delete child
rows → delete the account row last**" · Story 4 AC1 — "Cancellation is **clearing the field**".

"Deleting it" is ambiguous: the account row — the thing the field lives on — is deleted **last**, but
the destructive sequence begins one step earlier (session revoke, notice reset, child deletes). If
"immediately before deleting it" means immediately before the **account-row** delete, then a
cancellation that lands while the session revoke / notice reset / child deletes are running is read
*after* it and the deletion proceeds — the account is destroyed despite a cancellation the owner
believes took effect. If it means immediately before the **first** destructive write, the window
spans the whole sequence (multiple round-trips across up to six collections). Either reading
contradicts the flat claim that "a cancellation … still wins".

**Why it is a defect:** the cancellation is the substantive mitigation round 1 and round 2 built the
grace period on (it is what makes the deferral more than a delay). "Immediately before" is not
precise enough to implement unambiguously, and on the natural reading it is not true. The residual
window is small (seconds), which is why this is MEDIUM, not HIGH — but the spec asserts a property
the wording does not deliver, in the one control the design leans on.

**Remedy:** state that the executor performs a single scoped re-read as its **first** action and
aborts unless `deletionRequestedAt` is still set and still ≥ `DELETION_GRACE_DAYS` old, then runs the
§5 sequence; and state plainly that a cancellation arriving after that read loses (the window is one
sequence long). Better: make the claim atomic by claiming the row
(`JuviAccount.findOneAndUpdate({ _id, collegeId, deletionRequestedAt: { $lte: deadline } }, …)`,
matching the precedent's own "Atomic status flip" at `proposal-expiry-worker.ts:41-47`) so a
cancellation that clears the field before the claim wins and one after it loses, deterministically.
Whichever is chosen, add the cancel-between-scan-and-execution test round-2 M1 asked for.

---

### M4 — Two concurrent sweeps are explicitly possible, and the audit existence guard is a non-atomic check-then-insert with no unique index, so a deletion can be logged twice

**Severity: MEDIUM**

**Evidence:** spec §3.5.1 — the sweep "runs only if background jobs run… the deployment must run the
sweep (**or an equivalent out-of-band cron**)" · spec §5 — "make each step idempotent. `deleteMany`
is idempotent by construction; only the audit insert is not, hence its guard" · spec Story 2 AC4 —
the execution entry is "existence-guarded so a retry after a partial failure does not duplicate it" ·
`backend/src/shared/audit.ts:60-62` — `createAuditLog` is an unconditional `AuditLog.create`; the
guard is a separate caller-side `findOne` · `audit.ts:51-56` — the only AuditLog indexes on
`{entityType, entityId, timestamp}` and a `NoticeAcknowledgement`-partial index, **neither unique on
`{collegeId, entityType, entityId, action}`** · `QueueManager.ts` `registerQueue` creates a `Worker`
per process, and `proposal-expiry-worker.ts:126-130` schedules repeat jobs whose ticks can overlap
across processes.

An out-of-band cron alongside the BullMQ sweep, or two API workers with overlapping ticks, run the
sweep concurrently. The data steps are idempotent as §5 claims (child `deleteMany`s no-op, the
`NoticeRecipient` reset + recount converges), but the audit guard is `findOne` → `create`, which is
not atomic: both runners find nothing, both insert, and the trail records **two** `delete` entries
for one deletion. There is no atomic claim of the account row (contrast the precedent, which does
claim — `:41-47`).

**Why it is a defect:** audit integrity is one of the two fallbacks the design relies on for the
public path (§3.5.2), and §5 explicitly singles out the audit insert as "the" non-idempotent step.
The stated guard does not actually close it under the concurrency the spec itself sanctions. The
blast radius is duplicate audit rows, not data loss, so MEDIUM.

**Remedy:** either (a) add a unique index on `{collegeId, entityType, entityId, action}` (partial to
the two Juvi entity types) and treat E11000 as "already recorded"; or (b) claim the account row
atomically at the top of the sequence (see M3's remedy) so only one runner reaches the audit write;
or (c) state that the sweep must run single-instance (one cron, `concurrency: 1`, one pm2 worker) and
that the out-of-band alternative is mutually exclusive with the BullMQ sweep.

---

### M5 — The "pending-deletion surface" that §3.5.1 makes the *detection* control for a stalled sweep is required but unspecified, and does not exist

**Severity: MEDIUM**

**Evidence:** spec §3.5.1 — "because the consequence here is a stalled deletion rather than a stale
metric, the deployment must run the sweep (or an equivalent out-of-band cron) and an admin-visible
**pending-deletion surface** must exist so a stalled sweep is detectable rather than silent" ·
spec §3.5.2 — "the account carries `deletionRequestedAt`, so a request appears to college staff as a
pending deletion they can act on" · `grep -rni 'pendingdeletion|pending-deletion|deletionRequested'`
across `backend/src`, `admin-portal/src`, `mobile/lib` → **nothing**.

The spec names the surface as load-bearing twice, in the two places it concedes the sweep can stall
(background jobs disabled / Redis down, §3.5.1's own disclosure), but never says where it lives, who
may see it, what it queries, or that it is a deliverable alongside the endpoint. §6's dependency list
does not mention it. An implementer building exactly the enumerated deliverables produces a system
where the *only* detection path for the failure the spec spent a paragraph disclosing is a Mongo
field no UI reads.

**Why it is a defect:** this is the residual of round-2 AS-R2-M1 (fail-open deletion) that revision 3
correctly identified but did not close — it converted a silent failure into a failure that is
"detectable" only if a surface that has not been designed gets built. MEDIUM, not HIGH, because the
underlying deletion is no longer *lost* (the field persists and a later sweep recovers it) — it is
*stalled*, and the stall is currently undetectable by anyone but an operator reading the DB.

**Remedy:** make the surface concrete in the spec — name the page/endpoint (e.g. an admin list on the
existing Juvi admin router filtered `deletionRequestedAt != null`, ordered by that field, behind the
existing admin permission), state that it is in scope for this feature, and add it to §6. If it is
deliberately deferred, say so and say what detects a stalled sweep instead.

---

## LOW

### L1 — §6 states `signInLimiter = limiter(10)` is module-private; it is exported

**Evidence:** spec §6 — "a new, exported `deletionVerifyLimiter` (the `limiter(n)` factory **and
`signInLimiter = limiter(10)` are module-private**)" · `backend/src/modules/juvi-app/middleware/rate-limits.ts:21`
— `export const signInLimiter = limiter(10);`.

Only `limiter` is private (`:7`). Story 3 AC3 states this correctly; §6's parenthetical does not.
Round 1 was failed partly on asserted-true claims, so a false "is private" belongs in the record.
**Remedy:** drop `signInLimiter` from the parenthetical.

### L2 — §3.5.2 cites `notices/policy.ts:83`; the file is `notifications/policy.ts`

**Evidence:** spec §3.5.2 — "a user with `tier_off` suppresses routine notifications
(`notices/policy.ts:83`)" · the actual file is
`backend/src/modules/juvi-app/notifications/policy.ts`, where line 83 is
`if (!settings.tiers[tier]) return { status: 'suppressed', reason: 'tier_off' };` — the **line number
is right, the path is wrong** (`notices/` has no `policy.ts`; `ls` confirms). Substance verified
correct. **Remedy:** fix the path to `notifications/policy.ts:83`.

### L3 — `spaces/routes.ts:8` is not the `authenticateMobile` line

**Evidence:** spec Story 3 AC7 — "`spacesRouter` (which applies `authenticateMobile` router-wide,
`spaces/routes.ts:8`)" · the call is at `spaces/routes.ts:6`; `:8` is
`spacesRouter.get('/channels/:id', ctrl.getChannel)`. The substance (router-wide auth) is correct and
the ordering rule is right. **Remedy:** cite `:6`.

### L4 — The sweep query has no `collegeId`, which contradicts §5's and AC7's "no query runs without it"

**Evidence:** spec §5 — "every query filters by `collegeId`" · Story 2 AC7 — "The deletion is scoped
by `collegeId` — no query runs without it" · spec §3.5.1's sweep query has **no** `collegeId`
(it cannot — it is a cross-tenant system scan).

The sweep is legitimately cross-tenant (as is `proposal-expiry-worker.ts:35-38`), but the spec never
carves it out, so an implementer applying AC7 literally cannot write the sweep, and a GATE-3 audit
matching AC7 against the code will flag the scan. **Remedy:** state in §5/AC7 that the *sweep scan* is
the one deliberate cross-college read, and that every *write* is still `collegeId`-scoped per row
(the row carries it).

### L5 — Cancellation clears `deletionRequestedAt` but not `deletionRequestedVia`, which §3.5.3 still serves on `GET /me`

**Evidence:** spec Story 4 AC1 — "Cancellation is **clearing the field** — nothing else has to be
disarmed" · spec §3.5.3 — `GET /me` "gains `deletionRequestedAt` (nullable ISO date) **and
`deletionRequestedVia`**".

After a cancel, `deletionRequestedAt` is null but `deletionRequestedVia` stays `'public_web'`, so
`/me` returns a non-null `via` with a null timestamp. Harmless to the sweep (it filters on the
timestamp only) and to the banner, but it is a stale field on a client contract. **Remedy:** say the
cancel clears both fields (`$unset`), or state that `via` is only meaningful when the date is set.

### L6 — Story 2 AC4 contradicts itself on the request entry's `entityType`

**Evidence:** spec Story 2 AC4 — the request "writes `action: 'request_deletion'`, **`entityType:
'JuviAccount'`**"; two sentences later — "`entityType` marks the origin (**`'JuviAccount'` vs
`'JuviAccountPublicDeletion'`**) so the two paths are separable in the trail."

The first sentence gives the public-path *request* entry `entityType: 'JuviAccount'`; the second says
the public path is distinguished by `'JuviAccountPublicDeletion'`. Which one the request entry uses
determines what the admin surface (M5) can filter on. No security impact (the entries differ by
`action` either way), but it is exactly the kind of ambiguity that becomes drift. **Remedy:** say
explicitly which `entityType` each of the three entries (request, in-app execution, public execution)
carries.

---

## Round-2 findings — disposition, including the one that did not survive

| Round-2 | Topic | Revision 3 |
|---|---|---|
| H1 (r1) | public path reusing sign-in cooldown | **Resolved** — AC6; key-disjointness re-verified (`cooldown.ts:8-11,13-24`) |
| H2 (r1) | irreversible/silent on password alone | **Resolved** in design — deferral + cancel; residual detection = M5 |
| H3 (r1) | `deactivateAccount` reuse | **Resolved** — §3.3; code re-verified |
| M1 | cancellation only via job removal | **Resolved** — field is the trigger |
| M2 | Redis-only deferred execution | **Resolved** — recurring sweep over the durable field |
| M3 | notification can be suppressed / faked | **Resolved as disclosed** — best-effort stated; all three paths named, all three verified |
| M4 | `NotificationDelivery` closed enums | **Resolved as disclosed cost** — §3.5.2; enums re-verified |
| M5 | AC9 helmet/CSP factually wrong | **Resolved** — argument withdrawn in §3.2 |
| M6 | `trust proxy` unset + in-memory limiter | **Resolved as disclosed** — AC3 names `TRUST_PROXY_HOPS` + shared store as prerequisites |
| **M7** | **audit timing / enum** | **PARTIALLY RESOLVED — see M2.** Semantics fixed (request vs execution), but the `'request_deletion'` action value was added to the AC and **not** to `AuditAction`/`AUDIT_ACTIONS`; the spec nowhere says to extend them. Not resolved. |
| M8 | `getQueue()` throws inside sign-in | **Resolved** — Story 4 AC1, verified `QueueManager.ts:57` |
| L1 | `jobId` colon / test proves nothing | **Resolved** — no job; colon rejection verified in `job.js:1073-1076` |
| L2 | `changePassword` doesn't clear | **Resolved** — Story 4 AC1 third path |
| L3 | repeat requests re-notify | **Resolved** — notify only on unset→set |
| L4 | paused-institution branch | **Resolved** — AC5; see note below |
| L5 | `verifyCredentials` "read-only" too narrow | **Resolved** — AC2 excludes `getCooldown`/`recordFailure` |

*Note on round-2 L4:* AC5's operative instruction ("the pre-credential branches are collapsed to one
generic failure") is sufficient, but its stated justification — "`lookupInstitutionByCode` returns
null for unknown, inactive and Juvi-disabled alike … so this collapse holds **by construction**" — is
imprecise: `institution-config.ts:73-79` nulls `!doc`, `collegeStatus !== 'active'` and `!enabled`,
but a **paused** college still returns a full view (`paused` is a separate flag, `:24`). The collapse
therefore still rests on the explicit branch AC5 requires, not on the helper. No oracle results
either way (an implementer who adds no paused branch is more permissive, not leakier), so this stays a
note rather than a finding.

---

## Could not verify from this worktree

1. **Whether `/account-deletion.html` and `/api/juvi-app/v1/account-deletion` are the same origin.**
   No nginx config is in the repo (`scripts/deploy.sh` names only `$WEB_ROOT`). This decides whether
   AC8's `Sec-Fetch-Site: same-origin` accepts the legitimate form POST; if the two are on different
   hosts, the `same-origin` variant **breaks the public path** and the `Origin` variant depends on the
   page's origin being in `ALLOWED_ORIGINS`.
2. **`TRUST_PROXY_HOPS`, `ALLOWED_ORIGINS`, `FIREBASE_SERVICE_ACCOUNT_JSON` in any real deployment**
   (all blank/absent here). These decide whether M6's limiter key is proxy-degenerate, whether AC8's
   `Origin` fallback works, and whether §3.5.2's fake-transport path is live in production.
3. **Whether pm2 runs one instance or many** — decides M4's probability and the in-memory limiter's
   multiplication. `scripts/deploy.sh:103-112` resolves a single process by port/cwd, which suggests
   one, but no `ecosystem.config.*` exists to confirm.
4. **The Dart client's wipe path (Story 1 AC3/AC4/AC6)** — out of api-security scope; belongs to the
   client-side review. I did verify the pieces this round touched: the reason is read as a tolerant
   `String?` (`api_failure.dart:78`) and the switch has a default arm (`sign_in_screen.dart:82-86`).

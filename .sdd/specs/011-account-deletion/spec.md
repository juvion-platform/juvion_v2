# Feature Spec — Juvi account deletion (011)

Phase 3, revision 5 (post-GATE-2 fix round, 2026-10-10). Supersedes nothing; extends the Juvi
mobile app (S01–S05) already on `main`.

Revision 5 folds in the round-4 validator findings (all three PASS: 0 CRITICAL + 0 HIGH). Its
changes are enumerated in `gate2-resolution.md` Part D; the two conflicts between validators that
round 4 produced (whether cancellation clears `deletionClaimedAt`; whether `Sec-Fetch-Site` or the
`Origin` allowlist is primary) are **ruled on there**, and the rulings are what the text below now
states.

**Discovery:** `.sdd/discovery/011-account-deletion/discovery.md`
**Validator reports:** round 1 `gate2-{api-security,architecture,data-layer}.md`; round 2
`gate2-r2-{api-security,architecture,data-layer}.md`; round 3
`gate2-r3-{api-security,architecture,data-layer}.md`; round 4
`gate2-r4-{api-security,architecture,data-layer}.md` (all three PASS)
**Resolution:** `gate2-resolution.md` — Part A (rev 1→2), Part B (rev 2→3), Part C (rev 3→4),
Part D (rev 4→5, incl. the round-4 rulings)

**Product decisions taken 2026-10-10:** build it (do not rely on the out-of-scope argument); the
college may re-provision afterwards.

## 1. Problem & Motivation

Google Play's User Data policy requires that an app which lets users create an account offer
**two** deletion paths — in-app *and* a public web resource — and says plainly that
*deactivation does not qualify* as deletion. Juvi has neither. A Play listing for
`in.juvion.juvi` is blocked until the Data safety questions can be answered truthfully, and
answering them requires the capability to exist.

The hard part is not the endpoint. It is that **a Juvi account is not the identity**: a
`JuviAccount` projects a `Person`/`User`/`Student` the college owns, and the `User` is the same
credential used for the ERP web login (`provisioning-service.ts:124`). Deletion therefore cannot
mean deleting the person. Getting this wrong either breaks ERP logins or destroys records the
college must retain.

A second hard part: **the public path verifies with the person's password, and that password is
the shared ERP credential.** A password obtained by credential stuffing therefore becomes
*destructive* rather than merely readable. The public path is designed around that (§3.5).

## 2. User Stories & Acceptance Criteria

### Story 1 — A student deletes their Juvi account from the app

As a Juvi user, I can delete my Juvi account from Settings, having been told exactly what goes
and what stays.

- **AC1** Settings shows a *Delete my Juvi account* row. Opening it shows a confirmation screen
  that names, in two explicit lists, what is deleted (the Juvi account, every signed-in device,
  channel memberships, notification delivery records, app analytics events, and **their own**
  seen/acknowledged state on notices) and what the college **retains** (academic, attendance,
  fee and exam records; the notice audience record for notices already published; the profile
  photo, which is the person's photo in the ERP).
- **AC2** The destructive action needs a deliberate second step — a typed confirmation phrase —
  and is not reachable by one tap.
- **AC3** On confirm, the app calls the server; **only after the server confirms** does it run a
  dedicated deletion wipe — not `signOut()`. The wipe is `SessionController._wipe()` (which clears
  the secure-store session and the drift tables `kvCache` — including the cached `me` document —
  `pending_actions` and `analytics_events`) **plus** `ReceiptQueue.clear()` (a new method — the
  queue has only `read`/`add`/`remove` today), `SecureStore.clearPendingLink()`, and removal of
  `juvi.last_account` (which stores `<collegeId>:<accountId>`). It then lands on sign-in.
- **AC4** If the call fails or the device is offline, **nothing is deleted locally**, the app
  stays signed in, and it shows the failure. A half-deleted client is never a possible state.
  The delete path must **not** call `authRepository.signOut()` or `pushRegistration.unregister()`
  — both would 401 against an account that no longer exists.
- **AC5** The copy is localized through `context.l10n`, like the rest of the app.
- **AC6** A `401 SESSION_INVALIDATED` on any request (e.g. a second device opened before the
  deletion) triggers the same local wipe, not merely a bounce to sign-in. Another device's cached
  copy is therefore best-effort cleared on its next launch — the server cannot reach it.
- **AC7** Settings and the app shell surface a pending public-web deletion request as a banner
  with a *Cancel* action, driven by `deletionRequestedAt` on `GET /me` (§3.5.3).

### Story 2 — The server deletion is complete, self-scoped, and leaves a trail

- **AC1** `DELETE /api/juvi-app/v1/me/account` acts only on the caller's own account, resolved
  from the JWT by `authenticateMobile`. No account or person id is ever read from the request
  body.
- **AC2** Every `MobileSession` for the account is **hard-deleted**, so all devices lose access
  immediately and no refresh-token hash survives. Each session is first revoked with the
  write-through `revokeSession(sid, 'account_deleted')` (which also `$unset`s `pushToken` and
  writes the Redis cache), **then** the rows are deleted — `deleteMany` alone cannot write through
  the 60 s `juvi:sess:<sid>` active cache, so a deleted-but-still-cached session would otherwise
  be accepted while the account row survives. `juvi:acct-touch:<accountId>` is deleted too.
  `'account_deleted'` is added to **both** `REVOKE_REASONS` and the `RevokeReason` TypeScript union
  (`MobileSession.ts`) — the enum is closed and schema-visible, and neither `'sign_out'` nor
  `'deactivated'` describes this event. Note it reaches the client: the revoke reason surfaces in
  the mobile `401` payload, so the app's error handling must tolerate the new value.
- **AC3** `Person`, `User`, `Student`/`Faculty`/`Staff` and all ERP records are untouched. A test
  asserts the `User` still exists afterwards with an unchanged password hash **and `isActive: true`**
  — i.e. the person's ERP web login still works. This assertion is required on **both** the in-app
  and the public deletion paths.
- **AC4** Two audit entries, because the public path's request and its execution are different
  events:
  - the **request** (public path only) writes `action: 'request_deletion'`, `entityType:
    'JuviAccountPublicDeletion'`, when `deletionRequestedAt` is set;
  - the **execution** writes `createAuditLog({ collegeId, entityType: 'JuviAccount', entityId:
    <account id>, entityName, action: 'delete', changes: [...] })`, from the executor, at the
    moment the deletion actually runs — so a request that is later cancelled never leaves a
    `delete` entry claiming a deletion that did not happen.

  `'request_deletion'` is a **new action**, and the spec says so rather than assuming it: it is
  absent from the `AuditAction` union (`shared/types.ts:26-55`) and from its `AUDIT_ACTIONS` Mongoose
  mirror (`audit.ts:27-36`, enforced at `:45`) — whose own comment names the union as the source of
  truth. Both must be extended (precedent for a Juvi-specific action: `'acknowledge'`), or the write
  is a compile error and a runtime `ValidationError`. This is the same class of closed-enum change as
  `'account_deleted'` in AC2, and §5 lists both.

  The **request** entry, like the notification (§3.5.2), is written on the **unset → set transition
  only** — `createAuditLog` is an unconditional `AuditLog.create` (`audit.ts:60-62`), so this is a
  caller-side guard: a repeat public request while one is already pending re-asserts
  `deletionRequestedAt` but appends nothing. Without that rule an authenticated-by-password caller
  can append an unbounded run of `request_deletion` rows (bounded only by the per-IP limiter), which
  is exactly the "the trail is the dependable surface" argument turned into noise. The *execution*
  entry is the one where a duplicate is accepted (below).

  In both, the actor is the **account id**, never the submitted identifier or e-mail (the codebase
  hashes identifiers precisely so they never land in Redis or logs — `cooldown.ts:7`), and
  `entityType` marks the origin (`'JuviAccountPublicDeletion'` for the request, `'JuviAccount'` for
  the execution) so the two paths are separable in the trail. The execution entry is written
  **first**, as an intent record, existence-guarded so a retry after a partial failure does not
  duplicate it — and the guard key **must include `action: 'delete'`**, because a
  `{collegeId, entityType, entityId}` guard also matches the pre-existing provisioning `create`
  entry for the same account (`provisioning-service.ts:165-174`) and would silently suppress the
  deletion record entirely. The guard is a non-atomic findOne→create with no unique index, so under
  concurrency a **duplicate** `delete` entry is possible; that is accepted (§3.5.1) — a duplicate is
  noise, a missing entry is not.
- **AC5** After deletion the account's still-valid access token is rejected with 401 — the
  account row is gone, so `authenticateMobile` cannot resolve it.
- **AC6** The endpoint is idempotent: a second call returns a defined 401/404-shaped result, not
  a 500.
- **AC7** Every *request-path* query is scoped by `collegeId` — no query reached from a route runs
  without it. The single sanctioned exception is the **sweep** (§3.5.1): it is a system job that is
  cross-tenant by design (it must find due requests in every college), and it must not be reachable
  from any request path — it calls the same deletion service, which itself takes `collegeId` from
  each claimed row. Everything else holds: because 010's scope-plugin does **not** hook
  `deleteMany`/`updateMany` (`scope-plugin.ts:73`) and is inert on the mobile stack (which sets
  `req.mobile`, not `req.authScope`), every deletion write goes through one
  `deleteScoped(Model, { collegeId, ... })` helper, and each model has a test that seeds two
  colleges and asserts the other college's rows are untouched.
- **AC8** The account row(s) are removed by `{ collegeId, userId }` (the `userId` comes from the
  resolved account), not by a single `_id` — `{collegeId, userId}` is not uniquely indexed
  (`JuviAccount.ts:96`), and the credential verified is the user's, so the whole account set for
  that credential goes. Child rows go by the collected account ids.

### Story 3 — Someone who uninstalled the app can still request deletion

- **AC1** A **public** page (no authentication) is reachable at a stable URL, references the app
  and developer name, and prominently features the deletion pathway. It must work for a user who
  no longer has the app installed. It is a **static asset**, `admin-portal/public/account-deletion.html`,
  which vite copies verbatim into `admin-portal/dist/` and the deploy publishes to the web root —
  so it is served by nginx at `/account-deletion.html`, outside React Router entirely, with no
  auth context and no backend HTML. (Plan-time check: the deploy's nginx block must serve an
  existing file before any SPA fallback, which is the normal `try_files $uri $uri/ /index.html`
  shape. `admin-portal/public/` currently holds only `favicon.svg` and this is the first page
  there. Because nginx serves it, the page's framing headers come from **nginx**, not from the
  backend's `helmet()` — see AC9.)
  The page carries **no script at all** (AC9), so it submits a plain `<form method="post">` —
  i.e. `application/x-www-form-urlencoded`. The endpoint must therefore accept that body: the
  backend registers only `express.json` today (`app.ts:46`), so the public route needs its own
  scoped `express.urlencoded({ extended: false })` (§3.2, §5). Without it the form's fields never
  reach `req.body` and the Play-mandated path is unimplementable.
- **AC2** Identity is verified with **institution code + identifier + password**. The dependency
  chain is exactly: `config/institution-config.lookupInstitutionByCode` (code → `collegeId`, since
  an institution *code* is not an ObjectId) → `identifier-resolver.resolveIdentifierToUser` →
  `bcrypt.compare(password, user?.password ?? DUMMY_HASH)` against `User.password`.
  **`credential-store.ts` is not involved** — it is the AES vault for issued temporary passwords
  and has no verification function. **`auth-service.signIn` is not called** — it creates a
  `MobileSession` and returns tokens, and requires a `device` payload a web page cannot supply.
  The shared logic is extracted from `signIn` as a read-only
  `verifyCredentials(collegeId, identifier, password): Promise<{ user, account }>` that creates no
  session, returns no tokens, and — explicitly — **does not call `getCooldown`/`recordFailure`**
  (read-only means no session/token effects *and* no effect on the sign-in lockout budget).
  The public path must never create a `MobileSession`.
- **AC3** The verification endpoint is rate-limited with a **dedicated, exported**
  `deletionVerifyLimiter` (the `limiter(n)` factory in `middleware/rate-limits.ts` is module-private,
  so it must be exported or wrapped). Its 429 is asserted in a unit test that constructs the
  limiter directly — the Playwright job sets `E2E_TESTING=1`, which disables limiters, so the e2e
  env cannot assert it. The limiter is only as good as its key: it must be a proxy-aware key. In
  production this **requires `TRUST_PROXY_HOPS` to be set** (unset = trust none, `app.ts:23`, so
  nginx fronts every request and the key becomes the proxy — one shared bucket that throttles the
  whole campus on a Play-mandated path). That one is a genuine operator prerequisite.

  The store is **not**, and revision 5 corrects that: `limiter(n)` (`rate-limits.ts:7-18`) passes **no
  `store`**, every limiter in the app therefore uses express-rate-limit's default in-process
  `MemoryStore`, and there is no environment variable that reaches a store — the only dependency is
  `express-rate-limit` itself. So "a shared store" is a **code change**, not a deployment toggle, and
  it buys nothing while the API runs as the single pm2 process `scripts/deploy.sh` restarts by name.
  Multi-worker hardening (add a store package, select it on `REDIS_URL`, and accept that it changes
  every limiter in the app, not just this one) is therefore **out of scope** here and recorded in §4
  — with the condition stated rather than the risk hidden: if the API is ever run as more than one
  worker, each process gets its own budget and a restart resets it, so this must be revisited at the
  same time as that deploy change.
- **AC4** A successful verification performs **the same deletion** as Story 2 — one code path, not
  two — but the public path is **deferred, not immediate** (§3.5). The response is identical
  whether or not the identifier exists.
- **AC5** Wrong credentials return the same generic failure as sign-in; the page never reveals
  whether an identifier exists. The pre-credential branches are collapsed to one generic failure,
  so the page also reveals nothing about an institution's paused/disabled state —
  `lookupInstitutionByCode` returns null for unknown, inactive and Juvi-disabled alike
  (`institution-config.ts:73-79`), so this collapse holds by construction rather than by an extra
  branch.
- **AC6** The public verification does **not** use sign-in's per-identifier cooldown. That cooldown
  is a hard block (`COOLDOWN_MAX_FAILURES = 5` in 10 minutes, keyed `cooldownKey(collegeId,
  identifier)` at `cooldown.ts:8-11`, read *before* any credential check) — reusing it would let an
  unauthenticated attacker lock a victim out of the **app** by submitting five bogus deletion
  requests, and let a user's own typo lock them out. The public path uses a separate key namespace
  (`juvi:deletion-verify:<collegeId>:<hash-of-identifier>`) with a **non-blocking** budget:
  attempts are counted and backed off / tarpitted, never hard-blocked, so this endpoint can never
  deny sign-in. The two budgets are key-disjoint by construction (`getCooldown` reads only
  `juvi:login-fail:*`).
- **AC7** The verification endpoint is a public route mounted in `v1Router` **before**
  `spacesRouter` (which applies `authenticateMobile` router-wide, `spaces/routes.ts:6`), carrying
  the same explicit ordering comment the receipts path already has (`routes.ts:20-25`).
  `spacesRouter` must not be modified. A test asserts the route answers **without** an
  `Authorization` header. It stays inside `/api/juvi-app/v1` so it inherits the mobile JSON error
  envelope rather than the ERP `errorHandler`.
- **AC8** The public POST rejects cross-site submission, and **every presented signal must agree**
  (round-4 ruling — the "which is primary" dispute is settled by requiring both, not by ordering
  them):
  - `Sec-Fetch-Site`, **when present**, must equal `same-origin` (a `same-site`, `cross-site` or
    `none` value is rejected);
  - `Origin` (or, absent that, `Referer`) **when present** must be in the same allowlist CORS uses;
  - a request presenting **neither** signal is rejected.
  So neither header is a "fallback" for the other: Fetch Metadata support is additive, and a
  non-browser client (no `Sec-Fetch-Site`, no `Origin`) is out by construction. CORS alone does not
  stop a form POST from being *processed* — the endpoint must actively reject, not merely omit CORS
  headers. (Plan-time dependency: the production same-origin topology — nginx arrangement and
  `ALLOWED_ORIGINS` — could not be verified from source and must be confirmed before this AC is
  testable. It no longer decides *whether the page works*, because the `Origin` check is
  unconditional-when-present rather than a fallback.)
- **AC9** The page is plain HTML with **no script at all** — not inline, and no external file — so it
  does not depend on the backend's CSP at all: it is served by nginx, which `helmet()` never touches,
  and it submits its form the way HTML does natively (AC1). Anything the page needs (framing
  protection, its own headers) is an **nginx** concern, and the page must keep zero dependency on
  backend middleware. This also means the round-1 dismissal of clickjacking via helmet's
  `frame-ancestors` does **not** apply to this page; if framing protection is wanted it must be
  configured at nginx.

### Story 4 — The owner can stop a deletion they did not ask for, and the college can give access back

- **AC1** A public-path deletion request is recorded on the account
  (`JuviAccount.deletionRequestedAt`, `deletionRequestedVia: 'public_web'`) and is **cancellable**
  before it executes. Cancellation is **clearing the request fields** — `deletionRequestedAt` and
  `deletionRequestedVia` both go back to unset — and nothing else has to be disarmed, because the
  field is the only trigger (§3.5). The cancellation deadline is the atomic claim (§3.5.1), and it
  is **enforced, not merely described**: the clear is itself one atomic conditional update whose
  filter includes `deletionClaimedAt: null`, so a clear landing **after** the executor has claimed
  the row matches nothing and is refused (the deletion is already committing), while one landing
  before it matches and wins. Writing it this way also settles the round-4 disagreement about the
  stale claim marker: a claimed row simply cannot be cancelled, so `deletionClaimedAt` can never
  survive alongside a cleared `deletionRequestedAt`. The UI must state that boundary rather than
  implying an unlimited window.

  All three clear paths below use **the same conditional shape**:

  ```js
  await JuviAccount.updateOne(
    { _id: accountId, collegeId, deletionRequestedAt: { $ne: null }, deletionClaimedAt: null },
    { $unset: { deletionRequestedAt: 1, deletionRequestedVia: 1, deletionClaimedAt: 1 } },
  )
  ```

  Three deliberate properties, all load-bearing:
  - `deletionClaimedAt: null` is in **this** filter (a cancel gate) and must **never** be added to
    the **sweep's** claim filter (§3.5.1). Conditioning the claim on it would mean a row claimed by
    a crashed executor is never re-claimed — the fail-open class rounds 2 and 3 failed on.
  - `$unset`, not `$set: null`, is what keeps the fields *absent* — which is what §3.5.1's sparse
    `{ deletionRequestedAt: 1 }` index assumes (see §5's field-lifecycle constraint). The `$unset`
    of `deletionClaimedAt` is a no-op under this filter (it only matches when the field is already
    absent) and is written for one reason: the three fields go back to absent together, so a reader
    never has to ask which of them a clear touches.
  - a no-match is **not** silently swallowed on the explicit path: the authenticated cancel returns
    **409 `DELETION_NOT_CANCELLABLE`** when the filter matched nothing while `deletionRequestedAt`
    is still set (i.e. the executor has claimed it), so the UI can say *too late* instead of
    implying success. The two best-effort paths (sign-in, password change) ignore the no-match —
    there, "nothing to clear" and "already cleared" are the same outcome.

    `DELETION_NOT_CANCELLABLE` is a **third declared closed-enum addition** (with `'account_deleted'`
    and `'request_deletion'`): `MobileErrorCode` is a closed union (`errors.ts:5-13`) and does not
    contain it, and `STATUS_TO_CODE` (`:35-37`) has no 409 row, so an `AppError(409, …)` would reach
    the client as `INTERNAL`. §5 lists all three.

  Three paths clear the fields:
  - the explicit *Cancel deletion* action in Settings and on the in-app banner (Story 1 AC7), backed
    by `DELETE /api/juvi-app/v1/me/account/deletion-request` (authenticated; declared in §3.6);
  - a successful sign-in, as a safety net (possessing the password again, days later, is
    independent evidence of ownership; a stuffer re-authenticating cancels only their own request);
  - a successful password change.

  The sign-in and password-change clears are **best-effort**: they are wrapped so that a failure
  to clear can never fail sign-in, and they must not require Redis or any queue to be reachable
  (no `getQueue()` on the authentication path — with background jobs disabled an unregistered
  queue throws, `QueueManager.ts:55-59`, which would 500 every sign-in).
- **AC2** The owner is notified that a deletion is pending — best-effort, see §3.5.2. Revision 1
  had the public path delete **silently**, which is the property this AC removes; it does not
  promise delivery.
- **AC3** A later admin provisioning run recreates the account as a fresh `onboarding` account,
  with a new temporary credential. (Note for the operator: `provisionPerson` defaults to
  `resetPassword: true` (`provisioning-service.ts:94`), so re-provisioning also **rotates the
  person's ERP password** — legitimate, and the mechanism by which a stuffed credential is
  invalidated, but not surprising once stated.)
- **AC4** No standing "do not re-provision" marker is written, and the reconciler is not taught to
  skip anything (discovery: it never recreates accounts anyway).
- **AC5** `GET /api/juvi-app/admin/accounts/pending-deletion` (admin-gated) returns every account
  **in the caller's own college** with a pending `deletionRequestedAt` — id, requested-at,
  `deletionRequestedVia`, and `deletionClaimedAt` — so staff can see a request that a stalled sweep
  has not executed (§3.5.1). The query is `{ collegeId: req.collegeId, deletionRequestedAt: { $ne:
  null } }` (the ERP convention, `admin/accounts-service.ts:28`), **not** a global scan: Story 2 AC7
  and §5 make the sweep the *only* sanctioned cross-tenant read, and this route is reachable from a
  request path, so it is not covered by that carve-out. `collegeId` is **not** echoed per row — the
  caller's college is the only one it can see. This view is the **detection control** for the
  sweep's operational dependency, which is the only reason that dependency is acceptable. Its
  detection rule is **age alone** (`deletionRequestedAt` past the grace period), with
  `deletionClaimedAt` informational: a request claimed by an executor that then died carries a
  non-null claim while still being stalled, so keying on "claimed is null" would mislabel it.

  Two things about this surface are stated rather than implied:
  - it is gated exactly like its siblings — `adminRouter.use(authenticate)` (`admin/routes.ts:18`)
    plus `authorize('platform', 'read')`, the gate the existing `GET /accounts` list already uses
    (`:30`). That is **broader than "admin"**: `platform: read` is also held by `staff`/`ST-ADM-DIR`
    (`defaults.ts:155`), whose grant is sub-domain-scoped to `communication` — and no Juvi admin
    route declares a sub-domain, so `authorize`'s sub-domain check is skipped (`authorize.ts:61`).
    The Admissions Director can therefore read this list, as they can already read `/accounts`.
    Narrowing it for this one route while `/accounts` and the rest stay open would be theatre; the
    real fix is module-wide (annotate the Juvi admin routes with a sub-domain and fail closed, the
    upgrade path `authorize.ts:52-59` already documents) and is **out of scope** here. The exposed
    fields carry no PII (account ids, timestamps, a via enum) — §3.5.2's "the identifier never lands
    in the trail/logs" posture is preserved.
  - it carries **no generated-client contract**: §3.6 says where it is (and is not) declared.

## 3. Design Decisions

### 3.1 What deletion covers

**Hard-deleted** (Juvi-owned rows with no institutional meaning), each as a `collegeId`-scoped
`deleteMany` through the `deleteScoped` helper (Story 2 AC7):

| Model | Key | Notes |
|---|---|---|
| `JuviAccount` | `{ collegeId, userId }` | The row goes last (see §5) |
| `MobileSession` | `{ collegeId, accountId: { $in: accountIds } }` | After a write-through revoke (Story 2 AC2) |
| `ChannelMembership` | `{ collegeId, accountId }` | Recomputed by the reconciler after re-provision |
| `JuviProvisionedCredential` | `{ collegeId, accountId }` | The issued temp-credential record |
| `NotificationDelivery` | `{ collegeId, accountId }` | Per-account delivery + `openedAt`/`status` (`NotificationDelivery.ts:47`) |
| `JuviEvent` | `{ collegeId, accountId }` | Server-side analytics, incl. `notice.seen`/`notice.acknowledged` (`JuviEvent.ts:20`) |

`NotificationDelivery` and `JuviEvent` were both **omitted in revision 1**. Leaving them is not
neutral: they carry a required `accountId` pointing at a row that no longer exists, cannot be
cleaned by any later call (the endpoint is self-scoped and its JWT is dead), and make the app's
own disclosure ("local analytics are wiped") false while the identical event stream survives
server-side. A repo-wide sweep confirms exactly six collections carry `accountId`; all six are in
the set, and the only other reference to `MobileSession` is `NoticeRecipient.ack.sessionId`, which
the reset below clears.

**Reset, not deleted** — `NoticeRecipient`. The affected notice ids are **collected before** the
update (the update nulls `accountId`, which is the filter):

```js
const rows = await NoticeRecipient.find({ collegeId, accountId: { $in: accountIds } })
  .select('_id noticeId addedLater').lean();
const snapshotNoticeIds = [...new Set(rows.filter(r => !r.addedLater).map(r => String(r.noticeId)))];

await NoticeRecipient.updateMany(
  // Narrow by _id (not by accountId): this is what stops a fan-out racing the reset
  // from having its newly-set accountId nulled by this pass.
  { collegeId, _id: { $in: rows.map(r => r._id) } },
  { $set: { accountId: null, receivedAt: null, seenAt: null,
            dismissedAt: null, remindedAt: null, ack: null } },
)
```

then recount each affected notice's cached counter, exactly as activation does
(`recipient-service.ts:30-31`):

```js
const onJuvi = await NoticeRecipient.countDocuments({ collegeId, noticeId, addedLater: false, accountId: { $ne: null } });
await Notice.updateOne({ _id: noticeId, collegeId, status: { $ne: 'publishing' } }, { $set: { 'counts.onJuvi': onJuvi } });
```

Filtering by `_id: { $in: rows }` (rather than by `accountId`) also stops a notice fan-out racing
the reset from having its newly-set `accountId` nulled by this pass.

Revision 1 **deleted** these rows, which was wrong. The row is the notice's *audience snapshot*,
created at publish for every audience member whether or not they are on Juvi (`accountId` is
`default: null`), and it is keyed `{noticeId, personId}` — one row per *person*, not per account.
Deleting it permanently lowered `Notice.counts.onJuvi`, destroyed the audience record for a notice
the college retains, left the surviving `'NoticeAcknowledgement'` `AuditLog` entry dangling, and
left a re-provisioned person unrestorable (`backfillAddedLater` only covers `addedLater: true` rows
from the last 30 days). The reset clears the person's Juvi-owned state — which is what Story 1 AC1
promises — while the institutional row survives, and the reach board, which buckets live from these
rows, correctly moves the person to `not_on_juvi`.

`receivedAt` is reset because it is the "on Juvi at" marker, null on every account-less row. The
`archived`, `deadline`, `ackRequired`, `kind`, `labels` and `addedLater` fields are **not** reset:
they describe the notice, not Juvi membership.

**Retained, and disclosed in the privacy policy:** `Person`, `User`, `Student`/`Faculty`/`Staff`,
and every ERP module's own records. Also the **profile photo** — a photo uploaded through the app
is written as the person's ERP photo under a deterministic key
(`${prefix}/photo/original.<ext>`, `people/photo-service.ts:181-184`), so it *is* the retained
person record, not app-local imagery. Revision 1 left this unmentioned; a Play Data-safety answer
that skips it is inaccurate.

Two residues are accepted and disclosed rather than chased: `Channel.memberCount` stays stale until
the next Spaces reconcile recomputes it, and an `accountId` can persist inside
`OutboxEvent.payload` (a `Mixed` field) for the outbox's 30-day done-TTL.

### 3.2 Where the public web page lives

**The page is a static asset:** `admin-portal/public/account-deletion.html`, copied by vite into
`admin-portal/dist/` and published by `scripts/deploy.sh` to `$WEB_ROOT/current`, so nginx serves
it at `/account-deletion.html`.

Revision 1 recommended the backend serve the HTML, and rejected a static page by treating it as if
it were a React SPA route. They are not the same thing, and the static asset has **no** new attack
surface: nginx already serves the SPA's unauthenticated HTML and JS; only the API calls require
auth. The backend alternative would be the first HTML surface on a JSON API with no view engine and
no `res.sendFile`.

The helmet/CSP argument revision 2 carried forward is **wrong for this page and is withdrawn**:
`helmet()` is backend middleware, and nginx serves this file without it ever running. The page keeps
zero dependency on backend middleware (Story 3 AC9); its headers and any framing protection belong
to nginx.

**The verification endpoint stays on the API**, as a public JSON route in the style of the existing
unauthenticated `configRouter.get('/institutions/:code', ...)` (`config/routes.ts:7`) — which lives
at `/api/juvi-app/v1/institutions/{code}`, i.e. *inside* `/api`, not at the top level as revision 1
claimed. The endpoint is `POST /api/juvi-app/v1/account-deletion` (mount point per Story 3 AC7).

**The endpoint accepts a form-encoded body**, and that is a required piece of the design rather than
an implementation detail. The page has no script (Story 3 AC9), so its submission is a native
`<form method="post">` — `application/x-www-form-urlencoded`. The backend registers only
`express.json` today (`app.ts:46-51`), so the public route must mount
`express.urlencoded({ extended: false })` **on that route only**, leaving the ERP and mobile JSON
parsers untouched. (The alternative — an external `public/*.js` posting JSON — was considered and
rejected: it would make a Play-mandated deletion page depend on a script executing, and on a page
whose whole point is to work for someone who no longer has the app, "no script" is the stronger
property. Story 3 AC1/AC9 and §5 state the constraint from both ends.)

### 3.3 Deletion is not "deactivate"

The policy is explicit that freezing/deactivating does not satisfy it, so `ACCOUNT_STATUSES`
(`JuviAccount.ts:9`) is deliberately **not** extended with a `deleted` value. The row goes.

The same argument extends to the *helper*: **`deactivateAccount()` must not be reused.**
`provisioning-service.ts:206-214` sets `User.isActive = false` — breaking the shared ERP login,
exactly the failure §1 warns against — and only soft-revokes sessions (sets `revokedAt`, `$unset`s
`pushToken`), violating Story 2 AC2. It is the nearest existing helper and the obvious wrong turn;
the deletion is a distinct path that hard-deletes and never touches `User`. Story 2 AC3's
`isActive` assertion is the guard, and it is required on **both** paths.

### 3.4 Retention disclosure

Because academic and financial records are retained for regulatory reasons, the privacy policy
must say so explicitly, with a deletion section that the Play listing can link to. Drafting the
policy text is part of this feature's deliverables; publishing it is not (it needs a hosted URL).
The disclosure must state: what is deleted (§3.1 hard-deleted set + the reset fields), what is
retained (ERP records, the notice audience record, the profile photo), and that a public-web
request completes after the grace period (§3.5).

### 3.5 The public path is deferred, not immediate

The in-app path deletes **immediately**: possession is proven by a live authenticated session plus
a typed confirmation phrase (Story 1 AC2). The public path has only a password, and that password
is the *shared ERP credential* — so a single stuffed password would otherwise become an
unauthenticated, irreversible, silent account destruction, restorable only by an admin-triggered
provisioning run.

A public request therefore **schedules** the deletion. The requester is never trapped by not having
the app: the deletion completes at the deadline whether or not anyone responds.

**The two paths can cross, and the rule is that the in-app one wins.** A person who requested
deletion on the web and then reinstalls and deletes from Settings is deleted **immediately** — the
in-app call does not wait out the grace period, does not refuse with a 409, and does not consult
`deletionClaimedAt`. The grace period exists solely to protect a person whose *shared ERP password*
was stuffed; a live authenticated session plus a typed confirmation phrase is strictly stronger
evidence of ownership than the window was there to substitute for, so the window collapses the moment
it arrives. (Stated here because round 1 of GATE 3 found this behaviour derivable from "the in-app
path deletes immediately" but not *stated*, and a rule about an irreversible action should not have
to be inferred.) The converse never arises: the public path is not reachable for an account whose
deletion is already in flight, because the sweep is deleting the rows the verification would need.

#### 3.5.1 The mechanism: a recurring database sweep, with the field authoritative

Execution is a **recurring database sweep**, and `shared/jobs/proposal-expiry-worker.ts` is its
precedent for the **pattern** — a recurring pass over due rows (`:35-38`) that claims each row
atomically (`:41-47`) before acting on it. (Its *recurrence registration* is deliberately **not**
copied: that file still uses the older interval-keyed `repeat: { pattern: '*/15 * * * *' }` form
(`:126-130`), and the cadence bullet below explains why the sweep uses the module's stable-id
`upsertJobScheduler` instead. Pattern yes, registration form no.)

`JuviAccount.deletionRequestedAt` is the **single source of truth**, and it is the **sole**
predicate — the sweep selects every account with the field set and past its deadline, with **no
`status` filter**. `ELIGIBLE_STATUSES` (`['onboarding','active']`, `JuviAccount.ts:11-12`) is a
*membership/sign-in* predicate — its own comment says so — and filtering on it here would exclude
any account that is (or becomes) `exiting`/`deactivated`/`alumni` while a request is pending, which
is reachable: `signIn` refuses only `deactivated` (`auth-service.ts:60-62`), so an `exiting` account
can record a request, and `deactivateAccount` fires automatically from the admissions
`W01 cancel_m12` workflow (`workflow.handlers.ts:2009`) and the admin console
(`admin/accounts-controller.ts:13`). A deactivation inside the 7-day window must not silently cancel
the deletion. This is the same fail-open defect round 2 rated HIGH, reintroduced by revision 3's own
query — round 3 caught it three times, independently — and the fix is the predicate removed. The
scan also bounds and isolates itself the way its own precedent does (`proposal-expiry-worker.ts:32`
`BATCH_SIZE = 500`, applied `:38`, and a per-row `try/catch` at `:40-68` so one bad row cannot abort
the tick):

```js
const BATCH_SIZE = 500;
const due = await JuviAccount.find({
  deletionRequestedAt: { $lte: new Date(Date.now() - DELETION_GRACE_DAYS * 86_400_000), $ne: null },
}).select('_id collegeId userId deletionRequestedAt').limit(BATCH_SIZE).lean();
```

`$ne: null` is redundant with the `$lte` Date bound (Mongo brackets the comparison by type, so a
null never matches a Date bound) but it is written anyway: it is the same guard the claim below
carries, and it is what makes the query's intent readable as "the field is *set* and past due"
rather than relying on the reader to know Mongo's type-bracketing rule. A backlog larger than
`BATCH_SIZE` is drained over successive hourly ticks, which is the right trade for a job whose
failure mode is a stall, not a loss.

**The cancellation deadline is an atomic claim, not a re-read.** The account row is deleted *last*
(§5), so a plain re-read before that leaves the whole revoke → reset → child-delete window in which
a cancellation is overridden. The executor claims each row exactly the way the cited precedent
claims a proposal — one atomic conditional update that both re-asserts the field and marks the row
(`proposal-expiry-worker.ts:41-47`):

```js
for (const doc of due) {
  try {
    const claimed = await JuviAccount.findOneAndUpdate(
      { _id: doc._id, deletionRequestedAt: { $lte: deadline, $ne: null } },
      { $set: { deletionClaimedAt: new Date() } },
      { new: true },
    );
    if (!claimed) continue;   // cancelled between the scan and the claim → skip
    await runAccountDeletion(claimed);   // the one deletion service (§6)
  } catch (err) {
    console.error('[juvi-account-deletion] sweep failed for', String(doc._id), err);
    continue;   // the field is still set → the next tick retries this row
  }
}
```

**The claim filter names two fields, and `deletionClaimedAt` must never become a third.** Story 4
AC1's cancel filter is the one place that field is named as a condition (`deletionClaimedAt: null`);
this filter must not copy it. If the claim required an unclaimed row, a row claimed by an executor
that then crashed would never be re-claimed and the deletion would be silently stranded — the same
fail-open class rounds 2 and 3 failed on. Because this filter cannot see the field, a crashed claim
self-heals on the next tick.

Semantics, stated so they are implementable rather than approximate: a cancellation that clears
`deletionRequestedAt` **before** the claim wins (it is enforced by the cancel's own filter, Story 4
AC1, not by prose); one arriving after it loses, because the deletion is already committing. The
claim is deliberately **not a lock** — it does not remove the row from the next tick's filter — so a
sweep that crashes mid-deletion is retried (the field is still set), which is what keeps the
mechanism fail-closed rather than trading one silent failure for another. The sweep queue runs
`concurrency: 1`.

A second executor (a stray out-of-band run, or two pm2 workers) therefore costs duplicate *work*,
never a double deletion of consequence, because every step is idempotent. The one visible artifact is
a possible duplicate `delete` audit entry: the existence guard in Story 2 AC4 is a non-atomic
findOne→create with no unique index, so a race can insert twice. This is **accepted and recorded
here rather than papered over** — an append-only audit's duplicate is noise, whereas a *missing*
entry is the failure the intent-first write exists to prevent; adding a unique partial index on the
guard key is an optional plan-time hardening, not a correctness requirement.

The sweep's cross-tenant query needs an index on the field alone, and there is none today — every
`JuviAccount` index is `collegeId`-prefixed (`JuviAccount.ts:95-99`) — so the plan adds
`schema.index({ deletionRequestedAt: 1 }, { sparse: true })` (sparse, because the field is absent on
almost every account). Until it exists the sweep is a collection scan, which is tolerable at this
collection's size but is a real (if low-severity) cost, not a free one.

**That index only works if the field's *lifecycle* is absent ↔ Date, never explicit `null`** (round-4
ruling; the constraint is repeated in §5). The schema must **not** declare `deletionRequestedAt`
with `default: null`, and no path may `$set` it to null:
- set → a `Date`, on the request (public path);
- clear → `$unset` (Story 4 AC1's cancel), not `$set: null`.
A sparse index only includes documents where the field *exists*, so writing an explicit `null` on
every account makes the "sparse" index a full-collection index — precisely the cost sparse was
chosen to avoid, on a field that is absent on almost every account. This is a **performance and
consistency trap, not a correctness one**: MongoDB's type bracketing excludes `null` from both the
scan's `$lte: <Date>` bound and the claim's `$ne: null`, so no account is wrongly deleted either
way. `deletionClaimedAt` and `deletionRequestedVia` follow the same absent-not-null lifecycle, for
the same reason — one rule for all three fields, so no reader has to remember which is which.

**A regression test is part of this AC, not an optional plan nicety.** The round-3 defect (a
`status` predicate silently stranding a recorded request) was a *query-shape* defect that no other
assertion would have caught, so the plan carries two tests that pin the shapes above:
1. seed an account with `deletionRequestedAt` past the deadline whose `status` is **not** in
   `ELIGIBLE_STATUSES` (e.g. `exiting`), run the sweep, and assert the deletion **ran** — this is the
   test that fails the moment any status predicate is reintroduced;
2. seed a due account, cancel it (field `$unset`) between the scan and the claim, and assert the
   deletion **did not** run.
Both run against the exported sweep function directly, the way `proposal-expiry-worker.ts:29`
exports `expireProposals` for its own tests, so neither needs a live Redis.

Revision 2 instead used a delayed BullMQ job as the trigger, which three independent validators
rejected, for reasons worth keeping written down:

- an ephemeral Redis job as the trigger means a flushed queue, `DISABLE_BACKGROUND_JOBS`, or a
  swallowed `registerQueue` failure makes the deletion **silently never run** — and `removeOnFail`
  would block re-enqueue, so nothing recovers it;
- with the job as the trigger, cancellation is "remove the job", so a cancellation that fails to
  remove it (or a job already in flight) still deletes — the durable field was decorative;
- the `jobId` that design needed (`'juvi-account-deletion:<accountId>'`) is **rejected by BullMQ**,
  which throws on a custom id containing a colon (`bullmq/dist/cjs/classes/job.js:1073-1076`); the
  repo's own workaround uses `_` (`lead-scoring/enqueue.ts:32-35`).

With the sweep, all three disappear: there is no job to lose, no job to disarm, and no `jobId`.
Cancellation is clearing the field (Story 4 AC1) and needs no queue at all. A failed or skipped run
is self-healing — the field persists and the next run picks it up.

**Operational dependency, stated plainly:** the sweep runs only if background jobs run. That is the
same dependency every other recurring worker in this repo already has (`fee-alerts-cron`,
`proposal-expiry`, `llm-usage-weekly`), with the same failure mode — but because the consequence
here is a stalled deletion rather than a stale metric, this feature must not leave a stall silent.
Two things make it observable and are therefore **in scope**, not advisory:

- **A fixed cadence.** The sweep repeats hourly. The schedule is registered with
  `queue.upsertJobScheduler(JUVI_ACCOUNT_DELETION_SWEEP_ID, { every: 3_600_000 }, { name: 'sweep',
  opts: { removeOnComplete: true, removeOnFail: true } })` — the **stable-id** form the Juvi module's
  own worker already uses (`reconcile-worker.ts:48-52`), not the interval-keyed
  `add(…, { repeat })` form the older `proposal-expiry-worker.ts:126-130` still uses. The comment
  at `reconcile-worker.ts:43-47` — above the `upsertJobScheduler` call, inside the registration
  function rather than at the top of the file — records exactly why: the interval-keyed form left the
  previous schedule running when the interval changed. Precision is one interval, not to the second:
  a deletion executes within an hour of its deadline. Both the scheduler id and the queue name are
  named constants — the queue name is a new entry in the closed `QUEUE_NAMES` registry
  (`QueueManager.ts:113-146`, Juvi names at `:141-142`), e.g. `JUVI_ACCOUNT_DELETION:
  'juvi_account_deletion'`; the plan adds it there rather than passing a bare string.
- **A pending-deletion surface**, owned by a numbered AC (Story 4 AC5) and named in §3.6:
  `GET /api/juvi-app/admin/accounts/pending-deletion`, admin-gated, returning every account **in the
  caller's college** with `deletionRequestedAt` set (id, requested-at, via, claimed-at). The
  detection rule is **age**: a stalled sweep presents as requests past the grace period —
  `deletionClaimedAt` is informational, because a request claimed by an executor that then died
  carries a non-null claim while still being stalled. Visible to staff rather than invisible. This
  surface is the *detection* control for a stalled sweep; without it the operational dependency above
  is unmonitored, which is why it is specified here rather than mentioned.

`DELETION_GRACE_DAYS = 7`. A 7-day window is the industry norm for exactly this reason and keeps
the deletion a *completion* of the request rather than an indefinite deferral; the Play listing's
Data-safety answer must state that the deletion completes within the stated period. **This is the
one place this feature's scope grew beyond revision 1** — it is the fix for the silent-destruction
finding, and the cheaper alternative (immediate deletion with notification only) leaves the
destructive half of that risk in place.

#### 3.5.2 Notifying the owner — best-effort, and honest about it

The load-bearing controls are the **grace period** and the **ERP-visible record**: the account
carries `deletionRequestedAt`, so a request appears to college staff as a pending deletion they can
act on, and Story 4 AC3's re-provision path is how a stuffed credential is invalidated. Everything
else is best-effort, and the spec does not promise delivery:

- **a push** to the account's live devices, and
- **an in-app banner** on next launch (Story 1 AC7), driven by `deletionRequestedAt` on `GET /me`.

Why best-effort must be stated rather than assumed:

- the notification stack is notice-shaped. `NotificationDelivery.source.type`/`kind` are closed
  enums and `source.id` is a required ObjectId (`NotificationDelivery.ts:16,50` — `:70` is the
  uniqueness index, not the field), so a
  non-notice notification needs new enum members and a defined `source.id`. The plan owns adding
  them; this is not a drop-in reuse.
- a person with **no live device** gets `suppressed/no_device` (`sender.ts:120-124`) and no push —
  and that person is precisely the public path's audience, so the push reaches the owner *least*
  reliably in the case the feature exists for.
- a user with `tier_off` suppresses routine notifications (`notifications/policy.ts:83`).
- without `FIREBASE_SERVICE_ACCOUNT_JSON` the transport is a no-op that returns `ok: true`
  (`transport/fake.ts:23-30` — `FakePushTransport.send` maps every token to `{ ok: true }`, selected
  in place of FCM at `transport/index.ts:18-22`) — the push "succeeds" and reaches no phone.

So the banner, the ERP record and the audit trail are the dependable surfaces, and the push is an
extra. Repeat requests while a request is already pending do **not** re-notify (only the
unset → set transition notifies), so the notification cannot be used as a harassment channel. The
**same transition** guards the `request_deletion` audit entry (Story 2 AC4): repeating a request
re-asserts `deletionRequestedAt` and appends nothing, so the trail is one row per genuine request
rather than one per POST.

#### 3.5.3 `deletionRequestedAt` on `GET /me`

`GET /me` gains `deletionRequestedAt` (nullable ISO date) and `deletionRequestedVia`. This **is a
response-schema change** and must be costed: it is a nullable field on an existing endpoint, which
is exactly the case the raw-Dio R61 workaround exists for (`mobile/README.md` "Toolchain notes"),
and `me_repository.dart` already reads `/me` over raw Dio. The client must parse a real `null`
(per R61, mock `null` as `null` in tests), and the OpenAPI document's `Me` schema is updated with
it (§3.6).

### 3.6 What must be re-declared in the contract

**Two mobile endpoints and one response-field change** — and, separately, one ERP-admin route that
is deliberately **not** in the mobile contract:

- `DELETE /me/account` — `{ operationId: 'deleteAccount', method: 'delete', path: '/me/account',
  auth: true, status: 204, errors: [401] }`, regenerated like the existing bodyless endpoints
  (`document.ts:147` `signOut`, `:154` `revokeDevice`, `:176` `clearPushToken`).
- `DELETE /me/account/deletion-request` (cancellation, Story 4 AC1) — `{ operationId:
  'cancelAccountDeletion', method: 'delete', path: '/me/account/deletion-request', auth: true,
  status: 204, errors: [401, 409] }`. Without this the *Cancel deletion* action of Story 4 AC1 has
  no endpoint behind it. The 409 (`DELETION_NOT_CANCELLABLE`) is the claimed-too-late case
  (Story 4 AC1) — a defined failure, not a silent 204 that lies about having cancelled.
- the `Me` schema gains nullable `deletionRequestedAt` and `deletionRequestedVia` (§3.5.3).

The **cancellation** entry is a mobile route, alongside the two existing bodyless endpoints on
`accountsRouter` (`accounts/routes.ts:20-21`); the Dart client is regenerated for those entries.
Revision 1 sanctioned skipping the whole contract via the raw-Dio R61 workaround, but R61 exists
only for **nullable fields in a response**; a 204 delete has no response body, so the workaround
does not apply and skipping the contract would just leave the mobile contract incomplete. Raw Dio
stays reserved for the genuine R61 cases — which now includes the nullable `deletionRequestedAt` on
`Me`.

**`GET /api/juvi-app/admin/accounts/pending-deletion` is NOT declared in the mobile OpenAPI
document — there is nowhere to declare it.** The only OpenAPI generator in the repo is
`modules/juvi-app/openapi/document.ts`, and it *is* the mobile contract by construction: `servers:
[{ url: '/api/juvi-app/v1' }]`, a single `tags: ['mobile']`, and a route list containing no admin
route — so it emits one `MobileApi` class whose every method resolves under `/api/juvi-app/v1` and
carries the mobile bearer scheme. The admin router is mounted at `/api/juvi-app/admin`
(`routes.ts:28-29`), a **sibling** of `/v1`, and its `authenticate` rejects mobile-typed tokens
outright. Declaring `path: '/admin/accounts/pending-deletion'` there would generate
`/api/juvi-app/v1/admin/accounts/pending-deletion` — a 404 — and a Dart method that can never
authenticate. Revision 4 did exactly that; this removes it.

So the ERP-admin surface is declared **here, in prose, as the contract**: a plain Express route on
`adminRouter` — `adminRouter.get('/accounts/pending-deletion', authorize('platform', 'read'),
listPendingDeletions)` (`admin/routes.ts:30` is the `/accounts` precedent it sits beside), gated by
`authenticate` + `authorize()` and served under the ERP error envelope (`admin/routes.ts:41-42`) —
with **no generated client**. The admin portal calls it the way it calls its other ERP endpoints
(hand-written service calls), and there is no ERP OpenAPI document to extend. This does not weaken
Story 4 AC5: the AC fixes the route, the query, the fields and the gate; §3.6 is where its *contract
home* is stated, and the honest answer is that its home is prose plus a test, not a generator. If a
machine-readable ERP contract is ever wanted it needs its own document with its own base URL and its
own auth scheme — a new artifact, out of scope here.

## 4. Out of Scope

- Deleting the ERP account, `Person`, `Student`, or any academic/financial record.
- A retention/legal-hold engine; the retained set is fixed by design, not configurable per college.
- A general-purpose public web surface — this adds exactly one static page and one public JSON
  endpoint, nothing more.
- iOS parity work beyond the shared Dart code (there is no iOS toolchain on this machine).
- Publishing the privacy policy, or any Play Console configuration.
- Web-based deletion for staff/faculty through the institutional ERP — only the Juvi mobile
  account is in scope.
- Adding `deleteMany`/`updateMany` to the 010 scope-plugin's hook list. Worth a ticket (Story 2 AC7
  is unenforced without it), but it is a codebase-wide change, not this feature's.
- **Narrowing the Juvi admin surface's RBAC breadth.** `platform: read` is held by `staff`/
  `ST-ADM-DIR` and the sub-domain check is skipped on routes that declare none
  (`defaults.ts:155`, `authorize.ts:61`), so Story 4 AC5's list is readable by an Admissions
  Director, exactly as the existing `GET /accounts` already is. The fix is module-wide (annotate
  every Juvi admin route with a sub-domain and fail closed — `authorize.ts:52-59`), and doing it for
  one route only would be theatre. AC5 records the exposure instead.
- Scrubbing `accountId` out of `OutboxEvent.payload` (a `Mixed` field with a 30-day done-TTL), and
  recomputing `Channel.memberCount` eagerly. Both are disclosed residues (§3.1).
- **A shared (out-of-process) store for the rate limiters.** Every limiter uses express-rate-limit's
  in-process `MemoryStore` (`rate-limits.ts:7-18` passes no `store`, and no env var reaches one), so
  making it shared is a code + dependency change that would alter *every* limiter in the app, not just
  `deletionVerifyLimiter`. It is unnecessary while the API is the single pm2 process
  `scripts/deploy.sh` restarts, and it must be revisited if that ever changes (Story 3 AC3 states the
  condition).

## 5. Constraints & Non-Functional Requirements

- Multi-tenancy: every request-path query filters by `collegeId`; the deletion is scoped to the
  caller's own account from the JWT (`authenticateMobile`), never an id from the body. The one
  exception is the sweep (§3.5.1), a cross-tenant system job that is not reachable from any route
  (Story 2 AC7).
- Mobile error envelope: `MobileApiError(status, code, message)` (`errors.ts`), not the ERP's
  `AppError`. The public route must stay inside `/api/juvi-app/v1` to inherit it (Story 3 AC7).
- The Dart client is generated from the OpenAPI document (§3.6).
- The public page must not import authenticated middleware; the endpoint must be rate-limited and
  must not touch the sign-in cooldown (Story 3 AC6).
- Deletion must be atomic enough that a crash cannot leave the account row gone while sessions
  survive. The order is: **audit intent → revoke sessions (write-through) → reset notice state →
  delete child rows → delete the account row last.**
  - Account **last** because the endpoint is self-scoped: if the account row went first the caller
    could never authenticate again to retry the remaining steps, stranding them forever.
  - Revision 1 justified the same order with the wrong invariant ("sessions alive + account gone"),
    which is already harmless — it is a 401 either way. The state that ordering must actually
    protect against is *sessions deleted while the account still exists*, which is why the
    write-through revoke in Story 2 AC2 is required and not merely tidy.
  - The audit entry goes **first** as an intent record, guarded by an existence check keyed on
    `{collegeId, entityType, entityId, action: 'delete'}`: last, a throw after the destructive steps
    would lose the only record that the deletion happened, and a guard without `action` collides
    with the provisioning `create` entry (Story 2 AC4).
- The backend test harness is not a replica set, so no multi-document transactions: use
  `deleteMany` in a deterministic order and make each step idempotent. `deleteMany` is idempotent by
  construction; only the audit insert is not, hence its guard (Story 2 AC4).
- **Three closed enums are extended, and all three are declared here** — none is discovered at
  implementation time:
  1. `REVOKE_REASONS` + the `RevokeReason` union (`models/juvi/MobileSession.ts:4-10`) gain
     `'account_deleted'` (Story 2 AC2). The enum is schema-visible, and neither `'sign_out'` nor
     `'deactivated'` describes this event.
  2. the `AuditAction` union (`shared/types.ts:26-55`) **and** its `AUDIT_ACTIONS` Mongoose mirror
     (`audit.ts:27-36`, enforced at `:45`) gain `'request_deletion'` (Story 2 AC4) — both halves, or
     it is a compile error here and a runtime `ValidationError` there;
  3. `MobileErrorCode` (`modules/juvi-app/errors.ts:5-13`) gains `'DELETION_NOT_CANCELLABLE'`
     (Story 4 AC1 / §3.6), so the 409 is a defined mobile code rather than an `AppError` that
     `STATUS_TO_CODE` (`:35-37`, no 409 row) would report as `INTERNAL`. Adding a 409 row to
     `STATUS_TO_CODE` is optional — the route throws `MobileApiError` directly — but if the code is
     added the row should follow, so the two stay consistent for any future `AppError`-shaped 409.
- **Field lifecycle — absent, never explicit `null`.** `deletionRequestedAt`,
  `deletionRequestedVia` and `deletionClaimedAt` are *set to a value* or *`$unset`*; no path
  `$set`s any of them to `null`, and the schema declares none of them `default: null`. This is not
  stylistic: §3.5.1's sparse `{ deletionRequestedAt: 1 }` index assumes absence, and an explicit
  `null` written on every account makes a *sparse* index index every account — exactly the cost
  sparse was chosen to avoid, on a field that is absent on almost every account. It is a
  **performance and consistency trap, not a correctness one**: MongoDB's type bracketing excludes
  `null` from both the scan's `$lte: <Date>` bound and the claim's `$ne: null`, so no account is
  wrongly deleted either way (§3.5.1 states the same thing at length). The two transitions the
  feature keys on are `absent → Date` (a request; Story 2 AC4's and §3.5.2's notify/audit guard) and
  `Date → absent` (a cancel; Story 4 AC1).
- **The public route's body parser is scoped to it.** `express.urlencoded({ extended: false })` is
  mounted on the `POST /api/juvi-app/v1/account-deletion` route only (Story 3 AC1/AC9, §3.2) — the
  app-level `express.json` (`app.ts:46-51`) and the ERP/mobile JSON parsers stay untouched, so no
  other surface gains a form-encoded input path.
- No authentication path may depend on Redis or a registered queue being reachable: the
  cancellation clears in Story 4 AC1 are best-effort and must never fail a sign-in.

## 6. Dependencies

- `authenticateMobile` (`middleware/authenticate-mobile.ts`) — caller identity.
- `config/institution-config.lookupInstitutionByCode` — institution code → `collegeId` (Story 3
  AC2). **Not** `credential-store.ts`; **not** `auth-service.signIn` (§3.2, Story 3 AC2).
- `identifier-resolver.resolveIdentifierToUser` + `bcrypt.compare` against `User.password` — a
  read-only `verifyCredentials` extracted from `signIn`, excluded from the cooldown path.
- `accounts/cooldown.ts` — read it to know what **not** to reuse; the public path needs its own
  non-blocking, separately-namespaced budget (Story 3 AC6).
- `middleware/rate-limits.ts` — a new, exported `deletionVerifyLimiter`. The `limiter(n)` factory is
  module-private, but `signInLimiter = limiter(10)` **is** exported (`:21`); the public limiter
  follows that shape and is exported too so the 429 unit test can construct it (Story 3 AC3).
- `shared/audit.ts` `createAuditLog` — the trail (Story 2 AC4).
- `shared/jobs/proposal-expiry-worker.ts` — the **pattern** for the recurring sweep (§3.5.1): due
  rows → atomic claim → idempotent action → scheduled repeat; and the reason its `expireProposals`
  is exported (`:29`) is the same reason the sweep's own function is — so the two regression tests
  in §3.5.1 can call it directly without a live Redis. The sweep itself is a Juvi concern
  and belongs with the module's own workers, not in `shared/jobs/`, registered from `server.ts`
  alongside the others (`server.ts:9-10`, `:31-40`).
- `modules/juvi-app/spaces/reconcile-worker.ts` — the **recurrence form** the sweep follows:
  `upsertJobScheduler(<stable id>, { every }, …)` (`:48-52`), with the comment at `:43-47`
  explaining why the older interval-keyed `add(…, { repeat })` form is not used.
- `shared/queue/QueueManager.ts` — `registerQueue`/`getQueue`, and a **new named entry** in the
  closed `QUEUE_NAMES` registry (`:113-146`, Juvi names at `:141-142`) for the sweep's queue;
  worker registration is gated at `server.ts:20` on `DISABLE_BACKGROUND_JOBS !== 'true'` (§3.5.1).
- `express.urlencoded` — mounted **on the public deletion route only** (Story 3 AC1/AC9, §3.2, §5).
  There is no `urlencoded` parser registered anywhere in `backend/src` today; `app.ts:46-51`
  registers `express.json` and nothing else.
- the Juvi accounts module owns the **one deletion service** — called by the sweep and by both
  endpoints (in-app delete, public delete) — together with the `deleteScoped(Model, { collegeId, ... })`
  helper (Story 2 AC7). One code path, three callers.
- `models/juvi/*` — the deletion set, `JuviAccount.deletionRequestedAt`/`deletionRequestedVia`/
  `deletionClaimedAt`, the sparse `{ deletionRequestedAt: 1 }` index (§3.5.1), and
  `REVOKE_REASONS`/`RevokeReason`.
- `notices/recipient-service.ts` — the reset + recount pattern (§3.1).
- Play Console Help, "Understanding Google Play's app account deletion requirements" — the policy
  this satisfies.

# 011 — Juvi account deletion (Play-mandated)

> Implements `.sdd/specs/011-account-deletion/spec.md`, **revision 5**. **GATE 2 is met** — round 4
> returned 0 CRITICAL / 0 HIGH on all three validators (architecture, api-security, data-layer), and
> every revision-5 edit was then confirmed against live code (22/22 claims; see
> `gate2-resolution.md` Part D and its closing status). The spec is the binding authority; this plan
> is its argument. Where the two disagree, the spec wins and this file is wrong.

## 0. Context for a fresh session

The account-deletion gap is the only Google Play blocker for the Juvi Android app that is a real
code change. Play requires **two** paths — an in-app one and a public web URL — and is explicit that
deactivation does not qualify. Everything hard about this feature comes from the second path: it is
authenticated by the *shared ERP password*, so a single stuffed credential would otherwise become
unauthenticated, irreversible, silent account destruction. The spec's answer is a **7-day grace
period** with deferred execution, cancellable by the owner, and an ERP-visible record so a stall is
detectable.

Three things about the state of the repo that this plan assumes, all verified in source:

- `backend/src/models/juvi/JuviAccount.ts` today has **five** `collegeId`-prefixed indexes and none
  on any deletion field (`:95-99`).
- `SecureStore.wipeAll()` (`mobile/lib/core/storage/secure_store.dart:105-109`) is a **3-key
  allowlist** — `_access`, `_refresh`, `_college`. It does **not** clear `juvi.pending_link`
  (`:27`) or `juvi.last_account` (`:28`). Story 1 AC3's explicit calls are therefore load-bearing,
  not belt-and-braces.
- `db.wipe()` (`mobile/lib/core/storage/app_database.dart:243-247`) deletes exactly `kvCache`,
  `pendingActionRows`, `analyticsEvents` — the three drift tables AC3 names.

## 1. Goal

Ship all of: the in-app delete (Settings, typed confirmation, wipe-on-server-confirm), the public web
deletion request at a stable URL, the cancellable 7-day grace period, the one deletion service both
paths share, the owner notification, and the operator's detection surface — so the Juvi app can clear
Play's account-deletion requirement.

## 2. Where it lives

**Backend** (`backend/src/`)

| Path | Role |
|---|---|
| `models/juvi/JuviAccount.ts` | `deletionRequestedAt` / `deletionRequestedVia` / `deletionClaimedAt` + sparse index |
| `models/juvi/MobileSession.ts` | `RevokeReason` / `REVOKE_REASONS` += `'account_deleted'` |
| `shared/types.ts` | `AuditAction` += `'request_deletion'` |
| `shared/audit.ts` | `AUDIT_ACTIONS` mirror += `'request_deletion'` |
| `modules/juvi-app/errors.ts` | `MobileErrorCode` += `'DELETION_NOT_CANCELLABLE'` |
| `modules/juvi-app/accounts/deletion-service.ts` | **new** — the one deletion service + `deleteScoped` helper |
| `modules/juvi-app/accounts/deletion-sweep-worker.ts` | **new** — recurring sweep, claim, scheduler id |
| `modules/juvi-app/accounts/me-routes.ts` *(or the existing `accounts/routes.ts`)* | the two authenticated `/me/account*` deletes |
| `modules/juvi-app/accounts/public-deletion-routes.ts` | **new** — `POST /v1/account-deletion` + its limiter mount |
| `modules/juvi-app/accounts/auth-service.ts` | extract read-only `verifyCredentials`; best-effort clears |
| `modules/juvi-app/middleware/rate-limits.ts` | export `deletionVerifyLimiter` (AC3 — IP-keyed, hard 429) |
| `modules/juvi-app/accounts/deletion-verify-budget.ts` | **new** — the per-identifier non-blocking budget (AC6 — tarpit, never block) |
| `modules/juvi-app/admin/routes.ts` + `admin/accounts-service.ts` | `GET /accounts/pending-deletion` |
| `modules/juvi-app/accounts/me-service.ts` | `/me` gains `deletionRequestedAt`, `deletionRequestedVia` |
| `modules/juvi-app/routes.ts` | mount the public router **before** `spacesRouter` |
| `modules/juvi-app/openapi/document.ts` | two deletes + `Me` fields |
| `shared/queue/QueueManager.ts` | `QUEUE_NAMES.JUVI_ACCOUNT_DELETION` |
| `server.ts` | register the sweep where the other workers are registered |

**Mobile** (`mobile/`): `lib/features/me/settings_screen.dart`, `lib/core/session/session_controller.dart`,
`lib/core/push/receipts.dart`, `lib/core/storage/secure_store.dart`, `lib/core/models/models.dart`
(the local freezed `Me` — **not** the generated `wire.Me`), `lib/core/repos/me_repository.dart`,
`lib/app/l10n/app_en.arb`.

**Portal** (`admin-portal/`): a pending-deletions page + service, and `public/account-deletion.html`.

## 3. Reuse ledger

| Reused unchanged | New |
|---|---|
| `shared/jobs/proposal-expiry-worker.ts` — the **pattern**: due scan → atomic claim → idempotent action (`:29`, `:32`, `:38`, `:40-68`) | `deletion-service.ts` (one service, three callers) |
| `spaces/reconcile-worker.ts:48-52` — the **recurrence form** (`upsertJobScheduler`, stable id) | `deletion-sweep-worker.ts` |
| `notices/recipient-service.ts:20-31` — reset + recount, byte-for-byte | the public JSON route + its scoped `urlencoded` |
| `accounts/cooldown.ts` — read only, to know what **not** to reuse | `deletionVerifyLimiter` + its separate non-blocking key namespace |
| `config/routes.ts:7` — the shape of an unauthenticated Juvi JSON route | the static `account-deletion.html` |
| `admin/accounts-service.ts:28` — the `collegeId`-scoped query precedent | `GET /accounts/pending-deletion` |
| `accounts/auth-service.ts` `signIn` — the credential-check chain, extracted read-only | `verifyCredentials` |
| `accounts/routes.ts:20-21` — bodyless-endpoint route shape (`:20` DELETE, `:21` POST) | `DELETE /me/account`, `DELETE /me/account/deletion-request` |

**No new models.** `JuviAccount` gains three fields; nothing else is added to the schema layer.

## 4. Review focus

The five classes this feature will meet that no AC enumerates. Each gets a test in the task named
beside it — not a note, a test.

1. **Reinstalled-app deletion while a public request is pending.** A user requests deletion on the
   web, reinstalls, and deletes in-app. They must be deleted **now**, not told to wait out the grace
   period, and the in-app call must not 409 or no-op. §3.5 makes the public path deferred and the
   in-app path immediate, but never says what the crossing state does. → **T5**.
2. **A repeat public POST while a request is already pending.** Story 2 AC4 and §3.5.2 pin the audit
   entry and the notification to the unset → set transition. The observable: one `request_deletion`
   row, one push, `deletionRequestedAt` re-asserted (a fresh 7-day clock), and the same 200. →
   **T9**.
3. **`Origin` present but not in the allowlist, with `Sec-Fetch-Site: same-origin`.** The both-signals
   rule (Story 3 AC8) rejects this. A "primary signal" implementation would accept it. → **T9**.
4. **An account that is `exiting` / `deactivated` / `alumni` when its deadline passes.** Must still be
   swept — this is the exact regression round 3 rated HIGH. → **T12** (regression test 1).
5. **A public submit for a real identifier with a wrong password vs. a nonexistent identifier.**
   Byte-identical response body, and no `MobileSession` created on either. → **T9**.

Also pinned because a reviewer will ask: the in-app delete on an account whose `User` is already
`isActive: false` (ERP login disabled) must still delete the Juvi account — deletion is a Juvi
concern and does not gate on ERP state. → **T5**.

## Global constraints

Copied from spec §5; every task's tests implicitly include them.

### Two ACs that are *non*-changes, listed so nobody implements them

Story 4 AC3 and AC4 are requirements to **not** write code, and a reviewer who finds no task for them
should find this instead:

- **AC3** — a later admin provisioning run recreates the account as a fresh `onboarding` account.
  That is existing behaviour and is deliberately **not** touched. Worth stating to the operator
  anyway: `provisionPerson` defaults to `resetPassword: true` (`provisioning-service.ts:94`), so
  re-provisioning also **rotates the person's ERP password** — legitimate, and the mechanism by which
  a stuffed credential is invalidated, but not surprising once said out loud.
- **AC4** — **no** standing "do not re-provision" marker is written and the reconciler is taught
  nothing new (it never recreates accounts anyway). If a diff for this feature adds such a marker,
  it is wrong.

Likewise §3.3 is a negative requirement with teeth: `ACCOUNT_STATUSES` (`JuviAccount.ts:9`) is
**not** extended with a `deleted` value, and **`deactivateAccount()` is not reused**
(`provisioning-service.ts:206-214` sets `User.isActive = false` and only soft-revokes sessions —
exactly the two things this feature exists to avoid). It is the nearest existing helper and the
obvious wrong turn.

### The constraints

- Every **request-path** query filters by `collegeId`. The **only** sanctioned exception is the sweep
  (§3.5.1) — a cross-tenant system job unreachable from any route (Story 2 AC7).
- Mobile surfaces use the **mobile** error envelope `MobileApiError(status, code, message)`
  (`errors.ts`), never ERP `AppError`. The public route stays inside `/api/juvi-app/v1` to inherit it.
- Deletion order is fixed: **audit intent → revoke sessions (write-through) → reset notice state →
  delete child rows → delete the account row last.**
- No multi-document transactions (the harness is not a replica set). Every step idempotent; the audit
  insert's existence guard is the only non-idempotent one.
- **Three closed enums** are extended, all in §5 of the spec: `'account_deleted'`,
  `'request_deletion'` (both halves — union **and** Mongoose mirror), `'DELETION_NOT_CANCELLABLE'`.
- **Field lifecycle: absent, never explicit `null`.** No `default: null`, no `$set: null` for
  `deletionRequestedAt` / `deletionRequestedVia` / `deletionClaimedAt`.
- `deletionClaimedAt` is conditioned on in **exactly one place** — Story 4 AC1's cancel — and
  **never** in the sweep's claim filter.
- `DELETION_GRACE_DAYS = 7`; sweep cadence hourly; sweep concurrency `1`.
- No authentication path may depend on Redis or a registered queue (the best-effort clears must never
  fail a sign-in).
- TypeScript strict + `noUncheckedIndexedAccess`; `npm run typecheck` clean in every workspace.

---

## 5. Phase A — foundations (the two things everything else compiles against)

### T1 — `JuviAccount` deletion fields + the sparse index

Add to the schema: `deletionRequestedAt: { type: Date }` (no default), `deletionRequestedVia: {
type: String, enum: ['public_web'] }` (no default), `deletionClaimedAt: { type: Date }` (no default),
and `schema.index({ deletionRequestedAt: 1 }, { sparse: true })`.

No `required: true`, no `default: null` — the absent-not-null lifecycle is a constraint, not a style
(§5). The `enum` on `deletionRequestedVia` is a **fourth** closed set but deliberately **not**
exported: nothing branches on it beyond the admin list echoing it, so it stays a schema-local literal
rather than growing a constants module.

**Gate:** a unit test asserts (a) the index exists with `sparse: true`, (b) a fresh account has all
three fields `undefined` (not `null`) — this is the test that fails if someone adds `default: null`.

### T2 — the three closed-enum additions

| File | Change |
|---|---|
| `models/juvi/MobileSession.ts:4-10` | `RevokeReason` += `'account_deleted'`; `REVOKE_REASONS` += same |
| `shared/types.ts:26-55` | `AuditAction` += `'request_deletion'` |
| `shared/audit.ts:27-36` | `AUDIT_ACTIONS` += `'request_deletion'` (enforced `:45` — omit this half and it is a compile error there and a runtime `ValidationError` at write) |
| `modules/juvi-app/errors.ts:5-13` | `MobileErrorCode` += `'DELETION_NOT_CANCELLABLE'` |

Also add the `409: 'DELETION_NOT_CANCELLABLE'` row to `STATUS_TO_CODE` (`errors.ts:35-37`) — optional
per the spec (the route throws `MobileApiError` directly) but it costs one line and keeps the two
consistent for any future `AppError`-shaped 409.

**Gate:** typecheck; plus one test that `createAuditLog({ action: 'request_deletion', … })` persists
(proving both halves agree) and one that `revokeSession(sid, 'account_deleted')` persists.

---

## 6. Phase B — the deletion engine

### T3 — `deleteScoped`

`accounts/deletion-service.ts`:

```ts
export async function deleteScoped<T>(model: Model<T>, filter: Record<string, unknown>) {
  if (!filter.collegeId) throw new Error('deleteScoped requires collegeId');
  return model.deleteMany(filter);
}
```

The guard is the point: 010's scope-plugin does **not** hook `deleteMany` (`scope-plugin.ts:73`) and
is inert on the mobile stack (`req.mobile`, not `req.authScope`), so nothing else enforces tenancy on
these writes.

**Gate:** a test that the helper throws without `collegeId`.

### T4 — the one deletion service

`accounts/deletion-service.ts`: `runAccountDeletion(account)` — the **only** deletion path, called by
the in-app endpoint, the public endpoint, and the sweep. Order is fixed by §5.

1. **Audit intent first**, existence-guarded on `{ collegeId, entityType: 'JuviAccount', entityId,
   action: 'delete' }`. The `action` key is mandatory: without it the guard also matches the
   provisioning `create` entry for the same account (`provisioning-service.ts:165-174`) and silently
   suppresses the deletion record entirely.
2. **Revoke every `MobileSession` write-through** — `revokeSession(sid, 'account_deleted')` (clears
   the 60 s `juvi:sess:<sid>` Redis cache and `$unset`s `pushToken`) **then** `deleteMany`. `deleteMany`
   alone leaves a live cached session accepted while the account row is gone.
3. **Reset `NoticeRecipient`** — collect `rows` and `snapshotNoticeIds` **before** the update, then
   `updateMany` narrowed by `_id: { $in: rows }` (never by `accountId` — that is what stops a
   concurrent fan-out having its newly-set `accountId` nulled), then recount `counts.onJuvi` per
   affected notice with `status: { $ne: 'publishing' }`. Copy `recipient-service.ts:20-31` verbatim.
4. **Delete child rows** via `deleteScoped`: `ChannelMembership`, `JuviProvisionedCredential`,
   `NotificationDelivery`, `JuviEvent`, `MobileSession` (already gone), plus `juvi:acct-touch:<accountId>`.
5. **Delete the `JuviAccount` row(s) last**, by `{ collegeId, userId }` — not by `_id`
   (`{collegeId, userId}` is not uniquely indexed, `JuviAccount.ts:96`).

`User`, `Person`, `Student`/`Faculty`/`Staff` and every ERP record are untouched.

**Gate (the AC3 test, required on **both** paths):** after deletion the `User` still exists with an
unchanged password hash **and `isActive: true`**. Plus a two-college test per model asserting the
other college's rows are untouched (Story 2 AC7).

---

## 7. Phase C — the in-app path

### T5 — `DELETE /api/juvi-app/v1/me/account`

Authenticated (`authenticateMobile`). Resolves the account from the JWT only — no id from the body
(Story 2 AC1). Calls `runAccountDeletion`. `204`.

Crossing state (**Review focus 1**): when the account already has `deletionRequestedAt` set from a
public request, the in-app call deletes **immediately** — it does not wait out the grace period, does
not 409, and does not consult `deletionClaimedAt`. The grace period exists to give a stuffed-credential
victim a window; a live session plus a typed phrase is strictly stronger evidence than the window
protects, so the window collapses.

Also: the delete must not gate on ERP state — an account whose `User` is already `isActive: false`
still deletes.

**Gate:** idempotency (a second call returns a defined 401/404-shaped result, never a 500); the
still-valid access token is rejected 401 afterwards (the row is gone, so `authenticateMobile` cannot
resolve it); the crossing-state test above.

### T6 — cancellation

`DELETE /api/juvi-app/v1/me/account/deletion-request` — the authenticated cancel, **one** atomic
conditional update (spec Story 4 AC1):

```js
await JuviAccount.updateOne(
  { _id: accountId, collegeId, deletionRequestedAt: { $ne: null }, deletionClaimedAt: null },
  { $unset: { deletionRequestedAt: 1, deletionRequestedVia: 1, deletionClaimedAt: 1 } },
)
```

No match **while `deletionRequestedAt` is still set** → **409 `DELETION_NOT_CANCELLABLE`** (the
executor has claimed it). No match with the field unset → 204 (`already cleared` and `nothing to
clear` are the same outcome). `$unset`, never `$set: null` (T1's gate is what catches a regression).

The **best-effort** clears share this shape and are wrapped so a failure can never fail the caller:
one after a successful sign-in (`auth-service.ts`, inside the existing success path) and one after a
successful password change. Neither may touch `getQueue()` — with background jobs disabled an
unregistered queue throws (`QueueManager.ts:55-59`), which would 500 every sign-in.

**Gate:** 409 on a claimed row; 204 on an unclaimed one; a unit test that a throwing clear does not
fail sign-in.

---

## 8. Phase D — the public path

### T7 — `verifyCredentials`

Extract from `signIn` a **read-only** `verifyCredentials(collegeId, identifier, password):
Promise<{ user, account }>` — chain: `lookupInstitutionByCode` → `resolveIdentifierToUser` →
`bcrypt.compare(password, user?.password ?? DUMMY_HASH)`. It creates no `MobileSession`, returns no
tokens, and **does not call `getCooldown`/`recordFailure`** (read-only means no session effects *and*
no effect on the sign-in lockout budget). `signIn` calls it and keeps its own cooldown/session logic.

Branches collapse by construction: `lookupInstitutionByCode` returns `null` for unknown, inactive and
Juvi-disabled alike (`institution-config.ts:73-79`), so the page reveals nothing about an
institution's state.

**Gate:** `signIn` behaviour unchanged (its existing tests stay green with no edits); a test that
`verifyCredentials` on a success creates no session row and leaves `juvi:login-fail:*` untouched.

### T8 — the two rate-limiting mechanisms (**distinct artifacts, do not merge them**)

Story 3 specifies **two** separate controls, and they are different in kind. An implementation that
collapses them into one limiter gets AC6 wrong.

**(a) `deletionVerifyLimiter` — AC3, IP-keyed, hard-blocking.**
`middleware/rate-limits.ts` keeps `limiter(n)` module-private while exporting `signInLimiter =
limiter(10)` (`:21`). Export a `deletionVerifyLimiter` the same way, and mount it on the public route
(T9). Its 429 path is the factory's existing `handler` (`:14-16`).
**Gate:** a unit test constructs the limiter directly and asserts its 429 — the Playwright job sets
`E2E_TESTING=1`, which disables limiters, so e2e cannot assert this.

**(b) The per-identifier budget — AC6, non-blocking, tarpitting.**
**New file:** `accounts/deletion-verify-budget.ts`. Keyed
`juvi:deletion-verify:<collegeId>:<hash-of-identifier>` (hashed — identifiers never land in Redis,
`cooldown.ts:7`): attempts are counted and **backed off / tarpitted, never hard-blocked**. This has
its own home precisely because it is *not* a limiter — reusing the sign-in cooldown (`cooldown.ts`) or
giving it a 429 would let an unauthenticated attacker lock a victim out of the **app** with five bogus
deletion requests, which is the failure AC6 exists to prevent. The two namespaces are key-disjoint by
construction (`getCooldown` reads only `juvi:login-fail:*`); `cooldown.ts` is read-only reference, not
a dependency to call.

**Gate:** five failed public verifications leave `getCooldown` unblocked for that identifier (the
sign-in budget is untouched), and the sixth public attempt is still processed — slower, not refused.

### T9 — `POST /api/juvi-app/v1/account-deletion`

`accounts/public-deletion-routes.ts`, mounted in `modules/juvi-app/routes.ts` **before**
`spacesRouter` (whose router-wide `authenticateMobile` at `spaces/routes.ts:6` would otherwise run
first), carrying the same explicit ordering comment the receipts path has (`routes.ts:20-25`).
`spacesRouter` is not modified.

Four things this route must do that a naive implementation gets wrong:

1. **Accept a form-encoded body.** The page has no script, so it submits a native form. Mount
   `express.urlencoded({ extended: false })` **on this route only** — `app.ts:46-51` registers
   `express.json` and nothing else, and `urlencoded` appears nowhere in `backend/src` today.
2. **Reject cross-site submission with every presented signal agreeing** (AC8): `Sec-Fetch-Site`,
   when present, must be `same-origin`; `Origin` (or, absent it, `Referer`), when present, must be in
   the CORS allowlist; a request presenting **neither** is rejected. Not primary-with-fallback —
   **both**. CORS alone does not stop a form POST being *processed*, so this actively rejects.
3. **Set the field on the unset → set transition only** — repeat POSTs re-assert
   `deletionRequestedAt` (fresh clock) but append **no** second `request_deletion` audit row and send
   **no** second push. `createAuditLog` is an unconditional `AuditLog.create` (`audit.ts:60-62`), so
   this is a caller-side guard.
4. **Respond identically whether or not the identifier exists** — same body, same status, and no
   `MobileSession` on either branch.

The actor in the audit entry is the **account id**, never the submitted identifier or e-mail (the
codebase hashes identifiers precisely so they never reach Redis or logs — `cooldown.ts:7`).
`entityType: 'JuviAccountPublicDeletion'` marks the origin; the execution entry (`'JuviAccount'`) is
written by `runAccountDeletion` at the moment the deletion actually runs.

**Gate:** the five review-focus cases that land here (repeat POST; `Origin` present-but-not-allowed
with `Sec-Fetch-Site: same-origin` → rejected; real-identifier-wrong-password vs nonexistent →
identical); plus route-reachability without an `Authorization` header (AC7).

### T10 — the notification

The notification stack is notice-shaped: `NotificationDelivery.source.type`/`kind` are closed enums
and `source.id` is a required ObjectId (`NotificationDelivery.ts:16,50` — `:70` is the
`(source.type, source.id, source.kind, accountId)` uniqueness index, not the field declaration).
Add the enum members and
define a `source.id` for a non-notice notification — this is **not** a drop-in reuse, and it is the
task most likely to be underestimated.

Best-effort by design, and the plan says so out loud: a person with no live device gets
`suppressed/no_device` (`sender.ts:120-124`) — and that person *is* the public path's audience. The
dependable surfaces are the banner, the ERP record and the audit trail.

**Gate:** a test that a device-less account's request still sets the field and still writes the audit
entry (the push's absence must not fail anything).

---

## 9. Phase E — the sweep

### T11 — queue name + worker + registration

- `QUEUE_NAMES.JUVI_ACCOUNT_DELETION: 'juvi_account_deletion'` in the closed
  `as const` registry (`QueueManager.ts:113-146`; Juvi names at `:141-142`). Never a bare string.
- `accounts/deletion-sweep-worker.ts`, **exporting** its function (`sweepAccountDeletions`) the way
  `proposal-expiry-worker.ts:29` exports `expireProposals`, so both regression tests run without
  Redis. This same file defines the two module constants T11/T12 consume: `DELETION_GRACE_DAYS = 7`
  and the stable scheduler id `JUVI_ACCOUNT_DELETION_SWEEP_ID = 'juvi-account-deletion-sweep'` (stable
  across interval changes — that stability is what T12's first test pins).

Scan — **no `status` predicate**; the field is the sole predicate:

```js
const BATCH_SIZE = 500;
const due = await JuviAccount.find({
  deletionRequestedAt: { $lte: new Date(Date.now() - DELETION_GRACE_DAYS * 86_400_000), $ne: null },
}).select('_id collegeId userId deletionRequestedAt').limit(BATCH_SIZE).lean();
```

Claim — per-row `try/catch`, exactly two fields in the filter:

```js
const claimed = await JuviAccount.findOneAndUpdate(
  { _id: doc._id, deletionRequestedAt: { $lte: deadline, $ne: null } },
  { $set: { deletionClaimedAt: new Date() } },
  { new: true },
);
if (!claimed) continue;
await runAccountDeletion(claimed);
```

**`deletionClaimedAt` must never become a third field here.** Conditioning the claim on it would mean
a row claimed by a crashed executor is never re-claimed — the fail-open class rounds 2 and 3 failed
on. Because the filter cannot see the field, a crashed claim self-heals on the next tick.

Registered with the module's stable-id form, not the interval-keyed one:

```js
await queue.upsertJobScheduler(JUVI_ACCOUNT_DELETION_SWEEP_ID, { every: 3_600_000 },
  { name: 'sweep', opts: { removeOnComplete: true, removeOnFail: true } });
```

(`reconcile-worker.ts:48-52`; the comment at `:43-47` records why the older `add(…, { repeat })` form
was abandoned — a changed interval left the old schedule running.) Registered from `server.ts`
alongside the other workers, inside the `DISABLE_BACKGROUND_JOBS !== 'true'` gate (`server.ts:20`).
Queue concurrency `1`.

**Gate:** the scheduler id is stable across a changed interval (register twice with different
intervals, assert one schedule); the scan's plan uses the sparse index.

### T12 — the two regression tests

Both call `sweepAccountDeletions` directly — no Redis.

1. Seed an account with `deletionRequestedAt` past the deadline whose `status` is **not** in
   `ELIGIBLE_STATUSES` (e.g. `exiting`), run the sweep, assert the deletion **ran**. This is the test
   that fails the moment any status predicate is reintroduced.
2. Seed a due account, `$unset` the field between the scan and the claim, assert the deletion **did
   not** run.

**Gate:** both fail against a deliberately reintroduced `status` predicate / a removed
`if (!claimed) continue;` — verify by mutating the code, not by reading it.

---

## 10. Phase F — the surfaces

### T13 — the admin detection surface

`GET /api/juvi-app/admin/accounts/pending-deletion` on `adminRouter`, gated by its existing
`authenticate` (`admin/routes.ts:18`) plus `authorize('platform', 'read')` — the gate its sibling
`GET /accounts` already uses (`:30`). Served under the ERP error envelope (`:41-42`).

Query, scoped to the caller's college (the `admin/accounts-service.ts:28` precedent):

```js
{ collegeId: req.collegeId, deletionRequestedAt: { $ne: null } }
```

**Not** a global scan — Story 2 AC7 and §5 make the sweep the only sanctioned cross-tenant read, and
this route is reachable from a request path. Returns id, requested-at, `deletionRequestedVia`,
`deletionClaimedAt`. `collegeId` is **not** echoed per row.

Detection rule is **age alone** (`deletionRequestedAt` past the grace period), with
`deletionClaimedAt` informational: a request claimed by an executor that then died carries a non-null
claim while still being stalled, so keying on "claimed is null" would mislabel it.

The RBAC breadth is **accepted and disclosed**, not narrowed: `platform: read` is also held by
`staff`/`ST-ADM-DIR` (`defaults.ts:155`), whose grant is sub-domain-scoped to `communication`, and no
Juvi admin route declares a sub-domain so the check is skipped (`authorize.ts:61`). Narrowing one
route while `/accounts` stays open would be theatre (§4 records the module-wide fix as out of scope).
The exposed fields carry no PII.

**Gate:** two-college test — college A's caller sees only college A's pending rows; a person with no
`platform: read` gets 403.

### T14 — `GET /me` gains the two fields

`me-service.ts` adds nullable `deletionRequestedAt` (ISO) and `deletionRequestedVia` to the `/me`
payload. This drives Story 1 AC7's banner.

**The mobile side must be extended in the same task, or the banner silently never fires.**
`me_repository.dart` parses the raw body into the **local** freezed `Me`
(`mobile/lib/core/models/models.dart:126`, parsed at `me_repository.dart:55-62`) — not the generated
`wire.Me`, which crashes on a real payload (the documented R61 reason). Freezed's `fromJson` **drops
unknown keys silently**, so adding the fields server-side and nothing else yields a `Me` that simply
has no `deletionRequestedAt` — no error, no warning, no banner. Add both fields to the freezed class
and re-run codegen (`models.freezed.dart`, `models.g.dart`).

This is a **response-schema change** and must be costed: it is exactly the nullable-field case the
raw-Dio R61 workaround exists for (`mobile/README.md` "Toolchain notes"). The client must parse a real
`null`.

**Files:** `accounts/me-service.ts`; `mobile/lib/core/models/models.dart` (+ generated).

**Gate:** a backend test asserting both fields are present and `null` on an account with no request;
a Dart test that `Me.fromJson` on a payload carrying `deletionRequestedAt` exposes it (the test that
fails if the model is forgotten); mocking `null` as `null`, per R61.

### T15 — portal: the pending-deletions page + service

A page listing pending deletions with age, and a hand-written service call (there is **no** ERP
OpenAPI document — §3.6; the admin portal calls its other ERP endpoints by hand). The age column is
the *detection control*, so it must visibly distinguish past-grace from within-grace.

**Gate:** a render test against a mocked response; an empty state.

### T16 — the static public page

`admin-portal/public/account-deletion.html` — plain HTML, **no script at all** (not inline, no
external file), copied verbatim by vite into `dist/`, published by `scripts/deploy.sh` to
`$WEB_ROOT/current`, served by nginx at `/account-deletion.html`. It references the app and developer
name and prominently features the deletion pathway. Framing protection is an **nginx** concern —
`helmet()` never touches this file (§3.2).

The form posts natively to `POST /api/juvi-app/v1/account-deletion` (hence T9's scoped `urlencoded`).

**Two plan-time checks, not assumptions:**
- the deploy's nginx block must serve an existing file before any SPA fallback (the normal
  `try_files $uri $uri/ /index.html` shape);
- the production same-origin topology (nginx arrangement + `ALLOWED_ORIGINS`) must be confirmed —
  AC8's `Origin` check is unconditional-when-present, so if the page and API are **not** same-origin
  the legitimate POST is rejected too. That is a break, not a hole, and it is the one thing this
  feature cannot verify from source.

**Gate:** the page fetched from the running portal and submitted end-to-end (Playwright, against the
real route); a check that the served HTML contains no `<script`.

---

## 11. Phase G — the contract

### T17 — OpenAPI + Dart regeneration

`openapi/document.ts`, following the existing bodyless deletes (`:147` `signOut`, `:154`
`revokeDevice`, `:176` `clearPushToken`):

- `{ operationId: 'deleteAccount', method: 'delete', path: '/me/account', auth: true, status: 204, errors: [401] }`
- `{ operationId: 'cancelAccountDeletion', method: 'delete', path: '/me/account/deletion-request', auth: true, status: 204, errors: [401, 409] }`
- `Me` schema gains nullable `deletionRequestedAt` / `deletionRequestedVia`.

Regenerate the Dart client (`npm run openapi:mobile -w backend`, then the mobile generator). R61's
raw-Dio workaround is reserved for the genuinely nullable `Me` fields — a 204 delete has no response
body, so skipping its contract would just leave the contract incomplete.

**The admin route is deliberately absent** — there is nowhere to declare it. The only generator is
the mobile document (`servers: [{ url: '/api/juvi-app/v1' }]`, one `tags: ['mobile']` →
one `MobileApi`), and the admin router is mounted at `/api/juvi-app/admin`, a **sibling** of `/v1`
(`routes.ts:28-29`). A `/admin/…` entry there would generate
`/api/juvi-app/v1/admin/accounts/pending-deletion` — a 404 — and a Dart method that can never
authenticate. Its contract home is prose (§3.6) plus T13's test.

**Gate:** generated client compiles; mobile `flutter analyze` clean.

---

## 12. Phase H — mobile

### T18 — the deletion wipe

Extend `SessionController._wipe()` (`session_controller.dart:159`) and add the missing primitives:

- `ReceiptQueue.clear()` — **new** (`receipts.dart:33`; the queue has `read`/`add`/`remove` today and
  no clear — `post`/`drain` live on `Receipts`, `:75-87`, which wraps the queue).
- `SecureStore.clearPendingLink()` — **exists** (`secure_store.dart:96`); call it. Note `wipeAll()`
  is a 3-key allowlist (`:105-109`) and does **not** cover it.
- `juvi.last_account` (`secure_store.dart:28`) — add a `clearLastAccount()` next to
  `clearPendingLink()` and call it; `wipeAll()` does not cover this either.
- `_wipe()` already covers `kvCache` (including the cached `me` document), `pending_actions`,
  `analytics_events` via `db.wipe()` (`app_database.dart:243-247`) — verify, don't re-add.

**Gate:** a session test asserting every one of the six surfaces is empty after `_wipe()`.

### T19 — Settings row + confirmation screen

`features/me/settings_screen.dart`: a *Delete my Juvi account* row → a confirmation screen naming, in
two explicit lists, what is deleted (the Juvi account, every signed-in device, channel memberships,
notification delivery records, analytics events, and **their own** seen/acknowledged notice state)
and what the college retains (academic/attendance/fee/exam records, the notice audience record, the
profile photo — which is the person's ERP photo).

A **typed confirmation phrase** gates the destructive action — not one tap. All copy through
`context.l10n` (`lib/app/l10n/app_en.arb`).

**Gate:** a widget test that the action is unreachable without the exact phrase, and that the two
lists render both categories.

### T20 — the call and the failure path

On confirm: call the server, and **only after it confirms** run the wipe (T18) — never
`signOut()`. The delete path must **not** call `authRepository.signOut()` or
`pushRegistration.unregister()`: both would 401 against an account that no longer exists.

On failure or offline, **nothing is deleted locally**, the app stays signed in, and the failure is
shown. A half-deleted client is never a possible state.

A `401 SESSION_INVALIDATED` on **any** request (e.g. a second device opened before the deletion)
triggers the same local wipe rather than merely bouncing to sign-in — that is how another device's
cached copy gets best-effort cleared on its next launch.

**Gate:** a test that a failing delete leaves all six surfaces intact and the session live; a test
that a `401 SESSION_INVALIDATED` response routes through the wipe.

### T21 — the pending-request banner and Cancel

Settings and the app shell surface a pending public-web deletion as a banner with a *Cancel* action,
driven by `deletionRequestedAt` on `GET /me` (T14). Cancel calls T6; a **409** must render as *too
late* (the deletion is already committing), never as success — that is the whole reason the 409
exists rather than a lying 204.

**Gate:** a test that a 409 renders the too-late copy and does not clear the banner; a test that a
204 clears it.

---

## 13. Phase I — the policy text

### T22 — the retention disclosure

Draft the privacy-policy deletion section: what is deleted (§3.1's hard-deleted set + the reset
fields), what is retained (ERP records, the notice audience record, the profile photo), and that a
public-web request completes after the grace period. Drafting is in scope; **publishing is not** (it
needs a hosted URL), and no Play Console configuration is in scope (§4).

**Gate:** the draft covers all three disclosure classes and names the grace period explicitly —
this text is what the Play Data-safety answer is written from.

---

## 14. Deployment prerequisites (operator, not code)

Stated so they are not discovered in production:

- **`TRUST_PROXY_HOPS` must be set.** Unset means trust none (`app.ts:23`), so nginx fronts every
  request and T8's limiter key becomes the proxy — one shared bucket throttling the whole campus on a
  Play-mandated path.
- **nginx must serve the static page** before any SPA fallback, and `root` must point at
  `$WEB_ROOT/current` for the deploy to publish it at all.

And one thing that is **not** an operator prerequisite, corrected here because revision 4 said it
was: a shared limiter store. `limiter(n)` (`rate-limits.ts:7-18`) passes **no `store`**, so every
limiter in the app uses express-rate-limit's in-process `MemoryStore`, and no environment variable
reaches a store — the only dependency is `express-rate-limit` itself. Making it shared is a code +
dependency change that would alter every limiter, not just T8's, and it is **unnecessary** while the
API runs as the single pm2 process `scripts/deploy.sh` restarts by name. It is recorded as out of
scope (§4) with its condition: if the API is ever run as more than one worker, each process gets its
own budget and a restart resets it, and this must be revisited alongside that deploy change.

## 15. Sequence

T1 → T2 → T3 → T4 (engine proven before any caller) → T5, T6 (in-app) → T7, T8, T9, T10 (public) →
T11, T12 (sweep — T12 rides on T11) → T13, T14 (surfaces) → T17 (contract) → T18–T21 (mobile) →
T15, T16 (portal) → T22 (policy).

T16's two plan-time checks and T14's R61 null-parsing are the two places this plan can be wrong for
reasons the spec could not resolve from source; both are verified against the running system before
the task is called done.

**Nothing may ship until T4's `isActive: true` assertion passes on both paths** — it is the guard on
the single worst failure mode this feature has: destroying a person's ERP login.

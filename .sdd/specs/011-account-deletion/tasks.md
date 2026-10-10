# Tasks — 011-account-deletion

## STATUS
**Complete.** T1–T22 are implemented, tested and committed on `feat/juvi-account-deletion` (branched
from `origin/main`; 34 commits, `ba197a5` … `0d33b57`). GATE 2 and GATE 3 were met before T1
(round 4: 0 CRITICAL / 0 HIGH on all three validators; `gate3-audit.md` reads PASS) — see
`gate2-resolution.md` and `gate3-audit.md`.

**T21's tests took three fix rounds**, each one closing a *falsifiability* gap rather than a
behaviour change, and each verified by mutation with the mutated file restored byte-identically:
the first round fixed five review findings (`e7a3b5f`); the second re-review found the round's own
"Cancel clears it" assertion **vacuous** — it read the cached `me` document after `pumpAndSettle`,
by which point the post-invalidate refetch had already rewritten it, so deleting the repository's
cache clear left the test green (reproduced, then `e4a8ee3`: the refetch is now held open and the
cache read while it is in flight, so the clear is the only writer of a null at that moment); the
third (`ea6f902`) finished the re-arm — clearing `_error` with `_tooLate`, and keying the reset on
a *changed* `deletionRequestedAt` rather than its presence. Full mobile suite 352/352,
`flutter analyze lib test` clean.

**Whole-branch review, split in two** — 12,162 insertions is past what one context reviews honestly
— backend half and clients half, each on the most capable model, both **APPROVED** with zero
correctness defects and every named invariant falsified by mutation. The two things they left open
are now closed. The clients half found the *shared* `_wipe()`: extended with 011's three
deletion-only clears, it is also the sign-out wipe, so an ordinary sign-out began clearing
`juvi.pending_link` and `juvi.last_account` — the two `SecureStore` documents as kept across
sign-out, because a notification tapped while signed out parks its destination in the first under
the account the second names, and the next sign-in is what opens it (notifications §12). AC3 had
already drawn the line (the deletion wipe is `_wipe()` **plus** the three); the plan's "extend
`_wipe()`" folded them together. `_wipe()` is back to the session wipe and `_wipeForDeletion()` adds
the three, `93fc3f8` — both halves falsified by mutation (commenting out the deletion path's
`clearLastAccount()` reddens T18 by name; a live `clearLastAccount()` in `_wipe()` reddens the new
sign-out test by name). The backend half's note that `deleteAccount` declared only 401 while
`me-controller.ts:49` can return 404 is `0d33b57`, where the generated Dart was *verified* unchanged
by a scratch generation with the pinned generator rather than assumed.

One thing to know, not a defect: `batching_analytics_test.dart` (untouched by this branch) failed
once for the clients reviewer under full-suite load and passes 10/10 in isolation and in every
uncontended full run — a load-sensitive flake, not drift.

**Both feature gates discharged**, each by mutation rather than by reading, each with the mutated
file restored byte-identically (`diff -q`):

- **T4 (`isActive: true` on both paths).** The in-app half already existed
  (`deletion-service.test.ts:81`). The sweep half was missing — `deletion-sweep.test.ts` mocks the
  deleter at module scope, so nothing there could ask whether the deleter was *safe* to reach — and
  is now `deletion-sweep.test.ts:177`, running the real `runAccountDeletion` through
  `sweepAccountDeletions`. `$set: { isActive: false }` in the deleter reddens both by name;
  `User.deleteOne` reddens the e2e assertion (`juvi-account-deletion.e2e.test.ts:45`). Commit
  `4cead21`.
- **T12 (query shapes by mutation).** `status: { $in: ELIGIBLE_STATUSES }` on the scan reddens
  `deletion-sweep.test.ts:52`; removing `if (!claimed) continue;` reddens `:117`.

Test runners: `npx vitest run <path>` (backend units), `npx vitest run --config vitest.e2e.config.ts
<path>` (backend e2e — in-memory Mongo, no live services), `flutter test` (mobile), Playwright for
the browser suite.

TDD-ordered, each commit-shaped. Derived from `plan.md` (§5–§13), incorporating the GATE-2 rulings in
`gate2-resolution.md` (rulings 11–15). Each task: **RED** (failing test) → **GREEN** (minimal impl) →
**REFACTOR** → typecheck → commit.

Not code, and not finished by this branch: the deploy prerequisites in the "Before publishing"
section of `docs/juvi/account-deletion-retention.md` (a hosted URL for the disclosure, which is what
the Play listing links to) and the one-time server setup recorded on PR #113.

Every commit message ends with:
`Co-Authored-By: Claude Code <noreply@anthropic.com>`

---

## Phase A — foundations

## T1 — `JuviAccount` deletion fields + sparse index
**Files:** `backend/src/models/juvi/JuviAccount.ts` (+ model test)
- `deletionRequestedAt: Date`, `deletionRequestedVia: String enum ['public_web']`, `deletionClaimedAt: Date`. **No `default: null`, no `required`** — the absent-not-null lifecycle is §5's constraint.
- `schema.index({ deletionRequestedAt: 1 }, { sparse: true })`.
- **Test:** a fresh account has all three fields `undefined` (not `null`) — this is the test that fails the moment someone adds `default: null`; and the index exists with `sparse: true`.
- Commit: `feat(juvi): JuviAccount deletion fields + sparse index (011 T1)`

## T2 — the three closed-enum additions
**Files:** `models/juvi/MobileSession.ts`, `shared/types.ts`, `shared/audit.ts`, `modules/juvi-app/errors.ts` (+ tests)
- `RevokeReason` **and** `REVOKE_REASONS` += `'account_deleted'` (`MobileSession.ts:4-10`).
- `AuditAction` (`types.ts:26-55`) **and** `AUDIT_ACTIONS` (`audit.ts:27-36`, enforced `:45`) += `'request_deletion'` — both halves, or it is a compile error here and a runtime `ValidationError` there.
- `MobileErrorCode` (`errors.ts:5-13`) += `'DELETION_NOT_CANCELLABLE'`; add the `409` row to `STATUS_TO_CODE` (`:35-37`) for consistency.
- **Tests:** `createAuditLog({action:'request_deletion',…})` persists; `revokeSession(sid,'account_deleted')` persists.
- Commit: `feat(juvi): declare three closed-enum additions for account deletion (011 T2)`

## Phase B — the deletion engine

## T3 — `deleteScoped`
**Files:** new `backend/src/modules/juvi-app/accounts/deletion-service.ts` + test
- `deleteScoped(model, filter)` throws when `filter.collegeId` is missing — 010's scope-plugin does **not** hook `deleteMany` (`scope-plugin.ts:73`) and is inert on the mobile stack.
- **Test:** throws without `collegeId`.
- Commit: `feat(juvi): add collegeId-guarded deleteScoped helper (011 T3)`

## T4 — `runAccountDeletion` (the one deletion service)
**Files:** `deletion-service.ts` + `__tests__/deletion-service.test.ts`
- Fixed order: **audit intent** (existence-guarded on `{collegeId, entityType:'JuviAccount', entityId, action:'delete'}` — `action` is mandatory, else the guard collides with the provisioning `create` entry, `provisioning-service.ts:165-174`) → **write-through revoke** every `MobileSession` (`revokeSession(sid,'account_deleted')` then `deleteMany`) → **reset `NoticeRecipient`** (collect rows/noticeIds before, narrow the update by `_id: { $in: rows }`, recount `counts.onJuvi` with `status: {$ne:'publishing'}`; copy `recipient-service.ts:20-31`) → **delete child rows** via `deleteScoped` + `juvi:acct-touch:<accountId>` → **delete the `JuviAccount` row(s) last** by `{collegeId, userId}`, never `_id`.
- `User` / `Person` / `Student` untouched. **Do not reuse `deactivateAccount()`** (§3.3).
- **Tests (must include):** the `User` still exists with an unchanged password hash **and `isActive: true`** — required on **both** paths; a two-college test per model asserting the other college's rows survive.
- Commit: `feat(juvi): the single account-deletion service (011 T4)`

## Phase C — the in-app path

## T5 — `DELETE /v1/me/account`
**Files:** `modules/juvi-app/accounts/routes.ts` (+ controller) + tests
- Account resolved from the JWT only — no id from the body. `204`.
- **Crossing state (plan §4 review focus 1):** with a public request already pending, deletes **immediately** — no grace period, no 409, no consultation of `deletionClaimedAt`.
- Must not gate on ERP state (an account whose `User` is `isActive: false` still deletes).
- **Tests:** idempotency (second call → defined 401/404, never 500); the token is rejected 401 afterwards; the crossing-state case.
- Commit: `feat(juvi): in-app account deletion endpoint (011 T5)`

## T6 — cancellation + best-effort clears
**Files:** `accounts/routes.ts`, `accounts/auth-service.ts`, `accounts/session-service.ts` + tests
- `DELETE /v1/me/account/deletion-request` — one atomic conditional update, `$unset` (never `$set: null`): `{ _id, collegeId, deletionRequestedAt: {$ne:null}, deletionClaimedAt: null }`.
- No match with the field still set → **409 `DELETION_NOT_CANCELLABLE`**; no match with the field unset → 204.
- Best-effort clears (same shape, wrapped) after a successful sign-in and after a successful password change. Neither may call `getQueue()` (`QueueManager.ts:55-59` throws when unregistered → every sign-in 500s).
- **Tests:** 409 on a claimed row; 204 on an unclaimed one; a throwing clear does not fail sign-in.
- Commit: `feat(juvi): cancellable deletion requests + best-effort clears (011 T6)`

## Phase D — the public path

## T7 — `verifyCredentials` (read-only extraction)
**Files:** `accounts/auth-service.ts` + tests
- Extract `verifyCredentials(collegeId, identifier, password): Promise<{user, account}>` — `lookupInstitutionByCode` → `resolveIdentifierToUser` → `bcrypt.compare(password, user?.password ?? DUMMY_HASH)`. No session, no tokens, **no `getCooldown`/`recordFailure`**.
- `signIn` calls it and keeps its own cooldown/session logic.
- **Tests:** existing `signIn` tests green with no edits; `verifyCredentials` creates no session row and leaves `juvi:login-fail:*` untouched.
- Commit: `refactor(juvi): extract read-only verifyCredentials from signIn (011 T7)`

## T8 — the two rate-limiting mechanisms (two artifacts, not one)
**Files:** `modules/juvi-app/middleware/rate-limits.ts`; **new** `accounts/deletion-verify-budget.ts`; `accounts/cooldown.ts` (read-only reference) + tests

**(a) `deletionVerifyLimiter` (Story 3 AC3)** — export it from `rate-limits.ts` following the exported `signInLimiter = limiter(10)` shape (`:21`). IP-keyed, hard-blocking; its 429 reuses the factory's `handler` (`:14-16`).
- **Test:** construct the limiter directly and assert its 429 (e2e cannot — `E2E_TESTING=1` disables limiters).

**(b) the per-identifier budget (Story 3 AC6)** — **new file**, keyed `juvi:deletion-verify:<collegeId>:<hash-of-identifier>`: counted and **backed off / tarpitted, never hard-blocked**. It gets its own home because it is *not* a limiter — a 429 here would let an attacker lock a victim out of the app with five bogus requests, the exact failure AC6 prevents. **Do not call `cooldown.ts`**; the namespaces are key-disjoint by construction.
- **Test:** five failed public verifications leave `getCooldown` unblocked; the sixth attempt is still processed (slower, not refused).

- Commit (a): `feat(juvi): exported deletion-verify IP limiter (011 T8)`
- Commit (b): `feat(juvi): non-blocking per-identifier deletion-verify budget (011 T8)`

## T9 — `POST /v1/account-deletion`
**Files:** new `accounts/public-deletion-routes.ts`, `modules/juvi-app/routes.ts` (mount before `spacesRouter`) + tests
- Mounted in `v1Router` **before** `spacesRouter` (whose router-wide `authenticateMobile` would otherwise run first — `spaces/routes.ts:6`), with the same ordering comment as `routes.ts:20-25`. `spacesRouter` unmodified.
- Scoped `express.urlencoded({ extended: false })` **on this route only** (`app.ts:46-51` is json-only).
- CSRF: `Sec-Fetch-Site` when present must be `same-origin`; `Origin`/`Referer` when present must be in the CORS allowlist; **neither present → rejected**. Both signals, not primary-with-fallback.
- Sets the field on the **unset → set transition only** — repeat POSTs re-assert the date but append no second `request_deletion` row and send no second push (caller-side guard; `createAuditLog` is an unconditional `create`).
- Identical response whether or not the identifier exists. Actor is the **account id**, never the identifier; `entityType: 'JuviAccountPublicDeletion'`.
- **Tests (must include):** repeat POST (one audit row, one push, fresh clock); `Origin` present-but-not-allowed with `Sec-Fetch-Site: same-origin` → rejected; real-identifier-wrong-password vs nonexistent → byte-identical; reachable with **no** `Authorization` header.
- Commit: `feat(juvi): public web account-deletion request endpoint (011 T9)`

## T10 — the notification
**Files:** `models/juvi/NotificationDelivery.ts`, `modules/juvi-app/notifications/*` + test
- `source.type` / `source.kind` closed enums gain members; define a `source.id` for a non-notice notification (`NotificationDelivery.ts:16,50` — `:70` is the uniqueness index, not the field — not a drop-in reuse).
- Best-effort: a device-less account must not fail anything.
- **Test:** a device-less account's request still sets the field and still writes the audit entry.
- Commit: `feat(juvi): best-effort pending-deletion notification (011 T10)`

## Phase E — the sweep

## T11 — `QUEUE_NAMES` entry + sweep worker + registration
**Files:** `shared/queue/QueueManager.ts`, new `accounts/deletion-sweep-worker.ts` (also defines `DELETION_GRACE_DAYS = 7` and `JUVI_ACCOUNT_DELETION_SWEEP_ID = 'juvi-account-deletion-sweep'`), `backend/src/server.ts` + tests
- `QUEUE_NAMES.JUVI_ACCOUNT_DELETION: 'juvi_account_deletion'` in the closed `as const` registry (`:113-146`, Juvi names `:141-142`).
- Export `sweepAccountDeletions` (the `expireProposals` precedent, `proposal-expiry-worker.ts:29`) so tests need no Redis.
- Scan: `deletionRequestedAt: {$lte: deadline, $ne: null}`, **no `status` predicate**, `BATCH_SIZE = 500`, `.limit(BATCH_SIZE)`, `.lean()`.
- Claim: `findOneAndUpdate({ _id, deletionRequestedAt: {$lte: deadline, $ne: null} }, { $set: { deletionClaimedAt: new Date() } }, {new:true})` + `if (!claimed) continue;`, per-row `try/catch`. **`deletionClaimedAt` never becomes a third filter field.**
- `queue.upsertJobScheduler(JUVI_ACCOUNT_DELETION_SWEEP_ID, { every: 3_600_000 }, {name:'sweep', opts:{removeOnComplete:true, removeOnFail:true}})`; registered from `server.ts` inside the `DISABLE_BACKGROUND_JOBS !== 'true'` gate (`:20`); concurrency `1`.
- **Tests:** the scheduler id is stable across a changed interval; the scan uses the sparse index.
- Commit: `feat(juvi): recurring account-deletion sweep (011 T11)`

## T12 — the two regression tests
**Files:** `accounts/__tests__/deletion-sweep.test.ts`
1. `deletionRequestedAt` past the deadline with `status` **not** in `ELIGIBLE_STATUSES` (e.g. `exiting`) → the deletion **ran**. Fails the moment a status predicate returns.
2. Due account, field `$unset` between scan and claim → the deletion **did not** run.
- Both call `sweepAccountDeletions` directly.
- **Verify by mutation, not by reading:** temporarily reintroduce a `status` predicate / delete the `if (!claimed) continue;` and confirm each test goes red.
- Commit: `test(juvi): pin the sweep's query shapes (011 T12)`

## Phase F — the surfaces

## T13 — admin pending-deletion surface
**Files:** `modules/juvi-app/admin/routes.ts`, `admin/accounts-service.ts` + tests
- `GET /accounts/pending-deletion` on `adminRouter` — existing `authenticate` (`:18`) + `authorize('platform','read')` (`:30` precedent). ERP error envelope (`:41-42`).
- Query `{ collegeId: req.collegeId, deletionRequestedAt: {$ne: null} }` — **not** a global scan. `collegeId` not echoed per row.
- Returns id, requested-at, `deletionRequestedVia`, `deletionClaimedAt`. Detection rule is **age alone**.
- **Tests:** two-college isolation; a caller without `platform: read` gets 403.
- Commit: `feat(juvi): admin pending-deletion list (011 T13)`

## T14 — `GET /me` gains the two fields
**Files:** `accounts/me-service.ts`, `mobile/lib/core/models/models.dart` (+ `models.freezed.dart`, `models.g.dart`) (+ OpenAPI `Me` in T17) + tests
- Nullable `deletionRequestedAt` (ISO) + `deletionRequestedVia` on the backend payload.
- **The mobile model is in the same task on purpose:** `me_repository.dart:55-62` parses into the **local** freezed `Me` (`models.dart:126`), not the generated `wire.Me`, and freezed **drops unknown keys silently** — server-side only means the AC7 banner never fires, with no error. Add both fields and re-run codegen.
- **Tests:** backend — both present and `null` with no request; Dart — `Me.fromJson` exposes `deletionRequestedAt` (the test that fails if the model is forgotten). Mock `null` as `null` (R61).
- Commit: `feat(juvi): expose deletionRequestedAt on GET /me + mobile model (011 T14)`

## T15 — portal pending-deletions page + service
**Files:** `admin-portal/src/pages/**`, `admin-portal/src/services/**` + test
- Hand-written service call (no ERP OpenAPI document exists — §3.6). Age column must visibly separate past-grace from within-grace.
- **Test:** render against a mocked response; empty state.
- Commit: `feat(portal): pending-deletions list (011 T15)`

## T16 — the static public page
**Files:** new `admin-portal/public/account-deletion.html` (+ e2e)
- Plain HTML, **no script at all**, native `<form method="post">` → `POST /api/juvi-app/v1/account-deletion`. References app + developer name; features the deletion pathway prominently.
- **Plan-time checks:** nginx serves the file before any SPA fallback; the production same-origin topology is `ALLOWED_ORIGINS`-consistent (AC8's `Origin` check is unconditional-when-present, so a cross-origin page is rejected — a break, not a hole).
- **Tests:** served page contains no `<script>`; end-to-end submit against the real route.
- Commit: `feat(portal): public account-deletion page (011 T16)`

## Phase G — the contract

## T17 — OpenAPI + Dart regeneration
**Files:** `modules/juvi-app/openapi/document.ts`, generated Dart
- `deleteAccount` (`delete /me/account`, 204, `[401]`), `cancelAccountDeletion` (`delete /me/account/deletion-request`, 204, `[401,409]`), `Me` += nullable `deletionRequestedAt`/`deletionRequestedVia`.
- **The admin route is deliberately absent** — the only generator is the mobile document (`servers: ['/api/juvi-app/v1']`, one `tags:['mobile']`); a `/admin/…` entry would generate a 404 path and an unauthenticatable Dart method.
- **Gate:** generated client compiles; `flutter analyze` clean.
- Commit: `feat(juvi): declare the two deletes + Me fields in the mobile contract (011 T17)`

## Phase H — mobile

## T18 — the deletion wipe
**Files:** `lib/core/push/receipts.dart`, `lib/core/storage/secure_store.dart`, `lib/core/session/session_controller.dart` + test
- `ReceiptQueue.clear()` — **new** (`receipts.dart:33`).
- `SecureStore.clearLastAccount()` — **new**, next to `clearPendingLink()` (`:96`). Both are needed: `wipeAll()` is a 3-key allowlist (`:105-109`) covering neither.
- `_wipe()` (`session_controller.dart:159`) calls the new methods; `db.wipe()` already covers `kvCache`/`pending_actions`/`analytics_events` — verify, do not re-add.
- **Test:** all six surfaces empty after `_wipe()`.
- Commit: `feat(juvi): complete the local deletion wipe (011 T18)`

## T19 — Settings row + confirmation screen
**Files:** `lib/features/me/settings_screen.dart`, `lib/app/l10n/app_en.arb` + tests
- *Delete my Juvi account* row → confirmation screen with two explicit lists (what is deleted / what the college retains) and a **typed confirmation phrase**.
- All copy via `context.l10n`.
- **Tests:** the action is unreachable without the exact phrase; both lists render.
- Commit: `feat(juvi): delete-account screen with typed confirmation (011 T19)`

## T20 — the call and the failure path
**Files:** `lib/features/me/*`, `lib/core/session/session_controller.dart`, `lib/core/http/*` + tests
- Wipe **only after** the server confirms — never `signOut()`; must **not** call `authRepository.signOut()` or `pushRegistration.unregister()`.
- Failure/offline → nothing deleted locally, session stays live, failure shown.
- `401 SESSION_INVALIDATED` on **any** request → the same wipe.
- **Tests:** a failing delete leaves all six surfaces intact; a `401 SESSION_INVALIDATED` routes through the wipe.
- Commit: `feat(juvi): delete-then-wipe with a safe failure path (011 T20)`

## T21 — pending-request banner + Cancel
**Files:** `lib/features/me/settings_screen.dart`, app shell, l10n + tests
- Banner driven by `deletionRequestedAt` on `GET /me`; *Cancel* calls T6.
- **409 must render as *too late*** and must not clear the banner — the whole reason the 409 exists.
- **Tests:** 409 → too-late copy, banner stays; 204 → banner clears.
- Commit: `feat(juvi): pending-deletion banner with cancel (011 T21)`

## Phase I — the policy text

## T22 — the retention disclosure
**Files:** a draft policy document (not published)
- What is deleted (§3.1 hard-deleted set + reset fields), what is retained (ERP records, notice audience record, profile photo), and that a public request completes after the grace period.
- **Gate:** all three disclosure classes present; the grace period named. This is what the Play Data-safety answer is written from.
- Commit: `docs(juvi): account-deletion retention disclosure (011 T22)`

---

## Two things that gate the whole feature

- **T4's `isActive: true` assertion must pass on both paths** before anything ships — it guards the
  single worst failure mode here: destroying a person's ERP login.
- **T12's tests must be shown to fail by mutation**, not by reading. Round 3 failed precisely because
  a query-shape defect survived every other assertion.

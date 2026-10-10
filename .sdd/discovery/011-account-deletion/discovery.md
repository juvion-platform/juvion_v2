# Discovery — Juvi account deletion (011)

Phase 0. Maps the code that exists today, before the spec is scoped. All refs from
`origin/main` @ 2026-10-10.

## Why this exists

Google Play's User Data policy requires an app that lets users create an account to offer
**two** deletion paths — an in-app one and a publicly reachable web resource — and states that
*deactivation does not qualify* as deletion. Retention is permitted for regulatory reasons only
if disclosed. Sources: Google Play Console Help, "Understanding Google Play's app account
deletion requirements" and "User Data" policy.

**Scope trigger is arguable here.** The policy fires on "your app allows users to create an
account from within your app." Juvi users never create an account: the college provisions it and
issues a temporary password. The FAQ extends the trigger to being sent to an out-of-app sign-up
flow, which also does not apply. Product decision taken 2026-10-10: **build it anyway** — the
Data safety form must be answered regardless, and a reviewer may read the rule the other way.

## What a "Juvi account" actually is

A `JuviAccount` is a thin projection over records the college owns. It is **not** the identity.

`backend/src/models/juvi/JuviAccount.ts` — the whole document is:
`{ collegeId, personId, userId, kind, studentId?, facultyId?, staffId?, status,
onboardingStep, onboardingCompletedAt?, settings{quietHours,tiers,language}, lastSeenAt?,
lastReconciledAt?, transitions[], provisionedAt, provisionedBy }`.

Its `personId` / `userId` / `studentId` point at `Person` / `User` / `Student` — the college's
own records. Two hard constraints follow:

1. **`User` is shared with the ERP web login.** `provisioning-service.ts:124` states it:
   `// Never re-open an ERP login an admin disabled (the User is shared with the ERP web login).`
   Deleting the `User` would break that person's web login.
2. **`Student` / `Person` are records of record** — fees, attendance, exam results — which the
   college is obliged to retain. Deleting them is out of the question.

So "delete my account" can only mean: **revoke Juvi access and erase the Juvi-specific
footprint**, and disclose that the college's academic and financial records are retained.

## The Juvi-specific footprint (candidate deletion set)

| Model | File | Why it is Juvi-only |
|---|---|---|
| `JuviAccount` | `models/juvi/JuviAccount.ts` | The mobile account itself; settings, onboarding state, transitions |
| `MobileSession` | `models/juvi/MobileSession.ts` | Refresh-token hashes + `pushToken`; deleting these revokes access |
| `ChannelMembership` | `models/juvi/ChannelMembership.ts` | Juvi channel subscriptions (imported by the accounts module) |
| `JuviProvisionedCredential` | `models/juvi/JuviProvisionedCredential.ts` | The issued temp credential record |
| notice receipts | `models/juvi/NoticeRecipient.ts` | Per-person read/ack state on notices |

Retained and disclosed: `Person`, `User`, `Student`/`Faculty`/`Staff`, and the ERP modules'
own records.

## Deletion is durable — no reconciler resurrection

Checked explicitly, because a nightly sweep that recreated accounts would make deletion a lie:

- `JuviAccount.create` appears in **exactly one non-test place**: `provisioning-service.ts:135`,
  reached only from an admin-triggered provisioning run (`JuviProvisioningRun`).
- `spaces/reconcile-service.ts` reconciles **channels and memberships only**; its only touch on
  accounts is `updateMany({status: {$in: ELIGIBLE_STATUSES}}, {$set: {lastReconciledAt}})` at
  `:133`.
- Every other `JuviAccount` write is a `$set` on an existing document
  (`authenticate-mobile.ts:89` `lastSeenAt`, `me-service.ts:121` settings).

Product decision 2026-10-10: **the college may re-provision** — deletion revokes access and
clears the Juvi footprint, and a later provisioning run legitimately recreates the account. No
standing opt-out is recorded. This treats Juvi access as college-issued, like a library card.

## Existing surfaces the feature extends

### Backend — `backend/src/modules/juvi-app/`

- `accounts/routes.ts` — the established pattern is already there:
  `accountsRouter.delete('/me/devices/:id', authenticateMobile, meCtrl.revokeDevice)` and
  `accountsRouter.post('/me/devices/revoke-others', authenticateMobile, meCtrl.revokeOtherDevices)`.
  A `DELETE /me/account` mirrors these exactly.
- `accounts/me-controller.ts` — thin controllers: pull `req.collegeId` / `req.mobile`, call the
  service, `res.json`, `catch (e) { next(e) }`.
- `accounts/session-service.ts` — reusable revocation primitives already exist:
  `revokeSession(sessionId, reason)` `:148`, `revokeOtherSessions(accountId, keepSessionId, reason)` `:176`.
  `RevokeReason` (`MobileSession.ts:4`) is a closed enum: `sign_out | signed_out_elsewhere |
  password_changed | admin | deactivated | token_reuse | expired` — **there is no
  account-deletion reason**, and adding one is a schema-visible change.
- `errors.ts` — `MobileApiError(status, code, message)`, the mobile error envelope (distinct from
  the ERP's `AppError`).
- `openapi/` — a generated contract drives the Dart client (`mobile/packages/juvi_api`); a new
  endpoint means regenerating it.

### Mobile — `mobile/lib/`

- `features/me/settings_screen.dart` — a `ConsumerWidget` of `ListTile`s / `SwitchListTile`s
  (notification tiers, quiet hours, theme, language). This is where a "Delete my Juvi account"
  row belongs.
- `core/repos/me_repository.dart` — the `/me` client; **reads raw Dio, not the generated client**
  (the generator's nullable-object gap, `mobile/README.md` "Toolchain notes" R61). A new method
  here must follow that raw-Dio pattern and mock `null` fields as real `null`.
- `core/session/session_controller.dart` — sign-out clears local state; deletion must do the same
  and then land on sign-in.
- Local-only data to clear on the device: the drift `analytics_events` table, `ReceiptQueue`
  (shared prefs), `flutter_secure_storage`, and the FCM token.

### Web — the open question

`admin-portal/src/App.tsx:97-125` is **fully authenticated**: `/login` is the only public route,
every other route is wrapped in `ProtectedRoute` or `gated(...)`. There is **no public page
surface** in this repo.

Three candidate homes for the required public deletion resource, to be settled in the spec:

1. **Backend-served public page** — a public, unauthenticated route alongside the existing
   `GET /institutions/:code` public lookup (`config/routes.ts`). No new hosting; the URL is
   whatever the API domain is.
2. **Static page in the marketing site** — correct in spirit, but that site is outside this repo.
3. **New public route in admin-portal** — introduces the first unauthenticated page in that SPA,
   and the repo's only web app is a staff tool; a student-facing page there is a poor fit.

## Constraints the spec must honour

- Multi-tenancy: every query filters by `collegeId`; the deletion is scoped to the caller's own
  account from the JWT (`authenticateMobile`), never an id from the body.
- The public web path cannot be scoped by a JWT, so it needs its own identity verification and
  rate limiting — the same shape as `signInLimiter` (`middleware/rate-limits.ts`).
- Audit: the ERP convention is `createAuditLog(...)` on CUD. Deletion must leave a trail.
- The Dart client is generated from the OpenAPI document; the contract, the generated client, and
  the raw-Dio workaround must stay consistent.

# GATE 2 — Architecture validator report

**Feature:** 011-account-deletion
**Spec:** `.sdd/specs/011-account-deletion/spec.md`
**Discovery:** `.sdd/discovery/011-account-deletion/discovery.md`
**Reviewed at:** worktree `juvi-flutter-shell` (branch `fix/juvi-onboarding-back-dead-end`)
**Verdict:** **FAIL** — 0 CRITICAL, 3 HIGH, 4 MEDIUM, 2 LOW.

Two of the three HIGH findings are correctness defects in the spec's stated design
(the deletion set, and the public-path identity verification); the third is the §3.2
"Recommended" architecture resting on a mischaracterization of the only alternative.

---

## What I checked and found clean

**Module boundary (`backend/src/modules/juvi-app/accounts/`).** The mobile app is a
deliberate exception to the ERP conventions in `CLAUDE.md`. The accounts module is
`routes.ts` + `*-controller.ts` + `*-service.ts` + `schemas.ts` (`auth-controller.ts`,
`auth-service.ts`, `me-controller.ts`, `me-service.ts`, `schemas.ts`) — there is no
`controller.ts`, `service.ts`, `validation.ts` or `index.ts`, and services take a
`MobileContext` object (`me-service.ts:50` `getMe(ctx)`), not `collegeId` first. Errors use
`MobileApiError(statusCode, code, message)` (`errors.ts:19-29`), which itself extends
`AppError` with statusCode first. The ERP conventions (`index.ts`, `validation.ts`,
`performedBy` last, bare `AppError`) are confined to the **ERP-side** admin router
(`admin/routes.ts` uses `authenticate` + `authorize` + `AppError` + `errorHandler`).
The spec respects this boundary: §5 mandates the mobile error envelope, Story 2 AC1
mandates `authenticateMobile` and a route under `accountsRouter`, and §6 correctly names
`shared/audit.ts` for the trail. The new route belongs in `accounts/routes.ts` alongside
`DELETE /me/devices/:id` (`accounts/routes.ts:20`) with a thin `me-controller`/`me-service`
pair. No drift.

**Story 2 AC5 / AC6 (token invalidation, idempotency).** `authenticateMobile` resolves the
account by id at `middleware/authenticate-mobile.ts:41-42`; once the `JuviAccount` row is
gone it throws `invalid()` → 401 `SESSION_INVALIDATED`. A second call with the same access
token therefore short-circuits at the middleware with a defined 401, never a 500 — AC5/AC6
hold with no extra code.

**Story 2 AC2 (immediate revocation).** `MobileSession` rows are deleted → `getSessionState`
returns `'missing'` → 401 (`session-service.ts:184-199`). Even if the 60 s Redis `active`
cache (`session-service.ts:10` `ACTIVE_CACHE_SECONDS = 60`) is still populated, the account
lookup at `authenticate-mobile.ts:41-42` fails first, so a deleted account cannot use a live
token or a refresh token (`refresh` → `findRotatableSession` finds no row). ✓

**Story 2 AC3 (User untouched).** The deletion set is Juvi-only; `provisionPerson` still
finds the `User` at `provisioning-service.ts:105` and never re-opens a disabled ERP login
(`:124-127`). ✓

**Story 4 (re-provisioning is reachable).** The admin run is
`POST /api/juvi-app/admin/provisioning/runs` (`admin/routes.ts:22`) →
`createProvisioningRun` (`admin/provisioning-controller.ts:23`) → `runProvisioningJob`
(`admin/provisioning-worker.ts:47`), which scans active persons (`:27-45`) and calls
`provisionPerson` (`provisioning-worker.ts:70`). Because deletion removes the `JuviAccount`,
`provisioning-service.ts:102` finds no existing account and creates a fresh one with
`status: 'onboarding'` (`:135-147`) plus a new temporary credential (`:150-163`) — Story 4
AC1 is accurate. No standing marker is written; the reconciler only does
`JuviAccount.updateMany({status:{$in:ELIGIBLE_STATUSES}}, {$set:{lastReconciledAt}})`
(`spaces/reconcile-service.ts:133`) and never creates accounts — Story 4 AC2 is accurate.
Channel memberships are recomputed from the academic graph by `applyDiff`
(`reconcile-service.ts:119-131`), so deleting `ChannelMembership` does not strand the
re-provisioned user.

**§3.1 vs discovery.** Both list the same five models (`JuviAccount`, `MobileSession`,
`ChannelMembership`, `NoticeRecipient`, `JuviProvisionedCredential`); §3.3's claim that
`ACCOUNT_STATUSES` (`JuviAccount.ts:9`) is not extended is correct, and because sessions are
hard-deleted the closed `RevokeReason` enum (`MobileSession.ts:4`) needs no new member.

**Multi-tenancy.** The spec's §5 / Story 2 AC7 (every query filters by `collegeId`) matches
the module's own pattern (e.g. `me-service.ts:52-56`).

---

## Findings

### HIGH-1 — The deletion set hard-deletes `NoticeRecipient` rows, destroying the notice audience snapshot and the reach/ack audit

**Evidence**
- `spec.md:85` (§3.1 hard-deleted list: "`NoticeRecipient`s"); `spec.md:32` (Story 1 AC1 "notice read/acknowledged state").
- `backend/src/models/juvi/NoticeRecipient.ts:21-23` — *"One row per audience member: the audience snapshot and that person's state. `accountId` is null while the person is not on Juvi."*
- `NoticeRecipient.ts:47` — `accountId: { ref: 'JuviAccount', default: null }`; `NoticeRecipient.ts:88` — unique index `{ noticeId: 1, personId: 1 }` (identity is **per person**, not per account).
- `backend/src/modules/juvi-app/notices/recipient-service.ts:19-34` — `onAccountActivated` fills `accountId` on the person's `accountId: null` rows and **recounts** `Notice.counts.onJuvi` from the surviving rows.
- `backend/src/modules/juvi-app/notices/reach-service.ts:25,30` — the publisher Reach board is built from `NoticeRecipient` buckets (`acknowledged | seen | not_seen | not_on_juvi`).
- `backend/src/modules/juvi-app/notices/consumers.ts:122-129` — an acknowledgement also writes an `AuditLog` with `entityType: 'NoticeAcknowledgement'` and `changes.newValue.recipientId`; the dedupe check there reads the same key.

**Why it is a defect.** The row is the *audience snapshot* for a retained `Notice`, and it
exists precisely for people who are **not** on Juvi (`accountId: null`). Deleting rows by
`accountId`:
1. permanently lowers `Notice.counts.onJuvi` (recount happens only on activation, from the
   surviving rows — `recipient-service.ts:30-31`), retroactively falsifying a compliance/reach
   metric;
2. deletes the acknowledgement audit for a retained notice while the corresponding
   `'NoticeAcknowledgement'` `AuditLog` entry survives — a dangling reference;
3. means a later re-provision cannot restore the person's `addedLater: false` snapshot rows
   (`backfillAddedLater` only covers `addedLater: true` rows from the last 30 days —
   `recipient-service.ts:37-46`).

The spec conflates *Juvi-owned ack/read state* with the *institutional audience row*; the
discovery (`discovery.md:49`) already under-described it as "notice receipts". The model's own
comment documents the opposite design: the row outlives Juvi membership.

**Remedy.** Reset the Juvi-owned fields instead of deleting the row —
`{ $set: { accountId: null, seenAt: null, dismissedAt: null, remindedAt: null, ack: null } }`
(filtered by `collegeId` + `accountId`). This satisfies Story 1 AC1 ("notice read/acknowledged
state" gone) while keeping the snapshot, the reach counts and the ack audit intact. (Deleting
only the `ack` subdocument is an acceptable narrower variant.) If the product genuinely wants
the row gone, §3.1 must say so explicitly and the spec must accept the reach/audit loss.

---

### HIGH-2 — Story 3's public verification path misstates its reuse: `auth-service.signIn` mints a session and needs a `collegeId` + `device`; `credential-store` is unrelated to sign-in

**Evidence**
- `spec.md:146` (§6: "`identifier-resolver.ts` + `credential-store.ts` + `auth-service.signIn` — identity verification"); `spec.md:65-66` (Story 3 AC2 "reusing `identifier-resolver` + `credential-store`").
- `backend/src/modules/juvi-app/accounts/auth-service.ts:31-70` — `signIn` **creates a session and returns tokens**: `createSession(...)` at `:65`, `return { ...tokens, account }` at `:69`. It requires the account to exist (`:52` `JuviAccount.findOne`, `:55` `if (!user || !account || !ok)`).
- `backend/src/modules/juvi-app/accounts/schemas.ts:14-19` — `signInSchema` requires `collegeId` (a 24-hex ObjectId) **and** a full `device` object.
- `backend/src/modules/juvi-app/accounts/credential-store.ts:1-92` — only encrypts/decrypts `JuviProvisionedCredential` (the temporary-password vault). It plays **no** part in verifying a sign-in password.
- The actual verification path is `resolveIdentifierToUser` (`identifier-resolver.ts:10`) + `bcrypt.compare(password, user?.password ?? DUMMY_HASH)` (`auth-service.ts:53`) + the per-identifier cooldown (`cooldown.ts`, used at `auth-service.ts:32,41,56,64`).
- An "institution code" is not a `collegeId`; the code→ObjectId step is `institution-config.ts lookupInstitutionByCode`, used by `config/controller.ts:18-21` — a step §6 does not mention.

**Why it is a defect.** Reusing `signIn` verbatim would (a) mint a `MobileSession` that the
deletion then has to tear down, (b) demand a fabricated `device` payload the web page cannot
supply, and (c) return tokens — returning them from a *public, unauthenticated* page would
hand out mobile credentials. `credential-store` is simply the wrong module. A public page also
holds an institution *code*, not the ObjectId `signIn` demands, and §6 omits the resolution
step. This is a concrete, verifiable misstatement that would send the implementation down the
wrong path.

**Remedy.** Replace §6's `credential-store.ts` + `auth-service.signIn` with a
verification-only dependency set: `identifier-resolver.resolveIdentifierToUser`,
`bcrypt.compare` against `User.password`, the `cooldown` module, and
`config/institution-config.lookupInstitutionByCode` for the code→collegeId step. State in
Story 3 AC2 that the public path must **not** call `signIn` and must never return tokens.

---

### HIGH-3 — §3.2's "Recommended" backend-served page is inferior to a static page served by nginx, which the spec rejected on a mischaracterization

**Evidence**
- `spec.md:91-104` (§3.2 recommends a backend top-level `GET /account-deletion`; rejected alternative: "a new public route in `admin-portal` (wrong audience, new security surface for no gain)").
- `scripts/deploy.sh` header: *"nginx serves admin-portal/dist in place"* — the portal build output is already a **public static root**. `admin-portal/public/` exists (`favicon.svg`) and vite copies it verbatim into `dist/`, so a `admin-portal/public/account-deletion.html` ships to `dist/account-deletion.html` and is served by nginx at `/account-deletion.html` — publicly, unauthenticated, outside the React Router entirely, with no auth context and no backend change.
- `backend/src/app.ts:25-88` — the API has **no view engine, no static middleware and no `sendFile`** (verified: no `express.static`/`sendFile` anywhere in `backend/src`), app-level `helmet()` (default CSP sets `script-src 'self'`, which blocks inline scripts) and a JSON `errorHandler`; every route lives under `/api`.

**Why it is a defect.** The rejected alternative was dismissed by treating a *static asset*
as if it were a *React SPA route* — the two have entirely different audiences and surfaces,
and the static asset has **no** new security surface (nginx already serves the SPA's HTML/JS
unauthenticated; only the API calls require auth). The recommended option would be the first
HTML surface on a JSON API: it needs a hand-written HTML string (no template engine), CSP
handling under `helmet()` (`script-src 'self'` / `form-action 'self'`), and it adds exactly the
kind of new unauthenticated surface on the API host that §3.2 says it wants to avoid. The
static-page option also satisfies the spec's own stated criteria ("no new hosting", "a domain
the college already owns") at least as well.

**Remedy.** Prefer `admin-portal/public/account-deletion.html` served by nginx. Keep a small
public JSON **verification** endpoint on the API (the `configRouter` unauthenticated pattern at
`config/routes.ts:7` is the right precedent), but not the HTML. If the backend page is kept,
§3.2 must address helmet/CSP, the absent view engine, and the JSON error handler.

---

### MEDIUM-1 — §3.2 (and the discovery) misplace the "existing public `GET /institutions/:code` lookup"

**Evidence.** `spec.md:94-95` ("outside the authenticated `/api` surface and alongside the
existing public `GET /institutions/:code` lookup"); `discovery.md:112-113` repeats it. The
route is actually `configRouter.get('/institutions/:code', ...)` (`config/routes.ts:7`), mounted
via `v1Router` (`routes.ts:18`) and `/api/juvi-app` (`app.ts:86`) — i.e. it lives at
`/api/juvi-app/v1/institutions/{code}`, **inside** `/api`, with a mobile-JSON envelope.

**Why it is a defect.** The decision leans on a "precedent" that does not exist at the top
level; there is no non-`/api` route today, so `GET /account-deletion` would be the first.
This understates the novelty of the surface HIGH-3 argues against.

**Remedy.** Correct the reference in both documents and describe the proposed route as novel.

---

### MEDIUM-2 — Story 1 AC3's local-wipe list does not match the real wipe primitives (and omits what actually must be cleared)

**Evidence.** `spec.md:37-38` (AC3 names: "session, the drift `analytics_events` rows, the
`ReceiptQueue` in shared prefs, `flutter_secure_storage`, and the local FCM token").
- Real sign-out wipe: `mobile/lib/core/session/session_controller.dart:159-171` `_wipe()` = `SecureStore.wipeAll()` + `AppDatabase.wipe()`.
- `mobile/lib/core/storage/secure_store.dart:105-109` `wipeAll()` deletes only `_access`, `_refresh`, `_college` — the device id, the DB key, `juvi.pending_link` and `juvi.last_account` survive **by design** (`:93`, `:99-101`).
- `mobile/lib/core/storage/app_database.dart:243-247` `wipe()` clears `kvCache`, `pending_actions`, `analytics_events` (so it clears the cached personal `me`/`account` docs too, which AC3 does not name).
- `mobile/lib/core/push/receipts.dart:33-70` `ReceiptQueue` (shared-prefs key `juvi.push.receipts`) exposes only `read`/`add`/`remove` — **there is no `clear()`**, and `_wipe()` never touches shared prefs.

**Why it is a defect.** AC3 reads as if a single existing wipe covers the listed items; it does
not. A deletion flow built on `sessionController.signOut()`/`_wipe()` would leave the
`ReceiptQueue`, the theme preference (`theme_preference.dart:11` `juvi.theme_mode`) and
`juvi.last_account` — which literally stores `<collegeId>:<accountId>` (`secure_store.dart:98-101`)
— on the device, contrary to the AC and to a "delete my data" claim. Conversely AC3 omits the
drift cache docs and the pending-actions queue that must also go.

**Remedy.** Specify a dedicated deletion wipe: `_wipe()` **plus** clearing
`ReceiptQueue.key` (add a `clear()`), `SecureStore.clearPendingLink()`, and removing
`juvi.last_account`; and state explicitly that the drift `kvCache` and `pending_actions` are
cleared (not only `analytics_events`). Note AC3/AC4 also imply the delete path must **not**
call `authRepository.signOut()`/`pushRegistration.unregister()` (both would 401 against a
deleted account) — the wipe must run only after the server confirms.

---

### MEDIUM-3 — §5 sanctions bypassing the OpenAPI contract for the new endpoint via an inapplicable workaround

**Evidence.** `spec.md:130-133` presents "update `openapi/document.ts` and regenerate" **or**
"call the new endpoint over raw Dio following the established R61 workaround" as equal options.
`mobile/README.md` "Toolchain notes" R61 lists the **four** raw-Dio call sites and confirms
`me_repository.dart` is among them (`/me` and `/me/photo` — two of the four) — but the workaround
exists only for **nullable-object fields in a response** (`Me.student`/`faculty`,
`Config.minAppVersion`, …). The generator already supports a bodyless delete with `status: 204`:
`openapi/document.ts:147` (`signOut`), `:154` (`revokeDevice`), `:176` (`clearPushToken`).

**Why it is a defect.** A `DELETE /me/account` returning 204 has no response body and no
nullable-object field, so R61 does not apply. Sanctioning "skip `document.ts`" leaves the
mobile contract incomplete for a real endpoint and breaks the "the OpenAPI document is the
contract" invariant — for no benefit. (`me_repository.dart` being one of the R61 sites is
correct; the *reason* the spec attaches to it is not.)

**Remedy.** Require a `{ operationId: 'deleteAccount', method: 'delete', path: '/me/account', auth: true, status: 204, errors: [401] }` entry in `document.ts` and a regeneration; reserve raw Dio for the R61 cases only.

---

### MEDIUM-4 — Story 3 AC3 / §6 omit the per-identifier cooldown that sign-in verification actually uses

**Evidence.** `spec.md:68-69` (AC3 "same shape as `signInLimiter`"); `spec.md:145` (§6
`middleware/rate-limits.ts` → `limiter(n)`, `signInLimiter = limiter(10)`). Sign-in's
protection is **two** layers: the IP limiter **and** the per-identifier cooldown
`accounts/cooldown.ts` (`getCooldown`/`recordFailure`/`clearFailures`), wired at
`auth-service.ts:32-34,41,56,64`. `cooldown.ts` appears nowhere in the spec.

**Why it is a defect.** On a public, unauthenticated, password-checking endpoint the
per-identifier throttle is what stops cross-IP identifier enumeration; an IP-only limiter
("the same shape as `signInLimiter`") does not reproduce sign-in's protection, and Story 3 AC5
(no identifier-existence disclosure) depends on it.

**Remedy.** Name `cooldown.ts` in §6 and require it on the public verification path.

---

### LOW-1 — Story 2 AC4's audit description omits required `createAuditLog` fields

**Evidence.** `spec.md:52` ("entity, account id, actor, timestamp"); `shared/audit.ts:39-49`
and `:60-62` — `createAuditLog` requires `collegeId`, `entityType`, `entityId`, `entityName`,
`action` (enum, includes `'delete'`) and a **required** `changes: FieldChange[]`.

**Remedy.** Name the call (`action: 'delete'`, `entityType: 'JuviAccount'`, a `changes` entry).

### LOW-2 — The public page's verification endpoint is unspecified

**Evidence.** Story 3 AC2-AC4 describe verification and deletion but never say **where** the
verify POST lives (top-level page route? an `/api/...` route? which error envelope?). §3.2 only
bounds the *page*.

**Remedy.** State the verification endpoint's path and envelope in §3 (a public JSON route in
the `configRouter` style, mobile-JSON envelope) so the page and the API agree.

---

## Severity counts

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 4 |
| LOW | 2 |

**GATE 2 criterion (0 CRITICAL + 0 HIGH) is NOT met.**

HIGH titles: (1) deletion set hard-deletes `NoticeRecipient` rows, destroying the notice
audience snapshot and reach/ack audit; (2) Story 3's public verification path misstates its
reuse — `auth-service.signIn` mints a session and needs `collegeId`+`device`, and
`credential-store` is unrelated to sign-in; (3) §3.2's backend-served HTML page is inferior to
a static page in `admin-portal/public/` served by nginx, which the spec rejected on a
mischaracterization.

---

## Could not verify

- **The production nginx config itself is not in this repo.** HIGH-3 and MEDIUM-1 rely on the
  `scripts/deploy.sh` header comment ("nginx serves admin-portal/dist in place") plus vite's
  documented `public/`→`dist/` copy behaviour. The exact `try_files`/SPA-fallback rule was not
  available, so it was not possible to confirm that a static `account-deletion.html` always wins
  over an SPA fallback (it will for any config that serves an existing file first — the common
  case).
- **No live HTTP check** was performed (no running backend/nginx in this worktree); all backend
  claims are from source reads.
- **The Play Console policy wording** (the reason the feature exists) was taken from the spec and
  discovery; it was not independently fetched.

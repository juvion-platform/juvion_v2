# Juvi ID sign-in — Design

**Date:** 2026-10-13
**Status:** design for review. No implementation until this spec is approved and a plan exists.

**Supersedes:** the "one field, server resolves" direction discussed on 2026-10-12. That
direction (call it A) was to match roll number / employee code / email across colleges. This
design replaces the *key* instead of broadening the *lookup*, which drops A's cross-college
resolver, its new indexes on `rollNumber` and `employeeCode`, and its ambiguity fallback
entirely.

**Amends:** `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md` US-1 (S01) — see §13.

---

## 1. Problem

Sign-in needs a college before it can resolve a person, because nothing in the system
identifies a person uniquely across colleges:

- `User.email` is unique only per college (`backend/src/models/User.ts:39-46`).
- `Student.rollNumber` is unique only per college (`backend/src/models/people/Student.ts:221`).
- `Faculty.employeeCode` and `Staff.employeeCode` likewise (`Faculty.ts:208`, `Staff.ts:46`).

So the app must ask for the institution code first, and Foundation US-1 turned that constraint
into a feature: **AC1** made the code resolve to a college name and mark before credentials were
typed, and **AC5** remembered it for the next launch.

The cost lands on the person: they must know, keep and type a code before they can sign in — and
it is the only reason the app cannot answer "who are you?" from the one thing they already know.

## 2. Intent

Every Juvi account is issued a **unique Juvi identifier** at provisioning. It is the *only* thing
the sign-in field accepts. The college is derived from the resolved person instead of being
supplied by them.

### Non-goals

- Self-service recovery of a forgotten Juvi ID (§8).
- The public account-deletion web form does not change (§3, §14).
- No change to the ERP web login (`POST /api/auth/login`) or to `authenticateMobile`.
- No change to what a session may do once signed in.

## 3. Decisions

| # | Decision | Why — and what it costs if wrong |
|---|----------|----------------------------------|
| **D1** | The Juvi ID is minted and is the **only** key the app accepts; roll number, employee code and email stop working in the app. | Chosen by the user 2026-10-13. Cost if wrong: existing users must be reached with their ID before they next sign in; see §9's precondition and §15. |
| **D2** | A forgotten Juvi ID is recovered from the college office (console lookup), with no self-service endpoint. | The self-service door needs a cross-college email lookup — the machinery D1 deletes — on a new public route. Cost if wrong: someone who never learned their ID must contact the college; the ID is durable and the office can always read it. |
| **D3** | The public deletion form keeps `institutionCode` + identifier + password. | It is not a login, it ships under its own merged spec (011), and changing it would strand anyone following the current instructions. Cost if wrong: the college-scoped identifier path survives in the codebase for that one caller (§14). |
| **D4** | `juviId` lives on `User`, not `JuviAccount`. | `User` is the credential record, so `User.findOne({ juviId })` is the entire lookup and the password, `collegeId`, `isActive` and `personId` arrive in one document. Cost if wrong: one refactor of a field with a unique index behind it. |
| **D5** | The ID is stored canonical (uppercase, no separators); input is normalised before lookup. | `juv 4k7p 2m9x` and `JUV-4K7P-2M9X` must be one lookup when the value is read aloud and copied by hand. Cost if wrong: a person whose spacing differs cannot sign in. |
| **D6** | `ACCOUNT_DEACTIVATED` and the paused-college 503 stay, disclosed only after a correct password. | Preserves Foundation AC6. The new flow puts these checks after the password anyway, because the college is unknown before then. Cost if wrong: none identified — this is strictly less disclosure than the old flow allowed. |
| **D7** | The sign-in response gains a top-level `collegeId`. | Keeps the client's persisted owner key (`deep_link_resolver.dart:119`) in the same shape, so a notification link parked before the update still matches. Cost if wrong: one extra response field. |
| **D8** | The mobile institution-code field and its lookup call sites are removed; the `/institutions/{code}` endpoint stays. | Keeps the blast radius on the sign-in path. Cost if wrong: a documented endpoint with no client; retiring it is a follow-up (§14). |

## 4. The identifier

**Shape:** `JUV-4K7P-2M9X` — the literal prefix `JUV`, then eight characters from Crockford
base32 (digits plus `ABCDEFGHJKMNPQRSTVWXYZ`; `I`, `L`, `O` and `U` are excluded so a code
survives being read aloud and written on a slip). 40 bits, drawn from `node:crypto`'s `randomInt`
— the same source as the temporary password (`accounts/temp-password.ts:11`).

**Canonical form:** stored uppercase with no separators (`JUV4K7P2M9X`), displayed grouped
(`JUV-4K7P-2M9X`). Input is normalised by uppercasing and dropping every character that is not
`A–Z0–9`, so spacing, hyphens and case from the person's transcription never matter (D5).

**Not a secret.** It is printed, read aloud, and shown on a slip and in the app. Its entropy
protects against *enumerating the account space* to build a target list — it does not protect
against a direct guess. The password remains the secret, and the cooldown (§7) is what protects
it.

**Minted once, never re-minted.** A password reset re-issues the temporary password and reprints
the same ID. Minting happens in `provisionPerson`
(`accounts/provisioning-service.ts:93`), so every path that creates a Juvi account gets one: the
admission workflow (`admissions/workflow.handlers.ts:1549`), People faculty provisioning
(`people/service.ts:726`), bulk provisioning runs, and seed/dev through a `juviId` override that
mirrors the existing `temporaryPassword` override (`provisioning-service.ts:32`).

**Collisions.** The unique index is the guarantee, not the generator: retry on duplicate key,
bounded (5 attempts), then fail loudly rather than loop.

## 5. Data model

`User` gains an optional field and one index:

```ts
juviId: { type: String },

userSchema.index(
  { juviId: 1 },
  { unique: true, partialFilterExpression: { juviId: { $type: 'string' } } },
);
```

Partial, so the `User` rows that are not Juvi accounts stay out of the index entirely — ERP
admins, and `super_admin`, which carries no `collegeId` at all.

Nothing else changes. `JuviProvisionedCredential` is untouched: its `identifier` remains the roll
or employee code, which is what lets the college office match a printed slip to a person. The
Juvi ID is durable and is read from the account when a slip is printed (§8).

**Multi-tenancy.** Every query after the lookup keeps filtering by `collegeId`, taken from the
resolved `User`. The one exception is the lookup itself — an exact hit on a globally unique key,
which is a narrower exception than the previous design's cross-college scan, and is the
amendment to the Juvi code's ruling R10 that this spec makes.

## 6. Sign-in

Request:

```jsonc
{ "juviId": "JUV-4K7P-2M9X", "password": "…", "device": { /* unchanged */ } }
```

`signInSchema` (`accounts/schemas.ts:14`) drops `collegeId` and `identifier`, gains `juviId`
(trimmed, 1–32, normalised). The route is unchanged:
`POST /api/juvi-app/v1/auth/sign-in` behind `signInLimiter` (`accounts/routes.ts:10`).

**Flow — and the order is the security property:**

1. Normalise the ID, then `User.findOne({ juviId })`.
2. **Miss.** Compare against `DUMMY_HASH` exactly as the current flow does, so a miss costs what
   a real compare costs, then return the one generic 401.
3. **Hit.** Compare the password against the user's hash. Wrong → count a failure, one generic
   401.
4. **Only now is the college known.** Load the `JuviAccount` by `userId` and check that it exists
   and its status is eligible (`ELIGIBLE_STATUSES`, `models/juvi/JuviAccount.ts:12`); check
   `User.isActive`; then the college's Juvi enabled/paused state and the `minAppVersion` gate —
   all against `user.collegeId`.
5. Clear failures, create the session, clear any pending deletion request — all unchanged.

| Condition | Response |
|---|---|
| Unknown Juvi ID | 401 `INVALID_CREDENTIALS` — byte-identical to a wrong password |
| Wrong password | 401 `INVALID_CREDENTIALS`, failure counted |
| No Juvi account for the resolved user | 401 `INVALID_CREDENTIALS` |
| `User.isActive === false`, or account status not eligible | 403 `ACCOUNT_DEACTIVATED` + support contact |
| College Juvi paused or disabled | 503 `INSTITUTION_PAUSED` + the college's message |
| `minAppVersion` gate | `UPDATE_REQUIRED` + store URL |
| ≥ 5 failures / 10 min for this ID | 429 + `retryAfterSeconds` |

Every row below the first three is reachable only with a *correct* password. The
anti-enumeration property is therefore unchanged, and stronger than before: nothing before step 4
can reveal whether an ID exists.

`verifyCredentials` stays in place for its other caller — the public deletion form's
college-scoped check (D3) — so the two doors keep separate identity paths.

The session is unchanged: the JWT carries the resolved `collegeId`, so `authenticateMobile` and
every downstream service keep working exactly as they do today.

## 7. Rate limiting and cooldown

`cooldownKey(collegeId, identifier)` (`accounts/cooldown.ts`) becomes ID-keyed:
`juvi:login-fail:<hash(normalised juviId)>` — keeping the existing hash, so a plaintext ID never
lands in a Redis key. There is no college to scope by, and nothing to vary to escape the budget,
which the old key allowed by varying the college.

The per-IP limiter (`middleware/rate-limits.ts`) is unchanged and remains the first line.

**Consequence, stated deliberately:** the cooldown is now global per ID, so someone who knows an
ID can lock that person out for the window. That was already true within a college; the budget is
unchanged, only its scope.

## 8. Distribution and recovery

- **At provisioning.** The console's credential surface is `admin-portal/src/pages/platform/JuviAdminPage.tsx`
  with `components/platform/juvi/AccountsTable.tsx` and `CredentialsDownload.tsx`.
  `AccountsTable` gains a Juvi ID column, and the downloadable slip prints the Juvi ID above the
  temporary password — read from the **account** (durable), not from the credential row, whose
  only job is the 7-day secret (`credential-store.ts:5`).
- **In the app.** The `me/` surface shows the ID so a signed-in person can save it;
  `meResponseSchema` (`accounts/schemas.ts:79`) gains the field.
- **When forgotten.** The college office reads it off `AccountsTable` and tells the person (D2).
  No public endpoint, and nothing that answers "does this person exist?" to a stranger.

## 9. Migration

Two idempotent steps, in this order:

1. **Field + index.** Additive to `User`. Mongoose builds indexes on boot in dev; a script in
   `backend/src/scripts/` (the shape of `scripts/fix-student-rollnumber-index.ts`) creates it
   explicitly where `autoIndex` is off.
2. **Backfill.** For every existing `JuviAccount`, mint a `juviId` on its `User` if absent.
   Re-runnable, skips satisfied rows, reports how many it minted.

Deploy order: field + index, then backfill, then the sign-in change. Nothing reads `juviId`
before the backfill completes, so the window between them is safe.

**Precondition — atomicity.** This design assumes no Juvi app build is in a real user's hands yet
(as of 2026-10-13 the only device build is the local emulator, and the Play listing's data-safety
URL is still pending). **If any build has been distributed, the plan must add a compatibility
door:** the schema also accepts the legacy `{ collegeId, identifier, password, device }` shape
and the handler answers it with `UPDATE_REQUIRED` — a refusal, not a login — so an old build gets
"update the app" rather than an unexplained 400. Please confirm this precondition at review.

## 10. Mobile

- `sign_in_screen.dart`: delete `InstitutionCodeField` and its state; drop `_institution`,
  `_resolvedCode`, `_rememberedCode` and the `_rememberKey` preferences write; `_canSubmit`
  becomes ID + password (`:51`); the identifier field's label becomes the Juvi ID; the
  paused-college copy that rendered from `_institution.pausedMessage` (`:114`) now arrives only
  from the server's 503, as it already does on the app's other surfaces.
- `auth_repository.dart`: `signIn` takes `juviId` instead of `collegeId` + `identifier` (`:22`,
  `:58`) and sends the new wire body.
- `session_controller.dart`: `signIn` no longer takes `collegeId` (`:72`); `writeCollegeId` is fed
  from the response instead (`:78`) — D7, so `deep_link_resolver.dart:119`'s persisted owner key
  (`'<collegeId>:<accountId>'`) keeps its shape.
- `institution_accent.dart` and its generated part are **deleted**, with its test; `app.dart`
  watches `appConfigProvider` directly again. The institution lookup was the only accent source
  that exists before a session, so with the code field gone the sign-in screen renders the
  neutral ramp until sign-in — the accepted consequence of D1. This removes the fix in `5ed8f36`;
  branch `fix/mobile-pre-login-accent` stays unmerged and is superseded by this work.
- l10n: `institutionCodeLabel` and `institutionCodeNotFound` (`app_en.arb:5-6`) and their
  generated getters go; the Juvi ID gets a label and first-time help copy, and any copy that
  mentions the college code is rewritten.
- `AuthRepository.lookupInstitution` and `InstitutionIdentity` stay, unused by the app after this
  change (D8).

## 11. Contract and codegen

`backend/src/modules/juvi-app/openapi/document.ts` is the contract; `npm run openapi:mobile -w
backend` regenerates `mobile/api/openapi.json`, and the Dart client at `mobile/packages/juvi_api`
is generated from it. `SignInRequest`, `SignInResponse` (gaining `collegeId`) and `Me` (gaining
`juviId`) all change. CI fails on generated-file drift, so the JSON and the Dart client
regenerate in the same commit as the backend change.

## 12. Testing

- **Backend e2e** (`backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts`): sign-in by Juvi ID;
  unknown ID and wrong password produce byte-identical 401 bodies; a deactivated account with the
  right password gets `ACCOUNT_DEACTIVATED` and with a wrong password the generic 401; the
  paused-college 503 arrives only after a correct password; five failures then a correct password
  still 429s; a roll number that used to work no longer signs in.
- **Unit:** the generator's alphabet and length; normalisation (`juv 4k7p 2m9x` ≡ canonical); the
  cooldown key; bounded retry on collision with a stubbed generator.
- **Migration:** the backfill mints where missing, skips where present, and is re-runnable.
- **Mobile:** `sign_in_screen_test.dart` and `institution_accent_test.dart` (the latter deleted
  with its feature), `auth_repository_test.dart`, the sign-in flow fixtures updated to the new
  body, and a test that the ID is normalised before it is sent.
- **Portal:** `AccountsTable` and `CredentialsDownload` render the Juvi ID.

## 13. Spec impact

Against `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md`:

- **US-1 AC1 — deleted.** Its subject, the college name and mark before credentials, no longer
  exists: nothing knows the college before credentials.
- **US-1 AC5 — deleted.** There is nothing left to prefill.
- **US-1 AC2 — rewritten:** the Juvi ID resolves to the User; a wrong identifier and a wrong
  password return one identical 401 body.
- **US-1 AC4 — rewritten:** five failures within ten minutes *for one Juvi ID*.
- **US-1 AC6 — kept unchanged** (D6).
- **§ line 101** ("institution code + roll number or email or employee code + temporary …") is
  rewritten to the Juvi ID.

## 14. Out of scope

- Self-service Juvi-ID recovery (D2).
- Migrating the public deletion form onto the Juvi ID (D3). Its college-scoped check is why a
  college-scoped identifier path survives in the codebase at all — so "unique across Juvi" is a
  property of the **app login**, not of every credential check in the system. That distinction is
  deliberate and is recorded here so it is not mistaken for an oversight.
- Retiring `AuthRepository.lookupInstitution`, `InstitutionIdentity` and `/institutions/{code}`
  (D8).
- Parent and alumni access, locked out by the PRD.

## 15. Risks

| Risk | Mitigation |
|---|---|
| A person cannot sign in because they never received their Juvi ID | The slip is generated at provisioning, the office can always read the ID back (D2), and the app shows it once signed in. |
| An old app build meets the new contract | §9's precondition, and the compatibility door if any build is in the field. |
| The ID space is enumerated to build a target list | 40 bits, the per-IP limiter and the per-ID cooldown — and the ID is not the secret. |
| A known ID is used to lock its owner out | Budget unchanged; only the scope moved to the ID (§7). |
| Minting collides under load | Bounded retries and a loud failure; the unique index is the guarantee. |

## 16. Open questions

None. Every decision above is made: **D1** was chosen by the user, the rest are rulings recorded
here so they can be reviewed rather than discovered. The one thing asked of the reviewer is the
precondition in §9.

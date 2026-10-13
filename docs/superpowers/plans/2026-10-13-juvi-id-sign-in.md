# Juvi ID Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Juvi account is issued a minted, globally unique Juvi ID (`JUV-4K7P-2M9X`) that becomes the mobile app's only sign-in key, replacing the institution code plus roll number / employee code / email.

**Architecture:** A minted identifier is added to `User` behind a partial unique index, minted once inside `provisionPerson`, and looked up exactly. `signIn` becomes: normalise → `User.findOne({ juviId })` → compare password → *only then* is the college known, so every college-scoped check (Juvi account eligibility, `isActive`, enabled/paused, `minAppVersion`) moves behind a correct password. The cooldown re-keys from `(collegeId, identifier)` to the hashed ID alone, because there is no college to scope by.

**Tech Stack:** Node 20 / Express 4 / Mongoose 8 / TypeScript (strict) / Zod 3 / Vitest (unit + e2e) / Redis (`ioredis`) / bcryptjs; React 19 + Vite admin portal; Flutter + Riverpod + freezed; OpenAPI-driven Dart client (`openapi-generator-cli`, `dart-dio`).

**Spec:** `docs/superpowers/specs/2026-10-13-juvi-id-sign-in-design.md`

## Global Constraints

Copied verbatim from the spec's §3, §4, §5, §6, §7, §10 and §11. Every task's requirements implicitly include this section.

- **Identifier shape.** Display `JUV-4K7P-2M9X`; the literal prefix `JUV`, then eight characters of Crockford base32 — digits plus `ABCDEFGHJKMNPQRSTVWXYZ` (`I`, `L`, `O`, `U` excluded). 40 bits drawn from `node:crypto`'s `randomInt`.
- **Canonical form.** Stored uppercase with no separators (`JUV4K7P2M9X`). Input is normalised by **uppercasing and dropping every character that is not `A–Z0–9`** — do not add Crockford letter folding (`I`→`1`, `O`→`0`); the spec defines normalisation as exactly those two operations.
- **Minted once, never re-minted.** A password reset re-issues the temporary password and reprints the same ID.
- **The unique index is the guarantee, not the generator.** Retry on duplicate key, bounded at **5 attempts**, then fail loudly rather than loop.
- **`juviId` lives on `User`**, behind a **partial** unique index (`partialFilterExpression: { juviId: { $type: 'string' } }`) so `User` rows that are not Juvi accounts — ERP admins, and `super_admin`, which carries no `collegeId` — stay out of the index entirely.
- **Multi-tenancy.** Every query *after* the lookup keeps filtering by `collegeId`, taken from the resolved `User`. The lookup itself — an exact hit on a globally unique key — is the one exception, and is the amendment to the Juvi code's ruling R10 that this work makes.
- **Sign-in request** is `{ juviId, password, device }` (no `collegeId`, no `identifier`); the response gains a top-level `collegeId`.
- **Flow order is the security property.** Nothing before a correct password may reveal whether an ID exists. A miss compares against `DUMMY_HASH`; unknown ID, wrong password and "resolved user has no Juvi account" all return one byte-identical 401.
- **Cooldown** is 5 failures per 600 s, keyed `juvi:login-fail:<sha256(normaliseJuviId(id))>`; a plaintext ID never lands in a Redis key. The per-IP `signInLimiter` is unchanged.
- **`verifyCredentials(collegeId, identifier, password)` stays** (`accounts/auth-service.ts:47`) — the public account-deletion form is its other caller, and that form keeps `institutionCode` + identifier + password (spec D3). Do not touch it.
- **No change** to the ERP web login (`POST /api/auth/login`) or to `authenticateMobile`.
- **Error copy, verbatim:** `ACCOUNT_DEACTIVATED` → `'This account is no longer active at your institution.'`, and the envelope's `INVALID_CREDENTIALS` message stays `'That identifier or password is not right.'` — Task 4 compares that body byte-for-byte across the three 401 paths. The app never renders the envelope's copy for that code: the screen maps the code to its own string, and *that* string is the one a person reads, so it names the field they filled in — `'That Juvi ID or password is not right.'` (Task 8). The two differ deliberately.
- **`AppError` takes the status code first:** `new AppError(404, '…')`. `MobileApiError(statusCode, code, message, detail?)` — `detail` keys are spread *before* `code`/`message` in the envelope, so the third argument is the user-facing message.
- **TypeScript strictness:** `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`. Indexed reads need `!` or a guard (`ALPHABET[randomInt(n)]!` is the house style — see `accounts/temp-password.ts:11`).
- **Never** `git add -A`, `git add .` or `git add -u`. Path-scoped adds only.
- **CI contract drift:** `.github/workflows/contract.yml` fails when `backend/src/modules/juvi-app` changes without regenerating `mobile/api/openapi.json`. Run `npm run openapi:mobile -w backend` in the same commit as any `juvi-app` schema change (Tasks 4 and 5 both do).
- **Deploy order is Task 2 → Task 6 → Task 4** — index, backfill, then the sign-in change — which is not the commit order. The backfill is a hand-run script; run it against an environment *before* promoting the new sign-in build there. See ruling R-K.
- **Task 10 is conditional** — it is built only if the §9 precondition fails, i.e. a Juvi build is already in real users' hands. Do not build it "just in case": it accepts a request shape the product has retired, and every line of it is a live path on the sign-in route. Confirm the precondition at review.
- **Do not push, and do not open a PR, without being asked.**

## Rulings

The spec leaves these unsettled. They are decided here so an implementer does not improvise, and so a reviewer sees them rather than discovers them.

| # | Ruling | Why — and what it costs if wrong |
|---|--------|----------------------------------|
| **R-A** | The `minAppVersion` → `UPDATE_REQUIRED` gate is **not** duplicated inside `signIn`. It stays where it is enforced today, in `authenticateMobile` (`middleware/authenticate-mobile.ts:55-60`), on every authenticated request. | Spec §6 lists a `minAppVersion` row in the sign-in table, but that gate is not sign-in's to enforce: it lives in the auth middleware and runs on `/me` one request later. Duplicating it would put the college-config read and a version compare in the password path for no gain. Cost if wrong: an outdated build signs in, then gets 426 on its first authenticated call instead of at the sign-in response — one request's worth of difference. Task 4 pins the real behaviour with a test. |
| **R-B** | §6's `ELIGIBLE_STATUSES` check is implemented as written: an account whose status is `exiting` or `alumni` is refused with 403 `ACCOUNT_DEACTIVATED`. | Today `signIn` refuses only `status === 'deactivated'`, so this **widens** the refusal to two statuses that can sign in now. §6 asks for it explicitly and `ELIGIBLE_STATUSES = ['onboarding', 'active']` is already the canonical eligibility list (`models/juvi/JuviAccount.ts:12`). Cost if wrong: a graduating student loses app access at the point their account is marked `exiting` — deliberate, and pinned by a test so it is visible rather than surprising. |
| **R-C** | A `juviId` that does not normalise to the canonical shape is a **400 `VALIDATION_FAILED`** naming the shape, not a 401. | The single most likely migration failure is a person typing their roll number into the new field. `VALIDATION_FAILED` with the message "That doesn't look like a Juvi ID. It looks like JUV-4K7P-2M9X." turns that into actionable copy. It leaks nothing — the shape is printed on the slip. Cost if wrong: a caller probing the endpoint can tell a well-shaped ID from a malformed one; that distinction is public information. |
| **R-D** | The cooldown is read **before** the lookup and is one budget per *normalised* ID. | §7 makes the key the hashed ID, so `juv 4k7p 2m9x` and `JUV-4K7P-2M9X` spend the same budget. Reading it first also means a locked-out ID never reaches the database. Cost if wrong: someone who knows an ID can lock out its owner for the window — already true within a college today; only the scope moved (§7 states this consequence deliberately). |
| **R-E** | `signInAs` drops its `fx` parameter; all ~31 call sites drop the argument. | Once `collegeId` leaves the request body, `fx` is unused in the helper. `noUnusedParameters` would **not** catch it — TypeScript only reports *trailing* unused parameters, and `fx` is followed by used ones — so the compiler stays silent about a dead parameter. The signature has to change anyway. Cost if wrong: pure noise on the test helper. |
| **R-F** | `provisionPerson`'s mint-if-absent runs on the **early-return path too**, not only on a fresh create. | `provisionPerson` returns early when a `JuviAccount` already exists (`accounts/provisioning-service.ts:102-103`), *before* it ever loads the `User`. A pre-existing account would therefore never be repaired by re-provisioning. §4's letter says minting happens in `provisionPerson`; its intent is that every Juvi account gets one. Moving the `User` load above the early return and calling `ensureJuviId` there too is a deliberate deviation toward the intent; the backfill script (Task 6) is the other repair path. Cost if wrong: one extra `User` read on a path that already does several. |
| **R-G** | `mobile/lib/features/auth/institution_accent.dart` is **not** deleted by this work — it does not exist on this branch. | The spec's §10 line about deleting it refers to the unpushed branch `fix/mobile-pre-login-accent` (`5ed8f36`), which this work supersedes and which stays unmerged. `mobile/lib/app/app.dart:16` watches `appConfigProvider` directly here. Cost if wrong: none; if that branch were ever merged, `app.dart` and the sign-in screen would conflict, which is the expected outcome of superseding it. |
| **R-H** | The cooldown re-key is **merged into the sign-in task** (Task 4), not a task of its own. | `cooldownKey`'s arity change has exactly one production caller (`signIn`) and its call sites cannot be adapted without the new request shape. There is no green intermediate state between "cooldown is ID-keyed" and "sign-in takes a Juvi ID", so splitting them would force a throwaway edit. Cost if wrong: one larger diff to review; both halves are pinned by their own tests. |
| **R-I** | The Dart client regeneration (`tool/gen_api.sh`) happens **once**, in Task 8, after both backend contract changes (Tasks 4 and 5). | `mobile.yml` runs the drift check only on a PR/push to `main`, so intermediate commits on this branch may carry Dart drift without CI complaining. Task 8 is the first Dart work and needs the regenerated `SignInRequest`. Cost if wrong: a mid-branch commit whose generated Dart client lags the JSON by one commit; the branch as a whole is in sync. |
| **R-J** | `Me.juviId` is **nullable**, not required — `z.string().nullable()`, always present, `null` only for an account the backfill has not reached. | `mobile/tool/check_nullable_objects.js` only rejects *object*-or-null response fields, so `String?` is safe to generate, and a required key would make the generated client's `$checkKeys` throw on a response that omits it — precisely the failure mode of the `attention.kind` fixtures tracked as PR #111. The alternative (required, backfill assumed complete) buys nothing and makes an un-backfilled account crash the app's first screen. Cost if wrong: one nullable Dart field the UI must handle anyway, since the account screen has to render *something* when the ID is absent. |
| **R-K** | The **deploy order is Task 2 → Task 6 → Task 4**, which is *not* the commit order; the backfill is a hand-run script and must be run against any environment before that environment promotes the new sign-in build. | Spec §9 fixes this order and the reason is real: once the new `signIn` is serving, a `User` with no `juviId` cannot be looked up at all, so every pre-existing account gets a 401 until the backfill runs. Commits are not deploys — the branch merges as one unit, and the operator runs the backfill first. Cost if wrong: existing users are locked out of the app for the length of the gap, and the fix is to run the script. Task 6's commit message and the script's doc comment both carry the instruction. |
| **R-L** | Task 7 inserts the `juviId` CSV column **after `identifier`**, before `temporaryPassword`, giving the header `identifier,name,section,juviId,temporaryPassword,institutionCode`. | The slip is a flat CSV whose only consumer is a human reading a printout (`CredentialsDownload.tsx` renders no table of its own — the slip *is* the backend CSV). Keeping the two identifiers adjacent — the roll/employee code the office matches on, next to the Juvi ID the person signs in with — is the reading order that matters. There is no positional consumer to break. Cost if wrong: a column-order diff to re-do in one place. |
| **R-M** | Task 7 also makes the accounts table **searchable by Juvi ID** (normalised, so any spelling finds it), and shows the ID in **canonical** form rather than grouped. | D2 makes "the office reads the ID back to whoever calls" the recovery path, so the one value the caller knows must be searchable — a table of thousands with a column you can only read is not a recovery path. Canonical on both surfaces (table and slip) keeps one spelling of the value between the office's screen and the person's slip; a second, grouped spelling on one screen only would be a display difference with no source of truth. Cost if wrong: one extra `User` lookup per search, and a search box whose placeholder promises more than the spec asked for. |
| **R-N** | The app sends the Juvi ID **trimmed and otherwise untouched**; the normalisation rule (uppercase, drop everything outside `A–Z0–9`) exists **once**, in the backend's `normaliseJuviId`. No second Dart normaliser. | Spec §6 puts normalisation in `signInSchema` and the handler — the boundary that owns the rule, and the only one that can be trusted with it, since a client is not authoritative about its own input. §12's mobile bullet ("a test that the ID is normalised before it is sent") is therefore read as the *property* rather than the mechanism: Task 1's unit tests pin every spelling (`juv 4k7p 2m9x`, `JUV-4K7P-2M9X`, `juv4k7p2m9x`, `j.u.v-4k7p_2m9x`), Task 4's e2e test signs in with the spaced, lowercased form, and Task 8's mobile test pins that the field sends the value it was given, trimmed. A Dart copy of the alphabet would be a second rule to keep in step and would add nothing the server does not already do. Cost if wrong: if the intent was a client-side rewrite — so the field can show what will be sent — that is one expression in `sign_in_screen._submit` plus one test, with no server-side counterpart. |
| **R-O** | The ID's **shape on each surface**: the console's accounts table and the printed slip show it canonical (R-M — one spelling for the office to search and match on); the app's Me row shows it **grouped** (`JUV-4K7P-2M9X`), because that row exists for a person to read their own ID off their phone, which is what spec §4's "displayed grouped" rule describes; the app's copy button copies the **canonical** value, so a paste matches what the office's screen shows. | Grouping is presentation, and presentation is the client's; normalisation is identity and is the server's alone (R-N). Those are different kinds of rule and the plan keeps them apart rather than deriving one from the other. The grouping helper is private to `me_screen.dart` — one consumer, so no shared Dart formatter to keep in step with `formatJuviId`. Cost if wrong: two spellings in the world, which the normaliser already reconciles — a person may type either, and both resolve. |

## Review Focus

The five input classes and failure modes the spec implies but whose tests are not obvious from it, most likely first. Each is pinned by a test in the task that owns the code; the task's own steps carry it.

1. **A Juvi ID transcribed the way a person actually writes it** — `juv 4k7p 2m9x`, `JUV-4K7P-2M9X`, `juv4k7p2m9x`, with a stray space at either end. A reasonable person expects all four to sign them in. → Task 1 (unit: `normaliseJuviId`) and Task 4 (e2e: sign in with the spaced, lowercased form).
2. **Something that cannot be a Juvi ID being typed into the field** — a roll number (`21CS1042`), an email, an employee code. A reasonable person expects to be told *what the field wants*, not told their password is wrong. → Task 4 (e2e: 400 `VALIDATION_FAILED` with `fields[0].path === 'juviId'` and the shape-naming message).
3. **An account whose status is `exiting` or `alumni` signing in with the correct password.** Today that succeeds; §6 makes it a 403. A reasonable person expects a deliberate, explained refusal rather than a silent change. → Task 4 (e2e: `ACCOUNT_DEACTIVATED` for an `exiting` account, 200 for the same account at `active`) — ruling R-B.
4. **A pre-existing Juvi account whose `User` never got an ID** — provisioned before this change, never re-provisioned. A reasonable person expects re-provisioning or the backfill to repair it rather than leaving them permanently unable to sign in. → Task 3 (e2e: re-provision repairs) and Task 6 (script: backfill mints, skips, re-runs).
5. **A `User` that holds a Juvi ID but carries no `collegeId`** (`super_admin`), and a locked-out ID re-tried under a different spelling. A reasonable person expects a clean 401, never a 500 from a Mongoose cast, and one shared budget. → Task 4 (e2e: college-less user → 401 not 500; one budget across spellings).

## File Structure

**Backend — new files**

| Path | Responsibility |
|---|---|
| `backend/src/modules/juvi-app/accounts/juvi-id.ts` | The whole identifier: alphabet, canonical regex, `normaliseJuviId`, `mintJuviId`, `formatJuviId`. One module, no database, no config. |
| `backend/src/modules/juvi-app/accounts/__tests__/juvi-id.test.ts` | Unit tests for the above. |
| `backend/src/scripts/ensure-juvi-id-index.ts` | Creates the partial unique index explicitly where `autoIndex` is off. Mirrors `scripts/fix-student-rollnumber-index.ts`. |
| `backend/src/scripts/backfill-juvi-ids.ts` | Mints a `juviId` for every existing `JuviAccount`'s `User` that lacks one. Idempotent, reports a count. |
| `backend/src/__e2e__/modules/juvi-app-juvi-id-backfill.e2e.test.ts` | The backfill mints, skips, re-runs and repairs — an e2e test, not a unit test, because the selection it exercises is two collections and an update. |
| `backend/src/__e2e__/modules/juvi-app-juvi-id-index.e2e.test.ts` | Index behaviour (duplicates rejected, multiple absent IDs allowed) — unit tests have no database. |
| `backend/src/__e2e__/modules/juvi-app-juvi-id-minting.e2e.test.ts` | Provisioning mints, is idempotent, repairs, and honours the override. |

**Backend — modified files**

| Path | Change |
|---|---|
| `backend/src/models/User.ts` | `juviId?: string` on `IUser`, `juviId` on the schema, the partial unique index. |
| `backend/src/modules/juvi-app/accounts/provisioning-service.ts` | `juviId?: string` on `ProvisionPersonInput`; `ensureJuviId()`; `provisionPerson` mints (including on the early-return path). |
| `backend/src/modules/juvi-app/accounts/cooldown.ts` | ID-keyed: `cooldownKey`/`getCooldown`/`recordFailure`/`clearFailures` take the ID alone. |
| `backend/src/modules/juvi-app/accounts/__tests__/cooldown.test.ts` | Re-keyed to the new signature. |
| `backend/src/modules/juvi-app/accounts/__tests__/deletion-verify-budget.test.ts` | Two assertions re-keyed (the budget is key-disjoint from the cooldown). |
| `backend/src/modules/juvi-app/accounts/identifier-resolver.ts` | Adds `resolveJuviIdToUser(juviId)`. The existing college-scoped resolver stays for the deletion form. |
| `backend/src/modules/juvi-app/accounts/schemas.ts` | `signInSchema` → `{juviId, password, device}` with the shape refine; `signInResponseSchema` gains `collegeId`; `meResponseSchema` gains `juviId`. |
| `backend/src/modules/juvi-app/accounts/auth-service.ts` | `signIn` rewritten to the new order; `verifyCredentials` untouched. |
| `backend/src/modules/juvi-app/accounts/me-service.ts` | Reads and returns `juviId`. |
| `backend/src/modules/juvi-app/openapi/document.ts` | Sign-in summary; regenerated schemas. |
| `backend/src/modules/juvi-app/admin/accounts-service.ts` | `AccountRow.juviId`, joined from `User`. |
| `backend/src/modules/juvi-app/admin/provisioning-service.ts` | `credentialsCsv` gains a `juviId` column immediately before `temporaryPassword`. |
| `mobile/api/openapi.json` | Regenerated (Tasks 4, 5). |
| `backend/src/seed.ts` | The demo block's closing log prints the two minted IDs. |

**Test files swept (backend)**

| Path | Change |
|---|---|
| `backend/src/__e2e__/factories/juvi.factory.ts` | `provisionTestStudent` returns `juviId`; `provisionTestFaculty` too. |
| `backend/src/__e2e__/factories/notice.factory.ts` | `signInAs(app, identifier, password, deviceId?)` — `fx` dropped. |
| `backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts` | Rewritten to the Juvi ID contract. |
| `backend/src/__e2e__/modules/*.e2e.test.ts` (12 files, ~31 call sites) | `signInAs` call sites re-argued; direct `auth/sign-in` POSTs send `juviId`. |
| `backend/src/__e2e__/modules/juvi-app-admin-accounts.e2e.test.ts` | Rows gain `juviId`. |
| `backend/src/__e2e__/modules/juvi-app-admin-provisioning.e2e.test.ts` | CSV header and row shape. |
| `backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts` | `juviId` in the `me` body. |

**Admin portal**

| Path | Change |
|---|---|
| `admin-portal/src/services/juvi-app.ts` | `AccountRow` gains `juviId: string \| null`. |
| `admin-portal/src/components/platform/juvi/AccountsTable.tsx` | Juvi ID column, `colSpan` 7 → 8, search placeholder. |
| `admin-portal/src/components/platform/juvi/__tests__/AccountsTable.test.tsx` | Fixture gains `juviId`; a cell assertion. |

**Mobile**

| Path | Change |
|---|---|
| `mobile/lib/core/repos/auth_repository.dart` | `signIn({required String juviId, …})`; sends the new wire body; returns `collegeId`. |
| `mobile/lib/core/session/session_controller.dart` | `signIn({required String juviId, …})`; `writeCollegeId` fed from the response. |
| `mobile/lib/features/auth/sign_in_screen.dart` | Code field deleted; one Juvi ID field; prefs write gone. |
| `mobile/lib/features/auth/institution_code_field.dart` | **Deleted.** |
| `mobile/lib/app/l10n/app_en.arb` | `institutionCodeLabel`, `institutionCodeNotFound`, `identifierLabel` and `firstTimeHint` gone; `juviIdLabel` and `juviIdFirstTimeHint` replace them; `invalidCredentials` names the Juvi ID; `meJuviIdCopied` added. The generated `app_localizations*.dart` are tracked files and regenerate in the same commit. |
| `mobile/lib/core/models/models.dart` | `Me` gains `String? juviId`; `build_runner` regenerates `models.freezed.dart`/`models.g.dart`. |
| `mobile/lib/features/me/me_screen.dart` | A Juvi ID row in the About section: grouped for reading, tap to copy canonical (R-O). |
| `mobile/packages/juvi_api/**` | Regenerated (Task 8). |
| `mobile/test/**` | `sign_in_screen_test.dart`, `sign_in_flow_test.dart`, `session_controller_test.dart` re-pointed; `me_screen_test.dart` gains the row's test and `me_repository_test.dart`'s `meJson` gains the key. |

**Not touched:** `backend/src/modules/juvi-app/accounts/deletion-service.ts`, the public deletion form's route and schema, `verifyCredentials`, `authenticateMobile`, `backend/src/routes/auth.ts`, `CredentialsDownload.tsx`, and `mobile/lib/features/auth/institution_accent.dart` (does not exist here — R-G).

Spec §12's portal bullet names `CredentialsDownload` alongside `AccountsTable`, and this plan still leaves it alone: that component renders only the credential *groups* and a download button (`CredentialsDownload.tsx:47` — it never parses or displays a CSV column), so the Juvi ID reaches a person through the slip the **backend** generates. Task 7 pins that file's header and rows byte-for-byte, which is the behaviour §12 is asking about; there is nothing in the component to change or test.

---

## Task 1: The Juvi ID — alphabet, normalisation, minting

Everything about the identifier that is not a database concern lives in one module with no imports beyond `node:crypto`. This is the module every later task consumes; its exact names are fixed here.

**Files:**
- Create: `backend/src/modules/juvi-app/accounts/juvi-id.ts`
- Test: `backend/src/modules/juvi-app/accounts/__tests__/juvi-id.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CANONICAL_JUVI_ID: RegExp` — `/^JUV[0-9A-HJKMNP-TV-Z]{8}$/`
  - `normaliseJuviId(input: string): string`
  - `mintJuviId(): string`
  - `formatJuviId(canonical: string): string`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/juvi-app/accounts/__tests__/juvi-id.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CANONICAL_JUVI_ID, formatJuviId, mintJuviId, normaliseJuviId } from '../juvi-id';

describe('juvi-id', () => {
  it('normalises case, spaces, hyphens and stray punctuation to one canonical value', () => {
    expect(normaliseJuviId('juv 4k7p 2m9x')).toBe('JUV4K7P2M9X');
    expect(normaliseJuviId('JUV-4K7P-2M9X')).toBe('JUV4K7P2M9X');
    expect(normaliseJuviId('  juv4k7p2m9x  ')).toBe('JUV4K7P2M9X');
    expect(normaliseJuviId('j.u.v-4k7p_2m9x')).toBe('JUV4K7P2M9X');
  });

  it('leaves a roll number that cannot be a Juvi ID failing the canonical shape', () => {
    expect(normaliseJuviId('21CS1042')).toBe('21CS1042');
    expect(CANONICAL_JUVI_ID.test(normaliseJuviId('21CS1042'))).toBe(false);
  });

  it('mints JUV plus eight Crockford characters, never I, L, O or U', () => {
    for (let i = 0; i < 200; i += 1) {
      const id = mintJuviId();
      expect(id).toMatch(/^JUV[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
      expect(CANONICAL_JUVI_ID.test(id)).toBe(true);
    }
  });

  it('formats a canonical id for display, and the display form normalises back', () => {
    expect(formatJuviId('JUV4K7P2M9X')).toBe('JUV-4K7P-2M9X');
    expect(normaliseJuviId(formatJuviId('JUV4K7P2M9X'))).toBe('JUV4K7P2M9X');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w backend -- juvi-id.test`
Expected: FAIL — `Failed to resolve import "../juvi-id"`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/modules/juvi-app/accounts/juvi-id.ts`:

```ts
import { randomInt } from 'node:crypto';

/**
 * Crockford base32 — digits plus the letters that survive being read aloud and
 * written on a slip. `I`, `L`, `O` and `U` are excluded: `I`/`1`, `O`/`0` and
 * `U`/`V` are the pairs a person mistranscribes.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BODY_LENGTH = 8;
const PREFIX = 'JUV';

/** Canonical stored form: `JUV` + eight alphabet characters, uppercase, no separators. */
export const CANONICAL_JUVI_ID = /^JUV[0-9A-HJKMNP-TV-Z]{8}$/;

/**
 * Input normalisation: uppercase, then drop every character that is not `A–Z0–9`.
 * Spacing, hyphens and case from the person's transcription never matter; the
 * canonical form is the only thing that is ever compared or stored.
 */
export function normaliseJuviId(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** 40 bits from `node:crypto`, the same source as the temporary password. */
export function mintJuviId(): string {
  let body = '';
  for (let i = 0; i < BODY_LENGTH; i += 1) body += ALPHABET[randomInt(ALPHABET.length)]!;
  return `${PREFIX}${body}`;
}

/** `JUV4K7P2M9X` → `JUV-4K7P-2M9X`, for slips and the app. */
export function formatJuviId(canonical: string): string {
  return `${canonical.slice(0, 3)}-${canonical.slice(3, 7)}-${canonical.slice(7)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w backend -- juvi-id.test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the whole unit suite and typecheck**

Run: `npm test -w backend && npm run typecheck -w backend`
Expected: green, zero type errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/juvi-app/accounts/juvi-id.ts backend/src/modules/juvi-app/accounts/__tests__/juvi-id.test.ts
git commit -m "$(cat <<'EOF'
feat(juvi): add the minted Juvi ID — alphabet, normalisation and formatting

The identifier that replaces the institution code as the app's login key:
JUV + 8 Crockford base32 characters, 40 bits from node:crypto's randomInt.
I, L, O and U are excluded so a code survives being read aloud; input is
normalised by uppercasing and dropping everything that is not A-Z0-9, so
spacing and case never matter.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `User.juviId` and its partial unique index

The field goes on `User`, not `JuviAccount` (spec D4): `User` is the credential record, so `User.findOne({ juviId })` returns the password, the `collegeId`, `isActive` and `personId` in one document. Unit tests have no database, so both the index's behaviour and the index script are pinned in e2e.

**Files:**
- Modify: `backend/src/models/User.ts`
- Create: `backend/src/scripts/ensure-juvi-id-index.ts`
- Test: `backend/src/__e2e__/modules/juvi-app-juvi-id-index.e2e.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `IUser.juviId?: string`
  - `ensureJuviIdIndex(): Promise<{ action: 'created' | 'already-correct' }>`
  - The index named `juviId_1` on the `users` collection.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__e2e__/modules/juvi-app-juvi-id-index.e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { User } from '../../models/User';
import { ensureJuviIdIndex } from '../../scripts/ensure-juvi-id-index';

const DUPLICATE_KEY = 11000;
let fx: BaseFixtures;

function newUser(fields: Record<string, unknown> = {}) {
  return {
    collegeId: new mongoose.Types.ObjectId(fx.collegeId),
    email: `${new mongoose.Types.ObjectId().toString()}@x.test`,
    password: 'x',
    name: 'Test User',
    role: 'student',
    ...fields,
  };
}

describe('User.juviId index', () => {
  beforeAll(async () => { await getTestApp(); });
  beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
  afterAll(async () => { await cleanupTestApp(); });

  it('rejects a second User with the same juviId', async () => {
    await User.create(newUser({ juviId: 'JUV4K7P2M9X' }));
    await expect(User.create(newUser({ juviId: 'JUV4K7P2M9X' }))).rejects.toMatchObject({ code: DUPLICATE_KEY });
  });

  it('is global, not per-college — the same id in another college is still a duplicate', async () => {
    await User.create(newUser({ juviId: 'JUV4K7P2M9X' }));
    await expect(
      User.create(newUser({ collegeId: new mongoose.Types.ObjectId(), juviId: 'JUV4K7P2M9X' })),
    ).rejects.toMatchObject({ code: DUPLICATE_KEY });
  });

  it('leaves every User without a juviId out of the index entirely', async () => {
    await User.create(newUser());
    await User.create(newUser());
    await User.create({ email: 'root@x.test', password: 'x', name: 'Super', role: 'super_admin' });
    await User.create(newUser({ juviId: null }));
    expect(await User.countDocuments({ juviId: { $exists: false } })).toBe(3);
  });

  it('recreates a dropped index, and is a no-op once it is in place', async () => {
    const collection = mongoose.connection.collection('users');
    await collection.dropIndex('juviId_1');
    expect(await ensureJuviIdIndex()).toEqual({ action: 'created' });
    const names = (await collection.indexes()).map((i) => i.name);
    expect(names).toContain('juviId_1');
    expect(await ensureJuviIdIndex()).toEqual({ action: 'already-correct' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -w backend -- juvi-app-juvi-id-index`
Expected: FAIL — `Failed to resolve import "../../scripts/ensure-juvi-id-index"`.

- [ ] **Step 3: Add the field and the index**

In `backend/src/models/User.ts`, add to the `IUser` interface after `personId?` (line 12):

```ts
  /** The Juvi app's only login key. Globally unique; minted once, never re-minted. */
  juviId?: string;
```

Add to the schema object after `personId` (line 29):

```ts
    juviId: { type: String },
```

Add a third index after the existing two (after line 46):

```ts
// The Juvi ID is the one key that is unique across every college, so the index is
// global. Partial, so the Users that are not Juvi accounts — ERP admins, and
// super_admin, which carries no collegeId at all — stay out of it entirely.
userSchema.index(
  { juviId: 1 },
  { unique: true, partialFilterExpression: { juviId: { $type: 'string' } } },
);
```

- [ ] **Step 4: Write the index script**

Create `backend/src/scripts/ensure-juvi-id-index.ts`:

```ts
/**
 * Create the users.juviId unique partial index where `autoIndex` is off.
 *
 * `juviId` is the Juvi app's only login key and the one key that is unique across
 * every college, so the index is global and unique. It is partial
 * (`partialFilterExpression: { juviId: { $type: 'string' } }`) so the Users that are
 * not Juvi accounts — ERP admins, and super_admin, which has no collegeId — are not
 * indexed under `undefined` and cannot collide with one another.
 *
 * There is no legacy index to drop: the field is new, so this only ever creates.
 * Idempotent — re-running once the index is in place is a no-op.
 *
 *   npx ts-node -r dotenv/config src/scripts/ensure-juvi-id-index.ts
 */
/* eslint-disable no-console */
import mongoose from 'mongoose';

const INDEX_NAME = 'juviId_1';

interface IndexInfo {
  name: string;
  partialFilterExpression?: Record<string, unknown>;
}

export async function ensureJuviIdIndex(): Promise<{ action: 'created' | 'already-correct' }> {
  const collection = mongoose.connection.collection('users');
  const indexes = (await collection.indexes()) as unknown as IndexInfo[];

  if (indexes.some((i) => i.name === INDEX_NAME && i.partialFilterExpression)) {
    console.log(`[ensure-juvi-id-index] ${INDEX_NAME} already partial — nothing to do.`);
    return { action: 'already-correct' };
  }

  await collection.createIndex(
    { juviId: 1 },
    { unique: true, partialFilterExpression: { juviId: { $type: 'string' } }, name: INDEX_NAME },
  );
  console.log(`[ensure-juvi-id-index] created ${INDEX_NAME} with a partial filter.`);
  return { action: 'created' };
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) {
    console.error('[ensure-juvi-id-index] MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    await ensureJuviIdIndex();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:e2e -w backend -- juvi-app-juvi-id-index`
Expected: PASS, 4 tests.

- [ ] **Step 6: Check nothing else in the suite depended on the old `User` shape**

Run: `npm test -w backend && npm run typecheck -w backend`
Expected: green. `juviId` is optional, so no existing `User.create` call needs it.

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/User.ts backend/src/scripts/ensure-juvi-id-index.ts backend/src/__e2e__/modules/juvi-app-juvi-id-index.e2e.test.ts
git commit -m "$(cat <<'EOF'
feat(juvi): put the Juvi ID on User behind a global partial unique index

User is the credential record, so one exact hit returns the password,
collegeId, isActive and personId together — the whole lookup. The index is
global because the Juvi ID is the one key unique across colleges, and
partial so ERP admins and super_admin (no collegeId) stay out of it.
ensure-juvi-id-index covers deployments where autoIndex is off.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Minting at provisioning

`provisionPerson` is the single door every Juvi account comes through — the admission workflow, People faculty provisioning, bulk runs, and seed/dev — so minting there means every path gets an ID (spec §4). Re-provisioning also becomes the repair path for accounts that predate this change (ruling R-F).

**Files:**
- Modify: `backend/src/modules/juvi-app/accounts/provisioning-service.ts`
- Modify: `backend/src/__e2e__/factories/juvi.factory.ts`
- Modify: `backend/src/seed.ts` (the Juvi demo block's closing log)
- Test: `backend/src/__e2e__/modules/juvi-app-juvi-id-minting.e2e.test.ts`

**Interfaces:**
- Consumes: `CANONICAL_JUVI_ID`, `mintJuviId`, `normaliseJuviId` (Task 1); `User.juviId` (Task 2).
- Produces:
  - `ensureJuviId(input: { collegeId: string; userId: string; juviId?: string }): Promise<string>` — exported from `provisioning-service.ts`.
  - `readJuviId(collegeId: string, userId: string): Promise<string | null>` — exported from the same file; the read half the backfill (Task 6) and the test fixtures use.
  - `ProvisionPersonInput.juviId?: string`
  - `provisionTestStudent` / `provisionTestFaculty` return an extra `juviId: string`.
  - `AppError` imported into `provisioning-service.ts`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__e2e__/modules/juvi-app-juvi-id-minting.e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { provisionTestStudent } from '../factories/juvi.factory';
import { createTestStudent } from '../factories/student.factory';
import { provisionPerson } from '../../modules/juvi-app/accounts/provisioning-service';
import { CANONICAL_JUVI_ID } from '../../modules/juvi-app/accounts/juvi-id';
import { User } from '../../models/User';

let fx: BaseFixtures;

function provisionStudentOf(personId: string, extra: Record<string, unknown> = {}) {
  return provisionPerson({ collegeId: fx.collegeId, personId, kind: 'student', source: 'admin', performedBy: 'test', ...extra });
}

describe('Juvi ID minting', () => {
  beforeAll(async () => { await getTestApp(); });
  beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
  afterAll(async () => { await cleanupTestApp(); });

  it('mints a canonical Juvi ID on the account user', async () => {
    const s = await provisionTestStudent(fx);
    expect(s.juviId).toMatch(CANONICAL_JUVI_ID);
  });

  it('gives two accounts different IDs', async () => {
    const a = await provisionTestStudent(fx);
    const b = await provisionTestStudent(fx);
    expect(a.juviId).not.toBe(b.juviId);
  });

  it('repairs a user whose ID was erased, and is stable once repaired', async () => {
    const s = await provisionTestStudent(fx);
    await User.updateOne({ _id: s.account.userId, collegeId: fx.collegeId }, { $unset: { juviId: 1 } });

    const again = await provisionStudentOf(String(s.person._id));
    expect(again.created).toBe(false);
    const repaired = (await User.findById(s.account.userId).select('juviId').lean())?.juviId;
    expect(repaired).toBeDefined();
    expect(CANONICAL_JUVI_ID.test(repaired!)).toBe(true);

    await provisionStudentOf(String(s.person._id));
    expect((await User.findById(s.account.userId).select('juviId').lean())?.juviId).toBe(repaired);
  });

  it('honours a juviId override, normalising it', async () => {
    const s = await createTestStudent(fx.collegeId, {
      batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id), programmeId: String(fx.btech._id),
    });
    const { account } = await provisionStudentOf(String(s.person._id), { juviId: 'juv-4k7p-2m9x' });
    expect((await User.findById(account.userId).select('juviId').lean())?.juviId).toBe('JUV4K7P2M9X');
  });

  it('rejects an override that cannot be a Juvi ID', async () => {
    const s = await createTestStudent(fx.collegeId, {
      batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id), programmeId: String(fx.btech._id),
    });
    await expect(provisionStudentOf(String(s.person._id), { juviId: '21CS1042' })).rejects.toThrow(/JUV-4K7P-2M9X/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -w backend -- juvi-app-juvi-id-minting`
Expected: FAIL — the first test fails with `expected undefined to match /^JUV…/` (minting does not exist yet).

- [ ] **Step 3: Add `ensureJuviId` to the provisioning service**

In `backend/src/modules/juvi-app/accounts/provisioning-service.ts`, add these imports below the existing ones:

```ts
import { AppError } from '../../../middleware/errorHandler';
import { CANONICAL_JUVI_ID, mintJuviId, normaliseJuviId } from './juvi-id';
```

Add `juviId` to `ProvisionPersonInput` after `temporaryPassword` (line 32):

```ts
  /** Seed/dev only: mint this Juvi ID instead of drawing one. Mirrors `temporaryPassword`. */
  juviId?: string;
```

Add the minting helper after `loadKindRow` (after line 91):

```ts
/** Bounded: the unique index is the guarantee, and a loop that never ends is not a retry. */
const MINT_ATTEMPTS = 5;

function isDuplicateKey(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;
}

/**
 * Give this User a Juvi ID if it has none, and return whichever one it ends up holding.
 *
 * `updateOne` with `juviId: { $exists: false }` in the filter, rather than assigning the
 * field and saving: a duplicate-key error on a `save()` leaves the in-memory document
 * ambiguous about what is actually stored, and the retry then works from a lie.
 *
 * The caller-supplied `juviId` (seed/dev) is taken as given — a collision there is a
 * configuration mistake to be shouted about, not a random draw to retry.
 */
export async function ensureJuviId(input: { collegeId: string; userId: string; juviId?: string }): Promise<string> {
  const scope = { _id: input.userId, collegeId: input.collegeId };
  const readBack = async (): Promise<string | null> =>
    (await User.findOne(scope).select('juviId').lean())?.juviId ?? null;

  const current = await readBack();
  if (current) return current;

  if (input.juviId !== undefined) {
    const canonical = normaliseJuviId(input.juviId);
    if (!CANONICAL_JUVI_ID.test(canonical)) {
      throw new AppError(400, `juviId override must look like JUV-4K7P-2M9X, got "${input.juviId}"`);
    }
    const res = await User.updateOne({ ...scope, juviId: { $exists: false } }, { $set: { juviId: canonical } });
    if (res.modifiedCount === 1) return canonical;
    const settled = await readBack();
    if (settled === canonical) return canonical;
    if (settled) throw new Error(`User ${input.userId} already holds juviId ${settled}`);
    throw notFound('User');
  }

  for (let attempt = 0; attempt < MINT_ATTEMPTS; attempt += 1) {
    const candidate = mintJuviId();
    try {
      const res = await User.updateOne({ ...scope, juviId: { $exists: false } }, { $set: { juviId: candidate } });
      if (res.modifiedCount === 1) return candidate;
      // Nothing modified: a concurrent call stored one first, or the User is gone.
      const settled = await readBack();
      if (settled) return settled;
      throw notFound('User');
    } catch (e) {
      if (isDuplicateKey(e)) continue;
      throw e;
    }
  }
  throw new AppError(500, `Could not mint a Juvi ID after ${MINT_ATTEMPTS} attempts`);
}

/** `JUV4K7P2M9X` for a User that has one; `null` when it does not. */
export async function readJuviId(collegeId: string, userId: string): Promise<string | null> {
  return (await User.findOne({ _id: userId, collegeId }).select('juviId').lean())?.juviId ?? null;
}
```

- [ ] **Step 4: Mint in `provisionPerson`**

Replace lines 101-107 of `provisionPerson` — the early return and the `User` load — with this order (ruling R-F: the `User` load moves above the early return so a pre-existing account is repaired):

```ts
  // The User is loaded before the early return: an account that predates the Juvi ID still
  // needs one, so re-provisioning is a repair path, not just an idempotent no-op (ruling R-F).
  let user: IUser | null = await User.findOne({ collegeId: input.collegeId, personId: input.personId });

  // Existing account: nothing else to do (idempotent).
  const existing = await JuviAccount.findOne({ collegeId: input.collegeId, personId: input.personId });
  if (existing) {
    if (user) await ensureJuviId({ collegeId: input.collegeId, userId: String(user._id), juviId: input.juviId });
    return { account: existing, created: false, userCreated: false };
  }
```

Then delete the now-duplicated `let user: IUser | null = await User.findOne({ collegeId: input.collegeId, personId: input.personId });` line that followed (the old line 105), leaving:

```ts
  let userCreated = false;
  let temporaryPassword: string | undefined;
```

Then, immediately after the `if (!user) { … } else if (resetPassword) { … }` block (the old line 132) and before `const quiet = …`, add:

```ts
  const juviId = await ensureJuviId({ collegeId: input.collegeId, userId: String(user._id), juviId: input.juviId });
```

- [ ] **Step 5: Make the test factories carry the ID**

In `backend/src/__e2e__/factories/juvi.factory.ts`, add the import:

```ts
import { User } from '../../models/User';
import { readJuviId } from '../../modules/juvi-app/accounts/provisioning-service';
```

Then in `provisionTestStudent`, replace the last three lines (59-61) with:

```ts
  const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(person._id), kind: 'student', source: 'admin', performedBy: 'test' });
  const cred = await revealLatestForAccount(fx.collegeId, String(account._id));
  const juviId = (await User.findOne({ _id: account.userId, collegeId: fx.collegeId }).select('juviId').lean())!.juviId!;
  return { person, student, account, tempPassword: cred!.password, juviId };
```

And in `provisionTestFaculty`, replace the last three lines (66-68) with:

```ts
  const { account } = await provisionPerson({ collegeId: fx.collegeId, personId: String(f.person._id), kind: 'faculty', source: 'admin', performedBy: 'test' });
  const cred = await revealLatestForAccount(fx.collegeId, String(account._id));
  const juviId = (await readJuviId(fx.collegeId, String(account.userId)))!;
  return { ...f, account, tempPassword: cred!.password, juviId };
```

- [ ] **Step 6: Print the minted IDs in the dev seed**

In `backend/src/seed.ts`, immediately before the closing `console.log` of the Juvi demo block (the one that reads `Juvi demo sign-in — institution code JIT; …`), insert:

```ts
const demoStudentJuviId = demoStudent
  ? (await User.findOne({ collegeId: CID, personId: demoStudent.personId }).select('juviId').lean())?.juviId
  : undefined;
const demoFacultyJuviId = demoFaculty
  ? (await User.findOne({ collegeId: CID, personId: demoFaculty.personId }).select('juviId').lean())?.juviId
  : undefined;
```

and rewrite that `console.log` to:

```ts
console.log(`Juvi demo sign-in — student Juvi ID ${demoStudentJuviId ?? '(none)'} / faculty Juvi ID ${demoFacultyJuviId ?? '(none)'}; temporary password ${DEMO_TEMP_PASSWORD}`);
```

`User` is already imported at `backend/src/seed.ts:113`.

- [ ] **Step 7: Run the tests**

Run: `npm run test:e2e -w backend -- juvi-app-juvi-id-minting juvi-app-admin-accounts juvi-app-admin-provisioning`
Expected: `juvi-app-juvi-id-minting` PASS (5 tests). The two admin suites still pass — `provisionTestStudent` gained a field, so nothing they assert changes yet.

Then run: `npm test -w backend && npm run typecheck -w backend`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/juvi-app/accounts/provisioning-service.ts backend/src/__e2e__/factories/juvi.factory.ts backend/src/seed.ts backend/src/__e2e__/modules/juvi-app-juvi-id-minting.e2e.test.ts
git commit -m "$(cat <<'EOF'
feat(juvi): mint the Juvi ID in provisionPerson

One door, so every path that creates a Juvi account — admissions,
People, bulk runs, seed — gets an ID. Mint-if-absent runs on the
early-return path too, which makes re-provisioning the repair route for
accounts that predate this change, and the field is written with a
filtered updateOne rather than save() so a duplicate-key retry never
works from ambiguous document state.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Sign-in by Juvi ID — contract, handler, cooldown, and every caller

**This is the branch's largest diff and it lands in one commit.** The request shape, the handler, the cooldown key and all ~35 call sites in the e2e suite cannot be separated: the moment the request stops carrying `collegeId` and `identifier`, every existing sign-in in the suite is wrong. Ruling R-H merges the cooldown re-key here for the same reason — `cooldownKey`'s arity has exactly one production caller.

**Files:**
- Modify: `backend/src/modules/juvi-app/accounts/schemas.ts`
- Modify: `backend/src/modules/juvi-app/accounts/identifier-resolver.ts`
- Modify: `backend/src/modules/juvi-app/accounts/cooldown.ts`
- Modify: `backend/src/modules/juvi-app/accounts/auth-service.ts`
- Modify: `backend/src/modules/juvi-app/openapi/document.ts:147`
- Modify: `mobile/api/openapi.json` (generated)
- Modify: `backend/src/modules/juvi-app/accounts/__tests__/cooldown.test.ts`
- Modify: `backend/src/modules/juvi-app/accounts/__tests__/deletion-verify-budget.test.ts`
- Modify: `backend/src/__e2e__/factories/notice.factory.ts` (`signInAs`)
- Modify: `backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts` (rewritten)
- Modify: the 11 other e2e files that call `signInAs` or POST to `auth/sign-in`
- Modify: `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md` (design §13 — the ACs and sign-in blocks this change falsifies)

**Interfaces:**
- Consumes: `CANONICAL_JUVI_ID`, `normaliseJuviId`, `mintJuviId`, `formatJuviId` (Task 1); `User.juviId` (Task 2); `provisionTestStudent(...).juviId` (Task 3); `ELIGIBLE_STATUSES` from `models/juvi/JuviAccount.ts:12`.
- Produces:
  - `signInSchema` accepting `{ juviId, password, device }` (`ZodEffects` over the object)
  - `SignInInput` = `{ juviId: string; password: string; device: DeviceInfo }`
  - `signInResponseSchema` = tokens + `{ collegeId: string; account: AccountSummary }`
  - `resolveJuviIdToUser(juviId: string): Promise<IUser | null>`
  - `cooldownKey(juviId)`, `getCooldown(juviId)`, `recordFailure(juviId)`, `clearFailures(juviId)` — one argument each
  - `signInAs(app, juviId, password, deviceId?)` — `fx` dropped (ruling R-E)

- [ ] **Step 1: Write the failing test — rewrite the auth suite**

Replace the whole of `backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts` with:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient, TEST_DEVICE } from '../factories/juvi.factory';
import { MobileSession } from '../../models/juvi/MobileSession';
import { deactivateAccount } from '../../modules/juvi-app/accounts/provisioning-service';
import { User } from '../../models/User';
import { formatJuviId } from '../../modules/juvi-app/accounts/juvi-id';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';

/** Well-shaped, canonical, and assigned to nobody. */
const UNKNOWN_JUVI_ID = 'JUVZZZZZZZZ';

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId, { supportContact: { name: 'Exam Office', phone: '040-1' } }); });
afterAll(async () => { await cleanupTestApp(); });

function signIn(juviId: string, password: string, device = TEST_DEVICE) {
  // Not async: an async wrapper would unwrap the returned supertest Test (a thenable) into a
  // plain Promise, losing the `.expect()` chain callers rely on.
  return mobileClient(app).post(`${V1}/auth/sign-in`).send({ juviId, password, device });
}

describe('POST /auth/sign-in', () => {
  it('signs in with the Juvi ID and flags must-change', async () => {
    const s = await provisionTestStudent(fx);
    const res = await signIn(s.juviId, s.tempPassword).expect(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.accessExpiresIn).toBe(900);
    expect(res.body.collegeId).toBe(fx.collegeId);
    expect(res.body.account).toMatchObject({ kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingComplete: false, mustChangePassword: true });
    const session = await MobileSession.findOne({ accountId: s.account._id }).lean();
    expect(session?.deviceName).toBe('Test Phone');
  });

  // Review Focus 1 — the way a person actually writes the ID down.
  it('accepts the spaced, lowercased transcription of the same ID', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(formatJuviId(s.juviId).toLowerCase(), s.tempPassword).expect(200);
  });

  // Review Focus 2 — the likeliest migration mistake gets actionable copy, not a 401.
  it('400 VALIDATION_FAILED naming the shape when a roll number is typed in', async () => {
    const s = await provisionTestStudent(fx);
    const res = await signIn(s.student.rollNumber, s.tempPassword).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields[0].path).toBe('juviId');
    expect(res.body.error.fields[0].message).toBe("That doesn't look like a Juvi ID. It looks like JUV-4K7P-2M9X.");
  });

  it('no longer accepts the roll number or the email that used to work', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(s.student.rollNumber, s.tempPassword).expect(400);
    await signIn(s.person.email, s.tempPassword).expect(400);
  });

  it('returns one identical 401 body for wrong password and unknown Juvi ID', async () => {
    const s = await provisionTestStudent(fx);
    const a = await signIn(s.juviId, 'nope-nope-000').expect(401);
    const b = await signIn(UNKNOWN_JUVI_ID, 'nope-nope-000').expect(401);
    expect(a.body).toEqual(b.body);
    expect(a.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  // Review Focus 5 — a User that holds an ID but carries no college is a clean 401, never a 500.
  it('401s, and does not 500, for a User with a Juvi ID and no collegeId', async () => {
    await User.create({ email: 'root@x.test', password: '$2a$10$abcdefghijklmnopqrstuv', name: 'Root', role: 'super_admin', juviId: 'JUVROOT0000' });
    const res = await signIn('JUVROOT0000', 'anything').expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives ACCOUNT_DEACTIVATED only when the password is right', async () => {
    const s = await provisionTestStudent(fx);
    await deactivateAccount(fx.collegeId, String(s.account._id), 'admin', 'admin');
    const wrong = await signIn(s.juviId, 'bad-bad-000').expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const right = await signIn(s.juviId, s.tempPassword).expect(403);
    expect(right.body.error).toMatchObject({ code: 'ACCOUNT_DEACTIVATED', supportContact: { name: 'Exam Office' } });
  });

  // Review Focus 3 — §6's ELIGIBLE_STATUSES check (ruling R-B): a deliberate widening.
  it('refuses an exiting account, and accepts the same account while active', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(s.juviId, s.tempPassword).expect(200);
    await JuviAccount.updateOne({ _id: s.account._id, collegeId: fx.collegeId }, { $set: { status: 'exiting' } });
    const res = await signIn(s.juviId, s.tempPassword).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    await JuviAccount.updateOne({ _id: s.account._id, collegeId: fx.collegeId }, { $set: { status: 'active' } });
    await signIn(s.juviId, s.tempPassword).expect(200);
  });

  it('503 INSTITUTION_PAUSED with the pause message, and only after a correct password', async () => {
    const s = await provisionTestStudent(fx);
    await enableJuvi(fx.collegeId, { paused: true, pausedMessage: 'Back after exams.' });
    const wrong = await signIn(s.juviId, 'bad-bad-000').expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const res = await signIn(s.juviId, s.tempPassword).expect(503);
    expect(res.body.error).toEqual({ code: 'INSTITUTION_PAUSED', message: 'Back after exams.' });
    expect(await MobileSession.countDocuments({ collegeId: fx.collegeId, accountId: s.account._id })).toBe(0);
  });

  // Review Focus 5 — one budget, whichever way the ID is spelled.
  it('429s on the fifth failure and stays locked under the other spelling', async () => {
    const s = await provisionTestStudent(fx);
    for (let i = 0; i < 4; i += 1) await signIn(formatJuviId(s.juviId).toLowerCase(), 'bad-bad-000').expect(401);
    const fifth = await signIn(s.juviId, 'bad-bad-000').expect(401);
    expect(fifth.body.error.code).toBe('INVALID_CREDENTIALS');
    const locked = await signIn(s.juviId, s.tempPassword).expect(429);
    expect(locked.body.error).toMatchObject({ code: 'COOLDOWN' });
    expect(locked.body.error.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('replaces an earlier session for the same device', async () => {
    const s = await provisionTestStudent(fx);
    await signIn(s.juviId, s.tempPassword).expect(200);
    await signIn(s.juviId, s.tempPassword).expect(200);
    const sessions = await MobileSession.find({ accountId: s.account._id }).lean();
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((x) => !x.revokedAt)).toHaveLength(1);
  });

  it('400 VALIDATION_FAILED on a missing device', async () => {
    const res = await mobileClient(app).post(`${V1}/auth/sign-in`).send({ juviId: UNKNOWN_JUVI_ID, password: 'y' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields[0].path).toBe('device');
  });
});

describe('refresh, sign-out, change-password', () => {
  it('rotates the refresh token and revokes on replay', async () => {
    const s = await provisionTestStudent(fx);
    const first = (await signIn(s.juviId, s.tempPassword)).body;
    const rotated = await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: first.refreshToken, deviceId: TEST_DEVICE.id }).expect(200);
    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);
    const replay = await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: first.refreshToken, deviceId: TEST_DEVICE.id }).expect(401);
    expect(replay.body.error).toMatchObject({ code: 'SESSION_INVALIDATED', reason: 'token_reuse' });
    // The whole session is gone: the rotated token is dead too.
    await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: rotated.body.refreshToken, deviceId: TEST_DEVICE.id }).expect(401);
  });

  it('refuses refresh with 403 ACCOUNT_DEACTIVATED once the ERP login is disabled, without rotating the token', async () => {
    const s = await provisionTestStudent(fx);
    const first = (await signIn(s.juviId, s.tempPassword)).body;
    await User.updateOne({ collegeId: fx.collegeId, _id: s.account.userId }, { $set: { isActive: false } });

    const res = await mobileClient(app).post(`${V1}/auth/refresh`).send({ refreshToken: first.refreshToken, deviceId: TEST_DEVICE.id }).expect(403);
    expect(res.body.error).toMatchObject({ code: 'ACCOUNT_DEACTIVATED', message: 'This account is no longer active at your institution.', supportContact: { name: 'Exam Office' } });

    // Refused before rotation: the session and the token the client holds are untouched.
    const session = await MobileSession.findOne({ collegeId: fx.collegeId, accountId: s.account._id }).lean();
    expect(session?.revokedAt).toBeFalsy();
    expect(session?.previousRefreshTokenHash).toBeFalsy();
  });

  it('sign-out invalidates the next request', async () => {
    const s = await provisionTestStudent(fx);
    const { accessToken } = (await signIn(s.juviId, s.tempPassword)).body;
    await mobileClient(app, accessToken).post(`${V1}/auth/sign-out`).expect(204);
    const res = await mobileClient(app, accessToken).post(`${V1}/auth/sign-out`).expect(401);
    expect(res.body.error).toMatchObject({ code: 'SESSION_INVALIDATED', reason: 'sign_out' });
  });

  it('change-password clears the flag, kills the temp password and other sessions, keeps this one', async () => {
    const s = await provisionTestStudent(fx);
    const phoneA = (await signIn(s.juviId, s.tempPassword)).body;
    const phoneB = (await signIn(s.juviId, s.tempPassword, { ...TEST_DEVICE, id: 'device-2' })).body;

    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: 'wrong', newPassword: 'longenough1' }).expect(401);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: s.tempPassword, newPassword: 'short' }).expect(400);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/change-password`).send({ currentPassword: s.tempPassword, newPassword: 'longenough1' }).expect(204);

    await signIn(s.juviId, s.tempPassword).expect(401);
    const again = await signIn(s.juviId, 'longenough1', { ...TEST_DEVICE, id: 'device-3' }).expect(200);
    expect(again.body.account.mustChangePassword).toBe(false);
    await mobileClient(app, phoneA.accessToken).post(`${V1}/auth/sign-out`).expect(204);      // A survived until now
    const b = await mobileClient(app, phoneB.accessToken).post(`${V1}/auth/sign-out`).expect(401);
    expect(b.body.error.reason).toBe('password_changed');
  });
});
```

The `'refuses an identifier from another college'` test is **deleted, not adapted**: the request no longer names a college, so there is nothing to be wrong about. Its property — that an ID from one college cannot sign in against another — is now structural (the ID is globally unique and the college comes *from* it) and is pinned by Task 2's cross-college duplicate-key test.

Add the `JuviAccount` import to the test file's imports:

```ts
import { JuviAccount } from '../../models/juvi/JuviAccount';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -w backend -- juvi-app-auth`
Expected: FAIL — every test that signs in gets `400 VALIDATION_FAILED` (the schema still wants `collegeId` and `identifier`), and `provisionTestStudent(...).juviId` is `undefined` in the 400-naming test only if it passed the refactor — in short, a wall of failures, not one.

- [ ] **Step 3: Re-key the cooldown to the ID**

Replace `backend/src/modules/juvi-app/accounts/cooldown.ts` with:

```ts
import { createHash } from 'node:crypto';
import redis from '../../../config/redis';
import { normaliseJuviId } from './juvi-id';

export const COOLDOWN_MAX_FAILURES = 5;
export const COOLDOWN_WINDOW_SECONDS = 600;

/**
 * Keyed by the Juvi ID alone, hashed so the value itself never lands in Redis or logs.
 *
 * There is no college to scope by — the college comes *from* the ID — and nothing to vary to
 * escape the budget, which keying by college used to allow (spec §7). The consequence is stated
 * there deliberately: someone who knows an ID can spend its owner's budget for the window.
 */
export function cooldownKey(juviId: string): string {
  const h = createHash('sha256').update(normaliseJuviId(juviId)).digest('hex');
  return `juvi:login-fail:${h}`;
}

export async function getCooldown(juviId: string): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  try {
    const k = cooldownKey(juviId);
    const n = Number.parseInt((await redis.get(k)) ?? '0', 10);
    if (n < COOLDOWN_MAX_FAILURES) return { blocked: false, retryAfterSeconds: 0 };
    const ttl = await redis.ttl(k);
    return { blocked: true, retryAfterSeconds: Math.max(1, ttl) };
  } catch {
    // Redis unavailable: never lock everyone out; the per-IP limiter still applies.
    return { blocked: false, retryAfterSeconds: 0 };
  }
}

export async function recordFailure(juviId: string): Promise<void> {
  try {
    const k = cooldownKey(juviId);
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, COOLDOWN_WINDOW_SECONDS);
  } catch { /* non-fatal */ }
}

export async function clearFailures(juviId: string): Promise<void> {
  try { await redis.del(cooldownKey(juviId)); } catch { /* non-fatal */ }
}
```

- [ ] **Step 4: Re-key the cooldown's own tests**

Replace `backend/src/modules/juvi-app/accounts/__tests__/cooldown.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const redisMock = vi.hoisted(() => ({ get: vi.fn(), incr: vi.fn(), expire: vi.fn(), ttl: vi.fn(), del: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));
import { getCooldown, recordFailure, clearFailures, cooldownKey } from '../cooldown';

beforeEach(() => vi.clearAllMocks());

describe('cooldown', () => {
  it('keys by a hash of the normalised Juvi ID, never the raw value', () => {
    const k = cooldownKey('JUV4K7P2M9X');
    expect(k).toMatch(/^juvi:login-fail:[0-9a-f]{64}$/);
    expect(k).not.toContain('JUV4K7P2M9X');
  });

  it('gives one budget to every spelling of the same ID', () => {
    expect(cooldownKey('JUV4K7P2M9X')).toBe(cooldownKey('juv-4k7p-2m9x'));
    expect(cooldownKey('JUV4K7P2M9X')).toBe(cooldownKey(' juv 4k7p 2m9x '));
  });

  it('is not blocked under five failures', async () => {
    redisMock.get.mockResolvedValue('4');
    expect(await getCooldown('JUV4K7P2M9X')).toEqual({ blocked: false, retryAfterSeconds: 0 });
  });

  it('is blocked at five with the remaining ttl', async () => {
    redisMock.get.mockResolvedValue('5'); redisMock.ttl.mockResolvedValue(321);
    expect(await getCooldown('JUV4K7P2M9X')).toEqual({ blocked: true, retryAfterSeconds: 321 });
  });

  it('recordFailure increments and sets the window only on the first failure', async () => {
    redisMock.incr.mockResolvedValue(1);
    await recordFailure('JUV4K7P2M9X');
    expect(redisMock.expire).toHaveBeenCalledWith(expect.any(String), 600);
    redisMock.incr.mockResolvedValue(2); redisMock.expire.mockClear();
    await recordFailure('JUV4K7P2M9X');
    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it('allows sign-in when Redis is down', async () => {
    redisMock.get.mockRejectedValue(new Error('down'));
    expect(await getCooldown('JUV4K7P2M9X')).toEqual({ blocked: false, retryAfterSeconds: 0 });
    redisMock.del.mockRejectedValue(new Error('down'));
    await expect(clearFailures('JUV4K7P2M9X')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 5: Fix the two deletion-verify assertions the arity change breaks**

In `backend/src/modules/juvi-app/accounts/__tests__/deletion-verify-budget.test.ts`, change the assertion at line 34 from

```ts
    expect(k).not.toBe(cooldownKey('c1', '21CS1042'));
```

to

```ts
    expect(k).not.toBe(cooldownKey('21CS1042'));
```

and the assertion at line 88 from

```ts
    expect(await getCooldown('c1', 'victim@x.test')).toEqual({ blocked: false, retryAfterSeconds: 0 });
```

to

```ts
    expect(await getCooldown('victim@x.test')).toEqual({ blocked: false, retryAfterSeconds: 0 });
```

The point the test makes is unchanged and is the reason the module exists: the public deletion form's budget is key-disjoint from the sign-in lockout, so filling one never fills the other.

- [ ] **Step 6: Add the Juvi ID lookup**

In `backend/src/modules/juvi-app/accounts/identifier-resolver.ts`, replace the file's doc comment (lines 6-9) with:

```ts
/**
 * Sign-in identifier → User.
 *
 * `resolveIdentifierToUser` is college-scoped, and survives for its one remaining caller: the
 * public account-deletion form, which keeps `institutionCode` (spec D3).
 *
 * `resolveJuviIdToUser` is the Juvi app's login path and is deliberately the one lookup in this
 * module that is **not** scoped by collegeId. The Juvi ID is globally unique, and resolving the
 * college is what the lookup is *for* — there is nothing to scope by until it returns. This is
 * the amendment to the Juvi code's ruling R10 that the spec makes (§5).
 */
```

and append to the file:

```ts
/** An exact hit on a globally unique key. `null` when nobody holds it. */
export async function resolveJuviIdToUser(juviId: string): Promise<IUser | null> {
  return User.findOne({ juviId });
}
```

- [ ] **Step 7: Change the request and response schemas**

In `backend/src/modules/juvi-app/accounts/schemas.ts`, add the import:

```ts
import { CANONICAL_JUVI_ID, normaliseJuviId } from './juvi-id';
```

Replace `signInSchema` (lines 14-20) with:

```ts
export const signInSchema = z
  .object({
    juviId: z.string().trim().min(1).max(32),
    password: z.string().min(1).max(200),
    device: deviceSchema,
  })
  // Ruling R-C: the likeliest migration mistake is a roll number typed into the new field. A 400
  // naming the shape is actionable where the generic 401 would just read as a wrong password — and
  // it leaks nothing, because the shape is printed on every slip.
  .refine((v) => CANONICAL_JUVI_ID.test(normaliseJuviId(v.juviId)), {
    message: "That doesn't look like a Juvi ID. It looks like JUV-4K7P-2M9X.",
    path: ['juviId'],
  });
export type SignInInput = z.infer<typeof signInSchema>;
```

(The controller calls `signInSchema.parse(req.body)` directly — `accounts/auth-controller.ts:7` — and `mobileErrorHandler` turns the `ZodError` into `400 VALIDATION_FAILED` with `fields`.)

Replace `signInResponseSchema` (line 56) with:

```ts
// D7: the client's persisted deep-link owner key is `<collegeId>:<accountId>`, and it used to be
// fed by the request. It now comes back from the server, so the key keeps its shape and a
// notification link parked before this update still matches.
export const signInResponseSchema = tokensResponseSchema.extend({ collegeId: z.string(), account: accountSummarySchema });
```

- [ ] **Step 8: Rewrite `signIn`**

In `backend/src/modules/juvi-app/accounts/auth-service.ts`, change the imports:

```ts
import { JuviAccount, IJuviAccount, ELIGIBLE_STATUSES } from '../../../models/juvi/JuviAccount';
import { resolveIdentifierToUser, resolveJuviIdToUser } from './identifier-resolver';
import { normaliseJuviId } from './juvi-id';
```

`resolveIdentifierToUser` and `IJuviAccount` are both still needed — `verifyCredentials` keeps them. `bcrypt` is already imported.

Replace the whole of `signIn` (lines 63-106) with:

```ts
export async function signIn(input: SignInInput): Promise<z.infer<typeof signInResponseSchema>> {
  const juviId = normaliseJuviId(input.juviId);

  const cooldown = await getCooldown(juviId);
  if (cooldown.blocked) {
    throw new MobileApiError(429, 'COOLDOWN', `Too many attempts. Try again in ${Math.ceil(cooldown.retryAfterSeconds / 60)} minutes.`, { retryAfterSeconds: cooldown.retryAfterSeconds });
  }

  // The college is not in the request any more, so it comes from the person. This is the one
  // query in the module that is not scoped by collegeId — an exact hit on a globally unique key.
  const user = await resolveJuviIdToUser(juviId);
  if (!user) {
    // Same work as a real compare, so a miss costs what a hit costs.
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw invalidCredentials();
  }

  const ok = await bcrypt.compare(input.password, user.password);
  if (!ok) {
    await recordFailure(juviId);
    throw invalidCredentials();
  }

  // Past the password, and only now is the college known. Every check below is scoped by it.
  if (!user.collegeId) {
    // A User holding a Juvi ID with no college at all — super_admin. Generic 401, and never a
    // CastError from scoping a query to the string 'undefined'.
    await recordFailure(juviId);
    throw invalidCredentials();
  }
  const collegeId = String(user.collegeId);

  const account = await JuviAccount.findOne({ collegeId, userId: user._id });
  if (!account) {
    await recordFailure(juviId);
    throw invalidCredentials();
  }

  // Read before it is acted on, so the 403 below can cite the college's support contact; its
  // *state* is checked after eligibility, in the order §6 sets out.
  //
  // Ruling R2, unchanged in shape and now reachable only with a correct password: an unknown
  // college stays indistinguishable from a wrong password rather than getting the 503 that a
  // known-but-disabled institution gets.
  const cfg = await getJuviConfig(collegeId);
  if (!cfg) {
    await recordFailure(juviId);
    throw invalidCredentials();
  }

  if (!ELIGIBLE_STATUSES.includes(account.status) || !user.isActive) {
    throw new MobileApiError(403, 'ACCOUNT_DEACTIVATED', DEACTIVATED_MESSAGE, { supportContact: cfg.supportContact ?? null });
  }
  if (!cfg.enabled) {
    throw new MobileApiError(503, 'INSTITUTION_PAUSED', 'Juvi is not available for your institution right now.', { message: 'Juvi is not available for your institution right now.' });
  }
  if (cfg.paused) {
    throw new MobileApiError(503, 'INSTITUTION_PAUSED', cfg.pausedMessage ?? 'Juvi is paused.', { message: cfg.pausedMessage ?? 'Juvi is paused.' });
  }

  await clearFailures(juviId);
  const { tokens } = await createSession({
    collegeId, accountId: String(account._id), userId: String(user._id),
    role: user.role, kind: account.kind, device: input.device,
  });
  // Story 4 AC1's safety net: holding the password again is independent evidence of ownership, so
  // any pending public deletion request is dropped. Best-effort — it can never fail the sign-in.
  await clearDeletionRequestBestEffort(collegeId, String(account._id));
  return { ...tokens, collegeId, account: accountSummary(account, user) };
}
```

`verifyCredentials` (lines 47-61) is **unchanged** — its doc comment already states the read-only contract that keeps the public deletion form from spending the sign-in budget, and that reasoning is now load-bearing: it is the only reason a second identity path exists at all.

- [ ] **Step 9: Update the contract's route summary and regenerate the JSON**

In `backend/src/modules/juvi-app/openapi/document.ts:147`, change the sign-in route's `summary`:

```ts
    { operationId: 'signIn', method: 'post', path: '/auth/sign-in', summary: 'Sign in with a Juvi ID and password', auth: false, body: C.SignInRequest, response: C.SignInResponse, errors: [400, 401, 403, 429, 503] },
```

`registry.register` accepts the refined `signInSchema`: zod-to-openapi 7 unwraps a `ZodEffects` to the inner object rather than throwing (verified against the installed `@asteasolutions/zod-to-openapi@7`).

Run: `npm run openapi:mobile -w backend`
Then inspect the diff to `mobile/api/openapi.json`: `SignInRequest` must lose `collegeId` and `identifier` and gain `juviId`; `SignInResponse` must gain `collegeId`.

- [ ] **Step 10: Sweep `signInAs` and every call site**

In `backend/src/__e2e__/factories/notice.factory.ts`, replace `signInAs` (lines 65-69) with:

```ts
/**
 * `fx` is gone as of the Juvi ID contract (ruling R-E): the request carries no collegeId, so
 * there is nothing for the helper to look up. `noUnusedParameters` would not have flagged it —
 * TypeScript only reports *trailing* unused parameters.
 */
export async function signInAs(app: Express, juviId: string, password: string, deviceId = TEST_DEVICE.id): Promise<string> {
  const res = await mobileClient(app).post('/api/juvi-app/v1/auth/sign-in')
    .send({ juviId, password, device: { ...TEST_DEVICE, id: deviceId } }).expect(200);
  return res.body.accessToken as string;
}
```

Then change all 31 call sites across 12 files. The mechanical substitution, by what the identifier argument is today:

| Today | Replace with |
|---|---|
| `s.student.rollNumber` | `s.juviId` |
| `fac.faculty.employeeCode` | `fac.juviId` |
| `studentFixture.student.rollNumber` | `studentFixture.juviId` |
| `String(f.faculty.employeeCode)` | `f.juviId` |
| `String(officer.user.email)` (in `juvi-home.e2e.test.ts`) | the officer account's minted ID, read back |

and drop the leading `fx, ` argument at every one of them. The files, with their call-site lines:

```
backend/src/__e2e__/factories/notification.factory.ts:23
backend/src/__e2e__/modules/juvi-attention.e2e.test.ts:33,52,61
backend/src/__e2e__/modules/juvi-erp-parity.e2e.test.ts:38
backend/src/__e2e__/modules/juvi-home.e2e.test.ts:25,42,53,56,66,70,80
backend/src/__e2e__/modules/juvi-notices-ack.e2e.test.ts:26
backend/src/__e2e__/modules/juvi-notices-hardening.e2e.test.ts:132,193,200,236
backend/src/__e2e__/modules/juvi-notices-lifecycle.e2e.test.ts:35,36,55,76
backend/src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts:43,83,132
backend/src/__e2e__/modules/juvi-notices-reach.e2e.test.ts:41,47
backend/src/__e2e__/modules/juvi-notices-welcome.e2e.test.ts:28,52,145
backend/src/__e2e__/modules/juvi-notifications-reach.e2e.test.ts:55
```

For `juvi-home.e2e.test.ts`'s officer, the ID is read from the account rather than from the factory's return shape:

```ts
import { readJuviId } from '../../modules/juvi-app/accounts/provisioning-service';
// …
const officerJuviId = (await readJuviId(fx.collegeId, String(officer.user._id)))!;
await signInAs(app, officerJuviId, password);
```

Then the four files that POST to `auth/sign-in` directly, with an inline body:

```
backend/src/__e2e__/modules/juvi-app-config.e2e.test.ts:37,45
backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts:17
backend/src/__e2e__/modules/juvi-account-deletion.e2e.test.ts:21
backend/src/__e2e__/modules/juvi-app-spaces.e2e.test.ts:33
```

In each, the body becomes `{ juviId: <that file's provisioned fixture>.juviId, password, device }` — drop `collegeId` and rename `identifier` to `juviId`.

- [ ] **Step 11: Verify the sweep is complete**

Run each of these; all three must print nothing.

```bash
rtk proxy grep -rn "signInAs(fx" backend/src/__e2e__
rtk proxy grep -rn "identifier:" backend/src/__e2e__/modules/juvi-app-config.e2e.test.ts backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts backend/src/__e2e__/modules/juvi-account-deletion.e2e.test.ts backend/src/__e2e__/modules/juvi-app-spaces.e2e.test.ts
rtk proxy grep -rn "identifier\b" backend/src/modules/juvi-app/accounts/auth-service.ts
```

(`verifyCredentials` still takes an `identifier`, so the last one is scoped to `auth-service.ts` and expects only the `verifyCredentials` signature line — every `signIn` mention of it must be gone.)

- [ ] **Step 12: Amend the foundation spec (design §13)**

`docs/superpowers/specs/2026-09-23-juvi-foundation-design.md` is what the later Juvi
sub-projects point at instead of repeating the roadmap, and this change makes eight of its
lines false. Amend it **in place** — that is what this repo does when a later sub-project
changes an earlier spec (commits `5b40e1e` and `c71ea9e` both edited this very file for that
reason, citing the ruling inline), so do not leave the deltas as a note in the new design
alone.

`### US-1 Sign in (S01)` at line 129 — the intro line and the AC list become:

```markdown
As a provisioned user I sign in with my Juvi ID and password, and am forced
to set a real password on first use.

1. **Deleted 2026-10-13** — the app no longer asks for an institution code, so
   nothing knows the college before credentials are typed; superseded by
   `2026-10-13-juvi-id-sign-in-design.md` §6.
2. The Juvi ID resolves to the User; a wrong identifier and a wrong password
   return one identical 401 body.
3. A user with `mustChangePassword` cannot reach any screen but set-password;
   after setting one (≥ 8 chars, no forced character classes) the temporary
   password no longer works.
4. Five failures within ten minutes for one Juvi ID return 429 with
   `retryAfterSeconds`; the sixth attempt with the correct password also
   waits; there is no permanent lock.
5. **Deleted 2026-10-13** — there is nothing left to prefill.
6. A deactivated account with the correct password receives
   `ACCOUNT_DEACTIVATED`, not the generic error; with a wrong password it
   receives the generic error.
```

AC 1 and AC 5 are tombstoned **in place, not renumbered**: `US-1 AC6` is cited by name in this
design's D6, so closing the gap would break a live reference to save nothing.

`## 4. Goals`, the first bullet (line 101):

```markdown
- A provisioned student or faculty member installs the app, signs in with
  their Juvi ID + temporary password, sets a real password, and lands on
  Today or Teaching in under a minute.
```

`### Sign-in` under §8 — the request block at line 388:

```json
{ "juviId": "JUV-4K7P-2M9X", "password": "river-lamp-482",
  "device": { "id": "uuid", "name": "Pixel 7a", "platform": "android",
              "appVersion": "1.0.0", "osVersion": "14" } }
```

and the resolution list at line 395 becomes:

```markdown
One exact lookup on a globally unique key, and the only query in the module not scoped by
`collegeId`:

1. Normalise the ID (uppercase, drop every character outside `A–Z0–9`) →
   `User.findOne({ juviId })`.

The `collegeId` used by every later check is the one the resolved `User` carries. The
email / roll number / employee code resolution that used to be here stays in the code for
the public account-deletion form's college-scoped check, not for sign-in.
```

The response block at line 412 gains the top-level key:

```json
{ "accessToken": "…", "accessExpiresIn": 900, "refreshToken": "…",
  "collegeId": "…",
  "account": { "id": "…", "kind": "student", "status": "onboarding",
               "onboardingStep": 0, "onboardingComplete": false,
               "mustChangePassword": true } }
```

The cooldown key at line 421:

```markdown
Cooldown key: `juvi:login-fail:{sha256(normaliseJuviId(id))}`, `INCR` + `EXPIRE 600`. Keyed
by the ID alone — there is no college to scope by — and never by IP alone, never persisted
on User.
```

The decision table below it stays as written: every row it lists remains true, and the
`Cooldown counter ≥ 5` row already says the counter is checked before any lookup.

`### Credential export` at line 554 — the header gains the ID, per ruling R-L:

```markdown
`identifier,name,section,juviId,temporaryPassword,institutionCode`. After
```

- [ ] **Step 13: Run the whole backend suite and typecheck**

Run: `npm test -w backend && npm run test:e2e -w backend && npm run typecheck -w backend`
Expected: green. e2e needs the local Redis on `localhost:6379`.

Then verify the contract JSON is committed in step with the schema:

Run: `npm run openapi:mobile -w backend && git diff --exit-code -- mobile/api/openapi.json`
Expected: exit 0, no diff — the JSON regenerated in step 9 already reflects the schema.

- [ ] **Step 14: Commit**

```bash
git add backend/src/modules/juvi-app/accounts/schemas.ts \
        backend/src/modules/juvi-app/accounts/identifier-resolver.ts \
        backend/src/modules/juvi-app/accounts/cooldown.ts \
        backend/src/modules/juvi-app/accounts/auth-service.ts \
        backend/src/modules/juvi-app/accounts/__tests__/cooldown.test.ts \
        backend/src/modules/juvi-app/accounts/__tests__/deletion-verify-budget.test.ts \
        backend/src/modules/juvi-app/openapi/document.ts \
        mobile/api/openapi.json \
        docs/superpowers/specs/2026-09-23-juvi-foundation-design.md \
        backend/src/__e2e__/factories/notice.factory.ts \
        backend/src/__e2e__/factories/notification.factory.ts \
        backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-attention.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-erp-parity.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-home.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-notices-ack.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-notices-hardening.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-notices-lifecycle.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-notices-mobile.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-notices-reach.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-notices-welcome.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-notifications-reach.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-app-config.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-account-deletion.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-app-spaces.e2e.test.ts
git commit -m "$(cat <<'EOF'
feat(juvi)!: sign in with the Juvi ID, and re-key the cooldown to it

The request is {juviId, password, device} and the response gains collegeId,
so the client's persisted owner key keeps its shape. The college now comes
from the person: one exact lookup on a globally unique key is the only
query in the module not scoped by collegeId.

The order is the security property. Nothing before a correct password can
reveal whether an ID exists — a miss costs a DUMMY_HASH compare, and an
unknown ID, a wrong password and a resolved user with no Juvi account all
return one byte-identical 401. Only then are the account's eligibility, the
ERP isActive flag and the college's enabled/paused state checked, against
the collegeId the lookup returned. A User holding an ID with no college
gets the same generic 401 rather than a CastError.

The cooldown is keyed by the hashed ID alone — there is no college to scope
by, and nothing to vary to escape the budget. A value that cannot be a Juvi
ID is a 400 naming the shape, which turns the likeliest migration mistake
into actionable copy.

BREAKING: roll number, employee code and email no longer sign in.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: The `me` response carries the Juvi ID

The ID is durable, but nothing tells the person what it is after provisioning. This is the app-side half of §8: once signed in, a person can read their own ID and save it. The college office (Task 7) is the other half.

**Files:**
- Modify: `backend/src/modules/juvi-app/accounts/schemas.ts:79-104` (`meResponseSchema`)
- Modify: `backend/src/modules/juvi-app/accounts/me-service.ts:50-57` (the `User` select) and `:95-111` (the return)
- Modify: `mobile/api/openapi.json` (generated)
- Modify: `backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts`

**Interfaces:**
- Consumes: `User.juviId` (Task 2); `provisionTestStudent(...).juviId` (Task 3); the `{ juviId, password, device }` request, so this file's `tokenFor` helper is already rewritten by Task 4.
- Produces: `MeResponse` gains `juviId: string | null`; the `Me` component in `mobile/api/openapi.json` gains the field, which Task 8's Dart client generation reads.

- [ ] **Step 1: Write the failing test**

In `backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts`, add the import:

```ts
import { User } from '../../models/User';
```

Then in the first test — `'returns the student identity card, settings and institution snapshot'` — add one assertion directly after the `res.body.account` line:

```ts
    // §8: the only place a signed-in person can read their own ID back.
    expect(res.body.juviId).toBe(s.juviId);
```

And append a new test to the `GET /me` describe block:

```ts
  // Ruling R-J: an account the backfill has not reached yields null, not a missing key — the
  // generated client throws on a missing required key (`$checkKeys`), and the app's first screen
  // must not crash on a data state the server is allowed to be in.
  it('reports a null Juvi ID rather than omitting the key when the User has none', async () => {
    const s = await provisionTestStudent(fx);
    const t = await tokenFor(s.juviId, s.tempPassword);
    await User.updateOne({ collegeId: fx.collegeId, _id: s.account.userId }, { $unset: { juviId: 1 } });
    const res = await mobileClient(app, t).get(`${V1}/me`).expect(200);
    expect(res.body).toHaveProperty('juviId');
    expect(res.body.juviId).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -w backend -- juvi-app-me`
Expected: FAIL — `res.body.juviId` is `undefined`, so `toBe(s.juviId)` fails, and `toHaveProperty('juviId')` fails on the second test.

- [ ] **Step 3: Add the field to the response schema**

In `backend/src/modules/juvi-app/accounts/schemas.ts`, add one field to `meResponseSchema` directly after `account: accountSummarySchema,` (line 80):

```ts
  /**
   * §8 — the durable Juvi ID, so a signed-in person can read it back and save it. Nullable rather
   * than required (ruling R-J): an account the backfill has not reached reports null, and a
   * missing key would make the generated client's `$checkKeys` throw.
   */
  juviId: z.string().nullable(),
```

`meResponseSchema` is registered as the `Me` component (`openapi/document.ts:94`) and is not parsed at runtime — `getMe`'s return type is the only enforcement, and step 4 satisfies it.

- [ ] **Step 4: Return it**

In `backend/src/modules/juvi-app/accounts/me-service.ts:53`, extend the `User` projection:

```ts
    User.findOne({ _id: ctx.userId, collegeId: ctx.collegeId }).select('mustChangePassword role juviId').lean(),
```

and in the returned object (after `account: accountSummary(account, user),` at line 96):

```ts
    juviId: user.juviId ?? null,
```

`user` is already the typed `IUser | null` narrowed by the guard on line 57, so `user.juviId` needs no assertion.

- [ ] **Step 5: Regenerate the contract JSON**

Run: `npm run openapi:mobile -w backend`
Then inspect the diff: the `Me` component's `properties` must gain `juviId` and `required` must gain `juviId` (the property is required, its *value* is nullable — OpenAPI 3.1 `type: ["string","null"]`). Confirm `node tool/check_nullable_objects.js api/openapi.json` from `mobile/` still passes: it rejects only *object*-or-null response fields, and this one is a string.

Run: `cd mobile && node tool/check_nullable_objects.js api/openapi.json`
Expected: `object-or-null check passed (6 known field(s), all parsed via raw Dio)` — still six, unchanged.

- [ ] **Step 6: Run the tests and typecheck**

Run: `npm run test:e2e -w backend -- juvi-app-me && npm run typecheck -w backend`
Expected: green.

Then confirm the JSON is committed in step:

Run: `npm run openapi:mobile -w backend && git diff --exit-code -- mobile/api/openapi.json`
Expected: exit 0, no diff.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/juvi-app/accounts/schemas.ts \
        backend/src/modules/juvi-app/accounts/me-service.ts \
        backend/src/__e2e__/modules/juvi-app-me.e2e.test.ts \
        mobile/api/openapi.json
git commit -m "$(cat <<'EOF'
feat(juvi): show the Juvi ID on the account screen

The ID is durable but nothing told the person what it was. /me now carries
it, nullable rather than required, so an account the backfill has not
reached reports null instead of omitting a key the generated client would
throw on.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: The backfill — the repair path for accounts that predate this change

Every Juvi account that exists today has a `User` with no `juviId`, and after Task 4 the new sign-in cannot find any of them. This is the second half of Review Focus 4, and the script the operator runs before promoting that build (ruling R-K).

**Files:**
- Create: `backend/src/scripts/backfill-juvi-ids.ts`
- Create: `backend/src/__e2e__/modules/juvi-app-juvi-id-backfill.e2e.test.ts`

**Interfaces:**
- Consumes: `ensureJuviId({ collegeId, userId })` and `readJuviId(collegeId, userId)` (both exported in Task 3); `JuviAccount` (`models/juvi/JuviAccount.ts`); `provisionTestStudent(...).juviId` (Task 3).
- Produces: `backfillJuviIds(): Promise<BackfillResult>` where `BackfillResult = { scanned, minted, skipped, failed }`, all `number`. Script shape mirrors `scripts/fix-student-rollnumber-index.ts` — exported function, `main()` owning the connection, `require.main === module` guard.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__e2e__/modules/juvi-app-juvi-id-backfill.e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, provisionTestFaculty } from '../factories/juvi.factory';
import { User } from '../../models/User';
import { backfillJuviIds } from '../../scripts/backfill-juvi-ids';
import { CANONICAL_JUVI_ID } from '../../modules/juvi-app/accounts/juvi-id';

let fx: BaseFixtures;
// The DB must be connected before seedBase; this test makes no HTTP calls.
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

/** Provision as usual, then strip the ID the way a pre-change account looks. */
async function provisionWithoutId(kind: 'student' | 'faculty') {
  const fixture = kind === 'student' ? await provisionTestStudent(fx) : await provisionTestFaculty(fx);
  await User.updateOne({ collegeId: fx.collegeId, _id: fixture.account.userId }, { $unset: { juviId: 1 } });
  return fixture;
}

async function idOf(userId: unknown): Promise<string | null> {
  const u = await User.findOne({ collegeId: fx.collegeId, _id: userId }).select('juviId').lean();
  return u?.juviId ?? null;
}

describe('backfillJuviIds', () => {
  it('mints what is missing and reports the count', async () => {
    const a = await provisionWithoutId('student');
    const b = await provisionWithoutId('faculty');
    expect(await idOf(a.account.userId)).toBeNull();

    const r = await backfillJuviIds();
    expect(r).toEqual({ scanned: 2, minted: 2, skipped: 0, failed: 0 });

    const ids = [await idOf(a.account.userId), await idOf(b.account.userId)];
    for (const id of ids) expect(id).toMatch(CANONICAL_JUVI_ID);
    expect(ids[0]).not.toBe(ids[1]);
  });

  // §4: minted once, never re-minted. A satisfied row keeps the ID it has.
  it('skips rows that already hold an ID and leaves them untouched', async () => {
    const satisfied = await provisionTestStudent(fx);
    const missing = await provisionWithoutId('student');

    const r = await backfillJuviIds();
    expect(r).toEqual({ scanned: 2, minted: 1, skipped: 1, failed: 0 });
    expect(await idOf(satisfied.account.userId)).toBe(satisfied.juviId);
    expect(await idOf(missing.account.userId)).toMatch(CANONICAL_JUVI_ID);
  });

  it('is re-runnable with no effect the second time', async () => {
    const s = await provisionWithoutId('student');
    await backfillJuviIds();
    const minted = await idOf(s.account.userId);

    const again = await backfillJuviIds();
    expect(again).toEqual({ scanned: 1, minted: 0, skipped: 1, failed: 0 });
    expect(await idOf(s.account.userId)).toBe(minted);
  });

  // One orphaned row must not deny everyone after it an ID — the run reports it and carries on.
  it('counts an account whose User is gone as failed and still mints the rest', async () => {
    const orphan = await provisionWithoutId('student');
    await User.deleteOne({ collegeId: fx.collegeId, _id: orphan.account.userId });
    const healthy = await provisionWithoutId('faculty');

    const r = await backfillJuviIds();
    expect(r).toMatchObject({ scanned: 2, minted: 1, failed: 1 });
    expect(await idOf(healthy.account.userId)).toMatch(CANONICAL_JUVI_ID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -w backend -- juvi-app-juvi-id-backfill`
Expected: FAIL with a module-not-found for `../../scripts/backfill-juvi-ids`.

- [ ] **Step 3: Write the script**

Create `backend/src/scripts/backfill-juvi-ids.ts`:

```ts
/**
 * Binds a Juvi ID to every User behind an existing JuviAccount (spec §9, step 2).
 *
 * RUN THIS BEFORE PROMOTING THE JUVI ID SIGN-IN BUILD. The new sign-in resolves a person by
 * `juviId` alone, so an account that has not been backfilled cannot sign in at all — everyone
 * un-migrated gets the generic 401 until this runs. The unique index must exist first
 * (`scripts/ensure-juvi-id-index.ts`); minting without it can hand two people the same ID.
 *
 * Idempotent and re-runnable: a row that already holds an ID is counted and skipped, never
 * re-minted (§4 — an ID is minted once). One broken row does not stop the run; it is reported,
 * counted, and makes the process exit non-zero so a deploy step notices.
 */
/* eslint-disable no-console */
import mongoose from 'mongoose';
import { JuviAccount } from '../models/juvi/JuviAccount';
import { ensureJuviId, readJuviId } from '../modules/juvi-app/accounts/provisioning-service';

export interface BackfillResult {
  scanned: number;
  minted: number;
  skipped: number;
  failed: number;
}

export async function backfillJuviIds(): Promise<BackfillResult> {
  const result: BackfillResult = { scanned: 0, minted: 0, skipped: 0, failed: 0 };
  // Projection-only, so the whole set of accounts is a few bytes each — this is a one-off
  // migration and reading it in one go keeps the failure reporting simple.
  const accounts = await JuviAccount.find({}).select('collegeId userId').lean();

  for (const account of accounts) {
    result.scanned += 1;
    const collegeId = String(account.collegeId);
    const userId = String(account.userId);
    try {
      if (await readJuviId(collegeId, userId)) {
        result.skipped += 1;
        continue;
      }
      await ensureJuviId({ collegeId, userId });
      result.minted += 1;
    } catch (e) {
      // An orphaned account (its User is gone) or an exhausted mint. Carry on: one broken row
      // must not deny every row after it an ID.
      result.failed += 1;
      console.error(`[backfill-juvi-ids] account ${String(account._id)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) {
    console.error('[backfill-juvi-ids] set MONGODB_URI (or MONGO_URI)');
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    const r = await backfillJuviIds();
    console.log(`[backfill-juvi-ids] scanned ${r.scanned}, minted ${r.minted}, skipped ${r.skipped}, failed ${r.failed}`);
    if (r.failed > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:e2e -w backend -- juvi-app-juvi-id-backfill`
Expected: PASS, 4/4.

- [ ] **Step 5: Run the backfill against the dev database, once**

This is the task's real deliverable: the script exists *and* has been run in the environment the demo uses. The dev Mongo is on `localhost:27017`, database `juvion_v2`.

**Prerequisite — run `scripts/ensure-juvi-id-index.ts` FIRST.** The backfill's doc comment *asserts* that the partial unique index must exist, but the script does not verify it, and the failure is quiet rather than loud: without the index a duplicate candidate is not rejected, the mint's `E11000` retry never fires, and two Users can end up holding the same ID. §6 resolves a person by `juviId` alone, so one of them is then locked out and the ID no longer identifies exactly one person. This ordering is why ruling R-K exists.

Run: `MONGODB_URI=mongodb://localhost:27017/juvion_v2 npx ts-node --transpile-only backend/src/scripts/backfill-juvi-ids.ts`
Expected: a line like `[backfill-juvi-ids] scanned N, minted N, skipped 0, failed 0`, exit 0 — the first run mints everything. Run it a second time and expect `minted 0, skipped N` — that is the re-runnability proof on real data, not just in the harness.

> **Corrected after execution (2026-10-13).** This step originally specified `ts-node-dev`, which is a
> **file watcher and never exits**: `main()` completing does not end the command, so it hung for 180s
> with empty output and wrote nothing to the database. It is a non-starter for a one-shot migration,
> not merely slow — and the failure mode is a silent hang rather than a visible error, which is the
> worst shape for a step a deploy runs. `ts-node` honours the `require.main === module` guard under
> CommonJS and exits. The count was also wrong (`6`); the dev database holds **9** accounts, and all 9
> migrated on the first run with a clean idempotent second run. **Use `ts-node`, never `ts-node-dev`,
> as the operator command for this script.**

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck -w backend`
Expected: zero errors.

```bash
git add backend/src/scripts/backfill-juvi-ids.ts backend/src/__e2e__/modules/juvi-app-juvi-id-backfill.e2e.test.ts
git commit -m "$(cat <<'EOF'
feat(juvi): backfill a Juvi ID for every existing account

The repair path for accounts that predate the Juvi ID. Idempotent, skips
satisfied rows, never re-mints, and keeps going past a broken row while
exiting non-zero so a deploy step notices.

Run this before promoting the Juvi ID sign-in build: that sign-in resolves
a person by juviId alone, so anything un-backfilled gets a generic 401
until it has run.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: The console and the printed slip

The college office is the recovery path (spec D2), so the Juvi ID has to be readable there: in the accounts table, and on the credentials CSV that is the printed slip. Spec §8 — the ID is read from the **account** (durable), not from the credential row, whose only job is the 7-day secret.

**Files:**
- Modify: `backend/src/modules/juvi-app/admin/accounts-service.ts:18-22` (`AccountRow`), `:32-44` (search), `:51` (the `User` projection), `:62-72` (the row)
- Modify: `backend/src/modules/juvi-app/admin/provisioning-service.ts:55-82` (`credentialsCsv`)
- Modify: `backend/src/__e2e__/modules/juvi-app-admin-accounts.e2e.test.ts`
- Modify: `backend/src/__e2e__/modules/juvi-app-admin-provisioning.e2e.test.ts:54-87`
- Modify: `admin-portal/src/services/juvi-app.ts:47-51`
- Modify: `admin-portal/src/components/platform/juvi/AccountsTable.tsx`
- Modify: `admin-portal/src/components/platform/juvi/__tests__/AccountsTable.test.tsx`

**Interfaces:**
- Consumes: `User.juviId` (Task 2); `normaliseJuviId` (Task 1); `provisionTestStudent(...).juviId` (Task 3).
- Produces: `AccountRow` (backend **and** portal) gains `juviId: string | null`; the CSV header becomes `identifier,name,section,juviId,temporaryPassword,institutionCode` (ruling R-L).

- [ ] **Step 1: Write the failing backend tests**

In `backend/src/__e2e__/modules/juvi-app-admin-accounts.e2e.test.ts`, add to the first test's `students.body.items[0]` assertion (line 28):

```ts
    expect(students.body.items[0]).toMatchObject({ name: s.person.name, identifier: s.student.rollNumber, email: s.person.email, juviId: s.juviId });
```

and append a new test to the `admin accounts` describe block:

```ts
  // D2's recovery flow: the caller reads their ID out over the phone. Without this the office
  // has a table of thousands and the one value the caller knows is the one it cannot search.
  it('finds an account by Juvi ID, however the caller spells it', async () => {
    const s = await provisionTestStudent(fx);
    await provisionTestFaculty(fx);
    for (const q of [s.juviId, s.juviId.toLowerCase(), `JUV-${s.juviId.slice(3, 7)}-${s.juviId.slice(7)}`]) {
      const res = await api.as(fx.admin.token).get(`${A}/accounts?q=${encodeURIComponent(q)}`).expect(200);
      expect(res.body.items.map((r: any) => r.id)).toEqual([String(s.account._id)]);
    }
  });
```

In `backend/src/__e2e__/modules/juvi-app-admin-provisioning.e2e.test.ts`, change the three CSV assertions (lines 72-74):

```ts
    expect(lines[0]).toBe('identifier,name,section,juviId,temporaryPassword,institutionCode');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^24D00[12],S 24D00[12],A,JUV[0-9A-HJKMNP-TV-Z]{8},[a-z]+-[a-z]+-\d{3},JIT-TEST$/);
```

and add one assertion after line 81 that the un-sectioned slip carries an ID too:

```ts
    expect(noneLines[1]?.split(',')[3]).toMatch(/^JUV[0-9A-HJKMNP-TV-Z]{8}$/);
```

- [ ] **Step 2: Run the backend tests to verify they fail**

Run: `npm run test:e2e -w backend -- juvi-app-admin`
Expected: FAIL — the accounts test on a missing `juviId` (and the search returning both accounts), the CSV test on the header string.

- [ ] **Step 3: Add the field to `AccountRow` and the search**

In `backend/src/modules/juvi-app/admin/accounts-service.ts`, add the import:

```ts
import { normaliseJuviId } from '../accounts/juvi-id';
```

Replace the `AccountRow` interface (lines 18-22):

```ts
export interface AccountRow {
  id: string; kind: AccountKind; status: AccountStatus; name: string; identifier: string; email: string;
  /** §8 — the durable sign-in ID. Null for an account the backfill has not reached. */
  juviId: string | null;
  onboardingComplete: boolean; lastSeenAt: string | null; provisionedAt: string;
  hasLiveCredential: boolean; credentialExpiresAt: string | null;
}
```

Inside the `if (q.q)` block, after the existing four lookups, add the Juvi ID branch. The caller spells the ID however they read it off the screen or a slip, so search on the *normalised* form:

```ts
    const normalized = normaliseJuviId(q.q);
    const juviUsers = normalized ? await User.find({ collegeId, juviId: new RegExp(escapeRegex(normalized)) }).select('_id').lean() : [];
```

and add a fifth branch to `filter.$or` (line 40-43):

```ts
      { personId: { $in: persons.map((p) => p._id) } }, { studentId: { $in: students.map((s) => s._id) } },
      { facultyId: { $in: faculty.map((f) => f._id) } }, { staffId: { $in: staff.map((s) => s._id) } },
      { userId: { $in: juviUsers.map((u) => u._id) } },
```

The `normalized ? … : []` guard matters: a query of only punctuation normalises to `''`, and `new RegExp('')` matches every string.

Then the `User` projection (line 51) gains the field:

```ts
    User.find({ collegeId, _id: { $in: accounts.map((a) => a.userId) } }).select('email juviId').lean(),
```

and the row (after `email:` at line 66):

```ts
    juviId: U.get(String(a.userId))?.juviId ?? null,
```

- [ ] **Step 4: Put the ID on the slip**

In `backend/src/modules/juvi-app/admin/provisioning-service.ts`, add the imports:

```ts
import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { User } from '../../../models/User';
```

Then in `credentialsCsv`, replace the parallel load (lines 68-72) with one that also resolves each credential's account → user → ID:

```ts
  const [college, sections, accounts] = await Promise.all([
    College.findById(collegeId).select('code').lean(),
    Section.find({ collegeId, _id: { $in: rows.map((r) => r.sectionId).filter(Boolean) } }).select('name').lean(),
    JuviAccount.find({ collegeId, _id: { $in: rows.map((r) => r.accountId) } }).select('userId').lean(),
  ]);
  const sectionName = new Map(sections.map((s) => [String(s._id), s.name]));
  // §8: read from the account, not from the credential row — the credential row is the 7-day
  // secret, and its identifier is the roll/employee code the office matches people on.
  const users = await User.find({ collegeId, _id: { $in: accounts.map((a) => a.userId) } }).select('juviId').lean();
  const juviByUser = new Map(users.map((u) => [String(u._id), u.juviId ?? '']));
  const juviByAccount = new Map(accounts.map((a) => [String(a._id), juviByUser.get(String(a.userId)) ?? '']));
```

Replace the header and the row push (lines 73-76):

```ts
  const lines = ['identifier,name,section,juviId,temporaryPassword,institutionCode'];
  for (const r of rows) {
    lines.push([r.identifier, r.displayName, r.sectionId ? sectionName.get(String(r.sectionId)) ?? '' : '', juviByAccount.get(String(r.accountId)) ?? '', decryptSecret(r), college?.code ?? ''].map(csvCell).join(','));
  }
```

- [ ] **Step 5: Run the backend tests to verify they pass**

Run: `npm run test:e2e -w backend -- juvi-app-admin && npm run typecheck -w backend`
Expected: PASS; zero type errors.

- [ ] **Step 6: Write the failing portal test**

In `admin-portal/src/components/platform/juvi/__tests__/AccountsTable.test.tsx`, add the field to `ROW` (line 14):

```ts
const ROW = { id: 'a1', kind: 'student', status: 'onboarding', name: 'Aditya Nair', identifier: '24JIT0001', email: 'a@x.in', juviId: 'JUV4K7P2M9X', onboardingComplete: false, lastSeenAt: null, provisionedAt: '2026-09-23T03:00:00Z', hasLiveCredential: true, credentialExpiresAt: '2026-09-30T03:00:00Z' };
```

and append a test:

```ts
  // D2: the office reads this out to the person who lost their ID.
  it('shows the Juvi ID so the office can read it back', async () => {
    renderWithProviders(<AccountsTable />);
    expect(await screen.findByText('JUV4K7P2M9X')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /juvi id/i })).toBeInTheDocument();
  });
```

- [ ] **Step 7: Run the portal test to verify it fails**

Run: `npm run test -w admin-portal -- AccountsTable`
Expected: FAIL — `JUV4K7P2M9X` is not rendered; there is no `Juvi ID` column header.

- [ ] **Step 8: Add the column**

In `admin-portal/src/services/juvi-app.ts`, replace the `AccountRow` interface (lines 47-51):

```ts
export interface AccountRow {
  id: string; kind: AccountKind; status: AccountStatus; name: string; identifier: string; email: string;
  /** §8 — the durable sign-in ID. Null for an account the backfill has not reached. */
  juviId: string | null;
  onboardingComplete: boolean; lastSeenAt: string | null; provisionedAt: string;
  hasLiveCredential: boolean; credentialExpiresAt: string | null;
}
```

In `admin-portal/src/components/platform/juvi/AccountsTable.tsx`:

The header row (line 76) gains a cell after `Identifier`, and the last header cell stays empty for the actions:

```tsx
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Identifier</th><th className="px-4 py-2">Juvi ID</th><th className="px-4 py-2">Kind</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Last seen</th><th className="px-4 py-2">Credential</th><th className="px-4 py-2" /></tr>
```

The body row (after line 82) gains the cell:

```tsx
                <td className="px-4 py-2 font-mono text-xs">{a.juviId ?? <span className="text-gray-400">—</span>}</td>
```

**Canonical, not grouped.** The table shows `JUV4K7P2M9X`, the same string the slip prints and the same string the server stores, so a person reading it aloud and the office reading it off either surface are reading the same characters. Formatting it as `JUV-4K7P-2M9X` here would mean two spellings of one value on two screens with no source of truth between them.

The empty-state cell (line 107) spans one more column:

```tsx
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No accounts match. Run provisioning to create some.</td></tr>
```

The search box now finds the ID too, so its placeholder says so (line 64):

```tsx
        <input aria-label="Search accounts" maxLength={80} className={`${inp} sm:col-span-2`} placeholder="Name, roll number, employee code or Juvi ID" value={draft} onChange={(e) => setDraft(e.target.value)} />
```

- [ ] **Step 9: Run the portal tests to verify they pass**

Run: `npm run test -w admin-portal -- AccountsTable && npm run typecheck -w admin-portal`
Expected: PASS, 4/4; zero type errors.

- [ ] **Step 10: Commit**

```bash
git add backend/src/modules/juvi-app/admin/accounts-service.ts \
        backend/src/modules/juvi-app/admin/provisioning-service.ts \
        backend/src/__e2e__/modules/juvi-app-admin-accounts.e2e.test.ts \
        backend/src/__e2e__/modules/juvi-app-admin-provisioning.e2e.test.ts \
        admin-portal/src/services/juvi-app.ts \
        admin-portal/src/components/platform/juvi/AccountsTable.tsx \
        admin-portal/src/components/platform/juvi/__tests__/AccountsTable.test.tsx
git commit -m "$(cat <<'EOF'
feat(juvi): put the Juvi ID on the console and the printed slip

The college office is the recovery path for a forgotten ID, so it has to
be readable there: a column in the accounts table, searchable however the
caller spells it, and a column on the credentials CSV that is the printed
slip. Read from the account, not the credential row — that row is the
seven-day secret.

Canonical, not grouped, on both surfaces, so the characters the office
reads off the screen are the characters the person reads off the slip.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: The app signs in with a Juvi ID

The app's whole sign-in path in one task, because the pieces cannot compile apart: the screen's
submit call is `SessionController.signIn`, the controller's call is `AuthRepository.signIn`, and
the wire body is the regenerated client. Splitting them leaves a commit where the app does not
build, and there is nothing in an intermediate state worth reviewing.

The Dart client is regenerated here and only here (R-I) — the two backend contract changes it
needs, Tasks 4 and 5, are already committed and `mobile/api/openapi.json` already carries them.

**Files:**
- Regenerate: `mobile/packages/juvi_api/**` (via `mobile/tool/gen_api.sh`)
- Modify: `mobile/lib/core/repos/auth_repository.dart:22,57-72`
- Modify: `mobile/lib/core/session/session_controller.dart:72-83`
- Modify: `mobile/lib/features/auth/sign_in_screen.dart` (whole file)
- Delete: `mobile/lib/features/auth/institution_code_field.dart`
- Modify: `mobile/lib/app/l10n/app_en.arb:5-13`, plus the regenerated `app_localizations.dart` and `app_localizations_en.dart`
- Test: `mobile/test/core/session/session_controller_test.dart:77-86`
- Test: `mobile/test/features/auth/sign_in_screen_test.dart` (whole file)
- Test: `mobile/test/flows/sign_in_flow_test.dart` (four regions: 107-124, 209-212, 303-311, 372-374)
- Not touched: `mobile/test/core/repos/auth_repository_test.dart` — every test in it is a `lookupInstitution` test, and that method stays (D8); `mobile/lib/features/auth/institution_accent.dart` — it does not exist on this branch (R-G).

**Interfaces:**
- Consumes: Task 4's contract — request `{juviId, password, device}`, response gaining a top-level `collegeId` (D7); Task 5's `Me.juviId`, which only Task 9 reads.
- Produces: `AuthRepository.signIn({required String juviId, required String password, required DeviceInfo device}) → Future<({Tokens tokens, AccountSummary account, String collegeId})>`; `SessionController.signIn({required String juviId, required String password})`; `AppLocalizations.juviIdLabel` and `AppLocalizations.juviIdFirstTimeHint` (replacing `institutionCodeLabel`, `institutionCodeNotFound`, `identifierLabel` and `firstTimeHint`).

- [ ] **Step 1: Regenerate the Dart client from the committed contract**

```bash
(cd mobile && bash tool/gen_api.sh)
```

Expected: the run opens with `object-or-null check passed (6 known field(s), all parsed via raw Dio)` — if it instead lists fields, Task 5's `Me.juviId` was declared as an object-or-null and must be fixed there, not here. Then the generator rewrites `packages/juvi_api`, and `dart pub get`, `dart run build_runner build --delete-conflicting-outputs` and `flutter pub get` all succeed.

- [ ] **Step 2: Confirm the regenerated request carries the new key**

```bash
(cd mobile && rtk proxy grep -c "juviId" packages/juvi_api/lib/src/model/sign_in_request.dart)
```

Expected: a count of 3 or more. A count of 0 means `mobile/api/openapi.json` predates Task 4 — re-run `npm run openapi:mobile -w backend` before going further.

- [ ] **Step 3: Write the failing test — the controller takes the college from the response**

Replace `mobile/test/core/session/session_controller_test.dart:77-86` with:

```dart
  test('signIn stores tokens, the account and the college the server resolved', () async {
    // The request no longer names a college, so this value can only have come from the
    // response (D7) — hence the deliberately unmistakable value: nothing in this test
    // passes it in.
    when(() => auth.signIn(juviId: 'JUV4K7P2M9X', password: 'pw', device: any(named: 'device')))
        .thenAnswer((_) async => (tokens: const Tokens(accessToken: 'a', refreshToken: 'r'), account: account, collegeId: 'c-from-server'));
    final s = c.read(sessionControllerProvider.notifier);
    await s.signIn(juviId: 'JUV4K7P2M9X', password: 'pw');
    expect(c.read(sessionControllerProvider), const SessionState.signedIn(account));
    expect(mem['juvi.access'], 'a');
    expect(mem['juvi.college_id'], 'c-from-server');
    expect((await db.readDoc('account'))!.json['id'], 'a1');
  });
```

- [ ] **Step 4: Run it to verify it fails**

```bash
(cd mobile && flutter test test/core/session/session_controller_test.dart --plain-name 'signIn stores tokens')
```

Expected: FAIL to compile — `Error: No named parameter with the name 'juviId'.` at both the `auth.signIn(...)` stub and the `s.signIn(...)` call. This is the RED for the whole task: nothing above this task can be written before the old signature is gone.

- [ ] **Step 5: Rewrite the repository's `signIn`**

In `mobile/lib/core/repos/auth_repository.dart`, replace line 22 with:

```dart
  Future<({Tokens tokens, AccountSummary account, String collegeId})> signIn({required String juviId, required String password, required DeviceInfo device});
```

And replace lines 57-72 with:

```dart
  /// The college arrives in the *response* (D7), not the request: the sign-in key is a Juvi
  /// ID, unique across colleges, so nothing names a college until the server has resolved
  /// one. `SessionController` persists this value under the key `deep_link_resolver.dart`
  /// builds its persisted owner key from.
  @override
  Future<({Tokens tokens, AccountSummary account, String collegeId})> signIn({required String juviId, required String password, required DeviceInfo device}) async {
    try {
      final r = await _bare.signIn(signInRequest: wire.SignInRequest.fromJson({
        'juviId': juviId, 'password': password,
        'device': {'id': device.id, 'name': device.name, 'platform': device.platform, 'appVersion': device.appVersion, 'osVersion': device.osVersion},
      }));
      final json = r.data!.toJson();
      return (
        tokens: Tokens(accessToken: json['accessToken'] as String, refreshToken: json['refreshToken'] as String),
        account: AccountSummary.fromJson(Map<String, dynamic>.from(json['account'] as Map)),
        collegeId: json['collegeId'] as String,
      );
    } catch (e) {
      throw ApiFailure.of(e);
    }
  }
```

- [ ] **Step 6: Feed the persisted college from the response**

In `mobile/lib/core/session/session_controller.dart`, replace lines 72-83 with:

```dart
  Future<void> signIn({required String juviId, required String password}) async {
    final auth = ref.read(authRepositoryProvider);
    final device = await ref.read(deviceInfoProvider.future);
    final result = await auth.signIn(juviId: juviId, password: password, device: device);
    final store = ref.read(secureStoreProvider);
    await store.writeTokens(result.tokens);
    // D7: the college now arrives with the response, because the request no longer names one.
    // The persisted value must keep reaching `writeCollegeId`: `deep_link_resolver.dart`
    // builds its owner key as '<collegeId>:<accountId>', so a notification link parked before
    // this change still has to match after it.
    await store.writeCollegeId(result.collegeId);
    final db = await ref.read(appDatabaseProvider.future);
    await db.writeDoc('account', result.account.toJson(), DateTime.now().toUtc());
    state = SessionState.signedIn(result.account);
    ref.read(analyticsProvider).track('account.signed_in', {'kind': result.account.kind});
  }
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
(cd mobile && flutter test test/core/session/session_controller_test.dart)
```

Expected: PASS. Every test in the file, not just the one — the other `signIn`s in this suite are `restore` paths that never named a college.

- [ ] **Step 8: Write the failing screen tests**

Replace `mobile/test/features/auth/sign_in_screen_test.dart` in full with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// riverpod 3.4.3 moved `Override` out of the main flutter_riverpod.dart barrel; see misc.dart.
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/auth_repository.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/sign_in_screen.dart';
import 'package:mocktail/mocktail.dart';

class _Auth extends Mock implements AuthRepository {}

class _Session extends SessionController {
  ApiFailure? failWith;
  String? lastJuviId;
  @override
  SessionState build() => const SessionState.signedOut();
  @override
  Future<void> signIn({required String juviId, required String password}) async {
    lastJuviId = juviId;
    if (failWith != null) throw failWith!;
    state = const SessionState.signedIn(
      AccountSummary(id: 'a', kind: 'student', status: 'onboarding', onboardingStep: 0, onboardingSteps: ['identity'], onboardingComplete: false, mustChangePassword: true),
    );
  }
}

Widget app(List<Override> overrides) => ProviderScope(
      overrides: overrides,
      child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: SignInScreen()),
    );

void main() {
  late _Auth auth;
  late _Session session;
  setUp(() {
    auth = _Auth();
    session = _Session();
  });
  List<Override> ov() => [authRepositoryProvider.overrideWithValue(auth), sessionControllerProvider.overrideWith(() => session)];

  testWidgets('no institution-code field is rendered and no lookup is attempted', (t) async {
    await t.pumpWidget(app(ov()));
    expect(find.bySemanticsLabel('Juvi ID'), findsOneWidget);
    expect(find.bySemanticsLabel('Institution code'), findsNothing);
    verifyNever(() => auth.lookupInstitution(any()));
  });

  testWidgets('the typed Juvi ID reaches the controller, trimmed and otherwise untouched', (t) async {
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Juvi ID'), '  juv 4k7p 2m9x  ');
    await t.enterText(find.bySemanticsLabel('Password'), 'river-lamp-482');
    await t.pump();
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    // Normalisation (case, separators) happens on the server, the only side that can be
    // trusted with it. The app must not mangle what the person transcribed (R-N).
    expect(session.lastJuviId, 'juv 4k7p 2m9x');
  });

  testWidgets('the button stays disabled until a Juvi ID and a password are present', (t) async {
    await t.pumpWidget(app(ov()));
    final button = find.widgetWithText(FilledButton, 'Sign in');
    expect(t.widget<FilledButton>(button).onPressed, isNull);
    await t.enterText(find.bySemanticsLabel('Juvi ID'), 'JUV-4K7P-2M9X');
    await t.pump();
    expect(t.widget<FilledButton>(button).onPressed, isNull);
    await t.enterText(find.bySemanticsLabel('Password'), 'river-lamp-482');
    await t.pump();
    expect(t.widget<FilledButton>(button).onPressed, isNotNull);
  });

  testWidgets('wrong credentials show one generic message and keep the typed Juvi ID; cooldown shows minutes', (t) async {
    session.failWith = const ApiFailure(ApiErrorCode.invalidCredentials, 'x');
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Juvi ID'), 'JUV-4K7P-2M9X');
    await t.enterText(find.bySemanticsLabel('Password'), 'bad');
    await t.pump(); // rebuild so the just-typed password is reflected before the tap finds the button.
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.text('That Juvi ID or password is not right.'), findsOneWidget);
    expect(find.text('JUV-4K7P-2M9X'), findsOneWidget);
    session.failWith = const ApiFailure(ApiErrorCode.cooldown, 'x', detail: {'retryAfterSeconds': 540});
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.text('Too many attempts. Try again in 9 minutes.'), findsOneWidget);
  });

  testWidgets('offline explains that sign-in needs a connection', (t) async {
    session.failWith = const ApiFailure(ApiErrorCode.offline, 'x');
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Juvi ID'), 'JUV-4K7P-2M9X');
    await t.enterText(find.bySemanticsLabel('Password'), 'y');
    await t.pump(); // rebuild so the just-typed password is reflected before the tap finds the button.
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.textContaining('needs a connection'), findsOneWidget);
  });

  testWidgets('a paused college is reported from the server, not from a lookup', (t) async {
    session.failWith = const ApiFailure(ApiErrorCode.institutionPaused, 'Back Monday');
    await t.pumpWidget(app(ov()));
    await t.enterText(find.bySemanticsLabel('Juvi ID'), 'JUV-4K7P-2M9X');
    await t.enterText(find.bySemanticsLabel('Password'), 'river-lamp-482');
    await t.pump();
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pumpAndSettle();
    expect(find.text('Back Monday'), findsOneWidget);
  });

  testWidgets('forgot password opens the explanation sheet', (t) async {
    await t.pumpWidget(app(ov()));
    await t.tap(find.text('Forgot password?'));
    await t.pumpAndSettle();
    expect(find.textContaining('Your college resets Juvi passwords'), findsOneWidget);
  });
}
```

Gone with the old file: the `lookupInstitution` stubs and the `InstitutionIdentity` fixture, the stale-response test (its subject, the debounced lookup, no longer exists), the `'juvi.institution_code'` prefs assertion, and the `registerFallbackValue(DeviceInfo(...))` call — no test in this file stubs `device` any more. `SharedPreferences` goes with its last reader.

- [ ] **Step 9: Rewrite the flow test's two sign-in sites**

In `mobile/test/flows/sign_in_flow_test.dart`, delete the first `/institutions/JIT` mock (lines 108-119) and add `collegeId` to the first sign-in body, so the cascade opens:

```dart
    adapter
      // No `/institutions/JIT` mock: nothing looks a college up before credentials any more.
      // Leaving one here would hide a regression that started calling it.
      ..onPost(
        '/auth/sign-in',
        // `collegeId` travels back in the response (D7); the request does not name a college.
        (s) => s.replyCallback(200, (_) => {'collegeId': 'c1', 'accessToken': 'a', 'accessExpiresIn': 900, 'refreshToken': 'r' * 43, 'account': account()}),
        data: Matchers.any,
      )
```

Delete the second `/institutions/JIT` mock (lines 303-306) and add `collegeId` there too:

```dart
    DioAdapter(dio: dio)
      ..onPost(
        '/auth/sign-in',
        (s) => s.reply(200, {'collegeId': 'c1', 'accessToken': 'a', 'accessExpiresIn': 900, 'refreshToken': 'r' * 43, 'account': account}),
        data: Matchers.any,
      )
```

Then rewrite the first interaction (lines 209-212) and the second (lines 372-374) to type the ID. First:

```dart
    // S01 — a first launch must not be told its (non-existent) session ended.
    expect(find.text('Please sign in again.'), findsNothing);
    // The college is no longer named before credentials: US-1 AC1 and AC5 are deleted with
    // the code field (spec §13), so the first thing typed is the ID.
    await t.enterText(find.bySemanticsLabel('Juvi ID'), 'JUV-4K7P-2M9X');
```

Second:

```dart
    await t.enterText(find.bySemanticsLabel('Juvi ID'), 'JUV-4K7P-2M9X');
```

The **second** site keeps its `expect(find.text('Sign in to your college'), …)` assertion: that copy is unchanged, because the app is still signing into the person's college — it just no longer asks which one. The **first** site does not have that assertion, and never did: at the base revision `sign_in_flow_test.dart:211` reads `expect(find.text('JIT College'), findsOneWidget);`, which asserts the very behaviour this task removes and is therefore **deleted**, not kept. The base file has exactly two `Sign in to your college` assertions (`:366`, `:369`), both inside the second test, and the rewritten file has exactly two (`:352`, `:355`). So the first site loses an assertion and gains none — its rewritten body is the sign-in tap alone.

> **Correction (recorded after Task 8 ran, from `rev-t8-2`'s review).** This paragraph previously read "Both sites keep the `expect(find.text('Sign in to your college'), …)` assertions". That was wrong about the first site. It is a trap, not a typo: this is Step 9 of a rewrite whose whole point is that no assertion may still pin the institution-code behaviour, so an executor following the sentence literally would carry `JIT College` forward — and, had the screen been rewritten as directed, be left with a test that cannot pass for a reason the step never mentions. The implementer read the situation correctly and deleted the assertion; only this prose was wrong.

- [ ] **Step 10: Run both rewritten test files to verify they fail**

```bash
(cd mobile && flutter test test/features/auth/sign_in_screen_test.dart test/flows/sign_in_flow_test.dart)
```

Expected: **FAIL to compile** — not a widget-level failure. `SessionController.signIn` lost its `collegeId` parameter at Step 6 and the old screen still calls it, so both files die on the same error: `lib/features/auth/sign_in_screen.dart:58:65: Error: No named parameter with the name 'collegeId'.` This is the compile-error RED Step 4 declared — *"nothing above this task can be written before the old signature is gone"* — surfacing at the second site, and it is the point: the old screen cannot coexist with the new controller. The widget-level failure this step's shape would otherwise predict (`Found 0 widgets with label "Juvi ID"`) becomes reachable only at Step 14, and then only if the screen rewrite was wrong.

> **Correction (from Task 8's implementation, 2026-10-13).** This line originally predicted `Found 0 widgets with label "Juvi ID"` for both files, plus a `SignInResponse` deserialisation error in the flow test if the `collegeId` edits were missed. That is unreachable at this step: `flutter test` compiles both files before running either, and both import the screen Step 11 has not rewritten yet, so the run stops at the compiler. The deserialisation error does appear, but at **Step 4** — Step 1's regeneration makes `SignInResponse.collegeId` required while the flow test's two mocks do not yet send it, so that full-suite run reads `345 passed, 3 failed`. Those three entries are **not** three tests: one is the load failure of `session_controller_test.dart`, whose 18 tests never run, and the other two are the flow tests, reconciling as `345 + 18 + 2 = 365`, the branch point's green count.

- [ ] **Step 11: Rewrite the screen**

Replace `mobile/lib/features/auth/sign_in_screen.dart` in full with:

```dart
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/forgot_password_sheet.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _juviId = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;
  bool _obscure = true;

  @override
  void dispose() {
    _juviId.dispose();
    _password.dispose();
    super.dispose();
  }

  // Nothing gates the button but the two fields: the Juvi ID is the only key, and the college
  // is resolved by the server after the password is checked (spec §6). A paused college can no
  // longer be known before credentials, so it reaches this screen only as the 503's message.
  bool get _canSubmit => _juviId.text.trim().isNotEmpty && _password.text.isNotEmpty && !_busy;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Trimmed, and otherwise sent exactly as typed: normalisation (case, separators) belongs
      // to the server, the only side that can be trusted with it (R-N).
      await ref.read(sessionControllerProvider.notifier).signIn(juviId: _juviId.text.trim(), password: _password.text);
    } on ApiFailure catch (f) {
      if (!mounted) return;
      final l = context.l10n;
      setState(() => _error = switch (f.code) {
            ApiErrorCode.invalidCredentials => l.invalidCredentials,
            // R56: floor at 1 minute so a 0 or missing retryAfterSeconds never reads "0 minutes".
            ApiErrorCode.cooldown => l.cooldownMessage(math.max(1, ((f.retryAfterSeconds ?? 60) / 60).ceil())),
            ApiErrorCode.offline => l.signInNeedsConnection,
            // R56: ApiFailure.fromDio strips `message` out of `detail` into the top-level field.
            ApiErrorCode.institutionPaused => f.message,
            _ => f.message,
          });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final session = ref.watch(sessionControllerProvider);
    final reason = session is SignedOut ? session.reason : null;
    final reasonText = switch (reason) {
      'signed_out_elsewhere' => l.signedOutElsewhere,
      'password_changed' => l.signedOutPasswordChanged,
      null || 'restore' => null,
      _ => l.signedOutGeneric,
    };

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 32),
            Text(l.appName, style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(l.signInTitle, style: Theme.of(context).textTheme.titleMedium),
            if (reasonText != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(reasonText, style: TextStyle(color: Theme.of(context).colorScheme.tertiary))),
            const SizedBox(height: 28),
            TextField(controller: _juviId, autocorrect: false, decoration: InputDecoration(labelText: l.juviIdLabel), onChanged: (_) => setState(() {})),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: _obscure,
              autocorrect: false,
              decoration: InputDecoration(
                labelText: l.passwordLabel,
                suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined), onPressed: () => setState(() => _obscure = !_obscure)),
              ),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) {
                if (_canSubmit) unawaited(_submit());
              },
            ),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _canSubmit ? _submit : null,
              child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Text(l.signInButton),
            ),
            const SizedBox(height: 16),
            Text(l.juviIdFirstTimeHint, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
            TextButton(onPressed: () => unawaited(showForgotPasswordSheet(context)), child: Text(l.forgotPassword)),
          ],
        ),
      ),
    );
  }
}
```

Then delete the field it replaced, and the two imports only it needed:

```bash
git rm mobile/lib/features/auth/institution_code_field.dart
```

`dart:math` stays — `math.max` floors the cooldown message (R56). `dart:async` stays — `unawaited` is still used on submit and on the forgot-password sheet. `shared_preferences` goes with its last reader on this screen.

- [ ] **Step 12: Rewrite the copy**

In `mobile/lib/app/l10n/app_en.arb`, replace lines 5-7:

```json
  "institutionCodeLabel": "Institution code",
  "institutionCodeNotFound": "We couldn't find that college code.",
  "identifierLabel": "Roll number, employee code or email",
```

with:

```json
  "juviIdLabel": "Juvi ID",
```

replace line 10:

```json
  "firstTimeHint": "First time? Use the temporary password you received.",
```

with:

```json
  "juviIdFirstTimeHint": "First time? Your Juvi ID and temporary password are on the slip from your college office.",
```

and replace line 13:

```json
  "invalidCredentials": "That identifier or password is not right.",
```

with:

```json
  "invalidCredentials": "That Juvi ID or password is not right.",
```

`signInTitle` ("Sign in to your college") is deliberately left alone: it is still true — the app signs into the person's college, it simply no longer asks them which one — and the flow tests assert it.

- [ ] **Step 13: Regenerate the localisations**

```bash
(cd mobile && flutter gen-l10n)
```

Expected: no output, exit 0. `mobile/lib/app/l10n/app_localizations.dart` and `app_localizations_en.dart` are tracked files that the build regenerates, so they must be committed with the arb rather than left to CI.

- [ ] **Step 14: Run both test files to verify they pass**

```bash
(cd mobile && flutter test test/features/auth/sign_in_screen_test.dart test/flows/sign_in_flow_test.dart)
```

Expected: PASS. If the screen test reports `Found 0 widgets with label "Juvi ID"`, `flutter gen-l10n` did not run or the label key is still `identifierLabel`.

- [ ] **Step 15: Verify the whole app**

```bash
(cd mobile && flutter analyze)
(cd mobile && flutter test)
```

Expected: analyze clean (no `unused_import` for `dart:math`, `dart:async`, `models.dart` or `shared_preferences` in the files just edited — an unused-import warning is a leftover of the deletion, not noise); the suite green, at the same count as before this task plus the four tests added here and minus the three `sign_in_screen_test.dart` cases deleted with the lookup.

- [ ] **Step 16: Commit**

```bash
git rm mobile/lib/features/auth/institution_code_field.dart
git add mobile/packages/juvi_api \
        mobile/lib/core/repos/auth_repository.dart \
        mobile/lib/core/session/session_controller.dart \
        mobile/lib/features/auth/sign_in_screen.dart \
        mobile/lib/app/l10n/app_en.arb \
        mobile/lib/app/l10n/app_localizations.dart \
        mobile/lib/app/l10n/app_localizations_en.dart \
        mobile/test/core/session/session_controller_test.dart \
        mobile/test/features/auth/sign_in_screen_test.dart \
        mobile/test/flows/sign_in_flow_test.dart
git commit -m "$(cat <<'EOF'
feat(juvi): the app signs in with a Juvi ID

One field, no institution code. The person types the ID their college
office issued; the server resolves the account and answers with the
college it found, which is what the phone persists for deep links (D7).

The screen loses its debounced lookup, its remembered-code preference and
the pre-login college name with it — US-1's AC1 and AC5 are deleted by
this work (spec §13), because nothing can know a college before
credentials any more. A paused college therefore reaches the screen only
as the 503's message, the same way it reaches every other surface.

The ID is sent as typed, trimmed; normalisation lives in one place, on
the server, which is the only side that can be trusted with it (R-N).

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: The app shows your Juvi ID

A signed-in person has to be able to read their own ID back — it is the only key the app accepts,
and D2's recovery path is "ask the college office", which works only if the person can say what
they are asking about. The `/me` payload already carries it (Task 5); this task renders it.

**Files:**
- Modify: `mobile/lib/core/models/models.dart:130-144`
- Regenerate: `mobile/lib/core/models/models.freezed.dart`, `mobile/lib/core/models/models.g.dart` (via `build_runner`)
- Modify: `mobile/lib/features/me/me_screen.dart:34-72,78-104`
- Modify: `mobile/lib/app/l10n/app_en.arb` (+ the two regenerated `app_localizations*.dart`)
- Test: `mobile/test/core/repos/me_repository_test.dart:34-74`
- Test: `mobile/test/features/me/me_screen_test.dart`

**Interfaces:**
- Consumes: Task 5's `Me.juviId` (`z.string().nullable()` — `null` only for an account the backfill has not reached, R-J); `AppLocalizations.juviIdLabel`, added by Task 8.
- Produces: nothing later tasks consume. This is the last mobile task.

- [ ] **Step 1: Write the failing model test**

In `mobile/test/core/repos/me_repository_test.dart`, add the key to the fixture — immediately after the `'account'` block closes, mirroring the response's own order:

```dart
  'juviId': 'JUV4K7P2M9X',
```

and add this assertion to the existing `'Me parses the /me payload, including nulls'` test (after `expect(me.faculty, isNull);`):

```dart
    expect(me.juviId, 'JUV4K7P2M9X');
```

- [ ] **Step 2: Run it to verify it fails**

```bash
(cd mobile && flutter test test/core/repos/me_repository_test.dart)
```

Expected: FAIL to compile — `The getter 'juviId' isn't defined for the class 'Me'.` This is the RED that proves freezed is what carries the field: `Me.fromJson` would silently drop the key, so without the model change the fixture addition above changes nothing.

- [ ] **Step 3: Declare the field**

In `mobile/lib/core/models/models.dart`, extend the `Me` factory's optional parameters (after `String? deletionRequestedVia,`):

```dart
    /// The durable Juvi ID (spec §8). Nullable rather than required (R-J): the server sends
    /// null for an account the backfill has not reached, and — like `deletionRequestedAt`
    /// above — it must be declared **here** and not only on the wire model, because freezed's
    /// `fromJson` drops unknown keys silently, so a server-only field would leave this `Me`
    /// without it and the row below would simply never render.
    String? juviId,
```

Then regenerate the freezed part files:

```bash
(cd mobile && dart run build_runner build --delete-conflicting-outputs)
```

Expected: `models.freezed.dart` and `models.g.dart` rewritten with `juviId` (copies, `==`, `hashCode`, `toString`, `toJson`, `fromJson`).

- [ ] **Step 4: Run the model test to verify it passes**

```bash
(cd mobile && flutter test test/core/repos/me_repository_test.dart)
```

Expected: PASS.

- [ ] **Step 5: Write the failing row test**

In `mobile/test/features/me/me_screen_test.dart`, grow the existing `'shows the identity card, settings, devices, about and sign-out entries'` test's surface from `Size(800, 1400)` to `Size(800, 1600)` — the About section gained a row and that test asserts entries all the way down to Sign out. Then add a new test before that one:

```dart
  testWidgets('the Me screen groups the Juvi ID for reading and copies the canonical value', (t) async {
    t.view.physicalSize = const Size(800, 1600);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    // The clipboard is a platform channel; nothing else in this test touches it.
    final copied = <String>[];
    t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied.add((call.arguments as Map)['text'] as String);
      return null;
    });
    addTearDown(() => t.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    await t.pumpWidget(
      ProviderScope(
        retry: (_, _) => null,
        overrides: [
          meProvider.overrideWith((_) async* {
            yield Cached(Me.fromJson(meJson), DateTime.now());
          }),
        ],
        child: const MaterialApp(localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: MeScreen()),
      ),
    );
    await t.pump();
    // Grouped on screen (spec §4), because this row exists to be read aloud off the phone.
    expect(find.text('JUV-4K7P-2M9X'), findsOneWidget);
    expect(find.text('JUV4K7P2M9X'), findsNothing);
    await t.tap(find.text('JUV-4K7P-2M9X'));
    await t.pumpAndSettle();
    // Canonical on the clipboard: what the office's accounts table shows (R-M, R-O).
    expect(copied, ['JUV4K7P2M9X']);
    expect(find.text('Juvi ID copied'), findsOneWidget);
  });
```

Add `import 'package:flutter/services.dart';` to that file's imports.

- [ ] **Step 6: Run it to verify it fails**

```bash
(cd mobile && flutter test test/features/me/me_screen_test.dart)
```

Expected: FAIL — `Found 0 widgets with text "JUV-4K7P-2M9X"`. The row does not exist yet.

- [ ] **Step 7: Add the row**

In `mobile/lib/features/me/me_screen.dart`, add the import:

```dart
import 'package:flutter/services.dart';
```

In the About section, immediately after `SectionHeader(l.meAboutSection)` and before the app-version tile:

```dart
              // The ID a person signs in with, on the one surface they are already signed in
              // to — so they can read it back, or send it to themselves before they need it.
              if (m.juviId != null)
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: Text(l.juviIdLabel),
                  subtitle: Text(_groupedJuviId(m.juviId!)),
                  trailing: const Icon(Icons.copy_outlined),
                  onTap: () => unawaited(_copyJuviId(context, l, m.juviId!)),
                ),
```

And add these below the class, next to the other file-private helpers:

```dart
/// `JUV4K7P2M9X` → `JUV-4K7P-2M9X` (spec §4's display form, R-O). Presentation only: storage
/// and the request body stay canonical, and anything the server compares is normalised there.
String _groupedJuviId(String id) => id.length == 11 ? '${id.substring(0, 3)}-${id.substring(3, 7)}-${id.substring(7)}' : id;

/// Copies the canonical value, not the grouped one: the person is most likely to paste this
/// into a message, and what the office's accounts table shows is the canonical form (R-M).
Future<void> _copyJuviId(BuildContext context, AppLocalizations l, String id) async {
  await Clipboard.setData(ClipboardData(text: id));
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.meJuviIdCopied)));
}
```

- [ ] **Step 8: Add the copy**

In `mobile/lib/app/l10n/app_en.arb`, after the `meAboutSection` line, add:

```json
  "meJuviIdCopied": "Juvi ID copied",
```

One key, not two: the row's label reuses `juviIdLabel` from Task 8 — one label for the ID on both surfaces — and the copy affordance carries the meaning without a hint line, so there is no second string to keep in step with the first.

- [ ] **Step 9: Regenerate the localisations**

```bash
(cd mobile && flutter gen-l10n)
```

Expected: no output, exit 0; both generated files updated.

- [ ] **Step 10: Run both test files to verify they pass**

```bash
(cd mobile && flutter test test/core/repos/me_repository_test.dart test/features/me/me_screen_test.dart)
```

Expected: PASS, including the pre-existing entries test at its new surface size.

- [ ] **Step 11: Verify the whole app**

```bash
(cd mobile && flutter analyze)
(cd mobile && flutter test)
```

Expected: analyze clean; the suite green — this task adds one test and changes one, and no other test reads `Me`.

- [ ] **Step 12: Commit**

```bash
git add mobile/lib/core/models/models.dart \
        mobile/lib/core/models/models.freezed.dart \
        mobile/lib/core/models/models.g.dart \
        mobile/lib/features/me/me_screen.dart \
        mobile/lib/app/l10n/app_en.arb \
        mobile/lib/app/l10n/app_localizations.dart \
        mobile/lib/app/l10n/app_localizations_en.dart \
        mobile/test/core/repos/me_repository_test.dart \
        mobile/test/features/me/me_screen_test.dart
git commit -m "$(cat <<'EOF'
feat(juvi): show the Juvi ID on the Me screen

The ID is the only key the app accepts, so the person has to be able to
read it back — and the recovery path is asking the college office, which
needs them to know what they are asking about.

Grouped for reading, canonical on the clipboard, because that is what the
office's accounts table shows (R-O). Nullable throughout: an account the
backfill has not reached has no ID yet, and the row simply does not
render rather than the field going missing from the model.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: The compatibility door — CONDITIONAL

**Do not build this task unless the answer to spec §9's precondition is "no".** The precondition
is: *no Juvi app build is in a real user's hands*. As of 2026-10-13 the only device build is a
local emulator and the Play listing's data-safety URL is still pending, so the expected answer is
"yes, it is atomic" and this task is skipped. Build it only if someone has a shipped build —
because then that build sends `{collegeId, identifier, password, device}`, and after Task 4 the
route answers it with `400 VALIDATION_FAILED`, which the old build renders as a generic failure
with no hint that the app is the problem.

What it must not become: a second login path. The legacy body is recognised and refused; nothing
in it is looked up, so it cannot disclose whether an identifier exists.

**Files:**
- Modify: `backend/src/modules/juvi-app/accounts/schemas.ts` (add `legacySignInSchema` below `signInSchema`)
- Modify: `backend/src/modules/juvi-app/accounts/auth-controller.ts:3,6-8`
- Test: `backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts` (a new `describe` block)
- Not regenerated: `mobile/api/openapi.json` — the door is deliberately absent from the contract, so a `git diff --stat mobile/api/openapi.json` after this task must be empty. Registering `legacySignInSchema` would put a retired request shape back in the published contract.

**Interfaces:**
- Consumes: `signInSchema` (Task 4, a `ZodEffects` over the Juvi ID body); `deviceSchema` (`schemas.ts:6`); `MobileApiError` (`../errors`); `STORE_URLS` (`../middleware/authenticate-mobile:24`); the mobile `signIn` helper and `UNKNOWN_JUVI_ID` from Task 4's rewrite of the same test file.
- Produces: nothing. This is the last task in the plan.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts`:

```ts
describe('the legacy sign-in body (spec §9)', () => {
  // The shape a build shipped before the Juvi ID sends. `s` is the seeded student from the file's
  // `beforeEach`; `s.student.rollNumber` is what that build put in `identifier`.
  function legacy(body: Record<string, unknown> = {}) {
    return mobileClient(app).post(`${V1}/auth/sign-in`).send({
      collegeId: s.collegeId,
      identifier: s.student.rollNumber,
      password: s.temporaryPassword,
      device: TEST_DEVICE,
      ...body,
    });
  }

  it('answers UPDATE_REQUIRED rather than a bare 400, and does not sign in', async () => {
    const res = await legacy().expect(426);
    expect(res.body.error.code).toBe('UPDATE_REQUIRED');
    expect(res.body.error.storeUrl).toBe(STORE_URLS.android);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('answers identically for an identifier that does not exist', async () => {
    // The door must reveal nothing: it never looks the identifier up, so a real one and an
    // invented one are indistinguishable — the same property the Juvi ID flow keeps.
    const real = await legacy();
    const fake = await legacy({ identifier: 'NOBODY-0000', password: 'not-a-password' });
    expect(fake.status).toBe(real.status);
    expect(fake.body).toEqual(real.body);
  });

  it('still rejects a body that matches neither shape', async () => {
    const res = await mobileClient(app).post(`${V1}/auth/sign-in`).send({ hello: 'world' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('still rejects a legacy body whose collegeId is not an ObjectId', async () => {
    await legacy({ collegeId: 'not-an-id' }).expect(400);
  });
});
```

Add `STORE_URLS` to that file's imports: `import { STORE_URLS } from '../../modules/juvi-app/middleware/authenticate-mobile';` — adjust the path to the file's own depth, and if the e2e helpers already re-export it, use theirs.

- [ ] **Step 2: Run them to verify they fail**

```bash
npm run test:e2e -w backend -- juvi-app-auth
```

Expected: FAIL — the first four all get `400` and `VALIDATION_FAILED`, because the route only knows the Juvi ID shape. If the "does not exist" test passes while the others fail, that is an accident of both bodies being 400s; it must pass for the real reason after Step 3.

- [ ] **Step 3: Accept the legacy shape**

In `backend/src/modules/juvi-app/accounts/schemas.ts`, below `signInSchema`:

```ts
/**
 * Spec §9's compatibility door. The sign-in body a build shipped *before* the Juvi ID sends:
 * `{collegeId, identifier, password, device}`. It exists only so the handler can answer it with
 * UPDATE_REQUIRED — an update prompt the old build already knows how to render — instead of a
 * 400 it would show as a generic failure. It is never a login: nothing parsed here reaches
 * `auth.signIn` or any lookup.
 */
export const legacySignInSchema = z.object({
  collegeId: objectId,
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
  device: deviceSchema,
});
```

- [ ] **Step 4: Refuse it in the handler**

In `backend/src/modules/juvi-app/accounts/auth-controller.ts`, extend the imports:

```ts
import { signInSchema, legacySignInSchema, refreshSchema, changePasswordSchema } from './schemas';
import { MobileApiError } from '../errors';
import { STORE_URLS } from '../middleware/authenticate-mobile';
```

and replace `signIn` (lines 6-8) with:

```ts
export async function signIn(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = signInSchema.safeParse(req.body);
    if (!parsed.success) {
      // Spec §9: an old build meeting the Juvi ID contract. Answer the shape it can render —
      // the same 426 the version gate sends, which every shipped build already handles — rather
      // than a 400 it would show as a generic failure. A refusal, not a login: `auth.signIn` is
      // not reached and nothing in the legacy body is looked up, so this cannot disclose whether
      // an identifier exists.
      if (legacySignInSchema.safeParse(req.body).success) {
        const platform = (req.body as { device?: { platform?: unknown } }).device?.platform;
        throw new MobileApiError(426, 'UPDATE_REQUIRED', 'Please update Juvi to continue.', {
          storeUrl: STORE_URLS[platform === 'ios' ? 'ios' : 'android'],
        });
      }
      throw parsed.error; // unchanged path: mobileErrorHandler turns a ZodError into 400 VALIDATION_FAILED + `fields`
    }
    res.json(await auth.signIn(parsed.data));
  } catch (e) { next(e); }
}
```

- [ ] **Step 5: Run them to verify they pass**

```bash
npm run test:e2e -w backend -- juvi-app-auth
```

Expected: PASS, the whole file — the Juvi ID tests from Task 4 must be untouched by this change.

- [ ] **Step 6: Verify the contract did not move**

```bash
npm run typecheck -w backend
git diff --stat mobile/api/openapi.json
```

Expected: typecheck clean (with `noUnusedLocals` on, an unused `legacySignInSchema` import is an error, not a warning); the diff empty. A non-empty diff means something registered the legacy schema — undo that.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/juvi-app/accounts/schemas.ts \
        backend/src/modules/juvi-app/accounts/auth-controller.ts \
        backend/src/__e2e__/modules/juvi-app-auth.e2e.test.ts
git commit -m "$(cat <<'EOF'
feat(juvi): answer the pre-Juvi-ID sign-in body with UPDATE_REQUIRED

Built because a Juvi build is already in real users' hands (spec §9), so
that build's {collegeId, identifier, password, device} would otherwise
meet the Juvi ID route and be told only that something was invalid.

A refusal, not a login: the legacy body is recognised and thrown away —
nothing is looked up — so it says no more than an update prompt and keeps
the anti-enumeration property the Juvi ID flow was built around.

Not in the contract on purpose: the published request shape is the Juvi
ID, and registering this one would put a retired shape back in it.

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

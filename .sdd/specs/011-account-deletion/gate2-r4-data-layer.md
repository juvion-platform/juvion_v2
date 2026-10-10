# GATE 2 — Data-Layer Validator, round 4 — 011 Juvi account deletion

**Verdict: PASS — 0 CRITICAL · 0 HIGH · 1 MEDIUM · 5 LOW.**

`DL-R3-H1` is **genuinely resolved**. The blocking round-3 HIGH — the sweep's
`status: { $in: ELIGIBLE_STATUSES }` predicate excluding accounts that legitimately hold a pending
deletion — is gone from §3.5.1's query, the field is now the sole predicate, and the query as
written is correct. GATE 2's bar (0 CRITICAL + 0 HIGH) is met for the data layer.

Scope: spec `spec.md` (the revision-4 body — see `DL-R4-L5` on the header label) against live code,
focused on the round-4 delta (§3.5.1 query + claim + schema/index, the `AuditAction` enum
additions, the §3.1 reset, Story 4 AC1's clear, Story 4 AC5's list, the AC7 sweep carve-out), plus
a re-check of every round-3 clean item. All refs from the worktree `juvi-flutter-shell` @ 2026-10-10.
Inputs: `spec.md`, `discovery.md`, `gate2-resolution.md` (Parts A–C), `gate2-r3-data-layer.md`,
`gate2-r2-data-layer.md`.

---

## What I verified clean

- **DL-R3-H1 — resolved, and the replacement query is correct.** §3.5.1's trigger is now
  `JuviAccount.find({ deletionRequestedAt: { $lte: new Date(Date.now() - DELETION_GRACE_DAYS * 86_400_000) } })`
  (`spec.md:388-392`) with **no `status` clause**. The old predicate's exclusion set is real:
  `ACCOUNT_STATUSES` = `['onboarding','active','exiting','deactivated','alumni']`
  (`JuviAccount.ts:9`) and `ELIGIBLE_STATUSES` = `['onboarding','active']` (`JuviAccount.ts:11-12`)
  — a *membership/sign-in* predicate, per its own comment at `:11`. The reachable bad state is
  unchanged and the fix addresses it: `signIn` refuses only `deactivated`/`!isActive`
  (`accounts/auth-service.ts:60`), so an `exiting` account can hold a request; `authenticateMobile`
  likewise rejects only `deactivated` (`middleware/authenticate-mobile.ts:45`); and
  `deactivateAccount` (`provisioning-service.ts:206-214`) fires from the admin console
  (`admin/accounts-controller.ts:13`) and the admissions workflow. With the predicate removed,
  every such row is selected. `$lte` on a `Date` vs a missing field does not match a missing field,
  which is the intended scope (`DL-R4-M1` covers the null case).
- **The atomic claim is shaped like its cited precedent.** §3.5.1's claim
  (`spec.md:400-407`) mirrors `proposal-expiry-worker.ts:41-47`: one `findOneAndUpdate` with the
  field re-asserted in the filter, `{ new: true }`, and `if (!claimed) continue`. A cancellation
  that `$unset`s the field between scan and claim makes the filter miss → skip. The precedent's own
  filter shape is confirmed at `:43` (`{ _id: doc._id, status: 'proposed', expiresAt: { $lte: now } }`),
  and its repeat schedule at `:126-130`. §3.5.1's "not a lock / does not exclude the row from the
  next tick" is accurate: nothing in the claim's filter references `deletionClaimedAt`, so a crashed
  sweep retries.
- **`'request_deletion'` genuinely needs both closed enums, and both are the only copies.**
  `AuditAction` (`shared/types.ts:26-55`) has no `request_deletion`; the Mongoose mirror
  `AUDIT_ACTIONS: AuditAction[]` (`shared/audit.ts:27-37`) has none, and the schema uses it as the
  enum (`audit.ts:45`). The two failure modes are exactly as the spec states (`spec.md:92-97`):
  adding to the union only → `createAuditLog({ action: 'request_deletion' })` typechecks
  (`createAuditLog(entry: AuditEntry)`, `audit.ts:60-62`) but throws a Mongoose enum
  `ValidationError` at `:45`; adding to the array only → the array's `AuditAction[]` annotation
  (`:27`) fails `tsc`. A repo-wide search for other `AuditAction` copies (`ai_score_computed`,
  `waitlist_promote` across `backend/src`, `admin-portal/src`, `mobile`) returns only the union, the
  mirror, and call sites — **no third mirror is missed**. The precedent `'acknowledge'` is present in
  both (`types.ts:48`, `audit.ts:32`), and §5 lists both additions (`spec.md:571-575`).
- **§3.1's reset is field-accurate, type-correct, and its recount is character-exact.** All six
  reset fields exist with the right nullability: `accountId` `default: null` (`NoticeRecipient.ts:62`),
  `receivedAt`/`seenAt`/`dismissedAt`/`remindedAt` (`:68-71`, all `Date | null`), `ack`
  (`:72`, `INoticeAck | null`) — so `$set: <field>: null` (spec `spec.md:274-276`) is the **correct**
  operator *here*. `{noticeId, personId}` is unique (`:78`). The `_id`-narrowed update and the
  capture-before-update sequence are the shipped pattern in `onAccountActivated`
  (`recipient-service.ts:20-25`, `.select('_id noticeId addedLater').lean()` then
  `_id: { $in: rows.map((r) => r._id) }`), so the `.lean()` `_id` shape **typechecks under
  `noUncheckedIndexedAccess`** (`tsconfig.base.json` sets `strict`, `noUnusedLocals`,
  `noUncheckedIndexedAccess`; `.map`/`.filter` callbacks receive `T`, not `T | undefined`). The
  recount (`spec.md:282-285`) is byte-for-byte `recipient-service.ts:30-31`, including
  `addedLater: false, accountId: { $ne: null }` and `status: { $ne: 'publishing' }`; the
  `!r.addedLater` snapshot filter (`spec.md:268`) matches `recipient-service.ts:28`.
- **The six-collection `accountId` sweep still holds exactly.** `ref: 'JuviAccount'` across
  `backend/src` returns exactly six models — `JuviEvent.ts:20`, `MobileSession.ts:35`,
  `ChannelMembership.ts:20`, `NotificationDelivery.ts:47`, `NoticeRecipient.ts:62`,
  `JuviProvisionedCredential.ts:25` — matching §3.1's "exactly six". No seventh under any spelling
  (`RecruiterActivityLog.recruiterAccountId` refs `RecruiterAccount`, a different model). §3.1's
  line citations `NotificationDelivery.ts:47` and `JuviEvent.ts:20` are line-accurate, and every
  hard-delete key is index-served (`MobileSession.ts:54`, `ChannelMembership.ts:31`,
  `JuviProvisionedCredential.ts:42`; `collegeId` indexed on `NotificationDelivery.ts:46` and
  `JuviEvent.ts:19`).
- **`RevokeReason` and its client tolerance are as described.** The union (`MobileSession.ts:4-6`)
  and `REVOKE_REASONS` (`:8-10`, referenced by the enum at `:47`) both need `'account_deleted'`; the
  reason surfaces via `getSessionState` (`session-service.ts:190,195-198`) into the 401 body
  (`middleware/authenticate-mobile.ts:39`). The Dart side tolerates a new value: the model field is
  an open string (`mobile/lib/core/http/api_failure.dart:78`), and the one reason-switch
  (`mobile/lib/features/auth/sign_in_screen.dart:82-87`) has a `_ => l.signedOutGeneric` wildcard.
  No client enum needs widening — round 3's finding stands.
- **Story 2 AC2's write-through revoke is real and idempotent.** `revokeSession`
  (`session-service.ts:148-153`) matches `revokedAt: null`, `$set`s the reason, `$unset`s
  `pushToken`, and writes the cache (`revoked:<reason>`, TTL 900 s = `ACCESS_TOKEN_TTL_SECONDS`),
  which outlives the 60 s active cache (`:10-11`) — so the "sessions deleted while the account still
  exists" invariant (§5, `spec.md:555-563`) is closed. `juvi:acct-touch:<accountId>` is real
  (`authenticate-mobile.ts:86`).
- **Story 2 AC8's key choice is correct.** `{collegeId, userId}` is non-unique
  (`JuviAccount.ts:96`); `{collegeId, personId}` is the unique index (`:95`) and provisioning
  resolves the `User` by `{collegeId, personId}` (`provisioning-service.ts:105`).
- **No cascade hooks and one creation site.** `JuviAccount` declares no `pre`/`post` middleware —
  the file's only `schema.index` calls are `:95-99` — and `JuviAccount.create` appears in production
  code **only** at `provisioning-service.ts:135` (the other hits are tests), so the explicit deletion
  set is the whole set.
- **The provisioning `create` audit is line-accurate.** `await createAuditLog({` at
  `provisioning-service.ts:165`, closing at `:174`, with `action: 'create'`, `entityType:
  'JuviAccount'` — exactly the row the AC4 existence guard must discriminate by including
  `action: 'delete'` (`spec.md:96-99`, `:566-567`). The guard query keys are schema-valid and
  index-supported (`audit.ts:42,51`).
- **The AC7 / §5 tenancy carve-out is written and complete.** Story 2 AC7 (`spec.md:114-122`) and §5
  (`spec.md:546-549`) both name the sweep as the one sanctioned cross-tenant read, require that it is
  "not reachable from any request path", and rest isolation on the per-row `collegeId` writes. I
  re-enumerated every query in the spec: the reset find/update/recount and the audit guard all carry
  `collegeId` (`spec.md:266,273,283-284`, `:96-99`); the only `collegeId`-less reads are the sweep's
  scan and its `_id`-keyed claim, both inside the sanctioned exception. No request-path query is left
  unscoped by the exception.
- **`deactivateAccount` is correctly named forbidden, and the cited lines are right.**
  `provisioning-service.ts:206-214` sets `User.isActive = false` (`:210`) and soft-revokes
  (`:211`) — the ERP-login break §1 warns about — and `transitionAccount(account,'deactivated',…)`
  is at `:209`. (It also hard-deletes `ChannelMembership` rows at `:212`, which §3.3 does not
  mention; harmless to the argument, but if the plan compares helpers, the difference is worth
  knowing.) Re-provisioning AC3 holds: `resetPassword` defaults true (`:94`), and the rotation path
  refuses only when `user.isActive === false` (`:125-127`), which deletion never causes.
- **The §3.6 contract precedents exist as cited.** `document.ts:147` `signOut`, `:154`
  `revokeDevice`, `:176` `clearPushToken`.

---

## Findings

### DL-R4-M1 — the request fields' lifecycle is underspecified: "unset" is never named as `$unset`, and the sweep scan omits the `$ne: null` guard its own precedent carries

- **Evidence — the scan's twin includes the guard; the scan does not.** The cited precedent's scan
  is `HostelAllocation.find({ status: 'proposed', expiresAt: { $lte: now, $ne: null } })`
  (`shared/jobs/proposal-expiry-worker.ts:35-38`, and identically `:72-75`) — it carries `$ne: null`.
  The spec's claim query also carries it (`spec.md:402`: `deletionRequestedAt: { $lte: deadline, $ne: null }`).
  But the spec's **scan** (`spec.md:388-392`) is `{ deletionRequestedAt: { $lte: … } }` with **no
  `$ne: null`**. In MongoDB's BSON order, `Null` sorts *before* `Date`, so
  `{ deletionRequestedAt: { $lte: <Date> } }` **matches a document whose field is `null`** (and does
  not match a document whose field is absent).
- **Evidence — the sparse-index rationale requires absence, but the spec never requires absence.**
  §3.5.1 justifies the index as sparse "because the field is **absent** on almost every account"
  (`spec.md:426-428`), and Story 4 AC1 says the request fields "go back to **unset**"
  (`spec.md:207-209`) — but no line states the schema fields must be declared **without
  `default: null`**, and no line names the clear operator. `JuviAccount`'s schema is
  `new Schema<IJuviAccount>(…)` with no `strict` override (`JuviAccount.ts:63-93`), so a `default:
  null` (or `$set: null`) is silently accepted. If that path is taken: (a) every document carries a
  `null` value, so the "sparse" index indexes the whole collection and its rationale is falsified;
  (b) the hourly scan matches **every** account and touches them all before the claim discards them
  (the claim does not, so nothing is wrongly deleted — see below); (c) an admin list written as
  `{ $exists: true }` rather than `{ $ne: null }` would render every account as a pending deletion.
- **Why it is (only) a MEDIUM.** The correctness of deletion is preserved by the claim's `$ne: null`
  (`spec.md:402`): even if the scan over-selects `null` rows, `if (!claimed) continue`
  (`spec.md:406`) skips them. So this is a defeated-index / over-scan / mis-reporting defect, not a
  wrongful-deletion one — hence below the GATE 2 bar, but real. It is the one place in the delta
  where a plausible faithful reading produces a defect, and the spec is internally inconsistent
  (scan without the guard, claim with it, precedent with it).
- **Remedy.** In §3.5.1 (index paragraph) and §6, state the schema shape explicitly:
  `deletionRequestedAt?: Date`, `deletionRequestedVia?: 'public_web'`, `deletionClaimedAt?: Date`,
  **no `default`**, cleared with `$unset: { deletionRequestedAt: 1, deletionRequestedVia: 1 }`
  (Story 4 AC1). Add `$ne: null` to the scan predicate so it reads
  `{ deletionRequestedAt: { $lte: deadline, $ne: null } }`, matching its own claim and the
  precedent. A one-line test asserting the sparse index contains only the pending account (not all
  accounts) closes it.

### DL-R4-L1 — cancellation never clears `deletionClaimedAt`, and the spec does not say it deliberately does not

- **Evidence.** Story 4 AC1 clears exactly two fields — `deletionRequestedAt` and
  `deletionRequestedVia` — and states "nothing else has to be disarmed" (`spec.md:207-210`).
  `deletionClaimedAt`, added by the claim (`spec.md:404`), is left behind. As written this is
  harmless: the claim's filter (`spec.md:402`) does not reference `deletionClaimedAt`, so a later
  re-request re-claims and overwrites it, and the scan keys on `deletionRequestedAt` only.
- **Why it is worth stating.** The residue invites the obvious "optimisation" of adding
  `deletionClaimedAt: null` to the claim filter to avoid re-claiming already-claimed rows — and with
  a stale `deletionClaimedAt` left by a crashed sweep plus a cancel, that addition would make a
  **new** request permanently unclaimable: a re-introduction of the exact silent fail-open class
  `DL-R3-H1` was. The spec should either clear it (`$unset: { deletionClaimedAt: 1 }` on cancel) or
  state explicitly that the claim must not filter on it and why.
- **Remedy.** One clause in Story 4 AC1 / §3.5.1.

### DL-R4-L2 — Story 4 AC5's list reads as cross-tenant and is scoped nowhere, against AC7's "single exception" rule

- **Evidence.** Story 4 AC5 says the endpoint "returns **every** account with a pending
  `deletionRequestedAt` — id, **`collegeId`**, requested-at, …" (`spec.md:231-236`); §3.6 gates it
  with `authenticate` + `authorize()` (`spec.md:516-519`). The Juvi admin router applies
  `adminRouter.use(authenticate)` (`admin/routes.ts:18`) and every sibling admin listing is
  college-scoped from `req.collegeId!` — `listAccounts` builds `{ collegeId, … }`
  (`admin/accounts-service.ts:28`, controller `admin/accounts-controller.ts:10`). The wording
  "every account" plus a returned `collegeId` invites an implementer to omit the filter, which
  Story 2 AC7 forbids ("no query reached from a route runs without it"; the sweep is "the single
  sanctioned exception", `spec.md:114-122`).
- **Why it is only a LOW.** AC7's blanket rule, read literally, already forces the filter, so no
  defect is specified; only the AC5 wording is ambiguous, and a college-scoped list is the correct
  behaviour (the ERP binds each admin to a `collegeId`).
- **Remedy.** State the query in AC5 as `{ collegeId, deletionRequestedAt: { $ne: null } }` (mirroring
  `accounts-service.ts:28`) and either drop the per-row `collegeId` or say why it is returned on a
  college-scoped list. The §3.5.1 sparse index serves this query too (a sparse index answers
  `$ne: null` / `$exists: true` on the indexed field), so **no second index is needed** — consistent
  with §3.5.1.

### DL-R4-L3 — the sweep scan is unbounded, while its cited precedent bounds each tick

- **Evidence.** §3.5.1 leans on `proposal-expiry-worker.ts` as "the right precedent" and matches its
  claim and repeat schedule, but that worker bounds each sweep with `const BATCH_SIZE = 500`
  (`:32`) and `.limit(BATCH_SIZE)` on both scans (`:38`, `:75`). The spec's scan (`spec.md:388-392`)
  has no `.limit`.
- **Why it is only a LOW.** The collection is bounded by the number of provisioned people and the
  sweep runs hourly at `concurrency: 1`, so the exposure is small; but this is a *destructive*
  sweep, and an unbounded tick on a large backlog is a memory/latency risk the precedent
  deliberately avoided.
- **Remedy.** State a batch limit (e.g. `.limit(500)`) in §3.5.1's query.

### DL-R4-L4 — the regression test that guards the `DL-R3-H1` fix lives only in the resolution log, not in `spec.md`

- **Evidence.** `gate2-resolution.md` Part C says "The plan adds a test that the sweep executes a
  `deactivated`/`exiting` account whose field is set" (Part C, AR3-H1/DL-R3-H1 section) — but no AC
  in `spec.md` requires it. §3.5.1's H1 paragraph (`spec.md:383-387`) states the fix and does not
  name a test; Story 2's only sweep-adjacent test requirement is AC7's two-college isolation test
  (`spec.md:120-122`), which does not cover this.
- **Why it is only a LOW.** The fix itself is in the spec (§3.5.1) and is correct; only the guard is
  off-spec. But an unguarded query predicate is exactly what re-broke between revisions, so the test
  belongs in the spec where GATE 3 can see it.
- **Remedy.** Add the assertion to Story 2 (or §3.5.1): set `deletionRequestedAt` in the past on a
  `deactivated` **and** an `exiting` account and assert the sweep deletes both.

### DL-R4-L5 — the spec's document-control header still says "revision 3" and names only rounds 1–2

- **Evidence.** `spec.md:3` reads "Phase 3, **revision 3** (post-GATE-2 fix round)", and the
  `Validator reports:` line (`spec.md:7-8`) names only `gate2-{api-security,architecture,data-layer}.md`
  and `gate2-r2-*.md`. The body carries the revision-4 changes (the predicate removed at
  `spec.md:388-392`, the atomic claim at `:400-407`, the enum declarations at `:92-97`, the new
  endpoints at `:231-236`/`:512-519`), and `gate2-r3-*.md` exist on disk. The whole
  `.sdd/specs/011-account-deletion/` directory is untracked (`git status`: `??`), so there is no git
  record of which revision was validated either.
- **Why it matters.** All three round-4 re-validations certify "revision 4"; if the artifact is
  labelled revision 3, GATE 3 cannot tie the PASS to the version it approved.
- **Remedy.** Bump the header to revision 4 and extend the `Validator reports:` line with
  `gate2-r3-*.md` / `gate2-r4-*.md`.

---

## Severity count

| Severity | R1 (rev 1) | R2 (rev 2) | R3 (rev 3) | **R4 (rev 4)** |
|---|---|---|---|---|
| CRITICAL | 0 | 0 | 0 | **0** |
| HIGH | 2 | 0 | 1 | **0** |
| MEDIUM | 2 | 2 | 1 | **1** |
| LOW | 3 | 5 | 4 | **5** |

**GATE 2 bar (0 CRITICAL + 0 HIGH) is MET.** The single round-3 HIGH, `DL-R3-H1`, is genuinely
resolved — verified directly against `JuviAccount.ts:9-12` and the reachable transitions in
`auth-service.ts:60`, `authenticate-mobile.ts:45` and `provisioning-service.ts:206-214`, not taken
from the spec's own description. The remaining findings are one MEDIUM (a defeated-index/over-scan
shape that the claim still prevents from deleting wrongly) and five LOWs; none is fail-open and none
touches tenancy.

## Could not verify

- **The deletion service, the sweep worker, its registration, the two new endpoints and the admin
  list do not exist yet** — the feature folder holds only `.md` files — so this round, like rounds
  1–3, validates the spec against live code rather than the implementation.
- **Whether `verifyCredentials` preserves or drops `signIn`'s `deactivated` refusal**
  (`auth-service.ts:60-62`). Story 3 AC2 describes it only as read-only; the spec does not say. It
  does not change `DL-R4-M1` (the scan is status-free, so the answer only affects whether a
  `deactivated` account can *acquire* a request through the public path, not whether the sweep finds
  one).
- **The exact `$ne: null` vs `$exists: true` shape of Story 4 AC5's query**, since the spec
  specifies neither — this is what makes the third limb of `DL-R4-M1` conditional.

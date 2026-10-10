# GATE 2 — Data-Layer Validator, round 3 — 011 Juvi account deletion

**Verdict: FAIL — 0 CRITICAL · 1 HIGH · 1 MEDIUM · 4 LOW.**

Scope: verify spec **revision 3** (`spec.md`) against live code, focused on the round-3 changes —
the §3.5.1 recurring sweep, the §3.1 `NoticeRecipient` reset, and Story 2's audit guard — plus
§5, the deletion-set table, and multi-tenancy. All refs from the worktree `juvi-flutter-shell`
@ 2026-10-10. Inputs: `spec.md` (rev 3), `discovery.md`, `gate2-resolution.md` (Part B),
round-1 `gate2-data-layer.md`, round-2 `gate2-r2-data-layer.md`.

Revision 3 resolved the round-2 MEDIUMs (`M1` guard key, `M2` job disarm) — the guard key now
includes `action: 'delete'` and the ephemeral job is gone. **But the replacement mechanism, the
recurring sweep, carries a new HIGH of its own:** its own query predicate excludes accounts that
can legitimately be holding a pending deletion, so the deletion silently never executes — the exact
fail-open class (§3.5.1's stated purpose) that revision 3 was written to remove. The round-2
finding DL-R2-M1/DL-R2-M2 is **not** fully resolved in substance: the durable field became the
trigger, but the trigger still cannot see every row that carries it.

---

## HIGH

### DL-R3-H1 — the sweep's `status: { $in: ELIGIBLE_STATUSES }` filter drops pending deletions; the deletion silently never executes

- **Evidence — the prescribed query.** `spec.md:345-349`:
  `JuviAccount.find({ status: { $in: ELIGIBLE_STATUSES }, deletionRequestedAt: { $lte: … } })`.
  `ELIGIBLE_STATUSES` is `['onboarding', 'active']` (`backend/src/models/juvi/JuviAccount.ts:12`),
  and its own comment defines it as *"Statuses that may hold channel memberships and sign in"*
  (`JuviAccount.ts:11`) — a membership/sign-in predicate with no relationship to a pending deletion.
  The other three `ACCOUNT_STATUSES` values (`exiting`, `deactivated`, `alumni`) are excluded.
- **Evidence — such accounts are reachable at runtime.** `deactivateAccount` is a live,
  reachable transition: `backend/src/modules/juvi-app/admin/accounts-controller.ts:13` (admin
  action) and `backend/src/modules/admissions/workflow.handlers.ts:2008-2009` (admissions
  workflow) both call it; it sets `status = 'deactivated'` via `transitionAccount`
  (`provisioning-service.ts:206-213`, the `transitionAccount(account,'deactivated',…)` at `:209`).
  Nothing prevents that transition from running *during* the 7-day grace window, i.e. after a
  public request has set `deletionRequestedAt` on an `active` account.
- **Evidence — the public path can also record the request on a non-eligible account.** The public
  chain is `verifyCredentials`, "extracted from `signIn`" (Story 3 AC2, `spec.md:129-137`), and
  `signIn` resolves the account as `JuviAccount.findOne({ collegeId, userId: user._id })` with
  **no status predicate** (`backend/src/modules/juvi-app/accounts/auth-service.ts:52`) and only
  refuses `deactivated`/`!isActive` at `:60`. `exiting` accounts are live Juvi users —
  `authenticateMobile` rejects only `deactivated` (`middleware/authenticate-mobile.ts:45`).
- **Why it is a defect.** The spec states the field is the single source of truth
  (`spec.md:339`), and §3.5 promises "the deletion completes at the deadline whether or not anyone
  responds" (`spec.md:334-335`). With the status predicate the sweep's own `find` cannot see a row
  whose `deletionRequestedAt` is set but whose `status` is `deactivated`/`exiting`. The sweep is
  the *only* executor of a public request (the in-app path is immediate; Story 4 AC1 only
  *cancels*), so the deletion never runs and nothing retries — a permanent silent fail-open.
  §3.3 ("deactivation does not qualify" — `spec.md:305-308`) makes this sharper: a deactivated
  account still must be **deleted** to satisfy the policy, so excluding `deactivated` from the
  sweep directly contradicts §3.3. This is the same defect class three round-2 validators raised
  against the delayed job (`gate2-resolution.md:220-226`), reintroduced in the query rather than
  the trigger. The pending-deletion surface (`spec.md:372-376`) will show the request pending
  forever, so it is detectable — but detection is not execution.
- **Remedy.** Remove the status predicate from the sweep; execute on `deletionRequestedAt` alone
  (the field is authoritative, per §3.5.1's own premise), and let the per-row re-read of
  `deletionRequestedAt` — already required at `spec.md:351-352` — be the only guard. If a status
  filter is kept for any reason, it must be the full `ACCOUNT_STATUSES`, never `ELIGIBLE_STATUSES`.
  Add a test that sets `deletionRequestedAt` on a `deactivated` (and an `exiting`) account and
  asserts the sweep deletes it. Cost of the remedy: one predicate removed.

---

## MEDIUM

### DL-R3-M1 — Story 2 AC4's `action: 'request_deletion'` is not a member of the closed `AuditAction` union or the `AUDIT_ACTIONS` enum, and the spec never says to add it

- **Evidence.** Story 2 AC4 requires the request entry to write `action: 'request_deletion'`
  (`spec.md:85-86`). `AuditAction` (`backend/src/shared/types.ts`) is a closed union whose members
  are `create | update | delete | propose | accept | decline | withdraw | expire |
  waitlist_promote | vacate_request | vacate_approve | vacate_reject | approve | reject | submit |
  publish | archive | acknowledge | access_denied | ai_score_computed | ai_config_suggested |
  ai_config_applied | ai_nl_report_query` — **no `request_deletion`**. The Mongoose enum mirror
  `AUDIT_ACTIONS` (`backend/src/shared/audit.ts:27-37`, referenced by the schema at `:45`) is the
  same set, also without it. `createAuditLog(entry: AuditEntry)` types `action: AuditAction`
  (`shared/audit.ts:60-62`, `shared/types.ts` `AuditEntry`).
- **Why it is a defect.** The AC cannot be implemented as written: it fails `tsc` (the union) and,
  if forced, throws a Mongoose `ValidationError` on the enum at `audit.ts:45`. It is loud, not
  silent, so it is a MEDIUM rather than a HIGH — but the spec elsewhere goes out of its way to name
  every analogous enum addition (it dedicates a §5 bullet to `'account_deleted'` needing both
  `REVOKE_REASONS` *and* the `RevokeReason` union — `spec.md:472-473`), which makes the omission of
  the `AuditAction`/`AUDIT_ACTIONS` addition a real gap the plan will otherwise miss.
- **Remedy.** State in Story 2 AC4 / §5 that `'request_deletion'` is added to both the `AuditAction`
  union (`shared/types.ts`) and the `AUDIT_ACTIONS` enum array (`shared/audit.ts:27-37`), exactly as
  §5 already does for `'account_deleted'`.

---

## LOW

### DL-R3-L1 — the sweep query is a collection scan; no index serves `{ status, deletionRequestedAt }`

- **Evidence.** `JuviAccount`'s indexes are `{collegeId,personId}` (unique), `{collegeId,userId}`,
  `{collegeId,status,kind}`, `{collegeId,studentId}` (sparse), `{collegeId,facultyId}` (sparse)
  (`JuviAccount.ts:95-99`). Every index leads with `collegeId`, so none can serve a query whose
  leading predicate is `status`; `deletionRequestedAt` is unindexed. The sweep therefore scans the
  collection.
- **Why it is (only) a LOW.** The cited precedent has the same shape: `expireProposals` queries
  `{status:'proposed', expiresAt:{$lte}}` (`shared/jobs/proposal-expiry-worker.ts:35-38`) while
  `HostelAllocation`/`TransportAllocation` index only `{collegeId,status,expiresAt}`
  (`HostelAllocation.ts:114`, `TransportAllocation.ts:83`) — also a scan. The account collection is
  bounded by the number of provisioned people and the sweep is periodic, so the cost is small.
- **Remedy.** Optional: add a sparse index on `deletionRequestedAt` when the field is added, so the
  sweep touches only rows that carry it. Not required for correctness.

### DL-R3-L2 — the sweep's `find` has no `collegeId`, while Story 2 AC7 says "no query runs without it"

- **Evidence.** `spec.md:345-349` omits `collegeId`; Story 2 AC7 (`spec.md:104-105`) says "no query
  runs without it". The omission is legitimate — a system sweep must span colleges, and every
  *write* it drives is `collegeId`-scoped from the row (`spec.md:458-459` guarantees the order ends
  with a college-scoped delete). But the spec never names the sweep as AC7's deliberate exception,
  so AC7's isolation test ("seeds two colleges and asserts the other college's rows are untouched")
  reads as if it should also cover the scan.
- **Remedy.** One clause in §3.5.1 stating that the sweep `find` is the single intentional
  cross-tenant read (a system job), and that tenant isolation rests on the per-row writes.

### DL-R3-L3 — AC4's closing sentence contradicts its two bullets on `entityType`, weakening the stated trail separability

- **Evidence.** `spec.md:85-86` gives the request entry `entityType: 'JuviAccount'` and `spec.md:87-89`
  gives the execution entry `entityType: 'JuviAccount'`; the closing sentence (`spec.md:92-95`) then
  says `entityType` "marks the origin (`'JuviAccount'` vs `'JuviAccountPublicDeletion'`) so the two
  paths are separable in the trail." As written, both entries on the public path carry `'JuviAccount'`,
  so the two paths are *not* separable by `entityType`, and it is unspecified which value the public
  execution entry actually carries.
- **Why it is only a LOW.** Idempotency is unaffected: the guard is path-internal and
  action-discriminated (`{collegeId, entityType, entityId, action:'delete'}`), so whichever value the
  public path uses consistently, it still (a) never matches provisioning's `create` row and (b)
  matches its own prior execution entry. Only the trail's stated separability is wrong.
- **Remedy.** Fix AC4 so the bullets and the closing sentence agree on which `entityType` each of the
  four entries (in-app execution, public request, public execution; plus provisioning `create`) uses.

### DL-R3-L4 — `deletionRequestedAt` does not exist on the schema yet, and the schema is strict, so a missing field is a silent no-op

- **Evidence.** `JuviAccount` (`models/juvi/JuviAccount.ts:63-93`) has no `deletionRequestedAt` /
  `deletionRequestedVia`. §6 names the addition as a dependency (`spec.md:492-493`) and §3.5.3
  specifies the `GET /me` exposure, so the spec *does* cover it — this is carried forward, not new.
- **Why it is worth stating.** Mongoose's default `strict: true` (and this schema sets no `strict`
  override) means a `$set` on an undefined path is silently dropped, and a `find` on it never
  matches — the same silent-never-deletes failure as H1, if the schema addition is ever missed.
- **Remedy.** None beyond what §6 already says; the plan should treat the schema addition as
  load-bearing (round 2 reached the same conclusion) and the H1 test above doubles as its guard.

---

## What I checked and found clean

- **The deletion set is complete and correctly keyed.** A repo-wide sweep for
  `ref: 'JuviAccount'` across `backend/src` returns **exactly six** collections, matching §3.1's
  "exactly six collections carry `accountId`": `MobileSession.ts:35`, `ChannelMembership.ts:20`,
  `JuviProvisionedCredential.ts:25`, `NotificationDelivery.ts:47`, `JuviEvent.ts:20` (the five
  hard-deletes) and `NoticeRecipient.ts:62` (the reset). No seventh exists under any other spelling
  (`grep -iE 'accountid|juviAccountId|account_id'` over `backend/src/models` finds only these plus
  `placement/RecruiterActivityLog.recruiterAccountId`, which refs `RecruiterAccount`, a different
  model). §3.1's citation of `NotificationDelivery.ts:47` and `JuviEvent.ts:20` is line-accurate.
  Every key in the table has `collegeId` present on the model and an index that serves it
  (`{collegeId,accountId}` at `MobileSession.ts:54`, `ChannelMembership.ts:31`,
  `JuviProvisionedCredential.ts:42`, `NoticeRecipient.ts:79-80`; `collegeId` indexed on
  `NotificationDelivery.ts:23`/`JuviEvent.ts:19`).
- **`NoticeRecipient` reset — field names, uniqueness, default, and the capture-before-update are
  all verified.** The six reset fields exist exactly as named: `accountId` (`:62`, `default: null`),
  `receivedAt` (`:68`), `seenAt` (`:69`), `dismissedAt` (`:70`), `remindedAt` (`:71`), `ack` (`:72`);
  the remaining fields (`kind`, `labels`, `addedLater`, `ackRequired`, `deadline`, `archived`) are
  notice-level and correctly left alone. `{noticeId, personId}` is unique (`:78`). The prescribed
  capture sequence (`spec.md:237-238`) is the *same pattern the code already ships* in
  `onAccountActivated` (`recipient-service.ts:20-23`: `.select('_id noticeId addedLater').lean()`
  then `_id: { $in: rows.map((r) => r._id) }`) — so the `.lean()` `_id` shape typechecks under
  `noUncheckedIndexedAccess` (existing compiled code does it), and round 2's L3 is genuinely fixed.
- **The `$in`-on-`_id` narrowing does not conflict with `collegeId`.** The filter
  `{ collegeId, _id: { $in: […] }, accountId }` (`spec.md:240-244`) is a strict subset of the
  `{ collegeId, accountId }` read that produced the ids, so every `_id` is already college-scoped;
  adding both is redundant but correct, and it is what stops a concurrent fan-out from having its
  freshly-set `accountId` nulled (`spec.md:255-256`). The recount query (`spec.md:251-253`) is
  character-for-character `recipient-service.ts:30-31`, including the `status: { $ne: 'publishing' }`
  guard; the `!r.addedLater` snapshot filter (`spec.md:238`) matches `recipient-service.ts:28`. The
  reset is idempotent (a second pass matches nothing, since `accountId` is now null).
- **The audit guard genuinely fixes round-2 M1 and genuinely makes retry idempotent.**
  `createAuditLog` is a bare `AuditLog.create` with no dedupe (`shared/audit.ts:60-62`), so the
  existence check is the only mechanism. Provisioning writes `{entityType:'JuviAccount',
  entityId:String(account._id), action:'create'}` (`provisioning-service.ts:165-174`) — the row the
  round-2 guard collided with. Including `action: 'delete'` in the key
  (`{collegeId, entityType, entityId, action:'delete'}`, `spec.md:96-99`) makes the check
  discriminate it, and `'delete'` is a member of the enum (`audit.ts:28`) so the guard query is
  type- and schema-valid. The existence query is index-supported (`{entityType:1,entityId:1,
  timestamp:-1}` at `audit.ts:51`, `entityId:1` at `:42`). DL-R2-M1 is **resolved**.
- **`RevokeReason` is a closed union and the addition is required and sufficient.**
  `RevokeReason` is the closed union at `MobileSession.ts:4-6`; `REVOKE_REASONS` (`:8-10`) is the
  array the schema enum references (`:47`), so `'account_deleted'` must be added to both, and both
  changes are safe (Mongoose validates the enum on write; existing rows hold other members). It
  surfaces as a string: `getSessionState` returns it (`session-service.ts:190,195-198`) and
  `authenticate-mobile.ts:39` places it in the 401 body. The Dart side is an **open** string —
  `api_failure.dart:78` is `String? get reason => detail['reason'] as String?` — so round 2's L5's
  "could not verify" is now verified clean; no client enum needs widening.
- **Story 2 AC2's ordering and write-through are real and idempotent.** `revokeSession`
  (`session-service.ts:148-153`) matches `revokedAt: null`, `$set`s the reason, `$unset`s
  `pushToken`, and writes through the cache (`revoked:<reason>`, TTL `REVOKED_CACHE_SECONDS = 900`
  = `ACCESS_TOKEN_TTL_SECONDS`, `session-service.ts:8-11`). Run before `deleteMany`, a row-deleted
  session can no longer be served `'active'` from the 60 s active cache (`ACTIVE_CACHE_SECONDS = 60`,
  `:10`) — §5's stated invariant ("sessions deleted while the account still exists") is genuinely
  closed. Both steps retry safely. `juvi:acct-touch:<accountId>` is a real key
  (`authenticate-mobile.ts:86`). The only Juvi key left untouched, `juvi:sess-touch:<sid>`
  (`session-service.ts:207`), holds no account/session state.
- **Story 2 AC5/AC6 hold.** After deletion, `getSessionState` returns `missing` → 401
  (`authenticate-mobile.ts:38-39`); once the row is gone `JuviAccount.findById` cannot resolve
  (`:41-42`). A second call therefore returns a defined 401, not a 500.
- **Story 2 AC8 is correct.** `{collegeId, userId}` is non-unique (`JuviAccount.ts:96`, cited
  correctly); `{collegeId, personId}` is unique (`:95`) and provisioning resolves the `User` by
  `{collegeId, personId}` (`provisioning-service.ts:105`), so a credential maps to one account in
  practice while the key does not over-delete; child rows go by the collected `accountId`s, each
  carried on the child models.
- **§5's ordering is retry-safe step by step.** audit intent (existence-guarded → idempotent) →
  write-through revoke (idempotent) → notice reset + recount (idempotent) → child `deleteMany`s
  (idempotent by construction) → account row last (idempotent; and the account-last order is
  genuinely justified — the endpoint is self-scoped, `spec.md:460-464`). No step is irrecoverable.
  The one residual: a crash *after* the guarded intent entry and *before* any destructive step
  leaves a `delete` entry for a deletion that has not yet run; the sweep self-heals and the guard
  then suppresses a duplicate, so the trail converges — acceptable, and already reasoned in
  `gate2-resolution.md:276-277`.
- **No cascade hooks and no resurrection paths.** `JuviAccount` defines no `pre`/`post` middleware
  (`JuviAccount.ts:63-101`; the only `schema.index` calls are `:95-99`), so the explicit set is the
  whole set; `JuviAccount.create` is reachable only from provisioning (`provisioning-service.ts:135`).
- **`AckRecord` and the ERP-side `userId` collections are correctly outside the footprint.** As
  round 2 found — keyed to the retained `Student` / `Person` / `User`, not the account.
- **The disclosed residues are accurately described.** `Channel.memberCount` staleness and
  `OutboxEvent.payload` (`Mixed`, 30-day TTL) match round 2's findings verbatim.

## Could not verify

- **The deletion service, the sweep worker and its registration do not exist yet** — the feature
  folder holds only `.md` files — so this validates the spec against live code, as rounds 1-2 did.
  Whether the sweep is actually registered from `server.ts` (spec §6) is unverifiable now.
- **Whether `verifyCredentials` will preserve or drop `signIn`'s status handling.** Story 3 AC2
  describes it only as "read-only, creates no session, returns no tokens"; the spec does not say
  whether the `account.status === 'deactivated'` refusal at `auth-service.ts:60` is carried into it.
  H1 does not depend on the answer (an account can leave the eligible set *after* the request), but
  it widens or narrows H1's "request on a non-eligible account" branch.
- **The pending-deletion admin surface** (required by §3.5.1, `spec.md:372-376`) is unspecified in
  shape, so whether it can show "overdue" (as opposed to "pending forever") is unknown. This does
  not change H1's severity — the deletion still does not execute.

## Severity count

| Severity | R1 (rev 1) | R2 (rev 2) | **R3 (rev 3)** |
|---|---|---|---|
| CRITICAL | 0 | 0 | **0** |
| HIGH | 2 | 0 | **1** |
| MEDIUM | 2 | 2 | **1** |
| LOW | 3 | 5 | **4** |

**GATE 2 bar (0 CRITICAL + 0 HIGH) is NOT met.** Round-2 MEDIUMs M1 and M2 are resolved (guard key;
job removed); the two round-2 `accountId`-set HIGHs remain resolved. The single blocking finding is
DL-R3-H1, a new defect introduced by revision 3's own §3.5.1 sweep predicate; its remedy is to
remove that predicate, which also brings the query in line with §3.5.1's stated premise that the
field is authoritative.

# GATE 2 — Data-Layer Validator — 011 Juvi account deletion

Scope: verify the spec's deletion set against the real schema. All refs from the worktree
`juvi-flutter-shell` @ 2026-10-10. Inputs: `spec.md`, `discovery.md`.

**Verdict:** 0 CRITICAL · 2 HIGH · 2 MEDIUM · 3 LOW. Two Juvi-mobile collections that carry a
required `accountId` are absent from the deletion set (**HIGH**). The ordering requirement in
§5 is defensible for retryability but protects the wrong invariant (**MEDIUM**).

---

## HIGH

### H1 — `NotificationDelivery` is omitted from the deletion set (dangling `accountId`, notice open/ack state survives)

- **Evidence:** `backend/src/models/juvi/NotificationDelivery.ts:47`
  `accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true }`.
  Spec §3.1 (spec.md:85-86) hard-deletes only `JuviAccount`, `MobileSession`, `ChannelMembership`,
  `NoticeRecipient`, `JuviProvisionedCredential` — `NotificationDelivery` is not listed.
  It is one row per (person, notification) and is written per account:
  `backend/src/modules/juvi-app/notifications/expand-consumer.ts:108,222`.
- **Why it is a defect:** These rows are a per-account Juvi footprint — which notices/class-changes
  the account was targeted for, and `openedAt`/`status`/`reason` (i.e. notice open + ack state,
  `NotificationDelivery.ts:4,24-42`). After deletion they survive with an `accountId` pointing at a
  row that no longer exists. The row is never cascade-deleted and the account can never be called
  again to clean it (the endpoint is self-scoped and its JWT is dead). `reach-service.ts:228,273`
  and the sender (`sender.ts:104,120-126`) keep treating the leftover rows as live: the sender
  claims any still-`scheduled` row, finds no `MobileSession` for the account, and settles it
  `suppressed/no_device` — so no push leaks, but the row lingers permanently and the deletion is
  incomplete (a Google Play "delete the user's data" claim would be false).
- **Remedy:** add `NotificationDelivery.deleteMany({ collegeId, accountId })` to the deletion
  sequence. It is naturally idempotent and has `collegeId`, so it scopes cleanly.

### H2 — `JuviEvent` (server-side product analytics) is omitted, contradicting the spec's own client wipe

- **Evidence:** `backend/src/models/juvi/JuviEvent.ts:20`
  `accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true }`.
  Events are ingested per account at
  `backend/src/modules/juvi-app/notifications/events-service.ts:51-54`, and `EVENT_NAMES`
  (`events-service.ts:11-20`) includes `notice.seen`, `notice.acknowledged`, `notice.dismissed`,
  `app.opened`, `notification.opened`. Spec AC3 (Story 1, spec.md:36-37) explicitly wipes the local
  drift `analytics_events` table; §3.1 does not list `JuviEvent`.
- **Why it is a defect:** the identical event stream survives server-side under `accountId`, so the
  app tells the user analytics are gone while the backend retains them — an internal contradiction
  in the feature's own disclosure, plus the same dangling-`accountId` problem as H1. (Props are
  ids/enums only and rows TTL out after 400 days, so there is no free-text PII exposure — hence HIGH,
  not CRITICAL.)
- **Remedy:** `JuviEvent.deleteMany({ collegeId, accountId })` in the same sequence.

---

## MEDIUM

### M1 — Session revocation is not durable: the Redis `juvi:sess:*` active-cache is never invalidated, and §5's stated ordering protects the wrong invariant

- **Evidence:** `authenticate-mobile.ts:38-42` — a request is authorised only if
  `getSessionState(sid) === 'active'` **and** `JuviAccount.findById(claims.aid)` resolves.
  `session-service.ts:184-202` reads the Redis key `juvi:sess:<sid>` first and short-circuits to
  `'active'` **without touching Mongo**; the key is written with `ACTIVE_CACHE_SECONDS = 60`
  (`session-service.ts:10,52,84,121,200`). Nothing in the repo deletes that key.
- **Why it is a defect:** Spec §5 (spec.md:136-138) requires "sessions deleted **before** the account
  row" so that "a crash cannot leave sessions alive but the account gone." That invariant is
  backwards: sessions-alive + account-gone is *already* a 401 (the account lookup at
  `authenticate-mobile.ts:41-42` fails), so it is harmless. The dangerous half-state is what this
  ordering can actually create — **sessions deleted, account still present** (crash between the
  session step and the final account step): a device whose session key is still cached `active`
  passes `getSessionState` from Redis and auth succeeds because the account row is still there, for
  up to the 60 s TTL, while the user has no refresh token left. So "sessions lose access immediately"
  (AC2) is not guaranteed across a crash, and the stated rationale does not hold.
- **Note on ordering:** deleting the account row **last** is still the right choice for a different
  reason — the endpoint is self-scoped to the caller, so if the account row went first the caller
  could never authenticate again to retry the remaining `deleteMany` steps, stranding them forever.
  §5's order is correct; only its justification and the missing cache step are wrong.
- **Remedy:** after the `MobileSession.deleteMany`, the deletion service must invalidate the session
  cache for each deleted sid — e.g. `redis.del('juvi:sess:<sid>')` for every session id collected
  before the delete (or write `revoked:...`, as `revokeSession` does at `session-service.ts:152`).
  Also `redis.del('juvi:acct-touch:<accountId>')` for tidiness. Then a crash mid-sequence still
  denies within the normal TTL and the account-last order stays retryable.

### M2 — The deletion must NOT reuse `deactivateAccount`; it mutates a retained record (`User.isActive`) and only soft-revokes sessions

- **Evidence:** `backend/src/modules/juvi-app/accounts/provisioning-service.ts:206-213` —
  `deactivateAccount` does `User.updateOne({ _id: account.userId }, { $set: { isActive: false } })`,
  `revokeOtherSessions(accountId, null, 'deactivated')` (which only sets `revokedAt` + `$unset`
  `pushToken`, `session-service.ts:148-153`), and `ChannelMembership.deleteMany`.
  The discovery (discovery.md:80-88) points the implementer at `session-service`'s revocation
  primitives as "reusable".
- **Why it is a defect:** AC3 (spec.md:50-52) requires the `User` to survive **with unchanged
  `isActive`**, and AC2 requires sessions to be **hard-deleted**. Wiring `/me/account` to
  `deactivateAccount` (the obvious existing primitive) would flip `User.isActive = false` — breaking
  the shared ERP web login, exactly the failure spec §1 warns against — and would leave session rows
  behind, violating AC2. This is a live hazard because the primitive already exists and looks
  reusable.
- **Remedy:** the deletion is a distinct path: hard-delete (`MobileSession.deleteMany`) rather than
  `revokeOtherSessions`, and never touch `User`. Add a test asserting `User.isActive` and the
  password hash are byte-identical after deletion (spec AC3).

---

## LOW

### L1 — `createAuditLog` is not idempotent; a retry after a partial crash duplicates the trail

- **Evidence:** `backend/src/shared/audit.ts:60-62` — `createAuditLog` always inserts a new row.
  Spec §5 (spec.md:138) requires "each step idempotent"; the account-last order makes the whole
  operation retryable up to the final step (M1), so a crash *before* the account delete is re-run by
  the same caller.
- **Why it is a defect:** a retry inserts a second `JuviAccount`/`delete` audit entry. Not a
  security issue; trail pollution only.
- **Remedy:** either write the audit entry as the last step (after the account row is gone, so it
  runs at most once) or give it a deterministic dedupe key (e.g. `entityType + entityId + a fixed
  marker` guarded by the existing `{entityType, entityId, timestamp}` index), and document that a
  crash before the audit write leaves no entry.

### L2 — `AckRecord` / `JuviNoticeCard` ack state is keyed to `Student`, so it survives; check the disclosure wording

- **Evidence:** `backend/src/models/juvi/AckRecord.ts:6,14` — `studentId` ref `Student`, not
  `accountId`; written/read in `backend/src/modules/academics/juvi-service.ts:292-297,364`.
- **Why it matters:** because it is keyed to the retained `Student`, it is neither orphaned nor a
  candidate for `accountId` deletion — this is correct under "retain ERP records". But it *is* Juvi
  notice-acknowledgement state, so if AC1's disclosure ("notice read/acknowledged state" is deleted,
  spec.md:31-33) is read broadly it is inaccurate. It should be read as the mobile `NoticeRecipient`
  state only, and the privacy-policy copy should not over-promise.
- **Remedy:** confirm the policy text scopes "notice read/acknowledged state" to the mobile app's
  notices; no code change (deleting these would break the retained `Student` record set).

### L3 — Hard-deleting sessions discards the `previousRefreshTokenHash` replay anchor

- **Evidence:** `MobileSession.ts:44,56` — the sparse `previousRefreshTokenHash` index backs the
  token-replay/theft detection at `session-service.ts:125-130`.
- **Why it matters (and why it is only LOW):** if a refresh token had been stolen and rotated out,
  the victim's deletion removes the row that would have flagged `token_reuse`. Every subsequent
  presentation of that token hits branch (d) "nobody knows this token" and is refused with 401
  (`session-service.ts:144-145`) — so the outcome is **fail-closed**, not a bypass. Only the theft
  *signal* is lost, and the audit log can carry it.
- **Remedy:** none required for safety; optionally record an audit note that sessions were purged.

---

## Checked and found CLEAN

- **Deletion set completeness w.r.t. `accountId`.** A repo-wide grep shows exactly six collections
  carry `accountId`: `MobileSession`, `ChannelMembership`, `NoticeRecipient`,
  `JuviProvisionedCredential` (all in the set) plus `NotificationDelivery` and `JuviEvent` (H1/H2).
  No other model in `backend/src/models/` references `JuviAccount` (`grep -l` returns only
  `models/juvi/*` + `models/index.ts`).
- **Every account-scoped collection has `collegeId`,** so a `collegeId`-scoped `deleteMany` is
  sufficient; none is keyed by `accountId`/`personId` alone. (`MobileSession:34`,
  `ChannelMembership:18`, `NoticeRecipient:59`, `JuviProvisionedCredential:23`,
  `NotificationDelivery:46`, `JuviEvent:19`.)
- **Audit log survives.** `AuditLog.entityId` is a `String` with no `ref` (`shared/audit.ts:42`);
  deleting the entity it names leaves the trail intact. AC4 is satisfiable; `'delete'` is a member of
  the `AUDIT_ACTIONS` enum (`audit.ts:27-37`).
- **No cascade/remove hooks on `JuviAccount`.** The schema (`JuviAccount.ts:63-101`) defines no
  `pre/post` middleware; nothing auto-deletes satellites, so the explicit set is the whole set.
- **Hard-delete vs. the unique indexes.** `refreshTokenHash` unique (`MobileSession.ts:53`) and
  `pushToken` unique-partial (`:59`) are insert/update constraints; `deleteMany` cannot violate them.
  Deleting the holder of a push token frees it for reuse — no collision.
- **`previousRefreshTokenHash` and deletion:** see L3 — fail-closed, no bypass.
- **`NoticeRecipient` deletion key.** `accountId` is nullable (`NoticeRecipient.ts:62`) for people not
  yet on Juvi, but `onAccountActivated` / `backfillAddedLater` fill it for every eligible account
  (`notices/recipient-service.ts:19-25,37-54`, `notices/consumers.ts:72-83`). For an *authenticated*
  account (status onboarding/active) all of the person's rows carry the `accountId`, so deleting by
  `{collegeId, accountId}` is complete. The retained `accountId: null` rows belong to people who are
  not this account.
- **`Person` / `User` / `Student` / `Faculty` / `Staff` untouched.** No field on those models points
  at `JuviAccount`; the deletion set does not name them; AC3 is achievable.
- **No reconciler resurrection.** `JuviAccount.create` occurs in exactly one non-test place
  (`provisioning-service.ts:135`), reached only from an admin provisioning run. The cancellation
  workflow only *deactivates* (`admissions/workflow.handlers.ts:2004`); `spaces/reconcile-service.ts`
  writes only `lastReconciledAt`/memberships. Story 4 AC1/AC2 hold.
- **Transactions genuinely unavailable.** The unit/e2e harness uses a standalone
  `MongoMemoryServer` (`src/__tests__/helpers/mongoMemory.ts:24`, `src/__e2e__/setup/global-setup.ts:48`),
  and two production services already document the workaround
  (`modules/people/student-import-service.ts:10`, `modules/finance/programme-transfer-service.ts:18`).
  The spec's "no multi-document transactions; use ordered, idempotent `deleteMany`" is correct.
- **Idempotency of each step.** Every proposed step is a `deleteMany`, which is idempotent by
  construction; only the audit insert is not (L1).
- **Out-of-scope collections keyed by `userId`/`personId` → retained owner.** `JuviConversation`
  (`userId` ref Person), `JuviMessage`, `JuviFeedback` (`userId` ref Person), `AgentAction`,
  `AgentConversation`, `SituationDismissal` (`userId` ref User), `JuviProvisioningRun.errors[].personId`
  — these belong to the ERP-side Juvi AI module / shared AI stack, keyed to a retained `Person`/`User`,
  not to the mobile account. They are neither orphaned nor part of the mobile footprint.
- **College-scoped config with no account key:** `Channel`, `ChannelTemplate`, `JuviInsight`,
  `JuviKnowledgeBase`, `JuviNoticeCard`, `JuviPersonaConfig`, `JuviUsageMetric`, `LLMUsageSnapshot`,
  `Notice` — no `accountId`/`personId` ownership; unaffected.

## Could not verify

- Whether the *implemented* deletion service (not yet written — only `spec.md` exists in
  `.sdd/specs/011-account-deletion/`) keys `NoticeRecipient` by `accountId` or `personId`; this report
  validates the spec/design, and the analysis assumes the accountId key implied by §3.1.
- Whether the privacy-policy draft (an unbuilt deliverable, spec §3.4) already over-promises on
  "notice read/acknowledged state" (L2); no copy exists in-repo to check.

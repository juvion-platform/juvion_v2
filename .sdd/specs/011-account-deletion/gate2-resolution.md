# GATE 2 resolution — 011 Juvi account deletion

Phase 4 close-out, both rounds. GATE 2 requires 0 CRITICAL + 0 HIGH.

**Round 1** validated `spec.md` revision 1 and failed: 0 CRITICAL, 8 HIGH. Revision 2 resolved
them (Part A below).

**Round 2** re-validated revision 2 (three fresh validators, not a self-certification) and found
that **two of revision 2's own remedies were themselves defective**: architecture FAIL with 2 NEW
HIGH, both inside the §3.5 deferral mechanism I had just written. Revision 3 resolves them
(Part B below). This is the reason re-validation is not optional — the round-1 remedies were
independently checked and two of them did not survive.

| Round | Report | CRITICAL | HIGH | Verdict |
|---|---|---|---|---|
| 1 | `gate2-api-security.md` (rev 1) | 0 | 3 | FAIL |
| 1 | `gate2-architecture.md` (rev 1) | 0 | 3 | FAIL |
| 1 | `gate2-data-layer.md` (rev 1) | 0 | 2 | FAIL |
| 2 | `gate2-r2-api-security.md` (rev 2) | 0 | 0 | **PASS** |
| 2 | `gate2-r2-data-layer.md` (rev 2) | 0 | 0 | **PASS** |
| 2 | `gate2-r2-architecture.md` (rev 2) | 0 | 2 | **FAIL** |

Every HIGH is resolved below by a change to the spec. Findings that turned out to point at the
same root cause are resolved together; where two findings' remedies conflicted, the conflict and
the ruling are recorded.

---

# Part A — round 1 (revision 1 → revision 2)

## HIGH findings

### AS-H1 — the public path reusing sign-in's cooldown is an account-lockout weapon

**Was:** Story 3 AC3 said "rate-limited with the same shape as `signInLimiter`", and AC2 pointed at
reusing sign-in's verification — from which the shared per-identifier cooldown
(`cooldownKey(collegeId, identifier)`, read *before* any credential check) comes along. Five bogus
requests from anyone who knows a roll number would lock the victim out of the **app** for ten
minutes, repeatable indefinitely.

**Now:** new **Story 3 AC6** — the public path must **not** touch the sign-in cooldown; it gets its
own namespace (`juvi:deletion-verify:<collegeId>:<hash-of-identifier>`) and a **non-blocking**
budget (count + back off / tarpit, never hard-block), so this endpoint can never deny sign-in.
§6 now says to read `cooldown.ts` to know what *not* to reuse.

### AS-H2 — the public path deletes irreversibly on password possession alone, silently

**Was:** Story 3 AC4 performed the same **immediate** deletion as the authenticated path, with no
second factor, no out-of-band confirmation, no grace period and no notification — and the password
is the shared ERP credential, so a stuffed password became destructive. There was no notification
point in the design at all: the account was gone before anything could be sent.

**Now:** the design change in **§3.5** — the public path is **deferred, not immediate**. The
request is verified, recorded on the account (`deletionRequestedAt`, `deletionRequestedVia:
'public_web'`), the owner is **notified** (§3.5.1) and can **cancel** (Story 4 AC1), and a delayed
job executes the same deletion service after `DELETION_GRACE_DAYS = 7` — automatically, whether or
not anyone responds. The in-app path stays immediate (possession is proven by a live session plus
the typed phrase). This is the validator's own recommended remedy ("an in-app confirmation prompt
for the account's live sessions, or an admin-visible pending-deletion request") implemented with
the existing `QueueManager`/`proposal-expiry-worker` pattern rather than new machinery.

> **[Superseded in round 2 — see Part B.]** The *intent* above (deferred + notified + cancellable)
> stands, but the *mechanism* named here — "a delayed job" via `QueueManager` — was itself found
> defective by round 2 (AR2-H1, AR2-H2) and replaced with a recurring DB sweep over
> `deletionRequestedAt`. The `proposal-expiry-worker` citation was wrong: that worker is a
> recurring sweep, not a delayed job. Read §3.5.1 of the current spec, not this paragraph, for the
> mechanism.

**Scope note:** this is the one deliberate scope increase in the feature, flagged as such in §3.5.

### AS-H3 / DL-M2 — `deactivateAccount()` must not be reused

**Was:** both reports independently flagged that the nearest existing helper
(`provisioning-service.ts:206-214`) sets `User.isActive = false` — breaking the shared ERP login,
the failure §1 warns against — and only soft-revokes sessions, violating Story 2 AC2. Rev 1 never
named it as forbidden, and the discovery pointed the implementer into that same module for
`revokeSession`.

**Now:** **§3.3** states it in the negative — `deactivateAccount` MUST NOT be reused; the same
argument that keeps `ACCOUNT_STATUSES` unnarrowed extends to the helper. Story 2 AC3's ERP-login
assertion is required on **both** paths (its AC now says so explicitly).

### AR-H1 — hard-deleting `NoticeRecipient` destroys the audience snapshot and reach/ack audit

**Was:** §3.1 hard-deleted `NoticeRecipient` rows for the account. The row is the notice's
*audience snapshot*, keyed `{noticeId, personId}` — one per **person**, not per account, and
created at publish for every audience member whether or not they are on Juvi (`accountId` is
`default: null`). Deleting by `accountId` permanently lowered `Notice.counts.onJuvi`, destroyed
the audience record for a retained notice, left the surviving `'NoticeAcknowledgement'` `AuditLog`
entry dangling, and made a re-provisioned person unrestorable.

**Now:** **§3.1** reclassifies `NoticeRecipient` from *hard-deleted* to **reset**: `$set:
{ accountId: null, receivedAt: null, seenAt: null, dismissedAt: null, remindedAt: null, ack: null }`,
then recount the affected notices' cached counter with exactly the query activation already uses
(`recipient-service.ts:30-31`). The person's Juvi-owned state is cleared — which is what Story 1
AC1 actually promises — while the institutional row survives, and the reach board, which buckets
live from these rows, correctly shows the person as `not_on_juvi`.

`archived`, `deadline`, `ackRequired`, `kind`, `labels` and `addedLater` are deliberately **not**
reset: they describe the notice, not Juvi membership.

**Subsumes AS-M3.** That finding asked the spec to *pick* a key (`accountId` misses the `null`
rows; `personId` mutates the reach denominators) and disclose the consequence. Choosing "reset"
removes the dilemma — no rows are deleted, so no key is chosen and no denominator moves for the
wrong reason. AS-M3 needs no separate fix.

### AR-H2 / AS-M2 — Story 3's verification path misstated its reuse

**Was:** Story 3 AC2 named `identifier-resolver` + **`credential-store.ts`**, and §6 added
`auth-service.signIn`. `credential-store` is the AES vault for issued temporary passwords and has
no verification function at all. `signIn` **mints a `MobileSession` and returns tokens**, and
requires a `collegeId` ObjectId plus a full `DeviceInfo` payload the web page cannot supply — so a
public, unauthenticated endpoint would have become a token-minting surface. An institution *code*
is also not a `collegeId`, and rev 1 omitted the resolution step entirely.

**Now:** **Story 3 AC2** and **§6** name the correct chain:
`config/institution-config.lookupInstitutionByCode` (code → `collegeId`) →
`identifier-resolver.resolveIdentifierToUser` → `bcrypt.compare` against `User.password`, with the
shared logic **extracted from `signIn` as a read-only `verifyCredentials(collegeId, identifier,
password): Promise<{ user, account }>` that creates no session and returns no tokens**. AC2 states
in terms that the public path must never create a `MobileSession` and that `credential-store` is not
involved (AS-M2's requirement).

### AR-H3 — the backend-served page was recommended over a static asset, on a mischaracterization

**Was:** §3.2 recommended `GET /account-deletion` served by the backend, and rejected a static page
by treating it as if it were a React SPA route. The two have different audiences and surfaces: the
static asset has no new attack surface (nginx already serves the SPA's unauthenticated HTML/JS).
The recommended option would be the first HTML surface on a JSON API with no view engine, no
`res.sendFile`, and a global `helmet()` whose `script-src 'self'` / `script-src-attr 'none'` block
inline script — whose tempting fix (loosening helmet) would weaken the CSP for every ERP response.

**Now:** **§3.2** revised — the page is `admin-portal/public/account-deletion.html`, copied by vite
into `dist/` and published to the web root, served by nginx at `/account-deletion.html` outside
React Router. The **verification endpoint stays on the API** as a public JSON route in the
`configRouter` style. Story 3 AC1 carries a plan-time check on the nginx `try_files` order, and AC9
records that the page needs no inline script under the default CSP.

### AR-M1 — the "existing public `GET /institutions/:code` lookup" is not at the top level

**Was:** §3.2 and the discovery both placed it "outside the authenticated `/api` surface", making a
top-level route look precedented. It is actually `configRouter.get('/institutions/:code')`
(`config/routes.ts:7`), mounted under `/api/juvi-app/v1`.

**Now:** corrected in **§3.2**, which also states the novelty of the new surface plainly.

### DL-H1 — `NotificationDelivery` omitted from the deletion set

**Was:** the model carries a required `accountId: { ref: 'JuviAccount', required: true }`
(`NotificationDelivery.ts:47`) and holds per-account delivery state. Left behind, it points at a
row that no longer exists, cannot be cleaned by any later call, and the sender keeps treating the
rows as live.

**Now:** added to the hard-delete table in **§3.1**, keyed `{collegeId, accountId}`.

### DL-H2 — `JuviEvent` omitted, contradicting the spec's own client wipe

**Was:** the same required `accountId` (`JuviEvent.ts:20`), and `EVENT_NAMES` includes
`notice.seen` / `notice.acknowledged`. Story 1 AC3 wipes the local drift `analytics_events` table
while rev 1 retained the identical server-side stream — a contradiction in the feature's own
disclosure.

**Now:** added to the hard-delete table in **§3.1**, keyed `{collegeId, accountId}`. The two
findings were one root cause: the rev-1 deletion set was the discovery's candidate list, which a
repo-wide `accountId` sweep shows was short by exactly these two.

---

## MEDIUM and LOW findings folded in

Several were entailed by the HIGH remedies; folded in rather than deferred so they do not resurface
at GATE 3.

| Finding | Resolution |
|---|---|
| AS-M1 / DL-M1 — `deleteMany` cannot write through the 60 s `juvi:sess:<sid>` cache; no `RevokeReason` for deletion | Story 2 AC2: `revokeSession(sid, 'account_deleted')` **then** `deleteMany`; `'account_deleted'` added to `REVOKE_REASONS`; `juvi:acct-touch:<accountId>` deleted. §5 restates the invariant that ordering actually protects. |
| AS-M4 — the app-uploaded profile photo survives | §3.1 and §3.4: the photo *is* the person's ERP photo (deterministic key, `people/photo-service.ts:181-184`), so it is retained as part of the `Person` record — now disclosed rather than unmentioned. |
| AS-M5 — audit actor is free-form PII; the audit write is ordered after the destructive deletes | Story 2 AC4: actor is the account id, never the raw identifier; `entityType` marks the origin; entry written **first** as an intent record. |
| AS-M6 — `deleteMany` is outside the 010 scope-plugin backstop, so AC7 rests on discipline | Story 2 AC7: one `deleteScoped` helper, plus a two-college isolation test per model. Adding `deleteMany` to the plugin is explicitly out of scope (§4). |
| AS-M7 — a backend HTML page collides with helmet's CSP and the ERP error envelope | Subsumed by AR-H3 (no backend HTML). The JSON endpoint stays inside `/api/juvi-app/v1` for the mobile envelope (Story 3 AC7). |
| AS-M8 — `spacesRouter`'s router-wide `authenticateMobile` 401s any public route appended after it | Story 3 AC7: mount in `v1Router` **before** `spacesRouter`, with the receipts-path ordering comment; do not touch `spacesRouter`; test without an `Authorization` header. |
| AS-M9 — the only abuse control is env-gated, in-memory and IP-keyed | Story 3 AC3: an exported `deletionVerifyLimiter` with a lower max than sign-in, its 429 asserted in a unit test that constructs the limiter directly (the Playwright job sets `E2E_TESTING=1`, which disables limiters). |
| AS-M10 — other signed-in devices keep a local copy | Story 1 AC6: a `401 SESSION_INVALIDATED` triggers the same local wipe; Story 1 AC3 lists the drift `me` document (cleared by `_wipe()`'s `kvCache`). |
| AR-M2 — Story 1 AC3's wipe list does not match the real primitives | Story 1 AC3 rewritten: `_wipe()` (covering session, `kvCache` incl. `me`, `pending_actions`, `analytics_events`) **plus** `ReceiptQueue.clear()` (a new method), `clearPendingLink()`, and removal of `juvi.last_account`. AC4 adds that the delete path must not call `signOut()`/`unregister()`. |
| AR-M3 — §5 sanctioned skipping the OpenAPI contract via an inapplicable workaround | §3.6: `deleteAccount` must be declared in `document.ts` and the client regenerated; R61 covers only nullable-object *response* fields, and a 204 delete has no body. |
| AR-M4 — the per-identifier cooldown is omitted | Folded into Story 3 AC6 (same fix as AS-H1). |
| AR-L1 — AC4's audit description omitted required `createAuditLog` fields | Story 2 AC4 now names the call and its fields. |
| AR-L2 / DL-L2 — the public verification endpoint was unspecified; `AckRecord` survives | Story 3 AC7 names the path and mount point. `AckRecord` is keyed to the retained `Student`, so it is correctly out of the deletion set; Story 1 AC1 scopes the disclosure to the mobile state and §3.4 requires the policy copy not to over-promise. |
| DL-L1 — `createAuditLog` is not idempotent | Story 2 AC4: existence-guarded intent record. |
| DL-L3 — hard-deleting sessions discards the `previousRefreshTokenHash` replay anchor | No change needed: every later presentation of a rotated token hits the "nobody knows this token" branch and is refused 401 (`session-service.ts:144-145`), so the outcome is fail-closed; only the theft *signal* is lost, and the audit trail carries the purge. |
| AS-L1 — institution existence/pause state is distinguishable | Story 3 AC5: collapse the pre-credential branches to one generic failure. |
| AS-L2 — cross-site submission of the public form is not blocked | Story 3 AC8: require `Sec-Fetch-Site: same-origin` (or an `Origin`/`Referer` check). |
| AS-L3 — `JuviAccount` has no unique `{collegeId, userId}` index, so the deletion inherits an arbitrary-row pick | Story 2 AC8: remove account row(s) by `{collegeId, userId}`, child rows by the collected account ids. |

## Decisions taken in this round (rulings)

1. **Public-path deletion is deferred by a 7-day grace period** (§3.5). Rationale: it is the only
   remedy that removes the *destructive* half of AS-H2 without an e-mail channel, and it reuses the
   existing delayed-job pattern. Cost if wrong: the feature is larger than rev 1 and the Play
   Data-safety answer must state the completion period. Reversible by deleting §3.5 and making the
   public path immediate-with-notification.
2. **`NoticeRecipient` is reset, not deleted** (AR-H1), which also resolves AS-M3 without choosing
   a key. Cost if wrong: `Notice.counts.onJuvi` semantics change slightly (recounted rather than
   decremented-by-deletion), and the reach board shows the person as `not_on_juvi`.
3. **The audit entry goes first, existence-guarded.** AS-M5 wanted it first (a throw after the
   destructive steps would lose the record); DL-L1 wanted it last (a retry would duplicate it).
   Guarded-first satisfies both: it runs before anything destructive, and a retry finds it and
   skips. Cost if wrong: one extra existence query per deletion.
4. **`deactivateAccount` is named forbidden explicitly** rather than left to AC3's test. Two
   independent reports flagged it as the plausible wrong turn.

## GATE 2 status after round 1

Revision 2: 0 CRITICAL, 0 HIGH on paper — but **not yet re-validated**. Round 2 then failed it,
so this line is superseded by Part B.

---

# Part B — round 2 (revision 2 → revision 3)

## The convergence

Three validators, three independent derivations, **one root cause**: the trigger for the deferred
public-path deletion was an ephemeral Redis job while the durable `deletionRequestedAt` field was
never re-read.

| Report | Finding | Severity |
|---|---|---|
| architecture | AR2-H2 — the ephemeral job is the sole trigger; a lost job means the deletion silently never runs, and cancellation-without-disarm still deletes | HIGH |
| data-layer | M2 — same: the durable field is decorative, so the mechanism disagrees with the record | MEDIUM |
| api-security | M1 — same, plus: fail-**open** (a lost job means the deletion never happens, while the user believes it did) | MEDIUM |

When three validators who each read only the spec arrive at the same defect from different
directions, the finding is not a difference of opinion. It is the design.

## AR2-H1 — the job id `'juvi-account-deletion:<accountId>'` is rejected by BullMQ

**Was:** §3.5 specified that id, with the colon separator. BullMQ throws on a custom job id that
contains a colon — verified in the installed package at
`node_modules/bullmq/dist/cjs/classes/job.js:1073-1076`. The job would never have been enqueued,
and because `removeOnFail` was set, nothing would have retried it either.

**Now:** **the job is gone entirely** (below), so the id is gone with it. The repo's own
`_`-separated workaround (`lead-scoring/enqueue.ts:32-35`) is recorded in §3.5.1 as the reason to
avoid this class of id, but no id is constructed by this feature.

## AR2-H2 / DL-R2-M2 / AS-R2-M1 — the trigger must be a recurring DB sweep over the durable field

**Was:** §3.5 used a delayed BullMQ job (with `jobId` above) as the *sole* trigger, and cited
`shared/jobs/proposal-expiry-worker.ts` as precedent. The citation was wrong in the way that
matters: that worker is a **recurring database sweep** over due rows
(`:35-46`, `:126-130`) — the architecturally *opposite* mechanism from a one-shot delayed job.
Consequences of the job-as-trigger design:

- a flushed queue, `DISABLE_BACKGROUND_JOBS`, or a swallowed `registerQueue` failure
  (`server.ts:20-45`) means the deletion silently never runs — fail-**open**, and the requester
  has no way to know;
- cancellation was "remove the job", so a cancellation that failed to remove it still deleted —
  the durable field was decorative rather than authoritative.

**Now:** **§3.5.1 rewritten.** The trigger is a **recurring sweep** over
`deletionRequestedAt <= now - DELETION_GRACE_DAYS`, following the real precedent; the executor
**re-reads the field immediately before deleting**, so a cancellation landing between the scan and
the write still wins. This kills all three findings at once:

| Finding | Why the sweep resolves it |
|---|---|
| AR2-H1 (bad jobId) | No job, no id. |
| AR2-H2 (lost job / no disarm) | No ephemeral trigger to lose. Cancellation is **clearing the field** — nothing to disarm. A failed or skipped run is self-healing: the field persists and the next run picks it up. |
| AS-R2-M1 (fail-open) | The durable field is now the trigger *and* is re-read at execution, so the mechanism can no longer disagree with the record. |
| AS-R2-M8 (`getQueue()` on the sign-in path) | Sign-in cancellation no longer calls any queue — it clears a field — so an unregistered queue (`QueueManager.ts:55-59`) can no longer 500 every sign-in. |
| AS-R2-M2 / AS-R2-M7 | No job to lose and no disarm race; the audit timing is now written per-event (below). |

**Honest limitation, stated in §3.5.1:** the sweep runs only if background jobs run — the same
dependency every recurring worker here already has. Because the consequence is a *stalled deletion*
rather than a stale metric, §3.5.1 now requires an admin-visible **pending-deletion surface** so a
stalled sweep is detectable, and names the operational prerequisite rather than leaving it implicit.

## Round-2 MEDIUM and LOW findings folded in

| Finding | Resolution |
|---|---|
| DL-R2-M1 — the audit existence-guard collides with the provisioning `create` row for the same entity, silently suppressing the deletion record | Story 2 AC4 + §5: the guard key **includes `action: 'delete'`**, so it cannot match `provisioning-service.ts:165-174`'s `create` entry. |
| AS-R2-M7 — a guarded *intent* `delete` entry would record a deletion that a later cancellation prevents, then the guard suppresses the real one | Story 2 AC4 now writes **two distinct events**: a `request_deletion` entry when the field is set (public path), and the `action: 'delete'` execution entry written by the **executor at execution time**. A cancelled request never leaves a `delete` entry. |
| AS-R2-M4 — `NotificationDelivery.source.type`/`kind` are closed enums and `source.id` is a required ObjectId, so a non-notice notification is not a drop-in | §3.5.2 + §6: stated as a real cost; the plan owns adding the enum members and defining `source.id`. |
| AS-R2-M3 — the owner notification can be suppressed (`policy.ts:83` `tier_off`) or undelivered (fake transport returning `ok:true` without `FIREBASE_SERVICE_ACCOUNT_JSON`, `transport/index.ts:29-34`) | §3.5.2 rewritten to claim **only** best-effort delivery, and to state the three suppression paths by name — including that a person with **no live device** (`sender.ts:120-124`) gets no push, which is exactly the public path's audience. The **grace period + ERP-visible record** are named as the load-bearing controls. Repeat requests do not re-notify. |
| AS-R2-M5 — AC9's helmet/CSP rationale is factually false for an nginx-served static page | §3.2 **withdrew** the helmet argument (helmet is backend middleware; nginx serves this file without it running) and Story 3 AC9 was rewritten; the round-1 clickjacking dismissal, which rested on helmet's `frame-ancestors`, is explicitly retracted. |
| AS-R2-M6 — `trust proxy` unset + in-memory limiter throttles the whole campus on a Play-mandated path | Story 3 AC3: `TRUST_PROXY_HOPS` and a shared store are named as **operator prerequisites**, with the failure mode spelled out (`app.ts:23`). |
| AS-R2-L4 — institution pause/disable state distinguishable | Story 3 AC5: noted that `lookupInstitutionByCode` (`institution-config.ts:74-81`) returns null for all three, so the collapse holds **by construction**. |
| AS-R2-L2 / AR2-M1 — worker placement | §6: the sweep belongs with the Juvi module's own workers, **not** in `shared/jobs/`. |
| AR2-M2 — `deletionRequestedAt` on `GET /me` is a response-schema change | §3.5.3 + §3.6: costed explicitly as a nullable field on the raw-Dio R61 path, with the client-parse and test-implication stated. |
| LOW ×4 — `'account_deleted'` in the `RevokeReason` **TS union** and its surfacing in the mobile 401 `reason`; capture affected notice ids **before** the `updateMany`; a fan-out racing the reset; `OutboxEvent.payload`/`Channel.memberCount` residues; `verifyCredentials` must exclude `getCooldown`/`recordFailure`; `changePassword` clears a pending request | All folded: Story 2 AC2 (union + 401 reason), §3.1 (id capture before the update; race; both residues disclosed), Story 3 AC2 (explicit exclusion), Story 4 AC1 (`changePassword`). |

## Decisions taken in round 2 (rulings)

5. **The deferral trigger is a recurring DB sweep, not a delayed job** (§3.5.1), reversing round 1's
   mechanism while keeping its intent (the grace period stays). Rationale: it is what the cited
   precedent actually is, and it is the only shape in which the durable field is authoritative.
   Cost if wrong: deletions complete on the sweep's cadence (within one interval of the deadline)
   rather than to the second, and the feature inherits the repo-wide "background jobs must run"
   operational dependency — now disclosed rather than implicit.
6. **The round-1 helmet/clickjacking rationale is withdrawn rather than kept** (AS-R2-M5). A false
   justification left in a spec becomes a false belief in an implementation. Framing protection for
   the static page, if wanted, is an nginx concern and is stated as one.
7. **The owner-notification claim is downgraded to best-effort** (AS-R2-M3/M4) rather than the
   round-1 wording, which read as a guarantee. The grace period and the ERP-visible record carry
   the security property; the push does not.

---

# Part C — round 3 (revision 3 → revision 4)

## The second convergence

Round 3 re-validated revision 3 with three fresh validators. **The one HIGH was found three times**,
by all three, from three directions — and it was a defect revision 3 had introduced in its *own*
remedy query, reintroducing the exact fail-open class it was written to remove.

| Report | Its finding for this defect | Severity it assigned |
|---|---|---|
| architecture | AR3-H1 | HIGH |
| data-layer | DL-R3-H1 | HIGH |
| api-security | M1 | **MEDIUM** |

**Severity note, recorded deliberately:** api-security graded the same defect MEDIUM while the other
two graded it HIGH. When validators disagree on severity, the ruling takes the **higher** — a fail-open
path whose consequence is "the deletion the user was promised silently never happens" is HIGH by the
round-2 precedent that graded this identical mechanism HIGH, and a PASS verdict from one validator
did not, and must not, have been allowed to close it.

## AR3-H1 / DL-R3-H1 / AS-R3-M1 — the sweep's own `status` filter excludes the rows it exists to find

**Was:** `spec.md` §3.5.1's trigger query was
`JuviAccount.find({ status: { $in: ELIGIBLE_STATUSES }, deletionRequestedAt: { $lte: … } })`, with
`ELIGIBLE_STATUSES = ['onboarding','active']` (`JuviAccount.ts:11-12`) — a predicate whose own comment
calls it *"statuses that may hold channel memberships and sign in"*. An account that is (or becomes)
`exiting`/`deactivated`/`alumni` while a request is pending was **excluded from the sweep forever**:
the field stays set, every tick skips it, nothing recovers it. Reachable — `signIn` refuses only
`deactivated` (`auth-service.ts:60-62`), so an `exiting` account can record a request; and
`deactivateAccount` fires automatically (`workflow.handlers.ts:2009`, `admin/accounts-controller.ts:13`),
so a request followed by a deactivation inside the 7-day window is exactly the bad state. It also
falsified the spec's own "completes at the deadline whether or not anyone responds".

**Now:** §3.5.1's query carries **no `status` clause** — the field is the sole predicate, which is what
§3.5.1 claimed all along. The plan adds a test that the sweep executes a `deactivated`/`exiting`
account whose field is set.

## AS-R3-M3 / AR3-M2 — "re-read immediately before deleting" was not the precedent's atomic claim

**Was:** the executor "re-reads `deletionRequestedAt` … immediately before deleting it". But the
account row is deleted **last** (§5), so the whole revoke → reset → child-delete sequence ran after
the read, and a cancellation landing in that window was overridden. The claim that "a cancellation
still wins" was only partly true, and "immediately before" was not implementable as written.

**Now:** §3.5.1 specifies an **atomic conditional claim** copied from the precedent
(`proposal-expiry-worker.ts:41-47`) — a single `findOneAndUpdate` that re-asserts the field and marks
the row, `if (!claimed) continue`. This defines the deadline crisply: a clear before the claim wins,
one after it loses. The claim is explicitly **not a lock** (it does not exclude the row from the next
tick), so a crashed deletion still retries — fail-closed preserved. Also resolves AS-R3-M4's
concurrency half (`concurrency: 1`).

## AS-R3-M2 / DL-R3-M1 — `'request_deletion'` is absent from the closed `AuditAction` enums

**Was:** Story 2 AC4 wrote `action: 'request_deletion'` and the spec never said to add it. It is in
neither the `AuditAction` union (`shared/types.ts:26-59`) nor the `AUDIT_ACTIONS` Mongoose mirror
(`audit.ts:27-36`, enforced `:45`) — a compile error and a runtime `ValidationError`. (AS-R2-M7's
remedy had said "extend `AUDIT_ACTIONS`"; rev 3 took the semantics and dropped the extension.)

**Now:** Story 2 AC4 declares the addition explicitly (precedent: `'acknowledge'`), and §5 lists both
closed-enum changes together — `'account_deleted'` (`RevokeReason`) and `'request_deletion'`
(`AuditAction`).

## AS-R3-M4 — the non-atomic audit guard can duplicate

**Was:** the §5 existence guard is a findOne→create with no unique index, so concurrent executors can
insert the intent entry twice.

**Now:** §3.5.1 and Story 2 AC4 state plainly that a duplicate `delete` entry is **accepted** — an
append-only audit's duplicate is noise, a *missing* entry is the failure the intent-first write
prevents — with a unique partial index noted as optional hardening. `concurrency: 1` on the sweep
narrows the window.

## AS-R3-M5 — the detection control for a stalled sweep was required but unspecified

**Was:** §3.5.1 named an "admin-visible pending-deletion surface" as the thing that makes a stalled
sweep acceptable, twice, and no AC or contract entry owned it.

**Now:** **Story 4 AC5** specifies `GET /api/juvi-app/admin/accounts/pending-deletion` (ERP-admin
gated) and §3.6 declares it. The surface's existence is now what the operational dependency rests on.

## Round-3 MEDIUM and LOW findings folded in

| Finding | Resolution |
|---|---|
| AR3-M1 / DL-R3-LOW — no supporting index; query omits `collegeId`, contradicting §5/AC7 | §3.5.1 adds `schema.index({ deletionRequestedAt: 1 }, { sparse: true })` and names the collection scan as a real cost; **Story 2 AC7** and **§5** carve the sweep out as the one sanctioned cross-tenant system job. |
| AR3-M3 — the *Cancel deletion* action had no endpoint or §3.6 entry | Story 4 AC1 names `DELETE /me/account/deletion-request`; §3.6 declares it. |
| DL-R3-LOW — the reset filtered a singular `accountId` while AC8 collects a set | §3.1 uses `accountId: { $in: accountIds }` in the find and keeps the `_id` narrowing in the update (which is what defeats the fan-out race). |
| AS-R3-LOW — §6 called `signInLimiter` module-private | §6 corrected: only the `limiter(n)` factory is private; `signInLimiter` is exported (`:21`). |
| AS-R3-LOW — `notices/policy.ts` path typo | §3.5.2 corrected to `notifications/policy.ts:83`. |
| AS-R3-LOW / DL-R3-LOW — `spaces/routes.ts:8` vs actual `:6` | Story 3 AC7 corrected to `:6`. |
| AS-R3-LOW — Story 2 AC4 self-contradicted on the request entry's `entityType` | The request bullet now says `'JuviAccountPublicDeletion'`, matching the closing sentence. |
| AS-R3-LOW — `deletionRequestedVia` not cleared on cancel | Story 4 AC1 clears **both** request fields. |
| AS-R3-LOW — `Sec-Fetch-Site` treated as one option among two | Story 3 AC8 makes it primary with an explicit `Origin`/`Referer` fallback and rejection when neither is present. |
| AS-R3-LOW — `deletionRequestedAt` not yet on the schema | Already a §6 deliverable; carried forward. |

## Decisions taken in round 3 (rulings)

8. **The sweep predicate is the field alone**, with no `status` clause (three-way HIGH). Cost if
   wrong: the sweep touches accounts in states like `deactivated` — which is the point — so the
   executor must not assume the account is active anywhere it writes.
9. **The cancellation deadline is the atomic claim**, not a re-read (AR3-M2/AS-R3-M3). Cost if wrong:
   a cancellation arriving during the short window after the claim is lost — a bounded, documented
   window rather than the unbounded one revision 3 had.
10. **A duplicate audit entry is accepted over a missing one** (AS-R3-M4). Cost if wrong: occasional
    duplicate `delete` rows in the audit trail; the alternative (a unique index on a shared model) is
    wider scope than the defect warrants.

## GATE 2 status

Round 3: **architecture FAIL (1 HIGH), data-layer FAIL (1 HIGH), api-security PASS (0/0)** — all
three pointing at one query predicate. Revision 4 removes it, converts the re-read to an atomic
claim, declares both closed-enum additions, specifies the two missing endpoints, and folds in every
round-3 MEDIUM/LOW.

**GATE 2 is not restored yet.** Revision 4 changes passages in all three validators' scope (the sweep
query and claim, the audit enums, the new endpoints, the tenancy carve-out), so all three must
re-read their own delta against live code. A scoped round-4 re-review is dispatched separately; only
0 CRITICAL / 0 HIGH across the three re-earns GATE 2 and permits Phase 5.

---

# Part D — round 4 (revision 4 → revision 5)

## The third convergence: three PASSes, and the gate closes

| Validator | Verdict | Counts | Prior HIGH |
|---|---|---|---|
| architecture (`gate2-r4-architecture.md`) | **PASS** | 0 CRITICAL · 0 HIGH · 1 MEDIUM · 5 LOW | AR3-H1 resolved |
| api-security (`gate2-r4-api-security.md`) | **PASS** | 0 CRITICAL · 0 HIGH · 3 MEDIUM · 5 LOW | — (r3 was PASS) |
| data-layer (`gate2-r4-data-layer.md`) | **PASS** | 0 CRITICAL · 0 HIGH · 1 MEDIUM · 5 LOW | DL-R3-H1 resolved |

All three re-verified the round-3 remedy **against live code rather than the spec's own description**,
which is what makes this convergence worth trusting: architecture traced every account state the
predicate-free sweep can now reach through every write the deletion service performs and found none
status-dependent (and none touching `User`); data-layer confirmed the `status` clause is gone from
§3.5.1 and that no third `AuditAction` mirror exists repo-wide; api-security re-ran the fail-open
direction on the claim itself and found none. The one HIGH that decided round 3 is closed by all
three, independently.

**This is the third consecutive round in which the defect was self-inflicted by my own previous
remedy, and the shape is now clear enough to name**: revision 2's job-id (round 2), revision 3's
`status` predicate (round 3). Both were *mechanism* defects — a fix that quietly reintroduced the
failure class it was written to remove. Round 4 produced no such defect; every finding below is a
placement, wording, or robustness nit. The pattern is worth recording because it is the reason each
fix round was re-reviewed in full rather than patched.

## The two conflicts between validators, and their rulings

Round 4 produced two direct disagreements. Both are ruled here, and the rulings are what revision 5
now states — the spec does not carry a hedge.

### Ruling 11 — cancellation is an atomic conditional clear, and it is the *only* place that guards on `deletionClaimedAt`

**The conflict.** AR4-L2 (architecture) says cancellation should clear `deletionClaimedAt`, because a
claim-then-crash row leaves a stale marker and Story 4 AC5's stall heuristic then mislabels a
request. DL-R4-L1 (data-layer) says leave it, because the stale marker invites a future change that
adds `deletionClaimedAt: null` to the **sweep's claim filter** — which would re-introduce the
fail-open class.

**Both are right about their own hazard, and neither remedy is the fix.** Clearing the field after
the fact treats the symptom; the actual defect is that revision 4 *described* the cancellation
deadline ("a clear landing after the claim does not win") but never **enforced** it — the cancel was
a plain update that would happily clear the field on an already-claimed row, which is what
manufactures a claimed-row-with-cleared-field in the first place.

**Ruling.** Cancellation is itself one atomic conditional update whose filter includes
`deletionClaimedAt: null`:

```js
await JuviAccount.updateOne(
  { _id: accountId, collegeId, deletionRequestedAt: { $ne: null }, deletionClaimedAt: null },
  { $unset: { deletionRequestedAt: 1, deletionRequestedVia: 1, deletionClaimedAt: 1 } },
)
```

This settles both findings at once: a claimed row **cannot** be cancelled, so `deletionClaimedAt`
can never survive alongside a cleared `deletionRequestedAt` (AR4-L2's scenario is unreachable), and
the sweep's claim filter stays exactly as it was — the guard lives in the cancel, which is where the
deadline belongs (DL-R4-L1's hazard is foreclosed by the text naming precisely one place the field
may be conditioned on). §3.5.1 now states that prohibition in the claim's own paragraph, so the two
passages cannot drift apart again.

**Cost if wrong.** A request claimed by an executor that then crashed is not cancellable for up to
one tick (until the retry completes the deletion). That is deliberate: the claim is the point of no
return, deleting is the direction Play's policy wants on a stall, and the alternative — letting a
clear silently strand a claimed row — is the failure this feature exists to prevent. It also
supplies the 409 that AC1's "the UI must state that boundary" was previously only asking for in
copy.

### Ruling 12 — both CSRF signals are required when present; neither is a fallback

**The conflict.** AR4-L4 (architecture), carrying r2/r3, recommends the `Origin` allowlist as
primary with `Sec-Fetch-Site` additive, because the same-origin topology is unverifiable from the
repo. Story 3 AC8 (and AS-R3-LOW before it) had `Sec-Fetch-Site: same-origin` primary with `Origin`
as fallback.

**Ruling.** Require **both**, and reject when neither is present: `Sec-Fetch-Site`, when present,
must be `same-origin`; `Origin` (or `Referer`), when present, must be in the CORS allowlist; a
request presenting neither is rejected. This is strictly stronger than either ordering, it removes
the ordering dispute entirely, and it removes the topology question from the *correctness* argument —
the `Origin` check is unconditional-when-present rather than a fallback, so a browser that omits
Fetch Metadata is still checked.

**Cost if wrong.** Nothing legitimate is rejected that either ordering would have accepted (the
accepted set is the intersection, and a real browser page presents both). The genuine residual is the
same one both validators already flagged and neither could resolve from source: if production does
**not** serve the page and the API from one origin, the legitimate POST is rejected too — a break,
not a hole. That stays a plan-time check against the real nginx block, and it is stated as such.

## Round-4 MEDIUM and LOW findings folded in

| Finding | Disposition in revision 5 |
|---|---|
| AR4-M1 / AS-R4-M1 — the ERP admin endpoint is declared in the **mobile** OpenAPI document, where its path resolves under `/v1` (404) and its generator emits a dead `MobileApi` method | **§3.6 rewritten.** The `listPendingDeletions` entry is *removed* from the mobile contract (there is no ERP document to move it to — the only generator is `openapi/document.ts`, which is the mobile contract by construction). The admin surface's contract is now stated in prose: a plain `adminRouter.get('/accounts/pending-deletion', authorize('platform','read'), …)` with no generated client, which is how the admin portal calls its other ERP endpoints. |
| AR4-L1 / AS-R4-M2 — Story 4 AC5 reads cross-tenant ("returns every account" + a per-row `collegeId`) | AC5 and §3.5.1 now say **"every account in the caller's own college"**, give the filter (`{ collegeId: req.collegeId, deletionRequestedAt: { $ne: null } }`) and the precedent (`admin/accounts-service.ts:28`), and **drop the per-row `collegeId`** as redundant. Story 2 AC7/§5 declare the sweep the *only* cross-tenant read, and AC5 is not covered by that carve-out. |
| AS-R4-M3 — AC9 mandates a script-free page, but the stack parses no urlencoded body, so the form cannot deliver its fields | Story 3 AC1/AC9, §3.2, §5 and §6 now fix the encoding from both ends: the page is script-free and submits a native form, and the public route mounts its own scoped `express.urlencoded({ extended: false })`. The external-script alternative is recorded as considered and rejected. |
| AR4-L2 / AS-R4-L2 — `deletionClaimedAt` staleness | See **Ruling 11** above. |
| AR4-L3 — the recurrence form is the older `add(…, { repeat })`, not the module's `upsertJobScheduler`, and the new `QUEUE_NAMES` constant is unnamed | §3.5.1 and §6 now specify `upsertJobScheduler(<stable id>, { every: 3_600_000 }, …)` following `reconcile-worker.ts:48-52` (with the header note at `:43-47` as the reason), and require a **named new entry in the closed `QUEUE_NAMES` registry** (`QueueManager.ts:113-146`). |
| AS-R4-L1 — the `request_deletion` audit entry has no stated guard, so repeated public requests each append one | Story 2 AC4 and §3.5.2 now state the entry is written on the **unset → set transition only**, the same condition as the notification — a caller-side guard, since `createAuditLog` is an unconditional `create`. |
| AS-R4-L3 — `platform: read` is also held by `staff`/`ST-ADM-DIR`, and the sub-domain check is skipped on an undeclared route | Story 4 AC5 **states the exposure** rather than papering over it, and §4 records the narrowing as **out of scope**: the sub-domain vocabulary for `platform` is `['communication']` only (`sub-domains.ts:25`), so no single-route narrowing is available that does not *also* admit the Admissions Director; the real fix is module-wide (annotate every Juvi admin route and fail closed — the upgrade path `authorize.ts:52-59` already documents), and the new route is no broader than the `GET /accounts` list it sits beside. |
| AS-R4-L4 / DL-R4-L3 — the sweep scan has no batch limit and the claim loop is not wrapped per row | §3.5.1 now carries `BATCH_SIZE = 500`, `.limit(BATCH_SIZE)`, a `$ne: null` guard on the scan, and a per-row `try/catch` — all four matching the cited precedent (`proposal-expiry-worker.ts:32,38,40-68`). |
| DL-R4-L4 — the regression test guarding the round-3 fix lived only in this resolution doc, not in the spec | §3.5.1 now specifies **two** regression tests: a due account whose `status` is not in `ELIGIBLE_STATUSES` must still be swept (the test that fails the moment a status predicate returns), and a cancel landing between scan and claim must prevent the deletion. Both call the exported sweep function directly, as `proposal-expiry-worker.ts:29` exports `expireProposals`. |
| DL-R4-M1 — the field lifecycle is unspecified: cancel "goes back to unset" but `$unset` is never named, `default: null` is never forbidden, and the scan omits the `$ne: null` its own claim carries | §3.5.1 gains an explicit absent-not-`null` **field-lifecycle** constraint (with the sparse-index rationale) and the scan's `$ne: null`; §5 repeats the constraint as a numbered requirement so it is not a §3.5.1-only fact. |
| AR4-L5 / AS-R4-L5 — header stale at "revision 3"; `types.ts:26-59` is really `:26-55`; `institution-config.ts:74-81` is really `:73-79`; `admin/routes.ts:22` is not the provisioning-run route | Header bumped to **revision 5** with all four rounds listed and Part D referenced. All three line ranges corrected (`:26-55`, `:73-79`), and §3.6 now cites `admin/routes.ts:30` (the `/accounts` precedent) instead of `:22`. |

### One addition neither validator asked for, made because the ACs required it

Story 4 AC1's 409 (`DELETION_NOT_CANCELLABLE`) is not merely a status code: `MobileErrorCode` is a
closed union (`errors.ts:5-13`) and `STATUS_TO_CODE` (`:35-37`) has no 409 row, so an
`AppError`-shaped 409 would reach the client as `INTERNAL`. Revision 5 declares this as the
**third** closed-enum addition (with `'account_deleted'` and `'request_deletion'`), collected in one
§5 list so the three cannot be discovered one at a time at implementation time. This is the same
class of thing rounds 2 and 3 failed on (an undeclared closed enum), caught here before Phase 5
rather than during it.

## Decisions taken in round 4 (rulings)

11. **Cancellation is an atomic conditional clear guarded on `deletionClaimedAt: null`**, and that
    field is conditioned on in exactly one place — never in the sweep's claim filter (AR4-L2 vs
    DL-R4-L1). Cost if wrong: a claim-then-crash row is not cancellable for up to one tick; the
    deletion still completes, which is the direction the policy wants.
12. **Both CSRF signals are required when present; neither is a fallback** (AR4-L4 vs Story 3 AC8).
    Cost if wrong: none for legitimate browsers — the accepted set is their intersection.
13. **The ERP admin surface has no generated-client contract**, and revision 4's mobile-document
    entry is removed rather than relocated (AR4-M1 / AS-R4-M1). Cost if wrong: if a machine-readable
    ERP contract is wanted later it needs its own document — a new artifact, explicitly out of scope.
14. **`DELETION_NOT_CANCELLABLE` is declared as a third closed-enum addition** (§5). Cost if wrong: a
    small, additive enum member on a mobile error union.
15. **The `platform: read` breadth on the admin surface is disclosed, not narrowed** (AS-R4-L3).
    Cost if wrong: an Admissions Director can read the pending-deletion list — the same class of
    access they already have on `GET /accounts`, with no PII in the response.

## GATE 2 status

**GATE 2 IS MET.** Round 4: **architecture PASS (0/0), api-security PASS (0/0), data-layer PASS
(0/0)** — 0 CRITICAL and 0 HIGH across all three, which is exactly the gate's criterion. The one
HIGH that failed rounds 2 and 3 is closed by all three validators independently, against live code.

Revision 5 folds in every round-4 MEDIUM and LOW (the table above), plus the two rulings. Because
those edits do change passages all three validators read — §3.6's contract placement, Story 4 AC1's
cancel filter and 409, Story 4 AC5's query, §3.5.1's scan and cadence, Story 3 AC1/AC8/AC9's
encoding and CSRF — a **scoped confirmation** ran against the changed passages before Phase 5 began.

**The confirmation is in, and it is clean.** 22 claims, each checked against the live file rather
than against the spec's own description of it (the failure mode the pass exists to catch): every
live-code citation and every spec-internal claim **CONFIRMED**. Specifically re-verified in source:
the `AuditAction` union really ends at `:55` and no second mirror of the audit vocabulary exists
repo-wide; `createAuditLog` is an unconditional `create`; `urlencoded` appears nowhere in
`backend/src`; `lookupInstitutionByCode` at `:73-79` returns `null` for unknown, inactive and
Juvi-disabled alike; `upsertJobScheduler` at `reconcile-worker.ts:48-52`; `QUEUE_NAMES` is
`as const`; the `proposal-expiry-worker` precedent's `BATCH_SIZE`, per-row `try/catch`, atomic claim
and exported `expireProposals` are all exactly as cited; `STATUS_TO_CODE` has no 409 row;
`admin/routes.ts:30` is the `/accounts` gate and `:22` is a blank line; `platform`'s only
sub-domain is `communication`; ST-ADM-DIR's `platform: read` grant is sub-domain-scoped; the only
OpenAPI generator is the mobile one, written to disk at build time and served by no route; the
admin surface is a sibling of `/v1`.

The one **refuted** citation was in the confirmation's own brief, not in the spec: the brief said
`app.ts:88` mounts the mobile `/v1` sub-router, and `:88` is `app.use(errorHandler)` — the sub-router
is mounted at `modules/juvi-app/routes.ts:28`. The spec never cites `:88`, and its own `app.ts`
citations (`:46`, `:46-51`, `:23`) are accurate, so **no spec edit follows from it**.

Two wording nits the pass *did* surface were fixed in revision 5: the spec called
`reconcile-worker.ts:43-47` "the file header" when it is an inline comment above the registration
call, and one §5 sentence still carried the pre-correction sparse-index rationale ("sorts below
every `Date`") that §3.5.1 had already superseded — both now state what the code says.

Phase 5 (`plan.md`) may proceed.


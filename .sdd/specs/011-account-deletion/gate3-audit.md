# GATE 3 — pre-implementation audit (011-account-deletion)

## Verdict

**PASS** — 0 CRITICAL · 0 HIGH · 4 MEDIUM · 6 LOW

The spec (revision 5), the plan (22 tasks), and `tasks.md` (22 slices) are coherent and implementable,
and the audit's three passes did not surface a citation that is *asserted-true but wrong* on a
load-bearing path, an orphan AC, an unauthorized invention, or a task that cannot be built as written.
Every high-stakes citation on the caller's list was verified against the live file, not against the
document's description of it. The two highest-risk claims both hold: **T5's "delete must not gate on
ERP state" needs no middleware change** (`authenticate-mobile.ts:41-47` reads `account.status`, never
`User.isActive`), and **the sweep/claim/cancel query shapes match the spec's code blocks byte-for-byte**
(scan has no `status` predicate; the claim filter names exactly two fields; `deletionClaimedAt: null`
appears in the cancel filter only). Four findings are MEDIUM — none blocks Phase 8: three are
documentation/coverage gaps (a citation span pointing at the wrong function; T8 collapsing Story 3's
two distinct rate-limiting mechanisms into one contradictory artifact; the mobile-local `Me` model
missing from every task's Files list), and one is a §14 bullet misclassified as operator config when it
is a code change (the shared limiter store). The MEDIUMs are "will need a clarifying line during
implementation," not "will ship a wrong behaviour." **PASS is warranted; Phase 8 may proceed.**

---

## Pass 1 — citation integrity

Verified against the live tree at `backend/src` / `mobile/lib` as of this audit. One row per cited span.
`WRONG` = the span exists but does not contain the claimed code; `DRIFT` = the span is adjacent/
related code, or the claim is right but the span is off by lines; `VERIFIED` = the span says what is
claimed.

| Cited span | What is actually there | Verdict |
|---|---|---|
| `JuviAccount.ts:9` (`ACCOUNT_STATUSES`) | `['onboarding','active','exiting','deactivated','alumni']` — no `deleted`; §3.3's negative requirement holds | VERIFIED |
| `JuviAccount.ts:11-12` (`ELIGIBLE_STATUSES`) | `['onboarding','active']`, comment "may hold channel memberships and sign in" — a membership predicate, not a sweep predicate | VERIFIED |
| `JuviAccount.ts:95-99` (indexes) | **five** `collegeId`-prefixed indexes (personId-unique, userId, status+kind, studentId sparse, facultyId sparse); none on a deletion field | VERIFIED (span); the *count* is the LOW-1 defect |
| `JuviAccount.ts:96` (`{collegeId,userId}` not unique) | `schema.index({ collegeId: 1, userId: 1 })` — no `unique` | VERIFIED (Story 2 AC8's premise holds) |
| `MobileSession.ts:4-10` (`RevokeReason`+`REVOKE_REASONS`) | closed union + array, no `'account_deleted'` | VERIFIED |
| `shared/types.ts:26-55` (`AuditAction`) | closed union, no `'request_deletion'` | VERIFIED |
| `shared/audit.ts:27-36` (`AUDIT_ACTIONS`) | mirror array, no `'request_deletion'`; comment names the union as source of truth | VERIFIED |
| `shared/audit.ts:45` (enum enforced) | `action: { type: String, enum: AUDIT_ACTIONS, required: true }` | VERIFIED |
| `shared/audit.ts:60-62` (`createAuditLog` unconditional) | `return AuditLog.create({...entry, timestamp: new Date()})` — no dedupe | VERIFIED |
| `errors.ts:5-13` (`MobileErrorCode`) | closed union, no `'DELETION_NOT_CANCELLABLE'` | VERIFIED |
| `errors.ts:35-37` (`STATUS_TO_CODE`) | no `409` row; `AppError(409,…)` reaches the client as `INTERNAL` | VERIFIED |
| `provisioning-service.ts:94` (`resetPassword` default) | `const resetPassword = input.resetPassword ?? true;` | VERIFIED |
| `provisioning-service.ts:165-174` (provisioning `create` entry) | `createAuditLog({ entityType:'JuviAccount', entityId:String(account._id), action:'create', …})` — the guard without `action` would collide | VERIFIED |
| `provisioning-service.ts:206-214` (`deactivateAccount`) | sets `User.isActive=false` + `revokeOtherSessions(...,'deactivated')` (soft) — the obvious wrong turn | VERIFIED |
| `recipient-service.ts:20-31` (reset+recount pattern) | narrow-by-`_id` `updateMany` then per-notice `countDocuments` + `Notice.updateOne({status:{$ne:'publishing'}})` — the spec's reset copies this exactly | VERIFIED |
| `recipient-service.ts:30-31` (recount only) | the recount loop | VERIFIED |
| `spaces/routes.ts:6` (`spacesRouter.use(authenticateMobile)`) | router-wide `use(authenticateMobile)` at `:6` | VERIFIED |
| `juvi-app/routes.ts:20-25` (ordering comment) | the receipts-path comment sits at `:20-21`; `spacesRouter` mounted at `:25` | VERIFIED |
| `juvi-app/routes.ts:28-29` (`/v1`, `/admin` siblings) | `router.use('/v1', v1Router); router.use('/admin', adminRouter);` | VERIFIED |
| `app.ts:23` (`trust proxy`) | `app.set('trust proxy', process.env.TRUST_PROXY_HOPS ? Number(...) : false)` | VERIFIED |
| `app.ts:46-51` (json-only) | `express.json({limit, verify})`; no `urlencoded` anywhere in the route list | VERIFIED |
| `institution-config.ts:73-79` (`lookupInstitutionByCode`) | returns `null` for unknown / `collegeStatus!=='active'` / `!enabled` — branches collapse by construction | VERIFIED |
| `cooldown.ts:7` (hash so identifier never lands in Redis/logs) | the comment above `cooldownKey` | VERIFIED |
| `cooldown.ts:8-11` (`cooldownKey`, `COOLDOWN_MAX_FAILURES`) | `juvi:login-fail:<collegeId>:<sha256>`; `COOLDOWN_MAX_FAILURES=5` at `:4` | VERIFIED |
| `rate-limits.ts:7` (`limiter` module-private) | `function limiter(max)` — not exported | VERIFIED |
| `rate-limits.ts:21` (`signInLimiter` exported) | `export const signInLimiter = limiter(10);` | VERIFIED |
| `rate-limits.ts` (no `store` configured) | `rateLimit({windowMs,max,standardHeaders,legacyHeaders,skip,handler})` — default per-process `MemoryStore` | VERIFIED |
| `QueueManager.ts:55-59` (`getQueue` throws) | `throw new Error("Queue '<name>' not registered…")` | VERIFIED |
| `QueueManager.ts:113-146` (`QUEUE_NAMES`), `:141-142` (Juvi names) | closed `as const`; `JUVI_PROVISIONING`/`JUVI_RECONCILE` at `:141-142` | VERIFIED |
| `proposal-expiry-worker.ts:29` (`expireProposals` exported) | exported for Redis-less tests | VERIFIED |
| `proposal-expiry-worker.ts:32`, `:38`, `:40-68` (BATCH_SIZE, `.limit`, per-row try/catch) | `BATCH_SIZE=500`; `.limit(BATCH_SIZE)`; `for`+`try/catch`+`console.error`+`continue` | VERIFIED |
| `proposal-expiry-worker.ts:41-47` (atomic claim, `if(!claimed) continue`) | `findOneAndUpdate({_id,status,expiresAt},{$set:{status}})` + `if(!claimed) continue;` | VERIFIED |
| `proposal-expiry-worker.ts:126-130` (interval-keyed repeat, deliberately not copied) | `queue.add('sweep',{},{repeat:{pattern:'*/15 * * * *'},…})` | VERIFIED |
| `reconcile-worker.ts:43-47` (stale-scheduler cleanup comment/loop) | comment explaining the interval-keyed form left the old schedule; `getJobSchedulers` removal loop | VERIFIED |
| `reconcile-worker.ts:48-52` (`upsertJobScheduler` stable id) | `await queue.upsertJobScheduler(SWEEP_SCHEDULER_ID,{every},{name:'sweep',…})` | VERIFIED |
| `server.ts:9-10` (Juvi worker imports) | provisioning-worker + reconcile-worker | VERIFIED |
| `server.ts:20` (`DISABLE_BACKGROUND_JOBS!=='true'` gate) | the guard around all `register*` calls | VERIFIED |
| `server.ts:31-40` (per-worker try/catch + warn) | the Juvi registrations each in their own `try/catch` | VERIFIED |
| `admin/routes.ts:18` (`adminRouter.use(authenticate)`) | present | VERIFIED |
| `admin/routes.ts:30` (`authorize('platform','read')` precedent) | `adminRouter.get('/accounts', authorize('platform','read'), …)` | VERIFIED |
| `admin/routes.ts:41-42` (ERP 404 + errorHandler) | `next(new AppError(404,'Not found'))` + `errorHandler` | VERIFIED |
| `authorize.ts:52-59` (upgrade-path comment) | the "ponytail:" comment naming the fail-closed upgrade path — file is `backend/src/middleware/authorize.ts` (only `authorize.ts` in the repo; spec cites the bare basename) | VERIFIED |
| `authorize.ts:61` (sub-domain check) | `if (opts?.subDomain && policy.scope?.subDomain) { … }` — skipped when the route declares none | VERIFIED |
| `defaults.ts:155` (ST-ADM-DIR `platform:read`) | `{role:'staff',personaType:'ST-ADM-DIR',module:'platform',action:'read',scope:{subDomain:'communication'}}` | VERIFIED |
| `sub-domains.ts:25` (`platform:['communication']`) | present | VERIFIED |
| `scope-plugin.ts:73` (HOOKS list excludes deleteMany/updateMany) | `['findOne','findOneAndUpdate','findOneAndDelete','findOneAndReplace','updateOne','deleteOne','replaceOne']` | VERIFIED |
| `document.ts:147` (`signOut`), `:154` (`revokeDevice`), `:176` (`clearPushToken`) | all three routes, all `status:204` | VERIFIED |
| `document.ts:189` (single `tags:['mobile']`), `:206` (`servers:/api/juvi-app/v1`) | present; no admin route in the list `:142-180` | VERIFIED |
| `sender.ts:120-124` (no_device settle) | `settle(live,{status:'suppressed',reason:'no_device'})` when no sessions carry a `pushToken` | VERIFIED |
| `NotificationDelivery.ts:16` (`source.type` closed) | `INotificationSource { type:'notice'|'class_change'; … }` | VERIFIED |
| `NotificationDelivery.ts:47` (`accountId` required, per-account fields) | `accountId: {type:ObjectId, ref:'JuviAccount', required:true}` | VERIFIED |
| `NotificationDelivery.ts:49` (source subdoc) | the `source` block; the **required `id` is at `:50`** | VERIFIED (span), `:70` is DRIFT — LOW-3 |
| `NotificationDelivery.ts:70` (cited for "`source.id` required") | the **unique** index `{'source.type','source.id','source.kind',accountId}`; it evidences idempotency, not "required" | DRIFT — LOW-3 |
| `transport/index.ts:29-34` (cited for "the transport is a no-op that returns `ok:true`") | `pushTransportWarning()` — the startup-warning string. The no-op-with-`ok:true` transport is `transport/fake.ts:23-30` (`send` → `{token, ok:true}`), selected at `index.ts:14-24` | DRIFT — **MEDIUM-1** |
| `secure_store.dart:27` / `:28` (`pending_link`/`last_account` keys) | `_pendingLink='juvi.pending_link'`; `_lastAccount='juvi.last_account'` | VERIFIED |
| `secure_store.dart:96` (`clearPendingLink` exists) | `Future<void> clearPendingLink() => _deleteQuietly(_pendingLink);` | VERIFIED |
| `secure_store.dart:105-109` (`wipeAll` 3-key allowlist) | loop over `[_access,_refresh,_college]`; no `pending_link`/`last_account`; **no `clearLastAccount`** anywhere | VERIFIED |
| `app_database.dart:243-247` (`db.wipe`) | deletes exactly `kvCache`, `pendingActionRows`, `analyticsEvents` | VERIFIED |
| `session_controller.dart:159` (`_wipe`) | `_wipe()` = `wipeAll()` + `db.wipe()`, each in its own `try` | VERIFIED |
| `session_controller.dart:111-118` (`SESSION_INVALIDATED`→wipe) | `handleFailure` already routes `sessionInvalidated` through `_wipe()` | VERIFIED |
| `receipts.dart:33` (`ReceiptQueue`, `clear` absent) | class `ReceiptQueue` has `read`/`_write`/`add`/`remove` — no `clear` | VERIFIED |
| (plan T18) "the queue has `read`/`add`/`remove`/`post`/`drain`" | `post`/`drain` are on `Receipts` (`:75-87`), not `ReceiptQueue` | DRIFT — LOW-4 |
| `authenticate-mobile.ts:41-47` (account resolve + deactivated gate) | `JuviAccount.findById(claims.aid)`; throws 403 `ACCOUNT_DEACTIVATED` only when `account.status==='deactivated'` — **never reads `User.isActive`** | VERIFIED → T5 achievable with no middleware change |
| `authenticate-mobile.ts:84-90` (`juvi:acct-touch:<accountId>`) | `redis.set('juvi:acct-touch:${accountId}','1','EX',60,'NX')` | VERIFIED |
| `session-service.ts:10` (`ACTIVE_CACHE_SECONDS=60`), `:18` (`juvi:sess:<sid>`) | both present | VERIFIED |
| `auth-service.ts:60-62` (signIn refuses only `deactivated`/`!isActive`) | `if (account.status==='deactivated' || !user.isActive) throw 403` | VERIFIED |
| `auth-service.ts:31-70` (`signIn` body, cooldown at `:32`) | `getCooldown` first; resolve+`bcrypt.compare` `:51-53`; `createSession` `:65` | VERIFIED |
| `me-service.ts` (the `/me` payload source) | exists (`accounts/me-service.ts`, 9.3K) | VERIFIED |
| `admin/accounts-service.ts:28` (`{collegeId}` scoped query) | `const filter: Record<string,unknown> = { collegeId };` | VERIFIED |
| `config/routes.ts:7` (unauthenticated Juvi JSON route shape) | `configRouter.get('/institutions/:code', institutionLookupLimiter, ctrl.lookupInstitution)` | VERIFIED |
| `workflow.handlers.ts:2009` (auto-deactivation) | `await deactivateAccount(String(instance.collegeId), String(account._id), 'workflow', …)` | VERIFIED |
| `admin/accounts-controller.ts:13` (console deactivation) | `deactivateAccount(req.collegeId!, …, 'admin', who(req))` | VERIFIED |
| `lead-scoring/enqueue.ts:32-35` (`_` jobId separator workaround) | the comment + `score_<collegeId>_<inquiryId>_<minuteBucket>` | VERIFIED |
| `photo-service.ts:181-184` (`${prefix}/photo/original.<ext>`) | `prefix` computed `:181`, ext `:182`, `originalKey` `:183` | VERIFIED |
| `NoticeRecipient.ts` reset field list (`receivedAt/seenAt/dismissedAt/remindedAt/ack`) | all present `:68-72`; `accountId default:null` `:62`; `ack.sessionId` ref `'MobileSession'` `:49`; `{noticeId,personId}` unique `:78` | VERIFIED |
| `Notice.counts.onJuvi` (recount target) | `counts:{audience:Number,onJuvi:Number}` `:56/:98` | VERIFIED |
| `backfillAddedLater` (covers only `addedLater:true`, 30 days) | exists `recipient-service.ts:37`; `ADDED_LATER_WINDOW_DAYS=30` `:14` | VERIFIED |
| `me_repository.dart` reads `/me` over raw Dio, parses with the **local** `Me` | `_dio.get('/me')` → `Me.fromJson(json)` `:57-61`; the local freezed `Me` is `models.dart:126` | VERIFIED → **MEDIUM-3** |
| `mobile/README.md` "Toolchain notes" (R61) | `:50` heading, `:53` the R61 nullable-object note | VERIFIED |
| `bullmq/dist/.../job.js:1073-1076` (rejects `:` in jobId) | not re-verified (third-party `node_modules`); **non-load-bearing** — historical rationale for a design already rejected in revision 2 | NOT CHECKED (rationale-only) |

Net: every citation on the caller's high-stakes list is **VERIFIED** except
`transport/index.ts:29-34` (DRIFT → MEDIUM-1), with three line-level drifts
(`NotificationDelivery.ts:70`, `accounts/routes.ts:20-21`, `receipts.dart` method list → LOWs) and one
count error (indexes → LOW-1).

---

## Pass 2 — coverage

**Spec §2 has 29 ACs, not 26** (Story 1: AC1–AC7 = 7; Story 2: AC1–AC8 = 8; Story 3: AC1–AC9 = 9;
Story 4: AC1–AC5 = 5). All 29 map to a plan task and a `tasks.md` slice. The caller's "26" is a
miscount; no AC is unmapped either way.

| Spec AC | What it requires | Plan task | `tasks.md` slice | Verdict |
|---|---|---|---|---|
| S1 AC1 | Settings row + two explicit lists | plan T19 (§12) | T19 | COVERED |
| S1 AC2 | typed confirmation phrase, not one tap | plan T19 | T19 | COVERED |
| S1 AC3 | `_wipe()` + `ReceiptQueue.clear()` + `clearPendingLink()` + drop `last_account`; land on sign-in | plan T18 (+T20) | T18, T20 | COVERED |
| S1 AC4 | fail/offline → nothing deleted, stay signed in; no `signOut()`/`unregister()` | plan T20 | T20 | COVERED |
| S1 AC5 | copy via `context.l10n` | plan T19 | T19 | COVERED |
| S1 AC6 | `401 SESSION_INVALIDATED` on any request → same wipe | plan T20 | T20 | COVERED |
| S1 AC7 | banner + *Cancel*, driven by `deletionRequestedAt` on `/me` | plan T14 (+T21) | T14, T21 | COVERED (mobile-local `Me` gap → MEDIUM-3) |
| S2 AC1 | `DELETE /me/account`, JWT-only, no body id | plan T5 | T5 | COVERED |
| S2 AC2 | hard-delete sessions after write-through revoke; `juvi:acct-touch` drop; `'account_deleted'` both halves | plan T2, T4 | T2, T4 | COVERED |
| S2 AC3 | `Person/User/Student` untouched; `isActive:true` asserted on **both** paths | plan T4 | T4 | COVERED |
| S2 AC4 | two audit entries; `request_deletion` both halves; transition-only request; execution first/intent-guarded on `{…,action:'delete'}`; actor = account id; `entityType` marks origin | plan T2, T4, T9 | T2, T4, T9 | COVERED |
| S2 AC5 | post-deletion token → 401 | plan T5 | T5 | COVERED |
| S2 AC6 | idempotent; second call defined 401/404, never 500 | plan T5 | T5 | COVERED |
| S2 AC7 | request-path queries `collegeId`-scoped; sweep the one exception; one `deleteScoped`; two-college test per model | plan T3, T4, T11 | T3, T4, T11 | COVERED |
| S2 AC8 | account rows removed by `{collegeId,userId}`; child rows by collected ids | plan T4 | T4 | COVERED |
| S3 AC1 | static no-script page + native form; endpoint needs scoped `urlencoded` | plan T16, T9 | T16, T9 | COVERED |
| S3 AC2 | code+identifier+password; read-only `verifyCredentials`; no session/cooldown effects | plan T7 | T7 | COVERED |
| S3 AC3 | exported `deletionVerifyLimiter`; 429 unit test; store-backed proxy-aware key; `TRUST_PROXY_HOPS`+shared store prereqs | plan T8 (+§14) | T8 | COVERED (conflation → MEDIUM-2; shared store → MEDIUM-4) |
| S3 AC4 | same deletion as Story 2; deferred; identical response | plan T4, T9 | T4, T9 | COVERED |
| S3 AC5 | generic failure; pre-credential branches collapsed | plan T7, T9 | T7, T9 | COVERED |
| S3 AC6 | no sign-in cooldown; separate **non-blocking** per-identifier budget `juvi:deletion-verify:<…>`; key-disjoint | plan T8 | T8 | COVERED (no artifact home → MEDIUM-2) |
| S3 AC7 | mount before `spacesRouter`; ordering comment; `spacesRouter` untouched; test without `Authorization` | plan T9 | T9 | COVERED |
| S3 AC8 | reject cross-site; both signals agree; neither → reject | plan T9 | T9 | COVERED |
| S3 AC9 | plain HTML, no script; nginx-served; no backend-middleware dependency | plan T16 | T16 | COVERED |
| S4 AC1 | request recorded; cancellable via the atomic conditional `$unset`; deadline = the claim; three clear paths; 409 `DELETION_NOT_CANCELLABLE` (third enum) | plan T2, T6 | T2, T6 | COVERED |
| S4 AC2 | owner notified, best-effort | plan T10 | T10 | COVERED |
| S4 AC3 | re-provision recreates fresh; `resetPassword` rotates | **non-change** (plan §Global constraints) | — | COVERED (deliberate) |
| S4 AC4 | no do-not-re-provision marker; reconciler untouched | **non-change** (plan §Global constraints) | — | COVERED (deliberate) |
| S4 AC5 | admin `GET /accounts/pending-deletion`; `collegeId`-scoped query; fields; age rule; RBAC breadth recorded | plan T13 (+T15) | T13, T15 | COVERED |

**Normative statements in §3/§5** likewise all have a home: §3.1 reset+recount → T4; §3.2 scoped
`urlencoded` → T9, static page → T16; §3.3 "not `deactivateAccount`" → T4 (explicit) and plan
§Global-constraints; §3.4 disclosure → T22; §3.5.1 sweep/claim/cadence/constants → T11, regression
tests → T12; §3.5.2 notification → T10; §3.5.3 `/me` fields → T14; §3.6 contract → T17, admin route
absent → T13/T17; §5's three closed enums → T2, field lifecycle → T1, scoped parser → T9.

**Orphan ACs:** none.
**Unauthorized inventions / scope violations (task→spec):** none material. The one behaviour the spec
does not state — T5's crossing state — is (a) flagged by the plan itself as "a class no AC enumerates"
(plan §4 focus 1) and (b) the *only* behaviour consistent with §3.5's "the in-app path deletes
immediately." It is derived-and-documented, not silently invented; recorded as LOW-5 (the binding spec
should still gain the line). No task implements anything on §4's out-of-scope list; the admin-RBAC
breadth is recorded as accepted, not narrowed (§4), matching the plan.

---

## Pass 3 — consistency & implementability

**Task-vs-task:** no contradictions. T5 (in-app, immediate) and T6 (cancel, 409) are different
endpoints; T11's scan (no `status`) matches T12's regression test 1; T4's fixed order matches §5's
order; T1's absent-not-null gate is the regression T6 relies on. The one internal contradiction is
*inside* T8 (below).

**Interface/symbol consistency:** `runAccountDeletion`, `deleteScoped`, `sweepAccountDeletions`,
`verifyCredentials`, `deletionVerifyLimiter`, `ReceiptQueue.clear()`, `SecureStore.clearLastAccount()`
are each named once and used consistently across plan and tasks. Two constants are *used* but never
*pinned* (LOW-6): `JUVI_ACCOUNT_DELETION_SWEEP_ID` (the spec says the scheduler id is a named constant;
T11 uses it, no task says where it is defined or what its value is) and `DELETION_GRACE_DAYS` (T11/T12
use it; the spec sets it to `7` but no task names its file). `tasks.md` numbers T15/T16 before
T17–T21 while plan §15 sequences them after; both orders are dependency-valid (T15 needs T13, T16 needs
T9 — both earlier), so this is cosmetic, not a defect.

**Plan-mandated review defects:** plan §4 lists five classes + the `isActive:false` note, each pinned
to a test in a named task (T5, T9, T12). All five have a test; none is a note-only.

**§15 sequence:** implementable as written. Dependencies hold — T4 needs T1/T2/T3 (all earlier);
T5/T6 need T4 and T2 (earlier); T7/T8 precede T9 (which consumes both); T11/T12 need T1/T4 (earlier);
T17 needs T5/T6 (earlier); T18–T21 need T17's regenerated client (earlier); T16 needs T9 (earlier);
T22 last. No forward dependency.

**§14 deployment prerequisites — operator or code?** Three bullets, two correctly classified:
- `TRUST_PROXY_HOPS` — **correctly an operator prerequisite**: `app.ts:23` already reads the env var;
  setting it is config, no code change.
- nginx "serve the static page before any SPA fallback" and "`root` → `$WEB_ROOT/current`" —
  **correctly operator prerequisites**: nginx config; no nginx config ships in the repo
  (`scripts/deploy.sh` only publishes `dist/` and moves the `current` symlink).
- "**A shared limiter store if the API runs more than one worker**" — **a code change in disguise**
  (**MEDIUM-4**). `middleware/rate-limits.ts`'s `limiter()` configures no `store`, and
  express-rate-limit has no env/config path to one: getting a shared store means adding `store:` to
  `limiter()` plus a Redis-store dependency (`rate-limit-redis`/equivalent). It is therefore not
  something an operator can turn on, and no task owns it (T8's Files are `rate-limits.ts` +
  `cooldown.ts` *read-only*). As written, a multi-worker (pm2 cluster) deploy multiplies and
  restart-resets the `deletionVerifyLimiter` budget while §14 reads as though it were handled.

**T5 crossing state — spec-authorized or silently invented?** **Derived and documented; not a silent
invention, but the binding spec has a real gap.** §3.5 states flatly that "the in-app path deletes
**immediately**" and locates the grace period's whole purpose in protecting against the public path's
weaker evidence ("a single stuffed password"). A live authenticated session plus a typed confirmation
phrase is strictly stronger evidence, so collapsing the window when a public request is already pending
is the only behaviour consistent with §3.5; the alternative (deferring or 409-ing an in-app delete
because a public request exists) would *contradict* "deletes immediately." The plan is explicit that
this is not spec'd — plan §4 head "The five classes this feature will meet that no AC enumerates,"
focus 1 names the crossing state and pins it to T5, whose body and test state the behaviour and its
rationale. So it is neither silent nor unauthorized; it is a derived consequence the spec should state
explicitly (LOW-5). Residual risk is low: the caller reaching this path has just typed a confirmation
phrase, so no surprised or unintended deletion is possible.

**T8 — the one implementability defect (MEDIUM-2).** T8 is titled "`deletionVerifyLimiter` + the
separate budget" and its prose correctly says the AC6 budget is "**separate**," but the task then asks
**one** artifact to be two contradictory things: an exported limiter "following the `signInLimiter =
limiter(10)` shape" whose "**429**" a unit test "constructs the limiter directly and asserts"
(⇒ express-rate-limit: IP-keyed via `req.ip`, and **hard-blocking** — it *is* a 429), **and** a budget
"keyed `juvi:deletion-verify:<collegeId>:<hash-of-identifier>`" that is "counted and backed off,
**never hard-blocked**" (⇒ a Redis per-identifier counter, keyed by identifier not IP). A single
express-rate-limit middleware cannot be identifier-keyed without an unmentioned `keyGenerator`, and
cannot be "never hard-blocked." The spec separates these cleanly into Story 3 AC3 (the limiter) and
AC6 (the non-blocking budget); the plan merges them, and worse, gives the AC6 budget **no artifact
home** — its only candidate file, `cooldown.ts`, is listed "(read-only)". The commit message ("non-
blocking public deletion-verify limiter") bakes the merge in. Mitigating: the plan's own preamble says
the spec wins where they disagree, and the spec *does* separate them, so an implementer following the
spec recovers. This will still stall/clarify during T8 and could yield an identifier-keyed hard block
(violating AC6) if read literally — MEDIUM, not HIGH.

**Pass-3 conclusion:** with the T8 split made explicit and the three documentation gaps closed (all
one-line edits), the plan is implementable as written. Nothing found rises to CRITICAL or HIGH.

---

## Findings

| # | Severity | file:line | What is wrong | Smallest fix |
|---|---|---|---|---|
| **M1** | MEDIUM | `spec.md:648-649` (citing `notifications/transport/index.ts:29-34`) | The span cited for "the transport is a no-op that returns `ok: true`" is `pushTransportWarning()` — the startup-warning *string*, not the transport. The no-op-with-`ok:true` transport is `transport/fake.ts:23-30` (`send` → `{token, ok:true}`), selected at `index.ts:14-24`. The cited span's own text ("…use the fake (logging) transport and reach no phone") states the practical consequence, so only the mechanism detail is mis-located; no task is implemented from it (it is §3.5.2 rationale), which is why this is MEDIUM not HIGH. | Repoint the citation to `transport/fake.ts:23-30` (and, if the selection matters, `transport/index.ts:14-24`). |
| **M2** | MEDIUM | `plan.md:298-311` (T8), `tasks.md:80-85` ; spec `spec.md:174-184` (S3 AC3) + `spec.md:194-202` (S3 AC6) | T8 collapses Story 3's **two** distinct rate-limiting mechanisms into one artifact: an exported `deletionVerifyLimiter` "following `signInLimiter = limiter(10)`" whose **429** a test constructs (⇒ IP-keyed express-rate-limit, hard-blocking), **and** a "separate, non-blocking" per-identifier budget keyed `juvi:deletion-verify:<collegeId>:<hash>` "never hard-blocked" (⇒ a Redis counter). One express-rate-limit middleware cannot be identifier-keyed (needs an unspecified `keyGenerator`) nor non-blocking. The AC6 budget also has **no artifact home** — `cooldown.ts` is listed *read-only*, and no other file is named. | Split T8 into two named deliverables: `deletionVerifyLimiter` (the AC3 limiter, in `rate-limits.ts`) and the AC6 non-blocking per-identifier budget, with an explicit file (e.g. a new `accounts/deletion-verify-budget.ts` or a writer in `cooldown.ts`) and separate tests. |
| **M3** | MEDIUM | `plan.md:61-63` (§2 Mobile), `plan.md:457-467` (T14), `plan.md:573-581` (T21) ; `mobile/lib/core/repos/me_repository.dart:55-62`, `mobile/lib/core/models/models.dart:125-137` | Story 1 AC7's banner (T21) reads `deletionRequestedAt`/`deletionRequestedVia` from `GET /me`, and the client parses `/me` with the **local** freezed `Me` (`me_repository.dart` → `Me.fromJson`), not the regenerated `wire.Me` (T17). `models.dart` (the local `Me`) appears in **no** task's Files list and needs a freezed codegen run; freezed `fromJson` silently drops unknown keys, so the banner would read `null` forever without it. Discoverable during T21, hence MEDIUM. | Add `mobile/lib/core/models/models.dart` (+ the codegen step) to T14's or T21's Files list, alongside the two new nullable fields. |
| **M4** | MEDIUM | `plan.md:607` (§14, "A shared limiter store…"), `plan.md:298-311` (T8) ; `backend/src/modules/juvi-app/middleware/rate-limits.ts:7-18` | §14 classifies "a shared limiter store if the API runs more than one worker" as an **operator prerequisite**, but `limiter()` configures no `store` and express-rate-limit has no env/config path to one — a shared store needs code (`store:` in `limiter()` + a Redis-store dependency). It is a code change in disguise, and no task owns it, so a multi-worker deploy multiplies/restart-resets the deletion-verify budget while §14 reads as handled. | Either (a) keep it operator-only by adding the `store:` wiring to T8's scope (code), or (b) restate §14 as a known limitation of the current single-process store rather than an operator action. |
| **L1** | LOW | `plan.md:21-22` (§0) | "`JuviAccount.ts` today has **three** `collegeId`-prefixed indexes" — there are **five** (`JuviAccount.ts:95-99`). The spec's own §3.5.1 ("every `JuviAccount` index is `collegeId`-prefixed") is correct; only the count in the plan is wrong. | Change "three" to "five". |
| **L2** | LOW | `spec.md:682-683` (§3.6), `plan.md:78` (§3 reuse ledger) | "the two existing bodyless **deletes** on `accountsRouter` (`accounts/routes.ts:20-21`)" — only `:20` (`DELETE /me/devices/:id`) is a DELETE; `:21` (`POST /me/devices/revoke-others`) is a bodyless POST. The pattern copied is right; the noun is loose. | Say "bodyless endpoints" (or cite `:20` alone for the DELETE shape). |
| **L3** | LOW | `spec.md:640-641` (§3.5.2), `plan.md:347-348` (T10) | `NotificationDelivery.ts:16,49,70` cited for "`source.id` is a required ObjectId" — the required `id` is at **`:50`**; `:70` is the **unique index** (idempotency, not required-ness). | Cite `:50` for the required `id`; keep `:70` only where the unique key is the point. |
| **L4** | LOW | `plan.md:532-533` (T18) | "the queue has `read`/`add`/`remove`/`post`/`drain` today" — `post`/`drain` are on `Receipts` (`receipts.dart:75-87`), not on `ReceiptQueue` (`:33`, which has `read`/`add`/`remove`). Spec Story 1 AC3 ("only `read`/`add`/`remove`") is correct. | Drop `post`/`drain` from the `ReceiptQueue` method list. |
| **L5** | LOW | `spec.md:453-463` (§3.5), `plan.md:87-90,242-246,573-581` (§4 focus 1, T5, T21) | The crossing state (a pending public request + an in-app delete) is decided by T5 and documented in plan §4/T5, but the **binding** spec never states it: §3.5 says only that the in-app path is immediate. The choice is derived and consistent (see Pass 3), but the spec is the authority and should say so. | Add one sentence to spec §3.5: an in-app deletion deletes immediately regardless of a pending public request (no grace, no 409). |
| **L6** | LOW | `plan.md:398-401` (T11), `tasks.md:112` | `JUVI_ACCOUNT_DELETION_SWEEP_ID` is used by T11 and the spec says both the scheduler id and the queue name are named constants, but no task says **where** the id constant is defined or what its value is; `DELETION_GRACE_DAYS` is likewise used by T11/T12 with no defining file named. | Name the defining file and value for both constants in T11's Files bullet. |

### Two things that gate the whole feature (carried from `tasks.md`, re-affirmed)

- **T4's `isActive: true` assertion must pass on both paths.** This is the guard on the single worst
  failure mode (destroying a person's ERP login). Verified achievable: the deletion service never
  touches `User`/`Person`/`Student`, and `deactivateAccount()` (the wrong turn) is explicitly excluded.
- **T12's tests must be proven by mutation, not by reading.** Round 3 failed on a query-shape defect
  that survived every other assertion; the two tests pin the two shapes the sweep's correctness rests
  on (no `status` predicate; the `if (!claimed) continue;` guard).

---

## Disposition — GATE 3 PASS, all findings folded

**Verdict: PASS — 0 CRITICAL · 0 HIGH.** Phase 8 is unblocked (pending the branch decision, not this gate).

Every finding above was verified against live source before any artifact was edited — the project's
own rule, learned when GATE 2 round 1 was failed partly on assertions that read true and were not.

**MEDIUMs — all four fixed:**

- **M1** — citation repointed to `transport/fake.ts:23-30` (the no-op returning `ok: true`), with
  `transport/index.ts:18-22` named for the selection.
- **M2** — T8 split into **two** deliverables with two commits: (a) `deletionVerifyLimiter` in
  `rate-limits.ts` (Story 3 AC3), (b) the non-blocking per-identifier budget in a **new** file
  `accounts/deletion-verify-budget.ts` (Story 3 AC6). The budget is not an express-rate-limit
  middleware — a 429 there would let an attacker lock a victim out with five bogus requests, the exact
  failure AC6 exists to prevent.
- **M3** — `mobile/lib/core/models/models.dart` (+ freezed codegen) added to T14, to §2's file table,
  and to `tasks.md` T14. The local freezed `Me` (`models.dart:126`) is what `me_repository.dart:55-62`
  parses; freezed drops unknown keys **silently**, so a server-only field makes AC7's banner never
  fire, with no error.
- **M4** — the shared limiter store reclassified from "operator prerequisite" to a **code change, out
  of scope**, in both the spec (Story 3 AC3 + §4) and `plan.md` §14, with the condition stated.
  Verified: `limiter(n)` (`rate-limits.ts:7-18`) passes **no** `store`; express-rate-limit has no
  env/config path to one; the only limiter dependency is `express-rate-limit` itself.

**LOWs — all six fixed:**

- **L1** — plan §0 "three `collegeId`-prefixed indexes" → **five** (`JuviAccount.ts:95-99`, counted).
- **L2** — "bodyless **deletes**" → "bodyless **endpoints**" (`:20` DELETE, `:21` POST). Occurred
  **three** times, not the one the finding's line refs implied: `spec.md:693` and `spec.md:702` as
  well as `plan.md`'s reuse ledger. All three fixed.
- **L3** — required `source.id` citation `NotificationDelivery.ts:16,49,70` → `:16,50` (`:70` is the
  uniqueness index). Occurred **three** times — `spec.md:660`, `plan.md` T10, `tasks.md` T10 — where
  the finding named two. All three fixed.
- **L4** — `post`/`drain` dropped from T18's `ReceiptQueue` method list; noted as living on `Receipts`
  (`receipts.dart:75-87`).
- **L5** — the crossing-state rule is now stated **in the binding spec** (§3.5): an in-app deletion
  deletes immediately regardless of a pending public request — no grace, no 409, no consultation of
  `deletionClaimedAt`. This was the one finding whose fix belonged in the spec rather than the plan,
  so that an irreversible-action behaviour no longer has to be inferred from §3.5's silence.
- **L6** — T11's Files bullet now names the defining file and the value for both constants:
  `DELETION_GRACE_DAYS = 7` and `JUVI_ACCOUNT_DELETION_SWEEP_ID = 'juvi-account-deletion-sweep'`
  (matches the `SWEEP_SCHEDULER_ID = 'juvi-reconcile-sweep'` convention at
  `spaces/reconcile-worker.ts:34`).

**Note on the audit's own line references.** Several spec spans this audit cites are off by a few
lines against the current file (L2's `:682-683` is `:693`/`:702`; L3's `:640-641` is `:660`). The
**quotations** are exact and each was located by text, so no finding was missed — but the line numbers
in the table above should be read as approximate. Two findings occurred in more places than the table
enumerated (L2, L3), which the by-text search caught.

**The two feature-gating assertions are unchanged and unweakened:**

- T4's `isActive: true` assertion passes on both paths — the deletion service touches no
  `User`/`Person`/`Student`.
- T12's two tests are proven by **mutation**, not by reading. Round 3 failed on a query-shape defect
  that survived every other assertion; the tests pin the two shapes the sweep rests on.

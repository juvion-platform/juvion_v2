# Tasks: Optional Hostel & Transport Allotment

**Spec:** `./spec.md` · **Plan:** `./plan.md` · **Created:** 2026-04-17
**Total tasks:** 19 (17 Code, 1 Config, 1 Doc)

---

## Task DAG Overview

```
         ┌────────────────────────────────────────────────────────┐
         │                                                        │
   T1 ─┬─ T3 ─┬─ T4 ─┬─ T8 ─┬─┐                                   │
       │      │      │      │ │                                   │
       │      │      │      │ ├─> T12 (admission workflow) ──┐    │
       │      │      │      │ │                              │    │
       │      │      │      │ ├─> T13 (expiry worker) ───────┤    │
       │      │      ├─ T5 ─┤ │                              │    │
       │      │      │      │ ├─> T14 (migration) ───────────┤    │
       │      │      └──────┤ │                              │    │
       │      │             │ └─> T15 (seed update) ─────────┤    │
       │      │      ┌─ T6 ─┘                                │    │
       │      │      │                                       ▼    │
       │      └──────┤              ┌─ T16 (admin hostel UI) ─┐   │
       │             ├── T9 ────────┤                         │   │
       │             │              └─ T17 (admin trans UI) ──┤   │
       │             └─ T7 ─┐                                 │   │
       │                    │       ┌─ T18 (student page) ────┤   │
       │                    ├── T10 ┤                         │   │
       │                    │       └─ T19 (dashboard widget)─┤   │
       │             ┌──T11 ┘                                 │   │
       │             │                                        ▼   │
       └──── T2 ─────┘                                   T20 (docs)
```

Legend:
- **T1** = schema foundation (everything downstream needs this)
- **T2** = feature flag (parallel; T12 needs it)
- **T3** = allocation-lifecycle helper (services need this)
- **T4–T7** = hostel + transport services
- **T8–T10** = routes + controllers + validation
- **T11** = RBAC (parallel; T8–T10 need policies in place when endpoints go live)
- **T12–T15** = integration, ops, data layer
- **T16–T19** = frontend
- **T20** = API docs

---

## Task List

| #  | Task | Type | Depends On | Status |
|----|------|------|-----------|--------|
| 1  | Extend `HostelAllocation`, `TransportAllocation`, `CampusConfig` schemas | Code | — | Done |
| 2  | Add `features.optionalAllotmentProposals` feature flag | Config | — | Done |
| 3  | Create `allocation-lifecycle.ts` shared helper | Code | 1 | Done |
| 4  | Hostel propose / withdraw / promote service functions | Code | 1, 3 | Done |
| 5  | Hostel accept / decline / vacate service functions | Code | 1, 3 | Done |
| 6  | Transport propose / withdraw / promote service functions | Code | 1, 3 | Done |
| 7  | Transport accept / decline / vacate service functions | Code | 1, 3 | Done |
| 8  | Hostel routes, controllers, Zod validation (admin + `/mine`) | Code | 4, 5 | Done |
| 9  | Transport routes, controllers, Zod validation (admin + `/mine`) | Code | 6, 7 | Done |
| 10 | Student `accept/decline/request-vacate` controllers (hostel + transport) | Code | 4, 6 | Done |
| 11 | Extend RBAC defaults: add `ST-TRANSPORT-OFFICER`, extend `ST-WARDEN`, student scope | Code | — | Done |
| 12 | Rewire admission workflow to create `proposed` allocations (flag-gated) | Code | 2, 4, 6 | Done |
| 13 | BullMQ expiry worker + queue registration | Code | 1, 3 | Done |
| 14 | Data migration script: retrofit existing `active` allocations | Code | 1 | Done |
| 15 | Update `seed.ts` to populate new propose/respond fields | Code | 1 | Done |
| 16 | Admin portal: Hostel allocations screen actions | Code | 8 | Done |
| 17 | Admin portal: Transport allocations screen actions | Code | 9 | Done |
| 18 | Student portal: `CampusServices.tsx` page | Code | 10 | Done |
| 19 | Student dashboard widget for pending proposals | Code | 18 | Done |
| 20 | API reference documentation for the 16 new endpoints | Doc | 8, 9, 10 | Done |

**Parallelism opportunities:**
- T1 and T2 and T11 have no dependencies — can start in parallel
- T4 + T6 parallel after T3 (hostel vs transport services)
- T5 + T7 parallel after T3
- T8 + T9 parallel after their respective services
- T14, T15 parallel after T1
- T16 + T17 + T18 parallel after their respective APIs

---

# Task Details

---

### Task 1: Extend allocation and config schemas
**Type:** Code → captain-tdd
**Status:** Done
**Depends On:** —
**Completed:** 2026-04-18 — 34 new tests, 80/80 full suite (at time of completion), typecheck clean. See `completions/task-1.md`.

**Acceptance Criteria (maps to spec §7, plan §3):**
- `HostelAllocation.status` enum includes all new values: `proposed`, `waitlisted`, `active`, `vacate_requested`, `vacated`, `cancelled`, `declined`, `withdrawn`, `expired`, `transferred`. Default changed from `'active'` to `'proposed'`.
- `HostelAllocation` schema has new fields: `proposedBy` (ObjectId?), `proposedAt` (Date, default now), `respondedAt` (Date?), `respondedBy` (ObjectId?), `ttlDays` (number), `expiresAt` (Date?, indexed), `withdrawReason` (string?), `declineReason` (string?), `vacateRequestedAt` (Date?), `vacateApprovedBy` (ObjectId?). `allocationMethod` enum extended with `'admin_proposed'`.
- `HostelAllocation` has new compound index: `{ collegeId: 1, status: 1, expiresAt: 1 }`.
- `TransportAllocation` has equivalent field additions (minus `bedId`, preserving its `cancelled` semantic instead of `vacated`). Enum adds `proposed`, `waitlisted`, `vacate_requested`, `declined`, `withdrawn`, `expired`. Adds `waitlistPosition` field.
- `CampusConfig.hostel` sub-doc has `proposalTtlDays: number` (default 7). `CampusConfig.transport` sub-doc has same field with same default.
- `npm run typecheck -w backend` passes with zero errors.
- All existing call sites that read `status` (found via grep: 6 `.create()` sites across `hostel-service.ts`, `mess-transport-service.ts`, `welfare/service.ts`, `workflow.handlers.ts`, `seed.ts`) continue to compile and run without behavior change — the new enum values are additive.
- A unit test creates each allocation model with each valid status, asserting persistence and retrieval succeed.

**Context:** This is the foundation. Mongoose enum extension is backwards-compatible (old data with `status: 'active'` still reads fine). The default change only affects new documents. TypeScript strictness (`noUncheckedIndexedAccess`) will surface any code that indexed into the status enum positionally — fix in this task, not later.

**Files to modify:**
- `backend/src/models/welfare/HostelAllocation.ts`
- `backend/src/models/welfare/TransportAllocation.ts`
- `backend/src/models/campus/CampusConfig.ts`

**Risk callout:** R-1 (plan §7). The hardest part is ensuring no caller assumed only 3 states existed. Run the typechecker early and often.

---

### Task 2: Add feature flag
**Type:** Config → captain-spec direct
**Status:** Done
**Depends On:** —
**Completed:** 2026-04-18 — 9 new tests, 101/101 full suite, typecheck clean. See `completions/task-2.md`.
**Deferred**: docker-compose.yml env entry. Low-risk (flag default `false` keeps legacy behavior); fold into T12 or a pre-ship checklist.

**Expected State:**
- `backend/src/config/features.ts` (create if absent) exports a typed `features` object with at least one property: `optionalAllotmentProposals: boolean`.
- Value is read from env var `FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS` (string `'true'` → `true`, anything else → `false`).
- Default in `.env.example` and docker-compose env: `FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS=false`.
- A helper `isOptionalAllotmentEnabled()` returns the boolean (centralizes access; easy to mock in tests).

**Verification:**
- `grep -r "FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS" backend/` shows it registered in config and `.env.example`.
- With flag `true`, `isOptionalAllotmentEnabled()` returns `true`. With flag unset, returns `false`.
- A Vitest unit test covers both cases by setting `process.env` and re-importing (or via a direct helper param).

**Rollback plan:** Setting `FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS=false` disables the feature at runtime. No data rollback needed (propose-flow allocations created before rollback remain in the DB in whatever status they reached).

---

### Task 3: `allocation-lifecycle.ts` shared helper
**Type:** Code → captain-tdd
**Status:** Ready
**Depends On:** 1

**Acceptance Criteria (maps to plan §1.2, §1.5):**
- New file `backend/src/modules/campus-ops/allocation-lifecycle.ts` exports:
  - `AllocationFlow` type: `'hostel' | 'transport'`
  - `assertValidTransition(flow, currentStatus, nextStatus)` throws `AppError(409)` with `invalid_transition` code for disallowed transitions per the state machine in spec §6.
  - `recordTransition({ flow, collegeId, allocation, fromStatus, toStatus, action, performedBy, reason?, notifyStudent?, notifyAdmin?, triggerFee? })` — updates the allocation, writes an `AuditLog`, creates a `Notification` if notify flags set, and (when `triggerFee=true`) calls a fee-creation helper. All inside a Mongoose transaction.
  - `checkCapacity(flow, collegeId, targetId, stopName?)` returns `{ available, capacity, liveCount }`. `liveCount` = count of allocations in `{proposed, waitlisted, active, vacate_requested}` for that room/route-stop.
  - `computeExpiry(flow, collegeId)` reads `CampusConfig`, returns `{ expiresAt: Date, ttlDays: number }` using `new Date(Date.now() + ttlDays * 86400 * 1000)`.
- Unit tests cover the state machine exhaustively: for every (currentStatus, nextStatus) pair, verify allowed ones succeed and all others throw.
- `recordTransition` test: inserting a mock allocation, calling with `fromStatus='proposed', toStatus='active', triggerFee=true`, then asserting (a) allocation has `status='active'`, (b) `AuditLog` exists, (c) `Notification` exists when `notifyStudent=true`, (d) `FeeLineItem` exists when `triggerFee=true`.
- `checkCapacity` test: seed a room with capacity=3, 1 active + 1 proposed allocation → `liveCount=2`, `available=1`.
- `computeExpiry` test: with `proposalTtlDays=7`, returns a Date ~7 days from now (±1s tolerance).

**Context:** This is the concurrency-safe core. R-3 (plan §7) lives here — `checkCapacity` must be called **inside the same transaction** as the insert, by the caller. The helper doesn't own the transaction; the service caller does. Keep `recordTransition` composable with a caller-owned session.

**Testing reuse**: use `backend/src/__tests__/helpers/mongoMemory.ts` (created in T1) for `setupMongo` / `teardownMongo` / `clearCollections`. Don't recreate MongoMemoryServer bootstrap code.

**State machine** (authoritative — implement exactly):

```
Allowed transitions:
  proposed     → active, declined, withdrawn, expired
  proposed     → (via admin) waitlisted    [edge case: re-queue; optional for v1 — reject for now]
  waitlisted   → proposed, withdrawn
  active       → vacate_requested
  vacate_requested → vacated (hostel) / cancelled (transport), active (reject → revert)
  (any)        → itself   [idempotent no-op — return without change]

All other transitions: throw AppError(409, 'invalid_transition').
```

---

### Task 4: Hostel propose / withdraw / promote service
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 1, 3

**Acceptance Criteria (maps to spec §5.1, §5.4, plan §2.1):**
- Function `proposeHostelAllocation(collegeId, data, performedBy)` where `data = { studentId, roomId, bedId?, academicYearId, preferences?, specialNeeds?, forceWaitlist?: boolean }`:
  - Inside a Mongoose transaction: calls `checkCapacity('hostel', ...)`. If available but not `forceWaitlist`: creates `HostelAllocation { status: 'proposed', proposedBy: performedBy, proposedAt: now, ttlDays, expiresAt, ...data }`. If unavailable and `forceWaitlist=true`: creates with `status: 'waitlisted', waitlistPosition = current+1`. If unavailable and not `forceWaitlist`: throws `AppError(409, 'capacity_full', { canWaitlist: true })`.
  - Calls `recordTransition(action: 'propose', notifyStudent: true)`.
  - Returns the created allocation.
- Function `withdrawHostelProposal(collegeId, allocationId, performedBy, reason)`:
  - Loads allocation; asserts `status ∈ {proposed, waitlisted}`; sets `status='withdrawn'`, `withdrawReason=reason`; calls `recordTransition(action: 'withdraw', notifyStudent: true)`.
- Function `promoteHostelWaitlist(collegeId, allocationId, performedBy)`:
  - Asserts `status='waitlisted'`; inside transaction: re-checks capacity (may have shifted), then sets `status='proposed'`, refreshes `proposedAt=now` and `expiresAt`; calls `recordTransition(action: 'waitlist_promote', notifyStudent: true)`.
- All three functions write to `AuditLog` via `recordTransition`.
- Unit tests with mongodb-memory-server (existing pattern in the repo):
  - Propose with capacity → creates `proposed` allocation.
  - Propose without capacity + `forceWaitlist=false` → throws 409.
  - Propose without capacity + `forceWaitlist=true` → creates `waitlisted`.
  - Concurrent propose (two parallel calls for the last bed) → exactly one succeeds, the other gets 409.
  - Withdraw from `proposed` → `withdrawn`; from `active` → 409.
  - Promote from `waitlisted` when capacity free → `proposed`; from `active` → 409.

**Context:** Lives in `backend/src/modules/campus-ops/hostel-service.ts`. Existing partial waitlist logic at lines 149, 294 should be reviewed and replaced — don't leave two code paths that create `HostelAllocation`s.

**Testing reuse**: use `backend/src/__tests__/helpers/mongoMemory.ts` (from T1) for DB setup.

---

### Task 5: Hostel accept / decline / vacate service
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 1, 3

**Acceptance Criteria (maps to spec §5.2, §5.3, §5.4):**
- Function `acceptHostelProposal(collegeId, allocationId, studentId)`:
  - Loads allocation; asserts `studentId` matches allocation's; asserts `status='proposed'`.
  - Transaction: sets `status='active', respondedAt=now, respondedBy=studentId`; increments `HostelRoom.currentOccupancy` (fail if would exceed capacity — concurrency guard); calls `recordTransition(action: 'accept', triggerFee: true, notifyStudent: true)`.
  - Idempotent: calling on already-`active` allocation returns 200 with current state, no new fee line item (EC-1).
- Function `declineHostelProposal(collegeId, allocationId, studentId, reason?)`:
  - Asserts `status='proposed'`; sets `status='declined', respondedAt=now, respondedBy=studentId, declineReason=reason`; calls `recordTransition(action: 'decline', notifyAdmin: true)`.
- Function `requestVacateHostel(collegeId, allocationId, studentId, reason?)`:
  - Asserts `status='active'`; sets `status='vacate_requested', vacateRequestedAt=now`; creates a `HostelClearance` record with `status='pending'`; calls `recordTransition(action: 'vacate_request', notifyAdmin: true)`.
- Function `approveVacateHostel(collegeId, allocationId, performedBy, clearanceNotes?)`:
  - Asserts `status='vacate_requested'`; transaction: sets `status='vacated', vacatedDate=now, vacateApprovedBy=performedBy`; decrements `HostelRoom.currentOccupancy`; updates `HostelClearance` to `status='approved'` with `feeSettlementPending: true`; calls `recordTransition(action: 'vacate_approve', notifyStudent: true)`.
- Function `rejectVacateHostel(collegeId, allocationId, performedBy, reason)`:
  - Asserts `status='vacate_requested'`; sets `status='active'`; updates `HostelClearance` to `status='rejected'` with `reason`; calls `recordTransition(action: 'vacate_reject', notifyStudent: true)`.
- Tests:
  - Happy path accept → `active`, room occupancy +1, `FeeLineItem` created with `component='hostel_fee'`, audit log written, notification written.
  - Accept then accept again → idempotent, no duplicate fee.
  - Accept on `declined` → 409.
  - Accept by wrong studentId → 403.
  - Decline → `declined`, no fee, no occupancy change.
  - Request vacate → `vacate_requested`, clearance record created.
  - Approve vacate → `vacated`, occupancy -1, clearance `approved` + `feeSettlementPending=true`.
  - Reject vacate → back to `active`, clearance `rejected`.

**Context:** All capacity writes go through transactional updates to catch R-3 races. Use `Model.findOneAndUpdate({ _id, currentOccupancy: { $lt: capacity } }, { $inc: { currentOccupancy: 1 } }, { session, new: true })` — if the conditional fails, the transaction aborts.

**Testing reuse**: use `backend/src/__tests__/helpers/mongoMemory.ts` (from T1) for DB setup.

---

### Task 6: Transport propose / withdraw / promote service
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 1, 3

**Acceptance Criteria:** Structurally identical to Task 4, but:
- `routeId` + `stopName` replace `roomId` + `bedId`.
- Capacity target = `TransportRoute.capacity` (or seats; confirm field name during implementation — OQ not yet raised but low-risk).
- `checkCapacity('transport', collegeId, routeId, stopName)` — may need per-stop capacity if routes have stop-level seat limits; if not, per-route only.
- Lives in `backend/src/modules/campus-ops/mess-transport-service.ts`.
- Parallel tests to Task 4.

**Context:** The existing `TransportAllocation.feeTriggered` boolean is not set here (proposal doesn't trigger fee). Only Task 7's accept path sets it.

**Testing reuse**: use `backend/src/__tests__/helpers/mongoMemory.ts` (from T1) for DB setup.

---

### Task 7: Transport accept / decline / vacate service
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 1, 3

**Acceptance Criteria:** Structurally identical to Task 5, but:
- Terminal state after vacate = `'cancelled'` (not `'vacated'`) — preserves existing transport enum semantic.
- Accept sets `TransportAllocation.feeTriggered=true` and creates `FeeLineItem { component: 'transport_fee', ... }`.
- Uses `TransportClearance` instead of `HostelClearance`.
- Capacity decrement applies to route seats (or stop seats if modeled).
- Parallel tests to Task 5.

**Testing reuse**: use `backend/src/__tests__/helpers/mongoMemory.ts` (from T1) for DB setup.

---

### Task 8: Hostel routes, controllers, validation
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 4, 5

**Acceptance Criteria (maps to plan §2.1, §2.2):**
- `backend/src/modules/campus-ops/routes.ts` has new routes (all prefixed with the existing `/hostel/allocations` structure):
  - `POST /propose` — warden/admin only, Zod-validated, calls `proposeHostelAllocation`
  - `POST /:id/withdraw` — warden/admin only
  - `POST /:id/promote` — warden/admin only
  - `POST /:id/approve-vacate` — warden/admin only
  - `POST /:id/reject-vacate` — warden/admin only
  - `GET /mine` — student only, returns `{ items, pendingCount, activeCount }` scoped by `req.user.studentId`
- Corresponding controller functions in `campus-ops/controller.ts` — thin: validate req → call service → return JSON. Standard try/catch → next(err) pattern.
- Zod schemas in `campus-ops/validation.ts` for each POST body.
- RBAC middleware attached per route — warden/super-admin on admin routes; student on `/mine`.
- Integration tests (using supertest + mongodb-memory-server) for each endpoint:
  - Happy path returns expected JSON.
  - Missing auth → 401. Wrong role → 403. Invalid body → 400.
  - State violations → 409 with descriptive error code.

**Context:** Use the existing RBAC `requirePermission` middleware or equivalent — confirm exact name when implementing. Add optional `?status` query param to existing list endpoints so admin UI can filter.

**SubDomain handoff (from T11 completion):** The RBAC engine doesn't filter by `subDomain` — it only filters by module+action+persona and returns the matching policy. The policy carries `scope.subDomain = 'hostel'` for warden actions. The service/controller **must** inspect `authScope.subDomain` (or a subdomain guard middleware) before allowing a warden persona to act on a **transport** endpoint, and vice versa. Without this check, a warden could successfully call transport routes because the `campus` module grant matches. Implement either: (a) a per-route `requireSubDomain('hostel')` guard, or (b) check inside the controller before calling the service.

---

### Task 9: Transport routes, controllers, validation
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 6, 7

**Acceptance Criteria:** Structurally identical to Task 8. Routes under `/transport/allocations/*`. Controllers call transport services. Transport-officer/super-admin RBAC on admin routes. Integration tests parallel.

**SubDomain handoff**: same as T8. Enforce `authScope.subDomain === 'transport'` at the route or controller layer so `ST-WARDEN` can't accidentally act on transport allocations.

---

### Task 10: Student accept/decline/request-vacate controllers
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 4, 6

**Acceptance Criteria:**
- Add the student-action endpoints to `campus-ops/routes.ts`:
  - `POST /hostel/allocations/:id/accept`
  - `POST /hostel/allocations/:id/decline`
  - `POST /hostel/allocations/:id/request-vacate`
  - Same 3 mirrored for `/transport/allocations/*`.
- Each controller:
  - Resolves `studentId` from `req.user` (see plan OQ-2; may need to read `Student` model if only `personId` is on JWT).
  - Calls corresponding service function.
  - Returns updated allocation.
- RBAC: `student` role; controller enforces `selfOnly` by passing `req.user.studentId` to service (service re-checks against `allocation.studentId`).
- Integration tests:
  - Student accepts own proposal → 200.
  - Student accepts another student's proposal → 403.
  - Admin/warden tries to accept (wrong role) → 403.
  - Decline → 200, status changes to `declined`.
  - Request vacate from `proposed` (invalid) → 409.
  - Idempotent accept → 200 each time, same allocation returned.

**Context:** This splits out from Tasks 8/9 because it unifies hostel+transport student-side logic in one place. It's the student-facing surface.

**SubDomain handoff**: student policies grant `campus:update` scoped to `subDomain: 'hostel-allocation,transport-allocation'`. Controllers should verify the route's subdomain is in that allowlist before proceeding — lightweight but important, since the base `campus:update` grant would otherwise extend to any future campus sub-action.

---

### Task 11: Extend RBAC defaults
**Type:** Code → captain-tdd
**Status:** Done
**Depends On:** —
**Completed:** 2026-04-18 — 12 new tests, 46/46 RBAC suite, 92/92 full (at time of completion), typecheck clean. See `completions/task-11.md`.

**Acceptance Criteria (maps to plan §4):**
- `backend/src/shared/rbac/defaults.ts` adds:
  - New persona `ST-TRANSPORT-OFFICER`: `{ role: 'staff', personaType: 'ST-TRANSPORT-OFFICER', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'transport' }, description: 'Transport Officer: transport allocations and routes' }`
  - Warden extension to campus module: `{ role: 'staff', personaType: 'ST-WARDEN', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'hostel' }, description: 'Warden: hostel sub-domain of campus ops' }`
  - Student read-own on campus: `{ role: 'student', module: 'campus', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true }, description: 'Student: read own campus services' }`
  - Student update-own for allocations: `{ role: 'student', module: 'campus', action: 'update', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true, subDomain: 'hostel-allocation,transport-allocation' }, description: 'Student: accept/decline/vacate own allocations' }`
- Existing RBAC engine tests (`rbac/__tests__/engine.test.ts`, `resolve-permissions.test.ts`) continue to pass.
- New test: resolving permissions for a `ST-TRANSPORT-OFFICER` user grants full access to `campus:transport:*` and denies `campus:hostel:*`.
- New test: student can `campus:*:read` on own resources and `campus:hostel-allocation:update` on own resources only.

**Context:** Ready-status because this task has no dependencies. Policies are data; they don't need the schema changes from Task 1. This can (and should) be picked up first or in parallel with T1.

---

### Task 12: Rewire admission workflow
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 2, 4, 6

**Acceptance Criteria (maps to spec §5.1, plan §1.1, §8):**
- `backend/src/modules/admissions/workflow.handlers.ts` lines 1163–1310 (the campus services block) is refactored:
  - When `isOptionalAllotmentEnabled() === true`:
    - If `result.hostelRequired === true`: call `proposeHostelAllocation()` (not direct `HostelAllocation.create()`). Workflow step marked `completed` when proposal is successfully created. If propose throws `capacity_full`, step marked `failed` with reason `no_capacity`.
    - Same for transport via `proposeTransportAllocation()`.
    - If `hostelRequired === false`, step is `skipped`.
  - When `isOptionalAllotmentEnabled() === false`: existing code path runs unchanged (backwards compatibility).
- Idempotency: if an existing `proposed`/`active` allocation already exists for `(studentId, academicYearId)`, step is `completed` with the existing allocation reference (matches existing behavior, preserve it).
- Result object (returned from the handler) no longer implies the student has an `active` allocation — field naming should reflect proposal state. Reuse existing `hostelAllocationId`/`transportAllocationId` but add `hostelStatus: 'proposed' | 'active' | 'failed' | 'skipped'`.
- Integration test: run admission workflow for an applicant with `hostelRequired=true, transportRequired=true` under flag=on:
  - Both allocations created with `status='proposed'`.
  - No `FeeLineItem` exists yet.
  - Workflow step status = `completed`.
- Integration test under flag=off: legacy behavior (active allocation created, fee created via existing logic if any).

**Context:** This is the keystone integration. The feature flag wraps the whole block; both code paths coexist behind the flag. R-2 (plan §7) — do NOT rewrite the block destructively; add a conditional branch.

---

### Task 13: BullMQ proposal-expiry worker
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 1, 3

**Acceptance Criteria (maps to spec §5.5, plan §1.6):**
- New file `backend/src/shared/jobs/proposal-expiry-worker.ts`:
  - Exports `registerProposalExpiryQueue()` which calls `registerQueue({ name: QUEUE_NAMES.CAMPUS_PROPOSAL_EXPIRY, processor: expireProposals, concurrency: 1 })`.
  - `expireProposals()` job handler: for each of `HostelAllocation` and `TransportAllocation`, runs `Model.find({ status: 'proposed', expiresAt: { $lte: new Date() } })` per college (iterate colleges, respect multi-tenancy), and for each matching doc calls `recordTransition(action: 'expire', notifyStudent: true, notifyAdmin: true)`.
  - On server start (`server.ts`): calls `registerProposalExpiryQueue()` and adds a recurring job every 15 minutes via `queue.add('sweep', {}, { repeat: { pattern: '*/15 * * * *' } })`.
- `QUEUE_NAMES.CAMPUS_PROPOSAL_EXPIRY = 'campus:proposal-expiry'` added to `shared/queue/QueueManager.ts`.
- Integration test (vitest): manually insert a `proposed` allocation with `expiresAt=yesterday`, invoke the handler directly, assert status changed to `expired`, audit log present, notification present.
- Concurrency: worker `concurrency: 1` ensures only one sweep runs at a time. Uses `findOneAndUpdate({ status: 'proposed', expiresAt: { $lte: now } }, { status: 'expired' })` pattern per-doc to survive concurrent runs safely (R-4).

**Context:** Reuses existing BullMQ infrastructure. No new dependencies. Keep the worker's `recordTransition` call inside a loop bounded by batch size (say 500) to avoid memory blow-up on mass expiry.

**Testing reuse**: use `backend/src/__tests__/helpers/mongoMemory.ts` (from T1) for DB setup.

---

### Task 14: Data migration script
**Type:** Code → captain-tdd
**Status:** Ready
**Depends On:** 1

**Acceptance Criteria (maps to plan §3.4):**
- New file `backend/src/migrations/2026-04-optional-allotment.ts`:
  - Connects to Mongo via existing config.
  - For every `HostelAllocation` and `TransportAllocation` with `status ∈ {'active', 'vacated', 'cancelled', 'transferred'}` and `proposedAt == null`: set `proposedAt = createdAt`, `respondedAt = createdAt`, `respondedBy = studentId`.
  - For every `CampusConfig` missing `hostel.proposalTtlDays` or `transport.proposalTtlDays`: set to 7.
  - Logs count of updated records.
- New script in `backend/package.json`: `"migrate:optional-allotment": "ts-node -r dotenv/config src/migrations/2026-04-optional-allotment.ts"`.
- Idempotency: re-running the script is a no-op (skips records with `proposedAt` already set).
- Unit test using `mongodb-memory-server`: seed a mix of old-shape and new-shape records, run migration, verify old-shape records gain fields and new-shape records are untouched.

**Context:** The migration is forward-only. No rollback script in v1 (rolling back would re-introduce nulls which break nothing but violates the invariant).

**Testing reuse**: use `backend/src/__tests__/helpers/mongoMemory.ts` (from T1) for DB setup.

---

### Task 15: Update seed data
**Type:** Code → captain-tdd
**Status:** Ready
**Depends On:** 1

**Acceptance Criteria:**
- `backend/src/seed.ts` lines 803–813 (hostel + transport allocation seeding): each seeded `active` allocation now also includes `proposedAt`, `respondedAt`, `respondedBy` fields set to sensible values (e.g., same as createdAt).
- Optional — seed at least one `proposed` allocation and one `waitlisted` allocation per college to exercise the new flow in dev.
- `npm run seed -w backend` completes successfully.
- After seeding, `HostelAllocation.find({ proposedAt: { $exists: true } })` returns all seeded allocations.

**Context:** Small but enables realistic local development. Keeps new tests from having to manually build fixtures.

---

### Task 16: Admin portal — Hostel allocations screen
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 8

**Acceptance Criteria (maps to plan §5.1):**
- `admin-portal/src/pages/campus/HostelAllocations.tsx` is extended with:
  - Status filter chips (Proposed / Waitlisted / Active / Vacate Requested / Terminal).
  - Per-row action buttons rendered conditionally by status: Withdraw (for proposed/waitlisted), Promote (for waitlisted), Approve Vacate / Reject Vacate (for vacate_requested).
  - "New Propose" button opens modal with: student picker, room/bed picker, preferences form. On submit, calls `POST /propose`. If 409 `capacity_full`, modal offers "Add to Waitlist" button that re-submits with `forceWaitlist: true`.
- `admin-portal/src/services/campus.ts` exports React Query `useMutation` / `useQuery` hooks for each new endpoint.
- UI uses existing CSS utility classes (`inp`, `lbl`, `manageLink` from CLAUDE.md).
- Manual verification (documented in PR): warden logs in → sees allocation list → proposes new allocation → student accepts via student portal → allocation flips to Active → warden approves vacate request → allocation flips to Vacated.

**Context:** Defer automated UI tests to a later polish pass (Vitest + React Testing Library). Manual verification + integration tests from Task 8 cover correctness.

---

### Task 17: Admin portal — Transport allocations screen
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 9

**Acceptance Criteria:** Structurally identical to Task 16. Route picker replaces room/bed picker; stopName is a dropdown of route.stops.

---

### Task 18: Student portal — Campus Services page
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 10

**Acceptance Criteria (maps to plan §5.2):**
- New file `admin-portal/src/pages/student/CampusServices.tsx`:
  - **Pending Proposals card** at top: lists all hostel + transport proposals where `status='proposed'` targeting current student. Each card shows: service type, details (room/route), TTL countdown (computed from `expiresAt - now`). Accept / Decline buttons. Decline opens modal for optional reason.
  - **Active Services card**: lists `status='active'` allocations. "Request to Vacate" button opens confirm modal with optional reason.
  - **History tab**: all allocations in terminal or non-current states in chronological order.
- Route registered at `/my/campus-services` or equivalent student-scoped path.
- `admin-portal/src/services/campus.ts` adds `fetchMyAllocations`, `acceptAllocation`, `declineAllocation`, `requestVacate` hooks.
- React Query invalidates on mutation so UI stays fresh.
- Manual verification: student logs in → sees 2 pending proposals → accepts hostel (fees appear on their fee page; confirm via existing finance page) → declines transport (history shows declined).

**Context:** OQ-3 from plan (§10) — confirm whether the admin-portal serves student users or if a separate portal exists. If admin-portal is the only frontend, this page lives there under a student-role guard.

---

### Task 19: Student dashboard widget
**Type:** Code → captain-tdd
**Status:** Pending
**Depends On:** 18

**Acceptance Criteria:**
- Student dashboard page (existing) gets a new widget: "You have N pending campus service proposals" that links to the Campus Services page.
- Widget only shown when `N > 0`.
- Fetches via `useQuery` on `/mine?status=proposed` count.
- Responsive to React Query invalidation (disappears immediately after student accepts/declines all pending).

**Context:** Small, focused task. Depends on T18 because the destination page must exist.

---

### Task 20: API reference documentation
**Type:** Doc → captain-spec direct
**Status:** Pending
**Depends On:** 8, 9, 10

**Outline:**
- **Audience:** Backend API consumers (frontend developers, integration partners, future maintainers).
- **Format:** Markdown under `backend/docs/api/campus-allocations.md`.
- **Sections:**
  1. Overview — what the propose→accept flow is and when to use which endpoint
  2. State Machine diagram (copy from spec §6)
  3. Endpoint reference per route — path, method, role, request body, response body, error codes
  4. Common error responses (401 / 403 / 409 `invalid_transition`, `capacity_full`)
  5. Idempotency semantics (accept is idempotent; withdraw/decline/expire are not)
  6. Feature flag notes — behavior differs when `FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS=false`
- **Source of truth:** spec §5 (acceptance criteria), plan §2 (API design), Zod schemas from `validation.ts`.
- **Verification:** doc includes at least one example request + response per endpoint; reviewer can exercise the endpoint from the doc alone.

---

## Spec-to-Task Traceability

| Spec Section | Covered By Tasks |
|---|---|
| §5.1 Admission workflow | 12 |
| §5.2 State machine | 3, 4, 5, 6, 7 |
| §5.3 Fee integration | 3, 5, 7 |
| §5.4 Capacity & waitlist | 3, 4, 6 |
| §5.5 Expiry job | 13 |
| §5.6 Notifications | 3 (via recordTransition), 4–7, 13 |
| §5.7 RBAC | 11 |
| §5.8 Student portal view | 18, 19 |
| §7 Data model changes | 1 |
| §9 Edge cases (EC-1…EC-8) | 3, 5, 7, 12 |
| §11 Success metrics | observability in 13 + audit log queries |

All 27 acceptance criteria in spec §5 trace to at least one task. All 8 edge cases in spec §9 trace to at least one task.

---

## Changelog
- **2026-04-17** — Initial task list created from spec v1 + plan v1.

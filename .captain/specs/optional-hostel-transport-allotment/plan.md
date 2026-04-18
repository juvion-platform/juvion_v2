# Plan: Optional Hostel & Transport Allotment

**Stack:** Node 20 + TypeScript 5.6 (strict) · Express 4 · Mongoose 8 · Zod 3 · BullMQ 5 · ioredis · Vitest 4 · React 19 + React Query 5 (admin-portal)
**Created:** 2026-04-17
**Spec:** `.captain/specs/optional-hostel-transport-allotment/spec.md`

---

## 1. Architecture

This feature slots into the existing M08 Campus Ops module. No new top-level module, no new route prefix, no new npm dependencies.

### 1.1 Component Map

```
backend/src/modules/campus-ops/
  ├── hostel-service.ts          [MODIFY] — extend with propose/accept/decline/vacate lifecycle
  ├── mess-transport-service.ts  [MODIFY] — same lifecycle for transport
  ├── allocation-lifecycle.ts    [NEW]    — shared helpers: state transition validator,
  │                                          audit helper, notification emitter, fee trigger,
  │                                          expiry queue producer
  ├── controller.ts              [MODIFY] — wire new endpoints
  ├── routes.ts                  [MODIFY] — add 16 new routes, attach RBAC
  └── validation.ts              [MODIFY] — Zod schemas for each new endpoint

backend/src/modules/admissions/
  └── workflow.handlers.ts       [MODIFY] — replace auto-create with propose-create
                                            (lines 1163–1310 block)

backend/src/modules/welfare/
  └── service.ts                 [MODIFY] — update list/stats to filter by status where
                                            needed; deprecate raw .create() at lines 157, 332

backend/src/models/
  ├── welfare/HostelAllocation.ts       [MODIFY] — extend enum, add propose metadata
  ├── welfare/TransportAllocation.ts    [MODIFY] — same
  └── campus/CampusConfig.ts            [MODIFY] — add proposalTtlDays fields

backend/src/shared/rbac/
  └── defaults.ts                [MODIFY] — add ST-TRANSPORT-OFFICER persona policies

backend/src/shared/jobs/
  └── proposal-expiry-worker.ts  [NEW]    — BullMQ worker that sweeps expired proposals

backend/src/server.ts            [MODIFY] — register the new queue at startup

admin-portal/src/pages/campus/
  ├── HostelAllocations.tsx      [MODIFY] — add Propose / Withdraw / Promote / Approve-Vacate
  └── TransportAllocations.tsx   [MODIFY] — same

admin-portal/src/pages/student/
  └── CampusServices.tsx         [NEW]    — student's "My Campus Services" page with
                                            pending proposals + history tabs

admin-portal/src/services/
  └── campus.ts                  [MODIFY] — client functions for the 16 new endpoints

backend/src/seed.ts              [MODIFY] — update seed data to use new statuses
```

### 1.2 The `allocation-lifecycle.ts` helper (key design decision)

**Why a shared helper:** hostel and transport flows are semantically identical (propose → accept/decline/withdraw/expire; active → vacate-request → vacated). Duplicating the logic twice invites drift. One helper, parameterized by a "flow type" enum, keeps them honest.

**Key exports:**

```ts
export type AllocationFlow = 'hostel' | 'transport';

// Validate a requested state transition against the state machine.
// Throws AppError(409) if invalid.
export function assertValidTransition(
  flow: AllocationFlow,
  current: string,
  next: string,
): void;

// Write audit log, emit notification, optionally create fee line item.
// Used on every transition.
export async function recordTransition(params: {
  flow: AllocationFlow;
  collegeId: string;
  allocation: IHostelAllocation | ITransportAllocation;
  fromStatus: string;
  toStatus: string;
  action: string;              // 'propose' | 'accept' | 'decline' | ...
  performedBy: string;
  reason?: string;
  notifyStudent?: boolean;
  notifyAdmin?: boolean;
  triggerFee?: boolean;        // only true on transition to 'active'
}): Promise<void>;

// Reusable capacity check for hostel rooms and transport routes.
export async function checkCapacity(
  flow: AllocationFlow,
  collegeId: string,
  targetId: string,            // roomId or routeId
  stopName?: string,           // transport only
): Promise<{ available: number; capacity: number; liveCount: number }>;

// Compute expiresAt = proposedAt + ttlDays (reads CampusConfig).
export async function computeExpiry(
  flow: AllocationFlow,
  collegeId: string,
): Promise<{ expiresAt: Date; ttlDays: number }>;
```

Services (`hostel-service.ts`, `mess-transport-service.ts`) become thin wrappers that call the helper and persist the document. They own *their* model; the helper owns *the lifecycle*.

### 1.3 Data Flow: Propose → Accept (happy path)

```
Warden clicks Propose
  → POST /api/campus/hostel/allocations/propose
    → controller validates with Zod, checks RBAC
      → hostel-service.proposeHostelAllocation()
        1. checkCapacity()                         ← allocation-lifecycle
        2. computeExpiry()                         ← allocation-lifecycle
        3. HostelAllocation.create({ status: 'proposed', expiresAt, ... })
        4. recordTransition()                      ← writes audit, emits notification
  ← 201 { allocation }

Student clicks Accept
  → POST /api/campus/hostel/allocations/:id/accept
    → controller: RBAC selfOnly check
      → hostel-service.acceptHostelProposal()
        1. Load allocation, assert status === 'proposed'
        2. assertValidTransition('hostel', 'proposed', 'active')
        3. BEGIN transaction:
           a. allocation.status = 'active'; allocation.respondedAt = now; save
           b. Decrement room capacity (HostelRoom.occupancy++)
           c. Create FeeLineItem via fee-helper
           d. recordTransition(triggerFee: true, notifyStudent: true)
           END transaction
  ← 200 { allocation, feeLineItem }
```

### 1.4 Transaction boundaries

MongoDB doesn't have implicit transactions; Mongoose supports them explicitly via sessions (requires a replica set — Mongo 7 in your compose runs as a single-node RS by default). Use `mongoose.startSession()` + `session.withTransaction()` for:

- **Accept flow**: status update + room occupancy decrement + fee line item must be atomic. Otherwise a partial failure leaves a student marked `active` without a fee, or a room decremented without an allocation.
- **Vacate approval**: status update + room occupancy increment + clearance status update must be atomic.
- **Waitlist promotion**: withdraw-candidate + new-proposal creation should be atomic only if we're moving the same document (we are — just status change + `expiresAt` refresh), so a single `findOneAndUpdate` with session.

Everything else (propose, decline, withdraw, expire, request-vacate) is a single-document write; no transaction needed.

### 1.5 Concurrency on capacity

**The race:** two wardens propose different students to the same last bed at the same time. Without protection, both proposals succeed; on first accept, room goes to `capacity+1`.

**Mitigation:** the capacity check includes *live* `proposed` + `active` + `waitlisted` counts. At `propose` time, use `findOneAndUpdate` on `HostelRoom` with a condition `{ $where: 'this.occupancy + this.reservedCount < this.capacity' }` and atomically increment a `reservedCount` counter, or — simpler — do a transaction that (a) counts live proposals for the room, (b) creates the proposal, and rolls back if the count would exceed capacity.

I'll go with the **transactional count-then-insert** approach. It's clearer than a reserved-count counter and avoids the "reserved but never accepted leaks forever" bug.

### 1.6 Expiry job

A single BullMQ queue `campus:proposal-expiry` with one worker. The worker runs every 15 minutes (via a recurring/`repeat` job registered at server boot). On each run:

1. Query `HostelAllocation.find({ status: 'proposed', expiresAt: { $lte: new Date() } })`.
2. For each: call `recordTransition(status='expired')`.
3. Same for `TransportAllocation`.

Using a recurring BullMQ job rather than a cron-in-Node keeps scheduling out of process memory and resilient across restarts. `QUEUE_NAMES` in `shared/queue/QueueManager.ts` gets a new entry `CAMPUS_PROPOSAL_EXPIRY`.

---

## 2. API Design

All routes live under `/api/campus` (M08). Standard controller pattern (thin, try/catch, delegate to service). All require `authenticate` middleware. Role restrictions enforced via RBAC `requirePermission` middleware.

### 2.1 Admin-side (Warden / Transport Officer / Super-admin)

```
POST   /api/campus/hostel/allocations/propose
       body: { studentId, roomId, bedId?, academicYearId, preferences?, specialNeeds?, forceWaitlist?: boolean }
       201 → { allocation } | 409 { error: 'capacity_full', canWaitlist: true }

POST   /api/campus/hostel/allocations/:id/withdraw
       body: { reason: string }
       200 → { allocation }

POST   /api/campus/hostel/allocations/:id/promote
       body: {}
       200 → { allocation } (waitlisted → proposed, TTL reset)

POST   /api/campus/hostel/allocations/:id/approve-vacate
       body: { clearanceNotes?: string }
       200 → { allocation, clearance }

POST   /api/campus/hostel/allocations/:id/reject-vacate
       body: { reason: string }
       200 → { allocation }
```

Same 5 endpoints mirrored under `/api/campus/transport/allocations/*` for the transport flow.

### 2.2 Student-side

```
POST   /api/campus/hostel/allocations/:id/accept
POST   /api/campus/hostel/allocations/:id/decline         body: { reason?: string }
POST   /api/campus/hostel/allocations/:id/request-vacate  body: { reason?: string }
GET    /api/campus/hostel/allocations/mine                200 → { items, pendingCount, activeCount }
```

Same mirrored under `/api/campus/transport/allocations/*`.

### 2.3 Existing list/detail routes

Unchanged. They already filter by `collegeId` and use `paginate`. Callers should add optional `?status=proposed,waitlisted` query param support.

### 2.4 Validation (Zod)

One schema per endpoint in `campus-ops/validation.ts`. Example:

```ts
export const proposeHostelSchema = z.object({
  body: z.object({
    studentId: z.string().length(24),
    roomId: z.string().length(24),
    bedId: z.string().length(24).optional(),
    academicYearId: z.string().length(24),
    preferences: z.object({
      blockPreference: z.string().optional(),
      floorPreference: z.number().optional(),
      roomTypePreference: z.string().optional(),
    }).optional(),
    specialNeeds: z.object({
      accessibility: z.boolean().optional(),
      medical: z.string().optional(),
    }).optional(),
    forceWaitlist: z.boolean().optional(),
  }),
});
```

---

## 3. Database Changes

All changes are **additive** (new fields, enum extensions). No renames or removals. This keeps the migration one-way-safe: old code reading these models still works, because it ignores the new fields.

### 3.1 HostelAllocation schema delta

| Field | Type | Purpose |
|---|---|---|
| `status` | enum — **extend** | add `'proposed' \| 'waitlisted' \| 'vacate_requested' \| 'cancelled' \| 'declined' \| 'withdrawn' \| 'expired'` |
| `proposedBy` | `ObjectId (ref Person)` | admin who created proposal |
| `proposedAt` | `Date` (default now) | proposal timestamp |
| `respondedAt` | `Date?` | when student accepted/declined |
| `respondedBy` | `ObjectId? (ref Person)` | student who responded |
| `ttlDays` | `number` | captured from config at propose time |
| `expiresAt` | `Date?` (indexed) | `proposedAt + ttlDays`, used by expiry job |
| `withdrawReason` | `string?` | admin-provided reason |
| `declineReason` | `string?` | student-provided reason |
| `vacateRequestedAt` | `Date?` | when student requested vacate |
| `vacateApprovedBy` | `ObjectId? (ref Person)` | admin who approved vacate |
| `allocationMethod` | enum — **extend** | add `'admin_proposed'` |

New index: `{ collegeId: 1, status: 1, expiresAt: 1 }` (for expiry job).

**Default change:** `status` default changes from `'active'` → `'proposed'`. All new records go through proposal. Existing records are unaffected.

### 3.2 TransportAllocation schema delta

Same metadata fields as HostelAllocation, plus:

| Field | Type | Purpose |
|---|---|---|
| `status` | enum — **extend** | `'proposed' \| 'waitlisted' \| 'vacate_requested' \| 'declined' \| 'withdrawn' \| 'expired'` (cancelled already exists) |
| `waitlistPosition` | `number?` | same as hostel |

Note: transport uses `cancelled` not `vacated` (existing semantic). Keep it.

### 3.3 CampusConfig schema delta

```ts
// hostel sub-doc: add
proposalTtlDays: { type: Number, default: 7 }

// transport sub-doc: add
proposalTtlDays: { type: Number, default: 7 }
```

### 3.4 Migration script for existing data

One-time script at `backend/src/migrations/2026-04-optional-allotment.ts`:

```ts
// Step 1: any HostelAllocation/TransportAllocation with status === 'active' gets:
//   proposedAt = createdAt, respondedAt = createdAt, respondedBy = studentId
//   (retrofit: we assume they "accepted" at creation in the pre-change world)
// Step 2: CampusConfig: set proposalTtlDays = 7 where missing (automatic via default)
// Step 3: leave 'vacated', 'cancelled', 'transferred' records untouched
```

Run via `npm run migrate -w backend` (new script to add to `package.json`). Idempotent (skips records that already have `proposedAt`).

### 3.5 Seed data

`seed.ts` lines 803–813 currently create `active` allocations directly. Update to use the new `proposeHostelAllocation` + `acceptHostelProposal` service calls so seed data matches production flow. Or: seed with `status: 'active'` but also populate `proposedAt`/`respondedAt`/`respondedBy` so the data looks realistic.

---

## 4. RBAC

### 4.1 New persona: `ST-TRANSPORT-OFFICER`

Add to `shared/rbac/defaults.ts`:

```ts
{ role: 'staff', personaType: 'ST-TRANSPORT-OFFICER', module: 'campus', action: '*',
  effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'transport' },
  description: 'Transport Officer: transport allocations and routes' },
```

### 4.2 Warden scope extension

Existing `ST-WARDEN` policy is scoped `{ subDomain: 'hostel,mess' }` on the `welfare` module. Since hostel allocation endpoints live on the `campus` module route prefix (`/api/campus/hostel/...`), we need either:

**Option A** — add a parallel warden policy on `campus` module:
```ts
{ role: 'staff', personaType: 'ST-WARDEN', module: 'campus', action: '*',
  effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'hostel' },
  description: 'Warden: hostel sub-domain of campus ops' },
```

**Option B** — move allocation routes under `/api/welfare/*`.

**Choose A.** Rationale: the allocation lifecycle belongs with campus operations (it interacts with HostelRoom, HostelBed, HostelClearance — all in `campus/`), and your existing `hostel-service.ts` is already in `modules/campus-ops/`. Moving routes would mean moving code. Easier to extend the policy.

### 4.3 Student scope

Existing policy: `{ role: 'student', module: 'welfare', action: 'read', scope: { selfOnly: true } }`. Need an equivalent on `campus` module:

```ts
{ role: 'student', module: 'campus', action: 'read', effect: 'allow',
  priority: 600, isActive: true, scope: { selfOnly: true },
  description: 'Student: read own campus services' },
{ role: 'student', module: 'campus', action: 'update', effect: 'allow',
  priority: 600, isActive: true, scope: { selfOnly: true, subDomain: 'hostel-allocation,transport-allocation' },
  description: 'Student: accept/decline/vacate own allocations' },
```

The controller enforces `selfOnly` by checking `allocation.studentId === req.user.studentId` on every student-scoped action.

---

## 5. Frontend (admin-portal)

### 5.1 Admin screens

Existing `HostelAllocations.tsx` and `TransportAllocations.tsx` pages become capacity+action dashboards:

- **List view**: table of allocations with filter chips (`Proposed`, `Waitlisted`, `Active`, `Vacate Requested`, `Terminal`). Default filter = `Proposed + Waitlisted + Active + Vacate Requested`.
- **Actions per row** (rendered conditionally by status):
  - `proposed` / `waitlisted` → **Withdraw** (modal with reason)
  - `waitlisted` → **Promote** (confirm modal)
  - `vacate_requested` → **Approve Vacate** / **Reject Vacate**
- **New Propose modal**: student picker, room/route picker, preferences, shows "Capacity: X/Y" live; if capacity full, modal offers "Add to Waitlist."
- **History tab**: all terminal-status allocations for audit.

### 5.2 Student screens

New page: `admin-portal/src/pages/student/CampusServices.tsx`.

- **Pending Proposals card** at top: shows hostel + transport proposals awaiting response. TTL countdown per card. Big Accept / Decline buttons.
- **Active Services card**: current hostel + transport. "Request to Vacate" button with confirm modal.
- **History tab**: chronological list.

Plus a dashboard widget: "You have N pending campus service proposals" linking to the page.

### 5.3 Client services

`admin-portal/src/services/campus.ts` adds 16 functions corresponding to the 16 new endpoints. Standard React Query `useMutation` / `useQuery` pattern.

---

## 6. Dependencies

### 6.1 Internal, no version bump needed
- `bullmq@5` (for expiry queue)
- `mongoose@8` (for transactions — requires single-node RS, which `docker-compose.yml` already provides)
- `zod@3` (for validation)
- Existing `shared/audit.ts`, `shared/pagination.ts`, `shared/rbac/*`, `shared/queue/*`
- Existing `Notification` model, `HostelClearance` / `TransportClearance` models, `FeeLineItem` model

### 6.2 New npm packages
**None.** Everything needed is already in the tree.

### 6.3 Infrastructure
- Redis must be running for the expiry queue. Already in `docker-compose.yml`.
- MongoDB must be running as a replica set for transactions. Already the case with Mongo 7.

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **R-1** Status enum extension breaks existing code that assumes 3 values | High | High | Audit every `status ===` / `status: { $in: [...] }` usage before merge. The migration script flags them. Add a compile-time type `HostelAllocationStatus = z.infer<typeof statusEnum>` so TypeScript catches drift. |
| **R-2** Admission workflow regression — existing onboarding breaks | Med | Critical | Keep workflow step logic wrapped in feature flag during rollout (`config.features.optionalAllotmentProposals`). Default `false` in dev/test, flip to `true` after migration. All new tests run with flag=true; legacy tests continue to pass with flag=false. |
| **R-3** Race condition: two admins propose same bed | Low | High | Transactional check-then-insert (§1.5). E2E test simulates concurrent requests. |
| **R-4** Expiry job runs multiple times and double-expires | Low | Med | Use `findOneAndUpdate({ status: 'proposed', expiresAt: { $lte: now } }, { status: 'expired' })` — atomic; only one updater wins. |
| **R-5** Migration script creates inconsistent data if interrupted | Med | High | Script is idempotent (resume-safe). Back up DB before running. |
| **R-6** BullMQ worker missed jobs during Redis restart | Low | Low | BullMQ persists to Redis AOF. On worker restart, it replays. Expiry is not time-critical (a few minutes' delay on marking a proposal expired is fine). |
| **R-7** Student receives stale in-app notification (proposal already expired) | Med | Low | Student-side accept/decline endpoints re-check status and return 409 if state has moved on. UI handles gracefully ("This proposal has expired"). |
| **R-8** Transport fee amount unknown at accept time (no fee structure configured) | Med | Med | If no matching `FeeStructure` for `(academicYearId, component='transport_fee')`, create `FeeLineItem` with `amount: 0` and `status: 'pending'` + flag `needsManualAmount: true`. Finance can backfill. Log warning. |
| **R-9** `ST-WARDEN` policy change collides with legacy welfare policy (duplicate grants) | Low | Low | Additive — both grants allow the same persona. Priority identical. No contradiction. |
| **R-10** Seed data mismatch: tests may rely on status='active' | High | Med | Update seed to populate `proposedAt`/`respondedAt`/`respondedBy` for each `active` record. Existing unit tests see the same effective state; new lifecycle tests get clean data. |

**Hardest technical part:** **R-3 concurrency on capacity**, followed by **R-1 enum extension audit**. Front-load both — Task 1 is schema + enum audit, Task 2 is the transactional capacity helper with its unit tests. Everything else depends on those being right.

---

## 8. Rollout Strategy

1. **Feature flag** `features.optionalAllotmentProposals` in the existing config service (add if missing). Default `false`.
2. **Merge in stages** — all backend changes (schema, services, endpoints, expiry worker) behind the flag. Workflow integration kicks in only when flag is on.
3. **Dev/staging verification** with flag on, realistic seed data, full E2E.
4. **Data migration** run once on production Mongo (low-traffic window; 5-minute runtime estimate for <100k allocations).
5. **Flip flag** on in production. Monitor metric M-1 (100% of new allocations pass through `proposed`) for 24h. Roll back by flipping flag off if it misbehaves (code supports both flows simultaneously).

---

## 9. Observability

- **Metrics** (logged via existing `console.log` + audit log queries; can be graphed later):
  - Count of proposals by status per day (dashboard query on audit log).
  - Median `proposedAt → respondedAt` gap (measures student responsiveness).
  - Expiry count per day.
  - Waitlist depth per room / route.
- **Alarms** (invariants, alerted via existing error log):
  - `FeeLineItem` exists for a non-`active` allocation (alert fires, never should happen).
  - Allocation has `status='active'` but no `respondedAt` (alert fires; migration bug).
  - Expiry job hasn't run in > 30 min (dead worker).
- **Logging**: every state transition logs `{feature: 'optional-allotment', flow, allocationId, from, to, performedBy}` at `info`. Transition failures log at `warn`.

---

## 10. Open Questions (defer to implementation)

- **OQ-1:** Does the `FeeStructure` model support lookup by `component` string? Need to confirm schema before wiring `createFeeLineItem`. If not, the Fee task becomes "extend FeeStructure + service lookup."
- **OQ-2:** Is `req.user.studentId` populated by `authenticate` middleware for student requests? Need to check `middleware/auth.ts`. If only `req.user.personId`, we'll resolve `Student` in the controller.
- **OQ-3:** Student accept/decline UI — does the admin-portal already have a "student persona" mode, or is this accessed through a separate student portal? (CLAUDE.md mentions only `admin-portal`. Investigate before Task 12.)
- **OQ-4:** Does `HostelBed` have a `status` field we also need to toggle on accept? Schema wasn't read during planning.
- **OQ-5:** Should waitlist promotion be automatic (job-driven when capacity frees) or purely manual (admin clicks Promote)? Spec says manual. Plan affirms manual. If product later wants auto, it's a small patch.

---

## 11. Review Checklist (self-scored)

- [x] Works with existing architecture — yes, slots into M08 with no new modules
- [x] No new dependencies — confirmed
- [x] Hardest part identified — R-3 concurrency + R-1 enum audit, front-loaded in tasks
- [x] Failure mode visible — observability section lists metrics and alarms
- [x] Every spec point addressed — cross-checked:
  - AC-01 through AC-27 all have corresponding plan components
  - EC-1 through EC-8 all mitigated via transactions, idempotency, or feature flag
  - Non-goals respected (no refund logic, no rollover, no email/SMS)

---

## 12. Changelog

- **2026-04-17** — Initial plan drafted against spec v1.

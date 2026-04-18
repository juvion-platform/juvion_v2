# Spec: Optional Hostel & Transport Allotment

**Feature slug:** `optional-hostel-transport-allotment`
**Owner:** srinivasarao.kandula@mediamint.com
**Phase:** 1 — Specify
**Created:** 2026-04-17

---

## 1. Problem Statement

Today, the admission workflow (`backend/src/modules/admissions/workflow.service.ts`, lines 1170–1250) **auto-creates active `HostelAllocation` and `TransportAllocation` records** the moment an applicant record has `hostelRequired === true` / `transportRequired === true`. A room is picked, a bed is filled, the allocation is live.

This is wrong for two reasons:
1. **No consent gate.** The student never actively accepts the assignment. They may not want the room/route they were given, may have changed their mind, or may have never truly wanted hostel/transport in the first place.
2. **No opt-in semantics.** Hostel and transport must be *optional allotments* — treated as services the student elects, not services the admission process imposes.

This spec converts both flows into **admin-initiated proposals with mandatory student consent**, while keeping hostel and transport as two independent, parallel flows (a student may accept one and decline the other).

---

## 2. Goals

- Convert every path that creates a hostel/transport allocation (admission workflow + any future mid-year path) into a **propose → accept** flow.
- Give students a clear consent gate in their portal: **accept** or **decline** each proposal.
- Preserve auditability: every state transition is logged.
- Preserve existing clearance logic for vacating (reuse `HostelClearance` / `TransportClearance`).

## 3. Non-Goals (Explicit "NOT for v1")

- **Refund calculation on vacate/cancel.** Vacate flags "fee settlement needed" on the clearance record; finance resolves manually. Automated refund rules are a later feature.
- **Year rollover.** `active` allocations do not auto-expire at academic-year-end. v1 assumes allocations persist until explicitly vacated. Batch rollover (auto-expire + auto-re-propose for the next AY) is a separate future feature.
- **Email / SMS / WhatsApp notifications.** v1 uses in-app `Notification` records only (`channel: 'app'`). Multi-channel delivery is a platform-wide concern handled elsewhere.
- **Non-student allotments.** Faculty/staff hostel/transport is out of scope.
- **Mess allocation.** Although mess is in the same campus-ops domain, this spec only covers `HostelAllocation` and `TransportAllocation`.
- **Student-initiated first proposal.** Students cannot create their own proposal in v1. Only warden / transport officer / super-admin can propose. (Students can only accept, decline, or request vacate.)

---

## 4. User Journeys

### 4.1 Applicant → Admitted Student (admission-driven proposal)

1. Applicant fills admission form, sets `hostelRequired=true` (and/or `transportRequired=true`).
2. Admission workflow completes onboarding steps; at the M08 Campus Services step, instead of creating an `active` allocation, it creates a **`proposed`** `HostelAllocation` and/or `TransportAllocation` with a resolved room/route.
3. Workflow step is marked `completed` — the proposal exists and awaits the student's response. (Previously, failure to allocate was a `failed` step; now the step succeeds when a proposal is created.)
4. Student logs into portal, sees proposals on dashboard (badge count + notification).
5. Student clicks into the proposal, sees details (block, room number, roommates if any; or route, stop, boarding time).
6. Student **accepts** → allocation transitions to `active`, `FeeLineItem` created for the fee component.
   — OR —
   Student **declines** → allocation transitions to `declined`, room/seat is released back to capacity pool.
7. If student does not respond within TTL (default 7 days), proposal transitions to `expired`. Room/seat is released. Admin is notified and may re-propose.

### 4.2 Mid-year proposal (admin-initiated, post-admission)

1. Hostel Warden or Transport Officer opens the campus-ops propose screen, filters by student.
2. Admin selects a student, selects room / bed (or route / stop), optionally adds notes.
3. If target room/route has capacity → proposal is created directly (`status: 'proposed'`).
   If capacity is exhausted → admin is prompted: "Capacity full. (a) Cancel (b) Add to waitlist." Choosing waitlist creates `status: 'waitlisted'` with `waitlistPosition`.
4. Student receives in-app notification; flow from step 4 in 4.1 onward.
5. **Waitlist promotion**: when capacity frees up, admin (or a background job) promotes `waitlisted` → `proposed`. TTL clock starts at promotion, not at waitlist creation.

### 4.3 Student-initiated vacate (after `active`)

1. Student opens their active hostel/transport allocation → clicks "Request to Vacate."
2. System creates a `HostelClearance` / `TransportClearance` record with status `pending` (already-existing models).
3. Allocation transitions to `vacate_requested` (new sub-state of `active`, or separate status — see §6).
4. Warden / Transport Officer reviews, completes clearance checklist (dues, keys, damage, etc.), and approves.
5. On approval: allocation transitions to `vacated` / `cancelled`; room/seat capacity is released; clearance record marks "fee settlement needed" for finance.
6. If warden rejects clearance: allocation returns to `active`; student is notified with reason.

### 4.4 Admin withdraws a pending proposal

1. Warden / Transport Officer opens a `proposed` or `waitlisted` allocation.
2. Clicks "Withdraw Proposal" with a required reason (free text).
3. Allocation transitions to `withdrawn`; room/seat released.
4. Student is notified.

### 4.5 Re-proposal after decline / expire / withdraw

1. Admin can create a new proposal for the same student at any time — same room/route, or different.
2. No rate limit, no cooldown. Full history visible to both admin and student.

---

## 5. Acceptance Criteria

Each bullet is independently testable.

### 5.1 Admission workflow (modification to existing code)

- AC-01: Given an applicant with `hostelRequired=true`, when admission workflow runs, then a `HostelAllocation` is created with `status='proposed'` (not `'active'`), and no `FeeLineItem` is created.
- AC-02: Given an applicant with `hostelRequired=true` but no room has capacity, when workflow runs, then no allocation is created, the workflow step is marked `failed` with reason `no_capacity`, and admin is notified.
- AC-03: Same as AC-01 and AC-02 for transport (routeless → `failed`).
- AC-04: Given an applicant with `hostelRequired=false`, no `HostelAllocation` is created (workflow step `skipped`). Same for transport.
- AC-05: Creating a `proposed` allocation **does not** decrement room capacity or bed count. Capacity is "reserved" in-memory by the service when computing open slots but not persisted until `active`.

### 5.2 Allocation state machine

- AC-06: A `proposed` allocation can transition to: `accepted` (by student), `declined` (by student), `withdrawn` (by admin), `expired` (by TTL job).
- AC-07: An `accepted` allocation immediately transitions to `active` (they collapse into one action — student sees "Accept," system writes `status='active'`).
- AC-08: An `active` allocation can transition to: `vacate_requested` (by student), `vacated` / `cancelled` (by admin, after clearance).
- AC-09: A `waitlisted` allocation can transition to: `proposed` (by admin promotion), `withdrawn` (by admin).
- AC-10: Any other state transition is rejected with a 409 Conflict and a descriptive error.
- AC-11: Every state transition writes an `AuditLog` entry with `entityType: 'HostelAllocation' | 'TransportAllocation'`, `action` describing the transition (e.g., `'propose'`, `'accept'`, `'decline'`, `'withdraw'`, `'expire'`, `'vacate_request'`, `'vacate_approve'`, `'vacate_reject'`, `'waitlist_promote'`), and `performedBy`.

### 5.3 Fee integration

- AC-12: When a proposal transitions to `active` (student accepts), a `FeeLineItem` is created with `component: 'hostel_fee'` or `'transport_fee'`, `academicYearId` matching the allocation, amount from the linked fee structure, `dueDate` per the fee structure rules, `status: 'pending'`. `TransportAllocation.feeTriggered` flag set to `true`.
- AC-13: When a proposal is `declined`, `expired`, `withdrawn`, or in `waitlisted` state, no `FeeLineItem` is created.
- AC-14: When an `active` allocation is `vacated` / `cancelled`, the `HostelClearance` / `TransportClearance` record is marked with `feeSettlementPending: true`. **No automatic refund or fee adjustment** happens in v1.

### 5.4 Capacity & waitlist

- AC-15: At proposal creation, if target room has `currentOccupancy >= capacity` (minus all live `proposed`/`active` counts for that room), admin receives a 409 with choice `{ "action": "waitlist" | "cancel" }`. Re-submitting with `action: 'waitlist'` creates `status: 'waitlisted'` with next integer `waitlistPosition`.
- AC-16: When a room frees up (an `active` → `vacated`, or a `proposed` → `declined`/`expired`/`withdrawn`), the oldest `waitlisted` allocation for that room surfaces on admin dashboard as "ready to promote." Admin manually clicks "Promote" → `waitlisted` → `proposed`; TTL clock starts at promotion timestamp.
- AC-17: Transport capacity is computed per route-stop combination (seats on route minus all `active`+`proposed` on that route). Waitlist behaves identically to hostel.

### 5.5 Expiry job

- AC-18: A scheduled job (cron-like, via BullMQ) runs at least once per hour and transitions `proposed` allocations whose `(createdAt + ttlDays)` is in the past to `expired`. Writes audit log with `action: 'expire'`.
- AC-19: TTL value is read from `CampusConfig.hostel.proposalTtlDays` and `CampusConfig.transport.proposalTtlDays`. Default 7 if unset.

### 5.6 Notifications

- AC-20: On every state transition that affects a student (proposed created, proposal withdrawn, proposal expired, vacate approved/rejected, waitlist promoted), a `Notification` record is created with `channel: 'app'`, `targetAudience: 'individual'`, `targetIds: [studentPersonId]`, `type: 'info'` (or `'alert'` for expiry/rejection), and a human-readable `title`/`message`.
- AC-21: On every state transition that requires admin action (proposal expired, waitlist promotion candidate, vacate requested), a `Notification` is sent to the relevant admin role(s).

### 5.7 RBAC

- AC-22: Only users with persona `ST-WARDEN` (or super-admin override) can create/withdraw/promote hostel allocation proposals. Enforced via RBAC policies on the routes.
- AC-23: Only users with the transport-officer persona (persona slug TBD during planning — `ST-TRANSPORT-OFFICER` or similar) or super-admin can create/withdraw/promote transport allocation proposals.
- AC-24: Students can only act on proposals that target their own `studentId`. A student attempting to accept/decline another student's proposal receives 403.
- AC-25: A super-admin role (existing) can act on either flow as an override.

### 5.8 Student portal view

- AC-26: Student dashboard shows a "Pending Proposals" widget listing all `proposed` hostel + transport allocations targeting them. Each shows: service (hostel/transport), details (room number, block / route name, stop), TTL countdown, Accept / Decline buttons.
- AC-27: Student can view history: a chronological list of all their allocations (any status) on a dedicated "My Campus Services" page.

---

## 6. State Machine (authoritative)

```
  [proposed] ──student_accept──> [active] ──student_vacate_request──> [vacate_requested]
       │                              │                                        │
       │                              │                            ┌───admin_reject──┘ (back to active)
       │                              │                            └───admin_approve──> [vacated]/[cancelled]
       ├──student_decline──>     [declined]
       ├──admin_withdraw──>      [withdrawn]
       ├──ttl_expiry──>          [expired]
       │                              │
       └──(created as waitlisted; promoted by admin)──> [proposed]

  [waitlisted] ──admin_promote──> [proposed]
       └──admin_withdraw──> [withdrawn]
```

**Terminal states:** `declined`, `withdrawn`, `expired`, `vacated`, `cancelled`.
**Entry states:** `proposed` (normal creation), `waitlisted` (creation when capacity full and admin chose waitlist).
**Vacated vs Cancelled:** hostel uses `vacated`; transport uses `cancelled` (semantic difference preserved per existing enum).

The `accepted` state is **transient** and collapses into `active` in a single transaction — a user sees "Accept," the database writes `active`. There is no persisted `accepted` state.

---

## 7. Data Model Changes

### 7.1 `HostelAllocation` (`backend/src/models/welfare/HostelAllocation.ts`)

Extend the existing `status` enum:

```ts
// BEFORE
status: { type: String, enum: ['active', 'vacated', 'transferred'], default: 'active' }

// AFTER
status: {
  type: String,
  enum: ['proposed', 'waitlisted', 'active', 'vacate_requested', 'vacated', 'cancelled', 'declined', 'withdrawn', 'expired', 'transferred'],
  default: 'proposed'
}
```

Add fields:
- `proposedBy?: ObjectId (ref Person)` — admin who created proposal
- `proposedAt: Date` — defaults to `Date.now`
- `respondedAt?: Date` — when student accepted/declined
- `respondedBy?: ObjectId (ref Person)` — student who responded
- `ttlDays: number` — captured from config at proposal time
- `expiresAt?: Date` — computed: `proposedAt + ttlDays` (indexed for the expiry job)
- `withdrawReason?: string`
- `declineReason?: string`
- `vacateRequestedAt?: Date`
- `vacateApprovedBy?: ObjectId (ref Person)`

Keep existing: `waitlistPosition`, `allocationMethod` (add `'admin_proposed'` to enum), `preferences`, `specialNeeds`, `matchScore`.

### 7.2 `TransportAllocation` (`backend/src/models/welfare/TransportAllocation.ts`)

Extend the existing `status` enum:

```ts
// BEFORE
status: { type: String, enum: ['active', 'cancelled'], default: 'active' }

// AFTER
status: {
  type: String,
  enum: ['proposed', 'waitlisted', 'active', 'vacate_requested', 'cancelled', 'declined', 'withdrawn', 'expired'],
  default: 'proposed'
}
```

Add same propose/withdraw/vacate metadata fields as `HostelAllocation`, plus `waitlistPosition`.

### 7.3 `CampusConfig` (`backend/src/models/campus/CampusConfig.ts`)

Add to existing `hostel` sub-doc:
- `proposalTtlDays: number` (default 7)

Add to existing `transport` sub-doc (create if missing):
- `proposalTtlDays: number` (default 7)

### 7.4 RBAC (`backend/src/shared/rbac/defaults.ts`)

Confirm or add:
- `ST-WARDEN` persona — already exists, scoped `subDomain: 'hostel,mess'`. Need to allow propose/withdraw/promote actions on `HostelAllocation`.
- `ST-TRANSPORT-OFFICER` persona — **does not currently exist** (`ST-TPO` is Training & Placement Officer). Add new persona. Scoped `subDomain: 'transport'`.
- Super-admin (`ADMIN` / `SUPER_ADMIN` — confirm during planning) gets override on both.

**Persona glossary note (added post-T11):**
- `ST-TPO` = **T**raining & **P**lacement **O**fficer (on `placement` module). Legacy persona.
- `ST-TRANSPORT-OFFICER` = Transport Officer (on `campus` module, subDomain `transport`). **New** in this feature.
These names are similar but slugs are exact-match in RBAC — no collision, but worth flagging for maintainers.

**SubDomain enforcement note (added post-T11):** The RBAC engine doesn't filter by `subDomain`; it returns a matching policy that *carries* the subdomain as a descriptor. Service/controller code (Tasks 8–10) must inspect `authScope.subDomain` and reject cross-subdomain actions — otherwise a warden could call transport endpoints because the `campus` module grant matches.

---

## 8. API Surface (summary — full details in plan)

All routes scoped to `/api/campus` (M08 Campus Ops module):

| Method | Path | Actor | Purpose |
|---|---|---|---|
| POST | `/hostel/allocations/propose` | Warden, SuperAdmin | Create proposal (or waitlist) |
| POST | `/transport/allocations/propose` | Transport Officer, SuperAdmin | Create proposal (or waitlist) |
| POST | `/hostel/allocations/:id/withdraw` | Warden, SuperAdmin | Withdraw a `proposed`/`waitlisted` proposal |
| POST | `/transport/allocations/:id/withdraw` | Transport Officer, SuperAdmin | Same |
| POST | `/hostel/allocations/:id/promote` | Warden, SuperAdmin | Waitlist → proposed |
| POST | `/transport/allocations/:id/promote` | Transport Officer, SuperAdmin | Same |
| POST | `/hostel/allocations/:id/accept` | Student | Proposed → active + fee line item |
| POST | `/transport/allocations/:id/accept` | Student | Same |
| POST | `/hostel/allocations/:id/decline` | Student | Proposed → declined |
| POST | `/transport/allocations/:id/decline` | Student | Same |
| POST | `/hostel/allocations/:id/request-vacate` | Student | Active → vacate_requested + clearance |
| POST | `/transport/allocations/:id/request-vacate` | Student | Same |
| POST | `/hostel/allocations/:id/approve-vacate` | Warden, SuperAdmin | Completes clearance, vacate_requested → vacated |
| POST | `/transport/allocations/:id/approve-vacate` | Transport Officer, SuperAdmin | Same |
| POST | `/hostel/allocations/:id/reject-vacate` | Warden, SuperAdmin | Vacate_requested → active, with reason |
| POST | `/transport/allocations/:id/reject-vacate` | Transport Officer, SuperAdmin | Same |
| GET | `/hostel/allocations/mine` | Student | List own allocations (all statuses) |
| GET | `/transport/allocations/mine` | Student | Same |

Existing list/detail GET routes continue unchanged.

---

## 9. Edge Cases

- **EC-1 — Double-click accept:** idempotent. Repeated `accept` on an already-`active` allocation returns 200 with current state; does not create duplicate fee line items (check existing `FeeLineItem` before creating).
- **EC-2 — Concurrent proposals for same bed:** serialized via optimistic Mongo update with condition on `currentOccupancy`; second proposer receives 409.
- **EC-3 — Student deleted mid-proposal:** proposals for deleted students auto-cancel via cascade (existing soft-delete audit hook).
- **EC-4 — Config missing `proposalTtlDays`:** falls back to 7.
- **EC-5 — Clearance rejected after vacate request:** allocation returns to `active`, student is notified, and the clearance record is closed. They can re-request vacate any time.
- **EC-6 — Admission workflow re-runs:** if a `proposed`/`active` allocation already exists for `(studentId, academicYearId)`, admission workflow does not create a duplicate; step is marked `completed` with existing allocation reference (matches existing behavior at lines 1178 / 1223 of `workflow.service.ts`).
- **EC-7 — Fee line item manually modified after accept:** no special handling. Finance team's responsibility.
- **EC-8 — Waitlisted allocation never promoted:** remains indefinitely; admin can withdraw it. No auto-expiry on waitlist.

---

## 10. Dependencies

### Internal (existing code)
- `backend/src/models/welfare/HostelAllocation.ts` — schema extension
- `backend/src/models/welfare/TransportAllocation.ts` — schema extension
- `backend/src/models/campus/CampusConfig.ts` — add TTL field
- `backend/src/models/campus/HostelClearance.ts` — reuse as-is
- `backend/src/models/campus/TransportClearance.ts` — reuse as-is
- `backend/src/models/communication/Notification.ts` — reuse as-is
- `backend/src/models/finance/FeeLineItem.ts` — reuse as-is
- `backend/src/modules/admissions/workflow.service.ts` — modify lines ~1163–1310 to create proposals instead of active allocations
- `backend/src/modules/campus-ops/hostel-service.ts` — extend with propose/accept/decline/withdraw/promote/vacate functions
- `backend/src/modules/campus-ops/mess-transport-service.ts` — extend similarly for transport
- `backend/src/modules/welfare/service.ts` — update list/stat queries to scope correctly by status
- `backend/src/shared/rbac/defaults.ts` — add Transport Officer persona; extend warden permissions
- `backend/src/shared/audit.ts` — already in use; no change
- `backend/src/shared/pagination.ts` — already in use; no change
- BullMQ infrastructure — exists (per CLAUDE.md); used for the TTL expiry job

### Frontend
- `admin-portal/src/pages/campus/*` — add admin propose/withdraw/promote UIs
- `admin-portal/src/pages/students/*` — student dashboard widget + allocation list page
- `admin-portal/src/services/campus.ts` — new endpoints

### External
- None. No new npm dependencies.

---

## 11. Success Metrics

Measurable post-launch:

- **M-1:** 100% of new hostel/transport allocations pass through `proposed` state before reaching `active` (telemetry: count of allocations with `proposedAt IS NOT NULL` / total new allocations = 100%).
- **M-2:** Median time from `proposed → active` is under 48 hours (students respond quickly when they know).
- **M-3:** Proposal expiry rate (`expired / proposed`) below 10% in first month. Above that implies bad UX (students not seeing the notification).
- **M-4:** Zero fee line items created for non-`active` allocations (invariant; alarm if violated).
- **M-5:** Audit log coverage: every `HostelAllocation`/`TransportAllocation` status transition has a matching audit log entry (1:1). Enforced via test.

---

## 12. Open Questions (resolve before Phase 2)

None. All interview questions (Q1–Q10) were answered and consistency-checked.

---

## 13. Changelog

- **2026-04-17** — Initial spec created after 10-question interview.
- **2026-04-18** — Post-T1/T2/T11 amendments based on implementation feedback:
  - §7.4 RBAC — added persona glossary distinguishing `ST-TPO` vs `ST-TRANSPORT-OFFICER`
  - §7.4 RBAC — added explicit subDomain-enforcement handoff for T8–T10 service layer
  - Noted that green-phase clarifying refactors (e.g., extracting inlined sub-schemas) are permitted — applied to `CampusConfig` in T1
  - T2 Expected State omitted `docker-compose.yml` env addition; deferred to pre-ship checklist (flag default `false` keeps legacy path)
  - Reusable test helper `backend/src/__tests__/helpers/mongoMemory.ts` created in T1; downstream tasks reference it explicitly

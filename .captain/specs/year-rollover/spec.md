# Spec: Year Rollover for Hostel & Transport Allocations

**Feature slug:** `year-rollover`
**Owner:** TBD
**Phase:** 1 — Specify (draft — defaults picked via captain-spec `recommend`; pending user review)
**Created:** 2026-04-18
**Prereq:** `optional-hostel-transport-allotment` feature complete

---

## 1. Problem Statement

The `optional-hostel-transport-allotment` feature (shipped in PR #15) explicitly scoped out academic-year rollover: "v1 assumes allocations persist until explicitly vacated." In practice, colleges have a hard cutover each academic year — students vacate for summer, return, and either re-apply for the same room or move. Without a rollover mechanism:

- Prior-year `active` allocations stay `active` indefinitely, causing capacity reports to double-count
- The `academicYearId` field on each allocation grows stale — students are physically in rooms tied to last year's AY
- Wardens manually recreate allocations for every returning student each July/August — thousands of clicks per college

This feature automates the transition.

## 2. Goals

- At AY-end, every `active` hostel/transport allocation transitions to a terminal state (`rolled_over` or `vacated`, see §6)
- For each returning student with a prior-year allocation, create a **pre-filled `proposed` allocation** for the new AY with the same room/route (student can accept, decline, or request a different room)
- Admin dashboard surfaces rollover status (pending, in-progress, completed) per AY
- Fully configurable per college via `CampusConfig`

## 3. Non-Goals (NOT for v1)

- **Bulk room changes during rollover** — if a college wants to re-shuffle entire blocks, that's a separate batch operation
- **Cross-AY fee rollover** — the existing finance model already tracks fees per AY; this feature just ensures new allocations trigger new AY fees correctly
- **Graduated / dropped students** — only returning students get auto-proposals. Students with `status !== 'active'` on their `Student` doc are skipped. Wardens handle exits manually.
- **Partial-year intake** (new admission mid-year) — continues to use the admission workflow path; rollover only handles existing students

## 4. User Journeys

### 4.1 Admin triggers rollover (planned, bulk)

1. Dean/Registrar navigates to Campus Ops → Year Rollover
2. Selects source AY (last year) and destination AY (new year). Shows preview: "X active hostel + Y active transport allocations will be rolled over. Z returning students will get fresh proposals."
3. Optional: "dry run" — prints the plan without executing
4. Confirm → background job runs:
   - Every source-AY `active` allocation transitions to `rolled_over` (new terminal state)
   - For each eligible student, creates a new `proposed` allocation for destination AY referencing the same room/route, with standard TTL
   - Admin dashboard shows live progress (X of N done)
5. Job completes → admin gets in-app notification with summary: counts, any failures

### 4.2 Student receives rolled-over proposal

1. Login after rollover → sees "N new campus service proposals for AY 2026-27" on dashboard (existing widget)
2. Opens the card: shows the room/route from last year, with a note "This proposal carries your previous assignment into the new academic year. Accept to continue, or decline to request a different one."
3. Accept → same flow as a regular proposal (fee line item, capacity bump, active)
4. Decline → same flow as a regular decline; student is then expected to request a new proposal through their warden

### 4.3 Scheduled rollover (auto)

1. `CampusConfig.yearRollover.mode = 'auto'` + `yearRollover.runDate` (e.g. "2026-07-15")
2. Background BullMQ job fires on that date and runs the same flow as §4.1, performed by a `SYSTEM_ACTOR`
3. Admin gets notified of completion

### 4.4 Student who has graduated

1. Rollover job checks `Student.status` — if not `'active'` (e.g. `'graduated'`, `'dropped'`, `'alumni'`), their allocation transitions to `rolled_over` but no new proposal is created for them
2. Room is freed for the next intake

## 5. Acceptance Criteria

Each bullet independently testable.

### 5.1 Configuration

- AC-01: `CampusConfig.yearRollover` sub-doc with fields: `mode: 'manual' | 'auto'` (default `'manual'`), `runDate?: Date` (required when mode='auto'), `carryOverRoom: boolean` (default `true`), `carryOverRoute: boolean` (default `true`).
- AC-02: `proposalTtlDays` from existing config is respected for the new proposals (spec §5.5 of propose-accept feature).

### 5.2 Rollover execution

- AC-03: A new service function `executeYearRollover(collegeId, fromAcademicYearId, toAcademicYearId, performedBy, opts?)` runs the full rollover.
- AC-04: Each source-AY `active` HostelAllocation transitions to a new terminal state `'rolled_over'`. Audit log entry `{ action: 'rolled_over' }`. Notification to student.
- AC-05: Each source-AY `active` TransportAllocation same treatment, same state name `'rolled_over'`.
- AC-06: For each source-AY allocation where `Student.status === 'active'`: create a new allocation in destination AY with `status='proposed'`, `allocationMethod='year_rollover'`, carrying the same `roomId`/`routeId`+`stopName`, standard TTL/`expiresAt`.
- AC-07: If the target room/route is at capacity in the destination AY (because another propose or rollover already filled it), the new allocation is created as `waitlisted` with appropriate `waitlistPosition`.
- AC-08: Students with `Student.status !== 'active'` are skipped (no new proposal); their prior allocation still transitions to `rolled_over`.
- AC-09: Idempotency: running rollover twice for the same (from, to) pair is a no-op on the second run (skip allocations already transitioned).

### 5.3 API

- AC-10: `POST /api/campus/year-rollover/preview` — returns `{ sourceActiveCount, returningStudentCount, graduatedStudentCount, capacityProjections: { roomId → { capacity, liveCount, wouldOverflow } } }` without side effects
- AC-11: `POST /api/campus/year-rollover/execute` — body `{ fromAcademicYearId, toAcademicYearId, dryRun?: boolean }`. Returns 202 + job ID; actual work runs in background.
- AC-12: `GET /api/campus/year-rollover/status?jobId=...` — returns `{ status, processed, total, errors: [] }` for the background job.

### 5.4 RBAC

- AC-13: Only `super_admin`, `admin`, or `principal` roles can execute rollover. Wardens/transport officers can preview but not execute (they don't have cross-domain authority for AY-wide operations).

### 5.5 Observability

- AC-14: Every rollover run writes a single summary AuditLog entry on `Allocation` entityType with action=`'rolled_over'` and a `changes[]` field carrying counts.
- AC-15: Background job logs structured JSON: `{ event: 'rollover_progress', collegeId, fromAY, toAY, processed, total, elapsedMs }`.

## 6. State Machine Delta

Extends the existing allocation state machine with one new terminal state:

```
(existing) active ──rollover──> [rolled_over]  (terminal)
```

Add to both `HostelAllocation` and `TransportAllocation` status enums. Add `'year_rollover'` to `allocationMethod` (hostel) / `allocationType` (transport) enums.

Add `'rolled_over'` to `AuditAction` union (from PR #18).

## 7. Edge Cases

- **EC-1** Source AY has no active allocations → rollover completes immediately with counts=0. No error.
- **EC-2** Destination AY already has proposed/active allocations (e.g., admin hand-rolled some). Rollover skips students who already have any allocation in dest AY. Preview shows those as "already handled."
- **EC-3** A student's assigned room no longer exists (deleted/maintenance). New proposal creation fails for that one student; job logs the error and continues.
- **EC-4** Background job crashes mid-run. On retry, the `already transitioned` guard from AC-09 makes it safe — processes only the unprocessed tail.
- **EC-5** Auto mode fires on a weekend/holiday. Job runs regardless; admin gets notification Monday.
- **EC-6** `carryOverRoom=false` → rollover still transitions old to `rolled_over`, but doesn't create a new proposal; students must go through regular admin-propose. Same for transport with `carryOverRoute=false`.

## 8. Dependencies

- Existing: `HostelAllocation`, `TransportAllocation`, `CampusConfig`, `Student`, `allocation-lifecycle`, BullMQ queue infrastructure, AuditLog
- New: `CampusConfig.yearRollover` sub-doc, one new BullMQ queue `campus:year-rollover`, one new background job

## 9. Success Metrics

- M-1: After auto-rollover run, 100% of source-AY `active` allocations are in terminal state.
- M-2: Median `proposed → active` time for rollover proposals ≤ 72 hours (students respond in the first 3 days or not at all).
- M-3: Zero double-accounting: count of `active` allocations for source AY is 0 after rollover completes.
- M-4: Zero students with `Student.status === 'active'` left without a destination-AY proposal (unless carryOver flags disabled).

## 10. Open Questions

- OQ-1: What happens if a college skips a year (dormant)? Needs source+dest AY as input, but does the spec need "skip-n-years" semantics? Current proposal: no — a human reruns from the last active AY.
- OQ-2: Notifications during rollover — 1000 students × 2 services × 2 channels (app + email if enabled) = 4000 records per run. Rate-limit needed? Current proposal: no — BullMQ handles backpressure, and notifications are cheap writes.
- OQ-3: Does "rolled_over" show in the student's history view? Current proposal: yes, with a clear label so students see continuity.

## 11. Changelog

- **2026-04-18** — Initial draft via captain-spec `recommend` defaults. Pending interview with the feature owner to confirm choices.

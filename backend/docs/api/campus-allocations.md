# Campus Allocations API Reference

**Feature:** optional-hostel-transport-allotment
**Module:** M08 Campus Ops
**Base path:** `/api/campus`
**Audience:** frontend developers, integration partners, future maintainers

This document covers the 16 endpoints that implement the admin-propose → student-accept flow for hostel and transport allocations. The design and rationale live in `.captain/specs/optional-hostel-transport-allotment/spec.md` and `.captain/specs/optional-hostel-transport-allotment/plan.md`; this file is the contract.

---

## 1. Overview

The old path auto-created `active` `HostelAllocation` and `TransportAllocation` records as part of admission. The new path:

1. An **admin** (Warden / Transport Officer / Super-admin) proposes an allocation.
2. The **student** accepts (→ `active`) or declines (→ `declined`).
3. If unresponsive, the **TTL expiry worker** moves the proposal to `expired` after `proposalTtlDays` (default 7) from `CampusConfig`.
4. Capacity-full rooms/routes can go to a `waitlisted` queue; admin later promotes (→ `proposed`).

### Feature flag

`FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS=true` in the backend env enables the new flow at the admission-workflow handler. Default `false` preserves legacy auto-allocate.

---

## 2. State machine

```
  [proposed] ──accept──> [active] ──request-vacate──> [vacate_requested]
      │                      │                              │
      │                      │                ┌──approve──> [vacated]/[cancelled]
      │                      │                └──reject────> [active]
      ├──decline──> [declined]
      ├──withdraw──> [withdrawn]
      └──ttl-expire──> [expired]

  [waitlisted] ──promote──> [proposed]
       └──withdraw──> [withdrawn]
```

Hostel terminal state is `vacated`; transport is `cancelled`.

Terminal states: `declined`, `withdrawn`, `expired`, `vacated`, `cancelled`, `transferred`.

---

## 3. Endpoints

### 3.1 Admin: Hostel (T8)

#### `POST /api/campus/hostel/allocations/propose`

**Role:** `ST-WARDEN` · `super_admin`
**SubDomain:** `hostel`

Request:
```json
{
  "studentId": "24-char-oid",
  "roomId": "24-char-oid",
  "bedId": "optional-oid",
  "academicYearId": "24-char-oid",
  "preferences": {
    "blockPreference": "string",
    "floorPreference": 2,
    "roomTypePreference": "double"
  },
  "specialNeeds": { "accessibility": true, "medical": "asthma" },
  "forceWaitlist": false
}
```

Responses:
- `201` — proposal created. Body: `{ "allocation": { ... } }`
- `409 capacity_full` — room full, `forceWaitlist=false`. Retry with `forceWaitlist=true` to queue.
- `400` — validation error.
- `403` — caller lacks warden role / wrong subdomain.

#### `POST /api/campus/hostel/allocations/:id/withdraw`
Body: `{ "reason": "string (required)" }`. Moves `proposed | waitlisted → withdrawn`.

#### `POST /api/campus/hostel/allocations/:id/promote`
Body: `{}`. Moves `waitlisted → proposed` (re-issues TTL). Returns 409 if capacity still unavailable.

#### `POST /api/campus/hostel/allocations/:id/approve-vacate`
Body: `{ "clearanceNotes": "optional string" }`. Moves `vacate_requested → vacated`, closes the pending `HostelClearance` as `cleared` with `duesCleared: false` (fee settlement pending).

#### `POST /api/campus/hostel/allocations/:id/reject-vacate`
Body: `{ "reason": "string (required)" }`. Moves `vacate_requested → active`, flips clearance to `blocked`.

### 3.2 Admin: Transport (T9)

Same shape as hostel endpoints, under `/api/campus/transport/allocations/...`.
- Role: `ST-TRANSPORT-OFFICER` · `super_admin`
- SubDomain: `transport`
- Propose body uses `routeId` + `stopName` (+ optional `stopId`, `boardingPoint`) instead of `roomId`/`bedId`.
- Terminal vacate state is `cancelled`.
- Uses `TransportClearance` instead of `HostelClearance`.

### 3.3 Student: Actions (T10)

**Role:** `student` (self-only). Controller verifies `req.user.id === allocation.studentId`.

| Method | Path | Body | Effect |
|---|---|---|---|
| POST | `/hostel/allocations/:id/accept` | `{}` | `proposed → active`, bumps `HostelRoom.currentOccupancy`, creates `FeeLineItem { component: 'hostel_fee' }`. Idempotent. |
| POST | `/hostel/allocations/:id/decline` | `{ "reason"?: string }` | `proposed → declined`. No fee. |
| POST | `/hostel/allocations/:id/request-vacate` | `{ "reason"?: string }` | `active → vacate_requested`, creates pending `HostelClearance`. |
| POST | `/transport/allocations/:id/accept` | `{}` | `proposed → active`, bumps ridership, sets `feeTriggered=true`, creates `FeeLineItem { component: 'transport_fee' }`. |
| POST | `/transport/allocations/:id/decline` | `{ "reason"?: string }` | `proposed → declined`. |
| POST | `/transport/allocations/:id/request-vacate` | `{ "reason"?: string }` | `active → vacate_requested`, creates pending `TransportClearance`. |

### 3.4 Student: My allocations

#### `GET /api/campus/hostel/allocations/mine`
Returns the caller's own hostel allocations (all statuses).

Response:
```json
{
  "items": [ /* HostelAllocation[] sorted by createdAt desc */ ],
  "pendingCount": 1,
  "activeCount": 1
}
```

#### `GET /api/campus/transport/allocations/mine`
Mirror of the hostel endpoint.

---

## 4. Common error responses

| Status | Error code | When |
|---|---|---|
| 400 | Validation failed | Zod schema rejection; `details[]` in body |
| 400 | `College ID required` | JWT missing `collegeId` |
| 401 | No token / Invalid token | Auth failure |
| 403 | Access denied | RBAC reject (role or subdomain mismatch) |
| 403 | You can only act on your own allocation | Student action on another student's allocation |
| 404 | HostelAllocation not found / TransportAllocation not found | ID not found within caller's college |
| 409 | `invalid_transition` | State machine rejects the transition |
| 409 | `capacity_full` | Propose/promote when target is at capacity |

---

## 5. Idempotency semantics

- **Accept** is idempotent. Calling on an already-`active` allocation returns the current state without duplicating the `FeeLineItem`. Safe to retry on network failures.
- **Decline, Withdraw, Request-Vacate, Approve/Reject-Vacate, Promote** are **not** idempotent. Retries against a record whose status has already moved return `409 invalid_transition`. The client should re-fetch and surface the new state to the user.

---

## 6. Feature-flag behavior

| Flag | Admission workflow | Manual propose endpoints |
|---|---|---|
| `true` | Creates `proposed` allocation, student must accept | Unchanged — always available |
| `false` (default) | Legacy auto-`active` allocation | Unchanged — always available |

In either mode, the T8–T10 endpoints operate identically. Turning the flag off simply keeps the admission-time auto-allocate path alive alongside the manual propose path.

---

## 7. Notifications

Every state transition that affects a student creates an in-app `Notification` record with `channel: 'app'`, targeted to the student's `personId`. Admin-relevant transitions (decline, vacate-request, expiry) additionally notify the relevant admin role.

Email/SMS/WhatsApp are **out of scope** for v1 — integrate via the existing `QUEUE_NAMES.NOTIFICATION` path if needed.

---

## 8. Related resources

- Spec: `.captain/specs/optional-hostel-transport-allotment/spec.md`
- Plan: `.captain/specs/optional-hostel-transport-allotment/plan.md`
- Service layer: `backend/src/modules/campus-ops/{hostel-allocation-service.ts, transport-allocation-service.ts, allocation-lifecycle.ts}`
- Worker: `backend/src/shared/jobs/proposal-expiry-worker.ts`
- Migration: `backend/src/migrations/2026-04-optional-allotment.ts`
- Admin UI: `admin-portal/src/pages/campus/AllocationProposalsPage.tsx`
- Student UI: `admin-portal/src/pages/campus/MyCampusServicesPage.tsx`
- Student widget: `admin-portal/src/components/PendingProposalsWidget.tsx`
- Client helpers: `admin-portal/src/services/campus-allocations.ts`

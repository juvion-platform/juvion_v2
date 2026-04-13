# W08 Campus Life Operations -- Implementation Specification

> **Status**: DRAFT | Date: 2026-04-13
> **Scope**: Hostel, Mess, Transport, Library, Labs, Facilities, Maintenance -- lifecycle + ongoing operational workflows
> **Primary Module**: M08 Campus Ops (`/api/campus`)
> **Supporting Modules**: M02 (identity), M04 (finance), M06 (welfare), M10 (compliance), M11 (governance), M12 (platform/AI)
> **Sub-Workflows**: 42 (W08-L2-001 through W08-L2-042)
> **Entity Gap**: 63 required entities, 37 exist -- 26 new models needed

---

## 1. Executive Summary

W08 transforms M08 Campus Ops from a flat CRUD module (37 models, 186 service functions, zero business logic) into a full lifecycle and operations engine across seven sub-domains: Hostel (M08.1), Mess (M08.2), Transport (M08.3), Library (M08.4), Labs (M08.5), Facilities (M08.6), and Maintenance (M08.7).

**Current state**: Every entity has list/get/create/update/delete -- nothing more. No state machines, no inter-entity transitions, no cross-module events, no clearance protocol, no S5 visibility filtering.

**Target state**: 42 sub-workflows with state machine enforcement, AI-assisted allocation algorithms, W01 enrollment provisioning, W10 clearance aggregation, M04 fee triggers, M06 welfare signals, and M10/M11 compliance/governance data feeds.

**Key architectural challenges**:
1. Models are split across three entity groups (`campus/`, `facilities/`, `library/`) plus six welfare-domain models (`welfare/HostelBlock`, `welfare/HostelRoom`, etc.) that must be relocated or referenced from M08
2. W08 requires 26 new models for entities that do not exist (Bed, Hostel Attendance, Hostel Leave, Hostel Violation, Hostel Penalty, etc.)
3. The module must handle college-specific configuration (mess billing model, transport fleet model, library system mode, allocation algorithms) via a config entity
4. S5 visibility (is_hosteler, uses_transport) must gate which sub-domains are visible to each student

---

## 2. Current Codebase State

### 2.1 Model Inventory (37 existing + 6 welfare)

**Entity Group: Campus (EG09) -- 14 models in `backend/src/models/campus/`**

| Model | Fields (abridged) | W08 Relevance |
|-------|-------------------|---------------|
| Building | name, code, floors, totalRooms, isActive | M08.6 Facilities -- reference for facility bookings |
| Room | buildingId, roomNumber, floor, type (classroom/lab/seminar_hall/conference/office/workshop/auditorium), capacity, hasProjector, hasAC, status | M08.6 -- facility booking target; M08.5 -- lab rooms |
| RoomBooking | roomId, bookedBy, date, startTime, endTime, purpose, status (pending/approved/rejected/cancelled) | M08.6 -- existing booking entity, needs upgrade to Facility Booking |
| Vehicle | vehicleNumber, type, capacity, fuelType, driverId, insuranceExpiry, fitnessExpiry, status | M08.3 Transport -- partial match |
| GatePass | personId, personType, type (half_day/full_day/emergency/night_out), outTime, expectedInTime, status | M08.1 Hostel -- usable for hostel leave/gate-pass integration |
| VisitorEntry | visitorName, phone, idType, idNumber, purpose, whomToMeet, inTime, outTime | M08.6 -- direct match for W08-L2-033 |
| SecurityIncident | reportedBy, incidentDate, type, severity, actionTaken, status | M08.6 -- maps to Campus Incident |
| CCTV | -- | Infrastructure reference only |
| EmergencyContact | -- | Reference only |
| Lab | roomId, name, departmentId, labInChargeId, equipment[], capacity, isActive | M08.5 -- lab reference entity |
| ParkingSlot | -- | Infrastructure only |
| PowerBackup | -- | Infrastructure only |
| GreenInitiative | -- | Infrastructure/compliance only |
| WaterSupply | -- | Infrastructure only |

**Entity Group: Facilities (EG10) -- 14 models in `backend/src/models/facilities/`**

| Model | Fields (abridged) | W08 Relevance |
|-------|-------------------|---------------|
| Asset | assetId, name, category, departmentId, location, purchaseDate, purchaseCost, status | M08.5/M08.6 -- asset tracking base |
| AssetAllocation | assetId, allocatedTo, allocatedDate, returnDate, condition, status | M08.5 -- maps to Equipment Issue pattern |
| MaintenanceRequest | requestedBy, category, location, description, priority, assignedTo, status (open/assigned/in_progress/completed/rejected), cost | M08.7 -- partial match, needs significant enrichment |
| MaintenanceSchedule | assetId, facilityName, type (preventive/corrective/predictive), frequency, nextDueDate, status | M08.7 -- maps to Preventive Maintenance Schedule |
| ConstructionProject | -- | M08.6 infrastructure only |
| Vendor | name, contactPerson, category, gstNumber, rating, isActive | M08.7 -- vendor base, needs contract extension |
| PurchaseOrder | -- | Procurement, not W08 core |
| StockItem | -- | Inventory, not W08 core |
| StockTransaction | -- | Inventory, not W08 core |
| ITAsset | -- | IT-specific asset |
| NetworkInfra | -- | IT infrastructure |
| Insurance | -- | Finance/compliance |
| EnergyConsumption | -- | Compliance/green |
| WasteManagement | -- | Compliance/green |

**Entity Group: Library (EG14) -- 9 models in `backend/src/models/library/`**

| Model | Fields (abridged) | W08 Relevance |
|-------|-------------------|---------------|
| Book | isbn, title, author, category, totalCopies, availableCopies, location | M08.4 -- maps to Book + Book Catalogue Entry (combined) |
| BookIssue | bookId, issuedTo, issuedDate, dueDate, returnedDate, renewCount, fineAmount, status | M08.4 -- maps to Issue Transaction |
| BookReservation | bookId, reservedBy, reservedDate, expiryDate, status | M08.4 -- maps to Reservation |
| LibraryMember | personId, memberType, membershipId, maxBooks, currentIssued, finesDue, isActive | M08.4 -- maps to Library Membership |
| LibraryFine | memberId, bookIssueId, amount, reason, paidAmount, status | M08.4 -- direct match |
| LibraryGateEntry | personId, entryTime, exitTime | M08.4 -- maps to Library Visit |
| EResource | title, type, provider, url, accessType, subscriptionStart, subscriptionEnd | M08.4 -- maps to Digital Resource |
| EResourceAccess | -- | M08.4 -- usage tracking |
| PeriodicalSubscription | -- | M08.4 -- periodical tracking |

**Welfare Entity Group (EG06) -- 6 models in `backend/src/models/welfare/` that belong to M08**

| Model | Fields (abridged) | W08 Relevance |
|-------|-------------------|---------------|
| HostelBlock | name, type (boys/girls), totalRooms, wardenId, isActive | M08.1 -- direct match |
| HostelRoom | blockId, roomNumber, floor, capacity, occupancy, amenities[], status | M08.1 -- direct match (Room entity in W08 context) |
| HostelAllocation | studentId, roomId, academicYearId, allocatedDate, vacatedDate, status | M08.1 -- partial match, needs bed-level granularity and enrichment |
| HostelVisitorLog | studentId, visitorName, visitorRelation, visitorPhone, inTime, outTime | M08.1 -- hostel-specific visitor tracking |
| MessMenu | blockId, day, meals[], effectiveFrom, effectiveTo | M08.2 -- maps to Menu entity |
| MessFeedback | studentId, date, mealType, rating, comments | M08.2 -- maps to Mess Feedback |
| TransportRoute | routeNumber, name, stops[], vehicleNumber, driverName, capacity, isActive | M08.3 -- partial match, needs normalization |
| TransportAllocation | studentId, routeId, stopName, academicYearId, status | M08.3 -- partial match |

### 2.2 Service Layer (186 functions, pure CRUD)

All 186 exported functions in `service.ts` follow the identical pattern:
- `list<Entity>(collegeId, page, limit, authScope?)` -- paginated list with RBAC scope
- `get<Entity>(collegeId, id)` -- single fetch
- `create<Entity>(collegeId, data, who)` -- create + audit log
- `update<Entity>(collegeId, id, data, who)` -- update + audit log
- `delete<Entity>(collegeId, id, who)` -- delete + audit log

**Zero business logic**: No state transitions, no cross-entity updates, no validations beyond Zod schemas, no event emission, no clearance checks.

### 2.3 Route Structure (185 endpoints)

All routes under `/api/campus/` with RBAC via `authorize('campus', action, { subDomain })`:
- Campus sub-domain: buildings, rooms, room-bookings, vehicles, gate-passes, visitor-entries, security-incidents, cctvs, emergency-contacts, labs, parking-slots, power-backups, green-initiatives, water-supplies
- Facilities sub-domain: assets, asset-allocations, maintenance-requests, maintenance-schedules, construction-projects, vendors, purchase-orders, stock-items, stock-transactions, it-assets, network-infra, insurances, energy-consumptions, waste-managements
- Library sub-domain: books, book-issues, book-reservations, library-members, library-fines, library-gate-entries, e-resources, e-resource-accesses, periodical-subscriptions

---

## 3. Sub-Workflow Catalog

### 3.1 M08.1 HOSTEL (9 sub-workflows)

#### W08-L2-001: Allocate Hostel Room (Bulk -- New Intake)
- **Type**: Lifecycle | **Trigger**: W01-L2-038 (enrollment with is_hosteler=true)
- **Steps**: W01 passes student data -> M02 identity read (gender, category) -> AI (M12.3) runs allocation algorithm (preference-based / capacity-first / hybrid per config) -> warden reviews recommendation -> special needs flagged for human review -> confirm or override -> create HostelAllocation (student->bed) -> update Bed (Available->Allocated) -> update Room occupancy -> event to M04 (hostel fee trigger) -> event to W08-L2-010 (mess subscription activation)
- **Entities**: HostelAllocation (C), Bed (U), HostelRoom (U), HostelBlock (R)
- **AI**: Hostel Room Allocation Optimization (M12.3), Roommate Compatibility Scoring
- **Exceptions**: EX-001 (no vacancy -> waitlist), EX-002 (special needs override), EX-003 (sibling co-allocation)

#### W08-L2-002: Allocate Hostel Room (Mid-Year Admission)
- **Type**: Lifecycle | **Trigger**: S5 flag change (is_hosteler false->true) or lateral entry
- **Steps**: M02 signals S5 change -> check vacancy -> if vacancy: AI recommends, warden confirms, create allocation, trigger prorated fee via M04, activate mess -> if no vacancy: add to waitlist (priority queue), welfare emergency gets priority -> evaluate transport removal
- **Entities**: HostelAllocation (C), Bed (U), HostelRoom (U), MessSubscription (C)
- **Exceptions**: EX-004 (no vacancy -> waitlist), EX-005 (welfare emergency allocation)

#### W08-L2-003: Process Room Change Request
- **Type**: Lifecycle | **Trigger**: Student submits room change request
- **Steps**: Student submits request (reason, preferences) -> warden reviews -> evaluate reason (roommate conflict: check history, may refer M06; medical: priority; preference: check availability) -> if approved: AI suggests new room, warden confirms, vacate old allocation, create new allocation (type=change), update both bed statuses -> if rejected: reason recorded -> if conflict-driven and severe: escalate M06
- **Entities**: RoomChangeRequest (C->U), HostelAllocation (C new, U old->Vacated), Bed (U x2), HostelRoom (U x2)
- **Exceptions**: EX-006 (conflict -> M06 referral), EX-007 (no suitable room)

#### W08-L2-004: Process Hostel Clearance
- **Type**: Lifecycle | **Trigger**: W10 exit workflow
- **Steps**: W10 triggers -> create HostelClearance (Pending) -> physical checks: room vacated? keys returned? damage assessment? outstanding dues (M04)? -> all clear: Cleared -> blocking: Blocked with reason -> update allocation to Vacated, bed to Available -> return status to W10
- **Entities**: HostelClearance (C->U), HostelAllocation (U->Vacated), Bed (U->Available), HostelRoom (U)
- **Exceptions**: EX-008 (damage -> liability), EX-009 (outstanding dues -> blocked)

#### W08-L2-005: Record Hostel Attendance
- **Type**: Ongoing | **Trigger**: Daily attendance window (evening roll call / card swipe)
- **Steps**: Record per student (present/absent/on-leave) -> AI anomaly detection (consecutive absences > threshold without leave, pattern anomaly) -> if anomaly: push structured signal to M06.9 CCD (source=M08.1, type=attendance_anomaly, severity, student_id) -> warden reviews daily summary
- **Entities**: HostelAttendance (C, immutable)
- **Exceptions**: EX-010 (swipe system down -> manual), EX-011 (absent without leave)

#### W08-L2-006: Process Hostel Leave Request
- **Type**: Ongoing | **Trigger**: Student submits leave request
- **Steps**: Submit (type, dates, destination, guardian_contact) -> warden reviews (home: standard, medical: verify docs, emergency: expedited) -> approve: update status Active, notify parent via M12.2, mark attendance on-leave -> reject: reason recorded -> on return: student checks in, status Returned -> if no return by end_date: escalation
- **Entities**: HostelLeave (C->U), HostelAttendance (U: on-leave markers)
- **Exceptions**: EX-012 (no return on time), EX-013 (emergency retroactive)

#### W08-L2-007: Handle Hostel Discipline Violation
- **Type**: Ongoing | **Trigger**: Violation reported
- **Steps**: Create violation (Reported) -> investigate (Under Investigation) -> hearing if warranted -> outcome: dismissed (Closed) or penalty (warning/fine/suspension/expulsion) -> if severe: welfare signal to M06 -> student notified + appeal deadline -> if appeal: W08-L2-008
- **Entities**: HostelViolation (C->U lifecycle), HostelPenalty (C)
- **Exceptions**: EX-014 (substance abuse -> mandatory M06), EX-015 (damage -> liability)

#### W08-L2-008: Process Hostel Discipline Appeal
- **Type**: Ongoing | **Trigger**: Student files appeal within deadline
- **Steps**: Submit appeal (grounds, penalty_id) -> chief warden or committee reviews -> hearing -> outcome (upheld/modified/overturned) -> update penalty if modified/overturned -> student notified
- **Entities**: HostelAppeal (C->U), HostelPenalty (U if modified/overturned)
- **Exceptions**: EX-016 (deadline missed -> auto-rejected)

#### W08-L2-009: Escalate Warden Concern to Welfare
- **Type**: Ongoing | **Trigger**: Warden observes distress/behavioral change/conflict
- **Steps**: Warden creates structured signal (source: M08.1, signal_type: warden_concern, severity, student_id, description, evidence) -> push to M06.9 CCD -> M06 acknowledges and opens case -> warden remains information source -> critical: immediate notification chain (warden->chief warden->principal->M06)
- **Entities**: Warden (R), HostelAttendance (R for patterns)
- **Exceptions**: EX-017 (critical -> immediate chain), EX-018 (ragging -> anti-ragging committee)

### 3.2 M08.2 MESS (4 sub-workflows)

#### W08-L2-010: Manage Daily Mess Operations
- **Type**: Ongoing | **Trigger**: Meal time window
- **Steps**: Menu published -> meal service window opens -> record consumption: coupon model (Meal Transaction deduct) OR fixed fee model (Mess Subscription attendance) -> dietary accommodations checked -> meal closes -> feedback collected via Juvi -> daily summary -> coordinator reviews
- **Entities**: Menu (R), MealTransaction (C -- coupon), MessSubscription (R -- fee), DietaryPreference (R), MessFeedback (C)
- **Config**: Billing model (fixed fee vs. coupon per-meal)
- **Exceptions**: EX-019 (coupon exhausted), EX-020 (dietary need unmet)

#### W08-L2-011: Manage Menu Planning
- **Type**: Ongoing | **Trigger**: Weekly/monthly planning cycle
- **Steps**: Coordinator plans weekly menu -> incorporate dietary preference aggregates -> if outsourced: vendor submits proposed menu -> coordinator/warden approves -> create Menu entities -> publish to Juvi
- **Entities**: Menu (C), DietaryPreference (R)
- **Config**: Operation model (in-house / outsourced / hybrid)

#### W08-L2-012: Conduct Mess Quality Inspection
- **Type**: Ongoing | **Trigger**: Scheduled cycle or complaint
- **Steps**: Inspector visits -> assess hygiene_score, food_quality_score, compliance_status -> document issues -> create QualityInspection -> if outsourced: compare against vendor SLA -> SLA breach: warning/penalty/termination -> quality scores feed M11
- **Entities**: QualityInspection (C), MessVendorContract (R for SLA), MessFeedback (R)
- **Exceptions**: EX-021 (severe hygiene failure -> closure), EX-022 (contract termination)

#### W08-L2-013: Manage Mess Vendor Contract
- **Type**: Ongoing | **Trigger**: New contract or renewal/termination
- **Steps**: RFP/selection -> draft contract (terms, SLA, cost_per_meal) -> vendor accepts -> activate -> ongoing performance via quality inspections -> renewal/termination based on performance
- **Entities**: MessVendorContract (C->U lifecycle)
- **Config**: Operation model (only applicable if outsourced/hybrid)
- **Exceptions**: EX-023 (vendor walks out -> emergency catering)

### 3.3 M08.3 TRANSPORT (5 sub-workflows)

#### W08-L2-014: Allocate Transport Route to Student
- **Type**: Lifecycle | **Trigger**: W01-L2-039 (enrollment with uses_college_transport=true)
- **Steps**: W01 passes student_id + address -> read M02 identity + address -> match active routes/stops -> identify nearest stop -> check vehicle capacity -> config: auto-assign nearest OR student selects -> create TransportAllocation -> event to M04 (transport fee) -> notify student
- **Entities**: TransportAllocation (C), RouteStop (R), TransportRoute (R), Vehicle (R)
- **Config**: Route allocation policy (auto-assign nearest vs. student selects)
- **Exceptions**: EX-024 (no nearby route), EX-025 (overcapacity)

#### W08-L2-015: Process Transport Clearance
- **Type**: Lifecycle | **Trigger**: W10 exit workflow
- **Steps**: W10 triggers -> create TransportClearance (Pending) -> check outstanding transport dues (M04) -> remove allocation (Cancelled) -> all clear: Cleared -> outstanding dues: Blocked -> return status to W10
- **Entities**: TransportClearance (C->U), TransportAllocation (U->Cancelled)
- **Exceptions**: EX-026 (outstanding dues -> blocked)

#### W08-L2-016: Manage Daily Transport Operations
- **Type**: Ongoing | **Trigger**: Daily trip schedule (morning + evening)
- **Steps**: Trips scheduled per route -> driver assigned -> trip begins (TripLog In Progress) -> GPS tracking if enabled -> student boards (TransportAttendance) -> trip completes -> late/missed flagged
- **Entities**: TripLog (C->U), TransportAttendance (C), Vehicle (R), Driver (R), TransportRoute (R)
- **Config**: GPS tracking (enabled/disabled)
- **Exceptions**: EX-027 (vehicle breakdown), EX-028 (driver absence)

#### W08-L2-017: Plan and Adjust Transport Routes
- **Type**: Ongoing | **Trigger**: Semester start or demand change
- **Steps**: Review ridership data -> AI (M12.3) predicts demand -> identify underserved/overcrowded routes, unused stops -> coordinator proposes changes -> principal approves major changes -> update routes/stops/vehicles -> notify affected students
- **Entities**: TransportRoute (C/U), RouteStop (C/U/D), Vehicle (U)
- **AI**: Transport Demand Prediction (M12.3)
- **Exceptions**: EX-029 (new area demand -> new route proposal)

#### W08-L2-018: Manage Transport Vendor Contract
- **Type**: Ongoing | **Trigger**: Contract cycle for contracted vehicles/drivers
- **Steps**: Identify needs -> draft/renew TransportContractor -> contractor accepts -> assign contracted vehicles -> track SLA via TripLogs -> renewal/termination
- **Entities**: TransportContractor (C->U), Vehicle (U: ownership=contracted)
- **Config**: Fleet model (owned/contracted/mixed)
- **Exceptions**: EX-030 (contractor pulls vehicles)

### 3.4 M08.4 LIBRARY (5 sub-workflows)

#### W08-L2-019: Manage Library Catalogue
- **Type**: Ongoing | **Trigger**: New acquisitions or catalogue updates
- **Steps**: New acquisition -> create/update BookCatalogueEntry (bibliographic) -> create Book per copy (asset-level, location_code) -> if ILMS integration: sync -> update copies_available -> AI demand forecasting informs acquisition priorities
- **Entities**: BookCatalogueEntry (C/U), Book (C), DigitalResource (C if e-book)
- **AI**: Library Demand Forecasting (M12.3)
- **Config**: System mode (Juvion-native / ILMS integration / hybrid)
- **Exceptions**: EX-031 (ILMS sync failure -> fallback)

#### W08-L2-020: Process Book Issue/Return/Renew
- **Type**: Ongoing | **Trigger**: Borrow/return/renew request
- **Steps**: Issue: verify membership (active, not suspended), check borrower limit, create IssueTransaction (Issued, due_date), update Book -> Issued. Return: update transaction (return_date), check overdue -> create LibraryFine -> M04, check damaged, update Book -> Available. Renew: check no pending reservation, extend due_date. If reserved: notify reservation holder via M12.2
- **Entities**: IssueTransaction (C/U), Book (U), LibraryMembership (R), LibraryFine (C), Reservation (R/U)
- **Config**: System mode, fine waiver authority threshold
- **Exceptions**: EX-032 (book lost -> replacement cost), EX-033 (membership suspended -> blocked)

#### W08-L2-021: Process Book Reservation
- **Type**: Ongoing | **Trigger**: Book currently issued, borrower requests reservation
- **Steps**: Request reservation -> verify all copies issued -> create Reservation (Reserved) -> when returned: Reservation Available for Pickup -> notify via M12.2 -> pickup window (48h) -> if not picked up: cancel, notify next in queue -> on pickup: regular issue flow
- **Entities**: Reservation (C->U lifecycle), BookCatalogueEntry (R)
- **Exceptions**: EX-034 (reservation expires -> next in queue)

#### W08-L2-022: Process Library Clearance
- **Type**: Lifecycle | **Trigger**: W10 (student) or W05 (faculty exit)
- **Steps**: Trigger -> create LibraryClearance (Pending) -> check outstanding books (open IssueTransactions) -> check outstanding fines (M04) -> all clear: Cleared -> blocking: Blocked (books/fines listed) -> return to W10/W05
- **Entities**: LibraryClearance (C->U), IssueTransaction (R), LibraryFine (R), LibraryMembership (U->Expired)
- **Exceptions**: EX-035 (lost book at exit -> replacement charge)

#### W08-L2-023: Track Library Visits and Usage
- **Type**: Ongoing | **Trigger**: Person enters/exits library
- **Steps**: Entry -> record LibraryVisit (entry_time) -> exit: update exit_time -> aggregate for M10 (NAAC Criterion IV) and M11 (peak hours, capacity planning)
- **Entities**: LibraryVisit (C, immutable)

### 3.5 M08.5 LABS (5 sub-workflows)

#### W08-L2-024: Manage Lab Equipment Inventory
- **Type**: Ongoing | **Trigger**: New procurement or status change
- **Steps**: New equipment -> create LabEquipment (asset-level, serial_number) -> track condition, maintenance, calibration -> calibration due: flag -> condemned: update status -> inventory feeds M10 compliance -> EquipmentMaintenanceLog updated per service
- **Entities**: LabEquipment (C/U), EquipmentMaintenanceLog (C), Lab (R)

#### W08-L2-025: Process Non-Academic Lab Slot Booking
- **Type**: Ongoing | **Trigger**: Lab time request outside timetable
- **Steps**: Submit LabSlotBooking (lab, datetime, purpose) -> check M03 academic schedule (no conflict) -> approval: auto-approve (config) / technician / HOD for research -> if approved: booking confirmed -> on use: LabUsageLog -> on completion: Completed
- **Entities**: LabSlotBooking (C->U), LabUsageLog (C), Lab (R)
- **Config**: Booking approval tier (auto/technician/HOD)
- **Exceptions**: EX-036 (schedule conflict -> reschedule)

#### W08-L2-026: Process Equipment Issue/Return
- **Type**: Ongoing | **Trigger**: Equipment checkout request
- **Steps**: Request checkout -> verify available and eligible -> create EquipmentIssue (issue_date, due_date) -> on return: record return_date, condition -> if damaged: lab incident flow + liability -> overdue: notification
- **Entities**: EquipmentIssue (C->U), LabEquipment (U: status)
- **Exceptions**: EX-037 (equipment damaged -> liability)

#### W08-L2-027: Handle Lab Incident
- **Type**: Ongoing | **Trigger**: Safety or damage incident
- **Steps**: Report -> create LabIncident -> if injury: first aid + M06 welfare signal -> investigate (technician + HOD) -> equipment damage: update status -> liability determination -> resolve and document -> if serious: M10 compliance record
- **Entities**: LabIncident (C->U), LabEquipment (U if damaged)
- **Exceptions**: EX-038 (serious injury -> emergency protocol)

#### W08-L2-028: Process Lab Clearance
- **Type**: Lifecycle | **Trigger**: W10 exit workflow
- **Steps**: W10 triggers -> create LabClearance (Pending) -> check outstanding equipment (open EquipmentIssues) -> check lab fees (M04) -> all clear: Cleared -> blocking: Blocked -> return to W10
- **Entities**: LabClearance (C->U), EquipmentIssue (R), LabEquipment (R)
- **Exceptions**: EX-039 (equipment not returned -> replacement charge)

### 3.6 M08.6 FACILITIES (5 sub-workflows)

#### W08-L2-029: Process Facility Booking Request
- **Type**: Ongoing | **Trigger**: Booking from M03, M05, M07, M09, or direct request
- **Steps**: API receives request (facility_id, requester_id, requester_module, purpose, datetime, attendees) -> check availability -> determine approval chain (self-book: classrooms for faculty auto-confirm; single: seminar halls estate officer; multi-level: auditorium faculty advisor -> estate officer -> principal) -> conflict resolution (FCFS or priority per config) -> approval chain executed -> confirmed/rejected -> on use: FacilityUsageLog -> no-show tracking
- **Entities**: FacilityBooking (C->U), Facility (R/U), ApprovalChain (R), FacilityUsageLog (C)
- **Config**: Booking approval tier (self/single/multi), conflict resolution (FCFS/priority)
- **Exceptions**: EX-040 (double booking), EX-041 (last-minute cancellation)

#### W08-L2-030: Manage Sports Equipment Issue/Return
- **Type**: Ongoing | **Trigger**: Sports equipment checkout
- **Steps**: Request -> check availability (quantity) -> create SportsEquipmentIssue -> on return: record -> damaged: update condition -> low inventory: flag procurement
- **Entities**: SportsEquipmentIssue (C->U), SportsEquipment (U: quantity)
- **Exceptions**: EX-042 (equipment damaged)

#### W08-L2-031: Handle Campus Security Incident
- **Type**: Ongoing | **Trigger**: Security/safety incident reported
- **Steps**: Report -> create CampusIncident -> severity assessment -> if welfare-related: M06 signal -> investigation -> resolution documented -> if serious: principal notification -> M10 compliance if applicable
- **Entities**: CampusIncident (C->U), VisitorEntry (R if visitor involved)
- **Exceptions**: EX-043 (visitor involved), EX-044 (theft/vandalism -> police)

#### W08-L2-032: Track Facility Utilization
- **Type**: Ongoing | **Trigger**: Continuous aggregation
- **Steps**: Aggregate FacilityUsageLogs -> calculate utilization rate, peak hours, no-show rate -> push to M10 (NAAC Criterion IV) -> push to M11 (dashboards) -> AI identifies underused facilities and peak demand patterns -> informs investment decisions
- **Entities**: FacilityUsageLog (R), FacilityBooking (R), Facility (R)
- **AI**: Facility Utilization Insights (M11 via M12.3)

#### W08-L2-033: Manage Visitor Entry
- **Type**: Ongoing | **Trigger**: Visitor arrives at campus
- **Steps**: Record VisitorEntry (visitor_name, purpose, host_id, id_proof_type) -> entry_time recorded -> on exit: exit_time recorded
- **Entities**: VisitorEntry (C->U)
- **Exceptions**: EX-045 (unverified visitor -> security protocol)

### 3.7 M08.7 MAINTENANCE (5 sub-workflows)

#### W08-L2-034: Submit and Triage Maintenance Request
- **Type**: Cross-Cutting | **Trigger**: Anyone reports maintenance issue
- **Steps**: Submit MaintenanceRequest (facility_type, facility_id, equipment_id, issue_description; S5 scope: hostelers report hostel issues; day scholars report classroom/lab only) -> supervisor triages (priority, routing: in-house/AMC vendor/external) -> status: Triaged -> critical: immediate escalation
- **Entities**: MaintenanceRequest (C: Submitted->Triaged)
- **Exceptions**: EX-046 (emergency -> skip triage)

#### W08-L2-035: Assign and Execute Maintenance Work
- **Type**: Cross-Cutting | **Trigger**: MaintenanceRequest triaged
- **Steps**: Create MaintenanceAssignment (in-house staff / AMC vendor work order / external contractor) -> SLA deadline set -> work executed (MaintenanceWorkLog entries: work_date, hours, materials, cost) -> facility owner verifies -> verification passed: Closed -> failed: rework -> cost recorded to M04
- **Entities**: MaintenanceAssignment (C->U), MaintenanceWorkLog (C), MaintenanceRequest (U lifecycle)
- **Config**: Assignment routing (in-house/AMC/external)
- **Exceptions**: EX-047 (vendor SLA breach -> escalation), EX-048 (rework)

#### W08-L2-036: Schedule and Execute Preventive Maintenance
- **Type**: Cross-Cutting | **Trigger**: PM Schedule due date or AI prediction
- **Steps**: PM schedule triggers (next_due reached OR AI predicts failure > threshold) -> auto-create MaintenanceRequest (priority=medium, type=preventive) -> follow W08-L2-035 flow -> on completion: update PM schedule (last_performed, next_due) -> update EquipmentMaintenanceLog -> if AI-triggered: log confidence for model improvement
- **Entities**: PreventiveMaintenanceSchedule (R->U), MaintenanceRequest (C), EquipmentMaintenanceLog (C)
- **AI**: Predictive Maintenance Scheduling (M12.3)
- **Config**: PM frequency, AI confidence threshold
- **Exceptions**: EX-049 (low AI confidence -> supervisor review), EX-050 (deferred PM -> risk tracked)

#### W08-L2-037: Handle Maintenance Escalation
- **Type**: Cross-Cutting | **Trigger**: SLA threshold approaching or breached
- **Steps**: SLA monitoring: 80% -> warning to assignee + supervisor; 100% -> auto-escalate (create MaintenanceEscalation); critical overdue -> principal notification -> escalation acknowledged -> reassign if needed -> resolution tracked -> vendor SLA compliance recorded
- **Entities**: MaintenanceEscalation (C->U), MaintenanceRequest (U: reprioritized), VendorPerformance (U)
- **Config**: Escalation thresholds (default 80%/100%)
- **Exceptions**: EX-051 (chronic vendor failure -> contract review)

#### W08-L2-038: Track Vendor Performance
- **Type**: Cross-Cutting | **Trigger**: Monthly cycle or batch
- **Steps**: Aggregate per vendor: requests assigned/completed, avg response time -> calculate SLA compliance rate vs AMC contract terms -> create/update VendorPerformance -> feed M11 dashboards -> low compliance: flag for contract review
- **Entities**: VendorPerformance (C/U), AMCContract (R), MaintenanceAssignment (R)
- **Exceptions**: EX-052 (vendor below threshold -> termination)

### 3.8 Cross-Module Workflows (4 sub-workflows)

#### W08-L2-039: Aggregate Clearance Status for W10
- **Type**: Lifecycle | **Trigger**: W10 clearance query
- **Steps**: Parallel checks: hostel clearance (if S5=true), transport clearance (if uses_transport=true), library clearance (all), lab clearance (all) -> aggregate: all Cleared -> ALL_CLEAR; any Blocked -> BLOCKED with list -> W10 cannot finalize until ALL_CLEAR
- **Exceptions**: EX-053 (partial clearance)

#### W08-L2-040: Provision Infrastructure at Enrollment
- **Type**: Lifecycle | **Trigger**: W01-L2-036 enrollment complete
- **Steps**: Parallel provisioning: is_hosteler -> hostel (W08-L2-001) + mess; uses_transport -> transport (W08-L2-014); all students -> library membership + lab access -> all complete -> signal back to W01
- **Exceptions**: EX-054 (provisioning failure -> W01 blocked)

#### W08-L2-041: Feed Compliance Evidence to M10
- **Type**: Ongoing | **Trigger**: M10 request or batch schedule
- **Steps**: Hostel capacity/occupancy, library holdings/circulation/usage, lab equipment/utilization, facility utilization, maintenance records -> push to M10 for NAAC/NBA

#### W08-L2-042: Feed Governance Dashboards to M11
- **Type**: Ongoing | **Trigger**: Dashboard refresh cycle
- **Steps**: Facility utilization, maintenance backlog/response times/vendor SLA, mess feedback/quality, transport ridership/efficiency, library circulation/peak hours, capacity planning -> push to M11

---

## 4. Entity Gap Analysis

### 4.1 New Entities Required (26 models)

These entities do not exist anywhere in the codebase and must be created.

| # | Entity | Sub-Domain | File Path | Key Fields |
|---|--------|------------|-----------|------------|
| 1 | Bed | M08.1 | `models/campus/Bed.ts` | roomId (HostelRoom), bedNumber, status (available/allocated/maintenance/reserved), isAccessible |
| 2 | HostelAttendance | M08.1 | `models/campus/HostelAttendance.ts` | studentId, allocationId, date, status (present/absent/on_leave), recordedBy, method (manual/card_swipe) |
| 3 | HostelLeave | M08.1 | `models/campus/HostelLeave.ts` | studentId, leaveType (home/medical/emergency), startDate, endDate, destination, guardianContact, approvedBy, status (requested/approved/rejected/active/returned/overdue), parentNotified |
| 4 | HostelViolation | M08.1 | `models/campus/HostelViolation.ts` | studentId, reportedBy, violationType, description, evidence[], severity, hearingDate, outcome, status (reported/under_investigation/hearing_scheduled/penalty_assigned/dismissed/closed) |
| 5 | HostelPenalty | M08.1 | `models/campus/HostelPenalty.ts` | violationId, studentId, penaltyType (warning/fine/suspension/expulsion), fineAmount, effectiveDate, expiryDate, status (active/served/cancelled/modified), appealDeadline |
| 6 | HostelAppeal | M08.1 | `models/campus/HostelAppeal.ts` | penaltyId, studentId, grounds, reviewedBy, hearingDate, outcome (upheld/modified/overturned), status (submitted/under_review/hearing_scheduled/resolved) |
| 7 | HostelClearance | M08.1 | `models/campus/HostelClearance.ts` | studentId, allocationId, roomVacated, keysReturned, damageAssessment, duesCleared, status (pending/cleared/blocked), blockingItems[] |
| 8 | RoomChangeRequest | M08.1 | `models/campus/RoomChangeRequest.ts` | studentId, currentRoomId, requestedRoomId, reason, reasonCategory (roommate_conflict/medical/preference), status (requested/approved/rejected/completed), approvedBy |
| 9 | MessFacility | M08.2 | `models/campus/MessFacility.ts` | name, blockId (HostelBlock), operationModel (in_house/outsourced/hybrid), billingModel (fixed_fee/coupon), capacity, isActive |
| 10 | MealTransaction | M08.2 | `models/campus/MealTransaction.ts` | studentId, messFacilityId, date, mealType, transactionType (coupon_deduct/credit_meal), amount, balance |
| 11 | MessSubscription | M08.2 | `models/campus/MessSubscription.ts` | studentId, messFacilityId, academicYearId, plan (full/partial), startDate, endDate, monthlyFee, status (active/suspended/cancelled) |
| 12 | DietaryPreference | M08.2 | `models/campus/DietaryPreference.ts` | studentId, dietType (veg/non_veg/egg/vegan/jain), allergies[], medicalDiet, notes |
| 13 | QualityInspection | M08.2 | `models/campus/QualityInspection.ts` | messFacilityId, inspectedBy, date, hygieneScore, foodQualityScore, complianceStatus, issues[], vendorContractId |
| 14 | MessVendorContract | M08.2 | `models/campus/MessVendorContract.ts` | vendorId, messFacilityId, startDate, endDate, terms, slaMetrics, costPerMeal, status (draft/active/renewed/terminated) |
| 15 | RouteStop | M08.3 | `models/campus/RouteStop.ts` | routeId, name, sequence, pickupTime, dropTime, latitude, longitude, isActive |
| 16 | Driver | M08.3 | `models/campus/Driver.ts` | personId (Staff), licenseNumber, licenseExpiry, vehicleAssignment, isActive |
| 17 | TripLog | M08.3 | `models/campus/TripLog.ts` | routeId, vehicleId, driverId, tripDate, tripType (morning/evening), startTime, endTime, gpsTrack[], status (scheduled/in_progress/completed/cancelled) |
| 18 | TransportAttendance | M08.3 | `models/campus/TransportAttendance.ts` | studentId, tripLogId, stopId, boardedAt, alightedAt |
| 19 | TransportContractor | M08.3 | `models/campus/TransportContractor.ts` | vendorId, contractNumber, vehicleIds[], startDate, endDate, terms, slaMetrics, status (draft/active/renewed/terminated) |
| 20 | TransportClearance | M08.3 | `models/campus/TransportClearance.ts` | studentId, allocationId, duesCleared, status (pending/cleared/blocked), blockingItems[] |
| 21 | LabEquipment | M08.5 | `models/campus/LabEquipment.ts` | labId, name, serialNumber, manufacturer, purchaseDate, condition, lastMaintenance, nextCalibration, status (active/maintenance/calibration_due/condemned) |
| 22 | LabSlotBooking | M08.5 | `models/campus/LabSlotBooking.ts` | labId, requesterId, date, startTime, endTime, purpose, approvalStatus (pending/approved/rejected), approvedBy, status (confirmed/completed/cancelled) |
| 23 | EquipmentIssue | M08.5 | `models/campus/EquipmentIssue.ts` | equipmentId, issuedTo, issueDate, dueDate, returnDate, conditionOnReturn, status (issued/returned/overdue/lost) |
| 24 | LabIncident | M08.5 | `models/campus/LabIncident.ts` | labId, reportedBy, incidentDate, type (safety/damage/chemical_spill/fire/injury), description, equipmentDamaged[], injuryDetails, severity, resolution, status (reported/investigating/resolved/closed) |
| 25 | LabClearance | M08.5 | `models/campus/LabClearance.ts` | studentId, outstandingEquipment[], feesCleared, status (pending/cleared/blocked), blockingItems[] |
| 26 | LibraryClearance | M08.4 | `models/library/LibraryClearance.ts` | personId, outstandingBooks[], outstandingFines, status (pending/cleared/blocked), blockingItems[] |

### 4.2 Existing Entities Requiring Enhancement

| Entity | Current Location | Required Changes |
|--------|-----------------|------------------|
| HostelAllocation | `welfare/HostelAllocation.ts` | Add: bedId, allocationType (new_intake/mid_year/change), matchScore (AI), preferences[], specialNeeds, allocationMethod (ai_recommended/manual_override/waitlist). Relocate to `campus/HostelAllocation.ts` or reference from campus-ops module |
| HostelRoom | `welfare/HostelRoom.ts` | Add: roomType (single/double/triple/dormitory), isAccessible, currentOccupancy computed from bed allocations. Relocate to `campus/HostelRoom.ts` |
| HostelBlock | `welfare/HostelBlock.ts` | Add: genderType already exists. Add: chiefWardenId, capacity (computed), occupancy (computed). Relocate to `campus/HostelBlock.ts` |
| TransportRoute | `welfare/TransportRoute.ts` | Normalize stops into separate RouteStop entity (currently embedded). Add: vehicleId (ref instead of vehicleNumber string), currentRidership. Relocate to `campus/TransportRoute.ts` |
| TransportAllocation | `welfare/TransportAllocation.ts` | Add: stopId (ref to RouteStop), boardingPoint, allocationType (auto/student_selected), feeTriggered. Relocate to `campus/TransportAllocation.ts` |
| MessMenu | `welfare/MessMenu.ts` | Rename to Menu. Add: messFacilityId, approvalStatus, publishedToJuvi. Relocate to `campus/Menu.ts` |
| MessFeedback | `welfare/MessFeedback.ts` | Add: messFacilityId, menuItemFeedback[]. Already in welfare, reference from campus-ops |
| MaintenanceRequest | `facilities/MaintenanceRequest.ts` | Add: facilityType (hostel/classroom/lab/transport), facilityId, equipmentId, slaDeadline, resolvedAt, verifiedBy, verificationStatus, maintenanceType (corrective/preventive). Enrich status enum: submitted/triaged/assigned/in_progress/completed/verified/closed/rejected |
| MaintenanceSchedule | `facilities/MaintenanceSchedule.ts` | Add: equipmentId (lab equipment ref), aiTriggered, aiConfidence, lastPerformed. Maps to Preventive Maintenance Schedule |
| Vehicle | `campus/Vehicle.ts` | Add: ownershipType (owned/contracted), routeAssignment, currentRouteId, contractorId |
| Room | `campus/Room.ts` | Already adequate for facility booking. May add: facilityAmenities[] |
| RoomBooking | `campus/RoomBooking.ts` | Evolve to FacilityBooking: add requesterModule, approvalChainId, attendeeCount, facilityUsageLogged, noShow. Enrich status enum |
| Book | `library/Book.ts` | Add: locationCode (shelf), catalogueEntryId (if separating bibliographic vs asset), condition |
| BookIssue | `library/BookIssue.ts` | Maps to IssueTransaction. Add: renewedDate, maxRenewals. Status already adequate |
| LibraryMember | `library/LibraryMember.ts` | Maps to Library Membership. Add: suspendedReason, membershipExpiry |
| SecurityIncident | `campus/SecurityIncident.ts` | Maps to Campus Incident. Add: personsInvolved[], visitorEntryId, welfareSignalSent, complianceRecordId |
| Vendor | `facilities/Vendor.ts` | Add: vendorType (mess/transport/maintenance/general), contractIds[] |

### 4.3 Additional Supporting Entities (from Entity Coverage matrix)

| Entity | Notes | Resolution |
|--------|-------|------------|
| Warden | M08.1 reference (linked to M02 Person) | Not a separate model -- use Staff/Person with personaType=ST-WARDEN. Query M02 |
| Facility | M08.6 reference for booking targets | Existing Room model serves this purpose. No new model needed -- Room.type provides facility type |
| ApprovalChain | M08.6 configurable per venue | New config entity or use M12 platform config. Define per-facility approval rules |
| SportsEquipment | M08.6 quantity tracking | Use existing Asset model with category='sports'. No new model needed |
| SportsEquipmentIssue | M08.6 checkout | Use AssetAllocation with asset category filter. No new model needed |
| FacilityAmenity | M08.6 within-facility amenities | Embed as array in Room model. No new model needed |
| FacilityUsageLog | M08.6 immutable usage log | New model needed if not captured by enhanced RoomBooking. Create `models/campus/FacilityUsageLog.ts` |
| EquipmentMaintenanceLog | M08.5 immutable service history | Create `models/campus/EquipmentMaintenanceLog.ts` with equipmentId, serviceDate, serviceType, performedBy, notes, cost |
| MaintenanceAssignment | M08.7 work assignment | Create `models/facilities/MaintenanceAssignment.ts` with requestId, assignedToType (in_house/amc_vendor/external), assignedToId, slaDeadline, status |
| MaintenanceWorkLog | M08.7 immutable work log | Create `models/facilities/MaintenanceWorkLog.ts` with assignmentId, workDate, hoursSpent, materialsUsed[], cost |
| MaintenanceEscalation | M08.7 overdue escalation | Create `models/facilities/MaintenanceEscalation.ts` with requestId, escalationLevel, reason, acknowledgedBy, resolvedAt, status |
| AMCContract | M08.7 vendor SLA reference | Create `models/facilities/AMCContract.ts` with vendorId, facilityType, startDate, endDate, slaMetrics, status |
| VendorPerformance | M08.7 SLA compliance | Create `models/facilities/VendorPerformance.ts` with vendorId, period, requestsAssigned, requestsCompleted, avgResponseTime, slaComplianceRate |

**Total new model count: 26 (primary) + 7 (supporting) = 33 new models**

---

## 5. API Endpoint Gap Analysis

### 5.1 Current Endpoint Count
- 185 CRUD endpoints across 37 entities (5 per entity: list, get, create, update, delete)
- 1 dashboard stats endpoint
- Total: 186 endpoints

### 5.2 New Workflow-Specific Endpoints Required

#### M08.1 HOSTEL Sub-Domain

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/api/campus/hostel/allocate-bulk` | W08-L2-001 | Bulk hostel allocation at intake |
| POST | `/api/campus/hostel/allocate` | W08-L2-002 | Single hostel allocation (mid-year) |
| POST | `/api/campus/hostel/room-change-requests` | W08-L2-003 | Submit room change request |
| PUT | `/api/campus/hostel/room-change-requests/:id/approve` | W08-L2-003 | Approve/execute room change |
| PUT | `/api/campus/hostel/room-change-requests/:id/reject` | W08-L2-003 | Reject room change |
| POST | `/api/campus/hostel/clearance/:studentId` | W08-L2-004 | Initiate hostel clearance |
| PUT | `/api/campus/hostel/clearance/:id/verify` | W08-L2-004 | Warden verifies clearance items |
| POST | `/api/campus/hostel/attendance/record` | W08-L2-005 | Record daily attendance (bulk) |
| GET | `/api/campus/hostel/attendance/anomalies` | W08-L2-005 | Get attendance anomalies |
| POST | `/api/campus/hostel/leave-requests` | W08-L2-006 | Submit hostel leave |
| PUT | `/api/campus/hostel/leave-requests/:id/approve` | W08-L2-006 | Approve leave |
| PUT | `/api/campus/hostel/leave-requests/:id/return` | W08-L2-006 | Record leave return |
| POST | `/api/campus/hostel/violations` | W08-L2-007 | Report violation |
| PUT | `/api/campus/hostel/violations/:id/investigate` | W08-L2-007 | Update investigation status |
| PUT | `/api/campus/hostel/violations/:id/penalize` | W08-L2-007 | Assign penalty |
| POST | `/api/campus/hostel/appeals` | W08-L2-008 | File appeal |
| PUT | `/api/campus/hostel/appeals/:id/resolve` | W08-L2-008 | Resolve appeal |
| POST | `/api/campus/hostel/welfare-signals` | W08-L2-009 | Push welfare signal to M06 |

#### M08.2 MESS Sub-Domain

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/api/campus/mess/meal-transactions` | W08-L2-010 | Record meal transaction (coupon) |
| POST | `/api/campus/mess/meal-attendance` | W08-L2-010 | Record meal attendance (subscription) |
| GET | `/api/campus/mess/daily-summary` | W08-L2-010 | Daily consumption summary |
| POST | `/api/campus/mess/menus` | W08-L2-011 | Create/publish menu |
| PUT | `/api/campus/mess/menus/:id/approve` | W08-L2-011 | Approve menu |
| POST | `/api/campus/mess/quality-inspections` | W08-L2-012 | Record quality inspection |
| POST | `/api/campus/mess/vendor-contracts` | W08-L2-013 | Create vendor contract |
| PUT | `/api/campus/mess/vendor-contracts/:id/activate` | W08-L2-013 | Activate contract |
| PUT | `/api/campus/mess/vendor-contracts/:id/terminate` | W08-L2-013 | Terminate contract |

#### M08.3 TRANSPORT Sub-Domain

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/api/campus/transport/allocate-bulk` | W08-L2-014 | Bulk transport allocation |
| POST | `/api/campus/transport/allocate` | W08-L2-014 | Single transport allocation |
| POST | `/api/campus/transport/clearance/:studentId` | W08-L2-015 | Initiate transport clearance |
| POST | `/api/campus/transport/trip-logs` | W08-L2-016 | Create trip log |
| PUT | `/api/campus/transport/trip-logs/:id/complete` | W08-L2-016 | Complete trip |
| POST | `/api/campus/transport/attendance` | W08-L2-016 | Record transport attendance |
| PUT | `/api/campus/transport/routes/:id/adjust` | W08-L2-017 | Adjust route with AI input |
| POST | `/api/campus/transport/contractor-contracts` | W08-L2-018 | Create contractor contract |

#### M08.4 LIBRARY Sub-Domain

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/api/campus/library/issue` | W08-L2-020 | Issue book |
| POST | `/api/campus/library/return` | W08-L2-020 | Return book (with auto fine check) |
| POST | `/api/campus/library/renew` | W08-L2-020 | Renew book |
| POST | `/api/campus/library/reserve` | W08-L2-021 | Reserve book |
| PUT | `/api/campus/library/reservations/:id/pickup` | W08-L2-021 | Record pickup |
| POST | `/api/campus/library/clearance/:personId` | W08-L2-022 | Initiate library clearance |
| POST | `/api/campus/library/visits/entry` | W08-L2-023 | Record library entry |
| PUT | `/api/campus/library/visits/:id/exit` | W08-L2-023 | Record library exit |

#### M08.5 LABS Sub-Domain

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/api/campus/labs/equipment` | W08-L2-024 | Register lab equipment |
| POST | `/api/campus/labs/slot-bookings` | W08-L2-025 | Request lab slot booking |
| PUT | `/api/campus/labs/slot-bookings/:id/approve` | W08-L2-025 | Approve booking |
| POST | `/api/campus/labs/equipment-issues` | W08-L2-026 | Issue equipment |
| PUT | `/api/campus/labs/equipment-issues/:id/return` | W08-L2-026 | Return equipment |
| POST | `/api/campus/labs/incidents` | W08-L2-027 | Report lab incident |
| POST | `/api/campus/labs/clearance/:studentId` | W08-L2-028 | Initiate lab clearance |

#### M08.6 FACILITIES Sub-Domain

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/api/campus/facilities/book` | W08-L2-029 | Request facility booking |
| PUT | `/api/campus/facilities/bookings/:id/approve` | W08-L2-029 | Approve booking |
| PUT | `/api/campus/facilities/bookings/:id/cancel` | W08-L2-029 | Cancel booking |
| POST | `/api/campus/facilities/bookings/:id/usage-log` | W08-L2-029 | Record usage |
| GET | `/api/campus/facilities/utilization` | W08-L2-032 | Get utilization metrics |
| GET | `/api/campus/facilities/utilization/:facilityId` | W08-L2-032 | Get facility-specific utilization |

#### M08.7 MAINTENANCE Sub-Domain

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| POST | `/api/campus/maintenance/requests` | W08-L2-034 | Submit maintenance request |
| PUT | `/api/campus/maintenance/requests/:id/triage` | W08-L2-034 | Triage request |
| POST | `/api/campus/maintenance/assignments` | W08-L2-035 | Create work assignment |
| PUT | `/api/campus/maintenance/assignments/:id/complete` | W08-L2-035 | Complete assignment |
| PUT | `/api/campus/maintenance/assignments/:id/verify` | W08-L2-035 | Verify work |
| POST | `/api/campus/maintenance/work-logs` | W08-L2-035 | Add work log entry |
| POST | `/api/campus/maintenance/pm-trigger` | W08-L2-036 | Trigger preventive maintenance |
| GET | `/api/campus/maintenance/escalations` | W08-L2-037 | List active escalations |
| GET | `/api/campus/maintenance/vendor-performance` | W08-L2-038 | Get vendor performance metrics |

#### Cross-Module Endpoints

| Method | Path | Sub-Workflow | Description |
|--------|------|-------------|-------------|
| GET | `/api/campus/clearance/:studentId` | W08-L2-039 | Aggregate clearance status for W10 |
| POST | `/api/campus/provision/:studentId` | W08-L2-040 | Provision infrastructure at enrollment |
| GET | `/api/campus/compliance/evidence` | W08-L2-041 | Get compliance evidence for M10 |
| GET | `/api/campus/governance/metrics` | W08-L2-042 | Get governance dashboard metrics |

**New endpoint count: ~70 workflow-specific endpoints**
**Total after implementation: ~256 endpoints**

---

## 6. State Machine Definitions

### 6.1 Hostel Allocation Lifecycle

```
States: Requested -> AIRecommended -> Confirmed -> Active -> Vacated
                                   \-> Overridden -> Active -> Vacated
                                   \-> Waitlisted -> Active (when vacancy)
                                                  \-> Expired

Transitions:
  Requested -> AIRecommended     : AI allocation algorithm runs
  AIRecommended -> Confirmed     : Warden confirms AI recommendation
  AIRecommended -> Overridden    : Warden overrides (special needs, manual)
  Confirmed -> Active            : Bed assigned, fee triggered
  Overridden -> Active           : Manual assignment confirmed
  Requested -> Waitlisted        : No vacancy
  Waitlisted -> Active           : Vacancy opens, student allocated
  Waitlisted -> Expired          : Student withdraws or year ends
  Active -> Vacated              : Clearance (W08-L2-004) or room change (W08-L2-003)

Side Effects:
  -> Active:     Update Bed (Available->Allocated), HostelRoom (occupancy++),
                 Emit M04 hostel fee event, Activate mess subscription
  -> Vacated:    Update Bed (Allocated->Available), HostelRoom (occupancy--)
```

### 6.2 Maintenance Request Lifecycle

```
States: Submitted -> Triaged -> Assigned -> InProgress -> Completed -> Verified -> Closed
                            \-> Rejected (with reason)
                                          \-> Rework -> Assigned (loop)

Transitions:
  Submitted -> Triaged         : Supervisor sets priority and routing
  Triaged -> Assigned          : Work assignment created (in-house/vendor/external)
  Triaged -> Rejected          : Not a valid maintenance issue
  Assigned -> InProgress       : Worker begins
  InProgress -> Completed      : Worker finishes
  Completed -> Verified        : Facility owner verifies
  Completed -> Rework          : Verification fails
  Rework -> Assigned           : Reassigned for fix
  Verified -> Closed           : All done

SLA Monitoring (parallel):
  Assigned.enteredAt + slaDeadline -> at 80%: Warning notification
  Assigned.enteredAt + slaDeadline -> at 100%: Auto-escalation (W08-L2-037)

Side Effects:
  -> Triaged:    Set slaDeadline based on priority + category
  -> Assigned:   Create MaintenanceAssignment; if vendor: push work order
  -> Completed:  Record MaintenanceWorkLog cost; push cost to M04
  -> Closed:     Update EquipmentMaintenanceLog if equipment; update PM schedule if preventive
```

### 6.3 Library Circulation (Issue Transaction)

```
States: Issued -> Returned
              \-> Overdue -> Returned (with fine)
              \-> Renewed -> Returned | Overdue
              \-> Lost (with replacement cost + fine)

Transitions:
  (new) -> Issued              : Membership active, under limit, book available
  Issued -> Returned           : Book returned on time
  Issued -> Overdue            : dueDate passed (batch job or on-return check)
  Issued -> Renewed            : Renew requested, no pending reservation, max renewals not exceeded
  Issued -> Lost               : Borrower reports lost
  Renewed -> Returned          : Book returned
  Renewed -> Overdue           : Extended dueDate passed
  Overdue -> Returned          : Book returned late (fine assessed)
  Lost -> (terminal)           : Replacement cost + fine assessed

Pre-conditions:
  Issued:   LibraryMember.isActive && !suspended, currentIssued < maxBooks,
            Book.availableCopies > 0 (or no active reservation queue)
  Renewed:  BookReservation for same bookId where status='active' must not exist,
            renewCount < maxRenewals (config)

Side Effects:
  -> Issued:     Book.availableCopies--, LibraryMember.currentIssued++
  -> Returned:   Book.availableCopies++, LibraryMember.currentIssued--
                 If overdue: create LibraryFine -> M04 event
                 If BookReservation active for this book: notify reservation holder
  -> Lost:       Create LibraryFine (reason=lost, amount=replacementCost), LibraryMember.finesDue+=amount
  -> Renewed:    Update dueDate, renewCount++
```

### 6.4 Facility Booking Lifecycle

```
States: Requested -> PendingApproval -> Approved -> Confirmed -> Active -> Completed
                                     \-> Rejected
                  \-> AutoConfirmed -> Active -> Completed
                  \-> Conflict (double booking detected)
                  \-> Cancelled (by requester)

Transitions:
  Requested -> AutoConfirmed     : Self-book tier (classrooms for faculty, config)
  Requested -> PendingApproval   : Approval required per ApprovalChain
  PendingApproval -> Approved    : Approver(s) approve
  PendingApproval -> Rejected    : Approver rejects
  Approved -> Confirmed          : Final approval in multi-level chain
  AutoConfirmed -> Active        : Booking time arrives
  Confirmed -> Active            : Booking time arrives
  Active -> Completed            : Event finishes, usage logged
  Active -> NoShow               : Time passed, no usage log
  * -> Cancelled                 : Requester cancels (any state before Active)

Conflict Resolution (config-driven):
  FCFS:     First booking wins, second gets Conflict -> offer alternative times
  Priority: Higher requester priority wins, lower gets Conflict

Side Effects:
  -> Confirmed:    Send confirmation notification, block time slot in Room
  -> Completed:    Create FacilityUsageLog, release time slot
  -> Cancelled:    Release time slot, notify waitlist if any
  -> NoShow:       Flag for utilization analytics
```

### 6.5 Hostel Discipline Lifecycle

```
States: Reported -> UnderInvestigation -> HearingScheduled -> PenaltyAssigned -> Closed
                                      \-> Dismissed -> Closed

Transitions:
  Reported -> UnderInvestigation   : Warden begins investigation
  UnderInvestigation -> HearingScheduled : Evidence gathered, hearing warranted
  UnderInvestigation -> Dismissed  : Insufficient evidence
  HearingScheduled -> PenaltyAssigned : Hearing outcome: guilty
  HearingScheduled -> Dismissed    : Hearing outcome: not guilty
  PenaltyAssigned -> Closed        : Penalty served or appeal period expired
  Dismissed -> Closed              : Case closed

Appeal Flow (parallel):
  PenaltyAssigned -> AppealFiled -> AppealReview -> Upheld | Modified | Overturned
  If Overturned: HostelPenalty.status -> cancelled
  If Modified: HostelPenalty updated (e.g., fine reduced)

Side Effects:
  -> PenaltyAssigned:  Create HostelPenalty; if fine: M04 event;
                       if severe: M06 welfare signal
  -> Dismissed:        Notify student of dismissal
```

### 6.6 Transport Allocation Lifecycle

```
States: Requested -> Matched -> Active -> Cancelled
                  \-> Waitlisted -> Active (on capacity)
                                 \-> Expired

Transitions:
  Requested -> Matched         : Route and stop matched to student address
  Matched -> Active            : Coordinator confirms, fee triggered
  Requested -> Waitlisted      : Route at capacity
  Waitlisted -> Active         : Capacity freed (vehicle added or student dropped)
  Active -> Cancelled          : Clearance (W08-L2-015) or student opts out

Side Effects:
  -> Active:     Emit M04 transport fee event; send route/stop/timing to student
  -> Cancelled:  Remove from route ridership count; if clearance: return status to W10
```

---

## 7. Business Logic Requirements

### 7.1 Hostel Room Allocation Algorithm

**Three configurable strategies (per college config):**

```typescript
interface AllocationConfig {
  algorithm: 'preference_based' | 'capacity_first' | 'hybrid';
  preferenceWeight: number;    // 0.0-1.0, used in hybrid mode
  capacityWeight: number;      // 0.0-1.0, used in hybrid mode
  specialNeedsAutoFlag: boolean;
  siblingCoAllocationEnabled: boolean;
}

interface AllocationInput {
  studentId: string;
  gender: 'male' | 'female' | 'other';
  preferences: {
    blockPreference?: string;     // preferred block name
    floorPreference?: number;     // preferred floor
    roomTypePreference?: 'single' | 'double' | 'triple';
    roommatePreference?: string;  // preferred roommate studentId
  };
  specialNeeds?: {
    accessibility: boolean;       // wheelchair, ground floor
    medical: string;              // medical condition requiring specific room
  };
  admissionCategory: string;      // for reservation-aware allocation
  conflictHistory: string[];      // student IDs with prior conflict
}

interface AllocationResult {
  bedId: string;
  roomId: string;
  blockId: string;
  matchScore: number;             // 0-100
  allocationMethod: 'ai_recommended' | 'manual_override' | 'waitlist';
  reasonCodes: string[];          // why this bed was chosen
  requiresHumanReview: boolean;   // true for special needs, edge cases
}
```

**Algorithm logic:**
1. Filter eligible blocks by gender
2. Filter rooms by availability (Bed.status = 'available')
3. If special needs: filter to accessible rooms, flag for human review
4. Score each available bed:
   - Preference match (block, floor, room type, roommate): 0-40 points
   - Conflict avoidance (no conflictHistory students in same room): 0-20 points
   - Occupancy balance (prefer rooms that are not nearly full for better social mix): 0-20 points
   - Proximity to preferred amenities: 0-20 points
5. Apply algorithm weight:
   - preference_based: sort by preference score only
   - capacity_first: fill rooms sequentially, no preference scoring
   - hybrid: weighted combination (preferenceWeight * preference + capacityWeight * fill_order)
6. Return top recommendation with matchScore

### 7.2 Mess Attendance and Billing

**Two billing models:**

```typescript
// Coupon Model
interface CouponMealFlow {
  // Pre: student has coupon balance (tracked in MealTransaction running balance)
  steps: [
    'verify_coupon_balance >= 1',
    'create MealTransaction(type=coupon_deduct, amount=-1)',
    'update running balance',
    'if balance <= warning_threshold: notify student'
  ];
  exception: 'balance_exhausted -> block OR allow_credit per config';
}

// Fixed Fee Model
interface FixedFeeFlow {
  // Pre: student has active MessSubscription
  steps: [
    'verify MessSubscription.status = active',
    'record meal attendance (date, mealType)',
    'no per-meal transaction needed'
  ];
  fee_trigger: 'Monthly fee via M04, set up at subscription activation';
}
```

### 7.3 Transport Route Optimization

```typescript
interface RouteOptimizationInput {
  currentRoutes: TransportRoute[];
  ridership: TransportAttendance[];  // historical
  allocations: TransportAllocation[];
  academicCalendar: AcademicEvent[]; // exam periods, holidays
}

interface RouteOptimizationOutput {
  recommendations: {
    routeId: string;
    action: 'add_vehicle' | 'remove_vehicle' | 'add_stop' | 'remove_stop' | 'merge_routes' | 'split_route';
    reason: string;
    projectedDemand: number;
    currentCapacity: number;
    confidence: number;
  }[];
}
```

**Logic:**
1. Aggregate ridership by route, stop, time period
2. Calculate utilization rate per route (avg_riders / capacity)
3. Identify: underutilized routes (<30% utilization), overcrowded (>90%), unused stops (<5 riders)
4. Cross-reference with allocation data (students who have allocation but low attendance)
5. Factor in academic calendar (exam week = lower transport, event days = higher)
6. Generate recommendations with confidence scores

### 7.4 Library Fine Calculation

```typescript
interface FineCalculationConfig {
  overdueFinePerDay: number;          // e.g., 1.00 (INR)
  maxOverdueFine: number;             // e.g., 100.00 (cap)
  lostBookReplacementMultiplier: number;  // e.g., 2.0x purchase price
  damagedBookFine: number;           // flat or percentage of value
  gracePeriodDays: number;           // e.g., 1 day grace
  waiverAuthority: {
    librarian: number;               // can waive up to this amount
    chiefLibrarian: number;          // can waive up to this amount
    principal: number;               // unlimited
  };
}

function calculateFine(issue: BookIssue, returnDate: Date, config: FineCalculationConfig): number {
  const daysOverdue = diffDays(returnDate, issue.dueDate) - config.gracePeriodDays;
  if (daysOverdue <= 0) return 0;
  return Math.min(daysOverdue * config.overdueFinePerDay, config.maxOverdueFine);
}

function calculateLostFine(book: Book, config: FineCalculationConfig): number {
  const replacementCost = (book.purchaseCost || book.estimatedValue || 500) * config.lostBookReplacementMultiplier;
  return replacementCost;
}
```

### 7.5 Lab Scheduling and Conflict Detection

```typescript
interface LabConflictCheck {
  labId: string;
  requestedDate: Date;
  startTime: string;
  endTime: string;
}

async function checkLabConflict(check: LabConflictCheck): Promise<{
  hasConflict: boolean;
  conflictType: 'academic_schedule' | 'existing_booking' | null;
  conflictDetails: string | null;
}> {
  // 1. Check M03 academic timetable for this lab on this date/time
  //    M03 schedule is authoritative -- academic always wins
  // 2. Check existing LabSlotBookings for overlap
  // 3. Return first conflict found
}
```

### 7.6 Predictive Maintenance

```typescript
interface PredictiveMaintenanceInput {
  equipmentId: string;
  usageHours: number;
  maintenanceHistory: EquipmentMaintenanceLog[];
  failureHistory: MaintenanceRequest[];  // past corrective maintenance
  environmentalFactors?: {
    temperature: number;
    humidity: number;
    dustLevel: string;
  };
}

interface PredictiveMaintenanceOutput {
  failureProbability: number;         // 0.0 - 1.0
  recommendedMaintenanceDate: Date;
  confidence: number;                 // 0.0 - 1.0
  suggestedActions: string[];
  autoSchedule: boolean;              // true if confidence > threshold
}
```

**Logic (rule-based initially, ML later):**
1. Calculate time since last maintenance
2. Compare to manufacturer-recommended interval
3. Factor in usage hours (high use = sooner maintenance)
4. Check failure pattern (equipment with multiple corrective requests = higher priority)
5. If failureProbability > threshold (config, default 0.7) AND confidence > threshold (config, default 0.6): auto-schedule PM
6. Otherwise: flag for supervisor review

---

## 8. Cross-Module Integration Points

### 8.1 M02 People & Identity (READ)

| Consumer | Data Needed | Trigger |
|----------|-------------|---------|
| W08-L2-001 (Hostel allocation) | Student gender, category, special needs | At allocation |
| W08-L2-002 (Mid-year allocation) | S5 flag change event | On is_hosteler change |
| W08-L2-010 (Mess ops) | Student identity verification | At meal service |
| W08-L2-014 (Transport allocation) | Student address/location | At allocation |
| W08-L2-020 (Library issue) | Person identity (student/faculty) | At issue |

**Integration pattern**: Direct service call to M02 People service. No event bus needed -- synchronous read.

### 8.2 M04 Finance & Fees (WRITE)

| Producer | Event | Data |
|----------|-------|------|
| W08-L2-001 | `hostel.fee.trigger` | studentId, feeType=hostel, academicYearId, amount (from config) |
| W08-L2-002 | `hostel.fee.trigger.prorated` | studentId, feeType=hostel, proratedFromDate, amount |
| W08-L2-007 | `hostel.fine.created` | studentId, fineType=discipline, amount, violationId |
| W08-L2-010 | `mess.fee.trigger` | studentId, feeType=mess, billingModel, amount |
| W08-L2-014 | `transport.fee.trigger` | studentId, feeType=transport, routeId, amount |
| W08-L2-020 | `library.fine.created` | personId, fineType=overdue/lost/damaged, amount, bookIssueId |
| W08-L2-035 | `maintenance.cost.recorded` | requestId, cost, vendorId |

**Integration pattern**: BullMQ event queue. M08 publishes fee/fine events; M04 subscribes and creates fee records. This decouples M08 from M04 implementation details.

### 8.3 M06 Welfare (WRITE -- Signals)

| Signal Source | Signal Type | Severity | Data |
|---------------|------------|----------|------|
| W08-L2-005 | `attendance_anomaly` | medium/high | studentId, consecutiveAbsences, pattern |
| W08-L2-007 | `discipline_violation` | high/critical | studentId, violationType, if substance: critical |
| W08-L2-009 | `warden_concern` | low/medium/high/critical | studentId, concernType, description, evidence |
| W08-L2-027 | `lab_incident_injury` | high/critical | personId, incidentType, injuryDetails |
| W08-L2-031 | `campus_incident` | medium/high/critical | incidentId, personsInvolved, type |

**Integration pattern**: Structured welfare signal via BullMQ queue `welfare.signals`. M06.9 CCD (Concern Case Detection) subscribes and creates case records.

```typescript
interface WelfareSignal {
  source: 'M08.1' | 'M08.5' | 'M08.6';
  signalType: 'attendance_anomaly' | 'warden_concern' | 'discipline_violation' | 'lab_incident_injury' | 'campus_incident';
  severity: 'low' | 'medium' | 'high' | 'critical';
  studentId?: string;
  personId?: string;
  description: string;
  evidence?: string[];
  metadata: Record<string, any>;
}
```

### 8.4 M10 Compliance (WRITE -- Evidence)

| Evidence Type | Source Sub-Workflows | NAAC Criterion | Data |
|---------------|---------------------|---------------|------|
| Hostel capacity & occupancy | W08-L2-001-004 | VII (Institutional Values) | blocks, rooms, beds, occupancy rates |
| Library holdings & circulation | W08-L2-019-023 | IV (Infrastructure) | book count, circulation volume, digital resources, usage stats |
| Lab equipment & utilization | W08-L2-024-028 | IV / NBA | equipment inventory, utilization rates, maintenance records |
| Facility utilization | W08-L2-029-032 | IV (Infrastructure) | room utilization, no-show rates, peak hours |
| Maintenance records | W08-L2-034-038 | IV | upkeep evidence, response times, resolved rate |

**Integration pattern**: Batch API endpoint (`/api/campus/compliance/evidence`) that M10 calls on-demand or on a schedule. Returns structured JSON per criterion.

### 8.5 M11 Governance (WRITE -- Dashboards)

| Metric Category | Source | Data Points |
|----------------|--------|-------------|
| Facility utilization | W08-L2-032 | utilization_rate, peak_hours, no_show_rate per facility |
| Maintenance health | W08-L2-035-037 | open_requests, avg_response_time, backlog, vendor_sla_compliance |
| Mess quality | W08-L2-012 | avg_hygiene_score, avg_food_quality_score, feedback_avg_rating |
| Transport efficiency | W08-L2-016-017 | ridership_utilization, route_efficiency, on_time_rate |
| Library activity | W08-L2-020-023 | circulation_volume, active_members, visit_count, peak_hours |
| Hostel occupancy | W08-L2-001-005 | block_occupancy_rates, attendance_rate, violation_count |

**Integration pattern**: REST API endpoint (`/api/campus/governance/metrics`) with date range and metric category filters.

### 8.6 M12 Platform -- AI (CONSUME)

| AI Capability | Consumer | Integration |
|---------------|----------|-------------|
| Hostel Room Allocation Optimization | W08-L2-001, 002 | Call M12.3 AI engine with student data; receive recommendation + match_score |
| Roommate Compatibility Scoring | W08-L2-001, 003 | Advisory scoring for roommate pairs |
| Transport Demand Prediction | W08-L2-014, 017 | Historical ridership -> predicted demand by route/time |
| Predictive Maintenance Scheduling | W08-L2-036 | Equipment data -> failure probability + recommended PM date |
| Facility Utilization Insights | W08-L2-032, 042 | Booking/usage data -> patterns, underused facilities |
| Library Demand Forecasting | W08-L2-019 | Circulation history + syllabus -> acquisition priorities |

**Integration pattern**: Service-to-service call to M12.3 AI engine. AI provides recommendations; human (warden/coordinator/librarian) confirms or overrides. All AI outputs are advisory unless confidence exceeds auto-schedule threshold (configurable).

### 8.7 W01 Enrollment Trigger (CONSUME)

W01-L2-036 (enrollment complete) triggers W08-L2-040 (provision infrastructure):
- Payload: `{ studentId, is_hosteler, uses_transport, preferences }`
- M08 runs parallel provisioning and signals completion back to W01

### 8.8 W10 Exit Clearance (PROVIDE)

W10 calls W08-L2-039 (aggregate clearance):
- Endpoint: `GET /api/campus/clearance/:studentId`
- Response: `{ status: 'ALL_CLEAR' | 'BLOCKED', items: ClearanceItem[] }`
- Each ClearanceItem: `{ subDomain, status, blockingReasons[] }`

---

## 9. AI Agent Scope (Juvi)

### 9.1 Student-Facing AI (via Juvi)

| Capability | Sub-Workflows | Description |
|------------|--------------|-------------|
| Menu display | W08-L2-010, 011 | Show today's and upcoming mess menus |
| Mess feedback collection | W08-L2-010 | Collect meal ratings and comments via conversational UI |
| Library catalogue search | W08-L2-019 | Search book catalogue, check availability, show reservation option |
| Book reservation | W08-L2-021 | Assist with reservation through conversational flow |
| Hostel leave request | W08-L2-006 | Guide student through leave request submission |
| Maintenance request | W08-L2-034 | Help student submit maintenance request with guided input |
| Route information | W08-L2-016 | Show student's transport route, timings, live status (if GPS) |
| Facility availability | W08-L2-029 | Check and show available facility slots |

### 9.2 Staff-Facing AI (via Admin Portal)

| Capability | Persona | Description |
|------------|---------|-------------|
| Allocation recommendations | Warden (ST6) | Present AI-recommended hostel allocations with match scores |
| Attendance anomaly alerts | Warden (ST6) | Surface attendance pattern anomalies requiring review |
| Maintenance triage assistance | Maintenance Supervisor (ST6) | Suggest priority and routing based on historical patterns |
| Route optimization suggestions | Transport Coordinator (ST6) | Surface demand predictions and route adjustment recommendations |
| Predictive maintenance alerts | Maintenance Supervisor (ST6) | Show equipment at risk of failure with confidence scores |

---

## 10. Configuration Dependencies

### 10.1 Campus Life Configuration Entity

A new `CampusConfig` entity (or extension of existing M12 platform config) per college:

```typescript
interface ICampusConfig {
  collegeId: ObjectId;

  // M08.1 HOSTEL
  hostel: {
    allocationAlgorithm: 'preference_based' | 'capacity_first' | 'hybrid';
    preferenceWeight: number;
    capacityWeight: number;
    specialNeedsAutoFlag: boolean;
    siblingCoAllocationEnabled: boolean;
    attendanceAnomalyThreshold: number;  // consecutive absent days
    leaveApprovalRequired: boolean;
    appealDeadlineDays: number;
  };

  // M08.2 MESS
  mess: {
    billingModel: 'fixed_fee' | 'coupon';
    operationModel: 'in_house' | 'outsourced' | 'hybrid';
    couponWarningThreshold: number;
    allowCreditOnExhaustion: boolean;
  };

  // M08.3 TRANSPORT
  transport: {
    fleetModel: 'owned' | 'contracted' | 'mixed';
    routeAllocationPolicy: 'auto_assign_nearest' | 'student_selects';
    gpsTrackingEnabled: boolean;
  };

  // M08.4 LIBRARY
  library: {
    systemMode: 'juvion_native' | 'ilms_integration' | 'hybrid';
    ilmsProvider?: 'koha' | 'soul' | 'other';
    overdueFinePerDay: number;
    maxOverdueFine: number;
    lostBookReplacementMultiplier: number;
    gracePeriodDays: number;
    maxRenewals: number;
    reservationPickupWindowHours: number;
    fineWaiverThresholds: {
      librarian: number;
      chiefLibrarian: number;
    };
  };

  // M08.5 LABS
  labs: {
    bookingApprovalTier: 'auto' | 'technician' | 'hod';
    equipmentDamageLiability: 'student' | 'insurance' | 'department';
  };

  // M08.6 FACILITIES
  facilities: {
    bookingApprovalTiers: {
      classroom: 'self_book' | 'single' | 'multi';
      seminar_hall: 'self_book' | 'single' | 'multi';
      auditorium: 'self_book' | 'single' | 'multi';
      conference: 'self_book' | 'single' | 'multi';
    };
    conflictResolution: 'fcfs' | 'priority';
  };

  // M08.7 MAINTENANCE
  maintenance: {
    defaultAssignmentRouting: 'in_house' | 'amc_vendor' | 'external';
    escalationWarningThresholdPercent: number;   // default 80
    escalationAutoThresholdPercent: number;       // default 100
    pmConfidenceThreshold: number;                // default 0.6
    pmAutoScheduleConfidenceThreshold: number;    // default 0.7
  };
}
```

---

## 11. Implementation Phases

### Phase 1: Entity Foundation & Model Migration (Week 1-2)

**Objective**: Create all missing models, migrate welfare models, enrich existing models.

1. **Create 26 new models** in `backend/src/models/campus/` and `backend/src/models/facilities/` per Section 4.1
2. **Migrate 6 welfare models** to campus entity group:
   - `welfare/HostelBlock.ts` -> `campus/HostelBlock.ts` (add fields per Section 4.2)
   - `welfare/HostelRoom.ts` -> `campus/HostelRoom.ts`
   - `welfare/HostelAllocation.ts` -> `campus/HostelAllocation.ts`
   - `welfare/HostelVisitorLog.ts` -> `campus/HostelVisitorLog.ts`
   - `welfare/MessMenu.ts` -> `campus/Menu.ts`
   - `welfare/TransportRoute.ts` -> `campus/TransportRoute.ts` (normalize stops)
   - `welfare/TransportAllocation.ts` -> `campus/TransportAllocation.ts`
   - `welfare/MessFeedback.ts` -> reference from campus-ops
3. **Enrich existing models** per Section 4.2 (MaintenanceRequest, Vehicle, RoomBooking, Book, etc.)
4. **Create 7 supporting models** per Section 4.3
5. **Create CampusConfig model** per Section 10.1
6. **Update model index** (`models/index.ts`) with all new/migrated models
7. **Add Zod validation schemas** for all new entities

**Deliverables**: 33 new + 8 enhanced models, all with TypeScript interfaces, Mongoose schemas, indexes, and Zod validations.

### Phase 2: Core Workflow Engine -- Hostel + Library (Week 3-4)

**Objective**: Implement the two most complex sub-domains end-to-end.

1. **M08.1 Hostel** (W08-L2-001 through W08-L2-009):
   - Hostel allocation state machine (Section 6.1)
   - Allocation algorithm (Section 7.1) -- rule-based initially, AI placeholder
   - Attendance recording with anomaly detection (rule-based)
   - Leave request workflow with parent notification placeholder
   - Discipline violation lifecycle with penalty and appeal state machines
   - Hostel clearance for W10
   - Welfare signal emission (M06 integration via BullMQ queue)

2. **M08.4 Library** (W08-L2-019 through W08-L2-023):
   - Circulation state machine (Section 6.3)
   - Fine calculation engine (Section 7.4)
   - Reservation lifecycle with notification placeholder
   - Library clearance for W10
   - Visit tracking (immutable log)

3. **18 new hostel endpoints + 8 library endpoints**
4. **Unit tests** for state machines, allocation algorithm, fine calculation

### Phase 3: Transport + Mess + Labs (Week 5-6)

**Objective**: Implement remaining sub-domain workflows.

1. **M08.3 Transport** (W08-L2-014 through W08-L2-018):
   - Transport allocation state machine (Section 6.6)
   - Route matching logic
   - Daily trip operations (TripLog, TransportAttendance)
   - Transport clearance for W10
   - Contractor management

2. **M08.2 Mess** (W08-L2-010 through W08-L2-013):
   - Dual billing model (coupon vs. fixed fee)
   - Menu planning and publishing
   - Quality inspection flow
   - Vendor contract lifecycle

3. **M08.5 Labs** (W08-L2-024 through W08-L2-028):
   - Equipment inventory lifecycle
   - Lab slot booking with M03 conflict check
   - Equipment issue/return with liability
   - Lab incident handling with welfare signals
   - Lab clearance for W10

4. **~25 new endpoints across three sub-domains**
5. **Unit tests** for transport matching, billing models, conflict detection

### Phase 4: Facilities + Maintenance + Cross-Module (Week 7-8)

**Objective**: Implement facilities booking, maintenance engine, and all cross-module integrations.

1. **M08.6 Facilities** (W08-L2-029 through W08-L2-033):
   - Facility booking state machine (Section 6.4)
   - Configurable approval chains
   - Utilization tracking
   - Sports equipment via Asset model
   - Visitor entry enhancement

2. **M08.7 Maintenance** (W08-L2-034 through W08-L2-038):
   - Maintenance request state machine (Section 6.2)
   - Assignment routing (in-house/AMC/external)
   - SLA monitoring with auto-escalation (BullMQ scheduled job)
   - Vendor performance tracking
   - Preventive maintenance scheduling (rule-based)

3. **Cross-Module Integration** (W08-L2-039 through W08-L2-042):
   - W10 clearance aggregation endpoint
   - W01 enrollment provisioning endpoint
   - M10 compliance evidence API
   - M11 governance metrics API

4. **~20 new endpoints**
5. **Integration tests** for cross-module flows

### Phase 5: AI Integration + S5 Visibility + Polish (Week 9-10)

**Objective**: Connect AI capabilities and enforce S5 visibility rules.

1. **AI Integration** (all M12.3 consumers):
   - Wire hostel allocation algorithm to M12.3 AI engine
   - Wire transport demand prediction
   - Wire predictive maintenance scheduling
   - Wire facility utilization insights
   - Wire library demand forecasting
   - All with human-in-the-loop confirmation

2. **S5 Visibility Enforcement**:
   - Hostel sub-domain visible only to is_hosteler=true students
   - Mess sub-domain visible only to hostelers
   - Transport sub-domain visible only to uses_transport=true students
   - Maintenance request scope differs by S5 (hostelers: hostel + common; day scholars: common only)
   - Library, Labs, Facilities: visible to all

3. **BullMQ Job Setup**:
   - Fee/fine event publishers for M04
   - Welfare signal publishers for M06
   - SLA monitoring cron job for maintenance escalation
   - Reservation expiry cron job for library
   - Attendance anomaly detection cron job for hostel

4. **E2E Tests** for critical workflows:
   - Hostel allocation (bulk) -> fee trigger -> clearance
   - Library issue -> overdue -> fine -> clearance
   - Maintenance request -> assign -> escalation -> close
   - Facility booking -> approval chain -> usage log
   - W10 clearance aggregation

5. **Admin Portal** UI stubs for:
   - Warden dashboard (hostel allocation, attendance, violations)
   - Library circulation desk
   - Maintenance supervisor dashboard
   - Transport coordinator dashboard
   - Facility booking calendar view

---

## Appendix A: S5 Feature Flag Visibility Matrix

| Sub-Workflow | is_hosteler=true | is_hosteler=false | uses_transport=true |
|-------------|-----------------|-------------------|---------------------|
| W08-L2-001 to 009 (Hostel) | APPLICABLE | N/A | -- |
| W08-L2-010 to 013 (Mess) | APPLICABLE | N/A | -- |
| W08-L2-014 to 018 (Transport) | CONDITIONAL | CONDITIONAL | APPLICABLE |
| W08-L2-019 to 023 (Library) | ALL | ALL | -- |
| W08-L2-024 to 028 (Labs) | ALL | ALL | -- |
| W08-L2-029 to 033 (Facilities) | ALL | ALL | -- |
| W08-L2-034 (Maint Request) | HOSTEL + COMMON | COMMON ONLY | -- |
| W08-L2-035 to 038 (Maint Ops) | ALL | ALL | -- |
| W08-L2-039 (Clearance) | CONDITIONAL | CONDITIONAL | CONDITIONAL |
| W08-L2-040 (Provisioning) | CONDITIONAL | CONDITIONAL | CONDITIONAL |

---

## Appendix B: Exception Path Registry (54 exceptions)

| ID | Sub-Domain | Name | Severity | Resolution |
|----|-----------|------|----------|------------|
| EX-001 | HOSTEL | No vacancy at intake | Medium | Waitlist; emergency allocation if welfare |
| EX-002 | HOSTEL | Special needs override | High | Human assigns accessible room |
| EX-003 | HOSTEL | Sibling co-allocation | Low | Manual override by warden |
| EX-004 | HOSTEL | Mid-year no vacancy | Medium | Waitlist with priority |
| EX-005 | HOSTEL | Welfare emergency allocation | Critical | Priority bypass normal queue |
| EX-006 | HOSTEL | Conflict -> welfare referral | High | Escalate to M06; room change |
| EX-007 | HOSTEL | No suitable room for change | Low | Deferred; next-available queue |
| EX-008 | HOSTEL | Damage at exit | Medium | Liability assessment |
| EX-009 | HOSTEL | Outstanding hostel dues | Medium | Clearance blocked until M04 resolved |
| EX-010 | HOSTEL | Card swipe system down | Low | Fallback manual roll call |
| EX-011 | HOSTEL | Absent without leave | Medium | Warden concern report |
| EX-012 | HOSTEL | Student doesn't return from leave | Medium | Contact student/parent; M06 if prolonged |
| EX-013 | HOSTEL | Emergency leave retroactive | Low | Retroactive approval |
| EX-014 | HOSTEL | Substance abuse | Critical | Mandatory M06 referral |
| EX-015 | HOSTEL | Property damage | Medium | Liability + M04 fine |
| EX-016 | HOSTEL | Appeal deadline missed | Low | Auto-rejected |
| EX-017 | HOSTEL | Critical welfare observation | Critical | Immediate escalation chain |
| EX-018 | HOSTEL | Ragging complaint | Critical | Anti-ragging committee referral |
| EX-019 | MESS | Coupon exhausted | Low | Notify; block or credit per config |
| EX-020 | MESS | Dietary need unmet | Medium | Escalate to coordinator |
| EX-021 | MESS | Severe hygiene failure | Critical | Immediate mess closure |
| EX-022 | MESS | Vendor contract termination | High | Transition to new vendor |
| EX-023 | MESS | Vendor walks out | Critical | Emergency catering |
| EX-024 | TRANSPORT | No nearby route | Medium | Inform; suggest alternatives |
| EX-025 | TRANSPORT | Route overcapacity | Medium | Additional vehicle or waitlist |
| EX-026 | TRANSPORT | Outstanding transport dues | Medium | Clearance blocked |
| EX-027 | TRANSPORT | Vehicle breakdown | High | Emergency substitute |
| EX-028 | TRANSPORT | Driver absence | Medium | Substitute driver |
| EX-029 | TRANSPORT | New area demand | Low | New route proposal |
| EX-030 | TRANSPORT | Contractor pulls vehicles | Critical | Emergency fleet arrangement |
| EX-031 | LIBRARY | ILMS sync failure | Medium | Fallback to Juvion-native |
| EX-032 | LIBRARY | Book lost | Medium | Replacement cost + fine |
| EX-033 | LIBRARY | Membership suspended | Medium | Issue blocked |
| EX-034 | LIBRARY | Reservation expires | Low | Next in queue notified |
| EX-035 | LIBRARY | Lost book at exit | Medium | Replacement charge |
| EX-036 | LABS | Schedule conflict | Low | Non-academic booking rescheduled |
| EX-037 | LABS | Equipment damaged | Medium | Liability per policy |
| EX-038 | LABS | Serious injury | Critical | Emergency protocol + M06 |
| EX-039 | LABS | Equipment not returned at exit | Medium | Replacement charge |
| EX-040 | FACILITIES | Double booking | Medium | FCFS or priority per config |
| EX-041 | FACILITIES | Last-minute cancellation | Low | Slot released |
| EX-042 | FACILITIES | Sports equipment damaged | Low | Replacement policy |
| EX-043 | FACILITIES | Visitor involved in incident | Medium | Verify entry record |
| EX-044 | FACILITIES | Theft/vandalism | Critical | Police coordination |
| EX-045 | FACILITIES | Unverified visitor | Low | Security protocol |
| EX-046 | MAINT | Emergency maintenance | Critical | Skip triage queue |
| EX-047 | MAINT | Vendor SLA breach | High | Escalation |
| EX-048 | MAINT | Rework needed | Medium | Assignment reopened |
| EX-049 | MAINT | Low AI confidence | Low | Supervisor reviews |
| EX-050 | MAINT | Deferred PM | Medium | Risk logged and tracked |
| EX-051 | MAINT | Chronic vendor failure | High | Contract review/termination |
| EX-052 | MAINT | Vendor below threshold | High | Contract termination |
| EX-053 | Cross-Module | Partial clearance | Medium | W10 shows remaining items |
| EX-054 | Cross-Module | Provisioning failure | High | W01 enrollment blocked |

---

## Appendix C: W10 Clearance Protocol

| Clearance Item | Sub-Domain | Checks | Blocking Conditions |
|---------------|-----------|--------|---------------------|
| Hostel Clearance | M08.1 | Room vacated, keys returned, damage assessed, dues cleared (M04) | Room not vacated; keys missing; damage unresolved; dues outstanding |
| Mess Clearance | M08.2 | Subscription closed, no outstanding mess dues | Outstanding mess dues |
| Transport Clearance | M08.3 | Allocation removed, transport dues cleared (M04) | Outstanding transport dues |
| Library Clearance | M08.4 | All books returned, all fines paid (M04) | Outstanding books; unpaid fines |
| Lab Clearance | M08.5 | All equipment returned, lab fees cleared (M04) | Outstanding equipment; unpaid fees |
| Aggregated M08 | Cross-Module | All applicable sub-domain clearances = Cleared | Any sub-domain = Blocked |

**Clearance endpoint contract**:

```typescript
// GET /api/campus/clearance/:studentId
interface ClearanceResponse {
  studentId: string;
  overallStatus: 'ALL_CLEAR' | 'BLOCKED' | 'PARTIAL';
  items: {
    subDomain: 'hostel' | 'mess' | 'transport' | 'library' | 'labs';
    applicable: boolean;          // false if student didn't use this sub-domain
    status: 'cleared' | 'blocked' | 'not_applicable';
    clearanceId?: string;
    blockingReasons: string[];
  }[];
  clearedAt?: Date;               // timestamp when all items cleared
}
```

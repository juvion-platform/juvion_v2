# Frappe HR / ERPNext Integration — Build-vs-Buy Decision

**Source:** `Juvion_vs_CampX_Strategic_Comparison.pdf` §4.8 — "PARITY DEFERRABLE — but make the build-vs-buy call now."

## The decision

**Buy.** Juvion will integrate ERPNext / Frappe HR as the personnel-side
HR engine via an event-bridge. Juvion **owns the academic-side data
model** (Faculty Profile, accreditation reporting, teaching workload).
ERPNext **owns the personnel-side** (leave, payroll, expenses,
shifts, comp-leave).

## Why buy

The doc's argument lands:

1. **Commodity feature.** Salary slips and leave forms are not how
   institutions pick an ERP. Institutions switch ERPs over admissions
   conversion rate, NAAC evidence assembly time, and student-default
   prediction — not how their payslip looks.

2. **Six engineering-months minimum.** Payroll-grade leave, statutory
   PF/ESI/TDS, Tally export, shift management with compensatory rules,
   gratuity calculation — every state's rules differ. ERPNext has
   8 years of Indian compliance fixes baked in.

3. **CampX itself buys.** Their inventory tags 8 entities as Frappe
   DocTypes: LeaveBalance, LeaveRequest, LeavePolicy, AttendanceLog,
   AttendanceRequest, SalarySlip, ExpenseClaim, ShiftRequest,
   CompensatoryLeaveRequest. If the market leader is using Frappe,
   doing it ourselves is a strategic distraction.

4. **Differentiation moves UP the stack, not down.** AI-driven leave
   auto-approval (workload-aware), attrition prediction, appraisal
   summaries — these are the wins. Frappe is the data layer we feed.
   Juvion adds intelligence on top.

## What Juvion keeps

- **Faculty Profile** — NAAC-shaped credential IDs, sub-collections,
  verification workflow (Strategic Gap 1). This is academic-side HR.
- **FacultyWorkload, FDPRecord, Publication, ResearchProject,
  AppraisalCycle, HiringRequisition, JobApplication, Recruitment,
  SelectionCommittee** — academic-side and AI-augmented.
- **DisciplinaryCase, Grievance, ExitClearance** — institution-level
  policy concerns, not commodity HR.

## What ERPNext owns (when integrated)

Per the doc's named entities + CampX's confirmed Frappe DocTypes:

| Juvion entity (current)        | ERPNext / Frappe HR DocType         | Status                          |
|--------------------------------|--------------------------------------|---------------------------------|
| LeaveBalance                   | `Leave Allocation` / `Leave Ledger`  | Already in Juvion; bridge syncs  |
| LeaveApplication               | `Leave Application`                  | Already in Juvion; bridge syncs  |
| LeaveType                      | `Leave Type` / `Leave Policy`        | Already in Juvion; bridge syncs  |
| EmployeeAttendance             | `Attendance` / `Attendance Request`  | Already in Juvion; bridge syncs  |
| Payroll                        | `Salary Slip` / `Salary Structure`   | Already in Juvion; bridge syncs  |
| _(not yet modelled)_           | `Expense Claim`                      | Defer to ERPNext entirely        |
| _(not yet modelled)_           | `Shift Request`                      | Defer to ERPNext entirely        |
| _(not yet modelled)_           | `Compensatory Leave Request`         | Defer to ERPNext entirely        |
| Employee                       | `Employee` (master)                  | Juvion is the canonical source;  |
|                                |                                      | bridge pushes upserts to ERPNext  |

## Bridge architecture

Event-driven, one-way push from Juvion → ERPNext (Phase A) with
read-back via webhooks (Phase B). Lives under M12 Platform.

```
Juvion event bus  →  ERPNextBridge listener  →  HTTP POST → ERPNext REST API
       │
       └→  IntegrationLog (existing model) records every call.
```

Per-college config (`ERPNextBridgeConfig`):
- `baseUrl` (e.g. `https://erpnext.example-college.in`)
- `apiKeyRef` (reference to a secret in the secrets vault; never in
  Mongo plaintext)
- `enabled` (toggle from the admin UI)
- `lastSyncAt`, `failureCount`, `lastError`

Event mapping registry (`erpnext-mapping.ts`):
- Maps Juvion event name → ERPNext DocType + payload transformer.
- New mappings = registry append, no new code.

## Phase A — this commit

1. `ERPNextBridgeConfig` model under platform/.
2. `erpnext-bridge-service.ts` skeleton: config CRUD, status reads,
   event listener registration that records to IntegrationLog. The
   actual outbound HTTP push is **stubbed** (logs to IntegrationLog
   with `status: 'unimplemented'`) until the Phase B wire-up.
3. Three new routes: `GET /platform/integrations/erpnext`,
   `PUT /platform/integrations/erpnext`,
   `POST /platform/integrations/erpnext/test`.
4. Frontend: `IntegrationsPage` under M12 Platform with the bridge
   config + status + a "Test Connection" button (stub-aware).
5. Subscribes to 5 events that map to ERPNext DocTypes (employee
   created/updated, leave applied/approved, payroll-finalised).

## Phase B — deferred

- Outbound HTTP push to ERPNext REST API (replace stub).
- Webhook receiver for ERPNext → Juvion reverse-sync (payroll
  computed, leave approved on ERPNext side).
- Retry + dead-letter queue (BullMQ).
- Field-level mapping editor in the admin UI.
- Secrets vault integration for `apiKeyRef`.

## Phase C — differentiation

- AI leave auto-approval (workload-aware): Juvion's M05 reads the
  applicant's teaching schedule + FacultyWorkload, scores the impact
  of granting the leave, and either approves silently or routes to
  HoD with a recommendation.
- Attrition prediction agent feeding M11 governance dashboards.

## Why this is the right call NOW (not later)

The doc says **make the build-vs-buy call now**, not the integration
itself. The risk of NOT deciding: we accidentally build personnel-HR
features over the next 3-6 sprints because the gap feels small each
time. Each "small" feature compounds into the 6-month commitment
we're explicitly avoiding.

Committing to the bridge today + adopting the "Juvion is the
intelligence layer, ERPNext is the data layer" framing means every
future HR-shaped request gets routed: academic-side → Juvion
roadmap. Personnel-side → ERPNext config or Phase B bridge ticket.

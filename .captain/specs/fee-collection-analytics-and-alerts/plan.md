# Plan: Fee Collection Analytics & Alerts

**Stack:** MERN TypeScript — Node 20 + Express 4 + Mongoose 8 + React 19 + Vite + BullMQ 5 + ioredis 5 + recharts
**Test runner:** Vitest + mongodb-memory-server (+ `__e2e__` harness)
**Created:** 2026-04-21

---

## 1. Architecture

Three loosely-coupled subsystems:

- **Reads (analytics):** one aggregation service producing a consolidated dashboard payload + a top-N defaulters endpoint. No cache at the service layer; React Query handles client-side staleness.
- **Automation (cron):** one BullMQ repeat job at 02:00 that iterates active colleges, advances overdue `DefaulterRecord`s through the stage ladder, triggers side effects (late fees, holds, welfare refs), and calls the existing `executeReminderSequence()` to enqueue stub deliveries.
- **Delivery (stubs):** three new workers consuming the existing `platform:sms|email|whatsapp` queues. Each logs a structured line, marks `FeeReminder.deliveryStatus = 'delivered'`, and resolves. Real-provider integration is a swap, not a redesign.

### 1.1 Component map

```
┌───────────────────────────────────┐
│ admin-portal/pages/finance/       │
│  FeeDashboardPage.tsx             │──► GET /api/finance/analytics/dashboard
│  FinancialHoldsPage.tsx           │──► GET/POST /api/finance/holds*
│                                   │
│  StudentDetailPage + FeePinsPanel │──► POST /api/finance/students/:id/pause-escalation
└───────────────────────────────────┘
                   │ (React Query, 2-min staleTime)
                   ▼
┌───────────────────────────────────┐
│ backend/modules/finance/          │
│  fee-analytics-service.ts         │ ◄── Mongoose .aggregate() pipelines
│  fee-analytics-controller.ts      │
│  fee-holds-service.ts             │ ◄── FinancialHold mutation
│  fee-holds-controller.ts          │
│  [existing] service.ts            │ ◄── executeReminderSequence (reused)
└───────────────────────────────────┘
                   ▲
                   │ (called directly, no HTTP)
┌───────────────────────────────────┐
│ backend/workers/                  │
│  fee-alerts-cron.worker.ts (NEW)  │ ──enqueue──► platform:sms | platform:email | platform:whatsapp
│  sms-stub.worker.ts (NEW)         │ ◄──consume──
│  email-stub.worker.ts (NEW)       │
│  whatsapp-stub.worker.ts (NEW)    │
│  [existing] fee-commitment.worker │
│  [existing] fee-pin-audit.worker  │
└───────────────────────────────────┘

┌───────────────────────────────────┐
│ backend/scripts/                  │
│  seed-fee-demo-data.ts (NEW)      │ ──creates──► invoices, payments, concessions,
│                                   │              scholarships, defaulter records,
│                                   │              reminders — all tagged demo-seed-v1
└───────────────────────────────────┘
```

### 1.2 New modules

| Module | Location | Purpose |
|---|---|---|
| `fee-analytics-service.ts` | `modules/finance/` | Pure aggregation: dashboard payload + top-N defaulters |
| `fee-analytics-controller.ts` | `modules/finance/` | Thin HTTP controllers |
| `fee-holds-service.ts` | `modules/finance/` | Hold `activate` / `waive` mutations + listings |
| `fee-holds-controller.ts` | `modules/finance/` | HTTP controllers |
| `fee-alerts-cron.worker.ts` | `workers/` | Nightly cron (main feature engine) |
| `sms-stub.worker.ts` | `workers/` | Stub delivery + `FeeReminder` status update |
| `email-stub.worker.ts` | `workers/` | Same |
| `whatsapp-stub.worker.ts` | `workers/` | Same |
| `FeeAlertsCronRun` model | `models/finance/` | Per-run audit: counts + errors |
| `seed-fee-demo-data.ts` | `scripts/` | 50-student demo seeder |
| `FeeDashboardPage.tsx` | `admin-portal/pages/finance/` | Dashboard page |
| `FinancialHoldsPage.tsx` | `admin-portal/pages/finance/` | Hold-approval list page |
| `services/fee-analytics.ts` | `admin-portal/services/` | axios client |
| `services/fee-holds.ts` | `admin-portal/services/` | axios client |

### 1.3 Modified modules

| Module | Change |
|---|---|
| `models/finance/DefaulterRecord.ts` | Add optional `autoEscalationPaused: Date \| null` + optional `lastEscalationAt: Date` (used by cron for idempotency) |
| `shared/queue/QueueManager.ts` | Add `FEE_ALERTS_CRON: 'finance:fee-alerts-cron'` entry; mirror T17 pattern |
| `modules/finance/routes.ts` | Append routes for `/analytics/dashboard`, `/analytics/defaulters`, `/holds/*`, `/students/:id/pause-escalation` |
| `modules/finance/validation.ts` | Append Zod schemas for the new endpoints |
| `admin-portal/src/pages/Finance.tsx` | Add "Dashboard" and "Financial Holds" tiles |
| `admin-portal/src/components/finance/FeePinsPanel.tsx` (or equivalent) | Add "Pause Auto-Escalation" block to the existing student Fee Pins tab |
| `backend/src/index.ts` (server-start) | Register 4 new worker processes (cron + 3 stubs) |

### 1.4 Dashboard aggregation pipeline (data flow)

Single endpoint `GET /api/finance/analytics/dashboard?from=&to=&programmeIds[]=&branchIds[]=&batchIds[]=&academicYearId=` returns `v1` payload:

```ts
interface DashboardV1 {
  // Row 1 KPI
  totalOutstanding: number;              // sum of unpaid invoice amounts in range
  collectedInRange: number;              // sum of successful Payment.amount in range
  collectionRatePercent: number;         // collected / (collected + outstanding) * 100
  overdueStudentsCount: number;
  overdueAmount: number;
  funnelByStage: { stage_1: number; stage_2: number; stage_3: number; stage_4: number; welfare_referred: number; };
  // Row 2 Charts
  collectionTimeSeries: Array<{ bucket: string; amount: number }>;    // daily for last 90 days within [from, to]
  dueVsCollectedByMonth: Array<{ month: string; due: number; collected: number }>;  // last 6 months
  // Row 3 Breakdowns
  paymentModeBreakdown: Record<'cash' | 'upi' | 'neft' | 'cheque' | 'online' | 'card' | 'other', number>;
  dueByProgramme: Array<{ programmeId: string; programmeName: string; due: number; collected: number }>;
}
```

- All six sub-queries run in parallel via `Promise.all` (one round-trip to Mongo).
- HOD scope applied via a base-filter `programmeId ∈ hodScopedProgrammes[]` pre-computed from the student's programmes in their dept.
- `funnelByStage` queries `DefaulterRecord` grouped by `escalationStage`.
- Time-series aggregates `Payment` with `$dateTrunc: { date: '$createdAt', unit: 'day' }`.

### 1.5 Cron stage-transition algorithm

```
for each active college:
  audit = new FeeAlertsCronRun({ collegeId, startedAt: now })
  try:
    cursor = Invoice.find({ collegeId, status ∈ [generated, sent, partially_paid], dueDate: { $lt: now } })
    for each invoice (cursor, batchSize=100):
      try:
        student = Student.findById(invoice.studentId)
        if student.status ∈ [exited, graduated]:
          audit.skipped++; continue

        daysOverdue = floor((now - invoice.dueDate) / day)
        targetStage = mapStage(daysOverdue)  // returns stage_1|2|3|4|welfare_referred

        defaulter = DefaulterRecord.findOneOrCreate({ collegeId, studentId: student._id, invoiceId: invoice._id })

        if defaulter.autoEscalationPaused && defaulter.autoEscalationPaused > now:
          audit.paused++; continue

        if defaulter.lastEscalationAt >= startOfToday:
          audit.alreadyAdvanced++; continue  // idempotent

        if defaulter.escalationStage === targetStage:
          audit.unchanged++; continue  // already at target; no side effect

        // Stage TRANSITION
        if targetStage === 'stage_2' AND prior !== 'stage_2':
          await FinePenalty.create({ type: 'late_fee', amount: 200, ... })
        if targetStage === 'stage_4' AND prior !== 'stage_4':
          await FinancialHold.create({ type: 'exam_debarment', status: 'pending_approval', ... })
          await enqueueEmail({ template: 'hold-pending', to: [financeOfficer, principal] })
        if targetStage === 'welfare_referred':
          defaulter.welfareReferralStatus = 'pending'

        defaulter.escalationStage = targetStage
        defaulter.lastEscalationAt = now
        defaulter.daysOverdue = daysOverdue
        defaulter.overdueAmount = invoice.amountDue - invoice.amountPaid
        await defaulter.save()

        // Reminder dispatch (reuse existing service). Skip for welfare_referred.
        if targetStage !== 'welfare_referred':
          await executeReminderSequence(collegeId, defaulter._id, 'system:fee-alerts-cron')

        audit.advanced[targetStage]++
      catch error:
        audit.errors.push({ studentId: student._id, invoiceId: invoice._id, message: error.message })
    audit.finishedAt = now
    audit.save()
  catch college-wide error:
    audit.error = error.message; audit.save()
```

### 1.6 Stub worker flow (repeats for SMS/email/WhatsApp)

```
Worker consumes job { reminderId?: string, to: string, template: string, context: object }

1. Log structured INFO: [stub-delivery] channel=sms to=+91... template=stage1 context={...}
2. If `to` is missing / null:
   - Log WARN [stub-delivery-skipped] reason="missing contact"
   - If reminderId present: FeeReminder.updateOne({_id: reminderId}, { deliveryStatus: 'failed', deliveryDetails: { reason: 'missing_contact' } })
   - Resolve (don't retry)
3. If reminderId present: update FeeReminder.deliveryStatus = 'delivered', deliveredAt = now
4. Resolve successfully
```

Idempotent: same job processed twice is harmless (sets `delivered` again, logs twice — acceptable for stubs).

### 1.7 Demo seed algorithm

```
if --clear-first:
  delete all entities across 8 collections tagged metadata.source = 'demo-seed-v1'

create 50 students across (BTech CSE, BTech ECE, MBA) × (2023, 2024) batches
for each student:
  create 1-3 invoices spanning last 12 months
  create concession for 3 random students (sibling or merit)
  create scholarship allocation for 2 random students (merit or govt)
  for the 20 "fully paid" students: create matching successful Payment records
  for the 8 "partially paid": Payment covering 50-90% of invoice
  for stage_1 (6): invoice 1-7 days overdue, no payment
  for stage_2 (4): invoice 8-14 days overdue + FinePenalty late_fee ₹200 + DefaulterRecord at stage_2
  for stage_3 (3): invoice 15-30 overdue + DefaulterRecord at stage_3 + FeeReminder records (1 SMS, 1 WhatsApp)
  for stage_4 (2): invoice 31-60 overdue + DefaulterRecord at stage_4 + FinancialHold(status='pending_approval') + FeeReminder x3
  tag every created entity with metadata.source = 'demo-seed-v1'

output CSV: demo-seed-{collegeId}-{timestamp}.csv listing per-student created artefacts
```

### 1.8 API design

| Method | Path | Role | Zod schema |
|---|---|---|---|
| GET | `/api/finance/analytics/dashboard` | `finance:read` | `dashboardQuerySchema` |
| GET | `/api/finance/analytics/defaulters` | `finance:read` | `defaultersQuerySchema` |
| GET | `/api/finance/holds` | `finance:read` | `holdsListQuerySchema` |
| POST | `/api/finance/holds/:id/activate` | `finance:approve` (Principal) | (path-param only) |
| POST | `/api/finance/holds/:id/waive` | `finance:approve` | `waiveHoldSchema` (`{ reason }`) |
| POST | `/api/finance/students/:id/pause-escalation` | `finance:update` | `pauseEscalationSchema` (`{ until, reason? }`) |

All behind existing `authenticate` + `authorize()` + existing `createUserRateLimit` middleware.

---

## 2. Database

### 2.1 Schema additions

**`DefaulterRecord.ts` — add 2 optional fields:**

```ts
autoEscalationPaused?: Date | null;   // set by pause-escalation endpoint; cron skips if > now
lastEscalationAt?: Date;              // set by cron on every advance; used for idempotency
```

Both optional, backward compatible.

### 2.2 New collection — `FeeAlertsCronRun`

```ts
interface IFeeAlertsCronRun {
  _id: ObjectId;
  collegeId: ObjectId;
  startedAt: Date;
  finishedAt?: Date;
  advancedByStage: { stage_1: number; stage_2: number; stage_3: number; stage_4: number; welfare_referred: number };
  skipped: number;            // exited / graduated students
  alreadyAdvanced: number;    // idempotent skip (today)
  unchanged: number;          // already at target stage
  paused: number;             // autoEscalationPaused active
  errors: Array<{ studentId?: ObjectId; invoiceId?: ObjectId; message: string; stackSnippet?: string }>;
  topLevelError?: string;     // college-wide failure
}
```

Index: `{ collegeId: 1, startedAt: -1 }` for "latest run per college" dashboard queries. Retain 90 days (same pattern as `FeePinAuditSnapshot`).

### 2.3 Tagging existing collections for demo purge

`metadata.source` naming is model-by-model. Preferred existing paths:

| Model | Field path |
|---|---|
| `Invoice` | `metadata.source` (add if not present) |
| `Payment` | `metadata.source` |
| `DefaulterRecord` | `metadata.source` |
| `FeeReminder` | `metadata.source` |
| `FinancialHold` | `metadata.source` |
| `FinePenalty` | `metadata.source` |
| `Concession` | `metadata.source` |
| `Scholarship` / `ScholarshipAllocation` | `metadata.source` |

If a model's schema lacks `metadata`, add it as `Schema.Types.Mixed` with `default: {}`. Zero-migration for existing records.

### 2.4 Indexes

| Collection | New Index | Justification |
|---|---|---|
| `Invoice` | `{ collegeId: 1, status: 1, dueDate: 1 }` | Cron's primary scan query |
| `DefaulterRecord` | `{ collegeId: 1, escalationStage: 1 }` | Dashboard funnel-by-stage |
| `Payment` | `{ collegeId: 1, status: 1, createdAt: 1 }` | Time-series aggregation |
| `FeeAlertsCronRun` | `{ collegeId: 1, startedAt: -1 }` | Latest run per college |

Verify each with `explain()` against seeded data before sign-off.

### 2.5 Migrations

- **Migration 1 (schema):** DefaulterRecord field additions — additive, no migration script required
- **Migration 2 (indexes):** Let Mongoose `syncIndexes()` pick up the new indexes on boot. On large prod collections, pre-create via `createIndex({ background: true })` in a maintenance window (documented in QA checklist).
- **Migration 3 (seed defaults):** None. All new behaviour opt-in.

---

## 3. Dependencies

### 3.1 New npm deps

**None.** `recharts` already present in admin-portal (per earlier rollouts). No new backend libraries.

### 3.2 Infrastructure

- **New BullMQ queue:** `finance:fee-alerts-cron` (registered in QueueManager; cron pattern `0 2 * * *`)
- **Server-startup registrations (4 new workers):**
  - `registerFeeAlertsCronWorker()` + initial `queue.add('nightly', {}, { repeat: { pattern: '0 2 * * *' } })`
  - `registerSmsStubWorker()`
  - `registerEmailStubWorker()`
  - `registerWhatsappStubWorker()`
- All 4 registrations gated by env var `STUB_DELIVERY=true` (default `true` in non-prod; prod sets `false` once real providers ship)

### 3.3 External services

None for v1. Real SMS/Email/WhatsApp providers deferred.

---

## 4. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---:|---:|---|
| R-1 | Dashboard aggregation exceeds 800ms on large colleges | Medium | High | All queries use indexes from §2.4; six-query parallel Promise.all; profile with `explain()` before sign-off; add server-side cache layer (React Query 2-min is client-side only) as a post-ship follow-up if needed |
| R-2 | Cron fires but stub workers not registered → jobs pile up in queue | Low | Medium | Server-startup registers all 4 workers atomically behind one env flag; startup health check verifies queue-worker pairing before `listen()` returns |
| R-3 | Demo seed accidentally run on production college | Low | **Critical** | `--clear-first` ONLY purges entities tagged `demo-seed-v1`; dry-run default surfaces what would be created without writing; entity-count > 100 pre-check aborts with warning |
| R-4 | Payment arrives between cron decision and reminder dispatch → reminds a paid student | Low | Medium | Stub worker does pre-dispatch `Invoice.findById().status` check; if paid, marks reminder `skipped_paid` and resolves |
| R-5 | Cron idempotency fails under manual re-enqueue | Low | Medium | `lastEscalationAt >= startOfToday` gate is the primary check; reinforced by tests that run the cron twice on the same fixture and assert no duplicate side effects |
| R-6 | HOD scope filter not applied correctly — HOD sees another department's students | Low | **Critical** | Dashboard aggregation pipelines pre-filter students by a pre-computed `hodProgrammeIds[]` via `applyAuthScope`; dedicated tests: HOD-of-CSE sees only CSE funnel counts |
| R-7 | Stage transitions create duplicate FinePenalty records | Medium | Medium | Transition-only side effects: check `if (priorStage !== 'stage_2' && targetStage === 'stage_2') create FinePenalty`; tests cover re-running cron → 1 late fee total |
| R-8 | `FinancialHold` auto-activates before Principal reviews | Low | High | Hold is created with `status: 'pending_approval'` (explicit); Principal must click Activate; activation endpoint gates on `finance:approve` role |
| R-9 | Cron run on a freshly-added college with zero invoices → empty audit with noisy logs | Low | Low | Cron silently completes with `{ advanced: 0 }` audit record; no-op, no error |
| R-10 | Partial cron failure: one college errors, others succeed → admin misses the failure | Low | Medium | Per-college try/catch; failed college logged as WARN; `FeeAlertsCronRun.topLevelError` field surfaced in a future Dashboard admin tile (v2) |
| R-11 | Concurrent cron runs (retry during overlap) | Low | Medium | BullMQ `attempts: 3` with exponential backoff; lock via `lastEscalationAt` idempotency; tests cover double-run → single side effect |
| R-12 | React Query stale time (2 min) too long for a fast-paced demo | Low | Low | Dashboard exposes a "Refresh" button that invalidates the query; operator can force-refresh anytime |

### 4.1 Hardest part (per planning principle #4)

**The nightly cron's transition logic + side effects.** Multiple moving parts: mapStage decision, late-fee creation guarded by transition direction, hold creation guarded by transition direction, welfare-referral flagging, reminder dispatch, audit trail, idempotency. Most bugs will live here.

Front-loaded mitigations:
- Mandatory unit test coverage: every stage transition explicitly tested (6 `it()` blocks), every side-effect guarded (3 more)
- Idempotency test: run cron twice on the same fixture; assert exactly one late fee, one hold, one welfare flag
- Dry-run mode for the cron (`--dry-run` CLI wrapper) that logs what it WOULD do without writing — used by ops during initial production rollout

---

## 5. Observability

- **New metrics (emitted via structured logs for now; Prometheus/Datadog a future concern):**
  - `fee_alerts_cron.duration_ms` per college
  - `fee_alerts_cron.advanced_count` by stage
  - `fee_alerts_cron.error_count` per college
  - `dashboard_endpoint.p95_ms` (existing request-latency middleware)
  - `stub_delivery.{sms|email|whatsapp}.count` + `skipped_count`
- **Alerts:**
  - If `FeeAlertsCronRun` missing for a college in last 25h → email SRE + Finance Officer
  - If cron `errors[].length > 10` → email Principal
  - If `holds.pending_approval` count > 20 → email Principal (the daily briefing trigger)
- **Dashboards (future):**
  - Cron-health tile on a platform admin dashboard (post-v1)
  - Stub-delivery success rate (trivially 100% for stubs; becomes meaningful once real providers ship)

---

## 6. Open Questions

- **OQ-1 Stage downgrade on partial payment.** Spec says stages forward-only; one Indian college I've worked with wanted a "courtesy downgrade" if the student clears 50% of their overdue. **Deferred to v2 unless real user feedback surfaces the need.**
- **OQ-2 Late fee amount per college.** Hard-coded ₹200 for v1. A `CollegeConfig.lateFeeAmount` field could make this configurable without a code deploy. **Deferred to a post-v1 polish feature.**
- **OQ-3 Pre-due reminder timing.** Spec says "day 0" (day of due date). Some colleges want T-3 or T-7 pre-due reminders. **v1 ships day-0 only; configurable cadence is a future feature.**
- **OQ-4 Welfare module referral inbox.** `welfareReferralStatus: 'pending'` is set; who/what picks it up on the Welfare side is out of scope. Verify with Welfare team that the flag is sufficient signal.
- **OQ-5 Dashboard server-side cache.** If p95 measures bad, add a 30-second TTL Redis cache layer. **Decision deferred to measurement post-deploy.**
- **OQ-6 Demo data + multi-tenancy leak risk.** If an ops person runs seed against the wrong college, they could pollute that college's demo-tagged entities. Can we add a `--confirm-college-name=<name>` flag that echoes back the target college's display name before writing? Worth adding for safety.

---

## 7. Plan-review sanity check

- ✅ Fits existing architecture: Mongoose 8 subdoc pattern, BullMQ queues, existing service structure, existing RBAC
- ✅ New dependencies justified: only runtime — 4 new BullMQ workers, 0 new npm packages
- ✅ Hardest part identified (§4.1): cron transition logic; front-loaded via mandatory test cases
- ✅ Observability planned (§5): metrics, alerts, and future dashboard
- ✅ Every spec AC has a home in the plan:
  - Dashboard ACs → §1.4, §2.4 (indexes), §4 R-1 (perf)
  - Cron ACs → §1.5, §4.1 (mitigations)
  - Stub worker ACs → §1.6, §3.2 (infrastructure)
  - Hold approval UI ACs → §1.8 (API)
  - Pause auto-escalation ACs → §1.8, §2.1 (schema)
  - Demo seed ACs → §1.7, §2.3 (tagging)
  - Observability ACs → §5
- ✅ NOT-for items not addressed (intentional): real notification providers, distress score, welfare UI, per-college late-fee config

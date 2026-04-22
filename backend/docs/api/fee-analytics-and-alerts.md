# Fee Collection Analytics & Alerts — API Reference

**Spec:** `.captain/specs/fee-collection-analytics-and-alerts/spec.md`
**Plan:** `.captain/specs/fee-collection-analytics-and-alerts/plan.md`
**Tasks:** `.captain/specs/fee-collection-analytics-and-alerts/tasks.md`

This document describes the HTTP API + cron + stub-delivery architecture for the Fee Collection Analytics & Alerts feature — a nightly automation that advances overdue students through a 5-stage escalation ladder, applies late fees, raises pending-approval holds, plus a Finance Collections Dashboard and Holds approval inbox for Principal / Finance Officer.

Complements the companion QA / deploy checklist: `./fee-analytics-and-alerts-qa-checklist.md`.

---

## Table of contents

1. [Concepts](#concepts)
2. [Data model](#data-model)
3. [Stage cadence + side effects](#stage-cadence--side-effects)
4. [Cron lifecycle](#cron-lifecycle)
5. [Queue architecture](#queue-architecture)
6. [Endpoints](#endpoints)
7. [Error codes](#error-codes)
8. [RBAC mapping](#rbac-mapping)
9. [Integration behaviour](#integration-behaviour)
10. [Known deviations from plan](#known-deviations-from-plan)
11. [Open questions](#open-questions)

---

## Concepts

### Escalation stage
A student-level label on `DefaulterRecord.escalationStage` indicating how overdue they are. The nightly cron advances stages forward-only (never downgrades on partial payment). Values: `stage_1 | stage_2 | stage_3 | stage_4 | welfare_referred | cleared`.

### Nightly cron (`finance:fee-alerts-cron`)
A BullMQ repeat job at `0 2 * * *` (02:00 daily) that iterates all active colleges, scans overdue invoices, and advances each student's stage with side effects (late fees, holds, reminders).

### Stub delivery
SMS / email / WhatsApp worker jobs that log a structured `[stub-delivery]` line and mark the backing `FeeReminder.deliveryStatus` as `delivered` (happy path), `failed` (missing contact), or `skipped_paid` (invoice was paid between enqueue and dispatch). Real providers are deferred to a future feature — the hybrid architecture lets swap-in happen without touching the cron.

### Pending-approval hold
A `FinancialHold` auto-raised when the cron transitions a student into `stage_4`. Status `pending_approval` — requires a Principal to click Activate or Waive in the Holds page. Does not block the student until activated.

### Auto-escalation pause
A per-student flag on `DefaulterRecord.autoEscalationPaused` (a future date). While `autoEscalationPaused > now`, the cron skips this student entirely. Used when Principal grants an informal extension.

---

## Data model

### `DefaulterRecord` — new fields
```ts
interface DefaulterRecord {
  // ... existing fields
  autoEscalationPaused?: Date | null;    // new — cron skips if > now
  lastEscalationAt?: Date;               // new — set on every advance; same-day idempotency gate
  welfareReferralStatus: 'none' | 'pending' | 'referred' | 'returned';  // 'pending' newly added
}
```

### `FinancialHold` — new fields + enum extension
```ts
interface FinancialHold {
  // ... existing fields
  holdStatus: 'pending_approval' | 'active' | 'released';  // 'pending_approval' newly added (entry state)
  approvedBy?: ObjectId;                 // new — who clicked Activate / Waive
}
```

### `FeeReminder` — delivery status extension
```ts
interface FeeReminder {
  // ... existing fields
  deliveryStatus: 'pending' | 'delivered' | 'failed' | 'skipped_paid';  // 'skipped_paid' newly added
  deliveredAt?: Date;                    // new — set by stub workers on happy path
}
```

### `FeeAlertsCronRun` — new collection
One document per college per cron run. Used for observability + the dashboard's "last run" badge + rolling error log.
```ts
interface IFeeAlertsCronRun {
  _id: ObjectId;
  collegeId: ObjectId;
  startedAt: Date;
  finishedAt?: Date;
  advancedByStage: {
    stage_1: number; stage_2: number; stage_3: number;
    stage_4: number; welfare_referred: number;
  };
  skipped: number;           // exited / graduated / student missing
  alreadyAdvanced: number;   // same-day idempotent skip
  unchanged: number;         // already at target stage
  paused: number;            // autoEscalationPaused active
  errors: Array<{
    studentId?: ObjectId;
    invoiceId?: ObjectId;
    message: string;
    stackSnippet?: string;
  }>;
  topLevelError?: string;    // college-wide failure
  createdAt: Date;
  updatedAt: Date;
}
```

Index: `{ collegeId: 1, startedAt: -1 }` (plan §2.4).

### `metadata.source` tagging
Added on 8 models (`Invoice`, `Payment`, `DefaulterRecord`, `FeeReminder`, `FinancialHold`, `FinePenalty`, `Concession`, `Scholarship`/`ScholarshipAllocation`) as `Schema.Types.Mixed, default: {}`. The demo-seed script tags every entity it creates with `metadata.source: 'demo-seed-v1'` so `--clear-first` can purge only demo data.

### New indexes
- `Invoice: { collegeId: 1, status: 1, dueDate: 1 }` — cron's overdue-invoice cursor
- `DefaulterRecord: { collegeId: 1, escalationStage: 1 }` — dashboard funnel aggregation
- `Payment: { collegeId: 1, status: 1, createdAt: 1 }` — dashboard time-series + breakdowns
- `FeeAlertsCronRun: { collegeId: 1, startedAt: -1 }` — latest-run-per-college queries

---

## Stage cadence + side effects

| Days overdue | Target stage         | New side effect on transition                                                         |
|--------------|----------------------|---------------------------------------------------------------------------------------|
| 0            | `stage_1`            | Pre-due SMS reminder (via `executeReminderSequence`)                                  |
| 1–7          | `stage_1`            | Reminder dispatched                                                                   |
| 8–14         | `stage_2`            | **+1 `FinePenalty`** (`type: 'late_fee'`, `amount: 200`) + reminder                   |
| 15–30        | `stage_3`            | Reminder                                                                              |
| 31–60        | `stage_4`            | **+1 `FinancialHold`** (`holdStatus: 'pending_approval'`, `holdType: 'exam_debarment'`) + reminder |
| 61+          | `welfare_referred`   | `DefaulterRecord.welfareReferralStatus = 'pending'`, **no reminder** (welfare team owns outreach) |

**Forward-only rule.** If `priorStage === targetStage`, no side effect runs, only `lastEscalationAt` is updated. A student already at `stage_2` who is now 20 days overdue advances to `stage_3`; the cron does NOT re-apply the ₹200 late fee.

**Idempotency.** If `lastEscalationAt >= startOfToday`, the student is skipped (`audit.alreadyAdvanced++`). A second cron run the same day is a no-op.

---

## Cron lifecycle

```
Nightly at 02:00 (cron '0 2 * * *')
  │
  ├─ For each active College:
  │    │
  │    ├─ Create FeeAlertsCronRun audit doc
  │    │
  │    ├─ Cursor: Invoice.find({ status: generated|sent|partially_paid, dueDate: $lte now })
  │    │    │
  │    │    ├─ Student.findById → skip if exited/graduated  [audit.skipped++]
  │    │    ├─ DefaulterRecord findOrCreate (keyed on collegeId+studentId+invoiceId)
  │    │    ├─ if autoEscalationPaused > now          → [audit.paused++]
  │    │    ├─ if lastEscalationAt >= startOfToday    → [audit.alreadyAdvanced++]
  │    │    ├─ targetStage = mapStage(daysOverdue)
  │    │    ├─ if targetStage === priorStage          → [audit.unchanged++], save lastEscalationAt
  │    │    ├─ else: apply transition side-effects + save defaulter
  │    │    └─ if !welfare_referred: executeReminderSequence(…)
  │    │
  │    └─ Persist audit (finishedAt, counts, errors[])
  │
  ├─ Per-college error caught → audit.topLevelError set, audit saved, move to next college
  └─ dryRun=true → no DB writes; decisions logged only
```

See `backend/src/workers/fee-alerts-cron.worker.ts` for implementation.

---

## Queue architecture

| Queue name                  | Type    | Worker                              | Concurrency |
|-----------------------------|---------|-------------------------------------|-------------|
| `finance:fee-alerts-cron`   | repeat  | `fee-alerts-cron.worker.ts`         | 1           |
| `platform:sms`              | stub    | `sms-stub.worker.ts`                | 5           |
| `platform:email`            | stub    | `email-stub.worker.ts`              | 5           |
| `platform:whatsapp`         | stub    | `whatsapp-stub.worker.ts`           | 5           |

Stub workers gated by `STUB_DELIVERY !== 'false'` env var (default true in non-prod, false in prod). When real providers ship, set `STUB_DELIVERY=false` and register the real workers instead — the producer (`executeReminderSequence`) is unchanged.

---

## Endpoints

All 6 new endpoints live under `/api/finance`, behind `authenticate` + `authorize()` + shared `feeConfigRateLimit` (60 req/min/user).

### `GET /api/finance/analytics/dashboard`

Returns the fully-populated `DashboardV1` object (10 parallel aggregations, ~1 MongoDB round-trip).

**Permission:** `('finance', 'read')`

**Query params** (`dashboardQuerySchema`):
```ts
{
  from: Date;                        // ISO string → coerced to Date
  to: Date;
  programmeIds?: string | string[];  // optional filter
  branchIds?:    string | string[];
  batchIds?:     string | string[];
  academicYearId?: string;
}
```

**Response 200:**
```json
{
  "totalOutstanding": 1250000,
  "collectedInRange": 8500000,
  "collectionRatePercent": 87.2,
  "overdueStudentsCount": 42,
  "overdueAmount": 1250000,
  "funnelByStage": { "stage_1": 15, "stage_2": 12, "stage_3": 8, "stage_4": 5, "welfare_referred": 2 },
  "collectionTimeSeries": [{ "bucket": "2026-03-22", "amount": 45000 }, ...],
  "dueVsCollectedByMonth": [{ "month": "2025-11", "due": 2800000, "collected": 2650000 }, ...],
  "paymentModeBreakdown": { "cash": 100000, "upi": 4000000, "neft": 2500000, "cheque": 500000, "online": 800000, "card": 600000, "other": 0 },
  "dueByProgramme": [{ "programmeId": "…", "programmeName": "CSE", "due": 500000, "collected": 3200000 }, ...]
}
```

**HOD scope:** when the caller's role is `hod`, the controller resolves `hodProgrammeIds` via `Branch.find({ collegeId, departmentId }).distinct('programmeId')` and passes the scope to the service, which intersects every sub-pipeline with that programme set.

---

### `GET /api/finance/analytics/defaulters`

Paginated list of overdue students.

**Permission:** `('finance', 'read')`

**Query params** (`defaultersQuerySchema`):
```ts
{
  limit?:  number;  // 1–100, default 20
  offset?: number;  // ≥ 0, default 0
  sort?:   'overdueAmount' | 'daysOverdue';  // default 'overdueAmount' desc
}
```

**Response 200:**
```json
{
  "items": [
    {
      "studentId": "...",
      "rollNumber": "20CS001",
      "name": "Student Name",
      "programmeName": "CSE",
      "overdueAmount": 45000,
      "daysOverdue": 23,
      "escalationStage": "stage_3",
      "autoEscalationPaused": null
    }
  ],
  "total": 42
}
```

---

### `GET /api/finance/holds`

Paginated list of financial holds. Default ordering: `pending_approval` → `active` → `released`, newest-first within each group.

**Permission:** `('finance', 'read')`

**Query params** (`holdsListQuerySchema`):
```ts
{
  status?:    'pending_approval' | 'active' | 'released';  // exact match
  studentId?: string;                                       // exact match
  limit?:     number;  // 1–100, default 20
  offset?:    number;
}
```

**Response 200:**
```json
{
  "items": [
    {
      "_id": "...",
      "collegeId": "...",
      "studentId": "...",
      "holdType": "exam_debarment",
      "holdStatus": "pending_approval",
      "effectiveDate": "2026-04-21T00:00:00Z",
      "reason": "Auto-raised on stage_4 transition",
      "createdAt": "2026-04-21T02:00:05Z"
    }
  ],
  "total": 8
}
```

**Note:** This new `GET /holds` takes precedence over the legacy `GET /finance/holds` CRUD list because the T8 block is declared above it in `routes.ts`.

---

### `POST /api/finance/holds/:id/activate`

Principal approves the pending hold. Student is now exam-debarred.

**Permission:** `('finance', 'update')` (mapped from Principal role — `'approve'` action not present in the codebase's `authorize()` enum; documented as a one-line swap if Product prefers a separate action).

**Body:** none.

**Response 200:** updated `FinancialHold` doc with `holdStatus: 'active'`, `approvedBy` set, `effectiveDate: now`.

**Errors:**
- `409` if hold is not `pending_approval` (already active or released)
- `404` if hold not found in caller's college

---

### `POST /api/finance/holds/:id/waive`

Principal cancels the hold. Emits an audit log entry with the reason.

**Permission:** `('finance', 'update')`

**Body** (`waiveHoldSchema`):
```ts
{ reason: string }  // trimmed, min 1 char, max typical 500
```

**Response 200:** updated hold with `holdStatus: 'released'`, `releasedBy` + `releaseDate` + `releaseReason`.

**Errors:**
- `400` if reason is missing / empty / whitespace
- `409` if hold is already `released`
- `404` if hold not found

---

### `POST /api/finance/students/:id/pause-escalation`

Finance Officer pauses auto-escalation on a single student. The cron's `autoEscalationPaused > now` gate skips this student until the pause expires.

**Permission:** `('finance', 'update')`

**Body** (`pauseEscalationSchema`):
```ts
{ pausedUntil: Date }  // ISO string → coerced
```

**Response 200:** `{ updated: <count> }` — number of DefaulterRecord rows touched (one per overdue invoice the student holds).

To **resume immediately**, POST with `pausedUntil: <now-or-past>`. The cron's `> now` check unpauses on next run without needing a separate endpoint.

**Errors:**
- `404` if no DefaulterRecord exists for this student (the student isn't overdue yet — there's nothing to pause)
- `400` if `pausedUntil` is not a valid date

---

## Error codes

| Status | Meaning                        | Common causes                                                                  |
|--------|--------------------------------|--------------------------------------------------------------------------------|
| 400    | Bad request / validation       | Zod schema rejects query or body; empty waive reason                           |
| 401    | No auth                        | Missing / invalid JWT                                                          |
| 403    | Wrong role                     | Non-Principal attempting to Activate; non-Finance Officer attempting to Pause  |
| 404    | Entity not found               | Hold ID / student ID not in caller's college                                   |
| 409    | Invalid state transition       | Activate a non-pending hold, Waive a released hold                             |
| 429    | Rate limit                     | >60 requests/min/user on any of the 6 endpoints                                |
| 500    | Internal error                 | DB outage, unexpected aggregation failure                                      |

---

## RBAC mapping

| Role                | Dashboard | Defaulters list | Holds list | Activate hold | Waive hold | Pause escalation |
|---------------------|-----------|-----------------|------------|---------------|------------|------------------|
| `super_admin`       | full      | full            | full       | ✓             | ✓          | ✓                |
| `admin`             | full      | full            | full       | ✓             | ✓          | ✓                |
| `principal`         | full      | full            | full       | ✓             | ✓          | —                |
| `finance_officer`   | full      | full            | full       | —             | —          | ✓                |
| `hod`               | scoped to their department's programmes | same | ✓ read-only | — | — | — |
| `teacher` / other   | 403       | 403             | 403        | 403           | 403        | 403              |

---

## Integration behaviour

### Demo seed
Run `npx ts-node backend/src/scripts/seed-fee-demo-data.ts --college-id=<id> --confirm-college-name="<exact>" [--clear-first] [--dry-run]` to seed 50 students spanning the full funnel (20 paid, 8 partial, 7 upcoming, 6/4/3/2 across stages) + 2 failed + 1 reversed Payment, 3 Concessions, 2 Scholarships, 4 late-fee FinePenalties, 2 active FinancialHolds.

Every seeded entity is tagged `metadata.source: 'demo-seed-v1'`. `--clear-first` deletes ONLY tagged entities — untagged production data is never touched. Name-mismatch on `--confirm-college-name` aborts before any write.

### Stub worker invoice-paid guard
When a stub worker processes a `FeeReminder` job, it re-reads the backing Invoice. If `Invoice.status === 'paid'` between enqueue and dispatch, the reminder is marked `deliveryStatus: 'skipped_paid'` and no log line is emitted for the "delivery."

### Pause-escalation idempotency
Calling the pause endpoint twice with different `pausedUntil` dates overwrites — the latest call wins across ALL of the student's DefaulterRecords (single `updateMany`). The cron's skip gate checks the current value, not a historical one.

### Internal-email enqueue on stage_4 hold (TODO)
Plan §1.5 specified "enqueue email to Finance Officer + Principal" when the cron creates a pending hold. No email-enqueue helper exists in the codebase; the cron creates the hold and the Holds page (T10) is the canonical review surface. When an email helper ships, wire it in `fee-alerts-cron.worker.ts` at the `stage_4` transition side-effect block.

---

## Known deviations from plan

See the spec changelog for dated details. Summary:

1. **Recharts is NOT installed** — the 3 dashboard charts are hand-rolled inline SVG components in `FeeDashboardPage.tsx`. Data contracts match recharts inputs, so a future swap is a drop-in.
2. **`Invoice.dueDate: $lte now`** — plan said `$lt`, but the Day-0 pre-due-reminder scenario requires `$lte` (matches spec §Journey 2).
3. **`FinePenalty` shape mismatch** — no `invoiceId` or `appliedAt` fields, no `'applied'` status. Cron writes `metadata.{invoiceId, appliedAt, source}` and uses `status: 'pending'`.
4. **`FinancialHold.defaulterRecordId` required** — cron saves the defaulter doc first (to get a stable `_id`) before creating the hold.
5. **`DefaulterRecord.welfareReferralStatus` enum extended** with `'pending'`.
6. **`FinancialHold.holdStatus` enum extended** with `'pending_approval'`; added `approvedBy`.
7. **`FeeReminder.deliveryStatus` extended** with `'skipped_paid'`; added `deliveredAt`.
8. **Holds list v1 doesn't `$lookup` student details** — shows studentId chip + click-through to `/people/students/:id`. v2 enrichment deferred.
9. **Pause-escalation UI reads status from defaulters-list** (client-side filter, limit=100). Students beyond offset 100 see "Not a defaulter" as a graceful degraded state.
10. **`'approve'` action mapped to `'update'`** in `authorize()` because the action enum has no `'approve'`. Documented as one-line swap if Product prefers.

---

## Open questions

- **OQ-1: Real provider choice** — when the hybrid stub delivery is swapped out, which provider stack (Twilio / Exotel / AWS SES / WhatsApp Business API)? Out of scope for this feature.
- **OQ-2: Internal-email enqueue helper** — where should the helper live? `shared/notifications/` feels right, but no such folder exists yet. Parks as a follow-up.
- **OQ-3: Late-fee amount configurability** — currently hard-coded ₹200. If colleges want different amounts, this becomes a `FeeConfig` entry per college. Not requested for v1.
- **OQ-4: Distress score / ML ranking on defaulters** — out of scope; roadmap item.
- **OQ-5: Holds list enrichment** — server-side `$lookup` in T4 to return student name/programme/overdue. v2 UX improvement.
- **OQ-6: Recharts migration** — install + swap. Low priority while inline SVG renders correctly.

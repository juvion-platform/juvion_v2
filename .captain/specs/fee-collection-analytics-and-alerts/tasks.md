# Tasks: Fee Collection Analytics & Alerts

**Spec:** `./spec.md` · **Plan:** `./plan.md` · **Created:** 2026-04-21
**Total tasks:** 13 (12 Code, 1 Doc)

---

## Task DAG

```
                    ┌──── T1 Schema (DefaulterRecord fields + metadata tagging
                    │         + FeeAlertsCronRun + indexes)
Foundation    ──────┤
(parallel)          ├──── T2 QueueManager: FEE_ALERTS_CRON entry
                    │
                    └──── T6 Stub workers (SMS + email + WhatsApp)
                              │  (consumes existing platform:sms|email|whatsapp queues;
                              │   only needs FeeReminder model which exists today)
                              │
                              ▼
                          ┌── T3 fee-analytics-service (dashboard + defaulters) ◄── T1
                          │
                          ├── T4 fee-holds-service                              ◄── T1
                          │
                          ├── T5 fee-alerts-cron.worker (HARDEST)               ◄── T1, T2
                          │
                          └── T7 demo seed script                               ◄── T1
                                     │
                                     ▼
                                T8 HTTP API (routes + controllers + validation) ◄── T3, T4
                                     │
                          ┌──────────┼──────────┐
                          ▼          ▼          ▼
                    T9 Dashboard  T10 Holds   T11 Pause-esc UI
                       page        page        (in FeePinsPanel)
                     (charts)      (list)         ◄── T8
                          │          │
                          └──────────┴───► T12 E2E integration tests ◄── all above
                                                    │
                                                    ▼
                                       T13 API docs + QA/deploy checklist
```

### Parallelism opportunities

- **Foundation (T1 · T2 · T6):** three fully parallel tasks, no deps on each other.
- **Services (T3 · T4 · T5 · T7):** after T1 + T2 land, all four parallel.
- **UI (T9 · T10 · T11):** all parallel after T8.
- **T12 + T13:** serialized last.

### Front-loaded risks (from plan §4.1)

- **T5 (cron)** is the hardest single task. Mandatory test coverage: 6 stage-transition cases + 3 side-effect-guard cases + idempotency re-run test.
- **T7 (demo seed)** is the biggest safety concern — runs against production colleges if misused. `metadata.source` tag + `--confirm-college-name` + tag-only purge are non-negotiable.

---

## Task List

| # | Task | Type | Depends On | Status |
|---|---|---|---|---|
| 1 | Schema additions: DefaulterRecord.autoEscalationPaused + lastEscalationAt, metadata.source on 8 models (if missing), new FeeAlertsCronRun collection, 4 new indexes | Code | — | Done |
| 2 | QueueManager FEE_ALERTS_CRON entry | Code | — | Done |
| 3 | fee-analytics-service: dashboard + defaulters aggregation pipelines | Code | 1 | Done |
| 4 | fee-holds-service: activate, waive, list functions | Code | 1 | Done |
| 5 | fee-alerts-cron.worker (HARDEST): stage-transition engine, side effects, audit | Code | 1, 2 | Done |
| 6 | Stub workers (sms + email + whatsapp): structured log + mark FeeReminder.deliveryStatus | Code | — | Done |
| 7 | Demo seed script (50 students across funnel, metadata.source tagging, --confirm-college-name safety) | Code | 1 | Done |
| 8 | HTTP API: /analytics/dashboard, /analytics/defaulters, /holds, /holds/:id/activate, /holds/:id/waive, /students/:id/pause-escalation + Zod + rate-limit | Code | 3, 4 | Done |
| 9 | Admin UI: FeeDashboardPage (Rows 1+2+3) with recharts | Code | 8 | Done |
| 10 | Admin UI: FinancialHoldsPage (pending-approval list + activate/waive actions) | Code | 8 | Pending |
| 11 | Admin UI: Pause-auto-escalation block inside existing FeePinsPanel | Code | 8 | Done |
| 12 | E2E integration tests: cron end-to-end, dashboard response, hold approval flow, pause-escalation flow, demo seed reproducibility | Code | 3, 4, 5, 6, 7, 8, 9, 10, 11 | Done |
| 13 | API reference + QA/deploy checklist | Doc | 8, 12 | Done |

---

## Task Details

---

### Task 1: Schema additions
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** —

**Acceptance Criteria:**
- New optional fields on `DefaulterRecord`:
  - `autoEscalationPaused?: Date | null` — cron skips student if `> now`
  - `lastEscalationAt?: Date` — cron sets every advance; used for same-day idempotency
- `metadata: { source?: string, ... }` field ensured on 8 models if not present: `Invoice`, `Payment`, `DefaulterRecord`, `FeeReminder`, `FinancialHold`, `FinePenalty`, `Concession`, `Scholarship` (or `ScholarshipAllocation`). Use `Schema.Types.Mixed` with `default: {}`. No migration needed — Mongoose populates on next write.
- New collection `FeeAlertsCronRun` model per plan §2.2. Required fields: `collegeId`, `startedAt`, `advancedByStage` (default all zeros), `skipped`, `alreadyAdvanced`, `unchanged`, `paused`, `errors: []`. Optional: `finishedAt`, `topLevelError`.
- 4 new indexes per plan §2.4:
  - `Invoice: { collegeId: 1, status: 1, dueDate: 1 }`
  - `DefaulterRecord: { collegeId: 1, escalationStage: 1 }`
  - `Payment: { collegeId: 1, status: 1, createdAt: 1 }`
  - `FeeAlertsCronRun: { collegeId: 1, startedAt: -1 }`

**Tests (10+):**
- DefaulterRecord validates with + without autoEscalationPaused
- DefaulterRecord validates with + without lastEscalationAt
- Invoice accepts arbitrary metadata object; existing records without it still validate
- FeeAlertsCronRun model enforces required fields; rejects if collegeId missing
- FeeAlertsCronRun advancedByStage defaults to { stage_1: 0, ..., welfare_referred: 0 }
- Each new index is created on collection (verify via `.collection.indexes()`)
- Metadata addition is backward-compatible: reading an existing DB record without metadata field returns undefined, not an error

**Notes:** Use `setupMongo/teardownMongo` from existing e2e helpers for DB-backed tests. No new deps.

---

### Task 2: QueueManager `FEE_ALERTS_CRON` entry
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** —

**Acceptance Criteria:**
- Append `FEE_ALERTS_CRON: 'finance:fee-alerts-cron'` to `QUEUE_NAMES` in `backend/src/shared/queue/QueueManager.ts`, under the existing `// Finance` comment group
- Mirror exactly the pattern of `FEE_COMMITMENT` (T4 from fee-configuration feature) and `FEE_PIN_AUDIT` (T17)
- No other changes to QueueManager.ts

**Tests (3):**
- `QUEUE_NAMES.FEE_ALERTS_CRON` is registered
- Queue name uses the `finance:` namespace prefix convention
- No existing queue names removed / renamed (snapshot test or explicit assertion)

---

### Task 3: fee-analytics-service
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 1

**Acceptance Criteria:**

Public API:
```ts
interface DashboardFilters {
  from: Date; to: Date;
  programmeIds?: string[]; branchIds?: string[]; batchIds?: string[]; academicYearId?: string;
}
interface DashboardV1 { /* per plan §1.4 */ }
interface DefaulterListQuery { limit?: number; sort?: 'overdueAmount' | 'daysOverdue'; offset?: number; }
interface DefaulterListItem { studentId, rollNumber, name, programmeName, overdueAmount, daysOverdue, escalationStage, autoEscalationPaused? }

export async function getDashboard(collegeId: string, filters: DashboardFilters, auth: AuthScope): Promise<DashboardV1>;
export async function getDefaulters(collegeId: string, query: DefaulterListQuery, auth: AuthScope): Promise<{ items: DefaulterListItem[]; total: number }>;
```

**Behavior:**
- Six sub-queries run in parallel via `Promise.all`; one MongoDB round-trip
- HOD scope: pre-compute `hodProgrammeIds[]` from the authScope; apply as a filter in every aggregation pipeline
- `funnelByStage` uses `$group` on `DefaulterRecord.escalationStage`
- `collectionTimeSeries` uses `$dateTrunc: { date: '$createdAt', unit: 'day' }` on `Payment.status === 'success'` within `[from, to]`
- `dueVsCollectedByMonth` uses monthly buckets over last 6 months from `to`
- `paymentModeBreakdown` groups `Payment.paymentMode` with `$sum: amount`
- `dueByProgramme` joins `Invoice` with `Programme` for the programme name; sums due + collected
- Result format exactly matches `DashboardV1` interface; TypeScript strict
- No server-side cache for v1

**Tests (12+):**
- Happy path: 10-student fixture with mixed paid / partial / overdue → every KPI matches hand-computed expectations
- HOD scope: seed 2 departments × 5 students each; HOD of CSE sees only CSE funnel counts, never ECE
- Filter by date range: payments outside range excluded from collectionTimeSeries + dueVsCollectedByMonth
- Filter by programme: non-matching programme's data excluded
- Empty result: no overdue students → `funnelByStage` all zeros; no crash
- Null payment mode → bucketed as `'other'`
- Student without programme (edge case) → skipped in dueByProgramme, not crashed
- `getDefaulters` limit + offset pagination works
- `getDefaulters` sort by overdueAmount descending
- `getDefaulters` includes autoEscalationPaused students with paused-until date
- Cross-college isolation: college A's query returns zero college-B records
- p95 latency on 1000-student seeded fixture < 500ms (target; 800ms is the AC)

**Notes:** Use Mongoose `.aggregate()` exclusively; no N+1 find calls. Reuse existing indexes from T1.

---

### Task 4: fee-holds-service
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 1

**Acceptance Criteria:**

Public API:
```ts
export async function listHolds(collegeId: string, query: { status?: HoldStatus; studentId?: string; limit?, offset? }): Promise<{ items: IFinancialHold[]; total: number }>;
export async function activateHold(holdId: string, approvedBy: string): Promise<IFinancialHold>;
export async function waiveHold(holdId: string, approvedBy: string, reason: string): Promise<IFinancialHold>;
```

**Behavior:**
- `listHolds` defaults to ordering `pending_approval` first, then `active`, then `released`; within each group, most recent first
- `activateHold`:
  - Must currently be `pending_approval`; else throws 409 `AppError(409, 'Hold is not pending approval')`
  - Sets `holdStatus = 'active'`, `approvedBy`, `effectiveDate = now`
  - Writes AuditLog entry
- `waiveHold`:
  - Must be `pending_approval` or `active`; else throws 409
  - Sets `holdStatus = 'released'`, `releasedBy`, `releaseDate = now`, `releaseReason = reason`
  - Writes AuditLog entry
- Both mutations fetch + update in single `findOneAndUpdate` with condition on current status; concurrency-safe

**Tests (8):**
- Activate a pending hold → state changes correctly
- Activate already-active hold → 409
- Waive pending hold → state changes correctly
- Waive active hold → state changes correctly
- Waive already-released hold → 409
- Waive without reason → validation error (Zod layer; test at service layer too)
- listHolds default ordering
- listHolds filtered by studentId
- AuditLog emitted on both mutations

---

### Task 5: fee-alerts-cron.worker (HARDEST)
**Type:** Code → captain-tdd
**Status:** Done
**Depends on:** 1, 2

**Acceptance Criteria:**

New file `backend/src/workers/fee-alerts-cron.worker.ts`. Exports:
```ts
export const FEE_ALERTS_CRON_CONCURRENCY = 1;
export const FEE_ALERTS_CRON_JOB_OPTS = { attempts: 3, backoff: { type: 'exponential', delay: 300000 }, cronPattern: '0 2 * * *' };
export async function feeAlertsCronWorker(job: Job<{ collegeId?: string; dryRun?: boolean }>): Promise<void>;
export function registerFeeAlertsCronWorker(): Queue;
```

**Behavior (per plan §1.5):**
- If `job.data.collegeId` provided → runs for that college only. Else → iterates all `status='active'` colleges.
- Per-college: creates `FeeAlertsCronRun` audit record, runs the algorithm, saves audit.
- Partial failure tolerance: one college error is caught + logged; other colleges continue.
- Per-student iteration via `Invoice.find({ status, dueDate: $lt: now }).cursor({ batchSize: 100 })`.
- For each overdue invoice:
  - Skip if student status `∈ {exited, graduated}` (increment `audit.skipped`)
  - Find/create `DefaulterRecord` keyed on `(collegeId, studentId, invoiceId)`
  - Skip if `autoEscalationPaused > now` (increment `audit.paused`)
  - Skip if `lastEscalationAt >= startOfToday` (increment `audit.alreadyAdvanced`)
  - Compute `daysOverdue` + target stage via plan §1.5 table
  - If target stage === current stage → `audit.unchanged`; update `lastEscalationAt`; continue
  - **Transition side effects** (only on stage advance, not same-stage):
    - Into `stage_2` + prior != `stage_2` → create `FinePenalty({ type: 'late_fee', amount: 200, ... })`
    - Into `stage_4` + prior != `stage_4` → create `FinancialHold({ holdType: 'exam_debarment', holdStatus: 'pending_approval', ... })` + enqueue email to Finance Officer + Principal
    - Into `welfare_referred` → set `DefaulterRecord.welfareReferralStatus = 'pending'`; SKIP reminder dispatch
  - Update `DefaulterRecord` (stage, lastEscalationAt, daysOverdue, overdueAmount)
  - If not `welfare_referred` → call existing `executeReminderSequence(collegeId, defaulterId, 'system:fee-alerts-cron')`
  - Increment `audit.advancedByStage[targetStage]`
- `dryRun: true` → NO DB writes; logs every decision; returns counts
- Retry policy: 3 attempts exponential @ 5min
- `registerFeeAlertsCronWorker()` returns the queue so server-startup does `queue.add('nightly', {}, { repeat: { pattern: cronPattern } })` (explicit pattern from caller, per T17 convention)

**Tests (12+ — most critical task):**

Stage transition happy paths:
1. Day 0 invoice → pre-due SMS reminder (no stage yet; no late fee; no hold)
2. Day 3 overdue → stage_1 + SMS reminder, no late fee, no hold
3. Day 10 overdue, first time → stage_2 transition → 1 `FinePenalty` created, 1 WhatsApp reminder queued
4. Day 20 overdue → stage_3 → email + SMS reminders queued
5. Day 40 overdue, first time → stage_4 transition → 1 `FinancialHold` created with status=pending_approval, internal emails enqueued
6. Day 70 overdue → welfare_referred transition → `welfareReferralStatus = 'pending'`, NO reminder enqueued

Side-effect guards:
7. Re-run cron same day, same student → no double late-fee, no double hold (idempotency via lastEscalationAt)
8. Student already at stage_2, still 10 days overdue → no new FinePenalty (stage unchanged)
9. Student at stage_3, moves to stage_4 → exactly 1 FinancialHold created (transition guard)

Edge cases:
10. Student with `autoEscalationPaused = tomorrow` → fully skipped (audit.paused +1)
11. Student with `status = 'exited'` → skipped (audit.skipped +1)
12. Invoice paid in full between cron and reminder dispatch → stub worker pre-check catches and marks reminder `skipped_paid` (this assertion lives in T6's tests; here just assert cron enqueued the reminder)

Isolation + error tolerance:
13. College A throws, college B succeeds → B's audit record written with non-zero counts
14. `dryRun: true` → zero new DB records (no FinePenalty, no FinancialHold, no DefaulterRecord mutations); detailed log output

Unit tests heavily use `setupMongo` with a per-test small fixture. Integration cron runs mocked for time (freeze `Date.now` with `vi.setSystemTime` to control `daysOverdue`).

---

### Task 6: Stub workers (SMS + email + WhatsApp)
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** —

**Acceptance Criteria:**

Three new worker files:
- `backend/src/workers/sms-stub.worker.ts` consumes `platform:sms`
- `backend/src/workers/email-stub.worker.ts` consumes `platform:email`
- `backend/src/workers/whatsapp-stub.worker.ts` consumes `platform:whatsapp`

All share near-identical shape. Each exports:
```ts
export const {CHANNEL}_STUB_CONCURRENCY = 5;
export async function {channel}StubWorker(job: Job<StubDeliveryPayload>): Promise<void>;
export function register{Channel}StubWorker(): Queue;

interface StubDeliveryPayload {
  to: string | null;
  template: string;
  context: object;
  reminderId?: string;
}
```

**Behavior:**
- If `to` is null/empty:
  - Log WARN `[stub-delivery-skipped] channel=<c> reason="missing contact" template=<t>`
  - If `reminderId` → `FeeReminder.updateOne({_id: reminderId}, { deliveryStatus: 'failed', deliveryDetails: { reason: 'missing_contact' } })`
  - Resolve; do not retry
- Else:
  - Pre-dispatch invoice-paid check: if `reminderId` → load FeeReminder, load associated Invoice, if `Invoice.status === 'paid'` → mark `deliveryStatus: 'skipped_paid'`, resolve
  - Log INFO `[stub-delivery] channel=<c> to=<to> template=<t> context=<JSON>`
  - If `reminderId` → update `FeeReminder.deliveryStatus = 'delivered', deliveredAt = now`
  - Resolve
- `registerXxxStubWorker()` gated by `STUB_DELIVERY` env var (default true in non-prod, false in prod — caller checks the flag)

**Tests (10+):**
- SMS stub: happy path → FeeReminder.deliveryStatus becomes 'delivered'
- Email stub: happy path same
- WhatsApp stub: happy path same
- Missing `to` → 'failed' status + skipped log
- Invoice already paid → 'skipped_paid' status
- No reminderId in payload → delivery still logged, no FeeReminder update
- Register function only creates queue/worker once per process
- Concurrency cap enforced (5 simultaneous jobs max)
- STUB_DELIVERY=false → register* functions are no-ops
- Structured log format matches spec (grep-able prefix)

---

### Task 7: Demo seed script
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 1

**Acceptance Criteria:**

New file `backend/src/scripts/seed-fee-demo-data.ts`. Exports:
```ts
export async function runDemoSeed(opts: { collegeId: string; clearFirst?: boolean; confirmCollegeName?: string; dryRun?: boolean }): Promise<DemoSeedSummary>;
```

**CLI:**
```
npx ts-node seed-fee-demo-data.ts --college-id=<id> --confirm-college-name="<exact>" [--clear-first] [--dry-run]
```

**Safety behaviors:**
- `--confirm-college-name` REQUIRED (even for `--dry-run`). Script loads the College, compares `college.name` strict-equals the flag value. Mismatch → exit 1 with clear error.
- `--clear-first` ONLY deletes entities where `metadata.source === 'demo-seed-v1'`. Never touches untagged data.
- Pre-clear entity-count safety: if `countDocuments({ metadata.source: 'demo-seed-v1' })` returns > 500, abort with warning and require `--force` flag (not in v1 spec — just document; keep < 500 cap).

**Seed behavior (per plan §1.7):**
- Create 50 students distributed across 3 programmes × 2 batches. Reuse `createTestStudent` if helper signatures allow; else inline creation.
- Distribution per spec §AC-Demo Seed table (20 paid / 8 partial / 7 upcoming / 6/4/3/2 across stages)
- Payments: 2 failed + 1 reversed spread across last 90 days
- Concessions on 3 random students (sibling or merit)
- ScholarshipAllocation on 2 random students (merit or govt)
- DefaulterRecords + FeeReminders seeded to match escalation-stage distribution
- Every created entity gets `metadata.source = 'demo-seed-v1'` + `metadata.seededAt = <now>`
- CSV output: `demo-seed-<collegeId>-<timestamp>.csv` with rows per student + summary line

**Tests (8+):**
- `--college-id` missing → exit code 1
- `--confirm-college-name` missing → exit code 1
- `--confirm-college-name` mismatch → exit code 1 (no writes)
- `--confirm-college-name` match + `--dry-run` → CSV produced, zero DB writes (count rows before + after)
- `--confirm-college-name` match + commit → 50 students created with `metadata.source` tag
- `--clear-first` → only tagged entities deleted, others untouched (seed + unmarked Invoice → run clear-first → unmarked Invoice still exists)
- Re-run without `--clear-first` → idempotent skip (no duplicates)
- Distribution accuracy: counts of paid/partial/stage_1/2/3/4 match §AC table exactly

---

### Task 8: HTTP API
**Type:** Code → captain-tdd
**Status:** Done
**Depends on:** 3, 4

**Acceptance Criteria:**

Append to `modules/finance/routes.ts`:
- `GET /analytics/dashboard` → `finance:read`, Zod `dashboardQuerySchema`
- `GET /analytics/defaulters` → `finance:read`, Zod `defaultersQuerySchema`
- `GET /holds` → `finance:read`, Zod `holdsListQuerySchema`
- `POST /holds/:id/activate` → `finance:approve` (Principal)
- `POST /holds/:id/waive` → `finance:approve`, Zod `waiveHoldSchema`
- `POST /students/:id/pause-escalation` → `finance:update`, Zod `pauseEscalationSchema`

All routes behind `authenticate` + `authorize()` + shared `feeConfigRateLimit` instance (reuse from T12 of fee-configuration).

Append to `modules/finance/validation.ts` the 4 new Zod schemas. Thin controller delegates to T3/T4 services.

**Tests (e2e HTTP, 20+):**
- Each endpoint: 200 happy / 400 validation / 401 no auth / 403 role mismatch / 404 missing entity / 409 invalid state transition
- Activate: happy path, pending → active
- Waive: waive pending, waive active
- Pause: stores date correctly; dashboard defaulter returns `autoEscalationPaused` in response

E2E harness pattern: reuse `createTestApi` + `seedBase` from the existing `__e2e__/` directory.

---

### Task 9: Admin UI — FeeDashboardPage
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 8

**Acceptance Criteria:**

New file `admin-portal/src/pages/finance/FeeDashboardPage.tsx`. Route `/finance/dashboard`.

- Row 1: 5 KPI cards (Total outstanding, Collected MTD, Collection rate %, Overdue students count/₹, Escalation funnel)
- Row 2: 2 charts — daily collection line (last 90 days), due-vs-collected grouped bar (last 6 months). Use `recharts`.
- Row 3: 3 sections — Top-10 defaulters table, payment-mode breakdown (pie), due-by-programme table
- Page-level filters: date range picker, programme multi-select, branch multi-select, batch multi-select, academic year single-select
- Refresh button (invalidates React Query cache)
- Loading skeletons per section
- Error banners per section on fetch failure
- Empty states per section
- Role gate via `useAuthStore`
- Click-through on defaulter row → `/people/students/:id`
- Responsive down to 1024px
- Add Dashboard tile on Finance hub page

**Verification:**
- `npx tsc --noEmit` clean
- `npm run build -w admin-portal` clean
- Manual-test flow documented in completion signal

---

### Task 10: Admin UI — FinancialHoldsPage
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 8

**Acceptance Criteria:**

New file `admin-portal/src/pages/finance/FinancialHoldsPage.tsx`. Route `/finance/holds`.

- Tabbed view: Pending Approval (default) / Active / Released / All
- Table columns: student name / roll / overdue ₹ / days overdue / hold type / status / actions
- Principal-role-gated `[Activate]` button on pending rows (one-click confirmation dialog → POST /holds/:id/activate)
- Principal-role-gated `[Waive]` button (dialog with reason textarea → POST /holds/:id/waive)
- Finance Officer sees read-only view
- Filters: status, student search, hold type
- Add Holds tile on Finance hub page
- Add entry to Finance hub navigation

---

### Task 11: Admin UI — Pause-auto-escalation block
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 8

**Acceptance Criteria:**

Modify existing `admin-portal/src/components/finance/FeePinsPanel.tsx` (from fee-configuration feature) OR create a sibling `PauseEscalationBlock` if cleaner.

- Block titled "Auto-Escalation Control" with current status (paused until / active)
- Date picker + "Pause until" button
- POST /students/:id/pause-escalation on submit
- React Query invalidation to refresh the panel + the dashboard's defaulter row
- Finance Officer role-gated

---

### Task 12: E2E integration tests
**Type:** Code → captain-tdd
**Status:** Pending
**Depends on:** 3, 4, 5, 6, 7, 8, 9, 10, 11

**Acceptance Criteria:**

New file `backend/src/__e2e__/modules/fee-alerts.e2e.test.ts`. Cover ~8 workflow scenarios:

1. **Seed demo → dashboard populated.** Run demo seed → GET /analytics/dashboard → non-empty KPI + chart data
2. **Cron end-to-end.** Seed 10 students across stages → run cron → assert exact stage advances + FinePenalty count + FinancialHold count + FeeReminder count
3. **Cron idempotent re-run.** Run cron, run again same day → zero additional side effects
4. **Stub delivery.** Cron enqueues 5 reminders → stub workers run → all 5 have `deliveryStatus: 'delivered'`
5. **Hold approval flow.** Cron creates pending hold → Principal POST /activate → status = active
6. **Pause-escalation blocks cron.** Pause student X → run cron → student X not advanced; others advance normally
7. **Invoice paid mid-dispatch.** Seed reminder jobs → pay invoice → run stub workers → `skipped_paid` status set
8. **HOD scope isolation.** HOD of CSE → GET /analytics/dashboard → sees only CSE counts

Reuse existing e2e harness (`createTestApi`, `seedBase`). Mock time via `vi.setSystemTime` for date-dependent scenarios.

---

### Task 13: API reference + QA/deploy checklist
**Type:** Doc → captain-spec direct
**Status:** Pending
**Depends on:** 8, 12

**Expected state:**

Create two files matching the style of `backend/docs/api/fee-configuration.md` + `fee-configuration-qa-checklist.md`:

- `backend/docs/api/fee-analytics-and-alerts.md` — API reference
  - Concepts (dashboard, cron, stub delivery)
  - Data model additions
  - All 6 endpoints documented
  - Cron flow diagram
  - Error codes
  - RBAC mapping
  - Open questions (OQ-1..OQ-6 from plan)
- `backend/docs/api/fee-analytics-and-alerts-qa-checklist.md` — deploy checklist
  - Prerequisites (PR merge + tests)
  - Schema + index verification
  - BullMQ queue + worker registration verification
  - **Demo seed run** (with `--confirm-college-name` safety)
  - Cron first-run verification (check `FeeAlertsCronRun` created after 02:00)
  - Smoke tests (6 manual flows: dashboard open, hold approval, pause-escalation, etc.)
  - Rollback plan (disable cron, disable stub workers, revert PRs)
  - Known limitations (real providers deferred, distress score deferred, etc.)
  - Sign-off (Finance Lead, SRE, Product, Principal)

---

## Spec-to-task traceability

| Spec section | Covered by |
|---|---|
| §Journey 1 Dashboard | T3, T8, T9 |
| §Journey 2 Cron auto-advance | T1, T2, T5 |
| §Journey 3 Stub delivery | T6 |
| §Journey 4 Hold approval | T4, T8, T10 |
| §Journey 5 Pause auto-escalation | T1, T8, T11 |
| §Journey 6 Demo seed | T7 |
| §EC-1..EC-12 | Distributed across T5, T6, T7 |
| §Success Metrics | T12 (cron accuracy), T9 (dashboard latency), T13 (post-deploy monitoring) |

All ~50 ACs trace to ≥1 task; all 12 edge cases have a home.

---

## Changelog

- **2026-04-21** — Initial task list drafted from spec + plan. 13 tasks, 3 parallel starters (T1, T2, T6). Front-loaded risks: T5 (cron, hardest) + T7 (demo seed safety).

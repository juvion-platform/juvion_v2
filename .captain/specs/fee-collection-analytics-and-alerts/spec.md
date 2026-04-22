# Spec: Fee Collection Analytics & Alerts

**Created:** 2026-04-21 · **Last updated:** 2026-04-21 · **Status:** specifying

## What & Why

Juvion v2 has a solid fee data model (Invoice, Payment, StudentFeeAccount, DefaulterRecord, FeeReminder, FinancialHold) and the `executeReminderSequence()` service exists for manual escalation. What's missing is (a) **automation** — no nightly job advances overdue students through the reminder ladder, so Finance Officers have to do it manually every day; (b) **visibility** — `getStats()` is orphaned (no frontend), so the collection health isn't surfaced anywhere; (c) **demo-ability** — no seed script produces interesting fee data, so the feature can't be shown off without hand-crafting records.

This feature closes all three gaps:

1. A **Finance Collections Dashboard** page showing KPIs + time-series + breakdowns + filters
2. A **nightly cron** that scans overdue invoices, advances the DefaulterRecord stage ladder, applies late fees, creates pending-approval holds at stage_4, refers to welfare at stage_5, and enqueues reminder notifications
3. **Stub notification workers** that log would-send events (real SMS/Email/WhatsApp providers are a separate future spec — hybrid architecture; swap the adapter later)
4. A **demo seed script** producing 50 students across the full funnel of paid / partial / stage_1..4 / welfare-referred states, tagged for safe purge

Everything is **additive** — existing models, services, and manual-trigger endpoints are unchanged. This feature orchestrates what's there, visualises it, and fills in the automation/notification gap.

## User Journeys

### Journey 1 — Finance Officer: daily collection check

1. Admin logs in, clicks **Finance → Dashboard**.
2. Dashboard renders Row 1 KPIs (Total outstanding, Collected this month, Collection rate %, Overdue students count + ₹, escalation-funnel counts by stage).
3. Admin scans the time-series (Row 2): collection trend last 90 days, due-vs-collected last 6 months.
4. Admin reviews Row 3 breakdowns: Top-N defaulters, payment-mode breakdown, due-by-programme.
5. Admin clicks a defaulter row → navigates to Student Detail page → sees their Fee Pins tab, payment history, reminder timeline.
6. If something needs immediate action (a stage_4 student without a hold), admin uses existing `/api/finance/reminders/trigger` or the new hold-approval UI.

### Journey 2 — Nightly cron: auto-advance overdue invoices

1. At 02:00, BullMQ repeat job fires per college.
2. Cron queries all `active` colleges' `Invoice` records where `status ∈ {generated, sent, partially_paid}` AND `dueDate < now()`.
3. For each invoice, computes `daysOverdue = today − dueDate`.
4. Determines target stage from cadence table: day 0 pre-due → stage_1 (1–7) → stage_2 (8–14) → stage_3 (15–30) → stage_4 (31–60) → welfare_referred (61+).
5. If the student's `DefaulterRecord` hasn't advanced today AND `autoEscalationPaused` is null/past:
   - Updates `DefaulterRecord.escalationStage` to the target.
   - Calls `executeReminderSequence(collegeId, defaulterRecordId, 'system:fee-alerts-cron')` to record reminders + enqueue delivery jobs on SMS/Email/WhatsApp queues.
   - If transitioning INTO stage_2: creates a `FinePenalty` of type `late_fee`, amount ₹200, tied to the invoice.
   - If transitioning INTO stage_4: creates a `FinancialHold` with `holdType: 'exam_debarment'`, `holdStatus: 'pending_approval'`. Emails Finance Officer + Principal (stub).
   - If transitioning INTO welfare_referred: sets `DefaulterRecord.welfareReferralStatus: 'pending'`. Stops auto-reminders to the student. No parent/student notification.
6. Summary written to a new `FeeAlertsCronRun` collection (audit trail: run date, stages-advanced counts, errors).
7. Per-college partial-failure tolerance: one college throwing doesn't block others.

### Journey 3 — Stub notification delivery

1. The cron (or manual trigger via existing `/reminders/trigger`) enqueues jobs on `platform:sms`, `platform:email`, or `platform:whatsapp` with payload `{ to, template, context }`.
2. **Stub workers** (new, introduced by this feature) consume these queues.
3. Each worker logs a structured INFO line: `[stub-delivery] channel=sms to=+919876543210 template=stage1_reminder context={...}` and resolves the job successfully.
4. `FeeReminder.deliveryStatus` is updated to `delivered` by the stub worker (so the dashboard's reminder-delivery metric looks realistic in demos).
5. A real provider integration (Twilio, AWS SES, WhatsApp Business API) is a future feature that replaces the stub worker without touching the producers.

### Journey 4 — Principal: approve a hold

1. Principal gets an email (stub-logged) at morning briefing: "3 students reached stage_4 overnight; holds pending approval."
2. Clicks the email link → Student Fee Pins tab (or a new `/finance/holds` page — see Q in Plan §1.9) shows pending-approval holds.
3. Principal reviews each case, clicks **Activate Hold** (one-click) on approved cases; **Waive** on exceptional cases.
4. Activating a hold sets `holdStatus: 'active'`, `approvedBy: principal.userId`, `effectiveDate: now`. The hold now actually blocks exam-clearance (enforced by existing clearance module).
5. Waiving marks the hold `released` with `releaseReason: 'waived_by_principal'`.

### Journey 5 — Finance Officer: pause auto-escalation for a specific student

1. Scholarship approval is pending for student X; their overdue invoice should NOT auto-advance to stage_3 while the committee decides.
2. Finance Officer opens student X's Fee Pins tab → clicks **Pause Auto-Escalation** → picks a date (e.g., 14 days from today).
3. `DefaulterRecord.autoEscalationPaused = <date>` stored.
4. Nightly cron checks this field; if `autoEscalationPaused > now()`, skips the student entirely (no reminder, no stage advance, no hold).
5. On the date's expiry, cron resumes normal auto-advance.

### Journey 6 — Demo seeder

1. On a fresh install or for a demo, operator runs `npx ts-node backend/src/scripts/seed-fee-demo-data.ts --college-id=<id> --clear-first`.
2. Script creates 50 students across 3 programmes × 2 batches with the distribution described in Q1. All seeded entities carry `metadata.source = 'demo-seed-v1'`.
3. Payments + concessions + scholarships + DefaulterRecords + FeeReminders seeded to produce realistic dashboard visuals.
4. Running twice: without `--clear-first` → idempotent skip (re-runs are safe); with `--clear-first` → purges entities tagged `demo-seed-v1` then re-seeds.
5. Demo operator opens the dashboard — sees populated KPIs, non-empty funnel, trending time-series.

## Acceptance Criteria

### AC — Dashboard

- [ ] New admin-portal route `/finance/dashboard`, lazy-loaded via existing Finance hub pattern
- [ ] Page title "Fee Collections Dashboard"; Finance hub gets a new tile "Dashboard" linking here
- [ ] Row 1 KPI cards (5 cards): Total outstanding, Collected this month, Collection rate %, Overdue students, Escalation-funnel-by-stage (one combined card showing counts for stage_1/2/3/4/welfare)
- [ ] Row 2 two charts: daily/weekly collection line (last 90 days), due-vs-collected grouped bar (last 6 months). Charting via existing admin-portal chart lib OR `recharts` (already in use per `package.json`).
- [ ] Row 3 three sections: Top-N defaulters table (N=10, clickable rows → student detail), payment-mode breakdown (pie or bar), due-by-programme table
- [ ] Page-level filters: date range, programme multi-select, branch multi-select, batch multi-select, academic year select. All dashboard tiles + charts reflect the filter.
- [ ] Loading skeletons per section; error banners on fetch failure; empty-state messages for each tile
- [ ] Role gate: `finance:read` OR `people:read` with the existing `authorize()` helper. HOD scope filters via `applyAuthScope` (existing pattern).
- [ ] Responsive down to tablet (1024px); desktop-first acceptable, phone-view deferred

### AC — Backend analytics endpoints

- [ ] `GET /api/finance/analytics/dashboard?from=&to=&programmeIds[]=&branchIds[]=&batchIds[]=&academicYearId=` returns a single consolidated JSON with all Row 1 + Row 2 + Row 3 data. Response shape versioned as `v1`.
- [ ] One round-trip per dashboard render (no N+1 requests from the frontend)
- [ ] Aggregation via Mongoose `.aggregate()` pipelines; no naive N-queries
- [ ] Response time p95 < 800ms on a 5000-student college with 1-year invoice history
- [ ] Result is NOT cached at service layer for v1 (fresh every time). React Query caches client-side with 2-minute stale time.
- [ ] Separate endpoint `GET /api/finance/analytics/defaulters?limit=10&sort=overdueAmount` for the Top-N defaulters table (drill-downs might paginate; keep it as its own endpoint)

### AC — Nightly alerts cron

- [ ] New BullMQ queue `finance:fee-alerts-cron` registered in `QueueManager.ts`
- [ ] Worker `backend/src/workers/fee-alerts-cron.worker.ts` with `FEE_ALERTS_CRON_CONCURRENCY = 1` (sequential)
- [ ] Cron pattern `'0 2 * * *'` (daily 02:00); wired at server-start via `registerFeeAlertsCronWorker()`
- [ ] Per-college iteration; skips colleges with `status ≠ 'active'`
- [ ] Partial-failure tolerance: one college's error doesn't fail the job
- [ ] Idempotent per day: each student advances at most once per run (check `DefaulterRecord.lastEscalationAt` against current day)
- [ ] Respects `DefaulterRecord.autoEscalationPaused` — skips paused students
- [ ] Creates `FeeAlertsCronRun` audit record per run per college with counts + errors
- [ ] Re-running same day is a no-op for already-advanced students

### AC — Escalation ladder logic (stage transitions)

- [ ] daysOverdue 0 → pre-due SMS (one-time, day of due date)
- [ ] daysOverdue 1–7 → stage_1 (SMS)
- [ ] daysOverdue 8–14 → stage_2 (WhatsApp) + ONE `FinePenalty` of type `late_fee` amount ₹200 (only created on transition INTO stage_2, not re-created)
- [ ] daysOverdue 15–30 → stage_3 (Email + SMS to student + parent)
- [ ] daysOverdue 31–60 → stage_4 + `FinancialHold` (type `exam_debarment`, status `pending_approval`) + internal email to Finance Officer + Principal + student/parent notifications
- [ ] daysOverdue 61+ → `welfare_referred` + `DefaulterRecord.welfareReferralStatus = 'pending'`; stops auto-reminders (Welfare module takes over — out of scope)
- [ ] Stage downgrades are NOT performed automatically (if student pays partially and days-overdue drops to 5, they stay at the stage they reached). Manual reset via admin UI is a separate v2 feature.
- [ ] `FeeReminder` record written for every cron-triggered notification (audit trail)
- [ ] `ExecutionAction` record written for every stage advancement (audit trail) — reuses existing model

### AC — Stub notification workers

- [ ] Three new workers: `sms-stub.worker.ts`, `email-stub.worker.ts`, `whatsapp-stub.worker.ts` under `backend/src/workers/`
- [ ] Each consumes the existing queue names (`platform:sms`, `platform:email`, `platform:whatsapp`) — no new queues
- [ ] Each worker logs a single structured line per job: `[stub-delivery] channel=<c> to=<to> template=<t> context=<json>`
- [ ] Workers resolve successfully (no retry loops) and mark related `FeeReminder.deliveryStatus = 'delivered'` where a reminderId is present in the job payload
- [ ] Server-startup code registers all three stub workers (separate init function per worker, opt-in via env var `STUB_DELIVERY=true` default enabled in non-prod)
- [ ] Real provider integration is a separate future spec (documented as such in §NOT-For)

### AC — Hold approval UI

- [ ] New list page `/finance/holds` — lists `FinancialHold` records with `holdStatus = 'pending_approval'` first, then `active`, then `released`
- [ ] Principal / super_admin see an "Activate" button on pending-approval rows (one-click → confirmation dialog → `holdStatus = 'active'`, `approvedBy`, `effectiveDate = now`)
- [ ] Principal also sees "Waive" on pending-approval rows (dialog for reason → `holdStatus = 'released'`, `releaseReason = 'waived_by_principal'`)
- [ ] Finance Officer sees read-only view
- [ ] Backend: `POST /api/finance/holds/:id/activate`, `POST /api/finance/holds/:id/waive` endpoints

### AC — Pause auto-escalation UI

- [ ] Student Fee Pins tab (from the earlier feature) gets a new "Auto-escalation" block with a "Pause until …" date picker (Finance Officer role)
- [ ] New field `DefaulterRecord.autoEscalationPaused: Date | null` (schema addition, backward compatible)
- [ ] Backend: `POST /api/finance/students/:id/pause-escalation` with `{ until: ISO-date, reason?: string }`
- [ ] Pause visible on dashboard Top-N defaulters row as a yellow "paused until DD-MMM" chip

### AC — Demo seed script

- [ ] New script `backend/src/scripts/seed-fee-demo-data.ts`
- [ ] CLI flags: `--college-id=<id>` (required), `--clear-first` (purge demo entities tagged `demo-seed-v1` before seeding)
- [ ] Seeds exactly: 50 students (3 programmes × 2 batches), distributed per §Q1 table. Invoices + payments + concessions + scholarships + DefaulterRecords + FeeReminders produce the full funnel.
- [ ] Every seeded entity carries `metadata.source = 'demo-seed-v1'` (or equivalent per-model field if metadata isn't a common field — document in completion signal)
- [ ] Idempotent without `--clear-first` (skips if prior demo run is detected)
- [ ] With `--clear-first`, deletes only entities tagged `demo-seed-v1`; never touches production data
- [ ] Output CSV (`demo-seed-<collegeId>-<timestamp>.csv`) listing what was created / skipped
- [ ] Unit test: idempotent re-run produces zero new records

### AC — Observability

- [ ] Dashboard endpoint latency logged (p95 target < 800ms)
- [ ] Cron run: total students evaluated, advanced per stage, errors — all in the `FeeAlertsCronRun` audit record
- [ ] Stub worker delivery rate: 100% (they're stubs, should never fail)
- [ ] Alert if cron hasn't run in 25 hours (indicates worker not registered or cron timing drift)

## Edge Cases

- **EC-1** Cron runs twice on the same day (manual re-enqueue for testing) → no double-advance. Check via `DefaulterRecord.lastEscalationAt > startOfToday`.
- **EC-2** Student pays in full between stage advance and reminder dispatch → pre-dispatch check in worker: re-read `Invoice.status`; if paid, skip reminder + mark DefaulterRecord resolved.
- **EC-3** Student pays partially, days-overdue drops to 5 — they DO NOT regress to stage_1. Stage never auto-downgrades (per AC above). Manual admin reset is v2.
- **EC-4** Invoice has an active `FeeAgreement` override — auto-escalation still runs against the invoice's amount; late fee still applies; hold still creates. FeeAgreement doesn't pause escalation. Admin must use `pause-escalation` feature for that.
- **EC-5** Student's `Student.status = 'exited'` mid-escalation — cron skips exited/graduated students for reminder dispatch (no point reminding them), but existing DefaulterRecord stays in place for audit/legal/recovery.
- **EC-6** Student's parent has no registered phone or email — reminder enqueues with `to: null`; stub worker logs "skipped: missing contact"; dashboard metric `reminderFailureRate` captures this.
- **EC-7** Concession / scholarship approved AFTER stage_4 hold created — hold remains pending-approval; admin can waive manually. Concession doesn't auto-release holds.
- **EC-8** Payment gateway reverses a payment after reminder was sent (refund) — cron re-evaluates on next run; student may re-enter the funnel.
- **EC-9** College has no `FEE_REMINDER` or stub workers registered on app start — cron still runs, enqueues jobs into empty queues; log warning, don't error out.
- **EC-10** Dashboard filter combination returns zero data (e.g., no CSE students in 2020 batch) — render empty states per tile, not a single "no data" blocker for the whole page.
- **EC-11** Demo seed script run on a production college (accidentally) — operator shoots themselves in foot but `--clear-first` only purges `demo-seed-v1`-tagged entities; never touches production data. Log a big warning if entity count > 100 before proceeding.
- **EC-12** Finance Officer rapidly approves 50 pending holds via UI — each endpoint call is independent; no batching in v1; acceptable since this is a once-a-day activity for a few students.

## NOT For

- **Real notification provider integration** — Twilio / AWS SES / WhatsApp Business API bindings are deferred to a separate future spec. Stub workers with structured logging are the v1 delivery surface.
- **Distress-score computation** — `DefaulterRecord.distressScore` model field exists but its algorithm (blend of attendance drops + grade drops + counseling visits + family income + ...) is a separate feature.
- **Welfare module inbox UI** — this feature sets `welfareReferralStatus = 'pending'` but doesn't build the Welfare-side UI that picks these up.
- **Per-college late-fee amount configuration** — flat ₹200 constant for v1. Admin-editable amount is a separate polish feature.
- **Bulk-payment / cashier workflow UI** — this is analytics + alerts only; no cash collection UI.
- **Stage auto-downgrade when student pays** — stages only advance in v1. Admin manual reset is v2.
- **Downloadable CSV / PDF defaulter reports** — `FinancialReport` model exists; generator is a separate feature.
- **Parent portal view** — admin-only dashboard; parents receive notifications only.
- **Real-time dashboard** — v1 aggregates on every page load; React Query 2-minute stale time is acceptable. WebSocket push deferred.
- **Alerts for cases OTHER than overdue fees** — scholarships lapsing, low-balance refund alerts, budget-overrun alerts etc. are separate.

## Dependencies

- **Depends on:**
  - Existing `Invoice`, `Payment`, `StudentFeeAccount`, `FeeLineItem`, `InvoiceLineItem`, `Concession`, `Scholarship`, `FinePenalty` models
  - Existing `DefaulterRecord`, `FeeReminder`, `FinancialHold`, `EscalationAction` models
  - Existing `executeReminderSequence()` service (reuse verbatim, no changes)
  - Existing `applyAuthScope` helper for HOD scoping
  - Existing BullMQ `QueueManager.ts` + `platform:sms|email|whatsapp` queues
  - Existing PR #45–#50 Fee Configuration feature (pinned FSIs, commitment sheets, audit snapshots) — not strictly required but improves cross-feature story
  - React 19 + Vite admin-portal; `recharts` already installed per package.json
- **Depended on by:**
  - Future real-notification-provider feature (will swap stub workers)
  - Future welfare-referral inbox UI
  - Future distress-score computation
  - Future per-college late-fee config UI

## Success Metrics

- **Demo readiness (hard gate for v1 ship):** operator runs seed script → opens dashboard → screenshot-worthy populated state in < 60 seconds from a fresh install
- **Nightly cron accuracy:** after T+3 days in staging with real students, the escalation funnel matches manual expectations ±2% (i.e., the cron doesn't over- or under-escalate)
- **Dashboard p95 latency:** `<800ms` on a 5000-student college with 1-year invoice history (measured on the `/api/finance/analytics/dashboard` endpoint)
- **Reminder delivery rate (stub):** 100% (stubs always resolve)
- **Hold pending-approval queue depth:** `<5` at any time once the feature is in steady state (Principal clears them daily)
- **Auto-escalation pause uptake:** tracked as a usage metric; target < 5% of overdue students at any time (higher number suggests collection policy needs tuning)
- **Demo data cleanup safety:** zero production records touched by `--clear-first` flag (verified via audit of demo-seed-v1-tagged entity count before + after)

## Changelog

- **2026-04-21** — Initial spec created. Decisions:
  - Option C (hybrid stub delivery, real providers later)
  - Dashboard variant (ii) Standard (Rows 1 + 2 + 3, no activity feed)
  - Stage cadence 0 / 1–7 / 8–14 / 15–30 / 31–60 / 61+, late fee fixed ₹200 at stage_2, holds auto-create with pending-approval
  - Demo seed 50 students with distribution per §AC
  - HOD sees dashboard scoped to their department

- **2026-04-21 (T9 implementation)** — Dashboard charts implemented as **inline SVG components** rather than via `recharts`. The original plan assumed recharts was already installed; it is not, and the "no new npm deps" rule took precedence. The three charts (daily collection line, due-vs-collected grouped bar, payment-mode pie) are hand-rolled SVG. Data contracts still match recharts expectations, so a future swap to recharts is a drop-in replacement if animation/interactivity demands grow.

- **2026-04-21 (T5 implementation)** — Several model-schema deviations from the plan, all non-breaking:
  - `DefaulterRecord.welfareReferralStatus` enum extended to include `'pending'` (plan §1.5 required it)
  - `FinePenalty` lacks `invoiceId` / `appliedAt` fields + no `'applied'` status — cron writes invoice linkage to `metadata.{invoiceId, appliedAt, source}` and uses `status: 'pending'`
  - `FinancialHold` requires `defaulterRecordId` — cron saves defaulter before creating the hold to get a stable `_id`
  - Invoice due filter uses `$lte now` (not `$lt`) so Day-0 invoices get pre-due reminders per spec §Journey 2
  - **Internal-email enqueue on stage_4 hold creation NOT wired** — no helper exists in this codebase; left as TODO. FinancialHoldsPage (T10) is the canonical review surface in the meantime.

- **2026-04-21 (T7 implementation)** — Demo seed idempotency is keyed on a tagged Invoice probe (not Student) because `Student` has no `metadata` field; `--clear-first` deletes demo Students via `rollNumber: /^DEMO-/` and `name: /^Demo Student /i` prefixes. Stage_4 holds seeded with status `active` (not `pending_approval`) to represent already-approved holds in the demo snapshot.

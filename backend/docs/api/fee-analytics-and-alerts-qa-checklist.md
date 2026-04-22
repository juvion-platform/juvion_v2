# Fee Collection Analytics & Alerts — QA & Deploy Checklist

**Complement:** `./fee-analytics-and-alerts.md` (API reference)

This checklist is the **operational handoff** for deploying the Fee Collection Analytics & Alerts feature to production. Every item must be checked by Finance + SRE before declaring the feature live.

---

## 0. Prerequisites

- [ ] All 13 tasks marked `Done` in `.captain/specs/fee-collection-analytics-and-alerts/tasks.md`
- [ ] Backend unit suite green: **545/545 passing** (no regressions)
- [ ] Backend e2e suite green: **233/236 passing** (3 pre-existing skips, unrelated)
- [ ] TypeScript strict check: `npm run typecheck -w backend` returns 0 errors
- [ ] Admin portal build passes: `npm run build -w admin-portal` completes without warnings
- [ ] No open P0/P1 bugs against this feature

---

## 1. Data integrity — pre-flight

- [ ] **Every active College has `status: 'active'`.** The cron iterates `College.find({ status: 'active' })` when no explicit `collegeId` is passed.
  ```
  db.colleges.find({ status: 'active' }).count() >= 1
  ```

- [ ] **No stale `FeeAlertsCronRun` docs from earlier test runs.** Fresh DB has 0 audit rows:
  ```
  db.feealertscronruns.countDocuments() === 0   // OK to keep if intentional
  ```

- [ ] **At least one active `AcademicYear` per college** — demo seed + dashboard filter queries assume this invariant.
  ```
  db.academicyears.find({ status: 'active', collegeId }).count() >= 1
  ```

- [ ] **Existing students have valid `programmeId`.** Orphan students (missing programme) are silently excluded from `dueByProgramme` aggregation; the dashboard will under-report by their contribution:
  ```
  db.students.find({ status: 'active', collegeId, programmeId: null }).count() === 0
  ```

---

## 2. Schema + BullMQ infrastructure

- [ ] **Mongoose schemas load clean on app start.** No `SchemaTypeOptionsError` or enum-mismatch warnings in startup logs.

- [ ] **Required indexes present on MongoDB:**
  - [ ] `invoices`: `{ collegeId: 1, status: 1, dueDate: 1 }`
    ```
    db.invoices.getIndexes() | grep collegeId_1_status_1_dueDate_1
    ```
  - [ ] `defaulterrecords`: `{ collegeId: 1, escalationStage: 1 }`
  - [ ] `payments`: `{ collegeId: 1, status: 1, createdAt: 1 }`
  - [ ] `feealertscronruns`: `{ collegeId: 1, startedAt: -1 }`

- [ ] **Enum extensions present in schemas (inspect `.schema.obj` at runtime):**
  - [ ] `FinancialHold.holdStatus` includes `'pending_approval'`
  - [ ] `DefaulterRecord.welfareReferralStatus` includes `'pending'`
  - [ ] `FeeReminder.deliveryStatus` includes `'skipped_paid'`

- [ ] **BullMQ queues registered on app start:**
  - [ ] `QUEUE_NAMES.FEE_ALERTS_CRON === 'finance:fee-alerts-cron'`
  - [ ] `platform:sms`, `platform:email`, `platform:whatsapp` existing queues untouched

- [ ] **Stub workers registered (non-prod) or explicitly disabled (prod):**
  - [ ] `STUB_DELIVERY` env var: `true` / unset for pilot/staging; `false` for production
  - [ ] If `STUB_DELIVERY=false` and no real providers wired → reminders will sit as `pending` forever. Intentional until real providers ship; document in runbook.

- [ ] **Nightly cron scheduled** (server-startup code must call):
  ```ts
  const queue = registerFeeAlertsCronWorker();
  await queue.add('nightly', {}, {
    repeat: { pattern: '0 2 * * *' },
    attempts: 3,
    backoff: { type: 'exponential', delay: 300000 }
  });
  ```
  Inspect via `queue.getRepeatableJobs()` to confirm.

---

## 3. Demo seed (optional — pilot colleges only, skip for production)

**Finance sign-off gate:** do NOT run this on a production college without Finance Lead approval. The `metadata.source: 'demo-seed-v1'` tag + `--clear-first` purge is the only safety net.

### 3a. Dry-run

- [ ] Run demo seed in dry-run for ONE pilot college:
  ```
  npx ts-node backend/src/scripts/seed-fee-demo-data.ts \
    --college-id=<id> \
    --confirm-college-name="<exact>" \
    --dry-run
  ```
- [ ] Review the generated CSV (written to `os.tmpdir()` by default) with Finance Officer
- [ ] Confirm the 50-student distribution summary line is reasonable

### 3b. Commit

- [ ] Re-run without `--dry-run`:
  ```
  npx ts-node backend/src/scripts/seed-fee-demo-data.ts \
    --college-id=<id> \
    --confirm-college-name="<exact>"
  ```
- [ ] Verify counts:
  ```
  db.students.countDocuments({ collegeId, 'metadata.source': 'demo-seed-v1' }) === 50
  db.invoices.countDocuments({ collegeId, 'metadata.source': 'demo-seed-v1' }) >= 50
  db.defaulterrecords.countDocuments({ collegeId, 'metadata.source': 'demo-seed-v1' }) === 15
  db.financialholds.countDocuments({ collegeId, 'metadata.source': 'demo-seed-v1' }) === 2
  ```

### 3c. Cleanup (if needed)

- [ ] `--clear-first` purges ONLY tagged demo entities:
  ```
  npx ts-node backend/src/scripts/seed-fee-demo-data.ts \
    --college-id=<id> \
    --confirm-college-name="<exact>" \
    --clear-first
  ```
  After this runs, untagged production Invoices / Payments / Students remain untouched.

---

## 4. Cron first-run verification

- [ ] Wait for the first 02:00 run after deploy (or trigger manually via `queue.add('manual-test', { collegeId: <id> }, {})`).

- [ ] Confirm audit doc exists:
  ```
  db.feealertscronruns.findOne({ collegeId }, { sort: { startedAt: -1 } })
  // expect finishedAt set, advancedByStage keys present, errors: []
  ```

- [ ] Sanity check counts:
  - `advancedByStage.stage_2` approximately equals the count of newly-overdue (8+ day) students who weren't already at stage_2
  - `paused` reflects pauses set via the Pause-Escalation UI
  - `skipped` includes exited / graduated students
  - `errors[]` is empty (or all entries are isolated to specific invoices, not college-wide)

- [ ] Spot-check one student:
  ```
  db.defaulterrecords.findOne({ studentId: <X>, collegeId })
  // expect lastEscalationAt === <run time>, escalationStage matches daysOverdue
  ```

- [ ] Verify side-effects:
  - [ ] `FinePenalty.find({ type: 'late_fee', amount: 200, 'metadata.source': 'fee-alerts-cron' })` count matches new stage_2 transitions
  - [ ] `FinancialHold.find({ holdStatus: 'pending_approval' })` count matches new stage_4 transitions

---

## 5. Observability

- [ ] **Structured logs grep-able:**
  - `[stub-delivery]` appears for each happy-path reminder dispatch
  - `[stub-delivery-skipped]` appears for missing-contact or invoice-paid cases
  - Cron log lines identify college + counts

- [ ] **AuditLog rows:**
  ```
  db.auditlogs.find({
    entityType: 'FinancialHold',
    action: 'update',
    createdAt: { $gte: <today> }
  }).count() >= <expected-approvals>
  ```

- [ ] **Dashboard latency:** spot-check `/api/finance/analytics/dashboard` p95 < 800ms on a representative college. Use `curl -w '%{time_total}\n'` or APM tooling.

---

## 6. Smoke tests (6 manual flows)

Execute these in the admin portal on a seeded pilot college:

- [ ] **Dashboard renders (Admin role):** navigate to `/finance/dashboard` → all 5 KPI cards populate, 2 charts render, 3 Row-3 sections load without errors
- [ ] **Dashboard scoped (HOD role):** log in as HOD of CSE → funnel counts reflect only CSE students, ECE rows absent from `dueByProgramme`
- [ ] **Holds page (Principal role):** navigate to `/finance/holds` → "Pending Approval" tab default, pending count badge visible, `[Activate]` + `[Waive]` buttons visible on pending rows
- [ ] **Activate a hold:** click `[Activate]` on a pending row → confirmation dialog → POST 200 → row moves to Active tab → badge count decrements
- [ ] **Pause escalation:** open a student's FeePinsPanel → "Auto-Escalation Control" block → set date 7 days out → Pause → status badge updates → run cron → verify defaulter's stage unchanged
- [ ] **Stub delivery log line:** trigger a reminder dispatch (via cron or manual `executeReminderSequence`) → confirm `[stub-delivery] channel=sms …` line appears in backend logs

---

## 7. Rollback plan

If the feature misbehaves post-deploy:

### Data
- [ ] **`FeeAlertsCronRun` collection can be safely dropped** — re-seeded on next cron run. No migration state to preserve.
- [ ] **`FinancialHold` rows with `holdStatus: 'pending_approval'`** should be waived or activated by Principal rather than deleted (audit trail integrity). If deletion is unavoidable, document the incident.

### Code
- [ ] **Disable cron registration** — remove the `queue.add('nightly', ...)` call at server startup. Existing repeat job persists in Redis until drained:
  ```
  const queue = new Queue(QUEUE_NAMES.FEE_ALERTS_CRON, { connection });
  const jobs = await queue.getRepeatableJobs();
  for (const j of jobs) await queue.removeRepeatableByKey(j.key);
  await queue.drain();
  ```

- [ ] **Disable stub workers** — set `STUB_DELIVERY=false` and redeploy. Reminders sit as `pending` harmlessly.

- [ ] **Feature flag:** none currently. The feature is embedded via cron registration at server startup. If you need on/off toggling, add an env gate around `registerFeeAlertsCronWorker()` and document.

### Worst case
- [ ] **Revert all 13 task PRs in reverse order** (T13 → T1). The schema additions (`autoEscalationPaused`, `lastEscalationAt`, `metadata.source`, enum extensions, `FeeAlertsCronRun` collection) are additive and backward-compatible — existing data continues to read/write fine without the new fields.

---

## 8. Known limitations (communicate to Finance + Product)

1. **Real SMS/Email/WhatsApp delivery not wired.** Reminders are logged via stub workers only. When real providers ship, `STUB_DELIVERY=false` + register real workers. Producer is unchanged.
2. **Internal-email enqueue on stage_4 holds is a TODO.** No email-enqueue helper exists in the codebase. FinancialHoldsPage (T10) is the canonical review surface; Principal must check the page daily.
3. **Recharts is NOT installed.** Dashboard charts are inline SVG. Visual fidelity is v1 — no animations, simpler tooltips. Can swap to recharts in a future release.
4. **Dashboard `dueByProgramme` requires Programmes.** Orphan students (no `programmeId`) are excluded from this section; totalOutstanding still includes them.
5. **Holds list shows studentId only.** Server-side `$lookup` for student name/programme/overdue deferred to v2. Click-through to `/people/students/:id` provides details.
6. **Pause-escalation UI reads status via defaulters-list** (client-side filter, limit=100). Students beyond offset 100 see "Not a defaulter" as a degraded state.
7. **`'approve'` action not in `authorize()` enum.** Principal actions (Activate/Waive/Pause) use `('finance', 'update')`. One-line swap possible if a dedicated `'approve'` action is preferred.
8. **Late fee amount hard-coded ₹200.** Per-college configurability would need a new `FeeConfig` entry. Not requested for v1.
9. **Forward-only escalation.** A student who partially pays while at stage_3 does NOT downgrade to stage_2 automatically. Intentional — matches spec §Journey 2.
10. **Demo seed caps at ~50 students + 500 entity safety limit.** Do NOT run on a college with >500 pre-existing tagged demo entities without bumping the hard-coded limit.

---

## 9. Post-deploy monitoring (2-week window)

- [ ] **`FeeAlertsCronRun.errors.length`** should be 0 across all nightly runs. Any non-zero value is a signal to investigate.
  ```
  db.feealertscronruns.aggregate([
    { $match: { startedAt: { $gte: <today-14d> } } },
    { $group: { _id: '$collegeId', totalErrors: { $sum: { $size: '$errors' } } } }
  ])
  ```

- [ ] **Pending-approval hold queue depth** should remain `< 5` per college in steady state (Principal clears daily):
  ```
  db.financialholds.countDocuments({ holdStatus: 'pending_approval', collegeId }) < 5
  ```

- [ ] **Dashboard p95 latency** < 800ms. Measure via APM over a 7-day window.

- [ ] **Auto-escalation pause uptake** < 5% of overdue students at any time. Higher indicates collection policy may need tuning.
  ```
  const paused = db.defaulterrecords.countDocuments({ autoEscalationPaused: { $gt: new Date() } });
  const total  = db.defaulterrecords.countDocuments({ escalationStage: { $ne: 'cleared' } });
  paused / total < 0.05
  ```

- [ ] **Stub delivery success rate** = 100% until real providers ship (stubs always resolve unless the job payload is malformed).

---

## 10. Sign-off

- [ ] **Finance Lead** — verified §1, §3, §4, §6; confirms stage cadence + ₹200 late fee policy are acceptable
- [ ] **SRE** — verified §2, §5, §7; confirms cron registration, observability, and rollback plan
- [ ] **Product** — verified §6, §8; confirms UX expectations and accepts the v1 known limitations
- [ ] **Principal** — verified §6 smoke tests for Activate / Waive; accepts the pending-approval workflow

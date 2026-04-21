# Fee Configuration — QA & Deploy Checklist

**Complement:** `./fee-configuration.md` (API reference)

This checklist is the **operational handoff** for deploying the Fee Configuration feature to production. Every item must be checked by Finance + Ops before declaring the feature live.

---

## 0. Prerequisites

- [ ] All 21 tasks marked `Done` in `.captain/specs/fee-configuration/tasks.md`
- [ ] All 5 PRs (#45, #46, #47, #48, #49, #50) merged to `main`
- [ ] Backend suite green on CI: 441/441 passing + 7/10 e2e (3 skipped, documented TODOs)
- [ ] Admin portal build passes in CI
- [ ] No open P0/P1 bugs against Fee Configuration

---

## 1. Data integrity — pre-flight

- [ ] **Every active college has at least one active `AcademicYear` with `startDate ≤ today ≤ endDate`.** The `resolveStudentYearOfStudy` helper requires this to pick the current AY when no explicit `academicYearId` is passed. Missing AYs cause per-student fallback (logged) but are not fatal.
  ```
  db.academicyears.find({ status: 'active', startDate: { $lte: new Date() }, endDate: { $gte: new Date() } })
  ```

- [ ] **For every programme actively admitting students, verify an approved FSI exists for Year-1 in the current admission AY.** Without this, all new admissions fail with 422 "coordinate with Finance" errors.
  ```
  // For each active college + programme combination:
  db.feestructureinstances.find({ collegeId, programmeId, status: 'active', academicYearId: currentAdmissionAY }).count() >= 1
  ```
  Recommend running this as a proactive dashboard warning 30 days before admission-window start (see T8 AC).

- [ ] **Every existing active Student has a valid `batchId`.** `resolveStudentYearOfStudy` throws when `batchId` is missing. T16 backfill silently skips such students → they show up as "unresolvable" in the audit CSV.
  ```
  db.students.find({ status: 'active', $or: [ { batchId: null }, { batchId: { $exists: false } } ] }).count() === 0
  ```

- [ ] **Component template seeded for every active college.** On fresh DB: run `npx ts-node backend/src/scripts/seed-fee-component-template.ts`. Idempotent — preserves existing customizations.
  ```
  db.feecomponenttemplates.countDocuments({ collegeId, isDefault: true }) === 33
  ```

---

## 2. Schema + BullMQ infrastructure

- [ ] **Mongoose schemas load clean on app start.** No `SchemaTypeOptionsError` or unknown-cast warnings in startup logs.
- [ ] **`Student.feePins` sparse index present.**
  ```
  db.students.getIndexes() // expect { "feePins.feeStructureInstanceId" : 1 } sparse
  ```
- [ ] **`FeeComponentTemplate` unique index present.**
  ```
  db.feecomponenttemplates.getIndexes() // expect unique (collegeId_1, componentKey_1)
  ```
- [ ] **`FeePinAuditSnapshot` compound index present.**
  ```
  db.feepinauditsnapshots.getIndexes() // expect (collegeId_1, runAt_-1)
  ```
- [ ] **BullMQ queues registered on app start:**
  - [ ] `finance:fee-commitment` (from T4)
  - [ ] `finance:fee-pin-audit` (from T17)
- [ ] **Nightly audit cron scheduled.** Server-startup code calls:
  ```ts
  await queue.add('nightly', {}, {
    repeat: { pattern: '0 2 * * *' },
    attempts: 3, backoff: { type: 'exponential', delay: 300000 }
  });
  ```
  Inspect via `queue.getRepeatableJobs()` to confirm.

---

## 3. Backfill (one-shot pre-rollout)

This is the **most critical step**. Plan §4.1 called this out as the hardest part of the feature.

### 3a. Dry-run

- [ ] Run backfill in dry-run mode for ONE small college first:
  ```
  npx ts-node backend/src/scripts/backfill-fee-pins.ts --college-id=<id> --dry-run
  ```
- [ ] **Inspect the CSV output** (`backfill-audit-<collegeId>-dry-run-<timestamp>.csv`):
  - [ ] Summary line at the bottom shows totals (`# total=N wouldPin=X ...`)
  - [ ] `wouldPin` count matches expected active students in that college
  - [ ] `unpinnable` rows — any student whose FSI combo doesn't exist yet (Finance must approve the missing structures BEFORE `--commit`)
  - [ ] `unresolvable` rows — students with missing `batchId` / invalid `admissionYear` / no matching AY. These need data repair before backfill can pin them.

### 3b. Finance sign-off

- [ ] **Share the dry-run CSV with Finance Lead.** They must confirm:
  - [ ] The "wouldPin" FSI for each student matches their expectation (programme, branch, quota, category alignment)
  - [ ] Totals in the "detail" column match Finance's current published structures
  - [ ] Any "unpinnable" rows have been triaged — either Finance approves the missing FSI, or the student is flagged for manual review
- [ ] **Written sign-off recorded** (email / ticket / workflow entry). This is the audit trail for the migration.

### 3c. Commit

Only after sign-off:

- [ ] Run commit mode:
  ```
  npx ts-node backend/src/scripts/backfill-fee-pins.ts --college-id=<id> --commit
  ```
- [ ] Inspect the commit CSV — row statuses should be `pinned` / `already-pinned` / `unpinnable` / `unresolvable`. Zero `error` rows.
- [ ] **Spot-check 5 random students** in the DB:
  ```
  db.students.findOne({ _id: <studentId> }, { feePins: 1 })
  ```
  Expect: one active pin per current year-of-study, `pinnedBy: 'system:backfill'`, `reason: 'initial'`.

### 3d. Remaining colleges

- [ ] Repeat 3a–3c for each remaining college.
- [ ] **Post-backfill metric:**
  ```
  db.students.find({ status: 'active', 'feePins.archivedAt': null }).count() / db.students.find({ status: 'active' }).count() >= 0.95
  ```
  Target is 100%; < 95% indicates missing FSIs / data-quality issues to triage before go-live.

### 3e. Rollback contingency

If the backfill produces wrong pins and needs to be undone:
```
npx ts-node backend/src/scripts/backfill-fee-pins.ts \
  --college-id=<id> \
  --rollback-pins-created-by=system:backfill \
  --since=<ISO-date-when-backfill-ran>
```
This narrowly archives only backfill-created pins after the date. **Pins from admission (`system:admission`) and promotion (`system:promotion`) are untouched.**

---

## 4. Lateral-entry schema (T21)

- [ ] **Run the study-year backfill:**
  ```
  npx ts-node backend/src/scripts/backfill-study-year-at-admission.ts --college-id=<id> --commit
  ```
  Populates `Student.studyYearAtAdmission = 1` for all existing records (safe default; lateral-entry students get flipped to `2+` manually via future Admin UI).

- [ ] **Identify lateral-entry students** and flip them to the correct value:
  - Diploma-holders entering BTech Year 2 → `studyYearAtAdmission = 2`
  - Transfer-ins from other universities → case-by-case
  - For v1, flip via mongo shell:
    ```
    db.students.updateMany(
      { _id: { $in: [<lateral-entry-student-ids>] } },
      { $set: { studyYearAtAdmission: 2 } }
    )
    ```
  - After the flip, they'll re-resolve to the correct year on next invoice run.

---

## 5. Observability

- [ ] **Finance dashboard shows:**
  - [ ] Pin coverage % (target: 100%)
  - [ ] Deferred-pin count (target: < 5)
  - [ ] Stale-pin count (target: < 10)
  - [ ] Commitment-sheet failure rate (target: < 1%)
  - [ ] Invoice-pin mismatch count (target: 0)
- [ ] **Alerts wired:**
  - [ ] Coverage < 100% → email to Principal + Finance Officer (daily digest)
  - [ ] Invariant mismatch > 0 → immediate alert (Phase 2 — currently daily via T17 nightly job)
  - [ ] PDF failure rate > 5% → SRE alert
- [ ] **Nightly snapshot populated.** Wait 24 hours after first cron tick:
  ```
  db.feepinauditsnapshots.find({ collegeId: <id> }).sort({ runAt: -1 }).limit(1)
  ```
  Should have latest `runAt` within last 24 hours.

---

## 6. End-to-end smoke tests (manual)

### 6a. Admission flow
- [ ] Create a test applicant → advance through admission workflow → verify:
  - [ ] Student's `feePins[0]` populated with Year-1 pin
  - [ ] `pinnedBy: 'system:admission'`, `reason: 'initial'`
  - [ ] `commitmentSheetDocumentId` populated within 2 minutes (async PDF)
  - [ ] `StudentFeeAccount.totalDue` matches pinned FSI's `totalAmount`

### 6b. Promotion flow
- [ ] Run `promoteStudents` on a test batch (via admin UI `/academics/promotion` or API):
  - [ ] Summary shows `promoted: N, deferredPins: 0` for a fully-approved case
  - [ ] Each promoted student's `feePins[]` now has a Year-(N+1) active pin with `pinnedBy: 'system:promotion'`
- [ ] Repeat with one programme missing its Year-(N+1) FSI:
  - [ ] Summary shows `deferredPins` with that programme's students
  - [ ] Admin UI surfaces "Retry all" action
  - [ ] After Finance approves the missing FSI, clicking "Retry all" pins the remaining students

### 6c. Attribute-drift rebind
- [ ] Pick a test student. PATCH their `branchId` via the existing student-edit UI.
- [ ] Open the student's Fee Pins tab → **stale-pin yellow banner appears**
- [ ] Log in as Principal → click Re-pin → dialog loads FSI candidates for the new branch → submit
- [ ] Old pin archived (visible in history toggle); new pin active

### 6d. Programme transfer
- [ ] Hit `POST /api/finance/students/:id/transfer-programme` with a valid target programme
- [ ] Verify: old pin archived with `reason: 'programme_transfer'`, new pin against new programme's FSI, `programmeId` updated on Student
- [ ] Prior-year pins untouched (historical)

### 6e. Commitment sheet PDF
- [ ] Open a student's Fee Pins tab → click commitment-sheet link → PDF downloads
- [ ] PDF contains: college header, student block, component-wise table, totals, signature lines
- [ ] Click "Regenerate Sheet" → success toast → new document replaces old (old marked revoked)

### 6f. Invoice generation
- [ ] Trigger semester invoice for a pinned student
- [ ] Verify each `InvoiceLineItem.sourcePinId` points to the student's active pin
- [ ] Invoice total matches pinned FSI's total (minus concessions / scholarships per existing logic)

---

## 7. Rollback plan

If the feature behaves catastrophically post-deploy:

### Revert pins (data)
- [ ] Use T16's rollback mode:
  ```
  npx ts-node backend/src/scripts/backfill-fee-pins.ts \
    --college-id=<id> \
    --rollback-pins-created-by=system:backfill \
    --since=<deploy-date>
  ```
- [ ] If production pins from admission/promotion are also wrong: fix the underlying service (FSI data or pinYear logic) — do NOT mass-archive `system:admission` or `system:promotion` pins.

### Revert code (branches)
- [ ] Revert PRs in reverse order: #50 → #49 → #48 → #47 → #46 → #45.
- [ ] Each PR is atomic per task; selective reverts are possible but retest impact.

### Disable audit worker (if it's thrashing)
- [ ] Remove the repeat entry:
  ```ts
  const repeatable = await queue.getRepeatableJobs();
  const nightly = repeatable.find(j => j.name === 'nightly');
  if (nightly) await queue.removeRepeatableByKey(nightly.key);
  ```

---

## 8. Known limitations (ship-aware)

These are documented limitations, not bugs. Reviewers and operators should know about them:

- **M02 Documents workaround (OQ-8):** Commitment sheet PDFs are stored as `ExitDocument` with `type='bonafide'` + metadata escape hatch. A proper generic Documents subsystem is a separate spec.
- **FeeAgreement override (OQ-15):** Not wired into `generateSemesterInvoice` today. Spec's original claim was inaccurate. Separate spec needed if Finance requires this.
- **Lateral-entry detection manual (T21):** Admins must flip `studyYearAtAdmission` to 2+ for lateral-entry students via mongo shell until future Admin UI adds the toggle.
- **3 T18 e2e scenarios skipped:** Scenarios 1 (admission pin e2e), 3 (promotion pin e2e), 7 (supersede + invoice). Their underlying behaviours ARE covered by unit tests; only the full-orchestration e2e variant was flaky in the harness.
- **Graduated students in T16:** The backfill pins `status='active'` students at `year=durationYears` when the AY math says they've completed the programme. Operators should retire these students before backfill.
- **No Mongoose transactions (OQ-14):** T8 + T11 use compensating-rollback patterns. A mid-operation crash may leave partial state (Student created, pin not). Probability low; recovery via re-running the workflow (idempotent).

---

## 9. Post-deploy monitoring (first 2 weeks)

- [ ] Daily review of `fee-pin-audit` nightly snapshots
- [ ] Coverage < 100%? Investigate the per-student "missingSample" list in the snapshot → usually means new admissions whose backfill step was skipped or FSIs not approved yet
- [ ] Invariant mismatches > 0? Investigate immediately:
  - Is the invoice using a different FSI than the pin? (should never happen post-deploy)
  - Was a concession applied out-of-band?
- [ ] Commitment-sheet failure rate > 1%? Check `FEE_COMMITMENT` queue dead-letter jobs + pdfkit error logs
- [ ] Deferred-pin count rising? Finance may be slow to approve new AY's FSIs; proactive cross-team check

---

## 10. Sign-off

When all above items are ✅, record in the deploy ticket:

- [ ] **Finance Lead:** Sign-off on backfill CSV + data integrity checks
- [ ] **SRE / DevOps:** Sign-off on observability + cron + alert plumbing
- [ ] **Product / Engineering:** Sign-off on smoke tests (6a-6f)
- [ ] **Principal / Admin:** Final go-no-go for switching on new admission flow (bound by FSI availability)

Feature is **live** from the moment the admissions workflow starts pinning new students. No feature flag — the pinning is embedded in `provision_m04`.

---

**Spec:** `.captain/specs/fee-configuration/spec.md`
**Plan:** `.captain/specs/fee-configuration/plan.md`
**Tasks:** `.captain/specs/fee-configuration/tasks.md`
**API reference:** `./fee-configuration.md`

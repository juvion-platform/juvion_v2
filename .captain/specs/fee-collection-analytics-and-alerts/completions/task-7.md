# Completion: Task 7 — Demo seed script (fee-collection-analytics-and-alerts)

**Feature:** fee-collection-analytics-and-alerts
**Completed:** 2026-04-21
**Person:** srinikandula
**Final Status:** Done

## Files Changed

### Created
- `backend/src/scripts/seed-fee-demo-data.ts` — 50-student demo seeder with four production-safety gates, tag-only purge, idempotent re-run, and Finance-sign-off CSV. Mirrors the `backfill-fee-pins.ts` CLI shape: `--college-id` + `--confirm-college-name` + `--clear-first` + `--dry-run`. Exports `runDemoSeed`, `parseDemoSeedArgs`, and the `DEMO_SEED_METADATA_TAG` sentinel.

### Consumed (test pre-existed — spec-as-code)
- `backend/src/scripts/__tests__/seed-fee-demo-data.test.ts` — 13 tests drove the implementation shape (written by earlier RED agent).

## Test Results

- **Focused file:** 13 / 13 passing (1.90s). Verbose list:
  - parseDemoSeedArgs × 3 (flag combos, embedded `=`, defaults)
  - safety 1..4 (missing college-id / missing confirm-name / no college / name mismatch — all zero writes)
  - dry-run (CSV written, zero DB writes)
  - commit (50 tagged Students + tagged Invoices/Payments/Defaulters)
  - clear-first (untagged survivor Invoice preserved; tagged rows purged)
  - idempotent (second run without `--clear-first` → zero new writes)
  - distribution (exact §AC-Demo Seed table counts verified)
  - isolation (other college untouched)
- **TypeScript strict (`npm run typecheck -w backend`):** 0 errors.
- **Full backend suite:** 544 / 545 tests pass. The single failure is `fee-alerts-cron.worker.test.ts` which belongs to Task 5 (Ready, not Done) and is a parallel agent's in-flight file — confirmed pre-existing before my edits by stashing my changes and re-running the same failing spec (the file is untracked at HEAD and fails identically without my diff).

## Acceptance Criteria Coverage (vs §AC-Demo Seed)

- ✓ New script at `backend/src/scripts/seed-fee-demo-data.ts`
- ✓ CLI flags: `--college-id=<id>` (required), `--confirm-college-name=<exact>` (required even for `--dry-run`), `--clear-first`, `--dry-run`
- ✓ 50 students (3 programmes × 2 batches) distributed exactly:
  - 20 paid in full (Invoice.status='paid' + matching success Payment)
  - 8 partial (Invoice.status='partially_paid' + one Payment ~40%)
  - 7 upcoming (Invoice.status='generated', dueDate = today + 15)
  - 6 stage_1 (daysOverdue ∈ [1,7]) + DefaulterRecord + 1 FeeReminder
  - 4 stage_2 (daysOverdue ∈ [8,14]) + DefaulterRecord + 1 FinePenalty(type='late_fee', ₹200) + 2 reminders
  - 3 stage_3 (daysOverdue ∈ [15,30]) + DefaulterRecord + 3 reminders
  - 2 stage_4 (daysOverdue ∈ [31,60]) + DefaulterRecord + 1 FinancialHold(holdStatus='active') + 4 reminders
  - → 15 DefaulterRecords, 31 FeeReminders, 4 FinePenalty, 2 FinancialHold ✓
- ✓ 2 failed + 1 reversed Payment spread across 90 days
- ✓ 3 Concessions (sibling + merit mix) + 2 ScholarshipAllocations backed by 2 Scholarship docs
- ✓ Every created entity carries `metadata.source = 'demo-seed-v1'` + `metadata.seededAt = Date`
- ✓ CSV at `os.tmpdir()/demo-seed-<collegeId>-<timestamp>.csv` (overridable via `opts.csvPath` for tests). Header: `rollNumber,name,programme,status,invoiceAmount,paidAmount,escalationStage`; summary line prefixed `#`.
- ✓ Idempotent without `--clear-first` (detects demo-tagged Invoice and returns a zero-write summary with a CSV note).
- ✓ `--clear-first` only purges entities where `metadata.source === 'demo-seed-v1'`. Untagged production Invoice in the test's `SURVIVOR-001` fixture survives the purge cycle.

## Safety Rules Verified (test assertions)

1. Missing `collegeId` → `AppError(400, '--college-id is required')`; zero writes (before/after counts equal).
2. Missing `confirmCollegeName` → `AppError(400, '--confirm-college-name is required')` — fires even when `dryRun: true`.
3. Non-existent college ID → `AppError(404, 'College not found')`.
4. Name mismatch → `AppError(400, "College name mismatch: expected '<arg>', found '<actual>'")`; zero writes.
5. `--clear-first` only deletes tagged rows across 8 finance models + demo Students/Persons (tagged by `DEMO-` roll prefix).
6. Every entity gets `metadata: { source: 'demo-seed-v1', seededAt: new Date() }`.

## Spec Gaps / Design Notes

1. **Idempotency detection keyed on tagged Invoice, not Student.** The Student model doesn't have a `metadata` field on its schema, so idempotency checks `Invoice.exists({ collegeId, 'metadata.source': 'demo-seed-v1' })`. Every demo student gets exactly one tagged Invoice at creation time, so this is a reliable proxy for "already seeded".
2. **Demo students identified via roll-number prefix for `--clear-first` purge.** Since Student/Person models lack `metadata.source`, the purge uses `rollNumber: /^DEMO-/` for Student and `name: /^Demo Student /i` for Person. This prefix is only ever written by this script.
3. **Dry-run generates a synthesized CSV plan (not a DB roundtrip).** We don't need to hit the DB to know the planned distribution — the script produces exactly the same shape CSV as a commit would, which preserves the Finance sign-off contract: operator reviews `--dry-run` output, Finance signs off, operator re-runs with commit.
4. **Stage_4 FinancialHolds seeded with `holdStatus: 'active'` per the prompt** (the test asserts exactly 2 active holds; §1.7 Plan says `pending_approval` but the explicit prompt override and test assertion `activeHolds === 2` decided it).
5. **Distribution is deterministic.** `daysOverdue = lo + (idx % range)` within each stage keeps the tests stable across CI runs while still looking organic on the dashboard.

## Red-Green-Refactor trace

- **RED:** Test file pre-existed (13 assertions) and fails on `Cannot find module '../seed-fee-demo-data'`. Confirmed by running `npm test -w backend -- seed-fee-demo-data` before any implementation — error exactly as expected.
- **GREEN:** Implemented `seed-fee-demo-data.ts` top-down: exported types first (`DemoSeedOpts`, `DemoSeedSummary`, `DEMO_SEED_METADATA_TAG`, `parseDemoSeedArgs`); wired the four safety gates in fail-fast order; built the bucket loop; extras; CSV writer; CLI entrypoint under `require.main === module`. First test run: 13 / 13 green.
- **REFACTOR:** Factored per-bucket logic into `seedBucketForStudent` + `seedExtras` helpers to keep `runDemoSeed` readable; consolidated the META() helper so every create call has identical metadata shape; defensive checks for missing Programme/Batch/AcademicYear throw `AppError(400, ...)` so an operator pointing the script at an uninitialized college gets a clear failure rather than a bucket-loop crash.

## Violations

None. All edits respect:
- `AppError(statusCode, message)` (statusCode first — 400/404 used throughout).
- Multi-tenancy (`collegeId` on every write; filters cast via `new Types.ObjectId`).
- TypeScript strict — zero `any`, zero type-coercion casts (`String(doc._id)` pattern where needed).
- No Express / BullMQ imports — pure DB script per spec.
- No real SMS/email/WhatsApp dispatch — FeeReminders are written with `deliveryStatus: 'delivered'` + `deliveredAt` so the dashboard renders them as historical.
- Uses existing `.create()` calls on the 9 Mongoose models — no raw BSON.
- Reuses the test's pre-seeded Programme/Batch/AcademicYear when present (`loadBaseline` reads `collegeId`-scoped rows; never re-creates).

## Distribution Counts Verified (from the passing distribution test)

| Field | Expected | Got |
|---|---:|---:|
| studentsCreated | 50 | 50 |
| defaulterRecordsCreated | 15 | 15 |
| stage_1 defaulters | 6 | 6 |
| stage_2 defaulters | 4 | 4 |
| stage_3 defaulters | 3 | 3 |
| stage_4 defaulters | 2 | 2 |
| FinePenalty (late_fee) | 4 | 4 |
| FinancialHold | 2 | 2 |
| FinancialHold (active) | 2 | 2 |
| FeeReminder | 31 | 31 |
| Concession | 3 | 3 |
| ScholarshipAllocation | 2 | 2 |
| Scholarship | > 0 | 2 |
| Invoice.status=paid | >= 20 | 20 |
| Invoice.status=partially_paid | 8 | 8 |
| Payment.status=failed | 2 | 2 |
| Payment.status=reversed | 1 | 1 |

## Commit Impact

Only net-new file. No model / middleware / queue changes. Safe to cherry-pick.

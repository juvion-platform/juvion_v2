import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  vi,
} from 'vitest';
import mongoose from 'mongoose';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

// Mock the BullMQ enqueue so pinYear (used indirectly in --commit) doesn't
// try to talk to Redis.
vi.mock('../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock-job' }),
}));

import { Student } from '../../models/people/Student';
import { FeeStructureInstance } from '../../models/finance/FeeStructureInstance';
import { College } from '../../models/College';
import { Batch } from '../../models/academic-structure/Batch';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { Programme } from '../../models/academic-structure/Programme';

import { runBackfill, parseBackfillArgs } from '../backfill-fee-pins';

/**
 * Task 16 — Backfill fee-pins script tests (6 scenarios per tasks.md AC).
 *
 * The tests drive the script via the exported `runBackfill` function —
 * NOT via spawning ts-node subprocesses — so we get direct access to
 * errors, the connection, and the CSV path.
 */

const oid = () => new mongoose.Types.ObjectId();

interface SeedPlan {
  collegeId: mongoose.Types.ObjectId;
  programmeId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  academicYearId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  validBatchId: mongoose.Types.ObjectId;
  missingBatchIdRef: mongoose.Types.ObjectId;
  fsiId: mongoose.Types.ObjectId;
}

/**
 * Seed 100 students for a college:
 *   - 80 resolve to a matching FSI (pinnable)
 *   - 15 have valid yearOfStudy but NO matching FSI (unpinnable)
 *   - 5 reference a non-existent Batch (unresolvable yearOfStudy)
 *
 * Returns the seed plan so assertions can pick through the results.
 */
async function seedMixedData(): Promise<SeedPlan> {
  const collegeId = oid();
  const programmeId = oid();
  const branchId = oid();
  const academicYearId = oid();
  const batchId = oid();
  const missingBatchIdRef = oid(); // never inserted → unresolvable
  const validBatchId = oid();
  const unpinnableProgrammeId = oid();

  await College.create({
    _id: collegeId,
    name: 'Test College',
    code: 'TC' + String(Date.now()).slice(-5),
    address: { line1: 'x', city: 'y', state: 'z', pincode: '500001' },
    contactEmail: 'a@b.c',
    contactPhone: '9999999999',
  });

  // Programme (durationYears = 4)
  const regulationId = oid();
  await Programme.create({
    _id: programmeId,
    collegeId,
    code: 'BTCSE',
    name: 'BTech CSE',
    level: 'UG',
    durationYears: 4,
    regulationId,
  });
  await Programme.create({
    _id: unpinnableProgrammeId,
    collegeId,
    code: 'BTECE',
    name: 'BTech ECE',
    level: 'UG',
    durationYears: 4,
    regulationId,
  });

  // AcademicYear: 2025-26 window so AY.startYear = 2025
  await AcademicYear.create({
    _id: academicYearId,
    collegeId,
    code: '2025-26',
    label: '2025-26',
    startDate: new Date('2025-06-01'),
    endDate: new Date('2026-05-31'),
    isCurrent: true,
  });

  // Batch (admissionYear = 2025 → students are Y1 in AY 2025-26)
  await Batch.create({
    _id: batchId,
    collegeId,
    code: 'B-BTCSE-2025',
    name: 'BTech CSE 2025',
    admissionYear: 2025,
    programmeId,
    regulationId,
  });
  await Batch.create({
    _id: validBatchId,
    collegeId,
    code: 'B-BTECE-2025',
    name: 'BTech ECE 2025',
    admissionYear: 2025,
    programmeId: unpinnableProgrammeId,
    regulationId,
  });

  // FSI that matches 80 students (programmeId, quota=convener, branch=branchId)
  const fsi = await FeeStructureInstance.create({
    collegeId,
    academicYearId,
    programmeId,
    branchId,
    quota: 'convener',
    status: 'active',
    totalAmount: 120000,
    approvedAt: new Date(),
  });

  // 80 pinnable students
  for (let i = 0; i < 80; i += 1) {
    await Student.create({
      collegeId,
      personId: oid(),
      admissionYear: 2025,
      programmeId,
      branchId,
      batchId,
      quota: 'convener',
      category: 'OC',
      rollNumber: `PIN-${i}`,
      status: 'active',
    });
  }

  // 15 unpinnable — different programme (no matching FSI), valid year-of-study
  for (let i = 0; i < 15; i += 1) {
    await Student.create({
      collegeId,
      personId: oid(),
      admissionYear: 2025,
      programmeId: unpinnableProgrammeId,
      branchId,
      batchId: validBatchId,
      quota: 'convener',
      category: 'OC',
      rollNumber: `UNP-${i}`,
      status: 'active',
    });
  }

  // 5 unresolvable — reference a missing Batch → resolveStudentYearOfStudy throws
  for (let i = 0; i < 5; i += 1) {
    await Student.create({
      collegeId,
      personId: oid(),
      admissionYear: 2025,
      programmeId,
      branchId,
      batchId: missingBatchIdRef,
      quota: 'convener',
      category: 'OC',
      rollNumber: `UNR-${i}`,
      status: 'active',
    });
  }

  return {
    collegeId,
    programmeId,
    branchId,
    academicYearId,
    batchId,
    validBatchId,
    missingBatchIdRef,
    fsiId: fsi._id as mongoose.Types.ObjectId,
  };
}

let tmpDir: string;

describe('backfill-fee-pins (T16)', () => {
  beforeAll(async () => {
    await setupMongo();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backfill-t16-'));
  }, 60_000);

  afterAll(async () => {
    await teardownMongo();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await clearCollections();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── parseBackfillArgs ──────────────────────────────────────────────
  describe('parseBackfillArgs', () => {
    it('defaults to dry-run when no mode flag is supplied', () => {
      const parsed = parseBackfillArgs(['--college-id=abc']);
      expect(parsed.mode).toBe('dry-run');
      expect(parsed.collegeId).toBe('abc');
    });

    it('accepts --commit', () => {
      const parsed = parseBackfillArgs(['--college-id=abc', '--commit']);
      expect(parsed.mode).toBe('commit');
    });

    it('accepts --rollback-pins-created-by with --since', () => {
      const parsed = parseBackfillArgs([
        '--college-id=abc',
        '--rollback-pins-created-by=system:backfill',
        '--since=2024-01-01T00:00:00Z',
      ]);
      expect(parsed.mode).toBe('rollback');
      expect(parsed.rollbackPinnedBy).toBe('system:backfill');
      expect(parsed.since).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('rejects mutually-exclusive mode combinations', () => {
      expect(() =>
        parseBackfillArgs(['--college-id=abc', '--dry-run', '--commit']),
      ).toThrow(/mutually exclusive/);
    });
  });

  // ── 1. Dry-run with mixed data ─────────────────────────────────────
  it('scenario 1: dry-run with mixed data — 100 rows, zero DB writes', async () => {
    const plan = await seedMixedData();
    const csvPath = path.join(tmpDir, 'dryrun.csv');

    const pinsBefore = await countActivePins(plan.collegeId);

    const result = await runBackfill({
      mode: 'dry-run',
      collegeId: String(plan.collegeId),
      csvPath,
    });

    const pinsAfter = await countActivePins(plan.collegeId);
    expect(pinsAfter).toBe(pinsBefore);
    expect(pinsAfter).toBe(0);

    expect(result.exitCode).toBe(0);
    expect(result.totals.total).toBe(100);
    expect(result.totals.wouldPin).toBe(80);
    expect(result.totals.unpinnable).toBe(15);
    expect(result.totals.unresolvable).toBe(5);
    expect(result.totals.pinned).toBe(0);

    const body = fs.readFileSync(csvPath, 'utf-8');
    const lines = body.trim().split(/\n/);
    // header + 100 rows + summary comment line
    expect(lines[0]).toMatch(/^studentId,rollNumber,programmeId,yearOfStudy,status,detail/);
    // summary line begins with #
    expect(lines[lines.length - 1]!.startsWith('#')).toBe(true);
    // 100 data rows between header and summary
    expect(lines.length).toBe(102);
    expect(body).toContain('would-pin');
    expect(body).toContain('unpinnable');
    expect(body).toContain('unresolvable');
  }, 30_000);

  // ── 2. --commit with same data ─────────────────────────────────────
  it('scenario 2: --commit creates 80 pins; 20 non-pinnable in CSV', async () => {
    const plan = await seedMixedData();
    const csvPath = path.join(tmpDir, 'commit.csv');

    const result = await runBackfill({
      mode: 'commit',
      collegeId: String(plan.collegeId),
      csvPath,
    });
    expect(result.exitCode).toBe(0);
    expect(result.totals.pinned).toBe(80);
    expect(result.totals.unpinnable).toBe(15);
    expect(result.totals.unresolvable).toBe(5);

    const pinsAfter = await countActivePins(plan.collegeId);
    expect(pinsAfter).toBe(80);

    const body = fs.readFileSync(csvPath, 'utf-8');
    expect(body).toContain('pinned');
  }, 30_000);

  // ── 3. --commit re-run is idempotent ──────────────────────────────
  it('scenario 3: re-running --commit is idempotent — no new pins', async () => {
    const plan = await seedMixedData();
    const csvPath1 = path.join(tmpDir, 'commit1.csv');
    const csvPath2 = path.join(tmpDir, 'commit2.csv');

    await runBackfill({
      mode: 'commit',
      collegeId: String(plan.collegeId),
      csvPath: csvPath1,
    });
    const pinsAfterFirst = await countActivePins(plan.collegeId);
    expect(pinsAfterFirst).toBe(80);

    const result2 = await runBackfill({
      mode: 'commit',
      collegeId: String(plan.collegeId),
      csvPath: csvPath2,
    });
    expect(result2.totals.pinned).toBe(0);
    expect(result2.totals.alreadyPinned).toBe(80);

    const pinsAfterSecond = await countActivePins(plan.collegeId);
    expect(pinsAfterSecond).toBe(80);

    const body2 = fs.readFileSync(csvPath2, 'utf-8');
    expect(body2).toContain('already-pinned');
  }, 45_000);

  // ── 4. --rollback archives exactly the backfill-created pins ──────
  it('scenario 4: --rollback archives matching pins and leaves others alone', async () => {
    const plan = await seedMixedData();

    // First commit a backfill
    await runBackfill({
      mode: 'commit',
      collegeId: String(plan.collegeId),
      csvPath: path.join(tmpDir, 'rollback-commit.csv'),
    });
    expect(await countActivePins(plan.collegeId)).toBe(80);

    // Inject a non-backfill pin onto one of the 80 pinned students to
    // assert the rollback does NOT touch it.
    const victim = await Student.findOne({ collegeId: plan.collegeId, rollNumber: 'PIN-0' });
    expect(victim).toBeTruthy();
    victim!.feePins.push({
      yearOfStudy: 2,
      feeStructureInstanceId: plan.fsiId,
      pinnedAt: new Date(),
      pinnedBy: 'system:admission', // different label
      reason: 'initial',
      archivedAt: null,
    } as never);
    await victim!.save();

    const since = new Date(Date.now() - 60_000); // 1 min ago — covers the commit

    const rollbackCsv = path.join(tmpDir, 'rollback.csv');
    const result = await runBackfill({
      mode: 'rollback',
      collegeId: String(plan.collegeId),
      rollbackPinnedBy: 'system:backfill',
      since,
      csvPath: rollbackCsv,
    });

    expect(result.exitCode).toBe(0);
    expect(result.totals.archived).toBe(80);

    const activePinsAfter = await countActivePins(plan.collegeId);
    // All backfill pins archived; the admission-label pin on PIN-0 survives.
    expect(activePinsAfter).toBe(1);

    const reloaded = await Student.findById(victim!._id);
    const admissionPin = reloaded!.feePins.find(
      (p) => p.pinnedBy === 'system:admission',
    );
    expect(admissionPin).toBeTruthy();
    expect(admissionPin!.archivedAt).toBeFalsy();

    const body = fs.readFileSync(rollbackCsv, 'utf-8');
    expect(body).toContain('archived');
  }, 60_000);

  // ── 5. Missing --college-id exits 1 ───────────────────────────────
  it('scenario 5: missing --college-id → exitCode=1 with clear error', async () => {
    const csvPath = path.join(tmpDir, 'nocollege.csv');
    const result = await runBackfill({
      mode: 'dry-run',
      // @ts-expect-error deliberately omit collegeId
      collegeId: undefined,
      csvPath,
    });
    expect(result.exitCode).toBe(1);
    expect(result.error).toMatch(/college-id/i);
  });

  // ── 6. Unreadable CSV path fails before any DB write ──────────────
  it('scenario 6: unwritable CSV path → exitCode=1 before any DB write', async () => {
    const plan = await seedMixedData();
    // A path under a non-existent sub-directory that we never create
    const csvPath = path.join(tmpDir, 'no', 'such', 'dir', 'out.csv');

    const pinsBefore = await countActivePins(plan.collegeId);
    const result = await runBackfill({
      mode: 'commit',
      collegeId: String(plan.collegeId),
      csvPath,
    });
    expect(result.exitCode).toBe(1);
    expect(result.error).toMatch(/csv/i);

    const pinsAfter = await countActivePins(plan.collegeId);
    expect(pinsAfter).toBe(pinsBefore);
  });
});

/** Count pins that are active (archivedAt == null) across all students in the given college. */
async function countActivePins(
  collegeId: mongoose.Types.ObjectId | string,
): Promise<number> {
  const students = await Student.find({ collegeId });
  let n = 0;
  for (const s of students) {
    n += s.feePins.filter((p) => !p.archivedAt).length;
  }
  return n;
}

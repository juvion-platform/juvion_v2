/**
 * Task 7 — Demo seed script (fee-collection-analytics-and-alerts) tests.
 *
 * Safety-critical. Every test below drives the script through `runDemoSeed()`
 * or `parseDemoSeedArgs()` — NEVER through a child process — so we directly
 * observe exit codes, error strings, CSV paths, and DB writes.
 *
 * Spec: .captain/specs/fee-collection-analytics-and-alerts/tasks.md §Task 7
 * Plan: .captain/specs/fee-collection-analytics-and-alerts/plan.md §1.7, §2.3
 *
 * Mirrors the `backfill-fee-pins` safety-flag pattern: dry-run default,
 * strict college-name confirmation, tag-only purge. Tests supply `csvPath`
 * explicitly to keep `os.tmpdir()` clean in CI.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
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

import { College } from '../../models/College';
import { Programme } from '../../models/academic-structure/Programme';
import { Batch } from '../../models/academic-structure/Batch';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { Student } from '../../models/people/Student';
import { Invoice } from '../../models/finance/Invoice';
import { Payment } from '../../models/finance/Payment';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { FeeReminder } from '../../models/finance/FeeReminder';
import { FinancialHold } from '../../models/finance/FinancialHold';
import { FinePenalty } from '../../models/finance/FinePenalty';
import { Concession } from '../../models/finance/Concession';
import { ScholarshipAllocation } from '../../models/finance/ScholarshipAllocation';
import { Scholarship } from '../../models/finance/Scholarship';

import {
  runDemoSeed,
  parseDemoSeedArgs,
  DEMO_SEED_METADATA_TAG,
} from '../seed-fee-demo-data';

const oid = () => new mongoose.Types.ObjectId();

const DEMO_COLLEGE_NAME = 'Demo Engineering College';

/**
 * Stand up a college + 3 programmes + 2 batches each + a current academic
 * year. The seed script itself reads these to distribute students.
 */
async function seedBaseline(): Promise<{
  collegeId: mongoose.Types.ObjectId;
  otherCollegeId: mongoose.Types.ObjectId;
}> {
  const collegeId = oid();
  const otherCollegeId = oid();
  await College.create({
    _id: collegeId,
    name: DEMO_COLLEGE_NAME,
    code: 'DEMO' + String(Date.now()).slice(-5),
    address: { line1: 'x', city: 'y', state: 'z', pincode: '500001' },
    contactEmail: 'demo@demo.edu',
    contactPhone: '9999999999',
  });
  await College.create({
    _id: otherCollegeId,
    name: 'Real College',
    code: 'REAL' + String(Date.now()).slice(-5),
    address: { line1: 'x', city: 'y', state: 'z', pincode: '500001' },
    contactEmail: 'real@real.edu',
    contactPhone: '9999999999',
  });

  const ay = await AcademicYear.create({
    collegeId,
    code: '2025-26',
    label: '2025-26',
    startDate: new Date('2025-06-01'),
    endDate: new Date('2026-05-31'),
    isCurrent: true,
    status: 'active',
  });

  const programmes = [
    { code: 'BTCSE', name: 'BTech CSE', level: 'UG', durationYears: 4 },
    { code: 'BTECE', name: 'BTech ECE', level: 'UG', durationYears: 4 },
    { code: 'MBA', name: 'MBA', level: 'PG', durationYears: 2 },
  ] as const;

  for (const p of programmes) {
    const regulationId = oid();
    const prog = await Programme.create({
      collegeId,
      code: p.code,
      name: p.name,
      level: p.level,
      durationYears: p.durationYears,
      regulationId,
    });
    // 2 batches per programme
    for (const yr of [2023, 2024]) {
      await Batch.create({
        collegeId,
        code: `${p.code}-${yr}`,
        name: `${p.name} ${yr}`,
        admissionYear: yr,
        programmeId: prog._id,
        regulationId,
      });
    }
  }

  // Smoke: confirm baseline is what we expect for deterministic counts.
  const batchCount = await Batch.countDocuments({ collegeId });
  expect(batchCount).toBe(6);
  expect(ay).toBeTruthy();

  return { collegeId, otherCollegeId };
}

/** CSV path factory rooted in a per-suite tmp dir so CI never accumulates files. */
let tmpDir: string;
function csv(name: string): string {
  return path.join(tmpDir, name);
}

describe('seed-fee-demo-data (T7 — demo seed script)', () => {
  beforeAll(async () => {
    await setupMongo();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-seed-t7-'));
  }, 60_000);

  afterAll(async () => {
    await teardownMongo();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await clearCollections();
  });

  // ── parseDemoSeedArgs ─────────────────────────────────────────────────
  describe('parseDemoSeedArgs', () => {
    it('parses --college-id + --confirm-college-name + flags', () => {
      const parsed = parseDemoSeedArgs([
        '--college-id=abc123',
        '--confirm-college-name=Demo Engineering College',
        '--clear-first',
        '--dry-run',
      ]);
      expect(parsed.collegeId).toBe('abc123');
      expect(parsed.confirmCollegeName).toBe('Demo Engineering College');
      expect(parsed.clearFirst).toBe(true);
      expect(parsed.dryRun).toBe(true);
    });

    it('quoted name with equals in value preserved verbatim', () => {
      const parsed = parseDemoSeedArgs([
        '--college-id=x',
        '--confirm-college-name=A=B College',
      ]);
      expect(parsed.confirmCollegeName).toBe('A=B College');
    });

    it('defaults clearFirst/dryRun to false when flags absent', () => {
      const parsed = parseDemoSeedArgs([
        '--college-id=x',
        '--confirm-college-name=X',
      ]);
      expect(parsed.clearFirst).toBe(false);
      expect(parsed.dryRun).toBe(false);
    });
  });

  // ── Safety: missing --college-id ──────────────────────────────────────
  it('safety 1: missing collegeId → summary with zero writes + error', async () => {
    const before = await Student.countDocuments({});
    await expect(
      runDemoSeed({
        // @ts-expect-error intentional
        collegeId: undefined,
        confirmCollegeName: DEMO_COLLEGE_NAME,
        csvPath: csv('no-college.csv'),
      }),
    ).rejects.toThrow(/college-id/i);
    const after = await Student.countDocuments({});
    expect(after).toBe(before);
  });

  // ── Safety: missing --confirm-college-name ────────────────────────────
  it('safety 2: missing confirmCollegeName → throws, zero writes (even with --dry-run)', async () => {
    const { collegeId } = await seedBaseline();
    const before = await Student.countDocuments({ collegeId });
    await expect(
      runDemoSeed({
        collegeId: String(collegeId),
        // @ts-expect-error intentional
        confirmCollegeName: undefined,
        dryRun: true,
        csvPath: csv('no-confirm.csv'),
      }),
    ).rejects.toThrow(/confirm-college-name/i);
    const after = await Student.countDocuments({ collegeId });
    expect(after).toBe(before);
  });

  // ── Safety: college not found ─────────────────────────────────────────
  it('safety 3: non-existent college → throws, zero writes', async () => {
    const fakeId = oid();
    const before = await Student.countDocuments({});
    await expect(
      runDemoSeed({
        collegeId: String(fakeId),
        confirmCollegeName: DEMO_COLLEGE_NAME,
        csvPath: csv('no-exist.csv'),
      }),
    ).rejects.toThrow(/not found/i);
    const after = await Student.countDocuments({});
    expect(after).toBe(before);
  });

  // ── Safety: college-name mismatch ─────────────────────────────────────
  it('safety 4: confirmCollegeName mismatch → throws with clear message, zero writes', async () => {
    const { collegeId } = await seedBaseline();
    const before = await Student.countDocuments({ collegeId });
    await expect(
      runDemoSeed({
        collegeId: String(collegeId),
        confirmCollegeName: 'Wrong Name',
        csvPath: csv('mismatch.csv'),
      }),
    ).rejects.toThrow(/College name mismatch/);
    const after = await Student.countDocuments({ collegeId });
    expect(after).toBe(before);
  });

  // ── Happy path: --dry-run writes CSV without DB writes ────────────────
  it('dry-run: match + dryRun → CSV produced, zero DB writes', async () => {
    const { collegeId } = await seedBaseline();
    const csvPath = csv('dryrun.csv');
    const studentsBefore = await Student.countDocuments({ collegeId });
    const invoicesBefore = await Invoice.countDocuments({ collegeId });

    const summary = await runDemoSeed({
      collegeId: String(collegeId),
      confirmCollegeName: DEMO_COLLEGE_NAME,
      dryRun: true,
      csvPath,
    });

    expect(summary.dryRun).toBe(true);
    expect(summary.metadataTag).toBe(DEMO_SEED_METADATA_TAG);
    expect(summary.studentsCreated).toBe(50);
    expect(summary.csvPath).toBe(csvPath);
    expect(fs.existsSync(csvPath)).toBe(true);

    const studentsAfter = await Student.countDocuments({ collegeId });
    const invoicesAfter = await Invoice.countDocuments({ collegeId });
    expect(studentsAfter).toBe(studentsBefore);
    expect(invoicesAfter).toBe(invoicesBefore);

    const body = fs.readFileSync(csvPath, 'utf-8');
    const lines = body.trim().split(/\n/);
    // header + 50 student rows + at least one summary line (starts with `#`)
    expect(lines[0]).toMatch(/rollNumber,name,programme,status,invoiceAmount,paidAmount,escalationStage/);
    expect(lines[lines.length - 1]!.startsWith('#')).toBe(true);
  }, 60_000);

  // ── Happy path: committed seed writes 50 tagged students ──────────────
  it('commit: match + commit → 50 students with metadata.source tag', async () => {
    const { collegeId } = await seedBaseline();
    const csvPath = csv('commit.csv');

    const summary = await runDemoSeed({
      collegeId: String(collegeId),
      confirmCollegeName: DEMO_COLLEGE_NAME,
      csvPath,
    });

    expect(summary.dryRun).toBe(false);
    expect(summary.studentsCreated).toBe(50);

    // All seeded students live under our college.
    const students = await Student.find({ collegeId });
    expect(students.length).toBe(50);

    // Entities across the eight tagged models share the source tag.
    const taggedInvoices = await Invoice.countDocuments({
      collegeId,
      'metadata.source': DEMO_SEED_METADATA_TAG,
    });
    const totalInvoices = await Invoice.countDocuments({ collegeId });
    expect(taggedInvoices).toBe(totalInvoices);
    expect(taggedInvoices).toBeGreaterThan(0);

    const taggedPayments = await Payment.countDocuments({
      collegeId,
      'metadata.source': DEMO_SEED_METADATA_TAG,
    });
    expect(taggedPayments).toBeGreaterThan(0);
    expect(taggedPayments).toBe(summary.paymentsCreated);

    // Every defaulter record carries the tag.
    const defaulters = await DefaulterRecord.find({ collegeId });
    expect(defaulters.length).toBe(summary.defaulterRecordsCreated);
    for (const d of defaulters) {
      expect(d.metadata?.source).toBe(DEMO_SEED_METADATA_TAG);
    }
  }, 60_000);

  // ── Safety: --clear-first only deletes tagged entities ────────────────
  it('clear-first: untagged entities survive; only demo-seed-v1 rows are purged', async () => {
    const { collegeId } = await seedBaseline();

    // Inject an UNTAGGED Invoice that belongs to the same college. This
    // simulates a real production invoice the script MUST NOT touch.
    const survivor = await Invoice.create({
      collegeId,
      invoiceNumber: 'SURVIVOR-001',
      studentId: oid(),
      type: 'fee',
      totalAmount: 10000,
      dueDate: new Date(),
      status: 'generated',
      issuedDate: new Date(),
      items: [{ description: 'Tuition', amount: 10000 }],
      // deliberately NO metadata.source
    });

    // First full commit seeds tagged data.
    await runDemoSeed({
      collegeId: String(collegeId),
      confirmCollegeName: DEMO_COLLEGE_NAME,
      csvPath: csv('first-commit.csv'),
    });
    const taggedBefore = await Invoice.countDocuments({
      collegeId,
      'metadata.source': DEMO_SEED_METADATA_TAG,
    });
    expect(taggedBefore).toBeGreaterThan(0);

    // Second run with --clear-first should purge ONLY tagged rows then re-seed.
    const summary = await runDemoSeed({
      collegeId: String(collegeId),
      confirmCollegeName: DEMO_COLLEGE_NAME,
      clearFirst: true,
      csvPath: csv('clear-first.csv'),
    });
    expect(summary.studentsCreated).toBe(50);

    // Untagged survivor invoice MUST still exist.
    const stillThere = await Invoice.findById(survivor._id);
    expect(stillThere).toBeTruthy();
    expect(stillThere!.invoiceNumber).toBe('SURVIVOR-001');
    expect(stillThere!.metadata?.source).toBeUndefined();

    // Tagged entity count should match the single fresh seed (not doubled).
    const taggedAfter = await Invoice.countDocuments({
      collegeId,
      'metadata.source': DEMO_SEED_METADATA_TAG,
    });
    expect(taggedAfter).toBe(summary.invoicesCreated);
  }, 90_000);

  // ── Idempotent re-run without --clear-first ───────────────────────────
  it('idempotent: re-run without --clear-first skips (no duplicates)', async () => {
    const { collegeId } = await seedBaseline();
    await runDemoSeed({
      collegeId: String(collegeId),
      confirmCollegeName: DEMO_COLLEGE_NAME,
      csvPath: csv('idem1.csv'),
    });
    const studentsAfterFirst = await Student.countDocuments({ collegeId });
    const invoicesAfterFirst = await Invoice.countDocuments({ collegeId });
    expect(studentsAfterFirst).toBe(50);

    const second = await runDemoSeed({
      collegeId: String(collegeId),
      confirmCollegeName: DEMO_COLLEGE_NAME,
      csvPath: csv('idem2.csv'),
    });
    // Summary for the no-op run should report zero new writes.
    expect(second.studentsCreated).toBe(0);
    expect(second.invoicesCreated).toBe(0);
    expect(second.paymentsCreated).toBe(0);

    // Collection totals unchanged.
    expect(await Student.countDocuments({ collegeId })).toBe(studentsAfterFirst);
    expect(await Invoice.countDocuments({ collegeId })).toBe(invoicesAfterFirst);
  }, 90_000);

  // ── Distribution accuracy vs §AC-Demo Seed table ──────────────────────
  it('distribution: 20 paid / 8 partial / 7 upcoming / 6 stage_1 / 4 stage_2 / 3 stage_3 / 2 stage_4', async () => {
    const { collegeId } = await seedBaseline();
    const summary = await runDemoSeed({
      collegeId: String(collegeId),
      confirmCollegeName: DEMO_COLLEGE_NAME,
      csvPath: csv('dist.csv'),
    });
    expect(summary.studentsCreated).toBe(50);

    // Defaulter records: 6 + 4 + 3 + 2 = 15
    expect(summary.defaulterRecordsCreated).toBe(15);
    expect(
      await DefaulterRecord.countDocuments({
        collegeId,
        escalationStage: 'stage_1',
      }),
    ).toBe(6);
    expect(
      await DefaulterRecord.countDocuments({
        collegeId,
        escalationStage: 'stage_2',
      }),
    ).toBe(4);
    expect(
      await DefaulterRecord.countDocuments({
        collegeId,
        escalationStage: 'stage_3',
      }),
    ).toBe(3);
    expect(
      await DefaulterRecord.countDocuments({
        collegeId,
        escalationStage: 'stage_4',
      }),
    ).toBe(2);

    // Stage_2 gets exactly 4 late-fee FinePenalty rows.
    const lateFees = await FinePenalty.countDocuments({
      collegeId,
      type: 'late_fee',
    });
    expect(lateFees).toBe(4);

    // Stage_4 gets exactly 2 FinancialHold records, all active (Principal approved per spec).
    const holds = await FinancialHold.countDocuments({ collegeId });
    expect(holds).toBe(2);
    const activeHolds = await FinancialHold.countDocuments({
      collegeId,
      holdStatus: 'active',
    });
    expect(activeHolds).toBe(2);

    // Reminders: 1 × 6 + 2 × 4 + 3 × 3 + 4 × 2 = 31
    const reminders = await FeeReminder.countDocuments({ collegeId });
    expect(reminders).toBe(31);
    expect(summary.remindersCreated).toBe(31);

    // Concessions: 3 random students.
    expect(await Concession.countDocuments({ collegeId })).toBe(3);
    expect(summary.concessionsCreated).toBe(3);

    // ScholarshipAllocations: 2 random students.
    expect(await ScholarshipAllocation.countDocuments({ collegeId })).toBe(2);
    expect(summary.scholarshipsCreated).toBe(2);

    // Backing Scholarship docs should exist so allocations have something to reference.
    expect(await Scholarship.countDocuments({ collegeId })).toBeGreaterThan(0);

    // Paid-in-full: 20 students, matching successful Payment records, all
    // invoices status='paid'.
    const paidInvoices = await Invoice.countDocuments({ collegeId, status: 'paid' });
    expect(paidInvoices).toBeGreaterThanOrEqual(20);

    // Partial: at least 8 invoices in partially_paid.
    const partialInvoices = await Invoice.countDocuments({
      collegeId,
      status: 'partially_paid',
    });
    expect(partialInvoices).toBe(8);

    // Plus: 2 failed + 1 reversed payment spread across the last 90 days.
    expect(await Payment.countDocuments({ collegeId, status: 'failed' })).toBe(2);
    expect(await Payment.countDocuments({ collegeId, status: 'reversed' })).toBe(1);
  }, 90_000);

  // ── Cross-college isolation ────────────────────────────────────────────
  it('isolation: seeding one college never touches another', async () => {
    const { collegeId, otherCollegeId } = await seedBaseline();
    const before = await Invoice.countDocuments({ collegeId: otherCollegeId });
    await runDemoSeed({
      collegeId: String(collegeId),
      confirmCollegeName: DEMO_COLLEGE_NAME,
      csvPath: csv('isolation.csv'),
    });
    const after = await Invoice.countDocuments({ collegeId: otherCollegeId });
    expect(after).toBe(before);
    expect(after).toBe(0);
  }, 60_000);
});

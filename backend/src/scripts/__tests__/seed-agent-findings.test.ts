/**
 * Tests for `seed-agent-findings.ts` — the dev-only fixture script that
 * populates trigger data for the situation-candidates heuristics so the
 * dashboard's "Agent findings" section renders cards.
 *
 * Safety surface:
 *   - --college-id required
 *   - --confirm-college-name required (strict equality vs College.name)
 *   - --clear-first purges ONLY metadata.source='agent-findings-v1'
 *
 * Distribution surface:
 *   - 4 partial-paid invoices (dueDate ~20d ago)
 *   - 5 concessions in the last 5d
 *   - 4 pending_approval holds (~3d old)
 *   - 3 welfare defaulters (~10d old)
 *   - 5 stage4 holds today
 *   - 4 waived holds with short reason (~5d old)
 *
 * Idempotency:
 *   - Re-run without --clear-first short-circuits when > 10 tagged
 *     FinancialHolds already exist
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

import { College } from '../../models/College';
import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { Invoice } from '../../models/finance/Invoice';
import { Concession } from '../../models/finance/Concession';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { FinancialHold } from '../../models/finance/FinancialHold';

import { seedAgentFindings } from '../seed-agent-findings';

const TAG = 'agent-findings-v1';

// ── Fixture ────────────────────────────────────────────────────────────

const COLLEGE_ID = new mongoose.Types.ObjectId('000000000000000000000a01');
const COLLEGE_NAME = 'Test College';

/**
 * Seed the prerequisite cohort of students that the script needs (>= 26).
 * The script picks active students by `Student.find({ collegeId, status:
 * 'active' })` and assigns fixtures to them in chunks.
 */
async function seedActiveStudents(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const person = await Person.create({
      collegeId: COLLEGE_ID,
      name: `Test Student ${i}`,
      phone: `9${String(i).padStart(9, '0')}`,
    });
    await Student.create({
      collegeId: COLLEGE_ID,
      personId: person._id,
      rollNumber: `TS-${String(i).padStart(3, '0')}`,
      status: 'active',
      admissionYear: 2024,
    });
  }
}

beforeAll(async () => {
  await setupMongo();
});

afterAll(async () => {
  await teardownMongo();
});

beforeEach(async () => {
  await clearCollections();
  await College.create({
    _id: COLLEGE_ID,
    name: COLLEGE_NAME,
    code: 'TST',
    status: 'active',
    contactEmail: 'test@college.dev',
    contactPhone: '+91-9000000000',
    address: {
      line1: '1 Test Road',
      city: 'Test City',
      state: 'Test State',
      pincode: '500001',
    },
  });
});

// ── Safety gates ───────────────────────────────────────────────────────

describe('seedAgentFindings — safety gates', () => {
  it('throws when --college-id is missing', async () => {
    await expect(
      seedAgentFindings({ collegeId: '', confirmCollegeName: COLLEGE_NAME }),
    ).rejects.toThrow(/college-id/);
  });

  it('throws when --confirm-college-name is missing', async () => {
    await expect(
      seedAgentFindings({ collegeId: String(COLLEGE_ID), confirmCollegeName: '' }),
    ).rejects.toThrow(/confirm-college-name/);
  });

  it('throws when the college does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toHexString();
    await expect(
      seedAgentFindings({ collegeId: fakeId, confirmCollegeName: COLLEGE_NAME }),
    ).rejects.toThrow(/College not found/);
  });

  it('throws + writes nothing when confirmCollegeName mismatches', async () => {
    await seedActiveStudents(26);

    await expect(
      seedAgentFindings({
        collegeId: String(COLLEGE_ID),
        confirmCollegeName: 'Wrong Name',
      }),
    ).rejects.toThrow(/College name mismatch/);

    // Nothing should have been written
    const tagged = await FinancialHold.countDocuments({ 'metadata.source': TAG });
    expect(tagged).toBe(0);
  });

  it('throws when there are not enough active students for the fixture spread', async () => {
    await seedActiveStudents(8);
    await expect(
      seedAgentFindings({ collegeId: String(COLLEGE_ID), confirmCollegeName: COLLEGE_NAME }),
    ).rejects.toThrow(/Not enough active students/);
  });
});

// ── Distribution ───────────────────────────────────────────────────────

describe('seedAgentFindings — fixture distribution', () => {
  beforeEach(async () => {
    await seedActiveStudents(30);
  });

  it('produces the expected counts across all 6 trigger groups', async () => {
    const summary = await seedAgentFindings({
      collegeId: String(COLLEGE_ID),
      confirmCollegeName: COLLEGE_NAME,
    });

    expect(summary).toMatchObject({
      partialInvoices: 4,
      concessions: 5,
      pendingHolds: 4,
      welfareDefaulters: 3,
      stage4HoldsToday: 5,
      waivedShortReason: 4,
    });
  });

  it('every created entity is tagged with metadata.source = agent-findings-v1', async () => {
    await seedAgentFindings({
      collegeId: String(COLLEGE_ID),
      confirmCollegeName: COLLEGE_NAME,
    });

    const [taggedInvoices, taggedConcessions, taggedDefaulters, taggedHolds] =
      await Promise.all([
        Invoice.countDocuments({ 'metadata.source': TAG }),
        Concession.countDocuments({ 'metadata.source': TAG }),
        DefaulterRecord.countDocuments({ 'metadata.source': TAG }),
        FinancialHold.countDocuments({ 'metadata.source': TAG }),
      ]);

    // The script seeds invoices for partial-stale (4) + pendingHolds (4) +
    // welfare (3) + stage4 (5) + waived (4) = 20 invoices. Concessions
    // alone = 5. DefaulterRecords for pendingHolds + welfare + stage4 +
    // waived = 16. FinancialHolds for pendingHolds + stage4 + waived = 13.
    expect(taggedInvoices).toBe(20);
    expect(taggedConcessions).toBe(5);
    expect(taggedDefaulters).toBe(16);
    expect(taggedHolds).toBe(13);
  });

  it('produces 5 stage4 holds with createdAt >= startOfToday', async () => {
    await seedAgentFindings({
      collegeId: String(COLLEGE_ID),
      confirmCollegeName: COLLEGE_NAME,
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const stage4Today = await FinancialHold.countDocuments({
      'metadata.source': TAG,
      holdType: 'exam_debarment',
      holdStatus: 'pending_approval',
      createdAt: { $gte: startOfToday },
    });
    expect(stage4Today).toBeGreaterThanOrEqual(5);
  });

  it('produces waived holds with short releaseReason (< 10 chars)', async () => {
    await seedAgentFindings({
      collegeId: String(COLLEGE_ID),
      confirmCollegeName: COLLEGE_NAME,
    });

    const shortReason = await FinancialHold.find({
      'metadata.source': TAG,
      holdStatus: 'released',
    }).select('releaseReason').lean();

    expect(shortReason.length).toBe(4);
    for (const h of shortReason) {
      expect(h.releaseReason).toBeDefined();
      expect((h.releaseReason as string).length).toBeLessThan(10);
    }
  });
});

// ── Idempotency + clear-first ──────────────────────────────────────────

describe('seedAgentFindings — idempotency', () => {
  beforeEach(async () => {
    await seedActiveStudents(30);
  });

  it('re-run without --clear-first short-circuits (no new writes)', async () => {
    // First run
    await seedAgentFindings({
      collegeId: String(COLLEGE_ID),
      confirmCollegeName: COLLEGE_NAME,
    });
    const firstHolds = await FinancialHold.countDocuments({ 'metadata.source': TAG });

    // Second run without --clear-first should skip
    const summary = await seedAgentFindings({
      collegeId: String(COLLEGE_ID),
      confirmCollegeName: COLLEGE_NAME,
    });

    const secondHolds = await FinancialHold.countDocuments({ 'metadata.source': TAG });
    expect(secondHolds).toBe(firstHolds);
    // All counts should be 0 (skip path returns the zero-init summary)
    expect(summary.partialInvoices).toBe(0);
    expect(summary.pendingHolds).toBe(0);
  });

  it('--clear-first purges ONLY tagged entities (untagged data survives)', async () => {
    // Seed once
    await seedAgentFindings({
      collegeId: String(COLLEGE_ID),
      confirmCollegeName: COLLEGE_NAME,
    });

    // Add an UNTAGGED Invoice that should survive --clear-first
    await Invoice.create({
      collegeId: COLLEGE_ID,
      studentId: new mongoose.Types.ObjectId(),
      invoiceNumber: 'SURVIVOR-1',
      type: 'fee',
      items: [{ description: 'Survivor', amount: 1000 }],
      issuedDate: new Date(),
      dueDate: new Date(),
      totalAmount: 1000,
      status: 'sent',
      // NO metadata.source tag
    });

    // Re-run with --clear-first
    const summary = await seedAgentFindings({
      collegeId: String(COLLEGE_ID),
      confirmCollegeName: COLLEGE_NAME,
      clearFirst: true,
    });

    // Survivor still in DB
    const survivor = await Invoice.findOne({ invoiceNumber: 'SURVIVOR-1' });
    expect(survivor).not.toBeNull();

    // Tagged entities were purged (cleared.* > 0) and re-seeded
    expect(summary.cleared).toBeDefined();
    expect((summary.cleared!.invoices ?? 0) + (summary.cleared!.holds ?? 0)).toBeGreaterThan(0);
    expect(summary.partialInvoices).toBe(4);  // re-seed succeeded
    expect(summary.pendingHolds).toBe(4);
  });

  it('--clear-first does not touch entities from a different college', async () => {
    // Tagged entity in OTHER college
    const otherCollegeId = new mongoose.Types.ObjectId('000000000000000000000a02');
    await Invoice.create({
      collegeId: otherCollegeId,
      studentId: new mongoose.Types.ObjectId(),
      invoiceNumber: 'OTHER-COLLEGE-1',
      type: 'fee',
      items: [{ description: 'Other', amount: 500 }],
      issuedDate: new Date(),
      dueDate: new Date(),
      totalAmount: 500,
      status: 'sent',
      metadata: { source: TAG },  // tagged but in different college
    });

    await seedAgentFindings({
      collegeId: String(COLLEGE_ID),
      confirmCollegeName: COLLEGE_NAME,
      clearFirst: true,
    });

    // OTHER college's tagged Invoice still survives
    const otherSurvivor = await Invoice.findOne({ invoiceNumber: 'OTHER-COLLEGE-1' });
    expect(otherSurvivor).not.toBeNull();
  });
});

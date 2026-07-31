import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

import { Invoice } from '../../../models/finance/Invoice';
import { StudentFeeAccount } from '../../../models/finance/StudentFeeAccount';
import { Payment } from '../../../models/finance/Payment';
import { DefaulterRecord } from '../../../models/finance/DefaulterRecord';
import { Student } from '../../../models/people/Student';
import { Person } from '../../../models/people/Person';
import { Programme } from '../../../models/academic-structure/Programme';

import * as svc from '../fee-analytics-service';

/**
 * Task 3 — fee-analytics-service tests (fee-collection-analytics-and-alerts).
 *
 * Exercises the 6 parallel dashboard aggregations + defaulter listing, plus:
 * - HOD scope (programme filter)
 * - Date-range filtering
 * - Payment-mode bucketing incl. 'other' fallback
 * - Multi-tenant isolation
 * - Paginated + sorted defaulter list
 * - Perf smoke (1000 students seeded fixture) — latency assertion ≤ 2s
 *   for CI tolerance (target p95 < 800ms on real infra).
 */

const oid = () => new mongoose.Types.ObjectId();

interface SeedStudentOpts {
  collegeId: mongoose.Types.ObjectId;
  programmeId: mongoose.Types.ObjectId;
  rollNumber?: string;
  name?: string;
  status?: string;
}

async function seedStudent(opts: SeedStudentOpts) {
  const person = await Person.create({
    collegeId: opts.collegeId,
    phone: `+91${Math.floor(9000000000 + Math.random() * 999999999)}`,
    name: opts.name ?? `Student-${opts.rollNumber ?? 'X'}`,
  });
  return Student.create({
    collegeId: opts.collegeId,
    personId: person._id,
    admissionYear: 2024,
    programmeId: opts.programmeId,
    rollNumber: opts.rollNumber ?? `R${Math.floor(Math.random() * 1_000_000)}`,
    status: opts.status ?? 'active',
  });
}

async function seedProgramme(collegeId: mongoose.Types.ObjectId, name = 'BTech CSE') {
  return Programme.create({
    collegeId,
    code: name.replace(/\s+/g, '_'),
    name,
    level: 'UG',
    durationYears: 4,
    regulationId: oid(),
  });
}

describe('fee-analytics-service', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  // ─── getDashboard ──────────────────────────────────────────────

  describe('getDashboard', () => {
    it('aggregates KPIs from a mixed fixture: paid + partial + overdue', async () => {
      const collegeId = oid();
      const programme = await seedProgramme(collegeId, 'CSE');
      const student = await seedStudent({
        collegeId,
        programmeId: programme._id as mongoose.Types.ObjectId,
        rollNumber: 'CSE001',
        name: 'Alice',
      });

      const now = new Date();
      const day = 24 * 60 * 60 * 1000;

      // Three invoices: 1 paid, 1 partial, 1 overdue. totalAmount sum = 30000.
      await Invoice.create([
        {
          collegeId,
          invoiceNumber: 'INV-1',
          studentId: student._id,
          type: 'fee',
          totalAmount: 10000,
          dueDate: new Date(now.getTime() - 10 * day),
          status: 'paid',
          issuedDate: new Date(now.getTime() - 20 * day),
          items: [],
        },
        {
          collegeId,
          invoiceNumber: 'INV-2',
          studentId: student._id,
          type: 'fee',
          totalAmount: 10000,
          dueDate: new Date(now.getTime() - 5 * day),
          status: 'partially_paid',
          issuedDate: new Date(now.getTime() - 20 * day),
          items: [],
        },
        {
          collegeId,
          invoiceNumber: 'INV-3',
          studentId: student._id,
          type: 'fee',
          totalAmount: 10000,
          dueDate: new Date(now.getTime() - 1 * day),
          status: 'generated',
          issuedDate: new Date(now.getTime() - 20 * day),
          items: [],
        },
      ]);

      await Payment.create([
        // Paid invoice fully cleared
        {
          collegeId,
          studentId: student._id,
          receiptNumber: 'R-1',
          amount: 10000,
          paymentMode: 'upi',
          status: 'success',
          paymentDate: new Date(now.getTime() - 9 * day),
          createdAt: new Date(now.getTime() - 9 * day),
        },
        // Partial
        {
          collegeId,
          studentId: student._id,
          receiptNumber: 'R-2',
          amount: 4000,
          paymentMode: 'cash',
          status: 'success',
          paymentDate: new Date(now.getTime() - 4 * day),
          createdAt: new Date(now.getTime() - 4 * day),
        },
        // A failed payment should NOT count toward collected
        {
          collegeId,
          studentId: student._id,
          receiptNumber: 'R-3',
          amount: 5000,
          paymentMode: 'cash',
          status: 'failed',
          paymentDate: new Date(now.getTime() - 3 * day),
          createdAt: new Date(now.getTime() - 3 * day),
        },
      ]);

      // Two defaulter records: one stage_2, one stage_3.
      await DefaulterRecord.create([
        {
          collegeId,
          studentId: student._id,
          invoiceId: oid(),
          overdueAmount: 6000,
          daysOverdue: 10,
          escalationStage: 'stage_2',
        },
        {
          collegeId,
          studentId: student._id,
          invoiceId: oid(),
          overdueAmount: 10000,
          daysOverdue: 20,
          escalationStage: 'stage_3',
        },
      ]);

      // 007 — AR is now net StudentFeeAccount.balance; owes 30000, paid 14000 → 16000.
      await StudentFeeAccount.create({
        collegeId, studentId: student._id, totalDue: 30000, totalPaid: 14000, balance: 16000,
      });

      const from = new Date(now.getTime() - 90 * day);
      const to = now;
      const result = await svc.getDashboard(
        String(collegeId),
        { from, to },
        { role: 'admin', collegeId: String(collegeId) },
      );

      // collectedInRange = 10000 + 4000 = 14000 (failed excluded)
      expect(result.collectedInRange).toBe(14000);
      // Outstanding = sum(totalAmount - amountPaidOnSuccessfulPayments) for non-paid invoices.
      // Simpler model: outstanding = sum of totalAmount on invoices whose status != 'paid' minus
      // successful payments for those students. Implementation may vary; assert ≥ 0 and a sensible range.
      expect(result.totalOutstanding).toBeGreaterThan(0);
      expect(result.collectionRatePercent).toBeGreaterThan(0);
      expect(result.collectionRatePercent).toBeLessThanOrEqual(100);
      expect(result.overdueStudentsCount).toBeGreaterThanOrEqual(1);
      expect(result.overdueAmount).toBeGreaterThan(0);
      expect(result.funnelByStage.stage_2).toBe(1);
      expect(result.funnelByStage.stage_3).toBe(1);
      expect(result.funnelByStage.stage_1).toBe(0);
      expect(result.funnelByStage.stage_4).toBe(0);
      expect(result.funnelByStage.welfare_referred).toBe(0);

      // paymentModeBreakdown: upi = 10000, cash = 4000 (failed excluded)
      expect(result.paymentModeBreakdown.upi).toBe(10000);
      expect(result.paymentModeBreakdown.cash).toBe(4000);

      // dueByProgramme includes CSE
      expect(Array.isArray(result.dueByProgramme)).toBe(true);
      const cse = result.dueByProgramme.find((p) => p.programmeName === 'CSE');
      expect(cse).toBeDefined();

      // collectionTimeSeries buckets are ISO date strings
      expect(result.collectionTimeSeries.length).toBeGreaterThanOrEqual(1);
      for (const b of result.collectionTimeSeries) {
        expect(b.bucket).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }

      // dueVsCollectedByMonth last 6 months → exactly 6 entries, formatted YYYY-MM
      expect(result.dueVsCollectedByMonth.length).toBe(6);
      for (const m of result.dueVsCollectedByMonth) {
        expect(m.month).toMatch(/^\d{4}-\d{2}$/);
      }
    });

    it('007: totalOutstanding is the NET sum of StudentFeeAccount.balance (partial reflected)', async () => {
      const collegeId = oid();
      const programme = await seedProgramme(collegeId, 'NET');
      const s1 = await seedStudent({ collegeId, programmeId: programme._id as mongoose.Types.ObjectId, rollNumber: 'N1', name: 'P1' });
      const s2 = await seedStudent({ collegeId, programmeId: programme._id as mongoose.Types.ObjectId, rollNumber: 'N2', name: 'P2' });
      await StudentFeeAccount.create([
        { collegeId, studentId: s1._id, totalDue: 45000, totalPaid: 20000, balance: 25000 }, // partially paid
        { collegeId, studentId: s2._id, totalDue: 45000, totalPaid: 45000, balance: 0 },      // fully paid
      ]);
      const now = new Date();
      const r = await svc.getDashboard(
        String(collegeId),
        { from: new Date(now.getTime() - 30 * 86_400_000), to: now },
        { role: 'admin', collegeId: String(collegeId) },
      );
      // Net, not gross: the partial payment is reflected (25000), not the full 45000 due.
      expect(r.totalOutstanding).toBe(25000);
      const net = r.dueByProgramme.find((p) => p.programmeName === 'NET');
      expect(net?.due).toBe(25000);
    });

    it('HOD scope: HOD of CSE does not see ECE funnel counts', async () => {
      const collegeId = oid();
      const cse = await seedProgramme(collegeId, 'CSE');
      const ece = await seedProgramme(collegeId, 'ECE');
      const cseStudent = await seedStudent({
        collegeId,
        programmeId: cse._id as mongoose.Types.ObjectId,
      });
      const eceStudent = await seedStudent({
        collegeId,
        programmeId: ece._id as mongoose.Types.ObjectId,
      });

      await DefaulterRecord.create([
        {
          collegeId,
          studentId: cseStudent._id,
          invoiceId: oid(),
          overdueAmount: 5000,
          daysOverdue: 10,
          escalationStage: 'stage_2',
        },
        {
          collegeId,
          studentId: cseStudent._id,
          invoiceId: oid(),
          overdueAmount: 5000,
          daysOverdue: 10,
          escalationStage: 'stage_2',
        },
        {
          collegeId,
          studentId: eceStudent._id,
          invoiceId: oid(),
          overdueAmount: 9000,
          daysOverdue: 25,
          escalationStage: 'stage_3',
        },
      ]);

      const now = new Date();
      const from = new Date(now.getTime() - 90 * 86_400_000);
      const to = now;

      const asHod = await svc.getDashboard(
        String(collegeId),
        { from, to },
        {
          role: 'hod',
          collegeId: String(collegeId),
          hodProgrammeIds: [String(cse._id)],
        },
      );
      expect(asHod.funnelByStage.stage_2).toBe(2);
      expect(asHod.funnelByStage.stage_3).toBe(0); // ECE record hidden

      const asAdmin = await svc.getDashboard(
        String(collegeId),
        { from, to },
        { role: 'admin', collegeId: String(collegeId) },
      );
      expect(asAdmin.funnelByStage.stage_2).toBe(2);
      expect(asAdmin.funnelByStage.stage_3).toBe(1);
    });

    it('date-range filter excludes payments outside [from, to] from timeseries', async () => {
      const collegeId = oid();
      const programme = await seedProgramme(collegeId);
      const student = await seedStudent({
        collegeId,
        programmeId: programme._id as mongoose.Types.ObjectId,
      });

      const day = 86_400_000;
      const now = new Date();
      // One payment inside the window (10 days ago), one outside (200 days ago)
      await Payment.create([
        {
          collegeId,
          studentId: student._id,
          receiptNumber: 'in-1',
          amount: 1500,
          paymentMode: 'upi',
          status: 'success',
          paymentDate: new Date(now.getTime() - 10 * day),
          createdAt: new Date(now.getTime() - 10 * day),
        },
        {
          collegeId,
          studentId: student._id,
          receiptNumber: 'out-1',
          amount: 9999,
          paymentMode: 'upi',
          status: 'success',
          paymentDate: new Date(now.getTime() - 200 * day),
          createdAt: new Date(now.getTime() - 200 * day),
        },
      ]);

      const from = new Date(now.getTime() - 90 * day);
      const to = now;
      const r = await svc.getDashboard(
        String(collegeId),
        { from, to },
        { role: 'admin', collegeId: String(collegeId) },
      );
      expect(r.collectedInRange).toBe(1500);
      // Timeseries should NOT include the 200-day-ago bucket
      const totalSeriesAmount = r.collectionTimeSeries.reduce((s, b) => s + b.amount, 0);
      expect(totalSeriesAmount).toBe(1500);
    });

    it('programme filter excludes non-matching programme data', async () => {
      const collegeId = oid();
      const cse = await seedProgramme(collegeId, 'CSE');
      const mba = await seedProgramme(collegeId, 'MBA');
      const cseStudent = await seedStudent({
        collegeId,
        programmeId: cse._id as mongoose.Types.ObjectId,
      });
      const mbaStudent = await seedStudent({
        collegeId,
        programmeId: mba._id as mongoose.Types.ObjectId,
      });

      await DefaulterRecord.create([
        {
          collegeId,
          studentId: cseStudent._id,
          invoiceId: oid(),
          overdueAmount: 1000,
          daysOverdue: 3,
          escalationStage: 'stage_1',
        },
        {
          collegeId,
          studentId: mbaStudent._id,
          invoiceId: oid(),
          overdueAmount: 1000,
          daysOverdue: 3,
          escalationStage: 'stage_1',
        },
      ]);

      const now = new Date();
      const r = await svc.getDashboard(
        String(collegeId),
        {
          from: new Date(now.getTime() - 30 * 86_400_000),
          to: now,
          programmeIds: [String(cse._id)],
        },
        { role: 'admin', collegeId: String(collegeId) },
      );
      expect(r.funnelByStage.stage_1).toBe(1); // only CSE
    });

    it('empty dataset → zeros everywhere, no crash', async () => {
      const collegeId = oid();
      const now = new Date();
      const r = await svc.getDashboard(
        String(collegeId),
        { from: new Date(now.getTime() - 30 * 86_400_000), to: now },
        { role: 'admin', collegeId: String(collegeId) },
      );
      expect(r.totalOutstanding).toBe(0);
      expect(r.collectedInRange).toBe(0);
      expect(r.collectionRatePercent).toBe(0);
      expect(r.overdueStudentsCount).toBe(0);
      expect(r.overdueAmount).toBe(0);
      expect(r.funnelByStage.stage_1).toBe(0);
      expect(r.funnelByStage.stage_2).toBe(0);
      expect(r.funnelByStage.stage_3).toBe(0);
      expect(r.funnelByStage.stage_4).toBe(0);
      expect(r.funnelByStage.welfare_referred).toBe(0);
      expect(r.collectionTimeSeries).toEqual([]);
      expect(r.dueByProgramme).toEqual([]);
      expect(r.paymentModeBreakdown).toEqual({
        cash: 0, upi: 0, neft: 0, cheque: 0, online: 0, card: 0, other: 0,
      });
    });

    it('null/unknown payment mode → bucketed as "other"', async () => {
      const collegeId = oid();
      const programme = await seedProgramme(collegeId);
      const student = await seedStudent({
        collegeId,
        programmeId: programme._id as mongoose.Types.ObjectId,
      });

      // 'dd' and 'rtgs' are valid enum values but NOT in the dashboard's 7-key schema.
      // They must fall into the 'other' bucket per spec.
      const now = new Date();
      await Payment.create([
        {
          collegeId,
          studentId: student._id,
          receiptNumber: 'pm-dd',
          amount: 300,
          paymentMode: 'dd',
          status: 'success',
          paymentDate: now,
          createdAt: now,
        },
        {
          collegeId,
          studentId: student._id,
          receiptNumber: 'pm-rtgs',
          amount: 700,
          paymentMode: 'rtgs',
          status: 'success',
          paymentDate: now,
          createdAt: now,
        },
      ]);

      const r = await svc.getDashboard(
        String(collegeId),
        { from: new Date(now.getTime() - 30 * 86_400_000), to: now },
        { role: 'admin', collegeId: String(collegeId) },
      );
      expect(r.paymentModeBreakdown.other).toBe(1000);
      expect(r.paymentModeBreakdown.cash).toBe(0);
      expect(r.paymentModeBreakdown.upi).toBe(0);
    });

    it('student without programme is skipped in dueByProgramme (no crash)', async () => {
      const collegeId = oid();
      // Create a student with NO programmeId
      const person = await Person.create({
        collegeId,
        phone: '+919999999999',
        name: 'Orphan',
      });
      const orphan = await Student.create({
        collegeId,
        personId: person._id,
        admissionYear: 2024,
        rollNumber: 'O-1',
        status: 'active',
      });

      const now = new Date();
      await Invoice.create({
        collegeId,
        invoiceNumber: 'ORPH-1',
        studentId: orphan._id,
        type: 'fee',
        totalAmount: 5000,
        dueDate: new Date(now.getTime() - 2 * 86_400_000),
        status: 'generated',
        issuedDate: new Date(now.getTime() - 20 * 86_400_000),
        items: [],
      });

      // 007 — give the orphan a net balance so the programme-join filter is genuinely
      // exercised (its balance feeds totalOutstanding but must NOT reach dueByProgramme).
      await StudentFeeAccount.create({ collegeId, studentId: orphan._id, totalDue: 5000, balance: 5000 });

      const r = await svc.getDashboard(
        String(collegeId),
        { from: new Date(now.getTime() - 30 * 86_400_000), to: now },
        { role: 'admin', collegeId: String(collegeId) },
      );
      // dueByProgramme must not include the orphan (no programme to join)
      expect(r.dueByProgramme.every((p) => !!p.programmeId)).toBe(true);
    });

    it('cross-college isolation: college A returns zero college-B records', async () => {
      const collegeA = oid();
      const collegeB = oid();
      const programmeA = await seedProgramme(collegeA, 'A-CSE');
      const programmeB = await seedProgramme(collegeB, 'B-CSE');
      const studentA = await seedStudent({
        collegeId: collegeA,
        programmeId: programmeA._id as mongoose.Types.ObjectId,
      });
      const studentB = await seedStudent({
        collegeId: collegeB,
        programmeId: programmeB._id as mongoose.Types.ObjectId,
      });

      await DefaulterRecord.create([
        {
          collegeId: collegeA,
          studentId: studentA._id,
          invoiceId: oid(),
          overdueAmount: 1000,
          daysOverdue: 3,
          escalationStage: 'stage_1',
        },
        {
          collegeId: collegeB,
          studentId: studentB._id,
          invoiceId: oid(),
          overdueAmount: 9999,
          daysOverdue: 50,
          escalationStage: 'stage_4',
        },
      ]);

      const now = new Date();
      const r = await svc.getDashboard(
        String(collegeA),
        { from: new Date(now.getTime() - 30 * 86_400_000), to: now },
        { role: 'admin', collegeId: String(collegeA) },
      );
      expect(r.funnelByStage.stage_1).toBe(1);
      expect(r.funnelByStage.stage_4).toBe(0);
    });
  });

  // ─── getDefaulters ──────────────────────────────────────────────

  describe('getDefaulters', () => {
    async function seedDefaulterFixture(collegeId: mongoose.Types.ObjectId) {
      const programme = await seedProgramme(collegeId, 'DEF-CSE');
      const s1 = await seedStudent({
        collegeId,
        programmeId: programme._id as mongoose.Types.ObjectId,
        rollNumber: 'DEF-001',
        name: 'Arjun',
      });
      const s2 = await seedStudent({
        collegeId,
        programmeId: programme._id as mongoose.Types.ObjectId,
        rollNumber: 'DEF-002',
        name: 'Banu',
      });
      const s3 = await seedStudent({
        collegeId,
        programmeId: programme._id as mongoose.Types.ObjectId,
        rollNumber: 'DEF-003',
        name: 'Chetan',
      });

      await DefaulterRecord.create([
        {
          collegeId,
          studentId: s1._id,
          invoiceId: oid(),
          overdueAmount: 1000,
          daysOverdue: 3,
          escalationStage: 'stage_1',
        },
        {
          collegeId,
          studentId: s2._id,
          invoiceId: oid(),
          overdueAmount: 5000,
          daysOverdue: 10,
          escalationStage: 'stage_2',
        },
        {
          collegeId,
          studentId: s3._id,
          invoiceId: oid(),
          overdueAmount: 25000,
          daysOverdue: 45,
          escalationStage: 'stage_4',
          autoEscalationPaused: new Date(Date.now() + 7 * 86_400_000),
        },
        // A "cleared" record — must be filtered out of the list
        {
          collegeId,
          studentId: s1._id,
          invoiceId: oid(),
          overdueAmount: 0,
          daysOverdue: 0,
          escalationStage: 'resolved',
        },
      ]);

      return { programme, s1, s2, s3 };
    }

    it('pagination: limit + offset work', async () => {
      const collegeId = oid();
      await seedDefaulterFixture(collegeId);

      const page1 = await svc.getDefaulters(
        String(collegeId),
        { limit: 2, offset: 0, sort: 'overdueAmount' },
        { role: 'admin', collegeId: String(collegeId) },
      );
      expect(page1.items.length).toBe(2);
      expect(page1.total).toBe(3);

      const page2 = await svc.getDefaulters(
        String(collegeId),
        { limit: 2, offset: 2, sort: 'overdueAmount' },
        { role: 'admin', collegeId: String(collegeId) },
      );
      expect(page2.items.length).toBe(1);
      expect(page2.total).toBe(3);
    });

    it('sort by overdueAmount descending', async () => {
      const collegeId = oid();
      await seedDefaulterFixture(collegeId);

      const r = await svc.getDefaulters(
        String(collegeId),
        { sort: 'overdueAmount' },
        { role: 'admin', collegeId: String(collegeId) },
      );
      const amounts = r.items.map((i) => i.overdueAmount);
      expect(amounts[0]).toBe(25000);
      expect(amounts[amounts.length - 1]).toBe(1000);
    });

    it('sort by daysOverdue descending', async () => {
      const collegeId = oid();
      await seedDefaulterFixture(collegeId);

      const r = await svc.getDefaulters(
        String(collegeId),
        { sort: 'daysOverdue' },
        { role: 'admin', collegeId: String(collegeId) },
      );
      const days = r.items.map((i) => i.daysOverdue);
      expect(days[0]).toBe(45);
      expect(days[days.length - 1]).toBe(3);
    });

    it('includes autoEscalationPaused students with paused-until date', async () => {
      const collegeId = oid();
      await seedDefaulterFixture(collegeId);

      const r = await svc.getDefaulters(
        String(collegeId),
        { sort: 'overdueAmount' },
        { role: 'admin', collegeId: String(collegeId) },
      );
      const chetan = r.items.find((i) => i.rollNumber === 'DEF-003');
      expect(chetan).toBeDefined();
      expect(chetan!.autoEscalationPaused).toBeInstanceOf(Date);
      expect(chetan!.escalationStage).toBe('stage_4');
    });

    it('HOD scope filters defaulters by programmeId', async () => {
      const collegeId = oid();
      const cse = await seedProgramme(collegeId, 'HOD-CSE');
      const ece = await seedProgramme(collegeId, 'HOD-ECE');
      const cseStudent = await seedStudent({
        collegeId,
        programmeId: cse._id as mongoose.Types.ObjectId,
        rollNumber: 'HCSE-1',
      });
      const eceStudent = await seedStudent({
        collegeId,
        programmeId: ece._id as mongoose.Types.ObjectId,
        rollNumber: 'HECE-1',
      });

      await DefaulterRecord.create([
        {
          collegeId,
          studentId: cseStudent._id,
          invoiceId: oid(),
          overdueAmount: 1000,
          daysOverdue: 3,
          escalationStage: 'stage_1',
        },
        {
          collegeId,
          studentId: eceStudent._id,
          invoiceId: oid(),
          overdueAmount: 2000,
          daysOverdue: 5,
          escalationStage: 'stage_1',
        },
      ]);

      const r = await svc.getDefaulters(
        String(collegeId),
        {},
        {
          role: 'hod',
          collegeId: String(collegeId),
          hodProgrammeIds: [String(cse._id)],
        },
      );
      expect(r.total).toBe(1);
      expect(r.items[0]!.rollNumber).toBe('HCSE-1');
    });

    it('excludes cleared/resolved defaulters', async () => {
      const collegeId = oid();
      const { s1 } = await seedDefaulterFixture(collegeId);

      const r = await svc.getDefaulters(
        String(collegeId),
        {},
        { role: 'admin', collegeId: String(collegeId) },
      );
      // 3 active records, the 'resolved' one is excluded
      expect(r.total).toBe(3);
      const stages = r.items.map((i) => i.escalationStage);
      expect(stages).not.toContain('resolved');
      // s1's ACTIVE record (stage_1) must still be present
      expect(r.items.some((i) => i.studentId === String(s1._id))).toBe(true);
    });

    it('cross-college isolation: college A does not see college-B defaulters', async () => {
      const collegeA = oid();
      const collegeB = oid();
      await seedDefaulterFixture(collegeA);
      await seedDefaulterFixture(collegeB);

      const rA = await svc.getDefaulters(
        String(collegeA),
        {},
        { role: 'admin', collegeId: String(collegeA) },
      );
      expect(rA.total).toBe(3);
      const rB = await svc.getDefaulters(
        String(collegeB),
        {},
        { role: 'admin', collegeId: String(collegeB) },
      );
      expect(rB.total).toBe(3);
      // Isolation check — the student ids in A's result must not appear in
      // B's result (rolls collide because the fixture is deterministic, but
      // studentIds are unique per-college seed).
      const aIds = new Set(rA.items.map((i) => i.studentId));
      for (const item of rB.items) {
        expect(aIds.has(item.studentId)).toBe(false);
      }
    });
  });

  // ─── Performance smoke ─────────────────────────────────────────

  describe('perf', () => {
    it('1000-student fixture → getDashboard returns under 2s (CI-friendly floor)', async () => {
      const collegeId = oid();
      const programme = await seedProgramme(collegeId, 'PERF-CSE');

      // Seed 1000 students; each with 1 overdue invoice + 1 successful payment.
      const N = 1000;
      const persons = Array.from({ length: N }, (_, i) => ({
        collegeId,
        phone: `+91${9000000000 + i}`,
        name: `Perf-${i}`,
      }));
      const createdPersons = await Person.insertMany(persons);

      const studentDocs = createdPersons.map((p, i) => ({
        collegeId,
        personId: p._id,
        admissionYear: 2024,
        programmeId: programme._id,
        rollNumber: `PERF-${i}`,
        status: 'active',
      }));
      const students = await Student.insertMany(studentDocs);

      const now = new Date();
      const day = 86_400_000;
      const invoices = students.map((s, i) => ({
        collegeId,
        invoiceNumber: `PINV-${i}`,
        studentId: s._id,
        type: 'fee',
        totalAmount: 10000,
        dueDate: new Date(now.getTime() - (i % 60 + 1) * day),
        status: 'generated',
        issuedDate: new Date(now.getTime() - 90 * day),
        items: [],
      }));
      await Invoice.insertMany(invoices);

      const payments = students.slice(0, 500).map((s, i) => ({
        collegeId,
        studentId: s._id,
        receiptNumber: `PR-${i}`,
        amount: 2000,
        paymentMode: 'upi',
        status: 'success',
        paymentDate: new Date(now.getTime() - (i % 45 + 1) * day),
        createdAt: new Date(now.getTime() - (i % 45 + 1) * day),
      }));
      await Payment.insertMany(payments);

      // 007 — AR reads StudentFeeAccount.balance; give every student a net balance so
      // totalOutstanding > 0 (first 500 paid 2000 of 10000, rest owe the full 10000).
      await StudentFeeAccount.insertMany(students.map((s, i) => ({
        collegeId, studentId: s._id, totalDue: 10000,
        totalPaid: i < 500 ? 2000 : 0, balance: i < 500 ? 8000 : 10000,
      })));

      const defaulters = students.slice(0, 300).map((s, i) => ({
        collegeId,
        studentId: s._id,
        invoiceId: oid(),
        overdueAmount: 5000 + i,
        daysOverdue: i % 60,
        escalationStage: (i % 5 === 0 ? 'stage_1' : i % 5 === 1 ? 'stage_2' : i % 5 === 2 ? 'stage_3' : i % 5 === 3 ? 'stage_4' : 'welfare_referred') as
          | 'stage_1' | 'stage_2' | 'stage_3' | 'stage_4' | 'welfare_referred',
      }));
      await DefaulterRecord.insertMany(defaulters);

      const t0 = Date.now();
      const r = await svc.getDashboard(
        String(collegeId),
        { from: new Date(now.getTime() - 90 * day), to: now },
        { role: 'admin', collegeId: String(collegeId) },
      );
      const elapsed = Date.now() - t0;

      expect(r.totalOutstanding).toBeGreaterThan(0);
      // CI floor — real infra target is p95 < 800ms.
      expect(elapsed).toBeLessThan(2000);
    }, 60_000);
  });
});

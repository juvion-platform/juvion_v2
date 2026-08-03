import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import * as service from '../service';
import { Student } from '../../../models/people/Student';
import { Payment } from '../../../models/finance/Payment';
import { FeeLineItem } from '../../../models/finance/FeeLineItem';
import { StudentFeeAccount } from '../../../models/finance/StudentFeeAccount';
import { Invoice } from '../../../models/finance/Invoice';
import { AuditLog } from '../../../shared/audit';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * Unit tests for the money-critical paths in `finance/service.ts`.
 *
 * These are the first unit tests in the finance module (it previously had
 * only e2e coverage) — part of P1-2 in the tech-debt remediation plan.
 * Scope is deliberately narrow: only the functions where a bug has a
 * direct monetary consequence. CRUD wrappers and pure-read functions are
 * out of scope here.
 *
 * Covered:
 *   1. `createPayment` — receipt numbering, status transitions on line
 *      items, guardian gate, audit-log emission, idempotent behaviors
 *   2. Sequential receipt numbering (RCP-YYYY-NNN padding and year reset)
 *   3. `assertStudentFeeGuardianReady` gate (via createPayment)
 *   4. `getStats` aggregation — totalCollected + totalPending math
 *
 * Not covered (intentional, out of scope for this PR — tracked in the
 * remediation plan under continued P1-2 work):
 *   - `generateSemesterInvoice` / `generateBatchInvoices`
 *   - `handleBounce`, `runReconciliation`
 *   - `matchPaymentToInvoice`, `detectDuplicatePayment`
 *   - `createRefund`, `createConcession`
 */

const oid = () => new mongoose.Types.ObjectId();

async function seedStudent(collegeId: string, opts: { withGuardian?: boolean } = {}) {
  const personId = oid();
  const feeResponsibleParentId = opts.withGuardian === false ? undefined : oid();
  const student = await Student.create({
    collegeId,
    personId,
    admissionYear: 2026,
    status: 'active',
    onboardingStatus: 'completed',
    feeResponsibleParentId,
  });
  return student;
}

async function seedLineItem(collegeId: string, studentId: mongoose.Types.ObjectId | string, amount: number, paidAmount = 0) {
  return FeeLineItem.create({
    collegeId,
    studentId,
    component: 'Tuition Fee',
    academicYearId: oid(),
    amount,
    paidAmount,
    status: paidAmount === 0 ? 'pending' : paidAmount >= amount ? 'paid' : 'partial',
  });
}

describe('finance.createPayment — money paths', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  describe('happy path — allocations update FeeLineItem', () => {
    it('fully pays a line item → status transitions to paid', async () => {
      const cid = String(oid());
      const student = await seedStudent(cid);
      const li = await seedLineItem(cid, student._id, 10000, 0);

      const payment = await service.createPayment(cid, {
        studentId: String(student._id),
        amount: 10000,
        paymentMode: 'upi',
        allocations: [{ lineItemId: String(li._id), amount: 10000 }],
      }, 'test-user');

      expect(payment.amount).toBe(10000);
      const reloaded = await FeeLineItem.findById(li._id);
      expect(reloaded?.paidAmount).toBe(10000);
      expect(reloaded?.status).toBe('paid');
    });

    it('partially pays a line item → status transitions to partial', async () => {
      const cid = String(oid());
      const student = await seedStudent(cid);
      const li = await seedLineItem(cid, student._id, 10000, 0);

      await service.createPayment(cid, {
        studentId: String(student._id),
        amount: 4000,
        paymentMode: 'cash',
        allocations: [{ lineItemId: String(li._id), amount: 4000 }],
      }, 'test-user');

      const reloaded = await FeeLineItem.findById(li._id);
      expect(reloaded?.paidAmount).toBe(4000);
      expect(reloaded?.status).toBe('partial');
    });

    it('splits one payment across multiple line items with correct per-item status', async () => {
      const cid = String(oid());
      const student = await seedStudent(cid);
      const tuition = await seedLineItem(cid, student._id, 10000);
      const development = await seedLineItem(cid, student._id, 5000);

      await service.createPayment(cid, {
        studentId: String(student._id),
        amount: 12000,
        paymentMode: 'neft',
        allocations: [
          { lineItemId: String(tuition._id), amount: 10000 },
          { lineItemId: String(development._id), amount: 2000 },
        ],
      }, 'test-user');

      const t = await FeeLineItem.findById(tuition._id);
      const d = await FeeLineItem.findById(development._id);
      expect(t?.paidAmount).toBe(10000);
      expect(t?.status).toBe('paid');
      expect(d?.paidAmount).toBe(2000);
      expect(d?.status).toBe('partial');
    });

    it('incremental payments to the same line item stack correctly', async () => {
      const cid = String(oid());
      const student = await seedStudent(cid);
      const li = await seedLineItem(cid, student._id, 10000);

      await service.createPayment(cid, {
        studentId: String(student._id), amount: 3000, paymentMode: 'cash',
        allocations: [{ lineItemId: String(li._id), amount: 3000 }],
      }, 'test-user');
      await service.createPayment(cid, {
        studentId: String(student._id), amount: 7000, paymentMode: 'upi',
        allocations: [{ lineItemId: String(li._id), amount: 7000 }],
      }, 'test-user');

      const reloaded = await FeeLineItem.findById(li._id);
      expect(reloaded?.paidAmount).toBe(10000);
      expect(reloaded?.status).toBe('paid');
    });
  });

  describe('payment without allocations', () => {
    it('creates Payment doc but leaves line items untouched', async () => {
      const cid = String(oid());
      const student = await seedStudent(cid);
      const li = await seedLineItem(cid, student._id, 10000);

      await service.createPayment(cid, {
        studentId: String(student._id),
        amount: 5000,
        paymentMode: 'cash',
        // allocations omitted → advance payment, admin will allocate later
      }, 'test-user');

      const reloaded = await FeeLineItem.findById(li._id);
      expect(reloaded?.paidAmount).toBe(0);
      expect(reloaded?.status).toBe('pending');
    });
  });

  describe('receipt-number generation', () => {
    it('generates RCP-YYYY-001 for the first payment of the year', async () => {
      const cid = String(oid());
      const student = await seedStudent(cid);
      const paymentDate = new Date('2026-07-15T10:00:00Z');

      const payment = await service.createPayment(cid, {
        studentId: String(student._id),
        amount: 1000,
        paymentMode: 'cash',
        paymentDate,
      }, 'test-user');

      expect(payment.receiptNumber).toBe('RCP-2026-001');
    });

    it('increments within the same year → 002, 003, ...', async () => {
      const cid = String(oid());
      const student = await seedStudent(cid);
      const base = new Date('2026-07-15T10:00:00Z');

      const p1 = await service.createPayment(cid, {
        studentId: String(student._id), amount: 1000, paymentMode: 'cash', paymentDate: base,
      }, 'u');
      const p2 = await service.createPayment(cid, {
        studentId: String(student._id), amount: 1000, paymentMode: 'cash', paymentDate: base,
      }, 'u');
      const p3 = await service.createPayment(cid, {
        studentId: String(student._id), amount: 1000, paymentMode: 'cash', paymentDate: base,
      }, 'u');

      expect(p1.receiptNumber).toBe('RCP-2026-001');
      expect(p2.receiptNumber).toBe('RCP-2026-002');
      expect(p3.receiptNumber).toBe('RCP-2026-003');
    });

    it('resets to 001 at year boundary', async () => {
      const cid = String(oid());
      const student = await seedStudent(cid);

      const p1 = await service.createPayment(cid, {
        studentId: String(student._id), amount: 1000, paymentMode: 'cash',
        paymentDate: new Date('2026-12-31T10:00:00Z'),
      }, 'u');
      const p2 = await service.createPayment(cid, {
        studentId: String(student._id), amount: 1000, paymentMode: 'cash',
        paymentDate: new Date('2027-01-01T10:00:00Z'),
      }, 'u');

      expect(p1.receiptNumber).toBe('RCP-2026-001');
      expect(p2.receiptNumber).toBe('RCP-2027-001');
    });

    it('uses the caller-supplied receipt number if provided (does not overwrite)', async () => {
      const cid = String(oid());
      const student = await seedStudent(cid);

      const payment = await service.createPayment(cid, {
        studentId: String(student._id),
        amount: 1000,
        paymentMode: 'cash',
        receiptNumber: 'CUSTOM-2026-XYZ',
      }, 'test-user');

      expect(payment.receiptNumber).toBe('CUSTOM-2026-XYZ');
    });

    it('is college-scoped — two colleges numbering independently', async () => {
      const cidA = String(oid());
      const cidB = String(oid());
      const studentA = await seedStudent(cidA);
      const studentB = await seedStudent(cidB);
      const base = new Date('2026-07-15T10:00:00Z');

      const pA1 = await service.createPayment(cidA, {
        studentId: String(studentA._id), amount: 1000, paymentMode: 'cash', paymentDate: base,
      }, 'u');
      const pB1 = await service.createPayment(cidB, {
        studentId: String(studentB._id), amount: 1000, paymentMode: 'cash', paymentDate: base,
      }, 'u');
      const pA2 = await service.createPayment(cidA, {
        studentId: String(studentA._id), amount: 1000, paymentMode: 'cash', paymentDate: base,
      }, 'u');

      // Each college has its own independent sequence.
      expect(pA1.receiptNumber).toBe('RCP-2026-001');
      expect(pB1.receiptNumber).toBe('RCP-2026-001');
      expect(pA2.receiptNumber).toBe('RCP-2026-002');
    });
  });

  describe('student fee-guardian gate', () => {
    // 007 T8 — the guardian REQUIREMENT is now flag-gated (off for the demo). Pin it ON
    // to exercise the guard; flag-off behaviour is covered by guardian-flag-007.test.ts.
    it('rejects 400 when enforcement is ON and student has no feeResponsibleParentId', async () => {
      process.env.FINANCE_ENFORCE_FEE_GUARDIAN = 'true';
      try {
        const cid = String(oid());
        const student = await seedStudent(cid, { withGuardian: false });

        await expect(
          service.createPayment(cid, {
            studentId: String(student._id),
            amount: 1000,
            paymentMode: 'cash',
          }, 'u'),
        ).rejects.toMatchObject({ statusCode: 400 });
      } finally {
        delete process.env.FINANCE_ENFORCE_FEE_GUARDIAN;
      }
    });

    it('rejects 404 when studentId does not exist', async () => {
      const cid = String(oid());

      await expect(
        service.createPayment(cid, {
          studentId: String(oid()),
          amount: 1000,
          paymentMode: 'cash',
        }, 'u'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    // Note: the guardian gate noops when no studentId is passed, but the
    // Payment model requires studentId via Mongoose schema validation —
    // so callers can never actually create a "truly anonymous" payment.
    // The gate's noop is defense-in-depth; schema validation blocks the
    // path-through. Intentionally no test for the "no studentId" case.
  });

  describe('audit logging', () => {
    it('writes exactly one AuditLog per createPayment call', async () => {
      const cid = String(oid());
      const student = await seedStudent(cid);

      await service.createPayment(cid, {
        studentId: String(student._id),
        amount: 1000,
        paymentMode: 'cash',
      }, 'alice');

      const audits = await AuditLog.find({ collegeId: cid, entityType: 'Payment' });
      expect(audits.length).toBe(1);
      expect(audits[0]!.action).toBe('create');
      expect(audits[0]!.performedBy).toBe('alice');
      expect(audits[0]!.entityName).toMatch(/^RCP-/);
    });
  });
});

describe('finance.getStats — aggregate math', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('sums only status=success payments into totalCollected', async () => {
    const cid = String(oid());
    const student = await seedStudent(cid);

    // status defaults to 'success'
    await Payment.create({
      collegeId: cid, studentId: student._id,
      receiptNumber: 'R-1', amount: 5000, paymentMode: 'cash',
    });
    await Payment.create({
      collegeId: cid, studentId: student._id,
      receiptNumber: 'R-2', amount: 3000, paymentMode: 'upi', status: 'failed',
    });
    await Payment.create({
      collegeId: cid, studentId: student._id,
      receiptNumber: 'R-3', amount: 1000, paymentMode: 'cash', status: 'pending',
    });

    const stats = await service.getStats(cid);
    expect(stats.totalCollected).toBe(5000); // only the 'success' one
  });

  it('sums StudentFeeAccount.balance into totalPending — NOT FeeLineItem', async () => {
    const cid = String(oid());
    const s1 = await seedStudent(cid);
    const s2 = await seedStudent(cid);

    // Net AR is the maintained balance, so a PARTIAL payment is already
    // reflected: 60000 billed − 25000 paid = 35000 still receivable.
    await StudentFeeAccount.create({
      collegeId: cid, studentId: s1._id, totalDue: 60000, totalPaid: 25000, balance: 35000,
    });
    await StudentFeeAccount.create({
      collegeId: cid, studentId: s2._id, totalDue: 60000, totalPaid: 0, balance: 60000,
    });

    // Regression guard: the hub used to read FeeLineItem, a collection the
    // pin→invoice billing path never writes. A stray row must not leak in.
    await seedLineItem(cid, s1._id, 999999, 0);

    const stats = await service.getStats(cid);
    expect(stats.totalPending).toBe(95000);
  });

  it('counts only past-due unsettled invoices into overdueInvoices', async () => {
    const cid = String(oid());
    const student = await seedStudent(cid);
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const inv = (invoiceNumber: string, dueDate: Date, status: string) =>
      Invoice.create({
        collegeId: cid, studentId: student._id, invoiceNumber, type: 'fee',
        totalAmount: 1000, netPayable: 1000, dueDate, status,
      });

    await inv('I-1', past, 'generated');       // counts
    await inv('I-2', past, 'partially_paid');  // counts
    await inv('I-3', past, 'paid');            // settled — excluded
    await inv('I-4', past, 'cancelled');       // void — excluded
    await inv('I-5', past, 'written_off');     // void — excluded
    await inv('I-6', past, 'draft');           // never issued — excluded
    await inv('I-7', future, 'generated');     // not yet due — excluded

    const stats = await service.getStats(cid);
    expect(stats.overdueInvoices).toBe(2);
  });

  it('returns 0s for a college with no data', async () => {
    const stats = await service.getStats(String(oid()));
    expect(stats.totalCollected).toBe(0);
    expect(stats.totalPending).toBe(0);
    expect(stats.payments).toBe(0);
    expect(stats.feeLineItems).toBe(0);
  });

  it('scopes counts per-college (no data leakage between tenants)', async () => {
    const cidA = String(oid());
    const cidB = String(oid());
    const studentA = await seedStudent(cidA);
    const studentB = await seedStudent(cidB);

    await Payment.create({
      collegeId: cidA, studentId: studentA._id,
      receiptNumber: 'R-A1', amount: 1000, paymentMode: 'cash',
    });
    await Payment.create({
      collegeId: cidB, studentId: studentB._id,
      receiptNumber: 'R-B1', amount: 9999, paymentMode: 'cash',
    });

    const statsA = await service.getStats(cidA);
    const statsB = await service.getStats(cidB);
    expect(statsA.totalCollected).toBe(1000);
    expect(statsB.totalCollected).toBe(9999);
    expect(statsA.payments).toBe(1);
    expect(statsB.payments).toBe(1);
  });
});

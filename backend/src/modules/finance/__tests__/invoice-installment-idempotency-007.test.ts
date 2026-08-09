/**
 * 007 · T2 — the semester-installment idempotency unique index.
 *
 * Contract: a college may hold AT MOST ONE tuition-installment invoice per
 * (studentId, semesterId), enforced by a partial unique index keyed on the
 * POSITIVE discriminator `isSemesterInstallment:true` — NOT on `type:'fee'`.
 *
 * The keying is the whole point (G2-C1): exam-fee invoices are ALSO `type:'fee'`
 * with a `semesterId`, so a `type:'fee'`-keyed index would (a) collide a legit
 * tuition+exam-same-semester pair and (b) fail to build. These tests lock in that
 * an exam-shaped `type:'fee'` invoice WITHOUT the flag can co-exist with the
 * installment for the same tuple, while a second installment cannot.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Types } from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Invoice } from '../../../models/finance/Invoice';

const COLLEGE = new Types.ObjectId();
const STUDENT = new Types.ObjectId();
const SEMESTER = new Types.ObjectId();

let seq = 0;
/** Unique invoiceNumber per doc — the pre-existing {collegeId,invoiceNumber} unique index is unrelated. */
const base = (over: Record<string, unknown> = {}) => ({
  collegeId: COLLEGE,
  invoiceNumber: `INV-T2-${seq++}`,
  type: 'fee',
  totalAmount: 45000,
  dueDate: new Date('2026-08-30'),
  studentId: STUDENT,
  semesterId: SEMESTER,
  ...over,
});

beforeAll(async () => {
  await setupMongo();
  // Materialise indexes — Model.create does not auto-build them in the in-memory server.
  await Invoice.syncIndexes();
}, 90_000);

afterAll(async () => { await teardownMongo(); }, 30_000);
afterEach(async () => { await clearCollections(); });

describe('007 T2 — installment invoice uniqueness', () => {
  it('rejects a second installment for the same (student, semester)', async () => {
    await Invoice.create(base({ isSemesterInstallment: true }));
    await expect(
      Invoice.create(base({ isSemesterInstallment: true })),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('allows an exam-fee type:fee invoice (no flag) to co-exist with the installment', async () => {
    await Invoice.create(base({ isSemesterInstallment: true }));
    // Same college/student/semester, type:'fee', but NOT an installment (exam fee).
    await expect(
      Invoice.create(base({ examType: 'supplementary' })),
    ).resolves.toBeDefined();
  });

  it('allows installments for the same student in different semesters', async () => {
    await Invoice.create(base({ isSemesterInstallment: true }));
    await expect(
      Invoice.create(base({ isSemesterInstallment: true, semesterId: new Types.ObjectId() })),
    ).resolves.toBeDefined();
  });

  it('does not constrain non-installment invoices lacking studentId/semesterId', async () => {
    // Two bare type:'fee' invoices (no student, no semester) must both persist —
    // the $type:objectId guards keep them out of the partial index (T0 null-collision trap).
    await Invoice.create(base({ studentId: undefined, semesterId: undefined, invoiceNumber: 'INV-T2-bareA' }));
    await expect(
      Invoice.create(base({ studentId: undefined, semesterId: undefined, invoiceNumber: 'INV-T2-bareB' })),
    ).resolves.toBeDefined();
  });
});

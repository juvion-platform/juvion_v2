import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { DefaulterRecord } from '../DefaulterRecord';
import { Invoice } from '../Invoice';
import { Payment } from '../Payment';
import { FeeReminder } from '../FeeReminder';
import { FinancialHold } from '../FinancialHold';
import { FinePenalty } from '../FinePenalty';
import { Concession } from '../Concession';
import { Scholarship } from '../Scholarship';
import { ScholarshipAllocation } from '../ScholarshipAllocation';
import { FeeAlertsCronRun } from '../FeeAlertsCronRun';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * Task 1 — Fee Collection Analytics & Alerts: schema additions.
 *
 * Covers plan §2.1, §2.2, §2.3, §2.4. Pure schema-level assertions — no
 * service layer. Later tasks (T3, T4, T5, T7) own the service + cron + seed
 * implementations.
 */

const oid = () => new mongoose.Types.ObjectId();

describe('Task 1 — fee-analytics schema additions', () => {
  beforeAll(async () => {
    await setupMongo();
    // Sync indexes for every model we touch so the explicit compound
    // indexes declared by this task show up in collection.indexes().
    await Promise.all([
      DefaulterRecord.syncIndexes(),
      Invoice.syncIndexes(),
      Payment.syncIndexes(),
      FeeReminder.syncIndexes(),
      FinancialHold.syncIndexes(),
      FinePenalty.syncIndexes(),
      Concession.syncIndexes(),
      Scholarship.syncIndexes(),
      ScholarshipAllocation.syncIndexes(),
      FeeAlertsCronRun.syncIndexes(),
    ]);
  }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  describe('DefaulterRecord — autoEscalationPaused + lastEscalationAt', () => {
    const baseDoc = () => ({
      collegeId: oid(),
      studentId: oid(),
      invoiceId: oid(),
      overdueAmount: 1500,
      daysOverdue: 5,
    });

    it('validates WITHOUT autoEscalationPaused (optional, backward compat)', async () => {
      const doc = await DefaulterRecord.create(baseDoc());
      expect(doc._id).toBeDefined();
      // schema defaults `autoEscalationPaused` to `null` — the cron treats
      // `null | undefined | past-date` all as "not paused". See plan §2.1.
      expect(doc.autoEscalationPaused === null || doc.autoEscalationPaused === undefined).toBe(true);
    });

    it('validates WITH autoEscalationPaused set to a future date', async () => {
      const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const doc = await DefaulterRecord.create({ ...baseDoc(), autoEscalationPaused: future });
      expect(doc.autoEscalationPaused).toBeInstanceOf(Date);
      expect(doc.autoEscalationPaused?.getTime()).toBe(future.getTime());
    });

    it('accepts autoEscalationPaused = null (admin cleared the pause)', async () => {
      const doc = await DefaulterRecord.create({ ...baseDoc(), autoEscalationPaused: null });
      expect(doc.autoEscalationPaused === null || doc.autoEscalationPaused === undefined).toBe(true);
    });

    it('validates WITHOUT lastEscalationAt (optional, backward compat)', async () => {
      const doc = await DefaulterRecord.create(baseDoc());
      expect(doc._id).toBeDefined();
      expect(doc.lastEscalationAt).toBeUndefined();
    });

    it('validates WITH lastEscalationAt set by the cron', async () => {
      const now = new Date();
      const doc = await DefaulterRecord.create({ ...baseDoc(), lastEscalationAt: now });
      expect(doc.lastEscalationAt).toBeInstanceOf(Date);
      expect(doc.lastEscalationAt?.getTime()).toBe(now.getTime());
    });
  });

  describe('metadata field — present on 8 models and default-empty', () => {
    it('Invoice accepts arbitrary metadata object', async () => {
      const doc = await Invoice.create({
        collegeId: oid(),
        invoiceNumber: 'INV-001',
        type: 'fee',
        items: [{ description: 'Tuition', amount: 50000 }],
        totalAmount: 50000,
        dueDate: new Date(),
        metadata: { source: 'demo-seed-v1', seededAt: new Date() },
      } as unknown as Parameters<typeof Invoice.create>[0]);
      const asAny = doc as unknown as { metadata?: Record<string, unknown> };
      expect(asAny.metadata).toBeDefined();
      expect(asAny.metadata?.source).toBe('demo-seed-v1');
    });

    it('Invoice without metadata defaults to an empty object', async () => {
      const doc = await Invoice.create({
        collegeId: oid(),
        invoiceNumber: 'INV-002',
        type: 'fee',
        items: [],
        totalAmount: 0,
        dueDate: new Date(),
      });
      const asAny = doc as unknown as { metadata?: Record<string, unknown> };
      expect(asAny.metadata).toEqual({});
    });

    it('Payment accepts arbitrary metadata object', async () => {
      const doc = await Payment.create({
        collegeId: oid(),
        studentId: oid(),
        receiptNumber: 'RCPT-1',
        amount: 1000,
        paymentMode: 'cash',
        allocations: [],
        metadata: { source: 'demo-seed-v1' },
      } as unknown as Parameters<typeof Payment.create>[0]);
      const asAny = doc as unknown as { metadata?: Record<string, unknown> };
      expect(asAny.metadata?.source).toBe('demo-seed-v1');
    });

    it('DefaulterRecord accepts metadata', async () => {
      const doc = await DefaulterRecord.create({
        collegeId: oid(),
        studentId: oid(),
        invoiceId: oid(),
        overdueAmount: 1000,
        daysOverdue: 3,
        metadata: { source: 'demo-seed-v1' },
      } as unknown as Parameters<typeof DefaulterRecord.create>[0]);
      const asAny = doc as unknown as { metadata?: Record<string, unknown> };
      expect(asAny.metadata?.source).toBe('demo-seed-v1');
    });

    it('FeeReminder accepts metadata', async () => {
      const doc = await FeeReminder.create({
        collegeId: oid(),
        studentId: oid(),
        channel: 'sms',
        dueAmount: 1000,
        metadata: { source: 'demo-seed-v1' },
      } as unknown as Parameters<typeof FeeReminder.create>[0]);
      const asAny = doc as unknown as { metadata?: Record<string, unknown> };
      expect(asAny.metadata?.source).toBe('demo-seed-v1');
    });

    it('FinancialHold accepts metadata', async () => {
      const doc = await FinancialHold.create({
        collegeId: oid(),
        studentId: oid(),
        defaulterRecordId: oid(),
        holdType: 'exam_debarment',
        approvedBy: oid(),
        metadata: { source: 'demo-seed-v1' },
      } as unknown as Parameters<typeof FinancialHold.create>[0]);
      const asAny = doc as unknown as { metadata?: Record<string, unknown> };
      expect(asAny.metadata?.source).toBe('demo-seed-v1');
    });

    it('FinePenalty accepts metadata', async () => {
      const doc = await FinePenalty.create({
        collegeId: oid(),
        studentId: oid(),
        type: 'late_fee',
        reason: 'overdue',
        amount: 200,
        dueDate: new Date(),
        metadata: { source: 'demo-seed-v1' },
      } as unknown as Parameters<typeof FinePenalty.create>[0]);
      const asAny = doc as unknown as { metadata?: Record<string, unknown> };
      expect(asAny.metadata?.source).toBe('demo-seed-v1');
    });

    it('Concession accepts metadata', async () => {
      const doc = await Concession.create({
        collegeId: oid(),
        studentId: oid(),
        type: 'sibling',
        reason: 'brother in same college',
        academicYearId: oid(),
        metadata: { source: 'demo-seed-v1' },
      } as unknown as Parameters<typeof Concession.create>[0]);
      const asAny = doc as unknown as { metadata?: Record<string, unknown> };
      expect(asAny.metadata?.source).toBe('demo-seed-v1');
    });

    it('Scholarship accepts metadata', async () => {
      const doc = await Scholarship.create({
        collegeId: oid(),
        name: 'Merit Scholarship',
        provider: 'institutional',
        type: 'merit',
        amount: 10000,
        academicYearId: oid(),
        metadata: { source: 'demo-seed-v1' },
      } as unknown as Parameters<typeof Scholarship.create>[0]);
      const asAny = doc as unknown as { metadata?: Record<string, unknown> };
      expect(asAny.metadata?.source).toBe('demo-seed-v1');
    });

    it('ScholarshipAllocation accepts metadata', async () => {
      const doc = await ScholarshipAllocation.create({
        collegeId: oid(),
        scholarshipId: oid(),
        studentId: oid(),
        academicYearId: oid(),
        amount: 5000,
        metadata: { source: 'demo-seed-v1' },
      } as unknown as Parameters<typeof ScholarshipAllocation.create>[0]);
      const asAny = doc as unknown as { metadata?: Record<string, unknown> };
      expect(asAny.metadata?.source).toBe('demo-seed-v1');
    });

    it('backward-compatible: raw insert without metadata field still validates on read', async () => {
      // Simulate legacy records inserted before this migration by driving
      // the collection directly (bypass schema defaults on write).
      const collegeId = oid();
      const db = mongoose.connection.db;
      if (!db) throw new Error('no db');
      await db.collection('invoices').insertOne({
        collegeId,
        invoiceNumber: 'LEGACY-1',
        type: 'fee',
        items: [],
        totalAmount: 0,
        dueDate: new Date(),
        status: 'draft',
        issuedDate: new Date(),
      });
      const fetched = await Invoice.findOne({ invoiceNumber: 'LEGACY-1' });
      expect(fetched).toBeTruthy();
      // legacy doc has no metadata on disk — reading must not throw; the
      // metadata accessor either returns undefined or the schema default {}
      // depending on Mongoose's default-population timing. Both are
      // acceptable for backward compat; the important thing is it doesn't
      // throw and the rest of the document is intact.
      expect(fetched?.invoiceNumber).toBe('LEGACY-1');
    });
  });

  describe('FeeAlertsCronRun — new audit collection', () => {
    it('creates a doc with the minimum required fields', async () => {
      const doc = await FeeAlertsCronRun.create({
        collegeId: oid(),
        startedAt: new Date(),
      });
      expect(doc._id).toBeDefined();
      // advancedByStage is a Mongoose subdocument at runtime (has internal
      // bookkeeping); strip via parent `.toObject()` before structural compare.
      const plain = doc.toObject();
      expect(plain.advancedByStage).toEqual({
        stage_1: 0, stage_2: 0, stage_3: 0, stage_4: 0, welfare_referred: 0,
      });
      expect(doc.skipped).toBe(0);
      expect(doc.alreadyAdvanced).toBe(0);
      expect(doc.unchanged).toBe(0);
      expect(doc.paused).toBe(0);
      expect(doc.errors).toEqual([]);
    });

    it('rejects creation when collegeId is missing', async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        FeeAlertsCronRun.create({ startedAt: new Date() } as any),
      ).rejects.toThrow();
    });

    it('rejects creation when startedAt is missing', async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        FeeAlertsCronRun.create({ collegeId: oid() } as any),
      ).rejects.toThrow();
    });

    it('persists finishedAt, topLevelError, errors[] when supplied', async () => {
      const studentId = oid();
      const invoiceId = oid();
      const doc = await FeeAlertsCronRun.create({
        collegeId: oid(),
        startedAt: new Date(),
        finishedAt: new Date(),
        advancedByStage: { stage_1: 2, stage_2: 1, stage_3: 0, stage_4: 0, welfare_referred: 0 },
        skipped: 1,
        alreadyAdvanced: 3,
        unchanged: 4,
        paused: 2,
        errors: [{ studentId, invoiceId, message: 'boom', stackSnippet: 'Error: boom\n  at ...' }],
        topLevelError: 'db unavailable',
      });
      expect(doc.finishedAt).toBeInstanceOf(Date);
      expect(doc.topLevelError).toBe('db unavailable');
      expect(doc.advancedByStage.stage_1).toBe(2);
      expect(doc.errors).toHaveLength(1);
      expect(String(doc.errors[0]!.studentId)).toBe(String(studentId));
      expect(doc.errors[0]!.message).toBe('boom');
    });

    it('accepts errors[] with only a message (studentId/invoiceId optional)', async () => {
      const doc = await FeeAlertsCronRun.create({
        collegeId: oid(),
        startedAt: new Date(),
        errors: [{ message: 'student lookup failed' }],
      });
      expect(doc.errors).toHaveLength(1);
      expect(doc.errors[0]!.message).toBe('student lookup failed');
    });
  });

  describe('Indexes — 4 new indexes declared in plan §2.4', () => {
    it('Invoice has { collegeId: 1, status: 1, dueDate: 1 }', async () => {
      const indexes = await Invoice.collection.indexes();
      const found = indexes.some((ix) => {
        const k = ix.key as Record<string, number>;
        return k.collegeId === 1 && k.status === 1 && k.dueDate === 1
          && Object.keys(k).length === 3;
      });
      expect(found).toBe(true);
    });

    it('DefaulterRecord has { collegeId: 1, escalationStage: 1 }', async () => {
      const indexes = await DefaulterRecord.collection.indexes();
      const found = indexes.some((ix) => {
        const k = ix.key as Record<string, number>;
        return k.collegeId === 1 && k.escalationStage === 1
          && Object.keys(k).length === 2;
      });
      expect(found).toBe(true);
    });

    it('Payment has { collegeId: 1, status: 1, createdAt: 1 }', async () => {
      const indexes = await Payment.collection.indexes();
      const found = indexes.some((ix) => {
        const k = ix.key as Record<string, number>;
        return k.collegeId === 1 && k.status === 1 && k.createdAt === 1
          && Object.keys(k).length === 3;
      });
      expect(found).toBe(true);
    });

    it('FeeAlertsCronRun has { collegeId: 1, startedAt: -1 }', async () => {
      const indexes = await FeeAlertsCronRun.collection.indexes();
      const found = indexes.some((ix) => {
        const k = ix.key as Record<string, number>;
        return k.collegeId === 1 && k.startedAt === -1
          && Object.keys(k).length === 2;
      });
      expect(found).toBe(true);
    });

    it('pre-existing unique Invoice index { collegeId: 1, invoiceNumber: 1 } is preserved', async () => {
      const indexes = await Invoice.collection.indexes();
      const found = indexes.some((ix) => {
        const k = ix.key as Record<string, number>;
        return k.collegeId === 1 && k.invoiceNumber === 1 && ix.unique === true;
      });
      expect(found).toBe(true);
    });
  });
});

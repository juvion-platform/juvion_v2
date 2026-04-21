import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { Student } from '../people/Student';
import { FeeLineItem } from '../finance/FeeLineItem';
import { setupMongo, teardownMongo, clearCollections } from '../../__tests__/helpers/mongoMemory';

/**
 * Task 1 — FeePin subdoc on Student + FeeLineItem.sourcePinId additive field.
 *
 * Covers plan §2.1 + §2.3. Pure schema-level assertions — no service layer.
 */

const oid = () => new mongoose.Types.ObjectId();

describe('Student.feePins subdoc schema', () => {
  beforeAll(async () => {
    await setupMongo();
    await Student.syncIndexes();
  }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  it('accepts a valid FeePin with all required fields and enum reason', async () => {
    const collegeId = oid();
    const personId = oid();
    const fsId = oid();
    const student = await Student.create({
      collegeId,
      personId,
      admissionYear: 2024,
      status: 'active',
      onboardingStatus: 'completed',
      isSealed: false,
      feePins: [
        {
          yearOfStudy: 1,
          feeStructureInstanceId: fsId,
          pinnedAt: new Date(),
          pinnedBy: 'system:admission',
          reason: 'initial',
        },
      ],
    });

    expect(student.feePins).toHaveLength(1);
    const pin = student.feePins[0]!;
    expect(pin.yearOfStudy).toBe(1);
    expect(String(pin.feeStructureInstanceId)).toBe(String(fsId));
    expect(pin.pinnedBy).toBe('system:admission');
    expect(pin.reason).toBe('initial');
    expect(pin._id).toBeDefined();
  });

  it('defaults feePins to empty array when omitted', async () => {
    const student = await Student.create({
      collegeId: oid(),
      personId: oid(),
      admissionYear: 2024,
      status: 'active',
      onboardingStatus: 'not_started',
      isSealed: false,
    });
    expect(student.feePins).toBeDefined();
    expect(student.feePins).toEqual([]);
  });

  it('accepts every allowed enum value for FeePin.reason', async () => {
    const reasons = [
      'initial',
      'branch_change',
      'quota_change',
      'programme_transfer',
      'admin_override',
      'data_correction',
      'year_back_carryforward',
    ] as const;

    for (const reason of reasons) {
      const doc = await Student.create({
        collegeId: oid(),
        personId: oid(),
        admissionYear: 2024,
        status: 'active',
        onboardingStatus: 'not_started',
        isSealed: false,
        feePins: [
          {
            yearOfStudy: 1,
            feeStructureInstanceId: oid(),
            pinnedAt: new Date(),
            pinnedBy: 'system:admission',
            reason,
          },
        ],
      });
      expect(doc.feePins[0]!.reason).toBe(reason);
    }
  });

  it('rejects an unknown FeePin.reason value', async () => {
    await expect(
      Student.create({
        collegeId: oid(),
        personId: oid(),
        admissionYear: 2024,
        status: 'active',
        onboardingStatus: 'not_started',
        isSealed: false,
        feePins: [
          {
            yearOfStudy: 1,
            feeStructureInstanceId: oid(),
            pinnedAt: new Date(),
            pinnedBy: 'system:admission',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            reason: 'bogus_reason' as any,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('accepts all enum values for commitmentSheetStatus', async () => {
    const statuses = ['queued', 'generated', 'failed'] as const;
    for (const status of statuses) {
      const doc = await Student.create({
        collegeId: oid(),
        personId: oid(),
        admissionYear: 2024,
        status: 'active',
        onboardingStatus: 'not_started',
        isSealed: false,
        feePins: [
          {
            yearOfStudy: 1,
            feeStructureInstanceId: oid(),
            pinnedAt: new Date(),
            pinnedBy: 'system:admission',
            reason: 'initial',
            commitmentSheetStatus: status,
            commitmentSheetDocumentId: oid(),
          },
        ],
      });
      expect(doc.feePins[0]!.commitmentSheetStatus).toBe(status);
    }
  });

  it('allows multiple pins with different yearOfStudy values on the same student', async () => {
    const student = await Student.create({
      collegeId: oid(),
      personId: oid(),
      admissionYear: 2022,
      status: 'active',
      onboardingStatus: 'completed',
      isSealed: false,
      feePins: [
        {
          yearOfStudy: 1,
          feeStructureInstanceId: oid(),
          pinnedAt: new Date(),
          pinnedBy: 'system:admission',
          reason: 'initial',
        },
        {
          yearOfStudy: 2,
          feeStructureInstanceId: oid(),
          pinnedAt: new Date(),
          pinnedBy: 'system:promotion',
          reason: 'initial',
        },
        {
          yearOfStudy: 3,
          feeStructureInstanceId: oid(),
          pinnedAt: new Date(),
          pinnedBy: 'system:promotion',
          reason: 'initial',
        },
      ],
    });

    expect(student.feePins).toHaveLength(3);
    const years = student.feePins.map((p) => p.yearOfStudy).sort();
    expect(years).toEqual([1, 2, 3]);
  });

  it('supports staleSince + archivedAt nullable lifecycle fields', async () => {
    const now = new Date();
    const student = await Student.create({
      collegeId: oid(),
      personId: oid(),
      admissionYear: 2024,
      status: 'active',
      onboardingStatus: 'completed',
      isSealed: false,
      feePins: [
        {
          yearOfStudy: 1,
          feeStructureInstanceId: oid(),
          pinnedAt: now,
          pinnedBy: 'system:admission',
          reason: 'initial',
          staleSince: null,
          archivedAt: null,
        },
        {
          yearOfStudy: 1,
          feeStructureInstanceId: oid(),
          pinnedAt: now,
          pinnedBy: 'principal:user-123',
          reason: 'branch_change',
          staleSince: now,
          archivedAt: now,
          archiveReason: 'branch_change',
        },
      ],
    });

    const [active, archived] = student.feePins;
    expect(active!.archivedAt ?? null).toBeNull();
    expect(active!.staleSince ?? null).toBeNull();
    expect(archived!.archivedAt).toBeInstanceOf(Date);
    expect(archived!.staleSince).toBeInstanceOf(Date);
    expect(archived!.archiveReason).toBe('branch_change');
  });

  it('creates a sparse index on feePins.feeStructureInstanceId', async () => {
    const indexes = await Student.collection.indexes();
    const hit = indexes.find(
      (ix) => ix.key && ix.key['feePins.feeStructureInstanceId'] === 1,
    );
    expect(hit).toBeDefined();
    expect(hit!.sparse).toBe(true);
  });

  it('FeePin requires yearOfStudy and feeStructureInstanceId', async () => {
    await expect(
      Student.create({
        collegeId: oid(),
        personId: oid(),
        admissionYear: 2024,
        status: 'active',
        onboardingStatus: 'not_started',
        isSealed: false,
        feePins: [
          {
            // missing yearOfStudy
            feeStructureInstanceId: oid(),
            pinnedAt: new Date(),
            pinnedBy: 'system:admission',
            reason: 'initial',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ],
      }),
    ).rejects.toThrow();

    await expect(
      Student.create({
        collegeId: oid(),
        personId: oid(),
        admissionYear: 2024,
        status: 'active',
        onboardingStatus: 'not_started',
        isSealed: false,
        feePins: [
          {
            yearOfStudy: 1,
            // missing feeStructureInstanceId
            pinnedAt: new Date(),
            pinnedBy: 'system:admission',
            reason: 'initial',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ],
      }),
    ).rejects.toThrow();
  });
});

describe('FeeLineItem.sourcePinId backward-compat field', () => {
  beforeAll(async () => { await setupMongo(); }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  it('validates without sourcePinId (legacy line items unaffected)', async () => {
    const doc = await FeeLineItem.create({
      collegeId: oid(),
      studentId: oid(),
      component: 'tuition_fee',
      academicYearId: oid(),
      amount: 50_000,
    });
    expect(doc._id).toBeDefined();
    expect((doc as unknown as { sourcePinId?: unknown }).sourcePinId).toBeUndefined();
  });

  it('accepts an optional sourcePinId ObjectId when provided', async () => {
    const pinId = oid();
    const doc = await FeeLineItem.create({
      collegeId: oid(),
      studentId: oid(),
      component: 'tuition_fee',
      academicYearId: oid(),
      amount: 50_000,
      sourcePinId: pinId,
    });
    expect(String((doc as unknown as { sourcePinId: mongoose.Types.ObjectId }).sourcePinId)).toBe(
      String(pinId),
    );
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { FeeComponentTemplate } from '../finance/FeeComponentTemplate';
import { setupMongo, teardownMongo, clearCollections } from '../../__tests__/helpers/mongoMemory';

/**
 * Task 1 — FeeComponentTemplate collection.
 *
 * Covers plan §2.2. Pure schema-level assertions — no service layer.
 * Service CRUD + seed logic live in later tasks (T2 + T6).
 */

const oid = () => new mongoose.Types.ObjectId();

describe('FeeComponentTemplate schema', () => {
  beforeAll(async () => {
    await setupMongo();
    // Build indexes once up-front. `afterEach clearCollections` uses
    // deleteMany which preserves indexes, so one sync is enough.
    await FeeComponentTemplate.syncIndexes();
  }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => { await clearCollections(); });

  it('creates a valid default component with all required fields', async () => {
    const doc = await FeeComponentTemplate.create({
      collegeId: oid(),
      componentKey: 'tuition_fee',
      displayLabel: 'Tuition Fee',
      category: 'academic',
      isRefundable: false,
      defaultOneTime: false,
      applicableToYears: [],
      displayOrder: 10,
      isDefault: true,
    });
    expect(doc._id).toBeDefined();
    expect(doc.componentKey).toBe('tuition_fee');
    expect(doc.category).toBe('academic');
    expect(doc.applicableToYears).toEqual([]);
    expect(doc.isDefault).toBe(true);
  });

  it('accepts all enum category values from the spec template', async () => {
    const categories = [
      'academic',
      'admission_oneoff',
      'lab',
      'infrastructure',
      'student_life',
      'regulatory',
      'caution',
      'conditional',
    ] as const;
    const collegeId = oid();
    for (const category of categories) {
      const doc = await FeeComponentTemplate.create({
        collegeId,
        componentKey: `key_${category}`,
        displayLabel: `Label ${category}`,
        category,
        isRefundable: false,
        defaultOneTime: false,
        applicableToYears: [],
        displayOrder: 1,
        isDefault: true,
      });
      expect(doc.category).toBe(category);
    }
  });

  it('rejects an unknown category value', async () => {
    await expect(
      FeeComponentTemplate.create({
        collegeId: oid(),
        componentKey: 'bogus',
        displayLabel: 'Bogus',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        category: 'not_a_real_category' as any,
        isRefundable: false,
        defaultOneTime: false,
        applicableToYears: [],
        displayOrder: 1,
        isDefault: false,
      }),
    ).rejects.toThrow();
  });

  it('enforces unique (collegeId, componentKey) — duplicates rejected', async () => {
    const collegeId = oid();

    await FeeComponentTemplate.create({
      collegeId,
      componentKey: 'library_fee',
      displayLabel: 'Library Fee',
      category: 'infrastructure',
      isRefundable: false,
      defaultOneTime: false,
      applicableToYears: [],
      displayOrder: 30,
      isDefault: true,
    });

    await expect(
      FeeComponentTemplate.create({
        collegeId,
        componentKey: 'library_fee',
        displayLabel: 'Library Fee (dup)',
        category: 'infrastructure',
        isRefundable: false,
        defaultOneTime: false,
        applicableToYears: [],
        displayOrder: 31,
        isDefault: false,
      }),
    ).rejects.toThrow();
  });

  it('allows same componentKey across different colleges', async () => {
    const key = 'tuition_fee';
    const a = await FeeComponentTemplate.create({
      collegeId: oid(),
      componentKey: key,
      displayLabel: 'Tuition Fee',
      category: 'academic',
      isRefundable: false,
      defaultOneTime: false,
      applicableToYears: [],
      displayOrder: 1,
      isDefault: true,
    });
    const b = await FeeComponentTemplate.create({
      collegeId: oid(),
      componentKey: key,
      displayLabel: 'Tuition Fee',
      category: 'academic',
      isRefundable: false,
      defaultOneTime: false,
      applicableToYears: [],
      displayOrder: 1,
      isDefault: true,
    });
    expect(String(a.collegeId)).not.toBe(String(b.collegeId));
  });

  it('requires collegeId, componentKey, displayLabel, category', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      FeeComponentTemplate.create({} as any),
    ).rejects.toThrow();
  });

  it('supports applicableToYears as an array of year-of-study numbers', async () => {
    const doc = await FeeComponentTemplate.create({
      collegeId: oid(),
      componentKey: 'internship_fee',
      displayLabel: 'Industrial Training / Internship Fee',
      category: 'lab',
      isRefundable: false,
      defaultOneTime: false,
      applicableToYears: [3, 4],
      displayOrder: 14,
      isDefault: true,
    });
    expect(doc.applicableToYears).toEqual([3, 4]);
  });

  it('writes timestamps on create and update', async () => {
    const doc = await FeeComponentTemplate.create({
      collegeId: oid(),
      componentKey: 'sports_fee',
      displayLabel: 'Sports / Gymkhana Fee',
      category: 'infrastructure',
      isRefundable: false,
      defaultOneTime: false,
      applicableToYears: [],
      displayOrder: 20,
      isDefault: true,
    });
    const asAny = doc as unknown as { createdAt?: Date; updatedAt?: Date };
    expect(asAny.createdAt).toBeInstanceOf(Date);
    expect(asAny.updatedAt).toBeInstanceOf(Date);
  });
});

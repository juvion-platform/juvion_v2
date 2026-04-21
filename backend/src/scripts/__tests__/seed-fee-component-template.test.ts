import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';

import { FeeComponentTemplate } from '../../models/finance/FeeComponentTemplate';
import { College } from '../../models/College';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

import {
  CANONICAL_FEE_COMPONENTS,
  seedFeeComponentTemplateForCollege,
  seedFeeComponentTemplateForAllColleges,
} from '../seed-fee-component-template';
import { createCollege } from '../../modules/colleges/service';

/**
 * Task 2 — Seed canonical fee-component template (spec §Template).
 *
 * Idempotent upsert per (collegeId, componentKey). Preserves college
 * customizations on displayLabel and never trampoline-overwrites a
 * college's custom (`isDefault: false`) component that happens to
 * collide on `componentKey`.
 */

const collegeInput = (code: string) => ({
  name: `College ${code}`,
  code,
  address: {
    line1: 'Addr', city: 'Hyderabad', state: 'TS', pincode: '500001',
  },
  contactEmail: `${code}@example.com`,
  contactPhone: '9999999999',
});

describe('seed-fee-component-template', () => {
  beforeAll(async () => {
    await setupMongo();
    await FeeComponentTemplate.syncIndexes();
  }, 60_000);
  afterAll(async () => { await teardownMongo(); }, 30_000);
  afterEach(async () => {
    await clearCollections();
    vi.restoreAllMocks();
  });

  it('exports the canonical component list as a named export for reuse (T6)', () => {
    expect(Array.isArray(CANONICAL_FEE_COMPONENTS)).toBe(true);
    expect(CANONICAL_FEE_COMPONENTS.length).toBeGreaterThan(0);
    // Every entry has the required shape.
    for (const c of CANONICAL_FEE_COMPONENTS) {
      expect(typeof c.componentKey).toBe('string');
      expect(typeof c.displayLabel).toBe('string');
      expect(typeof c.category).toBe('string');
      expect(typeof c.isRefundable).toBe('boolean');
      expect(typeof c.defaultOneTime).toBe('boolean');
      expect(Array.isArray(c.applicableToYears)).toBe(true);
      expect(typeof c.displayOrder).toBe('number');
    }
    // componentKey is unique across the canonical set.
    const keys = CANONICAL_FEE_COMPONENTS.map((c) => c.componentKey);
    expect(new Set(keys).size).toBe(keys.length);
    // tuition_fee appears before development_fee (spec ordering).
    const tuitionIdx = keys.indexOf('tuition_fee');
    const devIdx = keys.indexOf('development_fee');
    expect(tuitionIdx).toBeGreaterThan(-1);
    expect(devIdx).toBeGreaterThan(tuitionIdx);
  });

  it('seeds the full canonical set for a new college with isDefault=true', async () => {
    const college = await College.create(collegeInput('SEED1'));

    const result = await seedFeeComponentTemplateForCollege(String(college._id));

    const docs = await FeeComponentTemplate.find({ collegeId: college._id });
    expect(docs.length).toBe(CANONICAL_FEE_COMPONENTS.length);
    expect(result.inserted).toBe(CANONICAL_FEE_COMPONENTS.length);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    for (const d of docs) {
      expect(d.isDefault).toBe(true);
    }
  });

  it('re-running seed on the same college is idempotent (no duplicates)', async () => {
    const college = await College.create(collegeInput('SEED2'));

    await seedFeeComponentTemplateForCollege(String(college._id));
    const result2 = await seedFeeComponentTemplateForCollege(String(college._id));

    const docs = await FeeComponentTemplate.find({ collegeId: college._id });
    expect(docs.length).toBe(CANONICAL_FEE_COMPONENTS.length);
    // Second run performs zero inserts; all entries already existed.
    expect(result2.inserted).toBe(0);
  });

  it('preserves a customized displayLabel on re-seed', async () => {
    const college = await College.create(collegeInput('SEED3'));

    await seedFeeComponentTemplateForCollege(String(college._id));

    // College customizes the tuition label.
    await FeeComponentTemplate.updateOne(
      { collegeId: college._id, componentKey: 'tuition_fee' },
      { $set: { displayLabel: 'Annual Tuition (Customized)' } },
    );

    await seedFeeComponentTemplateForCollege(String(college._id));

    const doc = await FeeComponentTemplate.findOne({
      collegeId: college._id,
      componentKey: 'tuition_fee',
    });
    expect(doc?.displayLabel).toBe('Annual Tuition (Customized)');
  });

  it('does NOT overwrite a custom (isDefault:false) component with the same key', async () => {
    const college = await College.create(collegeInput('SEED4'));
    // College pre-inserted a CUSTOM tuition_fee entry (unusual but allowed).
    await FeeComponentTemplate.create({
      collegeId: college._id,
      componentKey: 'tuition_fee',
      displayLabel: 'Custom Tuition',
      category: 'academic',
      isRefundable: false,
      defaultOneTime: false,
      applicableToYears: [1, 2],
      displayOrder: 99,
      isDefault: false,
    });

    const result = await seedFeeComponentTemplateForCollege(String(college._id));

    const doc = await FeeComponentTemplate.findOne({
      collegeId: college._id,
      componentKey: 'tuition_fee',
    });
    // Unchanged — still the custom one.
    expect(doc?.isDefault).toBe(false);
    expect(doc?.displayLabel).toBe('Custom Tuition');
    expect(doc?.applicableToYears).toEqual([1, 2]);
    expect(doc?.displayOrder).toBe(99);
    // Seed reports a skip for this key.
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('dry-run performs zero DB writes', async () => {
    const college = await College.create(collegeInput('SEED5'));

    const result = await seedFeeComponentTemplateForCollege(String(college._id), {
      dryRun: true,
    });

    const count = await FeeComponentTemplate.countDocuments({ collegeId: college._id });
    expect(count).toBe(0);
    // Planned counts are still reported.
    expect(result.inserted).toBe(CANONICAL_FEE_COMPONENTS.length);
  });

  it('updates canonical-definition fields (category/refundable/one-time/years/order) on re-seed but leaves displayLabel alone', async () => {
    const college = await College.create(collegeInput('SEED6'));
    await seedFeeComponentTemplateForCollege(String(college._id));

    // Simulate a drift: college had edited its local label (kept), and
    // the schema fields on their row are stale relative to the canonical.
    await FeeComponentTemplate.updateOne(
      { collegeId: college._id, componentKey: 'tuition_fee' },
      {
        $set: {
          displayLabel: 'Custom Tuition Label',
          category: 'conditional',         // wrong; canonical is 'academic'
          isRefundable: true,              // wrong
          defaultOneTime: true,            // wrong
          applicableToYears: [9],          // wrong
          displayOrder: 9999,              // wrong
        },
      },
    );

    const result = await seedFeeComponentTemplateForCollege(String(college._id));

    const doc = await FeeComponentTemplate.findOne({
      collegeId: college._id,
      componentKey: 'tuition_fee',
    });
    const canonical = CANONICAL_FEE_COMPONENTS.find((c) => c.componentKey === 'tuition_fee')!;
    expect(doc?.category).toBe(canonical.category);
    expect(doc?.isRefundable).toBe(canonical.isRefundable);
    expect(doc?.defaultOneTime).toBe(canonical.defaultOneTime);
    expect(doc?.applicableToYears).toEqual(canonical.applicableToYears);
    expect(doc?.displayOrder).toBe(canonical.displayOrder);
    // displayLabel preserved.
    expect(doc?.displayLabel).toBe('Custom Tuition Label');
    expect(result.updated).toBeGreaterThanOrEqual(1);
  });

  it('seedAllColleges runs across all colleges and seeds each one', async () => {
    const a = await College.create(collegeInput('ALL1'));
    const b = await College.create(collegeInput('ALL2'));
    const c = await College.create(collegeInput('ALL3'));

    const res = await seedFeeComponentTemplateForAllColleges();

    expect(res.collegesProcessed).toBe(3);
    for (const col of [a, b, c]) {
      const docs = await FeeComponentTemplate.find({ collegeId: col._id });
      expect(docs.length).toBe(CANONICAL_FEE_COMPONENTS.length);
    }
  });

  it('createCollege service hook auto-seeds the new college', async () => {
    const doc = await createCollege(
      {
        name: 'Hook College',
        code: 'hook1',
        address: { line1: 'x', city: 'y', state: 'z', pincode: '500001' },
        contactEmail: 'x@x.com',
        contactPhone: '9999999999',
      },
      'test-user',
    );

    const docs = await FeeComponentTemplate.find({ collegeId: doc._id });
    expect(docs.length).toBe(CANONICAL_FEE_COMPONENTS.length);
  });

  it('createCollege succeeds even if seeding throws (logs warning, does not roll back)', async () => {
    // Force the seeder to throw by short-circuiting the model.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bulkSpy = vi
      .spyOn(FeeComponentTemplate, 'bulkWrite')
      .mockRejectedValueOnce(new Error('boom'));

    const doc = await createCollege(
      {
        name: 'Resilient College',
        code: 'res1',
        address: { line1: 'x', city: 'y', state: 'z', pincode: '500001' },
        contactEmail: 'r@x.com',
        contactPhone: '9999999999',
      },
      'test-user',
    );

    // College is still created.
    const collegeReloaded = await College.findById(doc._id);
    expect(collegeReloaded).not.toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    bulkSpy.mockRestore();
  });

  it('throws/skips gracefully when given an invalid collegeId (no such college)', async () => {
    const bogus = new mongoose.Types.ObjectId();
    // Should not throw — should either skip or just insert under that id
    // cleanly. We want "no crash" semantics so the batch seed across
    // colleges is resilient.
    const result = await seedFeeComponentTemplateForCollege(String(bogus), {
      dryRun: true,
    });
    expect(result).toBeDefined();
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { College, type ICollege } from '../College';
import { setupMongo, teardownMongo, clearCollections } from '../../__tests__/helpers/mongoMemory';

/**
 * Task L1 — College.aiSpendLimits nested field.
 *
 * Covers spec §AC College schema additions and plan §1.4. Pure schema-level
 * assertions — no service layer. Verifies defaults, value preservation,
 * range validation, default population on existing docs, and partial updates
 * via dotted-path findOneAndUpdate.
 */

let codeCounter = 0;
function makeCollege(overrides: Partial<ICollege> = {}): Partial<ICollege> {
  codeCounter += 1;
  return {
    name: 'Test College',
    code: `TST${String(codeCounter).padStart(4, '0')}`,
    contactEmail: 'admin@test-college.dev',
    contactPhone: '+91-9000000000',
    address: {
      line1: '1 Test Road',
      city: 'Test City',
      state: 'Test State',
      pincode: '500001',
    },
    ...overrides,
  };
}

describe('College.aiSpendLimits schema', () => {
  beforeAll(async () => {
    await setupMongo();
  }, 60_000);

  afterAll(async () => {
    await teardownMongo();
  }, 30_000);

  afterEach(async () => {
    await clearCollections();
  });

  // 1. Defaults populated when aiSpendLimits omitted
  it('populates default aiSpendLimits { weeklyInr: 0, alertThresholdPct: 80 } when omitted', async () => {
    const college = await College.create(makeCollege());
    expect(college.aiSpendLimits).toBeDefined();
    expect(college.aiSpendLimits!.weeklyInr).toBe(0);
    expect(college.aiSpendLimits!.alertThresholdPct).toBe(80);
  });

  // 2. Explicit weeklyInr preserved
  it('preserves an explicit aiSpendLimits.weeklyInr=500', async () => {
    const college = await College.create(
      makeCollege({
        aiSpendLimits: { weeklyInr: 500, alertThresholdPct: 80 },
      } as Partial<ICollege>),
    );
    expect(college.aiSpendLimits!.weeklyInr).toBe(500);
    expect(college.aiSpendLimits!.alertThresholdPct).toBe(80);
  });

  // 3. Explicit alertThresholdPct preserved
  it('preserves an explicit aiSpendLimits.alertThresholdPct=70', async () => {
    const college = await College.create(
      makeCollege({
        aiSpendLimits: { weeklyInr: 0, alertThresholdPct: 70 },
      } as Partial<ICollege>),
    );
    expect(college.aiSpendLimits!.weeklyInr).toBe(0);
    expect(college.aiSpendLimits!.alertThresholdPct).toBe(70);
  });

  // 4. Negative weeklyInr rejected
  it('rejects negative weeklyInr', async () => {
    await expect(
      College.create(
        makeCollege({
          aiSpendLimits: { weeklyInr: -1, alertThresholdPct: 80 },
        } as Partial<ICollege>),
      ),
    ).rejects.toThrow();
  });

  // 5. alertThresholdPct=0 rejected (min 1)
  it('rejects alertThresholdPct=0 (min: 1)', async () => {
    await expect(
      College.create(
        makeCollege({
          aiSpendLimits: { weeklyInr: 0, alertThresholdPct: 0 },
        } as Partial<ICollege>),
      ),
    ).rejects.toThrow();
  });

  // 6. alertThresholdPct=101 rejected (max 100)
  it('rejects alertThresholdPct=101 (max: 100)', async () => {
    await expect(
      College.create(
        makeCollege({
          aiSpendLimits: { weeklyInr: 0, alertThresholdPct: 101 },
        } as Partial<ICollege>),
      ),
    ).rejects.toThrow();
  });

  // 7. Existing College document without the field reads with defaults populated.
  // Simulate "old" data by writing a document via the raw collection (no schema
  // path applied), then re-fetching through Mongoose to confirm defaults appear.
  it('populates defaults on read for documents written without the field', async () => {
    const conn = mongoose.connection;
    const db = conn.db;
    if (!db) throw new Error('Mongo connection not ready');

    const rawDoc = {
      name: 'Legacy College',
      code: 'LEG0001',
      contactEmail: 'legacy@college.dev',
      contactPhone: '+91-9000000001',
      address: {
        line1: '1 Legacy Road',
        city: 'Legacy City',
        state: 'Legacy State',
        pincode: '500001',
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const insertResult = await db.collection('colleges').insertOne(rawDoc);

    const fetched = await College.findById(insertResult.insertedId);
    expect(fetched).toBeTruthy();
    expect(fetched!.aiSpendLimits).toBeDefined();
    expect(fetched!.aiSpendLimits!.weeklyInr).toBe(0);
    expect(fetched!.aiSpendLimits!.alertThresholdPct).toBe(80);
  });

  // 8. findOneAndUpdate of dotted-path weeklyInr leaves alertThresholdPct unchanged
  it('updates only aiSpendLimits.weeklyInr via dotted-path; alertThresholdPct unchanged', async () => {
    const college = await College.create(
      makeCollege({
        aiSpendLimits: { weeklyInr: 500, alertThresholdPct: 75 },
      } as Partial<ICollege>),
    );

    const updated = await College.findOneAndUpdate(
      { _id: college._id },
      { $set: { 'aiSpendLimits.weeklyInr': 1000 } },
      { new: true },
    );
    expect(updated).toBeTruthy();
    expect(updated!.aiSpendLimits!.weeklyInr).toBe(1000);
    expect(updated!.aiSpendLimits!.alertThresholdPct).toBe(75);
  });

  // 9. findOneAndUpdate of dotted-path alertThresholdPct leaves weeklyInr unchanged
  it('updates only aiSpendLimits.alertThresholdPct via dotted-path; weeklyInr unchanged', async () => {
    const college = await College.create(
      makeCollege({
        aiSpendLimits: { weeklyInr: 250, alertThresholdPct: 80 },
      } as Partial<ICollege>),
    );

    const updated = await College.findOneAndUpdate(
      { _id: college._id },
      { $set: { 'aiSpendLimits.alertThresholdPct': 60 } },
      { new: true },
    );
    expect(updated).toBeTruthy();
    expect(updated!.aiSpendLimits!.weeklyInr).toBe(250);
    expect(updated!.aiSpendLimits!.alertThresholdPct).toBe(60);
  });
});

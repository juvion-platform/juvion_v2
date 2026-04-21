import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { Student } from '../people/Student';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

/**
 * Task 21 — Student.studyYearAtAdmission schema field for lateral-entry
 * support. Pure schema-level assertions (no service layer). See spec
 * §Journey 2 + T20 completion Gap-1.
 *
 * Invariants the field must honour:
 *   - optional (existing students without it remain valid)
 *   - default = 1 when omitted
 *   - integer bounds [1, 8]
 */

const oid = () => new mongoose.Types.ObjectId();

describe('Student.studyYearAtAdmission schema field', () => {
  beforeAll(async () => {
    await setupMongo();
    await Student.syncIndexes();
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
  });

  // ── 1 ──────────────────────────────────────────────────────────────
  it('accepts a lateral-entry student with studyYearAtAdmission = 2', async () => {
    const s = await Student.create({
      collegeId: oid(),
      personId: oid(),
      admissionYear: 2023,
      studyYearAtAdmission: 2,
      status: 'active',
    });
    expect(s.studyYearAtAdmission).toBe(2);
    const reloaded = await Student.findById(s._id).lean();
    expect(reloaded?.studyYearAtAdmission).toBe(2);
  });

  // ── 2 ──────────────────────────────────────────────────────────────
  it('defaults studyYearAtAdmission to 1 when omitted', async () => {
    const s = await Student.create({
      collegeId: oid(),
      personId: oid(),
      admissionYear: 2024,
      status: 'active',
    });
    expect(s.studyYearAtAdmission).toBe(1);
    const reloaded = await Student.findById(s._id).lean();
    expect(reloaded?.studyYearAtAdmission).toBe(1);
  });

  // ── 3 ──────────────────────────────────────────────────────────────
  it('rejects invalid values (0, 9, -1, non-numeric)', async () => {
    // 0 → below min
    await expect(
      Student.create({
        collegeId: oid(),
        personId: oid(),
        admissionYear: 2024,
        studyYearAtAdmission: 0,
        status: 'active',
      }),
    ).rejects.toThrow();

    // 9 → above max
    await expect(
      Student.create({
        collegeId: oid(),
        personId: oid(),
        admissionYear: 2024,
        studyYearAtAdmission: 9,
        status: 'active',
      }),
    ).rejects.toThrow();

    // -1 → below min
    await expect(
      Student.create({
        collegeId: oid(),
        personId: oid(),
        admissionYear: 2024,
        studyYearAtAdmission: -1,
        status: 'active',
      }),
    ).rejects.toThrow();

    // non-numeric string coerces to NaN and fails cast
    await expect(
      Student.create({
        collegeId: oid(),
        personId: oid(),
        admissionYear: 2024,
        studyYearAtAdmission: 'abc' as unknown as number,
        status: 'active',
      }),
    ).rejects.toThrow();
  });
});

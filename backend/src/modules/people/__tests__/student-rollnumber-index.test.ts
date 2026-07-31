/**
 * Two students in one college may both lack a roll number.
 *
 * `rollNumber` is optional — admissions allocates it later, and the bulk
 * import does not require the column — but the uniqueness index was declared
 * `{ unique: true, sparse: true }`. On a COMPOUND index `sparse` omits a
 * document only when every indexed field is absent, and `collegeId` never is,
 * so every roll-number-less student was indexed under `{ collegeId, null }`.
 * A college could hold exactly one of them; the second insert died on E11000.
 *
 * That surfaced as an unrelated-looking failure in the phone-normalisation
 * suite, which imports two siblings without roll numbers.
 *
 * The index still has to do its real job, so uniqueness among students that
 * DO have a roll number is asserted here too — and that it is still scoped
 * per college.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Student } from '../../../models/people/Student';

const oid = () => new mongoose.Types.ObjectId();

async function makeStudent(collegeId: mongoose.Types.ObjectId, rollNumber?: string) {
  return Student.create({
    collegeId,
    personId: oid(),
    admissionYear: 2025,
    status: 'active',
    ...(rollNumber ? { rollNumber } : {}),
  });
}

describe('Student (collegeId, rollNumber) uniqueness', () => {
  beforeAll(async () => {
    await setupMongo();
    // The index is what is under test, so build it rather than relying on
    // autoIndex having finished.
    await Student.syncIndexes();
  }, 60_000);
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('allows many students in one college to have no roll number', async () => {
    const collegeId = oid();
    await makeStudent(collegeId);
    await makeStudent(collegeId);
    await makeStudent(collegeId);

    expect(await Student.countDocuments({ collegeId })).toBe(3);
  });

  it('still rejects a duplicate roll number within a college', async () => {
    const collegeId = oid();
    await makeStudent(collegeId, 'R-1');

    await expect(makeStudent(collegeId, 'R-1')).rejects.toThrow(/E11000|duplicate key/i);
  });

  it('lets two colleges use the same roll number', async () => {
    const a = oid();
    const b = oid();
    await makeStudent(a, 'R-1');
    await makeStudent(b, 'R-1');

    expect(await Student.countDocuments({ rollNumber: 'R-1' })).toBe(2);
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { matchExistingStudent, studentNaturalKeys } from '../student-import-match';

const oid = () => new mongoose.Types.ObjectId();
let collegeId: string;

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

async function makeStudent(overrides: Record<string, unknown> = {}) {
  const person = await Person.create({
    collegeId, name: 'Existing Student', phone: '9000000001', ...(overrides.person as object ?? {}),
  });
  delete (overrides as { person?: unknown }).person;
  return Student.create({
    collegeId, personId: person._id, admissionYear: 2025, status: 'active', ...overrides,
  });
}

beforeEach(() => { collegeId = String(oid()); });

describe('matchExistingStudent', () => {
  it('returns create when nothing matches', async () => {
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R1', admissionYear: 2025, phone: '9000000009' });
    expect(res.action).toBe('create');
  });

  it('matches on rollNumber first', async () => {
    const s = await makeStudent({ rollNumber: 'R1' });
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R1' });
    expect(res.action).toBe('update');
    expect(res.studentId).toBe(String(s._id));
  });

  it('falls back to aadhaar when there is no rollNumber', async () => {
    const person = await Person.create({ collegeId, name: 'A', phone: '9000000002', aadhaar: '234567890101' });
    const s = await Student.create({ collegeId, personId: person._id, admissionYear: 2025, status: 'active' });
    const res = await matchExistingStudent(collegeId, { aadhaar: '234567890101' });
    expect(res.action).toBe('update');
    expect(res.studentId).toBe(String(s._id));
  });

  it('falls back to phone + admissionYear last', async () => {
    const s = await makeStudent({});
    const res = await matchExistingStudent(collegeId, { phone: '9000000001', admissionYear: 2025 });
    expect(res.action).toBe('update');
    expect(res.studentId).toBe(String(s._id));
  });

  it('does not match the same phone in a different admission year', async () => {
    await makeStudent({});
    const res = await matchExistingStudent(collegeId, { phone: '9000000001', admissionYear: 2024 });
    expect(res.action).toBe('create');
  });

  it('picks the right sibling when two students share a family phone', async () => {
    // The WRONG student is created first, so a plain Person.findOne (which
    // returns whichever doc sorts first with no explicit sort — typically
    // insertion order) would resolve to them, not the row's actual match.
    // Each sibling gets a distinct rollNumber only so the two Student.create
    // calls don't collide on the (collegeId, rollNumber) unique index — the
    // match row itself carries no rollNumber, so that key is never consulted.
    const wrongPerson = await Person.create({ collegeId, name: 'Older Sibling', phone: '9000000005' });
    const wrongStudent = await Student.create({
      collegeId, personId: wrongPerson._id, admissionYear: 2023, status: 'active', rollNumber: 'SIB-OLD',
    });
    const rightPerson = await Person.create({ collegeId, name: 'Younger Sibling', phone: '9000000005' });
    const rightStudent = await Student.create({
      collegeId, personId: rightPerson._id, admissionYear: 2025, status: 'active', rollNumber: 'SIB-NEW',
    });

    const res = await matchExistingStudent(collegeId, { phone: '9000000005', admissionYear: 2025 });
    expect(res.action).toBe('update');
    expect(res.studentId).toBe(String(rightStudent._id));
    expect(res.studentId).not.toBe(String(wrongStudent._id));
  });

  it('never matches across colleges', async () => {
    await makeStudent({ rollNumber: 'R1' });
    const res = await matchExistingStudent(String(oid()), { rollNumber: 'R1' });
    expect(res.action).toBe('create');
  });

  it('blocks a sealed student', async () => {
    await makeStudent({ rollNumber: 'R1', isSealed: true });
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R1' });
    expect(res.action).toBe('blocked');
    expect(res.reason).toMatch(/sealed/i);
  });

  it('blocks an exited student', async () => {
    await makeStudent({ rollNumber: 'R2', status: 'exited' });
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R2' });
    expect(res.action).toBe('blocked');
  });

  it('blocks an alumni student', async () => {
    await makeStudent({ rollNumber: 'R3', status: 'alumni' });
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R3' });
    expect(res.action).toBe('blocked');
  });

  it('carries the matched student\'s fee axes so the caller need not re-read', async () => {
    const programmeId = oid();
    const branchId = oid();
    const s = await makeStudent({
      rollNumber: 'R4', programmeId, branchId, quota: 'convener', category: 'OC',
    });
    const res = await matchExistingStudent(collegeId, { rollNumber: 'R4' });
    expect(res.action).toBe('update');
    expect(res.studentId).toBe(String(s._id));
    expect(res.existing).toEqual({
      programmeId: String(programmeId),
      branchId: String(branchId),
      quota: 'convener',
      category: 'OC',
    });
  });
});

/**
 * The key set the engine uses to detect two rows in ONE uploaded file
 * claiming the same identity (final review, Critical 2). It must stay in
 * lockstep with matchExistingStudent above — which is why it lives here.
 */
describe('studentNaturalKeys', () => {
  it('emits every key the row presents, in matcher precedence order', () => {
    expect(studentNaturalKeys({
      rollNumber: 'CS2025-014', aadhaar: '234567890101', phone: '9876543210', admissionYear: 2025,
    })).toEqual([
      { label: 'rollNumber', value: 'CS2025-014' },
      { label: 'aadhaar', value: '234567890101' },
      { label: 'phone + admissionYear', value: '9876543210 / 2025' },
    ]);
  });

  it('emits nothing for a row carrying none of the keys', () => {
    expect(studentNaturalKeys({ name: 'Aarav' })).toEqual([]);
  });

  it('needs BOTH halves of the weakest key', () => {
    expect(studentNaturalKeys({ phone: '9876543210' })).toEqual([]);
    expect(studentNaturalKeys({ admissionYear: 2025 })).toEqual([]);
  });

  it('emits the lower-precedence keys even when a rollNumber is present', () => {
    // matchExistingStudent falls THROUGH: a row whose rollNumber does not
    // match still gets tried on aadhaar and phone+admissionYear. So a second
    // row with a fresh rollNumber but a repeated phone+admissionYear would
    // still hit the first row's student at commit — it has to be a collision.
    expect(studentNaturalKeys({ rollNumber: 'R1', phone: '9876543210', admissionYear: 2025 }))
      .toEqual([
        { label: 'rollNumber', value: 'R1' },
        { label: 'phone + admissionYear', value: '9876543210 / 2025' },
      ]);
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { matchExistingStudent } from '../student-import-match';

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
});

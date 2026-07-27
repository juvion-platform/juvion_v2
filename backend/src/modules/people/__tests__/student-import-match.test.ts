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

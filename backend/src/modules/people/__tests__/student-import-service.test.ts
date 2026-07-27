import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Parent } from '../../../models/people/Parent';
import { Programme } from '../../../models/academic-structure/Programme';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { FeeCategory } from '../../../models/finance/FeeCategory';
import { commitStudentRow } from '../student-import-service';

const oid = () => new mongoose.Types.ObjectId();
let collegeId: string;
const ctx = () => ({ collegeId, performedBy: 'tester' });

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); vi.restoreAllMocks(); });

beforeEach(async () => {
  collegeId = String(oid());
  const regulationId = oid();
  await Regulation.create({
    _id: regulationId, collegeId, code: 'R20', name: 'R20', effectiveFromYear: 2020,
    totalCredits: 160, maxYears: 4,
  });
  await Programme.create({ collegeId, code: 'BTCSE', name: 'BTech CSE', level: 'UG', durationYears: 4, regulationId });
  // The 'update' and 'blocked' tests set category: 'OC' on the row;
  // validateCatalogCodes (student-import-refs.ts) rejects any category
  // code not present in this catalog, so it must exist for those rows.
  await FeeCategory.create({ collegeId, code: 'OC', name: 'Open Category' });
});

const baseRow = () => ({
  name: 'Aarav Sharma', phone: '9876543210', programmeCode: 'BTCSE', admissionYear: 2025,
});

describe('commitStudentRow — create', () => {
  it('creates Person + Student and returns the student id', async () => {
    const { id } = await commitStudentRow(baseRow(), ctx());
    const student = await Student.findById(id);
    expect(student).not.toBeNull();
    expect(await Person.countDocuments({ collegeId })).toBe(1);
  });

  it('defaults status to active, not the model default of prospective', async () => {
    const { id } = await commitStudentRow(baseRow(), ctx());
    expect((await Student.findById(id))!.status).toBe('active');
  });

  it('fails the row when the programme code is unknown', async () => {
    await expect(
      commitStudentRow({ ...baseRow(), programmeCode: 'NOPE' }, ctx()),
    ).rejects.toThrow(/unknown programme code "NOPE"/);
  });
});

describe('commitStudentRow — parents', () => {
  it('creates a Parent when the phone is unknown', async () => {
    await commitStudentRow(
      { ...baseRow(), primaryParentPhone: '9111111111', primaryParentName: 'Ramesh Sharma' },
      ctx(),
    );
    expect(await Parent.countDocuments({ collegeId })).toBe(1);
  });

  it('links an existing Parent instead of creating a second', async () => {
    const parentPerson = await Person.create({ collegeId, name: 'Ramesh', phone: '9111111111' });
    await Parent.create({ collegeId, personId: parentPerson._id, relationship: 'guardian' });
    await commitStudentRow({ ...baseRow(), primaryParentPhone: '9111111111' }, ctx());
    expect(await Parent.countDocuments({ collegeId })).toBe(1);
  });
});

describe('commitStudentRow — guardian override (owner-approved: never self-guardian)', () => {
  it('does not turn the student into their own guardian on re-import when phones match', async () => {
    // First import: student created with no guardian info at all.
    const first = await commitStudentRow({ ...baseRow(), rollNumber: 'R1' }, ctx());

    // Re-import of the same row, but now a primaryParentPhone is supplied
    // and it happens to be the SAME number as the student's own phone —
    // the realistic Indian-intake case where the family shares one phone.
    const second = await commitStudentRow(
      {
        ...baseRow(),
        rollNumber: 'R1',
        primaryParentPhone: baseRow().phone,
        primaryParentName: 'Ramesh Sharma',
      },
      ctx(),
    );
    expect(second.id).toBe(first.id);

    const student = await Student.findById(second.id);
    expect(student!.primaryParentId).toBeDefined();

    const guardianParent = await Parent.findOne({ collegeId, _id: student!.primaryParentId });
    expect(guardianParent).not.toBeNull();
    // The guardian's Person must be a DIFFERENT document than the student's
    // own Person — the student must never be recorded as their own guardian.
    expect(String(guardianParent!.personId)).not.toBe(String(student!.personId));

    // A distinct guardian Person was created (student's own Person + a new
    // guardian Person == 2), not reused from the student's record.
    expect(await Person.countDocuments({ collegeId })).toBe(2);
    expect(await Parent.countDocuments({ collegeId })).toBe(1);
  });
});

describe('parentExistsByPhone', () => {
  it('is false when no parent has that phone', async () => {
    const { parentExistsByPhone } = await import('../student-import-service');
    expect(await parentExistsByPhone(collegeId, '9111111111')).toBe(false);
  });

  it('is true for an existing parent, and writes nothing', async () => {
    const { parentExistsByPhone } = await import('../student-import-service');
    const p = await Person.create({ collegeId, name: 'R', phone: '9111111111' });
    await Parent.create({ collegeId, personId: p._id, relationship: 'guardian' });
    expect(await parentExistsByPhone(collegeId, '9111111111')).toBe(true);
    expect(await Parent.countDocuments({ collegeId })).toBe(1);
  });

  it('is false when the only Person on that phone is a student with no Parent record, agreeing with commit', async () => {
    // The student's own Person occupies this phone number; no guardian
    // has ever been linked to it. Preview must not falsely report an
    // existing guardian for a phone that only resolves to the student.
    await commitStudentRow({ ...baseRow(), rollNumber: 'R2' }, ctx());
    const { parentExistsByPhone } = await import('../student-import-service');
    expect(await parentExistsByPhone(collegeId, baseRow().phone)).toBe(false);
  });
});

describe('commitStudentRow — update', () => {
  it('updates the matched student rather than creating a duplicate', async () => {
    const first = await commitStudentRow({ ...baseRow(), rollNumber: 'R1' }, ctx());
    const second = await commitStudentRow({ ...baseRow(), rollNumber: 'R1', category: 'OC' }, ctx());
    expect(second.id).toBe(first.id);
    expect(await Student.countDocuments({ collegeId })).toBe(1);
  });
});

describe('commitStudentRow — blocked', () => {
  it('refuses to write a sealed student', async () => {
    const { id } = await commitStudentRow({ ...baseRow(), rollNumber: 'R1' }, ctx());
    await Student.findByIdAndUpdate(id, { isSealed: true });
    await expect(
      commitStudentRow({ ...baseRow(), rollNumber: 'R1', category: 'OC' }, ctx()),
    ).rejects.toThrow(/sealed/i);
    expect((await Student.findById(id))!.category).toBeUndefined();
  });
});

describe('commitStudentRow — compensating rollback', () => {
  it('leaves no orphan Person when the Student write fails', async () => {
    // Force the Student create to fail AFTER the Person is written. This is
    // the realistic partial-write: a duplicate rollNumber surfacing at the
    // final insert. Without rollback the Person survives as an orphan.
    vi.spyOn(Student, 'create').mockRejectedValueOnce(new Error('E11000 duplicate key'));

    await expect(commitStudentRow(baseRow(), ctx())).rejects.toThrow(/duplicate key/);
    expect(await Person.countDocuments({ collegeId })).toBe(0);
  });

  it('removes a parent created earlier in the same failed row', async () => {
    vi.spyOn(Student, 'create').mockRejectedValueOnce(new Error('boom'));

    await expect(
      commitStudentRow(
        { ...baseRow(), primaryParentPhone: '9111111111', primaryParentName: 'Ramesh' },
        ctx(),
      ),
    ).rejects.toThrow(/boom/);

    expect(await Parent.countDocuments({ collegeId })).toBe(0);
    expect(await Person.countDocuments({ collegeId })).toBe(0);
  });

  it('does NOT delete a pre-existing parent that was merely linked', async () => {
    const parentPerson = await Person.create({ collegeId, name: 'Ramesh', phone: '9111111111' });
    await Parent.create({ collegeId, personId: parentPerson._id, relationship: 'guardian' });
    vi.spyOn(Student, 'create').mockRejectedValueOnce(new Error('boom'));

    await expect(
      commitStudentRow({ ...baseRow(), primaryParentPhone: '9111111111' }, ctx()),
    ).rejects.toThrow(/boom/);

    // Rollback must only undo what THIS row created.
    expect(await Parent.countDocuments({ collegeId })).toBe(1);
    expect(await Person.countDocuments({ collegeId })).toBe(1);
  });
});

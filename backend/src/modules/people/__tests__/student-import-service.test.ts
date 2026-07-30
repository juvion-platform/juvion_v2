import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Parent } from '../../../models/people/Parent';
import { Programme } from '../../../models/academic-structure/Programme';
import { Branch } from '../../../models/academic-structure/Branch';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { FeeCategory } from '../../../models/finance/FeeCategory';
import { FeeQuota } from '../../../models/finance/FeeQuota';
import * as auditModule from '../../../shared/audit';
import { AuditLog } from '../../../shared/audit';
import { commitStudentRow } from '../student-import-service';

const oid = () => new mongoose.Types.ObjectId();
let collegeId: string;
// No academicYearId: these cover the Person/Parent/Student writes, and
// without one every row skips pinning, so the pre-pin behaviour is unchanged.
const ctx = () => ({ collegeId, performedBy: 'tester', jobId: 'test-job' });

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

  // onboardingStatus is no longer an importable column. Writing it here
  // bypassed assertStudentOnboardingRules (people/service.ts) — a
  // spreadsheet could mark a student's onboarding complete with no
  // fee-responsible guardian, an empty checklist and no
  // onboardingCompletedAt. The allow-list in studentFieldsFromRow is the
  // second line of defence: even a row that carries the key must not
  // write it.
  it('ignores an onboardingStatus value even if a row somehow carries one', async () => {
    const { id } = await commitStudentRow(
      { ...baseRow(), onboardingStatus: 'completed' },
      ctx(),
    );
    const student = await Student.findById(id);
    expect(student!.onboardingStatus).toBe('not_started');
    expect(student!.onboardingCompletedAt).toBeUndefined();
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

/**
 * Final review, Important 2. The manual path calls syncStudentParentLinks
 * (people/service.ts:152, invoked at :334 on create and :480 on update) to
 * $addToSet the student onto each parent. The import set
 * Student.primaryParentId / feeResponsibleParentId and stopped, so
 * Parent.linkedStudents stayed empty: people/search-service.ts:378 populates
 * it to render a parent's children, and profileCompleteness.ts:120 scores
 * "Linked students". Every guardian created by an import read as childless
 * and incomplete.
 */
describe('commitStudentRow — Parent.linkedStudents', () => {
  it('links the student onto a newly created guardian', async () => {
    const { id } = await commitStudentRow(
      { ...baseRow(), primaryParentPhone: '9111111111', primaryParentName: 'Ramesh Sharma' },
      ctx(),
    );
    const parent = await Parent.findOne({ collegeId });
    expect(parent!.linkedStudents.map(String)).toEqual([id]);
  });

  it('links the student onto an existing guardian that was merely matched', async () => {
    const parentPerson = await Person.create({ collegeId, name: 'Ramesh', phone: '9111111111' });
    await Parent.create({ collegeId, personId: parentPerson._id, relationship: 'guardian' });

    const { id } = await commitStudentRow(
      { ...baseRow(), primaryParentPhone: '9111111111' }, ctx(),
    );
    const parent = await Parent.findOne({ collegeId });
    expect(parent!.linkedStudents.map(String)).toEqual([id]);
  });

  it('links both guardians once when the two phone columns differ', async () => {
    const { id } = await commitStudentRow(
      {
        ...baseRow(),
        primaryParentPhone: '9111111111',
        feeResponsibleParentPhone: '9222222222',
      },
      ctx(),
    );
    const parents = await Parent.find({ collegeId }).sort({ createdAt: 1 });
    expect(parents).toHaveLength(2);
    for (const p of parents) expect(p.linkedStudents.map(String)).toEqual([id]);
  });

  it('moves the link when a re-import replaces the guardian', async () => {
    const { id } = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', primaryParentPhone: '9111111111' }, ctx(),
    );
    const oldParent = await Parent.findOne({ collegeId });
    expect(oldParent!.linkedStudents.map(String)).toEqual([id]);

    await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', primaryParentPhone: '9333333333' }, ctx(),
    );

    const oldAfter = await Parent.findById(oldParent!._id);
    expect(oldAfter!.linkedStudents.map(String)).toEqual([]);
    const newParent = await Parent.findOne({ collegeId, _id: { $ne: oldParent!._id } });
    expect(newParent!.linkedStudents.map(String)).toEqual([id]);
  });

  it('does not double-link on an unchanged re-import', async () => {
    const { id } = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', primaryParentPhone: '9111111111' }, ctx(),
    );
    await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', primaryParentPhone: '9111111111', email: 'x@y.test' },
      ctx(),
    );
    const parent = await Parent.findOne({ collegeId });
    expect(parent!.linkedStudents.map(String)).toEqual([id]);
  });

  it('rolls the link back when a later write in the same row fails', async () => {
    // A pre-existing guardian, so rollback cannot simply delete the Parent —
    // the link itself has to be undone.
    const parentPerson = await Person.create({ collegeId, name: 'Ramesh', phone: '9111111111' });
    const parent = await Parent.create({
      collegeId, personId: parentPerson._id, relationship: 'guardian',
    });

    // Fail the audit write, which happens AFTER the parent links are synced.
    vi.spyOn(auditModule, 'createAuditLog').mockRejectedValueOnce(new Error('audit exploded'));

    await expect(
      commitStudentRow({ ...baseRow(), primaryParentPhone: '9111111111' }, ctx()),
    ).rejects.toThrow(/audit exploded/);

    const parentAfter = await Parent.findById(parent._id);
    expect(parentAfter!.linkedStudents.map(String)).toEqual([]);
    expect(await Student.countDocuments({ collegeId })).toBe(0);
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

  /**
   * Several non-student, non-faculty Persons can legitimately share a phone
   * (an uncle and a grandmother on the household landline). The guardian
   * picked among them must be the same on every run — otherwise two
   * identical imports attach different guardians, and the divergence only
   * surfaces much later as a mismatched fee-responsible parent.
   *
   * HONEST CAVEAT: this is a guard, not a regression test. It was verified to
   * pass with the `.sort({ _id: 1 })` removed, because mongodb-memory-server
   * returns documents in insertion order anyway, so the unsorted read already
   * yields the oldest Person. Real MongoDB makes no such guarantee — natural
   * order can change after a document move or with a different plan — so the
   * sort is load-bearing in production and untestable here. Do not delete the
   * sort on the strength of this test still passing.
   */
  it('picks the same guardian every time when several eligible Persons share a phone', async () => {
    const shared = '9333300001';
    // Created oldest-first; _id is monotonic, so `oldest` must always win.
    const oldest = await Person.create({ collegeId, name: 'Grandmother', phone: shared });
    await Person.create({ collegeId, name: 'Uncle', phone: shared });
    await Person.create({ collegeId, name: 'Aunt', phone: shared });

    const picked: string[] = [];
    for (const roll of ['DET-1', 'DET-2', 'DET-3']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await commitStudentRow(
        {
          ...baseRow(),
          rollNumber: roll,
          phone: `98765${roll.slice(-1)}0000`,
          primaryParentPhone: shared,
        },
        ctx(),
      );
      // eslint-disable-next-line no-await-in-loop
      const student = await Student.findById(res.id);
      // eslint-disable-next-line no-await-in-loop
      const parent = await Parent.findOne({ collegeId, _id: student!.primaryParentId });
      picked.push(String(parent!.personId));
    }

    expect(new Set(picked).size).toBe(1);
    expect(picked[0]).toBe(String(oldest._id));
    // One guardian Parent reused across all three, not three created.
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

  // Two-Person variant that actually distinguishes "search for an existing
  // Parent across every matching Person" from "exclude Student/Faculty
  // Persons FIRST, then search among what's left". A single matching
  // Person can never tell these apart (there's no ambiguity to resolve).
  it('ignores a legacy self-guardian Parent on a Student and still agrees with what commit would do', async () => {
    const { id } = await commitStudentRow({ ...baseRow(), rollNumber: 'R3' }, ctx());
    const student = await Student.findById(id);

    // Simulate data corrupted by the pre-override code path: a Parent
    // record wrongly attached directly to the student's OWN Person.
    await Parent.create({ collegeId, personId: student!.personId, relationship: 'guardian' });

    // A second, unrelated Person shares the same phone (the realistic
    // shared-family-number case) and is not a Student or Faculty member.
    await Person.create({ collegeId, name: 'Family Member', phone: baseRow().phone });

    const { parentExistsByPhone } = await import('../student-import-service');
    // The corrupted self-guardian Parent must not count: commit's
    // linkOrCreateParent would ignore it too (it excludes Student Persons
    // before searching for an existing Parent) and would create a FRESH
    // guardian attached to the eligible non-student Person instead.
    expect(await parentExistsByPhone(collegeId, baseRow().phone)).toBe(false);
  });
});

describe('commitStudentRow — update', () => {
  // The "something changed" marker on these re-imports is deliberately a
  // NON-fee-axis column (email). quota/category/branch/programme changes on a
  // matched student are Blocked by owner ruling A — see the fee-axis suite.
  it('updates the matched student rather than creating a duplicate', async () => {
    const first = await commitStudentRow({ ...baseRow(), rollNumber: 'R1' }, ctx());
    const second = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', email: 'aarav@example.com' }, ctx(),
    );
    expect(second.id).toBe(first.id);
    expect(await Student.countDocuments({ collegeId })).toBe(1);
  });

  // Spec: "match found; the row's supplied fields are applied." A column
  // the re-import omits must never overwrite a value already on file.
  it('does not wipe a stored address when the re-import row omits address columns', async () => {
    const first = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', addressLine1: 'MG Road', city: 'Pune', state: 'MH', pincode: '411001' },
      ctx(),
    );
    const studentBefore = await Student.findById(first.id);
    const personBefore = await Person.findById(studentBefore!.personId);
    expect(personBefore!.address.line1).toBe('MG Road');

    // Re-import carries no address columns at all — only email changed.
    const second = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', email: 'aarav@example.com' }, ctx(),
    );
    expect(second.id).toBe(first.id);

    const personAfter = await Person.findById(studentBefore!.personId);
    expect(personAfter!.address.line1).toBe('MG Road');
    expect(personAfter!.address.city).toBe('Pune');
    expect(personAfter!.address.state).toBe('MH');
    expect(personAfter!.address.pincode).toBe('411001');
  });

  // The mirror image of the test above, and the one the branch was missing:
  // "supplied fields only" is one edit away from becoming "never written",
  // and every other update test asserts a value did NOT change. Without this
  // the update branch could regress to a no-op with the suite still green.
  it('DOES write address, status and identity columns when the re-import row supplies them', async () => {
    const first = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', addressLine1: 'Old House', city: 'Pune' },
      ctx(),
    );
    const studentBefore = await Student.findById(first.id);
    expect(studentBefore!.status).toBe('active');

    const second = await commitStudentRow(
      {
        ...baseRow(),
        rollNumber: 'R1',
        name: 'Aarav Kumar Sharma',
        email: 'aarav.new@example.com',
        gender: 'male',
        addressLine1: 'New House',
        addressLine2: 'Flat 4',
        city: 'Bengaluru',
        state: 'KA',
        pincode: '560001',
        status: 'prospective',
        studyYearAtAdmission: 2,
      },
      ctx(),
    );
    expect(second.id).toBe(first.id);

    const personAfter = await Person.findById(studentBefore!.personId);
    expect(personAfter!.name).toBe('Aarav Kumar Sharma');
    expect(personAfter!.email).toBe('aarav.new@example.com');
    expect(personAfter!.gender).toBe('male');
    expect(personAfter!.address.line1).toBe('New House');
    expect(personAfter!.address.line2).toBe('Flat 4');
    expect(personAfter!.address.city).toBe('Bengaluru');
    expect(personAfter!.address.state).toBe('KA');
    expect(personAfter!.address.pincode).toBe('560001');

    const studentAfter = await Student.findById(second.id);
    expect(studentAfter!.status).toBe('prospective');
    expect(studentAfter!.studyYearAtAdmission).toBe(2);
  });

  // year_back/withdrawn/expelled/deceased are not in BLOCKED_STATUSES, so a
  // naive unconditional `status: cell(...) || 'active'` on update silently
  // reactivates them on every re-import that doesn't carry a status column.
  // That default is spec'd for CREATE only ("an imported student is
  // normally already admitted").
  it('does not reset a non-blocked lifecycle status back to active on re-import', async () => {
    const first = await commitStudentRow({ ...baseRow(), rollNumber: 'R1' }, ctx());
    await Student.findByIdAndUpdate(first.id, { status: 'year_back' });

    const second = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', email: 'aarav@example.com' }, ctx(),
    );
    expect(second.id).toBe(first.id);

    expect((await Student.findById(second.id))!.status).toBe('year_back');
  });
});

/**
 * Owner ruling A. programmeCode is mandatory on every row, so before this
 * guard a re-import `$set` programmeId straight onto the matched student —
 * an unguarded programme transfer that bypasses the 403 in
 * people/service.ts:437 ("use the programme-transfer endpoint to ensure fee
 * pins are rebound atomically") and leaves Student.feePins bound to the OLD
 * programme's FeeStructureInstance. branchId / quota / category are fee axes
 * too (CLAUDE.md, Fee-Pin Pipeline): people/service.ts:499 either auto-rebinds
 * or marks the pin stale when they change; the import did neither.
 *
 * Import stays out of the fee-pin business entirely: the row is Blocked at
 * preview and nothing is written.
 */
describe('commitStudentRow — fee-axis changes on an existing student are blocked', () => {
  async function seedSecondProgramme() {
    const regulationId = oid();
    await Regulation.create({
      _id: regulationId, collegeId, code: 'R21', name: 'R21', effectiveFromYear: 2021,
      totalCredits: 80, maxYears: 2,
    });
    await Programme.create({
      collegeId, code: 'MTECH', name: 'MTech CSE', level: 'PG', durationYears: 2, regulationId,
    });
  }

  it('refuses a programme change and names the transfer workflow', async () => {
    const first = await commitStudentRow({ ...baseRow(), rollNumber: 'R1' }, ctx());
    const programmeBefore = (await Student.findById(first.id))!.programmeId;
    await seedSecondProgramme();

    await expect(
      commitStudentRow({ ...baseRow(), rollNumber: 'R1', programmeCode: 'MTECH' }, ctx()),
    ).rejects.toThrow(/programme change is not allowed on import/i);

    const after = await Student.findById(first.id);
    expect(String(after!.programmeId)).toBe(String(programmeBefore));
  });

  it('refuses a branch change', async () => {
    const programme = await Programme.findOne({ collegeId, code: 'BTCSE' });
    await Branch.create({
      collegeId, code: 'CSE', name: 'Computer Science',
      programmeId: programme!._id, departmentId: oid(), intake: 60,
    });
    await Branch.create({
      collegeId, code: 'ECE', name: 'Electronics',
      programmeId: programme!._id, departmentId: oid(), intake: 60,
    });

    const first = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', branchCode: 'CSE' }, ctx(),
    );
    const branchBefore = (await Student.findById(first.id))!.branchId;

    await expect(
      commitStudentRow({ ...baseRow(), rollNumber: 'R1', branchCode: 'ECE' }, ctx()),
    ).rejects.toThrow(/branch change is not allowed on import/i);

    expect(String((await Student.findById(first.id))!.branchId)).toBe(String(branchBefore));
  });

  it('refuses a quota change', async () => {
    await FeeQuota.create({ collegeId, code: 'convener', name: 'Convener', status: 'active' });
    await FeeQuota.create({ collegeId, code: 'management', name: 'Management', status: 'active' });

    const first = await commitStudentRow({ ...baseRow(), rollNumber: 'R1', quota: 'convener' }, ctx());
    await expect(
      commitStudentRow({ ...baseRow(), rollNumber: 'R1', quota: 'management' }, ctx()),
    ).rejects.toThrow(/quota change is not allowed on import/i);
    expect((await Student.findById(first.id))!.quota).toBe('convener');
  });

  it('refuses a category change', async () => {
    await FeeCategory.create({ collegeId, code: 'BC', name: 'Backward Class' });
    const first = await commitStudentRow({ ...baseRow(), rollNumber: 'R1', category: 'OC' }, ctx());
    await expect(
      commitStudentRow({ ...baseRow(), rollNumber: 'R1', category: 'BC' }, ctx()),
    ).rejects.toThrow(/category change is not allowed on import/i);
    expect((await Student.findById(first.id))!.category).toBe('OC');
  });

  it('still allows a re-import that repeats the same axes unchanged', async () => {
    await FeeQuota.create({ collegeId, code: 'convener', name: 'Convener', status: 'active' });
    const first = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', quota: 'convener', category: 'OC' }, ctx(),
    );
    const second = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', quota: 'convener', category: 'OC', email: 'new@example.com' },
      ctx(),
    );
    expect(second.id).toBe(first.id);
    const student = await Student.findById(second.id);
    expect((await Person.findById(student!.personId))!.email).toBe('new@example.com');
  });

  it('does not block a row that simply omits the optional axis columns', async () => {
    await FeeQuota.create({ collegeId, code: 'convener', name: 'Convener', status: 'active' });
    const first = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', quota: 'convener', category: 'OC' }, ctx(),
    );
    const second = await commitStudentRow({ ...baseRow(), rollNumber: 'R1' }, ctx());
    expect(second.id).toBe(first.id);
    const student = await Student.findById(second.id);
    expect(student!.quota).toBe('convener');
    expect(student!.category).toBe('OC');
  });
});

describe('commitStudentRow — update rollback', () => {
  it('restores the Person to its prior values when the Student update fails', async () => {
    const first = await commitStudentRow(
      { ...baseRow(), rollNumber: 'R1', email: 'aarav@example.com', addressLine1: 'Old House', city: 'Hyderabad' },
      ctx(),
    );
    const studentBefore = await Student.findById(first.id);
    const personId = studentBefore!.personId;

    vi.spyOn(Student, 'updateOne').mockRejectedValueOnce(new Error('E11000 duplicate key'));

    await expect(
      commitStudentRow(
        {
          ...baseRow(), rollNumber: 'R1', email: 'changed@example.com',
          addressLine1: 'New House', city: 'Bengaluru', status: 'prospective',
        },
        ctx(),
      ),
    ).rejects.toThrow(/duplicate key/);

    // The Person write that happened BEFORE the failing Student write must
    // be rolled back to its pre-update values — not left half-applied.
    const personAfter = await Person.findById(personId);
    expect(personAfter!.email).toBe('aarav@example.com');
    expect(personAfter!.address.line1).toBe('Old House');
    expect(personAfter!.address.city).toBe('Hyderabad');

    // And the Student itself must be untouched by the failed update.
    const studentAfter = await Student.findById(first.id);
    expect(studentAfter!.status).toBe('active');
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

/**
 * Audit `changes[]` on the update path.
 *
 * The import wrote `changes: []`, recording THAT a student changed but never
 * WHAT — which is precisely why the address-wipe and status-flip defects found
 * in review were invisible after the fact and only caught by reading the diff.
 * The house convention is an empty array (837 call sites), so this is not a
 * codebase-wide change; it is this feature using a mechanism the audit schema
 * already defines for it. `FieldChange.source` documents `'import'` as
 * "value came from a bulk import", and until now nothing in production emitted
 * it — bulk import is its intended and only consumer.
 *
 * A bulk import is exactly where this matters: one operator action rewrites
 * hundreds of records, so "what changed" cannot be reconstructed from context.
 */
describe('commitStudentRow — the update audit records what actually changed', () => {
  async function auditFor(studentId: string, action: 'create' | 'update') {
    return AuditLog.findOne({ collegeId, entityType: 'Student', entityId: studentId, action }).lean();
  }

  it('names each changed field with its old and new value, tagged as an import', async () => {
    const first = await commitStudentRow(
      { ...baseRow(), rollNumber: 'AUD-1', city: 'Hyderabad' },
      ctx(),
    );

    await commitStudentRow(
      { ...baseRow(), rollNumber: 'AUD-1', city: 'Warangal', email: 'aarav@example.com' },
      ctx(),
    );

    const log = await auditFor(first.id, 'update');
    expect(log).not.toBeNull();
    const byField = new Map(log!.changes.map((c) => [c.field, c]));

    // The city moved: both ends recorded.
    expect(byField.get('address.city')).toMatchObject({
      oldValue: 'Hyderabad', newValue: 'Warangal', source: 'import',
    });
    // Email was absent before, so oldValue is null rather than missing.
    expect(byField.get('email')).toMatchObject({
      oldValue: null, newValue: 'aarav@example.com', source: 'import',
    });
    // Every entry carries a human-readable label for the audit UI.
    for (const c of log!.changes) {
      expect(c.displayName, `displayName for ${c.field}`).toBeTruthy();
    }
  });

  it('omits fields the row supplied but did not actually change', async () => {
    const first = await commitStudentRow(
      { ...baseRow(), rollNumber: 'AUD-2', city: 'Hyderabad' },
      ctx(),
    );
    // Byte-identical re-import: nothing moved, so there is nothing to record.
    await commitStudentRow(
      { ...baseRow(), rollNumber: 'AUD-2', city: 'Hyderabad' },
      ctx(),
    );

    const log = await auditFor(first.id, 'update');
    expect(log).not.toBeNull();
    expect(log!.changes.map((c) => c.field)).not.toContain('address.city');
    expect(log!.changes.map((c) => c.field)).not.toContain('name');
  });

  it('leaves the create audit as an empty array, per the house convention', async () => {
    const res = await commitStudentRow({ ...baseRow(), rollNumber: 'AUD-3' }, ctx());
    const log = await auditFor(res.id, 'create');
    expect(log).not.toBeNull();
    expect(log!.changes).toEqual([]);
  });
});

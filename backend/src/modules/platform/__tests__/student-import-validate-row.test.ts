import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Programme } from '../../../models/academic-structure/Programme';
import { Branch } from '../../../models/academic-structure/Branch';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { FeeQuota } from '../../../models/finance/FeeQuota';
import { FeeCategory } from '../../../models/finance/FeeCategory';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Parent } from '../../../models/people/Parent';
import { studentImportSchema } from '../import-schemas/student';
import type { ImportCommitContext } from '../import-schemas/types';

/**
 * Direct coverage of studentImportSchema.validateRow — the DB-backed preview
 * hook that decides catalog/reference validity, create/update/blocked, the
 * `resolved` display echo, and guardian side-effect counting. None of this
 * was previously under direct test (per code review finding "Important 2").
 */

const oid = () => new mongoose.Types.ObjectId();
let collegeId: string;

function ctx(overrides: Partial<ImportCommitContext> = {}): ImportCommitContext {
  return { collegeId, performedBy: 'tester', jobId: 'test-job', ...overrides };
}

/** Guards against a future edit silently dropping the hook — fails loudly rather than crashing on a bare `!`. */
async function callValidateRow(
  typedRow: Record<string, unknown>,
  rawRow: Record<string, string> = {},
) {
  const fn = studentImportSchema.validateRow;
  if (!fn) throw new Error('studentImportSchema.validateRow must be defined for these tests');
  return fn(typedRow, rawRow, ctx());
}

const baseRow = () => ({
  name: 'Aarav Sharma', phone: '9876543210', programmeCode: 'BTCSE', admissionYear: 2025,
});

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

beforeEach(async () => {
  collegeId = String(oid());
  const regulationId = oid();
  const programmeId = oid();
  await Regulation.create({
    _id: regulationId, collegeId, code: 'R20', name: 'R20', effectiveFromYear: 2020,
    totalCredits: 160, maxYears: 4,
  });
  await Programme.create({
    _id: programmeId, collegeId, code: 'BTCSE', name: 'BTech CSE', level: 'UG', durationYears: 4, regulationId,
  });
  await Branch.create({
    collegeId, code: 'CSE', name: 'Computer Science', programmeId, departmentId: oid(), intake: 60,
  });
  await FeeQuota.create({ collegeId, code: 'convener', name: 'Convener', status: 'active' });
  await FeeCategory.create({ collegeId, code: 'OC', name: 'OC', status: 'active' });
});

describe('studentImportSchema.validateRow — ordering', () => {
  it('fails on the catalog check before reference resolution ever runs, when both are wrong', async () => {
    const res = await callValidateRow({ ...baseRow(), programmeCode: 'NOPE', quota: 'BOGUS' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unknown quota code "BOGUS"');
  });

  it('fails with the programme message when only the programme code is wrong', async () => {
    const res = await callValidateRow({ ...baseRow(), programmeCode: 'NOPE' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unknown programme code "NOPE"');
  });
});

describe('studentImportSchema.validateRow — resolution + action', () => {
  it('returns create with resolved.Programme and resolved.Branch for a clean row with a branch code', async () => {
    const res = await callValidateRow({ ...baseRow(), branchCode: 'CSE' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.action).toBe('create');
      expect(res.resolved?.Programme).toBe('BTech CSE');
      expect(res.resolved?.Branch).toBe('Computer Science');
    }
  });

  it('leaves resolved.Branch unset when no branch code was supplied', async () => {
    const res = await callValidateRow(baseRow());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.resolved?.Programme).toBe('BTech CSE');
      expect(res.resolved && 'Branch' in res.resolved).toBe(false);
    }
  });

  it('returns blocked with the propagated reason for a sealed student, and still resolves', async () => {
    const person = await Person.create({ collegeId, name: 'Existing', phone: '9000000001' });
    await Student.create({
      collegeId, personId: person._id, admissionYear: 2025, status: 'active',
      rollNumber: 'SEALED-1', isSealed: true,
    });
    const res = await callValidateRow({ ...baseRow(), rollNumber: 'SEALED-1' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.action).toBe('blocked');
      expect(res.notes).toEqual(['record is sealed']);
      expect(res.resolved?.Programme).toBe('BTech CSE');
    }
  });

  it('returns update for a row matching a live (non-blocked) student', async () => {
    const person = await Person.create({ collegeId, name: 'Existing', phone: '9000000002' });
    // Must already sit on the row's programme: moving a matched student onto
    // a different programme (or onto one at all) is Blocked by owner ruling A.
    const programme = await Programme.findOne({ collegeId, code: 'BTCSE' });
    await Student.create({
      collegeId, personId: person._id, admissionYear: 2025, status: 'active', rollNumber: 'LIVE-1',
      programmeId: programme!._id,
    });
    const res = await callValidateRow({ ...baseRow(), rollNumber: 'LIVE-1' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.action).toBe('update');
  });
});

/**
 * Owner ruling A — the preview half. A fee-axis change on a matched student
 * must surface as Blocked BEFORE the operator confirms, not as a per-row
 * error after the write was attempted. Nothing is written either way, but
 * only preview can put the message in front of a registrar.
 */
describe('studentImportSchema.validateRow — fee-axis changes block the row', () => {
  async function existingStudent(fields: Record<string, unknown>) {
    const person = await Person.create({ collegeId, name: 'Existing', phone: '9000000010' });
    const programme = await Programme.findOne({ collegeId, code: 'BTCSE' });
    return Student.create({
      collegeId, personId: person._id, admissionYear: 2025, status: 'active',
      rollNumber: 'AXIS-1', programmeId: programme!._id, ...fields,
    });
  }

  it('blocks a programme change and points at the transfer screen', async () => {
    await existingStudent({});
    const regulationId = oid();
    await Regulation.create({
      _id: regulationId, collegeId, code: 'R21', name: 'R21', effectiveFromYear: 2021,
      totalCredits: 80, maxYears: 2,
    });
    await Programme.create({
      collegeId, code: 'MTECH', name: 'MTech CSE', level: 'PG', durationYears: 2, regulationId,
    });

    const res = await callValidateRow({ ...baseRow(), rollNumber: 'AXIS-1', programmeCode: 'MTECH' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.action).toBe('blocked');
      expect(res.notes?.join(' ')).toMatch(/programme change is not allowed on import/i);
      expect(res.notes?.join(' ')).toMatch(/programme transfer/i);
    }
  });

  /**
   * A student the pre-import 11-field importer created can have no programme
   * at all. Import still refuses to set one — programme is a fee axis — but
   * the message must name the route that actually works. The Programme field
   * on People → Students is read-only on edit, so telling a registrar to set
   * it there is a dead end; transferProgramme() handles a student with no
   * current programme and pins the year, so that is the only correct advice.
   */
  it('sends a programme-less student to Transfer programme, not to the read-only field', async () => {
    const person = await Person.create({ collegeId, name: 'No Programme', phone: '9000000011' });
    await Student.create({
      collegeId, personId: person._id, admissionYear: 2025, status: 'active',
      rollNumber: 'NOPROG-1',
    });

    const res = await callValidateRow({ ...baseRow(), rollNumber: 'NOPROG-1' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.action).toBe('blocked');
      const note = res.notes?.join(' ') ?? '';
      expect(note).toMatch(/no programme on file/i);
      expect(note).toMatch(/transfer programme/i);
      // The old wording sent operators to a field they cannot edit, and
      // implied Transfer only applies once a fee pin exists. Neither is true.
      expect(note).not.toMatch(/set it on the student's record/i);
      expect(note).not.toMatch(/already hold a fee pin/i);
    }
  });

  it('blocks a quota change on a matched student', async () => {
    await existingStudent({ quota: 'convener' });
    await FeeQuota.create({ collegeId, code: 'management', name: 'Management', status: 'active' });

    const res = await callValidateRow({ ...baseRow(), rollNumber: 'AXIS-1', quota: 'management' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.action).toBe('blocked');
      expect(res.notes?.join(' ')).toMatch(/quota change is not allowed on import/i);
    }
  });

  it('leaves an unchanged re-import as a plain update', async () => {
    await existingStudent({ quota: 'convener' });
    const res = await callValidateRow({ ...baseRow(), rollNumber: 'AXIS-1', quota: 'convener' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.action).toBe('update');
  });
});

describe('studentImportSchema.validateRow — guardian side effects', () => {
  it('dedupes two parent-phone columns carrying the same new number into one guardian', async () => {
    const res = await callValidateRow({
      ...baseRow(), rollNumber: 'G1', primaryParentPhone: '9111111111', feeResponsibleParentPhone: '9111111111',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.notes).toEqual(['will create a guardian for 9111111111']);
      expect(res.sideEffects).toEqual({ guardians: 1 });
    }
  });

  it('counts two guardians for two different new numbers', async () => {
    const res = await callValidateRow({
      ...baseRow(), rollNumber: 'G2', primaryParentPhone: '9111111111', feeResponsibleParentPhone: '9222222222',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.notes).toHaveLength(2);
      expect(res.sideEffects).toEqual({ guardians: 2 });
    }
  });

  it('reports no side effect for a phone that already belongs to an existing guardian', async () => {
    const guardianPerson = await Person.create({ collegeId, name: 'Ramesh', phone: '9333333333' });
    await Parent.create({ collegeId, personId: guardianPerson._id, relationship: 'guardian' });

    const res = await callValidateRow({ ...baseRow(), rollNumber: 'G3', primaryParentPhone: '9333333333' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.notes).toBeUndefined();
      expect(res.sideEffects).toBeUndefined();
    }
  });

  it('still counts a guardian to create when the phone belongs only to another student\'s Person — preview must agree with commit', async () => {
    // parentExistsByPhone excludes Persons known to be a Student/Faculty from
    // counting as an existing guardian. If preview disagreed here it would
    // report "0 guardians will be created" while commit creates one — the
    // exact defect this test exists to prevent.
    const otherStudentPerson = await Person.create({ collegeId, name: 'Other Student', phone: '9444444444' });
    await Student.create({
      collegeId, personId: otherStudentPerson._id, admissionYear: 2024, status: 'active', rollNumber: 'OTHER-1',
    });

    const res = await callValidateRow({ ...baseRow(), rollNumber: 'G4', primaryParentPhone: '9444444444' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.notes).toEqual(['will create a guardian for 9444444444']);
      expect(res.sideEffects).toEqual({ guardians: 1 });
    }
  });
});

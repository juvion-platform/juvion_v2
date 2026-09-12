import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../../models/people/Person';
import { Student } from '../../../../models/people/Student';
import { Faculty } from '../../../../models/people/Faculty';
import { Branch } from '../../../../models/academic-structure/Branch';
import { CrisisAlert } from '../../../../models/welfare/CrisisAlert';
import { RiskSignal } from '../../../../models/welfare/RiskSignal';
import { RiskScoreSnapshot } from '../../../../models/welfare/RiskScoreSnapshot';
import { HostelAllocation } from '../../../../models/welfare/HostelAllocation';
import { MentorAssignment } from '../../../../models/welfare/MentorAssignment';
import { forPeopleQuery } from '../query-context';

/**
 * The bundle is the ONLY thing the model answers from, so what it carries is
 * the feature. Two things matter most: a mentor's bundle must contain only
 * their mentees, and every cohort cut the §2.1 questions need (branch, year,
 * first-generation, hostel, 7-day delta) must be present per row.
 */

const COLLEGE = new mongoose.Types.ObjectId();
const DAY = 86_400_000;

async function makeStudent(name: string, roll: string, extra: Record<string, unknown> = {}) {
  const person = await Person.create({ collegeId: COLLEGE, name, phone: '9990001111' });
  const student = await Student.create({
    collegeId: COLLEGE, personId: person._id, admissionYear: 2024, rollNumber: roll, ...extra,
  });
  return { person, student };
}

async function makeAlert(studentId: mongoose.Types.ObjectId, score: number, priority: string) {
  return CrisisAlert.create({
    collegeId: COLLEGE, reportedBy: new mongoose.Types.ObjectId(), studentId,
    type: 'compound_risk', severity: 'critical', description: 'CCD', status: 'generated',
    priority, compoundScore: score,
    scoreBreakdown: { baseTotal: score, crossModuleMultiplier: 1, temporalMultiplier: 1, finalScore: score },
    signals: [
      { source: 'M03', signalType: 'attendance_drop', weight: 25, receivedAt: new Date() },
      { source: 'M04', signalType: 'fee_default', weight: 25, receivedAt: new Date() },
    ],
    falsePositive: false, suppressDoubleAlert: false,
  });
}

describe('forPeopleQuery', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('carries the cohort cuts and the 7-day delta per board row for an unscoped caller', async () => {
    const branch = await Branch.create({
      collegeId: COLLEGE, code: 'CSE', name: 'Computer Science',
      programmeId: new mongoose.Types.ObjectId(), intake: 60,
    });
    const cse = await makeStudent('Asha', 'CSE-2', {
      branchId: branch._id, studyYearAtAdmission: 2, quota: 'MGMT', category: 'OBC',
    });
    const other = await makeStudent('Ravi', 'ECE-1');
    await makeAlert(cse.student._id, 82, 'P1');
    await makeAlert(other.student._id, 40, 'P3');

    // First-generation is a signal-level flag in the CCD engine, not a student field.
    await RiskSignal.create({
      collegeId: COLLEGE, studentId: cse.student._id, source: 'M04', signalType: 'fee_default',
      baseWeight: 25, firstGenModifier: 25, computedWeight: 50, triggerData: { isFirstGen: true },
      receivedAt: new Date(), expiresAt: new Date(Date.now() + 30 * DAY),
    });
    await HostelAllocation.create({
      collegeId: COLLEGE, studentId: cse.student._id, roomId: new mongoose.Types.ObjectId(),
      academicYearId: new mongoose.Types.ObjectId(), status: 'active',
    });
    await RiskScoreSnapshot.create({
      collegeId: COLLEGE, studentId: cse.student._id, score: 60, priority: 'P2',
      breakdown: { baseTotal: 60, crossModuleMultiplier: 1, temporalMultiplier: 1, finalScore: 60 },
      capturedAt: new Date(Date.now() - 10 * DAY),
    });

    const bundle = await forPeopleQuery(String(COLLEGE));

    expect(bundle.board).toHaveLength(2);
    expect(bundle.scope.cap).toBe(50);
    expect(bundle.scope.note).toMatch(/top 50/i);

    const row = bundle.board.find((r) => r.rollNumber === 'CSE-2')!;
    expect(row.branch).toBe('CSE');
    expect(row.yearOfStudy).toBe(2);
    expect(row.quota).toBe('MGMT');
    expect(row.firstGeneration).toBe(true);
    expect(row.hostelResident).toBe(true);
    expect(row.delta7d).toBe(22);
    expect(row.signalTypes).toContain('attendance_drop');

    const plain = bundle.board.find((r) => r.rollNumber === 'ECE-1')!;
    expect(plain.firstGeneration).toBe(false);
    expect(plain.hostelResident).toBe(false);
    expect(plain.delta7d).toBeNull();
  });

  it("restricts a mentor's bundle to their own mentees", async () => {
    const mine = await makeStudent('Mentee', 'M-1');
    const theirs = await makeStudent('Not Mine', 'M-2');
    await makeAlert(mine.student._id, 80, 'P1');
    await makeAlert(theirs.student._id, 80, 'P1');

    const mentorPerson = await Person.create({ collegeId: COLLEGE, name: 'Dr M', phone: '8880001111' });
    const faculty = await Faculty.create({
      collegeId: COLLEGE, personId: mentorPerson._id, employeeCode: 'F-1', designation: 'Assistant Professor',
    });
    await MentorAssignment.create({
      collegeId: COLLEGE, mentorId: faculty._id, studentId: mine.student._id,
      academicYearId: new mongoose.Types.ObjectId(), assignedBy: new mongoose.Types.ObjectId(), status: 'active',
    });

    const bundle = await forPeopleQuery(String(COLLEGE), {
      departmentOnly: false, selfOnly: false, userId: 'u', personId: String(mentorPerson._id), resolvedPermissions: [],
    });

    expect(bundle.board.map((r) => r.rollNumber)).toEqual(['M-1']);
    expect(bundle.mentorWorkload.every((m) => m.mentorName === 'Dr M')).toBe(true);
    expect(bundle.scope.note).toMatch(/mentee/i);
  });
});

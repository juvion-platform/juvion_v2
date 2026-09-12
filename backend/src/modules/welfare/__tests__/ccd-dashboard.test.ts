import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { MentorAssignment } from '../../../models/welfare/MentorAssignment';
import { RiskSignal } from '../../../models/welfare/RiskSignal';
import { RiskScoreSnapshot } from '../../../models/welfare/RiskScoreSnapshot';
import { CrisisAlert } from '../../../models/welfare/CrisisAlert';
import { emitRiskSignal } from '../risk-emitters';
import { mentorMenteeIds, applyMentorScope } from '../mentor-scope';
import {
  getRiskBoard,
  getSignalsBySource,
  getMentorWorkload,
  getStudentScoreHistory,
  getOutreachEffectiveness,
} from '../ccd-dashboard-service';

/**
 * 008 Phase 2 — the Student Risk board reads.
 *
 * The scoping tests matter most: a mentor must see their mentees and no one
 * else's, and a mentor with an empty roster must see NOTHING rather than the
 * whole college. That distinction (null vs []) is the easiest thing to get
 * wrong here and the most damaging if it is.
 */

const COLLEGE = new mongoose.Types.ObjectId();
const OTHER_COLLEGE = new mongoose.Types.ObjectId();

async function makeStudent(name: string, roll: string, collegeId = COLLEGE) {
  const person = await Person.create({ collegeId, name, phone: '9999999999' });
  const student = await Student.create({
    collegeId,
    personId: person._id,
    admissionYear: 2023,
    rollNumber: roll,
  });
  return { person, student };
}

async function makeMentor(name: string, code: string) {
  const person = await Person.create({ collegeId: COLLEGE, name, phone: '8888888888' });
  const faculty = await Faculty.create({
    collegeId: COLLEGE,
    personId: person._id,
    employeeCode: code,
    designation: 'Assistant Professor',
  });
  return { person, faculty };
}

/** Three modules -> a genuine P1 via the cross-module multiplier. */
async function flagAcrossThreeModules(studentId: string) {
  await emitRiskSignal(String(COLLEGE), { studentId, source: 'M03', signalType: 'attendance_drop' });
  await emitRiskSignal(String(COLLEGE), { studentId, source: 'M04', signalType: 'fee_default' });
  await emitRiskSignal(String(COLLEGE), { studentId, source: 'M08', signalType: 'warden_concern' });
}

describe('CCD dashboard reads', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  describe('getRiskBoard', () => {
    it('returns an empty board when nothing is flagged', async () => {
      expect(await getRiskBoard(String(COLLEGE))).toEqual([]);
    });

    it('resolves the student name, roll number and the cross-module evidence', async () => {
      const { student } = await makeStudent('Priya Sharma', '21B01A0532');
      await flagAcrossThreeModules(String(student._id));

      const board = await getRiskBoard(String(COLLEGE));
      expect(board).toHaveLength(1);
      const row = board[0]!;
      expect(row.studentName).toBe('Priya Sharma');
      expect(row.rollNumber).toBe('21B01A0532');
      expect(row.priority).toBe('P1');
      expect(row.score).toBe(100);
      expect(row.signalCount).toBe(3);
      expect(row.sources.sort()).toEqual(['M03', 'M04', 'M08']);
      expect(row.crossModuleMultiplier).toBe(1.5);
      expect(row.mentorName).toBeNull(); // none assigned yet
      expect(row.lastActionAt).toBeNull();
    });

    it('attaches the assigned mentor', async () => {
      const { student } = await makeStudent('Rahul Verma', '21B01A0533');
      const { faculty } = await makeMentor('Dr Anita Rao', 'F-101');
      await MentorAssignment.create({
        collegeId: COLLEGE,
        mentorId: faculty._id,
        studentId: student._id,
        academicYearId: new mongoose.Types.ObjectId(),
        assignedBy: new mongoose.Types.ObjectId(),
        status: 'active',
      });
      await flagAcrossThreeModules(String(student._id));

      const board = await getRiskBoard(String(COLLEGE));
      expect(board[0]!.mentorName).toBe('Dr Anita Rao');
    });

    it('sorts the highest score first', async () => {
      const a = await makeStudent('Low Risk', 'R-1');
      const b = await makeStudent('High Risk', 'R-2');
      // One signal only -> 40, P3.
      await emitRiskSignal(String(COLLEGE), {
        studentId: String(a.student._id), source: 'M03', signalType: 'failing_grades',
      });
      await flagAcrossThreeModules(String(b.student._id));

      const board = await getRiskBoard(String(COLLEGE));
      expect(board.map(r => r.studentName)).toEqual(['High Risk', 'Low Risk']);
    });

    it('never leaks another college\'s alerts', async () => {
      const mine = await makeStudent('Mine', 'M-1');
      const theirs = await makeStudent('Theirs', 'T-1', OTHER_COLLEGE);
      await flagAcrossThreeModules(String(mine.student._id));
      await emitRiskSignal(String(OTHER_COLLEGE), {
        studentId: String(theirs.student._id), source: 'M03', signalType: 'failing_grades',
      });

      const board = await getRiskBoard(String(COLLEGE));
      expect(board).toHaveLength(1);
      expect(board[0]!.studentName).toBe('Mine');
    });

    it('filters by priority when asked', async () => {
      const a = await makeStudent('P3 Student', 'R-3');
      const b = await makeStudent('P1 Student', 'R-4');
      await emitRiskSignal(String(COLLEGE), {
        studentId: String(a.student._id), source: 'M03', signalType: 'failing_grades',
      });
      await flagAcrossThreeModules(String(b.student._id));

      const p1 = await getRiskBoard(String(COLLEGE), undefined, { priority: 'P1' });
      expect(p1.map(r => r.studentName)).toEqual(['P1 Student']);
    });
  });

  describe('mentor scoping', () => {
    it('returns null for someone who is not faculty at all', async () => {
      const orphan = new mongoose.Types.ObjectId();
      expect(await mentorMenteeIds(String(COLLEGE), String(orphan))).toBeNull();
    });

    it('returns null when no personId is supplied', async () => {
      expect(await mentorMenteeIds(String(COLLEGE), undefined)).toBeNull();
    });

    it('returns an EMPTY ARRAY — not null — for a mentor with no mentees', async () => {
      // The distinction is load-bearing: null falls through to the normal
      // scope and would show this person the entire college.
      const { person } = await makeMentor('Dr No Mentees', 'F-202');
      const result = await mentorMenteeIds(String(COLLEGE), String(person._id));
      expect(result).toEqual([]);
      expect(result).not.toBeNull();
    });

    it('scopes the board to a mentor\'s own mentees', async () => {
      const mine = await makeStudent('My Mentee', 'S-1');
      const other = await makeStudent('Someone Else', 'S-2');
      const { person, faculty } = await makeMentor('Dr Mentor', 'F-303');
      await MentorAssignment.create({
        collegeId: COLLEGE, mentorId: faculty._id, studentId: mine.student._id,
        academicYearId: new mongoose.Types.ObjectId(),
        assignedBy: new mongoose.Types.ObjectId(), status: 'active',
      });
      await flagAcrossThreeModules(String(mine.student._id));
      await flagAcrossThreeModules(String(other.student._id));

      const all = await getRiskBoard(String(COLLEGE));
      expect(all).toHaveLength(2);

      const scoped = await getRiskBoard(String(COLLEGE), {
        departmentOnly: false, selfOnly: false,
        userId: 'u1', personId: String(person._id), resolvedPermissions: [],
      });
      expect(scoped).toHaveLength(1);
      expect(scoped[0]!.studentName).toBe('My Mentee');
    });

    it('intersects rather than widens an existing studentId restriction', async () => {
      const a = await makeStudent('A', 'A-1');
      const b = await makeStudent('B', 'B-1');
      const { person, faculty } = await makeMentor('Dr Both', 'F-404');
      for (const s of [a, b]) {
        await MentorAssignment.create({
          collegeId: COLLEGE, mentorId: faculty._id, studentId: s.student._id,
          academicYearId: new mongoose.Types.ObjectId(),
          assignedBy: new mongoose.Types.ObjectId(), status: 'active',
        });
      }

      // A prior filter already narrowed to student A only.
      const filter: Record<string, unknown> = { studentId: { $in: [String(a.student._id)] } };
      const applied = await applyMentorScope(filter, String(COLLEGE), String(person._id));

      expect(applied).toBe(true);
      expect((filter['studentId'] as { $in: string[] }).$in).toEqual([String(a.student._id)]);
    });

    it('leaves the filter untouched for a non-mentor', async () => {
      const filter: Record<string, unknown> = { collegeId: String(COLLEGE) };
      const applied = await applyMentorScope(filter, String(COLLEGE), String(new mongoose.Types.ObjectId()));
      expect(applied).toBe(false);
      expect(filter['studentId']).toBeUndefined();
    });
  });

  describe('getSignalsBySource', () => {
    it('groups the last week of signals by originating module', async () => {
      const { student } = await makeStudent('Signal Source', 'S-9');
      await flagAcrossThreeModules(String(student._id));

      const rows = await getSignalsBySource(String(COLLEGE), 7);
      expect(rows).toHaveLength(3);
      expect(rows.map(r => r.source).sort()).toEqual(['M03', 'M04', 'M08']);
      expect(rows.every(r => r.count === 1)).toBe(true);
    });

    it('excludes signals older than the window', async () => {
      const { student } = await makeStudent('Old Signal', 'S-10');
      await RiskSignal.create({
        collegeId: COLLEGE, studentId: student._id,
        source: 'M03', signalType: 'attendance_drop',
        baseWeight: 25, firstGenModifier: 0, computedWeight: 25,
        receivedAt: new Date(Date.now() - 30 * 86_400_000),
        expiresAt: new Date(Date.now() + 86_400_000),
        status: 'active',
      });

      expect(await getSignalsBySource(String(COLLEGE), 7)).toEqual([]);
    });
  });

  describe('getMentorWorkload', () => {
    it('counts open alerts and P1s per mentor, bucketing the unassigned', async () => {
      const mine = await makeStudent('Mentored', 'W-1');
      const orphan = await makeStudent('Unmentored', 'W-2');
      const { faculty } = await makeMentor('Dr Load', 'F-505');
      await MentorAssignment.create({
        collegeId: COLLEGE, mentorId: faculty._id, studentId: mine.student._id,
        academicYearId: new mongoose.Types.ObjectId(),
        assignedBy: new mongoose.Types.ObjectId(), status: 'active',
      });
      await flagAcrossThreeModules(String(mine.student._id));
      await flagAcrossThreeModules(String(orphan.student._id));

      const rows = await getMentorWorkload(String(COLLEGE));
      const byName = Object.fromEntries(rows.map(r => [r.mentorName, r]));
      expect(byName['Dr Load']!.open).toBe(1);
      expect(byName['Dr Load']!.p1).toBe(1);
      expect(byName['Unassigned']!.open).toBe(1);
    });
  });

  describe('getStudentScoreHistory', () => {
    it('returns the snapshot series Phase 1 records, oldest first', async () => {
      const { student } = await makeStudent('History', 'H-1');
      // Each emit triggers a scoring run, so each writes a snapshot.
      await flagAcrossThreeModules(String(student._id));

      const history = await getStudentScoreHistory(String(COLLEGE), String(student._id));
      expect(history.length).toBe(3);
      // 25 (one signal) -> 75 (two signals: 50 base x1.5 temporal) ->
      // 100 (three: 75 base x1.5 cross-module x1.5 temporal, capped).
      // The jump at the second signal is the temporal multiplier, not an error.
      expect(history.map(h => h.score)).toEqual([25, 75, 100]);
      // Ascending by capture time.
      const times = history.map(h => new Date(h.at).getTime());
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    });

    it('returns an empty series for a student who has never been scored', async () => {
      const { student } = await makeStudent('Never Scored', 'H-2');
      expect(await getStudentScoreHistory(String(COLLEGE), String(student._id))).toEqual([]);
      expect(await RiskScoreSnapshot.countDocuments({})).toBe(0);
    });
  });

  describe('getOutreachEffectiveness', () => {
    const reporter = new mongoose.Types.ObjectId();

    function makeAlert(studentId: unknown, overrides: Record<string, unknown> = {}) {
      return CrisisAlert.create({
        collegeId: COLLEGE,
        reportedBy: reporter,
        studentId,
        type: 'compound_risk',
        severity: 'high',
        description: 'test',
        status: 'generated',
        ...overrides,
      });
    }

    it('returns a zero funnel when nothing was raised', async () => {
      expect(await getOutreachEffectiveness(String(COLLEGE))).toEqual({
        windowDays: 90, raised: 0, contacted: 0, resolved: 0, recurred: 0,
      });
    });

    it('counts raised, contacted and resolved from the alert lifecycle', async () => {
      const { student: a } = await makeStudent('A', 'E-1');
      const { student: b } = await makeStudent('B', 'E-2');
      const { student: c } = await makeStudent('C', 'E-3');
      await makeAlert(a._id, {
        status: 'resolved',
        resolvedAt: new Date(),
        intervention: { type: 'parent_contact', executedAt: new Date() },
      });
      await makeAlert(b._id, {
        status: 'intervening',
        intervention: { type: 'mentor_outreach', executedAt: new Date() },
      });
      await makeAlert(c._id); // raised, untouched

      const funnel = await getOutreachEffectiveness(String(COLLEGE));
      expect(funnel).toEqual({ windowDays: 90, raised: 3, contacted: 2, resolved: 1, recurred: 0 });
    });

    it('counts a resolved alert as recurred when the student is flagged again afterwards', async () => {
      const { student } = await makeStudent('Recurrer', 'E-4');
      await makeAlert(student._id, {
        status: 'resolved',
        resolvedAt: new Date(Date.now() - 3_600_000),
      });
      await makeAlert(student._id); // new alert after resolution

      const funnel = await getOutreachEffectiveness(String(COLLEGE));
      expect(funnel.raised).toBe(2);
      expect(funnel.resolved).toBe(1);
      expect(funnel.recurred).toBe(1);
    });

    it('excludes false positives and other colleges', async () => {
      const { student } = await makeStudent('Clean', 'E-5');
      await makeAlert(student._id, { falsePositive: true, status: 'false_positive' });
      const { student: other } = await makeStudent('Elsewhere', 'E-6', OTHER_COLLEGE);
      await CrisisAlert.create({
        collegeId: OTHER_COLLEGE, reportedBy: reporter, studentId: other._id,
        type: 'compound_risk', severity: 'high', description: 'test',
      });

      const funnel = await getOutreachEffectiveness(String(COLLEGE));
      expect(funnel.raised).toBe(0);
    });
  });
});

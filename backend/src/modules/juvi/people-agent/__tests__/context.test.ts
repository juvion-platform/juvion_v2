import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../../models/people/Person';
import { Student } from '../../../../models/people/Student';
import { Parent } from '../../../../models/people/Parent';
import { CrisisAlert } from '../../../../models/welfare/CrisisAlert';
import { forAlertNarration, forOutreachDraft } from '../context';

const COLLEGE = new mongoose.Types.ObjectId();

async function makeStudent(name: string, roll: string) {
  const person = await Person.create({ collegeId: COLLEGE, name, phone: '9990001111' });
  const student = await Student.create({
    collegeId: COLLEGE, personId: person._id, admissionYear: 2023, rollNumber: roll,
  });
  return student;
}

async function makeAlert(studentId: mongoose.Types.ObjectId) {
  return CrisisAlert.create({
    collegeId: COLLEGE,
    reportedBy: new mongoose.Types.ObjectId(),
    studentId,
    type: 'compound_risk',
    severity: 'critical',
    description: 'CCD compound risk alert',
    status: 'generated',
    priority: 'P1',
    compoundScore: 82,
    scoreBreakdown: { baseTotal: 67, crossModuleMultiplier: 1.5, temporalMultiplier: 1.5, finalScore: 82 },
    signals: [
      { source: 'M03', signalType: 'attendance_drop', weight: 25, receivedAt: new Date() },
      { source: 'M04', signalType: 'fee_default', weight: 25, receivedAt: new Date() },
      { source: 'M08', signalType: 'warden_concern', weight: 17, receivedAt: new Date() },
    ],
    falsePositive: false,
    suppressDoubleAlert: false,
  });
}

describe('people-agent context', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  describe('forAlertNarration', () => {
    it('translates enum codes into words a mentor would use', async () => {
      const s = await makeStudent('Priya', 'R-1');
      const a = await makeAlert(s._id as mongoose.Types.ObjectId);

      const ctx = await forAlertNarration(String(COLLEGE), String(a._id));
      expect(ctx).not.toBeNull();
      // The model must never see "M03" / "attendance_drop".
      expect(ctx!.signals.map(x => x.what)).toEqual([
        'attendance dropped', 'fees overdue', 'warden raised a concern',
      ]);
      expect(ctx!.signals.map(x => x.from)).toEqual(['academics', 'fees', 'campus']);
      expect(JSON.stringify(ctx)).not.toMatch(/M0[3-8]/);
    });

    it('passes the computed score and multipliers through untouched', async () => {
      const s = await makeStudent('Rahul', 'R-2');
      const a = await makeAlert(s._id as mongoose.Types.ObjectId);

      const ctx = await forAlertNarration(String(COLLEGE), String(a._id));
      expect(ctx!.score).toBe(82);
      expect(ctx!.priority).toBe('P1');
      expect(ctx!.crossModuleMultiplier).toBe(1.5);
      expect(ctx!.temporalMultiplier).toBe(1.5);
      expect(ctx!.distinctModules).toBe(3);
    });

    it('returns null for another college\'s alert rather than throwing', async () => {
      const s = await makeStudent('X', 'R-3');
      const a = await makeAlert(s._id as mongoose.Types.ObjectId);
      const other = new mongoose.Types.ObjectId();
      expect(await forAlertNarration(String(other), String(a._id))).toBeNull();
    });
  });

  describe('forOutreachDraft', () => {
    it('prefers the fee-responsible guardian and carries channel + language', async () => {
      const s = await makeStudent('Anita', 'R-4');
      await makeAlert(s._id as mongoose.Types.ObjectId);

      const dadPerson = await Person.create({
        collegeId: COLLEGE, name: 'Ramesh Kumar', phone: '9111111111',
        preferredLanguage: 'te',
      });
      const momPerson = await Person.create({
        collegeId: COLLEGE, name: 'Sita Kumari', phone: '9222222222',
      });
      await Parent.create({
        collegeId: COLLEGE, personId: momPerson._id, relationship: 'mother',
        linkedStudents: [s._id], primaryContact: true, isFeeResponsible: false,
      });
      await Parent.create({
        collegeId: COLLEGE, personId: dadPerson._id, relationship: 'father',
        linkedStudents: [s._id], isFeeResponsible: true,
        communicationPreference: 'whatsapp',
      });

      const ctx = await forOutreachDraft(String(COLLEGE), String(s._id));
      // Fee-responsible beats primary contact.
      expect(ctx!.guardian!.name).toBe('Ramesh Kumar');
      expect(ctx!.guardian!.relationship).toBe('father');
      // Both of these are what the finance version drops on approve.
      expect(ctx!.guardian!.communicationPreference).toBe('whatsapp');
      expect(ctx!.guardian!.preferredLanguage).toBe('te');
    });

    it('falls back to the primary contact when nobody is fee-responsible', async () => {
      const s = await makeStudent('Bala', 'R-5');
      const p = await Person.create({ collegeId: COLLEGE, name: 'Only Parent', phone: '9333333333' });
      await Parent.create({
        collegeId: COLLEGE, personId: p._id, relationship: 'guardian',
        linkedStudents: [s._id], primaryContact: true, isFeeResponsible: false,
      });

      const ctx = await forOutreachDraft(String(COLLEGE), String(s._id));
      expect(ctx!.guardian!.name).toBe('Only Parent');
    });

    it('returns a context with a null guardian rather than failing', async () => {
      // A student with no parent on record must still be draftable — the
      // caller decides what to do, it is not an error here.
      const s = await makeStudent('Orphan Record', 'R-6');
      const ctx = await forOutreachDraft(String(COLLEGE), String(s._id));
      expect(ctx).not.toBeNull();
      expect(ctx!.guardian).toBeNull();
      expect(ctx!.studentName).toBe('Orphan Record');
    });

    it('returns null for a student outside the college', async () => {
      const s = await makeStudent('Y', 'R-7');
      expect(await forOutreachDraft(String(new mongoose.Types.ObjectId()), String(s._id))).toBeNull();
    });
  });
});

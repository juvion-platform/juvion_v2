import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';

// Partial mock — spreads the real module so the placeholder guard, cost math
// and every other export keep working. A full replacement would silently make
// them undefined.
vi.mock('../../finance-agent/llm-client', async () => {
  const actual = await vi.importActual<typeof import('../../finance-agent/llm-client')>(
    '../../finance-agent/llm-client',
  );
  return { ...actual, createLLMClient: vi.fn() };
});

import { setupMongo, teardownMongo, clearCollections } from '../../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../../models/people/Person';
import { Student } from '../../../../models/people/Student';
import { Parent } from '../../../../models/people/Parent';
import { CrisisAlert } from '../../../../models/welfare/CrisisAlert';
import { createLLMClient } from '../../finance-agent/llm-client';
import {
  handleAlertNarrations,
  handleOutreachDrafts,
  handleApproveOutreach,
} from '../service';

const COLLEGE = new mongoose.Types.ObjectId();
const USER = new mongoose.Types.ObjectId();

function mockLLM(text: string) {
  vi.mocked(createLLMClient).mockReturnValue({
    provider: 'openai',
    complete: vi.fn().mockResolvedValue({
      text, inputTokens: 10, outputTokens: 5, model: 'test', provider: 'openai',
      costInr: 0.01, durationMs: 5,
    }),
    stream: vi.fn(),
  } as never);
}

function mockLLMFailure() {
  vi.mocked(createLLMClient).mockImplementation(() => { throw new Error('no key'); });
}

async function seedStudentWithAlert(name: string, roll: string) {
  const person = await Person.create({ collegeId: COLLEGE, name, phone: '9990001111' });
  const student = await Student.create({
    collegeId: COLLEGE, personId: person._id, admissionYear: 2023, rollNumber: roll,
  });
  const alert = await CrisisAlert.create({
    collegeId: COLLEGE, reportedBy: USER, studentId: student._id,
    type: 'compound_risk', severity: 'critical', description: 'CCD alert',
    status: 'generated', priority: 'P1', compoundScore: 82,
    scoreBreakdown: { baseTotal: 67, crossModuleMultiplier: 1.5, temporalMultiplier: 1.5, finalScore: 82 },
    signals: [{ source: 'M03', signalType: 'attendance_drop', weight: 25, receivedAt: new Date() }],
    falsePositive: false, suppressDoubleAlert: false,
  });
  return { person, student, alert };
}

describe('people-agent service', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); vi.restoreAllMocks(); });

  describe('handleAlertNarrations', () => {
    it('narrates an alert', async () => {
      const { alert } = await seedStudentWithAlert('Priya', 'R-1');
      mockLLM('Attendance fell and fees are overdue, flagged by three areas.');

      const out = await handleAlertNarrations(String(COLLEGE), String(USER), [String(alert._id)]);
      expect(out).toHaveLength(1);
      expect(out[0]!.narrative).toContain('Attendance fell');
    });

    it('degrades to a null narrative when the LLM is unavailable', async () => {
      const { alert } = await seedStudentWithAlert('Rahul', 'R-2');
      mockLLMFailure();

      const out = await handleAlertNarrations(String(COLLEGE), String(USER), [String(alert._id)]);
      // The board's numbers stand on their own; no narrative is not an error.
      expect(out[0]!.narrative).toBeNull();
    });

    it('skips an unknown alert instead of failing the batch', async () => {
      const { alert } = await seedStudentWithAlert('Anita', 'R-3');
      mockLLM('fine');
      const ghost = String(new mongoose.Types.ObjectId());

      const out = await handleAlertNarrations(String(COLLEGE), String(USER), [String(alert._id), ghost]);
      expect(out).toHaveLength(2);
      expect(out.find(o => o.alertId === ghost)!.narrative).toBeNull();
    });

    it('refuses an oversized batch', async () => {
      const ids = Array.from({ length: 26 }, () => String(new mongoose.Types.ObjectId()));
      await expect(handleAlertNarrations(String(COLLEGE), String(USER), ids)).rejects.toThrow(/At most 25/);
    });
  });

  describe('handleOutreachDrafts', () => {
    async function seedGuardian(studentId: mongoose.Types.ObjectId, prefs: {
      communicationPreference?: string; preferredLanguage?: string;
    }) {
      const gp = await Person.create({
        collegeId: COLLEGE, name: 'Ramesh Kumar', phone: '9111111111',
        preferredLanguage: prefs.preferredLanguage,
      });
      await Parent.create({
        collegeId: COLLEGE, personId: gp._id, relationship: 'father',
        linkedStudents: [studentId], isFeeResponsible: true,
        communicationPreference: prefs.communicationPreference,
      });
    }

    it('uses the guardian\'s own channel and language, not a hardcoded default', async () => {
      const { student } = await seedStudentWithAlert('Bala', 'R-4');
      await seedGuardian(student._id as mongoose.Types.ObjectId, {
        communicationPreference: 'whatsapp', preferredLanguage: 'te',
      });
      mockLLM(JSON.stringify({
        language: 'te', tone: 'urgent', subject: 'Regarding Bala', body: 'Please contact us.',
      }));

      const [draft] = await handleOutreachDrafts(String(COLLEGE), String(USER), [String(student._id)]);
      // The finance equivalent hardcodes 'sms' and drops the language here.
      expect(draft!.channel).toBe('whatsapp');
      expect(draft!.language).toBe('te');
      expect(draft!.fallback).toBe(false);
    });

    it('falls back to a real sendable template when the LLM fails', async () => {
      const { student } = await seedStudentWithAlert('Chitra', 'R-5');
      await seedGuardian(student._id as mongoose.Types.ObjectId, {});
      mockLLMFailure();

      const [draft] = await handleOutreachDrafts(String(COLLEGE), String(USER), [String(student._id)]);
      expect(draft!.fallback).toBe(true);
      expect(draft!.body).toContain('Chitra');
      expect(draft!.body.length).toBeGreaterThan(20); // a real message, not a stub
    });

    it('falls back when the model returns unparseable JSON', async () => {
      const { student } = await seedStudentWithAlert('Deepa', 'R-6');
      await seedGuardian(student._id as mongoose.Types.ObjectId, {});
      mockLLM('I am afraid I cannot do that.');

      const [draft] = await handleOutreachDrafts(String(COLLEGE), String(USER), [String(student._id)]);
      expect(draft!.fallback).toBe(true);
    });

    it('still drafts for a student with no guardian on record', async () => {
      const { student } = await seedStudentWithAlert('Eshan', 'R-7');
      mockLLMFailure();

      const [draft] = await handleOutreachDrafts(String(COLLEGE), String(USER), [String(student._id)]);
      expect(draft!.guardianName).toBeNull();
      expect(draft!.channel).toBe('sms'); // documented default when unknown
    });
  });

  describe('handleApproveOutreach', () => {
    it('records the outreach and states plainly that nothing was sent', async () => {
      const { student, alert } = await seedStudentWithAlert('Farah', 'R-8');

      const result = await handleApproveOutreach(String(COLLEGE), String(USER), [
        { studentId: String(student._id), subject: 'S', body: 'B', channel: 'whatsapp' },
      ]);

      expect(result.approvedCount).toBe(1);
      // The whole point: approving must not imply delivery.
      expect(result.delivery).toBe('recorded_not_sent');
      expect(result.deliveryNote).toMatch(/No message was sent/i);

      const updated = await CrisisAlert.findById(alert._id).lean();
      expect(updated!.status).toBe('intervening');
      expect(updated!.intervention?.type).toBe('parent_contact');
      expect(updated!.intervention?.outcome).toBe('recorded_not_sent');
      expect(updated!.intervention?.description).toContain('[whatsapp]');
    });

    it('rejects a student from another college', async () => {
      const other = new mongoose.Types.ObjectId();
      const person = await Person.create({ collegeId: other, name: 'Outsider', phone: '9000000000' });
      const foreign = await Student.create({
        collegeId: other, personId: person._id, admissionYear: 2023, rollNumber: 'X-1',
      });

      await expect(
        handleApproveOutreach(String(COLLEGE), String(USER), [
          { studentId: String(foreign._id), subject: 'S', body: 'B', channel: 'sms' },
        ]),
      ).rejects.toThrow(/Cross-college/);
    });

    it('rejects a malformed id without writing anything', async () => {
      await expect(
        handleApproveOutreach(String(COLLEGE), String(USER), [
          { studentId: 'not-an-id', subject: 'S', body: 'B', channel: 'sms' },
        ]),
      ).rejects.toThrow(/Cross-college/);
      expect(await CrisisAlert.countDocuments({})).toBe(0);
    });

    it('leaves a resolved alert alone', async () => {
      const { student, alert } = await seedStudentWithAlert('Gita', 'R-9');
      await CrisisAlert.updateOne({ _id: alert._id }, { $set: { status: 'resolved' } });

      const result = await handleApproveOutreach(String(COLLEGE), String(USER), [
        { studentId: String(student._id), subject: 'S', body: 'B', channel: 'sms' },
      ]);
      // A human already closed this; the agent must not reopen it.
      expect(result.approvedCount).toBe(0);
      const after = await CrisisAlert.findById(alert._id).lean();
      expect(after!.status).toBe('resolved');
    });
  });
});

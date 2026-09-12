import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Branch } from '../../../models/academic-structure/Branch';
import { CrisisAlert } from '../../../models/welfare/CrisisAlert';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { getCohortCuts } from '../ccd-dashboard-service';

/** 009 T9 — the last unbuilt ROADMAP §2.1 widget. Pure aggregation, no AI. */

const COLLEGE = new mongoose.Types.ObjectId();

async function flagged(name: string, roll: string, score: number, priority: string, extra: Record<string, unknown> = {}) {
  const person = await Person.create({ collegeId: COLLEGE, name, phone: '9990001111' });
  const student = await Student.create({
    collegeId: COLLEGE, personId: person._id, admissionYear: 2024, rollNumber: roll, ...extra,
  });
  await CrisisAlert.create({
    collegeId: COLLEGE, reportedBy: new mongoose.Types.ObjectId(), studentId: student._id,
    type: 'compound_risk', severity: 'high', description: 'CCD', status: 'generated',
    priority, compoundScore: score,
    signals: [{ source: 'M03', signalType: 'attendance_drop', weight: 25, receivedAt: new Date() }],
    falsePositive: false, suppressDoubleAlert: false,
  });
  return student;
}

describe('getCohortCuts', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('cuts open alerts by branch, quota, hostel residency and first-generation', async () => {
    const cse = await Branch.create({
      collegeId: COLLEGE, code: 'CSE', name: 'CSE', programmeId: new mongoose.Types.ObjectId(), intake: 60,
    });
    const a = await flagged('A', 'A-1', 80, 'P1', { branchId: cse._id, quota: 'MGMT' });
    await flagged('B', 'B-1', 40, 'P3', { branchId: cse._id, quota: 'CONV' });
    await flagged('C', 'C-1', 60, 'P2', { quota: 'CONV' });
    await HostelAllocation.create({
      collegeId: COLLEGE, studentId: a._id, roomId: new mongoose.Types.ObjectId(),
      academicYearId: new mongoose.Types.ObjectId(), status: 'active',
    });

    const cuts = await getCohortCuts(String(COLLEGE));

    expect(cuts.total).toBe(3);
    expect(cuts.byBranch).toEqual([
      { key: 'CSE', open: 2, p1: 1, avgScore: 60 },
      { key: 'Unassigned', open: 1, p1: 0, avgScore: 60 },
    ]);
    expect(cuts.byQuota).toEqual([
      { key: 'CONV', open: 2, p1: 0, avgScore: 50 },
      { key: 'MGMT', open: 1, p1: 1, avgScore: 80 },
    ]);
    expect(cuts.hostel).toEqual({ key: 'Hostel residents', open: 1, p1: 1, avgScore: 80 });
    expect(cuts.firstGeneration).toEqual({ key: 'First-generation', open: 0, p1: 0, avgScore: 0 });
  });
});

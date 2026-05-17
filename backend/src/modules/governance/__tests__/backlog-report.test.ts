import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Backlog } from '../../../models/academic-ops/Backlog';
import { Course } from '../../../models/academic-ops/Course';
import { Department } from '../../../models/academic-structure/Department';
import { runReport, ADMIN_FULL_SCOPE } from '../report-service';
import type { AuthScope } from '../../../shared/rbac/types';

/**
 * Phase B Wave 1 — backlog-report runner.
 *
 * Coverage:
 *   1. Active backlogs grouped by (department, course); cleared rows excluded.
 *   2. Counts distinct students per cell (not row count).
 *   3. Optional departmentId param filters by Course.departmentId.
 *   4. HOD/faculty authScope auto-filters by their departmentId.
 *   5. Multi-tenancy: tenant-B Backlog rows never appear in tenant-A admin run.
 */

const oid = () => new mongoose.Types.ObjectId();

describe('runReport — backlog-report (Phase B Wave 1)', () => {
  let collegeA: mongoose.Types.ObjectId;
  let collegeB: mongoose.Types.ObjectId;
  let deptCSE: mongoose.Types.ObjectId;
  let deptECE: mongoose.Types.ObjectId;
  let deptB1: mongoose.Types.ObjectId;
  let courseDSA: mongoose.Types.ObjectId;
  let courseDLD: mongoose.Types.ObjectId;
  let courseB1: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  async function seedFixture() {
    collegeA = oid();
    collegeB = oid();

    // Two departments in tenant A.
    const cse = await Department.create({ collegeId: collegeA, code: 'CSE', name: 'Computer Science', isActive: true });
    const ece = await Department.create({ collegeId: collegeA, code: 'ECE', name: 'Electronics', isActive: true });
    const b1 = await Department.create({ collegeId: collegeB, code: 'B1-CSE', name: 'Tenant B CSE', isActive: true });
    deptCSE = cse._id as mongoose.Types.ObjectId;
    deptECE = ece._id as mongoose.Types.ObjectId;
    deptB1 = b1._id as mongoose.Types.ObjectId;

    const regId = oid();
    // 2 courses in CSE, 1 in ECE, 1 in tenant B.
    const dsa = await Course.create({ collegeId: collegeA, code: 'CS201', name: 'Data Structures', regulationId: regId, departmentId: deptCSE, credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false });
    const dld = await Course.create({ collegeId: collegeA, code: 'EC101', name: 'Digital Logic', regulationId: regId, departmentId: deptECE, credits: 3, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: false });
    const csetheory = await Course.create({ collegeId: collegeA, code: 'CS301', name: 'Theory of Computation', regulationId: regId, departmentId: deptCSE, credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false });
    const b1course = await Course.create({ collegeId: collegeB, code: 'B1-201', name: 'Tenant B DS', regulationId: regId, departmentId: deptB1, credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false });
    courseDSA = dsa._id as mongoose.Types.ObjectId;
    courseDLD = dld._id as mongoose.Types.ObjectId;
    const courseTheory = csetheory._id as mongoose.Types.ObjectId;
    courseB1 = b1course._id as mongoose.Types.ObjectId;

    // Backlogs:
    // - 3 distinct students with DSA backlog (active)
    // - 1 student has DSA backlog cleared (should be EXCLUDED)
    // - 2 distinct students with DLD backlog (active)
    // - 1 student with Theory backlog (active) — should appear under CSE/Theory of Computation
    // - 5 students with tenant-B backlog (should never appear in tenant-A run)
    const studentA = oid();
    const studentB = oid();
    const studentC = oid();
    const studentD = oid();
    const semId = oid();
    await Backlog.create({ collegeId: collegeA, studentId: studentA, courseId: courseDSA, semesterId: semId, originalExamType: 'regular', attempts: 1, currentStatus: 'created' });
    await Backlog.create({ collegeId: collegeA, studentId: studentB, courseId: courseDSA, semesterId: semId, originalExamType: 'regular', attempts: 1, currentStatus: 'persists' });
    await Backlog.create({ collegeId: collegeA, studentId: studentC, courseId: courseDSA, semesterId: semId, originalExamType: 'regular', attempts: 1, currentStatus: 'appeared' });
    await Backlog.create({ collegeId: collegeA, studentId: studentD, courseId: courseDSA, semesterId: semId, originalExamType: 'regular', attempts: 2, currentStatus: 'cleared', clearedInSemesterId: semId, clearedGrade: 'C', clearedAt: new Date() });
    await Backlog.create({ collegeId: collegeA, studentId: studentA, courseId: courseDLD, semesterId: semId, originalExamType: 'regular', attempts: 1, currentStatus: 'created' });
    await Backlog.create({ collegeId: collegeA, studentId: studentB, courseId: courseDLD, semesterId: semId, originalExamType: 'regular', attempts: 1, currentStatus: 'created' });
    await Backlog.create({ collegeId: collegeA, studentId: studentA, courseId: courseTheory, semesterId: semId, originalExamType: 'regular', attempts: 1, currentStatus: 'created' });
    // Tenant B backlogs (must not leak).
    for (let i = 0; i < 5; i++) {
      await Backlog.create({ collegeId: collegeB, studentId: oid(), courseId: courseB1, semesterId: oid(), originalExamType: 'regular', attempts: 1, currentStatus: 'created' });
    }
  }

  it('admin run: lists active backlogs grouped by department + course, distinct students counted', async () => {
    await seedFixture();
    const run = await runReport(String(collegeA), 'backlog-report', {}, 'admin', ADMIN_FULL_SCOPE);
    expect(run.status).toBe('success');
    const rows = run.result as Array<{ department: string; course: string; studentCount: number }>;
    // Expected groups: (CSE, DSA): 3 students, (CSE, Theory): 1 student, (ECE, DLD): 2 students.
    const byKey = new Map(rows.map((r) => [`${r.department}|${r.course}`, r.studentCount]));
    expect(byKey.get('Computer Science|CS201 — Data Structures')).toBe(3);
    expect(byKey.get('Computer Science|CS301 — Theory of Computation')).toBe(1);
    expect(byKey.get('Electronics|EC101 — Digital Logic')).toBe(2);
    expect(rows).toHaveLength(3);
    // Tenant B's "Tenant B CSE" department must NOT appear.
    expect(rows.find((r) => r.department === 'Tenant B CSE')).toBeUndefined();
  });

  it('cleared backlogs are excluded from the count', async () => {
    await seedFixture();
    const run = await runReport(String(collegeA), 'backlog-report', {}, 'admin', ADMIN_FULL_SCOPE);
    const rows = run.result as Array<{ department: string; course: string; studentCount: number }>;
    const dsa = rows.find((r) => r.course === 'CS201 — Data Structures');
    // 4 raw rows in DSA but one is `cleared` — should count 3 distinct students.
    expect(dsa?.studentCount).toBe(3);
  });

  it('explicit departmentId param filters by Course.departmentId', async () => {
    await seedFixture();
    const run = await runReport(String(collegeA), 'backlog-report', { departmentId: String(deptCSE) }, 'admin', ADMIN_FULL_SCOPE);
    const rows = run.result as Array<{ department: string }>;
    expect(rows.every((r) => r.department === 'Computer Science')).toBe(true);
    expect(rows).toHaveLength(2); // DSA + Theory
  });

  it('HOD authScope.departmentId auto-filters by department even without an explicit param', async () => {
    await seedFixture();
    const hodCSEScope: AuthScope = {
      departmentOnly: true,
      selfOnly: false,
      departmentId: String(deptCSE),
      userId: 'hod-cse-user',
      resolvedPermissions: [],
    };
    const run = await runReport(String(collegeA), 'backlog-report', {}, 'hod-cse', hodCSEScope);
    const rows = run.result as Array<{ department: string }>;
    expect(rows.every((r) => r.department === 'Computer Science')).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('HOD of ECE sees only ECE backlogs', async () => {
    await seedFixture();
    const hodECEScope: AuthScope = {
      departmentOnly: true,
      selfOnly: false,
      departmentId: String(deptECE),
      userId: 'hod-ece-user',
      resolvedPermissions: [],
    };
    const run = await runReport(String(collegeA), 'backlog-report', {}, 'hod-ece', hodECEScope);
    const rows = run.result as Array<{ department: string; studentCount: number }>;
    expect(rows.every((r) => r.department === 'Electronics')).toBe(true);
    expect(rows[0]?.studentCount).toBe(2);
  });

  it('cross-tenant attacker: forging an authScope.departmentId from tenant A while running against tenant B returns no leaks', async () => {
    await seedFixture();
    const attackerScope: AuthScope = {
      departmentOnly: true,
      selfOnly: false,
      departmentId: String(deptCSE), // tenant A's dept
      userId: 'attacker',
      resolvedPermissions: [],
    };
    const run = await runReport(String(collegeB), 'backlog-report', {}, 'attacker', attackerScope);
    const rows = (run.result || []) as Array<unknown>;
    // No tenant-A courses live in tenant B → zero rows; collegeId filter binds first.
    expect(rows).toHaveLength(0);
  });
});

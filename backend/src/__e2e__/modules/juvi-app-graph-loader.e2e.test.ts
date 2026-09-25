import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { provisionTestStudent, provisionTestFaculty } from '../factories/juvi.factory';
import { Department, Section, HostelBlock, HostelRoom, HostelAllocation } from '../../models';
import { loadCollegeGraph, loadAccountGraph } from '../../modules/juvi-app/spaces/graph-loader';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

async function scenario() {
  const stu = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  const fac = await provisionTestFaculty(fx);
  await Department.updateOne({ _id: fx.cse._id }, { $set: { hodId: fac.faculty._id } });
  await Section.updateOne({ _id: fx.cseSection._id }, { $set: { classAdvisorId: fac.faculty._id } });
  const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id), code: 'CS201', name: 'DBMS' });
  const active = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
  await active.updateOne({ $set: { status: 'active' } });
  const upcoming = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem2._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
  await upcoming.updateOne({ $set: { status: 'active' } });
  await createTestEnrollment(fx.collegeId, { studentId: String(stu.student._id), courseOfferingId: String(active._id), semesterId: String(fx.sem1._id) });
  const block = await HostelBlock.create({ collegeId: fx.collegeId, name: 'Aravali', type: 'boys', totalRooms: 10, wardenId: fac.person._id });
  const room = await HostelRoom.create({ collegeId: fx.collegeId, blockId: block._id, roomNumber: '101', floor: 1, capacity: 2 });
  await HostelAllocation.create({ collegeId: fx.collegeId, studentId: stu.student._id, roomId: room._id, academicYearId: fx.ay._id, status: 'active' });
  return { stu, fac, active, upcoming, block };
}

describe('loadCollegeGraph', () => {
  it('loads eligible accounts, metadata maps and scope objects', async () => {
    const { stu, fac, active, upcoming, block } = await scenario();
    const g = await loadCollegeGraph(fx.collegeId);
    expect(g.accounts.size).toBe(2);
    const s = g.accounts.get(String(stu.account._id))!;
    expect(s.student).toMatchObject({ batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id), sectionIds: [String(fx.cseSection._id)], enrolledOfferingIds: [String(active._id)], hostelBlockId: String(block._id) });
    const f = g.accounts.get(String(fac.account._id))!;
    expect(f.faculty).toMatchObject({ facultyId: String(fac.faculty._id), departmentId: String(fx.cse._id), contractType: 'regular' });
    expect(g.branchDepartment.get(String(fx.cseBranch._id))).toBe(String(fx.cse._id));
    expect(g.departments.get(String(fx.cse._id))).toEqual({ hodFacultyId: String(fac.faculty._id) });
    expect(g.sections.get(String(fx.cseSection._id))).toMatchObject({ batchId: String(fx.batch._id), classAdvisorId: String(fac.faculty._id) });
    expect(g.offerings.get(String(active._id))).toEqual({ sectionId: String(fx.cseSection._id), facultyIds: [String(fac.faculty._id)], enrollmentCount: 1 });
    expect(g.offerings.has(String(upcoming._id))).toBe(false);          // sem2 is upcoming, not active
    expect(g.blocks.get(String(block._id))).toEqual({ wardenPersonId: String(fac.person._id), chiefWardenStaffId: undefined });
    expect(g.scopes.departmentIds.sort()).toEqual([String(fx.cse._id), String(fx.ece._id)].sort());
    expect(g.scopes.batchIds).toEqual([String(fx.batch._id)]);
    expect(g.scopes.offerings).toEqual([{ id: String(active._id), semesterId: String(fx.sem1._id), courseCode: 'CS201', courseName: 'DBMS', sectionName: 'A' }]);
    expect(g.scopes.blockIds).toEqual([String(block._id)]);
    expect(g.names.college).toBe('JIT Test College');
    expect(g.names.batches.get(String(fx.batch._id))).toBe('2024');
  });

  it('excludes deactivated accounts and lists ended offerings', async () => {
    const { stu, active } = await scenario();
    const { deactivateAccount } = await import('../../modules/juvi-app/accounts/provisioning-service');
    await deactivateAccount(fx.collegeId, String(stu.account._id), 'admin', 'x');
    await fx.sem1.updateOne({ $set: { status: 'completed' } });
    const g = await loadCollegeGraph(fx.collegeId);
    expect(g.accounts.has(String(stu.account._id))).toBe(false);
    expect(g.offerings.has(String(active._id))).toBe(false);
    expect(g.scopes.endedOfferingIds).toEqual([String(active._id)]);
  });
});

describe('loadAccountGraph', () => {
  it('loads one account with the same node shape and the college metadata', async () => {
    const { stu, active } = await scenario();
    const g = await loadAccountGraph(fx.collegeId, String(stu.account._id));
    expect(g.accounts.size).toBe(1);
    expect(g.accounts.get(String(stu.account._id))!.student!.enrolledOfferingIds).toEqual([String(active._id)]);
    expect(g.offerings.get(String(active._id))!.enrollmentCount).toBe(1);
    expect(g.departments.size).toBe(2);
  });

  it('returns no accounts for a deactivated or foreign account', async () => {
    const { stu } = await scenario();
    expect((await loadAccountGraph('000000000000000000000099', String(stu.account._id))).accounts.size).toBe(0);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { provisionTestStudent, provisionTestFaculty } from '../factories/juvi.factory';
import { Department, Section, HostelBlock, HostelRoom, HostelAllocation, Enrollment } from '../../models';
import { Channel } from '../../models/juvi/Channel';
import { ChannelMembership } from '../../models/juvi/ChannelMembership';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { reconcileCollege, reconcileAccount } from '../../modules/juvi-app/spaces/reconcile-service';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

async function scenario() {
  const stu = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  const stu2 = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  const fac = await provisionTestFaculty(fx);
  await Department.updateOne({ _id: fx.cse._id }, { $set: { hodId: fac.faculty._id } });
  await Section.updateOne({ _id: fx.cseSection._id }, { $set: { classAdvisorId: fac.faculty._id } });
  const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id), code: 'CS201', name: 'DBMS' });
  const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
  await off.updateOne({ $set: { status: 'active' } });
  await createTestEnrollment(fx.collegeId, { studentId: String(stu.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
  await createTestEnrollment(fx.collegeId, { studentId: String(stu2.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
  const block = await HostelBlock.create({ collegeId: fx.collegeId, name: 'Aravali', type: 'boys', totalRooms: 10, wardenId: fac.person._id });
  const room = await HostelRoom.create({ collegeId: fx.collegeId, blockId: block._id, roomNumber: '101', floor: 1, capacity: 2 });
  await HostelAllocation.create({ collegeId: fx.collegeId, studentId: stu.student._id, roomId: room._id, academicYearId: fx.ay._id, status: 'active' });
  return { stu, stu2, fac, off, block };
}
const roleOf = async (accountId: unknown, channel: any) => (await ChannelMembership.findOne({ accountId, channelId: channel._id }).lean())?.role ?? null;

describe('reconcileCollege', () => {
  it('creates one channel per scope object, names them, and applies memberships with roles', async () => {
    const { stu, fac, off, block } = await scenario();
    const summary = await reconcileCollege(fx.collegeId);
    expect(summary.skipped).toBe(false);
    expect(summary.channels).toEqual({ created: 6, archived: 0, unarchived: 0, total: 6 });
    expect(summary.errors).toBe(0);

    const byScope = async (scopeType: string, scopeId: unknown = null) => (await Channel.findOne({ collegeId: fx.collegeId, scopeType, scopeId }).lean())!;
    const college = await byScope('college'); const dept = await byScope('department', fx.cse._id);
    const batch = await byScope('batch', fx.batch._id); const courseCh = await byScope('course_offering', off._id); const hostel = await byScope('hostel_block', block._id);
    expect(college.name).toBe('JIT Test College'); expect(college.replyRule).toBe('announcement_only');
    expect(courseCh.name).toBe('CS201 DBMS · A'); expect(String(courseCh.semesterId)).toBe(String(fx.sem1._id));
    expect(batch.name).toBe('2024 Batch'); expect(hostel.name).toBe('Aravali Hostel');

    expect(await roleOf(stu.account._id, college)).toBe('member');
    expect(await roleOf(stu.account._id, dept)).toBe('member');
    expect(await roleOf(stu.account._id, courseCh)).toBe('member');
    expect(await roleOf(stu.account._id, hostel)).toBe('member');
    expect(await roleOf(fac.account._id, dept)).toBe('publisher');       // HOD
    expect(await roleOf(fac.account._id, batch)).toBe('publisher');      // class advisor
    expect(await roleOf(fac.account._id, courseCh)).toBe('publisher');   // teaches
    expect(await roleOf(fac.account._id, hostel)).toBe('publisher');     // warden
    expect(await roleOf(fac.account._id, await byScope('department', fx.ece._id))).toBeNull();
    expect(courseCh.memberCount).toBe(3);
    expect(summary.memberships.added).toBe(await ChannelMembership.countDocuments({ collegeId: fx.collegeId }));
    expect((await JuviAccount.findById(stu.account._id).lean())?.lastReconciledAt).toBeInstanceOf(Date);
  });

  it('is idempotent and archives course channels when the semester completes', async () => {
    const { off } = await scenario();
    await reconcileCollege(fx.collegeId);
    const again = await reconcileCollege(fx.collegeId);
    expect(again.channels).toEqual({ created: 0, archived: 0, unarchived: 0, total: 6 });
    expect(again.memberships).toEqual({ added: 0, removed: 0, roleChanged: 0 });

    await fx.sem1.updateOne({ $set: { status: 'completed' } });
    const after = await reconcileCollege(fx.collegeId);
    expect(after.channels.archived).toBe(1);
    const ch = await Channel.findOne({ scopeId: off._id }).lean();
    expect(ch?.status).toBe('archived');
    expect(ch?.archivedAt).toBeInstanceOf(Date);
    expect(await ChannelMembership.countDocuments({ channelId: ch!._id })).toBe(3);   // memberships kept, read-only

    await fx.sem1.updateOne({ $set: { status: 'active' } });
    expect((await reconcileCollege(fx.collegeId)).channels.unarchived).toBe(1);
  });

  it('demotes a role when the HOD changes', async () => {
    const { fac } = await scenario();
    await reconcileCollege(fx.collegeId);
    await Department.updateOne({ _id: fx.cse._id }, { $unset: { hodId: 1 } });
    const s = await reconcileCollege(fx.collegeId);
    expect(s.memberships.roleChanged).toBeGreaterThanOrEqual(1);
    const dept = await Channel.findOne({ scopeType: 'department', scopeId: fx.cse._id }).lean();
    expect(await roleOf(fac.account._id, dept)).toBe('member');
  });
});

describe('reconcileAccount', () => {
  it('adds and removes only that account\'s memberships after an ERP change', async () => {
    const { stu, stu2, off } = await scenario();
    await reconcileCollege(fx.collegeId);
    await Enrollment.updateOne({ studentId: stu.student._id, courseOfferingId: off._id }, { $set: { status: 'dropped' } });
    const diff = await reconcileAccount(fx.collegeId, String(stu.account._id));
    expect(diff).toEqual({ added: 0, removed: 1, roleChanged: 0 });
    const ch = await Channel.findOne({ scopeId: off._id }).lean();
    expect(await roleOf(stu.account._id, ch)).toBeNull();
    expect(await roleOf(stu2.account._id, ch)).toBe('member');
    expect((await Channel.findById(ch!._id).lean())?.memberCount).toBe(2);

    await Enrollment.updateOne({ studentId: stu.student._id, courseOfferingId: off._id }, { $set: { status: 'enrolled' } });
    expect(await reconcileAccount(fx.collegeId, String(stu.account._id))).toEqual({ added: 1, removed: 0, roleChanged: 0 });
  });

  it('does nothing for a foreign or deactivated account', async () => {
    const { stu } = await scenario();
    await reconcileCollege(fx.collegeId);
    expect(await reconcileAccount('000000000000000000000099', String(stu.account._id))).toEqual({ added: 0, removed: 0, roleChanged: 0 });
  });
});

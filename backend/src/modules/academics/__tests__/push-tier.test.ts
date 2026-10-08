import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { classifyExceptionPushTier } from '../push-tier';
import { previewClassException } from '../class-exception-service';
import { Timetable } from '../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { Course, CourseOffering, Enrollment } from '../../../models';
import { Person, Faculty, Student } from '../../../models';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

// The `../../../models` barrel registers every model, so mongoose kicks off index
// builds for all of them against the memory server; the first `clearCollections`
// then queues behind that work and overruns vitest's 10s hook default. Same remedy
// as scripts/demo-seed/__tests__/breadth.test.ts (the repo's other barrel importer).
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const TZ = 'Asia/Kolkata';
const base = new Date('2026-10-08T05:00:00.000Z'); // 10:30 IST

describe('classifyExceptionPushTier (§8)', () => {
  it('urgent when the original class starts today within 2 hours', () => {
    // Original start 2026-10-08 11:00 IST = 05:30Z; 30 min after base.
    expect(classifyExceptionPushTier('2026-10-08', '11:00', ['2026-10-08'], base, TZ)).toBe('urgent');
  });
  it('the 2h boundary is inclusive (exactly 2h → urgent)', () => {
    // start 10:00 IST = 04:30Z. 02:30Z is exactly 120 min before the start → urgent
    // (the window is delta > 0 && delta <= 2h, inclusive on the far edge); 02:29Z is
    // one minute more to wait (121 min) → important.
    expect(classifyExceptionPushTier('2026-10-08', '10:00', ['2026-10-08'], new Date('2026-10-08T02:30:00.000Z'), TZ)).toBe('urgent');
    expect(classifyExceptionPushTier('2026-10-08', '10:00', ['2026-10-08'], new Date('2026-10-08T02:29:00.000Z'), TZ)).toBe('important');
  });
  it('important when the class already started today, or the date is today or tomorrow', () => {
    // Started 59 min ago.
    expect(classifyExceptionPushTier('2026-10-08', '10:00', ['2026-10-08'], new Date('2026-10-08T05:29:00.000Z'), TZ)).toBe('important');
    expect(classifyExceptionPushTier('2026-10-08', '10:00', ['2026-10-09'], base, TZ)).toBe('important');
  });
  it('none beyond tomorrow', () => {
    expect(classifyExceptionPushTier('2026-10-08', '10:00', ['2026-10-11'], base, TZ)).toBe('none');
    expect(classifyExceptionPushTier('2026-10-08', '10:00', [], base, TZ)).toBe('none');
  });
});

const CID2 = '000000000000000000000003';

async function seedPreview(opts: { enrolled?: boolean } = {}) {
  const person = await Person.create({ collegeId: new Types.ObjectId(CID2), name: 'Prof. Rao', phone: '9000090001', gender: 'male' });
  const faculty = await Faculty.create({
    collegeId: new Types.ObjectId(CID2), personId: person._id, employeeCode: 'FAC9001',
    designation: 'Assistant Professor', contractType: 'regular', status: 'active',
  });
  const course = await Course.create({
    collegeId: new Types.ObjectId(CID2), code: 'CS401', name: 'Networks',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 3, lectureHrs: 2, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const offering = await CourseOffering.create({
    collegeId: new Types.ObjectId(CID2), courseId: course._id, semesterId: new Types.ObjectId(),
    sectionId: new Types.ObjectId(), facultyId: faculty._id, maxEnrollment: 60, enrolledCount: 60,
  });
  const tt = await Timetable.create({
    collegeId: new Types.ObjectId(CID2), semesterId: new Types.ObjectId(), sectionId: new Types.ObjectId(),
    version: 1, status: 'published', effectiveFrom: new Date(),
  });
  const slot = await TimetableSlot.create({
    collegeId: new Types.ObjectId(CID2), timetableId: tt._id, day: 'monday', period: 1,
    startTime: '09:00', endTime: '10:00', courseOfferingId: offering._id,
  });
  if (opts.enrolled) {
    const sp = await Person.create({ collegeId: new Types.ObjectId(CID2), name: 'Test Student', phone: '9000090002', gender: 'male' });
    const st = await Student.create({
      collegeId: new Types.ObjectId(CID2), personId: sp._id, admissionYear: 2026,
      rollNumber: '26JIT9001', status: 'active', onboardingStatus: 'not_started',
    });
    await Enrollment.create({
      collegeId: new Types.ObjectId(CID2), studentId: st._id, courseOfferingId: offering._id,
      semesterId: offering.semesterId, status: 'enrolled', enrolledAt: new Date(),
    });
  }
  return { slot };
}

/** A date n days from now, in Asia/Kolkata (pure plumbing tests; the tier boundary cases are pinned above). */
function ist(nDaysFromNow: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + nDaysFromNow * 86_400_000));
}

describe('previewClassException (§5.1)', () => {
  it('counts enrolled students and names faculty, omits newDate', async () => {
    const { slot } = await seedPreview({ enrolled: true });
    const out = await previewClassException(CID2, String(slot._id), ist(9));
    expect(out.affectedStudents).toBe(1);
    expect(out.faculty).toEqual(['Prof. Rao']);
    expect(out.pushTier).toBe('none'); // single affected date 9 days out
    expect(out.newDate).toBeUndefined();
  });

  it('derives the tier from the optional newDate', async () => {
    const { slot } = await seedPreview({ enrolled: true });
    const out = await previewClassException(CID2, String(slot._id), ist(9), new Date(), ist(1));
    expect(out.pushTier).toBe('important'); // affected = [9 days out, tomorrow]
    expect(out.newDate).toBe(ist(1));
  });
});

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

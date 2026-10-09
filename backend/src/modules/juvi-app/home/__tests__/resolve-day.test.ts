import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AcademicCalendar } from '../../../../models/academic-ops/AcademicCalendar';
import { Course } from '../../../../models/academic-ops/Course';
import { CourseOffering } from '../../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../../models/academic-ops/Enrollment';
import { Timetable } from '../../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../../models/academic-ops/TimetableSlot';
import { Section } from '../../../../models/academic-structure/Section';
import { Semester } from '../../../../models/academic-structure/Semester';
import { Building } from '../../../../models/campus/Building';
import { Room } from '../../../../models/campus/Room';
import { Channel } from '../../../../models/juvi/Channel';
import { Faculty } from '../../../../models/people/Faculty';
import { Person } from '../../../../models/people/Person';
import { Student } from '../../../../models/people/Student';
import { clearCollections, setupMongo, teardownMongo } from '../../../../__tests__/helpers/mongoMemory';
import { ClassException } from '../../../../models/academic-ops/ClassException';
import { nextTeachingDay, resolveDay } from '../resolve-day';

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });

let collegeId = new Types.ObjectId();
let codeSeq = 0;

interface TeachingWorld {
  semesterId: Types.ObjectId;
  sectionId: Types.ObjectId;
  studentId: string;
  facultyId: string;
  altFacultyId: string;
  substitutePersonId: string;
  makeOffering: (facultyId: Types.ObjectId, enrolledCount?: number) => Promise<Types.ObjectId>;
  makeTimetable: (version: number, slots: { day: string; start: string; end: string; period: number; offeringId: Types.ObjectId; roomId?: Types.ObjectId | null; substituteFacultyId?: Types.ObjectId | null; originalFacultyId?: Types.ObjectId | null }[]) => Promise<Types.ObjectId>;
  roomId: Types.ObjectId;
}

async function seedTeachingWorld(): Promise<TeachingWorld> {
  const semester = await Semester.create({
    collegeId, academicYearId: new Types.ObjectId(), number: 1, year: 2,
    startDate: new Date('2026-06-01T00:00:00Z'), endDate: new Date('2026-12-01T00:00:00Z'), status: 'active',
  });
  const semesterId = semester._id as Types.ObjectId;
  const section = await Section.create({
    collegeId, name: 'CSE-A', branchId: new Types.ObjectId(), batchId: new Types.ObjectId(),
    year: 2, semester: 1, capacity: 60, studentIds: [],
  });
  const teacher = await Person.create({ collegeId, name: 'Dr. Rao', phone: '9000090001', gender: 'male' });
  const studentPerson = await Person.create({ collegeId, name: 'Test Student', phone: '9000090002', gender: 'male' });
  const substitute = await Person.create({ collegeId, name: 'Dr. Sub', phone: '9000090003', gender: 'female' });
  const faculty = await Faculty.create({ collegeId, personId: teacher._id, employeeCode: `FAC${codeSeq++}`, designation: 'Professor', contractType: 'regular', status: 'active' });
  const altFaculty = await Faculty.create({ collegeId, personId: substitute._id, employeeCode: `FAC${codeSeq++}`, designation: 'Professor', contractType: 'regular', status: 'active' });
  const student = await Student.create({
    collegeId, personId: studentPerson._id, admissionYear: 2026,
    rollNumber: `26JIT${codeSeq++}`, status: 'active', onboardingStatus: 'not_started',
  });
  const course = await Course.create({
    collegeId, code: 'CS101', name: 'Intro to CS',
    regulationId: new Types.ObjectId(), departmentId: new Types.ObjectId(),
    credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false,
  });
  const building = await Building.create({ collegeId, name: 'Alpha Block', code: `AB${codeSeq++}`, floors: 3, totalRooms: 30 });
  const room = await Room.create({
    collegeId, buildingId: building._id, roomNumber: '101', floor: 1, type: 'classroom', capacity: 60,
  });
  const makeOffering = (offFacultyId: Types.ObjectId, enrolledCount = 0): Promise<Types.ObjectId> =>
    CourseOffering.create({
      collegeId, courseId: course._id, semesterId, sectionId: section._id,
      facultyId: offFacultyId, maxEnrollment: 60, enrolledCount,
    }).then((o) => o._id as Types.ObjectId);
  const makeTimetable = async (
    version: number,
    slots: {
      day: string; start: string; end: string; period: number; offeringId: Types.ObjectId;
      roomId?: Types.ObjectId | null; substituteFacultyId?: Types.ObjectId | null; originalFacultyId?: Types.ObjectId | null;
    }[],
  ): Promise<Types.ObjectId> => {
    const tt = await Timetable.create({
      collegeId, semesterId, sectionId: section._id, version,
      status: 'published', effectiveFrom: new Date('2026-10-01T00:00:00Z'),
    });
    for (const s of slots) {
      await TimetableSlot.create({
        collegeId, timetableId: tt._id, day: s.day, period: s.period,
        startTime: s.start, endTime: s.end, courseOfferingId: s.offeringId,
        roomId: s.roomId ?? room._id, slotType: s.roomId === null ? 'free' : 'lecture',
        substituteFacultyId: s.substituteFacultyId ?? undefined,
        originalFacultyId: s.originalFacultyId ?? undefined,
      });
    }
    return tt._id as Types.ObjectId;
  };
  return {
    semesterId: semester._id, sectionId: section._id,
    studentId: String(student._id), facultyId: String(faculty._id), altFacultyId: String(altFaculty._id),
    substitutePersonId: String(substitute._id),
    makeOffering, makeTimetable, roomId: room._id,
  };
}

async function enroll(studentId: string, offeringId: Types.ObjectId): Promise<void> {
  await Enrollment.create({
    collegeId, studentId: new Types.ObjectId(studentId), courseOfferingId: offeringId,
    semesterId: new Types.ObjectId('000000000000000000000000'), status: 'enrolled', enrolledAt: new Date(),
  });
}

async function enrollIn(semesterId: Types.ObjectId, studentId: string, offeringId: Types.ObjectId): Promise<void> {
  await Enrollment.create({
    collegeId, studentId: new Types.ObjectId(studentId), courseOfferingId: offeringId,
    semesterId, status: 'enrolled', enrolledAt: new Date(),
  });
}

async function cancelException(offeringId: Types.ObjectId, slotId: Types.ObjectId, date: string): Promise<void> {
  await ClassException.create({
    collegeId, timetableSlotId: slotId, courseOfferingId: offeringId, date,
    type: 'cancelled', reason: 'Faculty unavailable today', createdBy: new Types.ObjectId(),
  });
}

async function rescheduleException(
  offeringId: Types.ObjectId, slotId: Types.ObjectId, date: string, newDate: string,
  newStart: string, newEnd: string, newRoomId?: Types.ObjectId,
): Promise<void> {
  await ClassException.create({
    collegeId, timetableSlotId: slotId, courseOfferingId: offeringId, date,
    type: 'rescheduled', newDate, newStartTime: newStart, newEndTime: newEnd,
    ...(newRoomId ? { newRoomId } : {}),
    reason: 'Moved for the day', createdBy: new Types.ObjectId(),
  });
}

async function publishHoliday(title: string, date: string): Promise<void> {
  await AcademicCalendar.create({
    collegeId, academicYearId: new Types.ObjectId(), title,
    eventType: 'holiday', startDate: new Date(`${date}T00:00:00Z`),
    endDate: new Date(`${date}T00:00:00Z`), isHoliday: true, status: 'published',
  });
}

describe('resolveDay', () => {
  beforeEach(async () => { await clearCollections(); });

  it('shows a student their active-semester classes, decorated and sorted (§11 row 1)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId, 2);
    const b = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await enrollIn(w.semesterId, w.studentId, b);
    await w.makeTimetable(1, [
      { day: 'monday', start: '10:00', end: '11:00', period: 2, offeringId: a, roomId: w.roomId },
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: b },
    ]);
    await Channel.create({
      collegeId, type: 'official', templateCode: 'course', scopeType: 'course_offering',
      scopeId: a, name: 'CS101 A', about: 'Course discussion',
      postingRule: 'publishers_only', replyRule: 'allowed', defaultPriority: 'routine',
    });
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.date).toBe('2026-11-09');
    expect(day.holiday).toBeUndefined();
    expect(day.classes.map((c) => c.start)).toEqual(['09:00', '10:00']);
    expect(day.classes[0]).toMatchObject({ offeringId: String(b), courseCode: 'CS101', title: 'Intro to CS', section: 'CSE-A', slotType: 'lecture', status: 'scheduled' });
    expect(day.classes[0]!.faculty).toBe('Dr. Rao');
    expect(day.classes[0]!.channelId).toBeUndefined();
    expect(day.classes[1]!.room).toBe('101, Alpha Block');
    expect(day.classes[1]!.channelId).toBeTruthy();
    expect(day.classes[0]!.registered).toBeUndefined();
  });

  it('gives faculty viewers registered counts and drops no classes (§11 row 2)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId, 37);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
    ]);
    const day = await resolveDay(collegeId.toString(), { kind: 'faculty', facultyId: w.facultyId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.classes).toHaveLength(1);
    expect(day.classes[0]!.registered).toBe(37);
  });

  it('resolves substitutions for both viewers (§11 row 3)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    const tt = await w.makeTimetable(1, []);
    await TimetableSlot.create({
      collegeId, timetableId: tt, day: 'monday', period: 1,
      startTime: '09:00', endTime: '10:00', courseOfferingId: a,
      slotType: 'lecture', substituteFacultyId: new Types.ObjectId(w.altFacultyId),
      originalFacultyId: new Types.ObjectId(w.facultyId), isSubstitution: true,
    });
    const dayStudent = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(dayStudent.classes[0]!.faculty).toBe('Dr. Sub');
    const daySub = await resolveDay(collegeId.toString(), { kind: 'faculty', facultyId: w.altFacultyId }, '2026-11-09', 'Asia/Kolkata');
    expect(daySub.classes.map((c) => c.offeringId)).toEqual([String(a)]);
    const dayOriginal = await resolveDay(collegeId.toString(), { kind: 'faculty', facultyId: w.facultyId }, '2026-11-09', 'Asia/Kolkata');
    expect(dayOriginal.classes).toHaveLength(0);
  });

  it('keeps a cancelled class visible with status cancelled (§11 row 4)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [{ day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a }]);
    const slot = (await TimetableSlot.find({ collegeId }).lean())[0]!;
    await cancelException(a, slot._id, '2026-11-09');
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.classes).toHaveLength(1);
    expect(day.classes[0]!.status).toBe('cancelled');
  });

  it('moves a class off its original date and onto the new one (§11 row 5)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
      { day: 'friday', start: '14:00', end: '15:00', period: 6, offeringId: a },
    ]);
    const fridaySlot = (await TimetableSlot.find({ collegeId, day: 'friday' }).lean())[0]!;
    await rescheduleException(a, fridaySlot._id, '2026-11-13', '2026-11-09', '13:00', '14:00');
    const source = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-13', 'Asia/Kolkata');
    expect(source.classes).toHaveLength(0);
    const moved = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    // Two classes: the offering's own Monday 09:00 slot is still live; the rescheduled 13:00 class is the addition.
    expect(moved.classes).toHaveLength(2);
    expect(moved.classes[1]).toMatchObject({ status: 'rescheduled', start: '13:00', end: '14:00', movedFrom: { date: '2026-11-13', start: '14:00' } });
  });

  it('returns a holiday day with no classes for a published holiday (§11 row 6)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [{ day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a }]);
    await publishHoliday('Diwali', '2026-11-09');
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.holiday).toBe('Diwali');
    expect(day.classes).toHaveLength(0);
  });

  it('hides a class rescheduled INTO a published holiday (Review Focus #4)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [{ day: 'friday', start: '14:00', end: '15:00', period: 6, offeringId: a }]);
    const fridaySlot = (await TimetableSlot.find({ collegeId, day: 'friday' }).lean())[0]!;
    await rescheduleException(a, fridaySlot._id, '2026-11-13', '2026-11-09', '13:00', '14:00');
    await publishHoliday('Diwali', '2026-11-09');
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.holiday).toBe('Diwali');
    expect(day.classes).toHaveLength(0);
  });

  it('shows a cancelled class and a move-in together on the same day, sorted (Review Focus #2)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    const b = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await enrollIn(w.semesterId, w.studentId, b);
    await w.makeTimetable(1, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
      { day: 'friday', start: '10:00', end: '11:00', period: 2, offeringId: b },
    ]);
    const mondaySlot = (await TimetableSlot.find({ collegeId, day: 'monday' }).lean())[0]!;
    const fridaySlot = (await TimetableSlot.find({ collegeId, day: 'friday' }).lean())[0]!;
    await cancelException(a, mondaySlot._id, '2026-11-09');
    await rescheduleException(b, fridaySlot._id, '2026-11-13', '2026-11-09', '08:00', '09:00');
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.classes.map((c) => [c.status, c.start])).toEqual([['rescheduled', '08:00'], ['cancelled', '09:00']]);
    expect(day.classes[0]!.movedFrom).toEqual({ date: '2026-11-13', start: '10:00' });
  });

  it('handles a student with no enrollments and an offering without a faculty person (Review Focus #5)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId, 0);
    await w.makeTimetable(1, [{ day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a }]);
    const empty = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(empty.classes).toHaveLength(0);
    const unlinked = await Person.create({ collegeId, name: 'Ghost Faculty', phone: '9000090004', gender: 'male' });
    const ghostFaculty = await Faculty.create({ collegeId, personId: unlinked._id, employeeCode: `FAC${codeSeq++}`, designation: 'Visiting', contractType: 'visiting', status: 'active' });
    await Person.findByIdAndDelete(unlinked._id);
    const b = await w.makeOffering(ghostFaculty._id);
    await enrollIn(w.semesterId, w.studentId, b);
    await w.makeTimetable(2, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
      { day: 'monday', start: '11:00', end: '12:00', period: 3, offeringId: b },
    ]);
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.classes).toHaveLength(1);
    expect(day.classes[0]!.faculty).toBeUndefined();
    const facDay = await resolveDay(collegeId.toString(), { kind: 'faculty', facultyId: w.facultyId }, '2026-11-09', 'Asia/Kolkata');
    expect(facDay.classes[0]!.registered).toBe(0);
  });

  it('returns no classes on a Sunday (R10)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    const stray = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await w.makeTimetable(1, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
      { day: 'saturday', start: '09:00', end: '10:00', period: 1, offeringId: a },
      { day: 'monday', start: '11:00', end: '12:00', period: 2, offeringId: stray },
    ]);
    // The stray zero-semester enrollment goes on a DIFFERENT offering: the Enrollment key
    // (collegeId, courseOfferingId, studentId) is unique, so a second row for `a` collides (E11000).
    await enroll(w.studentId, stray); // stray wrong-semester enrollment must not leak
    const sunday = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-15', 'Asia/Kolkata');
    expect(sunday.classes).toHaveLength(0);
  });

  it('resolves the live timetable version only (§11 row: live rule)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [{ day: 'monday', start: '10:00', end: '11:00', period: 2, offeringId: a }]);
    await w.makeTimetable(2, [{ day: 'monday', start: '08:00', end: '09:00', period: 1, offeringId: a }]);
    const day = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(day.classes.map((c) => c.start)).toEqual(['08:00']);
  });

  it('follows the college-local day, not the UTC day of the instant (R53)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    // 2026-11-09T00:00Z is 05:30 IST on 11-09. `live-timetable.ts` keeps a timetable whose
    // `effectiveFrom` is strictly before the end of the queried LOCAL day, so it matters how
    // that day end is computed. Correct rule: dayStart 2026-11-08T18:30Z, dayEnd
    // 2026-11-09T18:30Z — the instant precedes dayEnd, so the term has opened. Old rule (the
    // UTC day OF THAT INSTANT, i.e. 11-08): dayEnd 2026-11-09T00:00Z — the instant does not
    // precede it, so the term had not opened. The two rules disagree, which is what makes the
    // IST assertion below the one that fails if the boundary regresses to the UTC day; the UTC
    // assertion holds under both rules and merely fixes the term's nominal date.
    const tt = await Timetable.create({
      collegeId, semesterId: w.semesterId, sectionId: w.sectionId,
      version: 1, status: 'published', effectiveFrom: new Date('2026-11-09T00:00:00Z'),
    });
    await TimetableSlot.create({
      collegeId, timetableId: tt._id, day: 'monday', period: 1,
      startTime: '09:00', endTime: '10:00', courseOfferingId: a, slotType: 'lecture',
    });
    const utcDay = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'UTC');
    expect(utcDay.classes).toHaveLength(1);
    const istDay = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(istDay.classes).toHaveLength(1);
  });

  it('reads the day window in the caller\'s timezone (§11 row: timezone)', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    // The window starts at LOCAL midnight of 2026-11-10 in IST — 2026-11-09T18:30Z — so the
    // nominal date 2026-11-09 is inside the term for a UTC college and outside it for an IST
    // one. This pins that `timezone` reaches the window bound at all: a resolveDay that ignored
    // the argument and used the day of the raw date string would return 1 for IST as well.
    // It does NOT pin the local-day-over-UTC-day rule — both expectations hold under either
    // rule, in both timezones — so do not rely on it to catch an R53 regression; the test above
    // is the one that does. Keep it: it is the only test at this layer that fails if the tz
    // argument stops reaching the window.
    const tt = await Timetable.create({
      collegeId, semesterId: w.semesterId, sectionId: w.sectionId,
      version: 1, status: 'published', effectiveFrom: new Date('2026-11-09T18:30:00Z'),
    });
    await TimetableSlot.create({
      collegeId, timetableId: tt._id, day: 'monday', period: 1,
      startTime: '09:00', endTime: '10:00', courseOfferingId: a, slotType: 'lecture',
    });
    const utcDay = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'UTC');
    expect(utcDay.classes).toHaveLength(1);
    const istDay = await resolveDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-09', 'Asia/Kolkata');
    expect(istDay.classes).toHaveLength(0);
  });

  it('scans forward for the next teaching day, skipping holidays and Sundays', async () => {
    const w = await seedTeachingWorld();
    const a = await w.makeOffering(w.facultyId as unknown as Types.ObjectId);
    await enrollIn(w.semesterId, w.studentId, a);
    await w.makeTimetable(1, [
      { day: 'monday', start: '09:00', end: '10:00', period: 1, offeringId: a },
      { day: 'tuesday', start: '09:00', end: '10:00', period: 1, offeringId: a },
    ]);
    await publishHoliday('Diwali', '2026-11-09'); // Monday
    const next = await nextTeachingDay(collegeId.toString(), { kind: 'student', studentId: w.studentId }, '2026-11-08', 'Asia/Kolkata');
    expect(next?.date).toBe('2026-11-10');
  });
});

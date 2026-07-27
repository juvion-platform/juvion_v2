import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { Course } from '../../models/academic-ops/Course';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { AttendanceSession } from '../../models/academic-ops/AttendanceSession';
import { AttendanceRecord } from '../../models/academic-ops/AttendanceRecord';
import { InternalAssessment } from '../../models/academic-ops/InternalAssessment';
import { InternalMark } from '../../models/academic-ops/InternalMark';
import { Faculty } from '../../models/people/Faculty';
import { Person } from '../../models/people/Person';

/**
 * Covers the surfaces added for the attendance-marking grid and the
 * internal-marks sheet:
 *   - GET /academics/offerings/:id/roster
 *   - POST /academics/attendance-records/bulk  (upsert, not insert)
 *   - POST /academics/internal-marks/bulk      (upsert + maxMarks bound)
 *
 * The upsert behaviour is the point: both endpoints previously used
 * insertMany and threw on their unique index the second time a corrected
 * sheet was saved.
 */

let api: TestApi;
let fx: BaseFixtures;
let offeringId: string;
let studentIds: string[];
let facultyId: string;
let markerPersonId: string;

beforeAll(async () => {
  const app = await getTestApp();
  fx = await seedBase();

  const students = [];
  for (let i = 0; i < 3; i++) {
    students.push(await createTestStudent(fx.collegeId, {
      branchId: String(fx.cseBranch._id),
      batchId: String(fx.batch._id),
      programmeId: String(fx.btech._id),
    }));
  }
  studentIds = students.map((s) => String(s.student._id));

  const person = await Person.create({ collegeId: fx.collegeId, name: 'Prof. Rao', phone: '9000000001' });
  const faculty = await Faculty.create({
    collegeId: fx.collegeId, personId: person._id, employeeCode: 'F001',
    designation: 'Assistant Professor', departmentId: fx.cse._id,
    contractType: 'regular', status: 'active',
  });

  facultyId = String(faculty._id);
  markerPersonId = String(person._id);

  const course = await Course.create({
    collegeId: fx.collegeId, code: 'CS201', name: 'Data Structures',
    regulationId: fx.regulation._id, departmentId: fx.cse._id, credits: 4, type: 'theory',
  });

  const offering = await CourseOffering.create({
    collegeId: fx.collegeId, courseId: course._id, semesterId: fx.sem1._id,
    sectionId: fx.cseSection._id, facultyId: faculty._id, status: 'active',
  });
  offeringId = String(offering._id);

  api = createTestApi(app);
});

afterAll(async () => { await cleanupTestApp(); });

beforeEach(async () => {
  await AttendanceRecord.deleteMany({});
  await InternalMark.deleteMany({});
});

describe('GET /api/academics/offerings/:id/roster', () => {
  it('returns the students behind the offering’s section', async () => {
    const res = await api.as(fx.admin.token).get(`/api/academics/offerings/${offeringId}/roster`);
    expect(res.status).toBe(200);
    expect(res.body.sectionId).toBe(String(fx.cseSection._id));
    expect(res.body.students.length).toBeGreaterThanOrEqual(3);
    // Names come through populated so the grid can label rows.
    expect(res.body.students[0]).toHaveProperty('rollNumber');
  });

  it('404s for an unknown offering', async () => {
    const ghost = new mongoose.Types.ObjectId().toHexString();
    const res = await api.as(fx.admin.token).get(`/api/academics/offerings/${ghost}/roster`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/academics/attendance-records/bulk', () => {
  async function makeSession() {
    const s = await AttendanceSession.create({
      collegeId: fx.collegeId, courseOfferingId: offeringId, facultyId,
      date: new Date('2026-02-02'), period: 1, status: 'open',
    });
    return String(s._id);
  }

  it('creates a register in one call', async () => {
    const sessionId = await makeSession();
    const res = await api.as(fx.admin.token).post('/api/academics/attendance-records/bulk').send({
      records: studentIds.map((id, i) => ({
        sessionId, studentId: id, markedBy: markerPersonId,
        status: i === 0 ? 'absent' : 'present',
      })),
    });
    expect(res.status).toBe(201);
    expect(await AttendanceRecord.countDocuments({ sessionId })).toBe(3);
  });

  it('re-saving a corrected register updates instead of throwing on the unique index', async () => {
    const sessionId = await makeSession();
    const first = studentIds.map((id) => ({ sessionId, studentId: id, markedBy: markerPersonId, status: 'present' }));
    await api.as(fx.admin.token).post('/api/academics/attendance-records/bulk').send({ records: first });

    // Operator spots a mistake and saves again — this used to fail outright.
    const corrected = studentIds.map((id, i) => ({ sessionId, studentId: id, markedBy: markerPersonId, status: i === 1 ? 'absent' : 'present' }));
    const res = await api.as(fx.admin.token).post('/api/academics/attendance-records/bulk').send({ records: corrected });

    expect(res.status).toBe(201);
    expect(await AttendanceRecord.countDocuments({ sessionId })).toBe(3);
    const changed = await AttendanceRecord.findOne({ sessionId, studentId: studentIds[1] });
    expect(changed?.status).toBe('absent');
  });

  it('rejects an empty payload', async () => {
    const res = await api.as(fx.admin.token).post('/api/academics/attendance-records/bulk').send({ records: [] });
    expect(res.status).toBe(400);
  });

  it('explains itself when markedBy is omitted and the caller has no linked person', async () => {
    // markedBy refs a Person. The seeded admin user is not linked to one, so
    // the service cannot attribute the marking — it must say so rather than
    // failing with an opaque Mongoose validation error.
    const sessionId = await makeSession();
    const res = await api.as(fx.admin.token).post('/api/academics/attendance-records/bulk').send({
      records: [{ sessionId, studentId: studentIds[0], status: 'present' }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not linked to a person record/i);
    expect(await AttendanceRecord.countDocuments({ sessionId })).toBe(0);
  });
});

describe('POST /api/academics/internal-marks/bulk', () => {
  async function makeAssessment(maxMarks = 40) {
    const a = await InternalAssessment.create({
      collegeId: fx.collegeId, courseOfferingId: offeringId, name: 'Mid-1',
      type: 'mid1', maxMarks, weightage: 20, status: 'conducted',
    });
    return String(a._id);
  }

  it('writes a marks sheet', async () => {
    const assessmentId = await makeAssessment();
    const res = await api.as(fx.admin.token).post('/api/academics/internal-marks/bulk').send({
      marks: studentIds.map((id, i) => ({ assessmentId, studentId: id, marksObtained: 30 + i })),
    });
    expect(res.status).toBe(201);
    expect(await InternalMark.countDocuments({ assessmentId })).toBe(3);
  });

  it('re-saving a corrected sheet updates in place', async () => {
    const assessmentId = await makeAssessment();
    await api.as(fx.admin.token).post('/api/academics/internal-marks/bulk').send({
      marks: studentIds.map((id) => ({ assessmentId, studentId: id, marksObtained: 20 })),
    });
    const res = await api.as(fx.admin.token).post('/api/academics/internal-marks/bulk').send({
      marks: [{ assessmentId, studentId: studentIds[0], marksObtained: 38 }],
    });

    expect(res.status).toBe(201);
    expect(await InternalMark.countDocuments({ assessmentId })).toBe(3);
    const updated = await InternalMark.findOne({ assessmentId, studentId: studentIds[0] });
    expect(updated?.marksObtained).toBe(38);
  });

  it('rejects marks above the assessment maximum', async () => {
    const assessmentId = await makeAssessment(40);
    const res = await api.as(fx.admin.token).post('/api/academics/internal-marks/bulk').send({
      marks: [{ assessmentId, studentId: studentIds[0], marksObtained: 41 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/between 0 and 40/);
    expect(await InternalMark.countDocuments({ assessmentId })).toBe(0);
  });

  it('rejects negative marks', async () => {
    const assessmentId = await makeAssessment(40);
    const res = await api.as(fx.admin.token).post('/api/academics/internal-marks/bulk').send({
      marks: [{ assessmentId, studentId: studentIds[0], marksObtained: -1 }],
    });
    expect(res.status).toBe(400);
  });

  it('refuses a payload mixing assessments', async () => {
    const a1 = await makeAssessment();
    const a2 = await makeAssessment();
    const res = await api.as(fx.admin.token).post('/api/academics/internal-marks/bulk').send({
      marks: [
        { assessmentId: a1, studentId: studentIds[0], marksObtained: 10 },
        { assessmentId: a2, studentId: studentIds[1], marksObtained: 10 },
      ],
    });
    expect(res.status).toBe(400);
  });
});

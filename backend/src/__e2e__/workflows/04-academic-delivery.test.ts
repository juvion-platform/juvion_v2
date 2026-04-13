/**
 * Workflow 04 — Academic Delivery
 *
 * Sequential workflow:
 * 1. Create course (Data Structures, 4 credits)
 * 2. Create faculty + student via factories
 * 3. Create course offering
 * 4. Enroll student
 * 5. Create attendance session
 * 6. Mark student present
 * 7. Create internal assessment
 * 8. Enter internal marks
 * 9. Verify enrollment is still correct
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestFaculty } from '../factories/academic.factory';
import { createTestStudent } from '../factories/student.factory';

let api: TestApi;
let fixtures: BaseFixtures;

// IDs accumulated across steps
let courseId: string;
let offeringId: string;
let enrollmentId: string;
let sessionId: string;
let attendanceRecordId: string;
let assessmentId: string;
let internalMarkId: string;
let facultyId: string;
let studentId: string;

beforeAll(async () => {
  const app = await getTestApp();
  api = createTestApi(app);
  fixtures = await seedBase();
});

afterAll(async () => {
  await cleanupTestApp();
});

describe('Workflow 04 — Academic Delivery', () => {
  it('step 1: POST /api/academics/courses — creates Data Structures course', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/academics/courses')
      .send({
        code: 'CS401',
        name: 'Data Structures',
        regulationId: String(fixtures.regulation._id),
        departmentId: String(fixtures.cse._id),
        credits: 4,
        lectureHrs: 3,
        tutorialHrs: 1,
        practicalHrs: 0,
        type: 'theory',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.code).toBe('CS401');
    expect(res.body.name).toBe('Data Structures');
    expect(res.body.credits).toBe(4);
    courseId = res.body._id;
  });

  it('step 2: create faculty and student via factories', async () => {
    const facultyData = await createTestFaculty(fixtures.collegeId, {
      departmentId: String(fixtures.cse._id),
    });
    expect(facultyData.faculty).toHaveProperty('_id');
    facultyId = String(facultyData.faculty._id);

    const studentData = await createTestStudent(fixtures.collegeId, {
      branchId: String(fixtures.cseBranch._id),
      batchId: String(fixtures.batch._id),
      programmeId: String(fixtures.btech._id),
    });
    expect(studentData.student).toHaveProperty('_id');
    studentId = String(studentData.student._id);
  });

  it('step 3: POST /api/academics/offerings — creates course offering', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/academics/offerings')
      .send({
        courseId,
        semesterId: String(fixtures.sem1._id),
        sectionId: String(fixtures.cseSection._id),
        facultyId,
        maxEnrollment: 60,
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.courseId).toBe(courseId);
    expect(res.body.facultyId).toBe(facultyId);
    offeringId = res.body._id;
  });

  it('step 4: POST /api/academics/enrollments — enrolls student in the offering', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/academics/enrollments')
      .send({
        studentId,
        courseOfferingId: offeringId,
        semesterId: String(fixtures.sem1._id),
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.studentId).toBe(studentId);
    expect(res.body.courseOfferingId).toBe(offeringId);
    expect(res.body.status).toBe('enrolled');
    enrollmentId = res.body._id;
  });

  it('step 5: POST /api/academics/attendance-sessions — creates attendance session', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/academics/attendance-sessions')
      .send({
        courseOfferingId: offeringId,
        date: '2024-07-15',
        period: 1,
        facultyId,
        topicCovered: 'Introduction to Arrays',
        status: 'open',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.courseOfferingId).toBe(offeringId);
    expect(res.body.period).toBe(1);
    sessionId = res.body._id;
  });

  it('step 6: POST /api/academics/attendance-records — marks student present', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/academics/attendance-records')
      .send({
        sessionId,
        studentId,
        status: 'present',
        markedBy: facultyId,
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.sessionId).toBe(sessionId);
    expect(res.body.studentId).toBe(studentId);
    expect(res.body.status).toBe('present');
    attendanceRecordId = res.body._id;
  });

  it('step 7: POST /api/academics/internal-assessments — creates Mid 1 assessment', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/academics/internal-assessments')
      .send({
        courseOfferingId: offeringId,
        name: 'Mid 1',
        type: 'mid1',
        maxMarks: 30,
        weightage: 15,
        date: '2024-08-20',
        status: 'scheduled',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.courseOfferingId).toBe(offeringId);
    expect(res.body.name).toBe('Mid 1');
    expect(res.body.maxMarks).toBe(30);
    assessmentId = res.body._id;
  });

  it('step 8: POST /api/academics/internal-marks — enters marks for student', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/academics/internal-marks')
      .send({
        assessmentId,
        studentId,
        marksObtained: 24,
        remarks: 'Good performance',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.assessmentId).toBe(assessmentId);
    expect(res.body.studentId).toBe(studentId);
    expect(res.body.marksObtained).toBe(24);
    internalMarkId = res.body._id;
  });

  it('step 9: GET /api/academics/enrollments — enrollment still exists and is correct', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get('/api/academics/enrollments')
      .expect(200);

    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);

    const enrollment = (res.body.items as Array<Record<string, unknown>>).find(
      (e) => e._id === enrollmentId
    );

    expect(enrollment).toBeDefined();
    // studentId may be populated (object) or a plain string ID
    const enrolledStudentId =
      typeof enrollment?.studentId === 'object' && enrollment.studentId !== null
        ? String((enrollment.studentId as Record<string, unknown>)._id)
        : String(enrollment?.studentId);
    expect(enrolledStudentId).toBe(studentId);
    // courseOfferingId may also be populated
    const enrolledOfferingId =
      typeof enrollment?.courseOfferingId === 'object' && enrollment.courseOfferingId !== null
        ? String((enrollment.courseOfferingId as Record<string, unknown>)._id)
        : String(enrollment?.courseOfferingId);
    expect(enrolledOfferingId).toBe(offeringId);
    expect(enrollment?.status).toBe('enrolled');

    // Confirm all artefacts were created
    expect(courseId).toBeTruthy();
    expect(offeringId).toBeTruthy();
    expect(enrollmentId).toBeTruthy();
    expect(sessionId).toBeTruthy();
    expect(attendanceRecordId).toBeTruthy();
    expect(assessmentId).toBeTruthy();
    expect(internalMarkId).toBeTruthy();
  });
});

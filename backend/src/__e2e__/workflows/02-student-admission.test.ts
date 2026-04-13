/**
 * Workflow 02 — Student Admission
 *
 * Covers the full admissions pipeline:
 *   inquiry → applicant → exam score → offer → accept offer
 *   → create student record → verify links → enroll
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';

let api: TestApi;
let fixtures: BaseFixtures;

// IDs shared across sequential steps
let inquiryId: string;
let applicantId: string;
let examScoreId: string;
let offerId: string;
let studentId: string;

beforeAll(async () => {
  const app = await getTestApp();
  api = createTestApi(app);
  fixtures = await seedBase();
});

afterAll(async () => {
  await cleanupTestApp();
});

describe('Workflow 02 — Student Admission Pipeline', () => {
  // ── Step 1: Create Inquiry ──────────────────────────
  it('Step 1: POST /api/admissions/inquiries — creates an inquiry', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/admissions/inquiries')
      .send({
        name: 'Arjun Reddy',
        phone: '9876500001',
        source: 'walk-in',
        email: 'arjun.reddy@example.com',
        gender: 'male',
        interStream: 'MPC',
        interPercentage: 92.5,
        programmeInterest: 'B.Tech',
        branchInterest: 'CSE',
        status: 'new',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.name).toBe('Arjun Reddy');
    expect(res.body.source).toBe('walk-in');
    expect(res.body.status).toBe('new');
    inquiryId = res.body._id;
  });

  // ── Step 2: Create Applicant from Inquiry ───────────
  it('Step 2: POST /api/admissions/applicants — creates applicant linked to inquiry', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/admissions/applicants')
      .send({
        inquiryId,
        applicationNumber: 'APP-2024-WF-001',
        name: 'Arjun Reddy',
        phone: '9876500001',
        email: 'arjun.reddy@example.com',
        gender: 'male',
        quota: 'convener',
        category: 'OC',
        interStream: 'MPC',
        interPercentage: 92.5,
        programmeApplied: String(fixtures.btech._id),
        branchPreference1: String(fixtures.cseBranch._id),
        status: 'submitted',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.applicationNumber).toBe('APP-2024-WF-001');
    expect(res.body.quota).toBe('convener');
    expect(res.body.inquiryId).toBe(inquiryId);
    applicantId = res.body._id;
  });

  // ── Step 3: Add Entrance Exam Score ─────────────────
  it('Step 3: POST /api/admissions/exam-scores — adds EAMCET score for applicant', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/admissions/exam-scores')
      .send({
        applicantId,
        examType: 'EAMCET',
        score: 78.45,
        rank: 4320,
        year: 2024,
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.applicantId).toBe(applicantId);
    expect(res.body.examType).toBe('EAMCET');
    expect(res.body.score).toBe(78.45);
    examScoreId = res.body._id;
  });

  // ── Step 4: Create Admission Offer ──────────────────
  it('Step 4: POST /api/admissions/offers — creates an offer for applicant', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/admissions/offers')
      .send({
        applicantId,
        programmeId: String(fixtures.btech._id),
        branchId: String(fixtures.cseBranch._id),
        feeQuoted: 85000,
        validityDate: '2024-08-31',
        status: 'offered',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.applicantId).toBe(applicantId);
    expect(res.body.feeQuoted).toBe(85000);
    expect(res.body.status).toBe('offered');
    offerId = res.body._id;
  });

  // ── Step 5: Accept the Offer ────────────────────────
  it('Step 5: PUT /api/admissions/offers/:id — updates offer status to accepted', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/admissions/offers/${offerId}`)
      .send({ status: 'accepted' })
      .expect(200);

    expect(res.body._id).toBe(offerId);
    expect(res.body.status).toBe('accepted');
  });

  // ── Step 6: Create Student Record ───────────────────
  it('Step 6: POST /api/people/students — creates student record', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .post('/api/people/students')
      .send({
        name: 'Arjun Reddy',
        phone: '9876500001',
        email: 'arjun.reddy@example.com',
        gender: 'male',
        admissionYear: 2024,
        quota: 'convener',
        category: 'OC',
        rollNumber: '24CSE001',
        status: 'active',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body).toHaveProperty('person');
    expect(res.body.admissionYear).toBe(2024);
    expect(res.body.rollNumber).toBe('24CSE001');
    expect(res.body.status).toBe('active');
    studentId = res.body._id;
  });

  // ── Step 7: Verify Student Record Has Correct Links ─
  it('Step 7: GET /api/people/students/:id — verifies student record fields', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .get(`/api/people/students/${studentId}`)
      .expect(200);

    expect(res.body._id).toBe(studentId);
    expect(res.body.admissionYear).toBe(2024);
    expect(res.body.quota).toBe('convener');
    expect(res.body.rollNumber).toBe('24CSE001');
    // Person embedded or linked
    const person = res.body.person ?? res.body.personId;
    expect(person).toBeTruthy();
  });

  // ── Step 8: Update Applicant Status to Enrolled ─────
  it('Step 8: PUT /api/admissions/applicants/:id — updates applicant to enrolled', async () => {
    const res = await api
      .as(fixtures.admin.token)
      .put(`/api/admissions/applicants/${applicantId}`)
      .send({ status: 'enrolled' })
      .expect(200);

    expect(res.body._id).toBe(applicantId);
    expect(res.body.status).toBe('enrolled');
  });
});

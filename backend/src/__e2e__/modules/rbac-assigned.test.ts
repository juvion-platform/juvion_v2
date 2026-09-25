import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { createTestUser } from '../factories/user.factory';
import { Person } from '../../models/people/Person';
import { Faculty } from '../../models/people/Faculty';
import { Section } from '../../models/academic-structure/Section';
import { Course } from '../../models/academic-ops/Course';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { assignMentor } from '../../modules/welfare/ment-couns-ccd-service';

/**
 * 010 P2 — "my students". Default faculty policy: people:read via mentees +
 * sections. A faculty member sees their mentee and the students of the
 * section they teach, not the rest of the department; an HOD who also holds
 * the faculty persona keeps department reach (OR, not AND).
 */
let api: TestApi;
let fx: BaseFixtures;
let facultyId: string;
let facToken: string;
let hodFacToken: string;
let mentee: string; let inSection: string; let other: string; let eceStudent: string;

beforeAll(async () => {
  api = createTestApi(await getTestApp());
  fx = await seedBase();
  const mk = async (name: string, phone: string, dept: any) => {
    const p = await Person.create({ collegeId: fx.collegeId, name, phone });
    const f = await Faculty.create({ collegeId: fx.collegeId, personId: p._id, employeeCode: `E-${phone}`, designation: 'Prof', departmentId: dept._id, contractType: 'regular', status: 'active' });
    return { personId: String(p._id), facultyId: String(f._id) };
  };
  const fac = await mk('Prof. A', '9000000901', fx.cse); facultyId = fac.facultyId;
  facToken = (await createTestUser({ collegeId: fx.collegeId, role: 'faculty', personaType: 'F-FAC', name: 'Fac', email: 'fac@assigned.test', personId: fac.personId })).token;
  const hod = await mk('Dr. H', '9000000902', fx.cse);
  hodFacToken = (await createTestUser({ collegeId: fx.collegeId, role: 'hod', personaType: 'F-HOD', personas: ['F-HOD', 'F-FAC'], name: 'HodFac', email: 'hodfac@assigned.test', personId: hod.personId })).token;

  const s = (branch: any) => createTestStudent(fx.collegeId, { branchId: String(branch._id), programmeId: String(fx.btech._id), batchId: String(fx.batch._id) });
  mentee = String((await s(fx.cseBranch)).student._id);
  inSection = String((await s(fx.cseBranch)).student._id);
  other = String((await s(fx.cseBranch)).student._id);
  eceStudent = String((await s(fx.eceBranch)).student._id);

  await assignMentor(fx.collegeId, { mentorId: facultyId, studentId: mentee, academicYearId: String(fx.ay._id) }, String(fx.admin.user._id));
  const section = await Section.create({ collegeId: fx.collegeId, name: 'B', batchId: fx.batch._id, branchId: fx.cseBranch._id, year: 1, semester: 1, capacity: 60, studentIds: [inSection] });
  const course = await Course.create({ collegeId: fx.collegeId, code: 'CS999', name: 'Scoping', credits: 3, regulationId: fx.regulation._id, departmentId: fx.cse._id, type: 'theory' });
  await CourseOffering.create({ collegeId: fx.collegeId, courseId: course._id, semesterId: fx.sem1._id, sectionId: section._id, facultyId, maxEnrollment: 60, enrolledCount: 1, status: 'active' });
  process.env.RBAC_ENFORCE = 'true';
});
afterAll(async () => { process.env.RBAC_ENFORCE = 'false'; await cleanupTestApp(); });

describe('faculty assigned scope', () => {
  it('lists the mentee and the section student only', async () => {
    const res = await api.as(facToken).get('/api/people/students?limit=100').expect(200);
    const ids = res.body.items.map((x: any) => String(x._id)).sort();
    expect(ids).toEqual([mentee, inSection].sort());
  });
  it('cannot open an unassigned student by URL', async () => {
    await api.as(facToken).get(`/api/people/students/${mentee}`).expect(200);
    await api.as(facToken).get(`/api/people/students/${other}`).expect(404);
  });
  it('a new mentor assignment is visible on the next request (cache invalidated)', async () => {
    await assignMentor(fx.collegeId, { mentorId: facultyId, studentId: other, academicYearId: String(fx.ay._id) }, String(fx.admin.user._id));
    await api.as(facToken).get(`/api/people/students/${other}`).expect(200);
  });
  it('HOD + faculty personas: department reach OR assignments', async () => {
    const res = await api.as(hodFacToken).get('/api/people/students?limit=100').expect(200);
    const ids = res.body.items.map((x: any) => String(x._id));
    expect(ids).toEqual(expect.arrayContaining([mentee, inSection, other]));
    expect(ids).not.toContain(eceStudent);
  });
});

describe('policy snapshot and defaults review', () => {
  it('the seeded college is in snapshot mode with nothing pending', async () => {
    const res = await api.as(fx.admin.token).get('/api/platform/rbac-policies/defaults-diff').expect(200);
    expect(res.body.mode).toBe('snapshot');
    expect(res.body.missing).toEqual([]);
    expect(res.body.changed).toEqual([]);
  });
  it('an edited college row shows as changed and can be re-applied from defaults', async () => {
    const list = await api.as(fx.admin.token).get('/api/platform/rbac-policies?role=faculty&module=people&limit=50').expect(200);
    const row = list.body.items.find((p: any) => p.role === 'faculty' && p.module === 'people' && p.action === 'read');
    expect(row.collegeId).toBe(fx.collegeId);
    await api.as(fx.admin.token).put(`/api/platform/rbac-policies/${row._id}`).send({ scope: { departmentOnly: true } }).expect(200);
    const diff = await api.as(fx.admin.token).get('/api/platform/rbac-policies/defaults-diff').expect(200);
    expect(diff.body.changed.map((c: any) => c.key)).toEqual(['faculty||people|read']);
    // With department reach the faculty member now sees the whole CSE department.
    const wide = await api.as(facToken).get('/api/people/students?limit=100').expect(200);
    expect(wide.body.items.map((x: any) => String(x._id))).toEqual(expect.arrayContaining([mentee, inSection, other]));
    const applied = await api.as(fx.admin.token).post('/api/platform/rbac-policies/apply-defaults').send({ keys: ['faculty||people|read'] }).expect(200);
    expect(applied.body.applied).toBe(1);
    const after = await api.as(fx.admin.token).get('/api/platform/rbac-policies/defaults-diff').expect(200);
    expect(after.body.changed).toEqual([]);
  });
  it('matrix reports per-persona effective access', async () => {
    const res = await api.as(fx.admin.token).get('/api/platform/rbac-policies/matrix').expect(200);
    expect(res.body.personas.length).toBeGreaterThan(20);
    expect(res.body.cells['ST-ACC'].finance.create.effect).toBe('allow');
    expect(res.body.cells['F-FAC'].people.read.scope.assignedVia).toEqual(['mentees', 'sections']);
    expect(res.body.cells['ST-ADM-TC'].admissions.delete.effect).toBe('deny');
    expect(res.body.cells['ST-ADM-TC'].admissions.read.effect).toBe('allow');
  });
});

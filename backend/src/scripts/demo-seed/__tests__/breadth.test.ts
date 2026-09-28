import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { setupMongo, teardownMongo } from '../../../__tests__/helpers/mongoMemory';
import {
  AcademicYear, Semester, Regulation, Department, Programme, Branch, Person, Faculty, Staff, Student,
  HostelBlock, Course, Company, JobPosting, PlacementOffer, Employee, Payroll, Book, Club, Committee,
  SemesterResult, ExamSchedule, MessMenu,
} from '../../../models';
import { College } from '../../../models/College';
import { WorkflowInstance } from '../../../models/workflow/WorkflowInstance';
import { seedBreadth } from '../breadth';
import type { DemoCtx } from '../context';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

let ctx: DemoCtx;
const logs: string[] = [];

beforeAll(async () => {
  await setupMongo();
  const college = await College.create({
    name: 'Juvion Institute of Technology', code: 'JIT', address: { line1: '1 Road', city: 'Hyderabad', state: 'Telangana', pincode: '500032' },
    contactEmail: 'admin@jit.edu.in', contactPhone: '9000000001', subscription: { plan: 'premium', status: 'active' }, status: 'active',
  });
  const collegeId = String(college._id);
  const reg = await Regulation.create({ collegeId, code: 'R22', name: 'Regulation 2022', effectiveFromYear: 2022, totalCredits: 160, maxYears: 8, isActive: true });
  const prevAy = await AcademicYear.create({ collegeId, code: 'AY2025-26', label: 'Academic Year 2025-26', startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'), isCurrent: false });
  const ay = await AcademicYear.create({ collegeId, code: 'AY2026-27', label: 'Academic Year 2026-27', startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30'), isCurrent: true });
  await Semester.create({ collegeId, academicYearId: prevAy._id, number: 2, year: 2026, startDate: new Date('2026-01-10'), endDate: new Date('2026-05-30'), status: 'completed' });
  const sem = await Semester.create({ collegeId, academicYearId: ay._id, number: 1, year: 2026, startDate: new Date('2026-07-15'), endDate: new Date('2026-12-15'), status: 'active' });
  const prog = await Programme.create({ collegeId, code: 'BTECH', name: 'Bachelor of Technology', level: 'UG', durationYears: 4, regulationId: reg._id, isActive: true });
  const departments: Record<string, Types.ObjectId> = {};
  const branches: Record<string, Types.ObjectId> = {};
  for (const code of ['CSE', 'ECE', 'MECH', 'CIVIL']) {
    const d = await Department.create({ collegeId, code, name: `${code} Department`, isActive: true });
    departments[code] = d._id as Types.ObjectId;
    const b = await Branch.create({ collegeId, code, name: `${code} Branch`, programmeId: prog._id, departmentId: d._id, intake: 60, isActive: true });
    branches[code] = b._id as Types.ObjectId;
  }
  await Course.create({ collegeId, code: 'CS301', name: 'Database Systems', regulationId: reg._id, departmentId: departments['CSE'], credits: 4, type: 'theory' });
  await HostelBlock.create({ collegeId, name: 'Boys Hostel — Block A', type: 'boys', totalRooms: 20, isActive: true });

  const faculty: DemoCtx['faculty'] = [];
  for (const [i, code] of ['CSE', 'ECE', 'MECH', 'CIVIL'].entries()) {
    const p = await Person.create({ collegeId, name: `Dr. Faculty ${i}`, phone: `90000001${i}0` });
    const f = await Faculty.create({ collegeId, personId: p._id, employeeCode: `F${i}`, designation: 'Professor', departmentId: departments[code], contractType: 'regular', status: 'active' });
    faculty.push({ _id: f._id as Types.ObjectId, personId: p._id as Types.ObjectId, dept: code });
  }
  const sp = await Person.create({ collegeId, name: 'Warden', phone: '9000000200' });
  const staff = await Staff.create({ collegeId, personId: sp._id, employeeCode: 'S1', designation: 'Warden', staffType: 'administrative', status: 'active' });

  const students: DemoCtx['students'] = [];
  for (let i = 0; i < 12; i++) {
    const branch = ['CSE', 'ECE', 'MECH', 'CIVIL'][i % 4]!;
    const year = (i % 4) + 1;
    const p = await Person.create({ collegeId, name: `Student ${i}`, phone: `90000003${String(i).padStart(2, '0')}` });
    const rollNumber = `${27 - year}B01A05${String(i + 1).padStart(2, '0')}`;
    const s = await Student.create({ collegeId, personId: p._id, admissionYear: 2027 - year, rollNumber, branchId: branches[branch], programmeId: prog._id, status: 'active' });
    students.push({ _id: s._id as Types.ObjectId, personId: p._id as Types.ObjectId, rollNumber, branch, year, sectionId: new Types.ObjectId() });
  }

  ctx = {
    collegeId, collegeName: college.name, ayId: ay._id as Types.ObjectId, semesterId: sem._id as Types.ObjectId, semesterStart: sem.startDate,
    regulationId: reg._id as Types.ObjectId, programmeId: prog._id as Types.ObjectId, departments, branches, faculty,
    staffId: staff._id as Types.ObjectId, staffPersonId: sp._id as Types.ObjectId, students, log: (m) => { logs.push(m); },
  };
});

afterAll(async () => { await teardownMongo(); });

async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const name of mongoose.modelNames()) out[name] = await mongoose.model(name).countDocuments({ collegeId: ctx.collegeId });
  return out;
}

describe('seedBreadth', () => {
  it('fills the empty non-AI modules', async () => {
    await seedBreadth(ctx);
    const c = { collegeId: ctx.collegeId };
    expect(await Company.countDocuments(c)).toBeGreaterThan(0);
    expect(await JobPosting.countDocuments(c)).toBeGreaterThan(0);
    expect(await PlacementOffer.countDocuments(c)).toBeGreaterThan(0);
    expect(await Employee.countDocuments(c)).toBe(ctx.faculty.length + 1);
    expect(await Payroll.countDocuments(c)).toBeGreaterThan(0);
    expect(await Book.countDocuments(c)).toBeGreaterThan(0);
    expect(await Club.countDocuments(c)).toBeGreaterThan(0);
    expect(await Committee.countDocuments(c)).toBeGreaterThan(0);
    expect(await WorkflowInstance.countDocuments({ ...c, workflowId: 'W01', status: 'active' })).toBeGreaterThan(0);
    expect(await SemesterResult.countDocuments(c)).toBeGreaterThan(0);
    expect(await ExamSchedule.countDocuments(c)).toBeGreaterThan(0);
    expect(await MessMenu.countDocuments(c)).toBeGreaterThan(0);
    // Every collection filled except alumni, which needs graduated students this fixture lacks.
    const skips = logs.flatMap((l) => l.match(/[^,;]+\(skipped: [^)]*\)/g) ?? []);
    expect(skips).toHaveLength(1);
    expect(skips[0]).toMatch(/alumni \(skipped: no graduated students/);
  });

  it('writes nothing on a second run', async () => {
    const before = await counts();
    await seedBreadth(ctx);
    expect(await counts()).toEqual(before);
  });
});

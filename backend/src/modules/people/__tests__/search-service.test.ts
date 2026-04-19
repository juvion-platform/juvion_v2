import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { searchPeople } from '../search-service';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Parent } from '../../../models/people/Parent';
import { Alumni } from '../../../models/people/Alumni';
import { Department } from '../../../models/academic-structure/Department';
import { Branch } from '../../../models/academic-structure/Branch';
import { Programme } from '../../../models/academic-structure/Programme';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * T2 tests for the global people search service.
 *
 * Each test maps 1:1 to an acceptance criterion from
 * .captain/specs/global-people-search/tasks.md §Task 2.
 */

const oid = () => new mongoose.Types.ObjectId();

// Helper: seed a Person and a linked role record. Returns both.
async function seedStudent(opts: {
  collegeId: string;
  name: string;
  phone?: string;
  email?: string;
  rollNumber: string;
  branchId: mongoose.Types.ObjectId;
  status?: string;
}) {
  const person = await Person.create({
    collegeId: opts.collegeId,
    name: opts.name,
    phone: opts.phone ?? '9999999999',
    email: opts.email,
  });
  const student = await Student.create({
    collegeId: opts.collegeId,
    personId: person._id,
    admissionYear: 2024,
    rollNumber: opts.rollNumber,
    branchId: opts.branchId,
    status: opts.status ?? 'active',
    onboardingStatus: 'completed',
  } as unknown as Record<string, unknown>);
  return { person, student };
}

async function seedFaculty(opts: {
  collegeId: string;
  name: string;
  employeeCode: string;
  departmentId?: mongoose.Types.ObjectId;
  status?: string;
  email?: string;
}) {
  const person = await Person.create({
    collegeId: opts.collegeId,
    name: opts.name,
    phone: '8888888888',
    email: opts.email,
  });
  const faculty = await Faculty.create({
    collegeId: opts.collegeId,
    personId: person._id,
    employeeCode: opts.employeeCode,
    designation: 'Assistant Professor',
    contractType: 'regular',
    departmentId: opts.departmentId,
    status: opts.status ?? 'active',
  });
  return { person, faculty };
}

async function seedStaff(opts: {
  collegeId: string;
  name: string;
  employeeCode: string;
  departmentId?: mongoose.Types.ObjectId;
  status?: string;
}) {
  const person = await Person.create({
    collegeId: opts.collegeId,
    name: opts.name,
    phone: '7777777777',
  });
  const staff = await Staff.create({
    collegeId: opts.collegeId,
    personId: person._id,
    employeeCode: opts.employeeCode,
    designation: 'Accounts Officer',
    staffType: 'admin',
    departmentId: opts.departmentId,
    status: opts.status ?? 'active',
  });
  return { person, staff };
}

async function seedParent(opts: {
  collegeId: string;
  name: string;
  linkedStudents?: mongoose.Types.ObjectId[];
  relationship?: 'father' | 'mother' | 'guardian';
}) {
  const person = await Person.create({
    collegeId: opts.collegeId,
    name: opts.name,
    phone: '6666666666',
  });
  const parent = await Parent.create({
    collegeId: opts.collegeId,
    personId: person._id,
    relationship: opts.relationship ?? 'father',
    linkedStudents: opts.linkedStudents ?? [],
    primaryContact: true,
    isFeeResponsible: true,
  });
  return { person, parent };
}

async function seedAlumni(opts: {
  collegeId: string;
  name: string;
  programmeId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
}) {
  const person = await Person.create({
    collegeId: opts.collegeId,
    name: opts.name,
    phone: '5555555555',
  });
  const student = await Student.create({
    collegeId: opts.collegeId,
    personId: person._id,
    admissionYear: 2018,
    branchId: opts.branchId,
    rollNumber: `18-${opts.name.slice(0, 3).toUpperCase()}`,
    status: 'graduated',
    onboardingStatus: 'completed',
  } as unknown as Record<string, unknown>);
  const alumni = await Alumni.create({
    collegeId: opts.collegeId,
    personId: person._id,
    studentId: student._id,
    programmeId: opts.programmeId,
    branchId: opts.branchId,
    graduationDate: new Date('2022-06-30'),
    degreeAwarded: 'B.Tech',
    finalCgpa: 8.2,
    classObtained: 'first_class',
  });
  return { person, alumni };
}

describe('searchPeople service', () => {
  beforeAll(async () => { await setupMongo(); }, 60_000);
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  // ────────────────────────────────────────────────────────────
  // RBAC scope correctness (AC-02 through AC-03 in the plan, and
  // tests 1–3 in T2 acceptance criteria)
  // ────────────────────────────────────────────────────────────

  describe('RBAC scoping', () => {
    it('admin (no scope restriction) sees everyone in the college', async () => {
      const collegeId = String(oid());
      const cseDept = await Department.create({ collegeId, name: 'CSE', code: 'CSE' } as unknown as Record<string, unknown>);
      const cseBranch = await Branch.create({ collegeId, departmentId: cseDept._id, name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      await seedStudent({ collegeId, name: 'Ramesh Kumar', rollNumber: '22J001', branchId: cseBranch._id as mongoose.Types.ObjectId });
      await seedStudent({ collegeId, name: 'Ramya Sundaram', rollNumber: '22J002', branchId: cseBranch._id as mongoose.Types.ObjectId });
      await seedFaculty({ collegeId, name: 'Ram Murthy', employeeCode: 'F001', departmentId: cseDept._id as mongoose.Types.ObjectId });

      const res = await searchPeople(collegeId, 'ram', { limit: 10 });
      expect(res.totalMatched).toBeGreaterThanOrEqual(3);
      const roles = res.results.map((r) => r.role);
      expect(roles).toContain('student');
      expect(roles).toContain('faculty');
    });

    it('HOD sees only their department\'s faculty/staff (dept scope applied)', async () => {
      const collegeId = String(oid());
      const cseDept = await Department.create({ collegeId, name: 'CSE', code: 'CSE' } as unknown as Record<string, unknown>);
      const eceDept = await Department.create({ collegeId, name: 'ECE', code: 'ECE' } as unknown as Record<string, unknown>);
      await seedFaculty({ collegeId, name: 'Ram A', employeeCode: 'F001', departmentId: cseDept._id as mongoose.Types.ObjectId });
      await seedFaculty({ collegeId, name: 'Ram B', employeeCode: 'F002', departmentId: cseDept._id as mongoose.Types.ObjectId });
      await seedFaculty({ collegeId, name: 'Ram C', employeeCode: 'F003', departmentId: eceDept._id as mongoose.Types.ObjectId });
      await seedStaff({ collegeId, name: 'Ram D', employeeCode: 'S001', departmentId: cseDept._id as mongoose.Types.ObjectId });

      const cseHodScope = {
        departmentOnly: true, departmentId: String(cseDept._id),
        selfOnly: false, userId: 'hod-cse', resolvedPermissions: [],
      };
      const res = await searchPeople(collegeId, 'ram', {
        authScope: cseHodScope, limit: 10,
      });
      // CSE HOD should see the 2 CSE faculty + 1 CSE staff, NOT the ECE faculty
      const facultyCodes = res.results.filter((r) => r.role === 'faculty').map((r) => r.identifier);
      expect(facultyCodes).toEqual(expect.arrayContaining(['F001', 'F002']));
      expect(facultyCodes).not.toContain('F003');
      const staffCodes = res.results.filter((r) => r.role === 'staff').map((r) => r.identifier);
      expect(staffCodes).toContain('S001');
    });

    it('cross-college isolation — College A search does not return College B people', async () => {
      const cidA = String(oid());
      const cidB = String(oid());
      const branchA = await Branch.create({ collegeId: cidA, departmentId: oid(), name: 'CSE', code: 'CSE-A', programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      const branchB = await Branch.create({ collegeId: cidB, departmentId: oid(), name: 'CSE', code: 'CSE-B', programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      await seedStudent({ collegeId: cidA, name: 'Ramesh Kumar', rollNumber: 'A-001', branchId: branchA._id as mongoose.Types.ObjectId });
      await seedStudent({ collegeId: cidB, name: 'Ramesh Kumar', rollNumber: 'B-001', branchId: branchB._id as mongoose.Types.ObjectId });

      const resA = await searchPeople(cidA, 'ramesh');
      const resB = await searchPeople(cidB, 'ramesh');
      expect(resA.results).toHaveLength(1);
      expect(resB.results).toHaveLength(1);
      expect(resA.results[0]!.identifier).toBe('A-001');
      expect(resB.results[0]!.identifier).toBe('B-001');
    });
  });

  // ────────────────────────────────────────────────────────────
  // Query matching (ACs 4–7)
  // ────────────────────────────────────────────────────────────

  describe('query matching', () => {
    it('matches name substring, case-insensitively', async () => {
      const collegeId = String(oid());
      const branch = await Branch.create({ collegeId, departmentId: oid(), name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      await seedStudent({ collegeId, name: 'Ramesh', rollNumber: 'R1', branchId: branch._id as mongoose.Types.ObjectId });
      await seedStudent({ collegeId, name: 'Arunabh Ramaswamy', rollNumber: 'R2', branchId: branch._id as mongoose.Types.ObjectId });
      await seedStudent({ collegeId, name: 'Priya', rollNumber: 'R3', branchId: branch._id as mongoose.Types.ObjectId });

      const lowerRes = await searchPeople(collegeId, 'ram');
      expect(lowerRes.results).toHaveLength(2);
      const upperRes = await searchPeople(collegeId, 'RAM');
      expect(upperRes.results).toHaveLength(2);
    });

    it('normalizes phone number (+91 / spaces) in query before matching', async () => {
      const collegeId = String(oid());
      const branch = await Branch.create({ collegeId, departmentId: oid(), name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      await seedStudent({ collegeId, name: 'Priya', rollNumber: 'P1', branchId: branch._id as mongoose.Types.ObjectId, phone: '9998887777' });

      const res = await searchPeople(collegeId, '+91 9998 887777');
      expect(res.results).toHaveLength(1);
      expect(res.results[0]!.name).toBe('Priya');
    });

    it('matches roll number directly (without name/person lookup)', async () => {
      const collegeId = String(oid());
      const branch = await Branch.create({ collegeId, departmentId: oid(), name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      await seedStudent({ collegeId, name: 'Priya', rollNumber: '22JIT0001', branchId: branch._id as mongoose.Types.ObjectId });
      await seedStudent({ collegeId, name: 'Ramesh', rollNumber: '22JIT0999', branchId: branch._id as mongoose.Types.ObjectId });

      const res = await searchPeople(collegeId, '22JIT0001');
      expect(res.results).toHaveLength(1);
      expect(res.results[0]!.identifier).toBe('22JIT0001');
    });

    it('matches employee code for faculty and staff', async () => {
      const collegeId = String(oid());
      const deptId = oid();
      await seedFaculty({ collegeId, name: 'Dr. Rao', employeeCode: 'FAC-0042', departmentId: deptId });
      await seedStaff({ collegeId, name: 'Mr. Kumar', employeeCode: 'STF-0099', departmentId: deptId });

      const facultyRes = await searchPeople(collegeId, 'FAC-0042');
      expect(facultyRes.results).toHaveLength(1);
      expect(facultyRes.results[0]!.role).toBe('faculty');

      const staffRes = await searchPeople(collegeId, 'STF-0099');
      expect(staffRes.results).toHaveLength(1);
      expect(staffRes.results[0]!.role).toBe('staff');
    });
  });

  // ────────────────────────────────────────────────────────────
  // Role-specific behavior (ACs 8–10)
  // ────────────────────────────────────────────────────────────

  describe('role-specific behavior', () => {
    it('parent appears once with linked students joined in the identifier', async () => {
      const collegeId = String(oid());
      const branch = await Branch.create({ collegeId, departmentId: oid(), name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      const { student: s1 } = await seedStudent({ collegeId, name: 'Arjun', rollNumber: '22J100', branchId: branch._id as mongoose.Types.ObjectId });
      const { student: s2 } = await seedStudent({ collegeId, name: 'Priya', rollNumber: '22J101', branchId: branch._id as mongoose.Types.ObjectId });
      await seedParent({
        collegeId, name: 'Sunitha Reddy',
        linkedStudents: [s1._id as mongoose.Types.ObjectId, s2._id as mongoose.Types.ObjectId],
      });

      const res = await searchPeople(collegeId, 'sunitha');
      const parents = res.results.filter((r) => r.role === 'parent');
      expect(parents).toHaveLength(1);
      // Identifier should reference at least one linked student
      expect(parents[0]!.identifier).toBeDefined();
      expect(parents[0]!.identifier!.length).toBeGreaterThan(0);
    });

    it('alumni result resolves department via programme', async () => {
      const collegeId = String(oid());
      const dept = await Department.create({ collegeId, name: 'ECE', code: 'ECE' } as unknown as Record<string, unknown>);
      const programme = await Programme.create({
        collegeId, name: 'B.Tech', code: 'BTECH', durationYears: 4, level: 'UG',
        regulationId: oid(),
        departmentId: dept._id,
      } as unknown as Record<string, unknown>);
      const branch = await Branch.create({
        collegeId, departmentId: dept._id, name: 'ECE', code: 'ECE-X',
        programmeId: programme._id, intake: 60,
      } as unknown as Record<string, unknown>);
      await seedAlumni({
        collegeId, name: 'Alok Ranjan',
        programmeId: programme._id as mongoose.Types.ObjectId,
        branchId: branch._id as mongoose.Types.ObjectId,
      });

      const res = await searchPeople(collegeId, 'alok');
      const alumniResult = res.results.find((r) => r.role === 'alumni');
      expect(alumniResult).toBeDefined();
      // Department field should be resolved (populated from programme's department)
      expect(alumniResult!.department).toBeTruthy();
    });

    it('includeInactive=false (default) excludes separated faculty and graduated students', async () => {
      const collegeId = String(oid());
      const deptId = oid();
      const branch = await Branch.create({ collegeId, departmentId: deptId, name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      await seedStudent({ collegeId, name: 'Active Ram', rollNumber: 'A1', branchId: branch._id as mongoose.Types.ObjectId, status: 'active' });
      await seedStudent({ collegeId, name: 'Graduated Ram', rollNumber: 'G1', branchId: branch._id as mongoose.Types.ObjectId, status: 'graduated' });
      await seedFaculty({ collegeId, name: 'Active Faculty Ram', employeeCode: 'F-A', departmentId: deptId, status: 'active' });
      await seedFaculty({ collegeId, name: 'Separated Faculty Ram', employeeCode: 'F-S', departmentId: deptId, status: 'separated' });

      const res = await searchPeople(collegeId, 'ram');
      const names = res.results.map((r) => r.name);
      expect(names).toContain('Active Ram');
      expect(names).toContain('Active Faculty Ram');
      expect(names).not.toContain('Graduated Ram');
      expect(names).not.toContain('Separated Faculty Ram');
    });

    it('includeInactive=true returns separated + graduated records too', async () => {
      const collegeId = String(oid());
      const deptId = oid();
      const branch = await Branch.create({ collegeId, departmentId: deptId, name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      await seedStudent({ collegeId, name: 'Graduated Ram', rollNumber: 'G1', branchId: branch._id as mongoose.Types.ObjectId, status: 'graduated' });
      await seedFaculty({ collegeId, name: 'Separated Faculty Ram', employeeCode: 'F-S', departmentId: deptId, status: 'separated' });

      const res = await searchPeople(collegeId, 'ram', { includeInactive: true });
      const names = res.results.map((r) => r.name);
      expect(names).toContain('Graduated Ram');
      expect(names).toContain('Separated Faculty Ram');
    });
  });

  // ────────────────────────────────────────────────────────────
  // PII + safety (ACs 11, 12)
  // ────────────────────────────────────────────────────────────

  describe('PII protection', () => {
    it('response does NOT include phone, email, dob, aadhaar, or address', async () => {
      const collegeId = String(oid());
      const branch = await Branch.create({ collegeId, departmentId: oid(), name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      await Person.create({
        collegeId, name: 'Ramesh',
        phone: '9998887777', alternatePhone: '8887776666',
        email: 'ramesh@example.com',
        aadhaar: '123456789012',
        dob: new Date('2000-01-01'),
        address: { line1: '123 Main St', city: 'Hyderabad', state: 'TG', pincode: '500001' },
      });
      const matchingPerson = await Person.findOne({ collegeId, name: 'Ramesh' });
      await Student.create({
        collegeId, personId: matchingPerson!._id,
        admissionYear: 2024, rollNumber: 'R1', branchId: branch._id,
        status: 'active', onboardingStatus: 'completed',
      } as unknown as Record<string, unknown>);

      const res = await searchPeople(collegeId, 'ramesh');
      expect(res.results).toHaveLength(1);

      // Serialize the whole response and assert no PII substring
      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('9998887777');
      expect(serialized).not.toContain('8887776666');
      expect(serialized).not.toContain('ramesh@example.com');
      expect(serialized).not.toContain('123456789012'); // aadhaar
      expect(serialized).not.toContain('2000-01-01');   // dob
      expect(serialized).not.toContain('123 Main St');  // address
    });

    it('regex special characters in query are escaped safely', async () => {
      const collegeId = String(oid());
      const branch = await Branch.create({ collegeId, departmentId: oid(), name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      await seedStudent({ collegeId, name: 'Normal Name', rollNumber: 'N1', branchId: branch._id as mongoose.Types.ObjectId });

      // None of these should crash. `.` should NOT match "Normal Name" (literal dot).
      const dotRes = await searchPeople(collegeId, '.');
      expect(dotRes.results).toHaveLength(0);

      // A query that would be a regex bomb without escaping
      const bombRes = await searchPeople(collegeId, '(.*)+');
      expect(bombRes.results).toHaveLength(0);

      // Literal `*` matches nothing (escaped), not crashes
      const starRes = await searchPeople(collegeId, '*');
      expect(starRes.results).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // Result cap + hasMore (AC-13)
  // ────────────────────────────────────────────────────────────

  describe('result limits', () => {
    it('limits results to `limit` (default 10); sets hasMore=true when more exist', async () => {
      const collegeId = String(oid());
      const branch = await Branch.create({ collegeId, departmentId: oid(), name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      // Seed 15 matching students
      for (let i = 0; i < 15; i++) {
        await seedStudent({
          collegeId, name: `Ram${String(i).padStart(2, '0')}`,
          rollNumber: `R${i}`, branchId: branch._id as mongoose.Types.ObjectId,
        });
      }
      const res = await searchPeople(collegeId, 'ram', { limit: 10 });
      expect(res.results).toHaveLength(10);
      expect(res.counts.student).toBeGreaterThanOrEqual(10);
      expect(res.hasMore).toBe(true);
    });

    it('returns empty when no matches', async () => {
      const res = await searchPeople(String(oid()), 'nobody');
      expect(res.results).toHaveLength(0);
      expect(res.totalMatched).toBe(0);
      expect(res.hasMore).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────
  // Response shape contract (from plan §1.5)
  // ────────────────────────────────────────────────────────────

  describe('response shape', () => {
    it('each result has the exact SearchResult fields', async () => {
      const collegeId = String(oid());
      const branch = await Branch.create({ collegeId, departmentId: oid(), name: 'CSE', code: `CSE-${Math.random().toString(36).slice(2, 6)}`, programmeId: oid(), intake: 60 } as unknown as Record<string, unknown>);
      await seedStudent({ collegeId, name: 'Priya', rollNumber: '22J001', branchId: branch._id as mongoose.Types.ObjectId });

      const res = await searchPeople(collegeId, 'priya');
      expect(res.results).toHaveLength(1);
      const r = res.results[0]!;

      // Required fields
      expect(r._id).toBeDefined();
      expect(r.role).toBe('student');
      expect(r.personId).toBeDefined();
      expect(r.name).toBe('Priya');
      expect(r.identifier).toBe('22J001');
      expect(r.identifierLabel).toBeTruthy();

      // Counts object present with all 5 role keys (even if 0)
      expect(res.counts).toMatchObject({
        student: expect.any(Number),
        faculty: expect.any(Number),
        staff: expect.any(Number),
        parent: expect.any(Number),
        alumni: expect.any(Number),
      });
    });
  });
});

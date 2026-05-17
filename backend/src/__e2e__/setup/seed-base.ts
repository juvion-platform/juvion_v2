import { College } from '../../models/College';
import {
  AcademicYear, Batch, Branch, Department, Programme,
  Regulation, Section, Semester,
} from '../../models';
import { seedPolicies } from '../../shared/seed/policies';
import { createTestUser } from '../factories/user.factory';

export interface BaseFixtures {
  collegeId: string;
  college: any;
  regulation: any;
  cse: any;
  ece: any;
  btech: any;
  cseBranch: any;
  eceBranch: any;
  batch: any;
  cseSection: any;
  ay: any;
  sem1: any;
  sem2: any;
  superAdmin: { user: any; token: string };
  admin: { user: any; token: string };
  principal: { user: any; token: string };
}

export async function seedBase(): Promise<BaseFixtures> {
  // 1. College
  const college = await College.create({
    name: 'JIT Test College',
    code: 'JIT-TEST',
    address: { line1: '1 Test Road', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
    contactEmail: 'admin@jit-test.edu',
    contactPhone: '9000000001',
    subscription: { plan: 'premium', status: 'active' },
    status: 'active',
  });
  const collegeId = String(college._id);

  // 2. Regulation
  const regulation = await Regulation.create({
    collegeId, code: 'R20', name: 'R20 Regulation',
    effectiveFromYear: 2020, totalCredits: 160, maxYears: 6, isActive: true,
  });

  // 3. Departments
  const cse = await Department.create({ collegeId, code: 'CSE', name: 'Computer Science', isActive: true });
  const ece = await Department.create({ collegeId, code: 'ECE', name: 'Electronics', isActive: true });

  // 4. Programme + Branches
  const btech = await Programme.create({
    collegeId, code: 'BTECH', name: 'B.Tech', level: 'UG',
    durationYears: 4, regulationId: regulation._id, isActive: true,
  });
  const cseBranch = await Branch.create({
    collegeId, code: 'CSE', name: 'CSE', programmeId: btech._id,
    departmentId: cse._id, intake: 120, isActive: true,
  });
  const eceBranch = await Branch.create({
    collegeId, code: 'ECE', name: 'ECE', programmeId: btech._id,
    departmentId: ece._id, intake: 60, isActive: true,
  });

  // 5. Batch
  const batch = await Batch.create({
    collegeId, code: '2024', name: '2024 Batch', admissionYear: 2024,
    programmeId: btech._id, regulationId: regulation._id, isActive: true,
  });

  // 6. Academic Year + Semesters
  const ay = await AcademicYear.create({
    collegeId, code: '2024-25', label: '2024-25',
    startDate: new Date('2024-06-01'), endDate: new Date('2025-05-31'), isCurrent: true,
  });
  const sem1 = await Semester.create({
    collegeId, academicYearId: ay._id, number: 1, year: 1,
    startDate: new Date('2024-06-01'), endDate: new Date('2024-11-30'), status: 'active',
  });
  const sem2 = await Semester.create({
    collegeId, academicYearId: ay._id, number: 2, year: 1,
    startDate: new Date('2024-12-01'), endDate: new Date('2025-05-31'), status: 'upcoming',
  });

  // 7. Section
  const cseSection = await Section.create({
    collegeId, name: 'A', branchId: cseBranch._id, batchId: batch._id,
    year: 1, semester: 1, capacity: 60,
  });

  // 8. Users
  const superAdmin = await createTestUser({
    role: 'super_admin', personaType: 'L-SADM',
    name: 'Super Admin', email: 'super@test.com',
  });
  const admin = await createTestUser({
    collegeId, role: 'admin', personaType: 'L-ADMIN',
    name: 'College Admin', email: 'admin@test.com',
  });
  const principal = await createTestUser({
    collegeId, role: 'principal', personaType: 'L-PRIN',
    name: 'Principal', email: 'principal@test.com',
  });

  // 9. RBAC default policies (shared/seed/policies — idempotent upsert).
  await seedPolicies({ createdBy: 'seed' });

  return {
    college, collegeId, regulation, cse, ece, btech, cseBranch, eceBranch,
    batch, cseSection, ay, sem1, sem2, superAdmin, admin, principal,
  };
}

import { Person, Student } from '../../models';
import { createTestUser } from './user.factory';

let studentCounter = 0;

interface CreateStudentOpts {
  branchId?: string;
  batchId?: string;
  programmeId?: string;
  name?: string;
  email?: string;
  admissionYear?: number;
}

interface TestStudent {
  person: any;
  student: any;
  user: any;
  token: string;
}

export async function createTestStudent(collegeId: string, opts?: CreateStudentOpts): Promise<TestStudent> {
  studentCounter++;
  const name = opts?.name ?? `Test Student ${studentCounter}`;
  const email = opts?.email ?? `student${studentCounter}@test.com`;

  const person = await Person.create({
    collegeId,
    name,
    phone: `90000${String(studentCounter).padStart(5, '0')}`,
    email,
    gender: 'male',
  });

  const student = await Student.create({
    collegeId,
    personId: person._id,
    admissionYear: opts?.admissionYear ?? 2024,
    programmeId: opts?.programmeId,
    branchId: opts?.branchId,
    batchId: opts?.batchId,
    rollNumber: `24JIT${String(studentCounter).padStart(4, '0')}`,
    status: 'active',
    onboardingStatus: 'not_started',
  });

  const { user, token } = await createTestUser({
    collegeId,
    role: 'student',
    personaType: 'L-STU',
    name,
    email,
    personId: String(person._id),
  });

  return { person, student, user, token };
}

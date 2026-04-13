import { Person, Employee, LeaveType } from '../../models';
import { createTestUser } from './user.factory';

let empCounter = 0;
let leaveTypeCounter = 0;

export async function createTestEmployee(collegeId: string, opts?: {
  departmentId?: string; designation?: string; name?: string; employeeType?: string;
}) {
  empCounter++;
  const name = opts?.name ?? `Test Employee ${empCounter}`;
  const email = `emp${empCounter}@test.com`;

  const person = await Person.create({
    collegeId, name,
    phone: `70000${String(empCounter).padStart(5, '0')}`,
    email, gender: 'male',
  });

  const employee = await Employee.create({
    collegeId, personId: person._id,
    employeeId: `EMP${String(empCounter).padStart(4, '0')}`,
    departmentId: opts?.departmentId,
    designation: opts?.designation ?? 'Office Assistant',
    employeeType: opts?.employeeType ?? 'non_teaching',
    joiningDate: new Date('2020-06-01'),
    status: 'active',
  });

  const { user, token } = await createTestUser({
    collegeId, role: 'staff', personaType: 'ST-ADM',
    name, email, personId: String(person._id),
  });

  return { person, employee, user, token };
}

export async function createTestLeaveType(collegeId: string, opts?: {
  name?: string; code?: string; maxDaysPerYear?: number;
}) {
  leaveTypeCounter++;
  return LeaveType.create({
    collegeId,
    name: opts?.name ?? `Test Leave ${leaveTypeCounter}`,
    code: opts?.code ?? `TL${leaveTypeCounter}`,
    maxDaysPerYear: opts?.maxDaysPerYear ?? 12,
    isCarryForward: false, maxCarryForward: 0,
    applicableTo: ['all'],
  });
}

import { User, IUser } from '../../../models/User';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';

/**
 * Sign-in identifier → User, always scoped by collegeId.
 * Order: email, student roll number, faculty employee code, staff employee code.
 */
export async function resolveIdentifierToUser(collegeId: string, identifier: string): Promise<IUser | null> {
  const id = identifier.trim();
  if (!id) return null;

  if (id.includes('@')) {
    return User.findOne({ collegeId, email: id.toLowerCase() });
  }

  const variants = { $in: [id, id.toUpperCase()] };
  const student = await Student.findOne({ collegeId, rollNumber: variants }).select('personId').lean();
  if (student?.personId) return User.findOne({ collegeId, personId: student.personId });

  const faculty = await Faculty.findOne({ collegeId, employeeCode: variants }).select('personId').lean();
  if (faculty?.personId) return User.findOne({ collegeId, personId: faculty.personId });

  const staff = await Staff.findOne({ collegeId, employeeCode: variants }).select('personId').lean();
  if (staff?.personId) return User.findOne({ collegeId, personId: staff.personId });

  return null;
}

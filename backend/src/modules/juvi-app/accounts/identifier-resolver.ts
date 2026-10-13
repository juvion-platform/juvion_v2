import { User, IUser } from '../../../models/User';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';

/**
 * Sign-in identifier → User.
 *
 * `resolveIdentifierToUser` is college-scoped, and survives for its one remaining caller: the
 * public account-deletion form, which keeps `institutionCode` (spec D3).
 *
 * `resolveJuviIdToUser` is the Juvi app's login path and is deliberately the one lookup in this
 * module that is **not** scoped by collegeId. The Juvi ID is globally unique, and resolving the
 * college is what the lookup is *for* — there is nothing to scope by until it returns. This is
 * the amendment to the Juvi code's ruling R10 that the spec makes (§5).
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

/** An exact hit on a globally unique key. `null` when nobody holds it. */
export async function resolveJuviIdToUser(juviId: string): Promise<IUser | null> {
  return User.findOne({ juviId });
}

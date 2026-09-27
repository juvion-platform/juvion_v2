/**
 * Builds the PublisherScope for an ERP caller (spec §1, §7.3). Dispatches on
 * `role` like resolveUserScope does for the admin/HOD/faculty split, but an
 * office persona (spec §7.3, R6b: "the broadest scope genuinely held") wins
 * ahead of that split — a teaching faculty member who also holds a staff
 * office persona (e.g. Exam Controller) still publishes college-wide, not
 * just to the offerings they teach. admin/principal → college (may pick the
 * office); an office persona → college; the head of a department →
 * department (headship is a real Department.hodId relationship, independent
 * of the primary `role`, so it also wins over plain teaching faculty); other
 * teaching faculty → the offerings they teach this semester; anyone else →
 * none.
 */
import { AppError } from '../../../middleware/errorHandler';
import { User } from '../../../models/User';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Department } from '../../../models/academic-structure/Department';
import { Semester } from '../../../models/academic-structure/Semester';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { PublisherScope } from './scope';
import { COLLEGE_OFFICE, PRINCIPAL_OFFICE, FACULTY_OFFICE, OFFICE_NAMES, officeForPersonas, hodOffice } from './offices';

/** The ERP caller as `authenticate` leaves it on req.user. */
export interface ErpUserRef { id: string; role: string; personaType?: string; personas?: string[] }

/** Roles with college-wide notice rights: every notice, every reach, CSV export, retry delivery. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(['admin', 'super_admin', 'principal']);

export async function resolvePublisherScope(collegeId: string, user: ErpUserRef, officeOverride?: string): Promise<PublisherScope> {
  const row = await User.findOne({ _id: user.id, collegeId }).select('personId personaType personas').lean();
  const personId = row?.personId ? String(row.personId) : undefined;
  const codes = [...new Set([user.personaType, ...(user.personas ?? []), row?.personaType, ...(row?.personas ?? [])].filter((c): c is string => Boolean(c)))];
  const base = { userId: user.id, personId, offeringIds: [] as string[], isAdmin: ADMIN_ROLES.has(user.role) };
  const none: PublisherScope = { ...base, kind: 'none', office: '' };

  if (base.isAdmin) {
    if (officeOverride !== undefined && !OFFICE_NAMES.includes(officeOverride)) throw new AppError(400, `Unknown office "${officeOverride}"`);
    return { ...base, kind: 'college', office: officeOverride ?? (user.role === 'principal' ? PRINCIPAL_OFFICE : COLLEGE_OFFICE) };
  }

  // An office persona wins regardless of the caller's primary role (R6b): a
  // teaching faculty member who also holds e.g. ST-EXAM still publishes
  // college-wide, so this check runs before the hod/faculty split below.
  const staff = personId ? await Staff.findOne({ collegeId, personId }).select('personaCode').lean() : null;
  const office = officeForPersonas(staff?.personaCode ? [...codes, staff.personaCode] : codes);
  if (office) return { ...base, kind: 'college', office };

  if (user.role !== 'hod' && user.role !== 'faculty') return none;

  const faculty = personId ? await Faculty.findOne({ collegeId, personId }).select('_id departmentId').lean() : null;
  if (!faculty) return none;
  // Headship is a real Department.hodId relationship, so it wins over plain
  // teaching faculty (R6b) even when the caller's primary role is 'faculty'.
  const headed = await Department.findOne({ collegeId, hodId: faculty._id, isActive: true }).select('_id name').lean();
  const hodDept = headed ?? (user.role === 'hod' && faculty.departmentId
    ? await Department.findOne({ _id: faculty.departmentId, collegeId, isActive: true }).select('_id name').lean()
    : null);
  if (hodDept) return { ...base, kind: 'department', departmentId: String(hodDept._id), office: hodOffice(hodDept.name) };
  if (user.role === 'hod') return none;

  // Teaching faculty: offerings they teach this semester only (R6a — an
  // offering from a semester that has ended or not started is excluded).
  const semesters = await Semester.find({ collegeId, status: 'active' }).select('_id').lean();
  const offerings = await CourseOffering.find({
    collegeId, status: 'active', semesterId: { $in: semesters.map((x) => x._id) },
    $or: [{ facultyId: faculty._id }, { coFacultyIds: faculty._id }],
  }).select('_id').lean();
  return { ...base, kind: 'offerings', office: FACULTY_OFFICE, offeringIds: offerings.map((o) => String(o._id)) };
}

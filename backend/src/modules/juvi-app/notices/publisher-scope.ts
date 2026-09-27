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
 *
 * R7: only `staff`, `hod` and `faculty` are ever eligible for an office,
 * headship or offerings scope — a student or parent gets `none` outright,
 * without even a Staff/Faculty lookup. And "genuinely holds" (R6b) means a
 * *currently active* employment record: the office check reads only
 * `Staff.personaCode` (the canonical persona source — see
 * `people/Staff.ts`'s doc comment; `User.personaType` is a derived cache for
 * JWTs, not authoritative) from a Staff row filtered to
 * `AUDIENCE_EMPLOYEE_STATUSES`, and the Faculty lookup for headship/offerings
 * is filtered the same way — a separated employee's stale `User.personaType`
 * or an offboarded Staff/Faculty row can never grant a scope here.
 */
import { AppError } from '../../../middleware/errorHandler';
import { User } from '../../../models/User';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Department } from '../../../models/academic-structure/Department';
import { Semester } from '../../../models/academic-structure/Semester';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { AUDIENCE_EMPLOYEE_STATUSES } from './audience-graph';
import { PublisherScope } from './scope';
import { COLLEGE_OFFICE, PRINCIPAL_OFFICE, FACULTY_OFFICE, OFFICE_NAMES, officeForPersonas, hodOffice } from './offices';

/** The ERP caller as `authenticate` leaves it on req.user. */
export interface ErpUserRef { id: string; role: string; personaType?: string; personas?: string[] }

/** Roles with college-wide notice rights: every notice, every reach, CSV export, retry delivery. */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(['admin', 'super_admin', 'principal']);

/** Roles that can ever hold an office, a headship or a teaching-offerings scope. Everyone else (student, parent, …) is refused outright. */
const OFFICE_ELIGIBLE_ROLES: ReadonlySet<string> = new Set(['staff', 'hod', 'faculty']);

const activeStatus = { status: { $in: AUDIENCE_EMPLOYEE_STATUSES } };

export async function resolvePublisherScope(collegeId: string, user: ErpUserRef, officeOverride?: string): Promise<PublisherScope> {
  const row = await User.findOne({ _id: user.id, collegeId }).select('personId').lean();
  const personId = row?.personId ? String(row.personId) : undefined;
  const base = { userId: user.id, personId, offeringIds: [] as string[], isAdmin: ADMIN_ROLES.has(user.role) };
  const none: PublisherScope = { ...base, kind: 'none', office: '' };

  if (base.isAdmin) {
    if (officeOverride !== undefined && !OFFICE_NAMES.includes(officeOverride)) throw new AppError(400, `Unknown office "${officeOverride}"`);
    return { ...base, kind: 'college', office: officeOverride ?? (user.role === 'principal' ? PRINCIPAL_OFFICE : COLLEGE_OFFICE) };
  }
  // A student, parent or any other role never gets an office, headship or
  // offerings scope, whatever their `personas` claim (R7).
  if (!OFFICE_ELIGIBLE_ROLES.has(user.role)) return none;

  // An office persona wins regardless of whether the caller's primary role is
  // staff, hod or faculty (R6b) — but only a currently active Staff row
  // counts, and only its own canonical `personaCode` (R7): no fallback to
  // `User.personaType`/`personas`, which can go stale after offboarding.
  const staff = personId ? await Staff.findOne({ collegeId, personId, ...activeStatus }).select('personaCode').lean() : null;
  const office = staff?.personaCode ? officeForPersonas([staff.personaCode]) : null;
  if (office) return { ...base, kind: 'college', office };

  if (user.role !== 'hod' && user.role !== 'faculty') return none;

  const faculty = personId ? await Faculty.findOne({ collegeId, personId, ...activeStatus }).select('_id departmentId').lean() : null;
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

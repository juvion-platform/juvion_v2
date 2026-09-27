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
 * without even a Staff/Faculty lookup. The Faculty lookup for headship and
 * offerings is filtered to `AUDIENCE_EMPLOYEE_STATUSES`, so a separated
 * Faculty row grants neither.
 *
 * R8: office scope needs BOTH the role gate above AND an office persona from
 * one of two sources — `User.personaType`/`personas` (the source
 * `authorize()` and the real provisioning path, `platform/user-service.ts`,
 * actually grant personas through; `Staff.personaCode` is optional in Phase A,
 * so a legitimately provisioned office holder often has no Staff row at all)
 * or the `personaCode` of an *active* Staff row (a separated Staff row
 * contributes nothing, even if a stale `User.personaType` still names the
 * same office). Trusting `User.personaType`/`personas` only fires once the
 * role gate has already passed, so a student or parent can never reach it.
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
  const row = await User.findOne({ _id: user.id, collegeId }).select('personId personaType personas').lean();
  const personId = row?.personId ? String(row.personId) : undefined;
  const base = { userId: user.id, personId, offeringIds: [] as string[], isAdmin: ADMIN_ROLES.has(user.role) };
  const none: PublisherScope = { ...base, kind: 'none', office: '' };

  if (base.isAdmin) {
    if (officeOverride !== undefined && !OFFICE_NAMES.includes(officeOverride)) throw new AppError(400, `Unknown office "${officeOverride}"`);
    return { ...base, kind: 'college', office: officeOverride ?? (user.role === 'principal' ? PRINCIPAL_OFFICE : COLLEGE_OFFICE) };
  }
  // A student, parent or any other role never gets an office, headship or
  // offerings scope, whatever `personaType`/`personas` claim (R7) — the gate
  // below runs before either persona source is even read.
  if (!OFFICE_ELIGIBLE_ROLES.has(user.role)) return none;

  // R8: an office persona from `User.personaType`/`personas` (what
  // `authorize()` and real provisioning actually grant through) OR from an
  // active Staff row's `personaCode` (Staff is optional in Phase A, and a
  // separated Staff row contributes nothing regardless of what `User` says).
  const codes = [...new Set([user.personaType, ...(user.personas ?? []), row?.personaType, ...(row?.personas ?? [])].filter((c): c is string => Boolean(c)))];
  const staff = personId ? await Staff.findOne({ collegeId, personId, ...activeStatus }).select('personaCode').lean() : null;
  const office = officeForPersonas(staff?.personaCode ? [...codes, staff.personaCode] : codes);
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

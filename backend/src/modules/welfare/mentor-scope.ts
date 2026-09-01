/**
 * 008 Phase 2 — mentor-scoped visibility for the Student Risk board.
 *
 * `applyAuthScope` covers two shapes: `departmentOnly` (filter by department)
 * and `selfOnly` (filter by the caller's own person/user id). A mentor seeing
 * *their mentees* is neither — it is a join through `MentorAssignment`, so it
 * needs its own resolver.
 *
 * Deliberately additive: this narrows a result set, it never widens one.
 * `shared/rbac/scope-resolver.ts` only resolves a `departmentId` for the
 * `hod`, `faculty` and `staff` roles, and `applyAuthScope` skips the
 * department filter when that id is absent — so an unmapped role already sees
 * MORE than it should. Nothing here may make that worse: callers intersect the
 * mentee list with whatever `applyAuthScope` produced, they do not replace it.
 */

import { Faculty } from '../../models/people/Faculty';
import { MentorAssignment } from '../../models/welfare/MentorAssignment';

/**
 * The student ids this person mentors, or `null` when they are not a mentor.
 *
 * `null` and `[]` mean different things and callers must treat them so:
 *   null → not a mentor; fall through to the normal authScope path
 *   []   → a mentor with no active mentees; the correct result is zero rows
 *
 * Collapsing those two would silently show a mentor with an empty roster the
 * entire college.
 */
export async function mentorMenteeIds(
  collegeId: string,
  personId: string | undefined,
): Promise<string[] | null> {
  if (!personId) return null;

  const faculty = await Faculty.findOne({ collegeId, personId })
    .select({ _id: 1 })
    .lean();
  if (!faculty) return null;

  const assignments = await MentorAssignment.find({
    collegeId,
    mentorId: faculty._id,
    status: 'active',
  })
    .select({ studentId: 1 })
    .lean();

  // A faculty member who mentors nobody is still a mentor — return [], not null.
  return assignments.map((a) => String(a.studentId));
}

/**
 * Narrow an existing filter to a mentor's mentees, if the caller is one.
 *
 * Mutates `filter` in place to match the `applyAuthScope` convention. Returns
 * true when a mentee restriction was applied.
 */
export async function applyMentorScope(
  filter: Record<string, unknown>,
  collegeId: string,
  personId: string | undefined,
): Promise<boolean> {
  const menteeIds = await mentorMenteeIds(collegeId, personId);
  if (menteeIds === null) return false;

  const existing = filter['studentId'];
  if (existing && typeof existing === 'object' && '$in' in (existing as object)) {
    // Intersect rather than overwrite — never widen an existing restriction.
    const prior = new Set((existing as { $in: string[] }).$in.map(String));
    filter['studentId'] = { $in: menteeIds.filter((id) => prior.has(id)) };
  } else {
    filter['studentId'] = { $in: menteeIds };
  }
  return true;
}

/**
 * 010 P2 — "assigned" scope: the students, sections and course offerings a
 * person reaches through their assignments. A policy names which resolvers
 * apply (`scope.assignedVia`); a college configures "my students" by picking
 * them. Adding a kind is one entry in RESOLVERS.
 *
 * Results are cached per (person, kinds) for 15 minutes and invalidated when
 * a mentor assignment or course offering changes.
 */
import redis from '../../config/redis';
import { Faculty } from '../../models/people/Faculty';
import { Section } from '../../models/academic-structure/Section';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { MentorAssignment } from '../../models/welfare/MentorAssignment';
import { AssignedIds, AssignedVia } from './types';

const TTL = 900;
const key = (personId: string, kinds: string[]) => `user:assigned:${personId}:${[...kinds].sort().join(',')}`;

type Resolver = (collegeId: string, facultyId: string) => Promise<Partial<AssignedIds>>;

const RESOLVERS: Record<AssignedVia, Resolver> = {
  async mentees(collegeId, facultyId) {
    const rows = await MentorAssignment.find({ collegeId, mentorId: facultyId, status: 'active' }).select('studentId').lean();
    return { studentIds: rows.map((r) => String(r.studentId)) };
  },
  async sections(collegeId, facultyId) {
    const offerings = await CourseOffering.find({ collegeId, facultyId, status: { $ne: 'cancelled' } }).select('sectionId').lean();
    const sectionIds = [...new Set(offerings.map((o) => String(o.sectionId)))];
    const sections = await Section.find({ collegeId, _id: { $in: sectionIds } }).select('studentIds').lean();
    return { sectionIds, studentIds: sections.flatMap((s: any) => (s.studentIds ?? []).map(String)) };
  },
  async courses(collegeId, facultyId) {
    const offerings = await CourseOffering.find({ collegeId, facultyId, status: { $ne: 'cancelled' } }).select('_id').lean();
    const courseOfferingIds = offerings.map((o) => String(o._id));
    const enrollments = await Enrollment.find({ collegeId, courseOfferingId: { $in: courseOfferingIds } }).select('studentId').lean();
    return { courseOfferingIds, studentIds: enrollments.map((e) => String(e.studentId)) };
  },
};

export const ASSIGNED_VIA_KINDS = Object.keys(RESOLVERS) as AssignedVia[];

const empty = (): AssignedIds => ({ studentIds: [], sectionIds: [], courseOfferingIds: [] });

/** Union of every requested resolver. A person with no Faculty record reaches nothing. */
export async function resolveAssigned(collegeId: string, personId: string | undefined, kinds: AssignedVia[]): Promise<AssignedIds> {
  if (!personId || kinds.length === 0) return empty();
  const k = key(personId, kinds);
  try {
    const cached = await redis.get(k);
    if (cached) return JSON.parse(cached) as AssignedIds;
  } catch { /* cache miss */ }

  const out = empty();
  const faculty = await Faculty.findOne({ collegeId, personId }).select('_id').lean();
  if (faculty) {
    const parts = await Promise.all(kinds.map((kind) => RESOLVERS[kind](collegeId, String(faculty._id))));
    for (const p of parts) {
      out.studentIds.push(...(p.studentIds ?? []));
      out.sectionIds.push(...(p.sectionIds ?? []));
      out.courseOfferingIds.push(...(p.courseOfferingIds ?? []));
    }
    out.studentIds = [...new Set(out.studentIds)];
    out.sectionIds = [...new Set(out.sectionIds)];
    out.courseOfferingIds = [...new Set(out.courseOfferingIds)];
  }
  try { await redis.set(k, JSON.stringify(out), 'EX', TTL); } catch { /* non-fatal */ }
  return out;
}

/** Call when a mentor assignment or course offering for this faculty changes. */
export async function invalidateAssignedForFaculty(collegeId: string, facultyId: string | undefined): Promise<void> {
  if (!facultyId) return;
  try {
    const faculty = await Faculty.findOne({ collegeId, _id: facultyId }).select('personId').lean();
    if (!faculty?.personId) return;
    const keys = await redis.keys(`user:assigned:${String(faculty.personId)}:*`);
    for (const k of keys) await redis.del(k);
  } catch { /* non-fatal */ }
}

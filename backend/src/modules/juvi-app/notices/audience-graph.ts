/**
 * Loads the AudienceGraph from ERP people (spec §1: members without an active
 * Juvi account are still in the audience, as "Not on Juvi"). College metadata
 * is always loaded whole (it is small); `personIds` narrows the people, which
 * is how the added-later check (Task 10) evaluates a single account.
 */
import { Types } from 'mongoose';
import { College } from '../../../models/College';
import { User } from '../../../models/User';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Branch } from '../../../models/academic-structure/Branch';
import { Department } from '../../../models/academic-structure/Department';
import { Programme } from '../../../models/academic-structure/Programme';
import { Batch } from '../../../models/academic-structure/Batch';
import { Section } from '../../../models/academic-structure/Section';
import { Semester } from '../../../models/academic-structure/Semester';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../../models/welfare/HostelRoom';
import { HostelBlock } from '../../../models/welfare/HostelBlock';
import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { AudienceGraph, emptyAudienceGraph } from './audience';

export const AUDIENCE_STUDENT_STATUSES: readonly string[] = ['active', 'year_back', 'detained'];
export const AUDIENCE_EMPLOYEE_STATUSES: readonly string[] = ['active', 'on_leave'];

const s = (v: unknown) => String(v);
const push = (m: Map<string, string[]>, k: string, v: string) => { const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };

interface OfferingLean { _id: Types.ObjectId; sectionId: Types.ObjectId; facultyId: Types.ObjectId; coFacultyIds?: Types.ObjectId[]; courseId: Types.ObjectId }

export async function loadAudienceGraph(collegeId: string, opts: { personIds?: string[] } = {}): Promise<AudienceGraph> {
  const byPerson = opts.personIds ? { personId: { $in: opts.personIds.map((id) => new Types.ObjectId(id)) } } : {};
  const [college, departments, programmes, batches, branches, sections, semesters, blocks] = await Promise.all([
    College.findById(collegeId).select('name').lean(),
    Department.find({ collegeId, isActive: true }).select('_id name hodId').lean(),
    Programme.find({ collegeId }).select('_id name').lean(),
    Batch.find({ collegeId }).select('_id name programmeId').lean(),
    Branch.find({ collegeId }).select('_id departmentId').lean(),
    Section.find({ collegeId }).select('_id name batchId branchId studentIds').lean(),
    Semester.find({ collegeId, status: 'active' }).select('_id').lean(),
    HostelBlock.find({ collegeId, isActive: true }).select('_id name').lean(),
  ]);

  const g = emptyAudienceGraph(college?.name ?? '');
  const branchDept = new Map(branches.filter((b) => b.departmentId).map((b) => [s(b._id), s(b.departmentId)]));
  for (const d of departments) g.departments.set(s(d._id), { name: d.name });
  for (const p of programmes) g.programmes.set(s(p._id), { name: p.name });
  for (const b of batches) g.batches.set(s(b._id), { name: b.name, programmeId: b.programmeId ? s(b.programmeId) : undefined });
  for (const b of blocks) g.blocks.set(s(b._id), { name: b.name });
  const sectionsByStudent = new Map<string, string[]>();
  for (const sec of sections) {
    g.sections.set(s(sec._id), { name: sec.name, batchId: s(sec.batchId), departmentId: branchDept.get(s(sec.branchId)) });
    for (const sid of sec.studentIds ?? []) push(sectionsByStudent, s(sid), s(sec._id));
  }

  const offeringDocs = await CourseOffering.find({ collegeId, status: 'active', semesterId: { $in: semesters.map((x) => x._id) } })
    .select('_id sectionId facultyId coFacultyIds courseId').lean<OfferingLean[]>();
  const offeringIds = offeringDocs.map((o) => o._id);
  const courses = await Course.find({ collegeId, _id: { $in: offeringDocs.map((o) => o.courseId) } }).select('_id code').lean();
  const courseCode = new Map(courses.map((c) => [s(c._id), c.code]));
  const offeringsByFaculty = new Map<string, string[]>();
  for (const o of offeringDocs) {
    const facultyIds = [s(o.facultyId), ...(o.coFacultyIds ?? []).map(s)];
    const sec = g.sections.get(s(o.sectionId));
    g.offerings.set(s(o._id), { label: `${courseCode.get(s(o.courseId)) ?? 'Course'} · ${sec?.name ?? ''}`, sectionId: s(o.sectionId), departmentId: sec?.departmentId, facultyIds });
    for (const f of facultyIds) push(offeringsByFaculty, f, s(o._id));
  }

  const [students, faculty, staff] = await Promise.all([
    Student.find({ collegeId, status: { $in: AUDIENCE_STUDENT_STATUSES }, ...byPerson }).select('_id personId batchId branchId').lean(),
    Faculty.find({ collegeId, status: { $in: AUDIENCE_EMPLOYEE_STATUSES }, ...byPerson }).select('_id personId departmentId').lean(),
    Staff.find({ collegeId, status: { $in: AUDIENCE_EMPLOYEE_STATUSES }, ...byPerson }).select('_id personId departmentId personaCode').lean(),
  ]);
  const personIds = [...students, ...faculty, ...staff].map((x) => x.personId);
  const studentIds = students.map((x) => x._id);
  const [users, accounts, enrollments, allocations, enrolCounts] = await Promise.all([
    User.find({ collegeId, personId: { $in: personIds } }).select('personId personaType personas').lean(),
    JuviAccount.find({ collegeId, status: 'active', personId: { $in: personIds } }).select('_id personId').lean(),
    Enrollment.find({ collegeId, status: 'enrolled', studentId: { $in: studentIds }, courseOfferingId: { $in: offeringIds } }).select('studentId courseOfferingId').lean(),
    HostelAllocation.find({ collegeId, status: 'active', studentId: { $in: studentIds } }).select('studentId roomId').lean(),
    Enrollment.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { collegeId: new Types.ObjectId(collegeId), status: 'enrolled', courseOfferingId: { $in: offeringIds } } },
      { $group: { _id: '$courseOfferingId', n: { $sum: 1 } } },
    ]),
  ]);
  const rooms = allocations.length ? await HostelRoom.find({ collegeId, _id: { $in: allocations.map((a) => a.roomId) } }).select('_id blockId').lean() : [];

  const blockByRoom = new Map(rooms.map((r) => [s(r._id), s(r.blockId)]));
  const blockByStudent = new Map(allocations.map((a) => [s(a.studentId), blockByRoom.get(s(a.roomId))]));
  const codesByPerson = new Map<string, string[]>();
  for (const u of users) if (u.personId) codesByPerson.set(s(u.personId), [...new Set([u.personaType, ...(u.personas ?? [])].filter(Boolean))]);
  const accountByPerson = new Map(accounts.map((a) => [s(a.personId), s(a._id)]));
  const enrolledByStudent = new Map<string, string[]>();
  for (const e of enrollments) push(enrolledByStudent, s(e.studentId), s(e.courseOfferingId));
  // Roster fallback (as spaces/strategies.ts): an offering with no enrolments reaches its section's roster.
  const withEnrolments = new Set(enrolCounts.filter((c) => c.n > 0).map((c) => s(c._id)));
  const rosterBySection = new Map<string, string[]>();
  for (const [id, o] of g.offerings) if (!withEnrolments.has(id)) push(rosterBySection, o.sectionId, id);
  const headedBy = new Map(departments.filter((d) => d.hodId).map((d) => [s(d.hodId), s(d._id)]));
  const deptName = (id?: string) => (id ? g.departments.get(id)?.name : undefined);
  const identity = (personId: string) => ({ personId, accountId: accountByPerson.get(personId) ?? null, personaCodes: codesByPerson.get(personId) ?? [] });

  // A person with several ERP rows is taken once: student first, then faculty, then staff.
  for (const st of students) {
    const pid = s(st.personId);
    if (g.people.has(pid)) continue;
    const sid = s(st._id);
    const sectionIds = sectionsByStudent.get(sid) ?? [];
    const departmentId = st.branchId ? branchDept.get(s(st.branchId)) : undefined;
    const batchId = st.batchId ? s(st.batchId) : undefined;
    const roster = sectionIds.flatMap((sec) => rosterBySection.get(sec) ?? []);
    g.people.set(pid, {
      ...identity(pid), kind: 'student', isHod: false, departmentId, batchId, sectionIds,
      offeringIds: [...new Set([...(enrolledByStudent.get(sid) ?? []), ...roster])],
      hostelBlockId: blockByStudent.get(sid),
      labels: {
        batch: batchId ? g.batches.get(batchId)?.name : undefined,
        section: sectionIds[0] ? g.sections.get(sectionIds[0])?.name : undefined,
        department: deptName(departmentId),
      },
    });
  }
  for (const f of faculty) {
    const pid = s(f.personId);
    if (g.people.has(pid)) continue;
    const fid = s(f._id);
    const headed = headedBy.get(fid);
    const departmentId = f.departmentId ? s(f.departmentId) : headed;
    g.people.set(pid, {
      ...identity(pid), kind: 'faculty', isHod: Boolean(headed), departmentId, sectionIds: [],
      offeringIds: offeringsByFaculty.get(fid) ?? [], labels: { department: deptName(departmentId) },
    });
  }
  for (const st of staff) {
    const pid = s(st.personId);
    if (g.people.has(pid)) continue;
    const departmentId = st.departmentId ? s(st.departmentId) : undefined;
    const base = identity(pid);
    g.people.set(pid, {
      ...base, personaCodes: [...new Set([...base.personaCodes, ...(st.personaCode ? [st.personaCode] : [])])],
      kind: 'staff', isHod: false, departmentId, sectionIds: [], offeringIds: [], labels: { department: deptName(departmentId) },
    });
  }
  return g;
}

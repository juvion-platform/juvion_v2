import { Types } from 'mongoose';
import { College } from '../../../models/College';
import { User } from '../../../models/User';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Branch } from '../../../models/academic-structure/Branch';
import { Department } from '../../../models/academic-structure/Department';
import { Batch } from '../../../models/academic-structure/Batch';
import { Section } from '../../../models/academic-structure/Section';
import { Semester } from '../../../models/academic-structure/Semester';
import { Course } from '../../../models/academic-ops/Course';
import { CourseOffering } from '../../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../../models/academic-ops/Enrollment';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../../models/welfare/HostelRoom';
import { HostelBlock } from '../../../models/welfare/HostelBlock';
import { JuviAccount, ELIGIBLE_STATUSES, IJuviAccount } from '../../../models/juvi/JuviAccount';
import { ErpGraph, AccountNode, emptyGraph } from './strategies';

export interface ScopeObjects {
  departmentIds: string[];
  batchIds: string[];
  offerings: { id: string; semesterId: string; courseCode: string; courseName: string; sectionName: string }[];
  blockIds: string[];
  endedOfferingIds: string[];
}

export interface CollegeGraph extends ErpGraph {
  scopes: ScopeObjects;
  names: { departments: Map<string, string>; batches: Map<string, string>; blocks: Map<string, string>; college: string };
}

const s = (v: unknown) => String(v);
const ADMIN_ROLES = new Set(['admin', 'principal', 'super_admin']);

/** Lean projection of the active offerings the loaders read. */
interface OfferingLean {
  _id: Types.ObjectId; semesterId: Types.ObjectId; sectionId: Types.ObjectId; facultyId: Types.ObjectId;
  coFacultyIds?: Types.ObjectId[]; courseId: Types.ObjectId;
}

/** College-wide metadata used by both loaders. Hundreds of documents at most. */
async function loadMetadata(collegeId: string, g: ErpGraph): Promise<{ activeSemesterIds: string[]; endedSemesterIds: string[]; offeringDocs: OfferingLean[] }> {
  const [branches, departments, sections, semesters, blocks] = await Promise.all([
    Branch.find({ collegeId }).select('_id departmentId').lean(),
    Department.find({ collegeId, isActive: true }).select('_id hodId').lean(),
    Section.find({ collegeId }).select('_id batchId branchId classAdvisorId').lean(),
    Semester.find({ collegeId, status: { $in: ['active', 'completed'] } }).select('_id status').lean(),
    HostelBlock.find({ collegeId, isActive: true }).select('_id wardenId chiefWardenId').lean(),
  ]);
  for (const b of branches) if (b.departmentId) g.branchDepartment.set(s(b._id), s(b.departmentId));
  for (const d of departments) g.departments.set(s(d._id), { hodFacultyId: d.hodId ? s(d.hodId) : undefined });
  for (const sec of sections) g.sections.set(s(sec._id), { batchId: s(sec.batchId), branchId: s(sec.branchId), classAdvisorId: sec.classAdvisorId ? s(sec.classAdvisorId) : undefined });
  for (const b of blocks) g.blocks.set(s(b._id), { wardenPersonId: b.wardenId ? s(b.wardenId) : undefined, chiefWardenStaffId: b.chiefWardenId ? s(b.chiefWardenId) : undefined });

  const activeSemesterIds = semesters.filter((x) => x.status === 'active').map((x) => s(x._id));
  const endedSemesterIds = semesters.filter((x) => x.status === 'completed').map((x) => s(x._id));

  const offeringDocs = await CourseOffering.find({ collegeId, status: 'active', semesterId: { $in: activeSemesterIds } })
    .select('_id semesterId sectionId facultyId coFacultyIds courseId').lean<OfferingLean[]>();
  const counts = await Enrollment.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { collegeId: new Types.ObjectId(collegeId), status: 'enrolled', courseOfferingId: { $in: offeringDocs.map((o) => o._id) } } },
    { $group: { _id: '$courseOfferingId', n: { $sum: 1 } } },
  ]);
  const countBy = new Map(counts.map((c) => [s(c._id), c.n]));
  for (const o of offeringDocs) {
    g.offerings.set(s(o._id), {
      sectionId: s(o.sectionId),
      facultyIds: [s(o.facultyId), ...(o.coFacultyIds ?? []).map(s)],
      enrollmentCount: countBy.get(s(o._id)) ?? 0,
    });
  }
  return { activeSemesterIds, endedSemesterIds, offeringDocs };
}

async function buildAccountNodes(collegeId: string, accounts: IJuviAccount[]): Promise<AccountNode[]> {
  const studentIds = accounts.filter((a) => a.studentId).map((a) => a.studentId!);
  const facultyIds = accounts.filter((a) => a.facultyId).map((a) => a.facultyId!);
  const staffIds = accounts.filter((a) => a.staffId).map((a) => a.staffId!);

  const [users, students, faculty, staff, sections, enrollments, allocations] = await Promise.all([
    User.find({ collegeId, _id: { $in: accounts.map((a) => a.userId) } }).select('_id role').lean(),
    Student.find({ collegeId, _id: { $in: studentIds } }).select('_id batchId branchId').lean(),
    Faculty.find({ collegeId, _id: { $in: facultyIds } }).select('_id departmentId contractType').lean(),
    Staff.find({ collegeId, _id: { $in: staffIds } }).select('_id personaCode').lean(),
    Section.find({ collegeId, studentIds: { $in: studentIds } }).select('_id studentIds').lean(),
    Enrollment.find({ collegeId, status: 'enrolled', studentId: { $in: studentIds } }).select('studentId courseOfferingId').lean(),
    HostelAllocation.find({ collegeId, status: 'active', studentId: { $in: studentIds } }).select('studentId roomId').lean(),
  ]);
  const roomIds = allocations.map((a) => a.roomId);
  const rooms = roomIds.length ? await HostelRoom.find({ collegeId, _id: { $in: roomIds } }).select('_id blockId').lean() : [];
  const blockByRoom = new Map(rooms.map((r) => [s(r._id), s(r.blockId)]));

  const roleByUser = new Map(users.map((u) => [s(u._id), u.role]));
  const studentById = new Map(students.map((x) => [s(x._id), x]));
  const facultyById = new Map(faculty.map((x) => [s(x._id), x]));
  const staffById = new Map(staff.map((x) => [s(x._id), x]));
  const sectionsByStudent = new Map<string, string[]>();
  for (const sec of sections) for (const sid of sec.studentIds ?? []) sectionsByStudent.set(s(sid), [...(sectionsByStudent.get(s(sid)) ?? []), s(sec._id)]);
  const offeringsByStudent = new Map<string, string[]>();
  for (const e of enrollments) offeringsByStudent.set(s(e.studentId), [...(offeringsByStudent.get(s(e.studentId)) ?? []), s(e.courseOfferingId)]);
  const blockByStudent = new Map(allocations.map((a) => [s(a.studentId), blockByRoom.get(s(a.roomId))]));

  return accounts.map((a) => {
    const node: AccountNode = { accountId: s(a._id), kind: a.kind, personId: s(a.personId), isAdminOrPrincipal: ADMIN_ROLES.has(roleByUser.get(s(a.userId)) ?? '') };
    if (a.kind === 'student' && a.studentId) {
      const st = studentById.get(s(a.studentId));
      node.student = {
        studentId: s(a.studentId), batchId: st?.batchId ? s(st.batchId) : undefined, branchId: st?.branchId ? s(st.branchId) : undefined,
        sectionIds: sectionsByStudent.get(s(a.studentId)) ?? [], enrolledOfferingIds: offeringsByStudent.get(s(a.studentId)) ?? [],
        hostelBlockId: blockByStudent.get(s(a.studentId)),
      };
    } else if (a.kind === 'faculty' && a.facultyId) {
      const f = facultyById.get(s(a.facultyId));
      node.faculty = { facultyId: s(a.facultyId), departmentId: f?.departmentId ? s(f.departmentId) : undefined, contractType: f?.contractType ?? 'regular' };
    } else if (a.kind === 'staff' && a.staffId) {
      node.staff = { staffId: s(a.staffId), personaCode: staffById.get(s(a.staffId))?.personaCode ?? undefined };
    }
    return node;
  });
}

export async function loadCollegeGraph(collegeId: string): Promise<CollegeGraph> {
  const g = emptyGraph() as CollegeGraph;
  const { endedSemesterIds, offeringDocs } = await loadMetadata(collegeId, g);

  const accounts = await JuviAccount.find({ collegeId, status: { $in: ELIGIBLE_STATUSES } });
  for (const node of await buildAccountNodes(collegeId, accounts)) g.accounts.set(node.accountId, node);

  const [college, batches, departments, blocks, courses, sections, ended] = await Promise.all([
    College.findById(collegeId).select('name').lean(),
    Batch.find({ collegeId, isActive: true }).select('_id code').lean(),
    Department.find({ collegeId, isActive: true }).select('_id name').lean(),
    HostelBlock.find({ collegeId, isActive: true }).select('_id name').lean(),
    Course.find({ collegeId, _id: { $in: offeringDocs.map((o) => o.courseId) } }).select('_id code name').lean(),
    Section.find({ collegeId, _id: { $in: offeringDocs.map((o) => o.sectionId) } }).select('_id name').lean(),
    CourseOffering.find({ collegeId, semesterId: { $in: endedSemesterIds } }).select('_id').lean(),
  ]);
  const courseById = new Map(courses.map((c) => [s(c._id), c]));
  const sectionName = new Map(sections.map((x) => [s(x._id), x.name]));
  const batchesWithStudents = new Set([...g.accounts.values()].map((a) => a.student?.batchId).filter(Boolean) as string[]);

  g.scopes = {
    departmentIds: departments.map((d) => s(d._id)),
    batchIds: batches.map((b) => s(b._id)).filter((id) => batchesWithStudents.has(id)),
    offerings: offeringDocs.map((o) => ({
      id: s(o._id), semesterId: s(o.semesterId),
      courseCode: courseById.get(s(o.courseId))?.code ?? '', courseName: courseById.get(s(o.courseId))?.name ?? '',
      sectionName: sectionName.get(s(o.sectionId)) ?? '',
    })),
    blockIds: blocks.map((b) => s(b._id)),
    endedOfferingIds: ended.map((o) => s(o._id)),
  };
  g.names = {
    departments: new Map(departments.map((d) => [s(d._id), d.name])),
    batches: new Map(batches.map((b) => [s(b._id), b.code])),
    blocks: new Map(blocks.map((b) => [s(b._id), b.name])),
    college: college?.name ?? '',
  };
  return g;
}

export async function loadAccountGraph(collegeId: string, accountId: string): Promise<ErpGraph> {
  const g = emptyGraph();
  const account = await JuviAccount.findOne({ _id: accountId, collegeId, status: { $in: ELIGIBLE_STATUSES } });
  if (!account) return g;
  await loadMetadata(collegeId, g);
  for (const node of await buildAccountNodes(collegeId, [account])) g.accounts.set(node.accountId, node);
  return g;
}

import { Model, Types } from 'mongoose';
import { College } from '../../models/College';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { Regulation } from '../../models/academic-structure/Regulation';
import { Department } from '../../models/academic-structure/Department';
import { Programme } from '../../models/academic-structure/Programme';
import { Branch } from '../../models/academic-structure/Branch';
import { Batch } from '../../models/academic-structure/Batch';
import { Semester } from '../../models/academic-structure/Semester';
import { Section } from '../../models/academic-structure/Section';
import { Course } from '../../models/academic-ops/Course';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { Person } from '../../models/people/Person';
import { Faculty } from '../../models/people/Faculty';
import { Staff } from '../../models/people/Staff';
import { User } from '../../models/User';
import { HostelBlock } from '../../models/welfare/HostelBlock';
import { HostelRoom } from '../../models/welfare/HostelRoom';
import { DemoCtx, DemoFaculty } from './context';

export const JIT_ID = '000000000000000000000001';
export const JIT_NAME = 'Juvion Institute of Technology';

/** The demo year. Students admitted 2023–2026 are in years 4–1. */
export const DEMO_AY = { code: 'AY2026-27', label: 'Academic Year 2026-27', start: new Date('2026-07-01'), end: new Date('2027-06-30') };
const TERM1 = { start: new Date('2026-07-15'), end: new Date('2026-12-15') };
export const ADMISSION_YEARS = [2026, 2025, 2024, 2023] as const; // → years of study 1..4
export const yearOfStudy = (admissionYear: number) => 2026 - admissionYear + 1;

/** JNTU branch codes, used in roll numbers (…B01A05xx is CSE). */
export const BRANCHES = [
  { code: 'CSE', name: 'Computer Science and Engineering', roll: '05', prefix: 'CS', intake: 180 },
  { code: 'ECE', name: 'Electronics and Communication Engineering', roll: '04', prefix: 'EC', intake: 120 },
  { code: 'MECH', name: 'Mechanical Engineering', roll: '03', prefix: 'ME', intake: 120 },
  { code: 'CIVIL', name: 'Civil Engineering', roll: '01', prefix: 'CE', intake: 60 },
] as const;

const COURSES: Record<string, string[][]> = {
  CSE: [
    ['Programming for Problem Solving', 'Engineering Mathematics I', 'Engineering Physics'],
    ['Data Structures', 'Discrete Mathematics', 'Digital Logic Design'],
    ['Operating Systems', 'Database Management Systems', 'Computer Networks'],
    ['Machine Learning', 'Cloud Computing', 'Cryptography and Network Security'],
  ],
  ECE: [
    ['Basic Electrical Engineering', 'Engineering Mathematics I', 'Engineering Chemistry'],
    ['Electronic Devices and Circuits', 'Signals and Systems', 'Network Analysis'],
    ['Analog Communications', 'Linear IC Applications', 'Microprocessors and Microcontrollers'],
    ['VLSI Design', 'Digital Signal Processing', 'Embedded Systems'],
  ],
  MECH: [
    ['Engineering Graphics', 'Engineering Mathematics I', 'Engineering Mechanics'],
    ['Thermodynamics', 'Strength of Materials', 'Manufacturing Processes'],
    ['Heat Transfer', 'Design of Machine Elements', 'Fluid Mechanics and Machinery'],
    ['CAD/CAM', 'Automobile Engineering', 'Refrigeration and Air Conditioning'],
  ],
  CIVIL: [
    ['Engineering Drawing', 'Engineering Mathematics I', 'Engineering Chemistry'],
    ['Surveying', 'Strength of Materials', 'Fluid Mechanics'],
    ['Structural Analysis', 'Geotechnical Engineering', 'Transportation Engineering'],
    ['Design of Steel Structures', 'Estimation and Costing', 'Environmental Engineering'],
  ],
};

/** Faculty per department. `login` ties a row to a demo login's person. */
const FACULTY: Array<{ dept: string; name: string; designation: string; login?: string }> = [
  { dept: 'CSE', name: 'Dr. Ramesh Iyer', designation: 'Professor & HOD', login: 'hod.cse@jit.edu.in' },
  { dept: 'CSE', name: 'Dr. Lakshmi Prasad', designation: 'Associate Professor', login: 'faculty.cse@jit.edu.in' },
  { dept: 'CSE', name: 'Dr. Kiran Kumar Varma', designation: 'Assistant Professor' },
  { dept: 'ECE', name: 'Dr. Suresh Babu', designation: 'Professor & HOD' },
  { dept: 'ECE', name: 'Dr. Anitha Reddy', designation: 'Associate Professor' },
  { dept: 'ECE', name: 'Mr. Vamshi Krishna', designation: 'Assistant Professor' },
  { dept: 'MECH', name: 'Dr. Venkat Rao', designation: 'Professor & HOD' },
  { dept: 'MECH', name: 'Mr. Prakash Goud', designation: 'Assistant Professor' },
  { dept: 'MECH', name: 'Dr. Sravani Naidu', designation: 'Associate Professor' },
  { dept: 'CIVIL', name: 'Dr. Sunita Deshmukh', designation: 'Professor & HOD' },
  { dept: 'CIVIL', name: 'Mr. Harish Chowdary', designation: 'Assistant Professor' },
  { dept: 'CIVIL', name: 'Dr. Madhavi Latha', designation: 'Associate Professor' },
];

/** Staff behind the non-faculty logins. The warden doubles as the hostel reporter. */
const STAFF: Array<{ login: string; name: string; designation: string; code: string }> = [
  { login: 'warden@jit.edu.in', name: 'Mahesh Yadav', designation: 'Chief Warden', code: 'JIT-S-WARDEN' },
  { login: 'accounts@jit.edu.in', name: 'Padma Latha', designation: 'Accounts Officer', code: 'JIT-S-ACC' },
  { login: 'exam@jit.edu.in', name: 'Ravi Teja', designation: 'Controller of Examinations', code: 'JIT-S-EXAM' },
  { login: 'registrar@jit.edu.in', name: 'K. Narayana', designation: 'Registrar', code: 'JIT-S-REG' },
  { login: 'admissions@jit.edu.in', name: 'Swathi Kulkarni', designation: 'Admissions Counsellor', code: 'JIT-S-ADM' },
];

/** First match wins; creates only when nothing matches. Never overwrites. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensure(model: Model<any>, filter: Record<string, unknown>, doc: Record<string, unknown>): Promise<Types.ObjectId> {
  const found = await model.findOne(filter).select({ _id: 1 }).lean<{ _id: Types.ObjectId }>();
  if (found) return found._id;
  const created = await model.create({ ...filter, ...doc });
  return created._id as Types.ObjectId;
}

export async function findOrCreateCollege(log: (m: string) => void): Promise<{ collegeId: string; collegeName: string }> {
  let college = await College.findOne({ code: 'JIT' }).lean();
  if (!college) {
    const idFree = !(await College.exists({ _id: JIT_ID }));
    const created = await College.create({
      ...(idFree ? { _id: new Types.ObjectId(JIT_ID) } : {}),
      name: JIT_NAME, code: 'JIT', status: 'active',
      address: { line1: 'Gandipet Road', city: 'Hyderabad', state: 'Telangana', pincode: '500075' },
      contactEmail: 'info@jit.edu.in', contactPhone: '04023456789',
      subscription: { plan: 'premium', status: 'active' },
    });
    college = created.toObject();
    log(`college: created ${JIT_NAME}`);
  } else {
    log(`college: using existing ${college.name} (${college._id})`);
  }
  return { collegeId: String(college._id), collegeName: college.name };
}

/** People behind a login: reuse the login's Person, else create one. */
async function personFor(collegeId: string, login: string | undefined, name: string, phone: string): Promise<Types.ObjectId> {
  if (login) {
    const user = await User.findOne({ collegeId, email: login }).select({ personId: 1 }).lean();
    if (user?.personId && (await Person.exists({ _id: user.personId, collegeId }))) return user.personId as Types.ObjectId;
  }
  return ensure(Person, { collegeId, name, phone }, { email: login, gender: /Dr\. (Lakshmi|Anitha|Sravani|Sunita|Madhavi)|Padma|Swathi/.test(name) ? 'female' : 'male', preferredLanguage: 'en' });
}

export async function ensureFoundations(
  collegeId: string,
  collegeName: string,
  log: (m: string) => void,
): Promise<{ ctx: DemoCtx; people: Record<string, Types.ObjectId> }> {
  const cid = collegeId;

  // Academic year: reuse one that already covers 2026-27 under any code.
  const existingAy = await AcademicYear.findOne({
    collegeId: cid,
    $or: [{ code: { $in: [DEMO_AY.code, '2026-27', '2026-2027'] } }, { startDate: { $gte: new Date('2026-06-01'), $lt: new Date('2026-09-01') } }],
  }).lean();
  const ayId = existingAy?._id as Types.ObjectId | undefined
    ?? (await AcademicYear.create({ collegeId: cid, code: DEMO_AY.code, label: DEMO_AY.label, startDate: DEMO_AY.start, endDate: DEMO_AY.end, status: 'active' }))._id as Types.ObjectId;
  await AcademicYear.updateMany({ collegeId: cid, _id: { $ne: ayId } }, { $set: { isCurrent: false } });
  await AcademicYear.updateOne({ _id: ayId }, { $set: { isCurrent: true, status: 'active' } });

  const regulationId = await ensure(Regulation, { collegeId: cid, code: 'R22' }, { name: 'Regulation 2022', effectiveFromYear: 2022, totalCredits: 160, maxYears: 8, isActive: true });
  const programmeId = await ensure(Programme, { collegeId: cid, code: 'BTECH' }, { name: 'Bachelor of Technology', level: 'UG', durationYears: 4, regulationId, isActive: true });

  const departments: Record<string, Types.ObjectId> = {};
  const branches: Record<string, Types.ObjectId> = {};
  for (const b of BRANCHES) {
    departments[b.code] = await ensure(Department, { collegeId: cid, code: b.code }, { name: b.name, isActive: true });
    branches[b.code] = await ensure(Branch, { collegeId: cid, code: b.code }, { name: b.name, programmeId, departmentId: departments[b.code], intake: b.intake, isActive: true });
  }

  const batches: Record<number, Types.ObjectId> = {};
  for (const yr of ADMISSION_YEARS) {
    const found = await Batch.findOne({ collegeId: cid, programmeId, admissionYear: yr }).select({ _id: 1 }).lean();
    batches[yr] = (found?._id as Types.ObjectId | undefined)
      ?? await ensure(Batch, { collegeId: cid, code: `B${yr}` }, { name: `Batch ${yr}-${String(yr + 4).slice(2)}`, admissionYear: yr, programmeId, regulationId, isActive: true });
  }

  const semesterId = await ensure(Semester, { collegeId: cid, academicYearId: ayId, number: 1 }, { year: 2026, startDate: TERM1.start, endDate: TERM1.end, status: 'active' });
  await Semester.updateOne({ _id: semesterId }, { $set: { status: 'active' } });
  await ensure(Semester, { collegeId: cid, academicYearId: ayId, number: 2 }, { year: 2027, startDate: new Date('2027-01-10'), endDate: new Date('2027-05-30'), status: 'upcoming' });

  // Faculty, three per department, two of them behind demo logins.
  const people: Record<string, Types.ObjectId> = {};
  const faculty: DemoFaculty[] = [];
  let phone = 9848000100;
  for (const [i, f] of FACULTY.entries()) {
    const personId = await personFor(cid, f.login, f.name, String(phone++));
    const existing = await Faculty.findOne({ collegeId: cid, personId }).select({ _id: 1 }).lean();
    const _id = (existing?._id as Types.ObjectId | undefined) ?? await ensure(Faculty, { collegeId: cid, employeeCode: `JIT-F-${f.dept}-${String(i + 1).padStart(2, '0')}` }, {
      personId, designation: f.designation, departmentId: departments[f.dept], contractType: 'regular', status: 'active',
      qualification: f.name.startsWith('Dr.') ? 'Ph.D.' : 'M.Tech',
    });
    // A login's faculty row must sit in the department it demos.
    if (f.login) {
      await Faculty.updateOne({ _id }, { $set: { departmentId: departments[f.dept], status: 'active' } });
      people[f.login] = personId;
    }
    faculty.push({ _id, personId, dept: f.dept });
  }
  const hod = faculty.find((f) => f.dept === 'CSE')!;
  await Department.updateOne({ _id: departments.CSE }, { $set: { hodId: hod._id } });

  let staffId: Types.ObjectId | undefined;
  let staffPersonId: Types.ObjectId | undefined;
  for (const s of STAFF) {
    const personId = await personFor(cid, s.login, s.name, String(phone++));
    const existing = await Staff.findOne({ collegeId: cid, personId }).select({ _id: 1 }).lean();
    const _id = (existing?._id as Types.ObjectId | undefined)
      ?? await ensure(Staff, { collegeId: cid, employeeCode: s.code }, { personId, designation: s.designation, staffType: 'administrative', status: 'active' });
    people[s.login] = personId;
    if (!staffId) { staffId = _id; staffPersonId = personId; }
  }

  // One section per branch × year, with three courses taught this term.
  const byDept = (d: string) => faculty.filter((f) => f.dept === d);
  let offerings = 0;
  for (const b of BRANCHES) {
    const teachers = byDept(b.code);
    for (const yr of ADMISSION_YEARS) {
      const yos = yearOfStudy(yr);
      const sectionId = await ensure(Section, { collegeId: cid, branchId: branches[b.code], batchId: batches[yr], name: 'A' }, {
        year: yos, semester: yos * 2 - 1, capacity: 60, classAdvisorId: teachers[yos % teachers.length]!._id,
      });
      for (const [k, name] of COURSES[b.code]![yos - 1]!.entries()) {
        const courseId = await ensure(Course, { collegeId: cid, code: `${b.prefix}${yos}0${k + 1}`, regulationId }, {
          name, departmentId: departments[b.code], credits: 3, lectureHrs: 3, tutorialHrs: 1, type: 'theory',
        });
        // CSE: Dr. Lakshmi Prasad teaches years 2–3, the HOD years 3–4, so the
        // faculty login's "my students" is two real sections.
        let teacher = teachers[(k + yos) % teachers.length]!;
        if (b.code === 'CSE') {
          if (k === 0 && (yos === 2 || yos === 3)) teacher = teachers[1]!;
          else if (k === 1 && (yos === 3 || yos === 4)) teacher = teachers[0]!;
          else teacher = teachers[2]!;
        }
        await ensure(CourseOffering, { collegeId: cid, courseId, sectionId, semesterId }, { facultyId: teacher._id, status: 'active' });
        offerings += 1;
      }
    }
  }

  if ((await HostelBlock.countDocuments({ collegeId: cid })) === 0) {
    for (const [name, type] of [['Godavari Block', 'boys'], ['Krishna Block', 'girls']] as const) {
      const block = await HostelBlock.create({ collegeId: cid, name, type, totalRooms: 20, totalCapacity: 60, isActive: true });
      await HostelRoom.insertMany(Array.from({ length: 20 }, (_, i) => ({
        collegeId: cid, blockId: block._id, roomNumber: `${type === 'boys' ? 'G' : 'K'}-${i < 10 ? 1 : 2}${String((i % 10) + 1).padStart(2, '0')}`,
        floor: i < 10 ? 1 : 2, capacity: 3, roomType: 'triple', status: 'available',
      })));
    }
    log('hostel: 2 blocks, 40 rooms created');
  }

  log(`foundations: AY2026-27 current, 4 branches, 4 batches, 16 sections, ${offerings} course offerings, ${faculty.length} faculty, ${STAFF.length} staff`);
  return {
    ctx: {
      collegeId: cid, collegeName, ayId, semesterId, semesterStart: TERM1.start, regulationId, programmeId,
      departments, branches, faculty, staffId: staffId!, staffPersonId: staffPersonId!, students: [], log,
    },
    people,
  };
}

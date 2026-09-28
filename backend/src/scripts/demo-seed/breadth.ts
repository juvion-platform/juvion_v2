/**
 * Fill-if-empty breadth for the non-AI modules: every hub/list page shows
 * something instead of an empty state.
 *
 * Each collection is filled only when this college has none of it, so a
 * college that already has rows (seed.ts, real use) is left alone and a
 * second run writes nothing. Dependent collections reuse whatever parent
 * rows exist, created here or not.
 */
import { Model, Types } from 'mongoose';
import {
  Applicant, AdmissionOffer, SeatInventory,
  PlacementSeason, Company, JobPosting, PlacementRegistration, PlacementRound, PlacementOffer,
  InternshipPosting, InternshipApplication, PlacementTraining, AlumniProfile, MockInterview,
  Employee, LeaveType, LeaveApplication, Payroll, Appraisal, Recruitment, Training, Publication, ResearchProject,
  ExamSchedule, SemesterResult, Course, Semester, Student,
  MessMenu, MessFeedback, TransportRoute, TransportAllocation, StudentGrievance, HealthRecord, MedicalVisit,
  HostelVisitorLog, HostelBlock,
  Building, Room, Lab, Asset, ITAsset, Vehicle, Vendor, StockItem, PurchaseOrder, MaintenanceRequest,
  GatePass, VisitorEntry, SecurityIncident, CCTV, ParkingSlot, Book, BookIssue, LibraryMember, EResource, RoomBooking,
  Club, ClubMembership, Event, EventRegistration, Achievement, SportsTeam, NSSActivity, Mentoring,
  SkillCertification, LeadershipRole, StudentProject,
  AccreditationBody, AccreditationCycle, ComplianceCriteria, RegulatoryFiling,
  Committee, CommitteeMeeting, GoverningBodyMember, Policy as GovernancePolicy,
  Announcement, Circular, Notification,
} from '../../models';
import { WorkflowInstance } from '../../models/workflow/WorkflowInstance';
import { WorkflowTask } from '../../models/workflow/WorkflowTask';
import { ExamRoom } from '../../models/academic-ops/ExamRoom';
import { DemoCtx, TAG, daysAgo, rng } from './context';

type Row = Record<string, unknown>;
type Doc = { _id: Types.ObjectId } & Record<string, any>;

/** Drop rows repeating an earlier row's values for `keys` (unique indexes). */
function uniq(rows: Row[], ...keys: string[]): Row[] {
  const seen = new Set<string>();
  return rows.filter((x) => { const k = keys.map((key) => String(x[key])).join(':'); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Future dates read better as "in N days". */
const inDays = (n: number, hour = 10) => daysAgo(-n, hour);

export async function seedBreadth(ctx: DemoCtx): Promise<void> {
  const cid = ctx.collegeId;
  const r = rng(20260930);
  const S = ctx.students;
  const F = ctx.faculty;
  const st = (i: number) => S[i % S.length]!;
  const fa = (i: number) => F[i % F.length]!;
  const deptIds = Object.values(ctx.departments);
  const dept = (code: string) => ctx.departments[code] ?? deptIds[0]!;
  const branchCodes = Object.keys(ctx.branches);
  const principal = fa(0).personId; // a senior faculty person stands in as approver
  const final = S.filter((s) => s.year === 4);
  const pre = S.filter((s) => s.year === 3);
  const finalYear = (i: number) => (final.length ? final[i % final.length]! : st(i));

  let module = '';
  let created: string[] = [];
  let skipped: string[] = [];
  const begin = (name: string) => { module = name; created = []; skipped = []; };
  const end = () => ctx.log(`breadth/${module}: created ${created.join(', ') || 'nothing'}${skipped.length ? `; kept existing ${skipped.join(', ')}` : ''}`);

  /** Create rows when the college has none; otherwise return what exists. */
  async function fill(model: Model<any>, label: string, make: () => Row[] | Promise<Row[]>): Promise<Doc[]> {
    const existing = (await model.find({ collegeId: cid }).limit(50).lean()) as Doc[];
    if (existing.length) { skipped.push(label); return existing; }
    const rows = await make();
    if (!rows.length) { skipped.push(`${label} (no source rows)`); return []; }
    const docs = (await model.create(rows.map((x) => ({ collegeId: cid, ...x })))) as Doc[];
    created.push(`${label} ${docs.length}`);
    return docs;
  }
  /** Skip a collection (with its reason) when a prerequisite is missing. */
  const skip = (label: string, why: string) => skipped.push(`${label} (skipped: ${why})`);

  // ── Admissions ────────────────────────────────────────────────────────
  begin('admissions');
  const APPLICANTS = [
    ['Rithika Sai', 'female', 'Hyderabad', 'CSE', 'convener', 'OC', 2800, 'submitted'],
    ['Sudheer Varma', 'male', 'Warangal', 'ECE', 'convener', 'BC-B', 7400, 'under_review'],
    ['Tanya Singh', 'female', 'Karimnagar', 'CSE', 'management', 'OC', 0, 'offered'],
    ['Harsha Vardhan', 'male', 'Nizamabad', 'MECH', 'convener', 'SC', 12000, 'documents_pending'],
    ['Lavanya Reddy', 'female', 'Khammam', 'CSE', 'convener', 'OC', 3100, 'accepted'],
    ['Pranav Kolla', 'male', 'Nalgonda', 'CIVIL', 'management', 'OC', 0, 'submitted'],
  ] as const;
  const applicants = await fill(Applicant, 'applicants', () => APPLICANTS.map(([name, gender, city, branch, quota, category, rank, status], i) => ({
    applicationNumber: `APP2026-${String(i + 1).padStart(4, '0')}`, name, phone: `98765${String(40020 + i)}`,
    email: `${name.split(' ')[0]!.toLowerCase()}.${i}@example.com`, gender, dateOfBirth: new Date(`2008-0${(i % 9) + 1}-1${i}`),
    city, state: 'Telangana', tenthPercentage: 85 + (i % 10), interPercentage: 80 + (i % 12), interStream: 'MPC',
    programmeApplied: 'B.Tech', branchPreference1: branch, quota, category, ...(rank ? { eamcetRank: rank } : {}),
    applicationDate: daysAgo(40 - i * 4), status,
  })));
  await fill(AdmissionOffer, 'admission offers', () => applicants.slice(0, 4).map((a, i) => ({
    applicantId: a._id, programmeId: ctx.programmeId, branchId: ctx.branches[String(a.branchPreference1)] ?? ctx.branches[branchCodes[0]!],
    feeQuoted: a.quota === 'management' ? 312500 : 125000, validityDate: inDays(10 + i * 3), status: i % 2 ? 'offered' : 'accepted',
  })));
  const INTAKE: Record<string, number> = { CSE: 180, ECE: 120, EEE: 60, MECH: 120, CIVIL: 60 };
  await fill(SeatInventory, 'seat inventory', () => branchCodes.map((code) => {
    const n = INTAKE[code] ?? 60;
    const conv = Math.round(n * 0.7), mgmt = Math.round(n * 0.2), nri = Math.round(n * 0.05), spot = n - conv - mgmt - nri;
    return {
      academicYearId: ctx.ayId, programmeId: ctx.programmeId, branchId: ctx.branches[code], sanctionedIntake: n,
      convenerSeats: conv, managementSeats: mgmt, nriSeats: nri, spotSeats: spot, lateralEntrySeats: 0,
      convenerFilled: Math.round(conv * 0.93), managementFilled: Math.round(mgmt * 0.85), nriFilled: Math.round(nri * 0.6), spotFilled: Math.round(spot * 0.5), lateralFilled: 0,
      status: 'published', lastUpdatedBy: 'admin@jit.edu.in',
    };
  }));
  const instances = await fill(WorkflowInstance, 'admission workflows', () => applicants.slice(0, 5).map((a, i) => ({
    workflowId: 'W01', workflowVersion: 1, entityType: 'Applicant', entityId: a._id, academicYearId: ctx.ayId,
    currentPhase: 'M01.2_APP', currentStep: i < 3 ? 'doc_collection' : 'app_submit', status: 'active', initiatedBy: 'admissions@jit.edu.in',
    metadata: { source: TAG }, history: [{ step: 'lead_convert', status: 'completed', at: daysAgo(30 - i * 3), by: 'admissions@jit.edu.in' }],
  })));
  await fill(WorkflowTask, 'workflow tasks', () => instances
    .filter((w) => w.workflowId === 'W01')
    .map((w, i) => ({
      workflowInstanceId: w._id, workflowId: 'W01', stepId: String(w.currentStep),
      stepName: w.currentStep === 'doc_collection' ? 'Collect Documents' : 'Submit Application', phase: String(w.currentPhase),
      type: 'manual', entityType: String(w.entityType), entityId: w.entityId, status: i % 2 ? 'in_progress' : 'pending', createdBy: 'system',
    })));
  end();

  // ── Placement ─────────────────────────────────────────────────────────
  begin('placement');
  const seasons = await fill(PlacementSeason, 'seasons', () => [
    { academicYearId: ctx.ayId, name: 'Campus Placements 2026-27', startDate: daysAgo(60), endDate: inDays(240), status: 'active' },
  ]);
  const COMPANIES = [
    ['Tata Consultancy Services', 'IT Services', 'tcs.com', 'mass'], ['Infosys Limited', 'IT Services', 'infosys.com', 'mass'],
    ['Wipro Technologies', 'IT Services', 'wipro.com', 'regular'], ['Accenture', 'Consulting & IT', 'accenture.com', 'regular'],
    ['Cognizant', 'IT Services', 'cognizant.com', 'mass'], ['Deloitte USI', 'Consulting', 'deloitte.com', 'dream'],
  ] as const;
  const companies = await fill(Company, 'companies', () => COMPANIES.map(([name, industry, site, tier], i) => ({
    name, industry, website: `https://${site}`, contactPerson: r.pick(['Anil Mehta', 'Rekha Jain', 'Suresh Patil', 'Kavya Rao', 'Imran Khan']),
    contactEmail: `campus.hyd${i}@${site}`, contactPhone: `0404000${String(1000 + i)}`, tier, isActive: true,
  })));
  const active = seasons.find((s) => s.status === 'active') ?? seasons[0];
  const ROLES: Array<[number, string, number, number]> = [[0, 'Associate Software Engineer', 7, 6], [1, 'Systems Engineer', 6.5, 6], [3, 'Associate Software Engineer', 8.5, 6.5], [5, 'Analyst', 9, 7], [4, 'Programmer Analyst', 6.8, 6]];
  const jobs = active && companies.length
    ? await fill(JobPosting, 'job postings', () => ROLES.map(([c, role, lpa, cgpa], i) => ({
      placementSeasonId: active._id, companyId: companies[c % companies.length]!._id, role, description: `${role} — campus hiring 2026-27`,
      packageLpa: lpa, eligibilityCriteria: { minCGPA: cgpa, allowedBranches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'].slice(0, i === 3 ? 2 : 5), noActiveBacklogs: true },
      registrationDeadline: inDays(5 + i * 6), maxPositions: 10 + i * 5, status: 'open',
    })))
    : (skip('job postings', 'no season or company'), []);
  if (jobs.length && S.length) {
    await fill(PlacementRegistration, 'registrations', () => {
      const out: Row[] = [];
      for (let i = 0; i < 18; i++) out.push({ jobPostingId: jobs[i % jobs.length]!._id, studentId: finalYear(i)._id, status: i % 5 === 0 ? 'shortlisted' : 'registered', appliedAt: daysAgo(20 - (i % 15)) });
      return uniq(out, 'jobPostingId', 'studentId');
    });
    await fill(PlacementRound, 'rounds', () => [
      { jobPostingId: jobs[0]!._id, roundNumber: 1, name: 'Online Aptitude Test', type: 'aptitude', date: daysAgo(6), venue: 'Computer Lab', status: 'completed' },
      { jobPostingId: jobs[0]!._id, roundNumber: 2, name: 'Technical Interview', type: 'technical', date: inDays(4), venue: 'Conference Room', status: 'scheduled' },
      { jobPostingId: jobs[Math.min(2, jobs.length - 1)]!._id, roundNumber: 1, name: 'Online Coding Test', type: 'coding', date: inDays(9), venue: 'Online', status: 'scheduled' },
    ]);
    await fill(PlacementOffer, 'offers', () => Array.from({ length: 6 }, (_, i) => {
      const job = jobs[i % jobs.length]!;
      return { jobPostingId: job._id, studentId: finalYear(i * 3 + 1)._id, companyId: job.companyId, packageLpa: job.packageLpa, offerDate: daysAgo(10 - i), joiningDate: inDays(270), status: i < 4 ? 'accepted' : 'extended' };
    }));
  } else skip('registrations/rounds/offers', 'no job postings or students');
  const internships = companies.length
    ? await fill(InternshipPosting, 'internship postings', () => [
      { companyId: companies[0]!._id, title: 'Summer Internship — Software Development', description: '8-week internship in Java/Spring Boot', stipend: 15000, durationWeeks: 8, startDate: inDays(220), lastDateToApply: inDays(40), status: 'open' },
      { companyId: companies[Math.min(5, companies.length - 1)]!._id, title: 'Analyst Internship', description: '10-week consulting analytics internship', stipend: 30000, durationWeeks: 10, startDate: inDays(230), lastDateToApply: inDays(45), status: 'open' },
      { companyId: companies[Math.min(1, companies.length - 1)]!._id, title: 'InStep Research Internship', description: 'Research and development internship', stipend: 25000, durationWeeks: 10, startDate: inDays(225), lastDateToApply: inDays(35), status: 'open' },
    ])
    : (skip('internship postings', 'no company'), []);
  if (internships.length && S.length) {
    await fill(InternshipApplication, 'internship applications', () => uniq(Array.from({ length: 5 }, (_, i) => ({
      internshipId: internships[i % internships.length]!._id, studentId: (pre.length ? pre[i % pre.length]! : st(i))._id, status: i === 1 ? 'shortlisted' : 'applied', appliedAt: daysAgo(8 - i),
    })), 'internshipId', 'studentId'));
  }
  await fill(PlacementTraining, 'trainings', () => [
    { title: 'Aptitude Training — Quantitative & Logical', type: 'aptitude', trainer: 'TIME Institute', startDate: daysAgo(45), endDate: daysAgo(10), status: 'completed' },
    { title: 'Communication Skills & GD Practice', type: 'soft_skills', trainer: 'British Council', startDate: daysAgo(8), endDate: inDays(6), status: 'ongoing' },
    { title: 'Resume Building Workshop', type: 'resume', trainer: 'Placement Cell', startDate: inDays(12), endDate: inDays(12), status: 'planned' },
  ]);
  const graduates = await Student.find({ collegeId: cid, status: { $in: ['graduated', 'alumni'] } }).select({ personId: 1, admissionYear: 1 }).limit(5).lean();
  if (graduates.length) {
    await fill(AlumniProfile, 'alumni', () => graduates.map((g, i) => ({
      personId: g.personId, graduationYear: (g.admissionYear ?? 2021) + 4, currentCompany: COMPANIES[i % COMPANIES.length]![0],
      currentDesignation: r.pick(['Systems Engineer', 'Associate Consultant', 'Software Engineer']), location: r.pick(['Hyderabad', 'Bengaluru', 'Pune']), willingToMentor: i % 2 === 0,
    })));
  } else skip('alumni', 'no graduated students to profile');
  if (S.length) {
    await fill(MockInterview, 'mock interviews', () => Array.from({ length: 4 }, (_, i) => ({
      studentId: finalYear(i)._id, interviewerId: fa(i).personId, date: daysAgo(12 - i * 2), type: ['technical', 'mixed', 'hr', 'technical'][i],
      rating: [4, 3, 4, 5][i], feedback: ['Strong in DSA; practise system design.', 'Good communication; revise OOP fundamentals.', 'Confident and articulate.', 'Excellent problem solving.'][i],
    })));
  }
  end();

  // ── HR ────────────────────────────────────────────────────────────────
  begin('hr');
  const DESIG = ['Professor', 'Associate Professor', 'Assistant Professor', 'Assistant Professor'];
  const employees = await fill(Employee, 'employees', () => [
    ...F.map((f, i) => ({
      personId: f.personId, employeeId: `EMP-D${String(i + 1).padStart(3, '0')}`, departmentId: dept(f.dept), designation: DESIG[i % DESIG.length],
      employeeType: 'teaching', joiningDate: new Date(`20${String(8 + (i % 12)).padStart(2, '0')}-07-01`), status: 'active',
    })),
    { personId: ctx.staffPersonId, employeeId: 'EMP-D900', departmentId: deptIds[0], designation: 'Office Superintendent', employeeType: 'non_teaching', joiningDate: new Date('2015-03-01'), status: 'active' },
  ]);
  const leaveTypes = await fill(LeaveType, 'leave types', () => [
    { name: 'Casual Leave', code: 'CL', maxDaysPerYear: 12, isCarryForward: false, maxCarryForward: 0, applicableTo: ['all'] },
    { name: 'Sick Leave', code: 'SL', maxDaysPerYear: 12, isCarryForward: true, maxCarryForward: 6, applicableTo: ['all'] },
    { name: 'Earned Leave', code: 'EL', maxDaysPerYear: 15, isCarryForward: true, maxCarryForward: 30, applicableTo: ['teaching', 'non_teaching'] },
    { name: 'Duty Leave', code: 'DL', maxDaysPerYear: 15, isCarryForward: false, maxCarryForward: 0, applicableTo: ['teaching'] },
  ]);
  if (employees.length && leaveTypes.length) {
    await fill(LeaveApplication, 'leave applications', () => Array.from({ length: 5 }, (_, i) => {
      const from = i < 3 ? daysAgo(20 - i * 5) : inDays(4 + i);
      const days = 1 + (i % 2);
      return {
        employeeId: employees[i % employees.length]!._id, leaveTypeId: leaveTypes[i % leaveTypes.length]!._id, fromDate: from,
        toDate: new Date(from.getTime() + (days - 1) * 86_400_000), days, reason: ['Personal work', 'Fever and cold', 'Family function', 'Conference travel', 'Medical appointment'][i],
        status: i < 3 ? 'approved' : 'applied', ...(i < 3 ? { approvedBy: principal } : {}),
      };
    }));
    const PAY = [[80000, 24000, 16000, 10000], [65000, 19500, 13000, 8000], [52000, 15600, 10400, 6000], [30000, 9000, 6000, 4000]];
    const lastMonth = daysAgo(28);
    await fill(Payroll, 'payroll', () => employees.slice(0, 8).map((e, i) => {
      const [basic, hra, da, other] = PAY[Math.min(i, PAY.length - 1)]!;
      const gross = basic! + hra! + da! + other!;
      const pf = Math.round(basic! * 0.12), tds = gross > 100000 ? 15000 : gross > 60000 ? 6000 : 0;
      return {
        employeeId: e._id, month: lastMonth.getMonth() + 1, year: lastMonth.getFullYear(), basicPay: basic, hra, da, otherAllowances: other,
        grossPay: gross, pf, esi: 0, tds, otherDeductions: 0, netPay: gross - pf - tds, status: 'paid', paidDate: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0),
      };
    }));
    await fill(Appraisal, 'appraisals', () => employees.slice(1, 4).map((e, i) => ({
      employeeId: e._id, academicYearId: ctx.ayId, reviewerId: employees[0]!._id, selfRating: 4.2 - i * 0.2,
      ...(i !== 1 ? { reviewerRating: 4.0, finalRating: 4.1 - i * 0.1 } : {}),
      goals: [{ description: 'Publish 2 Scopus-indexed papers', weightage: 30, rating: 4 }, { description: 'Mentor 5 students for placements', weightage: 25, rating: 5 }],
      status: i === 1 ? 'self_review' : 'completed',
    })));
  } else skip('leave/payroll/appraisals', 'no employees or leave types');
  await fill(Recruitment, 'recruitment', () => [
    { position: 'Assistant Professor — CSE', departmentId: dept('CSE'), vacancies: 3, qualifications: 'Ph.D in CSE/IT with NET/SLET', experience: '2+ years teaching', salary: '₹60,000–90,000 per month', postedDate: daysAgo(20), lastDate: inDays(25), status: 'open' },
    { position: 'Lab Technician — ECE', departmentId: dept('ECE'), vacancies: 1, qualifications: 'B.Tech/Diploma in ECE', experience: '1+ year', salary: '₹25,000–35,000 per month', postedDate: daysAgo(12), lastDate: inDays(18), status: 'open' },
  ]);
  await fill(Training, 'trainings', () => [
    { title: 'FDP on Outcome-Based Education', type: 'fdp', conductedBy: 'IUCEE', startDate: daysAgo(40), endDate: daysAgo(36), venue: 'Seminar Hall', maxParticipants: 30, status: 'completed' },
    { title: 'Workshop on Research Methodology', type: 'workshop', conductedBy: 'IIT Hyderabad', startDate: daysAgo(9), endDate: daysAgo(8), venue: 'Conference Room', maxParticipants: 25, status: 'completed' },
    { title: 'Generative AI for Educators', type: 'skill_development', conductedBy: 'Internal Faculty', startDate: inDays(14), endDate: inDays(16), venue: 'CSE Lab', maxParticipants: 20, status: 'planned' },
  ]);
  await fill(Publication, 'publications', () => [
    { facultyId: fa(0)._id, title: 'Deep Learning Approaches for Crop Disease Detection', type: 'journal', journalName: 'IEEE Access', publishedDate: daysAgo(120), doi: '10.1109/ACCESS.2026.10231', impactFactor: 3.4, indexing: 'scopus' },
    { facultyId: fa(1)._id, title: 'Low-Power VLSI Design for IoT Edge Devices', type: 'journal', journalName: 'Microelectronics Journal', publishedDate: daysAgo(200), doi: '10.1016/j.mejo.2026.0142', impactFactor: 2.4, indexing: 'scopus' },
    { facultyId: fa(2)._id, title: 'Federated Learning for Privacy-Preserving Healthcare Analytics', type: 'conference', conferenceName: 'IEEE ICMLA 2026', publishedDate: daysAgo(60), indexing: 'scopus' },
    { facultyId: fa(3)._id, title: 'Sustainable Concrete Using Fly Ash Composites', type: 'journal', journalName: 'Construction and Building Materials', publishedDate: daysAgo(150), impactFactor: 7.4, indexing: 'sci' },
  ]);
  await fill(ResearchProject, 'research projects', () => [
    { title: 'AI-Powered Early Detection of Crop Diseases', principalInvestigatorId: fa(0)._id, coInvestigators: [fa(1)._id], fundingAgency: 'DST-SERB', sanctionedAmount: 2500000, startDate: daysAgo(300), endDate: inDays(760), status: 'ongoing' },
    { title: 'Energy-Efficient VLSI Architectures for 5G', principalInvestigatorId: fa(1)._id, fundingAgency: 'AICTE-RPS', sanctionedAmount: 1500000, startDate: daysAgo(90), status: 'sanctioned' },
  ]);
  end();

  // ── Academics extras ──────────────────────────────────────────────────
  begin('academics');
  const courses = await Course.find({ collegeId: cid }).select({ _id: 1 }).limit(6).lean();
  if (courses.length) {
    await fill(ExamSchedule, 'exam schedule', () => courses.slice(0, 5).map((c, i) => ({
      semesterId: ctx.semesterId, courseId: c._id, examType: 'regular', date: inDays(60 + i * 3), startTime: '10:00', endTime: '13:00', venue: i % 2 ? 'Science Block' : 'Main Block', status: 'scheduled',
    })));
  } else skip('exam schedule', 'no courses');
  await fill(ExamRoom, 'exam rooms', () => [
    ['EX-MB101', 'Main Block 101', 60], ['EX-MB102', 'Main Block 102', 60], ['EX-SB201', 'Science Block 201', 48], ['EX-MB301', 'Seminar Hall MB-301', 120],
  ].map(([code, name, capacity]) => ({ code, name, capacity, status: 'active' })));
  const done = await Semester.findOne({ collegeId: cid, status: 'completed' }).sort({ endDate: -1 }).lean();
  const seniors = S.filter((s) => s.year >= 2);
  if (done && seniors.length) {
    await fill(SemesterResult, 'semester results', () => seniors.slice(0, 16).map((s, i) => {
      const sgpa = Math.round((6.2 + r.next() * 3.3) * 100) / 100;
      const backlogs = i % 7 === 3 ? 1 : 0;
      return {
        studentId: s._id, semesterId: done._id, sgpa, cgpa: Math.round((sgpa - 0.2 + r.next() * 0.4) * 100) / 100, totalCreditsEarned: backlogs ? 19 : 22, totalCreditsRegistered: 22,
        backlogs, result: backlogs ? 'fail' : 'pass', promotionStatus: 'promoted', status: 'published', publishedAt: daysAgo(80),
      };
    }));
  } else skip('semester results', done ? 'no year ≥2 students' : 'no completed semester');
  end();

  // ── Welfare extras ────────────────────────────────────────────────────
  begin('welfare');
  const blocks = await HostelBlock.find({ collegeId: cid }).select({ _id: 1 }).limit(2).lean();
  const MENUS: Array<[string, string[][]]> = [
    ['monday', [['Idli', 'Sambar', 'Chutney'], ['Rice', 'Dal', 'Chicken Curry', 'Curd'], ['Tea', 'Samosa'], ['Chapati', 'Paneer Butter Masala', 'Rice', 'Rasam']]],
    ['tuesday', [['Upma', 'Vada', 'Chutney'], ['Rice', 'Sambar', 'Egg Curry', 'Pickle'], ['Tea', 'Mirchi Bajji'], ['Roti', 'Dal Makhani', 'Rice', 'Curd']]],
    ['wednesday', [['Dosa', 'Coconut Chutney'], ['Veg Biryani', 'Raita', 'Salad'], ['Coffee', 'Biscuits'], ['Chapati', 'Mixed Veg Curry', 'Rice', 'Dal']]],
  ];
  if (blocks.length) {
    await fill(MessMenu, 'mess menus', () => blocks.flatMap((b) => MENUS.map(([day, meals]) => ({
      blockId: b._id, day, meals: ['breakfast', 'lunch', 'snacks', 'dinner'].map((type, k) => ({ type, items: meals[k] })), effectiveFrom: daysAgo(60),
    }))));
  } else skip('mess menus', 'no hostel blocks');
  if (S.length) {
    await fill(MessFeedback, 'mess feedback', () => Array.from({ length: 6 }, (_, i) => ({
      studentId: st(i * 7)._id, date: daysAgo(i + 1), mealType: ['lunch', 'dinner', 'breakfast'][i % 3], rating: [4, 3, 5, 2, 4, 3][i],
      comments: ['Good taste, could improve quantity', 'Rice was slightly undercooked', 'Excellent dosa today!', 'Dinner served cold', 'Nice variety this week', 'Curry too spicy'][i],
    })));
  }
  const routes = await fill(TransportRoute, 'transport routes', () => [
    ['R01', 'Kukatpally — Campus', ['Kukatpally Bus Stand', 'KPHB Colony', 'Miyapur Metro'], 'TS09UB1234', 'Venkatesh'],
    ['R02', 'Dilsukhnagar — Campus', ['Dilsukhnagar Bus Stand', 'LB Nagar', 'Uppal Ring Road'], 'TS09UB5678', 'Ramulu'],
    ['R03', 'Secunderabad — Campus', ['Secunderabad Station', 'Begumpet', 'Ameerpet'], 'TS09UB9012', 'Nagaraju'],
  ].map(([routeNumber, name, stops, vehicleNumber, driverName], i) => ({
    routeNumber, name, vehicleNumber, driverName, driverPhone: `98765000${i + 1}`, capacity: 50, isActive: true,
    stops: [...(stops as string[]).map((s, k) => ({ name: s, pickupTime: `07:${String(15 + k * 15).padStart(2, '0')}`, dropTime: `17:${String(30 - k * 10).padStart(2, '0')}` })), { name: 'Juvion Campus', pickupTime: '08:30', dropTime: '16:30' }],
  })));
  if (routes.length && S.length) {
    await fill(TransportAllocation, 'transport allocations', () => Array.from({ length: 6 }, (_, i) => {
      const route = routes[i % routes.length]!;
      const stop = (route.stops?.[0]?.name as string | undefined) ?? 'Main Stop';
      const s = st(i * 11 + 2);
      return { studentId: s._id, routeId: route._id, stopName: stop, academicYearId: ctx.ayId, status: 'active', proposedAt: daysAgo(70), respondedAt: daysAgo(69), respondedBy: s._id, feeTriggered: true, allocationType: 'admin_proposed' };
    }));
    await fill(StudentGrievance, 'grievances', () => [
      ['mess', 'Poor quality of dinner', 'Dinner quality has dropped over the last two weeks; food served cold.', 'medium', 'in_progress'],
      ['transport', 'Bus frequently late', 'Route R02 is 20–30 minutes late almost daily.', 'high', 'open'],
      ['infrastructure', 'WiFi issues in hostel', 'WiFi on the 2nd floor of the boys hostel is very poor.', 'medium', 'resolved'],
      ['academic', 'Lab slots insufficient', 'Only one lab slot a week for the DBMS lab.', 'low', 'open'],
    ].map(([category, subject, description, priority, status], i) => ({
      studentId: st(i * 13 + 4)._id, category, subject, description, priority, status, assignedTo: fa(i).personId,
      ...(status === 'resolved' ? { resolution: 'Additional access point installed on the 2nd floor.', resolvedAt: daysAgo(3) } : {}),
    })));
    await fill(HealthRecord, 'health records', () => uniq(Array.from({ length: 6 }, (_, i) => ({
      personId: st(i * 9).personId, bloodGroup: ['O+', 'B+', 'A+', 'AB+', 'O-', 'B-'][i],
      allergies: i % 3 === 0 ? ['Dust'] : [], chronicConditions: i === 1 ? ['Mild Asthma'] : [], emergencyContact: 'Parent / Guardian', emergencyPhone: `98480${String(10000 + i)}`,
    })), 'personId'));
    await fill(MedicalVisit, 'medical visits', () => [
      ['Headache and fever', 'Viral fever', 'Paracetamol 500mg TDS for 3 days'],
      ['Sprain in right ankle', 'Grade 1 ankle sprain', 'Crepe bandage, rest for a week'],
      ['Breathing difficulty', 'Asthma episode', 'Salbutamol inhaler'],
      ['Stomach ache', 'Gastritis', 'Pantoprazole 40mg OD for 5 days'],
    ].map(([complaint, diagnosis, prescription], i) => ({ personId: st(i * 9).personId, visitDate: daysAgo(3 + i * 6), complaint, diagnosis, prescription, attendedBy: 'Dr. Suman — Campus Doctor' })));
    await fill(HostelVisitorLog, 'hostel visitor logs', () => [
      ['Rajesh', 'Father', 'Monthly visit'], ['Saraswati', 'Mother', 'Delivered clothes and food'], ['Sunil', 'Uncle', 'Medical follow-up'], ['Kavita', 'Mother', 'Parent-teacher meeting'],
    ].map(([visitorName, visitorRelation, purpose], i) => ({
      studentId: st(i * 3)._id, visitorName, visitorRelation, visitorPhone: `98765432${String(29 + i)}`, inTime: daysAgo(2 + i * 4, 10), outTime: daysAgo(2 + i * 4, 13), purpose,
    })));
  } else skip('student welfare rows', 'no students');
  end();

  // ── Campus ops, facilities, library ───────────────────────────────────
  begin('campus');
  const buildings = await fill(Building, 'buildings', () => [
    { name: 'Main Block', code: 'MB', floors: 4, totalRooms: 40, location: 'Central Campus', isActive: true },
    { name: 'Science Block', code: 'SB', floors: 3, totalRooms: 25, location: 'East Campus', isActive: true },
    { name: 'Admin Block', code: 'AB', floors: 2, totalRooms: 15, location: 'Front Gate', isActive: true },
  ]);
  const bld = (i: number) => buildings[i % Math.max(1, buildings.length)];
  const rooms = buildings.length
    ? await fill(Room, 'rooms', () => [
      ['MB-101', 0, 1, 'classroom', 60], ['MB-102', 0, 1, 'classroom', 60], ['MB-201', 0, 2, 'lab', 40], ['MB-301', 0, 3, 'seminar_hall', 150],
      ['SB-101', 1, 1, 'lab', 30], ['SB-102', 1, 1, 'lab', 30], ['SB-201', 1, 2, 'classroom', 60], ['AB-101', 2, 1, 'conference', 30],
    ].map(([roomNumber, b, floor, type, capacity]) => ({ buildingId: bld(b as number)!._id, roomNumber, floor, type, capacity, hasProjector: true, hasAC: type !== 'classroom', status: 'available' })))
    : (skip('rooms', 'no buildings'), []);
  const labRooms = rooms.filter((x) => x.type === 'lab');
  if (labRooms.length) {
    await fill(Lab, 'labs', () => [
      ['Computer Lab 1 — Programming Lab', 'CSE', [['Desktop Computer', 40, 38], ['Projector', 1, 1]], 40],
      ['Electronics Lab — DSP Lab', 'ECE', [['DSP Kit', 20, 18], ['Oscilloscope', 20, 20]], 30],
      ['Materials Testing Lab', 'CIVIL', [['Universal Testing Machine', 2, 2], ['Compression Tester', 3, 3]], 30],
    ].map(([name, d, eq, capacity], i) => ({
      roomId: labRooms[i % labRooms.length]!._id, name, departmentId: dept(d as string), labInChargeId: fa(i)._id,
      equipment: (eq as Array<[string, number, number]>).map(([n, quantity, workingCount]) => ({ name: n, quantity, workingCount })), capacity, isActive: true,
    })));
  } else skip('labs', 'no lab rooms');
  await fill(Asset, 'assets', () => [
    ['AST-001', 'HP ProDesk 400 Desktop', 'it_equipment', 'CSE', 'Computer Lab 1', 55000, 40000],
    ['AST-002', 'BenQ MH733 Projector', 'electronics', 'CSE', 'Seminar Hall MB-301', 95000, 70000],
    ['AST-003', 'Godrej Steel Almirah', 'furniture', 'ECE', 'ECE HOD Room', 15000, 12000],
    ['AST-004', 'Tektronix TBS1072C Oscilloscope', 'lab_equipment', 'ECE', 'Electronics Lab', 45000, 38000],
    ['AST-005', 'Conference Table — 12 Seater', 'furniture', 'CSE', 'Admin Block AB-101', 35000, 28000],
  ].map(([assetId, name, category, d, location, purchaseCost, currentValue]) => ({ assetId, name, category, departmentId: dept(d as string), location, purchaseDate: daysAgo(900), purchaseCost, currentValue, status: 'in_use' })));
  await fill(ITAsset, 'IT assets', () => [
    { serialNumber: 'IT-SRV-001', type: 'server', make: 'Dell', assetModel: 'PowerEdge R740', ipAddress: '10.0.1.10', location: 'Server Room — Admin Block', purchaseDate: daysAgo(1000), status: 'active' },
    { serialNumber: 'IT-SWT-001', type: 'switch', make: 'Cisco', assetModel: 'Catalyst 2960-X', ipAddress: '10.0.1.1', location: 'Main Block — Network Room', purchaseDate: daysAgo(800), status: 'active' },
    { serialNumber: 'IT-LAP-001', type: 'laptop', make: 'HP', assetModel: 'EliteBook 840 G8', location: 'CSE HOD Room', assignedTo: fa(0).personId, purchaseDate: daysAgo(500), status: 'active' },
    { serialNumber: 'IT-PRN-001', type: 'printer', make: 'HP', assetModel: 'LaserJet Pro M404dn', ipAddress: '192.168.1.200', location: 'Admin Block — Office', purchaseDate: daysAgo(400), status: 'active' },
  ]);
  await fill(Vehicle, 'vehicles', () => [
    { vehicleNumber: 'TS09UB1234', type: 'bus', make: 'Ashok Leyland', vehicleModel: 'Viking', capacity: 50, fuelType: 'diesel', driverId: ctx.staffId, insuranceExpiry: inDays(180), fitnessExpiry: inDays(270), status: 'active' },
    { vehicleNumber: 'TS09UB5678', type: 'bus', make: 'Tata', vehicleModel: 'Starbus', capacity: 50, fuelType: 'diesel', insuranceExpiry: inDays(230), fitnessExpiry: inDays(330), status: 'active' },
    { vehicleNumber: 'TS09UC1111', type: 'ambulance', make: 'Force', vehicleModel: 'Traveller', capacity: 8, fuelType: 'diesel', insuranceExpiry: inDays(90), fitnessExpiry: inDays(90), status: 'active' },
  ]);
  const vendors = await fill(Vendor, 'vendors', () => [
    { name: 'Hyderabad Office Supplies', contactPerson: 'Raman Goud', phone: '9876500010', email: 'sales@hydofficesupplies.com', address: 'Erragadda, Hyderabad', category: 'stationery', gstNumber: '36ABCDE1234F1Z5', isActive: true },
    { name: 'TechZone Solutions', contactPerson: 'Farhan Ali', phone: '9876500011', email: 'info@techzone.in', address: 'Ameerpet, Hyderabad', category: 'it_equipment', gstNumber: '36FGHIJ5678K2Y6', isActive: true },
    { name: 'Green Earth Caterers', contactPerson: 'Lakshmi Devi', phone: '9876500012', email: 'greenearth.catering@gmail.com', address: 'Kukatpally, Hyderabad', category: 'catering', isActive: true },
  ]);
  await fill(StockItem, 'stock items', () => [
    ['A4 Paper Ream', 'stationery', 'ream', 200, 50, 'Admin Store'], ['Whiteboard Marker', 'stationery', 'piece', 40, 100, 'Admin Store'],
    ['RJ45 Connector', 'networking', 'piece', 300, 50, 'IT Store'], ['Hand Sanitizer 500ml', 'hygiene', 'bottle', 100, 20, 'Health Centre'],
  ].map(([name, category, unit, currentStock, minStock, location]) => ({ name, category, unit, currentStock, minStock, location, lastRestockedDate: daysAgo(30) })));
  if (vendors.length) {
    await fill(PurchaseOrder, 'purchase orders', () => [
      { poNumber: 'PO-2026-101', vendorId: vendors[0]!._id, items: [{ description: 'A4 Paper Ream (500 sheets)', quantity: 100, unitPrice: 250, totalPrice: 25000 }, { description: 'Whiteboard Marker (Black)', quantity: 200, unitPrice: 30, totalPrice: 6000 }], totalAmount: 31000, requestedBy: ctx.staffPersonId, approvedBy: principal, orderDate: daysAgo(25), expectedDelivery: daysAgo(15), status: 'delivered' },
      { poNumber: 'PO-2026-102', vendorId: vendors[Math.min(1, vendors.length - 1)]!._id, items: [{ description: 'HP ProDesk 400 G9 Desktop', quantity: 5, unitPrice: 55000, totalPrice: 275000 }], totalAmount: 275000, requestedBy: fa(0).personId, approvedBy: principal, orderDate: daysAgo(10), expectedDelivery: inDays(8), status: 'ordered' },
      { poNumber: 'PO-2026-103', vendorId: vendors[vendors.length - 1]!._id, items: [{ description: 'Catering — Workshop (100 pax)', quantity: 1, unitPrice: 25000, totalPrice: 25000 }], totalAmount: 25000, requestedBy: fa(1).personId, orderDate: daysAgo(2), status: 'submitted' },
    ]);
  } else skip('purchase orders', 'no vendors');
  await fill(MaintenanceRequest, 'maintenance requests', () => [
    { requestedBy: fa(0).personId, category: 'electrical', location: 'CSE Lab — MB-201', description: 'Two tube lights not working in the lab', priority: 'medium', assignedTo: ctx.staffId, status: 'in_progress' },
    { requestedBy: S.length ? st(1).personId : fa(1).personId, category: 'plumbing', location: 'Girls Hostel — 2nd Floor Bathroom', description: 'Water leaking from shower pipe', priority: 'high', status: 'open' },
    { requestedBy: fa(2).personId, category: 'it', location: 'MECH HOD Room', description: 'Desktop not booting — blue screen', priority: 'medium', status: 'assigned' },
  ]);
  if (S.length) {
    await fill(GatePass, 'gate passes', () => [
      ['half_day', 'Medical appointment at Apollo Hospital', 'returned', 5], ['full_day', 'Family function', 'approved', -1], ['emergency', 'Family emergency — father hospitalised', 'active', 0],
    ].map(([type, reason, status, ago], i) => ({
      personId: st(i * 5).personId, personType: 'student', type, reason, outTime: daysAgo(ago as number, 10), expectedInTime: daysAgo(ago as number, 18),
      ...(status === 'returned' ? { actualInTime: daysAgo(ago as number, 14) } : {}), approvedBy: fa(i).personId, status,
    })));
  }
  await fill(VisitorEntry, 'visitor entries', () => [
    ['Anil Kumar', 'aadhaar', '123456789012', 'Guest lecture — AI', 'HOD CSE', 'CSE', 3], ['Sunitha Devi', 'driving_license', 'TS1234567890', 'Parent meeting', 'Class Advisor', 'CSE', 2],
    ['Rakesh Mehta (TCS)', 'pan', 'ABCDE1234F', 'Placement drive coordination', 'Placement Officer', 'Placement Cell', 1], ['Courier', 'other', 'COURIER-ID-456', 'Document delivery', 'Admin Office', 'Administration', 0],
  ].map(([visitorName, idType, idNumber, purpose, whomToMeet, department, ago], i) => ({
    visitorName, phone: `98765000${30 + i}`, idType, idNumber, purpose, whomToMeet, department, inTime: daysAgo(ago as number, 10), ...(ago ? { outTime: daysAgo(ago as number, 12) } : {}),
  })));
  await fill(SecurityIncident, 'security incidents', () => [
    { reportedBy: ctx.staffPersonId, incidentDate: daysAgo(12), location: 'Parking Area — Zone A', type: 'theft', description: 'Two-wheeler side mirror reported stolen from the parking lot', severity: 'low', actionTaken: 'CCTV footage reviewed, complaint filed', status: 'investigating' },
    { reportedBy: ctx.staffPersonId, incidentDate: daysAgo(40), location: 'Science Block — Ground Floor', type: 'vandalism', description: 'Broken monitor in SB-101', severity: 'medium', actionTaken: 'Students identified and warned', status: 'resolved' },
  ]);
  await fill(CCTV, 'CCTV', () => [
    ['CAM-MB-001', 'Main Block — Entrance', 0, 'outdoor'], ['CAM-MB-002', 'Main Block — Corridor 1st Floor', 0, 'indoor'],
    ['CAM-SB-001', 'Science Block — Lab Area', 1, 'dome'], ['CAM-PARK-001', 'Parking Lot — Zone A', -1, 'ptz'],
  ].map(([cameraId, location, b, type], i) => ({ cameraId, location, ...(b !== -1 && buildings.length ? { buildingId: bld(b as number)!._id } : {}), ipAddress: `192.168.1.${101 + i}`, type, status: 'active', installedDate: daysAgo(700) })));
  await fill(ParkingSlot, 'parking slots', () => [
    { zone: 'Zone-A', slotNumber: 'A-001', type: 'two_wheeler', status: 'occupied', allocatedTo: fa(0).personId },
    { zone: 'Zone-A', slotNumber: 'A-002', type: 'two_wheeler', status: 'available' },
    { zone: 'Zone-B', slotNumber: 'B-001', type: 'four_wheeler', status: 'reserved', allocatedTo: principal },
    { zone: 'Zone-B', slotNumber: 'B-002', type: 'four_wheeler', status: 'occupied', allocatedTo: fa(1).personId },
    { zone: 'Zone-C', slotNumber: 'C-001', type: 'visitor', status: 'available' },
  ]);
  const books = await fill(Book, 'books', () => [
    ['978-0132350884', 'Clean Code', 'Robert C. Martin', 'Pearson', 'textbook', 'CSE', 10], ['978-0073523323', 'Database System Concepts', 'Abraham Silberschatz', 'McGraw Hill', 'textbook', 'CSE', 15],
    ['978-0201633610', 'Design Patterns', 'Gamma, Helm, Johnson, Vlissides', 'Addison-Wesley', 'reference', 'CSE', 5], ['978-0070702097', 'Electronic Devices and Circuits', 'Salivahanan', 'McGraw Hill', 'textbook', 'ECE', 12],
    ['978-1292076928', 'Engineering Mechanics: Statics', 'R.C. Hibbeler', 'Pearson', 'textbook', 'MECH', 8], ['978-8121925099', 'Strength of Materials', 'R.K. Rajput', 'S. Chand', 'textbook', 'CIVIL', 10],
  ].map(([isbn, title, author, publisher, category, d, copies]) => ({ isbn, title, author, publisher, edition: '1st', year: 2019, category, departmentId: dept(d as string), totalCopies: copies, availableCopies: (copies as number) - 2, location: `Shelf-${String(d).slice(0, 1)}1` })));
  const people = [...S.slice(0, 4).map((s) => ({ personId: s.personId, type: 'student' })), ...F.slice(0, 2).map((f) => ({ personId: f.personId, type: 'faculty' }))];
  if (books.length && people.length) {
    await fill(BookIssue, 'book issues', () => people.slice(0, 4).map((p, i) => ({
      bookId: books[i % books.length]!._id, issuedTo: p.personId, issuedDate: daysAgo(25 - i * 4), dueDate: daysAgo(-(5 + i * 3)),
      ...(i === 3 ? { returnedDate: daysAgo(2), fineAmount: 0, status: 'returned' } : { status: 'issued' }),
    })));
  }
  if (people.length) {
    await fill(LibraryMember, 'library members', () => people.map((p, i) => ({
      personId: p.personId, memberType: p.type, membershipId: `LIB-${p.type === 'student' ? 'STU' : 'FAC'}-${String(i + 1).padStart(3, '0')}`,
      maxBooks: p.type === 'student' ? 4 : 10, currentIssued: i < 3 ? 1 : 0, finesDue: i === 1 ? 50 : 0, isActive: true,
    })));
  }
  await fill(EResource, 'e-resources', () => [
    { title: 'IEEE Xplore Digital Library', type: 'database', provider: 'IEEE', url: 'https://ieeexplore.ieee.org', accessType: 'subscribed', subscriptionStart: daysAgo(270), subscriptionEnd: inDays(95), isActive: true },
    { title: 'NPTEL — Programming in Python', type: 'nptel', provider: 'NPTEL / IIT Madras', url: 'https://nptel.ac.in/courses/106106182', accessType: 'open', isActive: true },
    { title: 'Springer Link — Engineering', type: 'e_journal', provider: 'Springer Nature', url: 'https://link.springer.com', accessType: 'subscribed', subscriptionStart: daysAgo(180), subscriptionEnd: inDays(185), isActive: true },
    { title: 'SWAYAM — Data Structures', type: 'mooc', provider: 'SWAYAM / MoE', url: 'https://swayam.gov.in', accessType: 'open', isActive: true },
  ]);
  const bookable = rooms.filter((x) => x.type === 'seminar_hall' || x.type === 'conference');
  if (bookable.length) {
    await fill(RoomBooking, 'room bookings', () => [
      { roomId: bookable[0]!._id, bookedBy: fa(0).personId, date: inDays(3), startTime: '10:00', endTime: '12:00', purpose: 'Guest Lecture on AI Ethics', status: 'approved' },
      { roomId: bookable[bookable.length - 1]!._id, bookedBy: principal, date: inDays(5), startTime: '14:00', endTime: '16:00', purpose: 'IQAC Review Meeting', status: 'approved' },
      { roomId: bookable[0]!._id, bookedBy: fa(1).personId, date: inDays(12), startTime: '09:00', endTime: '17:00', purpose: 'Workshop on VLSI Design', status: 'pending' },
    ]);
  } else skip('room bookings', 'no seminar/conference rooms');
  end();

  // ── Student development ───────────────────────────────────────────────
  begin('student-dev');
  if (S.length) {
    const clubs = await fill(Club, 'clubs', () => [
      ['CodeCraft — Coding Club', 'technical', 'Competitive programming and hackathons'], ['Raga — Music Club', 'cultural', 'Classical and contemporary music'],
      ['Spark — Entrepreneurship Cell', 'entrepreneurship', 'Startup incubation and awareness'], ['Sevak — Social Service Club', 'social_service', 'Community service and outreach'],
    ].map(([name, type, description], i) => ({ name, type, description, coordinatorId: st(i * 17)._id, facultyAdvisorId: fa(i)._id, isActive: true })));
    if (clubs.length) {
      await fill(ClubMembership, 'club memberships', () => uniq(Array.from({ length: 8 }, (_, i) => ({
        clubId: clubs[i % clubs.length]!._id, studentId: st(i * 17 + (i >= clubs.length ? 3 : 0))._id, role: i < clubs.length ? 'president' : 'member', joinedDate: daysAgo(120 - i * 5), status: 'active',
      })), 'clubId', 'studentId'));
    }
    const events = await fill(Event, 'events', () => [
      { name: 'CodeStorm 2026 — Hackathon', type: 'hackathon', ...(clubs[0] ? { clubId: clubs[0]._id } : {}), departmentId: dept('CSE'), description: '24-hour coding hackathon', startDate: daysAgo(18), endDate: daysAgo(17), venue: 'Main Block — Seminar Hall', budget: 50000, coordinatorId: st(0).personId, status: 'completed' },
      { name: 'Tarangini 2027 — Annual Fest', type: 'fest', description: 'Annual cultural fest', startDate: inDays(120), endDate: inDays(122), venue: 'Campus Grounds', budget: 500000, coordinatorId: principal, status: 'planned' },
      { name: 'Guest Lecture — AI in Healthcare', type: 'guest_lecture', departmentId: dept('CSE'), description: 'Talk by a researcher from IIT Hyderabad', startDate: daysAgo(6), endDate: daysAgo(6), venue: 'Seminar Hall MB-301', coordinatorId: fa(0).personId, status: 'completed' },
      { name: 'Workshop on IoT', type: 'workshop', departmentId: dept('ECE'), description: 'Hands-on IoT workshop with Arduino', startDate: inDays(9), endDate: inDays(10), venue: 'ECE Lab', budget: 20000, coordinatorId: fa(1).personId, status: 'planned' },
    ]);
    if (events.length) {
      await fill(EventRegistration, 'event registrations', () => Array.from({ length: 6 }, (_, i) => ({
        eventId: events[i % 2 === 0 ? 0 : Math.min(2, events.length - 1)]!._id, participantId: st(i * 4).personId, participantType: 'student', ...(i < 2 ? { teamName: `Team ${['Alpha', 'Beta'][i]}` } : {}), status: i === 0 ? 'winner' : 'attended',
      })));
    }
    await fill(Achievement, 'achievements', () => [
      ['Winner — Smart India Hackathon 2026', 'technical', 'national', 'First prize, software edition'], ['Classical Vocalist — Inter-University Fest', 'cultural', 'university', 'Second place in classical music'],
      ['Research Paper — IEEE Conference', 'academic', 'international', 'Paper on embedded ML'], ['State-level Kabaddi Champion', 'sports', 'state', 'Gold in the Telangana inter-college tournament'],
    ].map(([title, category, level, description], i) => ({ studentId: st(i * 19)._id, title, category, level, date: daysAgo(30 + i * 20), description })));
    await fill(SportsTeam, 'sports teams', () => [
      { sport: 'Cricket', category: 'men', coachId: fa(2).personId, captain: st(6)._id, academicYearId: ctx.ayId },
      { sport: 'Badminton', category: 'women', coachId: fa(3).personId, captain: st(5)._id, academicYearId: ctx.ayId },
    ]);
    await fill(NSSActivity, 'NSS activities', () => [
      { title: 'Blood Donation Camp', type: 'blood_donation', date: daysAgo(25), venue: 'Campus Auditorium', description: 'Blood donation drive with the Red Cross', coordinatorId: fa(3).personId, participantCount: 120, hours: 4, status: 'completed' },
      { title: 'Village Adoption — Shamirpet', type: 'community_service', date: daysAgo(10), venue: 'Shamirpet Village', description: 'Digital literacy programme for rural youth', coordinatorId: fa(1).personId, participantCount: 45, hours: 8, status: 'completed' },
    ]);
    await fill(Mentoring, 'mentoring notes', () => Array.from({ length: 4 }, (_, i) => ({
      mentorId: fa(i)._id, menteeId: st(i * 23)._id, academicYearId: ctx.ayId, meetingDate: daysAgo(5 + i * 6),
      notes: ['Discussed career plans; interested in MS abroad.', 'Academic review; doing well.', 'Guided on GATE preparation.', 'Discussed internship options.'][i], status: 'active',
    })));
    await fill(SkillCertification, 'certifications', () => [
      ['AWS Certified Cloud Practitioner', 'Amazon Web Services'], ['Python for Data Science — NPTEL', 'NPTEL / IIT Madras'],
      ['Google Data Analytics Certificate', 'Google / Coursera'], ['Embedded Systems Design — NPTEL', 'NPTEL / IIT Kharagpur'],
    ].map(([certificationName, provider], i) => ({ studentId: st(i * 29)._id, certificationName, provider, completedDate: daysAgo(40 + i * 15), credentialId: `CERT-2026-${1000 + i}` })));
    await fill(LeadershipRole, 'leadership roles', () => [
      ['President', 'club'], ['General Secretary', 'student_council'], ['Sports Captain', 'sports'],
    ].map(([role, body], i) => ({ studentId: st(i * 31)._id, role, body, academicYearId: ctx.ayId, startDate: daysAgo(80) })));
    await fill(StudentProject, 'student projects', () => [
      { title: 'AI-Based Attendance using Face Recognition', type: 'major_project', teamMembers: [finalYear(0)._id, finalYear(1)._id], guideId: fa(0)._id, semester: 7, description: 'Automated attendance using face recognition', technologies: ['Python', 'TensorFlow', 'OpenCV'], status: 'in_progress' },
      { title: 'IoT-Based Smart Irrigation', type: 'mini_project', teamMembers: [st(2)._id, st(3)._id], guideId: fa(1)._id, semester: 6, description: 'Irrigation using soil moisture sensors and ESP32', technologies: ['ESP32', 'MQTT', 'React'], status: 'completed', grade: 'A' },
      { title: 'Campus ERP Mobile App', type: 'industry_project', teamMembers: [finalYear(2)._id, finalYear(3)._id], guideId: fa(2)._id, semester: 7, description: 'Mobile access to campus services', technologies: ['Flutter', 'Node.js', 'MongoDB'], status: 'in_progress' },
    ]);
  } else skip('student development', 'no students');
  end();

  // ── Compliance ────────────────────────────────────────────────────────
  begin('compliance');
  const bodies = await fill(AccreditationBody, 'accreditation bodies', () => [
    { name: 'National Board of Accreditation', acronym: 'NBA', website: 'https://nbaind.org', type: 'nba' },
    { name: 'National Assessment and Accreditation Council', acronym: 'NAAC', website: 'https://naac.gov.in', type: 'naac' },
  ]);
  const naac = bodies.find((b) => b.type === 'naac') ?? bodies[0];
  const nba = bodies.find((b) => b.type === 'nba') ?? bodies[0];
  const cycles = bodies.length
    ? await fill(AccreditationCycle, 'accreditation cycles', () => [
      { bodyId: naac!._id, cycle: 2, applicationDate: daysAgo(1200), visitDate: daysAgo(1050), grade: 'A', validFrom: daysAgo(1000), validTo: inDays(820), status: 'accredited' },
      { bodyId: nba!._id, cycle: 1, applicationDate: daysAgo(60), status: 'applied' },
    ])
    : (skip('accreditation cycles', 'no bodies'), []);
  if (cycles.length) {
    const target = cycles.find((c) => c.status === 'applied') ?? cycles[0]!;
    await fill(ComplianceCriteria, 'criteria', () => [
      { criterionNumber: '1', title: 'Vision, Mission and Program Educational Objectives', maxScore: 100, selfScore: 75, evidence: [{ description: 'Vision/Mission approved by the Governing Body' }], status: 'in_progress' },
      { criterionNumber: '2', title: 'Program Curriculum and Teaching-Learning Processes', maxScore: 150, selfScore: 110, evidence: [{ description: 'Curriculum compliance matrix' }], status: 'in_progress' },
      { criterionNumber: '3', title: 'Course Outcomes and Program Outcomes', maxScore: 150, evidence: [{ description: 'CO-PO mapping document' }], status: 'not_started' },
    ].map((x) => ({ accreditationCycleId: target._id, ...x })));
  }
  await fill(RegulatoryFiling, 'regulatory filings', () => [
    { body: 'aicte', filingType: 'Extension of Approval (EoA)', dueDate: daysAgo(150), filedDate: daysAgo(170), referenceNumber: 'AICTE/EOA/2026-27/1234', status: 'filed' },
    { body: 'jntu', filingType: 'Affiliation Renewal Application', dueDate: inDays(45), status: 'in_progress' },
    { body: 'aicte', filingType: 'Mandatory Disclosure Update', dueDate: inDays(20), status: 'in_progress' },
  ]);
  end();

  // ── Governance ────────────────────────────────────────────────────────
  begin('governance');
  const committees = await fill(Committee, 'committees', () => [
    { name: 'Anti-Ragging Committee', type: 'anti_ragging', purpose: 'Prevention and action against ragging incidents', chairpersonId: principal, members: [{ personId: fa(1).personId, role: 'Member' }, { personId: fa(2).personId, role: 'Member' }], formedDate: daysAgo(80), isActive: true },
    { name: 'IQAC — Internal Quality Assurance Cell', type: 'iqac', purpose: 'Quality assurance and continuous improvement', chairpersonId: principal, members: [{ personId: fa(0).personId, role: 'Coordinator' }, { personId: fa(3).personId, role: 'Member' }], formedDate: daysAgo(80), isActive: true },
    { name: 'Grievance Redressal Committee', type: 'grievance', purpose: 'Address student and staff grievances', chairpersonId: fa(2).personId, members: [{ personId: ctx.staffPersonId, role: 'Student Welfare' }], formedDate: daysAgo(80), isActive: true },
  ]);
  if (committees.length) {
    await fill(CommitteeMeeting, 'committee meetings', () => [
      { committeeId: committees[Math.min(1, committees.length - 1)]!._id, meetingDate: daysAgo(14), agenda: 'AQAR preparation status and action items', minutes: 'Criterion-wise data collection assigned to departments.', attendees: [principal, fa(0).personId, fa(3).personId], decisions: ['Departments submit data by month-end', 'SSR draft review next meeting'], nextMeetingDate: inDays(16), status: 'completed' },
      { committeeId: committees[0]!._id, meetingDate: daysAgo(30), agenda: 'Anti-ragging measures for the new batch', attendees: [principal, fa(1).personId], decisions: ['Awareness session for first-years', 'Suggestion boxes in hostels'], status: 'completed' },
      { committeeId: committees[committees.length - 1]!._id, meetingDate: inDays(7), agenda: 'Monthly grievance review — pending cases', status: 'scheduled' },
    ]);
  }
  await fill(GoverningBodyMember, 'governing body', () => [
    { personId: principal, designation: 'Principal', role: 'secretary', appointedDate: daysAgo(2000), tenure: 5, isActive: true },
    { externalName: 'Sri K. Ramachandra Rao', designation: 'Industrialist', role: 'chairperson', appointedDate: daysAgo(2500), tenure: 5, isActive: true },
    { personId: fa(1).personId, designation: 'Professor', role: 'member', appointedDate: daysAgo(900), isActive: true },
    { externalName: 'Dr. S. Padmaja', designation: 'Former Vice-Chancellor, JNTUH', role: 'nominee', appointedDate: daysAgo(600), isActive: true },
  ]);
  await fill(GovernancePolicy, 'policies', () => [
    { title: 'Academic Integrity Policy', category: 'academic', description: 'Plagiarism, cheating and academic dishonesty', version: 2, effectiveDate: daysAgo(90), approvedBy: principal, status: 'active' },
    { title: 'Anti-Ragging Policy', category: 'student', description: 'Zero tolerance against ragging as per UGC regulations', version: 1, effectiveDate: daysAgo(90), approvedBy: principal, status: 'active' },
    { title: 'IT Usage Policy', category: 'it', description: 'Use of campus IT infrastructure, internet and email', version: 3, effectiveDate: daysAgo(270), approvedBy: principal, status: 'active' },
  ]);
  end();

  // ── Platform communication ────────────────────────────────────────────
  begin('platform');
  await fill(Announcement, 'announcements', () => [
    { title: 'Mid-1 Examination Schedule Released', content: 'The Mid-1 schedule for the odd semester of 2026-27 is on the exam portal.', category: 'exam', priority: 'high', postedBy: principal, targetAudience: 'students', isPinned: true },
    { title: 'Campus Placement Drive — TCS', content: 'TCS campus drive next week. Eligible final-year students must register by Friday.', category: 'placement', priority: 'normal', postedBy: fa(0).personId, targetAudience: 'students' },
    { title: 'FDP on Generative AI', content: '3-day FDP on generative AI in engineering education. Registration open for all faculty.', category: 'academic', priority: 'normal', postedBy: principal, targetAudience: 'faculty' },
  ]);
  await fill(Circular, 'circulars', () => [
    { circularNumber: 'CIR/2026/014', title: 'Attendance Policy Reminder', content: 'Minimum 75% attendance is mandatory for end-semester examinations. Below 65% will be detained.', issuedBy: principal, targetAudience: 'all', issuedDate: daysAgo(20) },
    { circularNumber: 'CIR/2026/015', title: 'ID Cards and Dress Code', content: 'All students must wear ID cards; formals on placement days.', issuedBy: principal, department: 'Administration', targetAudience: 'students', issuedDate: daysAgo(12) },
  ]);
  await fill(Notification, 'notifications', () => [
    { title: 'Library Book Return', message: 'Your library book is due. Please return it to avoid fines.', type: 'reminder', targetAudience: 'individual', targetIds: S.slice(0, 2).map((s) => s.personId), channel: 'app', sentAt: daysAgo(3), sentBy: ctx.staffPersonId, status: 'sent' },
    { title: 'Holiday — Dussehra', message: 'The college will remain closed for Dussehra. Classes resume the following Monday.', type: 'info', targetAudience: 'all', channel: 'push', sentAt: daysAgo(1), sentBy: principal, status: 'sent' },
    { title: 'TCS Pre-Placement Talk', message: 'TCS pre-placement talk this week. All registered students must attend.', type: 'announcement', targetAudience: 'students', channel: 'email', scheduledAt: inDays(2), sentBy: fa(0).personId, status: 'scheduled' },
  ]);
  end();
}

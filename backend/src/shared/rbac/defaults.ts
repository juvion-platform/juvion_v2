import { PolicyDoc } from './types';

/**
 * System default policies seeded into the database.
 * College admins can override these with college-specific policies.
 * Higher priority = evaluated first. College-specific > defaults.
 */
export const DEFAULT_POLICIES: Omit<PolicyDoc, '_id'>[] = [
  // ── super_admin (L-SADM): full access ──
  { role: 'super_admin', personaType: 'L-SADM', module: '*', action: '*', effect: 'allow', priority: 1000, isActive: true, description: 'Super admin: unrestricted access' },
  { role: 'super_admin', module: '*', action: '*', effect: 'allow', priority: 1000, isActive: true, description: 'Super admin: unrestricted access' },

  // ── admin (L-ADM): full access within their college ──
  { role: 'admin', personaType: 'L-ADM', module: '*', action: '*', effect: 'allow', priority: 950, isActive: true, description: 'College admin: full college access with full Aadhaar' },
  { role: 'admin', module: '*', action: '*', effect: 'allow', priority: 950, isActive: true, description: 'College admin: full college access' },

  // ── principal (L-PRIN): read everything + governance/compliance/platform write ──
  { role: 'principal', personaType: 'L-PRIN', module: '*', action: 'read', effect: 'allow', priority: 900, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar'] }, description: 'Principal: read all modules with full Aadhaar' },
  { role: 'principal', module: '*', action: 'read', effect: 'allow', priority: 900, isActive: true, description: 'Principal: read all modules' },
  { role: 'principal', personaType: 'L-PRIN', module: 'governance', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full governance access' },
  { role: 'principal', module: 'governance', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full governance access' },
  { role: 'principal', personaType: 'L-PRIN', module: 'compliance', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full compliance access' },
  { role: 'principal', module: 'compliance', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full compliance access' },
  { role: 'principal', personaType: 'L-PRIN', module: 'platform', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full platform access' },
  { role: 'principal', module: 'platform', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full platform access' },
  { role: 'principal', personaType: 'L-PRIN', module: 'finance', action: 'approve', effect: 'allow', priority: 900, isActive: true, description: 'Principal: approve finance actions' },
  { role: 'principal', module: 'finance', action: 'approve', effect: 'allow', priority: 900, isActive: true, description: 'Principal: approve finance actions' },

  // ── hod: department-scoped academics + read people/hr/student-dev ──
  { role: 'hod', module: 'academics', action: '*', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: full academics in own department' },
  { role: 'hod', module: 'people', action: 'read', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true, sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'HOD: read people in own department (masked Aadhaar)' },
  { role: 'hod', module: 'hr', action: 'read', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true, sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'HOD: read HR in own department (no compensation)' },
  { role: 'hod', module: 'student-dev', action: '*', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: student dev in own department' },
  { role: 'hod', module: 'placement', action: 'read', effect: 'allow', priority: 800, isActive: true, description: 'HOD: read placement data' },
  { role: 'hod', module: 'governance', action: 'read', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: read governance reports for own department' },

  // ── faculty: attendance, marks, lesson plans + read academics/people ──
  { role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true, description: 'Faculty: read academics' },
  { role: 'faculty', module: 'academics', action: 'create', effect: 'allow', priority: 700, isActive: true, scope: { subDomain: 'attendance,marks,lesson-plans,feedback' }, description: 'Faculty: create attendance/marks/lesson-plans' },
  { role: 'faculty', module: 'academics', action: 'update', effect: 'allow', priority: 700, isActive: true, scope: { subDomain: 'attendance,marks,lesson-plans,feedback' }, description: 'Faculty: update attendance/marks/lesson-plans' },
  { role: 'faculty', module: 'people', action: 'read', effect: 'allow', priority: 700, isActive: true, scope: { assignedVia: ['mentees', 'sections'], sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Faculty: read mentees and section students (masked Aadhaar)' },
  { role: 'faculty', module: 'student-dev', action: 'read', effect: 'allow', priority: 700, isActive: true, description: 'Faculty: read student dev' },
  { role: 'faculty', module: 'governance', action: 'read', effect: 'allow', priority: 700, isActive: true, scope: { departmentOnly: true }, description: 'Faculty: read governance reports for own department' },

  // ── staff with personaType scoping ──

  // Admissions Head / Staff (ST-ADM) — full admissions + people with full Aadhaar
  { role: 'staff', personaType: 'ST-ADM', module: 'admissions', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Admissions staff: full admissions access' },
  { role: 'staff', personaType: 'ST-ADM', module: 'people', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar'] }, description: 'Admissions staff: full people access with full Aadhaar' },

  // Accounts Staff (ST-ACC) — full finance + people read (masked Aadhaar)
  { role: 'staff', personaType: 'ST-ACC', module: 'finance', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Accounts staff: full finance access' },
  { role: 'staff', personaType: 'ST-ACC', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Accounts staff: read people for student fee accounts (masked Aadhaar)' },

  // HR Staff (ST-HR) — full HR + read people with full Aadhaar/comp + employee management
  { role: 'staff', personaType: 'ST-HR', module: 'hr', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'HR staff: full HR access' },
  { role: 'staff', personaType: 'ST-HR', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar', 'hr.compensation'] }, description: 'HR staff: read people with full Aadhaar and compensation' },
  { role: 'staff', personaType: 'ST-HR', module: 'people', action: 'create', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'staff,faculty' }, description: 'HR staff: create staff/faculty employee records' },
  { role: 'staff', personaType: 'ST-HR', module: 'people', action: 'update', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'staff,faculty' }, description: 'HR staff: update staff/faculty employee records' },

  // Registrar (ST-REG) — full people records with full Aadhaar + academics read
  { role: 'staff', personaType: 'ST-REG', module: 'people', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar'] }, description: 'Registrar: full people access with full Aadhaar' },
  { role: 'staff', personaType: 'ST-REG', module: 'academics', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Registrar: read academics' },

  // Warden (ST-WARDEN) — hostel/mess welfare + hostel campus ops + people read (masked Aadhaar)
  { role: 'staff', personaType: 'ST-WARDEN', module: 'welfare', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'hostel,mess' }, description: 'Warden: hostel and mess welfare' },
  { role: 'staff', personaType: 'ST-WARDEN', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'hostel' }, description: 'Warden: hostel sub-domain of campus ops' },
  { role: 'staff', personaType: 'ST-WARDEN', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Warden: read students for hostel (masked Aadhaar)' },

  // Transport Officer (ST-TRANSPORT-OFFICER)
  { role: 'staff', personaType: 'ST-TRANSPORT-OFFICER', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'transport' }, description: 'Transport Officer: transport allocations and routes' },
  { role: 'staff', personaType: 'ST-TRANSPORT-OFFICER', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Transport Officer: read students for transport (masked Aadhaar)' },

  // Placement Officer (ST-TPO)
  { role: 'staff', personaType: 'ST-TPO', module: 'placement', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'TPO: full placement access' },
  { role: 'staff', personaType: 'ST-TPO', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'TPO: read students for placement (masked Aadhaar)' },
  { role: 'staff', personaType: 'ST-TPO', module: 'academics', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'TPO: read academics for placement eligibility' },

  // Exam Controller (ST-EXAM)
  { role: 'staff', personaType: 'ST-EXAM', module: 'academics', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'exams,results' }, description: 'Exam controller: exams and results' },
  { role: 'staff', personaType: 'ST-EXAM', module: 'academics', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Exam controller: read academics' },
  { role: 'staff', personaType: 'ST-EXAM', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Exam controller: read students for exams (masked Aadhaar)' },

  // Librarian (ST-LIB)
  { role: 'staff', personaType: 'ST-LIB', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'library' }, description: 'Librarian: library sub-domain' },
  { role: 'staff', personaType: 'ST-LIB', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Librarian: read students for library (masked Aadhaar)' },

  // Security Staff (ST-SEC)
  { role: 'staff', personaType: 'ST-SEC', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'security,gate-pass,visitors' }, description: 'Security: security sub-domain' },
  { role: 'staff', personaType: 'ST-SEC', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Security: read people for visitor passes (masked Aadhaar)' },

  // IQAC Coordinator (ST-IQAC)
  { role: 'staff', personaType: 'ST-IQAC', module: 'compliance', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'IQAC coordinator: full compliance' },
  { role: 'staff', personaType: 'ST-IQAC', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'IQAC coordinator: read people for compliance evidence (masked Aadhaar)' },
  { role: 'staff', personaType: 'ST-IQAC', module: 'academics', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'IQAC coordinator: read academics for accreditation' },

  // ── Base staff fallback & isolation ──
  // Base staff fallback: people directory lookup only (no sensitive identity or Aadhaar)
  { role: 'staff', module: 'people', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { sensitivity: [] }, description: 'Staff base: directory lookup only' },
  // Explicit deny on platform management for staff
  { role: 'staff', module: 'platform', action: '*', effect: 'deny', priority: 800, isActive: true, description: 'Staff: no platform administration' },
  // Explicit deny on governance reads for staff (matches 004-rbac-nl-queries §10.9)
  { role: 'staff', module: 'governance', action: 'read', effect: 'deny', priority: 700, isActive: true, description: 'Staff base: deny governance reads' },

  // ── student: self-scoped read + limited create ──
  { role: 'student', module: 'academics', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true }, description: 'Student: read own academics' },
  { role: 'student', module: 'finance', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true }, description: 'Student: read own finance' },
  { role: 'student', module: 'welfare', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true }, description: 'Student: read own welfare' },
  { role: 'student', module: 'welfare', action: 'create', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true, subDomain: 'grievance' }, description: 'Student: file grievances' },
  { role: 'student', module: 'campus', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true }, description: 'Student: read own campus services (hostel, transport, library, etc.)' },
  { role: 'student', module: 'campus', action: 'update', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true, subDomain: 'hostel-allocation,transport-allocation' }, description: 'Student: accept/decline/vacate own hostel and transport allocations' },
  { role: 'student', module: 'placement', action: 'read', effect: 'allow', priority: 600, isActive: true, description: 'Student: read placement listings' },
  { role: 'student', module: 'placement', action: 'create', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true, subDomain: 'registration' }, description: 'Student: register for placements' },
  { role: 'student', module: 'student-dev', action: 'read', effect: 'allow', priority: 600, isActive: true, description: 'Student: read student dev' },
  { role: 'student', module: 'student-dev', action: 'create', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true, subDomain: 'registration,membership' }, description: 'Student: join clubs/events' },
  { role: 'student', personaType: 'L-STU', module: 'people', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true, sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Student: read own profile (masked Aadhaar)' },
  { role: 'student', module: 'people', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true, sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Student: read own profile (masked Aadhaar)' },

  // ── parent: read children's records ──
  { role: 'parent', personaType: 'L-PAR', module: 'academics', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children academics' },
  { role: 'parent', module: 'academics', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children academics' },
  { role: 'parent', personaType: 'L-PAR', module: 'finance', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children finance' },
  { role: 'parent', module: 'finance', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children finance' },
  { role: 'parent', personaType: 'L-PAR', module: 'welfare', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children welfare' },
  { role: 'parent', module: 'welfare', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children welfare' },
  { role: 'parent', personaType: 'L-PAR', module: 'people', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true, sensitivity: ['people.identity'] }, description: 'Parent: read own + children profiles (no Aadhaar access)' },
  { role: 'parent', module: 'people', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true, sensitivity: ['people.identity'] }, description: 'Parent: read own + children profiles (no Aadhaar access)' },

  // ─── Strategic Gap 7 — L3 sub-persona policies ─────────────────

  // Tele-Counsellor (ST-ADM-TC) — write inquiries only; cannot convert to applicant.
  { role: 'staff', personaType: 'ST-ADM-TC', module: 'admissions', action: 'read', effect: 'allow', priority: 770, isActive: true, description: 'Tele-Counsellor: read admissions' },
  { role: 'staff', personaType: 'ST-ADM-TC', module: 'admissions', action: 'create', effect: 'allow', priority: 770, isActive: true, scope: { subDomain: 'inquiries,lead-interactions' }, description: 'Tele-Counsellor: create inquiries + log interactions' },
  { role: 'staff', personaType: 'ST-ADM-TC', module: 'admissions', action: 'update', effect: 'allow', priority: 770, isActive: true, scope: { subDomain: 'inquiries,lead-interactions' }, description: 'Tele-Counsellor: update inquiries + log interactions' },
  { role: 'staff', personaType: 'ST-ADM-TC', module: 'people', action: 'read', effect: 'allow', priority: 770, isActive: true, scope: { sensitivity: ['people.identity'] }, description: 'Tele-Counsellor: read basic people (no Aadhaar)' },
  { role: 'staff', personaType: 'ST-ADM-TC', module: 'admissions', action: 'delete', effect: 'deny', priority: 780, isActive: true, description: 'Tele-Counsellor: cannot delete admissions records' },
  { role: 'staff', personaType: 'ST-ADM-TC', module: 'admissions', action: 'approve', effect: 'deny', priority: 780, isActive: true, description: 'Tele-Counsellor: cannot approve/convert' },

  // Admissions Counsellor (ST-ADM-AC) — full inquiry + applicant + documents with full Aadhaar.
  { role: 'staff', personaType: 'ST-ADM-AC', module: 'admissions', action: '*', effect: 'allow', priority: 770, isActive: true, scope: { subDomain: 'inquiries,lead-interactions,applicants,documents' }, description: 'Admissions Counsellor: full inquiry + applicant + documents' },
  { role: 'staff', personaType: 'ST-ADM-AC', module: 'admissions', action: 'read', effect: 'allow', priority: 770, isActive: true, description: 'Admissions Counsellor: read all admissions sub-domains' },
  { role: 'staff', personaType: 'ST-ADM-AC', module: 'people', action: 'read', effect: 'allow', priority: 770, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar'] }, description: 'Admissions Counsellor: read people with full Aadhaar' },

  // Admissions Officer (ST-ADM-AO) — assigned/cluster applicants with full Aadhaar.
  { role: 'staff', personaType: 'ST-ADM-AO', module: 'admissions', action: '*', effect: 'allow', priority: 770, isActive: true, description: 'Admissions Officer: admissions operations' },
  { role: 'staff', personaType: 'ST-ADM-AO', module: 'people', action: 'read', effect: 'allow', priority: 770, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar'] }, description: 'Admissions Officer: read people with full Aadhaar' },

  // Admissions Officer Cluster Head (ST-ADM-AO-CH) — broader cluster visibility with full Aadhaar.
  { role: 'staff', personaType: 'ST-ADM-AO-CH', module: 'admissions', action: 'read', effect: 'allow', priority: 770, isActive: true, description: 'Cluster Head: read across cluster' },
  { role: 'staff', personaType: 'ST-ADM-AO-CH', module: 'admissions', action: 'update', effect: 'allow', priority: 770, isActive: true, description: 'Cluster Head: update admissions across cluster' },
  { role: 'staff', personaType: 'ST-ADM-AO-CH', module: 'people', action: 'read', effect: 'allow', priority: 770, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar'] }, description: 'Cluster Head: read people with full Aadhaar' },

  // Admissions Director (ST-ADM-DIR) — full admissions + rules + full Aadhaar.
  { role: 'staff', personaType: 'ST-ADM-DIR', module: 'admissions', action: '*', effect: 'allow', priority: 780, isActive: true, description: 'Admissions Director: full admissions including CRM + rules' },
  { role: 'staff', personaType: 'ST-ADM-DIR', module: 'platform', action: 'read', effect: 'allow', priority: 780, isActive: true, scope: { subDomain: 'communication' }, description: 'Admissions Director: read communication logs' },
  { role: 'staff', personaType: 'ST-ADM-DIR', module: 'people', action: 'read', effect: 'allow', priority: 780, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar'] }, description: 'Admissions Director: read people with full Aadhaar' },

  // Academic-ops: Course Coordinator (ST-ACOPS-CC)
  { role: 'staff', personaType: 'ST-ACOPS-CC', module: 'academics', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Course Coordinator: read academics' },
  { role: 'staff', personaType: 'ST-ACOPS-CC', module: 'academics', action: 'create', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'course-offerings,lesson-plans,internal-assessments' }, description: 'Course Coordinator: course-offering CUD' },
  { role: 'staff', personaType: 'ST-ACOPS-CC', module: 'academics', action: 'update', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'course-offerings,lesson-plans,internal-assessments' }, description: 'Course Coordinator: course-offering CUD' },
  { role: 'staff', personaType: 'ST-ACOPS-CC', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Course Coordinator: read people (masked Aadhaar)' },

  // Academic-ops: Classroom Coordinator (ST-ACOPS-CR)
  { role: 'staff', personaType: 'ST-ACOPS-CR', module: 'academics', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Classroom Coordinator: read academics' },
  { role: 'staff', personaType: 'ST-ACOPS-CR', module: 'student-dev', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Classroom Coordinator: read student-dev' },
  { role: 'staff', personaType: 'ST-ACOPS-CR', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { departmentOnly: true, sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Classroom Coordinator: read people in section dept (masked Aadhaar)' },

  // Academic-ops: Academic Coordinator (ST-ACOPS-AC)
  { role: 'staff', personaType: 'ST-ACOPS-AC', module: 'academics', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Academic Coordinator: full academics' },
  { role: 'staff', personaType: 'ST-ACOPS-AC', module: 'compliance', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'obe,naac' }, description: 'Academic Coordinator: read OBE + NAAC evidence' },
  { role: 'staff', personaType: 'ST-ACOPS-AC', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Academic Coordinator: read people (masked Aadhaar)' },

  // Academic-ops: Academic Operations Lead (ST-ACOPS)
  { role: 'staff', personaType: 'ST-ACOPS', module: 'academics', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Academic Operations Lead: full academics operations' },
  { role: 'staff', personaType: 'ST-ACOPS', module: 'compliance', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Academic Operations Lead: read compliance' },
  { role: 'staff', personaType: 'ST-ACOPS', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Academic Operations Lead: read people (masked Aadhaar)' },

  // Research Coordinator (ST-RES-COORD)
  { role: 'staff', personaType: 'ST-RES-COORD', module: 'compliance', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'research,publications,faculty-documents' }, description: 'Research Coordinator: research + publication evidence' },
  { role: 'staff', personaType: 'ST-RES-COORD', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { sensitivity: ['people.identity', 'people.aadhaar:masked'] }, description: 'Research Coordinator: read people for evidence cross-ref (masked Aadhaar)' },
];


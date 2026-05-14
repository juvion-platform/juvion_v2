import { PolicyDoc } from './types';

/**
 * System default policies seeded into the database.
 * College admins can override these with college-specific policies.
 * Higher priority = evaluated first. College-specific > defaults.
 */
export const DEFAULT_POLICIES: Omit<PolicyDoc, '_id'>[] = [
  // ── super_admin: full access ──
  { role: 'super_admin', module: '*', action: '*', effect: 'allow', priority: 1000, isActive: true, description: 'Super admin: unrestricted access' },

  // ── admin: full access within their college ──
  { role: 'admin', module: '*', action: '*', effect: 'allow', priority: 950, isActive: true, description: 'College admin: full college access' },

  // ── principal: read everything + governance/compliance/platform write ──
  { role: 'principal', module: '*', action: 'read', effect: 'allow', priority: 900, isActive: true, description: 'Principal: read all modules' },
  { role: 'principal', module: 'governance', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full governance access' },
  { role: 'principal', module: 'compliance', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full compliance access' },
  { role: 'principal', module: 'platform', action: '*', effect: 'allow', priority: 900, isActive: true, description: 'Principal: full platform access' },
  { role: 'principal', module: 'finance', action: 'approve', effect: 'allow', priority: 900, isActive: true, description: 'Principal: approve finance actions' },

  // ── hod: department-scoped academics + read people/hr/student-dev ──
  { role: 'hod', module: 'academics', action: '*', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: full academics in own department' },
  { role: 'hod', module: 'people', action: 'read', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: read people in own department' },
  { role: 'hod', module: 'hr', action: 'read', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: read HR in own department' },
  { role: 'hod', module: 'student-dev', action: 'read', effect: 'allow', priority: 800, isActive: true, scope: { departmentOnly: true }, description: 'HOD: read student dev in own department' },
  { role: 'hod', module: 'placement', action: 'read', effect: 'allow', priority: 800, isActive: true, description: 'HOD: read placement data' },

  // ── faculty: attendance, marks, lesson plans + read academics/people ──
  { role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true, description: 'Faculty: read academics' },
  { role: 'faculty', module: 'academics', action: 'create', effect: 'allow', priority: 700, isActive: true, scope: { subDomain: 'attendance,marks,lesson-plans,feedback' }, description: 'Faculty: create attendance/marks/lesson-plans' },
  { role: 'faculty', module: 'academics', action: 'update', effect: 'allow', priority: 700, isActive: true, scope: { subDomain: 'attendance,marks,lesson-plans,feedback' }, description: 'Faculty: update attendance/marks/lesson-plans' },
  { role: 'faculty', module: 'people', action: 'read', effect: 'allow', priority: 700, isActive: true, scope: { departmentOnly: true }, description: 'Faculty: read people in own department' },
  { role: 'faculty', module: 'student-dev', action: 'read', effect: 'allow', priority: 700, isActive: true, description: 'Faculty: read student dev' },

  // ── staff with personaType scoping ──
  { role: 'staff', personaType: 'ST-ADM', module: 'admissions', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Admissions staff: full admissions access' },
  { role: 'staff', personaType: 'ST-ADM', module: 'people', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Admissions staff: full people access' },
  { role: 'staff', personaType: 'ST-ACC', module: 'finance', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Accounts staff: full finance access' },
  { role: 'staff', personaType: 'ST-HR', module: 'hr', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'HR staff: full HR access' },
  { role: 'staff', personaType: 'ST-HR', module: 'people', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'HR staff: full people access' },
  { role: 'staff', personaType: 'ST-WARDEN', module: 'welfare', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'hostel,mess' }, description: 'Warden: hostel and mess welfare' },
  { role: 'staff', personaType: 'ST-WARDEN', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'hostel' }, description: 'Warden: hostel sub-domain of campus ops (allocation lifecycle)' },
  { role: 'staff', personaType: 'ST-TRANSPORT-OFFICER', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'transport' }, description: 'Transport Officer: transport allocations and routes' },
  { role: 'staff', personaType: 'ST-TPO', module: 'placement', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'TPO: full placement access' },
  { role: 'staff', personaType: 'ST-EXAM', module: 'academics', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'exams,results' }, description: 'Exam controller: exams and results' },
  { role: 'staff', personaType: 'ST-LIB', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'library' }, description: 'Librarian: library sub-domain' },
  { role: 'staff', personaType: 'ST-SEC', module: 'campus', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'security,gate-pass,visitors' }, description: 'Security: security sub-domain' },
  { role: 'staff', personaType: 'ST-IQAC', module: 'compliance', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'IQAC coordinator: full compliance' },
  { role: 'staff', personaType: 'ST-REG', module: 'people', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Registrar: full people access' },
  { role: 'staff', personaType: 'ST-REG', module: 'academics', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Registrar: read academics' },
  // Base staff fallback: read-only
  { role: 'staff', module: '*', action: 'read', effect: 'allow', priority: 600, isActive: true, description: 'Staff base: read-only fallback' },

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
  { role: 'student', module: 'people', action: 'read', effect: 'allow', priority: 600, isActive: true, scope: { selfOnly: true }, description: 'Student: read own profile' },

  // ── parent: read children's records ──
  { role: 'parent', module: 'academics', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children academics' },
  { role: 'parent', module: 'finance', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children finance' },
  { role: 'parent', module: 'welfare', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read linked children welfare' },
  { role: 'parent', module: 'people', action: 'read', effect: 'allow', priority: 500, isActive: true, scope: { selfOnly: true }, description: 'Parent: read own + children profiles' },

  // ─── Strategic Gap 7 — L3 sub-persona policies ─────────────────
  //
  // The L1/L2 wildcard `ST-ADM` already covers every L3 sub-persona
  // for module-level access (engine matches `ST-ADM-TC` via the
  // `startsWith('ST-ADM')` prefix). These rows narrow the wildcard
  // for sub-personas that should have LESS than the parent, plus add
  // the new ST-ACOPS-* and ST-RES-COORD families.

  // Tele-Counsellor — write inquiries only; cannot convert to applicant.
  // Higher priority than the broad ST-ADM policy so this allow-list wins.
  { role: 'staff', personaType: 'ST-ADM-TC', module: 'admissions', action: 'read', effect: 'allow', priority: 770, isActive: true, description: 'Tele-Counsellor: read admissions' },
  { role: 'staff', personaType: 'ST-ADM-TC', module: 'admissions', action: 'create', effect: 'allow', priority: 770, isActive: true, scope: { subDomain: 'inquiries,lead-interactions' }, description: 'Tele-Counsellor: create inquiries + log interactions' },
  { role: 'staff', personaType: 'ST-ADM-TC', module: 'admissions', action: 'update', effect: 'allow', priority: 770, isActive: true, scope: { subDomain: 'inquiries,lead-interactions' }, description: 'Tele-Counsellor: update inquiries + log interactions' },
  { role: 'staff', personaType: 'ST-ADM-TC', module: 'people', action: 'read', effect: 'allow', priority: 770, isActive: true, description: 'Tele-Counsellor: read people' },

  // Admissions Counsellor — full inquiry + applicant + documents.
  { role: 'staff', personaType: 'ST-ADM-AC', module: 'admissions', action: '*', effect: 'allow', priority: 770, isActive: true, scope: { subDomain: 'inquiries,lead-interactions,applicants,documents' }, description: 'Admissions Counsellor: full inquiry + applicant + documents' },
  { role: 'staff', personaType: 'ST-ADM-AC', module: 'admissions', action: 'read', effect: 'allow', priority: 770, isActive: true, description: 'Admissions Counsellor: read all admissions sub-domains' },

  // Admissions Officer with cluster-head variant — broader visibility.
  { role: 'staff', personaType: 'ST-ADM-AO-CH', module: 'admissions', action: 'read', effect: 'allow', priority: 770, isActive: true, description: 'Cluster Head: read across cluster' },

  // Admissions Director — broad: full admissions + assignment-rule admin.
  { role: 'staff', personaType: 'ST-ADM-DIR', module: 'admissions', action: '*', effect: 'allow', priority: 780, isActive: true, description: 'Admissions Director: full admissions including CRM + rules' },
  { role: 'staff', personaType: 'ST-ADM-DIR', module: 'platform', action: 'read', effect: 'allow', priority: 780, isActive: true, scope: { subDomain: 'communication' }, description: 'Admissions Director: read communication logs' },

  // Academic-ops sub-personas (new family ST-ACOPS-*).
  { role: 'staff', personaType: 'ST-ACOPS-CC', module: 'academics', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Course Coordinator: read academics' },
  { role: 'staff', personaType: 'ST-ACOPS-CC', module: 'academics', action: 'create', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'course-offerings,lesson-plans,internal-assessments' }, description: 'Course Coordinator: course-offering CUD' },
  { role: 'staff', personaType: 'ST-ACOPS-CC', module: 'academics', action: 'update', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'course-offerings,lesson-plans,internal-assessments' }, description: 'Course Coordinator: course-offering CUD' },

  { role: 'staff', personaType: 'ST-ACOPS-CR', module: 'academics', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Classroom Coordinator: read academics' },
  { role: 'staff', personaType: 'ST-ACOPS-CR', module: 'student-dev', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Classroom Coordinator: read student-dev' },
  { role: 'staff', personaType: 'ST-ACOPS-CR', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { departmentOnly: true }, description: 'Classroom Coordinator: read people in section dept' },

  { role: 'staff', personaType: 'ST-ACOPS-AC', module: 'academics', action: '*', effect: 'allow', priority: 750, isActive: true, description: 'Academic Coordinator: full academics' },
  { role: 'staff', personaType: 'ST-ACOPS-AC', module: 'compliance', action: 'read', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'obe,naac' }, description: 'Academic Coordinator: read OBE + NAAC evidence' },

  // Research Coordinator — research + publications + faculty-doc verification.
  { role: 'staff', personaType: 'ST-RES-COORD', module: 'compliance', action: '*', effect: 'allow', priority: 750, isActive: true, scope: { subDomain: 'research,publications,faculty-documents' }, description: 'Research Coordinator: research + publication evidence + faculty document verification' },
  { role: 'staff', personaType: 'ST-RES-COORD', module: 'people', action: 'read', effect: 'allow', priority: 750, isActive: true, description: 'Research Coordinator: read people for evidence cross-ref' },
];

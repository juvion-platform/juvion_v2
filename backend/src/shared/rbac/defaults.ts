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
];

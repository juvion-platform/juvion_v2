/**
 * Canonical persona catalog — Strategic Gap 7.
 *
 * Single source of truth for every persona/sub-persona code in the
 * system. Codes are colon-free dash-separated; the RBAC engine matches
 * with a `prefix-*` wildcard so `ST-ADM-*` covers every admissions
 * sub-persona without listing each one in policies.
 *
 * Three tiers:
 *   L1  Family root          (e.g. ST-ADM, F-HOD, L-PRIN)
 *   L2  Existing operational (e.g. ST-WARDEN, ST-TPO, ST-EXAM)
 *   L3  Sub-personas added by Gap 7 (e.g. ST-ADM-TC, ST-ACOPS-CC)
 *
 * The doc's recommendation was "fewer workspaces that route work via
 * push, with role-aware filters within each workspace" — we don't ship
 * 22 workspaces, we ship persona-aware filtering inside the existing
 * surfaces.
 */

export type PersonaCode = string;

export interface PersonaDescriptor {
  code: PersonaCode;
  /** The L1/L2 family root (the wildcard prefix). */
  family: PersonaCode;
  label: string;
  description: string;
  /** Which Juvion module this persona spends most of their time in. */
  primaryModule:
    | 'admissions'
    | 'academics'
    | 'finance'
    | 'people'
    | 'hr'
    | 'campus'
    | 'welfare'
    | 'placement'
    | 'student-dev'
    | 'compliance'
    | 'governance'
    | 'platform';
  /** Default `User.role` for this persona. */
  defaultRole: 'super_admin' | 'admin' | 'principal' | 'hod' | 'faculty' | 'staff' | 'student' | 'parent';
  /** Tier — L1 = root family, L2 = existing operational, L3 = sub-persona added by Gap 7. */
  tier: 1 | 2 | 3;
  /** L1 / L2 parent — what this persona inherits permissions from when no
   *  L3-specific policy is present. Empty for L1. */
  parentCode?: PersonaCode;
  /** Permissions hint shown in admin UI. Not enforced — RBAC engine
   *  is the source of truth at evaluation time. */
  permissionsHint?: string;
}

// ─── L1 / L2 personas (already in DEFAULT_POLICIES) ─────────────────

export const L1_L2_PERSONAS: PersonaDescriptor[] = [
  // Leadership L1
  { code: 'L-SADM', family: 'L-SADM', label: 'Super Admin', description: 'Cross-college platform admin.', primaryModule: 'platform', defaultRole: 'super_admin', tier: 1 },
  { code: 'L-ADM',  family: 'L-ADM',  label: 'College Admin', description: 'Full college-scoped admin.', primaryModule: 'platform', defaultRole: 'admin', tier: 1 },
  { code: 'L-PRIN', family: 'L-PRIN', label: 'Principal', description: 'Institution leadership, read-all + governance/compliance/platform write.', primaryModule: 'governance', defaultRole: 'principal', tier: 1 },
  { code: 'L-FAC',  family: 'L-FAC',  label: 'Faculty (L1)', description: 'Top-level faculty designator.', primaryModule: 'academics', defaultRole: 'faculty', tier: 1 },
  { code: 'L-STU',  family: 'L-STU',  label: 'Student', description: 'Student-portal user.', primaryModule: 'student-dev', defaultRole: 'student', tier: 1 },

  // Faculty L1/L2
  { code: 'F-HOD',  family: 'F-HOD',  label: 'Head of Department', description: 'Department-scoped academic head.', primaryModule: 'academics', defaultRole: 'hod', tier: 1, permissionsHint: 'Department-scoped academics + people read.' },
  { code: 'F-FAC',  family: 'F-FAC',  label: 'Faculty', description: 'Teaching faculty.', primaryModule: 'academics', defaultRole: 'faculty', tier: 1, permissionsHint: 'Attendance, marks, lesson plans, course feedback.' },

  // Staff L2 (one per major operational concern)
  { code: 'ST-ADM',                 family: 'ST-ADM',                 label: 'Admissions Staff', description: 'Admissions team root.', primaryModule: 'admissions', defaultRole: 'staff', tier: 2, permissionsHint: 'Full admissions + people access.' },
  { code: 'ST-ACC',                 family: 'ST-ACC',                 label: 'Accounts Staff', description: 'Finance & fee accounts.', primaryModule: 'finance', defaultRole: 'staff', tier: 2, permissionsHint: 'Full finance access.' },
  { code: 'ST-HR',                  family: 'ST-HR',                  label: 'HR Staff', description: 'HR operations.', primaryModule: 'hr', defaultRole: 'staff', tier: 2, permissionsHint: 'Full HR + people access.' },
  { code: 'ST-WARDEN',              family: 'ST-WARDEN',              label: 'Hostel Warden', description: 'Hostel & mess management.', primaryModule: 'welfare', defaultRole: 'staff', tier: 2, permissionsHint: 'Welfare/hostel + campus/hostel.' },
  { code: 'ST-TRANSPORT-OFFICER',   family: 'ST-TRANSPORT-OFFICER',   label: 'Transport Officer', description: 'Routes & transport allocation.', primaryModule: 'campus', defaultRole: 'staff', tier: 2, permissionsHint: 'Campus/transport sub-domain.' },
  { code: 'ST-TPO',                 family: 'ST-TPO',                 label: 'Training & Placement Officer', description: 'Placement workflow lead.', primaryModule: 'placement', defaultRole: 'staff', tier: 2, permissionsHint: 'Full placement access.' },
  { code: 'ST-EXAM',                family: 'ST-EXAM',                label: 'Exam Controller', description: 'Examination administration.', primaryModule: 'academics', defaultRole: 'staff', tier: 2, permissionsHint: 'Academics/exams + results.' },
  { code: 'ST-LIB',                 family: 'ST-LIB',                 label: 'Librarian', description: 'Library operations.', primaryModule: 'campus', defaultRole: 'staff', tier: 2, permissionsHint: 'Campus/library sub-domain.' },
  { code: 'ST-SEC',                 family: 'ST-SEC',                 label: 'Security', description: 'Gate-pass, visitors, security.', primaryModule: 'campus', defaultRole: 'staff', tier: 2, permissionsHint: 'Campus/security sub-domain.' },
  { code: 'ST-IQAC',                family: 'ST-IQAC',                label: 'IQAC Coordinator', description: 'Quality assurance + accreditation.', primaryModule: 'compliance', defaultRole: 'staff', tier: 2, permissionsHint: 'Full compliance access.' },
  { code: 'ST-REG',                 family: 'ST-REG',                 label: 'Registrar', description: 'Records & enrolments.', primaryModule: 'people', defaultRole: 'staff', tier: 2, permissionsHint: 'Full people access.' },
];

// ─── L3 sub-personas (Strategic Gap 7) ──────────────────────────────

export const L3_SUB_PERSONAS: PersonaDescriptor[] = [
  // Admissions tier — sub-personas of ST-ADM. The doc maps these to
  // CampX's Tele-Counsellor / Admissions Counsellor / Admissions
  // Officer (with cluster-head variant) / Admissions Director.
  {
    code: 'ST-ADM-TC', family: 'ST-ADM', parentCode: 'ST-ADM',
    label: 'Tele-Counsellor',
    description: 'Outbound call team. Handles cold inquiries, first-contact attempts, basic qualification.',
    primaryModule: 'admissions', defaultRole: 'staff', tier: 3,
    permissionsHint: 'Inquiry CRUD, lead-interaction log, follow-up scheduling. Cannot convert to applicant.',
  },
  {
    code: 'ST-ADM-AC', family: 'ST-ADM', parentCode: 'ST-ADM',
    label: 'Admissions Counsellor',
    description: 'Senior counsellor — handles qualified leads, parent meetings, fee quotations.',
    primaryModule: 'admissions', defaultRole: 'staff', tier: 3,
    permissionsHint: 'Inquiry + applicant CRUD, convert lead → applicant, fee-quote drafts.',
  },
  {
    code: 'ST-ADM-AO', family: 'ST-ADM', parentCode: 'ST-ADM',
    label: 'Admissions Officer',
    description: 'Field officer — assigned a regional cluster of leads via assignment rules.',
    primaryModule: 'admissions', defaultRole: 'staff', tier: 3,
    permissionsHint: 'Same as Admissions Counsellor + offer-letter issue.',
  },
  {
    code: 'ST-ADM-AO-CH', family: 'ST-ADM', parentCode: 'ST-ADM-AO',
    label: 'Admissions Officer · Cluster Head',
    description: 'Cluster lead with visibility into all officers below. Push-receives target-miss alerts.',
    primaryModule: 'admissions', defaultRole: 'staff', tier: 3,
    permissionsHint: 'Admissions Officer + cluster-aggregation reads + reassignment within cluster.',
  },
  {
    code: 'ST-ADM-DIR', family: 'ST-ADM', parentCode: 'ST-ADM',
    label: 'Admissions Director',
    description: 'Admissions function head. CRM dashboard owner, assignment-rule policy admin.',
    primaryModule: 'admissions', defaultRole: 'staff', tier: 3,
    permissionsHint: 'Full admissions + CRM dashboard + assignment-rule CRUD + cluster-head overrides.',
  },

  // Academic-ops tier — three sub-personas the doc explicitly calls out.
  // We introduce a new ST-ACOPS family so policies can address them
  // collectively without colliding with ST-EXAM (which already owns
  // the exam-controller bucket).
  {
    code: 'ST-ACOPS-CC', family: 'ST-ACOPS', parentCode: 'ST-ACOPS',
    label: 'Course Coordinator',
    description: 'Subject-level coordinator. Owns one course offering across sections.',
    primaryModule: 'academics', defaultRole: 'staff', tier: 3,
    permissionsHint: 'CourseOffering CRUD for owned course, attendance/marks read, lesson-plan approvals.',
  },
  {
    code: 'ST-ACOPS-CR', family: 'ST-ACOPS', parentCode: 'ST-ACOPS',
    label: 'Classroom Coordinator',
    description: 'Section-level lead. Owns one section across all subjects.',
    primaryModule: 'academics', defaultRole: 'staff', tier: 3,
    permissionsHint: 'Section-scoped attendance + student-dev reads + parent communication.',
  },
  {
    code: 'ST-ACOPS-AC', family: 'ST-ACOPS', parentCode: 'ST-ACOPS',
    label: 'Academic Coordinator',
    description: 'Programme/department-level coordinator. Aggregates across courses + sections.',
    primaryModule: 'academics', defaultRole: 'staff', tier: 3,
    permissionsHint: 'Programme-scoped academics, lesson-plan oversight, OBE attainment reads.',
  },
  // Research family — single L3 persona; the doc notes M02/M10 already
  // implicitly support this but it lacks workspace-depth.
  {
    code: 'ST-RES-COORD', family: 'ST-RES-COORD', parentCode: 'ST-RES-COORD',
    label: 'Research Coordinator',
    description: 'Co-ordinates research-administration: publication evidence, fellowships, accreditation.',
    primaryModule: 'compliance', defaultRole: 'staff', tier: 3,
    permissionsHint: 'People read + compliance/research sub-domain + faculty-document verification.',
  },
];

export const ALL_PERSONAS: PersonaDescriptor[] = [...L1_L2_PERSONAS, ...L3_SUB_PERSONAS];

const PERSONA_INDEX = new Map<PersonaCode, PersonaDescriptor>(
  ALL_PERSONAS.map((p) => [p.code, p]),
);

export function getPersonaDescriptor(code: PersonaCode): PersonaDescriptor | null {
  return PERSONA_INDEX.get(code) || null;
}

export function listPersonasByFamily(family: PersonaCode): PersonaDescriptor[] {
  return ALL_PERSONAS.filter((p) => p.family === family);
}

/**
 * Walk the parentCode chain — returns this persona, then its parent,
 * grandparent, … up to the L1 root. Useful for policy resolution
 * fallbacks (UI-side; the engine itself uses wildcard match).
 */
export function personaAncestry(code: PersonaCode): PersonaDescriptor[] {
  const out: PersonaDescriptor[] = [];
  let cur: PersonaDescriptor | null = getPersonaDescriptor(code);
  const seen = new Set<PersonaCode>();
  while (cur && !seen.has(cur.code)) {
    seen.add(cur.code);
    out.push(cur);
    if (!cur.parentCode || cur.parentCode === cur.code) break;
    cur = getPersonaDescriptor(cur.parentCode);
  }
  return out;
}

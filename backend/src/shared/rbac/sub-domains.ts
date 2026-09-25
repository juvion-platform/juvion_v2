/**
 * 010 S3 — the typed sub-domain registry.
 *
 * Every `authorize(module, action, { subDomain })` on a route and every
 * `scope.subDomain` in a policy must name a value listed here. The map is
 * the single vocabulary shared with the frontend
 * (`admin-portal/src/config/sub-domains.json`, kept identical by a test), so
 * a typo can no longer silently allow or deny.
 *
 * Adding a sub-domain: add it here, then to the JSON. Renaming one is a
 * policy migration (rows in the DB carry the old string).
 */
export const SUB_DOMAINS = {
  admissions: ['applicants', 'documents', 'inquiries', 'lead-interactions'],
  people: ['faculty', 'staff'],
  academics: ['attendance', 'course-offerings', 'exams', 'feedback', 'internal-assessments', 'lesson-plans', 'marks', 'results'],
  finance: [],
  hr: [],
  welfare: ['grievance', 'hostel', 'mess'],
  placement: ['registration'],
  campus: ['facilities', 'gate-pass', 'hostel', 'hostel-allocation', 'labs', 'library', 'maintenance', 'mess', 'security', 'transport', 'transport-allocation', 'visitors'],
  'student-dev': ['membership', 'registration'],
  compliance: ['faculty-documents', 'naac', 'obe', 'publications', 'research'],
  governance: [],
  platform: ['communication'],
  juvi: [],
} as const;

export type RbacModule = keyof typeof SUB_DOMAINS;
export type SubDomainOf<M extends RbacModule> = (typeof SUB_DOMAINS)[M][number];
export type AnySubDomain = SubDomainOf<RbacModule>;
export type RbacAction = 'read' | 'create' | 'update' | 'delete' | 'approve';

export function isSubDomain(module: string, sub: string): boolean {
  const list = (SUB_DOMAINS as Record<string, readonly string[]>)[module];
  return !!list && list.includes(sub);
}

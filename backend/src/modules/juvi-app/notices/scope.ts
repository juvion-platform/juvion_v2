/**
 * Publisher scope (spec §7.3). Pure: the caller loads the PublisherScope
 * (publisher-scope.ts) and the AudienceGraph (audience-graph.ts). The composer
 * offers only allowedTargets(); publish and preview both run assertAudienceInScope.
 */
import { AppError } from '../../../middleware/errorHandler';
import { IAudienceRule, AudienceRuleKind, AUDIENCE_RULE_KINDS } from '../../../models/juvi/Notice';
import { AudienceGraph, PersonNode, ROLE_WORDS, personMatchesRule } from './audience';

export type PublisherKind = 'college' | 'department' | 'offerings' | 'none';

export interface PublisherScope {
  /** college: admin, principal and staff offices · department: HOD · offerings: teaching faculty · none: anyone else. */
  kind: PublisherKind;
  userId: string;
  personId?: string;
  office: string;
  /** admin, principal or super_admin: sees every notice and every reach in the college. */
  isAdmin: boolean;
  departmentId?: string;
  offeringIds: string[];
}

export interface TargetOption { id: string; label: string }
export interface AudienceTargets {
  kinds: AudienceRuleKind[];
  roles: string[];
  departments: TargetOption[];
  programmes: TargetOption[];
  batches: TargetOption[];
  sections: TargetOption[];
  courseOfferings: TargetOption[];
  hostelBlocks: TargetOption[];
}

const refuse = (message: string) => new AppError(403, message);

/** Server-side narrowing before the scope check: an HOD's `role` rules are pinned to their department. */
export function narrowToScope(scope: PublisherScope, rules: IAudienceRule[]): IAudienceRule[] {
  return rules.map((r) => (scope.kind === 'department' && r.kind === 'role' ? { ...r, departmentId: scope.departmentId } : { ...r }));
}

function membersOf(rule: IAudienceRule, g: AudienceGraph): PersonNode[] {
  return [...g.people.values()].filter((p) => personMatchesRule(rule, p, g));
}

/** A batch is within a department when it has members and every member belongs to that department. */
function batchInDepartment(batchId: string, departmentId: string, g: AudienceGraph): boolean {
  const members = membersOf({ kind: 'batch', ids: [batchId] }, g);
  return members.length > 0 && members.every((p) => p.departmentId === departmentId);
}

function assertDepartmentRules(departmentId: string | undefined, rules: IAudienceRule[], g: AudienceGraph): void {
  const inDept = (id: string | undefined) => Boolean(departmentId) && id === departmentId;
  for (const r of rules) {
    switch (r.kind) {
      case 'department':
        if (r.ids.length === 0 || !r.ids.every((id) => inDept(id))) throw refuse('You can only send notices to your own department.');
        break;
      case 'section':
        if (r.ids.length === 0 || !r.ids.every((id) => inDept(g.sections.get(id)?.departmentId))) throw refuse('That section is outside your department.');
        break;
      case 'course_offering':
        if (r.ids.length === 0 || !r.ids.every((id) => inDept(g.offerings.get(id)?.departmentId))) throw refuse('That course is outside your department.');
        break;
      case 'batch':
        if (r.ids.length === 0 || !r.ids.every((id) => batchInDepartment(id, departmentId ?? '', g))) {
          throw refuse('That batch includes students outside your department. Choose its sections instead.');
        }
        break;
      case 'role':
        if (!inDept(r.departmentId)) throw refuse('A role audience must stay within your department.');
        break;
      case 'custom':
        if (r.ids.length === 0 || !r.ids.every((id) => inDept(g.people.get(id)?.departmentId))) throw refuse('Some selected people are outside your department.');
        break;
      default:
        throw refuse('You can only send notices to your own department.');
    }
  }
}

function assertOfferingRules(offeringIds: string[], rules: IAudienceRule[], g: AudienceGraph): void {
  const mine = new Set(offeringIds);
  for (const r of rules) {
    if (r.kind === 'course_offering') {
      if (r.ids.length === 0 || !r.ids.every((id) => mine.has(id))) throw refuse('You can only send notices to the courses you teach.');
    } else if (r.kind === 'custom') {
      const enrolled = (id: string) => { const p = g.people.get(id); return p?.kind === 'student' && p.offeringIds.some((o) => mine.has(o)); };
      if (r.ids.length === 0 || !r.ids.every(enrolled)) throw refuse('Some selected people are not enrolled in your courses.');
    } else {
      throw refuse('You can only send notices to the courses you teach.');
    }
  }
}

/** Throws AppError(403) when any rule is outside the publisher's scope. Run it on narrowed rules. */
export function assertAudienceInScope(scope: PublisherScope, rules: IAudienceRule[], g: AudienceGraph): void {
  switch (scope.kind) {
    case 'college': return;
    case 'department': return assertDepartmentRules(scope.departmentId, rules, g);
    case 'offerings': return assertOfferingRules(scope.offeringIds, rules, g);
    default: throw refuse('You cannot publish notices.');
  }
}

const byLabel = (a: TargetOption, b: TargetOption) => a.label.localeCompare(b.label);
const options = (m: Map<string, { name: string }>, keep: (id: string) => boolean = () => true): TargetOption[] =>
  [...m.entries()].filter(([id]) => keep(id)).map(([id, v]) => ({ id, label: v.name })).sort(byLabel);

/** What the composer may offer this publisher (the same rules assertAudienceInScope enforces). */
export function allowedTargets(scope: PublisherScope, g: AudienceGraph): AudienceTargets {
  const none: AudienceTargets = { kinds: [], roles: [], departments: [], programmes: [], batches: [], sections: [], courseOfferings: [], hostelBlocks: [] };
  const sectionLabel = (id: string) => { const s = g.sections.get(id)!; return `${g.batches.get(s.batchId)?.name ?? 'Batch'} · Section ${s.name}`; };
  const sections = (keep: (id: string) => boolean) => [...g.sections.keys()].filter(keep).map((id) => ({ id, label: sectionLabel(id) })).sort(byLabel);
  const offerings = (keep: (id: string) => boolean) => [...g.offerings.entries()].filter(([id]) => keep(id)).map(([id, o]) => ({ id, label: o.label })).sort(byLabel);

  switch (scope.kind) {
    case 'college':
      return {
        kinds: [...AUDIENCE_RULE_KINDS], roles: [...ROLE_WORDS],
        departments: options(g.departments), programmes: options(g.programmes), batches: options(g.batches),
        sections: sections(() => true), courseOfferings: offerings(() => true), hostelBlocks: options(g.blocks),
      };
    case 'department': {
      const dep = scope.departmentId ?? '';
      return {
        ...none,
        kinds: ['role', 'department', 'batch', 'section', 'course_offering', 'custom'],
        roles: ['student', 'faculty', 'staff'],
        departments: options(g.departments, (id) => id === dep),
        batches: options(g.batches, (id) => batchInDepartment(id, dep, g)),
        sections: sections((id) => g.sections.get(id)?.departmentId === dep),
        courseOfferings: offerings((id) => g.offerings.get(id)?.departmentId === dep),
      };
    }
    case 'offerings': {
      const mine = new Set(scope.offeringIds);
      return { ...none, kinds: ['course_offering', 'custom'], courseOfferings: offerings((id) => mine.has(id)) };
    }
    default:
      return none;
  }
}

/**
 * Audience resolution for Juvi notices (spec §6.4). Pure functions over an
 * AudienceGraph, which audience-graph.ts loads from ERP people: every active
 * student, faculty member and staff member, whether or not they are on Juvi.
 */
import { AccountKind } from '../../../models/juvi/JuviAccount';
import { IAudienceRule, AudienceRuleKind } from '../../../models/juvi/Notice';
import { IRecipientLabels } from '../../../models/juvi/NoticeRecipient';
import { ChannelScopeType } from '../../../models/juvi/ChannelTemplate';
import { ChannelRef } from '../spaces/strategies';

export interface PersonNode {
  personId: string;
  kind: AccountKind;
  /** The person's Juvi account while it is `active` ("on Juvi"); null otherwise ("Not on Juvi"). */
  accountId: string | null;
  /** Persona codes the person holds (User personas plus Staff.personaCode). */
  personaCodes: string[];
  isHod: boolean;
  /** Students: the department of their branch. Faculty and staff: their own department. */
  departmentId?: string;
  batchId?: string;
  sectionIds: string[];
  /** Students: offerings they are enrolled in, or on the roster of when an offering has no enrolments. Faculty: offerings they teach. */
  offeringIds: string[];
  hostelBlockId?: string;
  labels: IRecipientLabels;
}

export interface AudienceGraph {
  collegeName: string;
  people: Map<string, PersonNode>;
  departments: Map<string, { name: string }>;
  programmes: Map<string, { name: string }>;
  batches: Map<string, { name: string; programmeId?: string }>;
  sections: Map<string, { name: string; batchId: string; departmentId?: string }>;
  offerings: Map<string, { label: string; sectionId: string; departmentId?: string; facultyIds: string[] }>;
  blocks: Map<string, { name: string }>;
}

/** Words a `role` rule may name besides persona codes. */
export const ROLE_WORDS = ['student', 'faculty', 'staff', 'hod'] as const;

export function emptyAudienceGraph(collegeName = ''): AudienceGraph {
  return {
    collegeName, people: new Map(), departments: new Map(), programmes: new Map(),
    batches: new Map(), sections: new Map(), offerings: new Map(), blocks: new Map(),
  };
}

function holdsRole(p: PersonNode, id: string): boolean {
  if (id === 'student' || id === 'faculty' || id === 'staff') return p.kind === id;
  if (id === 'hod') return p.isHod;
  // A persona code matches itself and its sub-personas (ST-ADM matches ST-ADM-TC).
  return p.personaCodes.some((c) => c === id || c.startsWith(`${id}-`));
}

const has = (list: string[], v: string | undefined): boolean => v !== undefined && list.includes(v);
const overlaps = (a: string[], b: string[]): boolean => a.some((x) => b.includes(x));

export function personMatchesRule(rule: IAudienceRule, p: PersonNode, g: AudienceGraph): boolean {
  const student = p.kind === 'student';
  switch (rule.kind) {
    case 'all': return true;
    case 'role': return rule.ids.some((id) => holdsRole(p, id)) && (!rule.departmentId || p.departmentId === rule.departmentId);
    case 'department': return has(rule.ids, p.departmentId);
    case 'programme': return student && has(rule.ids, p.batchId ? g.batches.get(p.batchId)?.programmeId : undefined);
    case 'batch': return student && has(rule.ids, p.batchId);
    case 'section': return student && overlaps(p.sectionIds, rule.ids);
    case 'course_offering': return student && overlaps(p.offeringIds, rule.ids);
    case 'hostel_block': return student && has(rule.ids, p.hostelBlockId);
    case 'custom': return rule.ids.includes(p.personId);
    default: return false;
  }
}

export function personMatchesRules(rules: IAudienceRule[], p: PersonNode, g: AudienceGraph): boolean {
  return rules.some((r) => personMatchesRule(r, p, g));
}

/** The union of the rules, each person once, sorted by personId so fan-out batches are deterministic. */
export function resolveAudience(rules: IAudienceRule[], g: AudienceGraph): PersonNode[] {
  return [...g.people.values()]
    .filter((p) => personMatchesRules(rules, p, g))
    .sort((a, b) => (a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0));
}

const CHANNEL_SCOPE: Partial<Record<AudienceRuleKind, ChannelScopeType>> = {
  department: 'department', batch: 'batch', course_offering: 'course_offering', hostel_block: 'hostel_block',
};

/** Channels whose scope equals a rule (spec §6.4): all → college; department, batch, course_offering, hostel_block → their channel. */
export function ruleChannelRefs(rules: IAudienceRule[]): ChannelRef[] {
  const out = new Map<string, ChannelRef>();
  for (const r of rules) {
    if (r.kind === 'all') out.set('college:', { scopeType: 'college', scopeId: null });
    const scopeType = CHANNEL_SCOPE[r.kind];
    if (scopeType) for (const id of r.ids) out.set(`${scopeType}:${id}`, { scopeType, scopeId: id });
  }
  return [...out.values()];
}

const ROLE_PHRASE: Record<string, string> = { student: 'all students', faculty: 'all faculty', staff: 'all staff', hod: 'all HODs' };

function rulePhrases(r: IAudienceRule, g: AudienceGraph): string[] {
  const name = (m: Map<string, { name: string }>, id: string, fallback: string) => m.get(id)?.name ?? fallback;
  switch (r.kind) {
    case 'all': return [`everyone at ${g.collegeName || 'the college'}`];
    case 'role': {
      const words = r.ids.map((id) => ROLE_PHRASE[id] ?? id);
      if (!r.departmentId) return words;
      const dept = name(g.departments, r.departmentId, 'the department');
      return words.map((w) => `${w.replace(/^all /, '')} in ${dept}`);
    }
    case 'department': return r.ids.map((id) => `${name(g.departments, id, 'a department')} department`);
    case 'programme': return r.ids.map((id) => `${name(g.programmes, id, 'a programme')} programme`);
    case 'batch': return r.ids.map((id) => name(g.batches, id, 'a batch'));
    case 'section': return r.ids.map((id) => {
      const s = g.sections.get(id);
      return s ? `${g.batches.get(s.batchId)?.name ?? 'Batch'} section ${s.name}` : 'a section';
    });
    case 'course_offering': return r.ids.map((id) => g.offerings.get(id)?.label ?? 'a course');
    case 'hostel_block': return r.ids.map((id) => `${name(g.blocks, id, 'a')} hostel`);
    case 'custom': return [`${r.ids.length} selected ${r.ids.length === 1 ? 'person' : 'people'}`];
    default: return [];
  }
}

/** "Sent to CSE 2024 batch" — the line shown on the card and in the ERP list (spec §5 `audience.line`). */
export function audienceLine(rules: IAudienceRule[], g: AudienceGraph): string {
  const phrases = rules.flatMap((r) => rulePhrases(r, g));
  if (phrases.length === 0) return 'Sent to nobody';
  const shown = phrases.length > 3 ? [...phrases.slice(0, 2), `${phrases.length - 2} more`] : phrases;
  const joined = shown.length === 1 ? shown[0]! : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return `Sent to ${joined}`;
}

/** Reach groups (spec §4 US-4.2): students by batch and section, faculty and staff by department. */
export function groupLabel(kind: AccountKind, labels: IRecipientLabels): string {
  if (kind === 'student') {
    return [labels.batch, labels.section ? `Section ${labels.section}` : undefined].filter(Boolean).join(' · ') || 'Students without a batch';
  }
  const who = kind === 'faculty' ? 'Faculty' : 'Staff';
  return labels.department ? `${who} · ${labels.department}` : who;
}

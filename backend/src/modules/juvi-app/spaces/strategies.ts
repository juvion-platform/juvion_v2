import { AccountKind } from '../../../models/juvi/JuviAccount';
import { ChannelScopeType } from '../../../models/juvi/ChannelTemplate';
import { MembershipRole } from '../../../models/juvi/ChannelMembership';

export interface AccountNode {
  accountId: string;
  kind: AccountKind;
  personId: string;
  isAdminOrPrincipal: boolean;
  student?: { studentId: string; batchId?: string; branchId?: string; sectionIds: string[]; enrolledOfferingIds: string[]; hostelBlockId?: string };
  faculty?: { facultyId: string; departmentId?: string; contractType: string };
  staff?: { staffId: string; personaCode?: string };
}

/**
 * In-memory view of the ERP for membership decisions. The college loader fills
 * `accounts` with every eligible account; the account loader fills it with one.
 * The metadata maps are college-wide in both cases (they are small).
 */
export interface ErpGraph {
  accounts: Map<string, AccountNode>;
  branchDepartment: Map<string, string>;
  departments: Map<string, { hodFacultyId?: string }>;
  sections: Map<string, { batchId: string; branchId: string; classAdvisorId?: string }>;
  offerings: Map<string, { sectionId: string; facultyIds: string[]; enrollmentCount: number }>;
  blocks: Map<string, { wardenPersonId?: string; chiefWardenStaffId?: string }>;
}

export interface ChannelRef { scopeType: ChannelScopeType; scopeId: string | null }

export const F4_CONTRACT_TYPES: ReadonlySet<string> = new Set(['adjunct', 'visiting']);

export function emptyGraph(): ErpGraph {
  return { accounts: new Map(), branchDepartment: new Map(), departments: new Map(), sections: new Map(), offerings: new Map(), blocks: new Map() };
}

const isF4 = (a: AccountNode) => a.kind === 'faculty' && F4_CONTRACT_TYPES.has(a.faculty?.contractType ?? '');
const isRegistrar = (a: AccountNode) => a.staff?.personaCode === 'ST-REG';
const isAdmissions = (a: AccountNode) => (a.staff?.personaCode ?? '').startsWith('ST-ADM');

function headsDepartment(g: ErpGraph, a: AccountNode, departmentId: string): boolean {
  return Boolean(a.faculty) && g.departments.get(departmentId)?.hodFacultyId === a.faculty!.facultyId;
}

function decide(g: ErpGraph, channel: ChannelRef, a: AccountNode): MembershipRole | null {
  const id = channel.scopeId ?? '';
  switch (channel.scopeType) {
    case 'college': {
      if (isF4(a)) return null;
      return a.isAdminOrPrincipal || a.kind === 'staff' ? 'publisher' : 'member';
    }
    case 'department': {
      if (!g.departments.has(id)) return null;
      if (a.isAdminOrPrincipal || isRegistrar(a) || headsDepartment(g, a, id)) return 'publisher';
      if (a.student?.branchId && g.branchDepartment.get(a.student.branchId) === id) return 'member';
      if (a.faculty?.departmentId === id && !isF4(a)) return 'member';
      return null;
    }
    case 'batch': {
      const sectionsOfBatch = [...g.sections.entries()].filter(([, s]) => s.batchId === id);
      if (isAdmissions(a) || isRegistrar(a)) return 'publisher';
      if (a.faculty) {
        const fid = a.faculty.facultyId;
        if (sectionsOfBatch.some(([, s]) => s.classAdvisorId === fid)) return 'publisher';               // D3
        if (sectionsOfBatch.some(([, s]) => headsDepartment(g, a, g.branchDepartment.get(s.branchId) ?? ''))) return 'publisher';
      }
      if (a.student?.batchId === id) return 'member';
      return null;
    }
    case 'course_offering': {
      const off = g.offerings.get(id);
      if (!off) return null;
      if (a.faculty && off.facultyIds.includes(a.faculty.facultyId)) return 'publisher';
      if (a.student) {
        if (a.student.enrolledOfferingIds.includes(id)) return 'member';
        if (off.enrollmentCount === 0 && a.student.sectionIds.includes(off.sectionId)) return 'member';   // roster fallback
      }
      return null;
    }
    case 'hostel_block': {
      const blk = g.blocks.get(id);
      if (!blk) return null;
      if (blk.wardenPersonId === a.personId) return 'publisher';
      if (a.staff && blk.chiefWardenStaffId === a.staff.staffId) return 'publisher';
      if (a.student?.hostelBlockId === id) return 'member';
      return null;
    }
    default:
      return null;
  }
}

/** One algorithm for both the college pass and the account pass (spec §9). */
export function computeExpectedMembers(graph: ErpGraph, channel: ChannelRef): Map<string, MembershipRole> {
  const out = new Map<string, MembershipRole>();
  for (const a of graph.accounts.values()) {
    const role = decide(graph, channel, a);
    if (role) out.set(a.accountId, role);
  }
  return out;
}

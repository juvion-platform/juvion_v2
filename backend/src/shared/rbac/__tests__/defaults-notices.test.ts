import { describe, it, expect } from 'vitest';
import { DEFAULT_POLICIES } from '../defaults';
import { filterPolicies, sortPolicies } from '../engine';
import type { PolicyDoc } from '../types';
import { OFFICE_PERSONA_CODES } from '../../../modules/juvi-app/notices/offices';

const POLICIES = DEFAULT_POLICIES as PolicyDoc[];
function decide(role: string, action: string, persona: string | string[]): PolicyDoc | undefined {
  const mine = POLICIES.filter((p) => p.role === role || p.role === '*');
  const chain = Array.isArray(persona) ? persona : [persona];
  return sortPolicies(filterPolicies(mine, 'notices', action, chain), chain)[0];
}
const allows = (role: string, action: string, persona: string | string[]) => decide(role, action, persona)?.effect === 'allow';

describe('DEFAULT_POLICIES — notices (notices spec §7.4)', () => {
  it('lets admin, principal, HOD and faculty read, create and update', () => {
    for (const [role, persona] of [['admin', 'L-ADM'], ['principal', 'L-PRIN'], ['hod', 'F-HOD'], ['faculty', 'F-FAC']] as const) {
      for (const action of ['read', 'create', 'update']) expect(allows(role, action, persona), `${role} ${action}`).toBe(true);
    }
  });

  it('lets every staff member read, and only the office personas (and their sub-personas) create and update', () => {
    expect(allows('staff', 'read', 'ST-HR')).toBe(true);
    for (const code of OFFICE_PERSONA_CODES) {
      expect(allows('staff', 'create', code), code).toBe(true);
      expect(allows('staff', 'update', code), code).toBe(true);
    }
    expect(allows('staff', 'create', ['ST-ADM-TC', 'ST-ADM'])).toBe(true);
    expect(allows('staff', 'create', 'ST-HR')).toBe(false);
    expect(allows('staff', 'update', 'ST-IQAC')).toBe(false);
  });

  it('gives students and parents nothing, and never narrows rows', () => {
    for (const action of ['read', 'create', 'update']) {
      expect(allows('student', action, 'L-STU')).toBe(false);
      expect(allows('parent', action, 'L-PAR')).toBe(false);
    }
    for (const p of POLICIES.filter((x) => x.module === 'notices')) {
      expect(p.scope?.departmentOnly ?? false).toBe(false);
      expect(p.scope?.selfOnly ?? false).toBe(false);
    }
  });

  it('names exactly the office personas of offices.ts', () => {
    const codes = POLICIES.filter((p) => p.module === 'notices' && p.role === 'staff' && p.action === 'create').map((p) => p.personaType).sort();
    expect(codes).toEqual([...OFFICE_PERSONA_CODES].sort());
  });
});

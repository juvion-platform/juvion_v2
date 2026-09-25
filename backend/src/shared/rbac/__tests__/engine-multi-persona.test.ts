import { describe, it, expect } from 'vitest';
import { decide, mergeAllows, matchPersonaType } from '../engine';
import { ancestryFrom, personaCodesOf, PersonaRow } from '../persona-registry';
import { PolicyDoc } from '../types';

/** 010 S1/S2 — evaluation contract. These are golden tests: changing them is a migration. */
const rows: PersonaRow[] = [
  { code: 'ST-ADM', label: '', family: 'ST-ADM', parentCode: null, primaryModule: 'admissions', defaultRole: 'staff', tier: 2, isActive: true },
  { code: 'ST-ADM-TC', label: '', family: 'ST-ADM', parentCode: 'ST-ADM', primaryModule: 'admissions', defaultRole: 'staff', tier: 3, isActive: true },
  { code: 'F-HOD', label: '', family: 'F-HOD', parentCode: null, primaryModule: 'academics', defaultRole: 'hod', tier: 1, isActive: true },
  { code: 'F-FAC', label: '', family: 'F-FAC', parentCode: null, primaryModule: 'academics', defaultRole: 'faculty', tier: 1, isActive: true },
];
const P = (p: Partial<PolicyDoc> & Pick<PolicyDoc, 'module' | 'action' | 'effect'>): PolicyDoc =>
  ({ role: 'staff', priority: 700, isActive: true, ...p });

describe('ancestryFrom', () => {
  it('walks parentCode to the root and always includes the code itself', () => {
    expect(ancestryFrom(rows, 'ST-ADM-TC')).toEqual(['ST-ADM-TC', 'ST-ADM']);
    expect(ancestryFrom(rows, 'UNKNOWN')).toEqual(['UNKNOWN']);
  });
  it('stops on cycles', () => {
    const cyc: PersonaRow[] = [
      { ...rows[0]!, code: 'A', parentCode: 'B' }, { ...rows[0]!, code: 'B', parentCode: 'A' },
    ];
    expect(ancestryFrom(cyc, 'A')).toEqual(['A', 'B']);
  });
});

describe('matchPersonaType against a chain', () => {
  it('matches a parent policy through the explicit link, not the name', () => {
    expect(matchPersonaType('ST-ADM', ['ST-ADM-TC', 'ST-ADM'])).toBe(true);
    expect(matchPersonaType('ST-ADM', ['ST-ADMIN'])).toBe(false); // prefix alone is not inheritance
    expect(matchPersonaType('ST-ADM-*', ['ST-ADM-TC', 'ST-ADM'])).toBe(true); // legacy wildcard rows still work
  });
});

describe('decide (multi-persona)', () => {
  const policies: PolicyDoc[] = [
    P({ role: 'hod', personaType: 'F-HOD', module: 'academics', action: '*', effect: 'allow', priority: 800, scope: { departmentOnly: true } }),
    P({ role: 'hod', personaType: 'F-FAC', module: 'academics', action: 'create', effect: 'allow', priority: 700, scope: { subDomain: 'attendance,marks' } }),
    P({ role: 'hod', personaType: 'F-FAC', module: 'finance', action: 'read', effect: 'deny', priority: 700 }),
    P({ role: 'hod', personaType: 'F-HOD', module: 'finance', action: 'read', effect: 'allow', priority: 800 }),
    P({ role: 'hod', personaType: 'ST-ADM', module: 'admissions', action: 'read', effect: 'allow', priority: 750 }),
  ];
  const chains = (...codes: string[]) => codes.map((c) => ancestryFrom(rows, c));

  it('unions allows: HOD+faculty gets HOD reach on academics', () => {
    const d = decide(policies, chains('F-HOD', 'F-FAC'), 'academics', 'create');
    expect(d?.effect).toBe('allow');
    expect(d?.scope).toBeUndefined(); // HOD is unrestricted on sub-domains, so the union is unrestricted
  });
  it('keeps a scope flag only when every allowing persona carries it', () => {
    const d = decide(policies, chains('F-HOD', 'F-FAC'), 'academics', 'read');
    expect(d?.scope?.departmentOnly).toBe(true); // only F-HOD allows read, so its scope stands
  });
  it('explicit deny on any persona wins', () => {
    expect(decide(policies, chains('F-HOD', 'F-FAC'), 'finance', 'read')?.effect).toBe('deny');
    expect(decide(policies, chains('F-HOD'), 'finance', 'read')?.effect).toBe('allow');
  });
  it('inherits through the parent link', () => {
    expect(decide(policies, chains('ST-ADM-TC'), 'admissions', 'read')?.effect).toBe('allow');
  });
  it('no match on any persona is a deny', () => {
    expect(decide(policies, chains('F-FAC'), 'hr', 'read')).toBeNull();
  });
});

describe('mergeAllows', () => {
  it('unions sub-domain lists when every allow is restricted', () => {
    const m = mergeAllows([
      P({ module: 'academics', action: 'create', effect: 'allow', scope: { subDomain: 'exams' } }),
      P({ module: 'academics', action: 'create', effect: 'allow', scope: { subDomain: 'attendance, marks' } }),
    ]);
    expect(m.scope?.subDomain!.split(',').sort()).toEqual(['attendance', 'exams', 'marks']);
  });
});

describe('personaCodesOf', () => {
  it('puts the primary first and de-duplicates', () => {
    expect(personaCodesOf({ personaType: 'F-HOD', personas: ['F-FAC', 'F-HOD'] })).toEqual(['F-HOD', 'F-FAC']);
    expect(personaCodesOf({ personaType: 'F-HOD' })).toEqual(['F-HOD']);
  });
});

// ─── 010 P2 — assigned scope and OR-merge ───────────────────────────────
describe('mergeAllows — row narrowings are alternatives', () => {
  const dept = P({ module: 'people', action: 'read', effect: 'allow', scope: { departmentOnly: true } });
  const mentees = P({ module: 'people', action: 'read', effect: 'allow', scope: { assignedVia: ['mentees'] } });
  const open = P({ module: 'people', action: 'read', effect: 'allow' });
  it('keeps department AND assigned when every allow narrows (applyAuthScope ORs them)', () => {
    const m = mergeAllows([dept, mentees]);
    expect(m.scope?.departmentOnly).toBe(true);
    expect(m.scope?.assignedVia).toEqual(['mentees']);
  });
  it('drops every row narrowing when one allow is unrestricted', () => {
    expect(mergeAllows([dept, mentees, open]).scope).toBeUndefined();
  });
  it('unions assignedVia kinds', () => {
    const sections = P({ module: 'people', action: 'read', effect: 'allow', scope: { assignedVia: ['sections'] } });
    expect(mergeAllows([mentees, sections]).scope?.assignedVia!.sort()).toEqual(['mentees', 'sections']);
  });
});

describe('sortPolicies — nearer chain match wins', () => {
  it("a sub-persona's own row beats the inherited parent row, and a deny can pin it below the parent", () => {
    const policies: PolicyDoc[] = [
      P({ personaType: 'ST-ADM', module: 'admissions', action: '*', effect: 'allow', priority: 750 }),
      P({ personaType: 'ST-ADM-TC', module: 'admissions', action: 'create', effect: 'allow', priority: 700, scope: { subDomain: 'inquiries' } }),
      P({ personaType: 'ST-ADM-TC', module: 'admissions', action: 'delete', effect: 'deny', priority: 700 }),
    ];
    const chain = ['ST-ADM-TC', 'ST-ADM'];
    expect(decide(policies, [chain], 'admissions', 'create')?.scope?.subDomain).toBe('inquiries'); // own row, lower priority, still wins
    expect(decide(policies, [chain], 'admissions', 'delete')?.effect).toBe('deny');
    expect(decide(policies, [chain], 'admissions', 'read')?.effect).toBe('allow'); // inherited
  });
});

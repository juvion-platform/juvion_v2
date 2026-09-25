import { describe, it, expect } from 'vitest';
import { scopeLabel, policyKey } from '../platform/policy-scope';

describe('policy scope helpers', () => {
  it('labels every narrowing and falls back to unrestricted', () => {
    expect(scopeLabel(undefined)).toBe('unrestricted');
    expect(scopeLabel({})).toBe('unrestricted');
    expect(scopeLabel({ departmentOnly: true, subDomain: 'exams,results', assignedVia: ['mentees', 'sections'] })).toBe('dept · exams,results · mentees+sections');
    expect(scopeLabel({ selfOnly: true })).toBe('self');
  });
  it('labels sensitivity: undefined is silent, [] is none, a list is sees…', () => {
    expect(scopeLabel({ sensitivity: [] })).toBe('no sensitive fields');
    expect(scopeLabel({ departmentOnly: true, sensitivity: ['hr.compensation'] })).toBe('dept · sees hr.compensation');
  });
  it('builds the defaults-review key with an empty persona slot', () => {
    expect(policyKey({ role: 'staff', personaType: null, module: 'finance', action: '*' })).toBe('staff||finance|*');
    expect(policyKey({ role: 'staff', personaType: 'ST-ACC', module: 'finance', action: 'read' })).toBe('staff|ST-ACC|finance|read');
  });
});

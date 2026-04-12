import { describe, it, expect } from 'vitest';
import { filterPolicies, sortPolicies, matchPersonaType } from '../engine';
import { PolicyDoc } from '../types';

describe('matchPersonaType', () => {
  it('matches exact personaType', () => {
    expect(matchPersonaType('ST-WARDEN', 'ST-WARDEN')).toBe(true);
  });
  it('matches wildcard personaType', () => {
    expect(matchPersonaType('F-HOD-*', 'F-HOD-CSE')).toBe(true);
    expect(matchPersonaType('F-HOD-*', 'F-HOD-ECE')).toBe(true);
  });
  it('rejects mismatched personaType', () => {
    expect(matchPersonaType('ST-WARDEN', 'ST-TPO')).toBe(false);
    expect(matchPersonaType('F-HOD-*', 'F-FAC')).toBe(false);
  });
  it('null policy personaType matches any user personaType', () => {
    expect(matchPersonaType(null, 'ST-WARDEN')).toBe(true);
    expect(matchPersonaType(undefined, 'F-HOD-CSE')).toBe(true);
  });
});

describe('filterPolicies', () => {
  const policies: PolicyDoc[] = [
    { role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true },
    { role: 'faculty', module: 'academics', action: 'create', effect: 'allow', priority: 700, isActive: true, scope: { subDomain: 'attendance,marks' } },
    { role: 'faculty', module: 'finance', action: 'read', effect: 'deny', priority: 700, isActive: true },
    { role: 'faculty', module: '*', action: 'read', effect: 'allow', priority: 600, isActive: true },
  ];

  it('filters by exact module and action', () => {
    const result = filterPolicies(policies, 'academics', 'read', 'F-FAC');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.module).toBe('academics');
  });

  it('includes wildcard module matches', () => {
    const result = filterPolicies(policies, 'people', 'read', 'F-FAC');
    expect(result.length).toBe(1);
    expect(result[0]!.module).toBe('*');
  });

  it('excludes non-matching module', () => {
    const result = filterPolicies(policies, 'people', 'create', 'F-FAC');
    expect(result.length).toBe(0);
  });
});

describe('sortPolicies', () => {
  it('sorts college-specific before defaults', () => {
    const policies: PolicyDoc[] = [
      { role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true },
      { role: 'faculty', collegeId: 'college1', module: 'academics', action: 'read', effect: 'deny', priority: 700, isActive: true },
    ];
    const sorted = sortPolicies(policies);
    expect(sorted[0]!.collegeId).toBe('college1');
  });

  it('sorts higher priority first', () => {
    const policies: PolicyDoc[] = [
      { role: 'staff', module: '*', action: 'read', effect: 'allow', priority: 600, isActive: true },
      { role: 'staff', personaType: 'ST-WARDEN', module: 'welfare', action: '*', effect: 'allow', priority: 750, isActive: true },
    ];
    const sorted = sortPolicies(policies);
    expect(sorted[0]!.priority).toBe(750);
  });

  it('sorts exact module before wildcard', () => {
    const policies: PolicyDoc[] = [
      { role: 'faculty', module: '*', action: 'read', effect: 'allow', priority: 700, isActive: true },
      { role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700, isActive: true },
    ];
    const sorted = sortPolicies(policies);
    expect(sorted[0]!.module).toBe('academics');
  });
});

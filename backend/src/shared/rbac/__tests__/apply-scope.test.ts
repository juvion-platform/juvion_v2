import { describe, it, expect } from 'vitest';
import { applyAuthScope } from '../apply-scope';
import type { AuthScope } from '../types';

describe('applyAuthScope', () => {
  const baseScope: AuthScope = {
    departmentOnly: false,
    selfOnly: false,
    userId: 'user1',
    resolvedPermissions: [],
  };

  it('returns filter unchanged when no scope constraints', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    applyAuthScope(filter, baseScope);
    expect(filter).toEqual({ collegeId: 'c1' });
  });

  it('adds departmentId filter when departmentOnly is true', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = { ...baseScope, departmentOnly: true, departmentId: 'dept-cse' };
    applyAuthScope(filter, scope);
    expect(filter.departmentId).toBe('dept-cse');
  });

  it('does not add departmentId when departmentOnly but no departmentId resolved', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = { ...baseScope, departmentOnly: true };
    applyAuthScope(filter, scope);
    expect(filter.departmentId).toBeUndefined();
  });

  it('adds selfOnly filter using the specified selfField', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = { ...baseScope, selfOnly: true, personId: 'person1' };
    applyAuthScope(filter, scope, { selfField: 'studentId' });
    expect(filter.studentId).toBe('person1');
  });

  it('defaults selfField to createdBy using userId', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = { ...baseScope, selfOnly: true };
    applyAuthScope(filter, scope);
    expect(filter.createdBy).toBe('user1');
  });

  it('applies both departmentOnly and selfOnly together', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = {
      ...baseScope,
      departmentOnly: true,
      departmentId: 'dept-ece',
      selfOnly: true,
      personId: 'person2',
    };
    applyAuthScope(filter, scope, { selfField: 'personId' });
    expect(filter.departmentId).toBe('dept-ece');
    expect(filter.personId).toBe('person2');
  });

  it('uses custom departmentField when specified', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = { ...baseScope, departmentOnly: true, departmentId: 'dept-mech' };
    applyAuthScope(filter, scope, { departmentField: 'branchId' });
    expect(filter.branchId).toBe('dept-mech');
    expect(filter.departmentId).toBeUndefined();
  });
});

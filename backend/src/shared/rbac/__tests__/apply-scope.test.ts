import { describe, it, expect, vi } from 'vitest';
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

  it('selfField studentId with no resolved studentId fails closed to the sentinel, never falls back to personId', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = { ...baseScope, selfOnly: true, personId: 'person1' };
    applyAuthScope(filter, scope, { selfField: 'studentId' });
    expect(filter.studentId).toBeUndefined();
    expect(filter._id).toEqual({ $in: [] });
  });

  it('defaults selfField to createdBy using userId', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = { ...baseScope, selfOnly: true };
    applyAuthScope(filter, scope);
    expect(filter.createdBy).toBe('user1');
  });

  // 010 P2 — narrowings from different policies are alternatives, so a scope
  // carrying both flags matches department rows OR own rows, never the AND.
  it('applies departmentOnly and selfOnly as alternatives', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = { ...baseScope, departmentOnly: true, departmentId: 'dept-ece', selfOnly: true };
    applyAuthScope(filter, scope);
    expect(filter.departmentId).toBeUndefined();
    expect(filter.$and).toEqual([{ $or: [{ departmentId: 'dept-ece' }, { createdBy: 'user1' }] }]);
  });

  it('uses custom departmentField when specified', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = { ...baseScope, departmentOnly: true, departmentId: 'dept-mech' };
    applyAuthScope(filter, scope, { departmentField: 'deptRef' });
    expect(filter.deptRef).toBe('dept-mech');
    expect(filter.departmentId).toBeUndefined();
  });
  // 010 — `branchId` is a Branch id, not a Department id; the scope carries the
  // branches under the department so the filter compares like with like.
  it('branchId department field filters by the department\'s branches, never by the department id', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    const scope: AuthScope = { ...baseScope, departmentOnly: true, departmentId: 'dept-mech', branchIds: ['br-mech-a'] };
    applyAuthScope(filter, scope, { departmentField: 'branchId' });
    expect(filter.branchId).toEqual({ $in: ['br-mech-a'] });
  });
});

// ─── 010 S4 — fail closed, marker, scoped by-id ────────────────────────────
import { findOneScoped, isScopeApplied, scopeNarrows } from '../apply-scope';

describe('applyAuthScope — 010 fail-closed', () => {
  const base: AuthScope = { departmentOnly: false, selfOnly: false, userId: 'u1', resolvedPermissions: [] };

  it('marks the filter so paginate can tell it was scoped', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    expect(isScopeApplied(filter)).toBe(false);
    applyAuthScope(filter, base);
    expect(isScopeApplied(filter)).toBe(true);
    expect(Object.keys(filter)).toEqual(['collegeId']); // marker is not a query key
  });

  it('department-only with no department resolves to zero rows, not the college', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    applyAuthScope(filter, { ...base, departmentOnly: true });
    expect(filter._id).toEqual({ $in: [] });
  });

  it('branchId department field uses the branches under the department', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    applyAuthScope(filter, { ...base, departmentOnly: true, departmentId: 'd1', branchIds: ['b1', 'b2'] }, { departmentField: 'branchId' });
    expect(filter.branchId).toEqual({ $in: ['b1', 'b2'] });
  });

  it('self-only on a person-linked field with no person resolves to zero rows', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    applyAuthScope(filter, { ...base, selfOnly: true }, { selfField: 'personId' });
    expect(filter._id).toEqual({ $in: [] });
  });

  it('scopeNarrows is true only for department/self scopes', () => {
    expect(scopeNarrows(base)).toBe(false);
    expect(scopeNarrows({ ...base, selfOnly: true })).toBe(true);
    expect(scopeNarrows(undefined)).toBe(false);
  });

  it('findOneScoped adds college and scope to the id lookup', () => {
    const findOne = vi.fn().mockReturnValue('query');
    const model = { findOne } as any;
    findOneScoped(model, 'id1', 'c1', { ...base, departmentOnly: true, departmentId: 'd1' });
    expect(findOne).toHaveBeenCalledWith({ _id: 'id1', collegeId: 'c1', departmentId: 'd1' });
    findOneScoped(model, 'id1', 'c1', undefined);
    expect(findOne).toHaveBeenLastCalledWith({ _id: 'id1', collegeId: 'c1' });
  });
});

// ─── 010 P2 — assigned scope ───────────────────────────────────────────
describe('applyAuthScope — assigned', () => {
  const base: AuthScope = { departmentOnly: false, selfOnly: false, userId: 'u1', resolvedPermissions: [] };
  const assigned = { studentIds: ['s1'], sectionIds: ['sec1'], courseOfferingIds: ['co1'] };

  it('student-shaped records match _id against the assigned students by default', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    applyAuthScope(filter, { ...base, assignedVia: ['mentees'], assigned }, { departmentField: 'branchId' });
    expect(filter._id).toEqual({ $in: ['s1'] });
  });
  it('explicit assignedField maps section and offering ids', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    applyAuthScope(filter, { ...base, assignedVia: ['sections'], assigned }, { assignedField: { courseOfferingIds: '_id', sectionIds: 'sectionId' } });
    expect(filter.$or).toEqual([{ sectionId: { $in: ['sec1'] } }, { _id: { $in: ['co1'] } }]);
  });
  it('assigned-only scope on a record with no assigned axis yields zero rows', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    applyAuthScope(filter, { ...base, assignedVia: ['mentees'], assigned });
    expect(filter._id).toEqual({ $in: [] });
  });
  it('department OR assigned lands in $and so a caller $or survives', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1', $or: [{ a: 1 }] };
    applyAuthScope(filter, { ...base, departmentOnly: true, departmentId: 'd1', branchIds: ['b1'], assignedVia: ['mentees'], assigned }, { departmentField: 'branchId' });
    expect(filter.$or).toEqual([{ a: 1 }]);
    expect(filter.$and).toEqual([{ $or: [{ branchId: { $in: ['b1'] } }, { _id: { $in: ['s1'] } }] }]);
  });
});

describe('applyAuthScope — never clobbers a caller key', () => {
  it('intersects an assigned _id restriction with an explicit _id', () => {
    const filter: Record<string, unknown> = { _id: 'x', collegeId: 'c1' };
    applyAuthScope(filter, { departmentOnly: false, selfOnly: false, userId: 'u', resolvedPermissions: [], assignedVia: ['mentees'], assigned: { studentIds: ['s1'], sectionIds: [], courseOfferingIds: [] } }, { departmentField: 'branchId' });
    expect(filter._id).toBe('x');
    expect(filter.$and).toEqual([{ $or: [{ _id: { $in: ['s1'] } }] }]);
  });
});

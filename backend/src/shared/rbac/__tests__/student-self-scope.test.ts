import { describe, it, expect, vi, beforeEach } from 'vitest';
const redisMock = vi.hoisted(() => ({ get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK'), del: vi.fn() }));
const models = vi.hoisted(() => ({ User: { findById: vi.fn() }, Faculty: { findOne: vi.fn() }, Staff: { findOne: vi.fn() }, Student: { findOne: vi.fn() } }));
vi.mock('../../../config/redis', () => ({ default: redisMock }));
vi.mock('../../../models/User', () => ({ User: models.User }));
vi.mock('../../../models/people/Faculty', () => ({ Faculty: models.Faculty }));
vi.mock('../../../models/people/Staff', () => ({ Staff: models.Staff }));
vi.mock('../../../models/people/Student', () => ({ Student: models.Student }));
import { resolveUserScope } from '../scope-resolver';
import { applyAuthScope } from '../apply-scope';

const lean = (v: unknown) => ({ select: () => ({ lean: () => Promise.resolve(v) }), lean: () => Promise.resolve(v) });
beforeEach(() => { vi.clearAllMocks(); redisMock.get.mockResolvedValue(null); });

describe('student self scope', () => {
  it('resolveUserScope returns studentId for a student', async () => {
    models.User.findById.mockReturnValue(lean({ personId: 'p1' }));
    models.Student.findOne.mockReturnValue(lean({ _id: 'st1' }));
    expect(await resolveUserScope('u1', 'c1', 'student')).toEqual({ personId: 'p1', studentId: 'st1' });
    expect(models.Student.findOne).toHaveBeenCalledWith({ personId: 'p1', collegeId: 'c1' });
  });

  it('applyAuthScope filters studentId fields by the student id, not the person id', () => {
    const filter: Record<string, unknown> = { collegeId: 'c1' };
    applyAuthScope(filter, { departmentOnly: false, selfOnly: true, userId: 'u1', personId: 'p1', studentId: 'st1', resolvedPermissions: [] }, { selfField: 'studentId' });
    expect(filter.studentId).toBe('st1');
  });

  it('applyAuthScope with selfField studentId but no studentId matches nothing', () => {
    const filter: Record<string, unknown> = {};
    applyAuthScope(filter, { departmentOnly: false, selfOnly: true, userId: 'u1', personId: 'p1', resolvedPermissions: [] }, { selfField: 'studentId' });
    expect(filter.studentId).toBeUndefined();
    expect(filter._id).toEqual({ $in: [] });
  });

  it('other selfFields keep the personId behaviour', () => {
    const filter: Record<string, unknown> = {};
    applyAuthScope(filter, { departmentOnly: false, selfOnly: true, userId: 'u1', personId: 'p1', studentId: 'st1', resolvedPermissions: [] }, { selfField: 'personId' });
    expect(filter.personId).toBe('p1');
  });
});

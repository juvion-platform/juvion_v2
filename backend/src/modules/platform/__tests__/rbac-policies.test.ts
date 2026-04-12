import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────

vi.mock('../../../models/platform/Policy', () => {
  const findMock = vi.fn();
  const countMock = vi.fn();
  const findOneMock = vi.fn();
  const findByIdMock = vi.fn();
  const createMock = vi.fn();
  const findOneAndUpdateMock = vi.fn();
  const findOneAndDeleteMock = vi.fn();

  // chainable query helpers
  findMock.mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  });

  return {
    Policy: {
      find: findMock,
      countDocuments: countMock,
      findOne: findOneMock,
      findById: findByIdMock,
      create: createMock,
      findOneAndUpdate: findOneAndUpdateMock,
      findOneAndDelete: findOneAndDeleteMock,
    },
  };
});

vi.mock('../../../shared/rbac/cache', () => ({
  invalidatePolicies: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../shared/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { Policy as RBACPolicy } from '../../../models/platform/Policy';
import { invalidatePolicies } from '../../../shared/rbac/cache';
import { createAuditLog } from '../../../shared/audit';
import {
  listRbacPolicies,
  getRbacPolicy,
  createRbacPolicy,
  deleteRbacPolicy,
} from '../service';

const COLLEGE_ID = '000000000000000000000001';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────

describe('listRbacPolicies', () => {
  it('returns paginated results', async () => {
    const items = [
      { _id: 'p1', role: 'admin', module: 'platform', action: '*', effect: 'allow', priority: 900 },
      { _id: 'p2', role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700 },
    ];
    const lean = vi.fn().mockResolvedValue(items);
    const limitFn = vi.fn().mockReturnValue({ lean });
    const skipFn = vi.fn().mockReturnValue({ limit: limitFn });
    const sortFn = vi.fn().mockReturnValue({ skip: skipFn });
    (RBACPolicy.find as ReturnType<typeof vi.fn>).mockReturnValue({ sort: sortFn });
    (RBACPolicy.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(2);

    const result = await listRbacPolicies(COLLEGE_ID, 1, 20);

    expect(result.items).toEqual(items);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pages).toBe(1);
    expect(RBACPolicy.find).toHaveBeenCalledWith(
      expect.objectContaining({ $or: expect.any(Array) }),
    );
  });
});

describe('getRbacPolicy', () => {
  it('returns a single policy', async () => {
    const doc = { _id: 'p1', role: 'admin', module: 'platform', action: '*', effect: 'allow', priority: 900 };
    (RBACPolicy.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

    const result = await getRbacPolicy(COLLEGE_ID, 'p1');

    expect(result).toEqual(doc);
    expect(RBACPolicy.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'p1', $or: expect.any(Array) }),
    );
  });

  it('throws 404 when policy not found', async () => {
    (RBACPolicy.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(getRbacPolicy(COLLEGE_ID, 'nonexistent')).rejects.toThrow('Policy not found');
  });
});

describe('createRbacPolicy', () => {
  it('creates a policy and invalidates cache', async () => {
    const data = { role: 'faculty', module: 'academics', action: 'read', effect: 'allow', priority: 700 };
    const created = { _id: 'p3', ...data, collegeId: COLLEGE_ID, createdBy: 'TestUser' };
    (RBACPolicy.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await createRbacPolicy(COLLEGE_ID, data, 'TestUser');

    expect(result).toEqual(created);
    expect(RBACPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...data, collegeId: COLLEGE_ID, createdBy: 'TestUser' }),
    );
    expect(invalidatePolicies).toHaveBeenCalledWith(COLLEGE_ID);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        collegeId: COLLEGE_ID,
        entityType: 'RBACPolicy',
        action: 'create',
        performedBy: 'TestUser',
      }),
    );
  });
});

describe('deleteRbacPolicy', () => {
  it('prevents deleting system default policies (createdBy: seed, no collegeId)', async () => {
    const systemPolicy = {
      _id: 'sys1',
      role: 'admin',
      module: 'platform',
      action: '*',
      effect: 'allow',
      priority: 900,
      createdBy: 'seed',
      collegeId: undefined,
    };
    (RBACPolicy.findById as ReturnType<typeof vi.fn>).mockResolvedValue(systemPolicy);

    await expect(deleteRbacPolicy(COLLEGE_ID, 'sys1', 'TestUser')).rejects.toThrow(
      'Cannot delete system default policies',
    );
    expect(RBACPolicy.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('deletes a college-specific policy and invalidates cache', async () => {
    const collegePolicy = {
      _id: 'cp1',
      role: 'faculty',
      module: 'academics',
      action: 'create',
      effect: 'deny',
      priority: 750,
      createdBy: 'AdminUser',
      collegeId: COLLEGE_ID,
    };
    (RBACPolicy.findById as ReturnType<typeof vi.fn>).mockResolvedValue(collegePolicy);
    (RBACPolicy.findOneAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue(collegePolicy);

    const result = await deleteRbacPolicy(COLLEGE_ID, 'cp1', 'TestUser');

    expect(result).toEqual({ message: 'Policy deleted' });
    expect(RBACPolicy.findOneAndDelete).toHaveBeenCalledWith({ _id: 'cp1', collegeId: COLLEGE_ID });
    expect(invalidatePolicies).toHaveBeenCalledWith(COLLEGE_ID);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'RBACPolicy',
        action: 'delete',
        performedBy: 'TestUser',
      }),
    );
  });
});

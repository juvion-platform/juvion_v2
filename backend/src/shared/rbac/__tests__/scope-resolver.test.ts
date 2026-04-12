import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock redis
vi.mock('../../../config/redis', () => ({
  default: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

// Mock models
vi.mock('../../../models/User', () => ({
  User: { findById: vi.fn() },
}));
vi.mock('../../../models/people/Faculty', () => ({
  Faculty: { findOne: vi.fn() },
}));
vi.mock('../../../models/people/Staff', () => ({
  Staff: { findOne: vi.fn() },
}));

import redis from '../../../config/redis';
import { User } from '../../../models/User';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { resolveUserScope, invalidateUserScope } from '../scope-resolver';

const mockRedis = redis as unknown as { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> };
const mockUser = User as unknown as { findById: ReturnType<typeof vi.fn> };
const mockFaculty = Faculty as unknown as { findOne: ReturnType<typeof vi.fn> };
const mockStaff = Staff as unknown as { findOne: ReturnType<typeof vi.fn> };

describe('resolveUserScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached scope when available', async () => {
    const cached = { departmentId: 'dept1', personId: 'person1' };
    mockRedis.get.mockResolvedValue(JSON.stringify(cached));

    const result = await resolveUserScope('u1', 'college1', 'faculty');

    expect(result).toEqual(cached);
    expect(mockUser.findById).not.toHaveBeenCalled();
  });

  it('resolves faculty departmentId from DB on cache miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockUser.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ personId: 'person1' }),
      }),
    });
    mockFaculty.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ departmentId: 'dept1' }),
    });

    const result = await resolveUserScope('u1', 'college1', 'faculty');

    expect(result).toEqual({ personId: 'person1', departmentId: 'dept1' });
    expect(mockUser.findById).toHaveBeenCalledWith('u1');
    expect(mockFaculty.findOne).toHaveBeenCalledWith({ personId: 'person1', collegeId: 'college1' });
    expect(mockRedis.set).toHaveBeenCalledWith(
      'user:scope:u1',
      JSON.stringify({ personId: 'person1', departmentId: 'dept1' }),
      'EX',
      900,
    );
  });

  it('resolves staff departmentId from Staff model', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockUser.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ personId: 'person2' }),
      }),
    });
    mockStaff.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ departmentId: 'dept2' }),
    });

    const result = await resolveUserScope('u2', 'college1', 'staff');

    expect(result).toEqual({ personId: 'person2', departmentId: 'dept2' });
    expect(mockStaff.findOne).toHaveBeenCalledWith({ personId: 'person2', collegeId: 'college1' });
    expect(mockFaculty.findOne).not.toHaveBeenCalled();
  });

  it('resolves hod departmentId from Faculty model', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockUser.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ personId: 'person3' }),
      }),
    });
    mockFaculty.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ departmentId: 'dept3' }),
    });

    const result = await resolveUserScope('u3', 'college1', 'hod');

    expect(result).toEqual({ personId: 'person3', departmentId: 'dept3' });
    expect(mockFaculty.findOne).toHaveBeenCalledWith({ personId: 'person3', collegeId: 'college1' });
  });

  it('returns empty scope when no Faculty/Staff record found', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockUser.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ personId: 'person4' }),
      }),
    });
    mockFaculty.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const result = await resolveUserScope('u4', 'college1', 'faculty');

    expect(result).toEqual({ personId: 'person4' });
    expect(result.departmentId).toBeUndefined();
  });

  it('returns empty scope for roles without Faculty/Staff lookup', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockUser.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ personId: 'person5' }),
      }),
    });

    const result = await resolveUserScope('u5', 'college1', 'student');

    expect(result).toEqual({ personId: 'person5' });
    expect(mockFaculty.findOne).not.toHaveBeenCalled();
    expect(mockStaff.findOne).not.toHaveBeenCalled();
  });

  it('returns empty scope when user has no personId', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockUser.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ personId: null }),
      }),
    });

    const result = await resolveUserScope('u6', 'college1', 'faculty');

    expect(result).toEqual({});
    expect(mockFaculty.findOne).not.toHaveBeenCalled();
  });
});

describe('invalidateUserScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the cached scope key', async () => {
    mockRedis.del.mockResolvedValue(1);

    await invalidateUserScope('u1');

    expect(mockRedis.del).toHaveBeenCalledWith('user:scope:u1');
  });

  it('does not throw on redis error', async () => {
    mockRedis.del.mockRejectedValue(new Error('Redis down'));

    await expect(invalidateUserScope('u1')).resolves.toBeUndefined();
  });
});

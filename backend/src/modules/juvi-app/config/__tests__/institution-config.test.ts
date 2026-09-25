import { describe, it, expect, vi, beforeEach } from 'vitest';

const redisMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));
const collegeMock = vi.hoisted(() => ({ findById: vi.fn(), findOne: vi.fn() }));
vi.mock('../../../../config/redis', () => ({ default: redisMock }));
vi.mock('../../../../models/College', () => ({ College: collegeMock }));

import { getJuviConfig, isJuviEnabled, isVersionBelow, lookupInstitutionByCode } from '../institution-config';

const lean = (v: unknown) => ({ select: () => ({ lean: () => Promise.resolve(v) }), lean: () => Promise.resolve(v) });
const collegeDoc = { _id: 'c1', name: 'JIT', code: 'JIT', status: 'active', logo: 'k', juvi: { enabled: true, paused: false, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata', featureFlags: { languageRoadmap: false } } };

beforeEach(() => { vi.clearAllMocks(); redisMock.get.mockResolvedValue(null); redisMock.set.mockResolvedValue('OK'); });

describe('institution config', () => {
  it('isVersionBelow compares semver-ish strings', () => {
    expect(isVersionBelow('1.0.0', '1.0.1')).toBe(true);
    expect(isVersionBelow('1.2.0', '1.10.0')).toBe(true);
    expect(isVersionBelow('2.0.0', '1.99.99')).toBe(false);
    expect(isVersionBelow('1.0.0', '1.0.0')).toBe(false);
    expect(isVersionBelow('garbage', '1.0.0')).toBe(false);
  });

  it('reads from Mongo on cache miss and writes the cache for 60 s', async () => {
    collegeMock.findById.mockReturnValue(lean(collegeDoc));
    const cfg = await getJuviConfig('c1');
    expect(cfg?.enabled).toBe(true);
    expect(cfg?.name).toBe('JIT');
    expect(redisMock.set).toHaveBeenCalledWith('juvi:cfg:c1', expect.any(String), 'EX', 60);
  });

  it('serves from cache without touching Mongo', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ collegeId: 'c1', enabled: false }));
    const cfg = await getJuviConfig('c1');
    expect(cfg?.enabled).toBe(false);
    expect(collegeMock.findById).not.toHaveBeenCalled();
  });

  it('survives a Redis failure', async () => {
    redisMock.get.mockRejectedValue(new Error('ECONNREFUSED'));
    redisMock.set.mockRejectedValue(new Error('ECONNREFUSED'));
    collegeMock.findById.mockReturnValue(lean(collegeDoc));
    await expect(isJuviEnabled('c1')).resolves.toBe(true);
  });

  it('lookupInstitutionByCode returns null for disabled or inactive colleges', async () => {
    collegeMock.findOne.mockReturnValue(lean({ ...collegeDoc, juvi: { ...collegeDoc.juvi, enabled: false } }));
    expect(await lookupInstitutionByCode('jit')).toBeNull();
    collegeMock.findOne.mockReturnValue(lean({ ...collegeDoc, status: 'suspended' }));
    expect(await lookupInstitutionByCode('JIT')).toBeNull();
    collegeMock.findOne.mockReturnValue(lean(collegeDoc));
    expect((await lookupInstitutionByCode('jit'))?.code).toBe('JIT');
    expect(collegeMock.findOne).toHaveBeenLastCalledWith({ code: 'JIT' });
  });
});

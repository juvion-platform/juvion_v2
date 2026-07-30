import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PolicyDoc } from '../types';

// Mock the engine module — only mock loadPolicies, keep real filterPolicies/sortPolicies
vi.mock('../engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine')>();
  return {
    ...actual,
    loadPolicies: vi.fn(),
  };
});

import { loadPolicies } from '../engine';
import { resolvePermissions } from '../resolve-permissions';

const mockedLoadPolicies = vi.mocked(loadPolicies);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolvePermissions', () => {
  it('returns all module:action pairs for super_admin with wildcard policy', async () => {
    const wildcardPolicy: PolicyDoc = {
      role: 'super_admin',
      module: '*',
      action: '*',
      effect: 'allow',
      priority: 1000,
      isActive: true,
    };
    mockedLoadPolicies.mockResolvedValue([wildcardPolicy]);

    const result = await resolvePermissions('college1', 'super_admin', 'SA');

    // 13 modules x 5 actions = 65 permissions. `approve` joined the CRUD
    // four so the frontend can detect grants on routes that gate on it —
    // re-pin and bulk-pin both do, and while it was unemitted those buttons
    // had to fall back to role checks that disagreed with the backend.
    expect(result).toHaveLength(65);
    expect(result).toContain('admissions:read');
    expect(result).toContain('admissions:create');
    expect(result).toContain('admissions:update');
    expect(result).toContain('admissions:delete');
    expect(result).toContain('juvi:read');
    expect(result).toContain('platform:delete');
    expect(result).toContain('finance:approve');
    expect(mockedLoadPolicies).toHaveBeenCalledTimes(1);
    expect(mockedLoadPolicies).toHaveBeenCalledWith('college1', 'super_admin');
  });

  it('returns only matching module:action pairs for student', async () => {
    const policies: PolicyDoc[] = [
      {
        role: 'student',
        module: 'academics',
        action: 'read',
        effect: 'allow',
        priority: 500,
        isActive: true,
      },
      {
        role: 'student',
        module: 'finance',
        action: 'read',
        effect: 'allow',
        priority: 500,
        isActive: true,
      },
    ];
    mockedLoadPolicies.mockResolvedValue(policies);

    const result = await resolvePermissions('college1', 'student', 'STU');

    expect(result).toHaveLength(2);
    expect(result).toContain('academics:read');
    expect(result).toContain('finance:read');
    expect(result).not.toContain('academics:create');
    expect(result).not.toContain('people:read');
  });

  it('excludes denied permissions', async () => {
    const policies: PolicyDoc[] = [
      {
        role: 'admin',
        module: '*',
        action: '*',
        effect: 'allow',
        priority: 900,
        isActive: true,
      },
      {
        role: 'admin',
        module: 'governance',
        action: 'delete',
        effect: 'deny',
        priority: 950,
        isActive: true,
      },
    ];
    mockedLoadPolicies.mockResolvedValue(policies);

    const result = await resolvePermissions('college1', 'admin', 'ADM');

    // 65 total minus 1 denied = 64
    expect(result).toHaveLength(64);
    expect(result).toContain('governance:read');
    expect(result).toContain('governance:create');
    expect(result).toContain('governance:update');
    expect(result).not.toContain('governance:delete');
  });

  it('respects personaType filtering', async () => {
    const policies: PolicyDoc[] = [
      {
        role: 'faculty',
        module: 'academics',
        action: 'read',
        effect: 'allow',
        priority: 700,
        isActive: true,
      },
      {
        role: 'faculty',
        personaType: 'F-HOD-*',
        module: 'academics',
        action: 'update',
        effect: 'allow',
        priority: 800,
        isActive: true,
      },
    ];
    mockedLoadPolicies.mockResolvedValue(policies);

    // HOD persona gets both base + personaType-specific
    const hodResult = await resolvePermissions('college1', 'faculty', 'F-HOD-CSE');
    expect(hodResult).toContain('academics:read');
    expect(hodResult).toContain('academics:update');

    mockedLoadPolicies.mockResolvedValue(policies);

    // Regular faculty gets only the base policy (no personaType restriction)
    const facResult = await resolvePermissions('college1', 'faculty', 'F-FAC');
    expect(facResult).toContain('academics:read');
    expect(facResult).not.toContain('academics:update');
  });
});

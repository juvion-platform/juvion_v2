import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';

/** 010 — permission strings may be sub-domain qualified (`academics/exams:create`). */
describe('authStore.hasPermission', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: ['finance:read', 'academics/exams:create', 'academics/results:create', 'people:read'] });
  });
  const can = (m: string, a: string, s?: string) => useAuthStore.getState().hasPermission(m, a, s);

  it('matches plain module:action', () => {
    expect(can('finance', 'read')).toBe(true);
    expect(can('finance', 'create')).toBe(false);
    expect(can('hr', 'read')).toBe(false);
  });
  it('a qualified grant opens the module when no sub-domain is asked for', () => {
    expect(can('academics', 'create')).toBe(true);
    expect(can('academics', 'read')).toBe(false);
  });
  it('with a sub-domain asked for, only that sub-domain counts', () => {
    expect(can('academics', 'create', 'exams')).toBe(true);
    expect(can('academics', 'create', 'attendance')).toBe(false);
  });
  it('a full module grant satisfies any sub-domain', () => {
    useAuthStore.setState({ permissions: ['academics:create'] });
    expect(can('academics', 'create', 'attendance')).toBe(true);
  });
  it('wildcards still work', () => {
    useAuthStore.setState({ permissions: ['*:*'] });
    expect(can('anything', 'delete', 'x')).toBe(true);
  });
});

/** 010 P3 — sensitivity classes: null/missing module = unrestricted, list = only those. */
describe('authStore.canSeeClass', () => {
  beforeEach(() => {
    useAuthStore.setState({ sensitivity: { hr: [], people: ['people.identity'], welfare: null } });
  });
  const can = (m: string, c: string) => useAuthStore.getState().canSeeClass(m, c);

  it('an empty list hides every class in that module', () => {
    expect(can('hr', 'hr.compensation')).toBe(false);
  });
  it('a list grants only the named classes', () => {
    expect(can('people', 'people.identity')).toBe(true);
    expect(can('people', 'people.other')).toBe(false);
  });
  it('null or a missing module is unrestricted', () => {
    expect(can('welfare', 'welfare.medical')).toBe(true);
    expect(can('finance', 'finance.bank')).toBe(true);
  });
  it('hides people.identity when people sensitivity is empty array (HOD, Faculty, Accounts)', () => {
    useAuthStore.setState({ sensitivity: { people: [] } });
    expect(can('people', 'people.identity')).toBe(false);
  });
});

describe('authStore user persona fields', () => {
  it('stores accessibleModules, dashboardWidgets, and primaryModule on user', () => {
    useAuthStore.getState().setAuth(
      {
        id: 'u1',
        email: 'acc@jit.edu.in',
        name: 'Accounts User',
        role: 'staff',
        personaType: 'ST-ACC',
        primaryModule: 'finance',
        dashboardWidgets: ['finance-kpi', 'finance-card'],
        accessibleModules: ['finance'],
      },
      'token-123',
      'c1',
    );
    const user = useAuthStore.getState().user;
    expect(user?.primaryModule).toBe('finance');
    expect(user?.dashboardWidgets).toEqual(['finance-kpi', 'finance-card']);
    expect(user?.accessibleModules).toEqual(['finance']);
  });
});


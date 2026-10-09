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

describe('authStore college accent', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, collegeAccent: null });
  });

  // Fix 2 — `collegeAccent` is seeded from localStorage at store construction, so
  // the tokenless boot is the one path that could leave an accent with no session
  // behind it. It must clear both halves.
  it('drops a cached accent when there is no token to back it', async () => {
    localStorage.setItem('collegeAccent', '#7A1FA2');
    useAuthStore.setState({ collegeAccent: '#7A1FA2' });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().collegeAccent).toBeNull();
    expect(localStorage.getItem('collegeAccent')).toBeNull();
  });

  // Fix 1 — `''` used to reach the store verbatim (`'' ?? null === ''`) while
  // localStorage had the key removed. Both halves must read as the same absent
  // state, so each case asserts both.
  it('an empty accent lands as null in the store and absent in localStorage (setAuth)', () => {
    useAuthStore.getState().setAuth(
      { id: 'u1', name: 'Admin', email: 'a@jit.edu.in', role: 'admin', personaType: 'L-PRIN' },
      'token-1', 'c1', undefined, undefined, undefined, '',
    );
    expect(localStorage.getItem('collegeAccent')).toBeNull();
    expect(useAuthStore.getState().collegeAccent).toBeNull();
  });

  it('an empty accent lands as null in the store and absent in localStorage (selectCollege)', () => {
    useAuthStore.getState().selectCollege('c1', 'College', '');
    expect(localStorage.getItem('collegeAccent')).toBeNull();
    expect(useAuthStore.getState().collegeAccent).toBeNull();
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


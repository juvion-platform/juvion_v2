import { describe, it, expect } from 'vitest';
import { IAudienceRule } from '../../../../models/juvi/Notice';
import { assertAudienceInScope, narrowToScope, allowedTargets, PublisherScope } from '../scope';
import { graphFixture } from './graph-fixture';

const g = graphFixture();
const r = (kind: IAudienceRule['kind'], list: string[] = [], departmentId?: string): IAudienceRule => ({ kind, ids: list, ...(departmentId ? { departmentId } : {}) });
const scope = (p: Partial<PublisherScope>): PublisherScope => ({ kind: 'none', userId: 'u', office: 'X', isAdmin: false, offeringIds: [], ...p });

const college = scope({ kind: 'college', office: 'Exam Section' });
const hod = scope({ kind: 'department', departmentId: 'cse', office: 'HOD, Computer Science' });
const faculty = scope({ kind: 'offerings', offeringIds: ['o1'], office: 'Course Faculty' });
const nobody = scope({ kind: 'none' });

const ok = (s: PublisherScope, rules: IAudienceRule[]) => expect(() => assertAudienceInScope(s, rules, g)).not.toThrow();
const refused = (s: PublisherScope, rules: IAudienceRule[], msg?: RegExp) => {
  let caught: unknown;
  try { assertAudienceInScope(s, rules, g); } catch (e) { caught = e; }
  expect(caught).toMatchObject({ statusCode: 403 });
  if (msg) expect((caught as Error).message).toMatch(msg);
};

describe('assertAudienceInScope — admin, principal and staff offices', () => {
  it('allow every rule kind', () => {
    ok(college, [r('all')]);
    ok(college, [r('role', ['student']), r('department', ['ece']), r('programme', ['btech']), r('batch', ['b24']), r('section', ['sB']), r('course_offering', ['o2']), r('hostel_block', ['h1']), r('custom', ['s2'])]);
  });
});

describe('assertAudienceInScope — HOD', () => {
  it('allows the own department, its sections, courses, a whole-department batch, a pinned role and own people', () => {
    ok(hod, [r('department', ['cse'])]);
    ok(hod, [r('section', ['sA', 'sC'])]);
    ok(hod, [r('course_offering', ['o1', 'o3'])]);
    ok(hod, [r('batch', ['b23'])]);                       // every b23 student is in CSE
    ok(hod, [r('role', ['faculty'], 'cse')]);
    ok(hod, [r('custom', ['s1', 'f1', 'st2'])]);
  });

  it('refuses another department, a mixed batch, an unpinned role, outside people and college-wide kinds', () => {
    refused(hod, [r('department', ['ece'])], /own department/);
    refused(hod, [r('section', ['sB'])], /outside your department/);
    refused(hod, [r('course_offering', ['o2'])], /outside your department/);
    refused(hod, [r('batch', ['b24'])], /sections instead/);  // b24 includes ECE students
    refused(hod, [r('batch', ['unknown'])]);
    refused(hod, [r('role', ['faculty'])], /within your department/);
    refused(hod, [r('role', ['faculty'], 'ece')]);
    refused(hod, [r('custom', ['s1', 's2'])], /outside your department/);
    refused(hod, [r('all')]);
    refused(hod, [r('programme', ['btech'])]);
    refused(hod, [r('hostel_block', ['h1'])]);
  });

  it('checks every rule, not just the first', () => {
    refused(hod, [r('department', ['cse']), r('section', ['sB'])]);
  });
});

describe('assertAudienceInScope — teaching faculty', () => {
  it('allows own course offerings and people enrolled in them', () => {
    ok(faculty, [r('course_offering', ['o1'])]);
    ok(faculty, [r('custom', ['s1'])]);
  });

  it('refuses other offerings, other people and every other kind', () => {
    refused(faculty, [r('course_offering', ['o1', 'o3'])], /courses you teach/);
    refused(faculty, [r('custom', ['s3'])], /not enrolled in your courses/);
    refused(faculty, [r('custom', ['f2'])]);
    refused(faculty, [r('section', ['sA'])]);
    refused(faculty, [r('department', ['cse'])]);
    refused(faculty, [r('all')]);
  });

  it('refuses role, programme, batch and hostel_block rules', () => {
    refused(faculty, [r('role', ['faculty'])]);
    refused(faculty, [r('programme', ['btech'])]);
    refused(faculty, [r('batch', ['b24'])]);
    refused(faculty, [r('hostel_block', ['h1'])]);
  });
});

describe('assertAudienceInScope — anyone else', () => {
  it('refuses everything', () => {
    refused(nobody, [r('custom', ['s1'])], /cannot publish/);
    refused(nobody, [r('all')]);
  });
});

describe('assertAudienceInScope — empty ids never pass vacuously', () => {
  const kinds: IAudienceRule['kind'][] = ['department', 'section', 'course_offering', 'batch', 'custom'];

  it('HOD scope refuses every kind with an empty ids list', () => {
    for (const kind of kinds) refused(hod, [r(kind, [])]);
  });

  it('faculty scope refuses every kind with an empty ids list', () => {
    for (const kind of kinds) refused(faculty, [r(kind, [])]);
  });
});

describe('assertAudienceInScope — unknown rule kind', () => {
  const garbage: IAudienceRule = { kind: 'nonsense' as IAudienceRule['kind'], ids: ['s1'] };

  it('college allows it unconditionally, same as any other kind (resolveAudience separately resolves it to nobody)', () => {
    ok(college, [garbage]);
  });

  it('HOD, faculty and anyone-else scopes refuse it', () => {
    refused(hod, [garbage]);
    refused(faculty, [garbage]);
    refused(nobody, [garbage]);
  });
});

describe('narrowToScope composed with assertAudienceInScope', () => {
  it('an HOD role rule without departmentId is refused directly, but passes once narrowed', () => {
    const rules = [r('role', ['faculty'])];
    refused(hod, rules, /within your department/);
    ok(hod, narrowToScope(hod, rules));
  });
});

describe('narrowToScope', () => {
  it('pins an HOD role rule to the own department and leaves everything else untouched', () => {
    const rules = [r('role', ['faculty']), r('section', ['sA'])];
    expect(narrowToScope(hod, rules)).toEqual([r('role', ['faculty'], 'cse'), r('section', ['sA'])]);
    expect(rules[0]).toEqual(r('role', ['faculty']));   // not mutated
    expect(narrowToScope(college, rules)).toEqual(rules);
    expect(narrowToScope(faculty, rules)).toEqual(rules);
  });
});

describe('allowedTargets', () => {
  it('offers the whole college to an office', () => {
    const t = allowedTargets(college, g);
    expect(t.kinds).toEqual(['all', 'role', 'department', 'programme', 'batch', 'section', 'course_offering', 'hostel_block', 'custom']);
    expect(t.roles).toEqual(['student', 'faculty', 'staff', 'hod']);
    expect(t.departments.map((d) => d.id)).toEqual(['cse', 'ece']);
    expect(t.batches).toEqual([{ id: 'b23', label: '2023 Batch' }, { id: 'b24', label: '2024 Batch' }]);
    expect(t.sections.map((s) => s.label)).toEqual(['2023 Batch · Section C', '2024 Batch · Section A', '2024 Batch · Section B']);
    expect(t.courseOfferings).toHaveLength(3);
    expect(t.hostelBlocks).toEqual([{ id: 'h1', label: 'Krishna' }]);
  });

  it('offers an HOD only the own department', () => {
    const t = allowedTargets(hod, g);
    expect(t.kinds).toEqual(['role', 'department', 'batch', 'section', 'course_offering', 'custom']);
    expect(t.roles).toEqual(['student', 'faculty', 'staff']);
    expect(t.departments).toEqual([{ id: 'cse', label: 'Computer Science' }]);
    expect(t.batches.map((b) => b.id)).toEqual(['b23']);
    expect(t.sections.map((s) => s.id)).toEqual(['sC', 'sA']);
    expect(t.courseOfferings.map((o) => o.id)).toEqual(['o1', 'o3']);
    expect(t.programmes).toEqual([]);
    expect(t.hostelBlocks).toEqual([]);
  });

  it('offers teaching faculty only their offerings, and nobody nothing', () => {
    expect(allowedTargets(faculty, g)).toMatchObject({ kinds: ['course_offering', 'custom'], roles: [], courseOfferings: [{ id: 'o1', label: 'CS201 · A' }], departments: [] });
    expect(allowedTargets(nobody, g)).toMatchObject({ kinds: [], courseOfferings: [], departments: [] });
  });
});

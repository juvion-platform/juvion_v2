import { describe, it, expect } from 'vitest';
import { IAudienceRule } from '../../../../models/juvi/Notice';
import { resolveAudience, personMatchesRules, ruleChannelRefs, audienceLine, groupLabel } from '../audience';
import { graphFixture, ids } from './graph-fixture';

const g = graphFixture();
const r = (kind: IAudienceRule['kind'], list: string[] = [], departmentId?: string): IAudienceRule => ({ kind, ids: list, ...(departmentId ? { departmentId } : {}) });

describe('resolveAudience — one rule of each kind', () => {
  it('all reaches every student, faculty member and staff member', () => {
    expect(ids(resolveAudience([r('all')], g))).toEqual(['f1', 'f2', 'hod1', 's1', 's2', 's3', 'st1', 'st2']);
  });

  it('role resolves role words through account kind and hod, and persona codes through the persona chain', () => {
    expect(ids(resolveAudience([r('role', ['student'])], g))).toEqual(['s1', 's2', 's3']);
    expect(ids(resolveAudience([r('role', ['faculty'])], g))).toEqual(['f1', 'f2', 'hod1']);
    expect(ids(resolveAudience([r('role', ['staff'])], g))).toEqual(['st1', 'st2']);
    expect(ids(resolveAudience([r('role', ['hod'])], g))).toEqual(['hod1']);
    expect(ids(resolveAudience([r('role', ['ST-EXAM'])], g))).toEqual(['st1']);
    // ST-ADM matches its sub-persona ST-ADM-TC; ST-AD is not a family prefix.
    expect(ids(resolveAudience([r('role', ['ST-ADM'])], g))).toEqual(['st2']);
    expect(ids(resolveAudience([r('role', ['ST-AD'])], g))).toEqual([]);
  });

  it('a role rule with departmentId stays inside that department', () => {
    expect(ids(resolveAudience([r('role', ['faculty'], 'cse')], g))).toEqual(['f1', 'hod1']);
    expect(ids(resolveAudience([r('role', ['student', 'staff'], 'cse')], g))).toEqual(['s1', 's3', 'st2']);
  });

  it('department reaches its students, faculty and staff', () => {
    expect(ids(resolveAudience([r('department', ['cse'])], g))).toEqual(['f1', 'hod1', 's1', 's3', 'st2']);
  });

  it('programme resolves through the student batches', () => {
    expect(ids(resolveAudience([r('programme', ['btech'])], g))).toEqual(['s1', 's2', 's3']);
    expect(ids(resolveAudience([r('programme', ['mtech'])], g))).toEqual([]);
  });

  it('batch, section, course offering and hostel block reach students only', () => {
    expect(ids(resolveAudience([r('batch', ['b24'])], g))).toEqual(['s1', 's2']);
    expect(ids(resolveAudience([r('section', ['sC'])], g))).toEqual(['s3']);
    expect(ids(resolveAudience([r('course_offering', ['o1'])], g))).toEqual(['s1']);
    expect(ids(resolveAudience([r('course_offering', ['o3'])], g))).toEqual(['s3']);
    expect(ids(resolveAudience([r('hostel_block', ['h1'])], g))).toEqual(['s1']);
  });

  it('custom is an explicit list of person ids; unknown ids are ignored', () => {
    expect(ids(resolveAudience([r('custom', ['s2', 'st1', 'nobody'])], g))).toEqual(['s2', 'st1']);
  });
});

describe('resolveAudience — union', () => {
  it('unions rules and lists each person once', () => {
    const out = resolveAudience([r('batch', ['b24']), r('section', ['sA']), r('custom', ['s1', 'f2']), r('role', ['hod'])], g);
    expect(ids(out)).toEqual(['f2', 'hod1', 's1', 's2']);
    expect(new Set(ids(out)).size).toBe(out.length);
  });

  it('carries the account (or null for Not on Juvi) and the frozen labels', () => {
    const [s1, s2] = resolveAudience([r('batch', ['b24'])], g);
    expect(s1).toMatchObject({ personId: 's1', accountId: 'a1', labels: { batch: '2024 Batch', section: 'A', department: 'Computer Science' } });
    expect(s2).toMatchObject({ personId: 's2', accountId: null });
  });

  it('personMatchesRules answers the same question for one person', () => {
    const s3 = g.people.get('s3')!;
    expect(personMatchesRules([r('batch', ['b24']), r('section', ['sC'])], s3, g)).toBe(true);
    expect(personMatchesRules([r('batch', ['b24'])], s3, g)).toBe(false);
  });
});

describe('ruleChannelRefs', () => {
  it('maps all, department, batch, course_offering and hostel_block to channels and the rest to none', () => {
    expect(ruleChannelRefs([
      r('all'), r('department', ['cse']), r('batch', ['b24', 'b23']), r('course_offering', ['o1']), r('hostel_block', ['h1']),
      r('role', ['student']), r('programme', ['btech']), r('section', ['sA']), r('custom', ['s1']),
    ])).toEqual([
      { scopeType: 'college', scopeId: null },
      { scopeType: 'department', scopeId: 'cse' },
      { scopeType: 'batch', scopeId: 'b24' },
      { scopeType: 'batch', scopeId: 'b23' },
      { scopeType: 'course_offering', scopeId: 'o1' },
      { scopeType: 'hostel_block', scopeId: 'h1' },
    ]);
  });

  it('deduplicates repeated targets', () => {
    expect(ruleChannelRefs([r('batch', ['b24']), r('batch', ['b24'])])).toHaveLength(1);
  });
});

describe('audienceLine', () => {
  it('renders one target, several targets, and more than three', () => {
    expect(audienceLine([r('batch', ['b24'])], g)).toBe('Sent to 2024 Batch');
    expect(audienceLine([r('all')], g)).toBe('Sent to everyone at JIT');
    expect(audienceLine([r('department', ['cse']), r('section', ['sB'])], g)).toBe('Sent to Computer Science department and 2024 Batch section B');
    expect(audienceLine([r('role', ['faculty'], 'cse')], g)).toBe('Sent to faculty in Computer Science');
    expect(audienceLine([r('custom', ['s1'])], g)).toBe('Sent to 1 selected person');
    expect(audienceLine([r('course_offering', ['o1', 'o2', 'o3']), r('hostel_block', ['h1'])], g)).toBe('Sent to CS201 · A, EC201 · B and 2 more');
  });
});

describe('groupLabel', () => {
  it('groups students by batch and section, faculty and staff by department', () => {
    expect(groupLabel('student', { batch: '2024 Batch', section: 'A' })).toBe('2024 Batch · Section A');
    expect(groupLabel('student', { batch: '2024 Batch' })).toBe('2024 Batch');
    expect(groupLabel('student', {})).toBe('Students without a batch');
    expect(groupLabel('faculty', { department: 'Computer Science' })).toBe('Faculty · Computer Science');
    expect(groupLabel('staff', {})).toBe('Staff');
  });
});

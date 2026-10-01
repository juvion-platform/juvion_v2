import { describe, it, expect } from 'vitest';
import { customCandidates } from '../people-search';
import { assertAudienceInScope, PublisherScope } from '../scope';
import { graphFixture, ids } from './graph-fixture';

const g = graphFixture();
const scope = (p: Partial<PublisherScope>): PublisherScope => ({ kind: 'none', userId: 'u', office: 'X', isAdmin: false, offeringIds: [], ...p });

describe('customCandidates (the composer\'s People picker)', () => {
  it('offers college offices everyone', () => {
    expect(ids(customCandidates(scope({ kind: 'college' }), g)).sort()).toEqual(['f1', 'f2', 'hod1', 's1', 's2', 's3', 'st1', 'st2']);
  });

  it('offers an HOD only people in their department', () => {
    expect(ids(customCandidates(scope({ kind: 'department', departmentId: 'cse' }), g)).sort()).toEqual(['f1', 'hod1', 's1', 's3', 'st2']);
    expect(customCandidates(scope({ kind: 'department' }), g)).toEqual([]);
  });

  it('offers teaching faculty only students enrolled in the offerings they teach', () => {
    expect(ids(customCandidates(scope({ kind: 'offerings', offeringIds: ['o1'] }), g))).toEqual(['s1']);
  });

  it('offers nobody to anyone else', () => {
    expect(customCandidates(scope({ kind: 'none' }), g)).toEqual([]);
  });

  it('never offers a person the publish scope check would refuse', () => {
    for (const s of [scope({ kind: 'department', departmentId: 'cse' }), scope({ kind: 'offerings', offeringIds: ['o1', 'o3'] })]) {
      const people = ids(customCandidates(s, g));
      expect(people.length).toBeGreaterThan(0);
      expect(() => assertAudienceInScope(s, [{ kind: 'custom', ids: people }], g)).not.toThrow();
    }
  });
});

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { College, type ICollege } from '../../../models/College';
import { clearCollections, setupMongo, teardownMongo } from '../../../__tests__/helpers/mongoMemory';
import { createTestUser } from '../../../__e2e__/factories/user.factory';
import { getMe } from '../service';

let codeCounter = 0;
function makeCollege(overrides: Partial<ICollege> = {}): Partial<ICollege> {
  codeCounter += 1;
  return {
    name: 'Test Institute',
    code: `TI${String(codeCounter).padStart(4, '0')}`,
    contactEmail: 'admin@test-college.dev',
    contactPhone: '+91-9000000000',
    address: { line1: '1 Test Road', city: 'Test City', state: 'Test State', pincode: '500001' },
    ...overrides,
  };
}

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); }, 30_000);
afterEach(async () => { await clearCollections(); });

describe('getMe college branding', () => {
  it('carries the college accent so the portal can theme itself', async () => {
    const college = await College.create(makeCollege({ juvi: { accentColor: '#0B5FA5' } as never }));
    const { user } = await createTestUser({
      collegeId: String(college._id), role: 'admin', personaType: 'L-PRIN',
      name: 'A', email: 'a@test.local',
    });

    const result = await getMe(String(user._id));

    expect(result.college).toEqual({
      id: String(college._id),
      name: 'Test Institute',
      code: college.code,
      logo: undefined,
      accentColor: '#0B5FA5',
    });
  });

  it('reports a null accent rather than omitting the key when none is set', async () => {
    const college = await College.create(makeCollege());
    const { user } = await createTestUser({
      collegeId: String(college._id), role: 'admin', personaType: 'L-PRIN',
      name: 'B', email: 'b@test.local',
    });

    const result = await getMe(String(user._id));
    expect(result.college?.accentColor).toBeNull();
  });

  // Review Focus 4 — a superadmin who has not chosen a college yet.
  it('returns null college for a superadmin with no resolved college', async () => {
    const { user } = await createTestUser({
      role: 'super_admin', personaType: 'L-PRIN', name: 'C', email: 'c@test.local',
    });

    const result = await getMe(String(user._id));
    expect(result.college).toBeNull();
  });

  // Success criterion 3, backend half: a superadmin has no college of their own,
  // so the one they selected in the portal (x-college-id -> req.collegeId) supplies
  // the branding.
  it('uses the selected college for a superadmin who has one', async () => {
    const college = await College.create(makeCollege({ juvi: { accentColor: '#7A1FA2' } as never }));
    const { user } = await createTestUser({
      role: 'super_admin', personaType: 'L-PRIN', name: 'E', email: 'e@test.local',
    });

    const result = await getMe(String(user._id), String(college._id));
    expect(result.college?.accentColor).toBe('#7A1FA2');
  });

  it('returns null college when the id resolves to nothing', async () => {
    const { Types } = await import('mongoose');
    const { user } = await createTestUser({
      collegeId: String(new Types.ObjectId()), role: 'admin', personaType: 'L-PRIN',
      name: 'D', email: 'd@test.local',
    });

    const result = await getMe(String(user._id), 'not-an-object-id');
    expect(result.college).toBeNull();
  });
});

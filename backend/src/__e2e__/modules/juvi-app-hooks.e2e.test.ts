import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi } from '../factories/juvi.factory';
import { createFaculty } from '../../modules/people/service';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { JuviProvisionedCredential } from '../../models/juvi/JuviProvisionedCredential';
import { User } from '../../models/User';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

const facultyPayload = (n: number) => ({ name: `Hook Faculty ${n}`, phone: `93000000${n}${n}`, email: `hook${n}@test.com`, employeeCode: `HK${n}`, designation: 'Assistant Professor', departmentId: String(fx.cse._id) });

describe('createFaculty hook', () => {
  it('provisions a Juvi account with a stored credential when Juvi is enabled', async () => {
    await enableJuvi(fx.collegeId);
    const f = await createFaculty(fx.collegeId, facultyPayload(1), 'hr');
    const account = await JuviAccount.findOne({ collegeId: fx.collegeId, personId: f.personId }).lean();
    expect(account).toMatchObject({ kind: 'faculty', status: 'onboarding' });
    expect(account?.transitions[0]).toMatchObject({ source: 'workflow', by: 'hr' });
    expect((await User.findById(account!.userId).lean())?.mustChangePassword).toBe(true);
    expect(await JuviProvisionedCredential.countDocuments({ accountId: account!._id, source: 'workflow' })).toBe(1);
  });

  it('does nothing when Juvi is disabled', async () => {
    const f = await createFaculty(fx.collegeId, facultyPayload(2), 'hr');
    expect(await JuviAccount.countDocuments({ personId: f.personId })).toBe(0);
    expect(await User.countDocuments({ personId: f.personId })).toBe(0);
  });
});

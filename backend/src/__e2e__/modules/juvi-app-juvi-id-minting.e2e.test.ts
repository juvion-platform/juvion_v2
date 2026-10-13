import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { provisionTestStudent } from '../factories/juvi.factory';
import { createTestStudent } from '../factories/student.factory';
import { provisionPerson } from '../../modules/juvi-app/accounts/provisioning-service';
import { CANONICAL_JUVI_ID } from '../../modules/juvi-app/accounts/juvi-id';
import { User } from '../../models/User';

let fx: BaseFixtures;

function provisionStudentOf(personId: string, extra: Record<string, unknown> = {}) {
  return provisionPerson({ collegeId: fx.collegeId, personId, kind: 'student', source: 'admin', performedBy: 'test', ...extra });
}

describe('Juvi ID minting', () => {
  beforeAll(async () => { await getTestApp(); });
  beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
  afterAll(async () => { await cleanupTestApp(); });

  it('mints a canonical Juvi ID on the account user', async () => {
    const s = await provisionTestStudent(fx);
    expect(s.juviId).toMatch(CANONICAL_JUVI_ID);
  });

  it('gives two accounts different IDs', async () => {
    const a = await provisionTestStudent(fx);
    const b = await provisionTestStudent(fx);
    expect(a.juviId).not.toBe(b.juviId);
  });

  it('repairs a user whose ID was erased, and is stable once repaired', async () => {
    const s = await provisionTestStudent(fx);
    await User.updateOne({ _id: s.account.userId, collegeId: fx.collegeId }, { $unset: { juviId: 1 } });

    const again = await provisionStudentOf(String(s.person._id));
    expect(again.created).toBe(false);
    const repaired = (await User.findById(s.account.userId).select('juviId').lean())?.juviId;
    expect(repaired).toBeDefined();
    expect(CANONICAL_JUVI_ID.test(repaired!)).toBe(true);

    await provisionStudentOf(String(s.person._id));
    expect((await User.findById(s.account.userId).select('juviId').lean())?.juviId).toBe(repaired);
  });

  it('honours a juviId override, normalising it', async () => {
    const s = await createTestStudent(fx.collegeId, {
      batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id), programmeId: String(fx.btech._id),
    });
    const { account } = await provisionStudentOf(String(s.person._id), { juviId: 'juv-4k7p-2m9x' });
    expect((await User.findById(account.userId).select('juviId').lean())?.juviId).toBe('JUV4K7P2M9X');
  });

  it('rejects an override that cannot be a Juvi ID', async () => {
    const s = await createTestStudent(fx.collegeId, {
      batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id), programmeId: String(fx.btech._id),
    });
    await expect(provisionStudentOf(String(s.person._id), { juviId: '21CS1042' })).rejects.toThrow(/JUV-4K7P-2M9X/);
  });
});

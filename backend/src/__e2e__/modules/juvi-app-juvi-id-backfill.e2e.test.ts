import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, provisionTestFaculty } from '../factories/juvi.factory';
import { User } from '../../models/User';
import { backfillJuviIds } from '../../scripts/backfill-juvi-ids';
import { CANONICAL_JUVI_ID } from '../../modules/juvi-app/accounts/juvi-id';

let fx: BaseFixtures;
// The DB must be connected before seedBase; this test makes no HTTP calls.
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

/** Provision as usual, then strip the ID the way a pre-change account looks. */
async function provisionWithoutId(kind: 'student' | 'faculty') {
  const fixture = kind === 'student' ? await provisionTestStudent(fx) : await provisionTestFaculty(fx);
  await User.updateOne({ collegeId: fx.collegeId, _id: fixture.account.userId }, { $unset: { juviId: 1 } });
  return fixture;
}

async function idOf(userId: unknown): Promise<string | null> {
  const u = await User.findOne({ collegeId: fx.collegeId, _id: userId }).select('juviId').lean();
  return u?.juviId ?? null;
}

describe('backfillJuviIds', () => {
  it('mints what is missing and reports the count', async () => {
    const a = await provisionWithoutId('student');
    const b = await provisionWithoutId('faculty');
    expect(await idOf(a.account.userId)).toBeNull();

    const r = await backfillJuviIds();
    expect(r).toEqual({ scanned: 2, minted: 2, skipped: 0, failed: 0 });

    const ids = [await idOf(a.account.userId), await idOf(b.account.userId)];
    for (const id of ids) expect(id).toMatch(CANONICAL_JUVI_ID);
    expect(ids[0]).not.toBe(ids[1]);
  });

  // §4: minted once, never re-minted. A satisfied row keeps the ID it has.
  it('skips rows that already hold an ID and leaves them untouched', async () => {
    const satisfied = await provisionTestStudent(fx);
    const missing = await provisionWithoutId('student');

    const r = await backfillJuviIds();
    expect(r).toEqual({ scanned: 2, minted: 1, skipped: 1, failed: 0 });
    expect(await idOf(satisfied.account.userId)).toBe(satisfied.juviId);
    expect(await idOf(missing.account.userId)).toMatch(CANONICAL_JUVI_ID);
  });

  it('is re-runnable with no effect the second time', async () => {
    const s = await provisionWithoutId('student');
    await backfillJuviIds();
    const minted = await idOf(s.account.userId);

    const again = await backfillJuviIds();
    expect(again).toEqual({ scanned: 1, minted: 0, skipped: 1, failed: 0 });
    expect(await idOf(s.account.userId)).toBe(minted);
  });

  // One orphaned row must not deny everyone after it an ID — the run reports it and carries on.
  it('counts an account whose User is gone as failed and still mints the rest', async () => {
    const orphan = await provisionWithoutId('student');
    await User.deleteOne({ collegeId: fx.collegeId, _id: orphan.account.userId });
    const healthy = await provisionWithoutId('faculty');

    const r = await backfillJuviIds();
    expect(r).toMatchObject({ scanned: 2, minted: 1, failed: 1 });
    expect(await idOf(healthy.account.userId)).toMatch(CANONICAL_JUVI_ID);
  });
});

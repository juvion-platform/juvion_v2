import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { User } from '../../models/User';
import { ensureJuviIdIndex } from '../../scripts/ensure-juvi-id-index';

const DUPLICATE_KEY = 11000;
let fx: BaseFixtures;

function newUser(fields: Record<string, unknown> = {}) {
  return {
    collegeId: new mongoose.Types.ObjectId(fx.collegeId),
    email: `${new mongoose.Types.ObjectId().toString()}@x.test`,
    password: 'x',
    name: 'Test User',
    role: 'student',
    ...fields,
  };
}

describe('User.juviId index', () => {
  beforeAll(async () => { await getTestApp(); });
  beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
  afterAll(async () => { await cleanupTestApp(); });

  it('rejects a second User with the same juviId', async () => {
    await User.create(newUser({ juviId: 'JUV4K7P2M9X' }));
    await expect(User.create(newUser({ juviId: 'JUV4K7P2M9X' }))).rejects.toMatchObject({ code: DUPLICATE_KEY });
  });

  it('is global, not per-college — the same id in another college is still a duplicate', async () => {
    await User.create(newUser({ juviId: 'JUV4K7P2M9X' }));
    await expect(
      User.create(newUser({ collegeId: new mongoose.Types.ObjectId(), juviId: 'JUV4K7P2M9X' })),
    ).rejects.toMatchObject({ code: DUPLICATE_KEY });
  });

  it('leaves every User without a juviId out of the index entirely', async () => {
    await User.create(newUser());
    await User.create(newUser());
    await User.create({ email: 'root@x.test', password: 'x', name: 'Super', role: 'super_admin' });
    await User.create(newUser({ juviId: null }));
    // Scoped to this file's own fixtures (`@x.test`): seedBase() also creates three
    // Users (super@test.com, admin@test.com, principal@test.com) with no juviId, and
    // the assertion is about the three this test created, not the seed's.
    expect(
      await User.countDocuments({ juviId: { $exists: false }, email: /@x\.test$/ }),
    ).toBe(3);
  });

  it('recreates a dropped index, and is a no-op once it is in place', async () => {
    const collection = mongoose.connection.collection('users');
    await collection.dropIndex('juviId_1');
    expect(await ensureJuviIdIndex()).toEqual({ action: 'created' });
    const names = (await collection.indexes()).map((i) => i.name);
    expect(names).toContain('juviId_1');
    expect(await ensureJuviIdIndex()).toEqual({ action: 'already-correct' });
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';

import { User } from '../../models/User';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';
import { DEFAULT_POLICIES } from '../../shared/rbac/defaults';
import {
  E2E_USER_DEFINITIONS,
  E2E_TEST_PASSWORD,
  seedE2EUsers,
} from '../seed-e2e-users';

/**
 * Tests for `seed-e2e-users.ts` (Playwright E2E spec — Phase A, T2).
 *
 * The script is a CI/developer fixture, so the test surface is small:
 *   1. After one run, the three test users exist with the right shape.
 *   2. Password is stored as a bcrypt hash, not plaintext.
 *   3. Re-running the script is safe (idempotent — no unique-index
 *      collision, no duplicate rows).
 *   4. `super_admin` row has no collegeId; principal row has the
 *      expected one.
 */
describe('seed-e2e-users', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('exports the three expected user definitions', () => {
    expect(E2E_USER_DEFINITIONS).toHaveLength(3);
    const emails = E2E_USER_DEFINITIONS.map((u) => u.email).sort();
    expect(emails).toEqual([
      'e2e_principal@juvion.test',
      'e2e_registrar@juvion.test',
      'e2e_super@juvion.test',
    ]);
  });

  it('first run creates 3 users with the expected roles', async () => {
    const result = await seedE2EUsers();
    expect(result.created).toBe(3);
    expect(result.updated).toBe(0);

    const users = await User.find({ email: { $regex: /^e2e_/ } }).lean();
    expect(users).toHaveLength(3);

    const superUser = users.find((u) => u.email === 'e2e_super@juvion.test');
    const principalUser = users.find((u) => u.email === 'e2e_principal@juvion.test');
    const registrar = users.find((u) => u.email === 'e2e_registrar@juvion.test');

    expect(superUser?.role).toBe('super_admin');
    expect(superUser?.collegeId).toBeUndefined();

    // role='admin' matches the canonical college-operator posture
    // (mirrors the existing JIT seed at backend/src/seed.ts:543-546).
    // The "principal" name is semantic for the test-user identity,
    // not the DB role.
    expect(principalUser?.role).toBe('admin');
    expect(principalUser?.collegeId).toBeTruthy();
    expect(principalUser?.personaType).toBe('L-PRIN');

    // The Registrar exists so a Playwright test can prove the people-gated
    // student import works for the persona it was built for: staff/ST-REG
    // holds `people: *` and NOT `platform: *` in DEFAULT_POLICIES, unlike
    // the two wildcard-holding users above.
    expect(registrar?.role).toBe('staff');
    expect(registrar?.personaType).toBe('ST-REG');
    expect(registrar?.collegeId).toBeTruthy();
  });

  // Guards the reason the registrar row exists: if DEFAULT_POLICIES ever
  // stopped granting ST-REG people:create, or started granting
  // platform:create, the Playwright test built on this persona would quietly
  // stop proving anything.
  it('the registrar persona holds people write access but no platform access', () => {
    const registrar = E2E_USER_DEFINITIONS.find((u) => u.email === 'e2e_registrar@juvion.test');
    expect(registrar).toBeDefined();
    const { role, personaType } = registrar!;
    const forPersona = DEFAULT_POLICIES.filter(
      (p) => p.role === role
        && (!p.personaType || personaType.startsWith(p.personaType)),
    );
    const allowsPeopleWrite = forPersona.some(
      (p) => p.effect === 'allow'
        && (p.module === 'people' || p.module === '*')
        && (p.action === 'create' || p.action === '*'),
    );
    const allowsPlatformWrite = forPersona.some(
      (p) => p.effect === 'allow'
        && (p.module === 'platform' || p.module === '*')
        && (p.action === 'create' || p.action === '*'),
    );
    expect(allowsPeopleWrite).toBe(true);
    expect(allowsPlatformWrite).toBe(false);
  });

  it('passwords are stored as bcrypt hashes (not plaintext)', async () => {
    await seedE2EUsers();
    const user = await User.findOne({ email: 'e2e_super@juvion.test' }).lean();
    expect(user?.password).toBeDefined();
    expect(user?.password).not.toBe(E2E_TEST_PASSWORD);
    // bcrypt hashes have the $2a$ or $2b$ prefix and a known length.
    expect(user?.password).toMatch(/^\$2[aby]\$/);

    const valid = await bcrypt.compare(E2E_TEST_PASSWORD, user!.password);
    expect(valid).toBe(true);
  });

  it('re-running is idempotent (no duplicates, no errors)', async () => {
    await seedE2EUsers();
    const second = await seedE2EUsers();
    // Second run: 0 created, 3 updated (or 0 if the upsert is a noop —
    // either is acceptable; the contract is "no new rows").
    expect(second.created).toBe(0);

    const count = await User.countDocuments({ email: { $regex: /^e2e_/ } });
    expect(count).toBe(3);
  });

  it('handles partial pre-existing state (only one user present)', async () => {
    // Pre-create just the super user, with a different name to detect
    // whether the seed script overwrites or skips it.
    await User.create({
      email: 'e2e_super@juvion.test',
      password: await bcrypt.hash('wrong-password', 4),
      name: 'Stale Super',
      role: 'super_admin',
      personaType: 'L-PRIN',
      isActive: true,
    });

    const result = await seedE2EUsers();
    // The stale row gets upserted to the canonical shape; the principal and
    // the registrar are freshly created.
    expect(result.created).toBe(2);
    expect(result.updated).toBe(1);

    const count = await User.countDocuments({ email: { $regex: /^e2e_/ } });
    expect(count).toBe(3);

    // And the stale name was corrected.
    const fixed = await User.findOne({ email: 'e2e_super@juvion.test' }).lean();
    expect(fixed?.name).toBe('E2E Super Admin');

    // Password was reset to the canonical one.
    const valid = await bcrypt.compare(E2E_TEST_PASSWORD, fixed!.password);
    expect(valid).toBe(true);
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Policy } from '../../../models/platform/Policy';
import { DEFAULT_POLICIES } from '../../rbac/defaults';
import { seedPolicies } from '../policies';

/**
 * Shared seedPolicies — idempotent upsert covers the three properties
 * the original three call sites all needed but implemented differently:
 *   1. First run inserts every DEFAULT_POLICIES row.
 *   2. Re-run leaves the collection at the same count.
 *   3. Edits to a policy in defaults.ts propagate on the next seed run.
 */

describe('shared/seed/policies — seedPolicies()', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  it('first run inserts every DEFAULT_POLICIES row', async () => {
    const result = await seedPolicies();
    expect(result.attempted).toBe(DEFAULT_POLICIES.length);
    expect(result.created).toBe(DEFAULT_POLICIES.length);
    expect(result.updated).toBe(0);
    expect(await Policy.countDocuments({})).toBe(DEFAULT_POLICIES.length);
  });

  it('re-run is idempotent — no duplicates, all rows marked as updated', async () => {
    await seedPolicies();
    const result = await seedPolicies();
    expect(result.attempted).toBe(DEFAULT_POLICIES.length);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(DEFAULT_POLICIES.length);
    expect(await Policy.countDocuments({})).toBe(DEFAULT_POLICIES.length);
  });

  it('honors the createdBy tag', async () => {
    await seedPolicies({ createdBy: 'unit-test' });
    const any = await Policy.findOne({}).lean();
    expect(any?.createdBy).toBe('unit-test');
  });

  it('defaults createdBy to "seed"', async () => {
    await seedPolicies();
    const any = await Policy.findOne({}).lean();
    expect(any?.createdBy).toBe('seed');
  });

  it('seeds the 004 §10.9 governance policies', async () => {
    await seedPolicies();
    const hodGov = await Policy.findOne({ role: 'hod', module: 'governance', action: 'read', effect: 'allow' }).lean();
    const facultyGov = await Policy.findOne({ role: 'faculty', module: 'governance', action: 'read', effect: 'allow' }).lean();
    const staffDeny = await Policy.findOne({ role: 'staff', module: 'governance', action: 'read', effect: 'deny' }).lean();
    expect(hodGov?.scope?.departmentOnly).toBe(true);
    expect(facultyGov?.scope?.departmentOnly).toBe(true);
    expect(staffDeny).toBeDefined();
    expect(staffDeny?.priority).toBe(700);
  });

  it('seeds the admin / super_admin wildcards e2e tests rely on', async () => {
    await seedPolicies();
    const admin = await Policy.findOne({ role: 'admin', module: '*', action: '*', effect: 'allow' }).lean();
    const superAdmin = await Policy.findOne({ role: 'super_admin', module: '*', action: '*', effect: 'allow' }).lean();
    expect(admin).toBeDefined();
    expect(superAdmin).toBeDefined();
    expect(admin?.priority).toBe(950);
    expect(superAdmin?.priority).toBe(1000);
  });

  it('a policy edit in defaults.ts would propagate on next seed (priority bump simulated via direct update)', async () => {
    await seedPolicies();
    // Simulate someone tampering with a policy directly (operator override).
    await Policy.updateOne(
      { role: 'admin', module: '*', action: '*' },
      { $set: { priority: 999, description: 'tampered' } },
    );
    // Re-seeding restores the canonical priority + description from
    // DEFAULT_POLICIES (because $set is total per the seed contract).
    await seedPolicies();
    const restored = await Policy.findOne({ role: 'admin', module: '*', action: '*' }).lean();
    expect(restored?.priority).toBe(950);
    expect(restored?.description).toMatch(/college admin/i);
  });
});

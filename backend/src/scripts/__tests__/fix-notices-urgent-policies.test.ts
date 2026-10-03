import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';

const cache = vi.hoisted(() => ({ invalidatePolicies: vi.fn(async (_collegeId: string) => undefined) }));
vi.mock('../../shared/rbac/cache', () => cache);

import { Policy } from '../../models/platform/Policy';
import { College } from '../../models/College';
import { NotificationDelivery } from '../../models/juvi/NotificationDelivery';
import { JuviEvent } from '../../models/juvi/JuviEvent';
import { MobileSession } from '../../models/juvi/MobileSession';
import { seedPolicies, snapshotPoliciesForCollege } from '../../shared/seed/policies';
import { setupMongo, teardownMongo, clearCollections } from '../../__tests__/helpers/mongoMemory';
import { fixNoticesUrgentPolicies } from '../fix-notices-urgent-policies';

/**
 * Review I1 — the rollout step for the HOD split and `notices:urgent`.
 * The world before it: a system `hod|notices|*` seed row, and colleges whose
 * snapshot copied it (and has no urgent rows), plus one cascade college.
 */

const oid = () => new mongoose.Types.ObjectId();
const OLD_HOD = { role: 'hod', module: 'notices', action: '*', effect: 'allow' as const, priority: 800, isActive: true, description: 'HOD: publish and manage own department Juvi notices' };

async function makeCollege(code: string): Promise<string> {
  const c = await College.create({
    name: `College ${code}`, code,
    address: { line1: '1 Road', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
    contactEmail: `${code.toLowerCase()}@test.edu`, contactPhone: '9000000001',
    subscription: { plan: 'premium', status: 'active' }, status: 'active',
  });
  return String(c._id);
}

/** A college snapshotted before this branch: the old HOD wildcard, no urgent rows. */
async function oldSnapshot(collegeId: string, hodOverrides: Record<string, unknown> = {}): Promise<void> {
  await snapshotPoliciesForCollege(collegeId);
  await Policy.deleteMany({ collegeId, module: 'notices', $or: [{ role: 'hod' }, { action: 'urgent' }] });
  await Policy.create({ ...OLD_HOD, ...hodOverrides, collegeId, createdBy: 'snapshot' });
}

const rowsOf = async (collegeId: string | null, role: string) =>
  (await Policy.find({ collegeId, role, personaType: null, module: 'notices' }).lean())
    .map((p) => ({ action: p.action, effect: p.effect, priority: p.priority, isActive: p.isActive, createdBy: p.createdBy }))
    .sort((a, b) => a.action.localeCompare(b.action));

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); vi.clearAllMocks(); });

describe('fixNoticesUrgentPolicies', () => {
  it('splits the snapshotted HOD wildcard, adds the urgent rows, cleans the system row; a second run changes nothing', async () => {
    await seedPolicies();
    await Policy.create({ ...OLD_HOD, collegeId: null, createdBy: 'seed' });
    const a = await makeCollege('AAA');
    const b = await makeCollege('BBB');
    const cascade = await makeCollege('CCC');
    await oldSnapshot(a);
    // B's admin had switched the HOD notices row off: the split keeps that.
    await oldSnapshot(b, { isActive: false, priority: 810 });
    // A hand-made college row is not the snapshot's, so it is left alone.
    await Policy.create({ ...OLD_HOD, role: 'hod', personaType: 'F-HOD', collegeId: a, createdBy: 'admin' });

    const first = await fixNoticesUrgentPolicies();
    expect(first).toMatchObject({ snapshotted: 2, hodWildcardsReplaced: 2, urgentRowsAdded: 4 });

    const named = (isActive: boolean, priority: number) => ['create', 'read', 'update'].map((action) => ({ action, effect: 'allow', priority, isActive, createdBy: 'snapshot' }));
    expect(await rowsOf(a, 'hod')).toEqual(named(true, 800));
    expect(await rowsOf(b, 'hod')).toEqual(named(false, 810));
    for (const c of [a, b]) {
      expect(await Policy.exists({ collegeId: c, role: 'admin', module: 'notices', action: 'urgent', effect: 'allow', createdBy: 'snapshot' })).not.toBeNull();
      expect(await Policy.exists({ collegeId: c, role: 'principal', module: 'notices', action: 'urgent', effect: 'allow', createdBy: 'snapshot' })).not.toBeNull();
    }
    expect(await Policy.exists({ collegeId: a, role: 'hod', personaType: 'F-HOD', module: 'notices', action: '*' })).not.toBeNull();
    // The cascade college has no rows of its own; the system rows are the defaults.
    expect(await Policy.countDocuments({ collegeId: cascade })).toBe(0);
    expect((await rowsOf(null, 'hod')).map((r) => r.action)).toEqual(['create', 'read', 'update']);
    expect(await Policy.exists({ collegeId: null, role: 'principal', module: 'notices', action: 'urgent' })).not.toBeNull();
    // Every college's cached policies are dropped, cascade included.
    expect(new Set(cache.invalidatePolicies.mock.calls.map(([id]) => id))).toEqual(new Set([a, b, cascade]));

    const before = await Policy.find({}).sort({ _id: 1 }).lean();
    const second = await fixNoticesUrgentPolicies();
    expect(second).toMatchObject({ snapshotted: 2, hodWildcardsReplaced: 0, urgentRowsAdded: 0 });
    const after = await Policy.find({}).sort({ _id: 1 }).lean();
    expect(after.map((p) => [String(p._id), p.role, p.module, p.action, p.isActive])).toEqual(before.map((p) => [String(p._id), p.role, p.module, p.action, p.isActive]));
  });

  it('keeps a named HOD row a college already has instead of overwriting it', async () => {
    await seedPolicies();
    const a = await makeCollege('AAA');
    await oldSnapshot(a);
    await Policy.create({ collegeId: a, role: 'hod', module: 'notices', action: 'read', effect: 'deny', priority: 900, isActive: true, createdBy: 'admin' });
    await fixNoticesUrgentPolicies();
    expect((await rowsOf(a, 'hod')).find((r) => r.action === 'read')).toEqual({ action: 'read', effect: 'deny', priority: 900, isActive: true, createdBy: 'admin' });
    expect(await Policy.exists({ collegeId: a, role: 'hod', module: 'notices', action: '*' })).toBeNull();
  });

  it('builds the notification indexes when autoIndex has not (review M7)', async () => {
    const id = oid();
    for (const m of [NotificationDelivery, JuviEvent, MobileSession]) await m.collection.drop().catch(() => undefined);
    await MobileSession.collection.insertOne({ _id: id, collegeId: oid() });
    await fixNoticesUrgentPolicies();
    const names = async (m: { collection: { indexes(): Promise<{ key: Record<string, unknown> }[]> } }) => (await m.collection.indexes()).map((i) => Object.keys(i.key).join(','));
    expect(await names(NotificationDelivery)).toEqual(expect.arrayContaining(['source.type,source.id,source.kind,accountId', 'status,sendAfter']));
    expect(await names(JuviEvent)).toEqual(expect.arrayContaining(['receivedAt']));
    expect(await names(MobileSession)).toEqual(expect.arrayContaining(['pushToken']));
  });
});

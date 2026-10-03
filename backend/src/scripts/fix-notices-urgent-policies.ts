/**
 * Roll out the Juvi notifications RBAC change to existing databases.
 *
 * The notifications branch split HOD's `notices:*` into `read` / `create` /
 * `update` and added `notices:urgent` for admin and principal (notifications
 * spec §6.5). Neither reaches a live database on its own:
 *   - the system `hod|notices|*` seed row is deleted only when `seedPolicies()`
 *     runs again, and nothing in the deploy path runs it;
 *   - a college that took a policy snapshot evaluates its own rows only, so its
 *     copied `hod|notices|*` row survives, and it has no urgent rows at all.
 *
 * The Urgent gate (juvi-app/notices/urgent-gate.ts) fails closed — a wildcard
 * never grants Urgent — so without this script HODs are refused (correct), but
 * so is the principal of every snapshotted college.
 *
 * Steps:
 *   1. `seedPolicies()`: system rows match DEFAULT_POLICIES, the old HOD wildcard goes.
 *   2. In every snapshotted college, the snapshot's `hod|notices|*` row becomes the
 *      three named rows. They inherit its effect, scope, priority and isActive, so
 *      HOD access is exactly what it was, minus Urgent. A named row the college
 *      already has is kept as is.
 *   3. `admin|notices|urgent` and `principal|notices|urgent` are added where missing.
 *   4. Every college's cached policies are invalidated (cascade colleges read the
 *      system rows, which step 1 changed).
 *   5. The notification indexes are built (`createIndexes`, which never drops one),
 *      in case Mongoose autoIndex did not build them (review M7).
 *
 * Idempotent: a second run finds no wildcard and no missing row, and changes nothing.
 *
 *   npx ts-node -r dotenv/config src/scripts/fix-notices-urgent-policies.ts
 */
/* eslint-disable no-console */
import mongoose from 'mongoose';
import redis from '../config/redis';
import { Policy } from '../models/platform/Policy';
import { College } from '../models/College';
import { NotificationDelivery } from '../models/juvi/NotificationDelivery';
import { JuviEvent } from '../models/juvi/JuviEvent';
import { MobileSession } from '../models/juvi/MobileSession';
import { DEFAULT_POLICIES } from '../shared/rbac/defaults';
import { invalidatePolicies } from '../shared/rbac/cache';
import { seedPolicies } from '../shared/seed/policies';

const SPLIT_ACTIONS = ['read', 'create', 'update'] as const;
const URGENT_ROLES = ['admin', 'principal'] as const;

const defaultRow = (role: string, action: string) => {
  const row = DEFAULT_POLICIES.find((p) => p.role === role && !p.personaType && p.module === 'notices' && p.action === action);
  if (!row) throw new Error(`[fix-notices-urgent] DEFAULT_POLICIES has no ${role}|notices|${action} row.`);
  return row;
};

/** Insert the row unless the college already has its key; true when inserted. */
async function insertIfMissing(collegeId: mongoose.Types.ObjectId, row: Record<string, unknown> & { role: string; action: string }): Promise<boolean> {
  const res = await Policy.updateOne(
    { collegeId, role: row.role, personaType: null, module: 'notices', action: row.action },
    { $setOnInsert: { ...row, collegeId, personaType: null, module: 'notices', createdBy: 'snapshot' } },
    { upsert: true },
  );
  return res.upsertedCount > 0;
}

export async function fixNoticesUrgentPolicies(): Promise<{
  snapshotted: number;
  hodWildcardsReplaced: number;
  urgentRowsAdded: number;
}> {
  await seedPolicies();

  const snapshotted = (await Policy.distinct('collegeId', { createdBy: 'snapshot', collegeId: { $ne: null } })) as mongoose.Types.ObjectId[];
  let hodWildcardsReplaced = 0;
  let urgentRowsAdded = 0;

  for (const collegeId of snapshotted) {
    const wildcard = await Policy.findOne({ collegeId, role: 'hod', personaType: null, module: 'notices', action: '*', createdBy: 'snapshot' }).lean();
    if (wildcard) {
      for (const action of SPLIT_ACTIONS) {
        const { description } = defaultRow('hod', action);
        await insertIfMissing(collegeId, {
          role: 'hod', action, effect: wildcard.effect, priority: wildcard.priority, isActive: wildcard.isActive, description,
          ...(wildcard.scope ? { scope: wildcard.scope } : {}),
        });
      }
      await Policy.deleteOne({ _id: wildcard._id, collegeId });
      hodWildcardsReplaced += 1;
    }
    for (const role of URGENT_ROLES) {
      const { effect, priority, isActive, description } = defaultRow(role, 'urgent');
      if (await insertIfMissing(collegeId, { role, action: 'urgent', effect, priority, isActive, description })) urgentRowsAdded += 1;
    }
  }

  const colleges = new Set([...(await College.distinct('_id')).map(String), ...snapshotted.map(String)]);
  for (const collegeId of colleges) await invalidatePolicies(collegeId);

  for (const model of [NotificationDelivery, JuviEvent, MobileSession] as mongoose.Model<any>[]) await model.createIndexes();

  console.log(`[fix-notices-urgent] ${snapshotted.length} snapshotted college(s): ${hodWildcardsReplaced} HOD wildcard(s) split, ${urgentRowsAdded} urgent row(s) added; ${colleges.size} cache(s) invalidated; notification indexes ensured.`);
  return { snapshotted: snapshotted.length, hodWildcardsReplaced, urgentRowsAdded };
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) {
    console.error('[fix-notices-urgent] MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    await fixNoticesUrgentPolicies();
  } finally {
    // invalidatePolicies opened the lazily-connected Redis client; close it so the process exits.
    await redis.quit().catch(() => undefined);
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

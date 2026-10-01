/**
 * Shared idempotent seeder for RBAC default policies.
 *
 * Single source of truth: imports `DEFAULT_POLICIES` from
 * `shared/rbac/defaults.ts` and upserts each row by its natural key
 * (role, personaType ?? null, module, action, collegeId ?? null) so
 * re-runs neither duplicate nor drift.
 *
 * Replaces three previous call sites that each implemented their own
 * variant of this logic — some with `insertMany` (non-idempotent, fails
 * on re-run) and some with bespoke filters:
 *   - `backend/src/seed.ts` (full dev seed)
 *   - `backend/src/scripts/seed-e2e-users.ts` (CI / Playwright fixture)
 *   - `backend/src/__e2e__/setup/seed-base.ts` (component-level e2e setup)
 *
 * Any future policy additions in `defaults.ts` propagate automatically —
 * no need to remember to update the seeders. New policies appear in DB
 * on the next seed run; obsolete-but-removed policies stay in DB and
 * must be cleaned up explicitly (the seeder doesn't delete, by design).
 */

import { Policy } from '../../models/platform/Policy';
import { DEFAULT_POLICIES } from '../rbac/defaults';

export interface SeedPoliciesOptions {
  /** Tag the upserted docs with this value in `createdBy` for audit. */
  createdBy?: string;
}

export interface SeedPoliciesResult {
  /** Number of policy definitions iterated (= DEFAULT_POLICIES.length). */
  attempted: number;
  /** Number of rows that already existed (matched by natural key). */
  updated: number;
  /** Number of rows newly created. */
  created: number;
}

/**
 * Upserts every entry of DEFAULT_POLICIES into the `Policy` collection.
 * Idempotent: matches on the natural composite key so re-runs neither
 * duplicate nor drift.
 *
 * The function does NOT delete policies that exist in the DB but are
 * absent from DEFAULT_POLICIES. That's deliberate — operators who add
 * college-specific overrides via the admin UI shouldn't have them wiped
 * by a seed run.
 */
export async function seedPolicies(opts: SeedPoliciesOptions = {}): Promise<SeedPoliciesResult> {
  const createdBy = opts.createdBy ?? 'seed';
  let created = 0;
  let updated = 0;

  for (const p of DEFAULT_POLICIES) {
    const filter = {
      role: p.role,
      personaType: p.personaType ?? null,
      module: p.module,
      action: p.action,
      collegeId: p.collegeId ?? null,
    };
    const result = await Policy.updateOne(
      filter,
      {
        $set: { ...p, createdBy },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    // Mongoose returns either { upsertedCount: 1, matchedCount: 0 } on insert
    // or { upsertedCount: 0, matchedCount: 1 } on update.
    if (result.upsertedCount && result.upsertedCount > 0) created += 1;
    else updated += 1;
  }

  // Clean up obsolete system policies created by seed that are no longer in DEFAULT_POLICIES
  const defaultKeySet = new Set(DEFAULT_POLICIES.map(policyKey));
  const existingSystemDocs = await Policy.find({ collegeId: null, createdBy }).lean();
  for (const doc of existingSystemDocs) {
    if (!defaultKeySet.has(policyKey(doc))) {
      await Policy.deleteOne({ _id: doc._id });
    }
  }

  return { attempted: DEFAULT_POLICIES.length, created, updated };
}

// ─── 010 P2 — per-college policy snapshot ───────────────────────────────

export const policyKey = (p: { role: string; personaType?: string | null; module: string; action: string }) =>
  `${p.role}|${p.personaType ?? ''}|${p.module}|${p.action}`;

const COPY_FIELDS = ['role', 'personaType', 'module', 'action', 'effect', 'scope', 'priority', 'description', 'isActive'] as const;

function stripDoc(d: any) {
  const out: Record<string, unknown> = {};
  for (const f of COPY_FIELDS) if (d[f] !== undefined) out[f] = d[f];
  if (out.scope && typeof out.scope === 'object') {
    const sc: any = { ...(out.scope as object) };
    delete sc._id;
    out.scope = sc;
  }
  return out;
}

/**
 * Copy every active system policy into college-owned rows (skipping keys the
 * college already has). From then on the engine evaluates the college's rows
 * only, so later edits to system defaults never change a live college.
 */
export async function snapshotPoliciesForCollege(collegeId: string, createdBy = 'snapshot'): Promise<number> {
  const system = await Policy.find({ collegeId: null, isActive: true }).lean();
  const existingDocs = await Policy.find({ collegeId }).lean();
  const existingMap = new Map(existingDocs.map((doc) => [policyKey(doc), doc]));
  const systemKeySet = new Set(system.map(policyKey));

  // Remove obsolete snapshots that were seeded from system defaults but no longer exist
  for (const doc of existingDocs) {
    if (doc.createdBy === 'snapshot' && !systemKeySet.has(policyKey(doc))) {
      await Policy.deleteOne({ _id: doc._id });
    }
  }

  let copied = 0;
  for (const p of system) {
    const key = policyKey(p);
    const existing = existingMap.get(key);
    if (existing) {
      if (existing.createdBy === 'snapshot') {
        await Policy.updateOne(
          { _id: existing._id },
          { $set: { ...stripDoc(p), updatedBy: createdBy } },
        );
      }
      continue;
    }
    await Policy.create({ ...stripDoc(p), collegeId, createdBy });
    copied += 1;
  }
  return copied;
}

export interface DefaultsDiff {
  mode: 'snapshot' | 'cascade';
  missing: Record<string, unknown>[];
  changed: { key: string; college: Record<string, unknown>; system: Record<string, unknown> }[];
}

/** What the system defaults would change for this college, for an admin to accept row by row. */
export async function defaultsDiff(collegeId: string): Promise<DefaultsDiff> {
  const snapshotted = !!(await Policy.exists({ collegeId, createdBy: 'snapshot' }));
  const system = await Policy.find({ collegeId: null, isActive: true }).lean();
  const college = new Map((await Policy.find({ collegeId }).lean()).map((p) => [policyKey(p), p]));
  const missing: Record<string, unknown>[] = [];
  const changed: DefaultsDiff['changed'] = [];
  for (const p of system) {
    const key = policyKey(p);
    const mine = college.get(key);
    if (!mine) { missing.push({ key, ...stripDoc(p) }); continue; }
    const a = JSON.stringify(stripDoc(p)); const b = JSON.stringify(stripDoc(mine));
    if (a !== b) changed.push({ key, college: { _id: String(mine._id), ...stripDoc(mine) }, system: stripDoc(p) });
  }
  return { mode: snapshotted ? 'snapshot' : 'cascade', missing, changed };
}

/** Apply the selected default rows (by key) onto the college snapshot. */
export async function applyDefaults(collegeId: string, keys: string[], updatedBy: string): Promise<number> {
  const wanted = new Set(keys);
  const system = await Policy.find({ collegeId: null, isActive: true }).lean();
  let applied = 0;
  for (const p of system) {
    const key = policyKey(p);
    if (!wanted.has(key)) continue;
    await Policy.updateOne(
      { collegeId, role: p.role, personaType: p.personaType ?? null, module: p.module, action: p.action },
      { $set: { ...stripDoc(p), updatedBy }, $setOnInsert: { collegeId, createdBy: 'snapshot' } },
      { upsert: true },
    );
    applied += 1;
  }
  return applied;
}

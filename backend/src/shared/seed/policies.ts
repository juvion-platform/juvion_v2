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

  return { attempted: DEFAULT_POLICIES.length, created, updated };
}

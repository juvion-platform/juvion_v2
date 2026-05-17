/**
 * seed-e2e-users — idempotent fixture for the Playwright E2E suite.
 * Spec: .captain/specs/playwright-e2e/spec.md §AC-2
 *
 * Creates two dedicated users that the Playwright auth tests log in as:
 *   - e2e_super@juvion.test       (super_admin, no collegeId)
 *   - e2e_principal@juvion.test   (principal, collegeId = DEV_COLLEGE_ID)
 *
 * Both share a known password: E2ETestPassword!
 *
 * The script is safe to re-run. It upserts by email so:
 *   - First run: creates both rows.
 *   - Subsequent runs: refreshes the canonical fields (name, role,
 *     personaType, password hash) without creating duplicates.
 *   - Partial state: missing rows are created; existing rows are
 *     normalised back to the canonical shape.
 *
 * Policy seeding: this script also runs `seedPolicies()` from
 * shared/seed/policies so the RBAC default policies are upserted into
 * the Policy collection. Without them, `authorize()` 403s every
 * authenticated request and the e2e suite fails on post-login fetches.
 *
 * Called from:
 *   - Local dev: `npm run seed:e2e-users -w backend`
 *   - CI:        the .github/workflows/e2e.yml workflow runs this
 *                before launching Playwright.
 *   - Playwright global-setup: imports `seedE2EUsers` directly when
 *                running the suite against a live backend.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { User } from '../models/User';
import { seedPolicies } from '../shared/seed/policies';

dotenv.config();

export const E2E_TEST_PASSWORD = 'E2ETestPassword!';

export interface E2EUserDefinition {
  email: string;
  name: string;
  role: 'super_admin' | 'admin';
  personaType: string;
  /** Empty string means "no collegeId" — the super_admin case. */
  collegeId?: string;
}

/**
 * Canonical definitions. Anyone editing this list MUST update the
 * Playwright spec at .captain/specs/playwright-e2e/spec.md §AC-2 and
 * the fixture at admin-portal/tests/e2e/utils/test-users.ts in the
 * same change — they drift silently otherwise.
 */
export const E2E_USER_DEFINITIONS: E2EUserDefinition[] = [
  {
    email: 'e2e_super@juvion.test',
    name: 'E2E Super Admin',
    role: 'super_admin',
    personaType: 'L-PRIN',
    // No collegeId — super_admin is cross-college.
  },
  {
    // Email name kept as `e2e_principal` (semantic: college-level
    // admin from the test perspective). The DB role is 'admin' to
    // match the canonical RBAC posture for college operators — the
    // existing JIT seed uses role='admin' for the same reason.
    // Phase A tests still refer to this user as "principal" — that's
    // the test-user identity, not the DB role.
    email: 'e2e_principal@juvion.test',
    name: 'E2E Principal',
    role: 'admin',
    personaType: 'L-PRIN',
    collegeId: process.env.DEV_COLLEGE_ID || '000000000000000000000001',
  },
];

export interface SeedResult {
  created: number;
  updated: number;
  total: number;
}

/**
 * Upserts the E2E users. Idempotent.
 *
 * Returns counts so callers (the CI step, the test) can verify what
 * happened. `created` = rows that didn't exist before this call;
 * `updated` = rows that existed and were refreshed.
 */
export async function seedE2EUsers(): Promise<SeedResult> {
  const passwordHash = await bcrypt.hash(E2E_TEST_PASSWORD, 10);

  let created = 0;
  let updated = 0;

  for (const def of E2E_USER_DEFINITIONS) {
    // findOneAndUpdate with upsert is the idempotent path. We need to
    // know whether the row pre-existed to count create-vs-update, so
    // pre-check + write in two steps (cheap on a 2-row script).
    const existing = await User.findOne({ email: def.email }).lean();

    const updateDoc: Record<string, unknown> = {
      email: def.email,
      name: def.name,
      role: def.role,
      personaType: def.personaType,
      password: passwordHash,
      isActive: true,
    };
    // The User model uses a partial unique index on collegeId — present
    // for college-scoped users, ABSENT for super_admin. Use $unset to
    // make sure a previously college-scoped row becomes truly absent.
    const writeOp: Record<string, unknown> = { $set: updateDoc };
    if (def.collegeId) {
      updateDoc.collegeId = new mongoose.Types.ObjectId(def.collegeId);
    } else {
      (writeOp as { $unset?: Record<string, 1> }).$unset = { collegeId: 1 };
    }

    await User.updateOne({ email: def.email }, writeOp, { upsert: true });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated, total: created + updated };
}

// ─── CLI entrypoint ───────────────────────────────────────────────

async function main() {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://localhost:27017/juvion_v2';
  // eslint-disable-next-line no-console
  console.log(`[seed-e2e-users] connecting to ${mongoUri}`);
  await mongoose.connect(mongoUri);
  try {
    const userResult = await seedE2EUsers();
    // RBAC default policies are required for `authorize()` to grant access.
    // Without them every authenticated request 403s and the e2e suite fails
    // on the post-login fetches (admissions, governance, platform, etc.).
    const policyResult = await seedPolicies({ createdBy: 'seed-e2e' });
    // eslint-disable-next-line no-console
    console.log(
      `[seed-e2e-users] done · users created=${userResult.created} updated=${userResult.updated} total=${userResult.total} · policies attempted=${policyResult.attempted} created=${policyResult.created} updated=${policyResult.updated}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

// Only run main() when invoked directly (not when imported by tests
// or by Playwright global-setup).
if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-e2e-users] failed:', err);
    process.exit(1);
  });
}

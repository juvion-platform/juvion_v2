/**
 * Seed canonical fee-quota list per college.
 *
 * Ships the standard Indian college admission quota codes (convener,
 * management, nri, spot, lateral) to every college's `FeeQuota`
 * collection. Idempotent:
 *
 *   - For each (collegeId, code):
 *       * If no document exists → INSERT with the canonical name +
 *         description + status='active'.
 *       * If a document exists → SKIP. Admin edits to name /
 *         description / status are preserved on subsequent seed
 *         runs.
 *
 * Mirrors `seed-fee-categories.ts` exactly. Codes are LOWERCASE to
 * match the existing values in `Student.quota` and
 * `FeeStructureInstance.quota` — fee-pin-service does string-equality
 * matching, so the case must align with whatever the dev DB already
 * holds.
 *
 * CLI:
 *   npx ts-node backend/src/scripts/seed-fee-quotas.ts
 *     [--college-id=<id>] [--dry-run]
 *
 * No `--college-id` → iterate over every College and seed each.
 *
 * `CANONICAL_FEE_QUOTAS` is exported so tests + future migrations can
 * reuse the table without duplicating it.
 */

import path from 'path';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load backend/.env regardless of which directory the operator runs
// the script from. `__dirname` is .../backend/src/scripts, so going
// up two levels lands at .../backend/.env.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { FeeQuota, FeeQuotaStatus } from '../models/finance/FeeQuota';
import { College } from '../models/College';

export interface CanonicalFeeQuota {
  code: string;
  name: string;
  description: string;
  status: FeeQuotaStatus;
}

/**
 * Standard Indian college admission-quota codes. Each row pairs a
 * canonical lowercase `code` with a human-readable `name` and a short
 * description for operators who don't know the lingo. Order matches
 * how state admission boards typically rank quotas (govt-cap first,
 * premium tiers last).
 */
export const CANONICAL_FEE_QUOTAS: ReadonlyArray<CanonicalFeeQuota> = [
  {
    code: 'convener',
    name: 'Convener Quota',
    description: 'Government-merit-based seats — capped fees as per state regulator.',
    status: 'active',
  },
  {
    code: 'management',
    name: 'Management Quota',
    description: 'College-managed seats. Fees typically 2x–3x convener anchor.',
    status: 'active',
  },
  {
    code: 'nri',
    name: 'NRI Quota',
    description: 'Non-Resident Indian / foreign-national quota — premium fee tier.',
    status: 'active',
  },
  {
    code: 'spot',
    name: 'Spot Admission',
    description: 'Direct / spot admission against unfilled seats.',
    status: 'active',
  },
  {
    code: 'lateral',
    name: 'Lateral Entry',
    description: 'Direct admission to Year 2 (after diploma / transfer).',
    status: 'active',
  },
];

export interface SeedResult {
  collegeId: string;
  inserted: number;
  skipped: number;
}

export interface SeedOptions {
  dryRun?: boolean;
}

/**
 * Seed canonical fee quotas for a single college.
 *
 * Upsert semantics:
 *   - missing  → insert (status='active')
 *   - exists   → skip (preserve admin edits)
 */
export async function seedFeeQuotasForCollege(
  collegeId: string,
  opts: SeedOptions = {},
): Promise<SeedResult> {
  const dryRun = !!opts.dryRun;
  const result: SeedResult = { collegeId, inserted: 0, skipped: 0 };

  if (!mongoose.Types.ObjectId.isValid(collegeId)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[seed-fee-quotas] invalid collegeId=${collegeId}; skipping`,
    );
    return result;
  }
  const cid = new mongoose.Types.ObjectId(collegeId);

  // Fetch existing codes for this college so we can decide insert vs
  // skip in one round-trip.
  const existing = await FeeQuota.find(
    { collegeId: cid },
    { code: 1 },
  ).lean();
  const existingCodes = new Set(existing.map((e) => e.code));

  const toInsert: Array<Record<string, unknown>> = [];
  for (const c of CANONICAL_FEE_QUOTAS) {
    if (existingCodes.has(c.code)) {
      result.skipped += 1;
      continue;
    }
    result.inserted += 1;
    toInsert.push({
      collegeId: cid,
      code: c.code,
      name: c.name,
      description: c.description,
      status: c.status,
    });
  }

  if (dryRun) return result;
  if (toInsert.length > 0) {
    // `ordered: false` so a single duplicate-key from a race doesn't
    // abort the rest of the inserts.
    await FeeQuota.insertMany(toInsert, { ordered: false });
  }
  return result;
}

export interface SeedAllResult {
  collegesProcessed: number;
  perCollege: SeedResult[];
  failures: Array<{ collegeId: string; error: string }>;
}

/**
 * Seed all colleges. A failure on one college is logged but does not
 * abort the run.
 */
export async function seedFeeQuotasForAllColleges(
  opts: SeedOptions = {},
): Promise<SeedAllResult> {
  const colleges = await College.find({}, { _id: 1 }).lean();
  const perCollege: SeedResult[] = [];
  const failures: Array<{ collegeId: string; error: string }> = [];

  for (const c of colleges) {
    const id = String(c._id);
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await seedFeeQuotasForCollege(id, opts);
      perCollege.push(r);
    } catch (e) {
      failures.push({ collegeId: id, error: (e as Error).message });
      // eslint-disable-next-line no-console
      console.warn(
        `[seed-fee-quotas] college=${id} failed: ${(e as Error).message}`,
      );
    }
  }

  return { collegesProcessed: colleges.length, perCollege, failures };
}

// ── CLI ────────────────────────────────────────────────────────────────

interface ParsedArgs {
  collegeId: string | null;
  dryRun: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { collegeId: null, dryRun: false };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--college-id=')) {
      out.collegeId = a.slice('--college-id='.length) || null;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const { connectDB } = await import('../config/db');
  await connectDB();

  let exitCode = 0;
  try {
    if (args.collegeId) {
      const r = await seedFeeQuotasForCollege(args.collegeId, {
        dryRun: args.dryRun,
      });
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-quotas] ${args.dryRun ? 'DRY-RUN ' : ''}` +
          `collegeId=${r.collegeId} inserted=${r.inserted} skipped=${r.skipped}`,
      );
    } else {
      const all = await seedFeeQuotasForAllColleges({ dryRun: args.dryRun });
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-quotas] ${args.dryRun ? 'DRY-RUN ' : ''}` +
          `colleges=${all.collegesProcessed} failures=${all.failures.length}`,
      );
      const totalInserted = all.perCollege.reduce((s, r) => s + r.inserted, 0);
      const totalSkipped = all.perCollege.reduce((s, r) => s + r.skipped, 0);
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-quotas] inserted=${totalInserted} skipped=${totalSkipped}`,
      );
      if (all.failures.length > 0) exitCode = 1;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[seed-fee-quotas] fatal:', e);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
  process.exit(exitCode);
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

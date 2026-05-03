/**
 * Seed canonical fee-category list per college.
 *
 * Ships the standard Indian college reservation categories
 * (OC / OBC / SC / ST / EWS / NRI) to every college's `FeeCategory`
 * collection. Idempotent:
 *
 *   - For each (collegeId, code):
 *       * If no document exists → INSERT with the canonical name +
 *         description + status='active'.
 *       * If a document exists → SKIP. We never trample admin edits to
 *         name/description/status — once a category has been touched by
 *         the operator it's theirs.
 *
 * The skip-on-exists rule is the meaningful difference from the
 * fee-component-template seed: there's no `isDefault` flag on
 * FeeCategory, so we treat any existing row as "owned by the admin".
 *
 * CLI:
 *   npx ts-node backend/src/scripts/seed-fee-categories.ts
 *     [--college-id=<id>] [--dry-run]
 *
 * No `--college-id` → iterate over every College and seed each.
 *
 * `CANONICAL_FEE_CATEGORIES` is exported so tests + future migrations
 * can reuse the table without duplicating it.
 */

import path from 'path';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load backend/.env regardless of which directory the operator runs
// the script from. `__dirname` is .../backend/src/scripts, so going
// up two levels lands at .../backend/.env.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { FeeCategory, FeeCategoryStatus } from '../models/finance/FeeCategory';
import { College } from '../models/College';

export interface CanonicalFeeCategory {
  code: string;
  name: string;
  description: string;
  status: FeeCategoryStatus;
}

/**
 * Standard Indian college reservation / fee-distinction categories.
 *
 * Includes Andhra Pradesh / Telangana state-board BC sub-categories
 * (BC-A through BC-E) since these states' rank cards print the
 * sub-letter, and matching FeeStructureInstances need to align with
 * what the EAMCET / JEE-rank-card lists. Generic "OBC" is kept for
 * states without sub-categories.
 *
 * Codes are SHORT, UPPERCASE, conventional — match what state admission
 * boards print on rank cards (so officers don't have to translate).
 */
export const CANONICAL_FEE_CATEGORIES: ReadonlyArray<CanonicalFeeCategory> = [
  {
    code: 'OC',
    name: 'Open Category',
    description: 'General / unreserved seats. Default fee structure.',
    status: 'active',
  },
  {
    code: 'OBC',
    name: 'Other Backward Classes',
    description: 'Central / state OBC list as applicable; for states without BC-A..E sub-categories.',
    status: 'active',
  },
  {
    code: 'BC-A',
    name: 'Backward Class A',
    description: 'AP / TS state-board BC-A sub-category.',
    status: 'active',
  },
  {
    code: 'BC-B',
    name: 'Backward Class B',
    description: 'AP / TS state-board BC-B sub-category.',
    status: 'active',
  },
  {
    code: 'BC-C',
    name: 'Backward Class C',
    description: 'AP / TS state-board BC-C sub-category.',
    status: 'active',
  },
  {
    code: 'BC-D',
    name: 'Backward Class D',
    description: 'AP / TS state-board BC-D sub-category.',
    status: 'active',
  },
  {
    code: 'BC-E',
    name: 'Backward Class E',
    description: 'AP / TS state-board BC-E sub-category (includes minority groups).',
    status: 'active',
  },
  {
    code: 'SC',
    name: 'Scheduled Caste',
    description: 'SC reservation. Government fee-reimbursement schemes typically apply.',
    status: 'active',
  },
  {
    code: 'ST',
    name: 'Scheduled Tribe',
    description: 'ST reservation. Government fee-reimbursement schemes typically apply.',
    status: 'active',
  },
  {
    code: 'EWS',
    name: 'Economically Weaker Section',
    description: '10% reservation for general-category EWS (since 2019).',
    status: 'active',
  },
  {
    code: 'NRI',
    name: 'Non-Resident Indian',
    description: 'NRI / foreign-national quota — separate (typically higher) fee structure.',
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
 * Seed canonical fee categories for a single college.
 *
 * Upsert semantics:
 *   - missing  → insert (status='active')
 *   - exists   → skip (preserve admin edits)
 */
export async function seedFeeCategoriesForCollege(
  collegeId: string,
  opts: SeedOptions = {},
): Promise<SeedResult> {
  const dryRun = !!opts.dryRun;
  const result: SeedResult = { collegeId, inserted: 0, skipped: 0 };

  if (!mongoose.Types.ObjectId.isValid(collegeId)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[seed-fee-categories] invalid collegeId=${collegeId}; skipping`,
    );
    return result;
  }
  const cid = new mongoose.Types.ObjectId(collegeId);

  // Fetch existing codes for this college so we can decide insert vs skip
  // in one round-trip.
  const existing = await FeeCategory.find(
    { collegeId: cid },
    { code: 1 },
  ).lean();
  const existingCodes = new Set(existing.map((e) => e.code));

  const toInsert: Array<Record<string, unknown>> = [];
  for (const c of CANONICAL_FEE_CATEGORIES) {
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
    await FeeCategory.insertMany(toInsert, { ordered: false });
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
export async function seedFeeCategoriesForAllColleges(
  opts: SeedOptions = {},
): Promise<SeedAllResult> {
  const colleges = await College.find({}, { _id: 1 }).lean();
  const perCollege: SeedResult[] = [];
  const failures: Array<{ collegeId: string; error: string }> = [];

  for (const c of colleges) {
    const id = String(c._id);
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await seedFeeCategoriesForCollege(id, opts);
      perCollege.push(r);
    } catch (e) {
      failures.push({ collegeId: id, error: (e as Error).message });
      // eslint-disable-next-line no-console
      console.warn(
        `[seed-fee-categories] college=${id} failed: ${(e as Error).message}`,
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

  // Connect only when running as CLI (not during unit tests).
  const { connectDB } = await import('../config/db');
  await connectDB();

  let exitCode = 0;
  try {
    if (args.collegeId) {
      const r = await seedFeeCategoriesForCollege(args.collegeId, {
        dryRun: args.dryRun,
      });
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-categories] ${args.dryRun ? 'DRY-RUN ' : ''}` +
          `collegeId=${r.collegeId} inserted=${r.inserted} skipped=${r.skipped}`,
      );
    } else {
      const all = await seedFeeCategoriesForAllColleges({
        dryRun: args.dryRun,
      });
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-categories] ${args.dryRun ? 'DRY-RUN ' : ''}` +
          `colleges=${all.collegesProcessed} failures=${all.failures.length}`,
      );
      const totalInserted = all.perCollege.reduce((s, r) => s + r.inserted, 0);
      const totalSkipped = all.perCollege.reduce((s, r) => s + r.skipped, 0);
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-categories] inserted=${totalInserted} skipped=${totalSkipped}`,
      );
      if (all.failures.length > 0) exitCode = 1;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[seed-fee-categories] fatal:', e);
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

/**
 * Seed canonical FeeStructureInstance grid per college.
 *
 * Goal: ensure that EVERY plausible (programme × year-of-study ×
 * quota × category) combination resolves to an active FSI, so the
 * auto-pin path on student create / edit succeeds without manual
 * follow-up.
 *
 * Strategy — wildcard branches + per-quota concession rows:
 *
 *   For each college × current AcademicYear × programme × year-of-study
 *   (1..durationYears), we insert:
 *
 *     Convener quota (govt-cap, concessions per category):
 *       - branch=null, category=null  → base default (catch-all)
 *       - branch=null, category=SC    → 50% of base (govt scheme)
 *       - branch=null, category=ST    → 50% of base
 *       - branch=null, category=EWS   → 75% of base
 *       - branch=null, category=BC-A  → 75% of base
 *       - branch=null, category=BC-B  → 75% of base
 *       - branch=null, category=BC-C  → 75% of base
 *       - branch=null, category=BC-D  → 75% of base
 *       - branch=null, category=BC-E  → 75% of base
 *
 *     Management quota:
 *       - branch=null, category=null  → 2.5x convener base
 *
 *     NRI quota:
 *       - branch=null, category=null  → 6x convener base
 *
 * fee-pin-service prefers branch-exact > branch-wildcard, and
 * category-exact > category-wildcard, so any future BRANCH-specific
 * structures the admin creates via the UI will override these
 * wildcards naturally — without us having to delete the seed rows.
 *
 * The seed is idempotent: for each (collegeId, academicYearId,
 * programmeId, branchId, category, quota) tuple it skips if an FSI
 * exists. We never trample admin edits.
 *
 * CLI:
 *   npx ts-node backend/src/scripts/seed-fee-structure-instances.ts
 *     [--college-id=<id>] [--dry-run]
 */

import mongoose, { Types } from 'mongoose';

import { FeeStructureInstance } from '../models/finance/FeeStructureInstance';
import { College } from '../models/College';
import { Programme } from '../models/academic-structure/Programme';
import { AcademicYear } from '../models/academic-structure/AcademicYear';

interface QuotaCategoryRule {
  quota: 'convener' | 'management' | 'nri';
  category: string | null;
  baseFactor: number; // multiplier on the programme's base fee
}

/**
 * Per-quota / per-category multipliers. Anchored at the convener-quota
 * default = 1.0; concessions reduce, premium quotas inflate.
 */
const SEED_RULES: ReadonlyArray<QuotaCategoryRule> = [
  // Convener quota — government cap + category concessions
  { quota: 'convener',   category: null,    baseFactor: 1.0 },
  { quota: 'convener',   category: 'SC',    baseFactor: 0.5 },
  { quota: 'convener',   category: 'ST',    baseFactor: 0.5 },
  { quota: 'convener',   category: 'EWS',   baseFactor: 0.75 },
  { quota: 'convener',   category: 'BC-A',  baseFactor: 0.75 },
  { quota: 'convener',   category: 'BC-B',  baseFactor: 0.75 },
  { quota: 'convener',   category: 'BC-C',  baseFactor: 0.75 },
  { quota: 'convener',   category: 'BC-D',  baseFactor: 0.75 },
  { quota: 'convener',   category: 'BC-E',  baseFactor: 0.75 },
  // Management quota — single catch-all (no per-category concessions)
  { quota: 'management', category: null,    baseFactor: 2.5 },
  // NRI quota — single catch-all (premium tier)
  { quota: 'nri',        category: null,    baseFactor: 6.0 },
];

/**
 * Per-programme base annual fee (₹). Convener quota anchor — all other
 * quotas / categories scale off this via SEED_RULES.baseFactor.
 *
 * Numbers are realistic Telangana / AP B.Tech bands as of 2025.
 */
const BASE_FEE_BY_PROGRAMME_CODE: Record<string, number> = {
  BTECH: 50_000,
  BE:    50_000,
  MTECH: 60_000,
  ME:    60_000,
  BCA:   30_000,
  MCA:   45_000,
  BSC:   25_000,
  MSC:   35_000,
  BBA:   35_000,
  MBA:   80_000,
  // Fallback used when the programme code is unrecognised
  DEFAULT: 40_000,
};

export interface SeedResult {
  collegeId: string;
  academicYearId: string | null;
  inserted: number;
  skipped: number;
  reason?: string;
}

export interface SeedOptions {
  dryRun?: boolean;
}

/**
 * Look up the current AcademicYear for a college. Mirrors the logic
 * the auto-pin path uses on student create.
 */
async function findCurrentAcademicYear(collegeId: Types.ObjectId): Promise<{ _id: Types.ObjectId } | null> {
  const ay = await AcademicYear.findOne({ collegeId, isCurrent: true })
    .select({ _id: 1 })
    .lean<{ _id: Types.ObjectId } | null>();
  return ay;
}

/** Round to a clean ₹100 boundary so generated amounts look plausible. */
function roundToHundreds(n: number): number {
  return Math.round(n / 100) * 100;
}

export async function seedFeeStructureInstancesForCollege(
  collegeId: string,
  opts: SeedOptions = {},
): Promise<SeedResult> {
  const dryRun = !!opts.dryRun;
  const result: SeedResult = {
    collegeId,
    academicYearId: null,
    inserted: 0,
    skipped: 0,
  };

  if (!mongoose.Types.ObjectId.isValid(collegeId)) {
    result.reason = 'invalid-college-id';
    return result;
  }
  const cid = new mongoose.Types.ObjectId(collegeId);

  const ay = await findCurrentAcademicYear(cid);
  if (!ay) {
    result.reason = 'no-current-academic-year';
    return result;
  }
  result.academicYearId = String(ay._id);

  const programmes = await Programme.find({ collegeId: cid }).lean<Array<{ _id: Types.ObjectId; code?: string; durationYears?: number }>>();
  if (programmes.length === 0) {
    result.reason = 'no-programmes';
    return result;
  }

  // Pull all existing active FSIs for this (college, AY) so the skip
  // check is one round-trip, not one-per-rule.
  const existing = await FeeStructureInstance.find(
    { collegeId: cid, academicYearId: ay._id, status: 'active' },
    { programmeId: 1, branchId: 1, category: 1, quota: 1 },
  ).lean<Array<{ programmeId: Types.ObjectId; branchId?: Types.ObjectId; category?: string; quota?: string }>>();
  // Build a set keyed by the matching tuple (branchId is always null in
  // OUR seed; existing rows may have branchId set, in which case our
  // wildcard insert is a DIFFERENT row and shouldn't be considered a
  // duplicate). The seed only conflicts with ANOTHER seed run, not with
  // hand-curated branch-specific rows.
  const seenKey = new Set<string>();
  for (const e of existing) {
    if (e.branchId) continue; // branch-specific row — never collides with our wildcard
    seenKey.add(`${String(e.programmeId)}|${e.category ?? '_'}|${e.quota ?? '_'}`);
  }

  const toInsert: Array<Record<string, unknown>> = [];

  for (const p of programmes) {
    const base = BASE_FEE_BY_PROGRAMME_CODE[p.code ?? ''] ?? BASE_FEE_BY_PROGRAMME_CODE.DEFAULT!;
    const years = Math.max(1, p.durationYears ?? 4);

    for (let yearOfStudy = 1; yearOfStudy <= years; yearOfStudy += 1) {
      void yearOfStudy; // FSI doesn't carry yearOfStudy directly; pin layer holds it.
      // Note: FSI is per (programme, AY) — yearOfStudy is recorded on the
      // FeePin (Student.feePins[].yearOfStudy), NOT on the FSI itself.
      // So we do NOT loop yearOfStudy at the FSI level — one FSI covers
      // the programme + AY for whatever year(s) the pin spans. Break
      // after the first iteration.
      for (const rule of SEED_RULES) {
        const key = `${String(p._id)}|${rule.category ?? '_'}|${rule.quota}`;
        if (seenKey.has(key)) {
          result.skipped += 1;
          continue;
        }
        seenKey.add(key);
        result.inserted += 1;
        const totalAmount = roundToHundreds(base * rule.baseFactor);
        toInsert.push({
          collegeId: cid,
          academicYearId: ay._id,
          programmeId: p._id,
          ...(rule.category ? { category: rule.category } : {}),
          quota: rule.quota,
          status: 'active',
          totalAmount,
        });
      }
      break; // FSI is AY-scoped, not year-of-study-scoped
    }
  }

  if (dryRun) return result;
  if (toInsert.length > 0) {
    await FeeStructureInstance.insertMany(toInsert, { ordered: false });
  }
  return result;
}

export interface SeedAllResult {
  collegesProcessed: number;
  perCollege: SeedResult[];
  failures: Array<{ collegeId: string; error: string }>;
}

export async function seedFeeStructureInstancesForAllColleges(
  opts: SeedOptions = {},
): Promise<SeedAllResult> {
  const colleges = await College.find({}, { _id: 1 }).lean();
  const perCollege: SeedResult[] = [];
  const failures: Array<{ collegeId: string; error: string }> = [];

  for (const c of colleges) {
    const id = String(c._id);
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await seedFeeStructureInstancesForCollege(id, opts);
      perCollege.push(r);
    } catch (e) {
      failures.push({ collegeId: id, error: (e as Error).message });
      // eslint-disable-next-line no-console
      console.warn(
        `[seed-fee-structure-instances] college=${id} failed: ${(e as Error).message}`,
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
      const r = await seedFeeStructureInstancesForCollege(args.collegeId, {
        dryRun: args.dryRun,
      });
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-structure-instances] ${args.dryRun ? 'DRY-RUN ' : ''}` +
          `collegeId=${r.collegeId} inserted=${r.inserted} skipped=${r.skipped}` +
          (r.reason ? ` reason=${r.reason}` : ''),
      );
    } else {
      const all = await seedFeeStructureInstancesForAllColleges({ dryRun: args.dryRun });
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-structure-instances] ${args.dryRun ? 'DRY-RUN ' : ''}` +
          `colleges=${all.collegesProcessed} failures=${all.failures.length}`,
      );
      const totalInserted = all.perCollege.reduce((s, r) => s + r.inserted, 0);
      const totalSkipped = all.perCollege.reduce((s, r) => s + r.skipped, 0);
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-structure-instances] inserted=${totalInserted} skipped=${totalSkipped}`,
      );
      // Per-college skip-reason summary so the operator sees why a given
      // college landed empty.
      for (const r of all.perCollege) {
        if (r.reason) {
          // eslint-disable-next-line no-console
          console.warn(
            `[seed-fee-structure-instances] college=${r.collegeId} skipped (${r.reason})`,
          );
        }
      }
      if (all.failures.length > 0) exitCode = 1;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[seed-fee-structure-instances] fatal:', e);
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

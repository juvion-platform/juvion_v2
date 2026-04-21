/**
 * Seed canonical fee-component template (Task 2 — Fee Configuration).
 *
 * Ships the 33-entry canonical component catalog (spec §Template) to
 * every college's FeeComponentTemplate collection. Idempotent:
 *
 *   - For each (collegeId, componentKey):
 *       * If no document exists → INSERT with canonical fields + isDefault=true
 *       * If a default document exists → UPDATE only the canonical fields
 *         (category, isRefundable, defaultOneTime, applicableToYears,
 *         displayOrder). `displayLabel` is left alone because colleges
 *         customize it.
 *       * If a custom document (`isDefault: false`) exists → SKIP. The
 *         college has explicitly chosen to override this key.
 *
 * CLI:
 *   npx ts-node backend/src/scripts/seed-fee-component-template.ts
 *     [--college-id=<id>] [--dry-run]
 *
 * No `--college-id` → iterate over every College and seed each.
 *
 * The `CANONICAL_FEE_COMPONENTS` constant is exported so T6
 * (fee-component-template-service) can reuse it to implement
 * "reset to defaults" without duplicating the table.
 *
 * Spec: .captain/specs/fee-configuration/spec.md §Template
 * Plan: .captain/specs/fee-configuration/plan.md §2.2, §2.4 (Migration 2)
 */

import mongoose from 'mongoose';

import {
  FeeComponentTemplate,
  FeeComponentTemplateCategory,
} from '../models/finance/FeeComponentTemplate';
import { College } from '../models/College';

export interface CanonicalFeeComponent {
  componentKey: string;
  displayLabel: string;
  category: FeeComponentTemplateCategory;
  isRefundable: boolean;
  defaultOneTime: boolean;
  applicableToYears: number[];
  displayOrder: number;
}

// Ordered per spec §Template. displayOrder reflects presentation order
// across the whole list (1-based, gapless). Grouping is by category in
// spec tables; we flatten here so a single sort key drives the UI.
export const CANONICAL_FEE_COMPONENTS: ReadonlyArray<CanonicalFeeComponent> = [
  // ── Academic (recurring, per year) ──
  { componentKey: 'tuition_fee',             displayLabel: 'Tuition Fee',                        category: 'academic',         isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 1  },
  { componentKey: 'development_fee',         displayLabel: 'Development Fee',                    category: 'academic',         isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 2  },
  { componentKey: 'examination_fee',         displayLabel: 'University Examination Fee',         category: 'academic',         isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 3  },
  { componentKey: 'internal_assessment_fee', displayLabel: 'Internal Assessment Fee',            category: 'academic',         isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 4  },

  // ── Admission one-offs (Year 1) ──
  { componentKey: 'admission_fee',           displayLabel: 'Admission Fee',                      category: 'admission_oneoff', isRefundable: false, defaultOneTime: true,  applicableToYears: [1],    displayOrder: 5  },
  { componentKey: 'registration_fee',        displayLabel: 'Registration Fee',                   category: 'admission_oneoff', isRefundable: false, defaultOneTime: true,  applicableToYears: [1],    displayOrder: 6  },
  { componentKey: 'id_card_fee',             displayLabel: 'ID Card & Uniform Fee',              category: 'admission_oneoff', isRefundable: false, defaultOneTime: true,  applicableToYears: [1],    displayOrder: 7  },
  { componentKey: 'orientation_fee',         displayLabel: 'Orientation / Induction Fee',        category: 'admission_oneoff', isRefundable: false, defaultOneTime: true,  applicableToYears: [1],    displayOrder: 8  },

  // ── Lab & Practical ──
  { componentKey: 'laboratory_fee',          displayLabel: 'General Laboratory Fee',             category: 'lab',              isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 9  },
  { componentKey: 'computer_lab_fee',        displayLabel: 'Computer Lab Fee',                   category: 'lab',              isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 10 },
  { componentKey: 'workshop_fee',            displayLabel: 'Engineering Workshop Fee',           category: 'lab',              isRefundable: false, defaultOneTime: false, applicableToYears: [1],    displayOrder: 11 },
  { componentKey: 'project_fee',             displayLabel: 'Project / Capstone Fee',             category: 'lab',              isRefundable: false, defaultOneTime: false, applicableToYears: [4],    displayOrder: 12 },
  { componentKey: 'internship_fee',          displayLabel: 'Industrial Training / Internship Fee', category: 'lab',            isRefundable: false, defaultOneTime: false, applicableToYears: [3, 4], displayOrder: 13 },

  // ── Infrastructure & Services ──
  { componentKey: 'library_fee',             displayLabel: 'Library Fee',                        category: 'infrastructure',   isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 14 },
  { componentKey: 'digital_resources_fee',   displayLabel: 'E-Resources / Digital Learning Fee', category: 'infrastructure',   isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 15 },
  { componentKey: 'sports_fee',              displayLabel: 'Sports / Gymkhana Fee',              category: 'infrastructure',   isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 16 },
  { componentKey: 'medical_fee',             displayLabel: 'Medical / Health Service Fee',       category: 'infrastructure',   isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 17 },
  { componentKey: 'insurance_premium',       displayLabel: 'Student Insurance Premium',          category: 'infrastructure',   isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 18 },

  // ── Student Life ──
  { componentKey: 'student_activity_fee',    displayLabel: 'Student Activity / Cultural Fee',    category: 'student_life',     isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 19 },
  { componentKey: 'nss_fee',                 displayLabel: 'NSS / Community Service Fee',        category: 'student_life',     isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 20 },
  { componentKey: 'placement_service_fee',   displayLabel: 'Placement Service Fee',              category: 'student_life',     isRefundable: false, defaultOneTime: false, applicableToYears: [3, 4], displayOrder: 21 },
  { componentKey: 'alumni_fee',              displayLabel: 'Alumni Association Fee',             category: 'student_life',     isRefundable: false, defaultOneTime: true,  applicableToYears: [4],    displayOrder: 22 },
  { componentKey: 'convocation_fee',         displayLabel: 'Convocation Fee',                    category: 'student_life',     isRefundable: false, defaultOneTime: true,  applicableToYears: [4],    displayOrder: 23 },

  // ── Regulatory / Compliance ──
  { componentKey: 'university_affiliation_fee', displayLabel: 'University Affiliation Fee',      category: 'regulatory',       isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 24 },
  { componentKey: 'aicte_ugc_fee',           displayLabel: 'AICTE / UGC Contribution',           category: 'regulatory',       isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 25 },
  { componentKey: 'pta_fee',                 displayLabel: 'PTA Contribution',                   category: 'regulatory',       isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 26 },

  // ── Caution Deposits (refundable at exit) ──
  { componentKey: 'caution_deposit_general', displayLabel: 'General Caution Deposit',            category: 'caution',          isRefundable: true,  defaultOneTime: true,  applicableToYears: [1],    displayOrder: 27 },
  { componentKey: 'caution_deposit_library', displayLabel: 'Library Caution Deposit',            category: 'caution',          isRefundable: true,  defaultOneTime: true,  applicableToYears: [1],    displayOrder: 28 },
  { componentKey: 'caution_deposit_lab',     displayLabel: 'Lab Equipment Caution Deposit',      category: 'caution',          isRefundable: true,  defaultOneTime: true,  applicableToYears: [1],    displayOrder: 29 },

  // ── Conditional (inclusion via FeeComponentRule) ──
  { componentKey: 'hostel_fee',              displayLabel: 'Hostel Accommodation Fee',           category: 'conditional',      isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 30 },
  { componentKey: 'mess_fee',                displayLabel: 'Mess Fee',                           category: 'conditional',      isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 31 },
  { componentKey: 'transport_fee',           displayLabel: 'Transport Fee',                      category: 'conditional',      isRefundable: false, defaultOneTime: false, applicableToYears: [],     displayOrder: 32 },
  { componentKey: 'caution_deposit_hostel',  displayLabel: 'Hostel Caution Deposit',             category: 'conditional',      isRefundable: true,  defaultOneTime: true,  applicableToYears: [1],    displayOrder: 33 },
];

export interface SeedResult {
  collegeId: string;
  inserted: number;
  updated: number;
  skipped: number;
}

export interface SeedOptions {
  dryRun?: boolean;
}

/**
 * Seed the canonical template for a single college.
 *
 * Upsert semantics (plan §2.2):
 *   - missing          → insert (isDefault: true)
 *   - default exists   → update schema fields only, keep displayLabel
 *   - custom exists    → skip
 */
export async function seedFeeComponentTemplateForCollege(
  collegeId: string,
  opts: SeedOptions = {},
): Promise<SeedResult> {
  const dryRun = !!opts.dryRun;
  const result: SeedResult = { collegeId, inserted: 0, updated: 0, skipped: 0 };

  if (!mongoose.Types.ObjectId.isValid(collegeId)) {
    console.warn(
      `[seed-fee-component-template] invalid collegeId=${collegeId}; skipping`,
    );
    return result;
  }
  const cid = new mongoose.Types.ObjectId(collegeId);

  // Fetch only the keys/flags we need to decide insert/update/skip.
  const existing = await FeeComponentTemplate.find(
    { collegeId: cid },
    { componentKey: 1, isDefault: 1 },
  ).lean();
  const existingByKey = new Map<string, { _id: mongoose.Types.ObjectId; isDefault: boolean }>();
  for (const e of existing) {
    existingByKey.set(e.componentKey, {
      _id: e._id as mongoose.Types.ObjectId,
      isDefault: !!e.isDefault,
    });
  }

  // Accumulate bulkWrite ops; a single write round-trips per college.
  const ops: Parameters<typeof FeeComponentTemplate.bulkWrite>[0] = [];

  for (const c of CANONICAL_FEE_COMPONENTS) {
    const hit = existingByKey.get(c.componentKey);
    if (!hit) {
      result.inserted += 1;
      ops.push({
        insertOne: {
          document: {
            collegeId: cid,
            componentKey: c.componentKey,
            displayLabel: c.displayLabel,
            category: c.category,
            isRefundable: c.isRefundable,
            defaultOneTime: c.defaultOneTime,
            applicableToYears: [...c.applicableToYears],
            displayOrder: c.displayOrder,
            isDefault: true,
          },
        },
      });
      continue;
    }
    if (!hit.isDefault) {
      // Custom override — never trample.
      result.skipped += 1;
      continue;
    }
    // Existing default: re-sync canonical fields; leave displayLabel alone.
    result.updated += 1;
    ops.push({
      updateOne: {
        filter: { _id: hit._id },
        update: {
          $set: {
            category: c.category,
            isRefundable: c.isRefundable,
            defaultOneTime: c.defaultOneTime,
            applicableToYears: [...c.applicableToYears],
            displayOrder: c.displayOrder,
          },
        },
      },
    });
  }

  if (dryRun) return result;
  if (ops.length > 0) {
    await FeeComponentTemplate.bulkWrite(ops, { ordered: false });
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
export async function seedFeeComponentTemplateForAllColleges(
  opts: SeedOptions = {},
): Promise<SeedAllResult> {
  const colleges = await College.find({}, { _id: 1 }).lean();
  const perCollege: SeedResult[] = [];
  const failures: Array<{ collegeId: string; error: string }> = [];

  for (const c of colleges) {
    const id = String(c._id);
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await seedFeeComponentTemplateForCollege(id, opts);
      perCollege.push(r);
    } catch (e) {
      failures.push({ collegeId: id, error: (e as Error).message });
      console.warn(
        `[seed-fee-component-template] college=${id} failed: ${(e as Error).message}`,
      );
    }
  }

  return { collegesProcessed: colleges.length, perCollege, failures };
}

// ── CLI ───────────────────────────────────────────────────────────────

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
      const r = await seedFeeComponentTemplateForCollege(args.collegeId, {
        dryRun: args.dryRun,
      });
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-component-template] ${args.dryRun ? 'DRY-RUN ' : ''}` +
          `collegeId=${r.collegeId} inserted=${r.inserted} updated=${r.updated} skipped=${r.skipped}`,
      );
    } else {
      const all = await seedFeeComponentTemplateForAllColleges({ dryRun: args.dryRun });
      // eslint-disable-next-line no-console
      console.log(
        `[seed-fee-component-template] ${args.dryRun ? 'DRY-RUN ' : ''}` +
          `colleges=${all.collegesProcessed} failures=${all.failures.length}`,
      );
      if (all.failures.length > 0) exitCode = 1;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[seed-fee-component-template] fatal:', e);
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
  process.exit(exitCode);
}

// Only auto-run when invoked directly (ts-node src/scripts/seed-…).
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

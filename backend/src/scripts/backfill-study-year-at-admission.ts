/**
 * Backfill `Student.studyYearAtAdmission` for existing students (Task 21).
 *
 * Populates the new T21 schema field on every Student record that
 * pre-dates the field being added. A uniform default of `1` is applied
 * because we have no reliable signal to distinguish direct-admission
 * from lateral-entry in historical data. Admins MUST manually flip
 * lateral-entry students to 2+ via a follow-up Admin-UI task.
 *
 * Why this is NOT a "smart" backfill: inferring lateral-entry from
 * admission year vs. batch start year would be error-prone (diploma
 * students who joined a fresh Year-1 batch would be mis-flagged). The
 * safest default is the canonical `1`; humans resolve the edge cases.
 *
 * CLI:
 *   npx ts-node backend/src/scripts/backfill-study-year-at-admission.ts \
 *     [--college-id=<id>] [--dry-run] [--commit]
 *
 * Flags:
 *   --college-id=<id>   scope the backfill to one college (optional;
 *                       omit to cover every college)
 *   --dry-run           (default) audit-only: compute counts + CSV
 *                       without writing to the DB
 *   --commit            actually update the DB; mutually exclusive
 *                       with --dry-run
 *
 * Output:
 *   studyyear-backfill-<collegeId>-<mode>-<timestamp>.csv
 *     columns: studentId, action (would-update | already-set | updated),
 *              previousValue, newValue
 *   Summary log line: total students inspected, updated, skipped.
 *
 * Idempotent: subsequent runs skip students whose field is already set.
 *
 * Spec: .captain/specs/fee-configuration/ (T21 entry) + T20 Gap-1.
 */

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

import { Student } from '../models/people/Student';

export type BackfillMode = 'dry-run' | 'commit';

export interface BackfillOptions {
  collegeId?: string | null;
  mode: BackfillMode;
  /** Directory where the audit CSV is written. Defaults to cwd. */
  outputDir?: string;
  /** Batch size for the update loop. Defaults to 500. */
  batchSize?: number;
}

export interface BackfillRow {
  studentId: string;
  action: 'would-update' | 'already-set' | 'updated';
  previousValue: number | null;
  newValue: number;
}

export interface BackfillResult {
  collegeId: string | null;
  mode: BackfillMode;
  inspected: number;
  updated: number;
  wouldUpdate: number;
  alreadySet: number;
  csvPath: string | null;
  rows: BackfillRow[];
}

const DEFAULT_VALUE = 1;

/**
 * Run the backfill. Returns a structured result; the caller is
 * responsible for logging / process.exit.
 */
export async function runBackfill(
  opts: BackfillOptions,
): Promise<BackfillResult> {
  const mode = opts.mode;
  const batchSize = opts.batchSize ?? 500;
  const outputDir = opts.outputDir ?? process.cwd();

  // Validate + resolve the college-scope. We iterate over the whole
  // scope (missing OR already-set) so the audit CSV has a complete row
  // per inspected student — the missing/already-set classification is
  // done per-row inline.
  if (opts.collegeId && !mongoose.isValidObjectId(opts.collegeId)) {
    throw new Error(`Invalid --college-id=${opts.collegeId}`);
  }
  const scopeFilter: Record<string, unknown> = opts.collegeId
    ? { collegeId: new mongoose.Types.ObjectId(opts.collegeId) }
    : {};

  const rows: BackfillRow[] = [];
  let inspected = 0;
  let updated = 0;
  let wouldUpdate = 0;
  let alreadySet = 0;

  const cursor = Student.find(scopeFilter, {
    _id: 1,
    studyYearAtAdmission: 1,
  })
    .lean()
    .cursor({ batchSize });

  const pendingUpdateIds: mongoose.Types.ObjectId[] = [];

  // eslint-disable-next-line no-restricted-syntax
  for await (const s of cursor) {
    inspected += 1;
    const current = (s as { studyYearAtAdmission?: number | null })
      .studyYearAtAdmission;
    const needs = current === undefined || current === null;

    if (!needs) {
      alreadySet += 1;
      rows.push({
        studentId: String(s._id),
        action: 'already-set',
        previousValue: typeof current === 'number' ? current : null,
        newValue: typeof current === 'number' ? current : DEFAULT_VALUE,
      });
      continue;
    }

    if (mode === 'dry-run') {
      wouldUpdate += 1;
      rows.push({
        studentId: String(s._id),
        action: 'would-update',
        previousValue: null,
        newValue: DEFAULT_VALUE,
      });
    } else {
      pendingUpdateIds.push(s._id as mongoose.Types.ObjectId);
      if (pendingUpdateIds.length >= batchSize) {
        await Student.updateMany(
          { _id: { $in: pendingUpdateIds } },
          { $set: { studyYearAtAdmission: DEFAULT_VALUE } },
        );
        pendingUpdateIds.length = 0;
      }
      updated += 1;
      rows.push({
        studentId: String(s._id),
        action: 'updated',
        previousValue: null,
        newValue: DEFAULT_VALUE,
      });
    }
  }

  if (mode === 'commit' && pendingUpdateIds.length > 0) {
    await Student.updateMany(
      { _id: { $in: pendingUpdateIds } },
      { $set: { studyYearAtAdmission: DEFAULT_VALUE } },
    );
    pendingUpdateIds.length = 0;
  }

  // ── Write CSV ────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvName = `studyyear-backfill-${opts.collegeId ?? 'all'}-${mode}-${timestamp}.csv`;
  const csvPath = path.join(outputDir, csvName);
  const header = 'studentId,action,previousValue,newValue\n';
  const body = rows
    .map(
      (r) =>
        `${r.studentId},${r.action},${r.previousValue === null ? '' : r.previousValue},${r.newValue}`,
    )
    .join('\n');
  fs.writeFileSync(csvPath, header + body + (body.length > 0 ? '\n' : ''));

  return {
    collegeId: opts.collegeId ?? null,
    mode,
    inspected,
    updated,
    wouldUpdate,
    alreadySet,
    csvPath,
    rows,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────

export interface ParsedArgs {
  collegeId: string | null;
  mode: BackfillMode;
}

export function parseArgs(argv: string[]): ParsedArgs {
  let collegeId: string | null = null;
  let dryRun = false;
  let commit = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--commit') commit = true;
    else if (a.startsWith('--college-id=')) {
      collegeId = a.slice('--college-id='.length) || null;
    } else if (a.startsWith('--')) {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  if (dryRun && commit) {
    throw new Error('--dry-run and --commit are mutually exclusive');
  }
  // Dry-run is the default when neither flag is supplied.
  const mode: BackfillMode = commit ? 'commit' : 'dry-run';
  return { collegeId, mode };
}

async function main() {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[backfill-study-year-at-admission] ${(e as Error).message}`,
    );
    process.exit(2);
    return;
  }

  const { connectDB } = await import('../config/db');
  await connectDB();

  let exitCode = 0;
  try {
    const result = await runBackfill({
      collegeId: parsed.collegeId,
      mode: parsed.mode,
    });
    // eslint-disable-next-line no-console
    console.log(
      `[backfill-study-year-at-admission] ${result.mode.toUpperCase()}` +
        ` college=${result.collegeId ?? 'all'}` +
        ` inspected=${result.inspected}` +
        ` ${result.mode === 'commit' ? 'updated' : 'would-update'}=${
          result.mode === 'commit' ? result.updated : result.wouldUpdate
        }` +
        ` already-set=${result.alreadySet}` +
        ` csv=${result.csvPath}`,
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[backfill-study-year-at-admission] fatal:', e);
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

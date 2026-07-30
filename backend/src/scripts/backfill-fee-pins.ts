/**
 * Backfill fee-pins script (Task 16 — Fee Configuration).
 *
 * Pins existing students to the FeeStructureInstance that matches their
 * current (programme, branch, quota, category, year-of-study) combo so
 * the pin-first invoice path (T10) works for students who pre-existed
 * the fee-configuration rollout.
 *
 * ── Modes (mutually exclusive) ──
 *   --dry-run   (default if no mode flag) — produces audit CSV, NO DB writes.
 *   --commit    — writes pins via feePinService.pinYear.
 *   --rollback-pins-created-by=<label> --since=<ISO-date>
 *               — archives backfill-created pins. One-shot undo.
 *
 * ── Output ──
 * Writes `backfill-audit-<collegeId>-<mode>-<timestamp>.csv` unless the
 * caller explicitly supplies `opts.csvPath`. Tests always supply it.
 *
 * ── Finance sign-off flow ──
 *   1. Operator runs --dry-run, reviews the audit CSV with Finance.
 *   2. Finance signs off on CSV.
 *   3. Operator re-runs with --commit. Idempotent; safe to repeat.
 *   4. If something went wrong, --rollback-pins-created-by=system:backfill
 *      --since=<commit-time> archives the just-written pins.
 *
 * Spec: .captain/specs/fee-configuration/spec.md §Success Metrics, EC-1..EC-12
 * Plan: .captain/specs/fee-configuration/plan.md §2.4 Migration 3, §4.1, R-2
 * Tasks: .captain/specs/fee-configuration/tasks.md Task 16 AC
 */

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

import { Student, IStudent } from '../models/people/Student';
import { College } from '../models/College';
import { resolvePinYearForExistingStudent } from '../modules/people/student-import-pin';
import { AcademicYear } from '../models/academic-structure/AcademicYear';
import {
  resolveMatchingFeeStructureInstance,
  pinYear,
} from '../modules/finance/fee-pin-service';

// ── Types ─────────────────────────────────────────────────────────────

export type BackfillMode = 'dry-run' | 'commit' | 'rollback';

export interface BackfillOptions {
  mode: BackfillMode;
  collegeId: string;
  /** Optional explicit CSV path. Defaults to a timestamped file in cwd. */
  csvPath?: string;
  /** Required when mode = 'rollback'. */
  rollbackPinnedBy?: string;
  /** Required when mode = 'rollback'. */
  since?: Date;
  /** Batch size for the student cursor. Defaults to 100. */
  batchSize?: number;
  /** Progress heartbeat to stderr every N students. Defaults to 500. */
  progressEvery?: number;
}

export interface BackfillTotals {
  total: number;
  wouldPin: number;
  pinned: number;
  alreadyPinned: number;
  unpinnable: number;
  unresolvable: number;
  errors: number;
  archived: number;
  skipped: number;
}

export interface BackfillResult {
  exitCode: number;
  mode: BackfillMode;
  collegeId?: string;
  csvPath?: string;
  totals: BackfillTotals;
  error?: string;
}

export interface ParsedArgs {
  mode: BackfillMode;
  collegeId?: string;
  rollbackPinnedBy?: string;
  since?: Date;
  csvPath?: string;
}

// ── CLI parsing ───────────────────────────────────────────────────────

/**
 * Parse argv (slice(2) form). Exits early with a thrown Error on mode
 * conflicts; the main() entrypoint surfaces that as exitCode=1.
 */
export function parseBackfillArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { mode: 'dry-run' };
  let dryRun = false;
  let commit = false;
  let rollbackLabel: string | undefined;
  let sinceRaw: string | undefined;

  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--commit') commit = true;
    else if (a.startsWith('--college-id=')) {
      out.collegeId = a.slice('--college-id='.length) || undefined;
    } else if (a.startsWith('--rollback-pins-created-by=')) {
      rollbackLabel = a.slice('--rollback-pins-created-by='.length);
    } else if (a.startsWith('--since=')) {
      sinceRaw = a.slice('--since='.length);
    } else if (a.startsWith('--csv=')) {
      out.csvPath = a.slice('--csv='.length);
    }
  }

  const activeModes = [dryRun, commit, !!rollbackLabel].filter(Boolean).length;
  if (activeModes > 1) {
    throw new Error(
      '--dry-run, --commit, and --rollback-pins-created-by are mutually exclusive; pass exactly one (or none, which defaults to --dry-run).',
    );
  }

  if (rollbackLabel) {
    out.mode = 'rollback';
    out.rollbackPinnedBy = rollbackLabel;
    if (!sinceRaw) {
      throw new Error('--rollback-pins-created-by requires --since=<ISO-date>');
    }
    const parsed = new Date(sinceRaw);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`--since value '${sinceRaw}' is not a valid ISO date`);
    }
    out.since = parsed;
  } else if (commit) {
    out.mode = 'commit';
  } else {
    out.mode = 'dry-run';
  }

  return out;
}

// ── CSV helpers ───────────────────────────────────────────────────────

const CSV_HEADER = 'studentId,rollNumber,programmeId,yearOfStudy,status,detail\n';

/** Escape a field per RFC 4180. Commas, quotes, newlines → quoted. */
function csvField(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cols: Array<unknown>): string {
  return cols.map(csvField).join(',') + '\n';
}

/**
 * Open a write stream to `csvPath` and write the header synchronously.
 * Any I/O failure here surfaces as a rejected promise, which the
 * caller maps to `exitCode=1` without having touched the DB.
 */
function openCsv(csvPath: string): Promise<fs.WriteStream> {
  return new Promise((resolve, reject) => {
    // Ensure parent directory exists. We do NOT auto-create it —
    // unwritable path is a fatal precondition error per AC 6.
    try {
      const parent = path.dirname(csvPath);
      if (!fs.existsSync(parent)) {
        return reject(
          new Error(`CSV parent directory does not exist: ${parent}`),
        );
      }
    } catch (e) {
      return reject(e instanceof Error ? e : new Error(String(e)));
    }

    const stream = fs.createWriteStream(csvPath, { flags: 'w' });
    stream.once('error', reject);
    stream.once('open', () => {
      stream.write(CSV_HEADER, (err) => {
        if (err) return reject(err);
        resolve(stream);
      });
    });
  });
}

function closeCsv(stream: fs.WriteStream): Promise<void> {
  return new Promise((resolve) => {
    stream.end(() => resolve());
  });
}

// ── runBackfill ───────────────────────────────────────────────────────

const ACTIVE_STATUSES = ['active', 'year_back', 'detained'] as const;

function makeEmptyTotals(): BackfillTotals {
  return {
    total: 0,
    wouldPin: 0,
    pinned: 0,
    alreadyPinned: 0,
    unpinnable: 0,
    unresolvable: 0,
    errors: 0,
    archived: 0,
    skipped: 0,
  };
}

function defaultCsvPath(collegeId: string, mode: BackfillMode): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(
    process.cwd(),
    `backfill-audit-${collegeId}-${mode}-${ts}.csv`,
  );
}

/**
 * Callable entrypoint. Tests invoke this directly. `main()` wraps it
 * with CLI parsing + DB connect/disconnect + process.exit.
 */
export async function runBackfill(
  opts: BackfillOptions,
): Promise<BackfillResult> {
  const totals = makeEmptyTotals();
  const mode = opts.mode;

  // ── Precondition: college-id ─────────────────────────────────────
  if (!opts.collegeId) {
    const msg = '--college-id=<id> is required';
    process.stderr.write(`[BACKFILL ERROR] ${msg}\n`);
    return { exitCode: 1, mode, totals, error: msg };
  }
  if (!mongoose.isValidObjectId(opts.collegeId)) {
    const msg = `--college-id value '${opts.collegeId}' is not a valid ObjectId`;
    process.stderr.write(`[BACKFILL ERROR] ${msg}\n`);
    return { exitCode: 1, mode, collegeId: opts.collegeId, totals, error: msg };
  }

  // College must exist — catches typos before we write any CSV.
  const college = await College.findById(opts.collegeId).lean();
  if (!college) {
    const msg = `College ${opts.collegeId} not found`;
    process.stderr.write(`[BACKFILL ERROR] ${msg}\n`);
    return { exitCode: 1, mode, collegeId: opts.collegeId, totals, error: msg };
  }

  if (mode === 'rollback') {
    if (!opts.rollbackPinnedBy) {
      const msg = '--rollback-pins-created-by=<label> is required for rollback mode';
      process.stderr.write(`[BACKFILL ERROR] ${msg}\n`);
      return { exitCode: 1, mode, collegeId: opts.collegeId, totals, error: msg };
    }
    if (!opts.since || Number.isNaN(opts.since.getTime())) {
      const msg = '--since=<ISO-date> is required for rollback mode';
      process.stderr.write(`[BACKFILL ERROR] ${msg}\n`);
      return { exitCode: 1, mode, collegeId: opts.collegeId, totals, error: msg };
    }
  }

  // ── Open CSV BEFORE any DB write so we fail-fast on bad paths ─────
  const csvPath = opts.csvPath ?? defaultCsvPath(opts.collegeId, mode);
  let csv: fs.WriteStream;
  try {
    csv = await openCsv(csvPath);
  } catch (e) {
    const msg = `CSV path unwritable: ${String((e as Error).message ?? e)}`;
    process.stderr.write(`[BACKFILL ERROR] ${msg}\n`);
    return {
      exitCode: 1,
      mode,
      collegeId: opts.collegeId,
      csvPath,
      totals,
      error: msg,
    };
  }

  try {
    if (mode === 'rollback') {
      await runRollback(
        opts.collegeId,
        opts.rollbackPinnedBy!,
        opts.since!,
        csv,
        totals,
      );
    } else {
      await runScan(opts, csv, totals);
    }

    // Summary line (as a CSV comment so sheets ignore it, but operators see it).
    csv.write(
      `# total=${totals.total} wouldPin=${totals.wouldPin} pinned=${totals.pinned}` +
        ` alreadyPinned=${totals.alreadyPinned} unpinnable=${totals.unpinnable}` +
        ` unresolvable=${totals.unresolvable} archived=${totals.archived}` +
        ` errors=${totals.errors} skipped=${totals.skipped}\n`,
    );
    await closeCsv(csv);

    return {
      exitCode: 0,
      mode,
      collegeId: opts.collegeId,
      csvPath,
      totals,
    };
  } catch (e) {
    await closeCsv(csv).catch(() => undefined);
    const msg = (e as Error).message ?? String(e);
    process.stderr.write(`[BACKFILL FATAL] ${msg}\n`);
    return {
      exitCode: 1,
      mode,
      collegeId: opts.collegeId,
      csvPath,
      totals,
      error: msg,
    };
  }
}

// ── Scan (dry-run + commit share the same iteration) ─────────────────

async function runScan(
  opts: BackfillOptions,
  csv: fs.WriteStream,
  totals: BackfillTotals,
): Promise<void> {
  const batchSize = opts.batchSize ?? 100;
  const progressEvery = opts.progressEvery ?? 500;

  const cursor = Student.find({
    collegeId: opts.collegeId,
    status: { $in: [...ACTIVE_STATUSES] },
  }).cursor({ batchSize });

  let seen = 0;

  // `for await ... of cursor` streams documents from the cursor one-by-one.
  for await (const studentDoc of cursor) {
    const student = studentDoc as IStudent;
    totals.total += 1;
    seen += 1;
    if (seen % progressEvery === 0) {
      process.stderr.write(
        `[BACKFILL PROGRESS] seen=${seen} pinned=${totals.pinned} wouldPin=${totals.wouldPin}` +
          ` unpinnable=${totals.unpinnable} unresolvable=${totals.unresolvable}\n`,
      );
    }

    try {
      await processStudent(student, opts, csv, totals);
    } catch (e) {
      totals.errors += 1;
      process.stderr.write(
        `[BACKFILL ERROR] studentId=${String(student._id)} message=${String((e as Error).message ?? e)}\n`,
      );
      csv.write(
        csvRow([
          String(student._id),
          student.rollNumber ?? '',
          student.programmeId ? String(student.programmeId) : '',
          '',
          'error',
          (e as Error).message ?? 'unknown',
        ]),
      );
      // Continue — never fail the whole run on one student.
    }
  }
}

async function processStudent(
  student: IStudent,
  opts: BackfillOptions,
  csv: fs.WriteStream,
  totals: BackfillTotals,
): Promise<void> {
  const rollNumber = student.rollNumber ?? '';
  const programmeIdStr = student.programmeId ? String(student.programmeId) : '';

  // 1. Resolve yearOfStudy.
  //
  // The canonical resolver hard-fails without a Batch, and batch-less
  // students are exactly the ones bulk import produces (a stock catalogue has
  // no batch for MTECH/MBA). Writing them off as unresolvable made this
  // script skip precisely the population it exists to serve, so it falls back
  // to their admission year — the same rule bulk-pin uses. `unresolvable` now
  // means what it says: no academic year to pin against at all.
  const resolvedYear = await resolvePinYearForExistingStudent(
    String(student._id),
    student.studyYearAtAdmission,
  );
  const yearOfStudy = resolvedYear.yearOfStudy;
  let academicYearId = resolvedYear.academicYearId;
  if (!academicYearId) {
    const currentAy = await AcademicYear.findOne({
      collegeId: student.collegeId,
      isCurrent: true,
    }).select({ _id: 1 }).lean<{ _id: mongoose.Types.ObjectId } | null>();
    if (!currentAy) {
      totals.unresolvable += 1;
      csv.write(
        csvRow([
          String(student._id),
          rollNumber,
          programmeIdStr,
          '',
          'unresolvable',
          'no current academic year for this college',
        ]),
      );
      return;
    }
    academicYearId = String(currentAy._id);
  }

  // 2. Already pinned for that year?
  const existingActive = student.feePins.find(
    (p) => p.yearOfStudy === yearOfStudy && !p.archivedAt,
  );
  if (existingActive) {
    totals.alreadyPinned += 1;
    csv.write(
      csvRow([
        String(student._id),
        rollNumber,
        programmeIdStr,
        yearOfStudy,
        'already-pinned',
        String(existingActive._id),
      ]),
    );
    return;
  }

  // 3. Resolve the matching FSI (non-writing).
  const match = await resolveMatchingFeeStructureInstance(
    student,
    yearOfStudy,
    { academicYearId },
  );
  if (!match) {
    totals.unpinnable += 1;
    csv.write(
      csvRow([
        String(student._id),
        rollNumber,
        programmeIdStr,
        yearOfStudy,
        'unpinnable',
        'missing-FSI-for-combo',
      ]),
    );
    return;
  }

  if (opts.mode === 'dry-run') {
    totals.wouldPin += 1;
    csv.write(
      csvRow([
        String(student._id),
        rollNumber,
        programmeIdStr,
        yearOfStudy,
        'would-pin',
        `${String(match._id)}|total=${match.totalAmount}`,
      ]),
    );
    return;
  }

  // 4. Commit mode — actually pin.
  try {
    const pin = await pinYear(String(student._id), yearOfStudy, {
      pinnedBy: 'system:backfill',
      reason: 'initial',
      academicYearId,
      enqueueCommitmentSheet: false, // bulk run: don't spam the PDF queue
    });
    totals.pinned += 1;
    csv.write(
      csvRow([
        String(student._id),
        rollNumber,
        programmeIdStr,
        yearOfStudy,
        'pinned',
        `${String(pin._id)}|fsi=${String(match._id)}|total=${match.totalAmount}`,
      ]),
    );
  } catch (e) {
    totals.errors += 1;
    process.stderr.write(
      `[BACKFILL ERROR] pinYear failed studentId=${String(student._id)} year=${yearOfStudy} err=${String((e as Error).message ?? e)}\n`,
    );
    csv.write(
      csvRow([
        String(student._id),
        rollNumber,
        programmeIdStr,
        yearOfStudy,
        'error',
        `pin-failed:${(e as Error).message ?? 'unknown'}`,
      ]),
    );
  }
}

// ── Rollback ─────────────────────────────────────────────────────────

async function runRollback(
  collegeId: string,
  pinnedBy: string,
  since: Date,
  csv: fs.WriteStream,
  totals: BackfillTotals,
): Promise<void> {
  // Narrow the universe: students with any pin that matches the label +
  // is newer than `since`. We still walk the matching pins per-student
  // because the label + date check must run against each pin individually.
  const candidates = await Student.find({
    collegeId,
    feePins: {
      $elemMatch: {
        pinnedBy,
        pinnedAt: { $gte: since },
        archivedAt: null,
      },
    },
  });

  const now = new Date();
  for (const student of candidates) {
    totals.total += 1;
    let touched = 0;
    for (const pin of student.feePins) {
      if (
        pin.pinnedBy === pinnedBy &&
        pin.pinnedAt &&
        pin.pinnedAt.getTime() >= since.getTime() &&
        !pin.archivedAt
      ) {
        pin.archivedAt = now;
        pin.archiveReason = 'backfill_rollback';
        totals.archived += 1;
        touched += 1;
        csv.write(
          csvRow([
            String(student._id),
            String(pin._id),
            pin.yearOfStudy,
            String(pin.feeStructureInstanceId),
            'archived',
            `pinnedBy=${pinnedBy}|pinnedAt=${pin.pinnedAt.toISOString()}`,
          ]),
        );
      }
    }
    if (touched > 0) {
      await student.save();
    } else {
      totals.skipped += 1;
    }
  }
}

// ── CLI entrypoint ───────────────────────────────────────────────────

async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseBackfillArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(
      `[BACKFILL ERROR] ${(e as Error).message ?? String(e)}\n`,
    );
    process.exit(1);
  }

  const { connectDB } = await import('../config/db');
  await connectDB();

  try {
    const result = await runBackfill({
      mode: parsed.mode,
      collegeId: parsed.collegeId ?? '',
      csvPath: parsed.csvPath,
      rollbackPinnedBy: parsed.rollbackPinnedBy,
      since: parsed.since,
    });
    // eslint-disable-next-line no-console
    console.log(
      `[BACKFILL DONE] mode=${result.mode} college=${result.collegeId ?? '<none>'}` +
        ` csv=${result.csvPath ?? '<none>'} totals=${JSON.stringify(result.totals)}`,
    );
    process.exit(result.exitCode);
  } catch (e) {
    process.stderr.write(
      `[BACKFILL FATAL] ${(e as Error).message ?? String(e)}\n`,
    );
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

// Only auto-run when invoked directly.
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';

import { Student } from '../../models/people/Student';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

import {
  parseArgs,
  runBackfill,
} from '../backfill-study-year-at-admission';

/**
 * Task 21 — backfill-study-year-at-admission.
 *
 * Populates the new T21 `Student.studyYearAtAdmission` field on records
 * that pre-date the schema change. Uniform default = 1. Idempotent.
 *
 * Tests cover:
 *   - dry-run: reports would-update + already-set without writes
 *   - --commit: actually writes the default and flags CSV correctly
 *   - re-run after commit: no additional updates (idempotent)
 *   - flag parsing + mutual exclusion
 */

const oid = () => new mongoose.Types.ObjectId();

async function makeTmpDir(): Promise<string> {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'studyyear-backfill-'));
}

/**
 * Insert a student raw (bypassing Mongoose defaults so the record looks
 * like a pre-T21 row) OR with the schema default applied.
 */
async function seedStudents(opts: {
  collegeId: mongoose.Types.ObjectId;
  missing: number;
  set: number;
}) {
  // "missing" students — insert via raw collection so the default is
  // NOT applied (simulates historical data). Assign distinct roll
  // numbers so the sparse-unique (collegeId, rollNumber) index doesn't
  // collide on null values.
  const stamp = Date.now().toString(36);
  const rawDocs = Array.from({ length: opts.missing }).map((_, i) => ({
    collegeId: opts.collegeId,
    personId: oid(),
    admissionYear: 2022,
    rollNumber: `M-${stamp}-${i}`,
    status: 'active',
    feePins: [],
    isSealed: false,
    hasFinancialHold: false,
    onboardingStatus: 'not_started',
  }));
  if (rawDocs.length > 0) {
    await Student.collection.insertMany(rawDocs);
  }
  // "already-set" students — create via Mongoose; the schema default of
  // 1 applies (we also set it explicitly for belt-and-braces).
  for (let i = 0; i < opts.set; i += 1) {
    await Student.create({
      collegeId: opts.collegeId,
      personId: oid(),
      admissionYear: 2022,
      rollNumber: `S-${stamp}-${i}`,
      studyYearAtAdmission: 1,
      status: 'active',
    });
  }
}

describe('backfill-study-year-at-admission', () => {
  beforeAll(async () => {
    await setupMongo();
    await Student.syncIndexes();
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
  });

  // ── 5 ──────────────────────────────────────────────────────────────
  it('dry-run with mixed missing/already-set → reports counts; zero DB writes', async () => {
    const collegeId = oid();
    await seedStudents({ collegeId, missing: 3, set: 7 });
    const tmp = await makeTmpDir();

    const result = await runBackfill({
      collegeId: String(collegeId),
      mode: 'dry-run',
      outputDir: tmp,
    });

    expect(result.inspected).toBe(10);
    expect(result.wouldUpdate).toBe(3);
    expect(result.alreadySet).toBe(7);
    expect(result.updated).toBe(0);

    // Verify no DB mutation happened.
    const stillMissing = await Student.countDocuments({
      collegeId,
      studyYearAtAdmission: { $exists: false },
    });
    expect(stillMissing).toBe(3);

    // CSV written + well-formed.
    expect(result.csvPath && fs.existsSync(result.csvPath)).toBe(true);
    const csv = fs.readFileSync(result.csvPath!, 'utf8');
    expect(csv.startsWith('studentId,action,previousValue,newValue\n')).toBe(
      true,
    );
    const lines = csv.trim().split('\n');
    // Header + 10 rows.
    expect(lines.length).toBe(11);
    const wouldUpdateLines = lines.filter((l) =>
      l.includes(',would-update,'),
    );
    const alreadySetLines = lines.filter((l) =>
      l.includes(',already-set,'),
    );
    expect(wouldUpdateLines.length).toBe(3);
    expect(alreadySetLines.length).toBe(7);
  });

  // ── 6 ──────────────────────────────────────────────────────────────
  it('--commit with mixed data → updates missing to 1; skips already-set', async () => {
    const collegeId = oid();
    await seedStudents({ collegeId, missing: 3, set: 7 });
    const tmp = await makeTmpDir();

    const result = await runBackfill({
      collegeId: String(collegeId),
      mode: 'commit',
      outputDir: tmp,
    });

    expect(result.inspected).toBe(10);
    expect(result.updated).toBe(3);
    expect(result.alreadySet).toBe(7);

    // Every student now has the field = 1.
    const missingAfter = await Student.countDocuments({
      collegeId,
      studyYearAtAdmission: { $exists: false },
    });
    expect(missingAfter).toBe(0);

    const allOnes = await Student.countDocuments({
      collegeId,
      studyYearAtAdmission: 1,
    });
    expect(allOnes).toBe(10);

    // CSV tags 3 rows as `updated`, 7 as `already-set`.
    const csv = fs.readFileSync(result.csvPath!, 'utf8');
    const updatedLines = csv
      .split('\n')
      .filter((l) => l.includes(',updated,'));
    expect(updatedLines.length).toBe(3);
  });

  // ── 7 ──────────────────────────────────────────────────────────────
  it('re-running --commit is idempotent (no additional updates)', async () => {
    const collegeId = oid();
    await seedStudents({ collegeId, missing: 3, set: 7 });
    const tmp = await makeTmpDir();

    await runBackfill({
      collegeId: String(collegeId),
      mode: 'commit',
      outputDir: tmp,
    });
    const second = await runBackfill({
      collegeId: String(collegeId),
      mode: 'commit',
      outputDir: tmp,
    });

    expect(second.updated).toBe(0);
    expect(second.alreadySet).toBe(10);
    expect(second.wouldUpdate).toBe(0);
  });

  // ── 8 ──────────────────────────────────────────────────────────────
  it('parseArgs: dry-run is default; --dry-run + --commit is a hard error; unknown flags reject', () => {
    expect(parseArgs([])).toEqual({ collegeId: null, mode: 'dry-run' });
    expect(parseArgs(['--dry-run'])).toEqual({ collegeId: null, mode: 'dry-run' });
    expect(parseArgs(['--commit'])).toEqual({ collegeId: null, mode: 'commit' });
    const id = String(oid());
    expect(parseArgs([`--college-id=${id}`, '--commit'])).toEqual({
      collegeId: id,
      mode: 'commit',
    });

    expect(() => parseArgs(['--dry-run', '--commit'])).toThrow(
      /mutually exclusive/,
    );
    expect(() => parseArgs(['--rollback'])).toThrow(/Unknown flag/);
  });
});

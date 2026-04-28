import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

import { FeeCategory } from '../../models/finance/FeeCategory';
import { College } from '../../models/College';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

import {
  CANONICAL_FEE_CATEGORIES,
  seedFeeCategoriesForCollege,
  seedFeeCategoriesForAllColleges,
  parseArgs,
} from '../seed-fee-categories';

const collegeInput = (code: string) => ({
  name: `College ${code}`,
  code,
  address: { line1: 'Addr', city: 'Hyderabad', state: 'TS', pincode: '500001' },
  contactEmail: `${code}@example.com`,
  contactPhone: '9999999999',
});

describe('seed-fee-categories', () => {
  beforeAll(async () => {
    await setupMongo();
    await FeeCategory.syncIndexes();
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
    vi.restoreAllMocks();
  });

  // ── Canonical list shape ───────────────────────────────────────────

  it('exports the canonical list with non-empty rows of the expected shape', () => {
    expect(Array.isArray(CANONICAL_FEE_CATEGORIES)).toBe(true);
    expect(CANONICAL_FEE_CATEGORIES.length).toBeGreaterThan(0);
    for (const c of CANONICAL_FEE_CATEGORIES) {
      expect(typeof c.code).toBe('string');
      expect(c.code.length).toBeGreaterThan(0);
      expect(c.code).toBe(c.code.toUpperCase()); // codes are uppercase
      expect(typeof c.name).toBe('string');
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.description).toBe('string');
      expect(['active', 'inactive']).toContain(c.status);
    }
  });

  it('canonical codes are unique', () => {
    const codes = CANONICAL_FEE_CATEGORIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('canonical list contains the standard Indian categories (OC, OBC, SC, ST, EWS, NRI)', () => {
    const codes = new Set(CANONICAL_FEE_CATEGORIES.map((c) => c.code));
    for (const required of ['OC', 'OBC', 'SC', 'ST', 'EWS', 'NRI']) {
      expect(codes.has(required)).toBe(true);
    }
  });

  // ── seedFeeCategoriesForCollege ────────────────────────────────────

  it('inserts the full canonical set for a new college', async () => {
    const college = await College.create(collegeInput('SEED1'));

    const result = await seedFeeCategoriesForCollege(String(college._id));

    expect(result.inserted).toBe(CANONICAL_FEE_CATEGORIES.length);
    expect(result.skipped).toBe(0);

    const docs = await FeeCategory.find({ collegeId: college._id });
    expect(docs.length).toBe(CANONICAL_FEE_CATEGORIES.length);
    const codes = new Set(docs.map((d) => d.code));
    for (const c of CANONICAL_FEE_CATEGORIES) {
      expect(codes.has(c.code)).toBe(true);
    }
    // status defaults to 'active' on every seeded row
    expect(docs.every((d) => d.status === 'active')).toBe(true);
  });

  it('re-running on the same college is idempotent (no duplicates, all skipped)', async () => {
    const college = await College.create(collegeInput('SEED2'));

    await seedFeeCategoriesForCollege(String(college._id));
    const second = await seedFeeCategoriesForCollege(String(college._id));

    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(CANONICAL_FEE_CATEGORIES.length);

    const docs = await FeeCategory.find({ collegeId: college._id });
    expect(docs.length).toBe(CANONICAL_FEE_CATEGORIES.length);
  });

  it('preserves admin edits on existing categories (skip rule does not trample)', async () => {
    const college = await College.create(collegeInput('SEED3'));
    // Admin pre-creates an OC row with a custom name + description before
    // running the seed. The seed must not overwrite their changes.
    await FeeCategory.create({
      collegeId: college._id,
      code: 'OC',
      name: 'Open / General (custom label)',
      description: 'Internal note: maps to state-board category G1',
      status: 'inactive', // also non-default status
    });

    const result = await seedFeeCategoriesForCollege(String(college._id));

    // OC should be skipped, the rest inserted
    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(CANONICAL_FEE_CATEGORIES.length - 1);

    const oc = await FeeCategory.findOne({ collegeId: college._id, code: 'OC' });
    expect(oc?.name).toBe('Open / General (custom label)');
    expect(oc?.description).toBe('Internal note: maps to state-board category G1');
    expect(oc?.status).toBe('inactive');
  });

  it('cross-college isolation: seeding college A does not touch college B', async () => {
    const a = await College.create(collegeInput('SEEDA'));
    const b = await College.create(collegeInput('SEEDB'));

    await seedFeeCategoriesForCollege(String(a._id));

    const aDocs = await FeeCategory.find({ collegeId: a._id });
    const bDocs = await FeeCategory.find({ collegeId: b._id });
    expect(aDocs.length).toBe(CANONICAL_FEE_CATEGORIES.length);
    expect(bDocs.length).toBe(0);
  });

  it('two colleges may independently hold the same canonical codes', async () => {
    const a = await College.create(collegeInput('SEEDC'));
    const b = await College.create(collegeInput('SEEDD'));

    await seedFeeCategoriesForCollege(String(a._id));
    await seedFeeCategoriesForCollege(String(b._id));

    const aOC = await FeeCategory.findOne({ collegeId: a._id, code: 'OC' });
    const bOC = await FeeCategory.findOne({ collegeId: b._id, code: 'OC' });
    expect(aOC).toBeTruthy();
    expect(bOC).toBeTruthy();
    expect(String(aOC?._id)).not.toBe(String(bOC?._id));
  });

  it('--dry-run does not write anything', async () => {
    const college = await College.create(collegeInput('SEEDE'));

    const result = await seedFeeCategoriesForCollege(String(college._id), {
      dryRun: true,
    });

    // Result still reports the would-have-inserted count
    expect(result.inserted).toBe(CANONICAL_FEE_CATEGORIES.length);
    // …but the DB stays empty
    const docs = await FeeCategory.find({ collegeId: college._id });
    expect(docs.length).toBe(0);
  });

  it('invalid collegeId is logged + returns a no-op result', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await seedFeeCategoriesForCollege('not-an-objectid');

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  // ── seedFeeCategoriesForAllColleges ────────────────────────────────

  it('iterates every College and seeds each', async () => {
    const a = await College.create(collegeInput('ALLA'));
    const b = await College.create(collegeInput('ALLB'));

    const result = await seedFeeCategoriesForAllColleges();

    expect(result.collegesProcessed).toBe(2);
    expect(result.failures.length).toBe(0);
    expect(result.perCollege.length).toBe(2);

    const aDocs = await FeeCategory.find({ collegeId: a._id });
    const bDocs = await FeeCategory.find({ collegeId: b._id });
    expect(aDocs.length).toBe(CANONICAL_FEE_CATEGORIES.length);
    expect(bDocs.length).toBe(CANONICAL_FEE_CATEGORIES.length);
  });

  // ── parseArgs ──────────────────────────────────────────────────────

  it('parseArgs: --college-id', () => {
    expect(parseArgs(['--college-id=64a000000000000000000abc'])).toEqual({
      collegeId: '64a000000000000000000abc',
      dryRun: false,
    });
  });

  it('parseArgs: --dry-run', () => {
    expect(parseArgs(['--dry-run'])).toEqual({ collegeId: null, dryRun: true });
  });

  it('parseArgs: both flags together', () => {
    expect(parseArgs(['--dry-run', '--college-id=abc'])).toEqual({
      collegeId: 'abc',
      dryRun: true,
    });
  });

  it('parseArgs: empty argv → defaults', () => {
    expect(parseArgs([])).toEqual({ collegeId: null, dryRun: false });
  });
});

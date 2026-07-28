/**
 * Blocked-row accounting across the preview/commit seam (final review,
 * Important 5).
 *
 * Preview went to deliberate trouble to keep blocked rows out of
 * `errorCount` — blocked is a valid row the business rules refuse
 * (sealed / exited / alumni / a fee-axis move), not a validation failure.
 * But the row was persisted with `outcome: 'error'` and `error: ''`, and
 * commit counted every non-success result into `failureCount`, so a job
 * whose only anomaly was one blocked row finished as `'partial'` with
 * "Committed 9 of 10 rows; 1 failed." The two halves of the engine
 * disagreed about what "blocked" means.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import * as registry from '../bulk-import-registry';
import { uploadAndValidate, commitImportJob } from '../bulk-import-service';
import type { ImportSchemaDefinition } from '../import-schemas/types';

vi.mock('../../../shared/s3/s3-client', () => ({
  putObject: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue({ url: 'https://example.test/mock', expiresAt: new Date() }),
}));

const COLLEGE = '000000000000000000000001';

/** Row `code` drives the verdict: B => blocked, X => field error, else create. */
function fakeSchema(commitOne = vi.fn(async () => ({ id: 'x' }))): ImportSchemaDefinition {
  return {
    entityType: 'blocked-fixture',
    label: 'Fixture',
    description: 'test only',
    fields: [
      {
        fieldKey: 'code', label: 'Code', type: 'string', required: true,
        validate: (raw: string) => {
          const v = raw.trim();
          if (!v) return { ok: false as const, error: 'required' };
          if (v === 'X') return { ok: false as const, error: 'bad code' };
          return { ok: true as const, value: v };
        },
      },
    ],
    sampleRow: { code: 'A' },
    validateRow: async (typed) => (
      typed.code === 'B'
        ? { ok: true as const, action: 'blocked' as const, notes: ['record is sealed'] }
        : { ok: true as const, action: 'create' as const }
    ),
    commitOne,
  };
}

async function run(def: ImportSchemaDefinition, csv: string) {
  vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
  return uploadAndValidate({
    collegeId: COLLEGE, performedBy: 'tester', entityType: def.entityType,
    fileBuffer: Buffer.from(csv), fileName: 'f.csv', declaredMime: 'text/csv',
  });
}

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); vi.restoreAllMocks(); });

describe('blocked rows at preview', () => {
  it('persists its own outcome, not a nameless error', async () => {
    const p = await run(fakeSchema(), 'code\nA\nB');
    const blocked = p.job.results[1]!;
    expect(blocked.outcome).toBe('blocked');
    // Was the empty string, because `errors` is empty for a blocked row.
    expect(blocked.error).toBeUndefined();
    expect(blocked.notes).toEqual(['record is sealed']);
  });

  it('tallies blockedCount on the job and keeps it out of failureCount', async () => {
    const p = await run(fakeSchema(), 'code\nA\nB');
    expect(p.job.blockedCount).toBe(1);
    expect(p.job.failureCount).toBe(0);
    expect(p.errorCount).toBe(0);
    expect(p.actionCounts.blocked).toBe(1);
    expect(p.validCount).toBe(1);
  });
});

describe('blocked rows at commit', () => {
  it('are never attempted and never inflate failureCount', async () => {
    const commitOne = vi.fn(async () => ({ id: 'x' }));
    const def = fakeSchema(commitOne);
    const p = await run(def, 'code\nA\nB');

    vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
    const job = await commitImportJob(COLLEGE, String(p.job._id), 'tester');

    expect(commitOne).toHaveBeenCalledTimes(1);
    expect(job.successCount).toBe(1);
    expect(job.failureCount).toBe(0);
    expect(job.blockedCount).toBe(1);
    // One blocked row is not a partial failure — nothing failed.
    expect(job.status).toBe('completed');
    expect(job.errorSummary).toBe('Committed 1 of 2 rows; 1 blocked and not written.');
  });

  it('still reports genuine failures alongside blocked rows', async () => {
    const def = fakeSchema();
    const p = await run(def, 'code\nA\nB\nX');

    vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
    const job = await commitImportJob(COLLEGE, String(p.job._id), 'tester');

    expect(job.successCount).toBe(1);
    expect(job.failureCount).toBe(1);
    expect(job.blockedCount).toBe(1);
    expect(job.status).toBe('partial');
    expect(job.errorSummary).toBe('Committed 1 of 3 rows; 1 failed; 1 blocked and not written.');
  });

  it('leaves a clean job untouched — no blocked tally, no summary', async () => {
    const def = fakeSchema();
    const p = await run(def, 'code\nA');

    vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
    const job = await commitImportJob(COLLEGE, String(p.job._id), 'tester');

    expect(job.successCount).toBe(1);
    expect(job.failureCount).toBe(0);
    expect(job.blockedCount).toBe(0);
    expect(job.status).toBe('completed');
    expect(job.errorSummary).toBeUndefined();
  });
});

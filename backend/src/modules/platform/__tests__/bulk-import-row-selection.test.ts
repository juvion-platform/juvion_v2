import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import * as registry from '../bulk-import-registry';
import { uploadAndValidate, commitImportJob } from '../bulk-import-service';
import type { ImportSchemaDefinition } from '../import-schemas/types';
import { AppError } from '../../../middleware/errorHandler';

vi.mock('../../../shared/s3/s3-client', () => ({
  isS3Configured: vi.fn().mockReturnValue(true),
  putObject: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue({ url: 'https://example.test/mock', expiresAt: new Date() }),
}));

vi.setConfig({ testTimeout: 20_000 });

const COLLEGE = '000000000000000000000001';

/** Helper to construct fake schemas with varying behaviors. */
function selectionFakeSchema(commitOne = vi.fn(async () => ({ id: 'x' }))): ImportSchemaDefinition {
  return {
    entityType: 'selection-fixture',
    label: 'Fixture',
    description: 'test selection only',
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

describe('Bulk Import Per-Row Selection', () => {
  it('Test 1 - Partial selection: commits only selected rows, sets unselected to skipped, and stores them in history', async () => {
    const commitOne = vi.fn(async () => ({ id: 'created-id' }));
    const def = selectionFakeSchema(commitOne);
    // 5 eligible rows
    const preview = await run(def, 'code\nA1\nA2\nA3\nA4\nA5');
    
    vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
    // Select rows 1, 2, 5. Skip 3 and 4.
    const job = await commitImportJob(COLLEGE, String(preview.job._id), 'tester', {
      selectedRowNumbers: [1, 2, 5],
    });

    expect(commitOne).toHaveBeenCalledTimes(3);
    expect(job.successCount).toBe(3);
    expect(job.skippedCount).toBe(2);
    expect(job.failureCount).toBe(0);
    expect(job.blockedCount).toBe(0);
    expect(job.status).toBe('completed');
    expect(job.errorSummary).toBe('Committed 3 of 5 rows; 2 skipped.');

    // Verify row outcomes
    const results = job.results;
    expect(results[0]?.outcome).toBe('success');
    expect(results[1]?.outcome).toBe('success');
    expect(results[2]?.outcome).toBe('skipped');
    expect(results[2]?.notes).toEqual(['skipped - not selected by operator']);
    expect(results[3]?.outcome).toBe('skipped');
    expect(results[3]?.notes).toEqual(['skipped - not selected by operator']);
    expect(results[4]?.outcome).toBe('success');
  });

  it('Test 2 - Legacy behavior: commits all eligible rows when no selection is sent', async () => {
    const commitOne = vi.fn(async () => ({ id: 'created-id' }));
    const def = selectionFakeSchema(commitOne);
    const preview = await run(def, 'code\nA1\nA2\nA3');
    
    vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
    const job = await commitImportJob(COLLEGE, String(preview.job._id), 'tester');

    expect(commitOne).toHaveBeenCalledTimes(3);
    expect(job.successCount).toBe(3);
    expect(job.skippedCount).toBe(0);
    expect(job.status).toBe('completed');
  });

  it('Test 3 - Invalid row reference: rejects if client sends an invalid row number (e.g. 999)', async () => {
    const def = selectionFakeSchema();
    const preview = await run(def, 'code\nA1\nA2');
    
    vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
    await expect(
      commitImportJob(COLLEGE, String(preview.job._id), 'tester', {
        selectedRowNumbers: [1, 999],
      })
    ).rejects.toThrow(new AppError(400, 'Invalid row reference: row 999 does not exist in this import job.'));
  });

  it('Test 4 - Blocked/Error row selection: rejects if client selects an ineligible row', async () => {
    const def = selectionFakeSchema();
    // A1 => success, B => blocked, X => error (validation error)
    const preview = await run(def, 'code\nA1\nB\nX');
    
    vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
    
    // Select row 2 (blocked)
    await expect(
      commitImportJob(COLLEGE, String(preview.job._id), 'tester', {
        selectedRowNumbers: [1, 2],
      })
    ).rejects.toThrow(new AppError(400, 'Invalid row selection: row 2 is not eligible for import (status: blocked).'));

    // Select row 3 (error)
    await expect(
      commitImportJob(COLLEGE, String(preview.job._id), 'tester', {
        selectedRowNumbers: [1, 3],
      })
    ).rejects.toThrow(new AppError(400, 'Invalid row selection: row 3 is not eligible for import (status: error).'));
  });

  it('Test 5 - Double commit: rejects double commit attempts', async () => {
    const def = selectionFakeSchema();
    const preview = await run(def, 'code\nA1');
    
    vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
    await commitImportJob(COLLEGE, String(preview.job._id), 'tester');

    // Attempt second commit
    await expect(
      commitImportJob(COLLEGE, String(preview.job._id), 'tester')
    ).rejects.toThrow(new AppError(409, 'Cannot commit job in status "completed". Re-upload the file to retry.'));
  });

  it('Test 6 - Large selection: works efficiently up to the ceiling (e.g. 2,000 identifiers)', async () => {
    const commitOne = vi.fn(async () => ({ id: 'x' }));
    const def = selectionFakeSchema(commitOne);
    
    // Construct a job directly without full parser simulation to test scaling of commitImportJob
    const results = [];
    const selectedRowNumbers = [];
    for (let i = 1; i <= 4000; i++) {
      results.push({
        row: i,
        outcome: 'success' as const,
        raw: { code: `A${i}` },
        action: 'create' as const,
      });
      if (i <= 2000) {
        selectedRowNumbers.push(i);
      }
    }
    
    const { ImportJob } = await import('../../../models/platform/ImportJob');
    const jobDoc = await ImportJob.create({
      collegeId: COLLEGE,
      performedBy: 'tester',
      entityType: def.entityType,
      schemaSnapshot: [],
      fileName: 'large.csv',
      mimeType: 'text/csv',
      sizeBytes: 1000,
      status: 'preview_ready',
      totalRows: 4000,
      results,
    });

    vi.spyOn(registry, 'getImportSchema').mockReturnValue(def);
    const start = Date.now();
    const completedJob = await commitImportJob(COLLEGE, String(jobDoc._id), 'tester', {
      selectedRowNumbers,
    });
    const elapsed = Date.now() - start;

    expect(commitOne).toHaveBeenCalledTimes(2000);
    expect(completedJob.successCount).toBe(2000);
    expect(completedJob.skippedCount).toBe(2000);
    
    // Performance assertion: committing 2,000 rows (excluding mock DB logic) should process selection instantly (e.g. within 15 seconds)
    expect(elapsed).toBeLessThan(15000);
  });
});

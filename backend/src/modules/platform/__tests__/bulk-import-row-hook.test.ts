import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import * as registry from '../bulk-import-registry';
import { uploadAndValidate } from '../bulk-import-service';
import type { ImportSchemaDefinition } from '../import-schemas/types';

// uploadAndValidate uploads the source file to S3 before validating rows.
// Mocked here (same pattern as photo-service.test.ts) so the test exercises
// real CSV parsing + validation without a real bucket or network call.
vi.mock('../../../shared/s3/s3-client', () => ({
  putObject: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue({ url: 'https://example.test/mock', expiresAt: new Date() }),
}));

const COLLEGE = '000000000000000000000001';

function fakeSchema(
  validateRow?: ImportSchemaDefinition['validateRow'],
): ImportSchemaDefinition {
  return {
    entityType: 'rowhook-fixture',
    label: 'Fixture',
    description: 'test only',
    fields: [
      {
        fieldKey: 'code', label: 'Code', type: 'string', required: true,
        validate: (raw: string) => raw.trim()
          ? { ok: true as const, value: raw.trim() }
          : { ok: false as const, error: 'required' },
      },
    ],
    sampleRow: { code: 'A' },
    validateRow,
    commitOne: async () => ({ id: 'x' }),
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

describe('validateRow hook', () => {
  it('is optional — a schema without it still previews', async () => {
    const p = await run(fakeSchema(), 'code\nA');
    expect(p.validCount).toBe(1);
    expect(p.errorCount).toBe(0);
  });

  it('labels each row with the action the hook returns', async () => {
    const p = await run(
      fakeSchema(async (typed) => ({
        ok: true, action: typed.code === 'A' ? 'create' : 'update',
      })),
      'code\nA\nB',
    );
    expect(p.previewRows.map((r) => r.action)).toEqual(['create', 'update']);
    expect(p.actionCounts).toEqual({ create: 1, update: 1, blocked: 0 });
  });

  it('a hook rejection fails the row with its message', async () => {
    const p = await run(
      fakeSchema(async () => ({ ok: false, error: 'unknown programme code "NOPE"' })),
      'code\nA',
    );
    expect(p.validCount).toBe(0);
    expect(p.errorCount).toBe(1);
    expect(p.previewRows[0]!.errors[0]!.error).toBe('unknown programme code "NOPE"');
  });

  it('blocked rows are counted but not valid for commit', async () => {
    const p = await run(
      fakeSchema(async () => ({ ok: true, action: 'blocked', notes: ['record is sealed'] })),
      'code\nA',
    );
    expect(p.actionCounts.blocked).toBe(1);
    expect(p.validCount).toBe(0);
    expect(p.previewRows[0]!.notes).toEqual(['record is sealed']);
  });

  it('does not run the hook for a row that already failed field validation', async () => {
    const hook = vi.fn(async () => ({ ok: true as const, action: 'create' as const }));
    await run(fakeSchema(hook), 'code\n');
    expect(hook).not.toHaveBeenCalled();
  });

  it('surfaces notes so preview can report side effects before they happen', async () => {
    const p = await run(
      fakeSchema(async () => ({ ok: true, action: 'create', notes: ['will create 1 guardian'] })),
      'code\nA',
    );
    expect(p.previewRows[0]!.notes).toEqual(['will create 1 guardian']);
  });

  it('sums side-effect counters across every row, not just previewed ones', async () => {
    const p = await run(
      fakeSchema(async (typed) => ({
        ok: true,
        action: 'create',
        sideEffects: typed.code === 'A' ? { guardians: 2 } : { guardians: 1 },
      })),
      'code\nA\nB',
    );
    expect(p.sideEffectTotals).toEqual({ guardians: 3 });
  });

  it('leaves sideEffectTotals empty for a schema with no hook', async () => {
    const p = await run(fakeSchema(), 'code\nA');
    expect(p.sideEffectTotals).toEqual({});
  });

  it('echoes what the row\'s codes resolved to', async () => {
    const p = await run(
      fakeSchema(async () => ({
        ok: true, action: 'create', resolved: { Programme: 'BTech CSE', Branch: 'Computer Science' },
      })),
      'code\nA',
    );
    expect(p.previewRows[0]!.resolved).toEqual({
      Programme: 'BTech CSE', Branch: 'Computer Science',
    });
  });
});

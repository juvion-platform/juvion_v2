/**
 * Intra-file duplicate natural keys (final review, Critical 2).
 *
 * Preview classifies every row against the database as it stands BEFORE the
 * batch; commit processes rows sequentially, each seeing its predecessors'
 * writes. Nothing checked the file against itself, so two rows sharing a
 * rollNumber both previewed as "Create" and, at commit, row 2 matched the
 * student row 1 had just created and overwrote its Person and Student with
 * row 2's data. Row 2's student never existed, row 1's was destroyed, and the
 * job reported two successes. Adopting upsert removed the unique-index safety
 * net (which would have hard-failed row 2) and nothing replaced it.
 *
 * The detection lives in the shared engine because the engine owns the only
 * file-scoped state, but it is OPT-IN via `naturalKeys` so the four other
 * entity types (faculty, staff, applicant, programme), which declare none,
 * run exactly the code path they ran before.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import * as registry from '../bulk-import-registry';
import { uploadAndValidate } from '../bulk-import-service';
import type { ImportSchemaDefinition } from '../import-schemas/types';

vi.mock('../../../shared/s3/s3-client', () => ({
  putObject: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue({ url: 'https://example.test/mock', expiresAt: new Date() }),
}));

const COLLEGE = '000000000000000000000001';

function fakeSchema(
  naturalKeys?: ImportSchemaDefinition['naturalKeys'],
): ImportSchemaDefinition {
  return {
    entityType: 'dupkey-fixture',
    label: 'Fixture',
    description: 'test only',
    fields: [
      {
        fieldKey: 'code', label: 'Code', type: 'string', required: true,
        validate: (raw: string) => raw.trim()
          ? { ok: true as const, value: raw.trim() }
          : { ok: false as const, error: 'required' },
      },
      {
        fieldKey: 'alt', label: 'Alt', type: 'string', required: false,
        validate: (raw: string) => ({ ok: true as const, value: raw.trim() }),
      },
    ],
    sampleRow: { code: 'A', alt: '' },
    naturalKeys,
    commitOne: async () => ({ id: 'x' }),
  };
}

/** Declares both columns as keys, so a collision on EITHER is a collision. */
const twoKeys: ImportSchemaDefinition['naturalKeys'] = (typedRow) => {
  const keys: Array<{ label: string; value: string }> = [];
  const code = String(typedRow.code ?? '').trim();
  if (code) keys.push({ label: 'code', value: code });
  const alt = String(typedRow.alt ?? '').trim();
  if (alt) keys.push({ label: 'alt', value: alt });
  return keys;
};

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

describe('intra-file duplicate natural keys', () => {
  it('fails the second row and names the key and the row it collides with', async () => {
    const p = await run(fakeSchema(twoKeys), 'code,alt\nA,\nB,\nA,');
    expect(p.previewRows[0]!.valid).toBe(true);
    expect(p.previewRows[1]!.valid).toBe(true);
    expect(p.previewRows[2]!.valid).toBe(false);
    expect(p.previewRows[2]!.errors[0]!.error).toBe('duplicate code "A" — also on row 1');
    expect(p.errorCount).toBe(1);
    expect(p.validCount).toBe(2);
  });

  it('collides on ANY declared key, not just the highest-precedence one', async () => {
    // Row 2 carries a fresh `code` but repeats row 1's `alt`. The matcher
    // falls through from one key to the next, so at commit row 2 would still
    // resolve to the record row 1 created.
    const p = await run(fakeSchema(twoKeys), 'code,alt\nA,X\nB,X');
    expect(p.previewRows[1]!.valid).toBe(false);
    expect(p.previewRows[1]!.errors[0]!.error).toBe('duplicate alt "X" — also on row 1');
  });

  it('leaves rows with distinct keys alone', async () => {
    const p = await run(fakeSchema(twoKeys), 'code,alt\nA,X\nB,Y');
    expect(p.errorCount).toBe(0);
    expect(p.validCount).toBe(2);
  });

  it('does not treat a blank optional key as a collision', async () => {
    const p = await run(fakeSchema(twoKeys), 'code,alt\nA,\nB,');
    expect(p.errorCount).toBe(0);
    expect(p.validCount).toBe(2);
  });

  it('does not claim keys for a row that already failed field validation', async () => {
    // Row 1 fails on the required `code`, so it claims nothing; row 2's
    // identical `alt` must not be reported as colliding with a dead row.
    const p = await run(fakeSchema(twoKeys), 'code,alt\n,X\nB,X');
    expect(p.previewRows[0]!.valid).toBe(false);
    expect(p.previewRows[1]!.valid).toBe(true);
  });

  // The opt-in guarantee. faculty / staff / applicant / programme declare no
  // naturalKeys, so their behaviour must be byte-identical to before.
  it('is opt-in — a schema declaring no naturalKeys still previews duplicates as valid', async () => {
    const p = await run(fakeSchema(), 'code,alt\nA,\nA,');
    expect(p.errorCount).toBe(0);
    expect(p.validCount).toBe(2);
    expect(p.previewRows.every((r) => r.valid)).toBe(true);
  });
});

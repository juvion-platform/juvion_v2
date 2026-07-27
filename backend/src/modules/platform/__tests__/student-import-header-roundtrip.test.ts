/**
 * Registry-driven round-trip check for the `*`-marker contract between the
 * frontend's buildTemplateCsv (admin-portal/src/services/student-import.ts)
 * and normalizeImportHeader (../bulk-import-service.ts).
 *
 * The two halves live in different workspaces and cannot share a test file,
 * so this pins the backend side of the contract against the SAME logic
 * buildTemplateCsv uses to emit a header cell (`fieldKey` + `*` iff
 * required), driven off the live registry rather than a hardcoded field
 * list. That means it exercises all 25 current student-import fields AND
 * automatically covers any field added later — no maintenance needed when
 * the schema grows.
 *
 * If this test ever fails, a CSV downloaded from our own template will stop
 * importing.
 */
import { describe, it, expect } from 'vitest';
import { getImportSchema } from '../bulk-import-registry';
import { normalizeImportHeader } from '../bulk-import-service';

describe('student import template header round-trip (registry-driven)', () => {
  const def = getImportSchema('student');

  it('is registered', () => {
    expect(def).not.toBeNull();
  });

  it('has at least one required and one optional field (or this test would not be exercising both branches)', () => {
    const required = def!.fields.filter((f) => f.required);
    const optional = def!.fields.filter((f) => !f.required);
    expect(required.length).toBeGreaterThan(0);
    expect(optional.length).toBeGreaterThan(0);
  });

  it('every field: the header buildTemplateCsv would emit normalizes back to the exact fieldKey', () => {
    for (const field of def!.fields) {
      // Mirrors buildTemplateCsv's header logic exactly:
      //   f.required ? `${f.fieldKey}*` : f.fieldKey
      const emitted = field.required ? `${field.fieldKey}*` : field.fieldKey;
      expect(normalizeImportHeader(emitted)).toBe(field.fieldKey);
    }
  });
});

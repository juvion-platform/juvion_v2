import { describe, it, expect } from 'vitest';
import { normalizeImportHeader, parseCsv } from '../bulk-import-service';

describe('normalizeImportHeader', () => {
  it('strips a trailing asterisk', () => {
    expect(normalizeImportHeader('name*')).toBe('name');
  });

  it('strips surrounding whitespace', () => {
    expect(normalizeImportHeader('  phone  ')).toBe('phone');
  });

  it('strips whitespace around the asterisk', () => {
    expect(normalizeImportHeader('  programmeCode * ')).toBe('programmeCode');
  });

  it('leaves a bare fieldKey untouched — pre-existing files must still import', () => {
    expect(normalizeImportHeader('admissionYear')).toBe('admissionYear');
  });

  it('strips only ONE trailing asterisk, so a key legitimately ending in * is not over-eaten', () => {
    expect(normalizeImportHeader('weird**')).toBe('weird*');
  });

  it('does not touch a mid-string asterisk', () => {
    expect(normalizeImportHeader('a*b')).toBe('a*b');
  });

  it('handles an empty header cell', () => {
    expect(normalizeImportHeader('')).toBe('');
  });
});

describe('parseCsv + normalization round-trip', () => {
  it('a template-shaped CSV maps onto bare field keys', () => {
    const csv = 'name*,phone*,email\nAarav,9876543210,a@b.c';
    const { headers, rows } = parseCsv(csv);
    const mapped: Record<string, string> = {};
    headers.forEach((h, i) => { mapped[normalizeImportHeader(h)] = rows[0]![i] ?? ''; });
    expect(mapped.name).toBe('Aarav');
    expect(mapped.phone).toBe('9876543210');
    expect(mapped.email).toBe('a@b.c');
  });
});

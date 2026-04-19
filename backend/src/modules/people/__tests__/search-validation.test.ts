import { describe, it, expect } from 'vitest';
import { searchQuerySchema } from '../search-validation';

/**
 * T1 validation tests — Zod schema for the search query params.
 *
 * Contract (from tasks.md T1 acceptance criteria):
 *   q:               string, 2–100 chars after trim, allowed chars
 *                    [A-Za-z0-9 @.\-+]
 *   limit:           optional int, 1–25, default 10
 *   includeInactive: optional boolean, default false
 */

describe('searchQuerySchema', () => {
  it('accepts a valid 2-char query', () => {
    const r = searchQuerySchema.parse({ q: 'ab' });
    expect(r.q).toBe('ab');
    expect(r.limit).toBe(10);
    expect(r.includeInactive).toBe(false);
  });

  it('rejects a 1-char query (too short)', () => {
    expect(() => searchQuerySchema.parse({ q: 'a' })).toThrow();
  });

  it('rejects an empty query', () => {
    expect(() => searchQuerySchema.parse({ q: '' })).toThrow();
  });

  it('rejects a missing q', () => {
    expect(() => searchQuerySchema.parse({})).toThrow();
  });

  it('accepts common real queries: names, emails, phones, roll numbers', () => {
    for (const q of [
      'sharma',
      'Priya Sharma',
      'priya@example.com',
      '+91 9998887777',
      '22JIT0001',
      'FAC-0042',
    ]) {
      expect(() => searchQuerySchema.parse({ q })).not.toThrow();
    }
  });

  it('rejects disallowed characters (script injection, slashes, brackets)', () => {
    for (const q of [
      '<script>alert(1)</script>',
      'abc<>def',
      'path/to/file',
      '{}',
      'abc[def]',
      'abc?def',
    ]) {
      expect(() => searchQuerySchema.parse({ q }), `expected rejection for: ${q}`).toThrow();
    }
  });

  it('trims leading/trailing whitespace on q', () => {
    const r = searchQuerySchema.parse({ q: '  priya  ' });
    expect(r.q).toBe('priya');
  });

  it('rejects a query that is only whitespace (trims to empty)', () => {
    expect(() => searchQuerySchema.parse({ q: '     ' })).toThrow();
  });

  it('caps q at 100 chars (rejects longer)', () => {
    const short = 'a'.repeat(100);
    const long  = 'a'.repeat(101);
    expect(() => searchQuerySchema.parse({ q: short })).not.toThrow();
    expect(() => searchQuerySchema.parse({ q: long })).toThrow();
  });

  it('accepts a custom limit in range [1, 25]', () => {
    expect(searchQuerySchema.parse({ q: 'ab', limit: 1 }).limit).toBe(1);
    expect(searchQuerySchema.parse({ q: 'ab', limit: 25 }).limit).toBe(25);
  });

  it('rejects limit = 0 or negative', () => {
    expect(() => searchQuerySchema.parse({ q: 'ab', limit: 0 })).toThrow();
    expect(() => searchQuerySchema.parse({ q: 'ab', limit: -5 })).toThrow();
  });

  it('rejects limit > 25', () => {
    expect(() => searchQuerySchema.parse({ q: 'ab', limit: 26 })).toThrow();
    expect(() => searchQuerySchema.parse({ q: 'ab', limit: 1000 })).toThrow();
  });

  it('coerces string numbers (req.query values) into limit', () => {
    // req.query always comes in as strings; Zod coercion handles that.
    const r = searchQuerySchema.parse({ q: 'ab', limit: '15' });
    expect(r.limit).toBe(15);
  });

  it('coerces "true"/"false" strings into includeInactive', () => {
    const t = searchQuerySchema.parse({ q: 'ab', includeInactive: 'true' });
    const f = searchQuerySchema.parse({ q: 'ab', includeInactive: 'false' });
    expect(t.includeInactive).toBe(true);
    expect(f.includeInactive).toBe(false);
  });
});

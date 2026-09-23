import { describe, it, expect } from 'vitest';
import { generateTemporaryPassword } from '../temp-password';
import { WORDLIST } from '../wordlist';

describe('generateTemporaryPassword', () => {
  it('uses a 2048-word list of lowercase 3–8 letter words with no duplicates', () => {
    expect(WORDLIST).toHaveLength(2048);
    expect(new Set(WORDLIST).size).toBe(2048);
    for (const w of WORDLIST) expect(w).toMatch(/^[a-z]{3,8}$/);
  });

  it('produces word-word-NNN, at least 8 chars, from the list', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTemporaryPassword();
      const m = pw.match(/^([a-z]+)-([a-z]+)-(\d{3})$/);
      expect(m, pw).not.toBeNull();
      expect(WORDLIST).toContain(m![1]);
      expect(WORDLIST).toContain(m![2]);
      expect(pw.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('does not repeat across 10,000 draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(generateTemporaryPassword());
    expect(seen.size).toBeGreaterThan(9_990);
  });
});

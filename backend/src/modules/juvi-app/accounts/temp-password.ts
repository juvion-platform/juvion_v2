import { randomInt } from 'node:crypto';
import { WORDLIST } from './wordlist';

/**
 * Temporary password for first sign-in: `word-word-NNN`.
 * Two words from a 2,048-word list plus a three-digit number gives
 * 2048 * 2048 * 1000 ≈ 4.3e9 combinations; combined with the per-identifier
 * cooldown this is far beyond online guessing, and it survives being read
 * aloud or written on a slip of paper.
 */
export function generateTemporaryPassword(): string {
  const a = WORDLIST[randomInt(WORDLIST.length)]!;
  const b = WORDLIST[randomInt(WORDLIST.length)]!;
  const n = String(randomInt(1000)).padStart(3, '0');
  return `${a}-${b}-${n}`;
}

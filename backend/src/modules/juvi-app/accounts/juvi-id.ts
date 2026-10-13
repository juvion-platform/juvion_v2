import { randomInt } from 'node:crypto';

/**
 * Crockford base32 — digits plus the letters that survive being read aloud and
 * written on a slip. `I`, `L`, `O` and `U` are excluded: `I`/`1`, `O`/`0` and
 * `U`/`V` are the pairs a person mistranscribes.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BODY_LENGTH = 8;
const PREFIX = 'JUV';

/** Canonical stored form: `JUV` + eight alphabet characters, uppercase, no separators. */
export const CANONICAL_JUVI_ID = /^JUV[0-9A-HJKMNP-TV-Z]{8}$/;

/**
 * Input normalisation: uppercase, then drop every character that is not `A–Z0–9`.
 * Spacing, hyphens and case from the person's transcription never matter; the
 * canonical form is the only thing that is ever compared or stored.
 */
export function normaliseJuviId(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** 40 bits from `node:crypto`, the same source as the temporary password. */
export function mintJuviId(): string {
  let body = '';
  for (let i = 0; i < BODY_LENGTH; i += 1) body += ALPHABET[randomInt(ALPHABET.length)]!;
  return `${PREFIX}${body}`;
}

/** `JUV4K7P2M9X` → `JUV-4K7P-2M9X`, for slips and the app. */
export function formatJuviId(canonical: string): string {
  return `${canonical.slice(0, 3)}-${canonical.slice(3, 7)}-${canonical.slice(7)}`;
}

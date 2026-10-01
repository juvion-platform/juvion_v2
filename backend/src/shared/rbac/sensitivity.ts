/**
 * 010 P3 — sensitivity classes.
 *
 * A schema path declares `sensitive: '<class>'`; a policy grants classes via
 * `scope.sensitivity` (undefined = all, [] = none). One walker strips every
 * hidden key from any JSON we send out (responses, report rows, AI context)
 * and refuses writes that carry one.
 *
 * ponytail: keys are matched by leaf name, not by model. A non-sensitive
 * field that shares a name with a sensitive one gets hidden too; per-model
 * masking is the upgrade if that ever bites.
 */
import mongoose from 'mongoose';
import type { AuthScope } from './types';

export const SENSITIVITY_CLASSES = ['people.identity', 'people.aadhaar', 'hr.compensation', 'welfare.medical', 'finance.bank'] as const;
export type SensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

let index: Map<string, SensitivityClass> | null = null;

/** leaf key → class, collected once from every registered schema. */
export function sensitiveKeys(): Map<string, SensitivityClass> {
  if (index) return index;
  const map = new Map<string, SensitivityClass>();
  for (const name of mongoose.modelNames()) {
    mongoose.model(name).schema.eachPath((path, type) => {
      const cls = (type as any).options?.sensitive as SensitivityClass | undefined;
      if (cls) map.set(path.split('.').pop()!, cls);
    });
  }
  index = map;
  return map;
}

/** Test seam: forget the cached index (models registered after first use). */
export function resetSensitiveKeys(): void { index = null; }

/** Format an Aadhaar value into masked display (••••••••1234 or XXXXXXXX1234). */
export function formatMaskedAadhaar(val: unknown): string {
  if (val == null) return '';
  const s = String(val).trim();
  if (s.length === 0) return '';
  if (s.startsWith('••••') || s.startsWith('XXXX')) return s;
  const last4 = s.slice(-4);
  return '••••••••' + last4;
}

export interface SensitivityMaskResult {
  hidden: SensitivityClass[];
  masked: SensitivityClass[];
}

/**
 * Resolves which sensitivity classes are hidden (stripped completely) and
 * which are masked (e.g. ••••••••1234 for Aadhaar).
 *
 * An undefined scope.sensitivity means unrestricted (e.g. super admin, college admin).
 * An explicit array grants full access for named classes (e.g. 'people.aadhaar')
 * and masked access for ':masked' classes (e.g. 'people.aadhaar:masked').
 */
export function resolveSensitivityMasks(authScope: AuthScope | undefined): SensitivityMaskResult {
  const allowed = authScope?.sensitivity;
  if (!allowed) return { hidden: [], masked: [] };

  const hidden: SensitivityClass[] = [];
  const masked: SensitivityClass[] = [];

  for (const cls of SENSITIVITY_CLASSES) {
    if (allowed.includes(cls)) {
      // Full access
      continue;
    }
    if (allowed.includes(`${cls}:masked` as any)) {
      // Masked access
      masked.push(cls);
    } else {
      // Stripped / hidden
      hidden.push(cls);
    }
  }

  return { hidden, masked };
}

/** Classes this scope may NOT see. Empty when unrestricted. */
export function hiddenClassesFor(authScope: AuthScope | undefined): SensitivityClass[] {
  return resolveSensitivityMasks(authScope).hidden;
}

/** Classes this scope may see only in masked form. */
export function maskedClassesFor(authScope: AuthScope | undefined): SensitivityClass[] {
  return resolveSensitivityMasks(authScope).masked;
}

function hiddenKeys(hidden: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const [key, cls] of sensitiveKeys()) if (hidden.includes(cls)) out.add(key);
  return out;
}

/**
 * Deep-strips hidden keys and formats masked keys from plain JSON.
 * Returns the same value when nothing is hidden or masked.
 */
export function maskFields<T>(
  value: T,
  hidden: readonly string[],
  masked: readonly string[] = [],
): T {
  if (hidden.length === 0 && masked.length === 0) return value;
  const hideKeys = hiddenKeys(hidden);
  const maskKeySet = hiddenKeys(masked);
  if (hideKeys.size === 0 && maskKeySet.size === 0) return value;

  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (hideKeys.has(k)) {
          // Omit completely
          continue;
        }
        if (maskKeySet.has(k)) {
          // Mask value
          out[k] = formatMaskedAadhaar(x);
          continue;
        }
        out[k] = walk(x);
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

/** First disallowed (hidden or masked) key found in a write body, or null. */
export function findHiddenKey(
  body: unknown,
  hidden: readonly string[],
  masked: readonly string[] = [],
): string | null {
  const disallowed = [...hidden, ...masked];
  if (disallowed.length === 0 || !body || typeof body !== 'object') return null;
  const keys = hiddenKeys(disallowed);
  const walk = (v: unknown): string | null => {
    if (Array.isArray(v)) { for (const x of v) { const h = walk(x); if (h) return h; } return null; }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (keys.has(k)) return k;
        const h = walk(x); if (h) return h;
      }
    }
    return null;
  };
  return walk(body);
}


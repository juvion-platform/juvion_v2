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

export const SENSITIVITY_CLASSES = ['people.identity', 'hr.compensation', 'welfare.medical', 'finance.bank'] as const;
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

/** Classes this scope may NOT see. Empty when unrestricted. */
export function hiddenClassesFor(authScope: AuthScope | undefined): SensitivityClass[] {
  const allowed = authScope?.sensitivity;
  if (!allowed) return [];
  return SENSITIVITY_CLASSES.filter((c) => !allowed.includes(c));
}

function hiddenKeys(hidden: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const [key, cls] of sensitiveKeys()) if (hidden.includes(cls)) out.add(key);
  return out;
}

/** Deep-strips hidden keys from plain JSON (objects, arrays, populated docs). Returns the same value when nothing is hidden. */
export function maskFields<T>(value: T, hidden: readonly string[]): T {
  if (hidden.length === 0) return value;
  const keys = hiddenKeys(hidden);
  if (keys.size === 0) return value;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!keys.has(k)) out[k] = walk(x);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

/** First hidden key found in a write body, or null. */
export function findHiddenKey(body: unknown, hidden: readonly string[]): string | null {
  if (hidden.length === 0 || !body || typeof body !== 'object') return null;
  const keys = hiddenKeys(hidden);
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

import { loadPolicies, decide } from './engine';
import { loadPersonas, ancestryFrom } from './persona-registry';

export const ALL_MODULES = [
  'admissions',
  'people',
  'academics',
  'finance',
  'hr',
  'welfare',
  'placement',
  'campus',
  'student-dev',
  'compliance',
  'governance',
  'platform',
  'juvi',
] as const;

/**
 * `approve` is emitted alongside the CRUD four because several routes gate on
 * it — re-pin and bulk-pin both bind students to a fee structure — and while
 * it was missing the frontend could never detect the grant, forcing those
 * buttons onto hardcoded role checks that disagreed with the backend.
 */
export const ALL_ACTIONS = ['read', 'create', 'update', 'delete', 'approve'] as const;

/**
 * Resolve the flat permission strings for a user's role and persona set.
 *
 * `module:action` means the whole module. When the winning policy is limited
 * to sub-domains the module-level string is NOT emitted; instead one
 * `module/<sub>:action` string per allowed sub-domain is, so the frontend can
 * tell an exam controller (`academics/exams:create`) from a full academics
 * user (`academics:create`).
 */
export async function resolvePermissions(
  collegeId: string | undefined,
  role: string,
  personas: string | string[],
): Promise<string[]> {
  const codes = Array.isArray(personas) ? personas : [personas];
  const [policies, rows] = await Promise.all([loadPolicies(collegeId, role), loadPersonas(collegeId)]);
  const chains = codes.map((c) => ancestryFrom(rows, c));
  const result: string[] = [];

  for (const mod of ALL_MODULES) {
    for (const action of ALL_ACTIONS) {
      const winner = decide(policies, chains, mod, action);
      if (!winner || winner.effect !== 'allow') continue;
      const subs = winner.scope?.subDomain?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
      if (subs.length === 0) result.push(`${mod}:${action}`);
      else for (const sub of subs) result.push(`${mod}/${sub}:${action}`);
    }
  }

  return result;
}

/**
 * 010 P3 — per-module sensitivity grants for the browser: `null` = may see
 * every class, an array = only those. Read decision per module.
 */
export async function resolveSensitivity(
  collegeId: string | undefined,
  role: string,
  personas: string | string[],
): Promise<Record<string, string[] | null>> {
  const codes = Array.isArray(personas) ? personas : [personas];
  const [policies, rows] = await Promise.all([loadPolicies(collegeId, role), loadPersonas(collegeId)]);
  const chains = codes.map((c) => ancestryFrom(rows, c));
  const out: Record<string, string[] | null> = {};
  for (const mod of ALL_MODULES) {
    const winner = decide(policies, chains, mod, 'read');
    if (winner?.effect === 'allow') out[mod] = winner.scope?.sensitivity ?? null;
  }
  return out;
}

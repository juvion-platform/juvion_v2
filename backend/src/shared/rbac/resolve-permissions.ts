import { loadPolicies, filterPolicies, sortPolicies } from './engine';

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

export const ALL_ACTIONS = ['read', 'create', 'update', 'delete'] as const;

/**
 * Resolve the flat list of "module:action" permission strings for a given role and personaType.
 * Loads all policies once, then evaluates each module x action combination.
 */
export async function resolvePermissions(
  collegeId: string | undefined,
  role: string,
  personaType: string,
): Promise<string[]> {
  const policies = await loadPolicies(collegeId, role);
  const result: string[] = [];

  for (const mod of ALL_MODULES) {
    for (const action of ALL_ACTIONS) {
      const filtered = filterPolicies(policies, mod, action, personaType);
      const sorted = sortPolicies(filtered);
      const first = sorted[0];
      if (first && first.effect === 'allow') {
        result.push(`${mod}:${action}`);
      }
    }
  }

  return result;
}

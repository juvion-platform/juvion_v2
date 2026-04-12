import { PolicyDoc } from './types';
import { Policy } from '../../models/platform/Policy';
import { getCachedPolicies, setCachedPolicies } from './cache';

/**
 * Match a policy's personaType pattern against a user's personaType.
 * - null/undefined = matches any
 * - 'F-HOD-*' = wildcard suffix match
 * - 'ST-WARDEN' = exact match
 */
export function matchPersonaType(policyPersonaType: string | null | undefined, userPersonaType: string): boolean {
  if (!policyPersonaType) return true;
  if (policyPersonaType.endsWith('*')) {
    const prefix = policyPersonaType.slice(0, -1);
    return userPersonaType.startsWith(prefix);
  }
  return policyPersonaType === userPersonaType;
}

/**
 * Filter policies to those that match the target module, action, and user's personaType.
 */
export function filterPolicies(policies: PolicyDoc[], targetModule: string, targetAction: string, userPersonaType: string): PolicyDoc[] {
  return policies.filter((p) => {
    const moduleMatch = p.module === targetModule || p.module === '*';
    const actionMatch = p.action === targetAction || p.action === '*';
    const personaMatch = matchPersonaType(p.personaType ?? null, userPersonaType);
    return moduleMatch && actionMatch && personaMatch;
  });
}

/**
 * Sort policies by: college-specific first, then exact personaType, then exact module, then priority.
 */
export function sortPolicies(policies: PolicyDoc[]): PolicyDoc[] {
  return [...policies].sort((a, b) => {
    const aSpecific = a.collegeId ? 1 : 0;
    const bSpecific = b.collegeId ? 1 : 0;
    if (bSpecific !== aSpecific) return bSpecific - aSpecific;

    const personaScore = (p: PolicyDoc) => {
      if (!p.personaType) return 0;
      if (p.personaType.endsWith('*')) return 1;
      return 2;
    };
    const pDiff = personaScore(b) - personaScore(a);
    if (pDiff !== 0) return pDiff;

    const moduleScore = (p: PolicyDoc) => (p.module === '*' ? 0 : 1);
    const mDiff = moduleScore(b) - moduleScore(a);
    if (mDiff !== 0) return mDiff;

    const actionScore = (p: PolicyDoc) => (p.action === '*' ? 0 : 1);
    const aDiff = actionScore(b) - actionScore(a);
    if (aDiff !== 0) return aDiff;

    return b.priority - a.priority;
  });
}

/**
 * Load all policies for a user's role + college from cache or DB.
 */
export async function loadPolicies(collegeId: string | undefined, role: string): Promise<PolicyDoc[]> {
  const cacheId = collegeId || 'global';

  const cached = await getCachedPolicies(cacheId, role);
  if (cached) return cached;

  const filter: Record<string, unknown> = {
    role: { $in: [role, '*'] },
    isActive: true,
  };

  if (collegeId) {
    filter.collegeId = { $in: [collegeId, null, undefined] };
  } else {
    filter.collegeId = { $exists: false };
  }

  const docs = await Policy.find(filter).lean();
  const policies: PolicyDoc[] = docs.map((d) => ({
    _id: String(d._id),
    collegeId: d.collegeId ? String(d.collegeId) : undefined,
    role: d.role,
    personaType: d.personaType ?? undefined,
    module: d.module,
    action: d.action,
    effect: d.effect,
    scope: d.scope,
    priority: d.priority,
    description: d.description,
    isActive: d.isActive,
  }));

  await setCachedPolicies(cacheId, role, policies);
  return policies;
}

/**
 * Evaluate a user's access: load policies, filter, sort, return first match.
 * Returns the matching policy or null (deny).
 */
export async function evaluateAccess(
  collegeId: string | undefined,
  role: string,
  personaType: string,
  targetModule: string,
  targetAction: string,
): Promise<PolicyDoc | null> {
  const policies = await loadPolicies(collegeId, role);
  const filtered = filterPolicies(policies, targetModule, targetAction, personaType);
  const sorted = sortPolicies(filtered);
  return sorted[0] ?? null;
}

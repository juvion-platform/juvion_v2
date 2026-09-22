import { PolicyDoc, PolicyScope, AssignedVia } from './types';
import { Policy } from '../../models/platform/Policy';
import { getCachedPolicies, setCachedPolicies } from './cache';
import { loadPersonas, ancestryFrom } from './persona-registry';

/**
 * Match a policy's personaType pattern against a user's persona codes.
 * `userPersona` is the ancestry set of one persona (`[self, parent, …]`), so
 * inheritance is an explicit `parentCode` link — a policy on `ST-ADM`
 * matches a user holding `ST-ADM-TC` because ST-ADM is in the chain.
 * - null/undefined = matches any
 * - 'F-HOD-*' = legacy wildcard suffix; matches if any code in the chain starts with the prefix
 * - 'ST-WARDEN' = exact match against any code in the chain
 */
export function matchPersonaType(policyPersonaType: string | null | undefined, userPersona: string | string[]): boolean {
  if (!policyPersonaType) return true;
  const codes = Array.isArray(userPersona) ? userPersona : [userPersona];
  if (policyPersonaType.endsWith('*')) {
    const prefix = policyPersonaType.slice(0, -1);
    return codes.some((c) => c.startsWith(prefix));
  }
  return codes.includes(policyPersonaType);
}

/**
 * Filter policies to those that match the target module, action, and user's persona chain.
 */
export function filterPolicies(policies: PolicyDoc[], targetModule: string, targetAction: string, userPersona: string | string[]): PolicyDoc[] {
  return policies.filter((p) => {
    const moduleMatch = p.module === targetModule || p.module === '*';
    const actionMatch = p.action === targetAction || p.action === '*';
    const personaMatch = matchPersonaType(p.personaType ?? null, userPersona);
    return moduleMatch && actionMatch && personaMatch;
  });
}

/**
 * Sort policies by: college-specific first, then persona specificity, then exact module, then priority.
 * Persona specificity with a chain (`[self, parent, …]`): a row naming the
 * persona itself beats one naming an ancestor, which beats a wildcard, which
 * beats a row for every persona. So a sub-persona's own rows override what it
 * inherits, action by action.
 */
export function sortPolicies(policies: PolicyDoc[], chain?: string[]): PolicyDoc[] {
  return [...policies].sort((a, b) => {
    const aSpecific = a.collegeId ? 1 : 0;
    const bSpecific = b.collegeId ? 1 : 0;
    if (bSpecific !== aSpecific) return bSpecific - aSpecific;

    const personaScore = (p: PolicyDoc) => {
      if (!p.personaType) return 0;
      if (p.personaType.endsWith('*')) return 1;
      const depth = chain ? chain.indexOf(p.personaType) : -1;
      return depth < 0 ? 2 : 2 + (chain!.length - depth);
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
    // 010 P2 — a college that took a snapshot evaluates its own rows only;
    // system rows are then a template, never live behaviour. Colleges without
    // a snapshot keep the legacy cascade (college overrides + system defaults).
    const snapshotted = await Policy.exists({ collegeId, createdBy: 'snapshot' });
    filter.collegeId = snapshotted ? collegeId : { $in: [collegeId, null, undefined] };
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
    scope: d.scope ? { ...d.scope, assignedVia: d.scope.assignedVia as AssignedVia[] | undefined } : undefined,
    priority: d.priority,
    description: d.description,
    isActive: d.isActive,
  }));

  await setCachedPolicies(cacheId, role, policies);
  return policies;
}

/** True when the policy narrows rows at all (department, self or assigned). */
export function narrowsRows(p: PolicyDoc): boolean {
  return !!(p.scope?.departmentOnly || p.scope?.selfOnly || p.scope?.assignedVia?.length);
}

/**
 * Merge the winning allow policies of several personas into one decision.
 * Least restrictive wins. Rows: if any allowing persona is unrestricted the
 * result is unrestricted; otherwise every narrowing is kept and
 * `applyAuthScope` ORs them (department OR self OR assigned). Sub-domains:
 * unioned, and dropped entirely if any allowing persona is unrestricted.
 */
export function mergeAllows(allows: PolicyDoc[]): PolicyDoc {
  const first = allows[0]!;
  if (allows.length === 1) return first;
  const scope: PolicyScope = {};
  if (allows.every(narrowsRows)) {
    if (allows.some((p) => p.scope?.departmentOnly)) scope.departmentOnly = true;
    if (allows.some((p) => p.scope?.selfOnly)) scope.selfOnly = true;
    const via = [...new Set(allows.flatMap((p) => p.scope?.assignedVia ?? []))];
    if (via.length) scope.assignedVia = via;
  }
  // Sensitivity: any unrestricted allow lifts the mask; otherwise union of grants.
  if (allows.every((p) => p.scope?.sensitivity)) {
    scope.sensitivity = [...new Set(allows.flatMap((p) => p.scope!.sensitivity!))];
  }
  if (allows.every((p) => p.scope?.subDomain)) {
    const subs = new Set(allows.flatMap((p) => p.scope!.subDomain!.split(',').map((s) => s.trim()).filter(Boolean)));
    scope.subDomain = [...subs].join(',');
  }
  const priority = Math.max(...allows.map((p) => p.priority));
  return { ...first, scope: Object.keys(scope).length ? scope : undefined, priority };
}

/**
 * Pure evaluation over already-loaded policies and persona rows.
 * Each persona is evaluated on its own (first match after sort). Across
 * personas an explicit deny wins; otherwise the allows are merged. A user
 * with no matching policy on any persona is denied (null).
 */
export function decide(
  policies: PolicyDoc[],
  personaChains: string[][],
  targetModule: string,
  targetAction: string,
): PolicyDoc | null {
  const winners: PolicyDoc[] = [];
  for (const chain of personaChains) {
    const first = sortPolicies(filterPolicies(policies, targetModule, targetAction, chain), chain)[0];
    if (first) winners.push(first);
  }
  const deny = winners.find((p) => p.effect === 'deny');
  if (deny) return deny;
  const allows = winners.filter((p) => p.effect === 'allow');
  return allows.length ? mergeAllows(allows) : null;
}

/**
 * Evaluate a user's access: load policies + persona chains, decide.
 * Returns the (merged) matching policy, an explicit deny policy, or null (deny).
 */
export async function evaluateAccess(
  collegeId: string | undefined,
  role: string,
  personas: string | string[],
  targetModule: string,
  targetAction: string,
): Promise<PolicyDoc | null> {
  const codes = Array.isArray(personas) ? personas : [personas];
  const [policies, rows] = await Promise.all([loadPolicies(collegeId, role), loadPersonas(collegeId)]);
  const chains = codes.map((c) => ancestryFrom(rows, c));
  return decide(policies, chains, targetModule, targetAction);
}

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_POLICIES } from '../defaults';

/**
 * A `scope.subDomain` only restricts anything on routes that declare which
 * sub-domain they serve. A policy naming a sub-domain no route declares is
 * therefore a grant that looks narrow and isn't — the shape that let a
 * `faculty → academics:create, subDomain 'attendance,marks'` policy allow
 * every academics write for as long as it has existed.
 *
 * This test pins that gap to a list. A new unenforced policy fails here
 * instead of shipping as a silent over-grant, and moving one off the list
 * (by annotating its module's routes) is the upgrade path towards failing
 * closed per module.
 */

/** module:action pairs whose sub-domain restriction is NOT enforced yet. */
const UNENFORCED = [
  'academics:create',   // faculty attendance/marks/lesson-plans, ST-ACOPS-CC course-offerings
  'academics:update',   // same
  'academics:*',        // ST-EXAM exams,results
  'admissions:create',  // ST-ADM-TC inquiries,lead-interactions
  'admissions:update',  // ST-ADM-TC inquiries,lead-interactions
  'admissions:*',       // ST-ADM-AC inquiries,applicants,documents
  'compliance:read',    // ST-ACOPS-AC obe,naac
  'compliance:*',       // ST-RES-COORD research,publications,faculty-documents
  'placement:create',   // student registration
  'student-dev:create', // student registration,membership
  'welfare:create',     // student grievance
  'welfare:*',          // ST-WARDEN hostel,mess
].sort();

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) routeFiles(p, out);
    else if (e.endsWith('routes.ts')) out.push(p);
  }
  return out;
}

/** module:action pairs for which at least one route declares a subDomain. */
function declaredByRoutes(): Set<string> {
  const declared = new Set<string>();
  const re = /authorize\(\s*'([a-z-]+)'\s*,\s*'([a-z*]+)'\s*,\s*\{\s*subDomain:\s*'([^']+)'\s*\}/g;
  for (const f of routeFiles('src/modules')) {
    for (const m of readFileSync(f, 'utf8').matchAll(re)) declared.add(`${m[1]}:${m[2]}`);
  }
  return declared;
}

/** A policy's restriction bites if some route declares a subDomain for a matching action. */
function isEnforced(declared: Set<string>, module: string, action: string): boolean {
  if (declared.has(`${module}:${action}`)) return true;
  if (action === '*') return [...declared].some((d) => d.startsWith(`${module}:`));
  return declared.has(`${module}:*`);
}

describe('sub-domain scopes are enforced by the routes they name', () => {
  const declared = declaredByRoutes();
  const scoped = DEFAULT_POLICIES.filter((p) => p.effect === 'allow' && p.scope?.subDomain);

  it('finds the route declarations and the scoped policies', () => {
    expect(declared.size).toBeGreaterThan(0);
    expect(scoped.length).toBeGreaterThan(0);
  });

  it('every unenforced sub-domain scope is a known one', () => {
    const unenforced = [
      ...new Set(
        scoped
          .filter((p) => !isEnforced(declared, p.module, p.action))
          .map((p) => `${p.module}:${p.action}`),
      ),
    ].sort();
    expect(unenforced).toEqual(UNENFORCED);
  });

  it('the people write scopes are enforced', () => {
    expect(isEnforced(declared, 'people', 'create')).toBe(true);
    expect(isEnforced(declared, 'people', 'update')).toBe(true);
  });

  it('the list carries no entry that has since been wired up', () => {
    const stale = UNENFORCED.filter((k) => {
      const [m, a] = k.split(':') as [string, string];
      return isEnforced(declared, m, a);
    });
    expect(stale, 'annotated now — drop it from UNENFORCED').toEqual([]);
  });
});

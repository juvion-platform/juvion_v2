import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestUser } from '../factories/user.factory';
import { Person } from '../../models/people/Person';
import { Faculty } from '../../models/people/Faculty';
import { Staff } from '../../models/people/Staff';

/**
 * 010 S7 — with enforcement ON, log in as each seeded persona and call every
 * registered GET route. A 500 means a page built as super admin breaks for
 * this persona (most often "Row scope not applied"). The status matrix is
 * snapshotted so any later change to who-can-read-what shows up in review.
 */
let app: Express;
let api: TestApi;
let fx: BaseFixtures;
const tokens: Record<string, string> = {};

/** Rebuild a mount path from an Express 4 layer regexp (`/^\/api\/?(?=\/|$)/i` → `/api`). */
function mountPath(layer: any): string {
  if (layer.path) return layer.path;
  const src: string = layer.regexp?.source ?? '';
  if (src === '^\\/?$' || src === '^\\/?(?=\\/|$)') return '';
  return src.replace('^', '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/').replace(/\/?\$$/, '');
}

function collectGetRoutes(stack: any[], prefix = ''): string[] {
  const out: string[] = [];
  for (const layer of stack) {
    if (layer.route) {
      if (layer.route.methods.get) out.push(prefix + layer.route.path);
    } else if (layer.handle?.stack) {
      out.push(...collectGetRoutes(layer.handle.stack, prefix + mountPath(layer)));
    }
  }
  return out;
}

const SKIP = [/^\/api\/auth/, /^\/api\/colleges/, /^\/api\/health/];
const withIds = (p: string) => p.replace(/:[A-Za-z]+\??/g, () => String(new Types.ObjectId()));

beforeAll(async () => {
  // ~3,200 requests from one IP: bypass the 100/min global limiter the way Playwright does.
  // Each e2e file runs in its own fork, so this never reaches the login-limiter test.
  process.env.E2E_TESTING = '1';
  app = await getTestApp();
  api = createTestApi(app);
  fx = await seedBase();
  const mk = async (code: string, role: string, dept?: any, kind?: 'faculty' | 'staff') => {
    const person = await Person.create({ collegeId: fx.collegeId, name: code, phone: `98${Math.floor(Math.random() * 1e8)}` });
    if (kind === 'faculty') await Faculty.create({ collegeId: fx.collegeId, personId: person._id, employeeCode: `E-${code}`, designation: 'Prof', departmentId: dept._id, contractType: 'regular', status: 'active' });
    if (kind === 'staff') await Staff.create({ collegeId: fx.collegeId, personId: person._id, employeeCode: `E-${code}`, designation: code, departmentId: dept?._id, staffType: 'administrative', status: 'active' });
    tokens[code] = (await createTestUser({ collegeId: fx.collegeId, role, personaType: code, name: code, email: `${code.toLowerCase()}@walk.test`, personId: String(person._id) })).token;
  };
  await mk('F-HOD', 'hod', fx.cse, 'faculty');
  await mk('F-FAC', 'faculty', fx.cse, 'faculty');
  await mk('ST-ACC', 'staff', undefined, 'staff');
  await mk('ST-WARDEN', 'staff', undefined, 'staff');
  process.env.RBAC_ENFORCE = 'true';
});
afterAll(async () => { process.env.RBAC_ENFORCE = 'false'; await cleanupTestApp(); });

describe('every GET route, every persona', () => {
  it('never returns 500 and matches the access snapshot', { timeout: 600_000 }, async () => {
    const routes = [...new Set(collectGetRoutes((app as any)._router.stack))]
      .filter((r) => r.startsWith('/api/') && !SKIP.some((re) => re.test(r)))
      .sort();
    expect(routes.length).toBeGreaterThan(300);

    const matrix: Record<string, Record<string, number>> = {};
    const failures: string[] = [];
    for (const [persona, token] of Object.entries(tokens)) {
      matrix[persona] = {};
      for (const route of routes) {
        const res = await api.as(token).get(withIds(route));
        matrix[persona][route] = res.status;
        if (res.status >= 500) failures.push(`${persona} ${route} → ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`);
      }
    }
    console.log(`ROUTE-WALK routes=${routes.length} personas=${Object.keys(tokens).length} failures=${failures.length}`);
    for (const f of failures) console.log('WALK-FAIL ' + f);
    expect(failures, failures.join('\n')).toEqual([]);
    expect(matrix).toMatchSnapshot();
  });
});

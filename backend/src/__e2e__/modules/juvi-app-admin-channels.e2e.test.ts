import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { enableJuvi, provisionTestStudent } from '../factories/juvi.factory';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';
import { Channel } from '../../models/juvi/Channel';
import { College } from '../../models/College';
import { invalidateJuviConfig } from '../../modules/juvi-app/config/institution-config';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

describe('admin channels', () => {
  it('lists channels and templates after a reconcile; filters by status', async () => {
    await provisionTestStudent(fx);
    await reconcileCollege(fx.collegeId);
    const ch = await api.as(fx.admin.token).get(`${A}/channels`).expect(200);
    expect(ch.body.total).toBe(4);   // college + 2 departments + 1 batch
    expect(ch.body.items[0]).toMatchObject({ templateCode: expect.any(String), name: expect.any(String), memberCount: expect.any(Number), status: 'active' });
    const archived = await api.as(fx.admin.token).get(`${A}/channels?status=archived`).expect(200);
    expect(archived.body.total).toBe(0);
    const t = await api.as(fx.admin.token).get(`${A}/templates`).expect(200);
    expect(t.body.items.map((x: any) => x.code)).toEqual(['college', 'department', 'batch', 'course', 'hostel']);
  });

  it('POST /reconcile is accepted and creates channels (inline fallback without Redis)', async () => {
    await provisionTestStudent(fx);
    const res = await api.as(fx.admin.token).post(`${A}/reconcile`).expect(202);
    expect(res.body).toEqual({ queued: true });
    for (let i = 0; i < 50 && (await Channel.countDocuments({ collegeId: fx.collegeId })) < 4; i++) await new Promise((r) => setTimeout(r, 100));
    expect(await Channel.countDocuments({ collegeId: fx.collegeId })).toBe(4);
  }, 15_000);

  it('POST /reconcile is refused while Juvi is disabled (409)', async () => {
    await College.updateOne({ _id: fx.collegeId }, { $set: { 'juvi.enabled': false } });
    await invalidateJuviConfig(fx.collegeId);
    const res = await api.as(fx.admin.token).post(`${A}/reconcile`).expect(409);
    expect(res.body).toEqual({ error: 'Enable Juvi in Settings before provisioning' });
  });
});

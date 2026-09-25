import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { College } from '../../models/College';
import { ChannelTemplate } from '../../models/juvi/ChannelTemplate';
import { AuditLog } from '../../shared/audit';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const A = '/api/juvi-app/admin';
beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); });
afterAll(async () => { await cleanupTestApp(); });

describe('admin settings', () => {
  it('GET returns defaults for a college that never enabled Juvi', async () => {
    const res = await api.as(fx.admin.token).get(`${A}/settings`).expect(200);
    expect(res.body.juvi).toMatchObject({ enabled: false, paused: false, quietHoursDefault: { start: '22:00', end: '07:00' }, timezone: 'Asia/Kolkata' });
    expect(res.body.college).toEqual({ name: 'JIT Test College', code: 'JIT-TEST' });
    expect(res.body.lastReconcile).toBeNull();
  });

  it('PUT enables Juvi, seeds templates, writes an audit row and returns the new view', async () => {
    const res = await api.as(fx.admin.token).put(`${A}/settings`).send({
      enabled: true, accentColor: '#0B5FA5', supportContact: { name: 'Office', phone: '040-1' },
      quietHoursDefault: { start: '21:30', end: '06:30' }, minAppVersion: { android: '1.0.0' },
    }).expect(200);
    expect(res.body.juvi).toMatchObject({ enabled: true, accentColor: '#0B5FA5', supportContact: { name: 'Office', phone: '040-1' }, quietHoursDefault: { start: '21:30', end: '06:30' } });
    expect((await College.findById(fx.collegeId).lean())?.juvi.enabled).toBe(true);
    expect(await ChannelTemplate.countDocuments({ collegeId: fx.collegeId })).toBe(5);
    const audit = await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'College', action: 'update' }).lean();
    expect(audit?.changes.map((c) => c.field)).toContain('juvi.enabled');
  });

  it('PUT validates colour, quiet hours and pause message', async () => {
    await api.as(fx.admin.token).put(`${A}/settings`).send({ accentColor: 'blue' }).expect(400);
    await api.as(fx.admin.token).put(`${A}/settings`).send({ quietHoursDefault: { start: '25:00', end: '07:00' } }).expect(400);
    const res = await api.as(fx.admin.token).put(`${A}/settings`).send({ paused: true, pausedMessage: 'Maintenance until Monday' }).expect(200);
    expect(res.body.juvi).toMatchObject({ paused: true, pausedMessage: 'Maintenance until Monday' });

    const cleared = await api.as(fx.admin.token).put(`${A}/settings`).send({ accentColor: null }).expect(200);
    expect(cleared.body.juvi.accentColor ?? null).toBeNull();
  });

  it('is unreachable without a token and renders the ERP error shape', async () => {
    const res = await api.get(`${A}/settings`).expect(401);
    expect(res.body).toEqual({ error: 'No token provided' });
  });

  it('renders the ERP 404 shape for an unmatched admin path', async () => {
    const res = await api.as(fx.admin.token).get(`${A}/nope`).expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

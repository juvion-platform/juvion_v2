import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, mobileClient } from '../factories/juvi.factory';
import { activateAccount, publishTestNotice, signInAs } from '../factories/notice.factory';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { MobileSession } from '../../models/juvi/MobileSession';
import { AuditLog } from '../../shared/audit';
import { drainOutbox } from '../../shared/outbox';

process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

async function studentOnJuvi(deviceId: string) {
  const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  await activateAccount(String(s.account._id));
  return { ...s, token: await signInAs(app, fx, s.student.rollNumber, s.tempPassword, deviceId) };
}
const rowOf = (noticeId: unknown, accountId: unknown) => NoticeRecipient.findOne({ noticeId, accountId }).lean();

describe('POST /notices/:id/ack (US-2.3, US-2.4, NTC-04, NTC-06)', () => {
  it('records a fully attributed acknowledgement, clears it from Due and writes one audit entry', async () => {
    const a = await studentOnJuvi('device-a');
    const n = await publishTestNotice(fx, { ackRequired: true, ackDeadline: tomorrow() });
    expect((await mobileClient(app, a.token).get(`${V1}/attention`)).body.dueCount).toBe(1);

    const res = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(200);
    expect(res.body).toMatchObject({ late: false, method: 'hold', offline: false, comment: null, clientAt: null });
    const row = (await rowOf(n._id, a.account._id))!;
    const session = (await MobileSession.findOne({ accountId: a.account._id, deviceId: 'device-a' }).lean())!;
    expect(String(row.ack!.sessionId)).toBe(String(session._id));
    expect(row.ack!.at.toISOString()).toBe(res.body.ackAt);
    expect(row.seenAt).toBeInstanceOf(Date);
    expect((await mobileClient(app, a.token).get(`${V1}/attention`)).body).toEqual({ dueCount: 0, items: [] });
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${n._id}`)).body).toMatchObject({ state: 'acknowledged', ackAt: res.body.ackAt, ackMethod: 'hold' });

    await drainOutbox();
    const audit = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeAcknowledgement', entityId: String(n._id) }).lean();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'acknowledge', entityName: 'Notice from College Office', performedBy: a.person.name });
    expect(audit[0]!.changes[0]!.newValue).toMatchObject({ recipientId: String(row._id), name: a.person.name, late: false, method: 'hold', offline: false, hasComment: false });
  });

  it('a second acknowledgement is 409 ALREADY_ACKNOWLEDGED with the existing record, which never changes', async () => {
    const a = await studentOnJuvi('device-a');
    const n = await publishTestNotice(fx, { ackRequired: true });
    const first = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'confirm' }).expect(200);
    const before = (await rowOf(n._id, a.account._id))!.ack;
    const again = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold', offline: true }).expect(409);
    expect(again.body.error).toMatchObject({ code: 'ALREADY_ACKNOWLEDGED', ack: first.body });
    expect((await rowOf(n._id, a.account._id))!.ack).toEqual(before);
  });

  it('flags a late acknowledgement by server receipt time even when it was made offline before the deadline', async () => {
    const a = await studentOnJuvi('device-a');
    const n = await publishTestNotice(fx, { ackRequired: true, ackDeadline: tomorrow() });
    const past = new Date(Date.now() - 60_000);
    await Notice.updateOne({ _id: n._id }, { $set: { ackDeadline: past } });
    await NoticeRecipient.updateMany({ noticeId: n._id }, { $set: { deadline: past } });
    const clientAt = new Date(Date.now() - 3_600_000).toISOString();   // tapped before the deadline, delivered after
    const res = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'confirm', offline: true, clientAt }).expect(200);
    expect(res.body).toMatchObject({ late: true, offline: true, clientAt: new Date(clientAt).toISOString() });
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${n._id}`)).body).toMatchObject({ late: true, ackOffline: true, ackClientAt: new Date(clientAt).toISOString() });
  });

  it('takes a comment only where allowed, trims it, caps it at 500 characters and never logs it', async () => {
    const a = await studentOnJuvi('device-a');
    const open = await publishTestNotice(fx, { title: 'Open', ackRequired: true, ackCommentAllowed: true });
    const closed = await publishTestNotice(fx, { title: 'Closed', ackRequired: true });
    const long = await mobileClient(app, a.token).post(`${V1}/notices/${open._id}/ack`).send({ method: 'hold', comment: 'x'.repeat(501) }).expect(400);
    expect(long.body.error.code).toBe('VALIDATION_FAILED');
    const ok = await mobileClient(app, a.token).post(`${V1}/notices/${open._id}/ack`).send({ method: 'hold', comment: '  Will attend.  ' }).expect(200);
    expect(ok.body.comment).toBe('Will attend.');
    const refused = await mobileClient(app, a.token).post(`${V1}/notices/${closed._id}/ack`).send({ method: 'hold', comment: 'hi' }).expect(400);
    expect(refused.body.error).toMatchObject({ code: 'VALIDATION_FAILED', message: 'Comments are not allowed on this notice.' });
    expect((await rowOf(closed._id, a.account._id))!.ack).toBeNull();
    await drainOutbox();
    const audit = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeAcknowledgement' }).lean();
    expect(audit).toHaveLength(1);
    expect(audit[0]!.changes[0]!.newValue).toMatchObject({ hasComment: true });
    expect(JSON.stringify(audit)).not.toContain('Will attend');
  });

  it('refuses an archived notice, a notice that needs no acknowledgement, and a malformed body', async () => {
    const a = await studentOnJuvi('device-a');
    const n = await publishTestNotice(fx, { ackRequired: true });
    const fyi = await publishTestNotice(fx, { title: 'FYI' });
    await Notice.updateOne({ _id: n._id }, { $set: { status: 'archived' } });
    expect((await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(409)).body.error.code).toBe('NOTICE_ARCHIVED');
    expect((await mobileClient(app, a.token).post(`${V1}/notices/${fyi._id}/ack`).send({ method: 'hold' }).expect(409)).body.error.code).toBe('ACK_NOT_REQUIRED');
    await mobileClient(app, a.token).post(`${V1}/notices/${fyi._id}/ack`).send({ method: 'tap' }).expect(400);
    await mobileClient(app, a.token).post(`${V1}/notices/${fyi._id}/ack`).send({ method: 'hold', late: false }).expect(400);
  });

  it('two racing acknowledgements produce one record, one 409 and one audit entry (spec §10)', async () => {
    const a = await studentOnJuvi('device-a');
    const n = await publishTestNotice(fx, { ackRequired: true });
    const [r1, r2] = await Promise.all([
      mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }),
      mobileClient(app, a.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'confirm' }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const winner = r1.status === 200 ? r1 : r2;
    const loser = r1.status === 200 ? r2 : r1;
    expect(loser.body.error).toMatchObject({ code: 'ALREADY_ACKNOWLEDGED', ack: winner.body });
    expect((await rowOf(n._id, a.account._id))!.ack!.method).toBe(winner.body.method);
    await drainOutbox();
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'NoticeAcknowledgement', entityId: String(n._id) })).toBe(1);
  });

  it('is 404 NOTICE_NOT_FOUND for a notice the caller did not receive', async () => {
    const a = await studentOnJuvi('device-a');
    const b = await studentOnJuvi('device-b');
    const n = await publishTestNotice(fx, { ackRequired: true, audience: { rules: [{ kind: 'custom', ids: [String(a.person._id)] }] } });
    expect((await mobileClient(app, b.token).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
    expect((await mobileClient(app, b.token).post(`${V1}/notices/${n._id}/dismiss`).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
  });
});

describe('POST /notices/:id/dismiss', () => {
  it('dismisses a notice that needs no acknowledgement, once; refuses acknowledgement and archived notices', async () => {
    const a = await studentOnJuvi('device-a');
    const fyi = await publishTestNotice(fx, { title: 'FYI' });
    const needsAck = await publishTestNotice(fx, { title: 'Sign', ackRequired: true });
    const gone = await publishTestNotice(fx, { title: 'Gone' });
    const d1 = await mobileClient(app, a.token).post(`${V1}/notices/${fyi._id}/dismiss`).expect(200);
    const d2 = await mobileClient(app, a.token).post(`${V1}/notices/${fyi._id}/dismiss`).expect(200);
    expect(d2.body.dismissedAt).toBe(d1.body.dismissedAt);
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${fyi._id}`)).body).toMatchObject({ state: 'dismissed', dismissedAt: d1.body.dismissedAt });
    expect((await rowOf(fyi._id, a.account._id))!.seenAt).toBeInstanceOf(Date);
    expect((await mobileClient(app, a.token).get(`${V1}/notices?segment=done`)).body.items.map((c: { title: string }) => c.title)).toEqual(['FYI']);
    expect((await mobileClient(app, a.token).post(`${V1}/notices/${needsAck._id}/dismiss`).expect(409)).body.error.code).toBe('ACK_REQUIRED');
    await Notice.updateOne({ _id: gone._id }, { $set: { status: 'archived' } });
    expect((await mobileClient(app, a.token).post(`${V1}/notices/${gone._id}/dismiss`).expect(409)).body.error.code).toBe('NOTICE_ARCHIVED');
  });
});

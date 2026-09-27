import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const s3 = vi.hoisted(() => ({ configured: true }));
vi.mock('../../shared/s3/s3-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/s3/s3-client')>()),
  isS3Configured: () => s3.configured,
  getPresignedUrl: async (key: string, opts?: { expiresIn?: number }) => ({
    url: `https://s3.test/${encodeURIComponent(key)}?X-Amz-Expires=${opts?.expiresIn}`,
    expiresAt: new Date(Date.now() + (opts?.expiresIn ?? 3600) * 1000),
  }),
}));

import type { Express } from 'express';
import type { Response } from 'superagent';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient } from '../factories/juvi.factory';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { activateAccount, publishTestNotice, signInAs, erpRef } from '../factories/notice.factory';
import { Notice, LeanNotice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { drainOutbox } from '../../shared/outbox';
import { attachmentPrefix } from '../../modules/juvi-app/notices/publish-service';

// Many requests from one IP: bypass the global limiter (each e2e file runs in its own fork).
process.env.E2E_TESTING = '1';

let app: Express; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const ids = (items: { id: string }[]) => items.map((c) => c.id);

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); s3.configured = true; });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

/** A student with an active ("on Juvi") account and a mobile token. */
async function studentOnJuvi(deviceId: string) {
  const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  await activateAccount(String(s.account._id));
  return { ...s, token: await signInAs(app, fx, s.student.rollNumber, s.tempPassword, deviceId) };
}

describe('GET /attention and the due segment (US-3.1, US-3.2)', () => {
  it('lists up to three due notices by deadline with no-deadline last, and dueCount matches the due segment', async () => {
    const a = await studentOnJuvi('device-a');
    const n1 = await publishTestNotice(fx, { title: 'N1', ackRequired: true, ackDeadline: inDays(2) });
    const n2 = await publishTestNotice(fx, { title: 'N2', ackRequired: true, ackDeadline: inDays(1) });
    const n3 = await publishTestNotice(fx, { title: 'N3', ackRequired: true });
    const n4 = await publishTestNotice(fx, { title: 'N4', ackRequired: true, ackDeadline: inDays(3) });
    await publishTestNotice(fx, { title: 'FYI' });   // no acknowledgement: never due

    const res = await mobileClient(app, a.token).get(`${V1}/attention`).expect(200);
    expect(res.body.dueCount).toBe(4);
    expect(ids(res.body.items)).toEqual([n2, n1, n4].map((n) => String(n._id)));
    expect(res.body.items[0]).toMatchObject({
      title: 'N2', office: 'College Office', audienceLine: 'Sent to 2024 Batch', ackRequired: true, state: 'received',
      archived: false, isPublisher: false, seenAt: null, ackAt: null, late: false, deadline: new Date(n2.ackDeadline!).toISOString(),
    });

    const due = await mobileClient(app, a.token).get(`${V1}/notices?segment=due`).expect(200);
    expect(ids(due.body.items)).toEqual([n2, n1, n4, n3].map((n) => String(n._id)));
    expect(due.body.items).toHaveLength(res.body.dueCount);
    expect(due.body.nextCursor).toBeNull();

    const p1 = await mobileClient(app, a.token).get(`${V1}/notices?segment=due&limit=2`).expect(200);
    const p2 = await mobileClient(app, a.token).get(`${V1}/notices?segment=due&limit=2&cursor=${p1.body.nextCursor}`).expect(200);
    expect([...ids(p1.body.items), ...ids(p2.body.items)]).toEqual(ids(due.body.items));
    expect(p2.body.nextCursor).toBeNull();
  });

  it('is clear when nothing is due: acknowledged, archived and Not-on-Juvi rows are excluded', async () => {
    const a = await studentOnJuvi('device-a');
    const acked = await publishTestNotice(fx, { title: 'Acked', ackRequired: true });
    const archived = await publishTestNotice(fx, { title: 'Archived', ackRequired: true });
    await NoticeRecipient.updateOne({ noticeId: acked._id, accountId: a.account._id }, { $set: { ack: { at: new Date(), late: false, method: 'hold', sessionId: new Types.ObjectId(), offline: false } } });
    await Notice.updateOne({ _id: archived._id }, { $set: { status: 'archived' } });   // rows not mirrored yet: the notice status alone excludes it
    expect((await mobileClient(app, a.token).get(`${V1}/attention`).expect(200)).body).toEqual({ dueCount: 0, items: [] });

    const c = await provisionTestStudent(fx);                      // onboarding: Not on Juvi
    const tc = await signInAs(app, fx, c.student.rollNumber, c.tempPassword, 'device-c');
    await publishTestNotice(fx, { title: 'Later', ackRequired: true });
    expect((await mobileClient(app, tc).get(`${V1}/attention`).expect(200)).body.dueCount).toBe(0);
  });
});

describe('GET /notices segments and paging (US-3.5)', () => {
  it('all pages through every received notice newest first; done lists acknowledged and dismissed; a bad cursor is 400', async () => {
    const a = await studentOnJuvi('device-a');
    const published: LeanNotice[] = [];
    for (const title of ['One', 'Two', 'Three', 'Four', 'Five']) published.push(await publishTestNotice(fx, { title }));
    const titles: string[] = [];
    // An explicit Response annotation is required here: an unbounded loop whose exit condition is
    // reassigned from the awaited value trips a TS checker quirk (TS7022: circular `any` inference).
    let cursor: string | null = null;
    for (;;) {
      const res: Response = await mobileClient(app, a.token).get(`${V1}/notices?segment=all&limit=2${cursor ? `&cursor=${cursor}` : ''}`).expect(200);
      titles.push(...res.body.items.map((c: { title: string }) => c.title));
      cursor = res.body.nextCursor;
      if (!cursor) break;
    }
    expect(titles).toEqual(['Five', 'Four', 'Three', 'Two', 'One']);

    await NoticeRecipient.updateOne({ noticeId: published[1]!._id, accountId: a.account._id }, { $set: { seenAt: new Date(), dismissedAt: new Date() } });
    const done = await mobileClient(app, a.token).get(`${V1}/notices?segment=done`).expect(200);
    expect(done.body.items.map((c: { title: string; state: string }) => [c.title, c.state])).toEqual([['Two', 'dismissed']]);
    const bad = await mobileClient(app, a.token).get(`${V1}/notices?segment=all&cursor=not-a-cursor`).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('filters by office', async () => {
    const a = await studentOnJuvi('device-a');
    await publishTestNotice(fx, { title: 'From placement', office: 'Placement' });
    await publishTestNotice(fx, { title: 'From the office' });
    const res = await mobileClient(app, a.token).get(`${V1}/notices?office=Placement`).expect(200);
    expect(res.body.items.map((c: { title: string; office: string }) => [c.title, c.office])).toEqual([['From placement', 'Placement']]);
  });

  it('published lists what the caller published, marked isPublisher, even without a recipient row', async () => {
    const a = await studentOnJuvi('device-a');
    const fac = await provisionTestFaculty(fx);
    await activateAccount(String(fac.account._id));
    const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id) });
    const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
    await off.updateOne({ $set: { status: 'active' } });
    await createTestEnrollment(fx.collegeId, { studentId: String(a.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
    const mine = await publishTestNotice(fx, { title: 'Lab moved', audience: { rules: [{ kind: 'course_offering', ids: [String(off._id)] }] } }, erpRef(fac.user));
    await publishTestNotice(fx, { title: 'Office notice' });

    const tf = await signInAs(app, fx, fac.faculty.employeeCode, fac.tempPassword, 'device-f');
    const res = await mobileClient(app, tf).get(`${V1}/notices?segment=published`).expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ id: String(mine._id), title: 'Lab moved', office: 'Course Faculty', isPublisher: true, state: 'received' });
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${mine._id}`).expect(200)).body.isPublisher).toBe(false);
    expect((await mobileClient(app, a.token).get(`${V1}/notices?segment=published`).expect(200)).body.items).toEqual([]);
  });
});

describe('GET /notices/:id and POST /notices/:id/seen (US-2.1, US-2.5, US-2.6)', () => {
  it('returns the detail with my state; reading never marks seen; seen is set once', async () => {
    const a = await studentOnJuvi('device-a');
    const key = `${attachmentPrefix(fx.collegeId)}${randomUUID()}`;
    const n = await publishTestNotice(fx, { title: 'Timetable', body: 'Attached.', ackRequired: true, ackCommentAllowed: true, attachments: [{ key, name: 'timetable.pdf', mime: 'application/pdf', size: 1234 }] });
    await mobileClient(app, a.token).get(`${V1}/notices`).expect(200);
    const d = await mobileClient(app, a.token).get(`${V1}/notices/${n._id}`).expect(200);
    expect(d.body).toMatchObject({
      id: String(n._id), body: 'Attached.', attachments: [{ key, name: 'timetable.pdf', mime: 'application/pdf', size: 1234 }], attachmentCount: 1,
      state: 'received', seenAt: null, ackMethod: null, ackComment: null, ackOffline: false, dismissedAt: null, ackCommentAllowed: true,
    });
    expect((await NoticeRecipient.findOne({ noticeId: n._id, accountId: a.account._id }).lean())!.seenAt).toBeNull();

    const s1 = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/seen`).expect(200);
    const s2 = await mobileClient(app, a.token).post(`${V1}/notices/${n._id}/seen`).expect(200);
    expect(s2.body.seenAt).toBe(s1.body.seenAt);
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${n._id}`)).body).toMatchObject({ state: 'seen', seenAt: s1.body.seenAt });
  });

  it('is 404 NOTICE_NOT_FOUND without a recipient row or for a malformed id; an archived notice stays readable', async () => {
    const a = await studentOnJuvi('device-a');
    const b = await studentOnJuvi('device-b');
    const onlyA = await publishTestNotice(fx, { audience: { rules: [{ kind: 'custom', ids: [String(a.person._id)] }] } });
    for (const path of [`/notices/${onlyA._id}`, `/notices/${onlyA._id}/attachments/x`]) {
      expect((await mobileClient(app, b.token).get(`${V1}${path}`).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
    }
    expect((await mobileClient(app, b.token).post(`${V1}/notices/${onlyA._id}/seen`).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
    expect((await mobileClient(app, a.token).get(`${V1}/notices/not-an-id`).expect(404)).body.error.code).toBe('NOTICE_NOT_FOUND');
    await Notice.updateOne({ _id: onlyA._id }, { $set: { status: 'archived' } });
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${onlyA._id}`).expect(200)).body.archived).toBe(true);
  });
});

describe('GET /notices/:id/attachments/:key (spec §10)', () => {
  it('signs a 5-minute URL only for a key in the notice list, and is 503 without storage', async () => {
    const a = await studentOnJuvi('device-a');
    const key = `${attachmentPrefix(fx.collegeId)}${randomUUID()}`;
    const n = await publishTestNotice(fx, { attachments: [{ key, name: 'a.pdf', mime: 'application/pdf', size: 10 }] });
    const ok = await mobileClient(app, a.token).get(`${V1}/notices/${n._id}/attachments/${encodeURIComponent(key)}`).expect(200);
    expect(ok.body.url).toContain('X-Amz-Expires=300');
    const ttl = new Date(ok.body.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(290_000);
    expect(ttl).toBeLessThanOrEqual(300_000);

    const probe = `${attachmentPrefix(fx.collegeId)}${randomUUID()}`;
    expect((await mobileClient(app, a.token).get(`${V1}/notices/${n._id}/attachments/${encodeURIComponent(probe)}`).expect(404)).body.error.code).toBe('NOT_FOUND');
    s3.configured = false;
    await mobileClient(app, a.token).get(`${V1}/notices/${n._id}/attachments/${encodeURIComponent(key)}`).expect(503);
  });
});

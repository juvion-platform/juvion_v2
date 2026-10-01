import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Lets a test run code right after the next audience-graph load returns: the
// window between the fan-out's graph load and its row writes (final review I1).
const graphHook = vi.hoisted(() => ({ afterLoad: null as null | (() => Promise<void>) }));
vi.mock('../../modules/juvi-app/notices/audience-graph', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../modules/juvi-app/notices/audience-graph')>();
  return {
    ...real,
    loadAudienceGraph: async (...args: Parameters<typeof real.loadAudienceGraph>) => {
      const graph = await real.loadAudienceGraph(...args);
      const hook = graphHook.afterLoad;
      graphHook.afterLoad = null;
      if (hook) await hook();
      return graph;
    },
  };
});

import type { Express } from 'express';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestStudent } from '../factories/student.factory';
import { enableJuvi, provisionTestStudent, provisionTestFaculty, mobileClient } from '../factories/juvi.factory';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { activateAccount, publishTestNotice, signInAs, createStaffPublisher } from '../factories/notice.factory';
import { Section } from '../../models';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { OutboxEvent, drainOutbox } from '../../shared/outbox';
import { AuditLog } from '../../shared/audit';
import { fanOutNotice, recordAcknowledgement } from '../../modules/juvi-app/notices/consumers';
import { loadAudienceGraph } from '../../modules/juvi-app/notices/audience-graph';
import { personMatchesRules } from '../../modules/juvi-app/notices/audience';
import { archiveNotice } from '../../modules/juvi-app/notices/publish-service';
import { erpActor } from '../../modules/juvi-app/notices/reach-service';
import { ackResponseSchema, remindersSchema } from '../../modules/juvi-app/notices/schemas';
import { IAudienceRule } from '../../models/juvi/Notice';

process.env.E2E_TESTING = '1';

let app: Express; let api: TestApi; let fx: BaseFixtures;
const V1 = '/api/juvi-app/v1';
const ADMIN = '/api/juvi-app/admin/notices';
const batchRule = () => [{ kind: 'batch' as const, ids: [String(fx.batch._id)] }];

beforeAll(async () => { app = await getTestApp(); api = createTestApi(app); });
beforeEach(async () => { graphHook.afterLoad = null; await drainOutbox(); await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

/** A `publishing` notice with no event, so only the explicit fanOutNotice call below runs the fan-out. */
async function publishingNotice(rules: IAudienceRule[] = batchRule()) {
  return Notice.create({
    collegeId: fx.collegeId, title: 'Fee dates', body: 'Pay by Friday.', publisher: { userId: fx.admin.user._id, office: 'Office' },
    audience: { rules, line: 'Sent to 2024 Batch' }, ackRequired: true, status: 'publishing',
  });
}

describe('activation racing the fan-out (final review I1)', () => {
  it('a member who activates between the graph load and the row writes still gets their account on the row, and the counts are exact', async () => {
    const on = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(on.account._id));
    const racer = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });   // onboarding at graph load
    const notice = await publishingNotice();

    graphHook.afterLoad = async () => { await activateAccount(String(racer.account._id)); };
    await fanOutNotice({ collegeId: fx.collegeId, noticeId: String(notice._id) });
    expect(graphHook.afterLoad).toBeNull();                                                  // the hook ran inside the fan-out

    const row = (await NoticeRecipient.findOne({ noticeId: notice._id, personId: racer.person._id }).lean())!;
    expect(String(row.accountId)).toBe(String(racer.account._id));
    expect(row.receivedAt).toBeInstanceOf(Date);
    expect((await Notice.findById(notice._id).lean())!).toMatchObject({ status: 'published', counts: { audience: 2, onJuvi: 2 } });
  });

  it('activation recounts onJuvi from the rows instead of incrementing it', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const n = await publishTestNotice(fx);
    expect(n.counts).toEqual({ audience: 1, onJuvi: 0 });
    await Notice.updateOne({ _id: n._id }, { $set: { 'counts.onJuvi': 5 } });                // a stale count, as after a racing $inc
    await activateAccount(String(s.account._id));
    expect((await Notice.findById(n._id).lean())!.counts).toEqual({ audience: 1, onJuvi: 1 });
  });
});

describe('query shapes use their indexes (final review I2, I3)', () => {
  it('activation finds a person\'s rows through (collegeId, personId)', async () => {
    await NoticeRecipient.init();
    const plan = await NoticeRecipient.find({ collegeId: fx.collegeId, personId: new Types.ObjectId(), accountId: null }).explain('queryPlanner') as unknown;
    expect(JSON.stringify(plan)).toContain('"collegeId_1_personId_1"');
  });

  it('the acknowledgement audit dedupe uses the partial (collegeId, entityType, entityId, recipientId) index', async () => {
    await AuditLog.init();
    const indexes = await AuditLog.collection.indexes();
    expect(indexes.find((i) => i.key['changes.newValue.recipientId'])).toMatchObject({
      key: { collegeId: 1, entityType: 1, entityId: 1, 'changes.newValue.recipientId': 1 },
      partialFilterExpression: { entityType: 'NoticeAcknowledgement' },
    });
    const plan = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeAcknowledgement', entityId: 'n1', 'changes.newValue.recipientId': 'r1' })
      .explain('queryPlanner') as unknown;
    const winning = JSON.stringify((plan as { queryPlanner: { winningPlan: unknown } }).queryPlanner.winningPlan);
    expect(winning).toContain('changes.newValue.recipientId');
  });

  it('recordAcknowledgement still writes one entry per recipient row', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const n = await publishTestNotice(fx, { ackRequired: true });
    const t = await signInAs(app, fx, s.student.rollNumber, s.tempPassword, 'device-dedupe');
    await mobileClient(app, t).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(200);
    await drainOutbox();
    const row = (await NoticeRecipient.findOne({ noticeId: n._id, personId: s.person._id }).lean())!;
    await recordAcknowledgement({ collegeId: fx.collegeId, recipientId: String(row._id) });
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'NoticeAcknowledgement', entityId: String(n._id) })).toBe(1);
  });
});

describe('the single-person graph load (final review I4)', () => {
  it('loads only the offerings the person can match, and matches exactly as the full load does', async () => {
    const eceSection = await Section.create({ collegeId: fx.collegeId, name: 'B', branchId: fx.eceBranch._id, batchId: fx.batch._id, year: 1, semester: 1, capacity: 60 });
    const fac = await provisionTestFaculty(fx);
    const other = await provisionTestFaculty(fx, { departmentId: String(fx.ece._id) });
    const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id) });
    const mk = async (sectionId: string, facultyId: string) => {
      const o = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId, facultyId });
      await o.updateOne({ $set: { status: 'active' } });
      return o;
    };
    const enrolled = await mk(String(fx.cseSection._id), String(fac.faculty._id));   // enrolments: reaches enrolled students
    const roster = await mk(String(fx.cseSection._id), String(fac.faculty._id));     // no enrolments: reaches the section roster
    const elective = await mk(String(eceSection._id), String(other.faculty._id));    // another section; s1 is enrolled in it
    const unrelated = await mk(String(eceSection._id), String(other.faculty._id));   // nothing to do with s1 or fac

    const s1 = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const s2 = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const e1 = await provisionTestStudent(fx, { sectionId: String(eceSection._id), branchId: String(fx.eceBranch._id) });
    const enrol = (s: { student: { _id: unknown } }, o: { _id: unknown }) =>
      createTestEnrollment(fx.collegeId, { studentId: String(s.student._id), courseOfferingId: String(o._id), semesterId: String(fx.sem1._id) });
    await enrol(s1, enrolled); await enrol(s2, enrolled); await enrol(s1, elective); await enrol(e1, elective); await enrol(e1, unrelated);

    const full = await loadAudienceGraph(fx.collegeId);
    const rules: IAudienceRule[][] = [
      ...[enrolled, roster, elective, unrelated].map((o) => [{ kind: 'course_offering' as const, ids: [String(o._id)] }]),
      [{ kind: 'section', ids: [String(fx.cseSection._id)] }], [{ kind: 'batch', ids: [String(fx.batch._id)] }],
      [{ kind: 'department', ids: [String(fx.cse._id)] }], [{ kind: 'role', ids: ['faculty'] }],
    ];
    for (const who of [s1, s2, e1, fac]) {
      const pid = String(who.person._id);
      const one = await loadAudienceGraph(fx.collegeId, { personIds: [pid] });
      expect(one.people.size).toBe(1);
      expect(one.people.get(pid)).toEqual(full.people.get(pid));
      for (const r of rules) expect(personMatchesRules(r, one.people.get(pid)!, one), JSON.stringify(r)).toBe(personMatchesRules(r, full.people.get(pid)!, full));
    }
    expect(full.offerings.size).toBe(4);
    const s1Graph = await loadAudienceGraph(fx.collegeId, { personIds: [String(s1.person._id)] });
    expect([...s1Graph.offerings.keys()].sort()).toEqual([enrolled, roster, elective].map((o) => String(o._id)).sort());
    expect(s1Graph.people.get(String(s1.person._id))!.offeringIds.sort()).toEqual([enrolled, roster, elective].map((o) => String(o._id)).sort());
    const facGraph = await loadAudienceGraph(fx.collegeId, { personIds: [String(fac.person._id)] });
    expect([...facGraph.offerings.keys()].sort()).toEqual([enrolled, roster].map((o) => String(o._id)).sort());
  });
});

describe('the 409 details in the contract (final review I5)', () => {
  it('ALREADY_ACKNOWLEDGED carries error.ack and REMINDER_LIMIT carries error.reminders, in their contract shapes', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const fac = await provisionTestFaculty(fx);
    await activateAccount(String(fac.account._id));
    const n = await publishTestNotice(fx, { ackRequired: true, audience: { rules: [{ kind: 'custom', ids: [String(s.person._id)] }] } });
    const t = await signInAs(app, fx, s.student.rollNumber, s.tempPassword, 'device-409');
    await mobileClient(app, t).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(200);
    const again = await mobileClient(app, t).post(`${V1}/notices/${n._id}/ack`).send({ method: 'hold' }).expect(409);
    expect(again.body.error.code).toBe('ALREADY_ACKNOWLEDGED');
    expect(ackResponseSchema.strict().parse(again.body.error.ack)).toMatchObject({ method: 'hold', late: false });

    await Notice.updateOne({ _id: n._id }, { $set: { 'publisher.userId': fac.user._id } });
    const facToken = await signInAs(app, fx, fac.faculty.employeeCode, fac.tempPassword, 'device-fac-409');
    for (let i = 0; i < 2; i++) await mobileClient(app, facToken).post(`${V1}/notices/${n._id}/remind`).expect(200);
    const limit = await mobileClient(app, facToken).post(`${V1}/notices/${n._id}/remind`).expect(409);
    expect(limit.body.error.code).toBe('REMINDER_LIMIT');
    expect(remindersSchema.strict().parse(limit.body.error.reminders)).toMatchObject({ used: 2, max: 2 });
  });
});

describe('GET /admin/notices/dead-events (spec §6.2)', () => {
  it('lists this college\'s dead notice events, paged, for admins only', async () => {
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const dead = (type: string, key: string, at: Date, collegeId = fx.collegeId) => OutboxEvent.create({
      collegeId, type, payload: { collegeId, noticeId: key }, dedupeKey: `test:${key}:${type}`,
      status: 'dead', attempts: 8, lastError: 'boom', availableAt: at, lockedUntil: null, createdAt: at,
    });
    await dead('notice.published', 'a', new Date(Date.now() - 3000));
    await dead('notice.acknowledged', 'b', new Date(Date.now() - 2000));
    await dead('other.event', 'c', new Date(Date.now() - 1000));                    // not a notice event
    await dead('notice.published', 'd', new Date(), '000000000000000000000099');   // another college
    await OutboxEvent.create({ collegeId: fx.collegeId, type: 'notice.published', payload: { collegeId: fx.collegeId }, dedupeKey: 'test:pending', status: 'pending', attempts: 1, availableAt: new Date(), lockedUntil: null });

    const res = await api.as(fx.admin.token).get(`${ADMIN}/dead-events`).expect(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pages: 1 });
    expect(res.body.items.map((e: { type: string; noticeId: string }) => [e.type, e.noticeId])).toEqual([['notice.acknowledged', 'b'], ['notice.published', 'a']]);
    expect(res.body.items[0]).toEqual({ id: expect.any(String), type: 'notice.acknowledged', noticeId: 'b', attempts: 8, lastError: 'boom', createdAt: expect.any(String), updatedAt: expect.any(String) });
    const p2 = await api.as(fx.admin.token).get(`${ADMIN}/dead-events?limit=1&page=2`).expect(200);
    expect(p2.body).toMatchObject({ total: 2, page: 2, pages: 2 });
    expect(p2.body.items.map((e: { noticeId: string }) => e.noticeId)).toEqual(['a']);
    expect((await api.as(exam.token).get(`${ADMIN}/dead-events`).expect(403)).body).toEqual({ error: 'Only admins can see failed deliveries' });
  });
});

describe('students and parents are refused reach and audited, even for a missing notice (US-4.5, RCH-02)', () => {
  it('mobile: reach, pending and remind check the role first', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const t = await signInAs(app, fx, s.student.rollNumber, s.tempPassword, 'device-refuse');
    const missing = String(new Types.ObjectId());
    for (const [method, path] of [['get', 'reach'], ['get', 'reach/pending'], ['post', 'remind']] as const) {
      const res = await mobileClient(app, t)[method](`${V1}/notices/${missing}/${path}`).expect(403);
      expect(res.body.error.code).toBe('NOT_PUBLISHER');
    }
    const audit = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeReach', entityId: missing, action: 'access_denied' }).lean();
    expect(audit.map((a) => (a.changes[0]!.newValue as { action: string }).action).sort()).toEqual(['reach', 'reach', 'remind']);
    expect(audit[0]).toMatchObject({ entityName: 'Notice', performedBy: s.person.name });
    expect(audit[0]!.changes[0]!.newValue).toMatchObject({ via: 'mobile', role: 'student' });
  });

  it('ERP: the reach routes audit a student before authorize() refuses, with RBAC enforced', async () => {
    const student = await createTestStudent(fx.collegeId, { batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    await provisionTestStudent(fx);
    const n = await publishTestNotice(fx);
    const missing = String(new Types.ObjectId());
    const prev = process.env.RBAC_ENFORCE;
    process.env.RBAC_ENFORCE = 'true';
    try {
      expect((await api.as(student.token).get(`${ADMIN}/${n._id}/reach`).expect(403)).body).toEqual({ error: 'Access denied' });
      await api.as(student.token).get(`${ADMIN}/${n._id}/reach/pending`).expect(403);
      await api.as(student.token).get(`${ADMIN}/${missing}/reach`).expect(403);
      await api.as(fx.admin.token).get(`${ADMIN}/${n._id}/reach`).expect(200);
    } finally {
      process.env.RBAC_ENFORCE = prev;
    }
    const onNotice = await AuditLog.find({ collegeId: fx.collegeId, entityType: 'NoticeReach', entityId: String(n._id), action: 'access_denied' }).lean();
    expect(onNotice).toHaveLength(2);
    expect(onNotice[0]!.entityName).toMatch(/^Notice from /);
    expect(onNotice[0]!.changes[0]!.newValue).toMatchObject({ action: 'reach', via: 'erp', role: 'student' });
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'NoticeReach', entityId: missing, action: 'access_denied' })).toBe(1);
  });

  it('ERP without enforcement: one audit entry per refused attempt, not two', async () => {
    const student = await createTestStudent(fx.collegeId, { batchId: String(fx.batch._id), branchId: String(fx.cseBranch._id) });
    await provisionTestStudent(fx);
    const n = await publishTestNotice(fx);
    const res = await api.as(student.token).get(`${ADMIN}/${n._id}/reach`).expect(403);
    expect(res.body).toEqual({ error: 'Only the publisher of this notice can do that.' });
    expect(await AuditLog.countDocuments({ collegeId: fx.collegeId, entityType: 'NoticeReach', entityId: String(n._id), action: 'access_denied' })).toBe(1);
  });
});

describe('archive a notice whose delivery is dead (final review minor)', () => {
  it('a publishing notice with a dead notice.published event can be archived; one still delivering cannot', async () => {
    await provisionTestStudent(fx);
    const stuck = await publishingNotice();
    const admin = erpActor(fx.collegeId, { id: String(fx.admin.user._id), name: 'Admin', role: 'admin' });
    await expect(archiveNotice(admin, String(stuck._id))).rejects.toMatchObject({ statusCode: 409, code: 'VALIDATION_FAILED' });
    await OutboxEvent.create({
      collegeId: fx.collegeId, type: 'notice.published', payload: { collegeId: fx.collegeId, noticeId: String(stuck._id) },
      dedupeKey: `notice:${stuck._id}:published`, status: 'dead', attempts: 8, lastError: 'boom', availableAt: new Date(), lockedUntil: null,
    });
    expect((await archiveNotice(admin, String(stuck._id))).status).toBe('archived');
    expect((await Notice.findById(stuck._id).lean())!.status).toBe('archived');
    const audit = await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'Notice', entityId: String(stuck._id), action: 'archive' }).lean();
    expect(audit!.changes[0]).toMatchObject({ oldValue: 'publishing', newValue: 'archived' });
  });
});

describe('reach totals come from the rows (final review minor)', () => {
  it('audience is the snapshot row count, so the four buckets always add up', async () => {
    await provisionTestStudent(fx);
    await provisionTestStudent(fx);
    const n = await publishTestNotice(fx);
    await Notice.updateOne({ _id: n._id }, { $set: { 'counts.audience': 7 } });          // as after a crash between a row write and its $inc
    const r = (await api.as(fx.admin.token).get(`${ADMIN}/${n._id}/reach`).expect(200)).body;
    expect(r.audience).toBe(2);
    expect(r.acknowledged + r.seen + r.notSeen + r.notOnJuvi).toBe(r.audience);
  });
});


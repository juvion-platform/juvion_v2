import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const s3 = vi.hoisted(() => ({ configured: false, put: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../shared/s3/s3-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../shared/s3/s3-client')>()),
  isS3Configured: () => s3.configured,
  putObject: (input: unknown) => s3.put(input),
}));

import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, provisionTestStudent, provisionTestFaculty } from '../factories/juvi.factory';
import { createTestCourse, createTestCourseOffering, createTestEnrollment } from '../factories/academic.factory';
import { createTestUser } from '../factories/user.factory';
import { adminRef, erpRef, activateAccount, createStaffPublisher, makeHod, publishTestNotice } from '../factories/notice.factory';
import { Department, Staff, Person } from '../../models';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { Channel } from '../../models/juvi/Channel';
import { OutboxEvent, drainOutbox } from '../../shared/outbox';
import { AuditLog } from '../../shared/audit';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';
import { resolvePublisherScope } from '../../modules/juvi-app/notices/publisher-scope';
import { previewAudience, publishNotice, uploadAttachment, attachmentPrefix } from '../../modules/juvi-app/notices/publish-service';
import { fanOutNotice, sweepStuckNotices, __setFanoutBatchSizeForTesting, __resetFanoutBatchSizeForTesting } from '../../modules/juvi-app/notices/consumers';
import { publishSchema, audiencePreviewSchema } from '../../modules/juvi-app/notices/admin-schemas';

let fx: BaseFixtures;
beforeAll(async () => { await getTestApp(); });
beforeEach(async () => {
  await drainOutbox();
  await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId);
  s3.configured = false; s3.put.mockClear();
});
afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

const batchRule = () => [{ kind: 'batch' as const, ids: [String(fx.batch._id)] }];
const body = (extra: Record<string, unknown> = {}) => publishSchema.parse({ title: 'Fee dates', body: 'Pay by Friday.', audience: { rules: batchRule() }, ...extra });

describe('previewAudience', () => {
  it('counts the audience, on Juvi and not, grouped, and matches the snapshot written at publish (US-1.2)', async () => {
    const on = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(on.account._id));
    await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });   // onboarding: Not on Juvi
    await provisionTestStudent(fx);                                             // no section
    const scope = await resolvePublisherScope(fx.collegeId, adminRef(fx));
    const preview = await previewAudience(fx.collegeId, scope, batchRule());
    expect(preview).toEqual({
      total: 3, onJuvi: 1, notOnJuvi: 2, line: 'Sent to 2024 Batch',
      groups: [{ label: '2024 Batch', total: 1, onJuvi: 0 }, { label: '2024 Batch · Section A', total: 2, onJuvi: 1 }],
    });
    const notice = await publishTestNotice(fx, { audience: { rules: batchRule() } });
    expect(notice.counts).toEqual({ audience: preview.total, onJuvi: preview.onJuvi });
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id, addedLater: false })).toBe(preview.total);
  });
});

describe('publishNotice and the notice.published fan-out', () => {
  it('writes a publishing notice, records the event and the audit row, then fans out one row per member', async () => {
    const a = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(a.account._id));
    const b = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await reconcileCollege(fx.collegeId);   // creates the college, department and batch channels
    const scope = await resolvePublisherScope(fx.collegeId, adminRef(fx));
    const deadline = new Date(Date.now() + 86_400_000).toISOString();
    const notice = await publishNotice(fx.collegeId, scope, body({ ackRequired: true, ackDeadline: deadline }), 'College Admin');

    expect(notice.status).toBe('publishing');
    expect(notice.publisher.office).toBe('College Office');
    expect(String(notice.publisher.userId)).toBe(String(fx.admin.user._id));
    expect(notice.audience.line).toBe('Sent to 2024 Batch');
    const event = await OutboxEvent.findOne({ dedupeKey: `notice:${notice._id}:published` }).lean();
    expect(event).toMatchObject({ type: 'notice.published', payload: { collegeId: fx.collegeId, noticeId: String(notice._id) } });
    const audit = await AuditLog.findOne({ collegeId: fx.collegeId, entityType: 'Notice', entityId: String(notice._id), action: 'publish' }).lean();
    expect(audit?.entityName).toBe('Notice from College Office');
    expect(JSON.stringify(audit)).not.toContain('Fee dates');

    await drainOutbox();
    const done = (await Notice.findById(notice._id).lean())!;
    expect(done).toMatchObject({ status: 'published', counts: { audience: 2, onJuvi: 1 } });
    expect(done.publishedAt).toBeInstanceOf(Date);
    const batchChannel = (await Channel.findOne({ collegeId: fx.collegeId, scopeType: 'batch', scopeId: fx.batch._id }).lean())!;
    expect(done.channelIds.map(String)).toEqual([String(batchChannel._id)]);

    const rows = await NoticeRecipient.find({ noticeId: notice._id }).lean();
    const rowA = rows.find((r) => String(r.personId) === String(a.person._id))!;
    const rowB = rows.find((r) => String(r.personId) === String(b.person._id))!;
    expect(rowA).toMatchObject({ kind: 'student', addedLater: false, ackRequired: true, ack: null, archived: false, labels: { batch: '2024 Batch', section: 'A', department: 'Computer Science' } });
    expect(String(rowA.accountId)).toBe(String(a.account._id));
    expect(rowA.receivedAt).toBeInstanceOf(Date);
    expect(rowA.deadline?.toISOString()).toBe(new Date(deadline).toISOString());
    expect(rowB.accountId).toBeNull();
    expect(rowB.receivedAt).toBeNull();
  });

  it('is idempotent: a re-run changes nothing, and a retry after a partial fan-out fills only the gap', async () => {
    const a = await provisionTestStudent(fx);
    const b = await provisionTestStudent(fx);
    const notice = await publishTestNotice(fx);
    const before = await NoticeRecipient.find({ noticeId: notice._id }).sort({ personId: 1 }).lean();
    await fanOutNotice({ collegeId: fx.collegeId, noticeId: String(notice._id) });
    expect(await NoticeRecipient.find({ noticeId: notice._id }).sort({ personId: 1 }).lean()).toEqual(before);

    // A crash after the first batch: back to publishing with one row missing.
    await NoticeRecipient.deleteOne({ noticeId: notice._id, personId: b.person._id });
    await Notice.updateOne({ _id: notice._id }, { $set: { status: 'publishing' } });
    await fanOutNotice({ collegeId: fx.collegeId, noticeId: String(notice._id) });
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id })).toBe(2);
    const keptA = before.find((r) => String(r.personId) === String(a.person._id))!;
    expect(String((await NoticeRecipient.findOne({ noticeId: notice._id, personId: a.person._id }).lean())!._id)).toBe(String(keptA._id));
    expect((await Notice.findById(notice._id).lean())!).toMatchObject({ status: 'published', counts: { audience: 2 } });
  });

  it('a published notice is never edited by the consumer again (US-1.4)', async () => {
    await provisionTestStudent(fx);
    const notice = await publishTestNotice(fx);
    await Notice.updateOne({ _id: notice._id }, { $set: { status: 'archived' } });
    await fanOutNotice({ collegeId: fx.collegeId, noticeId: String(notice._id) });
    expect((await Notice.findById(notice._id).lean())!.status).toBe('archived');
  });
});

describe('publisher scope on preview and publish (US-1.1)', () => {
  it('an HOD targets their department, is refused another, and a role rule is pinned before it is stored', async () => {
    const hod = await makeHod(fx, fx.cse);
    const ece = await provisionTestStudent(fx, { branchId: String(fx.eceBranch._id) });
    await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const scope = await resolvePublisherScope(fx.collegeId, erpRef(hod.user));
    expect(scope).toMatchObject({ kind: 'department', departmentId: String(fx.cse._id), office: 'HOD, Computer Science', isAdmin: false });

    expect((await previewAudience(fx.collegeId, scope, [{ kind: 'section', ids: [String(fx.cseSection._id)] }])).total).toBe(1);
    await expect(previewAudience(fx.collegeId, scope, [{ kind: 'department', ids: [String(fx.ece._id)] }])).rejects.toMatchObject({ statusCode: 403 });
    await expect(publishNotice(fx.collegeId, scope, body({ audience: { rules: [{ kind: 'custom', ids: [String(ece.person._id)] }] } }), 'hod')).rejects.toMatchObject({ statusCode: 403 });
    expect(await Notice.countDocuments({ collegeId: fx.collegeId })).toBe(0);

    const n = await publishNotice(fx.collegeId, scope, body({ audience: { rules: [{ kind: 'role', ids: ['student'] }] } }), 'hod');
    expect(n.audience.rules).toEqual([{ kind: 'role', ids: ['student'], departmentId: String(fx.cse._id) }]);
    await drainOutbox();
    expect((await Notice.findById(n._id).lean())!.counts.audience).toBe(1);   // the CSE student only
  });

  it('teaching faculty target the offerings they teach and nothing else', async () => {
    const fac = await provisionTestFaculty(fx);
    const stu = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id) });
    const off = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
    await off.updateOne({ $set: { status: 'active' } });
    await createTestEnrollment(fx.collegeId, { studentId: String(stu.student._id), courseOfferingId: String(off._id), semesterId: String(fx.sem1._id) });
    const scope = await resolvePublisherScope(fx.collegeId, erpRef(fac.user));
    expect(scope).toMatchObject({ kind: 'offerings', offeringIds: [String(off._id)], office: 'Course Faculty' });
    expect((await previewAudience(fx.collegeId, scope, [{ kind: 'course_offering', ids: [String(off._id)] }])).total).toBe(1);
    await expect(previewAudience(fx.collegeId, scope, [{ kind: 'section', ids: [String(fx.cseSection._id)] }])).rejects.toMatchObject({ statusCode: 403 });
  });

  it('a teaching offering from a semester that is not active is excluded from the faculty scope (R6a)', async () => {
    const fac = await provisionTestFaculty(fx);
    const course = await createTestCourse(fx.collegeId, { regulationId: String(fx.regulation._id), departmentId: String(fx.cse._id) });
    const current = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem1._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
    await current.updateOne({ $set: { status: 'active' } });
    const stale = await createTestCourseOffering(fx.collegeId, { courseId: String(course._id), semesterId: String(fx.sem2._id), sectionId: String(fx.cseSection._id), facultyId: String(fac.faculty._id) });
    await stale.updateOne({ $set: { status: 'active' } });   // fx.sem2 is 'upcoming', not 'active'

    const scope = await resolvePublisherScope(fx.collegeId, erpRef(fac.user));
    expect(scope.kind).toBe('offerings');
    expect(scope.offeringIds).toEqual([String(current._id)]);
    expect(scope.offeringIds).not.toContain(String(stale._id));
  });

  it('a faculty member who also heads a department (F-FAC + HOD) gets the broader department scope (R6b)', async () => {
    const fac = await provisionTestFaculty(fx, { departmentId: String(fx.cse._id) });
    expect(fac.user.role).toBe('faculty');   // never promoted to the 'hod' role; headship alone must win
    await Department.updateOne({ _id: fx.cse._id, collegeId: fx.collegeId }, { $set: { hodId: fac.faculty._id } });

    const scope = await resolvePublisherScope(fx.collegeId, erpRef(fac.user));
    expect(scope).toMatchObject({ kind: 'department', departmentId: String(fx.cse._id), office: 'HOD, Computer Science' });
  });

  it('a teaching faculty who also holds an active staff office persona gets the broader college scope (R6b)', async () => {
    const fac = await provisionTestFaculty(fx);
    // A genuine second, active employment record for the same person — not
    // just a claimed persona string — is what "genuinely holds" means (R7).
    await Staff.create({
      collegeId: fx.collegeId, personId: fac.person._id, employeeCode: `EXAM-${fac.faculty.employeeCode}`,
      designation: 'Exam Cell Coordinator', staffType: 'administrative', personaCode: 'ST-EXAM', status: 'active',
    });
    const scope = await resolvePublisherScope(fx.collegeId, erpRef(fac.user));
    expect(scope).toMatchObject({ kind: 'college', office: 'Exam Section', isAdmin: false });
  });

  it('a separated Staff row with ST-EXAM gives no college scope, when User.personaType names no office (R7/R8)', async () => {
    // Isolated from R8's User.personaType/personas source: this User's own
    // persona ('ST-HR', not an office family) never grants an office, so the
    // only way it could escalate is through the Staff row — which is separated.
    const person = await Person.create({ collegeId: fx.collegeId, name: 'Ex Exam Officer', phone: '9600099999' });
    const staff = await Staff.create({
      collegeId: fx.collegeId, personId: person._id, employeeCode: 'STF-SEP-0001', designation: 'Exam Officer',
      staffType: 'administrative', personaCode: 'ST-EXAM', status: 'separated',
    });
    const { user } = await createTestUser({
      collegeId: fx.collegeId, role: 'staff', personaType: 'ST-HR', personas: ['ST-HR'],
      name: person.name, email: 'separated-exam-officer@test.com', personId: String(person._id),
    });
    const scope = await resolvePublisherScope(fx.collegeId, erpRef(user));
    expect(scope.kind).toBe('none');
    expect(String(staff.status)).toBe('separated');
  });

  it('a staff-role user with ST-REG only in User.personas and no Staff row gets college scope (R8)', async () => {
    const person = await Person.create({ collegeId: fx.collegeId, name: 'Registrar Clerk', phone: '9600088888' });
    const { user } = await createTestUser({
      collegeId: fx.collegeId, role: 'staff', personaType: 'ST-REG', personas: ['ST-REG'],
      name: person.name, email: 'registrar-clerk@test.com', personId: String(person._id),
    });
    expect(await Staff.findOne({ collegeId: fx.collegeId, personId: person._id })).toBeNull();   // persona-only, no Staff row
    const scope = await resolvePublisherScope(fx.collegeId, erpRef(user));
    expect(scope).toMatchObject({ kind: 'college', office: 'Registrar', isAdmin: false });
  });

  it('the same shape of user with role student gets no publisher scope (R8)', async () => {
    const person = await Person.create({ collegeId: fx.collegeId, name: 'Student Claiming Registrar', phone: '9600077777' });
    const { user } = await createTestUser({
      collegeId: fx.collegeId, role: 'student', personaType: 'ST-REG', personas: ['ST-REG'],
      name: person.name, email: 'student-claims-registrar@test.com', personId: String(person._id),
    });
    const scope = await resolvePublisherScope(fx.collegeId, erpRef(user));
    expect(scope.kind).toBe('none');
  });

  it('a faculty member with a separated exam-cell Staff row gets only their offerings scope, not college (R7)', async () => {
    const fac = await provisionTestFaculty(fx);
    const examCell = await Staff.create({
      collegeId: fx.collegeId, personId: fac.person._id, employeeCode: `EXAM-${fac.faculty.employeeCode}`,
      designation: 'Exam Cell Coordinator', staffType: 'administrative', personaCode: 'ST-EXAM', status: 'separated',
    });
    const scope = await resolvePublisherScope(fx.collegeId, erpRef(fac.user));
    expect(scope.kind).toBe('offerings');
    expect(String(examCell.status)).toBe('separated');
  });

  it('a student role is refused publisher scope even when personas name a staff office (R7)', async () => {
    const { user } = await createTestUser({
      collegeId: fx.collegeId, role: 'student', personaType: 'L-STU', personas: ['L-STU', 'ST-EXAM'],
      name: 'Student With Claimed Office', email: 'student-claimed-office@test.com',
    });
    const scope = await resolvePublisherScope(fx.collegeId, { id: String(user._id), role: 'student', personaType: 'L-STU', personas: ['L-STU', 'ST-EXAM'] });
    expect(scope.kind).toBe('none');
  });

  it('a staff office publishes college-wide under its office words; another staff member cannot publish', async () => {
    await provisionTestStudent(fx);
    const exam = await createStaffPublisher(fx, 'ST-EXAM');
    const hr = await createStaffPublisher(fx, 'ST-HR');
    expect(await resolvePublisherScope(fx.collegeId, erpRef(exam.user))).toMatchObject({ kind: 'college', office: 'Exam Section', isAdmin: false });
    const n = await publishTestNotice(fx, { audience: { rules: [{ kind: 'all', ids: [] }] } }, erpRef(exam.user));
    expect(n.publisher.office).toBe('Exam Section');
    const hrScope = await resolvePublisherScope(fx.collegeId, erpRef(hr.user));
    expect(hrScope.kind).toBe('none');
    await expect(previewAudience(fx.collegeId, hrScope, [{ kind: 'all', ids: [] }])).rejects.toMatchObject({ statusCode: 403 });
  });

  it('an admin chooses the office; an unknown office is refused; a principal defaults to the principal office', async () => {
    expect((await resolvePublisherScope(fx.collegeId, adminRef(fx), 'Placement')).office).toBe('Placement');
    await expect(resolvePublisherScope(fx.collegeId, adminRef(fx), 'Canteen')).rejects.toMatchObject({ statusCode: 400 });
    expect(await resolvePublisherScope(fx.collegeId, erpRef(fx.principal.user))).toMatchObject({ kind: 'college', isAdmin: true, office: "Principal's Office" });
  });
});

describe('publish validation', () => {
  it('refuses an empty audience, a foreign attachment key, a welcome notice from a non-office, and bad bodies', async () => {
    const scope = await resolvePublisherScope(fx.collegeId, adminRef(fx));
    await expect(publishNotice(fx.collegeId, scope, body(), 'x')).rejects.toMatchObject({ statusCode: 400, message: 'This audience has no members' });
    await provisionTestStudent(fx);
    const foreign = { key: `colleges/${new Types.ObjectId()}/notices/abc`, name: 'a.pdf', mime: 'application/pdf', size: 10 };
    await expect(publishNotice(fx.collegeId, scope, body({ attachments: [foreign] }), 'x')).rejects.toMatchObject({ statusCode: 400 });
    const nested = { ...foreign, key: `colleges/${fx.collegeId}/notices/a/b` };
    await expect(publishNotice(fx.collegeId, scope, body({ attachments: [nested] }), 'x')).rejects.toMatchObject({ statusCode: 400 });
    const madeUp = { ...foreign, key: `${attachmentPrefix(fx.collegeId)}not-a-real-uuid` };
    await expect(publishNotice(fx.collegeId, scope, body({ attachments: [madeUp] }), 'x')).rejects.toMatchObject({ statusCode: 400 });
    const hod = await makeHod(fx, fx.cse);
    const hodScope = await resolvePublisherScope(fx.collegeId, erpRef(hod.user));
    await expect(publishNotice(fx.collegeId, hodScope, body({ purpose: 'welcome', audience: { rules: [{ kind: 'department', ids: [String(fx.cse._id)] }] } }), 'x')).rejects.toMatchObject({ statusCode: 403 });

    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: batchRule() }, ackDeadline: future }).success).toBe(false);          // deadline without ack
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: batchRule() }, ackRequired: true, ackDeadline: new Date(Date.now() - 1000).toISOString() }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: batchRule() }, ackCommentAllowed: true }).success).toBe(false);      // comments need an ack
    expect(publishSchema.safeParse({ title: 'x'.repeat(121), body: 'b', audience: { rules: batchRule() } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'x'.repeat(5001), audience: { rules: batchRule() } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: [{ kind: 'batch', ids: ['nope'] }] } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: [{ kind: 'batch', ids: [] }] } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: [{ kind: 'all', ids: ['x'] }] } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: [{ kind: 'role', ids: ['wizard'] }] } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: [] } }).success).toBe(false);
    expect(publishSchema.safeParse({ title: 't', body: 'b', audience: { rules: batchRule() }, attachments: Array(6).fill(foreign) }).success).toBe(false);
    expect(await Notice.countDocuments({ collegeId: fx.collegeId })).toBe(0);
  });

  it('restricts audience rule kind to exactly the nine spec kinds, at both the publish and preview boundary (R5)', () => {
    const rogue = { title: 't', body: 'b', audience: { rules: [{ kind: 'sorcery', ids: ['x'] }] } };
    expect(publishSchema.safeParse(rogue).success).toBe(false);
    expect(audiencePreviewSchema.safeParse({ rules: [{ kind: 'sorcery', ids: ['x'] }] }).success).toBe(false);
    // Every non-'all' kind requires at least one id.
    for (const kind of ['role', 'department', 'programme', 'batch', 'section', 'course_offering', 'hostel_block', 'custom']) {
      expect(audiencePreviewSchema.safeParse({ rules: [{ kind, ids: [] }] }).success).toBe(false);
    }
    expect(audiencePreviewSchema.safeParse({ rules: [{ kind: 'all', ids: [] }] }).success).toBe(true);
  });
});

describe('uploadAttachment', () => {
  const pdf = { buffer: Buffer.from('%PDF-1.4'), originalname: '../../Exam Timetable.pdf', mimetype: 'application/pdf', size: 8 };

  it('returns 503 when S3 is not configured', async () => {
    await expect(uploadAttachment(fx.collegeId, pdf)).rejects.toMatchObject({ statusCode: 503 });
    expect(s3.put).not.toHaveBeenCalled();
  });

  it('stores the file under colleges/<cid>/notices/<uuid> and returns the attachment record', async () => {
    s3.configured = true;
    const a = await uploadAttachment(fx.collegeId, pdf);
    expect(a.key).toMatch(new RegExp(`^colleges/${fx.collegeId}/notices/[0-9a-f-]{36}$`));
    expect(a).toMatchObject({ name: 'Exam Timetable.pdf', mime: 'application/pdf', size: 8 });
    expect(s3.put).toHaveBeenCalledWith(expect.objectContaining({ key: a.key, contentType: 'application/pdf' }));
  });

  it('refuses a type outside the list and a file over 10 MB', async () => {
    s3.configured = true;
    await expect(uploadAttachment(fx.collegeId, { ...pdf, mimetype: 'application/zip' })).rejects.toMatchObject({ statusCode: 400 });
    await expect(uploadAttachment(fx.collegeId, { ...pdf, size: 10 * 1024 * 1024 + 1 })).rejects.toMatchObject({ statusCode: 400 });
    expect(s3.put).not.toHaveBeenCalled();
  });
});

describe('sweeper', () => {
  it('re-emits the event for a notice stuck in publishing for more than 2 minutes, once', async () => {
    await provisionTestStudent(fx);
    const n = await Notice.create({
      collegeId: fx.collegeId, title: 'Stuck', body: 'b', publisher: { office: 'College Office' },
      audience: { rules: batchRule(), line: 'Sent to 2024 Batch' }, status: 'publishing',
    });
    expect(await sweepStuckNotices()).toBe(0);                                 // younger than 2 minutes
    await Notice.collection.updateOne({ _id: n._id }, { $set: { createdAt: new Date(Date.now() - 3 * 60_000) } });
    expect(await sweepStuckNotices()).toBe(1);
    expect(await sweepStuckNotices()).toBe(0);                                 // the dedupe key makes a re-emit a no-op
    await drainOutbox();
    expect((await Notice.findById(n._id).lean())!).toMatchObject({ status: 'published', counts: { audience: 1, onJuvi: 0 } });
  });
});

describe('fan-out partial failure (R7)', () => {
  afterAll(() => { __resetFanoutBatchSizeForTesting(); });

  it('a bulkWrite failure mid-batch leaves the notice publishing and backs the outbox event off; the retry fills only the gap without duplicating rows or changing counts', async () => {
    const people = [];
    for (let i = 0; i < 5; i += 1) people.push(await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) }));
    __setFanoutBatchSizeForTesting(2);

    const scope = await resolvePublisherScope(fx.collegeId, adminRef(fx));
    const notice = await publishNotice(fx.collegeId, scope, body({ audience: { rules: [{ kind: 'section', ids: [String(fx.cseSection._id)] }] } }), 'test');

    const realBulkWrite = NoticeRecipient.bulkWrite.bind(NoticeRecipient);
    const spy = vi.spyOn(NoticeRecipient, 'bulkWrite')
      .mockImplementationOnce(realBulkWrite as unknown as typeof NoticeRecipient.bulkWrite)
      .mockImplementationOnce(() => Promise.reject(new Error('simulated bulkWrite failure')));

    await drainOutbox();   // batch 1 (2 rows) succeeds; batch 2 rejects, so fanOutNotice throws before batch 3 or the status update

    expect((await Notice.findById(notice._id).lean())!.status).toBe('publishing');
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id })).toBe(2);
    const event = await OutboxEvent.findOne({ dedupeKey: `notice:${notice._id}:published` }).lean();
    expect(event).toMatchObject({ status: 'pending', attempts: 1 });

    spy.mockRestore();
    await fanOutNotice({ collegeId: fx.collegeId, noticeId: String(notice._id) });   // the retry: real bulkWrite, fills only the gap

    const rows = await NoticeRecipient.find({ noticeId: notice._id }).lean();
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => String(r.personId))).size).toBe(5);   // no duplicates
    expect((await Notice.findById(notice._id).lean())!).toMatchObject({ status: 'published', counts: { audience: 5, onJuvi: 0 } });
  });
});

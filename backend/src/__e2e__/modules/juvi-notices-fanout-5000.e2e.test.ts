import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi } from '../factories/juvi.factory';
import { adminRef } from '../factories/notice.factory';
import { Person, Student } from '../../models';
import { User } from '../../models/User';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { drainOutbox } from '../../shared/outbox';
import { resolvePublisherScope } from '../../modules/juvi-app/notices/publisher-scope';
import { publishNotice } from '../../modules/juvi-app/notices/publish-service';
import { publishSchema } from '../../modules/juvi-app/notices/admin-schemas';

const N = 5000;
const ON_JUVI = 250;
let fx: BaseFixtures;

beforeAll(async () => {
  await getTestApp();
  await cleanupTestApp();
  fx = await seedBase();
  await enableJuvi(fx.collegeId);
  // Native inserts: the point is the fan-out, not 5,000 model saves.
  const cid = new Types.ObjectId(fx.collegeId);
  const persons = Array.from({ length: N }, (_, i) => ({ _id: new Types.ObjectId(), collegeId: cid, name: `Student ${i}`, phone: `91${String(i).padStart(8, '0')}` }));
  await Person.collection.insertMany(persons);
  const students = persons.map((p, i) => ({
    _id: new Types.ObjectId(), collegeId: cid, personId: p._id, admissionYear: 2024, rollNumber: `24BULK${String(i).padStart(5, '0')}`,
    status: 'active', batchId: fx.batch._id, branchId: fx.cseBranch._id, programmeId: fx.btech._id,
  }));
  await Student.collection.insertMany(students);
  const users = persons.slice(0, ON_JUVI).map((p, i) => ({
    _id: new Types.ObjectId(), collegeId: cid, personId: p._id, email: `bulk${i}@test.com`, password: 'x', name: p.name,
    role: 'student', personaType: 'L-STU', personas: ['L-STU'], isActive: true, tokenVersion: 0,
  }));
  await User.collection.insertMany(users);
  await JuviAccount.collection.insertMany(users.map((u, i) => ({
    collegeId: cid, personId: u.personId, userId: u._id, kind: 'student', studentId: students[i]!._id, status: 'active',
    onboardingStep: 3, transitions: [], provisionedAt: new Date(), provisionedBy: 'test', createdAt: new Date(), updatedAt: new Date(),
  })));
}, 120_000);

afterAll(async () => { await drainOutbox(); await cleanupTestApp(); });

describe('fan-out at scale (spec §4 US-1.3)', () => {
  it('delivers a 5,000-member audience in under 60 seconds with exact counts', { timeout: 120_000 }, async () => {
    const scope = await resolvePublisherScope(fx.collegeId, adminRef(fx));
    const started = Date.now();
    const notice = await publishNotice(fx.collegeId, scope, publishSchema.parse({
      title: 'Semester begins', body: 'Classes start on Monday.', ackRequired: true,
      audience: { rules: [{ kind: 'batch', ids: [String(fx.batch._id)] }] },
    }), 'College Admin');
    await drainOutbox();
    const elapsed = Date.now() - started;
    console.log(`FANOUT-5000 elapsed=${elapsed}ms`);

    expect((await Notice.findById(notice._id).lean())!).toMatchObject({ status: 'published', counts: { audience: N, onJuvi: ON_JUVI } });
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id })).toBe(N);
    expect(await NoticeRecipient.countDocuments({ noticeId: notice._id, accountId: { $ne: null }, receivedAt: { $ne: null } })).toBe(ON_JUVI);
    expect(elapsed).toBeLessThan(60_000);
  });
});

import { Types } from 'mongoose';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { enableJuvi, mobileClient, provisionTestStudent } from '../factories/juvi.factory';
import { activateAccount, signInAs } from '../factories/notice.factory';
import { Invoice } from '../../models/finance/Invoice';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';

process.env.E2E_TESTING = '1';

let app: Express;
let fx: BaseFixtures;

beforeAll(async () => { app = await getTestApp(); });
beforeEach(async () => { await cleanupTestApp(); fx = await seedBase(); await enableJuvi(fx.collegeId); });
afterAll(async () => { await cleanupTestApp(); });

const V1 = '/api/juvi-app/v1';

describe('GET /v1/attention', () => {
  it('kinds=all carries fee_due items and counts every item', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    await Invoice.create({
      collegeId: new Types.ObjectId(fx.collegeId), studentId: new Types.ObjectId(String(s.student._id)),
      invoiceNumber: 'EAI-1', type: 'fee', totalAmount: 5000,
      dueDate: new Date(Date.now() + 3 * 86_400_000), status: 'sent',
    });
    const token = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, token).get(`${V1}/attention?kinds=all`).expect(200);
    expect(res.body.dueCount).toBeGreaterThanOrEqual(1);
    expect(res.body.items.some((i: { kind: string }) => i.kind === 'fee_due')).toBe(true);
  });

  it('without kinds the legacy shape is returned: notice cards only', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const notice = await Notice.create({
      collegeId: new Types.ObjectId(fx.collegeId), title: 'Library closes early', body: 'At 5pm on Friday.',
      publisher: { personId: new Types.ObjectId(String(s.person._id)), userId: new Types.ObjectId(String(s.account._id)), office: 'Library' },
      audience: { rules: [], line: 'Everyone' },
      ackRequired: true, status: 'published', publishedAt: new Date(),
    });
    await NoticeRecipient.create({
      collegeId: new Types.ObjectId(fx.collegeId), noticeId: notice._id, personId: new Types.ObjectId(String(s.person._id)),
      accountId: new Types.ObjectId(String(s.account._id)), kind: 'student', ackRequired: true, receivedAt: new Date(),
    });
    const token = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, token).get(`${V1}/attention`).expect(200);
    expect(res.body.items.every((i: { kind: string }) => i.kind === 'notice')).toBe(true);
    expect(res.body.items[0]).toHaveProperty('preview');
  });

  it('kinds other than all is 400 VALIDATION_FAILED (R31) and unauthenticated is 401', async () => {
    const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
    await activateAccount(String(s.account._id));
    const token = await signInAs(app, fx, s.student.rollNumber, s.tempPassword);
    const res = await mobileClient(app, token).get(`${V1}/attention?kinds=fees`).expect(400);
    expect(res.body.error.message).toBe('kinds must be "all"');
    await mobileClient(app).get(`${V1}/attention?kinds=all`).expect(401);
  });
});

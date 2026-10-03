import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { NotificationDelivery } from '../NotificationDelivery';
import { JuviEvent } from '../JuviEvent';
import { Notice } from '../Notice';
import { MobileSession } from '../MobileSession';

const oid = () => new Types.ObjectId();
const keys = (model: { schema: { indexes(): [Record<string, unknown>, Record<string, unknown>][] } }) => model.schema.indexes();
const delivery = (extra: Record<string, unknown> = {}) => ({
  collegeId: oid(), accountId: oid(), source: { type: 'notice', id: oid(), kind: 'published' },
  tier: 'important', status: 'scheduled', batchKey: 'office:Exam Section', groupKey: 'notice:x', sendAfter: new Date(), ...extra,
});
const notice = (extra: Record<string, unknown> = {}) => ({
  collegeId: oid(), title: 'Exam timetable', body: 'See attached.',
  publisher: { personId: oid(), userId: oid(), office: 'Exam Section' },
  audience: { rules: [{ kind: 'batch', ids: [String(oid())] }], line: 'Sent to 2024 batch' }, ...extra,
});

describe('NotificationDelivery (spec §4.1)', () => {
  it('defaults the timestamps, attempts, reason, error and lease to empty', () => {
    const doc = new NotificationDelivery(delivery());
    expect(doc.validateSync()).toBeUndefined();
    expect(doc).toMatchObject({ reason: null, sentAt: null, deliveredAt: null, openedAt: null, attempts: 0, lastError: null, lockedUntil: null });
  });

  it('rejects unknown tiers, statuses, reasons and source kinds', () => {
    expect(new NotificationDelivery(delivery({ tier: 'loud' })).validateSync()?.errors.tier).toBeDefined();
    expect(new NotificationDelivery(delivery({ status: 'queued' })).validateSync()?.errors.status).toBeDefined();
    expect(new NotificationDelivery(delivery({ reason: 'busy' })).validateSync()?.errors.reason).toBeDefined();
    expect(new NotificationDelivery(delivery({ source: { type: 'notice', id: oid(), kind: 'reminder-3' } })).validateSync()?.errors['source.kind']).toBeDefined();
  });

  it('declares the four spec indexes, the source key unique', () => {
    expect(keys(NotificationDelivery)).toEqual(expect.arrayContaining([
      [{ 'source.type': 1, 'source.id': 1, 'source.kind': 1, accountId: 1 }, expect.objectContaining({ unique: true })],
      [{ status: 1, sendAfter: 1 }, expect.anything()],
      [{ collegeId: 1, 'source.id': 1, status: 1 }, expect.anything()],
      [{ accountId: 1, batchKey: 1, status: 1 }, expect.anything()],
    ]));
  });
});

describe('JuviEvent (spec §4.2)', () => {
  it('expires 400 days after receipt', () => {
    expect(keys(JuviEvent)).toContainEqual([{ receivedAt: 1 }, expect.objectContaining({ expireAfterSeconds: 400 * 86_400 })]);
    const doc = new JuviEvent({ collegeId: oid(), accountId: oid(), name: 'app.opened', at: new Date() });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.receivedAt).toBeInstanceOf(Date);
    expect(doc.props).toEqual({});
  });
});

describe('Notice.confidential and Notice.urgentReason (spec §4.2, §6.5)', () => {
  it('defaults to not confidential with no reason', () => {
    const doc = new Notice(notice());
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.confidential).toBe(false);
    expect(doc.urgentReason).toBeNull();
  });

  it('a new Urgent notice needs a reason of 10 to 300 characters', async () => {
    await expect(new Notice(notice({ priority: 'urgent' })).validate()).rejects.toThrow(/needs a reason/);
    await expect(new Notice(notice({ priority: 'urgent', urgentReason: 'too short' })).validate()).rejects.toThrow(/needs a reason/);
    await expect(new Notice(notice({ priority: 'urgent', urgentReason: 'x'.repeat(301) })).validate()).rejects.toThrow();
    await expect(new Notice(notice({ priority: 'urgent', urgentReason: 'Exam postponed by the university' })).validate()).resolves.toBeUndefined();
  });
});

describe('MobileSession.pushToken (spec §4.2)', () => {
  // A declaration check, not a database one: the move-between-sessions behaviour is covered over HTTP in juvi-notifications-mobile.e2e.test.ts.
  it('is unique among sessions that hold a token, so sessions without one never collide', () => {
    expect(keys(MobileSession)).toContainEqual([
      { pushToken: 1 }, expect.objectContaining({ unique: true, partialFilterExpression: { pushToken: { $type: 'string' } } }),
    ]);
  });
});

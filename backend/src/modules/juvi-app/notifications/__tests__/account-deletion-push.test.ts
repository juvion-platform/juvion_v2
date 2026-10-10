import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clearCollections, setupMongo, teardownMongo } from '../../../../__tests__/helpers/mongoMemory';
import { JuviAccount } from '../../../../models/juvi/JuviAccount';
import { MobileSession } from '../../../../models/juvi/MobileSession';
import { NotificationDelivery } from '../../../../models/juvi/NotificationDelivery';
import { OutboxEvent } from '../../../../shared/outbox/OutboxEvent';
import { drainOutbox } from '../../../../shared/outbox';
import type { PushMessage, PushTransport } from '../transport';
import { registerNotificationConsumers } from '../index';
import { runSender } from '../sender';
import {
  ACCOUNT_DELETION_KIND, requestAccountDeletionNotification,
} from '../account-deletion';

/**
 * 011-account-deletion T10 — notifying the owner, best-effort by design (§3.5.2).
 *
 * The spec is explicit that delivery is **not** promised, and the reason matters: the person who
 * uninstalled the app is precisely the public path's audience, and that person has no live device.
 * So the tests below are written the other way round from a normal notification suite — the case
 * that must not break anything is the one where nothing can be delivered.
 *
 * No `College` document, so `getJuviConfig` falls back to Asia/Kolkata. `NOW` is 09:30 IST, outside
 * the default 22:00–07:00 quiet hours, so a scheduled row is due in the same pass.
 */

const NOW = new Date('2026-11-10T04:00:00.000Z');
const oid = () => new Types.ObjectId();

/** Records every message it is handed, so "no push" is assertable as well as "this push". */
function spyTransport(): PushTransport & { sent: PushMessage[] } {
  const sent: PushMessage[] = [];
  return {
    name: 'fake', sent,
    async send(tokens, message) { sent.push(message); return tokens.map((token) => ({ token, ok: true })); },
  };
}

async function seedAccount(opts: { device?: boolean; requested?: boolean; requestedAt?: Date } = {}) {
  const collegeId = oid();
  const account = await JuviAccount.create({
    collegeId, personId: oid(), userId: oid(), kind: 'student', provisionedBy: 'test',
    // Requested two days before NOW, so `graceDays` has a value the test can compute by hand.
    ...(opts.requested === false ? {} : { deletionRequestedAt: opts.requestedAt ?? new Date(NOW.getTime() - 2 * 86_400_000), deletionRequestedVia: 'public_web' }),
  });
  if (opts.device) {
    await MobileSession.create({
      collegeId, accountId: account._id, userId: oid(), role: 'student', kind: 'student',
      deviceId: 'device-1', deviceName: 'Phone', platform: 'android', appVersion: '1.0.0', osVersion: '14',
      refreshTokenHash: 'x'.repeat(64), refreshExpiresAt: new Date(NOW.getTime() + 86_400_000),
      pushToken: 'tok-1', lastActiveAt: NOW,
    });
  }
  return { collegeId, account };
}

const rows = (collegeId: Types.ObjectId) => NotificationDelivery.find({ collegeId }).lean();

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
beforeEach(() => { registerNotificationConsumers(); });
afterEach(async () => { await clearCollections(); });

describe('account-deletion notification (011 T10)', () => {
  it('expands to exactly one Important row addressed to that account', async () => {
    const { collegeId, account } = await seedAccount();

    expect(await requestAccountDeletionNotification(String(collegeId), String(account._id))).toBe(true);
    // Drain events without the sender pass: each test's explicit runSender is the only send pass.
    await drainOutbox({ afterEvents: false });

    const all = await rows(collegeId);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ tier: 'important', status: 'scheduled', reason: null });
    expect(String(all[0]!.accountId)).toBe(String(account._id));
    // The source is the account itself: a deletion request has no other document to point at.
    expect(all[0]!.source).toMatchObject({ type: 'account_deletion', kind: ACCOUNT_DELETION_KIND });
    expect(String(all[0]!.source.id)).toBe(String(account._id));
  });

  it('never notifies twice for one account', async () => {
    const { collegeId, account } = await seedAccount();

    expect(await requestAccountDeletionNotification(String(collegeId), String(account._id))).toBe(true);
    // A repeat request while one is pending must not become a way to make someone's phone buzz
    // (the transition guard is what stops the second call reaching here at all; this is the
    // notification stack's own backstop, which also holds when the OutboxEvent has aged out).
    expect(await requestAccountDeletionNotification(String(collegeId), String(account._id))).toBe(false);
    await drainOutbox({ afterEvents: false });

    expect((await rows(collegeId)).length).toBe(1);
    expect(await OutboxEvent.countDocuments({ type: 'notification.requested' })).toBe(1);
  });

  it('suppresses a device-less account rather than failing anything — the public path\'s own case', async () => {
    const { collegeId, account } = await seedAccount({ device: false });
    const transport = spyTransport();
    await requestAccountDeletionNotification(String(collegeId), String(account._id));
    await drainOutbox({ afterEvents: false });

    const stats = await runSender(NOW, transport);

    expect(stats.noDevice).toBe(1);
    expect(transport.sent).toHaveLength(0);
    const row = (await rows(collegeId))[0]!;
    expect(row.status).toBe('suppressed');
    expect(row.reason).toBe('no_device');
    // The surfaces the spec calls dependable are untouched by the push's absence: the request is
    // still scheduled, so the sweep will still run and the ERP record still shows it.
    const account2 = await JuviAccount.findById(account._id).lean();
    expect(account2!.deletionRequestedAt).toBeInstanceOf(Date);
  });

  it('cancels a row whose request was cleared before the send, and sends nothing', async () => {
    const { collegeId, account } = await seedAccount({ device: true });
    const transport = spyTransport();
    await requestAccountDeletionNotification(String(collegeId), String(account._id));
    await drainOutbox({ afterEvents: false });

    // The owner signed in, or changed their password, in the window between scheduling and sending.
    await JuviAccount.updateOne({ _id: account._id }, { $unset: { deletionRequestedAt: 1, deletionRequestedVia: 1 } });
    await runSender(NOW, transport);

    expect(transport.sent).toHaveLength(0);
    const row = (await rows(collegeId))[0]!;
    expect(row.status).toBe('cancelled');
    expect(row.reason).toBe('superseded');
  });

  it('schedules nothing when the request was cleared, or the account deleted, before the drain', async () => {
    // The event is durable the moment it is emitted, so both races are real: the owner signs in
    // again and the request is dropped, or they delete immediately from inside the app. Neither may
    // produce a row that would later announce a deletion nobody is doing.
    const cleared = await seedAccount();
    await requestAccountDeletionNotification(String(cleared.collegeId), String(cleared.account._id));
    await JuviAccount.updateOne({ _id: cleared.account._id }, { $unset: { deletionRequestedAt: 1, deletionRequestedVia: 1 } });
    await drainOutbox({ afterEvents: false });
    expect(await rows(cleared.collegeId)).toHaveLength(0);

    const gone = await seedAccount();
    await requestAccountDeletionNotification(String(gone.collegeId), String(gone.account._id));
    await JuviAccount.deleteOne({ _id: gone.account._id });
    await drainOutbox({ afterEvents: false });
    expect(await rows(gone.collegeId)).toHaveLength(0);
  });

  it('never promises a negative window: a row sent past its deadline says zero days', async () => {
    // Reachable: a row that failed transiently is retried with backoff, so the send can land days
    // after the deadline it was scheduled against. "in -2 days" is not a thing the app can render.
    const { collegeId, account } = await seedAccount({ device: true, requestedAt: new Date(NOW.getTime() - 9 * 86_400_000) });
    const transport = spyTransport();
    await requestAccountDeletionNotification(String(collegeId), String(account._id));
    await drainOutbox({ afterEvents: false });

    await runSender(NOW, transport);

    expect(transport.sent[0]!.data.graceDays).toBe('0');
  });

  it('sends one data message carrying opaque ids and no identifier', async () => {
    const { collegeId, account } = await seedAccount({ device: true });
    const transport = spyTransport();
    await requestAccountDeletionNotification(String(collegeId), String(account._id));
    await drainOutbox({ afterEvents: false });

    const stats = await runSender(NOW, transport);

    expect(stats.sent).toBe(1);
    const message = transport.sent[0]!;
    expect(message.data.kind).toBe('account_deletion');
    expect(message.data.deliveryId).toBeTruthy();
    expect(message.data.receipt).toBeTruthy();
    expect(message.priority).toBe('high');
    // The days left at send time, counted from the request: seven minus the two already elapsed.
    expect(message.data.graceDays).toBe('5');
    // Every value is a string (transport/types.ts:8-13), and nothing here names a person: the
    // payload carries no e-mail, roll number, user id or account id.
    expect(Object.values(message.data).every((v) => typeof v === 'string')).toBe(true);
    const blob = JSON.stringify(message);
    expect(blob).not.toContain(String(account._id));
    expect(blob).not.toContain(String(account.userId));
  });
});

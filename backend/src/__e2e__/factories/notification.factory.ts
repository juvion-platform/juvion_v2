// backend/src/__e2e__/factories/notification.factory.ts
import type { Express } from 'express';
import { Types } from 'mongoose';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { MobileSession } from '../../models/juvi/MobileSession';
import { NotificationDelivery, LeanNotificationDelivery } from '../../models/juvi/NotificationDelivery';
import type { BaseFixtures } from '../setup/seed-base';
import { provisionTestStudent } from './juvi.factory';
import { activateAccount, signInAs } from './notice.factory';

let deviceCounter = 0;

/**
 * A batch student on Juvi (active), signed in on a fresh device, with an empty quiet-hours
 * window so the test does not depend on the time of day. `pushToken` registers that device.
 */
export async function studentOnJuvi(app: Express, fx: BaseFixtures, opts: { pushToken?: string } = {}) {
  const s = await provisionTestStudent(fx, { sectionId: String(fx.cseSection._id) });
  await activateAccount(String(s.account._id));
  await JuviAccount.updateOne({ _id: s.account._id }, { $set: { 'settings.quietHours': { start: '00:00', end: '00:00' } } });
  deviceCounter += 1;
  const deviceId = `notif-device-${deviceCounter}`;
  const accessToken = await signInAs(app, fx, s.student.rollNumber, s.tempPassword, deviceId);
  if (opts.pushToken) await MobileSession.updateOne({ accountId: s.account._id, deviceId, revokedAt: null }, { $set: { pushToken: opts.pushToken } });
  return { ...s, accessToken, deviceId };
}

/** Quiet hours from one hour before to one hour after `now`, in the college timezone (Asia/Kolkata unless configured). */
export function quietHoursAround(now: Date, timeZone = 'Asia/Kolkata'): { start: string; end: string } {
  const hh = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return { start: hh(new Date(now.getTime() - 3_600_000)), end: hh(new Date(now.getTime() + 3_600_000)) };
}

export async function deliveriesFor(noticeId: unknown, kind = 'published'): Promise<LeanNotificationDelivery[]> {
  return NotificationDelivery.find({ 'source.id': new Types.ObjectId(String(noticeId)), 'source.kind': kind }).sort({ _id: 1 }).lean<LeanNotificationDelivery[]>();
}

export async function deliveryOf(noticeId: unknown, accountId: unknown, kind = 'published'): Promise<LeanNotificationDelivery | null> {
  return NotificationDelivery.findOne({ 'source.id': new Types.ObjectId(String(noticeId)), 'source.kind': kind, accountId: new Types.ObjectId(String(accountId)) })
    .lean<LeanNotificationDelivery>();
}

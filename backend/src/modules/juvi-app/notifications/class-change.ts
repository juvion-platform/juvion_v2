// backend/src/modules/juvi-app/notifications/class-change.ts
/**
 * Today&Teaching §8 request side: the class.exception.changed consumer. It
 * decides whether the affected date (original, plus the new date of a
 * reschedule) is today or tomorrow in the college timezone, sets the tier
 * (urgent when the original start is today and within 2 hours) and records the
 * notification request. Audience expansion lives in expand-consumer.ts
 * (expandClassChange); the send-time re-check lives in sender.ts.
 */
import { Types } from 'mongoose';
import { ClassException, LeanClassException } from '../../../models/academic-ops/ClassException';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { NotificationTier } from '../../../models/juvi/NotificationDelivery';
import { emit, OutboxPayload } from '../../../shared/outbox';
import { addDays, instantOf, ymd } from '../../academics/timetable-date';
import { CLASS_EVENTS } from '../../academics/class-exception-service';
import { URGENT_WINDOW_MS } from '../../academics/push-tier';
import { getJuviConfig } from '../config/institution-config';
import { NOTIFICATION_REQUESTED } from './expand-consumer';

export const CLASS_CHANGE_EVENT = CLASS_EVENTS.CHANGED; // 'class.exception.changed'

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * The affected dates of an exception (§8): the original date, and for a
 * reschedule also the new date — under both announce and revoke.
 */
function affectedDates(e: LeanClassException): string[] {
  return e.type === 'rescheduled' && e.newDate ? [e.date, e.newDate] : [e.date];
}

/**
 * §8 tier, decided on announce: urgent when the original class start is today in
 * the college timezone and lies within 2 hours of now; important otherwise. A
 * revoke is always important.
 */
async function tierOf(collegeId: string, e: LeanClassException, tz: string): Promise<NotificationTier> {
  const todayDate = ymd(new Date(), tz);
  if (e.date !== todayDate) return 'important';
  const slot = await TimetableSlot.findOne({ _id: e.timetableSlotId, collegeId }).select('startTime').lean<{ startTime: string } | null>();
  if (!slot) return 'important';
  const delta = instantOf(e.date, slot.startTime, tz).getTime() - new Date().getTime();
  return delta > 0 && delta <= URGENT_WINDOW_MS ? 'urgent' : 'important';
}

/** Records notification.requested for a class change; idempotent on its dedupe key. */
export function requestClassChangeNotification(collegeId: string, exceptionId: string, action: 'created' | 'revoked', tier: NotificationTier): Promise<boolean> {
  const source = { type: 'class_change', id: exceptionId, kind: action, tier };
  return emit(NOTIFICATION_REQUESTED, { collegeId, source }, `notif:class_change:${exceptionId}:${action}`);
}

/** The consumer registered for class.exception.changed (Today&Teaching §8). */
export async function onClassChanged(payload: OutboxPayload): Promise<void> {
  const collegeId = payload.collegeId;
  const exceptionId = typeof payload.exceptionId === 'string' ? payload.exceptionId : '';
  const action: 'created' | 'revoked' = payload.action === 'revoked' ? 'revoked' : 'created';
  if (!Types.ObjectId.isValid(exceptionId)) return;
  const e = await ClassException.findOne({ _id: exceptionId, collegeId }).lean<LeanClassException | null>();
  if (!e) return; // a re-run after a rollback: nothing to notify about
  const tz = (await getJuviConfig(collegeId))?.timezone ?? DEFAULT_TIMEZONE;
  const todayDate = ymd(new Date(), tz);
  const tomorrowDate = addDays(todayDate, 1);
  if (!affectedDates(e).some((d) => d === todayDate || d === tomorrowDate)) return;
  const tier = action === 'created' ? await tierOf(collegeId, e, tz) : 'important';
  await requestClassChangeNotification(collegeId, exceptionId, action, tier);
}

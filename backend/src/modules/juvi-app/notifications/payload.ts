/**
 * The FCM data message for a notice (notifications spec §6.6, NFR-05). Pure.
 * Only opaque ids, the office and — for a single, non-confidential notice — the
 * title. Never the body, attachments, names, roll numbers, deadlines or audience.
 */
import type { NotificationTier } from '../../../models/juvi/NotificationDelivery';
import type { PushMessage } from './transport';

export interface NoticePushInput {
  deliveryId: string;
  receipt: string;
  /** The newest notice of a Routine batch. */
  noticeId: string;
  tier: NotificationTier;
  groupKey: string;
  office: string;
  title: string;
  confidential: boolean;
  variant: 'published' | 'reminder';
  /** Notices in this notification: more than 1 only for a Routine batch. */
  count: number;
}

export function buildNoticePush(i: NoticePushInput): PushMessage {
  const data: Record<string, string> = {
    deliveryId: i.deliveryId, receipt: i.receipt, kind: 'notice', noticeId: i.noticeId, tier: i.tier,
    groupKey: i.groupKey, office: i.office, variant: i.variant, count: String(i.count),
  };
  // A confidential notice renders "New notice from <office>"; a batch renders "<count> new notices from <office>".
  if (!i.confidential && i.count === 1) data.title = i.title;
  return { data, priority: i.tier === 'routine' ? 'normal' : 'high', collapseKey: i.groupKey };
}

export interface ClassChangePushInput {
  deliveryId: string;
  receipt: string;
  exceptionId: string;
  tier: NotificationTier;
  groupKey: string;
  office: string;
  variant: 'cancelled' | 'rescheduled' | 'restored';
  /** The original class start as an ISO instant. */
  when: string;
  /** For a reschedule: the new class start as an ISO instant. */
  newWhen?: string;
}

/**
 * The §8 push (NFR-05). Only opaque ids, the course code as the office, the when
 * instants and the variant — the reason never goes out, and a restore announces
 * itself by the restored variant alone.
 */
export function buildClassChangePush(i: ClassChangePushInput): PushMessage {
  const data: Record<string, string> = {
    deliveryId: i.deliveryId, receipt: i.receipt, kind: 'class_change', exceptionId: i.exceptionId,
    tier: i.tier, groupKey: i.groupKey, office: i.office, variant: i.variant, when: i.when,
  };
  if (i.newWhen) data.newWhen = i.newWhen;
  return { data, priority: i.tier === 'routine' ? 'normal' : 'high', collapseKey: i.groupKey };
}

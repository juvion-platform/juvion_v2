import { Schema, model, Document, Types } from 'mongoose';

export type NotificationTier = 'urgent' | 'important' | 'routine';
export type DeliveryStatus = 'suppressed' | 'scheduled' | 'sent' | 'delivered' | 'opened' | 'cancelled' | 'failed';
/** `superseded` and `already_started` are class-change send-time cancellations (Today&Teaching §8). */
export type DeliveryReason = 'muted' | 'tier_off' | 'no_device' | 'acknowledged' | 'dismissed' | 'archived' | 'superseded' | 'already_started';
/** `created` and `revoked` are class-change notification kinds (Today&Teaching §8). */
export type NotificationSourceKind = 'published' | 'reminder-1' | 'reminder-2' | 'created' | 'revoked';

export const NOTIFICATION_TIERS: readonly NotificationTier[] = ['urgent', 'important', 'routine'];
export const DELIVERY_STATUSES: readonly DeliveryStatus[] = ['suppressed', 'scheduled', 'sent', 'delivered', 'opened', 'cancelled', 'failed'];
export const DELIVERY_REASONS: readonly DeliveryReason[] = ['muted', 'tier_off', 'no_device', 'acknowledged', 'dismissed', 'archived', 'superseded', 'already_started'];
export const NOTIFICATION_SOURCE_KINDS: readonly NotificationSourceKind[] = ['published', 'reminder-1', 'reminder-2', 'created', 'revoked'];

/** `class_change` (Today&Teaching §8): id is the exception id, kind is created|revoked. Sub-project 5 adds `post` and `mention` to `type`. */
export interface INotificationSource { type: 'notice' | 'class_change'; id: Types.ObjectId; kind: NotificationSourceKind }

/**
 * One row per person per notification (notifications spec §4.1). The unique
 * (source, accountId) key makes expansion idempotent; `status` only moves
 * forward, except that `scheduled` can become `cancelled`. `lastError` holds a
 * transport error code, never the payload.
 */
export interface INotificationDelivery extends Document {
  collegeId: Types.ObjectId;
  accountId: Types.ObjectId;
  source: INotificationSource;
  tier: NotificationTier;
  status: DeliveryStatus;
  reason: DeliveryReason | null;
  batchKey: string;
  groupKey: string;
  sendAfter: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  attempts: number;
  lastError: string | null;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INotificationDelivery>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'JuviAccount', required: true },
    source: {
      type: { type: String, enum: ['notice', 'class_change'], required: true },
      id: { type: Schema.Types.ObjectId, required: true },
      kind: { type: String, enum: NOTIFICATION_SOURCE_KINDS, required: true },
    },
    tier: { type: String, enum: NOTIFICATION_TIERS, required: true },
    status: { type: String, enum: DELIVERY_STATUSES, required: true },
    reason: { type: String, enum: [...DELIVERY_REASONS, null], default: null },
    batchKey: { type: String, required: true },
    groupKey: { type: String, required: true },
    sendAfter: { type: Date, required: true },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: null },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

// Expansion idempotency, the sender's scan, Reach, and digest windows (spec §4.1).
schema.index({ 'source.type': 1, 'source.id': 1, 'source.kind': 1, accountId: 1 }, { unique: true });
schema.index({ status: 1, sendAfter: 1 });
// The sender's Urgent-first claim, which must not walk a backlog of overdue Important rows.
schema.index({ status: 1, tier: 1, sendAfter: 1 });
schema.index({ collegeId: 1, 'source.id': 1, status: 1 });
schema.index({ accountId: 1, batchKey: 1, status: 1 });

/** A lean read of a NotificationDelivery: fields only, no Document methods. */
export type LeanNotificationDelivery = Omit<INotificationDelivery, keyof Document> & { _id: Types.ObjectId };

export const NotificationDelivery = model<INotificationDelivery>('NotificationDelivery', schema);

/**
 * Delivery receipts (notifications spec §7.2). A receipt is
 * `base64url(HMAC-SHA256(key, deliveryId + '.' + expiry)) + '.' + expiry`, expiry in
 * Unix seconds seven days after sending. It authorises exactly one row, so the
 * app can post `delivered` from a background isolate with no live session.
 */
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { NotificationDelivery, LeanNotificationDelivery } from '../../../models/juvi/NotificationDelivery';

export const RECEIPT_TTL_MS = 7 * 86_400_000;

/** JUVI_RECEIPT_KEY, or in development an HKDF derivation of JWT_SECRET (production requires the key; see startup-guard.ts). */
export function receiptKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  if (env.JUVI_RECEIPT_KEY) return Buffer.from(env.JUVI_RECEIPT_KEY, 'utf8');
  return Buffer.from(hkdfSync('sha256', env.JWT_SECRET || 'dev-secret', '', 'juvi-receipt-v1', 32));
}

const mac = (key: Buffer, deliveryId: string, expiry: string) => createHmac('sha256', key).update(`${deliveryId}.${expiry}`).digest();

export function signReceipt(deliveryId: string, expiresAt: Date, key: Buffer = receiptKey()): string {
  const expiry = String(Math.floor(expiresAt.getTime() / 1000));
  return `${mac(key, deliveryId, expiry).toString('base64url')}.${expiry}`;
}

export function verifyReceipt(deliveryId: string, receipt: string, now: Date = new Date(), key: Buffer = receiptKey()): boolean {
  const dot = receipt.lastIndexOf('.');
  if (dot <= 0) return false;
  const given = Buffer.from(receipt.slice(0, dot), 'base64url');
  const expiry = receipt.slice(dot + 1);
  if (!/^\d{1,12}$/.test(expiry) || Number(expiry) * 1000 < now.getTime()) return false;
  const expected = mac(key, deliveryId, expiry);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface ReceiptInput { deliveryId: string; receipt: string; event: 'delivered' | 'opened'; at: string }

/**
 * Applies one verified receipt. The receipt carries no collegeId, so the row is
 * found by its id (the HMAC is the authorisation) and every write is scoped by the
 * row's own collegeId. Status only moves forward; `at` is clamped to [sentAt, now].
 * A Routine digest went out as one notification for several rows (same account,
 * batch key and sentAt), so its receipt moves all of them.
 */
async function applyReceipt(item: ReceiptInput, now: Date): Promise<void> {
  const row = await NotificationDelivery.findById(item.deliveryId).select('collegeId accountId batchKey tier sentAt').lean<LeanNotificationDelivery>();
  if (!row?.sentAt) return;
  const at = new Date(Math.min(Math.max(new Date(item.at).getTime(), row.sentAt.getTime()), now.getTime()));
  const scope = row.tier === 'routine'
    ? { collegeId: row.collegeId, accountId: row.accountId, batchKey: row.batchKey, tier: 'routine', sentAt: row.sentAt }
    : { _id: row._id, collegeId: row.collegeId };
  if (item.event === 'delivered') {
    await NotificationDelivery.updateMany({ ...scope, status: 'sent' }, { $set: { status: 'delivered', deliveredAt: at } });
  } else {
    // `openedAt` implies `deliveredAt`: back-filled with the opened time when no delivered receipt arrived.
    await NotificationDelivery.updateMany(
      { ...scope, status: { $in: ['sent', 'delivered'] } },
      [{ $set: { status: 'opened', openedAt: at, deliveredAt: { $ifNull: ['$deliveredAt', at] } } }],
    );
  }
}

/** Verifies and applies each item; a bad or expired receipt is skipped and counted as rejected. */
export async function applyReceipts(items: ReceiptInput[], now: Date = new Date()): Promise<{ accepted: number; rejected: number }> {
  let accepted = 0;
  for (const item of items) {
    if (!Types.ObjectId.isValid(item.deliveryId) || !verifyReceipt(item.deliveryId, item.receipt, now)) continue;
    accepted += 1;
    await applyReceipt(item, now);
  }
  return { accepted, rejected: items.length - accepted };
}

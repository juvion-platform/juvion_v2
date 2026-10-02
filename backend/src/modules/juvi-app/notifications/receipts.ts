/**
 * Delivery receipts (notifications spec §7.2). A receipt is
 * `base64url(HMAC-SHA256(key, deliveryId + '.' + expiry)) + '.' + expiry`, expiry in
 * Unix seconds seven days after sending. It authorises exactly one row, so the
 * app can post `delivered` from a background isolate with no live session.
 */
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

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

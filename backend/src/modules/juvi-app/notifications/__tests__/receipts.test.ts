import { describe, it, expect } from 'vitest';
import { signReceipt, verifyReceipt, receiptKey, RECEIPT_TTL_MS } from '../receipts';

const key = Buffer.from('k'.repeat(32));
const now = new Date('2026-10-02T12:00:00Z');
const id = '6a1b2c3d4e5f6a7b8c9d0e1f';

describe('receipt tokens (spec §7.2)', () => {
  it('is base64url(HMAC-SHA256(deliveryId + "." + expiry)) + "." + expiry and verifies until it expires', () => {
    const receipt = signReceipt(id, new Date(now.getTime() + RECEIPT_TTL_MS), key);
    expect(receipt).toMatch(/^[A-Za-z0-9_-]{43}\.\d+$/);
    expect(receipt.split('.')[1]).toBe(String(Math.floor((now.getTime() + RECEIPT_TTL_MS) / 1000)));
    expect(verifyReceipt(id, receipt, now, key)).toBe(true);
    expect(verifyReceipt(id, receipt, new Date(now.getTime() + RECEIPT_TTL_MS + 1000), key)).toBe(false);
  });

  it('authorises exactly one row, and refuses a forged MAC, a moved expiry or another key', () => {
    const receipt = signReceipt(id, new Date(now.getTime() + RECEIPT_TTL_MS), key);
    const [mac, expiry] = receipt.split('.') as [string, string];
    expect(verifyReceipt('6a1b2c3d4e5f6a7b8c9d0e20', receipt, now, key)).toBe(false);
    expect(verifyReceipt(id, `${mac}.${Number(expiry) + 86_400}`, now, key)).toBe(false);
    expect(verifyReceipt(id, `${'A'.repeat(43)}.${expiry}`, now, key)).toBe(false);
    expect(verifyReceipt(id, receipt, now, Buffer.from('x'.repeat(32)))).toBe(false);
    for (const junk of ['', '.', 'abc', `${mac}.`, `${mac}.12x`, `.${expiry}`]) expect(verifyReceipt(id, junk, now, key), junk).toBe(false);
  });

  it('uses JUVI_RECEIPT_KEY, or derives a stable development key from JWT_SECRET', () => {
    expect(receiptKey({ JUVI_RECEIPT_KEY: 'k'.repeat(32) })).toEqual(key);
    const a = receiptKey({ JWT_SECRET: 'dev-secret' });
    expect(a).toHaveLength(32);
    expect(receiptKey({ JWT_SECRET: 'dev-secret' })).toEqual(a);
    expect(receiptKey({ JWT_SECRET: 'other' })).not.toEqual(a);
  });
});

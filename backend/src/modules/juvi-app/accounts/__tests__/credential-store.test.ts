import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Binary } from 'bson';
import { encryptSecret, decryptSecret, getCredentialKey } from '../credential-store';

describe('credential-store crypto', () => {
  const saved = process.env.JUVI_CREDENTIAL_KEY;
  beforeEach(() => { delete process.env.JUVI_CREDENTIAL_KEY; });
  afterEach(() => { if (saved) process.env.JUVI_CREDENTIAL_KEY = saved; else delete process.env.JUVI_CREDENTIAL_KEY; });

  it('round-trips a secret with a fresh iv each time', () => {
    const a = encryptSecret('river-lamp-482');
    const b = encryptSecret('river-lamp-482');
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(decryptSecret(a)).toBe('river-lamp-482');
    expect(decryptSecret(b)).toBe('river-lamp-482');
  });

  it('fails to decrypt when the auth tag is tampered', () => {
    const enc = encryptSecret('secret');
    const tampered = { ...enc, authTag: Buffer.from(enc.authTag.map((b) => b ^ 0xff)) };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('uses JUVI_CREDENTIAL_KEY when set and rejects a key that is not 32 bytes', () => {
    process.env.JUVI_CREDENTIAL_KEY = Buffer.alloc(32, 7).toString('base64');
    expect(getCredentialKey()).toEqual(Buffer.alloc(32, 7));
    process.env.JUVI_CREDENTIAL_KEY = Buffer.alloc(16, 7).toString('base64');
    expect(() => getCredentialKey()).toThrow(/32 bytes/);
  });

  it('falls back to a deterministic dev key when unset outside production', () => {
    expect(getCredentialKey()).toHaveLength(32);
    expect(getCredentialKey().equals(getCredentialKey())).toBe(true);
  });

  it('decrypts fields read back as BSON Binary (what a lean Mongo read returns), and still decrypts plain Buffers', () => {
    const enc = encryptSecret('cedar-otter-019');
    const wrapped = {
      ciphertext: new Binary(enc.ciphertext),
      iv: new Binary(enc.iv),
      authTag: new Binary(enc.authTag),
    };
    expect(decryptSecret(wrapped)).toBe('cedar-otter-019');
    expect(decryptSecret(enc)).toBe('cedar-otter-019');
  });
});

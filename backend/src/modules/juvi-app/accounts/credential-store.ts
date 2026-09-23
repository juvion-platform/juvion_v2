import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { JuviProvisionedCredential, CredentialSource } from '../../../models/juvi/JuviProvisionedCredential';

export const CREDENTIAL_TTL_DAYS = 7;
const ALGO = 'aes-256-gcm';

/**
 * 32-byte key from JUVI_CREDENTIAL_KEY (base64). Outside production a
 * deterministic dev key is derived so local seeds work without config;
 * app.ts refuses to start in production without the real variable.
 */
export function getCredentialKey(): Buffer {
  const raw = process.env.JUVI_CREDENTIAL_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('JUVI_CREDENTIAL_KEY must decode to 32 bytes');
    return key;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('JUVI_CREDENTIAL_KEY is required in production');
  return createHash('sha256').update('juvi-dev-credential-key').digest();
}

export function encryptSecret(plain: string): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getCredentialKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decryptSecret(row: { ciphertext: Buffer; iv: Buffer; authTag: Buffer }): string {
  const decipher = createDecipheriv(ALGO, getCredentialKey(), row.iv);
  decipher.setAuthTag(row.authTag);
  return Buffer.concat([decipher.update(row.ciphertext), decipher.final()]).toString('utf8');
}

export interface StoreCredentialInput {
  collegeId: string;
  accountId: string;
  runId?: string | null;
  source: CredentialSource;
  identifier: string;
  displayName: string;
  sectionId?: string;
  batchId?: string;
  departmentId?: string;
  plaintext: string;
}

export async function storeCredential(input: StoreCredentialInput): Promise<string> {
  const enc = encryptSecret(input.plaintext);
  const expiresAt = new Date(Date.now() + CREDENTIAL_TTL_DAYS * 86_400_000);
  const doc = await JuviProvisionedCredential.create({
    collegeId: input.collegeId,
    runId: input.runId ?? null,
    accountId: input.accountId,
    source: input.source,
    identifier: input.identifier,
    displayName: input.displayName,
    sectionId: input.sectionId,
    batchId: input.batchId,
    departmentId: input.departmentId,
    ...enc,
    expiresAt,
  });
  return String(doc._id);
}

export async function revealCredential(collegeId: string, credentialId: string): Promise<string | null> {
  if (!Types.ObjectId.isValid(credentialId)) return null;
  const row = await JuviProvisionedCredential.findOne({ _id: credentialId, collegeId, expiresAt: { $gt: new Date() } }).lean();
  if (!row) return null;
  return decryptSecret(row);
}

export async function revealLatestForAccount(
  collegeId: string,
  accountId: string,
): Promise<{ credentialId: string; password: string; expiresAt: Date } | null> {
  const row = await JuviProvisionedCredential.findOne({ collegeId, accountId, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 }).lean();
  if (!row) return null;
  return { credentialId: String(row._id), password: decryptSecret(row), expiresAt: row.expiresAt };
}

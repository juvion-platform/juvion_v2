/**
 * Shared S3 client + key helpers (P1 of student-photo-upload).
 *
 * Owns the lazy singleton `S3Client`, a tiny set of opinionated
 * helpers (put / delete / delete-by-prefix / presign), and the
 * locked-in key prefix layout used by every student-upload feature.
 *
 * Design notes:
 *   - We never construct the SDK client at module-load time. That
 *     would make the entire app boot fail in a misconfigured env, and
 *     would force tests to mock the module before any import. Instead,
 *     `getS3Client()` builds-on-first-use.
 *   - `AWS_S3_BUCKET` is intentionally *not* read at module load
 *     either; `getBucket()` throws AppError(503) at the first call so
 *     a misconfig surfaces as a clean, actionable HTTP error rather
 *     than a process crash.
 *   - When `AWS_S3_ENDPOINT` is set we flip `forcePathStyle: true`
 *     so the same code targets LocalStack / MinIO during dev/CI
 *     without virtual-hosted bucket DNS.
 *   - All keys are treated as opaque strings here. Validation of
 *     ObjectId shape, MIME types, etc. is the calling service's job.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { AppError } from '../../middleware/errorHandler';

// ─── Public types ──────────────────────────────────────────────────

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface PresignOpts {
  /** Seconds until the signed URL expires. Default 3600 (60 min). */
  expiresIn?: number;
}

// ─── Singleton plumbing ────────────────────────────────────────────

let cachedClient: S3Client | null = null;

/**
 * Build the SDK config from the environment. Kept private so the
 * shape stays internal — callers go through `getS3Client()`.
 */
function buildClientConfig(): S3ClientConfig {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_S3_ENDPOINT;

  const config: S3ClientConfig = {
    region,
    credentials:
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined,
  };

  // Custom endpoint => LocalStack / MinIO. Path-style addressing
  // avoids the `<bucket>.s3.<region>.amazonaws.com` DNS dance.
  if (endpoint) {
    config.endpoint = endpoint;
    config.forcePathStyle = true;
  }

  return config;
}

/**
 * Returns the lazily-constructed singleton S3Client. Subsequent calls
 * return the same instance; the SDK constructor runs at most once
 * per process (until a test calls `__resetS3ClientForTesting`).
 */
export function getS3Client(): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client(buildClientConfig());
  }
  return cachedClient;
}

/**
 * Returns the configured bucket name or throws AppError(503) when
 * `AWS_S3_BUCKET` is not set. Service-layer code should let this
 * bubble — the error handler will translate it to a 503 response.
 */
export function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new AppError(503, 'AWS_S3_BUCKET not configured');
  }
  return bucket;
}

/**
 * Cheap, side-effect-free predicate over the same env var `getBucket()`
 * reads — no client construction, no network. Callers that treat S3 as an
 * optional convenience (e.g. the bulk-import source archive) use this to
 * decide whether to attempt the upload at all, instead of calling
 * `getBucket()` and having to catch its throw.
 */
export function isS3Configured(): boolean {
  return Boolean(process.env.AWS_S3_BUCKET);
}

// ─── Key helpers ───────────────────────────────────────────────────

/**
 * Discriminator for any person-linked entity that owns a photo. Keeps
 * the S3 prefix segment in lockstep with the API URL slug for that
 * entity (`/api/people/students/...` ↔ `colleges/<cid>/students/<sid>`).
 */
export type PersonEntityType = 'students' | 'faculty' | 'staff' | 'parents';

/**
 * Locked-in prefix layout for any person-linked entity upload:
 *   colleges/<collegeId>/<entityType>/<entityId>
 *
 * IDs are treated as opaque — no validation here. Caller validates
 * ObjectId shape / multi-tenancy.
 */
export function entityUploadPrefix(
  entityType: PersonEntityType,
  collegeId: string,
  entityId: string,
): string {
  return `colleges/${collegeId}/${entityType}/${entityId}`;
}

/**
 * Compat shim. Existing callers (and tests) target the student-only
 * helper; this keeps them green while the rename rolls out. Remove
 * once all in-tree references are migrated to `entityUploadPrefix`
 * (no external/out-of-tree callers — verified at G1 time).
 */
export function studentUploadPrefix(collegeId: string, studentId: string): string {
  return entityUploadPrefix('students', collegeId, studentId);
}

// ─── Object operations ─────────────────────────────────────────────

export async function putObject(input: PutObjectInput): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    ServerSideEncryption: 'AES256',
    Metadata: input.metadata,
  });
  await getS3Client().send(command);
}

/**
 * Deletes a single object. Idempotent in spirit — when the key is
 * already gone (NoSuchKey), we swallow the error so callers don't
 * have to special-case "already deleted" paths.
 */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  try {
    await getS3Client().send(command);
  } catch (err) {
    if (isNoSuchKeyError(err)) return;
    throw err;
  }
}

/**
 * Enumerates every object under `prefix` and batch-deletes them.
 * Walks all `ListObjectsV2` pages so the operation is unbounded by
 * S3's 1000-key page cap. Returns the total count actually deleted.
 *
 * Used by "purge all uploads for student X" type flows.
 */
export async function deleteObjectsByPrefix(
  prefix: string,
): Promise<{ deleted: number }> {
  const bucket = getBucket();
  const client = getS3Client();
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const listInput: {
      Bucket: string;
      Prefix: string;
      ContinuationToken?: string;
    } = { Bucket: bucket, Prefix: prefix };
    if (continuationToken) listInput.ContinuationToken = continuationToken;

    const list = await client.send(new ListObjectsV2Command(listInput));
    const contents = list.Contents ?? [];

    if (contents.length > 0) {
      const objects = contents
        .map((o) => (o.Key ? { Key: o.Key } : null))
        .filter((o): o is { Key: string } => o !== null);

      if (objects.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objects },
          }),
        );
        deleted += objects.length;
      }
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return { deleted };
}

/**
 * Generates a presigned GET URL for `key`. Default expiry 3600s.
 * Returns both the URL and a computed `expiresAt: Date` so callers
 * can surface it to the client without recomputing.
 */
export async function getPresignedUrl(
  key: string,
  opts: PresignOpts = {},
): Promise<{ url: string; expiresAt: Date }> {
  const expiresIn = opts.expiresIn ?? 3600;
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  const url = await getSignedUrl(getS3Client(), command, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  return { url, expiresAt };
}

// ─── Internal helpers ──────────────────────────────────────────────

function isNoSuchKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  return typeof name === 'string' && name === 'NoSuchKey';
}

// ─── Test-only ─────────────────────────────────────────────────────

/**
 * Test-only hook to drop the cached client between tests. Production
 * code never calls this. Exported separately (not on a `__test__`
 * subpath) to keep the import surface flat for vitest.
 */
export function __resetS3ClientForTesting(): void {
  cachedClient = null;
}

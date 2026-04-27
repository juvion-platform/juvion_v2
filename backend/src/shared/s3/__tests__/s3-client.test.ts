/**
 * P1 — Shared S3 client + key/presign helpers.
 *
 * These are pure unit tests; the AWS SDK is fully mocked, so no live
 * AWS / LocalStack / MinIO instance is required.
 *
 * The module under test is `backend/src/shared/s3/s3-client.ts`. It
 * exposes a lazy singleton `S3Client`, a small set of opinionated
 * helpers (put / delete / delete-by-prefix / presign), and the
 * locked-in key prefix layout for student uploads.
 *
 * The singleton is re-built between tests via the test-only export
 * `__resetS3ClientForTesting()`, which also lets us re-read env after
 * mutation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── SDK mocks ──────────────────────────────────────────────────────
//
// We stub the SDK so we can:
//   1. Inspect constructor args to S3Client (region, creds, endpoint…).
//   2. Inspect the command class + input each helper dispatches.
//   3. Drive `send()` outcomes per test (resolve / reject / paginate).
//
// The mock keeps real exports for type symbols not under test.

const s3SendMock = vi.fn();
const s3ConstructorMock = vi.fn();
const getSignedUrlMock = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    constructor(config: unknown) {
      s3ConstructorMock(config);
    }
    send = s3SendMock;
  }
  class PutObjectCommand {
    public readonly input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class DeleteObjectCommand {
    public readonly input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class ListObjectsV2Command {
    public readonly input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class DeleteObjectsCommand {
    public readonly input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class GetObjectCommand {
    public readonly input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    GetObjectCommand,
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

// Imports come AFTER the mocks so the SUT picks up the stubs.
import {
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  studentUploadPrefix,
  entityUploadPrefix,
  getBucket,
  getS3Client,
  putObject,
  deleteObject,
  deleteObjectsByPrefix,
  getPresignedUrl,
  __resetS3ClientForTesting,
} from '../s3-client';
import type { PersonEntityType } from '../s3-client';
import { AppError } from '../../../middleware/errorHandler';

// ─── env capture ────────────────────────────────────────────────────

const ENV_KEYS = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET',
  'AWS_S3_ENDPOINT',
] as const;

let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  // Snapshot env so each test starts from a clean slate.
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

  // Sensible defaults — individual tests override as needed.
  process.env.AWS_REGION = 'ap-south-1';
  process.env.AWS_ACCESS_KEY_ID = 'AKIA-TEST';
  process.env.AWS_SECRET_ACCESS_KEY = 'secret-test';
  process.env.AWS_S3_BUCKET = 'juvion-test-bucket';
  delete process.env.AWS_S3_ENDPOINT;

  s3SendMock.mockReset();
  s3ConstructorMock.mockReset();
  getSignedUrlMock.mockReset();
  __resetS3ClientForTesting();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  __resetS3ClientForTesting();
});

// ─── Helpers ────────────────────────────────────────────────────────

describe('studentUploadPrefix', () => {
  it('returns the locked-in colleges/<cid>/students/<sid> path', () => {
    expect(studentUploadPrefix('cid-123', 'sid-456')).toBe(
      'colleges/cid-123/students/sid-456',
    );
  });

  it('still resolves through the entity helper (compat shim parity)', () => {
    // The shim must be a thin pass-through to entityUploadPrefix so behavior
    // is guaranteed-identical until the shim is removed in a future release.
    expect(studentUploadPrefix('cid-X', 'sid-Y')).toBe(
      entityUploadPrefix('students', 'cid-X', 'sid-Y'),
    );
  });
});

describe('entityUploadPrefix', () => {
  it('returns colleges/<cid>/students/<sid> for students', () => {
    expect(entityUploadPrefix('students', 'cid-123', 'sid-456')).toBe(
      'colleges/cid-123/students/sid-456',
    );
  });

  it('returns colleges/<cid>/faculty/<fid> for faculty', () => {
    expect(entityUploadPrefix('faculty', 'cid-123', 'fid-456')).toBe(
      'colleges/cid-123/faculty/fid-456',
    );
  });

  it('returns colleges/<cid>/staff/<sid> for staff', () => {
    expect(entityUploadPrefix('staff', 'cid-123', 'sid-456')).toBe(
      'colleges/cid-123/staff/sid-456',
    );
  });

  it('returns colleges/<cid>/parents/<pid> for parents', () => {
    expect(entityUploadPrefix('parents', 'cid-123', 'pid-456')).toBe(
      'colleges/cid-123/parents/pid-456',
    );
  });

  it('treats IDs as opaque strings (no validation here)', () => {
    // The helper is dumb-by-design: ObjectId/UUID validation is the
    // calling service's job. Empty strings, non-Mongo ids — all pass.
    const types: PersonEntityType[] = ['students', 'faculty', 'staff', 'parents'];
    for (const t of types) {
      expect(entityUploadPrefix(t, '', '')).toBe(`colleges//${t}/`);
    }
  });
});

describe('getBucket', () => {
  it('returns AWS_S3_BUCKET when env is set', () => {
    process.env.AWS_S3_BUCKET = 'my-bucket';
    expect(getBucket()).toBe('my-bucket');
  });

  it('throws AppError(503) when AWS_S3_BUCKET is not configured', () => {
    delete process.env.AWS_S3_BUCKET;
    let caught: unknown;
    try {
      getBucket();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(503);
    expect((caught as AppError).message).toMatch(/AWS_S3_BUCKET/);
  });
});

describe('getS3Client (singleton)', () => {
  it('returns the same instance on repeated calls (constructed once)', () => {
    const a = getS3Client();
    const b = getS3Client();
    expect(a).toBe(b);
    expect(s3ConstructorMock).toHaveBeenCalledTimes(1);
  });

  it('honors AWS_S3_ENDPOINT with forcePathStyle: true (LocalStack/MinIO compat)', () => {
    process.env.AWS_S3_ENDPOINT = 'http://localhost:4566';
    __resetS3ClientForTesting();
    getS3Client();
    expect(s3ConstructorMock).toHaveBeenCalledTimes(1);
    const cfg = s3ConstructorMock.mock.calls[0]![0] as {
      endpoint?: string;
      forcePathStyle?: boolean;
      region?: string;
      credentials?: { accessKeyId?: string; secretAccessKey?: string };
    };
    expect(cfg.endpoint).toBe('http://localhost:4566');
    expect(cfg.forcePathStyle).toBe(true);
    expect(cfg.region).toBe('ap-south-1');
    expect(cfg.credentials?.accessKeyId).toBe('AKIA-TEST');
    expect(cfg.credentials?.secretAccessKey).toBe('secret-test');
  });

  it('omits endpoint when AWS_S3_ENDPOINT is not set', () => {
    delete process.env.AWS_S3_ENDPOINT;
    __resetS3ClientForTesting();
    getS3Client();
    const cfg = s3ConstructorMock.mock.calls[0]![0] as {
      endpoint?: string;
      forcePathStyle?: boolean;
    };
    expect(cfg.endpoint).toBeUndefined();
    // forcePathStyle is only meaningful with a custom endpoint; should
    // be falsy in the AWS-default path so the SDK uses virtual-hosted.
    expect(cfg.forcePathStyle).toBeFalsy();
  });
});

// ─── putObject ──────────────────────────────────────────────────────

describe('putObject', () => {
  it('calls PutObjectCommand with Bucket / Key / Body / ContentType / SSE=AES256', async () => {
    s3SendMock.mockResolvedValueOnce({ ETag: '"abc"' });
    const body = Buffer.from('hello');

    await putObject({
      key: 'colleges/c1/students/s1/profile.jpg',
      body,
      contentType: 'image/jpeg',
    });

    expect(s3SendMock).toHaveBeenCalledTimes(1);
    const cmd = s3SendMock.mock.calls[0]![0] as InstanceType<typeof PutObjectCommand>;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    const input = cmd.input as {
      Bucket: string;
      Key: string;
      Body: Buffer;
      ContentType: string;
      ServerSideEncryption: string;
      Metadata?: Record<string, string>;
    };
    expect(input.Bucket).toBe('juvion-test-bucket');
    expect(input.Key).toBe('colleges/c1/students/s1/profile.jpg');
    expect(input.Body).toBe(body);
    expect(input.ContentType).toBe('image/jpeg');
    expect(input.ServerSideEncryption).toBe('AES256');
  });

  it('includes Metadata when the caller supplies it', async () => {
    s3SendMock.mockResolvedValueOnce({});
    await putObject({
      key: 'k',
      body: Buffer.from(''),
      contentType: 'image/png',
      metadata: { uploadedBy: 'user-1', purpose: 'profile' },
    });
    const cmd = s3SendMock.mock.calls[0]![0] as InstanceType<typeof PutObjectCommand>;
    const input = cmd.input as { Metadata?: Record<string, string> };
    expect(input.Metadata).toEqual({ uploadedBy: 'user-1', purpose: 'profile' });
  });

  it('surfaces SDK errors as thrown errors', async () => {
    s3SendMock.mockRejectedValueOnce(new Error('NetworkingError'));
    await expect(
      putObject({ key: 'k', body: Buffer.from(''), contentType: 'image/jpeg' }),
    ).rejects.toThrow('NetworkingError');
  });
});

// ─── deleteObject ───────────────────────────────────────────────────

describe('deleteObject', () => {
  it('calls DeleteObjectCommand with the right Bucket + Key', async () => {
    s3SendMock.mockResolvedValueOnce({});
    await deleteObject('colleges/c1/students/s1/profile.jpg');
    expect(s3SendMock).toHaveBeenCalledTimes(1);
    const cmd = s3SendMock.mock.calls[0]![0] as InstanceType<typeof DeleteObjectCommand>;
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
    const input = cmd.input as { Bucket: string; Key: string };
    expect(input.Bucket).toBe('juvion-test-bucket');
    expect(input.Key).toBe('colleges/c1/students/s1/profile.jpg');
  });

  it('does NOT throw when the key does not exist (NoSuchKey)', async () => {
    const err = Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    s3SendMock.mockRejectedValueOnce(err);
    await expect(deleteObject('missing-key')).resolves.toBeUndefined();
  });
});

// ─── deleteObjectsByPrefix ──────────────────────────────────────────

describe('deleteObjectsByPrefix', () => {
  it('lists then batch-deletes; returns the deleted count', async () => {
    s3SendMock
      // ListObjectsV2 page 1
      .mockResolvedValueOnce({
        Contents: [{ Key: 'p/a' }, { Key: 'p/b' }, { Key: 'p/c' }],
        IsTruncated: false,
      })
      // DeleteObjects
      .mockResolvedValueOnce({ Deleted: [{ Key: 'p/a' }, { Key: 'p/b' }, { Key: 'p/c' }] });

    const result = await deleteObjectsByPrefix('p/');
    expect(result.deleted).toBe(3);

    // Inspect call order: List first, then Delete.
    expect(s3SendMock).toHaveBeenCalledTimes(2);
    const list = s3SendMock.mock.calls[0]![0] as InstanceType<typeof ListObjectsV2Command>;
    const del = s3SendMock.mock.calls[1]![0] as InstanceType<typeof DeleteObjectsCommand>;
    expect(list).toBeInstanceOf(ListObjectsV2Command);
    expect(del).toBeInstanceOf(DeleteObjectsCommand);

    const listInput = list.input as { Bucket: string; Prefix: string };
    expect(listInput.Bucket).toBe('juvion-test-bucket');
    expect(listInput.Prefix).toBe('p/');

    const delInput = del.input as {
      Bucket: string;
      Delete: { Objects: { Key: string }[] };
    };
    expect(delInput.Bucket).toBe('juvion-test-bucket');
    expect(delInput.Delete.Objects).toEqual([
      { Key: 'p/a' },
      { Key: 'p/b' },
      { Key: 'p/c' },
    ]);
  });

  it('returns 0 when the prefix has no objects (no DeleteObjects call)', async () => {
    s3SendMock.mockResolvedValueOnce({ Contents: [], IsTruncated: false });
    const result = await deleteObjectsByPrefix('empty/');
    expect(result.deleted).toBe(0);
    // Only the List call should have happened — no Delete.
    expect(s3SendMock).toHaveBeenCalledTimes(1);
  });

  it('handles paginated lists (>1000 keys spread across two pages)', async () => {
    const pageOne = Array.from({ length: 1000 }, (_, i) => ({ Key: `p/${i}` }));
    const pageTwo = Array.from({ length: 5 }, (_, i) => ({ Key: `p/${1000 + i}` }));

    s3SendMock
      // List page 1 (truncated)
      .mockResolvedValueOnce({
        Contents: pageOne,
        IsTruncated: true,
        NextContinuationToken: 'tok-1',
      })
      // Delete page 1
      .mockResolvedValueOnce({ Deleted: pageOne.map(({ Key }) => ({ Key })) })
      // List page 2 (final)
      .mockResolvedValueOnce({
        Contents: pageTwo,
        IsTruncated: false,
      })
      // Delete page 2
      .mockResolvedValueOnce({ Deleted: pageTwo.map(({ Key }) => ({ Key })) });

    const result = await deleteObjectsByPrefix('p/');
    expect(result.deleted).toBe(1005);
    expect(s3SendMock).toHaveBeenCalledTimes(4);

    // Second list call must thread the ContinuationToken through.
    const secondList = s3SendMock.mock.calls[2]![0] as InstanceType<typeof ListObjectsV2Command>;
    const secondListInput = secondList.input as { ContinuationToken?: string };
    expect(secondListInput.ContinuationToken).toBe('tok-1');
  });
});

// ─── getPresignedUrl ────────────────────────────────────────────────

describe('getPresignedUrl', () => {
  it('returns { url, expiresAt } with the default 3600s expiry', async () => {
    getSignedUrlMock.mockResolvedValueOnce('https://signed.example/x');

    const before = Date.now();
    const result = await getPresignedUrl('colleges/c1/students/s1/profile.jpg');
    const after = Date.now();

    expect(result.url).toBe('https://signed.example/x');
    expect(result.expiresAt).toBeInstanceOf(Date);

    // expiresAt ≈ now + 3600s.
    const ms = result.expiresAt.getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(ms).toBeLessThanOrEqual(after + 3600 * 1000 + 100);

    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    const [, command, opts] = getSignedUrlMock.mock.calls[0] as [
      unknown,
      InstanceType<typeof GetObjectCommand>,
      { expiresIn?: number },
    ];
    expect(command).toBeInstanceOf(GetObjectCommand);
    const input = command.input as { Bucket: string; Key: string };
    expect(input.Bucket).toBe('juvion-test-bucket');
    expect(input.Key).toBe('colleges/c1/students/s1/profile.jpg');
    expect(opts.expiresIn).toBe(3600);
  });

  it('honors a custom expiresIn', async () => {
    getSignedUrlMock.mockResolvedValueOnce('https://signed.example/y');
    await getPresignedUrl('k', { expiresIn: 60 });
    const opts = getSignedUrlMock.mock.calls[0]![2] as { expiresIn?: number };
    expect(opts.expiresIn).toBe(60);
  });

  it('computes expiresAt within ~100ms of (now + expiresIn)', async () => {
    getSignedUrlMock.mockResolvedValueOnce('https://signed.example/z');
    const expiresIn = 45;
    const before = Date.now();
    const result = await getPresignedUrl('k', { expiresIn });
    const after = Date.now();
    const ms = result.expiresAt.getTime();
    expect(ms).toBeGreaterThanOrEqual(before + expiresIn * 1000);
    expect(ms).toBeLessThanOrEqual(after + expiresIn * 1000 + 100);
  });
});

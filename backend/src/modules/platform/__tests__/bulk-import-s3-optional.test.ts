/**
 * S3-optional source archive (CI-blocking defect fix).
 *
 * `uploadAndValidate()` used to archive the uploaded CSV to S3
 * unconditionally, before ever parsing a row. `putObject()` calls
 * `getBucket()` internally, which throws `AppError(503)` when
 * `AWS_S3_BUCKET` is unset — and that env var was never set anywhere in
 * `.env.example`, `CLAUDE.md`, or the e2e CI workflow. So every bulk
 * import, of every entity type, through either door
 * (`/platform/bulk-imports` or the `/people/students/import/*` façade),
 * 503'd before a single row was ever validated on any machine or CI run
 * that hadn't manually set the bucket.
 *
 * The archive is an audit convenience, not a correctness requirement.
 * These tests pin the fix: the archive is best-effort when S3 isn't
 * configured (the import proceeds with no `s3Key`), and byte-identical —
 * including abort-on-upload-failure — when it is configured.
 *
 * `putObject` is mocked here with an implementation that mirrors the
 * REAL `getBucket()` gate (throws when `AWS_S3_BUCKET` is unset) so the
 * mock cannot silently defeat the very reproduction it exists to support.
 * `isS3Configured` (and everything else) is left as the real
 * implementation via `importOriginal`, so it responds to the actual env
 * var this file manipulates — exactly like production code will.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import * as registry from '../bulk-import-registry';
import { ImportJob } from '../../../models/platform/ImportJob';
import { AppError } from '../../../middleware/errorHandler';
import type { ImportSchemaDefinition } from '../import-schemas/types';

const putObjectMock = vi.fn(async (..._args: unknown[]) => {
  // Faithful stand-in for the real putObject()'s precondition (it calls
  // getBucket(), which throws AppError(503) when unconfigured) — NOT a
  // blanket success, so an unfixed caller that still uploads
  // unconditionally genuinely fails this reproduction.
  if (!process.env.AWS_S3_BUCKET) {
    throw new AppError(503, 'AWS_S3_BUCKET not configured');
  }
});
const getPresignedUrlMock = vi.fn().mockResolvedValue({
  url: 'https://example.test/mock',
  expiresAt: new Date(),
});

vi.mock('../../../shared/s3/s3-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/s3/s3-client')>();
  return {
    ...actual,
    // isS3Configured / getBucket / getS3Client stay real — the whole point
    // of this file is to exercise the real predicate against the env var
    // manipulated per-test. Only the two calls that would otherwise need a
    // real bucket / network are stubbed.
    putObject: (...args: Parameters<typeof actual.putObject>) => putObjectMock(...args),
    getPresignedUrl: (...args: Parameters<typeof actual.getPresignedUrl>) =>
      getPresignedUrlMock(...args),
  };
});

// SUT imported after the mock so it binds the (partially) mocked module.
import { uploadAndValidate, getImportJobSourceUrl } from '../bulk-import-service';

vi.setConfig({ testTimeout: 20_000 });

const COLLEGE = '000000000000000000000001';
const ENTITY_TYPE = 's3-optional-fixture';

function fakeSchema(): ImportSchemaDefinition {
  return {
    entityType: ENTITY_TYPE,
    label: 'Fixture',
    description: 'test only',
    fields: [
      {
        fieldKey: 'code',
        label: 'Code',
        type: 'string',
        required: true,
        validate: (raw: string) =>
          raw.trim()
            ? { ok: true as const, value: raw.trim() }
            : { ok: false as const, error: 'required' },
      },
    ],
    sampleRow: { code: 'A' },
    commitOne: async () => ({ id: 'x' }),
  };
}

async function run(csv: string) {
  vi.spyOn(registry, 'getImportSchema').mockReturnValue(fakeSchema());
  return uploadAndValidate({
    collegeId: COLLEGE,
    performedBy: 'tester',
    entityType: ENTITY_TYPE,
    fileBuffer: Buffer.from(csv),
    fileName: 'f.csv',
    declaredMime: 'text/csv',
  });
}

// Scoped env manipulation — several suites in this repo run in parallel and
// a leaked AWS_S3_BUCKET would cause confusing cross-file failures. Same
// pattern as backend/src/__e2e__/modules/student-import.e2e.test.ts's
// RBAC_ENFORCE toggling.
let previousBucket: string | undefined;

beforeAll(async () => {
  await setupMongo();
}, 60_000);

afterAll(async () => {
  await teardownMongo();
});

afterEach(async () => {
  await clearCollections();
  vi.restoreAllMocks();
  putObjectMock.mockClear();
  getPresignedUrlMock.mockClear();
  getPresignedUrlMock.mockResolvedValue({ url: 'https://example.test/mock', expiresAt: new Date() });

  if (previousBucket === undefined) delete process.env.AWS_S3_BUCKET;
  else process.env.AWS_S3_BUCKET = previousBucket;
  previousBucket = undefined;
});

describe('uploadAndValidate — S3 archive is best-effort', () => {
  it('CI-reproducing: succeeds with AWS_S3_BUCKET unset, job has no s3Key, previews rows normally', async () => {
    previousBucket = process.env.AWS_S3_BUCKET;
    delete process.env.AWS_S3_BUCKET;

    const p = await run('code\nA');

    expect(p.job.status).toBe('preview_ready');
    expect(p.job.s3Key).toBeUndefined();
    expect(p.validCount).toBe(1);
    expect(p.errorCount).toBe(0);
    expect(putObjectMock).not.toHaveBeenCalled();

    const persisted = await ImportJob.findById(p.job._id).lean();
    expect(persisted?.s3Key).toBeUndefined();
  });

  it('with AWS_S3_BUCKET set, putObject is still called and the key is still recorded (existing behaviour preserved)', async () => {
    previousBucket = process.env.AWS_S3_BUCKET;
    process.env.AWS_S3_BUCKET = 'test-bucket';

    const p = await run('code\nA');

    expect(putObjectMock).toHaveBeenCalledTimes(1);
    expect(p.job.s3Key).toBeDefined();
    expect(p.job.s3Key).toContain(String(p.job._id));

    const persisted = await ImportJob.findById(p.job._id).lean();
    expect(persisted?.s3Key).toBe(p.job.s3Key);
  });

  it('with S3 configured but putObject rejecting, the import still aborts and no ImportJob row is created', async () => {
    previousBucket = process.env.AWS_S3_BUCKET;
    process.env.AWS_S3_BUCKET = 'test-bucket';
    putObjectMock.mockRejectedValueOnce(new Error('network down'));

    await expect(run('code\nA')).rejects.toThrow('network down');

    const count = await ImportJob.countDocuments({ collegeId: COLLEGE });
    expect(count).toBe(0);
  });
});

describe('getImportJobSourceUrl — job with no archived source file', () => {
  it('throws a clear AppError instead of crashing on an undefined s3Key', async () => {
    previousBucket = process.env.AWS_S3_BUCKET;
    delete process.env.AWS_S3_BUCKET;

    const p = await run('code\nA');
    expect(p.job.s3Key).toBeUndefined();

    const err = await getImportJobSourceUrl(COLLEGE, String(p.job._id)).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(503);
    expect((err as AppError).message).toMatch(/no source file was archived/i);
    expect(getPresignedUrlMock).not.toHaveBeenCalled();
  });
});

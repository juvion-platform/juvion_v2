import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { getTestApp, cleanupTestApp } from '../setup/test-app';
import { seedBase, BaseFixtures } from '../setup/seed-base';
import { createTestApi, TestApi } from '../helpers/request';
import { createTestUser } from '../factories/user.factory';

// uploadAndValidate() (called by previewHandler) writes the source CSV to
// S3 before validating rows. The e2e harness boots app.ts directly (not
// server.ts), so dotenv never runs and AWS_S3_BUCKET is unset — every
// preview call would 503 on "AWS_S3_BUCKET not configured" before ever
// reaching the auth/validation logic this test exists to prove. Mocked
// with the same shape used in bulk-import-row-hook.test.ts.
vi.mock('../../shared/s3/s3-client', () => ({
  putObject: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue({ url: 'https://example.test/mock', expiresAt: new Date() }),
}));

let api: TestApi;
let fx: BaseFixtures;
let registrar: Awaited<ReturnType<typeof createTestUser>>;

beforeAll(async () => {
  const app = await getTestApp();
  fx = await seedBase();
  registrar = await createTestUser({
    collegeId: fx.collegeId, role: 'staff', personaType: 'ST-REG',
    name: 'Test Registrar', email: 'registrar@test.com',
  });
  api = createTestApi(app);
});

afterAll(async () => { await cleanupTestApp(); });

describe('GET /api/people/students/import/template', () => {
  it('returns the schema with mandatory fields marked', async () => {
    const res = await api.as(fx.admin.token).get('/api/people/students/import/template');
    expect(res.status).toBe(200);
    expect(res.body.entityType).toBe('student');
    expect(res.body.fields.length).toBe(25);
    const required = res.body.fields.filter((f: any) => f.required).map((f: any) => f.fieldKey);
    expect(required.sort()).toEqual(['admissionYear', 'name', 'phone', 'programmeCode']);
  });

  it('401 without auth', async () => {
    const res = await api.get('/api/people/students/import/template');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/people/students/import/preview', () => {
  it('accepts a template-shaped CSV with asterisk headers', async () => {
    // programmeCode must match a programme seedBase actually created
    // (BTECH) — the brief's sample "BTCSE" doesn't exist in the seeded
    // fixtures, which would fail resolveStudentRefs and populate
    // previewRows[0].errors instead of leaving it empty.
    const csv = [
      'name*,phone*,programmeCode*,admissionYear*',
      'Aarav Sharma,9876543210,BTECH,2025',
    ].join('\n');

    const res = await api.as(fx.admin.token)
      .post('/api/people/students/import/preview')
      .attach('file', Buffer.from(csv), { filename: 'students.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    // The asterisk headers must map onto fieldKeys — otherwise every
    // required field reads empty and the row fails.
    expect(res.body.previewRows[0].errors).toEqual([]);
  });

  it('401 without auth', async () => {
    const res = await api.post('/api/people/students/import/preview').send({});
    expect(res.status).toBe(401);
  });
});

// The e2e harness sets RBAC_ENFORCE='false' globally (see
// setup/test-app.ts), which makes authorize() a pass-through for ANY
// authenticated user regardless of module/action — so `expect(res.status)
// .not.toBe(403)` against that default would pass identically whether the
// route were wired to authorize('people', 'create') OR the wrong
// authorize('platform', 'create'). That is not a real test of the
// authorization boundary, which is the entire reason this facade exists.
//
// authorize() (middleware/authorize.ts) reads process.env.RBAC_ENFORCE on
// every request rather than caching it at boot, so it can be flipped to
// 'true' for just these tests — same technique already used by
// workflows/01-auth-rbac.test.ts. seedBase() has already upserted the real
// DEFAULT_POLICIES, so there is something for the engine to enforce.
describe('RBAC enforcement — the gate is on people, not platform', () => {
  let previousRbacEnforce: string | undefined;

  beforeEach(() => {
    previousRbacEnforce = process.env.RBAC_ENFORCE;
    process.env.RBAC_ENFORCE = 'true';
  });

  afterEach(() => {
    // Restore whatever the harness had before (normally 'false') so
    // enforcement never leaks into a later test file sharing this worker.
    if (previousRbacEnforce === undefined) delete process.env.RBAC_ENFORCE;
    else process.env.RBAC_ENFORCE = previousRbacEnforce;
  });

  it('a Registrar (people:*, no platform:create) can preview AND commit — the whole reason this facade exists', async () => {
    const csv = 'name*,phone*,programmeCode*,admissionYear*\nRbac Ok,9876500001,BTECH,2025';
    const previewRes = await api.as(registrar.token)
      .post('/api/people/students/import/preview')
      .attach('file', Buffer.from(csv), { filename: 'rbac-ok.csv', contentType: 'text/csv' });
    expect(previewRes.status).toBe(201);
    expect(previewRes.body.previewRows[0].errors).toEqual([]);

    const jobId = previewRes.body.job._id;
    const commitRes = await api.as(registrar.token)
      .post('/api/people/students/import/commit')
      .send({ jobId });
    expect(commitRes.status).toBe(200);
    expect(commitRes.body.status).toBe('completed');
  });

  it('a Principal (platform:*, only people:read — no people:create) is rejected on preview — proves the gate checks people:create, not platform', async () => {
    // DEFAULT_POLICIES gives principal `module:'*', action:'read'` plus
    // `platform` a full wildcard, but nothing grants principal
    // `people:create`. If this route were wired to
    // authorize('platform','create') instead, principal would incorrectly
    // pass. Real enforcement must reject it.
    const csv = 'name*,phone*,programmeCode*,admissionYear*\nRbac Blocked,9876500002,BTECH,2025';
    const res = await api.as(fx.principal.token)
      .post('/api/people/students/import/preview')
      .attach('file', Buffer.from(csv), { filename: 'rbac-blocked.csv', contentType: 'text/csv' });
    expect(res.status).toBe(403);
  });
});

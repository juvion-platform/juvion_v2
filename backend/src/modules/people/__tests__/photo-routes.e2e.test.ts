/**
 * P5 — End-to-end HTTP tests for the student photo routes.
 *
 * Routes under test (mounted on `/api/people` by `routes.ts`):
 *   - POST   /students/:id/photo        (multipart upload)
 *   - DELETE /students/:id/photo
 *   - GET    /students/:id/photo-url    (?variant=thumb|original|both)
 *
 * Strategy:
 *   - Real Mongo (in-memory via `setupMongo`) for Person/Student lookups so
 *     multi-tenancy and 404/scoping checks hit real schema validation.
 *   - Real `sharp` + real `multer` running on tiny in-memory JPEG/PNG buffers.
 *     Sharp is fast on these and exercises the actual fileFilter / size cap
 *     paths; mocking either would defeat the point of an HTTP-layer test.
 *   - Mocked S3 client at the module level (`putObject`, `deleteObject`,
 *     `getPresignedUrl`) so we can drive call sites and orchestrate failures
 *     without LocalStack. Photo-service binds to the mocked module via the
 *     module-level mock declared BEFORE the SUT import.
 *
 * RBAC: the shared app sets `RBAC_ENFORCE='false'` for tests so `authorize()`
 * passes through; the dedicated 403 wrong-role test flips the flag for the
 * duration of that single case to assert the deny path.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import mongoose from 'mongoose';
import sharp from 'sharp';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { Person } from '../../../models/people/Person';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Parent } from '../../../models/people/Parent';

// ─── S3 client mock (must be declared BEFORE app/router import) ───────

const putObjectMock = vi.fn();
const deleteObjectMock = vi.fn();
const getPresignedUrlMock = vi.fn();

vi.mock('../../../shared/s3/s3-client', () => ({
  putObject: (...args: unknown[]) => putObjectMock(...args),
  deleteObject: (...args: unknown[]) => deleteObjectMock(...args),
  getPresignedUrl: (...args: unknown[]) => getPresignedUrlMock(...args),
  studentUploadPrefix: (collegeId: string, studentId: string) =>
    `colleges/${collegeId}/students/${studentId}`,
  entityUploadPrefix: (
    entityType: 'students' | 'faculty' | 'staff' | 'parents',
    collegeId: string,
    entityId: string,
  ) => `colleges/${collegeId}/${entityType}/${entityId}`,
}));

// Set env before importing app — `app.ts` reads NODE_ENV/JWT_SECRET on import.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.RBAC_ENFORCE = 'false';

// SUT imports must follow the env mutations + s3-client mock.
import request from 'supertest';
import app from '../../../app';
import { createAuthToken } from '../../../__e2e__/factories/user.factory';

// ─── Fixture buffers (built once with real sharp) ─────────────────────

let JPEG_50: Buffer;
let PNG_50: Buffer;

beforeAll(async () => {
  await setupMongo();

  JPEG_50 = await sharp({
    create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();

  PNG_50 = await sharp({
    create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .png()
    .toBuffer();
}, 60_000);

afterAll(async () => {
  await teardownMongo();
});

beforeEach(() => {
  putObjectMock.mockResolvedValue(undefined);
  deleteObjectMock.mockResolvedValue(undefined);
  getPresignedUrlMock.mockImplementation(async (key: string) => ({
    url: `https://signed.example/${encodeURIComponent(key)}`,
    expiresAt: new Date(Date.now() + 3600 * 1000),
  }));
});

afterEach(async () => {
  await clearCollections();
  putObjectMock.mockReset();
  deleteObjectMock.mockReset();
  getPresignedUrlMock.mockReset();
});

// ─── Helpers ──────────────────────────────────────────────────────────

const oid = () => new mongoose.Types.ObjectId();

interface SeededEntity {
  collegeId: string;
  /** Generic id of the seeded row (Student / Faculty / Staff / Parent). */
  entityId: string;
  /** Backwards-compat alias for the existing student-only describe blocks. */
  studentId: string;
  personId: mongoose.Types.ObjectId;
}

async function seedStudent(collegeIdOverride?: string): Promise<SeededEntity> {
  const collegeId = collegeIdOverride ?? String(oid());
  const person = await Person.create({
    collegeId,
    name: 'Test Student',
    phone: '9999999999',
  });
  const student = await Student.create({
    collegeId,
    personId: person._id,
    admissionYear: 2025,
    status: 'active',
  });
  return {
    collegeId,
    entityId: String(student._id),
    studentId: String(student._id),
    personId: person._id as mongoose.Types.ObjectId,
  };
}

async function seedFaculty(collegeIdOverride?: string): Promise<SeededEntity> {
  const collegeId = collegeIdOverride ?? String(oid());
  const person = await Person.create({
    collegeId,
    name: 'Test Faculty',
    phone: '9999999998',
  });
  const faculty = await Faculty.create({
    collegeId,
    personId: person._id,
    employeeCode: `FAC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    designation: 'Assistant Professor',
    contractType: 'regular',
    status: 'active',
  });
  return {
    collegeId,
    entityId: String(faculty._id),
    studentId: String(faculty._id),
    personId: person._id as mongoose.Types.ObjectId,
  };
}

async function seedStaff(collegeIdOverride?: string): Promise<SeededEntity> {
  const collegeId = collegeIdOverride ?? String(oid());
  const person = await Person.create({
    collegeId,
    name: 'Test Staff',
    phone: '9999999997',
  });
  const staff = await Staff.create({
    collegeId,
    personId: person._id,
    employeeCode: `STF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    designation: 'Office Manager',
    staffType: 'admin',
    status: 'active',
  });
  return {
    collegeId,
    entityId: String(staff._id),
    studentId: String(staff._id),
    personId: person._id as mongoose.Types.ObjectId,
  };
}

async function seedParent(collegeIdOverride?: string): Promise<SeededEntity> {
  const collegeId = collegeIdOverride ?? String(oid());
  const person = await Person.create({
    collegeId,
    name: 'Test Parent',
    phone: '9999999996',
  });
  const parent = await Parent.create({
    collegeId,
    personId: person._id,
    relationship: 'father',
    primaryContact: true,
  });
  return {
    collegeId,
    entityId: String(parent._id),
    studentId: String(parent._id),
    personId: person._id as mongoose.Types.ObjectId,
  };
}

/** Build an admin token scoped to `collegeId` (mirrors seed-base/admin). */
function adminToken(collegeId: string): string {
  return createAuthToken({
    id: String(oid()),
    name: 'Admin',
    email: 'admin@test.com',
    role: 'admin',
    personaType: 'L-ADMIN',
    collegeId,
  });
}

/** Build a token whose role has no `people:update` policy (used by 403 case). */
function studentRoleToken(collegeId: string): string {
  return createAuthToken({
    id: String(oid()),
    name: 'Student User',
    email: 'student@test.com',
    role: 'student',
    personaType: 'L-STU',
    collegeId,
  });
}

async function setExistingPhoto(personId: mongoose.Types.ObjectId, photo: {
  original: string;
  thumb: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  uploadedAt: Date;
}) {
  await Person.updateOne({ _id: personId }, { $set: { photo } });
}

// ═════════════════════════════════════════════════════════════════════
//  POST /api/people/students/:id/photo
// ═════════════════════════════════════════════════════════════════════

describe('POST /api/people/students/:id/photo', () => {
  // 60s rather than 30s, matching the beforeAll budget. The route itself
  // answers in single-digit milliseconds and this passes in isolation; it
  // only ever timed out in the full parallel run, where 100+ worker processes
  // each holding an in-memory MongoDB contend for I/O and the first
  // seed-plus-upload in this file absorbs the worst of it. A timeout that
  // trips on machine load rather than on a code change is just a flaky test.
  it('200 happy path: small valid JPEG → uploads original.jpg + thumb.jpg', { timeout: 60_000 }, async () => {
    const { collegeId, studentId } = await seedStudent();
    const token = adminToken(collegeId);

    const res = await request(app)
      .post(`/api/people/students/${studentId}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', JPEG_50, { filename: 'avatar.jpg', contentType: 'image/jpeg' })
      .expect(200);

    expect(res.body.original).toMatch(/\/photo\/original\.jpg$/);
    expect(res.body.thumb).toMatch(/\/photo\/thumb\.jpg$/);
    expect(res.body.contentType).toBe('image/jpeg');
    expect(res.body.sizeBytes).toBe(JPEG_50.length);
    expect(typeof res.body.uploadedAt).toBe('string');

    expect(putObjectMock).toHaveBeenCalledTimes(2);
  });

  it('200 PNG: returns original.png and thumb.jpg (thumb is always JPEG)', async () => {
    const { collegeId, studentId } = await seedStudent();
    const token = adminToken(collegeId);

    const res = await request(app)
      .post(`/api/people/students/${studentId}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PNG_50, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(200);

    expect(res.body.original).toMatch(/\/photo\/original\.png$/);
    expect(res.body.thumb).toMatch(/\/photo\/thumb\.jpg$/);
    expect(res.body.contentType).toBe('image/png');
  });

  it('400 oversize file (> 5 MB) → multer rejects with user-friendly message', async () => {
    const { collegeId, studentId } = await seedStudent();
    const token = adminToken(collegeId);

    // 6 MiB random buffer with a .jpg extension. Multer should kill it on
    // size — long before sharp/photo-service ever see it.
    const oversize = Buffer.alloc(6 * 1024 * 1024, 0x00);

    const res = await request(app)
      .post(`/api/people/students/${studentId}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', oversize, { filename: 'huge.jpg', contentType: 'image/jpeg' })
      .expect(400);

    expect(res.body.error).toMatch(/File too large/i);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('400 unsupported MIME (text/plain) → fileFilter rejects', async () => {
    const { collegeId, studentId } = await seedStudent();
    const token = adminToken(collegeId);

    const res = await request(app)
      .post(`/api/people/students/${studentId}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not an image'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(res.body.error).toMatch(/Unsupported image format/i);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('401 without auth header', async () => {
    const { studentId } = await seedStudent();

    await request(app)
      .post(`/api/people/students/${studentId}/photo`)
      .attach('file', JPEG_50, { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(401);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('403 when role lacks people:update permission (RBAC_ENFORCE=true)', async () => {
    const { collegeId, studentId } = await seedStudent();
    const token = studentRoleToken(collegeId);

    process.env.RBAC_ENFORCE = 'true';
    try {
      const res = await request(app)
        .post(`/api/people/students/${studentId}/photo`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_50, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(403);
      expect(res.body.error).toBeTruthy();
      expect(putObjectMock).not.toHaveBeenCalled();
    } finally {
      process.env.RBAC_ENFORCE = 'false';
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
//  DELETE /api/people/students/:id/photo
// ═════════════════════════════════════════════════════════════════════

describe('DELETE /api/people/students/:id/photo', () => {
  it('200 happy path: deletes both S3 keys and clears Person.photo', async () => {
    const { collegeId, studentId, personId } = await seedStudent();
    const token = adminToken(collegeId);
    const prefix = `colleges/${collegeId}/students/${studentId}`;
    await setExistingPhoto(personId, {
      original: `${prefix}/photo/original.jpg`,
      thumb: `${prefix}/photo/thumb.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      uploadedAt: new Date(),
    });

    const res = await request(app)
      .delete(`/api/people/students/${studentId}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ deleted: true });
    expect(deleteObjectMock).toHaveBeenCalledTimes(2);

    const updatedPerson = await Person.findById(personId).lean();
    expect(updatedPerson?.photo).toBeFalsy();
  });

  it('200 idempotent: deleting when no photo present is a no-op', async () => {
    const { collegeId, studentId } = await seedStudent();
    const token = adminToken(collegeId);

    const res = await request(app)
      .delete(`/api/people/students/${studentId}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ deleted: true });
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it('404 cross-college: deleting a student from a different college', async () => {
    const collegeA = String(oid());
    // Student belongs to college B.
    const { studentId } = await seedStudent();
    const token = adminToken(collegeA); // caller is from college A

    const res = await request(app)
      .delete(`/api/people/students/${studentId}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    // After the G1+G2 generalization the error is now per-entity-type
    // (the message is the entity-type slug verbatim — "students").
    expect(res.body.error).toMatch(/students not found/);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════
//  GET /api/people/students/:id/photo-url
// ═════════════════════════════════════════════════════════════════════

describe('GET /api/people/students/:id/photo-url', () => {
  async function seedStudentWithPhoto(): Promise<{
    collegeId: string;
    studentId: string;
    photo: {
      original: string;
      thumb: string;
      contentType: 'image/jpeg';
      sizeBytes: number;
      uploadedAt: Date;
    };
  }> {
    const { collegeId, studentId, personId } = await seedStudent();
    const prefix = `colleges/${collegeId}/students/${studentId}`;
    const photo = {
      original: `${prefix}/photo/original.jpg`,
      thumb: `${prefix}/photo/thumb.jpg`,
      contentType: 'image/jpeg' as const,
      sizeBytes: 100,
      uploadedAt: new Date(),
    };
    await setExistingPhoto(personId, photo);
    return { collegeId, studentId, photo };
  }

  it('200 variant=thumb: returns only thumb', async () => {
    const { collegeId, studentId, photo } = await seedStudentWithPhoto();
    const token = adminToken(collegeId);

    const res = await request(app)
      .get(`/api/people/students/${studentId}/photo-url?variant=thumb`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.thumb).toBeDefined();
    expect(res.body.original).toBeUndefined();
    expect(typeof res.body.thumb.url).toBe('string');
    expect(typeof res.body.thumb.expiresAt).toBe('string');
    expect(getPresignedUrlMock).toHaveBeenCalledTimes(1);
    expect(getPresignedUrlMock.mock.calls[0]![0]).toBe(photo.thumb);
  });

  it('200 variant=original: returns only original', async () => {
    const { collegeId, studentId, photo } = await seedStudentWithPhoto();
    const token = adminToken(collegeId);

    const res = await request(app)
      .get(`/api/people/students/${studentId}/photo-url?variant=original`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.original).toBeDefined();
    expect(res.body.thumb).toBeUndefined();
    expect(getPresignedUrlMock).toHaveBeenCalledTimes(1);
    expect(getPresignedUrlMock.mock.calls[0]![0]).toBe(photo.original);
  });

  it('200 default (no variant): returns both URLs', async () => {
    const { collegeId, studentId } = await seedStudentWithPhoto();
    const token = adminToken(collegeId);

    const res = await request(app)
      .get(`/api/people/students/${studentId}/photo-url`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.thumb).toBeDefined();
    expect(res.body.original).toBeDefined();
    expect(getPresignedUrlMock).toHaveBeenCalledTimes(2);
  });

  it('200 student has no photo → returns empty object {}', async () => {
    const { collegeId, studentId } = await seedStudent();
    const token = adminToken(collegeId);

    const res = await request(app)
      .get(`/api/people/students/${studentId}/photo-url`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({});
    expect(getPresignedUrlMock).not.toHaveBeenCalled();
  });

  it('400 invalid variant → 400 with helpful message', async () => {
    const { collegeId, studentId } = await seedStudentWithPhoto();
    const token = adminToken(collegeId);

    const res = await request(app)
      .get(`/api/people/students/${studentId}/photo-url?variant=garbage`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body.error).toMatch(/variant/i);
    expect(getPresignedUrlMock).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════
//  Parameterized happy/auth/cross-college tests across all 4 entity types
//
//  G3 — student is the existing baseline; faculty/staff/parents are the
//  three new mounts. Each entity gets the same trio of happy paths
//  (POST upload, GET photo-url, DELETE) plus a cross-college 404 guard.
//
//  The OTHER tests (oversize file, unsupported MIME, multer error
//  remap, RBAC 403, 401) live in the student blocks above — they're
//  entity-type-agnostic so we only need to exercise them once.
// ═════════════════════════════════════════════════════════════════════

const ENTITY_PATHS = [
  { type: 'students', path: '/api/people/students', seed: seedStudent },
  { type: 'faculty', path: '/api/people/faculty', seed: seedFaculty },
  { type: 'staff', path: '/api/people/staff', seed: seedStaff },
  { type: 'parents', path: '/api/people/parents', seed: seedParent },
] as const;

ENTITY_PATHS.forEach(({ type, path, seed }) => {
  describe(`${type} photo endpoints`, () => {
    it(`200 happy: POST ${path}/:id/photo with valid JPEG`, { timeout: 30_000 }, async () => {
      const { collegeId, entityId } = await seed();
      const token = adminToken(collegeId);

      const res = await request(app)
        .post(`${path}/${entityId}/photo`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', JPEG_50, { filename: 'avatar.jpg', contentType: 'image/jpeg' })
        .expect(200);

      // Keys live under colleges/<cid>/<entityType>/<eid>/photo/...
      expect(res.body.original).toMatch(
        new RegExp(`colleges/${collegeId}/${type}/${entityId}/photo/original\\.jpg$`),
      );
      expect(res.body.thumb).toMatch(
        new RegExp(`colleges/${collegeId}/${type}/${entityId}/photo/thumb\\.jpg$`),
      );
      expect(res.body.contentType).toBe('image/jpeg');
      expect(res.body.sizeBytes).toBe(JPEG_50.length);
      expect(typeof res.body.uploadedAt).toBe('string');

      expect(putObjectMock).toHaveBeenCalledTimes(2);
    });

    it(`200 happy: GET ${path}/:id/photo-url returns presigned URL`, async () => {
      const { collegeId, entityId, personId } = await seed();
      const prefix = `colleges/${collegeId}/${type}/${entityId}`;
      await setExistingPhoto(personId, {
        original: `${prefix}/photo/original.jpg`,
        thumb: `${prefix}/photo/thumb.jpg`,
        contentType: 'image/jpeg',
        sizeBytes: 100,
        uploadedAt: new Date(),
      });
      const token = adminToken(collegeId);

      const res = await request(app)
        .get(`${path}/${entityId}/photo-url`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.thumb).toBeDefined();
      expect(res.body.original).toBeDefined();
      expect(typeof res.body.thumb.url).toBe('string');
      expect(typeof res.body.original.url).toBe('string');
      expect(getPresignedUrlMock).toHaveBeenCalledTimes(2);
    });

    it(`200 happy: DELETE ${path}/:id/photo clears the photo`, async () => {
      const { collegeId, entityId, personId } = await seed();
      const prefix = `colleges/${collegeId}/${type}/${entityId}`;
      await setExistingPhoto(personId, {
        original: `${prefix}/photo/original.jpg`,
        thumb: `${prefix}/photo/thumb.jpg`,
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        uploadedAt: new Date(),
      });
      const token = adminToken(collegeId);

      const res = await request(app)
        .delete(`${path}/${entityId}/photo`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ deleted: true });
      expect(deleteObjectMock).toHaveBeenCalledTimes(2);

      const updatedPerson = await Person.findById(personId).lean();
      expect(updatedPerson?.photo).toBeFalsy();
    });

    it(`404 cross-college: ${type} from another college returns 404`, async () => {
      const collegeA = String(oid());
      // Entity belongs to college B (its own random collegeId).
      const { entityId } = await seed();
      const token = adminToken(collegeA); // caller is from college A

      const res = await request(app)
        .delete(`${path}/${entityId}/photo`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      // photo-service.loadEntityScoped uses the entity-type slug verbatim
      // in the 404 message ("students not found", "faculty not found", …).
      expect(res.body.error).toMatch(new RegExp(`${type} not found`));
      expect(deleteObjectMock).not.toHaveBeenCalled();
    });
  });
});

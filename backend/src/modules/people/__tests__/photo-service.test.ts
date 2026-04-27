/**
 * P4 — Student photo upload orchestrator.
 *
 * Public surface tested:
 *   - uploadStudentPhoto(opts)
 *   - deleteStudentPhoto(collegeId, studentId)
 *   - getStudentPhotoUrls(collegeId, studentId, variant?)
 *
 * Strategy:
 *   - Real Mongo (in-memory) for Person/Student lookups & writes — multi-tenancy
 *     and 404/scoping checks must hit real schema validation.
 *   - Real `sharp` for image generation + EXIF/format detection. Sharp is fast
 *     enough on these tiny test buffers; mocking it would defeat the point of
 *     covering the actual format/dimension validation.
 *   - Mocked S3 client (`putObject`, `deleteObject`, `getPresignedUrl`) so we
 *     can assert call sites and orchestrate failure modes without LocalStack.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
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
import { AppError } from '../../../middleware/errorHandler';
import type { PersonEntityType } from '../../../shared/s3/s3-client';

// ─── S3 client mock ───────────────────────────────────────────────────
//
// We track every call so assertions can inspect keys, contentTypes, metadata,
// and the order putObject/deleteObject ran in.

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

// SUT loaded after the mock so the mocked module is what photo-service binds.
import {
  uploadStudentPhoto,
  deleteStudentPhoto,
  getStudentPhotoUrls,
  uploadEntityPhoto,
  deleteEntityPhoto,
  getEntityPhotoUrls,
  ALLOWED_IMAGE_MIMES,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_DIMENSION,
  THUMBNAIL_SIZE,
  PRESIGN_EXPIRY_SECONDS,
} from '../photo-service';

// ─── Fixture buffers (built once with real sharp) ─────────────────────

let JPEG_50: Buffer;       // 50×50 red JPEG
let PNG_50: Buffer;        // 50×50 blue PNG
let WEBP_50: Buffer;       // 50×50 green WebP
let JPEG_WITH_EXIF: Buffer; // 100×100 JPEG with EXIF orientation tag
let OVERSIZE_DIMS: Buffer;  // 8001×8001 PNG
let RANDOM_BYTES: Buffer;   // not an image at all

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

  WEBP_50 = await sharp({
    create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 255, b: 0 } },
  })
    .webp()
    .toBuffer();

  // 100×100 JPEG carrying an EXIF Orientation = 6 (rotate 90° CW). Used
  // to verify .rotate() autorotates and .withMetadata({ exif: {} }) strips.
  JPEG_WITH_EXIF = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();

  // 8001×8001 PNG to trigger dimension cap. Built compressed so it stays
  // small in memory despite the dimensions.
  OVERSIZE_DIMS = await sharp({
    create: { width: 8001, height: 8001, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();

  RANDOM_BYTES = Buffer.from('this is not an image, just plain text bytes');
});

afterAll(async () => {
  await teardownMongo();
});

afterEach(async () => {
  await clearCollections();
  putObjectMock.mockReset();
  deleteObjectMock.mockReset();
  getPresignedUrlMock.mockReset();
});

beforeEach(() => {
  // Sensible defaults — individual tests can override with mockImplementationOnce.
  putObjectMock.mockResolvedValue(undefined);
  deleteObjectMock.mockResolvedValue(undefined);
  getPresignedUrlMock.mockImplementation(async (key: string) => ({
    url: `https://signed.example/${encodeURIComponent(key)}`,
    expiresAt: new Date(Date.now() + 3600 * 1000),
  }));
});

// ─── Seed helpers ─────────────────────────────────────────────────────

const oid = () => new mongoose.Types.ObjectId();

async function seedStudent(overrides: { collegeId?: mongoose.Types.ObjectId } = {}) {
  const collegeId = overrides.collegeId ?? oid();
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
  return { collegeId: String(collegeId), person, student };
}

/**
 * Generic seed helper across the 4 person-linked entity types. Returns the
 * created entity row's id (always a Student/Faculty/Staff/Parent doc id —
 * NOT the Person id) plus the Person it points at, in a single shape so
 * tests can stay entity-type-agnostic.
 *
 * Each branch creates a new Person + a new entity row pointing to that
 * Person, both scoped to `collegeId`. Defaults stay minimal: only the
 * required-by-schema fields are populated.
 */
async function seedEntity(
  entityType: PersonEntityType,
  overrides: { collegeId?: mongoose.Types.ObjectId } = {},
): Promise<{
  collegeId: string;
  person: { _id: mongoose.Types.ObjectId };
  entityId: string;
}> {
  const collegeId = overrides.collegeId ?? oid();
  const person = await Person.create({
    collegeId,
    name: `Test ${entityType}`,
    phone: '9999999999',
  });

  switch (entityType) {
    case 'students': {
      const student = await Student.create({
        collegeId,
        personId: person._id,
        admissionYear: 2025,
        status: 'active',
      });
      return {
        collegeId: String(collegeId),
        person: { _id: person._id as mongoose.Types.ObjectId },
        entityId: String(student._id),
      };
    }
    case 'faculty': {
      const faculty = await Faculty.create({
        collegeId,
        personId: person._id,
        employeeCode: `FAC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        designation: 'Assistant Professor',
        contractType: 'regular',
        status: 'active',
      });
      return {
        collegeId: String(collegeId),
        person: { _id: person._id as mongoose.Types.ObjectId },
        entityId: String(faculty._id),
      };
    }
    case 'staff': {
      const staff = await Staff.create({
        collegeId,
        personId: person._id,
        employeeCode: `STF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        designation: 'Office Manager',
        staffType: 'admin',
        status: 'active',
      });
      return {
        collegeId: String(collegeId),
        person: { _id: person._id as mongoose.Types.ObjectId },
        entityId: String(staff._id),
      };
    }
    case 'parents': {
      const parent = await Parent.create({
        collegeId,
        personId: person._id,
        relationship: 'father',
        primaryContact: true,
      });
      return {
        collegeId: String(collegeId),
        person: { _id: person._id as mongoose.Types.ObjectId },
        entityId: String(parent._id),
      };
    }
  }
}

const ENTITY_TYPES: PersonEntityType[] = ['students', 'faculty', 'staff', 'parents'];

// ─── Constants exposed by the SUT ─────────────────────────────────────

describe('photo-service constants', () => {
  it('exports the expected MIME allowlist and limits', () => {
    expect(ALLOWED_IMAGE_MIMES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(PHOTO_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(PHOTO_MAX_DIMENSION).toBe(8000);
    expect(THUMBNAIL_SIZE).toBe(200);
    expect(PRESIGN_EXPIRY_SECONDS).toBe(3600);
  });
});

// ─── uploadStudentPhoto (happy paths) ─────────────────────────────────

describe('uploadStudentPhoto — happy paths', () => {
  it('JPEG: uploads original.jpg + thumb.jpg, updates Person.photo, returns result', async () => {
    const { collegeId, person, student } = await seedStudent();

    const result = await uploadStudentPhoto({
      collegeId,
      studentId: String(student._id),
      buffer: JPEG_50,
      declaredMime: 'image/jpeg',
    });

    const expectedPrefix = `colleges/${collegeId}/students/${String(student._id)}`;
    expect(result.original).toBe(`${expectedPrefix}/photo/original.jpg`);
    expect(result.thumb).toBe(`${expectedPrefix}/photo/thumb.jpg`);
    expect(result.contentType).toBe('image/jpeg');
    expect(result.sizeBytes).toBe(JPEG_50.length);
    expect(result.uploadedAt).toBeInstanceOf(Date);

    // Two S3 puts: original + thumb. Original first, thumb second.
    expect(putObjectMock).toHaveBeenCalledTimes(2);
    const firstCall = putObjectMock.mock.calls[0]![0] as {
      key: string;
      body: Buffer;
      contentType: string;
      metadata?: Record<string, string>;
    };
    expect(firstCall.key).toBe(result.original);
    expect(firstCall.contentType).toBe('image/jpeg');
    // Metadata keys reflect the generalized API; the student compat shim
    // forwards into uploadEntityPhoto with entityType='students'.
    expect(firstCall.metadata).toEqual({
      collegeId,
      entityId: String(student._id),
      entityType: 'students',
    });

    const secondCall = putObjectMock.mock.calls[1]![0] as {
      key: string;
      body: Buffer;
      contentType: string;
    };
    expect(secondCall.key).toBe(result.thumb);
    expect(secondCall.contentType).toBe('image/jpeg');

    // Thumb must be 200×200 after sharp processing.
    const thumbMeta = await sharp(secondCall.body).metadata();
    expect(thumbMeta.width).toBe(THUMBNAIL_SIZE);
    expect(thumbMeta.height).toBe(THUMBNAIL_SIZE);
    expect(thumbMeta.format).toBe('jpeg');

    // Person.photo persisted.
    const updatedPerson = await Person.findById(person._id).lean();
    expect(updatedPerson?.photo).toMatchObject({
      original: result.original,
      thumb: result.thumb,
      contentType: 'image/jpeg',
      sizeBytes: JPEG_50.length,
    });
    expect(updatedPerson?.photo?.uploadedAt).toBeInstanceOf(Date);
  });

  it('PNG: produces original.png + thumb.jpg', async () => {
    const { collegeId, student } = await seedStudent();

    const result = await uploadStudentPhoto({
      collegeId,
      studentId: String(student._id),
      buffer: PNG_50,
    });

    const prefix = `colleges/${collegeId}/students/${String(student._id)}`;
    expect(result.original).toBe(`${prefix}/photo/original.png`);
    expect(result.thumb).toBe(`${prefix}/photo/thumb.jpg`);
    expect(result.contentType).toBe('image/png');

    const firstCall = putObjectMock.mock.calls[0]![0] as { contentType: string };
    expect(firstCall.contentType).toBe('image/png');
  });

  it('WebP: produces original.webp + thumb.jpg', async () => {
    const { collegeId, student } = await seedStudent();

    const result = await uploadStudentPhoto({
      collegeId,
      studentId: String(student._id),
      buffer: WEBP_50,
    });

    const prefix = `colleges/${collegeId}/students/${String(student._id)}`;
    expect(result.original).toBe(`${prefix}/photo/original.webp`);
    expect(result.thumb).toBe(`${prefix}/photo/thumb.jpg`);
    expect(result.contentType).toBe('image/webp');

    const firstCall = putObjectMock.mock.calls[0]![0] as { contentType: string };
    expect(firstCall.contentType).toBe('image/webp');
  });
});

// ─── uploadStudentPhoto (validation / errors) ─────────────────────────

describe('uploadStudentPhoto — validation', () => {
  it('rejects unsupported image format (GIF) with AppError(400)', async () => {
    const { collegeId, student } = await seedStudent();

    // GIF: minimal valid GIF89a header.
    const gif = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
      0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
    ]);

    let caught: unknown;
    try {
      await uploadStudentPhoto({
        collegeId,
        studentId: String(student._id),
        buffer: gif,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(400);
    expect((caught as AppError).message).toMatch(/Unsupported image format/);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('rejects oversize dimensions (8001×8001) with AppError(400)', async () => {
    const { collegeId, student } = await seedStudent();

    let caught: unknown;
    try {
      await uploadStudentPhoto({
        collegeId,
        studentId: String(student._id),
        buffer: OVERSIZE_DIMS,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(400);
    expect((caught as AppError).message).toMatch(/Image too large/);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('rejects oversize buffer (>5 MB) with AppError(400)', async () => {
    const { collegeId, student } = await seedStudent();

    // Build a real JPEG of well-under-cap dimensions but pad the buffer
    // out past PHOTO_MAX_BYTES via concatenation. Sharp metadata only
    // reads the header bytes so the format is still detected.
    const oversize = Buffer.concat([JPEG_50, Buffer.alloc(PHOTO_MAX_BYTES + 1)]);

    let caught: unknown;
    try {
      await uploadStudentPhoto({
        collegeId,
        studentId: String(student._id),
        buffer: oversize,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(400);
    expect((caught as AppError).message).toMatch(/File too large/);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('rejects non-image bytes with AppError(400)', async () => {
    const { collegeId, student } = await seedStudent();

    let caught: unknown;
    try {
      await uploadStudentPhoto({
        collegeId,
        studentId: String(student._id),
        buffer: RANDOM_BYTES,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('cross-college: studentId from different college → 404', async () => {
    const collegeA = oid();
    const collegeB = oid();

    // Student belongs to college B.
    const personB = await Person.create({
      collegeId: collegeB,
      name: 'B Student',
      phone: '1111111111',
    });
    const studentB = await Student.create({
      collegeId: collegeB,
      personId: personB._id,
      admissionYear: 2025,
      status: 'active',
    });

    let caught: unknown;
    try {
      await uploadStudentPhoto({
        collegeId: String(collegeA), // wrong tenant
        studentId: String(studentB._id),
        buffer: JPEG_50,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(404);
    // Generalized error: "<entityType> not found" — for the student compat
    // shim entityType = 'students'.
    expect((caught as AppError).message).toMatch(/students not found/);

    // Person.photo on the cross-college student must remain untouched.
    const personAfter = await Person.findById(personB._id).lean();
    expect(personAfter?.photo).toBeFalsy();
    expect(putObjectMock).not.toHaveBeenCalled();
  });
});

// ─── uploadStudentPhoto (resilience) ──────────────────────────────────

describe('uploadStudentPhoto — resilience', () => {
  it('best-effort deletes the original when the thumb upload fails', async () => {
    const { collegeId, student } = await seedStudent();

    // First put (original) succeeds. Second put (thumb) blows up.
    putObjectMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('thumb upload exploded'));

    let caught: unknown;
    try {
      await uploadStudentPhoto({
        collegeId,
        studentId: String(student._id),
        buffer: JPEG_50,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);

    // Best-effort cleanup of the original.
    expect(deleteObjectMock).toHaveBeenCalledTimes(1);
    expect(deleteObjectMock.mock.calls[0]![0]).toMatch(/photo\/original\.jpg$/);

    // Person.photo not persisted on failure.
    const updatedPerson = await Person.findById(student.personId).lean();
    expect(updatedPerson?.photo).toBeFalsy();
  });

  it('Person update failure → both S3 objects best-effort-deleted', async () => {
    const { collegeId, student } = await seedStudent();

    // Force Person.findOneAndUpdate to throw via mongoose spy.
    const updateSpy = vi.spyOn(Person, 'findOneAndUpdate').mockImplementationOnce(
      () => {
        throw new Error('mongo write blew up');
      },
    );

    let caught: unknown;
    try {
      await uploadStudentPhoto({
        collegeId,
        studentId: String(student._id),
        buffer: JPEG_50,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(500);
    expect((caught as AppError).message).toMatch(/Failed to persist photo metadata/);

    // Both S3 keys should have been deletion-attempted.
    expect(deleteObjectMock).toHaveBeenCalledTimes(2);
    const deletedKeys = deleteObjectMock.mock.calls.map((c) => c[0]);
    expect(deletedKeys).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/photo\/original\.jpg$/),
        expect.stringMatching(/photo\/thumb\.jpg$/),
      ]),
    );

    updateSpy.mockRestore();
  });

  it('replace flow: previous PNG photo gets old keys cleaned up after JPG re-upload', async () => {
    const { collegeId, person, student } = await seedStudent();
    const studentIdStr = String(student._id);
    const oldPrefix = `colleges/${collegeId}/students/${studentIdStr}`;

    // Pre-existing photo metadata (PNG).
    await Person.updateOne(
      { _id: person._id },
      {
        $set: {
          photo: {
            original: `${oldPrefix}/photo/original.png`,
            thumb: `${oldPrefix}/photo/thumb.jpg`,
            contentType: 'image/png',
            sizeBytes: 1234,
            uploadedAt: new Date('2026-01-01'),
          },
        },
      },
    );

    // New upload is JPEG → original key extension flips from .png to .jpg,
    // so the OLD original.png must be cleaned up. The thumb key is the
    // same on both flows (.jpg), so it should NOT be deleted.
    const result = await uploadStudentPhoto({
      collegeId,
      studentId: studentIdStr,
      buffer: JPEG_50,
    });

    expect(result.original).toBe(`${oldPrefix}/photo/original.jpg`);
    expect(result.thumb).toBe(`${oldPrefix}/photo/thumb.jpg`);

    // Two new puts.
    expect(putObjectMock).toHaveBeenCalledTimes(2);

    // Old keys cleaned up: only the .png original differs from new keys.
    const deletedKeys = deleteObjectMock.mock.calls.map((c) => c[0]);
    expect(deletedKeys).toContain(`${oldPrefix}/photo/original.png`);
    // thumb key is identical between old and new — must NOT be deleted.
    expect(deletedKeys).not.toContain(`${oldPrefix}/photo/thumb.jpg`);

    // Person.photo reflects new state.
    const updatedPerson = await Person.findById(person._id).lean();
    expect(updatedPerson?.photo?.original).toBe(result.original);
    expect(updatedPerson?.photo?.contentType).toBe('image/jpeg');
  });
});

// ─── deleteStudentPhoto ───────────────────────────────────────────────

describe('deleteStudentPhoto', () => {
  it('happy path: deletes both S3 objects and sets Person.photo to null', async () => {
    const { collegeId, person, student } = await seedStudent();
    const prefix = `colleges/${collegeId}/students/${String(student._id)}`;

    await Person.updateOne(
      { _id: person._id },
      {
        $set: {
          photo: {
            original: `${prefix}/photo/original.jpg`,
            thumb: `${prefix}/photo/thumb.jpg`,
            contentType: 'image/jpeg',
            sizeBytes: 1024,
            uploadedAt: new Date(),
          },
        },
      },
    );

    await deleteStudentPhoto(collegeId, String(student._id));

    expect(deleteObjectMock).toHaveBeenCalledTimes(2);
    const keys = deleteObjectMock.mock.calls.map((c) => c[0]);
    expect(keys).toEqual(
      expect.arrayContaining([
        `${prefix}/photo/original.jpg`,
        `${prefix}/photo/thumb.jpg`,
      ]),
    );

    const updatedPerson = await Person.findById(person._id).lean();
    expect(updatedPerson?.photo).toBeFalsy();
  });

  it('idempotent when there is no photo: no S3 calls, success', async () => {
    const { collegeId, student } = await seedStudent();

    await expect(
      deleteStudentPhoto(collegeId, String(student._id)),
    ).resolves.toBeUndefined();
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it('cross-college: deleting via wrong collegeId → 404', async () => {
    const collegeA = oid();
    const { student } = await seedStudent(); // belongs to a different college

    let caught: unknown;
    try {
      await deleteStudentPhoto(String(collegeA), String(student._id));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(404);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});

// ─── getStudentPhotoUrls ──────────────────────────────────────────────

describe('getStudentPhotoUrls', () => {
  async function seedStudentWithPhoto() {
    const { collegeId, person, student } = await seedStudent();
    const prefix = `colleges/${collegeId}/students/${String(student._id)}`;
    const photo = {
      original: `${prefix}/photo/original.jpg`,
      thumb: `${prefix}/photo/thumb.jpg`,
      contentType: 'image/jpeg' as const,
      sizeBytes: 100,
      uploadedAt: new Date(),
    };
    await Person.updateOne({ _id: person._id }, { $set: { photo } });
    return { collegeId, studentId: String(student._id), photo };
  }

  it('variant=thumb: returns only the thumb URL', async () => {
    const { collegeId, studentId, photo } = await seedStudentWithPhoto();

    const urls = await getStudentPhotoUrls(collegeId, studentId, 'thumb');
    expect(urls.thumb).toBeDefined();
    expect(urls.original).toBeUndefined();
    expect(urls.thumb!.url).toMatch(/^https:\/\/signed\.example\//);
    expect(urls.thumb!.expiresAt).toBeInstanceOf(Date);

    // Presign called once with the thumb key + expiry option.
    expect(getPresignedUrlMock).toHaveBeenCalledTimes(1);
    expect(getPresignedUrlMock.mock.calls[0]![0]).toBe(photo.thumb);
    expect(getPresignedUrlMock.mock.calls[0]![1]).toMatchObject({
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });
  });

  it('variant=original: returns only the original URL', async () => {
    const { collegeId, studentId, photo } = await seedStudentWithPhoto();

    const urls = await getStudentPhotoUrls(collegeId, studentId, 'original');
    expect(urls.original).toBeDefined();
    expect(urls.thumb).toBeUndefined();

    expect(getPresignedUrlMock).toHaveBeenCalledTimes(1);
    expect(getPresignedUrlMock.mock.calls[0]![0]).toBe(photo.original);
  });

  it('variant=both (default): returns both URLs', async () => {
    const { collegeId, studentId, photo } = await seedStudentWithPhoto();

    const urls = await getStudentPhotoUrls(collegeId, studentId);
    expect(urls.original).toBeDefined();
    expect(urls.thumb).toBeDefined();

    expect(getPresignedUrlMock).toHaveBeenCalledTimes(2);
    const presignedKeys = getPresignedUrlMock.mock.calls.map((c) => c[0]);
    expect(presignedKeys).toEqual(
      expect.arrayContaining([photo.original, photo.thumb]),
    );
  });

  it('returns {} (NOT 404) when the student has no photo', async () => {
    const { collegeId, student } = await seedStudent();

    const urls = await getStudentPhotoUrls(collegeId, String(student._id));
    expect(urls).toEqual({});
    expect(getPresignedUrlMock).not.toHaveBeenCalled();
  });

  it('cross-college: 404 when the studentId belongs to another college', async () => {
    const collegeA = oid();
    const { student } = await seedStudent();

    let caught: unknown;
    try {
      await getStudentPhotoUrls(String(collegeA), String(student._id));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(404);
    expect(getPresignedUrlMock).not.toHaveBeenCalled();
  });
});

// ─── EXIF stripping (smoke) ───────────────────────────────────────────

describe('uploadStudentPhoto — EXIF handling', () => {
  it('strips EXIF on the generated thumbnail (orientation tag does not survive)', async () => {
    const { collegeId, student } = await seedStudent();

    await uploadStudentPhoto({
      collegeId,
      studentId: String(student._id),
      buffer: JPEG_WITH_EXIF,
    });

    // Inspect the actual buffer the mock received for the thumb upload.
    const thumbCall = putObjectMock.mock.calls[1]![0] as { body: Buffer };
    const thumbMeta = await sharp(thumbCall.body).metadata();
    // `withMetadata({ exif: {} })` should yield an EXIF-less or
    // orientation-cleared output. Sharp's autorotate also bakes any rotation
    // into pixels so a stale orientation tag would be misleading.
    // Acceptable outcomes: orientation undefined/0/1, NOT 6.
    expect(thumbMeta.orientation === undefined || thumbMeta.orientation === 1).toBe(true);
  });
});

// ─── uploadEntityPhoto — parameterized over all 4 person-linked types ──
//
// Validation, EXIF handling, sharp behavior, replace-flow, etc. are
// entity-type-agnostic — the path the bytes travel from buffer to S3 is
// the same regardless of which row was the lookup hop. So we only run
// the entity-shaped assertions through the parameterized matrix:
//   - happy path (S3 keys carry the right entity slug; Person.photo updated)
//   - cross-college guard
//   - delete + presign happy paths
// 12 net new tests (3 per entity × 4 entities).

ENTITY_TYPES.forEach((entityType) => {
  describe(`uploadEntityPhoto — ${entityType}`, () => {
    it('happy path: uploads original + thumb under the right prefix and updates Person.photo', async () => {
      const { collegeId, person, entityId } = await seedEntity(entityType);

      const result = await uploadEntityPhoto({
        entityType,
        collegeId,
        entityId,
        buffer: JPEG_50,
        declaredMime: 'image/jpeg',
      });

      const expectedPrefix = `colleges/${collegeId}/${entityType}/${entityId}`;
      expect(result.original).toBe(`${expectedPrefix}/photo/original.jpg`);
      expect(result.thumb).toBe(`${expectedPrefix}/photo/thumb.jpg`);
      expect(result.contentType).toBe('image/jpeg');

      // Two S3 puts under the entity's prefix.
      expect(putObjectMock).toHaveBeenCalledTimes(2);
      const firstCall = putObjectMock.mock.calls[0]![0] as {
        key: string;
        contentType: string;
        metadata?: Record<string, string>;
      };
      expect(firstCall.key).toBe(result.original);
      // Metadata threads the entity context for forensic traceability.
      expect(firstCall.metadata).toMatchObject({ collegeId, entityId, entityType });

      // Person.photo persisted (Person is the storage location; entity is
      // just the lookup hop).
      const updatedPerson = await Person.findById(person._id).lean();
      expect(updatedPerson?.photo).toMatchObject({
        original: result.original,
        thumb: result.thumb,
        contentType: 'image/jpeg',
      });
    });

    it(`rejects when the ${entityType} row belongs to a different college`, async () => {
      const collegeA = oid();
      // Seed under a fresh college; we'll then call with `collegeA`.
      const { entityId } = await seedEntity(entityType);

      let caught: unknown;
      try {
        await uploadEntityPhoto({
          entityType,
          collegeId: String(collegeA),
          entityId,
          buffer: JPEG_50,
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AppError);
      expect((caught as AppError).statusCode).toBe(404);
      expect(putObjectMock).not.toHaveBeenCalled();
    });

    it(`deleteEntityPhoto + getEntityPhotoUrls work end-to-end for ${entityType}`, async () => {
      const { collegeId, person, entityId } = await seedEntity(entityType);
      const prefix = `colleges/${collegeId}/${entityType}/${entityId}`;

      // Pre-populate Person.photo so delete + presign have something to act on.
      await Person.updateOne(
        { _id: person._id },
        {
          $set: {
            photo: {
              original: `${prefix}/photo/original.jpg`,
              thumb: `${prefix}/photo/thumb.jpg`,
              contentType: 'image/jpeg',
              sizeBytes: 100,
              uploadedAt: new Date(),
            },
          },
        },
      );

      // Presign both variants.
      const urls = await getEntityPhotoUrls(entityType, collegeId, entityId);
      expect(urls.original).toBeDefined();
      expect(urls.thumb).toBeDefined();
      expect(getPresignedUrlMock).toHaveBeenCalledTimes(2);

      // Delete: both S3 keys removed and Person.photo cleared.
      await deleteEntityPhoto(entityType, collegeId, entityId);
      expect(deleteObjectMock).toHaveBeenCalledTimes(2);
      const deletedKeys = deleteObjectMock.mock.calls.map((c) => c[0]);
      expect(deletedKeys).toEqual(
        expect.arrayContaining([
          `${prefix}/photo/original.jpg`,
          `${prefix}/photo/thumb.jpg`,
        ]),
      );

      const after = await Person.findById(person._id).lean();
      expect(after?.photo).toBeFalsy();
    });
  });
});

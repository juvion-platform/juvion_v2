import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { Person } from '../Person';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

/**
 * Schema contract for Person.photo after the structured-photo extension.
 *
 * Replaces the prior flat `photo: String` field with a nested object that
 * captures the original + thumbnail S3 keys plus upload metadata. The whole
 * `photo` field is optional, but when present every nested field is required
 * and `contentType` is constrained to a small enum.
 */

type PhotoOverrides = Partial<{
  original: string;
  thumb: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date;
}>;

function basePerson(overrides: Record<string, unknown> = {}) {
  return {
    collegeId: new mongoose.Types.ObjectId(),
    name: 'Test Person',
    phone: '9999999999',
    ...overrides,
  };
}

function validPhoto(overrides: PhotoOverrides = {}) {
  return {
    original: 'colleges/cid1/students/sid1/photo/original.jpg',
    thumb: 'colleges/cid1/students/sid1/photo/thumb.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 102400,
    uploadedAt: new Date('2026-04-27T10:00:00Z'),
    ...overrides,
  };
}

describe('Person schema — structured photo field', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  describe('optionality', () => {
    it('validates a Person with `photo` omitted entirely', async () => {
      const doc = await Person.create(basePerson());
      const reloaded = await Person.findById(doc._id).lean();
      expect(reloaded).not.toBeNull();
      expect(reloaded?.photo == null).toBe(true);
    });

    it('validates a Person with `photo: null`', async () => {
      const doc = await Person.create(basePerson({ photo: null }));
      const reloaded = await Person.findById(doc._id).lean();
      expect(reloaded).not.toBeNull();
      expect(reloaded?.photo == null).toBe(true);
    });
  });

  describe('valid object shape', () => {
    it('persists a full valid photo object and round-trips all fields', async () => {
      const photo = validPhoto();
      const doc = await Person.create(basePerson({ photo }));
      const reloaded = await Person.findById(doc._id).lean();

      expect(reloaded?.photo).toBeDefined();
      expect(reloaded?.photo?.original).toBe(photo.original);
      expect(reloaded?.photo?.thumb).toBe(photo.thumb);
      expect(reloaded?.photo?.contentType).toBe(photo.contentType);
      expect(reloaded?.photo?.sizeBytes).toBe(photo.sizeBytes);
      expect(reloaded?.photo?.uploadedAt?.toISOString()).toBe(
        photo.uploadedAt.toISOString(),
      );
    });

    it.each(['image/jpeg', 'image/png', 'image/webp'] as const)(
      'accepts contentType=%s',
      async (contentType) => {
        const photo = validPhoto({ contentType });
        const doc = await Person.create(basePerson({ photo }));
        const reloaded = await Person.findById(doc._id).lean();
        expect(reloaded?.photo?.contentType).toBe(contentType);
      },
    );
  });

  describe('rejection of incomplete or invalid photo objects', () => {
    it('rejects when photo is provided but `original` is missing', async () => {
      const { original: _omit, ...rest } = validPhoto();
      void _omit;
      await expect(
        Person.create(basePerson({ photo: rest })),
      ).rejects.toThrow();
    });

    it('rejects when photo is provided but `thumb` is missing', async () => {
      const { thumb: _omit, ...rest } = validPhoto();
      void _omit;
      await expect(
        Person.create(basePerson({ photo: rest })),
      ).rejects.toThrow();
    });

    it('rejects when photo is provided but `contentType` is missing', async () => {
      const { contentType: _omit, ...rest } = validPhoto();
      void _omit;
      await expect(
        Person.create(basePerson({ photo: rest })),
      ).rejects.toThrow();
    });

    it('rejects when photo is provided but `sizeBytes` is missing', async () => {
      const { sizeBytes: _omit, ...rest } = validPhoto();
      void _omit;
      await expect(
        Person.create(basePerson({ photo: rest })),
      ).rejects.toThrow();
    });

    it('rejects when photo is provided but `uploadedAt` is missing', async () => {
      const { uploadedAt: _omit, ...rest } = validPhoto();
      void _omit;
      await expect(
        Person.create(basePerson({ photo: rest })),
      ).rejects.toThrow();
    });

    it("rejects when contentType is outside the enum (e.g. 'image/gif')", async () => {
      const photo = validPhoto({ contentType: 'image/gif' });
      await expect(
        Person.create(basePerson({ photo })),
      ).rejects.toThrow();
    });

    it('rejects when sizeBytes is negative', async () => {
      const photo = validPhoto({ sizeBytes: -1 });
      await expect(
        Person.create(basePerson({ photo })),
      ).rejects.toThrow();
    });
  });

  describe('mutation flow', () => {
    it('accepts re-write — set photo to A, then to B; final read shows B', async () => {
      const photoA = validPhoto({
        original: 'colleges/cid1/students/sid1/photo/original-A.jpg',
        thumb: 'colleges/cid1/students/sid1/photo/thumb-A.jpg',
        sizeBytes: 1000,
      });
      const photoB = validPhoto({
        original: 'colleges/cid1/students/sid1/photo/original-B.png',
        thumb: 'colleges/cid1/students/sid1/photo/thumb-B.png',
        contentType: 'image/png',
        sizeBytes: 2048,
        uploadedAt: new Date('2026-04-28T11:00:00Z'),
      });

      const doc = await Person.create(basePerson({ photo: photoA }));
      doc.set('photo', photoB);
      await doc.save();

      const reloaded = await Person.findById(doc._id).lean();
      expect(reloaded?.photo?.original).toBe(photoB.original);
      expect(reloaded?.photo?.thumb).toBe(photoB.thumb);
      expect(reloaded?.photo?.contentType).toBe('image/png');
      expect(reloaded?.photo?.sizeBytes).toBe(2048);
      expect(reloaded?.photo?.uploadedAt?.toISOString()).toBe(
        photoB.uploadedAt.toISOString(),
      );
    });

    it('can clear photo by setting it to null after a previous valid object', async () => {
      const photo = validPhoto();
      const doc = await Person.create(basePerson({ photo }));
      // sanity: photo is set
      let reloaded = await Person.findById(doc._id).lean();
      expect(reloaded?.photo?.original).toBe(photo.original);

      doc.set('photo', null);
      await doc.save();

      reloaded = await Person.findById(doc._id).lean();
      expect(reloaded?.photo == null).toBe(true);
    });

    it('does not persist any photo subfields when photo is omitted', async () => {
      const doc = await Person.create(basePerson());
      const raw = await Person.collection.findOne({ _id: doc._id });
      expect(raw).not.toBeNull();
      // The Mongoose schema must not auto-create a sub-document when
      // photo was never provided. (No empty `{}` should appear.)
      expect(raw?.photo == null).toBe(true);
    });
  });
});

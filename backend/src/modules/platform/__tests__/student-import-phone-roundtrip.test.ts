/**
 * Phone normalisation, proved end-to-end through the real engine.
 *
 * `validPhone`'s unit tests show that eight paste formats all reduce to the
 * same ten digits, but that alone does not prove the property that matters:
 * that a student imported with one format is RECOGNISED when re-imported with
 * another. Phone is an exact-equality natural key —
 * `matchExistingStudent`'s phone+admissionYear fallback and
 * `linkOrCreateParent`/`parentExistsByPhone` all compare it directly — so the
 * normalisation only pays off if the stored value and the incoming value are
 * canonicalised identically. That is a property of the whole pipeline
 * (validators → hook → commit), not of the validator, so it is tested here
 * against `uploadAndValidate` / `commitImportJob` with the genuine `student`
 * schema rather than a fixture.
 *
 * The regression this guards against is silent duplication: without
 * normalisation, re-importing "+91 98765-43210" after "9876543210" previews as
 * Create and produces a second student for the same person.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { uploadAndValidate, commitImportJob } from '../bulk-import-service';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { Programme } from '../../../models/academic-structure/Programme';
import { Student } from '../../../models/people/Student';
import { Person } from '../../../models/people/Person';
import { Parent } from '../../../models/people/Parent';

vi.mock('../../../shared/s3/s3-client', () => ({
  isS3Configured: vi.fn().mockReturnValue(true),
  putObject: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue({ url: 'https://example.test/mock', expiresAt: new Date() }),
}));

// See bulk-import-duplicate-keys.test.ts: each of these files stands up its
// own mongodb-memory-server, and under the full parallel suite that contention
// pushes the first test past the 5s default. Harness timing, not slowness.
vi.setConfig({ testTimeout: 20_000 });

const oid = () => new mongoose.Types.ObjectId();
let collegeId: string;

const HEADER = 'name*,phone*,programmeCode*,admissionYear*';

async function previewCsv(rows: string[]) {
  return uploadAndValidate({
    collegeId,
    performedBy: 'tester',
    entityType: 'student',
    fileBuffer: Buffer.from([HEADER, ...rows].join('\n')),
    fileName: 'students.csv',
    declaredMime: 'text/csv',
  });
}

async function importCsv(rows: string[]) {
  const preview = await previewCsv(rows);
  return commitImportJob(collegeId, String(preview.job._id), 'tester');
}

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

beforeEach(async () => {
  collegeId = String(oid());
  const regulationId = oid();
  await Regulation.create({
    _id: regulationId, collegeId, code: 'R20', name: 'R20',
    effectiveFromYear: 2020, totalCredits: 160, maxYears: 4,
  });
  await Programme.create({
    collegeId, code: 'BTCSE', name: 'BTech CSE', level: 'UG',
    durationYears: 4, regulationId,
  });
});

describe('student import — a phone is the same key whatever format it arrives in', () => {
  it('stores the canonical form, not what was typed', async () => {
    await importCsv(['Aarav Sharma,+91 98765-43210,BTCSE,2025']);

    const person = await Person.findOne({ collegeId });
    expect(person!.phone).toBe('9876543210');
  });

  it.each([
    ['spaced', '98765 43210'],
    ['hyphenated', '98765-43210'],
    ['+91 prefixed', '+91 9876543210'],
    ['leading trunk 0', '09876543210'],
  ])('re-importing the same student as %s updates rather than duplicating', async (_label, reformatted) => {
    const first = await importCsv(['Aarav Sharma,9876543210,BTCSE,2025']);
    expect(first.successCount).toBe(1);

    // Same person, same admission year, different paste format, and
    // deliberately no rollNumber or aadhaar — so the phone+admissionYear
    // fallback is the ONLY key that can match. Without normalisation this
    // previews as Create.
    const preview = await previewCsv([`Aarav Sharma,${reformatted},BTCSE,2025`]);
    expect(preview.actionCounts).toMatchObject({ create: 0, update: 1, blocked: 0 });
    expect(preview.errorCount).toBe(0);

    const second = await commitImportJob(collegeId, String(preview.job._id), 'tester');
    expect(second.successCount).toBe(1);

    // The whole point: one student, one Person — not two.
    expect(await Student.countDocuments({ collegeId })).toBe(1);
    expect(await Person.countDocuments({ collegeId })).toBe(1);
  });

  it('matches a guardian across formats instead of creating a second one', async () => {
    const withGuardian = `${HEADER},primaryParentPhone,primaryParentName`;
    const commitRows = async (row: string) => {
      const preview = await uploadAndValidate({
        collegeId,
        performedBy: 'tester',
        entityType: 'student',
        fileBuffer: Buffer.from([withGuardian, row].join('\n')),
        fileName: 'students.csv',
        declaredMime: 'text/csv',
      });
      return commitImportJob(collegeId, String(preview.job._id), 'tester');
    };

    await commitRows('Aarav Sharma,9876500001,BTCSE,2025,9812300099,Ramesh Sharma');
    // A sibling, so a NEW student, but the SAME guardian written differently.
    await commitRows('Ananya Sharma,9876500002,BTCSE,2025,+91 98123-00099,Ramesh Sharma');

    expect(await Student.countDocuments({ collegeId })).toBe(2);
    // One guardian shared by both siblings, not one per format.
    expect(await Parent.countDocuments({ collegeId })).toBe(1);
  });

  it('reports that no guardian will be created when preview sees a reformatted existing one', async () => {
    const withGuardian = `${HEADER},primaryParentPhone,primaryParentName`;
    const first = await uploadAndValidate({
      collegeId,
      performedBy: 'tester',
      entityType: 'student',
      fileBuffer: Buffer.from([withGuardian, 'Aarav Sharma,9876500001,BTCSE,2025,9812300099,Ramesh'].join('\n')),
      fileName: 'students.csv',
      declaredMime: 'text/csv',
    });
    expect(first.sideEffectTotals.guardians).toBe(1);
    await commitImportJob(collegeId, String(first.job._id), 'tester');

    // Preview must agree with commit: the guardian now exists, so a row
    // naming the same number in another format creates nothing.
    const second = await uploadAndValidate({
      collegeId,
      performedBy: 'tester',
      entityType: 'student',
      fileBuffer: Buffer.from([withGuardian, 'Ananya Sharma,9876500002,BTCSE,2025,+91 98123 00099,Ramesh'].join('\n')),
      fileName: 'students.csv',
      declaredMime: 'text/csv',
    });
    expect(second.sideEffectTotals.guardians ?? 0).toBe(0);
  });
});

import { describe, it, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { uploadAndValidate, commitImportJob } from '../bulk-import-service';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { Programme } from '../../../models/academic-structure/Programme';
import { Student } from '../../../models/people/Student';
import { Person } from '../../../models/people/Person';
import { Parent } from '../../../models/people/Parent';

vi.mock('../../../shared/s3/s3-client', () => ({
  isS3Configured: vi.fn().mockReturnValue(false),
  putObject: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue({ url: 'x', expiresAt: new Date() }),
}));
vi.mock('../../../workers/fee-commitment.worker', () => ({
  enqueueFeeCommitmentJob: vi.fn().mockResolvedValue({ id: 'mock' }),
}));
vi.setConfig({ testTimeout: 60_000 });

const oid = () => new mongoose.Types.ObjectId();
let collegeId: string;
const HEADER = 'name*,phone*,programmeCode*,admissionYear*,primaryParentPhone,primaryParentName';

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
    collegeId, code: 'BTCSE', name: 'BTech CSE', level: 'UG', durationYears: 4, regulationId,
  });
});

describe('diag', () => {
  it('dumps both jobs', async () => {
    const run = async (row: string) => {
      const p = await uploadAndValidate({
        collegeId, performedBy: 'tester', entityType: 'student',
        fileBuffer: Buffer.from([HEADER, row].join('\n')),
        fileName: 's.csv', declaredMime: 'text/csv',
      });
      // eslint-disable-next-line no-console
      console.log('PREVIEW', JSON.stringify({
        actionCounts: p.actionCounts, errorCount: p.errorCount,
        rows: p.previewRows.map((r) => ({ valid: r.valid, action: r.action, errors: r.errors, notes: r.notes })),
      }));
      const j = await commitImportJob(collegeId, String(p.job._id), 'tester');
      // eslint-disable-next-line no-console
      console.log('COMMIT', JSON.stringify({
        status: j.status, ok: j.successCount, fail: j.failureCount, blocked: j.blockedCount,
        results: j.results.map((r) => ({ outcome: r.outcome, error: r.error })),
      }));
    };

    await run('Aarav Sharma,9876500001,BTCSE,2025,9812300099,Ramesh Sharma');
    await run('Ananya Sharma,9876500002,BTCSE,2025,+91 98123-00099,Ramesh Sharma');

    // eslint-disable-next-line no-console
    console.log('STUDENTS', await Student.countDocuments({ collegeId }));
    // eslint-disable-next-line no-console
    console.log('PEOPLE', JSON.stringify(
      (await Person.find({ collegeId }).lean()).map((p) => ({ n: p.name, ph: p.phone })),
    ));
    // eslint-disable-next-line no-console
    console.log('PARENTS', await Parent.countDocuments({ collegeId }));
  });
});

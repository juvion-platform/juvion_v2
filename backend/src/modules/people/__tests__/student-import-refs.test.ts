import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { Programme } from '../../../models/academic-structure/Programme';
import { Branch } from '../../../models/academic-structure/Branch';
import { Batch } from '../../../models/academic-structure/Batch';
import { Regulation } from '../../../models/academic-structure/Regulation';
import { FeeQuota } from '../../../models/finance/FeeQuota';
import { FeeCategory } from '../../../models/finance/FeeCategory';
import { resolveStudentRefs, validateCatalogCodes } from '../student-import-refs';

const oid = () => new mongoose.Types.ObjectId();
let collegeId: string;
let programmeId: mongoose.Types.ObjectId;
let regulationId: mongoose.Types.ObjectId;

beforeAll(async () => { await setupMongo(); }, 60_000);
afterAll(async () => { await teardownMongo(); });
afterEach(async () => { await clearCollections(); });

async function seed() {
  collegeId = String(oid());
  regulationId = oid();
  programmeId = oid();
  await Regulation.create({
    _id: regulationId, collegeId, code: 'R20', name: 'R20', effectiveFromYear: 2020,
    totalCredits: 160, maxYears: 6,
  });
  await Programme.create({ _id: programmeId, collegeId, code: 'BTCSE', name: 'BTech CSE', level: 'UG', durationYears: 4, regulationId });
  await Branch.create({ collegeId, code: 'CSE', name: 'Computer Science', programmeId, departmentId: oid(), intake: 60 });
  await Batch.create({ collegeId, code: 'B2025', name: '2025 Batch', admissionYear: 2025, programmeId, regulationId });
  await FeeQuota.create({ collegeId, code: 'convener', name: 'Convener', status: 'active' });
  await FeeCategory.create({ collegeId, code: 'OC', name: 'OC', status: 'active' });
}

describe('resolveStudentRefs', () => {
  it('resolves every supplied code to an id', async () => {
    await seed();
    const res = await resolveStudentRefs(collegeId, {
      programmeCode: 'BTCSE', branchCode: 'CSE', batchCode: 'B2025', regulationCode: 'R20',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.programmeId).toBe(String(programmeId));
      expect(res.value.branchId).toBeDefined();
      expect(res.value.batchId).toBeDefined();
      expect(res.value.regulationId).toBe(String(regulationId));
      // Names are carried so preview can echo the resolution back to the operator.
      expect(res.value.programmeName).toBe('BTech CSE');
      expect(res.value.branchName).toBe('Computer Science');
    }
  });

  it('names the offending code when a programme is unknown', async () => {
    await seed();
    const res = await resolveStudentRefs(collegeId, { programmeCode: 'NOPE' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unknown programme code "NOPE"');
  });

  it('rejects a code that exists in another college', async () => {
    await seed();
    const other = String(oid());
    const res = await resolveStudentRefs(other, { programmeCode: 'BTCSE' });
    expect(res.ok).toBe(false);
  });

  it('leaves optional refs undefined when their column is blank', async () => {
    await seed();
    const res = await resolveStudentRefs(collegeId, { programmeCode: 'BTCSE' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.branchId).toBeUndefined();
      expect(res.value.batchId).toBeUndefined();
    }
  });
});

describe('validateCatalogCodes', () => {
  it('accepts active quota and category codes', async () => {
    await seed();
    expect((await validateCatalogCodes(collegeId, { quota: 'convener', category: 'OC' })).ok).toBe(true);
  });

  it('rejects an unknown quota with a specific message', async () => {
    await seed();
    const res = await validateCatalogCodes(collegeId, { quota: 'bogus' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unknown quota code "bogus"');
  });

  it('passes when both columns are blank', async () => {
    await seed();
    expect((await validateCatalogCodes(collegeId, {})).ok).toBe(true);
  });
});

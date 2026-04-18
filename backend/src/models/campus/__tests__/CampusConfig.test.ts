import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { CampusConfig } from '../CampusConfig';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * Schema contract for CampusConfig after the optional-allotment extension.
 * Task 1 adds `proposalTtlDays: number (default 7)` to both `hostel` and `transport`
 * sub-documents.
 */

describe('CampusConfig — proposalTtlDays defaults', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('defaults hostel.proposalTtlDays to 7 when not provided', async () => {
    const doc = await CampusConfig.create({
      collegeId: new mongoose.Types.ObjectId(),
    });
    expect(doc.hostel.proposalTtlDays).toBe(7);
  });

  it('defaults transport.proposalTtlDays to 7 when not provided', async () => {
    const doc = await CampusConfig.create({
      collegeId: new mongoose.Types.ObjectId(),
    });
    expect(doc.transport.proposalTtlDays).toBe(7);
  });

  it('persists custom hostel.proposalTtlDays', async () => {
    const doc = await CampusConfig.create({
      collegeId: new mongoose.Types.ObjectId(),
      hostel: { proposalTtlDays: 14 },
    });
    const reloaded = await CampusConfig.findById(doc._id).lean();
    expect(reloaded?.hostel.proposalTtlDays).toBe(14);
  });

  it('persists custom transport.proposalTtlDays', async () => {
    const doc = await CampusConfig.create({
      collegeId: new mongoose.Types.ObjectId(),
      transport: { proposalTtlDays: 3 },
    });
    const reloaded = await CampusConfig.findById(doc._id).lean();
    expect(reloaded?.transport.proposalTtlDays).toBe(3);
  });
});

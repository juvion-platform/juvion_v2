import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { retrofitAllocations } from '../2026-04-optional-allotment';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { TransportAllocation } from '../../models/welfare/TransportAllocation';
import { CampusConfig } from '../../models/campus/CampusConfig';
import { setupMongo, teardownMongo, clearCollections } from '../../__tests__/helpers/mongoMemory';

/**
 * T14: one-shot migration that retrofits legacy 'active'/'vacated' allocations
 * with the new propose/respond metadata fields. Must be idempotent.
 */

const oid = () => new mongoose.Types.ObjectId();

describe('retrofitAllocations', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('sets proposedAt/respondedAt/respondedBy on active hostel allocations that lack them', async () => {
    const studentId = oid();
    const doc = await HostelAllocation.create({
      collegeId: oid(), studentId, roomId: oid(), academicYearId: oid(), status: 'active',
    });
    // Clear retrofitted fields to simulate legacy data
    await HostelAllocation.updateOne({ _id: doc._id }, { $unset: { proposedAt: 1, respondedAt: 1, respondedBy: 1 } });

    const report = await retrofitAllocations();
    expect(report.hostelUpdated).toBe(1);

    const reloaded = await HostelAllocation.findById(doc._id).lean();
    expect(reloaded?.proposedAt).toBeDefined();
    expect(reloaded?.respondedAt).toBeDefined();
    expect(String(reloaded?.respondedBy)).toBe(String(studentId));
  });

  it('retrofits transport allocations the same way', async () => {
    const studentId = oid();
    const doc = await TransportAllocation.create({
      collegeId: oid(), studentId, routeId: oid(), stopName: 'Gate', academicYearId: oid(), status: 'cancelled',
    });
    await TransportAllocation.updateOne({ _id: doc._id }, { $unset: { proposedAt: 1, respondedAt: 1, respondedBy: 1 } });

    const report = await retrofitAllocations();
    expect(report.transportUpdated).toBe(1);

    const reloaded = await TransportAllocation.findById(doc._id).lean();
    expect(String(reloaded?.respondedBy)).toBe(String(studentId));
  });

  it('is idempotent: running twice does not double-update', async () => {
    const doc = await HostelAllocation.create({
      collegeId: oid(), studentId: oid(), roomId: oid(), academicYearId: oid(), status: 'vacated',
    });
    await HostelAllocation.updateOne({ _id: doc._id }, { $unset: { proposedAt: 1 } });

    const first = await retrofitAllocations();
    expect(first.hostelUpdated).toBeGreaterThanOrEqual(1);

    const second = await retrofitAllocations();
    expect(second.hostelUpdated).toBe(0);
  });

  it('does not touch records that already have proposedAt', async () => {
    const customProposedAt = new Date('2025-01-01');
    await HostelAllocation.create({
      collegeId: oid(), studentId: oid(), roomId: oid(), academicYearId: oid(),
      status: 'active', proposedAt: customProposedAt,
    });
    const report = await retrofitAllocations();
    expect(report.hostelUpdated).toBe(0);
  });

  it('does not touch proposed/waitlisted records (only post-accept states)', async () => {
    await HostelAllocation.create({
      collegeId: oid(), studentId: oid(), roomId: oid(), academicYearId: oid(), status: 'proposed',
    });
    await HostelAllocation.updateOne({}, { $unset: { proposedAt: 1 } });
    const report = await retrofitAllocations();
    expect(report.hostelUpdated).toBe(0);
  });

  it('backfills CampusConfig proposalTtlDays when missing', async () => {
    const cid = oid();
    // Create with minimal subdoc, then strip proposalTtlDays
    await CampusConfig.create({ collegeId: cid });
    await CampusConfig.updateOne(
      { collegeId: cid },
      { $unset: { 'hostel.proposalTtlDays': 1, 'transport.proposalTtlDays': 1 } },
    );

    const report = await retrofitAllocations();
    expect(report.configsUpdated).toBeGreaterThanOrEqual(1);

    const reloaded = await CampusConfig.findOne({ collegeId: cid }).lean();
    expect(reloaded?.hostel?.proposalTtlDays).toBe(7);
    expect(reloaded?.transport?.proposalTtlDays).toBe(7);
  });
});

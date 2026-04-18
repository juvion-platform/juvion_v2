import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { expireProposals } from '../proposal-expiry-worker';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { TransportAllocation } from '../../../models/welfare/TransportAllocation';
import { AuditLog } from '../../audit';
import { Notification } from '../../../models/communication/Notification';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

const oid = () => new mongoose.Types.ObjectId();

describe('expireProposals sweep', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('expires hostel proposals whose expiresAt is in the past', async () => {
    const cid = oid();
    await HostelAllocation.create({
      collegeId: cid, studentId: oid(), roomId: oid(), academicYearId: oid(),
      status: 'proposed', expiresAt: new Date(Date.now() - 60_000),
    });
    const result = await expireProposals();
    expect(result.hostelExpired).toBe(1);
    const reloaded = await HostelAllocation.findOne({});
    expect(reloaded?.status).toBe('expired');
  });

  it('does not expire hostel proposals whose expiresAt is in the future', async () => {
    await HostelAllocation.create({
      collegeId: oid(), studentId: oid(), roomId: oid(), academicYearId: oid(),
      status: 'proposed', expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await expireProposals();
    expect(result.hostelExpired).toBe(0);
  });

  it('does not expire allocations already in terminal states', async () => {
    await HostelAllocation.create({
      collegeId: oid(), studentId: oid(), roomId: oid(), academicYearId: oid(),
      status: 'active', expiresAt: new Date(Date.now() - 60_000),
    });
    const result = await expireProposals();
    expect(result.hostelExpired).toBe(0);
  });

  it('writes audit log and notifications on expiry', async () => {
    await HostelAllocation.create({
      collegeId: oid(), studentId: oid(), roomId: oid(), academicYearId: oid(),
      status: 'proposed', expiresAt: new Date(Date.now() - 60_000),
    });
    await expireProposals();
    const audits = await AuditLog.find({});
    expect(audits.length).toBeGreaterThanOrEqual(1);
    const notifs = await Notification.find({});
    // expect both student + admin notifications
    expect(notifs.length).toBeGreaterThanOrEqual(2);
  });

  it('expires transport proposals separately', async () => {
    await TransportAllocation.create({
      collegeId: oid(), studentId: oid(), routeId: oid(), stopName: 'X',
      academicYearId: oid(), status: 'proposed', expiresAt: new Date(Date.now() - 60_000),
    });
    const result = await expireProposals();
    expect(result.transportExpired).toBe(1);
  });

  it('is safe to run twice (idempotent re-sweep)', async () => {
    await HostelAllocation.create({
      collegeId: oid(), studentId: oid(), roomId: oid(), academicYearId: oid(),
      status: 'proposed', expiresAt: new Date(Date.now() - 60_000),
    });
    const first = await expireProposals();
    expect(first.hostelExpired).toBe(1);
    const second = await expireProposals();
    expect(second.hostelExpired).toBe(0);
  });
});

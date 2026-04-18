import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import {
  proposeTransportAllocation,
  withdrawTransportProposal,
  promoteTransportWaitlist,
  acceptTransportProposal,
  declineTransportProposal,
  requestCancelTransport,
  approveCancelTransport,
  rejectCancelTransport,
} from '../transport-allocation-service';
import { TransportAllocation } from '../../../models/welfare/TransportAllocation';
import { TransportRoute } from '../../../models/welfare/TransportRoute';
import { TransportClearance } from '../../../models/campus/TransportClearance';
import { FeeLineItem } from '../../../models/finance/FeeLineItem';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

const oid = () => new mongoose.Types.ObjectId();

async function makeRoute(cid: string, capacity = 2) {
  return TransportRoute.create({
    collegeId: cid, routeNumber: 'R-1', name: 'Test', capacity,
    stops: [{ name: 'Main Gate', pickupTime: '08:00', dropTime: '17:00' }],
  });
}

describe('transport-allocation-service', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('proposes an allocation when route has capacity', async () => {
    const cid = String(oid());
    const route = await makeRoute(cid);
    const alloc = await proposeTransportAllocation(cid, {
      studentId: String(oid()), routeId: String(route._id), stopName: 'Main Gate',
      academicYearId: String(oid()),
    }, String(oid()));
    expect(alloc.status).toBe('proposed');
    expect(alloc.allocationType).toBe('admin_proposed');
  });

  it('throws capacity_full when route is full', async () => {
    const cid = String(oid());
    const route = await makeRoute(cid, 1);
    await TransportAllocation.create({
      collegeId: cid, studentId: oid(), routeId: route._id, stopName: 'X',
      academicYearId: oid(), status: 'active',
    });
    await expect(
      proposeTransportAllocation(cid, {
        studentId: String(oid()), routeId: String(route._id), stopName: 'X',
        academicYearId: String(oid()),
      }, String(oid())),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('accepts a proposal, bumps ridership, sets feeTriggered, creates fee', async () => {
    const cid = String(oid());
    const route = await makeRoute(cid, 3);
    const studentId = String(oid());
    const alloc = await proposeTransportAllocation(cid, {
      studentId, routeId: String(route._id), stopName: 'Main Gate',
      academicYearId: String(oid()),
    }, String(oid()));
    const accepted = await acceptTransportProposal(cid, String(alloc._id), studentId);
    expect(accepted.status).toBe('active');
    expect(accepted.feeTriggered).toBe(true);
    const r = await TransportRoute.findById(route._id);
    expect(r?.currentRidership).toBe(1);
    const fees = await FeeLineItem.find({ collegeId: cid, studentId });
    expect(fees.length).toBe(1);
    expect(fees[0]!.component).toBe('transport_fee');
  });

  it('declines without creating a fee', async () => {
    const cid = String(oid());
    const route = await makeRoute(cid);
    const studentId = String(oid());
    const alloc = await proposeTransportAllocation(cid, {
      studentId, routeId: String(route._id), stopName: 'X',
      academicYearId: String(oid()),
    }, String(oid()));
    const declined = await declineTransportProposal(cid, String(alloc._id), studentId);
    expect(declined.status).toBe('declined');
    const fees = await FeeLineItem.find({ collegeId: cid });
    expect(fees.length).toBe(0);
  });

  it('withdraw + promote waitlist flow', async () => {
    const cid = String(oid());
    const route = await makeRoute(cid, 2);
    // Make a waitlisted alloc directly
    const wl = await TransportAllocation.create({
      collegeId: cid, studentId: oid(), routeId: route._id, stopName: 'X',
      academicYearId: oid(), status: 'waitlisted', waitlistPosition: 1,
    });
    const promoted = await promoteTransportWaitlist(cid, String(wl._id), String(oid()));
    expect(promoted.status).toBe('proposed');
    const withdrawn = await withdrawTransportProposal(cid, String(wl._id), String(oid()), 'stale');
    expect(withdrawn.status).toBe('withdrawn');
  });

  it('cancel flow: request → approve goes to cancelled (not vacated)', async () => {
    const cid = String(oid());
    const route = await makeRoute(cid, 3);
    const studentId = String(oid());
    const alloc = await proposeTransportAllocation(cid, {
      studentId, routeId: String(route._id), stopName: 'X',
      academicYearId: String(oid()),
    }, String(oid()));
    await acceptTransportProposal(cid, String(alloc._id), studentId);
    await requestCancelTransport(cid, String(alloc._id), studentId, 'moving closer');
    const clearanceCount = await TransportClearance.countDocuments({ collegeId: cid });
    expect(clearanceCount).toBe(1);

    const approved = await approveCancelTransport(cid, String(alloc._id), String(oid()));
    expect(approved.status).toBe('cancelled');
    const r = await TransportRoute.findById(route._id);
    expect(r?.currentRidership).toBe(0);
  });

  it('rejecting cancel returns to active', async () => {
    const cid = String(oid());
    const route = await makeRoute(cid, 3);
    const studentId = String(oid());
    const alloc = await proposeTransportAllocation(cid, {
      studentId, routeId: String(route._id), stopName: 'X',
      academicYearId: String(oid()),
    }, String(oid()));
    await acceptTransportProposal(cid, String(alloc._id), studentId);
    await requestCancelTransport(cid, String(alloc._id), studentId);
    const rejected = await rejectCancelTransport(cid, String(alloc._id), String(oid()), 'dues');
    expect(rejected.status).toBe('active');
  });
});

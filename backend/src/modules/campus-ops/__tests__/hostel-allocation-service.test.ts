import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import {
  proposeHostelAllocation,
  withdrawHostelProposal,
  promoteHostelWaitlist,
  acceptHostelProposal,
  declineHostelProposal,
  requestVacateHostel,
  approveVacateHostel,
  rejectVacateHostel,
} from '../hostel-allocation-service';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../../models/welfare/HostelRoom';
import { HostelClearance } from '../../../models/campus/HostelClearance';
import { FeeLineItem } from '../../../models/finance/FeeLineItem';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

const oid = () => new mongoose.Types.ObjectId();

async function makeRoom(cid: string, capacity = 2) {
  return HostelRoom.create({
    collegeId: cid, blockId: oid(), roomNumber: 'A-100', floor: 1, capacity,
  });
}

describe('hostel-allocation-service', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  describe('proposeHostelAllocation', () => {
    it('creates a proposed allocation when room has capacity', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid);
      const studentId = String(oid());
      const ayId = String(oid());
      const alloc = await proposeHostelAllocation(cid, {
        studentId, roomId: String(room._id), academicYearId: ayId,
      }, String(oid()));
      expect(alloc.status).toBe('proposed');
      expect(alloc.expiresAt).toBeDefined();
      expect(alloc.allocationMethod).toBe('admin_proposed');
    });

    it('throws 409 capacity_full when room is full and forceWaitlist not set', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid, 1);
      // Fill the room
      await HostelAllocation.create({
        collegeId: cid, studentId: oid(), roomId: room._id, academicYearId: oid(), status: 'active',
      });
      await expect(
        proposeHostelAllocation(cid, {
          studentId: String(oid()), roomId: String(room._id), academicYearId: String(oid()),
        }, String(oid())),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('creates a waitlisted allocation when forceWaitlist=true on a full room', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid, 1);
      await HostelAllocation.create({
        collegeId: cid, studentId: oid(), roomId: room._id, academicYearId: oid(), status: 'active',
      });
      const alloc = await proposeHostelAllocation(cid, {
        studentId: String(oid()), roomId: String(room._id), academicYearId: String(oid()),
        forceWaitlist: true,
      }, String(oid()));
      expect(alloc.status).toBe('waitlisted');
      expect(alloc.waitlistPosition).toBe(1);
    });

    it('returns existing allocation instead of duplicating', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid);
      const studentId = String(oid());
      const ayId = String(oid());
      const first = await proposeHostelAllocation(cid, {
        studentId, roomId: String(room._id), academicYearId: ayId,
      }, String(oid()));
      const second = await proposeHostelAllocation(cid, {
        studentId, roomId: String(room._id), academicYearId: ayId,
      }, String(oid()));
      expect(String(first._id)).toBe(String(second._id));
    });
  });

  describe('withdraw + promote', () => {
    it('withdraws a proposed allocation', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid);
      const alloc = await proposeHostelAllocation(cid, {
        studentId: String(oid()), roomId: String(room._id), academicYearId: String(oid()),
      }, String(oid()));
      const withdrawn = await withdrawHostelProposal(cid, String(alloc._id), String(oid()), 'no-show');
      expect(withdrawn.status).toBe('withdrawn');
    });

    it('rejects withdraw of an active allocation', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid);
      const alloc = await HostelAllocation.create({
        collegeId: cid, studentId: oid(), roomId: room._id, academicYearId: oid(), status: 'active',
      });
      await expect(
        withdrawHostelProposal(cid, String(alloc._id), String(oid()), 'oops'),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('promotes a waitlisted allocation when capacity is available', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid, 2);
      const wl = await HostelAllocation.create({
        collegeId: cid, studentId: oid(), roomId: room._id, academicYearId: oid(),
        status: 'waitlisted', waitlistPosition: 1,
      });
      const promoted = await promoteHostelWaitlist(cid, String(wl._id), String(oid()));
      expect(promoted.status).toBe('proposed');
      expect(promoted.expiresAt).toBeDefined();
    });
  });

  describe('student actions', () => {
    it('accepts a proposal, bumps room occupancy, and creates a fee line item', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid, 3);
      const studentId = String(oid());
      const alloc = await proposeHostelAllocation(cid, {
        studentId, roomId: String(room._id), academicYearId: String(oid()),
      }, String(oid()));
      const accepted = await acceptHostelProposal(cid, String(alloc._id), studentId);
      expect(accepted.status).toBe('active');
      const reloadedRoom = await HostelRoom.findById(room._id);
      expect(reloadedRoom?.currentOccupancy).toBe(1);
      const fees = await FeeLineItem.find({ collegeId: cid, studentId });
      expect(fees.length).toBe(1);
      expect(fees[0]!.component).toBe('hostel_fee');
    });

    it('is idempotent on repeat accept', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid, 3);
      const studentId = String(oid());
      const alloc = await proposeHostelAllocation(cid, {
        studentId, roomId: String(room._id), academicYearId: String(oid()),
      }, String(oid()));
      await acceptHostelProposal(cid, String(alloc._id), studentId);
      await acceptHostelProposal(cid, String(alloc._id), studentId);
      const fees = await FeeLineItem.find({ collegeId: cid, studentId });
      expect(fees.length).toBe(1);
    });

    it('rejects accept by a different student', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid);
      const alloc = await proposeHostelAllocation(cid, {
        studentId: String(oid()), roomId: String(room._id), academicYearId: String(oid()),
      }, String(oid()));
      await expect(
        acceptHostelProposal(cid, String(alloc._id), String(oid())),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('declines a proposal and does not create a fee', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid);
      const studentId = String(oid());
      const alloc = await proposeHostelAllocation(cid, {
        studentId, roomId: String(room._id), academicYearId: String(oid()),
      }, String(oid()));
      const declined = await declineHostelProposal(cid, String(alloc._id), studentId, 'day scholar');
      expect(declined.status).toBe('declined');
      const fees = await FeeLineItem.find({ collegeId: cid });
      expect(fees.length).toBe(0);
    });

    it('handles vacate request → approve flow', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid, 3);
      const studentId = String(oid());
      const alloc = await proposeHostelAllocation(cid, {
        studentId, roomId: String(room._id), academicYearId: String(oid()),
      }, String(oid()));
      await acceptHostelProposal(cid, String(alloc._id), studentId);
      const requested = await requestVacateHostel(cid, String(alloc._id), studentId, 'moving');
      expect(requested.status).toBe('vacate_requested');
      const clearances = await HostelClearance.find({ collegeId: cid, allocationId: alloc._id });
      expect(clearances.length).toBe(1);

      const approved = await approveVacateHostel(cid, String(alloc._id), String(oid()));
      expect(approved.status).toBe('vacated');
      const reloadedRoom = await HostelRoom.findById(room._id);
      expect(reloadedRoom?.currentOccupancy).toBe(0);
      const clearance = await HostelClearance.findOne({ collegeId: cid, allocationId: alloc._id });
      expect(clearance?.status).toBe('cleared');
      expect(clearance?.duesCleared).toBe(false); // fee settlement pending
    });

    it('rejects vacate returns allocation to active', async () => {
      const cid = String(oid());
      const room = await makeRoom(cid, 3);
      const studentId = String(oid());
      const alloc = await proposeHostelAllocation(cid, {
        studentId, roomId: String(room._id), academicYearId: String(oid()),
      }, String(oid()));
      await acceptHostelProposal(cid, String(alloc._id), studentId);
      await requestVacateHostel(cid, String(alloc._id), studentId);
      const rejected = await rejectVacateHostel(cid, String(alloc._id), String(oid()), 'dues pending');
      expect(rejected.status).toBe('active');
    });
  });
});

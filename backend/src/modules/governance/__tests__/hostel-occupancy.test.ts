import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';
import { HostelBlock } from '../../../models/welfare/HostelBlock';
import { HostelRoom } from '../../../models/welfare/HostelRoom';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { runReport, ADMIN_FULL_SCOPE, ScopeNotSupportedError } from '../report-service';
import type { AuthScope } from '../../../shared/rbac/types';

/**
 * Phase B Wave 1 — hostel-occupancy runner.
 *
 * Coverage:
 *   1. Per-block aggregation: capacity from HostelBlock.totalCapacity,
 *      allocated from count of active HostelAllocation in this block's rooms.
 *   2. Only `active` allocations count (proposed / declined / vacated excluded).
 *   3. occupancyPct = allocated / capacity, rounded to 1 decimal; 0 when
 *      capacity is 0 (no division by zero).
 *   4. Inactive blocks are excluded.
 *   5. Multi-tenancy: tenant B allocations never bleed into tenant A.
 *   6. Eligibility gate: HOD (departmentOnly) is refused because hostels
 *      aren't department-scoped.
 */

const oid = () => new mongoose.Types.ObjectId();

describe('runReport — hostel-occupancy (Phase B Wave 1)', () => {
  let collegeA: mongoose.Types.ObjectId;
  let collegeB: mongoose.Types.ObjectId;
  let blockA1: mongoose.Types.ObjectId;
  let blockA2: mongoose.Types.ObjectId;
  let roomA1R1: mongoose.Types.ObjectId;
  let roomA1R2: mongoose.Types.ObjectId;
  let roomA2R1: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  async function seedFixture() {
    collegeA = oid();
    collegeB = oid();

    const a1 = await HostelBlock.create({ collegeId: collegeA, name: 'Block A1', type: 'boys', totalRooms: 2, totalCapacity: 50, currentOccupancy: 0, isActive: true });
    const a2 = await HostelBlock.create({ collegeId: collegeA, name: 'Block A2', type: 'girls', totalRooms: 1, totalCapacity: 20, currentOccupancy: 0, isActive: true });
    const aInactive = await HostelBlock.create({ collegeId: collegeA, name: 'Block A-inactive', type: 'boys', totalRooms: 0, totalCapacity: 0, currentOccupancy: 0, isActive: false });
    const b1 = await HostelBlock.create({ collegeId: collegeB, name: 'Tenant B Block', type: 'boys', totalRooms: 1, totalCapacity: 30, currentOccupancy: 0, isActive: true });
    blockA1 = a1._id as mongoose.Types.ObjectId;
    blockA2 = a2._id as mongoose.Types.ObjectId;
    const blockAInactive = aInactive._id as mongoose.Types.ObjectId;
    const blockB1 = b1._id as mongoose.Types.ObjectId;

    const r1a1 = await HostelRoom.create({ collegeId: collegeA, blockId: blockA1, roomNumber: '101', floor: 1, capacity: 25, occupancy: 0, currentOccupancy: 0, amenities: [], status: 'available', roomType: 'double', isAccessible: false });
    const r2a1 = await HostelRoom.create({ collegeId: collegeA, blockId: blockA1, roomNumber: '102', floor: 1, capacity: 25, occupancy: 0, currentOccupancy: 0, amenities: [], status: 'available', roomType: 'double', isAccessible: false });
    const r1a2 = await HostelRoom.create({ collegeId: collegeA, blockId: blockA2, roomNumber: 'G1', floor: 1, capacity: 20, occupancy: 0, currentOccupancy: 0, amenities: [], status: 'available', roomType: 'double', isAccessible: false });
    const rB = await HostelRoom.create({ collegeId: collegeB, blockId: blockB1, roomNumber: '1', floor: 1, capacity: 30, occupancy: 0, currentOccupancy: 0, amenities: [], status: 'available', roomType: 'double', isAccessible: false });
    roomA1R1 = r1a1._id as mongoose.Types.ObjectId;
    roomA1R2 = r2a1._id as mongoose.Types.ObjectId;
    roomA2R1 = r1a2._id as mongoose.Types.ObjectId;
    // suppress unused-binding
    void blockAInactive;

    const ayId = oid();
    // Block A1: 10 active allocations (across 2 rooms), 2 proposed (must NOT count), 1 vacated.
    for (let i = 0; i < 5; i++) {
      await HostelAllocation.create({ collegeId: collegeA, studentId: oid(), roomId: roomA1R1, academicYearId: ayId, allocatedDate: new Date(), status: 'active', allocationType: 'new_intake', preferences: {}, specialNeeds: {} });
    }
    for (let i = 0; i < 5; i++) {
      await HostelAllocation.create({ collegeId: collegeA, studentId: oid(), roomId: roomA1R2, academicYearId: ayId, allocatedDate: new Date(), status: 'active', allocationType: 'new_intake', preferences: {}, specialNeeds: {} });
    }
    await HostelAllocation.create({ collegeId: collegeA, studentId: oid(), roomId: roomA1R1, academicYearId: ayId, allocatedDate: new Date(), status: 'proposed', allocationType: 'new_intake', preferences: {}, specialNeeds: {} });
    await HostelAllocation.create({ collegeId: collegeA, studentId: oid(), roomId: roomA1R1, academicYearId: ayId, allocatedDate: new Date(), status: 'proposed', allocationType: 'new_intake', preferences: {}, specialNeeds: {} });
    await HostelAllocation.create({ collegeId: collegeA, studentId: oid(), roomId: roomA1R2, academicYearId: ayId, allocatedDate: new Date(), status: 'vacated', allocationType: 'new_intake', preferences: {}, specialNeeds: {}, vacatedDate: new Date() });
    // Block A2: 4 active.
    for (let i = 0; i < 4; i++) {
      await HostelAllocation.create({ collegeId: collegeA, studentId: oid(), roomId: roomA2R1, academicYearId: ayId, allocatedDate: new Date(), status: 'active', allocationType: 'new_intake', preferences: {}, specialNeeds: {} });
    }
    // Tenant B: 15 active allocations (must not leak).
    for (let i = 0; i < 15; i++) {
      await HostelAllocation.create({ collegeId: collegeB, studentId: oid(), roomId: rB._id, academicYearId: ayId, allocatedDate: new Date(), status: 'active', allocationType: 'new_intake', preferences: {}, specialNeeds: {} });
    }
  }

  it('admin run: per-block aggregation with capacity/allocated/occupancyPct', async () => {
    await seedFixture();
    const run = await runReport(String(collegeA), 'hostel-occupancy', {}, 'admin', ADMIN_FULL_SCOPE);
    expect(run.status).toBe('success');
    const rows = run.result as Array<{ hostelName: string; capacity: number; allocated: number; occupancyPct: number }>;
    // Inactive block excluded → 2 rows.
    expect(rows).toHaveLength(2);

    const a1 = rows.find((r) => r.hostelName === 'Block A1');
    expect(a1).toBeDefined();
    expect(a1!.capacity).toBe(50);
    expect(a1!.allocated).toBe(10); // only `active` allocations
    expect(a1!.occupancyPct).toBe(20.0); // 10/50 = 20%

    const a2 = rows.find((r) => r.hostelName === 'Block A2');
    expect(a2).toBeDefined();
    expect(a2!.capacity).toBe(20);
    expect(a2!.allocated).toBe(4);
    expect(a2!.occupancyPct).toBe(20.0); // 4/20 = 20%

    // Tenant B's block must NOT appear.
    expect(rows.find((r) => r.hostelName === 'Tenant B Block')).toBeUndefined();
  });

  it('only active allocations count (proposed/declined/vacated excluded)', async () => {
    await seedFixture();
    const run = await runReport(String(collegeA), 'hostel-occupancy', {}, 'admin', ADMIN_FULL_SCOPE);
    const rows = run.result as Array<{ hostelName: string; allocated: number }>;
    const a1 = rows.find((r) => r.hostelName === 'Block A1');
    // 10 active + 2 proposed + 1 vacated = 13 total rows. Only 10 active count.
    expect(a1!.allocated).toBe(10);
  });

  it('summary aggregates totals across blocks', async () => {
    await seedFixture();
    const run = await runReport(String(collegeA), 'hostel-occupancy', {}, 'admin', ADMIN_FULL_SCOPE);
    expect(run.summary).toEqual({
      hostels: 2,
      totalCapacity: 70,
      totalAllocated: 14,
    });
  });

  it('eligibility gate refuses HOD (departmentOnly admin-only)', async () => {
    await seedFixture();
    const hodScope: AuthScope = {
      departmentOnly: true,
      selfOnly: false,
      departmentId: oid().toString(),
      userId: 'hod-user',
      resolvedPermissions: [],
    };
    await expect(
      runReport(String(collegeA), 'hostel-occupancy', {}, 'hod-user', hodScope),
    ).rejects.toBeInstanceOf(ScopeNotSupportedError);
  });

  it('empty fixture: returns no rows, summary zeros', async () => {
    collegeA = oid();
    const run = await runReport(String(collegeA), 'hostel-occupancy', {}, 'admin', ADMIN_FULL_SCOPE);
    expect(run.status).toBe('success');
    expect(run.result).toEqual([]);
    expect(run.summary).toEqual({ hostels: 0, totalCapacity: 0, totalAllocated: 0 });
  });
});

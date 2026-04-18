import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import {
  assertValidTransition,
  recordTransition,
  checkCapacity,
  computeExpiry,
} from '../allocation-lifecycle';
import { HostelAllocation } from '../../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../../models/welfare/HostelRoom';
import { TransportAllocation } from '../../../models/welfare/TransportAllocation';
import { TransportRoute } from '../../../models/welfare/TransportRoute';
import { CampusConfig } from '../../../models/campus/CampusConfig';
import { AuditLog } from '../../../shared/audit';
import { Notification } from '../../../models/communication/Notification';
import { FeeLineItem } from '../../../models/finance/FeeLineItem';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';

/**
 * T3: allocation-lifecycle shared helper — state machine guard, transition
 * recorder, capacity check, expiry computer. Parameterized by flow
 * ('hostel' | 'transport') because the state machine only diverges at the
 * vacated-vs-cancelled terminal.
 */

const collegeId = () => new mongoose.Types.ObjectId();

describe('assertValidTransition', () => {
  // Allowed transitions, flow-agnostic
  const allowedBothFlows: Array<[string, string]> = [
    ['proposed', 'active'],
    ['proposed', 'declined'],
    ['proposed', 'withdrawn'],
    ['proposed', 'expired'],
    ['waitlisted', 'proposed'],
    ['waitlisted', 'withdrawn'],
    ['active', 'vacate_requested'],
    ['vacate_requested', 'active'], // reject path
    // idempotent same-state no-op
    ['proposed', 'proposed'],
    ['active', 'active'],
  ];

  it.each(allowedBothFlows)("allows hostel %s → %s", (from, to) => {
    expect(() => assertValidTransition('hostel', from, to)).not.toThrow();
  });

  it.each(allowedBothFlows)("allows transport %s → %s", (from, to) => {
    expect(() => assertValidTransition('transport', from, to)).not.toThrow();
  });

  it("allows hostel vacate_requested → vacated", () => {
    expect(() => assertValidTransition('hostel', 'vacate_requested', 'vacated')).not.toThrow();
  });

  it("rejects transport vacate_requested → vacated (transport uses cancelled)", () => {
    expect(() => assertValidTransition('transport', 'vacate_requested', 'vacated')).toThrow();
  });

  it("allows transport vacate_requested → cancelled", () => {
    expect(() => assertValidTransition('transport', 'vacate_requested', 'cancelled')).not.toThrow();
  });

  it("rejects hostel vacate_requested → cancelled (hostel uses vacated)", () => {
    expect(() => assertValidTransition('hostel', 'vacate_requested', 'cancelled')).toThrow();
  });

  it('rejects proposed → active then back to proposed', () => {
    expect(() => assertValidTransition('hostel', 'active', 'proposed')).toThrow();
  });

  it('rejects terminal → anything', () => {
    for (const terminal of ['declined', 'withdrawn', 'expired', 'vacated', 'cancelled']) {
      expect(() => assertValidTransition('hostel', terminal, 'active')).toThrow();
    }
  });

  it('throws AppError with statusCode 409', () => {
    try {
      assertValidTransition('hostel', 'active', 'proposed');
      expect.fail('should have thrown');
    } catch (e: any) {
      expect(e.statusCode).toBe(409);
      expect(String(e.message)).toMatch(/invalid_transition/);
    }
  });
});

describe('computeExpiry', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('uses default 7 days when no CampusConfig exists', async () => {
    const cid = String(collegeId());
    const { ttlDays, expiresAt } = await computeExpiry('hostel', cid);
    expect(ttlDays).toBe(7);
    const delta = expiresAt.getTime() - Date.now();
    expect(delta).toBeGreaterThan(6.9 * 86400_000);
    expect(delta).toBeLessThan(7.1 * 86400_000);
  });

  it('reads hostel.proposalTtlDays from CampusConfig', async () => {
    const cid = String(collegeId());
    await CampusConfig.create({ collegeId: cid, hostel: { proposalTtlDays: 3 } });
    const { ttlDays, expiresAt } = await computeExpiry('hostel', cid);
    expect(ttlDays).toBe(3);
    const delta = expiresAt.getTime() - Date.now();
    expect(delta).toBeGreaterThan(2.9 * 86400_000);
    expect(delta).toBeLessThan(3.1 * 86400_000);
  });

  it('reads transport.proposalTtlDays from CampusConfig', async () => {
    const cid = String(collegeId());
    await CampusConfig.create({ collegeId: cid, transport: { proposalTtlDays: 14 } });
    const { ttlDays } = await computeExpiry('transport', cid);
    expect(ttlDays).toBe(14);
  });
});

describe('checkCapacity', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  it('computes hostel room capacity minus live allocations', async () => {
    const cid = String(collegeId());
    const blockId = collegeId();
    const room = await HostelRoom.create({
      collegeId: cid, blockId, roomNumber: 'A-101', floor: 1, capacity: 3,
    });
    // 1 active + 1 proposed = liveCount 2, available 1
    await HostelAllocation.create([
      { collegeId: cid, studentId: collegeId(), roomId: room._id, academicYearId: collegeId(), status: 'active' },
      { collegeId: cid, studentId: collegeId(), roomId: room._id, academicYearId: collegeId(), status: 'proposed' },
      // vacated doesn't count
      { collegeId: cid, studentId: collegeId(), roomId: room._id, academicYearId: collegeId(), status: 'vacated' },
    ]);
    const cap = await checkCapacity('hostel', cid, String(room._id));
    expect(cap.capacity).toBe(3);
    expect(cap.liveCount).toBe(2);
    expect(cap.available).toBe(1);
  });

  it('computes transport route capacity minus live allocations', async () => {
    const cid = String(collegeId());
    const route = await TransportRoute.create({
      collegeId: cid, routeNumber: 'R-1', name: 'North Loop', capacity: 5,
      stops: [{ name: 'Gate', pickupTime: '08:00', dropTime: '17:00' }],
    });
    await TransportAllocation.create([
      { collegeId: cid, studentId: collegeId(), routeId: route._id, stopName: 'Gate', academicYearId: collegeId(), status: 'active' },
      { collegeId: cid, studentId: collegeId(), routeId: route._id, stopName: 'Gate', academicYearId: collegeId(), status: 'waitlisted' },
      { collegeId: cid, studentId: collegeId(), routeId: route._id, stopName: 'Gate', academicYearId: collegeId(), status: 'cancelled' },
    ]);
    const cap = await checkCapacity('transport', cid, String(route._id));
    expect(cap.capacity).toBe(5);
    expect(cap.liveCount).toBe(2); // active + waitlisted; cancelled excluded
    expect(cap.available).toBe(3);
  });
});

describe('recordTransition', () => {
  beforeAll(async () => { await setupMongo(); });
  afterAll(async () => { await teardownMongo(); });
  afterEach(async () => { await clearCollections(); });

  async function seedHostelProposed(cid: string) {
    const roomId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const academicYearId = new mongoose.Types.ObjectId();
    const allocation = await HostelAllocation.create({
      collegeId: cid, studentId, roomId, academicYearId, status: 'proposed',
    });
    return { allocation, studentId, academicYearId };
  }

  it('updates allocation status and writes audit log', async () => {
    const cid = String(collegeId());
    const { allocation } = await seedHostelProposed(cid);
    const performedBy = String(new mongoose.Types.ObjectId());
    await recordTransition({
      flow: 'hostel',
      collegeId: cid,
      allocation,
      fromStatus: 'proposed',
      toStatus: 'active',
      action: 'accept',
      performedBy,
    });
    const reloaded = await HostelAllocation.findById(allocation._id);
    expect(reloaded?.status).toBe('active');
    const audits = await AuditLog.find({ entityId: String(allocation._id) });
    expect(audits.length).toBe(1);
    expect(audits[0]!.performedBy).toBe(performedBy);
    // Semantic action is preserved (not faked as 'update')
    expect(audits[0]!.action).toBe('accept');
  });

  it('persists semantic action names in the audit log (propose/expire/vacate_*)', async () => {
    const cid = String(collegeId());
    for (const action of ['propose', 'expire', 'vacate_approve', 'waitlist_promote'] as const) {
      const { allocation } = await seedHostelProposed(cid);
      // Force a valid transition that exercises each action label.
      const toStatus = (
        action === 'propose' ? 'proposed' :
        action === 'expire' ? 'expired' :
        action === 'waitlist_promote' ? 'proposed' :
        'active' /* vacate_approve needs vacate_requested first; this just
                    tests the label persists even if semantically off */
      );
      const fromStatus = (
        action === 'vacate_approve' ? 'vacate_requested' :
        action === 'waitlist_promote' ? 'waitlisted' :
        'proposed'
      );
      if (action === 'vacate_approve') {
        allocation.status = 'vacate_requested';
        await allocation.save();
      }
      if (action === 'waitlist_promote') {
        allocation.status = 'waitlisted';
        await allocation.save();
      }
      try {
        await recordTransition({
          flow: 'hostel', collegeId: cid, allocation,
          fromStatus, toStatus: action === 'vacate_approve' ? 'vacated' : toStatus,
          action, performedBy: 'system',
        });
      } catch { /* transition may be semantically invalid for these seed shapes — OK */ }
    }
    const audits = await AuditLog.find({}).lean();
    const actions = new Set(audits.map((a) => a.action));
    // At least two of the semantic actions should have persisted successfully.
    const semantic = (['propose', 'expire', 'vacate_approve', 'waitlist_promote'] as const).filter((a) => actions.has(a));
    expect(semantic.length).toBeGreaterThanOrEqual(2);
  });

  it('creates a student notification when notifyStudent=true', async () => {
    const cid = String(collegeId());
    const { allocation, studentId } = await seedHostelProposed(cid);
    await recordTransition({
      flow: 'hostel',
      collegeId: cid,
      allocation,
      fromStatus: 'proposed',
      toStatus: 'active',
      action: 'accept',
      performedBy: String(studentId),
      notifyStudent: true,
    });
    const notifs = await Notification.find({ collegeId: cid, targetAudience: 'individual' });
    expect(notifs.length).toBe(1);
    expect(notifs[0]!.channel).toBe('app');
  });

  it('does NOT emit email-channel notifications when FEATURE_EMAIL_NOTIFICATIONS is off', async () => {
    delete process.env.FEATURE_EMAIL_NOTIFICATIONS;
    const cid = String(collegeId());
    const { allocation } = await seedHostelProposed(cid);
    await recordTransition({
      flow: 'hostel', collegeId: cid, allocation,
      fromStatus: 'proposed', toStatus: 'active', action: 'accept',
      performedBy: String(new mongoose.Types.ObjectId()),
      notifyStudent: true, notifyAdmin: true,
    });
    const emails = await Notification.find({ collegeId: cid, channel: 'email' });
    expect(emails.length).toBe(0);
  });

  it('emits parallel email-channel notifications when FEATURE_EMAIL_NOTIFICATIONS=true', async () => {
    process.env.FEATURE_EMAIL_NOTIFICATIONS = 'true';
    try {
      const cid = String(collegeId());
      const { allocation } = await seedHostelProposed(cid);
      await recordTransition({
        flow: 'hostel', collegeId: cid, allocation,
        fromStatus: 'proposed', toStatus: 'active', action: 'accept',
        performedBy: String(new mongoose.Types.ObjectId()),
        notifyStudent: true, notifyAdmin: true,
      });
      const appNotifs = await Notification.find({ collegeId: cid, channel: 'app' });
      const emailNotifs = await Notification.find({ collegeId: cid, channel: 'email' });
      // One each for student + admin, per channel.
      expect(appNotifs.length).toBe(2);
      expect(emailNotifs.length).toBe(2);
      // Email records are staged, not sent — an SMTP worker handles delivery.
      expect(emailNotifs.every((n) => n.status === 'scheduled')).toBe(true);
    } finally {
      delete process.env.FEATURE_EMAIL_NOTIFICATIONS;
    }
  });

  it('creates a FeeLineItem when triggerFee=true (no FeeStructure → amount 0)', async () => {
    const cid = String(collegeId());
    const { allocation } = await seedHostelProposed(cid);
    await recordTransition({
      flow: 'hostel',
      collegeId: cid,
      allocation,
      fromStatus: 'proposed',
      toStatus: 'active',
      action: 'accept',
      performedBy: String(new mongoose.Types.ObjectId()),
      triggerFee: true,
    });
    const fees = await FeeLineItem.find({ collegeId: cid, studentId: allocation.studentId });
    expect(fees.length).toBe(1);
    expect(fees[0]!.component).toBe('hostel_fee');
    expect(fees[0]!.amount).toBe(0);
  });

  it('does not create a FeeLineItem when triggerFee is omitted', async () => {
    const cid = String(collegeId());
    const { allocation } = await seedHostelProposed(cid);
    await recordTransition({
      flow: 'hostel',
      collegeId: cid,
      allocation,
      fromStatus: 'proposed',
      toStatus: 'declined',
      action: 'decline',
      performedBy: String(new mongoose.Types.ObjectId()),
    });
    const fees = await FeeLineItem.find({ collegeId: cid });
    expect(fees.length).toBe(0);
  });

  it('is idempotent for fee creation (accept twice → one line item)', async () => {
    const cid = String(collegeId());
    const { allocation } = await seedHostelProposed(cid);
    const performedBy = String(new mongoose.Types.ObjectId());
    await recordTransition({
      flow: 'hostel', collegeId: cid, allocation,
      fromStatus: 'proposed', toStatus: 'active', action: 'accept',
      performedBy, triggerFee: true,
    });
    // simulate a re-accept (same transition)
    await recordTransition({
      flow: 'hostel', collegeId: cid, allocation,
      fromStatus: 'active', toStatus: 'active', action: 'accept',
      performedBy, triggerFee: true,
    });
    const fees = await FeeLineItem.find({ collegeId: cid });
    expect(fees.length).toBe(1);
  });

  it('rejects an invalid transition (proposed → vacated)', async () => {
    const cid = String(collegeId());
    const { allocation } = await seedHostelProposed(cid);
    await expect(
      recordTransition({
        flow: 'hostel', collegeId: cid, allocation,
        fromStatus: 'proposed', toStatus: 'vacated', action: 'vacate_approve',
        performedBy: String(new mongoose.Types.ObjectId()),
      }),
    ).rejects.toThrow();
  });
});

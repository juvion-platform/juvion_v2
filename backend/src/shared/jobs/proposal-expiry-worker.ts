/**
 * T13: Proposal-expiry BullMQ worker.
 *
 * Sweeps HostelAllocation and TransportAllocation for records where
 * `status === 'proposed'` and `expiresAt <= now`, and transitions them
 * to 'expired'. Fires notifications to student + admin.
 *
 * Runs as a recurring BullMQ job every 15 minutes. Concurrency 1 on the
 * worker so overlapping sweeps don't interleave; the per-doc
 * `findOneAndUpdate` with a status pre-condition additionally guards
 * against accidental double-expiry if a second sweep starts anyway.
 */

import { Job } from 'bullmq';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { TransportAllocation } from '../../models/welfare/TransportAllocation';
import { recordTransition } from '../../modules/campus-ops/allocation-lifecycle';
import { registerQueue, QUEUE_NAMES, getQueue } from '../queue';

export interface ExpirySweepResult {
  hostelExpired: number;
  transportExpired: number;
}

/**
 * Core sweep logic. Exported so tests can invoke it directly without
 * bringing up BullMQ's Redis connection.
 */
export async function expireProposals(): Promise<ExpirySweepResult> {
  const result: ExpirySweepResult = { hostelExpired: 0, transportExpired: 0 };
  const now = new Date();
  const BATCH_SIZE = 500;

  // Process hostel expiries
  const hostelDue = await HostelAllocation.find({
    status: 'proposed',
    expiresAt: { $lte: now, $ne: null },
  }).limit(BATCH_SIZE);
  for (const doc of hostelDue) {
    try {
      // Atomic status flip — another sweeper can't double-expire.
      const claimed = await HostelAllocation.findOneAndUpdate(
        { _id: doc._id, status: 'proposed', expiresAt: { $lte: now } },
        { $set: { status: 'expired' } },
        { new: true },
      );
      if (!claimed) continue;
      // `recordTransition` with fromStatus=proposed, toStatus=expired writes
      // audit + notifications. We pass the updated doc (status already 'expired'),
      // and recordTransition's `fromStatus !== toStatus` guard means it won't
      // double-save. We need to fake-undo the status on the in-memory doc so
      // recordTransition emits the transition correctly.
      claimed.status = 'proposed';
      await recordTransition({
        flow: 'hostel',
        collegeId: String(claimed.collegeId),
        allocation: claimed,
        fromStatus: 'proposed',
        toStatus: 'expired',
        action: 'expire',
        performedBy: 'system',
        notifyStudent: true,
        notifyAdmin: true,
      });
      result.hostelExpired += 1;
    } catch (err) {
      console.error('[proposal-expiry] hostel expiry failed for', String(doc._id), err);
    }
  }

  // Process transport expiries (parallel structure)
  const transportDue = await TransportAllocation.find({
    status: 'proposed',
    expiresAt: { $lte: now, $ne: null },
  }).limit(BATCH_SIZE);
  for (const doc of transportDue) {
    try {
      const claimed = await TransportAllocation.findOneAndUpdate(
        { _id: doc._id, status: 'proposed', expiresAt: { $lte: now } },
        { $set: { status: 'expired' } },
        { new: true },
      );
      if (!claimed) continue;
      claimed.status = 'proposed';
      await recordTransition({
        flow: 'transport',
        collegeId: String(claimed.collegeId),
        allocation: claimed,
        fromStatus: 'proposed',
        toStatus: 'expired',
        action: 'expire',
        performedBy: 'system',
        notifyStudent: true,
        notifyAdmin: true,
      });
      result.transportExpired += 1;
    } catch (err) {
      console.error('[proposal-expiry] transport expiry failed for', String(doc._id), err);
    }
  }

  return result;
}

async function expiryJobProcessor(_job: Job): Promise<ExpirySweepResult> {
  const result = await expireProposals();
  console.log(
    `[proposal-expiry] swept ${result.hostelExpired} hostel + ${result.transportExpired} transport proposals`,
  );
  return result;
}

/**
 * Registers the proposal-expiry queue and schedules a recurring sweep
 * every 15 minutes. Call this once at server start (after DB connect).
 */
export async function registerProposalExpiryQueue(): Promise<void> {
  registerQueue({
    name: QUEUE_NAMES.CAMPUS_PROPOSAL_EXPIRY,
    processor: expiryJobProcessor,
    concurrency: 1,
  });
  // Schedule recurring sweep. If a schedule already exists, BullMQ is
  // idempotent on repeatable jobs with the same key.
  const queue = getQueue(QUEUE_NAMES.CAMPUS_PROPOSAL_EXPIRY);
  await queue.add(
    'sweep',
    {},
    { repeat: { pattern: '*/15 * * * *' }, removeOnComplete: true, removeOnFail: true },
  );
}

/**
 * One-shot data migration for the optional-hostel-transport-allotment feature.
 *
 * Retrofits pre-existing HostelAllocation and TransportAllocation records
 * that were created under the old "auto-allocate" semantics so they satisfy
 * the new invariant: every allocation with a post-accept status has
 * proposedAt, respondedAt, and respondedBy populated.
 *
 * Also backfills `proposalTtlDays = 7` on CampusConfigs that predate the
 * field (though in practice Mongoose's default=7 handles most cases — this
 * covers any config that was unset-ed explicitly).
 *
 * Idempotent: re-running skips records that already have proposedAt.
 * Forward-only: no rollback script.
 *
 * Usage:
 *   npm run migrate:optional-allotment -w backend
 */

import mongoose from 'mongoose';
import { HostelAllocation } from '../models/welfare/HostelAllocation';
import { TransportAllocation } from '../models/welfare/TransportAllocation';
import { CampusConfig } from '../models/campus/CampusConfig';

// Statuses that represent a post-accept allocation — eligible for retrofit.
const POST_ACCEPT_STATUSES = ['active', 'vacated', 'cancelled', 'transferred', 'vacate_requested'];

export interface MigrationReport {
  hostelUpdated: number;
  transportUpdated: number;
  configsUpdated: number;
}

export async function retrofitAllocations(): Promise<MigrationReport> {
  const report: MigrationReport = { hostelUpdated: 0, transportUpdated: 0, configsUpdated: 0 };

  // ── Hostel allocations ──
  const hostelCandidates = await HostelAllocation.find({
    status: { $in: POST_ACCEPT_STATUSES },
    proposedAt: { $exists: false },
  });
  for (const doc of hostelCandidates) {
    const createdAt = (doc as unknown as { createdAt?: Date }).createdAt ?? new Date();
    await HostelAllocation.updateOne(
      { _id: doc._id },
      {
        $set: {
          proposedAt: createdAt,
          respondedAt: createdAt,
          respondedBy: doc.studentId,
        },
      },
    );
    report.hostelUpdated += 1;
  }

  // ── Transport allocations ──
  const transportCandidates = await TransportAllocation.find({
    status: { $in: POST_ACCEPT_STATUSES },
    proposedAt: { $exists: false },
  });
  for (const doc of transportCandidates) {
    const createdAt = (doc as unknown as { createdAt?: Date }).createdAt ?? new Date();
    await TransportAllocation.updateOne(
      { _id: doc._id },
      {
        $set: {
          proposedAt: createdAt,
          respondedAt: createdAt,
          respondedBy: doc.studentId,
        },
      },
    );
    report.transportUpdated += 1;
  }

  // ── CampusConfig backfill ──
  // Use .lean() so we see the raw DB state without Mongoose re-applying defaults
  // on hydration — otherwise an $unset sub-field would show up as 7 anyway.
  const configs = await CampusConfig.find({
    $or: [
      { 'hostel.proposalTtlDays': { $exists: false } },
      { 'transport.proposalTtlDays': { $exists: false } },
    ],
  }).lean();
  for (const config of configs) {
    const update: Record<string, unknown> = {};
    if (config.hostel?.proposalTtlDays == null) update['hostel.proposalTtlDays'] = 7;
    if (config.transport?.proposalTtlDays == null) update['transport.proposalTtlDays'] = 7;
    if (Object.keys(update).length > 0) {
      await CampusConfig.updateOne({ _id: config._id }, { $set: update });
      report.configsUpdated += 1;
    }
  }

  return report;
}

// CLI entrypoint (invoked by `npm run migrate:optional-allotment`).
// Skipped when this file is imported for testing.
if (require.main === module) {
  (async () => {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/juvion_v2';
    console.log(`[migrate:optional-allotment] Connecting to ${uri}...`);
    await mongoose.connect(uri);
    try {
      const report = await retrofitAllocations();
      console.log('[migrate:optional-allotment] Completed:');
      console.log(`  hostel allocations updated:    ${report.hostelUpdated}`);
      console.log(`  transport allocations updated: ${report.transportUpdated}`);
      console.log(`  campus configs updated:        ${report.configsUpdated}`);
    } finally {
      await mongoose.disconnect();
    }
  })().catch((err) => {
    console.error('[migrate:optional-allotment] Failed:', err);
    process.exit(1);
  });
}

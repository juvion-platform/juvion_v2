/**
 * T17 — fee-pin-audit worker orchestration tests.
 *
 * Scope:
 *   - Worker iterates over all active colleges by default.
 *   - Worker honors `job.data.collegeId` for scoped runs.
 *   - Snapshot fields (coverage + invariants) reflect the service's
 *     return values.
 *   - `deferredPinsCount` / `commitmentSheetFailureCount` computed from
 *     the embedded `Student.feePins[]` array.
 *   - Old snapshots (>90d) pruned per run; recent ones preserved.
 *   - Partial-failure tolerance: one college's service exception must
 *     not block the next college.
 *
 * The `fee-pin-audit-service` itself is unit-tested in T12 — here we
 * mock it to keep these tests about orchestration, not coverage math.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

// ── Mocks ────────────────────────────────────────────────────────────
// The worker also imports `addJob` for the EMAIL alert. We stub it
// to a no-op resolve so alerting never blocks tests on a live queue.
vi.mock('../../shared/queue/QueueManager', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../shared/queue/QueueManager')>();
  return {
    ...actual,
    addJob: vi.fn().mockResolvedValue({ id: 'mock-email-job' }),
  };
});

vi.mock('../../modules/finance/fee-pin-audit-service', () => ({
  getCoverage: vi.fn(),
  getInvariants: vi.fn(),
}));

import * as feePinAuditService from '../../modules/finance/fee-pin-audit-service';
import { addJob } from '../../shared/queue/QueueManager';
import { feePinAuditWorker } from '../fee-pin-audit.worker';
import { FeePinAuditSnapshot } from '../../models/finance/FeePinAuditSnapshot';
import { College } from '../../models/College';
import { Student } from '../../models/people/Student';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

type Job = Parameters<typeof feePinAuditWorker>[0];

const oid = () => new mongoose.Types.ObjectId();

function buildJob(data: { collegeId?: string } = {}): Job {
  return { id: 'job-1', name: 'nightly', data } as unknown as Job;
}

async function seedCollege(name: string, code: string) {
  return College.create({
    name,
    code,
    address: {
      line1: '1 Main',
      city: 'C',
      state: 'S',
      pincode: '000001',
    },
    contactEmail: `${code.toLowerCase()}@example.com`,
    contactPhone: '9999999999',
    status: 'active',
  });
}

function defaultCoverage(collegeId: string) {
  return {
    collegeId,
    totalActiveStudents: 10,
    studentsWithActivePinForCurrentYear: 10,
    coveragePercent: 100,
    studentsMissingPin: [],
  };
}

function defaultInvariants(collegeId: string) {
  return {
    collegeId,
    totalInvoicesChecked: 0,
    mismatches: [],
  };
}

describe('feePinAuditWorker', () => {
  beforeAll(async () => {
    await setupMongo();
    await Promise.all([
      College.syncIndexes(),
      Student.syncIndexes(),
      FeePinAuditSnapshot.syncIndexes(),
    ]);
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
    vi.mocked(feePinAuditService.getCoverage).mockReset();
    vi.mocked(feePinAuditService.getInvariants).mockReset();
    vi.mocked(addJob).mockClear();
  });

  beforeEach(() => {
    // Default: 100% coverage, zero invariants. Individual tests override.
    vi.mocked(feePinAuditService.getCoverage).mockImplementation(
      async (collegeId: string) => defaultCoverage(collegeId),
    );
    vi.mocked(feePinAuditService.getInvariants).mockImplementation(
      async (collegeId: string) => defaultInvariants(collegeId),
    );
  });

  it('runs for all active colleges when job.data.collegeId is omitted → 1 snapshot per college', async () => {
    const a = await seedCollege('College A', 'A01');
    const b = await seedCollege('College B', 'B01');

    await feePinAuditWorker(buildJob());

    const snaps = await FeePinAuditSnapshot.find({}).lean();
    expect(snaps).toHaveLength(2);
    const collegeIds = snaps.map((s) => String(s.collegeId)).sort();
    expect(collegeIds).toEqual([String(a._id), String(b._id)].sort());
  });

  it('skips non-active colleges (status != active)', async () => {
    const a = await seedCollege('College A', 'A02');
    await College.create({
      name: 'Suspended',
      code: 'S02',
      address: { line1: '1', city: 'C', state: 'S', pincode: '000001' },
      contactEmail: 's@example.com',
      contactPhone: '9999999999',
      status: 'suspended',
    });

    await feePinAuditWorker(buildJob());

    const snaps = await FeePinAuditSnapshot.find({}).lean();
    expect(snaps).toHaveLength(1);
    expect(String(snaps[0]?.collegeId)).toBe(String(a._id));
  });

  it('runs only for the target college when job.data.collegeId is provided', async () => {
    const a = await seedCollege('College A', 'A03');
    await seedCollege('College B', 'B03');

    await feePinAuditWorker(buildJob({ collegeId: String(a._id) }));

    const snaps = await FeePinAuditSnapshot.find({}).lean();
    expect(snaps).toHaveLength(1);
    expect(String(snaps[0]?.collegeId)).toBe(String(a._id));
  });

  it('populates coverage + invariants fields from the service return values', async () => {
    const a = await seedCollege('College A', 'A04');
    const studentId = oid();
    const invoiceId = oid();
    const pinId = oid();

    vi.mocked(feePinAuditService.getCoverage).mockResolvedValueOnce({
      collegeId: String(a._id),
      totalActiveStudents: 25,
      studentsWithActivePinForCurrentYear: 20,
      coveragePercent: 80,
      studentsMissingPin: Array.from({ length: 75 }).map((_, i) => ({
        studentId: String(studentId),
        rollNumber: `R${i}`,
        programmeId: null,
        currentYearOfStudy: 2,
      })),
    });
    vi.mocked(feePinAuditService.getInvariants).mockResolvedValueOnce({
      collegeId: String(a._id),
      totalInvoicesChecked: 5,
      mismatches: [
        {
          invoiceId: String(invoiceId),
          studentId: String(studentId),
          pinId: String(pinId),
          pinnedTotal: 100,
          invoiceTotal: 120,
          delta: 20,
        },
      ],
    });

    await feePinAuditWorker(buildJob({ collegeId: String(a._id) }));

    const snap = await FeePinAuditSnapshot.findOne({ collegeId: a._id }).lean();
    expect(snap).toBeTruthy();
    expect(snap!.coverage.totalActiveStudents).toBe(25);
    expect(snap!.coverage.studentsWithActivePinForCurrentYear).toBe(20);
    expect(snap!.coverage.coveragePercent).toBe(80);
    // missingSample capped at 50.
    expect(snap!.coverage.missingSample).toHaveLength(50);
    expect(snap!.invariants.totalInvoicesChecked).toBe(5);
    expect(snap!.invariants.mismatches).toHaveLength(1);
    expect(snap!.invariants.mismatches[0]?.delta).toBe(20);
  });

  it('counts deferredPinsCount from students with feePins.staleSince populated (and not archived)', async () => {
    const a = await seedCollege('College A', 'A05');
    const fsId = oid();

    // Student 1: one stale active pin + one stale archived pin (archived ignored).
    await Student.create({
      collegeId: a._id,
      personId: oid(),
      admissionYear: 2024,
      rollNumber: 'A05-1',
      status: 'active',
      onboardingStatus: 'completed',
      isSealed: false,
      feePins: [
        {
          yearOfStudy: 2,
          feeStructureInstanceId: fsId,
          pinnedAt: new Date(),
          pinnedBy: 'sys',
          reason: 'initial',
          staleSince: new Date(),
        },
        {
          yearOfStudy: 1,
          feeStructureInstanceId: fsId,
          pinnedAt: new Date(),
          pinnedBy: 'sys',
          reason: 'initial',
          staleSince: new Date(),
          archivedAt: new Date(),
        },
      ],
    });
    // Student 2: another stale active pin.
    await Student.create({
      collegeId: a._id,
      personId: oid(),
      admissionYear: 2024,
      rollNumber: 'A05-2',
      status: 'active',
      onboardingStatus: 'completed',
      isSealed: false,
      feePins: [
        {
          yearOfStudy: 1,
          feeStructureInstanceId: fsId,
          pinnedAt: new Date(),
          pinnedBy: 'sys',
          reason: 'initial',
          staleSince: new Date(),
        },
      ],
    });
    // Student 3: no stale pins.
    await Student.create({
      collegeId: a._id,
      personId: oid(),
      admissionYear: 2024,
      rollNumber: 'A05-3',
      status: 'active',
      onboardingStatus: 'completed',
      isSealed: false,
      feePins: [
        {
          yearOfStudy: 1,
          feeStructureInstanceId: fsId,
          pinnedAt: new Date(),
          pinnedBy: 'sys',
          reason: 'initial',
        },
      ],
    });

    await feePinAuditWorker(buildJob({ collegeId: String(a._id) }));

    const snap = await FeePinAuditSnapshot.findOne({ collegeId: a._id }).lean();
    expect(snap!.deferredPinsCount).toBe(2);
  });

  it('counts commitmentSheetFailureCount from feePins.commitmentSheetStatus === failed', async () => {
    const a = await seedCollege('College A', 'A06');
    const fsId = oid();

    await Student.create({
      collegeId: a._id,
      personId: oid(),
      admissionYear: 2024,
      rollNumber: 'A06-1',
      status: 'active',
      onboardingStatus: 'completed',
      isSealed: false,
      feePins: [
        {
          yearOfStudy: 1,
          feeStructureInstanceId: fsId,
          pinnedAt: new Date(),
          pinnedBy: 'sys',
          reason: 'initial',
          commitmentSheetStatus: 'failed',
        },
        {
          yearOfStudy: 2,
          feeStructureInstanceId: fsId,
          pinnedAt: new Date(),
          pinnedBy: 'sys',
          reason: 'initial',
          commitmentSheetStatus: 'failed',
        },
      ],
    });
    await Student.create({
      collegeId: a._id,
      personId: oid(),
      admissionYear: 2024,
      rollNumber: 'A06-2',
      status: 'active',
      onboardingStatus: 'completed',
      isSealed: false,
      feePins: [
        {
          yearOfStudy: 1,
          feeStructureInstanceId: fsId,
          pinnedAt: new Date(),
          pinnedBy: 'sys',
          reason: 'initial',
          commitmentSheetStatus: 'generated',
        },
      ],
    });

    await feePinAuditWorker(buildJob({ collegeId: String(a._id) }));

    const snap = await FeePinAuditSnapshot.findOne({ collegeId: a._id }).lean();
    expect(snap!.commitmentSheetFailureCount).toBe(2);
  });

  it('prunes snapshots older than 90 days; recent + new-run snapshots preserved', async () => {
    const a = await seedCollege('College A', 'A07');
    const now = Date.now();
    const old = new Date(now - 100 * 24 * 60 * 60 * 1000); // 100d old
    const recent = new Date(now - 30 * 24 * 60 * 60 * 1000); // 30d old

    // 5 old + 2 recent seed snapshots.
    const base = {
      collegeId: a._id,
      coverage: {
        totalActiveStudents: 0,
        studentsWithActivePinForCurrentYear: 0,
        coveragePercent: 100,
        missingSample: [],
      },
      invariants: { totalInvoicesChecked: 0, mismatches: [] },
      deferredPinsCount: 0,
      commitmentSheetFailureCount: 0,
    };
    for (let i = 0; i < 5; i++) {
      await FeePinAuditSnapshot.create({ ...base, runAt: old });
    }
    for (let i = 0; i < 2; i++) {
      await FeePinAuditSnapshot.create({ ...base, runAt: recent });
    }

    await feePinAuditWorker(buildJob({ collegeId: String(a._id) }));

    const snaps = await FeePinAuditSnapshot.find({ collegeId: a._id }).lean();
    // 2 recent preserved + 1 new snapshot from this run = 3. Old 5 pruned.
    expect(snaps).toHaveLength(3);
    for (const s of snaps) {
      const age = now - new Date(s.runAt).getTime();
      expect(age).toBeLessThan(91 * 24 * 60 * 60 * 1000);
    }
  });

  it('tolerates per-college failure: one college throws, another still gets a snapshot', async () => {
    const bad = await seedCollege('Bad College', 'BAD1');
    const good = await seedCollege('Good College', 'GOOD1');

    vi.mocked(feePinAuditService.getCoverage).mockImplementation(
      async (collegeId: string) => {
        if (collegeId === String(bad._id)) {
          throw new Error('boom: coverage blew up');
        }
        return defaultCoverage(collegeId);
      },
    );

    await feePinAuditWorker(buildJob());

    const snaps = await FeePinAuditSnapshot.find({}).lean();
    // Only the good college got a snapshot; worker didn't reject.
    expect(snaps).toHaveLength(1);
    expect(String(snaps[0]?.collegeId)).toBe(String(good._id));
  });

  it('emits EMAIL alert when coverage < 100% (best-effort, never fails the run)', async () => {
    const a = await seedCollege('College A', 'A09');
    vi.mocked(feePinAuditService.getCoverage).mockResolvedValueOnce({
      collegeId: String(a._id),
      totalActiveStudents: 10,
      studentsWithActivePinForCurrentYear: 7,
      coveragePercent: 70,
      studentsMissingPin: [],
    });

    await feePinAuditWorker(buildJob({ collegeId: String(a._id) }));

    // One email job should have been enqueued (via the mocked addJob).
    const emailCalls = vi.mocked(addJob).mock.calls.filter(
      (args) => args[0] === 'platform:email',
    );
    expect(emailCalls.length).toBe(1);
    expect(emailCalls[0]?.[1]).toBe('fee-pin-audit-alert');

    // And the snapshot still got written.
    const snap = await FeePinAuditSnapshot.findOne({ collegeId: a._id }).lean();
    expect(snap).toBeTruthy();
    expect(snap!.coverage.coveragePercent).toBe(70);
  });

  it('does not fail the run when EMAIL queue is unavailable', async () => {
    const a = await seedCollege('College A', 'A10');
    vi.mocked(feePinAuditService.getCoverage).mockResolvedValueOnce({
      collegeId: String(a._id),
      totalActiveStudents: 10,
      studentsWithActivePinForCurrentYear: 1,
      coveragePercent: 10,
      studentsMissingPin: [],
    });
    vi.mocked(addJob).mockRejectedValueOnce(new Error('EMAIL queue down'));

    await expect(
      feePinAuditWorker(buildJob({ collegeId: String(a._id) })),
    ).resolves.toBeUndefined();

    const snap = await FeePinAuditSnapshot.findOne({ collegeId: a._id }).lean();
    expect(snap).toBeTruthy();
  });
});

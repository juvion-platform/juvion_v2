/**
 * Bulk provisioning BullMQ worker.
 *
 * `runProvisioningJob` is the processor body, exported so the e2e suite
 * can exercise it without bringing up BullMQ/Redis. `createProvisioningRun`
 * writes the `JuviProvisioningRun` doc and enqueues it, falling back to an
 * inline run when no queue is registered (dev without Redis).
 */

import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { Student } from '../../../models/people/Student';
import { Faculty } from '../../../models/people/Faculty';
import { Staff } from '../../../models/people/Staff';
import { Branch } from '../../../models/academic-structure/Branch';
import { JuviProvisioningRun, IJuviProvisioningRun, IProvisioningFilter } from '../../../models/juvi/JuviProvisioningRun';
import { AccountKind } from '../../../models/juvi/JuviAccount';
import { registerQueue, addJob, QUEUE_NAMES } from '../../../shared/queue';
import { provisionPerson } from './provisioning-service';
import { CREDENTIAL_TTL_DAYS } from './credential-store';

const BATCH_SIZE = 100;
const MAX_CONSECUTIVE_FAILURES = 10;
const MAX_RECORDED_ERRORS = 500;

/** Person ids to provision for one kind, honouring the run filter. Active rows only. */
async function candidatePersonIds(collegeId: string, kind: AccountKind, filter: IProvisioningFilter): Promise<Types.ObjectId[]> {
  if (kind === 'student') {
    const q: Record<string, unknown> = { collegeId, status: 'active' };
    if (filter.programmeIds?.length) q.programmeId = { $in: filter.programmeIds };
    if (filter.batchIds?.length) q.batchId = { $in: filter.batchIds };
    if (filter.departmentIds?.length) {
      const branches = await Branch.find({ collegeId, departmentId: { $in: filter.departmentIds } }).select('_id').lean();
      q.branchId = { $in: branches.map((b) => b._id) };
    }
    const students = await Student.find(q).select('personId').lean<{ personId: Types.ObjectId }[]>();
    return students.map((s) => s.personId);
  }
  const q: Record<string, unknown> = { collegeId, status: 'active' };
  if (filter.departmentIds?.length) q.departmentId = { $in: filter.departmentIds };
  const rows = kind === 'faculty'
    ? await Faculty.find(q).select('personId').lean<{ personId: Types.ObjectId }[]>()
    : await Staff.find(q).select('personId').lean<{ personId: Types.ObjectId }[]>();
  return rows.map((r) => r.personId);
}

export async function runProvisioningJob(runId: string): Promise<IJuviProvisioningRun> {
  const run = await JuviProvisioningRun.findById(runId);
  if (!run) throw new Error(`Provisioning run ${runId} not found`);
  const startedAt = new Date();
  run.status = 'running'; run.startedAt = startedAt;
  run.counts = { scanned: 0, created: 0, existingLinked: 0, skipped: 0, failed: 0 };
  // The schema path `errors` collides with Mongoose's own `Document.errors`
  // (`Error.ValidationError`) in its typings, so a plain `run.errors = []`
  // assignment is rejected; `set()` resets it without a cast.
  run.set('errors', []);
  run.credentialsExpireAt = new Date(startedAt.getTime() + CREDENTIAL_TTL_DAYS * 86_400_000);
  await run.save();

  const collegeId = String(run.collegeId);
  let consecutiveFailures = 0;
  let aborted = false;

  for (const kind of run.filter.kinds) {
    const personIds = await candidatePersonIds(collegeId, kind, run.filter);
    for (let i = 0; i < personIds.length && !aborted; i += BATCH_SIZE) {
      for (const personId of personIds.slice(i, i + BATCH_SIZE)) {
        run.counts.scanned += 1;
        try {
          const r = await provisionPerson({ collegeId, personId: String(personId), kind, source: 'bulk', performedBy: run.performedBy, resetPassword: run.options.resetExistingPasswords, runId });
          if (!r.created) run.counts.skipped += 1;
          else if (r.userCreated) run.counts.created += 1;
          else run.counts.existingLinked += 1;
          consecutiveFailures = 0;
        } catch (err) {
          run.counts.failed += 1;
          consecutiveFailures += 1;
          if (run.errors.length < MAX_RECORDED_ERRORS) run.errors.push({ personId, reason: err instanceof Error ? err.message : String(err) });
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) { aborted = true; break; }
        }
      }
      await run.save();   // progress is visible to the console every batch
    }
    if (aborted) break;
  }

  run.status = aborted ? 'failed' : run.counts.failed > 0 ? 'partial' : 'completed';
  run.finishedAt = new Date();
  await run.save();
  console.log(`[juvi-app] provisioning run ${runId}: ${run.status}`, run.counts);
  return run;
}

export async function createProvisioningRun(input: {
  collegeId: string; filter: IProvisioningFilter; options?: { resetExistingPasswords?: boolean }; performedBy: string;
}): Promise<IJuviProvisioningRun> {
  const run = await JuviProvisioningRun.create({
    collegeId: input.collegeId, filter: input.filter,
    options: { resetExistingPasswords: input.options?.resetExistingPasswords ?? true }, performedBy: input.performedBy,
  });
  try {
    await addJob(QUEUE_NAMES.JUVI_PROVISIONING, 'run', { runId: String(run._id) }, { attempts: 1 });
  } catch (err) {
    // No worker registered (dev without Redis): run inline so the console still works.
    console.warn('[juvi-app] provisioning queue unavailable, running inline:', err instanceof Error ? err.message : err);
    void runProvisioningJob(String(run._id)).catch((e) => console.error('[juvi-app] inline provisioning failed', e));
  }
  return run;
}

export function registerJuviProvisioningQueue(): void {
  registerQueue({
    name: QUEUE_NAMES.JUVI_PROVISIONING,
    processor: async (job: Job) => runProvisioningJob(String(job.data.runId)),
    concurrency: 1,
  });
}

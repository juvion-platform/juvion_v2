/**
 * Reconcile BullMQ worker.
 *
 * Sweeps every Juvi-enabled college and re-runs `reconcileCollege` on
 * each one. `College.find({ 'juvi.enabled': true })` is the tenancy
 * enumerator itself — everything inside the per-college loop is scoped
 * by that college's id via `reconcileCollege`.
 *
 * Registered as a recurring BullMQ job (default every 5 minutes,
 * overridable via `JUVI_RECONCILE_INTERVAL_MINUTES`). `enqueueReconcile`
 * is the manual per-college trigger from the admin console; it falls
 * back to an inline run when no queue is registered (dev without Redis).
 */

import { Job } from 'bullmq';
import { College } from '../../../models/College';
import { registerQueue, getQueue, addJob, QUEUE_NAMES } from '../../../shared/queue';
import { reconcileCollege } from './reconcile-service';

export async function reconcileAllEnabledColleges(): Promise<{ colleges: number }> {
  const colleges = await College.find({ 'juvi.enabled': true, status: 'active' }).select('_id').lean();
  for (const c of colleges) {
    try { await reconcileCollege(String(c._id)); } catch (err) { console.error('[juvi-app] reconcile failed for college', String(c._id), err); }
  }
  return { colleges: colleges.length };
}

async function processor(job: Job): Promise<unknown> {
  if (job.name === 'reconcile-college') return reconcileCollege(String(job.data.collegeId));
  return reconcileAllEnabledColleges();
}

/** Registers the queue and a repeatable sweep every `intervalMinutes` (env JUVI_RECONCILE_INTERVAL_MINUTES, default 5). */
export async function registerJuviReconcileQueue(intervalMinutes = Number.parseInt(process.env.JUVI_RECONCILE_INTERVAL_MINUTES ?? '5', 10) || 5): Promise<void> {
  registerQueue({ name: QUEUE_NAMES.JUVI_RECONCILE, processor, concurrency: 1 });
  await getQueue(QUEUE_NAMES.JUVI_RECONCILE).add('sweep', {}, {
    repeat: { every: intervalMinutes * 60_000 }, removeOnComplete: true, removeOnFail: true,
  });
}

/** Manual trigger from the admin console; runs inline when the queue is unavailable. */
export async function enqueueReconcile(collegeId: string): Promise<void> {
  try {
    await addJob(QUEUE_NAMES.JUVI_RECONCILE, 'reconcile-college', { collegeId }, { attempts: 1 });
  } catch {
    void reconcileCollege(collegeId).catch((e) => console.error('[juvi-app] inline reconcile failed', e));
  }
}

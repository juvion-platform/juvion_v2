/**
 * Outbox dispatcher: a BullMQ repeatable tick every 5 s plus an immediate run
 * whenever something calls `kick()`. Kicks share one jobId, so a burst of kicks
 * queues one job; sweepers run on the scheduled tick only. Registered from
 * server.ts next to the Juvi reconcile queue and guarded by
 * DISABLE_BACKGROUND_JOBS there.
 */
import { Job } from 'bullmq';
import { registerQueue, getQueue, QUEUE_NAMES } from '../queue';
import { processOnce, setTickEnqueuer } from './outbox';

export const TICK_SCHEDULER_ID = 'outbox-tick';
export const TICK_EVERY_MS = 5_000;
export const KICK_JOB_ID = 'outbox-kick';

async function processor(job: Job): Promise<unknown> {
  return { processed: await processOnce(undefined, { sweep: job.name === 'tick' }) };
}

export async function registerOutboxQueue(): Promise<void> {
  registerQueue({ name: QUEUE_NAMES.OUTBOX, processor, concurrency: 1 });
  const queue = getQueue(QUEUE_NAMES.OUTBOX);
  await queue.upsertJobScheduler(TICK_SCHEDULER_ID, { every: TICK_EVERY_MS }, {
    name: 'tick', data: {}, opts: { attempts: 1, removeOnComplete: true, removeOnFail: true },
  });
  // Not addJob(): it keeps completed jobs for a day, which would swallow every later kick with this jobId.
  setTickEnqueuer(async () => {
    await queue.add('kick', {}, { jobId: KICK_JOB_ID, attempts: 1, removeOnComplete: true, removeOnFail: true });
  });
}

/**
 * Outbox dispatcher: a BullMQ repeatable tick every 5 s plus an immediate tick
 * whenever something calls `kick()`. Registered from server.ts next to the Juvi
 * reconcile queue and guarded by DISABLE_BACKGROUND_JOBS there.
 */
import { Job } from 'bullmq';
import { registerQueue, getQueue, addJob, QUEUE_NAMES } from '../queue';
import { processOnce, setTickEnqueuer } from './outbox';

export const TICK_SCHEDULER_ID = 'outbox-tick';
export const TICK_EVERY_MS = 5_000;

async function processor(_job: Job): Promise<unknown> {
  return { processed: await processOnce() };
}

export async function registerOutboxQueue(): Promise<void> {
  registerQueue({ name: QUEUE_NAMES.OUTBOX, processor, concurrency: 1 });
  const queue = getQueue(QUEUE_NAMES.OUTBOX);
  await queue.upsertJobScheduler(TICK_SCHEDULER_ID, { every: TICK_EVERY_MS }, {
    name: 'tick', data: {}, opts: { attempts: 1, removeOnComplete: true, removeOnFail: true },
  });
  setTickEnqueuer(async () => { await addJob(QUEUE_NAMES.OUTBOX, 'tick', {}, { attempts: 1 }); });
}

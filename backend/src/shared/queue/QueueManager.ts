// ─── BullMQ Queue Manager ───────────────────────────────────
// Centralized queue management for async job processing.
// Used by workflows for: document OCR, lead scoring, notifications,
// fee reminders, bulk imports, provisioning jobs.

import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';

export type JobProcessor = (job: Job) => Promise<any>;

interface QueueConfig {
  name: string;
  processor: JobProcessor;
  concurrency?: number;
}

const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();
const queueEvents = new Map<string, QueueEvents>();

// ─── Register a queue with its processor ────────────────────
export function registerQueue(config: QueueConfig): Queue {
  if (queues.has(config.name)) return queues.get(config.name)!;

  const queue = new Queue(config.name, { connection });
  queues.set(config.name, queue);

  const worker = new Worker(config.name, config.processor, {
    connection,
    concurrency: config.concurrency || 3,
  });

  worker.on('completed', (job) => {
    console.log(`[Queue:${config.name}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Queue:${config.name}] Job ${job?.id} failed:`, err.message);
  });

  workers.set(config.name, worker);

  const events = new QueueEvents(config.name, { connection });
  queueEvents.set(config.name, events);

  return queue;
}

// ─── Get a registered queue ─────────────────────────────────
export function getQueue(name: string): Queue {
  const queue = queues.get(name);
  if (!queue) throw new Error(`Queue '${name}' not registered. Call registerQueue first.`);
  return queue;
}

// ─── Add a job to a queue ───────────────────────────────────
export async function addJob(queueName: string, jobName: string, data: any, opts?: {
  delay?: number;
  priority?: number;
  attempts?: number;
  backoff?: { type: 'exponential' | 'fixed'; delay: number };
}) {
  const queue = getQueue(queueName);
  return queue.add(jobName, data, {
    delay: opts?.delay,
    priority: opts?.priority,
    attempts: opts?.attempts || 3,
    backoff: opts?.backoff || { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 86400, count: 1000 },   // keep completed jobs for 24h, max 1000
    removeOnFail: { age: 604800, count: 5000 },      // keep failed jobs for 7 days, max 5000
  });
}

// ─── Bulk add jobs ──────────────────────────────────────────
export async function addBulkJobs(queueName: string, jobs: { name: string; data: any }[]) {
  const queue = getQueue(queueName);
  return queue.addBulk(jobs.map(j => ({
    name: j.name,
    data: j.data,
    opts: {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 2000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 5000 },
    },
  })));
}

// ─── Graceful shutdown ──────────────────────────────────────
export async function shutdownQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  for (const [, worker] of workers) closePromises.push(worker.close());
  for (const [, events] of queueEvents) closePromises.push(events.close());
  for (const [, queue] of queues) closePromises.push(queue.close());
  await Promise.all(closePromises);
  queues.clear();
  workers.clear();
  queueEvents.clear();
}

// ─── Queue names (constants) ────────────────────────────────
export const QUEUE_NAMES = {
  // Admissions
  LEAD_SCORING: 'admissions:lead-scoring',
  DOCUMENT_OCR: 'admissions:document-ocr',
  ELIGIBILITY_CHECK: 'admissions:eligibility-check',
  BULK_IMPORT: 'admissions:bulk-import',
  FEE_REMINDER: 'admissions:fee-reminder',
  OFFER_EXPIRY: 'admissions:offer-expiry',
  PROVISIONING: 'admissions:provisioning',

  // Notifications
  NOTIFICATION: 'platform:notification',
  WHATSAPP: 'platform:whatsapp',
  SMS: 'platform:sms',
  EMAIL: 'platform:email',

  // Campus ops
  CAMPUS_PROPOSAL_EXPIRY: 'campus:proposal-expiry',

  // Finance
  FEE_COMMITMENT: 'finance:fee-commitment',
  FEE_PIN_AUDIT: 'finance:fee-pin-audit',
  FEE_ALERTS_CRON: 'finance:fee-alerts-cron',
} as const;

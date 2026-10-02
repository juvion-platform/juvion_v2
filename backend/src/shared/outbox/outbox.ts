/**
 * Durable outbox (Juvi notices spec §6.2).
 *
 * `emit` upserts on `dedupeKey`, so re-emitting is a no-op. Consumers are
 * registered per event type; the dispatcher (dispatcher.ts) claims events one
 * at a time with a two-minute lock, backs off on failure and dead-letters after
 * eight attempts. `kick()` wakes the dispatcher; with no queue installed
 * (dev/test without Redis) it processes inline, the way `enqueueReconcile` does.
 * Sweepers run before the events on the scheduled tick; an `afterEvents` sweeper
 * (the notification sender) runs after them on every pass, tick or kick.
 */
import { OutboxEvent, IOutboxEvent } from './OutboxEvent';

export type OutboxPayload = { collegeId: string } & Record<string, unknown>;
export type OutboxConsumer = (payload: OutboxPayload, event: IOutboxEvent) => Promise<void>;
export type OutboxSweeper = () => Promise<void>;

export const MAX_ATTEMPTS = 8;
export const LOCK_MS = 120_000;
export const BASE_DELAY_MS = 5_000;
export const MAX_DELAY_MS = 600_000;

const consumers = new Map<string, OutboxConsumer>();
const sweepers: OutboxSweeper[] = [];
const afterSweepers: OutboxSweeper[] = [];
/** Installed by the dispatcher; null means "no queue, run inline". */
let enqueueTick: (() => Promise<void>) | null = null;
/** The one inline run in flight for this process, if any. */
let inflight: Promise<number> | null = null;

export function registerConsumer(type: string, handler: OutboxConsumer): void { consumers.set(type, handler); }
export function registerSweeper(fn: OutboxSweeper, opts: { afterEvents?: boolean } = {}): void {
  (opts.afterEvents ? afterSweepers : sweepers).push(fn);
}
export function setTickEnqueuer(fn: (() => Promise<void>) | null): void { enqueueTick = fn; }

/** Upsert on dedupeKey. Returns true when a new event was recorded, false when it already existed. */
export async function emit(type: string, payload: OutboxPayload, dedupeKey: string): Promise<boolean> {
  try {
    const res = await OutboxEvent.updateOne(
      { dedupeKey },
      { $setOnInsert: { collegeId: payload.collegeId, type, payload, dedupeKey, status: 'pending', attempts: 0, availableAt: new Date(), lockedUntil: null } },
      { upsert: true },
    );
    return res.upsertedCount > 0;
  } catch (err) {
    // Two concurrent emits of a brand-new dedupeKey can both pass the upsert's
    // existence check and race on the unique index; the loser gets a duplicate-key
    // error (11000) rather than a clean "matched" result. That's the same outcome
    // as a re-emit — the event was already recorded — so treat it as such.
    if ((err as { code?: number } | null)?.code === 11000) return false;
    throw err;
  }
}

/** 5 s × 2^attempts, capped at ten minutes. */
export function nextAvailableAt(attempts: number, now = new Date()): Date {
  return new Date(now.getTime() + Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS));
}

/** Atomically claims one runnable event: pending and due, or processing with an expired lock. */
export async function claimNext(now = new Date()): Promise<IOutboxEvent | null> {
  return OutboxEvent.findOneAndUpdate(
    { $or: [{ status: 'pending', availableAt: { $lte: now } }, { status: 'processing', lockedUntil: { $lt: now } }] },
    { $set: { status: 'processing', lockedUntil: new Date(now.getTime() + LOCK_MS) } },
    { new: true, sort: { availableAt: 1 } },
  );
}

/** Consumer error messages are stored as `lastError`; cap length so one runaway consumer can't blow up a document. */
export const MAX_LAST_ERROR_LENGTH = 500;

export async function processEvent(event: IOutboxEvent): Promise<void> {
  const handler = consumers.get(event.type);
  try {
    if (!handler) throw new Error(`No consumer registered for ${event.type}`);
    await handler(event.payload as OutboxPayload, event);
    await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: 'done', processedAt: new Date(), lockedUntil: null } });
  } catch (err) {
    const attempts = event.attempts + 1;
    const message = (err instanceof Error ? err.message : String(err)).slice(0, MAX_LAST_ERROR_LENGTH);
    if (attempts >= MAX_ATTEMPTS) {
      console.error(`[outbox] ${event.type} ${event.dedupeKey} is dead after ${attempts} attempts: ${message}`);
      await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: 'dead', attempts, lastError: message, lockedUntil: null } });
    } else {
      await OutboxEvent.updateOne({ _id: event._id }, { $set: { status: 'pending', attempts, lastError: message, availableAt: nextAvailableAt(attempts), lockedUntil: null } });
    }
  }
}

/**
 * Runs every sweeper (unless `sweep` is false), then processes claimable events
 * until none is left (or `limit`), then every `afterEvents` sweeper. Returns the
 * number processed. The dispatcher sweeps on its scheduled tick only; the inline
 * path has no tick, so it sweeps. `afterEvents` sweepers run on every pass.
 */
export async function processOnce(limit = 500, opts: { sweep?: boolean } = {}): Promise<number> {
  if (opts.sweep !== false) {
    for (const sweep of sweepers) {
      try { await sweep(); } catch (err) { console.error('[outbox] sweeper failed', err); }
    }
  }
  let n = 0;
  while (n < limit) {
    const event = await claimNext();
    if (!event) break;
    await processEvent(event);
    n += 1;
  }
  for (const sweep of afterSweepers) {
    try { await sweep(); } catch (err) { console.error('[outbox] sweeper failed', err); }
  }
  return n;
}

/** One inline run per process at a time; a concurrent caller shares the running promise. */
function runInline(): Promise<number> {
  if (!inflight) inflight = processOnce().finally(() => { inflight = null; });
  return inflight;
}

/** Wakes the dispatcher. Without a queue (dev/test without Redis) the events are processed inline. */
export async function kick(): Promise<void> {
  if (enqueueTick) {
    try { await enqueueTick(); return; } catch (err) {
      console.warn('[outbox] kick fell back to inline processing:', err instanceof Error ? err.message : err);
    }
  }
  void runInline().catch((err) => console.error('[outbox] inline processing failed', err));
}

/** Waits for any inline run in flight, then processes until the outbox is quiet. Tests and inline callers use this. */
export async function drainOutbox(): Promise<number> {
  let total = 0;
  if (inflight) total += await inflight;
  for (;;) {
    const n = await runInline();
    total += n;
    if (n === 0) return total;
  }
}

/** Puts a dead event of this college back in the queue (admin "Retry delivery"). */
export async function retryDead(collegeId: string, dedupeKey: string): Promise<boolean> {
  const res = await OutboxEvent.updateOne(
    { collegeId, dedupeKey, status: 'dead' },
    { $set: { status: 'pending', attempts: 0, availableAt: new Date(), lockedUntil: null }, $unset: { lastError: 1 } },
  );
  return res.modifiedCount > 0;
}

/** Test-only: forget consumers, sweepers and the enqueuer. */
export function __resetOutboxForTesting(): void {
  consumers.clear();
  sweepers.length = 0;
  afterSweepers.length = 0;
  enqueueTick = null;
  inflight = null;
}

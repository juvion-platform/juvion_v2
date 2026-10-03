import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { setupMongo, teardownMongo, clearCollections } from '../../../__tests__/helpers/mongoMemory';
import { OutboxEvent } from '../OutboxEvent';
import {
  emit, registerConsumer, registerSweeper, claimNext, processEvent, processOnce, kick, drainOutbox, retryDead,
  nextAvailableAt, setTickEnqueuer, __resetOutboxForTesting, MAX_ATTEMPTS, LOCK_MS, MAX_DELAY_MS, MAX_LAST_ERROR_LENGTH,
} from '../outbox';

const cid = String(new Types.ObjectId());

beforeAll(async () => { await setupMongo(); });
afterAll(async () => { await teardownMongo(); });
beforeEach(() => { __resetOutboxForTesting(); });
afterEach(async () => { await clearCollections(); });

describe('emit', () => {
  it('records a pending event once per dedupeKey', async () => {
    expect(await emit('t.x', { collegeId: cid, a: 1 }, 'k1')).toBe(true);
    expect(await emit('t.x', { collegeId: cid, a: 2 }, 'k1')).toBe(false);
    const rows = await OutboxEvent.find({ dedupeKey: 'k1' }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 't.x', status: 'pending', attempts: 0, payload: { collegeId: cid, a: 1 }, lockedUntil: null });
    expect(String(rows[0]!.collegeId)).toBe(cid);
  });

  it('survives two concurrent emits of the same new dedupeKey without throwing', async () => {
    await OutboxEvent.init(); // ensure the unique dedupeKey index is actually built so the race can hit it
    const results = await Promise.all([
      emit('t.race', { collegeId: cid }, 'race1'),
      emit('t.race', { collegeId: cid }, 'race1'),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect(await OutboxEvent.countDocuments({ dedupeKey: 'race1' })).toBe(1);
  });

  it('treats a duplicate-key error from updateOne as an already-recorded event', async () => {
    const spy = vi.spyOn(OutboxEvent, 'updateOne').mockRejectedValueOnce(Object.assign(new Error('E11000 duplicate key error'), { code: 11000 }));
    expect(await emit('t.race', { collegeId: cid }, 'race2')).toBe(false);
    spy.mockRestore();
  });

  it('rethrows any other error from updateOne', async () => {
    const spy = vi.spyOn(OutboxEvent, 'updateOne').mockRejectedValueOnce(new Error('connection lost'));
    await expect(emit('t.race', { collegeId: cid }, 'race3')).rejects.toThrow('connection lost');
    spy.mockRestore();
  });
});

describe('claimNext', () => {
  it('claims a due pending event, locks it for 2 minutes, and skips future or locked ones', async () => {
    await emit('t.x', { collegeId: cid }, 'due');
    await OutboxEvent.updateOne({ dedupeKey: 'due' }, { $set: { availableAt: new Date(Date.now() - 1000) } });
    await emit('t.x', { collegeId: cid }, 'future');
    await OutboxEvent.updateOne({ dedupeKey: 'future' }, { $set: { availableAt: new Date(Date.now() + 60_000) } });
    const now = new Date();
    const first = await claimNext(now);
    expect(first?.dedupeKey).toBe('due');
    expect(first?.status).toBe('processing');
    expect(first!.lockedUntil!.getTime()).toBe(now.getTime() + LOCK_MS);
    expect(await claimNext(now)).toBeNull();
  });

  it('re-claims a processing event whose lock has expired', async () => {
    await emit('t.x', { collegeId: cid }, 'stale');
    await OutboxEvent.updateOne({ dedupeKey: 'stale' }, { $set: { status: 'processing', lockedUntil: new Date(Date.now() - 1) } });
    expect((await claimNext())?.dedupeKey).toBe('stale');
  });
});

describe('processEvent', () => {
  it('marks done on success', async () => {
    const seen: unknown[] = [];
    registerConsumer('t.ok', async (p) => { seen.push(p); });
    await emit('t.ok', { collegeId: cid, n: 1 }, 'ok');
    await processEvent((await claimNext())!);
    expect(seen).toEqual([{ collegeId: cid, n: 1 }]);
    const row = (await OutboxEvent.findOne({ dedupeKey: 'ok' }).lean())!;
    expect(row.status).toBe('done');
    expect(row.processedAt).toBeInstanceOf(Date);
    expect(row.lockedUntil).toBeNull();
  });

  it('backs off exponentially on failure and dead-letters after 8 attempts', async () => {
    registerConsumer('t.fail', async () => { throw new Error('boom'); });
    await emit('t.fail', { collegeId: cid }, 'f');
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      await OutboxEvent.updateOne({ dedupeKey: 'f' }, { $set: { availableAt: new Date(0) } });
      const before = Date.now();
      await processEvent((await claimNext())!);
      const row = (await OutboxEvent.findOne({ dedupeKey: 'f' }).lean())!;
      expect(row).toMatchObject({ status: 'pending', attempts: attempt, lastError: 'boom' });
      const delay = row.availableAt.getTime() - before;
      expect(delay).toBeGreaterThanOrEqual(Math.min(5_000 * 2 ** attempt, MAX_DELAY_MS) - 50);
      expect(delay).toBeLessThanOrEqual(Math.min(5_000 * 2 ** attempt, MAX_DELAY_MS) + 1_000);
    }
    await OutboxEvent.updateOne({ dedupeKey: 'f' }, { $set: { availableAt: new Date(0) } });
    await processEvent((await claimNext())!);
    expect(await OutboxEvent.findOne({ dedupeKey: 'f' }).lean()).toMatchObject({ status: 'dead', attempts: MAX_ATTEMPTS, lastError: 'boom' });
    expect(await claimNext()).toBeNull();
  });

  it('an event with no consumer fails like any other', async () => {
    await emit('t.none', { collegeId: cid }, 'n');
    await processEvent((await claimNext())!);
    expect((await OutboxEvent.findOne({ dedupeKey: 'n' }).lean())?.lastError).toMatch(/No consumer registered for t.none/);
  });

  it('truncates lastError to 500 characters when a consumer throws a very long message', async () => {
    registerConsumer('t.longfail', async () => { throw new Error('x'.repeat(10_000)); });
    await emit('t.longfail', { collegeId: cid }, 'longfail');
    await processEvent((await claimNext())!);
    const row = (await OutboxEvent.findOne({ dedupeKey: 'longfail' }).lean())!;
    expect(row.lastError!.length).toBeLessThanOrEqual(MAX_LAST_ERROR_LENGTH);
    expect(row.lastError!.length).toBe(MAX_LAST_ERROR_LENGTH);
  });

  it('nextAvailableAt caps at ten minutes', () => {
    const now = new Date(0);
    expect(nextAvailableAt(1, now).getTime()).toBe(10_000);
    expect(nextAvailableAt(3, now).getTime()).toBe(40_000);
    expect(nextAvailableAt(7, now).getTime()).toBe(MAX_DELAY_MS);
  });
});

describe('processOnce, kick and drain', () => {
  it('runs sweepers first, then every claimable event', async () => {
    const order: string[] = [];
    registerSweeper(async () => { order.push('sweep'); });
    registerConsumer('t.a', async (p) => { order.push(`a:${p.i}`); });
    await emit('t.a', { collegeId: cid, i: 1 }, 'a1');
    await emit('t.a', { collegeId: cid, i: 2 }, 'a2');
    expect(await processOnce()).toBe(2);
    expect(order[0]).toBe('sweep');
    expect(order.slice(1).sort()).toEqual(['a:1', 'a:2']);
    expect(await OutboxEvent.countDocuments({ status: 'done' })).toBe(2);
  });

  it('skips the sweepers when asked (kick-triggered dispatcher runs)', async () => {
    let swept = 0;
    registerSweeper(async () => { swept += 1; });
    registerConsumer('t.s', async () => {});
    await emit('t.s', { collegeId: cid }, 's1');
    expect(await processOnce(500, { sweep: false })).toBe(1);
    expect(swept).toBe(0);
    await processOnce();
    expect(swept).toBe(1);
  });

  it('runs afterEvents sweepers after the events on every pass, kick or tick', async () => {
    const order: string[] = [];
    registerSweeper(async () => { order.push('after'); }, { afterEvents: true });
    registerConsumer('t.e', async () => { order.push('event'); });
    await emit('t.e', { collegeId: cid }, 'e1');
    await processOnce(500, { sweep: false });
    expect(order).toEqual(['event', 'after']);
    await processOnce();
    expect(order).toEqual(['event', 'after', 'after']);
  });

  it('kick uses the enqueuer when one is installed and falls back to inline processing otherwise', async () => {
    const handled: string[] = [];
    registerConsumer('t.k', async (_p, ev) => { handled.push(ev.dedupeKey); });
    let enqueued = 0;
    setTickEnqueuer(async () => { enqueued += 1; });
    await emit('t.k', { collegeId: cid }, 'k1');
    await kick();
    expect(enqueued).toBe(1);
    expect(handled).toEqual([]);                       // the queue would process it; nothing ran inline

    setTickEnqueuer(async () => { throw new Error('Queue not registered'); });
    await kick();
    expect(await drainOutbox()).toBeGreaterThanOrEqual(0);
    expect(handled).toEqual(['k1']);

    setTickEnqueuer(null);
    await emit('t.k', { collegeId: cid }, 'k2');
    await kick();
    await drainOutbox();
    expect(handled).toEqual(['k1', 'k2']);
  });

  it('drainOutbox processes until the outbox is quiet, including events emitted by a consumer', async () => {
    registerConsumer('t.first', async () => { await emit('t.second', { collegeId: cid }, 's'); });
    const done: string[] = [];
    registerConsumer('t.second', async () => { done.push('second'); });
    await emit('t.first', { collegeId: cid }, 'f');
    await drainOutbox();
    expect(done).toEqual(['second']);
    expect(await OutboxEvent.countDocuments({ status: 'done' })).toBe(2);
  });
});

describe('retryDead', () => {
  it('requeues a dead event of the college and ignores others', async () => {
    await emit('t.d', { collegeId: cid }, 'd');
    await OutboxEvent.updateOne({ dedupeKey: 'd' }, { $set: { status: 'dead', attempts: 8, lastError: 'x' } });
    expect(await retryDead(String(new Types.ObjectId()), 'd')).toBe(false);
    expect(await retryDead(cid, 'd')).toBe(true);
    const row = (await OutboxEvent.findOne({ dedupeKey: 'd' }).lean())!;
    expect(row).toMatchObject({ status: 'pending', attempts: 0 });
    expect(row.lastError).toBeUndefined();
  });
});

describe('OutboxEvent model', () => {
  it('expires done rows after 30 days through a partial TTL index', () => {
    const idx = OutboxEvent.schema.indexes().find(([fields]) => (fields as Record<string, number>).processedAt === 1);
    expect(idx?.[1]).toMatchObject({ expireAfterSeconds: 30 * 86_400, partialFilterExpression: { status: 'done' } });
    const unique = OutboxEvent.schema.indexes().find(([fields]) => (fields as Record<string, number>).dedupeKey === 1);
    expect(unique?.[1]).toMatchObject({ unique: true });
  });
});

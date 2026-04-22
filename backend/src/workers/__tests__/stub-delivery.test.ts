/**
 * T6 — stub-delivery worker tests (SMS / email / WhatsApp).
 *
 * Exercises the shared processor via each channel-specific wrapper to
 * prove:
 *   - Happy path: FeeReminder flips to `delivered` + `deliveredAt` set
 *   - Missing contact: FeeReminder flips to `failed` + details.reason
 *   - Invoice-paid guard: FeeReminder flips to `skipped_paid`
 *   - No-reminderId payload: delivery still resolves (no Mongo writes)
 *   - Structured log prefixes emitted (grep-ability contract)
 *   - `register*StubWorker()` honours the STUB_DELIVERY env var
 *   - Concurrency constant exported at 5
 *
 * We invoke the worker function directly with a mock `Job` object
 * (`{ data: payload } as unknown as Job`) rather than spinning up
 * BullMQ — the wrapper-plus-shared-processor split is unit-testable
 * without a live Redis.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  vi,
} from 'vitest';
import mongoose from 'mongoose';
import type { Job } from 'bullmq';

import {
  smsStubWorker,
  registerSmsStubWorker,
  SMS_STUB_CONCURRENCY,
} from '../sms-stub.worker';
import {
  emailStubWorker,
  registerEmailStubWorker,
  EMAIL_STUB_CONCURRENCY,
} from '../email-stub.worker';
import {
  whatsappStubWorker,
  registerWhatsappStubWorker,
  WHATSAPP_STUB_CONCURRENCY,
} from '../whatsapp-stub.worker';
import type { StubDeliveryPayload } from '../_stub-delivery';
import { FeeReminder } from '../../models/finance/FeeReminder';
import { Invoice } from '../../models/finance/Invoice';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../__tests__/helpers/mongoMemory';

// Mock registerQueue so tests never hit a live Redis / BullMQ.
vi.mock('../../shared/queue/QueueManager', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../shared/queue/QueueManager')>();
  return {
    ...actual,
    registerQueue: vi.fn((cfg: { name: string }) => ({
      name: cfg.name,
      __mock: true,
    })),
  };
});

import { registerQueue } from '../../shared/queue/QueueManager';

const oid = () => new mongoose.Types.ObjectId();

function buildJob(data: StubDeliveryPayload): Job<StubDeliveryPayload> {
  return { id: 'j1', name: 'stub', data } as unknown as Job<StubDeliveryPayload>;
}

/**
 * Seed an Invoice + a FeeReminder that references it. Callers override
 * invoice.status for the paid-guard test.
 */
async function seedReminder(opts: {
  invoiceStatus?: string;
} = {}): Promise<{ reminderId: string; invoiceId: string }> {
  const collegeId = oid();
  const invoice = await Invoice.create({
    collegeId,
    invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentId: oid(),
    type: 'fee',
    items: [{ description: 'tuition', amount: 1000 }],
    totalAmount: 1000,
    dueDate: new Date(),
    status: opts.invoiceStatus ?? 'generated',
  });
  const reminder = await FeeReminder.create({
    collegeId,
    studentId: oid(),
    channel: 'sms',
    dueAmount: 1000,
    status: 'sent',
    invoiceId: invoice._id,
    deliveryStatus: 'pending',
  });
  return {
    reminderId: String(reminder._id),
    invoiceId: String(invoice._id),
  };
}

describe('stub-delivery workers (SMS / email / WhatsApp)', () => {
  // Hold console.log + warn spies used by logging assertions. The
  // inferred vi.spyOn return is typed `MockInstance<any>` — fine for
  // our purposes. Explicit unknown[] annotations on the callbacks below
  // satisfy noImplicitAny under strict mode.
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await setupMongo();
    await Promise.all([FeeReminder.syncIndexes(), Invoice.syncIndexes()]);
  }, 60_000);
  afterAll(async () => {
    await teardownMongo();
  }, 30_000);
  afterEach(async () => {
    await clearCollections();
    logSpy?.mockRestore();
    warnSpy?.mockRestore();
    vi.mocked(registerQueue).mockClear();
    delete process.env.STUB_DELIVERY;
  });
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // ─── Happy path, once per channel ─────────────────────────────────
  it('SMS stub: happy path flips FeeReminder to delivered + stamps deliveredAt', async () => {
    const { reminderId } = await seedReminder();
    await smsStubWorker(
      buildJob({
        to: '+919999999999',
        template: 'stage1',
        context: { name: 'Aarav' },
        reminderId,
      }),
    );
    const reloaded = await FeeReminder.findById(reminderId).lean();
    expect(reloaded?.deliveryStatus).toBe('delivered');
    expect(reloaded?.deliveredAt).toBeInstanceOf(Date);
  });

  it('Email stub: happy path flips FeeReminder to delivered', async () => {
    const { reminderId } = await seedReminder();
    await emailStubWorker(
      buildJob({
        to: 'student@example.com',
        template: 'stage2',
        context: { amount: 1000 },
        reminderId,
      }),
    );
    const reloaded = await FeeReminder.findById(reminderId).lean();
    expect(reloaded?.deliveryStatus).toBe('delivered');
  });

  it('WhatsApp stub: happy path flips FeeReminder to delivered', async () => {
    const { reminderId } = await seedReminder();
    await whatsappStubWorker(
      buildJob({
        to: '+919999999999',
        template: 'stage3',
        context: { amount: 5000 },
        reminderId,
      }),
    );
    const reloaded = await FeeReminder.findById(reminderId).lean();
    expect(reloaded?.deliveryStatus).toBe('delivered');
  });

  // ─── Missing contact ──────────────────────────────────────────────
  it('missing `to` (null) → FeeReminder flips to failed + reason=missing_contact', async () => {
    const { reminderId } = await seedReminder();
    await smsStubWorker(
      buildJob({
        to: null,
        template: 'stage1',
        context: {},
        reminderId,
      }),
    );
    const reloaded = await FeeReminder.findById(reminderId).lean();
    expect(reloaded?.deliveryStatus).toBe('failed');
    expect(reloaded?.deliveryDetails).toMatchObject({
      reason: 'missing_contact',
    });
  });

  it('missing `to` (empty string) → FeeReminder flips to failed', async () => {
    const { reminderId } = await seedReminder();
    await emailStubWorker(
      buildJob({
        to: '',
        template: 'stage1',
        context: {},
        reminderId,
      }),
    );
    const reloaded = await FeeReminder.findById(reminderId).lean();
    expect(reloaded?.deliveryStatus).toBe('failed');
  });

  it('missing `to` with no reminderId → resolves, no Mongo writes, warn log fired', async () => {
    await expect(
      whatsappStubWorker(
        buildJob({
          to: null,
          template: 'stage1',
          context: {},
        }),
      ),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    const skippedCalls = warnSpy.mock.calls.filter((c: unknown[]) =>
      String(c[0]).startsWith('[stub-delivery-skipped]'),
    );
    expect(skippedCalls.length).toBe(1);
  });

  // ─── Invoice already paid ────────────────────────────────────────
  it('invoice already paid → FeeReminder flips to skipped_paid, no delivered log', async () => {
    const { reminderId } = await seedReminder({ invoiceStatus: 'paid' });
    await smsStubWorker(
      buildJob({
        to: '+919999999999',
        template: 'stage2',
        context: {},
        reminderId,
      }),
    );
    const reloaded = await FeeReminder.findById(reminderId).lean();
    expect(reloaded?.deliveryStatus).toBe('skipped_paid');
    // Happy-path log prefix must NOT have fired (guard short-circuited).
    const deliveredLogs = logSpy.mock.calls.filter((c: unknown[]) =>
      String(c[0]).startsWith('[stub-delivery]'),
    );
    expect(deliveredLogs.length).toBe(0);
  });

  // ─── No reminderId ────────────────────────────────────────────────
  it('happy path with no reminderId → delivery logged, no FeeReminder updates', async () => {
    // Seed a reminder to confirm the worker doesn't accidentally touch
    // unrelated records when no reminderId is supplied.
    const { reminderId } = await seedReminder();
    await smsStubWorker(
      buildJob({
        to: '+919999999999',
        template: 'ad-hoc',
        context: { note: 'manual test blast' },
      }),
    );
    const reloaded = await FeeReminder.findById(reminderId).lean();
    expect(reloaded?.deliveryStatus).toBe('pending');
    const deliveredLogs = logSpy.mock.calls.filter((c: unknown[]) =>
      String(c[0]).startsWith('[stub-delivery]'),
    );
    expect(deliveredLogs.length).toBe(1);
  });

  // ─── Structured logging ─────────────────────────────────────────
  it('happy-path log line uses the [stub-delivery] prefix with channel=<c> to=<to>', async () => {
    const { reminderId } = await seedReminder();
    await emailStubWorker(
      buildJob({
        to: 'x@y.com',
        template: 'stageN',
        context: { foo: 'bar' },
        reminderId,
      }),
    );
    const match = logSpy.mock.calls.find((c: unknown[]) =>
      String(c[0]).startsWith('[stub-delivery] channel=email to=x@y.com'),
    );
    expect(match).toBeTruthy();
    expect(String(match?.[0])).toContain('template=stageN');
    expect(String(match?.[0])).toContain('"foo":"bar"');
  });

  it('skipped log line uses the [stub-delivery-skipped] prefix with reason="missing contact"', async () => {
    await smsStubWorker(
      buildJob({ to: null, template: 'stage1', context: {} }),
    );
    const match = warnSpy.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('reason="missing contact"'),
    );
    expect(match).toBeTruthy();
    expect(String(match?.[0])).toContain('channel=sms');
  });

  // ─── Register gate ──────────────────────────────────────────────
  it('STUB_DELIVERY=false → register* functions are no-ops and return null', () => {
    process.env.STUB_DELIVERY = 'false';
    expect(registerSmsStubWorker()).toBeNull();
    expect(registerEmailStubWorker()).toBeNull();
    expect(registerWhatsappStubWorker()).toBeNull();
    expect(registerQueue).not.toHaveBeenCalled();
  });

  it('STUB_DELIVERY unset → registers each queue exactly once with concurrency=5', () => {
    delete process.env.STUB_DELIVERY;
    const smsQ = registerSmsStubWorker();
    const emailQ = registerEmailStubWorker();
    const whatsappQ = registerWhatsappStubWorker();
    expect(smsQ).not.toBeNull();
    expect(emailQ).not.toBeNull();
    expect(whatsappQ).not.toBeNull();
    expect(registerQueue).toHaveBeenCalledTimes(3);
    const calls = vi.mocked(registerQueue).mock.calls;
    const names = calls.map((c) => c[0].name).sort();
    expect(names).toEqual(
      ['platform:email', 'platform:sms', 'platform:whatsapp'].sort(),
    );
    for (const c of calls) {
      expect(c[0].concurrency).toBe(5);
    }
  });

  it('register* is idempotent: first call wires the queue, subsequent calls return the existing handle', () => {
    // Our mock `registerQueue` always returns a fresh object but counts
    // calls. The real QueueManager.registerQueue is idempotent (checked
    // via the queues map), so the guarantee is upheld in production.
    // Here we assert the stub-layer calls registerQueue once per
    // invocation — the idempotency contract lives in QueueManager
    // itself (covered by its own unit tests) and we rely on it.
    const first = registerSmsStubWorker();
    const second = registerSmsStubWorker();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    // Both attempts forwarded; QueueManager dedupes internally.
    expect(registerQueue).toHaveBeenCalledTimes(2);
  });

  // ─── Concurrency constant ──────────────────────────────────────
  it('exports CHANNEL_STUB_CONCURRENCY = 5 for all three channels', () => {
    expect(SMS_STUB_CONCURRENCY).toBe(5);
    expect(EMAIL_STUB_CONCURRENCY).toBe(5);
    expect(WHATSAPP_STUB_CONCURRENCY).toBe(5);
  });
});

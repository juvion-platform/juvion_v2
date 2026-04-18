import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { verifyPaymentWebhookSignature } from '../webhookSignature';
import { PaymentGatewayLog } from '../../models/finance/PaymentGatewayLog';
import { setupMongo, teardownMongo, clearCollections } from '../../__tests__/helpers/mongoMemory';

/**
 * Unit tests for the payment-webhook HMAC verification middleware.
 *
 * Structured to exercise every rejection path explicitly — silent failures
 * in auth code are how fraud gets through.
 */

const SECRET = 'test-webhook-secret';

// Build a fake (req, res, next) triad for middleware-under-test
function buildCtx(opts: {
  body: unknown;
  signature?: string;
  rawBody?: Buffer;
}) {
  const rawBody = opts.rawBody ?? Buffer.from(JSON.stringify(opts.body));
  const req: Partial<Request> & { rawBody?: Buffer; collegeId?: string; webhookVerified?: boolean } = {
    body: opts.body,
    rawBody,
    header: vi.fn((name: string) => {
      if (name.toLowerCase() === 'x-webhook-signature') return opts.signature;
      return undefined;
    }) as never,
  };
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis() as never,
    json: vi.fn() as never,
  };
  const next = vi.fn();
  return { req: req as Request, res: res as Response, next };
}

function sign(body: unknown, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

describe('verifyPaymentWebhookSignature', () => {
  beforeAll(async () => {
    await setupMongo();
    process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
  });
  afterAll(async () => {
    await teardownMongo();
    delete process.env.PAYMENT_WEBHOOK_SECRET;
  });
  afterEach(async () => {
    await clearCollections();
    vi.restoreAllMocks();
  });

  async function seedGatewayLog(orderId: string) {
    return PaymentGatewayLog.create({
      collegeId: new mongoose.Types.ObjectId(),
      studentId: new mongoose.Types.ObjectId(),
      orderId,
      gateway: 'razorpay',
      amount: 1000,
      status: 'initiated',
    });
  }

  it('rejects (401) when X-Webhook-Signature header is missing', async () => {
    const { req, res, next } = buildCtx({ body: { orderId: 'x' } });
    await verifyPaymentWebhookSignature(req as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects (503) when PAYMENT_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    const body = { orderId: 'o1', amount: 100, transactionRef: 't1' };
    const { req, res, next } = buildCtx({ body, signature: sign(body) });
    await verifyPaymentWebhookSignature(req as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
    process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
  });

  it('rejects (400) when raw body is missing', async () => {
    const body = { orderId: 'o1' };
    const { req, res, next } = buildCtx({ body, signature: sign(body), rawBody: Buffer.alloc(0) });
    await verifyPaymentWebhookSignature(req as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects (401) when signature is wrong', async () => {
    await seedGatewayLog('o1');
    const body = { orderId: 'o1', amount: 100, transactionRef: 't1' };
    const { req, res, next } = buildCtx({
      body,
      signature: 'deadbeef'.repeat(8), // 64 chars, valid hex length, wrong value
    });
    await verifyPaymentWebhookSignature(req as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects (401) when signature is correct length but different bytes', async () => {
    await seedGatewayLog('o1');
    const body = { orderId: 'o1', amount: 100, transactionRef: 't1' };
    // Sign a DIFFERENT body with the same secret — proves we hash the real bytes
    const sigForWrongBody = sign({ orderId: 'o2', amount: 100, transactionRef: 't1' });
    const { req, res, next } = buildCtx({ body, signature: sigForWrongBody });
    await verifyPaymentWebhookSignature(req as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects (400) when body lacks orderId', async () => {
    const body = { foo: 'bar' };
    const { req, res, next } = buildCtx({ body, signature: sign(body) });
    await verifyPaymentWebhookSignature(req as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects (404) when orderId does not match any PaymentGatewayLog', async () => {
    const body = { orderId: 'non-existent', amount: 100, transactionRef: 't1' };
    const { req, res, next } = buildCtx({ body, signature: sign(body) });
    await verifyPaymentWebhookSignature(req as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid signature and sets req.collegeId', async () => {
    const log = await seedGatewayLog('o1');
    const body = { orderId: 'o1', amount: 100, transactionRef: 't1' };
    const { req, res, next } = buildCtx({ body, signature: sign(body) });
    await verifyPaymentWebhookSignature(req as never, res as never, next as never);
    expect(next).toHaveBeenCalled();
    expect((req as { collegeId?: string }).collegeId).toBe(String(log.collegeId));
    expect((req as { webhookVerified?: boolean }).webhookVerified).toBe(true);
  });

  it('is case-insensitive on the signature hex', async () => {
    await seedGatewayLog('o1');
    const body = { orderId: 'o1' };
    const sig = sign(body);
    const { req, res, next } = buildCtx({ body, signature: sig.toUpperCase() });
    await verifyPaymentWebhookSignature(req as never, res as never, next as never);
    expect(next).toHaveBeenCalled();
  });

  it('accepts lowercase `x-webhook-signature` header name too', async () => {
    const log = await seedGatewayLog('o1');
    const body = { orderId: 'o1' };
    const rawBody = Buffer.from(JSON.stringify(body));
    const req = {
      body,
      rawBody,
      header: (name: string) => (name === 'x-webhook-signature' ? sign(body) : undefined),
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await verifyPaymentWebhookSignature(req as never, res as never, next as never);
    expect(next).toHaveBeenCalled();
    expect((req as { collegeId?: string }).collegeId).toBe(String(log.collegeId));
  });
});

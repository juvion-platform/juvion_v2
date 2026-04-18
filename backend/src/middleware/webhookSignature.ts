import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PaymentGatewayLog } from '../models/finance/PaymentGatewayLog';
import { AuthRequest } from '../shared/types';

/**
 * HMAC-SHA256 webhook signature verification for the payment gateway.
 *
 * Payment gateways (Razorpay, Paytm, CCAvenue, HDFC) post to our webhook
 * endpoint to confirm a payment. Without signature verification, any
 * unauthenticated caller can POST a fake payment confirmation and cause
 * us to mark an invoice paid. This middleware closes that hole.
 *
 * Protocol:
 *   1. Gateway computes HMAC-SHA256(rawBody) with a shared secret and
 *      sends the hex digest in the `X-Webhook-Signature` header.
 *   2. We recompute the HMAC locally and compare timing-safely.
 *   3. We resolve the target college from the `orderId` in the body via
 *      PaymentGatewayLog (which was created when payment was initiated).
 *   4. On success we set `req.collegeId` so downstream code can operate
 *      multi-tenant-scoped without needing `authenticate` middleware.
 *
 * Why raw body: HMAC must be computed over the exact byte sequence the
 * sender signed. Express's JSON parser re-serialization can produce
 * slightly different bytes (key ordering, whitespace) and break the hash.
 * `app.ts` captures `req.rawBody` via the `verify` hook on express.json().
 *
 * Secret source: `PAYMENT_WEBHOOK_SECRET` env var, shared across colleges
 * because typical SaaS deployments have a single gateway account. If a
 * per-college secret is ever needed, the lookup point is marked below.
 */

export async function verifyPaymentWebhookSignature(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const signature = req.header('X-Webhook-Signature') ?? req.header('x-webhook-signature');
  if (!signature) {
    res.status(401).json({ error: 'Missing X-Webhook-Signature header' });
    return;
  }

  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    // Not set in env — reject in all environments (including dev) to make
    // the configuration mistake loud rather than silently bypassable.
    console.error('[webhookSignature] PAYMENT_WEBHOOK_SECRET not configured');
    res.status(503).json({ error: 'Webhook verification not configured' });
    return;
  }

  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody || rawBody.length === 0) {
    res.status(400).json({ error: 'Empty request body' });
    return;
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // Timing-safe comparison. Normalize case and length before comparing
  // because `timingSafeEqual` throws on length mismatch.
  const a = Buffer.from(signature.toLowerCase(), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  // Resolve multi-tenancy scope from the orderId in the body.
  const orderId = (req.body as { orderId?: unknown })?.orderId;
  if (typeof orderId !== 'string' || orderId.length === 0) {
    res.status(400).json({ error: 'orderId required in body' });
    return;
  }

  // PER-COLLEGE SECRET EXTENSION POINT: if you later want per-college
  // secrets, look up CampusConfig here and re-verify with the college's
  // own secret. For now we trust the shared-secret + orderId lookup.
  const log = await PaymentGatewayLog.findOne({ orderId }).select('collegeId').lean();
  if (!log) {
    res.status(404).json({ error: 'Unknown orderId' });
    return;
  }

  req.collegeId = String(log.collegeId);
  // Flag that signature verification passed so the service layer can
  // trust it without re-doing the work. See service.ts.
  (req as unknown as { webhookVerified?: boolean }).webhookVerified = true;
  next();
}

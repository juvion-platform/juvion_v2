import { Request, Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { setPushToken, clearPushToken } from '../accounts/session-service';
import { MobileApiError } from '../errors';
import { pushTokenRequestSchema, receiptsRequestSchema, eventsEnvelopeSchema } from './schemas';
import { applyReceipts } from './receipts';
import { ingestEvents } from './events-service';

export async function putPushToken(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    await setPushToken(ctx.sessionId, ctx.collegeId, pushTokenRequestSchema.parse(req.body).token);
    res.status(204).end();
  } catch (e) { next(e); }
}

export async function deletePushToken(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    await clearPushToken(ctx.sessionId, ctx.collegeId);
    res.status(204).end();
  } catch (e) { next(e); }
}

/** No session: each item's HMAC receipt authorises its row (spec §7.2). 401 only when every item fails. */
export async function postReceipts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await applyReceipts(receiptsRequestSchema.parse(req.body).items);
    if (result.accepted === 0) throw new MobileApiError(401, 'RECEIPT_INVALID', 'No receipt could be verified.');
    res.json(result);
  } catch (e) { next(e); }
}

export async function postEvents(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    const meta = { appVersion: String(req.headers['x-juvi-app-version'] ?? ''), platform: String(req.headers['x-juvi-platform'] ?? '') };
    res.json(await ingestEvents(ctx, eventsEnvelopeSchema.parse(req.body).events, meta));
  } catch (e) { next(e); }
}

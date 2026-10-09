import { Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { noticeListQuerySchema, ackRequestSchema, pendingQuerySchema } from './schemas';
import * as svc from './mobile-service';
import * as acks from './ack-service';
import * as reachSvc from './reach-service';
import { remindNotice } from './publish-service';
import { getFirstNotice } from './welcome-service';

// Notice ids are passed through unparsed: a malformed id is 404 NOTICE_NOT_FOUND, like any notice the caller cannot see.
const id = (req: MobileRequest) => String(req.params.id);

export async function attention(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    // R31: a missing kinds returns the legacy shape; the only widened value is all.
    const kinds = req.query.kinds;
    if (kinds !== undefined && kinds !== 'all') throw new MobileApiError(400, 'VALIDATION_FAILED', 'kinds must be "all"');
    const ctx = requireMobile(req);
    res.json(kinds === 'all' ? await svc.attentionAll(ctx) : await svc.attention(ctx));
  } catch (e) { next(e); }
}
export async function list(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.listNotices(requireMobile(req), noticeListQuerySchema.parse(req.query))); } catch (e) { next(e); }
}
export async function detail(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.getNoticeDetail(requireMobile(req), id(req))); } catch (e) { next(e); }
}
export async function seen(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.markSeen(requireMobile(req), id(req))); } catch (e) { next(e); }
}
export async function attachmentUrl(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.attachmentUrl(requireMobile(req), id(req), String(req.params.key))); } catch (e) { next(e); }
}
export async function ack(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await acks.acknowledge(requireMobile(req), id(req), ackRequestSchema.parse(req.body ?? {}))); } catch (e) { next(e); }
}
export async function dismiss(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await acks.dismiss(requireMobile(req), id(req))); } catch (e) { next(e); }
}

// Reach, pending and remind check the caller's role first: a student or parent is refused (and audited) even for a notice that does not exist.
export async function reach(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    const actor = await reachSvc.mobileActor(ctx);
    await reachSvc.refuseNonPublisher(actor, id(req), 'reach');
    const notice = await reachSvc.manageableNotice(actor, id(req), 'reach');
    res.json(await reachSvc.buildReach(ctx.collegeId, notice));
  } catch (e) { next(e); }
}
export async function pending(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const ctx = requireMobile(req);
    const actor = await reachSvc.mobileActor(ctx);
    await reachSvc.refuseNonPublisher(actor, id(req), 'reach');
    const notice = await reachSvc.manageableNotice(actor, id(req), 'reach');
    res.json(await reachSvc.pendingPage(ctx.collegeId, notice, pendingQuerySchema.parse(req.query)));
  } catch (e) { next(e); }
}
export async function remind(req: MobileRequest, res: Response, next: NextFunction) {
  try {
    const actor = await reachSvc.mobileActor(requireMobile(req));
    await reachSvc.refuseNonPublisher(actor, id(req), 'remind');
    res.json(await remindNotice(actor, id(req)));
  } catch (e) { next(e); }
}

export async function firstNotice(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await getFirstNotice(requireMobile(req))); } catch (e) { next(e); }
}

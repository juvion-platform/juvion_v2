import { Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { noticeListQuerySchema, ackRequestSchema } from './schemas';
import * as svc from './mobile-service';
import * as acks from './ack-service';

// Notice ids are passed through unparsed: a malformed id is 404 NOTICE_NOT_FOUND, like any notice the caller cannot see.
const id = (req: MobileRequest) => String(req.params.id);

export async function attention(req: MobileRequest, res: Response, next: NextFunction) {
  try { res.json(await svc.attention(requireMobile(req))); } catch (e) { next(e); }
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

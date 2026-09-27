import { Response, NextFunction } from 'express';
import { MobileRequest, requireMobile } from '../middleware/authenticate-mobile';
import { noticeListQuerySchema } from './schemas';
import * as svc from './mobile-service';

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

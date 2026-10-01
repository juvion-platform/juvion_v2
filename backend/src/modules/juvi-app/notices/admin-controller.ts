import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/authenticate';
import { AppError } from '../../../middleware/errorHandler';
import { NOTICE_ATTACHMENT_MIMES, NOTICE_ATTACHMENT_MAX_BYTES } from '../../../models/juvi/Notice';
import { resolvePublisherScope, ErpUserRef } from './publisher-scope';
import { loadAudienceGraph } from './audience-graph';
import { allowedTargets } from './scope';
import { uploadAttachment, previewAudience, publishNotice, remindNotice, archiveNotice } from './publish-service';
import { erpActor, manageableNotice, buildReach, pendingPage, reachCsv } from './reach-service';
import { listAdminNotices, getAdminNotice, auditTrail, retryDelivery } from './admin-service';
import { publishSchema, audiencePreviewSchema, adminNoticeListQuerySchema } from './admin-schemas';
import { pendingQuerySchema } from './schemas';

const UNSUPPORTED = 'Unsupported file type. Use PDF, PNG, JPEG, WEBP, DOCX, XLSX or PPTX.';

/** Memory storage (the buffer goes straight to S3), one file, 10 MB, the spec §6.1 MIME list. */
export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: NOTICE_ATTACHMENT_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!NOTICE_ATTACHMENT_MIMES.includes(file.mimetype)) { cb(new AppError(400, UNSUPPORTED)); return; }
    cb(null, true);
  },
});

export function attachmentUploadErrors(err: unknown, _req: Request, _res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    next(new AppError(400, err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10 MB)' : err.message));
    return;
  }
  next(err);
}

const cid = (req: AuthRequest) => req.collegeId!;
const actor = (req: AuthRequest) => erpActor(cid(req), req.user!);
const who = (req: AuthRequest) => req.user?.name || 'System';
const userRef = (req: AuthRequest): ErpUserRef => ({ id: req.user!.id, role: req.user!.role, personaType: req.user!.personaType, personas: req.user!.personas });
const id = (req: AuthRequest) => String(req.params.id);

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await listAdminNotices(actor(req), adminNoticeListQuerySchema.parse(req.query))); } catch (e) { next(e); }
}
export async function targets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const scope = await resolvePublisherScope(cid(req), userRef(req));
    res.json({ office: scope.office, ...allowedTargets(scope, await loadAudienceGraph(cid(req))) });
  } catch (e) { next(e); }
}
export async function detail(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await getAdminNotice(actor(req), id(req))); } catch (e) { next(e); }
}
export async function reach(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await buildReach(cid(req), await manageableNotice(actor(req), id(req), 'reach'))); } catch (e) { next(e); }
}
export async function pending(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await pendingPage(cid(req), await manageableNotice(actor(req), id(req), 'reach'), pendingQuerySchema.parse(req.query))); } catch (e) { next(e); }
}
export async function csv(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const a = actor(req);
    if (!a.isAdmin) throw new AppError(403, 'Only admins can export reach');
    const notice = await manageableNotice(a, id(req), 'reach');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="notice-reach-${String(notice._id).slice(-6)}.csv"`);
    res.send(await reachCsv(cid(req), notice));
  } catch (e) { next(e); }
}
export async function audit(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await auditTrail(actor(req), id(req))); } catch (e) { next(e); }
}
export async function upload(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    res.status(201).json(await uploadAttachment(cid(req), req.file));
  } catch (e) { next(e); }
}
export async function preview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = audiencePreviewSchema.parse(req.body);
    const scope = await resolvePublisherScope(cid(req), userRef(req), body.office);
    res.json(await previewAudience(cid(req), scope, body.rules));
  } catch (e) { next(e); }
}
export async function publish(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = publishSchema.parse(req.body);
    const scope = await resolvePublisherScope(cid(req), userRef(req), body.office);
    const notice = await publishNotice(cid(req), scope, body, who(req));
    res.status(201).json(await getAdminNotice(actor(req), String(notice._id)));
  } catch (e) { next(e); }
}
export async function remind(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await remindNotice(actor(req), id(req))); } catch (e) { next(e); }
}
export async function archive(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await archiveNotice(actor(req), id(req))); } catch (e) { next(e); }
}
export async function retry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await retryDelivery(actor(req), id(req))); } catch (e) { next(e); }
}

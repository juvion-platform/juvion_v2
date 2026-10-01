/**
 * Mobile reads (spec §7.1). Every read requires the caller's recipient row
 * (accountId = the caller's account); anything else is 404 NOTICE_NOT_FOUND.
 */
import { Types } from 'mongoose';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient, LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { getPresignedUrl, isS3Configured } from '../../../shared/s3/s3-client';
import { MobileContext } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { toCard, toDetail } from './cards';
import { AttentionResponse, NoticeCard, NoticeDetail, NoticeListQuery, NoticeListResponse } from './schemas';

export const ATTENTION_ITEMS = 3;
export const DUE_SCAN_MAX = 500;
export const ATTACHMENT_URL_TTL_SECONDS = 300;

interface Cursor { t?: string; id?: string; o?: number }
interface Pair { notice: LeanNotice; row: LeanNoticeRecipient }

export const noticeNotFound = () => new MobileApiError(404, 'NOTICE_NOT_FOUND', 'This notice is not available.');
const badCursor = () => new MobileApiError(400, 'VALIDATION_FAILED', 'That page cursor is not valid.');

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (c && typeof c === 'object' && !Array.isArray(c)) return c as Cursor;
  } catch { /* fall through */ }
  throw badCursor();
}

/** Keyset continuation on (field desc, _id desc). */
function after(field: string, raw?: string): Record<string, unknown> | null {
  if (!raw) return null;
  const c = decodeCursor(raw);
  if (typeof c.t !== 'string' || Number.isNaN(Date.parse(c.t)) || typeof c.id !== 'string' || !Types.ObjectId.isValid(c.id)) throw badCursor();
  const t = new Date(c.t);
  const id = new Types.ObjectId(c.id);
  return { $or: [{ [field]: { $lt: t } }, { [field]: t, _id: { $lt: id } }] };
}

function offsetOf(raw?: string): number {
  if (!raw) return 0;
  const c = decodeCursor(raw);
  if (typeof c.o !== 'number' || !Number.isInteger(c.o) || c.o < 0) throw badCursor();
  return c.o;
}

/** The caller's recipient row and its notice. */
export async function recipientContext(ctx: MobileContext, noticeId: string): Promise<Pair> {
  if (!Types.ObjectId.isValid(noticeId)) throw noticeNotFound();
  const row = await NoticeRecipient.findOne({ collegeId: ctx.collegeId, noticeId, accountId: ctx.accountId }).lean<LeanNoticeRecipient>();
  const notice = row
    ? await Notice.findOne({ _id: noticeId, collegeId: ctx.collegeId, status: { $in: ['published', 'archived'] } }).lean<LeanNotice>()
    : null;
  if (!row || !notice) throw noticeNotFound();
  return { notice, row };
}

async function noticesById(collegeId: string, ids: Types.ObjectId[], statuses: string[]): Promise<Map<string, LeanNotice>> {
  const rows = await Notice.find({ collegeId, _id: { $in: ids }, status: { $in: statuses } }).lean<LeanNotice[]>();
  return new Map(rows.map((n) => [String(n._id), n]));
}

const time = (d?: Date | null) => (d ? new Date(d).getTime() : Number.POSITIVE_INFINITY);

/** Acknowledgement-required, not acknowledged, not dismissed, not archived; deadline ascending with nulls last, then receivedAt. */
async function loadDue(ctx: MobileContext): Promise<Pair[]> {
  const rows = await NoticeRecipient.find({
    collegeId: ctx.collegeId, accountId: ctx.accountId, ackRequired: true, ack: null, dismissedAt: null, archived: false,
  }).sort({ receivedAt: 1 }).limit(DUE_SCAN_MAX).lean<LeanNoticeRecipient[]>();
  const byId = await noticesById(ctx.collegeId, rows.map((r) => r.noticeId), ['published']);
  const due = rows.flatMap((row) => { const notice = byId.get(String(row.noticeId)); return notice ? [{ notice, row }] : []; });
  due.sort((a, b) => {
    const da = time(a.row.deadline); const db = time(b.row.deadline);
    if (da !== db) return da < db ? -1 : 1;
    return time(a.row.receivedAt) - time(b.row.receivedAt);
  });
  return due;
}

export async function attention(ctx: MobileContext): Promise<AttentionResponse> {
  const due = await loadDue(ctx);
  return { dueCount: due.length, items: due.slice(0, ATTENTION_ITEMS).map(({ notice, row }) => toCard(notice, row, ctx.userId)) };
}

async function officeNoticeIds(collegeId: string, office: string): Promise<Types.ObjectId[]> {
  return (await Notice.distinct('_id', { collegeId, 'publisher.office': office })) as Types.ObjectId[];
}

export async function listNotices(ctx: MobileContext, q: NoticeListQuery): Promise<NoticeListResponse> {
  if (q.segment === 'due') {
    const due = (await loadDue(ctx)).filter((d) => !q.office || d.notice.publisher.office === q.office);
    const offset = offsetOf(q.cursor);
    const page = due.slice(offset, offset + q.limit);
    return {
      items: page.map(({ notice, row }) => toCard(notice, row, ctx.userId)),
      nextCursor: offset + q.limit < due.length ? encodeCursor({ o: offset + q.limit }) : null,
    };
  }

  if (q.segment === 'published') {
    const clauses: Record<string, unknown>[] = [{ collegeId: ctx.collegeId, 'publisher.userId': new Types.ObjectId(ctx.userId) }];
    if (q.office) clauses.push({ 'publisher.office': q.office });
    const cont = after('createdAt', q.cursor);
    if (cont) clauses.push(cont);
    const notices = await Notice.find({ $and: clauses }).sort({ createdAt: -1, _id: -1 }).limit(q.limit + 1).lean<LeanNotice[]>();
    const page = notices.slice(0, q.limit);
    const rows = await NoticeRecipient.find({ collegeId: ctx.collegeId, accountId: ctx.accountId, noticeId: { $in: page.map((n) => n._id) } }).lean<LeanNoticeRecipient[]>();
    const rowBy = new Map(rows.map((r) => [String(r.noticeId), r]));
    const last = page[page.length - 1];
    return {
      items: page.map((n) => toCard(n, rowBy.get(String(n._id)) ?? null, ctx.userId)),
      nextCursor: notices.length > q.limit && last ? encodeCursor({ t: new Date(last.createdAt).toISOString(), id: String(last._id) }) : null,
    };
  }

  // done | all: the caller's rows, newest received first.
  const clauses: Record<string, unknown>[] = [{ collegeId: ctx.collegeId, accountId: new Types.ObjectId(ctx.accountId) }];
  if (q.segment === 'done') clauses.push({ $or: [{ ack: { $ne: null } }, { dismissedAt: { $ne: null } }] });
  if (q.office) clauses.push({ noticeId: { $in: await officeNoticeIds(ctx.collegeId, q.office) } });
  const cont = after('receivedAt', q.cursor);
  if (cont) clauses.push(cont);
  const rows = await NoticeRecipient.find({ $and: clauses }).sort({ receivedAt: -1, _id: -1 }).limit(q.limit + 1).lean<LeanNoticeRecipient[]>();
  const page = rows.slice(0, q.limit);
  const byId = await noticesById(ctx.collegeId, page.map((r) => r.noticeId), ['published', 'archived']);
  const last = page[page.length - 1];
  return {
    items: page.flatMap((row) => { const n = byId.get(String(row.noticeId)); return n ? [toCard(n, row, ctx.userId)] : []; }),
    nextCursor: rows.length > q.limit && last?.receivedAt ? encodeCursor({ t: new Date(last.receivedAt).toISOString(), id: String(last._id) }) : null,
  };
}

export async function getNoticeDetail(ctx: MobileContext, noticeId: string): Promise<NoticeDetail> {
  const { notice, row } = await recipientContext(ctx, noticeId);
  return toDetail(notice, row, ctx.userId);
}

/** Sets seenAt once; later calls return the first value (US-2.1). */
export async function markSeen(ctx: MobileContext, noticeId: string): Promise<{ seenAt: string }> {
  const { row } = await recipientContext(ctx, noticeId);
  if (!row.seenAt) await NoticeRecipient.updateOne({ _id: row._id, collegeId: ctx.collegeId, seenAt: null }, { $set: { seenAt: new Date() } });
  const fresh = await NoticeRecipient.findOne({ _id: row._id, collegeId: ctx.collegeId }).select('seenAt').lean();
  return { seenAt: new Date(fresh!.seenAt!).toISOString() };
}

/** A 5-minute URL, only for a key in the notice's own attachment list (spec §10). */
export async function attachmentUrl(ctx: MobileContext, noticeId: string, key: string): Promise<{ url: string; expiresAt: string }> {
  const { notice } = await recipientContext(ctx, noticeId);
  if (!notice.attachments.some((a) => a.key === key)) throw new MobileApiError(404, 'NOT_FOUND', 'Attachment not found');
  if (!isS3Configured()) throw new MobileApiError(503, 'INTERNAL', 'Attachments are unavailable right now. Please try again later.');
  const signed = await getPresignedUrl(key, { expiresIn: ATTACHMENT_URL_TTL_SECONDS });
  return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
}

export const CHANNEL_NOTICES_MAX = 20;

/** Inline cards for a channel (NTC-07): notices carrying the channel that the caller received. */
export async function channelNotices(ctx: MobileContext, channelId: string): Promise<NoticeCard[]> {
  const notices = await Notice.find({ collegeId: ctx.collegeId, channelIds: new Types.ObjectId(channelId), status: { $in: ['published', 'archived'] } })
    .sort({ publishedAt: -1 }).limit(100).lean<LeanNotice[]>();
  if (notices.length === 0) return [];
  const rows = await NoticeRecipient.find({ collegeId: ctx.collegeId, accountId: ctx.accountId, noticeId: { $in: notices.map((n) => n._id) } }).lean<LeanNoticeRecipient[]>();
  const rowBy = new Map(rows.map((r) => [String(r.noticeId), r]));
  return notices
    .flatMap((n) => { const row = rowBy.get(String(n._id)); return row ? [toCard(n, row, ctx.userId)] : []; })
    .slice(0, CHANNEL_NOTICES_MAX);
}

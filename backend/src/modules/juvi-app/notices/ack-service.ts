/**
 * Acknowledge and dismiss (spec §7.1, §10). Acknowledgement is immutable: a
 * conditional update on `ack: null` means two racing requests produce one
 * record and one 409.
 */
import { Types } from 'mongoose';
import { NoticeRecipient, LeanNoticeRecipient, INoticeAck } from '../../../models/juvi/NoticeRecipient';
import { emit, kick } from '../../../shared/outbox';
import { MobileContext } from '../middleware/authenticate-mobile';
import { MobileApiError } from '../errors';
import { recipientContext } from './mobile-service';
import { NOTICE_EVENTS, noticeEventKey } from './publish-service';
import { AckRequest, AckResponse } from './schemas';

/** Late is decided by the server's receipt time, never the client's clock (US-2.4). */
export function isLate(deadline: Date | null | undefined, receivedAt: Date): boolean {
  return Boolean(deadline) && receivedAt.getTime() > new Date(deadline!).getTime();
}

export function ackView(ack: INoticeAck): AckResponse {
  return {
    ackAt: new Date(ack.at).toISOString(), late: ack.late, method: ack.method, offline: ack.offline,
    comment: ack.comment ?? null, clientAt: ack.clientAt ? new Date(ack.clientAt).toISOString() : null,
  };
}

const alreadyAcknowledged = (ack: INoticeAck) =>
  new MobileApiError(409, 'ALREADY_ACKNOWLEDGED', 'You have already acknowledged this notice.', { ack: ackView(ack) });
const archived = () => new MobileApiError(409, 'NOTICE_ARCHIVED', 'This notice has been archived.');

export async function acknowledge(ctx: MobileContext, noticeId: string, input: AckRequest, now = new Date()): Promise<AckResponse> {
  const { notice, row } = await recipientContext(ctx, noticeId);
  if (row.ack) throw alreadyAcknowledged(row.ack);
  if (notice.status === 'archived' || row.archived) throw archived();
  if (!row.ackRequired) throw new MobileApiError(409, 'ACK_NOT_REQUIRED', 'This notice does not need an acknowledgement.');
  const comment = input.comment?.trim() || undefined;
  if (comment && !notice.ackCommentAllowed) {
    throw new MobileApiError(400, 'VALIDATION_FAILED', 'Comments are not allowed on this notice.', { fields: [{ path: 'comment', message: 'Comments are not allowed on this notice.' }] });
  }

  const ack: INoticeAck = {
    at: now, late: isLate(row.deadline, now), method: input.method, sessionId: new Types.ObjectId(ctx.sessionId), offline: input.offline,
    ...(input.clientAt ? { clientAt: new Date(input.clientAt) } : {}),
    ...(comment ? { comment } : {}),
  };
  const updated = await NoticeRecipient.findOneAndUpdate(
    { _id: row._id, collegeId: ctx.collegeId, ack: null },
    { $set: { ack } },
    { new: true },
  ).lean<LeanNoticeRecipient>();
  if (!updated) {
    const existing = await NoticeRecipient.findOne({ _id: row._id, collegeId: ctx.collegeId }).select('ack').lean<LeanNoticeRecipient>();
    throw alreadyAcknowledged(existing!.ack!);
  }
  if (!updated.seenAt) await NoticeRecipient.updateOne({ _id: row._id, collegeId: ctx.collegeId, seenAt: null }, { $set: { seenAt: now } });

  const personId = String(row.personId);
  await emit(NOTICE_EVENTS.acknowledged, { collegeId: ctx.collegeId, noticeId, recipientId: String(row._id), personId }, noticeEventKey.acknowledged(noticeId, personId));
  await kick();
  return ackView(updated.ack!);
}

/** Only a notice that needs no acknowledgement can be dismissed; a repeat returns the first dismissal. */
export async function dismiss(ctx: MobileContext, noticeId: string, now = new Date()): Promise<{ dismissedAt: string }> {
  const { notice, row } = await recipientContext(ctx, noticeId);
  if (notice.status === 'archived' || row.archived) throw archived();
  if (row.ackRequired) throw new MobileApiError(409, 'ACK_REQUIRED', 'This notice needs an acknowledgement.');
  if (!row.dismissedAt) {
    await NoticeRecipient.updateOne(
      { _id: row._id, collegeId: ctx.collegeId, dismissedAt: null },
      { $set: { dismissedAt: now, ...(row.seenAt ? {} : { seenAt: now }) } },
    );
  }
  const fresh = await NoticeRecipient.findOne({ _id: row._id, collegeId: ctx.collegeId }).select('dismissedAt').lean();
  return { dismissedAt: new Date(fresh!.dismissedAt!).toISOString() };
}

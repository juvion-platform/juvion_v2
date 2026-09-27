import { LeanNotice } from '../../../models/juvi/Notice';
import { LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { NoticeCard, NoticeDetail, NoticeState } from './schemas';

export const PREVIEW_CHARS = 160;

const iso = (d?: Date | null): string | null => (d ? new Date(d).toISOString() : null);

/** received → seen → acknowledged | dismissed (spec §2 goal 3). */
export function noticeState(row: Pick<LeanNoticeRecipient, 'ack' | 'dismissedAt' | 'seenAt'> | null): NoticeState {
  if (!row) return 'received';
  if (row.ack) return 'acknowledged';
  if (row.dismissedAt) return 'dismissed';
  if (row.seenAt) return 'seen';
  return 'received';
}

export function previewOf(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_CHARS ? `${flat.slice(0, PREVIEW_CHARS - 1)}…` : flat;
}

/** `row` is null only in the publisher's `published` segment, for a notice they did not receive. */
export function toCard(notice: LeanNotice, row: LeanNoticeRecipient | null, viewerUserId: string): NoticeCard {
  return {
    id: String(notice._id),
    title: notice.title,
    preview: previewOf(notice.body),
    office: notice.publisher.office,
    audienceLine: notice.audience.line,
    priority: notice.priority,
    purpose: notice.purpose,
    ackRequired: notice.ackRequired,
    ackCommentAllowed: notice.ackCommentAllowed,
    deadline: iso(notice.ackDeadline),
    publishedAt: iso(notice.publishedAt),
    archived: notice.status === 'archived' || Boolean(row?.archived),
    attachmentCount: notice.attachments.length,
    state: noticeState(row),
    seenAt: iso(row?.seenAt),
    ackAt: iso(row?.ack?.at),
    late: Boolean(row?.ack?.late),
    remindedAt: iso(row?.remindedAt),
    isPublisher: notice.publisher.userId ? String(notice.publisher.userId) === viewerUserId : false,
  };
}

export function toDetail(notice: LeanNotice, row: LeanNoticeRecipient | null, viewerUserId: string): NoticeDetail {
  return {
    ...toCard(notice, row, viewerUserId),
    body: notice.body,
    attachments: notice.attachments.map(({ key, name, mime, size }) => ({ key, name, mime, size })),
    ackMethod: row?.ack?.method ?? null,
    ackOffline: Boolean(row?.ack?.offline),
    ackComment: row?.ack?.comment ?? null,
    ackClientAt: iso(row?.ack?.clientAt),
    dismissedAt: iso(row?.dismissedAt),
  };
}

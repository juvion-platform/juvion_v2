import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { LeanNotice } from '../../../../models/juvi/Notice';
import { LeanNoticeRecipient } from '../../../../models/juvi/NoticeRecipient';
import { toCard, toDetail, noticeState, previewOf, PREVIEW_CHARS } from '../cards';

const publisherUser = new Types.ObjectId();
const notice = (over: Partial<LeanNotice> = {}): LeanNotice => ({
  _id: new Types.ObjectId(), collegeId: new Types.ObjectId(), title: 'Exam timetable', body: 'Line one.\n\n   Line two.',
  attachments: [{ key: 'colleges/c/notices/u', name: 'a.pdf', mime: 'application/pdf', size: 10 }],
  publisher: { userId: publisherUser, office: 'Exam Section' }, audience: { rules: [], line: 'Sent to 2024 Batch' },
  channelIds: [], ackRequired: true, ackDeadline: new Date('2026-10-01T10:00:00.000Z'), ackCommentAllowed: true,
  priority: 'important', confidential: false, urgentReason: null, purpose: 'standard', status: 'published', counts: { audience: 2, onJuvi: 1 }, reminders: [],
  publishedAt: new Date('2026-09-26T10:00:00.000Z'), createdAt: new Date(), updatedAt: new Date(), ...over,
});
const row = (over: Partial<LeanNoticeRecipient> = {}): LeanNoticeRecipient => ({
  _id: new Types.ObjectId(), collegeId: new Types.ObjectId(), noticeId: new Types.ObjectId(), personId: new Types.ObjectId(),
  accountId: new Types.ObjectId(), kind: 'student', labels: {}, addedLater: false, ackRequired: true, deadline: null,
  receivedAt: new Date(), seenAt: null, dismissedAt: null, remindedAt: null, ack: null, archived: false, ...over,
});
const ack = { at: new Date('2026-10-02T09:00:00.000Z'), late: true, method: 'confirm' as const, sessionId: new Types.ObjectId(), offline: true, clientAt: new Date('2026-09-30T09:00:00.000Z'), comment: 'Noted' };

describe('noticeState', () => {
  it('acknowledged beats dismissed beats seen beats received', () => {
    expect(noticeState(null)).toBe('received');
    expect(noticeState(row())).toBe('received');
    expect(noticeState(row({ seenAt: new Date() }))).toBe('seen');
    expect(noticeState(row({ seenAt: new Date(), dismissedAt: new Date() }))).toBe('dismissed');
    expect(noticeState(row({ seenAt: new Date(), ack }))).toBe('acknowledged');
  });
});

describe('previewOf', () => {
  it('collapses whitespace and truncates with an ellipsis', () => {
    expect(previewOf('Line one.\n\n   Line two.')).toBe('Line one. Line two.');
    const long = previewOf('x'.repeat(500));
    expect(long).toHaveLength(PREVIEW_CHARS);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('toCard', () => {
  it('renders the card with ISO dates and my state', () => {
    const n = notice();
    const card = toCard(n, row({ seenAt: new Date('2026-09-27T08:00:00.000Z'), remindedAt: new Date('2026-09-28T08:00:00.000Z') }), String(new Types.ObjectId()));
    expect(card).toEqual({
      id: String(n._id), title: 'Exam timetable', preview: 'Line one. Line two.', office: 'Exam Section', audienceLine: 'Sent to 2024 Batch',
      priority: 'important', purpose: 'standard', ackRequired: true, ackCommentAllowed: true,
      deadline: '2026-10-01T10:00:00.000Z', publishedAt: '2026-09-26T10:00:00.000Z', archived: false, attachmentCount: 1,
      state: 'seen', seenAt: '2026-09-27T08:00:00.000Z', ackAt: null, late: false, remindedAt: '2026-09-28T08:00:00.000Z', isPublisher: false,
    });
  });

  it('marks the publisher, archived notices or rows, and late acknowledgements', () => {
    expect(toCard(notice(), row(), String(publisherUser)).isPublisher).toBe(true);
    expect(toCard(notice({ publisher: { office: 'Juvi' } }), row(), String(publisherUser)).isPublisher).toBe(false);
    expect(toCard(notice({ status: 'archived' }), row(), 'u').archived).toBe(true);
    expect(toCard(notice(), row({ archived: true }), 'u').archived).toBe(true);
    expect(toCard(notice(), row({ ack }), 'u')).toMatchObject({ state: 'acknowledged', ackAt: '2026-10-02T09:00:00.000Z', late: true });
    expect(toCard(notice({ ackDeadline: null, publishedAt: undefined }), null, 'u')).toMatchObject({ deadline: null, publishedAt: null, state: 'received', seenAt: null });
  });
});

describe('toDetail', () => {
  it('adds the body, the attachment list and the flattened acknowledgement', () => {
    const d = toDetail(notice(), row({ ack, seenAt: new Date() }), 'u');
    expect(d).toMatchObject({
      body: 'Line one.\n\n   Line two.', attachments: [{ key: 'colleges/c/notices/u', name: 'a.pdf', mime: 'application/pdf', size: 10 }],
      ackMethod: 'confirm', ackOffline: true, ackComment: 'Noted', ackClientAt: '2026-09-30T09:00:00.000Z', dismissedAt: null,
    });
    expect(toDetail(notice(), row(), 'u')).toMatchObject({ ackMethod: null, ackOffline: false, ackComment: null, ackClientAt: null });
  });
});

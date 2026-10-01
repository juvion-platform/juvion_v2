import { describe, it, expect } from 'vitest';
import { Notice } from '../../../../models/juvi/Notice';
import { NoticeRecipient } from '../../../../models/juvi/NoticeRecipient';
import { AuditLog } from '../../../../shared/audit';

const keys = (model: { schema: { indexes(): [Record<string, unknown>, Record<string, unknown>][] } }) => model.schema.indexes();

describe('notice indexes (spec §5, final review)', () => {
  it('Notice: the publisher list by createdAt and the sweeper scan', () => {
    expect(keys(Notice).map(([k]) => k)).toEqual(expect.arrayContaining([
      { collegeId: 1, 'publisher.userId': 1, createdAt: -1 },
      { status: 1, createdAt: 1 },
    ]));
  });

  it('NoticeRecipient: a person\'s rows by (collegeId, personId)', () => {
    expect(keys(NoticeRecipient).map(([k]) => k)).toContainEqual({ collegeId: 1, personId: 1 });
  });

  it('NoticeRecipient: the activation recount by (noticeId, addedLater, accountId)', () => {
    expect(keys(NoticeRecipient).map(([k]) => k)).toContainEqual({ noticeId: 1, addedLater: 1, accountId: 1 });
  });

  it('AuditLog: the acknowledgement dedupe, partial on NoticeAcknowledgement', () => {
    expect(keys(AuditLog)).toContainEqual([
      { collegeId: 1, entityType: 1, entityId: 1, 'changes.newValue.recipientId': 1 },
      expect.objectContaining({ partialFilterExpression: { entityType: 'NoticeAcknowledgement' } }),
    ]);
  });
});

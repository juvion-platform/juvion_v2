import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { Notice, NOTICE_ATTACHMENT_MIMES } from '../Notice';
import { NoticeRecipient } from '../NoticeRecipient';
import { College } from '../../College';

const oid = () => new Types.ObjectId();
const base = () => ({
  collegeId: oid(), title: 'Exam timetable', body: 'See attached.',
  publisher: { personId: oid(), userId: oid(), office: 'Exam Section' },
  audience: { rules: [{ kind: 'batch', ids: [String(oid())] }], line: 'Sent to 2024 batch' },
});

describe('Notice', () => {
  it('defaults to publishing, routine, standard with zero counts', () => {
    const doc = new Notice(base());
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe('publishing');
    expect(doc.priority).toBe('routine');
    expect(doc.purpose).toBe('standard');
    expect(doc.counts).toEqual({ audience: 0, onJuvi: 0 });
    expect(doc.ackRequired).toBe(false);
    expect(doc.ackCommentAllowed).toBe(false);
    expect(doc.reminders).toEqual([]);
    expect(doc.channelIds).toEqual([]);
  });

  it('enforces title and body lengths, rule kinds, five attachments and two reminders', () => {
    expect(new Notice({ ...base(), title: 'x'.repeat(121) }).validateSync()?.errors.title).toBeDefined();
    expect(new Notice({ ...base(), body: 'x'.repeat(5001) }).validateSync()?.errors.body).toBeDefined();
    expect(new Notice({ ...base(), audience: { rules: [{ kind: 'club', ids: [] }], line: '' } }).validateSync()?.errors['audience.rules.0.kind']).toBeDefined();
    const att = { key: 'k', name: 'a.pdf', mime: 'application/pdf', size: 1 };
    expect(new Notice({ ...base(), attachments: Array(6).fill(att) }).validateSync()?.errors.attachments).toBeDefined();
    expect(new Notice({ ...base(), reminders: Array(3).fill({ at: new Date(), by: 'x' }) }).validateSync()?.errors.reminders).toBeDefined();
  });

  it('a deadline requires ackRequired', async () => {
    await expect(new Notice({ ...base(), ackDeadline: new Date() }).validate()).rejects.toThrow(/deadline requires ackRequired/);
    await expect(new Notice({ ...base(), ackRequired: true, ackDeadline: new Date() }).validate()).resolves.toBeUndefined();
  });

  it('declares the spec indexes and the attachment mime allowlist', () => {
    const keys = Notice.schema.indexes().map(([f]) => Object.keys(f as object).join(','));
    expect(keys).toEqual(expect.arrayContaining(['collegeId,status,publishedAt', 'collegeId,publisher.userId,publishedAt', 'collegeId,channelIds']));
    expect(NOTICE_ATTACHMENT_MIMES).toContain('application/pdf');
    expect(NOTICE_ATTACHMENT_MIMES).toHaveLength(7);
  });
});

describe('NoticeRecipient', () => {
  it('defaults accountId and ack to null and addedLater/archived to false', () => {
    const doc = new NoticeRecipient({ collegeId: oid(), noticeId: oid(), personId: oid(), kind: 'student' });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.accountId).toBeNull();
    expect(doc.ack).toBeNull();
    expect(doc.addedLater).toBe(false);
    expect(doc.archived).toBe(false);
    expect(doc.deadline).toBeNull();
    expect(doc.seenAt).toBeNull();
  });

  it('validates the ack record and the 500-character comment', () => {
    const ok = new NoticeRecipient({ collegeId: oid(), noticeId: oid(), personId: oid(), kind: 'faculty', ack: { at: new Date(), late: false, method: 'hold', sessionId: oid(), offline: false } });
    expect(ok.validateSync()).toBeUndefined();
    const bad = new NoticeRecipient({ collegeId: oid(), noticeId: oid(), personId: oid(), kind: 'faculty', ack: { at: new Date(), late: false, method: 'tap', sessionId: oid(), offline: false, comment: 'x'.repeat(501) } });
    const errs = bad.validateSync()?.errors ?? {};
    expect(errs['ack.method']).toBeDefined();
    expect(errs['ack.comment']).toBeDefined();
  });

  it('has the unique pair index and the three query indexes', () => {
    const idx = NoticeRecipient.schema.indexes();
    const pair = idx.find(([f]) => Object.keys(f as object).join(',') === 'noticeId,personId');
    expect(pair?.[1]).toMatchObject({ unique: true });
    const keys = idx.map(([f]) => Object.keys(f as object).join(','));
    expect(keys).toEqual(expect.arrayContaining(['collegeId,accountId,ackRequired,ack.at,deadline', 'collegeId,accountId,receivedAt', 'noticeId,seenAt,ack.at']));
  });
});

describe('College.juvi.welcomeNotice', () => {
  it('is absent by default and accepts per-kind ids', () => {
    const c = new College({ name: 'X', code: 'X', address: { line1: 'a', city: 'b', state: 'c', pincode: 'd' }, contactEmail: 'a@b.c', contactPhone: '1' });
    expect(c.juvi.welcomeNotice).toBeUndefined();
    c.set('juvi.welcomeNotice', { studentNoticeId: String(oid()) });
    expect(c.validateSync()).toBeUndefined();
    expect(c.juvi.welcomeNotice?.studentNoticeId).toMatch(/^[0-9a-f]{24}$/);
  });
});

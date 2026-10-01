/**
 * Onboarding step 4 (spec §4 US-5, §6.5): the configured welcome notice for the
 * caller's kind, or an auto-created default. Rows are created on demand and are
 * snapshot rows, so the welcome audience grows as accounts onboard.
 */
import { Types } from 'mongoose';
import { College } from '../../../models/College';
import { Notice, LeanNotice } from '../../../models/juvi/Notice';
import { NoticeRecipient, LeanNoticeRecipient } from '../../../models/juvi/NoticeRecipient';
import { AccountKind } from '../../../models/juvi/JuviAccount';
import { MobileContext } from '../middleware/authenticate-mobile';
import { invalidateJuviConfig } from '../config/institution-config';
import { loadAudienceGraph } from './audience-graph';
import { toDetail } from './cards';
import { NoticeDetail } from './schemas';

export const WELCOME_OFFICE = 'Juvi';
export type WelcomeSlot = 'studentNoticeId' | 'facultyNoticeId';

const DEFAULT_TITLE = 'Welcome to Juvi';
const DEFAULT_BODY = [
  'This is where your college sends official notices.',
  'When a notice asks you to acknowledge it, hold the button (or tap and confirm) to tell the office you have read it.',
  'Your acknowledgement is recorded with the time, so you never need to reply by message.',
].join('\n\n');

/** Students use the student slot; faculty and staff share the faculty slot (spec §5). */
export function welcomeSlot(kind: AccountKind): WelcomeSlot {
  return kind === 'student' ? 'studentNoticeId' : 'facultyNoticeId';
}

async function configuredId(collegeId: string, slot: WelcomeSlot): Promise<string | null> {
  const college = await College.findById(collegeId).select('juvi.welcomeNotice').lean();
  return college?.juvi?.welcomeNotice?.[slot] ?? null;
}

async function usableWelcome(collegeId: string, id: string | null): Promise<LeanNotice | null> {
  if (!id || !Types.ObjectId.isValid(id)) return null;
  return Notice.findOne({ _id: id, collegeId, purpose: 'welcome', status: 'published' }).lean<LeanNotice>();
}

/**
 * Creates the default welcome notice and records it in the slot, unless another
 * request recorded one first (compare-and-set on the slot's previous value).
 */
export async function ensureDefaultWelcomeNotice(collegeId: string, kind: AccountKind, attempt = 0): Promise<LeanNotice> {
  const slot = welcomeSlot(kind);
  const previous = await configuredId(collegeId, slot);
  const existing = await usableWelcome(collegeId, previous);
  if (existing) return existing;

  const created = await Notice.create({
    collegeId, title: DEFAULT_TITLE, body: DEFAULT_BODY,
    publisher: { office: WELCOME_OFFICE },
    audience: {
      rules: [{ kind: 'role', ids: kind === 'student' ? ['student'] : ['faculty', 'staff'] }],
      line: kind === 'student' ? 'Sent to every student who joins Juvi' : 'Sent to every faculty and staff member who joins Juvi',
    },
    ackRequired: true, purpose: 'welcome', status: 'published', publishedAt: new Date(),
  });
  const path = `juvi.welcomeNotice.${slot}`;
  const unchanged = previous ? { [path]: previous } : { $or: [{ [path]: { $exists: false } }, { [path]: null }] };
  const res = await College.updateOne({ _id: collegeId, ...unchanged }, { $set: { [path]: String(created._id) } });
  if (res.modifiedCount === 0) {
    await Notice.deleteOne({ _id: created._id, collegeId });
    if (attempt >= 2) throw new Error('Could not settle the welcome notice');
    return ensureDefaultWelcomeNotice(collegeId, kind, attempt + 1);
  }
  await invalidateJuviConfig(collegeId);
  return created.toObject() as unknown as LeanNotice;
}

/** The configured welcome notice for this kind while it is a published welcome notice; otherwise the default. */
export async function welcomeNoticeFor(collegeId: string, kind: AccountKind): Promise<LeanNotice> {
  return (await usableWelcome(collegeId, await configuredId(collegeId, welcomeSlot(kind)))) ?? ensureDefaultWelcomeNotice(collegeId, kind);
}

export async function getFirstNotice(ctx: MobileContext): Promise<NoticeDetail> {
  const notice = await welcomeNoticeFor(ctx.collegeId, ctx.kind);
  const personId = new Types.ObjectId(String(ctx.account.personId));
  const accountId = new Types.ObjectId(ctx.accountId);
  const now = new Date();

  let row = await NoticeRecipient.findOne({ collegeId: ctx.collegeId, noticeId: notice._id, personId }).lean<LeanNoticeRecipient>();
  if (!row) {
    const person = (await loadAudienceGraph(ctx.collegeId, { personIds: [String(personId)] })).people.get(String(personId));
    try {
      await NoticeRecipient.create({
        collegeId: ctx.collegeId, noticeId: notice._id, personId, accountId, kind: ctx.kind, labels: person?.labels ?? {},
        addedLater: false, ackRequired: notice.ackRequired, deadline: notice.ackDeadline ?? null, receivedAt: now,
      });
      // Welcome rows are snapshot rows: the audience grows with them (spec §6.5).
      await Notice.updateOne({ _id: notice._id, collegeId: ctx.collegeId }, { $inc: { 'counts.audience': 1, 'counts.onJuvi': 1 } });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;   // a concurrent request created it
    }
  } else if (!row.accountId) {
    const res = await NoticeRecipient.updateOne({ _id: row._id, collegeId: ctx.collegeId, accountId: null }, { $set: { accountId, receivedAt: now } });
    if (res.modifiedCount > 0) await Notice.updateOne({ _id: notice._id, collegeId: ctx.collegeId }, { $inc: { 'counts.onJuvi': 1 } });
  }
  row = await NoticeRecipient.findOne({ collegeId: ctx.collegeId, noticeId: notice._id, personId }).lean<LeanNoticeRecipient>();
  const fresh = (await Notice.findOne({ _id: notice._id, collegeId: ctx.collegeId }).lean<LeanNotice>())!;
  return toDetail(fresh, row, ctx.userId);
}

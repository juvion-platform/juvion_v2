import { Types } from 'mongoose';
import { Channel, IChannel } from '../../../models/juvi/Channel';
import { ChannelMembership, IChannelMembership } from '../../../models/juvi/ChannelMembership';
import { JuviAccount } from '../../../models/juvi/JuviAccount';
import { TemplateCode } from '../../../models/juvi/ChannelTemplate';
import { MobileContext } from '../middleware/authenticate-mobile';
import { getJuviConfig } from '../config/institution-config';
import { notFound } from '../errors';
import { reconcileAccount } from './reconcile-service';
import { nextClassByOffering, formatNextClassLabel } from './next-class';
import { SpacesResponse, SpaceChannelRow, ChannelDetail } from './schemas';

export const RECONCILE_STALE_MS = 60_000;

type GroupKey = 'college' | 'department' | 'batch' | 'courses' | 'hostel' | 'archived';
const GROUP_OF: Record<TemplateCode, GroupKey> = { college: 'college', department: 'department', batch: 'batch', course: 'courses', hostel: 'hostel' };
const TITLES: Record<GroupKey, string> = { college: 'College', department: 'My Department', batch: 'My Batch', courses: 'My Courses', hostel: 'Hostel', archived: 'Archived' };
const STUDENT_ORDER: GroupKey[] = ['college', 'department', 'batch', 'courses', 'hostel', 'archived'];
const STAFF_ORDER: GroupKey[] = ['courses', 'department', 'college', 'batch', 'hostel', 'archived'];
const COURSES_EMPTY_HINT = 'Your course spaces appear here once your registrations are in.';
const WHO_CAN_POST: Record<TemplateCode, string> = {
  college: 'College office and staff publishers', department: 'HOD, principal and registrar',
  batch: 'Class coordinators, HOD, admissions and registrar', course: 'Course faculty', hostel: 'Wardens',
};

async function maybeReconcile(ctx: MobileContext): Promise<void> {
  // R10: scope by collegeId even though _id alone would already be unique.
  const acct = await JuviAccount.findOne({ _id: ctx.accountId, collegeId: ctx.collegeId }).select('lastReconciledAt').lean();
  const last = acct?.lastReconciledAt?.getTime() ?? 0;
  if (Date.now() - last > RECONCILE_STALE_MS) {
    try { await reconcileAccount(ctx.collegeId, ctx.accountId); } catch (err) { console.error('[juvi-app] inline reconcile failed', err); }
  }
}

export async function listSpaces(ctx: MobileContext): Promise<SpacesResponse> {
  await maybeReconcile(ctx);
  const memberships = await ChannelMembership.find({ collegeId: ctx.collegeId, accountId: ctx.accountId }).lean();
  const channels = await Channel.find({ _id: { $in: memberships.map((m) => m.channelId) }, collegeId: ctx.collegeId }).lean();
  const membershipByChannel = new Map(memberships.map((m) => [String(m.channelId), m]));
  const cfg = await getJuviConfig(ctx.collegeId);
  const tz = cfg?.timezone ?? 'Asia/Kolkata';
  const courseIds = channels.filter((c) => c.scopeType === 'course_offering' && c.status === 'active' && c.scopeId).map((c) => String(c.scopeId));
  const nextBy = await nextClassByOffering(ctx.collegeId, courseIds, tz);
  const now = new Date();

  const rows = new Map<GroupKey, SpaceChannelRow[]>();
  for (const c of channels) {
    const m = membershipByChannel.get(String(c._id))!;
    const next = c.scopeId ? nextBy.get(String(c.scopeId)) : undefined;
    const row: SpaceChannelRow = {
      id: String(c._id), name: c.name, about: c.about, scopeType: c.scopeType, templateCode: c.templateCode,
      role: m.role, muted: Boolean(m.mutedAt), memberCount: c.memberCount, archived: c.status === 'archived',
      nextClassAt: next ? next.toISOString() : null, nextClassLabel: next ? formatNextClassLabel(next, now, tz) : null,
    };
    const key: GroupKey = c.status === 'archived' ? 'archived' : GROUP_OF[c.templateCode];
    rows.set(key, [...(rows.get(key) ?? []), row]);
  }
  const courses = rows.get('courses') ?? [];
  courses.sort((a, b) => (a.nextClassAt ?? '9').localeCompare(b.nextClassAt ?? '9') || a.name.localeCompare(b.name));
  for (const [k, list] of rows) if (k !== 'courses') list.sort((a, b) => a.name.localeCompare(b.name));

  const order = ctx.kind === 'student' ? STUDENT_ORDER : STAFF_ORDER;
  const groups: SpacesResponse['groups'] = [];
  for (const key of order) {
    const list = rows.get(key) ?? [];
    if (key === 'courses') groups.push({ key, title: TITLES[key], channels: list, ...(list.length === 0 ? { emptyHint: COURSES_EMPTY_HINT } : {}) });
    else if (list.length > 0) groups.push({ key, title: TITLES[key], channels: list });
  }
  return { groups, asOf: now.toISOString() };
}

async function memberChannel(ctx: MobileContext, channelId: string): Promise<{ channel: IChannel; membership: IChannelMembership }> {
  if (!Types.ObjectId.isValid(channelId)) throw notFound('Channel');
  const membership = await ChannelMembership.findOne({ collegeId: ctx.collegeId, channelId, accountId: ctx.accountId });
  const channel = membership ? await Channel.findOne({ _id: channelId, collegeId: ctx.collegeId }) : null;
  // Non-members and other colleges both get 404 (spec §15).
  if (!membership || !channel) throw notFound('Channel');
  return { channel, membership };
}

export async function getChannel(ctx: MobileContext, channelId: string): Promise<ChannelDetail> {
  const { channel: c, membership: m } = await memberChannel(ctx, channelId);
  const active = c.status === 'active';
  return {
    id: String(c._id), name: c.name, about: c.about, scopeType: c.scopeType, templateCode: c.templateCode,
    status: c.status, memberCount: c.memberCount, replyRule: c.replyRule, defaultPriority: c.defaultPriority,
    role: m.role, muted: Boolean(m.mutedAt),
    canPost: active && m.role === 'publisher',
    canReply: active && (c.replyRule === 'allowed' || m.role === 'publisher'),
    whoCanPost: WHO_CAN_POST[c.templateCode],
    linkedObject: { type: c.scopeType, id: c.scopeId ? String(c.scopeId) : null },
  };
}

export async function setMute(ctx: MobileContext, channelId: string, muted: boolean): Promise<{ muted: boolean }> {
  const { membership } = await memberChannel(ctx, channelId);
  membership.mutedAt = muted ? new Date() : null;
  await membership.save();
  return { muted };
}

export async function markRead(ctx: MobileContext, channelId: string): Promise<{ lastReadAt: string }> {
  const { membership } = await memberChannel(ctx, channelId);
  membership.lastReadAt = new Date();
  await membership.save();
  return { lastReadAt: membership.lastReadAt.toISOString() };
}

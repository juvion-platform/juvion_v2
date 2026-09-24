import { Types } from 'mongoose';
import redis from '../../../config/redis';
import { Channel } from '../../../models/juvi/Channel';
import { ChannelMembership, MembershipRole } from '../../../models/juvi/ChannelMembership';
import { ChannelTemplate, IChannelTemplate, TemplateCode, ChannelScopeType } from '../../../models/juvi/ChannelTemplate';
import { JuviAccount, ELIGIBLE_STATUSES } from '../../../models/juvi/JuviAccount';
import { seedChannelTemplates } from '../../../shared/seed/channel-templates';
import { loadCollegeGraph, loadAccountGraph, CollegeGraph } from './graph-loader';
import { computeExpectedMembers } from './strategies';
import { renderPattern } from './templates';

export interface MembershipDiff { added: number; removed: number; roleChanged: number }
export interface ReconcileSummary {
  at: string;
  durationMs: number;
  skipped: boolean;
  channels: { created: number; archived: number; unarchived: number; total: number };
  memberships: MembershipDiff;
  errors: number;
}

const LOCK_TTL_SECONDS = 240;
const SUMMARY_TTL_SECONDS = 7 * 86_400;
const lockKey = (cid: string) => `juvi:reconcile-lock:${cid}`;
const lastKey = (cid: string) => `juvi:reconcile-last:${cid}`;
const scopeKey = (scopeType: string, scopeId: unknown) => `${scopeType}:${scopeId ? String(scopeId) : ''}`;

async function loadTemplates(collegeId: string): Promise<Map<TemplateCode, IChannelTemplate>> {
  await seedChannelTemplates(collegeId);
  const rows = await ChannelTemplate.find({ collegeId, isEnabled: true }).lean();
  return new Map(rows.map((t) => [t.code, t as unknown as IChannelTemplate]));
}

interface DesiredChannel { code: TemplateCode; scopeType: ChannelScopeType; scopeId: string | null; semesterId?: string; vars: Record<string, string> }

function desiredChannels(g: CollegeGraph, templates: Map<TemplateCode, IChannelTemplate>): DesiredChannel[] {
  const out: DesiredChannel[] = [];
  if (templates.has('college')) out.push({ code: 'college', scopeType: 'college', scopeId: null, vars: { 'college.name': g.names.college } });
  if (templates.has('department')) for (const id of g.scopes.departmentIds) out.push({ code: 'department', scopeType: 'department', scopeId: id, vars: { 'department.name': g.names.departments.get(id) ?? '' } });
  if (templates.has('batch')) for (const id of g.scopes.batchIds) out.push({ code: 'batch', scopeType: 'batch', scopeId: id, vars: { 'batch.code': g.names.batches.get(id) ?? '' } });
  if (templates.has('course')) for (const o of g.scopes.offerings) out.push({ code: 'course', scopeType: 'course_offering', scopeId: o.id, semesterId: o.semesterId, vars: { 'course.code': o.courseCode, 'course.name': o.courseName, 'section.name': o.sectionName } });
  if (templates.has('hostel')) for (const id of g.scopes.blockIds) out.push({ code: 'hostel', scopeType: 'hostel_block', scopeId: id, vars: { 'block.name': g.names.blocks.get(id) ?? '' } });
  return out;
}

export async function ensureChannels(
  collegeId: string, g: CollegeGraph, templates: Map<TemplateCode, IChannelTemplate>,
): Promise<{ created: number; archived: number; unarchived: number }> {
  const existing = await Channel.find({ collegeId }).select('_id scopeType scopeId status').lean();
  const byKey = new Map(existing.map((c) => [scopeKey(c.scopeType, c.scopeId), c]));
  let created = 0; let unarchived = 0; let archived = 0;

  for (const d of desiredChannels(g, templates)) {
    const t = templates.get(d.code)!;
    const found = byKey.get(scopeKey(d.scopeType, d.scopeId));
    if (!found) {
      await Channel.create({
        collegeId, type: 'official', templateCode: d.code, scopeType: d.scopeType,
        scopeId: d.scopeId ? new Types.ObjectId(d.scopeId) : null, semesterId: d.semesterId,
        name: renderPattern(t.namePattern, d.vars) || t.name, about: renderPattern(t.aboutPattern, d.vars),
        postingRule: t.postingRule, replyRule: t.replyRule, defaultPriority: t.defaultPriority, createdVia: 'reconcile',
      });
      created += 1;
    } else if (found.status === 'archived') {
      await Channel.updateOne({ _id: found._id, collegeId }, { $set: { status: 'active' }, $unset: { archivedAt: 1 } });
      unarchived += 1;
    }
  }

  if (g.scopes.endedOfferingIds.length) {
    const res = await Channel.updateMany(
      { collegeId, scopeType: 'course_offering', status: 'active', scopeId: { $in: g.scopes.endedOfferingIds.map((id) => new Types.ObjectId(id)) } },
      { $set: { status: 'archived', archivedAt: new Date() } },
    );
    archived = res.modifiedCount;
  }
  return { created, archived, unarchived };
}

async function applyDiff(
  collegeId: string, channelId: Types.ObjectId,
  expected: Map<string, MembershipRole>, existing: { accountId: string; role: MembershipRole }[],
): Promise<MembershipDiff> {
  const existingByAccount = new Map(existing.map((m) => [m.accountId, m.role]));
  const ops: Parameters<typeof ChannelMembership.bulkWrite>[0] = [];
  const diff: MembershipDiff = { added: 0, removed: 0, roleChanged: 0 };

  for (const [accountId, role] of expected) {
    const had = existingByAccount.get(accountId);
    if (!had) { ops.push({ insertOne: { document: { collegeId, channelId, accountId: new Types.ObjectId(accountId), role, joinedVia: 'rule', joinedAt: new Date() } } }); diff.added += 1; }
    else if (had !== role) { ops.push({ updateOne: { filter: { collegeId, channelId, accountId: new Types.ObjectId(accountId) }, update: { $set: { role } } } }); diff.roleChanged += 1; }
  }
  for (const accountId of existingByAccount.keys()) {
    if (!expected.has(accountId)) { ops.push({ deleteOne: { filter: { collegeId, channelId, accountId: new Types.ObjectId(accountId) } } }); diff.removed += 1; }
  }
  if (ops.length) await ChannelMembership.bulkWrite(ops, { ordered: false });
  return diff;
}

export async function reconcileCollege(collegeId: string): Promise<ReconcileSummary> {
  const started = Date.now();
  const empty: ReconcileSummary = { at: new Date().toISOString(), durationMs: 0, skipped: true, channels: { created: 0, archived: 0, unarchived: 0, total: 0 }, memberships: { added: 0, removed: 0, roleChanged: 0 }, errors: 0 };
  let locked = false;
  try {
    const ok = await redis.set(lockKey(collegeId), '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (ok !== 'OK') return empty;
    locked = true;
  } catch { /* Redis down: run unlocked */ }

  try {
    const templates = await loadTemplates(collegeId);
    const g = await loadCollegeGraph(collegeId);
    const ch = await ensureChannels(collegeId, g, templates);
    const channels = await Channel.find({ collegeId, status: 'active' }).select('_id scopeType scopeId').lean();
    const memberships: MembershipDiff = { added: 0, removed: 0, roleChanged: 0 };
    let errors = 0;

    for (const c of channels) {
      try {
        const expected = computeExpectedMembers(g, { scopeType: c.scopeType, scopeId: c.scopeId ? String(c.scopeId) : null });
        const existing = (await ChannelMembership.find({ collegeId, channelId: c._id }).select('accountId role').lean())
          .map((m) => ({ accountId: String(m.accountId), role: m.role }));
        const d = await applyDiff(collegeId, c._id, expected, existing);
        memberships.added += d.added; memberships.removed += d.removed; memberships.roleChanged += d.roleChanged;
        await Channel.updateOne({ _id: c._id, collegeId }, { $set: { memberCount: expected.size } });
      } catch (err) {
        errors += 1;
        console.error('[juvi-app] reconcile failed for channel', String(c._id), err);
      }
    }

    await JuviAccount.updateMany({ collegeId, status: { $in: ELIGIBLE_STATUSES } }, { $set: { lastReconciledAt: new Date() } });
    const summary: ReconcileSummary = {
      at: new Date().toISOString(), durationMs: Date.now() - started, skipped: false,
      channels: { ...ch, total: await Channel.countDocuments({ collegeId }) }, memberships, errors,
    };
    try { await redis.set(lastKey(collegeId), JSON.stringify(summary), 'EX', SUMMARY_TTL_SECONDS); } catch { /* non-fatal */ }
    console.log(`[juvi-app] reconcile ${collegeId}: ${summary.channels.total} channels, +${memberships.added}/-${memberships.removed}/~${memberships.roleChanged} memberships, ${errors} errors, ${summary.durationMs}ms`);
    return summary;
  } finally {
    if (locked) { try { await redis.del(lockKey(collegeId)); } catch { /* non-fatal */ } }
  }
}

export async function reconcileAccount(collegeId: string, accountId: string): Promise<MembershipDiff> {
  const diff: MembershipDiff = { added: 0, removed: 0, roleChanged: 0 };
  const g = await loadAccountGraph(collegeId, accountId);
  if (g.accounts.size === 0) return diff;

  const channels = await Channel.find({ collegeId, status: 'active' }).select('_id scopeType scopeId').lean();
  const existing = new Map(
    (await ChannelMembership.find({ collegeId, accountId }).select('channelId role').lean()).map((m) => [String(m.channelId), m.role]),
  );
  const touched: Types.ObjectId[] = [];
  const ops: Parameters<typeof ChannelMembership.bulkWrite>[0] = [];
  const acct = new Types.ObjectId(accountId);

  for (const c of channels) {
    const want = computeExpectedMembers(g, { scopeType: c.scopeType, scopeId: c.scopeId ? String(c.scopeId) : null }).get(accountId);
    const have = existing.get(String(c._id));
    if (want && !have) { ops.push({ insertOne: { document: { collegeId, channelId: c._id, accountId: acct, role: want, joinedVia: 'rule', joinedAt: new Date() } } }); diff.added += 1; touched.push(c._id); }
    else if (!want && have) { ops.push({ deleteOne: { filter: { collegeId, channelId: c._id, accountId: acct } } }); diff.removed += 1; touched.push(c._id); }
    else if (want && have && want !== have) { ops.push({ updateOne: { filter: { collegeId, channelId: c._id, accountId: acct }, update: { $set: { role: want } } } }); diff.roleChanged += 1; }
  }
  if (ops.length) await ChannelMembership.bulkWrite(ops, { ordered: false });
  for (const id of touched) {
    await Channel.updateOne({ _id: id, collegeId }, { $set: { memberCount: await ChannelMembership.countDocuments({ collegeId, channelId: id }) } });
  }
  await JuviAccount.updateOne({ _id: accountId, collegeId }, { $set: { lastReconciledAt: new Date() } });
  return diff;
}

export async function getLastReconcile(collegeId: string): Promise<ReconcileSummary | null> {
  try {
    const raw = await redis.get(lastKey(collegeId));
    return raw ? (JSON.parse(raw) as ReconcileSummary) : null;
  } catch { return null; }
}

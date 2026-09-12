/**
 * 008 Phase 2 — read aggregations for the Student Risk board.
 *
 * The CCD engine already exposes 21 endpoints, but they are shaped for
 * single-record work (get one alert, recompute one student). The board needs
 * three cohort-level views the existing surface does not provide, and none of
 * them belong in `ment-couns-ccd-service.ts`, which is already 1,100+ lines of
 * write-path logic.
 *
 * Read-only. Nothing here computes a score — `computeRiskScore` remains the
 * single scoring path, and these functions only arrange what it produced.
 */

import mongoose from 'mongoose';

import { CrisisAlert } from '../../models/welfare/CrisisAlert';
import { RiskSignal } from '../../models/welfare/RiskSignal';
import { MentorAssignment } from '../../models/welfare/MentorAssignment';
import { RiskScoreSnapshot } from '../../models/welfare/RiskScoreSnapshot';
import { Faculty } from '../../models/people/Faculty';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';
import { applyMentorScope } from './mentor-scope';

const OPEN_STATUSES = ['generated', 'acknowledged', 'investigating', 'intervening'];

export interface RiskBoardRow {
  alertId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  priority: string | null;
  score: number;
  status: string;
  daysOpen: number;
  /** Which upstream modules contributed — the cross-module evidence. */
  sources: string[];
  signalCount: number;
  crossModuleMultiplier: number;
  temporalMultiplier: number;
  mentorName: string | null;
  lastActionAt: string | null;
}

function daysSince(d: Date | undefined): number {
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
}

/**
 * The board itself: every open compound-risk alert, newest-highest first.
 *
 * Scoping order matters. `applyAuthScope` runs first (department/self), then
 * the mentor restriction intersects on top — so an HOD who also mentors sees
 * the narrower of the two, never the union.
 */
export async function getRiskBoard(
  collegeId: string,
  authScope?: AuthScope,
  opts?: { priority?: string; includeResolved?: boolean },
): Promise<RiskBoardRow[]> {
  const filter: Record<string, unknown> = {
    collegeId,
    status: opts?.includeResolved ? { $exists: true } : { $in: OPEN_STATUSES },
  };
  if (opts?.priority) filter['priority'] = opts.priority;

  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  await applyMentorScope(filter, collegeId, authScope?.personId);

  const alerts = await CrisisAlert.find(filter)
    .sort({ compoundScore: -1, createdAt: -1 })
    .limit(200)
    .populate({
      path: 'studentId',
      select: 'rollNumber personId',
      populate: { path: 'personId', select: 'name' },
    })
    .lean();

  // One lookup for every mentor on the board rather than one per row.
  const studentIds = alerts
    .map((a) => (a.studentId as { _id?: unknown })?._id ?? a.studentId)
    .filter(Boolean)
    .map(String);

  const assignments = await MentorAssignment.find({
    collegeId,
    studentId: { $in: studentIds },
    status: 'active',
  })
    .select({ studentId: 1, mentorId: 1 })
    .lean();

  const mentorIds = [...new Set(assignments.map((a) => String(a.mentorId)))];
  const faculties = await Faculty.find({ collegeId, _id: { $in: mentorIds } })
    .select({ personId: 1 })
    .populate({ path: 'personId', select: 'name' })
    .lean();

  const mentorNameById = new Map<string, string>();
  for (const f of faculties) {
    const person = f.personId as unknown as { name?: string } | null;
    mentorNameById.set(String(f._id), person?.name ?? 'Unnamed');
  }
  const mentorByStudent = new Map<string, string>();
  for (const a of assignments) {
    const name = mentorNameById.get(String(a.mentorId));
    if (name) mentorByStudent.set(String(a.studentId), name);
  }

  return alerts.map((a) => {
    const student = a.studentId as unknown as
      | { _id?: unknown; rollNumber?: string; personId?: { name?: string } }
      | null;
    const sid = String(student?._id ?? a.studentId ?? '');
    const signals = (a.signals ?? []) as Array<{ source?: string }>;
    const lastAction =
      a.intervention?.executedAt ??
      a.investigation?.startedAt ??
      a.acknowledgment?.acknowledgedAt ??
      null;

    return {
      alertId: String(a._id),
      studentId: sid,
      studentName: student?.personId?.name ?? 'Unknown student',
      rollNumber: student?.rollNumber ?? '—',
      priority: a.priority ?? null,
      score: a.compoundScore ?? 0,
      status: a.status,
      daysOpen: daysSince((a as { createdAt?: Date }).createdAt),
      sources: [...new Set(signals.map((s) => s.source).filter(Boolean))] as string[],
      signalCount: signals.length,
      crossModuleMultiplier: a.scoreBreakdown?.crossModuleMultiplier ?? 1,
      temporalMultiplier: a.scoreBreakdown?.temporalMultiplier ?? 1,
      mentorName: mentorByStudent.get(sid) ?? null,
      lastActionAt: lastAction ? new Date(lastAction).toISOString() : null,
    };
  });
}

/**
 * Signal volume by source module over a rolling window.
 *
 * This is the widget that substantiates the cross-module claim: it shows the
 * board is fed by academics, finance and campus-ops rather than by welfare
 * talking to itself.
 */
export async function getSignalsBySource(
  collegeId: string,
  days = 7,
): Promise<Array<{ source: string; count: number; signalTypes: string[] }>> {
  // Mongoose does not cast a string collegeId inside $match — the existing CCD
  // aggregations carry the same note. Cast explicitly or this silently
  // returns nothing.
  const cid = new mongoose.Types.ObjectId(collegeId);
  const since = new Date(Date.now() - days * 86_400_000);

  const rows = await RiskSignal.aggregate<{
    _id: string;
    count: number;
    signalTypes: string[];
  }>([
    { $match: { collegeId: cid, receivedAt: { $gte: since } } },
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
        signalTypes: { $addToSet: '$signalType' },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return rows.map((r) => ({
    source: r._id,
    count: r.count,
    signalTypes: r.signalTypes,
  }));
}

/**
 * Open alerts per mentor, with the count that has gone untouched too long.
 *
 * An alert nobody acts on is the failure mode that makes a risk board get
 * ignored by week six, so it is surfaced as a first-class number rather than
 * something a dean has to notice.
 */
export async function getMentorWorkload(
  collegeId: string,
  staleAfterDays = 14,
): Promise<Array<{ mentorName: string; open: number; unactioned: number; p1: number }>> {
  const board = await getRiskBoard(collegeId);

  const byMentor = new Map<string, { open: number; unactioned: number; p1: number }>();
  for (const row of board) {
    const key = row.mentorName ?? 'Unassigned';
    const entry = byMentor.get(key) ?? { open: 0, unactioned: 0, p1: 0 };
    entry.open += 1;
    if (!row.lastActionAt && row.daysOpen >= staleAfterDays) entry.unactioned += 1;
    if (row.priority === 'P1') entry.p1 += 1;
    byMentor.set(key, entry);
  }

  return [...byMentor.entries()]
    .map(([mentorName, v]) => ({ mentorName, ...v }))
    .sort((a, b) => b.p1 - a.p1 || b.open - a.open);
}

/**
 * Phase 4 — the outreach funnel: raised → contacted → resolved → recurred.
 *
 * "Recurred" is a resolved alert whose student was flagged again afterwards.
 * Double-alert suppression means a new CrisisAlert can only exist once the
 * previous one is resolved, so a later createdAt IS a genuine recurrence.
 */
export async function getOutreachEffectiveness(
  collegeId: string,
  days = 90,
): Promise<{
  windowDays: number;
  raised: number;
  contacted: number;
  resolved: number;
  recurred: number;
}> {
  const since = new Date(Date.now() - days * 86_400_000);
  const alerts = await CrisisAlert.find({
    collegeId,
    falsePositive: { $ne: true },
    createdAt: { $gte: since },
  })
    .select({ studentId: 1, status: 1, resolvedAt: 1, createdAt: 1, 'intervention.executedAt': 1 })
    .lean();

  const byStudent = new Map<string, typeof alerts>();
  for (const a of alerts) {
    if (!a.studentId) continue;
    const key = String(a.studentId);
    const list = byStudent.get(key) ?? [];
    list.push(a);
    byStudent.set(key, list);
  }

  let recurred = 0;
  for (const list of byStudent.values()) {
    for (const a of list) {
      if (a.status !== 'resolved' || !a.resolvedAt) continue;
      const closedAt = new Date(a.resolvedAt).getTime();
      if (
        list.some(
          (n) =>
            n._id !== a._id &&
            new Date((n as { createdAt?: Date }).createdAt ?? 0).getTime() > closedAt,
        )
      ) {
        recurred += 1;
      }
    }
  }

  return {
    windowDays: days,
    raised: alerts.length,
    contacted: alerts.filter((a) => a.intervention?.executedAt).length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
    recurred,
  };
}

/**
 * A student's score over time, for the "did contacting them help?" view.
 *
 * Reads the snapshots Phase 1 started writing. Returns an empty series rather
 * than throwing when a student has never been scored.
 */
export async function getStudentScoreHistory(
  collegeId: string,
  studentId: string,
  days = 90,
): Promise<Array<{ at: string; score: number; priority: string | null }>> {
  const since = new Date(Date.now() - days * 86_400_000);
  const snaps = await RiskScoreSnapshot.find({
    collegeId,
    studentId,
    capturedAt: { $gte: since },
  })
    .sort({ capturedAt: 1 })
    .select({ score: 1, priority: 1, capturedAt: 1 })
    .lean();

  return snaps.map((s) => ({
    at: new Date(s.capturedAt).toISOString(),
    score: s.score,
    priority: s.priority ?? null,
  }));
}

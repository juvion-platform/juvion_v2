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
import { Student } from '../../models/people/Student';
import { Branch } from '../../models/academic-structure/Branch';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
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
  /** Signal types on the alert — what actually fired, not just where from. */
  signalTypes: string[];
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
    const signals = (a.signals ?? []) as Array<{ source?: string; signalType?: string }>;
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
      signalTypes: [...new Set(signals.map((s) => s.signalType).filter(Boolean))] as string[],
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
  authScope?: AuthScope,
): Promise<Array<{ mentorName: string; open: number; unactioned: number; p1: number }>> {
  const board = await getRiskBoard(collegeId, authScope);

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

// ── 009: cohort cuts ───────────────────────────────────────────────────────

export interface CohortFields {
  branch: string | null;
  yearOfStudy: number;
  quota: string | null;
  category: string | null;
  hostelResident: boolean;
  /** From the CCD engine's own signal data — there is no student-level flag. */
  firstGeneration: boolean;
  /** Score now minus the latest snapshot at least 7 days old; null when none. */
  delta7d: number | null;
}

/**
 * Join the cohort cuts onto board rows. One query per collection, never per
 * row. Shared by the People query bundle (009 T7) and the cohort widget (T9)
 * so both cut the population the same way.
 */
export async function enrichBoardRows<T extends { studentId: string; score: number }>(
  collegeId: string,
  rows: T[],
): Promise<Array<T & CohortFields>> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => new mongoose.Types.ObjectId(r.studentId));
  const cid = new mongoose.Types.ObjectId(collegeId);
  const since = new Date(Date.now() - 7 * 86_400_000);

  const [students, hostel, firstGen, snaps] = await Promise.all([
    Student.find({ collegeId, _id: { $in: ids } })
      .select({ branchId: 1, quota: 1, category: 1, studyYearAtAdmission: 1, feePins: 1 })
      .lean(),
    HostelAllocation.find({ collegeId, studentId: { $in: ids }, status: 'active' })
      .select({ studentId: 1 }).lean(),
    RiskSignal.distinct('studentId', {
      collegeId: cid, studentId: { $in: ids },
      $or: [{ 'triggerData.isFirstGen': true }, { firstGenModifier: { $gt: 0 } }],
    }),
    RiskScoreSnapshot.aggregate<{ _id: mongoose.Types.ObjectId; score: number }>([
      { $match: { collegeId: cid, studentId: { $in: ids }, capturedAt: { $lte: since } } },
      { $sort: { capturedAt: -1 } },
      { $group: { _id: '$studentId', score: { $first: '$score' } } },
    ]),
  ]);

  const branchIds = [...new Set(students.map((s) => s.branchId).filter(Boolean).map(String))];
  const branches = branchIds.length
    ? await Branch.find({ collegeId, _id: { $in: branchIds } }).select({ code: 1 }).lean()
    : [];
  const branchCode = new Map(branches.map((b) => [String(b._id), b.code]));
  const studentById = new Map(students.map((s) => [String(s._id), s]));
  const hostelSet = new Set(hostel.map((h) => String(h.studentId)));
  const firstGenSet = new Set(firstGen.map(String));
  const priorScore = new Map(snaps.map((x) => [String(x._id), x.score]));

  return rows.map((r) => {
    const s = studentById.get(r.studentId);
    const pins = (s?.feePins ?? []) as Array<{ yearOfStudy?: number }>;
    // ponytail: year = highest pinned year, else year at admission. Upgrade when
    // Student carries a promoted current-year field.
    const yearOfStudy = Math.max(s?.studyYearAtAdmission ?? 1, ...pins.map((p) => p.yearOfStudy ?? 0));
    const prior = priorScore.get(r.studentId);
    return {
      ...r,
      branch: s?.branchId ? branchCode.get(String(s.branchId)) ?? null : null,
      yearOfStudy,
      quota: s?.quota ?? null,
      category: s?.category ?? null,
      hostelResident: hostelSet.has(r.studentId),
      firstGeneration: firstGenSet.has(r.studentId),
      delta7d: prior === undefined ? null : r.score - prior,
    };
  });
}

export interface CohortCut { key: string; open: number; p1: number; avgScore: number }

function cutBy<T extends { priority: string | null; score: number }>(
  rows: T[],
  keyOf: (r: T) => string,
): CohortCut[] {
  const m = new Map<string, { open: number; p1: number; sum: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    const e = m.get(k) ?? { open: 0, p1: 0, sum: 0 };
    e.open += 1; e.sum += r.score; if (r.priority === 'P1') e.p1 += 1;
    m.set(k, e);
  }
  return [...m.entries()]
    .map(([key, e]) => ({ key, open: e.open, p1: e.p1, avgScore: Math.round(e.sum / e.open) }))
    .sort((a, b) => b.open - a.open || a.key.localeCompare(b.key));
}

/**
 * T9 — open alerts and average score cut by cohort. Pure aggregation over
 * the (scoped) board; the last unbuilt widget in ROADMAP §2.1.
 */
export async function getCohortCuts(collegeId: string, authScope?: AuthScope): Promise<{
  total: number;
  byBranch: CohortCut[];
  byQuota: CohortCut[];
  hostel: CohortCut;
  firstGeneration: CohortCut;
}> {
  const rows = await enrichBoardRows(collegeId, await getRiskBoard(collegeId, authScope));
  const one = (key: string, sub: typeof rows): CohortCut =>
    cutBy(sub, () => key)[0] ?? { key, open: 0, p1: 0, avgScore: 0 };
  return {
    total: rows.length,
    byBranch: cutBy(rows, (r) => r.branch ?? 'Unassigned'),
    byQuota: cutBy(rows, (r) => r.quota ?? 'Unspecified'),
    hostel: one('Hostel residents', rows.filter((r) => r.hostelResident)),
    firstGeneration: one('First-generation', rows.filter((r) => r.firstGeneration)),
  };
}

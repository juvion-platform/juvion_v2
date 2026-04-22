/**
 * fee-analytics-service (Task 3 — Fee Collection Analytics & Alerts)
 *
 * Pure aggregation service producing a consolidated dashboard payload
 * (`getDashboard`) plus a paginated top-N defaulters listing
 * (`getDefaulters`). Both functions run six Mongoose `.aggregate()`
 * pipelines in parallel (`Promise.all`) — one Mongo round-trip for the
 * whole dashboard. No server-side cache for v1 (React Query handles
 * client-side staleness).
 *
 * Public contract — see interfaces below. HOD scope is applied by
 * intersecting `auth.hodProgrammeIds[]` into every pipeline that
 * touches student-level data (via $lookup → Student.programmeId
 * filter).
 *
 * Spec: .captain/specs/fee-collection-analytics-and-alerts/spec.md
 * Plan: .captain/specs/fee-collection-analytics-and-alerts/plan.md §1.4
 * Tasks: .captain/specs/fee-collection-analytics-and-alerts/tasks.md §Task 3
 */

import { Types, PipelineStage } from 'mongoose';

import { Invoice } from '../../models/finance/Invoice';
import { Payment } from '../../models/finance/Payment';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';

// ── Types ─────────────────────────────────────────────────────────────

export interface DashboardFilters {
  from: Date;
  to: Date;
  programmeIds?: string[];
  branchIds?: string[];
  batchIds?: string[];
  academicYearId?: string;
}

export interface AuthScope {
  role: string;
  collegeId: string;
  hodProgrammeIds?: string[];
}

export interface FunnelByStage {
  stage_1: number;
  stage_2: number;
  stage_3: number;
  stage_4: number;
  welfare_referred: number;
}

export type PaymentModeKey =
  | 'cash'
  | 'upi'
  | 'neft'
  | 'cheque'
  | 'online'
  | 'card'
  | 'other';

export type PaymentModeBreakdown = Record<PaymentModeKey, number>;

export interface DashboardV1 {
  totalOutstanding: number;
  collectedInRange: number;
  collectionRatePercent: number;
  overdueStudentsCount: number;
  overdueAmount: number;
  funnelByStage: FunnelByStage;
  collectionTimeSeries: Array<{ bucket: string; amount: number }>;
  dueVsCollectedByMonth: Array<{ month: string; due: number; collected: number }>;
  paymentModeBreakdown: PaymentModeBreakdown;
  dueByProgramme: Array<{
    programmeId: string;
    programmeName: string;
    due: number;
    collected: number;
  }>;
}

export interface DefaulterListQuery {
  limit?: number;
  offset?: number;
  sort?: 'overdueAmount' | 'daysOverdue';
}

export interface DefaulterListItem {
  studentId: string;
  rollNumber: string;
  name: string;
  programmeName: string;
  overdueAmount: number;
  daysOverdue: number;
  escalationStage: string;
  autoEscalationPaused?: Date | null;
}

// ── Helpers ───────────────────────────────────────────────────────────

const KNOWN_PAYMENT_MODES: ReadonlyArray<PaymentModeKey> = [
  'cash',
  'upi',
  'neft',
  'cheque',
  'online',
  'card',
  'other',
];

const ACTIVE_DEFAULTER_STAGES = [
  'stage_1',
  'stage_2',
  'stage_3',
  'stage_4',
  'welfare_referred',
] as const;

const UNPAID_INVOICE_STATUSES = [
  'draft',
  'generated',
  'sent',
  'partially_paid',
  'overdue',
  'disputed',
];

function emptyFunnel(): FunnelByStage {
  return {
    stage_1: 0,
    stage_2: 0,
    stage_3: 0,
    stage_4: 0,
    welfare_referred: 0,
  };
}

function emptyModeBreakdown(): PaymentModeBreakdown {
  return {
    cash: 0,
    upi: 0,
    neft: 0,
    cheque: 0,
    online: 0,
    card: 0,
    other: 0,
  };
}

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function toObjectIds(ids: string[]): Types.ObjectId[] {
  return ids.map(toObjectId);
}

/**
 * Pre-compute the set of programmeIds that the caller is allowed to
 * see. For admins / non-HOD roles this returns `null` (no restriction).
 * For HODs it returns the configured programme scope, intersected with
 * the explicit `programmeIds` filter if one was supplied.
 */
function resolveProgrammeScope(
  filters: DashboardFilters,
  auth: AuthScope,
): Types.ObjectId[] | null {
  const hodScope = auth.hodProgrammeIds && auth.hodProgrammeIds.length > 0
    ? toObjectIds(auth.hodProgrammeIds)
    : null;
  const explicit = filters.programmeIds && filters.programmeIds.length > 0
    ? toObjectIds(filters.programmeIds)
    : null;

  if (!hodScope && !explicit) return null;
  if (hodScope && !explicit) return hodScope;
  if (!hodScope && explicit) return explicit;

  // Intersect.
  const hodSet = new Set((hodScope ?? []).map((o) => o.toString()));
  const intersection = (explicit ?? []).filter((o) => hodSet.has(o.toString()));
  return intersection;
}

/**
 * Build a `$lookup + $match` pair that restricts a pipeline to
 * students belonging to `programmeScope`. Caller specifies the
 * field path that holds the studentId (e.g. `'studentId'`).
 *
 * Result: two stages that populate a transient `_studentDoc` array
 * and filter it by `programmeId ∈ programmeScope`. Use
 * `addStudentScopeStages` in pipelines where HOD / programme filters
 * must apply.
 */
function addStudentScopeStages(
  programmeScope: Types.ObjectId[] | null,
  studentIdField = 'studentId',
): PipelineStage[] {
  if (!programmeScope) return [];
  return [
    {
      $lookup: {
        from: 'students',
        localField: studentIdField,
        foreignField: '_id',
        as: '_studentDoc',
      },
    },
    { $unwind: '$_studentDoc' },
    { $match: { '_studentDoc.programmeId': { $in: programmeScope } } },
  ];
}

/**
 * Compute the last N months (inclusive of `to`) as a list of
 * { year, month, key } entries where `key` is `YYYY-MM`.
 */
function lastNMonths(to: Date, n: number): Array<{ year: number; month: number; key: string }> {
  const out: Array<{ year: number; month: number; key: string }> = [];
  const anchor = new Date(to.getFullYear(), to.getMonth(), 1);
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    out.push({
      year: y,
      month: m,
      key: `${y}-${String(m).padStart(2, '0')}`,
    });
  }
  return out;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Build the consolidated dashboard payload. Six sub-aggregations run in
 * parallel. Every pipeline filters by `collegeId` first; HOD-scoped
 * callers also get a programmeId filter injected at the Student level.
 */
export async function getDashboard(
  collegeId: string,
  filters: DashboardFilters,
  auth: AuthScope,
): Promise<DashboardV1> {
  const collegeObjId = toObjectId(collegeId);
  const programmeScope = resolveProgrammeScope(filters, auth);
  // Empty scope array ⇒ HOD with no allowed programmes ⇒ everything empty.
  const scopedToEmpty = programmeScope !== null && programmeScope.length === 0;

  const { from, to } = filters;

  // ── 1. totalOutstanding — sum of totalAmount on unpaid invoices,
  //      minus successful payments for those students.
  const outstandingPipeline: PipelineStage[] = [
    { $match: { collegeId: collegeObjId, status: { $in: UNPAID_INVOICE_STATUSES } } },
    ...addStudentScopeStages(programmeScope, 'studentId'),
    { $group: { _id: null, due: { $sum: '$totalAmount' } } },
  ];

  // ── 2. collectedInRange — sum of successful Payment.amount in window.
  const collectedPipeline: PipelineStage[] = [
    {
      $match: {
        collegeId: collegeObjId,
        status: 'success',
        createdAt: { $gte: from, $lte: to },
      },
    },
    ...addStudentScopeStages(programmeScope, 'studentId'),
    { $group: { _id: null, amount: { $sum: '$amount' } } },
  ];

  // ── 3. funnel — group DefaulterRecord.escalationStage (active only).
  const funnelPipeline: PipelineStage[] = [
    {
      $match: {
        collegeId: collegeObjId,
        escalationStage: { $in: [...ACTIVE_DEFAULTER_STAGES] },
      },
    },
    ...addStudentScopeStages(programmeScope, 'studentId'),
    { $group: { _id: '$escalationStage', count: { $sum: 1 } } },
  ];

  // ── 4. overdue count + amount (distinct students, sum overdueAmount).
  const overduePipeline: PipelineStage[] = [
    {
      $match: {
        collegeId: collegeObjId,
        escalationStage: { $in: [...ACTIVE_DEFAULTER_STAGES] },
      },
    },
    ...addStudentScopeStages(programmeScope, 'studentId'),
    {
      $group: {
        _id: null,
        students: { $addToSet: '$studentId' },
        overdueAmount: { $sum: '$overdueAmount' },
      },
    },
    {
      $project: {
        _id: 0,
        overdueStudentsCount: { $size: '$students' },
        overdueAmount: '$overdueAmount',
      },
    },
  ];

  // ── 5. collectionTimeSeries — daily buckets of successful Payment.amount.
  const timeSeriesPipeline: PipelineStage[] = [
    {
      $match: {
        collegeId: collegeObjId,
        status: 'success',
        createdAt: { $gte: from, $lte: to },
      },
    },
    ...addStudentScopeStages(programmeScope, 'studentId'),
    {
      $group: {
        _id: { $dateTrunc: { date: '$createdAt', unit: 'day' } },
        amount: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ];

  // ── 6. paymentModeBreakdown — group by paymentMode; non-enum / null
  //      values fall into the 'other' bucket via $cond at reduce time.
  const modePipeline: PipelineStage[] = [
    {
      $match: {
        collegeId: collegeObjId,
        status: 'success',
        createdAt: { $gte: from, $lte: to },
      },
    },
    ...addStudentScopeStages(programmeScope, 'studentId'),
    { $group: { _id: '$paymentMode', amount: { $sum: '$amount' } } },
  ];

  // ── 7. dueByProgramme — join Invoice → Student → Programme.
  const byProgrammePipeline: PipelineStage[] = [
    { $match: { collegeId: collegeObjId } },
    {
      $lookup: {
        from: 'students',
        localField: 'studentId',
        foreignField: '_id',
        as: '_student',
      },
    },
    { $unwind: '$_student' },
    // Orphan-student guard: drop invoices whose student has no programmeId.
    { $match: { '_student.programmeId': { $exists: true, $ne: null } } },
    ...(programmeScope
      ? [{ $match: { '_student.programmeId': { $in: programmeScope } } }]
      : []),
    {
      $lookup: {
        from: 'programmes',
        localField: '_student.programmeId',
        foreignField: '_id',
        as: '_programme',
      },
    },
    { $unwind: '$_programme' },
    {
      $group: {
        _id: '$_programme._id',
        programmeName: { $first: '$_programme.name' },
        due: {
          $sum: {
            $cond: [
              { $in: ['$status', UNPAID_INVOICE_STATUSES] },
              '$totalAmount',
              0,
            ],
          },
        },
      },
    },
    { $sort: { programmeName: 1 } },
  ];

  // Collected-by-programme is computed separately so we can join on
  // Payment → Student → Programme with the appropriate range window.
  const collectedByProgrammePipeline: PipelineStage[] = [
    {
      $match: {
        collegeId: collegeObjId,
        status: 'success',
        createdAt: { $gte: from, $lte: to },
      },
    },
    {
      $lookup: {
        from: 'students',
        localField: 'studentId',
        foreignField: '_id',
        as: '_student',
      },
    },
    { $unwind: '$_student' },
    { $match: { '_student.programmeId': { $exists: true, $ne: null } } },
    ...(programmeScope
      ? [{ $match: { '_student.programmeId': { $in: programmeScope } } }]
      : []),
    { $group: { _id: '$_student.programmeId', collected: { $sum: '$amount' } } },
  ];

  // ── dueVsCollectedByMonth — last 6 months ending at `to`.
  const sixMonthWindowStart = (() => {
    const anchor = new Date(to.getFullYear(), to.getMonth(), 1);
    return new Date(anchor.getFullYear(), anchor.getMonth() - 5, 1);
  })();

  const dueByMonthPipeline: PipelineStage[] = [
    {
      $match: {
        collegeId: collegeObjId,
        status: { $in: UNPAID_INVOICE_STATUSES.concat(['paid']) },
        issuedDate: { $gte: sixMonthWindowStart, $lte: to },
      },
    },
    ...addStudentScopeStages(programmeScope, 'studentId'),
    {
      $group: {
        _id: {
          year: { $year: '$issuedDate' },
          month: { $month: '$issuedDate' },
        },
        due: { $sum: '$totalAmount' },
      },
    },
  ];

  const collectedByMonthPipeline: PipelineStage[] = [
    {
      $match: {
        collegeId: collegeObjId,
        status: 'success',
        createdAt: { $gte: sixMonthWindowStart, $lte: to },
      },
    },
    ...addStudentScopeStages(programmeScope, 'studentId'),
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        collected: { $sum: '$amount' },
      },
    },
  ];

  // If HOD scope resolved to an empty intersection, short-circuit.
  if (scopedToEmpty) {
    return buildEmptyDashboard(to);
  }

  const [
    outstandingRows,
    collectedRows,
    funnelRows,
    overdueRows,
    timeSeriesRows,
    modeRows,
    byProgrammeRows,
    collectedByProgrammeRows,
    dueByMonthRows,
    collectedByMonthRows,
  ] = await Promise.all([
    Invoice.aggregate<{ _id: null; due: number }>(outstandingPipeline),
    Payment.aggregate<{ _id: null; amount: number }>(collectedPipeline),
    DefaulterRecord.aggregate<{ _id: string; count: number }>(funnelPipeline),
    DefaulterRecord.aggregate<{ overdueStudentsCount: number; overdueAmount: number }>(
      overduePipeline,
    ),
    Payment.aggregate<{ _id: Date; amount: number }>(timeSeriesPipeline),
    Payment.aggregate<{ _id: string | null; amount: number }>(modePipeline),
    Invoice.aggregate<{ _id: Types.ObjectId; programmeName: string; due: number }>(
      byProgrammePipeline,
    ),
    Payment.aggregate<{ _id: Types.ObjectId; collected: number }>(
      collectedByProgrammePipeline,
    ),
    Invoice.aggregate<{ _id: { year: number; month: number }; due: number }>(
      dueByMonthPipeline,
    ),
    Payment.aggregate<{ _id: { year: number; month: number }; collected: number }>(
      collectedByMonthPipeline,
    ),
  ]);

  // ── Assemble ──────────────────────────────────────────────────────
  const totalOutstanding = outstandingRows[0]?.due ?? 0;
  const collectedInRange = collectedRows[0]?.amount ?? 0;

  const denominator = totalOutstanding + collectedInRange;
  const collectionRatePercent = denominator > 0
    ? Math.round((collectedInRange / denominator) * 10000) / 100
    : 0;

  const funnelByStage = emptyFunnel();
  for (const row of funnelRows) {
    if (row._id in funnelByStage) {
      (funnelByStage as unknown as Record<string, number>)[row._id] = row.count;
    }
  }

  const overdueStudentsCount = overdueRows[0]?.overdueStudentsCount ?? 0;
  const overdueAmount = overdueRows[0]?.overdueAmount ?? 0;

  const collectionTimeSeries = timeSeriesRows.map((r) => ({
    bucket: formatYmd(r._id),
    amount: r.amount,
  }));

  const paymentModeBreakdown = emptyModeBreakdown();
  for (const row of modeRows) {
    const key = normalizePaymentMode(row._id);
    paymentModeBreakdown[key] += row.amount;
  }

  // Merge due + collected per programme.
  const programmeCollectedById = new Map<string, number>();
  for (const row of collectedByProgrammeRows) {
    programmeCollectedById.set(row._id.toString(), row.collected);
  }
  const dueByProgramme = byProgrammeRows.map((r) => ({
    programmeId: r._id.toString(),
    programmeName: r.programmeName,
    due: r.due,
    collected: programmeCollectedById.get(r._id.toString()) ?? 0,
  }));

  // Splice in purely-collected programmes that have no due-side entry.
  for (const row of collectedByProgrammeRows) {
    const key = row._id.toString();
    if (!dueByProgramme.some((p) => p.programmeId === key)) {
      dueByProgramme.push({
        programmeId: key,
        programmeName: '',
        due: 0,
        collected: row.collected,
      });
    }
  }

  // ── dueVsCollectedByMonth — synthesize empty buckets. ─────────────
  const monthKeys = lastNMonths(to, 6);
  const dueByMonthMap = new Map<string, number>();
  for (const r of dueByMonthRows) {
    const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
    dueByMonthMap.set(key, r.due);
  }
  const collectedByMonthMap = new Map<string, number>();
  for (const r of collectedByMonthRows) {
    const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
    collectedByMonthMap.set(key, r.collected);
  }
  const dueVsCollectedByMonth = monthKeys.map(({ key }) => ({
    month: key,
    due: dueByMonthMap.get(key) ?? 0,
    collected: collectedByMonthMap.get(key) ?? 0,
  }));

  return {
    totalOutstanding,
    collectedInRange,
    collectionRatePercent,
    overdueStudentsCount,
    overdueAmount,
    funnelByStage,
    collectionTimeSeries,
    dueVsCollectedByMonth,
    paymentModeBreakdown,
    dueByProgramme,
  };
}

/**
 * Paginated, sorted top-N defaulters list. Excludes "cleared" records
 * (resolved / exited_* stages). HOD scope intersects with the caller's
 * programme scope (same semantics as `getDashboard`).
 */
export async function getDefaulters(
  collegeId: string,
  query: DefaulterListQuery,
  auth: AuthScope,
): Promise<{ items: DefaulterListItem[]; total: number }> {
  const collegeObjId = toObjectId(collegeId);
  const programmeScope = resolveProgrammeScope({ from: new Date(0), to: new Date() }, auth);
  const scopedToEmpty = programmeScope !== null && programmeScope.length === 0;
  if (scopedToEmpty) return { items: [], total: 0 };

  const limit = Math.max(1, Math.min(query.limit ?? 50, 500));
  const offset = Math.max(0, query.offset ?? 0);
  const sortField = query.sort === 'daysOverdue' ? 'daysOverdue' : 'overdueAmount';

  const baseMatch: PipelineStage.Match = {
    $match: {
      collegeId: collegeObjId,
      escalationStage: { $in: [...ACTIVE_DEFAULTER_STAGES] },
    },
  };

  const scopeStages = addStudentScopeStages(programmeScope, 'studentId');

  const itemsPipeline: PipelineStage[] = [
    baseMatch,
    ...scopeStages,
    { $sort: { [sortField]: -1, _id: 1 } },
    { $skip: offset },
    { $limit: limit },
    // Re-join student (if not already via scopeStages) for display.
    ...(scopeStages.length === 0
      ? [
          {
            $lookup: {
              from: 'students',
              localField: 'studentId',
              foreignField: '_id',
              as: '_studentDoc',
            },
          },
          { $unwind: { path: '$_studentDoc', preserveNullAndEmptyArrays: true } },
        ]
      : []),
    {
      $lookup: {
        from: 'people',
        localField: '_studentDoc.personId',
        foreignField: '_id',
        as: '_person',
      },
    },
    { $unwind: { path: '$_person', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'programmes',
        localField: '_studentDoc.programmeId',
        foreignField: '_id',
        as: '_programme',
      },
    },
    { $unwind: { path: '$_programme', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        studentId: { $toString: '$studentId' },
        rollNumber: { $ifNull: ['$_studentDoc.rollNumber', ''] },
        name: { $ifNull: ['$_person.name', ''] },
        programmeName: { $ifNull: ['$_programme.name', ''] },
        overdueAmount: '$overdueAmount',
        daysOverdue: '$daysOverdue',
        escalationStage: '$escalationStage',
        autoEscalationPaused: '$autoEscalationPaused',
      },
    },
  ];

  const countPipeline: PipelineStage[] = [
    baseMatch,
    ...scopeStages,
    { $count: 'total' },
  ];

  const [items, countRows] = await Promise.all([
    DefaulterRecord.aggregate<DefaulterListItem>(itemsPipeline),
    DefaulterRecord.aggregate<{ total: number }>(countPipeline),
  ]);

  const total = countRows[0]?.total ?? 0;
  return { items, total };
}

// ── Internals ─────────────────────────────────────────────────────────

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizePaymentMode(mode: string | null | undefined): PaymentModeKey {
  if (!mode) return 'other';
  return (KNOWN_PAYMENT_MODES as ReadonlyArray<string>).includes(mode)
    ? (mode as PaymentModeKey)
    : 'other';
}

function buildEmptyDashboard(to: Date): DashboardV1 {
  return {
    totalOutstanding: 0,
    collectedInRange: 0,
    collectionRatePercent: 0,
    overdueStudentsCount: 0,
    overdueAmount: 0,
    funnelByStage: emptyFunnel(),
    collectionTimeSeries: [],
    dueVsCollectedByMonth: lastNMonths(to, 6).map(({ key }) => ({
      month: key,
      due: 0,
      collected: 0,
    })),
    paymentModeBreakdown: emptyModeBreakdown(),
    dueByProgramme: [],
  };
}

// Silence "unused" warnings on fields reserved for future filter
// expansion (branchIds, batchIds, academicYearId).
void (undefined as unknown as Pick<DashboardFilters, 'branchIds' | 'batchIds' | 'academicYearId'>);

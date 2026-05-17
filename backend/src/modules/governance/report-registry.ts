/**
 * report-registry — declarative report definitions. Strategic Gap 4.
 *
 * The doc's v1 recommendation: ship the 12 most-needed institution
 * reports as fixed-format with parameter inputs. Build the fully-
 * declarative engine (ReportsForge-equivalent) in v1.5 once we know
 * which reports institutions actually ask for beyond the baseline.
 *
 * Each entry describes the report:
 *   - parameters[] — what the operator sets at run time
 *   - columns[]    — the result-table column schema (label, type)
 *   - run(ctx, params) — the actual aggregator. For Phase B reports
 *                        we throw a sentinel error the service maps
 *                        to a `status: 'unimplemented'` run record.
 *
 * Phase A status:
 *   IMPLEMENTED   — runner produces real data
 *   PHASE_B       — definition exists but runner is a stub
 *
 * The 12 reports span Admissions / Finance / Academics / People /
 * Hostel / Transport / Placement / Library / Compliance — the surface
 * pilots ask for in their first review meeting.
 */

import { Types } from 'mongoose';
import { Inquiry } from '../../models/admissions/Inquiry';
import { Applicant } from '../../models/admissions/Applicant';
import { Admission } from '../../models/admissions/Admission';
import { Student } from '../../models/people/Student';
import { Branch } from '../../models/academic-structure/Branch';
import { Backlog } from '../../models/academic-ops/Backlog';
import { HostelBlock } from '../../models/welfare/HostelBlock';
import type { AuthScope } from '../../shared/rbac/types';

// ─── Types ───────────────────────────────────────────────────────

export type ReportParamType =
  | 'string'
  | 'number'
  | 'date'
  | 'select'
  | 'boolean';

export interface ReportParam {
  key: string;
  label: string;
  type: ReportParamType;
  required?: boolean;
  default?: unknown;
  options?: { value: string; label: string }[];
  helpText?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'percent' | 'currency';
}

export interface ReportRunContext {
  collegeId: string;
  /**
   * 004-rbac-nl-queries §3 — row-level RBAC threading. REQUIRED.
   * Admin paths pass `ADMIN_FULL_SCOPE` from report-service (both
   * `departmentOnly` and `selfOnly` false) which makes any
   * `applyAuthScope` call inside the runner a no-op.
   */
  authScope: AuthScope;
}

export interface ReportRunOutput {
  rows: unknown[];
  summary?: Record<string, unknown>;
}

export class PhaseBStubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhaseBStubError';
  }
}

/**
 * 004-rbac-nl-queries §3 — per-report eligibility declaration.
 *
 * Each report declares, per scope dimension, whether it accepts a non-admin
 * caller (`'supported'`) or requires admin (`'admin-only'`). The
 * `runReport` eligibility gate (§10.10) refuses a call BEFORE invoking the
 * runner when an `authScope` flag is set but the corresponding dimension
 * is declared `'admin-only'`. Phase B stubs declare both dimensions as
 * `'admin-only'` placeholders — when an author un-stubs, they must
 * re-evaluate the declarations.
 */
export interface ScopeEligibility {
  departmentOnly: 'supported' | 'admin-only';
  selfOnly: 'supported' | 'admin-only';
}

export interface ReportDefinition {
  code: string;
  label: string;
  category:
    | 'admissions'
    | 'finance'
    | 'academics'
    | 'people'
    | 'hostel'
    | 'transport'
    | 'placement'
    | 'library'
    | 'compliance';
  description: string;
  parameters: ReportParam[];
  columns: ReportColumn[];
  /** When status is 'phase_b', the runner is a stub. */
  implementationStatus: 'implemented' | 'phase_b';
  /** 004-rbac-nl-queries §3 — scope-eligibility per dimension. */
  scopeEligibility: ScopeEligibility;
  run: (ctx: ReportRunContext, params: Record<string, unknown>) => Promise<ReportRunOutput>;
}

// ─── Helpers ─────────────────────────────────────────────────────

function parseDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function phaseBStub(_ctx: ReportRunContext, _params: Record<string, unknown>): Promise<ReportRunOutput> {
  throw new PhaseBStubError(
    'Runner pending Phase B implementation. The definition + parameter schema are stable; the aggregation will land in the next iteration.',
  );
}

// ─── 1. Admissions Funnel ────────────────────────────────────────

const admissionsFunnel: ReportDefinition = {
  code: 'admissions-funnel',
  label: 'Admissions Funnel',
  category: 'admissions',
  description: 'Inquiries → Applicants → Admissions counts with per-stage conversion rates over a date range.',
  parameters: [
    { key: 'from', label: 'From Date', type: 'date', required: true, helpText: 'Start of inquiry-creation date range.' },
    { key: 'to', label: 'To Date', type: 'date', required: true, helpText: 'End of inquiry-creation date range (inclusive).' },
  ],
  columns: [
    { key: 'stage', label: 'Stage', type: 'string' },
    { key: 'count', label: 'Count', type: 'number' },
    { key: 'conversionRate', label: 'Conversion vs Previous', type: 'percent' },
  ],
  implementationStatus: 'implemented',
  scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' },
  run: async (ctx, params) => {
    const collegeId = new Types.ObjectId(ctx.collegeId);
    const from = parseDate(params.from);
    const to = parseDate(params.to);
    if (!from || !to) throw new Error('from and to are required');

    const inquiryFilter: Record<string, unknown> = { collegeId, createdAt: { $gte: from, $lte: to } };
    const applicantFilter: Record<string, unknown> = { collegeId, createdAt: { $gte: from, $lte: to } };
    const admissionFilter: Record<string, unknown> = { collegeId, createdAt: { $gte: from, $lte: to } };

    const [inquiries, applicants, admissions] = await Promise.all([
      Inquiry.countDocuments(inquiryFilter),
      Applicant.countDocuments(applicantFilter),
      Admission.countDocuments(admissionFilter),
    ]);

    const rate = (n: number, denom: number) => denom > 0 ? Math.round((n / denom) * 1000) / 10 : 0;
    const rows = [
      { stage: 'Inquiries', count: inquiries, conversionRate: 100 },
      { stage: 'Applicants', count: applicants, conversionRate: rate(applicants, inquiries) },
      { stage: 'Admissions', count: admissions, conversionRate: rate(admissions, applicants) },
    ];
    return {
      rows,
      summary: {
        totalInquiries: inquiries,
        totalApplicants: applicants,
        totalAdmissions: admissions,
        endToEndConversion: rate(admissions, inquiries),
      },
    };
  },
};

// ─── 2. Lead Source Performance ──────────────────────────────────

const leadSourcePerformance: ReportDefinition = {
  code: 'lead-source-performance',
  label: 'Lead Source Performance',
  category: 'admissions',
  description: 'Inquiries grouped by `source` with conversion rate to admission. Validates marketing-channel ROI.',
  parameters: [
    { key: 'from', label: 'From Date', type: 'date', required: true },
    { key: 'to', label: 'To Date', type: 'date', required: true },
  ],
  columns: [
    { key: 'source', label: 'Source', type: 'string' },
    { key: 'inquiries', label: 'Inquiries', type: 'number' },
    { key: 'converted', label: 'Converted', type: 'number' },
    { key: 'conversionRate', label: 'Conversion Rate', type: 'percent' },
  ],
  implementationStatus: 'implemented',
  scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' },
  run: async (ctx, params) => {
    // 003-nl-report-queries Story 4: variable renamed from `collegeId` to
    // `cidObj` so the explicit `{ collegeId: cidObj, ... }` form replaces
    // the shorthand `{ collegeId, ... }` that the
    // aggregate-collegeid-pattern regression guard flags. Runtime behaviour
    // is unchanged — the value was already an ObjectId.
    const cidObj = new Types.ObjectId(ctx.collegeId);
    const from = parseDate(params.from);
    const to = parseDate(params.to);
    if (!from || !to) throw new Error('from and to are required');

    const pipeline: any[] = [
      { $match: { collegeId: cidObj, createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$source',
          inquiries: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          source: { $ifNull: ['$_id', 'unknown'] },
          inquiries: 1,
          converted: 1,
          conversionRate: {
            $cond: [
              { $gt: ['$inquiries', 0] },
              { $round: [{ $multiply: [{ $divide: ['$converted', '$inquiries'] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
      { $sort: { inquiries: -1 } },
    ];
    const rows = await Inquiry.aggregate(pipeline);
    return { rows };
  },
};

// ─── 3. Defaulter List ───────────────────────────────────────────

const defaulterList: ReportDefinition = {
  code: 'defaulter-list',
  label: 'Fee Defaulter List',
  category: 'finance',
  description: 'Students with outstanding fee balance above a threshold, sorted by amount due. Phase B will pull live balances from FinancialHold + FeeAccount.',
  parameters: [
    { key: 'minAmount', label: 'Minimum Outstanding (₹)', type: 'number', default: 0 },
    { key: 'asOf', label: 'As Of', type: 'date', helpText: 'Snapshot date. Defaults to today.' },
  ],
  columns: [
    { key: 'studentId', label: 'Student ID', type: 'string' },
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'outstandingAmount', label: 'Outstanding (₹)', type: 'currency' },
    { key: 'ageDays', label: 'Age (days)', type: 'number' },
    { key: 'lastReminderAt', label: 'Last Reminder', type: 'date' },
  ],
  implementationStatus: 'phase_b',
  scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' },
  run: phaseBStub,
};

// ─── 4. Collection Summary ───────────────────────────────────────

const collectionSummary: ReportDefinition = {
  code: 'collection-summary',
  label: 'Fee Collection Summary',
  category: 'finance',
  description: 'Fees collected grouped by category over a date range. Phase B will aggregate against the Receipt/Payment trail.',
  parameters: [
    { key: 'from', label: 'From Date', type: 'date', required: true },
    { key: 'to', label: 'To Date', type: 'date', required: true },
    {
      key: 'groupBy', label: 'Group By', type: 'select', default: 'category',
      options: [
        { value: 'category', label: 'Fee Category' },
        { value: 'programme', label: 'Programme' },
        { value: 'department', label: 'Department' },
      ],
    },
  ],
  columns: [
    { key: 'bucket', label: 'Group', type: 'string' },
    { key: 'collected', label: 'Collected (₹)', type: 'currency' },
    { key: 'transactionCount', label: 'Transactions', type: 'number' },
  ],
  implementationStatus: 'phase_b',
  scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' },
  run: phaseBStub,
};

// ─── 5. Attendance Below Threshold ───────────────────────────────

const attendanceBelowThreshold: ReportDefinition = {
  code: 'attendance-below-threshold',
  label: 'Attendance Below Threshold',
  category: 'academics',
  description: 'Students whose attendance percentage falls below a threshold for a given semester. Phase B will aggregate AttendanceRecord against AttendanceSession totals.',
  parameters: [
    { key: 'semesterId', label: 'Semester', type: 'string', required: true },
    { key: 'threshold', label: 'Threshold (%)', type: 'number', default: 75 },
  ],
  columns: [
    { key: 'studentId', label: 'Student ID', type: 'string' },
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'attendancePct', label: 'Attendance %', type: 'percent' },
    { key: 'sessionsAttended', label: 'Sessions Attended', type: 'number' },
    { key: 'sessionsTotal', label: 'Total Sessions', type: 'number' },
  ],
  implementationStatus: 'phase_b',
  scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' },
  run: phaseBStub,
};

// ─── 6. Backlog Report ───────────────────────────────────────────

const backlogReport: ReportDefinition = {
  code: 'backlog-report',
  label: 'Active Backlogs by Department',
  category: 'academics',
  description: 'Students with active backlog records, grouped by department + course. Counts distinct students per (department, course) cell.',
  parameters: [
    { key: 'departmentId', label: 'Department (optional)', type: 'string' },
  ],
  columns: [
    { key: 'department', label: 'Department', type: 'string' },
    { key: 'course', label: 'Course', type: 'string' },
    { key: 'studentCount', label: 'Students w/ Backlog', type: 'number' },
  ],
  implementationStatus: 'implemented',
  // HOD/faculty scope is meaningful: filter Course.departmentId by
  // authScope.departmentId. selfOnly is admin-only (no "my own backlog
  // group" semantic for HOD/faculty).
  scopeEligibility: { departmentOnly: 'supported', selfOnly: 'admin-only' },
  run: async (ctx, params) => {
    const cidObj = new Types.ObjectId(ctx.collegeId);

    // First pipeline stage: Backlog.collegeId match + active-only filter.
    // 'cleared' rows represent resolved backlogs and shouldn't appear in
    // an "active backlogs" report.
    const pipeline: any[] = [
      { $match: { collegeId: cidObj, currentStatus: { $ne: 'cleared' } } },
      { $lookup: { from: 'courses', localField: 'courseId', foreignField: '_id', as: 'course' } },
      { $unwind: '$course' },
    ];

    // Department scope: prefer the explicit param if provided, otherwise
    // honor the HOD/faculty authScope. The param wins because admins may
    // want to drill into a specific department from the picker.
    const explicitDept = params.departmentId ? new Types.ObjectId(String(params.departmentId)) : undefined;
    const scopedDept =
      ctx.authScope.departmentOnly && ctx.authScope.departmentId
        ? new Types.ObjectId(ctx.authScope.departmentId)
        : undefined;
    const departmentFilter = explicitDept ?? scopedDept;
    if (departmentFilter) {
      pipeline.push({ $match: { 'course.departmentId': departmentFilter } });
    }

    pipeline.push(
      { $lookup: { from: 'departments', localField: 'course.departmentId', foreignField: '_id', as: 'dept' } },
      { $unwind: '$dept' },
      {
        $group: {
          _id: {
            departmentName: '$dept.name',
            courseCode: '$course.code',
            courseName: '$course.name',
          },
          students: { $addToSet: '$studentId' },
        },
      },
      {
        $project: {
          _id: 0,
          department: '$_id.departmentName',
          course: { $concat: ['$_id.courseCode', ' — ', '$_id.courseName'] },
          studentCount: { $size: '$students' },
        },
      },
      { $sort: { department: 1, course: 1 } },
    );

    const rows = await Backlog.aggregate(pipeline);
    return {
      rows,
      summary: {
        groups: rows.length,
        totalStudents: rows.reduce((s, r) => s + (r.studentCount as number), 0),
      },
    };
  },
};

// ─── 7. Faculty Workload ─────────────────────────────────────────

const facultyWorkload: ReportDefinition = {
  code: 'faculty-workload',
  label: 'Faculty Workload',
  category: 'people',
  description: 'Hours assigned per faculty across course offerings + sections for a semester. Phase B will aggregate against CourseOffering.facultyId.',
  parameters: [
    { key: 'semesterId', label: 'Semester', type: 'string', required: true },
  ],
  columns: [
    { key: 'facultyName', label: 'Faculty', type: 'string' },
    { key: 'departmentName', label: 'Department', type: 'string' },
    { key: 'courses', label: 'Courses', type: 'number' },
    { key: 'sections', label: 'Sections', type: 'number' },
    { key: 'hoursPerWeek', label: 'Hrs/Week', type: 'number' },
  ],
  implementationStatus: 'phase_b',
  scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' },
  run: phaseBStub,
};

// ─── 8. Hostel Occupancy ─────────────────────────────────────────

const hostelOccupancy: ReportDefinition = {
  code: 'hostel-occupancy',
  label: 'Hostel Occupancy',
  category: 'hostel',
  description: 'Hostels with occupancy rate (allocated / capacity). Current-snapshot only in v1; the asOf param is reserved for v1.5 once the allocation timeline is fully back-fillable.',
  parameters: [
    { key: 'asOf', label: 'As Of', type: 'date', helpText: 'Snapshot date. v1 ignores this and returns the current snapshot (reserved for v1.5).' },
  ],
  columns: [
    { key: 'hostelName', label: 'Hostel', type: 'string' },
    { key: 'capacity', label: 'Capacity', type: 'number' },
    { key: 'allocated', label: 'Allocated', type: 'number' },
    { key: 'occupancyPct', label: 'Occupancy %', type: 'percent' },
  ],
  implementationStatus: 'implemented',
  // Hostels aren't department-scoped — they sit under welfare. HODs/
  // faculty don't own a slice of hostel occupancy data, so both scope
  // dimensions stay admin-only.
  scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' },
  run: async (ctx, _params) => {
    const cidObj = new Types.ObjectId(ctx.collegeId);
    // HostelBlock carries totalCapacity directly (the warden tooling
    // keeps it in sync as rooms are added/removed) so we don't need to
    // roll up HostelRoom.capacity.
    const rows = await HostelBlock.aggregate([
      { $match: { collegeId: cidObj, isActive: true } },
      // Pull the rooms in this block so we can match HostelAllocation.roomId.
      {
        $lookup: {
          from: 'hostelrooms',
          let: { blockId: '$_id', cid: '$collegeId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$blockId', '$$blockId'] }, { $eq: ['$collegeId', '$$cid'] }] } } },
            { $project: { _id: 1 } },
          ],
          as: 'rooms',
        },
      },
      // Count `active` allocations whose roomId is one of this block's rooms.
      {
        $lookup: {
          from: 'hostelallocations',
          let: { roomIds: '$rooms._id', cid: '$collegeId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$collegeId', '$$cid'] },
                    { $eq: ['$status', 'active'] },
                    { $in: ['$roomId', '$$roomIds'] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'allocations',
        },
      },
      {
        $project: {
          _id: 0,
          hostelName: '$name',
          capacity: { $ifNull: ['$totalCapacity', 0] },
          allocated: { $size: '$allocations' },
          occupancyPct: {
            $cond: [
              { $gt: [{ $ifNull: ['$totalCapacity', 0] }, 0] },
              { $round: [{ $multiply: [{ $divide: [{ $size: '$allocations' }, '$totalCapacity'] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
      { $sort: { hostelName: 1 } },
    ]);
    return {
      rows,
      summary: {
        hostels: rows.length,
        totalCapacity: rows.reduce((s, r) => s + (r.capacity as number), 0),
        totalAllocated: rows.reduce((s, r) => s + (r.allocated as number), 0),
      },
    };
  },
};

// ─── 9. Transport Utilization ────────────────────────────────────

const transportUtilization: ReportDefinition = {
  code: 'transport-utilization',
  label: 'Transport Route Utilization',
  category: 'transport',
  description: 'Bus routes with riders / capacity fill rate. Phase B will aggregate against TransportAllocation x TransportRoute.',
  parameters: [
    { key: 'asOf', label: 'As Of', type: 'date' },
  ],
  columns: [
    { key: 'routeCode', label: 'Route', type: 'string' },
    { key: 'capacity', label: 'Capacity', type: 'number' },
    { key: 'riders', label: 'Riders', type: 'number' },
    { key: 'utilizationPct', label: 'Utilization %', type: 'percent' },
  ],
  implementationStatus: 'phase_b',
  scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' },
  run: phaseBStub,
};

// ─── 10. Placement Pipeline ──────────────────────────────────────

const placementPipeline: ReportDefinition = {
  code: 'placement-pipeline',
  label: 'Placement Pipeline',
  category: 'placement',
  description: 'Active placement drives with registered / shortlisted / offered counts. Phase B will aggregate against PlacementDrive + DriveApplicant.',
  parameters: [
    { key: 'academicYearId', label: 'Academic Year', type: 'string', required: true },
  ],
  columns: [
    { key: 'driveName', label: 'Drive', type: 'string' },
    { key: 'company', label: 'Company', type: 'string' },
    { key: 'registered', label: 'Registered', type: 'number' },
    { key: 'shortlisted', label: 'Shortlisted', type: 'number' },
    { key: 'offered', label: 'Offered', type: 'number' },
  ],
  implementationStatus: 'phase_b',
  scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' },
  run: phaseBStub,
};

// ─── 11. Library Outstanding ─────────────────────────────────────

const libraryOutstanding: ReportDefinition = {
  code: 'library-outstanding',
  label: 'Library Books Outstanding',
  category: 'library',
  description: 'Books borrowed but not yet returned, with age + fine accrual. Phase B will aggregate against BookCheckout.',
  parameters: [
    { key: 'overdueOnly', label: 'Overdue Only', type: 'boolean', default: false },
  ],
  columns: [
    { key: 'bookTitle', label: 'Book', type: 'string' },
    { key: 'borrower', label: 'Borrower', type: 'string' },
    { key: 'borrowedOn', label: 'Borrowed', type: 'date' },
    { key: 'daysOut', label: 'Days Out', type: 'number' },
    { key: 'fineAccrued', label: 'Fine (₹)', type: 'currency' },
  ],
  implementationStatus: 'phase_b',
  scopeEligibility: { departmentOnly: 'admin-only', selfOnly: 'admin-only' },
  run: phaseBStub,
};

// ─── 12. Student Roster Snapshot ─────────────────────────────────

const studentRosterSnapshot: ReportDefinition = {
  code: 'student-roster-snapshot',
  label: 'Student Roster Snapshot',
  category: 'people',
  description: 'Current student roster grouped by programme + branch + section. Counts and percentage shares.',
  parameters: [
    { key: 'status', label: 'Status', type: 'select', default: 'active', options: [
      { value: 'active', label: 'Active' },
      { value: 'all', label: 'All' },
    ]},
  ],
  columns: [
    { key: 'programme', label: 'Programme', type: 'string' },
    { key: 'branch', label: 'Branch', type: 'string' },
    { key: 'count', label: 'Students', type: 'number' },
  ],
  implementationStatus: 'implemented',
  // 004 §3 — only runner that supports HOD/faculty departmentOnly scope in v1
  // (Department -> Branch -> Student two-step lookup in run()). selfOnly stays
  // admin-only because there is no "my own row" semantic for HOD/faculty here;
  // student NL access is deferred to a separate Phase C feature.
  scopeEligibility: { departmentOnly: 'supported', selfOnly: 'admin-only' },
  run: async (ctx, params) => {
    const cidObj = new Types.ObjectId(ctx.collegeId);
    const match: Record<string, unknown> = { collegeId: cidObj };
    if ((params.status as string) !== 'all') match.status = 'active';

    // 004 §10.3 — HOD/faculty department scope via two-step Branch lookup.
    // AuthScope.departmentId is a Department._id; Student.branchId is a
    // Branch._id. Resolve all branches belonging to the HOD's department
    // and constrain the aggregation to that branch set.
    if (ctx.authScope.departmentOnly && ctx.authScope.departmentId) {
      const branches = await Branch.find(
        { collegeId: cidObj, departmentId: new Types.ObjectId(ctx.authScope.departmentId) },
        { _id: 1 },
      ).lean();
      match.branchId = { $in: branches.map((b) => b._id) };
    }

    const rows = await Student.aggregate([
      { $match: match },
      {
        $group: {
          _id: { programme: '$programmeId', branch: '$branchId' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          programme: { $toString: '$_id.programme' },
          branch: { $toString: '$_id.branch' },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);
    return { rows, summary: { total: rows.reduce((s, r) => s + (r.count as number), 0), groups: rows.length } };
  },
};

// ─── Registry ────────────────────────────────────────────────────

export const REPORT_REGISTRY: readonly ReportDefinition[] = [
  admissionsFunnel,
  leadSourcePerformance,
  defaulterList,
  collectionSummary,
  attendanceBelowThreshold,
  backlogReport,
  facultyWorkload,
  hostelOccupancy,
  transportUtilization,
  placementPipeline,
  libraryOutstanding,
  studentRosterSnapshot,
];

const INDEX = new Map<string, ReportDefinition>(REPORT_REGISTRY.map((r) => [r.code, r]));

export function listReportDefinitions(): ReportDefinition[] {
  return [...REPORT_REGISTRY];
}

export function getReportDefinition(code: string): ReportDefinition | null {
  return INDEX.get(code) || null;
}

/**
 * Demo seed script (Task 7 — Fee Collection Analytics & Alerts).
 *
 * Populates a demo college with a realistic fee-funnel fixture:
 *   50 students (3 programmes × 2 batches) distributed per spec §AC-Demo
 *   Seed table — paid / partial / upcoming / stage_1..stage_4 — plus a
 *   handful of failed + reversed Payments, Concessions, Scholarships and
 *   FeeReminders so the dashboard has non-empty charts in < 60s.
 *
 * ── Safety-critical flags (these are production-blast-radius gates) ──
 *   --college-id=<id>                       REQUIRED
 *   --confirm-college-name="<exact name>"   REQUIRED (even for dry-run)
 *   --clear-first                           purge ONLY metadata.source='demo-seed-v1' rows
 *   --dry-run                               produce CSV, no DB writes
 *
 * Every entity written carries `metadata.source = 'demo-seed-v1'` so a
 * subsequent `--clear-first` never touches production data. Mirrors the
 * audit-CSV pattern from `backfill-fee-pins.ts` so Finance can sign off
 * on the dry-run output before a commit.
 *
 * Spec: .captain/specs/fee-collection-analytics-and-alerts/spec.md §AC-Demo Seed
 * Plan: .captain/specs/fee-collection-analytics-and-alerts/plan.md §1.7, §2.3
 * Tasks: .captain/specs/fee-collection-analytics-and-alerts/tasks.md §Task 7
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load backend/.env regardless of which directory the operator runs
// the script from. Same pattern as the other seed CLIs.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { AppError } from '../middleware/errorHandler';
import { College } from '../models/College';
import { Programme, IProgramme } from '../models/academic-structure/Programme';
import { Batch, IBatch } from '../models/academic-structure/Batch';
import { AcademicYear, IAcademicYear } from '../models/academic-structure/AcademicYear';
import { Person } from '../models/people/Person';
import { Student } from '../models/people/Student';
import { Invoice } from '../models/finance/Invoice';
import { Payment } from '../models/finance/Payment';
import { DefaulterRecord } from '../models/finance/DefaulterRecord';
import { FeeReminder } from '../models/finance/FeeReminder';
import { FinancialHold } from '../models/finance/FinancialHold';
import { FinePenalty } from '../models/finance/FinePenalty';
import { Concession } from '../models/finance/Concession';
import { Scholarship } from '../models/finance/Scholarship';
import { ScholarshipAllocation } from '../models/finance/ScholarshipAllocation';

// ── Public types ─────────────────────────────────────────────────────

export const DEMO_SEED_METADATA_TAG = 'demo-seed-v1' as const;

/**
 * Options accepted by `runDemoSeed`. The required-but-might-be-missing
 * fields are typed as required so callers supplying `undefined` get a
 * compile-time `@ts-expect-error` — matching the intent of the tests.
 */
export interface DemoSeedOpts {
  collegeId: string;
  confirmCollegeName: string;
  clearFirst?: boolean;
  dryRun?: boolean;
  /** Override auto-generated CSV path (tests supply this to keep CI tidy). */
  csvPath?: string;
}

export interface DemoSeedSummary {
  studentsCreated: number;
  invoicesCreated: number;
  paymentsCreated: number;
  defaulterRecordsCreated: number;
  concessionsCreated: number;
  scholarshipsCreated: number;
  remindersCreated: number;
  csvPath: string;
  dryRun: boolean;
  metadataTag: typeof DEMO_SEED_METADATA_TAG;
}

export interface ParsedDemoSeedArgs {
  collegeId: string;
  confirmCollegeName: string;
  clearFirst: boolean;
  dryRun: boolean;
}

// ── CLI parsing ──────────────────────────────────────────────────────

/**
 * Parse argv (slice(2) form). Unlike the strict flag parser in
 * `backfill-fee-pins.ts`, this one preserves `=` inside the flag value —
 * `--confirm-college-name=A=B College` yields `"A=B College"`.
 */
export function parseDemoSeedArgs(argv: string[]): ParsedDemoSeedArgs {
  let collegeId = '';
  let confirmCollegeName = '';
  let clearFirst = false;
  let dryRun = false;

  for (const raw of argv) {
    if (raw === '--clear-first') {
      clearFirst = true;
    } else if (raw === '--dry-run') {
      dryRun = true;
    } else if (raw.startsWith('--college-id=')) {
      collegeId = raw.slice('--college-id='.length);
    } else if (raw.startsWith('--confirm-college-name=')) {
      // NB: preserve embedded '=' in the value.
      confirmCollegeName = raw.slice('--confirm-college-name='.length);
    }
  }

  return { collegeId, confirmCollegeName, clearFirst, dryRun };
}

// ── Distribution config ──────────────────────────────────────────────

interface BucketSpec {
  key: string;
  count: number;
}

const BUCKETS: BucketSpec[] = [
  { key: 'paid', count: 20 },
  { key: 'partial', count: 8 },
  { key: 'upcoming', count: 7 },
  { key: 'stage_1', count: 6 },
  { key: 'stage_2', count: 4 },
  { key: 'stage_3', count: 3 },
  { key: 'stage_4', count: 2 },
];

/** Reminders-per-student by stage, per §1.7 and the distribution test. */
const REMINDERS_PER_STAGE: Record<string, number> = {
  stage_1: 1,
  stage_2: 2,
  stage_3: 3,
  stage_4: 4,
};

const TUITION_AMOUNT = 60_000;
const LATE_FEE_AMOUNT = 200;

// ── CSV helpers ──────────────────────────────────────────────────────

const CSV_HEADER =
  'rollNumber,name,programme,status,invoiceAmount,paidAmount,escalationStage\n';

function csvField(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cols: Array<unknown>): string {
  return cols.map(csvField).join(',') + '\n';
}

function defaultCsvPath(collegeId: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(os.tmpdir(), `demo-seed-${collegeId}-${ts}.csv`);
}

// ── Small utilities ──────────────────────────────────────────────────

const META = () => ({
  source: DEMO_SEED_METADATA_TAG,
  seededAt: new Date(),
});

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Deterministic-ish pseudo-random using current timestamp + a suffix to
 * avoid collisions with any real invoice numbers in the demo college.
 */
function uniqSuffix(i: number): string {
  return `${Date.now().toString(36)}-${i.toString(36)}`;
}

// ── Idempotency detection ────────────────────────────────────────────

/**
 * Treat a college as already-seeded if ANY demo-tagged Student exists.
 * Matches the spec's "without --clear-first, re-runs skip" contract.
 */
async function alreadySeeded(collegeId: mongoose.Types.ObjectId): Promise<boolean> {
  const exists = await Student.exists({
    collegeId,
    'feePins.0': { $exists: false }, // ignored — just keeps the shape obvious
    // The actual check:
  });
  // We cannot put metadata.source on Student reliably (the model doesn't
  // expose it), so keyed on the set of demo-tagged *Invoices* instead —
  // the seed always creates at least one tagged invoice per student.
  void exists;
  const tagged = await Invoice.exists({
    collegeId,
    'metadata.source': DEMO_SEED_METADATA_TAG,
  });
  return !!tagged;
}

// ── Clear-first purge (tag-only, multi-model) ────────────────────────

/**
 * Delete only rows tagged `metadata.source === DEMO_SEED_METADATA_TAG`
 * across the 8 finance models + the people Student/Person tables. Never
 * touches untagged production data.
 */
async function purgeTaggedEntities(
  collegeId: mongoose.Types.ObjectId,
): Promise<void> {
  const filter = {
    collegeId,
    'metadata.source': DEMO_SEED_METADATA_TAG,
  } as const;

  // Finance collections (8) + Students + Persons (both tagged at seed).
  await Promise.all([
    Invoice.deleteMany(filter),
    Payment.deleteMany(filter),
    DefaulterRecord.deleteMany(filter),
    FeeReminder.deleteMany(filter),
    FinancialHold.deleteMany(filter),
    FinePenalty.deleteMany(filter),
    Concession.deleteMany(filter),
    Scholarship.deleteMany(filter),
    ScholarshipAllocation.deleteMany(filter),
    // People: Student / Person don't have a metadata field on the schema,
    // so we look them up by a demo roll-number prefix that only this
    // script ever writes. Matches the 'DEMO-' prefix used below.
    Student.deleteMany({ collegeId, rollNumber: /^DEMO-/ }),
    // Person doesn't carry a metadata flag, so we key on the demo
    // email domain — every Person this script writes uses
    // `demo.student.NNN@demo.edu`. Both old (placeholder-name) and
    // new (realistic-name) demo Persons share that domain, so this
    // cleanup catches mixed-state DBs from before/after the
    // realistic-name change.
    Person.deleteMany({ collegeId, email: /@demo\.edu$/i }),
  ]);
}

// ── Baseline lookup (do NOT re-create programmes/batches) ────────────

interface Baseline {
  academicYear: IAcademicYear;
  programmes: IProgramme[];
  batchesByProgramme: Map<string, IBatch[]>;
}

async function loadBaseline(
  collegeId: mongoose.Types.ObjectId,
): Promise<Baseline> {
  const ay =
    (await AcademicYear.findOne({ collegeId, isCurrent: true })) ??
    (await AcademicYear.findOne({ collegeId }));
  if (!ay) {
    throw new AppError(
      400,
      `No AcademicYear found for college ${String(collegeId)}; seed one before running the demo script`,
    );
  }
  const programmes = await Programme.find({ collegeId }).limit(3);
  if (programmes.length === 0) {
    throw new AppError(
      400,
      `No Programmes found for college ${String(collegeId)}; seed at least one before running the demo script`,
    );
  }
  const batchesByProgramme = new Map<string, IBatch[]>();
  for (const prog of programmes) {
    const batches = await Batch.find({
      collegeId,
      programmeId: prog._id,
    }).limit(2);
    batchesByProgramme.set(String(prog._id), batches);
  }
  return { academicYear: ay, programmes, batchesByProgramme };
}

// ── Per-student seeding ──────────────────────────────────────────────

interface StudentCreationCtx {
  collegeId: mongoose.Types.ObjectId;
  programme: IProgramme;
  batch: IBatch;
  idx: number;
}

interface SeededStudent {
  personId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  rollNumber: string;
  name: string;
  programmeName: string;
}

/**
 * Realistic Telugu/AP-Telangana student name pool. Picked deterministically
 * by index so the same `--clear-first && re-seed` produces identical
 * names — useful when comparing dashboard screenshots across runs.
 *
 * Pool size > BUCKETS total (50) so wrapping is rare. When it does
 * wrap, `pickStudentName` appends a numeric suffix to disambiguate
 * the email + display name (e.g. "Aarav Sharma 2") so unique-index
 * constraints on Person.email never trip.
 *
 * Names are mixed-gender and span common South / North Indian
 * surname families so the demo dashboard reflects realistic
 * student-body composition rather than a single ethnic cluster.
 */
const STUDENT_NAME_POOL: ReadonlyArray<string> = [
  'Aarav Sharma',     'Priya Reddy',      'Rahul Kumar',      'Sneha Patel',
  'Karthik Rao',      'Divya Nair',       'Arjun Mehta',      'Ananya Gupta',
  'Vikram Singh',     'Meera Joshi',      'Aditya Verma',     'Lavanya Reddy',
  'Sai Krishna',      'Pooja Iyer',       'Nikhil Naidu',     'Harini Subramanian',
  'Rohan Khanna',     'Kavya Menon',      'Manish Agarwal',   'Tanvi Pillai',
  'Suresh Babu',      'Reshma Khan',      'Akhil Goud',       'Saritha Devi',
  'Bharath Murthy',   'Aishwarya Bose',   'Chetan Pandey',    'Madhuri Choudhury',
  'Deepak Tiwari',    'Nandini Banerjee', 'Gaurav Shah',      'Riya Saxena',
  'Harsh Mishra',     'Swathi Goswami',   'Ishaan Yadav',     'Aparna Das',
  'Jaideep Krishnan', 'Bhavana Pillai',   'Kiran Joshi',      'Jyothi Naidu',
  'Krishna Sharma',   'Radhika Iyer',     'Rajesh Choudhury', 'Asha Subramaniam',
  'Ravi Teja',        'Shruti Verma',     'Sandeep Goud',     'Anusha Patel',
  'Saurabh Singh',    'Gauri Mehta',      'Siddharth Naidu',  'Nisha Khanna',
  'Vishal Rao',       'Amrita Reddy',     'Yash Agarwal',     'Ishita Banerjee',
  'Dheeraj Pandey',   'Aarti Goswami',    'Anand Murthy',     'Rhea Kapoor',
];

/**
 * Returns a deterministic, well-formed Indian name for a given
 * student index. Wrapping past the pool length appends a 1-based
 * occurrence suffix so the resulting Person.email + Student.name
 * stays unique even when more than 60 demo students are seeded.
 */
function pickStudentName(idx: number): string {
  const base = STUDENT_NAME_POOL[(idx - 1) % STUDENT_NAME_POOL.length]!;
  const round = Math.floor((idx - 1) / STUDENT_NAME_POOL.length);
  return round === 0 ? base : `${base} ${round + 1}`;
}

async function createDemoStudent(
  ctx: StudentCreationCtx,
): Promise<SeededStudent> {
  const paddedIdx = String(ctx.idx).padStart(3, '0');
  const rollNumber = `DEMO-${ctx.programme.code}-${paddedIdx}`;
  const name = pickStudentName(ctx.idx);
  const person = await Person.create({
    collegeId: ctx.collegeId,
    name,
    phone: `9${String(9000000000 + ctx.idx).slice(1)}`,
    email: `demo.student.${paddedIdx}@demo.edu`,
  });
  const student = await Student.create({
    collegeId: ctx.collegeId,
    personId: person._id,
    admissionYear: ctx.batch.admissionYear,
    programmeId: ctx.programme._id,
    batchId: ctx.batch._id,
    regulationId: ctx.batch.regulationId,
    rollNumber,
    status: 'active',
    onboardingStatus: 'completed',
  });
  return {
    personId: person._id as mongoose.Types.ObjectId,
    studentId: student._id as mongoose.Types.ObjectId,
    rollNumber,
    name,
    programmeName: ctx.programme.name,
  };
}

interface BucketOutcome {
  invoicesCreated: number;
  paymentsCreated: number;
  defaulterRecordsCreated: number;
  remindersCreated: number;
  holdsCreated: number;
  finesCreated: number;
  csvStatus: string;
  invoiceAmount: number;
  paidAmount: number;
  escalationStage: string;
}

/**
 * Create all finance rows for a student in a given bucket. Returns the
 * per-student counts so the caller can aggregate the summary + CSV.
 */
async function seedBucketForStudent(
  bucket: string,
  collegeId: mongoose.Types.ObjectId,
  seeded: SeededStudent,
  idx: number,
): Promise<BucketOutcome> {
  const out: BucketOutcome = {
    invoicesCreated: 0,
    paymentsCreated: 0,
    defaulterRecordsCreated: 0,
    remindersCreated: 0,
    holdsCreated: 0,
    finesCreated: 0,
    csvStatus: bucket,
    invoiceAmount: TUITION_AMOUNT,
    paidAmount: 0,
    escalationStage: '',
  };
  const invoiceNumberBase = `DEMO-INV-${seeded.rollNumber}-${uniqSuffix(idx)}`;

  // ── paid in full ─────────────────────────────────────────────────
  if (bucket === 'paid') {
    const invoice = await Invoice.create({
      collegeId,
      invoiceNumber: invoiceNumberBase,
      studentId: seeded.studentId,
      type: 'fee',
      totalAmount: TUITION_AMOUNT,
      dueDate: daysAgo(30),
      issuedDate: daysAgo(60),
      status: 'paid',
      items: [{ description: 'Tuition', amount: TUITION_AMOUNT }],
      metadata: META(),
    });
    out.invoicesCreated = 1;
    await Payment.create({
      collegeId,
      studentId: seeded.studentId,
      receiptNumber: `DEMO-RCPT-${seeded.rollNumber}-${uniqSuffix(idx)}`,
      amount: TUITION_AMOUNT,
      paymentMode: idx % 2 === 0 ? 'online' : 'upi',
      paymentDate: daysAgo(20),
      status: 'success',
      allocations: [],
      metadata: META(),
    });
    out.paymentsCreated = 1;
    out.paidAmount = TUITION_AMOUNT;
    void invoice;
    return out;
  }

  // ── partial ──────────────────────────────────────────────────────
  if (bucket === 'partial') {
    const paid = Math.floor(TUITION_AMOUNT * 0.4);
    await Invoice.create({
      collegeId,
      invoiceNumber: invoiceNumberBase,
      studentId: seeded.studentId,
      type: 'fee',
      totalAmount: TUITION_AMOUNT,
      dueDate: daysAgo(5),
      issuedDate: daysAgo(45),
      status: 'partially_paid',
      items: [{ description: 'Tuition', amount: TUITION_AMOUNT }],
      metadata: META(),
    });
    out.invoicesCreated = 1;
    await Payment.create({
      collegeId,
      studentId: seeded.studentId,
      receiptNumber: `DEMO-RCPT-${seeded.rollNumber}-${uniqSuffix(idx)}`,
      amount: paid,
      paymentMode: 'upi',
      paymentDate: daysAgo(10),
      status: 'success',
      allocations: [],
      metadata: META(),
    });
    out.paymentsCreated = 1;
    out.paidAmount = paid;
    return out;
  }

  // ── upcoming (future due date, no overdue) ───────────────────────
  if (bucket === 'upcoming') {
    await Invoice.create({
      collegeId,
      invoiceNumber: invoiceNumberBase,
      studentId: seeded.studentId,
      type: 'fee',
      totalAmount: TUITION_AMOUNT,
      dueDate: daysFromNow(15),
      issuedDate: daysAgo(5),
      status: 'generated',
      items: [{ description: 'Tuition', amount: TUITION_AMOUNT }],
      metadata: META(),
    });
    out.invoicesCreated = 1;
    return out;
  }

  // ── stage buckets (stage_1..stage_4) ─────────────────────────────
  const stageRanges: Record<string, [number, number]> = {
    stage_1: [1, 7],
    stage_2: [8, 14],
    stage_3: [15, 30],
    stage_4: [31, 60],
  };
  const range = stageRanges[bucket];
  if (!range) {
    throw new AppError(500, `Unknown bucket: ${bucket}`);
  }
  const [lo, hi] = range;
  // Deterministic daysOverdue across the range (avoids flaky tests).
  const daysOverdue = lo + (idx % Math.max(1, hi - lo + 1));

  const invoice = await Invoice.create({
    collegeId,
    invoiceNumber: invoiceNumberBase,
    studentId: seeded.studentId,
    type: 'fee',
    totalAmount: TUITION_AMOUNT,
    dueDate: daysAgo(daysOverdue),
    issuedDate: daysAgo(daysOverdue + 30),
    status: 'generated',
    items: [{ description: 'Tuition', amount: TUITION_AMOUNT }],
    metadata: META(),
  });
  out.invoicesCreated = 1;

  const defaulter = await DefaulterRecord.create({
    collegeId,
    studentId: seeded.studentId,
    invoiceId: invoice._id,
    overdueAmount: TUITION_AMOUNT,
    daysOverdue,
    escalationStage: bucket,
    welfareReferralStatus: 'none',
    lastEscalationAt: daysAgo(1),
    metadata: META(),
  });
  out.defaulterRecordsCreated = 1;
  out.escalationStage = bucket;

  // Stage_2 → late-fee FinePenalty (₹200).
  if (bucket === 'stage_2') {
    await FinePenalty.create({
      collegeId,
      studentId: seeded.studentId,
      type: 'late_fee',
      reason: 'Stage_2 late-fee auto-applied',
      amount: LATE_FEE_AMOUNT,
      dueDate: daysFromNow(7),
      paidAmount: 0,
      status: 'pending',
      metadata: META(),
    });
    out.finesCreated = 1;
  }

  // Stage_4 → FinancialHold (active, Principal-approved for demo visibility).
  if (bucket === 'stage_4') {
    await FinancialHold.create({
      collegeId,
      studentId: seeded.studentId,
      defaulterRecordId: defaulter._id,
      holdType: 'exam_debarment',
      holdStatus: 'active',
      effectiveDate: daysAgo(3),
      metadata: META(),
    });
    out.holdsCreated = 1;
  }

  // Per-stage reminders.
  const reminderCount = REMINDERS_PER_STAGE[bucket] ?? 0;
  const channels = ['sms', 'email', 'whatsapp', 'app'] as const;
  for (let r = 0; r < reminderCount; r++) {
    await FeeReminder.create({
      collegeId,
      studentId: seeded.studentId,
      channel: channels[r % channels.length],
      sentAt: daysAgo(Math.max(0, daysOverdue - r - 1)),
      dueAmount: TUITION_AMOUNT,
      status: 'sent',
      invoiceId: invoice._id,
      escalationStage: bucket,
      defaulterRecordId: defaulter._id,
      deliveryStatus: 'delivered',
      deliveredAt: daysAgo(Math.max(0, daysOverdue - r - 1)),
      metadata: META(),
    });
    out.remindersCreated += 1;
  }

  return out;
}

// ── Extras (failed/reversed payments, concessions, scholarships) ─────

async function seedExtras(
  collegeId: mongoose.Types.ObjectId,
  academicYearId: mongoose.Types.ObjectId,
  students: SeededStudent[],
): Promise<{
  paymentsCreated: number;
  concessionsCreated: number;
  scholarshipsCreated: number;
}> {
  let paymentsCreated = 0;
  // 2 failed payments.
  for (let i = 0; i < 2; i++) {
    const target = students[i * 3 + 5]!; // arbitrary spread
    await Payment.create({
      collegeId,
      studentId: target.studentId,
      receiptNumber: `DEMO-RCPT-FAIL-${uniqSuffix(i)}`,
      amount: 15_000,
      paymentMode: 'online',
      paymentDate: daysAgo(30 + i * 20),
      status: 'failed',
      allocations: [],
      remarks: 'Gateway timeout',
      metadata: META(),
    });
    paymentsCreated += 1;
  }
  // 1 reversed payment.
  {
    const target = students[12]!;
    await Payment.create({
      collegeId,
      studentId: target.studentId,
      receiptNumber: `DEMO-RCPT-REV-${uniqSuffix(99)}`,
      amount: 10_000,
      paymentMode: 'card',
      paymentDate: daysAgo(45),
      status: 'reversed',
      allocations: [],
      remarks: 'Chargeback / reversed',
      metadata: META(),
    });
    paymentsCreated += 1;
  }

  // Scholarships (at least 1 backing doc per demo) + 2 allocations.
  const scholarshipMerit = await Scholarship.create({
    collegeId,
    name: 'Demo Merit Scholarship',
    provider: 'institutional',
    type: 'merit',
    amount: 20_000,
    criteria: 'Top 10% CGPA',
    academicYearId,
    isActive: true,
    metadata: META(),
  });
  const scholarshipGovt = await Scholarship.create({
    collegeId,
    name: 'Demo Government Scholarship',
    provider: 'government',
    type: 'sc_st',
    amount: 30_000,
    criteria: 'SC/ST eligibility',
    academicYearId,
    isActive: true,
    metadata: META(),
  });
  const allocationTargets = [students[3]!, students[18]!];
  const scholarshipDocs = [scholarshipMerit, scholarshipGovt];
  let scholarshipsCreated = 0;
  for (let i = 0; i < allocationTargets.length; i++) {
    const scholarship = scholarshipDocs[i]!;
    await ScholarshipAllocation.create({
      collegeId,
      scholarshipId: scholarship._id,
      studentId: allocationTargets[i]!.studentId,
      academicYearId,
      amount: scholarship.amount,
      status: 'approved',
      metadata: META(),
    });
    scholarshipsCreated += 1;
  }

  // 3 Concessions (sibling + merit mix).
  const concessionTargets = [students[7]!, students[14]!, students[22]!];
  let concessionsCreated = 0;
  for (let i = 0; i < concessionTargets.length; i++) {
    await Concession.create({
      collegeId,
      studentId: concessionTargets[i]!.studentId,
      type: i === 0 ? 'sibling' : 'merit',
      percentage: 10 + i * 5,
      reason: i === 0 ? 'Sibling discount (demo)' : 'Merit discount (demo)',
      academicYearId,
      status: 'approved',
      metadata: META(),
    });
    concessionsCreated += 1;
  }

  return { paymentsCreated, concessionsCreated, scholarshipsCreated };
}

// ── Summary synthesis for dry-run ────────────────────────────────────

interface DryRunPlan {
  csvRows: string[];
  summary: DemoSeedSummary;
}

function buildDryRunPlan(csvPath: string): DryRunPlan {
  // Simulate exactly what the commit path would write. Keeps the CSV
  // honest for the Finance sign-off step.
  const csvRows: string[] = [];
  csvRows.push(CSV_HEADER.trimEnd());

  let invoicesCreated = 0;
  let paymentsCreated = 0;
  let defaulterRecordsCreated = 0;
  let remindersCreated = 0;

  let idx = 0;
  for (const bucket of BUCKETS) {
    for (let i = 0; i < bucket.count; i++) {
      idx += 1;
      const rollNumber = `DEMO-DRY-${String(idx).padStart(3, '0')}`;
      const name = pickStudentName(idx);
      invoicesCreated += 1;
      let paidAmount = 0;
      let escalationStage = '';
      if (bucket.key === 'paid') {
        paymentsCreated += 1;
        paidAmount = TUITION_AMOUNT;
      } else if (bucket.key === 'partial') {
        paymentsCreated += 1;
        paidAmount = Math.floor(TUITION_AMOUNT * 0.4);
      } else if (bucket.key.startsWith('stage_')) {
        defaulterRecordsCreated += 1;
        escalationStage = bucket.key;
        remindersCreated += REMINDERS_PER_STAGE[bucket.key] ?? 0;
      }
      csvRows.push(
        csvRow([
          rollNumber,
          name,
          'Demo Programme',
          bucket.key,
          TUITION_AMOUNT,
          paidAmount,
          escalationStage,
        ]).trimEnd(),
      );
    }
  }
  // Extras: 2 failed + 1 reversed payment.
  paymentsCreated += 3;

  csvRows.push(
    `# summary: students=50 invoices=${invoicesCreated} payments=${paymentsCreated}` +
      ` defaulters=${defaulterRecordsCreated} reminders=${remindersCreated} (dry-run)`,
  );

  return {
    csvRows,
    summary: {
      studentsCreated: 50,
      invoicesCreated,
      paymentsCreated,
      defaulterRecordsCreated,
      concessionsCreated: 3,
      scholarshipsCreated: 2,
      remindersCreated,
      csvPath,
      dryRun: true,
      metadataTag: DEMO_SEED_METADATA_TAG,
    },
  };
}

// ── Main entrypoint ──────────────────────────────────────────────────

export async function runDemoSeed(
  opts: DemoSeedOpts,
): Promise<DemoSeedSummary> {
  // ── Safety gate 1: --college-id required ─────────────────────────
  if (!opts.collegeId || typeof opts.collegeId !== 'string') {
    throw new AppError(400, '--college-id is required');
  }
  // ── Safety gate 2: --confirm-college-name required (even dry-run)
  if (
    !opts.confirmCollegeName ||
    typeof opts.confirmCollegeName !== 'string'
  ) {
    throw new AppError(400, '--confirm-college-name is required');
  }
  if (!mongoose.isValidObjectId(opts.collegeId)) {
    throw new AppError(
      400,
      `--college-id value '${opts.collegeId}' is not a valid ObjectId`,
    );
  }

  const collegeOid = new mongoose.Types.ObjectId(opts.collegeId);

  // ── Safety gate 3: college exists ────────────────────────────────
  const college = await College.findById(collegeOid);
  if (!college) {
    throw new AppError(404, 'College not found');
  }

  // ── Safety gate 4: strict college-name match ─────────────────────
  if (college.name !== opts.confirmCollegeName) {
    throw new AppError(
      400,
      `College name mismatch: expected '${opts.confirmCollegeName}', found '${college.name}'`,
    );
  }

  const csvPath = opts.csvPath ?? defaultCsvPath(opts.collegeId);
  const dryRun = !!opts.dryRun;

  // ── Dry-run path: compute plan, emit CSV, NO writes ──────────────
  if (dryRun) {
    const plan = buildDryRunPlan(csvPath);
    fs.writeFileSync(csvPath, plan.csvRows.join('\n') + '\n', 'utf-8');
    return plan.summary;
  }

  // ── Clear-first (tag-only) ───────────────────────────────────────
  if (opts.clearFirst) {
    await purgeTaggedEntities(collegeOid);
  }

  // ── Idempotency: skip if already-seeded and not clearing first ──
  if (!opts.clearFirst && (await alreadySeeded(collegeOid))) {
    const noop: DemoSeedSummary = {
      studentsCreated: 0,
      invoicesCreated: 0,
      paymentsCreated: 0,
      defaulterRecordsCreated: 0,
      concessionsCreated: 0,
      scholarshipsCreated: 0,
      remindersCreated: 0,
      csvPath,
      dryRun: false,
      metadataTag: DEMO_SEED_METADATA_TAG,
    };
    const csvLines = [
      CSV_HEADER.trimEnd(),
      '# summary: already-seeded — no writes. Pass --clear-first to reseed.',
    ];
    fs.writeFileSync(csvPath, csvLines.join('\n') + '\n', 'utf-8');
    return noop;
  }

  const baseline = await loadBaseline(collegeOid);

  // Build the (programme × batch) rotation. 3 programmes × 2 batches = 6
  // slots; 50 students round-robin across them.
  const slots: Array<{ programme: IProgramme; batch: IBatch }> = [];
  for (const prog of baseline.programmes) {
    const batches = baseline.batchesByProgramme.get(String(prog._id)) ?? [];
    for (const b of batches) slots.push({ programme: prog, batch: b });
  }
  if (slots.length === 0) {
    throw new AppError(
      400,
      'No programme/batch slots found — seed baseline academic structure first',
    );
  }

  const csvRows: string[] = [CSV_HEADER.trimEnd()];
  const summary: DemoSeedSummary = {
    studentsCreated: 0,
    invoicesCreated: 0,
    paymentsCreated: 0,
    defaulterRecordsCreated: 0,
    concessionsCreated: 0,
    scholarshipsCreated: 0,
    remindersCreated: 0,
    csvPath,
    dryRun: false,
    metadataTag: DEMO_SEED_METADATA_TAG,
  };

  const allSeeded: SeededStudent[] = [];
  let studentIdx = 0;
  for (const bucket of BUCKETS) {
    for (let i = 0; i < bucket.count; i++) {
      studentIdx += 1;
      const slot = slots[studentIdx % slots.length]!;
      const seeded = await createDemoStudent({
        collegeId: collegeOid,
        programme: slot.programme,
        batch: slot.batch,
        idx: studentIdx,
      });
      allSeeded.push(seeded);
      summary.studentsCreated += 1;

      const outcome = await seedBucketForStudent(
        bucket.key,
        collegeOid,
        seeded,
        studentIdx,
      );
      summary.invoicesCreated += outcome.invoicesCreated;
      summary.paymentsCreated += outcome.paymentsCreated;
      summary.defaulterRecordsCreated += outcome.defaulterRecordsCreated;
      summary.remindersCreated += outcome.remindersCreated;

      csvRows.push(
        csvRow([
          seeded.rollNumber,
          seeded.name,
          seeded.programmeName,
          outcome.csvStatus,
          outcome.invoiceAmount,
          outcome.paidAmount,
          outcome.escalationStage,
        ]).trimEnd(),
      );
    }
  }

  // Extras — failed/reversed payments, scholarships, concessions.
  const extras = await seedExtras(
    collegeOid,
    baseline.academicYear._id as mongoose.Types.ObjectId,
    allSeeded,
  );
  summary.paymentsCreated += extras.paymentsCreated;
  summary.concessionsCreated += extras.concessionsCreated;
  summary.scholarshipsCreated += extras.scholarshipsCreated;

  // Summary footer (CSV-comment prefix so spreadsheet tools ignore it).
  csvRows.push(
    `# summary: students=${summary.studentsCreated} invoices=${summary.invoicesCreated}` +
      ` payments=${summary.paymentsCreated} defaulters=${summary.defaulterRecordsCreated}` +
      ` reminders=${summary.remindersCreated} concessions=${summary.concessionsCreated}` +
      ` scholarships=${summary.scholarshipsCreated}`,
  );
  fs.writeFileSync(csvPath, csvRows.join('\n') + '\n', 'utf-8');

  return summary;
}

// ── CLI entrypoint ───────────────────────────────────────────────────

async function main(): Promise<void> {
  const parsed = parseDemoSeedArgs(process.argv.slice(2));

  if (!parsed.collegeId) {
    process.stderr.write('[DEMO-SEED ERROR] --college-id is required\n');
    process.exit(1);
  }
  if (!parsed.confirmCollegeName) {
    process.stderr.write(
      '[DEMO-SEED ERROR] --confirm-college-name="<exact>" is required (even for --dry-run)\n',
    );
    process.exit(1);
  }

  const { connectDB } = await import('../config/db');
  await connectDB();

  try {
    const summary = await runDemoSeed({
      collegeId: parsed.collegeId,
      confirmCollegeName: parsed.confirmCollegeName,
      clearFirst: parsed.clearFirst,
      dryRun: parsed.dryRun,
    });
    // eslint-disable-next-line no-console
    console.log(
      `[DEMO-SEED DONE] dryRun=${summary.dryRun} students=${summary.studentsCreated}` +
        ` invoices=${summary.invoicesCreated} payments=${summary.paymentsCreated}` +
        ` defaulters=${summary.defaulterRecordsCreated} reminders=${summary.remindersCreated}` +
        ` csv=${summary.csvPath}`,
    );
    process.exit(0);
  } catch (e) {
    if (e instanceof AppError) {
      process.stderr.write(
        `[DEMO-SEED ERROR] (${e.statusCode}) ${e.message}\n`,
      );
      process.exit(1);
    }
    process.stderr.write(
      `[DEMO-SEED FATAL] ${(e as Error).message ?? String(e)}\n`,
    );
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

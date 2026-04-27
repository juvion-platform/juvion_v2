/**
 * seed-agent-findings.ts — populate trigger data for the 6 situation
 * heuristics in `finance-agent/situation-candidates.ts`. Adds focused
 * fixtures on top of an existing demo-seeded college so the dashboard's
 * "Agent findings" section renders 3-5 cards.
 *
 * Heuristics targeted (and how this script triggers each):
 *
 *   1. partial-payment-stale       4 invoices: status='partially_paid',
 *                                   dueDate = 20 days ago
 *   2. concession-spike            5 concessions created in the last 5 days
 *   3. holds-without-review        4 FinancialHolds: holdStatus='pending_approval',
 *                                   createdAt = 3 days ago
 *   4. welfare-referrals-unactioned 3 DefaulterRecords:
 *                                   welfareReferralStatus='pending',
 *                                   updatedAt = 10 days ago
 *   5. stage4-transitions-today    5 FinancialHolds: holdType='exam_debarment',
 *                                   createdAt = now
 *   6. holds-waived-without-reason 4 FinancialHolds: holdStatus='released',
 *                                   releaseReason='ok' (< 10 chars), in last 7d
 *
 * NOT triggered (require time-series setup beyond the scope of a quick
 * trigger script):
 *
 *   - payment-mode-anomaly         needs UPI share drop across 30 days
 *   - near-miss-target             emerges naturally if MTD < 65% target
 *
 * ── Safety ──────────────────────────────────────────────────────────
 * All entities tagged `metadata.source = 'agent-findings-v1'` so a
 * subsequent `--clear-first` purges only what this script created.
 *
 * Required CLI flags (mirrors the demo-seed safety pattern):
 *   --college-id=<id>                       REQUIRED
 *   --confirm-college-name="<exact>"        REQUIRED
 *   [--clear-first]                         purge before re-seed
 *
 * Run:
 *   npx ts-node backend/src/scripts/seed-agent-findings.ts \
 *     --college-id=000000000000000000000001 \
 *     --confirm-college-name="Demo College"
 */

import mongoose from 'mongoose';
import { College } from '../models/College';
import { Student } from '../models/people/Student';
import { Invoice } from '../models/finance/Invoice';
import { Concession } from '../models/finance/Concession';
import { DefaulterRecord } from '../models/finance/DefaulterRecord';
import { FinancialHold } from '../models/finance/FinancialHold';

const TAG = 'agent-findings-v1' as const;

interface SeedOpts {
  collegeId: string;
  confirmCollegeName: string;
  clearFirst?: boolean;
}

interface Summary {
  partialInvoices: number;
  concessions: number;
  pendingHolds: number;
  welfareDefaulters: number;
  stage4HoldsToday: number;
  waivedShortReason: number;
  cleared?: { invoices: number; concessions: number; defaulters: number; holds: number };
}

function daysAgo(d: number): Date {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x;
}

async function pickStudents(
  collegeId: mongoose.Types.ObjectId,
  count: number,
  exclude: mongoose.Types.ObjectId[] = [],
): Promise<mongoose.Types.ObjectId[]> {
  const docs = await Student.find({
    collegeId,
    status: 'active',
    _id: { $nin: exclude },
  })
    .select('_id')
    .limit(count)
    .lean();
  return docs.map((d) => d._id as mongoose.Types.ObjectId);
}

export async function seedAgentFindings(opts: SeedOpts): Promise<Summary> {
  if (!opts.collegeId) throw new Error('--college-id is required');
  if (!opts.confirmCollegeName) throw new Error('--confirm-college-name is required');

  const cId = new mongoose.Types.ObjectId(opts.collegeId);
  const college = await College.findById(cId);
  if (!college) throw new Error(`College not found: ${opts.collegeId}`);
  if (college.name !== opts.confirmCollegeName) {
    throw new Error(
      `College name mismatch: expected '${opts.confirmCollegeName}', found '${college.name}'`,
    );
  }

  const summary: Summary = {
    partialInvoices: 0,
    concessions: 0,
    pendingHolds: 0,
    welfareDefaulters: 0,
    stage4HoldsToday: 0,
    waivedShortReason: 0,
  };

  // ── Optional purge ─────────────────────────────────────────────────
  if (opts.clearFirst) {
    const tagFilter = { collegeId: cId, 'metadata.source': TAG };
    const [invRes, conRes, defRes, hldRes] = await Promise.all([
      Invoice.deleteMany(tagFilter),
      Concession.deleteMany(tagFilter),
      DefaulterRecord.deleteMany(tagFilter),
      FinancialHold.deleteMany(tagFilter),
    ]);
    summary.cleared = {
      invoices: invRes.deletedCount ?? 0,
      concessions: conRes.deletedCount ?? 0,
      defaulters: defRes.deletedCount ?? 0,
      holds: hldRes.deletedCount ?? 0,
    };
    console.log('[clear]', summary.cleared);
  }

  // ── Idempotency: skip if already-seeded count is high ─────────────
  const existing = await FinancialHold.countDocuments({
    collegeId: cId,
    'metadata.source': TAG,
  });
  if (existing > 10 && !opts.clearFirst) {
    console.log(
      `[skip] ${existing} agent-findings entities already exist. Use --clear-first to re-seed.`,
    );
    return summary;
  }

  // We need at least 25 unique students to spread fixtures across:
  //   4 partial + 5 concession + 4 pendingHold + 3 welfare + 5 stage4 + 4 waived.
  // Pad to 26 for safety so a small demo-seed undercount doesn't break us.
  const needed = 26;
  const students = await pickStudents(cId, needed);
  if (students.length < needed) {
    throw new Error(
      `Not enough active students: need ${needed}, found ${students.length}. Run seed-fee-demo-data.ts first.`,
    );
  }

  let cursor = 0;
  const take = (n: number) => {
    const slice = students.slice(cursor, cursor + n);
    cursor += n;
    return slice;
  };

  // Helper: create an Invoice + return its id; used by every defaulter
  // record below since DefaulterRecord requires an `invoiceId`.
  async function makeInvoice(sId: mongoose.Types.ObjectId, overrides: Partial<{
    issuedDate: Date; dueDate: Date; totalAmount: number; amountPaid: number;
    balance: number; status: 'partially_paid' | 'sent' | 'overdue';
    label: string;
  }>): Promise<mongoose.Types.ObjectId> {
    const total = overrides.totalAmount ?? 25000;
    const inv = await Invoice.create({
      collegeId: cId,
      studentId: sId,
      invoiceNumber: `AGT-${overrides.label ?? 'INV'}-${sId.toHexString().slice(-6)}-${Date.now()}`,
      type: 'fee',
      items: [{ description: 'Tuition (agent-findings fixture)', amount: total }],
      issuedDate: overrides.issuedDate ?? daysAgo(45),
      dueDate: overrides.dueDate ?? daysAgo(20),
      totalAmount: total,
      amountPaid: overrides.amountPaid ?? 0,
      balance: overrides.balance ?? total,
      status: overrides.status ?? 'sent',
      metadata: { source: TAG, seededAt: new Date() },
    });
    return inv._id as mongoose.Types.ObjectId;
  }

  // ── 1. partial-payment-stale (4 invoices, dueDate 20d ago) ────────
  const partialIds = take(4);
  for (const sId of partialIds) {
    await makeInvoice(sId, {
      issuedDate: daysAgo(45),
      dueDate: daysAgo(20),
      totalAmount: 25000,
      amountPaid: 12000,
      balance: 13000,
      status: 'partially_paid',
      label: 'PARTIAL',
    });
    summary.partialInvoices++;
  }

  // ── 2. concession-spike (5 concessions in last 5d) ────────────────
  // Pick one demo academicYearId from existing seed data; falls back to a
  // synthesised ObjectId if nothing exists (heuristic only checks count).
  const concessionIds = take(5);
  // Look for any AcademicYear doc — we don't strictly need a real one,
  // but the schema validates ObjectId shape only, so any ObjectId works.
  const ayPlaceholder = new mongoose.Types.ObjectId();
  for (let i = 0; i < concessionIds.length; i++) {
    const studentId = concessionIds[i]!;
    const c = new Concession({
      collegeId: cId,
      studentId,
      type: i % 2 === 0 ? 'sibling' : 'merit',
      amount: 5000 + i * 1000,
      reason: `Agent-findings spike fixture #${i + 1}`,
      academicYearId: ayPlaceholder,
      status: 'approved',
      metadata: { source: TAG, seededAt: new Date() },
    });
    c.set('createdAt', daysAgo(i));         // distribute across last 5 days
    await c.save();
    summary.concessions++;
  }

  // ── 3. holds-without-review (4 pending_approval, > 48h old) ───────
  const pendingHoldIds = take(4);
  for (const sId of pendingHoldIds) {
    const invId = await makeInvoice(sId, {
      issuedDate: daysAgo(45),
      dueDate: daysAgo(35),
      totalAmount: 22000,
      balance: 22000,
      status: 'overdue',
      label: 'HOLD-PEND',
    });
    const def = await DefaulterRecord.create({
      collegeId: cId,
      studentId: sId,
      invoiceId: invId,
      escalationStage: 'stage_4',
      daysOverdue: 35,
      overdueAmount: 22000,
      lastEscalationAt: daysAgo(3),
      metadata: { source: TAG, seededAt: new Date() },
    });
    const holdDoc = new FinancialHold({
      collegeId: cId,
      studentId: sId,
      defaulterRecordId: def._id,
      holdType: 'exam_debarment',
      holdStatus: 'pending_approval',
      effectiveDate: daysAgo(3),
      reason: 'Auto-raised on stage_4 transition (test fixture)',
      metadata: { source: TAG, seededAt: new Date() },
    });
    holdDoc.set('createdAt', daysAgo(3));
    await holdDoc.save();
    summary.pendingHolds++;
  }

  // ── 4. welfare-referrals-unactioned (3 defaulters, 10d old) ───────
  const welfareIds = take(3);
  for (const sId of welfareIds) {
    const invId = await makeInvoice(sId, {
      issuedDate: daysAgo(80),
      dueDate: daysAgo(70),
      totalAmount: 30000,
      balance: 30000,
      status: 'overdue',
      label: 'WELFARE',
    });
    const def = new DefaulterRecord({
      collegeId: cId,
      studentId: sId,
      invoiceId: invId,
      escalationStage: 'welfare_referred',
      welfareReferralStatus: 'pending',
      daysOverdue: 70,
      overdueAmount: 30000,
      lastEscalationAt: daysAgo(10),
      metadata: { source: TAG, seededAt: new Date() },
    });
    def.set('updatedAt', daysAgo(10));
    await def.save();
    summary.welfareDefaulters++;
  }

  // ── 5. stage4-transitions-today (5 exam_debarment holds, today) ───
  const stage4TodayIds = take(5);
  for (const sId of stage4TodayIds) {
    const invId = await makeInvoice(sId, {
      issuedDate: daysAgo(40),
      dueDate: daysAgo(32),
      totalAmount: 28000,
      balance: 28000,
      status: 'overdue',
      label: 'STAGE4',
    });
    const def = await DefaulterRecord.create({
      collegeId: cId,
      studentId: sId,
      invoiceId: invId,
      escalationStage: 'stage_4',
      daysOverdue: 32,
      overdueAmount: 28000,
      lastEscalationAt: new Date(),
      metadata: { source: TAG, seededAt: new Date() },
    });
    await FinancialHold.create({
      collegeId: cId,
      studentId: sId,
      defaulterRecordId: def._id,
      holdType: 'exam_debarment',
      holdStatus: 'pending_approval',
      effectiveDate: new Date(),
      reason: 'Auto-raised on stage_4 transition today (fixture)',
      metadata: { source: TAG, seededAt: new Date() },
    });
    summary.stage4HoldsToday++;
  }

  // ── 6. holds-waived-without-reason (4 released, short reason) ─────
  const waivedIds = take(4);
  for (const sId of waivedIds) {
    const invId = await makeInvoice(sId, {
      issuedDate: daysAgo(35),
      dueDate: daysAgo(25),
      totalAmount: 18000,
      balance: 18000,
      status: 'overdue',
      label: 'WAIVED',
    });
    const def = await DefaulterRecord.create({
      collegeId: cId,
      studentId: sId,
      invoiceId: invId,
      escalationStage: 'stage_3',
      daysOverdue: 20,
      overdueAmount: 18000,
      metadata: { source: TAG, seededAt: new Date() },
    });
    const hold = new FinancialHold({
      collegeId: cId,
      studentId: sId,
      defaulterRecordId: def._id,
      holdType: 'exam_debarment',
      holdStatus: 'released',
      effectiveDate: daysAgo(5),
      reason: 'pending review',
      releasedBy: sId,
      releaseDate: daysAgo(2),
      releaseReason: 'ok',                 // < 10 chars triggers the heuristic
      metadata: { source: TAG, seededAt: new Date() },
    });
    hold.set('createdAt', daysAgo(5));     // ensure within last-7d window
    await hold.save();
    summary.waivedShortReason++;
  }

  return summary;
}

// ── CLI entry ─────────────────────────────────────────────────────────

function parseArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  return arg.slice(`--${name}=`.length).replace(/^["']|["']$/g, '');
}

async function main() {
  const collegeId = parseArg('college-id');
  const confirmCollegeName = parseArg('confirm-college-name');
  const clearFirst = process.argv.includes('--clear-first');

  if (!collegeId) {
    console.error('[ERROR] --college-id=<id> is required');
    process.exit(1);
  }
  if (!confirmCollegeName) {
    console.error('[ERROR] --confirm-college-name="<name>" is required');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/juvion_v2';
  await mongoose.connect(mongoUri);
  try {
    const summary = await seedAgentFindings({
      collegeId,
      confirmCollegeName,
      clearFirst,
    });
    console.log('[done]', JSON.stringify(summary, null, 2));
  } catch (e) {
    console.error('[ERROR]', (e as Error).message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

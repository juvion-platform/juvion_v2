/**
 * seed-demo-ai.ts — make the AI surfaces worth demoing.
 *
 * Layers a coherent story onto an EXISTING college's students (no new
 * students): mentors, hostel residents, guardians with a language and a
 * channel, a populated Student Risk board (P1/P2/P3, first-generation, untouched
 * alerts, resolved + recurred history, 90-day score history), six months of
 * fee collection so the forecast and charts have a series, a defaulter list
 * whose fee signals are the SAME students the risk board flags, and an
 * admissions funnel for lead scoring.
 *
 * Every risk signal goes through `ingestRiskSignal`, so scores, priorities and
 * multipliers are the real engine's — nothing here invents a number.
 *
 * Safety (same gates as the other seed CLIs):
 *   --college-id=<id>                       REQUIRED
 *   --confirm-college-name="<exact name>"   REQUIRED
 *   --clear-first                           remove what an earlier run wrote
 *
 * Tag: `demo-ai-v1` — `metadata.source` on finance docs, `tags[]` on inquiries,
 * `triggerData.demoSeed` on risk signals, `[demo-ai-v1]` in alert descriptions.
 * `--clear-first` also removes ALL CCD data (signals, compound alerts, score
 * snapshots, interventions) for the college — the engine recomputes from
 * signals, so partial removal would leave stale scores.
 *
 * Also restores the college's real current academic year: the e2e seed marks
 * `E2E-AY` current every time the Playwright suite runs.
 *
 * Run:
 *   npx ts-node -r dotenv/config src/scripts/seed-demo-ai.ts \
 *     --college-id=000000000000000000000001 \
 *     --confirm-college-name="Juvion Institute of Technology" [--clear-first]
 */
import mongoose, { Types } from 'mongoose';

import { College } from '../models/College';
import { AcademicYear } from '../models/academic-structure/AcademicYear';
import { Student } from '../models/people/Student';
import { Person } from '../models/people/Person';
import { Parent } from '../models/people/Parent';
import { Faculty } from '../models/people/Faculty';
import { MentorAssignment } from '../models/welfare/MentorAssignment';
import { HostelAllocation } from '../models/welfare/HostelAllocation';
import { HostelRoom } from '../models/welfare/HostelRoom';
import { RiskSignal } from '../models/welfare/RiskSignal';
import { CrisisAlert } from '../models/welfare/CrisisAlert';
import { RiskScoreSnapshot } from '../models/welfare/RiskScoreSnapshot';
import { CCDIntervention } from '../models/welfare/CCDIntervention';
import { Invoice } from '../models/finance/Invoice';
import { Payment } from '../models/finance/Payment';
import { DefaulterRecord } from '../models/finance/DefaulterRecord';
import { StudentFeeAccount } from '../models/finance/StudentFeeAccount';
import { Inquiry } from '../models/admissions/Inquiry';
import { LeadInteraction } from '../models/admissions/LeadInteraction';
import { ingestRiskSignal, recomputeStudentScore } from '../modules/welfare/ment-couns-ccd-service';

const TAG = 'demo-ai-v1';
const DAY = 86_400_000;
const daysAgo = (n: number, hour = 10) => { const d = new Date(Date.now() - n * DAY); d.setHours(hour, 0, 0, 0); return d; };

// ── args ────────────────────────────────────────────────────────────────────
const args = new Map(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k!, v.join('=')]; }));
const COLLEGE_ID = args.get('college-id');
const CONFIRM = args.get('confirm-college-name');
const CLEAR = args.has('clear-first');
if (!COLLEGE_ID || !CONFIRM) {
  console.error('Usage: --college-id=<id> --confirm-college-name="<exact name>" [--clear-first]');
  process.exit(1);
}

// Deterministic PRNG so re-runs produce the same story.
let seed = 20260912;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

type Sig = { source: 'M03' | 'M04' | 'M08' | 'M06' | 'Juvi'; type: string; daysAgo: number };

/**
 * Risk profiles. Weights (engine): attendance 25 · failing 40 · backlog 25 ·
 * fee_default 25(+25 first-gen) · scholarship 15(+25) · warden 25 · mess 15 ·
 * messaging 10 · sentiment 10 · counselling 10. ×1.5 when ≥3 modules, ×1.5 when
 * ≥2 signals inside the temporal window. Temporal window is 14 days: recent = ≤3 days ago, old = ≥15 days ago.
 */
const PROFILES: Array<{ label: string; firstGen?: boolean; sigs: Sig[]; status: 'generated' | 'acknowledged' | 'intervening'; openDays: number; trend: 'up' | 'down' | 'flat'; noMentor?: boolean }> = [
  // ── P1 (≥75): three modules, clustered ──
  { label: 'P1 first-gen fees+attendance+hostel', firstGen: true, sigs: [{ source: 'M03', type: 'attendance_drop', daysAgo: 2 }, { source: 'M04', type: 'fee_default', daysAgo: 3 }, { source: 'M08', type: 'warden_concern', daysAgo: 1 }], status: 'generated', openDays: 3, trend: 'up' },
  { label: 'P1 backlog+fees+mess', sigs: [{ source: 'M03', type: 'backlog_accumulation', daysAgo: 1 }, { source: 'M04', type: 'fee_default', daysAgo: 2 }, { source: 'M08', type: 'mess_attendance_drop', daysAgo: 2 }], status: 'intervening', openDays: 6, trend: 'flat' },
  { label: 'P1 first-gen scholarship+attendance+warden', firstGen: true, sigs: [{ source: 'M04', type: 'scholarship_loss', daysAgo: 2 }, { source: 'M03', type: 'attendance_drop', daysAgo: 1 }, { source: 'M08', type: 'warden_concern', daysAgo: 3 }], status: 'acknowledged', openDays: 4, trend: 'up' },
  { label: 'P1 failing+fees+isolation, no mentor', sigs: [{ source: 'M03', type: 'failing_grades', daysAgo: 2 }, { source: 'M04', type: 'fee_default', daysAgo: 1 }, { source: 'M06', type: 'counselling_active', daysAgo: 2 }], status: 'generated', openDays: 2, trend: 'up', noMentor: true },
  // ── P2 (50-74) ──
  { label: 'P2 failing+fees, untouched 18d', sigs: [{ source: 'M03', type: 'failing_grades', daysAgo: 18 }, { source: 'M04', type: 'fee_default', daysAgo: 20 }], status: 'generated', openDays: 18, trend: 'flat' },
  { label: 'P2 attendance+warden, untouched 21d', sigs: [{ source: 'M03', type: 'attendance_drop', daysAgo: 21 }, { source: 'M08', type: 'warden_concern', daysAgo: 16 }], status: 'generated', openDays: 21, trend: 'down' },
  { label: 'P2 failing+mess', sigs: [{ source: 'M03', type: 'failing_grades', daysAgo: 16 }, { source: 'M08', type: 'mess_attendance_drop', daysAgo: 17 }], status: 'acknowledged', openDays: 13, trend: 'up' },
  { label: 'P2 first-gen attendance+messaging+counselling', firstGen: true, sigs: [{ source: 'M03', type: 'attendance_drop', daysAgo: 16 }, { source: 'Juvi', type: 'messaging_withdrawal', daysAgo: 15 }, { source: 'M06', type: 'counselling_active', daysAgo: 20 }], status: 'generated', openDays: 20, trend: 'up' },
  { label: 'P2 attendance+messaging clustered', sigs: [{ source: 'M03', type: 'attendance_drop', daysAgo: 2 }, { source: 'Juvi', type: 'messaging_withdrawal', daysAgo: 1 }], status: 'intervening', openDays: 9, trend: 'down' },
  // ── P3 (35-49) ──
  { label: 'P3 attendance+messaging', sigs: [{ source: 'M03', type: 'attendance_drop', daysAgo: 16 }, { source: 'Juvi', type: 'messaging_withdrawal', daysAgo: 22 }], status: 'generated', openDays: 22, trend: 'flat' },
  { label: 'P3 backlog+mess', sigs: [{ source: 'M03', type: 'backlog_accumulation', daysAgo: 16 }, { source: 'M08', type: 'mess_attendance_drop', daysAgo: 24 }], status: 'generated', openDays: 24, trend: 'down' },
  { label: 'P3 failing only', sigs: [{ source: 'M03', type: 'failing_grades', daysAgo: 16 }], status: 'acknowledged', openDays: 16, trend: 'flat' },
  { label: 'P3 scholarship+attendance', sigs: [{ source: 'M04', type: 'scholarship_loss', daysAgo: 19 }, { source: 'M03', type: 'attendance_drop', daysAgo: 16 }], status: 'generated', openDays: 19, trend: 'up' },
  { label: 'P3 first-gen failing only', firstGen: true, sigs: [{ source: 'M03', type: 'failing_grades', daysAgo: 16 }], status: 'generated', openDays: 16, trend: 'up' },
  { label: 'P3 fees+mess', sigs: [{ source: 'M04', type: 'fee_default', daysAgo: 15 }, { source: 'M08', type: 'mess_attendance_drop', daysAgo: 23 }], status: 'generated', openDays: 23, trend: 'down' },
];

const LANGS = ['te', 'en', 'hi', 'te', 'en', 'te'];
const CHANNELS = ['whatsapp', 'sms', 'call', 'whatsapp', 'email'] as const;
const MODES = ['upi', 'upi', 'upi', 'upi', 'neft', 'neft', 'online', 'online', 'cash', 'card', 'cheque'];
const AMOUNTS = [12500, 25000, 25000, 37500, 50000, 50000, 75000];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/juvion_v2');
  const college = await College.findById(COLLEGE_ID).lean();
  if (!college || college.name !== CONFIRM) {
    console.error(`College ${COLLEGE_ID} not found or name mismatch (got "${college?.name}")`);
    process.exit(1);
  }
  const cid = String(college._id);
  const oid = new Types.ObjectId(cid);
  const log = (m: string) => console.log(`[seed-demo-ai] ${m}`);

  // ── 0. Current academic year: the one the fee pins point at ──────────────
  const pinYears = await Student.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { collegeId: oid } }, { $unwind: '$feePins' },
    { $group: { _id: '$feePins.academicYearId', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 },
  ]);
  const demoYear = pinYears[0]?._id
    ? await AcademicYear.findOne({ _id: pinYears[0]._id, collegeId: cid })
    : await AcademicYear.findOne({ collegeId: cid, code: { $ne: 'E2E-AY' } }).sort({ startDate: -1 });
  if (!demoYear) throw new Error('no academic year');
  await AcademicYear.updateMany({ collegeId: cid, _id: { $ne: demoYear._id } }, { $set: { isCurrent: false } });
  await AcademicYear.updateOne({ _id: demoYear._id }, { $set: { isCurrent: true } });
  log(`current academic year → ${demoYear.code} (${demoYear.label})`);
  const ay = demoYear._id;

  // ── 1. Clear ─────────────────────────────────────────────────────────────
  if (CLEAR) {
    const r = await Promise.all([
      RiskSignal.deleteMany({ collegeId: cid }),
      CrisisAlert.deleteMany({ collegeId: cid, type: 'compound_risk' }),
      RiskScoreSnapshot.deleteMany({ collegeId: cid }),
      CCDIntervention.deleteMany({ collegeId: cid }),
      Payment.deleteMany({ collegeId: cid, 'metadata.source': TAG }),
      Invoice.deleteMany({ collegeId: cid, 'metadata.source': TAG }),
      DefaulterRecord.deleteMany({ collegeId: cid, 'metadata.source': TAG }),
      StudentFeeAccount.deleteMany({ collegeId: cid, 'metadata.source': TAG }),
    ]);
    const inq = await Inquiry.find({ collegeId: cid, tags: TAG }).select({ _id: 1 }).lean();
    await LeadInteraction.deleteMany({ collegeId: cid, inquiryId: { $in: inq.map((i) => i._id) } });
    await Inquiry.deleteMany({ collegeId: cid, tags: TAG });
    log(`cleared: ${r.map((x) => x.deletedCount).join('/')} (signals/alerts/snapshots/interventions/payments/invoices/defaulters/accounts) + ${inq.length} inquiries`);
  }

  // ── 2. Load people ───────────────────────────────────────────────────────
  const students = await Student.find({ collegeId: cid, status: { $nin: ['exited', 'graduated', 'withdrawn'] } })
    .select({ personId: 1, rollNumber: 1, branchId: 1, quota: 1, studyYearAtAdmission: 1 }).lean();
  const faculty = await Faculty.find({ collegeId: cid }).select({ personId: 1 }).lean();
  const rooms = await HostelRoom.find({ collegeId: cid }).select({ _id: 1 }).lean();
  const actor = faculty[0]?.personId ?? students[0]!.personId;
  // The demo pool: real-looking roll numbers (JNTU style), no pre-existing
  // non-risk alert. Fixture students (TEST…, PIN…, FEEPIN…) stay in the
  // college but off the AI surfaces.
  const busy = new Set((await CrisisAlert.find({ collegeId: cid, type: { $ne: 'compound_risk' } }).select({ studentId: 1 }).lean()).map((a) => String(a.studentId)));
  const pool = students.filter((s) => /^\d{2}B01A\d{4}$/.test(s.rollNumber ?? '') && !busy.has(String(s._id)));
  log(`${students.length} students (${pool.length} in the demo pool), ${faculty.length} faculty, ${rooms.length} hostel rooms`);
  if (pool.length < 20 || faculty.length === 0) throw new Error('need ≥20 pool students and ≥1 faculty');
  // Year of study for unpinned older batches, so branch × year questions have an answer.
  const bumped = await Student.updateMany(
    { collegeId: cid, _id: { $in: pool.filter((s) => /^2[12]B01A/.test(s.rollNumber!)).map((s) => s._id) }, $or: [{ feePins: { $size: 0 } }, { feePins: { $exists: false } }] },
    [{ $set: { studyYearAtAdmission: { $cond: [{ $regexMatch: { input: '$rollNumber', regex: /^21B01A/ } }, 3, 2] } } }],
  );
  log(`year of study set on ${bumped.modifiedCount} unpinned 2021/2022 students`);

  // ── 3. Guardians: language + channel, one fee-responsible primary ───────
  let guardians = 0;
  for (const [i, s] of students.entries()) {
    const parents = await Parent.find({ collegeId: cid, linkedStudents: s._id });
    if (parents.length === 0) continue;
    const primary = parents.find((p) => p.isFeeResponsible) ?? parents.find((p) => p.primaryContact) ?? parents[0]!;
    for (const [j, p] of parents.entries()) {
      if (!p.communicationPreference) p.communicationPreference = CHANNELS[(i + j) % CHANNELS.length];
      if (p._id.equals(primary._id)) { p.isFeeResponsible = true; p.primaryContact = true; }
      await p.save();
      await Person.updateOne({ _id: p.personId, preferredLanguage: { $in: [null, ''] } }, { $set: { preferredLanguage: LANGS[(i + j) % LANGS.length] } });
      guardians += 1;
    }
  }
  log(`guardians touched: ${guardians}`);

  // ── 4. Mentors: everyone gets one except the profile that says no ────────
  const flagged = pool.slice(0, PROFILES.length);
  const noMentor = new Set(flagged.filter((_, i) => PROFILES[i]!.noMentor).map((s) => String(s._id)));
  await MentorAssignment.deleteMany({ collegeId: cid, studentId: { $in: [...noMentor].map((x) => new Types.ObjectId(x)) }, status: 'active' });
  let assigned = 0;
  for (const [i, s] of students.entries()) {
    if (noMentor.has(String(s._id))) continue;
    const has = await MentorAssignment.exists({ collegeId: cid, studentId: s._id, status: 'active' });
    if (has) continue;
    // Skewed on purpose: the first mentor carries the heaviest load so
    // "which mentor has the most P1 students?" has a real answer.
    const mentor = faculty[i < 12 ? 0 : i % faculty.length]!;
    await MentorAssignment.create({ collegeId: cid, mentorId: mentor._id, studentId: s._id, academicYearId: ay, assignedBy: actor, status: 'active', assignedDate: daysAgo(60) });
    assigned += 1;
  }
  log(`mentor assignments created: ${assigned}`);

  // ── 5. Hostel residents: ~a third, including several flagged ────────────
  let housed = 0;
  if (rooms.length > 0) {
    for (const [i, s] of students.entries()) {
      if (i % 3 !== 0) continue;
      const has = await HostelAllocation.exists({ collegeId: cid, studentId: s._id, status: 'active' });
      if (has) continue;
      await HostelAllocation.create({ collegeId: cid, studentId: s._id, roomId: rooms[i % rooms.length]!._id, academicYearId: ay, status: 'active', allocatedDate: daysAgo(90) });
      housed += 1;
    }
  }
  log(`hostel allocations created: ${housed}`);

  // ── 6. Risk board ────────────────────────────────────────────────────────
  const openByStudent = new Map<string, { score: number; priority: string | null }>();
  for (const [i, s] of flagged.entries()) {
    const p = PROFILES[i]!;
    const sid = String(s._id);
    for (const sig of p.sigs) {
      const doc = await ingestRiskSignal(cid, { studentId: sid, source: sig.source, signalType: sig.type, triggerData: { isFirstGen: !!p.firstGen, demoSeed: TAG, label: p.label } }, 'system');
      const at = daysAgo(sig.daysAgo, 9 + (i % 6));
      await RiskSignal.updateOne({ _id: doc._id }, { $set: { receivedAt: at, expiresAt: new Date(at.getTime() + 30 * DAY) } });
    }
    // Scores come from the engine, against the backdated signals.
    const result = await recomputeStudentScore(cid, sid);
    const alert = await CrisisAlert.findOne({ collegeId: cid, studentId: s._id, type: 'compound_risk', status: { $nin: ['resolved', 'false_positive'] } });
    if (!alert) { log(`  ${s.rollNumber} ${p.label}: score ${JSON.stringify(result)} — no alert (below P3)`); continue; }
    const opened = daysAgo(p.openDays, 8);
    const set: Record<string, unknown> = { createdAt: opened, description: `[${TAG}] ${p.label}`, status: p.status };
    if (p.status === 'acknowledged' || p.status === 'intervening') {
      set['acknowledgment'] = { acknowledgedBy: actor, acknowledgedAt: daysAgo(Math.max(1, p.openDays - 1)), initialAssessment: 'Mentor reviewed the signals and is following up.' };
    }
    if (p.status === 'intervening') {
      const when = daysAgo(Math.max(0, p.openDays - 3));
      set['intervention'] = { type: 'parent_contact', description: '[whatsapp] Spoke with the guardian; agreed on a fee plan and weekly attendance check-in.', executedBy: actor, executedAt: when, outcome: 'pending' };
      await CCDIntervention.create({ collegeId: cid, alertId: alert._id, studentId: s._id, type: 'parent_contact', description: 'Guardian contacted; fee plan agreed; weekly attendance check-in.', executedBy: actor, executedAt: when, followUpStatus: 'pending' });
    }
    // Raw write: Mongoose treats createdAt as immutable and strips it from updates.
    await CrisisAlert.collection.updateOne({ _id: alert._id }, { $set: set });
    openByStudent.set(sid, { score: alert.compoundScore, priority: alert.priority ?? null });

    // 90-day history ending at the live score; the day-10 point drives delta7d.
    const final = alert.compoundScore;
    const shape = p.trend === 'up' ? [-40, -34, -30, -26, -22, -18, -12] : p.trend === 'down' ? [10, 14, 12, 8, 6, 9, 7] : [-3, 2, -1, 3, 0, 2, -1];
    const at = [80, 60, 45, 30, 20, 14, 10];
    for (let k = 0; k < at.length; k++) {
      const score = Math.max(0, Math.min(100, final + shape[k]!));
      await RiskScoreSnapshot.create({ collegeId: cid, studentId: s._id, score, priority: score >= 75 ? 'P1' : score >= 50 ? 'P2' : score >= 35 ? 'P3' : null, breakdown: { baseTotal: score, crossModuleMultiplier: 1, temporalMultiplier: 1, finalScore: score }, capturedAt: daysAgo(at[k]!, 6) });
    }
    log(`  ${(s.rollNumber ?? '—').padEnd(12)} ${alert.priority} ${String(alert.compoundScore).padStart(3)}  ${p.label}`);
  }

  // Resolved history in the last 90 days — 2 of them for students who are
  // flagged again now (that is the "recurred" number on the board).
  const history = [...flagged.slice(0, 2), ...pool.slice(PROFILES.length, PROFILES.length + 5)];
  for (const [i, s] of history.entries()) {
    const created = daysAgo(45 + i * 7, 8);
    const resolved = new Date(created.getTime() + (10 + i) * DAY);
    const score = 55 + i * 6;
    const hist = await CrisisAlert.create({
      collegeId: cid, reportedBy: actor, studentId: s._id, type: 'compound_risk', severity: score >= 75 ? 'critical' : 'high',
      description: `[${TAG}] resolved after outreach`, status: 'resolved', priority: score >= 75 ? 'P1' : 'P2', compoundScore: score,
      scoreBreakdown: { baseTotal: score, crossModuleMultiplier: 1, temporalMultiplier: 1, finalScore: score },
      signals: [{ source: 'M03', signalType: 'attendance_drop', weight: 25, receivedAt: created }, { source: 'M04', signalType: 'fee_default', weight: 25, receivedAt: created }],
      acknowledgment: { acknowledgedBy: actor, acknowledgedAt: new Date(created.getTime() + DAY), initialAssessment: 'Reviewed.' },
      intervention: { type: 'mentor_outreach', description: 'Mentor met the student and guardian; attendance recovered.', executedBy: actor, executedAt: new Date(created.getTime() + 3 * DAY), outcome: 'resolved' },
      resolution: 'Attendance back above 75%; fee instalment paid.', resolvedAt: resolved, falsePositive: false, suppressDoubleAlert: false,
    });
    await CrisisAlert.collection.updateOne({ _id: hist._id }, { $set: { createdAt: created } });
  }
  log(`resolved history alerts: ${history.length} (2 recurred)`);

  // ── 7. Finance: six months of collection + a defaulter list ─────────────
  const feeAccount = async (studentId: Types.ObjectId, due: number, paid: number) =>
    StudentFeeAccount.findOneAndUpdate({ collegeId: cid, studentId }, { $inc: { totalDue: due, totalPaid: paid, balance: due - paid }, $setOnInsert: { metadata: { source: TAG } } }, { upsert: true });
  let payments = 0, collected = 0;
  let seq = 0;
  for (let d = 180; d >= 0; d--) {
    const day = daysAgo(d, 11);
    if (day.getDay() === 0) continue;
    // Seasonality: heavier in the two weeks after a semester bill (Jul/Aug, Jan/Feb), lighter otherwise.
    const m = day.getMonth();
    const n = (m === 6 || m === 7 || m === 0 || m === 1) ? int(3, 6) : int(1, 3);
    for (let k = 0; k < n; k++) {
      const s = pick(pool);
      const amount = pick(AMOUNTS);
      seq += 1;
      const inv = await Invoice.create({
        collegeId: cid, invoiceNumber: `INV-D-${day.toISOString().slice(0, 10).replace(/-/g, '')}-${String(seq).padStart(4, '0')}`, studentId: s._id, type: 'fee',
        items: [{ description: 'Semester fee instalment', amount }], totalAmount: amount, netPayable: amount,
        dueDate: new Date(day.getTime() - int(0, 6) * DAY), issuedDate: new Date(day.getTime() - 25 * DAY), status: 'paid', metadata: { source: TAG },
      });
      const paidAt = new Date(day.getTime() + int(0, 7) * 3_600_000);
      const pay = await Payment.create({
        collegeId: cid, studentId: s._id, receiptNumber: `RCP-D-${String(seq).padStart(5, '0')}`, amount, paymentMode: pick(MODES),
        transactionRef: `TXN-${seq}`, paymentDate: paidAt, allocations: [], status: 'success',
        remarks: `Invoice ${inv.invoiceNumber}`, metadata: { source: TAG },
      });
      // The collection analytics bucket on createdAt, not paymentDate — backdate both.
      await Payment.collection.updateOne({ _id: pay._id }, { $set: { createdAt: paidAt, updatedAt: paidAt } });
      await Invoice.collection.updateOne({ _id: inv._id }, { $set: { createdAt: inv.issuedDate, updatedAt: paidAt } });
      await feeAccount(s._id, amount, amount);
      payments += 1; collected += amount;
    }
  }
  log(`payments: ${payments} over 180 days, ₹${collected.toLocaleString('en-IN')}`);

  // Defaulters = the students whose fee signal is on the board, plus a few more.
  const feeFlagged = flagged.filter((_, i) => PROFILES[i]!.sigs.some((x) => x.source === 'M04'));
  const extra = pool.slice(PROFILES.length + 5, PROFILES.length + 8);
  let defaulters = 0;
  for (const [i, s] of [...feeFlagged, ...extra].entries()) {
    if (await DefaulterRecord.exists({ collegeId: cid, studentId: s._id, escalationStage: { $nin: ['resolved', 'exited_hardship', 'exited_write_off'] } })) continue;
    const daysOverdue = [5, 12, 22, 35, 48, 64, 70, 9, 27, 41, 58, 15][i % 12]!;
    const amount = pick([37500, 50000, 75000]);
    const stage = daysOverdue <= 7 ? 'stage_1' : daysOverdue <= 30 ? 'stage_2' : daysOverdue <= 60 ? 'stage_3' : 'stage_4';
    seq += 1;
    const inv = await Invoice.create({
      collegeId: cid, invoiceNumber: `INV-D-OD-${String(seq).padStart(4, '0')}`, studentId: s._id, type: 'fee',
      items: [{ description: 'Semester fee instalment', amount }], totalAmount: amount, netPayable: amount,
      dueDate: daysAgo(daysOverdue), issuedDate: daysAgo(daysOverdue + 25), status: 'overdue', metadata: { source: TAG },
    });
    await Invoice.collection.updateOne({ _id: inv._id }, { $set: { createdAt: inv.issuedDate } });
    await DefaulterRecord.create({
      collegeId: cid, studentId: s._id, invoiceId: inv._id, overdueAmount: amount, daysOverdue, escalationStage: stage,
      welfareReferralStatus: daysOverdue > 60 ? 'pending' : 'none', lastEscalationAt: daysAgo(1),
      autoEscalationPaused: i === 3 ? daysAgo(-10) : null, metadata: { source: TAG },
    });
    await feeAccount(s._id, amount, 0);
    defaulters += 1;
  }
  log(`defaulters: ${defaulters}`);

  // ── 8. Admissions funnel for lead scoring ────────────────────────────────
  const FIRST = ['Aarav', 'Diya', 'Vihaan', 'Ananya', 'Reyansh', 'Saanvi', 'Arjun', 'Ishita', 'Kabir', 'Meera', 'Rohan', 'Nithya', 'Karthik', 'Pooja', 'Sai', 'Lakshmi', 'Varun', 'Sneha', 'Tejas', 'Harini', 'Manoj', 'Bhavana', 'Rahul', 'Keerthi', 'Yash'];
  const LAST = ['Reddy', 'Rao', 'Kumar', 'Sharma', 'Naidu', 'Iyer', 'Varma', 'Goud', 'Chowdary', 'Patel'];
  const SOURCES = ['website', 'walk-in', 'referral', 'whatsapp', 'social_media', 'education_fair', 'phone'] as const;
  const STATUS = ['new', 'contacted', 'interested', 'follow_up', 'follow_up_overdue', 'callback_requested', 'no_response', 'converted'] as const;
  let inquiries = 0;
  if ((await Inquiry.countDocuments({ collegeId: cid, tags: TAG })) === 0) {
    for (let i = 0; i < 25; i++) {
      const status = STATUS[i % STATUS.length]!;
      const grade = status === 'converted' || status === 'interested' ? 'hot' : status === 'follow_up' || status === 'callback_requested' ? 'warm' : status === 'no_response' ? 'cold' : 'warm';
      const created = daysAgo(int(1, 60));
      const inq = await Inquiry.create({
        collegeId: cid, academicYearId: ay, name: `${FIRST[i]} ${pick(LAST)}`, phone: `98${String(76000000 + i * 137).slice(0, 8)}`,
        email: `${FIRST[i]!.toLowerCase()}${i}@example.com`, gender: i % 2 ? 'female' : 'male', interStream: pick(['MPC', 'MPC', 'BiPC', 'MEC']),
        source: pick(SOURCES), status, leadGrade: grade, tags: [TAG], date: created, interactionCount: 0,
      });
      const n = status === 'new' ? 0 : int(1, 3);
      for (let k = 0; k < n; k++) {
        await LeadInteraction.create({
          collegeId: cid, inquiryId: inq._id, type: pick(['phone_call', 'whatsapp', 'campus_visit']), direction: 'outbound', channel: 'manual',
          summary: pick(['Discussed CSE seat availability and fee structure.', 'Parent asked about hostel and transport.', 'Shared scholarship eligibility; will revert.', 'Campus visit scheduled for Saturday.', 'No answer; will retry tomorrow.']),
          outcome: status === 'converted' ? 'converted' : status === 'no_response' ? 'no_response' : pick(['interested', 'callback_requested', 'visit_scheduled']),
          performedBy: 'Admissions Desk', createdAt: new Date(created.getTime() + (k + 1) * 2 * DAY),
        });
      }
      await Inquiry.updateOne({ _id: inq._id }, { $set: { interactionCount: n, lastInteractionAt: n ? new Date(created.getTime() + n * 2 * DAY) : undefined } });
      inquiries += 1;
    }
  }
  log(`inquiries: ${inquiries}`);

  // The engine wrote one snapshot per ingest/recompute today; keep only the
  // last per student so the 90-day chart ends on the live score, not a spike.
  const todays = await RiskScoreSnapshot.find({ collegeId: cid, capturedAt: { $gte: daysAgo(0, 0) } }).sort({ capturedAt: -1 }).select({ studentId: 1 }).lean();
  const keep = new Set<string>();
  const drop: Types.ObjectId[] = [];
  for (const snap of todays) {
    const k = String(snap.studentId);
    if (keep.has(k)) drop.push(snap._id); else keep.add(k);
  }
  if (drop.length) await RiskScoreSnapshot.deleteMany({ _id: { $in: drop } });
  log(`intermediate same-day snapshots removed: ${drop.length}`);

  const open = await CrisisAlert.countDocuments({ collegeId: cid, type: 'compound_risk', status: { $in: ['generated', 'acknowledged', 'investigating', 'intervening'] } });
  log(`done — open alerts on the board: ${open}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

import { CrisisAlert } from '../../models/welfare/CrisisAlert';
import { RiskSignal } from '../../models/welfare/RiskSignal';
import { MentorAssignment } from '../../models/welfare/MentorAssignment';
import { CounselingSession } from '../../models/welfare/CounselingSession';
import { HostelViolation } from '../../models/campus/HostelViolation';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { FeeReminder } from '../../models/finance/FeeReminder';
import { Payment } from '../../models/finance/Payment';
import { Inquiry } from '../../models/admissions/Inquiry';
import { User } from '../../models/User';
import { scoreInquiry } from '../../modules/admissions/lead-scoring/service';
import { DemoCtx, DAY, TAG, daysAgo } from './context';

const AI_TAG = 'demo-ai-v1';

/**
 * Who mentors a flagged student, by risk profile (the label seed-demo-ai
 * writes into the alert). Mentors stay inside the student's department:
 * the CSE HOD carries the most P1s, and the faculty login (Dr. Lakshmi
 * Prasad) mentors three flagged CSE students so her "my students" has them.
 */
const HOD_CSE = ['P1 first-gen fees+attendance+hostel', 'P1 backlog+fees+mess'];
const LAKSHMI = ['P2 attendance+warden, untouched 21d', 'P2 attendance+messaging clustered', 'P3 failing only'];
const NO_MENTOR = 'P1 failing+fees+isolation, no mentor';

export async function seedStoryExtras(ctx: DemoCtx): Promise<void> {
  const cid = ctx.collegeId;
  const ours = new Map(ctx.students.map((s) => [String(s._id), s]));

  // ── Mentors: one per student from their own department ─────────────────
  const alerts = await CrisisAlert.find({ collegeId: cid, type: 'compound_risk', status: { $nin: ['resolved', 'false_positive'] } })
    .select({ studentId: 1, description: 1 }).lean();
  const labelOf = new Map(alerts.map((a) => [String(a.studentId), String(a.description ?? '').replace(`[${AI_TAG}] `, '')]));
  const deptFaculty = (dept: string) => ctx.faculty.filter((f) => f.dept === dept);
  const [hod, lakshmi] = deptFaculty('CSE');
  let mentored = 0;
  for (const [i, s] of ctx.students.entries()) {
    const label = labelOf.get(String(s._id));
    if (label === NO_MENTOR) {
      await MentorAssignment.deleteMany({ collegeId: cid, studentId: s._id, status: 'active' });
      continue;
    }
    const pool = deptFaculty(s.branch);
    const mentor = label && HOD_CSE.includes(label) ? hod! : label && LAKSHMI.includes(label) ? lakshmi! : pool[i % pool.length]!;
    const res = await MentorAssignment.updateOne(
      { collegeId: cid, studentId: s._id, status: 'active' },
      { $set: { mentorId: mentor._id }, $setOnInsert: { academicYearId: ctx.ayId, assignedBy: ctx.faculty[0]!.personId, assignedDate: daysAgo(60) } },
      { upsert: true },
    );
    if (res.modifiedCount || res.upsertedCount) mentored += 1;
  }

  // ── The records behind the hostel and counselling signals ──────────────
  const sigs = await RiskSignal.find({ collegeId: cid, expiresAt: { $gt: new Date() }, signalType: { $in: ['warden_concern', 'counselling_active'] } })
    .select({ studentId: 1, signalType: 1, receivedAt: 1 }).lean();
  let violations = 0, sessions = 0;
  for (const sig of sigs) {
    if (!ours.has(String(sig.studentId))) continue;
    const at = sig.receivedAt ? new Date(sig.receivedAt.getTime() - DAY) : daysAgo(3);
    if (sig.signalType === 'warden_concern' && !(await HostelViolation.exists({ collegeId: cid, studentId: sig.studentId }))) {
      await HostelViolation.create({
        collegeId: cid, studentId: sig.studentId, reportedBy: ctx.staffId, violationType: 'Curfew violation',
        description: 'Returned after 11 pm on three nights this week; roommates report the student has stopped attending the mess.',
        severity: 'medium', incidentDate: at, status: 'under_investigation', welfareSignalSent: true,
      });
      violations += 1;
    }
    if (sig.signalType === 'counselling_active' && !(await CounselingSession.exists({ collegeId: cid, studentId: sig.studentId }))) {
      await CounselingSession.create({
        collegeId: cid, studentId: sig.studentId, counselorId: ctx.faculty[1]!.personId, sessionDate: at, type: 'personal',
        followUpRequired: true, notes: 'Student reports stress over fees and falling behind in two subjects. Weekly check-in agreed.',
      });
      sessions += 1;
    }
  }

  // ── Reminder history: some defaulters have stopped responding ──────────
  // The risk scorer adds +15 when fewer than 30% of reminders were delivered.
  const defaulters = await DefaulterRecord.find({ collegeId: cid, 'metadata.source': AI_TAG }).select({ studentId: 1, overdueAmount: 1, escalationStage: 1 }).lean();
  let reminders = 0;
  for (const [i, d] of defaulters.entries()) {
    if (await FeeReminder.exists({ collegeId: cid, studentId: d.studentId })) continue;
    const silent = i % 2 === 0;
    const n = 4 + (i % 3);
    await FeeReminder.insertMany(Array.from({ length: n }, (_, k) => ({
      collegeId: cid, studentId: d.studentId, defaulterRecordId: d._id, channel: k % 2 ? 'sms' : 'whatsapp',
      sentAt: daysAgo(5 + k * 7), dueAmount: d.overdueAmount, status: 'sent', escalationStage: d.escalationStage,
      deliveryStatus: silent ? (k === 0 ? 'delivered' : 'pending') : k % 3 === 2 ? 'pending' : 'delivered', metadata: { source: TAG },
    })));
    reminders += n;
  }

  // ── UPI share dips this week (fires the payment-mode finding) ──────────
  const weekStart = new Date(Date.now() - 7 * DAY);
  const recentUpi = await Payment.find({ collegeId: cid, 'metadata.source': AI_TAG, paymentMode: 'upi', createdAt: { $gte: weekStart } }).select({ _id: 1 }).lean();
  const shift = recentUpi.filter((_, i) => i % 4 !== 0).map((p) => p._id);
  if (shift.length) await Payment.collection.updateMany({ _id: { $in: shift } }, { $set: { paymentMode: 'cash' } });

  // ── Lead scores through the real scorer (rules, plus the model when available) ──
  const inquiries = await Inquiry.find({ collegeId: cid, tags: AI_TAG, leadScore: { $exists: false } }).select({ _id: 1 }).lean();
  // The AI audit (and so the spend gate) needs a real user; bill it to the admin login.
  const admin = await User.findOne({ collegeId: cid, email: 'admin@jit.edu.in' }).select({ _id: 1 }).lean();
  let scored = 0;
  for (const q of inquiries) {
    try {
      await scoreInquiry(cid, String(q._id), String(admin!._id), { trigger: 'batch' });
      scored += 1;
    } catch (e) {
      ctx.log(`  lead score skipped for ${q._id}: ${(e as Error).message}`);
    }
  }

  ctx.log(`story extras: ${mentored} mentor assignments set, ${violations} hostel reports, ${sessions} counselling sessions, ${reminders} fee reminders, ${shift.length} recent payments moved off UPI, ${scored} inquiries scored`);
}

/** The flagged students, for the closing summary the presenter reads from. */
export async function storyStudents(collegeId: string): Promise<Array<{ roll: string; name: string; priority: string; score: number; label: string }>> {
  const rows = await CrisisAlert.find({ collegeId, type: 'compound_risk', status: { $nin: ['resolved', 'false_positive'] } })
    .sort({ compoundScore: -1 })
    .populate<{ studentId: { rollNumber?: string; personId?: { name?: string } } }>({ path: 'studentId', select: 'rollNumber personId', populate: { path: 'personId', select: 'name' } })
    .select({ studentId: 1, priority: 1, compoundScore: 1, description: 1 }).lean();
  return rows.map((a) => ({
    roll: a.studentId?.rollNumber ?? '—',
    name: a.studentId?.personId?.name ?? '—',
    priority: String(a.priority ?? ''),
    score: Number(a.compoundScore ?? 0),
    label: String(a.description ?? '').replace(`[${AI_TAG}] `, ''),
  }));
}


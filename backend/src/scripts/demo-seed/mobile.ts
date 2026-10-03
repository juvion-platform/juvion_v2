import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { College } from '../../models/College';
import { User } from '../../models/User';
import { Student } from '../../models/people/Student';
import { Faculty } from '../../models/people/Faculty';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { Timetable } from '../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../models/academic-ops/TimetableSlot';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { HostelRoom } from '../../models/welfare/HostelRoom';
import { JuviAccount } from '../../models/juvi/JuviAccount';
import { Notice } from '../../models/juvi/Notice';
import { NoticeRecipient } from '../../models/juvi/NoticeRecipient';
import { ChannelMembership } from '../../models/juvi/ChannelMembership';
import { seedChannelTemplates } from '../../shared/seed/channel-templates';
import { drainOutbox } from '../../shared/outbox/outbox';
import { provisionPerson, transitionAccount } from '../../modules/juvi-app/accounts/provisioning-service';
import { reconcileCollege } from '../../modules/juvi-app/spaces/reconcile-service';
import { publishNotice } from '../../modules/juvi-app/notices/publish-service';
import { publishSchema } from '../../modules/juvi-app/notices/admin-schemas';
import { resolvePublisherScope } from '../../modules/juvi-app/notices/publisher-scope';
import { registerNoticeConsumers } from '../../modules/juvi-app/notices/consumers';
import { registerNotificationConsumers } from '../../modules/juvi-app/notifications';
import { markSeen } from '../../modules/juvi-app/notices/mobile-service';
import { acknowledge } from '../../modules/juvi-app/notices/ack-service';
import type { MobileContext } from '../../modules/juvi-app/middleware/authenticate-mobile';
import { DemoCtx, DAY, rng } from './context';

/** The phone logins. The student walks through onboarding on first sign-in. */
export const MOBILE_LOGINS = [
  { label: 'Student (Sai Kiran, CSE yr 2)', identifier: '25B01A0501', password: 'student123' },
  { label: 'Faculty (Dr. Lakshmi Prasad)', identifier: 'faculty.cse@jit.edu.in', password: 'faculty123' },
  { label: 'HOD (Dr. Ramesh Iyer)', identifier: 'hod.cse@jit.edu.in', password: 'hod123' },
];

const PERIODS = [['09:00', '09:50'], ['10:00', '10:50'], ['11:10', '12:00'], ['12:00', '12:50'], ['14:00', '14:50'], ['15:00', '15:50']] as const;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

/** One published weekly timetable per demo section, so course channels show their next class. */
async function ensureTimetables(ctx: DemoCtx): Promise<number> {
  const cid = ctx.collegeId;
  let made = 0;
  for (const [si, sectionId] of [...new Set(ctx.students.map((s) => String(s.sectionId)))].entries()) {
    if (await Timetable.exists({ collegeId: cid, sectionId, semesterId: ctx.semesterId })) continue;
    const offerings = await CourseOffering.find({ collegeId: cid, sectionId, semesterId: ctx.semesterId }).select({ _id: 1 }).sort({ _id: 1 }).lean();
    if (!offerings.length) continue;
    const tt = await Timetable.create({ collegeId: cid, sectionId, semesterId: ctx.semesterId, status: 'published', effectiveFrom: ctx.semesterStart });
    const slots: Record<string, unknown>[] = [];
    for (const [di, day] of DAYS.entries()) {
      for (let p = 0; p < 4; p++) {
        const period = (p + di + si) % PERIODS.length;
        slots.push({
          collegeId: cid, timetableId: tt._id, day, period: period + 1, startTime: PERIODS[period]![0], endTime: PERIODS[period]![1],
          courseOfferingId: offerings[(di + p) % offerings.length]!._id, slotType: p === 3 && di % 2 ? 'lab' : 'lecture',
        });
      }
    }
    await TimetableSlot.insertMany(slots);
    made += 1;
  }
  return made;
}

async function userRef(cid: string, email: string) {
  const u = await User.findOne({ collegeId: cid, email }).select({ role: 1, personaType: 1, personas: 1 }).lean();
  if (!u) throw new Error(`demo login ${email} missing — the logins step must run first`);
  return { id: String(u._id), role: u.role, personaType: u.personaType ?? undefined, personas: (u.personas as string[] | undefined) ?? undefined };
}

export async function seedMobile(ctx: DemoCtx): Promise<void> {
  const cid = ctx.collegeId;
  const log = ctx.log;

  await College.updateOne({ _id: cid }, { $set: { 'juvi.enabled': true, 'juvi.paused': false } });
  await seedChannelTemplates(cid);
  const timetables = await ensureTimetables(ctx);

  // ── Accounts: every demo student and faculty member ──────────────────
  // People who already have an ERP login keep its password (resetPassword
  // false): the User is shared with the web login.
  const testStudent = ctx.students.find((s) => s.rollNumber === MOBILE_LOGINS[0]!.identifier)!;
  let provisioned = 0;
  for (const s of ctx.students) {
    const r = await provisionPerson({
      collegeId: cid, personId: String(s.personId), kind: 'student', source: 'system', performedBy: 'demo-seed', resetPassword: false,
      ...(s === testStudent ? { temporaryPassword: MOBILE_LOGINS[0]!.password } : {}),
    });
    if (r.created) provisioned += 1;
  }
  for (const f of ctx.faculty) {
    const r = await provisionPerson({ collegeId: cid, personId: String(f.personId), kind: 'faculty', source: 'system', performedBy: 'demo-seed', resetPassword: false });
    if (r.created) provisioned += 1;
  }
  // The test student signs in straight away with a known password.
  await User.updateOne({ collegeId: cid, personId: testStudent.personId }, { $set: { password: await bcrypt.hash(MOBILE_LOGINS[0]!.password, 10), mustChangePassword: false, isActive: true } });

  // Everyone else has "already onboarded", so a notice's reach shows real
  // seen/acknowledged numbers. The three test logins keep onboarding.
  const lakshmi = await User.findOne({ collegeId: cid, email: MOBILE_LOGINS[1]!.identifier }).select({ personId: 1 }).lean();
  const ramesh = await User.findOne({ collegeId: cid, email: MOBILE_LOGINS[2]!.identifier }).select({ personId: 1 }).lean();
  const keepOnboarding = new Set([String(testStudent.personId), String(lakshmi?.personId), String(ramesh?.personId)]);
  const ours = [...ctx.students.map((s) => s.personId), ...ctx.faculty.map((f) => f.personId)];
  let activated = 0;
  for (const acc of await JuviAccount.find({ collegeId: cid, personId: { $in: ours }, status: 'onboarding' })) {
    if (keepOnboarding.has(String(acc.personId))) continue;
    await transitionAccount(acc, 'active', 'system', 'demo-seed');
    activated += 1;
  }

  const rec = await reconcileCollege(cid);
  log(`mobile: Juvi on, ${timetables} timetables, ${provisioned} accounts provisioned, ${activated} activated, channels reconciled ${JSON.stringify(rec).slice(0, 120)}`);

  // ── Notices, published through the real publish path ────────────────
  registerNoticeConsumers();
  registerNotificationConsumers();
  const sai = await Student.findById(testStudent._id).select({ batchId: 1 }).lean();
  const alloc = await HostelAllocation.findOne({ collegeId: cid, studentId: testStudent._id, status: 'active' }).select({ roomId: 1 }).lean();
  const block = alloc ? await HostelRoom.findById(alloc.roomId).select({ blockId: 1 }).lean() : null;
  const lakshmiFaculty = lakshmi ? await Faculty.findOne({ collegeId: cid, personId: lakshmi.personId }).select({ _id: 1 }).lean() : null;
  const dsOffering = lakshmiFaculty
    ? await CourseOffering.findOne({ collegeId: cid, facultyId: lakshmiFaculty._id, sectionId: testStudent.sectionId }).select({ _id: 1 }).lean()
    : null;

  const admin = await userRef(cid, 'admin@jit.edu.in');
  const hod = await userRef(cid, 'hod.cse@jit.edu.in');
  const fac = await userRef(cid, 'faculty.cse@jit.edu.in');
  const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();
  type Spec = { title: string; body: string; by: typeof admin; rules: Array<{ kind: string; ids: string[] }>; priority: 'routine' | 'important' | 'urgent'; ack?: number; ageHours: number; urgentReason?: string };
  const specs: Spec[] = [
    { title: 'Fire and evacuation drill today at 11:30', body: 'All students and staff must leave their buildings when the alarm sounds and assemble at the main ground. Wardens and class advisors will take attendance at the assembly point.', by: admin, rules: [{ kind: 'all', ids: [] }], priority: 'urgent', ack: 1, ageHours: 2, urgentReason: 'Mandatory safety drill for the whole campus; everyone must know before 11:30 today.' },
    { title: 'Mid-term examinations begin on 13 October', body: 'Mid-I examinations for all B.Tech years run from 13 to 18 October. The timetable and seating plan are on the notice board and in your batch channel. Carry your ID card to every paper.', by: admin, rules: [{ kind: 'role', ids: ['student'] }], priority: 'important', ack: 6, ageHours: 50 },
    { title: 'Second-semester fee due by 20 October', body: 'The second instalment of the academic-year fee is due by 20 October. Pay online through the fee portal or at the accounts office. Students with an approved instalment plan should follow their plan dates.', by: admin, rules: [{ kind: 'role', ids: ['student'] }], priority: 'important', ack: 9, ageHours: 96 },
    { title: 'Campus closed 20–22 October for Dussehra', body: 'The college will remain closed from 20 to 22 October. Classes resume on 23 October. Hostel messes will run on a holiday menu.', by: admin, rules: [{ kind: 'all', ids: [] }], priority: 'routine', ageHours: 26 },
    { title: 'CSE: Guest lecture on AI in industry, Thursday 2 pm', body: 'A senior engineer from a leading product company will speak on how AI is used in production systems. Seminar Hall 2, Thursday 2–4 pm. All CSE students and faculty are invited.', by: hod, rules: [{ kind: 'department', ids: [String(ctx.departments.CSE)] }], priority: 'routine', ageHours: 72 },
  ];
  if (sai?.batchId) specs.push({ title: 'Second-year Mid-I timetable and seating plan', body: 'Your Mid-I timetable and room allotment are attached in the exam cell portal. Report 15 minutes before each paper.', by: admin, rules: [{ kind: 'batch', ids: [String(sai.batchId)] }], priority: 'routine', ageHours: 30 });
  if (dsOffering) specs.push({ title: 'Data Structures: Assignment 2 due Friday', body: 'Assignment 2 (linked lists and stacks) is due this Friday by 5 pm. Submit the handwritten solutions in class. Late submissions lose 20% of the marks.', by: fac, rules: [{ kind: 'course_offering', ids: [String(dsOffering._id)] }], priority: 'important', ack: 3, ageHours: 20 });
  if (block?.blockId) specs.push({ title: 'Hostel water supply off on Saturday, 6–10 am', body: 'Water supply in your hostel block will be off on Saturday from 6 to 10 am for tank cleaning. Please store water on Friday night.', by: admin, rules: [{ kind: 'hostel_block', ids: [String(block.blockId)] }], priority: 'important', ageHours: 8 });

  let published = 0;
  const fresh: Types.ObjectId[] = [];
  for (const s of specs) {
    if (await Notice.exists({ collegeId: cid, title: s.title, status: 'published' })) continue;
    try {
      const input = publishSchema.parse({
        title: s.title, body: s.body, audience: { rules: s.rules }, priority: s.priority, purpose: 'standard',
        ackRequired: !!s.ack, ...(s.ack ? { ackDeadline: inDays(s.ack) } : {}), ...(s.urgentReason ? { urgentReason: s.urgentReason } : {}),
      });
      const scope = await resolvePublisherScope(cid, s.by);
      const n = await publishNotice(cid, scope, input, s.by.id);
      await drainOutbox();
      // Spread publish times over the last few days so the feed reads naturally.
      await Notice.updateOne({ _id: n._id }, { $set: { publishedAt: new Date(Date.now() - s.ageHours * 3_600_000) } });
      fresh.push(n._id as Types.ObjectId);
      published += 1;
    } catch (e) {
      log(`  notice skipped "${s.title}": ${(e as Error).message}`);
    }
  }

  // ── Reach: the onboarded population has seen and acknowledged some ──
  const r = rng(20261003);
  const accounts = new Map((await JuviAccount.find({ collegeId: cid, status: 'active' }).lean()).map((a) => [String(a._id), a]));
  const roles = new Map((await User.find({ _id: { $in: [...accounts.values()].map((a) => a.userId) } }).select({ role: 1 }).lean()).map((u) => [String(u._id), u.role as string]));
  let seen = 0, acked = 0;
  for (const noticeId of fresh) {
    const notice = await Notice.findById(noticeId).select({ ackRequired: 1 }).lean();
    for (const row of await NoticeRecipient.find({ noticeId, accountId: { $ne: null } }).select({ accountId: 1 }).lean()) {
      const acc = accounts.get(String(row.accountId));
      if (!acc || r.next() > 0.78) continue;
      const mctx: MobileContext = {
        userId: String(acc.userId), accountId: String(acc._id), sessionId: String(new Types.ObjectId()), collegeId: cid,
        role: roles.get(String(acc.userId)) ?? acc.kind, kind: acc.kind,
        studentId: acc.studentId ? String(acc.studentId) : undefined, facultyId: acc.facultyId ? String(acc.facultyId) : undefined,
        staffId: acc.staffId ? String(acc.staffId) : undefined, account: acc as unknown as MobileContext['account'],
      };
      try {
        await markSeen(mctx, String(noticeId));
        seen += 1;
        if (notice?.ackRequired && r.next() < 0.62) {
          await acknowledge(mctx, String(noticeId), { method: r.next() < 0.5 ? 'hold' : 'confirm', offline: false });
          acked += 1;
        }
      } catch { /* a row the account can no longer act on: leave it unseen */ }
    }
  }
  await drainOutbox();

  const members = await ChannelMembership.countDocuments({ collegeId: cid });
  log(`mobile: ${published} notices published (${specs.length - published} already there), ${seen} seen and ${acked} acknowledged by onboarded students, ${members} channel memberships`);
}

import { Types } from 'mongoose';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { CrisisAlert } from '../../models/welfare/CrisisAlert';
import { RiskSignal } from '../../models/welfare/RiskSignal';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { MentorAssignment } from '../../models/welfare/MentorAssignment';
import { AttendanceRecord } from '../../models/academic-ops/AttendanceRecord';
import { InternalMark } from '../../models/academic-ops/InternalMark';
import { Backlog } from '../../models/academic-ops/Backlog';
import { DefaulterRecord } from '../../models/finance/DefaulterRecord';
import { FinancialHold } from '../../models/finance/FinancialHold';
import { Payment } from '../../models/finance/Payment';
import { Inquiry } from '../../models/admissions/Inquiry';
import { Faculty } from '../../models/people/Faculty';
import { Section } from '../../models/academic-structure/Section';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { User } from '../../models/User';
import { DemoCtx, DAY } from './context';

const ACTIVE_DEFAULTER = { $nin: ['resolved', 'exited_hardship', 'exited_write_off'] };
const OPEN = { $nin: ['resolved', 'false_positive'] };

/**
 * Walk every link the demo relies on and say which hold. Returns the number
 * of failed checks; the data stays as written either way.
 */
export async function verifyDemo(ctx: DemoCtx): Promise<number> {
  const cid = ctx.collegeId;
  let failed = 0;
  const check = (ok: boolean, what: string) => { if (!ok) failed += 1; console.log(`  ${ok ? '✓' : '✗'} ${what}`); };

  const current = await AcademicYear.find({ collegeId: cid, isCurrent: true }).select({ code: 1 }).lean();
  check(current.length === 1 && current[0]!.code === 'AY2026-27', `current academic year is AY2026-27 (${current.map((a) => a.code).join(', ') || 'none'})`);

  const alerts = await CrisisAlert.find({ collegeId: cid, type: 'compound_risk', status: OPEN }).select({ studentId: 1, priority: 1 }).lean();
  const p1 = alerts.filter((a) => a.priority === 'P1').length;
  check(alerts.length >= 12 && p1 >= 3, `risk board: ${alerts.length} open alerts, ${p1} P1`);

  const sigs = await RiskSignal.find({ collegeId: cid, expiresAt: { $gt: new Date() } }).select({ studentId: 1, signalType: 1 }).lean();
  const withSig = (t: string) => [...new Set(sigs.filter((s) => s.signalType === t).map((s) => String(s.studentId)))].map((x) => new Types.ObjectId(x));

  const hostelNeeded = [...withSig('warden_concern'), ...withSig('mess_attendance_drop')];
  const housed = await HostelAllocation.countDocuments({ collegeId: cid, studentId: { $in: hostelNeeded }, status: 'active' });
  check(housed >= new Set(hostelNeeded.map(String)).size, `every warden/mess signal is on a hostel resident (${housed}/${new Set(hostelNeeded.map(String)).size})`);

  const attendance = async (ids: Types.ObjectId[]) => {
    const rows = await AttendanceRecord.aggregate<{ _id: Types.ObjectId; rate: number }>([
      { $match: { collegeId: new Types.ObjectId(cid), studentId: { $in: ids } } },
      { $group: { _id: '$studentId', rate: { $avg: { $cond: [{ $in: ['$status', ['present', 'late', 'od']] }, 1, 0] } } } },
    ]);
    return rows;
  };
  const dropIds = withSig('attendance_drop');
  const dropRates = await attendance(dropIds);
  check(dropRates.length === dropIds.length && dropRates.every((x) => x.rate < 0.75), `every attendance signal has a register below 75% (${dropRates.map((x) => Math.round(x.rate * 100) + '%').join(' ')})`);

  const failIds = withSig('failing_grades');
  const failMarks = await InternalMark.aggregate<{ _id: Types.ObjectId; avg: number }>([
    { $match: { collegeId: new Types.ObjectId(cid), studentId: { $in: failIds } } },
    { $group: { _id: '$studentId', avg: { $avg: '$marksObtained' } } },
  ]);
  check(failMarks.length === failIds.length && failMarks.every((x) => x.avg < 12), `every failing-grades signal has mid-term marks under 12/30 (${failMarks.length})`);

  const backlogIds = withSig('backlog_accumulation');
  const withBacklog = await Backlog.distinct('studentId', { collegeId: cid, studentId: { $in: backlogIds } });
  check(withBacklog.length === backlogIds.length, `every backlog signal has backlog records (${withBacklog.length}/${backlogIds.length})`);

  const feeIds = withSig('fee_default');
  const withDefault = await DefaulterRecord.distinct('studentId', { collegeId: cid, studentId: { $in: feeIds }, escalationStage: ACTIVE_DEFAULTER });
  check(withDefault.length === feeIds.length, `every fee-default signal is on the defaulter list (${withDefault.length}/${feeIds.length})`);

  const dupes = await DefaulterRecord.aggregate([
    { $match: { collegeId: new Types.ObjectId(cid), escalationStage: ACTIVE_DEFAULTER } },
    { $group: { _id: '$studentId', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } },
  ]);
  check(dupes.length === 0, `no student is on the defaulter list twice (${dupes.length})`);

  const story = alerts.map((a) => a.studentId);
  const findingsOnStory = (await DefaulterRecord.countDocuments({ collegeId: cid, 'metadata.source': 'agent-findings-v1', studentId: { $in: story } }))
    + (await FinancialHold.countDocuments({ collegeId: cid, 'metadata.source': 'agent-findings-v1', studentId: { $in: story } }));
  check(findingsOnStory === 0, 'finance findings sit on students outside the risk story');

  const since = new Date(Date.now() - 180 * DAY);
  const days = await Payment.aggregate([
    { $match: { collegeId: new Types.ObjectId(cid), status: 'success', paymentDate: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } } } }, { $count: 'n' },
  ]);
  check((days[0]?.n ?? 0) >= 30, `forecast has ${days[0]?.n ?? 0} days of payments (needs 30)`);

  const unscored = await Inquiry.countDocuments({ collegeId: cid, tags: 'demo-ai-v1', leadScore: { $exists: false } });
  check(unscored === 0, `every seeded inquiry has a lead score (${unscored} without)`);

  const facultyLogin = async (email: string) => {
    const u = await User.findOne({ collegeId: cid, email }).select({ personId: 1 }).lean();
    return u?.personId ? Faculty.findOne({ collegeId: cid, personId: u.personId, departmentId: ctx.departments.CSE }).select({ _id: 1 }).lean() : null;
  };
  const lakshmi = await facultyLogin('faculty.cse@jit.edu.in');
  const hod = await facultyLogin('hod.cse@jit.edu.in');
  const menteesOf = async (f: { _id: unknown } | null) => f ? MentorAssignment.distinct('studentId', { collegeId: cid, mentorId: f._id, status: 'active' }) : [];
  const flaggedOf = (ids: unknown[]) => ids.filter((x) => story.some((s) => String(s) === String(x))).length;
  const lakshmiMentees = await menteesOf(lakshmi);
  const taught = lakshmi ? await CourseOffering.distinct('sectionId', { collegeId: cid, facultyId: lakshmi._id, status: { $ne: 'cancelled' } }) : [];
  const lakshmiSections = await Section.countDocuments({ collegeId: cid, _id: { $in: taught }, studentIds: { $ne: [] } });
  check(!!lakshmi && flaggedOf(lakshmiMentees) >= 2 && lakshmiSections >= 2, `faculty login: Dr. Lakshmi Prasad in CSE, teaches ${lakshmiSections} sections, ${lakshmiMentees.length} mentees (${flaggedOf(lakshmiMentees)} on the risk board)`);
  const hodMentees = await menteesOf(hod);
  const hodP1 = alerts.filter((a) => a.priority === 'P1' && hodMentees.some((m) => String(m) === String(a.studentId))).length;
  check(!!hod && hodP1 >= 2, `HOD login: Dr. Ramesh Iyer in CSE, mentors ${hodP1} P1 students`);

  const acc = await User.findOne({ collegeId: cid, email: 'accounts@jit.edu.in' }).select({ role: 1, personaType: 1 }).lean();
  check(acc?.role === 'staff' && acc.personaType === 'ST-ACC', 'finance login is an Accounts (ST-ACC) staff member');

  return failed;
}

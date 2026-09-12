/**
 * 008 Phase 3 — context assemblers for the People agent.
 *
 * Mirrors `finance-agent/context.ts`: pure DB reads that produce a small,
 * plain object for a prompt. Every query is collegeId-filtered. No masking
 * happens here — the orchestrator owns the token map, same split as finance.
 *
 * Nothing in this file computes a risk number. The score, the priority and
 * the multipliers all come from `computeRiskScore` in welfare and are passed
 * through unchanged, because the LLM's job is to phrase them, never to
 * produce them.
 */

import { CrisisAlert } from '../../../models/welfare/CrisisAlert';
import { Student } from '../../../models/people/Student';
import { Person } from '../../../models/people/Person';
import { Parent } from '../../../models/people/Parent';
import { MentorAssignment } from '../../../models/welfare/MentorAssignment';

/** Human labels for the source enum — the model should not see "M03". */
const SOURCE_LABEL: Record<string, string> = {
  M03: 'academics',
  M04: 'fees',
  M06: 'welfare',
  M08: 'campus',
  Juvi: 'assistant',
};

const SIGNAL_LABEL: Record<string, string> = {
  attendance_drop: 'attendance dropped',
  failing_grades: 'failing grades',
  backlog_accumulation: 'backlogs accumulating',
  fee_default: 'fees overdue',
  scholarship_loss: 'scholarship lost',
  warden_concern: 'warden raised a concern',
  mess_attendance_drop: 'stopped eating in the mess',
  messaging_withdrawal: 'withdrawn from messaging',
  sentiment_anomaly: 'sentiment anomaly',
  isolation_indicators: 'signs of isolation',
  grievance_filed: 'grievance filed',
  counselling_active: 'in counselling',
};

export interface AlertNarrationContext {
  alertId: string;
  studentId: string;
  priority: string;
  score: number;
  /** Plain-language signal list — labels, not enum codes. */
  signals: Array<{ what: string; from: string; weight: number; daysAgo: number }>;
  distinctModules: number;
  crossModuleMultiplier: number;
  temporalMultiplier: number;
  daysOpen: number;
}

export interface OutreachDraftContext {
  studentId: string;
  studentName: string;
  rollNumber: string;
  priority: string;
  score: number;
  signals: Array<{ what: string; from: string }>;
  guardian: {
    name: string;
    phone: string;
    email?: string;
    relationship: string;
    /** 'call' | 'sms' | 'whatsapp' | 'email' — drives the channel on approve. */
    communicationPreference?: string;
    preferredLanguage?: string;
  } | null;
  mentorName: string | null;
}

function daysAgo(d: Date | string | undefined): number {
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
}

/**
 * Context for narrating one open alert.
 *
 * Returns null when the alert does not exist in this college — callers treat
 * that as "skip", never as an error, so one bad id cannot fail a batch.
 */
export async function forAlertNarration(
  collegeId: string,
  alertId: string,
): Promise<AlertNarrationContext | null> {
  const alert = await CrisisAlert.findOne({ _id: alertId, collegeId }).lean();
  if (!alert) return null;

  const signals = (alert.signals ?? []) as Array<{
    source?: string; signalType?: string; weight?: number; receivedAt?: Date;
  }>;

  return {
    alertId: String(alert._id),
    studentId: String(alert.studentId ?? ''),
    priority: alert.priority ?? 'P3',
    score: alert.compoundScore ?? 0,
    signals: signals.map((s) => ({
      what: SIGNAL_LABEL[s.signalType ?? ''] ?? s.signalType ?? 'unknown signal',
      from: SOURCE_LABEL[s.source ?? ''] ?? s.source ?? 'unknown',
      weight: s.weight ?? 0,
      daysAgo: daysAgo(s.receivedAt),
    })),
    distinctModules: new Set(signals.map((s) => s.source).filter(Boolean)).size,
    crossModuleMultiplier: alert.scoreBreakdown?.crossModuleMultiplier ?? 1,
    temporalMultiplier: alert.scoreBreakdown?.temporalMultiplier ?? 1,
    daysOpen: daysAgo((alert as { createdAt?: Date }).createdAt),
  };
}

/**
 * Context for drafting one guardian outreach message.
 *
 * The guardian's `communicationPreference` and `preferredLanguage` are carried
 * through deliberately: the finance equivalent of this flow drops both on
 * approve and hardcodes SMS, which is the bug this version must not inherit.
 */
export async function forOutreachDraft(
  collegeId: string,
  studentId: string,
): Promise<OutreachDraftContext | null> {
  const student = await Student.findOne({ _id: studentId, collegeId })
    .select({ rollNumber: 1, personId: 1 })
    .lean();
  if (!student) return null;

  const [studentPerson, alert] = await Promise.all([
    Person.findOne({ _id: student.personId, collegeId }).select({ name: 1 }).lean(),
    CrisisAlert.findOne({
      collegeId,
      studentId,
      status: { $nin: ['resolved', 'false_positive'] },
    })
      .sort({ compoundScore: -1 })
      .lean(),
  ]);

  // Prefer the fee-responsible guardian, then the primary contact, then any.
  const parents = await Parent.find({ collegeId, linkedStudents: studentId }).lean();
  const chosen =
    parents.find((p) => p.isFeeResponsible) ??
    parents.find((p) => p.primaryContact) ??
    parents[0] ??
    null;

  let guardian: OutreachDraftContext['guardian'] = null;
  if (chosen) {
    const gp = await Person.findOne({ _id: chosen.personId, collegeId })
      .select({ name: 1, phone: 1, email: 1, preferredLanguage: 1 })
      .lean();
    if (gp) {
      guardian = {
        name: gp.name,
        phone: gp.phone,
        email: gp.email,
        relationship: chosen.relationship,
        communicationPreference: chosen.communicationPreference,
        preferredLanguage: gp.preferredLanguage,
      };
    }
  }

  const assignment = await MentorAssignment.findOne({
    collegeId, studentId, status: 'active',
  }).lean();
  let mentorName: string | null = null;
  if (assignment) {
    const { Faculty } = await import('../../../models/people/Faculty');
    const faculty = await Faculty.findOne({ collegeId, _id: assignment.mentorId })
      .select({ personId: 1 })
      .lean();
    if (faculty) {
      const mp = await Person.findOne({ _id: faculty.personId, collegeId })
        .select({ name: 1 })
        .lean();
      mentorName = mp?.name ?? null;
    }
  }

  const signals = ((alert?.signals ?? []) as Array<{ source?: string; signalType?: string }>).map(
    (s) => ({
      what: SIGNAL_LABEL[s.signalType ?? ''] ?? s.signalType ?? 'a concern',
      from: SOURCE_LABEL[s.source ?? ''] ?? s.source ?? 'unknown',
    }),
  );

  return {
    studentId: String(student._id),
    studentName: studentPerson?.name ?? 'the student',
    rollNumber: student.rollNumber ?? '',
    priority: alert?.priority ?? 'P3',
    score: alert?.compoundScore ?? 0,
    signals,
    guardian,
    mentorName,
  };
}

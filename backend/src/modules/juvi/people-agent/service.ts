/**
 * 008 Phase 3 — People agent orchestrator.
 *
 * Two LLM-backed capabilities on top of the deterministic CCD engine:
 *
 *   1. Narrate an alert — one sentence explaining a compound score.
 *   2. Draft guardian outreach — a message in the guardian's own language,
 *      which a human approves before anything is recorded as contact.
 *
 * The engine already produced the score, the priority and the multipliers.
 * Nothing here recomputes them; the model only phrases what welfare computed.
 * Every call runs through `createLLMClient(provider, ctx)` so it is spend-gated
 * and audited without this module re-implementing either.
 */

import { Types } from 'mongoose';
import { z } from 'zod';

import { AppError } from '../../../middleware/errorHandler';
import { maskPII, unmaskText } from '../../../shared/llm/pii';
import { createLLMClient } from '../finance-agent/llm-client';
import { withBoundedConcurrency, tryParseJson } from '../finance-agent/orchestrator-helpers';
import { CrisisAlert } from '../../../models/welfare/CrisisAlert';
import { Student } from '../../../models/people/Student';
import { College } from '../../../models/College';
import { forAlertNarration, forOutreachDraft } from './context';
import {
  buildAlertNarrationMessages,
  buildOutreachDraftMessages,
  determineTone,
} from './prompts';

const CONCURRENCY = 5;
const MAX_BATCH = 25;

export interface AlertNarration {
  alertId: string;
  narrative: string | null;
}

export interface OutreachDraft {
  studentId: string;
  studentName: string;
  language: string;
  tone: 'supportive' | 'direct' | 'urgent';
  subject: string;
  body: string;
  /** Where this would go, taken from the guardian's own preference. */
  channel: string;
  guardianName: string | null;
  /** True when the text came from the template, not the model. */
  fallback: boolean;
}

export type DeliveryState = 'recorded_not_sent';

export interface ApprovalResult {
  approvedCount: number;
  alertIds: string[];
  /**
   * Deliberately explicit. No message-delivery provider is configured in this
   * codebase — see `workers/_stub-delivery.ts`, whose workers are not even
   * registered at startup. Approving records the outreach against the alert;
   * it does NOT send anything, and the caller must say so.
   */
  delivery: DeliveryState;
  deliveryNote: string;
}

const OutreachDraftSchema = z.object({
  language: z.string().min(1),
  tone: z.enum(['supportive', 'direct', 'urgent']),
  subject: z.string().min(1),
  body: z.string().min(1),
});

function ensureCollegeId(collegeId: string): void {
  if (!Types.ObjectId.isValid(collegeId)) throw new AppError(400, 'Invalid collegeId');
}

async function collegeName(collegeId: string): Promise<string | undefined> {
  const c = await College.findById(collegeId).select({ name: 1 }).lean();
  return c?.name;
}

/**
 * Template text used when the model is unavailable or returns unusable JSON.
 *
 * Not a placeholder — this is a message a mentor can actually send. The
 * feature has to keep working with no API key configured, which is also how
 * the demo survives a dead network.
 */
function fallbackDraft(input: {
  studentName: string;
  guardianName: string | null;
  language: string;
  tone: 'supportive' | 'direct' | 'urgent';
  mentorName: string | null;
}): { language: string; tone: 'supportive' | 'direct' | 'urgent'; subject: string; body: string } {
  const greeting = input.guardianName ? `Dear ${input.guardianName},` : 'Dear parent,';
  const mentor = input.mentorName ? ` Their mentor, ${input.mentorName},` : ' Their mentor';
  return {
    language: input.language,
    tone: input.tone,
    subject: `Regarding ${input.studentName}`,
    body: [
      greeting,
      `We would like to speak with you about ${input.studentName}'s progress at college.`,
      `${mentor} would welcome a short conversation at your convenience.`,
      'Please contact the college office to arrange a time.',
    ].join(' '),
  };
}

// ── T9: narration ──────────────────────────────────────────────────────────

export async function handleAlertNarrations(
  collegeId: string,
  userId: string,
  alertIds: string[],
): Promise<AlertNarration[]> {
  ensureCollegeId(collegeId);
  if (alertIds.length > MAX_BATCH) {
    throw new AppError(400, `At most ${MAX_BATCH} alerts per request`);
  }

  const name = await collegeName(collegeId);
  const contexts = await Promise.all(
    alertIds.map((id) => forAlertNarration(collegeId, id)),
  );

  const results = await withBoundedConcurrency(
    contexts.map((ctx, i) => ({ ctx, alertId: alertIds[i]! })),
    CONCURRENCY,
    async ({ ctx, alertId }): Promise<AlertNarration> => {
      // A missing alert is a skip, never a batch failure.
      if (!ctx) return { alertId, narrative: null };

      const { masked, tokenMap } = maskPII(ctx);
      const messages = buildAlertNarrationMessages({
        sys: { today: new Date(), collegeName: name, role: 'Mentor' },
        alert: masked,
      });

      try {
        const client = createLLMClient(undefined, {
          collegeId,
          userId,
          actionType: 'narration-people',
        });
        const out = await client.complete(messages, { maxTokens: 120 });
        return { alertId, narrative: unmaskText(out.text.trim(), tokenMap) };
      } catch {
        // Degrade to no narrative — the board's numbers stand on their own.
        return { alertId, narrative: null };
      }
    },
  );

  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { alertId: alertIds[i]!, narrative: null },
  );
}

// ── T10: outreach drafts ───────────────────────────────────────────────────

export async function handleOutreachDrafts(
  collegeId: string,
  userId: string,
  studentIds: string[],
): Promise<OutreachDraft[]> {
  ensureCollegeId(collegeId);
  if (studentIds.length > MAX_BATCH) {
    throw new AppError(400, `At most ${MAX_BATCH} students per request`);
  }

  const name = await collegeName(collegeId);
  const contexts = await Promise.all(
    studentIds.map((sid) => forOutreachDraft(collegeId, sid)),
  );

  const results = await withBoundedConcurrency(
    contexts.filter((c): c is NonNullable<typeof c> => c !== null),
    CONCURRENCY,
    async (ctx): Promise<OutreachDraft> => {
      const language = ctx.guardian?.preferredLanguage ?? 'en';
      const tone = determineTone({ priority: ctx.priority, priorOutreachCount: 0 });
      // Carried from the guardian record. The finance equivalent hardcodes
      // 'sms' here and throws this away; that bug is not inherited.
      const channel = ctx.guardian?.communicationPreference ?? 'sms';

      const { masked, tokenMap } = maskPII(ctx);
      const base = {
        studentId: ctx.studentId,
        studentName: ctx.studentName,
        channel,
        guardianName: ctx.guardian?.name ?? null,
      };

      for (const strict of [false, true]) {
        try {
          const client = createLLMClient(undefined, {
            collegeId,
            userId,
            actionType: 'outreach-draft',
          });
          const messages = buildOutreachDraftMessages({
            sys: { today: new Date(), collegeName: name, role: 'Mentor' },
            language,
            tone,
            context: masked,
            strict,
          });
          const out = await client.complete(messages, { maxTokens: 400 });
          const parsed = tryParseJson(out.text, OutreachDraftSchema);
          if (parsed.ok && parsed.value) {
            return {
              ...base,
              language: parsed.value.language,
              tone: parsed.value.tone,
              subject: unmaskText(parsed.value.subject, tokenMap),
              body: unmaskText(parsed.value.body, tokenMap),
              fallback: false,
            };
          }
        } catch {
          break; // a thrown call will not succeed on retry
        }
      }

      const fb = fallbackDraft({
        studentName: ctx.studentName,
        guardianName: ctx.guardian?.name ?? null,
        language,
        tone,
        mentorName: ctx.mentorName,
      });
      return { ...base, ...fb, fallback: true };
    },
  );

  return results
    .filter((r): r is { status: 'fulfilled'; value: OutreachDraft } => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ── T10: approve (human in the loop) ───────────────────────────────────────

export interface ApprovedOutreach {
  studentId: string;
  subject: string;
  body: string;
  channel: string;
}

/**
 * Record approved outreach against each student's open alert.
 *
 * This deliberately does NOT enqueue a delivery job. The SMS/email/WhatsApp
 * queues have no registered worker — jobs pushed to them sit in Redis
 * indefinitely, and the enqueue throws a "queue not registered" error that the
 * finance agent swallows and mislabels as "Redis offline". Enqueueing here
 * would let a mentor believe a parent was contacted when nothing happened.
 *
 * So the outreach is recorded as an intervention on the alert and the result
 * says plainly that nothing was sent. When a real provider is wired, this is
 * the single place that changes.
 */
export async function handleApproveOutreach(
  collegeId: string,
  userId: string,
  approved: ApprovedOutreach[],
): Promise<ApprovalResult> {
  ensureCollegeId(collegeId);

  // Cross-college check before any write.
  const ids = approved.map((a) => a.studentId);
  for (const id of ids) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(403, 'Cross-college access denied');
  }
  const students = await Student.find({
    collegeId,
    _id: { $in: ids.map((i) => new Types.ObjectId(i)) },
  })
    .select({ _id: 1 })
    .lean();
  const valid = new Set(students.map((s) => String(s._id)));
  for (const id of ids) {
    if (!valid.has(id)) throw new AppError(403, 'Cross-college access denied');
  }

  const alertIds: string[] = [];
  for (const item of approved) {
    const alert = await CrisisAlert.findOneAndUpdate(
      {
        collegeId,
        studentId: item.studentId,
        status: { $nin: ['resolved', 'false_positive'] },
      },
      {
        $set: {
          status: 'intervening',
          intervention: {
            type: 'parent_contact',
            description: `[${item.channel}] ${item.subject} — ${item.body}`,
            executedBy: userId,
            executedAt: new Date(),
            // Honest by construction: no provider exists to deliver this.
            outcome: 'recorded_not_sent',
          },
        },
      },
      { new: true },
    );
    if (alert) alertIds.push(String(alert._id));
  }

  return {
    approvedCount: alertIds.length,
    alertIds,
    delivery: 'recorded_not_sent',
    deliveryNote:
      'Outreach recorded against the alert. No message was sent — no delivery provider is configured.',
  };
}

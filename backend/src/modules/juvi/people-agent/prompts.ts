/**
 * 008 Phase 3 — prompt templates for the People agent.
 *
 * Two jobs only, both chosen because a language model is genuinely better at
 * them than code is:
 *
 *   1. Narrate a compound risk score in one sentence a mentor can repeat.
 *   2. Draft a guardian outreach message in the guardian's own language.
 *
 * Everything numeric — the score, the priority, the multipliers, which signals
 * fired — is computed by `computeRiskScore` in welfare and passed in. The
 * system prefix forbids inventing or recalculating any of it, and the
 * narration prompt is explicitly told to restate the given numbers rather than
 * derive new ones. This is the same rule finance holds: no number on screen is
 * produced by a model.
 */

import type { LLMMessage } from '../finance-agent/llm-client';
import type { AlertNarrationContext, OutreachDraftContext } from './context';

export interface SystemContext {
  today: Date;
  collegeName?: string;
  /** The requester's role, so a dean and a mentor get differently-framed text. */
  role?: string;
}

/**
 * Shared system prefix.
 *
 * Beyond the finance version's defences (role anchoring, action humility, PII
 * passthrough, honest unknown) this adds one the student-welfare context needs:
 * no diagnosis. The model is looking at attendance and fee records, not a
 * clinical assessment, and must not speculate about mental health.
 */
export function systemPrefix(ctx: SystemContext): string {
  const today = ctx.today.toISOString().slice(0, 10);
  const collegeName = ctx.collegeName ?? 'the college';
  const role = ctx.role ?? 'Student Welfare Officer';
  return [
    'You are the Juvion Student Welfare assistant. You support mentors and deans at an Indian college.',
    'Always reply concisely. Never claim to have taken an action — only the human contacts anyone.',
    'Never invent, recalculate or contradict a number you were given. State only what the data shows.',
    'Never speculate about a medical or psychological diagnosis. Describe observed record activity, nothing more.',
    'Never output PII tokens you did not receive. If you cannot answer, say so plainly.',
    `Current date: ${today}. College: ${collegeName}. Requester role: ${role}.`,
  ].join('\n');
}

// ── Alert narration ────────────────────────────────────────────────────────

export interface AlertNarrationInput {
  sys: SystemContext;
  /** Already-masked narration context. */
  alert: AlertNarrationContext | unknown;
}

export function buildAlertNarrationMessages(input: AlertNarrationInput): LLMMessage[] {
  const user = [
    'Explain in ONE sentence why this student was flagged, in plain language a mentor',
    'could repeat to a parent. Name the specific signals. Do NOT recommend an action,',
    'do NOT restate the score as a judgement about the person, and do NOT speculate',
    'about causes the data does not show.',
    '',
    `alert: ${JSON.stringify(input.alert)}`,
  ].join('\n');
  return [
    { role: 'system', content: systemPrefix(input.sys) },
    { role: 'user', content: user },
  ];
}

// ── Outreach draft (JSON output) ───────────────────────────────────────────

export interface OutreachDraftInput {
  sys: SystemContext;
  language: string;
  tone: 'supportive' | 'direct' | 'urgent';
  /** Already-masked draft context. */
  context: OutreachDraftContext | unknown;
  /** Set on the retry after a JSON parse failure. */
  strict?: boolean;
}

export function buildOutreachDraftMessages(input: OutreachDraftInput): LLMMessage[] {
  const strictReminder = input.strict
    ? '\n\nIMPORTANT: The previous attempt returned invalid JSON. You MUST return a valid JSON object, nothing else.'
    : '';
  const sys =
    systemPrefix(input.sys) +
    '\n\nReturn ONLY a single JSON object, no prose, no markdown fences.' +
    strictReminder;

  const user = [
    `Draft a message to a student's guardian. Write it in ${input.language} using a ${input.tone} tone.`,
    'Address the guardian by their relationship to the student. Keep it under 5 sentences.',
    'Invite them to speak with the mentor — do not demand, threaten, or mention consequences.',
    'Use the masked tokens verbatim where they appear; never invent a name or phone number.',
    '',
    'Return STRICTLY a JSON object with this shape:',
    '{ "language": string, "tone": "supportive"|"direct"|"urgent",',
    '  "subject": string, "body": string }',
    '',
    `context: ${JSON.stringify(input.context)}`,
  ].join('\n');

  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

/**
 * Tone selection is deterministic, not a model decision — the same inputs must
 * always produce the same tone so a mentor can predict what will be sent.
 */
export function determineTone(ctx: {
  priority: string;
  priorOutreachCount: number;
}): 'supportive' | 'direct' | 'urgent' {
  if (ctx.priority === 'P1') return 'urgent';
  if (ctx.priorOutreachCount >= 2) return 'direct';
  return 'supportive';
}

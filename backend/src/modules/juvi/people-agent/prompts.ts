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

import type { LLMMessage } from '../../../shared/ai/llm/client';
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

// ── Command bar query (009 T8) ─────────────────────────────────────────────

export interface PeopleQueryPromptInput {
  sys: SystemContext;
  /** Already-masked `PeopleQueryBundle`. */
  contextBundle: unknown;
  userPrompt: string;
}

/**
 * The honesty rules are the feature. The model sees a capped, scoped bundle
 * and must say so; it may not compute, and when the answer lives on another
 * screen it must point there instead of guessing.
 */
const SOURCE_WORD: Record<string, string> = { M03: 'academics', M04: 'fees', M08: 'campus', M06: 'welfare', Juvi: 'messaging' };

/**
 * One labelled line per board row. A small model checks "first-generation: yes"
 * and "7-day change: +12" reliably; it misreads the same facts as nested JSON
 * booleans inside a 10k-character bundle.
 */
function renderBoardRow(r: Record<string, unknown>): string {
  const d = r['delta7d'];
  const change = typeof d === 'number' ? (d > 0 ? `+${d} (went up)` : d < 0 ? `${d} (went down)` : '0 (no change)') : 'no earlier score';
  const sigs = Array.isArray(r['signalTypes']) ? (r['signalTypes'] as string[]) : [];
  const srcs = Array.isArray(r['sources']) ? (r['sources'] as string[]).map((x) => SOURCE_WORD[x] ?? x) : [];
  return [
    `${r['rollNumber']} | ${r['studentName']}`,
    `${r['priority'] ?? 'no priority'} | score ${r['score']} | 7-day change: ${change}`,
    `${r['branch'] ?? 'branch unknown'} | year ${r['yearOfStudy']} | quota ${r['quota'] ?? 'unspecified'} | category ${r['category'] ?? 'unspecified'}`,
    `first-generation: ${r['firstGeneration'] ? 'yes' : 'no'} | hostel resident: ${r['hostelResident'] ? 'yes' : 'no'}`,
    `mentor: ${r['mentorName'] ?? 'none assigned'} | status ${r['status']} | open ${r['daysOpen']} days | last action: ${r['lastActionAt'] ? String(r['lastActionAt']).slice(0, 10) : 'none — nobody has acted'}`,
    `signals: ${sigs.join(', ') || 'none'} | from: ${srcs.join(', ') || 'none'}`,
  ].join(' || ');
}

function renderBundle(bundle: unknown): string {
  const b = bundle as { board?: unknown[]; scope?: unknown } | null;
  if (!b || !Array.isArray(b.board)) return JSON.stringify(bundle, null, 2);
  const { board, ...rest } = b;
  const rows = (board as Array<Record<string, unknown>>).map((r, i) => `${i + 1}. ${renderBoardRow(r)}`);
  return [
    `board (${rows.length} rows; one student per numbered line, fields separated by ||):`,
    ...rows,
    '',
    'other data (JSON):',
    JSON.stringify(rest, null, 2),
  ].join('\n');
}

export function buildPeopleQueryMessages(input: PeopleQueryPromptInput): LLMMessage[] {
  const rules = [
    systemPrefix(input.sys),
    '',
    'Answer only from the data in <context>. Do not use outside knowledge about any student.',
    'Every number you quote must appear in <context> verbatim; you may count rows that match a filter, but say how many rows you counted from.',
    'The board is capped at the top 50 alerts by score — say "of the top 50 shown" when the total exceeds 50, never imply you saw everyone.',
    'If the question needs data that is not in <context> (fee ledger, counselling notes, attendance registers, a student not on the board), say so and name the screen that has it: Finance → Fee Dashboard, Welfare → Counselling, Academics → Attendance, People → Students.',
    'Each board line states the facts explicitly: "first-generation: yes/no", "hostel resident: yes/no", "7-day change: +N (went up) / -N (went down)", "year N" (year 2 = second-year), "last action: none — nobody has acted", and the signals with the module they came from. Use those words literally; do not infer a flag from anything else.',
    'Before listing a student, check every condition in the question against that row\'s fields. Exclude any row that fails one. If no row matches, say so.',
    'When listing students give roll number, priority, score and the signal types. Keep it under 8 lines unless asked for a full list.',
    'Never recommend a clinical action. Never claim a message was sent.',
  ].join('\n');
  return [
    { role: 'system', content: rules },
    {
      role: 'user',
      content: ['<context>', renderBundle(input.contextBundle), '</context>', '', input.userPrompt].join('\n'),
    },
  ];
}

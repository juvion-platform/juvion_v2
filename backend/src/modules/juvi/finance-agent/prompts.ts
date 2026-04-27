/**
 * Task A4 — Prompt templates (fee-analytics-ai-native).
 *
 * One template per LLM-mediated feature. All take MASKED context (PII
 * already replaced with `{guardian_phone_1}` style tokens) and return
 * `LLMMessage[]` ready to feed to the client.
 *
 * Spec: plan §1.6 (prompt templates).
 *
 * Design notes:
 *   - Shared system prefix sits across all templates (jailbreak defense
 *     + role anchoring).
 *   - JSON-output prompts (situations, drafts) include the mandatory
 *     "Return ONLY a JSON array, no prose, no markdown fences." marker.
 *     Both Claude and OpenAI can be coerced through the system instruction.
 *   - Each template returns `[system, user]` — chat appends prior turns
 *     between them in `service.ts`.
 */

import type { LLMMessage } from './llm-client';

export interface SystemContext {
  today: Date;
  collegeName?: string;
  role?: string;
}

/**
 * Shared system prefix for every feature.
 *
 * Defense-in-depth principles baked in:
 *   1. Role anchoring ("Finance Officer at an Indian college")
 *   2. Action humility ("Never claim to have taken an action")
 *   3. PII passthrough ("Never output PII tokens you did not receive")
 *   4. Honest unknown ("If you cannot answer, say so plainly")
 */
export function systemPrefix(ctx: SystemContext): string {
  const today = ctx.today.toISOString().slice(0, 10);
  const collegeName = ctx.collegeName ?? 'unspecified college';
  const role = ctx.role ?? 'Finance Officer';
  return [
    'You are the Juvion Finance Agent. You advise Finance Officers at an Indian college.',
    'Always reply concisely. Never claim to have taken an action — only the human approves and dispatches.',
    'Never output PII tokens you did not receive. If you cannot answer, say so plainly.',
    `Current date: ${today}. College: ${collegeName}. Requester role: ${role}.`,
  ].join('\n');
}

// ── Chat ────────────────────────────────────────────────────────────────

export interface ChatPromptInput {
  sys: SystemContext;
  /** Already-masked context bundle. */
  contextBundle: unknown;
  /** Free-form user prompt. */
  userPrompt: string;
}

export function buildChatMessages(input: ChatPromptInput): LLMMessage[] {
  const ctx = JSON.stringify(input.contextBundle, null, 2);
  return [
    { role: 'system', content: systemPrefix(input.sys) },
    {
      role: 'user',
      content: [
        '<context>',
        ctx,
        '</context>',
        '',
        input.userPrompt,
      ].join('\n'),
    },
  ];
}

// ── Forecast narrative ─────────────────────────────────────────────────

export interface ForecastPromptInput {
  sys: SystemContext;
  projection: { lower: number; mean: number; upper: number; confidence: number };
  signals: unknown;
}

export function buildForecastNarrativeMessages(
  input: ForecastPromptInput,
): LLMMessage[] {
  const sys = systemPrefix(input.sys);
  const user = [
    'Given the following month-end collection forecast and recent anomaly signals,',
    'write 1–2 sentences identifying the top 2–3 drivers of the projection.',
    'Be specific. Do NOT speculate beyond the data.',
    '',
    `projection_inr_lower: ${input.projection.lower}`,
    `projection_inr_mean:  ${input.projection.mean}`,
    `projection_inr_upper: ${input.projection.upper}`,
    `confidence:           ${input.projection.confidence}`,
    '',
    `signals: ${JSON.stringify(input.signals)}`,
  ].join('\n');
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

// ── Risk score narrative (per student) ─────────────────────────────────

export interface RiskNarrativeInput {
  sys: SystemContext;
  studentId: string;
  /** Already-masked factor list. */
  factors: unknown;
  score: number | null;
  tier: string;
}

export function buildRiskNarrativeMessages(
  input: RiskNarrativeInput,
): LLMMessage[] {
  const sys = systemPrefix(input.sys);
  const user = [
    'Given these risk factors for one student, explain the score in ONE sentence',
    'in plain language a Finance Officer can repeat to a colleague.',
    'Do NOT recommend an action; just explain the score.',
    '',
    `score:  ${input.score ?? 'null (insufficient data)'}`,
    `tier:   ${input.tier}`,
    `factors: ${JSON.stringify(input.factors)}`,
  ].join('\n');
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

// ── Situations (JSON output) ───────────────────────────────────────────

export interface SituationsPromptInput {
  sys: SystemContext;
  /** Already-masked candidate list. */
  candidates: unknown;
  /** When non-empty, switches to the strict-retry variant of the prompt. */
  strict?: boolean;
}

export function buildSituationsMessages(
  input: SituationsPromptInput,
): LLMMessage[] {
  const strictReminder = input.strict
    ? '\n\nIMPORTANT: The previous attempt returned invalid JSON. You MUST return a valid JSON array, nothing else.'
    : '';
  const sys =
    systemPrefix(input.sys) +
    '\n\nReturn ONLY a JSON array, no prose, no markdown fences.' +
    strictReminder;
  const user = [
    'From the following candidate situations, pick the top 3–5 that most need',
    'a Finance Officer\u2019s action today. For each, write a 1-sentence narrative',
    'and propose 2–3 actions.',
    '',
    'Return STRICTLY a JSON array of objects with this shape:',
    '[{ "kind": string, "severity": "low"|"medium"|"high",',
    '   "title": string, "narrative": string, "studentIds": string[],',
    '   "actions": [{ "label": string, "type": "draft_plan"|"draft_reminder"|"schedule_call"|"review_policy"|"dismiss", "payload": object|null }]',
    '}]',
    '',
    'No prose. No markdown. JSON ONLY.',
    '',
    `candidates: ${JSON.stringify(input.candidates)}`,
  ].join('\n');
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

// ── Reminder drafts (JSON output, per student) ─────────────────────────

export interface ReminderDraftPromptInput {
  sys: SystemContext;
  studentId: string;
  language: string;
  tone: 'soft' | 'firm' | 'empathetic';
  /** Already-masked context: guardian, days overdue, amount, etc. */
  context: unknown;
}

export function buildReminderDraftMessages(
  input: ReminderDraftPromptInput,
): LLMMessage[] {
  const sys =
    systemPrefix(input.sys) +
    '\n\nReturn ONLY a single JSON object, no prose, no markdown fences.';
  const user = [
    `Draft a fee reminder for one student. Use language ${input.language} and tone ${input.tone}.`,
    'Address the guardian. Keep it under 4 sentences. Use the masked tokens',
    'verbatim where they appear in the context — do not invent a name or phone.',
    '',
    'Return STRICTLY a JSON object with this shape:',
    '{ "language": string, "tone": "soft"|"firm"|"empathetic",',
    '  "subject": string, "body": string, "predictedReadRate": number }',
    '',
    'predictedReadRate is a number between 0 and 1.',
    '',
    `context: ${JSON.stringify(input.context)}`,
  ].join('\n');
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

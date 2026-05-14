/**
 * Lead-scoring LLM prompt builder.
 *
 * Returns a system+user message pair for the Juvi LLM client. The user
 * content carries the inquiry + recent interactions as MASKED context —
 * PII tokens only, no raw phone/email/name. The system content pins the
 * JSON output schema.
 *
 * Spec: `.sdd/specs/001-ai-lead-scoring/spec.md` §3 "LLM component".
 *
 * PROMPT_VERSION feeds `scoreRationale.modelVersion` so we can trace
 * which prompt revision produced any historical score.
 */

import type { LLMMessage } from '../../juvi/finance-agent/llm-client';

export const PROMPT_VERSION = 'lead-scoring-prompt-v1';

export interface MaskedInteraction {
  type: string;
  outcome?: string;
  summary?: string;
  /** How many days before `today` the interaction happened (helps the model reason about freshness). */
  daysAgo: number;
}

export interface LeadScoringPromptInput {
  today: Date;
  /** Masked Inquiry projection (PII tokens only). */
  maskedInquiry: unknown;
  /** Up to ~5 most-recent interactions, masked. */
  maskedInteractions: MaskedInteraction[];
}

function systemPrompt(): string {
  return [
    'You are the Juvion Admissions Lead-Scoring Agent. You score college-admission leads for Indian colleges.',
    '',
    'Output ONLY a single JSON object — no prose, no markdown fences, no commentary. The object MUST have exactly these keys:',
    '  "score":   integer 0-100 (your end-to-end qualitative score, blending intent, fit, recency)',
    '  "factors": array of 2-5 objects each with { "label": string, "weight": integer (-25..25) }',
    '  "summary": one-sentence rationale (under 25 words)',
    '',
    'Guidelines:',
    '- A "hot" lead (>=80) shows strong intent + good academic/programme fit + recent engagement.',
    '- A "dormant" lead (<40) shows no recent engagement or explicit disinterest.',
    '- Never output PII tokens you did not receive. If a token like {phone_1} appears in input, you may reference it but never invent new tokens.',
    '- Treat masked fields ({name_*}, {phone_*}, {email_*}) as opaque identifiers — do not speculate about real values.',
  ].join('\n');
}

export function buildLeadScoringPrompt(input: LeadScoringPromptInput): LLMMessage[] {
  const today = input.today.toISOString().slice(0, 10);
  const interactions = input.maskedInteractions
    .map((i, idx) => `  ${idx + 1}. type=${i.type}, outcome=${i.outcome ?? '(none)'}, days_ago=${i.daysAgo}, note=${i.summary ?? '(no note)'}`)
    .join('\n') || '  (no interactions logged yet)';

  const userContent = [
    `Today: ${today}`,
    '',
    '<inquiry>',
    JSON.stringify(input.maskedInquiry, null, 2),
    '</inquiry>',
    '',
    '<recent-interactions>',
    interactions,
    '</recent-interactions>',
    '',
    'Score this lead and return ONLY the JSON object specified by the system prompt.',
  ].join('\n');

  return [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: userContent },
  ];
}

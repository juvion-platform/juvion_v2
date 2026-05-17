/**
 * 003-nl-report-queries §3 + §10.5 + §10.8 + §10.13.
 * Phase B Wave 1 — backlog-report + hostel-occupancy added to allow-list.
 *
 * System + user LLMMessage pair for the NL → report-allow-list translator.
 *
 * Allow-list is hard-coded here (single source of truth) and exported so
 * the parser's Zod schema can reuse the same constant. Param shapes match
 * the actual runners in `report-registry.ts` exactly:
 *   admissions-funnel:        { from, to }
 *   lead-source-performance:  { from, to }
 *   student-roster-snapshot:  { status: 'active' | 'all' }
 *   backlog-report:           { departmentId?: string }
 *   hostel-occupancy:         { asOf?: ISO-date } (param currently ignored;
 *                              runner returns current snapshot)
 *
 * PROMPT_VERSION bumped to v2 with the additions so persisted NlReportQuery
 * docs can be distinguished by the prompt that produced them.
 */

import type { LLMMessage } from '../../juvi/finance-agent/llm-client';

export const PROMPT_VERSION = 'nl-report-prompt-v2';

export const ALLOWED_REPORTS = [
  'admissions-funnel',
  'lead-source-performance',
  'student-roster-snapshot',
  'backlog-report',
  'hostel-occupancy',
] as const;

export type AllowedReportCode = (typeof ALLOWED_REPORTS)[number];

export interface NlReportPromptInput {
  today: Date;
  /** Already PII-masked. The masker runs upstream — see service.ts. */
  maskedQuestion: string;
}

function systemPrompt(): string {
  return [
    'You are the Juvion Report Navigator for an Indian college admin. You map plain-English questions',
    'to one of a small, fixed set of reports the admin is allowed to run.',
    '',
    'You may ONLY pick from this allow-list:',
    '  "admissions-funnel"        — params: { from: ISO-date, to: ISO-date }',
    '  "lead-source-performance"  — params: { from: ISO-date, to: ISO-date }',
    '  "student-roster-snapshot"  — params: { status: "active" | "all" } (default "active")',
    '  "backlog-report"           — params: { departmentId?: string } (optional; omit for college-wide)',
    '  "hostel-occupancy"         — params: { } (no required params; asOf reserved for v1.5)',
    '',
    'Output ONLY a single JSON object — no prose, no markdown fences, no commentary. The object MUST be',
    'one of these two shapes:',
    '',
    '  { "status": "matched", "reportCode": "<one of the above>", "params": { ... }, "rationale": "<one sentence>" }',
    'OR',
    '  { "status": "refused", "reason": "<one sentence explaining why no match>" }',
    '',
    'Guidelines:',
    '- Never invent a reportCode outside the allow-list above. If the question does not fit, refuse.',
    '- Never invent params keys outside what the allow-list line shows. The two date-range reports',
    '  use EXACTLY the keys `from` and `to`. The roster report uses EXACTLY the key `status`.',
    '  The backlog report takes an OPTIONAL `departmentId` (omit when the user asks college-wide).',
    '  The hostel-occupancy report takes NO params in v1 (do not synthesize an asOf value).',
    '- Dates: prefer ISO yyyy-mm-dd. If the user says "last month", resolve relative to TODAY (passed in user content).',
    '- If a required param is missing or unclear, refuse with a hint about what is missing.',
    '- Rationale / reason must be one complete sentence, under 25 words.',
  ].join('\n');
}

export function buildNlReportPrompt(input: NlReportPromptInput): LLMMessage[] {
  const today = input.today.toISOString().slice(0, 10);
  const userContent = [
    `Today: ${today}`,
    '',
    `Question: ${input.maskedQuestion}`,
    '',
    'Return ONLY the JSON object specified by the system prompt.',
  ].join('\n');
  return [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: userContent },
  ];
}

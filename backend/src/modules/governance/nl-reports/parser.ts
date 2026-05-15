/**
 * 003-nl-report-queries Task 3.1 — strict JSON parser.
 *
 * The Zod discriminated union enforces the allow-list AT THE TYPE LEVEL:
 * any `reportCode` outside `ALLOWED_REPORTS` is a Zod error and the
 * service falls through to `refused`. Param-shape + date-bounds checks
 * are deferred to `validator.ts` because they need runtime knowledge of
 * which report was picked.
 *
 * Returns a tagged result so the service can branch cleanly:
 *   { ok: true, value: NlReportLlmOutput }
 *   { ok: false, reason: string }
 */

import { z } from 'zod';

import { ALLOWED_REPORTS } from './prompt';

const matchedSchema = z.object({
  status: z.literal('matched'),
  reportCode: z.enum(ALLOWED_REPORTS),
  params: z.record(z.unknown()),
  rationale: z.string().min(1).max(200),
});

const refusedSchema = z.object({
  status: z.literal('refused'),
  reason: z.string().min(1).max(200),
});

const llmOutputSchema = z.discriminatedUnion('status', [matchedSchema, refusedSchema]);

export type NlReportLlmOutput = z.infer<typeof llmOutputSchema>;

export type ParseResult =
  | { ok: true; value: NlReportLlmOutput }
  | { ok: false; reason: string };

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export function parseNlReportResponse(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (err) {
    return { ok: false, reason: `Invalid JSON: ${(err as Error).message}` };
  }
  const result = llmOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    return { ok: false, reason: path ? `Schema violation at ${path}: ${issue?.message}` : `Schema violation: ${issue?.message}` };
  }
  return { ok: true, value: result.data };
}

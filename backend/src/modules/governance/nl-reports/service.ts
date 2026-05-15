/**
 * 003-nl-report-queries Task 3.5 — orchestrator.
 *
 * Sole public entry: `nlQuery(collegeId, rawQuestion, performedBy)`.
 * Composes mask + dedup + cap-guard + prompt + LLM + parse + validate +
 * runReport + persist + audit + cache. Every refusal path still
 * persists an NlReportQuery row and writes an audit log entry so the
 * stats endpoint sees a complete picture of LLM usage.
 *
 * Stats: `getNlReportStats(collegeId, range)` runs the §10.12 $facet
 * pipeline with `collegeId` as the first $match stage.
 */

import mongoose from 'mongoose';

import { createAuditLog } from '../../../shared/audit';
import { maskPII } from '../../../shared/llm/pii';
import { NlReportQuery } from '../../../models/governance/NlReportQuery';
import { createLLMClient, type LLMMessage } from '../../juvi/finance-agent/llm-client';
import { runReport } from '../report-service';

import { tryClaimNlReportSlot } from './cap-guard';
import { buildNlReportPrompt, PROMPT_VERSION, ALLOWED_REPORTS, type AllowedReportCode } from './prompt';
import { parseNlReportResponse } from './parser';
import { validateMatchedOutput } from './validator';
import { getCachedNlQuery, setCachedNlQuery } from './dedup';

const LLM_TIMEOUT_MS = 10_000;

export type NlMatchedResponse = {
  status: 'matched';
  reportCode: AllowedReportCode;
  params: Record<string, unknown>;
  runId: mongoose.Types.ObjectId | string;
  results: unknown;
  rationale: string;
  llmModel: string;
  costInr: number;
  isDuplicate?: boolean;
};

export type NlRefusedResponse = {
  status: 'refused';
  reason: string;
  supportedReports: ReadonlyArray<string>;
  llmModel: string;
  costInr: number;
  isDuplicate?: boolean;
  capReached?: boolean;
};

export type NlQueryResponse = NlMatchedResponse | NlRefusedResponse;

export interface NlQueryOpts {
  now?: Date;
}

async function callLLM(messages: LLMMessage[]): Promise<{ text: string; costInr: number; model: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
  try {
    const client = createLLMClient();
    const resp = await client.complete(messages, { abortSignal: ctrl.signal });
    return { text: resp.text, costInr: resp.costInr, model: resp.model };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function persistAndAudit(args: {
  collegeId: string;
  performedBy: string;
  maskedQuestion: string;
  now: Date;
  llmModel: string;
  costInr: number;
  response: NlQueryResponse;
}): Promise<void> {
  const { collegeId, performedBy, maskedQuestion, now, llmModel, costInr, response } = args;
  await NlReportQuery.create({
    collegeId: new mongoose.Types.ObjectId(collegeId),
    question: maskedQuestion.slice(0, 500),
    status: response.status,
    selectedReport: response.status === 'matched' ? response.reportCode : undefined,
    params: response.status === 'matched' ? response.params : undefined,
    reason: response.status === 'refused' ? response.reason : undefined,
    runId: response.status === 'matched' ? response.runId : undefined,
    performedBy,
    generatedAt: now,
    llmModel,
    promptVersion: PROMPT_VERSION,
    costInr,
    capReached: response.status === 'refused' ? response.capReached : undefined,
  });
  await createAuditLog({
    collegeId,
    entityType: 'NlReportQuery',
    entityId: response.status === 'matched' ? response.reportCode : 'refused',
    entityName: response.status === 'matched' ? response.reportCode : (response.reason || 'refused'),
    action: 'ai_nl_report_query',
    // Truncate masked question to 200 chars for the audit log (spec §10.7).
    changes: [{ field: 'question', displayName: 'NL question (masked)', oldValue: null, newValue: maskedQuestion.slice(0, 200) }],
    performedBy,
  });
}

export async function nlQuery(
  collegeId: string,
  rawQuestion: string,
  performedBy: string,
  opts: NlQueryOpts = {},
): Promise<NlQueryResponse> {
  const now = opts.now ?? new Date();

  // 1. Mask PII on the question before anything else — LLM never sees raw input.
  const { masked } = maskPII({ q: rawQuestion });
  const maskedQuestion = String((masked as { q?: string }).q ?? rawQuestion);

  // 2. 30s dedup cache lookup (Redis); miss → continue, hit → decorate + return.
  const cached = await getCachedNlQuery(collegeId, maskedQuestion);
  if (cached) {
    return { ...(cached as unknown as NlQueryResponse), isDuplicate: true };
  }

  // 3. Cap-guard claim.
  const claim = await tryClaimNlReportSlot(collegeId, now);
  if (!claim.allowed) {
    const refused: NlRefusedResponse = {
      status: 'refused',
      reason: 'cap_reached',
      supportedReports: ALLOWED_REPORTS,
      llmModel: 'n/a',
      costInr: 0,
      capReached: true,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: 'n/a', costInr: 0, response: refused });
    return refused;
  }

  // 4 + 5. Build prompt, 10s abort LLM call.
  const messages = buildNlReportPrompt({ today: now, maskedQuestion });
  const llm = await callLLM(messages);
  if (!llm) {
    const refused: NlRefusedResponse = {
      status: 'refused', reason: 'timeout', supportedReports: ALLOWED_REPORTS, llmModel: 'n/a', costInr: 0,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: 'n/a', costInr: 0, response: refused });
    return refused;
  }

  // 6. Parse + validate.
  const parsed = parseNlReportResponse(llm.text);
  if (!parsed.ok) {
    const refused: NlRefusedResponse = {
      status: 'refused', reason: parsed.reason, supportedReports: ALLOWED_REPORTS,
      llmModel: llm.model, costInr: llm.costInr,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: refused });
    return refused;
  }

  if (parsed.value.status === 'refused') {
    const refused: NlRefusedResponse = {
      status: 'refused', reason: parsed.value.reason, supportedReports: ALLOWED_REPORTS,
      llmModel: llm.model, costInr: llm.costInr,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: refused });
    await setCachedNlQuery(collegeId, maskedQuestion, refused as unknown as Record<string, unknown>);
    return refused;
  }

  // Matched — semantic validation.
  const validated = validateMatchedOutput(
    { reportCode: parsed.value.reportCode, params: parsed.value.params },
    now,
  );
  if (!validated.ok) {
    const refused: NlRefusedResponse = {
      status: 'refused', reason: validated.reason, supportedReports: ALLOWED_REPORTS,
      llmModel: llm.model, costInr: llm.costInr,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: refused });
    return refused;
  }

  // 7. runReport (4-arg, per GATE 3 M-1).
  const runDoc = await runReport(
    collegeId,
    validated.normalized.reportCode,
    validated.normalized.params,
    performedBy,
  );

  // GATE 3 M-2 — defensive: only matched if the run actually succeeded.
  if (runDoc.status !== 'success') {
    const refused: NlRefusedResponse = {
      status: 'refused', reason: 'report_run_failed', supportedReports: ALLOWED_REPORTS,
      llmModel: llm.model, costInr: llm.costInr,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: refused });
    return refused;
  }

  const matched: NlMatchedResponse = {
    status: 'matched',
    reportCode: validated.normalized.reportCode,
    params: validated.normalized.params,
    runId: runDoc._id as mongoose.Types.ObjectId,
    results: runDoc.result ?? [],
    rationale: parsed.value.rationale,
    llmModel: llm.model,
    costInr: llm.costInr,
  };

  // 8 + 9 + 10.
  await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: matched });
  await setCachedNlQuery(collegeId, maskedQuestion, matched as unknown as Record<string, unknown>);

  return matched;
}

// ─── Stats (§10.12) ────────────────────────────────────────────────

export type StatsRange = 'today' | 'week' | 'month';

export interface NlReportStats {
  range: StatsRange;
  totalQueries: number;
  matched: number;
  refused: number;
  llmCostInr: number;
  byReport: Array<{ reportCode: string; count: number; costInr: number }>;
}

export async function getNlReportStats(
  collegeId: string,
  range: StatsRange = 'today',
  now: Date = new Date(),
): Promise<NlReportStats> {
  const days = range === 'today' ? 1 : range === 'week' ? 7 : 30;
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const cidObj = new mongoose.Types.ObjectId(collegeId);

  const result = await NlReportQuery.aggregate([
    // §10.9 / §10.12 — collegeId match is the FIRST pipeline stage.
    { $match: { collegeId: cidObj, generatedAt: { $gte: since } } },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byReport: [
          { $match: { status: 'matched' } },
          { $group: { _id: '$selectedReport', count: { $sum: 1 }, costInr: { $sum: '$costInr' } } },
        ],
        total: [{ $group: { _id: null, totalQueries: { $sum: 1 }, llmCostInr: { $sum: '$costInr' } } }],
      },
    },
  ]);

  const facet = result[0] ?? { byStatus: [], byReport: [], total: [] };
  const statusCounts = new Map<string, number>(facet.byStatus.map((r: { _id: string; count: number }) => [r._id, r.count]));
  const total = facet.total[0] ?? { totalQueries: 0, llmCostInr: 0 };

  return {
    range,
    totalQueries: total.totalQueries,
    matched: statusCounts.get('matched') ?? 0,
    refused: statusCounts.get('refused') ?? 0,
    llmCostInr: total.llmCostInr,
    byReport: facet.byReport.map((r: { _id: string; count: number; costInr: number }) => ({
      reportCode: r._id,
      count: r.count,
      costInr: r.costInr,
    })),
  };
}

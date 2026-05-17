/**
 * 003-nl-report-queries Task 3.5 — orchestrator.
 * 004-rbac-nl-queries §3 — authScope threading, scope-fingerprint dedup,
 *    eligibility-refusal sub-categories, byRole stats.
 *
 * Sole public entry: `nlQuery(collegeId, rawQuestion, performedBy, opts)`.
 * Composes mask + dedup + cap-guard + prompt + LLM + parse + validate +
 * runReport + persist + audit + cache. Every refusal path still persists
 * an NlReportQuery row and writes an audit log entry so the stats endpoint
 * sees a complete picture of LLM usage.
 *
 * Stats: `getNlReportStats(collegeId, range)` runs the §10.12 $facet
 * pipeline with `collegeId` as the first $match stage and now includes
 * a `byRole` facet that excludes pre-004 docs (where `role` is undefined).
 */

import mongoose from 'mongoose';

import { createAuditLog } from '../../../shared/audit';
import { maskPII } from '../../../shared/llm/pii';
import { NlReportQuery } from '../../../models/governance/NlReportQuery';
import { createLLMClient, type LLMMessage } from '../../juvi/finance-agent/llm-client';
import {
  runReport,
  ADMIN_FULL_SCOPE,
  ScopeNotSupportedError,
} from '../report-service';
import { REPORT_REGISTRY } from '../report-registry';
import type { AuthScope } from '../../../shared/rbac/types';

import { tryClaimNlReportSlot } from './cap-guard';
import { buildNlReportPrompt, PROMPT_VERSION, ALLOWED_REPORTS, type AllowedReportCode } from './prompt';
import { parseNlReportResponse } from './parser';
import { validateMatchedOutput } from './validator';
import { getCachedNlQuery, setCachedNlQuery, type DedupContext } from './dedup';

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
  /** 004 §10.7 — sub-categorizes `report-not-scopable-for-role` and `scope-unresolved` so the FE can render the right banner copy. */
  reasonDimension?: 'department' | 'self';
  supportedReports: ReadonlyArray<string>;
  llmModel: string;
  costInr: number;
  isDuplicate?: boolean;
  capReached?: boolean;
};

export type NlQueryResponse = NlMatchedResponse | NlRefusedResponse;

export interface NlQueryOpts {
  /** 004 §3 — per-request scope. Defaults to `ADMIN_FULL_SCOPE` so existing
   *  admin-gated callers (the requireRole-only path when `RBAC_NL_ENFORCE !== 'true'`)
   *  don't need to change. After the wrapper middleware (§10.6) flips
   *  `RBAC_NL_ENFORCE='true'`, the controller passes `req.authScope` here. */
  authScope?: AuthScope;
  /** Persisted on `NlReportQuery` for `byRole` stats (§10.5). */
  role?: string;
  personaType?: string;
  now?: Date;
}

/**
 * 004 §3 — compute the persona-eligible report subset.
 *
 * For each report in the allowed list, ask: does the persona's
 * `authScope` (departmentOnly / selfOnly) satisfy the report's
 * `scopeEligibility`? Admin paths (both flags false) get the full list.
 * HOD (departmentOnly) gets only reports declaring departmentOnly:
 * 'supported'. Counsellor (selfOnly) gets only selfOnly: 'supported'.
 */
export function supportedReportsFor(authScope: AuthScope): ReadonlyArray<string> {
  return ALLOWED_REPORTS.filter((code) => {
    const def = REPORT_REGISTRY.find((d) => d.code === code);
    if (!def) return false;
    if (authScope.departmentOnly && def.scopeEligibility.departmentOnly === 'admin-only') return false;
    if (authScope.selfOnly && def.scopeEligibility.selfOnly === 'admin-only') return false;
    return true;
  });
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
  authScope: AuthScope;
  role?: string;
  personaType?: string;
}): Promise<void> {
  const { collegeId, performedBy, maskedQuestion, now, llmModel, costInr, response, authScope, role, personaType } = args;
  await NlReportQuery.create({
    collegeId: new mongoose.Types.ObjectId(collegeId),
    question: maskedQuestion.slice(0, 500),
    status: response.status,
    selectedReport: response.status === 'matched' ? response.reportCode : undefined,
    params: response.status === 'matched' ? response.params : undefined,
    reason: response.status === 'refused' ? response.reason : undefined,
    reasonDimension: response.status === 'refused' ? response.reasonDimension : undefined,
    runId: response.status === 'matched' ? response.runId : undefined,
    performedBy,
    generatedAt: now,
    llmModel,
    promptVersion: PROMPT_VERSION,
    costInr,
    capReached: response.status === 'refused' ? response.capReached : undefined,
    // 004 §10.5 — RBAC observability fields.
    role,
    personaType,
    authScopeApplied: {
      departmentOnly: authScope.departmentOnly,
      selfOnly: authScope.selfOnly,
      departmentId: authScope.departmentId,
      personId: authScope.personId,
      userId: authScope.userId,
    },
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
  const authScope: AuthScope = opts.authScope ?? ADMIN_FULL_SCOPE;
  const role = opts.role;
  const personaType = opts.personaType;
  const supportedReports = supportedReportsFor(authScope);
  const dedupCtx: DedupContext = { role, personaType, authScope };

  // 1. Mask PII on the question before anything else — LLM never sees raw input.
  const { masked } = maskPII({ q: rawQuestion });
  const maskedQuestion = String((masked as { q?: string }).q ?? rawQuestion);

  // 2. 30s dedup cache lookup (Redis, scope-fingerprinted per 004 §10.4).
  const cached = await getCachedNlQuery(collegeId, dedupCtx, maskedQuestion);
  if (cached) {
    return { ...(cached as unknown as NlQueryResponse), isDuplicate: true };
  }

  // 3. Cap-guard claim.
  const claim = await tryClaimNlReportSlot(collegeId, now);
  if (!claim.allowed) {
    const refused: NlRefusedResponse = {
      status: 'refused',
      reason: 'cap_reached',
      supportedReports,
      llmModel: 'n/a',
      costInr: 0,
      capReached: true,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: 'n/a', costInr: 0, response: refused, authScope, role, personaType });
    return refused;
  }

  // 4 + 5. Build prompt, 10s abort LLM call.
  const messages = buildNlReportPrompt({ today: now, maskedQuestion });
  const llm = await callLLM(messages);
  if (!llm) {
    const refused: NlRefusedResponse = {
      status: 'refused', reason: 'timeout', supportedReports, llmModel: 'n/a', costInr: 0,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: 'n/a', costInr: 0, response: refused, authScope, role, personaType });
    return refused;
  }

  // 6. Parse + validate.
  const parsed = parseNlReportResponse(llm.text);
  if (!parsed.ok) {
    const refused: NlRefusedResponse = {
      status: 'refused', reason: parsed.reason, supportedReports,
      llmModel: llm.model, costInr: llm.costInr,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: refused, authScope, role, personaType });
    return refused;
  }

  if (parsed.value.status === 'refused') {
    const refused: NlRefusedResponse = {
      status: 'refused', reason: parsed.value.reason, supportedReports,
      llmModel: llm.model, costInr: llm.costInr,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: refused, authScope, role, personaType });
    await setCachedNlQuery(collegeId, dedupCtx, maskedQuestion, refused as unknown as Record<string, unknown>);
    return refused;
  }

  // Matched — semantic validation.
  const validated = validateMatchedOutput(
    { reportCode: parsed.value.reportCode, params: parsed.value.params },
    now,
  );
  if (!validated.ok) {
    const refused: NlRefusedResponse = {
      status: 'refused', reason: validated.reason, supportedReports,
      llmModel: llm.model, costInr: llm.costInr,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: refused, authScope, role, personaType });
    return refused;
  }

  // 7. runReport — pass through the authScope. 004 §10.10 eligibility gate
  // refuses inside runReport BEFORE side effects; we catch the typed error
  // and convert to a refused response.
  let runDoc;
  try {
    runDoc = await runReport(
      collegeId,
      validated.normalized.reportCode,
      validated.normalized.params,
      performedBy,
      authScope,
    );
  } catch (err) {
    if (err instanceof ScopeNotSupportedError) {
      const refused: NlRefusedResponse = {
        status: 'refused',
        reason: err.kind === 'scope-unresolved' ? 'scope-unresolved' : 'report-not-scopable-for-role',
        reasonDimension: err.dimension,
        supportedReports,
        llmModel: llm.model, costInr: llm.costInr,
      };
      await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: refused, authScope, role, personaType });
      await setCachedNlQuery(collegeId, dedupCtx, maskedQuestion, refused as unknown as Record<string, unknown>);
      return refused;
    }
    throw err;
  }

  // GATE 3 M-2 — defensive: only matched if the run actually succeeded.
  if (runDoc.status !== 'success') {
    const refused: NlRefusedResponse = {
      status: 'refused', reason: 'report_run_failed', supportedReports,
      llmModel: llm.model, costInr: llm.costInr,
    };
    await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: refused, authScope, role, personaType });
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
  await persistAndAudit({ collegeId, performedBy, maskedQuestion, now, llmModel: llm.model, costInr: llm.costInr, response: matched, authScope, role, personaType });
  await setCachedNlQuery(collegeId, dedupCtx, maskedQuestion, matched as unknown as Record<string, unknown>);

  return matched;
}

// ─── Stats (§10.12 + 004 §10.5) ────────────────────────────────────

export type StatsRange = 'today' | 'week' | 'month';

export interface NlReportStats {
  range: StatsRange;
  totalQueries: number;
  matched: number;
  refused: number;
  llmCostInr: number;
  byReport: Array<{ reportCode: string; count: number; costInr: number }>;
  /** 004 §10.5 — persona breakdown. Excludes pre-004 docs where `role` is undefined. */
  byRole: Array<{ role: string; count: number; costInr: number }>;
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
        // 004 §10.5 — byRole excludes legacy docs (role: undefined) so the
        // declared `role: string` type holds; other facets still count
        // legacy docs.
        byRole: [
          { $match: { role: { $exists: true } } },
          { $group: { _id: '$role', count: { $sum: 1 }, costInr: { $sum: '$costInr' } } },
        ],
        total: [{ $group: { _id: null, totalQueries: { $sum: 1 }, llmCostInr: { $sum: '$costInr' } } }],
      },
    },
  ]);

  const facet = result[0] ?? { byStatus: [], byReport: [], byRole: [], total: [] };
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
    byRole: (facet.byRole ?? []).map((r: { _id: string; count: number; costInr: number }) => ({
      role: r._id,
      count: r.count,
      costInr: r.costInr,
    })),
  };
}

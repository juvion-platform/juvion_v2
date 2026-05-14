/**
 * Lead-scoring orchestrator.
 *
 * Single entry point: `scoreInquiry(collegeId, inquiryId, performedBy, opts)`.
 * Composes rule scorer + cap-guard + LLM scorer + blender + persistence +
 * audit + stats + assignment-rule re-evaluation.
 *
 * Spec: `.sdd/specs/001-ai-lead-scoring/spec.md` §10 (mostly §10.6–10.11).
 *
 * Multi-tenant: every read filters by collegeId; cap-guard key carries
 * collegeId; stats upsert keys by collegeId.
 */

import { AppError } from '../../../middleware/errorHandler';
import { createAuditLog } from '../../../shared/audit';
import { Inquiry, type ScoreRationale } from '../../../models/admissions/Inquiry';
import { LeadInteraction } from '../../../models/admissions/LeadInteraction';
import { LeadScoringStats } from '../../../models/admissions/LeadScoringStats';
import { maskPII } from '../../../shared/llm/pii';

import { computeRuleScore, type InteractionInput } from './rule-scorer';
import { blend } from './blender';
import { deriveLeadGrade } from './grade';
import { tryClaimLLMSlot } from './cap-guard';
import { buildLeadScoringPrompt, PROMPT_VERSION, type MaskedInteraction } from './prompt';
import { computeLLMScore } from './llm-scorer';
import { applyAssignmentRules } from '../service';

export interface ScoreInquiryOptions {
  trigger: 'create' | 'interaction' | 'manual' | 'batch';
  /** If true, skip cap check (used for high-priority manual rescore). */
  forceLlm?: boolean;
  /** Injectable clock for tests. */
  now?: Date;
}

export interface ScoreInquiryResult {
  skipped?: boolean;
  skipReason?: 'debounce';
  rationale?: ScoreRationale;
  blendedScore?: number;
  leadGrade?: string;
}

const DEBOUNCE_MS = 60_000; // spec §10.6
const MODEL_BASE_TAG = 'rules-v1';
const DAY_MS = 24 * 60 * 60 * 1000;

function readDailyCap(): number {
  const raw = process.env.LEAD_SCORE_DAILY_LLM_CAP;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 500;
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export async function scoreInquiry(
  collegeId: string,
  inquiryId: string,
  performedBy: string,
  opts: ScoreInquiryOptions,
): Promise<ScoreInquiryResult> {
  const now = opts.now ?? new Date();

  const inquiry = await Inquiry.findOne({ _id: inquiryId, collegeId });
  if (!inquiry) throw new AppError(404, 'Inquiry not found');

  // 1. Debounce
  if (inquiry.lastScoredAt && now.getTime() - inquiry.lastScoredAt.getTime() < DEBOUNCE_MS) {
    return { skipped: true, skipReason: 'debounce' };
  }

  // 2. Pull recent interactions for the rule + LLM contexts
  const recent = await LeadInteraction.find({ collegeId, inquiryId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const ruleInteractions: InteractionInput[] = recent.map((r) => ({
    type: r.type,
    outcome: r.outcome,
    createdAt: (r as typeof r & { createdAt?: Date }).createdAt ?? now,
  }));

  // 3. Rule component
  const ruleResult = computeRuleScore(
    {
      source: inquiry.source,
      interPercentage: inquiry.interPercentage,
      programmeInterest: inquiry.programmeInterest,
      branchInterest: inquiry.branchInterest,
      utmCampaign: inquiry.utmCampaign,
    },
    ruleInteractions,
    now,
  );

  // 4. Cap-guard claim (skip if forceLlm overrides)
  let llmScore: number | null = null;
  let llmFactors: ScoreRationale['factors'] = [];
  let llmCostInr: number | undefined;
  let llmSkipped = false;
  let llmFallback = false;
  let capHit = false;

  const cap = readDailyCap();
  const claim = opts.forceLlm
    ? { allowed: true, count: 0, cap }
    : await tryClaimLLMSlot(collegeId, cap, now);

  if (!claim.allowed) {
    llmSkipped = true;
    capHit = !claim.error; // distinguishes "over cap" from "redis down"
  } else {
    // 5. Build prompt with masked PII context.
    //    Project to scoring-relevant fields only — drop name + raw IDs.
    const maskedInq = maskPII({
      phone: inquiry.phone,
      email: inquiry.email,
      source: inquiry.source,
      interStream: inquiry.interStream,
      interPercentage: inquiry.interPercentage,
      programmeInterest: inquiry.programmeInterest,
      branchInterest: inquiry.branchInterest,
      utmCampaign: inquiry.utmCampaign,
      mqlSqlClassification: inquiry.mqlSqlClassification,
    }).masked;

    const maskedInteractions: MaskedInteraction[] = recent.map((r) => ({
      type: r.type,
      outcome: r.outcome,
      summary: r.summary,
      daysAgo: Math.floor((now.getTime() - ((r as typeof r & { createdAt?: Date }).createdAt?.getTime() ?? now.getTime())) / DAY_MS),
    }));

    const messages = buildLeadScoringPrompt({ today: now, maskedInquiry: maskedInq, maskedInteractions });
    const llm = await computeLLMScore(messages);
    if (llm) {
      llmScore = llm.score;
      llmFactors = llm.factors;
      llmCostInr = llm.costInr;
    } else {
      llmFallback = true;
    }
  }

  // 6. Blend
  const { blendedScore, usedLlm } = blend({ ruleScore: ruleResult.score, llmScore });
  const leadGrade = deriveLeadGrade(blendedScore);

  const rationale: ScoreRationale = {
    ruleScore: ruleResult.score,
    llmScore,
    blendedScore,
    factors: [...ruleResult.factors, ...llmFactors],
    llmSkipped,
    llmFallback,
    llmCostInr,
    computedAt: now,
    modelVersion: usedLlm ? `${MODEL_BASE_TAG}+${PROMPT_VERSION}` : MODEL_BASE_TAG,
  };

  // 7. Persist Inquiry atomically
  await Inquiry.updateOne(
    { _id: inquiryId, collegeId },
    {
      $set: {
        leadScore: blendedScore,
        leadGrade,
        scoreRationale: rationale,
        lastScoredAt: now,
      },
    },
  );

  // 8. Audit log
  await createAuditLog({
    collegeId,
    entityType: 'Inquiry',
    entityId: String(inquiry._id),
    entityName: inquiry.name,
    action: 'ai_score_computed',
    changes: [
      { field: 'leadScore', displayName: 'Lead score', oldValue: inquiry.leadScore, newValue: blendedScore },
      { field: 'leadGrade', displayName: 'Lead grade', oldValue: inquiry.leadGrade, newValue: leadGrade },
    ],
    performedBy,
  });

  // 9. Stats upsert (per spec §10.3)
  await LeadScoringStats.updateOne(
    { collegeId, date: startOfUtcDay(now) },
    {
      $inc: {
        totalScored: 1,
        llmScored: usedLlm ? 1 : 0,
        rulesOnlyScored: usedLlm ? 0 : 1,
        totalLlmCostInr: llmCostInr ?? 0,
        [`gradeDistribution.${leadGrade ?? 'dormant'}`]: 1,
      },
      $set: {
        modelVersion: rationale.modelVersion,
        ...(capHit ? { llmCapHit: true } : {}),
      },
    },
    { upsert: true },
  );

  // 10. Re-evaluate assignment rules with the fresh score/grade.
  //     Best-effort: rule eval failures shouldn't unwind the score.
  if (!inquiry.assignedOfficerId) {
    try {
      const matched = await applyAssignmentRules(collegeId, {
        ...inquiry.toObject(),
        leadScore: blendedScore,
        leadGrade,
      });
      if (matched) {
        await Inquiry.updateOne(
          { _id: inquiryId, collegeId },
          {
            $set: {
              assignedOfficerId: matched.assignedOfficerId,
              clusterHeadId: matched.clusterHeadId,
              assignedByRuleId: matched._id,
            },
          },
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[lead-scoring] post-score rule eval failed (inquiry=${inquiryId}):`, (err as Error).message);
    }
  }

  return { rationale, blendedScore, leadGrade };
}

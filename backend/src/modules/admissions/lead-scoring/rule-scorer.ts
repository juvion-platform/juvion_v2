/**
 * Rule-based lead scorer.
 *
 * Pure function. Takes a thin Inquiry projection + recent LeadInteractions
 * and returns a 0–100 score with the factor breakdown that drove it.
 *
 * Spec: `.sdd/specs/001-ai-lead-scoring/spec.md` §3 ("Rule component").
 *
 * Inputs are plain objects (not Mongoose docs) so the scorer is trivially
 * unit-testable and reusable from the LLM-prompt path too.
 */

export interface InquiryInput {
  source: string;
  interPercentage?: number;
  programmeInterest?: string;
  branchInterest?: string;
  utmCampaign?: string;
}

export interface InteractionInput {
  type: string;
  outcome?: string;
  createdAt: Date;
}

export interface ScoreFactor {
  label: string;
  weight: number;
  source: 'rule' | 'llm';
}

export interface RuleScoreResult {
  score: number;
  factors: ScoreFactor[];
}

const SOURCE_WEIGHTS: Record<string, number> = {
  'walk-in': 25,
  referral: 20,
  education_fair: 18,
  phone: 14,
  website: 12,
  whatsapp: 12,
  social_media: 10,
  newspaper: 6,
};

const POSITIVE_OUTCOMES = new Set(['interested', 'visit_scheduled', 'converted', 'callback_requested']);
const NEGATIVE_OUTCOMES = new Set(['not_interested']);

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeRuleScore(
  inquiry: InquiryInput,
  interactions: InteractionInput[],
  now: Date = new Date(),
): RuleScoreResult {
  const factors: ScoreFactor[] = [];

  // 1. Source quality
  const sourceWeight = SOURCE_WEIGHTS[inquiry.source] ?? 8; // unknown source → small credit
  factors.push({ label: `Source: ${inquiry.source}`, weight: sourceWeight, source: 'rule' });

  // 2. Academic fit (interPercentage)
  if (typeof inquiry.interPercentage === 'number') {
    let academicWeight = 2;
    if (inquiry.interPercentage >= 80) academicWeight = 18;
    else if (inquiry.interPercentage >= 60) academicWeight = 10;
    factors.push({ label: `Inter ${inquiry.interPercentage}%`, weight: academicWeight, source: 'rule' });
  }

  // 3. Programme/branch interest
  if (inquiry.programmeInterest || inquiry.branchInterest) {
    factors.push({ label: 'Programme/branch interest specified', weight: 10, source: 'rule' });
  }

  // 4. Paid traffic
  if (inquiry.utmCampaign) {
    factors.push({ label: `Paid traffic (${inquiry.utmCampaign})`, weight: 6, source: 'rule' });
  }

  // 5. Interaction count tier
  const ic = interactions.length;
  if (ic >= 4) factors.push({ label: 'Interactions: 4+', weight: 18, source: 'rule' });
  else if (ic >= 2) factors.push({ label: `Interactions: ${ic}`, weight: 12, source: 'rule' });
  else if (ic === 1) factors.push({ label: 'First interaction logged', weight: 6, source: 'rule' });

  // 6. Recency + last-outcome signal — look at the freshest interaction.
  const last = interactions
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  if (last) {
    const ageMs = now.getTime() - last.createdAt.getTime();
    if (ageMs < DAY_MS) factors.push({ label: 'Last contact <24h', weight: 10, source: 'rule' });
    else if (ageMs < 7 * DAY_MS) factors.push({ label: 'Last contact <7d', weight: 6, source: 'rule' });
    else if (ageMs < 30 * DAY_MS) factors.push({ label: 'Last contact <30d', weight: 2, source: 'rule' });
    else factors.push({ label: 'Dormant (no contact in 30d)', weight: -20, source: 'rule' });

    if (last.outcome && POSITIVE_OUTCOMES.has(last.outcome)) {
      factors.push({ label: `Positive last outcome: ${last.outcome}`, weight: 15, source: 'rule' });
    } else if (last.outcome && NEGATIVE_OUTCOMES.has(last.outcome)) {
      factors.push({ label: `Negative last outcome: ${last.outcome}`, weight: -20, source: 'rule' });
    }
  }

  const raw = factors.reduce((acc, f) => acc + f.weight, 0);
  const score = clamp(Math.round(raw), 0, 100);
  return { score, factors };
}

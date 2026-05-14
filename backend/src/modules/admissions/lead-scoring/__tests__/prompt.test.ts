import { describe, it, expect } from 'vitest';

import { buildLeadScoringPrompt, PROMPT_VERSION } from '../prompt';
import { maskPII } from '../../../../shared/llm/pii';

/**
 * 001-ai-lead-scoring — Task 2.4
 * Prompt builder for the LLM scoring call. Asserts:
 *   - the prompt always carries the system + user pair
 *   - PII tokens (not raw values) appear in the user content
 *   - the system role contains the JSON-schema instruction
 *   - PROMPT_VERSION is exported (used in scoreRationale.modelVersion)
 */

describe('buildLeadScoringPrompt', () => {
  const today = new Date('2026-05-14T10:00:00Z');

  // Note: the orchestration service (Wave 3) is responsible for projecting
  // the inquiry to scoring-relevant fields BEFORE masking. The prompt
  // builder trusts its input is already filtered + masked. `name` is
  // intentionally excluded from the projection — it carries no signal
  // and the shared masker doesn't mask top-level name by design.
  const baseMasked = () => maskPII({
    phone: '+91-9999988888',
    email: 'ramesh@example.com',
    source: 'walk-in',
    interStream: 'MPC',
    interPercentage: 82,
    programmeInterest: 'B.Tech CSE',
  });

  it('returns a [system, user] pair', () => {
    const { masked } = baseMasked();
    const msgs = buildLeadScoringPrompt({
      today,
      maskedInquiry: masked,
      maskedInteractions: [],
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe('system');
    expect(msgs[1]!.role).toBe('user');
  });

  it('embeds masked PII tokens (not raw values) in the user content', () => {
    const { masked, tokenMap } = baseMasked();
    const msgs = buildLeadScoringPrompt({
      today,
      maskedInquiry: masked,
      maskedInteractions: [],
    });
    const user = msgs[1]!.content;
    expect(user).not.toContain('+91-9999988888');
    expect(user).not.toContain('ramesh@example.com');
    // Tokens must round-trip via the masker; the user prompt should
    // reference at least one PII token from the map.
    const tokens = Object.keys(tokenMap);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.some((t) => user.includes(t))).toBe(true);
  });

  it('instructs the model to return ONLY a JSON object with score/factors/summary', () => {
    const { masked } = baseMasked();
    const sys = buildLeadScoringPrompt({
      today,
      maskedInquiry: masked,
      maskedInteractions: [],
    })[0]!.content;
    // Defense-in-depth: explicit JSON-only marker, mention each top-level key.
    expect(sys).toMatch(/JSON/i);
    expect(sys).toMatch(/score/);
    expect(sys).toMatch(/factors/);
    expect(sys).toMatch(/summary/);
    expect(sys).toMatch(/0-100|0 to 100|0–100/);
  });

  it('exports a stable PROMPT_VERSION for scoreRationale traceability', () => {
    expect(typeof PROMPT_VERSION).toBe('string');
    expect(PROMPT_VERSION.length).toBeGreaterThan(0);
    expect(PROMPT_VERSION).toMatch(/v\d/);
  });

  it('includes interaction history in the prompt when provided', () => {
    const { masked } = baseMasked();
    const msgs = buildLeadScoringPrompt({
      today,
      maskedInquiry: masked,
      maskedInteractions: [
        { type: 'phone_call', outcome: 'interested', summary: 'Asked about CSE seats', daysAgo: 1 },
        { type: 'whatsapp', outcome: 'visit_scheduled', summary: 'Scheduled campus visit', daysAgo: 0 },
      ],
    });
    const user = msgs[1]!.content;
    expect(user).toMatch(/visit_scheduled|Scheduled campus visit/);
    expect(user).toMatch(/interested|Asked about CSE seats/);
  });
});

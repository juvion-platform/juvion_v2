import { describe, it, expect } from 'vitest';

import { buildConfigSuggestPrompt, PROMPT_VERSION } from '../prompt';
import type { ConfigSchema } from '../../config-registry';

/**
 * 002-ai-assisted-config Task 3.0 — prompt builder.
 *
 * Asserts:
 *  - returns a [system, user] LLMMessage pair
 *  - PROMPT_VERSION is exported and stable (used in scoreRationale.modelVersion-equiv)
 *  - the user content embeds the masked context (not raw values)
 *  - the system content carries the JSON-only schema instruction with the
 *    exact top-level keys we'll parse
 *  - the user content lists the schema fields we want suggestions for
 */

const fakeSchema: ConfigSchema = {
  type: 'institution-feature-flags',
  label: 'Institution Feature Flags',
  description: 'Top-level feature toggles for the college.',
  cardinality: 'single',
  fields: [
    { key: 'enableEmail', label: 'Email enabled', type: 'boolean', default: false },
    { key: 'enableSMS', label: 'SMS enabled', type: 'boolean', default: false },
    // a field that should NOT appear in the prompt — aiSuggestable false
    { key: 'integrationToken', label: 'Integration token', type: 'string', aiSuggestable: false },
  ],
};

describe('buildConfigSuggestPrompt', () => {
  const today = new Date('2026-05-14T10:00:00Z');

  it('returns a [system, user] pair', () => {
    const msgs = buildConfigSuggestPrompt({
      today,
      schema: fakeSchema,
      maskedContext: { collegeProfile: { name: 'Demo College' }, currentValues: {} },
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe('system');
    expect(msgs[1]!.role).toBe('user');
  });

  it('system content pins the JSON-only output schema (suggestions, field, value, confidence, rationale)', () => {
    const msgs = buildConfigSuggestPrompt({
      today, schema: fakeSchema,
      maskedContext: { collegeProfile: {}, currentValues: {} },
    });
    const sys = msgs[0]!.content;
    expect(sys).toMatch(/JSON/i);
    expect(sys).toMatch(/suggestions/);
    expect(sys).toMatch(/field/);
    expect(sys).toMatch(/value/);
    expect(sys).toMatch(/confidence/);
    expect(sys).toMatch(/rationale/);
    // Confidence range hint
    expect(sys).toMatch(/0[\s\S]?(\.|\s).*1/);
  });

  it('user content lists only aiSuggestable fields (drops fields with aiSuggestable: false)', () => {
    const msgs = buildConfigSuggestPrompt({
      today, schema: fakeSchema,
      maskedContext: { collegeProfile: {}, currentValues: {} },
    });
    const user = msgs[1]!.content;
    expect(user).toContain('enableEmail');
    expect(user).toContain('enableSMS');
    // The non-suggestable field MUST NOT leak into the LLM context.
    expect(user).not.toContain('integrationToken');
  });

  it('user content embeds the masked context verbatim', () => {
    const msgs = buildConfigSuggestPrompt({
      today, schema: fakeSchema,
      maskedContext: {
        collegeProfile: { name: 'St. Demo College', yearFounded: 1998 },
        currentValues: { enableEmail: true },
      },
    });
    const user = msgs[1]!.content;
    expect(user).toContain('St. Demo College');
    expect(user).toContain('1998');
    // enableEmail = true must be visible so the LLM doesn't re-suggest the same value
    expect(user).toContain('"enableEmail"');
    expect(user).toContain('true');
  });

  it('includes the today date so relative-time reasoning is grounded', () => {
    const msgs = buildConfigSuggestPrompt({
      today, schema: fakeSchema, maskedContext: { collegeProfile: {}, currentValues: {} },
    });
    expect(msgs[1]!.content).toContain('2026-05-14');
  });

  it('exports a stable PROMPT_VERSION', () => {
    expect(typeof PROMPT_VERSION).toBe('string');
    expect(PROMPT_VERSION).toMatch(/v\d/);
  });
});

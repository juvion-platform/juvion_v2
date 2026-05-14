import { describe, it, expect } from 'vitest';

import { parseConfigSuggestions } from '../parser';
import type { ConfigSchema } from '../../config-registry';

/**
 * 002-ai-assisted-config Task 3.1 — strict JSON parser.
 *
 * Responsibilities:
 *  - Parse the LLM response (JSON, possibly fenced).
 *  - Validate each suggestion against the live registered schema:
 *      type matches field type (boolean / number / string / select option)
 *      field key exists in the schema (drop unknown keys)
 *      confidence is in [0, 1]
 *  - Return { valid, invalid } so the orchestrator can log a metric
 *    on dropped suggestions without surfacing them to the user.
 */

const schema: ConfigSchema = {
  type: 'institution-feature-flags',
  label: 'Institution Feature Flags',
  description: 'Top-level feature toggles for the college.',
  cardinality: 'single',
  fields: [
    { key: 'enableEmail', label: 'Email enabled', type: 'boolean' },
    { key: 'enableSMS', label: 'SMS enabled', type: 'boolean' },
    { key: 'maxFollowUps', label: 'Max follow-ups', type: 'number' },
    { key: 'tone', label: 'Tone', type: 'select', options: [
      { value: 'formal', label: 'Formal' },
      { value: 'casual', label: 'Casual' },
    ] },
    { key: 'integrationToken', label: 'Token', type: 'string', aiSuggestable: false },
  ],
};

describe('parseConfigSuggestions', () => {
  it('parses a well-formed JSON object with one valid suggestion', () => {
    const raw = JSON.stringify({
      suggestions: [
        { field: 'enableEmail', value: true, confidence: 0.85, rationale: 'Most colleges enable email.' },
      ],
    });
    const r = parseConfigSuggestions(raw, schema);
    expect(r.valid).toHaveLength(1);
    expect(r.invalid).toHaveLength(0);
    expect(r.valid[0]).toMatchObject({
      field: 'enableEmail',
      suggestedValue: true,
      confidence: 0.85,
    });
  });

  it('strips ```json fences and parses', () => {
    const raw = '```json\n{ "suggestions": [{ "field": "enableEmail", "value": true, "confidence": 0.7, "rationale": "r" }] }\n```';
    const r = parseConfigSuggestions(raw, schema);
    expect(r.valid).toHaveLength(1);
  });

  it('returns empty result on malformed JSON', () => {
    const r = parseConfigSuggestions('not json at all', schema);
    expect(r.valid).toHaveLength(0);
    expect(r.invalid).toHaveLength(0); // not even structurally parseable
    expect(r.parseError).toBeDefined();
  });

  it('drops a suggestion when the field key is unknown', () => {
    const raw = JSON.stringify({
      suggestions: [
        { field: 'nonexistent', value: 'x', confidence: 0.8, rationale: 'r' },
        { field: 'enableEmail', value: true, confidence: 0.8, rationale: 'r' },
      ],
    });
    const r = parseConfigSuggestions(raw, schema);
    expect(r.valid.map((v) => v.field)).toEqual(['enableEmail']);
    expect(r.invalid.map((i) => i.field)).toEqual(['nonexistent']);
    expect(r.invalid[0]!.reason).toMatch(/unknown field/i);
  });

  it('drops a suggestion that targets a non-aiSuggestable field', () => {
    const raw = JSON.stringify({
      suggestions: [
        { field: 'integrationToken', value: 'sk-leaked', confidence: 0.99, rationale: 'r' },
      ],
    });
    const r = parseConfigSuggestions(raw, schema);
    expect(r.valid).toHaveLength(0);
    expect(r.invalid).toHaveLength(1);
    expect(r.invalid[0]!.reason).toMatch(/not suggestable/i);
  });

  it('drops a suggestion whose value type does not match the field type', () => {
    const raw = JSON.stringify({
      suggestions: [
        { field: 'enableEmail', value: 'yes', confidence: 0.8, rationale: 'r' },  // wrong type
        { field: 'maxFollowUps', value: 'three', confidence: 0.8, rationale: 'r' }, // wrong type
        { field: 'tone', value: 'aggressive', confidence: 0.8, rationale: 'r' }, // not in options
      ],
    });
    const r = parseConfigSuggestions(raw, schema);
    expect(r.valid).toHaveLength(0);
    expect(r.invalid).toHaveLength(3);
  });

  it('coerces stringy booleans/numbers (matches validateAgainstSchema behaviour)', () => {
    const raw = JSON.stringify({
      suggestions: [
        { field: 'enableEmail', value: 'true', confidence: 0.8, rationale: 'r' },
        { field: 'maxFollowUps', value: '5', confidence: 0.8, rationale: 'r' },
      ],
    });
    const r = parseConfigSuggestions(raw, schema);
    expect(r.valid).toHaveLength(2);
    expect(r.valid[0]!.suggestedValue).toBe(true);
    expect(r.valid[1]!.suggestedValue).toBe(5);
  });

  it('drops suggestions with confidence outside [0,1] or below the 0.6 floor', () => {
    const raw = JSON.stringify({
      suggestions: [
        { field: 'enableEmail', value: true, confidence: 1.5, rationale: 'r' },
        { field: 'enableSMS', value: true, confidence: 0.4, rationale: 'r' },
      ],
    });
    const r = parseConfigSuggestions(raw, schema);
    expect(r.valid).toHaveLength(0);
    expect(r.invalid).toHaveLength(2);
  });

  it('drops suggestions missing required keys (field/value/confidence/rationale)', () => {
    const raw = JSON.stringify({
      suggestions: [
        { field: 'enableEmail', value: true, confidence: 0.8 }, // no rationale
        { value: true, confidence: 0.8, rationale: 'r' }, // no field
      ],
    });
    const r = parseConfigSuggestions(raw, schema);
    expect(r.valid).toHaveLength(0);
    expect(r.invalid).toHaveLength(2);
  });
});

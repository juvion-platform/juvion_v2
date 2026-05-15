/**
 * Config-suggest LLM prompt builder.
 *
 * Returns a [system, user] message pair for the Juvi LLM client. The user
 * content carries:
 *   - the today date (so relative time hints can be resolved)
 *   - a JSON snapshot of the schema fields the LLM is allowed to suggest
 *     for (any field with aiSuggestable: false is stripped BEFORE the
 *     prompt is built — defense in depth per spec §10.7)
 *   - the already-masked college profile + current values
 *
 * The system content pins the JSON-only output contract.
 *
 * Spec: `.sdd/specs/002-ai-assisted-config/spec.md` §3, §10.7.
 */

import type { LLMMessage } from '../../juvi/finance-agent/llm-client';
import type { ConfigSchema, ConfigField } from '../config-registry';

export const PROMPT_VERSION = 'config-suggest-prompt-v1';

export interface MaskedContext {
  collegeProfile: Record<string, unknown>;
  currentValues: Record<string, unknown>;
}

export interface ConfigSuggestPromptInput {
  today: Date;
  schema: ConfigSchema;
  maskedContext: MaskedContext;
}

function systemPrompt(): string {
  return [
    'You are the Juvion Config Advisor for an Indian college admin. You suggest',
    'sensible default values for schema-driven platform configs based on the',
    'college profile and any values the admin already has.',
    '',
    'Output ONLY a single JSON object. No prose, no markdown fences, no commentary.',
    'The object MUST have exactly this shape:',
    '{',
    '  "suggestions": [',
    '    { "field": "<schema field key>", "value": <typed value>, "confidence": <0..1>, "rationale": "<one sentence>" }',
    '  ]',
    '}',
    '',
    'Guidelines:',
    '- Suggest at most one value per field; omit fields you are unsure about.',
    '- Confidence below 0.6 should not appear in the output — filter at source.',
    '- Rationale must be one complete sentence, under 25 words.',
    '- The `value` type must match the schema field type (boolean, number, string, etc.).',
    '- Never invent field keys outside the schema — unknown keys will be dropped.',
    '- Never output PII tokens you did not receive.',
  ].join('\n');
}

/** Project a ConfigSchema down to the fields we're allowed to ask the LLM about. */
function suggestableFields(schema: ConfigSchema): ConfigField[] {
  return schema.fields.filter((f) => f.aiSuggestable !== false);
}

/** Strip the non-suggestable keys from current-values so they never enter the prompt. */
function projectCurrentValues(
  values: Record<string, unknown>,
  allowedKeys: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(values)) {
    if (allowedKeys.has(k)) out[k] = values[k];
  }
  return out;
}

export function buildConfigSuggestPrompt(input: ConfigSuggestPromptInput): LLMMessage[] {
  const today = input.today.toISOString().slice(0, 10);
  const allowed = suggestableFields(input.schema);
  const allowedKeys = new Set(allowed.map((f) => f.key));

  // Project fields for the prompt. We deliberately drop `default`/`placeholder`
  // — the LLM shouldn't bias toward the schema author's defaults.
  const promptFields = allowed.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required ?? false,
    helpText: f.helpText,
    options: f.options,
  }));

  const filteredValues = projectCurrentValues(input.maskedContext.currentValues, allowedKeys);

  const userContent = [
    `Today: ${today}`,
    '',
    `Config schema: ${input.schema.type} — ${input.schema.label}`,
    `Description: ${input.schema.description}`,
    '',
    '<fields-to-suggest>',
    JSON.stringify(promptFields, null, 2),
    '</fields-to-suggest>',
    '',
    '<college-profile>',
    JSON.stringify(input.maskedContext.collegeProfile, null, 2),
    '</college-profile>',
    '',
    '<current-values>',
    JSON.stringify(filteredValues, null, 2),
    '</current-values>',
    '',
    'Return ONLY the JSON object specified by the system prompt.',
  ].join('\n');

  return [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: userContent },
  ];
}

/**
 * Strict JSON parser + per-suggestion schema validator for config-suggest.
 *
 * Drop-on-failure semantics: any suggestion that doesn't satisfy the
 * registered schema's per-field rules (type, options, suggestable flag)
 * is moved to `invalid` with a reason. The orchestrator surfaces only
 * `valid` to the user and can log a metric on the dropped ones.
 *
 * Confidence floor: 0.6 — anything below is dropped silently per spec
 * §3 "Guidelines" / §10.
 */

import type { ConfigSchema, ConfigField } from '../config-registry';

export interface ParsedSuggestion {
  field: string;
  suggestedValue: unknown;
  confidence: number;
  rationale: string;
}

export interface InvalidSuggestion {
  field: string;
  raw: unknown;
  reason: string;
}

export interface ParseResult {
  valid: ParsedSuggestion[];
  invalid: InvalidSuggestion[];
  parseError?: string;
}

const CONFIDENCE_FLOOR = 0.6;

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function fieldByKey(schema: ConfigSchema, key: string): ConfigField | undefined {
  return schema.fields.find((f) => f.key === key);
}

/**
 * Coerce + type-check a single suggested value against the field's
 * declared type. Mirrors the relevant branches of validateAgainstSchema
 * but returns the coerced value (or a reason string on rejection).
 */
function coerceValue(field: ConfigField, raw: unknown): { ok: true; value: unknown } | { ok: false; reason: string } {
  switch (field.type) {
    case 'boolean':
      if (typeof raw === 'boolean') return { ok: true, value: raw };
      if (raw === 'true' || raw === 'false') return { ok: true, value: raw === 'true' };
      return { ok: false, reason: `expected boolean, got ${typeof raw}` };
    case 'number': {
      if (typeof raw === 'number' && Number.isFinite(raw)) return { ok: true, value: raw };
      if (typeof raw === 'string') {
        const n = Number(raw);
        if (Number.isFinite(n)) return { ok: true, value: n };
      }
      return { ok: false, reason: `expected number, got ${typeof raw}` };
    }
    case 'select': {
      if (typeof raw !== 'string') return { ok: false, reason: `expected string, got ${typeof raw}` };
      const options = field.options ?? [];
      if (!options.some((o) => o.value === raw)) {
        return { ok: false, reason: `value ${raw} not in select options` };
      }
      return { ok: true, value: raw };
    }
    case 'multiselect': {
      if (!Array.isArray(raw)) return { ok: false, reason: 'expected array for multiselect' };
      const options = field.options ?? [];
      const optSet = new Set(options.map((o) => o.value));
      for (const v of raw) {
        if (typeof v !== 'string' || !optSet.has(v)) {
          return { ok: false, reason: `multiselect value ${String(v)} not in options` };
        }
      }
      return { ok: true, value: raw };
    }
    case 'string':
    case 'textarea':
      if (typeof raw === 'string') return { ok: true, value: raw };
      return { ok: false, reason: `expected string, got ${typeof raw}` };
    case 'date':
      if (raw instanceof Date) return { ok: true, value: raw };
      if (typeof raw === 'string' && !Number.isNaN(Date.parse(raw))) return { ok: true, value: raw };
      return { ok: false, reason: 'expected ISO date string' };
    default:
      return { ok: false, reason: `unsupported field type ${field.type}` };
  }
}

export function parseConfigSuggestions(raw: string, schema: ConfigSchema): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (err) {
    return { valid: [], invalid: [], parseError: (err as Error).message };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { valid: [], invalid: [], parseError: 'response is not a JSON object' };
  }
  const arr = (parsed as Record<string, unknown>).suggestions;
  if (!Array.isArray(arr)) {
    return { valid: [], invalid: [], parseError: 'missing `suggestions` array' };
  }

  const valid: ParsedSuggestion[] = [];
  const invalid: InvalidSuggestion[] = [];

  for (const item of arr) {
    if (!item || typeof item !== 'object') {
      invalid.push({ field: '', raw: item, reason: 'suggestion is not an object' });
      continue;
    }
    const s = item as Record<string, unknown>;
    const fieldKey = typeof s.field === 'string' ? s.field : '';

    if (!fieldKey) {
      invalid.push({ field: '', raw: s, reason: 'missing field key' });
      continue;
    }
    if (typeof s.rationale !== 'string' || s.rationale.length === 0) {
      invalid.push({ field: fieldKey, raw: s, reason: 'missing rationale' });
      continue;
    }
    if (typeof s.confidence !== 'number' || s.confidence < 0 || s.confidence > 1) {
      invalid.push({ field: fieldKey, raw: s, reason: 'confidence out of range [0,1]' });
      continue;
    }
    if (s.confidence < CONFIDENCE_FLOOR) {
      invalid.push({ field: fieldKey, raw: s, reason: `confidence ${s.confidence} below floor ${CONFIDENCE_FLOOR}` });
      continue;
    }
    if (s.value === undefined) {
      invalid.push({ field: fieldKey, raw: s, reason: 'missing value' });
      continue;
    }

    const field = fieldByKey(schema, fieldKey);
    if (!field) {
      invalid.push({ field: fieldKey, raw: s, reason: 'unknown field key (not in schema)' });
      continue;
    }
    if (field.aiSuggestable === false) {
      invalid.push({ field: fieldKey, raw: s, reason: 'field is not suggestable (aiSuggestable: false)' });
      continue;
    }
    const coerced = coerceValue(field, s.value);
    if (!coerced.ok) {
      invalid.push({ field: fieldKey, raw: s, reason: coerced.reason });
      continue;
    }

    valid.push({
      field: fieldKey,
      suggestedValue: coerced.value,
      confidence: s.confidence,
      rationale: s.rationale,
    });
  }

  return { valid, invalid };
}

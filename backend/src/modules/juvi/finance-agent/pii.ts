/**
 * PII masker for the fee-analytics-ai-native finance-agent.
 *
 * Masks sensitive fields with opaque tokens before sending to the LLM, and
 * restores tokens in the LLM response.
 *
 * Tokens are scoped to a single `maskPII()` call — ordinals reset every
 * call. The same value appearing twice in one input gets the same token.
 *
 * Spec source: `.captain/specs/fee-analytics-ai-native/spec.md`
 *   §AC PII masking + plan §1.5 (PII masking pipeline)
 */

/**
 * Per spec: top-level `name` is NOT in the AC mask list (the AC lists
 * `phone, email, guardian.name, guardian.phone, guardian.email, address,
 * aadhaar, pan, dob`). We mask exactly those — no inference, no surprises.
 *
 * The category in the token is the field name (lowercased, dots replaced
 * with `_`). Example: `guardian.phone` → `{guardian_phone_1}`.
 */
const MASK_RULES: Record<string, string> = {
  phone: 'phone',
  email: 'email',
  address: 'address',
  aadhaar: 'aadhaar',
  pan: 'pan',
  dob: 'dob',
};

const GUARDIAN_FIELD_RULES: Record<string, string> = {
  name: 'guardian_name',
  phone: 'guardian_phone',
  email: 'guardian_email',
};

export interface PIIMaskResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  masked: any;
  tokenMap: Record<string, string>;
}

interface MaskContext {
  /** Maps category → next ordinal to issue. Reset per call. */
  ordinals: Map<string, number>;
  /** Reverse map: raw value → token (so duplicates collapse). */
  valueToToken: Map<string, string>;
  /** Forward map exposed to callers. */
  tokenMap: Record<string, string>;
}

function newContext(): MaskContext {
  return {
    ordinals: new Map(),
    valueToToken: new Map(),
    tokenMap: {},
  };
}

function nextToken(ctx: MaskContext, category: string, rawValue: string): string {
  const dedupKey = `${category}::${rawValue}`;
  const existing = ctx.valueToToken.get(dedupKey);
  if (existing) return existing;

  const ord = (ctx.ordinals.get(category) ?? 0) + 1;
  ctx.ordinals.set(category, ord);
  const token = `{${category}_${ord}}`;
  ctx.valueToToken.set(dedupKey, token);
  ctx.tokenMap[token] = rawValue;
  return token;
}

function shouldMask(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function categoryFor(parentField: string | undefined, key: string): string | null {
  // Inside a `guardian` parent, name/phone/email become guardian_*
  if (parentField === 'guardian' || parentField === 'guardians') {
    const cat = GUARDIAN_FIELD_RULES[key];
    if (cat) return cat;
  }
  // Otherwise, only mask the AC-listed top-level fields.
  return MASK_RULES[key] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maskValue(value: any, ctx: MaskContext, parentField?: string): any {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => maskValue(item, ctx, parentField));
  }

  if (typeof value === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) {
      const v = (value as Record<string, unknown>)[k];
      const category = categoryFor(parentField, k);
      if (category && shouldMask(v)) {
        out[k] = nextToken(ctx, category, v);
      } else if (v !== null && typeof v === 'object') {
        out[k] = maskValue(v, ctx, k);
      } else {
        // Pass through nulls, numbers, booleans, empty strings, etc.
        out[k] = v;
      }
    }
    return out;
  }

  // Primitive at the top level (e.g., maskPII("hello")) — pass through.
  return value;
}

/**
 * Mask PII fields in a deeply-nested object/array.
 *
 * Returns `{ masked, tokenMap }` where:
 *   - `masked` is a structural copy with PII replaced by `{category_n}` tokens
 *   - `tokenMap` is a forward index: `{ '{phone_1}': '+91-99...' }`
 *
 * Example:
 * ```
 * const r = maskPII({ phone: '+91-99...', rollNumber: '20CS001' });
 * r.masked    // { phone: '{phone_1}', rollNumber: '20CS001' }
 * r.tokenMap  // { '{phone_1}': '+91-99...' }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maskPII(input: any): PIIMaskResult {
  const ctx = newContext();
  const masked = maskValue(input, ctx);
  return { masked, tokenMap: ctx.tokenMap };
}

/**
 * Replace `{token}` occurrences in a string with their mapped values.
 * Tokens not in the map are left literal and a `[llm:pii-warn]` log is
 * emitted (one per unique unknown token).
 */
export function unmaskText(text: string, tokenMap: Record<string, string>): string {
  const TOKEN_RE = /\{([a-z][a-z0-9_]*)\}/gi;
  const reportedUnknown = new Set<string>();

  return text.replace(TOKEN_RE, (full) => {
    if (Object.prototype.hasOwnProperty.call(tokenMap, full)) {
      return tokenMap[full] ?? full;
    }
    if (!reportedUnknown.has(full)) {
      reportedUnknown.add(full);
      // eslint-disable-next-line no-console
      console.warn(`[llm:pii-warn] unknown_token=${full.slice(1, -1)}`);
    }
    return full;
  });
}

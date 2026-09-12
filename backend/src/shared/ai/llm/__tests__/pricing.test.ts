import { describe, it, expect } from 'vitest';

import { AppError } from '../../../../middleware/errorHandler';
import { computeCostInr, priceFor } from '../pricing';

describe('pricing — model-keyed table', () => {
  it('prices a known model exactly (1M input tokens of Sonnet 4.5 at ₹85/$)', () => {
    expect(computeCostInr('claude-sonnet-4-5', 1_000_000, 0, 85)).toBe(255);
    expect(computeCostInr('gpt-4o-mini', 0, 1_000_000, 85)).toBe(51);
  });

  it('resolves dated variants to their base model by longest prefix', () => {
    expect(priceFor('claude-sonnet-4-5-20250929')).toEqual(priceFor('claude-sonnet-4-5'));
    // gpt-4o-mini-* must NOT fall through to gpt-4o.
    expect(priceFor('gpt-4o-mini-2024-07-18')).toEqual(priceFor('gpt-4o-mini'));
    expect(priceFor('gpt-4o-mini-2024-07-18')).not.toEqual(priceFor('gpt-4o'));
  });

  it('throws a 503 for an unknown model instead of silently pricing at ₹0', () => {
    expect(() => computeCostInr('gemini-9-ultra', 10, 10)).toThrow(AppError);
    expect(() => priceFor('')).toThrow(/pricing/i);
  });
});

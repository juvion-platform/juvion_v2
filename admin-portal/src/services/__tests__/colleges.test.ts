/**
 * Tests for `services/colleges.ts` (L7c — llm-spend-limits).
 *
 * We mock the shared `api` axios instance at the module boundary and
 * assert the helper:
 *   - hits the right URL (`/colleges/:id/ai-spend-limits`)
 *   - sends the right HTTP verb (PATCH)
 *   - forwards the body untouched
 *   - URL-encodes the collegeId (defensive — ids are usually plain hex
 *     ObjectIds but we'd rather not break on a future slug change)
 *   - returns `r.data` shape unchanged
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

vi.mock('../api', () => ({
  default: { patch: vi.fn() },
}));

import api from '../api';
import { updateAISpendLimits } from '../colleges';

const mockedPatch = (api as unknown as { patch: Mock }).patch;

beforeEach(() => {
  mockedPatch.mockReset();
});

describe('updateAISpendLimits()', () => {
  it('calls PATCH /colleges/:id/ai-spend-limits with the body', async () => {
    mockedPatch.mockResolvedValue({
      data: {
        aiSpendLimits: { weeklyInr: 1500, alertThresholdPct: 80 },
        currentSpend: { spent: 0, limit: 1500, pct: 0 },
      },
    });

    const out = await updateAISpendLimits('507f1f77bcf86cd799439011', {
      weeklyInr: 1500,
      alertThresholdPct: 80,
    });

    expect(mockedPatch).toHaveBeenCalledTimes(1);
    expect(mockedPatch).toHaveBeenCalledWith(
      '/colleges/507f1f77bcf86cd799439011/ai-spend-limits',
      { weeklyInr: 1500, alertThresholdPct: 80 },
    );
    expect(out.aiSpendLimits.weeklyInr).toBe(1500);
    expect(out.currentSpend.limit).toBe(1500);
  });

  it('forwards a partial body (alertThresholdPct only)', async () => {
    mockedPatch.mockResolvedValue({
      data: {
        aiSpendLimits: { weeklyInr: 0, alertThresholdPct: 90 },
        currentSpend: { spent: 0, limit: 0, pct: 0 },
      },
    });

    await updateAISpendLimits('cid-2', { alertThresholdPct: 90 });

    expect(mockedPatch).toHaveBeenCalledWith('/colleges/cid-2/ai-spend-limits', {
      alertThresholdPct: 90,
    });
  });

  it('URL-encodes the collegeId', async () => {
    mockedPatch.mockResolvedValue({
      data: {
        aiSpendLimits: { weeklyInr: 0, alertThresholdPct: 80 },
        currentSpend: { spent: 0, limit: 0, pct: 0 },
      },
    });

    await updateAISpendLimits('weird/id with spaces', { weeklyInr: 100 });

    // encodeURIComponent escapes `/` and ` `; this guards against a
    // future regression where someone replaces it with a template
    // literal that doesn't escape.
    expect(mockedPatch).toHaveBeenCalledWith(
      '/colleges/weird%2Fid%20with%20spaces/ai-spend-limits',
      { weeklyInr: 100 },
    );
  });

  it('propagates errors from the underlying axios call', async () => {
    const err = Object.assign(new Error('Request failed with 400'), {
      response: { status: 400, data: { error: 'weeklyInr must be ≥ 0' } },
    });
    mockedPatch.mockRejectedValue(err);

    await expect(
      updateAISpendLimits('cid-3', { weeklyInr: -1 }),
    ).rejects.toThrow(/Request failed with 400/);
  });
});

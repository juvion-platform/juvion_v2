import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * 002-ai-assisted-config Task 3.2 — thin wrapper around shared
 * tryClaimLLMSlot with the 'config-suggest' namespace and reading
 * CONFIG_SUGGEST_DAILY_LLM_CAP env (default 50).
 */

const { tryClaimLLMSlotMock } = vi.hoisted(() => ({
  tryClaimLLMSlotMock: vi.fn(),
}));

vi.mock('../../../admissions/lead-scoring/cap-guard', () => ({
  tryClaimLLMSlot: tryClaimLLMSlotMock,
}));

import { tryClaimConfigSuggestSlot, readConfigSuggestCap } from '../cap-guard';

beforeEach(() => {
  tryClaimLLMSlotMock.mockReset();
  delete process.env.CONFIG_SUGGEST_DAILY_LLM_CAP;
});
afterEach(() => {
  delete process.env.CONFIG_SUGGEST_DAILY_LLM_CAP;
});

describe('readConfigSuggestCap', () => {
  it('defaults to 50 when env is unset', () => {
    expect(readConfigSuggestCap()).toBe(50);
  });

  it('honours CONFIG_SUGGEST_DAILY_LLM_CAP when set to a positive integer', () => {
    process.env.CONFIG_SUGGEST_DAILY_LLM_CAP = '120';
    expect(readConfigSuggestCap()).toBe(120);
  });

  it('falls back to 50 when env is invalid', () => {
    process.env.CONFIG_SUGGEST_DAILY_LLM_CAP = 'not-a-number';
    expect(readConfigSuggestCap()).toBe(50);
    process.env.CONFIG_SUGGEST_DAILY_LLM_CAP = '-5';
    expect(readConfigSuggestCap()).toBe(50);
  });
});

describe('tryClaimConfigSuggestSlot', () => {
  it('delegates to shared tryClaimLLMSlot with the "config-suggest" namespace', async () => {
    tryClaimLLMSlotMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 50 });
    const now = new Date('2026-05-14T10:00:00Z');
    const r = await tryClaimConfigSuggestSlot('college-1', now);

    expect(tryClaimLLMSlotMock).toHaveBeenCalledTimes(1);
    const [collegeId, cap, dateArg, namespace] = tryClaimLLMSlotMock.mock.calls[0]!;
    expect(collegeId).toBe('college-1');
    expect(cap).toBe(50); // default
    expect(dateArg).toBe(now);
    expect(namespace).toBe('config-suggest');
    expect(r.allowed).toBe(true);
  });

  it('passes the env-overridden cap', async () => {
    process.env.CONFIG_SUGGEST_DAILY_LLM_CAP = '100';
    tryClaimLLMSlotMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 100 });
    await tryClaimConfigSuggestSlot('college-2');
    const [, cap] = tryClaimLLMSlotMock.mock.calls[0]!;
    expect(cap).toBe(100);
  });
});

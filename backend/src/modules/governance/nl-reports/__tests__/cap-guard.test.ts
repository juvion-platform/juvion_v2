import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { tryClaimLLMSlotMock } = vi.hoisted(() => ({ tryClaimLLMSlotMock: vi.fn() }));

vi.mock('../../../admissions/lead-scoring/cap-guard', () => ({
  tryClaimLLMSlot: tryClaimLLMSlotMock,
}));

import { tryClaimNlReportSlot, readNlReportCap } from '../cap-guard';

beforeEach(() => {
  tryClaimLLMSlotMock.mockReset();
  delete process.env.NL_REPORT_DAILY_LLM_CAP;
});
afterEach(() => {
  delete process.env.NL_REPORT_DAILY_LLM_CAP;
});

describe('readNlReportCap', () => {
  it('defaults to 30 when env is unset', () => {
    expect(readNlReportCap()).toBe(30);
  });
  it('honours NL_REPORT_DAILY_LLM_CAP', () => {
    process.env.NL_REPORT_DAILY_LLM_CAP = '75';
    expect(readNlReportCap()).toBe(75);
  });
  it('falls back to 30 on invalid input', () => {
    process.env.NL_REPORT_DAILY_LLM_CAP = 'xx';
    expect(readNlReportCap()).toBe(30);
    process.env.NL_REPORT_DAILY_LLM_CAP = '-1';
    expect(readNlReportCap()).toBe(30);
  });
});

describe('tryClaimNlReportSlot', () => {
  it('delegates with the "nl-reports" namespace', async () => {
    tryClaimLLMSlotMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 30 });
    const now = new Date('2026-05-14T10:00:00Z');
    await tryClaimNlReportSlot('college-1', now);
    const [, , , namespace] = tryClaimLLMSlotMock.mock.calls[0]!;
    expect(namespace).toBe('nl-reports');
  });

  it('passes the env-overridden cap', async () => {
    process.env.NL_REPORT_DAILY_LLM_CAP = '50';
    tryClaimLLMSlotMock.mockResolvedValueOnce({ allowed: true, count: 1, cap: 50 });
    await tryClaimNlReportSlot('college-2');
    const [, cap] = tryClaimLLMSlotMock.mock.calls[0]!;
    expect(cap).toBe(50);
  });
});

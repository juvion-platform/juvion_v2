/**
 * T2 — fee-collection-analytics-and-alerts
 * Registers `FEE_ALERTS_CRON` queue name under the Finance namespace,
 * mirroring the `FEE_COMMITMENT` (T4) and `FEE_PIN_AUDIT` (T17) entries
 * from the fee-configuration feature.
 *
 * Three ACs (tasks.md §Task 2):
 *   1. `QUEUE_NAMES.FEE_ALERTS_CRON === 'finance:fee-alerts-cron'`
 *   2. Queue name uses the `finance:` namespace prefix convention
 *   3. No existing queue names are removed / renamed (explicit assertion
 *      for FEE_COMMITMENT + FEE_PIN_AUDIT + other core names)
 */

import { describe, it, expect } from 'vitest';

import { QUEUE_NAMES } from '../QueueManager';

describe('QUEUE_NAMES.FEE_ALERTS_CRON', () => {
  it('is registered with the exact finance_fee_alerts_cron value', () => {
    expect(QUEUE_NAMES).toHaveProperty('FEE_ALERTS_CRON');
    expect(QUEUE_NAMES.FEE_ALERTS_CRON).toBe('finance_fee_alerts_cron');
  });

  it('uses the finance_ namespace prefix convention', () => {
    expect(QUEUE_NAMES.FEE_ALERTS_CRON.startsWith('finance_')).toBe(true);
  });

  it('does not remove or rename existing finance queue entries', () => {
    // Explicit guard — any rename of FEE_COMMITMENT (T4) or FEE_PIN_AUDIT
    // (T17) would silently break producers/workers that import these
    // constants, so we pin the exact string values.
    expect(QUEUE_NAMES.FEE_COMMITMENT).toBe('finance_fee_commitment');
    expect(QUEUE_NAMES.FEE_PIN_AUDIT).toBe('finance_fee_pin_audit');

    // Spot-check a representative queue from each other namespace group
    // to catch accidental cross-module deletions.
    expect(QUEUE_NAMES.LEAD_SCORING).toBe('admissions_lead_scoring');
    expect(QUEUE_NAMES.NOTIFICATION).toBe('platform_notification');
    expect(QUEUE_NAMES.SMS).toBe('platform_sms');
    expect(QUEUE_NAMES.EMAIL).toBe('platform_email');
    expect(QUEUE_NAMES.WHATSAPP).toBe('platform_whatsapp');
    expect(QUEUE_NAMES.CAMPUS_PROPOSAL_EXPIRY).toBe('campus_proposal_expiry');
  });
});

import { z } from 'zod';

/**
 * Reusable Zod refinements for the "end before start" and "required-when"
 * rules the audit found accepted silently on the server as well as the client.
 *
 * ISO date strings ('2026-01-05') and HH:mm times both order correctly under
 * plain string comparison, so no parsing is needed.
 */

interface RangeOptions {
  startField: string;
  endField: string;
  /** Same start and end is fine (a single-day season, say). */
  allowEqual?: boolean;
  message?: string;
}

/**
 * Adds an issue on `endField` when it precedes `startField`. Skips the check
 * when either side is absent, so it composes with `.partial()` schemas where
 * a PATCH may touch only one of the two.
 */
export function refineRange({ startField, endField, allowEqual = true, message }: RangeOptions) {
  return (data: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const start = data[startField];
    const end = data[endField];
    if (typeof start !== 'string' || typeof end !== 'string' || !start || !end) return;

    const invalid = allowEqual ? end < start : end <= start;
    if (invalid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [endField],
        message: message ?? `${endField} must be ${allowEqual ? 'on or after' : 'after'} ${startField}`,
      });
    }
  };
}

interface RequiredWhenOptions {
  field: string;
  statusField: string;
  whenStatusIn: readonly string[];
  message?: string;
}

/**
 * Adds an issue when `field` is missing while `statusField` claims a state
 * that implies it. Skips entirely when the status isn't being set, so a PATCH
 * that only touches unrelated fields still validates.
 */
export function refineRequiredWhenStatus({ field, statusField, whenStatusIn, message }: RequiredWhenOptions) {
  return (data: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const status = data[statusField];
    if (typeof status !== 'string' || !whenStatusIn.includes(status)) return;

    const value = data[field];
    if (value === undefined || value === null || value === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: message ?? `${field} is required when ${statusField} is "${status}"`,
      });
    }
  };
}

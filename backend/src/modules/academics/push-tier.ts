// backend/src/modules/academics/push-tier.ts
/**
 * The §8 push tier, as a pure function: Urgent when the ORIGINAL class start is
 * today (college tz) and within 2 hours of the change — forward-looking: the
 * start instant must be in the future and ≤ URGENT_WINDOW_MS away (an already
 * started class is at Important; the send-time re-check cancels it regardless).
 * Important when any affected date is today or tomorrow; none beyond.
 */
import { instantOf, ymd, addDays } from './timetable-date';

export type ClassChangePushTier = 'urgent' | 'important' | 'none';

export const URGENT_WINDOW_MS = 2 * 60 * 60_000;

export function classifyExceptionPushTier(
  originalDate: string,
  originalStartHHMM: string,
  affectedDates: readonly string[],
  now: Date,
  timezone: string,
): ClassChangePushTier {
  const today = ymd(now, timezone);
  if (originalDate === today) {
    const delta = instantOf(originalDate, originalStartHHMM, timezone).getTime() - now.getTime();
    if (delta > 0 && delta <= URGENT_WINDOW_MS) return 'urgent';
  }
  const tomorrow = addDays(today, 1);
  for (const d of affectedDates) {
    if (d === today || d === tomorrow) return 'important';
  }
  return 'none';
}

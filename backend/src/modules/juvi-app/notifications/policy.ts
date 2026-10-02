// backend/src/modules/juvi-app/notifications/policy.ts
/**
 * Notification policy (notifications spec §6). Pure: no I/O, no clock — the
 * caller passes `now` and the college timezone. Rules apply in order: tier
 * toggles, mute, quiet hours. Urgent bypasses all three.
 */
import type { NotificationTier } from '../../../models/juvi/NotificationDelivery';

export interface PolicySettings {
  quietHours: { start: string; end: string };
  tiers: { important: boolean; routine: boolean };
}

export interface PolicyInput {
  tier: NotificationTier;
  settings: PolicySettings;
  /** The notice matches at least one of the person's channels and every one of them is muted. */
  mutedAllMatchingChannels: boolean;
  now: Date;
  collegeTimezone: string;
}

export type PolicyDecision =
  | { status: 'scheduled'; sendAfter: Date }
  | { status: 'suppressed'; reason: 'tier_off' | 'muted' };

/** A Routine digest window is 15 minutes (spec §6.4). */
export const DIGEST_WINDOW_MS = 15 * 60_000;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map((p) => Number.parseInt(p, 10));
  return (h ?? 0) * 60 + (m ?? 0);
};

interface WallClock { year: number; month: number; day: number; hour: number; minute: number; second: number }

/** The wall-clock time of `at` in `timeZone`. */
export function wallClock(at: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number.parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Milliseconds `timeZone` is ahead of UTC at `at`. */
function offsetMs(at: Date, timeZone: string): number {
  const w = wallClock(at, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant whose wall clock in `timeZone` reads the given local date and time. */
function fromWallClock(year: number, month: number, day: number, minutes: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** True when `now` falls inside the window in `timeZone`. The window may wrap past midnight; start === end is no window. */
export function inQuietHours(now: Date, quietHours: { start: string; end: string }, timeZone: string): boolean {
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (start === end) return false;
  const w = wallClock(now, timeZone);
  const t = w.hour * 60 + w.minute;
  return start < end ? t >= start && t < end : t >= start || t < end;
}

/** The next instant after `now` at which the wall clock in `timeZone` reads `hhmm`. */
export function nextOccurrence(now: Date, hhmm: string, timeZone: string): Date {
  const w = wallClock(now, timeZone);
  const minutes = toMinutes(hhmm);
  const today = fromWallClock(w.year, w.month, w.day, minutes, timeZone);
  if (today.getTime() > now.getTime()) return today;
  const tomorrow = new Date(Date.UTC(w.year, w.month - 1, w.day + 1));
  return fromWallClock(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), minutes, timeZone);
}

export function decide(input: PolicyInput): PolicyDecision {
  const { tier, settings, now } = input;
  if (tier === 'urgent') return { status: 'scheduled', sendAfter: now };
  // §6.1 tier toggles
  if (!settings.tiers[tier]) return { status: 'suppressed', reason: 'tier_off' };
  // §6.2 mute
  if (input.mutedAllMatchingChannels) return { status: 'suppressed', reason: 'muted' };
  // §6.3 quiet hours
  if (inQuietHours(now, settings.quietHours, input.collegeTimezone)) {
    return { status: 'scheduled', sendAfter: nextOccurrence(now, settings.quietHours.end, input.collegeTimezone) };
  }
  return { status: 'scheduled', sendAfter: now };
}

/**
 * §6.4: a Routine row joins the open window for its (account, batch key) or opens
 * a new one at least 15 minutes out. A row whose policy time is later than the
 * open window (quiet hours began after the window opened) keeps the later time.
 * A window never opens inside quiet hours: a time that lands there (a notice at
 * 21:50 would open at 22:05) moves to the next end of quiet hours.
 */
export function digestSendAfter(policySendAfter: Date, openWindow: Date | null, now: Date, settings: PolicySettings, timeZone: string): Date {
  const at = openWindow
    ? new Date(Math.max(openWindow.getTime(), policySendAfter.getTime()))
    : new Date(Math.max(policySendAfter.getTime(), now.getTime() + DIGEST_WINDOW_MS));
  return inQuietHours(at, settings.quietHours, timeZone) ? nextOccurrence(at, settings.quietHours.end, timeZone) : at;
}

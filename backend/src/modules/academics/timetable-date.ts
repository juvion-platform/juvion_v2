/**
 * Pure date math for the timetable (Today&Teaching §5/§6). Every function is
 * timezone-correct: a 'day' is a college-timezone day, never a UTC day. The
 * wall-clock math mirrors the notification policy's approach (private there;
 * duplicated here to keep this module import-free) with the no-DST simplification
 * for Asia/Kolkata explicitly valid via the real Intl offset lookup.
 */

export type DayEnum =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const DAYS: readonly DayEnum[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const UTC_DAY_BY_En_US_SHORT: Record<string, DayEnum> = {
  Sun: 'sunday', Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday',
  Thu: 'thursday', Fri: 'friday', Sat: 'saturday',
};

function partsOf(at: Date, timezone: string): {
  y: number; m: number; d: number; minutes: number; weekday: DayEnum;
} {
  // en-CA formats the day as YYYY-MM-DD exactly.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? 0 : p.hour; // ICU can emit 24 for midnight in hour12: false
  return {
    y: Number(p.year), m: Number(p.month), d: Number(p.day),
    minutes: Number(hour) * 60 + Number(p.minute) + Number(p.second) / 60,
    weekday: UTC_DAY_BY_En_US_SHORT[p.weekday ?? 'Sun'] ?? 'sunday',
  };
}

/** The calendar date 'YYYY-MM-DD' of the instant, in the zone. */
export function ymd(at: Date, timezone: string): string {
  const p = partsOf(at, timezone);
  return `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** The lowercase weekday of a plain 'YYYY-MM-DD' date (UTC-parsed; no zone involved). */
export function dayEnumOf(date: string): DayEnum {
  const dayIndex = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return DAYS[(dayIndex + 6) % 7]!;
}

/**
 * The instant midnight of a zoned date: the UTC instant whose y/m/d parts, read
 * back in the zone, equal those of `date`. Fixed-point iteration (converges in
 * ≤3 passes) — exact for any zone and offset shape, including half-hour and
 * quarter-hour offsets.
 */
export function startOfDay(date: string, timezone: string): Date {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return fromWall(y, m, d, 0, timezone);
}

/** The instant of `date` at `hh:mm` wall-clock, in the zone. */
export function instantOf(date: string, hhmm: string, timezone: string): Date {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  const minutes = hhmmToMinutes(hhmm);
  return fromWall(y, m, d, minutes, timezone);
}

function fromWall(y: number, m: number, d: number, minutes: number, timezone: string): Date {
  let at = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
  for (let i = 0; i < 3; i += 1) {
    const p = partsOf(at, timezone);
    const delta = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60) - Date.UTC(p.y, p.m - 1, p.d, 0, p.minutes);
    if (delta === 0) return at;
    at = new Date(at.getTime() + delta);
  }
  return at;
}

export function addDays(date: string, n: number): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Days a − b as a whole number (calendar dates; no zone involved). */
export function diffDays(a: string, b: string): number {
  const [ay = 1970, am = 1, ad = 1] = a.split('-').map(Number);
  const [by = 1970, bm = 1, bd = 1] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

export function hhmmToMinutes(hhmm: string): number {
  const [h = '0', mm = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(mm);
}

/** Strict overlaps of half-open [start, end) HH:MM ranges; inverted ranges are empty. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = hhmmToMinutes(aStart); const aE = hhmmToMinutes(aEnd);
  const bS = hhmmToMinutes(bStart); const bE = hhmmToMinutes(bEnd);
  return aS < aE && bS < bE && aS < bE && bS < aE;
}

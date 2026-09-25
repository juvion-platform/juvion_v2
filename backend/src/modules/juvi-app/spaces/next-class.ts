import { Timetable } from '../../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';

export interface WeeklySlot { day: string; startTime: string }

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINUTES_PER_WEEK = 7 * 1440;

function zonedNow(now: Date, timezone: string): { dayIndex: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dayIndex = SHORT.indexOf(get('weekday'));
  const minutes = (Number.parseInt(get('hour'), 10) % 24) * 60 + Number.parseInt(get('minute'), 10);
  return { dayIndex, minutes };
}

/** Earliest occurrence at or after `now` of any weekly slot, as an instant. IST has no DST, so minute arithmetic is exact. */
export function nextOccurrence(slots: WeeklySlot[], now: Date, timezone: string): Date | null {
  const { dayIndex, minutes } = zonedNow(now, timezone);
  let best = Number.POSITIVE_INFINITY;
  for (const s of slots) {
    const d = DAYS.indexOf(s.day.toLowerCase());
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.startTime);
    if (d < 0 || !m) continue;
    const slotMinutes = Number(m[1]) * 60 + Number(m[2]);
    let delta = ((d - dayIndex + 7) % 7) * 1440 + (slotMinutes - minutes);
    if (delta < 0) delta += MINUTES_PER_WEEK;
    if (delta < best) best = delta;
  }
  return Number.isFinite(best) ? new Date(now.getTime() + best * 60_000) : null;
}

export function formatNextClassLabel(at: Date, now: Date, timezone: string): string {
  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  const today = dayKey(now); const tomorrow = dayKey(new Date(now.getTime() + 86_400_000)); const target = dayKey(at);
  const word = target === today ? 'Today' : target === tomorrow ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(at);
  return `Next: ${word} ${time}`;
}

/** Next class per offering from published weekly timetables. Offerings with no usable slot are absent from the map. */
export async function nextClassByOffering(collegeId: string, offeringIds: string[], timezone: string): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (offeringIds.length === 0) return out;
  const published = await Timetable.find({ collegeId, status: 'published' }).select('_id').lean();
  if (published.length === 0) return out;
  const slots = await TimetableSlot.find({
    collegeId, timetableId: { $in: published.map((t) => t._id) }, courseOfferingId: { $in: offeringIds }, slotType: { $ne: 'free' },
  }).select('courseOfferingId day startTime').lean();
  const byOffering = new Map<string, WeeklySlot[]>();
  for (const s of slots) byOffering.set(String(s.courseOfferingId), [...(byOffering.get(String(s.courseOfferingId)) ?? []), { day: s.day, startTime: s.startTime }]);
  const now = new Date();
  for (const [id, list] of byOffering) {
    const at = nextOccurrence(list, now, timezone);
    if (at) out.set(id, at);
  }
  return out;
}

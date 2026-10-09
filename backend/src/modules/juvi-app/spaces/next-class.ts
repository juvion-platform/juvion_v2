// backend/src/modules/juvi-app/spaces/next-class.ts
/**
 * §5.3: the next class per offering now resolves on the live-read rule —
 * for each day in a 14-day horizon, the highest-version published timetable
 * whose effective window covers the date — and then applies that day's
 * exceptions: a cancelled occurrence is never "next", and a rescheduled one
 * counts at its new time on its new date. The old weekly-arithmetic
 * `nextOccurrence` (window-blind, exception-blind) is gone.
 */
import { Types } from 'mongoose';
import { TimetableSlot } from '../../../models/academic-ops/TimetableSlot';
import { getLiveTimetables } from '../../academics/live-timetable';
import { activeExceptionsFor } from '../../academics/class-exception-service';
import { ymd, addDays, dayEnumOf, instantOf } from '../../academics/timetable-date';

const HORIZON_DAYS = 14;

export function formatNextClassLabel(at: Date, now: Date, timezone: string): string {
  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  const today = dayKey(now); const tomorrow = dayKey(new Date(now.getTime() + 86_400_000)); const target = dayKey(at);
  const word = target === today ? 'Today' : target === tomorrow ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(at);
  return `Next: ${word} ${time}`;
}

type SlotLean = { _id: Types.ObjectId; courseOfferingId: Types.ObjectId; startTime: string; endTime: string };

/** Next class per offering on the live rule; offerings with no usable occurrence in the horizon are absent. */
export async function nextClassByOffering(
  collegeId: string, offeringIds: string[], timezone: string,
): Promise<Map<string, Date>> {
  const ids = [...new Set(offeringIds)];
  const out = new Map<string, Date>();
  if (ids.length === 0) return out;
  const best = new Map<string, number>();

  // "Next" means at-or-after now. The horizon starts TODAY, so without this bound a class that
  // already started today (08:00 when it is 15:00) is the minimum over the horizon and gets
  // returned — and `formatNextClassLabel` then renders the past as "Next: Today 08:00". The
  // weekly rule this replaces (`nextOccurrence`'s `delta < 0 → += week`) never returned a past
  // occurrence either, so this preserves shipped semantics rather than changing them (R81).
  const nowMs = Date.now();
  const today = ymd(new Date(nowMs), timezone);
  const dates = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i));

  for (const date of dates) {
    const live = await getLiveTimetables(collegeId, instantOf(date, '12:00', timezone), timezone);
    const winners = [...live.values()].map((t) => String(t._id));
    if (winners.length === 0) continue;

    const slots = await TimetableSlot.find({
      collegeId, timetableId: { $in: winners }, day: dayEnumOf(date),
      slotType: { $ne: 'free' }, courseOfferingId: { $in: ids.map((id) => new Types.ObjectId(id)) },
    }).lean<SlotLean[]>();

    const rows = await activeExceptionsFor(collegeId, { dates: [date] });
    const vacated = new Set<string>();
    for (const e of rows) if (e.date === date) vacated.add(String(e.timetableSlotId));

    for (const s of slots) {
      const sid = String(s._id);
      if (vacated.has(sid)) continue;
      const at = instantOf(date, s.startTime, timezone).getTime();
      if (at < nowMs) continue;
      const cur = best.get(String(s.courseOfferingId));
      if (cur === undefined || at < cur) best.set(String(s.courseOfferingId), at);
    }
    for (const e of rows) {
      if (e.type !== 'rescheduled' || e.newDate !== date || !e.newStartTime || !ids.includes(String(e.courseOfferingId))) continue;
      const at = instantOf(date, e.newStartTime, timezone).getTime();
      if (at < nowMs) continue;
      const cur = best.get(String(e.courseOfferingId));
      if (cur === undefined || at < cur) best.set(String(e.courseOfferingId), at);
    }
  }

  for (const [offeringId, at] of best) out.set(offeringId, new Date(at));
  return out;
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, CalendarDays } from 'lucide-react';
import {
  listTimetableSlots,
  createTimetableSlot,
  deleteTimetableSlot,
  listCourseOfferings,
} from '../../services/academics';
import { confirmAction } from '../../stores/confirmStore';
import { rangeError } from '../../lib/validation';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const SLOT_TYPES = ['lecture', 'tutorial', 'lab', 'free'] as const;

const inp = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';

interface Props {
  timetableId: string;
  readOnly?: boolean;
}

const emptySlot = { day: 'monday', period: '1', startTime: '', endTime: '', courseOfferingId: '', slotType: 'lecture' };

/**
 * Period-level editor for a timetable.
 *
 * The Timetables page only managed the header record (section, semester,
 * status) — clicking a timetable showed no periods and offered no way to add
 * one, even though the slot API was complete. Slots are grouped by day and
 * ordered by period so the grid reads like a real timetable.
 */
export default function TimetableSlotsPanel({ timetableId, readOnly }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(emptySlot);
  const [adding, setAdding] = useState(false);

  const slotsQuery = useQuery({
    queryKey: ['timetable-slots', timetableId],
    queryFn: () => listTimetableSlots(timetableId),
    enabled: Boolean(timetableId),
  });

  const { data: offeringsData } = useQuery({
    queryKey: ['offerings', 1, 200],
    queryFn: () => listCourseOfferings(1, 200),
  });
  const offerings = offeringsData?.items ?? [];

  const createMut = useMutation({
    mutationFn: createTimetableSlot,
    meta: { successMessage: 'Slot added' },
    onSuccess: () => {
      setDraft(emptySlot);
      setAdding(false);
      qc.invalidateQueries({ queryKey: ['timetable-slots', timetableId] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteTimetableSlot,
    meta: { action: 'delete' },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timetable-slots', timetableId] }),
  });

  const slots: any[] = slotsQuery.data ?? [];
  const timeError = rangeError(draft.startTime, draft.endTime, { startLabel: 'start time', endLabel: 'end time' });

  // A period number can only be used once per day.
  const duplicate = slots.some(
    (s) => s.day === draft.day && String(s.period) === String(draft.period),
  );

  function offeringLabel(o: any): string {
    const c = o?.courseId;
    if (c && typeof c === 'object') return `${c.code} — ${c.name}`;
    return o?._id ?? '';
  }

  function submitSlot() {
    if (timeError || duplicate || !draft.courseOfferingId) return;
    createMut.mutate({
      timetableId,
      day: draft.day,
      period: Number(draft.period),
      startTime: draft.startTime,
      endTime: draft.endTime,
      courseOfferingId: draft.courseOfferingId,
      slotType: draft.slotType,
    });
  }

  async function removeSlot(slot: any) {
    const ok = await confirmAction({
      title: `Remove period ${slot.period} on ${slot.day}?`,
      tone: 'danger',
      confirmLabel: 'Remove',
    });
    if (ok.confirmed) deleteMut.mutate(slot._id);
  }

  if (slotsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        <Loader2 size={15} className="animate-spin" /> Loading slots…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <CalendarDays size={15} className="text-slate-400" />
          {slots.length} period{slots.length === 1 ? '' : 's'}
        </span>
        {!readOnly && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-white"
          >
            <Plus size={13} /> Add slot
          </button>
        )}
      </div>

      {slots.length === 0 && !adding ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">
          No periods defined yet.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          {DAYS.filter((d) => slots.some((s) => s.day === d)).map((day) => (
            <div key={day}>
              <p className="sticky top-0 bg-slate-100 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {day}
              </p>
              <ul className="divide-y">
                {slots
                  .filter((s) => s.day === day)
                  .sort((a, b) => a.period - b.period)
                  .map((s) => (
                    <li key={s._id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="inline-block w-16 font-medium text-slate-700">P{s.period}</span>
                        <span className="text-slate-500">{s.startTime}–{s.endTime}</span>
                        <span className="ml-2 text-slate-800">
                          {typeof s.courseOfferingId === 'object'
                            ? offeringLabel(s.courseOfferingId)
                            : s.courseOfferingId}
                        </span>
                        {s.slotType && s.slotType !== 'lecture' && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs capitalize text-slate-600">{s.slotType}</span>
                        )}
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => void removeSlot(s)}
                          aria-label={`Remove period ${s.period} on ${s.day}`}
                          className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {adding && !readOnly && (
        <div className="space-y-2 border-t bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="text-xs text-slate-600">
              Day
              <select value={draft.day} onChange={(e) => setDraft(d => ({ ...d, day: e.target.value }))} className={inp}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Period
              <input type="number" min={1} value={draft.period} onChange={(e) => setDraft(d => ({ ...d, period: e.target.value }))} className={inp} />
            </label>
            <label className="text-xs text-slate-600">
              Type
              <select value={draft.slotType} onChange={(e) => setDraft(d => ({ ...d, slotType: e.target.value }))} className={inp}>
                {SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Start
              <input type="time" value={draft.startTime} onChange={(e) => setDraft(d => ({ ...d, startTime: e.target.value }))} className={inp} />
            </label>
            <label className="text-xs text-slate-600">
              End
              <input type="time" value={draft.endTime} onChange={(e) => setDraft(d => ({ ...d, endTime: e.target.value }))} className={inp} />
            </label>
            <label className="col-span-2 text-xs text-slate-600 sm:col-span-1">
              Course offering
              <select value={draft.courseOfferingId} onChange={(e) => setDraft(d => ({ ...d, courseOfferingId: e.target.value }))} className={inp}>
                <option value="">Select…</option>
                {offerings.map((o: any) => <option key={o._id} value={o._id}>{offeringLabel(o)}</option>)}
              </select>
            </label>
          </div>

          {timeError && <p className="text-sm text-red-600" role="alert">{timeError}</p>}
          {duplicate && (
            <p className="text-sm text-red-600" role="alert">
              Period {draft.period} on {draft.day} is already taken.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setDraft(emptySlot); }} className="rounded border px-3 py-1.5 text-sm text-slate-700 transition hover:bg-white">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitSlot}
              disabled={createMut.isPending || Boolean(timeError) || duplicate || !draft.courseOfferingId || !draft.startTime || !draft.endTime}
              className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {createMut.isPending ? 'Adding…' : 'Add slot'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

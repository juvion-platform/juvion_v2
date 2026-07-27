import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users, AlertTriangle } from 'lucide-react';
import {
  getOfferingRoster,
  listInternalMarks,
  bulkCreateInternalMarks,
  type RosterStudent,
} from '../../services/academics';

function studentName(s: RosterStudent): string {
  if (s.personId && typeof s.personId === 'object') return s.personId.name || s._id;
  return s.rollNumber || s._id;
}

interface Props {
  assessmentId: string;
  courseOfferingId: string;
  maxMarks?: number;
  readOnly?: boolean;
}

/**
 * Marks-entry sheet for one internal assessment.
 *
 * The assessment modal previously showed only the header (name, max marks,
 * date) with no way to enter anyone's marks, despite the internal-marks API
 * being complete. Blank means "not entered yet" and is skipped on save, so a
 * partially-marked sheet can be saved and finished later.
 */
export default function InternalMarksPanel({ assessmentId, courseOfferingId, maxMarks, readOnly }: Props) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const rosterQuery = useQuery({
    queryKey: ['offering-roster', courseOfferingId],
    queryFn: () => getOfferingRoster(courseOfferingId),
    enabled: Boolean(courseOfferingId),
  });

  const marksQuery = useQuery({
    queryKey: ['internal-marks', assessmentId],
    queryFn: () => listInternalMarks(assessmentId),
    enabled: Boolean(assessmentId),
  });

  const students = rosterQuery.data?.students ?? [];

  const existing = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of (marksQuery.data ?? []) as any[]) {
      const sid = typeof m.studentId === 'object' ? m.studentId?._id : m.studentId;
      if (sid) map[String(sid)] = String(m.marksObtained ?? '');
    }
    return map;
  }, [marksQuery.data]);

  useEffect(() => {
    if (rosterQuery.isLoading || marksQuery.isLoading) return;
    setValues(Object.fromEntries(students.map((s) => [s._id, existing[s._id] ?? ''])));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterQuery.isLoading, marksQuery.isLoading, rosterQuery.data, marksQuery.data]);

  // Entered marks outside 0..maxMarks — the server rejects these too, but
  // catching them here means the operator sees which row is wrong.
  const invalidIds = useMemo(() => {
    const bad: string[] = [];
    for (const [id, raw] of Object.entries(values)) {
      if (raw === '') continue;
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0 || (typeof maxMarks === 'number' && n > maxMarks)) bad.push(id);
    }
    return bad;
  }, [values, maxMarks]);

  const entered = Object.values(values).filter((v) => v !== '').length;

  const saveMut = useMutation({
    mutationFn: () => bulkCreateInternalMarks({
      marks: students
        .filter((s) => values[s._id] !== '' && values[s._id] != null)
        .map((s) => ({ assessmentId, studentId: s._id, marksObtained: Number(values[s._id]) })),
    }),
    meta: { successMessage: 'Marks saved' },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['internal-marks', assessmentId] });
    },
  });

  function setOne(studentId: string, raw: string) {
    setValues((v) => ({ ...v, [studentId]: raw }));
    setDirty(true);
  }

  if (rosterQuery.isLoading || marksQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        <Loader2 size={15} className="animate-spin" /> Loading class roster…
      </div>
    );
  }

  if (rosterQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load the class roster for this course offering.
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No students are mapped to this offering&rsquo;s section yet, so there are no marks to enter.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-slate-700">
          <Users size={15} className="text-slate-400" />
          {entered} of {students.length} entered
        </span>
        {typeof maxMarks === 'number' && (
          <span className="text-xs text-slate-500">Out of {maxMarks}</span>
        )}
      </div>

      <ul className="max-h-80 divide-y overflow-y-auto">
        {students.map((s) => {
          const invalid = invalidIds.includes(s._id);
          return (
            <li key={s._id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="min-w-0 text-sm">
                <span className="font-medium text-slate-800">{studentName(s)}</span>
                {s.rollNumber && <span className="ml-2 text-xs text-slate-500">{s.rollNumber}</span>}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                max={maxMarks}
                disabled={readOnly}
                value={values[s._id] ?? ''}
                onChange={(e) => setOne(s._id, e.target.value)}
                aria-label={`Marks for ${studentName(s)}`}
                aria-invalid={invalid}
                placeholder="—"
                className={`w-24 rounded-lg border px-2 py-1 text-right text-sm outline-none focus:ring-2 disabled:bg-slate-50 ${
                  invalid
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
                    : 'border-gray-300 focus:border-primary-400 focus:ring-primary-100'
                }`}
              />
            </li>
          );
        })}
      </ul>

      {invalidIds.length > 0 && (
        <p className="flex items-center gap-1.5 border-t bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          <AlertTriangle size={14} />
          {invalidIds.length} mark{invalidIds.length === 1 ? '' : 's'} outside the valid range
          {typeof maxMarks === 'number' ? ` (0–${maxMarks})` : ''}.
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3">
          <span className="text-xs text-slate-500">
            {dirty ? 'Unsaved changes' : 'All changes saved'} · blank rows are left un-entered
          </span>
          <button
            type="button"
            disabled={saveMut.isPending || !dirty || invalidIds.length > 0 || entered === 0}
            onClick={() => saveMut.mutate()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save marks'}
          </button>
        </div>
      )}
    </div>
  );
}

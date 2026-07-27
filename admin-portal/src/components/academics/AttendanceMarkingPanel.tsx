import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Clock, Briefcase, FileMinus, Loader2, Users } from 'lucide-react';
import {
  getOfferingRoster,
  listAttendanceRecords,
  bulkCreateAttendanceRecords,
  type RosterStudent,
} from '../../services/academics';

type Status = 'present' | 'absent' | 'late' | 'od' | 'leave';

const STATUS_META: { value: Status; label: string; Icon: typeof Check; active: string }[] = [
  { value: 'present', label: 'Present', Icon: Check, active: 'bg-teal-600 text-white border-teal-600' },
  { value: 'absent', label: 'Absent', Icon: X, active: 'bg-red-600 text-white border-red-600' },
  { value: 'late', label: 'Late', Icon: Clock, active: 'bg-amber-500 text-white border-amber-500' },
  { value: 'od', label: 'OD', Icon: Briefcase, active: 'bg-primary-600 text-white border-primary-600' },
  { value: 'leave', label: 'Leave', Icon: FileMinus, active: 'bg-slate-600 text-white border-slate-600' },
];

function studentName(s: RosterStudent): string {
  if (s.personId && typeof s.personId === 'object') return s.personId.name || s._id;
  return s.rollNumber || s._id;
}

interface Props {
  sessionId: string;
  courseOfferingId: string;
  /** A closed session is read-only. */
  readOnly?: boolean;
}

/**
 * Present/absent grid for one attendance session.
 *
 * The session modal previously showed only header metadata (date, period,
 * topic) — there was no way to actually mark a register from the UI, even
 * though the records API existed. Defaults everyone to Present, which is the
 * common case, so the operator only touches the exceptions.
 */
export default function AttendanceMarkingPanel({ sessionId, courseOfferingId, readOnly }: Props) {
  const qc = useQueryClient();
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [dirty, setDirty] = useState(false);

  const rosterQuery = useQuery({
    queryKey: ['offering-roster', courseOfferingId],
    queryFn: () => getOfferingRoster(courseOfferingId),
    enabled: Boolean(courseOfferingId),
  });

  const recordsQuery = useQuery({
    queryKey: ['attendance-records', sessionId],
    queryFn: () => listAttendanceRecords(sessionId),
    enabled: Boolean(sessionId),
  });

  const students = rosterQuery.data?.students ?? [];
  const existing = useMemo(() => {
    const map: Record<string, Status> = {};
    for (const rec of (recordsQuery.data ?? []) as any[]) {
      const sid = typeof rec.studentId === 'object' ? rec.studentId?._id : rec.studentId;
      if (sid) map[String(sid)] = rec.status;
    }
    return map;
  }, [recordsQuery.data]);

  // Seed from saved records; anyone without a record defaults to present.
  useEffect(() => {
    if (rosterQuery.isLoading || recordsQuery.isLoading) return;
    const seeded: Record<string, Status> = {};
    for (const s of students) seeded[s._id] = existing[s._id] ?? 'present';
    setMarks(seeded);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterQuery.isLoading, recordsQuery.isLoading, rosterQuery.data, recordsQuery.data]);

  const saveMut = useMutation({
    mutationFn: () => bulkCreateAttendanceRecords({
      records: students.map((s) => ({ sessionId, studentId: s._id, status: marks[s._id] ?? 'present' })),
    }),
    meta: { successMessage: 'Attendance saved' },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['attendance-records', sessionId] });
    },
  });

  function setOne(studentId: string, status: Status) {
    setMarks((m) => ({ ...m, [studentId]: status }));
    setDirty(true);
  }

  function setAll(status: Status) {
    setMarks(Object.fromEntries(students.map((s) => [s._id, status])));
    setDirty(true);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of students) {
      const st = marks[s._id] ?? 'present';
      c[st] = (c[st] ?? 0) + 1;
    }
    return c;
  }, [marks, students]);

  const loading = rosterQuery.isLoading || recordsQuery.isLoading;

  if (loading) {
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
        No students are mapped to this offering&rsquo;s section yet, so there is nobody to mark.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Users size={15} className="text-slate-400" />
          {students.length} student{students.length === 1 ? '' : 's'}
          <span className="text-slate-300">·</span>
          <span className="text-teal-700">{counts.present ?? 0} present</span>
          <span className="text-red-600">{counts.absent ?? 0} absent</span>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAll('present')} className="rounded border px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-white">
              Mark all present
            </button>
            <button type="button" onClick={() => setAll('absent')} className="rounded border px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-white">
              Mark all absent
            </button>
          </div>
        )}
      </div>

      <ul className="max-h-80 divide-y overflow-y-auto">
        {students.map((s) => {
          const current = marks[s._id] ?? 'present';
          return (
            <li key={s._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span className="min-w-0 text-sm">
                <span className="font-medium text-slate-800">{studentName(s)}</span>
                {s.rollNumber && <span className="ml-2 text-xs text-slate-500">{s.rollNumber}</span>}
              </span>
              <div role="group" aria-label={`Attendance for ${studentName(s)}`} className="flex gap-1">
                {STATUS_META.map(({ value, label, Icon, active }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={current === value}
                    onClick={() => setOne(s._id, value)}
                    title={label}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition disabled:cursor-default disabled:opacity-60 ${
                      current === value ? active : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={12} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {!readOnly && (
        <div className="flex items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3">
          <span className="text-xs text-slate-500">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <button
            type="button"
            disabled={saveMut.isPending || !dirty}
            onClick={() => saveMut.mutate()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save attendance'}
          </button>
        </div>
      )}
    </div>
  );
}

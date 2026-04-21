import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Play, Loader2 } from 'lucide-react';
import {
  listProgrammes,
  listSemesters,
  promoteStudents,
  type PromotionSummary,
} from '../../services/academics';
import PromotionResultsPanel from '../../components/academics/PromotionResultsPanel';

/**
 * PromotionPage — Task 15.
 *
 * A minimal driver page for the T9-extended `promoteStudents` backend:
 * select a programme + semester, click "Run Promotion", then render
 * `PromotionResultsPanel` with the resulting summary. The panel owns the
 * deferred-pin UX (retry-all, Pin now dialog).
 *
 * There was no existing dedicated promotion UI in admin-portal; the
 * backend function was previously only accessible via direct API calls.
 */

const inp =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

export default function PromotionPage() {
  const [programmeId, setProgrammeId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [summary, setSummary] = useState<PromotionSummary | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const programmesQuery = useQuery({
    queryKey: ['programmes', 1, 100],
    queryFn: () => listProgrammes(1, 100),
  });
  const semestersQuery = useQuery({
    queryKey: ['semesters', 1, 100],
    queryFn: () => listSemesters(1, 100),
  });

  const promoteMut = useMutation({
    mutationFn: () => promoteStudents({ semesterId, programmeId }),
    onSuccess: (data) => {
      setSummary(data);
      setRunError(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setRunError(e?.response?.data?.message || e?.message || 'Promotion run failed.');
    },
  });

  function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!programmeId || !semesterId) {
      setRunError('Select both a programme and a semester.');
      return;
    }
    setRunError(null);
    promoteMut.mutate();
  }

  const programmes = programmesQuery.data?.items || [];
  const semesters = semestersQuery.data?.items || [];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-navy">Promote Students</h2>
        <p className="text-sm text-gray-500 mt-1">
          Evaluate semester results and advance eligible students to the next year. Students
          promoted to Year N+1 are automatically pinned to the active fee structure; those with
          no published structure are listed below for manual follow-up.
        </p>
      </div>

      {/* Run form */}
      <form
        onSubmit={handleRun}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className={lbl}>Programme *</label>
            <select
              required
              value={programmeId}
              onChange={(e) => setProgrammeId(e.target.value)}
              className={inp}
            >
              <option value="">Select programme…</option>
              {programmes.map((p: { _id: string; name?: string; code?: string }) => (
                <option key={p._id} value={p._id}>
                  {p.name || p.code || p._id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Semester *</label>
            <select
              required
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              className={inp}
            >
              <option value="">Select semester…</option>
              {semesters.map((s: { _id: string; number?: number; name?: string }) => (
                <option key={s._id} value={s._id}>
                  {s.name || (s.number ? `Semester ${s.number}` : s._id)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              type="submit"
              disabled={promoteMut.isPending}
              className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
            >
              {promoteMut.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Running…
                </>
              ) : (
                <>
                  <Play size={16} /> Run Promotion
                </>
              )}
            </button>
          </div>
        </div>
        {runError && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {runError}
          </div>
        )}
      </form>

      {/* Results panel */}
      {summary && (
        <PromotionResultsPanel
          summary={summary}
          onChange={() => {
            /* no-op — panel manages its own local state */
          }}
        />
      )}
    </div>
  );
}

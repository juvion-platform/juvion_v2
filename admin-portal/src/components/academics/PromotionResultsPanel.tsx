import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, RefreshCw, UserCheck, Users } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import type { DeferredPin, PromotionSummary } from '../../services/academics';
import { getStudent } from '../../services/people';
import {
  listFeeStructureInstances,
  rePinStudent,
  type FeePinReason,
} from '../../services/fee-configuration';
import PinNowDialog from './PinNowDialog';

/**
 * PromotionResultsPanel — Task 15.
 *
 * Renders the post-promotion summary consumed from the T9-extended
 * `promoteStudents` response:
 *   { promoted, detained, yearBack, deferredPins: [{studentId, reason, targetYear}] }
 *
 * Deferred pins get a dedicated section with a "Pin now" action (Principal-
 * gated) that opens `PinNowDialog`, and a "Retry all" button that attempts
 * to auto-resolve each deferred student against a newly-approved FSI in a
 * single programme. Students are removed from the list as they succeed.
 *
 * Retry strategy:
 *   - For each deferred student, load the student + matching *active*
 *     FSIs for (programmeId, branchId). If exactly one candidate exists,
 *     call `rePinStudent` with it. If multiple or zero — keep the student
 *     in the list, update reason to prompt manual "Pin now".
 *   - Parallel when count < 20, else sequential (spec hint in task brief).
 */

const PIN_REASON_RETRY: FeePinReason = 'initial';

interface Props {
  summary: PromotionSummary;
  /** Called after any local mutation so parent can refresh its own state if needed. */
  onChange?: () => void;
}

interface DeferredRowState extends DeferredPin {
  /** Mutable "why" copy — retry failures update this with a fresher reason. */
  currentReason: string;
  /** `true` while this row is mid-retry. */
  retrying?: boolean;
}

function readRef(ref: unknown): string | undefined {
  if (!ref) return undefined;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && ref !== null && '_id' in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return undefined;
}

function readRefName(ref: unknown, fallback = '—'): string {
  if (!ref) return fallback;
  if (typeof ref === 'string') return ref.slice(-6);
  if (typeof ref === 'object' && ref !== null) {
    const obj = ref as { name?: string; code?: string; _id?: string };
    return obj.name || obj.code || (obj._id ? obj._id.slice(-6) : fallback);
  }
  return fallback;
}

function StatTile({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone: 'green' | 'yellow' | 'orange' | 'blue';
}) {
  const toneClass = {
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold text-navy mt-1">{value}</div>
      <p className="text-xs text-gray-600 mt-1">{description}</p>
    </div>
  );
}

export default function PromotionResultsPanel({ summary, onChange }: Props) {
  const userRole = useAuthStore((s) => s.user?.role ?? '');
  const isPrincipal = userRole === 'principal' || userRole === 'super_admin';

  // Local deferred list so we can remove rows as they're pinned.
  const [rows, setRows] = useState<DeferredRowState[]>(() =>
    summary.deferredPins.map((d) => ({ ...d, currentReason: d.reason })),
  );
  const [retryingAll, setRetryingAll] = useState(false);
  const [pinNowTarget, setPinNowTarget] = useState<DeferredRowState | null>(null);

  // Reset local state when summary changes (e.g. user re-runs promotion).
  useEffect(() => {
    setRows(summary.deferredPins.map((d) => ({ ...d, currentReason: d.reason })));
  }, [summary]);

  // Load student metadata for every deferred row so the table can render
  // name/roll/programme. `useQueries` lets us parallelise without writing
  // a bespoke hook.
  const studentQueries = useQueries({
    queries: rows.map((r) => ({
      queryKey: ['student', r.studentId],
      queryFn: () => getStudent(r.studentId),
      enabled: !!r.studentId,
    })),
  });

  const studentsById = useMemo(() => {
    const m = new Map<string, any>();
    rows.forEach((r, i) => {
      const q = studentQueries[i];
      if (q?.data) m.set(r.studentId, q.data);
    });
    return m;
  }, [rows, studentQueries]);

  /**
   * Best-effort retry for one student: find active FSI for their programme +
   * branch; if exactly one match, pin it; else surface a fresh reason.
   */
  async function retryOne(row: DeferredRowState): Promise<boolean> {
    const student = studentsById.get(row.studentId);
    if (!student) {
      updateRowReason(row.studentId, 'Student details not yet loaded — try again in a moment.');
      return false;
    }
    const programmeId = readRef(student.programmeId);
    const branchId = readRef(student.branchId);
    if (!programmeId) {
      updateRowReason(row.studentId, 'Student has no programme set — cannot resolve structure.');
      return false;
    }

    try {
      const fsiResp = await listFeeStructureInstances({
        programmeId,
        branchId,
        status: 'active',
        limit: 50,
      });
      const items = fsiResp.items || [];
      if (items.length === 0) {
        updateRowReason(
          row.studentId,
          'No approved fee structure available yet — waiting on Finance.',
        );
        return false;
      }
      if (items.length > 1) {
        updateRowReason(
          row.studentId,
          `${items.length} matching structures — pick one manually via "Pin now".`,
        );
        return false;
      }
      const fsi = items[0]!;
      await rePinStudent(row.studentId, {
        yearOfStudy: row.targetYear,
        targetFeeStructureInstanceId: fsi._id,
        reason: PIN_REASON_RETRY,
        remarks: 'Auto-resolved from Promotion retry-all',
      });
      // Success — drop the row.
      setRows((prev) => prev.filter((r) => r.studentId !== row.studentId));
      return true;
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      updateRowReason(
        row.studentId,
        e?.response?.data?.message || e?.message || 'Retry failed.',
      );
      return false;
    }
  }

  function updateRowReason(studentId: string, nextReason: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.studentId === studentId ? { ...r, currentReason: nextReason, retrying: false } : r,
      ),
    );
  }

  async function handleRetryAll() {
    if (rows.length === 0 || retryingAll) return;
    setRetryingAll(true);
    // Mark all as retrying for UX feedback.
    setRows((prev) => prev.map((r) => ({ ...r, retrying: true })));
    const snapshot = [...rows];
    try {
      if (snapshot.length < 20) {
        await Promise.all(snapshot.map((r) => retryOne(r)));
      } else {
        for (const r of snapshot) {
          // eslint-disable-next-line no-await-in-loop
          await retryOne(r);
        }
      }
    } finally {
      setRetryingAll(false);
      onChange?.();
    }
  }

  async function handleRetryRow(row: DeferredRowState) {
    setRows((prev) =>
      prev.map((r) => (r.studentId === row.studentId ? { ...r, retrying: true } : r)),
    );
    await retryOne(row);
    onChange?.();
  }

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Promoted"
          value={summary.promoted}
          description="Students advanced to the next year."
          tone="green"
        />
        <StatTile
          label="Detained"
          value={summary.detained}
          description="Backlogs pending — must clear first."
          tone="yellow"
        />
        <StatTile
          label="Year Back"
          value={summary.yearBack}
          description="Low SGPA / excess backlogs — repeat year."
          tone="orange"
        />
        <StatTile
          label="Deferred Pins"
          value={rows.length}
          description="Promoted, but fee structure not yet published."
          tone="blue"
        />
      </div>

      {/* Deferred pins section */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-200">
            <div>
              <h3 className="text-base font-semibold text-navy flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Students awaiting fee structure approval
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                These students were promoted, but their new year's fee structure isn't published
                yet. Pin them once Finance approves.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRetryAll}
              disabled={retryingAll || !isPrincipal}
              title={!isPrincipal ? 'Principal role required' : undefined}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-primary-300 text-primary-700 bg-white hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} className={retryingAll ? 'animate-spin' : ''} />
              {retryingAll ? 'Retrying…' : 'Retry all'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Student</th>
                  <th className="px-5 py-2 font-medium">Roll No</th>
                  <th className="px-5 py-2 font-medium">Target Year</th>
                  <th className="px-5 py-2 font-medium">Reason</th>
                  <th className="px-5 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const student = studentsById.get(r.studentId);
                  const studentName =
                    student?.person?.name ||
                    student?.personId?.name ||
                    readRefName(student?.personId);
                  const programmeName = readRefName(student?.programmeId);
                  return (
                    <tr key={r.studentId}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-navy">
                          {studentName || <span className="text-gray-400 italic">loading…</span>}
                        </div>
                        <div className="text-xs text-gray-500">{programmeName}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        {student?.rollNumber || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                          Year {r.targetYear}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600 max-w-md">
                        <span className="line-clamp-2" title={r.currentReason}>
                          {r.currentReason}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRetryRow(r)}
                            disabled={r.retrying || !isPrincipal}
                            title={!isPrincipal ? 'Principal role required' : 'Retry auto-resolve'}
                            className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RefreshCw size={12} className={r.retrying ? 'animate-spin' : ''} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPinNowTarget(r)}
                            disabled={!isPrincipal}
                            title={!isPrincipal ? 'Principal role required' : 'Pin to a specific structure'}
                            className="px-3 py-1 text-xs rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Pin now
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty / all-pinned state */}
      {rows.length === 0 && summary.deferredPins.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-green-600 mt-0.5" />
          <div className="text-sm text-green-800">
            All deferred students have been pinned. Fee commitment sheets are being generated
            in the background.
          </div>
        </div>
      )}

      {/* Baseline summary-only state */}
      {summary.deferredPins.length === 0 && (summary.promoted > 0 || summary.detained > 0 || summary.yearBack > 0) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
          <UserCheck size={18} className="text-primary-600" />
          <div className="text-sm text-gray-700">
            Promotion complete. All promoted students were pinned to their Year-N+1 fee structure.
          </div>
        </div>
      )}

      {/* Zero-activity state */}
      {summary.promoted === 0 && summary.detained === 0 && summary.yearBack === 0 && summary.deferredPins.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
          <Users size={18} className="text-gray-400" />
          <div className="text-sm text-gray-500">
            No semester results available to promote. Publish semester results first.
          </div>
        </div>
      )}

      {/* Pin-now dialog */}
      {pinNowTarget && (
        <PinNowDialog
          open={!!pinNowTarget}
          onClose={() => setPinNowTarget(null)}
          studentId={pinNowTarget.studentId}
          targetYear={pinNowTarget.targetYear}
          deferralReason={pinNowTarget.currentReason}
          onPinned={(sid) => {
            setRows((prev) => prev.filter((r) => r.studentId !== sid));
            onChange?.();
          }}
        />
      )}
    </div>
  );
}

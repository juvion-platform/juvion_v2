import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  AlertTriangle,
  FileText,
  RefreshCw,
  History,
  Pin,
  ChevronDown,
  ChevronUp,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  getStudentPins,
  regenerateCommitmentSheet,
  type IFeePin,
  type PopulatedFeeStructureInstance,
} from '../../services/fee-configuration';
import {
  getDefaulters,
  pauseEscalation,
  type DefaulterListItem,
} from '../../services/finance';
import { DetailSection, DetailField, formatDate } from '../ui/DetailView';
import Badge from '../ui/Badge';
import RePinDialog from './RePinDialog';

interface Props {
  studentId: string;
  /** Pre-filter context for the re-pin target dropdown. */
  programmeId?: string;
  branchId?: string;
  academicYearId?: string;
  quota?: string;
  category?: string;
  /** Year-of-study hint for dialog default. */
  currentYearOfStudy?: number;
}

const COMMIT_STATUS_COLOR: Record<string, string> = {
  queued: 'warning',
  generated: 'success',
  failed: 'danger',
};

function isPopulatedFsi(
  x: unknown,
): x is PopulatedFeeStructureInstance {
  return !!x && typeof x === 'object' && '_id' in (x as object);
}

function fsiId(pin: IFeePin): string {
  return isPopulatedFsi(pin.feeStructureInstanceId)
    ? pin.feeStructureInstanceId._id
    : String(pin.feeStructureInstanceId);
}

function fsiName(pin: IFeePin): string {
  const f = pin.feeStructureInstanceId;
  if (isPopulatedFsi(f)) {
    return f.name || f.code || f._id.slice(-8);
  }
  return String(f).slice(-8);
}

function fsiTotal(pin: IFeePin): string {
  const f = pin.feeStructureInstanceId;
  if (isPopulatedFsi(f) && typeof f.totalAmount === 'number') {
    return `₹${f.totalAmount.toLocaleString('en-IN')}`;
  }
  return '—';
}

function fsiApprovedAt(pin: IFeePin): string | undefined {
  const f = pin.feeStructureInstanceId;
  if (isPopulatedFsi(f) && f.approvedAt) return formatDate(f.approvedAt);
  return undefined;
}

function reasonLabel(reason: string | undefined): string {
  if (!reason) return '—';
  return reason.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FeePinsPanel({
  studentId,
  programmeId,
  branchId,
  academicYearId,
  quota,
  category,
  currentYearOfStudy,
}: Props) {
  const qc = useQueryClient();
  const userRole = useAuthStore((s) => s.user?.role ?? '');
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canPauseEscalation = hasPermission('finance', 'update');
  const isPrincipal = userRole === 'principal' || userRole === 'super_admin';

  const [rePinOpen, setRePinOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [regenPinId, setRegenPinId] = useState<string | null>(null);
  // Auto-escalation pause block state
  const [pauseUntilInput, setPauseUntilInput] = useState<string>('');
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [pauseMessage, setPauseMessage] = useState<string | null>(null);

  const pinsQuery = useQuery({
    queryKey: ['student-pins', studentId],
    queryFn: () => getStudentPins(studentId),
    enabled: !!studentId,
  });

  // Fetch defaulters to locate this student's auto-escalation state.
  // Using the defaulters list (T8 §Journey 1) because T8 didn't ship a
  // per-student GET; sort + large limit so the student is reliably in
  // the first page. Filter client-side to find this student's row.
  const defaultersQuery = useQuery({
    queryKey: ['finance-defaulters', 'all'],
    queryFn: () => getDefaulters({ limit: 100, sort: 'daysOverdue' }),
    enabled: !!studentId,
    staleTime: 30_000,
  });

  const defaulterRow: DefaulterListItem | undefined = useMemo(() => {
    const items = defaultersQuery.data?.items ?? [];
    return items.find((d) => String(d.studentId) === String(studentId));
  }, [defaultersQuery.data, studentId]);

  const now = Date.now();
  const pausedUntilDate = defaulterRow?.autoEscalationPaused
    ? new Date(defaulterRow.autoEscalationPaused)
    : null;
  const isCurrentlyPaused =
    !!pausedUntilDate && pausedUntilDate.getTime() > now;

  const pauseMut = useMutation({
    mutationFn: (pausedUntilIso: string) =>
      pauseEscalation(studentId, pausedUntilIso),
    onMutate: () => {
      setPauseError(null);
      setPauseMessage(null);
    },
    onSuccess: (res) => {
      setPauseMessage(
        res.updated > 0
          ? `Updated ${res.updated} defaulter record${res.updated === 1 ? '' : 's'}.`
          : 'Pause state updated.',
      );
      setPauseUntilInput('');
      qc.invalidateQueries({ queryKey: ['finance-defaulters'] });
      qc.invalidateQueries({ queryKey: ['student-pins', studentId] });
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setPauseError(
        e?.response?.data?.message ||
          e?.message ||
          'Failed to update auto-escalation pause.',
      );
    },
  });

  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const maxPauseIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  }, []);

  function submitPause() {
    if (!pauseUntilInput) {
      setPauseError('Please pick a date to pause until.');
      return;
    }
    // `<input type="date">` returns YYYY-MM-DD (local). Convert to
    // end-of-day UTC ISO so the cron's `> now` check holds for the full
    // chosen day regardless of timezone.
    const [y, m, d] = pauseUntilInput.split('-').map(Number);
    if (!y || !m || !d) {
      setPauseError('Invalid date.');
      return;
    }
    const iso = new Date(Date.UTC(y, m - 1, d, 23, 59, 59)).toISOString();
    pauseMut.mutate(iso);
  }

  function submitResume() {
    // "Resume now" = pass the current timestamp. Cron guard is `> now`,
    // so any value ≤ now means un-paused on the next run.
    pauseMut.mutate(new Date().toISOString());
  }

  const regenMut = useMutation({
    mutationFn: (pinId: string) => regenerateCommitmentSheet(studentId, { pinId }),
    onMutate: (pinId) => { setRegenPinId(pinId); setActionError(null); setActionMessage(null); },
    onSuccess: () => {
      setActionMessage('Commitment sheet regeneration queued.');
      qc.invalidateQueries({ queryKey: ['student-pins', studentId] });
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to regenerate sheet.');
    },
    onSettled: () => { setRegenPinId(null); },
  });

  const { active, archived, hasStale } = useMemo(() => {
    const pins = pinsQuery.data?.pins ?? [];
    const a: IFeePin[] = [];
    const ar: IFeePin[] = [];
    let stale = false;
    for (const p of pins) {
      if (p.archivedAt) ar.push(p);
      else {
        a.push(p);
        if (p.staleSince) stale = true;
      }
    }
    a.sort((x, y) => x.yearOfStudy - y.yearOfStudy);
    ar.sort((x, y) => {
      const xt = x.archivedAt ? new Date(x.archivedAt).getTime() : 0;
      const yt = y.archivedAt ? new Date(y.archivedAt).getTime() : 0;
      return yt - xt;
    });
    return { active: a, archived: ar, hasStale: stale };
  }, [pinsQuery.data]);

  // ── Loading / error shells ──────────────────────────────
  if (pinsQuery.isLoading) {
    return (
      <section className="bg-white rounded-xl border shadow-sm">
        <header className="px-5 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">Fee Pins</h3>
        </header>
        <div className="p-5 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading fee pins…
        </div>
      </section>
    );
  }

  if (pinsQuery.error) {
    return (
      <section className="bg-white rounded-xl border shadow-sm">
        <header className="px-5 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">Fee Pins</h3>
        </header>
        <div className="p-5 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200 m-5">
          Couldn't load fee pins.{' '}
          <button
            className="underline"
            onClick={() => pinsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Stale banner */}
      {hasStale && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <div className="font-medium">Stale fee pin detected</div>
            <div>
              One or more active pins may no longer match this student's current attributes
              (branch/quota/category changed since pinning). Review and re-pin to ensure correct
              fee resolution.
            </div>
          </div>
        </div>
      )}

      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <header className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy uppercase tracking-wide flex items-center gap-2">
            <Pin className="w-4 h-4" /> Fee Pins
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRePinOpen(true)}
              disabled={!isPrincipal}
              title={
                isPrincipal
                  ? 'Manually re-pin to a different fee structure'
                  : 'Principal role required to re-pin'
              }
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-pin
            </button>
          </div>
        </header>

        {/* Action feedback */}
        {(actionError || actionMessage) && (
          <div className="px-5 pt-4">
            {actionError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {actionError}
              </div>
            )}
            {actionMessage && !actionError && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {actionMessage}
              </div>
            )}
          </div>
        )}

        {/* Active pins */}
        {active.length === 0 ? (
          <div className="p-5 text-sm text-gray-500">
            No active fee pins for this student.
            {isPrincipal && ' Use "Re-pin" to create one manually.'}
          </div>
        ) : (
          <div className="divide-y">
            {active.map((pin) => {
              const staleNote = pin.staleSince ? formatDate(pin.staleSince) : null;
              const commitStatus = pin.commitmentSheetStatus;
              const docId = pin.commitmentSheetDocumentId;
              return (
                <div key={pin._id} className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="info">Year {pin.yearOfStudy}</Badge>
                    {staleNote && (
                      <Badge variant="warning">Stale since {staleNote}</Badge>
                    )}
                    {commitStatus && (
                      <Badge variant={COMMIT_STATUS_COLOR[commitStatus] || 'default'}>
                        Sheet: {commitStatus}
                      </Badge>
                    )}
                  </div>

                  <DetailSection title={`Active Pin — Year ${pin.yearOfStudy}`} columns={3}>
                    <DetailField label="Fee Structure" value={fsiName(pin)} />
                    <DetailField label="Total Amount" value={fsiTotal(pin)} />
                    <DetailField label="Structure Approved" value={fsiApprovedAt(pin) ?? ''} />
                    <DetailField label="Pinned At" value={formatDate(pin.pinnedAt)} />
                    <DetailField label="Pinned By" value={pin.pinnedBy} mono />
                    <DetailField label="Reason" value={reasonLabel(pin.reason)} />
                    <DetailField label="Source Pin ID" value={pin._id.slice(-12)} mono />
                    <DetailField label="Structure ID" value={fsiId(pin).slice(-12)} mono />
                    <DetailField label="Remarks" value={pin.remarks ?? ''} wide />
                  </DetailSection>

                  <div className="flex items-center gap-2 flex-wrap">
                    {docId ? (
                      <a
                        href={`/platform/documents/${docId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border hover:bg-gray-100"
                      >
                        <FileText className="w-3.5 h-3.5" /> View Commitment Sheet
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 px-3 py-1.5">
                        <FileText className="w-3.5 h-3.5" /> No sheet generated yet
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => regenMut.mutate(pin._id)}
                      disabled={regenMut.isPending && regenPinId === pin._id}
                      className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {regenMut.isPending && regenPinId === pin._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Regenerate Sheet
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Archived history toggle */}
        {archived.length > 0 && (
          <div className="border-t">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <span className="inline-flex items-center gap-2">
                <History className="w-4 h-4" />
                Show history ({archived.length})
              </span>
              {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showHistory && (
              <div className="divide-y bg-gray-50/50">
                {archived.map((pin) => (
                  <div key={pin._id} className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="default">Year {pin.yearOfStudy}</Badge>
                      <Badge variant="default">Archived</Badge>
                    </div>
                    <DetailSection title={`Archived Pin — Year ${pin.yearOfStudy}`} columns={3}>
                      <DetailField label="Fee Structure" value={fsiName(pin)} />
                      <DetailField label="Total Amount" value={fsiTotal(pin)} />
                      <DetailField label="Pinned At" value={formatDate(pin.pinnedAt)} />
                      <DetailField label="Pinned By" value={pin.pinnedBy} mono />
                      <DetailField label="Reason" value={reasonLabel(pin.reason)} />
                      <DetailField label="Archived At" value={formatDate(pin.archivedAt || '')} />
                      <DetailField label="Archive Reason" value={reasonLabel(pin.archiveReason)} wide />
                      <DetailField label="Remarks" value={pin.remarks ?? ''} wide />
                    </DetailSection>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ═══ Auto-Escalation Control (T11) ═══════════════════════════ */}
      <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <header className="px-5 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-navy uppercase tracking-wide flex items-center gap-2">
            <PauseCircle className="w-4 h-4" /> Auto-Escalation Control
          </h3>
        </header>

        <div className="p-5 space-y-3">
          {/* Status line */}
          {defaultersQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading status…
            </div>
          ) : defaultersQuery.error ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Couldn't load auto-escalation status.{' '}
              <button
                className="underline"
                onClick={() => defaultersQuery.refetch()}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : !defaulterRow ? (
            <div className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">Status:</span>{' '}
              Not a defaulter — nothing to pause.
            </div>
          ) : isCurrentlyPaused ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="warning">Paused</Badge>
              <span className="text-sm text-gray-700">
                Currently paused until{' '}
                <span className="font-medium">
                  {formatDate(pausedUntilDate!.toISOString())}
                </span>
                .
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="success">Active</Badge>
              <span className="text-sm text-gray-700">
                Cron auto-escalation is running normally for this student.
              </span>
            </div>
          )}

          {/* Action feedback */}
          {pauseError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {pauseError}
            </div>
          )}
          {pauseMessage && !pauseError && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {pauseMessage}
            </div>
          )}

          {/* Controls (Finance-Officer / super-admin only) */}
          {canPauseEscalation && defaulterRow && (
            <div className="pt-2 border-t border-gray-100">
              {isCurrentlyPaused ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={submitResume}
                    disabled={pauseMut.isPending}
                    className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pauseMut.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlayCircle className="w-3.5 h-3.5" />
                    )}
                    Resume now
                  </button>
                  <span className="text-xs text-gray-500">
                    Resuming clears the pause on the next cron run.
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col">
                    <label
                      htmlFor="pause-until-input"
                      className="text-xs font-medium text-gray-600 mb-1"
                    >
                      Pause until
                    </label>
                    <input
                      id="pause-until-input"
                      type="date"
                      value={pauseUntilInput}
                      min={tomorrowIso}
                      max={maxPauseIso}
                      onChange={(e) => setPauseUntilInput(e.target.value)}
                      disabled={pauseMut.isPending}
                      className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:bg-gray-50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={submitPause}
                    disabled={pauseMut.isPending || !pauseUntilInput}
                    className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                  >
                    {pauseMut.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PauseCircle className="w-3.5 h-3.5" />
                    )}
                    Pause
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-3">
                Finance Officer can pause cron escalations on this student
                (e.g., after Principal approves a delay). Max 90 days.
              </p>
            </div>
          )}
          {!canPauseEscalation && defaulterRow && (
            <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
              Only users with <code>finance:update</code> permission can
              change the auto-escalation pause state.
            </p>
          )}
        </div>
      </section>

      <RePinDialog
        open={rePinOpen}
        onClose={() => setRePinOpen(false)}
        studentId={studentId}
        programmeId={programmeId}
        branchId={branchId}
        academicYearId={academicYearId}
        quota={quota}
        category={category}
        defaultYearOfStudy={currentYearOfStudy ?? active[0]?.yearOfStudy ?? 1}
      />
    </>
  );
}

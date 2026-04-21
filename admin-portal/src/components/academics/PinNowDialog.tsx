import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Modal from '../ui/Modal';
import {
  listFeeStructureInstances,
  rePinStudent,
  type FeePinReason,
  type PopulatedFeeStructureInstance,
} from '../../services/fee-configuration';
import { getStudent } from '../../services/people';

/**
 * PinNowDialog — Task 15.
 *
 * Opens from `PromotionResultsPanel` when an admin clicks "Pin now" for a
 * deferred student. Shows the student's context (year, programme, branch,
 * quota, category), async-loads available FeeStructureInstance candidates
 * filtered by programme + targetYear, and on submit calls the T12
 * `POST /finance/students/:id/pins/re-pin` endpoint via
 * `rePinStudent()` from `services/fee-configuration.ts`.
 *
 * This component is Principal-gated at the *caller* level — the parent
 * (`PromotionResultsPanel`) already checks role before rendering the
 * "Pin now" button. The dialog itself does not re-check.
 */

const inp =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

const REASONS: Array<{ value: FeePinReason; label: string }> = [
  { value: 'initial', label: 'Initial pin (promotion catch-up)' },
  { value: 'admin_override', label: 'Admin override' },
  { value: 'data_correction', label: 'Data correction' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string;
  targetYear: number;
  /** Last-known deferral reason, shown inline for context. */
  deferralReason?: string;
  /** Called after a successful pin; parent removes the student from deferred list. */
  onPinned: (studentId: string) => void;
}

function fsiLabel(fsi: PopulatedFeeStructureInstance): string {
  const parts: string[] = [];
  if (fsi.name) parts.push(fsi.name);
  else if (fsi.code) parts.push(fsi.code);
  else parts.push(fsi._id.slice(-6));
  if (fsi.version) parts.push(`v${fsi.version}`);
  if (typeof fsi.totalAmount === 'number') parts.push(`₹${fsi.totalAmount.toLocaleString('en-IN')}`);
  return parts.join(' • ');
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

export default function PinNowDialog({
  open,
  onClose,
  studentId,
  targetYear,
  deferralReason,
  onPinned,
}: Props) {
  const [selectedFsiId, setSelectedFsiId] = useState('');
  const [reason, setReason] = useState<FeePinReason>('initial');
  const [remarks, setRemarks] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const studentQuery = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => getStudent(studentId),
    enabled: open && !!studentId,
  });

  const student = studentQuery.data;
  const programmeId = readRef(student?.programmeId);
  const branchId = readRef(student?.branchId);
  // academicYearId is derived from the student's batch on the backend when
  // we don't supply one. For the FSI dropdown we filter only by programme
  // + branch to avoid over-constraining; admins can still pick the right
  // year from the list. (Spec §EC-5: the whole point of Pin-now is that
  // Finance has just now approved the structure.)

  const fsiQuery = useQuery({
    queryKey: ['fsi-candidates', programmeId, branchId, targetYear],
    // Pin-Now should only surface *approved* structures — filter by status.
    queryFn: () =>
      listFeeStructureInstances({
        programmeId,
        branchId,
        status: 'active',
        limit: 50,
      }),
    enabled: open && !!programmeId,
  });

  const candidates = useMemo(() => fsiQuery.data?.items ?? [], [fsiQuery.data]);

  const pinMut = useMutation({
    mutationFn: () =>
      rePinStudent(studentId, {
        yearOfStudy: targetYear,
        targetFeeStructureInstanceId: selectedFsiId,
        reason,
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: () => {
      onPinned(studentId);
      // Reset + close.
      setSelectedFsiId('');
      setReason('initial');
      setRemarks('');
      setSubmitError(null);
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setSubmitError(e?.response?.data?.message || e?.message || 'Failed to pin student.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!selectedFsiId) {
      setSubmitError('Select a Fee Structure Instance to pin against.');
      return;
    }
    pinMut.mutate();
  }

  const studentName =
    student?.person?.name ||
    student?.personId?.name ||
    student?.rollNumber ||
    (studentId ? studentId.slice(-6) : '');

  return (
    <Modal open={open} onClose={onClose} title={`Pin student to Year ${targetYear}`} widthClass="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student context */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm font-semibold text-navy mb-2">{studentName}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
            <div><span className="text-gray-400">Roll:</span> {student?.rollNumber || '—'}</div>
            <div><span className="text-gray-400">Target year:</span> {targetYear}</div>
            <div><span className="text-gray-400">Programme:</span> {readRefName(student?.programmeId)}</div>
            <div><span className="text-gray-400">Branch:</span> {readRefName(student?.branchId)}</div>
            <div><span className="text-gray-400">Quota:</span> {student?.quota || '—'}</div>
            <div><span className="text-gray-400">Category:</span> {student?.category || '—'}</div>
          </div>
          {deferralReason && (
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              <span className="font-semibold">Deferred because:</span> {deferralReason}
            </div>
          )}
        </div>

        {/* FSI picker */}
        <div>
          <label className={lbl}>Fee Structure Instance *</label>
          {fsiQuery.isLoading ? (
            <div className="text-sm text-gray-500 italic px-1 py-2">Loading candidates…</div>
          ) : candidates.length === 0 ? (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              No approved fee structures found for this programme. Finance must publish one before
              pinning.
            </div>
          ) : (
            <select
              required
              value={selectedFsiId}
              onChange={(e) => setSelectedFsiId(e.target.value)}
              className={inp}
            >
              <option value="">Select a structure…</option>
              {candidates.map((fsi) => (
                <option key={fsi._id} value={fsi._id}>
                  {fsiLabel(fsi)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className={lbl}>Reason *</label>
          <select
            required
            value={reason}
            onChange={(e) => setReason(e.target.value as FeePinReason)}
            className={inp}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Remarks */}
        <div>
          <label className={lbl}>Remarks</label>
          <textarea
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className={inp}
            placeholder="Optional — e.g. Finance approved on 2026-04-21"
          />
        </div>

        {submitError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pinMut.isPending || !selectedFsiId || candidates.length === 0}
            className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pinMut.isPending ? 'Pinning…' : 'Pin now'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

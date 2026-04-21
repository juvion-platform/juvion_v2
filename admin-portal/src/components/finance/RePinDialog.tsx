import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import {
  rePinStudent,
  listFeeStructureInstances,
  type FeePinReason,
  type PopulatedFeeStructureInstance,
} from '../../services/fee-configuration';

const inp =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

const REASON_OPTIONS: Array<{ value: FeePinReason; label: string }> = [
  { value: 'admin_override', label: 'Admin override' },
  { value: 'branch_change', label: 'Branch change' },
  { value: 'quota_change', label: 'Quota change' },
  { value: 'data_correction', label: 'Data correction' },
  { value: 'programme_transfer', label: 'Programme transfer' },
  { value: 'year_back_carryforward', label: 'Year-back carry-forward' },
  { value: 'initial', label: 'Initial (bootstrap)' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  studentId: string;
  /** Student attrs are used to pre-filter the target structure dropdown. */
  programmeId?: string;
  branchId?: string;
  academicYearId?: string;
  quota?: string;
  category?: string;
  /** Year-of-study options to seed the selector. */
  defaultYearOfStudy?: number;
}

export default function RePinDialog({
  open,
  onClose,
  studentId,
  programmeId,
  branchId,
  academicYearId,
  quota,
  category,
  defaultYearOfStudy = 1,
}: Props) {
  const qc = useQueryClient();
  const [yearOfStudy, setYearOfStudy] = useState<number>(defaultYearOfStudy);
  const [targetId, setTargetId] = useState<string>('');
  const [reason, setReason] = useState<FeePinReason>('admin_override');
  const [remarks, setRemarks] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const structuresQuery = useQuery({
    queryKey: [
      'fee-structure-instances',
      { programmeId, branchId, academicYearId, quota, category },
    ],
    queryFn: () =>
      listFeeStructureInstances({
        programmeId,
        branchId,
        academicYearId,
        quota,
        category,
        limit: 100,
      }),
    enabled: open,
  });

  const structures: PopulatedFeeStructureInstance[] = useMemo(
    () => structuresQuery.data?.items ?? [],
    [structuresQuery.data],
  );

  const rePinMut = useMutation({
    mutationFn: () =>
      rePinStudent(studentId, {
        yearOfStudy,
        targetFeeStructureInstanceId: targetId,
        reason,
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-pins', studentId] });
      qc.invalidateQueries({ queryKey: ['student', studentId] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message || err?.message || 'Re-pin failed');
    },
  });

  function resetForm() {
    setYearOfStudy(defaultYearOfStudy);
    setTargetId('');
    setReason('admin_override');
    setRemarks('');
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!targetId) {
      setFormError('Select a target fee structure instance.');
      return;
    }
    if (!reason) {
      setFormError('Select a reason.');
      return;
    }
    rePinMut.mutate();
  }

  function fsiLabel(fsi: PopulatedFeeStructureInstance): string {
    const parts: string[] = [];
    if (fsi.name) parts.push(fsi.name);
    else if (fsi.code) parts.push(fsi.code);
    else parts.push(String(fsi._id).slice(-8));
    if (fsi.version != null) parts.push(`v${fsi.version}`);
    if (typeof fsi.totalAmount === 'number') parts.push(`₹${fsi.totalAmount.toLocaleString('en-IN')}`);
    if (fsi.status) parts.push(`[${fsi.status}]`);
    return parts.join(' · ');
  }

  return (
    <Modal open={open} onClose={() => { onClose(); resetForm(); }} title="Re-pin Fee Structure" widthClass="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Manually re-pin this student to a different fee structure instance. This action is
          Principal-only and creates a permanent audit trail. The current pin for this
          year-of-study will be archived.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Year of Study</label>
            <select
              className={inp}
              value={yearOfStudy}
              onChange={(e) => setYearOfStudy(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Reason</label>
            <select
              className={inp}
              value={reason}
              onChange={(e) => setReason(e.target.value as FeePinReason)}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={lbl}>Target Fee Structure Instance</label>
          {structuresQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading structures…
            </div>
          ) : structures.length === 0 ? (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No fee structure instances found matching this student's attributes. Finance may
              need to approve one first.
            </div>
          ) : (
            <select
              className={inp}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
            >
              <option value="">— Select target structure —</option>
              {structures.map((fsi) => (
                <option key={fsi._id} value={fsi._id}>
                  {fsiLabel(fsi)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className={lbl}>Remarks (optional)</label>
          <textarea
            className={inp}
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Context for the audit log (e.g. 'approved by Finance Committee 2026-04')"
          />
        </div>

        {formError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {formError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={() => { onClose(); resetForm(); }}
            className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            disabled={rePinMut.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
            disabled={rePinMut.isPending || !targetId}
          >
            {rePinMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Re-pin
          </button>
        </div>
      </form>
    </Modal>
  );
}

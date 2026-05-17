import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { listProgrammes, listBranches, listRegulations, listAcademicYears } from '../../services/academics';
import { transferProgramme, type TransferProgrammeInput } from '../../services/fee-configuration';

/**
 * ProgrammeTransferDialog — the only safe path for changing a student's
 * programmeId. The generic /api/people/students/:id PATCH endpoint
 * rejects programmeId changes with a 403 because the fee-pin re-bind
 * has to happen atomically (archive old pin → re-pin against the new
 * structure → roll back if the new programme has no active structure).
 *
 * Wraps `services/fee-configuration.transferProgramme()` which posts to
 * `POST /api/finance/students/:id/transfer-programme`.
 */

interface Props {
  studentId: string;
  currentProgrammeId: string;
  currentProgrammeName?: string;
  currentYear?: number;
  onClose: () => void;
  onSuccess: () => void;
}

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const lbl = 'text-sm font-medium text-gray-700 mb-1 block';

const TRANSFER_REASONS = [
  'student_request',
  'admin_correction',
  'regulation_change',
  'programme_rename',
  'other',
] as const;

export default function ProgrammeTransferDialog({
  studentId,
  currentProgrammeId,
  currentProgrammeName,
  currentYear,
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<{
    newProgrammeId: string;
    newBranchId: string;
    newRegulationId: string;
    effectiveYearOfStudy: string;
    academicYearId: string;
    reason: typeof TRANSFER_REASONS[number];
  }>({
    newProgrammeId: '',
    newBranchId: '',
    newRegulationId: '',
    effectiveYearOfStudy: String(currentYear ?? 1),
    academicYearId: '',
    reason: TRANSFER_REASONS[0],
  });
  const [validationError, setValidationError] = useState<string>('');

  const { data: programmesData } = useQuery({ queryKey: ['programmes'], queryFn: () => listProgrammes(1, 200) });
  const { data: branchesData } = useQuery({ queryKey: ['branches'], queryFn: () => listBranches(1, 200) });
  const { data: regulationsData } = useQuery({ queryKey: ['regulations'], queryFn: () => listRegulations(1, 200) });
  const { data: academicYearsData } = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears(1, 50) });

  const programmes = programmesData?.items ?? [];
  const branches = branchesData?.items ?? [];
  const regulations = regulationsData?.items ?? [];
  const academicYears = academicYearsData?.items ?? [];

  // Filter branches to those belonging to the chosen programme.
  const filteredBranches = useMemo(() => {
    if (!form.newProgrammeId) return [] as any[];
    return branches.filter((b: any) => String(b.programmeId?._id ?? b.programmeId) === form.newProgrammeId);
  }, [branches, form.newProgrammeId]);

  const mut = useMutation({
    mutationFn: (data: TransferProgrammeInput) => transferProgramme(studentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', studentId] });
      qc.invalidateQueries({ queryKey: ['student-pins', studentId] });
      qc.invalidateQueries({ queryKey: ['students'] });
      onSuccess();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError('');

    if (!form.newProgrammeId) return setValidationError('Pick the new programme.');
    if (form.newProgrammeId === currentProgrammeId) return setValidationError('New programme must differ from the current programme.');
    if (!form.academicYearId) return setValidationError('Pick the academic year the transfer takes effect in.');
    const year = Number(form.effectiveYearOfStudy);
    if (!Number.isInteger(year) || year < 1 || year > 6) return setValidationError('Effective year of study must be an integer between 1 and 6.');
    if (!form.reason) return setValidationError('Select a transfer reason for the audit trail.');

    const payload: TransferProgrammeInput = {
      newProgrammeId: form.newProgrammeId,
      effectiveYearOfStudy: year,
      academicYearId: form.academicYearId,
      reason: form.reason,
    };
    if (form.newBranchId) payload.newBranchId = form.newBranchId;
    if (form.newRegulationId) payload.newRegulationId = form.newRegulationId;
    mut.mutate(payload);
  }

  const apiErrorMsg = (mut.error as any)?.response?.data?.error || (mut.error as Error | null)?.message;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mt-10 mb-10">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <h3 className="text-base font-semibold text-navy">Transfer Programme</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Rebinds the fee pin atomically to the new programme&apos;s active structure.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {currentProgrammeName && (
            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
              <span className="font-medium">From:</span>
              <span>{currentProgrammeName}</span>
              <ArrowRight size={12} className="text-gray-400" />
              <span className="text-gray-400">new programme below</span>
            </div>
          )}

          <div>
            <label className={lbl}>New Programme *</label>
            <select required value={form.newProgrammeId} onChange={(e) => setForm((f) => ({ ...f, newProgrammeId: e.target.value, newBranchId: '' }))} className={inp}>
              <option value="">Select programme</option>
              {programmes.map((p: any) => (
                <option key={p._id} value={p._id} disabled={p._id === currentProgrammeId}>
                  {p.name || p.code}{p._id === currentProgrammeId ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl}>New Branch <span className="text-gray-400">(optional)</span></label>
            <select value={form.newBranchId} onChange={(e) => setForm((f) => ({ ...f, newBranchId: e.target.value }))} className={inp} disabled={!form.newProgrammeId}>
              <option value="">{form.newProgrammeId ? 'Same as current' : 'Pick a programme first'}</option>
              {filteredBranches.map((b: any) => (
                <option key={b._id} value={b._id}>{b.name || b.code}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl}>New Regulation <span className="text-gray-400">(optional)</span></label>
            <select value={form.newRegulationId} onChange={(e) => setForm((f) => ({ ...f, newRegulationId: e.target.value }))} className={inp}>
              <option value="">Same as current</option>
              {regulations.map((r: any) => (
                <option key={r._id} value={r._id}>{(r.code ?? '') + (r.name ? ' — ' + r.name : '')}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Effective Year of Study *</label>
              <input
                type="number"
                required
                min={1}
                max={6}
                value={form.effectiveYearOfStudy}
                onChange={(e) => setForm((f) => ({ ...f, effectiveYearOfStudy: e.target.value }))}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Academic Year *</label>
              <select required value={form.academicYearId} onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                <option value="">Select year</option>
                {academicYears.map((ay: any) => (
                  <option key={ay._id} value={ay._id}>{ay.label || ay.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Reason *</label>
            <select required value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value as typeof TRANSFER_REASONS[number] }))} className={inp}>
              {TRANSFER_REASONS.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {validationError && (
            <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
          {apiErrorMsg && (
            <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{apiErrorMsg}</span>
            </div>
          )}
          {mut.isSuccess && (
            <div className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <span>Transfer complete. The student&apos;s fee pin has been rebound.</span>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-gray-50">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={mut.isPending}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={14} className="animate-spin" />}
            {mut.isPending ? 'Transferring...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

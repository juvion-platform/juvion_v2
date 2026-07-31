/**
 * GenerateBillsPage — turn pinned students into semester-installment invoices (007).
 *
 * The bridge that makes fees payable: it bills every active student holding a fee pin
 * for the chosen semester (annual fee ÷ 2), which gives them a StudentFeeAccount balance
 * a payment can then reduce. Dry-run → confirm against real numbers → generate, mirroring
 * the Pin Coverage bulk-pin flow. Mounted at /finance/fee-management/generate-bills.
 *
 * finance:create gated (admin / ST-ACC — NOT principal, which holds only approve+read).
 */
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Receipt, Loader2 } from 'lucide-react';

import { listSemesters } from '../../services/academics';
import { generateFeeBills, type GenerateFeeBillsResult } from '../../services/finance';
import { useAuthStore } from '../../stores/authStore';
import { confirmAction } from '../../stores/confirmStore';
import { toast } from '../../stores/toastStore';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function GenerateBillsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canGenerate = hasPermission('finance', 'create');

  const [semesterId, setSemesterId] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [lastResult, setLastResult] = useState<GenerateFeeBillsResult | null>(null);

  const { data: semData } = useQuery({ queryKey: ['semesters-billing'], queryFn: () => listSemesters(1, 200) });
  const semesters: any[] = semData?.items || [];

  const genMut = useMutation({
    mutationFn: (body: { semesterId: string; yearOfStudy?: number }) => generateFeeBills(body),
    meta: { silent: true },
    onSuccess: (res) => {
      setLastResult(res);
      if (res.generated > 0 && res.errors.length === 0) {
        toast.success(`Generated ${res.generated} bill${res.generated === 1 ? '' : 's'}`);
      } else {
        toast.warning(
          `Generated ${res.generated}`,
          [
            res.alreadyBilled ? `${res.alreadyBilled} already billed.` : '',
            res.noPin ? `${res.noPin} not pinned.` : '',
            res.pinnedToDifferentAy ? `${res.pinnedToDifferentAy} pinned to another year.` : '',
            res.noAmount ? `${res.noAmount} have no amount.` : '',
            res.errors.length ? `${res.errors.length} failed.` : '',
          ].filter(Boolean).join(' '),
        );
      }
    },
  });

  async function preview() {
    if (!semesterId) { toast.warning('Pick a semester first'); return; }
    const body = { semesterId, ...(yearOfStudy ? { yearOfStudy: Number(yearOfStudy) } : {}) };
    const dry = await generateFeeBills({ ...body, dryRun: true });
    const ok = await confirmAction({
      title: `Generate ${dry.generated} bill${dry.generated === 1 ? '' : 's'}?`,
      message: [
        dry.generated > 0
          ? `${dry.generated} pinned student${dry.generated === 1 ? '' : 's'} will be billed for this semester.`
          : 'No students will be billed for this selection.',
        dry.alreadyBilled ? `${dry.alreadyBilled} already billed (skipped).` : '',
        dry.noPin ? `${dry.noPin} have no active pin.` : '',
        dry.pinnedToDifferentAy ? `${dry.pinnedToDifferentAy} are pinned to a different academic year.` : '',
        dry.noAmount ? `${dry.noAmount} have no fee amount on their pin.` : '',
      ].filter(Boolean).join(' '),
      confirmLabel: 'Generate',
    });
    if (ok.confirmed) genMut.mutate(body);
  }

  if (!canGenerate) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        You need the finance <strong>create</strong> permission to generate bills. This screen is for
        an admin / accounts operator — a principal (approve/read only) cannot bill.
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-5 flex items-center gap-2">
        <Receipt size={20} className="text-primary-600" />
        <h2 className="text-xl font-bold text-navy">Generate Semester Bills</h2>
      </div>
      <p className="mb-5 text-sm text-gray-600">
        Bill every active student holding a fee pin for the chosen semester. Each student is charged
        their pinned annual fee split into a per-semester installment. Re-running is safe — anyone
        already billed for this semester is skipped.
      </p>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <label className={lbl}>Semester *</label>
          <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)} className={inp}>
            <option value="">Select a semester…</option>
            {semesters.map((s) => (
              <option key={s._id} value={s._id}>
                Semester {s.number} — {s.year}{s.status ? ` (${s.status})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Year of study (optional)</label>
          <select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} className={inp}>
            <option value="">All years</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">Leave as "All years" to bill every pinned student for this semester.</p>
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={preview}
            disabled={!semesterId || genMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {genMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />}
            Preview & Generate
          </button>
        </div>
      </div>

      {lastResult && (
        <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5" data-testid="generate-bills-result">
          <h3 className="mb-3 text-sm font-semibold text-navy">Last run</h3>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <Stat label="Generated" value={lastResult.generated} tone="text-emerald-700" />
            <Stat label="Already billed" value={lastResult.alreadyBilled} />
            <Stat label="No active pin" value={lastResult.noPin} />
            <Stat label="Different AY" value={lastResult.pinnedToDifferentAy} />
            <Stat label="No amount" value={lastResult.noAmount} />
            <Stat label="Errors" value={lastResult.errors.length} tone={lastResult.errors.length ? 'text-red-700' : undefined} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className={`text-lg font-bold ${tone ?? 'text-navy'}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

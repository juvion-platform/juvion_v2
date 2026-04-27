/**
 * StudentFeeStructurePanel — primary financial-summary surface on the
 * Student Detail page. Shows what this student owes, what they've paid,
 * the per-component breakdown, and any active financial holds. Sits ABOVE
 * the FeePinsPanel so the natural reading order is:
 *
 *   1. What does this student owe?     (this panel)
 *   2. How was the structure set up?   (FeePinsPanel)
 *
 * Data sources (all college-scoped via the existing axios interceptor):
 *   - `getStudentPins(studentId)` → active FSI name + total + status
 *   - `listFeeLineItems(1, 100, studentId)` → per-component breakdown
 *   - `listHolds({ studentId })` → any pending/active holds
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldAlert, BookOpen, IndianRupee } from 'lucide-react';

import { listFeeLineItems } from '../../services/finance';
import { getStudentPins, type IFeePin, type PopulatedFeeStructureInstance } from '../../services/fee-configuration';
import { listHolds, type FinancialHold } from '../../services/fee-holds';

interface Props {
  studentId: string;
}

interface FeeLineItem {
  _id: string;
  component: string;
  semester?: number;
  amount: number;
  paidAmount: number;
  waivedAmount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived';
  dueDate?: string | null;
  academicYearId?: { _id: string; name?: string } | string;
}

interface FeeLineItemsResponse {
  items: FeeLineItem[];
  total: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatInr(v: number | undefined | null): string {
  return `\u20B9${(v ?? 0).toLocaleString('en-IN')}`;
}

function statusBadge(status: FeeLineItem['status']): { label: string; className: string } {
  switch (status) {
    case 'paid':
      return { label: 'Paid', className: 'bg-emerald-100 text-emerald-800' };
    case 'partial':
      return { label: 'Partial', className: 'bg-amber-100 text-amber-800' };
    case 'overdue':
      return { label: 'Overdue', className: 'bg-red-100 text-red-800' };
    case 'waived':
      return { label: 'Waived', className: 'bg-violet-100 text-violet-800' };
    default:
      return { label: 'Pending', className: 'bg-slate-100 text-slate-700' };
  }
}

function holdStatusBadge(holdStatus: FinancialHold['holdStatus']): {
  label: string;
  className: string;
} {
  switch (holdStatus) {
    case 'pending_approval':
      return { label: 'Pending approval', className: 'bg-amber-100 text-amber-800' };
    case 'active':
      return { label: 'Active', className: 'bg-red-100 text-red-800' };
    case 'released':
      return { label: 'Released', className: 'bg-slate-100 text-slate-600' };
  }
}

function isPopulated(
  fsi: string | PopulatedFeeStructureInstance | undefined,
): fsi is PopulatedFeeStructureInstance {
  return typeof fsi === 'object' && fsi !== null;
}

// Pick the most recent (highest yearOfStudy) non-archived pin as "active".
function activePin(pins: IFeePin[]): IFeePin | undefined {
  const live = pins.filter((p) => !p.archivedAt);
  if (live.length === 0) return undefined;
  return [...live].sort((a, b) => (b.yearOfStudy ?? 0) - (a.yearOfStudy ?? 0))[0];
}

// ── Sub-components ────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warn';
}) {
  const tint =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'warn'
      ? 'text-red-700'
      : 'text-slate-900';
  return (
    <div className="flex-1 min-w-[120px] bg-white border border-slate-200 rounded-lg px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xl font-extrabold mt-1 ${tint}`}>{value}</div>
    </div>
  );
}

function ActiveHoldsBanner({ holds }: { holds: FinancialHold[] }) {
  const live = holds.filter(
    (h) => h.holdStatus === 'pending_approval' || h.holdStatus === 'active',
  );
  if (live.length === 0) return null;
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm mb-1">
        <ShieldAlert size={16} />
        {live.length} active financial hold{live.length > 1 ? 's' : ''}
      </div>
      <div className="space-y-1">
        {live.map((h) => {
          const badge = holdStatusBadge(h.holdStatus);
          const detail = h.releaseReason
            ? h.releaseReason
            : new Date(h.effectiveDate).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });
          return (
            <div key={h._id} className="text-xs text-rose-900 flex items-center gap-2">
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.className}`}
              >
                {badge.label}
              </span>
              <span className="font-medium capitalize">{h.holdType.replace(/_/g, ' ')}</span>
              <span className="text-rose-700">— effective {detail}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeeStructureHeader({ pin }: { pin: IFeePin | undefined }) {
  if (!pin) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 text-sm text-slate-500">
        No active fee structure pinned yet for this student.
      </div>
    );
  }
  const fsi = isPopulated(pin.feeStructureInstanceId)
    ? pin.feeStructureInstanceId
    : undefined;
  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 rounded-lg p-4 mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Active Fee Structure (Year {pin.yearOfStudy})
        </div>
        <div className="text-base font-bold text-slate-800 mt-0.5 truncate">
          {fsi?.name ?? fsi?.code ?? 'Fee Structure'}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {fsi?.status ? <span className="capitalize">{fsi.status}</span> : null}
          {fsi?.version ? <span className="ml-2">· v{fsi.version}</span> : null}
          {fsi?.quota ? <span className="ml-2 capitalize">· {fsi.quota}</span> : null}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Total
        </div>
        <div className="text-xl font-extrabold text-blue-700 mt-0.5">
          {formatInr(fsi?.totalAmount)}
        </div>
      </div>
    </div>
  );
}

function ComponentBreakdownTable({ items }: { items: FeeLineItem[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-sm text-slate-500">
        <BookOpen size={20} className="inline-block text-slate-400 mb-2" />
        <div>No fee line items have been generated for this student yet.</div>
      </div>
    );
  }

  // Sort: overdue/pending first, then partial, then paid/waived. Within each
  // group, sort by component name.
  const order: Record<FeeLineItem['status'], number> = {
    overdue: 0,
    pending: 1,
    partial: 2,
    paid: 3,
    waived: 4,
  };
  const sorted = [...items].sort((a, b) => {
    const o = order[a.status] - order[b.status];
    if (o !== 0) return o;
    return a.component.localeCompare(b.component);
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">Component</th>
              <th className="text-left px-4 py-2">Semester</th>
              <th className="text-right px-4 py-2">Amount</th>
              <th className="text-right px-4 py-2">Paid</th>
              <th className="text-right px-4 py-2">Waived</th>
              <th className="text-right px-4 py-2">Balance</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((it) => {
              const balance = it.amount - it.paidAmount - it.waivedAmount;
              const badge = statusBadge(it.status);
              return (
                <tr key={it._id} className="border-t border-slate-100 hover:bg-slate-50/40">
                  <td className="px-4 py-2 font-medium text-slate-800">{it.component}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {it.semester ? `Sem ${it.semester}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-800">
                    {formatInr(it.amount)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-700">
                    {it.paidAmount > 0 ? formatInr(it.paidAmount) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-violet-700">
                    {it.waivedAmount > 0 ? formatInr(it.waivedAmount) : '—'}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono font-semibold ${
                      balance > 0 ? 'text-red-700' : 'text-slate-500'
                    }`}
                  >
                    {balance > 0 ? formatInr(balance) : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────

export default function StudentFeeStructurePanel({ studentId }: Props) {
  const pinsQuery = useQuery({
    queryKey: ['student-pins', studentId],
    queryFn: () => getStudentPins(studentId),
    staleTime: 60_000,
  });

  const lineItemsQuery = useQuery({
    queryKey: ['student-fee-line-items', studentId],
    queryFn: () =>
      listFeeLineItems(1, 100, studentId) as Promise<FeeLineItemsResponse>,
    staleTime: 60_000,
  });

  const holdsQuery = useQuery({
    queryKey: ['student-holds', studentId],
    queryFn: () => listHolds({ studentId, limit: 50 }),
    staleTime: 60_000,
  });

  const items = lineItemsQuery.data?.items ?? [];
  const pins = pinsQuery.data?.pins ?? [];
  const active = activePin(pins);
  const holds = holdsQuery.data?.items ?? [];

  const totals = useMemo(() => {
    const billed = items.reduce((s, x) => s + x.amount, 0);
    const paid = items.reduce((s, x) => s + x.paidAmount, 0);
    const waived = items.reduce((s, x) => s + x.waivedAmount, 0);
    const balance = billed - paid - waived;
    return { billed, paid, waived, balance };
  }, [items]);

  const isLoading =
    pinsQuery.isLoading || lineItemsQuery.isLoading || holdsQuery.isLoading;
  const isError = pinsQuery.isError || lineItemsQuery.isError || holdsQuery.isError;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <IndianRupee size={16} className="text-emerald-600" />
          Fee Structure
        </h3>
        {isLoading ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Loader2 size={12} className="animate-spin" />
            Loading…
          </span>
        ) : null}
      </div>

      {isError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Could not load fee structure data. The rest of the page is still
          usable.
        </div>
      ) : (
        <>
          <FeeStructureHeader pin={active} />

          <ActiveHoldsBanner holds={holds} />

          <div className="flex flex-wrap gap-2 mb-4">
            <StatPill label="Billed" value={formatInr(totals.billed)} />
            <StatPill label="Paid" value={formatInr(totals.paid)} tone="success" />
            <StatPill label="Waived" value={formatInr(totals.waived)} />
            <StatPill
              label="Balance"
              value={formatInr(totals.balance)}
              tone={totals.balance > 0 ? 'warn' : 'default'}
            />
          </div>

          <ComponentBreakdownTable items={items} />
        </>
      )}
    </section>
  );
}

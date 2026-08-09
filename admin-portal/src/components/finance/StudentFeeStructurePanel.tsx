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
 *   - `listStudentFeeAccounts(…, studentId)` → the four headline totals
 *   - `listInvoices(…, studentId)` + `listPayments(…, studentId)` → breakdown
 *   - `listHolds({ studentId })` → any pending/active holds
 *
 * The totals read `StudentFeeAccount`, the same maintained balance the finance
 * dashboard sums for net AR. They previously summed `FeeLineItem` — a legacy
 * collection the pin→invoice billing path never writes — so a billed student
 * showed ₹0 across all four tiles and no payment ever moved them.
 *
 * Per-invoice `paid` is derived by grouping this student's successful payments
 * on `invoiceId`, because `Invoice` carries no paid amount of its own.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldAlert, BookOpen, IndianRupee } from 'lucide-react';

import { listInvoices, listPayments, listStudentFeeAccounts } from '../../services/finance';
import { getStudentPins, type IFeePin, type PopulatedFeeStructureInstance } from '../../services/fee-configuration';
import { listHolds, type FinancialHold } from '../../services/fee-holds';

interface Props {
  studentId: string;
}

type InvoiceStatus =
  | 'draft' | 'generated' | 'sent' | 'partially_paid' | 'paid'
  | 'overdue' | 'disputed' | 'confirmed' | 'written_off' | 'cancelled';

interface StudentInvoice {
  _id: string;
  invoiceNumber: string;
  totalAmount: number;
  netPayable?: number;
  scholarshipAllocated?: number;
  concessionApplied?: number;
  status: InvoiceStatus;
  dueDate?: string | null;
  isSemesterInstallment?: boolean;
}

interface PaymentRow {
  _id: string;
  amount: number;
  status?: string;
  invoiceId?: string | { _id: string } | null;
}

/** One invoice joined to the payments raised against it. */
interface InvoiceRow extends StudentInvoice {
  amount: number;
  paid: number;
  waived: number;
  balance: number;
}

interface FeeAccount {
  _id: string;
  totalDue: number;
  totalPaid: number;
  totalWaived: number;
  totalRefunded: number;
  balance: number;
}

interface Paged<T> {
  items: T[];
  total: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatInr(v: number | undefined | null): string {
  return `\u20B9${(v ?? 0).toLocaleString('en-IN')}`;
}

function statusBadge(status: InvoiceStatus): { label: string; className: string } {
  switch (status) {
    case 'paid':
      return { label: 'Paid', className: 'bg-emerald-100 text-emerald-800' };
    case 'partially_paid':
      return { label: 'Partial', className: 'bg-amber-100 text-amber-800' };
    case 'overdue':
      return { label: 'Overdue', className: 'bg-red-100 text-red-800' };
    case 'written_off':
      return { label: 'Written off', className: 'bg-violet-100 text-violet-800' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-slate-100 text-slate-500' };
    case 'disputed':
      return { label: 'Disputed', className: 'bg-orange-100 text-orange-800' };
    case 'draft':
      return { label: 'Draft', className: 'bg-slate-100 text-slate-600' };
    default:
      // generated / sent / confirmed — issued and awaiting payment.
      return { label: 'Pending', className: 'bg-slate-100 text-slate-700' };
  }
}

/** Past its due date and not settled — the invoice model has no derived flag. */
function isOverdue(inv: StudentInvoice, balance: number): boolean {
  if (balance <= 0) return false;
  if (['paid', 'cancelled', 'written_off', 'draft'].includes(inv.status)) return false;
  return Boolean(inv.dueDate) && new Date(inv.dueDate as string).getTime() < Date.now();
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

function InvoiceBreakdownTable({ rows }: { rows: InvoiceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-sm text-slate-500">
        <BookOpen size={20} className="inline-block text-slate-400 mb-2" />
        <div>No bills have been generated for this student yet.</div>
        <div className="mt-1 text-xs text-slate-400">
          Pinned students are billed from Finance → Fee Management → Generate Bills.
        </div>
      </div>
    );
  }

  // Unsettled first (oldest due date leads, so the next thing to chase is on
  // top), then settled invoices newest-first.
  const sorted = [...rows].sort((a, b) => {
    const aOpen = a.balance > 0 ? 0 : 1;
    const bOpen = b.balance > 0 ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    const at = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const bt = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return aOpen === 0 ? at - bt : bt - at;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">Invoice</th>
              <th className="text-left px-4 py-2">Due</th>
              <th className="text-right px-4 py-2">Amount</th>
              <th className="text-right px-4 py-2">Paid</th>
              <th className="text-right px-4 py-2">Waived</th>
              <th className="text-right px-4 py-2">Balance</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const badge = statusBadge(isOverdue(r, r.balance) ? 'overdue' : r.status);
              return (
                <tr key={r._id} className="border-t border-slate-100 hover:bg-slate-50/40">
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {r.invoiceNumber}
                    {r.isSemesterInstallment && (
                      <span className="ml-2 text-[10px] font-normal text-slate-500">
                        semester installment
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-800">
                    {formatInr(r.amount)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-700">
                    {r.paid > 0 ? formatInr(r.paid) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-violet-700">
                    {r.waived > 0 ? formatInr(r.waived) : '—'}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono font-semibold ${
                      r.balance > 0 ? 'text-red-700' : 'text-slate-500'
                    }`}
                  >
                    {r.balance > 0 ? formatInr(r.balance) : '—'}
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

  // The four headline totals come from the maintained account balance, not from
  // summing the table below — the account is what the payment path updates and
  // what the finance dashboard reports as net AR.
  const accountQuery = useQuery({
    queryKey: ['student-fee-account', studentId],
    queryFn: () =>
      listStudentFeeAccounts(1, 1, undefined, studentId) as Promise<Paged<FeeAccount>>,
    staleTime: 60_000,
  });

  const invoicesQuery = useQuery({
    queryKey: ['student-invoices', studentId],
    queryFn: () =>
      listInvoices(1, 100, undefined, studentId) as Promise<Paged<StudentInvoice>>,
    staleTime: 60_000,
  });

  const paymentsQuery = useQuery({
    queryKey: ['student-payments', studentId],
    queryFn: () => listPayments(1, 200, studentId) as Promise<Paged<PaymentRow>>,
    staleTime: 60_000,
  });

  const holdsQuery = useQuery({
    queryKey: ['student-holds', studentId],
    queryFn: () => listHolds({ studentId, limit: 50 }),
    staleTime: 60_000,
  });

  const pins = pinsQuery.data?.pins ?? [];
  const active = activePin(pins);
  const holds = holdsQuery.data?.items ?? [];

  const totals = useMemo(() => {
    const acct = accountQuery.data?.items?.[0];
    return {
      billed: acct?.totalDue ?? 0,
      paid: acct?.totalPaid ?? 0,
      waived: acct?.totalWaived ?? 0,
      balance: acct?.balance ?? 0,
    };
  }, [accountQuery.data]);

  const rows = useMemo<InvoiceRow[]>(() => {
    const invoices = invoicesQuery.data?.items ?? [];
    const payments = paymentsQuery.data?.items ?? [];

    // Invoice carries no paid amount, so fold this student's successful
    // payments onto their invoiceId. Unapplied payments (no invoiceId) reduce
    // the account balance but belong to no row — they show in the totals only.
    const paidByInvoice = new Map<string, number>();
    for (const p of payments) {
      if (p.status && p.status !== 'success') continue;
      const raw = p.invoiceId;
      const id = typeof raw === 'string' ? raw : raw?._id;
      if (!id) continue;
      paidByInvoice.set(id, (paidByInvoice.get(id) ?? 0) + p.amount);
    }

    return invoices.map((inv) => {
      const amount = inv.netPayable ?? inv.totalAmount ?? 0;
      const paid = paidByInvoice.get(inv._id) ?? 0;
      const waived = (inv.scholarshipAllocated ?? 0) + (inv.concessionApplied ?? 0);
      return { ...inv, amount, paid, waived, balance: amount - paid - waived };
    });
  }, [invoicesQuery.data, paymentsQuery.data]);

  const isLoading =
    pinsQuery.isLoading || accountQuery.isLoading || invoicesQuery.isLoading
    || paymentsQuery.isLoading || holdsQuery.isLoading;
  const isError =
    pinsQuery.isError || accountQuery.isError || invoicesQuery.isError
    || paymentsQuery.isError || holdsQuery.isError;

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

          <InvoiceBreakdownTable rows={rows} />
        </>
      )}
    </section>
  );
}

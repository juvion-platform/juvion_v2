import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFinanceStats } from '../services/finance';
import { getStats as getPeopleStats } from '../services/people';
import { Landmark, CreditCard, GraduationCap, HandCoins, RotateCcw, Gavel, FileText, Wallet, Receipt, BookOpen, Users, ShieldAlert, CircleCheckBig, LayoutList, BarChart3 } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { StatBannerSkeleton } from '../components/ui/Skeleton';

import FeeDashboardPage from './finance/FeeDashboardPage';
import FeeManagementPage from './finance/FeeManagementPage';
import ScholarshipsConcessionsPage from './finance/ScholarshipsConcessionsPage';
import AccountingPage from './finance/AccountingPage';

function FinanceHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['finance-stats'], queryFn: getFinanceStats });
  const { data: peopleStats } = useQuery({ queryKey: ['people-stats'], queryFn: getPeopleStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Finance</h2>

      {/* KPI Banner */}
      {!stats ? (
        <StatBannerSkeleton count={4} />
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <span className="text-xs font-medium text-green-600 uppercase">Total Collected</span>
            <div className="text-2xl font-bold text-green-700 mt-1">₹{(stats.totalCollected || 0).toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <span className="text-xs font-medium text-amber-600 uppercase">Pending</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">₹{(stats.totalPending || 0).toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-4">
            <span className="text-xs font-medium text-red-600 uppercase">Overdue Items</span>
            <div className="text-2xl font-bold text-red-700 mt-1">{stats.overdueLineItems || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-medium text-blue-600 uppercase">Total Payments</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.payments || 0}</div>
          </div>
        </div>
      )}

      {peopleStats && (
        <>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Student Finance Readiness</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <button onClick={() => navigate('/people/students?needsAttention=true')} className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 text-left hover:shadow-md hover:border-amber-300 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-amber-600">Needs Attention</div>
                  <div className="mt-2 text-3xl font-bold text-navy">{peopleStats.onboardingNeedsAttention || 0}</div>
                  <div className="mt-1 text-sm text-gray-500">Students blocked or incomplete for onboarding</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
                  <ShieldAlert size={22} />
                </div>
              </div>
            </button>
            <button onClick={() => navigate('/people/students?needsAttention=true')} className="bg-white rounded-xl border border-rose-200 shadow-sm p-5 text-left hover:shadow-md hover:border-rose-300 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-rose-600">Missing Fee Guardian</div>
                  <div className="mt-2 text-3xl font-bold text-navy">{peopleStats.missingFeeResponsibleGuardians || 0}</div>
                  <div className="mt-1 text-sm text-gray-500">Students that finance cannot process yet</div>
                </div>
                <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                  <Users size={22} />
                </div>
              </div>
            </button>
            <button onClick={() => navigate('/people/students?onboardingStatus=completed')} className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 text-left hover:shadow-md hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">Onboarding Complete</div>
                  <div className="mt-2 text-3xl font-bold text-navy">{peopleStats.onboardingCompleted || 0}</div>
                  <div className="mt-1 text-sm text-gray-500">Students ready for downstream finance operations</div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                  <CircleCheckBig size={22} />
                </div>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Fee Management */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Fee Management</h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 mb-8">
        {[
          { to: 'dashboard', icon: BarChart3, label: 'Dashboard', desc: 'Collections analytics + funnel', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400', statKey: null },
          { to: 'fee-structures', icon: Landmark, label: 'Fee Structures', desc: 'Programme-wise fee setup', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400', statKey: 'feeStructures' },
          { to: 'component-template', icon: LayoutList, label: 'Component Template', desc: 'Canonical + custom fee components', iconBg: 'bg-fuchsia-50 text-fuchsia-600', border: 'border-fuchsia-200 hover:border-fuchsia-400', statKey: null },
          { to: 'student-fee-accounts', icon: BookOpen, label: 'Fee Accounts', desc: 'Student balance ledgers', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'studentFeeAccounts' },
          { to: 'fee-line-items', icon: FileText, label: 'Fee Line Items', desc: 'Charge-level fee tracking', iconBg: 'bg-sky-50 text-sky-600', border: 'border-sky-200 hover:border-sky-400', statKey: 'feeLineItems' },
          { to: 'payments', icon: CreditCard, label: 'Payments', desc: 'Collection & receipts', iconBg: 'bg-green-50 text-green-600', border: 'border-green-200 hover:border-green-400', statKey: 'payments' },
          { to: 'invoices', icon: FileText, label: 'Invoices', desc: 'Fee invoices & billing', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'invoices' },
          { to: 'reminders', icon: Users, label: 'Fee Reminders', desc: 'Fee follow-up communication', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: null },
          { to: 'fines', icon: Gavel, label: 'Fines & Penalties', desc: 'Late fees, library fines', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400', statKey: 'fines' },
          { to: 'holds', icon: ShieldAlert, label: 'Financial Holds', desc: 'Approve / waive exam-debarment holds', iconBg: 'bg-rose-50 text-rose-600', border: 'border-rose-200 hover:border-rose-400', statKey: null },
        ].map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Scholarships & Concessions */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Scholarships & Concessions</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'scholarships', icon: GraduationCap, label: 'Scholarships', desc: 'Government & institutional', iconBg: 'bg-primary-50 text-primary-600', border: 'border-primary-200 hover:border-primary-400', statKey: 'scholarships' },
          { to: 'scholarship-allocations', icon: CircleCheckBig, label: 'Scholarship Allocations', desc: 'Student scholarship awards', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: null },
          { to: 'concessions', icon: HandCoins, label: 'Concessions', desc: 'Fee waivers & discounts', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'concessions' },
          { to: 'refunds', icon: RotateCcw, label: 'Refunds', desc: 'Refund processing', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'refunds' },
        ].map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Accounting */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Accounting</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: 'budgets', icon: Wallet, label: 'Budgets', desc: 'Department budgets', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'budgets' },
          { to: 'expenses', icon: Receipt, label: 'Expenses', desc: 'Expense tracking', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'expenses' },
          { to: 'ledger', icon: BookOpen, label: 'Ledger', desc: 'Financial journal', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: null },
        ].map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Breadcrumbs className="mb-4" />
      {children}
    </div>
  );
}

export default function Finance() {
  return (
    <SubPageWrapper>
      <Routes>
        {/* Finance lands on the Dashboard by default. The sidebar expandable
            Finance group is the primary navigation surface. Sub-tabs live
            under three tabbed parent pages (Fee Management, Scholarships &
            Concessions, Accounting). */}
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="overview" element={<FinanceHome />} />
        <Route path="dashboard" element={<FeeDashboardPage />} />

        {/* New tabbed parent pages. */}
        <Route path="fee-management/*" element={<FeeManagementPage />} />
        <Route
          path="scholarships-concessions/*"
          element={<ScholarshipsConcessionsPage />}
        />
        <Route path="accounting/*" element={<AccountingPage />} />

        {/* Back-compat: redirect old flat URLs to the tabbed ones so existing
            bookmarks / external links keep working. */}
        <Route
          path="fee-structures"
          element={<Navigate to="/finance/fee-management/fee-structures" replace />}
        />
        <Route
          path="component-template"
          element={<Navigate to="/finance/fee-management/component-template" replace />}
        />
        <Route
          path="student-fee-accounts"
          element={<Navigate to="/finance/fee-management/fee-accounts" replace />}
        />
        <Route
          path="fee-line-items"
          element={<Navigate to="/finance/fee-management/fee-line-items" replace />}
        />
        <Route
          path="payments"
          element={<Navigate to="/finance/fee-management/payments" replace />}
        />
        <Route
          path="invoices"
          element={<Navigate to="/finance/fee-management/invoices" replace />}
        />
        <Route
          path="reminders"
          element={<Navigate to="/finance/fee-management/reminders" replace />}
        />
        <Route
          path="fines"
          element={<Navigate to="/finance/fee-management/fines" replace />}
        />
        <Route
          path="holds"
          element={<Navigate to="/finance/fee-management/holds" replace />}
        />
        <Route
          path="scholarships"
          element={<Navigate to="/finance/scholarships-concessions/scholarships" replace />}
        />
        <Route
          path="scholarship-allocations"
          element={<Navigate to="/finance/scholarships-concessions/allocations" replace />}
        />
        <Route
          path="concessions"
          element={<Navigate to="/finance/scholarships-concessions/concessions" replace />}
        />
        <Route
          path="refunds"
          element={<Navigate to="/finance/scholarships-concessions/refunds" replace />}
        />
        <Route
          path="budgets"
          element={<Navigate to="/finance/accounting/budgets" replace />}
        />
        <Route
          path="expenses"
          element={<Navigate to="/finance/accounting/expenses" replace />}
        />
        <Route
          path="ledger"
          element={<Navigate to="/finance/accounting/ledger" replace />}
        />

      </Routes>
    </SubPageWrapper>
  );
}

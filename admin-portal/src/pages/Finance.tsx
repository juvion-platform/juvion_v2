import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFinanceStats } from '../services/finance';
import { ArrowLeft, Landmark, CreditCard, GraduationCap, HandCoins, RotateCcw, Gavel, FileText, Wallet, Receipt, BookOpen, IndianRupee, AlertTriangle } from 'lucide-react';

import FeeStructuresPage from './finance/FeeStructuresPage';
import PaymentsPage from './finance/PaymentsPage';
import ScholarshipsPage from './finance/ScholarshipsPage';
import ConcessionsPage from './finance/ConcessionsPage';
import RefundsPage from './finance/RefundsPage';
import BudgetsPage from './finance/BudgetsPage';
import ExpensesPage from './finance/ExpensesPage';
import InvoicesPage from './finance/InvoicesPage';
import FinePenaltiesPage from './finance/FinePenaltiesPage';
import LedgerPage from './finance/LedgerPage';

function FinanceHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['finance-stats'], queryFn: getFinanceStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Finance</h2>

      {/* KPI Banner */}
      {stats && (
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

      {/* Fee Management */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Fee Management</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'fee-structures', icon: Landmark, label: 'Fee Structures', desc: 'Programme-wise fee setup', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400', statKey: 'feeStructures' },
          { to: 'payments', icon: CreditCard, label: 'Payments', desc: 'Collection & receipts', iconBg: 'bg-green-50 text-green-600', border: 'border-green-200 hover:border-green-400', statKey: 'payments' },
          { to: 'invoices', icon: FileText, label: 'Invoices', desc: 'Fee invoices & billing', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'invoices' },
          { to: 'fines', icon: Gavel, label: 'Fines & Penalties', desc: 'Late fees, library fines', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400', statKey: 'fines' },
        ].map(card => {
          const Icon = card.icon;
          const count = stats ? (stats as any)[card.statKey] : '—';
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              <div className="text-2xl font-bold text-navy mb-1">{count}</div>
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
          { to: 'concessions', icon: HandCoins, label: 'Concessions', desc: 'Fee waivers & discounts', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'concessions' },
          { to: 'refunds', icon: RotateCcw, label: 'Refunds', desc: 'Refund processing', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'refunds' },
        ].map(card => {
          const Icon = card.icon;
          const count = stats ? (stats as any)[card.statKey] : '—';
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              <div className="text-2xl font-bold text-navy mb-1">{count}</div>
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
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '—';
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              <div className="text-2xl font-bold text-navy mb-1">{count}</div>
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
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isSubPage = path !== '/finance' && path !== '/finance/';

  return (
    <div>
      {isSubPage && (
        <button onClick={() => navigate('/finance')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} className="text-gray-400" /> Back to Finance
        </button>
      )}
      {children}
    </div>
  );
}

export default function Finance() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<FinanceHome />} />
        <Route path="fee-structures" element={<FeeStructuresPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="scholarships" element={<ScholarshipsPage />} />
        <Route path="concessions" element={<ConcessionsPage />} />
        <Route path="refunds" element={<RefundsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="fines" element={<FinePenaltiesPage />} />
        <Route path="ledger" element={<LedgerPage />} />
      </Routes>
    </SubPageWrapper>
  );
}

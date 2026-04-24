/**
 * AccountingPage — parent tabbed view under `/finance/accounting/*`.
 * Default tab: budgets.
 */

import { Routes, Route, Navigate } from 'react-router-dom';

import FinanceTabShell, {
  type FinanceTabDef,
} from '../../components/finance/FinanceTabShell';

import BudgetsPage from './BudgetsPage';
import ExpensesPage from './ExpensesPage';
import LedgerPage from './LedgerPage';

const TABS: FinanceTabDef[] = [
  { to: '/finance/accounting/budgets', label: 'Budgets' },
  { to: '/finance/accounting/expenses', label: 'Expenses' },
  { to: '/finance/accounting/ledger', label: 'Ledger' },
];

export default function AccountingPage() {
  return (
    <FinanceTabShell
      title="Accounting"
      description="Department budgets, expenses, and the financial journal"
      tabs={TABS}
    >
      <Routes>
        <Route index element={<Navigate to="budgets" replace />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="ledger" element={<LedgerPage />} />
      </Routes>
    </FinanceTabShell>
  );
}

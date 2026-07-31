/**
 * FeeManagementPage — parent tabbed view under `/finance/fee-management/*`.
 * Each tab is its own route; the individual page components stay unchanged
 * and are simply mounted inside the tab shell.
 *
 * Default tab: fee-structures (matches the historic hub ordering).
 */

import { Routes, Route, Navigate } from 'react-router-dom';

import FinanceTabShell, {
  type FinanceTabDef,
} from '../../components/finance/FinanceTabShell';

import FeeStructureInstancesPage from './FeeStructureInstancesPage';
import FeeComponentTemplatePage from './FeeComponentTemplatePage';
import FeeCategoriesPage from './FeeCategoriesPage';
import FeeQuotasPage from './FeeQuotasPage';
import StudentFeeAccountsPage from './StudentFeeAccountsPage';
import FeeLineItemsPage from './FeeLineItemsPage';
import GenerateBillsPage from './GenerateBillsPage';
import PaymentsPage from './PaymentsPage';
import InvoicesPage from './InvoicesPage';
import FeeRemindersPage from './FeeRemindersPage';
import FinePenaltiesPage from './FinePenaltiesPage';
import PinCoveragePage from './PinCoveragePage';
import FinancialHoldsPage from './FinancialHoldsPage';

const TABS: FinanceTabDef[] = [
  { to: '/finance/fee-management/fee-structures', label: 'Fee Structures' },
  { to: '/finance/fee-management/component-template', label: 'Component Template' },
  { to: '/finance/fee-management/fee-categories', label: 'Fee Categories' },
  { to: '/finance/fee-management/fee-quotas', label: 'Fee Quotas' },
  { to: '/finance/fee-management/fee-accounts', label: 'Fee Accounts' },
  { to: '/finance/fee-management/fee-line-items', label: 'Fee Line Items' },
  { to: '/finance/fee-management/generate-bills', label: 'Generate Bills' },
  { to: '/finance/fee-management/payments', label: 'Payments' },
  { to: '/finance/fee-management/invoices', label: 'Invoices' },
  { to: '/finance/fee-management/reminders', label: 'Fee Reminders' },
  { to: '/finance/fee-management/fines', label: 'Fines & Penalties' },
  { to: '/finance/fee-management/holds', label: 'Financial Holds' },
  { to: '/finance/fee-management/pin-coverage', label: 'Pin Coverage' },
];

export default function FeeManagementPage() {
  return (
    <FinanceTabShell
      title="Fee Management"
      description="Structures, accounts, payments, invoices, reminders, fines & holds"
      tabs={TABS}
    >
      <Routes>
        <Route index element={<Navigate to="fee-structures" replace />} />
        {/* The legacy FeeStructuresPage (writing the retired FeeStructure
            model) is retained on disk + under test, but no longer routed —
            this URL now serves the FeeStructureInstance authoring page. */}
        <Route path="fee-structures" element={<FeeStructureInstancesPage />} />
        <Route path="component-template" element={<FeeComponentTemplatePage />} />
        <Route path="fee-categories" element={<FeeCategoriesPage />} />
        <Route path="fee-quotas" element={<FeeQuotasPage />} />
        <Route path="fee-accounts" element={<StudentFeeAccountsPage />} />
        <Route path="fee-line-items" element={<FeeLineItemsPage />} />
        <Route path="generate-bills" element={<GenerateBillsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="reminders" element={<FeeRemindersPage />} />
        <Route path="fines" element={<FinePenaltiesPage />} />
        <Route path="holds" element={<FinancialHoldsPage />} />
        <Route path="pin-coverage" element={<PinCoveragePage />} />
      </Routes>
    </FinanceTabShell>
  );
}

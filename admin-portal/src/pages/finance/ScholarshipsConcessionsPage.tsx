/**
 * ScholarshipsConcessionsPage — parent tabbed view under
 * `/finance/scholarships-concessions/*`. Default tab: scholarships.
 */

import { Routes, Route, Navigate } from 'react-router-dom';

import FinanceTabShell, {
  type FinanceTabDef,
} from '../../components/finance/FinanceTabShell';

import ScholarshipsPage from './ScholarshipsPage';
import ScholarshipAllocationsPage from './ScholarshipAllocationsPage';
import ConcessionsPage from './ConcessionsPage';
import RefundsPage from './RefundsPage';

const TABS: FinanceTabDef[] = [
  { to: '/finance/scholarships-concessions/scholarships', label: 'Scholarships' },
  {
    to: '/finance/scholarships-concessions/allocations',
    label: 'Scholarship Allocations',
  },
  { to: '/finance/scholarships-concessions/concessions', label: 'Concessions' },
  { to: '/finance/scholarships-concessions/refunds', label: 'Refunds' },
];

export default function ScholarshipsConcessionsPage() {
  return (
    <FinanceTabShell
      title="Scholarships & Concessions"
      description="Government + institutional awards, fee waivers, and refunds"
      tabs={TABS}
    >
      <Routes>
        <Route index element={<Navigate to="scholarships" replace />} />
        <Route path="scholarships" element={<ScholarshipsPage />} />
        <Route path="allocations" element={<ScholarshipAllocationsPage />} />
        <Route path="concessions" element={<ConcessionsPage />} />
        <Route path="refunds" element={<RefundsPage />} />
      </Routes>
    </FinanceTabShell>
  );
}

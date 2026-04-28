import { Routes, Route, useNavigate } from 'react-router-dom';
import { Building2, GraduationCap, GitBranch, BadgeCheck } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';

import DepartmentsPage from './master-data/DepartmentsPage';
import ProgrammesPage from './master-data/ProgrammesPage';
import BranchesPage from './master-data/BranchesPage';
import DesignationsPage from './master-data/DesignationsPage';

function MasterDataHome() {
  const navigate = useNavigate();

  const cards = [
    { to: 'departments', icon: Building2, label: 'Departments', desc: 'Academic departments & HODs', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400' },
    { to: 'programmes', icon: GraduationCap, label: 'Programmes', desc: 'B.Tech, M.Tech, MBA, etc.', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400' },
    { to: 'branches', icon: GitBranch, label: 'Branches', desc: 'CSE, ECE, MECH, etc.', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400' },
    { to: 'designations', icon: BadgeCheck, label: 'Designations', desc: 'Faculty & staff designations', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Master Data</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
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

export default function MasterData() {
  return (
    <Routes>
      <Route index element={<MasterDataHome />} />
      <Route path="departments" element={<SubPageWrapper><DepartmentsPage /></SubPageWrapper>} />
      <Route path="programmes" element={<SubPageWrapper><ProgrammesPage /></SubPageWrapper>} />
      <Route path="branches" element={<SubPageWrapper><BranchesPage /></SubPageWrapper>} />
      <Route path="designations" element={<SubPageWrapper><DesignationsPage /></SubPageWrapper>} />
    </Routes>
  );
}

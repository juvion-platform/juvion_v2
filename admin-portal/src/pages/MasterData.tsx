import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  Building2, GraduationCap, GitBranch, BadgeCheck, ArrowLeft,
  Calendar, ScrollText, Users2, Clock, BookOpen, LayoutGrid,
} from 'lucide-react';

import DepartmentsPage from './master-data/DepartmentsPage';
import ProgrammesPage from './master-data/ProgrammesPage';
import BranchesPage from './master-data/BranchesPage';
import DesignationsPage from './master-data/DesignationsPage';
import AcademicYearsPage from './master-data/AcademicYearsPage';
import RegulationsPage from './master-data/RegulationsPage';
import BatchesPage from './master-data/BatchesPage';
import SemestersPage from './master-data/SemestersPage';
import CoursesPage from './master-data/CoursesPage';
import SectionsPage from './master-data/SectionsPage';

type CardDef = { to: string; icon: any; label: string; desc: string; iconBg: string; border: string };

function CardGrid({ cards, navigate }: { cards: CardDef[]; navigate: (to: string) => void }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
  );
}

function MasterDataHome() {
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Master Data</h2>

      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Institution Structure</h3>
      <CardGrid navigate={navigate} cards={[
        { to: 'departments', icon: Building2, label: 'Departments', desc: 'Academic departments & HODs', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400' },
        { to: 'programmes', icon: GraduationCap, label: 'Programmes', desc: 'B.Tech, M.Tech, MBA, etc.', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400' },
        { to: 'branches', icon: GitBranch, label: 'Branches', desc: 'CSE, ECE, MECH, etc.', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400' },
        { to: 'designations', icon: BadgeCheck, label: 'Designations', desc: 'Faculty & staff designations', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400' },
      ]} />

      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Academic Configuration</h3>
      <CardGrid navigate={navigate} cards={[
        { to: 'academic-years', icon: Calendar, label: 'Academic Years', desc: 'AY periods & current year', iconBg: 'bg-sky-50 text-sky-600', border: 'border-sky-200 hover:border-sky-400' },
        { to: 'regulations', icon: ScrollText, label: 'Regulations', desc: 'R20, R23 regulation frameworks', iconBg: 'bg-rose-50 text-rose-600', border: 'border-rose-200 hover:border-rose-400' },
        { to: 'batches', icon: Users2, label: 'Batches', desc: 'Admission year cohorts', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400' },
        { to: 'semesters', icon: Clock, label: 'Semesters', desc: 'Semester periods & status', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400' },
        { to: 'courses', icon: BookOpen, label: 'Courses', desc: 'Course catalog with L-T-P', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400' },
        { to: 'sections', icon: LayoutGrid, label: 'Sections', desc: 'Class sections & advisors', iconBg: 'bg-pink-50 text-pink-600', border: 'border-pink-200 hover:border-pink-400' },
      ]} />
    </div>
  );
}

function SubPageWrapper({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/master-data' || location.pathname === '/master-data/';

  if (isHome) return null;
  return (
    <div>
      <button onClick={() => navigate('/master-data')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-4">
        <ArrowLeft size={14} /> Back to Master Data
      </button>
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
      <Route path="academic-years" element={<SubPageWrapper><AcademicYearsPage /></SubPageWrapper>} />
      <Route path="regulations" element={<SubPageWrapper><RegulationsPage /></SubPageWrapper>} />
      <Route path="batches" element={<SubPageWrapper><BatchesPage /></SubPageWrapper>} />
      <Route path="semesters" element={<SubPageWrapper><SemestersPage /></SubPageWrapper>} />
      <Route path="courses" element={<SubPageWrapper><CoursesPage /></SubPageWrapper>} />
      <Route path="sections" element={<SubPageWrapper><SectionsPage /></SubPageWrapper>} />
    </Routes>
  );
}

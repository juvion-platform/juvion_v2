import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getGovernanceStats } from '../services/governance';
import { ArrowLeft, Users, Calendar, FileText, Crown, Target } from 'lucide-react';

import CommitteesPage from './governance/CommitteesPage';
import MeetingsPage from './governance/MeetingsPage';
import PoliciesPage from './governance/PoliciesPage';
import BoardMembersPage from './governance/BoardMembersPage';
import GoalsPage from './governance/GoalsPage';

function GovernanceHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['governance-stats'], queryFn: getGovernanceStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Governance (M11)</h2>

      {/* KPI Banner */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-medium text-blue-600 uppercase">Committees</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.activeCommittees || 0}</div>
            <span className="text-xs text-blue-500">of {stats.committees || 0} total</span>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <span className="text-xs font-medium text-green-600 uppercase">Active Policies</span>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.activePolicies || 0}</div>
            <span className="text-xs text-green-500">of {stats.policies || 0} total</span>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <span className="text-xs font-medium text-amber-600 uppercase">Board Members</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.activeBoardMembers || 0}</div>
            <span className="text-xs text-amber-500">active</span>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
            <span className="text-xs font-medium text-violet-600 uppercase">Strategic Goals</span>
            <div className="text-2xl font-bold text-violet-700 mt-1">{stats.activeGoals || 0}</div>
            <span className="text-xs text-violet-500">{stats.atRiskGoals || 0} at risk</span>
          </div>
        </div>
      )}

      {/* Committees & Meetings */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Committees & Meetings</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'committees', icon: Users, label: 'Committees', desc: 'Statutory & academic committees', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'committees' },
          { to: 'meetings', icon: Calendar, label: 'Meetings', desc: 'Minutes & decisions', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'meetings' },
        ].map(card => {
          const Icon = card.icon;
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '\u2014';
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

      {/* Policies & Compliance */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Policies & Compliance</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'policies', icon: FileText, label: 'Policies', desc: 'Institutional policies', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'policies' },
        ].map(card => {
          const Icon = card.icon;
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '\u2014';
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

      {/* Governing Body & Strategy */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Governing Body & Strategy</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: 'board-members', icon: Crown, label: 'Governing Body', desc: 'Board members & roles', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'boardMembers' },
          { to: 'goals', icon: Target, label: 'Strategic Goals', desc: 'KPIs & targets', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400', statKey: 'goals' },
        ].map(card => {
          const Icon = card.icon;
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '\u2014';
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
  const isSubPage = path !== '/governance' && path !== '/governance/';

  return (
    <div>
      {isSubPage && (
        <button onClick={() => navigate('/governance')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} className="text-gray-400" /> Back to Governance
        </button>
      )}
      {children}
    </div>
  );
}

export default function Governance() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<GovernanceHome />} />
        <Route path="committees" element={<CommitteesPage />} />
        <Route path="meetings" element={<MeetingsPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="board-members" element={<BoardMembersPage />} />
        <Route path="goals" element={<GoalsPage />} />
      </Routes>
    </SubPageWrapper>
  );
}

import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getComplianceStats } from '../services/compliance';
import { Shield, Award, CheckCircle, FileText, Building2, Link2, Search, ClipboardList, FileWarning, Scale } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';

import AccreditationBodiesPage from './compliance/AccreditationBodiesPage';
import AccreditationCyclesPage from './compliance/AccreditationCyclesPage';
import ComplianceCriteriaPage from './compliance/ComplianceCriteriaPage';
import RegulatoryFilingsPage from './compliance/RegulatoryFilingsPage';
import AICTEApprovalsPage from './compliance/AICTEApprovalsPage';
import AffiliationStatusesPage from './compliance/AffiliationStatusesPage';
import AuditFindingsPage from './compliance/AuditFindingsPage';
import IQACReportsPage from './compliance/IQACReportsPage';
import RTIRequestsPage from './compliance/RTIRequestsPage';
import LegalCasesPage from './compliance/LegalCasesPage';

function ComplianceHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['compliance-stats'], queryFn: getComplianceStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Compliance & Accreditation</h2>

      {/* KPI Banner */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-medium text-blue-600 uppercase">Active Accreditations</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.activeAccreditations || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-4">
            <span className="text-xs font-medium text-red-600 uppercase">Open Findings</span>
            <div className="text-2xl font-bold text-red-700 mt-1">{stats.openFindings || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <span className="text-xs font-medium text-amber-600 uppercase">Pending Filings</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.pendingFilings || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
            <span className="text-xs font-medium text-violet-600 uppercase">Active Cases</span>
            <div className="text-2xl font-bold text-violet-700 mt-1">{stats.activeCases || 0}</div>
          </div>
        </div>
      )}

      {/* Accreditation */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Accreditation</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'accreditation-bodies', icon: Shield, label: 'Accreditation Bodies', desc: 'NAAC, NBA, NIRF, etc.', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'accreditationBodies' },
          { to: 'accreditation-cycles', icon: Award, label: 'Accreditation Cycles', desc: 'Cycle tracking & grades', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'accreditationCycles' },
          { to: 'compliance-criteria', icon: CheckCircle, label: 'Compliance Criteria', desc: 'Criteria & evidence', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'complianceCriteria' },
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

      {/* Regulatory */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Regulatory</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'regulatory-filings', icon: FileText, label: 'Regulatory Filings', desc: 'Filing deadlines & tracking', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'regulatoryFilings' },
          { to: 'aicte-approvals', icon: Building2, label: 'AICTE Approvals', desc: 'EOA & intake approvals', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400', statKey: 'aicteApprovals' },
          { to: 'affiliation-statuses', icon: Link2, label: 'Affiliation Status', desc: 'University affiliations', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'affiliationStatuses' },
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

      {/* Quality & Audits */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quality & Audits</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'audit-findings', icon: Search, label: 'Audit Findings', desc: 'Internal & external audits', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400', statKey: 'auditFindings' },
          { to: 'iqac-reports', icon: ClipboardList, label: 'IQAC Reports', desc: 'AQAR, SSR & quality reports', iconBg: 'bg-purple-50 text-purple-600', border: 'border-purple-200 hover:border-purple-400', statKey: 'iqacReports' },
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

      {/* Legal & RTI */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Legal & RTI</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: 'rti-requests', icon: FileWarning, label: 'RTI Requests', desc: 'Right to Information', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'rtiRequests' },
          { to: 'legal-cases', icon: Scale, label: 'Legal Cases', desc: 'Court cases & litigation', iconBg: 'bg-gray-50 text-gray-600', border: 'border-gray-200 hover:border-gray-400', statKey: 'legalCases' },
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
  return (
    <div>
      <Breadcrumbs className="mb-4" />
      {children}
    </div>
  );
}

export default function Compliance() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<ComplianceHome />} />
        <Route path="accreditation-bodies" element={<AccreditationBodiesPage />} />
        <Route path="accreditation-cycles" element={<AccreditationCyclesPage />} />
        <Route path="compliance-criteria" element={<ComplianceCriteriaPage />} />
        <Route path="regulatory-filings" element={<RegulatoryFilingsPage />} />
        <Route path="aicte-approvals" element={<AICTEApprovalsPage />} />
        <Route path="affiliation-statuses" element={<AffiliationStatusesPage />} />
        <Route path="audit-findings" element={<AuditFindingsPage />} />
        <Route path="iqac-reports" element={<IQACReportsPage />} />
        <Route path="rti-requests" element={<RTIRequestsPage />} />
        <Route path="legal-cases" element={<LegalCasesPage />} />
      </Routes>
    </SubPageWrapper>
  );
}

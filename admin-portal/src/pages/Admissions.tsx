import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStats, getWorkflowStats } from '../services/admissions';
import { UserPlus, Users, Gift, GraduationCap, TrendingUp, GitBranch, Activity, Workflow } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';

import InquiriesPage from './admissions/InquiriesPage';
import InquiryFormPage from './admissions/InquiryFormPage';
import ApplicantsPage from './admissions/ApplicantsPage';
import ExamScoresPage from './admissions/ExamScoresPage';
import CounselingPage from './admissions/CounselingPage';
import OffersPage from './admissions/OffersPage';
import DocumentsPage from './admissions/DocumentsPage';
import EnrollmentsPage from './admissions/EnrollmentsPage';
import WorkflowPage from './admissions/WorkflowPage';
import AssignmentRulesPage from './admissions/AssignmentRulesPage';
import CRMDashboardPage from './admissions/CRMDashboardPage';

const PHASE_CARDS = [
  { to: 'inquiries', icon: UserPlus, label: 'Inquiries', desc: 'Lead tracking & follow-ups', iconBg: 'bg-primary-50 text-primary-600', border: 'border-primary-200 hover:border-primary-400', statKey: 'inquiries' },
  { to: 'applicants', icon: Users, label: 'Applicants', desc: 'Application processing', iconBg: 'bg-accent-50 text-accent-500', border: 'border-accent-200 hover:border-accent-400', statKey: 'applicants' },
  { to: 'offers', icon: Gift, label: 'Offers', desc: 'Admission offer letters', iconBg: 'bg-orange-50 text-orange-500', border: 'border-orange-200 hover:border-orange-400', statKey: 'offers' },
  { to: 'enrollments', icon: GraduationCap, label: 'Enrolled', desc: 'Final admission records', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'admissions' },
];

function AdmissionsHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['admissions-stats'], queryFn: getStats });
  const { data: workflowStats } = useQuery({ queryKey: ['workflow-stats'], queryFn: getWorkflowStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Admissions</h2>

      {/* Phase Navigation Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {PHASE_CARDS.map((card, idx) => {
          const Icon = card.icon;
          const count = stats ? stats.totals[card.statKey] : '—';
          return (
            <button
              key={card.to}
              onClick={() => navigate(card.to)}
              className={`relative bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all group ${card.border}`}
            >
              <div className="absolute top-2 right-3 text-xs font-bold text-gray-300">Phase {idx + 1}</div>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}>
                <Icon size={22} />
              </div>
              <div className="text-2xl font-bold text-navy mb-1">{count}</div>
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
              {idx < PHASE_CARDS.length - 1 && (
                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-gray-300">
                  <TrendingUp size={16} className="text-teal-400" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* CRM ops strip — Gap 5 Phase B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => navigate('crm')}
          className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white px-5 py-4 text-left hover:shadow-md transition"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-600">
              <Activity size={20} />
            </div>
            <div>
              <div className="font-semibold text-navy">CRM Dashboard</div>
              <div className="text-xs text-gray-500">Pipeline, funnel, officer KPIs, UTM attribution</div>
            </div>
          </div>
        </button>
        <button
          onClick={() => navigate('assignment-rules')}
          className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-5 py-4 text-left hover:shadow-md transition"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-600">
              <Workflow size={20} />
            </div>
            <div>
              <div className="font-semibold text-navy">Assignment Rules</div>
              <div className="text-xs text-gray-500">Auto-route new inquiries to officers by attribute</div>
            </div>
          </div>
        </button>
      </div>

      <button
        onClick={() => navigate('workflow')}
        className="mb-8 w-full rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-900 px-6 py-5 text-left text-white shadow-sm transition hover:shadow-lg"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-white/10 p-3 text-teal-200">
              <GitBranch size={24} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-teal-200">Workflow Console</div>
              <div className="mt-2 text-xl font-semibold">Operate W01 as a live admissions state machine</div>
              <p className="mt-1 text-sm text-slate-300">Start inquiry workflows, inspect instances, and work pending step actions from one place.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[260px]">
            <div className="rounded-xl bg-white/10 px-4 py-3">
              <div className="text-slate-300">Active</div>
              <div className="mt-1 text-2xl font-bold">{workflowStats?.activeWorkflows || 0}</div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3">
              <div className="text-slate-300">Pending Tasks</div>
              <div className="mt-1 text-2xl font-bold">{workflowStats?.pendingTasks || 0}</div>
            </div>
          </div>
        </div>
      </button>

      {/* Status Breakdown */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="font-semibold mb-3">Inquiries by Status</h3>
            {Object.keys(stats.inquiryByStatus).length === 0 ? (
              <p className="text-sm text-gray-400">No inquiries yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.inquiryByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-gray-600">{status.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="font-semibold mb-3">Applicants by Status</h3>
            {Object.keys(stats.applicantByStatus).length === 0 ? (
              <p className="text-sm text-gray-400">No applicants yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.applicantByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-gray-600">{status.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SubPageWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const path = location.pathname;
  // Hide breadcrumb on pages that have their own navigation (form pages).
  const hasOwnNav = path.includes('/new') || path.includes('/edit');

  return (
    <div>
      {!hasOwnNav && <Breadcrumbs className="mb-4" />}
      {children}
    </div>
  );
}

export default function Admissions() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<AdmissionsHome />} />
        <Route path="inquiries" element={<InquiriesPage />} />
        <Route path="inquiries/new" element={<InquiryFormPage />} />
        <Route path="inquiries/:id/edit" element={<InquiryFormPage />} />
        <Route path="applicants" element={<ApplicantsPage />} />
        <Route path="exam-scores" element={<ExamScoresPage />} />
        <Route path="counseling" element={<CounselingPage />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="enrollments" element={<EnrollmentsPage />} />
        <Route path="workflow" element={<WorkflowPage />} />
        <Route path="assignment-rules" element={<AssignmentRulesPage />} />
        <Route path="crm" element={<CRMDashboardPage />} />
      </Routes>
    </SubPageWrapper>
  );
}

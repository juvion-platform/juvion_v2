import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStats } from '../services/admissions';
import { UserPlus, Users, Gift, GraduationCap, ArrowLeft, TrendingUp } from 'lucide-react';

import InquiriesPage from './admissions/InquiriesPage';
import InquiryFormPage from './admissions/InquiryFormPage';
import ApplicantsPage from './admissions/ApplicantsPage';
import ExamScoresPage from './admissions/ExamScoresPage';
import CounselingPage from './admissions/CounselingPage';
import OffersPage from './admissions/OffersPage';
import DocumentsPage from './admissions/DocumentsPage';
import EnrollmentsPage from './admissions/EnrollmentsPage';

const PHASE_CARDS = [
  { to: 'inquiries', icon: UserPlus, label: 'Inquiries', desc: 'Lead tracking & follow-ups', iconBg: 'bg-primary-50 text-primary-600', border: 'border-primary-200 hover:border-primary-400', statKey: 'inquiries' },
  { to: 'applicants', icon: Users, label: 'Applicants', desc: 'Application processing', iconBg: 'bg-accent-50 text-accent-500', border: 'border-accent-200 hover:border-accent-400', statKey: 'applicants' },
  { to: 'offers', icon: Gift, label: 'Offers', desc: 'Admission offer letters', iconBg: 'bg-orange-50 text-orange-500', border: 'border-orange-200 hover:border-orange-400', statKey: 'offers' },
  { to: 'enrollments', icon: GraduationCap, label: 'Enrolled', desc: 'Final admission records', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'admissions' },
];

function AdmissionsHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['admissions-stats'], queryFn: getStats });

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
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isSubPage = path !== '/admissions' && path !== '/admissions/';
  // Hide wrapper back button on pages that have their own navigation (form pages)
  const hasOwnNav = path.includes('/new') || path.includes('/edit');

  return (
    <div>
      {isSubPage && !hasOwnNav && (
        <button onClick={() => navigate('/admissions')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} className="text-gray-400" /> Back to Admissions
        </button>
      )}
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
      </Routes>
    </SubPageWrapper>
  );
}

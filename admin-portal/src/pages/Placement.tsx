import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPlacementStats } from '../services/placement';
import { ArrowLeft, Calendar, Building2, Briefcase, ClipboardList, Layers, Award, Trophy, BookOpen, GraduationCap, Dumbbell, Users, UserCheck, Lightbulb, Contact, CalendarDays, BarChart3, FileText } from 'lucide-react';

import PlacementSeasonsPage from './placement/PlacementSeasonsPage';
import CompaniesPage from './placement/CompaniesPage';
import JobPostingsPage from './placement/JobPostingsPage';
import PlacementRegistrationsPage from './placement/PlacementRegistrationsPage';
import PlacementRoundsPage from './placement/PlacementRoundsPage';
import RoundResultsPage from './placement/RoundResultsPage';
import PlacementOffersPage from './placement/PlacementOffersPage';
import InternshipPostingsPage from './placement/InternshipPostingsPage';
import InternshipApplicationsPage from './placement/InternshipApplicationsPage';
import PlacementTrainingsPage from './placement/PlacementTrainingsPage';
import TrainingAttendancePage from './placement/TrainingAttendancePage';
import MockInterviewsPage from './placement/MockInterviewsPage';
import HigherStudiesPage from './placement/HigherStudiesPage';
import EntrepreneurProfilesPage from './placement/EntrepreneurProfilesPage';
import AlumniProfilesPage from './placement/AlumniProfilesPage';
import AlumniEventsPage from './placement/AlumniEventsPage';
import PlacementReportsPage from './placement/PlacementReportsPage';

function PlacementHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['placement-stats'], queryFn: getPlacementStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Placement & Career</h2>

      {/* KPI Banner */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <span className="text-xs font-medium text-green-600 uppercase">Offers Accepted</span>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.offersAccepted || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-medium text-blue-600 uppercase">Avg Package</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{(stats.avgPackageLpa || 0).toFixed(1)} LPA</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-4">
            <span className="text-xs font-medium text-purple-600 uppercase">Max Package</span>
            <div className="text-2xl font-bold text-purple-700 mt-1">{stats.maxPackageLpa || 0} LPA</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <span className="text-xs font-medium text-amber-600 uppercase">Companies</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.companies || 0}</div>
          </div>
        </div>
      )}

      {/* Placement Seasons */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Placement Seasons</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'seasons', icon: Calendar, label: 'Seasons', desc: 'Academic placement seasons', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'placementSeasons' },
        ].map(card => {
          const Icon = card.icon;
          const count = stats ? (stats as any)[card.statKey] : '--';
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

      {/* Companies & Drives */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Companies & Drives</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'companies', icon: Building2, label: 'Companies', desc: 'Company database', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'companies' },
          { to: 'job-postings', icon: Briefcase, label: 'Job Postings', desc: 'Campus drive roles', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400', statKey: 'jobPostings' },
          { to: 'registrations', icon: ClipboardList, label: 'Registrations', desc: 'Student applications', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'registrations' },
          { to: 'rounds', icon: Layers, label: 'Rounds', desc: 'Selection rounds', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'rounds' },
        ].map(card => {
          const Icon = card.icon;
          const count = stats ? (stats as any)[card.statKey] : '--';
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

      {/* Offers & Results */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Offers & Results</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'round-results', icon: Award, label: 'Round Results', desc: 'Round-wise results', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: null },
          { to: 'offers', icon: Trophy, label: 'Offers', desc: 'Placement offers', iconBg: 'bg-green-50 text-green-600', border: 'border-green-200 hover:border-green-400', statKey: 'offers' },
        ].map(card => {
          const Icon = card.icon;
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '--';
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

      {/* Internships */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Internships</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'internships', icon: BookOpen, label: 'Internship Postings', desc: 'Internship opportunities', iconBg: 'bg-pink-50 text-pink-600', border: 'border-pink-200 hover:border-pink-400', statKey: 'internships' },
          { to: 'internship-applications', icon: FileText, label: 'Applications', desc: 'Internship applications', iconBg: 'bg-rose-50 text-rose-600', border: 'border-rose-200 hover:border-rose-400', statKey: 'internshipApps' },
        ].map(card => {
          const Icon = card.icon;
          const count = stats ? (stats as any)[card.statKey] : '--';
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

      {/* Training */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Training</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'trainings', icon: Dumbbell, label: 'Trainings', desc: 'Aptitude & soft skills', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'trainings' },
          { to: 'training-attendance', icon: UserCheck, label: 'Attendance', desc: 'Training attendance', iconBg: 'bg-lime-50 text-lime-600', border: 'border-lime-200 hover:border-lime-400', statKey: null },
          { to: 'mock-interviews', icon: Users, label: 'Mock Interviews', desc: 'Practice interviews', iconBg: 'bg-sky-50 text-sky-600', border: 'border-sky-200 hover:border-sky-400', statKey: 'mockInterviews' },
        ].map(card => {
          const Icon = card.icon;
          const count = card.statKey && stats ? (stats as any)[card.statKey] : '--';
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

      {/* Higher Studies & Alumni */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Higher Studies & Alumni</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'higher-studies', icon: GraduationCap, label: 'Higher Studies', desc: 'GATE/GRE tracking', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400', statKey: 'higherStudies' },
          { to: 'entrepreneurs', icon: Lightbulb, label: 'Entrepreneurs', desc: 'Startup profiles', iconBg: 'bg-yellow-50 text-yellow-600', border: 'border-yellow-200 hover:border-yellow-400', statKey: 'entrepreneurProfiles' },
          { to: 'alumni-profiles', icon: Contact, label: 'Alumni Profiles', desc: 'Alumni network', iconBg: 'bg-fuchsia-50 text-fuchsia-600', border: 'border-fuchsia-200 hover:border-fuchsia-400', statKey: 'alumniProfiles' },
          { to: 'alumni-events', icon: CalendarDays, label: 'Alumni Events', desc: 'Reunions & talks', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400', statKey: 'alumniEvents' },
        ].map(card => {
          const Icon = card.icon;
          const count = stats ? (stats as any)[card.statKey] : '--';
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

      {/* Reports */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Reports</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: 'reports', icon: BarChart3, label: 'Reports', desc: 'Placement analytics', iconBg: 'bg-slate-50 text-slate-600', border: 'border-slate-200 hover:border-slate-400', statKey: null },
        ].map(card => {
          const Icon = card.icon;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              <div className="text-2xl font-bold text-navy mb-1">--</div>
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
  const isSubPage = path !== '/placement' && path !== '/placement/';

  return (
    <div>
      {isSubPage && (
        <button onClick={() => navigate('/placement')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} className="text-gray-400" /> Back to Placement
        </button>
      )}
      {children}
    </div>
  );
}

export default function Placement() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<PlacementHome />} />
        <Route path="seasons" element={<PlacementSeasonsPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="job-postings" element={<JobPostingsPage />} />
        <Route path="registrations" element={<PlacementRegistrationsPage />} />
        <Route path="rounds" element={<PlacementRoundsPage />} />
        <Route path="round-results" element={<RoundResultsPage />} />
        <Route path="offers" element={<PlacementOffersPage />} />
        <Route path="internships" element={<InternshipPostingsPage />} />
        <Route path="internship-applications" element={<InternshipApplicationsPage />} />
        <Route path="trainings" element={<PlacementTrainingsPage />} />
        <Route path="training-attendance" element={<TrainingAttendancePage />} />
        <Route path="mock-interviews" element={<MockInterviewsPage />} />
        <Route path="higher-studies" element={<HigherStudiesPage />} />
        <Route path="entrepreneurs" element={<EntrepreneurProfilesPage />} />
        <Route path="alumni-profiles" element={<AlumniProfilesPage />} />
        <Route path="alumni-events" element={<AlumniEventsPage />} />
        <Route path="reports" element={<PlacementReportsPage />} />
      </Routes>
    </SubPageWrapper>
  );
}

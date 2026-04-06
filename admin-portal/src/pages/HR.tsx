import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getHRStats } from '../services/hr';
import { ArrowLeft, Users, CalendarDays, Clock, Wallet, Star, GraduationCap, Briefcase, BookOpen, Scale, LogOut, Award, ClipboardList, UserPlus } from 'lucide-react';

import EmployeesPage from './hr/EmployeesPage';
import LeaveTypesPage from './hr/LeaveTypesPage';
import LeaveApplicationsPage from './hr/LeaveApplicationsPage';
import LeaveBalancesPage from './hr/LeaveBalancesPage';
import EmployeeAttendancePage from './hr/EmployeeAttendancePage';
import OnDutyPage from './hr/OnDutyPage';
import PayStructuresPage from './hr/PayStructuresPage';
import PayrollPage from './hr/PayrollPage';
import AppraisalsPage from './hr/AppraisalsPage';
import TrainingsPage from './hr/TrainingsPage';
import TrainingParticipantsPage from './hr/TrainingParticipantsPage';
import PromotionsPage from './hr/PromotionsPage';
import QualificationsPage from './hr/QualificationsPage';
import RecruitmentsPage from './hr/RecruitmentsPage';
import JobApplicationsPage from './hr/JobApplicationsPage';
import PublicationsPage from './hr/PublicationsPage';
import ResearchProjectsPage from './hr/ResearchProjectsPage';
import GrievancesPage from './hr/GrievancesPage';
import ExitProcessPage from './hr/ExitProcessPage';

function HRHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['hr-stats'], queryFn: getHRStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Human Resources</h2>

      {/* KPI Banner */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-medium text-blue-600 uppercase">Total Employees</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.employees || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <span className="text-xs font-medium text-green-600 uppercase">Active</span>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.activeEmployees || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <span className="text-xs font-medium text-amber-600 uppercase">Pending Leaves</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.pendingLeaves || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
            <span className="text-xs font-medium text-violet-600 uppercase">Open Recruitments</span>
            <div className="text-2xl font-bold text-violet-700 mt-1">{stats.recruitments || 0}</div>
          </div>
        </div>
      )}

      {/* Employee Management */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Employee Management</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'employees', icon: Users, label: 'Employees', desc: 'Employee master data', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'employees' },
          { to: 'qualifications', icon: GraduationCap, label: 'Qualifications', desc: 'Academic qualifications', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: null },
          { to: 'promotions', icon: Award, label: 'Promotions', desc: 'Designation changes', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: null },
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

      {/* Leave & Attendance */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Leave & Attendance</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'leave-types', icon: ClipboardList, label: 'Leave Types', desc: 'Leave categories', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'leaveTypes' },
          { to: 'leave-applications', icon: CalendarDays, label: 'Leave Applications', desc: 'Apply & approve leaves', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'leaveApplications' },
          { to: 'leave-balances', icon: Scale, label: 'Leave Balances', desc: 'Balance tracking', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: null },
          { to: 'attendance', icon: Clock, label: 'Attendance', desc: 'Biometric & manual', iconBg: 'bg-rose-50 text-rose-600', border: 'border-rose-200 hover:border-rose-400', statKey: null },
          { to: 'on-duty', icon: Briefcase, label: 'On Duty', desc: 'OD applications', iconBg: 'bg-sky-50 text-sky-600', border: 'border-sky-200 hover:border-sky-400', statKey: null },
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

      {/* Payroll */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Payroll</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'pay-structures', icon: Wallet, label: 'Pay Structures', desc: 'Salary breakdowns', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400', statKey: null },
          { to: 'payroll', icon: Wallet, label: 'Payroll', desc: 'Monthly salary processing', iconBg: 'bg-green-50 text-green-600', border: 'border-green-200 hover:border-green-400', statKey: 'payrolls' },
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

      {/* Performance & Training */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Performance & Training</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'appraisals', icon: Star, label: 'Appraisals', desc: 'Performance reviews', iconBg: 'bg-yellow-50 text-yellow-600', border: 'border-yellow-200 hover:border-yellow-400', statKey: 'appraisals' },
          { to: 'trainings', icon: GraduationCap, label: 'Trainings', desc: 'FDPs & workshops', iconBg: 'bg-purple-50 text-purple-600', border: 'border-purple-200 hover:border-purple-400', statKey: 'trainings' },
          { to: 'training-participants', icon: Users, label: 'Participants', desc: 'Training participants', iconBg: 'bg-fuchsia-50 text-fuchsia-600', border: 'border-fuchsia-200 hover:border-fuchsia-400', statKey: null },
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

      {/* Recruitment */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recruitment</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'recruitments', icon: UserPlus, label: 'Recruitments', desc: 'Job postings', iconBg: 'bg-lime-50 text-lime-600', border: 'border-lime-200 hover:border-lime-400', statKey: 'recruitments' },
          { to: 'job-applications', icon: Briefcase, label: 'Applications', desc: 'Candidate tracking', iconBg: 'bg-stone-50 text-stone-600', border: 'border-stone-200 hover:border-stone-400', statKey: null },
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

      {/* Research & Publications */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Research & Publications</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'publications', icon: BookOpen, label: 'Publications', desc: 'Journals & conferences', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400', statKey: 'publications' },
          { to: 'research-projects', icon: BookOpen, label: 'Research Projects', desc: 'Funded projects', iconBg: 'bg-pink-50 text-pink-600', border: 'border-pink-200 hover:border-pink-400', statKey: 'researchProjects' },
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

      {/* Employee Relations */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Employee Relations</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: 'grievances', icon: Scale, label: 'Grievances', desc: 'Complaints & resolution', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400', statKey: null },
          { to: 'exit-process', icon: LogOut, label: 'Exit Process', desc: 'Separation management', iconBg: 'bg-gray-50 text-gray-600', border: 'border-gray-200 hover:border-gray-400', statKey: null },
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
  const isSubPage = path !== '/hr' && path !== '/hr/';

  return (
    <div>
      {isSubPage && (
        <button onClick={() => navigate('/hr')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} className="text-gray-400" /> Back to HR
        </button>
      )}
      {children}
    </div>
  );
}

export default function HR() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<HRHome />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="qualifications" element={<QualificationsPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="leave-types" element={<LeaveTypesPage />} />
        <Route path="leave-applications" element={<LeaveApplicationsPage />} />
        <Route path="leave-balances" element={<LeaveBalancesPage />} />
        <Route path="attendance" element={<EmployeeAttendancePage />} />
        <Route path="on-duty" element={<OnDutyPage />} />
        <Route path="pay-structures" element={<PayStructuresPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="appraisals" element={<AppraisalsPage />} />
        <Route path="trainings" element={<TrainingsPage />} />
        <Route path="training-participants" element={<TrainingParticipantsPage />} />
        <Route path="recruitments" element={<RecruitmentsPage />} />
        <Route path="job-applications" element={<JobApplicationsPage />} />
        <Route path="publications" element={<PublicationsPage />} />
        <Route path="research-projects" element={<ResearchProjectsPage />} />
        <Route path="grievances" element={<GrievancesPage />} />
        <Route path="exit-process" element={<ExitProcessPage />} />
      </Routes>
    </SubPageWrapper>
  );
}

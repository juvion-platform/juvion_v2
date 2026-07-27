import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getWelfareStats } from '../services/welfare';
import { Building2, DoorOpen, BedDouble, UserCheck, Utensils, MessageSquare, Bus, MapPin, Heart, Stethoscope, Brain, AlertTriangle, ShieldAlert, FileWarning, Shield, Users } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { StatBannerSkeleton } from '../components/ui/Skeleton';

import HostelBlocksPage from './welfare/HostelBlocksPage';
import HostelRoomsPage from './welfare/HostelRoomsPage';
import HostelAllocationsPage from './welfare/HostelAllocationsPage';
import HostelVisitorLogsPage from './welfare/HostelVisitorLogsPage';
import MessMenusPage from './welfare/MessMenusPage';
import MessFeedbackPage from './welfare/MessFeedbackPage';
import TransportRoutesPage from './welfare/TransportRoutesPage';
import TransportAllocationsPage from './welfare/TransportAllocationsPage';
import HealthRecordsPage from './welfare/HealthRecordsPage';
import MedicalVisitsPage from './welfare/MedicalVisitsPage';
import CounselingSessionsPage from './welfare/CounselingSessionsPage';
import CrisisAlertsPage from './welfare/CrisisAlertsPage';
import AntiRaggingComplaintsPage from './welfare/AntiRaggingComplaintsPage';
import StudentGrievancesPage from './welfare/StudentGrievancesPage';
import InsuranceClaimsPage from './welfare/InsuranceClaimsPage';
import ParentMeetingsPage from './welfare/ParentMeetingsPage';

function WelfareHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['welfare-stats'], queryFn: getWelfareStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Student Welfare</h2>

      {/* KPI Banner */}
      {!stats ? (
        <StatBannerSkeleton count={4} />
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-medium text-blue-600 uppercase">Active Hostel</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.activeHostelAllocations || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <span className="text-xs font-medium text-green-600 uppercase">Transport Routes</span>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.transportRoutes || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-4">
            <span className="text-xs font-medium text-red-600 uppercase">Active Alerts</span>
            <div className="text-2xl font-bold text-red-700 mt-1">{stats.activeCrisisAlerts || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <span className="text-xs font-medium text-amber-600 uppercase">Open Grievances</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.openGrievances || 0}</div>
          </div>
        </div>
      )}

      {/* Hostel Management */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Hostel Management</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'hostel-blocks', icon: Building2, label: 'Hostel Blocks', desc: 'Blocks & wardens', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400', statKey: 'hostelBlocks' },
          { to: 'hostel-rooms', icon: DoorOpen, label: 'Hostel Rooms', desc: 'Room inventory & status', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'hostelRooms' },
          { to: 'hostel-allocations', icon: BedDouble, label: 'Allocations', desc: 'Student room allocation', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'hostelAllocations' },
          { to: 'hostel-visitor-logs', icon: UserCheck, label: 'Visitor Logs', desc: 'Visitor entry & exit', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'visitorLogs' },
        ].map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Mess */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Mess</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'mess-menus', icon: Utensils, label: 'Mess Menus', desc: 'Weekly meal plans', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'messMenus' },
          { to: 'mess-feedback', icon: MessageSquare, label: 'Mess Feedback', desc: 'Student ratings', iconBg: 'bg-yellow-50 text-yellow-600', border: 'border-yellow-200 hover:border-yellow-400', statKey: 'messFeedbacks' },
        ].map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Transport */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Transport</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'transport-routes', icon: Bus, label: 'Routes', desc: 'Bus routes & stops', iconBg: 'bg-green-50 text-green-600', border: 'border-green-200 hover:border-green-400', statKey: 'transportRoutes' },
          { to: 'transport-allocations', icon: MapPin, label: 'Allocations', desc: 'Student bus allocation', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'transportAllocations' },
        ].map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Health */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Health & Wellness</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'health-records', icon: Heart, label: 'Health Records', desc: 'Medical profiles', iconBg: 'bg-rose-50 text-rose-600', border: 'border-rose-200 hover:border-rose-400', statKey: 'healthRecords' },
          { to: 'medical-visits', icon: Stethoscope, label: 'Medical Visits', desc: 'Clinic visit log', iconBg: 'bg-pink-50 text-pink-600', border: 'border-pink-200 hover:border-pink-400', statKey: 'medicalVisits' },
          { to: 'insurance-claims', icon: Shield, label: 'Insurance Claims', desc: 'Claim processing', iconBg: 'bg-sky-50 text-sky-600', border: 'border-sky-200 hover:border-sky-400', statKey: 'insuranceClaims' },
        ].map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Counseling & Safety */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Counseling & Safety</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'counseling-sessions', icon: Brain, label: 'Counseling', desc: 'Counseling sessions', iconBg: 'bg-purple-50 text-purple-600', border: 'border-purple-200 hover:border-purple-400', statKey: 'counselingSessions' },
          { to: 'crisis-alerts', icon: AlertTriangle, label: 'Crisis Alerts', desc: 'Emergency alerts', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400', statKey: 'crisisAlerts' },
          { to: 'anti-ragging', icon: ShieldAlert, label: 'Anti-Ragging', desc: 'Ragging complaints', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'antiRaggingComplaints' },
        ].map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Grievances & Parent Engagement */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Grievances & Parent Engagement</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: 'student-grievances', icon: FileWarning, label: 'Grievances', desc: 'Student grievance cell', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'studentGrievances' },
          { to: 'parent-meetings', icon: Users, label: 'Parent Meetings', desc: 'Parent-teacher meetings', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400', statKey: 'parentMeetings' },
        ].map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
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

export default function Welfare() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<WelfareHome />} />
        <Route path="hostel-blocks" element={<HostelBlocksPage />} />
        <Route path="hostel-rooms" element={<HostelRoomsPage />} />
        <Route path="hostel-allocations" element={<HostelAllocationsPage />} />
        <Route path="hostel-visitor-logs" element={<HostelVisitorLogsPage />} />
        <Route path="mess-menus" element={<MessMenusPage />} />
        <Route path="mess-feedback" element={<MessFeedbackPage />} />
        <Route path="transport-routes" element={<TransportRoutesPage />} />
        <Route path="transport-allocations" element={<TransportAllocationsPage />} />
        <Route path="health-records" element={<HealthRecordsPage />} />
        <Route path="medical-visits" element={<MedicalVisitsPage />} />
        <Route path="counseling-sessions" element={<CounselingSessionsPage />} />
        <Route path="crisis-alerts" element={<CrisisAlertsPage />} />
        <Route path="anti-ragging" element={<AntiRaggingComplaintsPage />} />
        <Route path="student-grievances" element={<StudentGrievancesPage />} />
        <Route path="insurance-claims" element={<InsuranceClaimsPage />} />
        <Route path="parent-meetings" element={<ParentMeetingsPage />} />
      </Routes>
    </SubPageWrapper>
  );
}

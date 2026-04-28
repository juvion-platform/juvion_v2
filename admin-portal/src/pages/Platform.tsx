import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPlatformStats } from '../services/platform';
import { Megaphone, FileText, Bell, ClipboardList, MessageSquare, Mail, Smartphone, MessageCircle, Shield } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';

import AnnouncementsPage from './platform/AnnouncementsPage';
import CircularsPage from './platform/CircularsPage';
import NotificationsPage from './platform/NotificationsPage';
import FeedbackSurveysPage from './platform/FeedbackSurveysPage';
import SurveyResponsesPage from './platform/SurveyResponsesPage';
import EmailLogsPage from './platform/EmailLogsPage';
import SMSLogsPage from './platform/SMSLogsPage';
import WhatsAppLogsPage from './platform/WhatsAppLogsPage';
import RbacPoliciesPage from './platform/RbacPolicies';

function PlatformHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['platform-stats'], queryFn: getPlatformStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Platform & Communication</h2>

      {/* KPI Banner */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-medium text-blue-600 uppercase">Announcements</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.announcements || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <span className="text-xs font-medium text-green-600 uppercase">Active Surveys</span>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.activeSurveys || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <span className="text-xs font-medium text-amber-600 uppercase">Draft Notifications</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.draftNotifications || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
            <span className="text-xs font-medium text-violet-600 uppercase">Emails Sent</span>
            <div className="text-2xl font-bold text-violet-700 mt-1">{stats.emailLogs || 0}</div>
          </div>
        </div>
      )}

      {/* Communication */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Communication</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'announcements', icon: Megaphone, label: 'Announcements', desc: 'Broadcast announcements', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'announcements' },
          { to: 'circulars', icon: FileText, label: 'Circulars', desc: 'Official circulars', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'circulars' },
          { to: 'notifications', icon: Bell, label: 'Notifications', desc: 'Push & in-app alerts', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'notifications' },
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

      {/* Feedback & Surveys */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Feedback & Surveys</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'feedback-surveys', icon: ClipboardList, label: 'Feedback Surveys', desc: 'Create & manage surveys', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'feedbackSurveys' },
          { to: 'survey-responses', icon: MessageSquare, label: 'Survey Responses', desc: 'View responses', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'surveyResponses' },
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

      {/* Message Logs */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Message Logs</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: 'email-logs', icon: Mail, label: 'Email Logs', desc: 'Email delivery tracking', iconBg: 'bg-rose-50 text-rose-600', border: 'border-rose-200 hover:border-rose-400', statKey: 'emailLogs' },
          { to: 'sms-logs', icon: Smartphone, label: 'SMS Logs', desc: 'SMS delivery tracking', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'smsLogs' },
          { to: 'whatsapp-logs', icon: MessageCircle, label: 'WhatsApp Logs', desc: 'WhatsApp message tracking', iconBg: 'bg-green-50 text-green-600', border: 'border-green-200 hover:border-green-400', statKey: 'whatsAppLogs' },
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

      {/* Administration */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-8">Administration</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => navigate('rbac-policies')} className="bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all border-gray-200 hover:border-gray-400">
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-purple-50 text-purple-600"><Shield size={22} /></div>
          <div className="font-semibold text-navy-dark text-sm">RBAC Policies</div>
          <p className="text-xs text-gray-500 mt-1">Manage access control policies</p>
        </button>
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

export default function Platform() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<PlatformHome />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="circulars" element={<CircularsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="feedback-surveys" element={<FeedbackSurveysPage />} />
        <Route path="survey-responses" element={<SurveyResponsesPage />} />
        <Route path="email-logs" element={<EmailLogsPage />} />
        <Route path="sms-logs" element={<SMSLogsPage />} />
        <Route path="whatsapp-logs" element={<WhatsAppLogsPage />} />
        <Route path="rbac-policies" element={<RbacPoliciesPage />} />
      </Routes>
    </SubPageWrapper>
  );
}

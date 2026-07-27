import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getJuviStats } from '../services/juvi';
import { MessageSquare, Mail, Zap, Lightbulb, BookOpen, UserCog, ThumbsUp, BarChart3 } from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { StatBannerSkeleton } from '../components/ui/Skeleton';

import ConversationsPage from './juvi/ConversationsPage';
import MessagesPage from './juvi/MessagesPage';
import ActionsPage from './juvi/ActionsPage';
import InsightsPage from './juvi/InsightsPage';
import KnowledgeBasePage from './juvi/KnowledgeBasePage';
import PersonaConfigsPage from './juvi/PersonaConfigsPage';
import FeedbackPage from './juvi/FeedbackPage';
import UsageMetricsPage from './juvi/UsageMetricsPage';

function JuviHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['juvi-stats'], queryFn: getJuviStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Juvi AI Assistant</h2>

      {/* KPI Banner */}
      {!stats ? (
        <StatBannerSkeleton count={4} />
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-medium text-blue-600 uppercase">Total Conversations</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.conversations ?? 0}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <span className="text-xs font-medium text-green-600 uppercase">Active Conversations</span>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.activeConversations ?? 0}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-4">
            <span className="text-xs font-medium text-purple-600 uppercase">Total Messages</span>
            <div className="text-2xl font-bold text-purple-700 mt-1">{stats.messages ?? 0}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <span className="text-xs font-medium text-amber-600 uppercase">Active Insights</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.activeInsights ?? 0}</div>
          </div>
        </div>
      )}

      {/* Chat */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Chat</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'conversations', icon: MessageSquare, label: 'Conversations', desc: 'Chat sessions & history', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'conversations' },
          { to: 'messages', icon: Mail, label: 'Messages', desc: 'Individual messages', iconBg: 'bg-purple-50 text-purple-600', border: 'border-purple-200 hover:border-purple-400', statKey: 'messages' },
          { to: 'actions', icon: Zap, label: 'Actions', desc: 'Executed operations', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'actions' },
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

      {/* Insights */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Insights</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'insights', icon: Lightbulb, label: 'Insights', desc: 'Proactive analytics & alerts', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'insights' },
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

      {/* Knowledge Base */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Knowledge Base</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { to: 'knowledge-base', icon: BookOpen, label: 'Knowledge Base', desc: 'FAQ management & training', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'knowledgeBase' },
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

      {/* Personas & Usage */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Personas & Usage</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: 'persona-configs', icon: UserCog, label: 'Persona Configs', desc: 'Role-based AI configs', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'personas' },
          { to: 'feedback', icon: ThumbsUp, label: 'Feedback', desc: 'User ratings & comments', iconBg: 'bg-pink-50 text-pink-600', border: 'border-pink-200 hover:border-pink-400', statKey: 'feedback' },
          { to: 'usage-metrics', icon: BarChart3, label: 'Usage Metrics', desc: 'Analytics & performance', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'usageMetrics' },
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

export default function Juvi() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<JuviHome />} />
        <Route path="conversations" element={<ConversationsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="actions" element={<ActionsPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="persona-configs" element={<PersonaConfigsPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="usage-metrics" element={<UsageMetricsPage />} />
      </Routes>
    </SubPageWrapper>
  );
}

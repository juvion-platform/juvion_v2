import { useQuery } from '@tanstack/react-query';
import {
  getCRMPipeline, getCRMFunnel, getCRMOfficers, getCRMSources,
  type CRMFunnelStats, type CRMOfficerStats, type CRMSourceStats,
} from '../../services/admissions';
import { Users, TrendingUp, Globe, Filter, Sparkles, ArrowDownRight } from 'lucide-react';

// ─── Visual constants ─────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-slate-400',
  contacted: 'bg-blue-500',
  follow_up: 'bg-blue-400',
  interested: 'bg-indigo-500',
  mql: 'bg-purple-500',
  sql: 'bg-fuchsia-500',
  qualified: 'bg-teal-500',
  visited: 'bg-cyan-500',
  visit_scheduled: 'bg-cyan-400',
  visit_completed: 'bg-cyan-500',
  fee_quoted: 'bg-amber-500',
  converted: 'bg-emerald-500',
  lost: 'bg-rose-500',
  disqualified: 'bg-rose-400',
  dormant: 'bg-gray-400',
};
const colorFor = (status: string) => STATUS_COLORS[status] || 'bg-gray-300';

const FUNNEL_STAGE_LABELS: Record<string, string> = {
  new: 'New',
  engaged: 'Engaged',
  mql: 'MQL',
  sql: 'SQL',
  converted: 'Converted',
};

// ─── Small helpers ────────────────────────────────────────────────
function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}

// ─── Sub-components ───────────────────────────────────────────────

function PipelineCard({ data }: { data: { total: number; byStatus: Record<string, number> } }) {
  const entries = Object.entries(data.byStatus).sort((a, b) => b[1] - a[1]);
  const max = entries.length > 0 ? Math.max(...entries.map(([, v]) => v)) : 1;
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary-600" />
          <h3 className="font-semibold text-navy">Pipeline by Status</h3>
        </div>
        <span className="text-sm text-gray-500">{data.total} total inquiries</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">No inquiries in the pipeline yet.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {entries.map(([status, count]) => (
            <div key={status} className="flex items-center gap-3">
              <div className="text-xs text-gray-600 capitalize w-32 shrink-0">{status.replace(/_/g, ' ')}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className={`h-full ${colorFor(status)} transition-all`} style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <div className="text-sm font-medium text-gray-800 w-10 text-right">{count}</div>
              <div className="text-xs text-gray-400 w-12 text-right">{pct(count, data.total)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FunnelCard({ data }: { data: CRMFunnelStats }) {
  const max = data.stages.length > 0 ? Math.max(...data.stages.map((s) => s.count), 1) : 1;
  const newCount = data.stages.find((s) => s.stage === 'new')?.count || 0;
  const converted = data.stages.find((s) => s.stage === 'converted')?.count || 0;
  const conversionRate = newCount + converted > 0 ? pct(converted, newCount + converted) : 0;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-indigo-500" />
          <h3 className="font-semibold text-navy">Conversion Funnel</h3>
        </div>
        <span className="text-sm text-gray-500">{conversionRate}% end-to-end</span>
      </div>
      <div className="space-y-3">
        {data.stages.map((s, idx) => {
          const widthPct = (s.count / max) * 100;
          // Tapered look: each stage slightly narrower than the previous.
          const stageWidth = Math.max(20, 100 - idx * 10);
          return (
            <div key={s.stage} className="flex items-center gap-3">
              <div className="text-xs font-medium text-gray-700 w-24 shrink-0">{FUNNEL_STAGE_LABELS[s.stage] || s.stage}</div>
              <div className="flex-1 relative h-9 bg-gray-50 rounded">
                <div
                  className="absolute left-1/2 -translate-x-1/2 h-full rounded bg-gradient-to-r from-indigo-400 to-indigo-600 flex items-center justify-center text-xs font-semibold text-white transition-all"
                  style={{ width: `${Math.max(15, (widthPct * stageWidth) / 100)}%` }}
                >
                  {s.count}
                </div>
              </div>
              <ArrowDownRight size={14} className={idx === data.stages.length - 1 ? 'invisible text-gray-300' : 'text-gray-300'} />
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t flex flex-wrap gap-2 text-xs text-gray-500">
        {data.stages.map((s) => (
          <span key={s.stage} className="bg-gray-50 rounded px-2 py-0.5">
            <strong>{FUNNEL_STAGE_LABELS[s.stage] || s.stage}</strong>: {s.statuses.join(', ') || '—'}
          </span>
        ))}
      </div>
    </div>
  );
}

function OfficersCard({ data }: { data: CRMOfficerStats }) {
  const officers = [...data.officers].sort((a, b) => b.assigned - a.assigned);
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-amber-500" />
          <h3 className="font-semibold text-navy">Officer Performance</h3>
        </div>
        {data.unassigned > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">{data.unassigned} unassigned</span>
        )}
      </div>
      {officers.length === 0 ? (
        <p className="text-sm text-gray-400">No officer assignments yet — create assignment rules to start routing.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">Officer</th>
              <th className="py-2 text-right">Assigned</th>
              <th className="py-2 text-right">Converted</th>
              <th className="py-2 text-right">Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            {officers.map((o) => (
              <tr key={o.officerId} className="border-b last:border-b-0">
                <td className="py-2 font-medium text-gray-800">{o.name}</td>
                <td className="py-2 text-right">{o.assigned}</td>
                <td className="py-2 text-right text-emerald-600">{o.converted}</td>
                <td className="py-2 text-right">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${o.conversionRate >= 30 ? 'bg-emerald-100 text-emerald-700' : o.conversionRate >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    {o.conversionRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SourcesCard({ data }: { data: CRMSourceStats }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe size={18} className="text-cyan-500" />
        <h3 className="font-semibold text-navy">Source Attribution</h3>
      </div>

      {/* Lead source */}
      <div className="mb-5">
        <div className="text-xs font-medium text-gray-500 uppercase mb-2">By Lead Source</div>
        {data.bySource.length === 0 ? (
          <p className="text-sm text-gray-400">No source data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-1">Source</th>
                <th className="py-1 text-right">Inquiries</th>
                <th className="py-1 text-right">Converted</th>
                <th className="py-1 text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.bySource.map((s) => (
                <tr key={s.source || '(none)'} className="border-b last:border-b-0">
                  <td className="py-1.5 capitalize">{(s.source || '(none)').replace(/_/g, ' ')}</td>
                  <td className="py-1.5 text-right">{s.inquiries}</td>
                  <td className="py-1.5 text-right text-emerald-600">{s.converted}</td>
                  <td className="py-1.5 text-right text-xs text-gray-500">{s.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* UTM */}
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase mb-2">By UTM Campaign</div>
        {data.byUtmCampaign.length === 0 ? (
          <p className="text-sm text-gray-400">No UTM-tagged inquiries yet. Add UTM parameters to your campaign URLs to track attribution.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-1">Campaign</th>
                <th className="py-1 text-right">Inquiries</th>
                <th className="py-1 text-right">Converted</th>
                <th className="py-1 text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.byUtmCampaign.map((c) => (
                <tr key={c.utmCampaign || '(none)'} className="border-b last:border-b-0">
                  <td className="py-1.5">{c.utmCampaign || <span className="text-gray-400">(none)</span>}</td>
                  <td className="py-1.5 text-right">{c.inquiries}</td>
                  <td className="py-1.5 text-right text-emerald-600">{c.converted}</td>
                  <td className="py-1.5 text-right text-xs text-gray-500">{c.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function CRMDashboardPage() {
  const { data: pipeline, isLoading: pipelineLoading } = useQuery({ queryKey: ['crm-pipeline'], queryFn: getCRMPipeline });
  const { data: funnel, isLoading: funnelLoading } = useQuery({ queryKey: ['crm-funnel'], queryFn: getCRMFunnel });
  const { data: officers, isLoading: officersLoading } = useQuery({ queryKey: ['crm-officers'], queryFn: getCRMOfficers });
  const { data: sources, isLoading: sourcesLoading } = useQuery({ queryKey: ['crm-sources'], queryFn: getCRMSources });

  const totalAssigned = officers?.officers.reduce((acc, o) => acc + o.assigned, 0) || 0;
  const totalConverted = officers?.officers.reduce((acc, o) => acc + o.converted, 0) || 0;
  const overallConversion = pipeline && pipeline.total > 0 ? pct(totalConverted, pipeline.total) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-navy">CRM Dashboard</h2>
          <p className="text-xs text-gray-500 mt-1">Lead pipeline, conversion funnel, officer KPIs, and UTM attribution.</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">Total Inquiries</div>
          <div className="text-2xl font-bold text-navy">{pipeline?.total ?? '—'}</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">Assigned</div>
          <div className="text-2xl font-bold text-navy">{totalAssigned}</div>
          {officers && officers.unassigned > 0 && (
            <div className="text-xs text-amber-600 mt-0.5">{officers.unassigned} unassigned</div>
          )}
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">Converted</div>
          <div className="text-2xl font-bold text-emerald-600">{totalConverted}</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">Conversion Rate</div>
          <div className="text-2xl font-bold text-emerald-600 flex items-center gap-1">
            {overallConversion}%
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Loading state */}
      {(pipelineLoading || funnelLoading || officersLoading || sourcesLoading) && (
        <div className="text-sm text-gray-400 mb-4">Loading dashboard…</div>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {pipeline && <PipelineCard data={pipeline} />}
        {funnel && <FunnelCard data={funnel} />}
        {officers && <OfficersCard data={officers} />}
        {sources && <SourcesCard data={sources} />}
      </div>
    </div>
  );
}

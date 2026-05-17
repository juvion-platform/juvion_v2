import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  listReportDefinitions, runReport, type ReportDefinition,
  type ReportParam, type ReportRun,
} from '../../services/governance';
import Badge from '../../components/ui/Badge';
import NlQueryPanel from '../../components/governance/NlQueryPanel';
import { FileText, Play, AlertCircle, CheckCircle2, Clock, Construction, ArrowLeft } from 'lucide-react';

// Strategic Gap 4 — declarative reports browser.
// Phase A ships 12 report definitions; runners for 3 are implemented.
// The doc's v1 recommendation: fixed-format reports with parameter
// inputs. v1.5 adds the schema-driven engine that can compose new
// reports from the catalog without code changes.

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

// ─── Category styling ────────────────────────────────────────────
const CATEGORY_COLOR: Record<string, string> = {
  admissions: 'bg-primary-50 text-primary-600',
  finance: 'bg-emerald-50 text-emerald-600',
  academics: 'bg-blue-50 text-blue-600',
  people: 'bg-indigo-50 text-indigo-600',
  hostel: 'bg-orange-50 text-orange-600',
  transport: 'bg-cyan-50 text-cyan-600',
  placement: 'bg-purple-50 text-purple-600',
  library: 'bg-rose-50 text-rose-600',
  compliance: 'bg-amber-50 text-amber-600',
};

// ─── Parameter renderer ──────────────────────────────────────────

function ParamInput({ param, value, onChange }: { param: ReportParam; value: unknown; onChange: (v: unknown) => void }) {
  switch (param.type) {
    case 'date':
      return <input type="date" value={value == null ? '' : String(value).slice(0, 10)} onChange={(e) => onChange(e.target.value)} className={inp} />;
    case 'number':
      return <input type="number" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={inp} />;
    case 'select':
      return (
        <select value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} className={inp}>
          {!param.required && <option value="">Select…</option>}
          {(param.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'boolean':
      return (
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      );
    default:
      return <input type="text" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} className={inp} />;
  }
}

// ─── Result table ─────────────────────────────────────────────────

function ResultViewer({ def, run }: { def: ReportDefinition; run: ReportRun }) {
  if (run.status === 'unimplemented') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-3">
        <Construction size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong>Phase B runner.</strong> The report definition + parameter schema are stable. The aggregation runner ships in the next iteration.
          {run.unimplementedReason && <div className="text-xs mt-1 italic">{run.unimplementedReason}</div>}
        </div>
      </div>
    );
  }
  if (run.status === 'failed') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 flex items-start gap-3">
        <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
        <div>
          <strong>Run failed.</strong>
          <div className="text-xs mt-1 font-mono">{run.error || 'Unknown error'}</div>
        </div>
      </div>
    );
  }
  const rows = (run.result || []) as Record<string, unknown>[];
  if (rows.length === 0) {
    return <div className="text-sm text-gray-400">No rows returned.</div>;
  }
  return (
    <div className="space-y-3">
      {run.summary && Object.keys(run.summary).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(run.summary).map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-lg border p-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide">{k}</div>
              <div className="text-lg font-bold text-navy mt-1">{String(v)}</div>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-gray-500">{run.resultCount} row{run.resultCount === 1 ? '' : 's'} · {run.durationMs}ms</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {def.columns.map((c) => (
                <th key={c.key} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                {def.columns.map((c) => {
                  const v = row[c.key];
                  let display: any = v == null ? '—' : String(v);
                  if (c.type === 'percent' && typeof v === 'number') display = `${v}%`;
                  if (c.type === 'currency' && typeof v === 'number') display = `₹${v.toLocaleString('en-IN')}`;
                  return <td key={c.key} className="px-3 py-2 text-gray-800">{display}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Hub / picker view ───────────────────────────────────────────

function ReportsHub({ defs, onPick }: { defs: ReportDefinition[]; onPick: (d: ReportDefinition) => void }) {
  // Group by category.
  const byCategory = useMemo(() => {
    const m: Record<string, ReportDefinition[]> = {};
    for (const d of defs) {
      (m[d.category] ||= []).push(d);
    }
    return m;
  }, [defs]);

  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-2">Reports</h2>
      <p className="text-sm text-gray-500 mb-6">
        Fixed-format reports with parameter inputs (v1). The fully declarative engine (compose new reports without code) ships in v1.5.
      </p>
      {Object.entries(byCategory).map(([cat, items]) => (
        <div key={cat} className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize">{cat}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((d) => (
              <button
                key={d.code}
                onClick={() => onPick(d)}
                className="text-left bg-white rounded-xl border-2 border-gray-200 shadow-sm p-5 hover:shadow-lg hover:border-primary-300 transition-all"
              >
                <div className={`inline-flex p-2.5 rounded-lg mb-3 ${CATEGORY_COLOR[d.category] || 'bg-gray-50 text-gray-600'}`}>
                  <FileText size={22} />
                </div>
                <div className="font-semibold text-navy-dark">{d.label}</div>
                <p className="text-xs text-gray-500 mt-1">{d.description}</p>
                {d.implementationStatus === 'phase_b' && (
                  <div className="mt-2"><Badge variant="warning">Phase B runner</Badge></div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Run view ────────────────────────────────────────────────────

function ReportRunner({ def, initialParams, onBack }: { def: ReportDefinition; initialParams?: Record<string, unknown>; onBack: () => void }) {
  const [params, setParams] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const p of def.parameters) {
      if (p.default !== undefined) init[p.key] = p.default;
    }
    // 003 — when entering via NL "Run as picker", pre-fill the form so
    // the admin sees exactly what the LLM proposed before they Run.
    if (initialParams) Object.assign(init, initialParams);
    return init;
  });
  const [currentRun, setCurrentRun] = useState<ReportRun | null>(null);

  const runMut = useMutation({
    mutationFn: () => runReport(def.code, params),
    onSuccess: (run) => setCurrentRun(run),
    onError: (err: any) => alert(err?.response?.data?.error || err?.message || 'Run failed'),
  });

  function handleRun(e: React.FormEvent) {
    e.preventDefault();
    runMut.mutate();
  }

  const StatusIcon = (() => {
    if (!currentRun) return Clock;
    if (currentRun.status === 'success') return CheckCircle2;
    if (currentRun.status === 'unimplemented') return Construction;
    return AlertCircle;
  })();
  const statusColor = !currentRun ? 'text-gray-400'
    : currentRun.status === 'success' ? 'text-emerald-600'
    : currentRun.status === 'unimplemented' ? 'text-amber-600'
    : 'text-red-600';

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-3">
        <ArrowLeft size={14} /> All reports
      </button>
      <div className="flex items-center gap-3 mb-5">
        <div className={`rounded-lg p-2.5 ${CATEGORY_COLOR[def.category] || 'bg-gray-50 text-gray-600'}`}><FileText size={20} /></div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-navy">{def.label}</h2>
            {def.implementationStatus === 'phase_b' && <Badge variant="warning">Phase B runner</Badge>}
          </div>
          <p className="text-sm text-gray-500 mt-1">{def.description}</p>
        </div>
      </div>

      <form onSubmit={handleRun} className="bg-white rounded-xl border shadow-sm p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Parameters</h3>
        {def.parameters.length === 0 ? (
          <p className="text-xs text-gray-400 mb-4">This report takes no parameters.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {def.parameters.map((p) => (
              <div key={p.key}>
                <label className={lbl}>
                  {p.label}{p.required && <span className="text-red-500"> *</span>}
                </label>
                <ParamInput param={p} value={params[p.key]} onChange={(v) => setParams((prev) => ({ ...prev, [p.key]: v }))} />
                {p.helpText && <p className="text-xs text-gray-500 mt-1">{p.helpText}</p>}
              </div>
            ))}
          </div>
        )}
        <button type="submit" disabled={runMut.isPending} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
          <Play size={14} className="text-white" />
          {runMut.isPending ? 'Running…' : 'Run Report'}
        </button>
      </form>

      {currentRun && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b">
            <StatusIcon size={18} className={statusColor} />
            <span className="text-sm font-medium capitalize">{currentRun.status.replace('_', ' ')}</span>
            <span className="text-xs text-gray-400">· Run {currentRun._id.slice(-6)}</span>
          </div>
          <ResultViewer def={def} run={currentRun} />
        </div>
      )}
    </div>
  );
}

// ─── Top-level ────────────────────────────────────────────────────

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-definitions'],
    queryFn: listReportDefinitions,
  });
  const [active, setActive] = useState<ReportDefinition | null>(null);
  const [pendingParams, setPendingParams] = useState<Record<string, unknown> | undefined>(undefined);
  // 004 §G.4 — role gate removed. After RBAC_NL_ENFORCE='true' + §10.9 seed,
  // HOD / faculty / principal also reach this panel. Backend authorize() decides;
  // FE renders a policy-denied banner inline if the request returns 403.
  const showNlPanel = true;

  // 003 — Run as picker: look up the def, prime the params, switch to runner view.
  function handleRunAsPicker(reportCode: string, params: Record<string, unknown>) {
    const def = (data?.definitions || []).find((d) => d.code === reportCode);
    if (!def) return;
    setPendingParams(params);
    setActive(def);
  }

  if (isLoading) return <div className="text-sm text-gray-400">Loading reports…</div>;
  if (!active) {
    return (
      <div>
        {showNlPanel && <NlQueryPanel onRunAsPicker={handleRunAsPicker} />}
        <ReportsHub defs={data?.definitions || []} onPick={setActive} />
      </div>
    );
  }
  return (
    <ReportRunner
      def={active}
      initialParams={pendingParams}
      onBack={() => { setActive(null); setPendingParams(undefined); }}
    />
  );
}

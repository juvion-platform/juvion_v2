/**
 * FeeDashboardPage (T9 — Fee Collection Analytics & Alerts)
 *
 * Route: `/finance/dashboard`.
 * Consumes `GET /finance/analytics/dashboard` + `GET /finance/analytics/defaulters`.
 * Layout:
 *   Header (title + refresh)
 *   Filters (date range + programme/branch/batch multi-select + academic year)
 *   Row 1 — 5 KPI cards
 *   Row 2 — 2 charts (daily collection line, due-vs-collected bar)
 *   Row 3 — 3 sections (top-10 defaulters, payment-mode pie, due-by-programme table)
 *
 * Charts are implemented as pure SVG (no new npm deps).
 * React Query keys: ['fee-dashboard', filters] + ['fee-defaulters'].
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCcw,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Percent,
  Users,
  Layers,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Filter,
  ShieldAlert,
} from 'lucide-react';

import {
  getDashboard,
  getDefaulters,
  type DashboardFilters,
  type DashboardV1,
  type DefaulterListItem,
  type PaymentModeKey,
} from '../../services/fee-analytics';
import {
  listProgrammes,
  listBranches,
  listBatches,
  listAcademicYears,
} from '../../services/academics';
import { useAuthStore } from '../../stores/authStore';
import Badge from '../../components/ui/Badge';

// ── Styles ────────────────────────────────────────────────────────────

const inp =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none';
const lbl = 'block text-xs font-medium text-gray-600 mb-1';

// ── Helpers ───────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function firstOfLastMonth(): string {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  return toIsoDate(d);
}

function formatInr(value: number | undefined | null): string {
  const v = value ?? 0;
  return `\u20B9${v.toLocaleString('en-IN')}`;
}

function formatPercent(value: number | undefined | null): string {
  const v = value ?? 0;
  return `${v.toFixed(2)}%`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

// Stage badge variant mapping.
function stageVariant(stage: string): string {
  switch (stage) {
    case 'stage_1':
      return 'warning';
    case 'stage_2':
      return 'orange';
    case 'stage_3':
      return 'danger';
    case 'stage_4':
      return 'danger';
    case 'welfare_referred':
      return 'purple';
    default:
      return 'default';
  }
}

function stageLabel(stage: string): string {
  switch (stage) {
    case 'stage_1':
      return 'Stage 1';
    case 'stage_2':
      return 'Stage 2';
    case 'stage_3':
      return 'Stage 3';
    case 'stage_4':
      return 'Stage 4';
    case 'welfare_referred':
      return 'Welfare';
    default:
      return stage;
  }
}

// ── Chart components (pure SVG, no deps) ──────────────────────────────

interface LineChartProps {
  data: Array<{ bucket: string; amount: number }>;
}

function DailyCollectionLineChart({ data }: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No collection activity in the selected range
      </div>
    );
  }

  const width = 640;
  const height = 200;
  const padLeft = 48;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 28;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxAmount = Math.max(1, ...data.map((d) => d.amount));
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padLeft + i * stepX;
    const y = padTop + chartH - (d.amount / maxAmount) * chartH;
    return { x, y, d };
  });

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');

  // Area under curve.
  const areaPath =
    `M${points[0]!.x},${padTop + chartH} ` +
    points.map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') +
    ` L${points[points.length - 1]!.x},${padTop + chartH} Z`;

  // Y-axis ticks (0, mid, max).
  const yTicks = [0, 0.5, 1].map((t) => ({
    y: padTop + chartH - t * chartH,
    value: Math.round(t * maxAmount),
  }));

  // X-axis labels — first, middle, last.
  const xLabelIndexes =
    data.length <= 3
      ? data.map((_, i) => i)
      : [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Daily collection line chart"
      className="w-full h-48"
    >
      {/* Gridlines + Y ticks */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padLeft}
            y1={t.y}
            x2={padLeft + chartW}
            y2={t.y}
            stroke="#E5E7EB"
            strokeDasharray="2 2"
          />
          <text
            x={padLeft - 6}
            y={t.y + 4}
            fontSize={10}
            textAnchor="end"
            fill="#6B7280"
          >
            {t.value.toLocaleString('en-IN')}
          </text>
        </g>
      ))}

      {/* Area + line */}
      <path d={areaPath} fill="#10B98122" />
      <path d={path} fill="none" stroke="#10B981" strokeWidth={2} />

      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#10B981">
          <title>{`${p.d.bucket}: ${formatInr(p.d.amount)}`}</title>
        </circle>
      ))}

      {/* X labels */}
      {xLabelIndexes.map((i) => {
        const p = points[i];
        if (!p) return null;
        return (
          <text
            key={i}
            x={p.x}
            y={height - 8}
            fontSize={10}
            textAnchor="middle"
            fill="#6B7280"
          >
            {p.d.bucket.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

interface GroupedBarChartProps {
  data: Array<{ month: string; due: number; collected: number }>;
}

function DueVsCollectedBarChart({ data }: GroupedBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No monthly data
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const padLeft = 52;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 36;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxVal = Math.max(1, ...data.flatMap((d) => [d.due, d.collected]));
  const groupW = chartW / data.length;
  const barW = Math.max(4, (groupW - 8) / 2);

  const yTicks = [0, 0.5, 1].map((t) => ({
    y: padTop + chartH - t * chartH,
    value: Math.round(t * maxVal),
  }));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Due vs collected grouped bar chart"
      className="w-full h-56"
    >
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padLeft}
            y1={t.y}
            x2={padLeft + chartW}
            y2={t.y}
            stroke="#E5E7EB"
            strokeDasharray="2 2"
          />
          <text
            x={padLeft - 6}
            y={t.y + 4}
            fontSize={10}
            textAnchor="end"
            fill="#6B7280"
          >
            {t.value.toLocaleString('en-IN')}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const gx = padLeft + i * groupW + 4;
        const dueH = (d.due / maxVal) * chartH;
        const colH = (d.collected / maxVal) * chartH;
        return (
          <g key={d.month}>
            <rect
              x={gx}
              y={padTop + chartH - dueH}
              width={barW}
              height={dueH}
              fill="#F59E0B"
              rx={2}
            >
              <title>{`${d.month} due: ${formatInr(d.due)}`}</title>
            </rect>
            <rect
              x={gx + barW + 4}
              y={padTop + chartH - colH}
              width={barW}
              height={colH}
              fill="#10B981"
              rx={2}
            >
              <title>{`${d.month} collected: ${formatInr(d.collected)}`}</title>
            </rect>
            <text
              x={gx + barW + 2}
              y={height - 18}
              fontSize={10}
              textAnchor="middle"
              fill="#6B7280"
            >
              {d.month}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g>
        <rect x={padLeft} y={height - 10} width={10} height={8} fill="#F59E0B" rx={2} />
        <text x={padLeft + 14} y={height - 2} fontSize={10} fill="#6B7280">
          Due
        </text>
        <rect x={padLeft + 48} y={height - 10} width={10} height={8} fill="#10B981" rx={2} />
        <text x={padLeft + 62} y={height - 2} fontSize={10} fill="#6B7280">
          Collected
        </text>
      </g>
    </svg>
  );
}

interface PieChartProps {
  data: Array<{ key: PaymentModeKey; value: number }>;
}

const PIE_COLORS: Record<PaymentModeKey, string> = {
  cash: '#10B981',
  upi: '#3B82F6',
  neft: '#8B5CF6',
  cheque: '#F59E0B',
  online: '#06B6D4',
  card: '#EC4899',
  other: '#6B7280',
};

function PaymentModePie({ data }: PieChartProps) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  if (total <= 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No payments in range
      </div>
    );
  }

  const cx = 90;
  const cy = 90;
  const r = 72;

  let startAngle = -Math.PI / 2;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const frac = d.value / total;
      const endAngle = startAngle + frac * Math.PI * 2;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const large = endAngle - startAngle > Math.PI ? 1 : 0;
      const path = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
      const slice = { path, key: d.key, value: d.value, frac };
      startAngle = endAngle;
      return slice;
    });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 180 180" role="img" aria-label="Payment mode breakdown" className="w-44 h-44">
        {slices.map((s) => (
          <path key={s.key} d={s.path} fill={PIE_COLORS[s.key]} stroke="#fff" strokeWidth={1}>
            <title>{`${s.key}: ${formatInr(s.value)} (${(s.frac * 100).toFixed(1)}%)`}</title>
          </path>
        ))}
      </svg>
      <ul className="text-xs space-y-1 flex-1">
        {data
          .filter((d) => d.value > 0)
          .map((d) => (
            <li key={d.key} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: PIE_COLORS[d.key] }}
              />
              <span className="capitalize text-gray-700 flex-1">{d.key}</span>
              <span className="text-gray-500 tabular-nums">
                {((d.value / total) * 100).toFixed(1)}%
              </span>
              <span className="text-gray-900 tabular-nums font-medium">
                {formatInr(d.value)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

// ── Section wrappers ──────────────────────────────────────────────────

function SectionShell({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${className ?? ''}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-primary-600" />
        <h3 className="font-semibold text-navy text-sm">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function LoadingSkeleton({ height = 'h-32' }: { height?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${height}`} />;
}

function ErrorBanner({ onRetry, error }: { onRetry: () => void; error: unknown }) {
  const message =
    error instanceof Error ? error.message : 'Failed to load data. Try again.';
  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
      <AlertTriangle size={16} className="text-red-500 mt-0.5" />
      <div className="flex-1">
        <div className="text-red-700 font-medium">{message}</div>
        <button
          onClick={onRetry}
          className="mt-1 text-xs text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ── Filters bar ───────────────────────────────────────────────────────

interface FiltersState {
  from: string;
  to: string;
  programmeIds: string[];
  branchIds: string[];
  batchIds: string[];
  academicYearId: string;
}

interface OptionItem {
  _id: string;
  name?: string;
  code?: string;
  label?: string;
}

function optLabel(o: OptionItem): string {
  return o.name || o.label || o.code || o._id;
}

function MultiSelectChips({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: OptionItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }
  return (
    <div>
      <label className={lbl}>{label}</label>
      <select
        multiple
        value={selected}
        onChange={(e) => {
          const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
          onChange(ids);
        }}
        className={`${inp} h-20`}
        // Avoid accidental full-list keyboard-select; toggle() is the click handler.
        onClick={(e) => {
          const target = e.target as HTMLOptionElement;
          if (target.tagName === 'OPTION' && target.value) {
            e.preventDefault();
            toggle(target.value);
          }
        }}
      >
        {options.map((o) => (
          <option key={o._id} value={o._id}>
            {optLabel(o)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function FeeDashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canRead = useAuthStore((s) => s.hasPermission('finance', 'read'));

  const [filters, setFilters] = useState<FiltersState>({
    from: firstOfLastMonth(),
    to: toIsoDate(new Date()),
    programmeIds: [],
    branchIds: [],
    batchIds: [],
    academicYearId: '',
  });

  // Filter-option queries.
  const { data: programmesData } = useQuery({
    queryKey: ['programmes-all'],
    queryFn: () => listProgrammes(1, 100),
    enabled: canRead,
  });
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => listBranches(1, 100),
    enabled: canRead,
  });
  const { data: batchesData } = useQuery({
    queryKey: ['batches-all'],
    queryFn: () => listBatches(1, 100),
    enabled: canRead,
  });
  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: () => listAcademicYears(1, 100),
    enabled: canRead,
  });

  const dashboardQueryKey = useMemo(
    () => ['fee-dashboard', filters] as const,
    [filters],
  );
  const defaultersQueryKey = ['fee-defaulters', 'top10'] as const;

  const dashboardFiltersParam: DashboardFilters = useMemo(() => {
    const out: DashboardFilters = { from: filters.from, to: filters.to };
    if (filters.programmeIds.length > 0) out.programmeIds = filters.programmeIds;
    if (filters.branchIds.length > 0) out.branchIds = filters.branchIds;
    if (filters.batchIds.length > 0) out.batchIds = filters.batchIds;
    if (filters.academicYearId) out.academicYearId = filters.academicYearId;
    return out;
  }, [filters]);

  const dashboardQ = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: () => getDashboard(dashboardFiltersParam),
    enabled: canRead,
    staleTime: 2 * 60 * 1000,
  });

  const defaultersQ = useQuery({
    queryKey: defaultersQueryKey,
    queryFn: () => getDefaulters({ limit: 10, sort: 'overdueAmount' }),
    enabled: canRead,
    staleTime: 2 * 60 * 1000,
  });

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ['fee-dashboard'] });
    qc.invalidateQueries({ queryKey: ['fee-defaulters'] });
  }

  if (!canRead) {
    return (
      <div className="max-w-lg mx-auto mt-12 bg-white border border-red-200 rounded-xl p-6 text-center">
        <ShieldAlert size={36} className="text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-navy">No access</h3>
        <p className="text-sm text-gray-500 mt-2">
          You don't have permission to view the fee-collection dashboard.
        </p>
        <Link
          to="/finance"
          className="inline-block mt-4 text-sm text-primary-600 hover:text-primary-700 underline"
        >
          Back to Finance
        </Link>
      </div>
    );
  }

  const dashboard: DashboardV1 | undefined = dashboardQ.data;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Fee Collection Dashboard</h2>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-primary-700"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-primary-600" />
          <span className="text-sm font-semibold text-navy">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className={lbl}>From</label>
            <input
              type="date"
              value={filters.from}
              max={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>To</label>
            <input
              type="date"
              value={filters.to}
              min={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className={inp}
            />
          </div>
          <MultiSelectChips
            label="Programme"
            options={(programmesData?.items as OptionItem[]) || []}
            selected={filters.programmeIds}
            onChange={(ids) => setFilters((f) => ({ ...f, programmeIds: ids }))}
          />
          <MultiSelectChips
            label="Branch"
            options={(branchesData?.items as OptionItem[]) || []}
            selected={filters.branchIds}
            onChange={(ids) => setFilters((f) => ({ ...f, branchIds: ids }))}
          />
          <MultiSelectChips
            label="Batch"
            options={(batchesData?.items as OptionItem[]) || []}
            selected={filters.batchIds}
            onChange={(ids) => setFilters((f) => ({ ...f, batchIds: ids }))}
          />
          <div>
            <label className={lbl}>Academic Year</label>
            <select
              value={filters.academicYearId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, academicYearId: e.target.value }))
              }
              className={inp}
            >
              <option value="">All years</option>
              {((academicYearsData?.items as OptionItem[]) || []).map((o) => (
                <option key={o._id} value={o._id}>
                  {optLabel(o)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Row 1 — KPI cards */}
      {dashboardQ.isError ? (
        <div className="mb-6">
          <ErrorBanner onRetry={() => dashboardQ.refetch()} error={dashboardQ.error} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {dashboardQ.isLoading ? (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeleton key={i} height="h-28" />
            ))}
          </>
        ) : dashboard ? (
          <>
            {/* Total Outstanding */}
            <div
              className={`rounded-xl border p-4 bg-gradient-to-br from-amber-50 to-yellow-50 ${
                dashboard.totalOutstanding > 100000
                  ? 'border-red-300'
                  : 'border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-amber-700">
                  Total Outstanding
                </span>
                <Wallet size={18} className="text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-800 mt-2">
                {formatInr(dashboard.totalOutstanding)}
              </div>
              <div className="text-xs text-amber-600 mt-1">Unpaid invoices</div>
            </div>

            {/* Collected in Range */}
            <div className="rounded-xl border border-green-200 p-4 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-green-700">
                  Collected in Range
                </span>
                <TrendingUp size={18} className="text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-800 mt-2">
                {formatInr(dashboard.collectedInRange)}
              </div>
              <div className="text-xs text-green-600 mt-1">Successful payments</div>
            </div>

            {/* Collection Rate */}
            <div className="rounded-xl border border-blue-200 p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-blue-700">
                  Collection Rate
                </span>
                <Percent size={18} className="text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-navy mt-2">
                {formatPercent(dashboard.collectionRatePercent)}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                collected / (collected + due)
              </div>
            </div>

            {/* Overdue Students */}
            <div className="rounded-xl border border-red-200 p-4 bg-gradient-to-br from-red-50 to-rose-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-red-700">
                  Overdue Students
                </span>
                <Users size={18} className="text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-800 mt-2">
                {dashboard.overdueStudentsCount}
              </div>
              <div className="text-xs text-red-600 mt-1">
                {formatInr(dashboard.overdueAmount)} overdue
              </div>
            </div>

            {/* Escalation Funnel */}
            <div className="rounded-xl border border-violet-200 p-4 bg-gradient-to-br from-violet-50 to-purple-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase text-violet-700">
                  Escalation Funnel
                </span>
                <Layers size={18} className="text-violet-600" />
              </div>
              <ul className="text-xs space-y-0.5">
                {(
                  [
                    ['stage_1', 'Stage 1'],
                    ['stage_2', 'Stage 2'],
                    ['stage_3', 'Stage 3'],
                    ['stage_4', 'Stage 4'],
                    ['welfare_referred', 'Welfare'],
                  ] as const
                ).map(([key, label]) => (
                  <li key={key} className="flex justify-between">
                    <span className="text-violet-800">{label}</span>
                    <span className="font-semibold text-violet-900 tabular-nums">
                      {dashboard.funnelByStage[key]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </div>

      {/* Row 2 — charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <SectionShell title="Daily Collection Trend" icon={LineChartIcon}>
          {dashboardQ.isLoading ? (
            <LoadingSkeleton height="h-48" />
          ) : dashboardQ.isError ? (
            <ErrorBanner onRetry={() => dashboardQ.refetch()} error={dashboardQ.error} />
          ) : dashboard && dashboard.collectionTimeSeries.length > 0 ? (
            <DailyCollectionLineChart data={dashboard.collectionTimeSeries} />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              No data in this range
            </div>
          )}
        </SectionShell>

        <SectionShell title="Due vs Collected (last 6 months)" icon={BarChart3}>
          {dashboardQ.isLoading ? (
            <LoadingSkeleton height="h-56" />
          ) : dashboardQ.isError ? (
            <ErrorBanner onRetry={() => dashboardQ.refetch()} error={dashboardQ.error} />
          ) : dashboard ? (
            <DueVsCollectedBarChart data={dashboard.dueVsCollectedByMonth} />
          ) : (
            <div className="flex items-center justify-center h-56 text-sm text-gray-400">
              No data
            </div>
          )}
        </SectionShell>
      </div>

      {/* Row 3 — defaulters + pie + by-programme */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionShell
          title="Top 10 Defaulters"
          icon={AlertTriangle}
          className="lg:col-span-1"
        >
          {defaultersQ.isLoading ? (
            <LoadingSkeleton height="h-48" />
          ) : defaultersQ.isError ? (
            <ErrorBanner onRetry={() => defaultersQ.refetch()} error={defaultersQ.error} />
          ) : defaultersQ.data && defaultersQ.data.items.length > 0 ? (
            <DefaultersTable
              items={defaultersQ.data.items}
              onRowClick={(studentId) => navigate(`/people/students/${studentId}`)}
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              No defaulters
            </div>
          )}
        </SectionShell>

        <SectionShell title="Payment Mode Breakdown" icon={PieChartIcon}>
          {dashboardQ.isLoading ? (
            <LoadingSkeleton height="h-48" />
          ) : dashboardQ.isError ? (
            <ErrorBanner onRetry={() => dashboardQ.refetch()} error={dashboardQ.error} />
          ) : dashboard ? (
            <PaymentModePie
              data={(
                [
                  'cash',
                  'upi',
                  'neft',
                  'cheque',
                  'online',
                  'card',
                  'other',
                ] as PaymentModeKey[]
              ).map((key) => ({
                key,
                value: dashboard.paymentModeBreakdown[key],
              }))}
            />
          ) : null}
        </SectionShell>

        <SectionShell title="Due by Programme" icon={Layers}>
          {dashboardQ.isLoading ? (
            <LoadingSkeleton height="h-48" />
          ) : dashboardQ.isError ? (
            <ErrorBanner onRetry={() => dashboardQ.refetch()} error={dashboardQ.error} />
          ) : dashboard && dashboard.dueByProgramme.length > 0 ? (
            <DueByProgrammeTable items={dashboard.dueByProgramme} />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              No programme data
            </div>
          )}
        </SectionShell>
      </div>
    </div>
  );
}

// ── Sub-tables ────────────────────────────────────────────────────────

function DefaultersTable({
  items,
  onRowClick,
}: {
  items: DefaulterListItem[];
  onRowClick: (studentId: string) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 uppercase tracking-wide">
            <th className="px-2 py-2 font-medium">Student</th>
            <th className="px-2 py-2 font-medium text-right">Overdue</th>
            <th className="px-2 py-2 font-medium text-right">Days</th>
            <th className="px-2 py-2 font-medium">Stage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((r) => (
            <tr
              key={r.studentId}
              onClick={() => onRowClick(r.studentId)}
              className="cursor-pointer hover:bg-gray-50"
            >
              <td className="px-2 py-2">
                <div className="font-medium text-navy">{r.name || '—'}</div>
                <div className="text-[10px] text-gray-400">
                  {r.rollNumber || '—'}
                  {r.programmeName ? ` · ${r.programmeName}` : ''}
                </div>
                {r.autoEscalationPaused ? (
                  <div className="mt-0.5">
                    <Badge variant="warning">
                      Paused until {formatDate(r.autoEscalationPaused)}
                    </Badge>
                  </div>
                ) : null}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-red-700 font-semibold">
                {formatInr(r.overdueAmount)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-gray-700">
                {r.daysOverdue}
              </td>
              <td className="px-2 py-2">
                <Badge variant={stageVariant(r.escalationStage)}>
                  {stageLabel(r.escalationStage)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DueByProgrammeTable({
  items,
}: {
  items: DashboardV1['dueByProgramme'];
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500 uppercase tracking-wide">
            <th className="px-2 py-2 font-medium">Programme</th>
            <th className="px-2 py-2 font-medium text-right">Due</th>
            <th className="px-2 py-2 font-medium text-right">Collected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((r) => (
            <tr key={r.programmeId}>
              <td className="px-2 py-2 text-navy">{r.programmeName || '—'}</td>
              <td className="px-2 py-2 text-right tabular-nums text-amber-700">
                {formatInr(r.due)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-green-700">
                {formatInr(r.collected)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

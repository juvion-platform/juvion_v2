import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, Plus, Search, Edit2, Trash2, ArrowLeft, Sparkles} from 'lucide-react';
import api from '../services/api';
import { updateAISpendLimits, type AISpendLimitsUpdateResponse } from '../services/colleges';
import { useAuthStore } from '../stores/authStore';

interface College {
  _id: string;
  name: string;
  code: string;
  address: { line1: string; line2?: string; city: string; state: string; pincode: string };
  contactEmail: string;
  contactPhone: string;
  logo?: string;
  subscription: { plan: string; status: string; expiresAt?: string };
  settings: Record<string, unknown>;
  status: string;
  createdAt: string;
  /** L7a — admin-managed AI spend limits. Optional on the wire (existing
   * colleges may not have it persisted yet; defaults are populated by
   * Mongoose at read time). */
  aiSpendLimits?: { weeklyInr: number; alertThresholdPct: number };
}

// Roles allowed to edit `aiSpendLimits` — mirrors the backend `platformUpdateGate`
// (super_admin / admin / principal). Finance officers etc. see the section but
// the inputs + save button are disabled.
const SPEND_LIMITS_EDIT_ROLES = new Set(['super_admin', 'admin', 'principal']);

// Default alert threshold when nothing has been persisted on the College
// document yet. Mirrors `DEFAULT_ALERT_THRESHOLD_PCT` in the backend
// spend-limits service.
const DEFAULT_ALERT_THRESHOLD_PCT = 80;

interface Stats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  byPlan: Record<string, number>;
}

const EMPTY_FORM = {
  name: '', code: '', contactEmail: '', contactPhone: '',
  address: { line1: '', line2: '', city: '', state: '', pincode: '' },
  subscription: { plan: 'basic' as string, status: 'active' as string },
  status: 'active',
};

// ── AI Spend Limits sub-section (L7a) ─────────────────────────────────
//
// Rendered inside the edit modal once a College has an _id (saving spend
// limits requires a known college; the section is hidden in create-mode).
// Owns its own form state and mutation so the parent's `saveMut` stays
// focused on the College profile fields.

interface SpendUsageBarProps { spent: number; limit: number; pct: number }

function SpendUsageBar({ spent, limit, pct }: SpendUsageBarProps) {
  // Tone: green < 80%, amber 80-99%, red >= 100%. When `limit === 0`
  // (bypass mode) we render a neutral "—" bar with informational copy.
  const bypass = limit === 0;
  const clamped = Math.max(0, Math.min(100, pct));
  let barColor = 'bg-emerald-500';
  if (!bypass && pct >= 100) barColor = 'bg-red-500';
  else if (!bypass && pct >= 80) barColor = 'bg-amber-500';

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-gray-700">
          {bypass ? 'No limit set' : `₹${spent.toLocaleString('en-IN')} of ₹${limit.toLocaleString('en-IN')} used`}
        </span>
        {!bypass && (
          <span className="text-gray-500">{Math.round(pct)}%</span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full ${bypass ? 'bg-gray-300' : barColor} transition-all`}
          style={{ width: `${bypass ? 0 : clamped}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-500 mt-1">
        Resets every Monday 00:00 UTC. {bypass
          ? 'Set a weekly budget to start tracking AI usage.'
          : pct >= 100
            ? 'Hard limit reached — AI calls are blocked until reset or admin override.'
            : pct >= 80
              ? 'Approaching weekly limit.'
              : 'Within budget.'}
      </p>
    </div>
  );
}

interface SpendLimitsSectionProps { college: College }

function SpendLimitsSection({ college }: SpendLimitsSectionProps) {
  const userRole = useAuthStore((s) => s.user?.role);
  const canEdit = !!userRole && SPEND_LIMITS_EDIT_ROLES.has(userRole);

  // Hydrate from the College doc (or backend defaults) on first render.
  // After save, we hydrate from the mutation response so the bar reflects
  // the freshly invalidated spend snapshot in one round-trip.
  const initialWeeklyInr = college.aiSpendLimits?.weeklyInr ?? 0;
  const initialThresholdPct =
    college.aiSpendLimits?.alertThresholdPct ?? DEFAULT_ALERT_THRESHOLD_PCT;

  const [weeklyInr, setWeeklyInr] = useState<number>(initialWeeklyInr);
  const [thresholdPct, setThresholdPct] = useState<number>(initialThresholdPct);
  const [currentSpend, setCurrentSpend] = useState<{ spent: number; limit: number; pct: number }>({
    spent: 0,
    limit: initialWeeklyInr,
    pct: 0,
  });
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const mut = useMutation<AISpendLimitsUpdateResponse, Error>({
    mutationFn: () =>
      updateAISpendLimits(college._id, {
        weeklyInr,
        alertThresholdPct: thresholdPct,
      }),
    onSuccess: (data) => {
      // Hydrate from the response so the usage bar updates immediately.
      setWeeklyInr(data.aiSpendLimits.weeklyInr);
      setThresholdPct(data.aiSpendLimits.alertThresholdPct);
      setCurrentSpend(data.currentSpend);
      setToast({ kind: 'success', message: 'AI spend limits saved.' });
      window.setTimeout(() => setToast(null), 3000);
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        err.message ||
        'Failed to save AI spend limits.';
      setToast({ kind: 'error', message: msg });
      window.setTimeout(() => setToast(null), 4000);
    },
  });

  // Disable save when nothing changed and no error is showing — avoids
  // emitting an empty audit log row (backend rejects empty bodies anyway).
  const isDirty =
    weeklyInr !== initialWeeklyInr || thresholdPct !== initialThresholdPct;

  return (
    <div className="border-t border-gray-200 pt-4 mt-2">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={16} className="text-violet-600" />
        <h3 className="text-sm font-semibold text-gray-700">AI Spend Limits</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Caps the rolling 7-day cost of AI agent calls for this college. The
        warning banner fires at the alert threshold; calls are blocked once
        the limit is reached.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Weekly budget (₹)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={weeklyInr}
            disabled={!canEdit || mut.isPending}
            onChange={(e) =>
              setWeeklyInr(Math.max(0, Number(e.target.value) || 0))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="0 = no limit"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            0 disables the gate; AI calls flow without a cost cap.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alert threshold (%)
          </label>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={thresholdPct}
            disabled={!canEdit || mut.isPending}
            onChange={(e) => {
              const n = Number(e.target.value) || 0;
              setThresholdPct(Math.max(1, Math.min(100, n)));
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none disabled:bg-gray-50 disabled:text-gray-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Default 80%. Triggers the dashboard banner and SRE log.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <SpendUsageBar
          spent={currentSpend.spent}
          limit={currentSpend.limit || weeklyInr}
          pct={currentSpend.pct}
        />
      </div>

      <div className="flex items-center justify-between mt-3">
        {toast ? (
          <span
            data-testid="spend-limits-toast"
            className={`text-xs font-semibold ${
              toast.kind === 'success' ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {toast.message}
          </span>
        ) : (
          <span className="text-xs text-gray-400">
            {canEdit
              ? isDirty
                ? 'Unsaved changes'
                : ' '
              : 'Read-only — admins / principals only.'}
          </span>
        )}
        <button
          type="button"
          onClick={() => mut.mutate()}
          disabled={!canEdit || !isDirty || mut.isPending}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mut.isPending ? 'Saving…' : 'Save AI limits'}
        </button>
      </div>
    </div>
  );
}

export default function CollegeManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<College | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: stats } = useQuery<Stats>({
    queryKey: ['colleges', 'stats'],
    queryFn: () => api.get('/colleges/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['colleges', page, search, statusFilter],
    queryFn: () => api.get('/colleges', { params: { page, limit: 20, search: search || undefined, status: statusFilter || undefined } }).then(r => r.data),
  });

  const saveMut = useMutation({
    mutationFn: (payload: any) =>
      editing
        ? api.put(`/colleges/${editing._id}`, payload)
        : api.post('/colleges', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['colleges'] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/colleges/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['colleges'] }); setDeleteId(null); },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(c: College) {
    setEditing(c);
    setForm({
      name: c.name, code: c.code, contactEmail: c.contactEmail, contactPhone: c.contactPhone,
      address: { line1: c.address.line1, line2: c.address.line2 || '', city: c.address.city, state: c.address.state, pincode: c.address.pincode },
      subscription: { plan: c.subscription.plan, status: c.subscription.status },
      status: c.status,
    });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveMut.mutate(form);
  }

  const colleges: College[] = data?.items || [];
  const totalPages = data?.pages || 1;

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, color: 'bg-blue-500' },
    { label: 'Active', value: stats?.active ?? 0, color: 'bg-emerald-500' },
    { label: 'Inactive', value: stats?.inactive ?? 0, color: 'bg-gray-400' },
    { label: 'Suspended', value: stats?.suspended ?? 0, color: 'bg-red-500' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/select-college" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-800">College Management</h1>
              <p className="text-sm text-gray-500">Manage all colleges in the system</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium"
          >
            <Plus size={16} /> Add College
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center`}>
                <Building2 size={20} className="text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or code..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">College</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">City</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Loading...</td></tr>
              ) : colleges.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No colleges found</td></tr>
              ) : colleges.map((c) => (
                <tr key={c._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500/10 to-cyan-500/10 flex items-center justify-center">
                        <Building2 size={16} className="text-teal-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.contactEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600">{c.code}</td>
                  <td className="px-4 py-3 text-gray-600">{c.address?.city}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full capitalize">{c.subscription?.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${
                      c.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      c.status === 'suspended' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors" title="Edit">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => setDeleteId(c._id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave}>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">{editing ? 'Edit College' : 'Add College'}</h2>
                <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                    <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" placeholder="e.g. JIT" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email *</label>
                    <input required type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone *</label>
                    <input required value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-gray-700 pt-2">Address</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Line 1 *</label>
                  <input required value={form.address.line1} onChange={e => setForm({ ...form, address: { ...form.address, line1: e.target.value } })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Line 2</label>
                  <input value={form.address.line2} onChange={e => setForm({ ...form, address: { ...form.address, line2: e.target.value } })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input required value={form.address.city} onChange={e => setForm({ ...form, address: { ...form.address, city: e.target.value } })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <input required value={form.address.state} onChange={e => setForm({ ...form, address: { ...form.address, state: e.target.value } })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                    <input required value={form.address.pincode} onChange={e => setForm({ ...form, address: { ...form.address, pincode: e.target.value } })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none" />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-gray-700 pt-2">Subscription</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                    <select value={form.subscription.plan} onChange={e => setForm({ ...form, subscription: { ...form.subscription, plan: e.target.value } })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none">
                      <option value="basic">Basic</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                {/* L7a — AI Spend Limits section. Only meaningful when
                    editing a saved college (we need the _id to PATCH). */}
                {editing && <SpendLimitsSection college={editing} />}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saveMut.isPending} className="px-4 py-2 text-sm text-white bg-teal-500 rounded-lg hover:bg-teal-600 disabled:opacity-50">
                  {saveMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete College?</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone. All data associated with this college will be permanently removed.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending} className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

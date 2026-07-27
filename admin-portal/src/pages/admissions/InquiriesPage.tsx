import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listInquiries, deleteInquiry, convertInquiry, rescoreInquiry } from '../../services/admissions';
import type { ScoreRationale } from '../../services/admissions';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import LeadGradeBadge from '../../components/admissions/LeadGradeBadge';
import { Plus, Trash2, Pencil, ArrowRightCircle, Eye, Phone, Mail, RefreshCw, Sparkles } from 'lucide-react';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUS_COLOR: Record<string, string> = {
  new: 'info', contacted: 'warning', follow_up: 'warning', interested: 'info',
  visit_scheduled: 'info', visited: 'info', qualified: 'success', converted: 'success', lost: 'danger',
};
const STATUSES = ['new', 'contacted', 'follow_up', 'interested', 'visit_scheduled', 'visited', 'qualified', 'converted', 'lost'] as const;

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function InquiriesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [filterStatus, setFilterStatus] = useState('');
  // 001-ai-lead-scoring Story 4 — grade filter chip + score sort.
  const [filterGrade, setFilterGrade] = useState<'' | 'hot' | 'hot_warm'>('');
  const [sortMode, setSortMode] = useState<'newest' | 'score'>('newest');
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [convertForm, setConvertForm] = useState({ programmeApplied: '', branchPreference1: '', quota: 'management', category: '' });
  const [rescoreFlash, setRescoreFlash] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inquiries', page, filterStatus, filterGrade, sortMode, limit, search],
    queryFn: () => listInquiries(page, limit, {
      status: filterStatus || undefined,
      grade: filterGrade || undefined,
      sort: sortMode,
    }, search),
  });

  const deleteMut = useMutation({ mutationFn: deleteInquiry, onSuccess: () => { qc.invalidateQueries({ queryKey: ['inquiries'] }); qc.invalidateQueries({ queryKey: ['admissions-stats'] }); } });
  const convertMut = useMutation({
    mutationFn: ({ id, data }: any) => convertInquiry(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inquiries'] });
      qc.invalidateQueries({ queryKey: ['applicants'] });
      qc.invalidateQueries({ queryKey: ['admissions-stats'] });
      setConvertModalOpen(false);
    },
  });

  const rescoreMut = useMutation({
    mutationFn: (id: string) => rescoreInquiry(id),
    onSuccess: (resp) => {
      setRescoreFlash(resp.status === 'already_scored'
        ? 'Already scored within the last minute — try again shortly.'
        : 'Scoring job enqueued. The new score appears within a few seconds.');
      // Invalidate so the badge refreshes once the worker has written.
      qc.invalidateQueries({ queryKey: ['inquiries'] });
      // Refetch the open detail shortly so the user sees the updated rationale.
      setTimeout(() => qc.invalidateQueries({ queryKey: ['inquiries'] }), 4_000);
      setTimeout(() => setRescoreFlash(null), 5_000);
    },
    onError: (err: any) => {
      setRescoreFlash(`Rescore failed: ${err?.response?.data?.error || err?.message || 'unknown error'}`);
      setTimeout(() => setRescoreFlash(null), 5_000);
    },
  });

  function openDetail(row: any) { setSelected(row); setDetailModalOpen(true); }
  function openConvert(row: any) {
    setSelected(row);
    setConvertForm({ programmeApplied: row.programmeInterest || '', branchPreference1: row.branchInterest || '', quota: 'management', category: '' });
    setConvertModalOpen(true);
  }

  function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...convertForm };
    Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
    convertMut.mutate({ id: selected._id, data: payload });
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => (
      <button onClick={(e) => { e.stopPropagation(); openDetail(r); }} className="text-left hover:text-primary-600 font-medium">
        {r.name}
      </button>
    )},
    { key: 'phone', label: 'Phone', render: (r: any) => <span className="flex items-center gap-1"><Phone size={12} className="text-green-500" />{r.phone}</span> },
    { key: 'leadScore', label: 'Score', render: (r: any) => <LeadGradeBadge grade={r.leadGrade} score={r.leadScore} /> },
    { key: 'source', label: 'Source', render: (r: any) => <span className="capitalize text-xs bg-gray-100 px-2 py-0.5 rounded">{r.source?.replace(/_/g, ' ')}</span> },
    { key: 'programmeInterest', label: 'Programme', render: (r: any) => r.programmeInterest || '—' },
    { key: 'interStream', label: 'Stream', render: (r: any) => r.interStream || '—' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status?.replace(/_/g, ' ')}</Badge> },
    { key: 'date', label: 'Date', render: (r: any) => new Date(r.date || r.createdAt).toLocaleDateString() },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openDetail(r); }} className="p-1 rounded hover:bg-blue-50" title="View"><Eye size={15} className="text-blue-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); navigate(`/admissions/inquiries/${r._id}/edit`); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        {r.status !== 'converted' && r.status !== 'lost' && (
          <button onClick={(e) => { e.stopPropagation(); openConvert(r); }} className="p-1 rounded hover:bg-green-50" title="Convert to Applicant"><ArrowRightCircle size={15} className="text-green-500" /></button>
        )}
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this inquiry?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Inquiries</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search inquiries…" className="w-56" />
        <div className="flex gap-3 items-center">
          {/* 001-ai-lead-scoring Story 4 — grade filter chips */}
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs">
            <button
              className={`px-3 py-1.5 ${filterGrade === '' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => { setFilterGrade(''); setPage(1); }}
            >All</button>
            <button
              className={`px-3 py-1.5 border-l border-gray-300 ${filterGrade === 'hot_warm' ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => { setFilterGrade('hot_warm'); setPage(1); }}
              title="Show only hot + warm leads"
            >Hot + Warm</button>
            <button
              className={`px-3 py-1.5 border-l border-gray-300 ${filterGrade === 'hot' ? 'bg-red-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => { setFilterGrade('hot'); setPage(1); }}
              title="Show only hot leads"
            >Hot only</button>
          </div>
          </div>
          <select
            value={sortMode}
            onChange={e => { setSortMode(e.target.value as 'newest' | 'score'); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm"
            title="Sort order"
          >
            <option value="newest">Newest first</option>
            <option value="score">Highest score first</option>
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={() => navigate('/admissions/inquiries/new')} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> New Inquiry
          </button>
        </div>
      </div>

      {rescoreFlash && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm border border-blue-200">
          {rescoreFlash}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={(r: any) => openDetail(r)}
        emptyMessage={search ? `No inquiries match “${search}”.` : 'No inquiries yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      {/* ── Detail View Modal ──────────────────────────── */}
      <Modal open={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Inquiry Details">
        {selected && (
          <div className="space-y-4">
            {/* Status + score badge */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_COLOR[selected.status]}>{selected.status?.replace(/_/g, ' ')}</Badge>
                <LeadGradeBadge grade={selected.leadGrade} score={selected.leadScore} />
              </div>
              <button
                onClick={() => rescoreMut.mutate(selected._id)}
                disabled={rescoreMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-primary-300 text-primary-700 hover:bg-primary-50 disabled:opacity-50"
                title="Re-run AI scoring for this lead"
              >
                <RefreshCw size={12} className={rescoreMut.isPending ? 'animate-spin' : ''} />
                {rescoreMut.isPending ? 'Scoring…' : 'Recompute score'}
              </button>
            </div>

            {/* 001-ai-lead-scoring §Story 4 — rationale card */}
            {selected.scoreRationale && (
              <RationaleCard rationale={selected.scoreRationale as ScoreRationale} />
            )}

            {/* Personal */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-500 mb-2">Personal Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Name:</span> <strong>{selected.name}</strong></div>
                {selected.fatherName && <div><span className="text-gray-500">Father:</span> {selected.fatherName}</div>}
                <div className="flex items-center gap-1"><Phone size={12} className="text-green-500" />{selected.phone}</div>
                {selected.email && <div className="flex items-center gap-1"><Mail size={12} className="text-blue-500" />{selected.email}</div>}
                {selected.gender && <div><span className="text-gray-500">Gender:</span> <span className="capitalize">{selected.gender}</span></div>}
                {selected.dateOfBirth && <div><span className="text-gray-500">DOB:</span> {new Date(selected.dateOfBirth).toLocaleDateString()}</div>}
              </div>
            </div>

            {/* Address */}
            {(selected.city || selected.district || selected.state) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-500 mb-2">Address</h4>
                <p className="text-sm">{[selected.city, selected.district, selected.state, selected.pincode].filter(Boolean).join(', ')}</p>
              </div>
            )}

            {/* Academic */}
            {(selected.tenthPercentage || selected.interPercentage || selected.interStream) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-500 mb-2">Academic Background</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selected.tenthPercentage && <div><span className="text-gray-500">10th:</span> {selected.tenthPercentage}%</div>}
                  {selected.interPercentage && <div><span className="text-gray-500">Inter:</span> {selected.interPercentage}%</div>}
                  {selected.interStream && <div><span className="text-gray-500">Stream:</span> {selected.interStream}</div>}
                  {selected.previousCollege && <div><span className="text-gray-500">College:</span> {selected.previousCollege}</div>}
                </div>
              </div>
            )}

            {/* Interest & Tracking */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-500 mb-2">Interest & Tracking</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Source:</span> <span className="capitalize">{selected.source?.replace(/_/g, ' ')}</span></div>
                {selected.programmeInterest && <div><span className="text-gray-500">Programme:</span> {selected.programmeInterest}</div>}
                {selected.branchInterest && <div><span className="text-gray-500">Branch:</span> {selected.branchInterest}</div>}
                {selected.followUpDate && <div><span className="text-gray-500">Follow-up:</span> {new Date(selected.followUpDate).toLocaleDateString()}</div>}
                {selected.assignedTo && <div><span className="text-gray-500">Assigned:</span> {selected.assignedTo}</div>}
              </div>
              {selected.notes && <p className="text-sm mt-2 text-gray-600 border-t pt-2">{selected.notes}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t">
              <button onClick={() => { setDetailModalOpen(false); navigate(`/admissions/inquiries/${selected._id}/edit`); }} className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
                <Pencil size={14} className="text-amber-500" /> Edit
              </button>
              {selected.status !== 'converted' && selected.status !== 'lost' && (
                <button onClick={() => { setDetailModalOpen(false); openConvert(selected); }} className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                  <ArrowRightCircle size={14} className="text-white" /> Convert to Applicant
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Convert to Applicant Modal ─────────────────── */}
      <Modal open={convertModalOpen} onClose={() => setConvertModalOpen(false)} title="Convert to Applicant">
        {selected && (
          <form onSubmit={handleConvert} className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
              Converting <strong>{selected.name}</strong> ({selected.phone}) to an applicant. Personal and academic details will be carried forward automatically.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Programme</label>
                <input value={convertForm.programmeApplied} onChange={e => setConvertForm(f => ({ ...f, programmeApplied: e.target.value }))} className={inp} placeholder="e.g. B.Tech" />
              </div>
              <div>
                <label className={lbl}>Branch Preference</label>
                <input value={convertForm.branchPreference1} onChange={e => setConvertForm(f => ({ ...f, branchPreference1: e.target.value }))} className={inp} placeholder="e.g. CSE" />
              </div>
              <div>
                <label className={lbl}>Quota *</label>
                <select required value={convertForm.quota} onChange={e => setConvertForm(f => ({ ...f, quota: e.target.value }))} className={inp}>
                  <option value="convener">Convener</option>
                  <option value="management">Management</option>
                  <option value="nri">NRI</option>
                  <option value="spot">Spot</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Category</label>
                <select value={convertForm.category} onChange={e => setConvertForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={() => setConvertModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={convertMut.isPending} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                {convertMut.isPending ? 'Converting...' : 'Convert to Applicant'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// 001-ai-lead-scoring §Story 4 — factor breakdown card.
function RationaleCard({ rationale }: { rationale: ScoreRationale }) {
  const topFactors = [...rationale.factors]
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 5);
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
          <Sparkles size={14} className="text-indigo-500" /> Score rationale
        </h4>
        <span className="text-xs text-indigo-700/70">{rationale.modelVersion}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="bg-white rounded p-2 border border-indigo-100">
          <div className="text-gray-500">Rule</div>
          <div className="text-lg font-bold text-gray-800">{rationale.ruleScore}</div>
        </div>
        <div className="bg-white rounded p-2 border border-indigo-100">
          <div className="text-gray-500">LLM</div>
          <div className="text-lg font-bold text-gray-800">{rationale.llmScore ?? '—'}</div>
          {rationale.llmSkipped && <div className="text-[10px] text-amber-600 mt-0.5">skipped (cap)</div>}
          {rationale.llmFallback && <div className="text-[10px] text-amber-600 mt-0.5">fallback</div>}
        </div>
        <div className="bg-white rounded p-2 border border-indigo-300">
          <div className="text-gray-500">Blended</div>
          <div className="text-lg font-bold text-indigo-700">{rationale.blendedScore}</div>
        </div>
      </div>
      <ul className="space-y-1.5">
        {topFactors.map((f, i) => (
          <li key={i} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${f.source === 'llm' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                {f.source}
              </span>
              <span className="text-gray-800">{f.label}</span>
            </span>
            <span className={`font-bold tabular-nums ${f.weight < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {f.weight >= 0 ? `+${f.weight}` : f.weight}
            </span>
          </li>
        ))}
      </ul>
      {rationale.llmCostInr != null && (
        <div className="mt-3 pt-2 border-t border-indigo-100 text-[11px] text-gray-500">
          LLM cost: ₹{rationale.llmCostInr.toFixed(2)} · computed {new Date(rationale.computedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

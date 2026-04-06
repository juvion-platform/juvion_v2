import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listComplianceCriteria, createComplianceCriteria, updateComplianceCriteria, deleteComplianceCriteria } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const STATUSES = ['not_started', 'in_progress', 'submitted', 'reviewed'] as const;
const STATUS_COLOR: Record<string, string> = { not_started: 'default', in_progress: 'warning', submitted: 'info', reviewed: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function ComplianceCriteriaPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    accreditationCycleId: '', criterionNumber: '', title: '',
    maxScore: 0, selfScore: '', peerScore: '', status: 'not_started' as string,
  });

  const { data, isLoading } = useQuery({ queryKey: ['compliance-criteria', page], queryFn: () => listComplianceCriteria(page, 20) });

  const createMut = useMutation({ mutationFn: createComplianceCriteria, onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-criteria'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateComplianceCriteria(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-criteria'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteComplianceCriteria, onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-criteria'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ accreditationCycleId: '', criterionNumber: '', title: '', maxScore: 0, selfScore: '', peerScore: '', status: 'not_started' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      accreditationCycleId: row.accreditationCycleId?._id || row.accreditationCycleId || '',
      criterionNumber: row.criterionNumber || '',
      title: row.title || '',
      maxScore: row.maxScore || 0,
      selfScore: row.selfScore?.toString() || '',
      peerScore: row.peerScore?.toString() || '',
      status: row.status || 'not_started',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, maxScore: Number(form.maxScore) };
    if (form.selfScore) payload.selfScore = Number(form.selfScore); else delete payload.selfScore;
    if (form.peerScore) payload.peerScore = Number(form.peerScore); else delete payload.peerScore;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'criterionNumber', label: 'Criterion #', render: (r: any) => <span className="font-semibold text-navy">{r.criterionNumber}</span> },
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium">{r.title}</span> },
    { key: 'maxScore', label: 'Max Score', render: (r: any) => r.maxScore },
    { key: 'selfScore', label: 'Self Score', render: (r: any) => r.selfScore ?? '\u2014' },
    { key: 'peerScore', label: 'Peer Score', render: (r: any) => r.peerScore ?? '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this criterion?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Compliance Criteria</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Criterion
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Criterion' : 'New Criterion'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Accreditation Cycle ID *</label>
              <input required value={form.accreditationCycleId} onChange={e => setForm(f => ({ ...f, accreditationCycleId: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Criterion Number *</label>
              <input required value={form.criterionNumber} onChange={e => setForm(f => ({ ...f, criterionNumber: e.target.value }))} className={inp} placeholder="e.g. 1.1.1" />
            </div>
            <div className="col-span-2"><label className={lbl}>Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Max Score *</label>
              <input required type="number" min={0} value={form.maxScore} onChange={e => setForm(f => ({ ...f, maxScore: Number(e.target.value) }))} className={inp} />
            </div>
            <div><label className={lbl}>Self Score</label>
              <input type="number" min={0} value={form.selfScore} onChange={e => setForm(f => ({ ...f, selfScore: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Peer Score</label>
              <input type="number" min={0} value={form.peerScore} onChange={e => setForm(f => ({ ...f, peerScore: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listScholarships, createScholarship, updateScholarship, deleteScholarship } from '../../services/finance';
import { listAcademicYears } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const PROVIDERS = ['government', 'institutional', 'private', 'corporate'] as const;
const TYPES = ['merit', 'need_based', 'sports', 'sc_st', 'bc', 'minority', 'ebc'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ScholarshipsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', provider: 'government', type: 'merit', amount: '', criteria: '', academicYearId: '', maxRecipients: '', isActive: true });

  const { data, isLoading } = useQuery({ queryKey: ['scholarships', page], queryFn: () => listScholarships(page, 20) });
  const { data: academicYears } = useQuery({ queryKey: ['academic-years-all'], queryFn: () => listAcademicYears(1, 100) });

  const createMut = useMutation({ mutationFn: createScholarship, onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarships'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateScholarship(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarships'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteScholarship, onSuccess: () => { qc.invalidateQueries({ queryKey: ['scholarships'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ name: '', provider: 'government', type: 'merit', amount: '', criteria: '', academicYearId: '', maxRecipients: '', isActive: true });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      name: row.name || '',
      provider: row.provider || 'government',
      type: row.type || 'merit',
      amount: String(row.amount || ''),
      criteria: row.criteria || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      maxRecipients: row.maxRecipients != null ? String(row.maxRecipients) : '',
      isActive: row.isActive ?? true,
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, amount: Number(form.amount) };
    if (form.maxRecipients) payload.maxRecipients = Number(form.maxRecipients);
    else delete payload.maxRecipients;
    if (!payload.criteria) delete payload.criteria;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'provider', label: 'Provider', render: (r: any) => <Badge variant="info">{r.provider}</Badge> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="default">{r.type}</Badge> },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => r.academicYearId?.name || '—' },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount).toLocaleString()}` },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this scholarship?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Scholarships</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Scholarship
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Scholarship' : 'New Scholarship'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Provider *</label>
              <select required value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} className={inp}>
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Amount *</label><input required type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Criteria</label><input value={form.criteria} onChange={e => setForm(f => ({ ...f, criteria: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Academic Year * <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                <option value="">Select academic year</option>
                {(academicYears?.items || []).map((ay: any) => <option key={ay._id} value={ay._id}>{ay.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Max Recipients</label><input type="number" min={0} value={form.maxRecipients} onChange={e => setForm(f => ({ ...f, maxRecipients: e.target.value }))} className={inp} /></div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="schIsActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <label htmlFor="schIsActive" className="text-sm text-gray-700">Active</label>
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

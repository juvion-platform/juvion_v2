import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPolicies, createPolicy, updatePolicy, deletePolicy } from '../../services/governance';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const CATEGORIES = ['academic', 'hr', 'finance', 'student', 'hostel', 'it', 'safety', 'other'] as const;
const STATUSES = ['draft', 'approved', 'active', 'retired'] as const;
const STATUS_COLOR: Record<string, string> = { draft: 'default', approved: 'info', active: 'success', retired: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function PoliciesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', category: 'academic', description: '', documentUrl: '', version: '1', effectiveDate: '', approvedBy: '', status: 'draft' });

  const { data, isLoading } = useQuery({ queryKey: ['gov-policies', page], queryFn: () => listPolicies(page, 20) });
  const { data: persons } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const createMut = useMutation({ mutationFn: createPolicy, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-policies'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePolicy(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-policies'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePolicy, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-policies'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ title: '', category: 'academic', description: '', documentUrl: '', version: '1', effectiveDate: '', approvedBy: '', status: 'draft' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      title: row.title || '',
      category: row.category || 'academic',
      description: row.description || '',
      documentUrl: row.documentUrl || '',
      version: row.version != null ? String(row.version) : '1',
      effectiveDate: row.effectiveDate ? row.effectiveDate.slice(0, 10) : '',
      approvedBy: row.approvedBy?._id || row.approvedBy || '',
      status: row.status || 'draft',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.version) payload.version = Number(form.version);
    else delete payload.version;
    if (!payload.description) delete payload.description;
    if (!payload.documentUrl) delete payload.documentUrl;
    if (!payload.approvedBy) delete payload.approvedBy;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'category', label: 'Category', render: (r: any) => <Badge variant="info">{r.category}</Badge> },
    { key: 'version', label: 'Ver', render: (r: any) => `v${r.version || 1}` },
    { key: 'effectiveDate', label: 'Effective', render: (r: any) => fmtDate(r.effectiveDate) },
    { key: 'approvedBy', label: 'Approved By', render: (r: any) => r.approvedBy?.name || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={(STATUS_COLOR[r.status] || 'default') as any}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this policy?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Policies</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Policy
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Policy' : 'New Policy'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Category *</label>
              <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={2} /></div>
            <div><label className={lbl}>Document URL</label><input value={form.documentUrl} onChange={e => setForm(f => ({ ...f, documentUrl: e.target.value }))} className={inp} placeholder="https://..." /></div>
            <div><label className={lbl}>Version</label><input type="number" min={1} value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Effective Date *</label><input required type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} className={inp} /></div>
            <div>
              <label className={lbl}>Approved By <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select value={form.approvedBy} onChange={e => setForm(f => ({ ...f, approvedBy: e.target.value }))} className={inp}>
                <option value="">Select person</option>
                {(persons?.items || []).map((p: any) => (
                  <option key={p._id} value={p._id}>{p.name || p._id}</option>
                ))}
              </select>
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

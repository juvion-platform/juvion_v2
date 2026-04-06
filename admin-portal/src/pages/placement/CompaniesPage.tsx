import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCompanies, createCompany, updateCompany, deleteCompany } from '../../services/placement';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const TIERS = ['dream', 'super_dream', 'regular', 'mass'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function CompaniesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', industry: '', website: '', contactPerson: '', contactEmail: '', contactPhone: '', tier: 'regular', isActive: true });

  const { data, isLoading } = useQuery({ queryKey: ['companies', page], queryFn: () => listCompanies(page, 20) });

  const createMut = useMutation({ mutationFn: createCompany, onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCompany(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteCompany, onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ name: '', industry: '', website: '', contactPerson: '', contactEmail: '', contactPhone: '', tier: 'regular', isActive: true });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      name: row.name || '', industry: row.industry || '', website: row.website || '',
      contactPerson: row.contactPerson || '', contactEmail: row.contactEmail || '',
      contactPhone: row.contactPhone || '', tier: row.tier || 'regular', isActive: row.isActive ?? true,
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.website) delete payload.website;
    if (!payload.contactPhone) delete payload.contactPhone;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const tierVariant: Record<string, string> = { dream: 'success', super_dream: 'info', regular: 'default', mass: 'warning' };

  const columns = [
    { key: 'name', label: 'Company', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'industry', label: 'Industry' },
    { key: 'tier', label: 'Tier', render: (r: any) => <Badge variant={tierVariant[r.tier] || 'default'}>{r.tier}</Badge> },
    { key: 'contactPerson', label: 'Contact Person' },
    { key: 'contactEmail', label: 'Email' },
    { key: 'isActive', label: 'Status', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this company?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Companies</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Company</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Company' : 'New Company'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Industry *</label><input required value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Website</label><input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Contact Person *</label><input required value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Contact Email *</label><input required type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Contact Phone</label><input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Tier</label>
              <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))} className={inp}>
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="compIsActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <label htmlFor="compIsActive" className="text-sm text-gray-700">Active</label>
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

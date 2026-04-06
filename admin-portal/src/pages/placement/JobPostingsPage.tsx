import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listJobPostings, createJobPosting, updateJobPosting, deleteJobPosting, listPlacementSeasons, listCompanies } from '../../services/placement';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['draft', 'open', 'closed', 'filled'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function JobPostingsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ placementSeasonId: '', companyId: '', role: '', description: '', packageLpa: '', registrationDeadline: '', maxPositions: '', status: 'draft' });

  const { data, isLoading } = useQuery({ queryKey: ['job-postings', page], queryFn: () => listJobPostings(page, 20) });
  const { data: seasons } = useQuery({ queryKey: ['placement-seasons-all'], queryFn: () => listPlacementSeasons(1, 100) });
  const { data: companies } = useQuery({ queryKey: ['companies-all'], queryFn: () => listCompanies(1, 200) });

  const createMut = useMutation({ mutationFn: createJobPosting, onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-postings'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateJobPosting(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-postings'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteJobPosting, onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-postings'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ placementSeasonId: '', companyId: '', role: '', description: '', packageLpa: '', registrationDeadline: '', maxPositions: '', status: 'draft' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      placementSeasonId: row.placementSeasonId?._id || row.placementSeasonId || '',
      companyId: row.companyId?._id || row.companyId || '',
      role: row.role || '', description: row.description || '',
      packageLpa: String(row.packageLpa || ''),
      registrationDeadline: row.registrationDeadline ? row.registrationDeadline.slice(0, 10) : '',
      maxPositions: row.maxPositions != null ? String(row.maxPositions) : '',
      status: row.status || 'draft',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, packageLpa: Number(form.packageLpa) };
    if (form.maxPositions) payload.maxPositions = Number(form.maxPositions);
    else delete payload.maxPositions;
    if (!payload.description) delete payload.description;
    if (!payload.registrationDeadline) delete payload.registrationDeadline;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const statusVariant: Record<string, string> = { draft: 'default', open: 'success', closed: 'warning', filled: 'info' };

  const columns = [
    { key: 'role', label: 'Role', render: (r: any) => <span className="font-medium text-navy">{r.role}</span> },
    { key: 'companyId', label: 'Company', render: (r: any) => r.companyId?.name || '--' },
    { key: 'placementSeasonId', label: 'Season', render: (r: any) => r.placementSeasonId?.name || '--' },
    { key: 'packageLpa', label: 'Package (LPA)', render: (r: any) => `${r.packageLpa} LPA` },
    { key: 'maxPositions', label: 'Positions', render: (r: any) => r.maxPositions || '--' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this job posting?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Job Postings</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Job Posting</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Job Posting' : 'New Job Posting'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Season * <Link to="/placement/seasons" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.placementSeasonId} onChange={e => setForm(f => ({ ...f, placementSeasonId: e.target.value }))} className={inp}>
                <option value="">Select season</option>
                {(seasons?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Company * <Link to="/placement/companies" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} className={inp}>
                <option value="">Select company</option>
                {(companies?.items || []).map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Role *</label><input required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Package (LPA) *</label><input required type="number" step="0.01" min={0} value={form.packageLpa} onChange={e => setForm(f => ({ ...f, packageLpa: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Max Positions</label><input type="number" min={1} value={form.maxPositions} onChange={e => setForm(f => ({ ...f, maxPositions: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Registration Deadline</label><input type="date" value={form.registrationDeadline} onChange={e => setForm(f => ({ ...f, registrationDeadline: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={3} /></div>
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

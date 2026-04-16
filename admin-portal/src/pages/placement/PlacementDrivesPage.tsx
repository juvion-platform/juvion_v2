import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPlacementDrives, createPlacementDrive, updatePlacementDrive, deletePlacementDrive, listPlacementSeasons, listCompanies, listJobPostings } from '../../services/placement';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const TYPES = ['on_campus', 'virtual', 'pool', 'off_campus'] as const;
const STATUSES = ['scheduled', 'jd_published', 'applications_open', 'applications_closed', 'shortlist_released', 'interviews_in_progress', 'offers_released', 'closed', 'cancelled'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function PlacementDrivesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ placementSeasonId: '', companyId: '', jobPostingId: '', type: 'on_campus', status: 'scheduled', driveDate: '', venue: '', virtualLink: '', applicationWindowOpen: '', applicationWindowClose: '' });

  const { data, isLoading } = useQuery({ queryKey: ['placement-drives', page], queryFn: () => listPlacementDrives(page, 20) });
  const { data: seasons } = useQuery({ queryKey: ['placement-seasons-all'], queryFn: () => listPlacementSeasons(1, 100) });
  const { data: companies } = useQuery({ queryKey: ['companies-all'], queryFn: () => listCompanies(1, 200) });
  const { data: jobPostings } = useQuery({ queryKey: ['job-postings-all'], queryFn: () => listJobPostings(1, 200) });

  const createMut = useMutation({ mutationFn: createPlacementDrive, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-drives'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePlacementDrive(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-drives'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePlacementDrive, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-drives'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ placementSeasonId: '', companyId: '', jobPostingId: '', type: 'on_campus', status: 'scheduled', driveDate: '', venue: '', virtualLink: '', applicationWindowOpen: '', applicationWindowClose: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      placementSeasonId: row.placementSeasonId?._id || row.placementSeasonId || '',
      companyId: row.companyId?._id || row.companyId || '',
      jobPostingId: row.jobPostingId?._id || row.jobPostingId || '',
      type: row.type || 'on_campus',
      status: row.status || 'scheduled',
      driveDate: row.driveDate ? row.driveDate.slice(0, 10) : '',
      venue: row.venue || '',
      virtualLink: row.virtualLink || '',
      applicationWindowOpen: row.applicationWindow?.openDate ? row.applicationWindow.openDate.slice(0, 10) : '',
      applicationWindowClose: row.applicationWindow?.closeDate ? row.applicationWindow.closeDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      placementSeasonId: form.placementSeasonId,
      companyId: form.companyId,
      jobPostingId: form.jobPostingId,
      type: form.type,
      status: form.status,
      applicationWindow: {
        openDate: form.applicationWindowOpen || undefined,
        closeDate: form.applicationWindowClose || undefined,
      },
    };
    if (form.driveDate) payload.driveDate = form.driveDate;
    if (form.venue) payload.venue = form.venue;
    if (form.virtualLink) payload.virtualLink = form.virtualLink;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const statusVariant: Record<string, string> = { scheduled: 'default', jd_published: 'info', applications_open: 'success', applications_closed: 'warning', shortlist_released: 'info', interviews_in_progress: 'warning', offers_released: 'success', closed: 'default', cancelled: 'danger' };

  const columns = [
    { key: 'companyId', label: 'Company', render: (r: any) => <span className="font-medium text-navy">{r.companyId?.name || '--'}</span> },
    { key: 'jobPostingId', label: 'Job Posting', render: (r: any) => r.jobPostingId?.role || '--' },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type?.replace(/_/g, ' ')}</Badge> },
    { key: 'driveDate', label: 'Drive Date', render: (r: any) => r.driveDate ? new Date(r.driveDate).toLocaleDateString() : '--' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status?.replace(/_/g, ' ')}</Badge> },
    { key: 'applicationCount', label: 'Applications', render: (r: any) => r.applicationCount || 0 },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this placement drive?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Placement Drives</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Drive</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Placement Drive' : 'New Placement Drive'}>
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
            <div><label className={lbl}>Job Posting * <Link to="/placement/job-postings" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.jobPostingId} onChange={e => setForm(f => ({ ...f, jobPostingId: e.target.value }))} className={inp}>
                <option value="">Select job posting</option>
                {(jobPostings?.items || []).map((j: any) => <option key={j._id} value={j._id}>{j.role} - {j.companyId?.name || ''}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Drive Date</label><input type="date" value={form.driveDate} onChange={e => setForm(f => ({ ...f, driveDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Venue</label><input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Virtual Link</label><input value={form.virtualLink} onChange={e => setForm(f => ({ ...f, virtualLink: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Application Window Open</label><input type="date" value={form.applicationWindowOpen} onChange={e => setForm(f => ({ ...f, applicationWindowOpen: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Application Window Close</label><input type="date" value={form.applicationWindowClose} onChange={e => setForm(f => ({ ...f, applicationWindowClose: e.target.value }))} className={inp} /></div>
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

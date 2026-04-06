import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPlacementRegistrations, createPlacementRegistration, updatePlacementRegistration, deletePlacementRegistration, listJobPostings } from '../../services/placement';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['registered', 'shortlisted', 'placed', 'not_placed'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function PlacementRegistrationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ jobPostingId: '', studentId: '', resumeUrl: '', status: 'registered' });

  const { data, isLoading } = useQuery({ queryKey: ['placement-registrations', page], queryFn: () => listPlacementRegistrations(page, 20) });
  const { data: jobPostings } = useQuery({ queryKey: ['job-postings-all'], queryFn: () => listJobPostings(1, 200) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const createMut = useMutation({ mutationFn: createPlacementRegistration, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-registrations'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePlacementRegistration(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-registrations'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePlacementRegistration, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-registrations'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ jobPostingId: '', studentId: '', resumeUrl: '', status: 'registered' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      jobPostingId: row.jobPostingId?._id || row.jobPostingId || '',
      studentId: row.studentId?._id || row.studentId || '',
      resumeUrl: row.resumeUrl || '',
      status: row.status || 'registered',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.resumeUrl) delete payload.resumeUrl;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const statusVariant: Record<string, string> = { registered: 'default', shortlisted: 'info', placed: 'success', not_placed: 'warning' };

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '--' },
    { key: 'jobPostingId', label: 'Job Posting', render: (r: any) => {
      const j = r.jobPostingId;
      return j?.role ? `${j.role} - ${j.companyId?.name || ''}` : '--';
    }},
    { key: 'appliedAt', label: 'Applied', render: (r: any) => r.appliedAt ? new Date(r.appliedAt).toLocaleDateString() : '--' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this registration?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Placement Registrations</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Registration</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Registration' : 'New Registration'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Job Posting * <Link to="/placement/job-postings" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.jobPostingId} onChange={e => setForm(f => ({ ...f, jobPostingId: e.target.value }))} className={inp}>
                <option value="">Select job posting</option>
                {(jobPostings?.items || []).map((j: any) => <option key={j._id} value={j._id}>{j.role + ' - ' + (j.companyId?.name || '')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Student * <Link to="/people/students" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student</option>
                {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Resume URL</label><input value={form.resumeUrl} onChange={e => setForm(f => ({ ...f, resumeUrl: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
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

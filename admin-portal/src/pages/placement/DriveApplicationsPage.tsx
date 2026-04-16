import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDriveApplications, createDriveApplication, updateDriveApplication, deleteDriveApplication, listPlacementDrives, listJobPostings } from '../../services/placement';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['applied', 'shortlisted', 'not_selected', 'offered', 'withdrawn', 'no_show'] as const;
const CONFIDENCES = ['high', 'medium', 'low'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function DriveApplicationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ driveId: '', jobPostingId: '', studentId: '', status: 'applied', matchScore: '', matchConfidence: '', resumeUrl: '', consentTimestamp: '' });

  const { data, isLoading } = useQuery({ queryKey: ['drive-applications', page], queryFn: () => listDriveApplications(page, 20) });
  const { data: drives } = useQuery({ queryKey: ['placement-drives-all'], queryFn: () => listPlacementDrives(1, 200) });
  const { data: jobPostings } = useQuery({ queryKey: ['job-postings-all'], queryFn: () => listJobPostings(1, 200) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const createMut = useMutation({ mutationFn: createDriveApplication, onSuccess: () => { qc.invalidateQueries({ queryKey: ['drive-applications'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateDriveApplication(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['drive-applications'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteDriveApplication, onSuccess: () => { qc.invalidateQueries({ queryKey: ['drive-applications'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ driveId: '', jobPostingId: '', studentId: '', status: 'applied', matchScore: '', matchConfidence: '', resumeUrl: '', consentTimestamp: new Date().toISOString().slice(0, 16) });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      driveId: row.driveId?._id || row.driveId || '',
      jobPostingId: row.jobPostingId?._id || row.jobPostingId || '',
      studentId: row.studentId?._id || row.studentId || '',
      status: row.status || 'applied',
      matchScore: row.matchScore != null ? String(row.matchScore) : '',
      matchConfidence: row.matchConfidence || '',
      resumeUrl: row.resumeUrl || '',
      consentTimestamp: row.consentTimestamp ? row.consentTimestamp.slice(0, 16) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      driveId: form.driveId,
      jobPostingId: form.jobPostingId,
      studentId: form.studentId,
      status: form.status,
      consentTimestamp: form.consentTimestamp,
    };
    if (form.matchScore) payload.matchScore = Number(form.matchScore);
    if (form.matchConfidence) payload.matchConfidence = form.matchConfidence;
    if (form.resumeUrl) payload.resumeUrl = form.resumeUrl;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const statusVariant: Record<string, string> = { applied: 'default', shortlisted: 'info', not_selected: 'danger', offered: 'success', withdrawn: 'warning', no_show: 'danger' };

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.firstName ? `${r.studentId.firstName} ${r.studentId.lastName || ''}` : '--'}</span> },
    { key: 'driveId', label: 'Drive', render: (r: any) => r.driveId?.companyId?.name || r.driveId?._id?.slice(-6) || '--' },
    { key: 'jobPostingId', label: 'Job Posting', render: (r: any) => r.jobPostingId?.role || '--' },
    { key: 'appliedAt', label: 'Applied', render: (r: any) => r.appliedAt ? new Date(r.appliedAt).toLocaleDateString() : '--' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status?.replace(/_/g, ' ')}</Badge> },
    { key: 'matchScore', label: 'Match Score', render: (r: any) => r.matchScore != null ? r.matchScore : '--' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this application?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Drive Applications</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Application</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Drive Application' : 'New Drive Application'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Drive * <Link to="/placement/drives" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.driveId} onChange={e => setForm(f => ({ ...f, driveId: e.target.value }))} className={inp}>
                <option value="">Select drive</option>
                {(drives?.items || []).map((d: any) => <option key={d._id} value={d._id}>{d.companyId?.name || d._id.slice(-6)} - {d.type?.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Job Posting * <Link to="/placement/job-postings" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.jobPostingId} onChange={e => setForm(f => ({ ...f, jobPostingId: e.target.value }))} className={inp}>
                <option value="">Select job posting</option>
                {(jobPostings?.items || []).map((j: any) => <option key={j._id} value={j._id}>{j.role} - {j.companyId?.name || ''}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Student *</label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student</option>
                {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName || ''} ({s.rollNumber || s.registrationNumber || ''})</option>)}
              </select>
            </div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Match Score</label><input type="number" min={0} max={100} value={form.matchScore} onChange={e => setForm(f => ({ ...f, matchScore: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Match Confidence</label>
              <select value={form.matchConfidence} onChange={e => setForm(f => ({ ...f, matchConfidence: e.target.value }))} className={inp}>
                <option value="">Select</option>
                {CONFIDENCES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Resume URL</label><input value={form.resumeUrl} onChange={e => setForm(f => ({ ...f, resumeUrl: e.target.value }))} className={inp} placeholder="https://..." /></div>
            <div><label className={lbl}>Consent Timestamp *</label><input required type="datetime-local" value={form.consentTimestamp} onChange={e => setForm(f => ({ ...f, consentTimestamp: e.target.value }))} className={inp} /></div>
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

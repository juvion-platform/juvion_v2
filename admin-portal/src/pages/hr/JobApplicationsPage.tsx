import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listJobApplications, createJobApplication, updateJobApplication, deleteJobApplication, listRecruitments } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const STATUSES = ['applied', 'shortlisted', 'interview', 'selected', 'rejected', 'joined'] as const;
const STATUS_COLOR: Record<string, string> = { applied: 'default', shortlisted: 'info', interview: 'warning', selected: 'success', rejected: 'danger', joined: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { recruitmentId: '', applicantName: '', email: '', phone: '', resumeUrl: '', experience: '', currentDesignation: '', status: 'applied', interviewDate: '', interviewRemarks: '' };

export default function JobApplicationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['job-applications', page], queryFn: () => listJobApplications(page, 20) });
  const { data: recruitmentsData } = useQuery({ queryKey: ['recruitments-all'], queryFn: () => listRecruitments(1, 100) });

  const recruitments = recruitmentsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      recruitmentId: row.recruitmentId?._id || row.recruitmentId || '',
      applicantName: row.applicantName || '',
      email: row.email || '',
      phone: row.phone || '',
      resumeUrl: row.resumeUrl || '',
      experience: String(row.experience ?? ''),
      currentDesignation: row.currentDesignation || '',
      status: row.status || 'applied',
      interviewDate: row.interviewDate ? row.interviewDate.slice(0, 10) : '',
      interviewRemarks: row.interviewRemarks || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createJobApplication, onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-applications'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateJobApplication(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-applications'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteJobApplication, onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-applications'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (payload.experience !== '') payload.experience = Number(payload.experience);
    else delete payload.experience;
    if (!payload.resumeUrl) delete payload.resumeUrl;
    if (!payload.currentDesignation) delete payload.currentDesignation;
    if (!payload.interviewDate) delete payload.interviewDate;
    if (!payload.interviewRemarks) delete payload.interviewRemarks;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'applicantName', label: 'Applicant', render: (r: any) => <span className="font-medium text-navy">{r.applicantName}</span> },
    { key: 'recruitmentId', label: 'Position', render: (r: any) => r.recruitmentId?.position || '—' },
    { key: 'email', label: 'Email' },
    { key: 'experience', label: 'Experience', render: (r: any) => `${r.experience || 0} yrs` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this application?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Job Applications</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Application
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Application')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Recruitment * {!vem.isView && <Link to="/hr/recruitments" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.recruitmentId} onChange={e => setForm(f => ({ ...f, recruitmentId: e.target.value }))} className={inp}>
                  <option value="">Select recruitment</option>
                  {recruitments.map((r: any) => (
                    <option key={r._id} value={r._id}>{r.position}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Applicant Name *</label><input required value={form.applicantName} onChange={e => setForm(f => ({ ...f, applicantName: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Email *</label><input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Phone *</label><input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Resume URL</label><input value={form.resumeUrl} onChange={e => setForm(f => ({ ...f, resumeUrl: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Experience (years)</label><input type="number" min={0} value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Current Designation</label><input value={form.currentDesignation} onChange={e => setForm(f => ({ ...f, currentDesignation: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Interview Date</label><input type="date" value={form.interviewDate} onChange={e => setForm(f => ({ ...f, interviewDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Interview Remarks</label><input value={form.interviewRemarks} onChange={e => setForm(f => ({ ...f, interviewRemarks: e.target.value }))} className={inp} /></div>
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              {vem.isView ? 'Close' : 'Cancel'}
            </button>
            {vem.isView ? (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                <Pencil size={14} /> Edit
              </button>
            ) : (
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

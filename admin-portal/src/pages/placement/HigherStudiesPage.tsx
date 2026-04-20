import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listHigherStudiesApplications, createHigherStudiesApplication, updateHigherStudiesApplication, deleteHigherStudiesApplication } from '../../services/placement';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const EXAM_TYPES = ['gate', 'gre', 'cat', 'gmat', 'ielts', 'toefl', 'other'] as const;
const STATUSES = ['preparing', 'applied', 'admitted', 'rejected'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { studentId: '', examType: 'gate', examScore: '', targetUniversity: '', country: '', programmeApplied: '', status: 'preparing' };

export default function HigherStudiesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['higher-studies', page], queryFn: () => listHigherStudiesApplications(page, 20) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      examType: row.examType || 'gate',
      examScore: row.examScore != null ? String(row.examScore) : '',
      targetUniversity: row.targetUniversity || '',
      country: row.country || '',
      programmeApplied: row.programmeApplied || '',
      status: row.status || 'preparing',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createHigherStudiesApplication, onSuccess: () => { qc.invalidateQueries({ queryKey: ['higher-studies'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateHigherStudiesApplication(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['higher-studies'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteHigherStudiesApplication, onSuccess: () => { qc.invalidateQueries({ queryKey: ['higher-studies'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.examScore) payload.examScore = Number(form.examScore);
    else delete payload.examScore;
    if (!payload.targetUniversity) delete payload.targetUniversity;
    if (!payload.country) delete payload.country;
    if (!payload.programmeApplied) delete payload.programmeApplied;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const statusVariant: Record<string, string> = { preparing: 'default', applied: 'info', admitted: 'success', rejected: 'danger' };

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '--' },
    { key: 'examType', label: 'Exam', render: (r: any) => <Badge variant="info">{r.examType?.toUpperCase()}</Badge> },
    { key: 'examScore', label: 'Score', render: (r: any) => r.examScore != null ? r.examScore : '--' },
    { key: 'targetUniversity', label: 'University', render: (r: any) => r.targetUniversity || '--' },
    { key: 'country', label: 'Country', render: (r: any) => r.country || '--' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this record?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Higher Studies Applications</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Application</button>
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
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people/students" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Exam Type *</label>
                <select required value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))} className={inp}>
                  {EXAM_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Exam Score</label><input type="number" value={form.examScore} onChange={e => setForm(f => ({ ...f, examScore: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Target University</label><input value={form.targetUniversity} onChange={e => setForm(f => ({ ...f, targetUniversity: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Country</label><input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Programme Applied</label><input value={form.programmeApplied} onChange={e => setForm(f => ({ ...f, programmeApplied: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
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

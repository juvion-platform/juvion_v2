import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listInternalAssessments, createInternalAssessment, updateInternalAssessment, deleteInternalAssessment, listCourseOfferings } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const TYPES = ['mid1', 'mid2', 'assignment', 'quiz', 'seminar', 'lab_internal'] as const;
const STATUSES = ['scheduled', 'conducted', 'marks_entered', 'finalized'] as const;
const STATUS_COLOR: Record<string, string> = { scheduled: 'default', conducted: 'info', marks_entered: 'warning', finalized: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function InternalAssessmentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ courseOfferingId: '', name: '', type: 'mid1', maxMarks: '100', weightage: '20', date: '', status: 'scheduled' });

  const { data, isLoading } = useQuery({ queryKey: ['internal-assessments', page], queryFn: () => listInternalAssessments(page, 20) });
  const { data: offeringsData } = useQuery({ queryKey: ['offerings', 1, 200], queryFn: () => listCourseOfferings(1, 200) });

  const createMut = useMutation({ mutationFn: createInternalAssessment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['internal-assessments'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateInternalAssessment(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['internal-assessments'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteInternalAssessment, onSuccess: () => qc.invalidateQueries({ queryKey: ['internal-assessments'] }) });

  function openCreate() { setEditing(null); setForm({ courseOfferingId: '', name: '', type: 'mid1', maxMarks: '100', weightage: '20', date: '', status: 'scheduled' }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ courseOfferingId: row.courseOfferingId?._id || row.courseOfferingId || '', name: row.name, type: row.type, maxMarks: String(row.maxMarks), weightage: String(row.weightage), date: row.date?.substring(0, 10) || '', status: row.status || 'scheduled' });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, maxMarks: Number(form.maxMarks), weightage: Number(form.weightage) };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Assessment', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant="info">{r.type}</Badge> },
    { key: 'courseOfferingId', label: 'Course', render: (r: any) => {
      if (typeof r.courseOfferingId === 'object' && r.courseOfferingId?.courseId) {
        const c = r.courseOfferingId.courseId;
        return typeof c === 'object' ? `${c.code}` : c;
      }
      return r.courseOfferingId;
    }},
    { key: 'maxMarks', label: 'Max Marks' },
    { key: 'weightage', label: 'Weightage', render: (r: any) => `${r.weightage}%` },
    { key: 'date', label: 'Date', render: (r: any) => r.date ? new Date(r.date).toLocaleDateString() : '—' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status?.replace('_', ' ')}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete assessment and all marks?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Internal Assessments</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Assessment</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Assessment' : 'New Internal Assessment'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className={lbl}>Course Offering *</label>
              <select required value={form.courseOfferingId} onChange={e => setForm(f => ({ ...f, courseOfferingId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {offeringsData?.items?.map((o: any) => <option key={o._id} value={o._id}>{typeof o.courseId === 'object' ? `${o.courseId.code} — ${o.courseId.name}` : o._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. Mid-1 Exam" /></div>
            <div><label className={lbl}>Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                {TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Max Marks *</label><input required type="number" min={0} value={form.maxMarks} onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Weightage (%) *</label><input required type="number" min={0} max={100} value={form.weightage} onChange={e => setForm(f => ({ ...f, weightage: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
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

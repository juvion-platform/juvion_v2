import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listExamRegistrations, createExamRegistration, updateExamRegistration, deleteExamRegistration, listSemesters, listCourseOfferings } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const EXAM_TYPES = ['regular', 'supplementary', 'improvement'] as const;
const STATUSES = ['registered', 'approved', 'rejected', 'appeared', 'absent'] as const;
const STATUS_COLOR: Record<string, string> = { registered: 'default', approved: 'success', rejected: 'danger', appeared: 'info', absent: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function ExamRegistrationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', courseOfferingId: '', semesterId: '', examType: 'regular', isEligible: true, status: 'registered' });

  const { data, isLoading } = useQuery({ queryKey: ['exam-registrations', page], queryFn: () => listExamRegistrations(page, 20) });
  const { data: semData } = useQuery({ queryKey: ['semesters', 1, 100], queryFn: () => listSemesters(1, 100) });
  const { data: offeringsData } = useQuery({ queryKey: ['offerings', 1, 200], queryFn: () => listCourseOfferings(1, 200) });

  const createMut = useMutation({ mutationFn: createExamRegistration, onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-registrations'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateExamRegistration(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-registrations'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteExamRegistration, onSuccess: () => qc.invalidateQueries({ queryKey: ['exam-registrations'] }) });

  function openCreate() { setEditing(null); setForm({ studentId: '', courseOfferingId: '', semesterId: '', examType: 'regular', isEligible: true, status: 'registered' }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ studentId: row.studentId?._id || row.studentId || '', courseOfferingId: row.courseOfferingId?._id || row.courseOfferingId || '', semesterId: row.semesterId?._id || row.semesterId || '', examType: row.examType, isEligible: row.isEligible ?? true, status: row.status || 'registered' });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing._id, data: form });
    else createMut.mutate(form);
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{typeof r.studentId === 'object' ? r.studentId.name || r.studentId._id : r.studentId}</span> },
    { key: 'courseOfferingId', label: 'Course', render: (r: any) => {
      if (typeof r.courseOfferingId === 'object' && r.courseOfferingId?.courseId) {
        const c = r.courseOfferingId.courseId;
        return typeof c === 'object' ? c.code : c;
      }
      return r.courseOfferingId;
    }},
    { key: 'examType', label: 'Type', render: (r: any) => <Badge variant="info">{r.examType}</Badge> },
    { key: 'isEligible', label: 'Eligible', render: (r: any) => r.isEligible ? <Badge variant="success">Yes</Badge> : <Badge variant="danger">No</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Exam Registrations</h2>
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
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Registration' : 'New Exam Registration'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student ID *</label><input required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp} placeholder="Student ObjectId" /></div>
            <div><label className={lbl}>Semester *</label>
              <select required value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {semData?.items?.map((s: any) => <option key={s._id} value={s._id}>Sem {s.number} Year {s.year}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Course Offering *</label>
              <select required value={form.courseOfferingId} onChange={e => setForm(f => ({ ...f, courseOfferingId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {offeringsData?.items?.map((o: any) => <option key={o._id} value={o._id}>{typeof o.courseId === 'object' ? `${o.courseId.code} — ${o.courseId.name}` : o._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Exam Type *</label>
              <select required value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))} className={inp}>
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isEligible} onChange={e => setForm(f => ({ ...f, isEligible: e.target.checked }))} /> Is Eligible</label></div>
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

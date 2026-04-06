import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCourseFeedbacks, createCourseFeedback, updateCourseFeedback, deleteCourseFeedback, listCourseOfferings } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function CourseFeedbackPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ courseOfferingId: '', studentId: '', overallRating: '3', comments: '' });

  const { data, isLoading } = useQuery({ queryKey: ['course-feedback', page], queryFn: () => listCourseFeedbacks(page, 20) });
  const { data: offeringsData } = useQuery({ queryKey: ['offerings', 1, 200], queryFn: () => listCourseOfferings(1, 200) });

  const createMut = useMutation({ mutationFn: createCourseFeedback, onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-feedback'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCourseFeedback(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-feedback'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteCourseFeedback, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-feedback'] }) });

  function openCreate() { setEditing(null); setForm({ courseOfferingId: '', studentId: '', overallRating: '3', comments: '' }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ courseOfferingId: row.courseOfferingId?._id || row.courseOfferingId || '', studentId: row.studentId?._id || row.studentId || '', overallRating: String(row.overallRating), comments: row.comments || '' });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, overallRating: Number(form.overallRating), ratings: [{ parameter: 'overall', score: Number(form.overallRating) }] };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function renderStars(rating: number) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} size={14} className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
        ))}
      </div>
    );
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{typeof r.studentId === 'object' ? r.studentId.personId?.name || r.studentId.rollNumber || r.studentId._id : r.studentId}</span> },
    { key: 'courseOfferingId', label: 'Course', render: (r: any) => {
      if (typeof r.courseOfferingId === 'object' && r.courseOfferingId?.courseId) {
        const c = r.courseOfferingId.courseId;
        return typeof c === 'object' ? c.code : c;
      }
      return r.courseOfferingId;
    }},
    { key: 'overallRating', label: 'Rating', render: (r: any) => renderStars(r.overallRating) },
    { key: 'comments', label: 'Comments', render: (r: any) => r.comments ? <span className="text-gray-600 truncate block max-w-[200px]">{r.comments}</span> : '—' },
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
        <h2 className="text-xl font-bold text-navy">Course Feedback</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Feedback</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Feedback' : 'New Course Feedback'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className={lbl}>Course Offering *</label>
              <select required value={form.courseOfferingId} onChange={e => setForm(f => ({ ...f, courseOfferingId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {offeringsData?.items?.map((o: any) => <option key={o._id} value={o._id}>{typeof o.courseId === 'object' ? `${o.courseId.code} — ${o.courseId.name}` : o._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Student ID *</label><input required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp} placeholder="Student ObjectId" /></div>
            <div><label className={lbl}>Overall Rating (1-5) *</label><input required type="number" min={1} max={5} value={form.overallRating} onChange={e => setForm(f => ({ ...f, overallRating: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Comments</label><textarea value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))} className={inp} rows={3} /></div>
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

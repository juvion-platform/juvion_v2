import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCourseOfferings, createCourseOffering, updateCourseOffering, deleteCourseOffering, listCourses, listSemesters, listSections } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function CourseOfferingsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ courseId: '', semesterId: '', sectionId: '', facultyId: '', maxEnrollment: '60' });

  const { data, isLoading } = useQuery({ queryKey: ['offerings', page], queryFn: () => listCourseOfferings(page, 20) });
  const { data: coursesData } = useQuery({ queryKey: ['courses', 1, 200], queryFn: () => listCourses(1, 200) });
  const { data: semData } = useQuery({ queryKey: ['semesters', 1, 100], queryFn: () => listSemesters(1, 100) });
  const { data: secData } = useQuery({ queryKey: ['sections', 1, 100], queryFn: () => listSections(1, 100) });

  const createMut = useMutation({ mutationFn: createCourseOffering, onSuccess: () => { qc.invalidateQueries({ queryKey: ['offerings'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCourseOffering(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['offerings'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteCourseOffering, onSuccess: () => { qc.invalidateQueries({ queryKey: ['offerings'] }); qc.invalidateQueries({ queryKey: ['academics-stats'] }); } });

  function openCreate() { setEditing(null); setForm({ courseId: '', semesterId: '', sectionId: '', facultyId: '', maxEnrollment: '60' }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ courseId: row.courseId?._id || row.courseId || '', semesterId: row.semesterId?._id || row.semesterId || '', sectionId: row.sectionId?._id || row.sectionId || '', facultyId: row.facultyId?._id || row.facultyId || '', maxEnrollment: String(row.maxEnrollment) });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, maxEnrollment: Number(form.maxEnrollment) };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'courseId', label: 'Course', render: (r: any) => typeof r.courseId === 'object' ? <span className="font-medium text-navy">{r.courseId.code} — {r.courseId.name}</span> : r.courseId },
    { key: 'sectionId', label: 'Section', render: (r: any) => typeof r.sectionId === 'object' ? r.sectionId.name : r.sectionId },
    { key: 'facultyId', label: 'Faculty', render: (r: any) => typeof r.facultyId === 'object' ? r.facultyId.employeeId || r.facultyId._id : r.facultyId },
    { key: 'enrolled', label: 'Enrolled', render: (r: any) => `${r.enrolledCount || 0} / ${r.maxEnrollment}` },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this offering?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Course Offerings</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Offering
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Offering' : 'New Course Offering'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className={lbl}>Course *</label>
              <select required value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))} className={inp}>
                <option value="">Select course...</option>
                {coursesData?.items?.map((c: any) => <option key={c._id} value={c._id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Semester *</label>
              <select required value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {semData?.items?.map((s: any) => <option key={s._id} value={s._id}>Sem {s.number} Year {s.year}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Section *</label>
              <select required value={form.sectionId} onChange={e => setForm(f => ({ ...f, sectionId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {secData?.items?.map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Faculty ID *</label><input required value={form.facultyId} onChange={e => setForm(f => ({ ...f, facultyId: e.target.value }))} className={inp} placeholder="Faculty ObjectId" /></div>
            <div><label className={lbl}>Max Enrollment</label><input type="number" min={1} value={form.maxEnrollment} onChange={e => setForm(f => ({ ...f, maxEnrollment: e.target.value }))} className={inp} /></div>
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

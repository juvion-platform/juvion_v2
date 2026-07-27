import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCourseFeedbacks, createCourseFeedback, updateCourseFeedback, deleteCourseFeedback, listCourseOfferings } from '../../services/academics';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, Star, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { courseOfferingId: '', studentId: '', overallRating: '3', comments: '' };

export default function CourseFeedbackPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['course-feedback', page, limit, search], queryFn: () => listCourseFeedbacks(page, limit, undefined, search) });
  const { data: offeringsData } = useQuery({ queryKey: ['offerings', 1, 200], queryFn: () => listCourseOfferings(1, 200) });
  const { data: studentsData } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });
  const students = studentsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      courseOfferingId: row.courseOfferingId?._id || row.courseOfferingId || '',
      studentId: row.studentId?._id || row.studentId || '',
      overallRating: String(row.overallRating),
      comments: row.comments || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createCourseFeedback, onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-feedback'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCourseFeedback(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-feedback'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteCourseFeedback, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-feedback'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, overallRating: Number(form.overallRating), ratings: [{ parameter: 'overall', score: Number(form.overallRating) }] };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

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
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Course Feedback</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search course feedback…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Feedback</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />
      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Course Feedback')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className={lbl}>Course Offering *</label>
                <select required value={form.courseOfferingId} onChange={e => setForm(f => ({ ...f, courseOfferingId: e.target.value }))} className={inp}>
                  <option value="">Select...</option>
                  {offeringsData?.items?.map((o: any) => <option key={o._id} value={o._id}>{typeof o.courseId === 'object' ? `${o.courseId.code} — ${o.courseId.name}` : o._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student...</option>
                  {students.map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Overall Rating (1-5) *</label><input required type="number" min={1} max={5} value={form.overallRating} onChange={e => setForm(f => ({ ...f, overallRating: e.target.value }))} className={inp} /></div>
              <div className="col-span-2"><label className={lbl}>Comments</label><textarea value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value }))} className={inp} rows={3} /></div>
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

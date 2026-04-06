import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listGradeCards, createGradeCard, updateGradeCard, deleteGradeCard, listSemesters, listCourses } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const RESULTS = ['pass', 'fail', 'absent'] as const;
const RESULT_COLOR: Record<string, string> = { pass: 'success', fail: 'danger', absent: 'warning' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function GradeCardsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', semesterId: '', courseId: '', internalMarks: '0', externalMarks: '0', totalMarks: '0', grade: '', gradePoints: '0', credits: '0', result: 'pass' });

  const { data, isLoading } = useQuery({ queryKey: ['grade-cards', page], queryFn: () => listGradeCards(page, 20) });
  const { data: semData } = useQuery({ queryKey: ['semesters', 1, 100], queryFn: () => listSemesters(1, 100) });
  const { data: coursesData } = useQuery({ queryKey: ['courses', 1, 200], queryFn: () => listCourses(1, 200) });

  const createMut = useMutation({ mutationFn: createGradeCard, onSuccess: () => { qc.invalidateQueries({ queryKey: ['grade-cards'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateGradeCard(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['grade-cards'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteGradeCard, onSuccess: () => qc.invalidateQueries({ queryKey: ['grade-cards'] }) });

  function openCreate() { setEditing(null); setForm({ studentId: '', semesterId: '', courseId: '', internalMarks: '0', externalMarks: '0', totalMarks: '0', grade: '', gradePoints: '0', credits: '0', result: 'pass' }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ studentId: row.studentId?._id || row.studentId || '', semesterId: row.semesterId?._id || row.semesterId || '', courseId: row.courseId?._id || row.courseId || '', internalMarks: String(row.internalMarks), externalMarks: String(row.externalMarks), totalMarks: String(row.totalMarks), grade: row.grade, gradePoints: String(row.gradePoints), credits: String(row.credits), result: row.result });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, internalMarks: Number(form.internalMarks), externalMarks: Number(form.externalMarks), totalMarks: Number(form.totalMarks), gradePoints: Number(form.gradePoints), credits: Number(form.credits) };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{typeof r.studentId === 'object' ? r.studentId.personId?.name || r.studentId.rollNumber || r.studentId._id : r.studentId}</span> },
    { key: 'courseId', label: 'Course', render: (r: any) => typeof r.courseId === 'object' ? `${r.courseId.code}` : r.courseId },
    { key: 'internalMarks', label: 'Internal' },
    { key: 'externalMarks', label: 'External' },
    { key: 'totalMarks', label: 'Total' },
    { key: 'grade', label: 'Grade', render: (r: any) => <span className="font-bold">{r.grade}</span> },
    { key: 'gradePoints', label: 'GP' },
    { key: 'result', label: 'Result', render: (r: any) => <Badge variant={RESULT_COLOR[r.result]}>{r.result}</Badge> },
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
        <h2 className="text-xl font-bold text-navy">Grade Cards</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Grade Card</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Grade Card' : 'New Grade Card'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student ID *</label><input required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp} placeholder="Student ObjectId" /></div>
            <div><label className={lbl}>Semester *</label>
              <select required value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {semData?.items?.map((s: any) => <option key={s._id} value={s._id}>Sem {s.number} Year {s.year}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Course *</label>
              <select required value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {coursesData?.items?.map((c: any) => <option key={c._id} value={c._id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Internal Marks *</label><input required type="number" min={0} value={form.internalMarks} onChange={e => setForm(f => ({ ...f, internalMarks: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>External Marks *</label><input required type="number" min={0} value={form.externalMarks} onChange={e => setForm(f => ({ ...f, externalMarks: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Total Marks *</label><input required type="number" min={0} value={form.totalMarks} onChange={e => setForm(f => ({ ...f, totalMarks: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Grade *</label><input required value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className={inp} placeholder="e.g. A+, B, C" /></div>
            <div><label className={lbl}>Grade Points *</label><input required type="number" min={0} step="0.1" value={form.gradePoints} onChange={e => setForm(f => ({ ...f, gradePoints: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Credits *</label><input required type="number" min={0} value={form.credits} onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Result *</label>
              <select required value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))} className={inp}>
                {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
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

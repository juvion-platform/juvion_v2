import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listExamSchedules, createExamSchedule, updateExamSchedule, deleteExamSchedule, listSemesters, listCourses } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const EXAM_TYPES = ['regular', 'supplementary', 'improvement'] as const;
const STATUSES = ['scheduled', 'conducted', 'cancelled'] as const;
const STATUS_COLOR: Record<string, string> = { scheduled: 'info', conducted: 'success', cancelled: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function ExamSchedulesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ semesterId: '', courseId: '', examType: 'regular', date: '', startTime: '', endTime: '', venue: '', status: 'scheduled' });

  const { data, isLoading } = useQuery({ queryKey: ['exam-schedules', page], queryFn: () => listExamSchedules(page, 20) });
  const { data: semData } = useQuery({ queryKey: ['semesters', 1, 100], queryFn: () => listSemesters(1, 100) });
  const { data: coursesData } = useQuery({ queryKey: ['courses', 1, 200], queryFn: () => listCourses(1, 200) });

  const createMut = useMutation({ mutationFn: createExamSchedule, onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-schedules'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateExamSchedule(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-schedules'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteExamSchedule, onSuccess: () => qc.invalidateQueries({ queryKey: ['exam-schedules'] }) });

  function openCreate() { setEditing(null); setForm({ semesterId: '', courseId: '', examType: 'regular', date: '', startTime: '', endTime: '', venue: '', status: 'scheduled' }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ semesterId: row.semesterId?._id || row.semesterId || '', courseId: row.courseId?._id || row.courseId || '', examType: row.examType, date: row.date?.substring(0, 10) || '', startTime: row.startTime || '', endTime: row.endTime || '', venue: row.venue || '', status: row.status || 'scheduled' });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing._id, data: form });
    else createMut.mutate(form);
  }

  const columns = [
    { key: 'courseId', label: 'Course', render: (r: any) => typeof r.courseId === 'object' ? <span className="font-medium text-navy">{r.courseId.code} — {r.courseId.name}</span> : r.courseId },
    { key: 'examType', label: 'Type', render: (r: any) => <Badge variant="info">{r.examType}</Badge> },
    { key: 'date', label: 'Date', render: (r: any) => new Date(r.date).toLocaleDateString() },
    { key: 'time', label: 'Time', render: (r: any) => `${r.startTime} – ${r.endTime}` },
    { key: 'venue', label: 'Venue', render: (r: any) => r.venue || '—' },
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
        <h2 className="text-xl font-bold text-navy">Exam Schedules</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Schedule</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Exam Schedule' : 'New Exam Schedule'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Semester *</label>
              <select required value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {semData?.items?.map((s: any) => <option key={s._id} value={s._id}>Sem {s.number} Year {s.year}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Course *</label>
              <select required value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))} className={inp}>
                <option value="">Select...</option>
                {coursesData?.items?.map((c: any) => <option key={c._id} value={c._id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Exam Type *</label>
              <select required value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))} className={inp}>
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Date *</label><input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Start Time *</label><input required type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>End Time *</label><input required type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Venue</label><input value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} className={inp} placeholder="e.g. Hall A" /></div>
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

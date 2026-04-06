import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listParentMeetings, createParentMeeting, updateParentMeeting, deleteParentMeeting } from '../../services/welfare';
import { listStudents, listFaculty, listParents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'] as const;
const STATUS_COLOR: Record<string, string> = { scheduled: 'info', completed: 'success', cancelled: 'default', no_show: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ParentMeetingsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', parentId: '', facultyId: '', scheduledDate: '', agenda: '', notes: '', status: 'scheduled' });

  const { data, isLoading } = useQuery({ queryKey: ['parent-meetings', page], queryFn: () => listParentMeetings(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: parentsData } = useQuery({ queryKey: ['parents', 'all'], queryFn: () => listParents(1, 200) });
  const { data: facultyData } = useQuery({ queryKey: ['faculty', 'all'], queryFn: () => listFaculty(1, 200) });

  const students = studentsData?.items || [];
  const parents = parentsData?.items || [];
  const faculty = facultyData?.items || [];

  const createMut = useMutation({ mutationFn: createParentMeeting, onSuccess: () => { qc.invalidateQueries({ queryKey: ['parent-meetings'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateParentMeeting(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['parent-meetings'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteParentMeeting, onSuccess: () => { qc.invalidateQueries({ queryKey: ['parent-meetings'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', parentId: '', facultyId: '', scheduledDate: '', agenda: '', notes: '', status: 'scheduled' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      parentId: row.parentId?._id || row.parentId || '',
      facultyId: row.facultyId?._id || row.facultyId || '',
      scheduledDate: row.scheduledDate ? row.scheduledDate.slice(0, 16) : '',
      agenda: row.agenda || '',
      notes: row.notes || '',
      status: row.status || 'scheduled',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.agenda) delete payload.agenda;
    if (!payload.notes) delete payload.notes;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }
  function parentDisplayName(p: any): string { return p.personId?.name || p.person?.name || p._id; }
  function facultyDisplayName(f: any): string { return f.person?.name || f.employeeCode || f._id; }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'parentId', label: 'Parent', render: (r: any) => r.parentId?.personId?.name || '\u2014' },
    { key: 'facultyId', label: 'Faculty', render: (r: any) => r.facultyId?.personId?.name || '\u2014' },
    { key: 'scheduledDate', label: 'Scheduled', render: (r: any) => r.scheduledDate ? new Date(r.scheduledDate).toLocaleString() : '\u2014' },
    { key: 'agenda', label: 'Agenda', render: (r: any) => r.agenda || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this meeting?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Parent Meetings</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Meeting
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Meeting' : 'New Meeting'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student...</option>
                {students.map((s: any) => <option key={s._id} value={s._id}>{studentDisplayName(s)}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Parent * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))} className={inp}>
                <option value="">Select parent...</option>
                {parents.map((p: any) => <option key={p._id} value={p._id}>{parentDisplayName(p)}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Faculty * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.facultyId} onChange={e => setForm(f => ({ ...f, facultyId: e.target.value }))} className={inp}>
                <option value="">Select faculty...</option>
                {faculty.map((f: any) => <option key={f._id} value={f._id}>{facultyDisplayName(f)}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Scheduled Date *</label><input required type="datetime-local" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Agenda</label><input value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} rows={2} /></div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
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

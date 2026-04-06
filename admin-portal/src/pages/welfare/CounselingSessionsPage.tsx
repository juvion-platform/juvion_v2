import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCounselingSessions, createCounselingSession, updateCounselingSession, deleteCounselingSession } from '../../services/welfare';
import { listStudents, listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const TYPES = ['academic', 'personal', 'career', 'crisis', 'follow_up'] as const;
const TYPE_COLOR: Record<string, string> = { academic: 'info', personal: 'warning', career: 'success', crisis: 'danger', follow_up: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function CounselingSessionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', counselorId: '', sessionDate: '', type: 'academic', notes: '', followUpRequired: false, nextSessionDate: '' });

  const { data, isLoading } = useQuery({ queryKey: ['counseling-sessions', page], queryFn: () => listCounselingSessions(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const students = studentsData?.items || [];
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createCounselingSession, onSuccess: () => { qc.invalidateQueries({ queryKey: ['counseling-sessions'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCounselingSession(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['counseling-sessions'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteCounselingSession, onSuccess: () => { qc.invalidateQueries({ queryKey: ['counseling-sessions'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', counselorId: '', sessionDate: '', type: 'academic', notes: '', followUpRequired: false, nextSessionDate: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      counselorId: row.counselorId?._id || row.counselorId || '',
      sessionDate: row.sessionDate ? row.sessionDate.slice(0, 10) : '',
      type: row.type || 'academic',
      notes: row.notes || '',
      followUpRequired: !!row.followUpRequired,
      nextSessionDate: row.nextSessionDate ? row.nextSessionDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.notes) delete payload.notes;
    if (!payload.nextSessionDate) delete payload.nextSessionDate;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'counselorId', label: 'Counselor', render: (r: any) => r.counselorId?.name || '\u2014' },
    { key: 'sessionDate', label: 'Date', render: (r: any) => r.sessionDate ? new Date(r.sessionDate).toLocaleDateString() : '\u2014' },
    { key: 'type', label: 'Type', render: (r: any) => <Badge variant={TYPE_COLOR[r.type] || 'default'}>{r.type}</Badge> },
    { key: 'followUpRequired', label: 'Follow-up', render: (r: any) => r.followUpRequired ? 'Yes' : 'No' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this session?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Counseling Sessions</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Session
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Session' : 'New Session'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student...</option>
                {students.map((s: any) => <option key={s._id} value={s._id}>{studentDisplayName(s)}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Counselor * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.counselorId} onChange={e => setForm(f => ({ ...f, counselorId: e.target.value }))} className={inp}>
                <option value="">Select counselor...</option>
                {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Session Date *</label><input required type="date" value={form.sessionDate} onChange={e => setForm(f => ({ ...f, sessionDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} rows={2} /></div>
            <div><label className={lbl}>Follow-up Required</label>
              <select value={String(form.followUpRequired)} onChange={e => setForm(f => ({ ...f, followUpRequired: e.target.value === 'true' }))} className={inp}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
            <div><label className={lbl}>Next Session Date</label><input type="date" value={form.nextSessionDate} onChange={e => setForm(f => ({ ...f, nextSessionDate: e.target.value }))} className={inp} /></div>
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

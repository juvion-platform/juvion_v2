import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMentorSessions, createMentorSession, updateMentorSession, deleteMentorSession, listMentorAssignments } from '../../services/welfare';
import { listStudents, listFaculty } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const MODES = ['in_person', 'online'] as const;
const CONCERN_TYPES = ['academic', 'personal', 'financial', 'health', 'other'] as const;
const REFERRAL_TYPES = ['counselling', 'financial_aid', 'academic_support'] as const;
const MODE_COLOR: Record<string, string> = { in_person: 'info', online: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function MentorSessionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ assignmentId: '', mentorId: '', studentId: '', sessionDate: '', duration: '', mode: 'in_person' as string, topicsSummary: '', concernFlagged: false, concernType: '', referralMade: false, referralType: '' });

  const { data, isLoading } = useQuery({ queryKey: ['mentor-sessions', page], queryFn: () => listMentorSessions(page, 20) });
  const { data: assignmentsData } = useQuery({ queryKey: ['mentor-assignments', 'all'], queryFn: () => listMentorAssignments(1, 200) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: facultyData } = useQuery({ queryKey: ['faculty', 'all'], queryFn: () => listFaculty(1, 200) });

  const assignments = assignmentsData?.items || [];
  const students = studentsData?.items || [];
  const faculty = facultyData?.items || [];

  const createMut = useMutation({ mutationFn: createMentorSession, onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentor-sessions'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateMentorSession(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentor-sessions'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteMentorSession, onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentor-sessions'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ assignmentId: '', mentorId: '', studentId: '', sessionDate: new Date().toISOString().split('T')[0]!, duration: '', mode: 'in_person', topicsSummary: '', concernFlagged: false, concernType: '', referralMade: false, referralType: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      assignmentId: row.assignmentId?._id || row.assignmentId || '',
      mentorId: row.mentorId?._id || row.mentorId || '',
      studentId: row.studentId?._id || row.studentId || '',
      sessionDate: row.sessionDate ? new Date(row.sessionDate).toISOString().split('T')[0]! : '',
      duration: row.duration != null ? String(row.duration) : '',
      mode: row.mode || 'in_person',
      topicsSummary: row.topicsSummary || '',
      concernFlagged: row.concernFlagged || false,
      concernType: row.concernType || '',
      referralMade: row.referralMade || false,
      referralType: row.referralType || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, duration: form.duration ? Number(form.duration) : undefined };
    if (!payload.topicsSummary) delete payload.topicsSummary;
    if (!payload.concernType) delete payload.concernType;
    if (!payload.referralType) delete payload.referralType;
    if (!payload.duration) delete payload.duration;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'sessionDate', label: 'Date', render: (r: any) => r.sessionDate ? new Date(r.sessionDate).toLocaleDateString() : '\u2014' },
    { key: 'mode', label: 'Mode', render: (r: any) => <Badge variant={MODE_COLOR[r.mode] || 'default'}>{r.mode}</Badge> },
    { key: 'duration', label: 'Duration (min)', render: (r: any) => r.duration != null ? r.duration : '\u2014' },
    { key: 'mentorId', label: 'Mentor', render: (r: any) => r.mentorId?.person?.name || r.mentorId?.employeeId || '\u2014' },
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.person?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'concernFlagged', label: 'Concern', render: (r: any) => r.concernFlagged ? <Badge variant="danger">Flagged</Badge> : <span className="text-gray-400">No</span> },
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
        <h2 className="text-xl font-bold text-navy">Mentor Sessions</h2>
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Mentor Session' : 'New Mentor Session'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Assignment * <Link to="/welfare/mentor-assignments" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.assignmentId} onChange={e => setForm(f => ({ ...f, assignmentId: e.target.value }))} className={inp}>
                <option value="">Select assignment...</option>
                {assignments.map((a: any) => <option key={a._id} value={a._id}>{(a.mentorId?.person?.name || 'Mentor') + ' \u2192 ' + (a.studentId?.person?.name || a.studentId?.rollNumber || 'Student')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Mentor * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.mentorId} onChange={e => setForm(f => ({ ...f, mentorId: e.target.value }))} className={inp}>
                <option value="">Select mentor...</option>
                {faculty.map((f: any) => <option key={f._id} value={f._id}>{f.person?.name || f.employeeId || f._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student...</option>
                {students.map((s: any) => <option key={s._id} value={s._id}>{studentDisplayName(s)}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Session Date *</label>
              <input type="date" required value={form.sessionDate} onChange={e => setForm(f => ({ ...f, sessionDate: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Duration (minutes)</label>
              <input type="number" min="0" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className={inp} placeholder="e.g. 30" />
            </div>
            <div><label className={lbl}>Mode *</label>
              <select required value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))} className={inp}>
                {MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Topics Summary</label>
              <textarea value={form.topicsSummary} onChange={e => setForm(f => ({ ...f, topicsSummary: e.target.value }))} className={inp} rows={2} />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="concernFlagged" checked={form.concernFlagged} onChange={e => setForm(f => ({ ...f, concernFlagged: e.target.checked }))} className="rounded border-gray-300" />
              <label htmlFor="concernFlagged" className="text-sm text-gray-700">Concern Flagged</label>
            </div>
            {form.concernFlagged && (
              <div><label className={lbl}>Concern Type</label>
                <select value={form.concernType} onChange={e => setForm(f => ({ ...f, concernType: e.target.value }))} className={inp}>
                  <option value="">Select type...</option>
                  {CONCERN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="referralMade" checked={form.referralMade} onChange={e => setForm(f => ({ ...f, referralMade: e.target.checked }))} className="rounded border-gray-300" />
              <label htmlFor="referralMade" className="text-sm text-gray-700">Referral Made</label>
            </div>
            {form.referralMade && (
              <div><label className={lbl}>Referral Type</label>
                <select value={form.referralType} onChange={e => setForm(f => ({ ...f, referralType: e.target.value }))} className={inp}>
                  <option value="">Select type...</option>
                  {REFERRAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
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

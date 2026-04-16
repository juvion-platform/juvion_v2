import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMentorConcerns, createMentorConcern, updateMentorConcern, deleteMentorConcern, listMentorSessions } from '../../services/welfare';
import { listStudents, listFaculty } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const CONCERN_TYPES = ['academic', 'personal', 'financial', 'health', 'behavioral', 'other'] as const;
const SEVERITIES = ['low', 'medium', 'high'] as const;
const STATUSES = ['open', 'addressed', 'escalated', 'closed'] as const;
const SEV_COLOR: Record<string, string> = { low: 'default', medium: 'warning', high: 'danger' };
const STATUS_COLOR: Record<string, string> = { open: 'info', addressed: 'success', escalated: 'danger', closed: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function MentorConcernsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ mentorId: '', studentId: '', sessionId: '', concernType: 'academic' as string, description: '', severity: 'medium' as string, actionTaken: '', escalatedToCCD: false, status: 'open' as string });

  const { data, isLoading } = useQuery({ queryKey: ['mentor-concerns', page], queryFn: () => listMentorConcerns(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: facultyData } = useQuery({ queryKey: ['faculty', 'all'], queryFn: () => listFaculty(1, 200) });
  const { data: sessionsData } = useQuery({ queryKey: ['mentor-sessions', 'all'], queryFn: () => listMentorSessions(1, 200) });

  const students = studentsData?.items || [];
  const faculty = facultyData?.items || [];
  const sessions = sessionsData?.items || [];

  const createMut = useMutation({ mutationFn: createMentorConcern, onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentor-concerns'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateMentorConcern(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentor-concerns'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteMentorConcern, onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentor-concerns'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ mentorId: '', studentId: '', sessionId: '', concernType: 'academic', description: '', severity: 'medium', actionTaken: '', escalatedToCCD: false, status: 'open' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      mentorId: row.mentorId?._id || row.mentorId || '',
      studentId: row.studentId?._id || row.studentId || '',
      sessionId: row.sessionId?._id || row.sessionId || '',
      concernType: row.concernType || 'academic',
      description: row.description || '',
      severity: row.severity || 'medium',
      actionTaken: row.actionTaken || '',
      escalatedToCCD: row.escalatedToCCD || false,
      status: row.status || 'open',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.sessionId) delete payload.sessionId;
    if (!payload.actionTaken) delete payload.actionTaken;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'concernType', label: 'Concern Type', render: (r: any) => <Badge variant="info">{r.concernType}</Badge> },
    { key: 'severity', label: 'Severity', render: (r: any) => <Badge variant={SEV_COLOR[r.severity] || 'default'}>{r.severity}</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.person?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'mentorId', label: 'Mentor', render: (r: any) => r.mentorId?.person?.name || r.mentorId?.employeeId || '\u2014' },
    { key: 'createdAt', label: 'Flagged Date', render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this concern?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Mentor Concerns</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Concern
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Mentor Concern' : 'New Mentor Concern'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
            <div><label className={lbl}>Session <Link to="/welfare/mentor-sessions" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select value={form.sessionId} onChange={e => setForm(f => ({ ...f, sessionId: e.target.value }))} className={inp}>
                <option value="">None</option>
                {sessions.map((s: any) => <option key={s._id} value={s._id}>{new Date(s.sessionDate).toLocaleDateString() + ' - ' + (s.mentorId?.person?.name || 'Session')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Concern Type *</label>
              <select required value={form.concernType} onChange={e => setForm(f => ({ ...f, concernType: e.target.value }))} className={inp}>
                {CONCERN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Severity *</label>
              <select required value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className={inp}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Description *</label>
              <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={3} />
            </div>
            <div className="col-span-2"><label className={lbl}>Action Taken</label>
              <textarea value={form.actionTaken} onChange={e => setForm(f => ({ ...f, actionTaken: e.target.value }))} className={inp} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="escalatedToCCD" checked={form.escalatedToCCD} onChange={e => setForm(f => ({ ...f, escalatedToCCD: e.target.checked }))} className="rounded border-gray-300" />
              <label htmlFor="escalatedToCCD" className="text-sm text-gray-700">Escalated to CCD</label>
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

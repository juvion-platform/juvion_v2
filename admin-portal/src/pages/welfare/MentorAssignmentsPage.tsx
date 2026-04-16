import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMentorAssignments, createMentorAssignment, updateMentorAssignment, deleteMentorAssignment } from '../../services/welfare';
import { listStudents, listFaculty, listPersons } from '../../services/people';
import { listAcademicYears, listSemesters } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['active', 'transferred', 'completed'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'success', transferred: 'warning', completed: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function MentorAssignmentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ mentorId: '', studentId: '', academicYearId: '', semesterId: '', assignedDate: '', assignedBy: '', status: 'active', aiSuggested: false });

  const { data, isLoading } = useQuery({ queryKey: ['mentor-assignments', page], queryFn: () => listMentorAssignments(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: facultyData } = useQuery({ queryKey: ['faculty', 'all'], queryFn: () => listFaculty(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });
  const { data: acadYearsData } = useQuery({ queryKey: ['academic-years', 'all'], queryFn: () => listAcademicYears(1, 50) });
  const { data: semestersData } = useQuery({ queryKey: ['semesters', 'all'], queryFn: () => listSemesters(1, 100) });

  const students = studentsData?.items || [];
  const faculty = facultyData?.items || [];
  const persons = personsData?.items || [];
  const acadYears = acadYearsData?.items || [];
  const semesters = semestersData?.items || [];

  const createMut = useMutation({ mutationFn: createMentorAssignment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentor-assignments'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateMentorAssignment(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentor-assignments'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteMentorAssignment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['mentor-assignments'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ mentorId: '', studentId: '', academicYearId: '', semesterId: '', assignedDate: new Date().toISOString().split('T')[0]!, assignedBy: '', status: 'active', aiSuggested: false });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      mentorId: row.mentorId?._id || row.mentorId || '',
      studentId: row.studentId?._id || row.studentId || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      semesterId: row.semesterId?._id || row.semesterId || '',
      assignedDate: row.assignedDate ? new Date(row.assignedDate).toISOString().split('T')[0]! : '',
      assignedBy: row.assignedBy?._id || row.assignedBy || '',
      status: row.status || 'active',
      aiSuggested: row.aiSuggested || false,
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.semesterId) delete payload.semesterId;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'mentorId', label: 'Mentor', render: (r: any) => r.mentorId?.person?.name || r.mentorId?.employeeId || '\u2014' },
    { key: 'studentId', label: 'Mentee', render: (r: any) => r.studentId?.person?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'assignedDate', label: 'Assigned Date', render: (r: any) => r.assignedDate ? new Date(r.assignedDate).toLocaleDateString() : '\u2014' },
    { key: 'aiSuggested', label: 'AI Suggested', render: (r: any) => r.aiSuggested ? <Badge variant="info">Yes</Badge> : <span className="text-gray-400">No</span> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this assignment?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Mentor Assignments</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Assignment
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Mentor Assignment' : 'New Mentor Assignment'}>
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
            <div><label className={lbl}>Academic Year * <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                <option value="">Select academic year...</option>
                {acadYears.map((a: any) => <option key={a._id} value={a._id}>{a.name || a.label || a._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Semester</label>
              <select value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))} className={inp}>
                <option value="">None</option>
                {semesters.map((s: any) => <option key={s._id} value={s._id}>{s.name || s.number || s._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Assigned Date *</label>
              <input type="date" required value={form.assignedDate} onChange={e => setForm(f => ({ ...f, assignedDate: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Assigned By * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.assignedBy} onChange={e => setForm(f => ({ ...f, assignedBy: e.target.value }))} className={inp}>
                <option value="">Select person...</option>
                {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="aiSuggested" checked={form.aiSuggested} onChange={e => setForm(f => ({ ...f, aiSuggested: e.target.checked }))} className="rounded border-gray-300" />
              <label htmlFor="aiSuggested" className="text-sm text-gray-700">AI Suggested</label>
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

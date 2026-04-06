import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSportsTeamMembers, createSportsTeamMember, updateSportsTeamMember, deleteSportsTeamMember, listSportsTeams } from '../../services/student-dev';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function SportsTeamMembersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ teamId: '', studentId: '', position: '', joinedDate: '' });

  const { data, isLoading } = useQuery({ queryKey: ['sd-sports-team-members', page], queryFn: () => listSportsTeamMembers(page, 20) });
  const { data: teams } = useQuery({ queryKey: ['sd-sports-teams', 'all'], queryFn: () => listSportsTeams(1, 200) });
  const { data: students } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });

  const createMut = useMutation({ mutationFn: createSportsTeamMember, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-sports-team-members'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateSportsTeamMember(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-sports-team-members'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteSportsTeamMember, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-sports-team-members'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ teamId: '', studentId: '', position: '', joinedDate: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      teamId: row.teamId?._id || row.teamId || '',
      studentId: row.studentId?._id || row.studentId || '',
      position: row.position || '',
      joinedDate: row.joinedDate ? row.joinedDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.position) delete payload.position;
    if (!payload.joinedDate) delete payload.joinedDate;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'teamId', label: 'Team', render: (r: any) => <span className="font-medium text-navy">{r.teamId?.sport ? `${r.teamId.sport} (${r.teamId.category})` : '\u2014'}</span> },
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'position', label: 'Position', render: (r: any) => r.position || '\u2014' },
    { key: 'joinedDate', label: 'Joined', render: (r: any) => fmtDate(r.joinedDate) },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this member?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Sports Team Members</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Member
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Team Member' : 'New Team Member'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Sports Team * <Link to="/student-dev/sports-teams" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} className={inp}>
                <option value="">Select team</option>
                {(teams?.items || []).map((t: any) => (
                  <option key={t._id} value={t._id}>{t.sport} ({t.category})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student</option>
                {(students?.items || []).map((s: any) => (
                  <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                ))}
              </select>
            </div>
            <div><label className={lbl}>Position</label><input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Joined Date</label><input type="date" value={form.joinedDate} onChange={e => setForm(f => ({ ...f, joinedDate: e.target.value }))} className={inp} /></div>
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

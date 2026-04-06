import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listNSSParticipants, createNSSParticipant, updateNSSParticipant, deleteNSSParticipant, listNSSActivities } from '../../services/student-dev';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function NSSParticipantsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ activityId: '', studentId: '', hoursContributed: '', certificateIssued: false });

  const { data, isLoading } = useQuery({ queryKey: ['sd-nss-participants', page], queryFn: () => listNSSParticipants(page, 20) });
  const { data: activities } = useQuery({ queryKey: ['sd-nss-activities', 'all'], queryFn: () => listNSSActivities(1, 200) });
  const { data: students } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });

  const createMut = useMutation({ mutationFn: createNSSParticipant, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-nss-participants'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateNSSParticipant(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-nss-participants'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteNSSParticipant, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-nss-participants'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ activityId: '', studentId: '', hoursContributed: '', certificateIssued: false });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      activityId: row.activityId?._id || row.activityId || '',
      studentId: row.studentId?._id || row.studentId || '',
      hoursContributed: row.hoursContributed != null ? String(row.hoursContributed) : '',
      certificateIssued: row.certificateIssued || false,
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, hoursContributed: Number(form.hoursContributed) };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'activityId', label: 'Activity', render: (r: any) => <span className="font-medium text-navy">{r.activityId?.title || '\u2014'}</span> },
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'hoursContributed', label: 'Hours', render: (r: any) => r.hoursContributed },
    { key: 'certificateIssued', label: 'Certificate', render: (r: any) => <Badge variant={r.certificateIssued ? 'success' : 'default'}>{r.certificateIssued ? 'Issued' : 'Pending'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this participant?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">NSS Participants</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Participant
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit NSS Participant' : 'New NSS Participant'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>NSS Activity * <Link to="/student-dev/nss-activities" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.activityId} onChange={e => setForm(f => ({ ...f, activityId: e.target.value }))} className={inp}>
                <option value="">Select activity</option>
                {(activities?.items || []).map((a: any) => (
                  <option key={a._id} value={a._id}>{a.title}</option>
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
            <div><label className={lbl}>Hours Contributed *</label><input required type="number" min="0" value={form.hoursContributed} onChange={e => setForm(f => ({ ...f, hoursContributed: e.target.value }))} className={inp} /></div>
            <div>
              <label className={lbl}>Certificate Issued</label>
              <select value={String(form.certificateIssued)} onChange={e => setForm(f => ({ ...f, certificateIssued: e.target.value === 'true' }))} className={inp}>
                <option value="false">No</option>
                <option value="true">Yes</option>
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

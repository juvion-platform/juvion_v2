import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCounsellingReferrals, createCounsellingReferral, updateCounsellingReferral, deleteCounsellingReferral } from '../../services/welfare';
import { listStudents, listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const REFERRAL_SOURCES = ['mentor', 'st5', 'self', 'parent', 'faculty', 'ccd_alert'] as const;
const TRIGGERING_CASE_TYPES = ['grievance', 'crisis', 'misconduct', 'academic'] as const;
const STATUSES = ['referred', 'accepted', 'in_progress', 'completed', 'declined'] as const;
const FOLLOW_UP_STATUSES = ['pending', 'on_track', 'missed', 'completed'] as const;
const STATUS_COLOR: Record<string, string> = { referred: 'default', accepted: 'info', in_progress: 'warning', completed: 'success', declined: 'danger' };
const FOLLOW_COLOR: Record<string, string> = { pending: 'default', on_track: 'success', missed: 'danger', completed: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function CounsellingReferralsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', referredBy: '', referralSource: 'mentor' as string, triggeringCaseType: '', status: 'referred' as string, followUpStatus: 'pending' as string, closedReason: '' });

  const { data, isLoading } = useQuery({ queryKey: ['counselling-referrals', page], queryFn: () => listCounsellingReferrals(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const students = studentsData?.items || [];
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createCounsellingReferral, onSuccess: () => { qc.invalidateQueries({ queryKey: ['counselling-referrals'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCounsellingReferral(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['counselling-referrals'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteCounsellingReferral, onSuccess: () => { qc.invalidateQueries({ queryKey: ['counselling-referrals'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', referredBy: '', referralSource: 'mentor', triggeringCaseType: '', status: 'referred', followUpStatus: 'pending', closedReason: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      referredBy: row.referredBy?._id || row.referredBy || '',
      referralSource: row.referralSource || 'mentor',
      triggeringCaseType: row.triggeringCaseType || '',
      status: row.status || 'referred',
      followUpStatus: row.followUpStatus || 'pending',
      closedReason: row.closedReason || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.triggeringCaseType) delete payload.triggeringCaseType;
    if (!payload.closedReason) delete payload.closedReason;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.person?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'referredBy', label: 'Referred By', render: (r: any) => r.referredBy?.name || '\u2014' },
    { key: 'referralSource', label: 'Source', render: (r: any) => <Badge variant="info">{r.referralSource}</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'followUpStatus', label: 'Follow-up', render: (r: any) => <Badge variant={FOLLOW_COLOR[r.followUpStatus] || 'default'}>{r.followUpStatus}</Badge> },
    { key: 'createdAt', label: 'Date', render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this referral?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Counselling Referrals</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Referral
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Counselling Referral' : 'New Counselling Referral'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student...</option>
                {students.map((s: any) => <option key={s._id} value={s._id}>{studentDisplayName(s)}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Referred By * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.referredBy} onChange={e => setForm(f => ({ ...f, referredBy: e.target.value }))} className={inp}>
                <option value="">Select person...</option>
                {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Referral Source *</label>
              <select required value={form.referralSource} onChange={e => setForm(f => ({ ...f, referralSource: e.target.value }))} className={inp}>
                {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Triggering Case Type</label>
              <select value={form.triggeringCaseType} onChange={e => setForm(f => ({ ...f, triggeringCaseType: e.target.value }))} className={inp}>
                <option value="">None</option>
                {TRIGGERING_CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Follow-up Status *</label>
              <select required value={form.followUpStatus} onChange={e => setForm(f => ({ ...f, followUpStatus: e.target.value }))} className={inp}>
                {FOLLOW_UP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Closed Reason</label>
              <textarea value={form.closedReason} onChange={e => setForm(f => ({ ...f, closedReason: e.target.value }))} className={inp} rows={2} />
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

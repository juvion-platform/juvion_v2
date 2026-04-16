import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listOptOutRecords, createOptOutRecord, updateOptOutRecord, deleteOptOutRecord, listPlacementSeasons } from '../../services/placement';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const REASONS = ['higher_education', 'entrepreneurship', 'family_business', 'personal', 'other'] as const;
const STATUSES = ['active', 'voided'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function OptOutRecordsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', placementSeasonId: '', reason: 'higher_education', reasonDetail: '', evidenceUrl: '', status: 'active', voidReason: '' });

  const { data, isLoading } = useQuery({ queryKey: ['opt-out-records', page], queryFn: () => listOptOutRecords(page, 20) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });
  const { data: seasons } = useQuery({ queryKey: ['placement-seasons-all'], queryFn: () => listPlacementSeasons(1, 100) });

  const createMut = useMutation({ mutationFn: createOptOutRecord, onSuccess: () => { qc.invalidateQueries({ queryKey: ['opt-out-records'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateOptOutRecord(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['opt-out-records'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteOptOutRecord, onSuccess: () => { qc.invalidateQueries({ queryKey: ['opt-out-records'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', placementSeasonId: '', reason: 'higher_education', reasonDetail: '', evidenceUrl: '', status: 'active', voidReason: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      placementSeasonId: row.placementSeasonId?._id || row.placementSeasonId || '',
      reason: row.reason || 'higher_education',
      reasonDetail: row.reasonDetail || '',
      evidenceUrl: row.evidenceUrl || '',
      status: row.status || 'active',
      voidReason: row.voidReason || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      studentId: form.studentId,
      placementSeasonId: form.placementSeasonId,
      reason: form.reason,
      status: form.status,
    };
    if (form.reasonDetail) payload.reasonDetail = form.reasonDetail;
    if (form.evidenceUrl) payload.evidenceUrl = form.evidenceUrl;
    if (form.voidReason) payload.voidReason = form.voidReason;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const reasonVariant: Record<string, string> = { higher_education: 'info', entrepreneurship: 'success', family_business: 'warning', personal: 'default', other: 'default' };
  const statusVariant: Record<string, string> = { active: 'success', voided: 'danger' };

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.firstName ? `${r.studentId.firstName} ${r.studentId.lastName || ''}` : '--'}</span> },
    { key: 'placementSeasonId', label: 'Season', render: (r: any) => r.placementSeasonId?.name || '--' },
    { key: 'reason', label: 'Reason', render: (r: any) => <Badge variant={reasonVariant[r.reason] || 'default'}>{r.reason?.replace(/_/g, ' ')}</Badge> },
    { key: 'reasonDetail', label: 'Details', render: (r: any) => <span className="truncate max-w-[200px] block">{r.reasonDetail || '--'}</span> },
    { key: 'recordedAt', label: 'Recorded', render: (r: any) => r.recordedAt ? new Date(r.recordedAt).toLocaleDateString() : '--' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this opt-out record?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Opt-Out Records</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Opt-Out Record</button>
      </div>
      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Opt-Out Record' : 'New Opt-Out Record'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student *</label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student</option>
                {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName || ''} ({s.rollNumber || s.registrationNumber || ''})</option>)}
              </select>
            </div>
            <div><label className={lbl}>Season * <Link to="/placement/seasons" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.placementSeasonId} onChange={e => setForm(f => ({ ...f, placementSeasonId: e.target.value }))} className={inp}>
                <option value="">Select season</option>
                {(seasons?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Reason *</label>
              <select required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className={inp}>
                {REASONS.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Reason Detail</label><textarea value={form.reasonDetail} onChange={e => setForm(f => ({ ...f, reasonDetail: e.target.value }))} className={inp} rows={3} placeholder="Additional details..." /></div>
            <div><label className={lbl}>Evidence URL</label><input value={form.evidenceUrl} onChange={e => setForm(f => ({ ...f, evidenceUrl: e.target.value }))} className={inp} placeholder="https://..." /></div>
            <div><label className={lbl}>Void Reason</label><input value={form.voidReason} onChange={e => setForm(f => ({ ...f, voidReason: e.target.value }))} className={inp} placeholder="If voided, reason..." /></div>
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

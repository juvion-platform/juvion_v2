import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listHostelVisitorLogs, createHostelVisitorLog, updateHostelVisitorLog, deleteHostelVisitorLog } from '../../services/welfare';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function HostelVisitorLogsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', visitorName: '', visitorRelation: '', visitorPhone: '', inTime: '', outTime: '', purpose: '' });

  const { data, isLoading } = useQuery({ queryKey: ['hostel-visitor-logs', page], queryFn: () => listHostelVisitorLogs(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const students = studentsData?.items || [];

  const createMut = useMutation({ mutationFn: createHostelVisitorLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['hostel-visitor-logs'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateHostelVisitorLog(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['hostel-visitor-logs'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteHostelVisitorLog, onSuccess: () => { qc.invalidateQueries({ queryKey: ['hostel-visitor-logs'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', visitorName: '', visitorRelation: '', visitorPhone: '', inTime: '', outTime: '', purpose: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      visitorName: row.visitorName || '',
      visitorRelation: row.visitorRelation || '',
      visitorPhone: row.visitorPhone || '',
      inTime: row.inTime ? row.inTime.slice(0, 16) : '',
      outTime: row.outTime ? row.outTime.slice(0, 16) : '',
      purpose: row.purpose || '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.inTime) delete payload.inTime;
    if (!payload.outTime) delete payload.outTime;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'visitorName', label: 'Visitor' },
    { key: 'visitorRelation', label: 'Relation' },
    { key: 'visitorPhone', label: 'Phone' },
    { key: 'inTime', label: 'In', render: (r: any) => r.inTime ? new Date(r.inTime).toLocaleString() : '\u2014' },
    { key: 'outTime', label: 'Out', render: (r: any) => r.outTime ? new Date(r.outTime).toLocaleString() : '\u2014' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this log?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Hostel Visitor Logs</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Entry
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Visitor Log' : 'New Visitor Log'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student...</option>
                {students.map((s: any) => <option key={s._id} value={s._id}>{studentDisplayName(s)}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Visitor Name *</label><input required value={form.visitorName} onChange={e => setForm(f => ({ ...f, visitorName: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Relation *</label><input required value={form.visitorRelation} onChange={e => setForm(f => ({ ...f, visitorRelation: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Phone *</label><input required value={form.visitorPhone} onChange={e => setForm(f => ({ ...f, visitorPhone: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>In Time</label><input type="datetime-local" value={form.inTime} onChange={e => setForm(f => ({ ...f, inTime: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Out Time</label><input type="datetime-local" value={form.outTime} onChange={e => setForm(f => ({ ...f, outTime: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Purpose *</label><input required value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className={inp} /></div>
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

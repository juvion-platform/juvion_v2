import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listICCComplaints, createICCComplaint, updateICCComplaint, deleteICCComplaint } from '../../services/welfare';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const RESPONDENT_TYPES = ['student', 'faculty', 'staff'] as const;
const STATUSES = ['filed', 'preliminary_assessment', 'inquiry', 'hearing', 'recommendation_issued', 'appealed', 'closed'] as const;
const STATUS_COLOR: Record<string, string> = { filed: 'default', preliminary_assessment: 'info', inquiry: 'warning', hearing: 'warning', recommendation_issued: 'info', appealed: 'danger', closed: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ICCComplaintsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ complainantId: '', respondentId: '', respondentType: 'student' as string, description: '', incidentDate: '', filedDate: '', deadlineDate: '', status: 'filed' as string, committeeId: '', confidentialityLevel: 'icc_only' });

  const { data, isLoading } = useQuery({ queryKey: ['icc-complaints', page], queryFn: () => listICCComplaints(page, 20) });
  const { data: personsData } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createICCComplaint, onSuccess: () => { qc.invalidateQueries({ queryKey: ['icc-complaints'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateICCComplaint(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['icc-complaints'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteICCComplaint, onSuccess: () => { qc.invalidateQueries({ queryKey: ['icc-complaints'] }); } });

  function openCreate() {
    setEditing(null);
    const today = new Date().toISOString().split('T')[0]!;
    setForm({ complainantId: '', respondentId: '', respondentType: 'student', description: '', incidentDate: today, filedDate: today, deadlineDate: '', status: 'filed', committeeId: '', confidentialityLevel: 'icc_only' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      complainantId: row.complainantId?._id || row.complainantId || '',
      respondentId: row.respondentId?._id || row.respondentId || '',
      respondentType: row.respondentType || 'student',
      description: row.description || '',
      incidentDate: row.incidentDate ? new Date(row.incidentDate).toISOString().split('T')[0]! : '',
      filedDate: row.filedDate ? new Date(row.filedDate).toISOString().split('T')[0]! : '',
      deadlineDate: row.deadlineDate ? new Date(row.deadlineDate).toISOString().split('T')[0]! : '',
      status: row.status || 'filed',
      committeeId: row.committeeId?._id || row.committeeId || '',
      confidentialityLevel: row.confidentialityLevel || 'icc_only',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'respondentType', label: 'Complaint Type', render: (r: any) => <Badge variant="info">{r.respondentType}</Badge> },
    { key: 'filedDate', label: 'Filed Date', render: (r: any) => r.filedDate ? new Date(r.filedDate).toLocaleDateString() : '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'deadlineDate', label: 'Deadline', render: (r: any) => r.deadlineDate ? new Date(r.deadlineDate).toLocaleDateString() : '\u2014' },
    { key: 'description', label: 'Description', render: (r: any) => <span className="truncate max-w-[200px] inline-block">{r.description}</span> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this complaint?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">ICC Complaints</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Complaint
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit ICC Complaint' : 'New ICC Complaint'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Complainant * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.complainantId} onChange={e => setForm(f => ({ ...f, complainantId: e.target.value }))} className={inp}>
                <option value="">Select person...</option>
                {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Respondent * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.respondentId} onChange={e => setForm(f => ({ ...f, respondentId: e.target.value }))} className={inp}>
                <option value="">Select person...</option>
                {persons.map((p: any) => <option key={p._id} value={p._id}>{p.name || p._id}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Respondent Type *</label>
              <select required value={form.respondentType} onChange={e => setForm(f => ({ ...f, respondentType: e.target.value }))} className={inp}>
                {RESPONDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Incident Date *</label>
              <input type="date" required value={form.incidentDate} onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Filed Date *</label>
              <input type="date" required value={form.filedDate} onChange={e => setForm(f => ({ ...f, filedDate: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Deadline Date *</label>
              <input type="date" required value={form.deadlineDate} onChange={e => setForm(f => ({ ...f, deadlineDate: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Committee ID *</label>
              <input type="text" required value={form.committeeId} onChange={e => setForm(f => ({ ...f, committeeId: e.target.value }))} className={inp} placeholder="Committee ObjectId" />
            </div>
            <div className="col-span-2"><label className={lbl}>Description *</label>
              <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={3} />
            </div>
            <div><label className={lbl}>Confidentiality Level</label>
              <input type="text" value={form.confidentialityLevel} onChange={e => setForm(f => ({ ...f, confidentialityLevel: e.target.value }))} className={inp} />
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

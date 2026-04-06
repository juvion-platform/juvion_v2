import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRegulatoryFilings, createRegulatoryFiling, updateRegulatoryFiling, deleteRegulatoryFiling } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const BODIES = ['aicte', 'ugc', 'jntu', 'state_govt', 'mhrd', 'other'] as const;
const STATUSES = ['upcoming', 'in_progress', 'filed', 'overdue', 'approved', 'rejected'] as const;
const STATUS_COLOR: Record<string, string> = { upcoming: 'default', in_progress: 'warning', filed: 'info', overdue: 'danger', approved: 'success', rejected: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function RegulatoryFilingsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    body: 'aicte' as string, filingType: '', dueDate: '', filedDate: '',
    referenceNumber: '', documentUrl: '', status: 'upcoming' as string,
  });

  const { data, isLoading } = useQuery({ queryKey: ['regulatory-filings', page], queryFn: () => listRegulatoryFilings(page, 20) });

  const createMut = useMutation({ mutationFn: createRegulatoryFiling, onSuccess: () => { qc.invalidateQueries({ queryKey: ['regulatory-filings'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateRegulatoryFiling(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['regulatory-filings'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteRegulatoryFiling, onSuccess: () => { qc.invalidateQueries({ queryKey: ['regulatory-filings'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ body: 'aicte', filingType: '', dueDate: '', filedDate: '', referenceNumber: '', documentUrl: '', status: 'upcoming' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      body: row.body || 'aicte',
      filingType: row.filingType || '',
      dueDate: row.dueDate?.slice(0, 10) || '',
      filedDate: row.filedDate?.slice(0, 10) || '',
      referenceNumber: row.referenceNumber || '',
      documentUrl: row.documentUrl || '',
      status: row.status || 'upcoming',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!form.filedDate) delete payload.filedDate;
    if (!form.referenceNumber) delete payload.referenceNumber;
    if (!form.documentUrl) delete payload.documentUrl;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'filingType', label: 'Filing Type', render: (r: any) => <span className="font-medium text-navy">{r.filingType}</span> },
    { key: 'body', label: 'Body', render: (r: any) => <Badge variant="info">{r.body?.toUpperCase()}</Badge> },
    { key: 'dueDate', label: 'Due Date', render: (r: any) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '\u2014' },
    { key: 'filedDate', label: 'Filed Date', render: (r: any) => r.filedDate ? new Date(r.filedDate).toLocaleDateString() : '\u2014' },
    { key: 'referenceNumber', label: 'Ref #', render: (r: any) => r.referenceNumber || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this filing?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Regulatory Filings</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Filing
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Regulatory Filing' : 'New Regulatory Filing'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Regulatory Body *</label>
              <select required value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} className={inp}>
                {BODIES.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Filing Type *</label>
              <input required value={form.filingType} onChange={e => setForm(f => ({ ...f, filingType: e.target.value }))} className={inp} placeholder="e.g. EOA, Annual Return" />
            </div>
            <div><label className={lbl}>Due Date *</label>
              <input required type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Filed Date</label>
              <input type="date" value={form.filedDate} onChange={e => setForm(f => ({ ...f, filedDate: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Reference Number</label>
              <input value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} className={inp} />
            </div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className={lbl}>Document URL</label>
              <input value={form.documentUrl} onChange={e => setForm(f => ({ ...f, documentUrl: e.target.value }))} className={inp} placeholder="https://..." />
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

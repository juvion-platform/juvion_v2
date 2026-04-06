import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCirculars, createCircular, updateCircular, deleteCircular } from '../../services/platform';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const AUDIENCES = ['all', 'students', 'faculty', 'staff', 'parents'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function CircularsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ circularNumber: '', title: '', content: '', issuedBy: '', department: '', targetAudience: 'all', documentUrl: '', issuedDate: '', expiryDate: '' });

  const { data, isLoading } = useQuery({ queryKey: ['circulars', page], queryFn: () => listCirculars(page, 20) });

  const createMut = useMutation({ mutationFn: createCircular, onSuccess: () => { qc.invalidateQueries({ queryKey: ['circulars'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateCircular(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['circulars'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteCircular, onSuccess: () => { qc.invalidateQueries({ queryKey: ['circulars'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ circularNumber: '', title: '', content: '', issuedBy: '', department: '', targetAudience: 'all', documentUrl: '', issuedDate: '', expiryDate: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      circularNumber: row.circularNumber || '',
      title: row.title || '',
      content: row.content || '',
      issuedBy: row.issuedBy?._id || row.issuedBy || '',
      department: row.department || '',
      targetAudience: row.targetAudience || 'all',
      documentUrl: row.documentUrl || '',
      issuedDate: row.issuedDate ? row.issuedDate.slice(0, 10) : '',
      expiryDate: row.expiryDate ? row.expiryDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.content) delete payload.content;
    if (!payload.department) delete payload.department;
    if (!payload.documentUrl) delete payload.documentUrl;
    if (!payload.issuedDate) delete payload.issuedDate;
    if (!payload.expiryDate) delete payload.expiryDate;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'circularNumber', label: 'Circular #', render: (r: any) => <span className="font-medium text-navy">{r.circularNumber}</span> },
    { key: 'title', label: 'Title', render: (r: any) => r.title },
    { key: 'targetAudience', label: 'Audience', render: (r: any) => <Badge variant="info">{r.targetAudience}</Badge> },
    { key: 'department', label: 'Department', render: (r: any) => r.department || '\u2014' },
    { key: 'issuedDate', label: 'Issued', render: (r: any) => fmtDate(r.issuedDate) },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this circular?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Circulars</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Circular
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Circular' : 'New Circular'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Circular Number *</label><input required value={form.circularNumber} onChange={e => setForm(f => ({ ...f, circularNumber: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} /></div>
            <div className="col-span-2"><label className={lbl}>Content</label><textarea rows={3} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Issued By (Person ID) *</label><input required value={form.issuedBy} onChange={e => setForm(f => ({ ...f, issuedBy: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Department</label><input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Target Audience *</label>
              <select required value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))} className={inp}>
                {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Document URL</label><input value={form.documentUrl} onChange={e => setForm(f => ({ ...f, documentUrl: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Issued Date</label><input type="date" value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Expiry Date</label><input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className={inp} /></div>
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

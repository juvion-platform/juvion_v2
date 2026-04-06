import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPromotions, createPromotion, updatePromotion, deletePromotion, listEmployees } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['proposed', 'approved', 'implemented', 'rejected'] as const;
const STATUS_COLOR: Record<string, string> = { proposed: 'default', approved: 'info', implemented: 'success', rejected: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function PromotionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ employeeId: '', fromDesignation: '', toDesignation: '', fromPayScale: '', toPayScale: '', effectiveDate: '', remarks: '', status: 'proposed' });

  const { data, isLoading } = useQuery({ queryKey: ['promotions', page], queryFn: () => listPromotions(page, 20) });
  const { data: employees } = useQuery({ queryKey: ['employees-all'], queryFn: () => listEmployees(1, 200) });

  const createMut = useMutation({ mutationFn: createPromotion, onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePromotion(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deletePromotion, onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ employeeId: '', fromDesignation: '', toDesignation: '', fromPayScale: '', toPayScale: '', effectiveDate: '', remarks: '', status: 'proposed' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      employeeId: row.employeeId?._id || row.employeeId || '',
      fromDesignation: row.fromDesignation || '',
      toDesignation: row.toDesignation || '',
      fromPayScale: String(row.fromPayScale ?? ''),
      toPayScale: String(row.toPayScale ?? ''),
      effectiveDate: row.effectiveDate ? row.effectiveDate.slice(0, 10) : '',
      remarks: row.remarks || '',
      status: row.status || 'proposed',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (payload.fromPayScale) payload.fromPayScale = Number(payload.fromPayScale); else delete payload.fromPayScale;
    if (payload.toPayScale) payload.toPayScale = Number(payload.toPayScale); else delete payload.toPayScale;
    if (!payload.remarks) delete payload.remarks;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'employeeId', label: 'Employee', render: (r: any) => <span className="font-medium text-navy">{r.employeeId?.personId?.name || r.employeeId?.employeeId || '—'}</span> },
    { key: 'fromDesignation', label: 'From' },
    { key: 'toDesignation', label: 'To' },
    { key: 'effectiveDate', label: 'Effective Date', render: (r: any) => r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '-' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this promotion?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Promotions</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Promotion
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Promotion' : 'New Promotion'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Employee * <Link to="/hr/employees" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={inp}>
                <option value="">Select employee</option>
                {(employees?.items || []).map((e: any) => (
                  <option key={e._id} value={e._id}>{e.personId?.name || e.employeeId || e._id}</option>
                ))}
              </select>
            </div>
            <div><label className={lbl}>From Designation *</label><input required value={form.fromDesignation} onChange={e => setForm(f => ({ ...f, fromDesignation: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>To Designation *</label><input required value={form.toDesignation} onChange={e => setForm(f => ({ ...f, toDesignation: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>From Pay Scale</label><input type="number" value={form.fromPayScale} onChange={e => setForm(f => ({ ...f, fromPayScale: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>To Pay Scale</label><input type="number" value={form.toPayScale} onChange={e => setForm(f => ({ ...f, toPayScale: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Effective Date *</label><input required type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Remarks</label><input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Status *</label>
              <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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

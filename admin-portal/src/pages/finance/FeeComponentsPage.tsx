import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFeeComponents, createFeeComponent, updateFeeComponent, deleteFeeComponent } from '../../services/finance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const COMPONENT_TYPES = ['tuition', 'hostel', 'transport', 'lab', 'exam', 'library', 'development', 'caution_deposit', 'other'] as const;
const TYPE_COLOR: Record<string, string> = { tuition: 'info', hostel: 'warning', transport: 'default', lab: 'success', exam: 'danger', library: 'info', development: 'success', caution_deposit: 'warning', other: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function FeeComponentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    feeStructureInstanceId: '',
    name: '',
    amount: '',
    isRefundable: false,
    componentType: 'tuition',
    isConditional: false,
    displayOrder: '',
  });

  const { data, isLoading } = useQuery({ queryKey: ['fee-components', page], queryFn: () => listFeeComponents(page, 20) });

  const createMut = useMutation({ mutationFn: createFeeComponent, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-components'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFeeComponent(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-components'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteFeeComponent, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-components'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ feeStructureInstanceId: '', name: '', amount: '', isRefundable: false, componentType: 'tuition', isConditional: false, displayOrder: '' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      feeStructureInstanceId: row.feeStructureInstanceId?._id || row.feeStructureInstanceId || '',
      name: row.name || '',
      amount: String(row.amount || ''),
      isRefundable: row.isRefundable || false,
      componentType: row.componentType || 'tuition',
      isConditional: row.isConditional || false,
      displayOrder: row.displayOrder != null ? String(row.displayOrder) : '',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      feeStructureInstanceId: form.feeStructureInstanceId,
      name: form.name,
      amount: Number(form.amount),
      isRefundable: form.isRefundable,
      componentType: form.componentType,
      isConditional: form.isConditional,
    };
    if (form.displayOrder) payload.displayOrder = Number(form.displayOrder);
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'componentType', label: 'Type', render: (r: any) => <Badge variant={TYPE_COLOR[r.componentType] || 'default'}>{r.componentType}</Badge> },
    { key: 'amount', label: 'Amount', render: (r: any) => `₹${Number(r.amount).toLocaleString('en-IN')}` },
    { key: 'isRefundable', label: 'Refundable', render: (r: any) => <Badge variant={r.isRefundable ? 'success' : 'default'}>{r.isRefundable ? 'Yes' : 'No'}</Badge> },
    { key: 'isConditional', label: 'Conditional', render: (r: any) => r.isConditional ? 'Yes' : 'No' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this fee component?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Fee Components</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Fee Component
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Fee Component' : 'New Fee Component'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Fee Structure Instance ID *</label>
              <input required value={form.feeStructureInstanceId} onChange={e => setForm(f => ({ ...f, feeStructureInstanceId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Amount *</label>
              <input required type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Component Type *</label>
              <select required value={form.componentType} onChange={e => setForm(f => ({ ...f, componentType: e.target.value }))} className={inp}>
                {COMPONENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4 col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isRefundable} onChange={e => setForm(f => ({ ...f, isRefundable: e.target.checked }))} />
                Refundable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isConditional} onChange={e => setForm(f => ({ ...f, isConditional: e.target.checked }))} />
                Conditional
              </label>
            </div>
            <div>
              <label className={lbl}>Display Order</label>
              <input type="number" min={0} value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} className={inp} />
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

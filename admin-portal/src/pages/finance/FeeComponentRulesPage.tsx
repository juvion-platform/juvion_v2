import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFeeComponentRules, createFeeComponentRule, updateFeeComponentRule, deleteFeeComponentRule } from '../../services/finance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const CONDITION_TYPES = ['hostel', 'transport', 'lab_programme', 'quota', 'category', 'regulation', 'batch'] as const;
const OPERATORS = ['equals', 'in', 'not_in', 'exists', 'not_exists'] as const;
const STATUSES = ['configured', 'draft'] as const;
const STATUS_COLOR: Record<string, string> = { configured: 'success', draft: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

export default function FeeComponentRulesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    feeComponentId: '',
    conditionType: 'hostel',
    conditionValue: '',
    operator: 'equals',
    status: 'draft',
  });

  const { data, isLoading } = useQuery({ queryKey: ['fee-component-rules', page], queryFn: () => listFeeComponentRules(page, 20) });

  const createMut = useMutation({ mutationFn: createFeeComponentRule, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-component-rules'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFeeComponentRule(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-component-rules'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteFeeComponentRule, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-component-rules'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ feeComponentId: '', conditionType: 'hostel', conditionValue: '', operator: 'equals', status: 'draft' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      feeComponentId: row.feeComponentId?._id || row.feeComponentId || '',
      conditionType: row.conditionType || 'hostel',
      conditionValue: row.conditionValue || '',
      operator: row.operator || 'equals',
      status: row.status || 'draft',
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
    { key: 'feeComponentId', label: 'Fee Component', render: (r: any) => <span className="font-medium text-navy">{r.feeComponentId?.name || r.feeComponentId || '\u2014'}</span> },
    { key: 'conditionType', label: 'Condition Type', render: (r: any) => <Badge variant="info">{r.conditionType?.replace(/_/g, ' ')}</Badge> },
    { key: 'conditionValue', label: 'Condition Value' },
    { key: 'operator', label: 'Operator', render: (r: any) => <Badge variant="default">{r.operator?.replace(/_/g, ' ')}</Badge> },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this rule?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Fee Component Rules</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Rule
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Fee Component Rule' : 'New Fee Component Rule'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Fee Component ID *</label>
              <input required value={form.feeComponentId} onChange={e => setForm(f => ({ ...f, feeComponentId: e.target.value }))} className={inp} placeholder="ObjectId" />
            </div>
            <div>
              <label className={lbl}>Condition Type *</label>
              <select required value={form.conditionType} onChange={e => setForm(f => ({ ...f, conditionType: e.target.value }))} className={inp}>
                {CONDITION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Condition Value *</label>
              <input required value={form.conditionValue} onChange={e => setForm(f => ({ ...f, conditionValue: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Operator *</label>
              <select required value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value }))} className={inp}>
                {OPERATORS.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Status *</label>
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

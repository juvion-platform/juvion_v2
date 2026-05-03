import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFeeStructures, createFeeStructure, updateFeeStructure, deleteFeeStructure } from '../../services/finance';
import { listAcademicYears, listProgrammes, listBranches } from '../../services/academics';
import { listFeeCategories } from '../../services/fee-categories';
import { listFeeQuotas } from '../../services/fee-quotas';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

interface Component {
  name: string;
  amount: string;
  isRefundable: boolean;
}

const emptyComponent = (): Component => ({ name: '', amount: '', isRefundable: false });

const emptyForm = { academicYearId: '', programmeId: '', branchId: '', category: '', quota: 'convener', year: '' };

/** Pull a human-readable message from an axios error / generic Error. */
function extractErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
  return (
    e?.response?.data?.error ??
    e?.response?.data?.message ??
    e?.message ??
    'Something went wrong. Please try again.'
  );
}

export default function FeeStructuresPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [components, setComponents] = useState<Component[]>([emptyComponent()]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['fee-structures', page], queryFn: () => listFeeStructures(page, 20) });
  const { data: academicYears } = useQuery({ queryKey: ['academic-years-all'], queryFn: () => listAcademicYears(1, 100) });
  const { data: programmes } = useQuery({ queryKey: ['programmes-all'], queryFn: () => listProgrammes(1, 100) });
  const { data: branches } = useQuery({ queryKey: ['branches-all'], queryFn: () => listBranches(1, 100) });
  const { data: feeCategories } = useQuery({ queryKey: ['fee-categories-all'], queryFn: () => listFeeCategories(1, 100) });
  const { data: feeQuotas } = useQuery({ queryKey: ['fee-quotas-all'], queryFn: () => listFeeQuotas(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => {
      setSaveError(null);
      setForm({
        academicYearId: row.academicYearId?._id || row.academicYearId || '',
        programmeId: row.programmeId?._id || row.programmeId || '',
        branchId: row.branchId?._id || row.branchId || '',
        category: row.category || '',
        quota: row.quota || 'convener',
        year: String(row.year || ''),
      });
      if (row.components && row.components.length > 0) {
        setComponents(row.components.map((c: any) => ({ name: c.name || '', amount: String(c.amount || ''), isRefundable: !!c.isRefundable })));
      } else {
        setComponents([emptyComponent()]);
      }
    },
    onOpenCreate: () => {
      setSaveError(null);
      setForm(emptyForm);
      setComponents([emptyComponent()]);
    },
    onClose: () => {
      setSaveError(null);
      setForm(emptyForm);
      setComponents([emptyComponent()]);
    },
  });

  const createMut = useMutation({
    mutationFn: createFeeStructure,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-structures'] }); vem.close(); },
    onError: (err) => setSaveError(extractErrorMessage(err)),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateFeeStructure(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-structures'] }); vem.close(); },
    onError: (err) => setSaveError(extractErrorMessage(err)),
  });
  const deleteMut = useMutation({ mutationFn: deleteFeeStructure, onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-structures'] }); } });

  const totalAmount = components.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  function updateComponent(index: number, field: keyof Component, value: string | boolean) {
    setComponents(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }
  function addComponent() { setComponents(prev => [...prev, emptyComponent()]); }
  function removeComponent(index: number) { setComponents(prev => prev.filter((_, i) => i !== index)); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    const payload: any = {
      ...form,
      year: Number(form.year),
      totalAmount,
      components: components.map(c => ({ name: c.name, amount: Number(c.amount) || 0, isRefundable: c.isRefundable })),
    };
    if (!payload.branchId) delete payload.branchId;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'programmeId', label: 'Programme', render: (r: any) => <span className="font-medium text-navy">{r.programmeId?.name || '—'}</span> },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => <span>{r.academicYearId?.label || r.academicYearId?.code || '—'}</span> },
    { key: 'year', label: 'Year' },
    { key: 'quota', label: 'Quota', render: (r: any) => <Badge variant="info">{r.quota}</Badge> },
    { key: 'totalAmount', label: 'Total Amount', render: (r: any) => `₹${Number(r.totalAmount).toLocaleString()}` },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); vem.openForCopy(r); }} className="p-1 rounded hover:bg-blue-50" title="Copy as new"><Copy size={15} className="text-blue-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this fee structure?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Fee Structures</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Fee Structure
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Fee Structure')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && !vem.isView && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </div>
          )}
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Academic Year * {!vem.isView && <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select academic year</option>
                  {(academicYears?.items || []).map((item: any) => (
                    <option key={item._id} value={item._id}>{item.name || item.code || item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Programme * {!vem.isView && <Link to="/academics/programmes" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.programmeId} onChange={e => setForm(f => ({ ...f, programmeId: e.target.value }))} className={inp}>
                  <option value="">Select programme</option>
                  {(programmes?.items || []).map((item: any) => (
                    <option key={item._id} value={item._id}>{item.name || item.code || item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Branch {!vem.isView && <Link to="/academics/branches" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} className={inp}>
                  <option value="">None (optional)</option>
                  {(branches?.items || []).map((item: any) => (
                    <option key={item._id} value={item._id}>{item.name || item.code || item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Category * {!vem.isView && <Link to="/finance/fee-management/fee-categories" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                  <option value="">Select category</option>
                  {(feeCategories?.items || []).map((cat: any) => (
                    <option key={cat._id} value={cat.code}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>
                  Quota *
                  <Link to="/finance/fee-management/fee-quotas" target="_blank" className={manageLink}>
                    + Manage <ExternalLink size={10} />
                  </Link>
                </label>
                <select required value={form.quota} onChange={e => setForm(f => ({ ...f, quota: e.target.value }))} className={inp}>
                  <option value="">Select quota</option>
                  {(feeQuotas?.items ?? [])
                    .filter((q: { status?: string }) => q.status !== 'inactive')
                    .map((q: { _id: string; code: string; name: string }) => (
                      <option key={q._id} value={q.code}>{q.code} — {q.name}</option>
                    ))}
                </select>
              </div>
              <div><label className={lbl}>Year *</label><input required type="number" min={1} value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className={inp} /></div>
            </div>

            {/* Fee Components */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-800">Fee Components</label>
                {!vem.isView && (
                  <button type="button" onClick={addComponent} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                    <Plus size={14} /> Add Component
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {components.map((comp, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_120px_auto_auto] gap-2 items-center">
                    <input
                      required
                      value={comp.name}
                      onChange={e => updateComponent(idx, 'name', e.target.value)}
                      className={inp}
                      placeholder="Component name"
                    />
                    <input
                      required
                      type="number"
                      min={0}
                      value={comp.amount}
                      onChange={e => updateComponent(idx, 'amount', e.target.value)}
                      className={inp}
                      placeholder="Amount"
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={comp.isRefundable}
                        onChange={e => updateComponent(idx, 'isRefundable', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      Refundable
                    </label>
                    <button
                      type="button"
                      onClick={() => removeComponent(idx)}
                      disabled={components.length <= 1 || vem.isView}
                      className="p-1 rounded hover:bg-red-50 disabled:opacity-30"
                      title="Remove"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right text-sm font-semibold text-gray-700">
                Total Amount: <span className="text-navy">₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              {vem.isView ? 'Close' : 'Cancel'}
            </button>
            {vem.isView ? (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                <Pencil size={14} /> Edit
              </button>
            ) : (
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

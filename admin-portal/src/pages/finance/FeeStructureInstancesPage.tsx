import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ExternalLink, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { useAuthStore } from '../../stores/authStore';
import { listAcademicYears, listProgrammes, listBranches } from '../../services/academics';
import { listFeeCategories } from '../../services/fee-categories';
import { listFeeQuotas } from '../../services/fee-quotas';
import {
  listFeeStructureInstances,
  createFeeStructureInstance,
  updateFeeStructureInstance,
  deleteFeeStructureInstance,
  submitFeeStructureInstance,
  approveFeeStructureInstance,
  activateFeeStructureInstance,
  rejectFeeStructureInstance,
  archiveFeeStructureInstance,
  listFeeComponents,
  createFeeComponent,
  updateFeeComponent,
  deleteFeeComponent,
  previewMatchingFeeStructure,
  type PopulatedFeeStructureInstance,
  type FeeComponentType,
} from '../../services/fee-configuration';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const COMPONENT_TYPES: FeeComponentType[] = ['tuition', 'hostel', 'transport', 'lab', 'exam', 'library', 'development', 'caution_deposit', 'other'];

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'info',
  active: 'success',
  superseded: 'warning',
  archived: 'default',
  revision_required: 'danger',
};

interface CompRow {
  _id?: string;
  name: string;
  amount: string;
  componentType: FeeComponentType;
  isRefundable: boolean;
}
const emptyComp = (): CompRow => ({ name: '', amount: '', componentType: 'tuition', isRefundable: false });
const emptyForm = { academicYearId: '', programmeId: '', branchId: '', category: '', quota: '', yearOfStudy: '' };

/** Pull a human-readable message from an axios error / generic Error. */
function extractErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
  return e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Something went wrong. Please try again.';
}

/** Populated-or-string ref → id. */
function refId(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return (v as { _id?: string })._id ?? '';
}
/** Populated-or-string ref → display name. */
function refName(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const o = v as { name?: string; label?: string; code?: string };
  return o.name ?? o.label ?? o.code ?? '';
}

export default function FeeStructureInstancesPage() {
  const qc = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canWrite = hasPermission('finance', 'update');

  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [components, setComponents] = useState<CompRow[]>([emptyComp()]);
  const [originalComponents, setOriginalComponents] = useState<CompRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const listKey = ['fee-structure-instances-list', statusFilter];
  const { data: list, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => listFeeStructureInstances({ status: statusFilter || undefined, limit: 100 }),
  });

  const { data: academicYears } = useQuery({ queryKey: ['academic-years-all'], queryFn: () => listAcademicYears(1, 100) });
  const { data: programmes } = useQuery({ queryKey: ['programmes-all'], queryFn: () => listProgrammes(1, 100) });
  const { data: branches } = useQuery({ queryKey: ['branches-all'], queryFn: () => listBranches(1, 100) });
  const { data: feeCategories } = useQuery({ queryKey: ['fee-categories-all'], queryFn: () => listFeeCategories(1, 100) });
  const { data: feeQuotas } = useQuery({ queryKey: ['fee-quotas-all'], queryFn: () => listFeeQuotas(1, 100) });

  const vem = useViewEditMode<PopulatedFeeStructureInstance>({
    onOpenEntity: (row) => {
      setSaveError(null);
      setForm({
        academicYearId: refId(row.academicYearId),
        programmeId: refId(row.programmeId),
        branchId: refId(row.branchId),
        category: row.category ?? '',
        quota: row.quota ?? '',
        yearOfStudy: row.yearOfStudy != null ? String(row.yearOfStudy) : '',
      });
      setSelectedId(row._id);
      // components load via the effect below
      setComponents([]);
      setOriginalComponents([]);
    },
    onOpenCreate: () => {
      setSaveError(null);
      setForm(emptyForm);
      setSelectedId(null);
      setComponents([emptyComp()]);
      setOriginalComponents([]);
    },
    onClose: () => {
      setSaveError(null);
      setSelectedId(null);
    },
  });

  // Load an existing FSI's components when a row modal is open.
  const { data: existingComponents } = useQuery({
    queryKey: ['fsi-components', selectedId],
    queryFn: () => listFeeComponents(selectedId as string, 100),
    enabled: !!selectedId && vem.isOpen,
  });
  useEffect(() => {
    if (!selectedId || !existingComponents) return;
    const rows: CompRow[] = (existingComponents.items ?? []).map((c) => ({
      _id: c._id,
      name: c.name,
      amount: String(c.amount ?? ''),
      componentType: c.componentType,
      isRefundable: !!c.isRefundable,
    }));
    setComponents(rows.length > 0 ? rows : [emptyComp()]);
    setOriginalComponents(rows);
  }, [selectedId, existingComponents]);

  // Live preview: does an active FSI already occupy this slot? (activating
  // the one being authored would supersede it.)
  const { data: preview } = useQuery({
    queryKey: ['fsi-preview', form.programmeId, form.branchId, form.quota, form.category, form.yearOfStudy, form.academicYearId],
    queryFn: () =>
      previewMatchingFeeStructure({
        programmeId: form.programmeId,
        branchId: form.branchId || null,
        quota: form.quota || null,
        category: form.category || null,
        yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : undefined,
        academicYearId: form.academicYearId || undefined,
      }),
    enabled: vem.isOpen && !vem.isView && !!form.programmeId,
    staleTime: 15_000,
  });
  const existingActive = preview?.matched && preview.fsi && preview.fsi._id !== selectedId ? preview.fsi : null;

  const totalAmount = components.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  function afterMutation() {
    qc.invalidateQueries({ queryKey: ['fee-structure-instances-list'] });
    if (selectedId) qc.invalidateQueries({ queryKey: ['fsi-components', selectedId] });
    vem.close();
  }

  const createMut = useMutation({
    mutationFn: async () => {
      const fsi = await createFeeStructureInstance({
        academicYearId: form.academicYearId,
        programmeId: form.programmeId,
        branchId: form.branchId || undefined,
        category: form.category || undefined,
        quota: form.quota || undefined,
        yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : undefined,
        totalAmount,
      });
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        if (!c || !c.name.trim()) continue;
        await createFeeComponent({
          feeStructureInstanceId: fsi._id,
          name: c.name.trim(),
          amount: Number(c.amount) || 0,
          componentType: c.componentType,
          isRefundable: c.isRefundable,
          displayOrder: i,
        });
      }
      return fsi;
    },
    onSuccess: afterMutation,
    onError: (err) => setSaveError(extractErrorMessage(err)),
  });

  const editMut = useMutation({
    mutationFn: async (id: string) => {
      const keptIds = new Set(components.filter((c) => c._id).map((c) => c._id));
      for (const oc of originalComponents) {
        if (oc._id && !keptIds.has(oc._id)) await deleteFeeComponent(oc._id);
      }
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        if (!c || !c.name.trim()) continue;
        const body = {
          name: c.name.trim(),
          amount: Number(c.amount) || 0,
          componentType: c.componentType,
          isRefundable: c.isRefundable,
          displayOrder: i,
        };
        if (c._id) await updateFeeComponent(c._id, body);
        else await createFeeComponent({ feeStructureInstanceId: id, ...body });
      }
      await updateFeeStructureInstance(id, {
        academicYearId: form.academicYearId,
        programmeId: form.programmeId,
        branchId: form.branchId || null,
        category: form.category || null,
        quota: form.quota || null,
        yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : null,
      });
    },
    onSuccess: afterMutation,
    onError: (err) => setSaveError(extractErrorMessage(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFeeStructureInstance(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fee-structure-instances-list'] }),
    onError: (err) => alert(extractErrorMessage(err)),
  });

  const lifecycleMut = useMutation({
    mutationFn: async ({ id, action, comments }: { id: string; action: string; comments?: string }) => {
      switch (action) {
        case 'submit': return submitFeeStructureInstance(id);
        case 'approve': return approveFeeStructureInstance(id);
        case 'activate': return activateFeeStructureInstance(id);
        case 'reject': return rejectFeeStructureInstance(id, comments ?? '');
        case 'archive': return archiveFeeStructureInstance(id);
        default: throw new Error(`Unknown action ${action}`);
      }
    },
    onSuccess: afterMutation,
    onError: (err) => setSaveError(extractErrorMessage(err)),
  });

  const saving = createMut.isPending || editMut.isPending || lifecycleMut.isPending;

  function updateComponent(index: number, field: keyof CompRow, value: string | boolean) {
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }
  function addComponent() { setComponents((prev) => [...prev, emptyComp()]); }
  function removeComponent(index: number) { setComponents((prev) => prev.filter((_, i) => i !== index)); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    if (vem.isEdit && vem.entity) editMut.mutate(vem.entity._id);
    else createMut.mutate();
  }

  function runLifecycle(row: PopulatedFeeStructureInstance, action: string) {
    if (action === 'activate' && !confirm('Activate this fee structure? Any currently active structure for the exact same combination will be superseded.')) return;
    if (action === 'archive' && !confirm('Archive this fee structure?')) return;
    if (action === 'reject') {
      const comments = prompt('Reason for sending back for revision:');
      if (!comments) return;
      lifecycleMut.mutate({ id: row._id, action, comments });
      return;
    }
    lifecycleMut.mutate({ id: row._id, action });
  }

  const categoryOptions = (feeCategories?.items ?? []).map((c: { code: string; name: string }) => ({ value: c.code, label: c.name }));
  const quotaOptions = (feeQuotas?.items ?? [])
    .filter((q: { status?: string }) => q.status !== 'inactive')
    .map((q: { code: string; name: string }) => ({ value: q.code, label: `${q.code} — ${q.name}` }));

  const columns = [
    { key: 'programmeId', label: 'Programme', render: (r: PopulatedFeeStructureInstance) => <span className="font-medium text-navy">{refName(r.programmeId) || '—'}</span> },
    { key: 'branchId', label: 'Branch', render: (r: PopulatedFeeStructureInstance) => refName(r.branchId) ? <span className="text-gray-700">{refName(r.branchId)}</span> : <span className="text-gray-400 italic">any</span> },
    { key: 'yearOfStudy', label: 'Year', render: (r: PopulatedFeeStructureInstance) => (r.yearOfStudy != null ? <span>{r.yearOfStudy}</span> : <span className="text-gray-400 italic">any</span>) },
    { key: 'quota', label: 'Quota', render: (r: PopulatedFeeStructureInstance) => (r.quota ? <Badge variant="info">{r.quota}</Badge> : <span className="text-gray-400 italic">any</span>) },
    { key: 'category', label: 'Category', render: (r: PopulatedFeeStructureInstance) => r.category ?? <span className="text-gray-400 italic">any</span> },
    { key: 'academicYearId', label: 'Academic Year', render: (r: PopulatedFeeStructureInstance) => <span>{refName(r.academicYearId) || '—'}</span> },
    { key: 'totalAmount', label: 'Total', render: (r: PopulatedFeeStructureInstance) => `₹${Number(r.totalAmount ?? 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (r: PopulatedFeeStructureInstance) => <Badge variant={STATUS_VARIANT[r.status ?? 'draft'] ?? 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: PopulatedFeeStructureInstance) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForView(r); }} className="p-1 rounded hover:bg-gray-100" title="View / actions"><Eye size={15} className="text-gray-500" /></button>
        {canWrite && r.status === 'draft' && (
          <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        )}
        {canWrite && r.status === 'draft' && (
          <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this draft fee structure?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete draft"><Trash2 size={15} className="text-red-500" /></button>
        )}
      </div>
    ) },
  ];

  // Lifecycle buttons available for a given status.
  function lifecycleActions(row: PopulatedFeeStructureInstance): { action: string; label: string; className: string }[] {
    const btn = 'px-3 py-1.5 rounded-lg text-sm font-medium';
    switch (row.status) {
      case 'draft': return [{ action: 'submit', label: 'Submit for approval', className: `${btn} bg-blue-600 text-white hover:bg-blue-700` }];
      case 'submitted': return [
        { action: 'approve', label: 'Approve', className: `${btn} bg-green-600 text-white hover:bg-green-700` },
        { action: 'reject', label: 'Send back', className: `${btn} border border-red-300 text-red-700 hover:bg-red-50` },
      ];
      case 'approved': return [{ action: 'activate', label: 'Activate', className: `${btn} bg-primary-600 text-white hover:bg-primary-700` }];
      case 'revision_required': return [];
      case 'active':
      case 'superseded': return [{ action: 'archive', label: 'Archive', className: `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50` }];
      default: return [];
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-navy">Fee Structures</h2>
          <p className="text-sm text-gray-500">Author, approve and activate the fee structures students are pinned to.</p>
        </div>
        {canWrite && (
          <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> New Fee Structure
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-gray-600">Status</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">All</option>
          {['draft', 'submitted', 'approved', 'active', 'superseded', 'archived', 'revision_required'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={list?.items ?? []}
        loading={isLoading}
        rowKey={(r: PopulatedFeeStructureInstance) => r._id}
        onRowClick={vem.openForView}
        emptyMessage="No fee structures yet. Create one, then submit → approve → activate to make it live."
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Fee Structure')} widthClass="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && !vem.isView && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>
          )}

          {vem.isView && vem.entity && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Status:</span>
              <Badge variant={STATUS_VARIANT[vem.entity.status ?? 'draft'] ?? 'default'}>{vem.entity.status}</Badge>
            </div>
          )}

          {existingActive && !vem.isView && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              An <b>active</b> fee structure already exists for this exact combination
              {existingActive.name ? `: ${existingActive.name}` : ''} (₹{Number(existingActive.totalAmount ?? 0).toLocaleString()}).
              Activating this one will supersede it.
            </div>
          )}

          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Academic Year * {!vem.isView && <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.academicYearId} onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select academic year</option>
                  {(academicYears?.items ?? []).map((item: { _id: string; name?: string; code?: string; label?: string }) => (
                    <option key={item._id} value={item._id}>{item.name ?? item.code ?? item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Programme * {!vem.isView && <Link to="/academics/programmes" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.programmeId} onChange={(e) => setForm((f) => ({ ...f, programmeId: e.target.value }))} className={inp}>
                  <option value="">Select programme</option>
                  {(programmes?.items ?? []).map((item: { _id: string; name?: string; code?: string }) => (
                    <option key={item._id} value={item._id}>{item.name ?? item.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Branch {!vem.isView && <Link to="/academics/branches" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))} className={inp}>
                  <option value="">Any branch (wildcard)</option>
                  {(branches?.items ?? []).map((item: { _id: string; name?: string; code?: string }) => (
                    <option key={item._id} value={item._id}>{item.name ?? item.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Year of Study</label>
                <select value={form.yearOfStudy} onChange={(e) => setForm((f) => ({ ...f, yearOfStudy: e.target.value }))} className={inp}>
                  <option value="">Any year (wildcard)</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Category {!vem.isView && <Link to="/finance/fee-management/fee-categories" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inp}>
                  <option value="">Any category (wildcard)</option>
                  {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Quota {!vem.isView && <Link to="/finance/fee-management/fee-quotas" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.quota} onChange={(e) => setForm((f) => ({ ...f, quota: e.target.value }))} className={inp}>
                  <option value="">Any quota (wildcard)</option>
                  {quotaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Fee Components */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-gray-800">Fee Components</label>
                {!vem.isView && (
                  <button type="button" onClick={addComponent} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                    <Plus size={14} /> Add Component
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-3">Optional per-student charges like hostel/transport aren't billed per-student yet — model those via separate quota/category structures for now.</p>
              <div className="space-y-2">
                {components.map((comp, idx) => (
                  <div key={comp._id ?? idx} className="grid grid-cols-[1fr_130px_110px_auto_auto] gap-2 items-center">
                    <input required value={comp.name} onChange={(e) => updateComponent(idx, 'name', e.target.value)} className={inp} placeholder="Component name" />
                    <select value={comp.componentType} onChange={(e) => updateComponent(idx, 'componentType', e.target.value)} className={inp}>
                      {COMPONENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input required type="number" min={0} value={comp.amount} onChange={(e) => updateComponent(idx, 'amount', e.target.value)} className={inp} placeholder="Amount" />
                    <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                      <input type="checkbox" checked={comp.isRefundable} onChange={(e) => updateComponent(idx, 'isRefundable', e.target.checked)} className="rounded border-gray-300" />
                      Refundable
                    </label>
                    <button type="button" onClick={() => removeComponent(idx)} disabled={components.length <= 1 || vem.isView} className="p-1 rounded hover:bg-red-50 disabled:opacity-30" title="Remove">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right text-sm font-semibold text-gray-700">
                Total: <span className="text-navy">₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </fieldset>

          {/* Footer */}
          <div className="flex justify-between items-center gap-3 pt-2 border-t">
            <div className="flex gap-2">
              {vem.isView && vem.entity && canWrite && lifecycleActions(vem.entity).map((a) => (
                <button key={a.action} type="button" disabled={saving} onClick={() => runLifecycle(vem.entity as PopulatedFeeStructureInstance, a.action)} className={`${a.className} disabled:opacity-50`}>
                  {a.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                {vem.isView ? 'Close' : 'Cancel'}
              </button>
              {vem.isView ? (
                canWrite && vem.entity?.status === 'draft' && (
                  <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                    <Pencil size={14} /> Edit
                  </button>
                )
              ) : (
                <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                  {saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create draft'}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

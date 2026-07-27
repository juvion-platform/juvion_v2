import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAccreditationCycles, listComplianceCriteria, createComplianceCriteria, updateComplianceCriteria, deleteComplianceCriteria } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import EntityPicker from '../../components/ui/EntityPicker';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUSES = ['not_started', 'in_progress', 'submitted', 'reviewed'] as const;
const STATUS_COLOR: Record<string, string> = { not_started: 'default', in_progress: 'warning', submitted: 'info', reviewed: 'success' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = {
  accreditationCycleId: '', criterionNumber: '', title: '',
  maxScore: 0, selfScore: '', peerScore: '', status: 'not_started' as string,
};

export default function ComplianceCriteriaPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['compliance-criteria', page, limit, search], queryFn: () => listComplianceCriteria(page, limit, undefined, undefined, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      accreditationCycleId: row.accreditationCycleId?._id || row.accreditationCycleId || '',
      criterionNumber: row.criterionNumber || '',
      title: row.title || '',
      maxScore: row.maxScore || 0,
      selfScore: row.selfScore?.toString() || '',
      peerScore: row.peerScore?.toString() || '',
      status: row.status || 'not_started',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createComplianceCriteria, onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-criteria'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateComplianceCriteria(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-criteria'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteComplianceCriteria, onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-criteria'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, maxScore: Number(form.maxScore) };
    if (form.selfScore) payload.selfScore = Number(form.selfScore); else delete payload.selfScore;
    if (form.peerScore) payload.peerScore = Number(form.peerScore); else delete payload.peerScore;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'criterionNumber', label: 'Criterion #', render: (r: any) => <span className="font-semibold text-navy">{r.criterionNumber}</span> },
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium">{r.title}</span> },
    { key: 'maxScore', label: 'Max Score', render: (r: any) => r.maxScore },
    { key: 'selfScore', label: 'Self Score', render: (r: any) => r.selfScore ?? '\u2014' },
    { key: 'peerScore', label: 'Peer Score', render: (r: any) => r.peerScore ?? '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this criterion?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Compliance Criteria</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search compliance criteria…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Criterion
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No compliance criteria match “${search}”.` : 'No compliance criteria yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Criterion')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl} htmlFor="criteria-cycle">Accreditation Cycle *</label>
                <EntityPicker
                  id="criteria-cycle"
                  required
                  disabled={vem.isView}
                  queryKey={['accreditation-cycles', 'picker']}
                  fetcher={(q) => listAccreditationCycles(1, 20, q || undefined)}
                  value={form.accreditationCycleId}
                  onChange={(v) => setForm(f => ({ ...f, accreditationCycleId: v }))}
                  getId={(x: any) => x._id}
                  getLabel={(c: any) => c.name || c.cycleNumber || c._id}
                  getHint={(c: any) => c.status || undefined}
                  fallbackLabel={vem.entity?.accreditationCycleId?.name}
                  placeholder="Search accreditation cycle"
                />
              </div>
              <div><label className={lbl}>Criterion Number *</label>
                <input required value={form.criterionNumber} onChange={e => setForm(f => ({ ...f, criterionNumber: e.target.value }))} className={inp} placeholder="e.g. 1.1.1" />
              </div>
              <div className="col-span-2"><label className={lbl}>Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Max Score *</label>
                <input required type="number" min={0} value={form.maxScore} onChange={e => setForm(f => ({ ...f, maxScore: Number(e.target.value) }))} className={inp} />
              </div>
              <div><label className={lbl}>Self Score</label>
                <input type="number" min={0} value={form.selfScore} onChange={e => setForm(f => ({ ...f, selfScore: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Peer Score</label>
                <input type="number" min={0} value={form.peerScore} onChange={e => setForm(f => ({ ...f, peerScore: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
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

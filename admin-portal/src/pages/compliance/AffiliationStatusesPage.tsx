import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAffiliationStatuses, createAffiliationStatus, updateAffiliationStatus, deleteAffiliationStatus } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUSES = ['active', 'expired', 'renewal_pending', 'revoked'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'success', expired: 'danger', renewal_pending: 'warning', revoked: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = {
  universityName: '', affiliationNumber: '', validFrom: '', validTo: '', status: 'active' as string,
};

export default function AffiliationStatusesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['affiliation-statuses', page, limit, search], queryFn: () => listAffiliationStatuses(page, limit, undefined, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      universityName: row.universityName || '',
      affiliationNumber: row.affiliationNumber || '',
      validFrom: row.validFrom?.slice(0, 10) || '',
      validTo: row.validTo?.slice(0, 10) || '',
      status: row.status || 'active',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createAffiliationStatus, onSuccess: () => { qc.invalidateQueries({ queryKey: ['affiliation-statuses'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateAffiliationStatus(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['affiliation-statuses'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteAffiliationStatus, onSuccess: () => { qc.invalidateQueries({ queryKey: ['affiliation-statuses'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!form.affiliationNumber) delete payload.affiliationNumber;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'universityName', label: 'University', render: (r: any) => <span className="font-medium text-navy">{r.universityName}</span> },
    { key: 'affiliationNumber', label: 'Affiliation #', render: (r: any) => r.affiliationNumber || '\u2014' },
    { key: 'validFrom', label: 'Valid From', render: (r: any) => r.validFrom ? new Date(r.validFrom).toLocaleDateString() : '\u2014' },
    { key: 'validTo', label: 'Valid To', render: (r: any) => r.validTo ? new Date(r.validTo).toLocaleDateString() : '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this affiliation?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Affiliation Statuses</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search affiliation statuses…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Affiliation
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No affiliation statuses match “${search}”.` : 'No affiliation statuses yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Affiliation')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className={lbl}>University Name *</label>
                <input required value={form.universityName} onChange={e => setForm(f => ({ ...f, universityName: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Affiliation Number</label>
                <input value={form.affiliationNumber} onChange={e => setForm(f => ({ ...f, affiliationNumber: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Valid From *</label>
                <input required type="date" value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Valid To *</label>
                <input required type="date" value={form.validTo} onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))} className={inp} />
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

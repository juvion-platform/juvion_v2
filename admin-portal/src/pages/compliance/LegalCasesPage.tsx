import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLegalCases, createLegalCase, updateLegalCase, deleteLegalCase } from '../../services/compliance';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const CASE_TYPES = ['civil', 'criminal', 'consumer', 'labour', 'writ', 'other'] as const;
const STATUSES = ['active', 'hearing', 'stayed', 'disposed', 'closed'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'danger', hearing: 'warning', stayed: 'info', disposed: 'success', closed: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = {
  caseNumber: '', courtName: '', caseType: 'civil' as string,
  filedDate: '', opposingParty: '', description: '',
  lawyerName: '', nextHearingDate: '', status: 'active' as string, outcome: '',
};

export default function LegalCasesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['legal-cases', page, limit, search], queryFn: () => listLegalCases(page, limit, undefined, undefined, search) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      caseNumber: row.caseNumber || '',
      courtName: row.courtName || '',
      caseType: row.caseType || 'civil',
      filedDate: row.filedDate?.slice(0, 10) || '',
      opposingParty: row.opposingParty || '',
      description: row.description || '',
      lawyerName: row.lawyerName || '',
      nextHearingDate: row.nextHearingDate?.slice(0, 10) || '',
      status: row.status || 'active',
      outcome: row.outcome || '',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createLegalCase, onSuccess: () => { qc.invalidateQueries({ queryKey: ['legal-cases'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateLegalCase(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['legal-cases'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteLegalCase, onSuccess: () => { qc.invalidateQueries({ queryKey: ['legal-cases'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!form.description) delete payload.description;
    if (!form.lawyerName) delete payload.lawyerName;
    if (!form.nextHearingDate) delete payload.nextHearingDate;
    if (!form.outcome) delete payload.outcome;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'caseNumber', label: 'Case #', render: (r: any) => <span className="font-semibold text-navy">{r.caseNumber}</span> },
    { key: 'courtName', label: 'Court', render: (r: any) => r.courtName },
    { key: 'caseType', label: 'Type', render: (r: any) => <Badge variant="info">{r.caseType}</Badge> },
    { key: 'opposingParty', label: 'Opposing Party', render: (r: any) => r.opposingParty },
    { key: 'filedDate', label: 'Filed', render: (r: any) => r.filedDate ? new Date(r.filedDate).toLocaleDateString() : '\u2014' },
    { key: 'nextHearingDate', label: 'Next Hearing', render: (r: any) => r.nextHearingDate ? new Date(r.nextHearingDate).toLocaleDateString() : '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this case?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Legal Cases</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search legal cases…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Case
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No legal cases match “${search}”.` : 'No legal cases yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Legal Case')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Case Number *</label>
                <input required value={form.caseNumber} onChange={e => setForm(f => ({ ...f, caseNumber: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Court Name *</label>
                <input required value={form.courtName} onChange={e => setForm(f => ({ ...f, courtName: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Case Type *</label>
                <select required value={form.caseType} onChange={e => setForm(f => ({ ...f, caseType: e.target.value }))} className={inp}>
                  {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Filed Date *</label>
                <input required type="date" value={form.filedDate} onChange={e => setForm(f => ({ ...f, filedDate: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Opposing Party *</label>
                <input required value={form.opposingParty} onChange={e => setForm(f => ({ ...f, opposingParty: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Lawyer Name</label>
                <input value={form.lawyerName} onChange={e => setForm(f => ({ ...f, lawyerName: e.target.value }))} className={inp} />
              </div>
              <div className="col-span-2"><label className={lbl}>Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Next Hearing Date</label>
                <input type="date" value={form.nextHearingDate} onChange={e => setForm(f => ({ ...f, nextHearingDate: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Status *</label>
                <select required value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Outcome</label>
                <input value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))} className={inp} />
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

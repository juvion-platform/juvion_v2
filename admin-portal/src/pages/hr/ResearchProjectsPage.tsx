import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listResearchProjects, createResearchProject, updateResearchProject, deleteResearchProject } from '../../services/hr';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';

const STATUSES = ['proposed', 'sanctioned', 'ongoing', 'completed', 'terminated'] as const;
const STATUS_COLOR: Record<string, string> = { proposed: 'default', sanctioned: 'info', ongoing: 'success', completed: 'success', terminated: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

const emptyForm = {
  title: '', principalInvestigatorId: '', fundingAgency: '', sanctionedAmount: '',
  startDate: '', endDate: '', status: 'proposed' as string,
};

export default function ResearchProjectsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['research-projects', page], queryFn: () => listResearchProjects(page, 20) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      title: row.title || '',
      principalInvestigatorId: row.principalInvestigatorId?._id || row.principalInvestigatorId || '',
      fundingAgency: row.fundingAgency || '',
      sanctionedAmount: row.sanctionedAmount != null ? String(row.sanctionedAmount) : '',
      startDate: row.startDate ? row.startDate.slice(0, 10) : '',
      endDate: row.endDate ? row.endDate.slice(0, 10) : '',
      status: row.status || 'proposed',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createResearchProject, onSuccess: () => { qc.invalidateQueries({ queryKey: ['research-projects'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateResearchProject(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['research-projects'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteResearchProject, onSuccess: () => { qc.invalidateQueries({ queryKey: ['research-projects'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (form.sanctionedAmount) payload.sanctionedAmount = Number(form.sanctionedAmount);
    else delete payload.sanctionedAmount;
    if (!form.fundingAgency) delete payload.fundingAgency;
    if (!form.endDate) delete payload.endDate;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'principalInvestigatorId', label: 'PI', render: (r: any) => <span>{r.principalInvestigatorId?.personId?.name || '\u2014'}</span> },
    { key: 'fundingAgency', label: 'Funding Agency', render: (r: any) => r.fundingAgency || '\u2014' },
    { key: 'sanctionedAmount', label: 'Amount', render: (r: any) => `\u20B9${Number(r.sanctionedAmount || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this research project?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Research Projects</h2>
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Research Project
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Research Project')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className={lbl}>Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>PI Faculty ID *</label>
                <input required value={form.principalInvestigatorId} onChange={e => setForm(f => ({ ...f, principalInvestigatorId: e.target.value }))} className={inp} placeholder="PI Faculty ID" />
              </div>
              <div><label className={lbl}>Funding Agency</label>
                <input value={form.fundingAgency} onChange={e => setForm(f => ({ ...f, fundingAgency: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Sanctioned Amount</label>
                <input type="number" min={0} value={form.sanctionedAmount} onChange={e => setForm(f => ({ ...f, sanctionedAmount: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>Start Date *</label>
                <input type="date" required value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} />
              </div>
              <div><label className={lbl}>End Date</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inp} />
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

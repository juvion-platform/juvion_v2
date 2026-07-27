import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listOffers, createOffer, updateOffer, listApplicants } from '../../services/admissions';
import { listProgrammes, listBranches } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, ExternalLink } from 'lucide-react';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const STATUS_COLOR: Record<string, string> = { offered: 'info', accepted: 'success', declined: 'danger', lapsed: 'default' };
const STATUSES = ['offered', 'accepted', 'declined', 'lapsed'] as const;

const emptyForm = { applicantId: '', programmeId: '', branchId: '', feeQuoted: '', validityDate: '', status: 'offered' };

export default function OffersPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search } = useListControls();
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['offers', page, filterStatus, limit, search],
    queryFn: () => listOffers(page, limit, filterStatus || undefined, search),
  });

  const { data: applicantsData } = useQuery({ queryKey: ['applicants-all'], queryFn: () => listApplicants(1, 200) });
  const { data: programmesData } = useQuery({ queryKey: ['programmes-all'], queryFn: () => listProgrammes(1, 100) });
  const { data: branchesData } = useQuery({ queryKey: ['branches-all'], queryFn: () => listBranches(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      applicantId: row.applicantId?._id || row.applicantId || '',
      programmeId: row.programmeId?._id || row.programmeId || '',
      branchId: row.branchId?._id || row.branchId || '',
      feeQuoted: String(row.feeQuoted ?? ''),
      validityDate: row.validityDate?.slice(0, 10) || '',
      status: row.status || 'offered',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createOffer, onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateOffer(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers'] }); vem.close(); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, feeQuoted: Number(form.feeQuoted), branchId: form.branchId || undefined };
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'feeQuoted', label: 'Fee Quoted', render: (r: any) => `₹${Number(r.feeQuoted).toLocaleString('en-IN')}` },
    { key: 'validityDate', label: 'Valid Until', render: (r: any) => new Date(r.validityDate).toLocaleDateString() },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]}>{r.status}</Badge> },
    { key: 'createdAt', label: 'Created', render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'actions', label: '', render: (r: any) => (
      <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500" /></button>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">Admission Offers</h2>
        <div className="flex gap-3">
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> New Offer
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Admission Offer')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Applicant *
                  {!vem.isView && <Link to="/admissions/applicants" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>}
                </label>
                <select required value={form.applicantId} onChange={e => setForm(f => ({ ...f, applicantId: e.target.value }))} className={inp}>
                  <option value="">Select applicant...</option>
                  {(applicantsData?.items || []).map((a: any) => (
                    <option key={a._id} value={a._id}>{a.name || a.email || a._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Programme *
                  {!vem.isView && <Link to="/academics/programmes" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>}
                </label>
                <select required value={form.programmeId} onChange={e => setForm(f => ({ ...f, programmeId: e.target.value }))} className={inp}>
                  <option value="">Select programme...</option>
                  {(programmesData?.items || []).map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name || p.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Branch
                  {!vem.isView && <Link to="/academics/branches" className={manageLink}>+ Manage <ExternalLink size={11} /></Link>}
                </label>
                <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))} className={inp}>
                  <option value="">None</option>
                  {(branchesData?.items || []).map((b: any) => (
                    <option key={b._id} value={b._id}>{b.name || b.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fee Quoted (₹) *</label>
                <input required type="number" value={form.feeQuoted} onChange={e => setForm(f => ({ ...f, feeQuoted: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valid Until *</label>
                <input required type="date" value={form.validityDate} onChange={e => setForm(f => ({ ...f, validityDate: e.target.value }))} className={inp} />
              </div>
              {(vem.isEdit || vem.isView) && (
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
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

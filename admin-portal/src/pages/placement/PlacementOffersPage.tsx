import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPlacementOffers, createPlacementOffer, updatePlacementOffer, deletePlacementOffer, listJobPostings, listCompanies } from '../../services/placement';
import { listStudents } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const STATUSES = ['offered', 'accepted', 'declined', 'revoked'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { jobPostingId: '', studentId: '', companyId: '', packageLpa: '', offerDate: '', joiningDate: '', offerLetterUrl: '', status: 'offered' };

export default function PlacementOffersPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['placement-offers', page, limit, search], queryFn: () => listPlacementOffers(page, limit, undefined, search) });
  const { data: jobPostings } = useQuery({ queryKey: ['job-postings-all'], queryFn: () => listJobPostings(1, 200) });
  const { data: companies } = useQuery({ queryKey: ['companies-all'], queryFn: () => listCompanies(1, 200) });
  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => listStudents(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      jobPostingId: row.jobPostingId?._id || row.jobPostingId || '',
      studentId: row.studentId?._id || row.studentId || '',
      companyId: row.companyId?._id || row.companyId || '',
      packageLpa: String(row.packageLpa || ''),
      offerDate: row.offerDate ? row.offerDate.slice(0, 10) : '',
      joiningDate: row.joiningDate ? row.joiningDate.slice(0, 10) : '',
      offerLetterUrl: row.offerLetterUrl || '',
      status: row.status || 'offered',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createPlacementOffer, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-offers'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updatePlacementOffer(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-offers'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deletePlacementOffer, onSuccess: () => { qc.invalidateQueries({ queryKey: ['placement-offers'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, packageLpa: Number(form.packageLpa) };
    if (!payload.joiningDate) delete payload.joiningDate;
    if (!payload.offerLetterUrl) delete payload.offerLetterUrl;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const statusVariant: Record<string, string> = { offered: 'info', accepted: 'success', declined: 'warning', revoked: 'danger' };

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '--' },
    { key: 'companyId', label: 'Company', render: (r: any) => r.companyId?.name || '--' },
    { key: 'packageLpa', label: 'Package (LPA)', render: (r: any) => `${r.packageLpa} LPA` },
    { key: 'offerDate', label: 'Offer Date', render: (r: any) => r.offerDate ? new Date(r.offerDate).toLocaleDateString() : '--' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={statusVariant[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this offer?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Placement Offers</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search placement offers…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} className="text-white" /> New Offer</button>
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
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Offer')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Job Posting * {!vem.isView && <Link to="/placement/job-postings" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.jobPostingId} onChange={e => setForm(f => ({ ...f, jobPostingId: e.target.value }))} className={inp}>
                  <option value="">Select job posting</option>
                  {(jobPostings?.items || []).map((j: any) => <option key={j._id} value={j._id}>{j.role + ' - ' + (j.companyId?.name || '')}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people/students" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Company * {!vem.isView && <Link to="/placement/companies" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} className={inp}>
                  <option value="">Select company</option>
                  {(companies?.items || []).map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Package (LPA) *</label><input required type="number" step="0.01" min={0} value={form.packageLpa} onChange={e => setForm(f => ({ ...f, packageLpa: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Offer Date *</label><input required type="date" value={form.offerDate} onChange={e => setForm(f => ({ ...f, offerDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Joining Date</label><input type="date" value={form.joiningDate} onChange={e => setForm(f => ({ ...f, joiningDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Offer Letter URL</label><input value={form.offerLetterUrl} onChange={e => setForm(f => ({ ...f, offerLetterUrl: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
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

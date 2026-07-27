import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRecruitments, createRecruitment, updateRecruitment, deleteRecruitment } from '../../services/hr';
import { listDepartments } from '../../services/academics';
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

const STATUSES = ['open', 'closed', 'on_hold', 'filled'] as const;
const STATUS_COLOR: Record<string, string> = { open: 'success', closed: 'default', on_hold: 'warning', filled: 'info' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { position: '', departmentId: '', vacancies: '', qualifications: '', experience: '', salary: '', lastDate: '', status: 'open' };

export default function RecruitmentsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['recruitments', page, limit, search], queryFn: () => listRecruitments(page, limit, undefined, search) });
  const { data: departments } = useQuery({ queryKey: ['departments', 'all'], queryFn: () => listDepartments(1, 100) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      position: row.position || '',
      departmentId: row.departmentId?._id || row.departmentId || '',
      vacancies: String(row.vacancies || ''),
      qualifications: row.qualifications || '',
      experience: row.experience || '',
      salary: row.salary || '',
      lastDate: row.lastDate ? row.lastDate.slice(0, 10) : '',
      status: row.status || 'open',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createRecruitment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitments'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateRecruitment(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitments'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteRecruitment, onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitments'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, vacancies: Number(form.vacancies) };
    if (!payload.experience) delete payload.experience;
    if (!payload.salary) delete payload.salary;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'position', label: 'Position', render: (r: any) => <span className="font-medium text-navy">{r.position}</span> },
    { key: 'departmentId', label: 'Department', render: (r: any) => r.departmentId?.name || '—' },
    { key: 'vacancies', label: 'Vacancies', render: (r: any) => r.vacancies },
    { key: 'lastDate', label: 'Last Date', render: (r: any) => r.lastDate ? new Date(r.lastDate).toLocaleDateString() : '-' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this recruitment?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Recruitments</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search recruitments…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Recruitment
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No recruitments match “${search}”.` : 'No recruitments yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Recruitment')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Position *</label><input required value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className={inp} /></div>
              <div>
                <label className={lbl}>Department * {!vem.isView && <Link to="/academics/departments" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className={inp}>
                  <option value="">Select department</option>
                  {(departments?.items || []).map((d: any) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Vacancies *</label><input required type="number" min={1} value={form.vacancies} onChange={e => setForm(f => ({ ...f, vacancies: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Qualifications *</label><input required value={form.qualifications} onChange={e => setForm(f => ({ ...f, qualifications: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Experience</label><input value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Salary</label><input value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Last Date *</label><input required type="date" value={form.lastDate} onChange={e => setForm(f => ({ ...f, lastDate: e.target.value }))} className={inp} /></div>
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

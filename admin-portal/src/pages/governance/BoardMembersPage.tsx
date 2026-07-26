import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBoardMembers, createBoardMember, updateBoardMember, deleteBoardMember } from '../../services/governance';
import { listPersons } from '../../services/people';
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

const ROLES = ['chairperson', 'secretary', 'member', 'nominee', 'invitee'] as const;
const ROLE_COLOR: Record<string, string> = { chairperson: 'warning', secretary: 'info', member: 'default', nominee: 'success', invitee: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { personId: '', externalName: '', designation: '', role: 'member', appointedDate: '', tenure: '', isActive: true };

export default function BoardMembersPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['gov-board', page, limit, search], queryFn: () => listBoardMembers(page, limit, undefined, search) });
  const { data: persons } = useQuery({ queryKey: ['persons', 'all'], queryFn: () => listPersons(1, 200) });

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      personId: row.personId?._id || row.personId || '',
      externalName: row.externalName || '',
      designation: row.designation || '',
      role: row.role || 'member',
      appointedDate: row.appointedDate ? row.appointedDate.slice(0, 10) : '',
      tenure: row.tenure != null ? String(row.tenure) : '',
      isActive: row.isActive !== false,
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createBoardMember, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-board'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateBoardMember(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-board'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteBoardMember, onSuccess: () => { qc.invalidateQueries({ queryKey: ['gov-board'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.personId) delete payload.personId;
    if (!payload.externalName) delete payload.externalName;
    if (form.tenure) payload.tenure = Number(form.tenure);
    else delete payload.tenure;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';
  const getName = (r: any) => r.personId?.name || r.externalName || '\u2014';

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{getName(r)}</span> },
    { key: 'designation', label: 'Designation' },
    { key: 'role', label: 'Role', render: (r: any) => <Badge variant={(ROLE_COLOR[r.role] || 'default') as any}>{r.role}</Badge> },
    { key: 'appointedDate', label: 'Appointed', render: (r: any) => fmtDate(r.appointedDate) },
    { key: 'tenure', label: 'Tenure (yrs)', render: (r: any) => r.tenure != null ? `${r.tenure}` : '\u2014' },
    { key: 'isActive', label: 'Active', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Yes' : 'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this member?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Governing Body Members</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search governing body members…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Member
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

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Board Member')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Person (internal) {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select value={form.personId} onChange={e => setForm(f => ({ ...f, personId: e.target.value }))} className={inp}>
                  <option value="">Select person</option>
                  {(persons?.items || []).map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name || p._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>External Name</label><input value={form.externalName} onChange={e => setForm(f => ({ ...f, externalName: e.target.value }))} className={inp} placeholder="For external members" /></div>
              <div><label className={lbl}>Designation *</label><input required value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Role *</label>
                <select required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Appointed Date *</label><input required type="date" value={form.appointedDate} onChange={e => setForm(f => ({ ...f, appointedDate: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Tenure (years)</label><input type="number" min={0} value={form.tenure} onChange={e => setForm(f => ({ ...f, tenure: e.target.value }))} className={inp} /></div>
              <div>
                <label className={lbl}>Active</label>
                <select value={String(form.isActive)} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))} className={inp}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
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

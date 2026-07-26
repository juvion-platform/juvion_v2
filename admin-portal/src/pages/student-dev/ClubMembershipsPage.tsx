import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listClubMemberships, createClubMembership, updateClubMembership, deleteClubMembership, listClubs } from '../../services/student-dev';
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

const ROLES = ['member', 'secretary', 'president', 'treasurer', 'lead'] as const;
const STATUSES = ['active', 'inactive'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'success', inactive: 'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { clubId: '', studentId: '', role: 'member', joinedDate: '', status: 'active' };

export default function ClubMembershipsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      clubId: row.clubId?._id || row.clubId || '',
      studentId: row.studentId?._id || row.studentId || '',
      role: row.role || 'member',
      joinedDate: row.joinedDate ? row.joinedDate.slice(0, 10) : '',
      status: row.status || 'active',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const { data, isLoading } = useQuery({ queryKey: ['sd-club-memberships', page, limit, search], queryFn: () => listClubMemberships(page, limit, undefined, undefined, search) });
  const { data: clubs } = useQuery({ queryKey: ['sd-clubs', 'all'], queryFn: () => listClubs(1, 200) });
  const { data: students } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });

  const createMut = useMutation({ mutationFn: createClubMembership, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-club-memberships'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateClubMembership(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-club-memberships'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteClubMembership, onSuccess: () => { qc.invalidateQueries({ queryKey: ['sd-club-memberships'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.joinedDate) delete payload.joinedDate;
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '\u2014';

  const columns = [
    { key: 'clubId', label: 'Club', render: (r: any) => <span className="font-medium text-navy">{r.clubId?.name || '\u2014'}</span> },
    { key: 'studentId', label: 'Student', render: (r: any) => r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014' },
    { key: 'role', label: 'Role', render: (r: any) => <Badge variant="info">{r.role}</Badge> },
    { key: 'joinedDate', label: 'Joined', render: (r: any) => fmtDate(r.joinedDate) },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={(STATUS_COLOR[r.status] || 'default') as any}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this membership?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Club Memberships</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search club memberships…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Membership
        </button>
      </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView} />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Membership')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Club * {!vem.isView && <Link to="/student-dev/clubs" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.clubId} onChange={e => setForm(f => ({ ...f, clubId: e.target.value }))} className={inp}>
                  <option value="">Select club</option>
                  {(clubs?.items || []).map((c: any) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student</option>
                  {(students?.items || []).map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div><label className={lbl}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Joined Date</label><input type="date" value={form.joinedDate} onChange={e => setForm(f => ({ ...f, joinedDate: e.target.value }))} className={inp} /></div>
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
                {saving ? 'Saving\u2026' : vem.isEdit ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

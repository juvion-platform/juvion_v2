import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTransportAllocations, createTransportAllocation, updateTransportAllocation, deleteTransportAllocation, listTransportRoutes } from '../../services/welfare';
import { listStudents } from '../../services/people';
import { listAcademicYears } from '../../services/academics';
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

const STATUSES = ['active', 'cancelled'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'success', cancelled: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { studentId: '', routeId: '', stopName: '', academicYearId: '', status: 'active' };

export default function TransportAllocationsPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['transport-allocations', page, limit, search], queryFn: () => listTransportAllocations(page, limit, undefined, undefined, search) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: routesData } = useQuery({ queryKey: ['transport-routes', 'all'], queryFn: () => listTransportRoutes(1, 100) });
  const { data: ayData } = useQuery({ queryKey: ['academicYears', 'all'], queryFn: () => listAcademicYears(1, 100) });

  const students = studentsData?.items || [];
  const routes = routesData?.items || [];
  const academicYears = ayData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({
      studentId: row.studentId?._id || row.studentId || '',
      routeId: row.routeId?._id || row.routeId || '',
      stopName: row.stopName || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      status: row.status || 'active',
    }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createTransportAllocation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-allocations'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateTransportAllocation(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-allocations'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteTransportAllocation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-allocations'] }); } });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: form });
    else createMut.mutate(form);
  }

  const saving = createMut.isPending || updateMut.isPending;

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'routeId', label: 'Route', render: (r: any) => r.routeId?.name || r.routeId?.routeNumber || '\u2014' },
    { key: 'stopName', label: 'Stop' },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => r.academicYearId?.label || r.academicYearId?.code || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); vem.openForEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this allocation?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Transport Allocations</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search transport allocations…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Allocation
        </button>
      </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={vem.openForView}
        emptyMessage={search ? `No transport allocations match “${search}”.` : 'No transport allocations yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Allocation')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Student * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student...</option>
                  {students.map((s: any) => <option key={s._id} value={s._id}>{studentDisplayName(s)}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Route * {!vem.isView && <Link to="/welfare/transport-routes" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.routeId} onChange={e => setForm(f => ({ ...f, routeId: e.target.value }))} className={inp}>
                  <option value="">Select route...</option>
                  {routes.map((rt: any) => <option key={rt._id} value={rt._id}>{rt.name || rt.routeNumber}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Stop Name *</label><input required value={form.stopName} onChange={e => setForm(f => ({ ...f, stopName: e.target.value }))} className={inp} /></div>
              <div><label className={lbl}>Academic Year * {!vem.isView && <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link>}</label>
                <select required value={form.academicYearId} onChange={e => setForm(f => ({ ...f, academicYearId: e.target.value }))} className={inp}>
                  <option value="">Select year...</option>
                  {academicYears.map((ay: any) => <option key={ay._id} value={ay._id}>{ay.label || ay.code}</option>)}
                </select>
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

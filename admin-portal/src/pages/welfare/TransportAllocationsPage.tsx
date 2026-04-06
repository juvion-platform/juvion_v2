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

const STATUSES = ['active', 'cancelled'] as const;
const STATUS_COLOR: Record<string, string> = { active: 'success', cancelled: 'danger' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function TransportAllocationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', routeId: '', stopName: '', academicYearId: '', status: 'active' });

  const { data, isLoading } = useQuery({ queryKey: ['transport-allocations', page], queryFn: () => listTransportAllocations(page, 20) });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: () => listStudents(1, 200) });
  const { data: routesData } = useQuery({ queryKey: ['transport-routes', 'all'], queryFn: () => listTransportRoutes(1, 100) });
  const { data: ayData } = useQuery({ queryKey: ['academicYears', 'all'], queryFn: () => listAcademicYears(1, 100) });

  const students = studentsData?.items || [];
  const routes = routesData?.items || [];
  const academicYears = ayData?.items || [];

  const createMut = useMutation({ mutationFn: createTransportAllocation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-allocations'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateTransportAllocation(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-allocations'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteTransportAllocation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-allocations'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ studentId: '', routeId: '', stopName: '', academicYearId: '', status: 'active' });
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      studentId: row.studentId?._id || row.studentId || '',
      routeId: row.routeId?._id || row.routeId || '',
      stopName: row.stopName || '',
      academicYearId: row.academicYearId?._id || row.academicYearId || '',
      status: row.status || 'active',
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) updateMut.mutate({ id: editing._id, data: form });
    else createMut.mutate(form);
  }

  function studentDisplayName(s: any): string { return s.person?.name || s.rollNumber || s._id; }

  const columns = [
    { key: 'studentId', label: 'Student', render: (r: any) => <span className="font-medium text-navy">{r.studentId?.personId?.name || r.studentId?.rollNumber || '\u2014'}</span> },
    { key: 'routeId', label: 'Route', render: (r: any) => r.routeId?.name || r.routeId?.routeNumber || '\u2014' },
    { key: 'stopName', label: 'Stop' },
    { key: 'academicYearId', label: 'Academic Year', render: (r: any) => r.academicYearId?.label || r.academicYearId?.code || '\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status] || 'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this allocation?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Transport Allocations</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Allocation
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Allocation' : 'New Allocation'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Student * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                <option value="">Select student...</option>
                {students.map((s: any) => <option key={s._id} value={s._id}>{studentDisplayName(s)}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Route * <Link to="/welfare/transport-routes" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select required value={form.routeId} onChange={e => setForm(f => ({ ...f, routeId: e.target.value }))} className={inp}>
                <option value="">Select route...</option>
                {routes.map((rt: any) => <option key={rt._id} value={rt._id}>{rt.name || rt.routeNumber}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Stop Name *</label><input required value={form.stopName} onChange={e => setForm(f => ({ ...f, stopName: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Academic Year * <Link to="/academics/academic-years" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
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
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

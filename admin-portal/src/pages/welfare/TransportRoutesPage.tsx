import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTransportRoutes, createTransportRoute, updateTransportRoute, deleteTransportRoute } from '../../services/welfare';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";

interface Stop { name: string; pickupTime: string; dropTime: string; }
const emptyStop = (): Stop => ({ name: '', pickupTime: '', dropTime: '' });

export default function TransportRoutesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ routeNumber: '', name: '', vehicleNumber: '', driverName: '', driverPhone: '', capacity: '', isActive: true });
  const [stops, setStops] = useState<Stop[]>([emptyStop()]);

  const { data, isLoading } = useQuery({ queryKey: ['transport-routes', page], queryFn: () => listTransportRoutes(page, 20) });

  const createMut = useMutation({ mutationFn: createTransportRoute, onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateTransportRoute(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteTransportRoute, onSuccess: () => { qc.invalidateQueries({ queryKey: ['transport-routes'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ routeNumber: '', name: '', vehicleNumber: '', driverName: '', driverPhone: '', capacity: '', isActive: true });
    setStops([emptyStop()]);
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      routeNumber: row.routeNumber || '',
      name: row.name || '',
      vehicleNumber: row.vehicleNumber || '',
      driverName: row.driverName || '',
      driverPhone: row.driverPhone || '',
      capacity: String(row.capacity ?? ''),
      isActive: row.isActive !== false,
    });
    if (row.stops?.length) {
      setStops(row.stops.map((s: any) => ({ name: s.name || '', pickupTime: s.pickupTime || '', dropTime: s.dropTime || '' })));
    } else {
      setStops([emptyStop()]);
    }
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      ...form,
      capacity: Number(form.capacity),
      stops: stops.filter(s => s.name),
    };
    if (!payload.vehicleNumber) delete payload.vehicleNumber;
    if (!payload.driverName) delete payload.driverName;
    if (!payload.driverPhone) delete payload.driverPhone;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'routeNumber', label: 'Route #', render: (r: any) => <span className="font-medium text-navy">{r.routeNumber}</span> },
    { key: 'name', label: 'Name' },
    { key: 'vehicleNumber', label: 'Vehicle' },
    { key: 'driverName', label: 'Driver' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'stops', label: 'Stops', render: (r: any) => (r.stops || []).length },
    { key: 'isActive', label: 'Active', render: (r: any) => <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Yes' : 'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this route?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Transport Routes</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Route
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Route' : 'New Route'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Route Number *</label><input required value={form.routeNumber} onChange={e => setForm(f => ({ ...f, routeNumber: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Vehicle Number</label><input value={form.vehicleNumber} onChange={e => setForm(f => ({ ...f, vehicleNumber: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Driver Name</label><input value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Driver Phone</label><input value={form.driverPhone} onChange={e => setForm(f => ({ ...f, driverPhone: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Capacity *</label><input required type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Active</label>
              <select value={String(form.isActive)} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))} className={inp}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          {/* Stops */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-800">Stops</label>
              <button type="button" onClick={() => setStops(prev => [...prev, emptyStop()])} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                <Plus size={14} /> Add Stop
              </button>
            </div>
            <div className="space-y-2">
              {stops.map((stop, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_100px_auto] gap-2 items-center">
                  <input value={stop.name} onChange={e => setStops(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))} className={inp} placeholder="Stop name" />
                  <input value={stop.pickupTime} onChange={e => setStops(prev => prev.map((s, i) => i === idx ? { ...s, pickupTime: e.target.value } : s))} className={inp} placeholder="Pickup" />
                  <input value={stop.dropTime} onChange={e => setStops(prev => prev.map((s, i) => i === idx ? { ...s, dropTime: e.target.value } : s))} className={inp} placeholder="Drop" />
                  <button type="button" onClick={() => setStops(prev => prev.filter((_, i) => i !== idx))} disabled={stops.length <= 1} className="p-1 rounded hover:bg-red-50 disabled:opacity-30">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRooms, createRoom, updateRoom, deleteRoom, listBuildings } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const TYPES = ['classroom','lab','seminar_hall','conference','office','workshop','auditorium'] as const;
const STATUSES = ['available','occupied','maintenance','reserved'] as const;
const STATUS_COLOR: Record<string,string> = { available:'success', occupied:'info', maintenance:'warning', reserved:'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function RoomsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ buildingId:'', roomNumber:'', floor:'', type:'classroom', capacity:'', hasProjector:false, hasAC:false, status:'available' });

  const { data, isLoading } = useQuery({ queryKey: ['rooms', page], queryFn: () => listRooms(page, 20) });
  const { data: bldgData } = useQuery({ queryKey: ['buildings','all'], queryFn: () => listBuildings(1, 100) });
  const buildings = bldgData?.items || [];

  const createMut = useMutation({ mutationFn: createRoom, onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateRoom(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteRoom, onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); } });

  function openCreate() { setEditing(null); setForm({ buildingId:'', roomNumber:'', floor:'', type:'classroom', capacity:'', hasProjector:false, hasAC:false, status:'available' }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ buildingId: row.buildingId?._id||row.buildingId||'', roomNumber: row.roomNumber||'', floor: String(row.floor??''), type: row.type||'classroom', capacity: String(row.capacity??''), hasProjector: !!row.hasProjector, hasAC: !!row.hasAC, status: row.status||'available' });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, floor: Number(form.floor), capacity: Number(form.capacity) };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'roomNumber', label: 'Room #', render: (r: any) => <span className="font-medium text-navy">{r.roomNumber}</span> },
    { key: 'building', label: 'Building', render: (r: any) => r.buildingId?.name || '\u2014' },
    { key: 'floor', label: 'Floor' },
    { key: 'type', label: 'Type', render: (r: any) => r.type?.replace(/_/g,' ') },
    { key: 'capacity', label: 'Capacity' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={STATUS_COLOR[r.status]||'default'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Rooms</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} /> New Room</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} />
      {data && data.pages > 1 && (<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Room' : 'New Room'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Building * <Link to="/campus-ops/buildings" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.buildingId} onChange={e=>setForm(f=>({...f,buildingId:e.target.value}))} className={inp}><option value="">Select building</option>{buildings.map((b:any)=><option key={b._id} value={b._id}>{b.name||b.code}</option>)}</select></div>
            <div><label className={lbl}>Room Number *</label><input required value={form.roomNumber} onChange={e=>setForm(f=>({...f,roomNumber:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Floor *</label><input required type="number" min={0} value={form.floor} onChange={e=>setForm(f=>({...f,floor:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className={inp}>{TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
            <div><label className={lbl}>Capacity *</label><input required type="number" min={1} value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className={inp}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <div className="flex items-center gap-4 col-span-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.hasProjector} onChange={e=>setForm(f=>({...f,hasProjector:e.target.checked}))}/> Has Projector</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.hasAC} onChange={e=>setForm(f=>({...f,hasAC:e.target.checked}))}/> Has AC</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending||updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{createMut.isPending||updateMut.isPending?'Saving...':editing?'Update':'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

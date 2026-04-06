import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRoomBookings, createRoomBooking, updateRoomBooking, deleteRoomBooking, listRooms } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUSES = ['pending','approved','rejected','cancelled'] as const;
const STATUS_COLOR: Record<string,string> = { pending:'warning', approved:'success', rejected:'danger', cancelled:'default' };
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function RoomBookingsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ roomId:'', bookedBy:'', date:'', startTime:'', endTime:'', purpose:'', status:'pending' });

  const { data, isLoading } = useQuery({ queryKey: ['room-bookings', page], queryFn: () => listRoomBookings(page, 20) });
  const { data: roomData } = useQuery({ queryKey: ['rooms','all'], queryFn: () => listRooms(1, 200) });
  const { data: personData } = useQuery({ queryKey: ['persons','all'], queryFn: () => listPersons(1, 200) });
  const rooms = roomData?.items || [];
  const persons = personData?.items || [];

  const createMut = useMutation({ mutationFn: createRoomBooking, onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-bookings'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateRoomBooking(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-bookings'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteRoomBooking, onSuccess: () => { qc.invalidateQueries({ queryKey: ['room-bookings'] }); } });

  function openCreate() { setEditing(null); setForm({ roomId:'', bookedBy:'', date:'', startTime:'', endTime:'', purpose:'', status:'pending' }); setModalOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ roomId: row.roomId?._id||row.roomId||'', bookedBy: row.bookedBy?._id||row.bookedBy||'', date: row.date?.slice(0,10)||'', startTime: row.startTime||'', endTime: row.endTime||'', purpose: row.purpose||'', status: row.status||'pending' });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form };
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'room', label: 'Room', render: (r: any) => r.roomId?.roomNumber || '\u2014' },
    { key: 'bookedBy', label: 'Booked By', render: (r: any) => r.bookedBy?.name || '\u2014' },
    { key: 'date', label: 'Date', render: (r: any) => r.date?.slice(0,10) },
    { key: 'time', label: 'Time', render: (r: any) => `${r.startTime||''} - ${r.endTime||''}` },
    { key: 'purpose', label: 'Purpose' },
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
        <h2 className="text-xl font-bold text-navy">Room Bookings</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16} /> New Booking</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} />
      {data && data.pages > 1 && (<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Booking' : 'New Booking'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Room * <Link to="/campus-ops/rooms" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.roomId} onChange={e=>setForm(f=>({...f,roomId:e.target.value}))} className={inp}><option value="">Select room</option>{rooms.map((r:any)=><option key={r._id} value={r._id}>{r.roomNumber}</option>)}</select></div>
            <div><label className={lbl}>Booked By * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.bookedBy} onChange={e=>setForm(f=>({...f,bookedBy:e.target.value}))} className={inp}><option value="">Select person</option>{persons.map((p:any)=><option key={p._id} value={p._id}>{p.name||p._id}</option>)}</select></div>
            <div><label className={lbl}>Date *</label><input required type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Start Time *</label><input required type="time" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>End Time *</label><input required type="time" value={form.endTime} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Purpose *</label><input required value={form.purpose} onChange={e=>setForm(f=>({...f,purpose:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className={inp}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listParkingSlots, createParkingSlot, updateParkingSlot, deleteParkingSlot } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ParkingSlotsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ zone:'', slotNumber:'', type:'two_wheeler', allocatedTo:'', status:'available' });

  const { data, isLoading } = useQuery({ queryKey: ['parking-slots', page], queryFn: () => listParkingSlots(page, 20) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createParkingSlot, onSuccess: () => { qc.invalidateQueries({ queryKey: ['parking-slots'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateParkingSlot(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['parking-slots'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteParkingSlot, onSuccess: () => qc.invalidateQueries({ queryKey: ['parking-slots'] }) });

  function openCreate() { setEditing(null); setForm({ zone:'', slotNumber:'', type:'two_wheeler', allocatedTo:'', status:'available' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ zone: row.zone||'', slotNumber: row.slotNumber||'', type: row.type||'two_wheeler', allocatedTo: row.allocatedTo?._id||row.allocatedTo||'', status: row.status||'available' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'zone', label: 'Zone' },
    { key: 'slotNumber', label: 'Slot #', render: (r: any) => <span className="font-medium text-navy">{r.slotNumber}</span> },
    { key: 'type', label: 'Type', render: (r: any) => r.type?.replace(/_/g,' ') },
    { key: 'allocatedTo', label: 'Allocated To', render: (r: any) => r.allocatedTo?.name||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='available'?'success':r.status==='occupied'?'info':'warning'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Parking Slots</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Zone *</label><input required value={form.zone} onChange={e=>setForm(fm=>({...fm,zone:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Slot # *</label><input required value={form.slotNumber} onChange={e=>setForm(fm=>({...fm,slotNumber:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="two_wheeler">two wheeler</option><option value="four_wheeler">four wheeler</option><option value="visitor">visitor</option><option value="reserved">reserved</option></select></div>
            <div><label className={lbl}>Allocated To <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select value={form.allocatedTo} onChange={e=>setForm(fm=>({...fm,allocatedTo:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="available">available</option><option value="occupied">occupied</option><option value="reserved">reserved</option><option value="blocked">blocked</option></select></div>
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

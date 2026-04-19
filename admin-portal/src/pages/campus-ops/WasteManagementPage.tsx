import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listWasteManagements, createWasteManagement, updateWasteManagement, deleteWasteManagement } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function WasteManagementPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ date:'', wasteType:'dry', quantityKg:'', disposalMethod:'recycle', handledBy:'', vendorName:'', cost:'' });

  const { data, isLoading } = useQuery({ queryKey: ['waste-managements', page], queryFn: () => listWasteManagements(page, 20) });

  const createMut = useMutation({ mutationFn: createWasteManagement, onSuccess: () => { qc.invalidateQueries({ queryKey: ['waste-managements'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateWasteManagement(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['waste-managements'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteWasteManagement, onSuccess: () => qc.invalidateQueries({ queryKey: ['waste-managements'] }) });

  function openCreate() { setEditing(null); setForm({ date:'', wasteType:'dry', quantityKg:'', disposalMethod:'recycle', handledBy:'', vendorName:'', cost:'' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ date: row.date?.slice(0,10)||'', wasteType: row.wasteType||'dry', quantityKg: String(row.quantityKg??''), disposalMethod: row.disposalMethod||'recycle', handledBy: row.handledBy||'', vendorName: row.vendorName||'', cost: String(row.cost??'') }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.quantityKg) payload.quantityKg = Number(form.quantityKg);
    if(form.cost) payload.cost = Number(form.cost);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'date', label: 'Date', render: (r: any) => r.date?.slice(0,10) },
    { key: 'wasteType', label: 'Type', render: (r: any) => <span className='font-medium text-navy'>{r.wasteType?.replace(/_/g,' ')}</span> },
    { key: 'quantityKg', label: 'Qty (kg)' },
    { key: 'disposalMethod', label: 'Disposal', render: (r: any) => r.disposalMethod?.replace(/_/g,' ') },
    { key: 'cost', label: 'Cost', render: (r: any) => r.cost?`\u20B9${r.cost.toLocaleString()}`:'\u2014' },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Waste Management</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Date *</label><input required type="date" value={form.date} onChange={e=>setForm(fm=>({...fm,date:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Waste Type *</label><select required value={form.wasteType} onChange={e=>setForm(fm=>({...fm,wasteType:e.target.value}))} className={inp}><option value="dry">dry</option><option value="wet">wet</option><option value="e_waste">e waste</option><option value="hazardous">hazardous</option><option value="biomedical">biomedical</option></select></div>
            <div><label className={lbl}>Quantity (kg) *</label><input required type="number" min={0} value={form.quantityKg} onChange={e=>setForm(fm=>({...fm,quantityKg:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Disposal *</label><select required value={form.disposalMethod} onChange={e=>setForm(fm=>({...fm,disposalMethod:e.target.value}))} className={inp}><option value="recycle">recycle</option><option value="compost">compost</option><option value="incinerate">incinerate</option><option value="landfill">landfill</option><option value="vendor_pickup">vendor pickup</option></select></div>
            <div><label className={lbl}>Handled By</label><input value={form.handledBy} onChange={e=>setForm(fm=>({...fm,handledBy:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Vendor</label><input value={form.vendorName} onChange={e=>setForm(fm=>({...fm,vendorName:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Cost</label><input type="number" min={0} value={form.cost} onChange={e=>setForm(fm=>({...fm,cost:e.target.value}))} className={inp}/></div>
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

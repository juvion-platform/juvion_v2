import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listVendors, createVendor, updateVendor, deleteVendor } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';


const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function VendorsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name:'', contactPerson:'', phone:'', email:'', address:'', category:'', gstNumber:'', panNumber:'', rating:'', isActive:true });

  const { data, isLoading } = useQuery({ queryKey: ['vendors', page], queryFn: () => listVendors(page, 20) });

  const createMut = useMutation({ mutationFn: createVendor, onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateVendor(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteVendor, onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }) });

  function openCreate() { setEditing(null); setForm({ name:'', contactPerson:'', phone:'', email:'', address:'', category:'', gstNumber:'', panNumber:'', rating:'', isActive:true }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ name: row.name||'', contactPerson: row.contactPerson||'', phone: row.phone||'', email: row.email||'', address: row.address||'', category: row.category||'', gstNumber: row.gstNumber||'', panNumber: row.panNumber||'', rating: String(row.rating??''), isActive: row.isActive!==false }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.rating) payload.rating = Number(form.rating);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'contactPerson', label: 'Contact', render: (r: any) => r.contactPerson||'\u2014' },
    { key: 'phone', label: 'Phone', render: (r: any) => r.phone||'\u2014' },
    { key: 'category', label: 'Category', render: (r: any) => r.category||'\u2014' },
    { key: 'isActive', label: 'Active', render: (r: any) => <Badge variant={r.isActive!==false?'success':'default'}>{r.isActive!==false?'Yes':'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Vendors</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e=>setForm(fm=>({...fm,name:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Contact Person</label><input value={form.contactPerson} onChange={e=>setForm(fm=>({...fm,contactPerson:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Phone</label><input value={form.phone} onChange={e=>setForm(fm=>({...fm,phone:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Email</label><input type="email" value={form.email} onChange={e=>setForm(fm=>({...fm,email:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Address</label><input value={form.address} onChange={e=>setForm(fm=>({...fm,address:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Category</label><input value={form.category} onChange={e=>setForm(fm=>({...fm,category:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>GST #</label><input value={form.gstNumber} onChange={e=>setForm(fm=>({...fm,gstNumber:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>PAN #</label><input value={form.panNumber} onChange={e=>setForm(fm=>({...fm,panNumber:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Rating</label><input type="number" min={0} value={form.rating} onChange={e=>setForm(fm=>({...fm,rating:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Active</label><select value={String(form.isActive)} onChange={e=>setForm(fm=>({...fm,isActive:e.target.value==='true'}))} className={inp}><option value="true">Yes</option><option value="false">No</option></select></div>
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

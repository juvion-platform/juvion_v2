import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listStockItems, createStockItem, updateStockItem, deleteStockItem } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';


const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function StockItemsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name:'', category:'', unit:'', currentStock:'', minStock:'', location:'', lastRestockedDate:'' });

  const { data, isLoading } = useQuery({ queryKey: ['stock-items', page], queryFn: () => listStockItems(page, 20) });

  const createMut = useMutation({ mutationFn: createStockItem, onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-items'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateStockItem(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-items'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteStockItem, onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-items'] }) });

  function openCreate() { setEditing(null); setForm({ name:'', category:'', unit:'', currentStock:'', minStock:'', location:'', lastRestockedDate:'' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ name: row.name||'', category: row.category||'', unit: row.unit||'', currentStock: String(row.currentStock??''), minStock: String(row.minStock??''), location: row.location||'', lastRestockedDate: row.lastRestockedDate?.slice(0,10)||'' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.currentStock) payload.currentStock = Number(form.currentStock);
    if(form.minStock) payload.minStock = Number(form.minStock);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'category', label: 'Category', render: (r: any) => r.category||'\u2014' },
    { key: 'unit', label: 'Unit', render: (r: any) => r.unit||'\u2014' },
    { key: 'currentStock', label: 'Stock', render: (r: any) => r.currentStock??'\u2014' },
    { key: 'minStock', label: 'Min', render: (r: any) => r.minStock??'\u2014' },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Stock Items</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e=>setForm(fm=>({...fm,name:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Category</label><input value={form.category} onChange={e=>setForm(fm=>({...fm,category:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Unit</label><input value={form.unit} onChange={e=>setForm(fm=>({...fm,unit:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Current Stock</label><input type="number" min={0} value={form.currentStock} onChange={e=>setForm(fm=>({...fm,currentStock:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Min Stock</label><input type="number" min={0} value={form.minStock} onChange={e=>setForm(fm=>({...fm,minStock:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Location</label><input value={form.location} onChange={e=>setForm(fm=>({...fm,location:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Last Restocked</label><input type="date" value={form.lastRestockedDate} onChange={e=>setForm(fm=>({...fm,lastRestockedDate:e.target.value}))} className={inp}/></div>
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

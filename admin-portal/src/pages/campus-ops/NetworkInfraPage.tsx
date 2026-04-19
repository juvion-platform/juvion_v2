import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listNetworkInfra, createNetworkInfra, updateNetworkInfra, deleteNetworkInfra } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function NetworkInfraPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name:'', type:'wifi_ap', location:'', bandwidth:'', ipRange:'', ssid:'', status:'active' });

  const { data, isLoading } = useQuery({ queryKey: ['network-infra', page], queryFn: () => listNetworkInfra(page, 20) });

  const createMut = useMutation({ mutationFn: createNetworkInfra, onSuccess: () => { qc.invalidateQueries({ queryKey: ['network-infra'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateNetworkInfra(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['network-infra'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteNetworkInfra, onSuccess: () => qc.invalidateQueries({ queryKey: ['network-infra'] }) });

  function openCreate() { setEditing(null); setForm({ name:'', type:'wifi_ap', location:'', bandwidth:'', ipRange:'', ssid:'', status:'active' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ name: row.name||'', type: row.type||'wifi_ap', location: row.location||'', bandwidth: row.bandwidth||'', ipRange: row.ipRange||'', ssid: row.ssid||'', status: row.status||'active' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.name}</span> },
    { key: 'type', label: 'Type', render: (r: any) => r.type?.replace(/_/g,' ') },
    { key: 'location', label: 'Location', render: (r: any) => r.location||'\u2014' },
    { key: 'bandwidth', label: 'Bandwidth', render: (r: any) => r.bandwidth||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='active'?'success':'warning'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Network Infrastructure</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e=>setForm(fm=>({...fm,name:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="wifi_ap">wifi ap</option><option value="switch">switch</option><option value="router">router</option><option value="firewall">firewall</option><option value="server">server</option><option value="fiber_link">fiber link</option></select></div>
            <div><label className={lbl}>Location</label><input value={form.location} onChange={e=>setForm(fm=>({...fm,location:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Bandwidth</label><input value={form.bandwidth} onChange={e=>setForm(fm=>({...fm,bandwidth:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>IP Range</label><input value={form.ipRange} onChange={e=>setForm(fm=>({...fm,ipRange:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>SSID</label><input value={form.ssid} onChange={e=>setForm(fm=>({...fm,ssid:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="active">active</option><option value="inactive">inactive</option><option value="maintenance">maintenance</option></select></div>
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

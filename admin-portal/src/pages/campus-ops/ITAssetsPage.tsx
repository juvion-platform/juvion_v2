import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listITAssets, createITAsset, updateITAsset, deleteITAsset } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function ITAssetsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ serialNumber:'', type:'desktop', make:'', assetModel:'', ipAddress:'', macAddress:'', location:'', assignedTo:'', purchaseDate:'', warrantyExpiry:'', status:'active' });

  const { data, isLoading } = useQuery({ queryKey: ['it-assets', page], queryFn: () => listITAssets(page, 20) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createITAsset, onSuccess: () => { qc.invalidateQueries({ queryKey: ['it-assets'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateITAsset(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['it-assets'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteITAsset, onSuccess: () => qc.invalidateQueries({ queryKey: ['it-assets'] }) });

  function openCreate() { setEditing(null); setForm({ serialNumber:'', type:'desktop', make:'', assetModel:'', ipAddress:'', macAddress:'', location:'', assignedTo:'', purchaseDate:'', warrantyExpiry:'', status:'active' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ serialNumber: row.serialNumber||'', type: row.type||'desktop', make: row.make||'', assetModel: row.assetModel||'', ipAddress: row.ipAddress||'', macAddress: row.macAddress||'', location: row.location||'', assignedTo: row.assignedTo?._id||row.assignedTo||'', purchaseDate: row.purchaseDate?.slice(0,10)||'', warrantyExpiry: row.warrantyExpiry?.slice(0,10)||'', status: row.status||'active' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'serialNumber', label: 'Serial #', render: (r: any) => <span className="font-medium text-navy">{r.serialNumber}</span> },
    { key: 'type', label: 'Type' },
    { key: 'make', label: 'Make', render: (r: any) => r.make||'\u2014' },
    { key: 'location', label: 'Location', render: (r: any) => r.location||'\u2014' },
    { key: 'assignedTo', label: 'Assigned To', render: (r: any) => r.assignedTo?.name||'\u2014' },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='active'?'success':r.status==='disposed'?'danger':'warning'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">IT Assets</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Serial # *</label><input required value={form.serialNumber} onChange={e=>setForm(fm=>({...fm,serialNumber:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Type *</label><select required value={form.type} onChange={e=>setForm(fm=>({...fm,type:e.target.value}))} className={inp}><option value="desktop">desktop</option><option value="laptop">laptop</option><option value="printer">printer</option><option value="projector">projector</option><option value="server">server</option><option value="switch">switch</option><option value="router">router</option><option value="ups">ups</option><option value="other">other</option></select></div>
            <div><label className={lbl}>Make</label><input value={form.make} onChange={e=>setForm(fm=>({...fm,make:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Model</label><input value={form.assetModel} onChange={e=>setForm(fm=>({...fm,assetModel:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>IP Address</label><input value={form.ipAddress} onChange={e=>setForm(fm=>({...fm,ipAddress:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>MAC Address</label><input value={form.macAddress} onChange={e=>setForm(fm=>({...fm,macAddress:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Location</label><input value={form.location} onChange={e=>setForm(fm=>({...fm,location:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Assigned To <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select value={form.assignedTo} onChange={e=>setForm(fm=>({...fm,assignedTo:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Purchase Date</label><input type="date" value={form.purchaseDate} onChange={e=>setForm(fm=>({...fm,purchaseDate:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Warranty Expiry</label><input type="date" value={form.warrantyExpiry} onChange={e=>setForm(fm=>({...fm,warrantyExpiry:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="active">active</option><option value="maintenance">maintenance</option><option value="disposed">disposed</option><option value="lost">lost</option></select></div>
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

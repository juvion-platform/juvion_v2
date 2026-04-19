import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listEmergencyContacts, createEmergencyContact, updateEmergencyContact, deleteEmergencyContact } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function EmergencyContactsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name:'', role:'other', phone:'', alternatePhone:'', email:'', isActive:true });

  const { data, isLoading } = useQuery({ queryKey: ['emergency-contacts', page], queryFn: () => listEmergencyContacts(page, 20) });

  const createMut = useMutation({ mutationFn: createEmergencyContact, onSuccess: () => { qc.invalidateQueries({ queryKey: ['emergency-contacts'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateEmergencyContact(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['emergency-contacts'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteEmergencyContact, onSuccess: () => qc.invalidateQueries({ queryKey: ['emergency-contacts'] }) });

  function openCreate() { setEditing(null); setForm({ name:'', role:'other', phone:'', alternatePhone:'', email:'', isActive:true }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ name: row.name||'', role: row.role||'other', phone: row.phone||'', alternatePhone: row.alternatePhone||'', email: row.email||'', isActive: row.isActive!==false }); setModalOpen(true); }
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
    { key: 'role', label: 'Role', render: (r: any) => r.role?.replace(/_/g,' ') },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (r: any) => r.email||'\u2014' },
    { key: 'isActive', label: 'Active', render: (r: any) => <Badge variant={r.isActive!==false?'success':'default'}>{r.isActive!==false?'Yes':'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Emergency Contacts</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Name *</label><input required value={form.name} onChange={e=>setForm(fm=>({...fm,name:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Role *</label><select required value={form.role} onChange={e=>setForm(fm=>({...fm,role:e.target.value}))} className={inp}><option value="fire">fire</option><option value="police">police</option><option value="ambulance">ambulance</option><option value="hospital">hospital</option><option value="principal">principal</option><option value="security_head">security head</option><option value="warden">warden</option><option value="other">other</option></select></div>
            <div><label className={lbl}>Phone *</label><input required value={form.phone} onChange={e=>setForm(fm=>({...fm,phone:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Alt Phone</label><input value={form.alternatePhone} onChange={e=>setForm(fm=>({...fm,alternatePhone:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Email</label><input type="email" value={form.email} onChange={e=>setForm(fm=>({...fm,email:e.target.value}))} className={inp}/></div>
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listVisitorEntries, createVisitorEntry, updateVisitorEntry, deleteVisitorEntry } from '../../services/campus-ops';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const IDTYPE_OPTS = ['aadhaar','driving_license','voter_id','pan','other'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";


export default function VisitorEntriesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ visitorName:'', phone:'', idType:'', idNumber:'', purpose:'', whomToMeet:'', department:'', inTime:'', outTime:'', vehicleNumber:'' });

  const { data, isLoading } = useQuery({ queryKey: ['visitor-entries', page], queryFn: () => listVisitorEntries(page, 20) });

  const createMut = useMutation({ mutationFn: createVisitorEntry, onSuccess: () => { qc.invalidateQueries({ queryKey: ['visitor-entries'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateVisitorEntry(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['visitor-entries'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteVisitorEntry, onSuccess: () => qc.invalidateQueries({ queryKey: ['visitor-entries'] }) });

  function openCreate() { setEditing(null); setForm({ visitorName:'', phone:'', idType:'', idNumber:'', purpose:'', whomToMeet:'', department:'', inTime:'', outTime:'', vehicleNumber:'' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ visitorName: row.visitorName||'', phone: row.phone||'', idType: row.idType||'', idNumber: row.idNumber||'', purpose: row.purpose||'', whomToMeet: row.whomToMeet||'', department: row.department||'', inTime: row.inTime?.slice(0,16)||'', outTime: row.outTime?.slice(0,16)||'', vehicleNumber: row.vehicleNumber||'' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'visitorName', label: 'Name', render: (r: any) => <span className="font-medium text-navy">{r.visitorName}</span> },
    { key: 'phone', label: 'Phone' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'whomToMeet', label: 'To Meet', render: (r: any) => r.whomToMeet||'\u2014' },
    { key: 'inTime', label: 'In', render: (r: any) => r.inTime?.slice(0,16)||'\u2014' },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Visitor Entries</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Visitor Name *</label><input required value={form.visitorName} onChange={e=>setForm(fm=>({...fm,visitorName:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Phone *</label><input required value={form.phone} onChange={e=>setForm(fm=>({...fm,phone:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>ID Type</label><select value={form.idType} onChange={e=>setForm(fm=>({...fm,idType:e.target.value}))} className={inp}><option value="">None</option><option value="aadhaar">aadhaar</option><option value="driving_license">driving license</option><option value="voter_id">voter id</option><option value="pan">pan</option><option value="other">other</option></select></div>
            <div><label className={lbl}>ID Number</label><input value={form.idNumber} onChange={e=>setForm(fm=>({...fm,idNumber:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Purpose *</label><input required value={form.purpose} onChange={e=>setForm(fm=>({...fm,purpose:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Whom to Meet</label><input value={form.whomToMeet} onChange={e=>setForm(fm=>({...fm,whomToMeet:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Department</label><input value={form.department} onChange={e=>setForm(fm=>({...fm,department:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>In Time</label><input type="datetime-local" value={form.inTime} onChange={e=>setForm(fm=>({...fm,inTime:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Out Time</label><input type="datetime-local" value={form.outTime} onChange={e=>setForm(fm=>({...fm,outTime:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Vehicle #</label><input value={form.vehicleNumber} onChange={e=>setForm(fm=>({...fm,vehicleNumber:e.target.value}))} className={inp}/></div>
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

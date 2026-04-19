import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLibraryMembers, createLibraryMember, updateLibraryMember, deleteLibraryMember } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function LibraryMembersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ personId:'', memberType:'student', membershipId:'', maxBooks:'', currentIssued:'', finesDue:'', isActive:true });

  const { data, isLoading } = useQuery({ queryKey: ['library-members', page], queryFn: () => listLibraryMembers(page, 20) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const persons = personsData?.items || [];

  const createMut = useMutation({ mutationFn: createLibraryMember, onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-members'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateLibraryMember(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-members'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteLibraryMember, onSuccess: () => qc.invalidateQueries({ queryKey: ['library-members'] }) });

  function openCreate() { setEditing(null); setForm({ personId:'', memberType:'student', membershipId:'', maxBooks:'', currentIssued:'', finesDue:'', isActive:true }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ personId: row.personId?._id||row.personId||'', memberType: row.memberType||'student', membershipId: row.membershipId||'', maxBooks: String(row.maxBooks??''), currentIssued: String(row.currentIssued??''), finesDue: String(row.finesDue??''), isActive: row.isActive!==false }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.maxBooks) payload.maxBooks = Number(form.maxBooks);
    if(form.currentIssued) payload.currentIssued = Number(form.currentIssued);
    if(form.finesDue) payload.finesDue = Number(form.finesDue);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'membershipId', label: 'Membership ID', render: (r: any) => <span className="font-medium text-navy">{r.membershipId}</span> },
    { key: 'person', label: 'Person', render: (r: any) => r.personId?.name||'\u2014' },
    { key: 'memberType', label: 'Type', render: (r: any) => r.memberType?.replace(/_/g,' ') },
    { key: 'currentIssued', label: 'Issued', render: (r: any) => r.currentIssued||0 },
    { key: 'finesDue', label: 'Fines', render: (r: any) => r.finesDue?`\u20B9${r.finesDue}`:'\u2014' },
    { key: 'isActive', label: 'Active', render: (r: any) => <Badge variant={r.isActive!==false?'success':'default'}>{r.isActive!==false?'Yes':'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Library Members</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Person * <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select required value={form.personId} onChange={e=>setForm(fm=>({...fm,personId:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
            <div><label className={lbl}>Member Type *</label><select required value={form.memberType} onChange={e=>setForm(fm=>({...fm,memberType:e.target.value}))} className={inp}><option value="student">student</option><option value="faculty">faculty</option><option value="staff">staff</option><option value="research_scholar">research scholar</option></select></div>
            <div><label className={lbl}>Membership ID *</label><input required value={form.membershipId} onChange={e=>setForm(fm=>({...fm,membershipId:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Max Books</label><input type="number" min={0} value={form.maxBooks} onChange={e=>setForm(fm=>({...fm,maxBooks:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Current Issued</label><input type="number" min={0} value={form.currentIssued} onChange={e=>setForm(fm=>({...fm,currentIssued:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Fines Due</label><input type="number" min={0} value={form.finesDue} onChange={e=>setForm(fm=>({...fm,finesDue:e.target.value}))} className={inp}/></div>
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

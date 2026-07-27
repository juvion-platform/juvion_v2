import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLibraryMembers, createLibraryMember, updateLibraryMember, deleteLibraryMember } from '../../services/campus-ops';
import { listPersons } from '../../services/people';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useViewEditMode } from '../../hooks/useViewEditMode';
import { confirmAction } from '../../stores/confirmStore';
import Pagination from '../../components/ui/Pagination';
import { useListControls } from '../../hooks/useListControls';
import SearchInput from '../../components/ui/SearchInput';

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-default";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

const emptyForm = { personId:'', memberType:'student', membershipId:'', maxBooks:'', currentIssued:'', finesDue:'', isActive:true };

export default function LibraryMembersPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['library-members', page, limit, search], queryFn: () => listLibraryMembers(page, limit, search) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const persons = personsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({ personId: row.personId?._id||row.personId||'', memberType: row.memberType||'student', membershipId: row.membershipId||'', maxBooks: String(row.maxBooks??''), currentIssued: String(row.currentIssued??''), finesDue: String(row.finesDue??''), isActive: row.isActive!==false }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createLibraryMember, onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-members'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateLibraryMember(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['library-members'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteLibraryMember, onSuccess: () => qc.invalidateQueries({ queryKey: ['library-members'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.maxBooks) payload.maxBooks = Number(form.maxBooks);
    if(form.currentIssued) payload.currentIssued = Number(form.currentIssued);
    if(form.finesDue) payload.finesDue = Number(form.finesDue);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'membershipId', label: 'Membership ID', render: (r: any) => <span className="font-medium text-navy">{r.membershipId}</span> },
    { key: 'person', label: 'Person', render: (r: any) => r.personId?.name||'\u2014' },
    { key: 'memberType', label: 'Type', render: (r: any) => r.memberType?.replace(/_/g,' ') },
    { key: 'currentIssued', label: 'Issued', render: (r: any) => r.currentIssued||0 },
    { key: 'finesDue', label: 'Fines', render: (r: any) => r.finesDue?`\u20B9${r.finesDue}`:'\u2014' },
    { key: 'isActive', label: 'Active', render: (r: any) => <Badge variant={r.isActive!==false?'success':'default'}>{r.isActive!==false?'Yes':'No'}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();vem.openForEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Library Members</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search library members…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No library members match “${search}”.` : 'No library members yet.'}
      />

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        total={data?.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Library Member')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Person * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select required value={form.personId} onChange={e=>setForm(fm=>({...fm,personId:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
              <div><label className={lbl}>Member Type *</label><select required value={form.memberType} onChange={e=>setForm(fm=>({...fm,memberType:e.target.value}))} className={inp}><option value="student">student</option><option value="faculty">faculty</option><option value="staff">staff</option><option value="research_scholar">research scholar</option></select></div>
              <div><label className={lbl}>Membership ID *</label><input required value={form.membershipId} onChange={e=>setForm(fm=>({...fm,membershipId:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Max Books</label><input type="number" min={0} value={form.maxBooks} onChange={e=>setForm(fm=>({...fm,maxBooks:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Current Issued</label><input type="number" min={0} value={form.currentIssued} onChange={e=>setForm(fm=>({...fm,currentIssued:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Fines Due</label><input type="number" min={0} value={form.finesDue} onChange={e=>setForm(fm=>({...fm,finesDue:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Active</label><select value={String(form.isActive)} onChange={e=>setForm(fm=>({...fm,isActive:e.target.value==='true'}))} className={inp}><option value="true">Yes</option><option value="false">No</option></select></div>
            </div>
          </fieldset>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={vem.close} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">{vem.isView ? 'Close' : 'Cancel'}</button>
            {vem.isView ? (
              <button type="button" onClick={vem.switchToEdit} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><Pencil size={14} /> Edit</button>
            ) : (
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving…' : vem.isEdit ? 'Update' : 'Create'}</button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

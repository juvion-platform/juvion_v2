import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBookIssues, createBookIssue, updateBookIssue, deleteBookIssue, listBooks } from '../../services/campus-ops';
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

const emptyForm = { bookId:'', issuedTo:'', issuedDate:'', dueDate:'', returnedDate:'', renewCount:'', fineAmount:'', status:'issued' };

export default function BookIssuesPage() {
  const qc = useQueryClient();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({ queryKey: ['book-issues', page, limit, search], queryFn: () => listBookIssues(page, limit, search) });
  const { data: booksData } = useQuery({ queryKey: ['books-ref','all'], queryFn: () => listBooks(1, 200) });
  const { data: personsData } = useQuery({ queryKey: ['persons-ref','all'], queryFn: () => listPersons(1, 200) });
  const books = booksData?.items || [];
  const persons = personsData?.items || [];

  const vem = useViewEditMode<any>({
    onOpenEntity: (row) => setForm({ bookId: row.bookId?._id||row.bookId||'', issuedTo: row.issuedTo?._id||row.issuedTo||'', issuedDate: row.issuedDate?.slice(0,10)||'', dueDate: row.dueDate?.slice(0,10)||'', returnedDate: row.returnedDate?.slice(0,10)||'', renewCount: String(row.renewCount??''), fineAmount: String(row.fineAmount??''), status: row.status||'issued' }),
    onOpenCreate: () => setForm(emptyForm),
    onClose: () => setForm(emptyForm),
  });

  const createMut = useMutation({ mutationFn: createBookIssue, onSuccess: () => { qc.invalidateQueries({ queryKey: ['book-issues'] }); vem.close(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateBookIssue(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['book-issues'] }); vem.close(); } });
  const deleteMut = useMutation({ mutationFn: deleteBookIssue, onSuccess: () => qc.invalidateQueries({ queryKey: ['book-issues'] }) });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.renewCount) payload.renewCount = Number(form.renewCount);
    if(form.fineAmount) payload.fineAmount = Number(form.fineAmount);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if (vem.isEdit && vem.entity) updateMut.mutate({ id: vem.entity._id, data: payload });
    else createMut.mutate(payload);
  }

  const saving = createMut.isPending || updateMut.isPending;

  const columns = [
    { key: 'book', label: 'Book', render: (r: any) => r.bookId?.title||'\u2014' },
    { key: 'issuedTo', label: 'Issued To', render: (r: any) => r.issuedTo?.name||'\u2014' },
    { key: 'issuedDate', label: 'Issued', render: (r: any) => r.issuedDate?.slice(0,10)||'\u2014' },
    { key: 'dueDate', label: 'Due', render: (r: any) => r.dueDate?.slice(0,10) },
    { key: 'status', label: 'Status', render: (r: any) => <Badge variant={r.status==='returned'?'success':r.status==='overdue'?'danger':r.status==='lost'?'danger':'info'}>{r.status}</Badge> },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();vem.openForEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();void confirmAction({ title: 'Delete?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } })}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Book Issues</h2>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search book issues…" className="w-56" />
        <button onClick={vem.openForCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading} rowKey={(r: any) => r._id} onRowClick={vem.openForView}
        emptyMessage={search ? `No book issues match “${search}”.` : 'No book issues yet.'}
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
      <Modal open={vem.isOpen} onClose={vem.close} title={vem.titleFor('Book Issue')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={vem.isView} className="border-0 p-0 m-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={lbl}>Book * {!vem.isView && <Link to="/campus-ops/books" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select required value={form.bookId} onChange={e=>setForm(fm=>({...fm,bookId:e.target.value}))} className={inp}><option value="">Select...</option>{books.map((x:any)=><option key={x._id} value={x._id}>{x.title}</option>)}</select></div>
              <div><label className={lbl}>Issued To * {!vem.isView && <Link to="/people" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link>}</label><select required value={form.issuedTo} onChange={e=>setForm(fm=>({...fm,issuedTo:e.target.value}))} className={inp}><option value="">Select...</option>{persons.map((x:any)=><option key={x._id} value={x._id}>{x.name||x._id}</option>)}</select></div>
              <div><label className={lbl}>Issued Date</label><input type="date" value={form.issuedDate} onChange={e=>setForm(fm=>({...fm,issuedDate:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Due Date *</label><input required type="date" value={form.dueDate} onChange={e=>setForm(fm=>({...fm,dueDate:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Returned Date</label><input type="date" value={form.returnedDate} onChange={e=>setForm(fm=>({...fm,returnedDate:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Renew Count</label><input type="number" min={0} value={form.renewCount} onChange={e=>setForm(fm=>({...fm,renewCount:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Fine</label><input type="number" min={0} value={form.fineAmount} onChange={e=>setForm(fm=>({...fm,fineAmount:e.target.value}))} className={inp}/></div>
              <div><label className={lbl}>Status</label><select value={form.status} onChange={e=>setForm(fm=>({...fm,status:e.target.value}))} className={inp}><option value="">None</option><option value="issued">issued</option><option value="returned">returned</option><option value="overdue">overdue</option><option value="lost">lost</option></select></div>
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBooks, createBook, updateBook, deleteBook } from '../../services/campus-ops';
import { listDepartments } from '../../services/academics';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const CATEGORY_OPTS = ['textbook','reference','journal','magazine','thesis','general','digital'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

export default function BooksPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ isbn:'', title:'', author:'', publisher:'', edition:'', year:'', category:'textbook', departmentId:'', totalCopies:'', availableCopies:'', location:'' });

  const { data, isLoading } = useQuery({ queryKey: ['books', page], queryFn: () => listBooks(page, 20) });
  const { data: deptsData } = useQuery({ queryKey: ['depts-ref','all'], queryFn: () => listDepartments(1, 200) });
  const depts = deptsData?.items || [];

  const createMut = useMutation({ mutationFn: createBook, onSuccess: () => { qc.invalidateQueries({ queryKey: ['books'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateBook(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['books'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteBook, onSuccess: () => qc.invalidateQueries({ queryKey: ['books'] }) });

  function openCreate() { setEditing(null); setForm({ isbn:'', title:'', author:'', publisher:'', edition:'', year:'', category:'textbook', departmentId:'', totalCopies:'', availableCopies:'', location:'' }); setModalOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm({ isbn: row.isbn||'', title: row.title||'', author: row.author||'', publisher: row.publisher||'', edition: row.edition||'', year: String(row.year??''), category: row.category||'textbook', departmentId: row.departmentId?._id||row.departmentId||'', totalCopies: String(row.totalCopies??''), availableCopies: String(row.availableCopies??''), location: row.location||'' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if(form.year) payload.year = Number(form.year);
    if(form.totalCopies) payload.totalCopies = Number(form.totalCopies);
    if(form.availableCopies) payload.availableCopies = Number(form.availableCopies);
    Object.keys(payload).forEach(k => { if(payload[k]===''||payload[k]===undefined) delete payload[k]; });
    if(editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'title', label: 'Title', render: (r: any) => <span className="font-medium text-navy">{r.title}</span> },
    { key: 'author', label: 'Author' },
    { key: 'isbn', label: 'ISBN', render: (r: any) => r.isbn||'\u2014' },
    { key: 'category', label: 'Category', render: (r: any) => r.category||'\u2014' },
    { key: 'copies', label: 'Copies', render: (r: any) => `${r.availableCopies||0}/${r.totalCopies||0}` },
    { key: 'actions', label: '', render: (r: any) => (<div className="flex gap-1"><button onClick={e=>{e.stopPropagation();openEdit(r)}} className="p-1 rounded hover:bg-amber-50"><Pencil size={15} className="text-amber-500"/></button><button onClick={e=>{e.stopPropagation();if(confirm('Delete?'))deleteMut.mutate(r._id)}} className="p-1 rounded hover:bg-red-50"><Trash2 size={15} className="text-red-500"/></button></div>) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Books</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"><Plus size={16}/> New</button>
      </div>
      <DataTable columns={columns} data={data?.items||[]} loading={isLoading}/>
      {data&&data.pages>1&&(<div className="flex items-center justify-center gap-2 mt-4"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button><span className="text-sm text-gray-500">Page {page} of {data.pages}</span><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button></div>)}
      <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit':'New'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>ISBN</label><input value={form.isbn} onChange={e=>setForm(fm=>({...fm,isbn:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Title *</label><input required value={form.title} onChange={e=>setForm(fm=>({...fm,title:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Author *</label><input required value={form.author} onChange={e=>setForm(fm=>({...fm,author:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Publisher</label><input value={form.publisher} onChange={e=>setForm(fm=>({...fm,publisher:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Edition</label><input value={form.edition} onChange={e=>setForm(fm=>({...fm,edition:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Year</label><input type="number" min={0} value={form.year} onChange={e=>setForm(fm=>({...fm,year:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Category</label><select value={form.category} onChange={e=>setForm(fm=>({...fm,category:e.target.value}))} className={inp}><option value="">None</option><option value="textbook">textbook</option><option value="reference">reference</option><option value="journal">journal</option><option value="magazine">magazine</option><option value="thesis">thesis</option><option value="general">general</option><option value="digital">digital</option></select></div>
            <div><label className={lbl}>Department <Link to="/academics" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10}/></Link></label><select value={form.departmentId} onChange={e=>setForm(fm=>({...fm,departmentId:e.target.value}))} className={inp}><option value="">Select...</option>{depts.map((x:any)=><option key={x._id} value={x._id}>{x.name}</option>)}</select></div>
            <div><label className={lbl}>Total Copies</label><input type="number" min={0} value={form.totalCopies} onChange={e=>setForm(fm=>({...fm,totalCopies:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Available</label><input type="number" min={0} value={form.availableCopies} onChange={e=>setForm(fm=>({...fm,availableCopies:e.target.value}))} className={inp}/></div>
            <div><label className={lbl}>Location</label><input value={form.location} onChange={e=>setForm(fm=>({...fm,location:e.target.value}))} className={inp}/></div>
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

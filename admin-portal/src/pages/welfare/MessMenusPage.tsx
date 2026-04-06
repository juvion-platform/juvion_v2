import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMessMenus, createMessMenu, updateMessMenu, deleteMessMenu, listHostelBlocks } from '../../services/welfare';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;
const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none";
const lbl = "block text-sm font-medium text-gray-700 mb-1";
const manageLink = "inline-flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-700 font-medium ml-1";

interface Meal { type: string; items: string; }
const emptyMeal = (): Meal => ({ type: 'breakfast', items: '' });

export default function MessMenusPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ blockId: '', day: 'monday', effectiveFrom: '', effectiveTo: '' });
  const [meals, setMeals] = useState<Meal[]>([emptyMeal()]);

  const { data, isLoading } = useQuery({ queryKey: ['mess-menus', page], queryFn: () => listMessMenus(page, 20) });
  const { data: blocksData } = useQuery({ queryKey: ['hostel-blocks', 'all'], queryFn: () => listHostelBlocks(1, 100) });
  const blocks = blocksData?.items || [];

  const createMut = useMutation({ mutationFn: createMessMenu, onSuccess: () => { qc.invalidateQueries({ queryKey: ['mess-menus'] }); closeModal(); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateMessMenu(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['mess-menus'] }); closeModal(); } });
  const deleteMut = useMutation({ mutationFn: deleteMessMenu, onSuccess: () => { qc.invalidateQueries({ queryKey: ['mess-menus'] }); } });

  function openCreate() {
    setEditing(null);
    setForm({ blockId: '', day: 'monday', effectiveFrom: '', effectiveTo: '' });
    setMeals([emptyMeal()]);
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    setForm({
      blockId: row.blockId?._id || row.blockId || '',
      day: row.day || 'monday',
      effectiveFrom: row.effectiveFrom ? row.effectiveFrom.slice(0, 10) : '',
      effectiveTo: row.effectiveTo ? row.effectiveTo.slice(0, 10) : '',
    });
    if (row.meals?.length) {
      setMeals(row.meals.map((m: any) => ({ type: m.type || 'breakfast', items: (m.items || []).join(', ') })));
    } else {
      setMeals([emptyMeal()]);
    }
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      ...form,
      meals: meals.map(m => ({ type: m.type, items: m.items.split(',').map(s => s.trim()).filter(Boolean) })),
    };
    if (!payload.blockId) delete payload.blockId;
    if (!payload.effectiveTo) delete payload.effectiveTo;
    if (editing) updateMut.mutate({ id: editing._id, data: payload });
    else createMut.mutate(payload);
  }

  const columns = [
    { key: 'day', label: 'Day', render: (r: any) => <span className="font-medium text-navy capitalize">{r.day}</span> },
    { key: 'blockId', label: 'Block', render: (r: any) => r.blockId?.name || 'All' },
    { key: 'meals', label: 'Meals', render: (r: any) => (r.meals || []).map((m: any) => m.type).join(', ') || '\u2014' },
    { key: 'effectiveFrom', label: 'From', render: (r: any) => r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleDateString() : '\u2014' },
    { key: 'effectiveTo', label: 'To', render: (r: any) => r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : '\u2014' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this menu?')) deleteMut.mutate(r._id); }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Mess Menus</h2>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          <Plus size={16} className="text-white" /> New Menu
        </button>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Mess Menu' : 'New Mess Menu'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>Day *</label>
              <select required value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))} className={inp}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Block <Link to="/welfare/hostel-blocks" target="_blank" className={manageLink}>+ Manage <ExternalLink size={10} /></Link></label>
              <select value={form.blockId} onChange={e => setForm(f => ({ ...f, blockId: e.target.value }))} className={inp}>
                <option value="">All blocks</option>
                {blocks.map((b: any) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Effective From *</label><input required type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Effective To</label><input type="date" value={form.effectiveTo} onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))} className={inp} /></div>
          </div>

          {/* Meals */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-800">Meals</label>
              <button type="button" onClick={() => setMeals(prev => [...prev, emptyMeal()])} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                <Plus size={14} /> Add Meal
              </button>
            </div>
            <div className="space-y-2">
              {meals.map((meal, idx) => (
                <div key={idx} className="grid grid-cols-[140px_1fr_auto] gap-2 items-center">
                  <select value={meal.type} onChange={e => setMeals(prev => prev.map((m, i) => i === idx ? { ...m, type: e.target.value } : m))} className={inp}>
                    {MEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={meal.items} onChange={e => setMeals(prev => prev.map((m, i) => i === idx ? { ...m, items: e.target.value } : m))} className={inp} placeholder="Items (comma-separated)" />
                  <button type="button" onClick={() => setMeals(prev => prev.filter((_, i) => i !== idx))} disabled={meals.length <= 1} className="p-1 rounded hover:bg-red-50 disabled:opacity-30">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

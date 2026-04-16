import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { listDocumentTemplates, createDocumentTemplate, generateDocument, listStudents } from '../../services/people';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none transition-colors';
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

const DOC_TYPE_COLOR: Record<string, string> = {
  transcript: 'info', provisional_certificate: 'purple', degree_certificate: 'success',
  transfer_certificate: 'warning', migration_certificate: 'orange', no_dues_certificate: 'teal',
  character_certificate: 'default', bonafide: 'info', study_certificate: 'default',
};

const DOC_TYPES = [
  'transcript', 'provisional_certificate', 'degree_certificate',
  'transfer_certificate', 'migration_certificate', 'no_dues_certificate',
  'character_certificate', 'bonafide', 'study_certificate',
] as const;

type ModalMode = 'template' | 'generate';

const emptyTemplateForm = {
  type: 'transfer_certificate' as string,
  name: '',
  version: '1.0',
  templateUrl: '',
  universityFormat: '',
};

const emptyGenerateForm = {
  studentId: '',
  templateId: '',
  type: 'transfer_certificate' as string,
  title: '',
  exitRequestId: '',
};

export default function ExitDocumentsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [open, setOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('template');
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [generateForm, setGenerateForm] = useState(emptyGenerateForm);

  const { data, isLoading } = useQuery({
    queryKey: ['document-templates', page, filterType],
    queryFn: () => listDocumentTemplates(page, 20, filterType || undefined),
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students-ref', 'all'],
    queryFn: () => listStudents(1, 200),
  });
  const studentOptions = studentsData?.items || [];

  const createTemplateMut = useMutation({
    mutationFn: createDocumentTemplate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['document-templates'] }); closeModal(); },
  });

  const generateMut = useMutation({
    mutationFn: generateDocument,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['document-templates'] }); closeModal(); },
  });

  function closeModal() {
    setOpen(false);
    setTemplateForm(emptyTemplateForm);
    setGenerateForm(emptyGenerateForm);
  }

  function openCreateTemplate() { setModalMode('template'); setTemplateForm(emptyTemplateForm); setOpen(true); }
  function openGenerate(template?: any) {
    setModalMode('generate');
    setGenerateForm({
      ...emptyGenerateForm,
      templateId: template?._id || '',
      type: template?.type || 'transfer_certificate',
      title: template?.name ? `${template.name} Document` : '',
    });
    setOpen(true);
  }

  function handleSubmitTemplate(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...templateForm };
    Object.keys(payload).forEach(key => { if (payload[key] === '') delete payload[key]; });
    createTemplateMut.mutate(payload);
  }

  function handleSubmitGenerate(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...generateForm };
    Object.keys(payload).forEach(key => { if (payload[key] === '') delete payload[key]; });
    generateMut.mutate(payload);
  }

  const saving = createTemplateMut.isPending || generateMut.isPending;
  const error = createTemplateMut.error || generateMut.error;

  const columns = [
    { key: 'name', label: 'Template Name', render: (r: any) => <span className="font-medium">{r.name || '—'}</span> },
    { key: 'type', label: 'Document Type', render: (r: any) => (
      <Badge variant={DOC_TYPE_COLOR[r.type] || 'default'}>{r.type?.replace(/_/g, ' ')}</Badge>
    )},
    { key: 'version', label: 'Version', render: (r: any) => r.version || '—' },
    { key: 'universityFormat', label: 'Univ. Format', render: (r: any) => r.universityFormat || '—' },
    { key: 'signatureSlots', label: 'Signatures', render: (r: any) => {
      const slots = r.signatureSlots || [];
      return slots.length > 0
        ? <span className="text-sm">{slots.map((s: any) => s.role).join(', ')}</span>
        : <span className="text-gray-400">—</span>;
    }},
    { key: 'createdAt', label: 'Created', render: (r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openGenerate(r); }} className="p-1 rounded hover:bg-green-50" title="Generate document from template">
          <Pencil size={15} className="text-green-600" />
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-navy">Exit Documents</h2>
        <div className="flex gap-3">
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Types</option>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={() => openGenerate()} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700">
            <Plus size={16} className="text-white" /> Generate Document
          </button>
          <button onClick={openCreateTemplate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> New Template
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data?.items || []} loading={isLoading} />

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Template / Generate Modal */}
      <Modal open={open} onClose={closeModal} title={modalMode === 'template' ? 'New Document Template' : 'Generate Document'} widthClass="max-w-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {(error as any)?.response?.data?.error || (error as any)?.response?.data?.details?.map((d: any) => d.message).join(', ') || 'Something went wrong.'}
          </div>
        )}

        {modalMode === 'template' ? (
          <form onSubmit={handleSubmitTemplate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Template Name *</label>
                <input required value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Document Type *</label>
                <select required value={templateForm.type} onChange={e => setTemplateForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Version *</label>
                <input required value={templateForm.version} onChange={e => setTemplateForm(f => ({ ...f, version: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>University Format</label>
                <input value={templateForm.universityFormat} onChange={e => setTemplateForm(f => ({ ...f, universityFormat: e.target.value }))} className={inp} />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Template URL</label>
                <input value={templateForm.templateUrl} onChange={e => setTemplateForm(f => ({ ...f, templateUrl: e.target.value }))} className={inp} placeholder="https://..." />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Template'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitGenerate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Student *</label>
                <select required value={generateForm.studentId} onChange={e => setGenerateForm(f => ({ ...f, studentId: e.target.value }))} className={inp}>
                  <option value="">Select student...</option>
                  {studentOptions.map((s: any) => (
                    <option key={s._id} value={s._id}>{s.person?.name || s.personId?.name || s.rollNumber || s._id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Document Type *</label>
                <select required value={generateForm.type} onChange={e => setGenerateForm(f => ({ ...f, type: e.target.value }))} className={inp}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Title *</label>
                <input required value={generateForm.title} onChange={e => setGenerateForm(f => ({ ...f, title: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Template ID (Optional)</label>
                <input value={generateForm.templateId} onChange={e => setGenerateForm(f => ({ ...f, templateId: e.target.value }))} className={inp} placeholder="Template ObjectId" />
              </div>
              <div>
                <label className={lbl}>Exit Request ID (Optional)</label>
                <input value={generateForm.exitRequestId} onChange={e => setGenerateForm(f => ({ ...f, exitRequestId: e.target.value }))} className={inp} placeholder="Exit Request ObjectId" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
                {saving ? 'Generating...' : 'Generate Document'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

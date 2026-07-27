import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as svc from '../../services/exam-config';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import {
  DoorOpen, UserCheck, Trophy, Building2, FileSpreadsheet, Stamp, Globe,
  Plus, Pencil, Trash2, Hash, Award, ArrowLeft,
} from 'lucide-react';
import { confirmAction } from '../../stores/confirmStore';
import { useListControls } from '../../hooks/useListControls';
import Pagination from '../../components/ui/Pagination';
import SearchInput from '../../components/ui/SearchInput';

// ─── Entity registry — one row per exam-config entity ───────────────
// Each entry maps an entity slug to the service calls + table columns.
// Adding a new entity = appending one descriptor; no new page needed.

interface EntityDescriptor {
  slug: string;
  label: string;
  description: string;
  icon: any;
  iconColor: string;
  cardinality: 'paged' | 'all';
  list: (p?: number, l?: number, search?: string) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  delete: (id: string) => Promise<any>;
  columns: { key: string; label: string; render: (r: any) => React.ReactNode }[];
  /** Field hints rendered in the JSON editor placeholder. */
  sampleShape: Record<string, unknown>;
}

const ENTITIES: Record<string, EntityDescriptor> = {
  rooms: {
    slug: 'rooms',
    label: 'Exam Rooms',
    description: 'Physical rooms used by exam scheduling. Define capacity + layout grid.',
    icon: DoorOpen,
    iconColor: 'bg-blue-50 text-blue-600',
    cardinality: 'paged',
    list: (p, l, q) => svc.listExamRooms(p, l, q),
    create: svc.createExamRoom, update: svc.updateExamRoom, delete: svc.deleteExamRoom,
    columns: [
      { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.code}</span> },
      { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'building', label: 'Building', render: (r) => r.building || '—' },
      { key: 'capacity', label: 'Capacity', render: (r) => r.capacity },
      { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'active' ? 'success' : 'default'}>{r.status}</Badge> },
    ],
    sampleShape: { code: 'R-101', name: 'Room 101', building: 'Block A', floor: 1, capacity: 60, layout: { rows: 6, cols: 10 }, approvedFor: ['regular', 'supplementary'], status: 'active' },
  },
  evaluators: {
    slug: 'evaluators',
    label: 'Evaluators',
    description: 'Paper evaluators (internal/external/cross-college). Tracks subjects approved + honorarium.',
    icon: UserCheck,
    iconColor: 'bg-purple-50 text-purple-600',
    cardinality: 'paged',
    list: (p, l, q) => svc.listEvaluators(p, l, q),
    create: svc.createEvaluator, update: svc.updateEvaluator, delete: svc.deleteEvaluator,
    columns: [
      { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'kind', label: 'Kind', render: (r) => <Badge variant={r.kind === 'internal' ? 'info' : 'default'}>{r.kind?.replace('_', ' ')}</Badge> },
      { key: 'subjectsApproved', label: 'Subjects', render: (r) => (r.subjectsApproved || []).slice(0, 3).join(', ') || 'All' },
      { key: 'honorariumPerScript', label: 'Honorarium/script', render: (r) => r.honorariumPerScript ? `₹${r.honorariumPerScript}` : '—' },
      { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'active' ? 'success' : 'default'}>{r.status}</Badge> },
    ],
    sampleShape: { kind: 'internal', name: 'Dr. Rama Rao', email: 'rama@college.edu', designation: 'Asst. Professor', subjectsApproved: ['CS101', 'CS201'], honorariumPerScript: 50, status: 'active' },
  },
  'grade-templates': {
    slug: 'grade-templates',
    label: 'Grade Templates',
    description: 'Grading schemes (absolute/relative × marks/percentage) with letter-grade band cutoffs.',
    icon: Trophy,
    iconColor: 'bg-amber-50 text-amber-600',
    cardinality: 'paged',
    list: (p, l, q) => svc.listGradeTemplates(p, l, q),
    create: svc.createGradeTemplate, update: svc.updateGradeTemplate, delete: svc.deleteGradeTemplate,
    columns: [
      { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'scheme', label: 'Scheme', render: (r) => <span className="capitalize">{r.scheme}</span> },
      { key: 'basis', label: 'Basis', render: (r) => <span className="capitalize">{r.basis}</span> },
      { key: 'bands', label: 'Bands', render: (r) => `${(r.bands || []).length} bands` },
      { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'active' ? 'success' : 'default'}>{r.status}</Badge> },
    ],
    sampleShape: { name: 'R20 B.Tech Absolute', scheme: 'absolute', basis: 'percentage', maxMarks: 100, bands: [{ letter: 'O', minValue: 90, gradePoint: 10 }, { letter: 'A+', minValue: 80, gradePoint: 9 }, { letter: 'A', minValue: 70, gradePoint: 8 }], status: 'active' },
  },
  'centre-templates': {
    slug: 'centre-templates',
    label: 'Exam Centre Templates',
    description: 'Reusable bundles of rooms + invigilator counts for recurring exam patterns.',
    icon: Building2,
    iconColor: 'bg-teal-50 text-teal-600',
    cardinality: 'paged',
    list: (p, l, q) => svc.listExamCentreTemplates(p, l, q),
    create: svc.createExamCentreTemplate, update: svc.updateExamCentreTemplate, delete: svc.deleteExamCentreTemplate,
    columns: [
      { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.code}</span> },
      { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'rooms', label: 'Rooms', render: (r) => `${(r.rooms || []).length} rooms` },
      { key: 'duration', label: 'Default Duration', render: (r) => r.defaultDurationMinutes ? `${r.defaultDurationMinutes} min` : '—' },
      { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'active' ? 'success' : 'default'}>{r.status}</Badge> },
    ],
    sampleShape: { code: 'MID1-BTECH', name: 'B.Tech Mid-1', defaultDurationMinutes: 90, rooms: [], applicableExamTypes: ['regular'], status: 'active' },
  },
  'question-papers': {
    slug: 'question-papers',
    label: 'Question Paper Schemas',
    description: 'Paper blueprints — sections × questions × marks. Used by paper-setting and answer-script grading.',
    icon: FileSpreadsheet,
    iconColor: 'bg-rose-50 text-rose-600',
    cardinality: 'paged',
    list: (p, l, q) => svc.listQuestionPapers(p, l, q),
    create: svc.createQuestionPaper, update: svc.updateQuestionPaper, delete: svc.deleteQuestionPaper,
    columns: [
      { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'examType', label: 'Exam Type', render: (r) => <span className="capitalize">{r.examType}</span> },
      { key: 'sections', label: 'Sections', render: (r) => `${(r.sections || []).length} sections` },
      { key: 'totalMarks', label: 'Marks', render: (r) => r.totalMarks },
      { key: 'duration', label: 'Duration', render: (r) => `${r.durationMinutes} min` },
      { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'approved' ? 'success' : r.status === 'draft' ? 'warning' : 'default'}>{r.status}</Badge> },
    ],
    sampleShape: { name: 'Mid-1 Pattern (R20)', examType: 'mid_1', sections: [{ name: 'A', questionCount: 5, marksPerQuestion: 2, internalChoice: false }, { name: 'B', questionCount: 5, marksPerQuestion: 10, internalChoice: true }], totalMarks: 60, durationMinutes: 90, status: 'draft' },
  },
  signatures: {
    slug: 'signatures',
    label: 'Signature Versions',
    description: 'Versioned signatures (Principal, Controller, etc.) for memos and certificates. Old certs render with the version valid at issue-time.',
    icon: Stamp,
    iconColor: 'bg-indigo-50 text-indigo-600',
    cardinality: 'all',
    list: () => svc.listSignatureTypes(),
    create: svc.createSignatureType, update: svc.updateSignatureType, delete: svc.deleteSignatureType,
    columns: [
      { key: 'role', label: 'Role', render: (r) => <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.role}</span> },
      { key: 'label', label: 'Label', render: (r) => <span className="font-medium">{r.label}</span> },
      { key: 'versions', label: 'Versions', render: (r) => `${(r.versions || []).length} versions` },
      { key: 'current', label: 'Current Holder', render: (r) => {
        const active = (r.versions || []).find((v: any) => v.status === 'active');
        return active ? active.holderName : <span className="text-gray-400">—</span>;
      }},
    ],
    sampleShape: { role: 'principal', label: 'Principal', versions: [{ versionNumber: 1, holderName: 'Dr. K. Reddy', holderDesignation: 'Principal', imageUrl: 's3://signatures/principal-v1.png', validFrom: '2024-06-01', status: 'active' }] },
  },
  'mooc-subjects': {
    slug: 'mooc-subjects',
    label: 'MOOC Subjects',
    description: 'UGC-permitted online courses for credit transfer (NPTEL, SWAYAM, Coursera, etc.).',
    icon: Globe,
    iconColor: 'bg-emerald-50 text-emerald-600',
    cardinality: 'paged',
    list: (p, l, q) => svc.listMoocSubjects(p, l, q),
    create: svc.createMoocSubject, update: svc.updateMoocSubject, delete: svc.deleteMoocSubject,
    columns: [
      { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.code}</span> },
      { key: 'title', label: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
      { key: 'provider', label: 'Provider', render: (r) => r.provider },
      { key: 'credits', label: 'Credits', render: (r) => r.credits },
      { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'active' ? 'success' : r.status === 'pending_approval' ? 'warning' : 'default'}>{(r.status || '').replace('_', ' ')}</Badge> },
    ],
    sampleShape: { code: 'NPTEL-CS-OS', title: 'Operating Systems', provider: 'NPTEL', credits: 3, durationWeeks: 12, providerUrl: 'https://nptel.ac.in/...', ugcApprovalRef: 'UGC-2025-OS-001', status: 'active' },
  },
};

// ─── Generic CRUD page ───────────────────────────────────────────

function EntityCRUDPage({ entity }: { entity: EntityDescriptor }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { page, setPage, limit, setLimit, search, setSearch } = useListControls();
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const queryKey = ['exam-config', entity.slug, page, limit, search];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => entity.list(page, limit, search),
  });

  const createMut = useMutation({
    mutationFn: (payload: any) => entity.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-config', entity.slug] }); closeModal(); },
    onError: (err: any) => alert(err?.response?.data?.error || err?.message || 'Create failed'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => entity.update(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exam-config', entity.slug] }); closeModal(); },
    onError: (err: any) => alert(err?.response?.data?.error || err?.message || 'Update failed'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => entity.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exam-config', entity.slug] }),
  });

  function openCreate() {
    setEditingRow(null);
    setJsonText(JSON.stringify(entity.sampleShape, null, 2));
    setJsonError(null);
    setModalOpen(true);
  }
  function openEdit(row: any) {
    setEditingRow(row);
    // Strip mongo/audit fields the user shouldn't be editing.
    const clean = { ...row };
    delete clean._id; delete clean.__v; delete clean.collegeId;
    delete clean.createdAt; delete clean.updatedAt;
    setJsonText(JSON.stringify(clean, null, 2));
    setJsonError(null);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditingRow(null);
    setJsonError(null);
  }

  function handleSubmit() {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e: any) {
      setJsonError(e.message);
      return;
    }
    if (editingRow) updateMut.mutate({ id: editingRow._id, payload: parsed });
    else createMut.mutate(parsed);
  }

  // Normalise list response — paged endpoints return { items, total, … },
  // the SignatureType endpoint returns { items } only.
  const items = (data?.items as any[]) || [];
  const pages = (data?.pages as number | undefined) || 1;

  const Icon = entity.icon;
  const columns = [
    ...entity.columns,
    { key: 'actions', label: '', render: (r: any) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 rounded hover:bg-amber-50" title="Edit"><Pencil size={15} className="text-amber-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); void confirmAction({ title: 'Delete this row?', tone: 'danger', confirmLabel: 'Delete' }).then((__c) => { if (__c.confirmed) { deleteMut.mutate(r._id); } }) }} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 size={15} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <button onClick={() => navigate('/academics/exam-config')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-3">
        <ArrowLeft size={14} /> All exam config
      </button>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${entity.iconColor}`}><Icon size={20} /></div>
          <div>
            <h2 className="text-xl font-bold text-navy">{entity.label}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{entity.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Search ${entity.label.toLowerCase()}…`}
            className="w-56"
          />
          <button onClick={openCreate} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            <Plus size={16} className="text-white" /> New
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        rowKey={(r: any) => r._id}
        onRowClick={(r: any) => openEdit(r)}
        emptyMessage={search ? `No {entity.label} match “${search}”.` : 'No {entity.label} yet.'}
      />

      {entity.cardinality === 'paged' && (
        <Pagination
          page={page}
          pages={pages}
          total={data?.total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingRow ? `Edit ${entity.label}` : `New ${entity.label}`}
        widthClass="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <strong>Phase A — JSON editor.</strong> Rich form UIs land in Phase B. Edit the JSON below; the backend validates against the Mongoose schema.
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
            rows={18}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none"
            spellCheck={false}
          />
          {jsonError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
              JSON parse error: {jsonError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {createMut.isPending || updateMut.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Hub page ────────────────────────────────────────────────────

function ExamConfigHub() {
  const navigate = useNavigate();
  return (
    <div>
      <h2 className="text-xl font-bold text-navy mb-2">Exam Configuration</h2>
      <p className="text-sm text-gray-500 mb-6">
        Master data for exam administration: rooms, evaluators, grading schemes, question-paper blueprints, signatures, and MOOC subjects. Versioned + auditable.
      </p>

      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Master Data</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {Object.values(ENTITIES).map((e) => {
          const Icon = e.icon;
          return (
            <button
              key={e.slug}
              onClick={() => navigate(e.slug)}
              className="text-left bg-white rounded-xl border-2 border-gray-200 shadow-sm p-5 hover:shadow-lg hover:border-primary-300 transition-all"
            >
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${e.iconColor}`}><Icon size={22} /></div>
              <div className="font-semibold text-navy-dark">{e.label}</div>
              <p className="text-xs text-gray-500 mt-1">{e.description}</p>
            </button>
          );
        })}
      </div>

      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Schema-Driven Catalogs</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/platform/config')}
          className="text-left bg-white rounded-xl border-2 border-gray-200 shadow-sm p-5 hover:shadow-lg hover:border-primary-300 transition-all"
        >
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-violet-50 text-violet-600"><Hash size={22} /></div>
          <div className="font-semibold text-navy-dark">Naming Series</div>
          <p className="text-xs text-gray-500 mt-1">Memo / PC / CGS / OD / accession-number counters and prefixes (managed via Platform → Configuration).</p>
        </button>
        <button
          onClick={() => navigate('/platform/config')}
          className="text-left bg-white rounded-xl border-2 border-gray-200 shadow-sm p-5 hover:shadow-lg hover:border-primary-300 transition-all"
        >
          <div className="inline-flex p-2.5 rounded-lg mb-3 bg-orange-50 text-orange-600"><Award size={22} /></div>
          <div className="font-semibold text-navy-dark">Award Classifications</div>
          <p className="text-xs text-gray-500 mt-1">CGPA/percentage thresholds with eligibility rules (managed via Platform → Configuration).</p>
        </button>
      </div>
    </div>
  );
}

// ─── Router-aware shell ──────────────────────────────────────────

export default function ExamConfigPage() {
  const params = useParams<{ entity?: string }>();
  const entitySlug = params.entity;

  if (!entitySlug) return <ExamConfigHub />;
  const entity = ENTITIES[entitySlug];
  if (!entity) return <div className="text-sm text-gray-500">Unknown exam-config entity: {entitySlug}</div>;
  return <EntityCRUDPage entity={entity} />;
}

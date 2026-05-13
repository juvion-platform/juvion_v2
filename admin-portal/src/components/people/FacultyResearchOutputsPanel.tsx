/**
 * FacultyResearchOutputsPanel — Phase B (original spec) panel.
 *
 * Three stacked sections covering NAAC criteria 3.1–3.4:
 *   - Publications  → NAAC 3.3 / 3.4 (indexing, quartile, percentile,
 *                                     level, SDG mapping, position)
 *   - Patents       → NAAC 3.3 (filed / granted, jurisdiction split)
 *   - Projects      → NAAC 3.1 / 3.2 (agency type, sanction amount)
 *
 * Same shape as FacultyTeachingPanel (list + add/edit modal per
 * section, soft-delete via archive). The forms here are heavier
 * because NAAC's scoring fields are explicit.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Award, Briefcase, Plus, Pencil, Trash2, Loader2,
  AlertCircle, ExternalLink,
} from 'lucide-react';

import Modal from '../ui/Modal';
import {
  listFacultyPublications, createFacultyPublication, updateFacultyPublication, archiveFacultyPublication,
  listFacultyPatents, createFacultyPatent, updateFacultyPatent, archiveFacultyPatent,
  listFacultyProjects, createFacultyProject, updateFacultyProject, archiveFacultyProject,
  FacultyPublicationDoc, FacultyPatentDoc, FacultyProjectDoc,
  FacultyPublicationIndexing, FacultyPublicationQuartile, FacultyPublicationLevel, FacultyPublicationType,
  FacultyPatentStatus, FacultyPatentInventorRole,
  FacultyProjectStatus, FacultyProjectAgencyType, FacultyProjectInvestigatorRole,
} from '../../services/faculty-teaching';

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 outline-none disabled:bg-gray-50 disabled:text-gray-700';
const lbl = 'block text-xs font-medium text-gray-700 mb-1';

// ─── Vocabularies ─────────────────────────────────────────────────

const PUBLICATION_INDEXING: ReadonlyArray<FacultyPublicationIndexing> = ['scopus', 'wos', 'ugc_care', 'other_indexed', 'none'];
const PUBLICATION_QUARTILES: ReadonlyArray<FacultyPublicationQuartile> = ['Q1', 'Q2', 'Q3', 'Q4'];
const PUBLICATION_LEVELS: ReadonlyArray<FacultyPublicationLevel> = ['international', 'national', 'regional'];
const PUBLICATION_TYPES: ReadonlyArray<FacultyPublicationType> = ['journal', 'conference', 'book_chapter', 'symposium'];

const PATENT_STATUSES: ReadonlyArray<FacultyPatentStatus> = ['filed', 'published', 'granted', 'abandoned', 'expired'];
const PATENT_INVENTOR_ROLES: ReadonlyArray<FacultyPatentInventorRole> = ['sole_inventor', 'first_inventor', 'co_inventor'];

const PROJECT_STATUSES: ReadonlyArray<FacultyProjectStatus> = ['proposed', 'ongoing', 'completed', 'terminated'];
const PROJECT_AGENCY_TYPES: ReadonlyArray<FacultyProjectAgencyType> = [
  'government_national', 'government_state', 'industry', 'international', 'non_government', 'internal',
];
const PROJECT_INVESTIGATOR_ROLES: ReadonlyArray<FacultyProjectInvestigatorRole> = ['pi', 'co_pi', 'investigator'];

// UN SDG labels for the multi-select. Codes ('sdg_1' … 'sdg_17') match
// what NAAC SSR templates use.
const SDG_OPTIONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'sdg_1',  label: 'SDG 1 · No Poverty' },
  { code: 'sdg_2',  label: 'SDG 2 · Zero Hunger' },
  { code: 'sdg_3',  label: 'SDG 3 · Good Health & Well-being' },
  { code: 'sdg_4',  label: 'SDG 4 · Quality Education' },
  { code: 'sdg_5',  label: 'SDG 5 · Gender Equality' },
  { code: 'sdg_6',  label: 'SDG 6 · Clean Water & Sanitation' },
  { code: 'sdg_7',  label: 'SDG 7 · Affordable & Clean Energy' },
  { code: 'sdg_8',  label: 'SDG 8 · Decent Work & Economic Growth' },
  { code: 'sdg_9',  label: 'SDG 9 · Industry, Innovation & Infra.' },
  { code: 'sdg_10', label: 'SDG 10 · Reduced Inequalities' },
  { code: 'sdg_11', label: 'SDG 11 · Sustainable Cities' },
  { code: 'sdg_12', label: 'SDG 12 · Responsible Consumption' },
  { code: 'sdg_13', label: 'SDG 13 · Climate Action' },
  { code: 'sdg_14', label: 'SDG 14 · Life Below Water' },
  { code: 'sdg_15', label: 'SDG 15 · Life on Land' },
  { code: 'sdg_16', label: 'SDG 16 · Peace, Justice, Strong Institutions' },
  { code: 'sdg_17', label: 'SDG 17 · Partnerships for the Goals' },
];

const STATUS_PILL: Record<string, string> = {
  filed:     'bg-blue-50 text-blue-800 border-blue-200',
  published: 'bg-blue-50 text-blue-800 border-blue-200',
  granted:   'bg-emerald-50 text-emerald-800 border-emerald-200',
  abandoned: 'bg-red-50 text-red-800 border-red-200',
  expired:   'bg-slate-50 text-slate-700 border-slate-200',
  proposed:  'bg-amber-50 text-amber-800 border-amber-200',
  ongoing:   'bg-blue-50 text-blue-800 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  terminated: 'bg-red-50 text-red-800 border-red-200',
};

const INDEXING_PILL: Record<FacultyPublicationIndexing, string> = {
  scopus:        'bg-orange-50 text-orange-800 border-orange-200',
  wos:           'bg-purple-50 text-purple-800 border-purple-200',
  ugc_care:      'bg-indigo-50 text-indigo-800 border-indigo-200',
  other_indexed: 'bg-slate-50 text-slate-700 border-slate-200',
  none:          'bg-gray-50 text-gray-500 border-gray-200',
};

const QUARTILE_PILL: Record<FacultyPublicationQuartile, string> = {
  Q1: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  Q2: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Q3: 'bg-amber-50 text-amber-800 border-amber-200',
  Q4: 'bg-slate-50 text-slate-700 border-slate-200',
};

function StatusPill({ value }: { value: string }) {
  const cls = STATUS_PILL[value] ?? 'bg-gray-50 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

/** Format INR with the Indian numbering convention (lakh / crore aware). */
function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── Top-level panel ──────────────────────────────────────────────

interface FacultyResearchOutputsPanelProps {
  facultyId: string;
}

export default function FacultyResearchOutputsPanel({ facultyId }: FacultyResearchOutputsPanelProps) {
  return (
    <div className="space-y-4">
      <PublicationsSection facultyId={facultyId} />
      <PatentsSection facultyId={facultyId} />
      <ProjectsSection facultyId={facultyId} />
    </div>
  );
}

// ─── Publications ─────────────────────────────────────────────────

function PublicationsSection({ facultyId }: { facultyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['faculty-publications', facultyId],
    queryFn: () => listFacultyPublications(facultyId),
    enabled: !!facultyId,
  });
  const items = data?.items ?? [];
  const [editing, setEditing] = useState<FacultyPublicationDoc | null | undefined>(undefined);

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveFacultyPublication(facultyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faculty-publications', facultyId] }),
  });

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <SectionHeader
        Icon={FileText}
        title="Publications"
        helper="NAAC 3.3 / 3.4 — papers in journals + conference proceedings. Captures indexing, quartile, impact percentile, level, SDG mapping for the NAAC SSR table."
        count={items.length}
        onAdd={() => setEditing(null)}
      />
      <div className="p-4">
        {isLoading && <LoadingRow />}
        {!isLoading && items.length === 0 && <EmptyRow text="No publications recorded yet." />}
        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="font-medium pb-1">Title / journal</th>
                <th className="font-medium pb-1">Year</th>
                <th className="font-medium pb-1">Indexing</th>
                <th className="font-medium pb-1">Quartile</th>
                <th className="font-medium pb-1">Level</th>
                <th className="font-medium pb-1">Position</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id} className="border-t border-gray-100">
                  <td className="py-1.5 max-w-md">
                    <div className="font-medium text-gray-800 line-clamp-1">{row.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {row.journal}
                      {row.doi && (
                        <a href={row.doi.startsWith('http') ? row.doi : `https://doi.org/${row.doi}`}
                           target="_blank" rel="noopener noreferrer"
                           className="ml-2 text-primary-600 hover:underline inline-flex items-center gap-0.5">
                          DOI <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 text-xs">{row.year}</td>
                  <td className="py-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${INDEXING_PILL[row.indexingService]}`}>
                      {row.indexingService.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-1.5">
                    {row.quartile ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${QUARTILE_PILL[row.quartile]}`}>
                        {row.quartile}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-1.5 text-xs capitalize">{row.level}</td>
                  <td className="py-1.5 text-xs">{row.authorPosition}</td>
                  <td className="py-1.5 text-right">
                    <RowActions onEdit={() => setEditing(row)} onArchive={() => archiveMut.mutate(row._id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing !== undefined && (
        <PublicationModal
          facultyId={facultyId}
          existing={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['faculty-publications', facultyId] });
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}

interface PublicationForm {
  title: string;
  authors: string;
  authorPosition: string;
  type: FacultyPublicationType;
  journal: string;
  publisher: string;
  year: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  indexingService: FacultyPublicationIndexing;
  quartile: FacultyPublicationQuartile | '';
  impactPercentile: string;
  level: FacultyPublicationLevel;
  sdgMapping: string[];
  citationCount: string;
  notes: string;
}

function PublicationModal({
  facultyId, existing, onClose, onSaved,
}: {
  facultyId: string;
  existing: FacultyPublicationDoc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PublicationForm>({
    title: existing?.title ?? '',
    authors: existing?.authors ?? '',
    authorPosition: existing?.authorPosition ?? 'first',
    type: existing?.type ?? 'journal',
    journal: existing?.journal ?? '',
    publisher: existing?.publisher ?? '',
    year: existing?.year !== undefined ? String(existing.year) : String(new Date().getFullYear()),
    volume: existing?.volume ?? '',
    issue: existing?.issue ?? '',
    pages: existing?.pages ?? '',
    doi: existing?.doi ?? '',
    indexingService: existing?.indexingService ?? 'none',
    quartile: existing?.quartile ?? '',
    impactPercentile: existing?.impactPercentile !== undefined ? String(existing.impactPercentile) : '',
    level: existing?.level ?? 'national',
    sdgMapping: existing?.sdgMapping ?? [],
    citationCount: existing?.citationCount !== undefined ? String(existing.citationCount) : '',
    notes: existing?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Partial<FacultyPublicationDoc> = {
        title: form.title.trim(),
        authors: form.authors.trim(),
        authorPosition: form.authorPosition.trim(),
        type: form.type,
        journal: form.journal.trim(),
        publisher: form.publisher.trim() || undefined,
        year: Number(form.year),
        volume: form.volume.trim() || undefined,
        issue: form.issue.trim() || undefined,
        pages: form.pages.trim() || undefined,
        doi: form.doi.trim() || undefined,
        indexingService: form.indexingService,
        level: form.level,
        sdgMapping: form.sdgMapping.length > 0 ? form.sdgMapping : undefined,
        notes: form.notes.trim() || undefined,
      };
      if (form.quartile) payload.quartile = form.quartile;
      if (form.impactPercentile) payload.impactPercentile = Number(form.impactPercentile);
      if (form.citationCount) payload.citationCount = Number(form.citationCount);
      return existing
        ? updateFacultyPublication(facultyId, existing._id, payload)
        : createFacultyPublication(facultyId, payload);
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Save failed'),
  });

  function toggleSdg(code: string) {
    setForm((f) => ({
      ...f,
      sdgMapping: f.sdgMapping.includes(code)
        ? f.sdgMapping.filter((c) => c !== code)
        : [...f.sdgMapping, code],
    }));
  }

  return (
    <Modal open={true} onClose={onClose} title={existing ? 'Edit publication' : 'Add publication'} widthClass="max-w-3xl">
      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}
        className="space-y-3"
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <label className={lbl}>Title <span className="text-red-500">*</span></label>
            <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inp} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Authors <span className="text-red-500">*</span></label>
            <input required value={form.authors} onChange={(e) => setForm((f) => ({ ...f, authors: e.target.value }))} className={inp} placeholder="As listed on the paper" />
          </div>
          <div>
            <label className={lbl}>This faculty position <span className="text-red-500">*</span></label>
            <input required value={form.authorPosition} onChange={(e) => setForm((f) => ({ ...f, authorPosition: e.target.value }))} className={inp} placeholder="first / corresponding / 3 of 5" />
          </div>
          <div>
            <label className={lbl}>Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FacultyPublicationType }))} className={inp}>
              {PUBLICATION_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Year <span className="text-red-500">*</span></label>
            <input required value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>DOI</label>
            <input value={form.doi} onChange={(e) => setForm((f) => ({ ...f, doi: e.target.value }))} className={inp} placeholder="10.xxxx/..." />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Journal / venue <span className="text-red-500">*</span></label>
            <input required value={form.journal} onChange={(e) => setForm((f) => ({ ...f, journal: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Publisher</label>
            <input value={form.publisher} onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Volume</label>
            <input value={form.volume} onChange={(e) => setForm((f) => ({ ...f, volume: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Issue</label>
            <input value={form.issue} onChange={(e) => setForm((f) => ({ ...f, issue: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Pages</label>
            <input value={form.pages} onChange={(e) => setForm((f) => ({ ...f, pages: e.target.value }))} className={inp} placeholder="e.g. 123-145" />
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-3">
          <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide">NAAC scoring fields</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Indexing service</label>
              <select value={form.indexingService} onChange={(e) => setForm((f) => ({ ...f, indexingService: e.target.value as FacultyPublicationIndexing }))} className={inp}>
                {PUBLICATION_INDEXING.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Quartile</label>
              <select value={form.quartile} onChange={(e) => setForm((f) => ({ ...f, quartile: e.target.value as FacultyPublicationQuartile | '' }))} className={inp}>
                <option value="">—</option>
                {PUBLICATION_QUARTILES.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Impact percentile (0–100)</label>
              <input type="number" min={0} max={100} value={form.impactPercentile} onChange={(e) => setForm((f) => ({ ...f, impactPercentile: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Level</label>
              <select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as FacultyPublicationLevel }))} className={inp}>
                {PUBLICATION_LEVELS.map((l) => <option key={l} value={l} className="capitalize">{l}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Citations</label>
              <input value={form.citationCount} onChange={(e) => setForm((f) => ({ ...f, citationCount: e.target.value }))} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>SDG mapping (select all that apply)</label>
            <div className="flex flex-wrap gap-1.5">
              {SDG_OPTIONS.map((s) => {
                const active = form.sdgMapping.includes(s.code);
                return (
                  <button
                    type="button"
                    key={s.code}
                    onClick={() => toggleSdg(s.code)}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                      active
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label className={lbl}>Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inp + ' min-h-[60px]'} rows={2} />
        </div>
        <ModalFooter onClose={onClose} saving={saveMut.isPending} error={error} isEdit={!!existing} />
      </form>
    </Modal>
  );
}

// ─── Patents ──────────────────────────────────────────────────────

function PatentsSection({ facultyId }: { facultyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['faculty-patents', facultyId],
    queryFn: () => listFacultyPatents(facultyId),
    enabled: !!facultyId,
  });
  const items = data?.items ?? [];
  const [editing, setEditing] = useState<FacultyPatentDoc | null | undefined>(undefined);

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveFacultyPatent(facultyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faculty-patents', facultyId] }),
  });

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <SectionHeader
        Icon={Award}
        title="Patents"
        helper="NAAC 3.3 — IP filings classified by jurisdiction and lifecycle stage (filed / published / granted)."
        count={items.length}
        onAdd={() => setEditing(null)}
      />
      <div className="p-4">
        {isLoading && <LoadingRow />}
        {!isLoading && items.length === 0 && <EmptyRow text="No patents recorded yet." />}
        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="font-medium pb-1">Title</th>
                <th className="font-medium pb-1">Application / Patent #</th>
                <th className="font-medium pb-1">Jurisdiction</th>
                <th className="font-medium pb-1">Filed</th>
                <th className="font-medium pb-1">Status</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id} className="border-t border-gray-100">
                  <td className="py-1.5 max-w-md">
                    <div className="font-medium text-gray-800 line-clamp-1">{row.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {row.inventorRole.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td className="py-1.5 text-xs font-mono">
                    {row.patentNumber || row.applicationNumber}
                  </td>
                  <td className="py-1.5 text-xs uppercase">{row.jurisdiction}</td>
                  <td className="py-1.5 text-xs">{new Date(row.filingDate).toLocaleDateString()}</td>
                  <td className="py-1.5"><StatusPill value={row.status} /></td>
                  <td className="py-1.5 text-right">
                    <RowActions onEdit={() => setEditing(row)} onArchive={() => archiveMut.mutate(row._id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing !== undefined && (
        <PatentModal
          facultyId={facultyId}
          existing={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['faculty-patents', facultyId] });
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}

interface PatentForm {
  title: string;
  inventors: string;
  inventorRole: FacultyPatentInventorRole;
  jurisdiction: string;
  applicationNumber: string;
  patentNumber: string;
  ipcClassification: string;
  filingDate: string;
  publicationDate: string;
  grantDate: string;
  status: FacultyPatentStatus;
  assignee: string;
  abstract: string;
  notes: string;
}

function PatentModal({
  facultyId, existing, onClose, onSaved,
}: {
  facultyId: string;
  existing: FacultyPatentDoc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PatentForm>({
    title: existing?.title ?? '',
    inventors: existing?.inventors ?? '',
    inventorRole: existing?.inventorRole ?? 'co_inventor',
    jurisdiction: existing?.jurisdiction ?? 'india',
    applicationNumber: existing?.applicationNumber ?? '',
    patentNumber: existing?.patentNumber ?? '',
    ipcClassification: existing?.ipcClassification ?? '',
    filingDate: existing?.filingDate ? existing.filingDate.substring(0, 10) : '',
    publicationDate: existing?.publicationDate ? existing.publicationDate.substring(0, 10) : '',
    grantDate: existing?.grantDate ? existing.grantDate.substring(0, 10) : '',
    status: existing?.status ?? 'filed',
    assignee: existing?.assignee ?? '',
    abstract: existing?.abstract ?? '',
    notes: existing?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Partial<FacultyPatentDoc> = {
        title: form.title.trim(),
        inventors: form.inventors.trim(),
        inventorRole: form.inventorRole,
        jurisdiction: form.jurisdiction.trim(),
        applicationNumber: form.applicationNumber.trim(),
        patentNumber: form.patentNumber.trim() || undefined,
        ipcClassification: form.ipcClassification.trim() || undefined,
        filingDate: form.filingDate,
        publicationDate: form.publicationDate || undefined,
        grantDate: form.grantDate || undefined,
        status: form.status,
        assignee: form.assignee.trim() || undefined,
        abstract: form.abstract.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      return existing
        ? updateFacultyPatent(facultyId, existing._id, payload)
        : createFacultyPatent(facultyId, payload);
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Save failed'),
  });

  return (
    <Modal open={true} onClose={onClose} title={existing ? 'Edit patent' : 'Add patent'} widthClass="max-w-3xl">
      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}
        className="space-y-3"
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <label className={lbl}>Title <span className="text-red-500">*</span></label>
            <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inp} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Inventors <span className="text-red-500">*</span></label>
            <input required value={form.inventors} onChange={(e) => setForm((f) => ({ ...f, inventors: e.target.value }))} className={inp} placeholder="Comma-separated" />
          </div>
          <div>
            <label className={lbl}>This faculty role</label>
            <select value={form.inventorRole} onChange={(e) => setForm((f) => ({ ...f, inventorRole: e.target.value as FacultyPatentInventorRole }))} className={inp}>
              {PATENT_INVENTOR_ROLES.map((r) => <option key={r} value={r} className="capitalize">{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Application # <span className="text-red-500">*</span></label>
            <input required value={form.applicationNumber} onChange={(e) => setForm((f) => ({ ...f, applicationNumber: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Patent # (granted)</label>
            <input value={form.patentNumber} onChange={(e) => setForm((f) => ({ ...f, patentNumber: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Jurisdiction <span className="text-red-500">*</span></label>
            <input required value={form.jurisdiction} onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))} className={inp} placeholder="india / us / wo" />
          </div>
          <div>
            <label className={lbl}>Filing date <span className="text-red-500">*</span></label>
            <input required type="date" value={form.filingDate} onChange={(e) => setForm((f) => ({ ...f, filingDate: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Publication date</label>
            <input type="date" value={form.publicationDate} onChange={(e) => setForm((f) => ({ ...f, publicationDate: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Grant date</label>
            <input type="date" value={form.grantDate} onChange={(e) => setForm((f) => ({ ...f, grantDate: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FacultyPatentStatus }))} className={inp}>
              {PATENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>IPC classification</label>
            <input value={form.ipcClassification} onChange={(e) => setForm((f) => ({ ...f, ipcClassification: e.target.value }))} className={inp} placeholder="e.g. G06F 17/30" />
          </div>
          <div className="col-span-3">
            <label className={lbl}>Assignee</label>
            <input value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} className={inp} placeholder="Default: this institution" />
          </div>
          <div className="col-span-3">
            <label className={lbl}>Abstract</label>
            <textarea value={form.abstract} onChange={(e) => setForm((f) => ({ ...f, abstract: e.target.value }))} className={inp + ' min-h-[60px]'} rows={2} />
          </div>
        </div>
        <ModalFooter onClose={onClose} saving={saveMut.isPending} error={error} isEdit={!!existing} />
      </form>
    </Modal>
  );
}

// ─── Projects ─────────────────────────────────────────────────────

function ProjectsSection({ facultyId }: { facultyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['faculty-projects', facultyId],
    queryFn: () => listFacultyProjects(facultyId),
    enabled: !!facultyId,
  });
  const items = data?.items ?? [];
  const [editing, setEditing] = useState<FacultyProjectDoc | null | undefined>(undefined);

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveFacultyProject(facultyId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faculty-projects', facultyId] }),
  });

  // Aggregate total sanction amount — NAAC 3.1.3 ratio depends on this.
  const totalSanction = items.reduce((s, r) => s + (r.sanctionAmount || 0), 0);

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <SectionHeader
        Icon={Briefcase}
        title="Sponsored projects"
        helper="NAAC 3.1 / 3.2 — funded research projects with agency type and sanction amount."
        count={items.length}
        onAdd={() => setEditing(null)}
      />
      <div className="p-4">
        {isLoading && <LoadingRow />}
        {!isLoading && items.length === 0 && <EmptyRow text="No projects recorded yet." />}
        {items.length > 0 && (
          <>
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="font-medium pb-1">Project / agency</th>
                  <th className="font-medium pb-1">Agency type</th>
                  <th className="font-medium pb-1">Role</th>
                  <th className="font-medium pb-1">Amount</th>
                  <th className="font-medium pb-1">Period</th>
                  <th className="font-medium pb-1">Status</th>
                  <th className="pb-1"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row._id} className="border-t border-gray-100">
                    <td className="py-1.5 max-w-md">
                      <div className="font-medium text-gray-800 line-clamp-1">{row.title}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{row.fundingAgency}</div>
                    </td>
                    <td className="py-1.5 text-xs">{row.agencyType.replace(/_/g, ' ')}</td>
                    <td className="py-1.5 text-xs uppercase">{row.investigatorRole}</td>
                    <td className="py-1.5 text-xs font-mono">{formatINR(row.sanctionAmount)}</td>
                    <td className="py-1.5 text-xs">
                      {new Date(row.startDate).getFullYear()}
                      {row.endDate ? ` – ${new Date(row.endDate).getFullYear()}` : ' – present'}
                    </td>
                    <td className="py-1.5"><StatusPill value={row.status} /></td>
                    <td className="py-1.5 text-right">
                      <RowActions onEdit={() => setEditing(row)} onArchive={() => archiveMut.mutate(row._id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-2 border-t text-xs text-gray-600 flex items-center justify-between">
              <span>Total sanctioned</span>
              <span className="font-mono font-semibold text-gray-800">{formatINR(totalSanction)}</span>
            </div>
          </>
        )}
      </div>
      {editing !== undefined && (
        <ProjectModal
          facultyId={facultyId}
          existing={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['faculty-projects', facultyId] });
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}

interface ProjectForm {
  title: string;
  fundingAgency: string;
  agencyType: FacultyProjectAgencyType;
  investigatorRole: FacultyProjectInvestigatorRole;
  coInvestigators: string;
  sanctionAmount: string;
  sanctionOrderNumber: string;
  sanctionOrderUrl: string;
  sanctionDate: string;
  startDate: string;
  endDate: string;
  durationMonths: string;
  status: FacultyProjectStatus;
  abstract: string;
  outcomes: string;
  notes: string;
}

function ProjectModal({
  facultyId, existing, onClose, onSaved,
}: {
  facultyId: string;
  existing: FacultyProjectDoc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProjectForm>({
    title: existing?.title ?? '',
    fundingAgency: existing?.fundingAgency ?? '',
    agencyType: existing?.agencyType ?? 'government_national',
    investigatorRole: existing?.investigatorRole ?? 'pi',
    coInvestigators: existing?.coInvestigators ?? '',
    sanctionAmount: existing?.sanctionAmount !== undefined ? String(existing.sanctionAmount) : '',
    sanctionOrderNumber: existing?.sanctionOrderNumber ?? '',
    sanctionOrderUrl: existing?.sanctionOrderUrl ?? '',
    sanctionDate: existing?.sanctionDate ? existing.sanctionDate.substring(0, 10) : '',
    startDate: existing?.startDate ? existing.startDate.substring(0, 10) : '',
    endDate: existing?.endDate ? existing.endDate.substring(0, 10) : '',
    durationMonths: existing?.durationMonths !== undefined ? String(existing.durationMonths) : '',
    status: existing?.status ?? 'ongoing',
    abstract: existing?.abstract ?? '',
    outcomes: existing?.outcomes ?? '',
    notes: existing?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Partial<FacultyProjectDoc> = {
        title: form.title.trim(),
        fundingAgency: form.fundingAgency.trim(),
        agencyType: form.agencyType,
        investigatorRole: form.investigatorRole,
        coInvestigators: form.coInvestigators.trim() || undefined,
        sanctionAmount: Number(form.sanctionAmount),
        sanctionOrderNumber: form.sanctionOrderNumber.trim() || undefined,
        sanctionOrderUrl: form.sanctionOrderUrl.trim() || undefined,
        sanctionDate: form.sanctionDate || undefined,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        status: form.status,
        abstract: form.abstract.trim() || undefined,
        outcomes: form.outcomes.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (form.durationMonths) payload.durationMonths = Number(form.durationMonths);
      return existing
        ? updateFacultyProject(facultyId, existing._id, payload)
        : createFacultyProject(facultyId, payload);
    },
    onSuccess: () => onSaved(),
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Save failed'),
  });

  return (
    <Modal open={true} onClose={onClose} title={existing ? 'Edit project' : 'Add sponsored project'} widthClass="max-w-3xl">
      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); saveMut.mutate(); }}
        className="space-y-3"
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <label className={lbl}>Project title <span className="text-red-500">*</span></label>
            <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inp} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Funding agency <span className="text-red-500">*</span></label>
            <input required value={form.fundingAgency} onChange={(e) => setForm((f) => ({ ...f, fundingAgency: e.target.value }))} className={inp} placeholder="e.g. SERB, DST, Infosys" />
          </div>
          <div>
            <label className={lbl}>Agency type</label>
            <select value={form.agencyType} onChange={(e) => setForm((f) => ({ ...f, agencyType: e.target.value as FacultyProjectAgencyType }))} className={inp}>
              {PROJECT_AGENCY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>This faculty role</label>
            <select value={form.investigatorRole} onChange={(e) => setForm((f) => ({ ...f, investigatorRole: e.target.value as FacultyProjectInvestigatorRole }))} className={inp}>
              {PROJECT_INVESTIGATOR_ROLES.map((r) => <option key={r} value={r} className="uppercase">{r}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>Co-investigators</label>
            <input value={form.coInvestigators} onChange={(e) => setForm((f) => ({ ...f, coInvestigators: e.target.value }))} className={inp} placeholder="Comma-separated" />
          </div>
          <div>
            <label className={lbl}>Sanction amount (INR) <span className="text-red-500">*</span></label>
            <input required type="number" min={0} value={form.sanctionAmount} onChange={(e) => setForm((f) => ({ ...f, sanctionAmount: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Sanction order #</label>
            <input value={form.sanctionOrderNumber} onChange={(e) => setForm((f) => ({ ...f, sanctionOrderNumber: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Sanction date</label>
            <input type="date" value={form.sanctionDate} onChange={(e) => setForm((f) => ({ ...f, sanctionDate: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Start date <span className="text-red-500">*</span></label>
            <input required type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>End date</label>
            <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Duration (months)</label>
            <input value={form.durationMonths} onChange={(e) => setForm((f) => ({ ...f, durationMonths: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FacultyProjectStatus }))} className={inp}>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-3">
            <label className={lbl}>Sanction order link</label>
            <input value={form.sanctionOrderUrl} onChange={(e) => setForm((f) => ({ ...f, sanctionOrderUrl: e.target.value }))} className={inp} placeholder="https://..." />
          </div>
          <div className="col-span-3">
            <label className={lbl}>Abstract</label>
            <textarea value={form.abstract} onChange={(e) => setForm((f) => ({ ...f, abstract: e.target.value }))} className={inp + ' min-h-[60px]'} rows={2} />
          </div>
          <div className="col-span-3">
            <label className={lbl}>Outcomes (deliverables, publications produced, …)</label>
            <textarea value={form.outcomes} onChange={(e) => setForm((f) => ({ ...f, outcomes: e.target.value }))} className={inp + ' min-h-[60px]'} rows={2} />
          </div>
        </div>
        <ModalFooter onClose={onClose} saving={saveMut.isPending} error={error} isEdit={!!existing} />
      </form>
    </Modal>
  );
}

// ─── Shared row chrome ────────────────────────────────────────────

function SectionHeader({
  Icon, title, helper, count, onAdd,
}: {
  Icon: typeof FileText;
  title: string;
  helper: string;
  count: number;
  onAdd: () => void;
}) {
  return (
    <div className="px-5 py-3 border-b bg-navy/[0.03] flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-navy-dark text-sm flex items-center gap-2">
          <Icon size={15} className="text-navy/70" />
          {title}
          {count > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-100 text-primary-800 border border-primary-200">
              {count}
            </span>
          )}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">{helper}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded border border-primary-200"
      >
        <Plus size={12} /> Add
      </button>
    </div>
  );
}

function RowActions({ onEdit, onArchive }: { onEdit: () => void; onArchive: () => void }) {
  return (
    <div className="flex gap-1 justify-end">
      <button
        type="button"
        onClick={onEdit}
        className="p-1 rounded hover:bg-amber-50 text-amber-600"
        title="Edit"
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={() => {
          if (window.confirm('Archive this entry?')) onArchive();
        }}
        className="p-1 rounded hover:bg-red-50 text-red-600"
        title="Archive"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
      <Loader2 size={14} className="animate-spin" /> Loading…
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="text-sm text-gray-500 italic py-2">{text}</div>;
}

function ModalFooter({
  onClose, saving, error, isEdit,
}: {
  onClose: () => void;
  saving: boolean;
  error: string | null;
  isEdit: boolean;
}) {
  return (
    <>
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-start gap-1.5">
          <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </>
  );
}

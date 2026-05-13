/**
 * FacultyDocumentsPanel — credential-evidence upload panel for the
 * Faculty Profile depth feature (Strategic Gap 1 Phase B2).
 *
 * Phase B2 extends the proof-of-pattern (PhD certificate, B1) to the
 * full 12-category × 24-doc-type evidence catalog every NAAC-shaped
 * Indian college needs. The backend (`FacultyDocument` model + 5
 * routes) doesn't change — the surface here is the single source of
 * truth for what categories and document types Juvion supports.
 *
 * Phase B3 (next session) is the verification workflow: admin
 * approve/reject endpoints + an admin queue page. For now uploads
 * always land as `verificationStatus = 'pending'`.
 *
 * Layout choices:
 *   - Categories are collapsible sections. By default we expand any
 *     category that has at least one uploaded doc + the first two
 *     categories. Empty categories collapse so the page stays compact
 *     even with 24 cards.
 *   - Each card is one document type. 1:1 cards show a single doc
 *     with a Replace action (atomically chains upload+archive in the
 *     frontend). 1:N cards show every non-archived doc as a row plus
 *     an "Add another" affordance.
 *   - We do NOT enforce 1:1 at the API layer — if a frontend bug
 *     accidentally uploads two PAN cards, the UI shows both with
 *     individual Archive actions so the operator can fix it.
 */

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Upload, Loader2, CheckCircle2, Clock, XCircle,
  AlertTriangle, ExternalLink, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react';

import {
  listFacultyDocuments,
  uploadFacultyDocument,
  getFacultyDocumentViewUrl,
  archiveFacultyDocument,
  FacultyDocumentDoc,
  FacultyDocumentCategory,
} from '../../services/faculty-documents';

// ─── Doc type catalog ─────────────────────────────────────────────────

interface DocTypeDef {
  documentType: string;
  category: FacultyDocumentCategory;
  label: string;
  helper: string;
  /**
   * True iff at most one doc of this type should exist per faculty.
   * Uploading a new one archives the previous; the UI never shows
   * more than the latest. False = list grows with every upload.
   */
  oneToOne: boolean;
}

/**
 * The 24 NAAC / NBA / AICTE document types Phase B2 covers. Order
 * within each category drives the render order. Adding a new type
 * later is a single-line change — no backend impact because
 * `documentType` is an open string at the model layer.
 */
const DOC_TYPES: ReadonlyArray<DocTypeDef> = [
  // ─── Identity & legal ──
  { category: 'identity', documentType: 'pan_card',         label: 'PAN Card',                 helper: 'Permanent Account Number issued by Income Tax Department.',          oneToOne: true },
  { category: 'identity', documentType: 'aadhaar_card',     label: 'Aadhaar Card',             helper: 'Unique Identification Authority of India ID. Mask middle 8 digits if shown publicly.', oneToOne: true },
  { category: 'identity', documentType: 'passport',         label: 'Passport',                 helper: 'Optional — required for NRI / international postings.',              oneToOne: true },

  // ─── Education ──
  { category: 'education', documentType: 'tenth_certificate',   label: '10th Certificate',           helper: 'SSC / matriculation. Also serves as the canonical date-of-birth proof.', oneToOne: true },
  { category: 'education', documentType: 'twelfth_certificate', label: '12th Certificate',           helper: 'HSC / intermediate / pre-university.',                                   oneToOne: true },
  { category: 'education', documentType: 'ug_certificate',      label: 'Undergraduate Certificate',  helper: 'Final degree certificate + consolidated marks sheet.',                  oneToOne: true },
  { category: 'education', documentType: 'pg_certificate',      label: 'Postgraduate Certificate',   helper: 'Final degree certificate + consolidated marks sheet.',                  oneToOne: true },
  { category: 'education', documentType: 'phd_certificate',     label: 'PhD Certificate',            helper: 'Final degree certificate from the awarding university. NAAC 2.4.2 evidence.', oneToOne: true },

  // ─── Professional certifications ──
  { category: 'certification', documentType: 'net_certificate',     label: 'NET / CSIR-NET',     helper: 'UGC / CSIR National Eligibility Test certificate.', oneToOne: true },
  { category: 'certification', documentType: 'set_certificate',     label: 'SET / SLET',         helper: 'State Eligibility Test certificate.',               oneToOne: true },
  { category: 'certification', documentType: 'gate_scorecard',      label: 'GATE Scorecard',     helper: 'Graduate Aptitude Test in Engineering — original scorecard.', oneToOne: true },

  // ─── Experience (1:N — one per prior employer) ──
  { category: 'experience', documentType: 'experience_certificate', label: 'Experience Certificate', helper: 'One bundle per prior employer (appointment + experience + relieving). NAAC 2.4.1 / NBA Form Q.', oneToOne: false },

  // ─── Current employment ──
  { category: 'current_employment', documentType: 'joining_letter',     label: 'Joining Letter',     helper: 'Joining letter at the current institution.', oneToOne: true },
  { category: 'current_employment', documentType: 'appointment_order',  label: 'Appointment Order',  helper: 'Latest appointment / promotion order.',     oneToOne: true },

  // ─── Training & FDP (1:N) ──
  { category: 'training', documentType: 'fdp_certificate',                label: 'FDP Certificate',                 helper: 'Faculty Development Programme attendance / participation. NAAC 6.3.3.',  oneToOne: false },
  { category: 'training', documentType: 'refresher_course_certificate',   label: 'Refresher / Orientation Course',  helper: 'UGC Academic Staff College / induction programme.',                       oneToOne: false },

  // ─── Awards & recognition (1:N) ──
  { category: 'award', documentType: 'award_letter', label: 'Award Letter / Citation', helper: 'Best paper, best teacher, fellowship, state/central/international awards. NAAC 2.4.4.', oneToOne: false },

  // ─── Memberships (1:N) ──
  { category: 'membership', documentType: 'membership_certificate', label: 'Professional Membership', helper: 'IEEE, ACM, ISTE, IETE, IEI, editorial boards, review panels. NAAC 3.5.1.', oneToOne: false },

  // ─── Administrative appointments (1:N) ──
  { category: 'administrative', documentType: 'administrative_order', label: 'Administrative Order', helper: 'HoD / Dean / BoS / IQAC / committee appointment orders. NAAC 6.2.1.', oneToOne: false },

  // ─── HR / payroll ──
  { category: 'hr_payroll', documentType: 'bank_account_proof', label: 'Bank Account Proof', helper: 'Cancelled cheque or passbook scan for salary credit.', oneToOne: true },
  { category: 'hr_payroll', documentType: 'pf_uan_proof',       label: 'PF / UAN Proof',     helper: 'Provident Fund Universal Account Number letter.',     oneToOne: true },
  { category: 'hr_payroll', documentType: 'esi_proof',          label: 'ESI Proof',          helper: 'Employees State Insurance card / number.',           oneToOne: true },

  // ─── Self declarations (1:1, but renewed annually) ──
  { category: 'self_declaration', documentType: 'conflict_of_interest', label: 'Conflict of Interest Declaration', helper: 'Annual declaration. Replacing supersedes the prior year.', oneToOne: true },
  { category: 'self_declaration', documentType: 'anti_ragging',         label: 'Anti-Ragging Undertaking',          helper: 'Annual undertaking per UGC anti-ragging regulations.',     oneToOne: true },
];

/** Display labels for the 12 categories. `research` is reserved for
 *  Phase B sub-collections (Publications, Patents, Projects) and is
 *  intentionally absent from DOC_TYPES — that data has structured
 *  fields, not just files. */
const CATEGORY_LABELS: Record<FacultyDocumentCategory, string> = {
  identity: 'Identity & legal',
  education: 'Education',
  certification: 'Professional certifications',
  experience: 'Experience',
  current_employment: 'Current employment',
  research: 'Research',
  training: 'Training & FDP',
  award: 'Awards & recognition',
  membership: 'Memberships',
  administrative: 'Administrative appointments',
  hr_payroll: 'HR & payroll',
  self_declaration: 'Self declarations',
};

/**
 * Status pill for the verification workflow. Phase B3 wires the
 * approve/reject actions; for now every fresh upload lands as
 * 'pending'.
 */
const STATUS_BADGE: Record<FacultyDocumentDoc['verificationStatus'], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  pending:  { label: 'Pending verification', cls: 'bg-amber-50 text-amber-800 border-amber-200',         Icon: Clock },
  approved: { label: 'Verified',              cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  rejected: { label: 'Rejected',              cls: 'bg-red-50 text-red-800 border-red-200',             Icon: XCircle },
};

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Group DOC_TYPES by category preserving the table-defined order. */
function groupDocTypesByCategory(): Array<{ category: FacultyDocumentCategory; types: DocTypeDef[] }> {
  const groups: Array<{ category: FacultyDocumentCategory; types: DocTypeDef[] }> = [];
  for (const dt of DOC_TYPES) {
    const last = groups[groups.length - 1];
    if (!last || last.category !== dt.category) {
      groups.push({ category: dt.category, types: [dt] });
    } else {
      last.types.push(dt);
    }
  }
  return groups;
}

// ─── Top-level panel ──────────────────────────────────────────────────

interface FacultyDocumentsPanelProps {
  facultyId: string;
}

export default function FacultyDocumentsPanel({ facultyId }: FacultyDocumentsPanelProps) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['faculty-documents', facultyId],
    queryFn: () => listFacultyDocuments(facultyId),
    enabled: !!facultyId,
  });
  const docs: FacultyDocumentDoc[] = data?.items ?? [];

  // documentType → array of non-archived docs (already filtered server-side).
  const docsByType = useMemo(() => {
    const map = new Map<string, FacultyDocumentDoc[]>();
    for (const d of docs) {
      const arr = map.get(d.documentType) ?? [];
      arr.push(d);
      map.set(d.documentType, arr);
    }
    return map;
  }, [docs]);

  const groups = useMemo(groupDocTypesByCategory, []);

  // Default-expanded categories: any that has at least one uploaded
  // doc + the first two so the operator sees something on first paint.
  const [expanded, setExpanded] = useState<Set<FacultyDocumentCategory>>(() => {
    const initial = new Set<FacultyDocumentCategory>();
    groups.slice(0, 2).forEach((g) => initial.add(g.category));
    return initial;
  });
  // Auto-expand any category that gets a doc — wire on query result.
  const autoExpandedRef = useRef(new Set<FacultyDocumentCategory>());
  if (docs.length > 0) {
    for (const d of docs) {
      if (!autoExpandedRef.current.has(d.category)) {
        autoExpandedRef.current.add(d.category);
        if (!expanded.has(d.category)) {
          // Defer state update to avoid setting during render — using
          // a microtask so the next paint reflects the expansion.
          queueMicrotask(() =>
            setExpanded((prev) => {
              if (prev.has(d.category)) return prev;
              const next = new Set(prev);
              next.add(d.category);
              return next;
            }),
          );
        }
      }
    }
  }

  function toggleCategory(category: FacultyDocumentCategory) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="font-medium">
          Credential documents — {docs.length} uploaded across {DOC_TYPES.length} supported types
        </p>
        <p className="text-xs text-blue-800 mt-1">
          Upload PDF / JPEG / PNG / WebP up to 10 MB. Uploads land as
          <span className="font-mono mx-1">pending verification</span>
          until an administrator approves them. Phase B3 wires the
          approve / reject workflow.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 p-4">
          <Loader2 size={14} className="animate-spin" /> Loading documents…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          Couldn't load documents. {(error as any)?.message ?? ''}
        </div>
      )}

      {groups.map((group) => {
        const isExpanded = expanded.has(group.category);
        const populated = group.types.reduce(
          (acc, t) => acc + (docsByType.get(t.documentType)?.length ?? 0),
          0,
        );
        return (
          <section key={group.category} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCategory(group.category)}
              className="w-full flex items-center justify-between px-5 py-3 bg-navy/[0.03] hover:bg-navy/[0.05] border-b transition-colors"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-2">
                {isExpanded
                  ? <ChevronDown size={16} className="text-gray-500" />
                  : <ChevronRight size={16} className="text-gray-500" />}
                <span className="font-semibold text-navy-dark text-sm">
                  {CATEGORY_LABELS[group.category]}
                </span>
                <span className="text-xs text-gray-500">
                  ({populated > 0 ? `${populated} uploaded · ` : ''}{group.types.length} type{group.types.length === 1 ? '' : 's'})
                </span>
              </div>
              {populated > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                  {populated}
                </span>
              )}
            </button>
            {isExpanded && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.types.map((dt) => (
                  <DocumentCard
                    key={dt.documentType}
                    facultyId={facultyId}
                    spec={dt}
                    docs={docsByType.get(dt.documentType) ?? []}
                    onMutated={() => qc.invalidateQueries({ queryKey: ['faculty-documents', facultyId] })}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ─── Single card ──────────────────────────────────────────────────────

interface DocumentCardProps {
  facultyId: string;
  spec: DocTypeDef;
  docs: FacultyDocumentDoc[];
  onMutated: () => void;
}

function DocumentCard({ facultyId, spec, docs, onMutated }: DocumentCardProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For 1:1, "Replace" semantics: upload new first, then archive the
  // previous best-effort. If archive fails (transient Mongo / network
  // flake) the UI just shows both docs and the operator can archive
  // manually — same path as a 1:N type, so no broken state.
  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      await uploadFacultyDocument(facultyId, {
        file,
        category: spec.category,
        documentType: spec.documentType,
        title: spec.label,
      });
      if (spec.oneToOne) {
        // Archive every previously-existing doc of this type. Usually
        // there's at most one, but defend against pre-existing dupes.
        for (const old of docs) {
          await archiveFacultyDocument(facultyId, old._id).catch(() => {});
        }
      }
      onMutated();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleView(doc: FacultyDocumentDoc) {
    try {
      const { url } = await getFacultyDocumentViewUrl(facultyId, doc._id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Could not generate view URL');
    }
  }

  async function handleArchive(doc: FacultyDocumentDoc) {
    if (!window.confirm(`Archive "${doc.title}"? You can re-upload anytime.`)) return;
    try {
      await archiveFacultyDocument(facultyId, doc._id);
      onMutated();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Archive failed');
    }
  }

  const isEmpty = docs.length === 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b bg-gray-50/60">
        <h4 className="text-sm font-medium text-navy-dark flex items-center gap-1.5">
          <FileText size={13} className="text-navy/70" />
          {spec.label}
          {!spec.oneToOne && (
            <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold bg-gray-100 border border-gray-200 px-1 rounded ml-1">
              multi
            </span>
          )}
        </h4>
        <p className="text-xs text-gray-500 mt-0.5">{spec.helper}</p>
      </div>

      <div className="p-3 flex-1">
        {isEmpty ? (
          <div
            className="border-2 border-dashed border-gray-300 rounded p-4 text-center bg-gray-50/40 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
            role="button"
            tabIndex={0}
          >
            <Upload size={16} className="text-gray-400 mx-auto" />
            <p className="text-xs text-gray-600 mt-1">Click to upload</p>
            <p className="text-[11px] text-gray-400 mt-0.5">PDF / JPEG / PNG / WebP · 10 MB max</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {docs.map((doc) => {
              const badge = STATUS_BADGE[doc.verificationStatus];
              const StatusIcon = badge.Icon;
              return (
                <div key={doc._id} className="rounded border border-gray-200 px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{doc.title}</div>
                    <div className="text-gray-500 mt-0.5">
                      {doc.mimeType.replace('application/', '').replace('image/', '').toUpperCase()}
                      {' · '}{formatBytes(doc.sizeBytes)}
                      {doc.createdAt && <> · {new Date(doc.createdAt).toLocaleDateString()}</>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap ${badge.cls}`}>
                    <StatusIcon size={10} /> {badge.label}
                  </span>
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleView(doc)}
                      title="View"
                      className="p-1 rounded hover:bg-primary-50 text-primary-700"
                    >
                      <ExternalLink size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive(doc)}
                      title="Archive"
                      className="p-1 rounded hover:bg-red-50 text-red-700"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-700 bg-primary-50/60 hover:bg-primary-50 rounded border border-dashed border-primary-200"
            >
              <Upload size={12} />
              {spec.oneToOne ? 'Replace' : '+ Add another'}
            </button>
          </div>
        )}

        {uploading && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
            <Loader2 size={12} className="animate-spin" /> Uploading…
          </div>
        )}
        {error && (
          <div className="mt-2 rounded border border-red-200 bg-red-50 p-1.5 text-[11px] text-red-700 flex items-start gap-1.5">
            <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </div>
    </div>
  );
}

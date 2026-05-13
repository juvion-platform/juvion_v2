/**
 * FacultyDocumentsPanel — credential-evidence upload panel for the
 * Faculty Profile depth feature (Strategic Gap 1 Phase B).
 *
 * v1 (Phase B1) is a deliberately tight proof-of-pattern: only the
 * PhD-certificate card is wired end-to-end. The component is
 * structured so adding the remaining ~11 categories in Phase B2 is
 * just adding more `DOC_TYPES` rows — no new shape, no new wiring.
 *
 * Why a generic structure for one card today:
 *   - We need to lock the upload contract once. Adding categories
 *     mechanically beats refactoring the upload widget per category.
 *   - The view-signed-url flow and verification badge already need to
 *     work for every category, so build them once.
 */

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Upload, Loader2, CheckCircle2, Clock, XCircle,
  AlertTriangle, ExternalLink, Trash2,
} from 'lucide-react';

import {
  listFacultyDocuments,
  uploadFacultyDocument,
  getFacultyDocumentViewUrl,
  archiveFacultyDocument,
  FacultyDocumentDoc,
  FacultyDocumentCategory,
} from '../../services/faculty-documents';

/**
 * The 1:1 document types Phase B1 ships. Each entry maps a specific
 * `documentType` slug to a (category, display label, helper).
 * Phase B2 will extend this list and ALSO expose a "+ Add doc"
 * affordance for free-form types within each category.
 */
interface DocTypeDef {
  documentType: string;
  category: FacultyDocumentCategory;
  label: string;
  helper: string;
  /** True if at most one document of this type should exist per faculty. */
  oneToOne: boolean;
}

const DOC_TYPES: ReadonlyArray<DocTypeDef> = [
  {
    documentType: 'phd_certificate',
    category: 'education',
    label: 'PhD Certificate',
    helper:
      'Final degree certificate from the awarding university. NAAC 2.4.2 evidence. PDF preferred; scanned images accepted.',
    oneToOne: true,
  },
  // Phase B2 will add: pan_card, aadhaar_card, ten_th_certificate,
  // twelth_certificate, ug_certificate, pg_certificate, net_certificate,
  // experience_certificate, fdp_certificate, award_certificate, etc.
];

const STATUS_BADGE: Record<FacultyDocumentDoc['verificationStatus'], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  pending:  { label: 'Pending verification', cls: 'bg-amber-50 text-amber-800 border-amber-200',   Icon: Clock },
  approved: { label: 'Verified',              cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  rejected: { label: 'Rejected',              cls: 'bg-red-50 text-red-800 border-red-200',         Icon: XCircle },
};

interface FacultyDocumentsPanelProps {
  facultyId: string;
}

/** Format bytes → KB / MB string for display. */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FacultyDocumentsPanel({ facultyId }: FacultyDocumentsPanelProps) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['faculty-documents', facultyId],
    queryFn: () => listFacultyDocuments(facultyId),
    enabled: !!facultyId,
  });
  const docs: FacultyDocumentDoc[] = data?.items ?? [];

  // Group docs by `documentType` so each card knows whether its slot
  // is filled. For 1:1 types the array length is always 0 or 1.
  const docsByType = new Map<string, FacultyDocumentDoc[]>();
  for (const d of docs) {
    const arr = docsByType.get(d.documentType) ?? [];
    arr.push(d);
    docsByType.set(d.documentType, arr);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="font-medium">Credential documents (Phase B1 — proof of pattern)</p>
        <p className="text-xs text-blue-800 mt-1">
          One card per document type. v1 ships the PhD certificate end-to-end;
          Phase B2 will add the remaining ~80 credential-evidence types across
          12 categories on this same surface. Upload supports PDF / JPEG / PNG /
          WebP up to 10 MB.
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

      {DOC_TYPES.map((dt) => {
        const matches = docsByType.get(dt.documentType) ?? [];
        const filled = matches.length > 0;
        return (
          <DocumentCard
            key={dt.documentType}
            facultyId={facultyId}
            spec={dt}
            existing={filled ? matches[0]! : null}
            onMutated={() => qc.invalidateQueries({ queryKey: ['faculty-documents', facultyId] })}
          />
        );
      })}
    </div>
  );
}

interface DocumentCardProps {
  facultyId: string;
  spec: DocTypeDef;
  existing: FacultyDocumentDoc | null;
  onMutated: () => void;
}

function DocumentCard({ facultyId, spec, existing, onMutated }: DocumentCardProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadMut = useMutation({
    mutationFn: (file: File) =>
      uploadFacultyDocument(facultyId, {
        file,
        category: spec.category,
        documentType: spec.documentType,
        title: spec.label,
      }),
    onSuccess: () => {
      setUploading(false);
      setError(null);
      if (fileRef.current) fileRef.current.value = '';
      onMutated();
    },
    onError: (e: any) => {
      setUploading(false);
      setError(e?.response?.data?.error || e?.message || 'Upload failed');
    },
  });

  const archiveMut = useMutation({
    mutationFn: (docId: string) => archiveFacultyDocument(facultyId, docId),
    onSuccess: onMutated,
  });

  async function handleView(doc: FacultyDocumentDoc) {
    try {
      const { url } = await getFacultyDocumentViewUrl(facultyId, doc._id);
      // Open the presigned URL in a new tab so the browser handles
      // PDF / image rendering natively. URL is short-TTL so even if
      // the user shares the link, it expires in 5 min.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Could not generate view URL');
    }
  }

  const badge = existing ? STATUS_BADGE[existing.verificationStatus] : null;
  const StatusIcon = badge?.Icon;

  return (
    <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-navy/[0.03] flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-navy-dark flex items-center gap-2">
            <FileText size={16} className="text-navy" />
            {spec.label}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{spec.helper}</p>
        </div>
        {badge && StatusIcon && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${badge.cls}`}>
            <StatusIcon size={12} />
            {badge.label}
          </span>
        )}
      </div>

      <div className="p-5">
        {existing ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              <div className="font-medium">{existing.title}</div>
              <div className="text-xs text-gray-500 mt-1">
                {existing.mimeType.toUpperCase()} · {formatBytes(existing.sizeBytes)}
                {existing.createdAt && (
                  <>
                    {' · uploaded '}
                    {new Date(existing.createdAt).toLocaleDateString()}
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleView(existing)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded border border-primary-200"
              >
                <ExternalLink size={12} /> View
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200"
              >
                <Upload size={12} /> Replace
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Archive "${existing.title}"? You can re-upload anytime.`)) {
                    archiveMut.mutate(existing._id);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200"
              >
                <Trash2 size={12} /> Archive
              </button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50/40 hover:bg-gray-50 cursor-pointer transition-colors"
               onClick={() => fileRef.current?.click()}
               onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
               role="button"
               tabIndex={0}>
            <Upload size={20} className="text-gray-400 mx-auto" />
            <p className="text-sm text-gray-700 mt-2">
              Click to upload the {spec.label.toLowerCase()}
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, JPEG, PNG, or WebP · up to 10 MB</p>
          </div>
        )}

        {uploading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Uploading…
          </div>
        )}
        {error && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
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
            if (!file) return;
            setError(null);
            setUploading(true);
            uploadMut.mutate(file);
          }}
        />
      </div>
    </section>
  );
}

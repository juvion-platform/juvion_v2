/**
 * BulkImportsPage — schema-driven CSV import surface (Strategic Gap 2
 * Phase A). Mounted under /platform/bulk-imports.
 *
 * Flow:
 *   1. Operator picks an entity type (v1 ships Students only).
 *   2. Uploads a CSV — system parses, validates, and shows a preview.
 *   3. Operator reviews errors + valid rows, then confirms commit.
 *   4. Status flips to completed / partial / failed; per-row results
 *      are visible.
 *
 * The same surface lists recent jobs so the operator can revisit a
 * past import for support / debug.
 */

import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2, AlertTriangle,
  AlertCircle, Download, ArrowLeft, Clock, Trash2,
} from 'lucide-react';

import {
  listImportEntityTypes,
  listImportJobs,
  uploadImportFile,
  commitImportJob,
  archiveImportJob,
  type ImportEntityTypeDef,
  type ImportPreviewResponse,
  type ImportJobDoc,
  type ImportJobStatus,
} from '../../services/bulk-imports';

type Mode =
  | { kind: 'list' }
  | { kind: 'choose_type' }
  | { kind: 'upload'; entityType: ImportEntityTypeDef }
  | { kind: 'preview'; preview: ImportPreviewResponse; entityType: ImportEntityTypeDef }
  | { kind: 'job_detail'; job: ImportJobDoc };

const STATUS_META: Record<ImportJobStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  pending:       { label: 'Pending',        cls: 'bg-slate-50 text-slate-700 border-slate-200',         Icon: Clock },
  parsing:       { label: 'Parsing',        cls: 'bg-blue-50 text-blue-700 border-blue-200',           Icon: Loader2 },
  preview_ready: { label: 'Preview ready',  cls: 'bg-amber-50 text-amber-800 border-amber-200',        Icon: AlertTriangle },
  committing:    { label: 'Committing',     cls: 'bg-blue-50 text-blue-700 border-blue-200',           Icon: Loader2 },
  completed:     { label: 'Completed',      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',  Icon: CheckCircle2 },
  partial:       { label: 'Partial',        cls: 'bg-amber-50 text-amber-800 border-amber-200',        Icon: AlertTriangle },
  failed:        { label: 'Failed',         cls: 'bg-red-50 text-red-800 border-red-200',              Icon: XCircle },
};

function StatusPill({ status }: { status: ImportJobStatus }) {
  const m = STATUS_META[status];
  const Icon = m.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${m.cls}`}>
      <Icon size={11} /> {m.label}
    </span>
  );
}

export default function BulkImportsPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Bulk imports</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload CSV files to create records in bulk. Files are validated row-by-row
            before commit — partial failures are reported per-row so you can fix and
            re-upload.
          </p>
        </div>
        {mode.kind === 'list' && (
          <button
            type="button"
            onClick={() => setMode({ kind: 'choose_type' })}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
          >
            <Upload size={16} className="text-white" /> New import
          </button>
        )}
        {mode.kind !== 'list' && (
          <button
            type="button"
            onClick={() => setMode({ kind: 'list' })}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded border"
          >
            <ArrowLeft size={14} /> Back to imports
          </button>
        )}
      </div>

      {mode.kind === 'list' && <RecentJobsList onOpen={(j) => setMode({ kind: 'job_detail', job: j })} />}
      {mode.kind === 'choose_type' && (
        <EntityTypePicker onPick={(et) => setMode({ kind: 'upload', entityType: et })} />
      )}
      {mode.kind === 'upload' && (
        <UploadStep
          entityType={mode.entityType}
          onPreview={(preview) => setMode({ kind: 'preview', preview, entityType: mode.entityType })}
          onCancel={() => setMode({ kind: 'choose_type' })}
        />
      )}
      {mode.kind === 'preview' && (
        <PreviewStep
          preview={mode.preview}
          entityType={mode.entityType}
          onCommitted={(job) => setMode({ kind: 'job_detail', job })}
        />
      )}
      {mode.kind === 'job_detail' && <JobDetailView job={mode.job} />}
    </div>
  );
}

// ─── List of recent jobs ──────────────────────────────────────────

function RecentJobsList({ onOpen }: { onOpen: (job: ImportJobDoc) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['bulk-imports', 'list'],
    queryFn: () => listImportJobs(),
  });
  const items = data?.items ?? [];

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveImportJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bulk-imports', 'list'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
        <FileText size={28} className="mx-auto text-slate-400 mb-2" />
        No imports yet. Click <span className="font-medium">New import</span> to start.
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-left text-[10px] uppercase tracking-wide text-gray-500 bg-navy/[0.03]">
          <tr>
            <th className="px-4 py-2 font-medium">File / entity</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Rows</th>
            <th className="px-4 py-2 font-medium">Uploaded</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((j) => (
            <tr key={j._id} className="border-t border-gray-100 hover:bg-gray-50/60 cursor-pointer" onClick={() => onOpen(j)}>
              <td className="px-4 py-2">
                <div className="font-medium text-gray-800">{j.fileName}</div>
                <div className="text-[11px] text-gray-500 font-mono">{j.entityType}</div>
              </td>
              <td className="px-4 py-2"><StatusPill status={j.status} /></td>
              <td className="px-4 py-2 text-xs">
                <span className="text-emerald-700 font-medium">{j.successCount}</span>
                {' / '}
                <span className="text-gray-600">{j.totalRows}</span>
                {j.failureCount > 0 && (
                  <span className="text-red-700 ml-1">· {j.failureCount} failed</span>
                )}
              </td>
              <td className="px-4 py-2 text-xs text-gray-500">
                {j.createdAt ? new Date(j.createdAt).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Archive import "${j.fileName}"?`)) archiveMut.mutate(j._id);
                  }}
                  className="p-1 rounded hover:bg-red-50 text-red-600"
                  title="Archive"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Entity type picker ───────────────────────────────────────────

function EntityTypePicker({ onPick }: { onPick: (et: ImportEntityTypeDef) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['bulk-imports', 'entity-types'],
    queryFn: listImportEntityTypes,
  });
  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">Pick what you're importing</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((et) => (
          <button
            key={et.entityType}
            type="button"
            onClick={() => onPick(et)}
            className="text-left bg-white rounded-xl border shadow-sm p-4 hover:border-primary-300 hover:shadow transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <FileText size={15} className="text-navy/70" />
              <span className="font-semibold text-navy-dark text-sm">{et.label}</span>
              <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-200">
                {et.fields.length} fields
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">{et.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Upload step ──────────────────────────────────────────────────

function UploadStep({
  entityType, onPreview, onCancel,
}: {
  entityType: ImportEntityTypeDef;
  onPreview: (preview: ImportPreviewResponse) => void;
  onCancel: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadImportFile(entityType.entityType, file),
    onSuccess: (preview) => {
      setError(null);
      onPreview(preview);
    },
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Upload failed'),
  });

  function downloadTemplate() {
    // Build a CSV with the schema's field keys as headers and the
    // sampleRow as a single demo row. Keeps it dead simple — operator
    // edits, saves as .csv, uploads.
    const headers = entityType.fields.map((f) => f.fieldKey);
    const sampleRow = headers.map((h) => entityType.sampleRow[h] ?? '');
    const csv = [headers.join(','), sampleRow.map((v) => /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType.entityType}-template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Uploading: {entityType.label}</div>
          <div className="text-xs text-blue-800 mt-1">{entityType.description}</div>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white hover:bg-blue-100 rounded border border-blue-200 whitespace-nowrap"
        >
          <Download size={12} /> Template CSV
        </button>
      </div>

      <section className="bg-white rounded-xl border shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Schema</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {entityType.fields.map((f) => (
            <div key={f.fieldKey} className="flex items-baseline gap-2">
              <span className="font-mono text-navy-dark">{f.fieldKey}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-700">{f.label}</span>
              {f.required && (
                <span className="text-[10px] uppercase tracking-wide text-red-600 font-semibold">required</span>
              )}
              {f.type === 'enum' && (f.meta as any)?.values && (
                <span className="text-[10px] text-gray-500 italic">
                  ({((f.meta as any).values as string[]).join(' | ')})
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Upload CSV</h3>
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50/40 hover:bg-gray-50 cursor-pointer transition-colors"
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
        >
          <Upload size={22} className="text-gray-400 mx-auto" />
          <p className="text-sm text-gray-700 mt-2">Click to select a .csv file</p>
          <p className="text-xs text-gray-500 mt-1">Max 10 MB · 10,000 rows per file</p>
        </div>
        {uploadMut.isPending && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <Loader2 size={14} className="animate-spin" /> Uploading and validating…
          </div>
        )}
        {error && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-start gap-1.5">
            <AlertCircle size={11} className="mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setError(null);
              uploadMut.mutate(file);
            }
          }}
        />
      </section>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Preview step ─────────────────────────────────────────────────

function PreviewStep({
  preview, entityType, onCommitted,
}: {
  preview: ImportPreviewResponse;
  entityType: ImportEntityTypeDef;
  onCommitted: (job: ImportJobDoc) => void;
}) {
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const rows = useMemo(() => {
    return showOnlyErrors ? preview.previewRows.filter((r) => !r.valid) : preview.previewRows;
  }, [preview.previewRows, showOnlyErrors]);

  const commitMut = useMutation({
    mutationFn: () => commitImportJob(preview.job._id),
    onSuccess: (job) => onCommitted(job),
  });

  const errorByField = useMemo(() => {
    const m = new Map<string, Map<number, string>>();
    for (const r of preview.previewRows) {
      if (r.valid) continue;
      for (const e of r.errors) {
        if (!m.has(e.field)) m.set(e.field, new Map());
        m.get(e.field)!.set(r.row, e.error);
      }
    }
    return m;
  }, [preview.previewRows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard label="Total rows" value={preview.job.totalRows} cls="bg-slate-50 border-slate-200 text-slate-800" />
        <SummaryCard label="Valid" value={preview.validCount} cls="bg-emerald-50 border-emerald-200 text-emerald-800" />
        <SummaryCard label="With errors" value={preview.errorCount} cls="bg-red-50 border-red-200 text-red-800" />
      </div>

      {preview.job.status === 'failed' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
          <XCircle size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Cannot commit this file.</div>
            <div className="text-xs mt-1">{preview.job.errorSummary}</div>
          </div>
        </div>
      )}
      {preview.errorCount > 0 && preview.job.status === 'preview_ready' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">
              {preview.errorCount} row{preview.errorCount === 1 ? '' : 's'} have validation errors and will be skipped on commit.
            </div>
            <div className="text-xs mt-1">
              You can commit anyway — the valid {preview.validCount} row{preview.validCount === 1 ? '' : 's'} will be created.
              Or fix the source file and re-upload.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showOnlyErrors}
            onChange={(e) => setShowOnlyErrors(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show only error rows
        </label>
        <div className="text-xs text-gray-500">
          Showing {rows.length} of {preview.previewRows.length} preview rows
          {preview.previewRows.length < preview.job.totalRows && (
            <> · {preview.job.totalRows - preview.previewRows.length} hidden</>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="text-xs min-w-full">
          <thead className="bg-navy/[0.03] text-[10px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-2 py-1.5 font-medium text-left">#</th>
              <th className="px-2 py-1.5 font-medium text-left">Status</th>
              {entityType.fields.map((f) => (
                <th key={f.fieldKey} className="px-2 py-1.5 font-medium text-left whitespace-nowrap">
                  {f.fieldKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.row} className={`border-t border-gray-100 ${r.valid ? '' : 'bg-red-50/40'}`}>
                <td className="px-2 py-1.5 text-gray-500">{r.row}</td>
                <td className="px-2 py-1.5">
                  {r.valid ? (
                    <span className="inline-flex items-center gap-0.5 text-emerald-700">
                      <CheckCircle2 size={11} />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-red-700" title={r.errors.map((e) => e.error).join('; ')}>
                      <XCircle size={11} />
                    </span>
                  )}
                </td>
                {entityType.fields.map((f) => {
                  const err = errorByField.get(f.fieldKey)?.get(r.row);
                  const value = r.raw[f.fieldKey] ?? '';
                  return (
                    <td
                      key={f.fieldKey}
                      className={`px-2 py-1.5 whitespace-nowrap ${err ? 'bg-red-100 text-red-900' : 'text-gray-700'}`}
                      title={err}
                    >
                      <div className="truncate max-w-[180px]">{value || <span className="text-gray-400">—</span>}</div>
                      {err && <div className="text-[10px] text-red-700">⚠ {err}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={preview.job.status !== 'preview_ready' || preview.validCount === 0 || commitMut.isPending}
          onClick={() => commitMut.mutate()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50"
        >
          {commitMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Commit {preview.validCount} row{preview.validCount === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wide font-medium">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

// ─── Job detail view ──────────────────────────────────────────────

function JobDetailView({ job }: { job: ImportJobDoc }) {
  const errorRows = job.results.filter((r) => r.outcome === 'error');
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-navy-dark">{job.fileName}</h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{job.entityType} · {job.mimeType}</p>
            <p className="text-xs text-gray-500 mt-1">
              Uploaded {job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'}
              {job.completedAt && <> · Completed {new Date(job.completedAt).toLocaleString()}</>}
            </p>
          </div>
          <StatusPill status={job.status} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <SummaryCard label="Total rows" value={job.totalRows} cls="bg-slate-50 border-slate-200 text-slate-800" />
          <SummaryCard label="Created" value={job.successCount} cls="bg-emerald-50 border-emerald-200 text-emerald-800" />
          <SummaryCard label="Failed" value={job.failureCount} cls="bg-red-50 border-red-200 text-red-800" />
        </div>
        {job.errorSummary && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {job.errorSummary}
          </div>
        )}
      </div>

      {errorRows.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-navy/[0.03]">
            <h3 className="text-sm font-semibold text-navy-dark">Failed rows ({errorRows.length})</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Fix the source CSV and re-upload to retry. Validation errors are reported per row.
            </p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Row</th>
                <th className="px-3 py-1.5 text-left font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {errorRows.slice(0, 200).map((r) => (
                <tr key={r.row} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 text-gray-500">{r.row}</td>
                  <td className="px-3 py-1.5 text-red-700">{r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {errorRows.length > 200 && (
            <div className="px-3 py-2 text-xs text-gray-500 italic">
              + {errorRows.length - 200} more failed rows not shown
            </div>
          )}
        </div>
      )}
    </div>
  );
}

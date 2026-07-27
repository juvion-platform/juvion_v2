import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import { confirmAction } from '../../stores/confirmStore';
import {
  getStudentImportTemplate, previewStudentImport, commitStudentImport, buildTemplateCsv,
  type ImportPreview, type ImportPreviewRow,
} from '../../services/student-import';

interface Props { open: boolean; onClose: () => void; }

export default function StudentImportDrawer({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const { data: tpl } = useQuery({
    queryKey: ['student-import-template'],
    queryFn: getStudentImportTemplate,
    enabled: open,
  });

  const previewMut = useMutation({
    mutationFn: () => previewStudentImport(file!),
    // Preview failures are shown in the drawer itself; the global toast
    // handler would duplicate them. `silentError` is the flag main.tsx reads.
    meta: { silentError: true },
    onSuccess: setPreview,
  });

  const commitMut = useMutation({
    mutationFn: (jobId: string) => commitStudentImport(jobId),
    meta: { successMessage: 'Import committed' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['people-stats'] });
      reset();
      onClose();
    },
  });

  function reset() { setFile(null); setPreview(null); }

  function downloadTemplate() {
    if (!tpl) return;
    const blob = new Blob([buildTemplateCsv(tpl)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleCommit() {
    if (!preview?.job?._id) return;
    const guardianTotal = preview.sideEffectTotals.guardians ?? 0;
    const ok = await confirmAction({
      title: `Import ${preview.validCount} student${preview.validCount === 1 ? '' : 's'}?`,
      message: [
        `${preview.actionCounts.create} created, ${preview.actionCounts.update} updated.`,
        preview.actionCounts.blocked > 0
          ? `${preview.actionCounts.blocked} blocked row(s) will be skipped.` : '',
        preview.errorCount > 0 ? `${preview.errorCount} row(s) with errors will be skipped.` : '',
        guardianTotal > 0
          ? `Up to ${guardianTotal} guardian record(s) will also be created.` : '',
      ].filter(Boolean).join(' '),
      confirmLabel: 'Import',
    });
    if (ok.confirmed) commitMut.mutate(String(preview.job._id));
  }

  const guardianTotal = preview?.sideEffectTotals.guardians ?? 0;

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Import students"
      widthClass="max-w-3xl"
      description="Upload a CSV. Mandatory columns are marked with * in the template."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-600">
            Start from the template so the column names match.
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={!tpl}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={14} /> Download template
          </button>
        </div>

        {!preview && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="student-import-file">
              CSV file
            </label>
            <input
              id="student-import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!file || previewMut.isPending}
              onClick={() => previewMut.mutate()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {previewMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {previewMut.isPending ? 'Checking…' : 'Preview'}
            </button>
            {previewMut.isError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {(previewMut.error as { response?: { data?: { error?: string } } })?.response?.data?.error
                  ?? 'Could not read that file.'}
              </p>
            )}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="import-summary">
              <span className="inline-flex items-center gap-1 text-teal-700">
                <CheckCircle2 size={14} /> {preview.actionCounts.create} new
              </span>
              <span className="inline-flex items-center gap-1 text-primary-700">
                {preview.actionCounts.update} updates
              </span>
              {preview.actionCounts.blocked > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  {preview.actionCounts.blocked} blocked
                </span>
              )}
              {preview.errorCount > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600">
                  <XCircle size={14} /> {preview.errorCount} with errors
                </span>
              )}
              {guardianTotal > 0 && (
                <span className="text-gray-600">
                  up to {guardianTotal} guardian
                  {guardianTotal === 1 ? '' : 's'} will be created
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Resolves to</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.previewRows.map((r: ImportPreviewRow) => (
                    <tr key={r.row}>
                      <td className="px-3 py-2">{r.row}</td>
                      <td className="px-3 py-2">{r.raw.name ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {r.resolved
                          ? Object.entries(r.resolved).map(([k, v]) => `${k}: ${v}`).join(' · ')
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            r.action === 'blocked' ? 'warning'
                              : r.valid ? (r.action === 'update' ? 'info' : 'success')
                                : 'danger'
                          }
                        >
                          {r.action === 'blocked' ? 'Blocked'
                            : r.valid ? (r.action === 'update' ? 'Update' : 'Create')
                              : 'Error'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="text-red-600">
                          {r.errors.map((e) => `${e.field}: ${e.error}`).join('; ')}
                        </span>
                        {r.notes && r.notes.length > 0 ? (
                          <span className="block text-amber-700">{r.notes.join('; ')}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 text-sm">
                Choose another file
              </button>
              <button
                type="button"
                disabled={preview.validCount === 0 || commitMut.isPending}
                onClick={() => void handleCommit()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
              >
                {commitMut.isPending ? 'Importing…' : `Import ${preview.validCount}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

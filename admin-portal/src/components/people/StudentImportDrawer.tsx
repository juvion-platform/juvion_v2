import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, Loader2, CheckCircle2, XCircle, History } from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import { confirmAction } from '../../stores/confirmStore';
import { toast } from '../../stores/toastStore';
import {
  getStudentImportTemplate, previewStudentImport, commitStudentImport, buildTemplateCsv,
  listStudentImportJobs, getStudentImportJob,
  type ImportPreview, type ImportPreviewRow, type ImportCommitSummary,
  type ImportJobListEntry,
} from '../../services/student-import';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Rows that were imported but hold no fee structure. */
function unpinnedCount(s: ImportCommitSummary): number {
  const p = s.pinSummary;
  if (!p) return 0;
  return p.noMatch + p.skipped + p.errors;
}

interface Props { open: boolean; onClose: () => void; }

export default function StudentImportDrawer({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitSummary | null>(null);

  const { data: tpl } = useQuery({
    queryKey: ['student-import-template'],
    queryFn: getStudentImportTemplate,
    enabled: open,
  });

  // Recent imports, so an operator who closed the drawer can get the failed
  // rows back. Before the /jobs endpoints existed there was no route to them
  // at all: a Registrar holds no platform:read, so /platform/bulk-imports 403s.
  const { data: history } = useQuery({
    queryKey: ['student-import-jobs'],
    queryFn: () => listStudentImportJobs(),
    // Only needed on the first step — once a preview or result is on screen
    // the list is hidden, so do not refetch behind it.
    enabled: open && !preview && !result,
  });

  const openPastJob = useMutation({
    mutationFn: (jobId: string) => getStudentImportJob(jobId),
    meta: { silentError: true },
    // Reuses the same result view a fresh commit renders — the detail endpoint
    // returns the same shape for exactly this reason.
    onSuccess: setResult,
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
    // The fixed "Import committed" toast used to fire whatever happened, and
    // the response was thrown away — a half-failed import looked identical to
    // a clean one. Per-row commit errors are recorded on the job, which a
    // Registrar can never open (no platform:read, and the facade exposes no
    // job endpoint), so the drawer is the only place they can ever surface.
    // Toasting is handled below so it can tell the truth.
    meta: { silent: true },
    onSuccess: (summary) => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['people-stats'] });
      qc.invalidateQueries({ queryKey: ['student-import-jobs'] });

      const unpinned = unpinnedCount(summary);
      const rowsFailed = summary.failureCount > 0 || summary.blockedCount > 0;
      if (!rowsFailed && unpinned === 0) {
        toast.success(
          `Imported ${summary.successCount} student${summary.successCount === 1 ? '' : 's'}`,
        );
        reset();
        onClose();
        return;
      }
      // Something did not land. Stay open, stay factual, and show which rows
      // so the operator can fix the file rather than guess.
      //
      // An unpinned student counts as "needs attention" even when every row
      // committed: the import worked, but those students carry no fee
      // structure and nothing else will tell this operator that.
      if (rowsFailed) {
        toast.warning(
          'Import finished with problems',
          summary.errorSummary
            ?? `${summary.successCount} imported, ${summary.failureCount} failed, `
              + `${summary.blockedCount} blocked.`,
        );
      } else {
        toast.warning(
          `Imported ${summary.successCount} student${summary.successCount === 1 ? '' : 's'}`,
          `${unpinned} of them have no fee structure yet.`,
        );
      }
      setResult(summary);
    },
  });

  function reset() { setFile(null); setPreview(null); setResult(null); }

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
    const willPin = preview.sideEffectTotals.pinWillPin ?? 0;
    const noMatch = preview.sideEffectTotals.pinNoMatch ?? 0;
    const pinAmount = preview.sideEffectTotals.pinAmount ?? 0;
    const ok = await confirmAction({
      title: `Import ${preview.validCount} student${preview.validCount === 1 ? '' : 's'}?`,
      message: [
        `${preview.actionCounts.create} created, ${preview.actionCounts.update} updated.`,
        preview.actionCounts.blocked > 0
          ? `${preview.actionCounts.blocked} blocked row(s) will be skipped.` : '',
        preview.errorCount > 0 ? `${preview.errorCount} row(s) with errors will be skipped.` : '',
        guardianTotal > 0
          ? `Up to ${guardianTotal} guardian record(s) will also be created.` : '',
        // Consequence, not an approval — the import approves nothing, Finance
        // already approved these structures. Counts lead; the money is
        // secondary and labelled estimated because the amount is read at
        // preview and frozen again at commit.
        willPin > 0
          ? `${willPin} student(s) will be bound to an estimated ${inr(pinAmount)} in fees.` : '',
        noMatch > 0
          ? `${noMatch} will import without a fee structure and can be pinned later `
            + 'from Finance → Fee Management → Pin Coverage.' : '',
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

        {result && (
          <div className="space-y-3" data-testid="import-result">
            {/*
              A fresh commit reaches this view when something needs review —
              a failed/blocked row, OR a student imported without a fee
              structure. Opening a PAST job from history can also land here
              with nothing wrong, so the banner distinguishes three states:
              problems, imported-but-unpinned, and cleanly-done.
            */}
            {(() => {
              const unpinned = result.pinSummary
                ? result.pinSummary.noMatch + result.pinSummary.skipped + result.pinSummary.errors
                : 0;
              const pinnedNote = result.pinSummary
                ? ` ${result.pinSummary.pinned} pinned to a fee structure.` : '';
              if (result.failureCount + result.blockedCount > 0) {
                return (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">
                      Import finished with problems
                    </p>
                    <p className="mt-1 text-sm text-amber-900">
                      {result.successCount} imported · {result.failureCount} failed
                      {result.blockedCount > 0 ? ` · ${result.blockedCount} blocked` : ''} of{' '}
                      {result.totalRows} row{result.totalRows === 1 ? '' : 's'}.{pinnedNote}
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      Rows listed below were not written. Fix them in the source file and upload it
                      again — re-importing is safe, matched rows are updated rather than duplicated.
                    </p>
                  </div>
                );
              }
              if (unpinned > 0) {
                return (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">
                      Imported, but some students have no fee structure
                    </p>
                    <p className="mt-1 text-sm text-amber-900">
                      {result.successCount} imported · {result.pinSummary?.pinned ?? 0} pinned ·{' '}
                      {unpinned} without a fee structure of{' '}
                      {result.totalRows} row{result.totalRows === 1 ? '' : 's'}.
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      You can pin them later from Finance → Fee Management → Pin Coverage.
                    </p>
                  </div>
                );
              }
              return (
                <div className="rounded-lg border border-teal-300 bg-teal-50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-teal-900">
                    <CheckCircle2 size={14} /> Imported cleanly
                  </p>
                  <p className="mt-1 text-sm text-teal-900">
                    All {result.totalRows} row{result.totalRows === 1 ? '' : 's'} written.{pinnedNote} Nothing to review.
                  </p>
                </div>
              );
            })()}

            {(result.fileName || result.completedAt) && (
              <p className="text-xs text-gray-500">
                {result.fileName}
                {result.completedAt ? ` · ${new Date(result.completedAt).toLocaleString()}` : ''}
              </p>
            )}

            {result.truncated && (
              <p className="text-xs text-gray-600">
                Only the first rows are listed — the counts above are exact.
              </p>
            )}

            {result.pinSummary && result.pinSummary.unpinnedRows.length > 0 && (
              <div data-testid="unpinned-rows">
                <p className="mb-1 text-xs text-gray-600">
                  These students were imported but hold no fee structure. Publish the missing
                  structure, then pin them from{' '}
                  <span className="font-medium">Finance → Fee Management → Pin Coverage</span>
                  {' '}— or re-upload this file, which will pin them and change nothing else.
                </p>
                <div className="max-h-56 overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">
                          Not pinned because
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.pinSummary.unpinnedRows.map((r) => (
                        <tr key={`u-${r.row}`}>
                          <td className="px-3 py-2 text-gray-500">{r.row}</td>
                          <td className="px-3 py-2 text-xs text-amber-800">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.failedRows.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Failed because</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.failedRows.map((r) => (
                      <tr key={`f-${r.row}`}>
                        <td className="px-3 py-2 text-gray-500">{r.row}</td>
                        <td className="px-3 py-2 text-xs text-red-700">{r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.blockedRows.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Blocked because</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.blockedRows.map((r) => (
                      <tr key={`b-${r.row}`}>
                        <td className="px-3 py-2 text-gray-500">{r.row}</td>
                        <td className="px-3 py-2 text-xs text-amber-800">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 text-sm">
                Import another file
              </button>
              <button
                type="button"
                onClick={() => { reset(); onClose(); }}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {!preview && !result && (
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

            {history?.items?.length ? (
              <div className="mt-6 border-t pt-4" data-testid="import-history">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <History size={14} /> Recent imports
                </h3>
                <ul className="divide-y rounded-lg border">
                  {history.items.map((job: ImportJobListEntry) => {
                    const problems = job.failureCount + job.blockedCount;
                    return (
                      <li key={job.jobId}>
                        <button
                          type="button"
                          onClick={() => openPastJob.mutate(job.jobId)}
                          disabled={openPastJob.isPending}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-800">{job.fileName}</span>
                            <span className="block text-xs text-gray-500">
                              {job.completedAt ? new Date(job.completedAt).toLocaleString() : 'in progress'}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-gray-600">
                              {job.successCount}/{job.totalRows} imported
                            </span>
                            {problems > 0 && (
                              <Badge variant="warning">{problems} to review</Badge>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {openPastJob.isError && (
                  <p className="mt-2 text-sm text-red-600" role="alert">
                    Could not load that import.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}

        {preview && !result && (
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

            {preview.pinContext?.warning ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {preview.pinContext.warning}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="pin-summary">
                <span className="font-medium text-slate-700">
                  {preview.sideEffectTotals.pinWillPin ?? 0} will pin
                </span>
                {(preview.sideEffectTotals.pinNoMatch ?? 0) > 0 && (
                  <span className="text-amber-700">
                    {preview.sideEffectTotals.pinNoMatch} no matching fee structure
                  </span>
                )}
                {(preview.sideEffectTotals.pinAlreadyPinned ?? 0) > 0 && (
                  <span className="text-gray-600">
                    {preview.sideEffectTotals.pinAlreadyPinned} already pinned
                  </span>
                )}
                {/* Secondary and muted on purpose: the import approves no
                    money, it binds students to structures Finance already
                    approved. A 10x-expected total is still the one number
                    worth stopping on. */}
                {(preview.sideEffectTotals.pinWillPin ?? 0) > 0 && (
                  <span className="text-xs text-gray-500">
                    estimated {inr(preview.sideEffectTotals.pinAmount ?? 0)} in fees
                  </span>
                )}
                {preview.pinContext?.academicYearLabel && (
                  <span className="text-xs text-gray-500">
                    · academic year {preview.pinContext.academicYearLabel}
                  </span>
                )}
              </div>
            )}

            <div className="max-h-72 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Resolves to</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Fee structure</th>
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
                      <td className="px-3 py-2 text-xs">
                        {r.pinPreview?.willPin ? (
                          <span className="text-slate-700">
                            {inr(r.pinPreview.totalAmount ?? 0)}
                            <span className="text-gray-500"> · Year {r.pinPreview.yearOfStudy}</span>
                          </span>
                        ) : (
                          <span className="text-gray-500">
                            {r.pinPreview ? `— ${r.pinPreview.reason}` : '—'}
                          </span>
                        )}
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

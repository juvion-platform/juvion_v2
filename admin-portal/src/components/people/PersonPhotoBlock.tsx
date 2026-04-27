/**
 * PersonPhotoBlock — compact horizontal card on Person detail pages
 * (Student / Faculty / Staff / Parent) that displays the current photo
 * (or initials fallback) and exposes upload / replace / delete affordances
 * behind a `people:update` gate.
 *
 * Generalized in G4 from the student-only `StudentPhotoBlock`. The same
 * machinery now serves all four person entity types because the backend
 * exposes a uniform `/api/people/{entityType}/:id/photo*` contract.
 *
 * Data flow:
 *   - `useQuery(['entity-photo-url', entityType, entityId, 'thumb'])` fetches
 *     a presigned thumb URL with a 30-minute staleTime (well under the
 *     60-minute presign expiry). Same query-key prefix as `PersonThumbnail`
 *     so row thumbnails on the matching list page share the cache
 *     transparently. The `entityType` segment in the key prevents
 *     cross-type collisions when the same Mongo `_id` happens to exist for
 *     two different collections (extremely unlikely but defensive).
 *   - Upload + delete mutations invalidate that key on success so the
 *     newly-uploaded image appears without a manual refresh.
 *
 * UX states:
 *   - No photo  → initials avatar + "Upload photo" button
 *   - Has photo → presigned thumb image + "Replace" / "Delete" buttons
 *   - Uploading → progress bar + percentage on the right side
 *   - Error     → inline red message with "Try again" affordance
 *
 * File picker validation runs client-side before any network request:
 *   - `file.size > 5 MB`              → inline error (max 5 MB)
 *   - `file.type` not in JPEG/PNG/WebP → inline error
 * The backend re-validates as defense-in-depth (P4 sharp decode), so
 * client-side checks are purely a UX fast-fail.
 *
 * AbortController for cancel-mid-upload was deliberately deferred for
 * v1 — uploads are small (≤5 MB) and tend to finish before the user
 * can react. Spec calls cancel "optional"; flagged in the P6 signal.
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Camera,
} from 'lucide-react';

import {
  uploadEntityPhoto,
  deleteEntityPhoto,
  getEntityPhotoUrl,
  type PersonEntityType,
} from '../../services/people';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  entityType: PersonEntityType;
  entityId: string;
  /** Display name for the initials avatar fallback + img alt text. */
  personName?: string;
}

const STALE_TIME_MS = 30 * 60 * 1000; // 30 min, just under the 60-min presign window.
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp';

// ─── Helpers ──────────────────────────────────────────────────────────

function computeInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return ((first + last).toUpperCase()) || '?';
}

function formatUploadedAt(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const anyErr = err as {
      response?: { data?: { message?: string; error?: string } };
      message?: string;
    };
    return (
      anyErr.response?.data?.message ??
      anyErr.response?.data?.error ??
      anyErr.message ??
      fallback
    );
  }
  return fallback;
}

// ─── Inline auto-dismiss toast ────────────────────────────────────────
// Mirrors the SituationToast pattern from FeeDashboardPage.tsx — no
// shared toast primitive exists yet so we keep the footprint local.

type ToastKind = 'success' | 'error';
interface ToastState { kind: ToastKind; message: string }

function PhotoToast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onDismiss, 3500);
    return () => window.clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const cls =
    toast.kind === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : 'bg-red-50 border-red-200 text-red-800';
  const Icon = toast.kind === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 z-[60] max-w-sm rounded-lg border px-4 py-3 shadow-lg ${cls}`}
    >
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-sm font-medium">{toast.message}</div>
        <button
          type="button"
          onClick={onDismiss}
          className="p-0.5 rounded hover:bg-black/5"
          aria-label="Dismiss notification"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Confirm-upload preview modal ─────────────────────────────────────

function ConfirmUploadModal({
  file,
  previewUrl,
  uploading,
  progress,
  error,
  onConfirm,
  onCancel,
}: {
  file: File;
  previewUrl: string;
  uploading: boolean;
  progress: number;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-upload-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <div className="flex items-start justify-between mb-4">
          <h3 id="photo-upload-title" className="text-base font-semibold text-navy">
            Confirm photo
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <img
            src={previewUrl}
            alt="Selected photo preview"
            className="w-24 h-24 rounded-full object-cover bg-slate-100 border"
          />
          <div className="text-sm text-gray-700 min-w-0">
            <div className="font-medium truncate" title={file.name}>{file.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {(file.size / 1024).toFixed(1)} KB · {file.type.replace('image/', '')}
            </div>
          </div>
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Uploading…</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-primary-600 transition-[width] duration-150"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {error && !uploading && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={uploading}
            className="px-3 py-1.5 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {error ? 'Try again' : uploading ? 'Uploading' : 'Confirm upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm-delete inline dialog ─────────────────────────────────────

function ConfirmDeleteModal({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-delete-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <h3 id="photo-delete-title" className="text-base font-semibold text-navy">
          Delete photo
        </h3>
        <p className="text-sm text-gray-600 mt-2">
          Delete this photo? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────

export default function PersonPhotoBlock({ entityType, entityId, personName }: Props) {
  const qc = useQueryClient();
  const canEdit = useAuthStore(s => s.hasPermission('people', 'update'));

  // Fetch the presigned thumb URL. Same key prefix as `PersonThumbnail` so
  // the page-level cache is shared across the row + detail surfaces. The
  // entityType segment isolates each entity's cache to avoid collisions.
  const photoQuery = useQuery({
    queryKey: ['entity-photo-url', entityType, entityId, 'thumb'],
    queryFn: () => getEntityPhotoUrl(entityType, entityId, 'thumb'),
    staleTime: STALE_TIME_MS,
    retry: false,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Local UI state.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageBroken, setImageBroken] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  // `lastUploadedAt` mirrors the upload-mutation result so the right-side
  // status text refreshes immediately after a successful upload (the
  // photo-url query doesn't return uploadedAt; only the mutation does).
  const [lastUploadedAt, setLastUploadedAt] = useState<string | null>(null);

  // Object-URL cleanup: revoke whenever the URL changes or unmount fires.
  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Reset the broken-image flag whenever the thumb URL changes (e.g.
  // after a fresh upload invalidates the query).
  useEffect(() => {
    setImageBroken(false);
  }, [photoQuery.data?.thumb?.url]);

  // Mutations.
  const uploadMutation = useMutation({
    mutationFn: ({ file }: { file: File }) =>
      uploadEntityPhoto(entityType, entityId, file, (pct) => setProgress(pct)),
    onSuccess: (meta) => {
      setLastUploadedAt(meta.uploadedAt);
      setToast({ kind: 'success', message: 'Photo updated' });
      qc.invalidateQueries({ queryKey: ['entity-photo-url', entityType, entityId] });
      closeUploadModal();
    },
    onError: (err) => {
      setUploadError(errorMessage(err, 'Failed to upload photo'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEntityPhoto(entityType, entityId),
    onSuccess: () => {
      setLastUploadedAt(null);
      setToast({ kind: 'success', message: 'Photo deleted' });
      qc.invalidateQueries({ queryKey: ['entity-photo-url', entityType, entityId] });
      setShowDeleteConfirm(false);
    },
    onError: (err) => {
      setToast({
        kind: 'error',
        message: errorMessage(err, 'Failed to delete photo'),
      });
      setShowDeleteConfirm(false);
    },
  });

  // ── File-picker handlers ────────────────────────────────────────────

  function openFilePicker() {
    setPickerError(null);
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Always clear the input so re-selecting the same file fires `change`.
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setPickerError('Unsupported format. Use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setPickerError('File too large (max 5 MB)');
      return;
    }

    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setProgress(0);
    setUploadError(null);
  }

  function closeUploadModal() {
    setPendingFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setProgress(0);
    setUploadError(null);
  }

  function handleConfirmUpload() {
    if (!pendingFile) return;
    setUploadError(null);
    setProgress(0);
    uploadMutation.mutate({ file: pendingFile });
  }

  // ── Derived display state ───────────────────────────────────────────

  const thumbUrl = photoQuery.data?.thumb?.url;
  const hasPhoto = Boolean(thumbUrl) && !imageBroken;
  const initials = computeInitials(personName);
  const uploadedAtDisplay = formatUploadedAt(lastUploadedAt ?? undefined);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <>
      <section
        className="bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4"
        aria-label="Profile photo"
      >
        {/* Left: 96×96 circular avatar */}
        <div className="flex-shrink-0">
          {photoQuery.isLoading ? (
            <div
              className="w-24 h-24 rounded-full bg-slate-200 animate-pulse"
              aria-hidden="true"
            />
          ) : hasPhoto ? (
            <img
              src={thumbUrl}
              alt={personName ? `${personName} photo` : 'Profile photo'}
              onError={() => setImageBroken(true)}
              className="w-24 h-24 rounded-full object-cover bg-slate-100 border"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 text-white flex items-center justify-center text-2xl font-semibold select-none"
              aria-label={personName ? `${personName} initials` : 'Initials'}
              title={personName}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Right: status + actions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <Camera size={14} className="text-gray-400" />
            <span>Profile photo</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {photoQuery.isLoading
              ? 'Loading…'
              : hasPhoto
                ? uploadedAtDisplay
                  ? `Uploaded ${uploadedAtDisplay}`
                  : 'Photo on file'
                : 'No photo uploaded'}
          </div>

          {pickerError && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-red-700">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              <span>{pickerError}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="ml-1 text-red-700 underline hover:text-red-800"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {canEdit && !pickerError && (
            <div className="mt-3 flex items-center gap-2">
              {hasPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-slate-200 hover:bg-slate-50 text-gray-700"
                  >
                    <Upload size={12} /> Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-red-200 hover:bg-red-50 text-red-700"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary-600 text-white hover:bg-primary-700"
                >
                  <Upload size={12} /> Upload photo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Hidden file input — triggered by the button clicks above. */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={handleFileSelected}
          className="hidden"
          aria-hidden="true"
        />
      </section>

      {/* Confirm-upload preview modal */}
      {pendingFile && previewUrl && (
        <ConfirmUploadModal
          file={pendingFile}
          previewUrl={previewUrl}
          uploading={uploadMutation.isPending}
          progress={progress}
          error={uploadError}
          onConfirm={handleConfirmUpload}
          onCancel={closeUploadModal}
        />
      )}

      {/* Confirm-delete dialog */}
      {showDeleteConfirm && (
        <ConfirmDeleteModal
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Auto-dismiss toast */}
      <PhotoToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

/**
 * Human-in-the-loop draft review — the shell, the per-draft card and the
 * review state, shared by finance reminder drafts and People outreach
 * drafts. A module supplies the identity header, the pills, the approve
 * mutation and the footer wording; everything else is here once.
 *
 * Panel: right-docked, slide-in, Esc + backdrop close, focus moves to the
 * close button on open (basic focus management, no focus-trap dependency).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Edit3, SkipForward, Sparkles, X } from 'lucide-react';

import { InlineRetry, Toast, type ToastState } from './states';

export type DraftStatus = 'pending' | 'approved' | 'skipped';

export interface DraftEdit { subject: string; body: string }

/**
 * Per-card local state — status and edits keyed by studentId, reset when
 * the id set changes so a re-opened panel starts fresh.
 */
export function useDraftReview<T extends { studentId: string; subject: string; body: string }>(
  drafts: T[],
  resetKey: string,
) {
  const [statuses, setStatuses] = useState<Map<string, DraftStatus>>(new Map());
  const [edits, setEdits] = useState<Map<string, DraftEdit>>(new Map());

  useEffect(() => {
    setStatuses(new Map());
    setEdits(new Map());
  }, [resetKey]);

  const statusOf = (id: string): DraftStatus => statuses.get(id) ?? 'pending';
  const pending = useMemo(() => drafts.filter((d) => (statuses.get(d.studentId) ?? 'pending') === 'pending'), [drafts, statuses]);
  const approvedCount = useMemo(() => Array.from(statuses.values()).filter((s) => s === 'approved').length, [statuses]);

  /** The draft plus any local edit — what actually gets approved. */
  const finalOf = (id: string): (T & DraftEdit) | null => {
    const d = drafts.find((x) => x.studentId === id);
    if (!d) return null;
    const e = edits.get(id);
    return { ...d, subject: e?.subject ?? d.subject, body: e?.body ?? d.body };
  };
  const markApproved = (ids: string[]) =>
    setStatuses((prev) => { const n = new Map(prev); for (const id of ids) n.set(id, 'approved'); return n; });
  const skip = (id: string) =>
    setStatuses((prev) => { const n = new Map(prev); n.set(id, 'skipped'); return n; });
  const saveEdit = (id: string, subject: string, body: string) =>
    setEdits((prev) => { const n = new Map(prev); n.set(id, { subject, body }); return n; });

  return { statusOf, editOf: (id: string) => edits.get(id), pending, approvedCount, finalOf, markApproved, skip, saveEdit };
}

export function DraftSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-8 rounded-full bg-slate-200" />
        <div className="flex-1">
          <div className="h-3 bg-slate-200 rounded w-2/3 mb-1.5" />
          <div className="h-2.5 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-1.5 mb-2.5">
        <div className="h-4 w-16 bg-slate-200 rounded-full" />
        <div className="h-4 w-20 bg-slate-200 rounded-full" />
        <div className="h-4 w-24 bg-slate-200 rounded-full" />
      </div>
      <div className="h-7 bg-slate-100 rounded-lg mb-2" />
      <div className="h-20 bg-slate-100 rounded-lg" />
    </div>
  );
}

/**
 * One draft: read-only until `[Edit]`, which becomes `[Save]` and commits
 * the local edit so a later Approve uses the new content.
 */
export function DraftCard({
  header, pills, draft, status, edited, onApprove, onSkip, onSaveEdit,
}: {
  header: ReactNode;
  pills: ReactNode;
  draft: { subject: string; body: string };
  status: DraftStatus;
  edited: DraftEdit | undefined;
  onApprove: () => void;
  onSkip: () => void;
  onSaveEdit: (subject: string, body: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const subject = edited?.subject ?? draft.subject;
  const body = edited?.body ?? draft.body;
  const [localSubject, setLocalSubject] = useState(subject);
  const [localBody, setLocalBody] = useState(body);
  const dim = status !== 'pending';

  const handleEditToggle = () => {
    if (isEditing) {
      onSaveEdit(localSubject, localBody);
      setIsEditing(false);
    } else {
      setLocalSubject(subject);
      setLocalBody(body);
      setIsEditing(true);
    }
  };

  return (
    <div className={`rounded-xl border p-3.5 transition-opacity ${dim ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}>
      <div className="flex items-start gap-3 mb-2">
        {header}
        {status === 'approved' && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            <Check size={10} />
            Approved
          </span>
        )}
        {status === 'skipped' && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
            <SkipForward size={10} />
            Skipped
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">{pills}</div>

      <div className="mb-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Subject</label>
        <input
          type="text"
          value={isEditing ? localSubject : subject}
          onChange={(e) => setLocalSubject(e.target.value)}
          readOnly={!isEditing}
          disabled={dim}
          className={`w-full px-3 py-1.5 text-sm border rounded-lg outline-none ${
            isEditing ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-200' : 'border-slate-200 bg-slate-50 cursor-default'
          }`}
        />
      </div>
      <div className="mb-2.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Body</label>
        <textarea
          rows={5}
          value={isEditing ? localBody : body}
          onChange={(e) => setLocalBody(e.target.value)}
          readOnly={!isEditing}
          disabled={dim}
          className={`w-full px-3 py-2 text-sm border rounded-lg outline-none resize-y ${
            isEditing ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-200' : 'border-slate-200 bg-slate-50 cursor-default'
          }`}
        />
      </div>

      {!dim && (
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onApprove}
            disabled={isEditing}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <Check size={11} />
            Approve
          </button>
          <button
            type="button"
            onClick={handleEditToggle}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1"
          >
            {isEditing ? <><Check size={11} />Save</> : <><Edit3 size={11} />Edit</>}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={isEditing}
            className="ml-auto text-[11px] font-semibold px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <SkipForward size={11} />
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

export function DraftsPanel({
  open, onClose, title, subtitle, icon, toolbar, footerNote,
  isLoading, isError, errorLabel, onRetry, isEmpty, emptyLabel, toast, onToastDismiss, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  icon: ReactNode;
  /** Bulk actions + counter row. */
  toolbar: ReactNode;
  footerNote: ReactNode;
  isLoading: boolean;
  isError: boolean;
  errorLabel: string;
  onRetry: () => void;
  isEmpty: boolean;
  emptyLabel: string;
  toast: ToastState | null;
  onToastDismiss: () => void;
  children: ReactNode;
}) {
  // `mounted` controls presence, `entered` the transform, so the 200ms
  // slide-out actually plays before unmount.
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const t = window.setTimeout(() => setEntered(true), 10);
      return () => window.clearTimeout(t);
    }
    setEntered(false);
    const t = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (entered) closeButtonRef.current?.focus();
  }, [entered]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drafts-panel-title"
        className={`fixed top-0 right-0 bottom-0 z-[61] w-full lg:w-[640px] bg-white shadow-2xl flex flex-col transition-transform duration-200 ${entered ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
              {icon}
            </div>
            <div className="min-w-0">
              <h2 id="drafts-panel-title" className="text-base font-bold text-slate-800">{title}</h2>
              <div className="text-xs text-slate-500 mt-0.5">
                <Sparkles size={10} className="inline mr-1 -mt-0.5" />
                {subtitle}
              </div>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex-shrink-0 h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2 flex-wrap">{toolbar}</div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading ? (
            <><DraftSkeleton /><DraftSkeleton /><DraftSkeleton /></>
          ) : isError ? (
            <InlineRetry label={errorLabel} onRetry={onRetry} />
          ) : isEmpty ? (
            <div className="text-center py-12 text-sm text-slate-500">{emptyLabel}</div>
          ) : (
            children
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">{footerNote}</div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
          >
            Close
          </button>
        </footer>
      </aside>

      <Toast toast={toast} onDismiss={onToastDismiss} />
    </>
  );
}

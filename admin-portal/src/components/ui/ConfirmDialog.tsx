import { useEffect, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import Modal from './Modal';
import { useConfirmStore } from '../../stores/confirmStore';

/**
 * App-level host for `confirmAction()` / `confirmDelete()`. Replaces the
 * native `window.confirm()` used by every delete action — that dialog blocked
 * the UI thread, looked nothing like the rest of the app, and can be
 * suppressed entirely by some browser configurations.
 */
export default function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const respond = useConfirmStore((s) => s.respond);

  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setTyped('');
      setReason('');
    }
  }, [open]);

  if (!open || !options) return null;

  const {
    title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
    tone = 'primary', requireTypedConfirmation, requireReason, reasonLabel = 'Reason',
  } = options;

  const danger = tone === 'danger';
  const typedOk = !requireTypedConfirmation || typed.trim() === requireTypedConfirmation;
  const reasonOk = !requireReason || reason.trim().length > 0;
  const canConfirm = typedOk && reasonOk;

  function cancel() {
    respond({ confirmed: false });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canConfirm) return;
    respond({ confirmed: true, reason: requireReason ? reason.trim() : undefined });
  }

  return (
    <Modal open onClose={cancel} title={title} widthClass="max-w-md">
      {/*
        Tagged so tests can target THIS dialog specifically. It mounts at app
        root and stacks on top of whatever opened it, so when the caller is
        itself a Modal (the student-import drawer, for one) a bare
        getByRole('dialog') matches two elements and fails strict mode.
      */}
      <form onSubmit={submit} className="space-y-4" data-testid="confirm-dialog">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 shrink-0 rounded-full p-2 ${danger ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-600'}`}>
            {danger ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            {message && <p className="text-sm text-slate-600">{message}</p>}

            {requireReason && (
              <div>
                <label htmlFor="confirm-reason" className="mb-1 block text-sm font-medium text-slate-700">
                  {reasonLabel} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="confirm-reason"
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  placeholder="Recorded on the audit trail"
                />
              </div>
            )}

            {requireTypedConfirmation && (
              <div>
                <label htmlFor="confirm-typed" className="mb-1 block text-sm font-medium text-slate-700">
                  Type <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-semibold">{requireTypedConfirmation}</code> to confirm
                </label>
                <input
                  id="confirm-typed"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={cancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={!canConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
              danger ? 'bg-red-600 enabled:hover:bg-red-700' : 'bg-primary-600 enabled:hover:bg-primary-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

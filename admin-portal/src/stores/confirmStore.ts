import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' renders a red primary button — use for destructive actions. */
  tone?: 'danger' | 'primary';
  /**
   * When set, the user must type this exact string to enable the confirm
   * button. Used for irreversible deletes of sensitive/compliance records.
   */
  requireTypedConfirmation?: string;
  /** Prompts for a free-text reason, passed back to the caller. */
  requireReason?: boolean;
  reasonLabel?: string;
}

export interface ConfirmResult {
  confirmed: boolean;
  reason?: string;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((r: ConfirmResult) => void) | null;
  request: (options: ConfirmOptions) => Promise<ConfirmResult>;
  respond: (result: ConfirmResult) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  request: (options) =>
    new Promise<ConfirmResult>((resolve) => {
      // A second request while one is open resolves the first as cancelled so
      // no caller is left awaiting forever.
      const pending = get().resolve;
      if (pending) pending({ confirmed: false });
      set({ open: true, options, resolve });
    }),
  respond: (result) => {
    const resolve = get().resolve;
    set({ open: false, options: null, resolve: null });
    resolve?.(result);
  },
}));

/**
 * Promise-based replacement for `window.confirm()`. Usable from any handler:
 *
 *   if (!(await confirmAction({ title: 'Delete this batch?', tone: 'danger' })).confirmed) return;
 */
export function confirmAction(options: ConfirmOptions): Promise<ConfirmResult> {
  return useConfirmStore.getState().request(options);
}

/** Convenience wrapper for the common "delete X?" case. */
export function confirmDelete(entity: string, extra?: Partial<ConfirmOptions>): Promise<boolean> {
  return confirmAction({
    title: `Delete this ${entity}?`,
    message: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
    ...extra,
  }).then((r) => r.confirmed);
}

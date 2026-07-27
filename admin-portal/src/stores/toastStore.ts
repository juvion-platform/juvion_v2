import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>, durationMs?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 3500,
  info: 4000,
  warning: 6000,
  // Errors linger — the user usually needs to read and act on them.
  error: 8000,
};

let seq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast, durationMs) => {
    const id = `t${++seq}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const ttl = durationMs ?? DEFAULT_DURATION[toast.variant];
    if (ttl > 0) {
      setTimeout(() => get().dismiss(id), ttl);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Imperative helper usable outside React (mutation callbacks, services).
 * Mirrors the react-hot-toast surface so call sites read naturally.
 */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: 'error', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: 'info', title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: 'warning', title, description }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

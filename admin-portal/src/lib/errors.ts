import { AxiosError } from 'axios';

/** Pulls the most useful human-readable message out of an unknown thrown value. */
export function extractErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  type ApiErrorBody = { error?: string; message?: string; errors?: unknown };
  const ax = err as AxiosError<ApiErrorBody | string> | undefined;

  if (ax?.isAxiosError) {
    if (ax.code === 'ERR_NETWORK') return 'Network unreachable — check your connection and try again.';
    if (ax.code === 'ECONNABORTED') return 'The request timed out. Please try again.';

    const raw = ax.response?.data;
    if (typeof raw === 'string' && raw.trim()) return raw;
    const data = (raw && typeof raw === 'object' ? raw : undefined) as ApiErrorBody | undefined;
    if (data) {
      if (typeof data.error === 'string') return data.error;
      if (typeof data.message === 'string') return data.message;
      // Zod-style: { errors: [{ path, message }] }
      if (Array.isArray(data.errors)) {
        const parts = data.errors
          .map((e: unknown) => {
            if (typeof e === 'string') return e;
            const o = e as { path?: unknown; message?: string };
            const path = Array.isArray(o?.path) ? o.path.join('.') : o?.path;
            return path ? `${path}: ${o?.message ?? ''}`.trim() : o?.message;
          })
          .filter(Boolean);
        if (parts.length) return parts.join('; ');
      }
    }

    const status = ax.response?.status;
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested record was not found.';
    if (status === 409) return 'That record already exists or conflicts with an existing one.';
    if (status && status >= 500) return 'The server encountered an error. Please try again shortly.';
  }

  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Past-tense wording used in the default success toast. */
export function defaultSuccessTitle(action?: string): string {
  switch ((action || '').toLowerCase()) {
    case 'create': return 'Created successfully';
    case 'update': return 'Changes saved';
    case 'delete': return 'Deleted successfully';
    case 'approve': return 'Approved';
    case 'reject': return 'Rejected';
    default: return 'Saved successfully';
  }
}

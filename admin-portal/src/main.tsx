import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import type { Mutation, Query } from '@tanstack/react-query';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import Toaster from './components/ui/Toaster';
import { toast } from './stores/toastStore';
import { extractErrorMessage, defaultSuccessTitle } from './lib/errors';
import './index.css';

/**
 * Per-mutation overrides, e.g.
 *   useMutation({ ..., meta: { successMessage: 'Student enrolled', invalidates: ['students'] } })
 * `silent: true` opts a mutation out of the automatic toast (used where the
 * page renders its own inline confirmation).
 */
interface JuvionMeta {
  successMessage?: string;
  errorMessage?: string;
  /** 'create' | 'update' | 'delete' — picks the default past-tense wording. */
  action?: string;
  silent?: boolean;
  silentError?: boolean;
}

function metaOf(m?: unknown): JuvionMeta {
  return (m ?? {}) as JuvionMeta;
}

// A 401 is already handled by the axios interceptor (silent refresh, then
// logout + redirect). Surfacing a toast for it as well is just noise.
function isHandledAuthError(err: unknown) {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 401;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },

  // Global feedback: every mutation in the app gets success + error toasts
  // without each of the ~200 call sites having to wire up onSuccess/onError.
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation: Mutation<unknown, unknown, unknown, unknown>) => {
      const meta = metaOf(mutation.meta);
      if (meta.silent) return;
      toast.success(meta.successMessage ?? defaultSuccessTitle(meta.action));
    },
    onError: (error, _vars, _ctx, mutation: Mutation<unknown, unknown, unknown, unknown>) => {
      const meta = metaOf(mutation.meta);
      if (meta.silentError || isHandledAuthError(error)) return;
      toast.error(meta.errorMessage ?? 'Action failed', extractErrorMessage(error));
    },
  }),

  // Surface failed reads too — previously a failed list query just rendered
  // an empty table with no explanation.
  queryCache: new QueryCache({
    onError: (error, query: Query<unknown, unknown, unknown, readonly unknown[]>) => {
      const meta = metaOf(query.meta);
      if (meta.silentError || isHandledAuthError(error)) return;
      toast.error(meta.errorMessage ?? 'Could not load data', extractErrorMessage(error));
    },
  }),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

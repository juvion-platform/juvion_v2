/**
 * Shared render helper for component tests.
 *
 * Wraps the rendered tree in:
 *   - <MemoryRouter> so any `useLocation` / `<Link>` references work
 *   - <QueryClientProvider> with retry disabled (queries should fail fast in
 *     tests; retry storms hang Vitest's fake timers / waitFor calls).
 *
 * Each test gets a fresh `QueryClient` by default — pass `queryClient` in
 * options to share one across multiple renders inside a single test (rare).
 */

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderOptions } from '@testing-library/react';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

interface ExtraOptions {
  route?: string;
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactNode,
  opts: ExtraOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { route = '/', queryClient = makeQueryClient(), ...rest } = opts;
  const result = render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[route]}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    ),
    ...rest,
  });
  return { ...result, queryClient };
}

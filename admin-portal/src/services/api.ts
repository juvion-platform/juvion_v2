import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Emitted when the session can no longer be recovered (refresh failed or was
 * rejected). `SessionWatcher` listens and performs a *soft* React Router
 * navigation, so unsaved form state is preserved in memory rather than being
 * destroyed by a `window.location.href` full-page reload.
 */
export const AUTH_LOGOUT_EVENT = 'juvion:auth-logout';

function isAuthEndpoint(url: string) {
  return url === '/auth/login' || url.endsWith('/auth/login')
    || url === '/auth/refresh' || url.endsWith('/auth/refresh');
}

function isLoginRequest(url: string) {
  return url === '/auth/login' || url.endsWith('/auth/login');
}

// Attach auth token + collegeId
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const collegeId = localStorage.getItem('collegeId');
  const url = config.url || '';

  if (token && !isLoginRequest(url)) config.headers.Authorization = `Bearer ${token}`;
  if (collegeId && !isLoginRequest(url)) config.headers['x-college-id'] = collegeId;
  return config;
});

// ─── Silent refresh ────────────────────────────────────────────────────────
// A single in-flight refresh is shared by every request that 401s at the same
// time, so a burst of parallel queries produces one /auth/refresh call.
let refreshInFlight: Promise<string> | null = null;

function decodeJwtExp(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = JSON.parse(json)?.exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

async function runRefresh(): Promise<string> {
  // Bare axios call: bypasses this instance's interceptors so a failing
  // refresh cannot recurse back into itself.
  const token = localStorage.getItem('token');
  const collegeId = localStorage.getItem('collegeId');
  const { data } = await axios.post(
    `${api.defaults.baseURL}/auth/refresh`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(collegeId ? { 'x-college-id': collegeId } : {}),
      },
    },
  );
  if (!data?.token) throw new Error('No token in refresh response');
  const { useAuthStore } = await import('../stores/authStore');
  useAuthStore.getState().setToken(data.token, data.permissions);
  return data.token as string;
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = runRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Proactively refreshes the JWT before it expires so a user sitting on a long
 * form is never bounced mid-edit. Returns a cleanup function.
 */
export function startTokenRefreshTimer(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const REFRESH_MARGIN_MS = 5 * 60 * 1000; // renew 5 minutes before expiry
  const MIN_DELAY_MS = 30 * 1000;
  const MAX_DELAY_MS = 12 * 60 * 60 * 1000; // setTimeout precision guard

  const schedule = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const exp = decodeJwtExp(token);
    if (!exp) return;
    const delay = Math.min(Math.max(exp - Date.now() - REFRESH_MARGIN_MS, MIN_DELAY_MS), MAX_DELAY_MS);
    timer = setTimeout(async () => {
      try {
        await refreshAccessToken();
      } catch {
        // Leave it to the 401 path; the user may simply be offline.
      }
      schedule();
    }, delay);
  };

  schedule();
  return () => { if (timer) clearTimeout(timer); };
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const original = err.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const url = original?.url || '';

    // Skip the auto-redirect when the failing request IS the login/refresh
    // call itself — otherwise bad credentials bounce the user back to a fresh
    // /login form before Login.tsx can render the error message.
    // Caught by Playwright AC4.3 (.captain/specs/playwright-e2e/spec.md).
    if (status !== 401 || !original || isAuthEndpoint(url)) {
      return Promise.reject(err);
    }

    // First 401 on a normal request: try to silently renew the token and
    // replay the request once. Only a failed renewal ends the session.
    if (!original._retried && localStorage.getItem('token')) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${token}` };
        return api.request(original);
      } catch {
        // fall through to logout
      }
    }

    const { useAuthStore } = await import('../stores/authStore');
    useAuthStore.getState().logout();
    window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
    return Promise.reject(err);
  },
);

export default api;

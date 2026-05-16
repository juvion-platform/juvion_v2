import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token + collegeId
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const collegeId = localStorage.getItem('collegeId');
  const url = config.url || '';
  const isLoginRequest = url === '/auth/login' || url.endsWith('/auth/login');

  if (token && !isLoginRequest) config.headers.Authorization = `Bearer ${token}`;
  if (collegeId && !isLoginRequest) config.headers['x-college-id'] = collegeId;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Skip the auto-redirect when the failing request IS the login
      // call itself — otherwise bad credentials bounce the user back
      // to a fresh /login form before Login.tsx can render the error
      // message. Caught by Playwright AC4.3 (.captain/specs/playwright-e2e/spec.md).
      const url = err.config?.url || '';
      const isLoginRequest = url === '/auth/login' || url.endsWith('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;

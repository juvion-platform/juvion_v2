import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token + collegeId
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const collegeId = localStorage.getItem('collegeId');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (collegeId) config.headers['x-college-id'] = collegeId;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;

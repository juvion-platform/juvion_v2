import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';

const sampleAccounts = [
  {
    label: 'Super Admin',
    email: 'super@juvion.dev',
    password: 'admin123',
    hint: 'Use this to access the college selector.',
  },
  {
    label: 'JIT Admin',
    email: 'admin@jit.edu.in',
    password: 'admin123',
    hint: 'Use this to sign directly into the JIT dashboard.',
  },
] as const;

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function applySampleCredentials(account: (typeof sampleAccounts)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.isSuperAdmin) {
        // Superadmin: store token + colleges, redirect to college selector
        setAuth(data.user, data.token, undefined, data.colleges, data.permissions);
        navigate('/select-college', { replace: true });
      } else {
        // Regular admin: store token + collegeId, redirect to dashboard
        setAuth(data.user, data.token, data.collegeId, undefined, data.permissions);
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F2744 0%, #1A365D 50%, #0F2744 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
            Juvion
          </h1>
          <p className="text-gray-400 text-sm mt-1">College ERP v2</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Sign in</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your credentials to access the dashboard</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none"
              placeholder="admin@juvion.dev"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 outline-none"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0F2744 0%, #1A365D 100%)' }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          {/* Dev-only: seeded credentials must never ship to a deployed build.
              `import.meta.env.DEV` is statically false in `vite build`, so this
              whole block (and the passwords in it) is dropped at bundle time. */}
          {import.meta.env.DEV && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Sample credentials</h3>
                <p className="mt-1 text-xs text-slate-500">Seeded accounts from the development database.</p>
              </div>

              <div className="mt-3 space-y-3">
                {sampleAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => applySampleCredentials(account)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{account.label}</div>
                        <div className="mt-1 text-xs text-slate-600">{account.email}</div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {account.password}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{account.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

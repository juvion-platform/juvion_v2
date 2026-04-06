import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Building2, Settings, ArrowRight } from 'lucide-react';

export default function CollegeSelector() {
  const navigate = useNavigate();
  const colleges = useAuthStore((s) => s.colleges);
  const selectCollege = useAuthStore((s) => s.selectCollege);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const displayName = user?.name || (() => {
    if (!token) return 'Super Admin';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.name || 'Super Admin';
    } catch { return 'Super Admin'; }
  })();

  function handleSelect(college: { _id: string; name: string }) {
    selectCollege(college._id, college.name);
    navigate('/', { replace: true });
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0F2744 0%, #1A365D 50%, #0F2744 100%)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
          Juvion
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-300 text-sm">{displayName}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">Select a College</h2>
          <p className="text-gray-400">Choose a college to manage its dashboard</p>
        </div>

        {/* Manage Colleges link */}
        <div className="flex justify-end mb-6">
          <Link
            to="/colleges"
            className="flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm font-medium transition-colors"
          >
            <Settings size={16} />
            Manage Colleges
          </Link>
        </div>

        {/* College Cards Grid */}
        {colleges.length === 0 ? (
          <div className="text-center py-20">
            <Building2 size={48} className="mx-auto text-gray-500 mb-4" />
            <p className="text-gray-400 text-lg mb-4">No colleges found</p>
            <Link
              to="/colleges"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm font-medium"
            >
              <Settings size={16} />
              Create your first college
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {colleges.map((college) => (
              <button
                key={college._id}
                onClick={() => handleSelect(college)}
                className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-left hover:bg-white/10 hover:border-teal-400/30 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Building2 size={24} className="text-teal-400" />
                  </div>
                  <ArrowRight size={18} className="text-gray-500 group-hover:text-teal-400 transition-colors mt-1" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-1">{college.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                    {college.code}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    college.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {college.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

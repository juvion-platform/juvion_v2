import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, UserPlus, Users, GraduationCap, IndianRupee,
  Briefcase, Heart, Building2, TrendingUp, Shield, Landmark,
  Settings, Bot, ChevronLeft, Menu, BookOpen, LogOut, ArrowLeftRight, ChevronDown
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../stores/authStore';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', iconColor: 'text-sky-400', module: null },
  { to: '/admissions', icon: UserPlus, label: 'Admissions', iconColor: 'text-emerald-400', module: 'admissions' },
  { to: '/people', icon: Users, label: 'People', iconColor: 'text-blue-400', module: 'people' },
  { to: '/academics', icon: GraduationCap, label: 'Academics', iconColor: 'text-amber-400', module: 'academics' },
  { to: '/finance', icon: IndianRupee, label: 'Finance', iconColor: 'text-green-400', module: 'finance' },
  { to: '/hr', icon: Briefcase, label: 'HR', iconColor: 'text-violet-400', module: 'hr' },
  { to: '/welfare', icon: Heart, label: 'Welfare', iconColor: 'text-rose-400', module: 'welfare' },
  { to: '/placement', icon: TrendingUp, label: 'Placement', iconColor: 'text-cyan-400', module: 'placement' },
  { to: '/campus', icon: Building2, label: 'Campus Ops', iconColor: 'text-orange-400', module: 'campus' },
  { to: '/student-dev', icon: BookOpen, label: 'Student Dev', iconColor: 'text-teal-400', module: 'student-dev' },
  { to: '/compliance', icon: Shield, label: 'Compliance', iconColor: 'text-red-400', module: 'compliance' },
  { to: '/governance', icon: Landmark, label: 'Governance', iconColor: 'text-indigo-400', module: 'governance' },
  { to: '/platform', icon: Settings, label: 'Platform', iconColor: 'text-gray-400', module: 'platform' },
  { to: '/juvi', icon: Bot, label: 'Juvi AI', iconColor: 'text-purple-400', module: 'juvi' },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const collegeName = useAuthStore((s) => s.collegeName);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.module || hasPermission(item.module, 'read')
  );

  // Decode user from token if user is null (page refresh)
  const displayName = user?.name || (() => {
    if (!token) return 'Admin';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.name || 'Admin';
    } catch { return 'Admin'; }
  })();

  const initial = (typeof displayName === 'string' ? displayName : 'A').charAt(0).toUpperCase();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleSwitchCollege() {
    // Clear the selected college so the selector shows
    const { selectCollege } = useAuthStore.getState();
    selectCollege('', '');
    localStorage.removeItem('collegeId');
    localStorage.removeItem('collegeName');
    useAuthStore.setState({ collegeId: null, collegeName: null });
    navigate('/select-college', { replace: true });
  }

  function handleManageColleges() {
    navigate('/colleges');
    setProfileOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-56',
      )} style={{ background: 'linear-gradient(180deg, #0F2744 0%, #1A365D 100%)' }}>
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-white/10">
          {!collapsed && (
            <span className="text-lg font-bold tracking-wide bg-gradient-to-r from-teal-400 to-primary-300 bg-clip-text text-transparent">
              Juvion
            </span>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
            {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* College Name (superadmin scoped) */}
        {isSuperAdmin && collegeName && !collapsed && (
          <div className="px-3 py-2 border-b border-white/10">
            <button
              onClick={handleSwitchCollege}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white transition-colors"
            >
              <Building2 size={14} className="text-teal-400 shrink-0" />
              <span className="truncate">{collegeName}</span>
              <ArrowLeftRight size={12} className="ml-auto shrink-0 text-gray-500" />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
          {visibleItems.map(({ to, icon: Icon, label, iconColor }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg text-sm transition-all duration-150',
                isActive
                  ? 'bg-teal-500/20 text-teal-300 font-medium shadow-sm'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200',
              )}
            >
              <Icon size={18} className={clsx('shrink-0', iconColor)} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom branding */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-white/10">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">College ERP v2</p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-gray-200 bg-white shadow-sm">
          <h1 className="text-lg font-semibold text-navy">
            {collegeName || 'College ERP'}
          </h1>
          <div className="relative flex items-center gap-3">
            <span className="text-sm text-gray-500">{displayName}</span>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-1"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-primary-500 text-white flex items-center justify-center text-sm font-medium shadow-sm">
                {initial}
              </div>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {/* Dropdown menu */}
            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                {isSuperAdmin && (
                  <>
                    <button
                      onClick={handleSwitchCollege}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <ArrowLeftRight size={15} className="text-gray-400" />
                      Switch College
                    </button>
                    <button
                      onClick={handleManageColleges}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Building2 size={15} className="text-gray-400" />
                      Manage Colleges
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-bg-app" onClick={() => profileOpen && setProfileOpen(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

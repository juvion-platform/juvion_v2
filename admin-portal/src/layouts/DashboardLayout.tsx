import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, UserPlus, Users, GraduationCap, IndianRupee,
  Briefcase, Heart, Building2, TrendingUp, Shield, Landmark,
  Settings, Bot, ChevronLeft, Menu, BookOpen, LogOut, ArrowLeftRight, ChevronDown, ChevronRight, Database
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../stores/authStore';
import GlobalSearch from '../components/search/GlobalSearch';

/**
 * Nav item shape. `children` makes an entry an expandable group (e.g. Finance);
 * clicking the parent expands the group AND navigates to the group's `to`.
 * A child with `section: true` renders as an uppercase label divider in the
 * expanded submenu instead of a clickable link.
 */
type NavChild =
  | { to: string; label: string; section?: false }
  | { section: true; label: string };

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  iconColor: string;
  module: string | null;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', iconColor: 'text-sky-400', module: null },
  { to: '/master-data', icon: Database, label: 'Master Data', iconColor: 'text-slate-400', module: null },
  { to: '/admissions', icon: UserPlus, label: 'Admissions', iconColor: 'text-emerald-400', module: 'admissions' },
  { to: '/people', icon: Users, label: 'People', iconColor: 'text-blue-400', module: 'people' },
  { to: '/academics', icon: GraduationCap, label: 'Academics', iconColor: 'text-amber-400', module: 'academics' },
  {
    to: '/finance',
    icon: IndianRupee,
    label: 'Finance',
    iconColor: 'text-green-400',
    module: 'finance',
    children: [
      { to: '/finance/dashboard', label: 'Dashboard' },
      // The full section-card hub lives at /finance/overview. It had no link
      // anywhere in the UI, so it was reachable only by typing the URL.
      { to: '/finance/overview', label: 'All Finance Sections' },
      { to: '/finance/fee-management', label: 'Fee Management' },
      { to: '/finance/scholarships-concessions', label: 'Scholarships & Concessions' },
      { to: '/finance/accounting', label: 'Accounting' },
    ],
  },
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

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

export default function DashboardLayout() {
  // Persisted so the sidebar doesn't spring back open on every refresh.
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  /** Which group's flyout is showing while the sidebar is collapsed. */
  const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const collegeName = useAuthStore((s) => s.collegeName);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.module || hasPermission(item.module, 'read')
  );

  // Auto-expand any group whose `to` is a prefix of the current URL. Keeps the
  // submenu visible when the user navigates into a finance sub-page directly
  // (e.g. refresh on /finance/holds) or clicks a sub-link.
  useEffect(() => {
    const match = NAV_ITEMS.find(
      (n) => n.children && location.pathname.startsWith(n.to),
    );
    if (match) setExpandedGroup(match.to);
  }, [location.pathname]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroup((prev) => (prev === groupKey ? null : groupKey));
  };

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!prev));
      return !prev;
    });
    setFlyoutGroup(null);
  }

  // The profile dropdown used to close only on clicks inside <main>, so it
  // hung over the next page when the user clicked a sidebar link. Close it on
  // any navigation, on Escape, and on any click outside the menu itself.
  useEffect(() => { setProfileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setProfileOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  // Decode user from token if user is null (page refresh)
  const displayName = user?.name || (() => {
    if (!token) return 'Admin';
    try {
      const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
      return payload.name || 'Admin';
    } catch { return 'Admin'; }
  })();

  const initial = (typeof displayName === 'string' ? displayName : 'A').charAt(0).toUpperCase();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleSwitchCollege() {
    // clearCollege() nulls both the store and localStorage. The old path called
    // selectCollege('', '') first, which left collegeId as '' — falsy, so
    // RequireCollege happened to work, but any `=== null` check downstream
    // would have silently disagreed.
    useAuthStore.getState().clearCollege();
    setProfileOpen(false);
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
          <button onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="p-1 rounded text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
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
          {visibleItems.map((item) => {
            const { to, icon: Icon, label, iconColor, children } = item;
            const isGroup = !!children?.length;
            const isGroupExpanded = isGroup && expandedGroup === to && !collapsed;
            const isOnGroupPath = isGroup && location.pathname.startsWith(to);

            if (!isGroup) {
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  // Collapsed mode is icon-only, so the label has to survive as
                  // a tooltip and an accessible name.
                  title={collapsed ? label : undefined}
                  aria-label={collapsed ? label : undefined}
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
              );
            }

            // Group entry: clicking navigates AND toggles expansion. When the
            // sidebar is collapsed the submenu can't expand inline, so hovering
            // the icon reveals a flyout — otherwise sub-pages like
            // /finance/accounting are unreachable without expanding first.
            return (
              <div
                key={to}
                className="relative"
                onMouseEnter={() => collapsed && setFlyoutGroup(to)}
                onMouseLeave={() => collapsed && setFlyoutGroup(null)}
              >
                <button
                  type="button"
                  title={collapsed ? label : undefined}
                  aria-label={collapsed ? label : undefined}
                  onClick={() => {
                    if (!collapsed) toggleGroup(to);
                    navigate(to);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg text-sm transition-all duration-150',
                    isOnGroupPath
                      ? 'bg-teal-500/20 text-teal-300 font-medium shadow-sm'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200',
                  )}
                  style={{ width: 'calc(100% - 0.75rem)' }}
                  aria-expanded={isGroupExpanded}
                >
                  <Icon size={18} className={clsx('shrink-0', iconColor)} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{label}</span>
                      {isGroupExpanded ? (
                        <ChevronDown size={14} className="shrink-0 text-gray-500" />
                      ) : (
                        <ChevronRight size={14} className="shrink-0 text-gray-500" />
                      )}
                    </>
                  )}
                </button>

                {collapsed && flyoutGroup === to && (
                  <div className="absolute left-full top-0 z-50 ml-1 w-56 rounded-lg border border-white/10 py-1.5 shadow-xl"
                       style={{ background: 'linear-gradient(180deg, #1A365D 0%, #0F2744 100%)' }}>
                    <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {label}
                    </p>
                    {children!.map((child, idx) =>
                      child.section ? (
                        <div key={`fsec-${idx}`} className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          {child.label}
                        </div>
                      ) : (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={() => setFlyoutGroup(null)}
                          className={({ isActive }) => clsx(
                            'block px-3 py-1.5 text-xs transition-colors',
                            isActive ? 'bg-teal-500/15 text-teal-300 font-medium' : 'text-gray-300 hover:bg-white/5 hover:text-white',
                          )}
                        >
                          {child.label}
                        </NavLink>
                      ),
                    )}
                  </div>
                )}

                {isGroupExpanded && (
                  <div className="mt-0.5 mb-1 space-y-0.5">
                    {children!.map((child, idx) => {
                      if (child.section) {
                        return (
                          <div
                            key={`sec-${idx}`}
                            className="px-3 pt-2 pb-1 ml-7 text-[10px] font-semibold uppercase tracking-wider text-gray-500"
                          >
                            {child.label}
                          </div>
                        );
                      }
                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          // No `end` so that tabbed parent pages stay active
                          // while the user is on any of their sub-tabs
                          // (e.g. /finance/fee-management/payments keeps the
                          // "Fee Management" sidebar row highlighted).
                          className={({ isActive }) =>
                            clsx(
                              'flex items-center gap-2 px-3 py-1.5 ml-7 mr-1.5 rounded-md text-xs transition-all duration-150',
                              isActive
                                ? 'bg-teal-500/15 text-teal-300 font-medium'
                                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200',
                            )
                          }
                        >
                          <span className="truncate">{child.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
          <div ref={profileRef} className="relative flex items-center gap-3">
            <GlobalSearch />
            <span className="hidden md:inline text-sm text-gray-500">{displayName}</span>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-1"
              aria-label="Open profile menu"
              data-testid="profile-menu-trigger"
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
                  data-testid="sign-out-button"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-bg-app">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

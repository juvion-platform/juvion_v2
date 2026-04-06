import { Outlet, NavLink } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, UserPlus, Users, GraduationCap, IndianRupee,
  Briefcase, Heart, Building2, TrendingUp, Shield, Landmark,
  Settings, Bot, ChevronLeft, Menu, BookOpen
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', iconColor: 'text-sky-400' },
  { to: '/admissions', icon: UserPlus, label: 'Admissions', iconColor: 'text-emerald-400' },
  { to: '/people', icon: Users, label: 'People', iconColor: 'text-blue-400' },
  { to: '/academics', icon: GraduationCap, label: 'Academics', iconColor: 'text-amber-400' },
  { to: '/finance', icon: IndianRupee, label: 'Finance', iconColor: 'text-green-400' },
  { to: '/hr', icon: Briefcase, label: 'HR', iconColor: 'text-violet-400' },
  { to: '/welfare', icon: Heart, label: 'Welfare', iconColor: 'text-rose-400' },
  { to: '/placement', icon: TrendingUp, label: 'Placement', iconColor: 'text-cyan-400' },
  { to: '/campus', icon: Building2, label: 'Campus Ops', iconColor: 'text-orange-400' },
  { to: '/student-dev', icon: BookOpen, label: 'Student Dev', iconColor: 'text-teal-400' },
  { to: '/compliance', icon: Shield, label: 'Compliance', iconColor: 'text-red-400' },
  { to: '/governance', icon: Landmark, label: 'Governance', iconColor: 'text-indigo-400' },
  { to: '/platform', icon: Settings, label: 'Platform', iconColor: 'text-gray-400' },
  { to: '/juvi', icon: Bot, label: 'Juvi AI', iconColor: 'text-purple-400' },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — Navy from old Juvion */}
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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label, iconColor }) => (
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
          <h1 className="text-lg font-semibold text-navy">College ERP</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Admin</span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-primary-500 text-white flex items-center justify-center text-sm font-medium shadow-sm">
              A
            </div>
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

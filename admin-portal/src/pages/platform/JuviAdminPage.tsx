import { NavLink, Route, Routes } from 'react-router-dom';
import SettingsTab from '../../components/platform/juvi/SettingsTab';
import ProvisioningTab from '../../components/platform/juvi/ProvisioningTab';   // Task 7
import ChannelsTab from '../../components/platform/juvi/ChannelsTab';           // Task 8

// Absolute paths: this page is mounted at `path="juvi/*"` (Platform.tsx), so a relative
// NavLink target resolves against whatever the wildcard captured (the current URL), not
// against this page's own base — e.g. `to: 'settings'` from `/platform/juvi/settings` would
// resolve to `/platform/juvi/settings/settings`. Absolute targets sidestep that entirely.
const TABS = [
  { to: '/platform/juvi', label: 'Provisioning', end: true },
  { to: '/platform/juvi/settings', label: 'Settings', end: false },
  { to: '/platform/juvi/channels', label: 'Channels', end: false },
];

export default function JuviAdminPage() {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-navy">Juvi mobile app</h2>
        <p className="text-sm text-gray-500 mt-1">
          Provision students and faculty into the app, export their first-sign-in credentials, and control branding, quiet hours and availability.
        </p>
      </div>
      <nav className="flex gap-1 border-b mb-5" aria-label="Juvi sections">
        {TABS.map((t) => (
          <NavLink key={t.label} to={t.to} end={t.end}
            className={({ isActive }) => `px-4 py-2 text-sm border-b-2 -mb-px ${isActive ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<ProvisioningTab />} />
        <Route path="settings" element={<SettingsTab />} />
        <Route path="channels" element={<ChannelsTab />} />
      </Routes>
    </div>
  );
}

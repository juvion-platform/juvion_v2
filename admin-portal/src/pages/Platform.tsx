import { Routes, Route } from 'react-router-dom';

const subdomains = [{ label: 'Settings', desc: 'System configuration' }, { label: 'Users', desc: 'User management' }, { label: 'Roles', desc: 'RBAC configuration' }, { label: 'Audit Logs', desc: 'System audit trail' }, { label: 'Integrations', desc: 'Third-party connectors' }];

function PlatformHome() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Platform (M12)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subdomains.map((sd) => (
          <div key={sd.label} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer">
            <h3 className="font-medium text-gray-900">{sd.label}</h3>
            <p className="text-xs text-gray-500 mt-1">{sd.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Platform() {
  return (
    <Routes>
      <Route index element={<PlatformHome />} />
    </Routes>
  );
}

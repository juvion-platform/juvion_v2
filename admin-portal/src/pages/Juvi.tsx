import { Routes, Route } from 'react-router-dom';

const subdomains = [{ label: 'Chat', desc: 'AI-powered assistant' }, { label: 'Insights', desc: 'Proactive analytics' }, { label: 'Knowledge Base', desc: 'FAQ management' }, { label: 'Personas', desc: 'Role-based configs' }, { label: 'Usage', desc: 'Analytics & metrics' }];

function JuviHome() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Juvi AI Assistant</h2>
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

export default function Juvi() {
  return (
    <Routes>
      <Route index element={<JuviHome />} />
    </Routes>
  );
}

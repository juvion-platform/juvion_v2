import { Routes, Route } from 'react-router-dom';

const subdomains = [{ label: 'NAAC', desc: 'NAAC accreditation' }, { label: 'NBA', desc: 'NBA programme accreditation' }, { label: 'AICTE', desc: 'AICTE approval status' }, { label: 'Affiliation', desc: 'University affiliation' }, { label: 'Audits', desc: 'Internal & external audits' }, { label: 'IQAC', desc: 'Quality assurance reports' }, { label: 'Legal', desc: 'Legal cases & RTI' }];

function ComplianceHome() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Compliance & Accreditation (M10)</h2>
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

export default function Compliance() {
  return (
    <Routes>
      <Route index element={<ComplianceHome />} />
    </Routes>
  );
}

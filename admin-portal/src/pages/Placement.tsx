import { Routes, Route } from 'react-router-dom';

const subdomains = [{ label: 'Companies', desc: 'Company database' }, { label: 'Job Postings', desc: 'Campus drive management' }, { label: 'Registrations', desc: 'Student applications' }, { label: 'Rounds', desc: 'Selection process' }, { label: 'Offers', desc: 'Placement offers' }, { label: 'Internships', desc: 'Internship opportunities' }, { label: 'Training', desc: 'Aptitude & soft skills' }, { label: 'Higher Studies', desc: 'GATE/GRE tracking' }, { label: 'Alumni', desc: 'Alumni network' }];

function PlacementHome() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Placement & Career (M07)</h2>
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

export default function Placement() {
  return (
    <Routes>
      <Route index element={<PlacementHome />} />
    </Routes>
  );
}

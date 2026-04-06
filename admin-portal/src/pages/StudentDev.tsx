import { Routes, Route } from 'react-router-dom';

const subdomains = [{ label: 'Clubs', desc: 'Club management' }, { label: 'Events', desc: 'Cultural & technical events' }, { label: 'Achievements', desc: 'Awards & recognition' }, { label: 'Mentoring', desc: 'Faculty-student mentoring' }, { label: 'Sports', desc: 'Teams & tournaments' }, { label: 'NSS', desc: 'Social service activities' }, { label: 'Projects', desc: 'Mini & major projects' }, { label: 'Certifications', desc: 'Skill certifications' }];

function StudentDevHome() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Student Development (M09)</h2>
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

export default function StudentDev() {
  return (
    <Routes>
      <Route index element={<StudentDevHome />} />
    </Routes>
  );
}

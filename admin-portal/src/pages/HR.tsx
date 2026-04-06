import { Routes, Route } from 'react-router-dom';

const subdomains = [{ label: 'Employees', desc: 'Employee master data' }, { label: 'Leave', desc: 'Leave management' }, { label: 'Attendance', desc: 'Biometric & manual' }, { label: 'Payroll', desc: 'Salary processing' }, { label: 'Appraisals', desc: 'Performance reviews' }, { label: 'Training', desc: 'FDPs & workshops' }, { label: 'Recruitment', desc: 'Job postings & hiring' }, { label: 'Research', desc: 'Publications & projects' }];

function HRHome() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Human Resources (M05)</h2>
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

export default function HR() {
  return (
    <Routes>
      <Route index element={<HRHome />} />
    </Routes>
  );
}

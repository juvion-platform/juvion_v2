import { Routes, Route } from 'react-router-dom';

const subdomains = [{ label: 'Hostel', desc: 'Block & room allocation' }, { label: 'Mess', desc: 'Menu & feedback' }, { label: 'Transport', desc: 'Routes & allocation' }, { label: 'Health', desc: 'Medical records & visits' }, { label: 'Counseling', desc: 'Mental health support' }, { label: 'Anti-Ragging', desc: 'Complaint handling' }, { label: 'Grievances', desc: 'Student grievance cell' }];

function WelfareHome() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Student Welfare (M06)</h2>
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

export default function Welfare() {
  return (
    <Routes>
      <Route index element={<WelfareHome />} />
    </Routes>
  );
}

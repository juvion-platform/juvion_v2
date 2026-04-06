import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Admissions from './pages/Admissions';
import People from './pages/People';
import Academics from './pages/Academics';
import Finance from './pages/Finance';
import HR from './pages/HR';
import Welfare from './pages/Welfare';
import Placement from './pages/Placement';
import CampusOps from './pages/CampusOps';
import StudentDev from './pages/StudentDev';
import Compliance from './pages/Compliance';
import Governance from './pages/Governance';
import Platform from './pages/Platform';
import Juvi from './pages/Juvi';

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admissions/*" element={<Admissions />} />
        <Route path="/people/*" element={<People />} />
        <Route path="/academics/*" element={<Academics />} />
        <Route path="/finance/*" element={<Finance />} />
        <Route path="/hr/*" element={<HR />} />
        <Route path="/welfare/*" element={<Welfare />} />
        <Route path="/placement/*" element={<Placement />} />
        <Route path="/campus/*" element={<CampusOps />} />
        <Route path="/student-dev/*" element={<StudentDev />} />
        <Route path="/compliance/*" element={<Compliance />} />
        <Route path="/governance/*" element={<Governance />} />
        <Route path="/platform/*" element={<Platform />} />
        <Route path="/juvi/*" element={<Juvi />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

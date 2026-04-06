import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import CollegeSelector from './pages/CollegeSelector';
import CollegeManagement from './pages/CollegeManagement';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireCollege({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const collegeId = useAuthStore((s) => s.collegeId);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  if (!token) return <Navigate to="/login" replace />;
  // Superadmin without a selected college must pick one first
  if (isSuperAdmin && !collegeId) return <Navigate to="/select-college" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Superadmin-only routes */}
      <Route path="/select-college" element={<ProtectedRoute><CollegeSelector /></ProtectedRoute>} />
      <Route path="/colleges" element={<ProtectedRoute><CollegeManagement /></ProtectedRoute>} />

      {/* College-scoped routes (need a selected college) */}
      <Route
        element={
          <RequireCollege>
            <DashboardLayout />
          </RequireCollege>
        }
      >
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

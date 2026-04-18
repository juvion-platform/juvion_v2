import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import DashboardLayout from './layouts/DashboardLayout';

const Login = lazy(() => import('./pages/Login'));
const CollegeSelector = lazy(() => import('./pages/CollegeSelector'));
const CollegeManagement = lazy(() => import('./pages/CollegeManagement'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Admissions = lazy(() => import('./pages/Admissions'));
const People = lazy(() => import('./pages/People'));
const Academics = lazy(() => import('./pages/Academics'));
const Finance = lazy(() => import('./pages/Finance'));
const HR = lazy(() => import('./pages/HR'));
const Welfare = lazy(() => import('./pages/Welfare'));
const Placement = lazy(() => import('./pages/Placement'));
const CampusOps = lazy(() => import('./pages/CampusOps'));
const StudentDev = lazy(() => import('./pages/StudentDev'));
const Compliance = lazy(() => import('./pages/Compliance'));
const Governance = lazy(() => import('./pages/Governance'));
const Platform = lazy(() => import('./pages/Platform'));
const Juvi = lazy(() => import('./pages/Juvi'));
const MasterData = lazy(() => import('./pages/MasterData'));

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

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        Loading page...
      </div>
    </div>
  );
}

function renderLazyPage(node: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={renderLazyPage(<Login />)} />

      {/* Superadmin-only routes */}
      <Route path="/select-college" element={<ProtectedRoute>{renderLazyPage(<CollegeSelector />)}</ProtectedRoute>} />
      <Route path="/colleges" element={<ProtectedRoute>{renderLazyPage(<CollegeManagement />)}</ProtectedRoute>} />

      {/* College-scoped routes (need a selected college) */}
      <Route
        element={
          <RequireCollege>
            <DashboardLayout />
          </RequireCollege>
        }
      >
        <Route path="/" element={renderLazyPage(<Dashboard />)} />
        <Route path="/admissions/*" element={renderLazyPage(<Admissions />)} />
        <Route path="/people/*" element={renderLazyPage(<People />)} />
        <Route path="/academics/*" element={renderLazyPage(<Academics />)} />
        <Route path="/finance/*" element={renderLazyPage(<Finance />)} />
        <Route path="/hr/*" element={renderLazyPage(<HR />)} />
        <Route path="/welfare/*" element={renderLazyPage(<Welfare />)} />
        <Route path="/placement/*" element={renderLazyPage(<Placement />)} />
        <Route path="/campus/*" element={renderLazyPage(<CampusOps />)} />
        <Route path="/student-dev/*" element={renderLazyPage(<StudentDev />)} />
        <Route path="/compliance/*" element={renderLazyPage(<Compliance />)} />
        <Route path="/governance/*" element={renderLazyPage(<Governance />)} />
        <Route path="/platform/*" element={renderLazyPage(<Platform />)} />
        <Route path="/juvi/*" element={renderLazyPage(<Juvi />)} />
        <Route path="/master-data/*" element={renderLazyPage(<MasterData />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

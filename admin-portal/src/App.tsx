import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import DashboardLayout from './layouts/DashboardLayout';
import ErrorBoundary from './components/ErrorBoundary';
import SessionWatcher from './components/SessionWatcher';

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
const SearchResults = lazy(() => import('./pages/SearchResults'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * College Management is a platform-owner surface — every one of its API calls
 * is superadmin-gated server-side. Without this check a regular admin could
 * reach the page and see a silently-403'd empty screen.
 */
function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  if (!token) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/" replace />;
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

/**
 * Wraps each lazy page in its own boundary keyed by pathname, so a crash in one
 * page shows a recoverable panel (with the shell still usable) and clears
 * automatically when the user navigates elsewhere.
 */
function RouteBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function renderLazyPage(node: React.ReactNode) {
  return <RouteBoundary>{node}</RouteBoundary>;
}

export default function App() {
  return (
    <>
      <SessionWatcher />
      <Routes>
        <Route path="/login" element={renderLazyPage(<Login />)} />

        {/* Superadmin-only routes */}
        <Route path="/select-college" element={<ProtectedRoute>{renderLazyPage(<CollegeSelector />)}</ProtectedRoute>} />
        <Route path="/colleges" element={<RequireSuperAdmin>{renderLazyPage(<CollegeManagement />)}</RequireSuperAdmin>} />

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
          <Route path="/search" element={renderLazyPage(<SearchResults />)} />
          {/* Show an explicit 404 rather than silently bouncing typos to the
              dashboard, which made broken links look like working ones. */}
          <Route path="*" element={renderLazyPage(<NotFound />)} />
        </Route>
      </Routes>
    </>
  );
}

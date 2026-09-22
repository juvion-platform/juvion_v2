import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * 010 — route guard. The browser mirrors the server: a user without the
 * permission is sent home instead of landing on a page whose every call 403s.
 */
export default function RequirePermission({
  module, action = 'read', subDomain, children,
}: { module: string; action?: string; subDomain?: string; children: React.ReactNode }) {
  const allowed = useAuthStore((s) => s.hasPermission(module, action, subDomain));
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

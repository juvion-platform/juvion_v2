import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AUTH_LOGOUT_EVENT, startTokenRefreshTimer } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';

/**
 * Owns session lifecycle side-effects:
 *  - rehydrates the `user` object from /auth/me on boot (survives F5)
 *  - keeps the JWT fresh in the background so long forms are never interrupted
 *  - converts an unrecoverable 401 into a *soft* redirect (React Router), which
 *    keeps the SPA mounted instead of blowing away in-memory state
 */
export default function SessionWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const hydrate = useAuthStore((s) => s.hydrate);

  // Boot-time rehydration — runs once per fresh page load that has a token.
  useEffect(() => {
    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;
    return startTokenRefreshTimer();
  }, [token]);

  useEffect(() => {
    function onLogout() {
      toast.warning('Session expired', 'Please sign in again to continue.');
      navigate('/login', { replace: true, state: { from: location.pathname } });
    }
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, [navigate, location.pathname]);

  return null;
}

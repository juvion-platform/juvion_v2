import { create } from 'zustand';

interface User { id: string; name: string; email: string; role: string; personaType: string; }
interface CollegeRef { _id: string; name: string; code: string; status: string; }

interface AuthState {
  user: User | null;
  token: string | null;
  collegeId: string | null;
  collegeName: string | null;
  colleges: CollegeRef[];
  isSuperAdmin: boolean;
  permissions: string[];
  setAuth: (user: User, token: string, collegeId?: string, colleges?: CollegeRef[], permissions?: string[]) => void;
  selectCollege: (collegeId: string, collegeName: string) => void;
  logout: () => void;
  hasPermission: (module: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  collegeId: localStorage.getItem('collegeId'),
  collegeName: localStorage.getItem('collegeName'),
  colleges: JSON.parse(localStorage.getItem('colleges') || '[]'),
  isSuperAdmin: localStorage.getItem('isSuperAdmin') === 'true',
  permissions: JSON.parse(localStorage.getItem('permissions') || '[]'),
  setAuth: (user, token, collegeId?, colleges?, permissions?) => {
    localStorage.setItem('token', token);
    const isSuperAdmin = user.role === 'super_admin';
    if (collegeId) {
      localStorage.setItem('collegeId', collegeId);
    } else {
      localStorage.removeItem('collegeId');
      localStorage.removeItem('collegeName');
    }
    if (colleges && colleges.length > 0) {
      localStorage.setItem('colleges', JSON.stringify(colleges));
    } else {
      localStorage.removeItem('colleges');
    }
    if (isSuperAdmin) {
      localStorage.setItem('isSuperAdmin', 'true');
    } else {
      localStorage.removeItem('isSuperAdmin');
    }
    const resolvedPermissions = permissions || [];
    if (resolvedPermissions.length > 0) {
      localStorage.setItem('permissions', JSON.stringify(resolvedPermissions));
    } else {
      localStorage.removeItem('permissions');
    }
    set({ user, token, collegeId: collegeId || null, colleges: colleges || [], isSuperAdmin, permissions: resolvedPermissions });
  },
  selectCollege: (collegeId, collegeName) => {
    localStorage.setItem('collegeId', collegeId);
    localStorage.setItem('collegeName', collegeName);
    set({ collegeId, collegeName });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('collegeId');
    localStorage.removeItem('collegeName');
    localStorage.removeItem('colleges');
    localStorage.removeItem('isSuperAdmin');
    localStorage.removeItem('permissions');
    set({ user: null, token: null, collegeId: null, collegeName: null, colleges: [], isSuperAdmin: false, permissions: [] });
  },
  hasPermission: (module, action) => {
    const perms = get().permissions;
    return perms.includes(`${module}:${action}`) || perms.includes(`${module}:*`) || perms.includes('*:*');
  },
}));

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
  /** False until the boot-time /auth/me rehydration settles. */
  hydrated: boolean;
  setAuth: (user: User, token: string, collegeId?: string, colleges?: CollegeRef[], permissions?: string[]) => void;
  setToken: (token: string, permissions?: string[]) => void;
  selectCollege: (collegeId: string, collegeName: string) => void;
  clearCollege: () => void;
  hydrate: () => Promise<void>;
  logout: () => void;
  hasPermission: (module: string, action: string) => boolean;
}

function readStoredUser(): User | null {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.id ? (parsed as User) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

function readStoredJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // The user object is persisted alongside the token so a refresh (F5) does not
  // leave name/role/email null while the /auth/me round-trip is in flight.
  user: readStoredUser(),
  token: localStorage.getItem('token'),
  collegeId: localStorage.getItem('collegeId'),
  collegeName: localStorage.getItem('collegeName'),
  colleges: readStoredJson<CollegeRef[]>('colleges', []),
  isSuperAdmin: localStorage.getItem('isSuperAdmin') === 'true',
  permissions: readStoredJson<string[]>('permissions', []),
  hydrated: false,
  setAuth: (user, token, collegeId?, colleges?, permissions?) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
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
    set({
      user,
      token,
      collegeId: collegeId || null,
      collegeName: collegeId ? localStorage.getItem('collegeName') : null,
      colleges: colleges || [],
      isSuperAdmin,
      permissions: resolvedPermissions,
      hydrated: true,
    });
  },
  setToken: (token, permissions) => {
    localStorage.setItem('token', token);
    if (permissions && permissions.length > 0) {
      localStorage.setItem('permissions', JSON.stringify(permissions));
      set({ token, permissions });
    } else {
      set({ token });
    }
  },
  selectCollege: (collegeId, collegeName) => {
    localStorage.setItem('collegeId', collegeId);
    localStorage.setItem('collegeName', collegeName);
    set({ collegeId, collegeName });
  },
  clearCollege: () => {
    localStorage.removeItem('collegeId');
    localStorage.removeItem('collegeName');
    set({ collegeId: null, collegeName: null });
  },
  hydrate: async () => {
    if (!get().token) {
      set({ hydrated: true });
      return;
    }
    try {
      // Imported lazily so this module never participates in an import cycle
      // with the axios instance (api.ts dispatches auth events back to us).
      const { default: api } = await import('../services/api');
      const { data } = await api.get('/auth/me');
      const user: User = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        personaType: data.personaType,
      };
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isSuperAdmin: user.role === 'super_admin', hydrated: true });
    } catch {
      // A 401 is handled by the axios interceptor (which logs out). Any other
      // failure (network blip) keeps the cached user rather than blanking the UI.
      set({ hydrated: true });
    }
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('collegeId');
    localStorage.removeItem('collegeName');
    localStorage.removeItem('colleges');
    localStorage.removeItem('isSuperAdmin');
    localStorage.removeItem('permissions');
    set({ user: null, token: null, collegeId: null, collegeName: null, colleges: [], isSuperAdmin: false, permissions: [], hydrated: true });
  },
  hasPermission: (module, action) => {
    const perms = get().permissions;
    return perms.includes(`${module}:${action}`) || perms.includes(`${module}:*`) || perms.includes('*:*');
  },
}));

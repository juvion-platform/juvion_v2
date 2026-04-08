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
  setAuth: (user: User, token: string, collegeId?: string, colleges?: CollegeRef[]) => void;
  selectCollege: (collegeId: string, collegeName: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  collegeId: localStorage.getItem('collegeId'),
  collegeName: localStorage.getItem('collegeName'),
  colleges: JSON.parse(localStorage.getItem('colleges') || '[]'),
  isSuperAdmin: localStorage.getItem('isSuperAdmin') === 'true',
  setAuth: (user, token, collegeId?, colleges?) => {
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
    set({ user, token, collegeId: collegeId || null, colleges: colleges || [], isSuperAdmin });
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
    set({ user: null, token: null, collegeId: null, collegeName: null, colleges: [], isSuperAdmin: false });
  },
}));

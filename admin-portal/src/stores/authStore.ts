import { create } from 'zustand';

interface User { id: string; name: string; email: string; role: string; personaType: string; }

interface AuthState {
  user: User | null;
  token: string | null;
  collegeId: string | null;
  setAuth: (user: User, token: string, collegeId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  collegeId: localStorage.getItem('collegeId'),
  setAuth: (user, token, collegeId) => {
    localStorage.setItem('token', token);
    localStorage.setItem('collegeId', collegeId);
    set({ user, token, collegeId });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('collegeId');
    set({ user: null, token: null, collegeId: null });
  },
}));

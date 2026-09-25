import api from './api';

const BASE = '/platform/users';

export interface PlatformUser {
  _id: string;
  email: string;
  name: string;
  role: string;
  personaType: string;
  personas: string[];
  personId?: { _id: string; name: string; email?: string; phone?: string } | null;
  isActive: boolean;
  createdAt?: string;
}

export interface UserInput {
  email: string;
  password?: string;
  name: string;
  personas: string[];
  personId?: string | null;
  isActive?: boolean;
}

export interface ExplainResult {
  verdict: 'allow' | 'deny';
  decision: { effect: string; description?: string; scope?: Record<string, unknown> } | null;
  perPersona: { persona: string; chain: string[]; winner: { effect: string; description?: string; personaType?: string | null; module: string; action: string } | null }[];
}

export const listUsers = (page = 1, limit = 20, q: { role?: string; persona?: string; includeInactive?: boolean } = {}) =>
  api.get(BASE, { params: { page, limit, role: q.role || undefined, persona: q.persona || undefined, includeInactive: q.includeInactive ? 'true' : undefined } }).then(r => r.data);
export const createUser = (data: UserInput) => api.post(BASE, data).then(r => r.data);
export const updateUser = (id: string, data: Partial<UserInput>) => api.put(`${BASE}/${id}`, data).then(r => r.data);
export const resetUserPassword = (id: string, password: string) => api.post(`${BASE}/${id}/reset-password`, { password }).then(r => r.data);
export const explainUserAccess = (id: string, module: string, action: string): Promise<ExplainResult> =>
  api.get(`${BASE}/${id}/explain`, { params: { module, action } }).then(r => r.data);

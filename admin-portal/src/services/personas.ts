import api from './api';

const BASE = '/platform/personas';

export interface Persona {
  _id: string;
  collegeId?: string | null;
  code: string;
  label: string;
  description?: string;
  family: string;
  parentCode?: string | null;
  primaryModule: string;
  defaultRole: string;
  tier: 1 | 2 | 3;
  dashboardWidgets?: string[];
  isActive: boolean;
  createdBy?: string;
}

export interface PersonaInput {
  code: string;
  label: string;
  description?: string;
  parentCode?: string | null;
  primaryModule: string;
  defaultRole: string;
  tier?: 1 | 2 | 3;
  dashboardWidgets?: string[];
  isActive?: boolean;
}

export const PERSONA_MODULES = ['admissions', 'academics', 'finance', 'people', 'hr', 'campus', 'welfare', 'placement', 'student-dev', 'compliance', 'governance', 'platform'] as const;
export const PERSONA_ROLES = ['super_admin', 'admin', 'principal', 'hod', 'faculty', 'staff', 'student', 'parent'] as const;

export const listPersonas = (includeInactive = false): Promise<Persona[]> =>
  api.get(BASE, { params: includeInactive ? { includeInactive: 'true' } : {} }).then(r => r.data);
export const createPersona = (data: PersonaInput) => api.post(BASE, data).then(r => r.data);
export const updatePersona = (id: string, data: Partial<Omit<PersonaInput, 'code'>>) => api.put(`${BASE}/${id}`, data).then(r => r.data);
export const deletePersona = (id: string) => api.delete(`${BASE}/${id}`).then(r => r.data);

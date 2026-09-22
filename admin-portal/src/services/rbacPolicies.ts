import api from './api';

const BASE = '/platform/rbac-policies';

export type AssignedVia = 'mentees' | 'sections' | 'courses';
export const ASSIGNED_VIA: AssignedVia[] = ['mentees', 'sections', 'courses'];
/** 010 P3 — field classes a policy may grant. Server strips the fields of any class not granted. */
export const SENSITIVITY_CLASSES = ['people.identity', 'hr.compensation', 'welfare.medical'] as const;
export type SensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

export interface PolicyScope {
  departmentOnly?: boolean;
  selfOnly?: boolean;
  subDomain?: string;
  assignedVia?: AssignedVia[];
  /** undefined = unrestricted, [] = none, list = only those classes */
  sensitivity?: string[];
}

export interface MatrixCell { effect: 'allow' | 'deny' | 'none'; scope?: PolicyScope }
export interface PolicyMatrix {
  personas: { code: string; label: string }[];
  modules: string[];
  actions: string[];
  cells: Record<string, Record<string, Record<string, MatrixCell>>>;
}
export interface DefaultsDiff {
  mode: 'snapshot' | 'cascade';
  missing: RbacPolicy[];
  changed: { key: string; college: RbacPolicy; system: RbacPolicy }[];
}

export interface RbacPolicy {
  _id: string;
  collegeId?: string;
  role: string;
  personaType?: string | null;
  module: string;
  action: string;
  effect: 'allow' | 'deny';
  scope?: PolicyScope;
  priority: number;
  description?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RbacPolicyInput {
  role: string;
  personaType?: string | null;
  module: string;
  action: string;
  effect: 'allow' | 'deny';
  scope?: PolicyScope;
  priority: number;
  description?: string;
  isActive?: boolean;
}

export const listRbacPolicies = (page = 1, limit = 50, role?: string, module?: string, search?: string) =>
  api.get(BASE, { params: { page, limit, role, module, ...(search ? { search } : {}) } }).then(r => r.data);

export const getRbacPolicy = (id: string) =>
  api.get(`${BASE}/${id}`).then(r => r.data);

export const createRbacPolicy = (data: RbacPolicyInput) =>
  api.post(BASE, data).then(r => r.data);

export const updateRbacPolicy = (id: string, data: Partial<RbacPolicyInput>) =>
  api.put(`${BASE}/${id}`, data).then(r => r.data);

export const deleteRbacPolicy = (id: string) =>
  api.delete(`${BASE}/${id}`).then(r => r.data);

export const getPolicyMatrix = (): Promise<PolicyMatrix> => api.get(`${BASE}/matrix`).then(r => r.data);
export const getDefaultsDiff = (): Promise<DefaultsDiff> => api.get(`${BASE}/defaults-diff`).then(r => r.data);
export const applyDefaults = (keys: string[]): Promise<{ applied: number }> => api.post(`${BASE}/apply-defaults`, { keys }).then(r => r.data);
export const snapshotPolicies = (): Promise<{ copied: number }> => api.post(`${BASE}/snapshot`, {}).then(r => r.data);

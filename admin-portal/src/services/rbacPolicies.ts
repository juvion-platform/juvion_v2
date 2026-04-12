import api from './api';

const BASE = '/platform/rbac-policies';

export interface RbacPolicy {
  _id: string;
  collegeId?: string;
  role: string;
  personaType?: string | null;
  module: string;
  action: string;
  effect: 'allow' | 'deny';
  scope?: {
    departmentOnly?: boolean;
    selfOnly?: boolean;
    subDomain?: string;
  };
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
  scope?: {
    departmentOnly?: boolean;
    selfOnly?: boolean;
    subDomain?: string;
  };
  priority: number;
  description?: string;
  isActive?: boolean;
}

export const listRbacPolicies = (page = 1, limit = 50, role?: string, module?: string) =>
  api.get(BASE, { params: { page, limit, role, module } }).then(r => r.data);

export const getRbacPolicy = (id: string) =>
  api.get(`${BASE}/${id}`).then(r => r.data);

export const createRbacPolicy = (data: RbacPolicyInput) =>
  api.post(BASE, data).then(r => r.data);

export const updateRbacPolicy = (id: string, data: Partial<RbacPolicyInput>) =>
  api.put(`${BASE}/${id}`, data).then(r => r.data);

export const deleteRbacPolicy = (id: string) =>
  api.delete(`${BASE}/${id}`).then(r => r.data);

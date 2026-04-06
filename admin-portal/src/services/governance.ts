import api from './api';

const BASE = '/governance';

// ─── Stats ────────────────────────────────────────────────
export const getGovernanceStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Committees ───────────────────────────────────────────
export const listCommittees = (page = 1, limit = 20, type?: string) =>
  api.get(`${BASE}/committees`, { params: { page, limit, type } }).then(r => r.data);
export const getCommittee = (id: string) =>
  api.get(`${BASE}/committees/${id}`).then(r => r.data);
export const createCommittee = (data: any) =>
  api.post(`${BASE}/committees`, data).then(r => r.data);
export const updateCommittee = (id: string, data: any) =>
  api.put(`${BASE}/committees/${id}`, data).then(r => r.data);
export const deleteCommittee = (id: string) =>
  api.delete(`${BASE}/committees/${id}`).then(r => r.data);

// ─── Committee Meetings ──────────────────────────────────
export const listMeetings = (page = 1, limit = 20, committeeId?: string, status?: string) =>
  api.get(`${BASE}/meetings`, { params: { page, limit, committeeId, status } }).then(r => r.data);
export const getMeeting = (id: string) =>
  api.get(`${BASE}/meetings/${id}`).then(r => r.data);
export const createMeeting = (data: any) =>
  api.post(`${BASE}/meetings`, data).then(r => r.data);
export const updateMeeting = (id: string, data: any) =>
  api.put(`${BASE}/meetings/${id}`, data).then(r => r.data);
export const deleteMeeting = (id: string) =>
  api.delete(`${BASE}/meetings/${id}`).then(r => r.data);

// ─── Policies ─────────────────────────────────────────────
export const listPolicies = (page = 1, limit = 20, category?: string, status?: string) =>
  api.get(`${BASE}/policies`, { params: { page, limit, category, status } }).then(r => r.data);
export const getPolicy = (id: string) =>
  api.get(`${BASE}/policies/${id}`).then(r => r.data);
export const createPolicy = (data: any) =>
  api.post(`${BASE}/policies`, data).then(r => r.data);
export const updatePolicy = (id: string, data: any) =>
  api.put(`${BASE}/policies/${id}`, data).then(r => r.data);
export const deletePolicy = (id: string) =>
  api.delete(`${BASE}/policies/${id}`).then(r => r.data);

// ─── Governing Body Members ──────────────────────────────
export const listBoardMembers = (page = 1, limit = 20, role?: string) =>
  api.get(`${BASE}/board-members`, { params: { page, limit, role } }).then(r => r.data);
export const getBoardMember = (id: string) =>
  api.get(`${BASE}/board-members/${id}`).then(r => r.data);
export const createBoardMember = (data: any) =>
  api.post(`${BASE}/board-members`, data).then(r => r.data);
export const updateBoardMember = (id: string, data: any) =>
  api.put(`${BASE}/board-members/${id}`, data).then(r => r.data);
export const deleteBoardMember = (id: string) =>
  api.delete(`${BASE}/board-members/${id}`).then(r => r.data);

// ─── Strategic Goals ──────────────────────────────────────
export const listGoals = (page = 1, limit = 20, category?: string, status?: string) =>
  api.get(`${BASE}/goals`, { params: { page, limit, category, status } }).then(r => r.data);
export const getGoal = (id: string) =>
  api.get(`${BASE}/goals/${id}`).then(r => r.data);
export const createGoal = (data: any) =>
  api.post(`${BASE}/goals`, data).then(r => r.data);
export const updateGoal = (id: string, data: any) =>
  api.put(`${BASE}/goals/${id}`, data).then(r => r.data);
export const deleteGoal = (id: string) =>
  api.delete(`${BASE}/goals/${id}`).then(r => r.data);

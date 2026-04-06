import api from './api';

const BASE = '/juvi';

// ─── Stats ────────────────────────────────────────────────
export const getJuviStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Conversations ────────────────────────────────────────
export const listConversations = (page = 1, limit = 20) =>
  api.get(`${BASE}/conversations`, { params: { page, limit } }).then(r => r.data);
export const getConversation = (id: string) =>
  api.get(`${BASE}/conversations/${id}`).then(r => r.data);
export const createConversation = (data: any) =>
  api.post(`${BASE}/conversations`, data).then(r => r.data);
export const updateConversation = (id: string, data: any) =>
  api.put(`${BASE}/conversations/${id}`, data).then(r => r.data);
export const deleteConversation = (id: string) =>
  api.delete(`${BASE}/conversations/${id}`).then(r => r.data);

// ─── Messages ─────────────────────────────────────────────
export const listMessages = (page = 1, limit = 20, conversationId?: string) =>
  api.get(`${BASE}/messages`, { params: { page, limit, conversationId } }).then(r => r.data);
export const getMessage = (id: string) =>
  api.get(`${BASE}/messages/${id}`).then(r => r.data);
export const createMessage = (data: any) =>
  api.post(`${BASE}/messages`, data).then(r => r.data);
export const updateMessage = (id: string, data: any) =>
  api.put(`${BASE}/messages/${id}`, data).then(r => r.data);
export const deleteMessage = (id: string) =>
  api.delete(`${BASE}/messages/${id}`).then(r => r.data);

// ─── Actions ──────────────────────────────────────────────
export const listActions = (page = 1, limit = 20, conversationId?: string) =>
  api.get(`${BASE}/actions`, { params: { page, limit, conversationId } }).then(r => r.data);
export const getAction = (id: string) =>
  api.get(`${BASE}/actions/${id}`).then(r => r.data);
export const createAction = (data: any) =>
  api.post(`${BASE}/actions`, data).then(r => r.data);
export const updateAction = (id: string, data: any) =>
  api.put(`${BASE}/actions/${id}`, data).then(r => r.data);
export const deleteAction = (id: string) =>
  api.delete(`${BASE}/actions/${id}`).then(r => r.data);

// ─── Insights ─────────────────────────────────────────────
export const listInsights = (page = 1, limit = 20, type?: string, status?: string) =>
  api.get(`${BASE}/insights`, { params: { page, limit, type, status } }).then(r => r.data);
export const getInsight = (id: string) =>
  api.get(`${BASE}/insights/${id}`).then(r => r.data);
export const createInsight = (data: any) =>
  api.post(`${BASE}/insights`, data).then(r => r.data);
export const updateInsight = (id: string, data: any) =>
  api.put(`${BASE}/insights/${id}`, data).then(r => r.data);
export const deleteInsight = (id: string) =>
  api.delete(`${BASE}/insights/${id}`).then(r => r.data);

// ─── Knowledge Base ───────────────────────────────────────
export const listKnowledgeBase = (page = 1, limit = 20, category?: string) =>
  api.get(`${BASE}/knowledge-base`, { params: { page, limit, category } }).then(r => r.data);
export const getKnowledgeBase = (id: string) =>
  api.get(`${BASE}/knowledge-base/${id}`).then(r => r.data);
export const createKnowledgeBase = (data: any) =>
  api.post(`${BASE}/knowledge-base`, data).then(r => r.data);
export const updateKnowledgeBase = (id: string, data: any) =>
  api.put(`${BASE}/knowledge-base/${id}`, data).then(r => r.data);
export const deleteKnowledgeBase = (id: string) =>
  api.delete(`${BASE}/knowledge-base/${id}`).then(r => r.data);

// ─── Persona Configs ──────────────────────────────────────
export const listPersonaConfigs = (page = 1, limit = 20) =>
  api.get(`${BASE}/persona-configs`, { params: { page, limit } }).then(r => r.data);
export const getPersonaConfig = (id: string) =>
  api.get(`${BASE}/persona-configs/${id}`).then(r => r.data);
export const createPersonaConfig = (data: any) =>
  api.post(`${BASE}/persona-configs`, data).then(r => r.data);
export const updatePersonaConfig = (id: string, data: any) =>
  api.put(`${BASE}/persona-configs/${id}`, data).then(r => r.data);
export const deletePersonaConfig = (id: string) =>
  api.delete(`${BASE}/persona-configs/${id}`).then(r => r.data);

// ─── Feedback ─────────────────────────────────────────────
export const listFeedback = (page = 1, limit = 20) =>
  api.get(`${BASE}/feedback`, { params: { page, limit } }).then(r => r.data);
export const getFeedback = (id: string) =>
  api.get(`${BASE}/feedback/${id}`).then(r => r.data);
export const createFeedback = (data: any) =>
  api.post(`${BASE}/feedback`, data).then(r => r.data);
export const updateFeedback = (id: string, data: any) =>
  api.put(`${BASE}/feedback/${id}`, data).then(r => r.data);
export const deleteFeedback = (id: string) =>
  api.delete(`${BASE}/feedback/${id}`).then(r => r.data);

// ─── Usage Metrics ────────────────────────────────────────
export const listUsageMetrics = (page = 1, limit = 20, personaType?: string) =>
  api.get(`${BASE}/usage-metrics`, { params: { page, limit, personaType } }).then(r => r.data);
export const getUsageMetric = (id: string) =>
  api.get(`${BASE}/usage-metrics/${id}`).then(r => r.data);
export const createUsageMetric = (data: any) =>
  api.post(`${BASE}/usage-metrics`, data).then(r => r.data);
export const updateUsageMetric = (id: string, data: any) =>
  api.put(`${BASE}/usage-metrics/${id}`, data).then(r => r.data);
export const deleteUsageMetric = (id: string) =>
  api.delete(`${BASE}/usage-metrics/${id}`).then(r => r.data);

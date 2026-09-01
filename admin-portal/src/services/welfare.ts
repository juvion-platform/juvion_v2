import api from './api';

const BASE = '/welfare';

// ─── Stats ────────────────────────────────────────────────
export const getWelfareStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Hostel Blocks ────────────────────────────────────────
export const listHostelBlocks = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/hostel-blocks`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getHostelBlock = (id: string) =>
  api.get(`${BASE}/hostel-blocks/${id}`).then(r => r.data);
export const createHostelBlock = (data: any) =>
  api.post(`${BASE}/hostel-blocks`, data).then(r => r.data);
export const updateHostelBlock = (id: string, data: any) =>
  api.put(`${BASE}/hostel-blocks/${id}`, data).then(r => r.data);
export const deleteHostelBlock = (id: string) =>
  api.delete(`${BASE}/hostel-blocks/${id}`).then(r => r.data);

// ─── Hostel Rooms ─────────────────────────────────────────
export const listHostelRooms = (page = 1, limit = 20, blockId?: string, search?: string) =>
  api.get(`${BASE}/hostel-rooms`, { params: { page, limit, blockId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getHostelRoom = (id: string) =>
  api.get(`${BASE}/hostel-rooms/${id}`).then(r => r.data);
export const createHostelRoom = (data: any) =>
  api.post(`${BASE}/hostel-rooms`, data).then(r => r.data);
export const updateHostelRoom = (id: string, data: any) =>
  api.put(`${BASE}/hostel-rooms/${id}`, data).then(r => r.data);
export const deleteHostelRoom = (id: string) =>
  api.delete(`${BASE}/hostel-rooms/${id}`).then(r => r.data);

// ─── Hostel Allocations ───────────────────────────────────
export const listHostelAllocations = (page = 1, limit = 20, studentId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/hostel-allocations`, { params: { page, limit, studentId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getHostelAllocation = (id: string) =>
  api.get(`${BASE}/hostel-allocations/${id}`).then(r => r.data);
export const createHostelAllocation = (data: any) =>
  api.post(`${BASE}/hostel-allocations`, data).then(r => r.data);
export const updateHostelAllocation = (id: string, data: any) =>
  api.put(`${BASE}/hostel-allocations/${id}`, data).then(r => r.data);
export const deleteHostelAllocation = (id: string) =>
  api.delete(`${BASE}/hostel-allocations/${id}`).then(r => r.data);

// ─── Hostel Visitor Logs ──────────────────────────────────
export const listHostelVisitorLogs = (page = 1, limit = 20, studentId?: string, search?: string) =>
  api.get(`${BASE}/hostel-visitor-logs`, { params: { page, limit, studentId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getHostelVisitorLog = (id: string) =>
  api.get(`${BASE}/hostel-visitor-logs/${id}`).then(r => r.data);
export const createHostelVisitorLog = (data: any) =>
  api.post(`${BASE}/hostel-visitor-logs`, data).then(r => r.data);
export const updateHostelVisitorLog = (id: string, data: any) =>
  api.put(`${BASE}/hostel-visitor-logs/${id}`, data).then(r => r.data);
export const deleteHostelVisitorLog = (id: string) =>
  api.delete(`${BASE}/hostel-visitor-logs/${id}`).then(r => r.data);

// ─── Mess Menus ───────────────────────────────────────────
export const listMessMenus = (page = 1, limit = 20, day?: string, search?: string) =>
  api.get(`${BASE}/mess-menus`, { params: { page, limit, day, ...(search ? { search } : {}) } }).then(r => r.data);
export const getMessMenu = (id: string) =>
  api.get(`${BASE}/mess-menus/${id}`).then(r => r.data);
export const createMessMenu = (data: any) =>
  api.post(`${BASE}/mess-menus`, data).then(r => r.data);
export const updateMessMenu = (id: string, data: any) =>
  api.put(`${BASE}/mess-menus/${id}`, data).then(r => r.data);
export const deleteMessMenu = (id: string) =>
  api.delete(`${BASE}/mess-menus/${id}`).then(r => r.data);

// ─── Mess Feedbacks ───────────────────────────────────────
export const listMessFeedbacks = (page = 1, limit = 20, mealType?: string, search?: string) =>
  api.get(`${BASE}/mess-feedbacks`, { params: { page, limit, mealType, ...(search ? { search } : {}) } }).then(r => r.data);
export const getMessFeedback = (id: string) =>
  api.get(`${BASE}/mess-feedbacks/${id}`).then(r => r.data);
export const createMessFeedback = (data: any) =>
  api.post(`${BASE}/mess-feedbacks`, data).then(r => r.data);
export const updateMessFeedback = (id: string, data: any) =>
  api.put(`${BASE}/mess-feedbacks/${id}`, data).then(r => r.data);
export const deleteMessFeedback = (id: string) =>
  api.delete(`${BASE}/mess-feedbacks/${id}`).then(r => r.data);

// ─── Transport Routes ─────────────────────────────────────
export const listTransportRoutes = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/transport-routes`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getTransportRoute = (id: string) =>
  api.get(`${BASE}/transport-routes/${id}`).then(r => r.data);
export const createTransportRoute = (data: any) =>
  api.post(`${BASE}/transport-routes`, data).then(r => r.data);
export const updateTransportRoute = (id: string, data: any) =>
  api.put(`${BASE}/transport-routes/${id}`, data).then(r => r.data);
export const deleteTransportRoute = (id: string) =>
  api.delete(`${BASE}/transport-routes/${id}`).then(r => r.data);

// ─── Transport Allocations ────────────────────────────────
export const listTransportAllocations = (page = 1, limit = 20, routeId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/transport-allocations`, { params: { page, limit, routeId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getTransportAllocation = (id: string) =>
  api.get(`${BASE}/transport-allocations/${id}`).then(r => r.data);
export const createTransportAllocation = (data: any) =>
  api.post(`${BASE}/transport-allocations`, data).then(r => r.data);
export const updateTransportAllocation = (id: string, data: any) =>
  api.put(`${BASE}/transport-allocations/${id}`, data).then(r => r.data);
export const deleteTransportAllocation = (id: string) =>
  api.delete(`${BASE}/transport-allocations/${id}`).then(r => r.data);

// ─── Health Records ───────────────────────────────────────
export const listHealthRecords = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/health-records`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getHealthRecord = (id: string) =>
  api.get(`${BASE}/health-records/${id}`).then(r => r.data);
export const createHealthRecord = (data: any) =>
  api.post(`${BASE}/health-records`, data).then(r => r.data);
export const updateHealthRecord = (id: string, data: any) =>
  api.put(`${BASE}/health-records/${id}`, data).then(r => r.data);
export const deleteHealthRecord = (id: string) =>
  api.delete(`${BASE}/health-records/${id}`).then(r => r.data);

// ─── Medical Visits ───────────────────────────────────────
export const listMedicalVisits = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/medical-visits`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getMedicalVisit = (id: string) =>
  api.get(`${BASE}/medical-visits/${id}`).then(r => r.data);
export const createMedicalVisit = (data: any) =>
  api.post(`${BASE}/medical-visits`, data).then(r => r.data);
export const updateMedicalVisit = (id: string, data: any) =>
  api.put(`${BASE}/medical-visits/${id}`, data).then(r => r.data);
export const deleteMedicalVisit = (id: string) =>
  api.delete(`${BASE}/medical-visits/${id}`).then(r => r.data);

// ─── Counseling Sessions ──────────────────────────────────
export const listCounselingSessions = (page = 1, limit = 20, type?: string, search?: string) =>
  api.get(`${BASE}/counseling-sessions`, { params: { page, limit, type, ...(search ? { search } : {}) } }).then(r => r.data);
export const getCounselingSession = (id: string) =>
  api.get(`${BASE}/counseling-sessions/${id}`).then(r => r.data);
export const createCounselingSession = (data: any) =>
  api.post(`${BASE}/counseling-sessions`, data).then(r => r.data);
export const updateCounselingSession = (id: string, data: any) =>
  api.put(`${BASE}/counseling-sessions/${id}`, data).then(r => r.data);
export const deleteCounselingSession = (id: string) =>
  api.delete(`${BASE}/counseling-sessions/${id}`).then(r => r.data);

// ─── Crisis Alerts ────────────────────────────────────────
export const listCrisisAlerts = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/crisis-alerts`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getCrisisAlert = (id: string) =>
  api.get(`${BASE}/crisis-alerts/${id}`).then(r => r.data);
export const createCrisisAlert = (data: any) =>
  api.post(`${BASE}/crisis-alerts`, data).then(r => r.data);
export const updateCrisisAlert = (id: string, data: any) =>
  api.put(`${BASE}/crisis-alerts/${id}`, data).then(r => r.data);
export const deleteCrisisAlert = (id: string) =>
  api.delete(`${BASE}/crisis-alerts/${id}`).then(r => r.data);

// ─── Anti-Ragging Complaints ──────────────────────────────
export const listAntiRaggingComplaints = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/anti-ragging-complaints`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAntiRaggingComplaint = (id: string) =>
  api.get(`${BASE}/anti-ragging-complaints/${id}`).then(r => r.data);
export const createAntiRaggingComplaint = (data: any) =>
  api.post(`${BASE}/anti-ragging-complaints`, data).then(r => r.data);
export const updateAntiRaggingComplaint = (id: string, data: any) =>
  api.put(`${BASE}/anti-ragging-complaints/${id}`, data).then(r => r.data);
export const deleteAntiRaggingComplaint = (id: string) =>
  api.delete(`${BASE}/anti-ragging-complaints/${id}`).then(r => r.data);

// ─── Student Grievances ───────────────────────────────────
export const listStudentGrievances = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/student-grievances`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getStudentGrievance = (id: string) =>
  api.get(`${BASE}/student-grievances/${id}`).then(r => r.data);
export const createStudentGrievance = (data: any) =>
  api.post(`${BASE}/student-grievances`, data).then(r => r.data);
export const updateStudentGrievance = (id: string, data: any) =>
  api.put(`${BASE}/student-grievances/${id}`, data).then(r => r.data);
export const deleteStudentGrievance = (id: string) =>
  api.delete(`${BASE}/student-grievances/${id}`).then(r => r.data);

// ─── Insurance Claims ─────────────────────────────────────
export const listInsuranceClaims = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/insurance-claims`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getInsuranceClaim = (id: string) =>
  api.get(`${BASE}/insurance-claims/${id}`).then(r => r.data);
export const createInsuranceClaim = (data: any) =>
  api.post(`${BASE}/insurance-claims`, data).then(r => r.data);
export const updateInsuranceClaim = (id: string, data: any) =>
  api.put(`${BASE}/insurance-claims/${id}`, data).then(r => r.data);
export const deleteInsuranceClaim = (id: string) =>
  api.delete(`${BASE}/insurance-claims/${id}`).then(r => r.data);

// ─── Parent Meetings ──────────────────────────────────────
export const listParentMeetings = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/parent-meetings`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getParentMeeting = (id: string) =>
  api.get(`${BASE}/parent-meetings/${id}`).then(r => r.data);
export const createParentMeeting = (data: any) =>
  api.post(`${BASE}/parent-meetings`, data).then(r => r.data);
export const updateParentMeeting = (id: string, data: any) =>
  api.put(`${BASE}/parent-meetings/${id}`, data).then(r => r.data);
export const deleteParentMeeting = (id: string) =>
  api.delete(`${BASE}/parent-meetings/${id}`).then(r => r.data);

// ─── 008 Phase 2: CCD Student Risk ────────────────────────
// The compound-risk engine has been scoring students since Phase 1; these are
// the reads the Student Risk board needs. Scores and priorities are computed
// server-side — nothing here derives a number.

export interface RiskBoardRow {
  alertId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  priority: 'P1' | 'P2' | 'P3' | null;
  score: number;
  status: string;
  daysOpen: number;
  sources: string[];
  signalCount: number;
  crossModuleMultiplier: number;
  temporalMultiplier: number;
  mentorName: string | null;
  lastActionAt: string | null;
}

export const getRiskBoard = (priority?: string): Promise<RiskBoardRow[]> =>
  api.get(`${BASE}/ccd/board`, { params: { ...(priority ? { priority } : {}) } }).then(r => r.data);

export const getSignalsBySource = (days = 7) =>
  api.get(`${BASE}/ccd/signals-by-source`, { params: { days } }).then(r => r.data);

export const getMentorWorkload = () =>
  api.get(`${BASE}/ccd/mentor-workload`).then(r => r.data);

export interface OutreachEffectiveness {
  windowDays: number;
  raised: number;
  contacted: number;
  resolved: number;
  recurred: number;
}

export const getOutreachEffectiveness = (days = 90): Promise<OutreachEffectiveness> =>
  api.get(`${BASE}/ccd/outreach-effectiveness`, { params: { days } }).then(r => r.data);

export const getStudentRiskProfile = (studentId: string) =>
  api.get(`${BASE}/ccd/students/${studentId}/risk-profile`).then(r => r.data);

export const getStudentScoreHistory = (studentId: string, days = 90) =>
  api.get(`${BASE}/ccd/students/${studentId}/score-history`, { params: { days } }).then(r => r.data);

export const recomputeStudentScore = (studentId: string) =>
  api.post(`${BASE}/ccd/students/${studentId}/recompute`).then(r => r.data);

export const acknowledgeCCDAlert = (alertId: string, initialAssessment: string) =>
  api.post(`${BASE}/ccd/alerts/${alertId}/acknowledge`, { initialAssessment }).then(r => r.data);

export const investigateCCDAlert = (alertId: string, findings?: string) =>
  api.post(`${BASE}/ccd/alerts/${alertId}/investigate`, { findings }).then(r => r.data);

export const interveneCCDAlert = (alertId: string, data: { type: string; description: string }) =>
  api.post(`${BASE}/ccd/alerts/${alertId}/intervene`, data).then(r => r.data);

export const resolveCCDAlert = (alertId: string) =>
  api.post(`${BASE}/ccd/alerts/${alertId}/resolve`).then(r => r.data);

export const markCCDFalsePositive = (alertId: string, falsePositiveReason: string) =>
  api.post(`${BASE}/ccd/alerts/${alertId}/false-positive`, { falsePositiveReason }).then(r => r.data);

import api from './api';

const BASE = '/welfare';

// ─── Stats ────────────────────────────────────────────────
export const getWelfareStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Hostel Blocks ────────────────────────────────────────
export const listHostelBlocks = (page = 1, limit = 20) =>
  api.get(`${BASE}/hostel-blocks`, { params: { page, limit } }).then(r => r.data);
export const getHostelBlock = (id: string) =>
  api.get(`${BASE}/hostel-blocks/${id}`).then(r => r.data);
export const createHostelBlock = (data: any) =>
  api.post(`${BASE}/hostel-blocks`, data).then(r => r.data);
export const updateHostelBlock = (id: string, data: any) =>
  api.put(`${BASE}/hostel-blocks/${id}`, data).then(r => r.data);
export const deleteHostelBlock = (id: string) =>
  api.delete(`${BASE}/hostel-blocks/${id}`).then(r => r.data);

// ─── Hostel Rooms ─────────────────────────────────────────
export const listHostelRooms = (page = 1, limit = 20, blockId?: string) =>
  api.get(`${BASE}/hostel-rooms`, { params: { page, limit, blockId } }).then(r => r.data);
export const getHostelRoom = (id: string) =>
  api.get(`${BASE}/hostel-rooms/${id}`).then(r => r.data);
export const createHostelRoom = (data: any) =>
  api.post(`${BASE}/hostel-rooms`, data).then(r => r.data);
export const updateHostelRoom = (id: string, data: any) =>
  api.put(`${BASE}/hostel-rooms/${id}`, data).then(r => r.data);
export const deleteHostelRoom = (id: string) =>
  api.delete(`${BASE}/hostel-rooms/${id}`).then(r => r.data);

// ─── Hostel Allocations ───────────────────────────────────
export const listHostelAllocations = (page = 1, limit = 20, studentId?: string, status?: string) =>
  api.get(`${BASE}/hostel-allocations`, { params: { page, limit, studentId, status } }).then(r => r.data);
export const getHostelAllocation = (id: string) =>
  api.get(`${BASE}/hostel-allocations/${id}`).then(r => r.data);
export const createHostelAllocation = (data: any) =>
  api.post(`${BASE}/hostel-allocations`, data).then(r => r.data);
export const updateHostelAllocation = (id: string, data: any) =>
  api.put(`${BASE}/hostel-allocations/${id}`, data).then(r => r.data);
export const deleteHostelAllocation = (id: string) =>
  api.delete(`${BASE}/hostel-allocations/${id}`).then(r => r.data);

// ─── Hostel Visitor Logs ──────────────────────────────────
export const listHostelVisitorLogs = (page = 1, limit = 20, studentId?: string) =>
  api.get(`${BASE}/hostel-visitor-logs`, { params: { page, limit, studentId } }).then(r => r.data);
export const getHostelVisitorLog = (id: string) =>
  api.get(`${BASE}/hostel-visitor-logs/${id}`).then(r => r.data);
export const createHostelVisitorLog = (data: any) =>
  api.post(`${BASE}/hostel-visitor-logs`, data).then(r => r.data);
export const updateHostelVisitorLog = (id: string, data: any) =>
  api.put(`${BASE}/hostel-visitor-logs/${id}`, data).then(r => r.data);
export const deleteHostelVisitorLog = (id: string) =>
  api.delete(`${BASE}/hostel-visitor-logs/${id}`).then(r => r.data);

// ─── Mess Menus ───────────────────────────────────────────
export const listMessMenus = (page = 1, limit = 20, day?: string) =>
  api.get(`${BASE}/mess-menus`, { params: { page, limit, day } }).then(r => r.data);
export const getMessMenu = (id: string) =>
  api.get(`${BASE}/mess-menus/${id}`).then(r => r.data);
export const createMessMenu = (data: any) =>
  api.post(`${BASE}/mess-menus`, data).then(r => r.data);
export const updateMessMenu = (id: string, data: any) =>
  api.put(`${BASE}/mess-menus/${id}`, data).then(r => r.data);
export const deleteMessMenu = (id: string) =>
  api.delete(`${BASE}/mess-menus/${id}`).then(r => r.data);

// ─── Mess Feedbacks ───────────────────────────────────────
export const listMessFeedbacks = (page = 1, limit = 20, mealType?: string) =>
  api.get(`${BASE}/mess-feedbacks`, { params: { page, limit, mealType } }).then(r => r.data);
export const getMessFeedback = (id: string) =>
  api.get(`${BASE}/mess-feedbacks/${id}`).then(r => r.data);
export const createMessFeedback = (data: any) =>
  api.post(`${BASE}/mess-feedbacks`, data).then(r => r.data);
export const updateMessFeedback = (id: string, data: any) =>
  api.put(`${BASE}/mess-feedbacks/${id}`, data).then(r => r.data);
export const deleteMessFeedback = (id: string) =>
  api.delete(`${BASE}/mess-feedbacks/${id}`).then(r => r.data);

// ─── Transport Routes ─────────────────────────────────────
export const listTransportRoutes = (page = 1, limit = 20) =>
  api.get(`${BASE}/transport-routes`, { params: { page, limit } }).then(r => r.data);
export const getTransportRoute = (id: string) =>
  api.get(`${BASE}/transport-routes/${id}`).then(r => r.data);
export const createTransportRoute = (data: any) =>
  api.post(`${BASE}/transport-routes`, data).then(r => r.data);
export const updateTransportRoute = (id: string, data: any) =>
  api.put(`${BASE}/transport-routes/${id}`, data).then(r => r.data);
export const deleteTransportRoute = (id: string) =>
  api.delete(`${BASE}/transport-routes/${id}`).then(r => r.data);

// ─── Transport Allocations ────────────────────────────────
export const listTransportAllocations = (page = 1, limit = 20, routeId?: string, status?: string) =>
  api.get(`${BASE}/transport-allocations`, { params: { page, limit, routeId, status } }).then(r => r.data);
export const getTransportAllocation = (id: string) =>
  api.get(`${BASE}/transport-allocations/${id}`).then(r => r.data);
export const createTransportAllocation = (data: any) =>
  api.post(`${BASE}/transport-allocations`, data).then(r => r.data);
export const updateTransportAllocation = (id: string, data: any) =>
  api.put(`${BASE}/transport-allocations/${id}`, data).then(r => r.data);
export const deleteTransportAllocation = (id: string) =>
  api.delete(`${BASE}/transport-allocations/${id}`).then(r => r.data);

// ─── Health Records ───────────────────────────────────────
export const listHealthRecords = (page = 1, limit = 20) =>
  api.get(`${BASE}/health-records`, { params: { page, limit } }).then(r => r.data);
export const getHealthRecord = (id: string) =>
  api.get(`${BASE}/health-records/${id}`).then(r => r.data);
export const createHealthRecord = (data: any) =>
  api.post(`${BASE}/health-records`, data).then(r => r.data);
export const updateHealthRecord = (id: string, data: any) =>
  api.put(`${BASE}/health-records/${id}`, data).then(r => r.data);
export const deleteHealthRecord = (id: string) =>
  api.delete(`${BASE}/health-records/${id}`).then(r => r.data);

// ─── Medical Visits ───────────────────────────────────────
export const listMedicalVisits = (page = 1, limit = 20) =>
  api.get(`${BASE}/medical-visits`, { params: { page, limit } }).then(r => r.data);
export const getMedicalVisit = (id: string) =>
  api.get(`${BASE}/medical-visits/${id}`).then(r => r.data);
export const createMedicalVisit = (data: any) =>
  api.post(`${BASE}/medical-visits`, data).then(r => r.data);
export const updateMedicalVisit = (id: string, data: any) =>
  api.put(`${BASE}/medical-visits/${id}`, data).then(r => r.data);
export const deleteMedicalVisit = (id: string) =>
  api.delete(`${BASE}/medical-visits/${id}`).then(r => r.data);

// ─── Counseling Sessions ──────────────────────────────────
export const listCounselingSessions = (page = 1, limit = 20, type?: string) =>
  api.get(`${BASE}/counseling-sessions`, { params: { page, limit, type } }).then(r => r.data);
export const getCounselingSession = (id: string) =>
  api.get(`${BASE}/counseling-sessions/${id}`).then(r => r.data);
export const createCounselingSession = (data: any) =>
  api.post(`${BASE}/counseling-sessions`, data).then(r => r.data);
export const updateCounselingSession = (id: string, data: any) =>
  api.put(`${BASE}/counseling-sessions/${id}`, data).then(r => r.data);
export const deleteCounselingSession = (id: string) =>
  api.delete(`${BASE}/counseling-sessions/${id}`).then(r => r.data);

// ─── Crisis Alerts ────────────────────────────────────────
export const listCrisisAlerts = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/crisis-alerts`, { params: { page, limit, status } }).then(r => r.data);
export const getCrisisAlert = (id: string) =>
  api.get(`${BASE}/crisis-alerts/${id}`).then(r => r.data);
export const createCrisisAlert = (data: any) =>
  api.post(`${BASE}/crisis-alerts`, data).then(r => r.data);
export const updateCrisisAlert = (id: string, data: any) =>
  api.put(`${BASE}/crisis-alerts/${id}`, data).then(r => r.data);
export const deleteCrisisAlert = (id: string) =>
  api.delete(`${BASE}/crisis-alerts/${id}`).then(r => r.data);

// ─── Anti-Ragging Complaints ──────────────────────────────
export const listAntiRaggingComplaints = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/anti-ragging-complaints`, { params: { page, limit, status } }).then(r => r.data);
export const getAntiRaggingComplaint = (id: string) =>
  api.get(`${BASE}/anti-ragging-complaints/${id}`).then(r => r.data);
export const createAntiRaggingComplaint = (data: any) =>
  api.post(`${BASE}/anti-ragging-complaints`, data).then(r => r.data);
export const updateAntiRaggingComplaint = (id: string, data: any) =>
  api.put(`${BASE}/anti-ragging-complaints/${id}`, data).then(r => r.data);
export const deleteAntiRaggingComplaint = (id: string) =>
  api.delete(`${BASE}/anti-ragging-complaints/${id}`).then(r => r.data);

// ─── Student Grievances ───────────────────────────────────
export const listStudentGrievances = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/student-grievances`, { params: { page, limit, status } }).then(r => r.data);
export const getStudentGrievance = (id: string) =>
  api.get(`${BASE}/student-grievances/${id}`).then(r => r.data);
export const createStudentGrievance = (data: any) =>
  api.post(`${BASE}/student-grievances`, data).then(r => r.data);
export const updateStudentGrievance = (id: string, data: any) =>
  api.put(`${BASE}/student-grievances/${id}`, data).then(r => r.data);
export const deleteStudentGrievance = (id: string) =>
  api.delete(`${BASE}/student-grievances/${id}`).then(r => r.data);

// ─── Insurance Claims ─────────────────────────────────────
export const listInsuranceClaims = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/insurance-claims`, { params: { page, limit, status } }).then(r => r.data);
export const getInsuranceClaim = (id: string) =>
  api.get(`${BASE}/insurance-claims/${id}`).then(r => r.data);
export const createInsuranceClaim = (data: any) =>
  api.post(`${BASE}/insurance-claims`, data).then(r => r.data);
export const updateInsuranceClaim = (id: string, data: any) =>
  api.put(`${BASE}/insurance-claims/${id}`, data).then(r => r.data);
export const deleteInsuranceClaim = (id: string) =>
  api.delete(`${BASE}/insurance-claims/${id}`).then(r => r.data);

// ─── Parent Meetings ──────────────────────────────────────
export const listParentMeetings = (page = 1, limit = 20, status?: string) =>
  api.get(`${BASE}/parent-meetings`, { params: { page, limit, status } }).then(r => r.data);
export const getParentMeeting = (id: string) =>
  api.get(`${BASE}/parent-meetings/${id}`).then(r => r.data);
export const createParentMeeting = (data: any) =>
  api.post(`${BASE}/parent-meetings`, data).then(r => r.data);
export const updateParentMeeting = (id: string, data: any) =>
  api.put(`${BASE}/parent-meetings/${id}`, data).then(r => r.data);
export const deleteParentMeeting = (id: string) =>
  api.delete(`${BASE}/parent-meetings/${id}`).then(r => r.data);

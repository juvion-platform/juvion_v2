import api from './api';

const BASE = '/hr';

// ─── Stats ────────────────────────────────────────────────
export const getHRStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ─── Employees ────────────────────────────────────────────
export const listEmployees = (page = 1, limit = 20, departmentId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/employees`, { params: { page, limit, departmentId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getEmployee = (id: string) =>
  api.get(`${BASE}/employees/${id}`).then(r => r.data);
export const createEmployee = (data: any) =>
  api.post(`${BASE}/employees`, data).then(r => r.data);
export const updateEmployee = (id: string, data: any) =>
  api.put(`${BASE}/employees/${id}`, data).then(r => r.data);
export const deleteEmployee = (id: string) =>
  api.delete(`${BASE}/employees/${id}`).then(r => r.data);

// ─── Leave Types ──────────────────────────────────────────
export const listLeaveTypes = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/leave-types`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getLeaveType = (id: string) =>
  api.get(`${BASE}/leave-types/${id}`).then(r => r.data);
export const createLeaveType = (data: any) =>
  api.post(`${BASE}/leave-types`, data).then(r => r.data);
export const updateLeaveType = (id: string, data: any) =>
  api.put(`${BASE}/leave-types/${id}`, data).then(r => r.data);
export const deleteLeaveType = (id: string) =>
  api.delete(`${BASE}/leave-types/${id}`).then(r => r.data);

// ─── Designations ────────────────────────────────────────
export const listDesignations = (page = 1, limit = 20, search?: string) =>
  api.get(`${BASE}/designations`, { params: { page, limit, ...(search ? { search } : {}) } }).then(r => r.data);
export const getDesignation = (id: string) =>
  api.get(`${BASE}/designations/${id}`).then(r => r.data);
export const createDesignation = (data: any) =>
  api.post(`${BASE}/designations`, data).then(r => r.data);
export const updateDesignation = (id: string, data: any) =>
  api.put(`${BASE}/designations/${id}`, data).then(r => r.data);
export const deleteDesignation = (id: string) =>
  api.delete(`${BASE}/designations/${id}`).then(r => r.data);

// ─── Leave Applications ──────────────────────────────────
export const listLeaveApplications = (page = 1, limit = 20, employeeId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/leave-applications`, { params: { page, limit, employeeId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getLeaveApplication = (id: string) =>
  api.get(`${BASE}/leave-applications/${id}`).then(r => r.data);
export const createLeaveApplication = (data: any) =>
  api.post(`${BASE}/leave-applications`, data).then(r => r.data);
export const updateLeaveApplication = (id: string, data: any) =>
  api.put(`${BASE}/leave-applications/${id}`, data).then(r => r.data);
export const deleteLeaveApplication = (id: string) =>
  api.delete(`${BASE}/leave-applications/${id}`).then(r => r.data);

// Leave lifecycle. These transitions run balance deduction and approval
// bookkeeping server-side — editing the raw `status` field via PUT skips all
// of that, which is why the UI drives them through these endpoints instead.
export const approveLeaveApplication = (id: string, data: { approverId?: string; remarks?: string } = {}) =>
  api.post(`${BASE}/leave-applications/${id}/approve`, data).then(r => r.data);
export const rejectLeaveApplication = (id: string, data: { approverId?: string; remarks?: string } = {}) =>
  api.post(`${BASE}/leave-applications/${id}/reject`, data).then(r => r.data);
export const withdrawLeaveApplication = (id: string) =>
  api.post(`${BASE}/leave-applications/${id}/withdraw`, {}).then(r => r.data);

// ─── Leave Balances ───────────────────────────────────────
export const listLeaveBalances = (page = 1, limit = 20, employeeId?: string, academicYearId?: string, search?: string) =>
  api.get(`${BASE}/leave-balances`, { params: { page, limit, employeeId, academicYearId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createLeaveBalance = (data: any) =>
  api.post(`${BASE}/leave-balances`, data).then(r => r.data);
export const updateLeaveBalance = (id: string, data: any) =>
  api.put(`${BASE}/leave-balances/${id}`, data).then(r => r.data);
export const deleteLeaveBalance = (id: string) =>
  api.delete(`${BASE}/leave-balances/${id}`).then(r => r.data);

// ─── Employee Attendance ──────────────────────────────────
export const listEmployeeAttendance = (page = 1, limit = 20, employeeId?: string, search?: string) =>
  api.get(`${BASE}/employee-attendance`, { params: { page, limit, employeeId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createEmployeeAttendance = (data: any) =>
  api.post(`${BASE}/employee-attendance`, data).then(r => r.data);
export const updateEmployeeAttendance = (id: string, data: any) =>
  api.put(`${BASE}/employee-attendance/${id}`, data).then(r => r.data);
export const deleteEmployeeAttendance = (id: string) =>
  api.delete(`${BASE}/employee-attendance/${id}`).then(r => r.data);

// ─── Pay Structures ──────────────────────────────────────
export const listPayStructures = (page = 1, limit = 20, employeeId?: string, search?: string) =>
  api.get(`${BASE}/pay-structures`, { params: { page, limit, employeeId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getPayStructure = (id: string) =>
  api.get(`${BASE}/pay-structures/${id}`).then(r => r.data);
export const createPayStructure = (data: any) =>
  api.post(`${BASE}/pay-structures`, data).then(r => r.data);
export const updatePayStructure = (id: string, data: any) =>
  api.put(`${BASE}/pay-structures/${id}`, data).then(r => r.data);
export const deletePayStructure = (id: string) =>
  api.delete(`${BASE}/pay-structures/${id}`).then(r => r.data);

// ─── Payrolls ─────────────────────────────────────────────
export const listPayrolls = (page = 1, limit = 20, employeeId?: string, month?: string, year?: string, search?: string) =>
  api.get(`${BASE}/payroll`, { params: { page, limit, employeeId, month, year, ...(search ? { search } : {}) } }).then(r => r.data);
export const getPayroll = (id: string) =>
  api.get(`${BASE}/payroll/${id}`).then(r => r.data);
export const createPayroll = (data: any) =>
  api.post(`${BASE}/payroll`, data).then(r => r.data);
export const updatePayroll = (id: string, data: any) =>
  api.put(`${BASE}/payroll/${id}`, data).then(r => r.data);
export const deletePayroll = (id: string) =>
  api.delete(`${BASE}/payroll/${id}`).then(r => r.data);

// ─── Appraisals ──────────────────────────────────────────
export const listAppraisals = (page = 1, limit = 20, employeeId?: string, academicYearId?: string, search?: string) =>
  api.get(`${BASE}/appraisals`, { params: { page, limit, employeeId, academicYearId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getAppraisal = (id: string) =>
  api.get(`${BASE}/appraisals/${id}`).then(r => r.data);
export const createAppraisal = (data: any) =>
  api.post(`${BASE}/appraisals`, data).then(r => r.data);
export const updateAppraisal = (id: string, data: any) =>
  api.put(`${BASE}/appraisals/${id}`, data).then(r => r.data);
export const deleteAppraisal = (id: string) =>
  api.delete(`${BASE}/appraisals/${id}`).then(r => r.data);

// ─── Promotions ───────────────────────────────────────────
export const listPromotions = (page = 1, limit = 20, employeeId?: string, search?: string) =>
  api.get(`${BASE}/promotions`, { params: { page, limit, employeeId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createPromotion = (data: any) =>
  api.post(`${BASE}/promotions`, data).then(r => r.data);
export const updatePromotion = (id: string, data: any) =>
  api.put(`${BASE}/promotions/${id}`, data).then(r => r.data);
export const deletePromotion = (id: string) =>
  api.delete(`${BASE}/promotions/${id}`).then(r => r.data);

// ─── Trainings ────────────────────────────────────────────
export const listTrainings = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/trainings`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getTraining = (id: string) =>
  api.get(`${BASE}/trainings/${id}`).then(r => r.data);
export const createTraining = (data: any) =>
  api.post(`${BASE}/trainings`, data).then(r => r.data);
export const updateTraining = (id: string, data: any) =>
  api.put(`${BASE}/trainings/${id}`, data).then(r => r.data);
export const deleteTraining = (id: string) =>
  api.delete(`${BASE}/trainings/${id}`).then(r => r.data);

// ─── Training Participants ────────────────────────────────
export const listTrainingParticipants = (page = 1, limit = 20, trainingId?: string, search?: string) =>
  api.get(`${BASE}/training-participants`, { params: { page, limit, trainingId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createTrainingParticipant = (data: any) =>
  api.post(`${BASE}/training-participants`, data).then(r => r.data);
export const updateTrainingParticipant = (id: string, data: any) =>
  api.put(`${BASE}/training-participants/${id}`, data).then(r => r.data);
export const deleteTrainingParticipant = (id: string) =>
  api.delete(`${BASE}/training-participants/${id}`).then(r => r.data);

// ─── Qualifications ──────────────────────────────────────
export const listQualifications = (page = 1, limit = 20, personId?: string, search?: string) =>
  api.get(`${BASE}/qualifications`, { params: { page, limit, personId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createQualification = (data: any) =>
  api.post(`${BASE}/qualifications`, data).then(r => r.data);
export const updateQualification = (id: string, data: any) =>
  api.put(`${BASE}/qualifications/${id}`, data).then(r => r.data);
export const deleteQualification = (id: string) =>
  api.delete(`${BASE}/qualifications/${id}`).then(r => r.data);

// ─── Grievances ───────────────────────────────────────────
export const listGrievances = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/grievances`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getGrievance = (id: string) =>
  api.get(`${BASE}/grievances/${id}`).then(r => r.data);
export const createGrievance = (data: any) =>
  api.post(`${BASE}/grievances`, data).then(r => r.data);
export const updateGrievance = (id: string, data: any) =>
  api.put(`${BASE}/grievances/${id}`, data).then(r => r.data);
export const deleteGrievance = (id: string) =>
  api.delete(`${BASE}/grievances/${id}`).then(r => r.data);

// ─── On Duty ──────────────────────────────────────────────
export const listOnDuty = (page = 1, limit = 20, employeeId?: string, search?: string) =>
  api.get(`${BASE}/on-duty`, { params: { page, limit, employeeId, ...(search ? { search } : {}) } }).then(r => r.data);
export const createOnDuty = (data: any) =>
  api.post(`${BASE}/on-duty`, data).then(r => r.data);
export const updateOnDuty = (id: string, data: any) =>
  api.put(`${BASE}/on-duty/${id}`, data).then(r => r.data);
export const deleteOnDuty = (id: string) =>
  api.delete(`${BASE}/on-duty/${id}`).then(r => r.data);

// ─── Exit Processes ───────────────────────────────────────
export const listExitProcesses = (page = 1, limit = 20, employeeId?: string, search?: string) =>
  api.get(`${BASE}/exit-processes`, { params: { page, limit, employeeId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getExitProcess = (id: string) =>
  api.get(`${BASE}/exit-processes/${id}`).then(r => r.data);
export const createExitProcess = (data: any) =>
  api.post(`${BASE}/exit-processes`, data).then(r => r.data);
export const updateExitProcess = (id: string, data: any) =>
  api.put(`${BASE}/exit-processes/${id}`, data).then(r => r.data);
export const deleteExitProcess = (id: string) =>
  api.delete(`${BASE}/exit-processes/${id}`).then(r => r.data);

// ─── Recruitments ─────────────────────────────────────────
export const listRecruitments = (page = 1, limit = 20, status?: string, search?: string) =>
  api.get(`${BASE}/recruitments`, { params: { page, limit, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getRecruitment = (id: string) =>
  api.get(`${BASE}/recruitments/${id}`).then(r => r.data);
export const createRecruitment = (data: any) =>
  api.post(`${BASE}/recruitments`, data).then(r => r.data);
export const updateRecruitment = (id: string, data: any) =>
  api.put(`${BASE}/recruitments/${id}`, data).then(r => r.data);
export const deleteRecruitment = (id: string) =>
  api.delete(`${BASE}/recruitments/${id}`).then(r => r.data);

// ─── Job Applications ────────────────────────────────────
export const listJobApplications = (page = 1, limit = 20, recruitmentId?: string, status?: string, search?: string) =>
  api.get(`${BASE}/job-applications`, { params: { page, limit, recruitmentId, status, ...(search ? { search } : {}) } }).then(r => r.data);
export const getJobApplication = (id: string) =>
  api.get(`${BASE}/job-applications/${id}`).then(r => r.data);
export const createJobApplication = (data: any) =>
  api.post(`${BASE}/job-applications`, data).then(r => r.data);
export const updateJobApplication = (id: string, data: any) =>
  api.put(`${BASE}/job-applications/${id}`, data).then(r => r.data);
export const deleteJobApplication = (id: string) =>
  api.delete(`${BASE}/job-applications/${id}`).then(r => r.data);

// ─── Publications ─────────────────────────────────────────
export const listPublications = (page = 1, limit = 20, facultyId?: string, search?: string) =>
  api.get(`${BASE}/publications`, { params: { page, limit, facultyId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getPublication = (id: string) =>
  api.get(`${BASE}/publications/${id}`).then(r => r.data);
export const createPublication = (data: any) =>
  api.post(`${BASE}/publications`, data).then(r => r.data);
export const updatePublication = (id: string, data: any) =>
  api.put(`${BASE}/publications/${id}`, data).then(r => r.data);
export const deletePublication = (id: string) =>
  api.delete(`${BASE}/publications/${id}`).then(r => r.data);

// ─── Research Projects ───────────────────────────────────
export const listResearchProjects = (page = 1, limit = 20, principalInvestigatorId?: string, search?: string) =>
  api.get(`${BASE}/research-projects`, { params: { page, limit, principalInvestigatorId, ...(search ? { search } : {}) } }).then(r => r.data);
export const getResearchProject = (id: string) =>
  api.get(`${BASE}/research-projects/${id}`).then(r => r.data);
export const createResearchProject = (data: any) =>
  api.post(`${BASE}/research-projects`, data).then(r => r.data);
export const updateResearchProject = (id: string, data: any) =>
  api.put(`${BASE}/research-projects/${id}`, data).then(r => r.data);
export const deleteResearchProject = (id: string) =>
  api.delete(`${BASE}/research-projects/${id}`).then(r => r.data);

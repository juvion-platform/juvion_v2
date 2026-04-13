import { Employee } from '../../models/hr/Employee';
import { LeaveType } from '../../models/hr/LeaveType';
import { LeaveApplication } from '../../models/hr/LeaveApplication';
import { LeaveBalance } from '../../models/hr/LeaveBalance';
import { EmployeeAttendance } from '../../models/hr/EmployeeAttendance';
import { PayStructure } from '../../models/hr/PayStructure';
import { Payroll } from '../../models/hr/Payroll';
import { Appraisal } from '../../models/hr/Appraisal';
import { Promotion } from '../../models/hr/Promotion';
import { Training } from '../../models/hr/Training';
import { TrainingParticipant } from '../../models/hr/TrainingParticipant';
import { Qualification } from '../../models/hr/Qualification';
import { Grievance } from '../../models/hr/Grievance';
import { OnDuty } from '../../models/hr/OnDuty';
import { ExitProcess } from '../../models/hr/ExitProcess';
import { Recruitment } from '../../models/hr/Recruitment';
import { JobApplication } from '../../models/hr/JobApplication';
import { Publication } from '../../models/hr/Publication';
import { ResearchProject } from '../../models/hr/ResearchProject';
import { AttendanceAnomaly } from '../../models/hr/AttendanceAnomaly';
import { AttendanceMonthlySummary } from '../../models/hr/AttendanceMonthlySummary';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';

const EMPLOYEE_POPULATE = { path: 'employeeId', populate: { path: 'personId' } };
const REVIEWER_POPULATE = { path: 'reviewerId', populate: { path: 'personId' } };
const FACULTY_POPULATE = { path: 'facultyId', populate: { path: 'personId' } };
const PI_POPULATE = { path: 'principalInvestigatorId', populate: { path: 'personId' } };

// ─── Dashboard Stats ──────────────────────────────────────
export async function getStats(collegeId: string) {
  const [
    employees, leaveTypes, leaveApplications, payrolls,
    appraisals, trainings, recruitments, publications, researchProjects,
    activeEmployees, pendingLeaves,
  ] = await Promise.all([
    Employee.countDocuments({ collegeId }),
    LeaveType.countDocuments({ collegeId }),
    LeaveApplication.countDocuments({ collegeId }),
    Payroll.countDocuments({ collegeId }),
    Appraisal.countDocuments({ collegeId }),
    Training.countDocuments({ collegeId }),
    Recruitment.countDocuments({ collegeId }),
    Publication.countDocuments({ collegeId }),
    ResearchProject.countDocuments({ collegeId }),
    Employee.countDocuments({ collegeId, status: 'active' }),
    LeaveApplication.countDocuments({ collegeId, status: 'applied' }),
  ]);
  return {
    employees, leaveTypes, leaveApplications, payrolls,
    appraisals, trainings, recruitments, publications, researchProjects,
    activeEmployees, pendingLeaves,
  };
}

// ═══ Employee ════════════════════════════════════════════

export async function listEmployees(collegeId: string, page = 1, limit = 20, departmentId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (departmentId) filter.departmentId = departmentId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Employee, filter, page, limit, { createdAt: -1 }, ['personId', 'departmentId']);
}

export async function getEmployee(collegeId: string, id: string) {
  const doc = await Employee.findOne({ _id: id, collegeId }).populate('personId departmentId reportingToId');
  if (!doc) throw new AppError(404, 'Employee not found');
  return doc;
}

export async function createEmployee(collegeId: string, data: any, who: string) {
  const doc = await Employee.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Employee', entityId: String(doc._id), entityName: data.employeeId, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateEmployee(collegeId: string, id: string, data: any, who: string) {
  const doc = await Employee.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Employee not found');
  await createAuditLog({ collegeId, entityType: 'Employee', entityId: id, entityName: doc.employeeId, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteEmployee(collegeId: string, id: string, who: string) {
  const doc = await Employee.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Employee not found');
  await createAuditLog({ collegeId, entityType: 'Employee', entityId: id, entityName: doc.employeeId, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Leave Type ══════════════════════════════════════════

export async function listLeaveTypes(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(LeaveType, filter, page, limit, { name: 1 });
}

export async function getLeaveType(collegeId: string, id: string) {
  const doc = await LeaveType.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Leave type not found');
  return doc;
}

export async function createLeaveType(collegeId: string, data: any, who: string) {
  const doc = await LeaveType.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'LeaveType', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateLeaveType(collegeId: string, id: string, data: any, who: string) {
  const doc = await LeaveType.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Leave type not found');
  await createAuditLog({ collegeId, entityType: 'LeaveType', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteLeaveType(collegeId: string, id: string, who: string) {
  const doc = await LeaveType.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Leave type not found');
  await createAuditLog({ collegeId, entityType: 'LeaveType', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Leave Application ═══════════════════════════════════

export async function listLeaveApplications(collegeId: string, page = 1, limit = 20, employeeId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(LeaveApplication, filter, page, limit, { createdAt: -1 }, [EMPLOYEE_POPULATE, 'leaveTypeId'] as any);
}

export async function getLeaveApplication(collegeId: string, id: string) {
  const doc = await LeaveApplication.findOne({ _id: id, collegeId }).populate([EMPLOYEE_POPULATE, 'leaveTypeId'] as any);
  if (!doc) throw new AppError(404, 'Leave application not found');
  return doc;
}

export async function createLeaveApplication(collegeId: string, data: any, who: string) {
  const doc = await LeaveApplication.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'LeaveApplication', entityId: String(doc._id), entityName: `Leave ${data.fromDate}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateLeaveApplication(collegeId: string, id: string, data: any, who: string) {
  const doc = await LeaveApplication.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Leave application not found');
  await createAuditLog({ collegeId, entityType: 'LeaveApplication', entityId: id, entityName: `Leave`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteLeaveApplication(collegeId: string, id: string, who: string) {
  const doc = await LeaveApplication.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Leave application not found');
  await createAuditLog({ collegeId, entityType: 'LeaveApplication', entityId: id, entityName: `Leave`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Leave Balance ═══════════════════════════════════════

export async function listLeaveBalances(collegeId: string, page = 1, limit = 20, employeeId?: string, academicYearId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (academicYearId) filter.academicYearId = academicYearId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(LeaveBalance, filter, page, limit, { createdAt: -1 }, [EMPLOYEE_POPULATE, 'leaveTypeId', 'academicYearId'] as any);
}

export async function createLeaveBalance(collegeId: string, data: any, who: string) {
  const doc = await LeaveBalance.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'LeaveBalance', entityId: String(doc._id), entityName: `Balance`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateLeaveBalance(collegeId: string, id: string, data: any, who: string) {
  const doc = await LeaveBalance.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Leave balance not found');
  await createAuditLog({ collegeId, entityType: 'LeaveBalance', entityId: id, entityName: `Balance`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteLeaveBalance(collegeId: string, id: string, who: string) {
  const doc = await LeaveBalance.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Leave balance not found');
  await createAuditLog({ collegeId, entityType: 'LeaveBalance', entityId: id, entityName: `Balance`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Employee Attendance ═════════════════════════════════

export async function listEmployeeAttendance(collegeId: string, page = 1, limit = 20, employeeId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(EmployeeAttendance, filter, page, limit, { date: -1 }, [EMPLOYEE_POPULATE] as any);
}

export async function createEmployeeAttendance(collegeId: string, data: any, who: string) {
  const doc = await EmployeeAttendance.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EmployeeAttendance', entityId: String(doc._id), entityName: `Attendance`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateEmployeeAttendance(collegeId: string, id: string, data: any, who: string) {
  const doc = await EmployeeAttendance.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Attendance record not found');
  await createAuditLog({ collegeId, entityType: 'EmployeeAttendance', entityId: id, entityName: `Attendance`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteEmployeeAttendance(collegeId: string, id: string, who: string) {
  const doc = await EmployeeAttendance.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Attendance record not found');
  await createAuditLog({ collegeId, entityType: 'EmployeeAttendance', entityId: id, entityName: `Attendance`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Pay Structure ═══════════════════════════════════════

export async function listPayStructures(collegeId: string, page = 1, limit = 20, employeeId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(PayStructure, filter, page, limit, { effectiveFrom: -1 }, [EMPLOYEE_POPULATE] as any);
}

export async function getPayStructure(collegeId: string, id: string) {
  const doc = await PayStructure.findOne({ _id: id, collegeId }).populate(EMPLOYEE_POPULATE as any);
  if (!doc) throw new AppError(404, 'Pay structure not found');
  return doc;
}

export async function createPayStructure(collegeId: string, data: any, who: string) {
  const doc = await PayStructure.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PayStructure', entityId: String(doc._id), entityName: `Pay Structure`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePayStructure(collegeId: string, id: string, data: any, who: string) {
  const doc = await PayStructure.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Pay structure not found');
  await createAuditLog({ collegeId, entityType: 'PayStructure', entityId: id, entityName: `Pay Structure`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePayStructure(collegeId: string, id: string, who: string) {
  const doc = await PayStructure.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Pay structure not found');
  await createAuditLog({ collegeId, entityType: 'PayStructure', entityId: id, entityName: `Pay Structure`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Payroll ═════════════════════════════════════════════

export async function listPayrolls(collegeId: string, page = 1, limit = 20, employeeId?: string, month?: number, year?: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (month) filter.month = month;
  if (year) filter.year = year;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(Payroll, filter, page, limit, { year: -1, month: -1 }, [EMPLOYEE_POPULATE] as any);
}

export async function getPayroll(collegeId: string, id: string) {
  const doc = await Payroll.findOne({ _id: id, collegeId }).populate(EMPLOYEE_POPULATE as any);
  if (!doc) throw new AppError(404, 'Payroll not found');
  return doc;
}

export async function createPayroll(collegeId: string, data: any, who: string) {
  const doc = await Payroll.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Payroll', entityId: String(doc._id), entityName: `Payroll ${data.month}/${data.year}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePayroll(collegeId: string, id: string, data: any, who: string) {
  const doc = await Payroll.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Payroll not found');
  await createAuditLog({ collegeId, entityType: 'Payroll', entityId: id, entityName: `Payroll ${doc.month}/${doc.year}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePayroll(collegeId: string, id: string, who: string) {
  const doc = await Payroll.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Payroll not found');
  await createAuditLog({ collegeId, entityType: 'Payroll', entityId: id, entityName: `Payroll ${doc.month}/${doc.year}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Appraisal ═══════════════════════════════════════════

export async function listAppraisals(collegeId: string, page = 1, limit = 20, employeeId?: string, academicYearId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (academicYearId) filter.academicYearId = academicYearId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(Appraisal, filter, page, limit, { createdAt: -1 }, [EMPLOYEE_POPULATE, REVIEWER_POPULATE, 'academicYearId'] as any);
}

export async function getAppraisal(collegeId: string, id: string) {
  const doc = await Appraisal.findOne({ _id: id, collegeId }).populate([EMPLOYEE_POPULATE, REVIEWER_POPULATE, 'academicYearId'] as any);
  if (!doc) throw new AppError(404, 'Appraisal not found');
  return doc;
}

export async function createAppraisal(collegeId: string, data: any, who: string) {
  const doc = await Appraisal.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Appraisal', entityId: String(doc._id), entityName: `Appraisal`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAppraisal(collegeId: string, id: string, data: any, who: string) {
  const doc = await Appraisal.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Appraisal not found');
  await createAuditLog({ collegeId, entityType: 'Appraisal', entityId: id, entityName: `Appraisal`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAppraisal(collegeId: string, id: string, who: string) {
  const doc = await Appraisal.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Appraisal not found');
  await createAuditLog({ collegeId, entityType: 'Appraisal', entityId: id, entityName: `Appraisal`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Promotion ═══════════════════════════════════════════

export async function listPromotions(collegeId: string, page = 1, limit = 20, employeeId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(Promotion, filter, page, limit, { effectiveDate: -1 }, [EMPLOYEE_POPULATE] as any);
}

export async function createPromotion(collegeId: string, data: any, who: string) {
  const doc = await Promotion.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Promotion', entityId: String(doc._id), entityName: `${data.fromDesignation} → ${data.toDesignation}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePromotion(collegeId: string, id: string, data: any, who: string) {
  const doc = await Promotion.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Promotion not found');
  await createAuditLog({ collegeId, entityType: 'Promotion', entityId: id, entityName: `${doc.fromDesignation} → ${doc.toDesignation}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePromotion(collegeId: string, id: string, who: string) {
  const doc = await Promotion.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Promotion not found');
  await createAuditLog({ collegeId, entityType: 'Promotion', entityId: id, entityName: `Promotion`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Training ════════════════════════════════════════════

export async function listTrainings(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Training, filter, page, limit, { startDate: -1 });
}

export async function getTraining(collegeId: string, id: string) {
  const doc = await Training.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Training not found');
  return doc;
}

export async function createTraining(collegeId: string, data: any, who: string) {
  const doc = await Training.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Training', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateTraining(collegeId: string, id: string, data: any, who: string) {
  const doc = await Training.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Training not found');
  await createAuditLog({ collegeId, entityType: 'Training', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteTraining(collegeId: string, id: string, who: string) {
  const doc = await Training.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Training not found');
  await createAuditLog({ collegeId, entityType: 'Training', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Training Participant ════════════════════════════════

export async function listTrainingParticipants(collegeId: string, page = 1, limit = 20, trainingId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (trainingId) filter.trainingId = trainingId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(TrainingParticipant, filter, page, limit, { createdAt: -1 }, [EMPLOYEE_POPULATE, 'trainingId'] as any);
}

export async function createTrainingParticipant(collegeId: string, data: any, who: string) {
  const doc = await TrainingParticipant.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'TrainingParticipant', entityId: String(doc._id), entityName: `Participant`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateTrainingParticipant(collegeId: string, id: string, data: any, who: string) {
  const doc = await TrainingParticipant.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Training participant not found');
  await createAuditLog({ collegeId, entityType: 'TrainingParticipant', entityId: id, entityName: `Participant`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteTrainingParticipant(collegeId: string, id: string, who: string) {
  const doc = await TrainingParticipant.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Training participant not found');
  await createAuditLog({ collegeId, entityType: 'TrainingParticipant', entityId: id, entityName: `Participant`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Qualification ═══════════════════════════════════════

export async function listQualifications(collegeId: string, page = 1, limit = 20, personId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (personId) filter.personId = personId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });
  return paginate(Qualification, filter, page, limit, { yearOfPassing: -1 }, ['personId']);
}

export async function createQualification(collegeId: string, data: any, who: string) {
  const doc = await Qualification.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Qualification', entityId: String(doc._id), entityName: data.degree, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateQualification(collegeId: string, id: string, data: any, who: string) {
  const doc = await Qualification.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Qualification not found');
  await createAuditLog({ collegeId, entityType: 'Qualification', entityId: id, entityName: doc.degree, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteQualification(collegeId: string, id: string, who: string) {
  const doc = await Qualification.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Qualification not found');
  await createAuditLog({ collegeId, entityType: 'Qualification', entityId: id, entityName: doc.degree, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Grievance ═══════════════════════════════════════════

export async function listGrievances(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'raisedBy' });
  return paginate(Grievance, filter, page, limit, { createdAt: -1 }, ['raisedBy', 'assignedTo']);
}

export async function getGrievance(collegeId: string, id: string) {
  const doc = await Grievance.findOne({ _id: id, collegeId }).populate('raisedBy assignedTo');
  if (!doc) throw new AppError(404, 'Grievance not found');
  return doc;
}

export async function createGrievance(collegeId: string, data: any, who: string) {
  const doc = await Grievance.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Grievance', entityId: String(doc._id), entityName: data.subject, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateGrievance(collegeId: string, id: string, data: any, who: string) {
  const doc = await Grievance.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Grievance not found');
  await createAuditLog({ collegeId, entityType: 'Grievance', entityId: id, entityName: doc.subject, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteGrievance(collegeId: string, id: string, who: string) {
  const doc = await Grievance.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Grievance not found');
  await createAuditLog({ collegeId, entityType: 'Grievance', entityId: id, entityName: doc.subject, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ On Duty ═════════════════════════════════════════════

export async function listOnDuty(collegeId: string, page = 1, limit = 20, employeeId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(OnDuty, filter, page, limit, { fromDate: -1 }, [EMPLOYEE_POPULATE] as any);
}

export async function createOnDuty(collegeId: string, data: any, who: string) {
  const doc = await OnDuty.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'OnDuty', entityId: String(doc._id), entityName: data.purpose, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateOnDuty(collegeId: string, id: string, data: any, who: string) {
  const doc = await OnDuty.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'On-duty record not found');
  await createAuditLog({ collegeId, entityType: 'OnDuty', entityId: id, entityName: doc.purpose, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteOnDuty(collegeId: string, id: string, who: string) {
  const doc = await OnDuty.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'On-duty record not found');
  await createAuditLog({ collegeId, entityType: 'OnDuty', entityId: id, entityName: doc.purpose, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Exit Process ════════════════════════════════════════

export async function listExitProcesses(collegeId: string, page = 1, limit = 20, employeeId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(ExitProcess, filter, page, limit, { createdAt: -1 }, [EMPLOYEE_POPULATE] as any);
}

export async function getExitProcess(collegeId: string, id: string) {
  const doc = await ExitProcess.findOne({ _id: id, collegeId }).populate(EMPLOYEE_POPULATE as any);
  if (!doc) throw new AppError(404, 'Exit process not found');
  return doc;
}

export async function createExitProcess(collegeId: string, data: any, who: string) {
  const doc = await ExitProcess.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ExitProcess', entityId: String(doc._id), entityName: data.exitType, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateExitProcess(collegeId: string, id: string, data: any, who: string) {
  const doc = await ExitProcess.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Exit process not found');
  await createAuditLog({ collegeId, entityType: 'ExitProcess', entityId: id, entityName: doc.exitType, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteExitProcess(collegeId: string, id: string, who: string) {
  const doc = await ExitProcess.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exit process not found');
  await createAuditLog({ collegeId, entityType: 'ExitProcess', entityId: id, entityName: doc.exitType, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Recruitment ═════════════════════════════════════════

export async function listRecruitments(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Recruitment, filter, page, limit, { postedDate: -1 }, ['departmentId']);
}

export async function getRecruitment(collegeId: string, id: string) {
  const doc = await Recruitment.findOne({ _id: id, collegeId }).populate('departmentId');
  if (!doc) throw new AppError(404, 'Recruitment not found');
  return doc;
}

export async function createRecruitment(collegeId: string, data: any, who: string) {
  const doc = await Recruitment.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Recruitment', entityId: String(doc._id), entityName: data.position, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateRecruitment(collegeId: string, id: string, data: any, who: string) {
  const doc = await Recruitment.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Recruitment not found');
  await createAuditLog({ collegeId, entityType: 'Recruitment', entityId: id, entityName: doc.position, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteRecruitment(collegeId: string, id: string, who: string) {
  const doc = await Recruitment.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Recruitment not found');
  await createAuditLog({ collegeId, entityType: 'Recruitment', entityId: id, entityName: doc.position, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Job Application ═════════════════════════════════════

export async function listJobApplications(collegeId: string, page = 1, limit = 20, recruitmentId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (recruitmentId) filter.recruitmentId = recruitmentId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(JobApplication, filter, page, limit, { createdAt: -1 }, ['recruitmentId']);
}

export async function getJobApplication(collegeId: string, id: string) {
  const doc = await JobApplication.findOne({ _id: id, collegeId }).populate('recruitmentId');
  if (!doc) throw new AppError(404, 'Job application not found');
  return doc;
}

export async function createJobApplication(collegeId: string, data: any, who: string) {
  const doc = await JobApplication.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'JobApplication', entityId: String(doc._id), entityName: data.applicantName, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateJobApplication(collegeId: string, id: string, data: any, who: string) {
  const doc = await JobApplication.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Job application not found');
  await createAuditLog({ collegeId, entityType: 'JobApplication', entityId: id, entityName: doc.applicantName, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteJobApplication(collegeId: string, id: string, who: string) {
  const doc = await JobApplication.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Job application not found');
  await createAuditLog({ collegeId, entityType: 'JobApplication', entityId: id, entityName: doc.applicantName, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Publication ═════════════════════════════════════════

export async function listPublications(collegeId: string, page = 1, limit = 20, facultyId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (facultyId) filter.facultyId = facultyId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Publication, filter, page, limit, { publishedDate: -1 }, [FACULTY_POPULATE] as any);
}

export async function getPublication(collegeId: string, id: string) {
  const doc = await Publication.findOne({ _id: id, collegeId }).populate(FACULTY_POPULATE as any);
  if (!doc) throw new AppError(404, 'Publication not found');
  return doc;
}

export async function createPublication(collegeId: string, data: any, who: string) {
  const doc = await Publication.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Publication', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updatePublication(collegeId: string, id: string, data: any, who: string) {
  const doc = await Publication.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Publication not found');
  await createAuditLog({ collegeId, entityType: 'Publication', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deletePublication(collegeId: string, id: string, who: string) {
  const doc = await Publication.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Publication not found');
  await createAuditLog({ collegeId, entityType: 'Publication', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Research Project ════════════════════════════════════

export async function listResearchProjects(collegeId: string, page = 1, limit = 20, principalInvestigatorId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (principalInvestigatorId) filter.principalInvestigatorId = principalInvestigatorId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(ResearchProject, filter, page, limit, { startDate: -1 }, [PI_POPULATE] as any);
}

export async function getResearchProject(collegeId: string, id: string) {
  const doc = await ResearchProject.findOne({ _id: id, collegeId }).populate(PI_POPULATE as any);
  if (!doc) throw new AppError(404, 'Research project not found');
  return doc;
}

export async function createResearchProject(collegeId: string, data: any, who: string) {
  const doc = await ResearchProject.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ResearchProject', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateResearchProject(collegeId: string, id: string, data: any, who: string) {
  const doc = await ResearchProject.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Research project not found');
  await createAuditLog({ collegeId, entityType: 'ResearchProject', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteResearchProject(collegeId: string, id: string, who: string) {
  const doc = await ResearchProject.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Research project not found');
  await createAuditLog({ collegeId, entityType: 'ResearchProject', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══════════════════════════════════════════════════════════
// W05 Phase 1 — Leave & Attendance Workflow Functions
// ═══════════════════════════════════════════════════════════

// ─── W05-L2-017: Initialize Leave Balance ───────────────────
export async function initializeLeaveBalance(
  collegeId: string, employeeId: string, academicYearId: string, joiningDate: Date, performedBy: string,
) {
  const employee = await Employee.findOne({ _id: employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const leaveTypes = await LeaveType.find({ collegeId });
  // Pro-rata: months remaining in academic year (assume July start)
  const joinMonth = new Date(joiningDate).getMonth(); // 0-based
  const monthsRemaining = Math.max(1, 12 - ((joinMonth >= 6 ? joinMonth - 6 : joinMonth + 6)));
  const proRataFactor = monthsRemaining / 12;

  const results = [];
  for (const lt of leaveTypes) {
    // Check applicability
    const applicable = lt.applicableTo.includes('all') || lt.applicableTo.includes(employee.employeeType);
    if (!applicable) continue;

    const entitled = Math.round(lt.maxDaysPerYear * proRataFactor * 10) / 10;
    const existing = await LeaveBalance.findOne({ collegeId, employeeId, leaveTypeId: String(lt._id), academicYearId });
    if (existing) continue; // Don't duplicate

    const doc = await LeaveBalance.create({
      collegeId, employeeId, leaveTypeId: String(lt._id), academicYearId,
      entitled, taken: 0, balance: entitled, carriedForward: 0, lapsed: 0, encashed: 0, encashedAmount: 0, lopDays: 0,
    });
    results.push(doc);
  }
  await createAuditLog({
    collegeId, entityType: 'LeaveBalance', entityId: employeeId,
    entityName: 'Initialize Leave Balance', action: 'create',
    changes: [{ field: 'balancesCreated', displayName: 'Balances Created', oldValue: '0', newValue: String(results.length) }],
    performedBy,
  });
  return { balancesCreated: results.length, balances: results };
}

// ─── W05-L2-018: Submit Leave Request ───────────────────────
export async function submitLeaveRequest(
  collegeId: string,
  data: { employeeId: string; leaveTypeId: string; fromDate: string; toDate: string; days: number; reason: string; isHalfDay?: boolean; documentUrl?: string },
  performedBy: string,
) {
  const leaveType = await LeaveType.findOne({ _id: data.leaveTypeId, collegeId });
  if (!leaveType) throw new AppError(404, 'Leave type not found');

  // Find current academic year balance
  const balance = await LeaveBalance.findOne({ collegeId, employeeId: data.employeeId, leaveTypeId: data.leaveTypeId }).sort({ createdAt: -1 });
  if (!balance) throw new AppError(400, 'No leave balance found for this leave type');
  if (balance.balance < data.days) throw new AppError(400, `Insufficient leave balance. Available: ${balance.balance}, Requested: ${data.days}`);

  // Check exam clash
  const clashResult = await checkExamClash(collegeId, data.employeeId, data.fromDate, data.toDate);

  // Initialize approval chain
  const levels = leaveType.approvalLevels || 1;
  const approvalChain: { level: number; approverId: string; status: string }[] = [];
  for (let i = 1; i <= levels; i++) {
    approvalChain.push({ level: i, approverId: '', status: 'pending' });
  }

  const doc = await LeaveApplication.create({
    collegeId,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    fromDate: new Date(data.fromDate),
    toDate: new Date(data.toDate),
    days: data.days,
    reason: data.reason,
    status: 'pending',
    isHalfDay: data.isHalfDay || false,
    documentUrl: data.documentUrl,
    approvalChain,
    currentApproverLevel: 1,
    examClashDetected: clashResult.hasClash,
    examClashDetails: clashResult.details,
  });

  await createAuditLog({
    collegeId, entityType: 'LeaveApplication', entityId: String(doc._id),
    entityName: `Leave Request ${data.fromDate}`, action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: '', newValue: 'pending' }],
    performedBy,
  });
  return doc;
}

// ─── W05-L2-019: Auto-Approve Casual Leave ──────────────────
export async function autoApproveCasualLeave(collegeId: string, leaveApplicationId: string, performedBy: string) {
  const app = await LeaveApplication.findOne({ _id: leaveApplicationId, collegeId });
  if (!app) throw new AppError(404, 'Leave application not found');

  const leaveType = await LeaveType.findOne({ _id: app.leaveTypeId, collegeId });
  if (!leaveType) throw new AppError(404, 'Leave type not found');

  if (!leaveType.autoApproveEligible) throw new AppError(400, 'This leave type is not eligible for auto-approval');
  if (app.days > (leaveType.autoApproveMaxDays || 2)) throw new AppError(400, `Days exceed auto-approve limit of ${leaveType.autoApproveMaxDays || 2}`);
  if (app.examClashDetected) throw new AppError(400, 'Cannot auto-approve: exam clash detected');

  const balance = await LeaveBalance.findOne({ collegeId, employeeId: String(app.employeeId), leaveTypeId: String(app.leaveTypeId) }).sort({ createdAt: -1 });
  if (!balance || balance.balance < app.days) throw new AppError(400, 'Insufficient leave balance for auto-approval');

  // Deduct balance
  balance.balance -= app.days;
  balance.taken += app.days;
  await balance.save();

  // Approve
  app.status = 'approved';
  app.autoApproved = true;
  if (app.approvalChain && app.approvalChain.length > 0) {
    for (const entry of app.approvalChain) {
      entry.status = 'auto_approved';
      entry.decidedAt = new Date();
      entry.approverId = 'system';
    }
  }
  await app.save();

  await createAuditLog({
    collegeId, entityType: 'LeaveApplication', entityId: String(app._id),
    entityName: 'Auto-Approve Leave', action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'pending', newValue: 'approved' }],
    performedBy,
  });
  return app;
}

// ─── W05-L2-023: Check Exam Clash (Stub) ────────────────────
export async function checkExamClash(
  _collegeId: string, _employeeId: string, _fromDate: string, _toDate: string,
): Promise<{ hasClash: boolean; details?: string }> {
  // Stub: will be wired to M03 Academics module later
  return { hasClash: false };
}

// ─── W05-L2-020/021: Route Leave for Approval ──────────────
export async function routeLeaveForApproval(
  collegeId: string, leaveApplicationId: string, level: number, approverId: string, performedBy: string,
) {
  const app = await LeaveApplication.findOne({ _id: leaveApplicationId, collegeId });
  if (!app) throw new AppError(404, 'Leave application not found');
  if (app.status !== 'pending') throw new AppError(400, 'Leave application is not in pending status');

  app.currentApproverLevel = level;
  if (app.approvalChain) {
    const entry = app.approvalChain.find(e => e.level === level);
    if (entry) {
      entry.approverId = approverId;
      entry.status = 'pending';
    } else {
      app.approvalChain.push({ level, approverId, status: 'pending' });
    }
  } else {
    app.approvalChain = [{ level, approverId, status: 'pending' }];
  }
  await app.save();

  await createAuditLog({
    collegeId, entityType: 'LeaveApplication', entityId: String(app._id),
    entityName: 'Route Leave', action: 'update',
    changes: [{ field: 'currentApproverLevel', displayName: 'Current Approver Level', oldValue: '', newValue: String(level) }],
    performedBy,
  });
  return app;
}

// ─── Approve Leave Request ──────────────────────────────────
export async function approveLeaveRequest(
  collegeId: string, leaveApplicationId: string, approverId: string, remarks: string, performedBy: string,
) {
  const app = await LeaveApplication.findOne({ _id: leaveApplicationId, collegeId });
  if (!app) throw new AppError(404, 'Leave application not found');
  if (app.status !== 'pending') throw new AppError(400, 'Leave application is not in pending status');

  const currentLevel = app.currentApproverLevel || 1;
  // Update approval chain for current level
  if (app.approvalChain) {
    const entry = app.approvalChain.find(e => e.level === currentLevel);
    if (entry) {
      entry.status = 'approved';
      entry.approverId = approverId;
      entry.decidedAt = new Date();
      entry.remarks = remarks;
    }
  }

  // Check if more levels are needed
  const leaveType = await LeaveType.findOne({ _id: app.leaveTypeId, collegeId });
  const totalLevels = leaveType?.approvalLevels || 1;

  if (currentLevel < totalLevels) {
    // Move to next level
    app.currentApproverLevel = currentLevel + 1;
    await app.save();
    await createAuditLog({
      collegeId, entityType: 'LeaveApplication', entityId: String(app._id),
      entityName: 'Approve Leave (Level)', action: 'update',
      changes: [{ field: 'approvalLevel', displayName: 'Approval Level', oldValue: String(currentLevel), newValue: String(currentLevel + 1) }],
      performedBy,
    });
    return app;
  }

  // Final approval — deduct balance
  const balance = await LeaveBalance.findOne({ collegeId, employeeId: String(app.employeeId), leaveTypeId: String(app.leaveTypeId) }).sort({ createdAt: -1 });
  if (balance) {
    balance.balance -= app.days;
    balance.taken += app.days;
    await balance.save();
  }

  app.status = 'approved';
  app.approvedBy = approverId as any;
  app.remarks = remarks;
  await app.save();

  await createAuditLog({
    collegeId, entityType: 'LeaveApplication', entityId: String(app._id),
    entityName: 'Approve Leave', action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'pending', newValue: 'approved' }],
    performedBy,
  });
  return app;
}

// ─── Reject Leave Request ───────────────────────────────────
export async function rejectLeaveRequest(
  collegeId: string, leaveApplicationId: string, approverId: string, remarks: string, performedBy: string,
) {
  const app = await LeaveApplication.findOne({ _id: leaveApplicationId, collegeId });
  if (!app) throw new AppError(404, 'Leave application not found');
  if (app.status !== 'pending') throw new AppError(400, 'Leave application is not in pending status');

  const currentLevel = app.currentApproverLevel || 1;
  if (app.approvalChain) {
    const entry = app.approvalChain.find(e => e.level === currentLevel);
    if (entry) {
      entry.status = 'rejected';
      entry.approverId = approverId;
      entry.decidedAt = new Date();
      entry.remarks = remarks;
    }
  }

  app.status = 'rejected';
  app.remarks = remarks;
  await app.save();

  await createAuditLog({
    collegeId, entityType: 'LeaveApplication', entityId: String(app._id),
    entityName: 'Reject Leave', action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'pending', newValue: 'rejected' }],
    performedBy,
  });
  return app;
}

// ─── W05-L2-026: Withdraw Leave Request ─────────────────────
export async function withdrawLeaveRequest(collegeId: string, leaveApplicationId: string, performedBy: string) {
  const app = await LeaveApplication.findOne({ _id: leaveApplicationId, collegeId });
  if (!app) throw new AppError(404, 'Leave application not found');
  if (!['pending', 'approved'].includes(app.status)) throw new AppError(400, 'Only pending or approved leave can be withdrawn');

  const oldStatus = app.status;

  // Restore balance if was approved (already deducted)
  if (app.status === 'approved') {
    const balance = await LeaveBalance.findOne({ collegeId, employeeId: String(app.employeeId), leaveTypeId: String(app.leaveTypeId) }).sort({ createdAt: -1 });
    if (balance) {
      balance.balance += app.days;
      balance.taken -= app.days;
      await balance.save();
    }
  }

  app.status = 'withdrawn';
  app.withdrawnAt = new Date();
  await app.save();

  await createAuditLog({
    collegeId, entityType: 'LeaveApplication', entityId: String(app._id),
    entityName: 'Withdraw Leave', action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'withdrawn' }],
    performedBy,
  });
  return app;
}

// ─── W05-L2-024: Process Compensatory Off ───────────────────
export async function processCompensatoryOff(
  collegeId: string, data: { employeeId: string; workedDate: string; reason: string }, performedBy: string,
) {
  const employee = await Employee.findOne({ _id: data.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  // Find the CO leave type
  const coType = await LeaveType.findOne({ collegeId, code: { $in: ['CO', 'COMP_OFF', 'comp_off'] } });
  if (!coType) throw new AppError(404, 'Compensatory Off leave type not configured');

  // Find or get latest balance
  const balance = await LeaveBalance.findOne({ collegeId, employeeId: data.employeeId, leaveTypeId: String(coType._id) }).sort({ createdAt: -1 });
  if (!balance) throw new AppError(400, 'No Compensatory Off balance record found. Initialize leave balances first.');

  balance.balance += 1;
  balance.entitled += 1;
  await balance.save();

  await createAuditLog({
    collegeId, entityType: 'LeaveBalance', entityId: String(balance._id),
    entityName: 'Compensatory Off Credit', action: 'update',
    changes: [
      { field: 'balance', displayName: 'Balance', oldValue: String(balance.balance - 1), newValue: String(balance.balance) },
      { field: 'workedDate', displayName: 'Worked Date', oldValue: '', newValue: data.workedDate },
    ],
    performedBy,
  });
  return { message: 'Compensatory off credited', balance };
}

// ─── W05-L2-025: Annual Leave Reset ────────────────────────
export async function annualLeaveReset(
  collegeId: string, academicYearId: string, newAcademicYearId: string, performedBy: string,
) {
  const employees = await Employee.find({ collegeId, status: 'active' });
  const leaveTypes = await LeaveType.find({ collegeId });

  let created = 0;
  for (const emp of employees) {
    for (const lt of leaveTypes) {
      const applicable = lt.applicableTo.includes('all') || lt.applicableTo.includes(emp.employeeType);
      if (!applicable) continue;

      const oldBalance = await LeaveBalance.findOne({
        collegeId, employeeId: String(emp._id), leaveTypeId: String(lt._id), academicYearId,
      });

      let carryForward = 0;
      let lapsed = 0;
      if (oldBalance && lt.isCarryForward) {
        const remainingBalance = oldBalance.balance;
        carryForward = Math.min(remainingBalance, lt.maxCarryForward);
        lapsed = Math.max(0, remainingBalance - carryForward);

        // Update old balance with lapsed info
        oldBalance.lapsed = lapsed;
        await oldBalance.save();
      } else if (oldBalance) {
        lapsed = oldBalance.balance;
        oldBalance.lapsed = lapsed;
        await oldBalance.save();
      }

      const entitled = lt.maxDaysPerYear + carryForward;

      // Check if new year balance already exists
      const existing = await LeaveBalance.findOne({
        collegeId, employeeId: String(emp._id), leaveTypeId: String(lt._id), academicYearId: newAcademicYearId,
      });
      if (existing) continue;

      await LeaveBalance.create({
        collegeId, employeeId: String(emp._id), leaveTypeId: String(lt._id),
        academicYearId: newAcademicYearId,
        entitled, taken: 0, balance: entitled, carriedForward: carryForward, lapsed: 0, encashed: 0, encashedAmount: 0, lopDays: 0,
      });
      created++;
    }
  }

  await createAuditLog({
    collegeId, entityType: 'LeaveBalance', entityId: newAcademicYearId,
    entityName: 'Annual Leave Reset', action: 'create',
    changes: [{ field: 'balancesCreated', displayName: 'Balances Created', oldValue: '0', newValue: String(created) }],
    performedBy,
  });
  return { message: 'Annual leave reset completed', balancesCreated: created };
}

// ─── W05-L2-027: Trigger Faculty Substitution (Stub) ────────
export async function triggerFacultySubstitution(collegeId: string, leaveApplicationId: string, _performedBy: string) {
  const app = await LeaveApplication.findOne({ _id: leaveApplicationId, collegeId });
  if (!app) throw new AppError(404, 'Leave application not found');

  app.substitutionTriggered = true;
  await app.save();

  // Stub: will be wired to M03 Academics module for actual substitution
  return { message: 'Faculty substitution flagged. Integration with academics module pending.', leaveApplicationId: String(app._id) };
}

// ─── W05-L2-028: Record Biometric Attendance ────────────────
export async function recordBiometricAttendance(
  collegeId: string,
  data: { employeeId: string; date: string; checkIn?: string; checkOut?: string; source?: string },
  performedBy: string,
) {
  const dateObj = new Date(data.date);
  const existing = await EmployeeAttendance.findOne({ collegeId, employeeId: data.employeeId, date: dateObj });

  // Standard check-in time: 9:00 AM
  const STANDARD_CHECK_IN_HOUR = 9;
  const STANDARD_CHECK_IN_MIN = 0;
  let lateMinutes = 0;
  let status: string = 'present';

  if (data.checkIn) {
    const checkInDate = new Date(data.checkIn);
    const standardTime = new Date(dateObj);
    standardTime.setHours(STANDARD_CHECK_IN_HOUR, STANDARD_CHECK_IN_MIN, 0, 0);
    if (checkInDate > standardTime) {
      lateMinutes = Math.round((checkInDate.getTime() - standardTime.getTime()) / 60000);
    }
    // If late by more than 2 hours, mark as half_day
    if (lateMinutes > 120) {
      status = 'half_day';
    } else if (lateMinutes > 0) {
      status = 'present'; // present but late
    }
  }

  // If no checkIn at all and no existing record, mark absent
  if (!data.checkIn && !existing) {
    status = 'absent';
  }

  if (existing) {
    // Update existing record
    if (data.checkIn && !existing.checkIn) existing.checkIn = new Date(data.checkIn);
    if (data.checkOut) existing.checkOut = new Date(data.checkOut);
    if (data.source) existing.source = data.source;
    existing.lateMinutes = lateMinutes;
    if (lateMinutes > 120) existing.status = 'half_day';
    await existing.save();

    await createAuditLog({
      collegeId, entityType: 'EmployeeAttendance', entityId: String(existing._id),
      entityName: 'Biometric Attendance Update', action: 'update',
      changes: [{ field: 'status', displayName: 'Status', oldValue: existing.status, newValue: status }],
      performedBy,
    });
    return existing;
  }

  const doc = await EmployeeAttendance.create({
    collegeId,
    employeeId: data.employeeId,
    date: dateObj,
    checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
    checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
    status,
    source: data.source || 'biometric',
    lateMinutes,
    isLocked: false,
    anomalyFlags: [],
  });

  await createAuditLog({
    collegeId, entityType: 'EmployeeAttendance', entityId: String(doc._id),
    entityName: 'Biometric Attendance', action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: '', newValue: status }],
    performedBy,
  });
  return doc;
}

// ─── W05-L2-029: Detect Attendance Anomalies ────────────────
export async function detectAttendanceAnomalies(collegeId: string, month: number, year: number, performedBy: string) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const employees = await Employee.find({ collegeId, status: 'active' });
  const anomalies = [];

  for (const emp of employees) {
    const records = await EmployeeAttendance.find({
      collegeId, employeeId: String(emp._id), date: { $gte: startDate, $lte: endDate },
    });

    // Chronic late: > 3 late arrivals
    const lateRecords = records.filter(r => (r.lateMinutes || 0) > 0);
    if (lateRecords.length > 3) {
      const anomaly = await AttendanceAnomaly.findOneAndUpdate(
        { collegeId, employeeId: String(emp._id), month, year, anomalyType: 'chronic_late' },
        {
          collegeId, employeeId: String(emp._id), anomalyType: 'chronic_late',
          month, year,
          details: { lateCount: lateRecords.length },
          severity: lateRecords.length > 8 ? 'critical' : lateRecords.length > 5 ? 'warning' : 'info',
          flaggedAt: new Date(),
        },
        { upsert: true, new: true },
      );
      anomalies.push(anomaly);
    }

    // Missing swipe: checkIn present but no checkOut
    const missingSwipes = records.filter(r => r.checkIn && !r.checkOut && r.status === 'present');
    if (missingSwipes.length > 0) {
      const anomaly = await AttendanceAnomaly.findOneAndUpdate(
        { collegeId, employeeId: String(emp._id), month, year, anomalyType: 'missing_swipe' },
        {
          collegeId, employeeId: String(emp._id), anomalyType: 'missing_swipe',
          month, year,
          details: { missedCheckouts: missingSwipes.length },
          severity: missingSwipes.length > 5 ? 'warning' : 'info',
          flaggedAt: new Date(),
        },
        { upsert: true, new: true },
      );
      anomalies.push(anomaly);

      // Flag attendance records
      for (const rec of missingSwipes) {
        if (!rec.anomalyFlags) rec.anomalyFlags = [];
        if (!rec.anomalyFlags.includes('missing_swipe')) {
          rec.anomalyFlags.push('missing_swipe');
          await rec.save();
        }
      }
    }
  }

  await createAuditLog({
    collegeId, entityType: 'AttendanceAnomaly', entityId: `${month}-${year}`,
    entityName: 'Detect Anomalies', action: 'create',
    changes: [{ field: 'anomaliesDetected', displayName: 'Anomalies Detected', oldValue: '0', newValue: String(anomalies.length) }],
    performedBy,
  });
  return { anomaliesDetected: anomalies.length, anomalies };
}

// ─── W05-L2-030: Submit OD Request ──────────────────────────
export async function submitODRequest(
  collegeId: string,
  data: { employeeId: string; fromDate: string; toDate: string; purpose: string; venue?: string; documentUrl?: string },
  performedBy: string,
) {
  const employee = await Employee.findOne({ _id: data.employeeId, collegeId });
  if (!employee) throw new AppError(404, 'Employee not found');

  const doc = await OnDuty.create({
    collegeId,
    employeeId: data.employeeId,
    fromDate: new Date(data.fromDate),
    toDate: new Date(data.toDate),
    purpose: data.purpose,
    venue: data.venue,
    status: 'applied',
  });

  await createAuditLog({
    collegeId, entityType: 'OnDuty', entityId: String(doc._id),
    entityName: `OD: ${data.purpose}`, action: 'create',
    changes: [{ field: 'status', displayName: 'Status', oldValue: '', newValue: 'applied' }],
    performedBy,
  });
  return doc;
}

// ─── Approve OD Request ─────────────────────────────────────
export async function approveODRequest(collegeId: string, onDutyId: string, approverId: string, performedBy: string) {
  const od = await OnDuty.findOne({ _id: onDutyId, collegeId });
  if (!od) throw new AppError(404, 'On-duty request not found');
  if (od.status !== 'applied') throw new AppError(400, 'On-duty request is not in applied status');

  od.status = 'approved';
  od.approvedBy = approverId as any;
  await od.save();

  // Update attendance records in the date range to 'on_duty'
  const fromDate = new Date(od.fromDate);
  const toDate = new Date(od.toDate);
  const currentDate = new Date(fromDate);
  while (currentDate <= toDate) {
    await EmployeeAttendance.findOneAndUpdate(
      { collegeId, employeeId: String(od.employeeId), date: new Date(currentDate) },
      { status: 'on_duty', source: 'manual' },
      { upsert: true, new: true },
    );
    currentDate.setDate(currentDate.getDate() + 1);
  }

  await createAuditLog({
    collegeId, entityType: 'OnDuty', entityId: String(od._id),
    entityName: `OD Approved: ${od.purpose}`, action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'applied', newValue: 'approved' }],
    performedBy,
  });
  return od;
}

// ─── W05-L2-031: Reconcile Attendance & Leave ───────────────
export async function reconcileAttendanceLeave(collegeId: string, month: number, year: number, performedBy: string) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const employees = await Employee.find({ collegeId, status: 'active' });
  const summaries = [];

  for (const emp of employees) {
    const records = await EmployeeAttendance.find({
      collegeId, employeeId: String(emp._id), date: { $gte: startDate, $lte: endDate },
    });

    const totals = {
      totalPresent: 0, totalAbsent: 0, totalLate: 0, totalHalfDay: 0,
      totalOnDuty: 0, totalLeave: 0, totalHoliday: 0, lopDays: 0,
    };

    for (const rec of records) {
      switch (rec.status) {
        case 'present': totals.totalPresent++; break;
        case 'absent': totals.totalAbsent++; break;
        case 'half_day': totals.totalHalfDay++; break;
        case 'on_duty': totals.totalOnDuty++; break;
        case 'leave': totals.totalLeave++; break;
        case 'holiday': totals.totalHoliday++; break;
      }
      if ((rec.lateMinutes || 0) > 0) totals.totalLate++;
    }

    const summary = await AttendanceMonthlySummary.findOneAndUpdate(
      { collegeId, employeeId: String(emp._id), month, year },
      { collegeId, employeeId: String(emp._id), month, year, ...totals },
      { upsert: true, new: true },
    );
    summaries.push(summary);
  }

  await createAuditLog({
    collegeId, entityType: 'AttendanceMonthlySummary', entityId: `${month}-${year}`,
    entityName: 'Reconcile Attendance', action: 'update',
    changes: [{ field: 'summariesUpdated', displayName: 'Summaries Updated', oldValue: '0', newValue: String(summaries.length) }],
    performedBy,
  });
  return { summariesUpdated: summaries.length, summaries };
}

// ─── W05-L2-032: Lock Monthly Attendance ────────────────────
export async function lockMonthlyAttendance(collegeId: string, month: number, year: number, performedBy: string) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Lock all attendance records for the month
  const lockResult = await EmployeeAttendance.updateMany(
    { collegeId, date: { $gte: startDate, $lte: endDate } },
    { isLocked: true },
  );

  // Lock all monthly summaries
  await AttendanceMonthlySummary.updateMany(
    { collegeId, month, year },
    { isLocked: true, lockedAt: new Date(), lockedBy: performedBy },
  );

  await createAuditLog({
    collegeId, entityType: 'EmployeeAttendance', entityId: `${month}-${year}`,
    entityName: 'Lock Monthly Attendance', action: 'update',
    changes: [{ field: 'isLocked', displayName: 'Is Locked', oldValue: 'false', newValue: 'true' }],
    performedBy,
  });
  return { message: 'Monthly attendance locked', recordsLocked: lockResult.modifiedCount };
}

// ─── W05-L2-033: Submit Attendance Correction ───────────────
export async function submitAttendanceCorrection(
  collegeId: string, attendanceId: string,
  data: { correctionReason: string; requestedStatus: string },
  performedBy: string,
) {
  const attendance = await EmployeeAttendance.findOne({ _id: attendanceId, collegeId });
  if (!attendance) throw new AppError(404, 'Attendance record not found');
  if (attendance.isLocked) throw new AppError(400, 'Attendance record is locked and cannot be corrected');

  attendance.originalStatus = attendance.status;
  attendance.correctionReason = data.correctionReason;
  attendance.correctionRequestedBy = performedBy as any;
  await attendance.save();

  await createAuditLog({
    collegeId, entityType: 'EmployeeAttendance', entityId: String(attendance._id),
    entityName: 'Attendance Correction Request', action: 'update',
    changes: [
      { field: 'correctionReason', displayName: 'Correction Reason', oldValue: '', newValue: data.correctionReason },
      { field: 'requestedStatus', displayName: 'Requested Status', oldValue: attendance.originalStatus || '', newValue: data.requestedStatus },
    ],
    performedBy,
  });
  return attendance;
}

// ─── Approve Attendance Correction ──────────────────────────
export async function approveAttendanceCorrection(
  collegeId: string, attendanceId: string, approverId: string, performedBy: string,
) {
  const attendance = await EmployeeAttendance.findOne({ _id: attendanceId, collegeId });
  if (!attendance) throw new AppError(404, 'Attendance record not found');
  if (!attendance.correctionReason) throw new AppError(400, 'No correction request found for this record');
  if (attendance.isLocked) throw new AppError(400, 'Attendance record is locked and cannot be corrected');

  attendance.correctionApprovedBy = approverId as any;
  // The actual status change would come from the correction request data
  // For now, we mark it as approved
  await attendance.save();

  await createAuditLog({
    collegeId, entityType: 'EmployeeAttendance', entityId: String(attendance._id),
    entityName: 'Attendance Correction Approved', action: 'update',
    changes: [{ field: 'correctionApprovedBy', displayName: 'Correction Approved By', oldValue: '', newValue: approverId }],
    performedBy,
  });
  return attendance;
}

// ═══ Attendance Anomaly CRUD ════════════════════════════════

export async function listAttendanceAnomalies(collegeId: string, page = 1, limit = 20, employeeId?: string, month?: number, year?: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (month) filter.month = month;
  if (year) filter.year = year;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(AttendanceAnomaly, filter, page, limit, { flaggedAt: -1 }, [EMPLOYEE_POPULATE] as any);
}

export async function getAttendanceAnomaly(collegeId: string, id: string) {
  const doc = await AttendanceAnomaly.findOne({ _id: id, collegeId }).populate(EMPLOYEE_POPULATE as any);
  if (!doc) throw new AppError(404, 'Attendance anomaly not found');
  return doc;
}

export async function createAttendanceAnomaly(collegeId: string, data: any, who: string) {
  const doc = await AttendanceAnomaly.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AttendanceAnomaly', entityId: String(doc._id), entityName: doc.anomalyType, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAttendanceAnomaly(collegeId: string, id: string, data: any, who: string) {
  const doc = await AttendanceAnomaly.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Attendance anomaly not found');
  await createAuditLog({ collegeId, entityType: 'AttendanceAnomaly', entityId: id, entityName: doc.anomalyType, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAttendanceAnomaly(collegeId: string, id: string, who: string) {
  const doc = await AttendanceAnomaly.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Attendance anomaly not found');
  await createAuditLog({ collegeId, entityType: 'AttendanceAnomaly', entityId: id, entityName: doc.anomalyType, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Attendance Monthly Summary CRUD ════════════════════════

export async function listAttendanceMonthlySummaries(collegeId: string, page = 1, limit = 20, employeeId?: string, month?: number, year?: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (employeeId) filter.employeeId = employeeId;
  if (month) filter.month = month;
  if (year) filter.year = year;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'employeeId' });
  return paginate(AttendanceMonthlySummary, filter, page, limit, { year: -1, month: -1 }, [EMPLOYEE_POPULATE] as any);
}

export async function getAttendanceMonthlySummary(collegeId: string, id: string) {
  const doc = await AttendanceMonthlySummary.findOne({ _id: id, collegeId }).populate(EMPLOYEE_POPULATE as any);
  if (!doc) throw new AppError(404, 'Monthly summary not found');
  return doc;
}

export async function createAttendanceMonthlySummary(collegeId: string, data: any, who: string) {
  const doc = await AttendanceMonthlySummary.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AttendanceMonthlySummary', entityId: String(doc._id), entityName: `Summary ${data.month}/${data.year}`, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAttendanceMonthlySummary(collegeId: string, id: string, data: any, who: string) {
  const doc = await AttendanceMonthlySummary.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Monthly summary not found');
  await createAuditLog({ collegeId, entityType: 'AttendanceMonthlySummary', entityId: id, entityName: `Summary ${doc.month}/${doc.year}`, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAttendanceMonthlySummary(collegeId: string, id: string, who: string) {
  const doc = await AttendanceMonthlySummary.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Monthly summary not found');
  await createAuditLog({ collegeId, entityType: 'AttendanceMonthlySummary', entityId: id, entityName: `Summary ${doc.month}/${doc.year}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

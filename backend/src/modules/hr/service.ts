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

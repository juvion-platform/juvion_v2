import { HostelBlock } from '../../models/welfare/HostelBlock';
import { HostelRoom } from '../../models/welfare/HostelRoom';
import { HostelAllocation } from '../../models/welfare/HostelAllocation';
import { HostelVisitorLog } from '../../models/welfare/HostelVisitorLog';
import { MessMenu } from '../../models/welfare/MessMenu';
import { MessFeedback } from '../../models/welfare/MessFeedback';
import { TransportRoute } from '../../models/welfare/TransportRoute';
import { TransportAllocation } from '../../models/welfare/TransportAllocation';
import { HealthRecord } from '../../models/welfare/HealthRecord';
import { MedicalVisit } from '../../models/welfare/MedicalVisit';
import { CounselingSession } from '../../models/welfare/CounselingSession';
import { CrisisAlert } from '../../models/welfare/CrisisAlert';
import { AntiRaggingComplaint } from '../../models/welfare/AntiRaggingComplaint';
import { StudentGrievance } from '../../models/welfare/StudentGrievance';
import { InsuranceClaim } from '../../models/welfare/InsuranceClaim';
import { ParentMeeting } from '../../models/welfare/ParentMeeting';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';

const STUDENT_POPULATE = { path: 'studentId', populate: { path: 'personId' } };
const FACULTY_POPULATE = { path: 'facultyId', populate: { path: 'personId' } };

// ─── Dashboard Stats ──────────────────────────────────────
export async function getStats(collegeId: string) {
  const [
    hostelBlocks, hostelRooms, hostelAllocations, visitorLogs,
    messMenus, messFeedbacks,
    transportRoutes, transportAllocations,
    healthRecords, medicalVisits,
    counselingSessions, crisisAlerts,
    antiRaggingComplaints, studentGrievances,
    insuranceClaims, parentMeetings,
    activeHostelAllocations, activeCrisisAlerts, openGrievances,
  ] = await Promise.all([
    HostelBlock.countDocuments({ collegeId }),
    HostelRoom.countDocuments({ collegeId }),
    HostelAllocation.countDocuments({ collegeId }),
    HostelVisitorLog.countDocuments({ collegeId }),
    MessMenu.countDocuments({ collegeId }),
    MessFeedback.countDocuments({ collegeId }),
    TransportRoute.countDocuments({ collegeId }),
    TransportAllocation.countDocuments({ collegeId }),
    HealthRecord.countDocuments({ collegeId }),
    MedicalVisit.countDocuments({ collegeId }),
    CounselingSession.countDocuments({ collegeId }),
    CrisisAlert.countDocuments({ collegeId }),
    AntiRaggingComplaint.countDocuments({ collegeId }),
    StudentGrievance.countDocuments({ collegeId }),
    InsuranceClaim.countDocuments({ collegeId }),
    ParentMeeting.countDocuments({ collegeId }),
    HostelAllocation.countDocuments({ collegeId, status: 'active' }),
    CrisisAlert.countDocuments({ collegeId, status: { $in: ['reported', 'acknowledged', 'in_progress'] } }),
    StudentGrievance.countDocuments({ collegeId, status: { $in: ['open', 'in_progress'] } }),
  ]);

  return {
    hostelBlocks, hostelRooms, hostelAllocations, visitorLogs,
    messMenus, messFeedbacks,
    transportRoutes, transportAllocations,
    healthRecords, medicalVisits,
    counselingSessions, crisisAlerts,
    antiRaggingComplaints, studentGrievances,
    insuranceClaims, parentMeetings,
    activeHostelAllocations, activeCrisisAlerts, openGrievances,
  };
}

// ═══ Hostel Block ════════════════════════════════════════

export async function listHostelBlocks(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(HostelBlock, filter, page, limit, { createdAt: -1 }, ['wardenId']);
}

export async function getHostelBlock(collegeId: string, id: string) {
  const doc = await HostelBlock.findOne({ _id: id, collegeId }).populate('wardenId');
  if (!doc) throw new AppError(404, 'Hostel block not found');
  return doc;
}

export async function createHostelBlock(collegeId: string, data: any, who: string) {
  const doc = await HostelBlock.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'HostelBlock', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateHostelBlock(collegeId: string, id: string, data: any, who: string) {
  const doc = await HostelBlock.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Hostel block not found');
  await createAuditLog({ collegeId, entityType: 'HostelBlock', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteHostelBlock(collegeId: string, id: string, who: string) {
  const doc = await HostelBlock.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel block not found');
  await createAuditLog({ collegeId, entityType: 'HostelBlock', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Hostel Room ═════════════════════════════════════════

export async function listHostelRooms(collegeId: string, page = 1, limit = 20, blockId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (blockId) filter.blockId = blockId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(HostelRoom, filter, page, limit, { createdAt: -1 }, ['blockId']);
}

export async function getHostelRoom(collegeId: string, id: string) {
  const doc = await HostelRoom.findOne({ _id: id, collegeId }).populate('blockId');
  if (!doc) throw new AppError(404, 'Hostel room not found');
  return doc;
}

export async function createHostelRoom(collegeId: string, data: any, who: string) {
  const doc = await HostelRoom.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'HostelRoom', entityId: String(doc._id), entityName: data.roomNumber, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateHostelRoom(collegeId: string, id: string, data: any, who: string) {
  const doc = await HostelRoom.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Hostel room not found');
  await createAuditLog({ collegeId, entityType: 'HostelRoom', entityId: id, entityName: doc.roomNumber, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteHostelRoom(collegeId: string, id: string, who: string) {
  const doc = await HostelRoom.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel room not found');
  await createAuditLog({ collegeId, entityType: 'HostelRoom', entityId: id, entityName: doc.roomNumber, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Hostel Allocation ═══════════════════════════════════

export async function listHostelAllocations(collegeId: string, page = 1, limit = 20, studentId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(HostelAllocation, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'roomId', 'academicYearId'] as any);
}

export async function getHostelAllocation(collegeId: string, id: string) {
  const doc = await HostelAllocation.findOne({ _id: id, collegeId }).populate([STUDENT_POPULATE as any, 'roomId', 'academicYearId']);
  if (!doc) throw new AppError(404, 'Hostel allocation not found');
  return doc;
}

export async function createHostelAllocation(collegeId: string, data: any, who: string) {
  const doc = await HostelAllocation.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'HostelAllocation', entityId: String(doc._id), entityName: 'Hostel Allocation', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateHostelAllocation(collegeId: string, id: string, data: any, who: string) {
  const doc = await HostelAllocation.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Hostel allocation not found');
  await createAuditLog({ collegeId, entityType: 'HostelAllocation', entityId: id, entityName: 'Hostel Allocation', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteHostelAllocation(collegeId: string, id: string, who: string) {
  const doc = await HostelAllocation.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Hostel allocation not found');
  await createAuditLog({ collegeId, entityType: 'HostelAllocation', entityId: id, entityName: 'Hostel Allocation', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Hostel Visitor Log ══════════════════════════════════

export async function listHostelVisitorLogs(collegeId: string, page = 1, limit = 20, studentId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(HostelVisitorLog, filter, page, limit, { inTime: -1 }, [STUDENT_POPULATE] as any);
}

export async function getHostelVisitorLog(collegeId: string, id: string) {
  const doc = await HostelVisitorLog.findOne({ _id: id, collegeId }).populate(STUDENT_POPULATE as any);
  if (!doc) throw new AppError(404, 'Visitor log not found');
  return doc;
}

export async function createHostelVisitorLog(collegeId: string, data: any, who: string) {
  const doc = await HostelVisitorLog.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'HostelVisitorLog', entityId: String(doc._id), entityName: data.visitorName, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateHostelVisitorLog(collegeId: string, id: string, data: any, who: string) {
  const doc = await HostelVisitorLog.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Visitor log not found');
  await createAuditLog({ collegeId, entityType: 'HostelVisitorLog', entityId: id, entityName: doc.visitorName, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteHostelVisitorLog(collegeId: string, id: string, who: string) {
  const doc = await HostelVisitorLog.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Visitor log not found');
  await createAuditLog({ collegeId, entityType: 'HostelVisitorLog', entityId: id, entityName: doc.visitorName, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Mess Menu ═══════════════════════════════════════════

export async function listMessMenus(collegeId: string, page = 1, limit = 20, day?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (day) filter.day = day;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(MessMenu, filter, page, limit, { effectiveFrom: -1 }, ['blockId']);
}

export async function getMessMenu(collegeId: string, id: string) {
  const doc = await MessMenu.findOne({ _id: id, collegeId }).populate('blockId');
  if (!doc) throw new AppError(404, 'Mess menu not found');
  return doc;
}

export async function createMessMenu(collegeId: string, data: any, who: string) {
  const doc = await MessMenu.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'MessMenu', entityId: String(doc._id), entityName: data.day, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateMessMenu(collegeId: string, id: string, data: any, who: string) {
  const doc = await MessMenu.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Mess menu not found');
  await createAuditLog({ collegeId, entityType: 'MessMenu', entityId: id, entityName: doc.day, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteMessMenu(collegeId: string, id: string, who: string) {
  const doc = await MessMenu.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Mess menu not found');
  await createAuditLog({ collegeId, entityType: 'MessMenu', entityId: id, entityName: doc.day, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Mess Feedback ═══════════════════════════════════════

export async function listMessFeedbacks(collegeId: string, page = 1, limit = 20, mealType?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (mealType) filter.mealType = mealType;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(MessFeedback, filter, page, limit, { date: -1 }, [STUDENT_POPULATE] as any);
}

export async function getMessFeedback(collegeId: string, id: string) {
  const doc = await MessFeedback.findOne({ _id: id, collegeId }).populate(STUDENT_POPULATE as any);
  if (!doc) throw new AppError(404, 'Mess feedback not found');
  return doc;
}

export async function createMessFeedback(collegeId: string, data: any, who: string) {
  const doc = await MessFeedback.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'MessFeedback', entityId: String(doc._id), entityName: data.mealType, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateMessFeedback(collegeId: string, id: string, data: any, who: string) {
  const doc = await MessFeedback.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Mess feedback not found');
  await createAuditLog({ collegeId, entityType: 'MessFeedback', entityId: id, entityName: doc.mealType, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteMessFeedback(collegeId: string, id: string, who: string) {
  const doc = await MessFeedback.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Mess feedback not found');
  await createAuditLog({ collegeId, entityType: 'MessFeedback', entityId: id, entityName: doc.mealType, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Transport Route ═════════════════════════════════════

export async function listTransportRoutes(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(TransportRoute, filter, page, limit, { createdAt: -1 });
}

export async function getTransportRoute(collegeId: string, id: string) {
  const doc = await TransportRoute.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Transport route not found');
  return doc;
}

export async function createTransportRoute(collegeId: string, data: any, who: string) {
  const doc = await TransportRoute.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'TransportRoute', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateTransportRoute(collegeId: string, id: string, data: any, who: string) {
  const doc = await TransportRoute.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Transport route not found');
  await createAuditLog({ collegeId, entityType: 'TransportRoute', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteTransportRoute(collegeId: string, id: string, who: string) {
  const doc = await TransportRoute.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Transport route not found');
  await createAuditLog({ collegeId, entityType: 'TransportRoute', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Transport Allocation ════════════════════════════════

export async function listTransportAllocations(collegeId: string, page = 1, limit = 20, routeId?: string, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (routeId) filter.routeId = routeId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(TransportAllocation, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'routeId', 'academicYearId'] as any);
}

export async function getTransportAllocation(collegeId: string, id: string) {
  const doc = await TransportAllocation.findOne({ _id: id, collegeId }).populate([STUDENT_POPULATE as any, 'routeId', 'academicYearId']);
  if (!doc) throw new AppError(404, 'Transport allocation not found');
  return doc;
}

export async function createTransportAllocation(collegeId: string, data: any, who: string) {
  const doc = await TransportAllocation.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'TransportAllocation', entityId: String(doc._id), entityName: data.stopName, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateTransportAllocation(collegeId: string, id: string, data: any, who: string) {
  const doc = await TransportAllocation.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Transport allocation not found');
  await createAuditLog({ collegeId, entityType: 'TransportAllocation', entityId: id, entityName: doc.stopName, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteTransportAllocation(collegeId: string, id: string, who: string) {
  const doc = await TransportAllocation.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Transport allocation not found');
  await createAuditLog({ collegeId, entityType: 'TransportAllocation', entityId: id, entityName: doc.stopName, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Health Record ═══════════════════════════════════════

export async function listHealthRecords(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });
  return paginate(HealthRecord, filter, page, limit, { createdAt: -1 }, ['personId']);
}

export async function getHealthRecord(collegeId: string, id: string) {
  const doc = await HealthRecord.findOne({ _id: id, collegeId }).populate('personId');
  if (!doc) throw new AppError(404, 'Health record not found');
  return doc;
}

export async function createHealthRecord(collegeId: string, data: any, who: string) {
  const doc = await HealthRecord.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'HealthRecord', entityId: String(doc._id), entityName: 'Health Record', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateHealthRecord(collegeId: string, id: string, data: any, who: string) {
  const doc = await HealthRecord.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Health record not found');
  await createAuditLog({ collegeId, entityType: 'HealthRecord', entityId: id, entityName: 'Health Record', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteHealthRecord(collegeId: string, id: string, who: string) {
  const doc = await HealthRecord.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Health record not found');
  await createAuditLog({ collegeId, entityType: 'HealthRecord', entityId: id, entityName: 'Health Record', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Medical Visit ═══════════════════════════════════════

export async function listMedicalVisits(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });
  return paginate(MedicalVisit, filter, page, limit, { visitDate: -1 }, ['personId']);
}

export async function getMedicalVisit(collegeId: string, id: string) {
  const doc = await MedicalVisit.findOne({ _id: id, collegeId }).populate('personId');
  if (!doc) throw new AppError(404, 'Medical visit not found');
  return doc;
}

export async function createMedicalVisit(collegeId: string, data: any, who: string) {
  const doc = await MedicalVisit.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'MedicalVisit', entityId: String(doc._id), entityName: data.complaint, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateMedicalVisit(collegeId: string, id: string, data: any, who: string) {
  const doc = await MedicalVisit.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Medical visit not found');
  await createAuditLog({ collegeId, entityType: 'MedicalVisit', entityId: id, entityName: doc.complaint, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteMedicalVisit(collegeId: string, id: string, who: string) {
  const doc = await MedicalVisit.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Medical visit not found');
  await createAuditLog({ collegeId, entityType: 'MedicalVisit', entityId: id, entityName: doc.complaint, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Counseling Session ══════════════════════════════════

export async function listCounselingSessions(collegeId: string, page = 1, limit = 20, type?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (type) filter.type = type;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(CounselingSession, filter, page, limit, { sessionDate: -1 }, [STUDENT_POPULATE, 'counselorId'] as any);
}

export async function getCounselingSession(collegeId: string, id: string) {
  const doc = await CounselingSession.findOne({ _id: id, collegeId }).populate([STUDENT_POPULATE as any, 'counselorId']);
  if (!doc) throw new AppError(404, 'Counseling session not found');
  return doc;
}

export async function createCounselingSession(collegeId: string, data: any, who: string) {
  const doc = await CounselingSession.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'CounselingSession', entityId: String(doc._id), entityName: data.type, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateCounselingSession(collegeId: string, id: string, data: any, who: string) {
  const doc = await CounselingSession.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Counseling session not found');
  await createAuditLog({ collegeId, entityType: 'CounselingSession', entityId: id, entityName: doc.type, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteCounselingSession(collegeId: string, id: string, who: string) {
  const doc = await CounselingSession.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Counseling session not found');
  await createAuditLog({ collegeId, entityType: 'CounselingSession', entityId: id, entityName: doc.type, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Crisis Alert ════════════════════════════════════════

export async function listCrisisAlerts(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(CrisisAlert, filter, page, limit, { createdAt: -1 }, ['reportedBy', STUDENT_POPULATE, 'assignedTo'] as any);
}

export async function getCrisisAlert(collegeId: string, id: string) {
  const doc = await CrisisAlert.findOne({ _id: id, collegeId }).populate(['reportedBy', STUDENT_POPULATE as any, 'assignedTo']);
  if (!doc) throw new AppError(404, 'Crisis alert not found');
  return doc;
}

export async function createCrisisAlert(collegeId: string, data: any, who: string) {
  const doc = await CrisisAlert.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'CrisisAlert', entityId: String(doc._id), entityName: data.type, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateCrisisAlert(collegeId: string, id: string, data: any, who: string) {
  const doc = await CrisisAlert.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Crisis alert not found');
  await createAuditLog({ collegeId, entityType: 'CrisisAlert', entityId: id, entityName: doc.type, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteCrisisAlert(collegeId: string, id: string, who: string) {
  const doc = await CrisisAlert.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Crisis alert not found');
  await createAuditLog({ collegeId, entityType: 'CrisisAlert', entityId: id, entityName: doc.type, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Anti-Ragging Complaint ══════════════════════════════

export async function listAntiRaggingComplaints(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'complainantId' });
  return paginate(AntiRaggingComplaint, filter, page, limit, { createdAt: -1 }, ['complainantId', { path: 'accusedIds', populate: { path: 'personId' } }] as any);
}

export async function getAntiRaggingComplaint(collegeId: string, id: string) {
  const doc = await AntiRaggingComplaint.findOne({ _id: id, collegeId }).populate(['complainantId', { path: 'accusedIds', populate: { path: 'personId' } }] as any);
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');
  return doc;
}

export async function createAntiRaggingComplaint(collegeId: string, data: any, who: string) {
  const doc = await AntiRaggingComplaint.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AntiRaggingComplaint', entityId: String(doc._id), entityName: 'Anti-Ragging Complaint', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateAntiRaggingComplaint(collegeId: string, id: string, data: any, who: string) {
  const doc = await AntiRaggingComplaint.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');
  await createAuditLog({ collegeId, entityType: 'AntiRaggingComplaint', entityId: id, entityName: 'Anti-Ragging Complaint', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteAntiRaggingComplaint(collegeId: string, id: string, who: string) {
  const doc = await AntiRaggingComplaint.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Anti-ragging complaint not found');
  await createAuditLog({ collegeId, entityType: 'AntiRaggingComplaint', entityId: id, entityName: 'Anti-Ragging Complaint', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Student Grievance ═══════════════════════════════════

export async function listStudentGrievances(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(StudentGrievance, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'assignedTo'] as any);
}

export async function getStudentGrievance(collegeId: string, id: string) {
  const doc = await StudentGrievance.findOne({ _id: id, collegeId }).populate([STUDENT_POPULATE as any, 'assignedTo']);
  if (!doc) throw new AppError(404, 'Student grievance not found');
  return doc;
}

export async function createStudentGrievance(collegeId: string, data: any, who: string) {
  const doc = await StudentGrievance.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'StudentGrievance', entityId: String(doc._id), entityName: data.subject, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateStudentGrievance(collegeId: string, id: string, data: any, who: string) {
  const doc = await StudentGrievance.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Student grievance not found');
  await createAuditLog({ collegeId, entityType: 'StudentGrievance', entityId: id, entityName: doc.subject, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteStudentGrievance(collegeId: string, id: string, who: string) {
  const doc = await StudentGrievance.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Student grievance not found');
  await createAuditLog({ collegeId, entityType: 'StudentGrievance', entityId: id, entityName: doc.subject, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Insurance Claim ═════════════════════════════════════

export async function listInsuranceClaims(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });
  return paginate(InsuranceClaim, filter, page, limit, { claimDate: -1 }, ['personId']);
}

export async function getInsuranceClaim(collegeId: string, id: string) {
  const doc = await InsuranceClaim.findOne({ _id: id, collegeId }).populate('personId');
  if (!doc) throw new AppError(404, 'Insurance claim not found');
  return doc;
}

export async function createInsuranceClaim(collegeId: string, data: any, who: string) {
  const doc = await InsuranceClaim.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'InsuranceClaim', entityId: String(doc._id), entityName: data.reason, action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateInsuranceClaim(collegeId: string, id: string, data: any, who: string) {
  const doc = await InsuranceClaim.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Insurance claim not found');
  await createAuditLog({ collegeId, entityType: 'InsuranceClaim', entityId: id, entityName: doc.reason, action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteInsuranceClaim(collegeId: string, id: string, who: string) {
  const doc = await InsuranceClaim.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Insurance claim not found');
  await createAuditLog({ collegeId, entityType: 'InsuranceClaim', entityId: id, entityName: doc.reason, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Parent Meeting ══════════════════════════════════════

export async function listParentMeetings(collegeId: string, page = 1, limit = 20, status?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(ParentMeeting, filter, page, limit, { scheduledDate: -1 }, [STUDENT_POPULATE, { path: 'parentId', populate: { path: 'personId' } }, FACULTY_POPULATE] as any);
}

export async function getParentMeeting(collegeId: string, id: string) {
  const doc = await ParentMeeting.findOne({ _id: id, collegeId }).populate([STUDENT_POPULATE as any, { path: 'parentId', populate: { path: 'personId' } } as any, FACULTY_POPULATE as any]);
  if (!doc) throw new AppError(404, 'Parent meeting not found');
  return doc;
}

export async function createParentMeeting(collegeId: string, data: any, who: string) {
  const doc = await ParentMeeting.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ParentMeeting', entityId: String(doc._id), entityName: data.agenda || 'Parent Meeting', action: 'create', changes: [], performedBy: who });
  return doc;
}

export async function updateParentMeeting(collegeId: string, id: string, data: any, who: string) {
  const doc = await ParentMeeting.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Parent meeting not found');
  await createAuditLog({ collegeId, entityType: 'ParentMeeting', entityId: id, entityName: doc.agenda || 'Parent Meeting', action: 'update', changes: [], performedBy: who });
  return doc;
}

export async function deleteParentMeeting(collegeId: string, id: string, who: string) {
  const doc = await ParentMeeting.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Parent meeting not found');
  await createAuditLog({ collegeId, entityType: 'ParentMeeting', entityId: id, entityName: doc.agenda || 'Parent Meeting', action: 'delete', changes: [], performedBy: who });
  return doc;
}

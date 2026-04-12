import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createHostelBlockSchema, updateHostelBlockSchema,
  createHostelRoomSchema, updateHostelRoomSchema,
  createHostelAllocationSchema, updateHostelAllocationSchema,
  createHostelVisitorLogSchema, updateHostelVisitorLogSchema,
  createMessMenuSchema, updateMessMenuSchema,
  createMessFeedbackSchema, updateMessFeedbackSchema,
  createTransportRouteSchema, updateTransportRouteSchema,
  createTransportAllocationSchema, updateTransportAllocationSchema,
  createHealthRecordSchema, updateHealthRecordSchema,
  createMedicalVisitSchema, updateMedicalVisitSchema,
  createCounselingSessionSchema, updateCounselingSessionSchema,
  createCrisisAlertSchema, updateCrisisAlertSchema,
  createAntiRaggingComplaintSchema, updateAntiRaggingComplaintSchema,
  createStudentGrievanceSchema, updateStudentGrievanceSchema,
  createInsuranceClaimSchema, updateInsuranceClaimSchema,
  createParentMeetingSchema, updateParentMeetingSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', authorize('welfare', 'read'), ctrl.dashboardStats);

// Hostel Blocks
router.get('/hostel-blocks', authorize('welfare', 'read'), ctrl.listHostelBlocks);
router.get('/hostel-blocks/:id', authorize('welfare', 'read'), ctrl.getHostelBlock);
router.post('/hostel-blocks', authorize('welfare', 'create'), validate(createHostelBlockSchema), ctrl.createHostelBlock);
router.put('/hostel-blocks/:id', authorize('welfare', 'update'), validate(updateHostelBlockSchema), ctrl.updateHostelBlock);
router.delete('/hostel-blocks/:id', authorize('welfare', 'delete'), ctrl.deleteHostelBlock);

// Hostel Rooms
router.get('/hostel-rooms', authorize('welfare', 'read'), ctrl.listHostelRooms);
router.get('/hostel-rooms/:id', authorize('welfare', 'read'), ctrl.getHostelRoom);
router.post('/hostel-rooms', authorize('welfare', 'create'), validate(createHostelRoomSchema), ctrl.createHostelRoom);
router.put('/hostel-rooms/:id', authorize('welfare', 'update'), validate(updateHostelRoomSchema), ctrl.updateHostelRoom);
router.delete('/hostel-rooms/:id', authorize('welfare', 'delete'), ctrl.deleteHostelRoom);

// Hostel Allocations
router.get('/hostel-allocations', authorize('welfare', 'read'), ctrl.listHostelAllocations);
router.get('/hostel-allocations/:id', authorize('welfare', 'read'), ctrl.getHostelAllocation);
router.post('/hostel-allocations', authorize('welfare', 'create'), validate(createHostelAllocationSchema), ctrl.createHostelAllocation);
router.put('/hostel-allocations/:id', authorize('welfare', 'update'), validate(updateHostelAllocationSchema), ctrl.updateHostelAllocation);
router.delete('/hostel-allocations/:id', authorize('welfare', 'delete'), ctrl.deleteHostelAllocation);

// Hostel Visitor Logs
router.get('/hostel-visitor-logs', authorize('welfare', 'read'), ctrl.listHostelVisitorLogs);
router.get('/hostel-visitor-logs/:id', authorize('welfare', 'read'), ctrl.getHostelVisitorLog);
router.post('/hostel-visitor-logs', authorize('welfare', 'create'), validate(createHostelVisitorLogSchema), ctrl.createHostelVisitorLog);
router.put('/hostel-visitor-logs/:id', authorize('welfare', 'update'), validate(updateHostelVisitorLogSchema), ctrl.updateHostelVisitorLog);
router.delete('/hostel-visitor-logs/:id', authorize('welfare', 'delete'), ctrl.deleteHostelVisitorLog);

// Mess Menus
router.get('/mess-menus', authorize('welfare', 'read'), ctrl.listMessMenus);
router.get('/mess-menus/:id', authorize('welfare', 'read'), ctrl.getMessMenu);
router.post('/mess-menus', authorize('welfare', 'create'), validate(createMessMenuSchema), ctrl.createMessMenu);
router.put('/mess-menus/:id', authorize('welfare', 'update'), validate(updateMessMenuSchema), ctrl.updateMessMenu);
router.delete('/mess-menus/:id', authorize('welfare', 'delete'), ctrl.deleteMessMenu);

// Mess Feedbacks
router.get('/mess-feedbacks', authorize('welfare', 'read'), ctrl.listMessFeedbacks);
router.get('/mess-feedbacks/:id', authorize('welfare', 'read'), ctrl.getMessFeedback);
router.post('/mess-feedbacks', authorize('welfare', 'create'), validate(createMessFeedbackSchema), ctrl.createMessFeedback);
router.put('/mess-feedbacks/:id', authorize('welfare', 'update'), validate(updateMessFeedbackSchema), ctrl.updateMessFeedback);
router.delete('/mess-feedbacks/:id', authorize('welfare', 'delete'), ctrl.deleteMessFeedback);

// Transport Routes
router.get('/transport-routes', authorize('welfare', 'read'), ctrl.listTransportRoutes);
router.get('/transport-routes/:id', authorize('welfare', 'read'), ctrl.getTransportRoute);
router.post('/transport-routes', authorize('welfare', 'create'), validate(createTransportRouteSchema), ctrl.createTransportRoute);
router.put('/transport-routes/:id', authorize('welfare', 'update'), validate(updateTransportRouteSchema), ctrl.updateTransportRoute);
router.delete('/transport-routes/:id', authorize('welfare', 'delete'), ctrl.deleteTransportRoute);

// Transport Allocations
router.get('/transport-allocations', authorize('welfare', 'read'), ctrl.listTransportAllocations);
router.get('/transport-allocations/:id', authorize('welfare', 'read'), ctrl.getTransportAllocation);
router.post('/transport-allocations', authorize('welfare', 'create'), validate(createTransportAllocationSchema), ctrl.createTransportAllocation);
router.put('/transport-allocations/:id', authorize('welfare', 'update'), validate(updateTransportAllocationSchema), ctrl.updateTransportAllocation);
router.delete('/transport-allocations/:id', authorize('welfare', 'delete'), ctrl.deleteTransportAllocation);

// Health Records
router.get('/health-records', authorize('welfare', 'read'), ctrl.listHealthRecords);
router.get('/health-records/:id', authorize('welfare', 'read'), ctrl.getHealthRecord);
router.post('/health-records', authorize('welfare', 'create'), validate(createHealthRecordSchema), ctrl.createHealthRecord);
router.put('/health-records/:id', authorize('welfare', 'update'), validate(updateHealthRecordSchema), ctrl.updateHealthRecord);
router.delete('/health-records/:id', authorize('welfare', 'delete'), ctrl.deleteHealthRecord);

// Medical Visits
router.get('/medical-visits', authorize('welfare', 'read'), ctrl.listMedicalVisits);
router.get('/medical-visits/:id', authorize('welfare', 'read'), ctrl.getMedicalVisit);
router.post('/medical-visits', authorize('welfare', 'create'), validate(createMedicalVisitSchema), ctrl.createMedicalVisit);
router.put('/medical-visits/:id', authorize('welfare', 'update'), validate(updateMedicalVisitSchema), ctrl.updateMedicalVisit);
router.delete('/medical-visits/:id', authorize('welfare', 'delete'), ctrl.deleteMedicalVisit);

// Counseling Sessions
router.get('/counseling-sessions', authorize('welfare', 'read'), ctrl.listCounselingSessions);
router.get('/counseling-sessions/:id', authorize('welfare', 'read'), ctrl.getCounselingSession);
router.post('/counseling-sessions', authorize('welfare', 'create'), validate(createCounselingSessionSchema), ctrl.createCounselingSession);
router.put('/counseling-sessions/:id', authorize('welfare', 'update'), validate(updateCounselingSessionSchema), ctrl.updateCounselingSession);
router.delete('/counseling-sessions/:id', authorize('welfare', 'delete'), ctrl.deleteCounselingSession);

// Crisis Alerts
router.get('/crisis-alerts', authorize('welfare', 'read'), ctrl.listCrisisAlerts);
router.get('/crisis-alerts/:id', authorize('welfare', 'read'), ctrl.getCrisisAlert);
router.post('/crisis-alerts', authorize('welfare', 'create'), validate(createCrisisAlertSchema), ctrl.createCrisisAlert);
router.put('/crisis-alerts/:id', authorize('welfare', 'update'), validate(updateCrisisAlertSchema), ctrl.updateCrisisAlert);
router.delete('/crisis-alerts/:id', authorize('welfare', 'delete'), ctrl.deleteCrisisAlert);

// Anti-Ragging Complaints
router.get('/anti-ragging-complaints', authorize('welfare', 'read'), ctrl.listAntiRaggingComplaints);
router.get('/anti-ragging-complaints/:id', authorize('welfare', 'read'), ctrl.getAntiRaggingComplaint);
router.post('/anti-ragging-complaints', authorize('welfare', 'create'), validate(createAntiRaggingComplaintSchema), ctrl.createAntiRaggingComplaint);
router.put('/anti-ragging-complaints/:id', authorize('welfare', 'update'), validate(updateAntiRaggingComplaintSchema), ctrl.updateAntiRaggingComplaint);
router.delete('/anti-ragging-complaints/:id', authorize('welfare', 'delete'), ctrl.deleteAntiRaggingComplaint);

// Student Grievances
router.get('/student-grievances', authorize('welfare', 'read'), ctrl.listStudentGrievances);
router.get('/student-grievances/:id', authorize('welfare', 'read'), ctrl.getStudentGrievance);
router.post('/student-grievances', authorize('welfare', 'create'), validate(createStudentGrievanceSchema), ctrl.createStudentGrievance);
router.put('/student-grievances/:id', authorize('welfare', 'update'), validate(updateStudentGrievanceSchema), ctrl.updateStudentGrievance);
router.delete('/student-grievances/:id', authorize('welfare', 'delete'), ctrl.deleteStudentGrievance);

// Insurance Claims
router.get('/insurance-claims', authorize('welfare', 'read'), ctrl.listInsuranceClaims);
router.get('/insurance-claims/:id', authorize('welfare', 'read'), ctrl.getInsuranceClaim);
router.post('/insurance-claims', authorize('welfare', 'create'), validate(createInsuranceClaimSchema), ctrl.createInsuranceClaim);
router.put('/insurance-claims/:id', authorize('welfare', 'update'), validate(updateInsuranceClaimSchema), ctrl.updateInsuranceClaim);
router.delete('/insurance-claims/:id', authorize('welfare', 'delete'), ctrl.deleteInsuranceClaim);

// Parent Meetings
router.get('/parent-meetings', authorize('welfare', 'read'), ctrl.listParentMeetings);
router.get('/parent-meetings/:id', authorize('welfare', 'read'), ctrl.getParentMeeting);
router.post('/parent-meetings', authorize('welfare', 'create'), validate(createParentMeetingSchema), ctrl.createParentMeeting);
router.put('/parent-meetings/:id', authorize('welfare', 'update'), validate(updateParentMeetingSchema), ctrl.updateParentMeeting);
router.delete('/parent-meetings/:id', authorize('welfare', 'delete'), ctrl.deleteParentMeeting);

export default router;

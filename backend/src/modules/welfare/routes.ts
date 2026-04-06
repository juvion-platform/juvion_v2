import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
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
router.get('/stats', ctrl.dashboardStats);

// Hostel Blocks
router.get('/hostel-blocks', ctrl.listHostelBlocks);
router.get('/hostel-blocks/:id', ctrl.getHostelBlock);
router.post('/hostel-blocks', validate(createHostelBlockSchema), ctrl.createHostelBlock);
router.put('/hostel-blocks/:id', validate(updateHostelBlockSchema), ctrl.updateHostelBlock);
router.delete('/hostel-blocks/:id', ctrl.deleteHostelBlock);

// Hostel Rooms
router.get('/hostel-rooms', ctrl.listHostelRooms);
router.get('/hostel-rooms/:id', ctrl.getHostelRoom);
router.post('/hostel-rooms', validate(createHostelRoomSchema), ctrl.createHostelRoom);
router.put('/hostel-rooms/:id', validate(updateHostelRoomSchema), ctrl.updateHostelRoom);
router.delete('/hostel-rooms/:id', ctrl.deleteHostelRoom);

// Hostel Allocations
router.get('/hostel-allocations', ctrl.listHostelAllocations);
router.get('/hostel-allocations/:id', ctrl.getHostelAllocation);
router.post('/hostel-allocations', validate(createHostelAllocationSchema), ctrl.createHostelAllocation);
router.put('/hostel-allocations/:id', validate(updateHostelAllocationSchema), ctrl.updateHostelAllocation);
router.delete('/hostel-allocations/:id', ctrl.deleteHostelAllocation);

// Hostel Visitor Logs
router.get('/hostel-visitor-logs', ctrl.listHostelVisitorLogs);
router.get('/hostel-visitor-logs/:id', ctrl.getHostelVisitorLog);
router.post('/hostel-visitor-logs', validate(createHostelVisitorLogSchema), ctrl.createHostelVisitorLog);
router.put('/hostel-visitor-logs/:id', validate(updateHostelVisitorLogSchema), ctrl.updateHostelVisitorLog);
router.delete('/hostel-visitor-logs/:id', ctrl.deleteHostelVisitorLog);

// Mess Menus
router.get('/mess-menus', ctrl.listMessMenus);
router.get('/mess-menus/:id', ctrl.getMessMenu);
router.post('/mess-menus', validate(createMessMenuSchema), ctrl.createMessMenu);
router.put('/mess-menus/:id', validate(updateMessMenuSchema), ctrl.updateMessMenu);
router.delete('/mess-menus/:id', ctrl.deleteMessMenu);

// Mess Feedbacks
router.get('/mess-feedbacks', ctrl.listMessFeedbacks);
router.get('/mess-feedbacks/:id', ctrl.getMessFeedback);
router.post('/mess-feedbacks', validate(createMessFeedbackSchema), ctrl.createMessFeedback);
router.put('/mess-feedbacks/:id', validate(updateMessFeedbackSchema), ctrl.updateMessFeedback);
router.delete('/mess-feedbacks/:id', ctrl.deleteMessFeedback);

// Transport Routes
router.get('/transport-routes', ctrl.listTransportRoutes);
router.get('/transport-routes/:id', ctrl.getTransportRoute);
router.post('/transport-routes', validate(createTransportRouteSchema), ctrl.createTransportRoute);
router.put('/transport-routes/:id', validate(updateTransportRouteSchema), ctrl.updateTransportRoute);
router.delete('/transport-routes/:id', ctrl.deleteTransportRoute);

// Transport Allocations
router.get('/transport-allocations', ctrl.listTransportAllocations);
router.get('/transport-allocations/:id', ctrl.getTransportAllocation);
router.post('/transport-allocations', validate(createTransportAllocationSchema), ctrl.createTransportAllocation);
router.put('/transport-allocations/:id', validate(updateTransportAllocationSchema), ctrl.updateTransportAllocation);
router.delete('/transport-allocations/:id', ctrl.deleteTransportAllocation);

// Health Records
router.get('/health-records', ctrl.listHealthRecords);
router.get('/health-records/:id', ctrl.getHealthRecord);
router.post('/health-records', validate(createHealthRecordSchema), ctrl.createHealthRecord);
router.put('/health-records/:id', validate(updateHealthRecordSchema), ctrl.updateHealthRecord);
router.delete('/health-records/:id', ctrl.deleteHealthRecord);

// Medical Visits
router.get('/medical-visits', ctrl.listMedicalVisits);
router.get('/medical-visits/:id', ctrl.getMedicalVisit);
router.post('/medical-visits', validate(createMedicalVisitSchema), ctrl.createMedicalVisit);
router.put('/medical-visits/:id', validate(updateMedicalVisitSchema), ctrl.updateMedicalVisit);
router.delete('/medical-visits/:id', ctrl.deleteMedicalVisit);

// Counseling Sessions
router.get('/counseling-sessions', ctrl.listCounselingSessions);
router.get('/counseling-sessions/:id', ctrl.getCounselingSession);
router.post('/counseling-sessions', validate(createCounselingSessionSchema), ctrl.createCounselingSession);
router.put('/counseling-sessions/:id', validate(updateCounselingSessionSchema), ctrl.updateCounselingSession);
router.delete('/counseling-sessions/:id', ctrl.deleteCounselingSession);

// Crisis Alerts
router.get('/crisis-alerts', ctrl.listCrisisAlerts);
router.get('/crisis-alerts/:id', ctrl.getCrisisAlert);
router.post('/crisis-alerts', validate(createCrisisAlertSchema), ctrl.createCrisisAlert);
router.put('/crisis-alerts/:id', validate(updateCrisisAlertSchema), ctrl.updateCrisisAlert);
router.delete('/crisis-alerts/:id', ctrl.deleteCrisisAlert);

// Anti-Ragging Complaints
router.get('/anti-ragging-complaints', ctrl.listAntiRaggingComplaints);
router.get('/anti-ragging-complaints/:id', ctrl.getAntiRaggingComplaint);
router.post('/anti-ragging-complaints', validate(createAntiRaggingComplaintSchema), ctrl.createAntiRaggingComplaint);
router.put('/anti-ragging-complaints/:id', validate(updateAntiRaggingComplaintSchema), ctrl.updateAntiRaggingComplaint);
router.delete('/anti-ragging-complaints/:id', ctrl.deleteAntiRaggingComplaint);

// Student Grievances
router.get('/student-grievances', ctrl.listStudentGrievances);
router.get('/student-grievances/:id', ctrl.getStudentGrievance);
router.post('/student-grievances', validate(createStudentGrievanceSchema), ctrl.createStudentGrievance);
router.put('/student-grievances/:id', validate(updateStudentGrievanceSchema), ctrl.updateStudentGrievance);
router.delete('/student-grievances/:id', ctrl.deleteStudentGrievance);

// Insurance Claims
router.get('/insurance-claims', ctrl.listInsuranceClaims);
router.get('/insurance-claims/:id', ctrl.getInsuranceClaim);
router.post('/insurance-claims', validate(createInsuranceClaimSchema), ctrl.createInsuranceClaim);
router.put('/insurance-claims/:id', validate(updateInsuranceClaimSchema), ctrl.updateInsuranceClaim);
router.delete('/insurance-claims/:id', ctrl.deleteInsuranceClaim);

// Parent Meetings
router.get('/parent-meetings', ctrl.listParentMeetings);
router.get('/parent-meetings/:id', ctrl.getParentMeeting);
router.post('/parent-meetings', validate(createParentMeetingSchema), ctrl.createParentMeeting);
router.put('/parent-meetings/:id', validate(updateParentMeetingSchema), ctrl.updateParentMeeting);
router.delete('/parent-meetings/:id', ctrl.deleteParentMeeting);

export default router;

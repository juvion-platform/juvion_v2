import { z } from 'zod';

// ═══ Hostel Block ════════════════════════════════════════
export const createHostelBlockSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['boys', 'girls']),
  totalRooms: z.number().int().min(0),
  wardenId: z.string().optional(),
  isActive: z.boolean().optional(),
});
export const updateHostelBlockSchema = createHostelBlockSchema.partial();

// ═══ Hostel Room ═════════════════════════════════════════
export const createHostelRoomSchema = z.object({
  blockId: z.string().min(1),
  roomNumber: z.string().min(1),
  floor: z.number().int().min(0),
  capacity: z.number().int().min(1),
  occupancy: z.number().int().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  status: z.enum(['available', 'full', 'maintenance', 'reserved']).optional(),
});
export const updateHostelRoomSchema = createHostelRoomSchema.partial();

// ═══ Hostel Allocation ═══════════════════════════════════
export const createHostelAllocationSchema = z.object({
  studentId: z.string().min(1),
  roomId: z.string().min(1),
  academicYearId: z.string().min(1),
  allocatedDate: z.string().optional(),
  vacatedDate: z.string().optional(),
  status: z.enum(['active', 'vacated', 'transferred']).optional(),
});
export const updateHostelAllocationSchema = createHostelAllocationSchema.partial();

// ═══ Hostel Visitor Log ══════════════════════════════════
export const createHostelVisitorLogSchema = z.object({
  studentId: z.string().min(1),
  visitorName: z.string().min(1),
  visitorRelation: z.string().min(1),
  visitorPhone: z.string().min(1),
  inTime: z.string().optional(),
  outTime: z.string().optional(),
  purpose: z.string().min(1),
});
export const updateHostelVisitorLogSchema = createHostelVisitorLogSchema.partial();

// ═══ Mess Menu ═══════════════════════════════════════════
export const createMessMenuSchema = z.object({
  blockId: z.string().optional(),
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  meals: z.array(z.object({
    type: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']),
    items: z.array(z.string()),
  })).optional(),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional(),
});
export const updateMessMenuSchema = createMessMenuSchema.partial();

// ═══ Mess Feedback ═══════════════════════════════════════
export const createMessFeedbackSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().min(1),
  mealType: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']),
  rating: z.number().int().min(1).max(5),
  comments: z.string().optional(),
});
export const updateMessFeedbackSchema = createMessFeedbackSchema.partial();

// ═══ Transport Route ═════════════════════════════════════
export const createTransportRouteSchema = z.object({
  routeNumber: z.string().min(1),
  name: z.string().min(1),
  stops: z.array(z.object({
    name: z.string().min(1),
    pickupTime: z.string(),
    dropTime: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })).optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  capacity: z.number().int().min(1),
  isActive: z.boolean().optional(),
});
export const updateTransportRouteSchema = createTransportRouteSchema.partial();

// ═══ Transport Allocation ════════════════════════════════
export const createTransportAllocationSchema = z.object({
  studentId: z.string().min(1),
  routeId: z.string().min(1),
  stopName: z.string().min(1),
  academicYearId: z.string().min(1),
  status: z.enum(['active', 'cancelled']).optional(),
});
export const updateTransportAllocationSchema = createTransportAllocationSchema.partial();

// ═══ Health Record ═══════════════════════════════════════
export const createHealthRecordSchema = z.object({
  personId: z.string().min(1),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional(),
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  emergencyContact: z.string().min(1),
  emergencyPhone: z.string().min(1),
  insuranceId: z.string().optional(),
});
export const updateHealthRecordSchema = createHealthRecordSchema.partial();

// ═══ Medical Visit ═══════════════════════════════════════
export const createMedicalVisitSchema = z.object({
  personId: z.string().min(1),
  visitDate: z.string().optional(),
  complaint: z.string().min(1),
  diagnosis: z.string().optional(),
  prescription: z.string().optional(),
  referredTo: z.string().optional(),
  attendedBy: z.string().min(1),
  followUpDate: z.string().optional(),
});
export const updateMedicalVisitSchema = createMedicalVisitSchema.partial();

// ═══ Counseling Session ══════════════════════════════════
export const createCounselingSessionSchema = z.object({
  studentId: z.string().min(1),
  counselorId: z.string().min(1),
  sessionDate: z.string().min(1),
  type: z.enum(['academic', 'personal', 'career', 'crisis', 'follow_up']),
  notes: z.string().optional(),
  followUpRequired: z.boolean().optional(),
  nextSessionDate: z.string().optional(),
});
export const updateCounselingSessionSchema = createCounselingSessionSchema.partial();

// ═══ Crisis Alert ════════════════════════════════════════
export const createCrisisAlertSchema = z.object({
  reportedBy: z.string().min(1),
  studentId: z.string().optional(),
  type: z.enum(['mental_health', 'ragging', 'harassment', 'medical_emergency', 'substance_abuse', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1),
  status: z.enum(['reported', 'acknowledged', 'in_progress', 'resolved', 'escalated']).optional(),
  assignedTo: z.string().optional(),
  resolution: z.string().optional(),
  resolvedAt: z.string().optional(),
});
export const updateCrisisAlertSchema = createCrisisAlertSchema.partial();

// ═══ Anti-Ragging Complaint ══════════════════════════════
export const createAntiRaggingComplaintSchema = z.object({
  complainantId: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  accusedIds: z.array(z.string()).optional(),
  description: z.string().min(1),
  incidentDate: z.string().min(1),
  severity: z.enum(['minor', 'major', 'severe']),
  status: z.enum(['filed', 'investigating', 'action_taken', 'closed']).optional(),
  committeeRemarks: z.string().optional(),
  actionTaken: z.string().optional(),
});
export const updateAntiRaggingComplaintSchema = createAntiRaggingComplaintSchema.partial();

// ═══ Student Grievance ═══════════════════════════════════
export const createStudentGrievanceSchema = z.object({
  studentId: z.string().min(1),
  category: z.enum(['academic', 'hostel', 'mess', 'transport', 'infrastructure', 'fee', 'other']),
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assignedTo: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  resolution: z.string().optional(),
  resolvedAt: z.string().optional(),
});
export const updateStudentGrievanceSchema = createStudentGrievanceSchema.partial();

// ═══ Insurance Claim ═════════════════════════════════════
export const createInsuranceClaimSchema = z.object({
  personId: z.string().min(1),
  insuranceProvider: z.string().min(1),
  policyNumber: z.string().min(1),
  claimAmount: z.number().min(0),
  reason: z.string().min(1),
  claimDate: z.string().optional(),
  status: z.enum(['filed', 'processing', 'approved', 'rejected', 'settled']).optional(),
  settledAmount: z.number().min(0).optional(),
});
export const updateInsuranceClaimSchema = createInsuranceClaimSchema.partial();

// ═══ Parent Meeting ══════════════════════════════════════
export const createParentMeetingSchema = z.object({
  studentId: z.string().min(1),
  parentId: z.string().min(1),
  facultyId: z.string().min(1),
  scheduledDate: z.string().min(1),
  agenda: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).optional(),
});
export const updateParentMeetingSchema = createParentMeetingSchema.partial();

import { z } from 'zod';

// ═══ Announcement ══════════════════════════════════════════

export const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.enum(['general', 'academic', 'exam', 'placement', 'event', 'hostel', 'sports', 'other']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  postedBy: z.string().min(1),
  targetAudience: z.enum(['all', 'students', 'faculty', 'staff', 'parents']),
  attachmentUrl: z.string().optional(),
  isPinned: z.boolean().optional(),
  expiryDate: z.string().optional(),
});
export const updateAnnouncementSchema = createAnnouncementSchema.partial();

// ═══ Circular ══════════════════════════════════════════════

export const createCircularSchema = z.object({
  circularNumber: z.string().min(1),
  title: z.string().min(1),
  content: z.string().optional(),
  issuedBy: z.string().min(1),
  department: z.string().optional(),
  targetAudience: z.enum(['all', 'students', 'faculty', 'staff', 'parents']),
  documentUrl: z.string().optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
});
export const updateCircularSchema = createCircularSchema.partial();

// ═══ Notification ══════════════════════════════════════════

export const createNotificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['info', 'alert', 'reminder', 'emergency', 'announcement']),
  targetAudience: z.enum(['all', 'students', 'faculty', 'staff', 'parents', 'department', 'section', 'individual']),
  targetIds: z.array(z.string()).optional(),
  channel: z.enum(['app', 'sms', 'email', 'whatsapp', 'push']),
  sentAt: z.string().optional(),
  scheduledAt: z.string().optional(),
  sentBy: z.string().min(1),
  status: z.enum(['draft', 'scheduled', 'sent', 'failed']).optional(),
});
export const updateNotificationSchema = createNotificationSchema.partial();

// ═══ Feedback Survey ═══════════════════════════════════════

export const createFeedbackSurveySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetAudience: z.enum(['students', 'faculty', 'staff', 'parents', 'alumni', 'all']),
  questions: z.array(z.object({
    text: z.string().min(1),
    type: z.enum(['rating', 'text', 'mcq', 'checkbox', 'scale']),
    options: z.array(z.string()).optional(),
    isRequired: z.boolean().optional(),
  })),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  createdBy: z.string().min(1),
  status: z.enum(['draft', 'active', 'closed', 'analyzed']).optional(),
});
export const updateFeedbackSurveySchema = createFeedbackSurveySchema.partial();

// ═══ Survey Response ═══════════════════════════════════════

export const createSurveyResponseSchema = z.object({
  surveyId: z.string().min(1),
  respondentId: z.string().min(1),
  answers: z.array(z.object({
    questionIndex: z.number().int().min(0),
    answer: z.any(),
  })),
  submittedAt: z.string().optional(),
});
export const updateSurveyResponseSchema = createSurveyResponseSchema.partial();

// ═══ Email Log ═════════════════════════════════════════════

export const createEmailLogSchema = z.object({
  recipientEmail: z.string().email(),
  recipientId: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().optional(),
  status: z.enum(['queued', 'sent', 'delivered', 'opened', 'bounced', 'failed']).optional(),
  sentAt: z.string().optional(),
  openedAt: z.string().optional(),
});
export const updateEmailLogSchema = createEmailLogSchema.partial();

// ═══ SMS Log ═══════════════════════════════════════════════

export const createSMSLogSchema = z.object({
  recipientPhone: z.string().min(1),
  recipientId: z.string().optional(),
  message: z.string().min(1),
  templateId: z.string().optional(),
  provider: z.string().optional(),
  status: z.enum(['queued', 'sent', 'delivered', 'failed', 'bounced']).optional(),
  sentAt: z.string().optional(),
  deliveredAt: z.string().optional(),
  cost: z.number().optional(),
});
export const updateSMSLogSchema = createSMSLogSchema.partial();

// ═══ WhatsApp Log ══════════════════════════════════════════

export const createWhatsAppLogSchema = z.object({
  recipientPhone: z.string().min(1),
  recipientId: z.string().optional(),
  templateName: z.string().optional(),
  message: z.string().optional(),
  mediaUrl: z.string().optional(),
  status: z.enum(['queued', 'sent', 'delivered', 'read', 'failed']).optional(),
  sentAt: z.string().optional(),
});
export const updateWhatsAppLogSchema = createWhatsAppLogSchema.partial();

// ═══ RBAC Policy ═══════════════════════════════════════════

export const createRbacPolicySchema = z.object({
  role: z.enum(['super_admin', 'admin', 'principal', 'hod', 'faculty', 'staff', 'student', 'parent', '*']),
  personaType: z.string().optional().nullable(),
  module: z.string().min(1),
  action: z.enum(['read', 'create', 'update', 'delete', 'approve', '*']),
  effect: z.enum(['allow', 'deny']),
  scope: z.object({
    departmentOnly: z.boolean().optional(),
    selfOnly: z.boolean().optional(),
    subDomain: z.string().optional(),
  }).optional(),
  priority: z.number().int().min(1).max(999),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateRbacPolicySchema = createRbacPolicySchema.partial();

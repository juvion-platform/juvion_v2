import { Schema, model, Document, Types } from 'mongoose';

export type AudienceRuleKind = 'all' | 'role' | 'department' | 'programme' | 'batch' | 'section' | 'course_offering' | 'hostel_block' | 'custom';
export type NoticePriority = 'routine' | 'important' | 'urgent';
export type NoticePurpose = 'standard' | 'welcome';
export type NoticeStatus = 'publishing' | 'published' | 'archived';

export const AUDIENCE_RULE_KINDS: readonly AudienceRuleKind[] = ['all', 'role', 'department', 'programme', 'batch', 'section', 'course_offering', 'hostel_block', 'custom'];
export const NOTICE_PRIORITIES: readonly NoticePriority[] = ['routine', 'important', 'urgent'];
export const NOTICE_PURPOSES: readonly NoticePurpose[] = ['standard', 'welcome'];
export const NOTICE_STATUSES: readonly NoticeStatus[] = ['publishing', 'published', 'archived'];
export const NOTICE_TITLE_MAX = 120;
export const NOTICE_BODY_MAX = 5000;
export const NOTICE_ATTACHMENTS_MAX = 5;
export const NOTICE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const NOTICE_REMINDERS_MAX = 2;
/** PDF, PNG, JPEG, WEBP, DOCX, XLSX, PPTX (spec §6.1). */
export const NOTICE_ATTACHMENT_MIMES: readonly string[] = [
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

/**
 * `ids` are hex ObjectIds for every kind except `role`, whose ids are `student | faculty | staff | hod` or a persona code.
 * `departmentId` only applies to `role`: it limits the rule to members of that department (an HOD's `role` rule, spec §7.3).
 */
export interface IAudienceRule { kind: AudienceRuleKind; ids: string[]; departmentId?: string }
export interface INoticeAttachment { key: string; name: string; mime: string; size: number }
/** `personId`/`userId` are absent on the system-created default welcome notice. */
export interface INoticePublisher { personId?: Types.ObjectId; userId?: Types.ObjectId; office: string }
export interface INoticeReminder { at: Date; by: string }

export interface INotice extends Document {
  collegeId: Types.ObjectId;
  title: string;
  body: string;
  attachments: INoticeAttachment[];
  publisher: INoticePublisher;
  audience: { rules: IAudienceRule[]; line: string };
  channelIds: Types.ObjectId[];
  ackRequired: boolean;
  ackDeadline?: Date | null;
  ackCommentAllowed: boolean;
  priority: NoticePriority;
  purpose: NoticePurpose;
  status: NoticeStatus;
  counts: { audience: number; onJuvi: number };
  reminders: INoticeReminder[];
  publishedAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ruleSchema = new Schema<IAudienceRule>(
  { kind: { type: String, enum: AUDIENCE_RULE_KINDS, required: true }, ids: { type: [String], default: [] }, departmentId: String },
  { _id: false },
);
const attachmentSchema = new Schema<INoticeAttachment>(
  { key: { type: String, required: true }, name: { type: String, required: true }, mime: { type: String, required: true }, size: { type: Number, required: true, min: 0 } },
  { _id: false },
);
const reminderSchema = new Schema<INoticeReminder>({ at: { type: Date, required: true }, by: { type: String, required: true } }, { _id: false });

const schema = new Schema<INotice>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: NOTICE_TITLE_MAX },
    body: { type: String, required: true, maxlength: NOTICE_BODY_MAX },
    attachments: {
      type: [attachmentSchema], default: [],
      validate: { validator: (v: unknown[]) => v.length <= NOTICE_ATTACHMENTS_MAX, message: `At most ${NOTICE_ATTACHMENTS_MAX} attachments` },
    },
    publisher: {
      personId: { type: Schema.Types.ObjectId, ref: 'Person' },
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      office: { type: String, required: true },
    },
    audience: { rules: { type: [ruleSchema], default: [] }, line: { type: String, default: '' } },
    channelIds: { type: [Schema.Types.ObjectId], default: [] },
    ackRequired: { type: Boolean, default: false },
    ackDeadline: { type: Date, default: null },
    ackCommentAllowed: { type: Boolean, default: false },
    priority: { type: String, enum: NOTICE_PRIORITIES, default: 'routine' },
    purpose: { type: String, enum: NOTICE_PURPOSES, default: 'standard' },
    status: { type: String, enum: NOTICE_STATUSES, required: true, default: 'publishing' },
    counts: { audience: { type: Number, default: 0 }, onJuvi: { type: Number, default: 0 } },
    reminders: {
      type: [reminderSchema], default: [],
      validate: { validator: (v: unknown[]) => v.length <= NOTICE_REMINDERS_MAX, message: `At most ${NOTICE_REMINDERS_MAX} reminders` },
    },
    publishedAt: Date,
    archivedAt: Date,
  },
  { timestamps: true },
);

// A deadline only makes sense on an acknowledgement notice (spec §5).
schema.pre('validate', function (next) {
  if (this.ackDeadline && !this.ackRequired) this.invalidate('ackDeadline', 'A deadline requires ackRequired');
  next();
});

schema.index({ collegeId: 1, status: 1, publishedAt: -1 });
schema.index({ collegeId: 1, 'publisher.userId': 1, publishedAt: -1 });
schema.index({ collegeId: 1, channelIds: 1 });

/** A lean read of a Notice: fields only, no Document methods. */
export type LeanNotice = Omit<INotice, keyof Document> & { _id: Types.ObjectId };

export const Notice = model<INotice>('Notice', schema);

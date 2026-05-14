import { Schema, model, Document, Types } from 'mongoose';

/**
 * MoocSubject — UGC-permitted MOOC course equivalents that students
 * can register for online credit transfer in lieu of (or alongside)
 * a regular course. Strategic Gap 6 Phase A.
 *
 * The provider/url/credits triple defines the external course; the
 * `equivalentCourseId` links to the internal Course the credits map
 * to. The MOOC-credit-transfer workflow (Phase B) consumes this
 * catalog to validate student MOOC enrollments.
 */
export interface IMoocSubject extends Document {
  collegeId: Types.ObjectId;
  code: string;
  title: string;
  provider: 'NPTEL' | 'SWAYAM' | 'Coursera' | 'edX' | 'Udemy' | 'other';
  providerCourseCode?: string;
  providerUrl?: string;
  credits: number;
  durationWeeks?: number;
  equivalentCourseId?: Types.ObjectId;
  /** Faculty mentor at the institution (if assigned for proctoring). */
  mentorPersonId?: Types.ObjectId;
  /** UGC approval reference, if any. */
  ugcApprovalRef?: string;
  status: 'active' | 'inactive' | 'pending_approval';
}

const schema = new Schema<IMoocSubject>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    provider: { type: String, enum: ['NPTEL', 'SWAYAM', 'Coursera', 'edX', 'Udemy', 'other'], required: true },
    providerCourseCode: { type: String, trim: true },
    providerUrl: { type: String, trim: true },
    credits: { type: Number, required: true, min: 0 },
    durationWeeks: { type: Number, min: 0 },
    equivalentCourseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    mentorPersonId: { type: Schema.Types.ObjectId, ref: 'Person' },
    ugcApprovalRef: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive', 'pending_approval'], default: 'active' },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1, code: 1 }, { unique: true });
schema.index({ collegeId: 1, status: 1 });

export const MoocSubject = model<IMoocSubject>('MoocSubject', schema);

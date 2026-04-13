import { Schema, model, Document } from 'mongoose';

export interface IHallTicket extends Document {
  collegeId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  semesterId: Schema.Types.ObjectId;
  hallTicketNumber: string;
  examType: string;
  courses: {
    courseId: Schema.Types.ObjectId;
    examDate?: Date;
    venue?: string;
  }[];
  eligibilityStatus: string;
  reasons?: string[];
  issuedAt?: Date;
  status: string;
}

const schema = new Schema<IHallTicket>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  hallTicketNumber: { type: String, required: true },
  examType: { type: String, enum: ['regular', 'supplementary', 'improvement'], required: true },
  courses: [{
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    examDate: Date,
    venue: String,
  }],
  eligibilityStatus: { type: String, enum: ['eligible', 'ineligible', 'conditional'], required: true },
  reasons: [String],
  issuedAt: Date,
  status: { type: String, enum: ['draft', 'issued', 'revoked'], default: 'draft' },
}, { timestamps: true });

schema.index({ collegeId: 1, studentId: 1, semesterId: 1 }, { unique: true });
schema.index({ collegeId: 1, hallTicketNumber: 1 }, { unique: true });

export const HallTicket = model<IHallTicket>('HallTicket', schema);

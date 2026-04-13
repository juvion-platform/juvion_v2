import { Schema, model, Document } from 'mongoose';

export interface IAcademicCalendar extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId: Schema.Types.ObjectId; title: string; eventType: string; startDate: Date; endDate: Date; description?: string; isHoliday: boolean;
  status?: string;
  approvedBy?: Schema.Types.ObjectId;
}

const schema = new Schema<IAcademicCalendar>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  title: { type: String, required: true },
  eventType: { type: String, enum: ['instruction', 'exam', 'holiday', 'event', 'registration', 'result'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  description: String,
  isHoliday: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.index({ collegeId: 1, academicYearId: 1, startDate: 1 });

export const AcademicCalendar = model<IAcademicCalendar>('AcademicCalendar', schema);

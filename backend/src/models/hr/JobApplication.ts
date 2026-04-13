import { Schema, model, Document } from 'mongoose';

export interface IInterviewScore {
  panelMemberId: string;
  score: number;
  remarks: string;
}

export interface IJobApplication extends Document {
  collegeId: Schema.Types.ObjectId;
  recruitmentId: Schema.Types.ObjectId; applicantName: string; email: string; phone: string; resumeUrl?: string; experience?: number; currentDesignation?: string; status: string; interviewDate?: Date; interviewRemarks?: string;
  qualificationDetails?: Record<string, unknown>;
  aiScreeningScore?: number;
  aiScreeningRationale?: string;
  interviewScores?: IInterviewScore[];
  demoLectureScore?: number;
  overallRank?: number;
  appointmentOrderId?: Schema.Types.ObjectId;
}

const schema = new Schema<IJobApplication>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  recruitmentId: { type: Schema.Types.ObjectId, ref: 'Recruitment', required: true },
  applicantName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  resumeUrl: String,
  experience: Number,
  currentDesignation: String,
  status: { type: String, enum: ['applied', 'shortlisted', 'interview', 'selected', 'rejected', 'joined'], default: 'applied' },
  interviewDate: Date,
  interviewRemarks: String,
  qualificationDetails: { type: Schema.Types.Mixed },
  aiScreeningScore: Number,
  aiScreeningRationale: String,
  interviewScores: [new Schema({ panelMemberId: { type: String, required: true }, score: { type: Number, required: true }, remarks: { type: String, required: true } }, { _id: false })],
  demoLectureScore: Number,
  overallRank: Number,
  appointmentOrderId: { type: Schema.Types.ObjectId, ref: 'AppointmentOrder' },
}, { timestamps: true });

schema.index({ collegeId: 1, recruitmentId: 1, status: 1 });

export const JobApplication = model<IJobApplication>('JobApplication', schema);

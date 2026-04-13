import { Schema, model, Document } from 'mongoose';

export interface IRecruitment extends Document {
  collegeId: Schema.Types.ObjectId;
  position: string; departmentId: Schema.Types.ObjectId; vacancies: number; qualifications: string; experience?: string; salary?: string; postedDate: Date; lastDate: Date; status: string;
  positionType?: string;
  requisitionId?: Schema.Types.ObjectId;
  selectionCommitteeId?: Schema.Types.ObjectId;
  aicteCompliant?: boolean;
}

const schema = new Schema<IRecruitment>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  position: { type: String, required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  vacancies: { type: Number, required: true },
  qualifications: { type: String, required: true },
  experience: String,
  salary: String,
  postedDate: { type: Date, default: Date.now },
  lastDate: { type: Date, required: true },
  status: { type: String, enum: ['open', 'closed', 'on_hold', 'filled'], default: 'open' },
  positionType: { type: String, enum: ['faculty', 'staff'] },
  requisitionId: { type: Schema.Types.ObjectId, ref: 'HiringRequisition' },
  selectionCommitteeId: { type: Schema.Types.ObjectId, ref: 'SelectionCommittee' },
  aicteCompliant: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });

export const Recruitment = model<IRecruitment>('Recruitment', schema);

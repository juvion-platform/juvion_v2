import { Schema, model, Document } from 'mongoose';

export interface ISalaryDetails {
  basic: number;
  hra: number;
  da: number;
  totalCTC: number;
}

export interface IAppointmentOrder extends Document {
  collegeId: Schema.Types.ObjectId;
  recruitmentId: Schema.Types.ObjectId;
  jobApplicationId: Schema.Types.ObjectId;
  candidateName: string;
  designation: string;
  departmentId: Schema.Types.ObjectId;
  salaryDetails: ISalaryDetails;
  probationMonths: number;
  noticePeriodDays: number;
  contractType: 'permanent' | 'contract' | 'adhoc';
  contractEndDate?: Date;
  reportingToId?: Schema.Types.ObjectId;
  joiningDate: Date;
  status: 'draft' | 'approved' | 'issued' | 'accepted' | 'declined' | 'expired';
  issuedAt?: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  acceptanceDeadline?: Date;
}

const salaryDetailsSchema = new Schema({
  basic: { type: Number, required: true },
  hra: { type: Number, required: true },
  da: { type: Number, required: true },
  totalCTC: { type: Number, required: true },
}, { _id: false });

const schema = new Schema<IAppointmentOrder>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  recruitmentId: { type: Schema.Types.ObjectId, ref: 'Recruitment', required: true },
  jobApplicationId: { type: Schema.Types.ObjectId, ref: 'JobApplication', required: true },
  candidateName: { type: String, required: true },
  designation: { type: String, required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  salaryDetails: { type: salaryDetailsSchema, required: true },
  probationMonths: { type: Number, required: true },
  noticePeriodDays: { type: Number, required: true },
  contractType: { type: String, enum: ['permanent', 'contract', 'adhoc'], required: true },
  contractEndDate: Date,
  reportingToId: { type: Schema.Types.ObjectId, ref: 'Employee' },
  joiningDate: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'approved', 'issued', 'accepted', 'declined', 'expired'], default: 'draft' },
  issuedAt: Date,
  acceptedAt: Date,
  declinedAt: Date,
  acceptanceDeadline: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, status: 1 });
schema.index({ collegeId: 1, recruitmentId: 1 });

export const AppointmentOrder = model<IAppointmentOrder>('AppointmentOrder', schema);

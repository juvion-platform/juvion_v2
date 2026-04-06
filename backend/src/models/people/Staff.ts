import { Schema, model, Document } from 'mongoose';

export interface IStaff extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId; employeeCode: string; designation: string; departmentId?: Schema.Types.ObjectId; staffType: string; status: string;
}

const schema = new Schema<IStaff>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  employeeCode: { type: String, required: true },
  designation: { type: String, required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  staffType: { type: String, required: true },
  status: { type: String, enum: ['active', 'on_leave', 'separated'], default: 'active' },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeCode: 1 }, { unique: true });

export const Staff = model<IStaff>('Staff', schema);

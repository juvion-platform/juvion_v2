import { Schema, model, Document } from 'mongoose';

export interface IEmployee extends Document {
  collegeId: Schema.Types.ObjectId;
  personId: Schema.Types.ObjectId; employeeId: string; departmentId: Schema.Types.ObjectId; designation: string; employeeType: string; joiningDate: Date; reportingToId?: Schema.Types.ObjectId; status: string;
}

const schema = new Schema<IEmployee>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  employeeId: { type: String, required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  designation: { type: String, required: true },
  employeeType: { type: String, enum: ['teaching', 'non_teaching', 'contract', 'visiting', 'adjunct'], required: true },
  joiningDate: { type: Date, required: true },
  reportingToId: { type: Schema.Types.ObjectId, ref: 'Employee' },
  status: { type: String, enum: ['active', 'on_leave', 'resigned', 'retired', 'terminated'], default: 'active' },
}, { timestamps: true });

schema.index({ collegeId: 1, employeeId: 1 }, { unique: true });

export const Employee = model<IEmployee>('Employee', schema);

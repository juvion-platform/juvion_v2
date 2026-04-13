import { Schema, model, Document } from 'mongoose';

export interface ICommitteeMember {
  personId: string;
  role: string;
  isExternal: boolean;
  isAICTENominee: boolean;
  isSCSTRep: boolean;
}

export interface ISelectionCommittee extends Document {
  collegeId: Schema.Types.ObjectId;
  requisitionId: Schema.Types.ObjectId;
  recruitmentId?: Schema.Types.ObjectId;
  committeeType: 'aicte_faculty' | 'internal_staff';
  members: ICommitteeMember[];
  status: 'constituted' | 'active' | 'dissolved';
  constitutedAt: Date;
}

const committeeMemberSchema = new Schema({
  personId: { type: String, required: true },
  role: { type: String, required: true },
  isExternal: { type: Boolean, default: false },
  isAICTENominee: { type: Boolean, default: false },
  isSCSTRep: { type: Boolean, default: false },
}, { _id: false });

const schema = new Schema<ISelectionCommittee>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  requisitionId: { type: Schema.Types.ObjectId, ref: 'HiringRequisition', required: true },
  recruitmentId: { type: Schema.Types.ObjectId, ref: 'Recruitment' },
  committeeType: { type: String, enum: ['aicte_faculty', 'internal_staff'], required: true },
  members: [committeeMemberSchema],
  status: { type: String, enum: ['constituted', 'active', 'dissolved'], default: 'constituted' },
  constitutedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ collegeId: 1, requisitionId: 1 });

export const SelectionCommittee = model<ISelectionCommittee>('SelectionCommittee', schema);

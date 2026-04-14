import { Schema, model, Document } from 'mongoose';

export interface ISignatureSlot {
  role: string;
  position: string;
}

export interface IDocumentTemplate extends Document {
  collegeId: Schema.Types.ObjectId;
  type: string;
  name: string;
  version: string;
  templateUrl?: string;
  placeholders: string[];
  signatureSlots: ISignatureSlot[];
  regulationId?: Schema.Types.ObjectId;
  universityFormat?: string;
  isActive: boolean;
}

const signatureSlotSchema = new Schema({
  role: { type: String, required: true },
  position: { type: String, required: true },
}, { _id: false });

const schema = new Schema<IDocumentTemplate>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  type: {
    type: String,
    enum: [
      'transcript', 'provisional_certificate', 'degree_certificate',
      'transfer_certificate', 'migration_certificate', 'no_dues_certificate',
      'character_certificate', 'bonafide', 'study_certificate',
    ],
    required: true,
  },
  name: { type: String, required: true },
  version: { type: String, required: true },
  templateUrl: String,
  placeholders: [{ type: String }],
  signatureSlots: [signatureSlotSchema],
  regulationId: { type: Schema.Types.ObjectId, ref: 'Regulation' },
  universityFormat: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ collegeId: 1, type: 1 });

export const DocumentTemplate = model<IDocumentTemplate>('DocumentTemplate', schema);

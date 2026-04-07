import { Schema, model, Document } from 'mongoose';

export interface IImportError {
  row: number;
  field?: string;
  message: string;
}

export interface ILeadImportBatch extends Document {
  collegeId: Schema.Types.ObjectId;
  academicYearId?: Schema.Types.ObjectId;
  source: string;           // 'eamcet' | 'ecet' | 'manual_csv' | 'website'
  fileName?: string;
  status: string;           // 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  importErrors: IImportError[];
  importedBy: string;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

const schema = new Schema<ILeadImportBatch>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear' },
  source: { type: String, enum: ['eamcet', 'ecet', 'manual_csv', 'website'], required: true },
  fileName: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'partial'],
    default: 'pending',
    index: true,
  },
  totalRecords: { type: Number, default: 0 },
  processedRecords: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  duplicateCount: { type: Number, default: 0 },
  importErrors: [{
    row: Number,
    field: String,
    message: String,
  }],
  importedBy: { type: String, required: true },
  startedAt: Date,
  completedAt: Date,
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

schema.index({ collegeId: 1, source: 1, createdAt: -1 });

export const LeadImportBatch = model<ILeadImportBatch>('LeadImportBatch', schema);

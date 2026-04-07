import { Schema, model, Document } from 'mongoose';

export interface IAdmission extends Document {
  collegeId: Schema.Types.ObjectId;
  applicantId: Schema.Types.ObjectId;
  studentId: Schema.Types.ObjectId;
  academicYearId?: Schema.Types.ObjectId;
  admissionDate: Date;
  admittedBy: string;
  admissionType: string;
  // W01 provisioning tracking
  workflowInstanceId?: Schema.Types.ObjectId;
  provisioningStatus?: string;     // 'pending' | 'in_progress' | 'completed' | 'partial_failure'
  provisioning?: {
    m02_person: string;            // 'pending' | 'completed' | 'failed'
    m02_student: string;
    m03_section: string;
    m03_courses: string;
    m04_invoice: string;
    m08_hostel: string;
    m08_transport: string;
    m08_library: string;
    m12_account: string;
    juvi_account: string;
  };
  provisioningCompletedAt?: Date;
}

const provisioningItemSchema = { type: String, enum: ['pending', 'completed', 'failed', 'skipped'], default: 'pending' };

const schema = new Schema<IAdmission>({
  collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
  applicantId: { type: Schema.Types.ObjectId, ref: 'Applicant', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear' },
  admissionDate: { type: Date, required: true },
  admittedBy: { type: String, required: true },
  admissionType: { type: String, enum: ['fresh', 'lateral'], required: true },
  // W01 provisioning tracking
  workflowInstanceId: { type: Schema.Types.ObjectId, ref: 'WorkflowInstance' },
  provisioningStatus: { type: String, enum: ['pending', 'in_progress', 'completed', 'partial_failure'], default: 'pending' },
  provisioning: {
    m02_person: provisioningItemSchema,
    m02_student: provisioningItemSchema,
    m03_section: provisioningItemSchema,
    m03_courses: provisioningItemSchema,
    m04_invoice: provisioningItemSchema,
    m08_hostel: provisioningItemSchema,
    m08_transport: provisioningItemSchema,
    m08_library: provisioningItemSchema,
    m12_account: provisioningItemSchema,
    juvi_account: provisioningItemSchema,
  },
  provisioningCompletedAt: Date,
}, { timestamps: true });

schema.index({ collegeId: 1, applicantId: 1 }, { unique: true });

export const Admission = model<IAdmission>('Admission', schema);

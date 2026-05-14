import { Schema, model, Document, Types } from 'mongoose';

/**
 * ERPNextBridgeConfig — per-college configuration for the Frappe HR /
 * ERPNext personnel-HR integration. Strategic Gap 8 Phase A.
 *
 * Singleton per college: at most one config row per `collegeId`. The
 * service layer enforces this via a compound unique index.
 *
 * Credentials are not stored in plaintext. `apiKeyRef` is a reference
 * to a secret in the secrets vault (env var name in Phase A, a real
 * vault integration in Phase B). The bridge service resolves the
 * reference at send-time.
 *
 * `lastSyncAt`, `failureCount`, `lastError` give the admin a single
 * pane to see whether the integration is healthy without diving into
 * IntegrationLog.
 */
export interface IERPNextBridgeConfig extends Document {
  collegeId: Types.ObjectId;
  enabled: boolean;
  baseUrl?: string;
  /** Env-var name or vault reference key. Never the raw secret. */
  apiKeyRef?: string;
  /** Optional namespace for multi-tenant ERPNext sites (e.g. site name). */
  siteName?: string;
  /** Which event channels are currently bridged. Subset of the mapping
   *  registry — admin can disable specific channels without killing
   *  the whole bridge. */
  enabledChannels: string[];
  lastSyncAt?: Date;
  lastSuccessAt?: Date;
  lastError?: string;
  failureCount: number;
  successCount: number;
  /** Phase A flag — Phase A logs to IntegrationLog with
   *  status: 'unimplemented'. Set to true when Phase B wires the
   *  actual HTTP push. */
  outboundEnabled: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IERPNextBridgeConfig>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    enabled: { type: Boolean, required: true, default: false },
    baseUrl: { type: String, trim: true },
    apiKeyRef: { type: String, trim: true },
    siteName: { type: String, trim: true },
    enabledChannels: { type: [String], default: [] },
    lastSyncAt: { type: Date },
    lastSuccessAt: { type: Date },
    lastError: { type: String, trim: true },
    failureCount: { type: Number, default: 0, min: 0 },
    successCount: { type: Number, default: 0, min: 0 },
    outboundEnabled: { type: Boolean, default: false },
    createdBy: { type: String, trim: true },
    updatedBy: { type: String, trim: true },
  },
  { timestamps: true },
);

// Singleton per college.
schema.index({ collegeId: 1 }, { unique: true });

export const ERPNextBridgeConfig = model<IERPNextBridgeConfig>(
  'ERPNextBridgeConfig',
  schema,
);

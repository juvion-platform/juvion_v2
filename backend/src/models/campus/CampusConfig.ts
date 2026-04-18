import { Schema, model, Document } from 'mongoose';

/**
 * CampusConfig — per-college operational configuration for the M08 Campus Ops
 * module. Each sub-document (hostel, mess, transport, library, labs, ...)
 * carries settings that service layers read to drive behavior.
 *
 * The optional-allotment feature adds `proposalTtlDays` to both the `hostel`
 * and `transport` sub-docs: how many days a student has to respond to an
 * allocation proposal before it auto-expires.
 */
export interface ICampusConfig extends Document {
  collegeId: Schema.Types.ObjectId;
  hostel: {
    allocationAlgorithm: string;
    preferenceWeight: number;
    capacityWeight: number;
    specialNeedsAutoFlag: boolean;
    siblingCoAllocationEnabled: boolean;
    attendanceAnomalyThreshold: number;
    leaveApprovalRequired: boolean;
    appealDeadlineDays: number;
    proposalTtlDays: number;
  };
  mess: {
    billingModel: string;
    operationModel: string;
    couponWarningThreshold: number;
    allowCreditOnExhaustion: boolean;
  };
  transport: {
    fleetModel: string;
    routeAllocationPolicy: string;
    gpsTrackingEnabled: boolean;
    proposalTtlDays: number;
  };
  library: {
    systemMode: string;
    ilmsProvider?: string;
    overdueFinePerDay: number;
    maxOverdueFine: number;
    lostBookReplacementMultiplier: number;
    gracePeriodDays: number;
    maxRenewals: number;
    reservationPickupWindowHours: number;
    fineWaiverThresholds: { librarian: number; chiefLibrarian: number };
  };
  labs: {
    bookingApprovalTier: string;
    equipmentDamageLiability: string;
  };
  facilities: {
    bookingApprovalTiers: {
      classroom: string;
      seminar_hall: string;
      auditorium: string;
      conference: string;
    };
    conflictResolution: string;
  };
  maintenance: {
    defaultAssignmentRouting: string;
    escalationWarningThresholdPercent: number;
    escalationAutoThresholdPercent: number;
    pmConfidenceThreshold: number;
    pmAutoScheduleConfidenceThreshold: number;
  };
}

const fineWaiverThresholdsSchema = new Schema(
  {
    librarian: { type: Number, default: 100 },
    chiefLibrarian: { type: Number, default: 500 },
  },
  { _id: false },
);

const bookingApprovalTiersSchema = new Schema(
  {
    classroom: { type: String, enum: ['self_book', 'single', 'multi'], default: 'self_book' },
    seminar_hall: { type: String, enum: ['self_book', 'single', 'multi'], default: 'single' },
    auditorium: { type: String, enum: ['self_book', 'single', 'multi'], default: 'multi' },
    conference: { type: String, enum: ['self_book', 'single', 'multi'], default: 'single' },
  },
  { _id: false },
);

const hostelSchema = new Schema(
  {
    allocationAlgorithm: { type: String, enum: ['preference_based', 'capacity_first', 'hybrid'], default: 'hybrid' },
    preferenceWeight: { type: Number, default: 0.6 },
    capacityWeight: { type: Number, default: 0.4 },
    specialNeedsAutoFlag: { type: Boolean, default: true },
    siblingCoAllocationEnabled: { type: Boolean, default: false },
    attendanceAnomalyThreshold: { type: Number, default: 3 },
    leaveApprovalRequired: { type: Boolean, default: true },
    appealDeadlineDays: { type: Number, default: 7 },
    proposalTtlDays: { type: Number, default: 7 },
  },
  { _id: false },
);

const messSchema = new Schema(
  {
    billingModel: { type: String, enum: ['fixed_fee', 'coupon'], default: 'fixed_fee' },
    operationModel: { type: String, enum: ['in_house', 'outsourced', 'hybrid'], default: 'in_house' },
    couponWarningThreshold: { type: Number, default: 5 },
    allowCreditOnExhaustion: { type: Boolean, default: false },
  },
  { _id: false },
);

const transportSchema = new Schema(
  {
    fleetModel: { type: String, enum: ['owned', 'contracted', 'mixed'], default: 'owned' },
    routeAllocationPolicy: { type: String, enum: ['auto_assign_nearest', 'student_selects'], default: 'auto_assign_nearest' },
    gpsTrackingEnabled: { type: Boolean, default: false },
    proposalTtlDays: { type: Number, default: 7 },
  },
  { _id: false },
);

const librarySchema = new Schema(
  {
    systemMode: { type: String, enum: ['juvion_native', 'ilms_integration', 'hybrid'], default: 'juvion_native' },
    ilmsProvider: String,
    overdueFinePerDay: { type: Number, default: 1 },
    maxOverdueFine: { type: Number, default: 100 },
    lostBookReplacementMultiplier: { type: Number, default: 2 },
    gracePeriodDays: { type: Number, default: 1 },
    maxRenewals: { type: Number, default: 2 },
    reservationPickupWindowHours: { type: Number, default: 48 },
    fineWaiverThresholds: { type: fineWaiverThresholdsSchema },
  },
  { _id: false },
);

const labsSchema = new Schema(
  {
    bookingApprovalTier: { type: String, enum: ['auto', 'technician', 'hod'], default: 'technician' },
    equipmentDamageLiability: { type: String, enum: ['student', 'insurance', 'department'], default: 'student' },
  },
  { _id: false },
);

const facilitiesSchema = new Schema(
  {
    bookingApprovalTiers: { type: bookingApprovalTiersSchema },
    conflictResolution: { type: String, enum: ['fcfs', 'priority'], default: 'fcfs' },
  },
  { _id: false },
);

const maintenanceSchema = new Schema(
  {
    defaultAssignmentRouting: { type: String, enum: ['in_house', 'amc_vendor', 'external'], default: 'in_house' },
    escalationWarningThresholdPercent: { type: Number, default: 80 },
    escalationAutoThresholdPercent: { type: Number, default: 100 },
    pmConfidenceThreshold: { type: Number, default: 0.6 },
    pmAutoScheduleConfidenceThreshold: { type: Number, default: 0.7 },
  },
  { _id: false },
);

const schema = new Schema<ICampusConfig>(
  {
    collegeId: { type: Schema.Types.ObjectId, required: true, index: true },
    hostel: { type: hostelSchema, default: () => ({}) },
    mess: { type: messSchema, default: () => ({}) },
    transport: { type: transportSchema, default: () => ({}) },
    library: { type: librarySchema, default: () => ({}) },
    labs: { type: labsSchema, default: () => ({}) },
    facilities: { type: facilitiesSchema, default: () => ({}) },
    maintenance: { type: maintenanceSchema, default: () => ({}) },
  },
  { timestamps: true },
);

schema.index({ collegeId: 1 }, { unique: true });

export const CampusConfig = model<ICampusConfig>('CampusConfig', schema);

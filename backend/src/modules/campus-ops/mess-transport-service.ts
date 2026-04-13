// campus-ops module — mess & transport sub-domain workflow service
import { MessFacility } from '../../models/campus/MessFacility';
import { MealTransaction } from '../../models/campus/MealTransaction';
import { MessSubscription } from '../../models/campus/MessSubscription';
import { DietaryPreference } from '../../models/campus/DietaryPreference';
import { QualityInspection } from '../../models/campus/QualityInspection';
import { MessVendorContract } from '../../models/campus/MessVendorContract';
import { RouteStop } from '../../models/campus/RouteStop';
import { Driver } from '../../models/campus/Driver';
import { TripLog } from '../../models/campus/TripLog';
import { TransportAttendance } from '../../models/campus/TransportAttendance';
import { TransportContractor } from '../../models/campus/TransportContractor';
import { TransportClearance } from '../../models/campus/TransportClearance';
import { CampusConfig } from '../../models/campus/CampusConfig';
import { TransportRoute } from '../../models/welfare/TransportRoute';
import { TransportAllocation } from '../../models/welfare/TransportAllocation';
import { MessMenu } from '../../models/welfare/MessMenu';
// MessFeedback imported in main service.ts for feedback CRUD
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';

// ===========================================================================
// Helper
// ===========================================================================

async function getOrCreateConfig(collegeId: string) {
  let config = await CampusConfig.findOne({ collegeId });
  if (!config) config = await CampusConfig.create({ collegeId });
  return config;
}

// ===========================================================================
// W08-L2-010: Daily Mess Operations
// ===========================================================================

/** Record a meal transaction (coupon or fixed-fee attendance) */
export async function recordMealTransaction(
  collegeId: string,
  data: { studentId: string; messFacilityId: string; mealType: string },
  performedBy: string,
) {
  const config = await getOrCreateConfig(collegeId);
  const facility = await MessFacility.findOne({ _id: data.messFacilityId, collegeId });
  if (!facility) throw new AppError(404, 'Mess facility not found');

  const billingModel = facility.billingModel ?? config.mess?.billingModel ?? 'fixed_fee';
  const now = new Date();
  let doc;
  let warning: string | undefined;

  if (billingModel === 'coupon') {
    const lastTx = await MealTransaction.findOne(
      { collegeId, studentId: data.studentId, messFacilityId: data.messFacilityId },
      { balance: 1 },
      { sort: { createdAt: -1 } },
    );
    const prevBalance = lastTx?.balance ?? 0;
    const newBalance = prevBalance - 1;

    if (prevBalance <= 0 && !config.mess?.allowCreditOnExhaustion) {
      throw new AppError(400, 'Coupon balance exhausted');
    }

    doc = await MealTransaction.create({
      collegeId,
      studentId: data.studentId,
      messFacilityId: data.messFacilityId,
      date: now,
      mealType: data.mealType,
      transactionType: 'coupon_deduct',
      amount: -1,
      balance: newBalance,
    });

    const threshold = config.mess?.couponWarningThreshold ?? 5;
    if (newBalance <= threshold && newBalance > 0) {
      warning = `Low coupon balance: ${newBalance} remaining`;
    }
  } else {
    // fixed_fee model — verify active subscription
    const sub = await MessSubscription.findOne({
      collegeId,
      studentId: data.studentId,
      messFacilityId: data.messFacilityId,
      status: 'active',
    });
    if (!sub) throw new AppError(400, 'No active mess subscription found');

    doc = await MealTransaction.create({
      collegeId,
      studentId: data.studentId,
      messFacilityId: data.messFacilityId,
      date: now,
      mealType: data.mealType,
      transactionType: 'credit_meal',
      amount: 0,
      balance: 0,
    });
  }

  await audit(collegeId, 'MealTransaction', String(doc._id), `Meal - ${data.mealType}`, 'create', performedBy);
  return { transaction: doc, warning };
}

/** Record meal attendance for fixed-fee model */
export async function recordMealAttendance(
  collegeId: string,
  data: { studentId: string; messFacilityId: string; date: string; mealType: string },
  performedBy: string,
) {
  const sub = await MessSubscription.findOne({
    collegeId,
    studentId: data.studentId,
    messFacilityId: data.messFacilityId,
    status: 'active',
  });
  if (!sub) throw new AppError(400, 'No active mess subscription found');

  const doc = await MealTransaction.create({
    collegeId,
    studentId: data.studentId,
    messFacilityId: data.messFacilityId,
    date: new Date(data.date),
    mealType: data.mealType,
    transactionType: 'credit_meal',
    amount: 0,
    balance: 0,
  });

  await audit(collegeId, 'MealTransaction', String(doc._id), `Attendance - ${data.mealType}`, 'create', performedBy);
  return doc;
}

/** Get daily summary for a mess facility */
export async function getMessDailySummary(
  collegeId: string,
  data: { messFacilityId: string; date: string },
) {
  const startOfDay = new Date(data.date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(data.date);
  endOfDay.setHours(23, 59, 59, 999);

  const transactions = await MealTransaction.aggregate([
    {
      $match: {
        collegeId: { $toObjectId: collegeId },
        messFacilityId: { $toObjectId: data.messFacilityId },
        date: { $gte: startOfDay, $lte: endOfDay },
      },
    },
    {
      $group: {
        _id: '$mealType',
        count: { $sum: 1 },
      },
    },
  ]);

  const totalCount = transactions.reduce((sum: number, t: { count: number }) => sum + t.count, 0);

  return {
    messFacilityId: data.messFacilityId,
    date: data.date,
    mealBreakdown: transactions.map((t: { _id: string; count: number }) => ({
      mealType: t._id,
      count: t.count,
    })),
    totalTransactions: totalCount,
  };
}

/** Add coupon credit to a student's balance */
export async function addCouponCredit(
  collegeId: string,
  data: { studentId: string; messFacilityId: string; amount: number },
  performedBy: string,
) {
  const lastTx = await MealTransaction.findOne(
    { collegeId, studentId: data.studentId, messFacilityId: data.messFacilityId },
    { balance: 1 },
    { sort: { createdAt: -1 } },
  );
  const prevBalance = lastTx?.balance ?? 0;
  const newBalance = prevBalance + data.amount;

  const doc = await MealTransaction.create({
    collegeId,
    studentId: data.studentId,
    messFacilityId: data.messFacilityId,
    date: new Date(),
    mealType: 'breakfast', // credit record, mealType required by schema
    transactionType: 'coupon_credit',
    amount: data.amount,
    balance: newBalance,
  });

  await createAuditLog({
    collegeId,
    entityType: 'MealTransaction',
    entityId: String(doc._id),
    entityName: `Coupon Credit +${data.amount}`,
    action: 'create',
    changes: [
      { field: 'balance', displayName: 'Balance', oldValue: prevBalance, newValue: newBalance },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// W08-L2-011: Menu Planning
// ===========================================================================

/** Create a new menu (draft) */
export async function createMenu(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await MessMenu.create({
    ...data,
    collegeId,
    approvalStatus: 'draft',
    publishedToJuvi: false,
  });

  await audit(collegeId, 'MessMenu', String(doc._id), `Menu - ${doc.day}`, 'create', performedBy);
  return doc;
}

/** Approve a menu */
export async function approveMenu(
  collegeId: string,
  menuId: string,
  performedBy: string,
) {
  const doc = await MessMenu.findOne({ _id: menuId, collegeId });
  if (!doc) throw new AppError(404, 'Menu not found');
  if (doc.approvalStatus !== 'draft') throw new AppError(400, 'Menu is not in draft status');

  doc.approvalStatus = 'approved';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'MessMenu',
    entityId: String(doc._id),
    entityName: `Menu - ${doc.day}`,
    action: 'update',
    changes: [
      { field: 'approvalStatus', displayName: 'Approval Status', oldValue: 'draft', newValue: 'approved' },
    ],
    performedBy,
  });

  return doc;
}

/** Publish a menu */
export async function publishMenu(
  collegeId: string,
  menuId: string,
  performedBy: string,
) {
  const doc = await MessMenu.findOne({ _id: menuId, collegeId });
  if (!doc) throw new AppError(404, 'Menu not found');
  if (doc.approvalStatus !== 'approved') throw new AppError(400, 'Menu must be approved before publishing');

  doc.approvalStatus = 'published';
  doc.publishedToJuvi = true;
  await doc.save();

  // TODO: push menu to Juvi

  await createAuditLog({
    collegeId,
    entityType: 'MessMenu',
    entityId: String(doc._id),
    entityName: `Menu - ${doc.day}`,
    action: 'update',
    changes: [
      { field: 'approvalStatus', displayName: 'Approval Status', oldValue: 'approved', newValue: 'published' },
      { field: 'publishedToJuvi', displayName: 'Published to Juvi', oldValue: false, newValue: true },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// W08-L2-012: Quality Inspection
// ===========================================================================

/** Record a quality inspection */
export async function recordQualityInspection(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await QualityInspection.create({ ...data, collegeId });

  let slaBreach: { hygieneBelow?: boolean; foodQualityBelow?: boolean } | undefined;

  // Check against vendor SLA if outsourced
  const facility = await MessFacility.findOne({ _id: doc.messFacilityId, collegeId });
  if (facility && facility.operationModel === 'outsourced') {
    const contract = await MessVendorContract.findOne({
      collegeId,
      messFacilityId: doc.messFacilityId,
      status: 'active',
    });
    if (contract?.slaMetrics) {
      const sla = contract.slaMetrics;
      if (sla.minHygieneScore && doc.hygieneScore < sla.minHygieneScore) {
        slaBreach = { ...slaBreach, hygieneBelow: true };
      }
      if (sla.minFoodQualityScore && doc.foodQualityScore < sla.minFoodQualityScore) {
        slaBreach = { ...slaBreach, foodQualityBelow: true };
      }
    }
  }

  await audit(collegeId, 'QualityInspection', String(doc._id), `Inspection - ${doc.date.toISOString().slice(0, 10)}`, 'create', performedBy);
  return { inspection: doc, slaBreach };
}

/** Get quality trend for a facility over months */
export async function getQualityTrend(
  collegeId: string,
  data: { messFacilityId: string; months: number },
) {
  const since = new Date();
  since.setMonth(since.getMonth() - data.months);

  const trend = await QualityInspection.aggregate([
    {
      $match: {
        collegeId: { $toObjectId: collegeId },
        messFacilityId: { $toObjectId: data.messFacilityId },
        date: { $gte: since },
      },
    },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        avgHygiene: { $avg: '$hygieneScore' },
        avgFoodQuality: { $avg: '$foodQualityScore' },
        inspectionCount: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  return { messFacilityId: data.messFacilityId, months: data.months, trend };
}

// ===========================================================================
// W08-L2-013: Mess Vendor Contract
// ===========================================================================

/** Create a mess vendor contract (draft) */
export async function createMessVendorContract(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await MessVendorContract.create({ ...data, collegeId, status: 'draft' });

  await audit(collegeId, 'MessVendorContract', String(doc._id), `Vendor Contract - ${String(doc.vendorId)}`, 'create', performedBy);
  return doc;
}

/** Activate a mess vendor contract */
export async function activateMessVendorContract(
  collegeId: string,
  contractId: string,
  performedBy: string,
) {
  const doc = await MessVendorContract.findOne({ _id: contractId, collegeId });
  if (!doc) throw new AppError(404, 'Vendor contract not found');
  if (doc.status !== 'draft') throw new AppError(400, 'Contract must be in draft status to activate');

  doc.status = 'active';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'MessVendorContract',
    entityId: String(doc._id),
    entityName: `Vendor Contract - ${String(doc.vendorId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'draft', newValue: 'active' },
    ],
    performedBy,
  });

  return doc;
}

/** Terminate a mess vendor contract */
export async function terminateMessVendorContract(
  collegeId: string,
  contractId: string,
  data: { reason: string },
  performedBy: string,
) {
  const doc = await MessVendorContract.findOne({ _id: contractId, collegeId });
  if (!doc) throw new AppError(404, 'Vendor contract not found');
  if (doc.status === 'terminated') throw new AppError(400, 'Contract is already terminated');

  const oldStatus = doc.status;
  doc.status = 'terminated';
  doc.terminationReason = data.reason;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'MessVendorContract',
    entityId: String(doc._id),
    entityName: `Vendor Contract - ${String(doc.vendorId)}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'terminated' },
      { field: 'terminationReason', displayName: 'Termination Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// W08-L2-014: Allocate Transport Route
// ===========================================================================

/** Bulk allocate transport for multiple students */
export async function allocateTransportBulk(
  collegeId: string,
  data: { students: Array<{ studentId: string; address?: string }>; academicYearId: string },
  performedBy: string,
) {
  const config = await getOrCreateConfig(collegeId);
  const policy = config.transport?.routeAllocationPolicy ?? 'auto_assign_nearest';

  const routes = await TransportRoute.find({ collegeId, isActive: true }).lean();
  if (routes.length === 0) throw new AppError(400, 'No active transport routes available');

  const allocations = [];

  for (const student of data.students) {
    let assignedRoute = null;
    let assignedStopName = '';

    if (policy === 'auto_assign_nearest') {
      // TODO: use M02 address + geo-matching for nearest stop
      // Simple fallback: assign first route with available capacity
      for (const route of routes) {
        if (route.currentRidership < route.capacity) {
          assignedRoute = route;
          assignedStopName = route.stops?.[0]?.name ?? 'Default Stop';
          break;
        }
      }
    } else {
      // student_selects: assign first available route (should be pre-selected in real flow)
      for (const route of routes) {
        if (route.currentRidership < route.capacity) {
          assignedRoute = route;
          assignedStopName = route.stops?.[0]?.name ?? 'Default Stop';
          break;
        }
      }
    }

    if (!assignedRoute) continue; // skip if no capacity

    const allocation = await TransportAllocation.create({
      collegeId,
      studentId: student.studentId,
      routeId: assignedRoute._id,
      stopName: assignedStopName,
      academicYearId: data.academicYearId,
      allocationType: 'auto',
      status: 'active',
      feeTriggered: false,
    });

    await TransportRoute.updateOne(
      { _id: assignedRoute._id, collegeId },
      { $inc: { currentRidership: 1 } },
    );

    // TODO: emit transport.fee.trigger to M04 via BullMQ

    await audit(collegeId, 'TransportAllocation', String(allocation._id), `Transport - ${student.studentId}`, 'create', performedBy);
    allocations.push(allocation);
  }

  return { allocated: allocations.length, allocations };
}

/** Allocate transport for a single student (student-selected) */
export async function allocateTransportSingle(
  collegeId: string,
  data: { studentId: string; routeId: string; stopId: string; academicYearId: string },
  performedBy: string,
) {
  const route = await TransportRoute.findOne({ _id: data.routeId, collegeId, isActive: true });
  if (!route) throw new AppError(404, 'Transport route not found');
  if (route.currentRidership >= route.capacity) {
    throw new AppError(400, 'Route is at full capacity');
  }

  const stop = await RouteStop.findOne({ _id: data.stopId, collegeId, routeId: data.routeId });
  const stopName = stop?.name ?? 'Selected Stop';

  const allocation = await TransportAllocation.create({
    collegeId,
    studentId: data.studentId,
    routeId: data.routeId,
    stopName,
    stopId: data.stopId,
    academicYearId: data.academicYearId,
    allocationType: 'student_selected',
    status: 'active',
    feeTriggered: false,
  });

  await TransportRoute.updateOne(
    { _id: data.routeId, collegeId },
    { $inc: { currentRidership: 1 } },
  );

  // TODO: emit transport.fee.trigger to M04 via BullMQ

  await createAuditLog({
    collegeId,
    entityType: 'TransportAllocation',
    entityId: String(allocation._id),
    entityName: `Transport - ${data.studentId}`,
    action: 'create',
    changes: [
      { field: 'allocationType', displayName: 'Allocation Type', oldValue: null, newValue: 'student_selected' },
    ],
    performedBy,
  });

  return allocation;
}

// ===========================================================================
// W08-L2-015: Transport Clearance
// ===========================================================================

/** Initiate transport clearance for a student */
export async function initiateTransportClearance(
  collegeId: string,
  studentId: string,
  performedBy: string,
) {
  const allocation = await TransportAllocation.findOne({
    collegeId,
    studentId,
    status: 'active',
  });

  // TODO: check M04 for outstanding transport dues
  const hasDues = false; // stub

  const blockingItems: Array<{ item: string; reason: string }> = [];
  if (hasDues) {
    blockingItems.push({ item: 'transport_dues', reason: 'Outstanding transport fee balance' });
  }

  const status = blockingItems.length > 0 ? 'blocked' : 'cleared';

  const doc = await TransportClearance.create({
    collegeId,
    studentId,
    allocationId: allocation?._id,
    duesCleared: !hasDues,
    status,
    blockingItems,
    clearedAt: status === 'cleared' ? new Date() : undefined,
  });

  // On clearance: cancel allocation and decrement ridership
  if (status === 'cleared' && allocation) {
    allocation.status = 'cancelled';
    await allocation.save();

    await TransportRoute.updateOne(
      { _id: allocation.routeId, collegeId },
      { $inc: { currentRidership: -1 } },
    );
  }

  await createAuditLog({
    collegeId,
    entityType: 'TransportClearance',
    entityId: String(doc._id),
    entityName: `Transport Clearance - ${studentId}`,
    action: 'create',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: null, newValue: status },
    ],
    performedBy,
  });

  return doc;
}

/** Get transport clearance status for a student */
export async function getTransportClearanceStatus(
  collegeId: string,
  studentId: string,
) {
  const clearance = await TransportClearance.findOne({ collegeId, studentId })
    .sort({ createdAt: -1 })
    .lean();
  if (!clearance) throw new AppError(404, 'No transport clearance record found');
  return clearance;
}

// ===========================================================================
// W08-L2-016: Daily Transport Operations
// ===========================================================================

/** Create a trip log */
export async function createTripLog(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await TripLog.create({ ...data, collegeId, status: 'scheduled' });

  await audit(collegeId, 'TripLog', String(doc._id), `Trip - ${doc.tripType} ${doc.tripDate.toISOString().slice(0, 10)}`, 'create', performedBy);
  return doc;
}

/** Start a trip */
export async function startTrip(
  collegeId: string,
  tripLogId: string,
  performedBy: string,
) {
  const doc = await TripLog.findOne({ _id: tripLogId, collegeId });
  if (!doc) throw new AppError(404, 'Trip log not found');
  if (doc.status !== 'scheduled') throw new AppError(400, 'Trip must be in scheduled status to start');

  doc.status = 'in_progress';
  doc.startTime = new Date();
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'TripLog',
    entityId: String(doc._id),
    entityName: `Trip - ${doc.tripType}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'scheduled', newValue: 'in_progress' },
    ],
    performedBy,
  });

  return doc;
}

/** Complete a trip */
export async function completeTrip(
  collegeId: string,
  tripLogId: string,
  performedBy: string,
) {
  const doc = await TripLog.findOne({ _id: tripLogId, collegeId });
  if (!doc) throw new AppError(404, 'Trip log not found');
  if (doc.status !== 'in_progress') throw new AppError(400, 'Trip must be in progress to complete');

  doc.status = 'completed';
  doc.endTime = new Date();
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'TripLog',
    entityId: String(doc._id),
    entityName: `Trip - ${doc.tripType}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'in_progress', newValue: 'completed' },
    ],
    performedBy,
  });

  return doc;
}

/** Record transport attendance in bulk for a trip */
export async function recordTransportAttendance(
  collegeId: string,
  data: { tripLogId: string; records: Array<{ studentId: string; stopId?: string }> },
  performedBy: string,
) {
  const trip = await TripLog.findOne({ _id: data.tripLogId, collegeId });
  if (!trip) throw new AppError(404, 'Trip log not found');

  const now = new Date();
  const docs = await TransportAttendance.insertMany(
    data.records.map((r) => ({
      collegeId,
      studentId: r.studentId,
      tripLogId: data.tripLogId,
      stopId: r.stopId,
      boardedAt: now,
    })),
  );

  for (const doc of docs) {
    await audit(collegeId, 'TransportAttendance', String(doc._id), `Transport Attendance - ${String(doc.studentId)}`, 'create', performedBy);
  }

  return { recorded: docs.length, records: docs };
}

// ===========================================================================
// W08-L2-017: Route Planning / Adjustment
// ===========================================================================

/** Adjust a transport route (add/remove stop, update timing) */
export async function adjustRoute(
  collegeId: string,
  routeId: string,
  data: { action: string; details: Record<string, unknown> },
  performedBy: string,
) {
  const route = await TransportRoute.findOne({ _id: routeId, collegeId });
  if (!route) throw new AppError(404, 'Transport route not found');

  if (data.action === 'add_stop') {
    const stopData = data.details as { name: string; pickupTime?: string; dropTime?: string; latitude?: number; longitude?: number };
    const newSeq = (route.stops?.length ?? 0) + 1;
    await RouteStop.create({
      collegeId,
      routeId,
      name: stopData.name,
      sequence: newSeq,
      pickupTime: stopData.pickupTime,
      dropTime: stopData.dropTime,
      latitude: stopData.latitude,
      longitude: stopData.longitude,
      isActive: true,
    });
    route.stops.push({
      name: stopData.name,
      pickupTime: stopData.pickupTime ?? '',
      dropTime: stopData.dropTime ?? '',
      latitude: stopData.latitude,
      longitude: stopData.longitude,
    });
    await route.save();
  } else if (data.action === 'remove_stop') {
    const { stopId } = data.details as { stopId: string };
    await RouteStop.updateOne({ _id: stopId, collegeId }, { isActive: false });
    const stop = await RouteStop.findOne({ _id: stopId, collegeId });
    if (stop) {
      route.stops = route.stops.filter((s) => s.name !== stop.name);
      await route.save();
    }
  } else if (data.action === 'update_timing') {
    const { stopId, pickupTime, dropTime } = data.details as { stopId: string; pickupTime?: string; dropTime?: string };
    await RouteStop.updateOne(
      { _id: stopId, collegeId },
      { $set: { ...(pickupTime && { pickupTime }), ...(dropTime && { dropTime }) } },
    );
  }

  await createAuditLog({
    collegeId,
    entityType: 'TransportRoute',
    entityId: String(route._id),
    entityName: `Route - ${route.routeNumber}`,
    action: 'update',
    changes: [
      { field: 'routeAdjustment', displayName: 'Adjustment', oldValue: null, newValue: data.action },
    ],
    performedBy,
  });

  return route;
}

/** Get route utilization across all routes */
export async function getRouteUtilization(collegeId: string) {
  const routes = await TransportRoute.find({ collegeId, isActive: true }).lean();

  const utilization = routes.map((route) => ({
    routeId: String(route._id),
    routeNumber: route.routeNumber,
    name: route.name,
    capacity: route.capacity,
    currentRidership: route.currentRidership,
    utilizationPercent: route.capacity > 0
      ? Math.round((route.currentRidership / route.capacity) * 100)
      : 0,
  }));

  return { routes: utilization };
}

// ===========================================================================
// W08-L2-018: Transport Contractor
// ===========================================================================

/** Create a transport contractor contract (draft) */
export async function createTransportContractorContract(
  collegeId: string,
  data: Record<string, unknown>,
  performedBy: string,
) {
  const doc = await TransportContractor.create({ ...data, collegeId, status: 'draft' });

  await audit(collegeId, 'TransportContractor', String(doc._id), `Transport Contract - ${doc.contractNumber}`, 'create', performedBy);
  return doc;
}

/** Activate a transport contractor contract */
export async function activateTransportContract(
  collegeId: string,
  contractId: string,
  performedBy: string,
) {
  const doc = await TransportContractor.findOne({ _id: contractId, collegeId });
  if (!doc) throw new AppError(404, 'Transport contractor contract not found');
  if (doc.status !== 'draft') throw new AppError(400, 'Contract must be in draft status to activate');

  doc.status = 'active';
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'TransportContractor',
    entityId: String(doc._id),
    entityName: `Transport Contract - ${doc.contractNumber}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: 'draft', newValue: 'active' },
    ],
    performedBy,
  });

  return doc;
}

/** Terminate a transport contractor contract */
export async function terminateTransportContract(
  collegeId: string,
  contractId: string,
  data: { reason: string },
  performedBy: string,
) {
  const doc = await TransportContractor.findOne({ _id: contractId, collegeId });
  if (!doc) throw new AppError(404, 'Transport contractor contract not found');
  if (doc.status === 'terminated') throw new AppError(400, 'Contract is already terminated');

  const oldStatus = doc.status;
  doc.status = 'terminated';
  doc.terminationReason = data.reason;
  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'TransportContractor',
    entityId: String(doc._id),
    entityName: `Transport Contract - ${doc.contractNumber}`,
    action: 'update',
    changes: [
      { field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'terminated' },
      { field: 'terminationReason', displayName: 'Termination Reason', oldValue: null, newValue: data.reason },
    ],
    performedBy,
  });

  return doc;
}

// ===========================================================================
// CRUD helpers
// ===========================================================================

async function audit(collegeId: string, entityType: string, entityId: string, entityName: string, action: 'create' | 'update' | 'delete', performedBy: string) {
  await createAuditLog({ collegeId, entityType, entityId, entityName, action, changes: [], performedBy });
}

async function findOrFail<T>(model: { findOne: (f: Record<string, unknown>) => unknown }, id: string, collegeId: string, label: string) {
  const doc = await (model.findOne as (f: Record<string, unknown>) => Promise<T | null>)({ _id: id, collegeId });
  if (!doc) throw new AppError(404, `${label} not found`);
  return doc;
}

// ===========================================================================
// CRUD: MessFacility
// ===========================================================================

export async function listMessFacilities(collegeId: string, page: number, limit: number) {
  return paginate(MessFacility, { collegeId }, page, limit);
}
export async function getMessFacility(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof MessFacility>>(MessFacility, id, collegeId, 'Mess facility');
}
export async function createMessFacility(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await MessFacility.create({ ...data, collegeId });
  await audit(collegeId, 'MessFacility', String(doc._id), doc.name, 'create', performedBy);
  return doc;
}
export async function updateMessFacility(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await getMessFacility(collegeId, id);
  Object.assign(doc, data);
  await doc.save();
  await audit(collegeId, 'MessFacility', String(doc._id), doc.name, 'update', performedBy);
  return doc;
}
export async function deleteMessFacility(collegeId: string, id: string, performedBy: string) {
  const doc = await getMessFacility(collegeId, id);
  await doc.deleteOne();
  await audit(collegeId, 'MessFacility', String(doc._id), doc.name, 'delete', performedBy);
  return { success: true };
}

// CRUD: MealTransaction (list/get only — immutable)
export async function listMealTransactions(collegeId: string, page: number, limit: number, filter?: Record<string, unknown>) {
  return paginate(MealTransaction, { collegeId, ...filter }, page, limit);
}
export async function getMealTransaction(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof MealTransaction>>(MealTransaction, id, collegeId, 'Meal transaction');
}

// ===========================================================================
// CRUD: MessSubscription
// ===========================================================================

export async function listMessSubscriptions(collegeId: string, page: number, limit: number) {
  return paginate(MessSubscription, { collegeId }, page, limit);
}
export async function getMessSubscription(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof MessSubscription>>(MessSubscription, id, collegeId, 'Mess subscription');
}
export async function createMessSubscription(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await MessSubscription.create({ ...data, collegeId });
  await audit(collegeId, 'MessSubscription', String(doc._id), `Subscription - ${String(doc.studentId)}`, 'create', performedBy);
  return doc;
}
export async function updateMessSubscription(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await getMessSubscription(collegeId, id);
  Object.assign(doc, data);
  await doc.save();
  await audit(collegeId, 'MessSubscription', String(doc._id), `Subscription - ${String(doc.studentId)}`, 'update', performedBy);
  return doc;
}
export async function deleteMessSubscription(collegeId: string, id: string, performedBy: string) {
  const doc = await getMessSubscription(collegeId, id);
  await doc.deleteOne();
  await audit(collegeId, 'MessSubscription', String(doc._id), `Subscription - ${String(doc.studentId)}`, 'delete', performedBy);
  return { success: true };
}

// ===========================================================================
// CRUD: DietaryPreference
// ===========================================================================

export async function listDietaryPreferences(collegeId: string, page: number, limit: number) {
  return paginate(DietaryPreference, { collegeId }, page, limit);
}
export async function getDietaryPreference(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof DietaryPreference>>(DietaryPreference, id, collegeId, 'Dietary preference');
}
export async function createDietaryPreference(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await DietaryPreference.create({ ...data, collegeId });
  await audit(collegeId, 'DietaryPreference', String(doc._id), `Diet - ${doc.dietType}`, 'create', performedBy);
  return doc;
}
export async function updateDietaryPreference(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await getDietaryPreference(collegeId, id);
  Object.assign(doc, data);
  await doc.save();
  await audit(collegeId, 'DietaryPreference', String(doc._id), `Diet - ${doc.dietType}`, 'update', performedBy);
  return doc;
}
export async function deleteDietaryPreference(collegeId: string, id: string, performedBy: string) {
  const doc = await getDietaryPreference(collegeId, id);
  await doc.deleteOne();
  await audit(collegeId, 'DietaryPreference', String(doc._id), `Diet - ${doc.dietType}`, 'delete', performedBy);
  return { success: true };
}

// ===========================================================================
// CRUD: QualityInspection
// ===========================================================================

export async function listQualityInspections(collegeId: string, page: number, limit: number) {
  return paginate(QualityInspection, { collegeId }, page, limit);
}
export async function getQualityInspection(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof QualityInspection>>(QualityInspection, id, collegeId, 'Quality inspection');
}
export async function createQualityInspectionRecord(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await QualityInspection.create({ ...data, collegeId });
  await audit(collegeId, 'QualityInspection', String(doc._id), `Inspection - ${doc.date.toISOString().slice(0, 10)}`, 'create', performedBy);
  return doc;
}
export async function updateQualityInspection(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await getQualityInspection(collegeId, id);
  Object.assign(doc, data);
  await doc.save();
  await audit(collegeId, 'QualityInspection', String(doc._id), `Inspection - ${doc.date.toISOString().slice(0, 10)}`, 'update', performedBy);
  return doc;
}
export async function deleteQualityInspection(collegeId: string, id: string, performedBy: string) {
  const doc = await getQualityInspection(collegeId, id);
  await doc.deleteOne();
  await audit(collegeId, 'QualityInspection', String(doc._id), `Inspection - ${doc.date.toISOString().slice(0, 10)}`, 'delete', performedBy);
  return { success: true };
}

// ===========================================================================
// CRUD: MessVendorContract
// ===========================================================================

export async function listMessVendorContracts(collegeId: string, page: number, limit: number) {
  return paginate(MessVendorContract, { collegeId }, page, limit);
}
export async function getMessVendorContractById(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof MessVendorContract>>(MessVendorContract, id, collegeId, 'Vendor contract');
}
export async function updateMessVendorContractRecord(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await getMessVendorContractById(collegeId, id);
  Object.assign(doc, data);
  await doc.save();
  await audit(collegeId, 'MessVendorContract', String(doc._id), `Vendor Contract - ${String(doc.vendorId)}`, 'update', performedBy);
  return doc;
}
export async function deleteMessVendorContract(collegeId: string, id: string, performedBy: string) {
  const doc = await getMessVendorContractById(collegeId, id);
  await doc.deleteOne();
  await audit(collegeId, 'MessVendorContract', String(doc._id), `Vendor Contract - ${String(doc.vendorId)}`, 'delete', performedBy);
  return { success: true };
}

// ===========================================================================
// CRUD: RouteStop
// ===========================================================================

export async function listRouteStops(collegeId: string, page: number, limit: number, filter?: Record<string, unknown>) {
  return paginate(RouteStop, { collegeId, ...filter }, page, limit);
}
export async function getRouteStop(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof RouteStop>>(RouteStop, id, collegeId, 'Route stop');
}
export async function createRouteStop(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await RouteStop.create({ ...data, collegeId });
  await audit(collegeId, 'RouteStop', String(doc._id), doc.name, 'create', performedBy);
  return doc;
}
export async function updateRouteStop(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await getRouteStop(collegeId, id);
  Object.assign(doc, data);
  await doc.save();
  await audit(collegeId, 'RouteStop', String(doc._id), doc.name, 'update', performedBy);
  return doc;
}
export async function deleteRouteStop(collegeId: string, id: string, performedBy: string) {
  const doc = await getRouteStop(collegeId, id);
  await doc.deleteOne();
  await audit(collegeId, 'RouteStop', String(doc._id), doc.name, 'delete', performedBy);
  return { success: true };
}

// ===========================================================================
// CRUD: Driver
// ===========================================================================

export async function listDrivers(collegeId: string, page: number, limit: number) {
  return paginate(Driver, { collegeId }, page, limit);
}
export async function getDriver(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof Driver>>(Driver, id, collegeId, 'Driver');
}
export async function createDriver(collegeId: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await Driver.create({ ...data, collegeId });
  await audit(collegeId, 'Driver', String(doc._id), `Driver - ${doc.licenseNumber}`, 'create', performedBy);
  return doc;
}
export async function updateDriver(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await getDriver(collegeId, id);
  Object.assign(doc, data);
  await doc.save();
  await audit(collegeId, 'Driver', String(doc._id), `Driver - ${doc.licenseNumber}`, 'update', performedBy);
  return doc;
}
export async function deleteDriver(collegeId: string, id: string, performedBy: string) {
  const doc = await getDriver(collegeId, id);
  await doc.deleteOne();
  await audit(collegeId, 'Driver', String(doc._id), `Driver - ${doc.licenseNumber}`, 'delete', performedBy);
  return { success: true };
}

// ===========================================================================
// CRUD: TripLog
// ===========================================================================

export async function listTripLogs(collegeId: string, page: number, limit: number, filter?: Record<string, unknown>) {
  return paginate(TripLog, { collegeId, ...filter }, page, limit);
}
export async function getTripLog(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof TripLog>>(TripLog, id, collegeId, 'Trip log');
}
export async function updateTripLog(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await getTripLog(collegeId, id);
  Object.assign(doc, data);
  await doc.save();
  await audit(collegeId, 'TripLog', String(doc._id), `Trip - ${doc.tripType}`, 'update', performedBy);
  return doc;
}
export async function deleteTripLog(collegeId: string, id: string, performedBy: string) {
  const doc = await getTripLog(collegeId, id);
  await doc.deleteOne();
  await audit(collegeId, 'TripLog', String(doc._id), `Trip - ${doc.tripType}`, 'delete', performedBy);
  return { success: true };
}

// CRUD: TransportAttendance (list/get only — immutable)
export async function listTransportAttendances(collegeId: string, page: number, limit: number, filter?: Record<string, unknown>) {
  return paginate(TransportAttendance, { collegeId, ...filter }, page, limit);
}
export async function getTransportAttendance(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof TransportAttendance>>(TransportAttendance, id, collegeId, 'Transport attendance');
}

// ===========================================================================
// CRUD: TransportContractor
// ===========================================================================

export async function listTransportContractors(collegeId: string, page: number, limit: number) {
  return paginate(TransportContractor, { collegeId }, page, limit);
}
export async function getTransportContractor(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof TransportContractor>>(TransportContractor, id, collegeId, 'Transport contractor');
}
export async function updateTransportContractor(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await getTransportContractor(collegeId, id);
  Object.assign(doc, data);
  await doc.save();
  await audit(collegeId, 'TransportContractor', String(doc._id), `Transport Contract - ${doc.contractNumber}`, 'update', performedBy);
  return doc;
}
export async function deleteTransportContractor(collegeId: string, id: string, performedBy: string) {
  const doc = await getTransportContractor(collegeId, id);
  await doc.deleteOne();
  await audit(collegeId, 'TransportContractor', String(doc._id), `Transport Contract - ${doc.contractNumber}`, 'delete', performedBy);
  return { success: true };
}

// ===========================================================================
// CRUD: TransportClearance
// ===========================================================================

export async function listTransportClearances(collegeId: string, page: number, limit: number) {
  return paginate(TransportClearance, { collegeId }, page, limit);
}
export async function getTransportClearance(collegeId: string, id: string) {
  return findOrFail<InstanceType<typeof TransportClearance>>(TransportClearance, id, collegeId, 'Transport clearance');
}
export async function updateTransportClearance(collegeId: string, id: string, data: Record<string, unknown>, performedBy: string) {
  const doc = await getTransportClearance(collegeId, id);
  Object.assign(doc, data);
  await doc.save();
  await audit(collegeId, 'TransportClearance', String(doc._id), `Transport Clearance - ${String(doc.studentId)}`, 'update', performedBy);
  return doc;
}
export async function deleteTransportClearance(collegeId: string, id: string, performedBy: string) {
  const doc = await getTransportClearance(collegeId, id);
  await doc.deleteOne();
  await audit(collegeId, 'TransportClearance', String(doc._id), `Transport Clearance - ${String(doc.studentId)}`, 'delete', performedBy);
  return { success: true };
}

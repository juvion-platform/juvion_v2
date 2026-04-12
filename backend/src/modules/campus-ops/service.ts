// campus-ops module service — sub-domains: CAMPUS (14), FACILITIES (14), LIBRARY (9)
import { Building } from '../../models/campus/Building';
import { Room } from '../../models/campus/Room';
import { RoomBooking } from '../../models/campus/RoomBooking';
import { Vehicle } from '../../models/campus/Vehicle';
import { GatePass } from '../../models/campus/GatePass';
import { VisitorEntry } from '../../models/campus/VisitorEntry';
import { SecurityIncident } from '../../models/campus/SecurityIncident';
import { CCTV } from '../../models/campus/CCTV';
import { EmergencyContact } from '../../models/campus/EmergencyContact';
import { Lab } from '../../models/campus/Lab';
import { ParkingSlot } from '../../models/campus/ParkingSlot';
import { PowerBackup } from '../../models/campus/PowerBackup';
import { GreenInitiative } from '../../models/campus/GreenInitiative';
import { WaterSupply } from '../../models/campus/WaterSupply';

import { Asset } from '../../models/facilities/Asset';
import { AssetAllocation } from '../../models/facilities/AssetAllocation';
import { MaintenanceRequest } from '../../models/facilities/MaintenanceRequest';
import { MaintenanceSchedule } from '../../models/facilities/MaintenanceSchedule';
import { ConstructionProject } from '../../models/facilities/ConstructionProject';
import { Vendor } from '../../models/facilities/Vendor';
import { PurchaseOrder } from '../../models/facilities/PurchaseOrder';
import { StockItem } from '../../models/facilities/StockItem';
import { StockTransaction } from '../../models/facilities/StockTransaction';
import { ITAsset } from '../../models/facilities/ITAsset';
import { NetworkInfra } from '../../models/facilities/NetworkInfra';
import { Insurance } from '../../models/facilities/Insurance';
import { EnergyConsumption } from '../../models/facilities/EnergyConsumption';
import { WasteManagement } from '../../models/facilities/WasteManagement';

import { Book } from '../../models/library/Book';
import { BookIssue } from '../../models/library/BookIssue';
import { BookReservation } from '../../models/library/BookReservation';
import { LibraryMember } from '../../models/library/LibraryMember';
import { LibraryFine } from '../../models/library/LibraryFine';
import { LibraryGateEntry } from '../../models/library/LibraryGateEntry';
import { EResource } from '../../models/library/EResource';
import { EResourceAccess } from '../../models/library/EResourceAccess';
import { PeriodicalSubscription } from '../../models/library/PeriodicalSubscription';

import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';

// Populate helpers
const FACULTY_POPULATE = { path: 'labInChargeId', populate: { path: 'personId' } };
const DRIVER_POPULATE = { path: 'driverId', populate: { path: 'personId' } };
const STAFF_ASSIGNED_POPULATE = { path: 'assignedTo', populate: { path: 'personId' } };

// ─── Dashboard Stats ──────────────────────────────────────
export async function getStats(collegeId: string) {
  const [
    buildings, rooms, roomBookings, vehicles, gatePasses, visitors,
    incidents, cctvCameras, labs, parkingSlots, assets, maintenanceRequests,
    vendors, purchaseOrders, stockItems, itAssets, books, bookIssues,
    libraryMembers, eResources,
  ] = await Promise.all([
    Building.countDocuments({ collegeId }),
    Room.countDocuments({ collegeId }),
    RoomBooking.countDocuments({ collegeId }),
    Vehicle.countDocuments({ collegeId }),
    GatePass.countDocuments({ collegeId }),
    VisitorEntry.countDocuments({ collegeId }),
    SecurityIncident.countDocuments({ collegeId }),
    CCTV.countDocuments({ collegeId }),
    Lab.countDocuments({ collegeId }),
    ParkingSlot.countDocuments({ collegeId }),
    Asset.countDocuments({ collegeId }),
    MaintenanceRequest.countDocuments({ collegeId }),
    Vendor.countDocuments({ collegeId }),
    PurchaseOrder.countDocuments({ collegeId }),
    StockItem.countDocuments({ collegeId }),
    ITAsset.countDocuments({ collegeId }),
    Book.countDocuments({ collegeId }),
    BookIssue.countDocuments({ collegeId }),
    LibraryMember.countDocuments({ collegeId }),
    EResource.countDocuments({ collegeId }),
  ]);

  return {
    buildings, rooms, roomBookings, vehicles, gatePasses, visitors,
    incidents, cctvCameras, labs, parkingSlots, assets, maintenanceRequests,
    vendors, purchaseOrders, stockItems, itAssets, books, bookIssues,
    libraryMembers, eResources,
  };
}

// ═══════════════════════════════════════════════════════════
// CAMPUS SUB-DOMAIN (14 models)
// ═══════════════════════════════════════════════════════════

// ═══ Building ════════════════════════════════════════════
export async function listBuildings(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Building, filter, page, limit, { createdAt: -1 });
}
export async function getBuilding(collegeId: string, id: string) {
  const doc = await Building.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Building not found');
  return doc;
}
export async function createBuilding(collegeId: string, data: any, who: string) {
  const doc = await Building.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Building', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateBuilding(collegeId: string, id: string, data: any, who: string) {
  const doc = await Building.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Building not found');
  await createAuditLog({ collegeId, entityType: 'Building', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteBuilding(collegeId: string, id: string, who: string) {
  const doc = await Building.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Building not found');
  await createAuditLog({ collegeId, entityType: 'Building', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Room ════════════════════════════════════════════════
export async function listRooms(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Room, filter, page, limit, { createdAt: -1 }, ['buildingId']);
}
export async function getRoom(collegeId: string, id: string) {
  const doc = await Room.findOne({ _id: id, collegeId }).populate('buildingId');
  if (!doc) throw new AppError(404, 'Room not found');
  return doc;
}
export async function createRoom(collegeId: string, data: any, who: string) {
  const doc = await Room.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Room', entityId: String(doc._id), entityName: data.roomNumber, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateRoom(collegeId: string, id: string, data: any, who: string) {
  const doc = await Room.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Room not found');
  await createAuditLog({ collegeId, entityType: 'Room', entityId: id, entityName: doc.roomNumber, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteRoom(collegeId: string, id: string, who: string) {
  const doc = await Room.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Room not found');
  await createAuditLog({ collegeId, entityType: 'Room', entityId: id, entityName: doc.roomNumber, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ RoomBooking ═════════════════════════════════════════
export async function listRoomBookings(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(RoomBooking, filter, page, limit, { createdAt: -1 }, ['roomId', 'bookedBy']);
}
export async function getRoomBooking(collegeId: string, id: string) {
  const doc = await RoomBooking.findOne({ _id: id, collegeId }).populate('roomId bookedBy');
  if (!doc) throw new AppError(404, 'Room booking not found');
  return doc;
}
export async function createRoomBooking(collegeId: string, data: any, who: string) {
  const doc = await RoomBooking.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'RoomBooking', entityId: String(doc._id), entityName: data.purpose, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateRoomBooking(collegeId: string, id: string, data: any, who: string) {
  const doc = await RoomBooking.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Room booking not found');
  await createAuditLog({ collegeId, entityType: 'RoomBooking', entityId: id, entityName: doc.purpose, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteRoomBooking(collegeId: string, id: string, who: string) {
  const doc = await RoomBooking.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Room booking not found');
  await createAuditLog({ collegeId, entityType: 'RoomBooking', entityId: id, entityName: doc.purpose, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Vehicle ═════════════════════════════════════════════
export async function listVehicles(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Vehicle, filter, page, limit, { createdAt: -1 }, [DRIVER_POPULATE] as any);
}
export async function getVehicle(collegeId: string, id: string) {
  const doc = await Vehicle.findOne({ _id: id, collegeId }).populate(DRIVER_POPULATE);
  if (!doc) throw new AppError(404, 'Vehicle not found');
  return doc;
}
export async function createVehicle(collegeId: string, data: any, who: string) {
  const doc = await Vehicle.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Vehicle', entityId: String(doc._id), entityName: data.vehicleNumber, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateVehicle(collegeId: string, id: string, data: any, who: string) {
  const doc = await Vehicle.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Vehicle not found');
  await createAuditLog({ collegeId, entityType: 'Vehicle', entityId: id, entityName: doc.vehicleNumber, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteVehicle(collegeId: string, id: string, who: string) {
  const doc = await Vehicle.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Vehicle not found');
  await createAuditLog({ collegeId, entityType: 'Vehicle', entityId: id, entityName: doc.vehicleNumber, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ GatePass ════════════════════════════════════════════
export async function listGatePasses(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(GatePass, filter, page, limit, { createdAt: -1 }, ['personId', 'approvedBy']);
}
export async function getGatePass(collegeId: string, id: string) {
  const doc = await GatePass.findOne({ _id: id, collegeId }).populate('personId approvedBy');
  if (!doc) throw new AppError(404, 'Gate pass not found');
  return doc;
}
export async function createGatePass(collegeId: string, data: any, who: string) {
  const doc = await GatePass.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'GatePass', entityId: String(doc._id), entityName: data.reason, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateGatePass(collegeId: string, id: string, data: any, who: string) {
  const doc = await GatePass.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Gate pass not found');
  await createAuditLog({ collegeId, entityType: 'GatePass', entityId: id, entityName: doc.reason, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteGatePass(collegeId: string, id: string, who: string) {
  const doc = await GatePass.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Gate pass not found');
  await createAuditLog({ collegeId, entityType: 'GatePass', entityId: id, entityName: doc.reason, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ VisitorEntry ════════════════════════════════════════
export async function listVisitorEntries(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(VisitorEntry, filter, page, limit, { createdAt: -1 });
}
export async function getVisitorEntry(collegeId: string, id: string) {
  const doc = await VisitorEntry.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Visitor entry not found');
  return doc;
}
export async function createVisitorEntry(collegeId: string, data: any, who: string) {
  const doc = await VisitorEntry.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'VisitorEntry', entityId: String(doc._id), entityName: data.visitorName, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateVisitorEntry(collegeId: string, id: string, data: any, who: string) {
  const doc = await VisitorEntry.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Visitor entry not found');
  await createAuditLog({ collegeId, entityType: 'VisitorEntry', entityId: id, entityName: doc.visitorName, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteVisitorEntry(collegeId: string, id: string, who: string) {
  const doc = await VisitorEntry.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Visitor entry not found');
  await createAuditLog({ collegeId, entityType: 'VisitorEntry', entityId: id, entityName: doc.visitorName, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ SecurityIncident ════════════════════════════════════
export async function listSecurityIncidents(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(SecurityIncident, filter, page, limit, { createdAt: -1 }, ['reportedBy']);
}
export async function getSecurityIncident(collegeId: string, id: string) {
  const doc = await SecurityIncident.findOne({ _id: id, collegeId }).populate('reportedBy');
  if (!doc) throw new AppError(404, 'Security incident not found');
  return doc;
}
export async function createSecurityIncident(collegeId: string, data: any, who: string) {
  const doc = await SecurityIncident.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'SecurityIncident', entityId: String(doc._id), entityName: data.type, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateSecurityIncident(collegeId: string, id: string, data: any, who: string) {
  const doc = await SecurityIncident.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Security incident not found');
  await createAuditLog({ collegeId, entityType: 'SecurityIncident', entityId: id, entityName: doc.type, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteSecurityIncident(collegeId: string, id: string, who: string) {
  const doc = await SecurityIncident.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Security incident not found');
  await createAuditLog({ collegeId, entityType: 'SecurityIncident', entityId: id, entityName: doc.type, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ CCTV ════════════════════════════════════════════════
export async function listCCTVs(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(CCTV, filter, page, limit, { createdAt: -1 }, ['buildingId']);
}
export async function getCCTV(collegeId: string, id: string) {
  const doc = await CCTV.findOne({ _id: id, collegeId }).populate('buildingId');
  if (!doc) throw new AppError(404, 'CCTV camera not found');
  return doc;
}
export async function createCCTV(collegeId: string, data: any, who: string) {
  const doc = await CCTV.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'CCTV', entityId: String(doc._id), entityName: data.cameraId, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateCCTV(collegeId: string, id: string, data: any, who: string) {
  const doc = await CCTV.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'CCTV camera not found');
  await createAuditLog({ collegeId, entityType: 'CCTV', entityId: id, entityName: doc.cameraId, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteCCTV(collegeId: string, id: string, who: string) {
  const doc = await CCTV.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'CCTV camera not found');
  await createAuditLog({ collegeId, entityType: 'CCTV', entityId: id, entityName: doc.cameraId, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ EmergencyContact ════════════════════════════════════
export async function listEmergencyContacts(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(EmergencyContact, filter, page, limit, { createdAt: -1 });
}
export async function getEmergencyContact(collegeId: string, id: string) {
  const doc = await EmergencyContact.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Emergency contact not found');
  return doc;
}
export async function createEmergencyContact(collegeId: string, data: any, who: string) {
  const doc = await EmergencyContact.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EmergencyContact', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateEmergencyContact(collegeId: string, id: string, data: any, who: string) {
  const doc = await EmergencyContact.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Emergency contact not found');
  await createAuditLog({ collegeId, entityType: 'EmergencyContact', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteEmergencyContact(collegeId: string, id: string, who: string) {
  const doc = await EmergencyContact.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Emergency contact not found');
  await createAuditLog({ collegeId, entityType: 'EmergencyContact', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Lab ═════════════════════════════════════════════════
export async function listLabs(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Lab, filter, page, limit, { createdAt: -1 }, ['roomId', 'departmentId', FACULTY_POPULATE] as any);
}
export async function getLab(collegeId: string, id: string) {
  const doc = await Lab.findOne({ _id: id, collegeId }).populate('roomId departmentId').populate(FACULTY_POPULATE);
  if (!doc) throw new AppError(404, 'Lab not found');
  return doc;
}
export async function createLab(collegeId: string, data: any, who: string) {
  const doc = await Lab.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Lab', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateLab(collegeId: string, id: string, data: any, who: string) {
  const doc = await Lab.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Lab not found');
  await createAuditLog({ collegeId, entityType: 'Lab', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteLab(collegeId: string, id: string, who: string) {
  const doc = await Lab.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lab not found');
  await createAuditLog({ collegeId, entityType: 'Lab', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ ParkingSlot ═════════════════════════════════════════
export async function listParkingSlots(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(ParkingSlot, filter, page, limit, { createdAt: -1 }, ['allocatedTo']);
}
export async function getParkingSlot(collegeId: string, id: string) {
  const doc = await ParkingSlot.findOne({ _id: id, collegeId }).populate('allocatedTo');
  if (!doc) throw new AppError(404, 'Parking slot not found');
  return doc;
}
export async function createParkingSlot(collegeId: string, data: any, who: string) {
  const doc = await ParkingSlot.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ParkingSlot', entityId: String(doc._id), entityName: `${data.zone}-${data.slotNumber}`, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateParkingSlot(collegeId: string, id: string, data: any, who: string) {
  const doc = await ParkingSlot.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Parking slot not found');
  await createAuditLog({ collegeId, entityType: 'ParkingSlot', entityId: id, entityName: `${doc.zone}-${doc.slotNumber}`, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteParkingSlot(collegeId: string, id: string, who: string) {
  const doc = await ParkingSlot.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Parking slot not found');
  await createAuditLog({ collegeId, entityType: 'ParkingSlot', entityId: id, entityName: `${doc.zone}-${doc.slotNumber}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ PowerBackup ═════════════════════════════════════════
export async function listPowerBackups(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(PowerBackup, filter, page, limit, { createdAt: -1 });
}
export async function getPowerBackup(collegeId: string, id: string) {
  const doc = await PowerBackup.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Power backup not found');
  return doc;
}
export async function createPowerBackup(collegeId: string, data: any, who: string) {
  const doc = await PowerBackup.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PowerBackup', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updatePowerBackup(collegeId: string, id: string, data: any, who: string) {
  const doc = await PowerBackup.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Power backup not found');
  await createAuditLog({ collegeId, entityType: 'PowerBackup', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deletePowerBackup(collegeId: string, id: string, who: string) {
  const doc = await PowerBackup.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Power backup not found');
  await createAuditLog({ collegeId, entityType: 'PowerBackup', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ GreenInitiative ═════════════════════════════════════
export async function listGreenInitiatives(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(GreenInitiative, filter, page, limit, { createdAt: -1 }, ['coordinatorId']);
}
export async function getGreenInitiative(collegeId: string, id: string) {
  const doc = await GreenInitiative.findOne({ _id: id, collegeId }).populate('coordinatorId');
  if (!doc) throw new AppError(404, 'Green initiative not found');
  return doc;
}
export async function createGreenInitiative(collegeId: string, data: any, who: string) {
  const doc = await GreenInitiative.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'GreenInitiative', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateGreenInitiative(collegeId: string, id: string, data: any, who: string) {
  const doc = await GreenInitiative.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Green initiative not found');
  await createAuditLog({ collegeId, entityType: 'GreenInitiative', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteGreenInitiative(collegeId: string, id: string, who: string) {
  const doc = await GreenInitiative.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Green initiative not found');
  await createAuditLog({ collegeId, entityType: 'GreenInitiative', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ WaterSupply ═════════════════════════════════════════
export async function listWaterSupplies(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(WaterSupply, filter, page, limit, { createdAt: -1 });
}
export async function getWaterSupply(collegeId: string, id: string) {
  const doc = await WaterSupply.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Water supply not found');
  return doc;
}
export async function createWaterSupply(collegeId: string, data: any, who: string) {
  const doc = await WaterSupply.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'WaterSupply', entityId: String(doc._id), entityName: data.tankName, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateWaterSupply(collegeId: string, id: string, data: any, who: string) {
  const doc = await WaterSupply.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Water supply not found');
  await createAuditLog({ collegeId, entityType: 'WaterSupply', entityId: id, entityName: doc.tankName, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteWaterSupply(collegeId: string, id: string, who: string) {
  const doc = await WaterSupply.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Water supply not found');
  await createAuditLog({ collegeId, entityType: 'WaterSupply', entityId: id, entityName: doc.tankName, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══════════════════════════════════════════════════════════
// FACILITIES SUB-DOMAIN (14 models)
// ═══════════════════════════════════════════════════════════

// ═══ Asset ═══════════════════════════════════════════════
export async function listAssets(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Asset, filter, page, limit, { createdAt: -1 }, ['departmentId']);
}
export async function getAsset(collegeId: string, id: string) {
  const doc = await Asset.findOne({ _id: id, collegeId }).populate('departmentId');
  if (!doc) throw new AppError(404, 'Asset not found');
  return doc;
}
export async function createAsset(collegeId: string, data: any, who: string) {
  const doc = await Asset.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Asset', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateAsset(collegeId: string, id: string, data: any, who: string) {
  const doc = await Asset.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Asset not found');
  await createAuditLog({ collegeId, entityType: 'Asset', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteAsset(collegeId: string, id: string, who: string) {
  const doc = await Asset.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Asset not found');
  await createAuditLog({ collegeId, entityType: 'Asset', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ AssetAllocation ═════════════════════════════════════
export async function listAssetAllocations(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AssetAllocation, filter, page, limit, { createdAt: -1 }, ['assetId', 'allocatedTo']);
}
export async function getAssetAllocation(collegeId: string, id: string) {
  const doc = await AssetAllocation.findOne({ _id: id, collegeId }).populate('assetId allocatedTo');
  if (!doc) throw new AppError(404, 'Asset allocation not found');
  return doc;
}
export async function createAssetAllocation(collegeId: string, data: any, who: string) {
  const doc = await AssetAllocation.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AssetAllocation', entityId: String(doc._id), entityName: 'Allocation', action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateAssetAllocation(collegeId: string, id: string, data: any, who: string) {
  const doc = await AssetAllocation.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Asset allocation not found');
  await createAuditLog({ collegeId, entityType: 'AssetAllocation', entityId: id, entityName: 'Allocation', action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteAssetAllocation(collegeId: string, id: string, who: string) {
  const doc = await AssetAllocation.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Asset allocation not found');
  await createAuditLog({ collegeId, entityType: 'AssetAllocation', entityId: id, entityName: 'Allocation', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ MaintenanceRequest ══════════════════════════════════
export async function listMaintenanceRequests(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(MaintenanceRequest, filter, page, limit, { createdAt: -1 }, ['requestedBy', STAFF_ASSIGNED_POPULATE] as any);
}
export async function getMaintenanceRequest(collegeId: string, id: string) {
  const doc = await MaintenanceRequest.findOne({ _id: id, collegeId }).populate('requestedBy').populate(STAFF_ASSIGNED_POPULATE);
  if (!doc) throw new AppError(404, 'Maintenance request not found');
  return doc;
}
export async function createMaintenanceRequest(collegeId: string, data: any, who: string) {
  const doc = await MaintenanceRequest.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'MaintenanceRequest', entityId: String(doc._id), entityName: data.category, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateMaintenanceRequest(collegeId: string, id: string, data: any, who: string) {
  const doc = await MaintenanceRequest.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Maintenance request not found');
  await createAuditLog({ collegeId, entityType: 'MaintenanceRequest', entityId: id, entityName: doc.category, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteMaintenanceRequest(collegeId: string, id: string, who: string) {
  const doc = await MaintenanceRequest.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Maintenance request not found');
  await createAuditLog({ collegeId, entityType: 'MaintenanceRequest', entityId: id, entityName: doc.category, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ MaintenanceSchedule ═════════════════════════════════
export async function listMaintenanceSchedules(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(MaintenanceSchedule, filter, page, limit, { createdAt: -1 }, ['assetId']);
}
export async function getMaintenanceSchedule(collegeId: string, id: string) {
  const doc = await MaintenanceSchedule.findOne({ _id: id, collegeId }).populate('assetId');
  if (!doc) throw new AppError(404, 'Maintenance schedule not found');
  return doc;
}
export async function createMaintenanceSchedule(collegeId: string, data: any, who: string) {
  const doc = await MaintenanceSchedule.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'MaintenanceSchedule', entityId: String(doc._id), entityName: data.facilityName, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateMaintenanceSchedule(collegeId: string, id: string, data: any, who: string) {
  const doc = await MaintenanceSchedule.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Maintenance schedule not found');
  await createAuditLog({ collegeId, entityType: 'MaintenanceSchedule', entityId: id, entityName: doc.facilityName, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteMaintenanceSchedule(collegeId: string, id: string, who: string) {
  const doc = await MaintenanceSchedule.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Maintenance schedule not found');
  await createAuditLog({ collegeId, entityType: 'MaintenanceSchedule', entityId: id, entityName: doc.facilityName, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ ConstructionProject ═════════════════════════════════
export async function listConstructionProjects(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(ConstructionProject, filter, page, limit, { createdAt: -1 });
}
export async function getConstructionProject(collegeId: string, id: string) {
  const doc = await ConstructionProject.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Construction project not found');
  return doc;
}
export async function createConstructionProject(collegeId: string, data: any, who: string) {
  const doc = await ConstructionProject.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ConstructionProject', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateConstructionProject(collegeId: string, id: string, data: any, who: string) {
  const doc = await ConstructionProject.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Construction project not found');
  await createAuditLog({ collegeId, entityType: 'ConstructionProject', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteConstructionProject(collegeId: string, id: string, who: string) {
  const doc = await ConstructionProject.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Construction project not found');
  await createAuditLog({ collegeId, entityType: 'ConstructionProject', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Vendor ══════════════════════════════════════════════
export async function listVendors(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Vendor, filter, page, limit, { createdAt: -1 });
}
export async function getVendor(collegeId: string, id: string) {
  const doc = await Vendor.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Vendor not found');
  return doc;
}
export async function createVendor(collegeId: string, data: any, who: string) {
  const doc = await Vendor.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Vendor', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateVendor(collegeId: string, id: string, data: any, who: string) {
  const doc = await Vendor.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Vendor not found');
  await createAuditLog({ collegeId, entityType: 'Vendor', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteVendor(collegeId: string, id: string, who: string) {
  const doc = await Vendor.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Vendor not found');
  await createAuditLog({ collegeId, entityType: 'Vendor', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ PurchaseOrder ═══════════════════════════════════════
export async function listPurchaseOrders(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(PurchaseOrder, filter, page, limit, { createdAt: -1 }, ['vendorId', 'requestedBy', 'approvedBy']);
}
export async function getPurchaseOrder(collegeId: string, id: string) {
  const doc = await PurchaseOrder.findOne({ _id: id, collegeId }).populate('vendorId requestedBy approvedBy');
  if (!doc) throw new AppError(404, 'Purchase order not found');
  return doc;
}
export async function createPurchaseOrder(collegeId: string, data: any, who: string) {
  const doc = await PurchaseOrder.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PurchaseOrder', entityId: String(doc._id), entityName: data.poNumber, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updatePurchaseOrder(collegeId: string, id: string, data: any, who: string) {
  const doc = await PurchaseOrder.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Purchase order not found');
  await createAuditLog({ collegeId, entityType: 'PurchaseOrder', entityId: id, entityName: doc.poNumber, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deletePurchaseOrder(collegeId: string, id: string, who: string) {
  const doc = await PurchaseOrder.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Purchase order not found');
  await createAuditLog({ collegeId, entityType: 'PurchaseOrder', entityId: id, entityName: doc.poNumber, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ StockItem ═══════════════════════════════════════════
export async function listStockItems(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(StockItem, filter, page, limit, { createdAt: -1 });
}
export async function getStockItem(collegeId: string, id: string) {
  const doc = await StockItem.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Stock item not found');
  return doc;
}
export async function createStockItem(collegeId: string, data: any, who: string) {
  const doc = await StockItem.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'StockItem', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateStockItem(collegeId: string, id: string, data: any, who: string) {
  const doc = await StockItem.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Stock item not found');
  await createAuditLog({ collegeId, entityType: 'StockItem', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteStockItem(collegeId: string, id: string, who: string) {
  const doc = await StockItem.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Stock item not found');
  await createAuditLog({ collegeId, entityType: 'StockItem', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ StockTransaction ════════════════════════════════════
export async function listStockTransactions(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(StockTransaction, filter, page, limit, { createdAt: -1 }, ['stockItemId', 'doneBy']);
}
export async function getStockTransaction(collegeId: string, id: string) {
  const doc = await StockTransaction.findOne({ _id: id, collegeId }).populate('stockItemId doneBy');
  if (!doc) throw new AppError(404, 'Stock transaction not found');
  return doc;
}
export async function createStockTransaction(collegeId: string, data: any, who: string) {
  const doc = await StockTransaction.create({ ...data, collegeId });
  // Update stock level
  if (data.stockItemId && data.quantity) {
    const qty = data.type === 'out' ? -data.quantity : data.quantity;
    await StockItem.findByIdAndUpdate(data.stockItemId, { $inc: { currentStock: qty } });
  }
  await createAuditLog({ collegeId, entityType: 'StockTransaction', entityId: String(doc._id), entityName: data.type, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateStockTransaction(collegeId: string, id: string, data: any, who: string) {
  const doc = await StockTransaction.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Stock transaction not found');
  await createAuditLog({ collegeId, entityType: 'StockTransaction', entityId: id, entityName: doc.type, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteStockTransaction(collegeId: string, id: string, who: string) {
  const doc = await StockTransaction.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Stock transaction not found');
  await createAuditLog({ collegeId, entityType: 'StockTransaction', entityId: id, entityName: doc.type, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ ITAsset ═════════════════════════════════════════════
export async function listITAssets(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(ITAsset, filter, page, limit, { createdAt: -1 }, ['assignedTo']);
}
export async function getITAsset(collegeId: string, id: string) {
  const doc = await ITAsset.findOne({ _id: id, collegeId }).populate('assignedTo');
  if (!doc) throw new AppError(404, 'IT asset not found');
  return doc;
}
export async function createITAsset(collegeId: string, data: any, who: string) {
  const doc = await ITAsset.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ITAsset', entityId: String(doc._id), entityName: data.serialNumber, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateITAsset(collegeId: string, id: string, data: any, who: string) {
  const doc = await ITAsset.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'IT asset not found');
  await createAuditLog({ collegeId, entityType: 'ITAsset', entityId: id, entityName: doc.serialNumber, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteITAsset(collegeId: string, id: string, who: string) {
  const doc = await ITAsset.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'IT asset not found');
  await createAuditLog({ collegeId, entityType: 'ITAsset', entityId: id, entityName: doc.serialNumber, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ NetworkInfra ════════════════════════════════════════
export async function listNetworkInfra(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(NetworkInfra, filter, page, limit, { createdAt: -1 });
}
export async function getNetworkInfra(collegeId: string, id: string) {
  const doc = await NetworkInfra.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Network infra not found');
  return doc;
}
export async function createNetworkInfra(collegeId: string, data: any, who: string) {
  const doc = await NetworkInfra.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'NetworkInfra', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateNetworkInfra(collegeId: string, id: string, data: any, who: string) {
  const doc = await NetworkInfra.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Network infra not found');
  await createAuditLog({ collegeId, entityType: 'NetworkInfra', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteNetworkInfra(collegeId: string, id: string, who: string) {
  const doc = await NetworkInfra.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Network infra not found');
  await createAuditLog({ collegeId, entityType: 'NetworkInfra', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ Insurance ═══════════════════════════════════════════
export async function listInsurances(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Insurance, filter, page, limit, { createdAt: -1 });
}
export async function getInsurance(collegeId: string, id: string) {
  const doc = await Insurance.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Insurance not found');
  return doc;
}
export async function createInsurance(collegeId: string, data: any, who: string) {
  const doc = await Insurance.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Insurance', entityId: String(doc._id), entityName: data.policyNumber, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateInsurance(collegeId: string, id: string, data: any, who: string) {
  const doc = await Insurance.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Insurance not found');
  await createAuditLog({ collegeId, entityType: 'Insurance', entityId: id, entityName: doc.policyNumber, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteInsurance(collegeId: string, id: string, who: string) {
  const doc = await Insurance.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Insurance not found');
  await createAuditLog({ collegeId, entityType: 'Insurance', entityId: id, entityName: doc.policyNumber, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ EnergyConsumption ═══════════════════════════════════
export async function listEnergyConsumptions(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(EnergyConsumption, filter, page, limit, { year: -1, month: -1 }, ['buildingId']);
}
export async function getEnergyConsumption(collegeId: string, id: string) {
  const doc = await EnergyConsumption.findOne({ _id: id, collegeId }).populate('buildingId');
  if (!doc) throw new AppError(404, 'Energy consumption not found');
  return doc;
}
export async function createEnergyConsumption(collegeId: string, data: any, who: string) {
  const doc = await EnergyConsumption.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EnergyConsumption', entityId: String(doc._id), entityName: `${data.month}/${data.year}`, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateEnergyConsumption(collegeId: string, id: string, data: any, who: string) {
  const doc = await EnergyConsumption.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Energy consumption not found');
  await createAuditLog({ collegeId, entityType: 'EnergyConsumption', entityId: id, entityName: `${doc.month}/${doc.year}`, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteEnergyConsumption(collegeId: string, id: string, who: string) {
  const doc = await EnergyConsumption.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Energy consumption not found');
  await createAuditLog({ collegeId, entityType: 'EnergyConsumption', entityId: id, entityName: `${doc.month}/${doc.year}`, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ WasteManagement ═════════════════════════════════════
export async function listWasteManagements(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(WasteManagement, filter, page, limit, { createdAt: -1 });
}
export async function getWasteManagement(collegeId: string, id: string) {
  const doc = await WasteManagement.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Waste management record not found');
  return doc;
}
export async function createWasteManagement(collegeId: string, data: any, who: string) {
  const doc = await WasteManagement.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'WasteManagement', entityId: String(doc._id), entityName: data.wasteType, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateWasteManagement(collegeId: string, id: string, data: any, who: string) {
  const doc = await WasteManagement.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Waste management record not found');
  await createAuditLog({ collegeId, entityType: 'WasteManagement', entityId: id, entityName: doc.wasteType, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteWasteManagement(collegeId: string, id: string, who: string) {
  const doc = await WasteManagement.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Waste management record not found');
  await createAuditLog({ collegeId, entityType: 'WasteManagement', entityId: id, entityName: doc.wasteType, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══════════════════════════════════════════════════════════
// LIBRARY SUB-DOMAIN (9 models)
// ═══════════════════════════════════════════════════════════

// ═══ Book ════════════════════════════════════════════════
export async function listBooks(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Book, filter, page, limit, { createdAt: -1 }, ['departmentId']);
}
export async function getBook(collegeId: string, id: string) {
  const doc = await Book.findOne({ _id: id, collegeId }).populate('departmentId');
  if (!doc) throw new AppError(404, 'Book not found');
  return doc;
}
export async function createBook(collegeId: string, data: any, who: string) {
  const doc = await Book.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Book', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateBook(collegeId: string, id: string, data: any, who: string) {
  const doc = await Book.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Book not found');
  await createAuditLog({ collegeId, entityType: 'Book', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteBook(collegeId: string, id: string, who: string) {
  const doc = await Book.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Book not found');
  await createAuditLog({ collegeId, entityType: 'Book', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ BookIssue ═══════════════════════════════════════════
export async function listBookIssues(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'issuedTo' });
  return paginate(BookIssue, filter, page, limit, { createdAt: -1 }, ['bookId', 'issuedTo']);
}
export async function getBookIssue(collegeId: string, id: string) {
  const doc = await BookIssue.findOne({ _id: id, collegeId }).populate('bookId issuedTo');
  if (!doc) throw new AppError(404, 'Book issue not found');
  return doc;
}
export async function createBookIssue(collegeId: string, data: any, who: string) {
  const doc = await BookIssue.create({ ...data, collegeId });
  // Decrement available copies
  if (data.bookId) {
    await Book.findByIdAndUpdate(data.bookId, { $inc: { availableCopies: -1 } });
  }
  await createAuditLog({ collegeId, entityType: 'BookIssue', entityId: String(doc._id), entityName: 'Issue', action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateBookIssue(collegeId: string, id: string, data: any, who: string) {
  const doc = await BookIssue.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Book issue not found');
  // If returned, increment available copies
  if (data.status === 'returned' && doc.bookId) {
    await Book.findByIdAndUpdate(doc.bookId, { $inc: { availableCopies: 1 } });
  }
  await createAuditLog({ collegeId, entityType: 'BookIssue', entityId: id, entityName: 'Issue', action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteBookIssue(collegeId: string, id: string, who: string) {
  const doc = await BookIssue.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Book issue not found');
  await createAuditLog({ collegeId, entityType: 'BookIssue', entityId: id, entityName: 'Issue', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ BookReservation ═════════════════════════════════════
export async function listBookReservations(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'reservedBy' });
  return paginate(BookReservation, filter, page, limit, { createdAt: -1 }, ['bookId', 'reservedBy']);
}
export async function getBookReservation(collegeId: string, id: string) {
  const doc = await BookReservation.findOne({ _id: id, collegeId }).populate('bookId reservedBy');
  if (!doc) throw new AppError(404, 'Book reservation not found');
  return doc;
}
export async function createBookReservation(collegeId: string, data: any, who: string) {
  const doc = await BookReservation.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'BookReservation', entityId: String(doc._id), entityName: 'Reservation', action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateBookReservation(collegeId: string, id: string, data: any, who: string) {
  const doc = await BookReservation.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Book reservation not found');
  await createAuditLog({ collegeId, entityType: 'BookReservation', entityId: id, entityName: 'Reservation', action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteBookReservation(collegeId: string, id: string, who: string) {
  const doc = await BookReservation.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Book reservation not found');
  await createAuditLog({ collegeId, entityType: 'BookReservation', entityId: id, entityName: 'Reservation', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ LibraryMember ═══════════════════════════════════════
export async function listLibraryMembers(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });
  return paginate(LibraryMember, filter, page, limit, { createdAt: -1 }, ['personId']);
}
export async function getLibraryMember(collegeId: string, id: string) {
  const doc = await LibraryMember.findOne({ _id: id, collegeId }).populate('personId');
  if (!doc) throw new AppError(404, 'Library member not found');
  return doc;
}
export async function createLibraryMember(collegeId: string, data: any, who: string) {
  const doc = await LibraryMember.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'LibraryMember', entityId: String(doc._id), entityName: data.membershipId, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateLibraryMember(collegeId: string, id: string, data: any, who: string) {
  const doc = await LibraryMember.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Library member not found');
  await createAuditLog({ collegeId, entityType: 'LibraryMember', entityId: id, entityName: doc.membershipId, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteLibraryMember(collegeId: string, id: string, who: string) {
  const doc = await LibraryMember.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Library member not found');
  await createAuditLog({ collegeId, entityType: 'LibraryMember', entityId: id, entityName: doc.membershipId, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ LibraryFine ═════════════════════════════════════════
export async function listLibraryFines(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'memberId' });
  return paginate(LibraryFine, filter, page, limit, { createdAt: -1 }, ['memberId', 'bookIssueId']);
}
export async function getLibraryFine(collegeId: string, id: string) {
  const doc = await LibraryFine.findOne({ _id: id, collegeId }).populate('memberId bookIssueId');
  if (!doc) throw new AppError(404, 'Library fine not found');
  return doc;
}
export async function createLibraryFine(collegeId: string, data: any, who: string) {
  const doc = await LibraryFine.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'LibraryFine', entityId: String(doc._id), entityName: data.reason, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateLibraryFine(collegeId: string, id: string, data: any, who: string) {
  const doc = await LibraryFine.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Library fine not found');
  await createAuditLog({ collegeId, entityType: 'LibraryFine', entityId: id, entityName: doc.reason, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteLibraryFine(collegeId: string, id: string, who: string) {
  const doc = await LibraryFine.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Library fine not found');
  await createAuditLog({ collegeId, entityType: 'LibraryFine', entityId: id, entityName: doc.reason, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ LibraryGateEntry ════════════════════════════════════
export async function listLibraryGateEntries(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });
  return paginate(LibraryGateEntry, filter, page, limit, { createdAt: -1 }, ['personId']);
}
export async function getLibraryGateEntry(collegeId: string, id: string) {
  const doc = await LibraryGateEntry.findOne({ _id: id, collegeId }).populate('personId');
  if (!doc) throw new AppError(404, 'Library gate entry not found');
  return doc;
}
export async function createLibraryGateEntry(collegeId: string, data: any, who: string) {
  const doc = await LibraryGateEntry.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'LibraryGateEntry', entityId: String(doc._id), entityName: 'Entry', action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateLibraryGateEntry(collegeId: string, id: string, data: any, who: string) {
  const doc = await LibraryGateEntry.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Library gate entry not found');
  await createAuditLog({ collegeId, entityType: 'LibraryGateEntry', entityId: id, entityName: 'Entry', action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteLibraryGateEntry(collegeId: string, id: string, who: string) {
  const doc = await LibraryGateEntry.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Library gate entry not found');
  await createAuditLog({ collegeId, entityType: 'LibraryGateEntry', entityId: id, entityName: 'Entry', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ EResource ═══════════════════════════════════════════
export async function listEResources(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(EResource, filter, page, limit, { createdAt: -1 });
}
export async function getEResource(collegeId: string, id: string) {
  const doc = await EResource.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'E-Resource not found');
  return doc;
}
export async function createEResource(collegeId: string, data: any, who: string) {
  const doc = await EResource.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EResource', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateEResource(collegeId: string, id: string, data: any, who: string) {
  const doc = await EResource.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'E-Resource not found');
  await createAuditLog({ collegeId, entityType: 'EResource', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteEResource(collegeId: string, id: string, who: string) {
  const doc = await EResource.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'E-Resource not found');
  await createAuditLog({ collegeId, entityType: 'EResource', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ EResourceAccess ═════════════════════════════════════
export async function listEResourceAccesses(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });
  return paginate(EResourceAccess, filter, page, limit, { createdAt: -1 }, ['eResourceId', 'personId']);
}
export async function getEResourceAccess(collegeId: string, id: string) {
  const doc = await EResourceAccess.findOne({ _id: id, collegeId }).populate('eResourceId personId');
  if (!doc) throw new AppError(404, 'E-Resource access not found');
  return doc;
}
export async function createEResourceAccess(collegeId: string, data: any, who: string) {
  const doc = await EResourceAccess.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'EResourceAccess', entityId: String(doc._id), entityName: 'Access', action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updateEResourceAccess(collegeId: string, id: string, data: any, who: string) {
  const doc = await EResourceAccess.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'E-Resource access not found');
  await createAuditLog({ collegeId, entityType: 'EResourceAccess', entityId: id, entityName: 'Access', action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deleteEResourceAccess(collegeId: string, id: string, who: string) {
  const doc = await EResourceAccess.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'E-Resource access not found');
  await createAuditLog({ collegeId, entityType: 'EResourceAccess', entityId: id, entityName: 'Access', action: 'delete', changes: [], performedBy: who });
  return doc;
}

// ═══ PeriodicalSubscription ══════════════════════════════
export async function listPeriodicalSubscriptions(collegeId: string, page = 1, limit = 20, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(PeriodicalSubscription, filter, page, limit, { createdAt: -1 });
}
export async function getPeriodicalSubscription(collegeId: string, id: string) {
  const doc = await PeriodicalSubscription.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Periodical subscription not found');
  return doc;
}
export async function createPeriodicalSubscription(collegeId: string, data: any, who: string) {
  const doc = await PeriodicalSubscription.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'PeriodicalSubscription', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy: who });
  return doc;
}
export async function updatePeriodicalSubscription(collegeId: string, id: string, data: any, who: string) {
  const doc = await PeriodicalSubscription.findOneAndUpdate({ _id: id, collegeId }, data, { new: true });
  if (!doc) throw new AppError(404, 'Periodical subscription not found');
  await createAuditLog({ collegeId, entityType: 'PeriodicalSubscription', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy: who });
  return doc;
}
export async function deletePeriodicalSubscription(collegeId: string, id: string, who: string) {
  const doc = await PeriodicalSubscription.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Periodical subscription not found');
  await createAuditLog({ collegeId, entityType: 'PeriodicalSubscription', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy: who });
  return doc;
}

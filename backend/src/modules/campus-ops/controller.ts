import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';

const who = (req: AuthRequest) => req.user?.name || 'System';

// ─── Dashboard ────────────────────────────────────────────
export async function dashboardStats(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStats(req.collegeId!)); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════
// CAMPUS SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// ═══ Building ════════════════════════════════════════════
export async function listBuildings(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listBuildings(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getBuilding(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getBuilding(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createBuilding(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createBuilding(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateBuilding(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateBuilding(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteBuilding(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteBuilding(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Room ════════════════════════════════════════════════
export async function listRooms(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listRooms(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getRoom(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createRoom(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateRoom(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteRoom(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteRoom(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ RoomBooking ═════════════════════════════════════════
export async function listRoomBookings(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listRoomBookings(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getRoomBooking(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getRoomBooking(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createRoomBooking(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createRoomBooking(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRoomBooking(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateRoomBooking(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteRoomBooking(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteRoomBooking(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Vehicle ═════════════════════════════════════════════
export async function listVehicles(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listVehicles(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getVehicle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getVehicle(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createVehicle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createVehicle(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateVehicle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateVehicle(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteVehicle(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteVehicle(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ GatePass ════════════════════════════════════════════
export async function listGatePasses(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listGatePasses(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getGatePass(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getGatePass(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createGatePass(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createGatePass(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateGatePass(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateGatePass(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteGatePass(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteGatePass(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ VisitorEntry ════════════════════════════════════════
export async function listVisitorEntries(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listVisitorEntries(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getVisitorEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getVisitorEntry(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createVisitorEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createVisitorEntry(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateVisitorEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateVisitorEntry(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteVisitorEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteVisitorEntry(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ SecurityIncident ════════════════════════════════════
export async function listSecurityIncidents(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listSecurityIncidents(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getSecurityIncident(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getSecurityIncident(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createSecurityIncident(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createSecurityIncident(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateSecurityIncident(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateSecurityIncident(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteSecurityIncident(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteSecurityIncident(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ CCTV ════════════════════════════════════════════════
export async function listCCTVs(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listCCTVs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getCCTV(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getCCTV(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createCCTV(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createCCTV(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateCCTV(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateCCTV(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteCCTV(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteCCTV(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ EmergencyContact ════════════════════════════════════
export async function listEmergencyContacts(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listEmergencyContacts(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getEmergencyContact(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getEmergencyContact(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createEmergencyContact(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEmergencyContact(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEmergencyContact(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEmergencyContact(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEmergencyContact(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEmergencyContact(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Lab ═════════════════════════════════════════════════
export async function listLabs(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listLabs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getLab(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getLab(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLab(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createLab(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLab(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateLab(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLab(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteLab(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ ParkingSlot ═════════════════════════════════════════
export async function listParkingSlots(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listParkingSlots(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getParkingSlot(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getParkingSlot(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createParkingSlot(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createParkingSlot(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateParkingSlot(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateParkingSlot(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteParkingSlot(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteParkingSlot(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ PowerBackup ═════════════════════════════════════════
export async function listPowerBackups(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listPowerBackups(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getPowerBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPowerBackup(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPowerBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPowerBackup(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePowerBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePowerBackup(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePowerBackup(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePowerBackup(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ GreenInitiative ═════════════════════════════════════
export async function listGreenInitiatives(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listGreenInitiatives(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getGreenInitiative(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getGreenInitiative(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createGreenInitiative(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createGreenInitiative(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateGreenInitiative(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateGreenInitiative(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteGreenInitiative(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteGreenInitiative(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ WaterSupply ═════════════════════════════════════════
export async function listWaterSupplies(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listWaterSupplies(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getWaterSupply(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getWaterSupply(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createWaterSupply(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createWaterSupply(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateWaterSupply(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateWaterSupply(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteWaterSupply(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteWaterSupply(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════
// FACILITIES SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// ═══ Asset ═══════════════════════════════════════════════
export async function listAssets(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listAssets(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAsset(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAsset(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAsset(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAsset(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ AssetAllocation ═════════════════════════════════════
export async function listAssetAllocations(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listAssetAllocations(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getAssetAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getAssetAllocation(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAssetAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createAssetAllocation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAssetAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateAssetAllocation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAssetAllocation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteAssetAllocation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ MaintenanceRequest ══════════════════════════════════
export async function listMaintenanceRequests(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listMaintenanceRequests(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getMaintenanceRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getMaintenanceRequest(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createMaintenanceRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createMaintenanceRequest(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMaintenanceRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateMaintenanceRequest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMaintenanceRequest(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteMaintenanceRequest(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ MaintenanceSchedule ═════════════════════════════════
export async function listMaintenanceSchedules(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listMaintenanceSchedules(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getMaintenanceSchedule(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getMaintenanceSchedule(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createMaintenanceSchedule(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createMaintenanceSchedule(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMaintenanceSchedule(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateMaintenanceSchedule(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMaintenanceSchedule(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteMaintenanceSchedule(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ ConstructionProject ═════════════════════════════════
export async function listConstructionProjects(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listConstructionProjects(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getConstructionProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getConstructionProject(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createConstructionProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createConstructionProject(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateConstructionProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateConstructionProject(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteConstructionProject(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteConstructionProject(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Vendor ══════════════════════════════════════════════
export async function listVendors(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listVendors(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getVendor(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getVendor(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createVendor(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createVendor(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateVendor(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateVendor(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteVendor(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteVendor(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ PurchaseOrder ═══════════════════════════════════════
export async function listPurchaseOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listPurchaseOrders(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getPurchaseOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPurchaseOrder(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPurchaseOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPurchaseOrder(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePurchaseOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePurchaseOrder(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePurchaseOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePurchaseOrder(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ StockItem ═══════════════════════════════════════════
export async function listStockItems(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listStockItems(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getStockItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStockItem(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createStockItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createStockItem(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateStockItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateStockItem(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteStockItem(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteStockItem(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ StockTransaction ════════════════════════════════════
export async function listStockTransactions(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listStockTransactions(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getStockTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getStockTransaction(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createStockTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createStockTransaction(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateStockTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateStockTransaction(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteStockTransaction(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteStockTransaction(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ ITAsset ═════════════════════════════════════════════
export async function listITAssets(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listITAssets(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getITAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getITAsset(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createITAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createITAsset(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateITAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateITAsset(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteITAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteITAsset(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ NetworkInfra ════════════════════════════════════════
export async function listNetworkInfra(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listNetworkInfra(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getNetworkInfra(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getNetworkInfra(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createNetworkInfra(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createNetworkInfra(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateNetworkInfra(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateNetworkInfra(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteNetworkInfra(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteNetworkInfra(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ Insurance ═══════════════════════════════════════════
export async function listInsurances(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listInsurances(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getInsurance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getInsurance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createInsurance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createInsurance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateInsurance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateInsurance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteInsurance(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteInsurance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ EnergyConsumption ═══════════════════════════════════
export async function listEnergyConsumptions(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listEnergyConsumptions(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getEnergyConsumption(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getEnergyConsumption(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createEnergyConsumption(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEnergyConsumption(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEnergyConsumption(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEnergyConsumption(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEnergyConsumption(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEnergyConsumption(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ WasteManagement ═════════════════════════════════════
export async function listWasteManagements(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listWasteManagements(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getWasteManagement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getWasteManagement(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createWasteManagement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createWasteManagement(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateWasteManagement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateWasteManagement(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteWasteManagement(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteWasteManagement(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════
// LIBRARY SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// ═══ Book ════════════════════════════════════════════════
export async function listBooks(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listBooks(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getBook(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getBook(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createBook(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createBook(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateBook(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateBook(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteBook(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteBook(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ BookIssue ═══════════════════════════════════════════
export async function listBookIssues(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listBookIssues(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getBookIssue(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getBookIssue(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createBookIssue(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createBookIssue(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateBookIssue(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateBookIssue(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteBookIssue(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteBookIssue(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ BookReservation ═════════════════════════════════════
export async function listBookReservations(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listBookReservations(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getBookReservation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getBookReservation(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createBookReservation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createBookReservation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateBookReservation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateBookReservation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteBookReservation(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteBookReservation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ LibraryMember ═══════════════════════════════════════
export async function listLibraryMembers(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listLibraryMembers(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getLibraryMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getLibraryMember(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLibraryMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createLibraryMember(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLibraryMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateLibraryMember(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLibraryMember(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteLibraryMember(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ LibraryFine ═════════════════════════════════════════
export async function listLibraryFines(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listLibraryFines(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getLibraryFine(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getLibraryFine(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLibraryFine(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createLibraryFine(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLibraryFine(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateLibraryFine(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLibraryFine(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteLibraryFine(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ LibraryGateEntry ════════════════════════════════════
export async function listLibraryGateEntries(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listLibraryGateEntries(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getLibraryGateEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getLibraryGateEntry(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLibraryGateEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createLibraryGateEntry(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLibraryGateEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateLibraryGateEntry(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLibraryGateEntry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteLibraryGateEntry(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ EResource ═══════════════════════════════════════════
export async function listEResources(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listEResources(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getEResource(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getEResource(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createEResource(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEResource(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEResource(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEResource(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEResource(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEResource(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ EResourceAccess ═════════════════════════════════════
export async function listEResourceAccesses(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listEResourceAccesses(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getEResourceAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getEResourceAccess(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createEResourceAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createEResourceAccess(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEResourceAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updateEResourceAccess(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEResourceAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deleteEResourceAccess(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══ PeriodicalSubscription ══════════════════════════════
export async function listPeriodicalSubscriptions(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.listPeriodicalSubscriptions(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getPeriodicalSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.getPeriodicalSubscription(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createPeriodicalSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await service.createPeriodicalSubscription(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updatePeriodicalSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.updatePeriodicalSubscription(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deletePeriodicalSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await service.deletePeriodicalSubscription(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

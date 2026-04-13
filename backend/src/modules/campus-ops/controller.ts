import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import * as service from './service';
import * as hostelService from './hostel-service';
import * as libraryService from './library-service';
import * as messTransportService from './mess-transport-service';
import * as labsFacilitiesService from './labs-facilities-service';
import * as maintenanceService from './maintenance-crossmodule-service';

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
  try { res.json(await service.listBuildings(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listRooms(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listRoomBookings(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listVehicles(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listGatePasses(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listVisitorEntries(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listSecurityIncidents(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listCCTVs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listEmergencyContacts(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listLabs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listParkingSlots(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listPowerBackups(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listGreenInitiatives(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listWaterSupplies(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listAssets(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listAssetAllocations(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listMaintenanceRequests(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listMaintenanceSchedules(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listConstructionProjects(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listVendors(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listPurchaseOrders(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listStockItems(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listStockTransactions(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listITAssets(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listNetworkInfra(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listInsurances(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listEnergyConsumptions(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listWasteManagements(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listBooks(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listBookIssues(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listBookReservations(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listLibraryMembers(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listLibraryFines(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listLibraryGateEntries(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listEResources(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listEResourceAccesses(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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
  try { res.json(await service.listPeriodicalSubscriptions(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.authScope)); } catch (err) { next(err); }
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

// ═══════════════════════════════════════════════════════════
// HOSTEL WORKFLOW (hostel-service.ts)
// ═══════════════════════════════════════════════════════════

// W08-L2-001/002: Allocation
export async function allocateHostelBulkCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.allocateHostelBulk(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function allocateHostelSingleCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.allocateHostelSingle(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-003: Room Change
export async function submitRoomChangeRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.submitRoomChangeRequest(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveRoomChangeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.approveRoomChange(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function rejectRoomChangeCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.rejectRoomChange(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-004: Clearance
export async function initiateHostelClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.initiateHostelClearance(req.collegeId!, req.params.studentId as string, who(req))); } catch (err) { next(err); }
}
export async function verifyHostelClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.verifyHostelClearance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getHostelClearanceStatusCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.getHostelClearanceStatus(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}

// W08-L2-005: Attendance
export async function recordHostelAttendanceBulkCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.recordHostelAttendanceBulk(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function detectAttendanceAnomaliesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.detectAttendanceAnomalies(req.collegeId!, { date: req.query.date as string })); } catch (err) { next(err); }
}
export async function getAttendanceAnomaliesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.getAttendanceAnomalies(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}

// W08-L2-006: Leave
export async function submitHostelLeaveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.submitHostelLeave(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveHostelLeaveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.approveHostelLeave(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function rejectHostelLeaveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.rejectHostelLeave(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordHostelLeaveReturnCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.recordHostelLeaveReturn(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// W08-L2-007: Violation
export async function reportViolationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.reportViolation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function investigateViolationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.investigateViolation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function scheduleHearingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.scheduleHearing(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function assignPenaltyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.assignPenalty(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function dismissViolationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.dismissViolation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// W08-L2-008: Appeals
export async function fileAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.fileAppeal(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function resolveAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.resolveAppeal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-009: Welfare
export async function escalateWardenConcernCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.escalateWardenConcern(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// Hostel CRUD: Bed
export async function listBedsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.listBeds(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.query.roomId as string)); } catch (err) { next(err); }
}
export async function getBedCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.getBed(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createBedCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.createBed(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateBedCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.updateBed(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteBedCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.deleteBed(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Hostel CRUD: HostelAttendance
export async function listHostelAttendanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.listHostelAttendance(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.query.studentId as string, req.query.date as string)); } catch (err) { next(err); }
}
export async function getHostelAttendanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.getHostelAttendance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// Hostel CRUD: HostelLeave
export async function listHostelLeavesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.listHostelLeaves(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.query.studentId as string, req.query.status as string)); } catch (err) { next(err); }
}
export async function getHostelLeaveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.getHostelLeave(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHostelLeaveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.createHostelLeave(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHostelLeaveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.updateHostelLeave(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHostelLeaveCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.deleteHostelLeave(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Hostel CRUD: HostelViolation
export async function listHostelViolationsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.listHostelViolations(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.query.studentId as string, req.query.status as string)); } catch (err) { next(err); }
}
export async function getHostelViolationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.getHostelViolation(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHostelViolationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.createHostelViolation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHostelViolationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.updateHostelViolation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHostelViolationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.deleteHostelViolation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Hostel CRUD: HostelPenalty
export async function listHostelPenaltiesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.listHostelPenalties(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.query.studentId as string, req.query.status as string)); } catch (err) { next(err); }
}
export async function getHostelPenaltyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.getHostelPenalty(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHostelPenaltyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.createHostelPenalty(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHostelPenaltyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.updateHostelPenalty(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHostelPenaltyCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.deleteHostelPenalty(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Hostel CRUD: HostelAppeal
export async function listHostelAppealsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.listHostelAppeals(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.query.studentId as string, req.query.status as string)); } catch (err) { next(err); }
}
export async function getHostelAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.getHostelAppeal(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHostelAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.createHostelAppeal(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHostelAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.updateHostelAppeal(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHostelAppealCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.deleteHostelAppeal(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Hostel CRUD: HostelClearance
export async function listHostelClearancesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.listHostelClearances(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.query.studentId as string, req.query.status as string)); } catch (err) { next(err); }
}
export async function getHostelClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.getHostelClearance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createHostelClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.createHostelClearance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateHostelClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.updateHostelClearance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteHostelClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.deleteHostelClearance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Hostel CRUD: RoomChangeRequest
export async function listRoomChangeRequestsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.listRoomChangeRequests(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, req.query.studentId as string, req.query.status as string)); } catch (err) { next(err); }
}
export async function getRoomChangeRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.getRoomChangeRequest(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createRoomChangeRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await hostelService.createRoomChangeRequest(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRoomChangeRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.updateRoomChangeRequest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteRoomChangeRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await hostelService.deleteRoomChangeRequest(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════
// LIBRARY WORKFLOW (library-service.ts)
// ═══════════════════════════════════════════════════════════

// W08-L2-010: Book Issue / Return / Renew / Lost
export async function issueBookCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await libraryService.issueBook(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function returnBookCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.returnBook(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function renewBookCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.renewBook(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function reportBookLostCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.reportBookLost(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-011: Reservations
export async function reserveBookCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await libraryService.reserveBook(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function pickupReservationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.pickupReservation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function cancelReservationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.cancelReservation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-012: Library Clearance
export async function initiateLibraryClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await libraryService.initiateLibraryClearance(req.collegeId!, req.params.personId as string, req.body.personType as string, who(req))); } catch (err) { next(err); }
}
export async function getLibraryClearanceStatusCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.getLibraryClearanceStatus(req.collegeId!, req.params.personId as string)); } catch (err) { next(err); }
}

// W08-L2-013: Gate Entry / Exit / Stats
export async function recordLibraryEntryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await libraryService.recordLibraryEntry(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordLibraryExitCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.recordLibraryExit(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function getLibraryVisitStatsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.getLibraryVisitStats(req.collegeId!, { startDate: req.query.startDate as string, endDate: req.query.endDate as string })); } catch (err) { next(err); }
}

// Library CRUD: LibraryClearance
export async function listLibraryClearancesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.listLibraryClearances(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getLibraryClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.getLibraryClearance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLibraryClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await libraryService.createLibraryClearance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLibraryClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.updateLibraryClearance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLibraryClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await libraryService.deleteLibraryClearance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════
// MESS + TRANSPORT WORKFLOW (mess-transport-service.ts)
// ═══════════════════════════════════════════════════════════

// W08-L2-014: Meal Transactions
export async function recordMealTransactionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.recordMealTransaction(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordMealAttendanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.recordMealAttendance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function getMessDailySummaryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getMessDailySummary(req.collegeId!, { messFacilityId: req.query.messFacilityId as string, date: req.query.date as string })); } catch (err) { next(err); }
}
export async function addCouponCreditCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.addCouponCredit(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-015: Menu
export async function createMenuCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.createMenu(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveMenuCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.approveMenu(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function publishMenuCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.publishMenu(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// W08-L2-016: Quality
export async function recordQualityInspectionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.recordQualityInspection(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function getQualityTrendCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getQualityTrend(req.collegeId!, { messFacilityId: req.query.messFacilityId as string, months: Number(req.query.months) || 6 })); } catch (err) { next(err); }
}

// W08-L2-017: Mess Vendor Contract
export async function createMessVendorContractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.createMessVendorContract(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function activateMessVendorContractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.activateMessVendorContract(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function terminateMessVendorContractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.terminateMessVendorContract(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-018: Transport Allocation
export async function allocateTransportBulkCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.allocateTransportBulk(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function allocateTransportSingleCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.allocateTransportSingle(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-019: Transport Clearance
export async function initiateTransportClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.initiateTransportClearance(req.collegeId!, req.params.studentId as string, who(req))); } catch (err) { next(err); }
}
export async function getTransportClearanceStatusCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getTransportClearanceStatus(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}

// W08-L2-020: Trip Management
export async function createTripLogCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.createTripLog(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function startTripCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.startTrip(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function completeTripCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.completeTrip(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function recordTransportAttendanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.recordTransportAttendance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-021: Route Management
export async function adjustRouteCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.adjustRoute(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getRouteUtilizationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getRouteUtilization(req.collegeId!)); } catch (err) { next(err); }
}

// W08-L2-022: Transport Contractor Contract
export async function createTransportContractorContractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.createTransportContractorContract(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function activateTransportContractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.activateTransportContract(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function terminateTransportContractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.terminateTransportContract(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// Mess+Transport CRUD: MessFacility
export async function listMessFacilitiesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listMessFacilities(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getMessFacilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getMessFacility(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createMessFacilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.createMessFacility(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMessFacilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.updateMessFacility(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMessFacilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.deleteMessFacility(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Mess+Transport CRUD: MealTransaction (list/get)
export async function listMealTransactionsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listMealTransactions(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getMealTransactionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getMealTransaction(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// Mess+Transport CRUD: MessSubscription
export async function listMessSubscriptionsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listMessSubscriptions(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getMessSubscriptionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getMessSubscription(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createMessSubscriptionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.createMessSubscription(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateMessSubscriptionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.updateMessSubscription(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMessSubscriptionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.deleteMessSubscription(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Mess+Transport CRUD: DietaryPreference
export async function listDietaryPreferencesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listDietaryPreferences(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getDietaryPreferenceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getDietaryPreference(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createDietaryPreferenceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.createDietaryPreference(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateDietaryPreferenceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.updateDietaryPreference(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteDietaryPreferenceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.deleteDietaryPreference(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Mess+Transport CRUD: QualityInspection
export async function listQualityInspectionsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listQualityInspections(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getQualityInspectionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getQualityInspection(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createQualityInspectionRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.createQualityInspectionRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateQualityInspectionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.updateQualityInspection(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteQualityInspectionCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.deleteQualityInspection(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Mess+Transport CRUD: MessVendorContract
export async function listMessVendorContractsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listMessVendorContracts(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getMessVendorContractByIdCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getMessVendorContractById(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function updateMessVendorContractRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.updateMessVendorContractRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMessVendorContractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.deleteMessVendorContract(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Mess+Transport CRUD: RouteStop
export async function listRouteStopsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listRouteStops(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getRouteStopCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getRouteStop(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createRouteStopCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.createRouteStop(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateRouteStopCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.updateRouteStop(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteRouteStopCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.deleteRouteStop(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Mess+Transport CRUD: Driver
export async function listDriversCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listDrivers(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getDriverCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getDriver(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createDriverCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await messTransportService.createDriver(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateDriverCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.updateDriver(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteDriverCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.deleteDriver(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Mess+Transport CRUD: TripLog
export async function listTripLogsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listTripLogs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getTripLogCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getTripLog(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function updateTripLogCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.updateTripLog(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteTripLogCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.deleteTripLog(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Mess+Transport CRUD: TransportAttendance (list/get)
export async function listTransportAttendancesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listTransportAttendances(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getTransportAttendanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getTransportAttendance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// Mess+Transport CRUD: TransportContractor
export async function listTransportContractorsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listTransportContractors(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getTransportContractorCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getTransportContractor(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function updateTransportContractorCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.updateTransportContractor(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteTransportContractorCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.deleteTransportContractor(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Mess+Transport CRUD: TransportClearance
export async function listTransportClearancesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.listTransportClearances(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20)); } catch (err) { next(err); }
}
export async function getTransportClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.getTransportClearance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function updateTransportClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.updateTransportClearance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteTransportClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await messTransportService.deleteTransportClearance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════
// LABS + FACILITIES WORKFLOW (labs-facilities-service.ts)
// ═══════════════════════════════════════════════════════════

// W08-L2-023: Lab Equipment
export async function registerLabEquipmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.registerLabEquipment(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEquipmentStatusCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.updateEquipmentStatus(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordEquipmentMaintenanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.recordEquipmentMaintenance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function getEquipmentDueForCalibrationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getEquipmentDueForCalibration(req.collegeId!)); } catch (err) { next(err); }
}

// W08-L2-024: Lab Slot Booking
export async function requestLabSlotBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.requestLabSlotBooking(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveLabSlotBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.approveLabSlotBooking(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function rejectLabSlotBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.rejectLabSlotBooking(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function completeLabSlotBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.completeLabSlotBooking(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function cancelLabSlotBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.cancelLabSlotBooking(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// W08-L2-025: Equipment Issue / Return
export async function issueEquipmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.issueEquipment(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function returnEquipmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.returnEquipment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function getOverdueEquipmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getOverdueEquipment(req.collegeId!)); } catch (err) { next(err); }
}

// W08-L2-026: Lab Incident
export async function reportLabIncidentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.reportLabIncident(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function investigateLabIncidentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.investigateLabIncident(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function resolveLabIncidentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.resolveLabIncident(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function closeLabIncidentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.closeLabIncident(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// W08-L2-027: Lab Clearance
export async function initiateLabClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.initiateLabClearance(req.collegeId!, req.params.studentId as string, who(req))); } catch (err) { next(err); }
}
export async function getLabClearanceStatusCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getLabClearanceStatus(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}

// W08-L2-028: Facility Booking
export async function requestFacilityBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.requestFacilityBooking(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function approveFacilityBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.approveFacilityBooking(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function rejectFacilityBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.rejectFacilityBooking(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function cancelFacilityBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.cancelFacilityBooking(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function recordFacilityUsageCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.recordFacilityUsage(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function recordNoShowCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.recordNoShow(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// W08-L2-029: Sports Equipment
export async function getSportsEquipmentAvailabilityCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getSportsEquipmentAvailability(req.collegeId!)); } catch (err) { next(err); }
}

// W08-L2-030: Campus Incident
export async function reportCampusIncidentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.reportCampusIncident(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function investigateCampusIncidentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.investigateCampusIncident(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function resolveCampusIncidentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.resolveCampusIncident(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-031: Facility Utilization
export async function getFacilityUtilizationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getFacilityUtilization(req.collegeId!, { startDate: req.query.startDate as string, endDate: req.query.endDate as string })); } catch (err) { next(err); }
}
export async function getFacilityUtilizationByRoomCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getFacilityUtilizationByRoom(req.collegeId!, req.params.facilityId as string, { startDate: req.query.startDate as string, endDate: req.query.endDate as string })); } catch (err) { next(err); }
}

// W08-L2-033: Visitor Checkout
export async function recordVisitorCheckoutCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.recordVisitorCheckout(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Labs+Facilities CRUD: LabEquipment
export async function listLabEquipmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.listLabEquipment(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { labId: req.query.labId as string, status: req.query.status as string })); } catch (err) { next(err); }
}
export async function getLabEquipmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getLabEquipment(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLabEquipmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.createLabEquipment(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLabEquipmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.updateLabEquipment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLabEquipmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.deleteLabEquipment(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Labs+Facilities CRUD: LabSlotBooking
export async function listLabSlotBookingsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.listLabSlotBookings(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { labId: req.query.labId as string, status: req.query.status as string, date: req.query.date as string })); } catch (err) { next(err); }
}
export async function getLabSlotBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getLabSlotBooking(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLabSlotBookingCrudCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.createLabSlotBookingCrud(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLabSlotBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.updateLabSlotBooking(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLabSlotBookingCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.deleteLabSlotBooking(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Labs+Facilities CRUD: EquipmentIssue
export async function listEquipmentIssuesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.listEquipmentIssues(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { equipmentId: req.query.equipmentId as string, status: req.query.status as string, issuedTo: req.query.issuedTo as string })); } catch (err) { next(err); }
}
export async function getEquipmentIssueCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getEquipmentIssue(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createEquipmentIssueCrudCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.createEquipmentIssueCrud(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateEquipmentIssueCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.updateEquipmentIssue(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteEquipmentIssueCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.deleteEquipmentIssue(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Labs+Facilities CRUD: LabIncident
export async function listLabIncidentsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.listLabIncidents(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { labId: req.query.labId as string, status: req.query.status as string, severity: req.query.severity as string })); } catch (err) { next(err); }
}
export async function getLabIncidentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getLabIncident(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLabIncidentCrudCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.createLabIncidentCrud(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLabIncidentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.updateLabIncident(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLabIncidentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.deleteLabIncident(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Labs+Facilities CRUD: LabClearance
export async function listLabClearancesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.listLabClearances(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { studentId: req.query.studentId as string, status: req.query.status as string })); } catch (err) { next(err); }
}
export async function getLabClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getLabClearance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createLabClearanceCrudCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await labsFacilitiesService.createLabClearanceCrud(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateLabClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.updateLabClearance(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteLabClearanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.deleteLabClearance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Labs+Facilities CRUD: FacilityUsageLog (list/get)
export async function listFacilityUsageLogsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.listFacilityUsageLogs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { roomId: req.query.roomId as string, bookingId: req.query.bookingId as string })); } catch (err) { next(err); }
}
export async function getFacilityUsageLogCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getFacilityUsageLog(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// Labs+Facilities CRUD: EquipmentMaintenanceLog (list/get)
export async function listEquipmentMaintenanceLogsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.listEquipmentMaintenanceLogs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { equipmentId: req.query.equipmentId as string, serviceType: req.query.serviceType as string })); } catch (err) { next(err); }
}
export async function getEquipmentMaintenanceLogCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await labsFacilitiesService.getEquipmentMaintenanceLog(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// ═══════════════════════════════════════════════════════════
// MAINTENANCE + CROSS-MODULE WORKFLOW (maintenance-crossmodule-service.ts)
// ═══════════════════════════════════════════════════════════

// W08-L2-034: Submit & Triage Maintenance
export async function submitMaintenanceRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await maintenanceService.submitMaintenanceRequest(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function triageMaintenanceRequestCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.triageMaintenanceRequest(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-035: Assign & Execute Maintenance
export async function createMaintenanceAssignmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await maintenanceService.createMaintenanceAssignment(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function startMaintenanceWorkCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.startMaintenanceWork(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function addMaintenanceWorkLogCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await maintenanceService.addMaintenanceWorkLog(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function completeMaintenanceAssignmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.completeMaintenanceAssignment(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function verifyMaintenanceWorkCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.verifyMaintenanceWork(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-036: Preventive Maintenance
export async function triggerPreventiveMaintenanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await maintenanceService.triggerPreventiveMaintenance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function checkDuePreventiveMaintenanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.checkDuePreventiveMaintenance(req.collegeId!)); } catch (err) { next(err); }
}
export async function completePreventiveMaintenanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.completePreventiveMaintenance(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// W08-L2-037: SLA & Escalation
export async function checkSLABreachesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.checkSLABreaches(req.collegeId!)); } catch (err) { next(err); }
}
export async function createMaintenanceEscalationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await maintenanceService.createMaintenanceEscalation(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function acknowledgeEscalationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.acknowledgeEscalation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}
export async function resolveEscalationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.resolveEscalation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// W08-L2-038: Vendor Performance
export async function calculateVendorPerformanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.calculateVendorPerformance(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function getVendorPerformanceSummaryCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.getVendorPerformanceSummary(req.collegeId!, req.query.vendorId as string)); } catch (err) { next(err); }
}

// W08-L2-039: Aggregate Clearance
export async function aggregateClearanceStatusCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.aggregateClearanceStatus(req.collegeId!, req.params.studentId as string)); } catch (err) { next(err); }
}

// W08-L2-040: Infrastructure Provisioning
export async function provisionInfrastructureCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await maintenanceService.provisionInfrastructure(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}

// W08-L2-041: Compliance Evidence
export async function getComplianceEvidenceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.getComplianceEvidence(req.collegeId!, { criterion: req.query.criterion as string })); } catch (err) { next(err); }
}

// W08-L2-042: Governance Metrics
export async function getGovernanceMetricsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.getGovernanceMetrics(req.collegeId!, { category: req.query.category as string, startDate: req.query.startDate as string, endDate: req.query.endDate as string })); } catch (err) { next(err); }
}

// Maintenance CRUD: MaintenanceAssignment
export async function listMaintenanceAssignmentsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.listMaintenanceAssignments(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { requestId: req.query.requestId as string, status: req.query.status as string })); } catch (err) { next(err); }
}
export async function getMaintenanceAssignmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.getMaintenanceAssignment(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function updateMaintenanceAssignmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.updateMaintenanceAssignment(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMaintenanceAssignmentCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.deleteMaintenanceAssignment(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Maintenance CRUD: MaintenanceWorkLog (list/get)
export async function listMaintenanceWorkLogsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.listMaintenanceWorkLogs(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { assignmentId: req.query.assignmentId as string })); } catch (err) { next(err); }
}
export async function getMaintenanceWorkLogCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.getMaintenanceWorkLog(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}

// Maintenance CRUD: MaintenanceEscalation
export async function listMaintenanceEscalationsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.listMaintenanceEscalations(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { requestId: req.query.requestId as string, status: req.query.status as string })); } catch (err) { next(err); }
}
export async function getMaintenanceEscalationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.getMaintenanceEscalation(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function updateMaintenanceEscalationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.updateMaintenanceEscalation(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteMaintenanceEscalationCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.deleteMaintenanceEscalation(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Maintenance CRUD: AMCContract
export async function listAMCContractsCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.listAMCContracts(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { vendorId: req.query.vendorId as string, status: req.query.status as string, facilityType: req.query.facilityType as string })); } catch (err) { next(err); }
}
export async function getAMCContractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.getAMCContract(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createAMCContractRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await maintenanceService.createAMCContractRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateAMCContractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.updateAMCContract(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteAMCContractCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.deleteAMCContract(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

// Maintenance CRUD: VendorPerformance
export async function listVendorPerformancesCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.listVendorPerformances(req.collegeId!, Number(req.query.page) || 1, Number(req.query.limit) || 20, { vendorId: req.query.vendorId as string, period: req.query.period as string })); } catch (err) { next(err); }
}
export async function getVendorPerformanceCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.getVendorPerformance(req.collegeId!, req.params.id as string)); } catch (err) { next(err); }
}
export async function createVendorPerformanceRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.status(201).json(await maintenanceService.createVendorPerformanceRecord(req.collegeId!, req.body, who(req))); } catch (err) { next(err); }
}
export async function updateVendorPerformanceRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.updateVendorPerformanceRecord(req.collegeId!, req.params.id as string, req.body, who(req))); } catch (err) { next(err); }
}
export async function deleteVendorPerformanceRecordCtrl(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json(await maintenanceService.deleteVendorPerformanceRecord(req.collegeId!, req.params.id as string, who(req))); } catch (err) { next(err); }
}

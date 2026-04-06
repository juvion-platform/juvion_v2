import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as ctrl from './controller';
import {
  createBuildingSchema, updateBuildingSchema,
  createRoomSchema, updateRoomSchema,
  createRoomBookingSchema, updateRoomBookingSchema,
  createVehicleSchema, updateVehicleSchema,
  createGatePassSchema, updateGatePassSchema,
  createVisitorEntrySchema, updateVisitorEntrySchema,
  createSecurityIncidentSchema, updateSecurityIncidentSchema,
  createCCTVSchema, updateCCTVSchema,
  createEmergencyContactSchema, updateEmergencyContactSchema,
  createLabSchema, updateLabSchema,
  createParkingSlotSchema, updateParkingSlotSchema,
  createPowerBackupSchema, updatePowerBackupSchema,
  createGreenInitiativeSchema, updateGreenInitiativeSchema,
  createWaterSupplySchema, updateWaterSupplySchema,
  createAssetSchema, updateAssetSchema,
  createAssetAllocationSchema, updateAssetAllocationSchema,
  createMaintenanceRequestSchema, updateMaintenanceRequestSchema,
  createMaintenanceScheduleSchema, updateMaintenanceScheduleSchema,
  createConstructionProjectSchema, updateConstructionProjectSchema,
  createVendorSchema, updateVendorSchema,
  createPurchaseOrderSchema, updatePurchaseOrderSchema,
  createStockItemSchema, updateStockItemSchema,
  createStockTransactionSchema, updateStockTransactionSchema,
  createITAssetSchema, updateITAssetSchema,
  createNetworkInfraSchema, updateNetworkInfraSchema,
  createInsuranceSchema, updateInsuranceSchema,
  createEnergyConsumptionSchema, updateEnergyConsumptionSchema,
  createWasteManagementSchema, updateWasteManagementSchema,
  createBookSchema, updateBookSchema,
  createBookIssueSchema, updateBookIssueSchema,
  createBookReservationSchema, updateBookReservationSchema,
  createLibraryMemberSchema, updateLibraryMemberSchema,
  createLibraryFineSchema, updateLibraryFineSchema,
  createLibraryGateEntrySchema, updateLibraryGateEntrySchema,
  createEResourceSchema, updateEResourceSchema,
  createEResourceAccessSchema, updateEResourceAccessSchema,
  createPeriodicalSubscriptionSchema, updatePeriodicalSubscriptionSchema,
} from './validation';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/stats', ctrl.dashboardStats);

// ═══════════════════════════════════════════════════════════
// CAMPUS SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// Building
router.get('/buildings', ctrl.listBuildings);
router.get('/buildings/:id', ctrl.getBuilding);
router.post('/buildings', validate(createBuildingSchema), ctrl.createBuilding);
router.put('/buildings/:id', validate(updateBuildingSchema), ctrl.updateBuilding);
router.delete('/buildings/:id', ctrl.deleteBuilding);

// Room
router.get('/rooms', ctrl.listRooms);
router.get('/rooms/:id', ctrl.getRoom);
router.post('/rooms', validate(createRoomSchema), ctrl.createRoom);
router.put('/rooms/:id', validate(updateRoomSchema), ctrl.updateRoom);
router.delete('/rooms/:id', ctrl.deleteRoom);

// RoomBooking
router.get('/room-bookings', ctrl.listRoomBookings);
router.get('/room-bookings/:id', ctrl.getRoomBooking);
router.post('/room-bookings', validate(createRoomBookingSchema), ctrl.createRoomBooking);
router.put('/room-bookings/:id', validate(updateRoomBookingSchema), ctrl.updateRoomBooking);
router.delete('/room-bookings/:id', ctrl.deleteRoomBooking);

// Vehicle
router.get('/vehicles', ctrl.listVehicles);
router.get('/vehicles/:id', ctrl.getVehicle);
router.post('/vehicles', validate(createVehicleSchema), ctrl.createVehicle);
router.put('/vehicles/:id', validate(updateVehicleSchema), ctrl.updateVehicle);
router.delete('/vehicles/:id', ctrl.deleteVehicle);

// GatePass
router.get('/gate-passes', ctrl.listGatePasses);
router.get('/gate-passes/:id', ctrl.getGatePass);
router.post('/gate-passes', validate(createGatePassSchema), ctrl.createGatePass);
router.put('/gate-passes/:id', validate(updateGatePassSchema), ctrl.updateGatePass);
router.delete('/gate-passes/:id', ctrl.deleteGatePass);

// VisitorEntry
router.get('/visitor-entries', ctrl.listVisitorEntries);
router.get('/visitor-entries/:id', ctrl.getVisitorEntry);
router.post('/visitor-entries', validate(createVisitorEntrySchema), ctrl.createVisitorEntry);
router.put('/visitor-entries/:id', validate(updateVisitorEntrySchema), ctrl.updateVisitorEntry);
router.delete('/visitor-entries/:id', ctrl.deleteVisitorEntry);

// SecurityIncident
router.get('/security-incidents', ctrl.listSecurityIncidents);
router.get('/security-incidents/:id', ctrl.getSecurityIncident);
router.post('/security-incidents', validate(createSecurityIncidentSchema), ctrl.createSecurityIncident);
router.put('/security-incidents/:id', validate(updateSecurityIncidentSchema), ctrl.updateSecurityIncident);
router.delete('/security-incidents/:id', ctrl.deleteSecurityIncident);

// CCTV
router.get('/cctvs', ctrl.listCCTVs);
router.get('/cctvs/:id', ctrl.getCCTV);
router.post('/cctvs', validate(createCCTVSchema), ctrl.createCCTV);
router.put('/cctvs/:id', validate(updateCCTVSchema), ctrl.updateCCTV);
router.delete('/cctvs/:id', ctrl.deleteCCTV);

// EmergencyContact
router.get('/emergency-contacts', ctrl.listEmergencyContacts);
router.get('/emergency-contacts/:id', ctrl.getEmergencyContact);
router.post('/emergency-contacts', validate(createEmergencyContactSchema), ctrl.createEmergencyContact);
router.put('/emergency-contacts/:id', validate(updateEmergencyContactSchema), ctrl.updateEmergencyContact);
router.delete('/emergency-contacts/:id', ctrl.deleteEmergencyContact);

// Lab
router.get('/labs', ctrl.listLabs);
router.get('/labs/:id', ctrl.getLab);
router.post('/labs', validate(createLabSchema), ctrl.createLab);
router.put('/labs/:id', validate(updateLabSchema), ctrl.updateLab);
router.delete('/labs/:id', ctrl.deleteLab);

// ParkingSlot
router.get('/parking-slots', ctrl.listParkingSlots);
router.get('/parking-slots/:id', ctrl.getParkingSlot);
router.post('/parking-slots', validate(createParkingSlotSchema), ctrl.createParkingSlot);
router.put('/parking-slots/:id', validate(updateParkingSlotSchema), ctrl.updateParkingSlot);
router.delete('/parking-slots/:id', ctrl.deleteParkingSlot);

// PowerBackup
router.get('/power-backups', ctrl.listPowerBackups);
router.get('/power-backups/:id', ctrl.getPowerBackup);
router.post('/power-backups', validate(createPowerBackupSchema), ctrl.createPowerBackup);
router.put('/power-backups/:id', validate(updatePowerBackupSchema), ctrl.updatePowerBackup);
router.delete('/power-backups/:id', ctrl.deletePowerBackup);

// GreenInitiative
router.get('/green-initiatives', ctrl.listGreenInitiatives);
router.get('/green-initiatives/:id', ctrl.getGreenInitiative);
router.post('/green-initiatives', validate(createGreenInitiativeSchema), ctrl.createGreenInitiative);
router.put('/green-initiatives/:id', validate(updateGreenInitiativeSchema), ctrl.updateGreenInitiative);
router.delete('/green-initiatives/:id', ctrl.deleteGreenInitiative);

// WaterSupply
router.get('/water-supplies', ctrl.listWaterSupplies);
router.get('/water-supplies/:id', ctrl.getWaterSupply);
router.post('/water-supplies', validate(createWaterSupplySchema), ctrl.createWaterSupply);
router.put('/water-supplies/:id', validate(updateWaterSupplySchema), ctrl.updateWaterSupply);
router.delete('/water-supplies/:id', ctrl.deleteWaterSupply);

// ═══════════════════════════════════════════════════════════
// FACILITIES SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// Asset
router.get('/assets', ctrl.listAssets);
router.get('/assets/:id', ctrl.getAsset);
router.post('/assets', validate(createAssetSchema), ctrl.createAsset);
router.put('/assets/:id', validate(updateAssetSchema), ctrl.updateAsset);
router.delete('/assets/:id', ctrl.deleteAsset);

// AssetAllocation
router.get('/asset-allocations', ctrl.listAssetAllocations);
router.get('/asset-allocations/:id', ctrl.getAssetAllocation);
router.post('/asset-allocations', validate(createAssetAllocationSchema), ctrl.createAssetAllocation);
router.put('/asset-allocations/:id', validate(updateAssetAllocationSchema), ctrl.updateAssetAllocation);
router.delete('/asset-allocations/:id', ctrl.deleteAssetAllocation);

// MaintenanceRequest
router.get('/maintenance-requests', ctrl.listMaintenanceRequests);
router.get('/maintenance-requests/:id', ctrl.getMaintenanceRequest);
router.post('/maintenance-requests', validate(createMaintenanceRequestSchema), ctrl.createMaintenanceRequest);
router.put('/maintenance-requests/:id', validate(updateMaintenanceRequestSchema), ctrl.updateMaintenanceRequest);
router.delete('/maintenance-requests/:id', ctrl.deleteMaintenanceRequest);

// MaintenanceSchedule
router.get('/maintenance-schedules', ctrl.listMaintenanceSchedules);
router.get('/maintenance-schedules/:id', ctrl.getMaintenanceSchedule);
router.post('/maintenance-schedules', validate(createMaintenanceScheduleSchema), ctrl.createMaintenanceSchedule);
router.put('/maintenance-schedules/:id', validate(updateMaintenanceScheduleSchema), ctrl.updateMaintenanceSchedule);
router.delete('/maintenance-schedules/:id', ctrl.deleteMaintenanceSchedule);

// ConstructionProject
router.get('/construction-projects', ctrl.listConstructionProjects);
router.get('/construction-projects/:id', ctrl.getConstructionProject);
router.post('/construction-projects', validate(createConstructionProjectSchema), ctrl.createConstructionProject);
router.put('/construction-projects/:id', validate(updateConstructionProjectSchema), ctrl.updateConstructionProject);
router.delete('/construction-projects/:id', ctrl.deleteConstructionProject);

// Vendor
router.get('/vendors', ctrl.listVendors);
router.get('/vendors/:id', ctrl.getVendor);
router.post('/vendors', validate(createVendorSchema), ctrl.createVendor);
router.put('/vendors/:id', validate(updateVendorSchema), ctrl.updateVendor);
router.delete('/vendors/:id', ctrl.deleteVendor);

// PurchaseOrder
router.get('/purchase-orders', ctrl.listPurchaseOrders);
router.get('/purchase-orders/:id', ctrl.getPurchaseOrder);
router.post('/purchase-orders', validate(createPurchaseOrderSchema), ctrl.createPurchaseOrder);
router.put('/purchase-orders/:id', validate(updatePurchaseOrderSchema), ctrl.updatePurchaseOrder);
router.delete('/purchase-orders/:id', ctrl.deletePurchaseOrder);

// StockItem
router.get('/stock-items', ctrl.listStockItems);
router.get('/stock-items/:id', ctrl.getStockItem);
router.post('/stock-items', validate(createStockItemSchema), ctrl.createStockItem);
router.put('/stock-items/:id', validate(updateStockItemSchema), ctrl.updateStockItem);
router.delete('/stock-items/:id', ctrl.deleteStockItem);

// StockTransaction
router.get('/stock-transactions', ctrl.listStockTransactions);
router.get('/stock-transactions/:id', ctrl.getStockTransaction);
router.post('/stock-transactions', validate(createStockTransactionSchema), ctrl.createStockTransaction);
router.put('/stock-transactions/:id', validate(updateStockTransactionSchema), ctrl.updateStockTransaction);
router.delete('/stock-transactions/:id', ctrl.deleteStockTransaction);

// ITAsset
router.get('/it-assets', ctrl.listITAssets);
router.get('/it-assets/:id', ctrl.getITAsset);
router.post('/it-assets', validate(createITAssetSchema), ctrl.createITAsset);
router.put('/it-assets/:id', validate(updateITAssetSchema), ctrl.updateITAsset);
router.delete('/it-assets/:id', ctrl.deleteITAsset);

// NetworkInfra
router.get('/network-infra', ctrl.listNetworkInfra);
router.get('/network-infra/:id', ctrl.getNetworkInfra);
router.post('/network-infra', validate(createNetworkInfraSchema), ctrl.createNetworkInfra);
router.put('/network-infra/:id', validate(updateNetworkInfraSchema), ctrl.updateNetworkInfra);
router.delete('/network-infra/:id', ctrl.deleteNetworkInfra);

// Insurance
router.get('/insurances', ctrl.listInsurances);
router.get('/insurances/:id', ctrl.getInsurance);
router.post('/insurances', validate(createInsuranceSchema), ctrl.createInsurance);
router.put('/insurances/:id', validate(updateInsuranceSchema), ctrl.updateInsurance);
router.delete('/insurances/:id', ctrl.deleteInsurance);

// EnergyConsumption
router.get('/energy-consumptions', ctrl.listEnergyConsumptions);
router.get('/energy-consumptions/:id', ctrl.getEnergyConsumption);
router.post('/energy-consumptions', validate(createEnergyConsumptionSchema), ctrl.createEnergyConsumption);
router.put('/energy-consumptions/:id', validate(updateEnergyConsumptionSchema), ctrl.updateEnergyConsumption);
router.delete('/energy-consumptions/:id', ctrl.deleteEnergyConsumption);

// WasteManagement
router.get('/waste-managements', ctrl.listWasteManagements);
router.get('/waste-managements/:id', ctrl.getWasteManagement);
router.post('/waste-managements', validate(createWasteManagementSchema), ctrl.createWasteManagement);
router.put('/waste-managements/:id', validate(updateWasteManagementSchema), ctrl.updateWasteManagement);
router.delete('/waste-managements/:id', ctrl.deleteWasteManagement);

// ═══════════════════════════════════════════════════════════
// LIBRARY SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// Book
router.get('/books', ctrl.listBooks);
router.get('/books/:id', ctrl.getBook);
router.post('/books', validate(createBookSchema), ctrl.createBook);
router.put('/books/:id', validate(updateBookSchema), ctrl.updateBook);
router.delete('/books/:id', ctrl.deleteBook);

// BookIssue
router.get('/book-issues', ctrl.listBookIssues);
router.get('/book-issues/:id', ctrl.getBookIssue);
router.post('/book-issues', validate(createBookIssueSchema), ctrl.createBookIssue);
router.put('/book-issues/:id', validate(updateBookIssueSchema), ctrl.updateBookIssue);
router.delete('/book-issues/:id', ctrl.deleteBookIssue);

// BookReservation
router.get('/book-reservations', ctrl.listBookReservations);
router.get('/book-reservations/:id', ctrl.getBookReservation);
router.post('/book-reservations', validate(createBookReservationSchema), ctrl.createBookReservation);
router.put('/book-reservations/:id', validate(updateBookReservationSchema), ctrl.updateBookReservation);
router.delete('/book-reservations/:id', ctrl.deleteBookReservation);

// LibraryMember
router.get('/library-members', ctrl.listLibraryMembers);
router.get('/library-members/:id', ctrl.getLibraryMember);
router.post('/library-members', validate(createLibraryMemberSchema), ctrl.createLibraryMember);
router.put('/library-members/:id', validate(updateLibraryMemberSchema), ctrl.updateLibraryMember);
router.delete('/library-members/:id', ctrl.deleteLibraryMember);

// LibraryFine
router.get('/library-fines', ctrl.listLibraryFines);
router.get('/library-fines/:id', ctrl.getLibraryFine);
router.post('/library-fines', validate(createLibraryFineSchema), ctrl.createLibraryFine);
router.put('/library-fines/:id', validate(updateLibraryFineSchema), ctrl.updateLibraryFine);
router.delete('/library-fines/:id', ctrl.deleteLibraryFine);

// LibraryGateEntry
router.get('/library-gate-entries', ctrl.listLibraryGateEntries);
router.get('/library-gate-entries/:id', ctrl.getLibraryGateEntry);
router.post('/library-gate-entries', validate(createLibraryGateEntrySchema), ctrl.createLibraryGateEntry);
router.put('/library-gate-entries/:id', validate(updateLibraryGateEntrySchema), ctrl.updateLibraryGateEntry);
router.delete('/library-gate-entries/:id', ctrl.deleteLibraryGateEntry);

// EResource
router.get('/e-resources', ctrl.listEResources);
router.get('/e-resources/:id', ctrl.getEResource);
router.post('/e-resources', validate(createEResourceSchema), ctrl.createEResource);
router.put('/e-resources/:id', validate(updateEResourceSchema), ctrl.updateEResource);
router.delete('/e-resources/:id', ctrl.deleteEResource);

// EResourceAccess
router.get('/e-resource-accesses', ctrl.listEResourceAccesses);
router.get('/e-resource-accesses/:id', ctrl.getEResourceAccess);
router.post('/e-resource-accesses', validate(createEResourceAccessSchema), ctrl.createEResourceAccess);
router.put('/e-resource-accesses/:id', validate(updateEResourceAccessSchema), ctrl.updateEResourceAccess);
router.delete('/e-resource-accesses/:id', ctrl.deleteEResourceAccess);

// PeriodicalSubscription
router.get('/periodical-subscriptions', ctrl.listPeriodicalSubscriptions);
router.get('/periodical-subscriptions/:id', ctrl.getPeriodicalSubscription);
router.post('/periodical-subscriptions', validate(createPeriodicalSubscriptionSchema), ctrl.createPeriodicalSubscription);
router.put('/periodical-subscriptions/:id', validate(updatePeriodicalSubscriptionSchema), ctrl.updatePeriodicalSubscription);
router.delete('/periodical-subscriptions/:id', ctrl.deletePeriodicalSubscription);

export default router;

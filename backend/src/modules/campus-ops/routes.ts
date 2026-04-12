import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
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
router.get('/stats', authorize('campus', 'read'), ctrl.dashboardStats);

// ═══════════════════════════════════════════════════════════
// CAMPUS SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// Building
router.get('/buildings', authorize('campus', 'read'), ctrl.listBuildings);
router.get('/buildings/:id', authorize('campus', 'read'), ctrl.getBuilding);
router.post('/buildings', authorize('campus', 'create'), validate(createBuildingSchema), ctrl.createBuilding);
router.put('/buildings/:id', authorize('campus', 'update'), validate(updateBuildingSchema), ctrl.updateBuilding);
router.delete('/buildings/:id', authorize('campus', 'delete'), ctrl.deleteBuilding);

// Room
router.get('/rooms', authorize('campus', 'read'), ctrl.listRooms);
router.get('/rooms/:id', authorize('campus', 'read'), ctrl.getRoom);
router.post('/rooms', authorize('campus', 'create'), validate(createRoomSchema), ctrl.createRoom);
router.put('/rooms/:id', authorize('campus', 'update'), validate(updateRoomSchema), ctrl.updateRoom);
router.delete('/rooms/:id', authorize('campus', 'delete'), ctrl.deleteRoom);

// RoomBooking
router.get('/room-bookings', authorize('campus', 'read'), ctrl.listRoomBookings);
router.get('/room-bookings/:id', authorize('campus', 'read'), ctrl.getRoomBooking);
router.post('/room-bookings', authorize('campus', 'create'), validate(createRoomBookingSchema), ctrl.createRoomBooking);
router.put('/room-bookings/:id', authorize('campus', 'update'), validate(updateRoomBookingSchema), ctrl.updateRoomBooking);
router.delete('/room-bookings/:id', authorize('campus', 'delete'), ctrl.deleteRoomBooking);

// Vehicle
router.get('/vehicles', authorize('campus', 'read'), ctrl.listVehicles);
router.get('/vehicles/:id', authorize('campus', 'read'), ctrl.getVehicle);
router.post('/vehicles', authorize('campus', 'create'), validate(createVehicleSchema), ctrl.createVehicle);
router.put('/vehicles/:id', authorize('campus', 'update'), validate(updateVehicleSchema), ctrl.updateVehicle);
router.delete('/vehicles/:id', authorize('campus', 'delete'), ctrl.deleteVehicle);

// GatePass (security sub-domain)
router.get('/gate-passes', authorize('campus', 'read', { subDomain: 'security' }), ctrl.listGatePasses);
router.get('/gate-passes/:id', authorize('campus', 'read', { subDomain: 'security' }), ctrl.getGatePass);
router.post('/gate-passes', authorize('campus', 'create', { subDomain: 'security' }), validate(createGatePassSchema), ctrl.createGatePass);
router.put('/gate-passes/:id', authorize('campus', 'update', { subDomain: 'security' }), validate(updateGatePassSchema), ctrl.updateGatePass);
router.delete('/gate-passes/:id', authorize('campus', 'delete', { subDomain: 'security' }), ctrl.deleteGatePass);

// VisitorEntry (security sub-domain)
router.get('/visitor-entries', authorize('campus', 'read', { subDomain: 'security' }), ctrl.listVisitorEntries);
router.get('/visitor-entries/:id', authorize('campus', 'read', { subDomain: 'security' }), ctrl.getVisitorEntry);
router.post('/visitor-entries', authorize('campus', 'create', { subDomain: 'security' }), validate(createVisitorEntrySchema), ctrl.createVisitorEntry);
router.put('/visitor-entries/:id', authorize('campus', 'update', { subDomain: 'security' }), validate(updateVisitorEntrySchema), ctrl.updateVisitorEntry);
router.delete('/visitor-entries/:id', authorize('campus', 'delete', { subDomain: 'security' }), ctrl.deleteVisitorEntry);

// SecurityIncident (security sub-domain)
router.get('/security-incidents', authorize('campus', 'read', { subDomain: 'security' }), ctrl.listSecurityIncidents);
router.get('/security-incidents/:id', authorize('campus', 'read', { subDomain: 'security' }), ctrl.getSecurityIncident);
router.post('/security-incidents', authorize('campus', 'create', { subDomain: 'security' }), validate(createSecurityIncidentSchema), ctrl.createSecurityIncident);
router.put('/security-incidents/:id', authorize('campus', 'update', { subDomain: 'security' }), validate(updateSecurityIncidentSchema), ctrl.updateSecurityIncident);
router.delete('/security-incidents/:id', authorize('campus', 'delete', { subDomain: 'security' }), ctrl.deleteSecurityIncident);

// CCTV (security sub-domain)
router.get('/cctvs', authorize('campus', 'read', { subDomain: 'security' }), ctrl.listCCTVs);
router.get('/cctvs/:id', authorize('campus', 'read', { subDomain: 'security' }), ctrl.getCCTV);
router.post('/cctvs', authorize('campus', 'create', { subDomain: 'security' }), validate(createCCTVSchema), ctrl.createCCTV);
router.put('/cctvs/:id', authorize('campus', 'update', { subDomain: 'security' }), validate(updateCCTVSchema), ctrl.updateCCTV);
router.delete('/cctvs/:id', authorize('campus', 'delete', { subDomain: 'security' }), ctrl.deleteCCTV);

// EmergencyContact
router.get('/emergency-contacts', authorize('campus', 'read'), ctrl.listEmergencyContacts);
router.get('/emergency-contacts/:id', authorize('campus', 'read'), ctrl.getEmergencyContact);
router.post('/emergency-contacts', authorize('campus', 'create'), validate(createEmergencyContactSchema), ctrl.createEmergencyContact);
router.put('/emergency-contacts/:id', authorize('campus', 'update'), validate(updateEmergencyContactSchema), ctrl.updateEmergencyContact);
router.delete('/emergency-contacts/:id', authorize('campus', 'delete'), ctrl.deleteEmergencyContact);

// Lab
router.get('/labs', authorize('campus', 'read'), ctrl.listLabs);
router.get('/labs/:id', authorize('campus', 'read'), ctrl.getLab);
router.post('/labs', authorize('campus', 'create'), validate(createLabSchema), ctrl.createLab);
router.put('/labs/:id', authorize('campus', 'update'), validate(updateLabSchema), ctrl.updateLab);
router.delete('/labs/:id', authorize('campus', 'delete'), ctrl.deleteLab);

// ParkingSlot
router.get('/parking-slots', authorize('campus', 'read'), ctrl.listParkingSlots);
router.get('/parking-slots/:id', authorize('campus', 'read'), ctrl.getParkingSlot);
router.post('/parking-slots', authorize('campus', 'create'), validate(createParkingSlotSchema), ctrl.createParkingSlot);
router.put('/parking-slots/:id', authorize('campus', 'update'), validate(updateParkingSlotSchema), ctrl.updateParkingSlot);
router.delete('/parking-slots/:id', authorize('campus', 'delete'), ctrl.deleteParkingSlot);

// PowerBackup
router.get('/power-backups', authorize('campus', 'read'), ctrl.listPowerBackups);
router.get('/power-backups/:id', authorize('campus', 'read'), ctrl.getPowerBackup);
router.post('/power-backups', authorize('campus', 'create'), validate(createPowerBackupSchema), ctrl.createPowerBackup);
router.put('/power-backups/:id', authorize('campus', 'update'), validate(updatePowerBackupSchema), ctrl.updatePowerBackup);
router.delete('/power-backups/:id', authorize('campus', 'delete'), ctrl.deletePowerBackup);

// GreenInitiative
router.get('/green-initiatives', authorize('campus', 'read'), ctrl.listGreenInitiatives);
router.get('/green-initiatives/:id', authorize('campus', 'read'), ctrl.getGreenInitiative);
router.post('/green-initiatives', authorize('campus', 'create'), validate(createGreenInitiativeSchema), ctrl.createGreenInitiative);
router.put('/green-initiatives/:id', authorize('campus', 'update'), validate(updateGreenInitiativeSchema), ctrl.updateGreenInitiative);
router.delete('/green-initiatives/:id', authorize('campus', 'delete'), ctrl.deleteGreenInitiative);

// WaterSupply
router.get('/water-supplies', authorize('campus', 'read'), ctrl.listWaterSupplies);
router.get('/water-supplies/:id', authorize('campus', 'read'), ctrl.getWaterSupply);
router.post('/water-supplies', authorize('campus', 'create'), validate(createWaterSupplySchema), ctrl.createWaterSupply);
router.put('/water-supplies/:id', authorize('campus', 'update'), validate(updateWaterSupplySchema), ctrl.updateWaterSupply);
router.delete('/water-supplies/:id', authorize('campus', 'delete'), ctrl.deleteWaterSupply);

// ═══════════════════════════════════════════════════════════
// FACILITIES SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// Asset (facilities sub-domain)
router.get('/assets', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listAssets);
router.get('/assets/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getAsset);
router.post('/assets', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createAssetSchema), ctrl.createAsset);
router.put('/assets/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateAssetSchema), ctrl.updateAsset);
router.delete('/assets/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteAsset);

// AssetAllocation (facilities sub-domain)
router.get('/asset-allocations', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listAssetAllocations);
router.get('/asset-allocations/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getAssetAllocation);
router.post('/asset-allocations', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createAssetAllocationSchema), ctrl.createAssetAllocation);
router.put('/asset-allocations/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateAssetAllocationSchema), ctrl.updateAssetAllocation);
router.delete('/asset-allocations/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteAssetAllocation);

// MaintenanceRequest (facilities sub-domain)
router.get('/maintenance-requests', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listMaintenanceRequests);
router.get('/maintenance-requests/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getMaintenanceRequest);
router.post('/maintenance-requests', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createMaintenanceRequestSchema), ctrl.createMaintenanceRequest);
router.put('/maintenance-requests/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateMaintenanceRequestSchema), ctrl.updateMaintenanceRequest);
router.delete('/maintenance-requests/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteMaintenanceRequest);

// MaintenanceSchedule (facilities sub-domain)
router.get('/maintenance-schedules', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listMaintenanceSchedules);
router.get('/maintenance-schedules/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getMaintenanceSchedule);
router.post('/maintenance-schedules', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createMaintenanceScheduleSchema), ctrl.createMaintenanceSchedule);
router.put('/maintenance-schedules/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateMaintenanceScheduleSchema), ctrl.updateMaintenanceSchedule);
router.delete('/maintenance-schedules/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteMaintenanceSchedule);

// ConstructionProject (facilities sub-domain)
router.get('/construction-projects', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listConstructionProjects);
router.get('/construction-projects/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getConstructionProject);
router.post('/construction-projects', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createConstructionProjectSchema), ctrl.createConstructionProject);
router.put('/construction-projects/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateConstructionProjectSchema), ctrl.updateConstructionProject);
router.delete('/construction-projects/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteConstructionProject);

// Vendor (facilities sub-domain)
router.get('/vendors', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listVendors);
router.get('/vendors/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getVendor);
router.post('/vendors', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createVendorSchema), ctrl.createVendor);
router.put('/vendors/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateVendorSchema), ctrl.updateVendor);
router.delete('/vendors/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteVendor);

// PurchaseOrder (facilities sub-domain)
router.get('/purchase-orders', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listPurchaseOrders);
router.get('/purchase-orders/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getPurchaseOrder);
router.post('/purchase-orders', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createPurchaseOrderSchema), ctrl.createPurchaseOrder);
router.put('/purchase-orders/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updatePurchaseOrderSchema), ctrl.updatePurchaseOrder);
router.delete('/purchase-orders/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deletePurchaseOrder);

// StockItem (facilities sub-domain)
router.get('/stock-items', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listStockItems);
router.get('/stock-items/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getStockItem);
router.post('/stock-items', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createStockItemSchema), ctrl.createStockItem);
router.put('/stock-items/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateStockItemSchema), ctrl.updateStockItem);
router.delete('/stock-items/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteStockItem);

// StockTransaction (facilities sub-domain)
router.get('/stock-transactions', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listStockTransactions);
router.get('/stock-transactions/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getStockTransaction);
router.post('/stock-transactions', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createStockTransactionSchema), ctrl.createStockTransaction);
router.put('/stock-transactions/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateStockTransactionSchema), ctrl.updateStockTransaction);
router.delete('/stock-transactions/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteStockTransaction);

// ITAsset (facilities sub-domain)
router.get('/it-assets', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listITAssets);
router.get('/it-assets/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getITAsset);
router.post('/it-assets', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createITAssetSchema), ctrl.createITAsset);
router.put('/it-assets/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateITAssetSchema), ctrl.updateITAsset);
router.delete('/it-assets/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteITAsset);

// NetworkInfra (facilities sub-domain)
router.get('/network-infra', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listNetworkInfra);
router.get('/network-infra/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getNetworkInfra);
router.post('/network-infra', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createNetworkInfraSchema), ctrl.createNetworkInfra);
router.put('/network-infra/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateNetworkInfraSchema), ctrl.updateNetworkInfra);
router.delete('/network-infra/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteNetworkInfra);

// Insurance (facilities sub-domain)
router.get('/insurances', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listInsurances);
router.get('/insurances/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getInsurance);
router.post('/insurances', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createInsuranceSchema), ctrl.createInsurance);
router.put('/insurances/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateInsuranceSchema), ctrl.updateInsurance);
router.delete('/insurances/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteInsurance);

// EnergyConsumption (facilities sub-domain)
router.get('/energy-consumptions', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listEnergyConsumptions);
router.get('/energy-consumptions/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getEnergyConsumption);
router.post('/energy-consumptions', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createEnergyConsumptionSchema), ctrl.createEnergyConsumption);
router.put('/energy-consumptions/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateEnergyConsumptionSchema), ctrl.updateEnergyConsumption);
router.delete('/energy-consumptions/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteEnergyConsumption);

// WasteManagement (facilities sub-domain)
router.get('/waste-managements', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.listWasteManagements);
router.get('/waste-managements/:id', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getWasteManagement);
router.post('/waste-managements', authorize('campus', 'create', { subDomain: 'facilities' }), validate(createWasteManagementSchema), ctrl.createWasteManagement);
router.put('/waste-managements/:id', authorize('campus', 'update', { subDomain: 'facilities' }), validate(updateWasteManagementSchema), ctrl.updateWasteManagement);
router.delete('/waste-managements/:id', authorize('campus', 'delete', { subDomain: 'facilities' }), ctrl.deleteWasteManagement);

// ═══════════════════════════════════════════════════════════
// LIBRARY SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// Book (library sub-domain)
router.get('/books', authorize('campus', 'read', { subDomain: 'library' }), ctrl.listBooks);
router.get('/books/:id', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getBook);
router.post('/books', authorize('campus', 'create', { subDomain: 'library' }), validate(createBookSchema), ctrl.createBook);
router.put('/books/:id', authorize('campus', 'update', { subDomain: 'library' }), validate(updateBookSchema), ctrl.updateBook);
router.delete('/books/:id', authorize('campus', 'delete', { subDomain: 'library' }), ctrl.deleteBook);

// BookIssue (library sub-domain)
router.get('/book-issues', authorize('campus', 'read', { subDomain: 'library' }), ctrl.listBookIssues);
router.get('/book-issues/:id', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getBookIssue);
router.post('/book-issues', authorize('campus', 'create', { subDomain: 'library' }), validate(createBookIssueSchema), ctrl.createBookIssue);
router.put('/book-issues/:id', authorize('campus', 'update', { subDomain: 'library' }), validate(updateBookIssueSchema), ctrl.updateBookIssue);
router.delete('/book-issues/:id', authorize('campus', 'delete', { subDomain: 'library' }), ctrl.deleteBookIssue);

// BookReservation (library sub-domain)
router.get('/book-reservations', authorize('campus', 'read', { subDomain: 'library' }), ctrl.listBookReservations);
router.get('/book-reservations/:id', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getBookReservation);
router.post('/book-reservations', authorize('campus', 'create', { subDomain: 'library' }), validate(createBookReservationSchema), ctrl.createBookReservation);
router.put('/book-reservations/:id', authorize('campus', 'update', { subDomain: 'library' }), validate(updateBookReservationSchema), ctrl.updateBookReservation);
router.delete('/book-reservations/:id', authorize('campus', 'delete', { subDomain: 'library' }), ctrl.deleteBookReservation);

// LibraryMember (library sub-domain)
router.get('/library-members', authorize('campus', 'read', { subDomain: 'library' }), ctrl.listLibraryMembers);
router.get('/library-members/:id', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getLibraryMember);
router.post('/library-members', authorize('campus', 'create', { subDomain: 'library' }), validate(createLibraryMemberSchema), ctrl.createLibraryMember);
router.put('/library-members/:id', authorize('campus', 'update', { subDomain: 'library' }), validate(updateLibraryMemberSchema), ctrl.updateLibraryMember);
router.delete('/library-members/:id', authorize('campus', 'delete', { subDomain: 'library' }), ctrl.deleteLibraryMember);

// LibraryFine (library sub-domain)
router.get('/library-fines', authorize('campus', 'read', { subDomain: 'library' }), ctrl.listLibraryFines);
router.get('/library-fines/:id', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getLibraryFine);
router.post('/library-fines', authorize('campus', 'create', { subDomain: 'library' }), validate(createLibraryFineSchema), ctrl.createLibraryFine);
router.put('/library-fines/:id', authorize('campus', 'update', { subDomain: 'library' }), validate(updateLibraryFineSchema), ctrl.updateLibraryFine);
router.delete('/library-fines/:id', authorize('campus', 'delete', { subDomain: 'library' }), ctrl.deleteLibraryFine);

// LibraryGateEntry (library sub-domain)
router.get('/library-gate-entries', authorize('campus', 'read', { subDomain: 'library' }), ctrl.listLibraryGateEntries);
router.get('/library-gate-entries/:id', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getLibraryGateEntry);
router.post('/library-gate-entries', authorize('campus', 'create', { subDomain: 'library' }), validate(createLibraryGateEntrySchema), ctrl.createLibraryGateEntry);
router.put('/library-gate-entries/:id', authorize('campus', 'update', { subDomain: 'library' }), validate(updateLibraryGateEntrySchema), ctrl.updateLibraryGateEntry);
router.delete('/library-gate-entries/:id', authorize('campus', 'delete', { subDomain: 'library' }), ctrl.deleteLibraryGateEntry);

// EResource (library sub-domain)
router.get('/e-resources', authorize('campus', 'read', { subDomain: 'library' }), ctrl.listEResources);
router.get('/e-resources/:id', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getEResource);
router.post('/e-resources', authorize('campus', 'create', { subDomain: 'library' }), validate(createEResourceSchema), ctrl.createEResource);
router.put('/e-resources/:id', authorize('campus', 'update', { subDomain: 'library' }), validate(updateEResourceSchema), ctrl.updateEResource);
router.delete('/e-resources/:id', authorize('campus', 'delete', { subDomain: 'library' }), ctrl.deleteEResource);

// EResourceAccess (library sub-domain)
router.get('/e-resource-accesses', authorize('campus', 'read', { subDomain: 'library' }), ctrl.listEResourceAccesses);
router.get('/e-resource-accesses/:id', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getEResourceAccess);
router.post('/e-resource-accesses', authorize('campus', 'create', { subDomain: 'library' }), validate(createEResourceAccessSchema), ctrl.createEResourceAccess);
router.put('/e-resource-accesses/:id', authorize('campus', 'update', { subDomain: 'library' }), validate(updateEResourceAccessSchema), ctrl.updateEResourceAccess);
router.delete('/e-resource-accesses/:id', authorize('campus', 'delete', { subDomain: 'library' }), ctrl.deleteEResourceAccess);

// PeriodicalSubscription (library sub-domain)
router.get('/periodical-subscriptions', authorize('campus', 'read', { subDomain: 'library' }), ctrl.listPeriodicalSubscriptions);
router.get('/periodical-subscriptions/:id', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getPeriodicalSubscription);
router.post('/periodical-subscriptions', authorize('campus', 'create', { subDomain: 'library' }), validate(createPeriodicalSubscriptionSchema), ctrl.createPeriodicalSubscription);
router.put('/periodical-subscriptions/:id', authorize('campus', 'update', { subDomain: 'library' }), validate(updatePeriodicalSubscriptionSchema), ctrl.updatePeriodicalSubscription);
router.delete('/periodical-subscriptions/:id', authorize('campus', 'delete', { subDomain: 'library' }), ctrl.deletePeriodicalSubscription);

export default router;

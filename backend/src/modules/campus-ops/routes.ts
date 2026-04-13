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
  // Hostel workflow schemas
  allocateHostelBulkSchema, allocateHostelSingleSchema, submitRoomChangeRequestSchema,
  approveRoomChangeSchema, verifyHostelClearanceSchema, recordHostelAttendanceBulkSchema,
  submitHostelLeaveSchema, rejectHostelLeaveSchema, reportViolationSchema,
  scheduleHearingSchema, assignPenaltySchema, fileAppealSchema, resolveAppealSchema,
  escalateWardenConcernSchema,
  // Library workflow schemas
  issueBookSchema, returnBookSchema, renewBookSchema, reportBookLostSchema,
  reserveBookSchema, initiateLibraryClearanceSchema, recordLibraryEntrySchema,
  // Mess workflow schemas
  recordMealTransactionSchema, addCouponCreditSchema, qualityInspectionWorkflowSchema,
  terminateContractSchema,
  // Transport workflow schemas
  allocateTransportBulkSchema, allocateTransportSingleSchema,
  recordTransportAttendanceSchema, adjustRouteSchema,
  // Labs workflow schemas
  registerLabEquipmentSchema, updateEquipmentStatusSchema, recordEquipmentMaintenanceSchema,
  requestLabSlotBookingSchema, issueEquipmentSchema, returnEquipmentSchema,
  reportLabIncidentSchema, resolveLabIncidentSchema,
  // Facilities workflow schemas
  requestFacilityBookingSchema, rejectBookingSchema, recordFacilityUsageSchema,
  reportCampusIncidentSchema, resolveCampusIncidentSchema,
  // Maintenance workflow schemas
  submitMaintenanceRequestSchema, triageMaintenanceRequestSchema,
  createMaintenanceAssignmentSchema_wf, addMaintenanceWorkLogSchema,
  verifyMaintenanceWorkSchema, triggerPreventiveMaintenanceSchema,
  createMaintenanceEscalationSchema_wf, calculateVendorPerformanceSchema,
  provisionInfrastructureSchema,
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

// ═══════════════════════════════════════════════════════════
// HOSTEL WORKFLOW ROUTES
// ═══════════════════════════════════════════════════════════
router.post('/hostel/allocate-bulk', authorize('campus', 'create', { subDomain: 'hostel' }), validate(allocateHostelBulkSchema), ctrl.allocateHostelBulkCtrl);
router.post('/hostel/allocate', authorize('campus', 'create', { subDomain: 'hostel' }), validate(allocateHostelSingleSchema), ctrl.allocateHostelSingleCtrl);
router.post('/hostel/room-change-requests', authorize('campus', 'create', { subDomain: 'hostel' }), validate(submitRoomChangeRequestSchema), ctrl.submitRoomChangeRequestCtrl);
router.put('/hostel/room-change-requests/:id/approve', authorize('campus', 'update', { subDomain: 'hostel' }), validate(approveRoomChangeSchema), ctrl.approveRoomChangeCtrl);
router.put('/hostel/room-change-requests/:id/reject', authorize('campus', 'update', { subDomain: 'hostel' }), ctrl.rejectRoomChangeCtrl);
router.post('/hostel/clearance/:studentId', authorize('campus', 'create', { subDomain: 'hostel' }), ctrl.initiateHostelClearanceCtrl);
router.put('/hostel/clearance/:id/verify', authorize('campus', 'update', { subDomain: 'hostel' }), validate(verifyHostelClearanceSchema), ctrl.verifyHostelClearanceCtrl);
router.get('/hostel/clearance/:studentId', authorize('campus', 'read', { subDomain: 'hostel' }), ctrl.getHostelClearanceStatusCtrl);
router.post('/hostel/attendance/record', authorize('campus', 'create', { subDomain: 'hostel' }), validate(recordHostelAttendanceBulkSchema), ctrl.recordHostelAttendanceBulkCtrl);
router.get('/hostel/attendance/anomalies', authorize('campus', 'read', { subDomain: 'hostel' }), ctrl.getAttendanceAnomaliesCtrl);
router.post('/hostel/leave-requests', authorize('campus', 'create', { subDomain: 'hostel' }), validate(submitHostelLeaveSchema), ctrl.submitHostelLeaveCtrl);
router.put('/hostel/leave-requests/:id/approve', authorize('campus', 'update', { subDomain: 'hostel' }), ctrl.approveHostelLeaveCtrl);
router.put('/hostel/leave-requests/:id/reject', authorize('campus', 'update', { subDomain: 'hostel' }), validate(rejectHostelLeaveSchema), ctrl.rejectHostelLeaveCtrl);
router.put('/hostel/leave-requests/:id/return', authorize('campus', 'update', { subDomain: 'hostel' }), ctrl.recordHostelLeaveReturnCtrl);
router.post('/hostel/violations', authorize('campus', 'create', { subDomain: 'hostel' }), validate(reportViolationSchema), ctrl.reportViolationCtrl);
router.put('/hostel/violations/:id/investigate', authorize('campus', 'update', { subDomain: 'hostel' }), ctrl.investigateViolationCtrl);
router.put('/hostel/violations/:id/hearing', authorize('campus', 'update', { subDomain: 'hostel' }), validate(scheduleHearingSchema), ctrl.scheduleHearingCtrl);
router.put('/hostel/violations/:id/penalize', authorize('campus', 'update', { subDomain: 'hostel' }), validate(assignPenaltySchema), ctrl.assignPenaltyCtrl);
router.put('/hostel/violations/:id/dismiss', authorize('campus', 'update', { subDomain: 'hostel' }), ctrl.dismissViolationCtrl);
router.post('/hostel/appeals', authorize('campus', 'create', { subDomain: 'hostel' }), validate(fileAppealSchema), ctrl.fileAppealCtrl);
router.put('/hostel/appeals/:id/resolve', authorize('campus', 'update', { subDomain: 'hostel' }), validate(resolveAppealSchema), ctrl.resolveAppealCtrl);
router.post('/hostel/welfare-signals', authorize('campus', 'create', { subDomain: 'hostel' }), validate(escalateWardenConcernSchema), ctrl.escalateWardenConcernCtrl);

// Hostel CRUD
router.get('/beds', authorize('campus', 'read', { subDomain: 'hostel' }), ctrl.listBedsCtrl);
router.get('/beds/:id', authorize('campus', 'read', { subDomain: 'hostel' }), ctrl.getBedCtrl);
router.post('/beds', authorize('campus', 'create', { subDomain: 'hostel' }), ctrl.createBedCtrl);
router.put('/beds/:id', authorize('campus', 'update', { subDomain: 'hostel' }), ctrl.updateBedCtrl);
router.delete('/beds/:id', authorize('campus', 'delete', { subDomain: 'hostel' }), ctrl.deleteBedCtrl);

// ═══════════════════════════════════════════════════════════
// LIBRARY WORKFLOW ROUTES
// ═══════════════════════════════════════════════════════════
router.post('/library/issue', authorize('campus', 'create', { subDomain: 'library' }), validate(issueBookSchema), ctrl.issueBookCtrl);
router.post('/library/return', authorize('campus', 'create', { subDomain: 'library' }), validate(returnBookSchema), ctrl.returnBookCtrl);
router.post('/library/renew', authorize('campus', 'create', { subDomain: 'library' }), validate(renewBookSchema), ctrl.renewBookCtrl);
router.post('/library/lost', authorize('campus', 'create', { subDomain: 'library' }), validate(reportBookLostSchema), ctrl.reportBookLostCtrl);
router.post('/library/reserve', authorize('campus', 'create', { subDomain: 'library' }), validate(reserveBookSchema), ctrl.reserveBookCtrl);
router.put('/library/reservations/:id/pickup', authorize('campus', 'update', { subDomain: 'library' }), ctrl.pickupReservationCtrl);
router.put('/library/reservations/:id/cancel', authorize('campus', 'update', { subDomain: 'library' }), ctrl.cancelReservationCtrl);
router.post('/library/clearance/:personId', authorize('campus', 'create', { subDomain: 'library' }), validate(initiateLibraryClearanceSchema), ctrl.initiateLibraryClearanceCtrl);
router.get('/library/clearance/:personId', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getLibraryClearanceStatusCtrl);
router.post('/library/visits/entry', authorize('campus', 'create', { subDomain: 'library' }), validate(recordLibraryEntrySchema), ctrl.recordLibraryEntryCtrl);
router.put('/library/visits/:id/exit', authorize('campus', 'update', { subDomain: 'library' }), ctrl.recordLibraryExitCtrl);
router.get('/library/visits/stats', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getLibraryVisitStatsCtrl);

// Library Clearances CRUD
router.get('/library-clearances', authorize('campus', 'read', { subDomain: 'library' }), ctrl.listLibraryClearancesCtrl);
router.get('/library-clearances/:id', authorize('campus', 'read', { subDomain: 'library' }), ctrl.getLibraryClearanceCtrl);
router.post('/library-clearances', authorize('campus', 'create', { subDomain: 'library' }), ctrl.createLibraryClearanceCtrl);
router.put('/library-clearances/:id', authorize('campus', 'update', { subDomain: 'library' }), ctrl.updateLibraryClearanceCtrl);
router.delete('/library-clearances/:id', authorize('campus', 'delete', { subDomain: 'library' }), ctrl.deleteLibraryClearanceCtrl);

// ═══════════════════════════════════════════════════════════
// MESS WORKFLOW ROUTES
// ═══════════════════════════════════════════════════════════
router.post('/mess/meal-transactions', authorize('campus', 'create', { subDomain: 'mess' }), validate(recordMealTransactionSchema), ctrl.recordMealTransactionCtrl);
router.post('/mess/meal-attendance', authorize('campus', 'create', { subDomain: 'mess' }), ctrl.recordMealAttendanceCtrl);
router.get('/mess/daily-summary', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.getMessDailySummaryCtrl);
router.post('/mess/coupon-credit', authorize('campus', 'create', { subDomain: 'mess' }), validate(addCouponCreditSchema), ctrl.addCouponCreditCtrl);
router.post('/mess/menus', authorize('campus', 'create', { subDomain: 'mess' }), ctrl.createMenuCtrl);
router.put('/mess/menus/:id/approve', authorize('campus', 'update', { subDomain: 'mess' }), ctrl.approveMenuCtrl);
router.put('/mess/menus/:id/publish', authorize('campus', 'update', { subDomain: 'mess' }), ctrl.publishMenuCtrl);
router.post('/mess/quality-inspections', authorize('campus', 'create', { subDomain: 'mess' }), validate(qualityInspectionWorkflowSchema), ctrl.recordQualityInspectionCtrl);
router.get('/mess/quality-trend', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.getQualityTrendCtrl);
router.post('/mess/vendor-contracts', authorize('campus', 'create', { subDomain: 'mess' }), ctrl.createMessVendorContractCtrl);
router.put('/mess/vendor-contracts/:id/activate', authorize('campus', 'update', { subDomain: 'mess' }), ctrl.activateMessVendorContractCtrl);
router.put('/mess/vendor-contracts/:id/terminate', authorize('campus', 'update', { subDomain: 'mess' }), validate(terminateContractSchema), ctrl.terminateMessVendorContractCtrl);

// Mess Facilities CRUD
router.get('/mess-facilities', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.listMessFacilitiesCtrl);
router.get('/mess-facilities/:id', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.getMessFacilityCtrl);
router.post('/mess-facilities', authorize('campus', 'create', { subDomain: 'mess' }), ctrl.createMessFacilityCtrl);
router.put('/mess-facilities/:id', authorize('campus', 'update', { subDomain: 'mess' }), ctrl.updateMessFacilityCtrl);
router.delete('/mess-facilities/:id', authorize('campus', 'delete', { subDomain: 'mess' }), ctrl.deleteMessFacilityCtrl);

// Meal Transactions CRUD (immutable — list/get only)
router.get('/meal-transactions', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.listMealTransactionsCtrl);
router.get('/meal-transactions/:id', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.getMealTransactionCtrl);

// Mess Subscriptions CRUD
router.get('/mess-subscriptions', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.listMessSubscriptionsCtrl);
router.get('/mess-subscriptions/:id', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.getMessSubscriptionCtrl);
router.post('/mess-subscriptions', authorize('campus', 'create', { subDomain: 'mess' }), ctrl.createMessSubscriptionCtrl);
router.put('/mess-subscriptions/:id', authorize('campus', 'update', { subDomain: 'mess' }), ctrl.updateMessSubscriptionCtrl);
router.delete('/mess-subscriptions/:id', authorize('campus', 'delete', { subDomain: 'mess' }), ctrl.deleteMessSubscriptionCtrl);

// Dietary Preferences CRUD
router.get('/dietary-preferences', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.listDietaryPreferencesCtrl);
router.get('/dietary-preferences/:id', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.getDietaryPreferenceCtrl);
router.post('/dietary-preferences', authorize('campus', 'create', { subDomain: 'mess' }), ctrl.createDietaryPreferenceCtrl);
router.put('/dietary-preferences/:id', authorize('campus', 'update', { subDomain: 'mess' }), ctrl.updateDietaryPreferenceCtrl);
router.delete('/dietary-preferences/:id', authorize('campus', 'delete', { subDomain: 'mess' }), ctrl.deleteDietaryPreferenceCtrl);

// Quality Inspections CRUD
router.get('/quality-inspections', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.listQualityInspectionsCtrl);
router.get('/quality-inspections/:id', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.getQualityInspectionCtrl);
router.post('/quality-inspections', authorize('campus', 'create', { subDomain: 'mess' }), ctrl.createQualityInspectionRecordCtrl);
router.put('/quality-inspections/:id', authorize('campus', 'update', { subDomain: 'mess' }), ctrl.updateQualityInspectionCtrl);
router.delete('/quality-inspections/:id', authorize('campus', 'delete', { subDomain: 'mess' }), ctrl.deleteQualityInspectionCtrl);

// Mess Vendor Contracts CRUD
router.get('/mess-vendor-contracts', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.listMessVendorContractsCtrl);
router.get('/mess-vendor-contracts/:id', authorize('campus', 'read', { subDomain: 'mess' }), ctrl.getMessVendorContractByIdCtrl);
router.put('/mess-vendor-contracts/:id', authorize('campus', 'update', { subDomain: 'mess' }), ctrl.updateMessVendorContractRecordCtrl);
router.delete('/mess-vendor-contracts/:id', authorize('campus', 'delete', { subDomain: 'mess' }), ctrl.deleteMessVendorContractCtrl);

// ═══════════════════════════════════════════════════════════
// TRANSPORT WORKFLOW ROUTES
// ═══════════════════════════════════════════════════════════
router.post('/transport/allocate-bulk', authorize('campus', 'create', { subDomain: 'transport' }), validate(allocateTransportBulkSchema), ctrl.allocateTransportBulkCtrl);
router.post('/transport/allocate', authorize('campus', 'create', { subDomain: 'transport' }), validate(allocateTransportSingleSchema), ctrl.allocateTransportSingleCtrl);
router.post('/transport/clearance/:studentId', authorize('campus', 'create', { subDomain: 'transport' }), ctrl.initiateTransportClearanceCtrl);
router.get('/transport/clearance/:studentId', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.getTransportClearanceStatusCtrl);
router.post('/transport/trip-logs', authorize('campus', 'create', { subDomain: 'transport' }), ctrl.createTripLogCtrl);
router.put('/transport/trip-logs/:id/start', authorize('campus', 'update', { subDomain: 'transport' }), ctrl.startTripCtrl);
router.put('/transport/trip-logs/:id/complete', authorize('campus', 'update', { subDomain: 'transport' }), ctrl.completeTripCtrl);
router.post('/transport/attendance', authorize('campus', 'create', { subDomain: 'transport' }), validate(recordTransportAttendanceSchema), ctrl.recordTransportAttendanceCtrl);
router.put('/transport/routes/:id/adjust', authorize('campus', 'update', { subDomain: 'transport' }), validate(adjustRouteSchema), ctrl.adjustRouteCtrl);
router.get('/transport/route-utilization', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.getRouteUtilizationCtrl);
router.post('/transport/contractor-contracts', authorize('campus', 'create', { subDomain: 'transport' }), ctrl.createTransportContractorContractCtrl);
router.put('/transport/contractor-contracts/:id/activate', authorize('campus', 'update', { subDomain: 'transport' }), ctrl.activateTransportContractCtrl);
router.put('/transport/contractor-contracts/:id/terminate', authorize('campus', 'update', { subDomain: 'transport' }), validate(terminateContractSchema), ctrl.terminateTransportContractCtrl);

// Route Stops CRUD
router.get('/route-stops', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.listRouteStopsCtrl);
router.get('/route-stops/:id', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.getRouteStopCtrl);
router.post('/route-stops', authorize('campus', 'create', { subDomain: 'transport' }), ctrl.createRouteStopCtrl);
router.put('/route-stops/:id', authorize('campus', 'update', { subDomain: 'transport' }), ctrl.updateRouteStopCtrl);
router.delete('/route-stops/:id', authorize('campus', 'delete', { subDomain: 'transport' }), ctrl.deleteRouteStopCtrl);

// Drivers CRUD
router.get('/drivers', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.listDriversCtrl);
router.get('/drivers/:id', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.getDriverCtrl);
router.post('/drivers', authorize('campus', 'create', { subDomain: 'transport' }), ctrl.createDriverCtrl);
router.put('/drivers/:id', authorize('campus', 'update', { subDomain: 'transport' }), ctrl.updateDriverCtrl);
router.delete('/drivers/:id', authorize('campus', 'delete', { subDomain: 'transport' }), ctrl.deleteDriverCtrl);

// Trip Logs CRUD
router.get('/trip-logs', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.listTripLogsCtrl);
router.get('/trip-logs/:id', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.getTripLogCtrl);
router.post('/trip-logs', authorize('campus', 'create', { subDomain: 'transport' }), ctrl.createTripLogCtrl);
router.put('/trip-logs/:id', authorize('campus', 'update', { subDomain: 'transport' }), ctrl.updateTripLogCtrl);
router.delete('/trip-logs/:id', authorize('campus', 'delete', { subDomain: 'transport' }), ctrl.deleteTripLogCtrl);

// Transport Attendance CRUD (immutable — list/get only)
router.get('/transport-attendance', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.listTransportAttendancesCtrl);
router.get('/transport-attendance/:id', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.getTransportAttendanceCtrl);

// Transport Contractors CRUD
router.get('/transport-contractors', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.listTransportContractorsCtrl);
router.get('/transport-contractors/:id', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.getTransportContractorCtrl);
// TransportContractor CRUD create handled via workflow (createTransportContractorContractCtrl)
router.put('/transport-contractors/:id', authorize('campus', 'update', { subDomain: 'transport' }), ctrl.updateTransportContractorCtrl);
router.delete('/transport-contractors/:id', authorize('campus', 'delete', { subDomain: 'transport' }), ctrl.deleteTransportContractorCtrl);

// Transport Clearances CRUD
router.get('/transport-clearances', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.listTransportClearancesCtrl);
router.get('/transport-clearances/:id', authorize('campus', 'read', { subDomain: 'transport' }), ctrl.getTransportClearanceCtrl);
// TransportClearance create handled via workflow (initiateTransportClearanceCtrl)
router.put('/transport-clearances/:id', authorize('campus', 'update', { subDomain: 'transport' }), ctrl.updateTransportClearanceCtrl);
router.delete('/transport-clearances/:id', authorize('campus', 'delete', { subDomain: 'transport' }), ctrl.deleteTransportClearanceCtrl);

// ═══════════════════════════════════════════════════════════
// LABS WORKFLOW ROUTES
// ═══════════════════════════════════════════════════════════
router.post('/labs/register-equipment', authorize('campus', 'create', { subDomain: 'labs' }), validate(registerLabEquipmentSchema), ctrl.registerLabEquipmentCtrl);
router.put('/labs/equipment/:id/status', authorize('campus', 'update', { subDomain: 'labs' }), validate(updateEquipmentStatusSchema), ctrl.updateEquipmentStatusCtrl);
router.post('/labs/equipment-maintenance', authorize('campus', 'create', { subDomain: 'labs' }), validate(recordEquipmentMaintenanceSchema), ctrl.recordEquipmentMaintenanceCtrl);
router.get('/labs/equipment-due-calibration', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.getEquipmentDueForCalibrationCtrl);
router.post('/labs/slot-bookings', authorize('campus', 'create', { subDomain: 'labs' }), validate(requestLabSlotBookingSchema), ctrl.requestLabSlotBookingCtrl);
router.put('/labs/slot-bookings/:id/approve', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.approveLabSlotBookingCtrl);
router.put('/labs/slot-bookings/:id/reject', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.rejectLabSlotBookingCtrl);
router.put('/labs/slot-bookings/:id/complete', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.completeLabSlotBookingCtrl);
router.put('/labs/slot-bookings/:id/cancel', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.cancelLabSlotBookingCtrl);
router.post('/labs/equipment-issues', authorize('campus', 'create', { subDomain: 'labs' }), validate(issueEquipmentSchema), ctrl.issueEquipmentCtrl);
router.put('/labs/equipment-issues/:id/return', authorize('campus', 'update', { subDomain: 'labs' }), validate(returnEquipmentSchema), ctrl.returnEquipmentCtrl);
router.get('/labs/overdue-equipment', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.getOverdueEquipmentCtrl);
router.post('/labs/incidents', authorize('campus', 'create', { subDomain: 'labs' }), validate(reportLabIncidentSchema), ctrl.reportLabIncidentCtrl);
router.put('/labs/incidents/:id/investigate', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.investigateLabIncidentCtrl);
router.put('/labs/incidents/:id/resolve', authorize('campus', 'update', { subDomain: 'labs' }), validate(resolveLabIncidentSchema), ctrl.resolveLabIncidentCtrl);
router.put('/labs/incidents/:id/close', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.closeLabIncidentCtrl);
router.post('/labs/clearance/:studentId', authorize('campus', 'create', { subDomain: 'labs' }), ctrl.initiateLabClearanceCtrl);
router.get('/labs/clearance/:studentId', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.getLabClearanceStatusCtrl);

// Lab Equipment CRUD
router.get('/lab-equipment', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.listLabEquipmentCtrl);
router.get('/lab-equipment/:id', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.getLabEquipmentCtrl);
router.post('/lab-equipment', authorize('campus', 'create', { subDomain: 'labs' }), ctrl.createLabEquipmentCtrl);
router.put('/lab-equipment/:id', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.updateLabEquipmentCtrl);
router.delete('/lab-equipment/:id', authorize('campus', 'delete', { subDomain: 'labs' }), ctrl.deleteLabEquipmentCtrl);

// Lab Slot Bookings CRUD
router.get('/lab-slot-bookings', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.listLabSlotBookingsCtrl);
router.get('/lab-slot-bookings/:id', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.getLabSlotBookingCtrl);
router.post('/lab-slot-bookings', authorize('campus', 'create', { subDomain: 'labs' }), ctrl.createLabSlotBookingCrudCtrl);
router.put('/lab-slot-bookings/:id', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.updateLabSlotBookingCtrl);
router.delete('/lab-slot-bookings/:id', authorize('campus', 'delete', { subDomain: 'labs' }), ctrl.deleteLabSlotBookingCtrl);

// Equipment Issues CRUD
router.get('/equipment-issues', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.listEquipmentIssuesCtrl);
router.get('/equipment-issues/:id', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.getEquipmentIssueCtrl);
router.post('/equipment-issues', authorize('campus', 'create', { subDomain: 'labs' }), ctrl.createEquipmentIssueCrudCtrl);
router.put('/equipment-issues/:id', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.updateEquipmentIssueCtrl);
router.delete('/equipment-issues/:id', authorize('campus', 'delete', { subDomain: 'labs' }), ctrl.deleteEquipmentIssueCtrl);

// Lab Incidents CRUD
router.get('/lab-incidents', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.listLabIncidentsCtrl);
router.get('/lab-incidents/:id', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.getLabIncidentCtrl);
router.post('/lab-incidents', authorize('campus', 'create', { subDomain: 'labs' }), ctrl.createLabIncidentCrudCtrl);
router.put('/lab-incidents/:id', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.updateLabIncidentCtrl);
router.delete('/lab-incidents/:id', authorize('campus', 'delete', { subDomain: 'labs' }), ctrl.deleteLabIncidentCtrl);

// Lab Clearances CRUD
router.get('/lab-clearances', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.listLabClearancesCtrl);
router.get('/lab-clearances/:id', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.getLabClearanceCtrl);
router.post('/lab-clearances', authorize('campus', 'create', { subDomain: 'labs' }), ctrl.createLabClearanceCrudCtrl);
router.put('/lab-clearances/:id', authorize('campus', 'update', { subDomain: 'labs' }), ctrl.updateLabClearanceCtrl);
router.delete('/lab-clearances/:id', authorize('campus', 'delete', { subDomain: 'labs' }), ctrl.deleteLabClearanceCtrl);

// Facility Usage Logs (list/get)
router.get('/facility-usage-logs', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.listFacilityUsageLogsCtrl);
router.get('/facility-usage-logs/:id', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.getFacilityUsageLogCtrl);

// Equipment Maintenance Logs (list/get)
router.get('/equipment-maintenance-logs', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.listEquipmentMaintenanceLogsCtrl);
router.get('/equipment-maintenance-logs/:id', authorize('campus', 'read', { subDomain: 'labs' }), ctrl.getEquipmentMaintenanceLogCtrl);

// ═══════════════════════════════════════════════════════════
// FACILITIES WORKFLOW ROUTES
// ═══════════════════════════════════════════════════════════
router.post('/facilities/book', authorize('campus', 'create', { subDomain: 'facilities' }), validate(requestFacilityBookingSchema), ctrl.requestFacilityBookingCtrl);
router.put('/facilities/bookings/:id/approve', authorize('campus', 'update', { subDomain: 'facilities' }), ctrl.approveFacilityBookingCtrl);
router.put('/facilities/bookings/:id/reject', authorize('campus', 'update', { subDomain: 'facilities' }), validate(rejectBookingSchema), ctrl.rejectFacilityBookingCtrl);
router.put('/facilities/bookings/:id/cancel', authorize('campus', 'update', { subDomain: 'facilities' }), ctrl.cancelFacilityBookingCtrl);
router.post('/facilities/bookings/:id/usage-log', authorize('campus', 'create', { subDomain: 'facilities' }), validate(recordFacilityUsageSchema), ctrl.recordFacilityUsageCtrl);
router.put('/facilities/bookings/:id/no-show', authorize('campus', 'update', { subDomain: 'facilities' }), ctrl.recordNoShowCtrl);
router.get('/facilities/sports-equipment-availability', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getSportsEquipmentAvailabilityCtrl);
router.post('/facilities/campus-incidents', authorize('campus', 'create', { subDomain: 'facilities' }), validate(reportCampusIncidentSchema), ctrl.reportCampusIncidentCtrl);
router.put('/facilities/campus-incidents/:id/investigate', authorize('campus', 'update', { subDomain: 'facilities' }), ctrl.investigateCampusIncidentCtrl);
router.put('/facilities/campus-incidents/:id/resolve', authorize('campus', 'update', { subDomain: 'facilities' }), validate(resolveCampusIncidentSchema), ctrl.resolveCampusIncidentCtrl);
router.get('/facilities/utilization', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getFacilityUtilizationCtrl);
router.get('/facilities/utilization/:facilityId', authorize('campus', 'read', { subDomain: 'facilities' }), ctrl.getFacilityUtilizationByRoomCtrl);
router.put('/facilities/visitor-checkout/:id', authorize('campus', 'update', { subDomain: 'facilities' }), ctrl.recordVisitorCheckoutCtrl);

// ═══════════════════════════════════════════════════════════
// MAINTENANCE WORKFLOW ROUTES
// ═══════════════════════════════════════════════════════════
router.post('/maintenance/submit', authorize('campus', 'create', { subDomain: 'maintenance' }), validate(submitMaintenanceRequestSchema), ctrl.submitMaintenanceRequestCtrl);
router.put('/maintenance/requests/:id/triage', authorize('campus', 'update', { subDomain: 'maintenance' }), validate(triageMaintenanceRequestSchema), ctrl.triageMaintenanceRequestCtrl);
router.post('/maintenance/assignments', authorize('campus', 'create', { subDomain: 'maintenance' }), validate(createMaintenanceAssignmentSchema_wf), ctrl.createMaintenanceAssignmentCtrl);
router.put('/maintenance/assignments/:id/start', authorize('campus', 'update', { subDomain: 'maintenance' }), ctrl.startMaintenanceWorkCtrl);
router.put('/maintenance/assignments/:id/complete', authorize('campus', 'update', { subDomain: 'maintenance' }), ctrl.completeMaintenanceAssignmentCtrl);
router.put('/maintenance/requests/:id/verify', authorize('campus', 'update', { subDomain: 'maintenance' }), validate(verifyMaintenanceWorkSchema), ctrl.verifyMaintenanceWorkCtrl);
router.post('/maintenance/work-logs', authorize('campus', 'create', { subDomain: 'maintenance' }), validate(addMaintenanceWorkLogSchema), ctrl.addMaintenanceWorkLogCtrl);
router.post('/maintenance/pm-trigger', authorize('campus', 'create', { subDomain: 'maintenance' }), validate(triggerPreventiveMaintenanceSchema), ctrl.triggerPreventiveMaintenanceCtrl);
router.get('/maintenance/pm-due', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.checkDuePreventiveMaintenanceCtrl);
router.put('/maintenance/pm/:id/complete', authorize('campus', 'update', { subDomain: 'maintenance' }), ctrl.completePreventiveMaintenanceCtrl);
router.get('/maintenance/sla-breaches', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.checkSLABreachesCtrl);
router.post('/maintenance/escalations', authorize('campus', 'create', { subDomain: 'maintenance' }), validate(createMaintenanceEscalationSchema_wf), ctrl.createMaintenanceEscalationCtrl);
router.put('/maintenance/escalations/:id/acknowledge', authorize('campus', 'update', { subDomain: 'maintenance' }), ctrl.acknowledgeEscalationCtrl);
router.put('/maintenance/escalations/:id/resolve', authorize('campus', 'update', { subDomain: 'maintenance' }), ctrl.resolveEscalationCtrl);
router.post('/maintenance/vendor-performance', authorize('campus', 'create', { subDomain: 'maintenance' }), validate(calculateVendorPerformanceSchema), ctrl.calculateVendorPerformanceCtrl);
router.get('/maintenance/vendor-performance-summary', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.getVendorPerformanceSummaryCtrl);

// Maintenance Assignments CRUD
router.get('/maintenance-assignments', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.listMaintenanceAssignmentsCtrl);
router.get('/maintenance-assignments/:id', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.getMaintenanceAssignmentCtrl);
// MaintenanceAssignment create handled via workflow (createMaintenanceAssignmentCtrl)
router.put('/maintenance-assignments/:id', authorize('campus', 'update', { subDomain: 'maintenance' }), ctrl.updateMaintenanceAssignmentCtrl);
router.delete('/maintenance-assignments/:id', authorize('campus', 'delete', { subDomain: 'maintenance' }), ctrl.deleteMaintenanceAssignmentCtrl);

// Maintenance Work Logs (list/get)
router.get('/maintenance-work-logs', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.listMaintenanceWorkLogsCtrl);
router.get('/maintenance-work-logs/:id', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.getMaintenanceWorkLogCtrl);

// Maintenance Escalations CRUD
router.get('/maintenance-escalations', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.listMaintenanceEscalationsCtrl);
router.get('/maintenance-escalations/:id', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.getMaintenanceEscalationCtrl);
// MaintenanceEscalation create handled via workflow (createMaintenanceEscalationCtrl)
router.put('/maintenance-escalations/:id', authorize('campus', 'update', { subDomain: 'maintenance' }), ctrl.updateMaintenanceEscalationCtrl);
router.delete('/maintenance-escalations/:id', authorize('campus', 'delete', { subDomain: 'maintenance' }), ctrl.deleteMaintenanceEscalationCtrl);

// AMC Contracts CRUD
router.get('/amc-contracts', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.listAMCContractsCtrl);
router.get('/amc-contracts/:id', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.getAMCContractCtrl);
router.post('/amc-contracts', authorize('campus', 'create', { subDomain: 'maintenance' }), ctrl.createAMCContractRecordCtrl);
router.put('/amc-contracts/:id', authorize('campus', 'update', { subDomain: 'maintenance' }), ctrl.updateAMCContractCtrl);
router.delete('/amc-contracts/:id', authorize('campus', 'delete', { subDomain: 'maintenance' }), ctrl.deleteAMCContractCtrl);

// Vendor Performances CRUD
router.get('/vendor-performances', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.listVendorPerformancesCtrl);
router.get('/vendor-performances/:id', authorize('campus', 'read', { subDomain: 'maintenance' }), ctrl.getVendorPerformanceCtrl);
router.post('/vendor-performances', authorize('campus', 'create', { subDomain: 'maintenance' }), ctrl.createVendorPerformanceRecordCtrl);
router.put('/vendor-performances/:id', authorize('campus', 'update', { subDomain: 'maintenance' }), ctrl.updateVendorPerformanceRecordCtrl);
router.delete('/vendor-performances/:id', authorize('campus', 'delete', { subDomain: 'maintenance' }), ctrl.deleteVendorPerformanceRecordCtrl);

// ═══════════════════════════════════════════════════════════
// CROSS-MODULE ROUTES
// ═══════════════════════════════════════════════════════════
router.get('/clearance/:studentId', authorize('campus', 'read'), ctrl.aggregateClearanceStatusCtrl);
router.post('/provision/:studentId', authorize('campus', 'create'), validate(provisionInfrastructureSchema), ctrl.provisionInfrastructureCtrl);
router.get('/compliance/evidence', authorize('campus', 'read'), ctrl.getComplianceEvidenceCtrl);
router.get('/governance/metrics', authorize('campus', 'read'), ctrl.getGovernanceMetricsCtrl);

export default router;

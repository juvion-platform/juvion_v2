import api from './api';

const BASE = '/campus';

// ─── Stats ────────────────────────────────────────────────
export const getCampusOpsStats = () => api.get(`${BASE}/stats`).then(r => r.data);

// ═══════════════════════════════════════════════════════════
// CAMPUS SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// ─── Buildings ────────────────────────────────────────────
export const listBuildings = (page = 1, limit = 20) =>
  api.get(`${BASE}/buildings`, { params: { page, limit } }).then(r => r.data);
export const getBuilding = (id: string) =>
  api.get(`${BASE}/buildings/${id}`).then(r => r.data);
export const createBuilding = (data: any) =>
  api.post(`${BASE}/buildings`, data).then(r => r.data);
export const updateBuilding = (id: string, data: any) =>
  api.put(`${BASE}/buildings/${id}`, data).then(r => r.data);
export const deleteBuilding = (id: string) =>
  api.delete(`${BASE}/buildings/${id}`).then(r => r.data);

// ─── Rooms ────────────────────────────────────────────────
export const listRooms = (page = 1, limit = 20) =>
  api.get(`${BASE}/rooms`, { params: { page, limit } }).then(r => r.data);
export const getRoom = (id: string) =>
  api.get(`${BASE}/rooms/${id}`).then(r => r.data);
export const createRoom = (data: any) =>
  api.post(`${BASE}/rooms`, data).then(r => r.data);
export const updateRoom = (id: string, data: any) =>
  api.put(`${BASE}/rooms/${id}`, data).then(r => r.data);
export const deleteRoom = (id: string) =>
  api.delete(`${BASE}/rooms/${id}`).then(r => r.data);

// ─── Room Bookings ────────────────────────────────────────
export const listRoomBookings = (page = 1, limit = 20) =>
  api.get(`${BASE}/room-bookings`, { params: { page, limit } }).then(r => r.data);
export const getRoomBooking = (id: string) =>
  api.get(`${BASE}/room-bookings/${id}`).then(r => r.data);
export const createRoomBooking = (data: any) =>
  api.post(`${BASE}/room-bookings`, data).then(r => r.data);
export const updateRoomBooking = (id: string, data: any) =>
  api.put(`${BASE}/room-bookings/${id}`, data).then(r => r.data);
export const deleteRoomBooking = (id: string) =>
  api.delete(`${BASE}/room-bookings/${id}`).then(r => r.data);

// ─── Vehicles ─────────────────────────────────────────────
export const listVehicles = (page = 1, limit = 20) =>
  api.get(`${BASE}/vehicles`, { params: { page, limit } }).then(r => r.data);
export const getVehicle = (id: string) =>
  api.get(`${BASE}/vehicles/${id}`).then(r => r.data);
export const createVehicle = (data: any) =>
  api.post(`${BASE}/vehicles`, data).then(r => r.data);
export const updateVehicle = (id: string, data: any) =>
  api.put(`${BASE}/vehicles/${id}`, data).then(r => r.data);
export const deleteVehicle = (id: string) =>
  api.delete(`${BASE}/vehicles/${id}`).then(r => r.data);

// ─── Gate Passes ──────────────────────────────────────────
export const listGatePasses = (page = 1, limit = 20) =>
  api.get(`${BASE}/gate-passes`, { params: { page, limit } }).then(r => r.data);
export const getGatePass = (id: string) =>
  api.get(`${BASE}/gate-passes/${id}`).then(r => r.data);
export const createGatePass = (data: any) =>
  api.post(`${BASE}/gate-passes`, data).then(r => r.data);
export const updateGatePass = (id: string, data: any) =>
  api.put(`${BASE}/gate-passes/${id}`, data).then(r => r.data);
export const deleteGatePass = (id: string) =>
  api.delete(`${BASE}/gate-passes/${id}`).then(r => r.data);

// ─── Visitor Entries ──────────────────────────────────────
export const listVisitorEntries = (page = 1, limit = 20) =>
  api.get(`${BASE}/visitor-entries`, { params: { page, limit } }).then(r => r.data);
export const getVisitorEntry = (id: string) =>
  api.get(`${BASE}/visitor-entries/${id}`).then(r => r.data);
export const createVisitorEntry = (data: any) =>
  api.post(`${BASE}/visitor-entries`, data).then(r => r.data);
export const updateVisitorEntry = (id: string, data: any) =>
  api.put(`${BASE}/visitor-entries/${id}`, data).then(r => r.data);
export const deleteVisitorEntry = (id: string) =>
  api.delete(`${BASE}/visitor-entries/${id}`).then(r => r.data);

// ─── Security Incidents ───────────────────────────────────
export const listSecurityIncidents = (page = 1, limit = 20) =>
  api.get(`${BASE}/security-incidents`, { params: { page, limit } }).then(r => r.data);
export const getSecurityIncident = (id: string) =>
  api.get(`${BASE}/security-incidents/${id}`).then(r => r.data);
export const createSecurityIncident = (data: any) =>
  api.post(`${BASE}/security-incidents`, data).then(r => r.data);
export const updateSecurityIncident = (id: string, data: any) =>
  api.put(`${BASE}/security-incidents/${id}`, data).then(r => r.data);
export const deleteSecurityIncident = (id: string) =>
  api.delete(`${BASE}/security-incidents/${id}`).then(r => r.data);

// ─── CCTV ─────────────────────────────────────────────────
export const listCCTVs = (page = 1, limit = 20) =>
  api.get(`${BASE}/cctvs`, { params: { page, limit } }).then(r => r.data);
export const getCCTV = (id: string) =>
  api.get(`${BASE}/cctvs/${id}`).then(r => r.data);
export const createCCTV = (data: any) =>
  api.post(`${BASE}/cctvs`, data).then(r => r.data);
export const updateCCTV = (id: string, data: any) =>
  api.put(`${BASE}/cctvs/${id}`, data).then(r => r.data);
export const deleteCCTV = (id: string) =>
  api.delete(`${BASE}/cctvs/${id}`).then(r => r.data);

// ─── Emergency Contacts ───────────────────────────────────
export const listEmergencyContacts = (page = 1, limit = 20) =>
  api.get(`${BASE}/emergency-contacts`, { params: { page, limit } }).then(r => r.data);
export const getEmergencyContact = (id: string) =>
  api.get(`${BASE}/emergency-contacts/${id}`).then(r => r.data);
export const createEmergencyContact = (data: any) =>
  api.post(`${BASE}/emergency-contacts`, data).then(r => r.data);
export const updateEmergencyContact = (id: string, data: any) =>
  api.put(`${BASE}/emergency-contacts/${id}`, data).then(r => r.data);
export const deleteEmergencyContact = (id: string) =>
  api.delete(`${BASE}/emergency-contacts/${id}`).then(r => r.data);

// ─── Labs ─────────────────────────────────────────────────
export const listLabs = (page = 1, limit = 20) =>
  api.get(`${BASE}/labs`, { params: { page, limit } }).then(r => r.data);
export const getLab = (id: string) =>
  api.get(`${BASE}/labs/${id}`).then(r => r.data);
export const createLab = (data: any) =>
  api.post(`${BASE}/labs`, data).then(r => r.data);
export const updateLab = (id: string, data: any) =>
  api.put(`${BASE}/labs/${id}`, data).then(r => r.data);
export const deleteLab = (id: string) =>
  api.delete(`${BASE}/labs/${id}`).then(r => r.data);

// ─── Parking Slots ────────────────────────────────────────
export const listParkingSlots = (page = 1, limit = 20) =>
  api.get(`${BASE}/parking-slots`, { params: { page, limit } }).then(r => r.data);
export const getParkingSlot = (id: string) =>
  api.get(`${BASE}/parking-slots/${id}`).then(r => r.data);
export const createParkingSlot = (data: any) =>
  api.post(`${BASE}/parking-slots`, data).then(r => r.data);
export const updateParkingSlot = (id: string, data: any) =>
  api.put(`${BASE}/parking-slots/${id}`, data).then(r => r.data);
export const deleteParkingSlot = (id: string) =>
  api.delete(`${BASE}/parking-slots/${id}`).then(r => r.data);

// ─── Power Backups ────────────────────────────────────────
export const listPowerBackups = (page = 1, limit = 20) =>
  api.get(`${BASE}/power-backups`, { params: { page, limit } }).then(r => r.data);
export const getPowerBackup = (id: string) =>
  api.get(`${BASE}/power-backups/${id}`).then(r => r.data);
export const createPowerBackup = (data: any) =>
  api.post(`${BASE}/power-backups`, data).then(r => r.data);
export const updatePowerBackup = (id: string, data: any) =>
  api.put(`${BASE}/power-backups/${id}`, data).then(r => r.data);
export const deletePowerBackup = (id: string) =>
  api.delete(`${BASE}/power-backups/${id}`).then(r => r.data);

// ─── Green Initiatives ────────────────────────────────────
export const listGreenInitiatives = (page = 1, limit = 20) =>
  api.get(`${BASE}/green-initiatives`, { params: { page, limit } }).then(r => r.data);
export const getGreenInitiative = (id: string) =>
  api.get(`${BASE}/green-initiatives/${id}`).then(r => r.data);
export const createGreenInitiative = (data: any) =>
  api.post(`${BASE}/green-initiatives`, data).then(r => r.data);
export const updateGreenInitiative = (id: string, data: any) =>
  api.put(`${BASE}/green-initiatives/${id}`, data).then(r => r.data);
export const deleteGreenInitiative = (id: string) =>
  api.delete(`${BASE}/green-initiatives/${id}`).then(r => r.data);

// ─── Water Supplies ───────────────────────────────────────
export const listWaterSupplies = (page = 1, limit = 20) =>
  api.get(`${BASE}/water-supplies`, { params: { page, limit } }).then(r => r.data);
export const getWaterSupply = (id: string) =>
  api.get(`${BASE}/water-supplies/${id}`).then(r => r.data);
export const createWaterSupply = (data: any) =>
  api.post(`${BASE}/water-supplies`, data).then(r => r.data);
export const updateWaterSupply = (id: string, data: any) =>
  api.put(`${BASE}/water-supplies/${id}`, data).then(r => r.data);
export const deleteWaterSupply = (id: string) =>
  api.delete(`${BASE}/water-supplies/${id}`).then(r => r.data);

// ═══════════════════════════════════════════════════════════
// FACILITIES SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// ─── Assets ───────────────────────────────────────────────
export const listAssets = (page = 1, limit = 20) =>
  api.get(`${BASE}/assets`, { params: { page, limit } }).then(r => r.data);
export const getAsset = (id: string) =>
  api.get(`${BASE}/assets/${id}`).then(r => r.data);
export const createAsset = (data: any) =>
  api.post(`${BASE}/assets`, data).then(r => r.data);
export const updateAsset = (id: string, data: any) =>
  api.put(`${BASE}/assets/${id}`, data).then(r => r.data);
export const deleteAsset = (id: string) =>
  api.delete(`${BASE}/assets/${id}`).then(r => r.data);

// ─── Asset Allocations ────────────────────────────────────
export const listAssetAllocations = (page = 1, limit = 20) =>
  api.get(`${BASE}/asset-allocations`, { params: { page, limit } }).then(r => r.data);
export const getAssetAllocation = (id: string) =>
  api.get(`${BASE}/asset-allocations/${id}`).then(r => r.data);
export const createAssetAllocation = (data: any) =>
  api.post(`${BASE}/asset-allocations`, data).then(r => r.data);
export const updateAssetAllocation = (id: string, data: any) =>
  api.put(`${BASE}/asset-allocations/${id}`, data).then(r => r.data);
export const deleteAssetAllocation = (id: string) =>
  api.delete(`${BASE}/asset-allocations/${id}`).then(r => r.data);

// ─── Maintenance Requests ─────────────────────────────────
export const listMaintenanceRequests = (page = 1, limit = 20) =>
  api.get(`${BASE}/maintenance-requests`, { params: { page, limit } }).then(r => r.data);
export const getMaintenanceRequest = (id: string) =>
  api.get(`${BASE}/maintenance-requests/${id}`).then(r => r.data);
export const createMaintenanceRequest = (data: any) =>
  api.post(`${BASE}/maintenance-requests`, data).then(r => r.data);
export const updateMaintenanceRequest = (id: string, data: any) =>
  api.put(`${BASE}/maintenance-requests/${id}`, data).then(r => r.data);
export const deleteMaintenanceRequest = (id: string) =>
  api.delete(`${BASE}/maintenance-requests/${id}`).then(r => r.data);

// ─── Maintenance Schedules ────────────────────────────────
export const listMaintenanceSchedules = (page = 1, limit = 20) =>
  api.get(`${BASE}/maintenance-schedules`, { params: { page, limit } }).then(r => r.data);
export const getMaintenanceSchedule = (id: string) =>
  api.get(`${BASE}/maintenance-schedules/${id}`).then(r => r.data);
export const createMaintenanceSchedule = (data: any) =>
  api.post(`${BASE}/maintenance-schedules`, data).then(r => r.data);
export const updateMaintenanceSchedule = (id: string, data: any) =>
  api.put(`${BASE}/maintenance-schedules/${id}`, data).then(r => r.data);
export const deleteMaintenanceSchedule = (id: string) =>
  api.delete(`${BASE}/maintenance-schedules/${id}`).then(r => r.data);

// ─── Construction Projects ────────────────────────────────
export const listConstructionProjects = (page = 1, limit = 20) =>
  api.get(`${BASE}/construction-projects`, { params: { page, limit } }).then(r => r.data);
export const getConstructionProject = (id: string) =>
  api.get(`${BASE}/construction-projects/${id}`).then(r => r.data);
export const createConstructionProject = (data: any) =>
  api.post(`${BASE}/construction-projects`, data).then(r => r.data);
export const updateConstructionProject = (id: string, data: any) =>
  api.put(`${BASE}/construction-projects/${id}`, data).then(r => r.data);
export const deleteConstructionProject = (id: string) =>
  api.delete(`${BASE}/construction-projects/${id}`).then(r => r.data);

// ─── Vendors ──────────────────────────────────────────────
export const listVendors = (page = 1, limit = 20) =>
  api.get(`${BASE}/vendors`, { params: { page, limit } }).then(r => r.data);
export const getVendor = (id: string) =>
  api.get(`${BASE}/vendors/${id}`).then(r => r.data);
export const createVendor = (data: any) =>
  api.post(`${BASE}/vendors`, data).then(r => r.data);
export const updateVendor = (id: string, data: any) =>
  api.put(`${BASE}/vendors/${id}`, data).then(r => r.data);
export const deleteVendor = (id: string) =>
  api.delete(`${BASE}/vendors/${id}`).then(r => r.data);

// ─── Purchase Orders ──────────────────────────────────────
export const listPurchaseOrders = (page = 1, limit = 20) =>
  api.get(`${BASE}/purchase-orders`, { params: { page, limit } }).then(r => r.data);
export const getPurchaseOrder = (id: string) =>
  api.get(`${BASE}/purchase-orders/${id}`).then(r => r.data);
export const createPurchaseOrder = (data: any) =>
  api.post(`${BASE}/purchase-orders`, data).then(r => r.data);
export const updatePurchaseOrder = (id: string, data: any) =>
  api.put(`${BASE}/purchase-orders/${id}`, data).then(r => r.data);
export const deletePurchaseOrder = (id: string) =>
  api.delete(`${BASE}/purchase-orders/${id}`).then(r => r.data);

// ─── Stock Items ──────────────────────────────────────────
export const listStockItems = (page = 1, limit = 20) =>
  api.get(`${BASE}/stock-items`, { params: { page, limit } }).then(r => r.data);
export const getStockItem = (id: string) =>
  api.get(`${BASE}/stock-items/${id}`).then(r => r.data);
export const createStockItem = (data: any) =>
  api.post(`${BASE}/stock-items`, data).then(r => r.data);
export const updateStockItem = (id: string, data: any) =>
  api.put(`${BASE}/stock-items/${id}`, data).then(r => r.data);
export const deleteStockItem = (id: string) =>
  api.delete(`${BASE}/stock-items/${id}`).then(r => r.data);

// ─── Stock Transactions ───────────────────────────────────
export const listStockTransactions = (page = 1, limit = 20) =>
  api.get(`${BASE}/stock-transactions`, { params: { page, limit } }).then(r => r.data);
export const getStockTransaction = (id: string) =>
  api.get(`${BASE}/stock-transactions/${id}`).then(r => r.data);
export const createStockTransaction = (data: any) =>
  api.post(`${BASE}/stock-transactions`, data).then(r => r.data);
export const updateStockTransaction = (id: string, data: any) =>
  api.put(`${BASE}/stock-transactions/${id}`, data).then(r => r.data);
export const deleteStockTransaction = (id: string) =>
  api.delete(`${BASE}/stock-transactions/${id}`).then(r => r.data);

// ─── IT Assets ────────────────────────────────────────────
export const listITAssets = (page = 1, limit = 20) =>
  api.get(`${BASE}/it-assets`, { params: { page, limit } }).then(r => r.data);
export const getITAsset = (id: string) =>
  api.get(`${BASE}/it-assets/${id}`).then(r => r.data);
export const createITAsset = (data: any) =>
  api.post(`${BASE}/it-assets`, data).then(r => r.data);
export const updateITAsset = (id: string, data: any) =>
  api.put(`${BASE}/it-assets/${id}`, data).then(r => r.data);
export const deleteITAsset = (id: string) =>
  api.delete(`${BASE}/it-assets/${id}`).then(r => r.data);

// ─── Network Infra ────────────────────────────────────────
export const listNetworkInfra = (page = 1, limit = 20) =>
  api.get(`${BASE}/network-infra`, { params: { page, limit } }).then(r => r.data);
export const getNetworkInfra = (id: string) =>
  api.get(`${BASE}/network-infra/${id}`).then(r => r.data);
export const createNetworkInfra = (data: any) =>
  api.post(`${BASE}/network-infra`, data).then(r => r.data);
export const updateNetworkInfra = (id: string, data: any) =>
  api.put(`${BASE}/network-infra/${id}`, data).then(r => r.data);
export const deleteNetworkInfra = (id: string) =>
  api.delete(`${BASE}/network-infra/${id}`).then(r => r.data);

// ─── Insurances ───────────────────────────────────────────
export const listInsurances = (page = 1, limit = 20) =>
  api.get(`${BASE}/insurances`, { params: { page, limit } }).then(r => r.data);
export const getInsurance = (id: string) =>
  api.get(`${BASE}/insurances/${id}`).then(r => r.data);
export const createInsurance = (data: any) =>
  api.post(`${BASE}/insurances`, data).then(r => r.data);
export const updateInsurance = (id: string, data: any) =>
  api.put(`${BASE}/insurances/${id}`, data).then(r => r.data);
export const deleteInsurance = (id: string) =>
  api.delete(`${BASE}/insurances/${id}`).then(r => r.data);

// ─── Energy Consumptions ──────────────────────────────────
export const listEnergyConsumptions = (page = 1, limit = 20) =>
  api.get(`${BASE}/energy-consumptions`, { params: { page, limit } }).then(r => r.data);
export const getEnergyConsumption = (id: string) =>
  api.get(`${BASE}/energy-consumptions/${id}`).then(r => r.data);
export const createEnergyConsumption = (data: any) =>
  api.post(`${BASE}/energy-consumptions`, data).then(r => r.data);
export const updateEnergyConsumption = (id: string, data: any) =>
  api.put(`${BASE}/energy-consumptions/${id}`, data).then(r => r.data);
export const deleteEnergyConsumption = (id: string) =>
  api.delete(`${BASE}/energy-consumptions/${id}`).then(r => r.data);

// ─── Waste Managements ────────────────────────────────────
export const listWasteManagements = (page = 1, limit = 20) =>
  api.get(`${BASE}/waste-managements`, { params: { page, limit } }).then(r => r.data);
export const getWasteManagement = (id: string) =>
  api.get(`${BASE}/waste-managements/${id}`).then(r => r.data);
export const createWasteManagement = (data: any) =>
  api.post(`${BASE}/waste-managements`, data).then(r => r.data);
export const updateWasteManagement = (id: string, data: any) =>
  api.put(`${BASE}/waste-managements/${id}`, data).then(r => r.data);
export const deleteWasteManagement = (id: string) =>
  api.delete(`${BASE}/waste-managements/${id}`).then(r => r.data);

// ═══════════════════════════════════════════════════════════
// LIBRARY SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// ─── Books ────────────────────────────────────────────────
export const listBooks = (page = 1, limit = 20) =>
  api.get(`${BASE}/books`, { params: { page, limit } }).then(r => r.data);
export const getBook = (id: string) =>
  api.get(`${BASE}/books/${id}`).then(r => r.data);
export const createBook = (data: any) =>
  api.post(`${BASE}/books`, data).then(r => r.data);
export const updateBook = (id: string, data: any) =>
  api.put(`${BASE}/books/${id}`, data).then(r => r.data);
export const deleteBook = (id: string) =>
  api.delete(`${BASE}/books/${id}`).then(r => r.data);

// ─── Book Issues ──────────────────────────────────────────
export const listBookIssues = (page = 1, limit = 20) =>
  api.get(`${BASE}/book-issues`, { params: { page, limit } }).then(r => r.data);
export const getBookIssue = (id: string) =>
  api.get(`${BASE}/book-issues/${id}`).then(r => r.data);
export const createBookIssue = (data: any) =>
  api.post(`${BASE}/book-issues`, data).then(r => r.data);
export const updateBookIssue = (id: string, data: any) =>
  api.put(`${BASE}/book-issues/${id}`, data).then(r => r.data);
export const deleteBookIssue = (id: string) =>
  api.delete(`${BASE}/book-issues/${id}`).then(r => r.data);

// ─── Book Reservations ────────────────────────────────────
export const listBookReservations = (page = 1, limit = 20) =>
  api.get(`${BASE}/book-reservations`, { params: { page, limit } }).then(r => r.data);
export const getBookReservation = (id: string) =>
  api.get(`${BASE}/book-reservations/${id}`).then(r => r.data);
export const createBookReservation = (data: any) =>
  api.post(`${BASE}/book-reservations`, data).then(r => r.data);
export const updateBookReservation = (id: string, data: any) =>
  api.put(`${BASE}/book-reservations/${id}`, data).then(r => r.data);
export const deleteBookReservation = (id: string) =>
  api.delete(`${BASE}/book-reservations/${id}`).then(r => r.data);

// ─── Library Members ──────────────────────────────────────
export const listLibraryMembers = (page = 1, limit = 20) =>
  api.get(`${BASE}/library-members`, { params: { page, limit } }).then(r => r.data);
export const getLibraryMember = (id: string) =>
  api.get(`${BASE}/library-members/${id}`).then(r => r.data);
export const createLibraryMember = (data: any) =>
  api.post(`${BASE}/library-members`, data).then(r => r.data);
export const updateLibraryMember = (id: string, data: any) =>
  api.put(`${BASE}/library-members/${id}`, data).then(r => r.data);
export const deleteLibraryMember = (id: string) =>
  api.delete(`${BASE}/library-members/${id}`).then(r => r.data);

// ─── Library Fines ────────────────────────────────────────
export const listLibraryFines = (page = 1, limit = 20) =>
  api.get(`${BASE}/library-fines`, { params: { page, limit } }).then(r => r.data);
export const getLibraryFine = (id: string) =>
  api.get(`${BASE}/library-fines/${id}`).then(r => r.data);
export const createLibraryFine = (data: any) =>
  api.post(`${BASE}/library-fines`, data).then(r => r.data);
export const updateLibraryFine = (id: string, data: any) =>
  api.put(`${BASE}/library-fines/${id}`, data).then(r => r.data);
export const deleteLibraryFine = (id: string) =>
  api.delete(`${BASE}/library-fines/${id}`).then(r => r.data);

// ─── Library Gate Entries ─────────────────────────────────
export const listLibraryGateEntries = (page = 1, limit = 20) =>
  api.get(`${BASE}/library-gate-entries`, { params: { page, limit } }).then(r => r.data);
export const getLibraryGateEntry = (id: string) =>
  api.get(`${BASE}/library-gate-entries/${id}`).then(r => r.data);
export const createLibraryGateEntry = (data: any) =>
  api.post(`${BASE}/library-gate-entries`, data).then(r => r.data);
export const updateLibraryGateEntry = (id: string, data: any) =>
  api.put(`${BASE}/library-gate-entries/${id}`, data).then(r => r.data);
export const deleteLibraryGateEntry = (id: string) =>
  api.delete(`${BASE}/library-gate-entries/${id}`).then(r => r.data);

// ─── E-Resources ──────────────────────────────────────────
export const listEResources = (page = 1, limit = 20) =>
  api.get(`${BASE}/e-resources`, { params: { page, limit } }).then(r => r.data);
export const getEResource = (id: string) =>
  api.get(`${BASE}/e-resources/${id}`).then(r => r.data);
export const createEResource = (data: any) =>
  api.post(`${BASE}/e-resources`, data).then(r => r.data);
export const updateEResource = (id: string, data: any) =>
  api.put(`${BASE}/e-resources/${id}`, data).then(r => r.data);
export const deleteEResource = (id: string) =>
  api.delete(`${BASE}/e-resources/${id}`).then(r => r.data);

// ─── E-Resource Accesses ──────────────────────────────────
export const listEResourceAccesses = (page = 1, limit = 20) =>
  api.get(`${BASE}/e-resource-accesses`, { params: { page, limit } }).then(r => r.data);
export const getEResourceAccess = (id: string) =>
  api.get(`${BASE}/e-resource-accesses/${id}`).then(r => r.data);
export const createEResourceAccess = (data: any) =>
  api.post(`${BASE}/e-resource-accesses`, data).then(r => r.data);
export const updateEResourceAccess = (id: string, data: any) =>
  api.put(`${BASE}/e-resource-accesses/${id}`, data).then(r => r.data);
export const deleteEResourceAccess = (id: string) =>
  api.delete(`${BASE}/e-resource-accesses/${id}`).then(r => r.data);

// ─── Periodical Subscriptions ─────────────────────────────
export const listPeriodicalSubscriptions = (page = 1, limit = 20) =>
  api.get(`${BASE}/periodical-subscriptions`, { params: { page, limit } }).then(r => r.data);
export const getPeriodicalSubscription = (id: string) =>
  api.get(`${BASE}/periodical-subscriptions/${id}`).then(r => r.data);
export const createPeriodicalSubscription = (data: any) =>
  api.post(`${BASE}/periodical-subscriptions`, data).then(r => r.data);
export const updatePeriodicalSubscription = (id: string, data: any) =>
  api.put(`${BASE}/periodical-subscriptions/${id}`, data).then(r => r.data);
export const deletePeriodicalSubscription = (id: string) =>
  api.delete(`${BASE}/periodical-subscriptions/${id}`).then(r => r.data);

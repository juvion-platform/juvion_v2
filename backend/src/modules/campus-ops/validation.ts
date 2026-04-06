import { z } from 'zod';

// ═══════════════════════════════════════════════════════════
// CAMPUS SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// ═══ Building ════════════════════════════════════════════
export const createBuildingSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  floors: z.number().int().min(0),
  totalRooms: z.number().int().min(0),
  location: z.string().optional(),
  isActive: z.boolean().optional(),
});
export const updateBuildingSchema = createBuildingSchema.partial();

// ═══ Room ════════════════════════════════════════════════
export const createRoomSchema = z.object({
  buildingId: z.string().min(1),
  roomNumber: z.string().min(1),
  floor: z.number().int().min(0),
  type: z.enum(['classroom', 'lab', 'seminar_hall', 'conference', 'office', 'workshop', 'auditorium']),
  capacity: z.number().int().min(1),
  hasProjector: z.boolean().optional(),
  hasAC: z.boolean().optional(),
  status: z.enum(['available', 'occupied', 'maintenance', 'reserved']).optional(),
});
export const updateRoomSchema = createRoomSchema.partial();

// ═══ RoomBooking ═════════════════════════════════════════
export const createRoomBookingSchema = z.object({
  roomId: z.string().min(1),
  bookedBy: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  purpose: z.string().min(1),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
});
export const updateRoomBookingSchema = createRoomBookingSchema.partial();

// ═══ Vehicle ═════════════════════════════════════════════
export const createVehicleSchema = z.object({
  vehicleNumber: z.string().min(1),
  type: z.enum(['bus', 'van', 'car', 'ambulance', 'utility']),
  make: z.string().optional(),
  vehicleModel: z.string().optional(),
  capacity: z.number().int().optional(),
  fuelType: z.enum(['diesel', 'petrol', 'electric', 'cng']).optional(),
  driverId: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  fitnessExpiry: z.string().optional(),
  status: z.enum(['active', 'maintenance', 'retired']).optional(),
});
export const updateVehicleSchema = createVehicleSchema.partial();

// ═══ GatePass ════════════════════════════════════════════
export const createGatePassSchema = z.object({
  personId: z.string().min(1),
  personType: z.enum(['student', 'faculty', 'staff']),
  type: z.enum(['half_day', 'full_day', 'emergency', 'night_out']),
  reason: z.string().min(1),
  outTime: z.string().optional(),
  expectedInTime: z.string().optional(),
  actualInTime: z.string().optional(),
  approvedBy: z.string().optional(),
  status: z.enum(['requested', 'approved', 'rejected', 'active', 'returned']).optional(),
});
export const updateGatePassSchema = createGatePassSchema.partial();

// ═══ VisitorEntry ════════════════════════════════════════
export const createVisitorEntrySchema = z.object({
  visitorName: z.string().min(1),
  phone: z.string().min(1),
  idType: z.enum(['aadhaar', 'driving_license', 'voter_id', 'pan', 'other']).optional(),
  idNumber: z.string().optional(),
  purpose: z.string().min(1),
  whomToMeet: z.string().optional(),
  department: z.string().optional(),
  inTime: z.string().optional(),
  outTime: z.string().optional(),
  vehicleNumber: z.string().optional(),
});
export const updateVisitorEntrySchema = createVisitorEntrySchema.partial();

// ═══ SecurityIncident ════════════════════════════════════
export const createSecurityIncidentSchema = z.object({
  reportedBy: z.string().min(1),
  incidentDate: z.string().min(1),
  location: z.string().min(1),
  type: z.enum(['theft', 'vandalism', 'trespassing', 'fire', 'accident', 'other']),
  description: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  actionTaken: z.string().optional(),
  status: z.enum(['reported', 'investigating', 'resolved', 'closed']).optional(),
});
export const updateSecurityIncidentSchema = createSecurityIncidentSchema.partial();

// ═══ CCTV ════════════════════════════════════════════════
export const createCCTVSchema = z.object({
  cameraId: z.string().min(1),
  location: z.string().min(1),
  buildingId: z.string().optional(),
  ipAddress: z.string().optional(),
  type: z.enum(['indoor', 'outdoor', 'ptz', 'dome']).optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  installedDate: z.string().optional(),
});
export const updateCCTVSchema = createCCTVSchema.partial();

// ═══ EmergencyContact ════════════════════════════════════
export const createEmergencyContactSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['fire', 'police', 'ambulance', 'hospital', 'principal', 'security_head', 'warden', 'other']),
  phone: z.string().min(1),
  alternatePhone: z.string().optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});
export const updateEmergencyContactSchema = createEmergencyContactSchema.partial();

// ═══ Lab ═════════════════════════════════════════════════
export const createLabSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().min(1),
  departmentId: z.string().optional(),
  labInChargeId: z.string().optional(),
  equipment: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number().int().min(0),
    workingCount: z.number().int().min(0),
  })).optional(),
  capacity: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export const updateLabSchema = createLabSchema.partial();

// ═══ ParkingSlot ═════════════════════════════════════════
export const createParkingSlotSchema = z.object({
  zone: z.string().min(1),
  slotNumber: z.string().min(1),
  type: z.enum(['two_wheeler', 'four_wheeler', 'visitor', 'reserved']),
  allocatedTo: z.string().optional(),
  status: z.enum(['available', 'occupied', 'reserved', 'blocked']).optional(),
});
export const updateParkingSlotSchema = createParkingSlotSchema.partial();

// ═══ PowerBackup ═════════════════════════════════════════
export const createPowerBackupSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['generator', 'ups', 'solar', 'inverter']),
  capacity: z.string().optional(),
  location: z.string().optional(),
  fuelLevel: z.number().optional(),
  lastServiceDate: z.string().optional(),
  nextServiceDate: z.string().optional(),
  status: z.enum(['active', 'standby', 'maintenance', 'faulty']).optional(),
});
export const updatePowerBackupSchema = createPowerBackupSchema.partial();

// ═══ GreenInitiative ═════════════════════════════════════
export const createGreenInitiativeSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['solar', 'rainwater_harvesting', 'waste_management', 'tree_plantation', 'energy_saving', 'other']),
  description: z.string().optional(),
  startDate: z.string().optional(),
  coordinatorId: z.string().optional(),
  metrics: z.any().optional(),
  status: z.enum(['planned', 'active', 'completed']).optional(),
});
export const updateGreenInitiativeSchema = createGreenInitiativeSchema.partial();

// ═══ WaterSupply ═════════════════════════════════════════
export const createWaterSupplySchema = z.object({
  source: z.enum(['borewell', 'municipal', 'tanker', 'rainwater']),
  tankName: z.string().min(1),
  capacityLitres: z.number().min(0),
  currentLevel: z.number().min(0).optional(),
  location: z.string().optional(),
  lastCleaningDate: z.string().optional(),
  nextCleaningDate: z.string().optional(),
});
export const updateWaterSupplySchema = createWaterSupplySchema.partial();

// ═══════════════════════════════════════════════════════════
// FACILITIES SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// ═══ Asset ═══════════════════════════════════════════════
export const createAssetSchema = z.object({
  assetId: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['furniture', 'electronics', 'it_equipment', 'lab_equipment', 'vehicle', 'sports', 'other']),
  departmentId: z.string().optional(),
  location: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.number().min(0).optional(),
  currentValue: z.number().min(0).optional(),
  vendor: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  status: z.enum(['in_use', 'in_stock', 'maintenance', 'disposed', 'lost']).optional(),
});
export const updateAssetSchema = createAssetSchema.partial();

// ═══ AssetAllocation ═════════════════════════════════════
export const createAssetAllocationSchema = z.object({
  assetId: z.string().min(1),
  allocatedTo: z.string().min(1),
  allocatedDate: z.string().min(1),
  returnDate: z.string().optional(),
  condition: z.enum(['good', 'fair', 'poor', 'damaged']).optional(),
  status: z.enum(['allocated', 'returned', 'lost']).optional(),
});
export const updateAssetAllocationSchema = createAssetAllocationSchema.partial();

// ═══ MaintenanceRequest ══════════════════════════════════
export const createMaintenanceRequestSchema = z.object({
  requestedBy: z.string().min(1),
  category: z.enum(['electrical', 'plumbing', 'carpentry', 'it', 'civil', 'cleaning', 'other']),
  location: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
  assignedTo: z.string().optional(),
  status: z.enum(['open', 'assigned', 'in_progress', 'completed', 'rejected']).optional(),
  completedAt: z.string().optional(),
  cost: z.number().min(0).optional(),
});
export const updateMaintenanceRequestSchema = createMaintenanceRequestSchema.partial();

// ═══ MaintenanceSchedule ═════════════════════════════════
export const createMaintenanceScheduleSchema = z.object({
  assetId: z.string().optional(),
  facilityName: z.string().min(1),
  type: z.enum(['preventive', 'corrective', 'predictive']),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  lastDoneDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  assignedTeam: z.string().optional(),
  status: z.enum(['scheduled', 'overdue', 'completed']).optional(),
});
export const updateMaintenanceScheduleSchema = createMaintenanceScheduleSchema.partial();

// ═══ ConstructionProject ═════════════════════════════════
export const createConstructionProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  contractorName: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
  actualCost: z.number().min(0).optional(),
  startDate: z.string().optional(),
  expectedCompletion: z.string().optional(),
  actualCompletion: z.string().optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'on_hold', 'cancelled']).optional(),
});
export const updateConstructionProjectSchema = createConstructionProjectSchema.partial();

// ═══ Vendor ══════════════════════════════════════════════
export const createVendorSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  bankDetails: z.any().optional(),
  rating: z.number().min(0).max(5).optional(),
  isActive: z.boolean().optional(),
});
export const updateVendorSchema = createVendorSchema.partial();

// ═══ PurchaseOrder ═══════════════════════════════════════
export const createPurchaseOrderSchema = z.object({
  poNumber: z.string().min(1),
  vendorId: z.string().min(1),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0),
    totalPrice: z.number().min(0),
  })).optional(),
  totalAmount: z.number().min(0),
  requestedBy: z.string().min(1),
  approvedBy: z.string().optional(),
  orderDate: z.string().optional(),
  expectedDelivery: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'ordered', 'delivered', 'cancelled']).optional(),
});
export const updatePurchaseOrderSchema = createPurchaseOrderSchema.partial();

// ═══ StockItem ═══════════════════════════════════════════
export const createStockItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  unit: z.string().optional(),
  currentStock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  location: z.string().optional(),
  lastRestockedDate: z.string().optional(),
});
export const updateStockItemSchema = createStockItemSchema.partial();

// ═══ StockTransaction ════════════════════════════════════
export const createStockTransactionSchema = z.object({
  stockItemId: z.string().min(1),
  type: z.enum(['in', 'out', 'adjustment', 'return']),
  quantity: z.number().int().min(1),
  doneBy: z.string().min(1),
  reference: z.string().optional(),
  remarks: z.string().optional(),
});
export const updateStockTransactionSchema = createStockTransactionSchema.partial();

// ═══ ITAsset ═════════════════════════════════════════════
export const createITAssetSchema = z.object({
  serialNumber: z.string().min(1),
  type: z.enum(['desktop', 'laptop', 'printer', 'projector', 'server', 'switch', 'router', 'ups', 'other']),
  make: z.string().optional(),
  assetModel: z.string().optional(),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  location: z.string().optional(),
  assignedTo: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  status: z.enum(['active', 'maintenance', 'disposed', 'lost']).optional(),
});
export const updateITAssetSchema = createITAssetSchema.partial();

// ═══ NetworkInfra ════════════════════════════════════════
export const createNetworkInfraSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['wifi_ap', 'switch', 'router', 'firewall', 'server', 'fiber_link']),
  location: z.string().optional(),
  bandwidth: z.string().optional(),
  ipRange: z.string().optional(),
  ssid: z.string().optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
});
export const updateNetworkInfraSchema = createNetworkInfraSchema.partial();

// ═══ Insurance ═══════════════════════════════════════════
export const createInsuranceSchema = z.object({
  policyNumber: z.string().min(1),
  provider: z.string().min(1),
  type: z.enum(['property', 'vehicle', 'equipment', 'liability', 'fire', 'student_group']),
  coverageAmount: z.number().min(0),
  premium: z.number().min(0),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  coveredAssets: z.any().optional(),
  status: z.enum(['active', 'expired', 'claimed', 'cancelled']).optional(),
});
export const updateInsuranceSchema = createInsuranceSchema.partial();

// ═══ EnergyConsumption ═══════════════════════════════════
export const createEnergyConsumptionSchema = z.object({
  buildingId: z.string().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  electricityUnits: z.number().min(0).optional(),
  electricityCost: z.number().min(0).optional(),
  waterUnits: z.number().min(0).optional(),
  waterCost: z.number().min(0).optional(),
  solarGenerated: z.number().min(0).optional(),
});
export const updateEnergyConsumptionSchema = createEnergyConsumptionSchema.partial();

// ═══ WasteManagement ═════════════════════════════════════
export const createWasteManagementSchema = z.object({
  date: z.string().min(1),
  wasteType: z.enum(['dry', 'wet', 'e_waste', 'hazardous', 'biomedical']),
  quantityKg: z.number().min(0),
  disposalMethod: z.enum(['recycle', 'compost', 'incinerate', 'landfill', 'vendor_pickup']),
  handledBy: z.string().optional(),
  vendorName: z.string().optional(),
  cost: z.number().min(0).optional(),
});
export const updateWasteManagementSchema = createWasteManagementSchema.partial();

// ═══════════════════════════════════════════════════════════
// LIBRARY SUB-DOMAIN
// ═══════════════════════════════════════════════════════════

// ═══ Book ════════════════════════════════════════════════
export const createBookSchema = z.object({
  isbn: z.string().optional(),
  title: z.string().min(1),
  author: z.string().min(1),
  publisher: z.string().optional(),
  edition: z.string().optional(),
  year: z.number().int().optional(),
  category: z.enum(['textbook', 'reference', 'journal', 'magazine', 'thesis', 'general', 'digital']).optional(),
  departmentId: z.string().optional(),
  totalCopies: z.number().int().min(0).optional(),
  availableCopies: z.number().int().min(0).optional(),
  location: z.string().optional(),
});
export const updateBookSchema = createBookSchema.partial();

// ═══ BookIssue ═══════════════════════════════════════════
export const createBookIssueSchema = z.object({
  bookId: z.string().min(1),
  issuedTo: z.string().min(1),
  issuedDate: z.string().optional(),
  dueDate: z.string().min(1),
  returnedDate: z.string().optional(),
  renewCount: z.number().int().min(0).optional(),
  fineAmount: z.number().min(0).optional(),
  status: z.enum(['issued', 'returned', 'overdue', 'lost']).optional(),
});
export const updateBookIssueSchema = createBookIssueSchema.partial();

// ═══ BookReservation ═════════════════════════════════════
export const createBookReservationSchema = z.object({
  bookId: z.string().min(1),
  reservedBy: z.string().min(1),
  reservedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  status: z.enum(['active', 'fulfilled', 'expired', 'cancelled']).optional(),
});
export const updateBookReservationSchema = createBookReservationSchema.partial();

// ═══ LibraryMember ═══════════════════════════════════════
export const createLibraryMemberSchema = z.object({
  personId: z.string().min(1),
  memberType: z.enum(['student', 'faculty', 'staff', 'research_scholar']),
  membershipId: z.string().min(1),
  maxBooks: z.number().int().optional(),
  currentIssued: z.number().int().min(0).optional(),
  finesDue: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});
export const updateLibraryMemberSchema = createLibraryMemberSchema.partial();

// ═══ LibraryFine ═════════════════════════════════════════
export const createLibraryFineSchema = z.object({
  memberId: z.string().min(1),
  bookIssueId: z.string().min(1),
  amount: z.number().min(0),
  reason: z.enum(['overdue', 'lost', 'damaged']),
  paidAmount: z.number().min(0).optional(),
  status: z.enum(['pending', 'paid', 'waived']).optional(),
});
export const updateLibraryFineSchema = createLibraryFineSchema.partial();

// ═══ LibraryGateEntry ════════════════════════════════════
export const createLibraryGateEntrySchema = z.object({
  personId: z.string().min(1),
  entryTime: z.string().optional(),
  exitTime: z.string().optional(),
});
export const updateLibraryGateEntrySchema = createLibraryGateEntrySchema.partial();

// ═══ EResource ═══════════════════════════════════════════
export const createEResourceSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['e_journal', 'e_book', 'database', 'video_lecture', 'nptel', 'mooc']),
  provider: z.string().optional(),
  url: z.string().optional(),
  accessType: z.enum(['open', 'subscribed', 'institutional']).optional(),
  subscriptionStart: z.string().optional(),
  subscriptionEnd: z.string().optional(),
  isActive: z.boolean().optional(),
});
export const updateEResourceSchema = createEResourceSchema.partial();

// ═══ EResourceAccess ═════════════════════════════════════
export const createEResourceAccessSchema = z.object({
  eResourceId: z.string().min(1),
  personId: z.string().min(1),
  accessDate: z.string().optional(),
  duration: z.number().min(0).optional(),
});
export const updateEResourceAccessSchema = createEResourceAccessSchema.partial();

// ═══ PeriodicalSubscription ══════════════════════════════
export const createPeriodicalSubscriptionSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['journal', 'magazine', 'newspaper']),
  publisher: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually']).optional(),
  issn: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  cost: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});
export const updatePeriodicalSubscriptionSchema = createPeriodicalSubscriptionSchema.partial();

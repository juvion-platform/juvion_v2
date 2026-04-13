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

// ═══════════════════════════════════════════════════════════
// HOSTEL WORKFLOW SCHEMAS
// ═══════════════════════════════════════════════════════════

// ═══ Hostel Workflow Schemas ═══
export const allocateHostelBulkSchema = z.object({
  body: z.object({
    studentIds: z.array(z.string()).min(1),
    academicYearId: z.string(),
  }),
});

export const allocateHostelSingleSchema = z.object({
  body: z.object({
    studentId: z.string(),
    academicYearId: z.string(),
    preferences: z.object({
      blockPreference: z.string().optional(),
      floorPreference: z.number().optional(),
      roomTypePreference: z.string().optional(),
      roommatePreference: z.string().optional(),
    }).optional(),
  }),
});

export const submitRoomChangeRequestSchema = z.object({
  body: z.object({
    studentId: z.string(),
    currentRoomId: z.string(),
    reason: z.string(),
    reasonCategory: z.enum(['roommate_conflict', 'medical', 'preference', 'other']),
    requestedRoomId: z.string().optional(),
    preferredBlockId: z.string().optional(),
  }),
});

export const approveRoomChangeSchema = z.object({
  body: z.object({
    newRoomId: z.string(),
    newBedId: z.string(),
  }),
});

export const verifyHostelClearanceSchema = z.object({
  body: z.object({
    roomVacated: z.boolean().optional(),
    keysReturned: z.boolean().optional(),
    damageAssessment: z.string().optional(),
    damageAmount: z.number().optional(),
    duesCleared: z.boolean().optional(),
  }),
});

export const recordHostelAttendanceBulkSchema = z.object({
  body: z.object({
    date: z.string(),
    records: z.array(z.object({
      studentId: z.string(),
      status: z.enum(['present', 'absent', 'on_leave']),
    })).min(1),
  }),
});

export const submitHostelLeaveSchema = z.object({
  body: z.object({
    studentId: z.string(),
    leaveType: z.enum(['home', 'medical', 'emergency']),
    startDate: z.string(),
    endDate: z.string(),
    destination: z.string(),
    guardianContact: z.string(),
    reason: z.string().optional(),
  }),
});

export const rejectHostelLeaveSchema = z.object({
  body: z.object({ reason: z.string() }),
});

export const reportViolationSchema = z.object({
  body: z.object({
    studentId: z.string(),
    violationType: z.string(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    evidence: z.array(z.string()).optional(),
  }),
});

export const scheduleHearingSchema = z.object({
  body: z.object({ hearingDate: z.string() }),
});

export const assignPenaltySchema = z.object({
  body: z.object({
    penaltyType: z.enum(['warning', 'fine', 'suspension', 'expulsion']),
    fineAmount: z.number().optional(),
    effectiveDate: z.string(),
    expiryDate: z.string().optional(),
  }),
});

export const fileAppealSchema = z.object({
  body: z.object({
    penaltyId: z.string(),
    studentId: z.string(),
    grounds: z.string(),
  }),
});

export const resolveAppealSchema = z.object({
  body: z.object({
    outcome: z.enum(['upheld', 'modified', 'overturned']),
    outcomeRemarks: z.string(),
  }),
});

export const escalateWardenConcernSchema = z.object({
  body: z.object({
    studentId: z.string(),
    concernType: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    evidence: z.array(z.string()).optional(),
  }),
});

// ═══════════════════════════════════════════════════════════
// LIBRARY WORKFLOW SCHEMAS
// ═══════════════════════════════════════════════════════════

// ═══ Library Workflow Schemas ═══
export const issueBookSchema = z.object({
  body: z.object({
    bookId: z.string(),
    memberId: z.string(),
  }),
});

export const returnBookSchema = z.object({
  body: z.object({
    bookIssueId: z.string(),
    condition: z.string().optional(),
  }),
});

export const renewBookSchema = z.object({
  body: z.object({ bookIssueId: z.string() }),
});

export const reportBookLostSchema = z.object({
  body: z.object({ bookIssueId: z.string() }),
});

export const reserveBookSchema = z.object({
  body: z.object({
    bookId: z.string(),
    memberId: z.string(),
  }),
});

export const initiateLibraryClearanceSchema = z.object({
  body: z.object({
    personType: z.enum(['student', 'staff', 'faculty']),
  }),
});

export const recordLibraryEntrySchema = z.object({
  body: z.object({ personId: z.string() }),
});

// ═══════════════════════════════════════════════════════════
// MESS WORKFLOW SCHEMAS
// ═══════════════════════════════════════════════════════════

// ═══ Mess Workflow Schemas ═══
export const recordMealTransactionSchema = z.object({
  body: z.object({
    studentId: z.string(),
    messFacilityId: z.string(),
    mealType: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']),
  }),
});

export const addCouponCreditSchema = z.object({
  body: z.object({
    studentId: z.string(),
    messFacilityId: z.string(),
    amount: z.number().positive(),
  }),
});

export const qualityInspectionWorkflowSchema = z.object({
  body: z.object({
    messFacilityId: z.string(),
    hygieneScore: z.number().min(0).max(10),
    foodQualityScore: z.number().min(0).max(10),
    complianceStatus: z.enum(['compliant', 'minor_issues', 'major_issues', 'non_compliant']),
    issues: z.array(z.object({ area: z.string(), description: z.string(), severity: z.string() })).optional(),
    vendorContractId: z.string().optional(),
    remarks: z.string().optional(),
  }),
});

export const terminateContractSchema = z.object({
  body: z.object({ reason: z.string() }),
});

// ═══════════════════════════════════════════════════════════
// TRANSPORT WORKFLOW SCHEMAS
// ═══════════════════════════════════════════════════════════

// ═══ Transport Workflow Schemas ═══
export const allocateTransportBulkSchema = z.object({
  body: z.object({
    students: z.array(z.object({
      studentId: z.string(),
      address: z.string().optional(),
    })).min(1),
    academicYearId: z.string(),
  }),
});

export const allocateTransportSingleSchema = z.object({
  body: z.object({
    studentId: z.string(),
    routeId: z.string(),
    stopId: z.string(),
    academicYearId: z.string(),
  }),
});

export const recordTransportAttendanceSchema = z.object({
  body: z.object({
    tripLogId: z.string(),
    records: z.array(z.object({
      studentId: z.string(),
      stopId: z.string().optional(),
    })).min(1),
  }),
});

export const adjustRouteSchema = z.object({
  body: z.object({
    action: z.string(),
    details: z.any(),
  }),
});

// ═══════════════════════════════════════════════════════════
// LABS WORKFLOW SCHEMAS
// ═══════════════════════════════════════════════════════════

// ═══ Labs Workflow Schemas ═══
export const registerLabEquipmentSchema = z.object({
  body: z.object({
    labId: z.string(),
    name: z.string(),
    serialNumber: z.string(),
    manufacturer: z.string().optional(),
    purchaseDate: z.string().optional(),
    purchaseCost: z.number().optional(),
    condition: z.enum(['new', 'good', 'fair', 'poor']).optional(),
    nextCalibration: z.string().optional(),
  }),
});

export const updateEquipmentStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'maintenance', 'calibration_due', 'condemned']),
    reason: z.string().optional(),
  }),
});

export const recordEquipmentMaintenanceSchema = z.object({
  body: z.object({
    equipmentId: z.string(),
    serviceType: z.enum(['preventive', 'corrective', 'calibration', 'repair']),
    performedByName: z.string(),
    description: z.string().optional(),
    cost: z.number().optional(),
    nextServiceDue: z.string().optional(),
  }),
});

export const requestLabSlotBookingSchema = z.object({
  body: z.object({
    labId: z.string(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    purpose: z.string(),
    attendeeCount: z.number().optional(),
  }),
});

export const issueEquipmentSchema = z.object({
  body: z.object({
    equipmentId: z.string(),
    issuedTo: z.string(),
    dueDate: z.string(),
    conditionOnIssue: z.string().optional(),
  }),
});

export const returnEquipmentSchema = z.object({
  body: z.object({ conditionOnReturn: z.string() }),
});

export const reportLabIncidentSchema = z.object({
  body: z.object({
    labId: z.string(),
    incidentDate: z.string(),
    type: z.enum(['safety', 'damage', 'chemical_spill', 'fire', 'injury', 'other']),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    equipmentDamaged: z.array(z.string()).optional(),
  }),
});

export const resolveLabIncidentSchema = z.object({
  body: z.object({ resolution: z.string() }),
});

// ═══════════════════════════════════════════════════════════
// FACILITIES WORKFLOW SCHEMAS
// ═══════════════════════════════════════════════════════════

// ═══ Facilities Workflow Schemas ═══
export const requestFacilityBookingSchema = z.object({
  body: z.object({
    roomId: z.string(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    purpose: z.string(),
    requesterModule: z.string().optional(),
    attendeeCount: z.number().optional(),
  }),
});

export const rejectBookingSchema = z.object({
  body: z.object({ reason: z.string() }),
});

export const recordFacilityUsageSchema = z.object({
  body: z.object({
    bookingId: z.string(),
    actualStartTime: z.string(),
    actualEndTime: z.string(),
    attendeeCount: z.number(),
    usageNotes: z.string().optional(),
  }),
});

export const reportCampusIncidentSchema = z.object({
  body: z.object({
    incidentDate: z.string(),
    type: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    personsInvolved: z.array(z.object({ personId: z.string(), personType: z.string(), role: z.string() })).optional(),
    visitorEntryId: z.string().optional(),
  }),
});

export const resolveCampusIncidentSchema = z.object({
  body: z.object({ resolution: z.string() }),
});

// ═══════════════════════════════════════════════════════════
// MAINTENANCE WORKFLOW SCHEMAS
// ═══════════════════════════════════════════════════════════

// ═══ Maintenance Workflow Schemas ═══
export const submitMaintenanceRequestSchema = z.object({
  body: z.object({
    facilityType: z.enum(['hostel', 'classroom', 'lab', 'transport', 'common_area', 'office', 'other']),
    facilityId: z.string().optional(),
    equipmentId: z.string().optional(),
    description: z.string(),
    category: z.string(),
    location: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
});

export const triageMaintenanceRequestSchema = z.object({
  body: z.object({
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    assignmentRouting: z.enum(['in_house', 'amc_vendor', 'external']),
    slaDeadlineHours: z.number().positive(),
  }),
});

export const createMaintenanceAssignmentSchema_wf = z.object({
  body: z.object({
    requestId: z.string(),
    assignedToType: z.enum(['in_house', 'amc_vendor', 'external']),
    assignedToId: z.string(),
    assignedToName: z.string(),
    slaDeadline: z.string().optional(),
  }),
});

export const addMaintenanceWorkLogSchema = z.object({
  body: z.object({
    assignmentId: z.string(),
    workDate: z.string(),
    hoursSpent: z.number().positive(),
    description: z.string(),
    materialsUsed: z.array(z.object({ name: z.string(), quantity: z.number(), cost: z.number() })).optional(),
    cost: z.number().optional(),
  }),
});

export const verifyMaintenanceWorkSchema = z.object({
  body: z.object({
    verificationStatus: z.enum(['passed', 'failed']),
  }),
});

export const triggerPreventiveMaintenanceSchema = z.object({
  body: z.object({
    scheduleId: z.string().optional(),
    equipmentId: z.string().optional(),
    aiTriggered: z.boolean().optional(),
    aiConfidence: z.number().optional(),
  }),
});

export const createMaintenanceEscalationSchema_wf = z.object({
  body: z.object({
    requestId: z.string(),
    assignmentId: z.string().optional(),
    reason: z.string(),
    triggerType: z.enum(['sla_warning', 'sla_breach', 'manual']),
  }),
});

export const calculateVendorPerformanceSchema = z.object({
  body: z.object({
    vendorId: z.string(),
    period: z.string(),
  }),
});

export const provisionInfrastructureSchema = z.object({
  body: z.object({
    studentId: z.string(),
    isHosteler: z.boolean(),
    usesTransport: z.boolean(),
    preferences: z.any().optional(),
  }),
});

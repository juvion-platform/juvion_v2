// @ts-nocheck
import mongoose from 'mongoose';
import { connectDB } from './config/db';
import {
  // People
  Person, Student, Faculty, Staff, Parent,
  // Academic Structure
  AcademicYear, Regulation, Department, Programme, Branch, Batch, Section, Semester,
  // Academic Ops
  Course, CourseOffering, CurriculumMap,
  // Finance
  FeeStructure, FeeLineItem, StudentFeeAccount, Invoice, Payment, Budget, Expense,
  Scholarship, ScholarshipAllocation, Concession,
  // HR
  Employee, LeaveType, LeaveBalance, LeaveApplication, PayStructure, Payroll,
  Training, Recruitment, Appraisal, Qualification, Publication, ResearchProject,
  // Placement
  Company, PlacementSeason, JobPosting, InternshipPosting, PlacementTraining,
  PlacementRegistration, PlacementRound, InternshipApplication, TrainingAttendance,
  MockInterview, HigherStudiesApplication, EntrepreneurProfile, AlumniProfile, AlumniEvent,
  RoundResult, PlacementOffer, PlacementReport,
  // Welfare
  HostelBlock, HostelRoom, HostelAllocation, HostelVisitorLog,
  TransportRoute, TransportAllocation,
  MessMenu, MessFeedback,
  HealthRecord, MedicalVisit, CounselingSession,
  AntiRaggingComplaint, StudentGrievance, CrisisAlert,
  InsuranceClaim, ParentMeeting,
  // Campus
  Building, Room, RoomBooking, EmergencyContact,
  GatePass, SecurityIncident, Vehicle, VisitorEntry,
  Lab, CCTV, ParkingSlot, PowerBackup, GreenInitiative, WaterSupply,
  // Facilities
  Vendor, Asset, AssetAllocation, MaintenanceRequest, MaintenanceSchedule,
  PurchaseOrder, StockItem, StockTransaction,
  ITAsset, NetworkInfra, Insurance, EnergyConsumption, WasteManagement, ConstructionProject,
  // Library
  Book, BookIssue, BookReservation, LibraryMember, LibraryFine,
  LibraryGateEntry, EResource, EResourceAccess, PeriodicalSubscription,
  // Student Dev
  Club, ClubMembership, Event, EventRegistration, Achievement,
  SportsTeam, SportsTeamMember, NSSActivity, NSSParticipant,
  Mentoring, SkillCertification, LeadershipRole,
  StudentProject, CommunityProject,
  // Governance
  Committee, CommitteeMeeting, GoverningBodyMember, Policy, StrategicGoal,
  // Compliance
  AccreditationBody, AccreditationCycle, ComplianceCriteria, RegulatoryFiling,
  AICTEApproval, AffiliationStatus, AuditFinding, IQACReport,
  // Communication
  Announcement, Circular, Notification, FeedbackSurvey, SurveyResponse,
  // Admissions
  Applicant, AdmissionOffer, Admission,
  // Juvi
  JuviPersonaConfig, JuviKnowledgeBase, JuviConversation,
  JuviMessage, JuviAction, JuviInsight, JuviFeedback, JuviUsageMetric,
} from './models';
import { User } from './models/User';
import { College } from './models/College';
import { Policy as RBACPolicy } from './models/platform/Policy';
import { DEFAULT_POLICIES } from './shared/rbac/defaults';
import bcrypt from 'bcryptjs';

const CID = new mongoose.Types.ObjectId('000000000000000000000001');

async function seed() {
  await connectDB();
  console.log('Seeding database...');

  // ========================================================================
  // CLEAR existing data
  // ========================================================================
  await Promise.all([
    College.deleteMany({}),
    User.deleteMany({ role: 'super_admin' }),
    User.deleteMany({ collegeId: CID }),
    Person.deleteMany({ collegeId: CID }),
    Student.deleteMany({ collegeId: CID }),
    Faculty.deleteMany({ collegeId: CID }),
    Staff.deleteMany({ collegeId: CID }),
    Parent.deleteMany({ collegeId: CID }),
    AcademicYear.deleteMany({ collegeId: CID }),
    Regulation.deleteMany({ collegeId: CID }),
    Department.deleteMany({ collegeId: CID }),
    Programme.deleteMany({ collegeId: CID }),
    Branch.deleteMany({ collegeId: CID }),
    Batch.deleteMany({ collegeId: CID }),
    Section.deleteMany({ collegeId: CID }),
    Semester.deleteMany({ collegeId: CID }),
    Course.deleteMany({ collegeId: CID }),
    CourseOffering.deleteMany({ collegeId: CID }),
    CurriculumMap.deleteMany({ collegeId: CID }),
    FeeStructure.deleteMany({ collegeId: CID }),
    FeeLineItem.deleteMany({ collegeId: CID }),
    StudentFeeAccount.deleteMany({ collegeId: CID }),
    Invoice.deleteMany({ collegeId: CID }),
    Payment.deleteMany({ collegeId: CID }),
    Budget.deleteMany({ collegeId: CID }),
    Expense.deleteMany({ collegeId: CID }),
    Scholarship.deleteMany({ collegeId: CID }),
    ScholarshipAllocation.deleteMany({ collegeId: CID }),
    Concession.deleteMany({ collegeId: CID }),
    Employee.deleteMany({ collegeId: CID }),
    LeaveType.deleteMany({ collegeId: CID }),
    LeaveBalance.deleteMany({ collegeId: CID }),
    LeaveApplication.deleteMany({ collegeId: CID }),
    PayStructure.deleteMany({ collegeId: CID }),
    Payroll.deleteMany({ collegeId: CID }),
    Training.deleteMany({ collegeId: CID }),
    Recruitment.deleteMany({ collegeId: CID }),
    Appraisal.deleteMany({ collegeId: CID }),
    Qualification.deleteMany({ collegeId: CID }),
    Publication.deleteMany({ collegeId: CID }),
    ResearchProject.deleteMany({ collegeId: CID }),
    Company.deleteMany({ collegeId: CID }),
    PlacementSeason.deleteMany({ collegeId: CID }),
    JobPosting.deleteMany({ collegeId: CID }),
    InternshipPosting.deleteMany({ collegeId: CID }),
    PlacementTraining.deleteMany({ collegeId: CID }),
    PlacementRegistration.deleteMany({ collegeId: CID }),
    PlacementRound.deleteMany({ collegeId: CID }),
    InternshipApplication.deleteMany({ collegeId: CID }),
    TrainingAttendance.deleteMany({ collegeId: CID }),
    MockInterview.deleteMany({ collegeId: CID }),
    HigherStudiesApplication.deleteMany({ collegeId: CID }),
    EntrepreneurProfile.deleteMany({ collegeId: CID }),
    AlumniProfile.deleteMany({ collegeId: CID }),
    AlumniEvent.deleteMany({ collegeId: CID }),
    RoundResult.deleteMany({ collegeId: CID }),
    PlacementOffer.deleteMany({ collegeId: CID }),
    PlacementReport.deleteMany({ collegeId: CID }),
    HostelBlock.deleteMany({ collegeId: CID }),
    HostelRoom.deleteMany({ collegeId: CID }),
    HostelAllocation.deleteMany({ collegeId: CID }),
    HostelVisitorLog.deleteMany({ collegeId: CID }),
    TransportRoute.deleteMany({ collegeId: CID }),
    TransportAllocation.deleteMany({ collegeId: CID }),
    MessMenu.deleteMany({ collegeId: CID }),
    MessFeedback.deleteMany({ collegeId: CID }),
    HealthRecord.deleteMany({ collegeId: CID }),
    MedicalVisit.deleteMany({ collegeId: CID }),
    CounselingSession.deleteMany({ collegeId: CID }),
    AntiRaggingComplaint.deleteMany({ collegeId: CID }),
    StudentGrievance.deleteMany({ collegeId: CID }),
    CrisisAlert.deleteMany({ collegeId: CID }),
    InsuranceClaim.deleteMany({ collegeId: CID }),
    ParentMeeting.deleteMany({ collegeId: CID }),
    Building.deleteMany({ collegeId: CID }),
    Room.deleteMany({ collegeId: CID }),
    RoomBooking.deleteMany({ collegeId: CID }),
    EmergencyContact.deleteMany({ collegeId: CID }),
    GatePass.deleteMany({ collegeId: CID }),
    SecurityIncident.deleteMany({ collegeId: CID }),
    Vehicle.deleteMany({ collegeId: CID }),
    VisitorEntry.deleteMany({ collegeId: CID }),
    Lab.deleteMany({ collegeId: CID }),
    CCTV.deleteMany({ collegeId: CID }),
    ParkingSlot.deleteMany({ collegeId: CID }),
    PowerBackup.deleteMany({ collegeId: CID }),
    GreenInitiative.deleteMany({ collegeId: CID }),
    WaterSupply.deleteMany({ collegeId: CID }),
    Vendor.deleteMany({ collegeId: CID }),
    Asset.deleteMany({ collegeId: CID }),
    AssetAllocation.deleteMany({ collegeId: CID }),
    MaintenanceRequest.deleteMany({ collegeId: CID }),
    MaintenanceSchedule.deleteMany({ collegeId: CID }),
    PurchaseOrder.deleteMany({ collegeId: CID }),
    StockItem.deleteMany({ collegeId: CID }),
    StockTransaction.deleteMany({ collegeId: CID }),
    ITAsset.deleteMany({ collegeId: CID }),
    NetworkInfra.deleteMany({ collegeId: CID }),
    Insurance.deleteMany({ collegeId: CID }),
    EnergyConsumption.deleteMany({ collegeId: CID }),
    WasteManagement.deleteMany({ collegeId: CID }),
    ConstructionProject.deleteMany({ collegeId: CID }),
    Book.deleteMany({ collegeId: CID }),
    BookIssue.deleteMany({ collegeId: CID }),
    BookReservation.deleteMany({ collegeId: CID }),
    LibraryMember.deleteMany({ collegeId: CID }),
    LibraryFine.deleteMany({ collegeId: CID }),
    LibraryGateEntry.deleteMany({ collegeId: CID }),
    EResource.deleteMany({ collegeId: CID }),
    EResourceAccess.deleteMany({ collegeId: CID }),
    PeriodicalSubscription.deleteMany({ collegeId: CID }),
    Club.deleteMany({ collegeId: CID }),
    ClubMembership.deleteMany({ collegeId: CID }),
    Event.deleteMany({ collegeId: CID }),
    EventRegistration.deleteMany({ collegeId: CID }),
    Achievement.deleteMany({ collegeId: CID }),
    SportsTeam.deleteMany({ collegeId: CID }),
    SportsTeamMember.deleteMany({ collegeId: CID }),
    NSSActivity.deleteMany({ collegeId: CID }),
    NSSParticipant.deleteMany({ collegeId: CID }),
    Mentoring.deleteMany({ collegeId: CID }),
    SkillCertification.deleteMany({ collegeId: CID }),
    LeadershipRole.deleteMany({ collegeId: CID }),
    StudentProject.deleteMany({ collegeId: CID }),
    CommunityProject.deleteMany({ collegeId: CID }),
    Committee.deleteMany({ collegeId: CID }),
    CommitteeMeeting.deleteMany({ collegeId: CID }),
    GoverningBodyMember.deleteMany({ collegeId: CID }),
    Policy.deleteMany({ collegeId: CID }),
    StrategicGoal.deleteMany({ collegeId: CID }),
    AccreditationBody.deleteMany({ collegeId: CID }),
    AccreditationCycle.deleteMany({ collegeId: CID }),
    ComplianceCriteria.deleteMany({ collegeId: CID }),
    RegulatoryFiling.deleteMany({ collegeId: CID }),
    AICTEApproval.deleteMany({ collegeId: CID }),
    AffiliationStatus.deleteMany({ collegeId: CID }),
    AuditFinding.deleteMany({ collegeId: CID }),
    IQACReport.deleteMany({ collegeId: CID }),
    Announcement.deleteMany({ collegeId: CID }),
    Circular.deleteMany({ collegeId: CID }),
    Notification.deleteMany({ collegeId: CID }),
    FeedbackSurvey.deleteMany({ collegeId: CID }),
    SurveyResponse.deleteMany({ collegeId: CID }),
    Applicant.deleteMany({ collegeId: CID }),
    AdmissionOffer.deleteMany({ collegeId: CID }),
    Admission.deleteMany({ collegeId: CID }),
    JuviPersonaConfig.deleteMany({ collegeId: CID }),
    JuviKnowledgeBase.deleteMany({ collegeId: CID }),
    JuviConversation.deleteMany({ collegeId: CID }),
    JuviMessage.deleteMany({ collegeId: CID }),
    JuviAction.deleteMany({ collegeId: CID }),
    JuviInsight.deleteMany({ collegeId: CID }),
    JuviFeedback.deleteMany({ collegeId: CID }),
    JuviUsageMetric.deleteMany({ collegeId: CID }),
  ]);
  console.log('Cleared existing data');

  // ========================================================================
  // TIER 0 - Colleges + Users
  // ========================================================================
  const adminPwd = await bcrypt.hash('admin123', 10);

  // Create sample colleges
  const [jit, gnit, mits] = await College.create([
    {
      _id: CID,
      name: 'Juvion Institute of Technology',
      code: 'JIT',
      address: { line1: 'Kukatpally Housing Board', city: 'Hyderabad', state: 'Telangana', pincode: '500085' },
      contactEmail: 'info@jit.edu.in',
      contactPhone: '+91-40-2345-6789',
      subscription: { plan: 'premium', status: 'active', expiresAt: new Date('2027-03-31') },
      status: 'active',
    },
    {
      name: 'Guru Nanak Institute of Technology',
      code: 'GNIT',
      address: { line1: 'Ibrahimpatnam', city: 'Hyderabad', state: 'Telangana', pincode: '501506' },
      contactEmail: 'admin@gnit.edu.in',
      contactPhone: '+91-40-2987-6543',
      subscription: { plan: 'standard', status: 'active', expiresAt: new Date('2026-12-31') },
      status: 'active',
    },
    {
      name: 'Malla Reddy Institute of Technology & Science',
      code: 'MITS',
      address: { line1: 'Maisammaguda, Dhulapally', city: 'Hyderabad', state: 'Telangana', pincode: '500100' },
      contactEmail: 'info@mits.edu.in',
      contactPhone: '+91-40-2345-1234',
      subscription: { plan: 'basic', status: 'trial', expiresAt: new Date('2026-06-30') },
      status: 'active',
    },
  ]);
  console.log('Colleges created: JIT, GNIT, MITS');

  // Superadmin user (no collegeId — manages all colleges)
  await User.create({
    email: 'super@juvion.dev',
    password: adminPwd,
    name: 'Super Admin',
    role: 'super_admin',
    personaType: 'L-PRIN',
  });
  console.log('Superadmin created (super@juvion.dev / admin123)');

  // Per-college admin for JIT
  await User.create({
    collegeId: CID,
    email: 'admin@jit.edu.in',
    password: adminPwd,
    name: 'JIT Admin',
    role: 'admin',
    personaType: 'L-PRIN',
  });
  console.log('JIT college admin created (admin@jit.edu.in / admin123)');

  // ========================================================================
  // TIER 1 - Foundation (no dependencies)
  // ========================================================================

  // --- Academic Years ---
  const [ay2023, ay2024, ay2025] = await AcademicYear.create([
    { collegeId: CID, code: 'AY2023-24', label: 'Academic Year 2023-24', startDate: new Date('2023-07-01'), endDate: new Date('2024-06-30'), isCurrent: false },
    { collegeId: CID, code: 'AY2024-25', label: 'Academic Year 2024-25', startDate: new Date('2024-07-01'), endDate: new Date('2025-06-30'), isCurrent: true },
    { collegeId: CID, code: 'AY2025-26', label: 'Academic Year 2025-26', startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'), isCurrent: false },
  ]);
  console.log('Academic Years created');

  // --- Regulations ---
  const [regR22, regR18] = await Regulation.create([
    { collegeId: CID, code: 'R22', name: 'Regulation 2022', effectiveFromYear: 2022, totalCredits: 160, maxYears: 8, isActive: true },
    { collegeId: CID, code: 'R18', name: 'Regulation 2018', effectiveFromYear: 2018, effectiveToYear: 2022, totalCredits: 160, maxYears: 8, isActive: false },
  ]);
  console.log('Regulations created');

  // --- Persons (20 persons: students 0-9, faculty 10-15, staff 16-18, parents 19-23, external 24) ---
  const personData = [
    // Students (0-9)
    { name: 'Aarav Sharma', phone: '9876543210', email: 'aarav.sharma@juvion.edu', gender: 'male', dob: new Date('2004-03-15'), aadhaar: '234567890101', address: { line1: '12 Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500033' } },
    { name: 'Priya Reddy', phone: '9876543211', email: 'priya.reddy@juvion.edu', gender: 'female', dob: new Date('2004-07-22'), aadhaar: '234567890102', address: { line1: '45 Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034' } },
    { name: 'Rahul Kumar', phone: '9876543212', email: 'rahul.kumar@juvion.edu', gender: 'male', dob: new Date('2003-11-10'), aadhaar: '234567890103', address: { line1: '78 Kukatpally', city: 'Hyderabad', state: 'Telangana', pincode: '500072' } },
    { name: 'Sneha Patel', phone: '9876543213', email: 'sneha.patel@juvion.edu', gender: 'female', dob: new Date('2004-01-05'), aadhaar: '234567890104', address: { line1: '23 Gachibowli', city: 'Hyderabad', state: 'Telangana', pincode: '500032' } },
    { name: 'Karthik Rao', phone: '9876543214', email: 'karthik.rao@juvion.edu', gender: 'male', dob: new Date('2003-09-18'), aadhaar: '234567890105', address: { line1: '56 Madhapur', city: 'Hyderabad', state: 'Telangana', pincode: '500081' } },
    { name: 'Divya Nair', phone: '9876543215', email: 'divya.nair@juvion.edu', gender: 'female', dob: new Date('2004-05-30'), aadhaar: '234567890106', address: { line1: '89 Ameerpet', city: 'Hyderabad', state: 'Telangana', pincode: '500016' } },
    { name: 'Arjun Mehta', phone: '9876543216', email: 'arjun.mehta@juvion.edu', gender: 'male', dob: new Date('2003-12-25'), aadhaar: '234567890107', address: { line1: '34 Secunderabad', city: 'Hyderabad', state: 'Telangana', pincode: '500003' } },
    { name: 'Ananya Gupta', phone: '9876543217', email: 'ananya.gupta@juvion.edu', gender: 'female', dob: new Date('2004-08-14'), aadhaar: '234567890108', address: { line1: '67 Begumpet', city: 'Hyderabad', state: 'Telangana', pincode: '500016' } },
    { name: 'Vikram Singh', phone: '9876543218', email: 'vikram.singh@juvion.edu', gender: 'male', dob: new Date('2002-06-20'), aadhaar: '234567890109', address: { line1: '12 Miyapur', city: 'Hyderabad', state: 'Telangana', pincode: '500049' } },
    { name: 'Meera Joshi', phone: '9876543219', email: 'meera.joshi@juvion.edu', gender: 'female', dob: new Date('2003-04-02'), aadhaar: '234567890110', address: { line1: '45 Kondapur', city: 'Hyderabad', state: 'Telangana', pincode: '500084' } },
    // Faculty (10-15)
    { name: 'Dr. Ramesh Iyer', phone: '9876543220', email: 'ramesh.iyer@juvion.edu', gender: 'male', dob: new Date('1975-08-12'), aadhaar: '234567890111', address: { line1: '101 Film Nagar', city: 'Hyderabad', state: 'Telangana', pincode: '500008' } },
    { name: 'Dr. Sunita Deshmukh', phone: '9876543221', email: 'sunita.deshmukh@juvion.edu', gender: 'female', dob: new Date('1978-02-28'), aadhaar: '234567890112', address: { line1: '202 Tolichowki', city: 'Hyderabad', state: 'Telangana', pincode: '500008' } },
    { name: 'Dr. Venkat Rao', phone: '9876543222', email: 'venkat.rao@juvion.edu', gender: 'male', dob: new Date('1972-06-15'), aadhaar: '234567890113', address: { line1: '303 Maredpally', city: 'Hyderabad', state: 'Telangana', pincode: '500026' } },
    { name: 'Dr. Lakshmi Prasad', phone: '9876543223', email: 'lakshmi.prasad@juvion.edu', gender: 'female', dob: new Date('1980-11-05'), aadhaar: '234567890114', address: { line1: '404 SR Nagar', city: 'Hyderabad', state: 'Telangana', pincode: '500038' } },
    { name: 'Prof. Suresh Babu', phone: '9876543224', email: 'suresh.babu@juvion.edu', gender: 'male', dob: new Date('1968-04-20'), aadhaar: '234567890115', address: { line1: '505 Habsiguda', city: 'Hyderabad', state: 'Telangana', pincode: '500007' } },
    { name: 'Dr. Anjali Menon', phone: '9876543225', email: 'anjali.menon@juvion.edu', gender: 'female', dob: new Date('1982-09-10'), aadhaar: '234567890116', address: { line1: '606 Dilsukhnagar', city: 'Hyderabad', state: 'Telangana', pincode: '500060' } },
    // Staff (16-18)
    { name: 'Ravi Teja', phone: '9876543226', email: 'ravi.teja@juvion.edu', gender: 'male', dob: new Date('1985-03-25'), aadhaar: '234567890117', address: { line1: '707 LB Nagar', city: 'Hyderabad', state: 'Telangana', pincode: '500074' } },
    { name: 'Padma Latha', phone: '9876543227', email: 'padma.latha@juvion.edu', gender: 'female', dob: new Date('1988-07-18'), aadhaar: '234567890118', address: { line1: '808 Vanasthalipuram', city: 'Hyderabad', state: 'Telangana', pincode: '500070' } },
    { name: 'Mahesh Yadav', phone: '9876543228', email: 'mahesh.yadav@juvion.edu', gender: 'male', dob: new Date('1990-12-08'), aadhaar: '234567890119', address: { line1: '909 Uppal', city: 'Hyderabad', state: 'Telangana', pincode: '500039' } },
    // Parents (19-23)
    { name: 'Rajesh Sharma', phone: '9876543229', email: 'rajesh.sharma@gmail.com', gender: 'male', dob: new Date('1970-06-15'), aadhaar: '234567890120', address: { line1: '12 Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500033' } },
    { name: 'Saraswati Reddy', phone: '9876543230', email: 'saraswati.reddy@gmail.com', gender: 'female', dob: new Date('1972-10-22'), aadhaar: '234567890121', address: { line1: '45 Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034' } },
    { name: 'Sunil Kumar', phone: '9876543231', email: 'sunil.kumar@gmail.com', gender: 'male', dob: new Date('1968-01-30'), aadhaar: '234567890122', address: { line1: '78 Kukatpally', city: 'Hyderabad', state: 'Telangana', pincode: '500072' } },
    { name: 'Kavita Patel', phone: '9876543232', email: 'kavita.patel@gmail.com', gender: 'female', dob: new Date('1975-04-18'), aadhaar: '234567890123', address: { line1: '23 Gachibowli', city: 'Hyderabad', state: 'Telangana', pincode: '500032' } },
    { name: 'Narasimha Rao', phone: '9876543233', email: 'narasimha.rao@gmail.com', gender: 'male', dob: new Date('1965-11-05'), aadhaar: '234567890124', address: { line1: '56 Madhapur', city: 'Hyderabad', state: 'Telangana', pincode: '500081' } },
    // External / Principal (24)
    { name: 'Dr. Srinivas Rao', phone: '9876543234', email: 'principal@juvion.edu', gender: 'male', dob: new Date('1960-05-10'), aadhaar: '234567890125', address: { line1: 'Campus Quarters', city: 'Hyderabad', state: 'Telangana', pincode: '500032' } },
  ];
  const persons = await Person.create(personData.map(p => ({ collegeId: CID, ...p })));
  console.log('Persons created');

  // --- Emergency Contacts ---
  await EmergencyContact.create([
    { collegeId: CID, name: 'Fire Station - Gachibowli', role: 'fire', phone: '04023456789', isActive: true },
    { collegeId: CID, name: 'Apollo Hospital', role: 'hospital', phone: '04024567890', alternatePhone: '04024567891', isActive: true },
    { collegeId: CID, name: 'Gachibowli Police Station', role: 'police', phone: '04025678901', isActive: true },
    { collegeId: CID, name: 'Dr. Srinivas Rao (Principal)', role: 'principal', phone: '9876543234', email: 'principal@juvion.edu', isActive: true },
  ]);
  console.log('Emergency Contacts created');

  // --- Transport Routes ---
  const routes = await TransportRoute.create([
    { collegeId: CID, routeNumber: 'R01', name: 'Kukatpally - Juvion Campus', stops: [
      { name: 'Kukatpally Bus Stand', pickupTime: '07:30', dropTime: '17:30' },
      { name: 'KPHB Colony', pickupTime: '07:45', dropTime: '17:15' },
      { name: 'Miyapur Metro', pickupTime: '08:00', dropTime: '17:00' },
      { name: 'Juvion Campus', pickupTime: '08:30', dropTime: '16:30' },
    ], vehicleNumber: 'TS09UB1234', driverName: 'Venkatesh', driverPhone: '9876500001', capacity: 50, isActive: true },
    { collegeId: CID, routeNumber: 'R02', name: 'Dilsukhnagar - Juvion Campus', stops: [
      { name: 'Dilsukhnagar Bus Stand', pickupTime: '07:15', dropTime: '17:45' },
      { name: 'LB Nagar', pickupTime: '07:30', dropTime: '17:30' },
      { name: 'Uppal Ring Road', pickupTime: '07:50', dropTime: '17:10' },
      { name: 'Juvion Campus', pickupTime: '08:30', dropTime: '16:30' },
    ], vehicleNumber: 'TS09UB5678', driverName: 'Ramulu', driverPhone: '9876500002', capacity: 50, isActive: true },
    { collegeId: CID, routeNumber: 'R03', name: 'Secunderabad - Juvion Campus', stops: [
      { name: 'Secunderabad Station', pickupTime: '07:00', dropTime: '18:00' },
      { name: 'Begumpet', pickupTime: '07:20', dropTime: '17:40' },
      { name: 'Ameerpet', pickupTime: '07:40', dropTime: '17:20' },
      { name: 'Juvion Campus', pickupTime: '08:30', dropTime: '16:30' },
    ], vehicleNumber: 'TS09UB9012', driverName: 'Nagaraju', driverPhone: '9876500003', capacity: 45, isActive: true },
  ]);
  console.log('Transport Routes created');

  // --- Leave Types ---
  const [ltCasual, ltSick, ltEarned, ltMaternity, ltDuty] = await LeaveType.create([
    { collegeId: CID, name: 'Casual Leave', code: 'CL', maxDaysPerYear: 12, isCarryForward: false, maxCarryForward: 0, applicableTo: ['all'] },
    { collegeId: CID, name: 'Sick Leave', code: 'SL', maxDaysPerYear: 12, isCarryForward: true, maxCarryForward: 6, applicableTo: ['all'] },
    { collegeId: CID, name: 'Earned Leave', code: 'EL', maxDaysPerYear: 15, isCarryForward: true, maxCarryForward: 30, applicableTo: ['teaching', 'non_teaching'] },
    { collegeId: CID, name: 'Maternity Leave', code: 'ML', maxDaysPerYear: 180, isCarryForward: false, maxCarryForward: 0, applicableTo: ['teaching', 'non_teaching'] },
    { collegeId: CID, name: 'Duty Leave', code: 'DL', maxDaysPerYear: 15, isCarryForward: false, maxCarryForward: 0, applicableTo: ['teaching'] },
  ]);
  console.log('Leave Types created');

  // ========================================================================
  // TIER 2 - Depends on Tier 1
  // ========================================================================

  // --- Departments ---
  const [deptCSE, deptECE, deptEEE, deptMECH, deptCIVIL] = await Department.create([
    { collegeId: CID, code: 'CSE', name: 'Computer Science and Engineering', isActive: true },
    { collegeId: CID, code: 'ECE', name: 'Electronics and Communication Engineering', isActive: true },
    { collegeId: CID, code: 'EEE', name: 'Electrical and Electronics Engineering', isActive: true },
    { collegeId: CID, code: 'MECH', name: 'Mechanical Engineering', isActive: true },
    { collegeId: CID, code: 'CIVIL', name: 'Civil Engineering', isActive: true },
  ]);
  console.log('Departments created');

  // --- Programmes ---
  const [progBTech, progMTech, progMBA] = await Programme.create([
    { collegeId: CID, code: 'BTECH', name: 'Bachelor of Technology', level: 'UG', durationYears: 4, regulationId: regR22._id, isActive: true },
    { collegeId: CID, code: 'MTECH', name: 'Master of Technology', level: 'PG', durationYears: 2, regulationId: regR22._id, isActive: true },
    { collegeId: CID, code: 'MBA', name: 'Master of Business Administration', level: 'PG', durationYears: 2, regulationId: regR22._id, isActive: true },
  ]);
  console.log('Programmes created');

  // --- Students (10) ---
  const students = await Student.create([
    { collegeId: CID, personId: persons[0]._id, admissionYear: 2022, category: 'OC', quota: 'convener', regulationId: regR22._id, programmeId: progBTech._id, rollNumber: '22B01A0501', status: 'active' },
    { collegeId: CID, personId: persons[1]._id, admissionYear: 2022, category: 'BC-B', quota: 'convener', regulationId: regR22._id, programmeId: progBTech._id, rollNumber: '22B01A0502', status: 'active' },
    { collegeId: CID, personId: persons[2]._id, admissionYear: 2021, category: 'OC', quota: 'management', regulationId: regR22._id, programmeId: progBTech._id, rollNumber: '21B01A0401', status: 'active' },
    { collegeId: CID, personId: persons[3]._id, admissionYear: 2022, category: 'SC', quota: 'convener', regulationId: regR22._id, programmeId: progBTech._id, rollNumber: '22B01A0503', status: 'active' },
    { collegeId: CID, personId: persons[4]._id, admissionYear: 2021, category: 'OC', quota: 'convener', regulationId: regR22._id, programmeId: progBTech._id, rollNumber: '21B01A0402', status: 'active' },
    { collegeId: CID, personId: persons[5]._id, admissionYear: 2022, category: 'BC-D', quota: 'convener', regulationId: regR22._id, programmeId: progBTech._id, rollNumber: '22B01A1201', status: 'active' },
    { collegeId: CID, personId: persons[6]._id, admissionYear: 2021, category: 'OC', quota: 'management', regulationId: regR22._id, programmeId: progBTech._id, rollNumber: '21B01A0301', status: 'active' },
    { collegeId: CID, personId: persons[7]._id, admissionYear: 2022, category: 'OC', quota: 'convener', regulationId: regR22._id, programmeId: progBTech._id, rollNumber: '22B01A0504', status: 'active' },
    { collegeId: CID, personId: persons[8]._id, admissionYear: 2020, category: 'ST', quota: 'convener', regulationId: regR18._id, programmeId: progBTech._id, rollNumber: '20B01A0501', status: 'graduated' },
    { collegeId: CID, personId: persons[9]._id, admissionYear: 2020, category: 'OC', quota: 'convener', regulationId: regR18._id, programmeId: progBTech._id, rollNumber: '20B01A0502', status: 'graduated' },
  ]);
  console.log('Students created');

  // --- Faculty (6) ---
  const faculties = await Faculty.create([
    { collegeId: CID, personId: persons[10]._id, employeeCode: 'FAC001', designation: 'Professor', specialization: 'Machine Learning', qualification: 'Ph.D (CSE)', departmentId: deptCSE._id, contractType: 'regular', status: 'active' },
    { collegeId: CID, personId: persons[11]._id, employeeCode: 'FAC002', designation: 'Associate Professor', specialization: 'VLSI Design', qualification: 'Ph.D (ECE)', departmentId: deptECE._id, contractType: 'regular', status: 'active' },
    { collegeId: CID, personId: persons[12]._id, employeeCode: 'FAC003', designation: 'Professor', specialization: 'Power Systems', qualification: 'Ph.D (EEE)', departmentId: deptEEE._id, contractType: 'regular', status: 'active' },
    { collegeId: CID, personId: persons[13]._id, employeeCode: 'FAC004', designation: 'Assistant Professor', specialization: 'Data Science', qualification: 'Ph.D (CSE)', departmentId: deptCSE._id, contractType: 'regular', status: 'active' },
    { collegeId: CID, personId: persons[14]._id, employeeCode: 'FAC005', designation: 'Professor & HOD', specialization: 'Thermal Engineering', qualification: 'Ph.D (MECH)', departmentId: deptMECH._id, contractType: 'regular', status: 'active' },
    { collegeId: CID, personId: persons[15]._id, employeeCode: 'FAC006', designation: 'Assistant Professor', specialization: 'Structural Engineering', qualification: 'Ph.D (CIVIL)', departmentId: deptCIVIL._id, contractType: 'regular', status: 'active' },
  ]);
  console.log('Faculty created');

  // Update HOD references
  await Department.updateOne({ _id: deptCSE._id }, { hodId: faculties[0]._id });
  await Department.updateOne({ _id: deptECE._id }, { hodId: faculties[1]._id });
  await Department.updateOne({ _id: deptMECH._id }, { hodId: faculties[4]._id });

  // --- Staff (4) ---
  const staffMembers = await Staff.create([
    { collegeId: CID, personId: persons[16]._id, employeeCode: 'STF001', designation: 'Lab Technician', departmentId: deptCSE._id, staffType: 'technical', status: 'active' },
    { collegeId: CID, personId: persons[17]._id, employeeCode: 'STF002', designation: 'Office Superintendent', departmentId: deptCSE._id, staffType: 'administrative', status: 'active' },
    { collegeId: CID, personId: persons[18]._id, employeeCode: 'STF003', designation: 'Driver', staffType: 'support', status: 'active' },
    { collegeId: CID, personId: persons[24]._id, employeeCode: 'STF004', designation: 'Security Head', staffType: 'security', status: 'active' },
  ]);
  console.log('Staff created');

  // --- Parents (5) ---
  const parents = await Parent.create([
    { collegeId: CID, personId: persons[19]._id, relationship: 'father', linkedStudents: [students[0]._id], primaryContact: true },
    { collegeId: CID, personId: persons[20]._id, relationship: 'mother', linkedStudents: [students[1]._id], primaryContact: true },
    { collegeId: CID, personId: persons[21]._id, relationship: 'father', linkedStudents: [students[2]._id], primaryContact: true },
    { collegeId: CID, personId: persons[22]._id, relationship: 'mother', linkedStudents: [students[3]._id], primaryContact: true },
    { collegeId: CID, personId: persons[23]._id, relationship: 'father', linkedStudents: [students[4]._id], primaryContact: true },
  ]);
  console.log('Parents created');

  // --- Buildings ---
  const [bldgMain, bldgScience, bldgAdmin] = await Building.create([
    { collegeId: CID, name: 'Main Block', code: 'MB', floors: 4, totalRooms: 40, location: 'Central Campus', isActive: true },
    { collegeId: CID, name: 'Science Block', code: 'SB', floors: 3, totalRooms: 25, location: 'East Campus', isActive: true },
    { collegeId: CID, name: 'Admin Block', code: 'AB', floors: 2, totalRooms: 15, location: 'Front Gate', isActive: true },
  ]);
  console.log('Buildings created');

  // --- Hostel Blocks ---
  const [hostelBoys, hostelGirls] = await HostelBlock.create([
    { collegeId: CID, name: 'Boys Hostel - Block A', type: 'boys', totalRooms: 60, wardenId: persons[14]._id, isActive: true },
    { collegeId: CID, name: 'Girls Hostel - Block B', type: 'girls', totalRooms: 40, wardenId: persons[15]._id, isActive: true },
  ]);
  console.log('Hostel Blocks created');

  // ========================================================================
  // TIER 3 - Depends on Tier 2
  // ========================================================================

  // --- Branches ---
  const [brCSE, brECE, brEEE, brMECH, brCIVIL] = await Branch.create([
    { collegeId: CID, code: 'CSE', name: 'Computer Science and Engineering', programmeId: progBTech._id, departmentId: deptCSE._id, intake: 180, isActive: true },
    { collegeId: CID, code: 'ECE', name: 'Electronics and Communication Engineering', programmeId: progBTech._id, departmentId: deptECE._id, intake: 120, isActive: true },
    { collegeId: CID, code: 'EEE', name: 'Electrical and Electronics Engineering', programmeId: progBTech._id, departmentId: deptEEE._id, intake: 60, isActive: true },
    { collegeId: CID, code: 'MECH', name: 'Mechanical Engineering', programmeId: progBTech._id, departmentId: deptMECH._id, intake: 120, isActive: true },
    { collegeId: CID, code: 'CIVIL', name: 'Civil Engineering', programmeId: progBTech._id, departmentId: deptCIVIL._id, intake: 60, isActive: true },
  ]);
  console.log('Branches created');

  // Update students with branchId
  await Student.updateMany({ _id: { $in: [students[0]._id, students[1]._id, students[3]._id, students[7]._id, students[8]._id, students[9]._id] } }, { branchId: brCSE._id });
  await Student.updateMany({ _id: { $in: [students[2]._id, students[4]._id] } }, { branchId: brECE._id });
  await Student.updateMany({ _id: { $in: [students[5]._id] } }, { branchId: brEEE._id });
  await Student.updateMany({ _id: { $in: [students[6]._id] } }, { branchId: brMECH._id });

  // --- Batches ---
  const [batch2022, batch2021, batch2020] = await Batch.create([
    { collegeId: CID, code: 'B2022', name: 'Batch 2022-26', admissionYear: 2022, programmeId: progBTech._id, regulationId: regR22._id, isActive: true },
    { collegeId: CID, code: 'B2021', name: 'Batch 2021-25', admissionYear: 2021, programmeId: progBTech._id, regulationId: regR22._id, isActive: true },
    { collegeId: CID, code: 'B2020', name: 'Batch 2020-24', admissionYear: 2020, programmeId: progBTech._id, regulationId: regR18._id, isActive: false },
  ]);
  console.log('Batches created');

  // Update students with batchId
  await Student.updateMany({ admissionYear: 2022 }, { batchId: batch2022._id });
  await Student.updateMany({ admissionYear: 2021 }, { batchId: batch2021._id });
  await Student.updateMany({ admissionYear: 2020 }, { batchId: batch2020._id });

  // --- Semesters ---
  const [sem1_24, sem2_24, sem1_25, sem2_25] = await Semester.create([
    { collegeId: CID, academicYearId: ay2024._id, number: 1, year: 2024, startDate: new Date('2024-07-15'), endDate: new Date('2024-12-15'), status: 'completed' },
    { collegeId: CID, academicYearId: ay2024._id, number: 2, year: 2025, startDate: new Date('2025-01-10'), endDate: new Date('2025-05-30'), status: 'active' },
    { collegeId: CID, academicYearId: ay2025._id, number: 1, year: 2025, startDate: new Date('2025-07-15'), endDate: new Date('2025-12-15'), status: 'upcoming' },
    { collegeId: CID, academicYearId: ay2025._id, number: 2, year: 2026, startDate: new Date('2026-01-10'), endDate: new Date('2026-05-30'), status: 'upcoming' },
  ]);
  console.log('Semesters created');

  // --- Employees ---
  const employees = await Employee.create([
    { collegeId: CID, personId: persons[10]._id, employeeId: 'EMP001', departmentId: deptCSE._id, designation: 'Professor', employeeType: 'teaching', joiningDate: new Date('2005-07-01'), status: 'active' },
    { collegeId: CID, personId: persons[11]._id, employeeId: 'EMP002', departmentId: deptECE._id, designation: 'Associate Professor', employeeType: 'teaching', joiningDate: new Date('2008-08-15'), status: 'active' },
    { collegeId: CID, personId: persons[12]._id, employeeId: 'EMP003', departmentId: deptEEE._id, designation: 'Professor', employeeType: 'teaching', joiningDate: new Date('2003-06-01'), status: 'active' },
    { collegeId: CID, personId: persons[13]._id, employeeId: 'EMP004', departmentId: deptCSE._id, designation: 'Assistant Professor', employeeType: 'teaching', joiningDate: new Date('2012-07-10'), reportingToId: undefined, status: 'active' },
    { collegeId: CID, personId: persons[14]._id, employeeId: 'EMP005', departmentId: deptMECH._id, designation: 'Professor & HOD', employeeType: 'teaching', joiningDate: new Date('2000-07-01'), status: 'active' },
    { collegeId: CID, personId: persons[16]._id, employeeId: 'EMP006', departmentId: deptCSE._id, designation: 'Lab Technician', employeeType: 'non_teaching', joiningDate: new Date('2015-03-01'), status: 'active' },
  ]);
  // Set reporting relationships
  await Employee.updateOne({ _id: employees[3]._id }, { reportingToId: employees[0]._id });
  console.log('Employees created');

  // --- Rooms ---
  const rooms = await Room.create([
    { collegeId: CID, buildingId: bldgMain._id, roomNumber: 'MB-101', floor: 1, type: 'classroom', capacity: 60, hasProjector: true, hasAC: true, status: 'available' },
    { collegeId: CID, buildingId: bldgMain._id, roomNumber: 'MB-102', floor: 1, type: 'classroom', capacity: 60, hasProjector: true, hasAC: false, status: 'available' },
    { collegeId: CID, buildingId: bldgMain._id, roomNumber: 'MB-201', floor: 2, type: 'lab', capacity: 40, hasProjector: true, hasAC: true, status: 'available' },
    { collegeId: CID, buildingId: bldgMain._id, roomNumber: 'MB-301', floor: 3, type: 'seminar_hall', capacity: 150, hasProjector: true, hasAC: true, status: 'available' },
    { collegeId: CID, buildingId: bldgScience._id, roomNumber: 'SB-101', floor: 1, type: 'lab', capacity: 30, hasProjector: true, hasAC: true, status: 'available' },
    { collegeId: CID, buildingId: bldgScience._id, roomNumber: 'SB-102', floor: 1, type: 'lab', capacity: 30, hasProjector: false, hasAC: true, status: 'available' },
    { collegeId: CID, buildingId: bldgScience._id, roomNumber: 'SB-201', floor: 2, type: 'classroom', capacity: 60, hasProjector: true, hasAC: false, status: 'available' },
    { collegeId: CID, buildingId: bldgAdmin._id, roomNumber: 'AB-101', floor: 1, type: 'conference', capacity: 30, hasProjector: true, hasAC: true, status: 'available' },
  ]);
  console.log('Rooms created');

  // --- Hostel Rooms ---
  const hostelRooms = await HostelRoom.create([
    { collegeId: CID, blockId: hostelBoys._id, roomNumber: 'BA-101', floor: 1, capacity: 3, occupancy: 2, amenities: ['bed', 'table', 'fan', 'wifi'], status: 'available' },
    { collegeId: CID, blockId: hostelBoys._id, roomNumber: 'BA-102', floor: 1, capacity: 3, occupancy: 3, amenities: ['bed', 'table', 'fan', 'wifi'], status: 'full' },
    { collegeId: CID, blockId: hostelBoys._id, roomNumber: 'BA-201', floor: 2, capacity: 2, occupancy: 1, amenities: ['bed', 'table', 'fan', 'wifi', 'ac'], status: 'available' },
    { collegeId: CID, blockId: hostelGirls._id, roomNumber: 'GB-101', floor: 1, capacity: 3, occupancy: 2, amenities: ['bed', 'table', 'fan', 'wifi'], status: 'available' },
    { collegeId: CID, blockId: hostelGirls._id, roomNumber: 'GB-102', floor: 1, capacity: 3, occupancy: 0, amenities: ['bed', 'table', 'fan', 'wifi'], status: 'available' },
    { collegeId: CID, blockId: hostelGirls._id, roomNumber: 'GB-201', floor: 2, capacity: 2, occupancy: 2, amenities: ['bed', 'table', 'fan', 'wifi', 'ac'], status: 'full' },
  ]);
  console.log('Hostel Rooms created');

  // --- Vehicles ---
  const vehicles = await Vehicle.create([
    { collegeId: CID, vehicleNumber: 'TS09UB1234', type: 'bus', make: 'Ashok Leyland', vehicleModel: 'Viking', capacity: 50, fuelType: 'diesel', driverId: staffMembers[2]._id, insuranceExpiry: new Date('2026-03-31'), fitnessExpiry: new Date('2026-06-30'), status: 'active' },
    { collegeId: CID, vehicleNumber: 'TS09UB5678', type: 'bus', make: 'Tata', vehicleModel: 'Starbus', capacity: 50, fuelType: 'diesel', insuranceExpiry: new Date('2026-05-15'), fitnessExpiry: new Date('2026-08-31'), status: 'active' },
    { collegeId: CID, vehicleNumber: 'TS09UC1111', type: 'ambulance', make: 'Force', vehicleModel: 'Traveller', capacity: 8, fuelType: 'diesel', insuranceExpiry: new Date('2026-12-31'), fitnessExpiry: new Date('2026-12-31'), status: 'active' },
  ]);
  console.log('Vehicles created');

  // --- Companies ---
  const companies = await Company.create([
    { collegeId: CID, name: 'Tata Consultancy Services', industry: 'IT Services', website: 'https://tcs.com', contactPerson: 'Anil Mehta', contactEmail: 'campus.hyd@tcs.com', contactPhone: '04040001234', tier: 'mass', isActive: true },
    { collegeId: CID, name: 'Infosys Limited', industry: 'IT Services', website: 'https://infosys.com', contactPerson: 'Rekha Jain', contactEmail: 'campus@infosys.com', contactPhone: '08040005678', tier: 'mass', isActive: true },
    { collegeId: CID, name: 'Google India', industry: 'Technology', website: 'https://google.com', contactPerson: 'Pradeep Nair', contactEmail: 'campus-india@google.com', contactPhone: '08040009012', tier: 'super_dream', isActive: true },
    { collegeId: CID, name: 'Amazon Development Centre', industry: 'E-Commerce / Cloud', website: 'https://amazon.in', contactPerson: 'Swathi Krishnan', contactEmail: 'campus-india@amazon.com', contactPhone: '04040003456', tier: 'dream', isActive: true },
    { collegeId: CID, name: 'Wipro Technologies', industry: 'IT Services', website: 'https://wipro.com', contactPerson: 'Suresh Patil', contactEmail: 'campus@wipro.com', contactPhone: '08040007890', tier: 'regular', isActive: true },
  ]);
  console.log('Companies created');

  // --- Vendors ---
  const vendors = await Vendor.create([
    { collegeId: CID, name: 'Hyderabad Office Supplies', contactPerson: 'Raman Goud', phone: '9876500010', email: 'sales@hydofficesupplies.com', address: 'Erragadda, Hyderabad', category: 'stationery', gstNumber: '36ABCDE1234F1Z5', isActive: true },
    { collegeId: CID, name: 'TechZone Solutions', contactPerson: 'Farhan Ali', phone: '9876500011', email: 'info@techzone.in', address: 'Ameerpet, Hyderabad', category: 'it_equipment', gstNumber: '36FGHIJ5678K2Y6', isActive: true },
    { collegeId: CID, name: 'Green Earth Caterers', contactPerson: 'Lakshmi Devi', phone: '9876500012', email: 'greenearth.catering@gmail.com', address: 'Kukatpally, Hyderabad', category: 'catering', isActive: true },
  ]);
  console.log('Vendors created');

  // --- Fee Structures ---
  const feeStructures = await FeeStructure.create([
    {
      collegeId: CID, academicYearId: ay2024._id, programmeId: progBTech._id, branchId: brCSE._id, quota: 'convener', year: 1,
      components: [
        { name: 'Tuition Fee', amount: 150000, isRefundable: false },
        { name: 'Development Fee', amount: 25000, isRefundable: false },
        { name: 'Lab Fee', amount: 15000, isRefundable: false },
        { name: 'Library Fee', amount: 5000, isRefundable: false },
        { name: 'Caution Deposit', amount: 10000, isRefundable: true },
      ],
      totalAmount: 205000,
    },
    {
      collegeId: CID, academicYearId: ay2024._id, programmeId: progBTech._id, branchId: brCSE._id, quota: 'management', year: 1,
      components: [
        { name: 'Tuition Fee', amount: 250000, isRefundable: false },
        { name: 'Development Fee', amount: 35000, isRefundable: false },
        { name: 'Lab Fee', amount: 15000, isRefundable: false },
        { name: 'Library Fee', amount: 5000, isRefundable: false },
        { name: 'Caution Deposit', amount: 10000, isRefundable: true },
      ],
      totalAmount: 315000,
    },
    {
      collegeId: CID, academicYearId: ay2024._id, programmeId: progBTech._id, branchId: brECE._id, quota: 'convener', year: 1,
      components: [
        { name: 'Tuition Fee', amount: 130000, isRefundable: false },
        { name: 'Development Fee', amount: 20000, isRefundable: false },
        { name: 'Lab Fee', amount: 15000, isRefundable: false },
        { name: 'Library Fee', amount: 5000, isRefundable: false },
        { name: 'Caution Deposit', amount: 10000, isRefundable: true },
      ],
      totalAmount: 180000,
    },
    {
      collegeId: CID, academicYearId: ay2024._id, programmeId: progBTech._id, branchId: brECE._id, quota: 'management', year: 1,
      components: [
        { name: 'Tuition Fee', amount: 220000, isRefundable: false },
        { name: 'Development Fee', amount: 30000, isRefundable: false },
        { name: 'Lab Fee', amount: 15000, isRefundable: false },
        { name: 'Library Fee', amount: 5000, isRefundable: false },
        { name: 'Caution Deposit', amount: 10000, isRefundable: true },
      ],
      totalAmount: 280000,
    },
    {
      collegeId: CID, academicYearId: ay2024._id, programmeId: progBTech._id, branchId: brEEE._id, quota: 'convener', year: 1,
      components: [
        { name: 'Tuition Fee', amount: 120000, isRefundable: false },
        { name: 'Development Fee', amount: 18000, isRefundable: false },
        { name: 'Lab Fee', amount: 12000, isRefundable: false },
        { name: 'Library Fee', amount: 5000, isRefundable: false },
        { name: 'Caution Deposit', amount: 10000, isRefundable: true },
      ],
      totalAmount: 165000,
    },
    {
      collegeId: CID, academicYearId: ay2024._id, programmeId: progBTech._id, branchId: brEEE._id, quota: 'management', year: 1,
      components: [
        { name: 'Tuition Fee', amount: 185000, isRefundable: false },
        { name: 'Development Fee', amount: 25000, isRefundable: false },
        { name: 'Lab Fee', amount: 12000, isRefundable: false },
        { name: 'Library Fee', amount: 5000, isRefundable: false },
        { name: 'Caution Deposit', amount: 10000, isRefundable: true },
      ],
      totalAmount: 237000,
    },
    {
      collegeId: CID, academicYearId: ay2024._id, programmeId: progBTech._id, branchId: brMECH._id, quota: 'convener', year: 1,
      components: [
        { name: 'Tuition Fee', amount: 125000, isRefundable: false },
        { name: 'Development Fee', amount: 18000, isRefundable: false },
        { name: 'Workshop Fee', amount: 15000, isRefundable: false },
        { name: 'Library Fee', amount: 5000, isRefundable: false },
        { name: 'Caution Deposit', amount: 10000, isRefundable: true },
      ],
      totalAmount: 173000,
    },
    {
      collegeId: CID, academicYearId: ay2024._id, programmeId: progBTech._id, branchId: brMECH._id, quota: 'management', year: 1,
      components: [
        { name: 'Tuition Fee', amount: 195000, isRefundable: false },
        { name: 'Development Fee', amount: 25000, isRefundable: false },
        { name: 'Workshop Fee', amount: 15000, isRefundable: false },
        { name: 'Library Fee', amount: 5000, isRefundable: false },
        { name: 'Caution Deposit', amount: 10000, isRefundable: true },
      ],
      totalAmount: 250000,
    },
    {
      collegeId: CID, academicYearId: ay2024._id, programmeId: progBTech._id, branchId: brCIVIL._id, quota: 'convener', year: 1,
      components: [
        { name: 'Tuition Fee', amount: 115000, isRefundable: false },
        { name: 'Development Fee', amount: 18000, isRefundable: false },
        { name: 'Workshop Fee', amount: 12000, isRefundable: false },
        { name: 'Library Fee', amount: 5000, isRefundable: false },
        { name: 'Caution Deposit', amount: 10000, isRefundable: true },
      ],
      totalAmount: 160000,
    },
    {
      collegeId: CID, academicYearId: ay2024._id, programmeId: progBTech._id, branchId: brCIVIL._id, quota: 'management', year: 1,
      components: [
        { name: 'Tuition Fee', amount: 175000, isRefundable: false },
        { name: 'Development Fee', amount: 22000, isRefundable: false },
        { name: 'Workshop Fee', amount: 12000, isRefundable: false },
        { name: 'Library Fee', amount: 5000, isRefundable: false },
        { name: 'Caution Deposit', amount: 10000, isRefundable: true },
      ],
      totalAmount: 224000,
    },
  ]);
  console.log('Fee Structures created');

  // --- Applicants ---
  const applicants = await Applicant.create([
    { collegeId: CID, applicationNumber: 'APP2024001', name: 'Rithika Sai', phone: '9876500020', email: 'rithika@gmail.com', gender: 'female', dateOfBirth: new Date('2006-03-10'), city: 'Hyderabad', state: 'Telangana', pincode: '500072', tenthPercentage: 95, interPercentage: 92, interStream: 'MPC', programmeApplied: 'B.Tech', branchPreference1: 'CSE', quota: 'convener', category: 'OC', eamcetRank: 1500, applicationDate: new Date('2024-05-15'), status: 'enrolled' },
    { collegeId: CID, applicationNumber: 'APP2024002', name: 'Sudheer Varma', phone: '9876500021', email: 'sudheer@gmail.com', gender: 'male', dateOfBirth: new Date('2006-07-22'), city: 'Warangal', state: 'Telangana', pincode: '506002', tenthPercentage: 88, interPercentage: 85, interStream: 'MPC', programmeApplied: 'B.Tech', branchPreference1: 'ECE', quota: 'convener', category: 'BC-B', eamcetRank: 5200, applicationDate: new Date('2024-05-20'), status: 'enrolled' },
    { collegeId: CID, applicationNumber: 'APP2024003', name: 'Tanya Singh', phone: '9876500022', email: 'tanya@gmail.com', gender: 'female', dateOfBirth: new Date('2006-01-18'), city: 'Karimnagar', state: 'Telangana', pincode: '505001', tenthPercentage: 91, interPercentage: 88, interStream: 'MPC', programmeApplied: 'B.Tech', branchPreference1: 'CSE', quota: 'management', category: 'OC', applicationDate: new Date('2024-06-01'), status: 'offered' },
    { collegeId: CID, applicationNumber: 'APP2024004', name: 'Harsha Vardhan', phone: '9876500023', email: 'harsha@gmail.com', gender: 'male', dateOfBirth: new Date('2006-09-05'), city: 'Nizamabad', state: 'Telangana', pincode: '503001', tenthPercentage: 85, interPercentage: 80, interStream: 'MPC', programmeApplied: 'B.Tech', branchPreference1: 'MECH', quota: 'convener', category: 'SC', eamcetRank: 12000, applicationDate: new Date('2024-06-10'), status: 'submitted' },
    { collegeId: CID, applicationNumber: 'APP2024005', name: 'Lavanya Reddy', phone: '9876500024', email: 'lavanya@gmail.com', gender: 'female', dateOfBirth: new Date('2006-04-28'), city: 'Khammam', state: 'Telangana', pincode: '507002', tenthPercentage: 93, interPercentage: 90, interStream: 'MPC', programmeApplied: 'B.Tech', branchPreference1: 'CSE', quota: 'convener', category: 'OC', eamcetRank: 2800, applicationDate: new Date('2024-05-25'), status: 'enrolled' },
    { collegeId: CID, applicationNumber: 'APP2024006', name: 'Pranav Kolla', phone: '9876500025', email: 'pranav@gmail.com', gender: 'male', dateOfBirth: new Date('2006-11-15'), city: 'Nalgonda', state: 'Telangana', pincode: '508001', tenthPercentage: 78, interPercentage: 75, interStream: 'MPC', programmeApplied: 'B.Tech', branchPreference1: 'CIVIL', quota: 'management', category: 'OC', applicationDate: new Date('2024-06-15'), status: 'submitted' },
  ]);
  console.log('Applicants created');

  // --- Clubs ---
  const clubs = await Club.create([
    { collegeId: CID, name: 'CodeCraft - Coding Club', type: 'technical', description: 'Competitive programming and hackathon club', coordinatorId: students[0]._id, facultyAdvisorId: faculties[0]._id, isActive: true },
    { collegeId: CID, name: 'Raga - Music Club', type: 'cultural', description: 'Classical and contemporary music club', coordinatorId: students[1]._id, facultyAdvisorId: faculties[1]._id, isActive: true },
    { collegeId: CID, name: 'Spark - Entrepreneurship Cell', type: 'entrepreneurship', description: 'Startup incubation and entrepreneurship awareness', coordinatorId: students[4]._id, facultyAdvisorId: faculties[3]._id, isActive: true },
    { collegeId: CID, name: 'Sevak - Social Service Club', type: 'social_service', description: 'Community service and social outreach', coordinatorId: students[5]._id, facultyAdvisorId: faculties[5]._id, isActive: true },
  ]);
  console.log('Clubs created');

  // --- Committees ---
  const committees = await Committee.create([
    { collegeId: CID, name: 'Anti-Ragging Committee', type: 'anti_ragging', purpose: 'Prevention and action against ragging incidents', chairpersonId: persons[24]._id, members: [
      { personId: persons[10]._id, role: 'Member' },
      { personId: persons[11]._id, role: 'Member' },
      { personId: persons[16]._id, role: 'Student Rep Liaison' },
    ], formedDate: new Date('2024-07-01'), isActive: true },
    { collegeId: CID, name: 'IQAC - Internal Quality Assurance Cell', type: 'iqac', purpose: 'Quality assurance and continuous improvement', chairpersonId: persons[24]._id, members: [
      { personId: persons[10]._id, role: 'Coordinator' },
      { personId: persons[12]._id, role: 'Member' },
      { personId: persons[14]._id, role: 'Member' },
    ], formedDate: new Date('2024-07-01'), isActive: true },
    { collegeId: CID, name: 'Grievance Redressal Committee', type: 'grievance', purpose: 'Address student and staff grievances', chairpersonId: persons[12]._id, members: [
      { personId: persons[13]._id, role: 'Member' },
      { personId: persons[17]._id, role: 'Student Welfare' },
    ], formedDate: new Date('2024-07-01'), isActive: true },
  ]);
  console.log('Committees created');

  // --- Accreditation Bodies ---
  const [accNBA, accNAAC] = await AccreditationBody.create([
    { collegeId: CID, name: 'National Board of Accreditation', acronym: 'NBA', website: 'https://nbaind.org', type: 'nba' },
    { collegeId: CID, name: 'National Assessment and Accreditation Council', acronym: 'NAAC', website: 'https://naac.gov.in', type: 'naac' },
  ]);
  console.log('Accreditation Bodies created');

  // --- Books ---
  const books = await Book.create([
    { collegeId: CID, isbn: '978-0132350884', title: 'Clean Code', author: 'Robert C. Martin', publisher: 'Pearson', edition: '1st', year: 2008, category: 'textbook', departmentId: deptCSE._id, totalCopies: 10, availableCopies: 8, location: 'Shelf-A1' },
    { collegeId: CID, isbn: '978-0201633610', title: 'Design Patterns', author: 'Gamma, Helm, Johnson, Vlissides', publisher: 'Addison-Wesley', edition: '1st', year: 1994, category: 'reference', departmentId: deptCSE._id, totalCopies: 5, availableCopies: 4, location: 'Shelf-A2' },
    { collegeId: CID, isbn: '978-0073523323', title: 'Database System Concepts', author: 'Abraham Silberschatz', publisher: 'McGraw Hill', edition: '7th', year: 2019, category: 'textbook', departmentId: deptCSE._id, totalCopies: 15, availableCopies: 12, location: 'Shelf-A3' },
    { collegeId: CID, isbn: '978-0070702097', title: 'Electronic Devices and Circuits', author: 'Salivahanan, Kumar, Vallavaraj', publisher: 'McGraw Hill', edition: '3rd', year: 2013, category: 'textbook', departmentId: deptECE._id, totalCopies: 12, availableCopies: 10, location: 'Shelf-B1' },
    { collegeId: CID, isbn: '978-0073380322', title: 'Fundamentals of Electric Circuits', author: 'Alexander & Sadiku', publisher: 'McGraw Hill', edition: '6th', year: 2016, category: 'textbook', departmentId: deptEEE._id, totalCopies: 10, availableCopies: 9, location: 'Shelf-C1' },
    { collegeId: CID, isbn: '978-1292076928', title: 'Engineering Mechanics: Statics', author: 'R.C. Hibbeler', publisher: 'Pearson', edition: '14th', year: 2015, category: 'textbook', departmentId: deptMECH._id, totalCopies: 8, availableCopies: 7, location: 'Shelf-D1' },
  ]);
  console.log('Books created');

  // ========================================================================
  // TIER 4 - Depends on Tier 3
  // ========================================================================

  // --- Sections ---
  const sections = await Section.create([
    { collegeId: CID, name: 'CSE-A', branchId: brCSE._id, batchId: batch2022._id, year: 3, semester: 5, capacity: 60, classAdvisorId: faculties[0]._id },
    { collegeId: CID, name: 'CSE-B', branchId: brCSE._id, batchId: batch2022._id, year: 3, semester: 5, capacity: 60, classAdvisorId: faculties[3]._id },
    { collegeId: CID, name: 'ECE-A', branchId: brECE._id, batchId: batch2021._id, year: 4, semester: 7, capacity: 60, classAdvisorId: faculties[1]._id },
    { collegeId: CID, name: 'MECH-A', branchId: brMECH._id, batchId: batch2021._id, year: 4, semester: 7, capacity: 60, classAdvisorId: faculties[4]._id },
  ]);
  console.log('Sections created');

  // --- Courses ---
  const courses = await Course.create([
    { collegeId: CID, code: 'CS501', name: 'Compiler Design', regulationId: regR22._id, departmentId: deptCSE._id, credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false },
    { collegeId: CID, code: 'CS502', name: 'Machine Learning', regulationId: regR22._id, departmentId: deptCSE._id, credits: 4, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 2, type: 'theory', isElective: false },
    { collegeId: CID, code: 'CS503', name: 'Computer Networks', regulationId: regR22._id, departmentId: deptCSE._id, credits: 3, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: false },
    { collegeId: CID, code: 'CS504', name: 'Machine Learning Lab', regulationId: regR22._id, departmentId: deptCSE._id, credits: 2, lectureHrs: 0, tutorialHrs: 0, practicalHrs: 3, type: 'lab', isElective: false },
    { collegeId: CID, code: 'EC501', name: 'Digital Signal Processing', regulationId: regR22._id, departmentId: deptECE._id, credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false },
    { collegeId: CID, code: 'EC502', name: 'Embedded Systems', regulationId: regR22._id, departmentId: deptECE._id, credits: 4, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 2, type: 'theory', isElective: false },
    { collegeId: CID, code: 'ME501', name: 'Heat Transfer', regulationId: regR22._id, departmentId: deptMECH._id, credits: 3, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: false },
    { collegeId: CID, code: 'CS601', name: 'Cloud Computing', regulationId: regR22._id, departmentId: deptCSE._id, credits: 3, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: true },
    { collegeId: CID, code: 'CSE101', name: 'Problem Solving with C', regulationId: regR22._id, departmentId: deptCSE._id, credits: 4, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 2, type: 'theory', isElective: false },
    { collegeId: CID, code: 'CSE102', name: 'Digital Fundamentals', regulationId: regR22._id, departmentId: deptCSE._id, credits: 3, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: false },
    { collegeId: CID, code: 'ECE101', name: 'Basic Electronic Circuits', regulationId: regR22._id, departmentId: deptECE._id, credits: 4, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 2, type: 'theory', isElective: false },
    { collegeId: CID, code: 'ECE102', name: 'Signals and Systems Foundations', regulationId: regR22._id, departmentId: deptECE._id, credits: 3, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: false },
    { collegeId: CID, code: 'EEE101', name: 'Basic Electrical Engineering', regulationId: regR22._id, departmentId: deptEEE._id, credits: 4, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 2, type: 'theory', isElective: false },
    { collegeId: CID, code: 'EEE102', name: 'Circuit Analysis', regulationId: regR22._id, departmentId: deptEEE._id, credits: 3, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false },
    { collegeId: CID, code: 'ME101', name: 'Engineering Mechanics', regulationId: regR22._id, departmentId: deptMECH._id, credits: 4, lectureHrs: 3, tutorialHrs: 1, practicalHrs: 0, type: 'theory', isElective: false },
    { collegeId: CID, code: 'ME102', name: 'Workshop Practice', regulationId: regR22._id, departmentId: deptMECH._id, credits: 2, lectureHrs: 0, tutorialHrs: 0, practicalHrs: 4, type: 'lab', isElective: false },
    { collegeId: CID, code: 'CE101', name: 'Engineering Graphics', regulationId: regR22._id, departmentId: deptCIVIL._id, credits: 3, lectureHrs: 2, tutorialHrs: 0, practicalHrs: 2, type: 'theory', isElective: false },
    { collegeId: CID, code: 'CE102', name: 'Civil Engineering Materials', regulationId: regR22._id, departmentId: deptCIVIL._id, credits: 3, lectureHrs: 3, tutorialHrs: 0, practicalHrs: 0, type: 'theory', isElective: false },
  ]);
  console.log('Courses created');

  // --- First-year curriculum maps for workflow provisioning ---
  await CurriculumMap.create([
    { collegeId: CID, regulationId: regR22._id, programmeId: progBTech._id, branchId: brCSE._id, semester: 1, courseId: courses[8]._id, isElective: false },
    { collegeId: CID, regulationId: regR22._id, programmeId: progBTech._id, branchId: brCSE._id, semester: 1, courseId: courses[9]._id, isElective: false },
    { collegeId: CID, regulationId: regR22._id, programmeId: progBTech._id, branchId: brECE._id, semester: 1, courseId: courses[10]._id, isElective: false },
    { collegeId: CID, regulationId: regR22._id, programmeId: progBTech._id, branchId: brECE._id, semester: 1, courseId: courses[11]._id, isElective: false },
    { collegeId: CID, regulationId: regR22._id, programmeId: progBTech._id, branchId: brEEE._id, semester: 1, courseId: courses[12]._id, isElective: false },
    { collegeId: CID, regulationId: regR22._id, programmeId: progBTech._id, branchId: brEEE._id, semester: 1, courseId: courses[13]._id, isElective: false },
    { collegeId: CID, regulationId: regR22._id, programmeId: progBTech._id, branchId: brMECH._id, semester: 1, courseId: courses[14]._id, isElective: false },
    { collegeId: CID, regulationId: regR22._id, programmeId: progBTech._id, branchId: brMECH._id, semester: 1, courseId: courses[15]._id, isElective: false },
    { collegeId: CID, regulationId: regR22._id, programmeId: progBTech._id, branchId: brCIVIL._id, semester: 1, courseId: courses[16]._id, isElective: false },
    { collegeId: CID, regulationId: regR22._id, programmeId: progBTech._id, branchId: brCIVIL._id, semester: 1, courseId: courses[17]._id, isElective: false },
  ]);
  console.log('Curriculum Maps created');

  // --- Hostel Allocations ---
  await HostelAllocation.create([
    { collegeId: CID, studentId: students[0]._id, roomId: hostelRooms[0]._id, academicYearId: ay2024._id, allocatedDate: new Date('2024-07-10'), status: 'active' },
    { collegeId: CID, studentId: students[2]._id, roomId: hostelRooms[1]._id, academicYearId: ay2024._id, allocatedDate: new Date('2024-07-10'), status: 'active' },
    { collegeId: CID, studentId: students[4]._id, roomId: hostelRooms[2]._id, academicYearId: ay2024._id, allocatedDate: new Date('2024-07-10'), status: 'active' },
    { collegeId: CID, studentId: students[1]._id, roomId: hostelRooms[3]._id, academicYearId: ay2024._id, allocatedDate: new Date('2024-07-10'), status: 'active' },
  ]);
  console.log('Hostel Allocations created');

  // --- Transport Allocations ---
  await TransportAllocation.create([
    { collegeId: CID, studentId: students[3]._id, routeId: routes[0]._id, stopName: 'Kukatpally Bus Stand', academicYearId: ay2024._id, status: 'active' },
    { collegeId: CID, studentId: students[5]._id, routeId: routes[1]._id, stopName: 'Dilsukhnagar Bus Stand', academicYearId: ay2024._id, status: 'active' },
    { collegeId: CID, studentId: students[6]._id, routeId: routes[2]._id, stopName: 'Secunderabad Station', academicYearId: ay2024._id, status: 'active' },
  ]);
  console.log('Transport Allocations created');

  // --- Fee Line Items ---
  const feeLineItems = await FeeLineItem.create([
    { collegeId: CID, studentId: students[0]._id, feeStructureId: feeStructures[0]._id, component: 'Tuition Fee', academicYearId: ay2024._id, semester: 5, amount: 150000, paidAmount: 150000, waivedAmount: 0, dueDate: new Date('2024-08-15'), status: 'paid' },
    { collegeId: CID, studentId: students[0]._id, feeStructureId: feeStructures[0]._id, component: 'Development Fee', academicYearId: ay2024._id, semester: 5, amount: 25000, paidAmount: 25000, waivedAmount: 0, dueDate: new Date('2024-08-15'), status: 'paid' },
    { collegeId: CID, studentId: students[1]._id, feeStructureId: feeStructures[0]._id, component: 'Tuition Fee', academicYearId: ay2024._id, semester: 5, amount: 150000, paidAmount: 100000, waivedAmount: 0, dueDate: new Date('2024-08-15'), status: 'partial' },
    { collegeId: CID, studentId: students[1]._id, feeStructureId: feeStructures[0]._id, component: 'Development Fee', academicYearId: ay2024._id, semester: 5, amount: 25000, paidAmount: 0, waivedAmount: 0, dueDate: new Date('2024-08-15'), status: 'overdue' },
    { collegeId: CID, studentId: students[2]._id, feeStructureId: feeStructures[2]._id, component: 'Tuition Fee', academicYearId: ay2024._id, semester: 7, amount: 130000, paidAmount: 130000, waivedAmount: 0, dueDate: new Date('2024-08-15'), status: 'paid' },
    { collegeId: CID, studentId: students[3]._id, feeStructureId: feeStructures[0]._id, component: 'Tuition Fee', academicYearId: ay2024._id, semester: 5, amount: 150000, paidAmount: 0, waivedAmount: 50000, dueDate: new Date('2024-08-15'), status: 'partial' },
    { collegeId: CID, studentId: students[3]._id, feeStructureId: feeStructures[0]._id, component: 'Hostel Fee', academicYearId: ay2024._id, amount: 50000, paidAmount: 50000, waivedAmount: 0, dueDate: new Date('2024-08-15'), status: 'paid' },
    { collegeId: CID, studentId: students[4]._id, feeStructureId: feeStructures[2]._id, component: 'Tuition Fee', academicYearId: ay2024._id, semester: 7, amount: 130000, paidAmount: 130000, waivedAmount: 0, dueDate: new Date('2024-08-15'), status: 'paid' },
    { collegeId: CID, studentId: students[5]._id, feeStructureId: feeStructures[0]._id, component: 'Tuition Fee', academicYearId: ay2024._id, semester: 5, amount: 150000, paidAmount: 75000, waivedAmount: 0, dueDate: new Date('2024-08-15'), status: 'partial' },
    { collegeId: CID, studentId: students[6]._id, feeStructureId: feeStructures[1]._id, component: 'Tuition Fee', academicYearId: ay2024._id, semester: 7, amount: 250000, paidAmount: 250000, waivedAmount: 0, dueDate: new Date('2024-08-15'), status: 'paid' },
  ]);
  console.log('Fee Line Items created');

  // --- Student Fee Accounts ---
  await StudentFeeAccount.create([
    { collegeId: CID, studentId: students[0]._id, totalDue: 205000, totalPaid: 205000, totalWaived: 0, totalRefunded: 0, balance: 0, lastPaymentDate: new Date('2024-08-10') },
    { collegeId: CID, studentId: students[1]._id, totalDue: 205000, totalPaid: 100000, totalWaived: 0, totalRefunded: 0, balance: 105000, lastPaymentDate: new Date('2024-08-20') },
    { collegeId: CID, studentId: students[2]._id, totalDue: 180000, totalPaid: 180000, totalWaived: 0, totalRefunded: 0, balance: 0, lastPaymentDate: new Date('2024-07-25') },
    { collegeId: CID, studentId: students[3]._id, totalDue: 255000, totalPaid: 50000, totalWaived: 50000, totalRefunded: 0, balance: 155000, lastPaymentDate: new Date('2024-09-10') },
    { collegeId: CID, studentId: students[4]._id, totalDue: 180000, totalPaid: 180000, totalWaived: 0, totalRefunded: 0, balance: 0, lastPaymentDate: new Date('2024-07-20') },
    { collegeId: CID, studentId: students[5]._id, totalDue: 205000, totalPaid: 75000, totalWaived: 0, totalRefunded: 0, balance: 130000, lastPaymentDate: new Date('2024-10-05') },
    { collegeId: CID, studentId: students[6]._id, totalDue: 315000, totalPaid: 315000, totalWaived: 0, totalRefunded: 0, balance: 0, lastPaymentDate: new Date('2024-07-15') },
    { collegeId: CID, studentId: students[7]._id, totalDue: 205000, totalPaid: 205000, totalWaived: 0, totalRefunded: 0, balance: 0, lastPaymentDate: new Date('2024-08-05') },
  ]);
  console.log('Student Fee Accounts created');

  // --- Invoices ---
  const invoices = await Invoice.create([
    { collegeId: CID, invoiceNumber: 'INV-2024-001', studentId: students[0]._id, type: 'fee', items: [{ description: 'Tuition Fee - Sem 5', amount: 150000 }, { description: 'Development Fee', amount: 25000 }], totalAmount: 175000, dueDate: new Date('2024-08-15'), status: 'paid', issuedDate: new Date('2024-07-15') },
    { collegeId: CID, invoiceNumber: 'INV-2024-002', studentId: students[1]._id, type: 'fee', items: [{ description: 'Tuition Fee - Sem 5', amount: 150000 }, { description: 'Development Fee', amount: 25000 }], totalAmount: 175000, dueDate: new Date('2024-08-15'), status: 'overdue', issuedDate: new Date('2024-07-15') },
    { collegeId: CID, invoiceNumber: 'INV-2024-003', studentId: students[3]._id, type: 'hostel', items: [{ description: 'Hostel Fee - AY 2024-25', amount: 50000 }], totalAmount: 50000, dueDate: new Date('2024-08-15'), status: 'paid', issuedDate: new Date('2024-07-15') },
    { collegeId: CID, invoiceNumber: 'INV-2024-004', studentId: students[5]._id, type: 'transport', items: [{ description: 'Transport Fee - AY 2024-25', amount: 30000 }], totalAmount: 30000, dueDate: new Date('2024-09-01'), status: 'issued', issuedDate: new Date('2024-08-01') },
  ]);
  console.log('Invoices created');

  // --- Payments ---
  const payments = await Payment.create([
    { collegeId: CID, studentId: students[0]._id, receiptNumber: 'RCP-2024-001', amount: 175000, paymentMode: 'online', transactionRef: 'TXN-RZP-20240810-001', paymentDate: new Date('2024-08-10'), allocations: [{ lineItemId: feeLineItems[0]._id, amount: 150000 }, { lineItemId: feeLineItems[1]._id, amount: 25000 }], status: 'success', collectedBy: persons[17]._id },
    { collegeId: CID, studentId: students[1]._id, receiptNumber: 'RCP-2024-002', amount: 100000, paymentMode: 'upi', transactionRef: 'TXN-UPI-20240820-001', paymentDate: new Date('2024-08-20'), allocations: [{ lineItemId: feeLineItems[2]._id, amount: 100000 }], status: 'success', collectedBy: persons[17]._id },
    { collegeId: CID, studentId: students[2]._id, receiptNumber: 'RCP-2024-003', amount: 130000, paymentMode: 'neft', transactionRef: 'TXN-NEFT-20240725-001', paymentDate: new Date('2024-07-25'), allocations: [{ lineItemId: feeLineItems[4]._id, amount: 130000 }], status: 'success', collectedBy: persons[17]._id },
    { collegeId: CID, studentId: students[3]._id, receiptNumber: 'RCP-2024-004', amount: 50000, paymentMode: 'cash', paymentDate: new Date('2024-09-10'), allocations: [{ lineItemId: feeLineItems[6]._id, amount: 50000 }], status: 'success', collectedBy: persons[17]._id },
  ]);
  console.log('Payments created');

  // --- Admission Offers ---
  await AdmissionOffer.create([
    { collegeId: CID, applicantId: applicants[0]._id, programmeId: progBTech._id, branchId: brCSE._id, feeQuoted: 205000, validityDate: new Date('2024-07-15'), status: 'accepted' },
    { collegeId: CID, applicantId: applicants[1]._id, programmeId: progBTech._id, branchId: brECE._id, feeQuoted: 180000, validityDate: new Date('2024-07-15'), status: 'accepted' },
    { collegeId: CID, applicantId: applicants[2]._id, programmeId: progBTech._id, branchId: brCSE._id, feeQuoted: 315000, validityDate: new Date('2024-07-20'), status: 'offered' },
    { collegeId: CID, applicantId: applicants[4]._id, programmeId: progBTech._id, branchId: brCSE._id, feeQuoted: 205000, validityDate: new Date('2024-07-15'), status: 'accepted' },
  ]);
  console.log('Admission Offers created');

  // --- Admissions ---
  await Admission.create([
    { collegeId: CID, applicantId: applicants[0]._id, studentId: students[0]._id, admissionDate: new Date('2024-07-01'), admittedBy: 'Admissions Office', admissionType: 'fresh' },
    { collegeId: CID, applicantId: applicants[1]._id, studentId: students[1]._id, admissionDate: new Date('2024-07-02'), admittedBy: 'Admissions Office', admissionType: 'fresh' },
    { collegeId: CID, applicantId: applicants[4]._id, studentId: students[3]._id, admissionDate: new Date('2024-07-05'), admittedBy: 'Admissions Office', admissionType: 'fresh' },
  ]);
  console.log('Admissions created');

  // --- Placement Seasons ---
  const [placementSeason2024, placementSeason2025] = await PlacementSeason.create([
    { collegeId: CID, academicYearId: ay2023._id, name: 'Campus Placements 2023-24', startDate: new Date('2023-09-01'), endDate: new Date('2024-05-31'), status: 'completed' },
    { collegeId: CID, academicYearId: ay2024._id, name: 'Campus Placements 2024-25', startDate: new Date('2024-09-01'), endDate: new Date('2025-05-31'), status: 'active' },
  ]);
  console.log('Placement Seasons created');

  // --- Hostel Visitor Logs ---
  await HostelVisitorLog.create([
    { collegeId: CID, studentId: students[0]._id, visitorName: 'Rajesh Sharma', visitorRelation: 'Father', visitorPhone: '9876543229', inTime: new Date('2025-02-15T10:00:00'), outTime: new Date('2025-02-15T13:00:00'), purpose: 'Monthly visit' },
    { collegeId: CID, studentId: students[1]._id, visitorName: 'Saraswati Reddy', visitorRelation: 'Mother', visitorPhone: '9876543230', inTime: new Date('2025-03-01T11:00:00'), outTime: new Date('2025-03-01T15:00:00'), purpose: 'Delivered clothes and food' },
    { collegeId: CID, studentId: students[2]._id, visitorName: 'Sunil Kumar', visitorRelation: 'Father', visitorPhone: '9876543231', inTime: new Date('2025-03-10T14:00:00'), purpose: 'Medical check-up follow up' },
  ]);
  console.log('Hostel Visitor Logs created');

  // --- Mess Menus ---
  await MessMenu.create([
    { collegeId: CID, blockId: hostelBoys._id, day: 'monday', meals: [
      { type: 'breakfast', items: ['Idli', 'Sambar', 'Chutney', 'Boiled Egg'] },
      { type: 'lunch', items: ['Rice', 'Dal', 'Chicken Curry', 'Salad', 'Buttermilk'] },
      { type: 'snacks', items: ['Tea', 'Samosa'] },
      { type: 'dinner', items: ['Chapati', 'Paneer Butter Masala', 'Rice', 'Rasam'] },
    ], effectiveFrom: new Date('2025-01-01') },
    { collegeId: CID, blockId: hostelGirls._id, day: 'monday', meals: [
      { type: 'breakfast', items: ['Dosa', 'Coconut Chutney', 'Sambar'] },
      { type: 'lunch', items: ['Rice', 'Dal Fry', 'Fish Curry', 'Salad', 'Curd'] },
      { type: 'snacks', items: ['Coffee', 'Biscuits'] },
      { type: 'dinner', items: ['Biryani', 'Raita', 'Sweet'] },
    ], effectiveFrom: new Date('2025-01-01') },
    { collegeId: CID, blockId: hostelBoys._id, day: 'tuesday', meals: [
      { type: 'breakfast', items: ['Upma', 'Vada', 'Chutney'] },
      { type: 'lunch', items: ['Rice', 'Sambar', 'Egg Curry', 'Pickle'] },
      { type: 'snacks', items: ['Tea', 'Mirchi Bajji'] },
      { type: 'dinner', items: ['Roti', 'Dal Makhani', 'Rice', 'Curd'] },
    ], effectiveFrom: new Date('2025-01-01') },
  ]);
  console.log('Mess Menus created');

  // --- Mess Feedback ---
  await MessFeedback.create([
    { collegeId: CID, studentId: students[0]._id, date: new Date('2025-03-15'), mealType: 'lunch', rating: 4, comments: 'Good taste, could improve on quantity' },
    { collegeId: CID, studentId: students[1]._id, date: new Date('2025-03-15'), mealType: 'dinner', rating: 3, comments: 'Rice was slightly undercooked' },
    { collegeId: CID, studentId: students[2]._id, date: new Date('2025-03-16'), mealType: 'breakfast', rating: 5, comments: 'Excellent dosa and sambar today!' },
  ]);
  console.log('Mess Feedback created');

  // --- Health Records ---
  await HealthRecord.create([
    { collegeId: CID, personId: persons[0]._id, bloodGroup: 'O+', allergies: ['Dust'], chronicConditions: [], emergencyContact: 'Rajesh Sharma', emergencyPhone: '9876543229' },
    { collegeId: CID, personId: persons[1]._id, bloodGroup: 'B+', allergies: [], chronicConditions: ['Mild Asthma'], emergencyContact: 'Saraswati Reddy', emergencyPhone: '9876543230', insuranceId: 'STAR-HI-2024-001' },
    { collegeId: CID, personId: persons[2]._id, bloodGroup: 'A+', allergies: ['Penicillin'], chronicConditions: [], emergencyContact: 'Sunil Kumar', emergencyPhone: '9876543231' },
    { collegeId: CID, personId: persons[10]._id, bloodGroup: 'AB+', allergies: [], chronicConditions: ['Diabetes Type 2'], emergencyContact: 'Sushma Iyer', emergencyPhone: '9876500050' },
  ]);
  console.log('Health Records created');

  // --- Medical Visits ---
  await MedicalVisit.create([
    { collegeId: CID, personId: persons[0]._id, visitDate: new Date('2025-02-10'), complaint: 'Headache and fever', diagnosis: 'Viral fever', prescription: 'Paracetamol 500mg TDS for 3 days', attendedBy: 'Dr. Suman - Campus Doctor' },
    { collegeId: CID, personId: persons[3]._id, visitDate: new Date('2025-03-05'), complaint: 'Sprain in right ankle', diagnosis: 'Grade 1 ankle sprain', prescription: 'Crepe bandage, Ibuprofen, Rest for 1 week', referredTo: 'Apollo Hospital - Ortho', attendedBy: 'Dr. Suman - Campus Doctor' },
    { collegeId: CID, personId: persons[1]._id, visitDate: new Date('2025-01-20'), complaint: 'Breathing difficulty', diagnosis: 'Asthma episode', prescription: 'Salbutamol inhaler, Montelukast 10mg', attendedBy: 'Dr. Suman - Campus Doctor', followUpDate: new Date('2025-02-20') },
  ]);
  console.log('Medical Visits created');

  // --- Counseling Sessions ---
  await CounselingSession.create([
    { collegeId: CID, studentId: students[3]._id, counselorId: persons[15]._id, sessionDate: new Date('2025-02-15'), type: 'academic', notes: 'Student struggling with fee payment affecting studies. Recommended for scholarship.', followUpRequired: true, nextSessionDate: new Date('2025-03-15') },
    { collegeId: CID, studentId: students[5]._id, counselorId: persons[15]._id, sessionDate: new Date('2025-03-01'), type: 'career', notes: 'Discussed career options in embedded systems vs software development.', followUpRequired: false },
  ]);
  console.log('Counseling Sessions created');

  // --- Club Memberships ---
  await ClubMembership.create([
    { collegeId: CID, clubId: clubs[0]._id, studentId: students[0]._id, role: 'president', joinedDate: new Date('2023-08-01'), status: 'active' },
    { collegeId: CID, clubId: clubs[0]._id, studentId: students[7]._id, role: 'member', joinedDate: new Date('2024-08-01'), status: 'active' },
    { collegeId: CID, clubId: clubs[1]._id, studentId: students[1]._id, role: 'president', joinedDate: new Date('2023-08-01'), status: 'active' },
    { collegeId: CID, clubId: clubs[2]._id, studentId: students[4]._id, role: 'president', joinedDate: new Date('2023-08-15'), status: 'active' },
    { collegeId: CID, clubId: clubs[3]._id, studentId: students[5]._id, role: 'president', joinedDate: new Date('2023-09-01'), status: 'active' },
  ]);
  console.log('Club Memberships created');

  // --- Events ---
  const events = await Event.create([
    { collegeId: CID, name: 'CodeStorm 2025 - Hackathon', type: 'hackathon', clubId: clubs[0]._id, departmentId: deptCSE._id, description: '24-hour coding hackathon', startDate: new Date('2025-03-15'), endDate: new Date('2025-03-16'), venue: 'Main Block - Seminar Hall', budget: 50000, coordinatorId: persons[0]._id, status: 'completed' },
    { collegeId: CID, name: 'Juvion Fest - Tarangini 2025', type: 'fest', description: 'Annual cultural fest', startDate: new Date('2025-04-10'), endDate: new Date('2025-04-12'), venue: 'Campus Grounds', budget: 500000, coordinatorId: persons[24]._id, status: 'planned' },
    { collegeId: CID, name: 'Guest Lecture - AI in Healthcare', type: 'guest_lecture', departmentId: deptCSE._id, description: 'Talk by Dr. Ravi from IIT Hyderabad', startDate: new Date('2025-02-20'), endDate: new Date('2025-02-20'), venue: 'Seminar Hall MB-301', coordinatorId: persons[10]._id, status: 'completed' },
    { collegeId: CID, name: 'Workshop on IoT', type: 'workshop', clubId: clubs[0]._id, departmentId: deptECE._id, description: 'Hands-on IoT workshop with Arduino', startDate: new Date('2025-03-25'), endDate: new Date('2025-03-26'), venue: 'ECE Lab', budget: 20000, coordinatorId: persons[11]._id, status: 'planned' },
  ]);
  console.log('Events created');

  // --- Achievements ---
  await Achievement.create([
    { collegeId: CID, studentId: students[0]._id, title: 'Winner - Smart India Hackathon 2024', category: 'technical', level: 'national', date: new Date('2024-12-15'), description: 'Won 1st prize in SIH 2024 Software Edition' },
    { collegeId: CID, studentId: students[1]._id, title: 'Classical Vocalist - Inter-University Fest', category: 'cultural', level: 'university', date: new Date('2025-01-20'), description: '2nd place in classical music competition' },
    { collegeId: CID, studentId: students[4]._id, title: 'Research Paper Published - IEEE', category: 'academic', level: 'international', date: new Date('2025-02-10'), description: 'Published paper on Embedded ML in IEEE Conference' },
    { collegeId: CID, studentId: students[6]._id, title: 'State-level Kabaddi Champion', category: 'sports', level: 'state', date: new Date('2024-11-05'), description: 'Won gold in Telangana state inter-college tournament' },
  ]);
  console.log('Achievements created');

  // --- Sports Teams ---
  const sportsTeams = await SportsTeam.create([
    { collegeId: CID, sport: 'Cricket', category: 'men', coachId: persons[14]._id, captain: students[6]._id, academicYearId: ay2024._id },
    { collegeId: CID, sport: 'Badminton', category: 'women', coachId: persons[15]._id, captain: students[5]._id, academicYearId: ay2024._id },
  ]);
  console.log('Sports Teams created');

  // --- NSS Activities ---
  const nssActivities = await NSSActivity.create([
    { collegeId: CID, title: 'Blood Donation Camp 2025', type: 'blood_donation', date: new Date('2025-01-26'), venue: 'Campus Auditorium', description: 'Annual blood donation drive in association with Red Cross', coordinatorId: persons[15]._id, participantCount: 120, hours: 4, status: 'completed' },
    { collegeId: CID, title: 'Village Adoption - Shamirpet', type: 'community_service', date: new Date('2025-02-15'), venue: 'Shamirpet Village', description: 'Digital literacy program for rural youth', coordinatorId: persons[13]._id, participantCount: 45, hours: 8, status: 'completed' },
  ]);
  console.log('NSS Activities created');

  // --- Mentoring ---
  await Mentoring.create([
    { collegeId: CID, mentorId: faculties[0]._id, menteeId: students[0]._id, academicYearId: ay2024._id, meetingDate: new Date('2025-02-01'), notes: 'Discussed career plans. Student interested in MS abroad.', status: 'active' },
    { collegeId: CID, mentorId: faculties[0]._id, menteeId: students[7]._id, academicYearId: ay2024._id, meetingDate: new Date('2025-02-05'), notes: 'Academic performance review. Student doing well.', status: 'active' },
    { collegeId: CID, mentorId: faculties[1]._id, menteeId: students[2]._id, academicYearId: ay2024._id, meetingDate: new Date('2025-01-20'), notes: 'Guided on GATE preparation strategy.', status: 'active' },
  ]);
  console.log('Mentoring created');

  // --- Skill Certifications ---
  await SkillCertification.create([
    { collegeId: CID, studentId: students[0]._id, certificationName: 'AWS Certified Cloud Practitioner', provider: 'Amazon Web Services', completedDate: new Date('2024-11-15'), credentialId: 'AWS-CP-2024-12345', validUntil: new Date('2027-11-15') },
    { collegeId: CID, studentId: students[0]._id, certificationName: 'Python for Data Science - NPTEL', provider: 'NPTEL / IIT Madras', completedDate: new Date('2024-09-30'), credentialId: 'NPTEL-PDS-2024-001' },
    { collegeId: CID, studentId: students[7]._id, certificationName: 'Google Data Analytics Certificate', provider: 'Google / Coursera', completedDate: new Date('2025-01-10'), credentialId: 'GDA-2025-78901' },
    { collegeId: CID, studentId: students[4]._id, certificationName: 'Embedded Systems Design - NPTEL', provider: 'NPTEL / IIT Kharagpur', completedDate: new Date('2024-10-20'), credentialId: 'NPTEL-ESD-2024-002' },
  ]);
  console.log('Skill Certifications created');

  // --- Leadership Roles ---
  await LeadershipRole.create([
    { collegeId: CID, studentId: students[0]._id, role: 'President', body: 'club', academicYearId: ay2024._id, startDate: new Date('2024-08-01') },
    { collegeId: CID, studentId: students[4]._id, role: 'General Secretary', body: 'student_council', academicYearId: ay2024._id, startDate: new Date('2024-08-01') },
    { collegeId: CID, studentId: students[6]._id, role: 'Sports Captain', body: 'sports', academicYearId: ay2024._id, startDate: new Date('2024-08-01') },
  ]);
  console.log('Leadership Roles created');

  // --- Room Bookings ---
  await RoomBooking.create([
    { collegeId: CID, roomId: rooms[3]._id, bookedBy: persons[10]._id, date: new Date('2025-03-20'), startTime: '10:00', endTime: '12:00', purpose: 'Guest Lecture on AI Ethics', status: 'approved' },
    { collegeId: CID, roomId: rooms[7]._id, bookedBy: persons[24]._id, date: new Date('2025-03-22'), startTime: '14:00', endTime: '16:00', purpose: 'IQAC Review Meeting', status: 'approved' },
    { collegeId: CID, roomId: rooms[3]._id, bookedBy: persons[11]._id, date: new Date('2025-04-05'), startTime: '09:00', endTime: '17:00', purpose: 'Workshop on VLSI Design', status: 'pending' },
  ]);
  console.log('Room Bookings created');

  // --- Gate Passes ---
  await GatePass.create([
    { collegeId: CID, personId: persons[0]._id, personType: 'student', type: 'half_day', reason: 'Medical appointment at Apollo Hospital', outTime: new Date('2025-03-10T10:00:00'), expectedInTime: new Date('2025-03-10T14:00:00'), actualInTime: new Date('2025-03-10T13:30:00'), approvedBy: persons[10]._id, status: 'returned' },
    { collegeId: CID, personId: persons[2]._id, personType: 'student', type: 'full_day', reason: 'Family function', outTime: new Date('2025-03-15T08:00:00'), expectedInTime: new Date('2025-03-15T20:00:00'), approvedBy: persons[12]._id, status: 'approved' },
    { collegeId: CID, personId: persons[5]._id, personType: 'student', type: 'emergency', reason: 'Family emergency - father hospitalized', outTime: new Date('2025-03-18T16:00:00'), expectedInTime: new Date('2025-03-19T20:00:00'), approvedBy: persons[15]._id, status: 'active' },
  ]);
  console.log('Gate Passes created');

  // --- Security Incidents ---
  await SecurityIncident.create([
    { collegeId: CID, reportedBy: persons[16]._id, incidentDate: new Date('2025-02-28'), location: 'Parking Area - Zone A', type: 'theft', description: 'Two-wheeler side mirror reported stolen from parking lot', severity: 'low', actionTaken: 'CCTV footage reviewed, complaint filed', status: 'investigating' },
    { collegeId: CID, reportedBy: persons[24]._id, incidentDate: new Date('2025-01-15'), location: 'Science Block - Ground Floor', type: 'vandalism', description: 'Lab equipment damaged - broken monitor in SB-101', severity: 'medium', actionTaken: 'Students identified and warned', status: 'resolved' },
  ]);
  console.log('Security Incidents created');

  // --- Labs ---
  await Lab.create([
    { collegeId: CID, roomId: rooms[2]._id, name: 'Computer Lab 1 - Programming Lab', departmentId: deptCSE._id, labInChargeId: faculties[3]._id, equipment: [{ name: 'Desktop Computer', quantity: 40, workingCount: 38 }, { name: 'Projector', quantity: 1, workingCount: 1 }], capacity: 40, isActive: true },
    { collegeId: CID, roomId: rooms[4]._id, name: 'Electronics Lab - DSP Lab', departmentId: deptECE._id, labInChargeId: faculties[1]._id, equipment: [{ name: 'DSP Kit', quantity: 20, workingCount: 18 }, { name: 'Oscilloscope', quantity: 20, workingCount: 20 }], capacity: 30, isActive: true },
    { collegeId: CID, roomId: rooms[5]._id, name: 'Circuits Lab', departmentId: deptEEE._id, labInChargeId: faculties[2]._id, equipment: [{ name: 'Breadboard Kit', quantity: 30, workingCount: 28 }, { name: 'Function Generator', quantity: 15, workingCount: 14 }], capacity: 30, isActive: true },
  ]);
  console.log('Labs created');

  // --- CCTV ---
  await CCTV.create([
    { collegeId: CID, cameraId: 'CAM-MB-001', location: 'Main Block - Entrance', buildingId: bldgMain._id, ipAddress: '192.168.1.101', type: 'outdoor', status: 'active', installedDate: new Date('2023-06-01') },
    { collegeId: CID, cameraId: 'CAM-MB-002', location: 'Main Block - Corridor 1st Floor', buildingId: bldgMain._id, ipAddress: '192.168.1.102', type: 'indoor', status: 'active', installedDate: new Date('2023-06-01') },
    { collegeId: CID, cameraId: 'CAM-SB-001', location: 'Science Block - Lab Area', buildingId: bldgScience._id, ipAddress: '192.168.1.103', type: 'dome', status: 'active', installedDate: new Date('2023-06-01') },
    { collegeId: CID, cameraId: 'CAM-PARK-001', location: 'Parking Lot - Zone A', ipAddress: '192.168.1.104', type: 'ptz', status: 'active', installedDate: new Date('2024-01-15') },
  ]);
  console.log('CCTV created');

  // --- Parking Slots ---
  await ParkingSlot.create([
    { collegeId: CID, zone: 'Zone-A', slotNumber: 'A-001', type: 'two_wheeler', status: 'occupied', allocatedTo: persons[10]._id },
    { collegeId: CID, zone: 'Zone-A', slotNumber: 'A-002', type: 'two_wheeler', status: 'available' },
    { collegeId: CID, zone: 'Zone-B', slotNumber: 'B-001', type: 'four_wheeler', status: 'reserved', allocatedTo: persons[24]._id },
    { collegeId: CID, zone: 'Zone-B', slotNumber: 'B-002', type: 'four_wheeler', status: 'occupied', allocatedTo: persons[12]._id },
    { collegeId: CID, zone: 'Zone-C', slotNumber: 'C-001', type: 'visitor', status: 'available' },
  ]);
  console.log('Parking Slots created');

  // --- Power Backup ---
  await PowerBackup.create([
    { collegeId: CID, name: 'DG Set - Main Block', type: 'generator', capacity: '500 KVA', location: 'Main Block - Basement', fuelLevel: 80, lastServiceDate: new Date('2025-01-15'), nextServiceDate: new Date('2025-07-15'), status: 'standby' },
    { collegeId: CID, name: 'Solar Panel Array - Rooftop', type: 'solar', capacity: '100 KW', location: 'Main Block - Rooftop', status: 'active' },
  ]);
  console.log('Power Backup created');

  // --- Green Initiatives ---
  await GreenInitiative.create([
    { collegeId: CID, name: 'Rooftop Solar Installation', type: 'solar', description: '100 KW solar panel installation on Main Block and Science Block rooftops', startDate: new Date('2024-01-01'), coordinatorId: persons[14]._id, metrics: { totalCapacity: '100 KW', unitsGeneratedMonthly: 12000 }, status: 'active' },
    { collegeId: CID, name: 'Campus Tree Plantation Drive', type: 'tree_plantation', description: 'Planted 500 saplings across campus as part of Go Green initiative', startDate: new Date('2024-08-15'), coordinatorId: persons[15]._id, metrics: { treesPlanted: 500, survivalRate: '92%' }, status: 'active' },
  ]);
  console.log('Green Initiatives created');

  // --- Water Supply ---
  await WaterSupply.create([
    { collegeId: CID, source: 'borewell', tankName: 'Main Overhead Tank', capacityLitres: 50000, currentLevel: 70, location: 'Main Block - Terrace', lastCleaningDate: new Date('2025-01-10'), nextCleaningDate: new Date('2025-07-10') },
    { collegeId: CID, source: 'municipal', tankName: 'Hostel Sump', capacityLitres: 100000, currentLevel: 85, location: 'Hostel Area - Underground', lastCleaningDate: new Date('2025-02-15'), nextCleaningDate: new Date('2025-08-15') },
  ]);
  console.log('Water Supply created');

  // --- Assets ---
  const assets = await Asset.create([
    { collegeId: CID, assetId: 'AST-001', name: 'HP ProDesk 400 Desktop', category: 'it_equipment', departmentId: deptCSE._id, location: 'Computer Lab 1', purchaseDate: new Date('2023-06-15'), purchaseCost: 55000, currentValue: 40000, vendor: 'TechZone Solutions', warrantyExpiry: new Date('2026-06-15'), status: 'in_use' },
    { collegeId: CID, assetId: 'AST-002', name: 'BenQ MH733 Projector', category: 'electronics', departmentId: deptCSE._id, location: 'Seminar Hall MB-301', purchaseDate: new Date('2023-01-10'), purchaseCost: 95000, currentValue: 70000, vendor: 'TechZone Solutions', warrantyExpiry: new Date('2026-01-10'), status: 'in_use' },
    { collegeId: CID, assetId: 'AST-003', name: 'Godrej Steel Almirah', category: 'furniture', departmentId: deptECE._id, location: 'ECE HOD Room', purchaseDate: new Date('2022-03-01'), purchaseCost: 15000, currentValue: 12000, status: 'in_use' },
    { collegeId: CID, assetId: 'AST-004', name: 'Tektronix TBS1072C Oscilloscope', category: 'lab_equipment', departmentId: deptECE._id, location: 'Electronics Lab', purchaseDate: new Date('2023-07-01'), purchaseCost: 45000, currentValue: 38000, warrantyExpiry: new Date('2026-07-01'), status: 'in_use' },
    { collegeId: CID, assetId: 'AST-005', name: 'Conference Table - 12 Seater', category: 'furniture', location: 'Admin Block - AB-101', purchaseDate: new Date('2022-01-15'), purchaseCost: 35000, currentValue: 28000, status: 'in_use' },
  ]);
  console.log('Assets created');

  // --- Stock Items ---
  const stockItems = await StockItem.create([
    { collegeId: CID, name: 'A4 Paper Ream', category: 'stationery', unit: 'ream', currentStock: 200, minStock: 50, location: 'Admin Store', lastRestockedDate: new Date('2025-02-01') },
    { collegeId: CID, name: 'Whiteboard Marker', category: 'stationery', unit: 'piece', currentStock: 500, minStock: 100, location: 'Admin Store', lastRestockedDate: new Date('2025-01-15') },
    { collegeId: CID, name: 'RJ45 Connector', category: 'networking', unit: 'piece', currentStock: 300, minStock: 50, location: 'IT Store', lastRestockedDate: new Date('2025-02-20') },
    { collegeId: CID, name: 'Hand Sanitizer 500ml', category: 'hygiene', unit: 'bottle', currentStock: 100, minStock: 20, location: 'Health Centre', lastRestockedDate: new Date('2025-03-01') },
  ]);
  console.log('Stock Items created');

  // --- IT Assets ---
  await ITAsset.create([
    { collegeId: CID, serialNumber: 'IT-SRV-001', type: 'server', make: 'Dell', assetModel: 'PowerEdge R740', ipAddress: '10.0.1.10', location: 'Server Room - Admin Block', purchaseDate: new Date('2023-01-15'), warrantyExpiry: new Date('2026-01-15'), status: 'active' },
    { collegeId: CID, serialNumber: 'IT-SWT-001', type: 'switch', make: 'Cisco', assetModel: 'Catalyst 2960-X', ipAddress: '10.0.1.1', macAddress: '00:1B:44:11:3A:B7', location: 'Main Block - Network Room', purchaseDate: new Date('2023-06-01'), status: 'active' },
    { collegeId: CID, serialNumber: 'IT-LAP-001', type: 'laptop', make: 'HP', assetModel: 'EliteBook 840 G8', location: 'CSE HOD Room', assignedTo: persons[10]._id, purchaseDate: new Date('2024-01-10'), warrantyExpiry: new Date('2027-01-10'), status: 'active' },
    { collegeId: CID, serialNumber: 'IT-PRN-001', type: 'printer', make: 'HP', assetModel: 'LaserJet Pro M404dn', ipAddress: '192.168.1.200', location: 'Admin Block - Office', purchaseDate: new Date('2024-03-01'), status: 'active' },
  ]);
  console.log('IT Assets created');

  // --- Network Infrastructure ---
  await NetworkInfra.create([
    { collegeId: CID, name: 'Core Switch - Main', type: 'switch', location: 'Server Room', bandwidth: '10 Gbps', ipRange: '10.0.0.0/16', status: 'active' },
    { collegeId: CID, name: 'WiFi AP - Main Block Floor 1', type: 'wifi_ap', location: 'Main Block - 1st Floor', bandwidth: '1 Gbps', ssid: 'JuvionCampus', status: 'active' },
    { collegeId: CID, name: 'Firewall - Campus', type: 'firewall', location: 'Server Room', bandwidth: '10 Gbps', status: 'active' },
  ]);
  console.log('Network Infrastructure created');

  // --- Insurance ---
  await Insurance.create([
    { collegeId: CID, policyNumber: 'INS-PROP-2024-001', provider: 'New India Assurance', type: 'property', coverageAmount: 50000000, premium: 250000, startDate: new Date('2024-04-01'), endDate: new Date('2025-03-31'), coveredAssets: 'All campus buildings and fixed assets', status: 'active' },
    { collegeId: CID, policyNumber: 'INS-STU-2024-001', provider: 'United India Insurance', type: 'student_group', coverageAmount: 200000, premium: 150000, startDate: new Date('2024-07-01'), endDate: new Date('2025-06-30'), coveredAssets: 'All enrolled students - Group Personal Accident', status: 'active' },
  ]);
  console.log('Insurance created');

  // --- Energy Consumption ---
  await EnergyConsumption.create([
    { collegeId: CID, buildingId: bldgMain._id, month: 1, year: 2025, electricityUnits: 25000, electricityCost: 200000, waterUnits: 5000, waterCost: 25000, solarGenerated: 8000 },
    { collegeId: CID, buildingId: bldgMain._id, month: 2, year: 2025, electricityUnits: 23000, electricityCost: 184000, waterUnits: 4500, waterCost: 22500, solarGenerated: 9000 },
    { collegeId: CID, buildingId: bldgScience._id, month: 1, year: 2025, electricityUnits: 15000, electricityCost: 120000, waterUnits: 3000, waterCost: 15000 },
  ]);
  console.log('Energy Consumption created');

  // --- Waste Management ---
  await WasteManagement.create([
    { collegeId: CID, date: new Date('2025-03-01'), wasteType: 'dry', quantityKg: 250, disposalMethod: 'recycle', handledBy: 'Green Waste Solutions', vendorName: 'Green Waste Solutions', cost: 2500 },
    { collegeId: CID, date: new Date('2025-03-01'), wasteType: 'wet', quantityKg: 400, disposalMethod: 'compost', handledBy: 'Campus Garden Team', cost: 0 },
  ]);
  console.log('Waste Management created');

  // --- Construction Projects ---
  await ConstructionProject.create([
    { collegeId: CID, name: 'New Library Block', description: 'State-of-the-art library with digital learning centre', contractorName: 'Rajiv Constructions', estimatedCost: 25000000, startDate: new Date('2025-01-15'), expectedCompletion: new Date('2026-06-30'), status: 'in_progress' },
    { collegeId: CID, name: 'Sports Complex Renovation', description: 'Renovation of existing sports complex with indoor facilities', contractorName: 'Arun Builders', estimatedCost: 8000000, startDate: new Date('2025-06-01'), expectedCompletion: new Date('2025-12-31'), status: 'planned' },
  ]);
  console.log('Construction Projects created');

  // --- Library Members ---
  const libraryMembers = await LibraryMember.create([
    { collegeId: CID, personId: persons[0]._id, memberType: 'student', membershipId: 'LIB-STU-001', maxBooks: 4, currentIssued: 1, finesDue: 0, isActive: true },
    { collegeId: CID, personId: persons[1]._id, memberType: 'student', membershipId: 'LIB-STU-002', maxBooks: 4, currentIssued: 0, finesDue: 50, isActive: true },
    { collegeId: CID, personId: persons[2]._id, memberType: 'student', membershipId: 'LIB-STU-003', maxBooks: 4, currentIssued: 2, finesDue: 0, isActive: true },
    { collegeId: CID, personId: persons[10]._id, memberType: 'faculty', membershipId: 'LIB-FAC-001', maxBooks: 10, currentIssued: 3, finesDue: 0, isActive: true },
    { collegeId: CID, personId: persons[11]._id, memberType: 'faculty', membershipId: 'LIB-FAC-002', maxBooks: 10, currentIssued: 1, finesDue: 0, isActive: true },
  ]);
  console.log('Library Members created');

  // --- E-Resources ---
  const eResources = await EResource.create([
    { collegeId: CID, title: 'IEEE Xplore Digital Library', type: 'database', provider: 'IEEE', url: 'https://ieeexplore.ieee.org', accessType: 'subscribed', subscriptionStart: new Date('2024-01-01'), subscriptionEnd: new Date('2025-12-31'), isActive: true },
    { collegeId: CID, title: 'NPTEL - Programming in Python', type: 'nptel', provider: 'NPTEL / IIT Madras', url: 'https://nptel.ac.in/courses/106106182', accessType: 'open', isActive: true },
    { collegeId: CID, title: 'Springer Link - Engineering', type: 'e_journal', provider: 'Springer Nature', url: 'https://link.springer.com', accessType: 'subscribed', subscriptionStart: new Date('2024-04-01'), subscriptionEnd: new Date('2025-03-31'), isActive: true },
    { collegeId: CID, title: 'SWAYAM - Data Structures', type: 'mooc', provider: 'SWAYAM / MHRD', url: 'https://swayam.gov.in', accessType: 'open', isActive: true },
  ]);
  console.log('E-Resources created');

  // --- Periodical Subscriptions ---
  await PeriodicalSubscription.create([
    { collegeId: CID, title: 'Electronics For You', type: 'magazine', publisher: 'EFY Group', frequency: 'monthly', startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), cost: 3600, isActive: true },
    { collegeId: CID, title: 'The Hindu', type: 'newspaper', publisher: 'The Hindu Group', frequency: 'daily', startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31'), cost: 5400, isActive: true },
    { collegeId: CID, title: 'Journal of Computer Science', type: 'journal', publisher: 'Science Publications', frequency: 'quarterly', issn: '1549-3636', startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), cost: 12000, isActive: true },
  ]);
  console.log('Periodical Subscriptions created');

  // --- Committee Meetings ---
  await CommitteeMeeting.create([
    { collegeId: CID, committeeId: committees[1]._id, meetingDate: new Date('2025-01-15'), agenda: 'Review of AQAR preparation status and action items', minutes: 'Discussed criterion-wise data collection. Assigned deadlines for each department.', attendees: [persons[24]._id, persons[10]._id, persons[12]._id, persons[14]._id], decisions: ['All departments to submit data by Feb 28', 'SSR draft review in next meeting'], nextMeetingDate: new Date('2025-03-15'), status: 'completed' },
    { collegeId: CID, committeeId: committees[0]._id, meetingDate: new Date('2025-02-01'), agenda: 'Review of anti-ragging measures and awareness programs', attendees: [persons[24]._id, persons[10]._id, persons[11]._id], decisions: ['Conduct awareness session for freshers', 'Install suggestion boxes in hostels'], status: 'completed' },
    { collegeId: CID, committeeId: committees[2]._id, meetingDate: new Date('2025-04-10'), agenda: 'Monthly grievance review - pending cases', status: 'scheduled' },
  ]);
  console.log('Committee Meetings created');

  // --- Policies ---
  await Policy.create([
    { collegeId: CID, title: 'Academic Integrity Policy', category: 'academic', description: 'Policy on plagiarism, cheating, and academic dishonesty', version: 2, effectiveDate: new Date('2024-07-01'), approvedBy: persons[24]._id, status: 'active' },
    { collegeId: CID, title: 'Anti-Ragging Policy', category: 'student', description: 'Zero tolerance policy against ragging as per UGC regulations', version: 1, effectiveDate: new Date('2024-07-01'), approvedBy: persons[24]._id, status: 'active' },
    { collegeId: CID, title: 'IT Usage Policy', category: 'it', description: 'Guidelines for usage of campus IT infrastructure, internet, and email', version: 3, effectiveDate: new Date('2024-01-01'), approvedBy: persons[24]._id, status: 'active' },
  ]);
  console.log('Policies created');

  // --- Governing Body Members ---
  await GoverningBodyMember.create([
    { collegeId: CID, personId: persons[24]._id, designation: 'Principal', role: 'secretary', appointedDate: new Date('2020-01-01'), tenure: 5, isActive: true },
    { collegeId: CID, externalName: 'Sri Ramoji Rao', designation: 'Industrialist', role: 'chairperson', appointedDate: new Date('2018-06-01'), tenure: 5, isActive: true },
    { collegeId: CID, personId: persons[14]._id, designation: 'Professor & HOD', role: 'member', appointedDate: new Date('2022-07-01'), isActive: true },
    { collegeId: CID, externalName: 'Dr. K. Sivan', designation: 'Former ISRO Chairman', role: 'nominee', appointedDate: new Date('2023-01-01'), isActive: true },
  ]);
  console.log('Governing Body Members created');

  // --- Strategic Goals ---
  await StrategicGoal.create([
    { collegeId: CID, title: 'Achieve NAAC A++ Grade', description: 'Prepare and achieve NAAC A++ accreditation in cycle 3', category: 'accreditation', targetDate: new Date('2026-12-31'), kpis: [{ metric: 'SSR Completion', target: 100, current: 45 }, { metric: 'Faculty with PhD %', target: 75, current: 60 }], ownerId: persons[24]._id, status: 'on_track' },
    { collegeId: CID, title: '90% Placement Rate', description: 'Achieve 90% placement rate for graduating batch', category: 'placement', targetDate: new Date('2025-06-30'), kpis: [{ metric: 'Placement Rate %', target: 90, current: 72 }, { metric: 'Average Package LPA', target: 8, current: 6.5 }], ownerId: persons[10]._id, status: 'at_risk' },
    { collegeId: CID, title: 'Research Publication Target', description: 'Publish 50 Scopus-indexed papers per academic year', category: 'research', targetDate: new Date('2025-06-30'), kpis: [{ metric: 'Scopus Publications', target: 50, current: 32 }], ownerId: persons[12]._id, status: 'on_track' },
  ]);
  console.log('Strategic Goals created');

  // --- Accreditation Cycles ---
  const accCycles = await AccreditationCycle.create([
    { collegeId: CID, bodyId: accNAAC._id, cycle: 2, applicationDate: new Date('2023-06-01'), visitDate: new Date('2023-11-15'), grade: 'A', validFrom: new Date('2024-01-01'), validTo: new Date('2029-01-01'), status: 'accredited' },
    { collegeId: CID, bodyId: accNBA._id, cycle: 1, applicationDate: new Date('2024-09-01'), status: 'applied' },
  ]);
  console.log('Accreditation Cycles created');

  // --- Compliance Criteria ---
  await ComplianceCriteria.create([
    { collegeId: CID, accreditationCycleId: accCycles[1]._id, criterionNumber: '1', title: 'Vision, Mission and Program Educational Objectives', maxScore: 100, selfScore: 75, evidence: [{ description: 'Vision Mission document approved by Governing Body' }], status: 'in_progress' },
    { collegeId: CID, accreditationCycleId: accCycles[1]._id, criterionNumber: '2', title: 'Program Curriculum and Teaching-Learning Processes', maxScore: 150, selfScore: 110, evidence: [{ description: 'Curriculum compliance matrix' }, { description: 'Lesson plans and academic calendars' }], status: 'in_progress' },
    { collegeId: CID, accreditationCycleId: accCycles[1]._id, criterionNumber: '3', title: 'Course Outcomes and Program Outcomes', maxScore: 150, evidence: [{ description: 'CO-PO mapping document' }], status: 'not_started' },
  ]);
  console.log('Compliance Criteria created');

  // --- Regulatory Filings ---
  await RegulatoryFiling.create([
    { collegeId: CID, body: 'aicte', filingType: 'Extension of Approval (EoA)', dueDate: new Date('2025-04-30'), filedDate: new Date('2025-03-15'), referenceNumber: 'AICTE/EOA/2025-26/1234', status: 'filed' },
    { collegeId: CID, body: 'jntu', filingType: 'Affiliation Renewal Application', dueDate: new Date('2025-05-31'), status: 'in_progress' },
  ]);
  console.log('Regulatory Filings created');

  // --- Announcements ---
  await Announcement.create([
    { collegeId: CID, title: 'Semester End Examination Schedule Released', content: 'The end semester examination schedule for AY 2024-25 Even semester has been released. Students are advised to check the exam portal.', category: 'exam', priority: 'high', postedBy: persons[24]._id, targetAudience: 'students', isPinned: true },
    { collegeId: CID, title: 'Campus Placement Drive - TCS', content: 'TCS campus placement drive scheduled for April 5-6, 2025. Eligible students must register by March 25.', category: 'placement', priority: 'normal', postedBy: persons[10]._id, targetAudience: 'students' },
    { collegeId: CID, title: 'Faculty Development Programme on AI/ML', content: '5-day FDP on AI/ML applications in engineering education. Registration open for all faculty.', category: 'academic', priority: 'normal', postedBy: persons[24]._id, targetAudience: 'faculty' },
  ]);
  console.log('Announcements created');

  // --- Circulars ---
  await Circular.create([
    { collegeId: CID, circularNumber: 'CIR/2025/001', title: 'Updated Attendance Policy', content: 'Minimum 75% attendance is mandatory for appearing in end semester examinations. Students below 65% will be detained.', issuedBy: persons[24]._id, targetAudience: 'all', issuedDate: new Date('2025-01-10') },
    { collegeId: CID, circularNumber: 'CIR/2025/002', title: 'Dress Code for Campus', content: 'All students must wear ID cards and follow prescribed dress code. Formals on placement days.', issuedBy: persons[24]._id, department: 'Administration', targetAudience: 'students', issuedDate: new Date('2025-02-01') },
  ]);
  console.log('Circulars created');

  // --- Notifications ---
  await Notification.create([
    { collegeId: CID, title: 'Fee Payment Reminder', message: 'Your fee payment for Semester 5 is overdue. Please clear pending dues by March 31.', type: 'reminder', targetAudience: 'individual', targetIds: [persons[1]._id, persons[3]._id], channel: 'sms', sentAt: new Date('2025-03-15'), sentBy: persons[17]._id, status: 'sent' },
    { collegeId: CID, title: 'Library Book Return', message: 'Your library book is due for return. Please return to avoid fines.', type: 'reminder', targetAudience: 'individual', targetIds: [persons[2]._id], channel: 'app', sentAt: new Date('2025-03-10'), sentBy: persons[17]._id, status: 'sent' },
    { collegeId: CID, title: 'Holiday - Ugadi', message: 'The college will remain closed on March 30 (Ugadi). Classes resume on March 31.', type: 'info', targetAudience: 'all', channel: 'push', sentAt: new Date('2025-03-25'), sentBy: persons[24]._id, status: 'sent' },
    { collegeId: CID, title: 'TCS Pre-Placement Talk', message: 'TCS Pre-Placement Talk scheduled on April 3. All registered students must attend.', type: 'announcement', targetAudience: 'students', channel: 'email', scheduledAt: new Date('2025-04-01'), sentBy: persons[10]._id, status: 'scheduled' },
  ]);
  console.log('Notifications created');

  // --- Feedback Surveys ---
  const surveys = await FeedbackSurvey.create([
    { collegeId: CID, title: 'Course Feedback - Even Sem 2024-25', description: 'Student feedback on teaching quality and course content', targetAudience: 'students', questions: [
      { text: 'Rate the clarity of the instructor', type: 'rating', isRequired: true },
      { text: 'Rate the course material quality', type: 'rating', isRequired: true },
      { text: 'Any suggestions for improvement?', type: 'text', isRequired: false },
    ], startDate: new Date('2025-04-15'), endDate: new Date('2025-05-15'), createdBy: persons[24]._id, status: 'draft' },
    { collegeId: CID, title: 'Hostel Satisfaction Survey 2025', description: 'Feedback on hostel facilities and mess quality', targetAudience: 'students', questions: [
      { text: 'Rate room cleanliness', type: 'scale', isRequired: true },
      { text: 'Rate mess food quality', type: 'scale', isRequired: true },
      { text: 'Rate WiFi connectivity', type: 'scale', isRequired: true },
      { text: 'Overall satisfaction', type: 'rating', isRequired: true },
    ], startDate: new Date('2025-03-01'), endDate: new Date('2025-03-31'), createdBy: persons[15]._id, status: 'active' },
  ]);
  console.log('Feedback Surveys created');

  // --- Budgets ---
  const budgets = await Budget.create([
    { collegeId: CID, academicYearId: ay2024._id, departmentId: deptCSE._id, category: 'Lab Equipment', allocatedAmount: 1500000, spentAmount: 980000, status: 'active' },
    { collegeId: CID, academicYearId: ay2024._id, departmentId: deptECE._id, category: 'Lab Equipment', allocatedAmount: 1200000, spentAmount: 750000, status: 'active' },
    { collegeId: CID, academicYearId: ay2024._id, category: 'Library', allocatedAmount: 800000, spentAmount: 520000, status: 'active' },
  ]);
  console.log('Budgets created');

  // --- Expenses ---
  await Expense.create([
    { collegeId: CID, budgetId: budgets[0]._id, category: 'Lab Equipment', description: 'Purchase of 10 HP desktops for CSE Lab', amount: 550000, vendorName: 'TechZone Solutions', invoiceNumber: 'TZ-INV-2024-045', invoiceDate: new Date('2024-09-15'), paidDate: new Date('2024-10-01'), status: 'paid', approvedBy: persons[24]._id },
    { collegeId: CID, budgetId: budgets[0]._id, category: 'Lab Equipment', description: 'Software licenses - MATLAB, AutoCAD', amount: 430000, vendorName: 'SoftwarePro India', invoiceNumber: 'SP-2024-122', invoiceDate: new Date('2024-11-01'), paidDate: new Date('2024-11-15'), status: 'paid', approvedBy: persons[24]._id },
    { collegeId: CID, budgetId: budgets[2]._id, category: 'Library', description: 'Annual IEEE Xplore subscription', amount: 320000, vendorName: 'IEEE', invoiceNumber: 'IEEE-SUB-2024', invoiceDate: new Date('2024-01-15'), paidDate: new Date('2024-02-01'), status: 'paid', approvedBy: persons[24]._id },
    { collegeId: CID, category: 'Maintenance', description: 'Annual maintenance contract - elevators', amount: 180000, vendorName: 'KONE Elevators', invoiceNumber: 'KONE-AMC-2025', invoiceDate: new Date('2025-01-01'), status: 'approved', approvedBy: persons[24]._id },
  ]);
  console.log('Expenses created');

  // --- Scholarships ---
  const scholarships = await Scholarship.create([
    { collegeId: CID, name: 'Telangana State SC/ST Scholarship', provider: 'government', type: 'sc_st', amount: 50000, criteria: 'SC/ST students with family income below 2.5 LPA', academicYearId: ay2024._id, maxRecipients: 50, isActive: true },
    { collegeId: CID, name: 'Juvion Merit Scholarship', provider: 'institutional', type: 'merit', amount: 75000, criteria: 'Top 5% students by CGPA in each branch', academicYearId: ay2024._id, maxRecipients: 25, isActive: true },
    { collegeId: CID, name: 'TCS Best Student Award', provider: 'corporate', type: 'merit', amount: 100000, criteria: 'Best all-round student selected by placement committee', academicYearId: ay2024._id, maxRecipients: 3, isActive: true },
  ]);
  console.log('Scholarships created');

  // --- Leave Balances ---
  await LeaveBalance.create([
    { collegeId: CID, employeeId: employees[0]._id, leaveTypeId: ltCasual._id, academicYearId: ay2024._id, entitled: 12, taken: 3, balance: 9 },
    { collegeId: CID, employeeId: employees[0]._id, leaveTypeId: ltSick._id, academicYearId: ay2024._id, entitled: 12, taken: 1, balance: 11 },
    { collegeId: CID, employeeId: employees[1]._id, leaveTypeId: ltCasual._id, academicYearId: ay2024._id, entitled: 12, taken: 5, balance: 7 },
    { collegeId: CID, employeeId: employees[1]._id, leaveTypeId: ltEarned._id, academicYearId: ay2024._id, entitled: 15, taken: 0, balance: 15 },
    { collegeId: CID, employeeId: employees[2]._id, leaveTypeId: ltCasual._id, academicYearId: ay2024._id, entitled: 12, taken: 2, balance: 10 },
    { collegeId: CID, employeeId: employees[5]._id, leaveTypeId: ltCasual._id, academicYearId: ay2024._id, entitled: 12, taken: 4, balance: 8 },
  ]);
  console.log('Leave Balances created');

  // --- Leave Applications ---
  await LeaveApplication.create([
    { collegeId: CID, employeeId: employees[0]._id, leaveTypeId: ltCasual._id, fromDate: new Date('2025-03-10'), toDate: new Date('2025-03-10'), days: 1, reason: 'Personal work', status: 'approved', approvedBy: persons[24]._id },
    { collegeId: CID, employeeId: employees[1]._id, leaveTypeId: ltSick._id, fromDate: new Date('2025-02-18'), toDate: new Date('2025-02-19'), days: 2, reason: 'Fever and cold', status: 'approved', approvedBy: persons[24]._id },
    { collegeId: CID, employeeId: employees[5]._id, leaveTypeId: ltCasual._id, fromDate: new Date('2025-04-01'), toDate: new Date('2025-04-02'), days: 2, reason: 'Family function', status: 'applied' },
  ]);
  console.log('Leave Applications created');

  // --- Pay Structures ---
  await PayStructure.create([
    { collegeId: CID, employeeId: employees[0]._id, basicPay: 80000, hra: 24000, da: 16000, otherAllowances: 10000, pfContribution: 9600, effectiveFrom: new Date('2024-07-01') },
    { collegeId: CID, employeeId: employees[1]._id, basicPay: 65000, hra: 19500, da: 13000, otherAllowances: 8000, pfContribution: 7800, effectiveFrom: new Date('2024-07-01') },
    { collegeId: CID, employeeId: employees[5]._id, basicPay: 30000, hra: 9000, da: 6000, otherAllowances: 4000, pfContribution: 3600, effectiveFrom: new Date('2024-07-01') },
  ]);
  console.log('Pay Structures created');

  // --- Payroll ---
  await Payroll.create([
    { collegeId: CID, employeeId: employees[0]._id, month: 2, year: 2025, basicPay: 80000, hra: 24000, da: 16000, otherAllowances: 10000, grossPay: 130000, pf: 9600, esi: 0, tds: 15000, otherDeductions: 0, netPay: 105400, status: 'paid', paidDate: new Date('2025-02-28') },
    { collegeId: CID, employeeId: employees[1]._id, month: 2, year: 2025, basicPay: 65000, hra: 19500, da: 13000, otherAllowances: 8000, grossPay: 105500, pf: 7800, esi: 0, tds: 10000, otherDeductions: 0, netPay: 87700, status: 'paid', paidDate: new Date('2025-02-28') },
    { collegeId: CID, employeeId: employees[5]._id, month: 2, year: 2025, basicPay: 30000, hra: 9000, da: 6000, otherAllowances: 4000, grossPay: 49000, pf: 3600, esi: 808, tds: 0, otherDeductions: 0, netPay: 44592, status: 'paid', paidDate: new Date('2025-02-28') },
  ]);
  console.log('Payroll created');

  // --- HR Trainings ---
  const hrTrainings = await Training.create([
    { collegeId: CID, title: 'FDP on Outcome-Based Education', type: 'fdp', conductedBy: 'IUCEE', startDate: new Date('2025-01-06'), endDate: new Date('2025-01-10'), venue: 'Seminar Hall', maxParticipants: 30, status: 'completed' },
    { collegeId: CID, title: 'Workshop on Research Methodology', type: 'workshop', conductedBy: 'Dr. Anand Kumar - IIT Hyderabad', startDate: new Date('2025-03-20'), endDate: new Date('2025-03-21'), venue: 'Conference Room', maxParticipants: 25, status: 'completed' },
    { collegeId: CID, title: 'Skill Development - Advanced Python', type: 'skill_development', conductedBy: 'Internal Faculty', startDate: new Date('2025-04-15'), endDate: new Date('2025-04-17'), venue: 'CSE Lab', maxParticipants: 20, status: 'planned' },
  ]);
  console.log('HR Trainings created');

  // --- Recruitment ---
  await Recruitment.create([
    { collegeId: CID, position: 'Assistant Professor - CSE', departmentId: deptCSE._id, vacancies: 3, qualifications: 'Ph.D in CSE/IT with NET/SLET', experience: '2+ years teaching', salary: '50000-80000 per month', postedDate: new Date('2025-02-01'), lastDate: new Date('2025-04-30'), status: 'open' },
    { collegeId: CID, position: 'Lab Technician - ECE', departmentId: deptECE._id, vacancies: 1, qualifications: 'B.Tech/Diploma in ECE', experience: '1+ year', salary: '25000-35000 per month', postedDate: new Date('2025-03-01'), lastDate: new Date('2025-04-15'), status: 'open' },
  ]);
  console.log('Recruitment created');

  // --- Appraisals ---
  await Appraisal.create([
    { collegeId: CID, employeeId: employees[0]._id, academicYearId: ay2024._id, reviewerId: employees[4]._id, selfRating: 4.2, reviewerRating: 4.0, finalRating: 4.1, goals: [
      { description: 'Publish 3 Scopus-indexed papers', weightage: 30, rating: 4 },
      { description: 'Mentor 5 students for placements', weightage: 25, rating: 5 },
      { description: 'Conduct 1 FDP/Workshop', weightage: 20, rating: 4 },
    ], status: 'completed' },
    { collegeId: CID, employeeId: employees[1]._id, academicYearId: ay2024._id, reviewerId: employees[4]._id, selfRating: 3.8, goals: [
      { description: 'Complete VLSI lab setup', weightage: 40, rating: 4 },
      { description: 'Publish 2 research papers', weightage: 30 },
    ], status: 'self_review' },
    { collegeId: CID, employeeId: employees[3]._id, academicYearId: ay2024._id, reviewerId: employees[0]._id, selfRating: 4.5, reviewerRating: 4.3, finalRating: 4.4, goals: [
      { description: 'Develop ML course content', weightage: 35, rating: 5 },
      { description: 'Guide 3 student projects', weightage: 30, rating: 4 },
    ], status: 'completed' },
  ]);
  console.log('Appraisals created');

  // --- Qualifications ---
  await Qualification.create([
    { collegeId: CID, personId: persons[10]._id, degree: 'Ph.D', specialization: 'Computer Science - Machine Learning', university: 'IIT Hyderabad', yearOfPassing: 2005, isHighest: true },
    { collegeId: CID, personId: persons[10]._id, degree: 'M.Tech', specialization: 'Computer Science', university: 'NIT Warangal', yearOfPassing: 2000, cgpa: 8.9, isHighest: false },
    { collegeId: CID, personId: persons[11]._id, degree: 'Ph.D', specialization: 'VLSI Design', university: 'JNTU Hyderabad', yearOfPassing: 2008, isHighest: true },
    { collegeId: CID, personId: persons[12]._id, degree: 'Ph.D', specialization: 'Power Systems', university: 'Osmania University', yearOfPassing: 2003, isHighest: true },
  ]);
  console.log('Qualifications created');

  // --- Publications ---
  await Publication.create([
    { collegeId: CID, facultyId: faculties[0]._id, title: 'Deep Learning Approaches for Medical Image Classification', type: 'journal', journalName: 'IEEE Transactions on Medical Imaging', publishedDate: new Date('2024-08-15'), doi: '10.1109/TMI.2024.12345', impactFactor: 10.6, indexing: 'sci' },
    { collegeId: CID, facultyId: faculties[0]._id, title: 'Federated Learning for Privacy-Preserving Healthcare Analytics', type: 'conference', conferenceName: 'IEEE ICML 2024', publishedDate: new Date('2024-12-10'), doi: '10.1109/ICML.2024.5678', indexing: 'scopus' },
    { collegeId: CID, facultyId: faculties[1]._id, title: 'Low-Power VLSI Design for IoT Edge Devices', type: 'journal', journalName: 'Microelectronics Journal', publishedDate: new Date('2024-06-20'), doi: '10.1016/j.mejo.2024.001', impactFactor: 2.4, indexing: 'scopus' },
  ]);
  console.log('Publications created');

  // --- Research Projects ---
  await ResearchProject.create([
    { collegeId: CID, title: 'AI-Powered Early Detection of Crop Diseases', principalInvestigatorId: faculties[0]._id, coInvestigators: [faculties[3]._id], fundingAgency: 'DST-SERB', sanctionedAmount: 2500000, startDate: new Date('2024-04-01'), endDate: new Date('2027-03-31'), status: 'ongoing' },
    { collegeId: CID, title: 'Energy-Efficient VLSI Architectures for 5G', principalInvestigatorId: faculties[1]._id, fundingAgency: 'AICTE-RPS', sanctionedAmount: 1500000, startDate: new Date('2024-07-01'), status: 'sanctioned' },
  ]);
  console.log('Research Projects created');

  // ========================================================================
  // TIER 5 - Depends on Tier 4
  // ========================================================================

  // --- Course Offerings ---
  const courseOfferings = await CourseOffering.create([
    { collegeId: CID, courseId: courses[0]._id, semesterId: sem2_24._id, sectionId: sections[0]._id, facultyId: faculties[0]._id, maxEnrollment: 60, enrolledCount: 55 },
    { collegeId: CID, courseId: courses[1]._id, semesterId: sem2_24._id, sectionId: sections[0]._id, facultyId: faculties[3]._id, maxEnrollment: 60, enrolledCount: 58 },
    { collegeId: CID, courseId: courses[2]._id, semesterId: sem2_24._id, sectionId: sections[1]._id, facultyId: faculties[0]._id, maxEnrollment: 60, enrolledCount: 52 },
    { collegeId: CID, courseId: courses[3]._id, semesterId: sem2_24._id, sectionId: sections[0]._id, facultyId: faculties[3]._id, maxEnrollment: 40, enrolledCount: 38 },
    { collegeId: CID, courseId: courses[4]._id, semesterId: sem2_24._id, sectionId: sections[2]._id, facultyId: faculties[1]._id, maxEnrollment: 60, enrolledCount: 48 },
    { collegeId: CID, courseId: courses[6]._id, semesterId: sem2_24._id, sectionId: sections[3]._id, facultyId: faculties[4]._id, maxEnrollment: 60, enrolledCount: 45 },
  ]);
  console.log('Course Offerings created');

  // --- Job Postings ---
  const jobPostings = await JobPosting.create([
    { collegeId: CID, placementSeasonId: placementSeason2025._id, companyId: companies[0]._id, role: 'Associate Software Engineer', description: 'Development and testing of enterprise applications', packageLpa: 7, eligibilityCriteria: { minCGPA: 6.0, allowedBranches: ['CSE', 'ECE', 'EEE'], noActiveBacklogs: true }, registrationDeadline: new Date('2025-03-25'), maxPositions: 15, status: 'open' },
    { collegeId: CID, placementSeasonId: placementSeason2025._id, companyId: companies[2]._id, role: 'Software Development Engineer', description: 'Full-stack development on Google Cloud products', packageLpa: 25, eligibilityCriteria: { minCGPA: 8.0, allowedBranches: ['CSE'], noActiveBacklogs: true }, registrationDeadline: new Date('2025-04-10'), maxPositions: 3, status: 'open' },
    { collegeId: CID, placementSeasonId: placementSeason2025._id, companyId: companies[3]._id, role: 'SDE-1', description: 'Backend development for Amazon services', packageLpa: 18, eligibilityCriteria: { minCGPA: 7.5, allowedBranches: ['CSE', 'ECE'], noActiveBacklogs: true }, registrationDeadline: new Date('2025-04-05'), maxPositions: 5, status: 'open' },
    { collegeId: CID, placementSeasonId: placementSeason2025._id, companyId: companies[4]._id, role: 'Project Engineer', description: 'Software development in healthcare domain', packageLpa: 5.5, eligibilityCriteria: { minCGPA: 5.5, noActiveBacklogs: true }, registrationDeadline: new Date('2025-03-30'), maxPositions: 20, status: 'open' },
  ]);
  console.log('Job Postings created');

  // --- Internship Postings ---
  const internships = await InternshipPosting.create([
    { collegeId: CID, companyId: companies[0]._id, title: 'TCS Summer Internship - Software Development', description: '8-week summer internship in Java/Spring Boot', stipend: 15000, durationWeeks: 8, startDate: new Date('2025-05-15'), lastDateToApply: new Date('2025-04-15'), status: 'open' },
    { collegeId: CID, companyId: companies[3]._id, title: 'Amazon SDE Internship', description: '12-week internship in cloud computing', stipend: 60000, durationWeeks: 12, startDate: new Date('2025-06-01'), lastDateToApply: new Date('2025-04-20'), status: 'open' },
    { collegeId: CID, companyId: companies[1]._id, title: 'Infosys InStep Internship', description: 'Research and development internship', stipend: 25000, durationWeeks: 10, startDate: new Date('2025-05-20'), lastDateToApply: new Date('2025-04-10'), status: 'open' },
  ]);
  console.log('Internship Postings created');

  // --- Placement Trainings ---
  const placementTrainings = await PlacementTraining.create([
    { collegeId: CID, title: 'Aptitude Training - Quantitative & Logical', type: 'aptitude', trainer: 'TIME Institute', startDate: new Date('2025-01-10'), endDate: new Date('2025-02-28'), status: 'completed' },
    { collegeId: CID, title: 'Communication Skills & GD Practice', type: 'soft_skills', trainer: 'British Council', startDate: new Date('2025-03-01'), endDate: new Date('2025-03-15'), status: 'completed' },
    { collegeId: CID, title: 'Resume Building Workshop', type: 'resume', trainer: 'Placement Cell', startDate: new Date('2025-02-15'), endDate: new Date('2025-02-15'), status: 'completed' },
  ]);
  console.log('Placement Trainings created');

  // --- Event Registrations ---
  await EventRegistration.create([
    { collegeId: CID, eventId: events[0]._id, participantId: persons[0]._id, participantType: 'student', teamName: 'Team Alpha', status: 'winner' },
    { collegeId: CID, eventId: events[0]._id, participantId: persons[7]._id, participantType: 'student', teamName: 'Team Beta', status: 'attended' },
    { collegeId: CID, eventId: events[2]._id, participantId: persons[0]._id, participantType: 'student', status: 'attended' },
    { collegeId: CID, eventId: events[2]._id, participantId: persons[4]._id, participantType: 'student', status: 'attended' },
  ]);
  console.log('Event Registrations created');

  // --- Sports Team Members ---
  await SportsTeamMember.create([
    { collegeId: CID, teamId: sportsTeams[0]._id, studentId: students[6]._id, position: 'Captain / All-rounder', joinedDate: new Date('2024-08-15') },
    { collegeId: CID, teamId: sportsTeams[0]._id, studentId: students[0]._id, position: 'Batsman', joinedDate: new Date('2024-08-15') },
    { collegeId: CID, teamId: sportsTeams[0]._id, studentId: students[2]._id, position: 'Bowler', joinedDate: new Date('2024-08-15') },
    { collegeId: CID, teamId: sportsTeams[1]._id, studentId: students[5]._id, position: 'Captain / Singles', joinedDate: new Date('2024-08-15') },
  ]);
  console.log('Sports Team Members created');

  // --- NSS Participants ---
  await NSSParticipant.create([
    { collegeId: CID, activityId: nssActivities[0]._id, studentId: students[0]._id, hoursContributed: 4, certificateIssued: true },
    { collegeId: CID, activityId: nssActivities[0]._id, studentId: students[1]._id, hoursContributed: 4, certificateIssued: true },
    { collegeId: CID, activityId: nssActivities[0]._id, studentId: students[5]._id, hoursContributed: 4, certificateIssued: true },
    { collegeId: CID, activityId: nssActivities[1]._id, studentId: students[3]._id, hoursContributed: 8, certificateIssued: false },
    { collegeId: CID, activityId: nssActivities[1]._id, studentId: students[7]._id, hoursContributed: 8, certificateIssued: false },
  ]);
  console.log('NSS Participants created');

  // --- Student Projects ---
  await StudentProject.create([
    { collegeId: CID, title: 'AI-Based Attendance System using Face Recognition', type: 'major_project', teamMembers: [students[0]._id, students[7]._id], guideId: faculties[0]._id, semester: 7, description: 'Automated attendance marking using deep learning face recognition', technologies: ['Python', 'TensorFlow', 'OpenCV', 'Flask'], repoUrl: 'https://github.com/juvion/face-attendance', status: 'in_progress' },
    { collegeId: CID, title: 'IoT-Based Smart Irrigation System', type: 'mini_project', teamMembers: [students[2]._id, students[4]._id], guideId: faculties[1]._id, semester: 6, description: 'Automated irrigation using soil moisture sensors and ESP32', technologies: ['Arduino', 'ESP32', 'MQTT', 'React'], status: 'completed', grade: 'A' },
    { collegeId: CID, title: 'Campus ERP Mobile App', type: 'industry_project', teamMembers: [students[0]._id, students[3]._id, students[7]._id], guideId: faculties[3]._id, semester: 7, description: 'React Native mobile app for campus ERP access', technologies: ['React Native', 'Node.js', 'MongoDB'], status: 'in_progress' },
  ]);
  console.log('Student Projects created');

  // --- Community Projects ---
  await CommunityProject.create([
    { collegeId: CID, title: 'Digital Literacy for Rural Women', description: 'Teaching basic computer skills and internet usage to women in Shamirpet village', leadStudentId: students[5]._id, facultyMentorId: faculties[5]._id, startDate: new Date('2025-02-01'), endDate: new Date('2025-04-30'), beneficiaries: '50 women from Shamirpet village', status: 'ongoing' },
    { collegeId: CID, title: 'Clean Water Awareness Campaign', description: 'Awareness program on water purification and hygiene in nearby government schools', leadStudentId: students[3]._id, facultyMentorId: faculties[2]._id, startDate: new Date('2025-01-15'), endDate: new Date('2025-02-28'), beneficiaries: '200 school students', status: 'completed' },
  ]);
  console.log('Community Projects created');

  // --- Asset Allocations ---
  await AssetAllocation.create([
    { collegeId: CID, assetId: assets[1]._id, allocatedTo: persons[10]._id, allocatedDate: new Date('2024-07-15'), condition: 'good', status: 'allocated' },
    { collegeId: CID, assetId: assets[2]._id, allocatedTo: persons[11]._id, allocatedDate: new Date('2022-07-01'), condition: 'good', status: 'allocated' },
    { collegeId: CID, assetId: assets[4]._id, allocatedTo: persons[24]._id, allocatedDate: new Date('2022-01-20'), condition: 'fair', status: 'allocated' },
  ]);
  console.log('Asset Allocations created');

  // --- Maintenance Requests ---
  await MaintenanceRequest.create([
    { collegeId: CID, requestedBy: persons[10]._id, category: 'electrical', location: 'CSE Lab - Room MB-201', description: 'Two tube lights not working in lab area', priority: 'medium', assignedTo: staffMembers[0]._id, status: 'in_progress' },
    { collegeId: CID, requestedBy: persons[1]._id, category: 'plumbing', location: 'Girls Hostel - 2nd Floor Bathroom', description: 'Water leaking from shower pipe', priority: 'high', status: 'open' },
    { collegeId: CID, requestedBy: persons[14]._id, category: 'it', location: 'MECH HOD Room', description: 'Desktop not booting - shows blue screen', priority: 'medium', status: 'assigned' },
  ]);
  console.log('Maintenance Requests created');

  // --- Maintenance Schedules ---
  await MaintenanceSchedule.create([
    { collegeId: CID, assetId: assets[0]._id, facilityName: 'Computer Lab Desktops', type: 'preventive', frequency: 'quarterly', lastDoneDate: new Date('2025-01-15'), nextDueDate: new Date('2025-04-15'), assignedTeam: 'IT Maintenance Team', status: 'scheduled' },
    { collegeId: CID, facilityName: 'DG Set - Main Block', type: 'preventive', frequency: 'monthly', lastDoneDate: new Date('2025-02-15'), nextDueDate: new Date('2025-03-15'), assignedTeam: 'Electrical Team', status: 'overdue' },
    { collegeId: CID, facilityName: 'Elevator - Main Block', type: 'preventive', frequency: 'quarterly', lastDoneDate: new Date('2025-01-01'), nextDueDate: new Date('2025-04-01'), assignedTeam: 'KONE Service', status: 'scheduled' },
  ]);
  console.log('Maintenance Schedules created');

  // --- Purchase Orders ---
  await PurchaseOrder.create([
    { collegeId: CID, poNumber: 'PO-2025-001', vendorId: vendors[0]._id, items: [
      { description: 'A4 Paper Ream (500 sheets)', quantity: 100, unitPrice: 250, totalPrice: 25000 },
      { description: 'Whiteboard Marker (Black)', quantity: 200, unitPrice: 30, totalPrice: 6000 },
    ], totalAmount: 31000, requestedBy: persons[17]._id, approvedBy: persons[24]._id, orderDate: new Date('2025-02-01'), expectedDelivery: new Date('2025-02-10'), status: 'delivered' },
    { collegeId: CID, poNumber: 'PO-2025-002', vendorId: vendors[1]._id, items: [
      { description: 'HP ProDesk 400 G9 Desktop', quantity: 5, unitPrice: 55000, totalPrice: 275000 },
    ], totalAmount: 275000, requestedBy: persons[10]._id, approvedBy: persons[24]._id, orderDate: new Date('2025-03-01'), expectedDelivery: new Date('2025-03-20'), status: 'ordered' },
    { collegeId: CID, poNumber: 'PO-2025-003', vendorId: vendors[2]._id, items: [
      { description: 'Catering - Workshop Event (100 pax)', quantity: 1, unitPrice: 25000, totalPrice: 25000 },
    ], totalAmount: 25000, requestedBy: persons[11]._id, orderDate: new Date('2025-03-20'), status: 'submitted' },
  ]);
  console.log('Purchase Orders created');

  // --- Stock Transactions ---
  await StockTransaction.create([
    { collegeId: CID, stockItemId: stockItems[0]._id, type: 'in', quantity: 100, doneBy: persons[17]._id, reference: 'PO-2025-001', remarks: 'Received from Hyderabad Office Supplies' },
    { collegeId: CID, stockItemId: stockItems[0]._id, type: 'out', quantity: 20, doneBy: persons[17]._id, remarks: 'Issued to CSE department' },
    { collegeId: CID, stockItemId: stockItems[1]._id, type: 'in', quantity: 200, doneBy: persons[17]._id, reference: 'PO-2025-001' },
    { collegeId: CID, stockItemId: stockItems[2]._id, type: 'out', quantity: 50, doneBy: persons[16]._id, remarks: 'Used for network lab setup' },
  ]);
  console.log('Stock Transactions created');

  // --- Book Issues ---
  const bookIssues = await BookIssue.create([
    { collegeId: CID, bookId: books[0]._id, issuedTo: persons[0]._id, issuedDate: new Date('2025-02-20'), dueDate: new Date('2025-03-20'), status: 'issued' },
    { collegeId: CID, bookId: books[2]._id, issuedTo: persons[2]._id, issuedDate: new Date('2025-03-01'), dueDate: new Date('2025-03-31'), status: 'issued' },
    { collegeId: CID, bookId: books[1]._id, issuedTo: persons[10]._id, issuedDate: new Date('2025-01-15'), dueDate: new Date('2025-04-15'), status: 'issued' },
    { collegeId: CID, bookId: books[3]._id, issuedTo: persons[2]._id, issuedDate: new Date('2025-02-10'), dueDate: new Date('2025-03-10'), returnedDate: new Date('2025-03-12'), fineAmount: 20, status: 'returned' },
  ]);
  console.log('Book Issues created');

  // --- Book Reservations ---
  await BookReservation.create([
    { collegeId: CID, bookId: books[0]._id, reservedBy: persons[7]._id, reservedDate: new Date('2025-03-15'), expiryDate: new Date('2025-03-25'), status: 'active' },
    { collegeId: CID, bookId: books[2]._id, reservedBy: persons[1]._id, reservedDate: new Date('2025-03-10'), expiryDate: new Date('2025-03-20'), status: 'active' },
  ]);
  console.log('Book Reservations created');

  // --- Library Fines ---
  await LibraryFine.create([
    { collegeId: CID, memberId: libraryMembers[2]._id, bookIssueId: bookIssues[3]._id, amount: 20, reason: 'overdue', paidAmount: 0, status: 'pending' },
    { collegeId: CID, memberId: libraryMembers[1]._id, bookIssueId: bookIssues[1]._id, amount: 50, reason: 'overdue', paidAmount: 50, status: 'paid' },
  ]);
  console.log('Library Fines created');

  // --- Library Gate Entries ---
  await LibraryGateEntry.create([
    { collegeId: CID, personId: persons[0]._id, entryTime: new Date('2025-03-20T09:00:00'), exitTime: new Date('2025-03-20T12:30:00') },
    { collegeId: CID, personId: persons[2]._id, entryTime: new Date('2025-03-20T14:00:00'), exitTime: new Date('2025-03-20T17:00:00') },
    { collegeId: CID, personId: persons[10]._id, entryTime: new Date('2025-03-21T10:00:00'), exitTime: new Date('2025-03-21T13:00:00') },
    { collegeId: CID, personId: persons[7]._id, entryTime: new Date('2025-03-21T15:00:00') },
  ]);
  console.log('Library Gate Entries created');

  // --- E-Resource Access ---
  await EResourceAccess.create([
    { collegeId: CID, eResourceId: eResources[0]._id, personId: persons[10]._id, accessDate: new Date('2025-03-15'), duration: 45 },
    { collegeId: CID, eResourceId: eResources[1]._id, personId: persons[0]._id, accessDate: new Date('2025-03-16'), duration: 60 },
    { collegeId: CID, eResourceId: eResources[2]._id, personId: persons[11]._id, accessDate: new Date('2025-03-17'), duration: 30 },
  ]);
  console.log('E-Resource Access created');

  // --- Crisis Alert ---
  await CrisisAlert.create([
    { collegeId: CID, reportedBy: persons[15]._id, studentId: students[3]._id, type: 'mental_health', severity: 'medium', description: 'Student showing signs of depression and anxiety. Missing classes frequently.', status: 'in_progress', assignedTo: persons[15]._id },
  ]);
  console.log('Crisis Alerts created');

  // --- Anti-Ragging Complaint ---
  await AntiRaggingComplaint.create([
    { collegeId: CID, isAnonymous: true, accusedIds: [students[6]._id], description: 'Senior students forcing juniors to run errands in hostel', incidentDate: new Date('2025-02-10'), severity: 'minor', status: 'action_taken', committeeRemarks: 'Investigated. Verbal warning issued to accused.', actionTaken: 'Warning letter placed in record. Counseling mandated.' },
  ]);
  console.log('Anti-Ragging Complaints created');

  // --- Student Grievances ---
  await StudentGrievance.create([
    { collegeId: CID, studentId: students[1]._id, category: 'mess', subject: 'Poor quality of dinner', description: 'The dinner quality has deteriorated significantly in the last 2 weeks. Cold food being served.', priority: 'medium', status: 'in_progress', assignedTo: persons[15]._id },
    { collegeId: CID, studentId: students[5]._id, category: 'transport', subject: 'Bus frequently late', description: 'Route R02 bus is late by 20-30 minutes almost daily for the past month.', priority: 'high', status: 'open' },
    { collegeId: CID, studentId: students[0]._id, category: 'infrastructure', subject: 'WiFi issues in hostel', description: 'WiFi connectivity in Boys Hostel Block A is very poor on 2nd floor.', priority: 'medium', status: 'resolved', resolution: 'Additional WiFi access point installed on 2nd floor', resolvedAt: new Date('2025-03-10') },
  ]);
  console.log('Student Grievances created');

  // --- Insurance Claims ---
  await InsuranceClaim.create([
    { collegeId: CID, personId: persons[3]._id, insuranceProvider: 'United India Insurance', policyNumber: 'INS-STU-2024-001', claimAmount: 15000, reason: 'Sports injury - ankle fracture during inter-college tournament', claimDate: new Date('2025-01-20'), status: 'approved', settledAmount: 12000 },
    { collegeId: CID, personId: persons[0]._id, insuranceProvider: 'United India Insurance', policyNumber: 'INS-STU-2024-001', claimAmount: 5000, reason: 'Dengue treatment - hospitalization for 3 days', claimDate: new Date('2024-10-15'), status: 'settled', settledAmount: 5000 },
  ]);
  console.log('Insurance Claims created');

  // --- Parent Meetings ---
  await ParentMeeting.create([
    { collegeId: CID, studentId: students[0]._id, parentId: parents[0]._id, facultyId: faculties[0]._id, scheduledDate: new Date('2025-03-22T10:00:00'), agenda: 'Mid-semester academic performance review', notes: 'Student performing well. Discussed career plans.', status: 'completed' },
    { collegeId: CID, studentId: students[1]._id, parentId: parents[1]._id, facultyId: faculties[0]._id, scheduledDate: new Date('2025-03-22T11:00:00'), agenda: 'Attendance and fee payment discussion', status: 'completed' },
    { collegeId: CID, studentId: students[3]._id, parentId: parents[3]._id, facultyId: faculties[3]._id, scheduledDate: new Date('2025-04-05T10:00:00'), agenda: 'Scholarship application guidance', status: 'scheduled' },
  ]);
  console.log('Parent Meetings created');

  // --- Scholarship Allocations ---
  await ScholarshipAllocation.create([
    { collegeId: CID, scholarshipId: scholarships[0]._id, studentId: students[3]._id, academicYearId: ay2024._id, amount: 50000, status: 'disbursed', disbursedDate: new Date('2024-12-15') },
    { collegeId: CID, scholarshipId: scholarships[1]._id, studentId: students[0]._id, academicYearId: ay2024._id, amount: 75000, status: 'approved' },
    { collegeId: CID, scholarshipId: scholarships[1]._id, studentId: students[4]._id, academicYearId: ay2024._id, amount: 75000, status: 'approved' },
  ]);
  console.log('Scholarship Allocations created');

  // --- Concessions ---
  await Concession.create([
    { collegeId: CID, studentId: students[3]._id, type: 'financial_hardship', reason: 'Family income below poverty line, father is daily wage worker', approvedBy: persons[24]._id, academicYearId: ay2024._id, percentage: 25, status: 'approved' },
    { collegeId: CID, studentId: students[5]._id, type: 'sports', reason: 'State-level badminton player representing college', approvedBy: persons[24]._id, academicYearId: ay2024._id, flatAmount: 20000, status: 'approved' },
  ]);
  console.log('Concessions created');

  // --- Visitor Entries ---
  await VisitorEntry.create([
    { collegeId: CID, visitorName: 'Anil Kumar', phone: '9876500030', idType: 'aadhaar', idNumber: '123456789012', purpose: 'Guest lecture - AI Department', whomToMeet: 'Dr. Ramesh Iyer', department: 'CSE', inTime: new Date('2025-03-20T09:30:00'), outTime: new Date('2025-03-20T13:00:00') },
    { collegeId: CID, visitorName: 'Sunitha Devi', phone: '9876500031', idType: 'driving_license', idNumber: 'TS1234567890', purpose: 'Parent meeting', whomToMeet: 'Dr. Lakshmi Prasad', department: 'CSE', inTime: new Date('2025-03-22T10:00:00'), outTime: new Date('2025-03-22T12:00:00') },
    { collegeId: CID, visitorName: 'Rakesh Mehta (TCS)', phone: '9876500032', idType: 'pan', idNumber: 'ABCDE1234F', purpose: 'Placement drive coordination', whomToMeet: 'Placement Officer', department: 'Placement Cell', inTime: new Date('2025-04-03T08:00:00'), vehicleNumber: 'TS09CD5678' },
    { collegeId: CID, visitorName: 'Priya (Courier)', phone: '9876500033', idType: 'other', idNumber: 'COURIER-ID-456', purpose: 'Document delivery', whomToMeet: 'Admin Office', inTime: new Date('2025-03-25T11:00:00'), outTime: new Date('2025-03-25T11:15:00') },
  ]);
  console.log('Visitor Entries created');

  // --- AICTE Approval ---
  await AICTEApproval.create([
    { collegeId: CID, academicYearId: ay2024._id, applicationId: 'AICTE-1-14234567890', approvalDate: new Date('2024-04-15'), approvedIntake: [
      { programmeId: progBTech._id, branchId: brCSE._id, intake: 180 },
      { programmeId: progBTech._id, branchId: brECE._id, intake: 120 },
      { programmeId: progBTech._id, branchId: brEEE._id, intake: 60 },
      { programmeId: progBTech._id, branchId: brMECH._id, intake: 120 },
      { programmeId: progBTech._id, branchId: brCIVIL._id, intake: 60 },
    ], eoa: 'EOA-2024-25-JUVION', status: 'approved' },
  ]);
  console.log('AICTE Approval created');

  // --- Affiliation Status ---
  await AffiliationStatus.create([
    { collegeId: CID, universityName: 'Jawaharlal Nehru Technological University, Hyderabad', affiliationNumber: 'JNTU-HYD-AFF-2024-1234', validFrom: new Date('2024-07-01'), validTo: new Date('2025-06-30'), programmes: [progBTech._id, progMTech._id], status: 'active' },
  ]);
  console.log('Affiliation Status created');

  // --- Audit Findings ---
  await AuditFinding.create([
    { collegeId: CID, auditType: 'internal', auditorName: 'CA Ramesh Kumar', auditDate: new Date('2024-12-15'), finding: 'Some purchase orders lack proper three-quotation documentation', severity: 'minor_nc', department: 'Finance', correctionAction: 'Strengthen purchase process with mandatory 3 quotes for orders above Rs 10,000', correctionDeadline: new Date('2025-03-31'), status: 'action_taken' },
    { collegeId: CID, auditType: 'naac', auditorName: 'NAAC Peer Team', auditDate: new Date('2023-11-15'), finding: 'Student feedback system needs better digital integration', severity: 'observation', department: 'IQAC', correctionAction: 'Implemented online feedback system through campus ERP', status: 'verified' },
    { collegeId: CID, auditType: 'iso', auditorName: 'TUV SUD - ISO Auditor', auditDate: new Date('2025-01-20'), finding: 'Fire safety drill documentation incomplete for Q3', severity: 'minor_nc', department: 'Administration', correctionAction: 'Conducted drill on Feb 1, documentation completed', correctionDeadline: new Date('2025-02-28'), status: 'closed' },
  ]);
  console.log('Audit Findings created');

  // --- IQAC Report ---
  await IQACReport.create([
    { collegeId: CID, academicYearId: ay2023._id, reportType: 'aqar', data: { criterion1Score: 85, criterion2Score: 78, criterion3Score: 82, overallCGPA: 3.2, highlights: ['NBA application submitted', '15 MoUs signed', '85% placement rate'] }, submittedDate: new Date('2024-09-30'), status: 'submitted' },
  ]);
  console.log('IQAC Reports created');

  // --- Survey Responses ---
  await SurveyResponse.create([
    { collegeId: CID, surveyId: surveys[1]._id, respondentId: persons[0]._id, answers: [{ questionIndex: 0, answer: 4 }, { questionIndex: 1, answer: 3 }, { questionIndex: 2, answer: 2 }, { questionIndex: 3, answer: 3 }], submittedAt: new Date('2025-03-15') },
    { collegeId: CID, surveyId: surveys[1]._id, respondentId: persons[1]._id, answers: [{ questionIndex: 0, answer: 3 }, { questionIndex: 1, answer: 2 }, { questionIndex: 2, answer: 3 }, { questionIndex: 3, answer: 3 }], submittedAt: new Date('2025-03-16') },
    { collegeId: CID, surveyId: surveys[1]._id, respondentId: persons[2]._id, answers: [{ questionIndex: 0, answer: 4 }, { questionIndex: 1, answer: 4 }, { questionIndex: 2, answer: 4 }, { questionIndex: 3, answer: 4 }], submittedAt: new Date('2025-03-17') },
  ]);
  console.log('Survey Responses created');

  // ========================================================================
  // TIER 6 - Depends on Tier 5
  // ========================================================================

  // --- Placement Registrations ---
  await PlacementRegistration.create([
    { collegeId: CID, jobPostingId: jobPostings[0]._id, studentId: students[0]._id, status: 'registered', appliedAt: new Date('2025-03-20') },
    { collegeId: CID, jobPostingId: jobPostings[0]._id, studentId: students[7]._id, status: 'registered', appliedAt: new Date('2025-03-21') },
    { collegeId: CID, jobPostingId: jobPostings[1]._id, studentId: students[0]._id, status: 'registered', appliedAt: new Date('2025-03-25') },
    { collegeId: CID, jobPostingId: jobPostings[2]._id, studentId: students[0]._id, status: 'shortlisted', appliedAt: new Date('2025-03-22') },
    { collegeId: CID, jobPostingId: jobPostings[3]._id, studentId: students[2]._id, status: 'registered', appliedAt: new Date('2025-03-23') },
  ]);
  console.log('Placement Registrations created');

  // --- Placement Rounds ---
  const rounds = await PlacementRound.create([
    { collegeId: CID, jobPostingId: jobPostings[0]._id, roundNumber: 1, name: 'Online Aptitude Test', type: 'aptitude', date: new Date('2025-04-05'), venue: 'Computer Lab', status: 'scheduled' },
    { collegeId: CID, jobPostingId: jobPostings[0]._id, roundNumber: 2, name: 'Technical Interview', type: 'technical', date: new Date('2025-04-06'), venue: 'Conference Room', status: 'scheduled' },
    { collegeId: CID, jobPostingId: jobPostings[2]._id, roundNumber: 1, name: 'Online Coding Test', type: 'coding', date: new Date('2025-04-10'), venue: 'Online', status: 'scheduled' },
  ]);
  console.log('Placement Rounds created');

  // --- Internship Applications ---
  await InternshipApplication.create([
    { collegeId: CID, internshipId: internships[0]._id, studentId: students[3]._id, status: 'applied', appliedAt: new Date('2025-03-20') },
    { collegeId: CID, internshipId: internships[1]._id, studentId: students[0]._id, status: 'shortlisted', appliedAt: new Date('2025-03-18') },
    { collegeId: CID, internshipId: internships[2]._id, studentId: students[7]._id, status: 'applied', appliedAt: new Date('2025-03-22') },
  ]);
  console.log('Internship Applications created');

  // --- Training Attendance ---
  await TrainingAttendance.create([
    { collegeId: CID, trainingId: placementTrainings[0]._id, studentId: students[0]._id, attended: true },
    { collegeId: CID, trainingId: placementTrainings[0]._id, studentId: students[7]._id, attended: true },
    { collegeId: CID, trainingId: placementTrainings[0]._id, studentId: students[2]._id, attended: false },
    { collegeId: CID, trainingId: placementTrainings[1]._id, studentId: students[0]._id, attended: true },
  ]);
  console.log('Training Attendance created');

  // --- Mock Interviews ---
  await MockInterview.create([
    { collegeId: CID, studentId: students[0]._id, interviewerId: persons[10]._id, date: new Date('2025-03-01'), type: 'technical', rating: 4, feedback: 'Strong in DSA. Needs improvement in system design.' },
    { collegeId: CID, studentId: students[7]._id, interviewerId: persons[10]._id, date: new Date('2025-03-02'), type: 'mixed', rating: 3, feedback: 'Good communication. Technical fundamentals need strengthening.' },
    { collegeId: CID, studentId: students[2]._id, interviewerId: persons[11]._id, date: new Date('2025-03-05'), type: 'hr', rating: 4, feedback: 'Confident and articulate. Good body language.' },
  ]);
  console.log('Mock Interviews created');

  // --- Higher Studies Applications ---
  await HigherStudiesApplication.create([
    { collegeId: CID, studentId: students[0]._id, examType: 'gre', examScore: 325, targetUniversity: 'Carnegie Mellon University', country: 'USA', programmeApplied: 'MS in Computer Science', status: 'applied' },
    { collegeId: CID, studentId: students[2]._id, examType: 'gate', examScore: 650, targetUniversity: 'IIT Bombay', country: 'India', programmeApplied: 'M.Tech in Communication Systems', status: 'preparing' },
    { collegeId: CID, studentId: students[4]._id, examType: 'gate', examScore: 700, targetUniversity: 'IIT Hyderabad', country: 'India', programmeApplied: 'M.Tech in Embedded Systems', status: 'admitted' },
  ]);
  console.log('Higher Studies Applications created');

  // --- Entrepreneur Profiles ---
  await EntrepreneurProfile.create([
    { collegeId: CID, studentId: students[4]._id, ventureIdea: 'AgriSense - IoT-based precision farming platform for small farmers', stage: 'prototype', mentorId: faculties[1]._id, incubationStatus: 'accepted' },
    { collegeId: CID, studentId: students[0]._id, ventureIdea: 'EduConnect - AI tutor for competitive exam preparation', stage: 'ideation', mentorId: faculties[0]._id, incubationStatus: 'applied' },
  ]);
  console.log('Entrepreneur Profiles created');

  // --- Alumni Profiles ---
  await AlumniProfile.create([
    { collegeId: CID, personId: persons[8]._id, graduationYear: 2024, currentCompany: 'Infosys Limited', currentDesignation: 'Systems Engineer', location: 'Pune', linkedinUrl: 'https://linkedin.com/in/vikramsingh', willingToMentor: true },
    { collegeId: CID, personId: persons[9]._id, graduationYear: 2024, currentCompany: 'TCS', currentDesignation: 'Associate Software Engineer', location: 'Hyderabad', linkedinUrl: 'https://linkedin.com/in/meerajoshi', willingToMentor: false },
    { collegeId: CID, personId: persons[24]._id, graduationYear: 1985, currentCompany: 'Juvion Institute of Technology', currentDesignation: 'Principal', location: 'Hyderabad', willingToMentor: true },
  ]);
  console.log('Alumni Profiles created');

  // --- Alumni Events ---
  await AlumniEvent.create([
    { collegeId: CID, title: 'Alumni Reunion 2025 - Silver Jubilee Batch', eventType: 'reunion', date: new Date('2025-05-15'), venue: 'Campus Auditorium', description: 'Reunion of 2000 batch alumni', organizerId: persons[24]._id, status: 'planned' },
    { collegeId: CID, title: 'Alumni Mentoring Session - Career in AI', eventType: 'mentoring', date: new Date('2025-04-20'), venue: 'Online - Zoom', description: 'Alumni from Google, Amazon sharing career insights', organizerId: persons[10]._id, status: 'planned' },
  ]);
  console.log('Alumni Events created');

  // ========================================================================
  // TIER 7 - Depends on Tier 6
  // ========================================================================

  // --- Round Results ---
  await RoundResult.create([
    { collegeId: CID, roundId: rounds[0]._id, studentId: students[0]._id, result: 'pass', score: 85, remarks: 'Strong performance in quantitative section' },
    { collegeId: CID, roundId: rounds[0]._id, studentId: students[7]._id, result: 'pass', score: 72 },
    { collegeId: CID, roundId: rounds[0]._id, studentId: students[2]._id, result: 'fail', score: 45, remarks: 'Below cutoff in logical reasoning' },
    { collegeId: CID, roundId: rounds[2]._id, studentId: students[0]._id, result: 'pass', score: 92, remarks: 'Excellent coding skills' },
  ]);
  console.log('Round Results created');

  // --- Placement Offers ---
  await PlacementOffer.create([
    { collegeId: CID, jobPostingId: jobPostings[0]._id, studentId: students[8]._id, companyId: companies[0]._id, packageLpa: 7, offerDate: new Date('2024-03-15'), joiningDate: new Date('2024-07-15'), status: 'accepted' },
    { collegeId: CID, jobPostingId: jobPostings[0]._id, studentId: students[9]._id, companyId: companies[0]._id, packageLpa: 7, offerDate: new Date('2024-03-15'), joiningDate: new Date('2024-07-15'), status: 'accepted' },
    { collegeId: CID, jobPostingId: jobPostings[2]._id, studentId: students[0]._id, companyId: companies[3]._id, packageLpa: 18, offerDate: new Date('2025-04-20'), status: 'offered' },
  ]);
  console.log('Placement Offers created');

  // --- Placement Report ---
  await PlacementReport.create([
    { collegeId: CID, placementSeasonId: placementSeason2024._id, reportType: 'company_wise', data: {
      totalCompanies: 45,
      totalOffers: 320,
      highestPackageLPA: 24,
      averagePackageLPA: 6.5,
      branchWise: { CSE: { eligible: 160, placed: 140 }, ECE: { eligible: 100, placed: 78 }, MECH: { eligible: 100, placed: 65 } },
    }, generatedAt: new Date('2024-06-30') },
  ]);
  console.log('Placement Reports created');

  // ========================================================================
  // JUVI MODULE (independent)
  // ========================================================================

  // --- Juvi Persona Configs ---
  await JuviPersonaConfig.create([
    { collegeId: CID, personaType: 'student', displayName: 'Juvi Student Assistant', systemPrompt: 'You are Juvi, a helpful AI assistant for students at Juvion Institute of Technology. Help with academics, fee queries, placement info, and campus services.', availableModules: ['academic', 'finance', 'placement', 'welfare', 'library'], availableActions: ['query', 'navigate', 'report'], maxTokensPerResponse: 2000, isActive: true },
    { collegeId: CID, personaType: 'faculty', displayName: 'Juvi Faculty Assistant', systemPrompt: 'You are Juvi, an AI assistant for faculty at Juvion Institute. Help with student management, attendance, course planning, and research support.', availableModules: ['academic', 'hr', 'student-dev', 'compliance'], availableActions: ['query', 'create', 'update', 'report'], maxTokensPerResponse: 3000, isActive: true },
    { collegeId: CID, personaType: 'admin', displayName: 'Juvi Admin Assistant', systemPrompt: 'You are Juvi, an AI assistant for administrators at Juvion Institute. Full access to all modules for management and reporting.', availableModules: ['academic', 'finance', 'hr', 'placement', 'welfare', 'campus', 'facilities', 'library', 'compliance', 'governance', 'communication'], availableActions: ['query', 'create', 'update', 'delete', 'navigate', 'report'], maxTokensPerResponse: 4000, isActive: true },
    { collegeId: CID, personaType: 'parent', displayName: 'Juvi Parent Portal', systemPrompt: 'You are Juvi, an AI assistant for parents at Juvion Institute. Help with student performance, attendance, fee status, and communication with faculty.', availableModules: ['academic', 'finance', 'welfare'], availableActions: ['query', 'navigate'], maxTokensPerResponse: 1500, isActive: true },
  ]);
  console.log('Juvi Persona Configs created');

  // --- Juvi Knowledge Base ---
  await JuviKnowledgeBase.create([
    { collegeId: CID, category: 'admissions', question: 'What is the admission process for B.Tech?', answer: 'B.Tech admissions are through TS EAMCET counseling (Convener quota) and management quota. Eligible candidates need to have passed Intermediate/10+2 with MPC stream with minimum 45% marks.', tags: ['admission', 'btech', 'eamcet'], source: 'Admissions Handbook 2024-25', usageCount: 45 },
    { collegeId: CID, category: 'fees', question: 'What are the tuition fees for B.Tech CSE?', answer: 'B.Tech CSE tuition fee is Rs 1,50,000 per year for Convener quota and Rs 2,50,000 per year for Management quota. Additional fees include Development Fee (Rs 25,000), Lab Fee (Rs 15,000), and Library Fee (Rs 5,000).', tags: ['fees', 'cse', 'tuition'], source: 'Fee Structure 2024-25', usageCount: 120 },
    { collegeId: CID, category: 'placements', question: 'What is the average placement package?', answer: 'The average placement package for the 2023-24 batch was 6.5 LPA. The highest package was 24 LPA offered by Google. Over 85% of eligible students were placed.', tags: ['placement', 'package', 'salary'], source: 'Placement Report 2023-24', usageCount: 200 },
    { collegeId: CID, category: 'hostel', question: 'How to apply for hostel accommodation?', answer: 'Hostel applications can be submitted through the campus ERP portal during admission or at the start of each academic year. Allocation is based on distance from campus and availability.', tags: ['hostel', 'accommodation', 'apply'], source: 'Hostel Handbook', usageCount: 80 },
  ]);
  console.log('Juvi Knowledge Base created');

  // --- Juvi Conversations ---
  const juviConvos = await JuviConversation.create([
    { collegeId: CID, userId: persons[0]._id, personaType: 'student', startedAt: new Date('2025-03-20T10:00:00'), lastMessageAt: new Date('2025-03-20T10:05:00'), messageCount: 4, status: 'active' },
    { collegeId: CID, userId: persons[10]._id, personaType: 'faculty', startedAt: new Date('2025-03-19T14:00:00'), lastMessageAt: new Date('2025-03-19T14:10:00'), messageCount: 6, status: 'closed' },
    { collegeId: CID, userId: persons[19]._id, personaType: 'parent', startedAt: new Date('2025-03-21T09:00:00'), lastMessageAt: new Date('2025-03-21T09:03:00'), messageCount: 3, status: 'active' },
  ]);
  console.log('Juvi Conversations created');

  // --- Juvi Messages ---
  const juviMessages = await JuviMessage.create([
    { collegeId: CID, conversationId: juviConvos[0]._id, role: 'user', content: 'What is my current fee balance?', intent: 'fee_query', tokens: 12 },
    { collegeId: CID, conversationId: juviConvos[0]._id, role: 'assistant', content: 'Your current fee balance for AY 2024-25 is Rs 0. All fees have been paid. Here is a summary:\n- Tuition Fee: Rs 1,50,000 (Paid)\n- Development Fee: Rs 25,000 (Paid)\n- Total Paid: Rs 1,75,000', intent: 'fee_query', toolCalls: [{ tool: 'queryFeeBalance', params: { studentId: students[0]._id.toString() }, result: { balance: 0, totalPaid: 175000 } }], tokens: 85 },
    { collegeId: CID, conversationId: juviConvos[0]._id, role: 'user', content: 'What companies are visiting for placements?', intent: 'placement_query', tokens: 10 },
    { collegeId: CID, conversationId: juviConvos[0]._id, role: 'assistant', content: 'The following companies have open placement drives for AY 2024-25:\n1. TCS - Associate Software Engineer (7 LPA) - Deadline: Mar 25\n2. Google - SDE (25 LPA) - Deadline: Apr 10\n3. Amazon - SDE-1 (18 LPA) - Deadline: Apr 5\n4. Wipro - Project Engineer (5.5 LPA) - Deadline: Mar 30', intent: 'placement_query', tokens: 120 },
    { collegeId: CID, conversationId: juviConvos[1]._id, role: 'user', content: 'Show me the attendance summary for CSE-A section', intent: 'attendance_query', tokens: 15 },
    { collegeId: CID, conversationId: juviConvos[1]._id, role: 'assistant', content: 'CSE-A Section (Batch 2022-26, Sem 5) Attendance Summary:\n- Total Students: 55\n- Average Attendance: 82%\n- Students below 75%: 5 students\n- Highest Attendance: 98% (Aarav Sharma)', intent: 'attendance_query', tokens: 95 },
  ]);
  console.log('Juvi Messages created');

  // --- Juvi Actions ---
  await JuviAction.create([
    { collegeId: CID, conversationId: juviConvos[0]._id, actionType: 'query', module: 'finance', entity: 'StudentFeeAccount', operation: 'findByStudentId', payload: { studentId: students[0]._id.toString() }, result: { balance: 0, totalPaid: 175000 }, status: 'executed', executedAt: new Date('2025-03-20T10:01:00') },
    { collegeId: CID, conversationId: juviConvos[0]._id, actionType: 'query', module: 'placement', entity: 'JobPosting', operation: 'findActive', payload: { status: 'open' }, result: { count: 4 }, status: 'executed', executedAt: new Date('2025-03-20T10:04:00') },
    { collegeId: CID, conversationId: juviConvos[1]._id, actionType: 'report', module: 'academic', entity: 'AttendanceRecord', operation: 'sectionSummary', payload: { sectionId: sections[0]._id.toString() }, result: { averageAttendance: 82, belowThreshold: 5 }, status: 'executed', executedAt: new Date('2025-03-19T14:02:00') },
  ]);
  console.log('Juvi Actions created');

  // --- Juvi Insights ---
  await JuviInsight.create([
    { collegeId: CID, type: 'alert', module: 'finance', title: '15 Students Have Overdue Fees', description: '15 students in the current semester have overdue fee balances totaling Rs 18,50,000.', data: { overdueCount: 15, totalOverdue: 1850000, highestOverdue: 205000 }, severity: 'warning', targetPersonas: ['admin', 'faculty'], isActionable: true, actionSuggestion: 'Send fee reminders and schedule parent meetings for top defaulters', generatedAt: new Date('2025-03-20'), status: 'new' },
    { collegeId: CID, type: 'trend', module: 'placement', title: 'Placement Rate Trending Upward', description: 'Current placement rate is 72%, up 5% from last month. 45 companies registered for this season.', data: { currentRate: 72, lastMonthRate: 67, companiesRegistered: 45, offersGiven: 230 }, severity: 'info', targetPersonas: ['admin', 'faculty'], isActionable: false, generatedAt: new Date('2025-03-18'), status: 'seen' },
    { collegeId: CID, type: 'anomaly', module: 'academic', title: 'Unusual Drop in CS502 Attendance', description: 'Machine Learning course (CS502) attendance dropped from 88% to 65% in the last 2 weeks.', data: { courseCode: 'CS502', previousAvg: 88, currentAvg: 65, dropPercent: 23 }, severity: 'warning', targetPersonas: ['faculty', 'admin'], isActionable: true, actionSuggestion: 'Faculty advisor should investigate and conduct a student interaction session', generatedAt: new Date('2025-03-19'), status: 'new' },
  ]);
  console.log('Juvi Insights created');

  // --- Juvi Feedback ---
  await JuviFeedback.create([
    { collegeId: CID, messageId: juviMessages[1]._id, userId: persons[0]._id, rating: 1, feedback: 'Accurate and fast response!' },
    { collegeId: CID, messageId: juviMessages[3]._id, userId: persons[0]._id, rating: 1 },
  ]);
  console.log('Juvi Feedback created');

  // --- Juvi Usage Metrics ---
  await JuviUsageMetric.create([
    { collegeId: CID, date: new Date('2025-03-19'), personaType: 'student', totalConversations: 45, totalMessages: 180, totalTokens: 25000, avgResponseTime: 1.2, satisfactionScore: 4.2, topIntents: [{ intent: 'fee_query', count: 25 }, { intent: 'placement_query', count: 18 }, { intent: 'attendance_query', count: 12 }] },
    { collegeId: CID, date: new Date('2025-03-19'), personaType: 'faculty', totalConversations: 12, totalMessages: 48, totalTokens: 8500, avgResponseTime: 1.5, satisfactionScore: 4.0, topIntents: [{ intent: 'attendance_query', count: 8 }, { intent: 'student_performance', count: 5 }] },
    { collegeId: CID, date: new Date('2025-03-20'), personaType: 'student', totalConversations: 52, totalMessages: 210, totalTokens: 29000, avgResponseTime: 1.1, satisfactionScore: 4.3, topIntents: [{ intent: 'fee_query', count: 30 }, { intent: 'placement_query', count: 22 }, { intent: 'hostel_query', count: 8 }] },
  ]);
  console.log('Juvi Usage Metrics created');

  // ========================================================================
  // RBAC DEFAULT POLICIES
  // ========================================================================
  // Seed default RBAC policies
  await RBACPolicy.deleteMany({ collegeId: { $exists: false } });
  await RBACPolicy.insertMany(DEFAULT_POLICIES.map((p) => ({ ...p, createdBy: 'seed' })));
  console.log(`Seeded ${DEFAULT_POLICIES.length} default RBAC policies`);

  // ========================================================================
  // DONE
  // ========================================================================
  console.log('\nSeed complete! All 150 models seeded with realistic data.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

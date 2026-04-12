# Juvion v2 – Entity Model Reference

> **Status**: DRAFT | Last updated: April 2026
>
> For full field definitions and indexes, see `architecture-spec.md` (Section 3: Entity Groups).
> This file provides quick model-to-file lookup with key fields for the most-referenced entity groups.

Total: 205 models across 16 entity groups + 4 root/workflow models

---

## Admissions (15 models)

| Model | File |
|-------|------|
| Admission | `models/admissions/Admission.ts` |
| AdmissionCancellation | `models/admissions/AdmissionCancellation.ts` |
| AdmissionOffer | `models/admissions/AdmissionOffer.ts` |
| AllotmentResult | `models/admissions/AllotmentResult.ts` |
| AllotmentRound | `models/admissions/AllotmentRound.ts` |
| Applicant | `models/admissions/Applicant.ts` |
| CounselingAllotment | `models/admissions/CounselingAllotment.ts` |
| DocumentChecklist | `models/admissions/DocumentChecklist.ts` |
| EntranceExamScore | `models/admissions/EntranceExamScore.ts` |
| FeeNegotiation | `models/admissions/FeeNegotiation.ts` |
| Inquiry | `models/admissions/Inquiry.ts` |
| LeadImportBatch | `models/admissions/LeadImportBatch.ts` |
| LeadInteraction | `models/admissions/LeadInteraction.ts` |
| SeatInventory | `models/admissions/SeatInventory.ts` |
| Waitlist | `models/admissions/Waitlist.ts` |

## People (7 models)

| Model | File | Key Fields |
|-------|------|------------|
| Person | `models/people/Person.ts` | firstName, lastName, email, phone, aadhaarNumber, dateOfBirth, gender, address, emergencyContact, photo |
| Student | `models/people/Student.ts` | personId→Person, admissionYear, programmeId, branchId, batchId, rollNumber, category, quota, regulationId, status |
| Faculty | `models/people/Faculty.ts` | personId→Person, employeeId, departmentId, designation, specialization, experience, qualifications, isMentor |
| Staff | `models/people/Staff.ts` | personId→Person, employeeId, departmentId, designation, staffType, joiningDate, status |
| Parent | `models/people/Parent.ts` | personId→Person, studentIds[], relationship, occupation, income, isFeeResponsible |
| ExternalPerson | `models/people/ExternalPerson.ts` | personId→Person, organizationId→Organization, designation, purpose, validFrom, validTo |
| Organization | `models/people/Organization.ts` | name, type, contactPerson, email, phone, address, website, partnershipType, isActive |

## Academic Structure (8 models)

| Model | File | Key Fields |
|-------|------|------------|
| Regulation | `models/academic-structure/Regulation.ts` | code, name, effectiveFromYear, effectiveToYear, totalCredits, maxYears, isActive |
| Programme | `models/academic-structure/Programme.ts` | code, name, level (UG/PG/Diploma/PhD), durationYears, regulationId |
| Branch | `models/academic-structure/Branch.ts` | code, name, programmeId, departmentId, intake |
| Department | `models/academic-structure/Department.ts` | code, name, hodId→Faculty |
| Batch | `models/academic-structure/Batch.ts` | code, name, admissionYear, programmeId, regulationId |
| Section | `models/academic-structure/Section.ts` | name, branchId, batchId, year, semester, capacity, classAdvisorId |
| AcademicYear | `models/academic-structure/AcademicYear.ts` | code, label, startDate, endDate, isCurrent |
| Semester | `models/academic-structure/Semester.ts` | academicYearId, number, year, startDate, endDate, status |

## Academic Ops (21 models)

| Model | File |
|-------|------|
| AcademicCalendar | `models/academic-ops/AcademicCalendar.ts` |
| AttendanceRecord | `models/academic-ops/AttendanceRecord.ts` |
| AttendanceSession | `models/academic-ops/AttendanceSession.ts` |
| Course | `models/academic-ops/Course.ts` |
| CourseFeedback | `models/academic-ops/CourseFeedback.ts` |
| CourseOffering | `models/academic-ops/CourseOffering.ts` |
| CourseOutcome | `models/academic-ops/CourseOutcome.ts` |
| CurriculumMap | `models/academic-ops/CurriculumMap.ts` |
| ElectiveAllocation | `models/academic-ops/ElectiveAllocation.ts` |
| Enrollment | `models/academic-ops/Enrollment.ts` |
| ExamRegistration | `models/academic-ops/ExamRegistration.ts` |
| ExamSchedule | `models/academic-ops/ExamSchedule.ts` |
| ExternalMark | `models/academic-ops/ExternalMark.ts` |
| GradeCard | `models/academic-ops/GradeCard.ts` |
| InternalAssessment | `models/academic-ops/InternalAssessment.ts` |
| InternalMark | `models/academic-ops/InternalMark.ts` |
| LessonPlan | `models/academic-ops/LessonPlan.ts` |
| ProgramOutcome | `models/academic-ops/ProgramOutcome.ts` |
| SemesterResult | `models/academic-ops/SemesterResult.ts` |
| Timetable | `models/academic-ops/Timetable.ts` |
| TimetableSlot | `models/academic-ops/TimetableSlot.ts` |

## Finance (16 models)

| Model | File |
|-------|------|
| Budget | `models/finance/Budget.ts` |
| Concession | `models/finance/Concession.ts` |
| Expense | `models/finance/Expense.ts` |
| FeeLineItem | `models/finance/FeeLineItem.ts` |
| FeeReminder | `models/finance/FeeReminder.ts` |
| FeeStructure | `models/finance/FeeStructure.ts` |
| FinancialLedger | `models/finance/FinancialLedger.ts` |
| FinancialReport | `models/finance/FinancialReport.ts` |
| FinePenalty | `models/finance/FinePenalty.ts` |
| Invoice | `models/finance/Invoice.ts` |
| Payment | `models/finance/Payment.ts` |
| PaymentGatewayLog | `models/finance/PaymentGatewayLog.ts` |
| Refund | `models/finance/Refund.ts` |
| Scholarship | `models/finance/Scholarship.ts` |
| ScholarshipAllocation | `models/finance/ScholarshipAllocation.ts` |
| StudentFeeAccount | `models/finance/StudentFeeAccount.ts` |

## Hr (19 models)

| Model | File |
|-------|------|
| Appraisal | `models/hr/Appraisal.ts` |
| Employee | `models/hr/Employee.ts` |
| EmployeeAttendance | `models/hr/EmployeeAttendance.ts` |
| ExitProcess | `models/hr/ExitProcess.ts` |
| Grievance | `models/hr/Grievance.ts` |
| JobApplication | `models/hr/JobApplication.ts` |
| LeaveApplication | `models/hr/LeaveApplication.ts` |
| LeaveBalance | `models/hr/LeaveBalance.ts` |
| LeaveType | `models/hr/LeaveType.ts` |
| OnDuty | `models/hr/OnDuty.ts` |
| PayStructure | `models/hr/PayStructure.ts` |
| Payroll | `models/hr/Payroll.ts` |
| Promotion | `models/hr/Promotion.ts` |
| Publication | `models/hr/Publication.ts` |
| Qualification | `models/hr/Qualification.ts` |
| Recruitment | `models/hr/Recruitment.ts` |
| ResearchProject | `models/hr/ResearchProject.ts` |
| Training | `models/hr/Training.ts` |
| TrainingParticipant | `models/hr/TrainingParticipant.ts` |

## Placement (17 models)

| Model | File |
|-------|------|
| AlumniEvent | `models/placement/AlumniEvent.ts` |
| AlumniProfile | `models/placement/AlumniProfile.ts` |
| Company | `models/placement/Company.ts` |
| EntrepreneurProfile | `models/placement/EntrepreneurProfile.ts` |
| HigherStudiesApplication | `models/placement/HigherStudiesApplication.ts` |
| InternshipApplication | `models/placement/InternshipApplication.ts` |
| InternshipPosting | `models/placement/InternshipPosting.ts` |
| JobPosting | `models/placement/JobPosting.ts` |
| MockInterview | `models/placement/MockInterview.ts` |
| PlacementOffer | `models/placement/PlacementOffer.ts` |
| PlacementRegistration | `models/placement/PlacementRegistration.ts` |
| PlacementReport | `models/placement/PlacementReport.ts` |
| PlacementRound | `models/placement/PlacementRound.ts` |
| PlacementSeason | `models/placement/PlacementSeason.ts` |
| PlacementTraining | `models/placement/PlacementTraining.ts` |
| RoundResult | `models/placement/RoundResult.ts` |
| TrainingAttendance | `models/placement/TrainingAttendance.ts` |

## Welfare (16 models)

| Model | File |
|-------|------|
| AntiRaggingComplaint | `models/welfare/AntiRaggingComplaint.ts` |
| CounselingSession | `models/welfare/CounselingSession.ts` |
| CrisisAlert | `models/welfare/CrisisAlert.ts` |
| HealthRecord | `models/welfare/HealthRecord.ts` |
| HostelAllocation | `models/welfare/HostelAllocation.ts` |
| HostelBlock | `models/welfare/HostelBlock.ts` |
| HostelRoom | `models/welfare/HostelRoom.ts` |
| HostelVisitorLog | `models/welfare/HostelVisitorLog.ts` |
| InsuranceClaim | `models/welfare/InsuranceClaim.ts` |
| MedicalVisit | `models/welfare/MedicalVisit.ts` |
| MessFeedback | `models/welfare/MessFeedback.ts` |
| MessMenu | `models/welfare/MessMenu.ts` |
| ParentMeeting | `models/welfare/ParentMeeting.ts` |
| StudentGrievance | `models/welfare/StudentGrievance.ts` |
| TransportAllocation | `models/welfare/TransportAllocation.ts` |
| TransportRoute | `models/welfare/TransportRoute.ts` |

## Campus (14 models)

| Model | File |
|-------|------|
| Building | `models/campus/Building.ts` |
| CCTV | `models/campus/CCTV.ts` |
| EmergencyContact | `models/campus/EmergencyContact.ts` |
| GatePass | `models/campus/GatePass.ts` |
| GreenInitiative | `models/campus/GreenInitiative.ts` |
| Lab | `models/campus/Lab.ts` |
| ParkingSlot | `models/campus/ParkingSlot.ts` |
| PowerBackup | `models/campus/PowerBackup.ts` |
| Room | `models/campus/Room.ts` |
| RoomBooking | `models/campus/RoomBooking.ts` |
| SecurityIncident | `models/campus/SecurityIncident.ts` |
| Vehicle | `models/campus/Vehicle.ts` |
| VisitorEntry | `models/campus/VisitorEntry.ts` |
| WaterSupply | `models/campus/WaterSupply.ts` |

## Facilities (14 models)

| Model | File |
|-------|------|
| Asset | `models/facilities/Asset.ts` |
| AssetAllocation | `models/facilities/AssetAllocation.ts` |
| ConstructionProject | `models/facilities/ConstructionProject.ts` |
| EnergyConsumption | `models/facilities/EnergyConsumption.ts` |
| ITAsset | `models/facilities/ITAsset.ts` |
| Insurance | `models/facilities/Insurance.ts` |
| MaintenanceRequest | `models/facilities/MaintenanceRequest.ts` |
| MaintenanceSchedule | `models/facilities/MaintenanceSchedule.ts` |
| NetworkInfra | `models/facilities/NetworkInfra.ts` |
| PurchaseOrder | `models/facilities/PurchaseOrder.ts` |
| StockItem | `models/facilities/StockItem.ts` |
| StockTransaction | `models/facilities/StockTransaction.ts` |
| Vendor | `models/facilities/Vendor.ts` |
| WasteManagement | `models/facilities/WasteManagement.ts` |

## Library (9 models)

| Model | File |
|-------|------|
| Book | `models/library/Book.ts` |
| BookIssue | `models/library/BookIssue.ts` |
| BookReservation | `models/library/BookReservation.ts` |
| EResource | `models/library/EResource.ts` |
| EResourceAccess | `models/library/EResourceAccess.ts` |
| LibraryFine | `models/library/LibraryFine.ts` |
| LibraryGateEntry | `models/library/LibraryGateEntry.ts` |
| LibraryMember | `models/library/LibraryMember.ts` |
| PeriodicalSubscription | `models/library/PeriodicalSubscription.ts` |

## Student Dev (14 models)

| Model | File |
|-------|------|
| Achievement | `models/student-dev/Achievement.ts` |
| Club | `models/student-dev/Club.ts` |
| ClubMembership | `models/student-dev/ClubMembership.ts` |
| CommunityProject | `models/student-dev/CommunityProject.ts` |
| Event | `models/student-dev/Event.ts` |
| EventRegistration | `models/student-dev/EventRegistration.ts` |
| LeadershipRole | `models/student-dev/LeadershipRole.ts` |
| Mentoring | `models/student-dev/Mentoring.ts` |
| NSSActivity | `models/student-dev/NSSActivity.ts` |
| NSSParticipant | `models/student-dev/NSSParticipant.ts` |
| SkillCertification | `models/student-dev/SkillCertification.ts` |
| SportsTeam | `models/student-dev/SportsTeam.ts` |
| SportsTeamMember | `models/student-dev/SportsTeamMember.ts` |
| StudentProject | `models/student-dev/StudentProject.ts` |

## Governance (5 models)

| Model | File |
|-------|------|
| Committee | `models/governance/Committee.ts` |
| CommitteeMeeting | `models/governance/CommitteeMeeting.ts` |
| GoverningBodyMember | `models/governance/GoverningBodyMember.ts` |
| Policy | `models/governance/Policy.ts` |
| StrategicGoal | `models/governance/StrategicGoal.ts` |

## Compliance (10 models)

| Model | File |
|-------|------|
| AICTEApproval | `models/compliance/AICTEApproval.ts` |
| AccreditationBody | `models/compliance/AccreditationBody.ts` |
| AccreditationCycle | `models/compliance/AccreditationCycle.ts` |
| AffiliationStatus | `models/compliance/AffiliationStatus.ts` |
| AuditFinding | `models/compliance/AuditFinding.ts` |
| ComplianceCriteria | `models/compliance/ComplianceCriteria.ts` |
| IQACReport | `models/compliance/IQACReport.ts` |
| LegalCase | `models/compliance/LegalCase.ts` |
| RTIRequest | `models/compliance/RTIRequest.ts` |
| RegulatoryFiling | `models/compliance/RegulatoryFiling.ts` |

## Communication (8 models)

| Model | File |
|-------|------|
| Announcement | `models/communication/Announcement.ts` |
| Circular | `models/communication/Circular.ts` |
| EmailLog | `models/communication/EmailLog.ts` |
| FeedbackSurvey | `models/communication/FeedbackSurvey.ts` |
| Notification | `models/communication/Notification.ts` |
| SMSLog | `models/communication/SMSLog.ts` |
| SurveyResponse | `models/communication/SurveyResponse.ts` |
| WhatsAppLog | `models/communication/WhatsAppLog.ts` |

## Juvi (8 models)

| Model | File |
|-------|------|
| JuviAction | `models/juvi/JuviAction.ts` |
| JuviConversation | `models/juvi/JuviConversation.ts` |
| JuviFeedback | `models/juvi/JuviFeedback.ts` |
| JuviInsight | `models/juvi/JuviInsight.ts` |
| JuviKnowledgeBase | `models/juvi/JuviKnowledgeBase.ts` |
| JuviMessage | `models/juvi/JuviMessage.ts` |
| JuviPersonaConfig | `models/juvi/JuviPersonaConfig.ts` |
| JuviUsageMetric | `models/juvi/JuviUsageMetric.ts` |

## Root-Level Models (2 models)

| Model | File | Key Fields |
|-------|------|------------|
| College | `models/College.ts` | name, code, address, contactEmail, contactPhone, logo, subscription (plan/status/expiresAt), settings, status |
| User | `models/User.ts` | collegeId, email, password, name, role (super_admin/admin/principal/hod/faculty/staff/student/parent), personaType, personId→Person, isActive |

## Workflow (2 models)

| Model | File | Key Fields |
|-------|------|------------|
| WorkflowInstance | `models/workflow/WorkflowInstance.ts` | workflowId, workflowVersion, entityType, entityId, academicYearId, currentPhase, currentStep, status, initiatedBy, history[] |
| WorkflowTask | `models/workflow/WorkflowTask.ts` | workflowInstanceId, stepId, stepName, phase, type, assigneeRole, assigneeId, aiAutonomy, status, dueAt, completedBy, result |


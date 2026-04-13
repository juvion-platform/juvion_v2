import { Regulation } from '../../models/academic-structure/Regulation';
import { Programme } from '../../models/academic-structure/Programme';
import { Department } from '../../models/academic-structure/Department';
import { Branch } from '../../models/academic-structure/Branch';
import { Batch } from '../../models/academic-structure/Batch';
import { Section } from '../../models/academic-structure/Section';
import { LabBatch } from '../../models/academic-structure/LabBatch';
import { Student } from '../../models/people/Student';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { Semester } from '../../models/academic-structure/Semester';
import { Course } from '../../models/academic-ops/Course';
import { CurriculumMap } from '../../models/academic-ops/CurriculumMap';
import { CourseOffering } from '../../models/academic-ops/CourseOffering';
import { Enrollment } from '../../models/academic-ops/Enrollment';
import { AcademicCalendar } from '../../models/academic-ops/AcademicCalendar';
import { Timetable } from '../../models/academic-ops/Timetable';
import { TimetableSlot } from '../../models/academic-ops/TimetableSlot';
import { AttendanceSession } from '../../models/academic-ops/AttendanceSession';
import { AttendanceRecord } from '../../models/academic-ops/AttendanceRecord';
import { AttendanceSummary } from '../../models/academic-ops/AttendanceSummary';
import { AttendanceAlert } from '../../models/academic-ops/AttendanceAlert';
import { InternalAssessment } from '../../models/academic-ops/InternalAssessment';
import { InternalMark } from '../../models/academic-ops/InternalMark';
import { ExamRegistration } from '../../models/academic-ops/ExamRegistration';
import { ExamSchedule } from '../../models/academic-ops/ExamSchedule';
import { ExternalMark } from '../../models/academic-ops/ExternalMark';
import { GradeCard } from '../../models/academic-ops/GradeCard';
import { SemesterResult } from '../../models/academic-ops/SemesterResult';
import { CourseOutcome } from '../../models/academic-ops/CourseOutcome';
import { ProgramOutcome } from '../../models/academic-ops/ProgramOutcome';
import { ElectiveAllocation } from '../../models/academic-ops/ElectiveAllocation';
import { LessonPlan } from '../../models/academic-ops/LessonPlan';
import { CourseFeedback } from '../../models/academic-ops/CourseFeedback';
import { CondonationRequest } from '../../models/academic-ops/CondonationRequest';
import { ICondonationRequest } from '../../models/academic-ops/CondonationRequest';
import { Assignment } from '../../models/academic-ops/Assignment';
import { Submission } from '../../models/academic-ops/Submission';
import { Quiz } from '../../models/academic-ops/Quiz';
import { QuizAttempt } from '../../models/academic-ops/QuizAttempt';
import { FeeLineItem } from '../../models/finance/FeeLineItem';
import { Invoice } from '../../models/finance/Invoice';
import { SeatingPlan } from '../../models/academic-ops/SeatingPlan';
import { InvigilationRoster } from '../../models/academic-ops/InvigilationRoster';
import { HallTicket } from '../../models/academic-ops/HallTicket';
import { Backlog } from '../../models/academic-ops/Backlog';
import { PromotionDecision } from '../../models/academic-ops/PromotionDecision';
import { RevaluationRequest } from '../../models/academic-ops/RevaluationRequest';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import { FilterQuery } from 'mongoose';
import { IAttendanceSummary } from '../../models/academic-ops/AttendanceSummary';
import { IAttendanceAlert } from '../../models/academic-ops/AttendanceAlert';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';

const STUDENT_POPULATE = { path: 'studentId', populate: { path: 'personId' } };

// ─── Dashboard Stats ────────────────────────────────────────

export async function getStats(collegeId: string) {
  const [regulations, programmes, departments, branches, batches, sections, academicYears, semesters, courses, courseOfferings, enrollments] = await Promise.all([
    Regulation.countDocuments({ collegeId }),
    Programme.countDocuments({ collegeId }),
    Department.countDocuments({ collegeId }),
    Branch.countDocuments({ collegeId }),
    Batch.countDocuments({ collegeId }),
    Section.countDocuments({ collegeId }),
    AcademicYear.countDocuments({ collegeId }),
    Semester.countDocuments({ collegeId }),
    Course.countDocuments({ collegeId }),
    CourseOffering.countDocuments({ collegeId }),
    Enrollment.countDocuments({ collegeId }),
  ]);
  const currentYear = await AcademicYear.findOne({ collegeId, isCurrent: true }).lean();
  const activeSemesters = await Semester.countDocuments({ collegeId, status: 'active' });
  return { regulations, programmes, departments, branches, batches, sections, academicYears, semesters, courses, courseOfferings, enrollments, currentYear, activeSemesters };
}

// ─── Regulations ────────────────────────────────────────────

export async function listRegulations(collegeId: string, page: number, limit: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Regulation, filter, page, limit, { effectiveFromYear: -1 });
}

export async function getRegulation(collegeId: string, id: string) {
  const doc = await Regulation.findOne({ _id: id, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Regulation not found');
  return doc;
}

export async function createRegulation(collegeId: string, data: any, performedBy: string) {
  const doc = await Regulation.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Regulation', entityId: String(doc._id), entityName: data.code, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateRegulation(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Regulation.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Regulation not found');
  await createAuditLog({ collegeId, entityType: 'Regulation', entityId: id, entityName: doc.code, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteRegulation(collegeId: string, id: string, performedBy: string) {
  const doc = await Regulation.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Regulation not found');
  await createAuditLog({ collegeId, entityType: 'Regulation', entityId: id, entityName: doc.code, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Programmes ─────────────────────────────────────────────

export async function listProgrammes(collegeId: string, page: number, limit: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Programme, filter, page, limit, { code: 1 }, ['regulationId']);
}

export async function getProgramme(collegeId: string, id: string) {
  const doc = await Programme.findOne({ _id: id, collegeId }).populate('regulationId').lean();
  if (!doc) throw new AppError(404, 'Programme not found');
  return doc;
}

export async function createProgramme(collegeId: string, data: any, performedBy: string) {
  const doc = await Programme.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Programme', entityId: String(doc._id), entityName: data.code, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateProgramme(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Programme.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Programme not found');
  await createAuditLog({ collegeId, entityType: 'Programme', entityId: id, entityName: doc.code, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteProgramme(collegeId: string, id: string, performedBy: string) {
  const doc = await Programme.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Programme not found');
  await createAuditLog({ collegeId, entityType: 'Programme', entityId: id, entityName: doc.code, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Departments ────────────────────────────────────────────

export async function listDepartments(collegeId: string, page: number, limit: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope?.departmentOnly && authScope.departmentId) {
    filter._id = authScope.departmentId;
  }
  return paginate(Department, filter, page, limit, { code: 1 }, ['hodId']);
}

export async function getDepartment(collegeId: string, id: string) {
  const doc = await Department.findOne({ _id: id, collegeId }).populate('hodId').lean();
  if (!doc) throw new AppError(404, 'Department not found');
  return doc;
}

export async function createDepartment(collegeId: string, data: any, performedBy: string) {
  const doc = await Department.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Department', entityId: String(doc._id), entityName: data.code, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateDepartment(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Department.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Department not found');
  await createAuditLog({ collegeId, entityType: 'Department', entityId: id, entityName: doc.code, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteDepartment(collegeId: string, id: string, performedBy: string) {
  const doc = await Department.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Department not found');
  await createAuditLog({ collegeId, entityType: 'Department', entityId: id, entityName: doc.code, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Branches ───────────────────────────────────────────────

export async function listBranches(collegeId: string, page: number, limit: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Branch, filter, page, limit, { code: 1 }, ['programmeId', 'departmentId']);
}

export async function getBranch(collegeId: string, id: string) {
  const doc = await Branch.findOne({ _id: id, collegeId }).populate('programmeId departmentId').lean();
  if (!doc) throw new AppError(404, 'Branch not found');
  return doc;
}

export async function createBranch(collegeId: string, data: any, performedBy: string) {
  const doc = await Branch.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Branch', entityId: String(doc._id), entityName: data.code, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateBranch(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Branch.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Branch not found');
  await createAuditLog({ collegeId, entityType: 'Branch', entityId: id, entityName: doc.code, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteBranch(collegeId: string, id: string, performedBy: string) {
  const doc = await Branch.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Branch not found');
  await createAuditLog({ collegeId, entityType: 'Branch', entityId: id, entityName: doc.code, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Batches ────────────────────────────────────────────────

export async function listBatches(collegeId: string, page: number, limit: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Batch, filter, page, limit, { admissionYear: -1 }, ['programmeId', 'regulationId']);
}

export async function getBatch(collegeId: string, id: string) {
  const doc = await Batch.findOne({ _id: id, collegeId }).populate('programmeId regulationId').lean();
  if (!doc) throw new AppError(404, 'Batch not found');
  return doc;
}

export async function createBatch(collegeId: string, data: any, performedBy: string) {
  const doc = await Batch.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Batch', entityId: String(doc._id), entityName: data.code, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateBatch(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Batch.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Batch not found');
  await createAuditLog({ collegeId, entityType: 'Batch', entityId: id, entityName: doc.code, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteBatch(collegeId: string, id: string, performedBy: string) {
  const doc = await Batch.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Batch not found');
  await createAuditLog({ collegeId, entityType: 'Batch', entityId: id, entityName: doc.code, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Sections ───────────────────────────────────────────────

export async function listSections(collegeId: string, page: number, limit: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Section, filter, page, limit, { year: 1, semester: 1, name: 1 }, ['branchId', 'batchId', 'classAdvisorId']);
}

export async function getSection(collegeId: string, id: string) {
  const doc = await Section.findOne({ _id: id, collegeId }).populate('branchId batchId classAdvisorId').lean();
  if (!doc) throw new AppError(404, 'Section not found');
  return doc;
}

export async function createSection(collegeId: string, data: any, performedBy: string) {
  const doc = await Section.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Section', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateSection(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Section.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Section not found');
  await createAuditLog({ collegeId, entityType: 'Section', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteSection(collegeId: string, id: string, performedBy: string) {
  const doc = await Section.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Section not found');
  await createAuditLog({ collegeId, entityType: 'Section', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Academic Years ─────────────────────────────────────────

export async function listAcademicYears(collegeId: string, page: number, limit: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AcademicYear, filter, page, limit, { startDate: -1 });
}

export async function getAcademicYear(collegeId: string, id: string) {
  const doc = await AcademicYear.findOne({ _id: id, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Academic year not found');
  return doc;
}

export async function createAcademicYear(collegeId: string, data: any, performedBy: string) {
  // If setting as current, unset any existing current year
  if (data.isCurrent) {
    await AcademicYear.updateMany({ collegeId, isCurrent: true }, { $set: { isCurrent: false } });
  }
  const doc = await AcademicYear.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AcademicYear', entityId: String(doc._id), entityName: data.code, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateAcademicYear(collegeId: string, id: string, data: any, performedBy: string) {
  if (data.isCurrent) {
    await AcademicYear.updateMany({ collegeId, isCurrent: true, _id: { $ne: id } }, { $set: { isCurrent: false } });
  }
  const doc = await AcademicYear.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Academic year not found');
  await createAuditLog({ collegeId, entityType: 'AcademicYear', entityId: id, entityName: doc.code, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteAcademicYear(collegeId: string, id: string, performedBy: string) {
  const doc = await AcademicYear.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Academic year not found');
  await createAuditLog({ collegeId, entityType: 'AcademicYear', entityId: id, entityName: doc.code, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Semesters ──────────────────────────────────────────────

export async function listSemesters(collegeId: string, page: number, limit: number, academicYearId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Semester, filter, page, limit, { year: 1, number: 1 }, ['academicYearId']);
}

export async function getSemester(collegeId: string, id: string) {
  const doc = await Semester.findOne({ _id: id, collegeId }).populate('academicYearId').lean();
  if (!doc) throw new AppError(404, 'Semester not found');
  return doc;
}

export async function createSemester(collegeId: string, data: any, performedBy: string) {
  const doc = await Semester.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Semester', entityId: String(doc._id), entityName: `Sem ${data.number} Year ${data.year}`, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateSemester(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Semester.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Semester not found');
  await createAuditLog({ collegeId, entityType: 'Semester', entityId: id, entityName: `Sem ${doc.number} Year ${doc.year}`, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteSemester(collegeId: string, id: string, performedBy: string) {
  const doc = await Semester.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Semester not found');
  await createAuditLog({ collegeId, entityType: 'Semester', entityId: id, entityName: `Sem ${doc.number} Year ${doc.year}`, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Courses ────────────────────────────────────────────────

export async function listCourses(collegeId: string, page: number, limit: number, regulationId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (regulationId) filter.regulationId = regulationId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Course, filter, page, limit, { code: 1 }, ['regulationId', 'departmentId']);
}

export async function getCourse(collegeId: string, id: string) {
  const doc = await Course.findOne({ _id: id, collegeId }).populate('regulationId departmentId').lean();
  if (!doc) throw new AppError(404, 'Course not found');
  return doc;
}

export async function createCourse(collegeId: string, data: any, performedBy: string) {
  const doc = await Course.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Course', entityId: String(doc._id), entityName: data.code, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateCourse(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Course.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Course not found');
  await createAuditLog({ collegeId, entityType: 'Course', entityId: id, entityName: doc.code, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteCourse(collegeId: string, id: string, performedBy: string) {
  const doc = await Course.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Course not found');
  await createAuditLog({ collegeId, entityType: 'Course', entityId: id, entityName: doc.code, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Curriculum Maps ────────────────────────────────────────

export async function listCurriculumMaps(collegeId: string, page: number, limit: number, branchId?: string, semester?: number, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (branchId) filter.branchId = branchId;
  if (semester) filter.semester = semester;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(CurriculumMap, filter, page, limit, { semester: 1 }, ['branchId']);
}

export async function createCurriculumMap(collegeId: string, data: any, performedBy: string) {
  const doc = await CurriculumMap.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'CurriculumMap', entityId: String(doc._id), entityName: `Sem ${data.semester}`, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateCurriculumMap(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await CurriculumMap.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Curriculum map not found');
  await createAuditLog({ collegeId, entityType: 'CurriculumMap', entityId: id, entityName: `Sem ${doc.semester}`, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteCurriculumMap(collegeId: string, id: string, performedBy: string) {
  const doc = await CurriculumMap.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Curriculum map not found');
  await createAuditLog({ collegeId, entityType: 'CurriculumMap', entityId: id, entityName: `Sem ${doc.semester}`, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Course Offerings ───────────────────────────────────────

export async function listCourseOfferings(collegeId: string, page: number, limit: number, semesterId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(CourseOffering, filter, page, limit, { createdAt: -1 }, ['courseId', 'semesterId', 'sectionId', 'facultyId']);
}

export async function getCourseOffering(collegeId: string, id: string) {
  const doc = await CourseOffering.findOne({ _id: id, collegeId }).populate('courseId semesterId sectionId facultyId').lean();
  if (!doc) throw new AppError(404, 'Course offering not found');
  return doc;
}

export async function createCourseOffering(collegeId: string, data: any, performedBy: string) {
  const doc = await CourseOffering.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'CourseOffering', entityId: String(doc._id), entityName: String(doc._id), action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateCourseOffering(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await CourseOffering.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Course offering not found');
  await createAuditLog({ collegeId, entityType: 'CourseOffering', entityId: id, entityName: String(doc._id), action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteCourseOffering(collegeId: string, id: string, performedBy: string) {
  const doc = await CourseOffering.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Course offering not found');
  await createAuditLog({ collegeId, entityType: 'CourseOffering', entityId: id, entityName: String(doc._id), action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Enrollments ────────────────────────────────────────────

export async function listEnrollments(collegeId: string, page: number, limit: number, semesterId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(Enrollment, filter, page, limit, { enrolledAt: -1 }, [STUDENT_POPULATE, 'courseOfferingId', 'semesterId'] as any);
}

export async function createEnrollment(collegeId: string, data: any, performedBy: string) {
  const doc = await Enrollment.create({ ...data, collegeId });
  // Increment enrolled count on the offering
  await CourseOffering.findByIdAndUpdate(data.courseOfferingId, { $inc: { enrolledCount: 1 } });
  await createAuditLog({ collegeId, entityType: 'Enrollment', entityId: String(doc._id), entityName: String(doc._id), action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateEnrollment(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Enrollment.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Enrollment not found');
  await createAuditLog({ collegeId, entityType: 'Enrollment', entityId: id, entityName: String(doc._id), action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteEnrollment(collegeId: string, id: string, performedBy: string) {
  const doc = await Enrollment.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Enrollment not found');
  await CourseOffering.findByIdAndUpdate(doc.courseOfferingId, { $inc: { enrolledCount: -1 } });
  await createAuditLog({ collegeId, entityType: 'Enrollment', entityId: id, entityName: String(doc._id), action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ═══ Phase 3: Academic Calendar ═════════════════════════════

export async function listCalendarEvents(collegeId: string, page: number, limit: number, academicYearId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AcademicCalendar, filter, page, limit, { startDate: 1 }, ['academicYearId']);
}
export async function createCalendarEvent(collegeId: string, data: any, performedBy: string) {
  const doc = await AcademicCalendar.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AcademicCalendar', entityId: String(doc._id), entityName: data.title, action: 'create', changes: [], performedBy });
  return doc;
}
export async function updateCalendarEvent(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await AcademicCalendar.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Calendar event not found');
  await createAuditLog({ collegeId, entityType: 'AcademicCalendar', entityId: id, entityName: doc.title, action: 'update', changes: [], performedBy });
  return doc;
}
export async function deleteCalendarEvent(collegeId: string, id: string, performedBy: string) {
  const doc = await AcademicCalendar.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Calendar event not found');
  await createAuditLog({ collegeId, entityType: 'AcademicCalendar', entityId: id, entityName: doc.title, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ═══ Phase 3: Timetable ════════════════════════════════════

export async function listTimetables(collegeId: string, page: number, limit: number, semesterId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Timetable, filter, page, limit, { createdAt: -1 }, ['semesterId', 'sectionId']);
}
export async function getTimetable(collegeId: string, id: string) {
  const doc = await Timetable.findOne({ _id: id, collegeId }).populate('semesterId sectionId').lean();
  if (!doc) throw new AppError(404, 'Timetable not found');
  return doc;
}
export async function createTimetable(collegeId: string, data: any, performedBy: string) {
  const doc = await Timetable.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Timetable', entityId: String(doc._id), entityName: `TT v${doc.version}`, action: 'create', changes: [], performedBy });
  return doc;
}
export async function updateTimetable(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Timetable.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Timetable not found');
  await createAuditLog({ collegeId, entityType: 'Timetable', entityId: id, entityName: `TT v${doc.version}`, action: 'update', changes: [], performedBy });
  return doc;
}
export async function deleteTimetable(collegeId: string, id: string, performedBy: string) {
  const doc = await Timetable.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Timetable not found');
  await TimetableSlot.deleteMany({ timetableId: id, collegeId });
  await createAuditLog({ collegeId, entityType: 'Timetable', entityId: id, entityName: `TT v${doc.version}`, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ═══ Phase 3: Timetable Slots ══════════════════════════════

export async function listTimetableSlots(collegeId: string, timetableId: string) {
  return TimetableSlot.find({ collegeId, timetableId }).populate('courseOfferingId').sort({ day: 1, period: 1 }).lean();
}
export async function createTimetableSlot(collegeId: string, data: any, performedBy: string) {
  const doc = await TimetableSlot.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'TimetableSlot', entityId: String(doc._id), entityName: `${doc.day} P${doc.period}`, action: 'create', changes: [], performedBy });
  return doc;
}
export async function updateTimetableSlot(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await TimetableSlot.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Timetable slot not found');
  return doc;
}
export async function deleteTimetableSlot(collegeId: string, id: string, _performedBy: string) {
  const doc = await TimetableSlot.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Timetable slot not found');
  return { deleted: true };
}

// ═══ Phase 4: Attendance Sessions ══════════════════════════

export async function listAttendanceSessions(collegeId: string, page: number, limit: number, courseOfferingId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (courseOfferingId) filter.courseOfferingId = courseOfferingId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(AttendanceSession, filter, page, limit, { date: -1 }, ['courseOfferingId', 'facultyId']);
}
export async function getAttendanceSession(collegeId: string, id: string) {
  const doc = await AttendanceSession.findOne({ _id: id, collegeId }).populate('courseOfferingId facultyId').lean();
  if (!doc) throw new AppError(404, 'Attendance session not found');
  return doc;
}
export async function createAttendanceSession(collegeId: string, data: any, performedBy: string) {
  const doc = await AttendanceSession.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'AttendanceSession', entityId: String(doc._id), entityName: `${data.date} P${data.period}`, action: 'create', changes: [], performedBy });
  return doc;
}
export async function updateAttendanceSession(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await AttendanceSession.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Attendance session not found');
  return doc;
}
export async function deleteAttendanceSession(collegeId: string, id: string, _performedBy: string) {
  const doc = await AttendanceSession.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Attendance session not found');
  await AttendanceRecord.deleteMany({ sessionId: id, collegeId });
  return { deleted: true };
}

// ═══ Phase 4: Attendance Records ═══════════════════════════

export async function listAttendanceRecords(collegeId: string, sessionId: string) {
  return AttendanceRecord.find({ collegeId, sessionId }).populate(STUDENT_POPULATE as any).sort({ studentId: 1 }).lean();
}
export async function createAttendanceRecord(collegeId: string, data: any, _performedBy: string) {
  const doc = await AttendanceRecord.create({ ...data, collegeId });
  return doc;
}
export async function updateAttendanceRecord(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await AttendanceRecord.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Attendance record not found');
  return doc;
}
export async function bulkCreateAttendanceRecords(collegeId: string, records: any[], _performedBy: string) {
  const docs = records.map(r => ({ ...r, collegeId }));
  return AttendanceRecord.insertMany(docs);
}
export async function deleteAttendanceRecord(collegeId: string, id: string, _performedBy: string) {
  const doc = await AttendanceRecord.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Attendance record not found');
  return { deleted: true };
}

// ═══ Phase 5: Internal Assessments ═════════════════════════

export async function listInternalAssessments(collegeId: string, page: number, limit: number, courseOfferingId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (courseOfferingId) filter.courseOfferingId = courseOfferingId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(InternalAssessment, filter, page, limit, { date: -1 }, ['courseOfferingId']);
}
export async function createInternalAssessment(collegeId: string, data: any, performedBy: string) {
  const doc = await InternalAssessment.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'InternalAssessment', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return doc;
}
export async function updateInternalAssessment(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await InternalAssessment.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Assessment not found');
  return doc;
}
export async function deleteInternalAssessment(collegeId: string, id: string, _performedBy: string) {
  const doc = await InternalAssessment.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Assessment not found');
  await InternalMark.deleteMany({ assessmentId: id, collegeId });
  return { deleted: true };
}
export async function getInternalAssessment(collegeId: string, id: string) {
  const doc = await InternalAssessment.findOne({ _id: id, collegeId }).populate('courseOfferingId').lean();
  if (!doc) throw new AppError(404, 'Assessment not found');
  return doc;
}

// ═══ Phase 5: Internal Marks ═══════════════════════════════

export async function listInternalMarks(collegeId: string, assessmentId: string) {
  return InternalMark.find({ collegeId, assessmentId }).populate(STUDENT_POPULATE as any).sort({ studentId: 1 }).lean();
}
export async function createInternalMark(collegeId: string, data: any, _performedBy: string) {
  const doc = await InternalMark.create({ ...data, collegeId });
  return doc;
}
export async function updateInternalMark(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await InternalMark.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Internal mark not found');
  return doc;
}
export async function bulkCreateInternalMarks(collegeId: string, marks: any[], _performedBy: string) {
  const docs = marks.map(m => ({ ...m, collegeId }));
  return InternalMark.insertMany(docs);
}
export async function deleteInternalMark(collegeId: string, id: string, _performedBy: string) {
  const doc = await InternalMark.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Internal mark not found');
  return { deleted: true };
}

// ═══ Phase 6: Exam Registration ════════════════════════════

export async function listExamRegistrations(collegeId: string, page: number, limit: number, semesterId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(ExamRegistration, filter, page, limit, { registeredAt: -1 }, [STUDENT_POPULATE, 'semesterId'] as any);
}
export async function createExamRegistration(collegeId: string, data: any, performedBy: string) {
  const doc = await ExamRegistration.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ExamRegistration', entityId: String(doc._id), entityName: String(doc._id), action: 'create', changes: [], performedBy });
  return doc;
}
export async function updateExamRegistration(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await ExamRegistration.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Exam registration not found');
  return doc;
}
export async function deleteExamRegistration(collegeId: string, id: string, _performedBy: string) {
  const doc = await ExamRegistration.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exam registration not found');
  return { deleted: true };
}

// ═══ Phase 6: Exam Schedule ════════════════════════════════

export async function listExamSchedules(collegeId: string, page: number, limit: number, semesterId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(ExamSchedule, filter, page, limit, { date: 1, startTime: 1 }, ['courseId', 'semesterId']);
}
export async function createExamSchedule(collegeId: string, data: any, performedBy: string) {
  const doc = await ExamSchedule.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'ExamSchedule', entityId: String(doc._id), entityName: `${data.date}`, action: 'create', changes: [], performedBy });
  return doc;
}
export async function updateExamSchedule(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await ExamSchedule.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Exam schedule not found');
  return doc;
}
export async function deleteExamSchedule(collegeId: string, id: string, _performedBy: string) {
  const doc = await ExamSchedule.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Exam schedule not found');
  return { deleted: true };
}

// ═══ Phase 6: External Marks ═══════════════════════════════

export async function listExternalMarks(collegeId: string, page: number, limit: number, semesterId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(ExternalMark, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'courseId', 'semesterId'] as any);
}
export async function createExternalMark(collegeId: string, data: any, _performedBy: string) {
  const doc = await ExternalMark.create({ ...data, collegeId });
  return doc;
}
export async function updateExternalMark(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await ExternalMark.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'External mark not found');
  return doc;
}
export async function deleteExternalMark(collegeId: string, id: string, _performedBy: string) {
  const doc = await ExternalMark.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'External mark not found');
  return { deleted: true };
}

// ═══ Phase 7: Grade Cards ══════════════════════════════════

export async function listGradeCards(collegeId: string, page: number, limit: number, semesterId?: string, studentId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (studentId) filter.studentId = studentId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(GradeCard, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'courseId', 'semesterId'] as any);
}
export async function createGradeCard(collegeId: string, data: any, _performedBy: string) {
  const doc = await GradeCard.create({ ...data, collegeId });
  return doc;
}
export async function updateGradeCard(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await GradeCard.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Grade card not found');
  return doc;
}
export async function deleteGradeCard(collegeId: string, id: string, _performedBy: string) {
  const doc = await GradeCard.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Grade card not found');
  return { deleted: true };
}

// ═══ Phase 7: Semester Results ═════════════════════════════

export async function listSemesterResults(collegeId: string, page: number, limit: number, semesterId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(SemesterResult, filter, page, limit, { cgpa: -1 }, [STUDENT_POPULATE, 'semesterId'] as any);
}
export async function createSemesterResult(collegeId: string, data: any, _performedBy: string) {
  const doc = await SemesterResult.create({ ...data, collegeId });
  return doc;
}
export async function updateSemesterResult(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await SemesterResult.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Semester result not found');
  return doc;
}
export async function deleteSemesterResult(collegeId: string, id: string, _performedBy: string) {
  const doc = await SemesterResult.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Semester result not found');
  return { deleted: true };
}

// ═══ Phase 8: Course Outcomes ══════════════════════════════

export async function listCourseOutcomes(collegeId: string, courseId: string) {
  return CourseOutcome.find({ collegeId, courseId }).sort({ code: 1 }).lean();
}
export async function createCourseOutcome(collegeId: string, data: any, _performedBy: string) {
  const doc = await CourseOutcome.create({ ...data, collegeId });
  return doc;
}
export async function updateCourseOutcome(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await CourseOutcome.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Course outcome not found');
  return doc;
}
export async function deleteCourseOutcome(collegeId: string, id: string, _performedBy: string) {
  const doc = await CourseOutcome.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Course outcome not found');
  return { deleted: true };
}

// ═══ Phase 8: Program Outcomes ═════════════════════════════

export async function listProgramOutcomes(collegeId: string, programmeId: string) {
  return ProgramOutcome.find({ collegeId, programmeId }).sort({ code: 1 }).lean();
}
export async function createProgramOutcome(collegeId: string, data: any, _performedBy: string) {
  const doc = await ProgramOutcome.create({ ...data, collegeId });
  return doc;
}
export async function updateProgramOutcome(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await ProgramOutcome.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Program outcome not found');
  return doc;
}
export async function deleteProgramOutcome(collegeId: string, id: string, _performedBy: string) {
  const doc = await ProgramOutcome.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Program outcome not found');
  return { deleted: true };
}

// ═══ Phase 8: Elective Allocation ══════════════════════════

export async function listElectiveAllocations(collegeId: string, page: number, limit: number, semesterId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(ElectiveAllocation, filter, page, limit, { preference: 1 }, [STUDENT_POPULATE, 'courseOfferingId', 'semesterId'] as any);
}
export async function createElectiveAllocation(collegeId: string, data: any, _performedBy: string) {
  const doc = await ElectiveAllocation.create({ ...data, collegeId });
  return doc;
}
export async function updateElectiveAllocation(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await ElectiveAllocation.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Elective allocation not found');
  return doc;
}
export async function deleteElectiveAllocation(collegeId: string, id: string, _performedBy: string) {
  const doc = await ElectiveAllocation.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Elective allocation not found');
  return { deleted: true };
}

// ═══ Phase 8: Lesson Plans ═════════════════════════════════

export async function listLessonPlans(collegeId: string, page: number, limit: number, courseOfferingId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (courseOfferingId) filter.courseOfferingId = courseOfferingId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(LessonPlan, filter, page, limit, { weekNumber: 1 }, ['courseOfferingId']);
}
export async function createLessonPlan(collegeId: string, data: any, _performedBy: string) {
  const doc = await LessonPlan.create({ ...data, collegeId });
  return doc;
}
export async function updateLessonPlan(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await LessonPlan.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Lesson plan not found');
  return doc;
}
export async function deleteLessonPlan(collegeId: string, id: string, _performedBy: string) {
  const doc = await LessonPlan.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Lesson plan not found');
  return { deleted: true };
}

// ═══ Phase 8: Course Feedback ══════════════════════════════

export async function listCourseFeedback(collegeId: string, page: number, limit: number, courseOfferingId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (courseOfferingId) filter.courseOfferingId = courseOfferingId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(CourseFeedback, filter, page, limit, { submittedAt: -1 }, ['courseOfferingId', STUDENT_POPULATE] as any);
}
export async function createCourseFeedback(collegeId: string, data: any, _performedBy: string) {
  const doc = await CourseFeedback.create({ ...data, collegeId, submittedAt: new Date() });
  return doc;
}
export async function deleteCourseFeedback(collegeId: string, id: string, _performedBy: string) {
  const doc = await CourseFeedback.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Feedback not found');
  return { deleted: true };
}

// ═══ W02: Curriculum Instantiation & Calendar Publish ═════════

export async function instantiateSemesterCurriculum(
  collegeId: string,
  semesterId: string,
  regulationId: string,
  programmeId: string,
  branchId: string,
  performedBy: string,
) {
  // 1. Look up the semester to get its number and year
  const semester = await Semester.findOne({ _id: semesterId, collegeId });
  if (!semester) throw new AppError(404, 'Semester not found');

  // 2. Query CurriculumMap for matching entries
  const maps = await CurriculumMap.find({
    collegeId,
    regulationId,
    programmeId,
    branchId,
    semester: semester.number,
  });
  if (maps.length === 0) {
    throw new AppError(404, 'No curriculum map found for the given parameters');
  }

  // 3. For each map entry, look up the course and find sections, then create offerings
  let courseOfferingsCreated = 0;
  const courseNames: string[] = [];

  for (const map of maps) {
    // 3a. Look up the Course
    const course = await Course.findOne({ _id: map.courseId, collegeId });
    if (!course) continue;
    courseNames.push(course.name);

    // 3b. Find all Sections for this branch/semester
    const sections = await Section.find({
      collegeId,
      branchId,
      semester: semester.number,
    });

    // 3c. Create a CourseOffering for each section
    for (const section of sections) {
      await CourseOffering.create({
        collegeId,
        courseId: map.courseId,
        semesterId,
        sectionId: section._id,
        facultyId: section.classAdvisorId || '000000000000000000000000',
        status: 'draft',
        maxEnrollment: section.capacity,
      });
      courseOfferingsCreated++;
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'CourseOffering',
    entityId: semesterId,
    entityName: `Curriculum instantiation for semester ${semester.number}`,
    action: 'create',
    changes: [{ field: 'courseOfferingsCreated', displayName: 'Course Offerings Created', oldValue: '0', newValue: String(courseOfferingsCreated) }],
    performedBy,
  });

  return { courseOfferingsCreated, courses: courseNames };
}

export async function publishAcademicCalendar(
  collegeId: string,
  calendarId: string,
  performedBy: string,
) {
  // 1. Find the calendar
  const calendar = await AcademicCalendar.findOne({ _id: calendarId, collegeId });
  if (!calendar) throw new AppError(404, 'Academic calendar not found');

  // 2. Validate current status
  if (calendar.status !== 'draft') {
    throw new AppError(400, 'Calendar can only be published from draft status');
  }

  // 3. Update status and approvedBy
  calendar.status = 'published';
  calendar.approvedBy = performedBy as any;
  await calendar.save();

  // 4. Audit log
  await createAuditLog({
    collegeId,
    entityType: 'AcademicCalendar',
    entityId: String(calendar._id),
    entityName: calendar.title,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'draft', newValue: 'published' }],
    performedBy,
  });

  return calendar;
}

// ═══ W02: Section Formation & Lab Batch Creation ═════════════

export async function formSections(
  collegeId: string,
  branchId: string,
  batchId: string,
  semesterId: string,
  year: number,
  semester: number,
  performedBy: string,
) {
  // 1. Find all active students for the given branch/batch
  const students = await Student.find({
    collegeId,
    branchId,
    batchId,
    status: 'active',
  }).lean();

  if (students.length === 0) {
    throw new AppError(404, 'No active students found for the given branch and batch');
  }

  // 2. Read the Branch to get intake (section capacity)
  const branch = await Branch.findOne({ _id: branchId, collegeId });
  const sectionCapacity = branch?.intake || 60;

  // 3. Calculate number of sections needed
  const numSections = Math.ceil(students.length / sectionCapacity);

  const createdSections = [];
  let studentsDistributed = 0;

  // 4. Create each section with distributed students
  for (let i = 0; i < numSections; i++) {
    const sectionName = String.fromCharCode(65 + i); // 'A', 'B', 'C', ...
    const startIdx = i * sectionCapacity;
    const endIdx = Math.min(startIdx + sectionCapacity, students.length);
    const sectionStudents = students.slice(startIdx, endIdx);
    const studentIds = sectionStudents.map((s) => s._id);

    const section = await Section.create({
      collegeId,
      branchId,
      batchId,
      year,
      semester,
      name: sectionName,
      capacity: sectionCapacity,
      studentIds,
    });

    studentsDistributed += sectionStudents.length;
    createdSections.push(section);

    await createAuditLog({
      collegeId,
      entityType: 'Section',
      entityId: String(section._id),
      entityName: sectionName,
      action: 'create',
      changes: [
        { field: 'students', displayName: 'Students Assigned', oldValue: '0', newValue: String(sectionStudents.length) },
        { field: 'semesterId', displayName: 'Semester', oldValue: '', newValue: semesterId },
      ],
      performedBy,
    });
  }

  return { sectionsCreated: createdSections.length, studentsDistributed };
}

export async function createLabBatches(
  collegeId: string,
  sectionId: string,
  labBatchSize: number = 25,
  performedBy: string,
) {
  // 1. Find the Section
  const section = await Section.findOne({ _id: sectionId, collegeId });
  if (!section) throw new AppError(404, 'Section not found');

  // 2. Get the section's studentIds
  const studentIds = section.studentIds || [];
  if (studentIds.length === 0) {
    throw new AppError(400, 'Section has no students assigned');
  }

  // 3. Calculate batches needed
  const numBatches = Math.ceil(studentIds.length / labBatchSize);

  // 4. We need a semesterId for the LabBatch — look up from the section's semester
  const semester = await Semester.findOne({
    collegeId,
    number: section.semester,
    year: section.year,
  });
  if (!semester) throw new AppError(404, 'Semester not found for this section');

  const createdBatches = [];

  for (let i = 0; i < numBatches; i++) {
    const batchName = `Batch ${i + 1}`;
    const startIdx = i * labBatchSize;
    const endIdx = Math.min(startIdx + labBatchSize, studentIds.length);
    const batchStudents = studentIds.slice(startIdx, endIdx);

    const labBatch = await LabBatch.create({
      collegeId,
      sectionId,
      name: batchName,
      capacity: labBatchSize,
      studentIds: batchStudents,
      semesterId: semester._id,
    });

    createdBatches.push(labBatch);

    await createAuditLog({
      collegeId,
      entityType: 'LabBatch',
      entityId: String(labBatch._id),
      entityName: batchName,
      action: 'create',
      changes: [
        { field: 'students', displayName: 'Students Assigned', oldValue: '0', newValue: String(batchStudents.length) },
      ],
      performedBy,
    });
  }

  // 5. Update the Section's labBatchCount
  section.labBatchCount = numBatches;
  await section.save();

  await createAuditLog({
    collegeId,
    entityType: 'Section',
    entityId: String(section._id),
    entityName: section.name,
    action: 'update',
    changes: [
      { field: 'labBatchCount', displayName: 'Lab Batch Count', oldValue: '0', newValue: String(numBatches) },
    ],
    performedBy,
  });

  return { labBatchesCreated: createdBatches.length };
}

// ═══ W02: Faculty Assignment & Timetable Conflict Detection ═════

export async function assignFacultyToOffering(
  collegeId: string,
  courseOfferingId: string,
  facultyId: string,
  performedBy: string,
) {
  const offering = await CourseOffering.findOne({ _id: courseOfferingId, collegeId });
  if (!offering) throw new AppError(404, 'CourseOffering not found');

  const oldFacultyId = offering.facultyId ? String(offering.facultyId) : '';
  const oldStatus = offering.status || 'draft';

  offering.facultyId = facultyId as unknown as typeof offering.facultyId;
  if (offering.status === 'draft') {
    offering.status = 'active';
  }
  await offering.save();

  await createAuditLog({
    collegeId,
    entityType: 'CourseOffering',
    entityId: String(offering._id),
    entityName: `Offering ${String(offering._id)}`,
    action: 'update',
    changes: [
      { field: 'facultyId', displayName: 'Faculty', oldValue: oldFacultyId, newValue: facultyId },
      ...(oldStatus === 'draft' && offering.status === 'active'
        ? [{ field: 'status', displayName: 'Status', oldValue: oldStatus, newValue: 'active' }]
        : []),
    ],
    performedBy,
  });

  return offering;
}

export interface ConflictResult {
  type: 'faculty' | 'room' | 'section' | 'lab_consecutive' | 'load_balance';
  severity: 'error' | 'warning';
  slotA: { day: string; period: number; courseOfferingId: string };
  slotB?: { day: string; period: number; courseOfferingId: string };
  message: string;
}

export async function detectTimetableConflicts(
  collegeId: string,
  timetableId: string,
) {
  const timetable = await Timetable.findOne({ _id: timetableId, collegeId });
  if (!timetable) throw new AppError(404, 'Timetable not found');

  const semesterId = String(timetable.semesterId);

  // Get all slots for this timetable
  const thisSlots = await TimetableSlot.find({ timetableId, collegeId }).lean();

  // Get all other timetables in the same semester
  const otherTimetables = await Timetable.find({
    collegeId,
    semesterId: timetable.semesterId,
    _id: { $ne: timetableId },
  }).lean();

  const otherTimetableIds = otherTimetables.map((t) => String(t._id));

  // Get all slots from other timetables in the same semester
  const otherSlots = otherTimetableIds.length > 0
    ? await TimetableSlot.find({ timetableId: { $in: otherTimetableIds }, collegeId }).lean()
    : [];

  const allSlots = [...thisSlots, ...otherSlots];

  // Build courseOfferingId -> facultyId map
  const offeringIds = [...new Set(allSlots.map((s) => String(s.courseOfferingId)))];
  const offerings = await CourseOffering.find({
    _id: { $in: offeringIds },
    collegeId,
  }).lean();

  const offeringFacultyMap = new Map<string, string>();
  const offeringCourseMap = new Map<string, string>();
  for (const o of offerings) {
    offeringFacultyMap.set(String(o._id), String(o.facultyId));
    offeringCourseMap.set(String(o._id), String(o.courseId));
  }

  // Build courseId -> Course map for lab checks
  const courseIds = [...new Set([...offeringCourseMap.values()])];
  const courses = await Course.find({ _id: { $in: courseIds }, collegeId }).lean();
  const courseMap = new Map<string, typeof courses[number]>();
  for (const c of courses) {
    courseMap.set(String(c._id), c);
  }

  const conflicts: ConflictResult[] = [];

  // Group all slots by (day, period) for cross-timetable checks
  const dayPeriodMap = new Map<string, typeof allSlots>();
  for (const slot of allSlots) {
    const key = `${slot.day}:${slot.period}`;
    const existing = dayPeriodMap.get(key);
    if (existing) {
      existing.push(slot);
    } else {
      dayPeriodMap.set(key, [slot]);
    }
  }

  // a. Faculty conflicts: same faculty at same day+period in same semester
  for (const [_key, slots] of dayPeriodMap) {
    const facultySlots = new Map<string, typeof slots>();
    for (const slot of slots) {
      const facultyId = offeringFacultyMap.get(String(slot.courseOfferingId));
      if (!facultyId) continue;
      const existing = facultySlots.get(facultyId);
      if (existing) {
        existing.push(slot);
      } else {
        facultySlots.set(facultyId, [slot]);
      }
    }
    for (const [_fId, fSlots] of facultySlots) {
      if (fSlots.length > 1) {
        const slotA = fSlots[0]!;
        const slotB = fSlots[1]!;
        conflicts.push({
          type: 'faculty',
          severity: 'error',
          slotA: { day: slotA.day, period: slotA.period, courseOfferingId: String(slotA.courseOfferingId) },
          slotB: { day: slotB.day, period: slotB.period, courseOfferingId: String(slotB.courseOfferingId) },
          message: `Faculty conflict: same faculty assigned to two offerings at ${slotA.day} period ${slotA.period}`,
        });
      }
    }
  }

  // b. Room conflicts: same roomId at same day+period across all semester timetables
  for (const [_key, slots] of dayPeriodMap) {
    const roomSlots = new Map<string, typeof slots>();
    for (const slot of slots) {
      if (!slot.roomId) continue;
      const roomId = String(slot.roomId);
      const existing = roomSlots.get(roomId);
      if (existing) {
        existing.push(slot);
      } else {
        roomSlots.set(roomId, [slot]);
      }
    }
    for (const [_rId, rSlots] of roomSlots) {
      if (rSlots.length > 1) {
        const slotA = rSlots[0]!;
        const slotB = rSlots[1]!;
        conflicts.push({
          type: 'room',
          severity: 'error',
          slotA: { day: slotA.day, period: slotA.period, courseOfferingId: String(slotA.courseOfferingId) },
          slotB: { day: slotB.day, period: slotB.period, courseOfferingId: String(slotB.courseOfferingId) },
          message: `Room conflict: same room assigned to two offerings at ${slotA.day} period ${slotA.period}`,
        });
      }
    }
  }

  // c. Section conflict: same timetable has two slots at same day+period
  const thisDayPeriodMap = new Map<string, typeof thisSlots>();
  for (const slot of thisSlots) {
    const key = `${slot.day}:${slot.period}`;
    const existing = thisDayPeriodMap.get(key);
    if (existing) {
      existing.push(slot);
    } else {
      thisDayPeriodMap.set(key, [slot]);
    }
  }
  for (const [_key, slots] of thisDayPeriodMap) {
    if (slots.length > 1) {
      const slotA = slots[0]!;
      const slotB = slots[1]!;
      conflicts.push({
        type: 'section',
        severity: 'error',
        slotA: { day: slotA.day, period: slotA.period, courseOfferingId: String(slotA.courseOfferingId) },
        slotB: { day: slotB.day, period: slotB.period, courseOfferingId: String(slotB.courseOfferingId) },
        message: `Section conflict: two slots at ${slotA.day} period ${slotA.period} in same timetable`,
      });
    }
  }

  // d. Consecutive lab constraint: lab slots for same course should be consecutive periods on same day
  // Group thisSlots by (courseOfferingId, day) where the course has practicalHrs > 0
  const labCourseSlots = new Map<string, typeof thisSlots>();
  for (const slot of thisSlots) {
    if (slot.slotType !== 'lab') continue;
    const courseId = offeringCourseMap.get(String(slot.courseOfferingId));
    if (!courseId) continue;
    const course = courseMap.get(courseId);
    if (!course || course.practicalHrs <= 0) continue;

    const key = `${String(slot.courseOfferingId)}:${slot.day}`;
    const existing = labCourseSlots.get(key);
    if (existing) {
      existing.push(slot);
    } else {
      labCourseSlots.set(key, [slot]);
    }
  }

  for (const [_key, slots] of labCourseSlots) {
    if (slots.length < 2) continue;
    const periods = slots.map((s) => s.period).sort((a, b) => a - b);
    for (let i = 1; i < periods.length; i++) {
      const prev = periods[i - 1]!;
      const curr = periods[i]!;
      if (curr - prev !== 1) {
        const slotA = slots[0]!;
        conflicts.push({
          type: 'lab_consecutive',
          severity: 'warning',
          slotA: { day: slotA.day, period: prev, courseOfferingId: String(slotA.courseOfferingId) },
          slotB: { day: slotA.day, period: curr, courseOfferingId: String(slotA.courseOfferingId) },
          message: `Lab slots for offering ${String(slotA.courseOfferingId)} on ${slotA.day} are not consecutive (periods ${prev} and ${curr})`,
        });
        break;
      }
    }
  }

  // e. Daily load balance: faculty with > 6 periods on any single day
  // Use allSlots so we catch across all timetables in the semester
  const facultyDayLoad = new Map<string, number>();
  for (const slot of allSlots) {
    const facultyId = offeringFacultyMap.get(String(slot.courseOfferingId));
    if (!facultyId) continue;
    const key = `${facultyId}:${slot.day}`;
    facultyDayLoad.set(key, (facultyDayLoad.get(key) || 0) + 1);
  }

  for (const [key, count] of facultyDayLoad) {
    if (count > 6) {
      const [_facultyId, day] = key.split(':') as [string, string];
      conflicts.push({
        type: 'load_balance',
        severity: 'warning',
        slotA: { day, period: 0, courseOfferingId: '' },
        message: `Faculty has ${count} periods on ${day} (exceeds 6), semester ${semesterId}`,
      });
    }
  }

  const hasErrors = conflicts.some((c) => c.severity === 'error');

  return { conflicts, hasErrors };
}

// ═══ W02: Timetable Substitution ═══════════════════════════════

export async function applySubstitution(
  collegeId: string,
  slotId: string,
  substituteFacultyId: string,
  performedBy: string,
) {
  const slot = await TimetableSlot.findOne({ _id: slotId, collegeId });
  if (!slot) throw new AppError(404, 'Timetable slot not found');

  const offering = await CourseOffering.findOne({ _id: slot.courseOfferingId, collegeId });
  if (!offering) throw new AppError(404, 'Course offering not found for this slot');

  slot.isSubstitution = true;
  slot.substituteFacultyId = substituteFacultyId as any;
  slot.originalFacultyId = offering.facultyId;
  await slot.save();

  await createAuditLog({
    collegeId,
    entityType: 'TimetableSlot',
    entityId: String(slot._id),
    entityName: `Slot ${slot.day} P${slot.period}`,
    action: 'update',
    changes: [{ field: 'substituteFacultyId', displayName: 'Substitute Faculty', oldValue: '', newValue: substituteFacultyId }],
    performedBy,
  });

  return slot;
}

// ═══ W02: Elective Allocation Optimization ═════════════════════

export async function optimizeElectiveAllocations(
  collegeId: string,
  semesterId: string,
  electiveGroup: string,
  performedBy: string,
) {
  // 1. Find all pending (requested) allocations for this semester + electiveGroup
  const allocations = await ElectiveAllocation.find({
    collegeId,
    semesterId,
    electiveGroup,
    status: 'requested',
  });

  if (allocations.length === 0) {
    throw new AppError(404, 'No pending elective allocation requests found');
  }

  // 2. Find elective courseIds from CurriculumMap where isElective=true and electiveGroup matches
  const curriculumEntries = await CurriculumMap.find({
    collegeId,
    isElective: true,
    electiveGroup,
  }).lean();

  const electiveCourseIds = curriculumEntries.map((c) => String(c.courseId));

  // 3. Find CourseOfferings for these elective courses in this semester
  const offerings = await CourseOffering.find({
    collegeId,
    semesterId,
    courseId: { $in: electiveCourseIds },
  });

  if (offerings.length === 0) {
    throw new AppError(404, 'No course offerings found for this elective group');
  }

  // Build a capacity map: courseId -> { offering, remaining capacity }
  const capacityMap = new Map<string, { offeringId: string; remaining: number }>();
  for (const off of offerings) {
    const cId = String(off.courseId);
    const existing = capacityMap.get(cId);
    const remaining = off.maxEnrollment - off.enrolledCount;
    // If multiple offerings exist per course, aggregate capacity
    if (existing) {
      existing.remaining += remaining;
    } else {
      capacityMap.set(cId, { offeringId: String(off._id), remaining });
    }
  }

  // 4. Group allocations by studentId, sort by preference
  const studentAllocations = new Map<string, typeof allocations>();
  for (const alloc of allocations) {
    const sId = String(alloc.studentId);
    const existing = studentAllocations.get(sId);
    if (existing) {
      existing.push(alloc);
    } else {
      studentAllocations.set(sId, [alloc]);
    }
  }

  // Sort each student's preferences by preference number (ascending = highest priority first)
  for (const [, prefs] of studentAllocations) {
    prefs.sort((a, b) => a.preference - b.preference);
  }

  // Sort students by their best (lowest) preference number -- first-preference students get priority
  const sortedStudents = Array.from(studentAllocations.entries()).sort(
    (a, b) => (a[1][0]?.preference ?? 999) - (b[1][0]?.preference ?? 999),
  );

  let allocated = 0;
  let unallocated = 0;
  const courseDistribution = new Map<string, number>();

  for (const [, prefs] of sortedStudents) {
    let assigned = false;

    // Try to assign their highest preference that still has capacity
    for (const alloc of prefs) {
      const cId = String(alloc.courseId);
      const cap = capacityMap.get(cId);
      if (cap && cap.remaining > 0) {
        alloc.status = 'allocated';
        await alloc.save();
        cap.remaining -= 1;
        courseDistribution.set(cId, (courseDistribution.get(cId) || 0) + 1);
        allocated += 1;
        assigned = true;

        // Reject the student's other preferences
        for (const other of prefs) {
          if (other !== alloc) {
            other.status = 'rejected';
            await other.save();
          }
        }
        break;
      }
    }

    // If all preferences full, assign to the one with most remaining capacity
    if (!assigned) {
      let bestCourseId: string | null = null;
      let bestRemaining = -1;
      for (const alloc of prefs) {
        const cId = String(alloc.courseId);
        const cap = capacityMap.get(cId);
        if (cap && cap.remaining > bestRemaining) {
          bestRemaining = cap.remaining;
          bestCourseId = cId;
        }
      }

      if (bestCourseId && bestRemaining > 0) {
        const bestAlloc = prefs.find((a) => String(a.courseId) === bestCourseId);
        if (bestAlloc) {
          bestAlloc.status = 'allocated';
          await bestAlloc.save();
          const cap = capacityMap.get(bestCourseId)!;
          cap.remaining -= 1;
          courseDistribution.set(bestCourseId, (courseDistribution.get(bestCourseId) || 0) + 1);
          allocated += 1;

          for (const other of prefs) {
            if (other !== bestAlloc) {
              other.status = 'rejected';
              await other.save();
            }
          }
        } else {
          unallocated += 1;
        }
      } else {
        unallocated += 1;
        // Reject all preferences for this student
        for (const alloc of prefs) {
          alloc.status = 'rejected';
          await alloc.save();
        }
      }
    }
  }

  await createAuditLog({
    collegeId,
    entityType: 'ElectiveAllocation',
    entityId: semesterId,
    entityName: `Elective optimization: ${electiveGroup}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'requested', newValue: `allocated: ${allocated}, unallocated: ${unallocated}` }],
    performedBy,
  });

  return {
    allocated,
    unallocated,
    courseDistribution: Array.from(courseDistribution.entries()).map(([courseId, count]) => ({ courseId, count })),
  };
}

// ═══ W02: Elective Allocation Finalization ═════════════════════

export async function finalizeElectiveAllocations(
  collegeId: string,
  semesterId: string,
  electiveGroup: string,
  performedBy: string,
) {
  // 1. Find all allocated ElectiveAllocation entries for this semester + group
  const allocations = await ElectiveAllocation.find({
    collegeId,
    semesterId,
    electiveGroup,
    status: 'allocated',
  });

  if (allocations.length === 0) {
    throw new AppError(404, 'No allocated elective allocations found to finalize');
  }

  let enrollmentsCreated = 0;

  for (const alloc of allocations) {
    // 2a. Find the CourseOffering for the allocated course in this semester
    const offering = await CourseOffering.findOne({
      collegeId,
      courseId: alloc.courseId,
      semesterId,
    });

    if (!offering) {
      // Skip if no offering found -- should not happen if optimization ran correctly
      continue;
    }

    // 2b. Create an Enrollment record
    await Enrollment.create({
      collegeId,
      studentId: alloc.studentId,
      courseOfferingId: offering._id,
      semesterId,
      status: 'enrolled',
    });

    // 2c. Increment enrolledCount
    await CourseOffering.updateOne(
      { _id: offering._id },
      { $inc: { enrolledCount: 1 } },
    );

    // 2d. Update ElectiveAllocation status to 'finalized'
    alloc.status = 'finalized';
    await alloc.save();

    enrollmentsCreated += 1;
  }

  // 3. Create audit log
  await createAuditLog({
    collegeId,
    entityType: 'ElectiveAllocation',
    entityId: semesterId,
    entityName: `Elective finalization: ${electiveGroup}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'allocated', newValue: `finalized (${enrollmentsCreated} enrollments)` }],
    performedBy,
  });

  return { enrollmentsCreated };
}

// ═══ W02: Attendance Summary Auto-Update + Threshold Monitoring ═══

/**
 * Determine attendance category based on percentage.
 */
function categorizeAttendance(percentage: number): 'safe' | 'warning' | 'at_risk' | 'detained' {
  if (percentage >= 85) return 'safe';
  if (percentage >= 75) return 'warning';
  if (percentage >= 65) return 'at_risk';
  return 'detained';
}

/**
 * Check attendance thresholds and create alerts when student crosses warning/at-risk/detained levels.
 * W02-L2-009
 */
export async function checkAttendanceThresholds(
  collegeId: string,
  studentId: string,
  courseOfferingId: string,
  semesterId: string,
  currentPercentage: number,
  category: 'safe' | 'warning' | 'at_risk' | 'detained',
) {
  // No alert for safe category
  if (category === 'safe') return null;

  let alertType: 'warning' | 'at_risk' | 'detained';
  let threshold: number;
  if (category === 'warning') {
    alertType = 'warning';
    threshold = 75;
  } else if (category === 'at_risk') {
    alertType = 'at_risk';
    threshold = 65;
  } else {
    alertType = 'detained';
    threshold = 65;
  }

  // Check if alert of this type already exists
  const existing = await AttendanceAlert.findOne({
    collegeId,
    studentId,
    courseOfferingId,
    semesterId,
    alertType,
  });

  if (existing) return null;

  const message = `Attendance at ${Math.round(currentPercentage * 100) / 100}% (below ${threshold}% threshold) for course offering ${courseOfferingId}`;

  const alert = await AttendanceAlert.create({
    collegeId,
    studentId,
    courseOfferingId,
    semesterId,
    alertType,
    attendancePercent: Math.round(currentPercentage * 100) / 100,
    threshold,
    message,
    isRead: false,
    isNotified: false,
  });

  return alert;
}

/**
 * Recompute attendance summary after attendance marking.
 * W02-L2-008
 */
export async function updateAttendanceSummary(
  collegeId: string,
  studentId: string,
  courseOfferingId: string,
) {
  // 1. Find CourseOffering to get semesterId
  const offering = await CourseOffering.findOne({ _id: courseOfferingId, collegeId });
  if (!offering) throw new AppError(404, 'Course offering not found');
  const semesterId = String(offering.semesterId);

  // 2. Count total AttendanceSessions for this courseOffering
  const totalClasses = await AttendanceSession.countDocuments({
    collegeId,
    courseOfferingId,
  });

  // 3. Count attended records (present, late, od count as attended)
  // We need session IDs for this courseOffering first
  const sessionIds = await AttendanceSession.find(
    { collegeId, courseOfferingId },
    { _id: 1 },
  ).lean();
  const sessionIdList = sessionIds.map(s => s._id);

  const attended = await AttendanceRecord.countDocuments({
    collegeId,
    studentId,
    sessionId: { $in: sessionIdList },
    status: { $in: ['present', 'late', 'od'] },
  });

  // 4. Calculate percentage (handle division by zero)
  const percentage = totalClasses > 0
    ? Math.round((attended / totalClasses) * 10000) / 100
    : 0;

  // 5. Determine category
  const category = categorizeAttendance(percentage);

  // 6. Simple projection (stub for AI forecast)
  const projectedFinal = percentage;

  // 7. Get previous summary to detect category change
  const previousSummary = await AttendanceSummary.findOne({
    collegeId,
    studentId,
    courseOfferingId,
  }).lean();
  const previousCategory = previousSummary?.category;

  // 8. Upsert AttendanceSummary
  const summary = await AttendanceSummary.findOneAndUpdate(
    { collegeId, studentId, courseOfferingId },
    {
      collegeId,
      studentId,
      courseOfferingId,
      semesterId,
      totalClasses,
      attended,
      percentage,
      category,
      projectedFinal,
      lastUpdatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // 9. If category changed (or first time), check thresholds
  if (category !== previousCategory) {
    await checkAttendanceThresholds(
      collegeId, studentId, courseOfferingId, semesterId, percentage, category,
    );
  }

  return summary;
}

/**
 * List attendance summaries with optional filters.
 * W02-L2-008, 009
 */
export async function getAttendanceSummaries(
  collegeId: string,
  filters: { studentId?: string; courseOfferingId?: string; semesterId?: string; category?: string },
  page: number,
  limit: number,
) {
  const filter: FilterQuery<IAttendanceSummary> = { collegeId };
  if (filters.studentId) filter.studentId = filters.studentId;
  if (filters.courseOfferingId) filter.courseOfferingId = filters.courseOfferingId;
  if (filters.semesterId) filter.semesterId = filters.semesterId;
  if (filters.category) filter.category = filters.category;

  return paginate(AttendanceSummary, filter, page, limit);
}

/**
 * List attendance alerts with optional filters.
 * W02-L2-009
 */
export async function getAttendanceAlerts(
  collegeId: string,
  filters: { studentId?: string; semesterId?: string; alertType?: string; isRead?: string },
  page: number,
  limit: number,
) {
  const filter: FilterQuery<IAttendanceAlert> = { collegeId };
  if (filters.studentId) filter.studentId = filters.studentId;
  if (filters.semesterId) filter.semesterId = filters.semesterId;
  if (filters.alertType) filter.alertType = filters.alertType;
  if (filters.isRead !== undefined && filters.isRead !== '') {
    filter.isRead = filters.isRead === 'true';
  }

  return paginate(AttendanceAlert, filter, page, limit);
}

// ═══ W02: Condonation Request Workflow ═══════════════════════

/**
 * Submit a new condonation request.
 */
export async function submitCondonationRequest(
  collegeId: string,
  data: {
    studentId: string;
    courseOfferingId: string;
    semesterId: string;
    reason: string;
    description: string;
    supportingDocuments?: string[];
    classesRequested: number;
  },
  performedBy: string,
) {
  const doc = await CondonationRequest.create({
    ...data,
    collegeId,
    status: 'submitted',
  });

  await createAuditLog({
    collegeId,
    entityType: 'CondonationRequest',
    entityId: String(doc._id),
    entityName: `Condonation-${String(doc._id).slice(-6)}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

/**
 * List condonation requests with optional filters.
 */
export async function listCondonationRequests(
  collegeId: string,
  filters: { studentId?: string; semesterId?: string; status?: string; courseOfferingId?: string },
  page: number,
  limit: number,
) {
  const filter: FilterQuery<ICondonationRequest> = { collegeId };
  if (filters.studentId) filter.studentId = filters.studentId;
  if (filters.semesterId) filter.semesterId = filters.semesterId;
  if (filters.status) filter.status = filters.status;
  if (filters.courseOfferingId) filter.courseOfferingId = filters.courseOfferingId;

  return paginate(CondonationRequest, filter, page, limit);
}

/**
 * Get a single condonation request.
 */
export async function getCondonationRequest(collegeId: string, id: string) {
  const doc = await CondonationRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Condonation request not found');
  return doc;
}

/**
 * Review (approve/reject) a condonation request.
 */
export async function reviewCondonationRequest(
  collegeId: string,
  id: string,
  decision: 'approved' | 'rejected',
  reviewRemarks: string | undefined,
  performedBy: string,
) {
  const doc = await CondonationRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Condonation request not found');

  if (doc.status !== 'submitted' && doc.status !== 'under_review') {
    throw new AppError(400, `Cannot review a request with status '${doc.status}'`);
  }

  doc.status = decision;
  doc.reviewedBy = performedBy as any;
  doc.reviewedAt = new Date();
  if (reviewRemarks !== undefined) {
    doc.reviewRemarks = reviewRemarks;
  }

  if (decision === 'approved') {
    doc.linkedToEligibility = true;

    // Update AttendanceSummary: add condoned classes to attended count
    const summary = await AttendanceSummary.findOne({
      collegeId,
      studentId: doc.studentId,
      courseOfferingId: doc.courseOfferingId,
    });
    if (summary) {
      summary.attended += doc.classesRequested;
      summary.percentage = summary.totalClasses > 0
        ? Math.round((summary.attended / summary.totalClasses) * 10000) / 100
        : 0;
      await summary.save();
    }
  }

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'CondonationRequest',
    entityId: String(doc._id),
    entityName: `Condonation-${String(doc._id).slice(-6)}`,
    action: 'update',
    changes: [{ field: 'status', displayName: 'Status', oldValue: 'submitted', newValue: decision }],
    performedBy,
  });

  return doc;
}

// ═══ W02: CIE Computation Engine ═══════════════════════════

export interface CIEComponentResult {
  type: string;
  rawMarks: number;
  maxMarks: number;
  normalizedMarks: number;
  weight: number;
  weightedMarks: number;
}

export interface CIEResult {
  cieMarks: number;
  totalCIEMarks: number;
  isComplete: boolean;
  components: CIEComponentResult[];
}

export interface CIEOfferingResult {
  courseOfferingId: string;
  results: Array<{
    studentId: string;
    cieMarks: number;
    totalCIEMarks: number;
    isComplete: boolean;
    components: CIEComponentResult[];
  }>;
  summary: {
    totalStudents: number;
    computed: number;
    incomplete: number;
    averageCIE: number;
  };
}

export async function computeCIE(
  collegeId: string,
  courseOfferingId: string,
  studentId: string,
): Promise<CIEResult> {
  // 1. Load CourseOffering
  const offering = await CourseOffering.findOne({ _id: courseOfferingId, collegeId });
  if (!offering) throw new AppError(404, 'Course offering not found');

  // 2. Load Course to get regulationId
  const course = await Course.findOne({ _id: offering.courseId, collegeId });
  if (!course) throw new AppError(404, 'Course not found');

  // 3. Load Regulation to get cieFormula
  const regulation = await Regulation.findOne({ _id: course.regulationId, collegeId });
  if (!regulation) throw new AppError(404, 'Regulation not found');

  // 4. Check if cieFormula is configured
  if (!regulation.cieFormula || !regulation.cieFormula.components || regulation.cieFormula.components.length === 0) {
    throw new AppError(400, 'CIE formula not configured for this regulation');
  }

  const { components: formulaComponents, totalCIEMarks } = regulation.cieFormula;

  // 5. Load all InternalAssessments for this courseOffering with valid status
  const assessments = await InternalAssessment.find({
    collegeId,
    courseOfferingId,
    status: { $in: ['marks_entered', 'finalized'] },
  }).sort({ date: 1 });

  // 6. Load all InternalMarks for those assessments for this student
  const assessmentIds = assessments.map((a) => a._id);
  const marks = await InternalMark.find({
    collegeId,
    assessmentId: { $in: assessmentIds },
    studentId,
  });

  // Build lookup: assessmentId -> mark
  const markByAssessmentId = new Map<string, number>();
  for (const m of marks) {
    markByAssessmentId.set(String(m.assessmentId), m.marksObtained);
  }

  // 7. Process each formula component
  let isComplete = true;
  const componentResults: CIEComponentResult[] = [];

  // Track which grouped components have been processed (for best_of grouping)
  const processedGroups = new Set<string>();

  for (const comp of formulaComponents) {
    // Skip if this component was already processed as part of a group
    if (comp.groupWith && processedGroups.has(comp.groupWith)) continue;
    if (processedGroups.has(comp.type)) continue;

    // For best_of with groupWith, gather both this type and the grouped type
    const typesToMatch: string[] = [comp.type];
    if (comp.aggregation === 'best_of' && comp.groupWith) {
      typesToMatch.push(comp.groupWith);
      processedGroups.add(comp.type);
      processedGroups.add(comp.groupWith);
    } else {
      processedGroups.add(comp.type);
    }

    // Find all assessments matching the types
    const matchingAssessments = assessments.filter((a) => typesToMatch.includes(a.type));

    // Find the student's marks for those assessments
    const studentMarks: { marksObtained: number; maxMarks: number; date?: Date }[] = [];
    for (const a of matchingAssessments) {
      const mark = markByAssessmentId.get(String(a._id));
      if (mark !== undefined) {
        studentMarks.push({ marksObtained: mark, maxMarks: a.maxMarks, date: a.date });
      }
    }

    // If ANY component has no marks at all, mark isComplete = false
    if (studentMarks.length === 0) {
      isComplete = false;
      componentResults.push({
        type: comp.type,
        rawMarks: 0,
        maxMarks: comp.maxMarks,
        normalizedMarks: 0,
        weight: comp.weight,
        weightedMarks: 0,
      });
      continue;
    }

    // Apply aggregation
    let rawMarks = 0;
    let rawMaxMarks = 0;

    switch (comp.aggregation) {
      case 'best_of': {
        // Normalize each mark to a common scale, then pick the best
        let bestNormalized = 0;
        let bestRaw = 0;
        let bestMax = 0;
        for (const sm of studentMarks) {
          const normalized = sm.maxMarks > 0 ? (sm.marksObtained / sm.maxMarks) * comp.maxMarks : 0;
          if (normalized > bestNormalized) {
            bestNormalized = normalized;
            bestRaw = sm.marksObtained;
            bestMax = sm.maxMarks;
          }
        }
        rawMarks = bestRaw;
        rawMaxMarks = bestMax;
        break;
      }
      case 'average': {
        const totalNormalized = studentMarks.reduce(
          (sum, sm) => sum + (sm.maxMarks > 0 ? (sm.marksObtained / sm.maxMarks) * comp.maxMarks : 0),
          0,
        );
        const avgRaw = studentMarks.reduce((sum, sm) => sum + sm.marksObtained, 0) / studentMarks.length;
        // For average, we normalize the averaged result
        const avgNormalized = totalNormalized / studentMarks.length;
        componentResults.push({
          type: comp.type,
          rawMarks: Math.round(avgRaw * 100) / 100,
          maxMarks: comp.maxMarks,
          normalizedMarks: Math.round(avgNormalized * 100) / 100,
          weight: comp.weight,
          weightedMarks: Math.round(avgNormalized * comp.weight * 100) / 100,
        });
        continue;
      }
      case 'sum': {
        rawMarks = studentMarks.reduce((sum, sm) => sum + sm.marksObtained, 0);
        rawMaxMarks = studentMarks.reduce((sum, sm) => sum + sm.maxMarks, 0);
        break;
      }
      case 'latest': {
        // Take the most recent mark by date; handle optional dates
        const withDates = studentMarks.filter((sm) => sm.date != null);
        const sorted = withDates.length > 0
          ? [...withDates].sort((a, b) => a.date!.getTime() - b.date!.getTime())
          : studentMarks;
        const latest = sorted[sorted.length - 1];
        rawMarks = latest?.marksObtained ?? 0;
        rawMaxMarks = latest?.maxMarks ?? comp.maxMarks;
        break;
      }
      default: {
        // Fallback: treat as average
        rawMarks = studentMarks.reduce((sum, sm) => sum + sm.marksObtained, 0) / studentMarks.length;
        rawMaxMarks = studentMarks[0]?.maxMarks ?? comp.maxMarks;
        break;
      }
    }

    // Normalize to the formula component's maxMarks
    const normalizedMarks = rawMaxMarks > 0 ? (rawMarks / rawMaxMarks) * comp.maxMarks : 0;
    const weightedMarks = normalizedMarks * comp.weight;

    componentResults.push({
      type: comp.type,
      rawMarks: Math.round(rawMarks * 100) / 100,
      maxMarks: comp.maxMarks,
      normalizedMarks: Math.round(normalizedMarks * 100) / 100,
      weight: comp.weight,
      weightedMarks: Math.round(weightedMarks * 100) / 100,
    });
  }

  // 8. Sum all weightedMarks to get cieMarks
  const rawCIE = componentResults.reduce((sum, c) => sum + c.weightedMarks, 0);

  // 9. If incomplete, do NOT compute partial CIE — return 0
  // Cap at totalCIEMarks for complete results
  const cieMarks = isComplete
    ? Math.min(Math.round(rawCIE * 100) / 100, totalCIEMarks)
    : 0;

  // 10. Return breakdown
  return {
    cieMarks,
    totalCIEMarks,
    isComplete,
    components: componentResults,
  };
}

export async function computeCIEForOffering(
  collegeId: string,
  courseOfferingId: string,
  performedBy: string,
): Promise<CIEOfferingResult> {
  // Verify the course offering exists
  const offering = await CourseOffering.findOne({ _id: courseOfferingId, collegeId });
  if (!offering) throw new AppError(404, 'Course offering not found');

  // 1. Load all enrollments for this courseOfferingId with status 'enrolled'
  const enrollments = await Enrollment.find({
    collegeId,
    courseOfferingId,
    status: 'enrolled',
  });

  if (enrollments.length === 0) {
    throw new AppError(400, 'No enrolled students found for this course offering');
  }

  // 2. For each enrolled student, call computeCIE()
  const results: CIEOfferingResult['results'] = [];
  let incompleteCount = 0;
  let totalCIE = 0;

  for (const enrollment of enrollments) {
    const studentResult = await computeCIE(collegeId, courseOfferingId, String(enrollment.studentId));
    const entry = {
      studentId: String(enrollment.studentId),
      cieMarks: studentResult.cieMarks,
      totalCIEMarks: studentResult.totalCIEMarks,
      isComplete: studentResult.isComplete,
      components: studentResult.components,
    };
    results.push(entry);
    totalCIE += studentResult.cieMarks;
    if (!studentResult.isComplete) incompleteCount++;
  }

  // 3. Aggregate summary stats
  const computedCount = results.length;
  const averageCIE = computedCount > 0
    ? Math.round((totalCIE / computedCount) * 100) / 100
    : 0;

  // 4. Create audit log
  await createAuditLog({
    collegeId,
    entityType: 'CourseOffering',
    entityId: courseOfferingId,
    entityName: `CIE-Computation-${courseOfferingId.slice(-6)}`,
    action: 'update',
    changes: [{
      field: 'cieComputation',
      displayName: 'CIE Computation',
      oldValue: '',
      newValue: `Computed for ${computedCount} students, ${incompleteCount} incomplete`,
    }],
    performedBy,
  });

  return {
    courseOfferingId,
    results,
    summary: {
      totalStudents: enrollments.length,
      computed: computedCount,
      incomplete: incompleteCount,
      averageCIE,
    },
  };
}

// ═══ W02: Assignments ═══════════════════════════════════════

export async function listAssignments(collegeId: string, page: number, limit: number, courseOfferingId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (courseOfferingId) filter.courseOfferingId = courseOfferingId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Assignment, filter, page, limit, { createdAt: -1 }, ['courseOfferingId', 'createdBy']);
}

export async function getAssignment(collegeId: string, id: string) {
  const doc = await Assignment.findOne({ _id: id, collegeId }).populate('courseOfferingId').populate('createdBy');
  if (!doc) throw new AppError(404, 'Assignment not found');
  return doc;
}

export async function createAssignment(collegeId: string, data: any, performedBy: string) {
  const doc = await Assignment.create({ ...data, collegeId, createdBy: data.createdBy || performedBy });
  await createAuditLog({
    collegeId, entityType: 'Assignment', entityId: String(doc._id),
    entityName: doc.title, action: 'create', changes: [], performedBy,
  });
  return doc;
}

export async function updateAssignment(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Assignment.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Assignment not found');
  await createAuditLog({
    collegeId, entityType: 'Assignment', entityId: String(doc._id),
    entityName: doc.title, action: 'update', changes: [], performedBy,
  });
  return doc;
}

export async function deleteAssignment(collegeId: string, id: string, performedBy: string) {
  const doc = await Assignment.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Assignment not found');
  await createAuditLog({
    collegeId, entityType: 'Assignment', entityId: String(doc._id),
    entityName: doc.title, action: 'delete', changes: [], performedBy,
  });
  return { deleted: true };
}

// ═══ W02: Submissions ═══════════════════════════════════════

export async function listSubmissions(collegeId: string, assignmentId: string) {
  return Submission.find({ collegeId, assignmentId }).populate(STUDENT_POPULATE).lean();
}

export async function getSubmission(collegeId: string, id: string) {
  const doc = await Submission.findOne({ _id: id, collegeId }).populate(STUDENT_POPULATE);
  if (!doc) throw new AppError(404, 'Submission not found');
  return doc;
}

export async function createSubmission(collegeId: string, data: any, performedBy: string) {
  // Auto-check isLate by comparing with assignment's dueDate
  const assignment = await Assignment.findOne({ _id: data.assignmentId, collegeId });
  if (!assignment) throw new AppError(404, 'Assignment not found');

  const submittedAt = new Date();
  const isLate = submittedAt > assignment.dueDate;
  const status = isLate ? 'late' : 'submitted';

  const doc = await Submission.create({ ...data, collegeId, submittedAt, isLate, status });
  await createAuditLog({
    collegeId, entityType: 'Submission', entityId: String(doc._id),
    entityName: `Submission-${String(doc._id).slice(-6)}`, action: 'create', changes: [], performedBy,
  });
  return doc;
}

export async function gradeSubmission(collegeId: string, id: string, marksObtained: number, remarks: string | undefined, performedBy: string) {
  const doc = await Submission.findOneAndUpdate(
    { _id: id, collegeId },
    { $set: { marksObtained, remarks, gradedBy: performedBy, gradedAt: new Date(), status: 'graded' } },
    { new: true },
  );
  if (!doc) throw new AppError(404, 'Submission not found');
  await createAuditLog({
    collegeId, entityType: 'Submission', entityId: String(doc._id),
    entityName: `Submission-${String(doc._id).slice(-6)}`, action: 'update',
    changes: [{ field: 'marksObtained', displayName: 'Marks Obtained', oldValue: '', newValue: String(marksObtained) }],
    performedBy,
  });
  return doc;
}

export async function deleteSubmission(collegeId: string, id: string, performedBy: string) {
  const doc = await Submission.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Submission not found');
  await createAuditLog({
    collegeId, entityType: 'Submission', entityId: String(doc._id),
    entityName: `Submission-${String(doc._id).slice(-6)}`, action: 'delete', changes: [], performedBy,
  });
  return { deleted: true };
}

// ═══ W02: Quizzes ═══════════════════════════════════════════

export async function listQuizzes(collegeId: string, page: number, limit: number, courseOfferingId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (courseOfferingId) filter.courseOfferingId = courseOfferingId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(Quiz, filter, page, limit, { createdAt: -1 }, ['courseOfferingId', 'createdBy']);
}

export async function getQuiz(collegeId: string, id: string) {
  const doc = await Quiz.findOne({ _id: id, collegeId }).populate('courseOfferingId').populate('createdBy');
  if (!doc) throw new AppError(404, 'Quiz not found');
  return doc;
}

export async function createQuiz(collegeId: string, data: any, performedBy: string) {
  const doc = await Quiz.create({ ...data, collegeId, createdBy: data.createdBy || performedBy });
  await createAuditLog({
    collegeId, entityType: 'Quiz', entityId: String(doc._id),
    entityName: doc.title, action: 'create', changes: [], performedBy,
  });
  return doc;
}

export async function updateQuiz(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Quiz.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Quiz not found');
  await createAuditLog({
    collegeId, entityType: 'Quiz', entityId: String(doc._id),
    entityName: doc.title, action: 'update', changes: [], performedBy,
  });
  return doc;
}

export async function deleteQuiz(collegeId: string, id: string, performedBy: string) {
  const doc = await Quiz.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Quiz not found');
  await createAuditLog({
    collegeId, entityType: 'Quiz', entityId: String(doc._id),
    entityName: doc.title, action: 'delete', changes: [], performedBy,
  });
  return { deleted: true };
}

// ═══ W02: Quiz Attempts ═════════════════════════════════════

export async function listQuizAttempts(collegeId: string, quizId: string) {
  return QuizAttempt.find({ collegeId, quizId }).populate(STUDENT_POPULATE).lean();
}

export async function getQuizAttempt(collegeId: string, id: string) {
  const doc = await QuizAttempt.findOne({ _id: id, collegeId }).populate(STUDENT_POPULATE);
  if (!doc) throw new AppError(404, 'Quiz attempt not found');
  return doc;
}

export async function submitQuizAttempt(collegeId: string, data: any, performedBy: string) {
  // 1. Look up the quiz to get questions for auto-grading
  const quiz = await Quiz.findOne({ _id: data.quizId, collegeId });
  if (!quiz) throw new AppError(404, 'Quiz not found');

  const now = new Date();

  // 2. Auto-grade answers
  let totalMarks = 0;
  let allAutoGradeable = true;
  const gradedAnswers = (data.answers as { questionIndex: number; answer: string }[]).map((ans) => {
    const question = quiz.questions[ans.questionIndex];
    if (!question) {
      return { ...ans, isCorrect: false, marksAwarded: 0 };
    }

    if (question.type === 'mcq' || question.type === 'true_false') {
      const isCorrect = ans.answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
      const marksAwarded = isCorrect ? question.marks : 0;
      totalMarks += marksAwarded;
      return { ...ans, isCorrect, marksAwarded };
    } else {
      // short_answer cannot be auto-graded
      allAutoGradeable = false;
      return { ...ans, isCorrect: undefined, marksAwarded: undefined };
    }
  });

  const doc = await QuizAttempt.create({
    collegeId,
    quizId: data.quizId,
    studentId: data.studentId,
    startedAt: now,
    submittedAt: now,
    answers: gradedAnswers,
    totalMarks,
    autoGraded: allAutoGradeable,
    status: allAutoGradeable ? 'graded' : 'submitted',
  });

  await createAuditLog({
    collegeId, entityType: 'QuizAttempt', entityId: String(doc._id),
    entityName: `QuizAttempt-${String(doc._id).slice(-6)}`, action: 'create', changes: [], performedBy,
  });
  return doc;
}

export async function deleteQuizAttempt(collegeId: string, id: string, performedBy: string) {
  const doc = await QuizAttempt.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Quiz attempt not found');
  await createAuditLog({
    collegeId, entityType: 'QuizAttempt', entityId: String(doc._id),
    entityName: `QuizAttempt-${String(doc._id).slice(-6)}`, action: 'delete', changes: [], performedBy,
  });
  return { deleted: true };
}

// ═══ W02: Course Delivery Progress ══════════════════════════

export async function updateCourseDeliveryProgress(
  collegeId: string,
  courseOfferingId: string,
  _performedBy: string,
) {
  // 1. Verify CourseOffering exists
  const offering = await CourseOffering.findOne({ _id: courseOfferingId, collegeId });
  if (!offering) throw new AppError(404, 'Course offering not found');

  // 2. Count lesson plans by status
  const lessonPlans = await LessonPlan.find({ collegeId, courseOfferingId });
  const total = lessonPlans.length;
  if (total === 0) {
    return { courseOfferingId, syllabusProgress: 0, totalTopics: 0, completed: 0, skipped: 0, planned: 0 };
  }

  const completed = lessonPlans.filter(lp => lp.status === 'completed').length;
  const skipped = lessonPlans.filter(lp => lp.status === 'skipped').length;
  const planned = lessonPlans.filter(lp => lp.status === 'planned').length;

  // 3. Calculate progress = (completed / total) * 100, rounded to integer
  const syllabusProgress = Math.round((completed / total) * 100);

  // 4. Update CourseOffering
  offering.syllabusProgress = syllabusProgress;
  await offering.save();

  return {
    courseOfferingId,
    syllabusProgress,
    totalTopics: total,
    completed,
    skipped,
    planned,
  };
}

export async function getCourseDeliveryOverview(
  collegeId: string,
  semesterId: string,
) {
  // 1. Get all course offerings for this semester
  const offerings = await CourseOffering.find({ collegeId, semesterId }).populate('courseId').lean();

  // 2. For each offering, get lesson plan counts
  const result = [];
  for (const offering of offerings) {
    const total = await LessonPlan.countDocuments({ collegeId, courseOfferingId: offering._id });
    const completed = await LessonPlan.countDocuments({ collegeId, courseOfferingId: offering._id, status: 'completed' });

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 3. Compute expected progress: compare completed vs total with a flag if below 50%
    const belowExpected = progress < 50 && total > 0;

    result.push({
      courseOfferingId: String(offering._id),
      courseId: String(offering.courseId),
      syllabusProgress: progress,
      totalTopics: total,
      completed,
      belowExpected,
    });
  }

  return {
    semesterId,
    offerings: result,
    summary: {
      totalOfferings: result.length,
      belowExpectedCount: result.filter(r => r.belowExpected).length,
      averageProgress: result.length > 0
        ? Math.round(result.reduce((sum, r) => sum + r.syllabusProgress, 0) / result.length)
        : 0,
    },
  };
}

// ═══ W02: Hall Ticket Eligibility ═══════════════════════════

export interface EligibilityResult {
  studentId: string;
  courseOfferingId: string;
  courseId: string;
  isEligible: boolean;
  reasons: string[];
  attendancePercent: number;
  hasCondonation: boolean;
  feeClearance: 'cleared' | 'outstanding' | 'unknown';
}

export async function checkHallTicketEligibility(
  collegeId: string,
  studentId: string,
  semesterId: string,
): Promise<EligibilityResult[]> {
  // 1. Get all enrollments for this student in this semester (status: 'enrolled')
  const enrollments = await Enrollment.find({
    collegeId,
    studentId,
    semesterId,
    status: 'enrolled',
  });

  if (enrollments.length === 0) {
    throw new AppError(404, 'No active enrollments found for this student in the given semester');
  }

  const results: EligibilityResult[] = [];

  for (const enrollment of enrollments) {
    const courseOfferingId = String(enrollment.courseOfferingId);
    const reasons: string[] = [];
    let attendanceOk = true;
    let hasCondonation = false;
    let attendancePercent = 0;

    // 2a. Attendance check
    const summary = await AttendanceSummary.findOne({
      collegeId,
      studentId,
      courseOfferingId,
    });

    if (summary) {
      attendancePercent = summary.percentage;
      if (summary.percentage < 75) {
        // Check for approved condonation
        const condonation = await CondonationRequest.findOne({
          collegeId,
          studentId,
          courseOfferingId,
          status: 'approved',
        });
        if (condonation) {
          hasCondonation = true;
          // Attendance OK due to condonation
        } else {
          attendanceOk = false;
          reasons.push(`Attendance below 75% (${Math.round(attendancePercent)}%)`);
        }
      }
    }
    // If no summary found, attendance is treated as OK (no data to block)

    // 2b. Fee clearance check
    const outstandingFees = await FeeLineItem.find({
      collegeId,
      studentId,
      status: { $nin: ['paid', 'waived'] },
    });

    const totalFeeItems = await FeeLineItem.countDocuments({
      collegeId,
      studentId,
    });

    let feeClearance: 'cleared' | 'outstanding' | 'unknown';
    if (totalFeeItems === 0) {
      feeClearance = 'unknown';
    } else if (outstandingFees.length > 0) {
      feeClearance = 'outstanding';
      reasons.push('Outstanding fee dues');
    } else {
      feeClearance = 'cleared';
    }

    // 2c. Combine: isEligible = attendance OK AND (feeClearance === 'cleared' OR feeClearance === 'unknown')
    const isEligible = attendanceOk && (feeClearance === 'cleared' || feeClearance === 'unknown');

    // Get courseId from the course offering
    const offering = await CourseOffering.findOne({ _id: courseOfferingId, collegeId });
    const courseId = offering ? String(offering.courseId) : '';

    results.push({
      studentId,
      courseOfferingId,
      courseId,
      isEligible,
      reasons,
      attendancePercent,
      hasCondonation,
      feeClearance,
    });
  }

  return results;
}

export async function checkBulkEligibility(
  collegeId: string,
  semesterId: string,
  performedBy: string,
): Promise<{
  semesterId: string;
  results: EligibilityResult[];
  summary: {
    totalStudents: number;
    eligible: number;
    ineligible: number;
    attendanceIssues: number;
    feeIssues: number;
  };
}> {
  // 1. Get all unique studentIds from enrolled enrollments in this semester
  const enrollments = await Enrollment.find({
    collegeId,
    semesterId,
    status: 'enrolled',
  }).select('studentId');

  const uniqueStudentIds = [...new Set(enrollments.map(e => String(e.studentId)))];

  if (uniqueStudentIds.length === 0) {
    throw new AppError(404, 'No enrolled students found for this semester');
  }

  // 2. For each student, call checkHallTicketEligibility
  const allResults: EligibilityResult[] = [];
  for (const sid of uniqueStudentIds) {
    const studentResults = await checkHallTicketEligibility(collegeId, sid, semesterId);
    allResults.push(...studentResults);
  }

  // 3. Compute summary
  const eligibleResults = allResults.filter(r => r.isEligible);
  const ineligibleResults = allResults.filter(r => !r.isEligible);
  const attendanceIssues = allResults.filter(r =>
    r.reasons.some(reason => reason.startsWith('Attendance below')),
  ).length;
  const feeIssues = allResults.filter(r =>
    r.reasons.includes('Outstanding fee dues'),
  ).length;

  // 4. Audit log
  await createAuditLog({
    collegeId,
    entityType: 'Semester',
    entityId: semesterId,
    entityName: `Bulk Eligibility Check - ${semesterId}`,
    action: 'create',
    changes: [{
      field: 'bulkEligibilityCheck',
      displayName: 'Bulk Eligibility Check',
      oldValue: null,
      newValue: `${uniqueStudentIds.length} students, ${eligibleResults.length} eligible, ${ineligibleResults.length} ineligible`,
    }],
    performedBy,
  });

  return {
    semesterId,
    results: allResults,
    summary: {
      totalStudents: uniqueStudentIds.length,
      eligible: eligibleResults.length,
      ineligible: ineligibleResults.length,
      attendanceIssues,
      feeIssues,
    },
  };
}

// ═══ W02: Exam Fee Invoice Generation ═══════════════════════

export async function generateExamFeeInvoice(
  collegeId: string,
  studentId: string,
  semesterId: string,
  examType: string,
  feeAmount: number,
  performedBy: string,
) {
  const invoiceNumber = `EXM-${semesterId.slice(-4)}-${Date.now()}`;
  const invoice = await Invoice.create({
    collegeId,
    invoiceNumber,
    studentId,
    type: 'fee',
    items: [{ description: `Exam fee - ${examType}`, amount: feeAmount }],
    totalAmount: feeAmount,
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: 'issued',
    issuedDate: new Date(),
    examType,
    semesterId,
  });

  await createAuditLog({
    collegeId,
    entityType: 'Invoice',
    entityId: String(invoice._id),
    entityName: invoiceNumber,
    action: 'create',
    changes: [],
    performedBy,
  });

  return invoice;
}

// ═══ W02: Seating Plan CRUD ═════════════════════════════════

export async function listSeatingPlans(collegeId: string, page: number, limit: number, examScheduleId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (examScheduleId) filter.examScheduleId = examScheduleId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(SeatingPlan, filter, page, limit, { createdAt: -1 }, ['examScheduleId']);
}

export async function createSeatingPlan(collegeId: string, data: any, performedBy: string) {
  const doc = await SeatingPlan.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'SeatingPlan', entityId: String(doc._id), entityName: doc.roomName, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateSeatingPlan(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await SeatingPlan.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Seating plan not found');
  return doc;
}

export async function deleteSeatingPlan(collegeId: string, id: string, _performedBy: string) {
  const doc = await SeatingPlan.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Seating plan not found');
  return { deleted: true };
}

// ═══ W02: Invigilation Roster CRUD ══════════════════════════

export async function listInvigilationRosters(collegeId: string, page: number, limit: number, examScheduleId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (examScheduleId) filter.examScheduleId = examScheduleId;
  if (authScope) applyAuthScope(filter, authScope);
  return paginate(InvigilationRoster, filter, page, limit, { createdAt: -1 }, ['examScheduleId']);
}

export async function createInvigilationRoster(collegeId: string, data: any, performedBy: string) {
  const doc = await InvigilationRoster.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'InvigilationRoster', entityId: String(doc._id), entityName: `Roster for ${String(doc.examScheduleId)}`, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updateInvigilationRoster(collegeId: string, id: string, data: any, _performedBy: string) {
  const doc = await InvigilationRoster.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Invigilation roster not found');
  return doc;
}

export async function deleteInvigilationRoster(collegeId: string, id: string, _performedBy: string) {
  const doc = await InvigilationRoster.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Invigilation roster not found');
  return { deleted: true };
}

// ═══ W02: Hall Ticket Generation ════════════════════════════

export async function generateHallTickets(
  collegeId: string,
  semesterId: string,
  examType: string,
  performedBy: string,
): Promise<{
  generated: number;
  skipped: number;
  tickets: Array<{ studentId: string; hallTicketNumber: string; eligibilityStatus: string; courseCount: number }>;
}> {
  // 1. Get all eligibility results
  const bulkResult = await checkBulkEligibility(collegeId, semesterId, performedBy);
  const allResults = bulkResult.results;

  // 2. Group results by studentId
  const byStudent = new Map<string, EligibilityResult[]>();
  for (const r of allResults) {
    const existing = byStudent.get(r.studentId) || [];
    existing.push(r);
    byStudent.set(r.studentId, existing);
  }

  let generated = 0;
  let skipped = 0;
  const tickets: Array<{ studentId: string; hallTicketNumber: string; eligibilityStatus: string; courseCount: number }> = [];

  let index = 0;
  for (const [studentId, results] of byStudent) {
    // 3a. Determine overall eligibility status
    const eligibleCount = results.filter(r => r.isEligible).length;
    let eligibilityStatus: string;
    if (eligibleCount === results.length) {
      eligibilityStatus = 'eligible';
    } else if (eligibleCount > 0) {
      eligibilityStatus = 'conditional';
    } else {
      eligibilityStatus = 'ineligible';
    }

    // 3b. Collect reasons for ineligible courses
    const reasons = results
      .filter(r => !r.isEligible)
      .flatMap(r => r.reasons);

    // 3c. Generate hallTicketNumber
    const hallTicketNumber = `HT-${semesterId.slice(-4)}-${String(index + 1).padStart(4, '0')}`;

    // 3d. Get courseIds from the course offerings
    const courseOfferingIds = results.map(r => r.courseOfferingId);
    const offerings = await CourseOffering.find({ _id: { $in: courseOfferingIds }, collegeId }).select('courseId');
    const courses = offerings.map(o => ({ courseId: o.courseId }));

    // 3e. Upsert HallTicket
    const ticket = await HallTicket.findOneAndUpdate(
      { collegeId, studentId, semesterId },
      {
        $set: {
          collegeId,
          studentId,
          semesterId,
          hallTicketNumber,
          examType,
          courses,
          eligibilityStatus,
          reasons,
          issuedAt: eligibilityStatus !== 'ineligible' ? new Date() : undefined,
          status: eligibilityStatus !== 'ineligible' ? 'issued' : 'draft',
        },
      },
      { upsert: true, new: true },
    );

    if (eligibilityStatus === 'ineligible') {
      skipped++;
    } else {
      generated++;
    }

    tickets.push({
      studentId,
      hallTicketNumber: String(ticket.hallTicketNumber),
      eligibilityStatus,
      courseCount: courses.length,
    });

    index++;
  }

  // 4. Audit log
  await createAuditLog({
    collegeId,
    entityType: 'HallTicket',
    entityId: semesterId,
    entityName: `Hall Ticket Generation - ${semesterId}`,
    action: 'create',
    changes: [{
      field: 'hallTicketGeneration',
      displayName: 'Hall Ticket Generation',
      oldValue: null,
      newValue: `Generated: ${generated}, Skipped: ${skipped}`,
    }],
    performedBy,
  });

  return { generated, skipped, tickets };
}

export async function listHallTickets(collegeId: string, page: number, limit: number, semesterId?: string, studentId?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (studentId) filter.studentId = studentId;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(HallTicket, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'semesterId', 'courses.courseId'] as any);
}

export async function getHallTicket(collegeId: string, id: string) {
  const doc = await HallTicket.findOne({ _id: id, collegeId })
    .populate(STUDENT_POPULATE)
    .populate('semesterId')
    .populate('courses.courseId');
  if (!doc) throw new AppError(404, 'Hall ticket not found');
  return doc;
}

// ═══ W02: Bulk Mark Entry with Anomaly Detection (Task 5) ═══════

export async function bulkEnterExternalMarks(
  collegeId: string,
  semesterId: string,
  courseId: string,
  examType: string,
  marks: Array<{
    studentId: string;
    marksObtained: number;
    maxMarks: number;
  }>,
  performedBy: string,
): Promise<{
  entered: number;
  anomaliesDetected: number;
  results: Array<{
    studentId: string;
    marksObtained: number;
    anomalyFlags: string[];
    result: string;
  }>;
}> {
  // Pre-compute stats for anomaly detection
  const totalMarks = marks.reduce((sum, m) => sum + m.marksObtained, 0);
  const avgMarks = marks.length > 0 ? totalMarks / marks.length : 0;

  // Count occurrences of each mark value for suspicious pattern detection
  const markCounts = new Map<number, number>();
  for (const m of marks) {
    markCounts.set(m.marksObtained, (markCounts.get(m.marksObtained) || 0) + 1);
  }

  const results: Array<{
    studentId: string;
    marksObtained: number;
    anomalyFlags: string[];
    result: string;
  }> = [];
  let anomaliesDetected = 0;

  for (const entry of marks) {
    // Anomaly detection
    const anomalyFlags: string[] = [];

    if (entry.marksObtained > entry.maxMarks) {
      anomalyFlags.push('marks_above_max');
    }
    if (entry.marksObtained > avgMarks + 30) {
      anomalyFlags.push('sudden_jump');
    }
    const sameMarkCount = markCounts.get(entry.marksObtained) || 0;
    if (sameMarkCount >= 5) {
      anomalyFlags.push('suspicious_pattern');
    }
    if (entry.marksObtained === 0) {
      anomalyFlags.push('zero_marks');
    }

    if (anomalyFlags.length > 0) {
      anomaliesDetected++;
    }

    // Determine result
    let result: string;
    if (entry.marksObtained === 0) {
      result = 'absent';
    } else if (entry.marksObtained >= 0.4 * entry.maxMarks) {
      result = 'pass';
    } else {
      result = 'fail';
    }

    // Upsert ExternalMark
    await ExternalMark.findOneAndUpdate(
      { collegeId, studentId: entry.studentId, courseId, semesterId, examType },
      {
        collegeId,
        studentId: entry.studentId,
        courseId,
        semesterId,
        examType,
        maxMarks: entry.maxMarks,
        marksObtained: entry.marksObtained,
        result,
        enteredBy: performedBy,
        anomalyFlags,
      },
      { upsert: true, new: true },
    );

    results.push({
      studentId: entry.studentId,
      marksObtained: entry.marksObtained,
      anomalyFlags,
      result,
    });
  }

  // Audit log
  await createAuditLog({
    collegeId,
    entityType: 'ExternalMark',
    entityId: courseId,
    entityName: `Bulk External Marks - ${courseId}`,
    action: 'create',
    changes: [{
      field: 'bulkMarkEntry',
      displayName: 'Bulk Mark Entry',
      oldValue: null,
      newValue: `Entered: ${results.length}, Anomalies: ${anomaliesDetected}`,
    }],
    performedBy,
  });

  return { entered: results.length, anomaliesDetected, results };
}

export async function validateExternalMarks(
  collegeId: string,
  semesterId: string,
  courseId: string,
  performedBy: string,
): Promise<{ validated: number }> {
  const result = await ExternalMark.updateMany(
    { collegeId, semesterId, courseId, validatedBy: null },
    { $set: { validatedBy: performedBy, validatedAt: new Date() } },
  );

  await createAuditLog({
    collegeId,
    entityType: 'ExternalMark',
    entityId: courseId,
    entityName: `Validate External Marks - ${courseId}`,
    action: 'update',
    changes: [{
      field: 'validation',
      displayName: 'Mark Validation',
      oldValue: null,
      newValue: `Validated: ${result.modifiedCount}`,
    }],
    performedBy,
  });

  return { validated: result.modifiedCount };
}

// ═══ W02: Grade Computation Engine (Task 6) ═════════════════════

const DEFAULT_GRADING_SCALE = [
  { grade: 'O', minMarks: 90, maxMarks: 100, gradePoints: 10 },
  { grade: 'A+', minMarks: 80, maxMarks: 89, gradePoints: 9 },
  { grade: 'A', minMarks: 70, maxMarks: 79, gradePoints: 8 },
  { grade: 'B+', minMarks: 60, maxMarks: 69, gradePoints: 7 },
  { grade: 'B', minMarks: 50, maxMarks: 59, gradePoints: 6 },
  { grade: 'C', minMarks: 40, maxMarks: 49, gradePoints: 5 },
  { grade: 'F', minMarks: 0, maxMarks: 39, gradePoints: 0 },
];

const DEFAULT_PASSING_CRITERIA = { internalMin: 40, externalMin: 40, totalMin: 40 };

export function computeGrade(
  totalMarksPercent: number,
  internalMarks: number,
  internalMax: number,
  externalMarks: number,
  externalMax: number,
  gradingScale: Array<{ grade: string; minMarks: number; maxMarks: number; gradePoints: number }>,
  passingCriteria: { internalMin: number; externalMin: number; totalMin: number },
): { grade: string; gradePoints: number; result: 'pass' | 'fail' } {
  // Check passing criteria (values are percentages)
  const internalPercent = internalMax > 0 ? (internalMarks / internalMax) * 100 : 0;
  const externalPercent = externalMax > 0 ? (externalMarks / externalMax) * 100 : 0;

  if (
    internalPercent < passingCriteria.internalMin ||
    externalPercent < passingCriteria.externalMin ||
    totalMarksPercent < passingCriteria.totalMin
  ) {
    return { grade: 'F', gradePoints: 0, result: 'fail' };
  }

  // Look up grading scale
  const entry = gradingScale.find(
    (g) => totalMarksPercent >= g.minMarks && totalMarksPercent <= g.maxMarks,
  );

  if (entry) {
    return { grade: entry.grade, gradePoints: entry.gradePoints, result: 'pass' };
  }

  // Fallback — should not happen with a well-configured scale
  return { grade: 'F', gradePoints: 0, result: 'fail' };
}

export async function computeGradesForSemester(
  collegeId: string,
  semesterId: string,
  performedBy: string,
): Promise<{
  processed: number;
  passed: number;
  failed: number;
  backlogsCreated: number;
  gradeCards: Array<{
    studentId: string;
    courseId: string;
    grade: string;
    gradePoints: number;
    result: string;
  }>;
}> {
  // 1. Get all CourseOfferings for this semester
  const offerings = await CourseOffering.find({ collegeId, semesterId });

  let processed = 0;
  let passed = 0;
  let failed = 0;
  let backlogsCreated = 0;
  const gradeCards: Array<{
    studentId: string;
    courseId: string;
    grade: string;
    gradePoints: number;
    result: string;
  }> = [];

  for (const offering of offerings) {
    // 2. Get course and regulation
    const course = await Course.findOne({ _id: offering.courseId, collegeId });
    if (!course) continue;

    const regulation = await Regulation.findOne({ _id: course.regulationId, collegeId });
    if (!regulation) continue;

    const gradingScale = regulation.gradingScale && regulation.gradingScale.length > 0
      ? regulation.gradingScale
      : DEFAULT_GRADING_SCALE;

    const passingCriteria = regulation.passingCriteria && regulation.passingCriteria.internalMin != null
      ? regulation.passingCriteria
      : DEFAULT_PASSING_CRITERIA;

    // 3. Get all enrollments for this offering
    const enrollments = await Enrollment.find({
      collegeId,
      courseOfferingId: offering._id,
      status: { $in: ['enrolled', 'completed'] },
    });

    for (const enrollment of enrollments) {
      const studentId = String(enrollment.studentId);
      const courseId = String(offering.courseId);
      const courseOfferingId = String(offering._id);

      // 4a. Get CIE marks
      let cieMarks = 0;
      let totalCIEMarks = 0;
      try {
        const cieResult = await computeCIE(collegeId, courseOfferingId, studentId);
        cieMarks = cieResult.cieMarks;
        totalCIEMarks = cieResult.totalCIEMarks;
      } catch (_e) {
        // CIE not available — use 0
      }

      // 4b. Get external marks
      const extMark = await ExternalMark.findOne({
        collegeId,
        studentId: enrollment.studentId,
        courseId: offering.courseId,
        semesterId,
      });
      const externalMarks = extMark ? extMark.marksObtained : 0;
      const externalMax = extMark ? extMark.maxMarks : 100;

      // 4c. Compute total
      const internalMarks = cieMarks;
      const internalMax = totalCIEMarks || 40; // default CIE max
      const totalMarks = internalMarks + externalMarks;
      const totalMax = internalMax + externalMax;
      const totalMarksPercent = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;

      // 4d. Compute grade
      const gradeResult = computeGrade(
        totalMarksPercent,
        internalMarks,
        internalMax,
        externalMarks,
        externalMax,
        gradingScale,
        passingCriteria,
      );

      // 4e. Upsert GradeCard
      await GradeCard.findOneAndUpdate(
        { collegeId, studentId: enrollment.studentId, semesterId, courseId: offering.courseId },
        {
          collegeId,
          studentId: enrollment.studentId,
          semesterId,
          courseId: offering.courseId,
          internalMarks,
          externalMarks,
          totalMarks,
          grade: gradeResult.grade,
          gradePoints: gradeResult.gradePoints,
          credits: course.credits,
          result: gradeResult.result,
        },
        { upsert: true, new: true },
      );

      // 4f. If fail, create Backlog
      if (gradeResult.result === 'fail') {
        await Backlog.findOneAndUpdate(
          { collegeId, studentId: enrollment.studentId, courseId: offering.courseId },
          {
            collegeId,
            studentId: enrollment.studentId,
            courseId: offering.courseId,
            semesterId,
            originalExamType: 'regular',
            attempts: 1,
            currentStatus: 'created',
          },
          { upsert: true, new: true },
        );
        backlogsCreated++;
        failed++;
      } else {
        passed++;
      }

      processed++;
      gradeCards.push({
        studentId,
        courseId,
        grade: gradeResult.grade,
        gradePoints: gradeResult.gradePoints,
        result: gradeResult.result,
      });
    }
  }

  // 5. Audit log
  await createAuditLog({
    collegeId,
    entityType: 'GradeCard',
    entityId: semesterId,
    entityName: `Grade Computation - ${semesterId}`,
    action: 'create',
    changes: [{
      field: 'gradeComputation',
      displayName: 'Grade Computation',
      oldValue: null,
      newValue: `Processed: ${processed}, Passed: ${passed}, Failed: ${failed}, Backlogs: ${backlogsCreated}`,
    }],
    performedBy,
  });

  return { processed, passed, failed, backlogsCreated, gradeCards };
}

// ═══ W02: SGPA/CGPA Computation ═══════════════════════════════

export function computeSGPA(
  gradeCards: Array<{ gradePoints: number; credits: number }>,
): number {
  let totalWeighted = 0;
  let totalCredits = 0;
  for (const gc of gradeCards) {
    if (gc.credits === 0) continue; // skip audit courses
    totalWeighted += gc.gradePoints * gc.credits;
    totalCredits += gc.credits;
  }
  if (totalCredits === 0) return 0;
  return Math.round((totalWeighted / totalCredits) * 100) / 100;
}

export function computeCGPA(
  allGradeCards: Array<{ courseId: string; gradePoints: number; credits: number }>,
): number {
  // Deduplicate by courseId — keep last entry (latest attempt)
  const latestByCourse = new Map<string, { gradePoints: number; credits: number }>();
  for (const gc of allGradeCards) {
    latestByCourse.set(gc.courseId, { gradePoints: gc.gradePoints, credits: gc.credits });
  }
  let totalWeighted = 0;
  let totalCredits = 0;
  for (const entry of latestByCourse.values()) {
    if (entry.credits === 0) continue; // skip audit courses
    totalWeighted += entry.gradePoints * entry.credits;
    totalCredits += entry.credits;
  }
  if (totalCredits === 0) return 0;
  return Math.round((totalWeighted / totalCredits) * 100) / 100;
}

export async function computeSemesterResults(
  collegeId: string,
  semesterId: string,
  performedBy: string,
): Promise<{
  processed: number;
  results: Array<{
    studentId: string;
    sgpa: number;
    cgpa: number;
    totalCreditsEarned: number;
    totalCreditsRegistered: number;
    backlogs: number;
    result: string;
  }>;
}> {
  // 1. Get all unique studentIds who have GradeCards for this semester
  const semGradeCards = await GradeCard.find({ collegeId, semesterId }).lean();
  const studentIds = [...new Set(semGradeCards.map(gc => String(gc.studentId)))];

  if (studentIds.length === 0) {
    throw new AppError(404, 'No grade cards found for the given semester');
  }

  const results: Array<{
    studentId: string;
    sgpa: number;
    cgpa: number;
    totalCreditsEarned: number;
    totalCreditsRegistered: number;
    backlogs: number;
    result: string;
  }> = [];

  for (const studentId of studentIds) {
    // 2a. Get all GradeCards for this semester for this student
    const studentSemCards = semGradeCards.filter(gc => String(gc.studentId) === studentId);

    // 2b. Compute SGPA
    const sgpa = computeSGPA(studentSemCards.map(gc => ({
      gradePoints: gc.gradePoints,
      credits: gc.credits,
    })));

    // 2c. Get ALL GradeCards across ALL semesters for CGPA
    const allCards = await GradeCard.find({ collegeId, studentId }).lean();
    const cgpa = computeCGPA(allCards.map(gc => ({
      courseId: String(gc.courseId),
      gradePoints: gc.gradePoints,
      credits: gc.credits,
    })));

    // 2d. Credits earned = sum of credits where result = 'pass' (this semester)
    const totalCreditsEarned = studentSemCards
      .filter(gc => gc.result === 'pass')
      .reduce((sum, gc) => sum + gc.credits, 0);

    // 2e. Credits registered = sum of all credits for this semester
    const totalCreditsRegistered = studentSemCards
      .reduce((sum, gc) => sum + gc.credits, 0);

    // 2f. Backlogs = number of GradeCards with result = 'fail' this semester
    const backlogs = studentSemCards.filter(gc => gc.result === 'fail').length;

    // 2g. Result: fail if any backlogs, else pass
    const result = backlogs > 0 ? 'fail' : 'pass';

    // 2h. Upsert SemesterResult
    await SemesterResult.findOneAndUpdate(
      { collegeId, studentId, semesterId },
      {
        collegeId,
        studentId,
        semesterId,
        sgpa,
        cgpa,
        totalCreditsEarned,
        totalCreditsRegistered,
        backlogs,
        result,
        status: 'computed',
      },
      { upsert: true, new: true },
    );

    results.push({ studentId, sgpa, cgpa, totalCreditsEarned, totalCreditsRegistered, backlogs, result });
  }

  // 3. Audit log
  await createAuditLog({
    collegeId,
    entityType: 'SemesterResult',
    entityId: semesterId,
    entityName: `Semester Result Computation - ${semesterId}`,
    action: 'create',
    changes: [{
      field: 'semesterResultComputation',
      displayName: 'Semester Result Computation',
      oldValue: null,
      newValue: `Processed: ${results.length} students`,
    }],
    performedBy,
  });

  return { processed: results.length, results };
}

// ═══ W02: Result Publication Workflow ═══════════════════════════

const RESULT_TRANSITION_MAP: Record<string, string> = {
  board_review: 'computed',
  approved: 'board_review',
  published: 'approved',
};

export async function transitionResultStatus(
  collegeId: string,
  semesterId: string,
  targetStatus: 'board_review' | 'approved' | 'published',
  performedBy: string,
  boardDecision?: string,
): Promise<{ updated: number }> {
  const fromStatus = RESULT_TRANSITION_MAP[targetStatus];
  if (!fromStatus) throw new AppError(400, `Invalid target status: ${targetStatus}`);

  const updateFields: any = { status: targetStatus };
  if (targetStatus === 'approved' && boardDecision) {
    updateFields.boardDecision = boardDecision;
  }
  if (targetStatus === 'published') {
    updateFields.publishedAt = new Date();
  }

  const result = await SemesterResult.updateMany(
    { collegeId, semesterId, status: fromStatus },
    { $set: updateFields },
  );

  const count = result.modifiedCount;

  await createAuditLog({
    collegeId,
    entityType: 'SemesterResult',
    entityId: semesterId,
    entityName: `Result Transition → ${targetStatus}`,
    action: 'update',
    changes: [{
      field: 'status',
      displayName: 'Result Status Transition',
      oldValue: fromStatus,
      newValue: `${targetStatus} (${count} records)`,
    }],
    performedBy,
  });

  return { updated: count };
}

// ═══ W02: Revaluation Requests ═══════════════════════════════

export async function listRevaluationRequests(
  collegeId: string,
  page: number,
  limit: number,
  semesterId?: string,
  studentId?: string,
  status?: string,
  authScope?: AuthScope,
) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (studentId) filter.studentId = studentId;
  if (status) filter.status = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(RevaluationRequest, filter, page, limit, { submittedAt: -1 }, [STUDENT_POPULATE, 'courseId', 'semesterId'] as any);
}

export async function getRevaluationRequest(collegeId: string, id: string) {
  const doc = await RevaluationRequest.findOne({ _id: id, collegeId })
    .populate(STUDENT_POPULATE)
    .populate('courseId')
    .populate('semesterId');
  if (!doc) throw new AppError(404, 'Revaluation request not found');
  return doc;
}

export async function submitRevaluationRequest(
  collegeId: string,
  data: { studentId: string; courseId: string; semesterId: string; examType: string; originalMarks: number; reason: string },
  performedBy: string,
) {
  const doc = await RevaluationRequest.create({
    ...data,
    collegeId,
    status: 'submitted',
    feePaid: false,
    submittedAt: new Date(),
  });

  await createAuditLog({
    collegeId,
    entityType: 'RevaluationRequest',
    entityId: String(doc._id),
    entityName: `Revaluation - ${data.studentId} / ${data.courseId}`,
    action: 'create',
    changes: [],
    performedBy,
  });

  return doc;
}

export async function processRevaluationRequest(
  collegeId: string,
  id: string,
  action: 'forward' | 'complete' | 'reject',
  performedBy: string,
  revaluedMarks?: number,
  outcome?: string,
) {
  const doc = await RevaluationRequest.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Revaluation request not found');

  if (action === 'forward') {
    if (doc.status !== 'submitted') throw new AppError(400, 'Can only forward a submitted request');
    doc.status = 'forwarded_to_university';
  } else if (action === 'complete') {
    if (doc.status !== 'forwarded_to_university' && doc.status !== 'submitted') {
      throw new AppError(400, 'Cannot complete a request in current status');
    }
    if (revaluedMarks === undefined || !outcome) {
      throw new AppError(400, 'revaluedMarks and outcome are required for complete action');
    }
    doc.status = 'completed';
    doc.revaluedMarks = revaluedMarks;
    doc.outcome = outcome;
    doc.completedAt = new Date();

    // If marks increased, update the ExternalMark record
    if (outcome === 'marks_increased') {
      await ExternalMark.findOneAndUpdate(
        {
          collegeId,
          studentId: doc.studentId,
          courseId: doc.courseId,
          semesterId: doc.semesterId,
          examType: doc.examType,
        },
        { $set: { marksObtained: revaluedMarks, result: 'pass' } },
      );
    }
  } else if (action === 'reject') {
    if (doc.status === 'completed' || doc.status === 'rejected') {
      throw new AppError(400, 'Cannot reject a completed or already rejected request');
    }
    doc.status = 'rejected';
  }

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'RevaluationRequest',
    entityId: String(doc._id),
    entityName: `Revaluation ${action}`,
    action: 'update',
    changes: [{
      field: 'status',
      displayName: 'Status',
      oldValue: null,
      newValue: doc.status,
    }],
    performedBy,
  });

  return doc;
}

// ═══ W02: Backlogs ══════════════════════════════════════════

export async function listBacklogs(
  collegeId: string,
  page: number,
  limit: number,
  studentId?: string,
  semesterId?: string,
  status?: string,
  authScope?: AuthScope,
) {
  const filter: any = { collegeId };
  if (studentId) filter.studentId = studentId;
  if (semesterId) filter.semesterId = semesterId;
  if (status) filter.currentStatus = status;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(Backlog, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'courseId', 'semesterId'] as any);
}

export async function getBacklog(collegeId: string, id: string) {
  const doc = await Backlog.findOne({ _id: id, collegeId })
    .populate(STUDENT_POPULATE)
    .populate('courseId')
    .populate('semesterId');
  if (!doc) throw new AppError(404, 'Backlog not found');
  return doc;
}

export async function updateBacklog(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Backlog.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Backlog not found');

  await createAuditLog({
    collegeId,
    entityType: 'Backlog',
    entityId: String(doc._id),
    entityName: `Backlog - ${String(doc.studentId)} / ${String(doc.courseId)}`,
    action: 'update',
    changes: Object.keys(data).map(k => ({
      field: k,
      displayName: k,
      oldValue: null,
      newValue: data[k],
    })),
    performedBy,
  });

  return doc;
}

// ═══ W02: Supplementary Exam Scheduling ══════════════════════

export async function scheduleSupplementaryExams(
  collegeId: string,
  semesterId: string,
  performedBy: string,
): Promise<{
  scheduled: number;
  registrations: number;
  backlogs: Array<{ studentId: string; courseId: string }>;
}> {
  // 1. Find all Backlogs with currentStatus 'created' for this semester
  const backlogs = await Backlog.find({ collegeId, semesterId, currentStatus: 'created' });
  if (backlogs.length === 0) {
    return { scheduled: 0, registrations: 0, backlogs: [] };
  }

  // 2. Group by courseId
  const courseMap = new Map<string, typeof backlogs>();
  for (const b of backlogs) {
    const cid = String(b.courseId);
    if (!courseMap.has(cid)) courseMap.set(cid, []);
    courseMap.get(cid)!.push(b);
  }

  let scheduled = 0;
  let registrations = 0;
  const backlogSummary: Array<{ studentId: string; courseId: string }> = [];

  // 3. For each course with backlogs
  for (const [courseId, courseBacklogs] of courseMap) {
    // 3a. Create or find an ExamSchedule with examType 'supplementary'
    let examSchedule = await ExamSchedule.findOne({
      collegeId,
      semesterId,
      courseId,
      examType: 'supplementary',
    });

    if (!examSchedule) {
      examSchedule = await ExamSchedule.create({
        collegeId,
        semesterId,
        courseId,
        examType: 'supplementary',
        date: new Date(),
        startTime: '09:00',
        endTime: '12:00',
        status: 'scheduled',
      });
      scheduled++;
    }

    // 3b. For each student with a backlog in this course
    for (const backlog of courseBacklogs) {
      // Find a course offering for this course/semester to use as courseOfferingId
      const offering = await CourseOffering.findOne({
        collegeId,
        courseId,
        semesterId,
      });

      if (offering) {
        // Create ExamRegistration
        await ExamRegistration.create({
          collegeId,
          studentId: backlog.studentId,
          courseOfferingId: offering._id,
          semesterId,
          examType: 'supplementary',
          status: 'registered',
          isEligible: true,
        });
        registrations++;
      }

      // Update Backlog status
      backlog.currentStatus = 'registered_for_supplementary';
      await backlog.save();

      backlogSummary.push({
        studentId: String(backlog.studentId),
        courseId: String(backlog.courseId),
      });
    }
  }

  // 4. Audit log
  await createAuditLog({
    collegeId,
    entityType: 'ExamSchedule',
    entityId: semesterId,
    entityName: `Supplementary Exam Scheduling - ${semesterId}`,
    action: 'create',
    changes: [{
      field: 'supplementaryScheduling',
      displayName: 'Supplementary Exam Scheduling',
      oldValue: null,
      newValue: `Scheduled: ${scheduled}, Registrations: ${registrations}, Backlogs: ${backlogSummary.length}`,
    }],
    performedBy,
  });

  return { scheduled, registrations, backlogs: backlogSummary };
}

// ═══ W02: Backlog Clearance ══════════════════════════════════

export async function clearBacklog(
  collegeId: string,
  backlogId: string,
  clearedGrade: string,
  clearedInSemesterId: string,
  performedBy: string,
): Promise<any> {
  const backlog = await Backlog.findOne({ _id: backlogId, collegeId });
  if (!backlog) throw new AppError(404, 'Backlog not found');
  if (backlog.currentStatus === 'cleared') throw new AppError(400, 'Backlog is already cleared');

  backlog.currentStatus = 'cleared';
  backlog.clearedGrade = clearedGrade;
  backlog.clearedInSemesterId = clearedInSemesterId as any;
  backlog.clearedAt = new Date();
  await backlog.save();

  await createAuditLog({
    collegeId,
    entityType: 'Backlog',
    entityId: String(backlog._id),
    entityName: `Backlog ${String(backlog._id)}`,
    action: 'update',
    changes: [
      { field: 'currentStatus', displayName: 'Status', oldValue: 'active', newValue: 'cleared' },
      { field: 'clearedGrade', displayName: 'Cleared Grade', oldValue: null, newValue: clearedGrade },
    ],
    performedBy,
  });

  return backlog;
}

// ═══ W02: Promotion/Detention ════════════════════════════════

export async function determinePromotions(
  collegeId: string,
  academicYearId: string,
  year: number,
  performedBy: string,
): Promise<{
  processed: number;
  promoted: number;
  detained: number;
  decisions: Array<{
    studentId: string;
    decision: string;
    totalBacklogs: number;
    reason: string;
  }>;
}> {
  // 1. Get semesters for this academic year
  const semesters = await Semester.find({ collegeId, academicYearId }).lean();
  const semesterIds = semesters.map((s) => s._id);

  if (semesterIds.length === 0) {
    return { processed: 0, promoted: 0, detained: 0, decisions: [] };
  }

  // 2. Get distinct students who have SemesterResults for these semesters
  const semesterResults = await SemesterResult.find({
    collegeId,
    semesterId: { $in: semesterIds },
  }).lean();

  const studentIdSet = new Set(semesterResults.map((r) => String(r.studentId)));
  const studentIds = Array.from(studentIdSet);

  const MAX_YEAR = 4; // BTech standard
  const decisions: Array<{ studentId: string; decision: string; totalBacklogs: number; reason: string }> = [];
  let promoted = 0;
  let detained = 0;

  for (const studentId of studentIds) {
    // 2a. Count active backlogs
    const totalBacklogs = await Backlog.countDocuments({
      collegeId,
      studentId,
      currentStatus: { $ne: 'cleared' },
    });

    // 2b. Apply promotion rules
    let decision: string;
    let toYear: number | null = null;
    let reason: string;

    if (year >= MAX_YEAR && totalBacklogs === 0) {
      decision = 'graduated';
      reason = 'All criteria met for graduation';
    } else if (totalBacklogs === 0) {
      decision = 'promoted';
      toYear = year + 1;
      reason = 'No active backlogs';
    } else if (totalBacklogs >= 1 && totalBacklogs <= 4) {
      decision = 'promoted';
      toYear = year + 1;
      reason = `Promoted with ${totalBacklogs} backlog${totalBacklogs > 1 ? 's' : ''}`;
    } else {
      decision = 'detained';
      reason = `Detained: ${totalBacklogs} active backlogs (exceeds limit of 4)`;
    }

    if (decision === 'detained') {
      detained++;
    } else {
      promoted++;
    }

    // 2c. Upsert PromotionDecision
    await PromotionDecision.findOneAndUpdate(
      { collegeId, studentId, academicYearId },
      {
        collegeId,
        studentId,
        academicYearId,
        fromYear: year,
        toYear: toYear ?? undefined,
        decision,
        reason,
        totalBacklogs,
      },
      { upsert: true, new: true },
    );

    // 2d. Update SemesterResults for this student's semesters in this academic year
    const promotionStatus = decision === 'graduated' ? 'graduated' : decision;
    await SemesterResult.updateMany(
      { collegeId, studentId, semesterId: { $in: semesterIds } },
      { promotionStatus },
    );

    decisions.push({ studentId, decision, totalBacklogs, reason });
  }

  // 3. Audit log
  await createAuditLog({
    collegeId,
    entityType: 'PromotionDecision',
    entityId: academicYearId,
    entityName: `Promotion Determination - Year ${year}`,
    action: 'create',
    changes: [
      {
        field: 'promotionDetermination',
        displayName: 'Promotion Determination',
        oldValue: null,
        newValue: `Processed: ${studentIds.length}, Promoted: ${promoted}, Detained: ${detained}`,
      },
    ],
    performedBy,
  });

  return { processed: studentIds.length, promoted, detained, decisions };
}

export async function listPromotionDecisions(
  collegeId: string,
  page: number,
  limit: number,
  academicYearId?: string,
  studentId?: string,
  decision?: string,
  authScope?: any,
) {
  const filter: FilterQuery<any> = { collegeId };
  if (academicYearId) filter['academicYearId'] = academicYearId;
  if (studentId) filter['studentId'] = studentId;
  if (decision) filter['decision'] = decision;
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'studentId' });
  return paginate(PromotionDecision, filter, page, limit, { createdAt: -1 }, [STUDENT_POPULATE, 'academicYearId'] as any);
}

export async function getPromotionDecision(collegeId: string, id: string) {
  const doc = await PromotionDecision.findOne({ _id: id, collegeId })
    .populate(STUDENT_POPULATE)
    .populate('academicYearId');
  if (!doc) throw new AppError(404, 'Promotion decision not found');
  return doc;
}

export async function updatePromotionDecision(
  collegeId: string,
  id: string,
  data: {
    decision?: string;
    reason?: string;
    boardMeetingDate?: string;
    effectiveDate?: string;
  },
  performedBy: string,
) {
  const doc = await PromotionDecision.findOne({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Promotion decision not found');

  const changes: Array<{ field: string; displayName: string; oldValue: any; newValue: any }> = [];

  if (data.decision !== undefined && data.decision !== doc.decision) {
    changes.push({ field: 'decision', displayName: 'Decision', oldValue: doc.decision, newValue: data.decision });
    doc.decision = data.decision;
  }
  if (data.reason !== undefined) {
    doc.reason = data.reason;
  }
  if (data.boardMeetingDate !== undefined) {
    doc.boardMeetingDate = new Date(data.boardMeetingDate);
  }
  if (data.effectiveDate !== undefined) {
    doc.effectiveDate = new Date(data.effectiveDate);
  }

  await doc.save();

  await createAuditLog({
    collegeId,
    entityType: 'PromotionDecision',
    entityId: String(doc._id),
    entityName: `Promotion Decision ${String(doc._id)}`,
    action: 'update',
    changes,
    performedBy,
  });

  return doc;
}

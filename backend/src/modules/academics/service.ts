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
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
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

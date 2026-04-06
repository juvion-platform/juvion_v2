import { Regulation } from '../../models/academic-structure/Regulation';
import { Programme } from '../../models/academic-structure/Programme';
import { Department } from '../../models/academic-structure/Department';
import { Branch } from '../../models/academic-structure/Branch';
import { Batch } from '../../models/academic-structure/Batch';
import { Section } from '../../models/academic-structure/Section';
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

export async function listRegulations(collegeId: string, page: number, limit: number) {
  return paginate(Regulation, { collegeId }, page, limit, { effectiveFromYear: -1 });
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

export async function listProgrammes(collegeId: string, page: number, limit: number) {
  return paginate(Programme, { collegeId }, page, limit, { code: 1 }, ['regulationId']);
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

export async function listDepartments(collegeId: string, page: number, limit: number) {
  return paginate(Department, { collegeId }, page, limit, { code: 1 }, ['hodId']);
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

export async function listBranches(collegeId: string, page: number, limit: number) {
  return paginate(Branch, { collegeId }, page, limit, { code: 1 }, ['programmeId', 'departmentId']);
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

export async function listBatches(collegeId: string, page: number, limit: number) {
  return paginate(Batch, { collegeId }, page, limit, { admissionYear: -1 }, ['programmeId', 'regulationId']);
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

export async function listSections(collegeId: string, page: number, limit: number) {
  return paginate(Section, { collegeId }, page, limit, { year: 1, semester: 1, name: 1 }, ['branchId', 'batchId', 'classAdvisorId']);
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

export async function listAcademicYears(collegeId: string, page: number, limit: number) {
  return paginate(AcademicYear, { collegeId }, page, limit, { startDate: -1 });
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

export async function listSemesters(collegeId: string, page: number, limit: number, academicYearId?: string) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
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

export async function listCourses(collegeId: string, page: number, limit: number, regulationId?: string) {
  const filter: any = { collegeId };
  if (regulationId) filter.regulationId = regulationId;
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

export async function listCurriculumMaps(collegeId: string, page: number, limit: number, branchId?: string, semester?: number) {
  const filter: any = { collegeId };
  if (branchId) filter.branchId = branchId;
  if (semester) filter.semester = semester;
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

export async function listCourseOfferings(collegeId: string, page: number, limit: number, semesterId?: string) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
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

export async function listEnrollments(collegeId: string, page: number, limit: number, semesterId?: string) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
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

export async function listCalendarEvents(collegeId: string, page: number, limit: number, academicYearId?: string) {
  const filter: any = { collegeId };
  if (academicYearId) filter.academicYearId = academicYearId;
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

export async function listTimetables(collegeId: string, page: number, limit: number, semesterId?: string) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
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

export async function listAttendanceSessions(collegeId: string, page: number, limit: number, courseOfferingId?: string) {
  const filter: any = { collegeId };
  if (courseOfferingId) filter.courseOfferingId = courseOfferingId;
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

export async function listInternalAssessments(collegeId: string, page: number, limit: number, courseOfferingId?: string) {
  const filter: any = { collegeId };
  if (courseOfferingId) filter.courseOfferingId = courseOfferingId;
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

export async function listExamRegistrations(collegeId: string, page: number, limit: number, semesterId?: string) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
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

export async function listExamSchedules(collegeId: string, page: number, limit: number, semesterId?: string) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
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

export async function listExternalMarks(collegeId: string, page: number, limit: number, semesterId?: string) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
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

export async function listGradeCards(collegeId: string, page: number, limit: number, semesterId?: string, studentId?: string) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
  if (studentId) filter.studentId = studentId;
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

export async function listSemesterResults(collegeId: string, page: number, limit: number, semesterId?: string) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
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

export async function listElectiveAllocations(collegeId: string, page: number, limit: number, semesterId?: string) {
  const filter: any = { collegeId };
  if (semesterId) filter.semesterId = semesterId;
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

export async function listLessonPlans(collegeId: string, page: number, limit: number, courseOfferingId?: string) {
  const filter: any = { collegeId };
  if (courseOfferingId) filter.courseOfferingId = courseOfferingId;
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

export async function listCourseFeedback(collegeId: string, page: number, limit: number, courseOfferingId?: string) {
  const filter: any = { collegeId };
  if (courseOfferingId) filter.courseOfferingId = courseOfferingId;
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

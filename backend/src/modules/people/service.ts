import mongoose from 'mongoose';
import { Person } from '../../models/people/Person';
import { Student } from '../../models/people/Student';
import { Faculty } from '../../models/people/Faculty';
import { Staff } from '../../models/people/Staff';
import { Parent } from '../../models/people/Parent';
import { Organization } from '../../models/people/Organization';
import { AcademicYear } from '../../models/academic-structure/AcademicYear';
import { paginate } from '../../shared/pagination';
import { createAuditLog } from '../../shared/audit';
import { AppError } from '../../middleware/errorHandler';
import * as feePinService from '../finance/fee-pin-service';
import { resolveStudentYearOfStudy } from '../finance/resolve-year-of-study';
import { AuthScope } from '../../shared/rbac/types';
import { applyAuthScope } from '../../shared/rbac/apply-scope';
import { ALL_PERSONAS } from '../../shared/rbac/personas';
import {
  getFacultyProfileCompleteness,
  getOrganizationProfileCompleteness,
  getParentProfileCompleteness,
  getStaffProfileCompleteness,
  getStudentOnboardingCompleteness,
  getStudentProfileCompleteness,
} from './profileCompleteness';

const toOid = (id: string) => new mongoose.Types.ObjectId(id);

// ─── Dashboard Stats ─────────────────────────────────
export async function getDashboardStats(collegeId: string) {
  const onboardingNeedsAttentionFilter = {
    collegeId,
    onboardingStatus: { $in: ['not_started', 'in_progress'] },
    $or: [
      { feeResponsibleParentId: { $exists: false } },
      { feeResponsibleParentId: null },
      { 'onboardingChecklist.profileVerified': { $ne: true } },
      { 'onboardingChecklist.documentsVerified': { $ne: true } },
      { 'onboardingChecklist.feePlanConfirmed': { $ne: true } },
      { 'onboardingChecklist.portalAccessShared': { $ne: true } },
      { 'onboardingChecklist.idCardIssued': { $ne: true } },
    ],
  };

  const [persons, students, activeStudents, faculty, activeFaculty, staff, activeStaff, parents, organizations, onboardingInProgress, onboardingCompleted, onboardingNeedsAttention, missingFeeResponsibleGuardians] = await Promise.all([
    Person.countDocuments({ collegeId }),
    Student.countDocuments({ collegeId }),
    Student.countDocuments({ collegeId, status: 'active' }),
    Faculty.countDocuments({ collegeId }),
    Faculty.countDocuments({ collegeId, status: 'active' }),
    Staff.countDocuments({ collegeId }),
    Staff.countDocuments({ collegeId, status: 'active' }),
    Parent.countDocuments({ collegeId }),
    Organization.countDocuments({ collegeId }),
    Student.countDocuments({ collegeId, onboardingStatus: 'in_progress' }),
    Student.countDocuments({ collegeId, onboardingStatus: 'completed' }),
    Student.countDocuments(onboardingNeedsAttentionFilter),
    Student.countDocuments({
      collegeId,
      status: { $in: ['active', 'prospective'] },
      $or: [
        { feeResponsibleParentId: { $exists: false } },
        { feeResponsibleParentId: null },
      ],
    }),
  ]);
  return {
    persons,
    students,
    activeStudents,
    faculty,
    activeFaculty,
    staff,
    activeStaff,
    parents,
    organizations,
    onboardingInProgress,
    onboardingCompleted,
    onboardingNeedsAttention,
    missingFeeResponsibleGuardians,
    // The Persona Catalog card had no stat to read, so it rendered blank.
    // Personas are a static code list (shared/rbac/personas.ts), not a
    // collection, so the count comes from there rather than a countDocuments.
    personas: ALL_PERSONAS.length,
  };
}

// ─── Helpers ─────────────────────────────────────────

/** Create a Person record, return the document */
async function createPersonRecord(collegeId: string, data: any) {
  const personFields: any = {
    collegeId,
    name: data.name,
    phone: data.phone,
  };
  ['email', 'aadhaar', 'dob', 'gender', 'alternatePhone', 'preferredLanguage', 'address', 'emergencyContact', 'biometricEnrolled'].forEach(k => {
    if (data[k] !== undefined) personFields[k] = data[k];
  });
  return Person.create(personFields);
}

function buildStudentOnboardingFields(data: any) {
  const fields: any = {};
  if (data.onboardingStatus !== undefined) fields.onboardingStatus = data.onboardingStatus;
  if (data.onboardingChecklist !== undefined) fields.onboardingChecklist = data.onboardingChecklist;
  if (data.onboardingCompletedAt !== undefined) {
    fields.onboardingCompletedAt = data.onboardingCompletedAt ? new Date(data.onboardingCompletedAt) : undefined;
  } else if (data.onboardingStatus === 'completed') {
    fields.onboardingCompletedAt = new Date();
  }
  if (data.onboardingStatus && data.onboardingStatus !== 'completed' && data.onboardingCompletedAt === undefined) {
    fields.onboardingCompletedAt = undefined;
  }
  return fields;
}

function getMergedOnboardingChecklist(currentChecklist: any, incomingChecklist: any) {
  return {
    profileVerified: incomingChecklist?.profileVerified ?? currentChecklist?.profileVerified ?? false,
    documentsVerified: incomingChecklist?.documentsVerified ?? currentChecklist?.documentsVerified ?? false,
    feePlanConfirmed: incomingChecklist?.feePlanConfirmed ?? currentChecklist?.feePlanConfirmed ?? false,
    portalAccessShared: incomingChecklist?.portalAccessShared ?? currentChecklist?.portalAccessShared ?? false,
    idCardIssued: incomingChecklist?.idCardIssued ?? currentChecklist?.idCardIssued ?? false,
  };
}

function assertStudentOnboardingRules(input: {
  onboardingStatus?: string;
  feeResponsibleParentId?: string | null;
  onboardingChecklist?: any;
}) {
  if (input.onboardingStatus !== 'completed') return;

  if (!input.feeResponsibleParentId) {
    throw new AppError(400, 'Fee responsible guardian is required before onboarding can be marked completed');
  }

  const checklist = input.onboardingChecklist || {};
  const missing = [
    checklist.profileVerified ? null : 'profile verification',
    checklist.documentsVerified ? null : 'document verification',
    checklist.feePlanConfirmed ? null : 'fee plan confirmation',
    checklist.portalAccessShared ? null : 'portal access sharing',
    checklist.idCardIssued ? null : 'ID card issuance',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new AppError(400, `Complete the onboarding checklist before marking onboarding completed: ${missing.join(', ')}`);
  }
}

/**
 * Keeps the reverse Parent -> Student link in step with a student's
 * primaryParentId / feeResponsibleParentId.
 *
 * Exported because the bulk-import commit path must maintain the same link:
 * people/search-service.ts populates `linkedStudents` to render a parent's
 * children, and profileCompleteness.ts scores it, so an importer that skips
 * this leaves every imported guardian reading as childless and incomplete.
 */
export async function syncStudentParentLinks(collegeId: string, studentId: string, previousParentIds: string[], nextParentIds: string[]) {
  const previous = new Set(previousParentIds.filter(Boolean));
  const next = new Set(nextParentIds.filter(Boolean));
  const toRemove = [...previous].filter(id => !next.has(id));
  const toAdd = [...next].filter(id => !previous.has(id));

  if (toRemove.length > 0) {
    await Parent.updateMany(
      { collegeId, _id: { $in: toRemove } },
      { $pull: { linkedStudents: toOid(studentId) } },
    );
  }
  if (toAdd.length > 0) {
    await Parent.updateMany(
      { collegeId, _id: { $in: toAdd } },
      { $addToSet: { linkedStudents: toOid(studentId) } },
    );
  }
}

// ─── Persons (raw) ───────────────────────────────────

export async function listPersons(collegeId: string, page: number, limit: number, search?: string, authScope?: AuthScope) {
  const match: any = { collegeId: toOid(collegeId) };
  if (authScope) applyAuthScope(match, authScope, { selfField: '_id' });
  if (search) match.name = { $regex: search, $options: 'i' };
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: match },
    { $lookup: { from: 'students', localField: '_id', foreignField: 'personId', as: '_students', pipeline: [{ $project: { _id: 1 } }] } },
    { $lookup: { from: 'faculties', localField: '_id', foreignField: 'personId', as: '_faculty', pipeline: [{ $project: { _id: 1 } }] } },
    { $lookup: { from: 'staffs', localField: '_id', foreignField: 'personId', as: '_staff', pipeline: [{ $project: { _id: 1 } }] } },
    { $lookup: { from: 'parents', localField: '_id', foreignField: 'personId', as: '_parents', pipeline: [{ $project: { _id: 1 } }] } },
    { $addFields: {
      roles: {
        $filter: {
          input: [
            { $cond: [{ $gt: [{ $size: '$_students' }, 0] }, { type: 'Student', recordId: { $arrayElemAt: ['$_students._id', 0] } }, null] },
            { $cond: [{ $gt: [{ $size: '$_faculty' }, 0] }, { type: 'Faculty', recordId: { $arrayElemAt: ['$_faculty._id', 0] } }, null] },
            { $cond: [{ $gt: [{ $size: '$_staff' }, 0] }, { type: 'Staff', recordId: { $arrayElemAt: ['$_staff._id', 0] } }, null] },
            { $cond: [{ $gt: [{ $size: '$_parents' }, 0] }, { type: 'Parent', recordId: { $arrayElemAt: ['$_parents._id', 0] } }, null] },
          ],
          cond: { $ne: ['$$this', null] },
        },
      },
    }},
    { $project: { _students: 0, _faculty: 0, _staff: 0, _parents: 0 } },
  ];

  const [items, countResult] = await Promise.all([
    Person.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Person.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = countResult[0]?.total || 0;
  return { items, total, page, pages: Math.ceil(total / limit) };
}

export async function getPerson(collegeId: string, id: string) {
  const doc = await Person.findOne({ _id: id, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Person not found');
  return doc;
}

export async function createPerson(collegeId: string, data: any, performedBy: string) {
  const doc = await Person.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Person', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return doc;
}

export async function updatePerson(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Person.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Person not found');
  await createAuditLog({ collegeId, entityType: 'Person', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deletePerson(collegeId: string, id: string, performedBy: string) {
  const doc = await Person.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Person not found');
  await createAuditLog({ collegeId, entityType: 'Person', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Students ────────────────────────────────────────

export async function listStudents(collegeId: string, page: number, limit: number, status?: string, search?: string, onboardingStatus?: string, needsAttention = false, authScope?: AuthScope) {
  const filter: any = { collegeId: toOid(collegeId) };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId', departmentField: 'branchId' });
  if (status) filter.status = status;
  if (onboardingStatus) filter.onboardingStatus = onboardingStatus;
  if (needsAttention) {
    filter.onboardingStatus = { $in: ['not_started', 'in_progress'] };
    filter.$or = [
      { feeResponsibleParentId: { $exists: false } },
      { feeResponsibleParentId: null },
      { 'onboardingChecklist.profileVerified': { $ne: true } },
      { 'onboardingChecklist.documentsVerified': { $ne: true } },
      { 'onboardingChecklist.feePlanConfirmed': { $ne: true } },
      { 'onboardingChecklist.portalAccessShared': { $ne: true } },
      { 'onboardingChecklist.idCardIssued': { $ne: true } },
    ];
  }
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: filter },
    { $lookup: { from: 'people', localField: 'personId', foreignField: '_id', as: 'person' } },
    { $unwind: '$person' },
    { $lookup: { from: 'regulations', localField: 'regulationId', foreignField: '_id', as: 'regulation' } },
    { $unwind: { path: '$regulation', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'programmes', localField: 'programmeId', foreignField: '_id', as: 'programme' } },
    { $unwind: { path: '$programme', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'branches', localField: 'branchId', foreignField: '_id', as: 'branch' } },
    { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'batches', localField: 'batchId', foreignField: '_id', as: 'batch' } },
    { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'parents', localField: 'primaryParentId', foreignField: '_id', as: 'primaryParent' } },
    { $unwind: { path: '$primaryParent', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'people', localField: 'primaryParent.personId', foreignField: '_id', as: 'primaryParentPerson' } },
    { $unwind: { path: '$primaryParentPerson', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'parents', localField: 'feeResponsibleParentId', foreignField: '_id', as: 'feeResponsibleParent' } },
    { $unwind: { path: '$feeResponsibleParent', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'people', localField: 'feeResponsibleParent.personId', foreignField: '_id', as: 'feeResponsibleParentPerson' } },
    { $unwind: { path: '$feeResponsibleParentPerson', preserveNullAndEmptyArrays: true } },
  ];
  if (search) pipeline.push({ $match: { 'person.name': { $regex: search, $options: 'i' } } });

  const [items, countResult] = await Promise.all([
    Student.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Student.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = countResult[0]?.total || 0;
  return {
    items: items.map(item => ({
      ...item,
      profileCompleteness: getStudentProfileCompleteness(item),
      onboardingCompleteness: getStudentOnboardingCompleteness(item),
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function getStudent(collegeId: string, id: string): Promise<any> {
  const doc = await Student.findOne({ _id: id, collegeId })
    .populate('personId')
    .populate('regulationId')
    .populate('programmeId')
    .populate('branchId')
    .populate('batchId')
    .populate({ path: 'primaryParentId', populate: { path: 'personId' } })
    .populate({ path: 'feeResponsibleParentId', populate: { path: 'personId' } })
    .lean();
  if (!doc) throw new AppError(404, 'Student not found');
  return {
    ...doc,
    profileCompleteness: getStudentProfileCompleteness(doc),
    onboardingCompleteness: getStudentOnboardingCompleteness(doc),
  };
}

export async function createStudent(collegeId: string, data: any, performedBy: string) {
  const person = await createPersonRecord(collegeId, data);
  const mergedChecklist = getMergedOnboardingChecklist(undefined, data.onboardingChecklist);
  assertStudentOnboardingRules({
    onboardingStatus: data.onboardingStatus || 'not_started',
    feeResponsibleParentId: data.feeResponsibleParentId || null,
    onboardingChecklist: mergedChecklist,
  });
  const studentFields: any = {
    collegeId,
    personId: person._id,
    admissionYear: data.admissionYear,
    status: data.status || 'active',
    onboardingStatus: data.onboardingStatus || 'not_started',
  };
  ['category', 'quota', 'rollNumber', 'regulationId', 'programmeId', 'branchId', 'batchId', 'primaryParentId', 'feeResponsibleParentId', 'studyYearAtAdmission'].forEach(k => { if (data[k] !== undefined) studentFields[k] = data[k]; });
  Object.assign(studentFields, buildStudentOnboardingFields(data));
  studentFields.onboardingChecklist = mergedChecklist;
  const doc = await Student.create(studentFields);
  await syncStudentParentLinks(
    collegeId,
    String(doc._id),
    [],
    [data.primaryParentId, data.feeResponsibleParentId].filter(Boolean),
  );

  // Auto-pin the matching fee structure on enrollment.
  //
  // Soft-fail: if the college has not yet configured a matching
  // FeeStructureInstance for the student's combination, we DO NOT roll
  // back the create — admins can manually pin later via the existing
  // fee-configuration tooling. The result is surfaced on the response so
  // the frontend can render a "no fee structure pinned yet" badge.
  //
  // Skipped entirely when programmeId is absent (incomplete profiles).
  const feePin: {
    attempted: boolean;
    success: boolean;
    reason?: string;
    pinId?: string;
    feeStructureInstanceId?: string;
    yearOfStudy?: number;
  } = { attempted: false, success: false };

  if (!doc.programmeId) {
    feePin.reason = 'no-programme-id';
  } else {
    // Resolve the academic year for the pin. Caller may pass it
    // explicitly via data.academicYearId; otherwise use the college's
    // current academic year (`isCurrent: true`). If neither exists, the
    // pin is skipped — admin must set up the AcademicYear or pin
    // manually later.
    let academicYearId: mongoose.Types.ObjectId | undefined;
    if (data.academicYearId && mongoose.Types.ObjectId.isValid(String(data.academicYearId))) {
      academicYearId = new mongoose.Types.ObjectId(String(data.academicYearId));
    } else {
      const current = await AcademicYear.findOne({ collegeId, isCurrent: true })
        .select({ _id: 1 })
        .lean();
      if (current) academicYearId = current._id as mongoose.Types.ObjectId;
    }

    if (!academicYearId) {
      feePin.reason = 'no-academic-year';
    } else {
      feePin.attempted = true;
      // studyYearAtAdmission captures lateral-entry students (Year 2/3 admit).
      const yearOfStudy = doc.studyYearAtAdmission ?? 1;
      feePin.yearOfStudy = yearOfStudy;
      try {
        const pin = await feePinService.pinYear(String(doc._id), yearOfStudy, {
          pinnedBy: performedBy,
          reason: 'initial',
          academicYearId,
        });
        feePin.success = true;
        feePin.pinId = String(pin._id);
        feePin.feeStructureInstanceId = String(pin.feeStructureInstanceId);
      } catch (e) {
        const err = e as { name?: string; message?: string };
        if (err?.name === 'FeeStructureNotFoundError') {
          feePin.reason = 'no-matching-fee-structure';
          // eslint-disable-next-line no-console
          console.warn(
            `[student-auto-pin] no match for student=${String(doc._id)} ` +
              `programme=${String(doc.programmeId)} year=${yearOfStudy}: ` +
              `${err.message ?? ''}`,
          );
        } else {
          feePin.reason = `error: ${err?.message ?? 'unknown'}`;
          // eslint-disable-next-line no-console
          console.error(
            `[student-auto-pin] unexpected error for student=${String(doc._id)}:`,
            e,
          );
        }
      }
    }
  }

  await createAuditLog({ collegeId, entityType: 'Student', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  // Build a single-shape return — start from the in-memory doc, then
  // splice in the feePins[] from a fresh fetch if the auto-pin landed
  // (pinYear writes via student.save() but our in-memory `doc` reference
  // is stale by then).
  const studentObj = doc.toObject();
  if (feePin.success) {
    const fresh = await Student.findById(doc._id).select({ feePins: 1 }).lean();
    if (fresh?.feePins) studentObj.feePins = fresh.feePins as typeof studentObj.feePins;
  }
  return { ...studentObj, person: person.toObject(), feePin };
}

export async function updateStudent(collegeId: string, id: string, data: any, performedBy: string): Promise<any> {
  const student = await Student.findOne({ _id: id, collegeId });
  if (!student) throw new AppError(404, 'Student not found');

  // T11 rebind guard: programmeId changes MUST go through
  // programme-transfer-service (which archives the old pin, re-pins the
  // current year against the new programme's structure, and rolls back
  // if that structure is missing). Block the generic patch path so
  // admins are forced onto the correct workflow.
  if (
    data.programmeId !== undefined &&
    String(data.programmeId) !== String(student.programmeId ?? '')
  ) {
    throw new AppError(
      403,
      'programmeId changes are not allowed via the generic student update; use the programme-transfer endpoint to ensure fee pins are rebound atomically.',
    );
  }

  const previousPrimaryParentId = student.primaryParentId ? String(student.primaryParentId) : '';
  const previousFeeResponsibleParentId = student.feeResponsibleParentId ? String(student.feeResponsibleParentId) : '';
  const previousParentIds = [previousPrimaryParentId, previousFeeResponsibleParentId].filter(Boolean);

  const personFields: any = {};
  ['name', 'phone', 'alternatePhone', 'email', 'aadhaar', 'dob', 'gender', 'preferredLanguage', 'address', 'emergencyContact', 'biometricEnrolled'].forEach(k => { if (data[k] !== undefined) personFields[k] = data[k]; });
  if (Object.keys(personFields).length > 0) await Person.findByIdAndUpdate(student.personId, { $set: personFields });

  // Snapshot fields-that-affect-fees BEFORE applying changes, so we can
  // detect a drift vs the pinned structure after the write.
  const prevFeeAxes = {
    branchId: student.branchId ? String(student.branchId) : null,
    quota: student.quota ?? null,
    category: student.category ?? null,
  };

  const studentFields: any = {};
  ['admissionYear', 'category', 'quota', 'rollNumber', 'status', 'regulationId', 'programmeId', 'branchId', 'batchId', 'primaryParentId', 'feeResponsibleParentId'].forEach(k => { if (data[k] !== undefined) studentFields[k] = data[k]; });
  Object.assign(studentFields, buildStudentOnboardingFields(data));
  const mergedChecklist = getMergedOnboardingChecklist(student.onboardingChecklist, data.onboardingChecklist);
  assertStudentOnboardingRules({
    onboardingStatus: data.onboardingStatus !== undefined ? data.onboardingStatus : student.onboardingStatus,
    feeResponsibleParentId: data.feeResponsibleParentId !== undefined
      ? data.feeResponsibleParentId
      : (student.feeResponsibleParentId ? String(student.feeResponsibleParentId) : null),
    onboardingChecklist: mergedChecklist,
  });
  studentFields.onboardingChecklist = mergedChecklist;
  if (Object.keys(studentFields).length > 0) await Student.findByIdAndUpdate(id, { $set: studentFields });
  const nextParentIds = [
    data.primaryParentId !== undefined ? data.primaryParentId : previousPrimaryParentId,
    data.feeResponsibleParentId !== undefined ? data.feeResponsibleParentId : previousFeeResponsibleParentId,
  ].filter(Boolean);
  await syncStudentParentLinks(collegeId, id, previousParentIds, nextParentIds);

  await createAuditLog({ collegeId, entityType: 'Student', entityId: id, entityName: data.name || 'Student', action: 'update', changes: [], performedBy });

  // T11 + auto-rebind: if any fee-axis field changed (branch / category /
  // quota), first attempt to automatically pin the matching
  // FeeStructureInstance for the student's current year-of-study.
  //
  // Happy path  → matching FSI found: old pin archived, new pin created.
  //               feePinUpdate.autoRebound = true so the frontend shows a
  //               green "fee structure updated" toast.
  //
  // Fallback    → FeeStructureNotFoundError (no active FSI for the new
  //               combination): mark the existing pin stale and set
  //               feePinUpdate.pinMarkedStale = true so the operator is
  //               prompted to re-pin manually via FeePinsPanel.
  //
  // This block is deliberately best-effort: any failure MUST NOT cause
  // the student update itself to throw.
  const feeAxisChanged =
    (data.branchId !== undefined && String(data.branchId) !== prevFeeAxes.branchId) ||
    (data.quota !== undefined && (data.quota ?? null) !== prevFeeAxes.quota) ||
    (data.category !== undefined && (data.category ?? null) !== prevFeeAxes.category);

  const feePinUpdate: {
    feeAxisChanged: boolean;
    autoRebound: boolean;
    newPinId?: string;
    yearOfStudy?: number;
    pinMarkedStale: boolean;
    reason?: string;
  } = { feeAxisChanged, autoRebound: false, pinMarkedStale: false };

  if (feeAxisChanged) {
    try {
      const yearOfStudy = await resolveYearOfStudyForStalePinCheck(id);
      if (yearOfStudy !== null) {
        // Resolve the current AY for the pin-resolver (same lookup as
        // the FSI seed and createStudent auto-pin path).
        const currentAY = await AcademicYear.findOne({ collegeId, isCurrent: true })
          .select({ _id: 1 })
          .lean<{ _id: mongoose.Types.ObjectId } | null>();

        let autoRebindSucceeded = false;
        try {
          // pinYear reads the student fresh from DB so it sees the
          // just-committed branch/category/quota values.
          const newPin = await feePinService.pinYear(id, yearOfStudy, {
            pinnedBy: performedBy,
            reason: 'data_correction',
            academicYearId: currentAY?._id,
            // Skip BullMQ enqueue to keep this path synchronous and
            // avoid a Redis failure killing the student save.
            enqueueCommitmentSheet: false,
          });
          feePinUpdate.autoRebound = true;
          feePinUpdate.newPinId = String(newPin._id);
          feePinUpdate.yearOfStudy = yearOfStudy;
          autoRebindSucceeded = true;
          // eslint-disable-next-line no-console
          console.info(
            `[fee-pin] auto-rebound student=${id} year=${yearOfStudy} pin=${String(newPin._id)}`,
          );
        } catch (rebindErr) {
          // Log unexpected errors; FeeStructureNotFoundError is
          // expected and handled below.
          const errName = (rebindErr as { name?: string }).name;
          if (errName !== 'FeeStructureNotFoundError') {
            // eslint-disable-next-line no-console
            console.warn(
              `[fee-pin] auto-rebind unexpected error for student=${id}:`,
              rebindErr,
            );
          }
        }

        if (!autoRebindSucceeded) {
          // No matching FSI — fall back to stale-marking so the
          // operator is prompted to re-pin manually.
          const validity = await feePinService.checkPinValidity(id, yearOfStudy);
          if (!validity.valid && validity.currentPin) {
            await Student.updateOne(
              { _id: id, 'feePins._id': validity.currentPin._id },
              { $set: { 'feePins.$.staleSince': new Date() } },
            );
            feePinUpdate.pinMarkedStale = true;
            feePinUpdate.reason = validity.reason ?? 'no-matching-fee-structure';
            // eslint-disable-next-line no-console
            console.info(
              `[fee-pin] marked stale student=${id} year=${yearOfStudy} reason=${feePinUpdate.reason}`,
            );
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[fee-pin] auto-rebind/stale check failed for student=${id}:`,
        err,
      );
    }
  }

  const freshStudent = await getStudent(collegeId, id);
  return { ...freshStudent, feePinUpdate };
}

/**
 * Resolve the student's current year-of-study for stale-pin checks.
 *
 * Primary source: the canonical T20 helper `resolveStudentYearOfStudy`
 * (Student → Batch → AcademicYear arithmetic). The stale-pin hook runs
 * without an explicit academicYearId, so the helper picks the currently
 * active AY at the college (spec §Journey 4).
 *
 * Fallback: if the helper cannot resolve (no batch on student, no
 * active AY at college — common for legacy/pre-backfill data, cf.
 * OQ-11 / T16), we fall back to the prior heuristic of picking the
 * highest non-archived pin's yearOfStudy. If there is also no active
 * pin, we return null and the caller skips the stale-check silently —
 * same behavior as before T20.
 */
async function resolveYearOfStudyForStalePinCheck(
  studentId: string,
): Promise<number | null> {
  try {
    const { yearOfStudy } = await resolveStudentYearOfStudy(studentId);
    return yearOfStudy;
  } catch {
    // Fall through to the active-pin heuristic.
  }
  const doc = await Student.findById(studentId).select('feePins').lean();
  if (!doc) return null;
  const actives = (doc.feePins || []).filter((p: any) => !p.archivedAt);
  if (actives.length === 0) return null;
  return actives.reduce(
    (max: number, p: any) => (p.yearOfStudy > max ? p.yearOfStudy : max),
    0,
  );
}

export async function deleteStudent(collegeId: string, id: string, performedBy: string) {
  const doc = await Student.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Student not found');
  await createAuditLog({ collegeId, entityType: 'Student', entityId: id, entityName: 'Student', action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Faculty ─────────────────────────────────────────

export async function listFaculty(collegeId: string, page: number, limit: number, status?: string, search?: string, authScope?: AuthScope) {
  const filter: any = { collegeId: toOid(collegeId) };
  if (authScope) applyAuthScope(filter, authScope);
  if (status) filter.status = status;
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: filter },
    { $lookup: { from: 'people', localField: 'personId', foreignField: '_id', as: 'person' } },
    { $unwind: '$person' },
    { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
  ];
  if (search) pipeline.push({ $match: { 'person.name': { $regex: search, $options: 'i' } } });

  const [items, countResult] = await Promise.all([
    Faculty.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Faculty.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = countResult[0]?.total || 0;
  return {
    items: items.map(item => ({ ...item, profileCompleteness: getFacultyProfileCompleteness(item) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function getFaculty(collegeId: string, id: string): Promise<any> {
  const doc = await Faculty.findOne({ _id: id, collegeId }).populate('personId').populate('departmentId').lean();
  if (!doc) throw new AppError(404, 'Faculty not found');
  return { ...doc, profileCompleteness: getFacultyProfileCompleteness(doc) };
}

export async function createFaculty(collegeId: string, data: any, performedBy: string) {
  const person = await createPersonRecord(collegeId, data);
  const fields: any = {
    collegeId, personId: person._id,
    employeeCode: data.employeeCode, designation: data.designation,
    contractType: data.contractType || 'regular', status: data.status || 'active',
  };
  ['specialization', 'qualification', 'departmentId'].forEach(k => { if (data[k]) fields[k] = data[k]; });
  // externalIds is the NAAC-evidence floor (Strategic Gap 1 Phase A).
  // Persist on create when the operator filled any of the 33 fields.
  if (data.externalIds && typeof data.externalIds === 'object') {
    fields.externalIds = data.externalIds;
  }
  // profileBio + office are Phase B1 content blocks. Same shape rule as
  // externalIds — only persist when present and an object.
  if (data.profileBio && typeof data.profileBio === 'object') {
    fields.profileBio = data.profileBio;
  }
  if (data.office && typeof data.office === 'object') {
    fields.office = data.office;
  }
  const doc = await Faculty.create(fields);
  await createAuditLog({ collegeId, entityType: 'Faculty', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return { ...doc.toObject(), person: person.toObject() };
}

export async function updateFaculty(collegeId: string, id: string, data: any, performedBy: string) {
  const fac = await Faculty.findOne({ _id: id, collegeId });
  if (!fac) throw new AppError(404, 'Faculty not found');

  const personFields: any = {};
  ['name', 'phone', 'alternatePhone', 'email', 'aadhaar', 'dob', 'gender', 'preferredLanguage', 'address', 'emergencyContact', 'biometricEnrolled'].forEach(k => { if (data[k] !== undefined) personFields[k] = data[k]; });
  if (Object.keys(personFields).length > 0) await Person.findByIdAndUpdate(fac.personId, { $set: personFields });

  const facFields: any = {};
  ['employeeCode', 'designation', 'specialization', 'qualification', 'contractType', 'status', 'departmentId'].forEach(k => { if (data[k] !== undefined) facFields[k] = data[k]; });
  // externalIds is set as a whole object — operators clear individual
  // IDs by sending an empty string, and clear the entire bag by sending
  // an empty object (or omitting the key). Mongoose merges via $set at
  // the path level so partial updates work as expected.
  if (data.externalIds !== undefined) {
    facFields.externalIds = data.externalIds;
  }
  // Same whole-object semantics for profileBio + office (Phase B1).
  if (data.profileBio !== undefined) {
    facFields.profileBio = data.profileBio;
  }
  if (data.office !== undefined) {
    facFields.office = data.office;
  }
  if (Object.keys(facFields).length > 0) await Faculty.findByIdAndUpdate(id, { $set: facFields });

  await createAuditLog({ collegeId, entityType: 'Faculty', entityId: id, entityName: data.name || 'Faculty', action: 'update', changes: [], performedBy });
  const doc = await Faculty.findById(id).populate('personId').populate('departmentId').lean();
  return doc;
}

export async function deleteFaculty(collegeId: string, id: string, performedBy: string) {
  const doc = await Faculty.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Faculty not found');
  await createAuditLog({ collegeId, entityType: 'Faculty', entityId: id, entityName: 'Faculty', action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Staff ───────────────────────────────────────────

export async function listStaff(collegeId: string, page: number, limit: number, status?: string, search?: string, authScope?: AuthScope) {
  const filter: any = { collegeId: toOid(collegeId) };
  if (authScope) applyAuthScope(filter, authScope);
  if (status) filter.status = status;
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: filter },
    { $lookup: { from: 'people', localField: 'personId', foreignField: '_id', as: 'person' } },
    { $unwind: '$person' },
    { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
  ];
  if (search) pipeline.push({ $match: { 'person.name': { $regex: search, $options: 'i' } } });

  const [items, countResult] = await Promise.all([
    Staff.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Staff.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = countResult[0]?.total || 0;
  return {
    items: items.map(item => ({ ...item, profileCompleteness: getStaffProfileCompleteness(item) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function getStaff(collegeId: string, id: string): Promise<any> {
  const doc = await Staff.findOne({ _id: id, collegeId }).populate('personId').populate('departmentId').lean();
  if (!doc) throw new AppError(404, 'Staff not found');
  return { ...doc, profileCompleteness: getStaffProfileCompleteness(doc) };
}

export async function createStaff(collegeId: string, data: any, performedBy: string) {
  const person = await createPersonRecord(collegeId, data);
  const fields: any = {
    collegeId, personId: person._id,
    employeeCode: data.employeeCode, designation: data.designation,
    staffType: data.staffType, status: data.status || 'active',
  };
  if (data.departmentId) fields.departmentId = data.departmentId;
  // Strategic Gap 7 — sub-persona + cluster-head pass-through.
  if (data.personaCode) fields.personaCode = data.personaCode;
  if (Array.isArray(data.clusterHeadOfPersonIds)) fields.clusterHeadOfPersonIds = data.clusterHeadOfPersonIds;
  const doc = await Staff.create(fields);
  await createAuditLog({ collegeId, entityType: 'Staff', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return { ...doc.toObject(), person: person.toObject() };
}

export async function updateStaff(collegeId: string, id: string, data: any, performedBy: string) {
  const s = await Staff.findOne({ _id: id, collegeId });
  if (!s) throw new AppError(404, 'Staff not found');

  const personFields: any = {};
  ['name', 'phone', 'alternatePhone', 'email', 'aadhaar', 'dob', 'gender', 'preferredLanguage', 'address', 'emergencyContact', 'biometricEnrolled'].forEach(k => { if (data[k] !== undefined) personFields[k] = data[k]; });
  if (Object.keys(personFields).length > 0) await Person.findByIdAndUpdate(s.personId, { $set: personFields });

  const staffFields: any = {};
  // Strategic Gap 7 — include personaCode + clusterHeadOfPersonIds in the
  // allowed-update list. Same defensive pattern: only keys explicitly
  // listed make it to the DB.
  ['employeeCode', 'designation', 'staffType', 'status', 'departmentId', 'personaCode', 'clusterHeadOfPersonIds'].forEach(k => { if (data[k] !== undefined) staffFields[k] = data[k]; });
  if (Object.keys(staffFields).length > 0) await Staff.findByIdAndUpdate(id, { $set: staffFields });

  await createAuditLog({ collegeId, entityType: 'Staff', entityId: id, entityName: data.name || 'Staff', action: 'update', changes: [], performedBy });
  const doc = await Staff.findById(id).populate('personId').populate('departmentId').lean();
  return doc;
}

export async function deleteStaff(collegeId: string, id: string, performedBy: string) {
  const doc = await Staff.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Staff not found');
  await createAuditLog({ collegeId, entityType: 'Staff', entityId: id, entityName: 'Staff', action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Parents ─────────────────────────────────────────

export async function listParents(collegeId: string, page: number, limit: number, search?: string, authScope?: AuthScope) {
  const filter: any = { collegeId: toOid(collegeId) };
  if (authScope) applyAuthScope(filter, authScope, { selfField: 'personId' });
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: filter },
    { $lookup: { from: 'people', localField: 'personId', foreignField: '_id', as: 'person' } },
    { $unwind: '$person' },
  ];
  if (search) pipeline.push({ $match: { 'person.name': { $regex: search, $options: 'i' } } });

  const [items, countResult] = await Promise.all([
    Parent.aggregate([...pipeline, { $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }]),
    Parent.aggregate([...pipeline, { $count: 'total' }]),
  ]);
  const total = countResult[0]?.total || 0;
  return {
    items: items.map(item => ({ ...item, profileCompleteness: getParentProfileCompleteness(item) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function createParent(collegeId: string, data: any, performedBy: string) {
  const person = await createPersonRecord(collegeId, data);
  const doc = await Parent.create({
    collegeId, personId: person._id,
    relationship: data.relationship,
    linkedStudents: data.linkedStudents || [],
    primaryContact: data.primaryContact || false,
    occupation: data.occupation,
    employer: data.employer,
    annualIncomeBand: data.annualIncomeBand,
    isFeeResponsible: data.isFeeResponsible || false,
    communicationPreference: data.communicationPreference,
  });
  await createAuditLog({ collegeId, entityType: 'Parent', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return { ...doc.toObject(), person: person.toObject() };
}

export async function getParent(collegeId: string, id: string): Promise<any> {
  const doc = await Parent.findOne({ _id: id, collegeId }).populate('personId').populate({
    path: 'linkedStudents',
    populate: { path: 'personId' },
  }).lean();
  if (!doc) throw new AppError(404, 'Parent not found');
  return { ...doc, profileCompleteness: getParentProfileCompleteness(doc) };
}

export async function updateParent(collegeId: string, id: string, data: any, performedBy: string): Promise<any> {
  const parent = await Parent.findOne({ _id: id, collegeId });
  if (!parent) throw new AppError(404, 'Parent not found');

  const personFields: any = {};
  ['name', 'phone', 'alternatePhone', 'email', 'aadhaar', 'dob', 'gender', 'preferredLanguage', 'address', 'emergencyContact', 'biometricEnrolled'].forEach(k => { if (data[k] !== undefined) personFields[k] = data[k]; });
  if (Object.keys(personFields).length > 0) await Person.findByIdAndUpdate(parent.personId, { $set: personFields });

  const parentFields: any = {};
  ['relationship', 'linkedStudents', 'primaryContact', 'occupation', 'employer', 'annualIncomeBand', 'isFeeResponsible', 'communicationPreference'].forEach(k => { if (data[k] !== undefined) parentFields[k] = data[k]; });
  if (Object.keys(parentFields).length > 0) await Parent.findByIdAndUpdate(id, { $set: parentFields });

  await createAuditLog({ collegeId, entityType: 'Parent', entityId: id, entityName: data.name || 'Parent', action: 'update', changes: [], performedBy });
  return getParent(collegeId, id);
}

export async function deleteParent(collegeId: string, id: string, performedBy: string) {
  const doc = await Parent.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Parent not found');
  await createAuditLog({ collegeId, entityType: 'Parent', entityId: id, entityName: 'Parent', action: 'delete', changes: [], performedBy });
  return { deleted: true };
}

// ─── Organizations ───────────────────────────────────

export async function listOrganizations(collegeId: string, page: number, limit: number, search?: string, authScope?: AuthScope) {
  const filter: any = { collegeId };
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (authScope) applyAuthScope(filter, authScope);
  const result = await paginate(Organization, filter, page, limit, { createdAt: -1 });
  return {
    ...result,
    items: result.items.map(item => ({ ...item, profileCompleteness: getOrganizationProfileCompleteness(item) })),
  };
}

export async function createOrganization(collegeId: string, data: any, performedBy: string) {
  const doc = await Organization.create({ ...data, collegeId });
  await createAuditLog({ collegeId, entityType: 'Organization', entityId: String(doc._id), entityName: data.name, action: 'create', changes: [], performedBy });
  return doc;
}

export async function getOrganization(collegeId: string, id: string): Promise<any> {
  const doc = await Organization.findOne({ _id: id, collegeId }).lean();
  if (!doc) throw new AppError(404, 'Organization not found');
  return { ...doc, profileCompleteness: getOrganizationProfileCompleteness(doc) };
}

export async function updateOrganization(collegeId: string, id: string, data: any, performedBy: string) {
  const doc = await Organization.findOneAndUpdate({ _id: id, collegeId }, { $set: data }, { new: true });
  if (!doc) throw new AppError(404, 'Organization not found');
  await createAuditLog({ collegeId, entityType: 'Organization', entityId: id, entityName: doc.name, action: 'update', changes: [], performedBy });
  return doc;
}

export async function deleteOrganization(collegeId: string, id: string, performedBy: string) {
  const doc = await Organization.findOneAndDelete({ _id: id, collegeId });
  if (!doc) throw new AppError(404, 'Organization not found');
  await createAuditLog({ collegeId, entityType: 'Organization', entityId: id, entityName: doc.name, action: 'delete', changes: [], performedBy });
  return { deleted: true };
}
